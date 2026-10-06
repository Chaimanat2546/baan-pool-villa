# Non-person-tracking statistics audit — 2026-10-06

Approved scope: count public page views, contact clicks and gallery opens without profiling visitors; remove the consent banner. Google Ads remains Search advertising only, without website tags.

- Client payload allowlist: schema version, fresh event UUID, event type, channel enum, numeric public villa ID or null, canonical public path. Queries/fragments/destinations are omitted. Article slugs become `/guides`, including direct API submissions.
- UUID is unique per event and reused only for bounded delivery retries. No visitor ID, session ID, fingerprint, unique-visitor calculation or cross-event identity.
- Fetch uses keepalive, credentials omit, referrer policy no-referrer and cache no-store. Beacon is removed because its credentials cannot be configured this way. No analytics local/session storage or cookies. Previously saved consent preferences are inert.
- Server only passes validated fields plus configured site ID to the database. Server receive timestamp is retained for report snapshots. No IP, user agent, referrer or headers are persisted by analytics helpers. Reports expose aggregate counts to authenticated callers.
- Event retention is 180 days, cleaned daily in bounded batches; a backlog/failure can delay deletion and must be monitored. No schema or production database changes in this update.
- Existing listing security logger excludes analytics endpoints. Cloudflare observability and security logs remain enabled; hosting necessarily processes network metadata, and the edge limiter uses IP to resist abuse. These operational systems are separate from the analytics dataset and must not be joined to create visitor profiles. This audit does not certify provider log retention or claim that the whole website processes no personal data.
- Public privacy page includes an explicit notice without overwriting CMS-managed content. Consent banner and preference control/store are removed.

Verification: focused transport/validation tests, full unit suite, lint, Docker production build, Docker API checks, desktop/mobile Playwright checks for missing Cookie/Referer, no Google requests, no consent UI and per-event IDs. See current test outputs for executed results.

## Executed verification

- Full Vitest: 281 files / 2,367 tests passed; final client test type correction separately rerun (4 passed).
- ESLint passed. Docker production Next build including TypeScript passed.
- Playwright desktop/mobile: 6 passed; screenshots inspected.
- Real browser POST returned 201 into isolated Docker PostgreSQL with Cookie and Referer absent, valid same-origin Origin, query/fragment stripped. API authorization/deduplication/report checks passed.
- User's existing localhost tab refreshed. No production deployment or commit.
