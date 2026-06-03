create table if not exists public.guide_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (length(trim(slug)) > 0),
  title text not null check (length(trim(title)) > 0),
  excerpt text not null default '',
  cover_image_path text,
  cover_image_url text,
  cover_image_alt text,
  content_blocks jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  recommended_house_ids text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  is_pinned boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guide_posts_content_blocks_array
    check (jsonb_typeof(content_blocks) = 'array'),
  constraint guide_posts_publish_ready
    check (
      status <> 'published'
      or (
        length(trim(excerpt)) > 0
        and cover_image_url is not null
        and length(trim(cover_image_url)) > 0
        and cover_image_alt is not null
        and length(trim(cover_image_alt)) > 0
        and jsonb_array_length(content_blocks) > 0
        and array_length(recommended_house_ids, 1) > 0
      )
    )
);

create table if not exists public.guide_asset_uploads (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid references public.guide_posts(id) on delete set null,
  asset_role text not null default 'inline' check (asset_role in ('cover', 'inline')),
  storage_bucket text not null,
  storage_path text not null,
  public_url text not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists guide_posts_public_order_idx
  on public.guide_posts (status, is_pinned desc, published_at desc, updated_at desc);

create index if not exists guide_posts_slug_status_idx
  on public.guide_posts (slug, status);

create index if not exists guide_asset_uploads_guide_created_idx
  on public.guide_asset_uploads (guide_id, asset_role, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'guide_posts_set_updated_at'
      and tgrelid = 'public.guide_posts'::regclass
  ) then
    create trigger guide_posts_set_updated_at
      before update on public.guide_posts
      for each row execute function private.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'guide_asset_uploads_set_updated_at'
      and tgrelid = 'public.guide_asset_uploads'::regclass
  ) then
    create trigger guide_asset_uploads_set_updated_at
      before update on public.guide_asset_uploads
      for each row execute function private.set_updated_at();
  end if;
end;
$$;

alter table public.guide_posts enable row level security;
alter table public.guide_asset_uploads enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guide_posts'
      and policyname = 'Anon users can select published guide posts'
  ) then
    create policy "Anon users can select published guide posts"
      on public.guide_posts
      for select
      to anon
      using (status = 'published');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guide_posts'
      and policyname = 'Authenticated users can select visible guide posts'
  ) then
    create policy "Authenticated users can select visible guide posts"
      on public.guide_posts
      for select
      to authenticated
      using (status = 'published' or private.is_home_config_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guide_posts'
      and policyname = 'Authenticated admins can insert guide posts'
  ) then
    create policy "Authenticated admins can insert guide posts"
      on public.guide_posts
      for insert
      to authenticated
      with check (private.is_home_config_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guide_posts'
      and policyname = 'Authenticated admins can update guide posts'
  ) then
    create policy "Authenticated admins can update guide posts"
      on public.guide_posts
      for update
      to authenticated
      using (private.is_home_config_admin())
      with check (private.is_home_config_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guide_posts'
      and policyname = 'Authenticated admins can delete guide posts'
  ) then
    create policy "Authenticated admins can delete guide posts"
      on public.guide_posts
      for delete
      to authenticated
      using (private.is_home_config_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guide_asset_uploads'
      and policyname = 'Authenticated admins can select guide asset uploads'
  ) then
    create policy "Authenticated admins can select guide asset uploads"
      on public.guide_asset_uploads
      for select
      to authenticated
      using (private.is_home_config_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guide_asset_uploads'
      and policyname = 'Authenticated admins can insert guide asset uploads'
  ) then
    create policy "Authenticated admins can insert guide asset uploads"
      on public.guide_asset_uploads
      for insert
      to authenticated
      with check (
        private.is_home_config_admin()
        and storage_bucket = 'guide-assets'
        and storage_path like 'guides/%'
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guide_asset_uploads'
      and policyname = 'Authenticated admins can update guide asset uploads'
  ) then
    create policy "Authenticated admins can update guide asset uploads"
      on public.guide_asset_uploads
      for update
      to authenticated
      using (private.is_home_config_admin())
      with check (
        private.is_home_config_admin()
        and storage_bucket = 'guide-assets'
        and storage_path like 'guides/%'
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guide_asset_uploads'
      and policyname = 'Authenticated admins can delete guide asset uploads'
  ) then
    create policy "Authenticated admins can delete guide asset uploads"
      on public.guide_asset_uploads
      for delete
      to authenticated
      using (private.is_home_config_admin());
  end if;
end;
$$;

grant select on public.guide_posts to anon, authenticated;
grant select on public.guide_asset_uploads to authenticated;
grant insert, update, delete on public.guide_posts, public.guide_asset_uploads to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'guide-assets',
  'guide-assets',
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
      and policyname = 'Authenticated admins can insert guide assets'
  ) then
    create policy "Authenticated admins can insert guide assets"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'guide-assets'
        and private.is_home_config_admin()
        and name like 'guides/%'
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated admins can update guide assets'
  ) then
    create policy "Authenticated admins can update guide assets"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'guide-assets'
        and private.is_home_config_admin()
        and name like 'guides/%'
      )
      with check (
        bucket_id = 'guide-assets'
        and private.is_home_config_admin()
        and name like 'guides/%'
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated admins can delete guide assets'
  ) then
    create policy "Authenticated admins can delete guide assets"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'guide-assets'
        and private.is_home_config_admin()
        and name like 'guides/%'
      );
  end if;
end;
$$;

grant insert, update, delete on storage.objects to authenticated;

notify pgrst, 'reload schema';
