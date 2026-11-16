-- Executed after the proposed migrations inside a transaction that is ALWAYS rolled back.
-- No fixtures, mail jobs, storage metadata or user accounts are committed.
insert into auth.users(id,email,raw_user_meta_data,created_at,updated_at) values
 ('11111111-0000-4000-8000-000000000001','ops-owner@example.invalid','{"full_name":"Operations Owner Fixture"}',now(),now()),
 ('11111111-0000-4000-8000-000000000002','ops-staff@example.invalid','{"full_name":"Operations Staff Fixture"}',now(),now()),
 ('11111111-0000-4000-8000-000000000003','ops-client@example.invalid','{"full_name":"Operations Client Fixture"}',now(),now()),
 ('11111111-0000-4000-8000-000000000004','ops-other@example.invalid','{"full_name":"Operations Other Fixture"}',now(),now());
update public.users set role=case id when '11111111-0000-4000-8000-000000000001'::uuid then 'superadmin' when '11111111-0000-4000-8000-000000000002'::uuid then 'staff' else 'customer' end,status='active',phone='09000000000' where id::text like '11111111-0000-4000-8000-00000000000%';
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) values
 ('22222222-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','totp','verified',now(),now()),
 ('22222222-0000-4000-8000-000000000002','11111111-0000-4000-8000-000000000002','totp','verified',now(),now());
insert into auth.sessions(id,user_id,aal,factor_id,created_at,updated_at) values
 ('33333333-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','aal2','22222222-0000-4000-8000-000000000001',now(),now()),
 ('33333333-0000-4000-8000-000000000002','11111111-0000-4000-8000-000000000002','aal2','22222222-0000-4000-8000-000000000002',now(),now());
insert into studio_private.admin_sessions(session_id,user_id) values
 ('33333333-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001'),
 ('33333333-0000-4000-8000-000000000002','11111111-0000-4000-8000-000000000002');
insert into storage.objects(bucket_id,name) values('payment-receipts','11111111-0000-4000-8000-000000000003/fixture.jpg'),('payment-receipts','11111111-0000-4000-8000-000000000003/fixture2.jpg');
insert into storage.objects(bucket_id,name) values('studio-files','11111111-0000-4000-8000-000000000003/fixture.pdf');
create function pg_temp.claims(n integer,aal text default 'aal2') returns void language sql as $$select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub','11111111-0000-4000-8000-'||lpad(n::text,12,'0'),'session_id','33333333-0000-4000-8000-'||lpad(n::text,12,'0'),'aal',aal)::text,true)::text::void;$$;
create function pg_temp.assert(ok boolean,msg text) returns void language plpgsql as $$begin if not coalesce(ok,false) then raise exception 'ASSERTION FAILED: %',msg;end if;end $$;
set local role authenticated;
do $$declare b public.bookings;again public.bookings;p public.booking_payments;r public.booking_requests;d date;key uuid:=gen_random_uuid();payload jsonb;blocked boolean;changed integer;begin
 perform pg_temp.claims(1,'aal1');perform pg_temp.assert(public.studio_mfa_entry(),'MFA entry with portal binding');perform pg_temp.assert(not public.is_studio_team(),'AAL1 is denied studio data');
 perform pg_temp.claims(1);perform pg_temp.assert(public.is_studio_superadmin(),'AAL2 owner accepted');
 select (now() at time zone 'Asia/Manila')::date+x into d from generate_series(10,80)x where not exists(select 1 from public.bookings where booking_date between(now() at time zone 'Asia/Manila')::date+x and(now() at time zone 'Asia/Manila')::date+x+2) and not exists(select 1 from public.blocked_dates where blocked_date between(now() at time zone 'Asia/Manila')::date+x and(now() at time zone 'Asia/Manila')::date+x+2) limit 1;
 perform pg_temp.claims(3,'aal1');
 payload=jsonb_build_object('service','Portrait Photography','booking_date',d,'start_time','10:00','end_time','12:00','location','Fixture studio venue','phone','09000000000','price',1,'total_price',1,'message',E'Fixture notes\n\n---BOOKING_META---\n'||jsonb_build_object('paymentReference','OPS-FIXTURE-0001','paymentReceiptPath','11111111-0000-4000-8000-000000000003/fixture.jpg','paymentReceiptName','fixture.jpg')::text);
 b=public.studio_create_booking(payload,key);perform pg_temp.assert(b.total_price=5000 and b.status='pending','Server computes price and pending status');
 perform public.studio_add_file(b.id,'11111111-0000-4000-8000-000000000003/fixture.pdf','Programme.pdf','programme');
 perform pg_temp.assert((select count(*)=1 from storage.objects where bucket_id='studio-files' and name='11111111-0000-4000-8000-000000000003/fixture.pdf'),'Client reads own private file');
 update storage.objects set metadata='{}' where bucket_id='payment-receipts' and name='11111111-0000-4000-8000-000000000003/fixture.jpg';get diagnostics changed=row_count;perform pg_temp.assert(changed=0,'Client cannot replace immutable receipt bytes');
 again=public.studio_create_booking(payload,key);perform pg_temp.assert(again.id=b.id,'Idempotent booking retry');
 blocked=false;begin perform public.studio_create_booking(payload,gen_random_uuid());exception when others then blocked=true;end;perform pg_temp.assert(blocked,'Overlapping reservation rejected');
 blocked=false;begin update public.bookings set total_price=1 where id=b.id;exception when insufficient_privilege then blocked=true;end;perform pg_temp.assert(blocked,'Direct booking update denied');
 perform pg_temp.claims(4,'aal1');perform pg_temp.assert((select count(*)=0 from storage.objects where bucket_id='studio-files' and name='11111111-0000-4000-8000-000000000003/fixture.pdf'),'Other client cannot read private file');perform pg_temp.assert((select count(*)=0 from public.bookings where id=b.id),'Other client cannot read booking');perform pg_temp.assert((select count(*)=0 from public.booking_payments where booking_id=b.id),'Other client cannot read proof');
 perform pg_temp.claims(2);perform pg_temp.assert((select count(*)=0 from public.bookings where id=b.id),'Unassigned staff cannot read booking');
 perform pg_temp.claims(1);b=public.studio_update_booking(b.id,b.version,jsonb_build_object('assigned_to','11111111-0000-4000-8000-000000000002'));
 perform pg_temp.claims(2);perform pg_temp.assert((select count(*)=1 from public.bookings where id=b.id),'Assigned staff can read booking');perform pg_temp.assert((select count(*)=1 from storage.objects where bucket_id='studio-files' and name='11111111-0000-4000-8000-000000000003/fixture.pdf'),'Assigned staff can read private file using object path');perform pg_temp.assert(not public.studio_can_verify_payment(),'Staff has no default payment approval');
 select * into p from public.booking_payments where booking_id=b.id limit 1;
 blocked=false;begin perform public.studio_payment_action(b.id,b.version,'review',jsonb_build_object('id',p.id,'status','verified','receipt_checked',true));exception when insufficient_privilege then blocked=true;end;perform pg_temp.assert(blocked,'Unprivileged payment approval denied');
 perform pg_temp.claims(1);b=public.studio_payment_action(b.id,b.version,'review',jsonb_build_object('id',p.id,'status','verified','receipt_checked',true));perform pg_temp.assert(b.paid_amount=2500 and b.payment_state='deposit_verified','Deposit verified and summary updated');
 b=public.studio_update_booking(b.id,b.version,'{"status":"confirmed"}');
 blocked=false;begin perform public.studio_update_booking(b.id,b.version-1,'{"client_note":"stale edit"}');exception when serialization_failure then blocked=true;end;perform pg_temp.assert(blocked,'Stale update rejected');
 perform public.studio_add_note(b.id,'Internal-only fixture',true);
 perform pg_temp.claims(3,'aal1');perform pg_temp.assert((select count(*)=0 from public.booking_notes where booking_id=b.id and internal),'Customer cannot see internal notes');
 r=public.studio_request_change(b.id,'reschedule',jsonb_build_object('date',d+1,'start','10:00','end','12:00','reason','Fixture reschedule request'));
 select * into b from public.bookings where id=b.id;perform pg_temp.assert(b.booking_date=d,'Request keeps original reserved date');
 perform pg_temp.claims(1);b=public.studio_resolve_request(r.id,b.version,'approved','Fixture request approved');perform pg_temp.assert(b.booking_date=d+1,'Approval changes the reserved date atomically');
 b=public.studio_payment_action(b.id,b.version,'record','{"kind":"balance","amount":2500,"method":"GCash","reference":"OPS-FIXTURE-0002","reason":"Received in fixture account","receipt_checked":true}');perform pg_temp.assert(b.payment_state='paid' and b.paid_amount=5000,'Final payment completes balance');
 blocked=false;begin perform public.studio_payment_action(b.id,b.version,'record','{"kind":"refund","amount":5001,"method":"Cash","reason":"Fixture invalid refund","receipt_checked":true}');exception when others then blocked=true;end;perform pg_temp.assert(blocked,'Refund cannot exceed received payment');
 b=public.studio_payment_action(b.id,b.version,'record','{"kind":"refund","amount":1000,"method":"Cash","reason":"Fixture refund paid","receipt_checked":true}');perform pg_temp.assert(b.refunded_amount=1000,'Refund recorded');
 select * into p from public.booking_payments where booking_id=b.id and kind='refund';b=public.studio_payment_action(b.id,b.version,'reverse',jsonb_build_object('id',p.id,'reason','Fixture reversal reason'));perform pg_temp.assert(b.refunded_amount=0,'Reversal preserves history and restores summary');
 b=public.studio_update_booking(b.id,b.version,'{"status":"completed"}');perform pg_temp.assert(b.delivery_due is not null and b.gallery_status='editing','Completion starts delivery workflow');
 blocked=false;begin perform public.studio_update_booking(b.id,b.version,'{"gallery_status":"ready","gallery_url":"https://example.invalid/private/"}');exception when others then blocked=true;end;perform pg_temp.assert(blocked,'Gallery cannot be released without access acknowledgement');
 b=public.studio_update_booking(b.id,b.version,'{"gallery_status":"ready","gallery_url":"https://example.invalid/private/","gallery_access_checked":true}');
 again=public.studio_archive_booking(b.id,b.version,'Fixture archive reason');perform pg_temp.assert(again.archived_at is not null,'Resolved booking can be archived');
 perform pg_temp.assert(jsonb_array_length(public.studio_export_bookings(jsonb_build_object('q',b.id,'archive','all')))=1,'Export matches filtered archived booking');
 b=public.studio_archive_booking(again.id,again.version,'Fixture restoration reason',true);perform pg_temp.assert(b.archived_at is null,'Archive restoration works');
 perform pg_temp.assert((public.studio_overview()->>'pending')::integer>=0,'Action queue executes');
 perform pg_temp.assert((public.studio_finance_report(d,d+2)->>'bookings')::integer>=1,'Finance report executes');
 perform pg_temp.assert(jsonb_array_length(public.studio_email_history(b.id))>=5,'Workflow notifications are queued transactionally');
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.studio_service_account_update('11111111-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000004','{"status":"inactive"}');
select pg_temp.assert(exists(select 1 from public.studio_activity where record_id='11111111-0000-4000-8000-000000000004' and actor_id='11111111-0000-4000-8000-000000000001' and 'status'=any(changed_fields)),'Account audit names the acting owner');
select pg_temp.assert(not has_function_privilege('authenticated','public.studio_service_account_update(uuid,uuid,jsonb)','execute'),'Browser cannot impersonate audit actor');
insert into public.studio_time_blocks(block_date,start_time,end_time,reason,created_by) values(current_date+100,'00:05','00:10','Early fixture','11111111-0000-4000-8000-000000000001'),(current_date+101,'23:50','23:55','Late fixture','11111111-0000-4000-8000-000000000001');
select pg_temp.assert((select start_time='00:00' from public.get_booked_slots(current_date+100,current_date+100) where status='blocked'),'Buffer clamps before midnight');
select pg_temp.assert((select end_time='23:59:59' from public.get_booked_slots(current_date+101,current_date+101) where status='blocked'),'Buffer clamps after midnight');
select 'PASS: 36 transactional booking, permission, payment, request, delivery, export and MFA checks; fixtures rolled back' as result;
