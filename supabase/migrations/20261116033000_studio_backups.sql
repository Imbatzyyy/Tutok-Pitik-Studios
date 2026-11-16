begin;
-- Application recovery snapshot. Provider configuration/credentials and ephemeral
-- login sessions are intentionally excluded and require separate provider recovery.
create function public.studio_backup_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;tables jsonb:='{}';schemas jsonb:='{}';t record;rows jsonb;cols jsonb;constraints jsonb;routines jsonb;policies jsonb;triggers jsonb;begin
 for t in select n.nspname,c.relname,c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and
 (n.nspname='public' or(n.nspname='auth' and c.relname in ('users','identities','mfa_factors')) or(n.nspname='storage' and c.relname in ('buckets','objects')) or(n.nspname='studio_private' and c.relname in ('recovery_codes','email_events'))) order by 1,2 loop
 execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from %I.%I x',t.nspname,t.relname) into rows;
 select jsonb_agg(jsonb_build_object('name',a.attname,'type',case when ty.typtype='e' then 'text' else format_type(a.atttypid,a.atttypmod) end,'nullable',not a.attnotnull,'generated',a.attgenerated,'identity',a.attidentity) order by a.attnum) into cols from pg_attribute a join pg_type ty on ty.oid=a.atttypid where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped;
 select coalesce(jsonb_agg(jsonb_build_object('name',conname,'type',contype,'definition',pg_get_constraintdef(oid))),'[]') into constraints from pg_constraint where conrelid=t.oid;
 tables=tables||jsonb_build_object(t.nspname||'.'||t.relname,rows);schemas=schemas||jsonb_build_object(t.nspname||'.'||t.relname,jsonb_build_object('columns',cols,'constraints',constraints));
 end loop;
 select coalesce(jsonb_agg(pg_get_functiondef(p.oid)),'[]') into routines from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','studio_private') and p.prokind='f';
 select coalesce(jsonb_agg(to_jsonb(p)),'[]') into policies from pg_policies p where schemaname in ('public','storage','realtime');
 select coalesce(jsonb_agg(pg_get_triggerdef(tr.oid)),'[]') into triggers from pg_trigger tr join pg_class c on c.oid=tr.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','studio_private') and not tr.tgisinternal;
 return jsonb_build_object('format','tps-application-recovery-v1','captured_at',now(),'project','dhqxzrzjvgcmjjkmxlfs','tables',tables,'schema',schemas,'functions',routines,'policies',policies,'triggers',triggers,'scope','Application records, account identities, MFA records and storage metadata. Provider configuration, API keys and login sessions are excluded.');
end $$;
create function public.studio_backup_start() returns boolean language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(1730124);
 if exists(select 1 from public.studio_operations where key='backup' and state='running' and checked_at>now()-interval '15 minutes') then return false;end if;
 insert into public.studio_operations(key,state,detail) values('backup','running','Encrypted recovery snapshot in progress') on conflict(key) do update set state='running',checked_at=now(),detail=excluded.detail;return true;end $$;
create function public.studio_backup_finish(p_ok boolean,p_counts jsonb default '{}') returns void language sql security definer set search_path='' as $$
 insert into public.studio_operations(key,state,detail,metadata) values('backup',case when p_ok then 'healthy' else 'failed' end,case when p_ok then 'Encrypted database snapshot and uploaded files saved off-site' else 'Backup failed. Review the scheduled function before relying on this recovery copy' end,p_counts)
 on conflict(key) do update set state=excluded.state,checked_at=now(),detail=excluded.detail,metadata=excluded.metadata;
$$;
revoke all on function public.studio_backup_snapshot(),public.studio_backup_start(),public.studio_backup_finish(boolean,jsonb) from public,anon,authenticated;
grant execute on function public.studio_backup_snapshot(),public.studio_backup_start(),public.studio_backup_finish(boolean,jsonb) to service_role;
commit;
