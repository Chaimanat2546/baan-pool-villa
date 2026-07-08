alter table public.site_settings
  add column if not exists google_tag_manager_id text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_settings_google_tag_manager_id_format'
      and conrelid = 'public.site_settings'::regclass
  ) then
    alter table public.site_settings
      add constraint site_settings_google_tag_manager_id_format
      check (
        google_tag_manager_id = ''
        or google_tag_manager_id ~ '^GTM-[A-Z0-9]{5,15}$'
      );
  end if;
end $$;

notify pgrst, 'reload schema';
