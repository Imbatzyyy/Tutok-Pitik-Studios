begin;
alter table public.contact_messages
 add column request_key uuid unique,
 add column service text,
 add column hold_reference uuid unique,
 add column reply_phone text,
 add column visit_source text,
 add column visit_device text,
 add column preferred_date date,
 add column inquiry_state text not null default 'new' check(inquiry_state in ('new','working','replied','booked','closed')),
 add column owner_id uuid references public.users(id) on delete set null,
 add column first_replied_at timestamptz;
-- Anonymous inquiries enter through the rate-limited website function.
revoke insert,update,delete on public.contact_messages from anon,authenticated;
create function public.studio_handle_inquiry(p_id uuid,p_state text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_studio_admin() then raise exception 'Studio admin required' using errcode='42501'; end if;
 if p_state not in ('working','replied','booked','closed') then raise exception 'Unknown inquiry status'; end if;
 update public.contact_messages set inquiry_state=p_state,owner_id=auth.uid(),
 first_replied_at=case when p_state='replied' then coalesce(first_replied_at,now()) else first_replied_at end where id=p_id;
 if not found then raise exception 'Inquiry unavailable'; end if;
end $$;
revoke all on function public.studio_handle_inquiry(uuid,text) from public,anon;
grant execute on function public.studio_handle_inquiry(uuid,text) to authenticated;

-- A client can open one reconciliation case for a hold, including after expiry.
-- The case contains enough information to reconcile it independently of the hold table.
create function public.studio_report_paid_hold(p_hold uuid,p_reference text) returns uuid
language plpgsql security definer set search_path='' as $$
declare h studio_private.booking_holds; u public.users; case_id uuid;
begin
 select * into h from studio_private.booking_holds where id=p_hold and customer=auth.uid();
 if not found or not public.is_active_studio_user() then raise exception 'Hold unavailable'; end if;
 select id into case_id from public.contact_messages where hold_reference=p_hold;
 if found then return case_id; end if;
 if p_reference is null or trim(p_reference) !~ '^[0-9A-Za-z -]{6,40}$' then raise exception 'Check the GCash transaction reference'; end if;
 select * into strict u from public.users where id=auth.uid();
 insert into public.contact_messages(name,email,subject,message,service,preferred_date,hold_reference)
 values(coalesce(u.full_name,'Studio customer'),u.email,'GCash payment reconciliation',
 format('Client reported a GCash transfer. Verify it against the studio ledger before confirming a booking or processing a refund. Hold %s. Session %s, %s to %s. Transaction reference %s.',h.id,h.shoot_date,h.starts,h.ends,trim(p_reference)),
 h.service,h.shoot_date,h.id)
 on conflict(hold_reference) do update set hold_reference=excluded.hold_reference returning id into case_id;
 return case_id;
end $$;
revoke all on function public.studio_report_paid_hold(uuid,text) from public,anon;
grant execute on function public.studio_report_paid_hold(uuid,text) to authenticated;

create table studio_private.funnel_counts(
 day date not null,service text not null,stage text not null,device text not null,source text not null,total bigint not null default 1,
 primary key(day,service,stage,device,source)
);
create function public.studio_count_visit(p_service text,p_stage text,p_device text,p_source text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' or p_stage not in ('service_view','package','signup_return','slot','submitted','inquiry','retry_failed') or p_service not in ('portrait','birthday','event','commercial','landscape','other') or p_device not in ('mobile','desktop') or p_source not in ('direct','social','search','referral') then raise exception 'Invalid counter'; end if;
 insert into studio_private.funnel_counts(day,service,stage,device,source) values((now() at time zone 'Asia/Manila')::date,p_service,p_stage,p_device,p_source)
 on conflict(day,service,stage,device,source) do update set total=studio_private.funnel_counts.total+1;
end $$;
revoke all on function public.studio_count_visit(text,text,text,text) from public,anon,authenticated;
grant execute on function public.studio_count_visit(text,text,text,text) to service_role;

create function public.studio_client_experience() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_studio_admin() then raise exception 'Studio admin required'; end if;
 return jsonb_build_object(
 'opened_pending',(select count(*) from public.bookings b join studio_private.booking_attention a on a.booking_id=b.id where a.opened_at is not null and b.status='pending' and b.archived_at is null),
 'oldest_proof',(select min(p.created_at) from public.booking_payments p join public.bookings b on b.id=p.booking_id where p.status='pending' and b.archived_at is null and b.status<>'cancelled'),
 'follow_up',coalesce((select jsonb_agg(to_jsonb(q)) from (select b.id,b.service,b.created_at,a.opened_at,coalesce(u.full_name,'Unassigned') as owner from public.bookings b join studio_private.booking_attention a on a.booking_id=b.id left join public.users u on u.id=b.assigned_to where a.opened_at is not null and b.status='pending' and b.archived_at is null order by b.created_at limit 8) q),'[]'::jsonb),
 'visits',coalesce((select jsonb_agg(to_jsonb(x)) from (select service,stage,device,source,sum(total) as total from studio_private.funnel_counts where day>=(now() at time zone 'Asia/Manila')::date-29 group by service,stage,device,source order by service,stage) x),'[]'::jsonb),
 'inquiries',coalesce((select jsonb_agg(to_jsonb(c)) from (select service,visit_device device,visit_source source,count(*) total,count(*) filter(where inquiry_state in ('working','replied','booked')) qualified,count(*) filter(where inquiry_state='booked') booked from public.contact_messages where hold_reference is null and request_key is not null and created_at>=now()-interval '30 days' group by service,visit_device,visit_source)c),'[]'::jsonb),
 'payment_cases',(select count(*) from public.contact_messages where hold_reference is not null and inquiry_state not in ('closed','booked')),
 'confirmed',coalesce((select jsonb_agg(to_jsonb(z)) from (select b.service,h.visit_device device,h.visit_source source,count(*) as total from public.bookings b left join studio_private.booking_holds h on h.id=b.client_request_id where b.created_at>=now()-interval '30 days' and b.status in ('confirmed','completed') group by b.service,h.visit_device,h.visit_source)z),'[]'::jsonb),
 'decision', (select jsonb_build_object('sample',count(*),'median',percentile_cont(.5) within group(order by hours),'p90',percentile_cont(.9) within group(order by hours)) from (
 select extract(epoch from(min(a.occurred_at)-b.created_at))/3600 as hours from public.bookings b join public.studio_activity a on a.record_id=b.id::text and a.resource='bookings' where b.created_at>=now()-interval '30 days' and a.actor_role in ('admin','superadmin','staff') and a.status_after in ('confirmed','cancelled') group by b.id,b.created_at) d));
end $$;
revoke all on function public.studio_client_experience() from public,anon;
grant execute on function public.studio_client_experience() to authenticated;
create or replace function public.studio_public_schedule() returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(s)-'updated_at'-'owner_notice_hours' from public.studio_settings s where id;
$$;
create or replace function public.studio_backup_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;tables jsonb:='{}';schemas jsonb:='{}';t record;rows jsonb;cols jsonb;constraints jsonb;routines jsonb;policies jsonb;triggers jsonb;begin
 for t in select n.nspname,c.relname,c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and
 (n.nspname='public' or(n.nspname='auth' and c.relname in ('users','identities','mfa_factors')) or(n.nspname='storage' and c.relname in ('buckets','objects')) or(n.nspname='studio_private' and c.relname in ('recovery_codes','email_events','booking_attention','booking_holds','funnel_counts'))) order by 1,2 loop
 execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from %I.%I x',t.nspname,t.relname) into rows;
 select jsonb_agg(jsonb_build_object('name',a.attname,'type',case when ty.typtype='e' then 'text' else format_type(a.atttypid,a.atttypmod) end,'nullable',not a.attnotnull,'generated',a.attgenerated,'identity',a.attidentity) order by a.attnum) into cols from pg_attribute a join pg_type ty on ty.oid=a.atttypid where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped;
 select coalesce(jsonb_agg(jsonb_build_object('name',conname,'type',contype,'definition',pg_get_constraintdef(oid))),'[]') into constraints from pg_constraint where conrelid=t.oid;
 tables=tables||jsonb_build_object(t.nspname||'.'||t.relname,rows);schemas=schemas||jsonb_build_object(t.nspname||'.'||t.relname,jsonb_build_object('columns',cols,'constraints',constraints));
 end loop;
 select coalesce(jsonb_agg(pg_get_functiondef(p.oid)),'[]') into routines from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','studio_private') and p.prokind='f';
 select coalesce(jsonb_agg(to_jsonb(p)),'[]') into policies from pg_policies p where schemaname in ('public','storage','realtime');
 select coalesce(jsonb_agg(pg_get_triggerdef(tr.oid)),'[]') into triggers from pg_trigger tr join pg_class c on c.oid=tr.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','studio_private') and not tr.tgisinternal;
 return jsonb_build_object('format','tps-application-recovery-v1','captured_at',now(),'project','dhqxzrzjvgcmjjkmxlfs','tables',tables,'schema',schemas,'functions',routines,'policies',policies,'triggers',triggers,'scope','Application records, account identities, MFA records and storage metadata. Provider configuration, API keys and login sessions are excluded.');
end $$;
notify pgrst,'reload schema';
commit;
