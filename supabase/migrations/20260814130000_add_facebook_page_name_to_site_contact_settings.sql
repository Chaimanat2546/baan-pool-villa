alter table public.site_contact_settings
  add column if not exists facebook_page_name text;

notify pgrst, 'reload schema';
