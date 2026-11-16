-- Verification fixtures must run inside a transaction that is rolled back.

insert into auth.users(id,email,created_at,updated_at) values('55555555-0000-4000-8000-000000000001','reset-owner@example.invalid',now(),now()),('55555555-0000-4000-8000-000000000002','reset-staff@example.invalid',now(),now()),('55555555-0000-4000-8000-000000000003','reset-customer@example.invalid',now(),now());
update public.users set role=case id when '55555555-0000-4000-8000-000000000001'::uuid then 'superadmin' when '55555555-0000-4000-8000-000000000002'::uuid then 'staff' else 'customer' end,status='active' where id::text like '55555555-0000-4000-8000-%';
create function pg_temp.assert(ok boolean,msg text) returns void language plpgsql as $$begin if not coalesce(ok,false) then raise exception 'ASSERT: %',msg;end if;end $$;
select pg_temp.assert(not has_function_privilege('authenticated','public.studio_begin_password_reset(uuid,uuid)','execute'),'Client cannot request reset without Edge authorization');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$declare r uuid;blocked boolean;begin
 blocked=false;begin perform public.studio_begin_password_reset('55555555-0000-4000-8000-000000000002','55555555-0000-4000-8000-000000000001');exception when insufficient_privilege then blocked=true;end;perform pg_temp.assert(blocked,'Staff cannot authorize a reset');
 blocked=false;begin perform public.studio_begin_password_reset('55555555-0000-4000-8000-000000000001','55555555-0000-4000-8000-000000000003');exception when invalid_parameter_value then blocked=true;end;perform pg_temp.assert(blocked,'Customer recovery is separate');
 r=public.studio_begin_password_reset('55555555-0000-4000-8000-000000000001','55555555-0000-4000-8000-000000000002');perform pg_temp.assert(r is not null,'Owner can authorize team reset');
 blocked=false;begin perform public.studio_begin_password_reset('55555555-0000-4000-8000-000000000001','55555555-0000-4000-8000-000000000002');exception when raise_exception then blocked=true;end;perform pg_temp.assert(blocked,'Reset throttled');
 perform public.studio_finish_password_reset(r,true);perform public.studio_finish_password_reset(r,true);
 perform pg_temp.assert((select count(*)=1 from public.studio_activity where record_id='55555555-0000-4000-8000-000000000002' and action='password_reset_sent' and actor_id='55555555-0000-4000-8000-000000000001'),'Audit is attributed and idempotent');
 insert into auth.sessions(id,user_id,aal,created_at,updated_at) values('55555555-1000-4000-8000-000000000002','55555555-0000-4000-8000-000000000002','aal1',now(),now());
 insert into studio_private.admin_sessions(user_id,session_id) values('55555555-0000-4000-8000-000000000002','55555555-1000-4000-8000-000000000002');
 update auth.users set encrypted_password='fixture-only-not-a-real-hash' where id='55555555-0000-4000-8000-000000000002';
 perform pg_temp.assert((select count(*)=0 from studio_private.admin_sessions where user_id='55555555-0000-4000-8000-000000000002'),'Password change revokes all studio bindings');
end $$;
select 'PASS: 7 password-reset permission, rate-limit, audit and session-revocation checks' as result;
