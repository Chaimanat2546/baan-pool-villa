# Villa Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an immediately public, villa-specific review system with secure private booking/phone storage, masked public identity, images, sorting, pagination, and a two-step review modal.

**Architecture:** A server-only review repository owns validation, public DTO mapping, Supabase access, object-storage cleanup, and tagged reads. A dedicated Supabase migration creates private source records plus a safe `villa_reviews_public` view; public read APIs and detail UI consume that view only. The form posts multipart data to a Route Handler that validates before upload, uses a unique database constraint for booking-code idempotency, and invalidates only the touched villa review tag.

**Tech Stack:** Next.js 16 App Router Route Handlers, React 19, TypeScript, Supabase Postgres/Storage/RPC, Vitest, Tailwind CSS, `bad-words-thai`.

**Spec:** `docs/superpowers/specs/2026-09-07-villa-reviews-design.md`

## Global Constraints

- Keep full phone number, booking code, storage administration data, and edit logs private. Public browser data comes only from `villa_reviews_public` DTOs.
- Accept booking codes as non-empty free-form input in this MVP; the database makes the value globally unique.
- Phone input accepts `0812345678` and `+66812345678`; display only `xxx-xxxx-9854`.
- Rating is required and is an integer 1–5. Comment is optional and at most 1,000 characters.
- Permit at most five JPG/PNG/WebP images. **Validate 5 MB per individual file, not 5 MB for all selected files combined.**
- Reject, do not store, text detected by `bad-words-thai`; report detected words in a safe validation response.
- Do not add CAPTCHA. Successful review submissions are limited to five per hour per `CF-Connecting-IP`; invalid payloads do not consume the quota.
- Use a public view for reads, server-only `SUPABASE_SECRET_KEY` for writes/uploads, and never expose the secret or return private fields.
- Add the review section as a `villa_reviews` detail-layout block; make its default placement after details and before booking/contact.
- New public reads use a per-villa review cache tag and writes invalidate only that tag. Do not broadly revalidate page paths.
- Do not implement customer editing, admin review-management UI, booking verification, CAPTCHA, or image-content moderation.
- Do not commit changes unless the user explicitly requests it.

---

## Proposed File Structure

| Path | Responsibility |
| --- | --- |
| `supabase/migrations/20260907120000_create_villa_reviews.sql` | Review tables, public view, indexes, constrained server invoker, storage bucket/policies, grants, schema reload. |
| `lib/villa-reviews/types.ts` | Public DTOs, submission payload/result types, sort/cursor contracts. |
| `lib/villa-reviews/validation.ts` | Phone, masked-phone, booking-code, review, file, and profanity validation. |
| `lib/villa-reviews/supabase.ts` | Server-only service-role client and safe Supabase environment validation. |
| `lib/villa-reviews/server.ts` | Tagged public view reads, cursor encoding, DTO mapping, summary computation, write orchestration, upload cleanup. |
| `lib/villa-reviews/route.ts` | Route request parsing and stable Thai error responses for public GET/POST handlers. |
| `app/(public)/api/villas/[id]/reviews/route.ts` | Public GET pagination and POST submission endpoints. |
| `components/villas/detail/villa-reviews-section.tsx` | Client review summary/list/sort/load-more UI and success reconciliation. |
| `components/villas/detail/villa-review-modal.tsx` | Accessible two-step review form, draft state, file previews, and API submission. |
| `components/villas/detail/villa-review-utils.ts` | Relative-time, local field validation, and presentation-only utilities. |
| `lib/detail-layout/*`, `components/admin/detail-layout/*`, `components/villas/detail/detail-layout-blocks.tsx` | Register/render the `villa_reviews` detail block in the existing configurable layout. |
| `lib/cache-policy.ts`, `lib/cache-revalidation.ts`, `lib/api/rate-limit.ts` | Per-villa tag and successful-submission rate-limit policy. |
| `docs/ai/structure.html` | Update route, ownership, data-flow, and verification map. |

### Task 1: Install the filter and define review contracts/validation

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `lib/villa-reviews/types.ts`
- Create: `lib/villa-reviews/validation.ts`
- Test: `lib/villa-reviews/__tests__/validation.test.ts`

**Interfaces:**
- Produces `ReviewSort = "newest" | "rating_desc" | "rating_asc"`, `PublicVillaReview`, `VillaReviewSummary`, `ReviewPage`, `ReviewSubmissionInput`, and `ReviewValidationResult`.
- Produces `normalizeThaiPhone(value)`, `maskThaiPhone(phone)`, `validateReviewSubmission(input)`, and `validateReviewFiles(files)`.
- `validateReviewSubmission` returns field-keyed errors and detected words; it never returns a full phone or booking code in a public error shape.

- [ ] **Step 1: Add the exact profanity-filter dependency.**

Run:

```powershell
npm.cmd install bad-words-thai
```

Expected: `package.json` and lockfile contain the dependency; no application code imports it yet.

- [ ] **Step 2: Write failing validation tests.**

```ts
it("normalizes both accepted Thai phone forms and masks only the last four digits", () => {
  expect(normalizeThaiPhone("0812349854")).toBe("+66812349854");
  expect(normalizeThaiPhone("+66812349854")).toBe("+66812349854");
  expect(maskThaiPhone("+66812349854")).toBe("xxx-xxxx-9854");
});

it("accepts five 5 MB files but rejects one file above 5 MB and a sixth file", () => {
  expect(validateReviewFiles(fiveFilesOf(5 * 1024 * 1024))).toEqual([]);
  expect(validateReviewFiles([fileOf(5 * 1024 * 1024 + 1)]).errors[0]).toContain("5 MB");
  expect(validateReviewFiles(sixValidFiles()).errors[0]).toContain("5 รูป");
});

it("rejects a detected prohibited term without returning the original private form fields", () => {
  const result = validateReviewSubmission(validInput({ comment: "คำต้องห้าม" }));
  expect(result.ok).toBe(false);
  expect(result.detectedWords.length).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Run the focused test to prove it fails.**

Run: `npm.cmd test -- lib/villa-reviews/__tests__/validation.test.ts`

Expected: FAIL because the module/functions do not exist.

- [ ] **Step 4: Implement narrow, server-safe validation.**

```ts
export const MAX_REVIEW_IMAGES = 5;
export const MAX_REVIEW_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateReviewFiles(files: File[]) {
  const errors: Record<string, string> = {};
  if (files.length > MAX_REVIEW_IMAGES) errors.images = "แนบรูปได้สูงสุด 5 รูป";
  files.forEach((file, index) => {
    if (file.size > MAX_REVIEW_IMAGE_BYTES) errors[`images.${index}`] = "รูปแต่ละรูปต้องไม่เกิน 5 MB";
  });
  return { errors, ok: Object.keys(errors).length === 0 };
}
```

Instantiate `ThaiProfanityFilter` once in this server-used module with Thai and English enabled; use its `detectedWords[].originalWord` only for the validation response. Validate MIME type and extension against allowlists independently.

- [ ] **Step 5: Run the validation suite.**

Run: `npm.cmd test -- lib/villa-reviews/__tests__/validation.test.ts`

Expected: PASS, including boundary exactly 5 MB per file and no aggregate-size rejection.

- [ ] **Step 6: Review the task diff; do not commit.**

Run: `git diff --check; git diff -- lib/villa-reviews package.json package-lock.json`

Expected: no whitespace errors and no private form values in test snapshots.

### Task 2: Add database/storage privacy boundary and migration contract tests

**Files:**
- Create: `supabase/migrations/20260907120000_create_villa_reviews.sql`
- Create: `lib/villa-reviews/__tests__/migration-contract.test.ts`

**Interfaces:**
- Produces private `villa_reviews`, `villa_review_images`, and `villa_review_edit_logs` records.
- Produces safe `public.villa_reviews_public` rows with `id`, `villa_id`, `rating`, `comment`, `masked_phone`, `created_at`, `updated_at`, and ordered safe image JSON only.
- Produces a service-role-only RPC `public.submit_villa_review(...)` that inserts a review and its image metadata atomically; unique booking code conflicts map to PostgreSQL `23505`.

- [ ] **Step 1: Write migration contract tests before the migration.**

```ts
it("keeps booking_code and phone_e164 out of the public view definition", () => {
  expect(migration).toContain("create or replace view public.villa_reviews_public");
  expect(publicViewSql).not.toMatch(/booking_code|phone_e164/);
  expect(publicViewSql).toContain("masked_phone");
});

it("enforces one booking code globally and orders review images", () => {
  expect(migration).toMatch(/unique.*booking_code/i);
  expect(migration).toMatch(/unique.*review_id.*display_order/is);
});
```

- [ ] **Step 2: Run the contract test to prove it fails.**

Run: `npm.cmd test -- lib/villa-reviews/__tests__/migration-contract.test.ts`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Create an idempotent, least-privilege migration.**

Create the three tables with UUID primary keys, check `rating between 1 and 5`, check image display order 1–5, `booking_code` unique, and indexes for `(villa_id, created_at desc, id desc)` and `(villa_id, rating desc, id desc)`. Create a dedicated public storage bucket for `villa-reviews/` paths; revoke anonymous write/update/delete and grant storage write only to service role.

Create the public view with an ordered `jsonb_agg` image payload and a masked phone expression. Revoke direct public/anon table access. Implement `private.submit_villa_review_impl(...)` plus a narrow `public.submit_villa_review(...)` invoker granted only to `service_role`; validate image JSON shape and insert parent/image metadata in one database transaction. End with `notify pgrst, 'reload schema';`.

- [ ] **Step 4: Update and run migration contract tests.**

Run: `npm.cmd test -- lib/villa-reviews/__tests__/migration-contract.test.ts`

Expected: PASS; verify the public view is the only read projection and no public grant permits base-table reads/writes.

- [ ] **Step 5: Review migration safety; do not apply it to any remote project.**

Run: `git diff --check; git diff -- supabase/migrations/20260907120000_create_villa_reviews.sql`

Expected: migration is additive/idempotent, has no seed/delete statements, and includes explicit grants/revokes.

### Task 3: Implement server repository, per-villa cache and rate limit

**Files:**
- Create: `lib/villa-reviews/supabase.ts`
- Create: `lib/villa-reviews/server.ts`
- Modify: `lib/cache-policy.ts`
- Modify: `lib/cache-revalidation.ts`
- Modify: `lib/api/rate-limit.ts`
- Test: `lib/villa-reviews/__tests__/server.test.ts`
- Test: `lib/api/__tests__/rate-limit.test.ts`
- Test: `lib/__tests__/cache-policy.test.ts`
- Test: `lib/cache-revalidation.test.ts`

**Interfaces:**
- Produces `getVillaReviewPage(villaId, sort, cursor)`, `getVillaReviewSummary(villaId)`, `submitVillaReview(input, files)`, and `removeUploadedReviewAssets(paths)`.
- Produces `CACHE_TAGS.villaReviews(villaId)` and `revalidateVillaReviewsCache(villaId)`.
- Adds `publicReviewSubmission` with `{ limit: 5, windowMs: 60 * 60 * 1000 }` without using it until validation succeeds.

- [ ] **Step 1: Write failing repository tests using a Supabase-like fake.**

```ts
it("maps only public-view fields and uses an opaque cursor for a five-item page", async () => {
  const page = await getVillaReviewPage("villa-1", "newest", null);
  expect(page.items).toHaveLength(5);
  expect(page.items[0]).not.toHaveProperty("bookingCode");
  expect(page.items[0]).not.toHaveProperty("phoneE164");
  expect(page.nextCursor).toEqual(expect.any(String));
});

it("cleans every uploaded path when the atomic database RPC rejects a duplicate booking code", async () => {
  await expect(submitVillaReview(validInput(), validFiles())).rejects.toMatchObject({ code: "duplicate_booking_code" });
  expect(storageRemove).toHaveBeenCalledWith(expect.arrayContaining(uploadedPaths));
});
```

- [ ] **Step 2: Run repository tests to prove they fail.**

Run: `npm.cmd test -- lib/villa-reviews/__tests__/server.test.ts lib/api/__tests__/rate-limit.test.ts lib/__tests__/cache-policy.test.ts lib/cache-revalidation.test.ts`

Expected: FAIL because the repository, tag, and policy do not exist.

- [ ] **Step 3: Implement the server-only client and repository.**

`lib/villa-reviews/supabase.ts` must import `server-only`, read `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL` plus `SUPABASE_SECRET_KEY`, and create a non-persisting Supabase client. Never import it from a client component.

`submitVillaReview` must validate first, upload each accepted file to a UUID path under `villa-reviews/<review-request-id>/`, then call the service-role RPC with image metadata. On RPC failure, remove all paths in a best-effort cleanup and return a stable duplicate/validation/storage error. Only after a successful RPC call `revalidateVillaReviewsCache(villaId)` and return the mapped public DTO.

Use an `unstable_cache` loader tagged by `CACHE_TAGS.villaReviews(villaId)` for the view read. Encode cursor data as base64url JSON containing only validated sort keys plus ordering values; reject malformed/mismatched cursors before querying.

- [ ] **Step 4: Apply the five-per-hour policy only at successful commit time.**

Add a non-consuming `checkPublicApiRateLimit`/`consumePublicApiRateLimit` pair, or equivalent explicit reserve/consume API, so validation failures do not increase the bucket. `POST` consumes immediately before upload/database work; a `429` returns `Retry-After` and `Cache-Control: no-store`.

- [ ] **Step 5: Run server/cache/rate-limit tests.**

Run: `npm.cmd test -- lib/villa-reviews/__tests__/server.test.ts lib/api/__tests__/rate-limit.test.ts lib/__tests__/cache-policy.test.ts lib/cache-revalidation.test.ts`

Expected: PASS; inspect that six valid submissions from one IP cause the sixth to return 429 while malformed/profanity attempts do not consume the five successful slots.

- [ ] **Step 6: Review secret boundaries; do not commit.**

Run: `rg -n "SUPABASE_SECRET_KEY|bookingCode|phoneE164" app components lib/villa-reviews`

Expected: secret access only in a `server-only` module; public DTO/component/API response types never include raw phone or booking code.

### Task 4: Add public review APIs with stable error contracts

**Files:**
- Create: `lib/villa-reviews/route.ts`
- Create: `app/(public)/api/villas/[id]/reviews/route.ts`
- Test: `app/(public)/api/villas/[id]/reviews/route.test.ts`

**Interfaces:**
- `GET /api/villas/:id/reviews?sort=newest|rating_desc|rating_asc&cursor=<opaque>` returns `{ summary, items, nextCursor }`.
- `POST /api/villas/:id/reviews` accepts `bookingCode`, `phone`, `rating`, `comment`, and repeated `images` multipart fields, returning `{ review }` only from the public DTO.

- [ ] **Step 1: Write failing route tests.**

```ts
it("returns 409 for a reused booking code without echoing the code or phone", async () => {
  const response = await POST(requestWithValidReview());
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "รหัสการจองนี้เคยใช้รีวิวแล้ว" });
});

it("rejects an image over 5 MB even when all other selected images are small", async () => {
  const response = await POST(requestWithFiles([fileOf(1), fileOf(5 * MB + 1)]));
  expect(response.status).toBe(400);
  expect((await response.json()).fieldErrors["images.1"]).toContain("5 MB");
});
```

- [ ] **Step 2: Run route tests to prove they fail.**

Run: `npm.cmd test -- "app/(public)/api/villas/[id]/reviews/route.test.ts"`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement GET/POST handlers.**

Use `RouteContext<'/api/villas/[id]/reviews'>` to obtain the path ID, reject empty/oversized IDs and invalid sort/cursor before repository access, and set `Cache-Control: no-store` for POST/errors. Map duplicate unique violations to 409, validation to 400, rate limiting to 429, and storage/database failure to a safe 500 response. Never return caught raw Supabase errors or multipart values.

- [ ] **Step 4: Run API tests.**

Run: `npm.cmd test -- "app/(public)/api/villas/[id]/reviews/route.test.ts"`

Expected: PASS for GET sorting/cursors and all POST validation/privacy/error paths.

- [ ] **Step 5: Review the public wire contract; do not commit.**

Run: `git diff --check; rg -n "Response\.json|bookingCode|phoneE164" "app/(public)/api/villas/[id]/reviews" lib/villa-reviews/route.ts`

Expected: every successful response is a public DTO; no raw private fields occur in JSON construction.

### Task 5: Register the review block in the existing detail layout

**Files:**
- Modify: `lib/detail-layout/types.ts`
- Modify: `lib/detail-layout/defaults.ts`
- Modify: `lib/detail-layout/validation.ts`
- Modify: `lib/detail-layout/version-2.ts`
- Modify: `components/admin/detail-layout/block-library.tsx`
- Modify: `components/admin/detail-layout/detail-layout-preview.tsx`
- Modify: `components/villas/detail/detail-layout-blocks.tsx`
- Modify: `supabase/migrations/20260907120000_create_villa_reviews.sql`
- Test: `lib/detail-layout/__tests__/validation.test.ts`
- Test: `lib/detail-layout/__tests__/version-2.test.ts`
- Test: `components/admin/detail-layout/__tests__/block-library.test.tsx`
- Test: `components/villas/detail/__tests__/detail-layout-renderer.test.tsx`

**Interfaces:**
- Adds `villa_reviews` to `DetailLayoutBlockType` with Thai label `รีวิวจากผู้เข้าพัก`.
- The v1/v2 default layout and migration patch insert the block immediately after `details` and before `booking_contact` where those blocks exist.
- Renderer receives a `VillaReviewsSection` node through the existing detail-layout context.

- [ ] **Step 1: Write failing layout tests.**

```ts
it("accepts villa_reviews and preserves it before booking_contact in default layout", () => {
  expect(DEFAULT_DETAIL_LAYOUT.rows.flatMap((row) => row.blocks.map((block) => block.type)))
    .toEqual(expect.arrayContaining(["details", "villa_reviews", "booking_contact"]));
});

it("renders the review block through the detail renderer", () => {
  render(<DetailLayoutRenderer {...propsWithReviewData} />);
  expect(screen.getByRole("heading", { name: "รีวิวจากผู้เข้าพัก" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run layout tests to prove they fail.**

Run: `npm.cmd test -- lib/detail-layout components/admin/detail-layout components/villas/detail/__tests__/detail-layout-renderer.test.tsx`

Expected: FAIL because `villa_reviews` is not an allowed block.

- [ ] **Step 3: Extend the registered block consistently.**

Add the type and label, update both layout validators/converters/defaults, preserve the block in admin builder/preview, and wire `renderVillaReviews` into `detail-layout-blocks.tsx`. The migration must patch existing JSON layouts conservatively: add an enabled review block only when absent and place it after details before booking contact; do not overwrite other user layout choices.

- [ ] **Step 4: Run focused detail-layout tests.**

Run: `npm.cmd test -- lib/detail-layout components/admin/detail-layout components/villas/detail/__tests__/detail-layout-renderer.test.tsx`

Expected: PASS for v1/v2 normalization, existing layout preservation, admin library label, and public renderer placement.

- [ ] **Step 5: Review configuration compatibility; do not commit.**

Run: `git diff --check; rg -n 'villa_reviews' lib/detail-layout components/admin/detail-layout components/villas/detail supabase/migrations/20260907120000_create_villa_reviews.sql`

Expected: all owners recognize the same block name and no existing block type was renamed.

### Task 6: Build the review section and two-step modal

**Files:**
- Create: `components/villas/detail/villa-review-utils.ts`
- Create: `components/villas/detail/villa-review-modal.tsx`
- Create: `components/villas/detail/villa-reviews-section.tsx`
- Modify: `components/villas/detail/detail-layout-blocks.tsx`
- Test: `components/villas/detail/__tests__/villa-review-utils.test.ts`
- Test: `components/villas/detail/__tests__/villa-review-modal.test.tsx`
- Test: `components/villas/detail/__tests__/villa-reviews-section.test.tsx`

**Interfaces:**
- `VillaReviewsSection({ initialPage, villaId })` renders summary/list/sort/load-more and owns only public review state.
- `VillaReviewModal({ villaId, onClose, onSubmitted })` owns the private form draft until POST; parent receives only `PublicVillaReview` from `onSubmitted`.
- `formatRelativeReviewTime(iso, now)` returns Thai relative display text without exposing a timezone-sensitive absolute timestamp.

- [ ] **Step 1: Write failing component tests.**

```tsx
it("keeps the first step separate from the rating/comment/image step", async () => {
  render(<VillaReviewModal villaId="villa-1" onClose={vi.fn()} onSubmitted={vi.fn()} />);
  expect(screen.getByLabelText("รหัสการจอง")).toBeInTheDocument();
  expect(screen.queryByLabelText("คะแนนรีวิว")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
  expect(screen.getByLabelText("คะแนนรีวิว")).toBeInTheDocument();
});

it("shows per-file 5 MB feedback and preserves the draft after a 400 response", async () => {
  // Select one oversized file, submit, and assert its inline error plus retained comment value.
});

it("loads five newest reviews, changes sort, and appends a later cursor page", async () => {
  render(<VillaReviewsSection villaId="villa-1" initialPage={pageOfFive} />);
  await userEvent.selectOptions(screen.getByLabelText("เรียงรีวิว"), "rating_desc");
  await userEvent.click(screen.getByRole("button", { name: "ดูรีวิวเพิ่มเติม" }));
  expect(await screen.findByText("รีวิวลำดับ 6")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run component tests to prove they fail.**

Run: `npm.cmd test -- components/villas/detail/__tests__/villa-review-utils.test.ts components/villas/detail/__tests__/villa-review-modal.test.tsx components/villas/detail/__tests__/villa-reviews-section.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the accessible presentation layer.**

Use existing site color variables and detail-card styling. Implement only two navigable steps. Create local object URLs for selected image previews and revoke every URL on removal, submit completion, and unmount. Disable submit while pending; use `aria-live` feedback; trap/restore focus using the existing gallery modal conventions. Send repeated `images` fields in `FormData`, then append the returned public review locally and reset/close only after success.

Summary must calculate/display average, total, and 5-to-1 distribution from the initial/API summary. List cards show stars, masked phone, relative time, comment when non-empty, and safe images. Keep image `alt` meaningful but generic because no reviewer name is collected.

- [ ] **Step 4: Run component tests.**

Run: `npm.cmd test -- components/villas/detail/__tests__/villa-review-utils.test.ts components/villas/detail/__tests__/villa-review-modal.test.tsx components/villas/detail/__tests__/villa-reviews-section.test.tsx components/villas/detail/__tests__/detail-layout-renderer.test.tsx`

Expected: PASS for empty/loading/error/long-text/image-fallback states, two-step navigation, draft retention, sort reset, and load-more append.

- [ ] **Step 5: Review client privacy and object-URL lifecycle; do not commit.**

Run: `rg -n "bookingCode|phone|createObjectURL|revokeObjectURL" components/villas/detail/villa-review-*.tsx`

Expected: raw form values remain inside the modal; every generated object URL has cleanup; public list only reads `maskedPhone`.

### Task 7: Update structure documentation and run final verification

**Files:**
- Modify: `docs/ai/structure.html`
- Test: all focused review/layout/API/cache tests created above

**Interfaces:**
- Documents ownership of `lib/villa-reviews`, the public review route, per-villa cache/revalidation, private/public data boundary, required migration, and exact focused test command.

- [ ] **Step 1: Update `docs/ai/structure.html`.**

Add the review feature owner, data flow `detail layout → public review view/API → client section`, private write path, storage ownership, cache tag, and focused verification command. Do not list secret values.

- [ ] **Step 2: Run the focused suite.**

Run:

```powershell
npm.cmd test -- lib/villa-reviews lib/detail-layout components/admin/detail-layout components/villas/detail/__tests__/villa-review-utils.test.ts components/villas/detail/__tests__/villa-review-modal.test.tsx components/villas/detail/__tests__/villa-reviews-section.test.tsx "app/(public)/api/villas/[id]/reviews/route.test.ts" lib/api/__tests__/rate-limit.test.ts lib/__tests__/cache-policy.test.ts lib/cache-revalidation.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run static checks and production build.**

Run:

```powershell
npm.cmd run lint
npm.cmd run build
```

Expected: both exit 0.

- [ ] **Step 4: Perform browser verification.**

Start the local app, open a villa detail page, and inspect mobile and desktop widths. Verify: review block follows detail content before contact; empty state; five-card initial page; all sort modes; load-more; modal keyboard/focus behavior; one exactly-5-MB file succeeds; one >5-MB file fails inline; five valid files succeed; a sixth fails; duplicate booking code returns the Thai error; prohibited text is rejected; and returned review never displays raw phone/code.

For the production network check, ensure the review flow creates only its expected review API calls and no public `/_next/image` request; verify normal existing public routes retain their established request budget.

- [ ] **Step 5: Final review; do not commit.**

Run: `git diff --check; git status --short`

Expected: no whitespace errors; report changed files and any deployment prerequisite (the server-only `SUPABASE_SECRET_KEY` must be configured in each target runtime, never in `NEXT_PUBLIC_*`).

## Plan Self-Review

- **Spec coverage:** Tasks 1–4 cover validation, privacy, write/read flows, images, profanity, rate limiting, cache invalidation, and cursor pagination. Task 5 covers required placement in the project’s configurable layout. Task 6 covers the Google-Maps-style public UI and two-section modal. Task 7 covers documentation, browser validation, lint, and build.
- **Placeholder scan:** Every task names its files, interfaces, test command, and acceptance expectation; the scan found no incomplete implementation markers.
- **Type consistency:** `PublicVillaReview`, `ReviewPage`, `VillaReviewsSection`, `VillaReviewModal`, `villa_reviews_public`, and `villa_reviews` retain one public/private naming boundary throughout the plan.
