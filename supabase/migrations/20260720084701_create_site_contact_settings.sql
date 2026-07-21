create table if not exists public.site_contact_settings (
  singleton_id boolean primary key default true,
  bank_account_name text not null,
  bank_name text not null,
  bank_account_number text not null,
  phone_contacts jsonb not null,
  messenger_url text not null,
  line_id text not null,
  line_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_contact_settings_singleton_check check (singleton_id),
  constraint site_contact_settings_phone_contacts_array_check
    check (jsonb_typeof(phone_contacts) = 'array')
);

do $$
begin
  if not exists (select 1 from public.site_settings where id = 'global') then
    raise exception 'Cannot backfill site contact settings: site_settings global row is missing';
  end if;
end
$$;

insert into public.site_contact_settings (
  singleton_id,
  bank_account_name,
  bank_name,
  bank_account_number,
  phone_contacts,
  messenger_url,
  line_id,
  line_url
)
select
  true,
  coalesce(bank_account_name, ''),
  coalesce(bank_name, ''),
  coalesce(bank_account_number, ''),
  coalesce(phone_contacts, '[]'::jsonb),
  coalesce(messenger_url, ''),
  coalesce(line_id, ''),
  coalesce(line_url, '')
from public.site_settings
where id = 'global'
on conflict (singleton_id) do nothing;

drop trigger if exists site_contact_settings_set_updated_at
  on public.site_contact_settings;

create trigger site_contact_settings_set_updated_at
  before update on public.site_contact_settings
  for each row execute function private.set_updated_at();

alter table public.site_contact_settings enable row level security;

drop policy if exists "Public can select site contact settings"
  on public.site_contact_settings;
create policy "Public can select site contact settings"
  on public.site_contact_settings
  for select
  to anon, authenticated
  using (singleton_id);

drop policy if exists "Admins can insert site contact settings"
  on public.site_contact_settings;
create policy "Admins can insert site contact settings"
  on public.site_contact_settings
  for insert
  to authenticated
  with check (singleton_id and private.is_home_config_admin());

drop policy if exists "Admins can update site contact settings"
  on public.site_contact_settings;
create policy "Admins can update site contact settings"
  on public.site_contact_settings
  for update
  to authenticated
  using (singleton_id and private.is_home_config_admin())
  with check (singleton_id and private.is_home_config_admin());

revoke all on table public.site_contact_settings from anon, authenticated;
grant select on table public.site_contact_settings to anon, authenticated;
grant insert, update on table public.site_contact_settings to authenticated;

notify pgrst, 'reload schema';

select
  count(*) as singleton_count,
  bool_and(singleton_id) as singleton_ids_valid,
  bool_and(jsonb_typeof(phone_contacts) = 'array') as phone_contacts_valid,
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.site_contact_settings'::regclass
  ) as rls_enabled,
  (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'site_contact_settings'
      and policyname in (
        'Public can select site contact settings',
        'Admins can insert site contact settings',
        'Admins can update site contact settings'
      )
  ) as required_policy_count,
  (
    select count(*)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'site_contact_settings'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('DELETE', 'TRUNCATE')
  ) as delete_or_truncate_grant_count
from public.site_contact_settings;
