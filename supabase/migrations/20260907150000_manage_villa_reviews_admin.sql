-- Admin review RPC contract (server-only service_role callers):
-- update(review_id, verified editor_id, rating, comment, retained UUID[], new JSON[])
-- returns { review_id, villa_id, removed_storage_paths, images }.
-- delete(review_id, verified editor_id) returns
-- { review_id, villa_id, removed_storage_paths }.
-- Images and audit snapshots use database column names; images are ordered by
-- display_order and include id, review_id, storage_bucket, storage_path,
-- public_url, display_order, and created_at. Snapshots include the complete
-- review row (including immutable identity) plus that ordered images array.
-- Only the authenticated admin server supplies editor_id. Each new image must
-- be exactly { storage_path, public_url }, built from a fresh server upload;
-- the application must never forward browser-provided paths or editor IDs.
-- Storage cleanup happens ONLY after a successful committed RPC. Returned paths
-- are metadata removals, not a request to delete storage inside this transaction.

create or replace function private.update_villa_review_admin_impl(
  p_review_id uuid,
  p_editor_id uuid,
  p_rating smallint,
  p_comment text,
  p_retained_image_ids uuid[],
  p_new_images jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_review public.villa_reviews%rowtype;
  v_before_snapshot jsonb;
  v_after_snapshot jsonb;
  v_images jsonb;
  v_removed_storage_paths jsonb;
  v_image jsonb;
  v_retained_image record;
  v_display_order integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the service role can manage villa reviews'
      using errcode = '42501';
  end if;
  if p_editor_id is null then
    raise exception 'Invalid review editor' using errcode = '22023';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Invalid review rating' using errcode = '22023';
  end if;
  if p_comment is null or char_length(btrim(p_comment)) > 1000 then
    raise exception 'Invalid review comment' using errcode = '22023';
  end if;
  if p_retained_image_ids is null
    or coalesce(array_ndims(p_retained_image_ids), 1) <> 1
    or cardinality(p_retained_image_ids) > 5
  then
    raise exception 'Invalid retained review image IDs' using errcode = '22023';
  end if;
  if jsonb_typeof(p_new_images) is distinct from 'array' then
    raise exception 'Review images must be an array' using errcode = '22023';
  end if;
  if cardinality(p_retained_image_ids) + jsonb_array_length(p_new_images) > 5 then
    raise exception 'A review can contain at most five images' using errcode = '22023';
  end if;

  select r.* into v_review from public.villa_reviews r
  where r.id = p_review_id for update;
  if not found then
    raise exception 'Villa review not found' using errcode = 'P0002';
  end if;

  -- All admin mutations take the parent lock first. Lock existing image rows
  -- as well so their metadata cannot change while constructing the snapshots.
  perform i.id from public.villa_review_images i
  where i.review_id = p_review_id order by i.display_order, i.id for update;

  -- Matching row count also rejects duplicate, NULL, and foreign UUIDs.
  if (select count(*) from public.villa_review_images i
      where i.review_id = p_review_id and i.id = any(p_retained_image_ids))
    <> cardinality(p_retained_image_ids)
  then
    raise exception 'Invalid retained review image IDs' using errcode = '22023';
  end if;

  for v_image in select value from jsonb_array_elements(p_new_images)
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
    -- Reusing a removed path would cause post-commit cleanup to delete an
    -- image still referenced by the replacement row. Fresh uploads only.
    if exists (select 1 from public.villa_review_images i
      where i.review_id = p_review_id
        and i.storage_path = v_image ->> 'storage_path')
    then
      raise exception 'New review images must use fresh storage paths'
        using errcode = '22023';
    end if;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(i) order by i.display_order, i.id), '[]'::jsonb)
    into v_images from public.villa_review_images i where i.review_id = p_review_id;
  v_before_snapshot := to_jsonb(v_review) || jsonb_build_object('images', v_images);

  select coalesce(jsonb_agg(i.storage_path order by i.display_order, i.id), '[]'::jsonb)
    into v_removed_storage_paths from public.villa_review_images i
    where i.review_id = p_review_id and not (i.id = any(p_retained_image_ids));
  delete from public.villa_review_images i
    where i.review_id = p_review_id and not (i.id = any(p_retained_image_ids));

  -- Retained input is a set, not a reorder request. Compress in original
  -- ascending order, one row at a time: every lower destination is now free.
  -- This respects the immediate UNIQUE(review_id, display_order) and 1..5 CHECK.
  for v_retained_image in
    select i.id from public.villa_review_images i
    where i.review_id = p_review_id order by i.display_order, i.id
  loop
    v_display_order := v_display_order + 1;
    update public.villa_review_images set display_order = v_display_order
      where review_id = p_review_id and id = v_retained_image.id;
  end loop;

  insert into public.villa_review_images (review_id, storage_path, public_url, display_order)
  select p_review_id, image.value ->> 'storage_path', image.value ->> 'public_url',
    v_display_order + image.ordinality::integer
  from jsonb_array_elements(p_new_images) with ordinality as image(value, ordinality);

  update public.villa_reviews
    set rating = p_rating, comment = btrim(p_comment), updated_at = now()
    where id = p_review_id returning * into v_review;
  select coalesce(jsonb_agg(to_jsonb(i) order by i.display_order, i.id), '[]'::jsonb)
    into v_images from public.villa_review_images i where i.review_id = p_review_id;
  v_after_snapshot := to_jsonb(v_review) || jsonb_build_object('images', v_images);

  -- No exception handler: any image, update, or audit failure rolls back all
  -- changes in this RPC, including generated image IDs and removed metadata.
  insert into public.villa_review_edit_logs
    (review_id, edited_by, before_snapshot, after_snapshot)
  values (p_review_id, p_editor_id, v_before_snapshot, v_after_snapshot);

  return jsonb_build_object('review_id', p_review_id, 'villa_id', v_review.villa_id,
    'removed_storage_paths', v_removed_storage_paths, 'images', v_images);
end;
$$;

create or replace function private.delete_villa_review_admin_impl(
  p_review_id uuid,
  p_editor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_review public.villa_reviews%rowtype;
  v_removed_storage_paths jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the service role can manage villa reviews'
      using errcode = '42501';
  end if;
  if p_editor_id is null then
    raise exception 'Invalid review editor' using errcode = '22023';
  end if;
  select r.* into v_review from public.villa_reviews r
    where r.id = p_review_id for update;
  if not found then
    raise exception 'Villa review not found' using errcode = 'P0002';
  end if;
  perform i.id from public.villa_review_images i
    where i.review_id = p_review_id order by i.display_order, i.id for update;
  select coalesce(jsonb_agg(i.storage_path order by i.display_order, i.id), '[]'::jsonb)
    into v_removed_storage_paths from public.villa_review_images i
    where i.review_id = p_review_id;

  -- Existing foreign keys cascade images AND edit logs on permanent deletion.
  delete from public.villa_reviews where id = p_review_id;
  return jsonb_build_object('review_id', p_review_id, 'villa_id', v_review.villa_id,
    'removed_storage_paths', v_removed_storage_paths);
end;
$$;

create or replace function public.update_villa_review_admin(
  p_review_id uuid,
  p_editor_id uuid,
  p_rating smallint,
  p_comment text,
  p_retained_image_ids uuid[],
  p_new_images jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return private.update_villa_review_admin_impl(
    p_review_id, p_editor_id, p_rating, p_comment, p_retained_image_ids, p_new_images
  );
end;
$$;

create or replace function public.delete_villa_review_admin(p_review_id uuid, p_editor_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return private.delete_villa_review_admin_impl(p_review_id, p_editor_id);
end;
$$;

revoke all on function private.update_villa_review_admin_impl(uuid, uuid, smallint, text, uuid[], jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.delete_villa_review_admin_impl(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.update_villa_review_admin(uuid, uuid, smallint, text, uuid[], jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_villa_review_admin(uuid, uuid)
  from public, anon, authenticated, service_role;

grant usage on schema private to service_role;
grant execute on function private.update_villa_review_admin_impl(uuid, uuid, smallint, text, uuid[], jsonb)
  to service_role;
grant execute on function private.delete_villa_review_admin_impl(uuid, uuid) to service_role;
grant execute on function public.update_villa_review_admin(uuid, uuid, smallint, text, uuid[], jsonb)
  to service_role;
grant execute on function public.delete_villa_review_admin(uuid, uuid) to service_role;

notify pgrst, 'reload schema';

-- Manual assertions (disposable/local database only; no project SQL test runner):
-- Apply this migration twice; both applications must succeed. Use a transaction
-- that ends with ROLLBACK for fixtures. Set request.jwt.claim.role='service_role'
-- and SET LOCAL ROLE service_role for successful wrapper calls. A real fixture
-- auth.users ID must be passed as editor_id; never use a production user/row.
-- 1. Submit review A with five images (I1..I5) and review B with one image (J1).
--    update(A, editor, 4::smallint, ' edited ', ARRAY[I5,I2], [fresh N1,N2])
--    must return images I2,I5,N1,N2 with display_order [1,2,3,4], and removed
--    paths [I1.path,I3.path,I4.path] in that order. Retained IDs, URLs, storage
--    paths, and created_at must remain unchanged; new rows have fresh IDs.
-- 2. SELECT before_snapshot, after_snapshot, edited_by FROM
--    public.villa_review_edit_logs WHERE review_id=A must yield exactly one row:
--    before images I1..I5; after images exactly equal returned images; rating=4,
--    comment='edited'; edited_by=editor. Before/after villa_id, booking_code,
--    phone_e164, created_at must equal the original review. Empty comment works.
-- 3. Retained arrays [I2,I2], [J1], [NULL], NULL, and multidimensional arrays
--    must raise 22023. Six combined images, non-array new_images, extra object
--    keys, non-string metadata, mismatched URL/path, and reuse of a removed
--    path must raise 22023. Confirm review, images, and logs are unchanged.
-- 4. Force a late failure with a non-null editor UUID absent from auth.users:
--    update(A, absent_editor, 1::smallint, 'rollback', '{}', [fresh N3]) must
--    raise 23503 at audit insertion. Review/images/logs must equal their exact
--    pre-call rows (including timestamps); no N3 metadata may remain. Repeated
--    new storage paths must similarly raise 23505 and roll back everything.
-- 5. delete(A, editor) must return all current paths in display order; SELECT
--    count(*) FROM each of villa_reviews (id=A), villa_review_images and
--    villa_review_edit_logs (review_id=A) must be zero. B and J1 are unchanged.
--    A second delete or update of A must raise P0002 'Villa review not found'.
-- 6. For each wrapper and private signature above, SELECT
--    has_function_privilege('anon', '<signature>', 'EXECUTE') and the same for
--    'authenticated' must be false; for 'service_role' must be true. SET LOCAL
--    ROLE anon (then authenticated) and invoke each wrapper: expect 42501.
--    Reset DB role; set request.jwt.claim.role='authenticated' (also unset it)
--    and invoke each private function as owner: expect 42501 from role guard.
-- 7. Two local sessions: session A BEGIN; SELECT id FROM villa_reviews WHERE
--    id=A FOR UPDATE; session B update/delete(A) must wait. After A COMMIT,
--    session B must observe the committed row. Repeat with A deleting review A:
--    session B must raise P0002 after A commits, without creating an audit row.
