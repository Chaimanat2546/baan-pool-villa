create table if not exists public.site_seo_settings (
  page_type text primary key,
  settings jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_seo_settings_page_type_check
    check (page_type in ('global', 'search', 'guides', 'villa_detail')),
  constraint site_seo_settings_object_check
    check (jsonb_typeof(settings) = 'object')
);

do $$
begin
  if not exists (select 1 from public.site_settings where id = 'global') then
    raise exception 'Cannot backfill site SEO settings: site_settings global row is missing';
  end if;
end
$$;

insert into public.site_seo_settings (page_type, settings)
select 'global', jsonb_build_object(
  'title', seo_title,
  'description', seo_description,
  'keywords', seo_keywords,
  'ogImageUrl', seo_og_image_url,
  'ogImageAlt', seo_og_image_alt,
  'businessName', seo_business_name,
  'sameAsUrls', seo_same_as_urls
)
from public.site_settings
where id = 'global'
on conflict (page_type) do nothing;

insert into public.site_seo_settings (page_type, settings)
select 'search', jsonb_build_object(
  'title', search_seo_title,
  'description', search_seo_description,
  'keywords', search_seo_keywords,
  'ogImageUrl', search_seo_og_image_url,
  'ogImageAlt', search_seo_og_image_alt
)
from public.site_settings
where id = 'global'
on conflict (page_type) do nothing;

insert into public.site_seo_settings (page_type, settings)
select 'guides', jsonb_build_object(
  'title', guides_seo_title,
  'description', guides_seo_description,
  'keywords', guides_seo_keywords,
  'ogImageUrl', guides_seo_og_image_url,
  'ogImageAlt', guides_seo_og_image_alt
)
from public.site_settings
where id = 'global'
on conflict (page_type) do nothing;

insert into public.site_seo_settings (page_type, settings)
select 'villa_detail', jsonb_build_object(
  'keywords', villa_detail_seo_keywords
)
from public.site_settings
where id = 'global'
on conflict (page_type) do nothing;

drop trigger if exists site_seo_settings_set_updated_at
  on public.site_seo_settings;

create trigger site_seo_settings_set_updated_at
  before update on public.site_seo_settings
  for each row execute function private.set_updated_at();

alter table public.site_seo_settings enable row level security;

drop policy if exists "Anon and authenticated users can select site SEO settings"
  on public.site_seo_settings;
create policy "Anon and authenticated users can select site SEO settings"
  on public.site_seo_settings
  for select
  to anon, authenticated
  using (page_type in ('global', 'search', 'guides', 'villa_detail'));

drop policy if exists "Authenticated admins can insert site SEO settings"
  on public.site_seo_settings;
create policy "Authenticated admins can insert site SEO settings"
  on public.site_seo_settings
  for insert
  to authenticated
  with check (
    page_type in ('global', 'search', 'guides', 'villa_detail')
    and private.is_home_config_admin()
  );

drop policy if exists "Authenticated admins can update site SEO settings"
  on public.site_seo_settings;
create policy "Authenticated admins can update site SEO settings"
  on public.site_seo_settings
  for update
  to authenticated
  using (
    page_type in ('global', 'search', 'guides', 'villa_detail')
    and private.is_home_config_admin()
  )
  with check (
    page_type in ('global', 'search', 'guides', 'villa_detail')
    and private.is_home_config_admin()
  );

revoke all on table public.site_seo_settings from anon, authenticated;
grant select on table public.site_seo_settings to anon, authenticated;
grant insert, update on table public.site_seo_settings to authenticated;

notify pgrst, 'reload schema';

select
  (
    select count(*)
    from public.site_seo_settings
    where page_type in ('global', 'search', 'guides', 'villa_detail')
  ) as canonical_row_count,
  (
    select count(*)
    from public.site_seo_settings
    where jsonb_typeof(settings) = 'object'
  ) as object_payload_row_count,
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.site_seo_settings'::regclass
  ) as rls_enabled,
  (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'site_seo_settings'
      and policyname in (
        'Anon and authenticated users can select site SEO settings',
        'Authenticated admins can insert site SEO settings',
        'Authenticated admins can update site SEO settings'
      )
  ) as required_policy_count,
  (
    select coalesce(array_agg(privilege_type order by privilege_type), array[]::text[])
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'site_seo_settings'
      and grantee = 'anon'
  ) as anon_privileges,
  (
    select coalesce(array_agg(privilege_type order by privilege_type), array[]::text[])
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'site_seo_settings'
      and grantee = 'authenticated'
  ) as authenticated_privileges,
  (
    select count(*)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'site_seo_settings'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('DELETE', 'TRUNCATE')
  ) as delete_or_truncate_grant_count;
