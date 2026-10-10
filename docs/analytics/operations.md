# Site Analytics operations

## Current decision — owner GTM alongside first-party statistics (2026-10-07)

Restore the tenant's saved GTM container on public routes after the first pointer, keyboard or scroll interaction, with a noscript fallback. Admin routes never load GTM. `/admin/marketing-tags` edits the existing `google_tag_manager_id`; blank disables Google loading without disabling our collector. No schema changes are needed. Existing saved IDs become active again on deployment. Settings saves retain the existing tagged-cache revalidation.

Google dataLayer events retain their old contracts: `view_item` on villa detail and `booking_contact_click` for LINE/Messenger in the booking sidebar. The owner manages GA/Ads tags, publication and consent configuration in their container. Our code does not automatically grant Google consent. The original delayed loader is preserved, so passive visits without interaction do not run JavaScript GTM. Google page_view depends on configured container tags, not a separate application event.

Our collector remains independent: page_view/contact_click/gallery_open, no visitor/session identifiers, no analytics cookies/storage, fetch credentials/referrer omitted, raw retention 180 days. Legacy local consent preferences remain unused. Privacy copy distinguishes these statistics from owner Google tracking. Campaigns and published containers are not edited.

Historical verification and earlier decisions below describe their dated implementation, not the current Google behavior.

## Restoration verification — 2026-10-07

- Full Vitest: 283 files / 2,376 tests passed, including tenant settings, admin save/validation, Google payloads, StrictMode view deduplication and dual contact emission. ESLint passed.
- Docker production Next.js build and TypeScript passed. Desktop and Pixel 5 browser checks passed; admin editor and privacy screenshots inspected.
- Six Playwright analytics cases passed with a configured fixture GTM container. GTM loaded once per interacted public document and did not load in admin.
- Two browser flows each produced one Google view_item and two booking_contact_click events (LINE/Messenger) in dataLayer. Google network requests were intercepted; this does not prove a published GA/Ads tag fired or a conversion reached Google.
- Our collector returned 201 for all eight test events (four page views and four contact clicks total). Each event ID was matched against an actual row in isolated Docker PostgreSQL. Admin browser save used a fixture API; server persistence/authorization remained covered by unit tests.
- No production database, Google container or campaign was modified, and no deployment was performed for this restoration.

## Scope and rollout

Collector and retention are enabled in all five production targets in wrangler.jsonc:
baanparty, baan02, baanPMhee, flukNasa and villaMedia. The existing CI matrix deploys
them together after its Tenant migration gate. Staging has its own identity and bindings.
No production mutation has been performed as part of this implementation.

First-party event collection starts on successful public page readiness. Raw event
retention is 180 days, with daily bounded cleanup. No Google Ads/GA4/GTM runtime
is loaded. No visitor/session identifiers are generated; event IDs only deduplicate retries.

## Configuration before release

- Each target needs its own ANALYTICS_REPORT_READ_TOKEN Worker secret (at least 32
  random characters). Store it in the Dashboard server's secret store, never client code
  or NEXT_PUBLIC variables. Provision through Wrangler's interactive secret input.
- SUPABASE_SECRET_KEY must belong to that target's Tenant project. The explicit
  NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL must match CENTRAL_USER_MANAGER_PROJECT_REF.
  Never use catalog SUPABASE_URL for analytics. Existing required Worker secrets remain.
- ANALYTICS_SITE_ID equals the target's existing canonical tenant UUID.
  ANALYTICS_ALLOWED_ORIGINS lists exact public origins, including both HTTPS www and
  apex origins for all five production sites. Both variants serve the site without
  redirecting and use the same per-target site identity, so accepted events combine
  in one report. Existing workers.dev origins remain allowed for flukNasa and villaMedia.
  Deploy the updated Worker configuration before expecting secondary-origin collection;
  events previously rejected with ORIGIN_NOT_ALLOWED cannot be recovered by this change.
- flukNasa canonical/CI URL is https://nasapoolvilla.com; villaMedia is https://pukmoodpoolvilla.com. Their analytics origin allowlists also retain their existing workers.dev origins. The prior workers.dev-only allowlists rejected custom-domain events with ORIGIN_NOT_ALLOWED. Build and deploy the updated configuration together so canonical metadata and runtime guards agree.
- Event/report Cloudflare rate limit bindings are separate from calendar quotas.
  Current per-location limits are 120 event requests per minute/IP and 20 report/health
  requests per minute/site. These are abuse controls, not authentication of browser data.
- The existing CI Tenant migration gate includes the additive migration automatically.
  The matching idempotent online patch is in supabase/patches/20261006_site_analytics.sql
  for separately approved manual maintenance; do not apply both as independent history.
- Run authenticated GET /api/analytics/v1/health after deployment for every target.
  It verifies the restricted RPC/identity and initializes persistent coverage metadata.
  Event/report RPCs initialize it transactionally too, so there is no manual activation
  switch per domain and traffic is not discarded while waiting for a health probe.

Coverage starts at the database's first successful initialization timestamp, not a
client timestamp or MIN(event time). This replaces the planned configurable start date
and avoids claiming coverage before the collector actually starts. First partial days
are marked incomplete. Counts are best-effort events, not unique visitors; delivery failures can reduce totals.

## API

- POST /api/analytics/v1/events: same-origin JSON, single event, max 16 KiB,
  server timestamp and site identity. Fields: schema_version=1, event_id UUID,
  event_name, channel, villa_id, page_path. Villa IDs are numeric listing property IDs.
  No user/session identifier, IP, user-agent, query string or contact destination is saved.
- Event names: page_view, contact_click and gallery_open. Only contact_click carries
  phone/chat/line; LINE is independent of chat. General actions use villa_id=null.
- Insert returns 201 stored, 200 duplicate, or 409 EVENT_ID_CONFLICT for UUID reuse
  with changed content. Client retries reuse the same UUID, at most twice, and stop
  on TRACKING_DISABLED. Fetch omits credentials and referrer; no beacon transport remains.
- POST /api/analytics/v1/report and GET /api/analytics/v1/health require Bearer token.
  Report query fields: contract_version="1.0", from_date, to_date, timezone="Asia/Bangkok",
  as_of (UTC ISO timestamp), villa_id (numeric string or null). Maximum 92 inclusive days,
  10,000 villa groups and 3 MiB. Reports fail rather than truncate.
- Reports include totals, unattributed, complete daily rows, villas, query, site_id,
  generated_at and coverage. All endpoints return private, no-store.

## Retention and recovery

Worker scheduled() calls restricted cleanup directly daily at 00:15 UTC. Each run uses
at most ten batches of 10,000 rows, with a 10-second request timeout. SQL deletes only
matching-site rows older than 180 days and advances its watermark in the same transaction.
Monitor scheduled exceptions and ANALYTICS_RETENTION_BATCH_LIMIT; a batch-limit warning
requires checking backlog and scheduling an approved extra invocation. Failed cleanup
can be rerun safely. There is no public purge route. Retention is daily, not an exact
per-second deletion guarantee.

Emergency ANALYTICS_ENABLED=false disables event intake without disabling reports.
ANALYTICS_RETENTION_ENABLED=false pauses cleanup for an investigated incident.
Normal deployment config validation intentionally requires both true on all production targets.
Do not drop tables during application rollback; preserve analytics history and tokens.

For token rotation, set ANALYTICS_REPORT_PREVIOUS_TOKEN and an explicit UTC
ANALYTICS_REPORT_PREVIOUS_TOKEN_EXPIRES_AT, update ANALYTICS_REPORT_READ_TOKEN,
then switch Dashboard credentials and remove the old secret after its overlap expires.
Use a unique token for every site; report credentials never authorize cleanup.

## Local verification and release boundaries

Local tests cover omission of credentials/referrer/storage, absence of Google tags,
validation, API guards, UUID retries, successful navigation/BFCache and deployment config.
Production-build Playwright tests use stubbed collectors and Google scripts to avoid
sending synthetic events to production. Mobile and desktop screenshots are inspected.

SQL execution uses an isolated in-memory PostgreSQL PGlite engine and never reads .env:

    npm install --prefix .superpowers/analytics-test-runtime --no-save --package-lock=false @electric-sql/pglite
    node scripts/test-site-analytics-db.mjs

It checks replay, identity/role denial, insert/dedup/conflict, 2,000 groups, Thai midnight,
sum invariants and retention. This is not a replacement for live Supabase/PostgREST
and Worker scheduled execution or a multi-connection concurrency test.

Before releasing, verify on staging: real RPC grants, duplicate races, Worker quota/no-store,
cron execution, then the health/report response of all production domains after CI deployment.
The Dashboard 02 repository is not included here; end-to-end Dashboard consumption remains
an integration check. Confirm no GTM/GA4/Ads measurement scripts load after release.
Existing external GTM containers are unchanged and must remain disconnected from this website.

## Historical local result before consent removal — 2026-10-06

- Full Vitest: 286 files, 2,383 tests passed. Additional gallery open/close transition assertions: 14 targeted tests passed.
- ESLint and Next production build passed. Focused ESLint passed again after final test-only updates.
- Production Playwright: 10/10 passed on desktop and mobile, including no unexpected public RSC/image-optimizer traffic in the exercised flows. Consent screenshots inspected at both widths.
- Isolated SQL execution passed: replay, role/tenant denial, stored/duplicate/conflict, 2,000 groups, 10,001-group rejection, Thai midnight, aggregate sums, exact retention boundary and rollback.
- Final independent code review verified consent fallback, native gtag Arguments, tenant URLs, Thai slugs and found no additional release-blocking issue.
- Existing smoke assertions were corrected to count full images instead of card wrappers, accept the existing admin-access login query, and count all shared image URL requests conservatively against the same four-request budget.
- No commit, push, online SQL, deployment, token provisioning or GTM publish was performed. Live Supabase/Worker, actual GTM contents and Dashboard integration checks remain release prerequisites above.

## Docker verification — 2026-10-06

Completed on Docker Desktop with Linux containers: Node 24, Next.js 16.3,
PostgreSQL 17.10 and PostgREST 16.2. Image: bpv-analytics-test:local.

- Clean Docker production build passed. Local .env/.env.local and .git were excluded;
  a container check confirmed no local env files were copied into the image.
- Full Vitest inside the Linux image: 286 files, 2,383 tests passed (74.14 seconds).
- Playwright against the Docker app: all four analytics browser cases passed on
  desktop/mobile (16.4 seconds); mobile consent dialog screenshot inspected.
- Real PostgreSQL passed the migration/replay/roles/tenant/dedup/report/retention fixtures.
- Twelve simultaneous DB inserts of one event returned exactly one stored and eleven
  duplicates. A simultaneous changed-payload race returned one stored and one conflict.
- A report concurrent with retention maintained a consistent aggregate/coverage snapshot;
  after commit, deleted data was not reported as complete.
- End-to-end Next → TLS proxy → PostgREST → PostgreSQL passed: authenticated health/report,
  unauthorized and wrong-origin rejection, 16 KiB body limit, stored/duplicate/conflict,
  eight concurrent API requests (one stored/seven duplicate), report deltas and no-store.
- The actual worker-analytics-retention.js helper ran in Docker against PostgREST;
  the expired fixture row was removed and a DB assertion verified zero expired rows.

The first clean build identified sitemap's catalog configuration dependency. The Docker
harness supplies an isolated empty catalog fixture for build/runtime; it does not import
production credentials or copy live catalog data. Public pages consequently use fallback
site settings. This is a test image, not a new production deployment configuration.
Cloudflare's scheduler delivery/rate-limit bindings and externally managed GTM contents
still require their respective release checks.

Local preview: http://127.0.0.1:3101. PostgreSQL is bound only to loopback port 55439.
Temporary harness, logs and test-only credentials are under .superpowers/docker-analytics
(ignored by git). The test TLS certificate lasts two days. Containers are deliberately
left running for inspection: bpv-analytics-app, bpv-analytics-db, bpv-analytics-rest,
bpv-analytics-tls and bpv-analytics-catalog, on network bpv-analytics-test.
Stop only these when finished:

    docker stop bpv-analytics-app bpv-analytics-tls bpv-analytics-rest bpv-analytics-catalog bpv-analytics-db

No online migration, production deployment, production write or commit was performed.

## Search-only change verification — 2026-10-06

After the user explicitly chose no Google website measurement:

- Full Vitest passed: 283 files, 2,376 tests. Removed tests belonged to the removed Google loader/dataLayer/consent helper and retired GTM editor; first-party analytics tests remain.
- ESLint and the rebuilt Linux Docker production image passed.
- Six Playwright cases passed against Docker on desktop/mobile, including legacy ads=true consent with no Google requests or dataLayer.
- Real Docker API → PostgREST → PostgreSQL integration passed again after the change.
- Public consent screenshots and isolated admin status component desktop/mobile renders were inspected.
- Independent review found no remaining Google loader or event producer. CSP allow entries alone do not load tags.
- Docker app at http://127.0.0.1:3101 was replaced with the new image and the user's open tab was refreshed. Its banner now asks only about first-party website statistics.

Published tag inventory and scope are recorded in google-tags-audit.md. No campaign,
published GTM container, production deployment, or online setting was changed.
