-- Homepage layout singleton and atomic section snapshot persistence.
create table public.home_page_layout (
  id text primary key default 'main' check (id = 'main'),
  layout jsonb not null check (jsonb_typeof(layout) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger home_page_layout_set_updated_at
  before update on public.home_page_layout
  for each row execute function private.set_updated_at();

alter table public.home_page_layout enable row level security;

grant select on public.home_page_layout to anon, authenticated;
revoke insert, update, delete on public.home_page_layout from anon, authenticated;
revoke all on public.home_page_layout from public;

create policy "Anon users can select home page layout"
  on public.home_page_layout
  for select
  to anon
  using (true);

create policy "Authenticated users can select home page layout"
  on public.home_page_layout
  for select
  to authenticated
  using (true);

with rails as (
  select
    jsonb_build_object(
      'kind', 'rail',
      'key', slug,
      'enabled', is_active
    ) as item,
    row_number() over (order by display_order, slug) as ordinal
  from public.home_sections
)
insert into public.home_page_layout (id, layout)
select
  'main',
  coalesce(
    (select jsonb_agg(item order by ordinal) from rails where ordinal = 1),
    '[]'::jsonb
  )
  || jsonb_build_array(
    jsonb_build_object('kind', 'fixed', 'key', 'why_choose', 'enabled', true)
  )
  || coalesce(
    (select jsonb_agg(item order by ordinal) from rails where ordinal > 1),
    '[]'::jsonb
  )
  || jsonb_build_array(
    jsonb_build_object('kind', 'fixed', 'key', 'tiktok', 'enabled', true),
    jsonb_build_object('kind', 'fixed', 'key', 'customer_reviews', 'enabled', true),
    jsonb_build_object('kind', 'fixed', 'key', 'articles', 'enabled', true),
    jsonb_build_object('kind', 'fixed', 'key', 'faq', 'enabled', true),
    jsonb_build_object('kind', 'fixed', 'key', 'contact', 'enabled', true)
  )
on conflict (id) do nothing;

create or replace function private.save_home_section_snapshot(snapshot jsonb)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  sections jsonb;
  page_layout jsonb;
begin
  if not private.is_home_config_admin() then
    raise exception 'Only home config admins can save home section snapshots'
      using errcode = '42501';
  end if;

  if jsonb_typeof(snapshot) = 'array' then
    sections := snapshot;

    with rails as (
      select
        jsonb_build_object(
          'kind', 'rail',
          'key', section ->> 'slug',
          'enabled', coalesce((section ->> 'is_active')::boolean, true)
        ) as item,
        row_number() over (
          order by
            coalesce((section ->> 'display_order')::integer, ordinality::integer - 1),
            section ->> 'slug'
        ) as ordinal
      from jsonb_array_elements(sections)
        with ordinality as snapshot_section(section, ordinality)
    )
    select
      coalesce(
        (select jsonb_agg(item order by ordinal) from rails where ordinal = 1),
        '[]'::jsonb
      )
      || jsonb_build_array(
        jsonb_build_object('kind', 'fixed', 'key', 'why_choose', 'enabled', true)
      )
      || coalesce(
        (select jsonb_agg(item order by ordinal) from rails where ordinal > 1),
        '[]'::jsonb
      )
      || jsonb_build_array(
        jsonb_build_object('kind', 'fixed', 'key', 'tiktok', 'enabled', true),
        jsonb_build_object('kind', 'fixed', 'key', 'customer_reviews', 'enabled', true),
        jsonb_build_object('kind', 'fixed', 'key', 'articles', 'enabled', true),
        jsonb_build_object('kind', 'fixed', 'key', 'faq', 'enabled', true),
        jsonb_build_object('kind', 'fixed', 'key', 'contact', 'enabled', true)
      )
    into page_layout;
  elsif
    jsonb_typeof(snapshot) = 'object'
    and jsonb_typeof(snapshot -> 'sections') = 'array'
    and jsonb_typeof(snapshot -> 'layout') = 'array'
    and (select count(*) from jsonb_object_keys(snapshot)) = 2
  then
    sections := snapshot -> 'sections';
    page_layout := snapshot -> 'layout';
  else
    raise exception 'Home section snapshot must be a JSON array or contain only sections and layout arrays'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(sections) as snapshot_section(section)
    where
      jsonb_typeof(section) is distinct from 'object'
      or jsonb_typeof(section -> 'slug') is distinct from 'string'
      or (
        section ? 'is_active'
        and jsonb_typeof(section -> 'is_active') is distinct from 'boolean'
      )
  ) then
    raise exception 'Every home section must be an object with a string slug and boolean is_active'
      using errcode = '22023';
  end if;

  if (
    select count(distinct section ->> 'slug')
    from jsonb_array_elements(sections) as snapshot_section(section)
  ) <> jsonb_array_length(sections) then
    raise exception 'Home section slugs must be unique'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(page_layout) as layout_entry(item)
    where
      jsonb_typeof(item) is distinct from 'object'
      or not (item ?& array['kind', 'key', 'enabled'])
      or (select count(*) from jsonb_object_keys(item)) <> 3
      or jsonb_typeof(item -> 'kind') is distinct from 'string'
      or jsonb_typeof(item -> 'key') is distinct from 'string'
      or jsonb_typeof(item -> 'enabled') is distinct from 'boolean'
      or item ->> 'kind' not in ('fixed', 'rail')
  ) then
    raise exception 'Every home page layout item must contain only kind, key, and enabled with valid JSON types'
      using errcode = '22023';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(page_layout) as layout_entry(item)
    where item ->> 'kind' = 'fixed'
  ) <> 6
  or (
    select count(distinct item ->> 'key')
    from jsonb_array_elements(page_layout) as layout_entry(item)
    where
      item ->> 'kind' = 'fixed'
      and item ->> 'key' in (
        'why_choose',
        'tiktok',
        'customer_reviews',
        'articles',
        'faq',
        'contact'
      )
  ) <> 6 then
    raise exception 'Home page layout must contain each fixed section exactly once'
      using errcode = '22023';
  end if;

  if (
    select count(distinct concat(item ->> 'kind', ':', item ->> 'key'))
    from jsonb_array_elements(page_layout) as layout_entry(item)
  ) <> jsonb_array_length(page_layout) then
    raise exception 'Home page layout identities must be unique'
      using errcode = '22023';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(page_layout) as layout_entry(item)
    where item ->> 'kind' = 'rail'
  ) <> jsonb_array_length(sections)
  or exists (
    select 1
    from jsonb_array_elements(sections) as snapshot_section(section)
    where (
      select count(*)
      from jsonb_array_elements(page_layout) as layout_entry(item)
      where
        item ->> 'kind' = 'rail'
        and item ->> 'key' = section ->> 'slug'
    ) <> 1
  )
  or exists (
    select 1
    from jsonb_array_elements(page_layout) as layout_entry(item)
    where
      item ->> 'kind' = 'rail'
      and not exists (
        select 1
        from jsonb_array_elements(sections) as snapshot_section(section)
        where section ->> 'slug' = item ->> 'key'
      )
  ) then
    raise exception 'Home page layout must contain exactly one rail for every submitted home section'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(page_layout) as layout_entry(item)
    join jsonb_array_elements(sections) as snapshot_section(section)
      on section ->> 'slug' = item ->> 'key'
    where
      item ->> 'kind' = 'rail'
      and (item ->> 'enabled')::boolean
        is distinct from coalesce((section ->> 'is_active')::boolean, true)
  ) then
    raise exception 'Home page rail enabled values must match home section is_active values'
      using errcode = '22023';
  end if;

  delete from public.home_section_items
  where id is not null;

  delete from public.home_sections
  where id is not null;

  insert into public.home_sections (
    id,
    slug,
    title,
    description,
    display_order,
    is_active,
    mode,
    limit_count,
    cta_enabled,
    cta_label,
    cta_href,
    fallback_mode,
    slice_offset
  )
  with rail_order as (
    select
      item ->> 'key' as slug,
      (row_number() over (order by layout_ordinality) - 1)::integer as display_order
    from jsonb_array_elements(page_layout)
      with ordinality as layout_entry(item, layout_ordinality)
    where item ->> 'kind' = 'rail'
  )
  select
    case when section ->> 'id' is null then gen_random_uuid() else (section ->> 'id')::uuid end,
    section ->> 'slug',
    section ->> 'title',
    section ->> 'description',
    rail_order.display_order,
    coalesce((section ->> 'is_active')::boolean, true),
    coalesce(section ->> 'mode', 'manual'),
    coalesce((section ->> 'limit_count')::integer, 12),
    coalesce((section ->> 'cta_enabled')::boolean, false),
    section ->> 'cta_label',
    section ->> 'cta_href',
    coalesce(section ->> 'fallback_mode', 'none'),
    coalesce((section ->> 'slice_offset')::integer, 0)
  from jsonb_array_elements(sections) as snapshot_section(section)
  join rail_order
    on rail_order.slug = section ->> 'slug';

  insert into public.home_section_items (
    id,
    section_id,
    house_id,
    position,
    is_active
  )
  select
    case when item ->> 'id' is null then gen_random_uuid() else (item ->> 'id')::uuid end,
    home_sections.id,
    item ->> 'house_id',
    coalesce((item ->> 'position')::integer, item_ordinality::integer - 1),
    coalesce((item ->> 'is_active')::boolean, true)
  from jsonb_array_elements(sections) as snapshot_section(section)
  join public.home_sections
    on home_sections.slug = section ->> 'slug'
  cross join lateral jsonb_array_elements(coalesce(section -> 'items', '[]'::jsonb))
    with ordinality as snapshot_item(item, item_ordinality);

  insert into public.home_page_layout (id, layout)
  values ('main', page_layout)
  on conflict (id) do update
  set layout = excluded.layout;
end;
$$;

revoke all on function private.save_home_section_snapshot(jsonb) from public;
grant execute on function private.save_home_section_snapshot(jsonb) to authenticated;

create or replace function public.save_home_section_snapshot(snapshot jsonb)
returns void
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  perform private.save_home_section_snapshot(snapshot);
end;
$$;

revoke all on function public.save_home_section_snapshot(jsonb) from public;
grant execute on function public.save_home_section_snapshot(jsonb) to authenticated;

notify pgrst, 'reload schema';
