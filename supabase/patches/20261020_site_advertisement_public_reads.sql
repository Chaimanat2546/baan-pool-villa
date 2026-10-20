-- Public reads must not execute the authenticated-only admin helper.
drop policy if exists "Site advertisements read" on public.site_advertisements;
create policy "Site advertisements read" on public.site_advertisements
  for select to anon, authenticated using (is_active);
drop policy if exists "Site advertisements admin read" on public.site_advertisements;
create policy "Site advertisements admin read" on public.site_advertisements
  for select to authenticated using (private.is_home_config_admin());

drop policy if exists "Site advertisement images read" on public.site_advertisement_images;
create policy "Site advertisement images read" on public.site_advertisement_images
  for select to anon, authenticated using (
    exists (select 1 from public.site_advertisements a where a.id = advertisement_id and a.is_active)
  );
drop policy if exists "Site advertisement images admin read" on public.site_advertisement_images;
create policy "Site advertisement images admin read" on public.site_advertisement_images
  for select to authenticated using (
    private.is_home_config_admin()
    and exists (select 1 from public.site_advertisements a where a.id = advertisement_id)
  );

notify pgrst, 'reload schema';
