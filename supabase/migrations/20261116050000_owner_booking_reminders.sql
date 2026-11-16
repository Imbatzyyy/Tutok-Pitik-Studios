begin;
alter table public.studio_settings add column owner_notice_hours integer not null default 2 check(owner_notice_hours between 1 and 168);
create table studio_private.booking_attention (
 booking_id uuid primary key references public.bookings(id) on delete cascade,
 opened_at timestamptz,opened_by uuid references public.users(id) on delete set null,
 last_alert_at timestamptz,alert_count integer not null default 0
);
revoke all on studio_private.booking_attention from public,anon,authenticated;
alter table public.booking_email_outbox drop constraint booking_email_outbox_state_check;
alter table public.booking_email_outbox add constraint booking_email_outbox_state_check check(state in ('pending','sending','sent','failed','review','cancelled'));

-- Acknowledgement is separate from booking changes, so opening a record never
-- approves it, touches its version or discards another operator's draft.
create function public.studio_acknowledge_booking(p_booking uuid) returns timestamptz language plpgsql security definer set search_path='' as $$
declare seen timestamptz;begin
 if not public.is_studio_admin() then raise exception 'Admin sign-in required' using errcode='42501';end if;
 perform 1 from public.bookings where id=p_booking for update;
 if not found then raise exception 'Booking unavailable' using errcode='22023';end if;
 insert into studio_private.booking_attention(booking_id,opened_at,opened_by) values(p_booking,now(),auth.uid())
 on conflict(booking_id) do update set opened_at=coalesce(booking_attention.opened_at,excluded.opened_at),opened_by=case when booking_attention.opened_at is null then excluded.opened_by else booking_attention.opened_by end returning opened_at into seen;
 update public.booking_email_outbox set state='cancelled',delivery_state='cancelled',last_error=null
 where booking_id=p_booking and kind='owner_booking_unseen' and state in ('pending','failed');
 return seen;
end $$;
revoke all on function public.studio_acknowledge_booking(uuid) from public,anon;
grant execute on function public.studio_acknowledge_booking(uuid) to authenticated;

create function studio_private.owner_reminder_eligible(p_booking uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.bookings b cross join public.studio_settings s
 left join studio_private.booking_attention a on a.booking_id=b.id
 where s.id and b.id=p_booking and b.status='pending' and b.archived_at is null
 and not b.needs_information and (b.booking_date+b.start_time) at time zone 'Asia/Manila'>now()
 and b.created_at<=now()-s.owner_notice_hours*interval '1 hour' and a.opened_at is null);
$$;
revoke all on function studio_private.owner_reminder_eligible(uuid) from public,anon,authenticated;

create function public.studio_queue_owner_reminders() returns integer language plpgsql security definer set search_path='' as $$
declare b record;a studio_private.booking_attention;n integer:=0;begin
 if auth.role() is distinct from 'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'Service access required' using errcode='42501';end if;
 -- Concurrent cron/manual invocations serialize before touching booking rows.
 perform pg_advisory_xact_lock(1730126);
 for b in select id,created_at from public.bookings where studio_private.owner_reminder_eligible(id) order by created_at for update skip locked loop
  insert into studio_private.booking_attention(booking_id) values(b.id) on conflict do nothing;
  select * into a from studio_private.booking_attention where booking_id=b.id;
  if a.opened_at is not null or a.last_alert_at>now()-interval '24 hours' then continue;end if;
  if exists(select 1 from public.booking_email_outbox where booking_id=b.id and kind='owner_booking_unseen' and
   (state in ('pending','failed','sending','review') or sent_at>now()-interval '24 hours')) then continue;end if;
  perform studio_private.enqueue_booking_email(b.id,'owner_booking_unseen','owner-unseen:'||(a.alert_count+1),
   'No admin has opened this booking. Open it in the workspace to review the request. Opening it does not confirm the reservation or payment.',true);
  update public.booking_email_outbox set payload=payload||jsonb_build_object('waiting_hours',floor(extract(epoch from(now()-b.created_at))/3600))
   where booking_id=b.id and event_key='owner-unseen:'||(a.alert_count+1);
  update studio_private.booking_attention set last_alert_at=now(),alert_count=alert_count+1 where booking_id=b.id;
  n=n+1;
 end loop;
 insert into public.studio_operations(key,state,detail,metadata) values('owner-reminders','healthy','Unopened booking reminders checked',jsonb_build_object('queued',n))
 on conflict(key) do update set checked_at=now(),state='healthy',detail=excluded.detail,metadata=excluded.metadata;
 return n;
end $$;
revoke all on function public.studio_queue_owner_reminders() from public,anon,authenticated;
grant execute on function public.studio_queue_owner_reminders() to service_role;

-- Recheck after claiming a job: a booking may have been opened/resolved while
-- the provider was unavailable. In-flight messages already submitted cannot be recalled.
create function public.studio_prepare_owner_reminder(p_job uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare target uuid;begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service access required' using errcode='42501';end if;
 select booking_id into target from public.booking_email_outbox where id=p_job and kind='owner_booking_unseen';
 if target is null then return false;end if;
 perform 1 from public.bookings where id=target for update;
 if not studio_private.owner_reminder_eligible(target) then
  update public.booking_email_outbox set state='cancelled',delivery_state='cancelled',last_error=null where id=p_job and state in ('pending','failed','sending');
  return false;
 end if;
 return exists(select 1 from public.booking_email_outbox where id=p_job and state='sending');
end $$;
revoke all on function public.studio_prepare_owner_reminder(uuid) from public,anon,authenticated;
grant execute on function public.studio_prepare_owner_reminder(uuid) to service_role;

create or replace function public.studio_schedule_settings(p_data jsonb) returns public.studio_settings language plpgsql security definer set search_path='' as $$declare s public.studio_settings;begin
 if not public.is_studio_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(1730123);
 update public.studio_settings set opens_at=(p_data->>'opens_at')::time,closes_at=(p_data->>'closes_at')::time,buffer_before=(p_data->>'buffer_before')::integer,buffer_after=(p_data->>'buffer_after')::integer,max_hours=(p_data->>'max_hours')::integer,lead_days=(p_data->>'lead_days')::integer,delivery_days=(p_data->>'delivery_days')::integer,review_hours=(p_data->>'review_hours')::integer,owner_notice_hours=coalesce((p_data->>'owner_notice_hours')::integer,owner_notice_hours),updated_at=now() where id returning * into s;
 return s;end $$;
create or replace function public.studio_public_schedule() returns jsonb language sql stable security definer set search_path='' as $$select to_jsonb(s)-'updated_at'-'review_hours'-'owner_notice_hours' from public.studio_settings s where id;$$;
select cron.schedule('tps-owner-booking-reminders','*/15 * * * *','select public.studio_queue_owner_reminders()');
-- Retain acknowledgement history in the existing encrypted recovery copies.
create or replace function public.studio_backup_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;tables jsonb:='{}';schemas jsonb:='{}';t record;rows jsonb;cols jsonb;constraints jsonb;routines jsonb;policies jsonb;triggers jsonb;begin
 for t in select n.nspname,c.relname,c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and
 (n.nspname='public' or(n.nspname='auth' and c.relname in ('users','identities','mfa_factors')) or(n.nspname='storage' and c.relname in ('buckets','objects')) or(n.nspname='studio_private' and c.relname in ('recovery_codes','email_events','booking_attention'))) order by 1,2 loop
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
