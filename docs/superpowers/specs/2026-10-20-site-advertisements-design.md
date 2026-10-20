# Site-owned advertisements

Approved direction: separate advertisement admin page; each website owns its advertisements and images in its existing Home Config Supabase project. No central advertisement database or Worker image fallback. The existing detail-layout block title controls the public heading.

## Behavior

- `/admin/advertisements`: compact list, editor, preview; create/edit/delete, active state, zone (`all` or shared search zones), numeric display order, title and up to 12 ordered images. Draft files remain local until Save, with object URL cleanup. Empty/loading/errors and stale edit conflicts remain visible.
- Existing detail cards and gallery remain, displaying at most three active matching advertisements in explicit order. Empty/error data hides the optional public block. Layout title has its existing normalized default.
- CMS tables `site_advertisements`, `site_advertisement_images`, and `site_advertisement_uploads`; dedicated public Storage bucket `advertisement-assets`. Uploads validate extension, MIME and 6 MiB size, convert to WebP, and record history. Immutable image IDs address same-origin public image routes; sources derive exclusively from this website's Storage bucket.
- Private authorized atomic save/delete RPCs with small public invoker wrappers. Optimistic `updated_at` conflicts protect stale drafts. Storage deletion follows confirmed DB changes; uncertain saves retain new uploads conservatively.
- Public reads use project-namespaced 12-hour cache. Saves invalidate advertisements and a scoped villa-detail HTML cache version group; no eager path regeneration.
- Source-controlled migration and identical idempotent online patch; no automatic remote SQL execution, copying central content, commit or deployment.

## Verification

Focused normalization, public loader, admin authorization/API, upload rollback/conflict and migration tests; custom layout heading regression; component editor behavior; existing image/CSP/cache suites. Run lint, build, full tests and production browser checks on mobile/desktop, including request counts and no unexpected RSC or `/_next/image` requests.
