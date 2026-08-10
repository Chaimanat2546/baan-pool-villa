# Fresh HOME_CONFIG Supabase install

Use this only for a newly created, empty HOME_CONFIG Supabase project. It is a
single SQL Editor run; it must never be used on an existing project with users
or CMS data.

From the repository root, generate the current bundle:

```powershell
node scripts/build-home-config-fresh-install.mjs
```

Open `supabase/site-settings-migrations/home-config-fresh-install.sql`, copy
the entire file, then run it once in the target project's Supabase SQL Editor.
The generated bundle intentionally excludes the villa-catalog migrations that
need `public.listings` or `public.images`.

After a successful run, verify `site_settings`, `site_contact_settings`,
`site_seo_settings`, `site_web_styles`, `home_sections`, `admin_users`, and the
`site-assets` storage bucket. Do not manually promote a dashboard-created Auth
user by inserting only an `admin_users` row: the current credential fence also
requires a matching `app_metadata.credential_version`. Create the first admin
through the configured Central User Manager flow after the Worker is deployed.
