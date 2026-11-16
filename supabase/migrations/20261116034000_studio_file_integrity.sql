begin;
-- Qualify the outer storage object name; file display names are not storage paths.
drop policy "Scoped booking files" on storage.objects;
create policy "Scoped booking files" on storage.objects for select to authenticated using(bucket_id='studio-files' and public.is_active_studio_user() and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.booking_files f where f.path=objects.name and public.studio_can_access_booking(f.booking_id))));
-- Receipt replacements get a new object and ledger entry. Existing proof is immutable.
drop policy if exists "Customers replace their own receipts" on storage.objects;
drop policy "Own notifications" on public.studio_notifications;
create policy "Own notifications" on public.studio_notifications for select to authenticated using(user_id=auth.uid() and public.is_active_studio_user() and (public.is_studio_team() or exists(select 1 from public.users u where u.id=auth.uid() and u.role='customer')));
notify pgrst,'reload schema';
commit;
