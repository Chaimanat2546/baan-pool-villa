# Site Advertisements Implementation Plan

> Execute inline in the current user workspace; preserve changes and do not commit. User approved approach 1 and instructed implementation to continue.

**Goal:** Each website manages its own advertisements, images and public section heading.

**Architecture:** Use the existing Home Config client/auth and feature ownership under `lib/advertisements` and `components/admin/advertisements`. Atomic private RPCs persist records; a dedicated Storage bucket and upload history own assets. Existing detail cards consume local cached public data.

**Tech Stack:** Next.js 16.3, Supabase, React 19, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-site-advertisements-design.md`

## Global Constraints

- Thai admin copy; shared theme tokens and search zones; 12-hour public cache; no central advertisement fallback.
- Save draft files only on Save. Preserve errors and drafts on failure; redirect only for authentication failures.
- Do not run remote migrations, commit or deploy.

## Review Focus

- Cross-advertisement retained images must be rejected by the database.
- Failed or ambiguous persistence must never delete images that may have been committed.
- Conflicting edits/deletes must not overwrite or remove another editor's changes.
- Private Storage paths and hidden advertisements must not be accessible via the public resolver.
- Public HTML cache must change after a successful local advertisement mutation.

### Task 1: Local data, schema and heading

- [x] Add failing tests for local project loader, active/zone ordering, public image paths, malformed rows, title propagation and strict payload/upload validation.
- [x] Implement `types.ts`, `validation.ts`, `server.ts`, local image resolver and heading propagation; remove central advertisement configuration from CSP/Next.
- [x] Add migration and identical online patch for tables, bucket, policies, private save/delete RPCs and invoker wrappers; add migration contract tests.
- [x] Run targeted advertisement, renderer, configuration and CSP tests.

### Task 2: Authenticated persistence and asset lifecycle

- [x] Write failing route/helper tests for authorization, invalid input, retained image ownership, conflicts, upload failures and uncertain persistence.
- [x] Implement `admin-route.ts`, `admin-assets.ts`, `/api/admin/advertisements`, and scoped cache revalidation.
- [x] Run advertisement/API/cache tests and inspect failure handling.

### Task 3: Admin editor and integration

- [x] Write editor tests for empty/load/error states, draft-only files, save, image ordering and failure preservation.
- [x] Implement admin page, editor/image controls/preview, navigation, delete confirmation and dirty-draft protection.
- [x] Update `docs/ai/structure.html` and feature audit with new owners, routes and verification.
- [x] Run lint, build and full tests; render production admin/detail on mobile/desktop and inspect image/network behavior.
- [x] Review the complete diff and fix correctness findings; report any unavailable live database verification explicitly.


## Verification record

- Full Vitest suite: 293 files, 2,473 tests passed.
- ESLint and production Next.js build passed.
- Disposable local PGlite migration test passed, including repeat installation and cross-ad image ownership rejection.
- Production browser tests: 6 passed across Chromium desktop and mobile; inspected screenshots for admin and public detail. No unexpected RSC, public /_next/image, or central advertisement image requests; bounded API/image counts.
- Independent review found a pending-load draft overwrite race and missing asset rollback coverage. Fixed with pending load locks, request-generation checks, deferred-load regression and actual asset helper failure tests.
- Added a real activity-gallery regression for same-origin image IDs; main image and thumbnail transforms both pass.
- Live CMS schema has not been applied. The observed public optional advertisement section degrades to empty until each website receives the migration/patch; no central fallback is used. Admin browser writes were intercepted test fixtures, while persistence and RLS were exercised locally in PGlite.
- No commit, deployment, online schema mutation or central content import performed.
