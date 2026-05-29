<!-- BEGIN:nextjs-agent-rules -->
# This repo uses a newer Next.js than most examples

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Guide

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

## Environment

Use `.env` locally and keep secrets out of git.

Required keys:

- `DEVILLE_BEARER_TOKEN` for `https://deville-central.com/api/getAccommodation.php?hid={house_id}`.
- `SUPABASE_PUBLISHABLE_KEY` for public Supabase image reads.
- `NEXT_PUBLIC_SITE_URL` for production canonical URLs and sitemap host.
- `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL` for the home-section CMS Supabase project.
- `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY` for browser and route-handler access to the home-section CMS project.

Never print real env values in responses or logs. Refer to env vars by name only.

## App Structure

- Public routes live under `app/(public)`.
- Admin routes and admin APIs live under `app/(admin)`.
- `app/(public)/page.tsx` imports the home implementation from `components/villas/home/page`.
- `app/(public)/search/page.tsx` imports the search implementation from `components/villas/search/page`.
- `app/(public)/villas/[id]/page.tsx` imports the detail implementation from `components/villas/detail/page`.
- Keep route files focused on metadata, server data loading, JSON-LD (JavaScript Object Notation for Linked Data), and passing props.
- Keep admin API routes focused on authentication, request parsing, validation, persistence, and returning structured errors.
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
- Admin-facing copy should be Thai unless it is a technical value, API error, file name, URL, code, or environment variable.
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

## Data Rules

- Main house listings come from `https://www.devillegroups.com/api/json/getHouse_deville.json`.
- Listing cover images use `https://devillegroups.com/imgs/profile_imgs_large/{img_name}`.
- Detail data comes from the Deville Central accommodation API and requires bearer token.
- Detail gallery images use Supabase image rows where `images.property_id` matches `h_id` / `house_id`.
- Public image URLs are built from `image_name` using the configured image host.

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
