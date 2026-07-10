create table if not exists public.customer_review_images (
  id uuid primary key default gen_random_uuid(),
  storage_bucket text not null default 'site-assets',
  storage_path text not null unique,
  public_url text not null,
  alt text not null default '',
  is_active boolean not null default true,
  is_homepage boolean not null default false,
  homepage_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_review_images_homepage_order_check
    check (
      (
        is_homepage
        and homepage_order is not null
        and homepage_order > 0
      )
      or (
        not is_homepage
        and homepage_order is null
      )
    )
);

create unique index if not exists customer_review_images_homepage_order_unique
  on public.customer_review_images (homepage_order)
  where is_homepage;

create index if not exists customer_review_images_created_at_idx
  on public.customer_review_images (created_at desc);

create index if not exists customer_review_images_homepage_idx
  on public.customer_review_images (is_active, is_homepage, homepage_order)
  where is_homepage;

drop trigger if exists customer_review_images_set_updated_at
  on public.customer_review_images;

create trigger customer_review_images_set_updated_at
  before update on public.customer_review_images
  for each row execute function private.set_updated_at();

create table if not exists public.customer_review_homepage_settings (
  singleton_id boolean primary key default true,
  layout text not null default 'proof_wall',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_review_homepage_settings_singleton_check
    check (singleton_id),
  constraint customer_review_homepage_settings_layout_check
    check (layout in ('featured_rail', 'proof_wall', 'carousel'))
);

insert into public.customer_review_homepage_settings (singleton_id, layout)
values (true, 'proof_wall')
on conflict (singleton_id) do nothing;

drop trigger if exists customer_review_homepage_settings_set_updated_at
  on public.customer_review_homepage_settings;

create trigger customer_review_homepage_settings_set_updated_at
  before update on public.customer_review_homepage_settings
  for each row execute function private.set_updated_at();

alter table public.customer_review_images enable row level security;
alter table public.customer_review_homepage_settings enable row level security;

drop policy if exists "Anon and authenticated users can select homepage customer reviews"
  on public.customer_review_images;

create policy "Anon and authenticated users can select homepage customer reviews"
  on public.customer_review_images
  for select
  to anon, authenticated
  using (is_active and is_homepage);

drop policy if exists "Authenticated admins can select customer reviews"
  on public.customer_review_images;

create policy "Authenticated admins can select customer reviews"
  on public.customer_review_images
  for select
  to authenticated
  using (private.is_home_config_admin());

drop policy if exists "Authenticated admins can insert customer reviews"
  on public.customer_review_images;

create policy "Authenticated admins can insert customer reviews"
  on public.customer_review_images
  for insert
  to authenticated
  with check (private.is_home_config_admin());

drop policy if exists "Authenticated admins can update customer reviews"
  on public.customer_review_images;

create policy "Authenticated admins can update customer reviews"
  on public.customer_review_images
  for update
  to authenticated
  using (private.is_home_config_admin())
  with check (private.is_home_config_admin());

drop policy if exists "Authenticated admins can delete customer reviews"
  on public.customer_review_images;

create policy "Authenticated admins can delete customer reviews"
  on public.customer_review_images
  for delete
  to authenticated
  using (private.is_home_config_admin());

drop policy if exists "Anon and authenticated users can select customer review homepage settings"
  on public.customer_review_homepage_settings;

create policy "Anon and authenticated users can select customer review homepage settings"
  on public.customer_review_homepage_settings
  for select
  to anon, authenticated
  using (singleton_id);

drop policy if exists "Authenticated admins can update customer review homepage settings"
  on public.customer_review_homepage_settings;

create policy "Authenticated admins can update customer review homepage settings"
  on public.customer_review_homepage_settings
  for update
  to authenticated
  using (private.is_home_config_admin())
  with check (private.is_home_config_admin() and singleton_id);

drop policy if exists "Authenticated admins can insert customer review homepage settings"
  on public.customer_review_homepage_settings;

create policy "Authenticated admins can insert customer review homepage settings"
  on public.customer_review_homepage_settings
  for insert
  to authenticated
  with check (private.is_home_config_admin() and singleton_id);

grant select on public.customer_review_images, public.customer_review_homepage_settings
  to anon, authenticated;

grant insert, update, delete on public.customer_review_images
  to authenticated;

grant insert, update on public.customer_review_homepage_settings
  to authenticated;

alter table public.site_asset_uploads
  drop constraint if exists site_asset_uploads_asset_type_check;

alter table public.site_asset_uploads
  add constraint site_asset_uploads_asset_type_check
  check (
    asset_type in (
      'favicon',
      'logo',
      'hero',
      'seo-og',
      'search-seo-og',
      'guides-seo-og',
      'villa-cover',
      'customer-review'
    )
  );

drop policy if exists "Authenticated admins can insert site asset uploads"
  on public.site_asset_uploads;

create policy "Authenticated admins can insert site asset uploads"
  on public.site_asset_uploads
  for insert
  to authenticated
  with check (
    private.is_home_config_admin()
    and storage_bucket = 'site-assets'
    and (
      storage_path like 'favicon/%'
      or storage_path like 'hero/%'
      or storage_path like 'logo/%'
      or storage_path like 'seo-og/%'
      or storage_path like 'search-seo-og/%'
      or storage_path like 'guides-seo-og/%'
      or storage_path like 'villa-cover/%'
      or storage_path like 'customer-reviews/%'
    )
  );

drop policy if exists "Authenticated admins can update site asset uploads"
  on public.site_asset_uploads;

create policy "Authenticated admins can update site asset uploads"
  on public.site_asset_uploads
  for update
  to authenticated
  using (private.is_home_config_admin())
  with check (
    private.is_home_config_admin()
    and storage_bucket = 'site-assets'
    and (
      storage_path like 'favicon/%'
      or storage_path like 'hero/%'
      or storage_path like 'logo/%'
      or storage_path like 'seo-og/%'
      or storage_path like 'search-seo-og/%'
      or storage_path like 'guides-seo-og/%'
      or storage_path like 'villa-cover/%'
      or storage_path like 'customer-reviews/%'
    )
  );

drop policy if exists "Authenticated admins can insert site assets"
  on storage.objects;

create policy "Authenticated admins can insert site assets"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'site-assets'
    and private.is_home_config_admin()
    and (
      name like 'favicon/%'
      or name like 'hero/%'
      or name like 'logo/%'
      or name like 'seo-og/%'
      or name like 'search-seo-og/%'
      or name like 'guides-seo-og/%'
      or name like 'villa-cover/%'
      or name like 'customer-reviews/%'
    )
  );

drop policy if exists "Authenticated admins can update site assets"
  on storage.objects;

create policy "Authenticated admins can update site assets"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'site-assets'
    and private.is_home_config_admin()
    and (
      name like 'favicon/%'
      or name like 'hero/%'
      or name like 'logo/%'
      or name like 'seo-og/%'
      or name like 'search-seo-og/%'
      or name like 'guides-seo-og/%'
      or name like 'villa-cover/%'
      or name like 'customer-reviews/%'
    )
  )
  with check (
    bucket_id = 'site-assets'
    and private.is_home_config_admin()
    and (
      name like 'favicon/%'
      or name like 'hero/%'
      or name like 'logo/%'
      or name like 'seo-og/%'
      or name like 'search-seo-og/%'
      or name like 'guides-seo-og/%'
      or name like 'villa-cover/%'
      or name like 'customer-reviews/%'
    )
  );

drop policy if exists "Authenticated admins can delete site assets"
  on storage.objects;

create policy "Authenticated admins can delete site assets"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'site-assets'
    and private.is_home_config_admin()
    and (
      name like 'favicon/%'
      or name like 'hero/%'
      or name like 'logo/%'
      or name like 'seo-og/%'
      or name like 'search-seo-og/%'
      or name like 'guides-seo-og/%'
      or name like 'villa-cover/%'
      or name like 'customer-reviews/%'
    )
  );

create or replace function private.save_customer_review_homepage_queue(
  image_ids uuid[],
  selected_layout text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  normalized_ids uuid[];
  normalized_layout text;
  requested_count integer;
  unique_count integer;
  valid_count integer;
begin
  if not private.is_home_config_admin() then
    raise exception 'Only home config admins can save customer review homepage queue'
      using errcode = '42501';
  end if;

  normalized_ids := coalesce(image_ids, array[]::uuid[]);
  normalized_layout := lower(coalesce(selected_layout, ''));
  requested_count := cardinality(normalized_ids);

  if normalized_layout not in ('featured_rail', 'proof_wall', 'carousel') then
    raise exception 'Invalid customer review homepage layout'
      using errcode = '22023';
  end if;

  if requested_count > 20 then
    raise exception 'Customer review homepage queue can contain at most 20 images'
      using errcode = '22023';
  end if;

  select count(*)
    into unique_count
  from (
    select distinct queued.image_id
    from unnest(normalized_ids) as queued(image_id)
  ) deduped;

  if unique_count <> requested_count then
    raise exception 'Customer review homepage queue contains duplicate image ids'
      using errcode = '22023';
  end if;

  select count(*)
    into valid_count
  from public.customer_review_images image
  where image.id = any(normalized_ids)
    and image.is_active;

  if valid_count <> requested_count then
    raise exception 'Customer review homepage queue contains missing or inactive images'
      using errcode = '22023';
  end if;

  update public.customer_review_images
  set is_homepage = false,
      homepage_order = null
  where is_homepage;

  update public.customer_review_images image
  set is_homepage = true,
      homepage_order = queued.ordinality::integer
  from unnest(normalized_ids) with ordinality as queued(image_id, ordinality)
  where image.id = queued.image_id;

  insert into public.customer_review_homepage_settings (singleton_id, layout)
  values (true, normalized_layout)
  on conflict (singleton_id)
  do update set layout = excluded.layout;
end;
$$;

revoke all on function private.save_customer_review_homepage_queue(uuid[], text)
  from public;

grant execute on function private.save_customer_review_homepage_queue(uuid[], text)
  to authenticated;

create or replace function public.save_customer_review_homepage_queue(
  image_ids uuid[],
  selected_layout text
)
returns void
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  perform private.save_customer_review_homepage_queue(image_ids, selected_layout);
end;
$$;

revoke all on function public.save_customer_review_homepage_queue(uuid[], text)
  from public;

grant execute on function public.save_customer_review_homepage_queue(uuid[], text)
  to authenticated;

notify pgrst, 'reload schema';
