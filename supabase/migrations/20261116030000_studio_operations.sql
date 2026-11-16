begin;
-- Extend records without replacing historical booking fields or sending old notifications.
alter table public.bookings
 add column version bigint not null default 1,
 add column archived_at timestamptz,
 add column archived_reason text,
 add column assigned_to uuid references public.users(id) on delete set null,
 add column editor_id uuid references public.users(id) on delete set null,
 add column support_ids uuid[] not null default '{}',
 add column delivery_due date,
 add column checklist jsonb not null default '{}',
 add column preparation jsonb not null default '{}',
 add column needs_information boolean not null default false,
 add column payment_state text not null default 'under_review',
 add column paid_amount numeric(12,2) not null default 0,
 add column refunded_amount numeric(12,2) not null default 0,
 add column gallery_status text not null default 'not_started',
 add column gallery_url text not null default '',
 add column gallery_checked_at timestamptz,
 add column client_note text not null default '',
 add column buffer_before integer not null default 0 check(buffer_before between 0 and 180),
 add column buffer_after integer not null default 0 check(buffer_after between 0 and 180),
 add column client_request_id uuid;
create unique index bookings_request_id on public.bookings(user_id,client_request_id) where client_request_id is not null;
create index bookings_assignment on public.bookings(assigned_to,booking_date) where archived_at is null;
create index bookings_delivery_due on public.bookings(delivery_due) where archived_at is null;
alter table public.bookings add constraint bookings_payment_state check(payment_state in ('awaiting_proof','under_review','deposit_verified','partially_paid','paid','refund_pending','refunded','rejected'));
alter table public.bookings add constraint bookings_gallery_state check(gallery_status in ('not_started','editing','ready','delivered','revision_requested'));

create table public.studio_settings (
 id boolean primary key default true check(id), opens_at time not null default '08:00', closes_at time not null default '20:00',
 buffer_before integer not null default 15 check(buffer_before between 0 and 180), buffer_after integer not null default 15 check(buffer_after between 0 and 180),
 max_hours integer not null default 8 check(max_hours between 1 and 12), lead_days integer not null default 1 check(lead_days between 1 and 90),
 delivery_days integer not null default 14 check(delivery_days between 1 and 180), review_hours integer not null default 48 check(review_hours between 1 and 168),
 updated_at timestamptz not null default now(), check(closes_at>opens_at)
);
insert into public.studio_settings(id) values(true);
create table public.studio_permissions(user_id uuid primary key references public.users(id) on delete cascade,can_verify_payments boolean not null default false);
create table public.studio_time_blocks(id uuid primary key default gen_random_uuid(),block_date date not null,start_time time not null,end_time time not null,reason text not null default '',created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),check(end_time>start_time));
create index studio_time_blocks_date on public.studio_time_blocks(block_date);
create table public.booking_payments (
 id uuid primary key default gen_random_uuid(),booking_id uuid not null references public.bookings(id) on delete restrict,
 kind text not null check(kind in ('deposit','balance','refund','reversal')),
 amount numeric(12,2) not null check(amount>0 and amount<=10000000),method text not null default 'GCash' check(method in ('GCash','Cash','Bank transfer','Other')),
 reference text not null default '',proof_path text,proof_name text,
 status text not null default 'pending' check(status in ('pending','verified','rejected')),
 reason text not null default '',reversal_of uuid unique references public.booking_payments(id),
 created_by uuid references auth.users(id) on delete set null,reviewed_by uuid references auth.users(id) on delete set null,
 occurred_at timestamptz not null default now(),created_at timestamptz not null default now(),reviewed_at timestamptz,
 source text not null default 'studio' check(source in ('legacy','studio','customer'))
);
create index booking_payments_booking on public.booking_payments(booking_id,created_at);
create table public.booking_requests (
 id uuid primary key default gen_random_uuid(),booking_id uuid not null references public.bookings(id) on delete restrict,
 kind text not null check(kind in ('reschedule','cancellation','revision','refund')),
 requested_date date,start_time time,end_time time,reason text not null,amount numeric(12,2),
 status text not null default 'pending' check(status in ('pending','approved','declined','withdrawn')),
 response text not null default '',created_by uuid references auth.users(id) on delete set null,reviewed_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),reviewed_at timestamptz
);
create unique index booking_one_open_request on public.booking_requests(booking_id,kind) where status='pending';
create table public.booking_notes (
 id uuid primary key default gen_random_uuid(),booking_id uuid not null references public.bookings(id) on delete restrict,
 internal boolean not null default false,body text not null check(length(body) between 1 and 5000),
 author_id uuid references auth.users(id) on delete set null,author_name text not null,author_role text not null,created_at timestamptz not null default now()
);
create index booking_notes_booking on public.booking_notes(booking_id,created_at);
create table public.booking_files (
 id uuid primary key default gen_random_uuid(),booking_id uuid not null references public.bookings(id) on delete restrict,
 path text not null unique,name text not null,kind text not null check(kind in ('reference','programme','brief')),
 uploaded_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now()
);
create table public.studio_notifications (
 id bigint generated always as identity primary key,user_id uuid not null references auth.users(id) on delete cascade,
 booking_id uuid references public.bookings(id) on delete cascade,title text not null,created_at timestamptz not null default now(),read_at timestamptz
);
create index studio_notifications_user on public.studio_notifications(user_id,created_at desc);
create table public.studio_saved_views (id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,name text not null check(length(name) between 1 and 60),filters jsonb not null,created_at timestamptz not null default now(),unique(user_id,name));
create table public.studio_operations (key text primary key,state text not null,checked_at timestamptz not null default now(),detail text not null default '',metadata jsonb not null default '{}');

create function studio_private.booking_meta(raw text) returns jsonb language plpgsql immutable set search_path='' as $$
begin return coalesce(nullif(split_part(raw,E'\n\n---BOOKING_META---\n',2),'')::jsonb,'{}');exception when others then return '{}';end $$;
-- Compatibility: migrate old verified deposits only as labelled historical records.
insert into public.booking_payments(booking_id,kind,amount,reference,proof_path,proof_name,status,reason,occurred_at,source)
select id,'deposit',coalesce(nullif(studio_private.booking_meta(message)->>'downpaymentAmount','')::numeric,price*duration/2),
 coalesce(studio_private.booking_meta(message)->>'paymentReference',''),studio_private.booking_meta(message)->>'paymentReceiptPath',studio_private.booking_meta(message)->>'paymentReceiptName',
 case studio_private.booking_meta(message)->>'paymentStatus' when 'verified' then 'verified' when 'rejected' then 'rejected' else 'pending' end,
 'Imported from the existing booking record; original reviewer unavailable',created_at,'legacy'
from public.bookings where coalesce(nullif(studio_private.booking_meta(message)->>'downpaymentAmount','')::numeric,price*duration/2)>0;
-- Keep old updated_at untouched during this structural backfill.
alter table public.bookings disable trigger update_bookings_updated_at;
alter table public.bookings disable trigger studio_audit_bookings;
update public.bookings b set
 gallery_status=case when studio_private.booking_meta(message)->>'photoStatus' in ('editing','ready','delivered') then studio_private.booking_meta(message)->>'photoStatus' when status='completed' then 'editing' else 'not_started' end,
 gallery_url=coalesce(studio_private.booking_meta(message)->>'driveLink',''),client_note=coalesce(studio_private.booking_meta(message)->>'adminNote',''),
 paid_amount=coalesce((select sum(amount) from public.booking_payments where booking_id=b.id and status='verified'),0),
 payment_state=case when exists(select 1 from public.booking_payments where booking_id=b.id and status='verified') then 'deposit_verified' when exists(select 1 from public.booking_payments where booking_id=b.id and status='rejected') then 'rejected' else 'under_review' end;
alter table public.bookings enable trigger update_bookings_updated_at;
alter table public.bookings enable trigger studio_audit_bookings;
-- A database exclusion constraint resolves simultaneous reservations atomically.
alter table public.bookings add column reserved_window tsrange generated always as (tsrange(booking_date+start_time-buffer_before*interval '1 minute',booking_date+end_time+buffer_after*interval '1 minute','[)')) stored;
alter table public.bookings add constraint studio_no_overlapping_reservations exclude using gist(reserved_window with &&) where(status in ('pending','confirmed') and archived_at is null);

create function public.studio_can_access_booking(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bookings b where b.id=p_id and (
 (b.user_id=auth.uid() and public.is_active_studio_user()) or
 (public.is_studio_team() and (public.is_studio_admin() or auth.uid()=b.assigned_to or auth.uid()=b.editor_id or auth.uid()=any(b.support_ids)))
 ));
$$;
create function public.studio_can_verify_payment() returns boolean language sql stable security definer set search_path='' as $$
 select public.is_studio_admin() or(public.is_studio_team() and exists(select 1 from public.studio_permissions where user_id=auth.uid() and can_verify_payments));
$$;
revoke all on function public.studio_can_access_booking(uuid),public.studio_can_verify_payment() from public,anon;
grant execute on function public.studio_can_access_booking(uuid),public.studio_can_verify_payment() to authenticated;

-- Mutations go through version-checked RPCs. Removing a hidden button is never authorization.
revoke insert,update,delete on public.bookings from authenticated,anon;
drop policy if exists "Admins can view all bookings" on public.bookings;
create policy "Team reads permitted bookings" on public.bookings for select to authenticated using(public.is_studio_team() and public.studio_can_access_booking(id));
do $$ declare t text;begin
 foreach t in array array['studio_settings','studio_permissions','studio_time_blocks','booking_payments','booking_requests','booking_notes','booking_files','studio_notifications','studio_saved_views','studio_operations'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;end $$;
create policy "Studio settings read" on public.studio_settings for select to authenticated using(public.is_studio_team());
create policy "Own permission read" on public.studio_permissions for select to authenticated using(public.is_studio_team() and (user_id=auth.uid() or public.is_studio_superadmin()));
create policy "Team time blocks" on public.studio_time_blocks for select to authenticated using(public.is_studio_team());
create policy "Booking payments scoped" on public.booking_payments for select to authenticated using(public.studio_can_access_booking(booking_id));
create policy "Booking requests scoped" on public.booking_requests for select to authenticated using(public.studio_can_access_booking(booking_id));
create policy "Booking notes scoped" on public.booking_notes for select to authenticated using(public.studio_can_access_booking(booking_id) and (not internal or public.is_studio_team()));
create policy "Booking files scoped" on public.booking_files for select to authenticated using(public.studio_can_access_booking(booking_id));
create policy "Own notifications" on public.studio_notifications for select to authenticated using(user_id=auth.uid() and public.is_active_studio_user());
create policy "Own saved views" on public.studio_saved_views for all to authenticated using(user_id=auth.uid() and public.is_studio_team()) with check(user_id=auth.uid() and public.is_studio_team());
grant insert,update,delete on public.studio_saved_views to authenticated;
create policy "Admin operations read" on public.studio_operations for select to authenticated using(public.is_studio_admin());
drop policy if exists "Team reads relevant studio activity" on public.studio_activity;
create policy "Team reads scoped activity" on public.studio_activity for select to authenticated using(public.is_studio_admin() or (public.is_studio_team() and resource='bookings' and public.studio_can_access_booking(case when resource='bookings' then record_id::uuid else null end)));

create function studio_private.assert_booking_access(p_id uuid,p_team boolean default false) returns public.bookings language plpgsql security definer set search_path='' as $$
declare b public.bookings;begin
 select * into b from public.bookings where id=p_id for update;
 if not found or not public.studio_can_access_booking(p_id) or(p_team and not public.is_studio_team()) then raise exception 'You do not have access to this booking' using errcode='42501';end if;
 return b;
end $$;
create function studio_private.assert_receipt(p_path text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_path is null or split_part(p_path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='payment-receipts' and name=p_path) then raise exception 'Upload your payment proof before submitting';end if;
end $$;
create function studio_private.assert_schedule(p_date date,p_start time,p_end time,p_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare s public.studio_settings; w tsrange;begin
 perform pg_advisory_xact_lock(1730123);
 select * into s from public.studio_settings where id;
 if p_date is null or p_start is null or p_end is null or p_end<=p_start or p_start<s.opens_at or p_end>s.closes_at or extract(epoch from(p_end-p_start))/3600>s.max_hours then raise exception 'Choose a session within studio working hours';end if;
 if p_date<(now() at time zone 'Asia/Manila')::date+s.lead_days or p_date>((now() at time zone 'Asia/Manila')::date+interval '6 months')::date then raise exception 'Choose a date within the booking window';end if;
 -- All block changes and reservations share this transaction lock, closing the block/booking race.
 perform pg_advisory_xact_lock(1730123);
 w=tsrange(p_date+p_start-s.buffer_before*interval '1 minute',p_date+p_end+s.buffer_after*interval '1 minute','[)');
 if exists(select 1 from public.blocked_dates where blocked_date=p_date)
 or exists(select 1 from public.studio_time_blocks where block_date=p_date and w && tsrange(block_date+start_time,block_date+end_time,'[)'))
 or exists(select 1 from public.bookings where id is distinct from p_id and status in ('pending','confirmed') and archived_at is null and reserved_window && w) then raise exception 'That time is no longer available. Please choose another time' using errcode='23P01';end if;
end $$;
create function studio_private.booking_version() returns trigger language plpgsql set search_path='' as $$begin new.version=old.version+1;return new;end $$;
create trigger studio_version before update on public.bookings for each row execute function studio_private.booking_version();

create function public.studio_create_booking(p_payload jsonb,p_key uuid) returns public.bookings language plpgsql security definer set search_path='' as $$
declare b public.bookings;u public.users;m jsonb;rate numeric;hours numeric;s public.studio_settings;d date;st time;en time;begin
 if not public.is_active_studio_user() or not exists(select 1 from public.users where id=auth.uid() and role='customer') then raise exception 'Sign in to your customer account' using errcode='42501';end if;
 if p_key is null then raise exception 'Submission reference is required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_key::text,0));
 select * into b from public.bookings where user_id=auth.uid() and client_request_id=p_key;if found then return b;end if;
 if (select count(*) from public.bookings where user_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then raise exception 'Please wait before placing another reservation';end if;
 select * into u from public.users where id=auth.uid(); select * into s from public.studio_settings where id;
 d=(p_payload->>'booking_date')::date;st=(p_payload->>'start_time')::time;en=(p_payload->>'end_time')::time;
 perform studio_private.assert_schedule(d,st,en);
 rate=case p_payload->>'service' when 'Portrait Photography' then 2500 when 'Birthday Photography' then 1000 when 'Event Coverage' then 1500 when 'Commercial Photography' then 4000 when 'Landscape & Architecture' then 3000 else null end;
 if rate is null then raise exception 'Choose a valid photography service';end if;
 hours=extract(epoch from(en-st))/3600;
 if length(trim(coalesce(p_payload->>'location','')))<5 or length(p_payload->>'location')>500 then raise exception 'Provide the complete shoot location';end if;
 if length(trim(coalesce(p_payload->>'phone',u.phone,'')))<8 then raise exception 'Provide a contact phone number';end if;
 m=studio_private.booking_meta(p_payload->>'message');perform studio_private.assert_receipt(m->>'paymentReceiptPath');
 if length(trim(coalesce(m->>'paymentReference','')))<6 or length(m->>'paymentReference')>80 then raise exception 'Provide the GCash reference';end if;
 insert into public.bookings(user_id,full_name,email,phone,service,booking_date,start_time,end_time,duration,price,total_price,location,message,status,buffer_before,buffer_after,client_request_id)
 values(auth.uid(),u.full_name,u.email,left(coalesce(p_payload->>'phone',u.phone),40),p_payload->>'service',d,st,en,hours,rate,rate*hours,left(trim(p_payload->>'location'),500),
 left(split_part(coalesce(p_payload->>'message',''),E'\n\n---BOOKING_META---\n',1),2000)||E'\n\n---BOOKING_META---\n'||jsonb_build_object('paymentMethod','GCash','paymentReference',m->>'paymentReference','paymentReceiptPath',m->>'paymentReceiptPath','paymentReceiptName',left(m->>'paymentReceiptName',180),'paymentStatus','submitted','downpaymentAmount',rate*hours/2)::text,
 'pending',s.buffer_before,s.buffer_after,p_key) returning * into b;
 insert into public.booking_payments(booking_id,kind,amount,reference,proof_path,proof_name,created_by,source)
 values(b.id,'deposit',rate*hours/2,m->>'paymentReference',m->>'paymentReceiptPath',left(m->>'paymentReceiptName',180),auth.uid(),'customer');
 return b;
end $$;
revoke all on function public.studio_create_booking(jsonb,uuid) from public,anon;grant execute on function public.studio_create_booking(jsonb,uuid) to authenticated;

create function studio_private.refresh_payments(p_booking uuid) returns void language plpgsql security definer set search_path='' as $$
declare paid numeric;refunded numeric;total numeric;state text;begin
 select coalesce(sum(case when p.kind in ('deposit','balance') then p.amount when p.kind='reversal' and r.kind in ('deposit','balance') then -p.amount else 0 end),0),
 coalesce(sum(case when p.kind='refund' then p.amount when p.kind='reversal' and r.kind='refund' then -p.amount else 0 end),0)
 into paid,refunded from public.booking_payments p left join public.booking_payments r on r.id=p.reversal_of where p.booking_id=p_booking and p.status='verified';
 select total_price into total from public.bookings where id=p_booking;
 if exists(select 1 from public.booking_requests where booking_id=p_booking and kind='refund' and status='pending') or coalesce((select sum(amount) from public.booking_requests where booking_id=p_booking and kind='refund' and status='approved'),0)>refunded then state='refund_pending';
 elsif paid>0 and refunded>=paid then state='refunded';
 elsif paid-refunded>=total then state='paid';
 elsif paid-refunded>0 then state=case when exists(select 1 from public.booking_payments where booking_id=p_booking and kind='balance' and status='verified') then 'partially_paid' else 'deposit_verified' end;
 elsif exists(select 1 from public.booking_payments where booking_id=p_booking and status='pending') then state='under_review';
 elsif exists(select 1 from public.booking_payments where booking_id=p_booking and status='rejected') then state='rejected';else state='awaiting_proof';end if;
 update public.bookings set paid_amount=paid,refunded_amount=refunded,payment_state=state where id=p_booking;
end $$;

create function public.studio_update_booking(p_id uuid,p_version bigint,p_changes jsonb,p_reason text default '') returns public.bookings language plpgsql security definer set search_path='' as $$
declare b public.bookings;n public.bookings;target uuid;role_name text;v text;begin
 b=studio_private.assert_booking_access(p_id,true);
 if b.version<>p_version then raise exception 'This booking changed while you were editing. Review the latest version before saving' using errcode='40001';end if;
 if b.archived_at is not null then raise exception 'Restore this archived booking before editing';end if;
 if p_changes ?| array['assigned_to','editor_id','support_ids','transportation_fee','booking_date','start_time','end_time'] and not public.is_studio_admin() then raise exception 'An admin must approve assignments, prices and schedule changes' using errcode='42501';end if;
 if p_changes ?| array['booking_date','start_time','end_time'] then raise exception 'Use an approved reschedule request to change a reserved time';end if;
 n=b;
 if p_changes ? 'status' then n.status=p_changes->>'status';end if;
 if n.status not in ('pending','confirmed','completed','cancelled') then raise exception 'Invalid booking status';end if;
 if n.status<>b.status and n.status='confirmed' and b.paid_amount-b.refunded_amount<=0 then raise exception 'Verify a received payment before confirming this booking';end if;
 if n.status<>b.status and n.status='completed' and b.status<>'confirmed' then raise exception 'Only a confirmed shoot can be marked completed';end if;
 if b.status in ('cancelled','completed') and n.status<>b.status then raise exception 'Closed bookings cannot be reopened. Create a new reservation';end if;
 if n.status='cancelled' and n.status<>b.status and(not public.is_studio_admin() or length(trim(p_reason))<5) then raise exception 'An admin must provide a cancellation reason';end if;
 if p_changes ? 'transportation_fee' then
 n.transportation_fee=(p_changes->>'transportation_fee')::numeric;
 if n.transportation_fee<0 or n.transportation_fee>100000 then raise exception 'Enter a valid transportation fee';end if;
 if n.transportation_fee<>b.transportation_fee and length(trim(p_reason))<5 then raise exception 'Explain the price adjustment';end if;
 end if;
 if p_changes ? 'assigned_to' then n.assigned_to=nullif(p_changes->>'assigned_to','')::uuid;end if;
 if p_changes ? 'editor_id' then n.editor_id=nullif(p_changes->>'editor_id','')::uuid;end if;
 if p_changes ? 'support_ids' then select coalesce(array_agg(value::uuid),'{}') into n.support_ids from jsonb_array_elements_text(p_changes->'support_ids');end if;
 foreach target in array array_remove(array[n.assigned_to,n.editor_id]||n.support_ids,null) loop
 if not exists(select 1 from public.users where id=target and role in ('staff','admin','superadmin','super_admin') and status='active') then raise exception 'Assign an active studio team member';end if;end loop;
 if cardinality(n.support_ids)>6 then raise exception 'Assign at most six support members';end if;
 if p_changes ? 'delivery_due' then n.delivery_due=nullif(p_changes->>'delivery_due','')::date;end if;
 if n.delivery_due<b.booking_date then raise exception 'Delivery cannot be due before the shoot';end if;
 if p_changes ? 'checklist' then
 if jsonb_typeof(p_changes->'checklist')<>'object' or (p_changes->'checklist')-array['contact','venue','brief','equipment','shoot','delivery']<>'{}'::jsonb then raise exception 'Invalid checklist';end if;
 if exists(select 1 from jsonb_each(p_changes->'checklist') where jsonb_typeof(value)<>'boolean') then raise exception 'Checklist values must be true or false';end if;
 n.checklist=p_changes->'checklist';end if;
 if p_changes ? 'needs_information' then n.needs_information=(p_changes->>'needs_information')::boolean;end if;
 if p_changes ? 'client_note' then n.client_note=left(trim(p_changes->>'client_note'),2000);end if;
 if p_changes ? 'gallery_url' then n.gallery_url=trim(p_changes->>'gallery_url');end if;
 if n.gallery_url<>'' and(n.gallery_url !~ '^https://[^/[:space:]]+/' or length(n.gallery_url)>2048) then raise exception 'Use a valid HTTPS gallery link';end if;
 if p_changes ? 'gallery_status' then n.gallery_status=p_changes->>'gallery_status';end if;
 if n.gallery_url is distinct from b.gallery_url then n.gallery_checked_at=null;end if;
 if coalesce((p_changes->>'gallery_access_checked')::boolean,false) then n.gallery_checked_at=now();end if;
 if n.gallery_status in ('ready','delivered') and(n.gallery_url='' or n.gallery_checked_at is null) then raise exception 'Check the gallery opens for the intended client, then acknowledge the access check';end if;
 if n.status='completed' and b.status<>'completed' then
 n.delivery_due=coalesce(n.delivery_due,b.booking_date+(select delivery_days from public.studio_settings where id));
 if n.gallery_status='not_started' then n.gallery_status='editing';end if;end if;
 update public.bookings set status=n.status,transportation_fee=n.transportation_fee,total_price=price*duration+n.transportation_fee,
 assigned_to=n.assigned_to,editor_id=n.editor_id,support_ids=n.support_ids,delivery_due=n.delivery_due,checklist=n.checklist,needs_information=n.needs_information,
 client_note=n.client_note,gallery_url=n.gallery_url,gallery_status=n.gallery_status,gallery_checked_at=n.gallery_checked_at where id=p_id returning * into n;
 if length(trim(p_reason))>0 then insert into public.booking_notes(booking_id,internal,body,author_id,author_name,author_role) select p_id,true,'Change reason: '||left(trim(p_reason),1000),id,full_name,role from public.users where id=auth.uid();end if;
 if n.total_price<b.paid_amount-b.refunded_amount then raise exception 'Resolve the overpayment before reducing the booking price';end if;
 if n.total_price<>b.total_price then perform studio_private.refresh_payments(p_id);select * into n from public.bookings where id=p_id;end if;
 return n;
end $$;

create function public.studio_archive_booking(p_id uuid,p_version bigint,p_reason text,p_restore boolean default false) returns public.bookings language plpgsql security definer set search_path='' as $$
declare b public.bookings;begin
 b=studio_private.assert_booking_access(p_id,true);
 if not public.is_studio_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 if b.version<>p_version then raise exception 'This booking has changed. Refresh before continuing' using errcode='40001';end if;
 if not p_restore and(b.status not in ('completed','cancelled') or exists(select 1 from public.booking_requests where booking_id=p_id and status='pending') or exists(select 1 from public.booking_payments where booking_id=p_id and status='pending')) then raise exception 'Resolve the booking, pending payments and requests before archiving';end if;
 if length(trim(p_reason))<5 then raise exception 'Provide an archive or restoration reason';end if;
 update public.bookings set archived_at=case when p_restore then null else now() end,archived_reason=left(p_reason,500) where id=p_id returning * into b;return b;
end $$;

create function public.studio_payment_action(p_booking uuid,p_version bigint,p_action text,p_data jsonb) returns public.bookings language plpgsql security definer set search_path='' as $$
declare b public.bookings;p public.booking_payments;original public.booking_payments;v_reason text;ref text;amt numeric;k text;begin
 b=studio_private.assert_booking_access(p_booking);
 if b.version<>p_version then raise exception 'Payment details have changed. Refresh and review before saving' using errcode='40001';end if;
 if b.archived_at is not null then raise exception 'Archived bookings cannot receive payment changes';end if;
 v_reason=left(trim(coalesce(p_data->>'reason','')),1000);ref=left(trim(coalesce(p_data->>'reference','')),80);
 if p_action='submit_proof' then
 if b.user_id<>auth.uid() or b.status='cancelled' then raise exception 'This booking cannot accept new proof' using errcode='42501';end if;
 if (select count(*) from public.booking_payments where booking_id=p_booking and source='customer' and created_at>now()-interval '1 hour')>=5 then raise exception 'Please wait before submitting another payment proof';end if;
 perform studio_private.assert_receipt(p_data->>'proof_path');
 if length(ref)<6 then raise exception 'Provide the payment reference';end if;
 amt=(p_data->>'amount')::numeric;if amt<=0 or amt>greatest(b.total_price-(b.paid_amount-b.refunded_amount),0) then raise exception 'The payment amount must be positive and no more than the outstanding balance';end if;
 if p_data ? 'replaces' then
 update public.booking_payments set status='rejected',reason='Replaced by customer with new proof',reviewed_by=auth.uid(),reviewed_at=now() where id=(p_data->>'replaces')::uuid and booking_id=p_booking and status='pending' and created_by=auth.uid();
 if not found then raise exception 'This proof was already reviewed; refresh before replacing it';end if;end if;
 k=case when b.paid_amount=0 then 'deposit' else 'balance' end;
 insert into public.booking_payments(booking_id,kind,amount,reference,proof_path,proof_name,created_by,source) values(p_booking,k,amt,ref,p_data->>'proof_path',left(p_data->>'proof_name',180),auth.uid(),'customer');
 elsif p_action='review' then
 if not public.studio_can_verify_payment() then raise exception 'Payment approval permission is required' using errcode='42501';end if;
 select * into p from public.booking_payments where id=(p_data->>'id')::uuid and booking_id=p_booking for update;
 if not found or p.status<>'pending' then raise exception 'This payment has already been reviewed or is unavailable';end if;
 if p_data->>'status' not in ('verified','rejected') then raise exception 'Choose verified or rejected';end if;
 if p_data->>'status'='rejected' and length(v_reason)<5 then raise exception 'Explain why this proof was rejected';end if;
 if p_data->>'status'='verified' then
 if not coalesce((p_data->>'receipt_checked')::boolean,false) then raise exception 'Confirm you checked the payment against the money received';end if;
 perform pg_advisory_xact_lock(hashtextextended('payment:'||p.method||':'||lower(p.reference),0));
 if p.reference<>'' and exists(select 1 from public.booking_payments x where x.id<>p.id and x.status='verified' and x.method=p.method and lower(x.reference)=lower(p.reference) and x.kind in ('deposit','balance') and not exists(select 1 from public.booking_payments r where r.reversal_of=x.id and r.status='verified')) then raise exception 'This reference is already verified on another payment. Review it before proceeding';end if;
 if p.amount>greatest(b.total_price-(b.paid_amount-b.refunded_amount),0) then raise exception 'This payment exceeds the current balance';end if;end if;
 update public.booking_payments set status=p_data->>'status',reason=v_reason,reviewed_by=auth.uid(),reviewed_at=now() where id=p.id;
 elsif p_action='record' then
 if not public.is_studio_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 k=p_data->>'kind';amt=(p_data->>'amount')::numeric;
 if k not in ('deposit','balance','refund') or amt<=0 then raise exception 'Choose a valid payment amount and type';end if;
 if length(v_reason)<5 or not coalesce((p_data->>'receipt_checked')::boolean,false) then raise exception 'Record the v_reason and confirm the money was received or refunded';end if;
 if k='refund' and amt>b.paid_amount-b.refunded_amount then raise exception 'Refund cannot exceed the recorded net payments';end if;
 if k<>'refund' and amt>greatest(b.total_price-(b.paid_amount-b.refunded_amount),0) then raise exception 'Payment cannot exceed the outstanding balance';end if;
 if coalesce(p_data->>'method','')<>'Cash' and length(ref)<6 then raise exception 'Provide the transaction reference';end if;
 perform pg_advisory_xact_lock(hashtextextended('payment:'||(p_data->>'method')||':'||lower(ref),0));
 if coalesce((p_data->>'occurred_at')::timestamptz,now())>now()+interval '5 minutes' then raise exception 'A payment cannot be recorded in the future';end if;
 if ref<>'' and exists(select 1 from public.booking_payments x where lower(x.reference)=lower(ref) and x.method=p_data->>'method' and x.status='verified' and x.kind in ('deposit','balance') and not exists(select 1 from public.booking_payments r where r.reversal_of=x.id)) then raise exception 'This reference has already been verified';end if;
 insert into public.booking_payments(booking_id,kind,amount,method,reference,status,reason,created_by,reviewed_by,reviewed_at,occurred_at)
 values(p_booking,k,amt,p_data->>'method',ref,'verified',v_reason,auth.uid(),auth.uid(),now(),coalesce((p_data->>'occurred_at')::timestamptz,now()));
 elsif p_action='reverse' then
 if not public.is_studio_admin() or length(v_reason)<5 then raise exception 'An admin must explain this reversal' using errcode='42501';end if;
 select * into original from public.booking_payments where id=(p_data->>'id')::uuid and booking_id=p_booking for update;
 if not found or original.status<>'verified' or original.kind='reversal' or exists(select 1 from public.booking_payments where reversal_of=original.id) then raise exception 'This entry cannot be reversed';end if;
 if original.kind in ('deposit','balance') and b.paid_amount-original.amount<b.refunded_amount then raise exception 'Reverse the related refund before reversing this payment';end if;
 insert into public.booking_payments(booking_id,kind,amount,method,status,reason,reversal_of,created_by,reviewed_by,reviewed_at)
 values(p_booking,'reversal',original.amount,original.method,'verified',v_reason,original.id,auth.uid(),auth.uid(),now());
 else raise exception 'Unknown payment action';end if;
 perform studio_private.refresh_payments(p_booking);select * into b from public.bookings where id=p_booking;return b;
end $$;

create function public.studio_request_change(p_booking uuid,p_kind text,p_data jsonb) returns public.booking_requests language plpgsql security definer set search_path='' as $$
declare b public.bookings;r public.booking_requests;begin
 b=studio_private.assert_booking_access(p_booking);
 if b.archived_at is not null then raise exception 'Archived bookings cannot receive requests';end if;
 if length(trim(coalesce(p_data->>'reason','')))<5 or length(p_data->>'reason')>2000 then raise exception 'Please explain your request';end if;
 if p_kind in ('reschedule','cancellation') and b.status not in ('pending','confirmed') then raise exception 'This reservation is already closed';end if;
 if p_kind='reschedule' then perform studio_private.assert_schedule((p_data->>'date')::date,(p_data->>'start')::time,(p_data->>'end')::time,p_booking);end if;
 if p_kind='revision' and b.gallery_status not in ('ready','delivered','revision_requested') then raise exception 'A gallery must be available before requesting a revision';end if;
 if p_kind='refund' and ((p_data->>'amount') is null or (p_data->>'amount')::numeric<=0 or (p_data->>'amount')::numeric>b.paid_amount-b.refunded_amount) then raise exception 'Enter an amount within the recorded net payments';end if;
 insert into public.booking_requests(booking_id,kind,requested_date,start_time,end_time,reason,amount,created_by)
 values(p_booking,p_kind,(p_data->>'date')::date,(p_data->>'start')::time,(p_data->>'end')::time,trim(p_data->>'reason'),(p_data->>'amount')::numeric,auth.uid()) returning * into r;
 if p_kind='refund' then perform studio_private.refresh_payments(p_booking);else update public.bookings set updated_at=now() where id=p_booking;end if;return r;
end $$;
create function public.studio_resolve_request(p_id uuid,p_version bigint,p_decision text,p_response text,p_accept_price boolean default false) returns public.bookings language plpgsql security definer set search_path='' as $$
declare r public.booking_requests;b public.bookings;s public.studio_settings;hours numeric;begin
 select * into r from public.booking_requests where id=p_id;if not found then raise exception 'Request not found';end if;
 b=studio_private.assert_booking_access(r.booking_id);
 if b.version<>p_version then raise exception 'This booking changed. Refresh before responding' using errcode='40001';end if;
 select * into r from public.booking_requests where id=p_id for update;
 if r.status<>'pending' then raise exception 'This request has already been handled';end if;
 if p_decision='withdrawn' and r.created_by=auth.uid() then
 update public.booking_requests set status='withdrawn',reviewed_at=now() where id=p_id;
 else
 if not public.is_studio_admin() then raise exception 'An admin must approve or decline this request' using errcode='42501';end if;
 if p_decision not in ('approved','declined') or length(trim(p_response))<5 then raise exception 'Choose a decision and provide a response';end if;
 if p_decision='approved' then
 if r.kind='reschedule' then
 if b.status not in ('pending','confirmed') then raise exception 'Closed reservations cannot be rescheduled';end if;
 perform studio_private.assert_schedule(r.requested_date,r.start_time,r.end_time,b.id);
 hours=extract(epoch from(r.end_time-r.start_time))/3600;
 if hours<>b.duration and not p_accept_price then raise exception 'Review and acknowledge the revised session price';end if;
 if hours*b.price+b.transportation_fee<b.paid_amount-b.refunded_amount then raise exception 'Resolve the overpayment before approving a shorter session';end if;
 select * into s from public.studio_settings where id;
 update public.bookings set booking_date=r.requested_date,start_time=r.start_time,end_time=r.end_time,duration=hours,total_price=hours*price+transportation_fee,buffer_before=s.buffer_before,buffer_after=s.buffer_after,
 delivery_due=case when delivery_due is null then null else r.requested_date+s.delivery_days end where id=b.id;
 elsif r.kind='cancellation' then update public.bookings set status='cancelled' where id=b.id;
 elsif r.kind='refund' then
 if r.amount>b.paid_amount-greatest(b.refunded_amount,coalesce((select sum(amount) from public.booking_requests where booking_id=b.id and kind='refund' and status='approved'),0)) then raise exception 'This refund would exceed received funds after existing approvals';end if;
 elsif r.kind='revision' then update public.bookings set gallery_status='revision_requested' where id=b.id;
 end if;end if;
 update public.booking_requests set status=p_decision,response=left(p_response,2000),reviewed_by=auth.uid(),reviewed_at=now() where id=p_id;
 end if;
 perform studio_private.refresh_payments(b.id);select * into b from public.bookings where id=b.id;return b;
end $$;

create function public.studio_add_note(p_booking uuid,p_body text,p_internal boolean default false) returns public.booking_notes language plpgsql security definer set search_path='' as $$
declare b public.bookings;n public.booking_notes;begin
 b=studio_private.assert_booking_access(p_booking);
 if p_internal and not public.is_studio_team() then raise exception 'Internal notes are team-only' using errcode='42501';end if;
 if length(trim(p_body))<1 or length(p_body)>5000 then raise exception 'Write a message of up to 5000 characters';end if;
 if (select count(*) from public.booking_notes where author_id=auth.uid() and created_at>now()-interval '1 minute')>=8 then raise exception 'Please wait before sending another message';end if;
 insert into public.booking_notes(booking_id,internal,body,author_id,author_name,author_role) select p_booking,p_internal,trim(p_body),id,full_name,role from public.users where id=auth.uid() returning * into n;return n;
end $$;
create function public.studio_save_preparation(p_booking uuid,p_version bigint,p_details jsonb) returns public.bookings language plpgsql security definer set search_path='' as $$
declare b public.bookings;begin
 b=studio_private.assert_booking_access(p_booking);
 if b.version<>p_version then raise exception 'This booking changed. Reload before saving the brief' using errcode='40001';end if;
 if jsonb_typeof(p_details)<>'object' or p_details-array['style','programme','key_people','must_have','restrictions','venue_contact']<>'{}'::jsonb or length(p_details::text)>12000 then raise exception 'Keep the brief within the provided fields and length';end if;
 update public.bookings set preparation=p_details where id=p_booking returning * into b;return b;
end $$;
create function public.studio_add_file(p_booking uuid,p_path text,p_name text,p_kind text) returns public.booking_files language plpgsql security definer set search_path='' as $$
declare b public.bookings;f public.booking_files;begin
 b=studio_private.assert_booking_access(p_booking);
 if split_part(p_path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='studio-files' and name=p_path) then raise exception 'Upload the file first';end if;
 if (select count(*) from public.booking_files where booking_id=p_booking)>=20 then raise exception 'A booking can have up to 20 reference files';end if;
 insert into public.booking_files(booking_id,path,name,kind,uploaded_by) values(p_booking,p_path,left(p_name,180),p_kind,auth.uid()) returning * into f;return f;
end $$;

create function public.studio_team_directory() returns table(id uuid,full_name text,role text) language sql stable security definer set search_path='' as $$
 select u.id,u.full_name,u.role from public.users u where public.is_studio_team() and u.status='active' and u.role in ('staff','admin','superadmin','super_admin') order by u.full_name;
$$;
create function public.studio_mark_read(p_id bigint default null) returns void language sql security definer set search_path='' as $$update public.studio_notifications set read_at=now() where user_id=auth.uid() and read_at is null and(p_id is null or id=p_id);$$;
create function public.studio_set_permission(p_user uuid,p_verify boolean) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_studio_superadmin() then raise exception 'Superadmin access required' using errcode='42501';end if;
 insert into public.studio_permissions values(p_user,p_verify) on conflict(user_id) do update set can_verify_payments=excluded.can_verify_payments;
 insert into public.studio_activity(actor_id,actor_role,resource,record_id,action) values(auth.uid(),'superadmin','permissions',p_user::text,'update');
end $$;
create function public.studio_schedule_settings(p_data jsonb) returns public.studio_settings language plpgsql security definer set search_path='' as $$declare s public.studio_settings;begin
 if not public.is_studio_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(1730123);
 update public.studio_settings set opens_at=(p_data->>'opens_at')::time,closes_at=(p_data->>'closes_at')::time,buffer_before=(p_data->>'buffer_before')::integer,buffer_after=(p_data->>'buffer_after')::integer,max_hours=(p_data->>'max_hours')::integer,lead_days=(p_data->>'lead_days')::integer,delivery_days=(p_data->>'delivery_days')::integer,review_hours=(p_data->>'review_hours')::integer,updated_at=now() where id returning * into s;
 return s;end $$;
create function public.studio_time_block(p_date date,p_start time,p_end time,p_reason text,p_remove uuid default null) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_studio_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(1730123);
 if p_remove is not null then delete from public.studio_time_blocks where id=p_remove;return;end if;
 if p_end<=p_start or p_date<(now() at time zone 'Asia/Manila')::date then raise exception 'Choose a future time range';end if;
 if exists(select 1 from public.bookings where status in ('pending','confirmed') and archived_at is null and reserved_window&&tsrange(p_date+p_start,p_date+p_end,'[)')) then raise exception 'This block overlaps an existing reservation. Resolve that reservation first';end if;
 insert into public.studio_time_blocks(block_date,start_time,end_time,reason,created_by) values(p_date,p_start,p_end,left(p_reason,500),auth.uid());end $$;
-- Existing full-day block controls also participate in the same scheduling lock.
create function studio_private.guard_full_day_block() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(1730123);
 if exists(select 1 from public.bookings where booking_date=new.blocked_date and status in ('pending','confirmed') and archived_at is null) then raise exception 'This date has an active reservation. Resolve it before blocking the date';end if;return new;end $$;
create trigger studio_block_conflict before insert or update on public.blocked_dates for each row execute function studio_private.guard_full_day_block();

create or replace function public.get_booked_slots(start_date date,end_date date) returns table(booking_date date,start_time time,end_time time,status text) language sql stable security definer set search_path='' as $$
 select b.booking_date,greatest(time '00:00',b.start_time-(b.buffer_before+(select buffer_after from public.studio_settings where id))*interval '1 minute')::time,least(time '23:59:59',b.end_time+(b.buffer_after+(select buffer_before from public.studio_settings where id))*interval '1 minute')::time,b.status
 from public.bookings b where b.status in ('pending','confirmed') and b.archived_at is null and b.booking_date between start_date and least(end_date,start_date+190)
 union all select t.block_date,(t.start_time-(select buffer_after from public.studio_settings where id)*interval '1 minute')::time,(t.end_time+(select buffer_before from public.studio_settings where id)*interval '1 minute')::time,'blocked' from public.studio_time_blocks t where t.block_date between start_date and least(end_date,start_date+190);
$$;
create function public.studio_public_schedule() returns jsonb language sql stable security definer set search_path='' as $$select to_jsonb(s)-'updated_at'-'review_hours' from public.studio_settings s where id;$$;
grant execute on function public.studio_public_schedule() to anon,authenticated;

-- All privileged helpers in this schema are callable only by their owner.
revoke all on all functions in schema studio_private from public,anon,authenticated;
do $$ declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('studio_update_booking','studio_archive_booking','studio_payment_action','studio_request_change','studio_resolve_request','studio_add_note','studio_save_preparation','studio_add_file','studio_team_directory','studio_mark_read','studio_set_permission','studio_schedule_settings','studio_time_block') loop
 execute format('revoke all on function %s from public,anon',f.signature);execute format('grant execute on function %s to authenticated',f.signature);end loop;end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('studio-files','studio-files',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do nothing;
create policy "Booking file uploads" on storage.objects for insert to authenticated with check(bucket_id='studio-files' and (storage.foldername(name))[1]=auth.uid()::text and public.is_active_studio_user());
create policy "Scoped booking files" on storage.objects for select to authenticated using(bucket_id='studio-files' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.booking_files f where f.path=objects.name and public.studio_can_access_booking(f.booking_id))));
drop policy if exists "Owners and team read receipts" on storage.objects;
create policy "Owners and permitted team read receipts" on storage.objects for select to authenticated using(bucket_id='payment-receipts' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.booking_payments p where p.proof_path=name and public.is_studio_team() and public.studio_can_access_booking(p.booking_id))));
commit;
