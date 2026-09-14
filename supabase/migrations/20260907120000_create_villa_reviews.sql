-- Tenant CMS data: villa ids refer to the external catalog, not a local table.
create table if not exists public.villa_reviews (
  id uuid primary key default gen_random_uuid(),
  villa_id text not null check (villa_id <> '' and villa_id = btrim(villa_id)),
  booking_code text not null check (booking_code <> '' and booking_code = btrim(booking_code)),
  phone_e164 text not null check (phone_e164 ~ '^\+66[0-9]{9}$'),
  masked_phone text generated always as ('xxx-xxxx-' || right(phone_e164, 4)) stored,
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(btrim(comment)) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint villa_reviews_booking_code_unique unique (booking_code)
);

create index if not exists villa_reviews_villa_created_at_idx
  on public.villa_reviews (villa_id, created_at desc, id desc);

create index if not exists villa_reviews_villa_rating_idx
  on public.villa_reviews (villa_id, rating desc, id desc);

create table if not exists public.villa_review_images (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.villa_reviews(id) on delete cascade,
  storage_bucket text not null default 'villa-reviews' check (storage_bucket = 'villa-reviews'),
  storage_path text not null unique
    check (storage_path ~ '^villa-reviews/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp)$'),
  public_url text not null
    check (
      public_url ~ '^(https://[a-zA-Z0-9][a-zA-Z0-9.-]+(:[0-9]{1,5})?|http://(localhost|127\.0\.0\.1)(:[0-9]{1,5})?)/storage/v1/object/public/villa-reviews/'
      and right(public_url, length('/storage/v1/object/public/villa-reviews/' || storage_path))
        = '/storage/v1/object/public/villa-reviews/' || storage_path
    ),
  display_order integer not null check (display_order between 1 and 5),
  created_at timestamptz not null default now(),
  constraint villa_review_images_review_order_unique unique (review_id, display_order)
);

create table if not exists public.villa_review_edit_logs (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.villa_reviews(id) on delete cascade,
  edited_by uuid references auth.users(id) on delete set null,
  before_snapshot jsonb not null check (jsonb_typeof(before_snapshot) = 'object'),
  after_snapshot jsonb not null check (jsonb_typeof(after_snapshot) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists villa_review_edit_logs_review_created_at_idx
  on public.villa_review_edit_logs (review_id, created_at desc, id desc);

drop trigger if exists villa_reviews_set_updated_at on public.villa_reviews;
create trigger villa_reviews_set_updated_at
  before update on public.villa_reviews
  for each row execute function private.set_updated_at();

alter table public.villa_reviews enable row level security;
alter table public.villa_review_images enable row level security;
alter table public.villa_review_edit_logs enable row level security;

-- No browser policies or base-table grants, including authenticated admins.
-- Admin APIs use the server's service role after their own admin authorization.
revoke all on table public.villa_reviews
  from public, anon, authenticated, service_role;
revoke all on table public.villa_review_images
  from public, anon, authenticated, service_role;
revoke all on table public.villa_review_edit_logs
  from public, anon, authenticated, service_role;

-- Parent/image creation goes through the atomic RPC, not separate REST inserts.
grant select, update, delete on table public.villa_reviews, public.villa_review_images
  to service_role;
grant select, insert on table public.villa_review_edit_logs to service_role;

-- Intentionally use owner permissions: an invoker view would require browser
-- grants on private base data. This view is the only public read projection.
create or replace view public.villa_reviews_public
with (security_barrier = true, security_invoker = false)
as
select
  r.id,
  r.villa_id,
  r.rating,
  r.comment,
  r.masked_phone,
  r.created_at,
  r.updated_at,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('id', i.id, 'url', i.public_url)
        order by i.display_order
      )
      from public.villa_review_images i
      where i.review_id = r.id
    ),
    '[]'::jsonb
  ) as images
from public.villa_reviews r;

revoke all on table public.villa_reviews_public from public, anon, authenticated, service_role;
grant select on table public.villa_reviews_public to anon, authenticated, service_role;

-- A public bucket permits image downloads; it does not permit public uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'villa-reviews',
  'villa-reviews',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- A restrictive bucket-scoped policy also defeats broader permissive policies.
-- Do not revoke storage.objects globally: other CMS buckets still need grants.
drop policy if exists "Villa review storage browser boundary" on storage.objects;
create policy "Villa review storage browser boundary"
  on storage.objects
  as restrictive
  for all
  to anon, authenticated
  using (bucket_id <> 'villa-reviews')
  with check (bucket_id <> 'villa-reviews');

grant select, insert, update, delete on table storage.objects to service_role;

create or replace function private.submit_villa_review_impl(
  p_villa_id text,
  p_booking_code text,
  p_phone_e164 text,
  p_rating integer,
  p_comment text,
  p_images jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_review_id uuid;
  v_image jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the service role can submit villa reviews'
      using errcode = '42501';
  end if;

  if p_villa_id is null or btrim(p_villa_id) = '' then
    raise exception 'Invalid villa id' using errcode = '22023';
  end if;
  if p_booking_code is null or btrim(p_booking_code) = '' then
    raise exception 'Invalid booking code' using errcode = '22023';
  end if;
  if p_phone_e164 is null or p_phone_e164 !~ '^\+66[0-9]{9}$' then
    raise exception 'Invalid Thai phone number' using errcode = '22023';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Invalid review rating' using errcode = '22023';
  end if;
  if p_comment is null or char_length(btrim(p_comment)) > 1000 then
    raise exception 'Invalid review comment' using errcode = '22023';
  end if;

  if jsonb_typeof(p_images) is distinct from 'array' then
    raise exception 'Review images must be an array' using errcode = '22023';
  end if;

  if jsonb_array_length(p_images) > 5 then
    raise exception 'A review can contain at most five images' using errcode = '22023';
  end if;

  for v_image in select value from jsonb_array_elements(p_images)
  loop
    if jsonb_typeof(v_image) is distinct from 'object' then
      raise exception 'Invalid review image object' using errcode = '22023';
    end if;

    if jsonb_typeof(v_image -> 'storage_path') is distinct from 'string'
      or jsonb_typeof(v_image -> 'public_url') is distinct from 'string'
      or v_image - array['storage_path', 'public_url'] <> '{}'::jsonb
      or (v_image ->> 'storage_path') !~ '^villa-reviews/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp)$'
      or (v_image ->> 'public_url') !~ '^(https://[a-zA-Z0-9][a-zA-Z0-9.-]+(:[0-9]{1,5})?|http://(localhost|127\.0\.0\.1)(:[0-9]{1,5})?)/storage/v1/object/public/villa-reviews/'
      or right(v_image ->> 'public_url', length('/storage/v1/object/public/villa-reviews/' || (v_image ->> 'storage_path')))
        <> '/storage/v1/object/public/villa-reviews/' || (v_image ->> 'storage_path')
    then
      raise exception 'Invalid review image metadata' using errcode = '22023';
    end if;
  end loop;

  -- A unique booking code violation deliberately propagates as SQLSTATE 23505.
  -- Any image insert failure rolls back the parent insert in the same call.
  insert into public.villa_reviews (villa_id, booking_code, phone_e164, rating, comment)
  values (btrim(p_villa_id), btrim(p_booking_code), p_phone_e164, p_rating, btrim(p_comment))
  returning id into v_review_id;

  insert into public.villa_review_images (review_id, storage_path, public_url, display_order)
  select
    v_review_id,
    image.value ->> 'storage_path',
    image.value ->> 'public_url',
    image.display_order::integer
  from jsonb_array_elements(p_images) with ordinality as image(value, display_order);

  return v_review_id;
end;
$$;

create or replace function public.submit_villa_review(
  p_villa_id text,
  p_booking_code text,
  p_phone_e164 text,
  p_rating integer,
  p_comment text,
  p_images jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return private.submit_villa_review_impl(
    p_villa_id, p_booking_code, p_phone_e164, p_rating, p_comment, p_images
  );
end;
$$;

revoke all on function private.submit_villa_review_impl(text, text, text, integer, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.submit_villa_review(text, text, text, integer, text, jsonb)
  from public, anon, authenticated, service_role;

grant usage on schema private to service_role;
grant execute on function private.submit_villa_review_impl(text, text, text, integer, text, jsonb)
  to service_role;
grant execute on function public.submit_villa_review(text, text, text, integer, text, jsonb)
  to service_role;

-- Add reviews without replacing saved layout choices or duplicating an existing
-- review block, including one deliberately placed in a V2 narrow/bottom area.
do $review_layout_patch$
declare
  v_setting record;
  v_path text[];
  v_rows jsonb;
  v_row record;
  v_target integer;
  v_offset integer;
  v_details boolean;
  v_review_row jsonb;
  v_new_rows jsonb;
  v_part jsonb;
  v_blocks jsonb;
  v_part_number integer;
  v_count integer;
begin
  for v_setting in
    select id, detail_layout from public.site_settings
    where detail_layout ->> 'version' in ('1', '2')
      and not jsonb_path_exists(detail_layout, '$.** ? (@.type == "villa_reviews")')
  loop
    v_path := case when v_setting.detail_layout ->> 'version' = '1'
      then array['rows'] else array['mainSplit', 'wideRows'] end;
    v_rows := v_setting.detail_layout #> v_path;
    if jsonb_typeof(v_rows) is distinct from 'array' then continue; end if;

    -- Prefer the details anchor; when absent, insert before booking, or append.
    select r.n::integer, b.n::integer, b.value ->> 'type' = 'details'
      into v_target, v_offset, v_details
    from jsonb_array_elements(v_rows) with ordinality r(value, n)
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(r.value -> 'blocks') = 'array'
        then r.value -> 'blocks' else '[]'::jsonb end
    ) with ordinality b(value, n)
    where b.value ->> 'type' in ('details', 'booking_contact')
    order by (b.value ->> 'type' = 'details') desc, r.n, b.n
    limit 1;

    v_review_row := jsonb_build_object(
      'id', 'villa_reviews_' || gen_random_uuid()::text,
      'columns', 1, 'enabled', true,
      'blocks', jsonb_build_array(jsonb_build_object(
        'type', 'villa_reviews', 'title', 'รีวิวจากผู้เข้าพัก',
        'enabled', true, 'hideWhenEmpty', true
      ))
    );
    v_new_rows := '[]'::jsonb;
    for v_row in select value, n from jsonb_array_elements(v_rows) with ordinality r(value, n)
    loop
      if v_row.n is distinct from v_target then
        v_new_rows := v_new_rows || jsonb_build_array(v_row.value);
        continue;
      end if;

      if v_setting.detail_layout ->> 'version' = '2' then
        -- V2 keeps the existing details/amenities group and narrow booking side.
        v_new_rows := v_new_rows || case when v_details
          then jsonb_build_array(v_row.value, v_review_row)
          else jsonb_build_array(v_review_row, v_row.value) end;
        continue;
      end if;

      if not v_details then v_offset := v_offset - 1; end if;
      v_count := jsonb_array_length(v_row.value -> 'blocks');
      if v_offset = 0 then
        v_new_rows := v_new_rows || jsonb_build_array(v_review_row, v_row.value);
      elsif v_offset = v_count then
        v_new_rows := v_new_rows || jsonb_build_array(v_row.value, v_review_row);
      else
        -- A V1 details/booking row must split to fit a dedicated review row.
        -- Preserve every block and row field except the necessary grid/id edits.
        for v_part_number in 1..2 loop
          select jsonb_agg(b.value order by b.n) into v_blocks
          from jsonb_array_elements(v_row.value -> 'blocks') with ordinality b(value, n)
          where (v_part_number = 1 and b.n <= v_offset)
            or (v_part_number = 2 and b.n > v_offset);
          v_count := jsonb_array_length(v_blocks);
          v_part := (v_row.value - 'ratio') || jsonb_build_object('columns', v_count, 'blocks', v_blocks);
          if v_count = 2 then
            v_part := v_part || jsonb_build_object('ratio', coalesce(v_row.value ->> 'ratio', '50/50'));
          end if;
          if v_part_number = 2 then
            v_part := v_part || jsonb_build_object('id', coalesce(v_row.value ->> 'id', 'row') || '_' || gen_random_uuid()::text);
          end if;
          v_new_rows := v_new_rows || jsonb_build_array(v_part);
          if v_part_number = 1 then v_new_rows := v_new_rows || jsonb_build_array(v_review_row); end if;
        end loop;
      end if;
    end loop;
    if v_target is null then v_new_rows := v_new_rows || jsonb_build_array(v_review_row); end if;
    update public.site_settings
    set detail_layout = jsonb_set(detail_layout, v_path, v_new_rows, false)
    where id = v_setting.id;
  end loop;
end;
$review_layout_patch$;

notify pgrst, 'reload schema';
