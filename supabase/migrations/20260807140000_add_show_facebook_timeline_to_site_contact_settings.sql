alter table public.site_contact_settings
  add column if not exists show_facebook_timeline boolean not null default true;

notify pgrst, 'reload schema';
