<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Guide

## Workflow

- Use risk-based work. Small docs/copy edits may use the short path: inspect the file, make the smallest safe edit, and run only useful verification.
- For non-trivial product, UI, API, data, settings, shared helper, Supabase, Next.js, security, or debugging work: clarify outcome, inspect current code, read relevant docs, propose 2-3 approaches, wait for approval, then implement incrementally.
- Before coding, inspect existing feature folders, helpers, tests, route conventions, data contracts, `docs/ai/structure.html`, and local docs. Reuse established owners first.
- Write or update focused tests where practical for logic, validation, normalization, pricing, image/detail data, site settings, contact settings, admin APIs, Supabase persistence, and shared helpers.
- Preserve user changes in the working tree.

## Commands

- `npm.cmd run lint` checks ESLint.
- `npm.cmd run build` checks the production Next.js build.
- `npm.cmd test` runs the full Vitest suite.
- `npm.cmd test -- <path>` runs targeted tests.
- Run lint and build before saying frontend or Next.js work is complete.
- Run targeted tests when touching shared filtering, normalization, pricing, image, detail, site settings, contact settings, admin APIs, validation helpers, Supabase persistence, or admin helper code.

## Verification

- For UI, layout, loading, navigation, responsive, or visual styling changes, render the affected page locally and inspect it before completion.
- Check mobile and desktop when changing shared layout, listing cards, rails, admin shells, headers, footers, contact actions, or route-level loading UI.
- Verify touched loading, empty, error, long-text, and image-fallback states when they are part of the changed flow.
- When changing public image rendering, navigation prefetch, cache policy, ISR, or public server data loading, run a production browser network check: no unexpected `_rsc` requests, no public `/_next/image` requests, and bounded route/API counts.
- Documentation-only, comment-only, and non-visual copy changes do not need browser verification unless they affect layout or metadata.

## Environment

Use `.env` locally, keep secrets out of git, and never print real env values in responses or logs.

## Structure Map

- `docs/ai/structure.html` owns the detailed route, folder, component, helper, data-flow, and verification map.
- Read it before planning changes to routes, feature folders, shared helpers, admin modules, Supabase-backed data, cache behavior, SEO, contact/configuration data, or verification strategy.
- Update it when adding, moving, renaming, or removing routes, route handlers, loading UI, feature folders, shared helper ownership, public data contracts, cache/revalidation behavior, settings flows, Supabase schema ownership, or targeted test guidance.
- Do not turn `AGENTS.md` into a file-tree inventory.

## Architecture

- Keep route files focused on metadata, server data loading, JSON-LD, and passing props.
- Keep admin API routes focused on authentication, request parsing, validation, persistence, and structured errors.
- Public route handlers should call shared data, cache, and validation helpers instead of duplicating route-specific logic.
- Keep UI components inside their feature folders: `components/villas/home`, `components/villas/search`, `components/villas/detail`, `components/villas/listing`, `components/layout`, or `components/admin`.
- Avoid top-level re-export wrapper files under `components/villas`; import from the real feature folder.
- Before adding to a long file, split by existing ownership first: data loading, normalization, state, UI parts, and route glue.
- Keep route files, API routes, and page-level client components as coordinators.
- Do not create new abstraction layers for one caller. Extract only when the name removes repeated logic or makes the next edit smaller.

## Admin and CMS

- Admin UI uses a compact Modern SaaS Dashboard / Clean Card style, not marketing heroes.
- CMS/content/settings pages should use master-detail-preview when there are multiple records or a public result: left navigation, center editor, right preview/status; stack on narrow screens.
- Follow existing `components/admin` density and visual language, especially `/admin/settings` and `/admin/sections`.
- Group forms by the admin's mental model with short Thai headings. Admin-facing copy should be Thai unless it is technical.
- Prefer live previews or concrete summaries beside forms when saved changes affect public pages.
- Theme colors must come from shared site settings where practical.
- Keep admin forms optimistic only for local draft state. Persist through admin APIs and surface validation, Supabase, storage, or authorization errors clearly.
- Redirect to `/admin/login` only for true auth/session failures. Do not collapse storage or Supabase permission errors into generic login failures.
- Do not add mock labels, fake states, or placeholder actions for wired or intentionally unavailable actions.
- Keep file upload previews local until save; use object URLs and revoke them.

## Site Settings

- Site identity, theme colors, logo, hero image, and future contact/payment settings flow through site settings.
- `lib/site-settings/defaults.ts` owns production-safe fallbacks.
- `lib/site-settings/validation.ts` owns normalization and validation.
- `lib/site-settings/colors.ts` owns derived theme CSS variables and contrast decisions.
- Public and admin layouts should use the same resolved settings.
- Hero image settings use one image for desktop and mobile unless the product decision changes.
- Uploaded logo and hero assets should keep only the latest retained assets per type.
- Adding a setting requires schema or patch SQL, TypeScript types, defaults, validation, admin API, admin form, public consumers, and targeted tests together.

## Shared Source Of Truth

- Before adding constants, check `lib`, `components/layout`, site settings, contact settings, cache policy, pricing, SEO, and villa data helpers.
- Do not hard-code brand colors, contact links, image hosts, price calculations, cache headers, metadata defaults, or public URLs when a shared helper owns them.
- New shared values belong in the narrowest existing owner and need focused tests if they normalize, validate, derive, or expose public behavior.

## Cache and Revalidation

- Keep cache durations, tags, and public Cache-Control values centralized in `lib/cache-policy.ts`.
- Public external API, Supabase, settings, guide, image, and embed reads should use the shared 12-hour cache policy unless the user approves a different request budget.
- Keep public route-level ISR aligned to `43200` seconds where a static segment value is required.
- Use `lib/cache-revalidation.ts` for path and tag invalidation.
- Admin saves for Supabase-backed CMS data should revalidate only relevant CMS data tags by default. Do not revalidate public page paths unless the user accepts the Cloudflare/OpenNext regeneration cost.
- Do not shorten public cache durations, add broad eager regeneration, or re-enable frequent ISR without checking request and CPU budget.

## Supabase

- Treat migrations as source-controlled schema history.
- For new local development, create migrations in `supabase/migrations`.
- For existing online projects, provide minimal idempotent patch SQL; prefer `create or replace function`, explicit grants when permissions change, and `notify pgrst, 'reload schema'` when needed.
- Do not rerun seeds, triggers, non-idempotent policies, unsafe full-table deletes, or schema creation statements on populated online projects unless scoped and explicitly approved.
- Snapshot-style replace functions need a clear `where` clause.
- Privileged write helpers belong in a private schema with a small public invoker wrapper and admin authorization inside the private function.
- Surface Supabase RPC/REST errors with `message`, `code`, `details`, and `hint` where possible.
- Keep public reads protected by explicit public read policies and writes limited to authenticated admins.
- Never expose service-role keys in client components, route responses, or `NEXT_PUBLIC_*`.
- Storage uploads must validate MIME type and extension server-side, write upload history, and keep cleanup/rollback conservative.

## Static Analysis

- Verify Codacy, SonarQube, and SonarCloud findings against current code before editing.
- Prefer small behavior-preserving rewrites over suppression comments.
- Do not blindly apply suggestions that change null handling, operator precedence, or public types.
- Avoid user-controlled regex when manual parsing is simple; keep regex bounded and simple.
- Use crypto APIs for identifiers crossing trust boundaries; never `Math.random()` for security-sensitive values.
- Avoid dynamic object access with user-controlled keys; use explicit access, allowlists, `Map`, or `Object.create(null)`.
- Validate URLs with `new URL()` and allowlisted protocols before redirects, external-data links, or server fetches.
- Keep secrets server-only.
- Escape `<` in JSON-LD and never put unsanitized user-controlled HTML into `dangerouslySetInnerHTML`.
- After fixing a finding, add focused tests when the path parses, normalizes, authorizes, fetches, or transforms external data, then search the touched area for the risky pattern.

## UI, SEO, and Search

- Reuse shared listing cards from `components/villas/listing` and `VillaRail` for horizontal villa sections.
- Keep mobile bottom contact actions backed by `lib/site-contact.ts` and contact icons in `components/layout/contact-icons.tsx`.
- Preserve the Prompt font setup.
- Use `next/image` where practical, but keep `images.unoptimized = true` unless a paid image-optimization plan is approved and verified.
- Avoid public `Link` prefetch or image priority/preload on large repeated rails, grids, recommendations, breadcrumbs, footer, or header navigation unless measured.
- Shared villa listing links to `/villas/[id]` should use normal document navigation, not `next/link` client navigation.
- Keep text readable on mobile and desktop; long labels, filenames, and status text should truncate or wrap safely.
- Build metadata through `lib/seo.ts` where practical and JSON-LD through `lib/json-ld.ts`.
- Render meaningful image `alt`; mark decorative images appropriately.
- Form controls need labels or accessible names, visible focus states, keyboard access, and semantic elements.
- Validate public links derived from settings, contact data, admin input, or external APIs.
- Search supports zone, guests, bedrooms, amenities, max price, house id, sort order, and `nearSea=1`.
- Do not show a near-sea toggle unless explicitly requested; `nearSea=1` links must still work.
- Search results should stay paginated/incrementally displayed.

## Contact and Pricing

- Keep public contact actions backed by shared config helpers.
- Phone, LINE, Messenger, and bank/payment fields become editable only after schema, defaults, validation, public consumers, and tests are updated together.
- Do not expose internal payment/admin-only fields publicly unless explicitly required.
- Validate phone, chat, and external links before rendering public anchors.
- Use shared villa price commission logic in `lib`; do not calculate displayed villa prices ad hoc in components.

## Git

- Do not commit unless the user explicitly asks.
- Preserve user changes in the working tree.
- Do not use destructive git commands unless explicitly requested.
