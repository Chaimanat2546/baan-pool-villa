-- Website-owned advertisements. This migration never reads the catalog project.
create table if not exists public.site_advertisements (
  id uuid primary key,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  zone text not null check (zone in ('all','pattaya','jomtien','bangsaray','sattahip','bangsean','rayong','hua_hin','khaoyai','bangkok')),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 9999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp()
);
create index if not exists site_advertisements_public_order_idx on public.site_advertisements (is_active, zone, sort_order, id);

create table if not exists public.site_advertisement_uploads (
  id uuid primary key,
  storage_path text not null unique,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  attached_at timestamptz,
  deleted_at timestamptz,
  constraint site_advertisement_upload_path_check check (
    storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
    and right(storage_path, 41) = id::text || '.webp'
  )
);
create table if not exists public.site_advertisement_images (
  id uuid primary key references public.site_advertisement_uploads(id),
  advertisement_id uuid not null references public.site_advertisements(id) on delete cascade,
  storage_path text not null unique,
  display_order integer not null check (display_order between 0 and 11),
  constraint site_advertisement_image_path_check check (storage_path = advertisement_id::text || '/' || id::text || '.webp'),
  unique (advertisement_id, display_order)
);
alter table public.site_advertisements enable row level security;
alter table public.site_advertisement_images enable row level security;
alter table public.site_advertisement_uploads enable row level security;
revoke all on public.site_advertisements, public.site_advertisement_images, public.site_advertisement_uploads from public, anon, authenticated;
grant select on public.site_advertisements, public.site_advertisement_images to anon, authenticated;
grant select, insert on public.site_advertisement_uploads to authenticated;
grant update (deleted_at) on public.site_advertisement_uploads to authenticated;

drop policy if exists "Site advertisements read" on public.site_advertisements;
create policy "Site advertisements read" on public.site_advertisements for select to anon, authenticated
  using (is_active or private.is_home_config_admin());
drop policy if exists "Site advertisement images read" on public.site_advertisement_images;
create policy "Site advertisement images read" on public.site_advertisement_images for select to anon, authenticated
  using (exists (select 1 from public.site_advertisements a where a.id = advertisement_id and (a.is_active or private.is_home_config_admin())));
drop policy if exists "Site advertisement upload history read" on public.site_advertisement_uploads;
create policy "Site advertisement upload history read" on public.site_advertisement_uploads for select to authenticated using (private.is_home_config_admin());
drop policy if exists "Site advertisement upload history insert" on public.site_advertisement_uploads;
create policy "Site advertisement upload history insert" on public.site_advertisement_uploads for insert to authenticated
  with check (private.is_home_config_admin() and created_by = auth.uid() and attached_at is null and deleted_at is null);
drop policy if exists "Site advertisement upload history cleanup" on public.site_advertisement_uploads;
create policy "Site advertisement upload history cleanup" on public.site_advertisement_uploads for update to authenticated
  using (private.is_home_config_admin() and not exists (select 1 from public.site_advertisement_images i where i.id = site_advertisement_uploads.id))
  with check (private.is_home_config_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('advertisement-assets', 'advertisement-assets', true, 6291456, array['image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Site advertisement assets admin" on storage.objects;
create policy "Site advertisement assets admin" on storage.objects for all to authenticated
  using (bucket_id = 'advertisement-assets' and private.is_home_config_admin())
  with check (bucket_id = 'advertisement-assets' and private.is_home_config_admin() and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$');

create or replace function private.save_site_advertisement_impl(p_ad jsonb, p_images jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_id uuid;
  v_previous public.site_advertisements%rowtype;
  v_exists boolean;
  v_removed jsonb;
  v_image jsonb;
  v_image_id uuid;
  v_path text;
  v_updated timestamptz;
begin
  if not coalesce(private.is_home_config_admin(), false) then raise exception 'Admin access required' using errcode = '42501'; end if;
  if jsonb_typeof(p_ad) is distinct from 'object' or jsonb_typeof(p_images) is distinct from 'array' then raise exception 'Invalid advertisement' using errcode = '22023'; end if;
  if jsonb_array_length(p_images) not between 1 and 12 or jsonb_typeof(p_ad->'isActive') is distinct from 'boolean' then raise exception 'Invalid advertisement images or state' using errcode = '22023'; end if;
  v_id := (p_ad->>'id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(v_id::text, 0));
  select * into v_previous from public.site_advertisements where id = v_id for update;
  v_exists := found;
  if (v_exists and (p_ad->>'updatedAt')::timestamptz is distinct from v_previous.updated_at)
    or (not v_exists and p_ad->>'updatedAt' is not null) then
    raise exception 'Advertisement changed; reload before saving' using errcode = '40001';
  end if;
  if (select count(distinct x->>'id') from jsonb_array_elements(p_images) x) <> jsonb_array_length(p_images) then raise exception 'Duplicate image' using errcode = '22023'; end if;
  for v_image in select * from jsonb_array_elements(p_images) loop
    v_image_id := (v_image->>'id')::uuid;
    v_path := v_id::text || '/' || v_image_id::text || '.webp';
    if v_image->>'storagePath' is distinct from v_path or not exists (
      select 1 from public.site_advertisement_uploads u where u.id = v_image_id and u.storage_path = v_path and u.deleted_at is null
      and ((u.attached_at is null and u.created_by = auth.uid()) or exists (
        select 1 from public.site_advertisement_images i where i.id = u.id and i.advertisement_id = v_id
      ))
    ) then raise exception 'Image does not belong to this advertisement' using errcode = '22023'; end if;
  end loop;
  select coalesce(jsonb_agg(i.storage_path), '[]'::jsonb) into v_removed from public.site_advertisement_images i
    where i.advertisement_id = v_id and not exists (select 1 from jsonb_array_elements(p_images) x where (x->>'id')::uuid = i.id);
  insert into public.site_advertisements (id, title, zone, is_active, sort_order)
    values (v_id, btrim(p_ad->>'title'), p_ad->>'zone', (p_ad->>'isActive')::boolean, (p_ad->>'sortOrder')::integer)
    on conflict (id) do update set title = excluded.title, zone = excluded.zone, is_active = excluded.is_active, sort_order = excluded.sort_order, updated_at = clock_timestamp()
    returning updated_at into v_updated;
  delete from public.site_advertisement_images where advertisement_id = v_id;
  insert into public.site_advertisement_images (id, advertisement_id, storage_path, display_order)
    select (x.value->>'id')::uuid, v_id, x.value->>'storagePath', x.ordinality - 1 from jsonb_array_elements(p_images) with ordinality x(value, ordinality);
  update public.site_advertisement_uploads u set attached_at = coalesce(u.attached_at, now())
    where exists (select 1 from public.site_advertisement_images i where i.advertisement_id = v_id and i.id = u.id);
  return jsonb_build_object('id', v_id, 'updatedAt', v_updated, 'removedPaths', v_removed);
end;
$$;

create or replace function private.delete_site_advertisement_impl(p_id uuid, p_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare v_previous public.site_advertisements%rowtype; v_removed jsonb;
begin
  if not coalesce(private.is_home_config_admin(), false) then raise exception 'Admin access required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select * into v_previous from public.site_advertisements where id = p_id for update;
  if not found or p_updated_at is distinct from v_previous.updated_at then raise exception 'Advertisement changed; reload before deleting' using errcode = '40001'; end if;
  select coalesce(jsonb_agg(storage_path), '[]'::jsonb) into v_removed from public.site_advertisement_images where advertisement_id = p_id;
  delete from public.site_advertisements where id = p_id;
  return jsonb_build_object('removedPaths', v_removed);
end;
$$;
create or replace function public.save_site_advertisement(p_ad jsonb, p_images jsonb)
returns jsonb language sql security invoker set search_path = pg_catalog as $$ select private.save_site_advertisement_impl(p_ad, p_images); $$;
create or replace function public.delete_site_advertisement(p_id uuid, p_updated_at timestamptz)
returns jsonb language sql security invoker set search_path = pg_catalog as $$ select private.delete_site_advertisement_impl(p_id, p_updated_at); $$;
revoke all on function private.save_site_advertisement_impl(jsonb,jsonb), private.delete_site_advertisement_impl(uuid,timestamptz), public.save_site_advertisement(jsonb,jsonb), public.delete_site_advertisement(uuid,timestamptz) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.save_site_advertisement_impl(jsonb,jsonb), private.delete_site_advertisement_impl(uuid,timestamptz), public.save_site_advertisement(jsonb,jsonb), public.delete_site_advertisement(uuid,timestamptz) to authenticated;
notify pgrst, 'reload schema';
