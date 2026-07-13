create table if not exists public.site_header_settings (
  singleton_id boolean primary key default true,
  desktop_header_variant text not null default 'centered-contact',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_header_settings_singleton_check check (singleton_id),
  constraint site_header_settings_desktop_variant_check
    check (desktop_header_variant in ('centered-contact', 'right-booking'))
);

insert into public.site_header_settings (singleton_id, desktop_header_variant)
values (true, 'centered-contact')
on conflict (singleton_id) do nothing;

drop trigger if exists site_header_settings_set_updated_at
  on public.site_header_settings;

create trigger site_header_settings_set_updated_at
  before update on public.site_header_settings
  for each row execute function private.set_updated_at();

alter table public.site_header_settings enable row level security;

drop policy if exists "Anon and authenticated users can select site header settings"
  on public.site_header_settings;

create policy "Anon and authenticated users can select site header settings"
  on public.site_header_settings
  for select
  to anon, authenticated
  using (singleton_id);

drop policy if exists "Authenticated admins can insert site header settings"
  on public.site_header_settings;

create policy "Authenticated admins can insert site header settings"
  on public.site_header_settings
  for insert
  to authenticated
  with check (singleton_id and private.is_home_config_admin());

drop policy if exists "Authenticated admins can update site header settings"
  on public.site_header_settings;

create policy "Authenticated admins can update site header settings"
  on public.site_header_settings
  for update
  to authenticated
  using (singleton_id and private.is_home_config_admin())
  with check (singleton_id and private.is_home_config_admin());

grant select on public.site_header_settings to anon, authenticated;
grant insert, update on public.site_header_settings to authenticated;

notify pgrst, 'reload schema';
