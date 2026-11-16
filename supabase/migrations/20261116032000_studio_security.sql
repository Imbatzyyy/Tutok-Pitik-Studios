begin;
-- An AAL1 portal binding permits enrollment only, never studio data access.
create function public.studio_mfa_entry() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from studio_private.admin_sessions a join auth.sessions s on s.id=a.session_id join public.users u on u.id=a.user_id
 where a.user_id=auth.uid() and a.session_id=nullif(auth.jwt()->>'session_id','')::uuid and a.expires_at>now() and(s.not_after is null or s.not_after>now()) and u.status='active' and u.role in ('superadmin','super_admin','admin','staff'));
$$;
create or replace function public.studio_admin_session_valid(p_user_id uuid,p_session_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from studio_private.admin_sessions a join auth.sessions s on s.id=a.session_id join public.users u on u.id=a.user_id
 where a.user_id=p_user_id and a.session_id=p_session_id and s.user_id=p_user_id and s.aal='aal2' and s.factor_id is not null
 and exists(select 1 from auth.mfa_factors f where f.id=s.factor_id and f.user_id=p_user_id and f.status='verified')
 and(s.not_after is null or s.not_after>now()) and a.expires_at>now() and u.status='active' and u.role in ('superadmin','super_admin','admin','staff'));
$$;
create or replace function public.is_studio_team(uid uuid default auth.uid()) returns boolean language sql stable security definer set search_path='' as $$
 select uid=auth.uid() and auth.jwt()->>'aal'='aal2' and public.studio_admin_session_valid(uid,nullif(auth.jwt()->>'session_id','')::uuid);
$$;
create table studio_private.recovery_codes(user_id uuid references auth.users on delete cascade,code_hash text not null,created_at timestamptz not null default now(),used_at timestamptz,primary key(user_id,code_hash));
revoke all on studio_private.recovery_codes from public,anon,authenticated;
create function public.studio_recovery_codes(p_hashes text[]) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_studio_team() then raise exception 'Verified studio sign-in required' using errcode='42501';end if;
 if cardinality(p_hashes)<>8 or exists(select 1 from unnest(p_hashes)h where h !~ '^[0-9a-f]{64}$') then raise exception 'Invalid recovery codes';end if;
 delete from studio_private.recovery_codes where user_id=auth.uid();
 insert into studio_private.recovery_codes(user_id,code_hash) select auth.uid(),h from unnest(p_hashes)h;
 insert into public.studio_activity(actor_id,actor_role,resource,record_id,action) select id,role,'security',id::text,'recovery_codes_rotated' from public.users where id=auth.uid();
end $$;
create function public.studio_consume_recovery(p_user uuid,p_session uuid,p_hash text) returns boolean language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from studio_private.admin_sessions a join auth.sessions s on s.id=a.session_id where a.user_id=p_user and a.session_id=p_session and a.expires_at>now() and s.created_at>now()-interval '10 minutes') then return false;end if;
 update studio_private.recovery_codes set used_at=now() where user_id=p_user and code_hash=p_hash and used_at is null;
 if not found then return false;end if;
 -- Immediately revoke every studio binding before the provider removes the lost factor.
 delete from studio_private.admin_sessions where user_id=p_user;
 insert into public.studio_activity(actor_id,actor_role,resource,record_id,action) values(p_user,'team','security',p_user::text,'recovery_code_used');return true;
end $$;
create function public.studio_sessions() returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if not public.is_studio_team() then raise exception 'Verified studio sign-in required' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.session_id,'created_at',s.created_at,'expires_at',a.expires_at,'current',a.session_id=nullif(auth.jwt()->>'session_id','')::uuid)),'[]') into result from studio_private.admin_sessions a join auth.sessions s on s.id=a.session_id where a.user_id=auth.uid() and a.expires_at>now();return result;end $$;
create function public.studio_revoke_session(p_id uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_studio_team() then raise exception 'Verified studio sign-in required' using errcode='42501';end if;
 delete from studio_private.admin_sessions where user_id=auth.uid() and session_id=p_id;
end $$;
revoke all on function public.studio_consume_recovery(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.studio_consume_recovery(uuid,uuid,text) to service_role;
do $$declare f record;begin for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('studio_mfa_entry','studio_recovery_codes','studio_sessions','studio_revoke_session') loop execute format('revoke all on function %s from public,anon',f.signature);execute format('grant execute on function %s to authenticated',f.signature);end loop;end $$;
-- Reconcile delivery events that arrived before the worker persisted the provider ID.
create function studio_private.reconcile_email_event() returns trigger language plpgsql security definer set search_path='' as $$declare e studio_private.email_events;begin
 if new.provider_id is not null then select * into e from studio_private.email_events where provider_id=new.provider_id order by event_at desc limit 1;
 if found and(new.delivery_updated_at is null or e.event_at>=new.delivery_updated_at) then
 new.delivery_state=replace(replace(e.event_type,'email.',''),'delivery_delayed','delayed');new.delivery_updated_at=e.event_at;
 elsif not found and new.state='sent' and new.delivery_state='queued' then new.delivery_state='sent';end if;end if;return new;end $$;
create trigger studio_delivery_reconcile before update of provider_id on public.booking_email_outbox for each row execute function studio_private.reconcile_email_event();
revoke all on all functions in schema studio_private from public,anon,authenticated;

create function public.studio_export_bookings(p_filters jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare page jsonb;result jsonb:='[]';n integer:=0;begin
 if not public.is_studio_admin() then raise exception 'Admin export access required' using errcode='42501';end if;
 loop page=public.studio_booking_page(p_filters,n,100);
 if (page->>'total')::integer>5000 then raise exception 'Narrow the filters to export up to 5,000 bookings';end if;
 result=result||(page->'rows');exit when jsonb_array_length(result)>=(page->>'total')::integer;n=n+1;end loop;return result;
end $$;
revoke all on function public.studio_export_bookings(jsonb) from public,anon;
grant execute on function public.studio_export_bookings(jsonb) to authenticated;

create function public.studio_calendar(p_from date,p_to date,p_mine boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if not public.is_studio_team() then raise exception 'Studio sign-in required' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>42 then raise exception 'Choose a calendar period of up to 42 days';end if;
 select coalesce(jsonb_agg(to_jsonb(b)-'reserved_window' order by b.booking_date,b.start_time),'[]') into result from public.bookings b where b.archived_at is null and b.status<>'cancelled' and b.booking_date between p_from and p_to and public.studio_can_access_booking(b.id) and(not p_mine or b.assigned_to=auth.uid() or b.editor_id=auth.uid() or auth.uid()=any(b.support_ids));
 if jsonb_array_length(result)>500 then raise exception 'Choose a week or day to view this busy period';end if;return result;end $$;
revoke all on function public.studio_calendar(date,date,boolean) from public,anon;
grant execute on function public.studio_calendar(date,date,boolean) to authenticated;
commit;
