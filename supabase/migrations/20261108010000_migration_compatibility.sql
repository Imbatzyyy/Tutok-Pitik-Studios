-- Tutok Pitik Studios: restored-source compatibility (applied 2026-11-08).
-- Run AFTER 20261108000000_site_enhancements.sql, including its correction to
-- preserve the source users_status_check value 'suspended'. This file does not
-- apply that prerequisite. Both files must succeed before enabling app traffic.
-- No existing records, IDs, column types, or foreign keys are rewritten here.
-- Source bookings date/time/text types already match the availability RPCs.
-- portfolio_images.created_by retains its source FK to public.users(id).

begin;

-- Fail before removing source policies if the replacement policies are absent.
do $$
begin
  if to_regclass('public.testimonials') is null
     or to_regclass('public.blocked_dates') is null
     or to_regprocedure('public.get_booked_slots(date,date)') is null
     or to_regprocedure('public.get_blocked_dates(date,date)') is null
     or to_regprocedure('public.is_studio_team(uuid)') is null
     or to_regprocedure('public.is_studio_admin(uuid)') is null
     or to_regprocedure('public.is_studio_superadmin(uuid)') is null
     or exists (
       select 1
       from (values
         ('users', 'Users read own profile, team reads all', 'SELECT'),
         ('users', 'Users can update their own profile', 'UPDATE'),
         ('bookings', 'Users can create bookings', 'INSERT'),
         ('bookings', 'Admins can view all bookings', 'SELECT'),
         ('bookings', 'Admins can update bookings', 'UPDATE'),
         ('bookings', 'Admins can delete bookings', 'DELETE'),
         ('portfolio_images', 'Admins can insert portfolio images', 'INSERT'),
         ('portfolio_images', 'Admins can update portfolio images', 'UPDATE'),
         ('portfolio_images', 'Admins can delete portfolio images', 'DELETE')
       ) as expected(table_name, policy_name, command)
       where not exists (
         select 1 from pg_catalog.pg_policies p
         where p.schemaname = 'public'
           and p.tablename = expected.table_name
           and p.policyname = expected.policy_name
           and p.cmd = expected.command
       )
     ) then
    raise exception 'Apply 20261108000000_site_enhancements.sql before migration_compatibility';
  end if;
end;
$$;

-- The source uses different names. Permissive policies combine with OR, so
-- retaining them bypasses the enhanced pending-only insert and team checks.
drop policy if exists users_select_own on public.users;
drop policy if exists users_update_own on public.users;

drop policy if exists bookings_insert_own on public.bookings;
drop policy if exists bookings_update_admin on public.bookings;
drop policy if exists bookings_delete_admin on public.bookings;
drop policy if exists bookings_select_own on public.bookings;

-- The source SELECT policy also supplied customer access. Preserve that part;
-- the enhancement's separate team SELECT policy supplies team access.
drop policy if exists "Users can view their own bookings" on public.bookings;
create policy "Users can view their own bookings"
  on public.bookings for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists portfolio_insert_admin on public.portfolio_images;
drop policy if exists portfolio_update_admin on public.portfolio_images;
drop policy if exists portfolio_delete_admin on public.portfolio_images;
-- Keep portfolio_select_public, contact policies, and favorites SELECT/INSERT/
-- DELETE policies. They are not replaced by the enhancement migration.

-- useFavorites.ts upserts on (user_id, image_id); the conflict path needs UPDATE.
drop policy if exists favorites_update_own on public.favorites;
create policy favorites_update_own
  on public.favorites for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The deployed edge function's kv_store.tsx uses this exact table and types.
-- It uses service_role; browser roles must have no direct table access.
create table if not exists public.kv_store_032fda65 (
  key text not null primary key,
  value jsonb not null
);
alter table public.kv_store_032fda65 enable row level security;
revoke all on table public.kv_store_032fda65 from public, anon, authenticated;
grant select, insert, update, delete on table public.kv_store_032fda65 to service_role;
drop policy if exists "Service role manages KV" on public.kv_store_032fda65;
create policy "Service role manages KV"
  on public.kv_store_032fda65 for all to service_role
  using (true) with check (true);

-- The source has no storage policies. The enhancement supplies receipt access
-- and portfolio writes, but upload(..., { upsert: true }) also needs SELECT.
-- Do not make any bucket public here; respect its existing public flag.
drop policy if exists "Public reads studio public images" on storage.objects;
create policy "Public reads studio public images"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id in ('portfolio', 'profile-pictures')
    and exists (
      select 1 from storage.buckets b
      where b.id = bucket_id and b.public = true
    )
  );

-- UserProfile.tsx uploads to {auth user id}/avatar-{timestamp}.jpg.
-- Storage's upsert checks object SELECT before writing. Its authenticated role
-- cannot always read storage.buckets, so give studio admins explicit object
-- access instead of relying on the public-bucket lookup above.
drop policy if exists "Admins read portfolio files" on storage.objects;
create policy "Admins read portfolio files"
  on storage.objects for select to authenticated
  using (bucket_id = 'portfolio' and public.is_studio_admin());

-- Owner SELECT also permits upsert when the avatar bucket is private.
drop policy if exists "Owners read their profile pictures" on storage.objects;
create policy "Owners read their profile pictures"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owners upload their profile pictures" on storage.objects;
create policy "Owners upload their profile pictures"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owners update their profile pictures" on storage.objects;
create policy "Owners update their profile pictures"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
