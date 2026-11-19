-- Run inside a transaction with the studio operations test fixture setup; roll back.
set local role authenticated;
do $$
declare
 day date; h jsonb; again jsonb; blocked boolean; b public.bookings; result public.bookings; payload jsonb;
begin
 perform pg_temp.claims(3);
 select (now() at time zone 'Asia/Manila')::date+n into day from generate_series(25,85)n
 where not exists(select from public.get_blocked_dates(current_date,current_date+100) x where x.blocked_date=(now() at time zone 'Asia/Manila')::date+n)
 and not exists(select from public.get_booked_slots(current_date,current_date+100) x where x.booking_date=(now() at time zone 'Asia/Manila')::date+n) limit 1;
 h:=public.studio_hold_slot('Birthday Photography',day,'10:00','12:00');
 again:=public.studio_hold_slot('Birthday Photography',day,'10:00','12:00');
 perform pg_temp.assert(h->>'id'=again->>'id','recover same hold on retry');
 perform pg_temp.claims(4);
 perform pg_temp.assert(exists(select from public.get_booked_slots(day,day) where status='held'),'another customer sees reserved interval');
 blocked:=false;
 begin perform public.studio_hold_slot('Birthday Photography',day,'10:00','12:00'); exception when others then blocked:=true; end;
 perform pg_temp.assert(blocked,'second customer cannot take live hold');
 perform public.studio_release_hold((h->>'id')::uuid);
 perform pg_temp.claims(3);
 perform pg_temp.assert(public.studio_current_hold()->>'id'=h->>'id','release is owner scoped');
 payload:=jsonb_build_object('service','Birthday Photography','booking_date',day,'start_time','10:00','end_time','12:00','location','Test studio venue','phone','09000000000','message',E'\n\n---BOOKING_META---\n'||jsonb_build_object('paymentReference','fixture-hold-1','paymentReceiptPath','11111111-0000-4000-8000-000000000003/fixture.jpg')::text);
 select * into b from public.studio_submit_held_booking(payload,(h->>'id')::uuid);
 select * into result from public.studio_submit_held_booking(payload,(h->>'id')::uuid);
 perform pg_temp.assert(result.id=b.id and b.total_price=2000,'retry after commit recovers one correctly priced booking');
end $$;
-- Expiry, customer scope, the studio inbox, and the admin-only report.
do $$
declare h jsonb; blocked boolean:=false; day date;
begin
 perform pg_temp.claims(4);
 select (now() at time zone 'Asia/Manila')::date+n into day from generate_series(35,95)n
 where not exists(select from public.get_blocked_dates(current_date,current_date+100)x where x.blocked_date=(now() at time zone 'Asia/Manila')::date+n)
 and not exists(select from public.get_booked_slots(current_date,current_date+100)x where x.booking_date=(now() at time zone 'Asia/Manila')::date+n) limit 1;
 h:=public.studio_hold_slot('Portrait Photography',day,'10:00','12:00');
 perform set_config('fixture.expired',h->>'id',true);
 perform pg_temp.claims(3);
 begin perform public.studio_report_paid_hold((h->>'id')::uuid,'1234567890123'); exception when others then blocked:=true; end;
 perform pg_temp.assert(blocked,'payment reconciliation is customer scoped');
 blocked:=false;
 begin perform public.studio_client_experience(); exception when others then blocked:=true; end;
 perform pg_temp.assert(blocked,'studio report is admin only');
end $$;
reset role;
update studio_private.booking_holds set expires_at=now()-interval '1 second' where id=current_setting('fixture.expired')::uuid;
set local role authenticated;
do $$
declare h uuid:=current_setting('fixture.expired')::uuid; ticket uuid; again uuid; blocked boolean:=false; report jsonb;
begin
 perform pg_temp.claims(4);
 perform pg_temp.assert(public.studio_current_hold()->>'id'=h::text,'recent expired hold can be recovered across devices');
 begin perform public.studio_submit_held_booking('{}',h); exception when others then blocked:=true; end;
 perform pg_temp.assert(blocked,'expired holds cannot reserve a booking');
 ticket:=public.studio_report_paid_hold(h,'1234567890123');
 again:=public.studio_report_paid_hold(h,'1234567890123');
 perform pg_temp.assert(ticket=again,'one reconciliation case after retry');
 perform pg_temp.claims(1);
 perform public.studio_handle_inquiry(ticket,'working');
 perform pg_temp.assert(exists(select from public.contact_messages where id=ticket and inquiry_state='working' and owner_id=auth.uid()),'admin can own payment case');
 report:=public.studio_client_experience();
 perform pg_temp.assert((report->>'payment_cases')::int>=1 and report?'decision','operational report reads real schema');
 perform public.studio_handle_inquiry(ticket,'closed');
end $$;
reset role;
set local role authenticated;
do $$
declare day date; h jsonb; blocked boolean:=false; payload jsonb; n integer;
begin
 perform pg_temp.claims(3);
 for n in 1..2 loop
  select (now() at time zone 'Asia/Manila')::date+i into day from generate_series(45,110)i
   where not exists(select from public.get_booked_slots(current_date,current_date+120)x where x.booking_date=(now() at time zone 'Asia/Manila')::date+i)
   and not exists(select from public.get_blocked_dates(current_date,current_date+120)x where x.blocked_date=(now() at time zone 'Asia/Manila')::date+i) limit 1;
  h:=public.studio_hold_slot('Birthday Photography',day,'10:00','12:00');
  payload:=jsonb_build_object('service','Birthday Photography','booking_date',day,'start_time','10:00','end_time','12:00','location','Test studio venue','phone','09000000000','message',E'\n\n---BOOKING_META---\n'||jsonb_build_object('paymentReference','fixture-capacity-'||n,'paymentReceiptPath','11111111-0000-4000-8000-000000000003/fixture.jpg')::text);
  perform public.studio_submit_held_booking(payload,(h->>'id')::uuid);
 end loop;
 begin perform public.studio_hold_slot('Birthday Photography',day+1,'10:00','12:00'); exception when others then blocked:=sqlerrm like '%three active bookings%';end;
 perform pg_temp.assert(blocked,'capacity is enforced before payment');
end $$;
reset role;
