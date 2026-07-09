alter table public.villa_card_image_configs
  add column if not exists cover_image_path text,
  add column if not exists cover_image_url text,
  add column if not exists cover_image_alt text;

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
      'guides-seo-og',
      'villa-cover'
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
      or storage_path like 'villa-cover/%'
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
      or storage_path like 'villa-cover/%'
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
      or name like 'villa-cover/%'
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
      or name like 'villa-cover/%'
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
      or name like 'villa-cover/%'
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
      or name like 'villa-cover/%'
    )
  );

notify pgrst, 'reload schema';
