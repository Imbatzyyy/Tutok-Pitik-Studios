begin;
-- Older checkout tabs share the same lock. While a client pays, keep their
-- remaining account capacity available for the held checkout.
create function studio_private.protect_customer_hold() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('pending','confirmed') and new.archived_at is null then
   perform pg_advisory_xact_lock(1730123);
   if exists(select from studio_private.booking_holds
     where customer=new.user_id and not released and expires_at>clock_timestamp())
   then raise exception 'Finish your active payment hold before submitting another booking'; end if;
 end if;
 return new;
end $$;
create trigger protect_customer_hold before insert on public.bookings for each row execute function studio_private.protect_customer_hold();
commit;
