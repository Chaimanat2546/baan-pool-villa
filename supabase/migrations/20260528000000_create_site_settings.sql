create table if not exists public.site_settings (
  id text primary key,
  site_name text not null,
  primary_color text not null,
  accent_color text not null,
  logo_image_path text,
  logo_image_url text,
  hero_image_path text,
  hero_image_url text,
  hero_image_alt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_settings_id_global check (id = 'global'),
  constraint site_settings_primary_color_hex check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint site_settings_accent_color_hex check (accent_color ~ '^#[0-9A-Fa-f]{6}$')
);

create table if not exists public.site_asset_uploads (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null check (asset_type in ('logo', 'hero')),
  storage_bucket text not null,
  storage_path text not null,
  public_url text not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists site_asset_uploads_type_created_idx
  on public.site_asset_uploads (asset_type, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'site_settings_set_updated_at'
      and tgrelid = 'public.site_settings'::regclass
  ) then
    create trigger site_settings_set_updated_at
      before update on public.site_settings
      for each row execute function private.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'site_asset_uploads_set_updated_at'
      and tgrelid = 'public.site_asset_uploads'::regclass
  ) then
    create trigger site_asset_uploads_set_updated_at
      before update on public.site_asset_uploads
      for each row execute function private.set_updated_at();
  end if;
end;
$$;

alter table public.site_settings enable row level security;
alter table public.site_asset_uploads enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_settings'
      and policyname = 'Anon and authenticated users can select site settings'
  ) then
    create policy "Anon and authenticated users can select site settings"
      on public.site_settings
      for select
      to anon, authenticated
      using (id = 'global');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_settings'
      and policyname = 'Authenticated admins can insert site settings'
  ) then
    create policy "Authenticated admins can insert site settings"
      on public.site_settings
      for insert
      to authenticated
      with check (private.is_home_config_admin() and id = 'global');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_settings'
      and policyname = 'Authenticated admins can update site settings'
  ) then
    create policy "Authenticated admins can update site settings"
      on public.site_settings
      for update
      to authenticated
      using (private.is_home_config_admin() and id = 'global')
      with check (private.is_home_config_admin() and id = 'global');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_settings'
      and policyname = 'Authenticated admins can delete site settings'
  ) then
    create policy "Authenticated admins can delete site settings"
      on public.site_settings
      for delete
      to authenticated
      using (private.is_home_config_admin() and id = 'global');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_asset_uploads'
      and policyname = 'Anon and authenticated users can select current site asset uploads'
  ) then
    create policy "Anon and authenticated users can select current site asset uploads"
      on public.site_asset_uploads
      for select
      to anon, authenticated
      using (is_current);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_asset_uploads'
      and policyname = 'Authenticated admins can select all site asset uploads'
  ) then
    create policy "Authenticated admins can select all site asset uploads"
      on public.site_asset_uploads
      for select
      to authenticated
      using (private.is_home_config_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_asset_uploads'
      and policyname = 'Authenticated admins can insert site asset uploads'
  ) then
    create policy "Authenticated admins can insert site asset uploads"
      on public.site_asset_uploads
      for insert
      to authenticated
      with check (
        private.is_home_config_admin()
        and storage_bucket = 'site-assets'
        and (
          storage_path like 'hero/%'
          or storage_path like 'logo/%'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_asset_uploads'
      and policyname = 'Authenticated admins can update site asset uploads'
  ) then
    create policy "Authenticated admins can update site asset uploads"
      on public.site_asset_uploads
      for update
      to authenticated
      using (private.is_home_config_admin())
      with check (
        private.is_home_config_admin()
        and storage_bucket = 'site-assets'
        and (
          storage_path like 'hero/%'
          or storage_path like 'logo/%'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_asset_uploads'
      and policyname = 'Authenticated admins can delete site asset uploads'
  ) then
    create policy "Authenticated admins can delete site asset uploads"
      on public.site_asset_uploads
      for delete
      to authenticated
      using (private.is_home_config_admin());
  end if;
end;
$$;

grant select on public.site_settings, public.site_asset_uploads to anon, authenticated;
grant insert, update, delete on public.site_settings, public.site_asset_uploads to authenticated;

insert into public.site_settings (
  id,
  site_name,
  primary_color,
  accent_color,
  logo_image_path,
  logo_image_url,
  hero_image_path,
  hero_image_url,
  hero_image_alt
)
values (
  'global',
  'Pool Villas Pattaya',
  '#064e3b',
  '#eab308',
  '/images/logo.jpg',
  '/images/logo.jpg',
  '/images/BPV-66_Cover-Web.jpg',
  '/images/BPV-66_Cover-Web.jpg',
  'Pool Villa บ้านพูลวิลล่า พัทยา'
)
on conflict (id) do nothing;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'site-assets',
  'site-assets',
  true,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public can read site assets'
  ) then
    create policy "Public can read site assets"
      on storage.objects
      for select
      to anon, authenticated
      using (bucket_id = 'site-assets');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated admins can insert site assets'
  ) then
    create policy "Authenticated admins can insert site assets"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'site-assets'
        and private.is_home_config_admin()
        and (
          name like 'hero/%'
          or name like 'logo/%'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated admins can update site assets'
  ) then
    create policy "Authenticated admins can update site assets"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'site-assets'
        and private.is_home_config_admin()
        and (
          name like 'hero/%'
          or name like 'logo/%'
        )
      )
      with check (
        bucket_id = 'site-assets'
        and private.is_home_config_admin()
        and (
          name like 'hero/%'
          or name like 'logo/%'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated admins can delete site assets'
  ) then
    create policy "Authenticated admins can delete site assets"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'site-assets'
        and private.is_home_config_admin()
        and (
          name like 'hero/%'
          or name like 'logo/%'
        )
      );
  end if;
end;
$$;

grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

notify pgrst, 'reload schema';
