-- Run against the migration inside a rollback-only transaction. No emails or customer mutations.
begin;
-- These rows and the entire schema change are rolled back by this verification.
insert into auth.users (id,email,raw_user_meta_data) values
 ('f1000000-0000-4000-8000-000000000001','portal-super-fixture@example.invalid','{"full_name":"Portal Fixture"}'),
 ('f1000000-0000-4000-8000-000000000002','portal-staff-fixture@example.invalid','{"full_name":"Portal Fixture"}'),
 ('f1000000-0000-4000-8000-000000000003','portal-customer-fixture@example.invalid','{"full_name":"Portal Fixture"}');
update public.users set role='superadmin',status='active' where id='f1000000-0000-4000-8000-000000000001';
update public.users set role='staff',status='active' where id='f1000000-0000-4000-8000-000000000002';
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001',now(),now()),
 ('f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002',now(),now()),
 ('f2000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000003',now(),now());
do $$ begin
 if public.studio_admin_session_valid('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001') then raise exception 'Unbound session allowed'; end if;
 if public.studio_register_admin_session('f1000000-0000-4000-8000-000000000003','f2000000-0000-4000-8000-000000000003') then raise exception 'Customer registered'; end if;
 if public.studio_register_admin_session('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002') then raise exception 'Mismatched session registered'; end if;
 if not public.studio_register_admin_session('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001') then raise exception 'Superadmin failed'; end if;
 if not public.studio_register_admin_session('f1000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000002') then raise exception 'Staff failed'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"f2000000-0000-4000-8000-000000000002"}',true);
set local role authenticated;
do $$ begin
 if not public.is_studio_team() then raise exception 'Staff not team'; end if;
 if public.is_studio_admin() or public.is_studio_superadmin() then raise exception 'Staff elevated'; end if;
 if public.is_studio_team('f1000000-0000-4000-8000-000000000001') then raise exception 'Other user helper bypass'; end if;
 begin perform public.studio_register_admin_session('f1000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000002');raise exception 'Session registration exposed';exception when insufficient_privilege then null;end;
 begin update public.users set role='superadmin' where id='f1000000-0000-4000-8000-000000000002';raise exception 'Own role escalation succeeded';exception when raise_exception then if sqlerrm='Own role escalation succeeded' then raise;end if;end;
 if exists(select 1 from public.studio_activity where resource<>'bookings') then raise exception 'Staff activity exceeded scope'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f2000000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
do $$ begin
 if not public.is_studio_superadmin() or not public.is_studio_admin() or not public.is_studio_team() then raise exception 'Superadmin missing permissions'; end if;
 begin update public.users set status='inactive' where id='f1000000-0000-4000-8000-000000000001';raise exception 'Own superadmin lockout succeeded';exception when raise_exception then if sqlerrm='Own superadmin lockout succeeded' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
update public.users set status='inactive' where id='f1000000-0000-4000-8000-000000000002';
update public.users set status='active' where id='f1000000-0000-4000-8000-000000000002';
do $$ begin
 if public.studio_admin_session_valid('f1000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000002') then raise exception 'Reactivation restored revoked session'; end if;
 if public.studio_login_limit(repeat('a',64),1)<>true or public.studio_login_limit(repeat('a',64),1)<>false then raise exception 'Rate limit failed';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"f2000000-0000-4000-8000-000000000001"}',true);
set local role authenticated;
select public.studio_end_admin_session();
do $$ begin if public.is_studio_team() then raise exception 'Logout still has permissions';end if;end $$;
reset role;
select 'PASS: role isolation, session binding, registration grants, self-lockout prevention, revocation, rate limiting and audit scope; all fixtures rolled back' as result;
rollback;
