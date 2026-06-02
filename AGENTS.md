<!-- BEGIN:nextjs-agent-rules -->
# This repo uses a newer Next.js than most examples

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Guide

## Agent Workflow

Use a risk-based workflow. Small, obvious documentation or copy edits can use the shortened path at the end of this section. Non-trivial product, UI, API, data, settings, or shared helper changes must start with request intake and fact-finding before implementation.

1. Clarify the requested outcome, affected user flow, constraints, and success criteria.
2. Inspect the current codebase before proposing new code. Look for existing components, feature-folder patterns, helpers, tests, route conventions, data contracts, `docs/ai/structure.html`, and relevant local docs. Prefer reusing or extending established components and helpers when the behavior should match other parts of the app.
3. When the task touches Next.js APIs or conventions, read the relevant guide in `node_modules/next/dist/docs/` before planning or editing.
4. For medium or high-risk work, propose 2-3 implementation approaches with trade-offs and a recommended option. Ground the recommendation in facts from current files, existing tests, local docs, official docs, or known runtime constraints.
5. Re-check the selected approach against those facts, then present it to the user for approval before implementation unless the user has explicitly asked for immediate execution.
6. After the approach is approved, write an implementation plan that includes the test strategy and quality checks. Re-check the plan against current facts before coding.
7. Write or update focused tests before implementation where practical for logic, validation, normalization, pricing, image/detail data, site settings, contact settings, admin APIs, Supabase persistence, and shared helpers. For visual-only UI changes, define the verification path first and add tests when behavior is stable enough to assert.
8. Implement incrementally, preserving user changes in the working tree and following existing ownership boundaries.
9. After all code changes are complete, run the narrowest relevant tests first, then the required quality checks for the touched area before claiming the work is complete.

For trivial changes, use a shortened workflow: inspect the relevant file, make the smallest safe edit, and run only the verification that is useful for that edit.

## AI Structure Map

- `docs/ai/structure.html` owns the detailed route, folder, component, helper, data-flow, and verification map for AI agents.
- Use `AGENTS.md` for rules and workflow. Do not turn `AGENTS.md` into a long file-tree inventory when the information belongs in the structure map.
- Read `docs/ai/structure.html` before planning changes that touch routes, feature folders, shared helpers, admin modules, Supabase-backed data, cache behavior, SEO, contact/configuration data, or verification strategy.
- Update `docs/ai/structure.html` in the same change when adding, moving, renaming, or removing routes, route handlers, loading UI, feature folders, shared helper ownership, public data contracts, cache/revalidation behavior, settings flows, Supabase schema ownership, or targeted test guidance.

## Stack

- Next.js `16.2.6` App Router with React `19.2.4`.
- Tailwind CSS v4.
- Vitest for unit tests.
- Supabase client is used for villa image data.
- Supabase is also used for admin-managed home sections, site settings, upload assets, and contact/configuration content.
- External villa APIs are used for listings and detail data.

## Required Commands

- `npm.cmd run lint` checks ESLint.
- `npm.cmd run build` checks the production Next.js build.
- `npm.cmd test` runs the full Vitest suite.
- For targeted tests, use `npm.cmd test -- <path>`.

Run lint and build before saying frontend or Next.js work is complete. Run targeted tests when touching shared filtering, normalization, pricing, image, detail, site settings, contact settings, or admin helper code.

When a change touches admin APIs, validation helpers, Supabase persistence, or user-facing settings forms, run the narrowest relevant targeted tests first, then `npm.cmd run lint`, then `npm.cmd run build`.

## Frontend Verification

- For UI, layout, loading state, navigation, responsive, or visual styling changes, render the affected public or admin page locally and inspect it before saying the work is complete.
- Check both mobile and desktop widths when changing shared layout, listing cards, rails, admin shells, headers, footers, contact actions, or route-level loading UI.
- Verify touched loading, empty, error, long-text, and image-fallback states when they are part of the changed flow.
- Use browser verification as a complement to lint, build, and tests. Do not rely only on static code review for user-visible layout behavior.
- For documentation-only, comment-only, or clearly non-visual copy changes, skip browser verification unless the copy affects layout or metadata.

## Environment

Use `.env` locally and keep secrets out of git.

Required keys:

- `DEVILLE_BEARER_TOKEN` for `https://deville-central.com/api/getAccommodation.php?hid={house_id}`.
- `SUPABASE_PUBLISHABLE_KEY` for public Supabase image reads.
- `NEXT_PUBLIC_SITE_URL` for production canonical URLs and sitemap host.
- `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL` for the home-section CMS Supabase project.
- `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY` for browser and route-handler access to the home-section CMS project.

Never print real env values in responses or logs. Refer to env vars by name only.

## Architecture Boundary Rules

- Public and admin routes, route handlers, feature folders, shared helpers, and test ownership are documented in `docs/ai/structure.html`.
- Keep route files focused on metadata, server data loading, JSON-LD (JavaScript Object Notation for Linked Data), and passing props.
- Keep admin API routes focused on authentication, request parsing, validation, persistence, and returning structured errors.
- Public route handlers should use shared data, cache, and validation helpers rather than duplicating route-specific logic.
- Keep UI components inside their feature folders:
  - `components/villas/home`
  - `components/villas/search`
  - `components/villas/detail`
  - `components/villas/listing`
  - `components/layout`
  - `components/admin`

Avoid adding top-level re-export wrapper files under `components/villas`; import from the real feature folder instead.

## Admin and CMS Rules

- Admin UI pages should follow the existing visual language in `components/admin`, especially the layout and control density used by `/admin/sections`.
- For admin pages that manage CMS/content/settings, default to the same UX pattern used by `/admin/settings` and `/admin/sections`: left side for section/list navigation when there are multiple records, center for grouped editing controls, and right side for live preview, result summary, or operational status. On narrow screens, stack in that order.
- Group admin forms by the admin's mental model, not by database fields. Use short Thai section headings such as identity, colors, images, SEO/share preview, contact/payment, ordering, content details, selection rules, and preview/status as appropriate.
- Prefer a live preview or concrete summary beside admin forms whenever the saved change affects public pages. The preview should show what users will see, not just repeat the field names.
- Admin-facing copy should be Thai unless it is a technical value, API error, file name, URL, code, or environment variable.
- Admin-facing labels should use plain human language. Avoid raw product terms like `OG image URL`, `sameAs`, or internal schema names when a Thai explanation is clearer.
- Public and admin theme colors must come from the shared site settings theme variables instead of hard-coded one-off brand colors where practical.
- Keep admin forms optimistic only for local draft state. Persist changes through admin APIs and show returned validation, Supabase, storage, or authorization errors clearly.
- Redirect to `/admin/login` only for true authentication/session failures. Do not treat all `403` responses as login failures; storage and Supabase permission errors should be visible in the form.
- Do not add mock labels, fake states, or placeholder actions in admin screens when the action is already wired or intentionally unavailable.
- Keep file upload previews local until save. Use browser object URLs for previews and revoke them when no longer needed.

## Site Settings Rules

- Site identity, theme colors, logo, hero image, and future contact/payment settings should flow through the site settings system rather than duplicated constants.
- `lib/site-settings/defaults.ts` is the fallback source when Supabase settings are unavailable. Keep defaults production-safe and user-friendly.
- `lib/site-settings/validation.ts` owns normalization and validation for settings payloads. Add focused tests when adding or changing a setting.
- `lib/site-settings/colors.ts` owns derived theme CSS variables and contrast decisions. Do not calculate theme variants ad hoc in components.
- Public layouts and admin layouts should use the same resolved settings so the brand theme is consistent across public and admin surfaces.
- Hero image settings use one image for desktop and mobile. Do not reintroduce separate desktop/mobile hero images, crop controls, or position controls unless the product decision changes.
- Uploaded logo and hero assets should keep only the latest retained assets per type according to the retention helper. Avoid unbounded storage growth.
- When adding a new site setting, update the database schema or patch SQL, TypeScript types, defaults, validation, admin API, admin form, and targeted tests together.

## Shared Source-of-Truth Rules

- Before adding constants, check for an existing shared source of truth in `lib`, `components/layout`, site settings, contact settings, cache policy, pricing, SEO, or villa data helpers.
- Do not hard-code brand colors, contact links, image hosts, price calculations, cache headers, metadata defaults, or public URLs in feature components when a shared helper already owns that value.
- When creating a new shared value, place it in the narrowest existing owner module and add focused tests if it normalizes, validates, derives, or exposes public behavior.

## Data Rules

- Main house listings come from `https://www.devillegroups.com/api/json/getHouse_deville.json`.
- Listing cover images use `https://devillegroups.com/imgs/profile_imgs_large/{img_name}`.
- Detail data comes from the Deville Central accommodation API and requires bearer token.
- Detail gallery images use Supabase image rows where `images.property_id` matches `h_id` / `house_id`.
- Public image URLs are built from `image_name` using the configured image host.

## Cache and Revalidation Rules

- Keep cache durations, cache tags, and public Cache-Control header values centralized in `lib/cache-policy.ts`.
- Use `lib/cache-revalidation.ts` for path and tag invalidation. Do not scatter ad hoc `revalidatePath` or `revalidateTag` calls across route handlers when a shared helper should own the behavior.
- When admin saves affect public pages, revalidate the relevant cache tags and paths for the changed surface, including home, search, detail pages, sitemap, or settings-driven layout as appropriate.
- For cached external API, Supabase, or settings reads, use the existing cache tag and duration patterns and add or update focused tests around the cache options.
- When changing cache policy or revalidation behavior, update the narrowest relevant cache tests before running lint and build.

## Supabase Rules

- Treat migration files as source-controlled schema history. Do not tell the user to paste a full migration into an existing Supabase online project that may already have tables, policies, triggers, or functions.
- For new local development, create migrations in `supabase/migrations`. For existing online projects, provide a minimal, idempotent patch SQL when the user needs to apply the change manually.
- When Docker/local Supabase is unavailable and the user is applying changes in Supabase online, provide a minimal patch SQL block for the current database state instead of a full migration or db reset workflow.
- Use `seed.sql` only for a new/local database or an explicitly empty online project. Do not rerun seeds on a populated online project unless the SQL is scoped and idempotent for the requested data.
- For existing online databases, prefer `create or replace function`.
- For existing online databases, use explicit `grant` statements when permissions change.
- For existing online databases, include `notify pgrst, 'reload schema'` when a PostgREST schema cache refresh is needed.
- Avoid rerunning `create trigger` statements unless the script first proves the trigger is absent or the user explicitly asks for a reset-style operation.
- Avoid rerunning non-idempotent `create policy` statements unless the script first proves the policy is absent or the user explicitly asks for a reset-style operation.
- Avoid rerunning schema creation statements that will fail if objects already exist.
- Supabase online may reject unsafe full-table deletes.
- Snapshot-style replace functions must use a clear `where` clause, for example `where id is not null`, or a safer scoped delete.
- Keep privileged write helpers in a private schema when they need elevated database behavior, expose only a small public invoker wrapper, and keep the admin authorization check inside the private function.
- Surface Supabase Remote Procedure Call (RPC) and REST errors in the admin UI with the returned `message`, `code`, `details`, and `hint` where possible. Do not collapse all Supabase failures into a generic 403.
- Keep public reads protected by explicit public read policies only for intended data. Keep writes limited to authenticated admins.
- Never expose service-role keys in client components, route responses, or `NEXT_PUBLIC_*` variables.
- For Storage uploads, validate MIME type and extension server-side, write upload history, and keep cleanup/rollback behavior conservative when persistence fails.

## Static Analysis Rules

- Treat Codacy, SonarQube, and SonarCloud findings as review feedback that must be verified against the current code before editing.
- Classify each finding as a true positive, analyzer-sensitive pattern, or false positive before changing code.
- Prefer a small behavior-preserving rewrite over a suppression comment.
- Do not apply analyzer suggestions blindly when they remove optional chaining, change operator precedence, widen types, or alter null handling.
- Keep object-shaped public contracts as `interface` unless a `type` is needed for unions, intersections, mapped types, or utility-type composition.
- Prefer `T[]` over `Array<T>` for ordinary arrays.
- Use block-body callbacks for event handlers when it improves clarity or avoids no-confusing-void-expression findings.
- Mark intentionally ignored promises with `void` when the caller cannot or should not await them.
- Use `??` only when preserving valid falsey values such as `0`, `false`, or an empty string is correct.
- Avoid regular expressions over user-controlled or external API text when manual parsing is simple and clearer.
- Keep regexes bounded and simple; avoid nested quantifiers, unbounded `.*`, and patterns that static analysis can read as super-linear.
- Use `crypto.randomUUID()`, `crypto.getRandomValues()`, or server crypto APIs for identifiers that may cross trust boundaries.
- Do not use `Math.random()` for tokens, authentication, authorization, database identifiers, or security-sensitive values.
- Avoid dynamic object access with user-controlled keys; use explicit property access, allowlists, `Map`, or `Object.create(null)` as appropriate.
- Validate URLs with `new URL()` and allowlisted protocols before redirects, links derived from external data, or server fetches.
- Keep secrets server-only; never expose service-role keys or bearer tokens through `NEXT_PUBLIC_*`.
- Escape `<` in JSON-LD payloads and never put unsanitized user-controlled HTML into `dangerouslySetInnerHTML`.
- When fixing a static-analysis finding, add or update a focused test if the code path parses, normalizes, authorizes, fetches, or transforms external data.
- After fixing a static-analysis finding, search for the original risky pattern in the touched area.

## UI Rules

- Reuse shared listing cards from `components/villas/listing` for home, search, and recommendations.
- Reuse `VillaRail` for horizontal villa sections.
- Keep mobile bottom contact actions backed by `lib/site-contact.ts`.
- Keep contact icons in `components/layout/contact-icons.tsx`.
- Do not reintroduce mock badges on actions that already work.
- Preserve the Prompt font setup.
- Keep operational/admin screens compact, scannable, and consistent with the existing admin shell. Avoid marketing-style hero sections inside admin tools.
- Use `next/image` for rendered images where practical. For local selected-file previews, use an object URL with `unoptimized` if required by Next Image.
- Ensure upload controls show the current asset and the newly selected file before save when a preview is available.
- Keep text readable on mobile and desktop. Long labels, filenames, and status text should truncate or wrap without breaking layout.

## SEO and Accessibility Rules

- Build page metadata through `lib/seo.ts` where practical, and keep JSON-LD serialization centralized through `lib/json-ld.ts`.
- Keep route-level metadata, canonical URLs, and JSON-LD aligned with the resolved site settings and public URL configuration.
- Never hand-write unescaped JSON-LD payloads into `dangerouslySetInnerHTML`; use the shared serializer.
- Render meaningful `alt` text for content images. Decorative images should be marked appropriately instead of receiving misleading labels.
- Form controls need clear labels or accessible names, visible focus states, keyboard-reachable interactions, and semantic `button`, `a`, `input`, `select`, or `textarea` elements as appropriate.
- Validate public links derived from settings, contact data, admin input, or external APIs before rendering anchors.

## Contact and Payment Configuration

- Keep public contact actions backed by shared config helpers, not duplicated component constants.
- Phone, LINE, Messenger, and bank/payment information should be editable through admin settings only after the database schema, defaults, validation, public consumers, and tests are updated together.
- Avoid exposing internal payment/admin-only fields on public pages unless the product explicitly requires them.
- For phone, chat, and external links, validate URLs or link formats before rendering public anchors.

## Search Rules

- Search supports filters for zone, guests, bedrooms, amenities, max price, house id, sort order, and near-sea URL param.
- The near-sea toggle button is intentionally not shown on the search page, but `nearSea=1` must still work for links from home sections.
- Do not add a visible near-sea toggle unless the user explicitly requests that product change.
- Search results should remain paginated/incrementally displayed instead of rendering all houses at once.

## Pricing

Use the shared villa price commission logic in `lib`; do not calculate displayed villa prices ad hoc in components.

## Git

- Do not commit unless the user explicitly asks.
- Preserve user changes in the working tree.
- Do not use destructive git commands unless explicitly requested.
