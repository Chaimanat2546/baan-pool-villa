-- Assign advertisement order on creation; preserve existing order on edits and ignore client ranks.
-- Retain old ranks, allowing generated ranks beyond the former manual-input limit.
alter table public.site_advertisements drop constraint if exists site_advertisements_sort_order_check;
alter table public.site_advertisements add constraint site_advertisements_sort_order_check check (sort_order >= 0);

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
  v_order bigint;
begin
  if not coalesce(private.is_home_config_admin(), false) then raise exception 'Admin access required' using errcode = '42501'; end if;
  if jsonb_typeof(p_ad) is distinct from 'object' or jsonb_typeof(p_images) is distinct from 'array' then raise exception 'Invalid advertisement' using errcode = '22023'; end if;
  if jsonb_array_length(p_images) not between 1 and 2 or jsonb_typeof(p_ad->'isActive') is distinct from 'boolean' then raise exception 'Invalid advertisement images or state' using errcode = '22023'; end if;
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
  if v_exists then
    v_order := v_previous.sort_order;
  else
    -- Serialize append allocation across different advertisement IDs.
    perform pg_advisory_xact_lock(hashtextextended('site-advertisement-append-order', 0));
    select coalesce(max(sort_order)::bigint, -1) + 1 into v_order from public.site_advertisements;
    if v_order > 2147483647 then raise exception 'Advertisement order capacity reached' using errcode = '22023'; end if;
  end if;
  insert into public.site_advertisements (id, title, zone, is_active, sort_order)
    values (v_id, btrim(p_ad->>'title'), p_ad->>'zone', (p_ad->>'isActive')::boolean, v_order)
    on conflict (id) do update set title = excluded.title, zone = excluded.zone, is_active = excluded.is_active, updated_at = clock_timestamp()
    returning updated_at into v_updated;
  delete from public.site_advertisement_images where advertisement_id = v_id;
  insert into public.site_advertisement_images (id, advertisement_id, storage_path, display_order)
    select (x.value->>'id')::uuid, v_id, x.value->>'storagePath', x.ordinality - 1 from jsonb_array_elements(p_images) with ordinality x(value, ordinality);
  update public.site_advertisement_uploads u set attached_at = coalesce(u.attached_at, now())
    where exists (select 1 from public.site_advertisement_images i where i.advertisement_id = v_id and i.id = u.id);
  return jsonb_build_object('id', v_id, 'updatedAt', v_updated, 'removedPaths', v_removed);
end;
$$;

notify pgrst, 'reload schema';
