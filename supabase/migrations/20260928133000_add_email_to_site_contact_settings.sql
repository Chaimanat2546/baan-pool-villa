alter table public.site_contact_settings
  add column if not exists email text;

notify pgrst, 'reload schema';
