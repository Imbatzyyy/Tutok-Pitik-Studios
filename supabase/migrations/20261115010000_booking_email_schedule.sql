-- BOOKING_EMAIL_WORKER_TOKEN must first be stored as the Vault secret named
-- tps_booking_email_worker. It is a narrow worker credential, not service_role.
begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create function public.dispatch_booking_email_queue() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare worker text;
begin
 if not exists(select 1 from public.booking_email_outbox where
  (state in ('pending','failed') and next_attempt_at<=now()) or (state='sending' and locked_at<now()-interval '5 minutes')) then return; end if;
 select decrypted_secret into worker from vault.decrypted_secrets where name='tps_booking_email_worker';
 if worker is null then raise exception 'Booking email worker credential missing'; end if;
 perform net.http_post(url:='https://dhqxzrzjvgcmjjkmxlfs.supabase.co/functions/v1/booking-emails',
 headers:=jsonb_build_object('Content-Type','application/json','x-worker-token',worker),body:='{}'::jsonb,timeout_milliseconds:=60000);
end $$;
revoke all on function public.dispatch_booking_email_queue() from public,anon,authenticated;
grant execute on function public.dispatch_booking_email_queue() to service_role;
revoke all on net.http_request_queue,net._http_response from public,anon,authenticated;
select cron.schedule('tps-booking-email-retry','* * * * *','select public.dispatch_booking_email_queue();');
commit;
