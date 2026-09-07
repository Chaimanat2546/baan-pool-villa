# Admin villa reviews design

## Goal

Provide an authenticated admin workflow for moderating villa reviews without
exposing private review data publicly or leaving database rows and review-image
storage out of sync.

## Confirmed product rules

- Public pages show only a masked phone number.
- An authorized admin can view the full phone number and booking code in the
  review detail, but not in the list by default.
- An admin may edit rating, comment, and review images. Villa, booking code,
  phone number, and original submission time are immutable.
- A review allows at most five JPG, PNG, or WebP images, each at most 5 MB.
- Admin edits use the same 1,000-character limit and inappropriate-word filter
  as public review submission.
- Deletes are permanent: the review stops appearing publicly immediately and
  its image objects are cleaned up after the database delete succeeds.

## Data and mutation boundary

Create an idempotent migration that adds private RPCs:

- `private.update_villa_review_admin_impl(...)` locks one review, verifies its
  retained image IDs, replaces its selected image metadata, updates rating and
  comment, and inserts one `villa_review_edit_logs` row in the same database
  transaction.
- `private.delete_villa_review_admin_impl(...)` returns the image storage paths,
  deletes the review, and relies on existing FK cascades for image rows and
  edit logs.
- Narrow public invoker wrappers are executable only by `service_role`.

The trusted admin route obtains the verified admin user ID from the existing
admin authentication result and passes it to the RPC. The browser never sends
an editor ID. The before/after snapshots include rating, comment, ordered image
metadata, and immutable review identity context sufficient to interpret an
edit. The edit-log panel reads the logs through a server-only admin service.

Storage cannot be in the same Postgres transaction. The server uploads new,
validated files first; if the RPC fails it removes only those new uploads. On a
successful RPC it performs old-image cleanup. A cleanup failure leaves an
unreferenced object but never restores deleted public metadata or reports a
failed save after a committed database edit.

## Admin read API

Use a private, server-only admin DTO rather than `villa_reviews_public`.

- List DTO: ID, villa ID/title, rating, masked phone, dates, excerpt, image
  count.
- Detail DTO: list fields plus full phone, booking code, full ordered images,
  and edit logs.
- `GET /api/admin/villa-reviews` accepts bounded cursor pagination (25 records),
  query search for villa/title, booking code, or phone, and optional rating.
- `GET /api/admin/villa-reviews/[id]` returns the detail DTO.
- `PATCH /api/admin/villa-reviews/[id]` accepts `FormData`, validates it, uploads
  new images, invokes the update RPC, revalidates only that villa review tag,
  and returns the fresh detail DTO.
- `DELETE /api/admin/villa-reviews/[id]` invokes the delete RPC, cleans returned
  storage paths, revalidates that villa review tag, and returns success even
  when non-critical post-delete cleanup is queued/reported separately.

Routes use the existing origin and bearer-token protection. Malformed form data
returns 400; missing records return 404; authorization failures keep the shared
admin response; Supabase failures expose safe message/code/details/hint values.

## Admin UI

Follow the existing master-detail-preview layout:

- Left: paginated review list, search, rating filter, loading/empty/error states.
- Center: immutable review identity, editable stars/comment, image manager,
  field errors, save/delete states, and the latest submission/edit times.
- Right: image preview and chronological edit history showing before/after
  changes. It is hidden or stacks below on narrow screens.

New files are locally previewed with object URLs, can be removed before save,
and are validated immediately. The editor blocks selection beyond five combined
retained-plus-new images; it reports invalid type, extension mismatch, and
per-file size errors next to the relevant file. All object URLs are revoked on
removal, editor change, and unmount.

On successful save the API response replaces the selected record and list row;
the old draft/files/errors are cleared so a second save cannot resubmit stale
attachments. Public review cache invalidation makes the public villa page show
the new state on its next read.

## Verification

- Pure validation: fields, profanity, per-image constraints, count, and image
  ownership.
- RPC/migration contract: privilege checks, locking, before/after log, and
  returned cleanup paths.
- Route tests: auth, pagination/filtering, 400/404/error mapping, cache
  invalidation, and cleanup behavior.
- Component tests: loading, empty/error, search/filter, draft image lifecycle,
  field errors, success-state replacement, and history rendering.
- Local browser checks: desktop and mobile admin layouts; edited review/photo
  appears correctly on the public villa detail page.
