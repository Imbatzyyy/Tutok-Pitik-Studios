begin;
create schema if not exists studio_private;
revoke all on schema studio_private from public,anon,authenticated;
create table studio_private.admin_sessions (
 session_id uuid primary key references auth.sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '8 hours'
);
create table studio_private.login_limits (
 key_hash text primary key, window_start timestamptz not null, attempts integer not null
);
revoke all on all tables in schema studio_private from public,anon,authenticated;

create function public.studio_login_limit(p_key text,p_max integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if p_key !~ '^[a-f0-9]{64}$' or p_max not between 1 and 60 then return false; end if;
 delete from studio_private.login_limits where window_start<now()-interval '1 day';
 insert into studio_private.login_limits values(p_key,now(),1)
 on conflict(key_hash) do update set
 attempts=case when studio_private.login_limits.window_start<now()-interval '15 minutes' then 1 else studio_private.login_limits.attempts+1 end,
 window_start=case when studio_private.login_limits.window_start<now()-interval '15 minutes' then now() else studio_private.login_limits.window_start end
 returning attempts into n;
 return n<=p_max;
end $$;
create function public.studio_register_admin_session(p_user_id uuid,p_session_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.users where id=p_user_id and status='active' and role in ('superadmin','super_admin','admin','staff'))
 or not exists(select 1 from auth.sessions where id=p_session_id and user_id=p_user_id) then return false; end if;
 delete from studio_private.admin_sessions where expires_at<=now();
 insert into studio_private.admin_sessions(session_id,user_id) values(p_session_id,p_user_id) on conflict do nothing;
 return true;
end $$;
create function public.studio_admin_session_valid(p_user_id uuid,p_session_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from studio_private.admin_sessions a join auth.sessions s on s.id=a.session_id
 join public.users u on u.id=a.user_id where a.user_id=p_user_id and a.session_id=p_session_id
 and s.user_id=p_user_id and (s.not_after is null or s.not_after>now()) and a.expires_at>now() and u.status='active' and u.role in ('superadmin','super_admin','admin','staff'));
$$;
revoke all on function public.studio_login_limit(text,integer),public.studio_register_admin_session(uuid,uuid),public.studio_admin_session_valid(uuid,uuid) from public,anon,authenticated;
grant execute on function public.studio_login_limit(text,integer),public.studio_register_admin_session(uuid,uuid),public.studio_admin_session_valid(uuid,uuid) to service_role;

create or replace function public.is_studio_team(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path='' as $$
 select uid=auth.uid() and public.studio_admin_session_valid(uid,nullif(auth.jwt()->>'session_id','')::uuid);
$$;
create or replace function public.is_studio_admin(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_studio_team(uid) and exists(select 1 from public.users where id=uid and role in ('superadmin','super_admin','admin'));
$$;
create or replace function public.is_studio_superadmin(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_studio_team(uid) and exists(select 1 from public.users where id=uid and role in ('superadmin','super_admin'));
$$;
-- Replace the legacy contact-message helper too: no role-only alternative route.
drop policy if exists contact_select_admin on public.contact_messages;
create policy contact_select_admin on public.contact_messages for select to authenticated using(public.is_studio_admin());
drop policy if exists "Users read own profile, team reads all" on public.users;
create policy "Users read own profile, superadmins read accounts" on public.users for select to authenticated
using(auth.uid()=id or public.is_studio_superadmin());

create function public.studio_end_admin_session() returns void
language sql security definer set search_path='' as $$
 delete from studio_private.admin_sessions where user_id=auth.uid() and session_id=nullif(auth.jwt()->>'session_id','')::uuid;
$$;
revoke all on function public.studio_end_admin_session() from public,anon;
grant execute on function public.studio_end_admin_session() to authenticated;

-- Role and status changes revoke the existing portal session permanently.
create function studio_private.revoke_changed_team_session() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.role is distinct from old.role or new.status is distinct from old.status then
  if old.id=auth.uid() and coalesce(auth.jwt()->>'role','')<>'service_role'
    and old.role in ('superadmin','super_admin') and (new.role not in ('superadmin','super_admin') or new.status<>'active') then
    raise exception 'You cannot remove your own superadmin access';
  end if;
  delete from studio_private.admin_sessions where user_id=new.id;
 end if;
 return new;
end $$;
create trigger studio_revoke_changed_session before update of role,status on public.users
for each row execute function studio_private.revoke_changed_team_session();

create table public.studio_activity (
 id bigint generated always as identity primary key,
 occurred_at timestamptz not null default now(),
 actor_id uuid references auth.users(id) on delete set null,
 actor_role text not null,
 resource text not null,
 record_id text not null,
 action text not null,
 status_before text,
 status_after text
);
alter table public.studio_activity enable row level security;
revoke all on public.studio_activity from anon,authenticated;
grant select on public.studio_activity to authenticated;
create policy "Team reads relevant studio activity" on public.studio_activity for select to authenticated
 using(public.is_studio_team() and (resource='bookings' or public.is_studio_admin()));
create index studio_activity_recent on public.studio_activity(occurred_at desc);
create function studio_private.record_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare oldrow jsonb; newrow jsonb; who text;
begin
 if tg_op<>'INSERT' then oldrow=to_jsonb(old); end if;
 if tg_op<>'DELETE' then newrow=to_jsonb(new); end if;
 select role into who from public.users where id=auth.uid();
 insert into public.studio_activity(actor_id,actor_role,resource,record_id,action,status_before,status_after)
 values(auth.uid(),coalesce(who,'system'),tg_table_name,coalesce(newrow->>'id',oldrow->>'id'),lower(tg_op),oldrow->>'status',newrow->>'status');
 return coalesce(new,old);
end $$;
create trigger studio_audit_bookings after insert or update or delete on public.bookings for each row execute function studio_private.record_activity();
create trigger studio_audit_users after insert or update or delete on public.users for each row execute function studio_private.record_activity();
create trigger studio_audit_portfolio after insert or update or delete on public.portfolio_images for each row execute function studio_private.record_activity();
create trigger studio_audit_reviews after insert or update or delete on public.testimonials for each row execute function studio_private.record_activity();
create trigger studio_audit_availability after insert or update or delete on public.blocked_dates for each row execute function studio_private.record_activity();
commit;
