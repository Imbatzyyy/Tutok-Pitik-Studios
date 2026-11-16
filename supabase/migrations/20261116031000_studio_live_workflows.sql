begin;
alter table public.studio_activity add column actor_name text,add column changed_fields text[] not null default '{}';
create or replace function studio_private.record_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare before_row jsonb;after_row jsonb;who text;who_name text;fields text[];begin
 if tg_op<>'INSERT' then before_row=to_jsonb(old);end if;
 if tg_op<>'DELETE' then after_row=to_jsonb(new);end if;
 select role,full_name into who,who_name from public.users where id=auth.uid();
 select coalesce(array_agg(key),'{}') into fields from jsonb_object_keys(coalesce(after_row,before_row)) as key where key=any(array['status','payment_state','paid_amount','refunded_amount','transportation_fee','total_price','booking_date','start_time','end_time','assigned_to','editor_id','support_ids','delivery_due','gallery_status','gallery_url','archived_at','role','can_verify_payments']) and (before_row->key is distinct from after_row->key);
 insert into public.studio_activity(actor_id,actor_role,actor_name,resource,record_id,action,status_before,status_after,changed_fields)
 values(auth.uid(),coalesce(who,'system'),who_name,tg_table_name,coalesce(after_row->>'id',before_row->>'id'),lower(tg_op),before_row->>'status',after_row->>'status',fields);return coalesce(new,old);end $$;
create trigger studio_audit_settings after update on public.studio_settings for each row execute function studio_private.record_activity();
create trigger studio_audit_time_blocks after insert or update or delete on public.studio_time_blocks for each row execute function studio_private.record_activity();

create function studio_private.broadcast_refresh() returns trigger language plpgsql security definer set search_path='' as $$
declare rowdata jsonb;owner uuid;bid uuid;begin
 rowdata=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 -- Refresh signals deliberately contain no records, names, references, notes or IDs.
 perform realtime.send('{"refresh":true}'::jsonb,'changed','studio:team',true);
 if tg_table_name='bookings' then owner=(rowdata->>'user_id')::uuid;
 elsif tg_table_name='studio_notifications' then owner=(rowdata->>'user_id')::uuid;
 elsif tg_table_name like 'booking_%' then
 bid=(rowdata->>'booking_id')::uuid;select user_id into owner from public.bookings where id=bid;
 if tg_table_name='booking_notes' and (rowdata->>'internal')::boolean then owner=null;end if;
 end if;
 if owner is not null then perform realtime.send('{"refresh":true}'::jsonb,'changed','studio:user:'||owner::text,true);end if;
 return coalesce(new,old);
end $$;
do $$declare t text;begin foreach t in array array['bookings','booking_payments','booking_requests','booking_notes','booking_files','studio_notifications','studio_activity','studio_time_blocks','blocked_dates','contact_messages','studio_operations'] loop execute format('create trigger studio_live after insert or update or delete on public.%I for each row execute function studio_private.broadcast_refresh()',t);end loop;end $$;
create policy "Studio private refresh subscriptions" on realtime.messages for select to authenticated using(extension='broadcast' and ((realtime.topic()='studio:team' and public.is_studio_team()) or (realtime.topic()='studio:user:'||auth.uid()::text and public.is_active_studio_user())));

create function studio_private.notify_booking(p_booking uuid,p_title text,p_customer boolean default true) returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings;begin
 select * into b from public.bookings where id=p_booking;
 insert into public.studio_notifications(user_id,booking_id,title)
 select u.id,p_booking,left(p_title,180) from public.users u where u.status='active' and
 ((u.role in ('superadmin','super_admin','admin') or u.id=b.assigned_to or u.id=b.editor_id or u.id=any(b.support_ids)) or (p_customer and u.id=b.user_id)) and u.id is distinct from auth.uid();
end $$;

-- Each workflow event has its own deduplication key, including later reschedules.
alter table public.booking_email_outbox drop constraint booking_email_outbox_kind_check;
alter table public.booking_email_outbox drop constraint booking_email_outbox_booking_id_kind_key;
alter table public.booking_email_outbox add column event_key text;
update public.booking_email_outbox set event_key=kind where event_key is null;
alter table public.booking_email_outbox alter column event_key set not null;
create unique index booking_email_event on public.booking_email_outbox(booking_id,event_key);
alter table public.booking_email_outbox add column delivery_state text not null default 'queued',add column delivery_updated_at timestamptz;
create table studio_private.email_events(event_id text primary key,provider_id text not null,event_type text not null,event_at timestamptz not null,received_at timestamptz not null default now());
revoke all on studio_private.email_events from public,anon,authenticated;

create function studio_private.enqueue_booking_email(p_booking uuid,p_kind text,p_key text,p_message text default '',p_studio boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings;recipient_email text;payload jsonb;begin
 select * into b from public.bookings where id=p_booking;
 select email into recipient_email from auth.users where id=b.user_id;
 if p_studio then recipient_email='tutokpitikstudios@gmail.com';end if;
 if recipient_email is null then return;end if;
 payload=jsonb_build_object('id',b.id,'full_name',left(b.full_name,200),'service',left(b.service,200),'booking_date',b.booking_date,'start_time',b.start_time,'end_time',b.end_time,'duration',b.duration,'total_price',b.total_price,'transportation_fee',b.transportation_fee,'location',left(b.location,500),'phone',left(b.phone,40),'email',b.email,'status',b.status,'delivery_due',b.delivery_due,'paid_amount',b.paid_amount,'remaining_balance',greatest(b.total_price-b.paid_amount+b.refunded_amount,0),'notice',left(p_message,2000),'studio',p_studio,
 'message',left(split_part(coalesce(b.message,''),E'\n\n---BOOKING_META---\n',1),2000));
 insert into public.booking_email_outbox(booking_id,kind,recipient,payload,event_key) values(p_booking,p_kind,recipient_email,payload,p_key) on conflict(booking_id,event_key) do nothing;
end $$;
create or replace function public.queue_booking_emails() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='INSERT' then
 perform studio_private.enqueue_booking_email(new.id,'customer_requested','customer_requested');
 perform studio_private.enqueue_booking_email(new.id,'studio_requested','studio_requested','',true);
 perform studio_private.notify_booking(new.id,'New booking request',false);
 elsif new.status is distinct from old.status then
 if new.status='confirmed' then perform studio_private.enqueue_booking_email(new.id,'customer_confirmed','confirmed:'||new.version);end if;
 if new.status='cancelled' then perform studio_private.enqueue_booking_email(new.id,'booking_cancelled','cancelled:'||new.version);end if;
 perform studio_private.notify_booking(new.id,'Booking status updated');
 end if;return new;end $$;
create function studio_private.workflow_notifications() returns trigger language plpgsql security definer set search_path='' as $$
declare booking uuid;kind text;title text;customer boolean default true;msg text default '';begin
 if tg_table_name='booking_requests' then
 booking=new.booking_id;kind=case when tg_op='INSERT' then 'request_received' else 'request_resolved' end;title=case when tg_op='INSERT' then 'A booking request needs review' else 'Your booking request was updated' end;
 msg=replace(new.kind,'_',' ')||': '||new.status||case when tg_op='UPDATE' then '. '||new.response else '' end;
 perform studio_private.enqueue_booking_email(booking,kind,kind||':'||new.id||':'||new.status,msg,tg_op='INSERT');
 elsif tg_table_name='booking_notes' then
 booking=new.booking_id;customer=not new.internal;title=case when new.internal then 'New internal team note' else 'New booking message' end;
 if not new.internal then perform studio_private.enqueue_booking_email(booking,'booking_message','message:'||new.id,'Open the booking to read and reply.',new.author_role='customer');end if;
 elsif tg_table_name='booking_payments' then
 booking=new.booking_id;title=case when tg_op='INSERT' then 'Payment entry added' else 'Payment review updated' end;
 if tg_op='UPDATE' and new.status='rejected' and new.reason<>'Replaced by customer with new proof' then perform studio_private.enqueue_booking_email(booking,'payment_rejected','payment:'||new.id||':rejected',new.reason);end if;
 elsif tg_table_name='bookings' then
 booking=new.id;
 if new.gallery_status is distinct from old.gallery_status and new.gallery_status in ('ready','delivered') then title='Your gallery is ready';perform studio_private.enqueue_booking_email(booking,'gallery_ready','gallery:'||new.id||':'||new.version);
 elsif new.assigned_to is distinct from old.assigned_to or new.editor_id is distinct from old.editor_id or new.support_ids is distinct from old.support_ids then title='Booking team assignment updated';customer=false;
 elsif new.client_note is distinct from old.client_note and new.client_note<>'' then title='A note from your studio';perform studio_private.enqueue_booking_email(booking,'booking_message','client-note:'||new.version,'Open the booking to read the studio note.');
 else return new;end if;
 end if;
 if title is not null then perform studio_private.notify_booking(booking,title,customer);end if;return new;
end $$;
create trigger studio_request_notifications after insert or update of status on public.booking_requests for each row execute function studio_private.workflow_notifications();
create trigger studio_note_notifications after insert on public.booking_notes for each row execute function studio_private.workflow_notifications();
create trigger studio_payment_notifications after insert or update of status on public.booking_payments for each row execute function studio_private.workflow_notifications();
create trigger studio_delivery_notifications after update on public.bookings for each row execute function studio_private.workflow_notifications();

create function public.studio_email_event(p_event_id text,p_provider_id text,p_type text,p_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare mapped text;begin
 mapped=case p_type when 'email.sent' then 'sent' when 'email.delivered' then 'delivered' when 'email.delivery_delayed' then 'delayed' when 'email.bounced' then 'bounced' when 'email.failed' then 'failed' when 'email.complained' then 'complained' when 'email.suppressed' then 'suppressed' end;
 if mapped is null then return;end if;
 insert into studio_private.email_events values(p_event_id,p_provider_id,p_type,p_at,now()) on conflict do nothing;if not found then return;end if;
 update public.booking_email_outbox set delivery_state=mapped,delivery_updated_at=p_at where provider_id=p_provider_id and(delivery_updated_at is null or delivery_updated_at<=p_at);
 insert into public.studio_operations(key,state,detail) values('email-webhook','healthy','Signed delivery events are being received') on conflict(key) do update set state='healthy',checked_at=now(),detail=excluded.detail;
end $$;
create function public.studio_queue_reminders() returns integer language plpgsql security definer set search_path='' as $$declare b record;n integer:=0;begin
 for b in select id,booking_date,start_time from public.bookings where status='confirmed' and archived_at is null and (booking_date+start_time) at time zone 'Asia/Manila' between now() and now()+interval '24 hours' loop
 perform studio_private.enqueue_booking_email(b.id,'shoot_reminder','shoot-reminder:'||b.booking_date||':'||b.start_time,'Your shoot is approaching. Please review the venue, schedule and preparation details.');n=n+1;end loop;
 for b in select id,delivery_due from public.bookings where status='completed' and archived_at is null and gallery_status not in ('ready','delivered') and delivery_due<(now() at time zone 'Asia/Manila')::date loop
 perform studio_private.enqueue_booking_email(b.id,'delivery_overdue','delivery-overdue:'||b.delivery_due,'A gallery delivery is overdue. Review the booking and update the client.',true);end loop;
 insert into public.studio_operations(key,state,detail) values('reminders','healthy','Reminder queue checked') on conflict(key) do update set checked_at=now(),state='healthy',detail=excluded.detail;return n;end $$;
-- Runs inside the existing database scheduler; email delivery uses its existing worker.
select cron.schedule('tps-studio-reminders','17 * * * *','select public.studio_queue_reminders()');

create function public.studio_booking_page(p_filters jsonb default '{}',p_page integer default 0,p_size integer default 25) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if not public.is_studio_team() then raise exception 'Studio sign-in required' using errcode='42501';end if;
 if p_page<0 or p_page>10000 or p_size not between 1 and 100 then raise exception 'Invalid page';end if;
 with filtered as (
 select b.* from public.bookings b where public.studio_can_access_booking(b.id)
 and(case when coalesce(p_filters->>'archive','active')='archived' then b.archived_at is not null when p_filters->>'archive'='all' then true else b.archived_at is null end)
 and(coalesce(p_filters->>'q','')='' or b.full_name ilike '%'||left(p_filters->>'q',100)||'%' or b.email ilike '%'||left(p_filters->>'q',100)||'%' or b.id::text ilike '%'||left(p_filters->>'q',100)||'%' or b.service ilike '%'||left(p_filters->>'q',100)||'%')
 and(coalesce(p_filters->>'status','') in ('','all') or b.status=p_filters->>'status')
 and(coalesce(p_filters->>'service','') in ('','all') or b.service=p_filters->>'service')
 and(coalesce(p_filters->>'customer','')='' or b.user_id=nullif(p_filters->>'customer','')::uuid)
 and(coalesce(p_filters->>'from','')='' or b.booking_date>=(p_filters->>'from')::date)
 and(coalesce(p_filters->>'to','')='' or b.booking_date<=(p_filters->>'to')::date)
 and(case p_filters->>'view'
 when 'today' then b.booking_date=(now() at time zone 'Asia/Manila')::date and b.status<>'cancelled'
 when 'week' then b.booking_date between(now() at time zone 'Asia/Manila')::date and(now() at time zone 'Asia/Manila')::date+7 and b.status<>'cancelled'
 when 'mine' then b.assigned_to=auth.uid() or b.editor_id=auth.uid() or auth.uid()=any(b.support_ids)
 when 'payments' then b.payment_state in ('under_review','awaiting_proof','rejected') and b.status<>'cancelled'
 when 'requests' then exists(select 1 from public.booking_requests r where r.booking_id=b.id and r.status='pending')
 when 'unassigned' then b.assigned_to is null and b.status in ('pending','confirmed')
 when 'overdue' then b.delivery_due<(now() at time zone 'Asia/Manila')::date and b.gallery_status not in ('ready','delivered') and b.status<>'cancelled'
 when 'awaiting_client' then b.needs_information
 else true end)
 ),page as(select * from filtered order by case when p_filters->>'sort'='shoot' then booking_date end asc,created_at desc,id desc limit p_size offset p_page*p_size)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p)-'reserved_window') from page p),'[]'),'total',(select count(*) from filtered)) into result;return result;
end $$;
create function public.studio_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if not public.is_studio_team() then raise exception 'Studio sign-in required' using errcode='42501';end if;
 with scoped as(select * from public.bookings where archived_at is null and public.studio_can_access_booking(id)),
 queue as(select * from scoped where(status='pending' or needs_information or(status='confirmed' and booking_date between(now() at time zone 'Asia/Manila')::date and(now() at time zone 'Asia/Manila')::date+7) or(status='completed' and gallery_status not in ('ready','delivered'))) order by booking_date asc limit 100)
 select jsonb_build_object('pending',(select count(*) from scoped where status='pending'),'today',(select count(*) from scoped where booking_date=(now() at time zone 'Asia/Manila')::date and status='confirmed'),
 'unassigned',(select count(*) from scoped where assigned_to is null and status in ('pending','confirmed')),'overdue',(select count(*) from scoped where delivery_due<(now() at time zone 'Asia/Manila')::date and gallery_status not in ('ready','delivered') and status<>'cancelled'),
 'requests',(select count(*) from public.booking_requests r join scoped b on b.id=r.booking_id where r.status='pending'),
 'unreviewed',(select count(*) from public.booking_payments p join scoped b on b.id=p.booking_id where p.status='pending' and b.status<>'cancelled'),
 'late_reviews',(select count(*) from scoped where status='pending' and created_at<now()-(select review_hours from public.studio_settings where id)*interval '1 hour'),
 'email_issues',case when public.is_studio_admin() then(select count(*) from public.booking_email_outbox where state in ('failed','review') or delivery_state in ('bounced','failed','suppressed')) else null end,
 'queue',coalesce((select jsonb_agg(to_jsonb(q)-'reserved_window') from queue q),'[]')) into result;return result;end $$;
create function public.studio_finance_report(p_from date,p_to date,p_service text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if not public.is_studio_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>1096 then raise exception 'Choose a report period of up to three years';end if;
 with scoped as(select * from public.bookings where booking_date between p_from and p_to and(p_service='' or service=p_service)),
 payments as(select p.*,r.kind as original_kind from public.booking_payments p join scoped b on b.id=p.booking_id left join public.booking_payments r on r.id=p.reversal_of where p.status='verified')
 select jsonb_build_object('bookings',(select count(*) from scoped),'cancelled',(select count(*) from scoped where status='cancelled'),
 'booked_value',coalesce((select sum(total_price) from scoped where status<>'cancelled'),0),
 'deposits',coalesce((select sum(case when kind='deposit' then amount when kind='reversal' and original_kind='deposit' then -amount else 0 end) from payments),0),
 'final_payments',coalesce((select sum(case when kind='balance' then amount when kind='reversal' and original_kind='balance' then -amount else 0 end) from payments),0),
 'refunds',coalesce((select sum(case when kind='refund' then amount when kind='reversal' and original_kind='refund' then -amount else 0 end) from payments),0),
 'outstanding',coalesce((select sum(greatest(total_price-paid_amount+refunded_amount,0)) from scoped where status<>'cancelled'),0),
 'repeat_clients',(select count(*) from(select user_id from scoped group by user_id having count(*)>1)x),
 'avg_review_hours',(select round(avg(extract(epoch from(p.reviewed_at-p.created_at))/3600)::numeric,1) from public.booking_payments p join scoped b on b.id=p.booking_id where p.reviewed_at is not null),
 'by_service',coalesce((select jsonb_agg(x) from(select service,count(*) as bookings,sum(total_price) filter(where status<>'cancelled') as booked_value from scoped group by service)x),'[]'),
 'workload',coalesce((select jsonb_agg(x) from(select u.full_name,count(*) filter(where b.assigned_to=u.id) as shoots,count(*) filter(where b.editor_id=u.id) as editing,count(*) filter(where b.delivery_due<(now() at time zone 'Asia/Manila')::date and b.gallery_status not in ('ready','delivered')) as overdue from public.users u join scoped b on b.assigned_to=u.id or b.editor_id=u.id where b.status<>'cancelled' group by u.id,u.full_name)x),'[]'),
 'monthly',coalesce((select jsonb_agg(x) from(select to_char(booking_date,'YYYY-MM') as month,count(*) as bookings from scoped group by 1 order by 1)x),'[]')) into result;return result;end $$;
create function public.studio_clients(p_query text default '',p_page integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if not public.is_studio_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 with clients as(select distinct on(user_id) user_id,full_name,email,phone from public.bookings where user_id is not null order by user_id,created_at desc),
 filtered as(select c.*,(select count(*) from public.bookings where user_id=c.user_id) as bookings,(select max(booking_date) from public.bookings where user_id=c.user_id) as last_shoot from clients c where p_query='' or full_name ilike '%'||left(p_query,100)||'%' or email ilike '%'||left(p_query,100)||'%'),
 page as(select * from filtered order by full_name,user_id limit 24 offset greatest(0,p_page)*24)
 select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(p) from page p),'[]')) into result;return result;end $$;
create function public.studio_email_history(p_booking uuid default null,p_page integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if not public.is_studio_team() or(p_booking is not null and not public.studio_can_access_booking(p_booking)) or(p_booking is null and not public.is_studio_admin()) then raise exception 'Studio access required' using errcode='42501';end if;
 select coalesce(jsonb_agg(x),'[]') into result from(select id,booking_id,kind,state,delivery_state,attempts,created_at,sent_at,last_error from public.booking_email_outbox where(p_booking is null or booking_id=p_booking) order by created_at desc limit 50 offset greatest(p_page,0)*50)x;return result;end $$;
create function public.studio_retry_email(p_id uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_studio_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 -- Ambiguous delivery beyond the provider deduplication window stays in manual review.
 update public.booking_email_outbox set next_attempt_at=now() where id=p_id and state='failed' and attempts<8 and first_attempt_at>now()-interval '23 hours' and delivery_state not in ('bounced','complained','suppressed');
 if not found then raise exception 'This notification needs delivery review and cannot be safely retried automatically';end if;end $$;
revoke all on function public.studio_email_event(text,text,text,timestamptz),public.studio_queue_reminders() from public,anon,authenticated;
grant execute on function public.studio_email_event(text,text,text,timestamptz),public.studio_queue_reminders() to service_role;
do $$declare f record;begin for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('studio_booking_page','studio_overview','studio_finance_report','studio_clients','studio_email_history','studio_retry_email') loop execute format('revoke all on function %s from public,anon',f.signature);execute format('grant execute on function %s to authenticated',f.signature);end loop;end $$;
revoke all on all functions in schema studio_private from public,anon,authenticated;
commit;
