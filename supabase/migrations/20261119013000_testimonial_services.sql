begin;
alter table public.testimonials add column service_id text check(service_id in ('portrait','birthday','event','commercial','landscape'));
notify pgrst,'reload schema';
commit;
