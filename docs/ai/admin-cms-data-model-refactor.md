# Admin CMS Data Model Refactor Handoff

## Problem

`/admin/detail-layout` feels slow even though the detail-layout API reads only one small field. The deeper issue is that admin/CMS settings have grown around one overloaded `site_settings` row that mixes identity, theme, assets, contact, bank display fields, marketing tags, SEO, TikTok, and `detail_layout`.

The refactor should be done as a set of coarse work packages, not many tiny tasks. Each package below is designed to be handed to a separate chat/agent.

## Current Detail Layout Data Flow

The detail-layout editor itself reads very little:

- Page: `app/(admin)/admin/detail-layout/page.tsx`
- Client: `components/admin/detail-layout/admin-detail-layout-page.tsx`
- API: `app/(admin)/api/admin/detail-layout/route.ts`
- Backend helper: `lib/detail-layout/admin-route.ts`
- Actual data read: `site_settings.select("id,detail_layout").eq("id","global").maybeSingle()`

The likely slowness is the surrounding waterfall:

- `app/(admin)/admin/layout.tsx` calls `getSiteSettings()` before the admin shell renders.
- `lib/site-settings/server.ts` uses one large `SITE_SETTINGS_SELECT` for almost every consumer.
- The browser then reads the Supabase session and calls `/api/admin/detail-layout`.
- The API auth path calls `supabase.auth.getUser(token)` and checks `admin_users`.

The first performance win should be to make the admin shell use a narrow settings read. The bigger backend win is to stop adding unrelated JSON fields to `site_settings`.

## Data Model Direction

Normalize settings that are ordered, independently editable, validated, public-facing, or permissioned.

Keep JSON only where it is a document body or genuinely unqueryable configuration.

| Current data | Target direction | Notes |
| --- | --- | --- |
| Site name, logo background, villa card style | `site_identity_settings` | Singleton settings. |
| Theme colors | `site_theme_settings` | Narrow read for public/admin chrome. |
| Logo, favicon, hero, SEO images | `site_asset_settings` plus existing `site_asset_uploads` history | Do not duplicate upload history unless needed. |
| `phone_contacts` JSON | `site_contact_channels` | Ordered rows with active state and validation. |
| Bank display fields | `site_bank_accounts` | Keep internal payment/admin-only fields private unless explicitly required. |
| Google Tag Manager | `site_marketing_settings` | Avoid full settings rewrites for one marketing field. |
| SEO titles/descriptions/images | `site_seo_profiles` | Suggested profile keys: `global`, `search`, `guides`, `villa_detail`. |
| SEO keyword JSON arrays | `site_seo_keywords` | Ordered rows per SEO profile. |
| Same-as/social URL JSON | `site_social_links` | Ordered active rows. |
| TikTok video URL JSON | `site_social_videos` | Provider, URL, active state, sort order. |
| `detail_layout` JSON | `detail_layouts`, `detail_layout_rows`, `detail_layout_blocks` | Keep tiny per-block `config jsonb` only for unqueried variant options. |
| `guide_posts.content_blocks` JSON | Keep JSON for now | Rich document body, not first refactor target. |
| `legal_pages.content_blocks` JSON | Keep JSON for now | Rich document body, not first refactor target. |

## Work Package 1: Audit And Target Model Record

Purpose: lock the target schema before implementation so later agents do not create incompatible migrations.

Inspect:

- `docs/ai/structure.html`
- `lib/site-settings/types.ts`
- `lib/site-settings/defaults.ts`
- `lib/site-settings/validation.ts`
- `lib/site-settings/server.ts`
- `lib/site-settings/admin-route.ts`
- `lib/detail-layout/admin-route.ts`
- `app/(admin)/admin/layout.tsx`
- `app/(public)/layout.tsx`
- `app/(public)/(home)/page.tsx`
- `app/(public)/villas/[id]/page.tsx`
- `supabase/migrations/20260528000000_create_site_settings.sql`
- `supabase/migrations/20260527000000_create_home_section_config.sql`
- Later migrations that add contact, SEO, detail-layout, TikTok, and SEO keyword fields.

Deliverable:

- Expand or update this document with exact table names, columns, owner modules, rollout order, and rollback notes.
- No runtime code or schema changes in this package.

Done when:

- Every `site_settings` JSON field has a keep/normalize decision.
- Rich-content JSON fields are explicitly in or out of scope.
- The implementation order is clear enough for the next package to start.

## Work Package 2: Normalize Site Settings Schema

Purpose: add domain tables and backfill them from legacy `site_settings` while preserving old data.

Likely files:

- New migration under `supabase/migrations/`
- Possibly matching idempotent patch SQL notes for an existing online Supabase project.

Implementation direction:

- Create the domain tables listed in "Data Model Direction".
- Backfill from `site_settings`.
- Enable RLS and add explicit grants/policies.
- Add indexes and uniqueness constraints for singleton keys, profile keys, and ordered child rows.
- Include `notify pgrst, 'reload schema'` after schema/grant changes.
- Do not drop old columns yet.

Done when:

- New tables exist with safe policies and grants.
- Backfill is non-destructive.
- Public reads are exposed only where intentional.
- Admin writes are limited to authenticated admins.

## Work Package 3: Add Narrow Read Models

Purpose: move hot layouts/pages off the large `getSiteSettings()` projection.

Likely files:

- `lib/site-settings/server.ts`
- `lib/site-settings/types.ts`
- `lib/site-settings/defaults.ts`
- `lib/site-settings/validation.ts`
- `app/(admin)/admin/layout.tsx`
- `app/layout.tsx`
- `app/(public)/layout.tsx`
- `app/(public)/(home)/page.tsx`
- `app/(public)/villas/[id]/page.tsx`
- `app/(public)/api/site-assets/proxy/route.ts`
- `components/layout/site-theme-provider.tsx`
- `components/admin/layout/admin-shell.tsx`

Suggested read models:

- `getAdminChromeSettings()`: site name and theme colors for admin shell.
- `getPublicChromeSettings()`: public chrome, contact actions, theme, card style.
- `getHomePageSettings()`: hero, videos, contact summary, and home-only display settings.
- `getSeoSettings(pageKey)`: SEO profile, keywords, same-as links, and image data.
- `getDetailLayoutSettings()`: detail layout only.
- `getFullSiteSettings()`: temporary compatibility adapter for old callers.

Done when:

- `/admin/detail-layout` no longer waits on the full site settings projection through the admin layout.
- Public metadata and layout behavior remain the same.
- Fallbacks still work if the new tables are not populated.
- Targeted helper tests pass, then `npm.cmd run lint` and `npm.cmd run build` pass.

## Work Package 4: Split Admin APIs And Forms By Domain

Purpose: make admin writes match the new domain model instead of rewriting a giant settings object.

Likely files:

- `lib/site-settings/admin-route.ts`
- `lib/site-settings/admin-tiktok-route.ts`
- `lib/site-settings/marketing-tags-route.ts`
- `app/(admin)/api/admin/site-settings/route.ts`
- `app/(admin)/api/admin/site-settings/tiktok/route.ts`
- `app/(admin)/api/admin/site-settings/marketing-tags/route.ts`
- Admin settings components under `components/admin`

Direction:

- Keep the visible UI stable.
- Save each domain independently.
- Do not let contact saves rewrite SEO/theme/detail-layout fields.
- Keep compatibility dual-write to old `site_settings` columns during rollout.
- Surface Supabase/storage/auth errors with useful details.

Done when:

- Existing admin settings screens still load/save the same visible data.
- Each domain has validation and at least one focused save-path test.
- Errors are domain-specific and not collapsed into generic login failures.

## Work Package 5: Normalize Detail Layout

Purpose: move villa detail layout out of `site_settings.detail_layout`.

Suggested tables:

- `detail_layouts`
- `detail_layout_rows`
- `detail_layout_blocks`

Keep a small `config jsonb` on blocks only for options that are not queried or permissioned independently.

Likely files:

- `lib/detail-layout/admin-route.ts`
- `lib/detail-layout/defaults.ts`
- `lib/detail-layout/types.ts`
- `lib/detail-layout/validation.ts`
- `components/admin/detail-layout/admin-detail-layout-page.tsx`
- `components/villas/detail/*`
- `app/(admin)/api/admin/detail-layout/route.ts`
- `app/(public)/villas/[id]/page.tsx`

Done when:

- New tables are backfilled from `site_settings.detail_layout`.
- Admin detail-layout editor loads/saves through normalized rows and blocks.
- Public villa detail renders the same layout after backfill.
- Legacy fallback still works during rollout.
- Tests cover mapping, validation, ordering, and defaults.

## Work Package 6: Cutover And Cleanup

Purpose: remove compatibility debt only after the new paths are verified.

Scope:

- Remove fallback reads from legacy `site_settings`.
- Stop dual-writing old JSON columns.
- Drop legacy columns only after explicit approval, backup/export, and production verification.
- Update `docs/ai/structure.html` with final schema ownership, route ownership, cache behavior, and targeted tests.

Verification:

- Targeted tests for changed helpers/routes.
- `npm.cmd run lint`
- `npm.cmd run build`
- Browser check `/admin/detail-layout`, `/admin/settings`, public home, public villa detail, and metadata-critical pages.
- If public cache/navigation behavior changes, run a production browser network check for bounded route/API counts and no unexpected public `_rsc` or image optimization requests.

## Recommended Order

1. Package 1: confirm exact target model.
2. Package 2: add schema and backfill.
3. Package 3: add narrow read models and fix the detail-layout slowdown path.
4. Package 4: split admin writes by domain.
5. Package 5: normalize detail layout.
6. Package 6: remove legacy compatibility after explicit approval.

## Copy-Paste Prompts

Package 1:

```text
Use docs/ai/admin-cms-data-model-refactor.md. Implement Work Package 1 only: audit current settings/detail-layout data, expand the target model record, and do not change runtime code or schema.
```

Package 2:

```text
Use docs/ai/admin-cms-data-model-refactor.md. Implement Work Package 2 only: add normalized site settings tables with RLS, grants, indexes, and safe backfill from legacy site_settings. Preserve legacy data.
```

Package 3:

```text
Use docs/ai/admin-cms-data-model-refactor.md. Implement Work Package 3 only: add narrow site-settings read models and move admin/public layouts off the full getSiteSettings projection while preserving compatibility and tests.
```

Package 4:

```text
Use docs/ai/admin-cms-data-model-refactor.md. Implement Work Package 4 only: split admin settings saves by domain, keep UI behavior stable, dual-write legacy fields during rollout, and add focused tests.
```

Package 5:

```text
Use docs/ai/admin-cms-data-model-refactor.md. Implement Work Package 5 only: normalize detail layout into rows/blocks tables, backfill from site_settings.detail_layout, keep payload compatibility, and verify admin plus public villa detail behavior.
```

Package 6:

```text
Use docs/ai/admin-cms-data-model-refactor.md. Implement Work Package 6 only: after production verification, remove legacy compatibility paths and update docs/tests. Do not drop legacy columns without explicit approval.
```
