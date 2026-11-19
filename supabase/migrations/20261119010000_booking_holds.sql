begin;
create table studio_private.booking_holds (
 id uuid primary key default gen_random_uuid(),
 customer uuid not null references auth.users on delete cascade,
 service text not null, shoot_date date not null, starts time not null, ends time not null,
 reserved tsrange not null, created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '15 minutes',
 visit_device text, visit_source text,
 released boolean not null default false
);
create index holds_customer_recent on studio_private.booking_holds(customer,created_at desc);
create index holds_date on studio_private.booking_holds(shoot_date,expires_at) where not released;
alter table studio_private.booking_holds enable row level security;
revoke all on studio_private.booking_holds from public,anon,authenticated;

-- The studio calendar, admin reschedules and old open browser tabs share this check.
alter function studio_private.assert_schedule(date,time,time,uuid) rename to assert_schedule_base;
create function studio_private.assert_schedule(p_date date,p_start time,p_end time,p_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare w tsrange;
begin
 perform studio_private.assert_schedule_base(p_date,p_start,p_end,p_id);
 select tsrange(p_date+p_start-buffer_before*interval '1 minute',p_date+p_end+buffer_after*interval '1 minute','[)') into w from public.studio_settings where id;
 if exists(select from studio_private.booking_holds where not released and expires_at>clock_timestamp() and reserved && w)
 then raise exception 'Another customer is paying for that time. Please select another slot.'; end if;
end $$;
revoke all on function studio_private.assert_schedule(date,time,time,uuid) from public,anon,authenticated;

create function public.studio_hold_slot(p_service text,p_date date,p_start time,p_end time)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h studio_private.booking_holds; uid uuid:=auth.uid(); customer_window tsrange;
begin
 if not public.is_active_studio_user() or not exists(select from public.users where id=uid and role='customer') then raise exception 'Sign in with a customer account'; end if;
 perform pg_advisory_xact_lock(1730123);
 if p_service is null or p_service not in ('Birthday Photography','Portrait Photography','Commercial Photography','Event Coverage','Landscape & Architecture') then raise exception 'Choose a valid service'; end if;
 if (select count(*) from public.bookings where user_id=uid and status in ('pending','confirmed') and archived_at is null)>=3 then raise exception 'You already have three active bookings. Please contact the studio.'; end if;
 if (select count(*) from public.bookings where user_id=uid and created_at>now()-interval '1 hour')>=5 then raise exception 'Please wait before placing another reservation'; end if;
 select * into h from studio_private.booking_holds where customer=uid and not released and expires_at>clock_timestamp() order by created_at desc limit 1;
 if found then
   if (h.service,h.shoot_date,h.starts,h.ends) is distinct from (p_service,p_date,p_start,p_end) then raise exception 'Finish or release your existing hold before choosing another time.'; end if;
 else
   if (select count(*) from studio_private.booking_holds where customer=uid and created_at>now()-interval '1 hour')>=4 then raise exception 'Too many recent holds. Please contact the studio.'; end if;
   perform studio_private.assert_schedule(p_date,p_start,p_end);
   select tsrange(p_date+p_start-buffer_before*interval '1 minute',p_date+p_end+buffer_after*interval '1 minute','[)') into customer_window from public.studio_settings where id;
   insert into studio_private.booking_holds(customer,service,shoot_date,starts,ends,reserved) values(uid,p_service,p_date,p_start,p_end,customer_window) returning * into h;
 end if;
 return jsonb_build_object('id',h.id,'expires_at',h.expires_at,'service',h.service,'date',h.shoot_date,'start',h.starts,'end',h.ends);
end $$;

create function public.studio_release_hold(p_key uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(1730123);
 update studio_private.booking_holds set released=true where id=p_key and customer=auth.uid();
end $$;

create function public.studio_current_hold() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'expires_at',expires_at,'service',service,'date',shoot_date,'start',starts,'end',ends)
 from studio_private.booking_holds where customer=auth.uid() and not released and created_at>now()-interval '7 days' order by created_at desc limit 1;
$$;

create function public.studio_submit_held_booking(p_payload jsonb,p_key uuid) returns public.bookings language plpgsql security definer set search_path='' as $$
declare h studio_private.booking_holds; b public.bookings;
begin
 perform pg_advisory_xact_lock(1730123);
 select * into b from public.bookings where user_id=auth.uid() and client_request_id=p_key;
 if found then return b; end if;
 select * into h from studio_private.booking_holds where id=p_key and customer=auth.uid() and not released and expires_at>clock_timestamp() for update;
 if not found then raise exception 'Your hold expired. If you paid, contact the studio with your hold reference. Do not pay again.'; end if;
 if (h.service,h.shoot_date,h.starts,h.ends) is distinct from (p_payload->>'service',(p_payload->>'booking_date')::date,(p_payload->>'start_time')::time,(p_payload->>'end_time')::time) then raise exception 'Booking details do not match the payment hold'; end if;
 update studio_private.booking_holds set released=true,
 visit_device=case when p_payload->>'device' in ('mobile','desktop') then p_payload->>'device' end,
 visit_source=case when p_payload->>'source' in ('direct','search','social','referral') then p_payload->>'source' end
 where id=h.id;
 select * into b from public.studio_create_booking(p_payload,p_key);
 return b;
end $$;
-- Direct booking writes must also protect active holds and the account's limit.
create function studio_private.guard_booking_capacity() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status in ('pending','confirmed') and new.archived_at is null then
   perform pg_advisory_xact_lock(1730123);
   if exists(select from studio_private.booking_holds where not released and expires_at>clock_timestamp() and reserved && tsrange(new.booking_date+new.start_time-new.buffer_before*interval '1 minute',new.booking_date+new.end_time+new.buffer_after*interval '1 minute','[)')) then raise exception 'There is an active payment hold on this slot'; end if;
   if tg_op='INSERT' and (select count(*) from public.bookings where user_id=new.user_id and archived_at is null and status in ('pending','confirmed'))>=3 then raise exception 'Three active bookings are already on this account'; end if;
 end if;
 return new;
end $$;
create trigger booking_capacity before insert or update of booking_date,start_time,end_time,status,archived_at on public.bookings for each row execute function studio_private.guard_booking_capacity();

create function studio_private.guard_block_hold() returns trigger language plpgsql security definer set search_path='' as $$
declare d date; w tsrange;
begin
 perform pg_advisory_xact_lock(1730123);
 if tg_table_name='blocked_dates' then d:=new.blocked_date; w:=tsrange(d::timestamp,(d+1)::timestamp,'[)');
 else d:=new.block_date; w:=tsrange(d+new.start_time,d+new.end_time,'[)'); end if;
 if exists(select from studio_private.booking_holds where not released and expires_at>clock_timestamp() and reserved && w) then raise exception 'This change overlaps a client payment hold. Try after the hold expires.'; end if;
 return new;
end $$;
create trigger prevent_block_during_hold before insert or update on public.blocked_dates for each row execute function studio_private.guard_block_hold();
create trigger prevent_time_block_during_hold before insert or update on public.studio_time_blocks for each row execute function studio_private.guard_block_hold();

create function studio_private.guard_hours_during_hold() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(1730123);
 if (new.opens_at,new.closes_at,new.max_hours,new.lead_days,new.buffer_before,new.buffer_after) is distinct from (old.opens_at,old.closes_at,old.max_hours,old.lead_days,old.buffer_before,old.buffer_after)
 and exists(select from studio_private.booking_holds where not released and expires_at>clock_timestamp()) then raise exception 'A client is paying. Please change booking rules after the payment hold expires.'; end if;
 return new;
end $$;
create trigger prevent_hours_change_during_hold before update on public.studio_settings for each row execute function studio_private.guard_hours_during_hold();

create or replace function public.get_booked_slots(start_date date,end_date date) returns table(booking_date date,start_time time,end_time time,status text) language sql stable security definer set search_path='' as $$
 select b.booking_date,greatest(b.booking_date::timestamp,b.booking_date+b.start_time-(b.buffer_before+s.buffer_after)*interval '1 minute')::time,least(b.booking_date+time '23:59:59',b.booking_date+b.end_time+(b.buffer_after+s.buffer_before)*interval '1 minute')::time,b.status
 from public.bookings b cross join public.studio_settings s where s.id and b.status in ('pending','confirmed') and b.archived_at is null and b.booking_date between start_date and least(end_date,start_date+190)
 union all select t.block_date,greatest(t.block_date::timestamp,t.block_date+t.start_time-s.buffer_after*interval '1 minute')::time,least(t.block_date+time '23:59:59',t.block_date+t.end_time+s.buffer_before*interval '1 minute')::time,'blocked' from public.studio_time_blocks t cross join public.studio_settings s where s.id and t.block_date between start_date and least(end_date,start_date+190)
 union all select h.shoot_date,greatest(h.shoot_date::timestamp,lower(h.reserved)-s.buffer_after*interval '1 minute')::time,least(h.shoot_date+time '23:59:59',upper(h.reserved)+s.buffer_before*interval '1 minute')::time,'held'
 from studio_private.booking_holds h cross join public.studio_settings s where s.id and not h.released and h.expires_at>now() and h.customer is distinct from auth.uid() and h.shoot_date between start_date and least(end_date,start_date+190);
$$;
revoke all on function public.studio_hold_slot(text,date,time,time),public.studio_release_hold(uuid),public.studio_current_hold(),public.studio_submit_held_booking(jsonb,uuid) from public,anon;
grant execute on function public.studio_hold_slot(text,date,time,time),public.studio_release_hold(uuid),public.studio_current_hold(),public.studio_submit_held_booking(jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
