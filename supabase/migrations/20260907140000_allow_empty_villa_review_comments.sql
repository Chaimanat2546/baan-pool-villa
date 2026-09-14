-- Existing databases may already have the original non-empty comment check.
do $comment_constraint$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.villa_reviews'::regclass
      and conname = 'villa_reviews_comment_check'
  ) then
    alter table public.villa_reviews
      drop constraint villa_reviews_comment_check;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.villa_reviews'::regclass
      and conname = 'villa_reviews_comment_length_check'
  ) then
    alter table public.villa_reviews
      add constraint villa_reviews_comment_length_check
      check (char_length(btrim(comment)) <= 1000);
  end if;
end;
$comment_constraint$;

do $image_url_constraint$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.villa_review_images'::regclass
      and conname = 'villa_review_images_check'
  ) then
    alter table public.villa_review_images
      drop constraint villa_review_images_check;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.villa_review_images'::regclass
      and conname = 'villa_review_images_public_url_check'
  ) then
    alter table public.villa_review_images
      drop constraint villa_review_images_public_url_check;
  end if;

  alter table public.villa_review_images
    add constraint villa_review_images_public_url_check
    check (
      public_url ~ '^(https://[a-zA-Z0-9][a-zA-Z0-9.-]+(:[0-9]{1,5})?|http://(localhost|127\.0\.0\.1)(:[0-9]{1,5})?)/storage/v1/object/public/villa-reviews/'
      and right(public_url, length('/storage/v1/object/public/villa-reviews/' || storage_path))
        = '/storage/v1/object/public/villa-reviews/' || storage_path
    );
end;
$image_url_constraint$;

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

notify pgrst, 'reload schema';
