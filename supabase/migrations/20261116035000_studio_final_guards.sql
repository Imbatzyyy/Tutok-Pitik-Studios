begin;
-- Match the private receipt uploader's documented image/PDF size limit.
update storage.buckets set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'] where id='payment-receipts';
-- Clamp in timestamp space before casting: time arithmetic would wrap at midnight.
create or replace function public.get_booked_slots(start_date date,end_date date) returns table(booking_date date,start_time time,end_time time,status text) language sql stable security definer set search_path='' as $$
 select b.booking_date,greatest(b.booking_date::timestamp,b.booking_date+b.start_time-(b.buffer_before+s.buffer_after)*interval '1 minute')::time,least(b.booking_date+time '23:59:59',b.booking_date+b.end_time+(b.buffer_after+s.buffer_before)*interval '1 minute')::time,b.status
 from public.bookings b cross join public.studio_settings s where s.id and b.status in ('pending','confirmed') and b.archived_at is null and b.booking_date between start_date and least(end_date,start_date+190)
 union all select t.block_date,greatest(t.block_date::timestamp,t.block_date+t.start_time-s.buffer_after*interval '1 minute')::time,least(t.block_date+time '23:59:59',t.block_date+t.end_time+s.buffer_before*interval '1 minute')::time,'blocked' from public.studio_time_blocks t cross join public.studio_settings s where s.id and t.block_date between start_date and least(end_date,start_date+190);
$$;
-- The authenticated Edge handler supplies the owner; keep role changes and their
-- actor attribution atomic instead of recording the shared service identity.
create function public.studio_service_account_update(p_actor uuid,p_target uuid,p_changes jsonb) returns public.users language plpgsql security definer set search_path='' as $$
declare result public.users;old_claims text;begin
 if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(1730124);
 if not exists(select 1 from public.users where id=p_actor and role in ('superadmin','super_admin') and coalesce(status,'active')='active') then raise exception 'Active superadmin required' using errcode='42501';end if;
 if p_changes-array['full_name','username','role','status','phone','updated_at']<>'{}'::jsonb or jsonb_typeof(p_changes)<>'object' then raise exception 'Unsupported account fields';end if;
 if p_changes?'role' and p_changes->>'role' not in ('customer','staff','admin','superadmin') then raise exception 'Invalid role';end if;
 if p_changes?'status' and p_changes->>'status' not in ('active','inactive','suspended') then raise exception 'Invalid status';end if;
 if p_actor=p_target and ((p_changes?'role' and p_changes->>'role'<>'superadmin') or (p_changes?'status' and p_changes->>'status'<>'active')) then raise exception 'You cannot remove your own superadmin access';end if;
 old_claims=current_setting('request.jwt.claims',true);
 perform set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub',p_actor)::text,true);
 update public.users set full_name=case when p_changes?'full_name' then left(p_changes->>'full_name',200) else full_name end,username=case when p_changes?'username' then left(p_changes->>'username',80) else username end,role=case when p_changes?'role' then p_changes->>'role' else role end,status=case when p_changes?'status' then p_changes->>'status' else status end,phone=case when p_changes?'phone' then left(p_changes->>'phone',40) else phone end,updated_at=now() where id=p_target returning * into result;
 if not found then raise exception 'Account not found';end if;
 perform set_config('request.jwt.claims',coalesce(old_claims,''),true);
 return result;
end $$;
revoke all on function public.studio_service_account_update(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.studio_service_account_update(uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
