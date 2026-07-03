-- Bootstrap migration for a standalone Baan Pool Villa site-settings Supabase project.
-- Run this against the new site-settings/CMS/admin project only.
-- Intentionally excludes villa catalog/search migrations.


-- BEGIN supabase/migrations/20260527000000_create_home_section_config.sql
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

-- END supabase/migrations/20260527000000_create_home_section_config.sql

-- BEGIN supabase/migrations/20260528000000_create_site_settings.sql
create table if not exists public.site_settings (
  id text primary key,
  site_name text not null,
  primary_color text not null,
  accent_color text not null,
  header_link_color text not null default '#ffffff',
  header_link_hover_color text not null default '#eab308',
  footer_link_color text not null default '#ffffff',
  footer_link_hover_color text not null default '#eab308',
  bank_highlight_color text not null default '#eab308',
  bank_account_highlight_color text not null default '#eab308',
  bank_name_highlight_color text not null default '#eab308',
  bank_number_highlight_color text not null default '#eab308',
  logo_background text not null default 'white',
  logo_image_path text,
  logo_image_url text,
  hero_image_path text,
  hero_image_url text,
  hero_image_alt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_settings_id_global check (id = 'global'),
  constraint site_settings_primary_color_hex check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint site_settings_accent_color_hex check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint site_settings_header_link_color_hex check (header_link_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint site_settings_header_link_hover_color_hex check (header_link_hover_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint site_settings_footer_link_color_hex check (footer_link_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint site_settings_footer_link_hover_color_hex check (footer_link_hover_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint site_settings_bank_highlight_color_hex check (bank_highlight_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint site_settings_bank_account_highlight_color_hex check (bank_account_highlight_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint site_settings_bank_name_highlight_color_hex check (bank_name_highlight_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint site_settings_bank_number_highlight_color_hex check (bank_number_highlight_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint site_settings_logo_background_allowed check (logo_background in ('white', 'transparent', 'primary', 'soft'))
);

create table if not exists public.site_asset_uploads (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null check (asset_type in ('logo', 'hero')),
  storage_bucket text not null,
  storage_path text not null,
  public_url text not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists site_asset_uploads_type_created_idx
  on public.site_asset_uploads (asset_type, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'site_settings_set_updated_at'
      and tgrelid = 'public.site_settings'::regclass
  ) then
    create trigger site_settings_set_updated_at
      before update on public.site_settings
      for each row execute function private.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'site_asset_uploads_set_updated_at'
      and tgrelid = 'public.site_asset_uploads'::regclass
  ) then
    create trigger site_asset_uploads_set_updated_at
      before update on public.site_asset_uploads
      for each row execute function private.set_updated_at();
  end if;
end;
$$;

alter table public.site_settings enable row level security;
alter table public.site_asset_uploads enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_settings'
      and policyname = 'Anon and authenticated users can select site settings'
  ) then
    create policy "Anon and authenticated users can select site settings"
      on public.site_settings
      for select
      to anon, authenticated
      using (id = 'global');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_settings'
      and policyname = 'Authenticated admins can insert site settings'
  ) then
    create policy "Authenticated admins can insert site settings"
      on public.site_settings
      for insert
      to authenticated
      with check (private.is_home_config_admin() and id = 'global');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_settings'
      and policyname = 'Authenticated admins can update site settings'
  ) then
    create policy "Authenticated admins can update site settings"
      on public.site_settings
      for update
      to authenticated
      using (private.is_home_config_admin() and id = 'global')
      with check (private.is_home_config_admin() and id = 'global');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_settings'
      and policyname = 'Authenticated admins can delete site settings'
  ) then
    create policy "Authenticated admins can delete site settings"
      on public.site_settings
      for delete
      to authenticated
      using (private.is_home_config_admin() and id = 'global');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_asset_uploads'
      and policyname = 'Anon and authenticated users can select current site asset uploads'
  ) then
    create policy "Anon and authenticated users can select current site asset uploads"
      on public.site_asset_uploads
      for select
      to anon, authenticated
      using (is_current);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_asset_uploads'
      and policyname = 'Authenticated admins can select all site asset uploads'
  ) then
    create policy "Authenticated admins can select all site asset uploads"
      on public.site_asset_uploads
      for select
      to authenticated
      using (private.is_home_config_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_asset_uploads'
      and policyname = 'Authenticated admins can insert site asset uploads'
  ) then
    create policy "Authenticated admins can insert site asset uploads"
      on public.site_asset_uploads
      for insert
      to authenticated
      with check (
        private.is_home_config_admin()
        and storage_bucket = 'site-assets'
        and (
          storage_path like 'hero/%'
          or storage_path like 'logo/%'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_asset_uploads'
      and policyname = 'Authenticated admins can update site asset uploads'
  ) then
    create policy "Authenticated admins can update site asset uploads"
      on public.site_asset_uploads
      for update
      to authenticated
      using (private.is_home_config_admin())
      with check (
        private.is_home_config_admin()
        and storage_bucket = 'site-assets'
        and (
          storage_path like 'hero/%'
          or storage_path like 'logo/%'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_asset_uploads'
      and policyname = 'Authenticated admins can delete site asset uploads'
  ) then
    create policy "Authenticated admins can delete site asset uploads"
      on public.site_asset_uploads
      for delete
      to authenticated
      using (private.is_home_config_admin());
  end if;
end;
$$;

grant select on public.site_settings, public.site_asset_uploads to anon, authenticated;
grant insert, update, delete on public.site_settings, public.site_asset_uploads to authenticated;

insert into public.site_settings (
  id,
  site_name,
  primary_color,
  accent_color,
  header_link_color,
  header_link_hover_color,
  footer_link_color,
  footer_link_hover_color,
  bank_highlight_color,
  bank_account_highlight_color,
  bank_name_highlight_color,
  bank_number_highlight_color,
  logo_background,
  logo_image_path,
  logo_image_url,
  hero_image_path,
  hero_image_url,
  hero_image_alt
)
values (
  'global',
  'Pool Villas Pattaya',
  '#064e3b',
  '#eab308',
  '#ffffff',
  '#eab308',
  '#ffffff',
  '#eab308',
  '#eab308',
  '#eab308',
  '#eab308',
  '#eab308',
  'white',
  '/images/logo.jpg',
  '/images/logo.jpg',
  '/images/BPV-66_Cover-Web.jpg',
  '/images/BPV-66_Cover-Web.jpg',
  'Pool Villa บ้านพูลวิลล่า พัทยา'
)
on conflict (id) do nothing;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'site-assets',
  'site-assets',
  true,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public can read site assets'
  ) then
    create policy "Public can read site assets"
      on storage.objects
      for select
      to anon, authenticated
      using (bucket_id = 'site-assets');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated admins can insert site assets'
  ) then
    create policy "Authenticated admins can insert site assets"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'site-assets'
        and private.is_home_config_admin()
        and (
          name like 'hero/%'
          or name like 'logo/%'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated admins can update site assets'
  ) then
    create policy "Authenticated admins can update site assets"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'site-assets'
        and private.is_home_config_admin()
        and (
          name like 'hero/%'
          or name like 'logo/%'
        )
      )
      with check (
        bucket_id = 'site-assets'
        and private.is_home_config_admin()
        and (
          name like 'hero/%'
          or name like 'logo/%'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated admins can delete site assets'
  ) then
    create policy "Authenticated admins can delete site assets"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'site-assets'
        and private.is_home_config_admin()
        and (
          name like 'hero/%'
          or name like 'logo/%'
        )
      );
  end if;
end;
$$;

grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

notify pgrst, 'reload schema';

-- END supabase/migrations/20260528000000_create_site_settings.sql

-- BEGIN supabase/migrations/20260529000000_add_site_contact_settings.sql
alter table public.site_settings
  add column if not exists bank_account_name text not null default 'คุณ อาภัสรา จินดาวา',
  add column if not exists bank_name text not null default 'ธนาคารกสิกรไทย',
  add column if not exists bank_account_number text not null default '398-289-7482',
  add column if not exists phone_contacts jsonb not null default
    '[
      {
        "name": "คุณเกม",
        "phone": "0617485213",
        "time": "ช่วง 07.00-15.00"
      },
      {
        "name": "คุณโก้",
        "phone": "0657329919",
        "time": "ช่วง 16.00-02.00"
      }
    ]'::jsonb,
  add column if not exists messenger_url text not null default 'https://www.facebook.com/baanpoolvillas',
  add column if not exists line_id text not null default '@baanpoolvilla',
  add column if not exists line_url text not null default 'https://line.me/R/ti/p/@baanpoolvilla';

update public.site_settings
set
  bank_account_name = 'คุณ อาภัสรา จินดาวา',
  bank_name = 'ธนาคารกสิกรไทย',
  bank_account_number = '398-289-7482',
  phone_contacts = '[
    {
      "name": "คุณเกม",
      "phone": "0617485213",
      "time": "ช่วง 07.00-15.00"
    },
    {
      "name": "คุณโก้",
      "phone": "0657329919",
      "time": "ช่วง 16.00-02.00"
    }
  ]'::jsonb,
  messenger_url = 'https://www.facebook.com/baanpoolvillas',
  line_id = '@baanpoolvilla',
  line_url = 'https://line.me/R/ti/p/@baanpoolvilla'
where id = 'global'
  and (
    bank_account_name = ''
    or bank_name = ''
    or bank_account_number = ''
    or phone_contacts = '[]'::jsonb
    or messenger_url = ''
    or line_id = ''
    or line_url = ''
  );

notify pgrst, 'reload schema';

-- END supabase/migrations/20260529000000_add_site_contact_settings.sql

-- BEGIN supabase/migrations/20260529034902_fix_advisor_warnings.sql
drop policy if exists "Anon and authenticated users can select active home sections"
  on public.home_sections;
drop policy if exists "Authenticated admins can select all home sections"
  on public.home_sections;

create policy "Anon users can select active home sections"
  on public.home_sections
  for select
  to anon
  using (is_active);

create policy "Authenticated users can select visible home sections"
  on public.home_sections
  for select
  to authenticated
  using (is_active or private.is_home_config_admin());

drop policy if exists "Anon and authenticated users can select active home section items"
  on public.home_section_items;
drop policy if exists "Authenticated admins can select all home section items"
  on public.home_section_items;

create policy "Anon users can select active home section items"
  on public.home_section_items
  for select
  to anon
  using (
    is_active
    and exists (
      select 1
      from public.home_sections section
      where section.id = home_section_items.section_id
        and section.is_active
    )
  );

create policy "Authenticated users can select visible home section items"
  on public.home_section_items
  for select
  to authenticated
  using (
    (
      is_active
      and exists (
        select 1
        from public.home_sections section
        where section.id = home_section_items.section_id
          and section.is_active
      )
    )
    or private.is_home_config_admin()
  );

drop policy if exists "Anon and authenticated users can select current site asset uploads"
  on public.site_asset_uploads;
drop policy if exists "Authenticated admins can select all site asset uploads"
  on public.site_asset_uploads;

create policy "Anon users can select current site asset uploads"
  on public.site_asset_uploads
  for select
  to anon
  using (is_current);

create policy "Authenticated users can select visible site asset uploads"
  on public.site_asset_uploads
  for select
  to authenticated
  using (is_current or private.is_home_config_admin());

drop policy if exists "Public can read site assets"
  on storage.objects;

notify pgrst, 'reload schema';

-- END supabase/migrations/20260529034902_fix_advisor_warnings.sql

-- BEGIN supabase/migrations/20260529042000_fix_global_site_contact_values.sql
-- Correct the existing online global settings row after the contact columns were added.
update public.site_settings
set
  bank_account_name = 'คุณ อาภัสรา จินดาวา',
  bank_name = 'ธนาคารกสิกรไทย',
  bank_account_number = '398-289-7482',
  phone_contacts = jsonb_build_array(
    jsonb_build_object('name', 'คุณเกม', 'phone', '0617485213', 'time', 'ช่วง 07.00-15.00'),
    jsonb_build_object('name', 'คุณโก้', 'phone', '0657329919', 'time', 'ช่วง 16.00-02.00')
  ),
  messenger_url = 'https://www.facebook.com/baanpoolvillas',
  line_id = '@baanpoolvilla',
  line_url = 'https://line.me/R/ti/p/@baanpoolvilla'
where id = 'global';

notify pgrst, 'reload schema';

-- END supabase/migrations/20260529042000_fix_global_site_contact_values.sql

-- BEGIN supabase/migrations/20260529054138_add_site_seo_settings.sql
alter table public.site_settings
  add column if not exists seo_title text not null default 'Pool Villas Pattaya | บ้านพักพูลวิลล่าพัทยา',
  add column if not exists seo_description text not null default 'รวมบ้านพักพูลวิลล่าพัทยา บ้านพักสระส่วนตัวสำหรับครอบครัว กลุ่มเพื่อน และทริปปาร์ตี้ เลือกทำเล จำนวนคน ห้องนอน ราคา และดูบ้านพักใกล้ทะเลได้ง่าย',
  add column if not exists seo_og_image_url text not null default '/images/BPV-66_Cover-Web.jpg',
  add column if not exists seo_og_image_alt text not null default 'Pool Villa บ้านพูลวิลล่า พัทยา',
  add column if not exists seo_business_name text not null default 'Pool Villas Pattaya',
  add column if not exists seo_same_as_urls jsonb not null default '["https://www.facebook.com/baanpoolvillas","https://line.me/R/ti/p/@baanpoolvilla"]'::jsonb;

update public.site_settings
set
  seo_title = coalesce(nullif(trim(seo_title), ''), 'Pool Villas Pattaya | บ้านพักพูลวิลล่าพัทยา'),
  seo_description = coalesce(nullif(trim(seo_description), ''), 'รวมบ้านพักพูลวิลล่าพัทยา บ้านพักสระส่วนตัวสำหรับครอบครัว กลุ่มเพื่อน และทริปปาร์ตี้ เลือกทำเล จำนวนคน ห้องนอน ราคา และดูบ้านพักใกล้ทะเลได้ง่าย'),
  seo_og_image_url = coalesce(nullif(trim(seo_og_image_url), ''), '/images/BPV-66_Cover-Web.jpg'),
  seo_og_image_alt = coalesce(nullif(trim(seo_og_image_alt), ''), 'Pool Villa บ้านพูลวิลล่า พัทยา'),
  seo_business_name = coalesce(nullif(trim(seo_business_name), ''), 'Pool Villas Pattaya'),
  seo_same_as_urls = case
    when jsonb_typeof(seo_same_as_urls) = 'array' then
      case
        when jsonb_array_length(seo_same_as_urls) > 0 then seo_same_as_urls
        else '["https://www.facebook.com/baanpoolvillas","https://line.me/R/ti/p/@baanpoolvilla"]'::jsonb
      end
    else '["https://www.facebook.com/baanpoolvillas","https://line.me/R/ti/p/@baanpoolvilla"]'::jsonb
  end
where id = 'global';

notify pgrst, 'reload schema';

-- END supabase/migrations/20260529054138_add_site_seo_settings.sql

-- BEGIN supabase/migrations/20260529072000_relax_home_section_limit_count.sql
alter table public.home_sections
  drop constraint if exists home_sections_limit_count_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'home_sections_limit_count_positive_check'
      and conrelid = 'public.home_sections'::regclass
  ) then
    alter table public.home_sections
      add constraint home_sections_limit_count_positive_check
      check (limit_count >= 1);
  end if;
end;
$$;

notify pgrst, 'reload schema';

-- END supabase/migrations/20260529072000_relax_home_section_limit_count.sql

-- BEGIN supabase/migrations/20260529090000_add_detail_layout_settings.sql
alter table public.site_settings
  add column if not exists detail_layout jsonb not null default '{
    "version": 1,
    "lockedTop": ["gallery", "intro"],
    "rows": [
      {
        "id": "row_details_booking",
        "columns": 2,
        "ratio": "70/30",
        "enabled": true,
        "blocks": [
          { "type": "details", "title": "รายละเอียดบ้านพัก", "enabled": true, "hideWhenEmpty": true },
          { "type": "booking_contact", "title": "จอง / ติดต่อ", "enabled": true, "hideWhenEmpty": false }
        ]
      },
      {
        "id": "row_bedroom_pool",
        "columns": 2,
        "ratio": "50/50",
        "enabled": true,
        "blocks": [
          { "type": "bedrooms", "title": "รายละเอียดห้องนอน", "enabled": true, "hideWhenEmpty": true },
          { "type": "pool", "title": "สระว่ายน้ำ", "enabled": true, "hideWhenEmpty": true }
        ]
      },
      {
        "id": "row_kitchen_amenities_images",
        "columns": 3,
        "enabled": true,
        "blocks": [
          { "type": "kitchen", "title": "ครัวและอุปกรณ์", "enabled": true, "hideWhenEmpty": true },
          { "type": "amenities", "title": "สิ่งอำนวยความสะดวก", "enabled": true, "hideWhenEmpty": true },
          { "type": "categorized_images", "title": "รูปภาพตามหมวด", "enabled": true, "hideWhenEmpty": true }
        ]
      },
      {
        "id": "row_costs_rules",
        "columns": 2,
        "ratio": "70/30",
        "enabled": true,
        "blocks": [
          { "type": "costs_promotions", "title": "ค่าใช้จ่าย / โปรโมชัน", "enabled": true, "hideWhenEmpty": true },
          { "type": "rules_pet_policy", "title": "กฎบ้านพัก / สัตว์เลี้ยง", "enabled": true, "hideWhenEmpty": true }
        ]
      },
      {
        "id": "row_map_video",
        "columns": 2,
        "ratio": "60/40",
        "enabled": true,
        "blocks": [
          { "type": "map_nearby", "title": "แผนที่ / สถานที่ใกล้เคียง", "enabled": true, "hideWhenEmpty": true },
          { "type": "review_videos", "title": "คลิปรีวิว", "enabled": true, "hideWhenEmpty": true }
        ]
      },
      {
        "id": "row_recommended",
        "columns": 1,
        "enabled": true,
        "blocks": [
          { "type": "recommended_villas", "title": "บ้านพักแนะนำ", "enabled": true, "hideWhenEmpty": true }
        ]
      }
    ]
  }'::jsonb;

notify pgrst, 'reload schema';

-- END supabase/migrations/20260529090000_add_detail_layout_settings.sql

-- BEGIN supabase/migrations/20260603000000_create_guide_cms.sql
create table if not exists public.guide_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (length(trim(slug)) > 0),
  title text not null check (length(trim(title)) > 0),
  excerpt text not null default '',
  cover_image_path text,
  cover_image_url text,
  cover_image_alt text,
  content_blocks jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  recommended_house_ids text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  is_pinned boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guide_posts_content_blocks_array
    check (jsonb_typeof(content_blocks) = 'array'),
  constraint guide_posts_publish_ready
    check (
      status <> 'published'
      or (
        length(trim(excerpt)) > 0
        and cover_image_url is not null
        and length(trim(cover_image_url)) > 0
        and cover_image_alt is not null
        and length(trim(cover_image_alt)) > 0
        and jsonb_array_length(content_blocks) > 0
        and array_length(recommended_house_ids, 1) > 0
      )
    )
);

create table if not exists public.guide_asset_uploads (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid references public.guide_posts(id) on delete set null,
  asset_role text not null default 'inline' check (asset_role in ('cover', 'inline')),
  storage_bucket text not null,
  storage_path text not null,
  public_url text not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists guide_posts_public_order_idx
  on public.guide_posts (status, is_pinned desc, published_at desc, updated_at desc);

create index if not exists guide_posts_slug_status_idx
  on public.guide_posts (slug, status);

create index if not exists guide_asset_uploads_guide_created_idx
  on public.guide_asset_uploads (guide_id, asset_role, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'guide_posts_set_updated_at'
      and tgrelid = 'public.guide_posts'::regclass
  ) then
    create trigger guide_posts_set_updated_at
      before update on public.guide_posts
      for each row execute function private.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'guide_asset_uploads_set_updated_at'
      and tgrelid = 'public.guide_asset_uploads'::regclass
  ) then
    create trigger guide_asset_uploads_set_updated_at
      before update on public.guide_asset_uploads
      for each row execute function private.set_updated_at();
  end if;
end;
$$;

alter table public.guide_posts enable row level security;
alter table public.guide_asset_uploads enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guide_posts'
      and policyname = 'Anon users can select published guide posts'
  ) then
    create policy "Anon users can select published guide posts"
      on public.guide_posts
      for select
      to anon
      using (status = 'published');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guide_posts'
      and policyname = 'Authenticated users can select visible guide posts'
  ) then
    create policy "Authenticated users can select visible guide posts"
      on public.guide_posts
      for select
      to authenticated
      using (status = 'published' or private.is_home_config_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guide_posts'
      and policyname = 'Authenticated admins can insert guide posts'
  ) then
    create policy "Authenticated admins can insert guide posts"
      on public.guide_posts
      for insert
      to authenticated
      with check (private.is_home_config_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guide_posts'
      and policyname = 'Authenticated admins can update guide posts'
  ) then
    create policy "Authenticated admins can update guide posts"
      on public.guide_posts
      for update
      to authenticated
      using (private.is_home_config_admin())
      with check (private.is_home_config_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guide_posts'
      and policyname = 'Authenticated admins can delete guide posts'
  ) then
    create policy "Authenticated admins can delete guide posts"
      on public.guide_posts
      for delete
      to authenticated
      using (private.is_home_config_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guide_asset_uploads'
      and policyname = 'Authenticated admins can select guide asset uploads'
  ) then
    create policy "Authenticated admins can select guide asset uploads"
      on public.guide_asset_uploads
      for select
      to authenticated
      using (private.is_home_config_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guide_asset_uploads'
      and policyname = 'Authenticated admins can insert guide asset uploads'
  ) then
    create policy "Authenticated admins can insert guide asset uploads"
      on public.guide_asset_uploads
      for insert
      to authenticated
      with check (
        private.is_home_config_admin()
        and storage_bucket = 'guide-assets'
        and storage_path like 'guides/%'
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guide_asset_uploads'
      and policyname = 'Authenticated admins can update guide asset uploads'
  ) then
    create policy "Authenticated admins can update guide asset uploads"
      on public.guide_asset_uploads
      for update
      to authenticated
      using (private.is_home_config_admin())
      with check (
        private.is_home_config_admin()
        and storage_bucket = 'guide-assets'
        and storage_path like 'guides/%'
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guide_asset_uploads'
      and policyname = 'Authenticated admins can delete guide asset uploads'
  ) then
    create policy "Authenticated admins can delete guide asset uploads"
      on public.guide_asset_uploads
      for delete
      to authenticated
      using (private.is_home_config_admin());
  end if;
end;
$$;

grant select on public.guide_posts to anon, authenticated;
grant select on public.guide_asset_uploads to authenticated;
grant insert, update, delete on public.guide_posts, public.guide_asset_uploads to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'guide-assets',
  'guide-assets',
  true,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated admins can insert guide assets'
  ) then
    create policy "Authenticated admins can insert guide assets"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'guide-assets'
        and private.is_home_config_admin()
        and name like 'guides/%'
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated admins can update guide assets'
  ) then
    create policy "Authenticated admins can update guide assets"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'guide-assets'
        and private.is_home_config_admin()
        and name like 'guides/%'
      )
      with check (
        bucket_id = 'guide-assets'
        and private.is_home_config_admin()
        and name like 'guides/%'
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated admins can delete guide assets'
  ) then
    create policy "Authenticated admins can delete guide assets"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'guide-assets'
        and private.is_home_config_admin()
        and name like 'guides/%'
      );
  end if;
end;
$$;

grant insert, update, delete on storage.objects to authenticated;

notify pgrst, 'reload schema';

-- END supabase/migrations/20260603000000_create_guide_cms.sql

-- BEGIN supabase/migrations/20260603090000_add_site_tiktok_settings.sql
alter table public.site_settings
  add column if not exists tiktok_account_url text not null default '',
  add column if not exists tiktok_video_urls jsonb not null default '[]'::jsonb;

update public.site_settings
set
  tiktok_account_url = coalesce(nullif(trim(tiktok_account_url), ''), ''),
  tiktok_video_urls = case
    when jsonb_typeof(tiktok_video_urls) = 'array' then tiktok_video_urls
    else '[]'::jsonb
  end
where id = 'global';

notify pgrst, 'reload schema';

-- END supabase/migrations/20260603090000_add_site_tiktok_settings.sql

-- BEGIN supabase/migrations/20260608163000_add_site_section_seo_settings.sql
alter table public.site_settings
  add column if not exists search_seo_title text not null default 'ค้นหาบ้านพักพูลวิลล่าพัทยา',
  add column if not exists search_seo_description text not null default 'ค้นหาบ้านพักพูลวิลล่าพัทยาด้วยทำเล จำนวนผู้เข้าพัก ห้องนอน ราคา สิ่งอำนวยความสะดวก รหัสบ้าน และการเรียงลำดับที่ต้องการ',
  add column if not exists search_seo_og_image_url text not null default '/images/BPV-66_Cover-Web.jpg',
  add column if not exists search_seo_og_image_alt text not null default 'Pool Villa บ้านพูลวิลล่า พัทยา',
  add column if not exists guides_seo_title text not null default 'บทความแนะนำบ้านพักพูลวิลล่าพัทยา',
  add column if not exists guides_seo_description text not null default 'บทความแนะนำบ้านพักพูลวิลล่าพัทยา วิธีเลือกบ้านพัก และการเตรียมตัวก่อนเที่ยว',
  add column if not exists guides_seo_og_image_url text not null default '/images/BPV-66_Cover-Web.jpg',
  add column if not exists guides_seo_og_image_alt text not null default 'Pool Villa บ้านพูลวิลล่า พัทยา';

update public.site_settings
set
  search_seo_title = coalesce(nullif(trim(search_seo_title), ''), 'ค้นหาบ้านพักพูลวิลล่าพัทยา'),
  search_seo_description = coalesce(
    nullif(trim(search_seo_description), ''),
    'ค้นหาบ้านพักพูลวิลล่าพัทยาด้วยทำเล จำนวนผู้เข้าพัก ห้องนอน ราคา สิ่งอำนวยความสะดวก รหัสบ้าน และการเรียงลำดับที่ต้องการ'
  ),
  search_seo_og_image_url = coalesce(nullif(trim(search_seo_og_image_url), ''), '/images/BPV-66_Cover-Web.jpg'),
  search_seo_og_image_alt = coalesce(nullif(trim(search_seo_og_image_alt), ''), 'Pool Villa บ้านพูลวิลล่า พัทยา'),
  guides_seo_title = coalesce(nullif(trim(guides_seo_title), ''), 'บทความแนะนำบ้านพักพูลวิลล่าพัทยา'),
  guides_seo_description = coalesce(
    nullif(trim(guides_seo_description), ''),
    'บทความแนะนำบ้านพักพูลวิลล่าพัทยา วิธีเลือกบ้านพัก และการเตรียมตัวก่อนเที่ยว'
  ),
  guides_seo_og_image_url = coalesce(nullif(trim(guides_seo_og_image_url), ''), '/images/BPV-66_Cover-Web.jpg'),
  guides_seo_og_image_alt = coalesce(nullif(trim(guides_seo_og_image_alt), ''), 'Pool Villa บ้านพูลวิลล่า พัทยา')
where id = 'global';

notify pgrst, 'reload schema';

-- END supabase/migrations/20260608163000_add_site_section_seo_settings.sql

-- BEGIN supabase/migrations/20260608163001_create_legal_pages.sql
create table if not exists public.legal_pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug in ('terms', 'privacy')),
  title text not null check (length(trim(title)) > 0),
  seo_description text not null default '',
  content_blocks jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_pages_content_blocks_array
    check (jsonb_typeof(content_blocks) = 'array'),
  constraint legal_pages_publish_ready
    check (
      status <> 'published'
      or (
        length(trim(title)) > 0
        and jsonb_array_length(content_blocks) > 0
      )
    )
);

create index if not exists legal_pages_public_slug_idx
  on public.legal_pages (slug, status);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'legal_pages_set_updated_at'
      and tgrelid = 'public.legal_pages'::regclass
  ) then
    create trigger legal_pages_set_updated_at
      before update on public.legal_pages
      for each row execute function private.set_updated_at();
  end if;
end;
$$;

alter table public.legal_pages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'legal_pages'
      and policyname = 'Anon users can select published legal pages'
  ) then
    create policy "Anon users can select published legal pages"
      on public.legal_pages
      for select
      to anon
      using (status = 'published');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'legal_pages'
      and policyname = 'Authenticated users can select visible legal pages'
  ) then
    create policy "Authenticated users can select visible legal pages"
      on public.legal_pages
      for select
      to authenticated
      using (status = 'published' or private.is_home_config_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'legal_pages'
      and policyname = 'Authenticated admins can insert legal pages'
  ) then
    create policy "Authenticated admins can insert legal pages"
      on public.legal_pages
      for insert
      to authenticated
      with check (private.is_home_config_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'legal_pages'
      and policyname = 'Authenticated admins can update legal pages'
  ) then
    create policy "Authenticated admins can update legal pages"
      on public.legal_pages
      for update
      to authenticated
      using (private.is_home_config_admin())
      with check (private.is_home_config_admin());
  end if;
end;
$$;

grant select on public.legal_pages to anon, authenticated;
grant insert, update on public.legal_pages to authenticated;

insert into public.legal_pages (
  slug,
  title,
  seo_description,
  content_blocks,
  status,
  published_at
)
values
  (
    'terms',
    'Terms and Conditions',
    'Booking terms and conditions for Baan Pool Villa.',
    '[{"type":"paragraph","content":[{"type":"text","text":"Please contact us for the latest booking terms."}]}]'::jsonb,
    'published',
    now()
  ),
  (
    'privacy',
    'Privacy Policy',
    'Privacy policy for Baan Pool Villa.',
    '[{"type":"paragraph","content":[{"type":"text","text":"Please contact us for the latest privacy policy."}]}]'::jsonb,
    'published',
    now()
  )
on conflict (slug) do nothing;

notify pgrst, 'reload schema';

-- END supabase/migrations/20260608163001_create_legal_pages.sql

-- BEGIN supabase/migrations/20260611120000_add_site_seo_keywords.sql
alter table public.site_settings
  add column if not exists seo_keywords jsonb not null default '["บ้านพักพูลวิลล่า","พูลวิลล่าพัทยา","บ้านพูลวิลล่าพัทยา","บ้านพักพูลวิลล่าพัทยา","บ้านพักสระส่วนตัว","พูลวิลล่าใกล้ทะเล","บ้านพักพัทยา","พูลวิลล่าจอมเทียน","พูลวิลล่าบางแสน","พูลวิลล่าหัวหิน"]'::jsonb,
  add column if not exists search_seo_keywords jsonb not null default '["ค้นหาพูลวิลล่าพัทยา","ค้นหาบ้านพักพูลวิลล่า","บ้านพักพูลวิลล่าตามราคา","พูลวิลล่าตามจำนวนคน","พูลวิลล่าตามทำเล"]'::jsonb,
  add column if not exists guides_seo_keywords jsonb not null default '["บทความพูลวิลล่าพัทยา","คู่มือเลือกพูลวิลล่า","แนะนำบ้านพักพูลวิลล่า","เที่ยวพัทยาพักพูลวิลล่า"]'::jsonb,
  add column if not exists villa_detail_seo_keywords jsonb not null default '["รายละเอียดพูลวิลล่าพัทยา","จองพูลวิลล่าพัทยา","บ้านพักพูลวิลล่ารายหลัง","พูลวิลล่าสระส่วนตัว"]'::jsonb;

update public.site_settings
set
  seo_keywords = case
    when jsonb_typeof(seo_keywords) = 'array' and jsonb_array_length(seo_keywords) > 0
      then seo_keywords
    else '["บ้านพักพูลวิลล่า","พูลวิลล่าพัทยา","บ้านพูลวิลล่าพัทยา","บ้านพักพูลวิลล่าพัทยา","บ้านพักสระส่วนตัว","พูลวิลล่าใกล้ทะเล","บ้านพักพัทยา","พูลวิลล่าจอมเทียน","พูลวิลล่าบางแสน","พูลวิลล่าหัวหิน"]'::jsonb
  end,
  search_seo_keywords = case
    when jsonb_typeof(search_seo_keywords) = 'array'
      then search_seo_keywords
    else '["ค้นหาพูลวิลล่าพัทยา","ค้นหาบ้านพักพูลวิลล่า","บ้านพักพูลวิลล่าตามราคา","พูลวิลล่าตามจำนวนคน","พูลวิลล่าตามทำเล"]'::jsonb
  end,
  guides_seo_keywords = case
    when jsonb_typeof(guides_seo_keywords) = 'array'
      then guides_seo_keywords
    else '["บทความพูลวิลล่าพัทยา","คู่มือเลือกพูลวิลล่า","แนะนำบ้านพักพูลวิลล่า","เที่ยวพัทยาพักพูลวิลล่า"]'::jsonb
  end,
  villa_detail_seo_keywords = case
    when jsonb_typeof(villa_detail_seo_keywords) = 'array'
      then villa_detail_seo_keywords
    else '["รายละเอียดพูลวิลล่าพัทยา","จองพูลวิลล่าพัทยา","บ้านพักพูลวิลล่ารายหลัง","พูลวิลล่าสระส่วนตัว"]'::jsonb
  end
where id is not null;

notify pgrst, 'reload schema';

-- END supabase/migrations/20260611120000_add_site_seo_keywords.sql

-- BEGIN supabase/migrations/20260623010000_add_site_seo_share_asset_uploads.sql
alter table public.site_asset_uploads
  drop constraint if exists site_asset_uploads_asset_type_check;

alter table public.site_asset_uploads
  add constraint site_asset_uploads_asset_type_check
  check (
    asset_type in (
      'logo',
      'hero',
      'seo-og',
      'search-seo-og',
      'guides-seo-og'
    )
  );

drop policy if exists "Authenticated admins can insert site asset uploads"
  on public.site_asset_uploads;

create policy "Authenticated admins can insert site asset uploads"
  on public.site_asset_uploads
  for insert
  to authenticated
  with check (
    private.is_home_config_admin()
    and storage_bucket = 'site-assets'
    and (
      storage_path like 'hero/%'
      or storage_path like 'logo/%'
      or storage_path like 'seo-og/%'
      or storage_path like 'search-seo-og/%'
      or storage_path like 'guides-seo-og/%'
    )
  );

drop policy if exists "Authenticated admins can update site asset uploads"
  on public.site_asset_uploads;

create policy "Authenticated admins can update site asset uploads"
  on public.site_asset_uploads
  for update
  to authenticated
  using (private.is_home_config_admin())
  with check (
    private.is_home_config_admin()
    and storage_bucket = 'site-assets'
    and (
      storage_path like 'hero/%'
      or storage_path like 'logo/%'
      or storage_path like 'seo-og/%'
      or storage_path like 'search-seo-og/%'
      or storage_path like 'guides-seo-og/%'
    )
  );

drop policy if exists "Authenticated admins can insert site assets"
  on storage.objects;

create policy "Authenticated admins can insert site assets"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'site-assets'
    and private.is_home_config_admin()
    and (
      name like 'hero/%'
      or name like 'logo/%'
      or name like 'seo-og/%'
      or name like 'search-seo-og/%'
      or name like 'guides-seo-og/%'
    )
  );

drop policy if exists "Authenticated admins can update site assets"
  on storage.objects;

create policy "Authenticated admins can update site assets"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'site-assets'
    and private.is_home_config_admin()
    and (
      name like 'hero/%'
      or name like 'logo/%'
      or name like 'seo-og/%'
      or name like 'search-seo-og/%'
      or name like 'guides-seo-og/%'
    )
  )
  with check (
    bucket_id = 'site-assets'
    and private.is_home_config_admin()
    and (
      name like 'hero/%'
      or name like 'logo/%'
      or name like 'seo-og/%'
      or name like 'search-seo-og/%'
      or name like 'guides-seo-og/%'
    )
  );

drop policy if exists "Authenticated admins can delete site assets"
  on storage.objects;

create policy "Authenticated admins can delete site assets"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'site-assets'
    and private.is_home_config_admin()
    and (
      name like 'hero/%'
      or name like 'logo/%'
      or name like 'seo-og/%'
      or name like 'search-seo-og/%'
      or name like 'guides-seo-og/%'
    )
  );

notify pgrst, 'reload schema';

-- END supabase/migrations/20260623010000_add_site_seo_share_asset_uploads.sql

-- BEGIN supabase/migrations/20260703002000_add_site_favicon_setting.sql
alter table public.site_settings
  add column if not exists favicon_image_path text,
  add column if not exists favicon_image_url text;

alter table public.site_asset_uploads
  drop constraint if exists site_asset_uploads_asset_type_check;

alter table public.site_asset_uploads
  add constraint site_asset_uploads_asset_type_check
  check (
    asset_type in (
      'favicon',
      'logo',
      'hero',
      'seo-og',
      'search-seo-og',
      'guides-seo-og'
    )
  );

drop policy if exists "Authenticated admins can insert site asset uploads"
  on public.site_asset_uploads;

create policy "Authenticated admins can insert site asset uploads"
  on public.site_asset_uploads
  for insert
  to authenticated
  with check (
    private.is_home_config_admin()
    and storage_bucket = 'site-assets'
    and (
      storage_path like 'favicon/%'
      or storage_path like 'hero/%'
      or storage_path like 'logo/%'
      or storage_path like 'seo-og/%'
      or storage_path like 'search-seo-og/%'
      or storage_path like 'guides-seo-og/%'
    )
  );

drop policy if exists "Authenticated admins can update site asset uploads"
  on public.site_asset_uploads;

create policy "Authenticated admins can update site asset uploads"
  on public.site_asset_uploads
  for update
  to authenticated
  using (private.is_home_config_admin())
  with check (
    private.is_home_config_admin()
    and storage_bucket = 'site-assets'
    and (
      storage_path like 'favicon/%'
      or storage_path like 'hero/%'
      or storage_path like 'logo/%'
      or storage_path like 'seo-og/%'
      or storage_path like 'search-seo-og/%'
      or storage_path like 'guides-seo-og/%'
    )
  );

drop policy if exists "Authenticated admins can insert site assets"
  on storage.objects;

create policy "Authenticated admins can insert site assets"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'site-assets'
    and private.is_home_config_admin()
    and (
      name like 'favicon/%'
      or name like 'hero/%'
      or name like 'logo/%'
      or name like 'seo-og/%'
      or name like 'search-seo-og/%'
      or name like 'guides-seo-og/%'
    )
  );

drop policy if exists "Authenticated admins can update site assets"
  on storage.objects;

create policy "Authenticated admins can update site assets"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'site-assets'
    and private.is_home_config_admin()
    and (
      name like 'favicon/%'
      or name like 'hero/%'
      or name like 'logo/%'
      or name like 'seo-og/%'
      or name like 'search-seo-og/%'
      or name like 'guides-seo-og/%'
    )
  )
  with check (
    bucket_id = 'site-assets'
    and private.is_home_config_admin()
    and (
      name like 'favicon/%'
      or name like 'hero/%'
      or name like 'logo/%'
      or name like 'seo-og/%'
      or name like 'search-seo-og/%'
      or name like 'guides-seo-og/%'
    )
  );

drop policy if exists "Authenticated admins can delete site assets"
  on storage.objects;

create policy "Authenticated admins can delete site assets"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'site-assets'
    and private.is_home_config_admin()
    and (
      name like 'favicon/%'
      or name like 'hero/%'
      or name like 'logo/%'
      or name like 'seo-og/%'
      or name like 'search-seo-og/%'
      or name like 'guides-seo-og/%'
    )
  );

notify pgrst, 'reload schema';

-- END supabase/migrations/20260703002000_add_site_favicon_setting.sql
