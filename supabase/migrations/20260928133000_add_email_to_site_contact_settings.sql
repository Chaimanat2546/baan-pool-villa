alter table public.site_contact_settings
  add column emails jsonb not null default '[]'::jsonb,
  add constraint site_contact_settings_emails_array_check
    check (jsonb_typeof(emails) = 'array' and jsonb_array_length(emails) <= 3);

notify pgrst, 'reload schema';
