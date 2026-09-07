# Admin Villa Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/admin/villa-reviews` into a safe, complete moderation workspace: admins can find a review, see private booking/phone data in its detail view, edit rating/comment/images with audit history, or permanently delete it while public villa pages stay consistent.

**Architecture:** Keep public reviews and their public view unchanged. Add a private, server-only admin query/mutation layer over the base review tables. Use small privileged RPC wrappers for transactional database work and return only storage paths to clean up after a successful database commit. The admin route authenticates once, derives the trusted editor ID from that result, and never accepts editor identity from the browser. The client is a responsive master-detail-preview workspace fed by paginated list and single-detail endpoints.

**Tech Stack:** Next.js 16 App Router, TypeScript, React, Supabase Postgres/Storage, Vitest, Testing Library, Tailwind, Lucide, existing `bad-words-thai` filtering.

**Spec:** `docs/superpowers/specs/2026-09-07-admin-villa-reviews-design.md`

## Global constraints

- Do not alter public review rules: one booking code globally, masked phone on public pages, max 5 images, and per-image (not aggregate) 5 MB limit.
- Only rating, comment, and images are mutable. `villa_id`, booking code, phone, and original submission timestamp are immutable.
- Preserve any user changes already present in the working tree. Do not commit unless ภู explicitly asks.
- Reuse `MAX_REVIEW_IMAGES`, `MAX_REVIEW_IMAGE_BYTES`, file validation, profanity list, `revalidateVillaReviewsCache`, admin auth, and admin error conventions rather than duplicate constants or rules.
- Keep Supabase service-role use server-only. Browser payloads must never contain a user/editor id or service credentials.
- Storage cleanup is best effort only after the database transaction commits. A cleanup failure must not turn a completed edit/delete into a client-visible failed save.
- Update `docs/ai/structure.html` for the added admin detail route, private RPC contract, and targeted verification guidance.

---

## Task 1: Define admin contracts and reuse moderation validation

**Files:**
- Modify: `lib/villa-reviews/types.ts`
- Modify: `lib/villa-reviews/validation.ts`
- Modify: `lib/villa-reviews/admin.ts`
- Modify: `lib/villa-reviews/__tests__/admin.test.ts`
- Modify: `lib/villa-reviews/__tests__/validation.test.ts`

- [ ] **Step 1: Write failing validation tests first.**
  - Cover an admin draft with ratings 1 and 5, an empty optional comment, a 1,000-character comment, and a prohibited Thai/English word.
  - Cover rejected rating values, `1001` characters, non-UUID retained image IDs, duplicate retained image IDs, and more than five combined retained/new images.
  - Assert errors are field-addressable (`rating`, `comment`, `images`) and prohibited-word feedback identifies the offending word without persisting the draft.

- [ ] **Step 2: Add explicit private/admin DTOs.**
  - Define `AdminVillaReviewListItem`, `AdminVillaReviewDetail`, `AdminVillaReviewImage`, `VillaReviewEditLog`, `AdminVillaReviewListQuery`, and `AdminVillaReviewListResult` in `types.ts` (or retain equivalent types in `admin.ts` only if no public consumer needs them).
  - List items must contain masked phone only. Detail may contain `phoneE164` and `bookingCode`; it must never be returned by public services/routes.
  - Include ISO timestamps for `createdAt`, `updatedAt`, and edit-log `createdAt`; format relative time only in the client.

- [ ] **Step 3: Extract a shared content validator.**
  - Refactor `validateReviewSubmission` so its rating/comment/profanity code is callable by both public submission and admin edit validation without changing public error copy or behavior.
  - Add `validateAdminReviewUpdate(input)` that validates only mutable fields and retained image identifiers. It returns normalized values plus `fieldErrors` and detected prohibited words.
  - Keep `validateReviewFiles` the one owner of MIME, extension, count, and per-file 5 MB rules; pass existing-image count so the total is enforced correctly.

- [ ] **Step 4: Run focused tests.**
  - Run `npm.cmd test -- lib/villa-reviews/__tests__/admin.test.ts lib/villa-reviews/__tests__/validation.test.ts`.
  - Expected: new validation behavior is covered without breaking public submission tests.

## Task 2: Carry the verified administrator identity through auth

**Files:**
- Modify: `lib/admin/home-config-auth.ts`
- Modify: `lib/admin/__tests__/home-config-auth.test.ts` (or the existing matching auth test file found by `rg --files lib/admin | rg 'auth.*test|test.*auth'`)

- [ ] **Step 1: Write the auth-result test first.**
  - For a valid active admin, assert `assertHomeConfigAdmin(token)` returns the verified Supabase `user.id` as `userId` together with the scoped client.
  - For every existing failed-auth path, assert no `userId` is exposed.

- [ ] **Step 2: Extend only the success result.**
  - Change the successful `AdminCheckResult` branch to `{ ok: true; supabase; userId }` and return the already verified `userId` at the end of `assertHomeConfigAdmin`.
  - Keep `requireHomeConfigAdmin`’s public error semantics and all existing callers source-compatible; callers that do not need the ID simply ignore it.

- [ ] **Step 3: Run the focused auth tests.**
  - Run the matching auth test file plus TypeScript/lint checks for `lib/admin/home-config-auth.ts`.

## Task 3: Add transactional admin review RPCs

**Files:**
- Add: `supabase/migrations/20260907150000_manage_villa_reviews_admin.sql`
- Modify: `supabase/migrations/20260907120000_create_villa_reviews.sql` only if a required existing function/type must be corrected; otherwise leave migration history intact.
- Add: `supabase/tests/villa_reviews_admin_rpc.sql` if the project has a migration/RPC SQL test convention; otherwise document manual SQL assertions beside the migration.

- [ ] **Step 1: Specify the testable RPC payload contract in comments/tests.**
  - `private.update_villa_review_admin_impl(p_review_id uuid, p_editor_id uuid, p_rating smallint, p_comment text, p_retained_image_ids uuid[], p_new_images jsonb)` returns one JSON object with `review_id`, `villa_id`, `removed_storage_paths`, and fresh ordered image metadata.
  - `private.delete_villa_review_admin_impl(p_review_id uuid, p_editor_id uuid)` returns `review_id`, `villa_id`, and all removed storage paths.
  - `p_new_images` accepts an allowlisted object shape `{ storage_path, public_url }`; generated server paths are the only permitted values at the application boundary.

- [ ] **Step 2: Implement idempotent private functions.**
  - Use `create or replace function`; lock the target review with `FOR UPDATE` and raise a stable missing-review error when it does not exist.
  - In update, verify that every retained image ID belongs to the locked review and reject duplicates/foreign IDs. Select existing image rows in display order, delete only unretained rows, insert new rows after retained rows, and produce deterministic contiguous display orders.
  - Update only `rating`, `comment`, and `updated_at`.
  - Build `before_snapshot` and `after_snapshot` with immutable identity (`villa_id`, booking code, full phone, original created time) plus rating, comment, and ordered image metadata. Insert this log in the same transaction with the passed, server-authenticated `p_editor_id`.
  - In delete, lock, collect storage paths, delete the base review, and rely on FKs to cascade review images/logs. Do not try to retain an edit log after a permanent deletion.

- [ ] **Step 3: Add narrow service-role wrappers and grants.**
  - Expose `public.update_villa_review_admin(...)` and `public.delete_villa_review_admin(...)` wrappers only for `service_role`.
  - Revoke unintended `anon`/`authenticated` access to the private implementation and public wrappers; preserve current public read/write policies and public submission RPC unchanged.
  - Include `notify pgrst, 'reload schema'` after function changes.

- [ ] **Step 4: Verify migration behavior.**
  - Apply only the new migration in the local Supabase workflow, if configured; otherwise execute its idempotent SQL in a disposable/local environment.
  - Assert retained-image ownership rejection, atomic update + audit row, deterministic image order, permanent deletion, and wrapper privilege rejection for an anon role.

## Task 4: Build the private server-side admin review service

**Files:**
- Rewrite: `lib/villa-reviews/admin.ts`
- Add: `lib/villa-reviews/admin-types.ts` only if splitting makes `admin.ts` smaller and clearer; avoid a one-caller abstraction.
- Modify: `lib/villa-reviews/__tests__/admin.test.ts`
- Add/modify: tests for server service mocks under `lib/villa-reviews/__tests__/`

- [ ] **Step 1: Write service tests for database/storage ordering.**
  - Assert list reads base private review tables rather than `villa_reviews_public` and returns no full phone/booking code in a list row.
  - Assert detail returns full phone, booking code, ordered images, and chronological edit logs.
  - Assert update uploads validated new files before RPC; a failed RPC removes only newly uploaded paths and does not delete old storage.
  - Assert an RPC success revalidates `revalidateVillaReviewsCache(villaId)` and an old-file cleanup failure is reported to logs/telemetry but the returned save remains successful.
  - Assert delete calls its RPC before storage cleanup and still revalidates the affected villa cache when cleanup fails.

- [ ] **Step 2: Replace public-view reads with private DTO queries.**
  - Implement `listAdminVillaReviews(query)` against `villa_reviews` and `villa_review_images`; use `created_at,id` as a stable bounded cursor (25 records), optional rating, and a length-limited query string.
  - Search booking code, full phone, and villa ID in the review database. Resolve villa titles in one bounded catalog query using the existing `lib/villas/server.ts` listing data; if a title cannot be resolved, display the established fallback `พูลวิลล่า {villaId}` instead of failing the review list.
  - Implement `getAdminVillaReviewDetail(id)` with full private data and audit history. Treat a missing base review as `null`, not a generic Supabase failure.

- [ ] **Step 3: Implement mutation orchestration.**
  - `updateAdminVillaReview({ id, editorId, input, files })` performs server validation, creates collision-resistant paths, uploads files, calls the update RPC with normalized fields and generated new-image metadata, deletes the new uploads on transaction failure, then best-effort cleans only returned old paths and revalidates the one villa tag.
  - `deleteAdminVillaReview({ id, editorId })` invokes the delete RPC first, then performs best-effort returned-path cleanup and targeted revalidation.
  - Convert expected Supabase missing/validation failures to typed service errors with safe `message`, `code`, `details`, and `hint`; never include secret-bearing request details.

- [ ] **Step 4: Run focused service tests.**
  - Run `npm.cmd test -- lib/villa-reviews/__tests__/admin.test.ts` and all newly added server-service tests.

## Task 5: Complete and harden the admin API surface

**Files:**
- Modify: `app/(admin)/api/admin/villa-reviews/route.ts`
- Modify: `app/(admin)/api/admin/villa-reviews/[id]/route.ts`
- Add: `app/(admin)/api/admin/villa-reviews/[id]/__tests__/route.test.ts` (or follow the existing API test location convention)
- Add: `app/(admin)/api/admin/villa-reviews/__tests__/route.test.ts`

- [ ] **Step 1: Write route tests before route changes.**
  - Cover auth failure passthrough, invalid/overlong list query parameters, valid cursor/rating parsing, list response shape, detail 404, and safe 500 service error mapping.
  - Cover PATCH invalid `FormData` returning `400 { error, fieldErrors }`, forbidden words and image count/type/per-file-size errors, success with the auth-derived editor ID, and a missing review returning `404`.
  - Cover DELETE success, missing review, and expected Supabase error metadata serialization.

- [ ] **Step 2: Implement list and detail reads.**
  - `GET /api/admin/villa-reviews` parses `cursor`, `q`, and `rating` with explicit maximum lengths and returns `AdminVillaReviewListResult`.
  - `GET /api/admin/villa-reviews/[id]` validates UUID syntax before the service query and returns the private detail DTO only after `requireHomeConfigAdmin` succeeds.

- [ ] **Step 3: Implement consistent mutation parsing/error handling.**
  - In PATCH, parse strings and `File` instances explicitly; delegate all content/file validation to Task 1/4 services; pass `auth.userId`, never a client-provided ID.
  - In DELETE, call the delete service with `auth.userId`.
  - Preserve detailed safe Supabase fields (`message`, `code`, `details`, `hint`) for admins, return 400 for user-correctable input, 404 for missing review, and reserve 500 for unexpected failures. Do not replace every exception with `"เกิดข้อผิดพลาด"`.

- [ ] **Step 4: Run route tests.**
  - Run `npm.cmd test -- app/(admin)/api/admin/villa-reviews` (with the Windows-safe quoted path if required).

## Task 6: Replace the modal with the responsive moderation workspace

**Files:**
- Rewrite/split: `components/admin/villa-reviews/admin-villa-reviews-page.tsx`
- Add: `components/admin/villa-reviews/review-list.tsx`
- Add: `components/admin/villa-reviews/review-editor.tsx`
- Add: `components/admin/villa-reviews/review-history.tsx`
- Add: `components/admin/villa-reviews/review-image-manager.tsx`
- Modify: `components/admin/villa-reviews/__tests__/admin-villa-reviews-page.test.tsx`
- Add focused component tests for list/editor/image manager/history as the split requires.

- [ ] **Step 1: Write component tests for the operational states.**
  - List: loading skeleton, empty state, server error retry, search, rating filter, next-page append/replace behavior, and masked number only.
  - Detail: clicking a row loads full phone/booking code, preserves immutable identity fields as read-only, and allows star, comment, and image changes.
  - Image manager: previews valid local files immediately, lets the admin remove a new file before save, rejects type/extension mismatch or a file over 5 MB beside that file, and prevents adding beyond five combined retained-plus-new images.
  - Save: renders server `fieldErrors`, disables conflicting controls while pending, replaces both selected detail and its list row on success, clears old files/object URLs/errors, and cannot submit stale attachments twice.
  - History: chronological original/edit event display includes before/after rating/comment/image changes and Thailand-relative time; it handles an empty history.

- [ ] **Step 2: Build the master-detail-preview layout.**
  - Left desktop pane: compact list with search, rating filter, paging control, current selection, score, masked phone, relative submission time, excerpt, and image count.
  - Center pane: immutable review identity (villa link/ID, booking code, full phone, original timestamp); editable accessible 1–5 star control; optional 1,000-character comment; retained/new image controls; clear save and permanent-delete confirmation.
  - Right pane: selected image preview/lightbox trigger plus before/after edit history. On narrow screens, stack panes in the same priority order and keep all actions keyboard accessible.
  - Reuse existing admin colors, cards, focus styles, date helpers, and the public review image/lightbox behavior where that avoids visual divergence. Do not use raw `<img>` without a deliberate local reason; use the existing CSP-safe image component/approved image pattern so lint and Next 16 behavior remain clean.

- [ ] **Step 3: Implement file lifecycle hygiene.**
  - Store local previews as `{ file, objectUrl, error? }`; call `URL.revokeObjectURL` on individual removal, record replacement, successful save, selection change, and component unmount.
  - Count retained images plus valid queued files before accepting a new selection. Each image’s size message must state it is `ต่อรูป`, never an aggregate budget.
  - Use `accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"` only as a convenience; retain all server validation as authoritative.

- [ ] **Step 4: Run focused component tests and lint.**
  - Run `npm.cmd test -- components/admin/villa-reviews`.
  - Run `npm.cmd run lint` and resolve the existing missing-hook-dependency and raw-image warnings rather than suppressing them without justification.

## Task 7: Wire navigation/docs and perform end-to-end verification

**Files:**
- Modify: `components/admin/layout/admin-nav.ts` if needed to preserve active nav styling and accessible label
- Modify: `components/admin/layout/__tests__/admin-shell.test.ts`
- Modify: `docs/ai/structure.html`
- Modify: `docs/superpowers/specs/2026-09-07-admin-villa-reviews-design.md` only if implementation reveals an approved contract change

- [ ] **Step 1: Update navigation test and architecture map.**
  - Keep `/admin/villa-reviews` in the admin navigation and test its destination.
  - Document page ownership, list/detail API routes, private server service, new migration/RPC contract, cache tag revalidation, and targeted tests in `docs/ai/structure.html`.

- [ ] **Step 2: Run the required automated verification.**
  - Run targeted review/admin tests, then `npm.cmd run lint`, then `npm.cmd run build`.
  - If the test suite exposes existing unrelated failures, isolate and report them separately; do not hide them with broad test changes.

- [ ] **Step 3: Inspect local browser behavior.**
  - In the local app, verify desktop and mobile `/admin/villa-reviews`: list/loading/empty/error, full private detail only after auth, image validation, save, delete confirmation, and history.
  - Verify an edited/deleted review on its public `/villas/[id]` detail page: masked phone remains masked, edited rating/comment/images show as expected, and deletion removes it after the targeted cache invalidation.
  - Check browser network after the public change: no unexpected public `_rsc` churn and no `/_next/image` requests for public review images, per project policy.

## Final review checklist

- [ ] Inspect `git diff --check` and `git status --short`; ensure unrelated `docs/ai/feature-audits/` files are untouched.
- [ ] Re-read all changed route/service code for client-supplied editor IDs, service-role leakage, raw unbounded search filters, and cleanup-before-transaction behavior.
- [ ] Confirm that only public list/detail surfaces remain masked and admin detail full-data fields cannot appear in the list API or public view.
- [ ] Do not commit unless ภู explicitly asks.
