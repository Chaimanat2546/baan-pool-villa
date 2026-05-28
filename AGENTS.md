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
- External villa APIs are used for listings and detail data.

## Required Commands

- `npm.cmd run lint` checks ESLint.
- `npm.cmd run build` checks the production Next.js build.
- `npm.cmd test` runs the full Vitest suite.
- For targeted tests, use `npm.cmd test -- <path>`.

Run lint and build before saying frontend or Next.js work is complete. Run targeted tests when touching shared filtering, normalization, pricing, image, or detail helpers.

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
- Keep UI components inside their feature folders:
  - `components/villas/home`
  - `components/villas/search`
  - `components/villas/detail`
  - `components/villas/listing`
  - `components/layout`
  - `components/admin`

Avoid adding top-level re-export wrapper files under `components/villas`; import from the real feature folder instead.

## Data Rules

- Main house listings come from `https://www.devillegroups.com/api/json/getHouse_deville.json`.
- Listing cover images use `https://devillegroups.com/imgs/profile_imgs_large/{img_name}`.
- Detail data comes from the Deville Central accommodation API and requires bearer token.
- Detail gallery images use Supabase image rows where `images.property_id` matches `h_id` / `house_id`.
- Public image URLs are built from `image_name` using the configured image host.

## Supabase Rules

- Treat migration files as source-controlled schema history. Do not tell the user to paste a full migration into an existing Supabase online project that may already have tables, policies, triggers, or functions.
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
