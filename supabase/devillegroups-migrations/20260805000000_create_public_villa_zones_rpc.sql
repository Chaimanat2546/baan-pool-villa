-- Apply this idempotent patch only to the devillegroups Supabase project.
-- It is intentionally separate from supabase/migrations, which belongs to the
-- web application's primary Supabase project.

create or replace function public.get_public_villa_zones()
returns table(location_zone text)
language sql
stable
set search_path = public
as $$
  select distinct trim(l.location_zone) as location_zone
  from public.listings l
  where l.is_active is true
    and nullif(trim(l.location_zone), '') is not null
  order by location_zone;
$$;

grant execute on function public.get_public_villa_zones() to anon, authenticated;

notify pgrst, 'reload schema';
