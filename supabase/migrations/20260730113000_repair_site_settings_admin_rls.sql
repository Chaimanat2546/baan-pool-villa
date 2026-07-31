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

alter table public.site_settings enable row level security;
grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;

drop policy if exists "Authenticated admins can update site settings"
  on public.site_settings;

create policy "Authenticated admins can update site settings"
  on public.site_settings
  for update
  to authenticated
  using (private.is_home_config_admin() and id = 'global')
  with check (private.is_home_config_admin() and id = 'global');

notify pgrst, 'reload schema';
