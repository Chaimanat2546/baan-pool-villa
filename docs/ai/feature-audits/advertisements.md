# Site-owned Advertisements CMS

Updated: 2026-10-20. Implementation replaces central advertisement reads and Worker image construction with each website's Home Config CMS and Storage.

- Admin: `/admin/advertisements`, paginated list/editor/preview, explicit Save for draft image uploads, title/zone/order/active state, ordered gallery images and confirmed delete.
- Heading: existing `/admin/detail-layout` block title now reaches the public renderer.
- Owners: `lib/advertisements/{types,validation,server,admin-route,admin-assets}.ts`, `components/admin/advertisements`, authenticated admin route and ID-addressed public image route.
- Data: `site_advertisements`, `site_advertisement_images`, `site_advertisement_uploads`; dedicated `advertisement-assets` bucket. No central fallback or automatic import.
- Security/lifecycle: admin-only private atomic functions with invoker wrappers, scoped replacement/deletion, optimistic timestamps, per-ad image paths, recorded uploads, postcommit removed-image cleanup and conservative retention after uncertain saves.
- Cache: project-namespaced 12-hour data reads; mutations invalidate advertisements data and scoped detail HTML version. Previously public immutable image URLs may remain cached after deactivation.
- Schema rollout: source migration `20261020000000_create_site_advertisements.sql` and identical online patch `20261020_site_advertisements.sql`. Runtime deployment requires applying the schema to each site's CMS database.

Verification commands and the detailed route/owner map are in `docs/ai/structure.html#site-advertisements`. `scripts/test-site-advertisements-db.mjs` exercises SQL in a disposable local PGlite database, including idempotence, ordering, conflicts, foreign image rejection, authorization, public RLS and retained upload history.
