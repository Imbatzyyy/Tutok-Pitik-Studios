-- Run inside a transaction and roll it back: these fixtures must never send mail.
create function pg_temp.assert(ok boolean,msg text) returns void language plpgsql as $$begin if not coalesce(ok,false) then raise exception 'ASSERT: %',msg;end if;end $$;
insert into auth.users(id,email,created_at,updated_at) values
 ('66666666-0000-4000-8000-000000000001','owner-reminder@example.invalid',now(),now()),
 ('66666666-0000-4000-8000-000000000002','staff-reminder@example.invalid',now(),now()),
 ('66666666-0000-4000-8000-000000000003','client-reminder@example.invalid',now(),now());
update public.users set role=case right(id::text,1) when '1' then 'superadmin' when '2' then 'staff' else 'customer' end,status='active' where id::text like '66666666-%';
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
select ('66666666-1000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('66666666-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'totp','verified',now(),now() from generate_series(1,2)n;
insert into auth.sessions(id,user_id,aal,factor_id,created_at,updated_at)
select ('66666666-2000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('66666666-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'aal2',('66666666-1000-4000-8000-'||lpad(n::text,12,'0'))::uuid,now(),now() from generate_series(1,2)n;
insert into studio_private.admin_sessions(session_id,user_id)
select ('66666666-2000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('66666666-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,2)n;
create function pg_temp.claims(n integer,aal text default 'aal2') returns void language sql as $$select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub','66666666-0000-4000-8000-'||lpad(n::text,12,'0'),'session_id','66666666-2000-4000-8000-'||lpad(n::text,12,'0'),'aal',aal)::text,true)::text::void;$$;
create function pg_temp.bid(n integer) returns uuid language sql immutable as $$select ('77777777-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;$$;
insert into public.bookings(id,user_id,full_name,email,phone,service,booking_date,start_time,end_time,location,price,duration,total_price,status,created_at,updated_at,archived_at,needs_information)
select pg_temp.bid(n),'66666666-0000-4000-8000-000000000003','Owner reminder fixture','client-reminder@example.invalid','09000000000','Portrait Photography',
 case when n=11 then current_date-1 else current_date+100+n end,'10:00','12:00','Fixture venue',2500,2,5000,
 case n when 5 then 'confirmed' when 6 then 'completed' when 7 then 'cancelled' else 'pending' end,
 now()-case n when 1 then interval '1 hour' when 2 then interval '2 hours' else interval '3 hours' end,now()-interval '3 hours',
 case when n=8 then now() else null end,n=9 from generate_series(1,11)n;
delete from public.booking_email_outbox where booking_id::text like '77777777-%';
select pg_temp.assert(not has_table_privilege('authenticated','studio_private.booking_attention','select'),'Private attention records inaccessible');
select pg_temp.assert(not has_function_privilege('authenticated','public.studio_queue_owner_reminders()','execute'),'Browser cannot queue owner reminders');
select pg_temp.assert(not has_function_privilege('anon','public.studio_acknowledge_booking(uuid)','execute'),'Anonymous acknowledgement denied');
select pg_temp.assert(not has_function_privilege('authenticated','public.studio_prepare_owner_reminder(uuid)','execute'),'Browser cannot authorize a send');
set local role authenticated;
do $$declare blocked boolean;before_b public.bookings;after_b public.bookings;stamp timestamptz;begin
 for n in 2..3 loop perform pg_temp.claims(n);blocked=false;begin perform public.studio_acknowledge_booking(pg_temp.bid(4));exception when insufficient_privilege then blocked=true;end;perform pg_temp.assert(blocked,'Staff and customer cannot suppress owner reminders');end loop;
 perform pg_temp.claims(1,'aal1');blocked=false;begin perform public.studio_acknowledge_booking(pg_temp.bid(4));exception when insufficient_privilege then blocked=true;end;perform pg_temp.assert(blocked,'Unverified owner cannot acknowledge');
 perform pg_temp.claims(1);select * into before_b from public.bookings where id=pg_temp.bid(4);
 stamp=public.studio_acknowledge_booking(pg_temp.bid(4));select * into after_b from public.bookings where id=pg_temp.bid(4);
 perform pg_temp.assert(stamp is not null and before_b.version=after_b.version and before_b.updated_at=after_b.updated_at and after_b.status='pending','Opening acknowledges without approving or changing the draft version');
 perform pg_temp.assert(public.studio_acknowledge_booking(pg_temp.bid(4))=stamp,'Repeated acknowledgement is idempotent');
 perform pg_temp.assert(not(public.studio_public_schedule()?'owner_notice_hours'),'Public schedule omits private owner rule');
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_temp.assert(public.studio_queue_owner_reminders()=3,'Only unseen future pending bookings at least two hours old are queued');
select pg_temp.assert(public.studio_queue_owner_reminders()=0,'Repeated scheduler run does not duplicate jobs');
select pg_temp.assert((select count(*)=3 and bool_and(recipient='tutokpitikstudios@gmail.com' and payload->>'studio'='true') from public.booking_email_outbox where kind='owner_booking_unseen'),'Only official studio recipient is queued');
select pg_temp.assert((select count(*)=0 from public.booking_email_outbox where booking_id in(select pg_temp.bid(n) from generate_series(1,11)n where n not in(2,3,10))),'Fresh, seen, resolved, archived, waiting-for-client and past shoots excluded');
-- A queued retry stops immediately when an admin opens the booking.
select pg_temp.claims(1);
set local role authenticated;
select public.studio_acknowledge_booking(pg_temp.bid(2));
reset role;
select pg_temp.assert((select state='cancelled' from public.booking_email_outbox where booking_id=pg_temp.bid(2)),'Queued reminder cancelled by acknowledgement');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
update public.booking_email_outbox set state='sending' where booking_id=pg_temp.bid(3);
select pg_temp.assert(public.studio_prepare_owner_reminder((select id from public.booking_email_outbox where booking_id=pg_temp.bid(3))),'Eligible claimed reminder may send');
select pg_temp.claims(1);set local role authenticated;
select public.studio_acknowledge_booking(pg_temp.bid(3));
reset role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_temp.assert(not public.studio_prepare_owner_reminder((select id from public.booking_email_outbox where booking_id=pg_temp.bid(3))),'Pre-send recheck blocks a reminder acknowledged after claim');
select pg_temp.assert((select state='cancelled' from public.booking_email_outbox where booking_id=pg_temp.bid(3)),'Stale claimed reminder is cancelled');
-- Daily frequency uses both queue time and actual successful send time.
update public.booking_email_outbox set state='sent',sent_at=now() where booking_id=pg_temp.bid(10);
update studio_private.booking_attention set last_alert_at=now()-interval '25 hours' where booking_id=pg_temp.bid(10);
select pg_temp.assert(public.studio_queue_owner_reminders()=0,'Recent actual send prevents an early repeat');
update public.booking_email_outbox set sent_at=now()-interval '25 hours' where booking_id=pg_temp.bid(10);
select pg_temp.assert(public.studio_queue_owner_reminders()=1,'Still unopened booking gets one follow-up after 24 hours');
select pg_temp.assert(public.studio_queue_owner_reminders()=0,'Daily follow-up deduplicates');
update studio_private.booking_attention set last_alert_at=now()-interval '25 hours' where booking_id=pg_temp.bid(10);
select pg_temp.assert(public.studio_queue_owner_reminders()=0,'Existing unsent reminder prevents another queue entry');
update public.booking_email_outbox set state='sending' where booking_id=pg_temp.bid(10) and state='pending';
update public.bookings set status='confirmed' where id=pg_temp.bid(10);
select pg_temp.assert(not public.studio_prepare_owner_reminder((select id from public.booking_email_outbox where booking_id=pg_temp.bid(10) and kind='owner_booking_unseen' and state='sending')),'Resolved booking suppresses queued follow-up');
select pg_temp.assert((select schedule='*/15 * * * *' and active from cron.job where jobname='tps-owner-booking-reminders'),'Quarter-hour schedule is active');
select pg_temp.assert(public.studio_backup_snapshot()->'tables'?'studio_private.booking_attention','Encrypted backup snapshot includes acknowledgements');
select 'PASS: owner reminder permissions, two-hour eligibility, acknowledgement, daily deduplication, stale queue cancellation and schedule' as result;
