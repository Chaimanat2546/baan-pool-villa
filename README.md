# Baan Pool Villa

README นี้เป็น runbook หลักของ repo สำหรับเว็บ Baan Pool Villa: เว็บ public สำหรับค้นหา/ดูบ้านพักพูลวิลล่า และระบบ admin สำหรับจัดการ CMS, settings, guide, legal pages, TikTok, และ layout หน้ารายละเอียดบ้าน

## ระบบนี้รันอะไร

- Public site: `/`, `/search`, `/villas/[id]`, `/guides`, `/guides/[slug]`, `/terms`, `/privacy`
- Admin site: `/admin/login`, `/admin/settings`, `/admin/sections`, `/admin/tiktok`, `/admin/guides`, `/admin/legal`, `/admin/detail-layout`
- Public APIs: villa listings/detail/images, home sections, guide/site asset/image proxy, booking calendar
- Admin APIs: site settings, home sections, guides, legal pages, TikTok, detail layout, external data refresh, Turnstile login verification

## Stack

- Next.js `16.2.6` App Router
- React `19.2.4`
- Tailwind CSS v4
- Vitest for unit/component tests
- Playwright for production smoke tests
- Supabase for villa gallery images and admin-managed CMS/settings data
- External Deville/Pattaya APIs for villa listings, villa detail, and booking calendar data
- OpenNext Cloudflare + Wrangler for Cloudflare Workers deployment

## Source Of Truth

- `AGENTS.md`: workflow, guardrails, model strategy, cache/Supabase/admin/UI rules
- `docs/ai/structure.html`: route map, ownership map, data flow, and verification map for agents
- `PRD.md`: product background and requirements
- `node_modules/next/dist/docs/`: read the relevant local Next.js guide before editing Next.js APIs or conventions; this repo uses a newer Next.js than many examples

Update `docs/ai/structure.html` in the same change when adding, moving, renaming, or removing routes, route handlers, loading UI, feature folders, shared helper ownership, public contracts, cache/revalidation behavior, settings flows, Supabase schema ownership, or targeted test guidance.

## Local Setup

Use the npm lockfile. In PowerShell:

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

Open `http://localhost:3000`.

On non-Windows shells, use `npm` instead of `npm.cmd` and copy `.env.example` to `.env` with your shell's normal copy command.

## Environment Variables

Never commit or print real secret values. Use names only in docs, logs, and support notes.

Required local keys from `.env.example`:

| Variable | Used For | Exposure |
| --- | --- | --- |
| `CALENDAR_INTERNAL_API_TOKEN` | Private booking-calendar Worker/route authentication | Server-only secret |
| `DEVILLE_BEARER_TOKEN` | Deville Central villa detail API | Server-only secret |
| `PATTAYA_BOOKINGS_API_TOKEN` | Pattaya booking calendar API | Server-only secret |
| `SUPABASE_PUBLISHABLE_KEY` | Villa gallery Supabase reads | Publishable key, still keep out of logs |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, sitemap host, admin origin checks, prewarm fallback | Public |
| `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL` | CMS/settings Supabase project URL | Public |
| `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY` | CMS/settings Supabase publishable key | Public |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Admin login Turnstile widget | Public |
| `TURNSTILE_SECRET_KEY` | Admin login Turnstile verification | Server-only secret |

Optional/special-purpose keys used by helpers:

| Variable | Used For |
| --- | --- |
| `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` | Override villa gallery Supabase URL; defaults exist in `lib/villas/images.ts` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Fallback publishable/anon keys for villa gallery reads |
| `IMAGE_PROXY_BASE_URL` | Override image proxy base URL in villa image helpers |
| `BPV_PREWARM_BASE_URL` | Base URL for `scripts/prewarm-public-html.mjs` when `--url` is not passed |
| `PLAYWRIGHT_BASE_URL` | Base URL for production smoke tests; default is `http://127.0.0.1:3100` |

## Common Commands

Use `npm.cmd` in PowerShell.

| Command | Purpose |
| --- | --- |
| `npm.cmd run dev` | Start local Next.js dev server |
| `npm.cmd run lint` | Run ESLint |
| `npm.cmd test` | Run the full Vitest suite |
| `npm.cmd test -- <path>` | Run targeted Vitest tests |
| `npm.cmd run build` | Run production Next.js build with webpack and system CA |
| `npm.cmd run start` | Start built Next.js app |
| `npm.cmd run test:e2e` | Start built app on `127.0.0.1:3100` and run Playwright smoke tests |
| `npm.cmd run preview:cf` | Build OpenNext Cloudflare output and run Wrangler preview |
| `npm.cmd run deploy:cf` | Build and deploy to Cloudflare |
| `npm.cmd run deploy:cf:prewarm` | Build, deploy, then prewarm public HTML cache |
| `npm.cmd run build:cf` | Build OpenNext Cloudflare output without deploying |
| `npm.cmd run deploy:cf:built -- --env baanparty` | Deploy existing OpenNext output to the named approved Wrangler environment; use `baan02` or `baanPMhee` only with its matching build |
| `npm.cmd run validate:deploy:cf` | Validate production target URLs and required secret declarations |
| `npm.cmd run prewarm:cf` | Prewarm public HTML cache for an already deployed site |
| `npm.cmd run upload:cf` | Build and upload Cloudflare worker assets |

Run `npm.cmd run build` before `npm.cmd run test:e2e`; `next start` needs an existing production build.

## Testing Runbook

- Documentation-only updates: manual diff/read-through is enough.
- Next.js/frontend changes: run narrow tests when useful, then `npm.cmd run lint`, then `npm.cmd run build`.
- Shared filtering, normalization, pricing, images, detail, site settings, contact settings, admin helper, validation, or Supabase persistence changes: run the narrowest targeted tests first, then lint/build.
- UI/layout/loading/navigation changes: render the touched page locally and inspect mobile and desktop widths before completion.
- Public image rendering, navigation prefetch, cache policy, ISR, or public server data loading changes: perform production browser/network verification and confirm request counts stay bounded.

The detailed targeted-test map lives in `docs/ai/structure.html`.

## Architecture Map

Keep route files thin. Route files should mainly own metadata, server data loading, JSON-LD, and prop passing. Feature behavior belongs in the relevant component or `lib` owner.

Main ownership areas:

| Area | Owner |
| --- | --- |
| Public home UI | `components/villas/home` |
| Search UI and filter client behavior | `components/villas/search` |
| Villa detail UI | `components/villas/detail` |
| Shared listing cards/grid/price/stats | `components/villas/listing` |
| Public header/footer/contact UI | `components/layout` |
| Admin UI | `components/admin` |
| Villa data, normalization, filters, images, booking calendar | `lib/villas` |
| Site settings, theme colors, asset retention | `lib/site-settings` |
| Home sections | `lib/home-sections` |
| Guides | `lib/guides` |
| Legal pages | `lib/legal-pages` |
| Detail layout CMS | `lib/detail-layout` |
| SEO and JSON-LD | `lib/seo.ts`, `lib/json-ld.ts` |
| Cache policy and revalidation | `lib/cache-policy.ts`, `lib/cache-revalidation.ts` |
| Admin auth/request helpers | `lib/admin` |

Avoid top-level villa re-export wrappers under `components/villas`; import from the real feature folder.

## Data Flow

| Flow | Source | Normalization/Cache | Consumers |
| --- | --- | --- | --- |
| Villa listings | `https://www.devillegroups.com/api/json/getHouse_deville.json` | `lib/villas/server.ts`, `lib/villas/normalize.ts`, villa listings tag/TTL | Home rails, search, guide recommendations, sitemap, `/api/houses` |
| Listing cover images | `https://devillegroups.com/imgs/profile_imgs_large/{img_name}` | Listing cover image helpers/proxy | Home/search/listing cards |
| Villa detail | Deville Central accommodation API with `DEVILLE_BEARER_TOKEN` | `lib/villas/server.ts`, `lib/villas/detail.ts` | `/villas/[id]`, `/api/villas/[id]` |
| Booking calendar | Pattaya bookings API with `PATTAYA_BOOKINGS_API_TOKEN` | `lib/villas/booking-calendar.ts` | Villa detail booking sidebar |
| Villa gallery images | Supabase `images` rows where `property_id` matches house id | `lib/villas/images.ts`, image proxy/download routes | Villa detail gallery |
| Home sections | CMS Supabase project | `lib/home-sections` | Homepage rails and admin sections |
| Site settings | CMS Supabase project with defaults fallback | `lib/site-settings` | Public/admin layouts, theme, metadata, contact actions, TikTok settings |
| Guides | CMS Supabase project and guide asset storage | `lib/guides` | Guide list/detail, homepage guide rail, admin guide editor |
| Legal pages | CMS Supabase project | `lib/legal-pages` | `/terms`, `/privacy`, footer links, admin legal editor |
| Detail layout | CMS Supabase project | `lib/detail-layout` | Villa detail renderer and admin layout builder |

## Cache And Image Rules

- Cache durations, tags, and public `Cache-Control` strings belong in `lib/cache-policy.ts`.
- Revalidation helpers belong in `lib/cache-revalidation.ts`; do not scatter ad hoc `revalidatePath` or `revalidateTag` calls across admin route handlers.
- Public data reads generally use 12-hour tagged caches; villa listings use 6 hours; sitemap uses 24 hours.
- Admin routes and admin APIs are `no-store`.
- Root rendered pages are produced on demand while explicit data caches remain tagged and time-based.
- `next.config.ts` keeps `images.unoptimized = true`. Do not enable the Next image optimizer unless the deployment has an approved paid image-optimization plan and updated verification.
- Public images should use same-origin validated proxy routes where the repo already provides them, so Cloudflare/Worker caching stays bounded and upstream URLs stay validated.
- Shared listing cards linking to `/villas/[id]` should use normal document navigation, not client-side `next/link` prefetch behavior that creates avoidable RSC requests.

## Cloudflare Deployment Notes

Deployment uses OpenNext Cloudflare and Wrangler:

- `open-next.config.ts` configures R2 incremental cache, Durable Object queue, and sharded tag cache.
- `wrangler.jsonc` points the worker to `worker.js`, binds `.open-next/assets`, R2 cache buckets, Durable Objects, `IMAGES`, service self-reference, and version metadata.
- `wrangler.jsonc` marks `CALENDAR_INTERNAL_API_TOKEN`, `DEVILLE_BEARER_TOKEN`, `PATTAYA_BOOKINGS_API_TOKEN`, `SUPABASE_PUBLISHABLE_KEY`, and `TURNSTILE_SECRET_KEY` as required secrets.

Normal production releases run through
`.github/workflows/deploy-production.yml`: on push to `master` (normally when a PR is merged), verify once, then build/deploy/prewarm all three clients through isolated matrix jobs.

The build receives `SUPABASE_PUBLISHABLE_KEY` from the matching GitHub
Environment secret because the villa catalog and `/sitemap.xml` need it at
build time. The matching Cloudflare Worker secret remains runtime-owned; keep
the two copies synchronized and never print either value. The three
home/Turnstile public variables remain owned by their matching GitHub
Environment.

Complete one-time GitHub and Cloudflare setup before the workflow's first
merge. See [`docs/deployment.md`](docs/deployment.md) for configuration
ownership, retry, rollback, and emergency recovery.

For a cache-only prewarm after deploy:

```powershell
npm.cmd run prewarm:cf -- --url=https://your-site.example
```

Useful prewarm options:

- `--path=/villas/123`
- `--path=/guides/some-slug`
- `--max-dynamic=60`
- `--concurrency=2`
- `--timeout-ms=10000`
- `--no-verify`

The prewarm script always includes `/`, `/search`, `/guides`, `/terms`, and `/privacy`, then reads `sitemap.xml` for eligible villa and guide detail routes up to the dynamic limit.

## Supabase Runbook

- Treat files in `supabase/migrations` as schema history.
- Use `supabase/seed.sql` only for new/local databases or explicitly empty online projects.
- For an existing online Supabase project, prefer minimal idempotent patch SQL rather than rerunning full migrations/seeds.
- When permissions or exposed functions change, include explicit grants and `notify pgrst, 'reload schema'` when the PostgREST schema cache must refresh.
- Keep privileged write helpers in private schema functions with a small public invoker wrapper when elevated database behavior is required.
- Admin APIs should surface Supabase `message`, `code`, `details`, and `hint` where possible.

## Troubleshooting

- Missing villa detail: check `DEVILLE_BEARER_TOKEN` and the upstream Deville Central API response.
- Empty gallery: check villa Supabase publishable key, Supabase URL fallback, and whether `images.property_id` matches the house id.
- Booking calendar unavailable: check `PATTAYA_BOOKINGS_API_TOKEN` and the month format `YYYY-MM`.
- Admin login fails in production: confirm both Turnstile keys exist. Development bypasses Turnstile verification by design.
- Unexpected login redirect after admin save: distinguish true auth/session failures from Supabase/storage permission errors; the form should show permission errors instead of treating every `403` as login failure.
- Public image quota or request spikes: confirm `images.unoptimized = true`, public pages do not call `/_next/image`, and repeated rails/listing grids do not enable aggressive prefetch/preload.
- Cloudflare cache not warming: inspect the `x-bpv-html-cache` response header and run `npm.cmd run prewarm:cf -- --url=<site> --path=<path>` for a single route.

## Contribution Notes

- Preserve user changes in the working tree.
- Do not commit unless explicitly requested.
- Keep public/admin theme colors flowing through site settings where practical.
- Keep contact actions backed by shared contact/settings helpers.
- Add or update focused tests when changing parsing, normalization, validation, authorization, data contracts, cache behavior, or Supabase persistence.
- For admin CMS/settings pages, keep the compact admin dashboard style and Thai admin-facing copy.
