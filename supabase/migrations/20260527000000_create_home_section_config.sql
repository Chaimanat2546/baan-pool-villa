create schema if not exists private;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'admin' check (role = 'admin'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.home_sections (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  mode text not null default 'manual' check (mode in ('manual', 'near_sea', 'slice')),
  limit_count integer not null default 12 check (limit_count between 1 and 12),
  cta_enabled boolean not null default false,
  cta_label text,
  cta_href text,
  fallback_mode text not null default 'none' check (fallback_mode in ('none', 'fill_from_all', 'fill_near_sea')),
  slice_offset integer not null default 0 check (slice_offset >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.home_section_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.home_sections(id) on delete cascade,
  house_id text not null check (house_id ~ '^[1-9][0-9]*$'),
  position integer not null check (position >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, house_id),
  unique (section_id, position)
);

create index if not exists home_sections_active_order_idx
  on public.home_sections (is_active, display_order, slug);

create index if not exists home_section_items_active_order_idx
  on public.home_section_items (section_id, is_active, position);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger admin_users_set_updated_at
  before update on public.admin_users
  for each row execute function private.set_updated_at();

create trigger home_sections_set_updated_at
  before update on public.home_sections
  for each row execute function private.set_updated_at();

create trigger home_section_items_set_updated_at
  before update on public.home_section_items
  for each row execute function private.set_updated_at();

create or replace function private.is_home_config_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users admin_user
    where admin_user.user_id = auth.uid()
      and admin_user.role = 'admin'
      and admin_user.is_active
  );
$$;

revoke all on function private.is_home_config_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_home_config_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.home_sections enable row level security;
alter table public.home_section_items enable row level security;

create policy "Authenticated admins can select admin users"
  on public.admin_users
  for select
  to authenticated
  using (private.is_home_config_admin());

create policy "Anon and authenticated users can select active home sections"
  on public.home_sections
  for select
  to anon, authenticated
  using (is_active);

create policy "Authenticated admins can select all home sections"
  on public.home_sections
  for select
  to authenticated
  using (private.is_home_config_admin());

create policy "Authenticated admins can insert home sections"
  on public.home_sections
  for insert
  to authenticated
  with check (private.is_home_config_admin());

create policy "Authenticated admins can update home sections"
  on public.home_sections
  for update
  to authenticated
  using (private.is_home_config_admin())
  with check (private.is_home_config_admin());

create policy "Authenticated admins can delete home sections"
  on public.home_sections
  for delete
  to authenticated
  using (private.is_home_config_admin());

create policy "Anon and authenticated users can select active home section items"
  on public.home_section_items
  for select
  to anon, authenticated
  using (
    is_active
    and exists (
      select 1
      from public.home_sections section
      where section.id = home_section_items.section_id
        and section.is_active
    )
  );

create policy "Authenticated admins can select all home section items"
  on public.home_section_items
  for select
  to authenticated
  using (private.is_home_config_admin());

create policy "Authenticated admins can insert home section items"
  on public.home_section_items
  for insert
  to authenticated
  with check (private.is_home_config_admin());

create policy "Authenticated admins can update home section items"
  on public.home_section_items
  for update
  to authenticated
  using (private.is_home_config_admin())
  with check (private.is_home_config_admin());

create policy "Authenticated admins can delete home section items"
  on public.home_section_items
  for delete
  to authenticated
  using (private.is_home_config_admin());

grant select on public.home_sections, public.home_section_items to anon, authenticated;
grant select on public.admin_users to authenticated;
grant insert, update, delete on public.home_sections, public.home_section_items to authenticated;

create or replace function private.save_home_section_snapshot(snapshot jsonb)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  sections jsonb;
begin
  if not private.is_home_config_admin() then
    raise exception 'Only home config admins can save home section snapshots'
      using errcode = '42501';
  end if;

  if jsonb_typeof(snapshot) = 'array' then
    sections := snapshot;
  elsif jsonb_typeof(snapshot) = 'object' and jsonb_typeof(snapshot -> 'sections') = 'array' then
    sections := snapshot -> 'sections';
  else
    raise exception 'Home section snapshot must be a JSON array or contain a sections array'
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
  select
    case when section ->> 'id' is null then gen_random_uuid() else (section ->> 'id')::uuid end,
    section ->> 'slug',
    section ->> 'title',
    section ->> 'description',
    coalesce((section ->> 'display_order')::integer, ordinality::integer - 1),
    coalesce((section ->> 'is_active')::boolean, true),
    coalesce(section ->> 'mode', 'manual'),
    coalesce((section ->> 'limit_count')::integer, 12),
    coalesce((section ->> 'cta_enabled')::boolean, false),
    section ->> 'cta_label',
    section ->> 'cta_href',
    coalesce(section ->> 'fallback_mode', 'none'),
    coalesce((section ->> 'slice_offset')::integer, 0)
  from jsonb_array_elements(sections) with ordinality as snapshot_section(section, ordinality);

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
