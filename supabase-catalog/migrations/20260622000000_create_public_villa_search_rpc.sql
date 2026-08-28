create or replace function public.search_public_villa_ids(
  p_zone text default null,
  p_guests integer default 1,
  p_bedrooms integer default 1,
  p_max_price integer default null,
  p_amenities text[] default '{}'::text[],
  p_sort text default 'recommended',
  p_query text default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table(property_id integer, total_count bigint)
language sql
stable
set search_path = public
as $$
  with matched as (
    select
      l.id,
      l.property_id::integer as property_id,
      l.sort_order,
      l.max_guests,
      l.bedrooms,
      min(lp.deville_price) as raw_price
    from public.listings l
    left join public.listing_prices lp on lp.listing_id = l.id
    where l.is_active
      and l.property_id is not null
      and l.max_guests >= greatest(coalesce(p_guests, 1), 1)
      and l.bedrooms >= greatest(coalesce(p_bedrooms, 1), 1)
      and (nullif(p_zone, '') is null or p_zone = 'all' or l.location_zone = p_zone)
      and (
        nullif(trim(coalesce(p_query, '')), '') is null
        or (
          regexp_replace(lower(trim(p_query)), '[^a-z0-9]', '', 'g') ~ '^(dv)?[0-9]+$'
          and l.property_id = regexp_replace(
            regexp_replace(lower(trim(p_query)), '[^a-z0-9]', '', 'g'),
            '^dv',
            ''
          )::integer
        )
        or (
          regexp_replace(lower(trim(p_query)), '[^a-z0-9]', '', 'g') !~ '^(dv)?[0-9]+$'
          and l.title ilike ('%' || replace(replace(trim(p_query), '%', ''), '_', '') || '%')
        )
      )
      and (
        coalesce(cardinality(p_amenities), 0) = 0
        or not exists (
          select 1
          from unnest(p_amenities) required_amenity(amenity)
          where not exists (
            select 1
            from public.listing_facilities lf
            join public.facilities f on f.id = lf.facility_id
            where lf.listing_id = l.id
              and lf.value_boolean is true
              and case f.name
                when 'air_hockey' then 'airhockey'
                when 'bathtub' then 'bath'
                when 'billiard' then 'billard'
                when 'disco_tech' then 'discotech'
                when 'kid_pool' then 'swimming_kid'
                when 'pets' then 'pet'
                when 'pool_float' then 'fancyring'
                when 'table_tennis' then 'tabletennis'
                else f.name
              end = required_amenity.amenity
          )
        )
      )
    group by l.id, l.property_id, l.sort_order, l.max_guests, l.bedrooms
  ),
  priced as (
    select
      matched.*,
      case
        when raw_price is null then null
        when raw_price <= 28000 then raw_price + case when mod(raw_price::integer, 1000) = 500 then 1400 else 1900 end
        when raw_price <= 47000 then raw_price + case when mod(raw_price::integer, 1000) = 500 then 2400 else 2900 end
        else raw_price + case when mod(raw_price::integer, 1000) = 500 then 3400 else 3900 end
      end as display_price
    from matched
  ),
  filtered as (
    select *
    from priced
    where p_max_price is null
      or display_price is null
      or display_price <= p_max_price
  )
  select
    filtered.property_id,
    count(*) over () as total_count
  from filtered
  order by
    case when p_sort = 'price_asc' then display_price end asc nulls last,
    case when p_sort = 'price_desc' then display_price end desc nulls last,
    case when p_sort = 'people_desc' then max_guests end desc nulls last,
    case when p_sort = 'bedrooms_desc' then bedrooms end desc nulls last,
    sort_order asc nulls last,
    property_id asc
  limit least(greatest(coalesce(p_limit, 12), 1), 24)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.search_public_villa_ids(
  text,
  integer,
  integer,
  integer,
  text[],
  text,
  text,
  integer,
  integer
) to anon, authenticated;

create index if not exists listings_public_search_idx
  on public.listings (is_active, location_zone, max_guests, bedrooms, sort_order, property_id);

create index if not exists listing_prices_listing_price_idx
  on public.listing_prices (listing_id, deville_price);

create index if not exists listing_facilities_listing_value_idx
  on public.listing_facilities (listing_id, value_boolean, facility_id);

notify pgrst, 'reload schema';
