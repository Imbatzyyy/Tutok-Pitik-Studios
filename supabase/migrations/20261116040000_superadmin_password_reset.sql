begin;
create table studio_private.password_reset_requests(id uuid primary key default gen_random_uuid(),actor_id uuid references public.users(id) on delete set null,target_id uuid references public.users(id) on delete cascade,created_at timestamptz not null default now(),state text not null default 'preparing' check(state in ('preparing','sent','failed')));
revoke all on studio_private.password_reset_requests from public,anon,authenticated;
create index password_reset_recent on studio_private.password_reset_requests(created_at);
create function public.studio_begin_password_reset(p_actor uuid,p_target uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare request_id uuid;begin
 if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(1730125);
 if not exists(select 1 from public.users where id=p_actor and role in ('superadmin','super_admin') and status='active') then raise exception 'Superadmin access required' using errcode='42501';end if;
 if not exists(select 1 from public.users where id=p_target and role in ('superadmin','super_admin','admin','staff') and status='active') then raise exception 'Choose an active team account' using errcode='22023';end if;
 if exists(select 1 from studio_private.password_reset_requests where target_id=p_target and created_at>now()-interval '1 minute') or (select count(*) from studio_private.password_reset_requests where target_id=p_target and created_at>now()-interval '1 hour')>=5 or (select count(*) from studio_private.password_reset_requests where actor_id=p_actor and created_at>now()-interval '1 hour')>=20 then raise exception 'Please wait before sending another reset email' using errcode='P0001';end if;
 delete from studio_private.password_reset_requests where created_at<now()-interval '30 days';
 insert into studio_private.password_reset_requests(actor_id,target_id) values(p_actor,p_target) returning id into request_id;return request_id;
end $$;
create function public.studio_finish_password_reset(p_request uuid,p_sent boolean) returns void language plpgsql security definer set search_path='' as $$
declare r studio_private.password_reset_requests;begin
 if auth.role()<>'service_role' then raise exception 'Service access required' using errcode='42501';end if;
 update studio_private.password_reset_requests set state=case when p_sent then 'sent' else 'failed' end where id=p_request and state='preparing' returning * into r;if not found then return;end if;
 insert into public.studio_activity(actor_id,actor_role,actor_name,resource,record_id,action,changed_fields)
 select u.id,u.role,u.full_name,'users',r.target_id::text,case when p_sent then 'password_reset_sent' else 'password_reset_failed' end,array['password_reset'] from public.users u where u.id=r.actor_id;
end $$;
revoke all on function public.studio_begin_password_reset(uuid,uuid),public.studio_finish_password_reset(uuid,boolean) from public,anon,authenticated;
grant execute on function public.studio_begin_password_reset(uuid,uuid),public.studio_finish_password_reset(uuid,boolean) to service_role;
-- A completed password change immediately invalidates every old studio binding.
create function studio_private.revoke_password_sessions() returns trigger language plpgsql security definer set search_path='' as $$begin
 delete from studio_private.admin_sessions where user_id=new.id;return new;
end $$;
revoke all on function studio_private.revoke_password_sessions() from public,anon,authenticated;
create trigger studio_password_changed after update of encrypted_password on auth.users for each row when(old.encrypted_password is distinct from new.encrypted_password) execute function studio_private.revoke_password_sessions();
notify pgrst,'reload schema';
commit;
