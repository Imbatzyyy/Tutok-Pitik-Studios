-- Run inside a transaction after the privacy migration, then ROLLBACK.
-- Fixed fixture UUIDs never persist and no email-triggering booking is created.
insert into auth.users(id,email,raw_user_meta_data,created_at,updated_at)
values ('aaaa1111-0000-4000-8000-000000000001','oauth-privacy-a@example.invalid','{"full_name":"OAuth fixture A","role":"superadmin"}',now(),now()),
       ('aaaa1111-0000-4000-8000-000000000002','oauth-privacy-b@example.invalid','{"full_name":"OAuth fixture B"}',now(),now());
do $$ begin
 if (select role from public.users where id='aaaa1111-0000-4000-8000-000000000001') <> 'customer' then raise exception 'metadata granted privileged role';end if;
 if (select public from storage.buckets where id='profile-pictures') then raise exception 'avatars remain public';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) then raise exception 'unprotected public table';end if;
end $$;
insert into storage.objects(bucket_id,name,owner_id) values
 ('profile-pictures','aaaa1111-0000-4000-8000-000000000001/fixture.jpg','aaaa1111-0000-4000-8000-000000000001'),
 ('profile-pictures','aaaa1111-0000-4000-8000-000000000002/fixture.jpg','aaaa1111-0000-4000-8000-000000000002'),
 ('payment-receipts','aaaa1111-0000-4000-8000-000000000001/fixture.jpg','aaaa1111-0000-4000-8000-000000000001'),
 ('payment-receipts','aaaa1111-0000-4000-8000-000000000002/fixture.jpg','aaaa1111-0000-4000-8000-000000000002');
set local role anon;
do $$ begin
 if exists(select 1 from public.users) then raise exception 'anonymous profile read';end if;
 if exists(select 1 from public.bookings) then raise exception 'anonymous booking read';end if;
 if exists(select 1 from storage.objects where bucket_id in ('payment-receipts','profile-pictures')) then raise exception 'anonymous private file listing';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"aaaa1111-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if not public.is_active_studio_user() then raise exception 'active customer rejected';end if;
 if (select count(*) from public.users) <> 1 then raise exception 'customer read another profile';end if;
 if (select count(*) from storage.objects where bucket_id='profile-pictures') <> 1 then raise exception 'avatar isolation failure';end if;
 if (select count(*) from storage.objects where bucket_id='payment-receipts') <> 1 then raise exception 'receipt isolation failure';end if;
 if exists(select 1 from public.bookings where user_id <> auth.uid()) then raise exception 'customer read another booking';end if;
 begin
  update public.users set role='superadmin' where id=auth.uid();
  raise exception 'role escalation succeeded';
 exception when raise_exception then
  if sqlerrm <> 'Only a super admin can change roles or account status' then raise;end if;
 end;
 begin
  perform id from public.booking_email_outbox limit 1;
  raise exception 'outbox accessible';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
update public.users set status='suspended' where id='aaaa1111-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"aaaa1111-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare changed int;begin
 if public.is_active_studio_user() then raise exception 'suspended account considered active';end if;
 if exists(select 1 from storage.objects where bucket_id in ('profile-pictures','payment-receipts')) then raise exception 'suspended private file access';end if;
 update public.users set full_name='unauthorized' where id=auth.uid();get diagnostics changed=row_count;
 if changed<>0 then raise exception 'suspended profile update';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
update public.users set role='admin',status='active' where id='aaaa1111-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"aaaa1111-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if (select count(*) from storage.objects where bucket_id='profile-pictures' and name like 'aaaa1111-%')<>2 then raise exception 'team cannot read profile photos';end if;
end $$;
reset role;
