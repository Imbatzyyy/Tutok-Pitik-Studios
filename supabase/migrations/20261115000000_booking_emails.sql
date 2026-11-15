-- Transactional, service-only email queue. No existing bookings are emailed.
begin;
create table public.booking_email_outbox (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.bookings(id) on delete cascade,
 kind text not null check(kind in ('customer_requested','studio_requested','customer_confirmed')),
 recipient text not null,
 payload jsonb not null,
 state text not null default 'pending' check(state in ('pending','sending','sent','failed','review')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(), first_attempt_at timestamptz,
 locked_at timestamptz, sent_at timestamptz, provider_id text, last_error text,
 created_at timestamptz not null default now(), unique(booking_id,kind)
);
create index booking_email_pending on public.booking_email_outbox(state,next_attempt_at);
alter table public.booking_email_outbox enable row level security;
revoke all on public.booking_email_outbox from public,anon,authenticated;
grant all on public.booking_email_outbox to service_role;

create function public.queue_booking_emails() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare recipient_email text; snapshot jsonb;
begin
 -- Destination comes from Auth, never a client-supplied email field.
 select email into recipient_email from auth.users where id=new.user_id;
 snapshot=jsonb_build_object('id',new.id,'full_name',left(new.full_name,200),'service',left(new.service,200),
  'booking_date',new.booking_date,'start_time',new.start_time,'end_time',new.end_time,'duration',new.duration,
  'total_price',new.total_price,'transportation_fee',new.transportation_fee,'location',left(new.location,500),
  'phone',left(new.phone,40),'email',recipient_email,'status',new.status,
  'message',left(split_part(coalesce(new.message,''),E'\n\n---BOOKING_META---\n',1),2000));
 if TG_OP='INSERT' then
  if recipient_email is not null then
   insert into public.booking_email_outbox(booking_id,kind,recipient,payload) values(new.id,'customer_requested',recipient_email,snapshot) on conflict do nothing;
  end if;
  insert into public.booking_email_outbox(booking_id,kind,recipient,payload) values(new.id,'studio_requested','tutokpitikstudios@gmail.com',snapshot) on conflict do nothing;
 elsif new.status='confirmed' and old.status<>'confirmed' and recipient_email is not null then
  insert into public.booking_email_outbox(booking_id,kind,recipient,payload) values(new.id,'customer_confirmed',recipient_email,snapshot) on conflict do nothing;
 end if;
 return new;
end $$;
create trigger queue_booking_emails after insert or update of status on public.bookings for each row execute function public.queue_booking_emails();

create function public.claim_booking_emails(p_booking uuid default null,p_limit integer default 10)
returns setof public.booking_email_outbox language plpgsql security definer set search_path=public,pg_temp as $$
begin
 -- Resend only deduplicates for 24h. Ambiguous sends older than 23h need
 -- operator review, rather than risking a second customer notification.
 update public.booking_email_outbox set state='review',last_error='Delivery needs review before retrying'
 where state in ('pending','failed','sending') and first_attempt_at<now()-interval '23 hours' and (p_booking is null or booking_id=p_booking);
 return query with picked as (
 select id from public.booking_email_outbox where (p_booking is null or booking_id=p_booking)
 and ((state in ('pending','failed') and next_attempt_at<=now()) or (state='sending' and locked_at<now()-interval '5 minutes'))
 and attempts<8 order by created_at limit greatest(1,least(p_limit,10)) for update skip locked
 ) update public.booking_email_outbox e set state='sending',attempts=e.attempts+1,locked_at=now(),first_attempt_at=coalesce(e.first_attempt_at,now())
 from picked where e.id=picked.id returning e.*;
 update public.booking_email_outbox set state='review',last_error='Retry limit reached' where state='failed' and attempts>=8;
end $$;
revoke all on function public.queue_booking_emails() from public,anon,authenticated;
revoke all on function public.claim_booking_emails(uuid,integer) from public,anon,authenticated;
grant execute on function public.queue_booking_emails() to service_role;
grant execute on function public.claim_booking_emails(uuid,integer) to service_role;
commit;
