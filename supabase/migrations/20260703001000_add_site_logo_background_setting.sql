alter table public.site_settings
  add column if not exists logo_background text not null default 'white';

update public.site_settings
set logo_background = case
  when logo_background in ('white', 'transparent', 'primary', 'soft') then logo_background
  else 'white'
end
where id = 'global';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'site_settings_logo_background_allowed'
  ) then
    alter table public.site_settings
      add constraint site_settings_logo_background_allowed
      check (logo_background in ('white', 'transparent', 'primary', 'soft'));
  end if;
end;
$$;

notify pgrst, 'reload schema';
