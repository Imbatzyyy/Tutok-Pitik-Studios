begin;

-- Profile pictures are personal account data, unlike the public studio portfolio.
update storage.buckets set public = false where id = 'profile-pictures';
drop policy if exists "Studio team reads profile pictures" on storage.objects;
create policy "Studio team reads profile pictures" on storage.objects for select to authenticated
  using (bucket_id = 'profile-pictures' and public.is_studio_team());

-- A suspended account must not regain data access through a new login method.
create or replace function public.is_active_studio_user()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.users where id = auth.uid() and status = 'active'); $$;
revoke all on function public.is_active_studio_user() from public;
grant execute on function public.is_active_studio_user() to authenticated;

create policy "Active accounts access bookings" on public.bookings as restrictive
  for all to authenticated using (public.is_active_studio_user()) with check (public.is_active_studio_user());
create policy "Active accounts access favorites" on public.favorites as restrictive
  for all to authenticated using (public.is_active_studio_user()) with check (public.is_active_studio_user());
create policy "Active accounts update profiles" on public.users as restrictive
  for update to authenticated using (public.is_active_studio_user()) with check (public.is_active_studio_user());
create policy "Active accounts access private uploads" on storage.objects as restrictive
  for all to authenticated
  using (bucket_id not in ('payment-receipts','profile-pictures') or public.is_active_studio_user())
  with check (bucket_id not in ('payment-receipts','profile-pictures') or public.is_active_studio_user());

commit;
