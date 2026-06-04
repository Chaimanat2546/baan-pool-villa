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
