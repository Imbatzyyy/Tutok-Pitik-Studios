-- ============================================================================
-- Tutok Pitik Studios: site enhancements + security fixes (2026-11-08)
--
-- Applied to the restored destination project on 2026-11-08. This migration
-- assumes the original application schema already exists; it is not a blank
-- database bootstrap. Apply the compatibility migration immediately afterward.
--
-- What it does
--   1. Team-role helper functions (avoid recursive RLS on public.users)
--   2. Adds columns the app already uses (users.status, portfolio extras)
--   3. SECURITY: new sign-ups are always 'customer' (metadata can't grant admin)
--   4. SECURITY: users can't change their own role or status
--   5. SECURITY: team profiles are no longer readable by everyone
--   6. Bookings: staff can update, customers can only create 'pending' bookings
--   7. Portfolio: admins can update rows (reorder, feature, edit)
--   8. New tables: testimonials, blocked_dates
--   9. Public RPCs: get_booked_slots, get_blocked_dates (dates/times only)
--  10. Storage: private payment-receipts bucket + policies
-- ============================================================================

begin;

-- 1. Helpers ------------------------------------------------------------------
alter table public.users add column if not exists status text not null default 'active';

create or replace function public.is_studio_team(uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = uid
      and u.role in ('superadmin', 'super_admin', 'admin', 'staff')
      and coalesce(u.status, 'active') = 'active'
  );
$$;

create or replace function public.is_studio_admin(uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = uid
      and u.role in ('superadmin', 'super_admin', 'admin')
      and coalesce(u.status, 'active') = 'active'
  );
$$;

create or replace function public.is_studio_superadmin(uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = uid
      and u.role in ('superadmin', 'super_admin')
      and coalesce(u.status, 'active') = 'active'
  );
$$;

grant execute on function public.is_studio_team(uuid), public.is_studio_admin(uuid), public.is_studio_superadmin(uuid) to authenticated;

-- 2. Columns the app uses -------------------------------------------------------
-- Allow both spellings of the super admin role the app has used over time.
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
  check (role in ('superadmin', 'super_admin', 'admin', 'staff', 'customer', 'guest'));
alter table public.users drop constraint if exists users_status_check;
-- Preserve the restored source's allowed statuses, including suspended accounts.
alter table public.users add constraint users_status_check check (status in ('active', 'inactive', 'suspended'));

alter table public.portfolio_images add column if not exists description text default '';
alter table public.portfolio_images add column if not exists display_order integer not null default 0;
alter table public.portfolio_images add column if not exists is_featured boolean not null default false;
alter table public.portfolio_images add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.portfolio_images alter column subcategory set default '';

create index if not exists bookings_date_status_idx on public.bookings (booking_date, status);
create index if not exists portfolio_images_order_idx on public.portfolio_images (display_order);

-- 3. SECURITY: sign-ups are always customers ------------------------------------
-- The old trigger copied `role` from user metadata, which anyone can set when
-- signing up, so anyone could create an admin account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'User'),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 4. SECURITY: role/status changes need a super admin (or the service role) ------
create or replace function public.protect_user_role()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and auth.uid() is not null
     and coalesce(auth.jwt()->>'role', '') <> 'service_role'
     and not public.is_studio_superadmin(auth.uid()) then
    raise exception 'Only a super admin can change roles or account status';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_user_role on public.users;
create trigger protect_user_role
  before update on public.users
  for each row execute function public.protect_user_role();

-- 5. SECURITY: users table policies -------------------------------------------
-- The old SELECT policy checked the *row's* role, so every team member's
-- profile (email, phone) was readable by anyone, signed in or not.
drop policy if exists "Users can view their own profile" on public.users;
drop policy if exists "Admins can view all users" on public.users;
drop policy if exists "Users read own profile, team reads all" on public.users;
create policy "Users read own profile, team reads all"
  on public.users for select
  using (auth.uid() = id or public.is_studio_team());

drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 6. Bookings -----------------------------------------------------------------
drop policy if exists "Users can create bookings" on public.bookings;
create policy "Users can create bookings"
  on public.bookings for insert
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Admins can view all bookings" on public.bookings;
create policy "Admins can view all bookings"
  on public.bookings for select
  using (public.is_studio_team());

drop policy if exists "Admins can update bookings" on public.bookings;
create policy "Admins can update bookings"
  on public.bookings for update
  using (public.is_studio_team())
  with check (public.is_studio_team());

drop policy if exists "Admins can delete bookings" on public.bookings;
create policy "Admins can delete bookings"
  on public.bookings for delete
  using (public.is_studio_admin());

-- 7. Portfolio ----------------------------------------------------------------
drop policy if exists "Admins can insert portfolio images" on public.portfolio_images;
create policy "Admins can insert portfolio images"
  on public.portfolio_images for insert
  with check (public.is_studio_admin());

drop policy if exists "Admins can update portfolio images" on public.portfolio_images;
create policy "Admins can update portfolio images"
  on public.portfolio_images for update
  using (public.is_studio_admin())
  with check (public.is_studio_admin());

drop policy if exists "Admins can delete portfolio images" on public.portfolio_images;
create policy "Admins can delete portfolio images"
  on public.portfolio_images for delete
  using (public.is_studio_admin());

-- 8a. Testimonials --------------------------------------------------------------
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  client_name text not null check (char_length(client_name) between 1 and 80),
  client_context text,
  quote text not null check (char_length(quote) between 1 and 600),
  rating smallint not null default 5 check (rating between 1 and 5),
  photo_url text,
  is_published boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.testimonials enable row level security;

drop policy if exists "Published testimonials are public" on public.testimonials;
create policy "Published testimonials are public"
  on public.testimonials for select
  using (is_published or public.is_studio_admin());

drop policy if exists "Admins manage testimonials" on public.testimonials;
create policy "Admins manage testimonials"
  on public.testimonials for all
  using (public.is_studio_admin())
  with check (public.is_studio_admin());

-- 8b. Blocked dates (reason is team-only; the public reads dates via RPC) ---------
create table if not exists public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  blocked_date date not null unique,
  reason text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.blocked_dates enable row level security;

drop policy if exists "Admins manage blocked dates" on public.blocked_dates;
create policy "Admins manage blocked dates"
  on public.blocked_dates for all
  using (public.is_studio_admin())
  with check (public.is_studio_admin());

drop policy if exists "Team can view blocked dates" on public.blocked_dates;
create policy "Team can view blocked dates"
  on public.blocked_dates for select
  using (public.is_studio_team());

-- 9. Public availability RPCs (no names, emails or notes) ------------------------
create or replace function public.get_booked_slots(start_date date, end_date date)
returns table (booking_date date, start_time time, end_time time, status text)
language sql stable security definer set search_path = public
as $$
  select b.booking_date::date, b.start_time::time, b.end_time::time, b.status::text
  from public.bookings b
  where b.status in ('pending', 'confirmed')
    and b.booking_date::date between start_date and end_date
    and end_date - start_date <= 400;
$$;

create or replace function public.get_blocked_dates(start_date date, end_date date)
returns table (blocked_date date)
language sql stable security definer set search_path = public
as $$
  select d.blocked_date
  from public.blocked_dates d
  where d.blocked_date between start_date and end_date
    and end_date - start_date <= 400;
$$;

grant execute on function public.get_booked_slots(date, date) to anon, authenticated;
grant execute on function public.get_blocked_dates(date, date) to anon, authenticated;

-- 10. Storage ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('profile-pictures', 'profile-pictures', true)
on conflict (id) do nothing;

-- Receipts live at payment-receipts/{user id}/{file}.jpg
drop policy if exists "Customers upload their own receipts" on storage.objects;
create policy "Customers upload their own receipts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Customers replace their own receipts" on storage.objects;
create policy "Customers replace their own receipts"
  on storage.objects for update to authenticated
  using (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Owners and team read receipts" on storage.objects;
create policy "Owners and team read receipts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-receipts'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_studio_team())
  );

-- Portfolio uploads use upsert, which also needs UPDATE.
drop policy if exists "Admins can upload portfolio images" on storage.objects;
create policy "Admins can upload portfolio images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio' and public.is_studio_admin());

drop policy if exists "Admins can update portfolio files" on storage.objects;
create policy "Admins can update portfolio files"
  on storage.objects for update to authenticated
  using (bucket_id = 'portfolio' and public.is_studio_admin());

drop policy if exists "Admins can delete portfolio images" on storage.objects;
create policy "Admins can delete portfolio images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio' and public.is_studio_admin());

commit;
