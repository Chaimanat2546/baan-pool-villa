> Current decision (2026-10-06): non-person-tracking event counts replace consent-gated analytics. No consent banner/preferences or analytics cookies/storage; fetch omits credentials and referrer. Per-event IDs only deduplicate retries, never identify visitors. Guide slugs normalize to `/guides` on client/server. Google website measurement remains disabled. Raw event retention stays 180 days with daily cleanup. Infrastructure IP processing for transport/security remains separate. Earlier consent/beacon instructions below are historical and superseded. See `docs/analytics/privacy-audit.md`.

# Site Analytics Implementation Plan

## Current decision — Search ads only (2026-10-06)

The user explicitly chose no Google measurement on the website. Remove GTM/GA4/conversion/remarketing runtime and dataLayer producers; existing stored GTM IDs must not activate tags. The consent UI now controls only the first-party collector and keeps its previously agreed opt-in/180-day policy. The legacy ads field remains solely for stored-preference compatibility and is reset to false on save. The admin marketing page explains this mode instead of offering an inactive GTM editor. Google Ads campaign settings and published GTM containers were not changed. Earlier dual-consent implementation details below are historical and superseded for Google tracking.


> For agentic workers: ใช้ superpowers:executing-plans สำหรับลงมือในแชตนี้ทีละงานหลังตรวจทานแผน หากผู้ใช้เลือก subagent-driven execution จึงใช้ superpowers:subagent-driven-development ห้าม commit/deploy โดยอาศัยข้อความในแผนเป็นการอนุมัติ

**Goal:** เก็บ 5 metrics ลง Tenant Supabase และเปิด PV-ANALYTICS/1.0 reporting โดยแยก consent จาก Google Ads-only GTM

**Architecture:** Next.js routes เรียก `lib/analytics` หลัง Worker guard; เก็บ/aggregate ที่ Tenant DB เดิม; public consent provider คุม collector และ GTM อิสระ

**Tech Stack:** Next.js 16.3, React 19, OpenNext, Cloudflare Workers/rate-limit bindings/scheduled handler, Supabase PostgreSQL, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-10-06-site-analytics-design.md`

สถานะ: implementation และ local verification เสร็จแล้วบน codex/site-analytics; ยังไม่มี online migration/deployment/GTM publish

ผล: Vitest 2,383 ผ่าน, lint/build ผ่าน, Playwright desktop/mobile 10/10 ผ่าน และ SQL execution fixture ผ่าน ดูข้อจำกัดการตรวจระบบจริงใน operations.md

รายละเอียดผลและข้อจำกัดอยู่ใน `docs/analytics/operations.md` รายการด้านล่างเป็น acceptance checklist เดิม ไม่ใช่คำยืนยันว่า staging/production ผ่านแล้ว

ปรับ ownership ตามโค้ดจริง: preferences อยู่ใน provider เดียว; DB client/report อยู่ใน server.ts และ responses อยู่ใน routes.ts ไม่แยก wrapper สำหรับ caller เดียว; navigation อยู่ใน AnalyticsPageReady; SQL execution ใช้ scripts/test-site-analytics-db.mjs บน PGlite แยกจากข้อมูลจริง โดยยังต้องตรวจ Supabase/Worker จริงก่อน release.

## Global Constraints

- Contract PV-ANALYTICS/1.0; events 3 ชื่อ/metrics 5 ค่า; 16 KiB event, report 92 วัน/10,000 กลุ่ม/3 MiB
- Asia/Bangkok; server timestamps; no user/session ID, IP/UA หรือ contact destination ใน events
- consent สองประเภท default denied; preference TTL 180 วัน; event retention 180 วัน
- GTM Google Ads เท่านั้น; `analytics_storage=denied` เสมอ ไม่ replay pre-consent events
- staging ก่อน แล้ว deploy พร้อมเปิด collector/retention ทุก production domain ผ่าน CI matrix เดิมใน release เดียว; Tenant URL owner เดิม ไม่มี catalog writes
- อ่าน installed Next.js docs ก่อนเขียนโค้ด; คง user changes, Prompt, cache TTL เดิม และ normal-document villa navigation
- ไม่มี commit, push, deployment, online migration, GTM publish หรือการส่งข้อความหาบุคคลอื่นจากแผนนี้

## Review Focus

1. BFCache/router/pageshow ซ้อนกันทำยอดซ้ำ — งาน 5 ทดสอบ restored navigation ครั้งเดียว
2. อนุญาต Analytics แต่ปฏิเสธ Ads — งาน 1/2/6 ต้องไม่มี Google requests และไม่ส่ง analytics consent ไป Google
3. Supabase owner ผิดหรือ staging ชี้ production — งาน 3/4/7 ต้อง fail closed และตรวจ config identity
4. คืน report ระหว่าง cleanup — งาน 3 ทดสอบ watermark กับ aggregate snapshot สอดคล้อง ไม่มีการอ้างข้อมูลครบที่ลบแล้ว
5. ถอน consent หลัง GTM โหลดแล้ว — งาน 2/6 หยุด producer/update denied/reload ไม่มี replay และตรวจ network หลัง reload

## งาน 1 — Consent state และ public UI

Files create:
- `lib/tracking-consent/types.ts`, `lib/tracking-consent/store.ts`
- `lib/tracking-consent/__tests__/store.test.ts`
- `components/layout/tracking-consent-provider.tsx`, `components/layout/tracking-preferences.tsx`
- `components/layout/__tests__/tracking-preferences.test.tsx`

Files modify: `app/(public)/layout.tsx`, `components/layout/site-footer.tsx`

Interfaces: `TrackingConsent = { version: 1; analytics: boolean; ads: boolean; expiresAt: number }`; `getTrackingConsent(): TrackingConsent | null`, `saveTrackingConsent({analytics,ads}): void`, `subscribeTrackingConsent(listener): () => void`, `isTrackingAllowed(kind: 'analytics' | 'ads'): boolean` ไม่แตะ browser APIs ระหว่าง SSR

- [ ] เขียน tests default denied, ทั้ง 4 combinations, TTL 180 วันไม่ sliding, malformed/expired/version mismatch, storage throw และ cross-tab revoke
- [ ] รัน `npm.cmd test -- lib/tracking-consent components/layout/__tests__/tracking-preferences.test.tsx` ให้เห็น tests ใหม่ fail ก่อน implementation
- [ ] ทำ store แบบ versioned มี in-memory fallback และ recheck เมื่อ restore/focus; state change แจ้ง producer ทั้งสอง
- [ ] ทำ provider/banner/dialog ภาษาไทยและ Footer action พร้อม labels, keyboard, focus restore; public shell ยังเป็น Server Component
- [ ] รัน targeted tests เดิมให้ผ่าน; ตรวจ mobile overlay ไม่ทับ contact bar ในงาน 6

## งาน 2 — คง GTM สำหรับ Google Ads และแยกระบบสถิติของเราออกมา

คง Conversion/Remarketing เดิมและไม่เพิ่ม GA4 การเปลี่ยน loader ให้รอ consent เป็นงานตามนโยบายความยินยอม ไม่ใช่การลดความสามารถ Google Ads ห้ามลบหรือเปลี่ยนแท็กเดิมโดยยังไม่ได้ตรวจ container จริง

Files modify:
- `app/layout.tsx`, `app/(public)/layout.tsx`
- `components/layout/google-tag-manager-on-interaction.tsx`
- `lib/marketing-data-layer.ts`, `lib/__tests__/marketing-data-layer.test.ts`
- `lib/site-settings/marketing-tags-route.ts`
- `components/admin/marketing-tags/admin-marketing-tags-page.tsx`

Files create: `lib/tracking-consent/google-ads.ts`, `lib/tracking-consent/__tests__/google-ads.test.ts`, `components/layout/__tests__/google-tag-manager-on-interaction.test.tsx`

Consumes: งาน 1 consent store; preserves `pushVillaDetailView`/`pushBookingContactClick` public interface

- [ ] เขียน tests ว่า no GTM/script/iframe ก่อน ads opt-in, ไม่มีใน admin, analytics-only ไม่เปิด Ads, denied event ไม่ถูก queue, defaults มาก่อน init และ withdrawal หยุด producer
- [ ] รัน focused tests ให้ fail; อ่าน current Google consent docs ที่อ้างใน spec ก่อนกำหนด runtime sequence
- [ ] ย้าย GTM จาก root ไป public boundary; ลบ unconditional noscript; consent default denied และ analytics_storage denied เสมอ; เปลี่ยน interaction loader ให้ ads consent เป็น gate หลัก
- [ ] Gate marketing producers ไม่เก็บ backlog; ถอด GA4 instructions ใน admin แต่ไม่เปลี่ยน event names/Ads triggers แบบเดา
- [ ] ทำ revoke sequence update denied -> persist -> document reload และ sync แท็บอื่น; อธิบายว่า request ที่ส่งแล้วเรียกคืนไม่ได้
- [ ] รัน `npm.cmd test -- lib/__tests__/marketing-data-layer.test.ts lib/tracking-consent components/layout/__tests__/google-tag-manager-on-interaction.test.tsx lib/site-settings/__tests__/marketing-tags-route.test.ts components/admin/marketing-tags`
- [ ] เพิ่ม runbook checklist สำหรับ GTM export/Tag Assistant: no GA destinations, no duplicated conversion trigger; ยังไม่ publish container

## งาน 3 — Tenant schema, atomic insert, report และ retention RPC

Files create:
- `supabase/migrations/20261006000000_create_site_analytics.sql`
- `supabase/patches/20261006_site_analytics.sql` (minimal idempotent online patch; ไม่ auto-run)
- `lib/analytics/types.ts`, `lib/analytics/__tests__/migration-contract.test.ts`
- `tests/site-analytics-db.integration.test.ts` (explicit isolated test DB opt-in เท่านั้น)

Produces: server-only RPC wrappers `analytics_insert_event(p_event jsonb, p_site_id text)`, `analytics_report(p_query jsonb, p_site_id text)`, `analytics_prune_events(p_site_id text, p_batch_size integer)`; parameter IDs must equal initialized singleton identity; role grants only backend service role. SQL implementation อยู่ private schema ตาม spec

- [ ] เขียน schema tests CHECK event/channel/path, UUID PK, restricted grants, bounded deletion WHERE/site guard; integration tests concurrent duplicate, conflict payload และ server time เดิม
- [ ] เขียน report tests C12-C14, zero-data/villa filter, 2,000/10,001 groups, safe integer/size errors, full daily rows และสมการยอดทั้งสอง
- [ ] เขียน retention integration test around exact cutoff 180 วันและ failure/transaction rollback; verify watermark ไม่เลื่อนก่อน delete สำเร็จ และ report snapshot ไม่ปะปน
- [ ] รัน tests ใหม่บน isolated DB ให้ fail ก่อนเขียน migration; source-string tests ไม่ใช้แทน SQL execution evidence
- [ ] สร้าง additive migration/index/private functions/wrappers/metadata และ online patch ไม่แตะ catalog schema หรือ auth predicate เดิม
- [ ] Implement aggregation ใน DB snapshot เดียวและ atomic conflict comparison; enforce report bound โดยไม่ truncate
- [ ] รัน migration twice ผ่าน idempotent patch test; ตรวจ anon/authenticated ไม่มีสิทธิ์ และ service wrapper ทำเฉพาะ site ของตัวเอง

## งาน 4 — Server config, access guard และ API routes

Files create:
- `lib/analytics/config.ts`, `validation.ts`, `supabase.ts`, `server.ts`, `report.ts`, `responses.ts`
- `lib/analytics/__tests__/config.test.ts`, `validation.test.ts`, `server.test.ts`, `report.test.ts`
- `app/(public)/api/analytics/v1/events/route.ts`
- `app/(public)/api/analytics/v1/report/route.ts`
- `app/(public)/api/analytics/v1/health/route.ts`
- `worker-analytics-access.js`, `worker-analytics-access.test.ts`

Files modify: `worker.js`, `wrangler.jsonc`, `scripts/production-deploy-config.mjs`, corresponding config/workflow tests, `lib/cache-policy.ts` เฉพาะ named no-store policy ถ้าจำเป็น

Interfaces: `validateAnalyticsEvent(value: unknown): AnalyticsEventInput` reject invalid inputs; `recordAnalyticsEvent(input): Promise<'stored' | 'duplicate'>`; `validateReportQuery(value: unknown, now: Date): AnalyticsReportQuery`; `getAnalyticsReport(query): Promise<AnalyticsReport>`; controlled failures map to contract envelopes

- [ ] เขียน config tests ว่า Tenant URL ไม่ fallback catalog, required ID/origins/token/config ไม่ครบ fail closed; production matrix ทุก target เปิด collector/retention อย่างชัดเจนและ preflight ไม่ปล่อย config ที่ขาดผ่าน; emergency disabled collector ไม่ปิด report
- [ ] เขียน request tests malformed/unknown fields, origin missing/mismatch, actual body >16 KiB แม้ไม่มี Content-Length, event/channel/house validation, token site isolation, expired old token และ no-store ทุก response
- [ ] เพิ่ม Worker tests ว่า reject/rate-limit ก่อน OpenNext/cache และไม่ share calendar quota; dev route ยัง validate schema/auth โดยไม่เชื่อ forged worker headers
- [ ] รัน targeted tests ให้ fail; อ่าน installed Next route docs แล้ว implement thin routes กับ focused helpers
- [ ] ใช้ cached catalog owner สำหรับ villa validation; test unknown vs unavailable, ไม่ทำ direct DB lookup ทุก event
- [ ] รัน `npm.cmd test -- lib/analytics worker-analytics-access.test.ts worker-cache-policy.test.ts scripts/production-deploy-config.test.ts scripts/production-deploy-workflow.test.ts`

## งาน 5 — Client collector และ tracking surfaces

Files create:
- `lib/analytics/client.ts`, `lib/analytics/navigation.ts`
- `lib/analytics/__tests__/client.test.ts`, `navigation.test.ts`
- `components/layout/analytics-page-ready.tsx`, `components/layout/analytics-contact-link.tsx`

Files modify:
- successful page owners ใต้ `app/(public)/(home)`, `search`, `guides`, `guides/[slug]`, `terms`, `privacy`, `villas/[id]` หลังอ่าน actual page files; readiness marker ต้องอยู่หลัง error/notFound decision
- `components/layout/site-header.tsx`, `mobile-bottom-nav.tsx`, `contact-section.tsx`
- `components/villas/detail/booking-sidebar-contact-actions.tsx`, `detail-client-shell.tsx`
- focused tests ของ components ที่เปลี่ยน

Interfaces: `track(input: {event_name; channel; villa_id; page_path}): void` สร้าง schema_version/event_id ภายใน, never throws outward; `markSuccessfulNavigation({pathname,villaId}): void` ใช้ marker กลางที่ dedupe lifecycle สำหรับ navigation เดียว

- [ ] Tests transport: beacon true ไม่ fallback; false fallback ID เดิม; retry 2 ครั้งเฉพาะที่อนุญาต; consent revoke ยกเลิก pending retry; no offline queue; query/hash removed; no PII fields
- [ ] Tests page view: first eligible page/refresh/back-forward/BFCache + Strict Mode ครั้งเดียว, query/hash-only ไม่เพิ่ม, no 404/loading/admin/preview; opt-in ไม่ replay หน้าที่เข้ามาก่อน consent
- [ ] Tests contact: keyboard activation หนึ่งครั้ง; sheet open ศูนย์; tel link หนึ่ง; header/mobile/general villa_id null; sidebar villa_id listing.id; messenger -> chat, LINE ไม่เพิ่ม chat
- [ ] Tests gallery: closed->overview->lightbox->overview = 1; close/reopen = 2; image navigation ไม่เพิ่ม; failed open ไม่เพิ่ม
- [ ] Implement client transport/navigation and small leaf components; ไม่ใช้ parent delegation ซ้อน child handlers และไม่เปลี่ยน link navigation เดิม
- [ ] รัน `npm.cmd test -- lib/analytics components/villas/detail components/layout lib/__tests__/marketing-data-layer.test.ts`

## งาน 6 — Browser, network และ contract integration

Files create: `tests/site-analytics.spec.ts`; use existing production smoke harness

- [ ] เตรียม isolated fixture จาก C01-C14: totals 5/1/0/1/1 พร้อมทั่วไปและสองบ้านที่ map ได้ ห้ามล้าง production
- [ ] รัน collector -> real test DB -> report และ validator ฝั่ง Dashboard เมื่อเข้าถึงได้; จนกว่านั้นระบุว่า cross-system verification ยังไม่ทำ
- [ ] Browser desktop/mobile: ทั้ง 4 consent states, expired/storage error/cross-tab, click/navigation/gallery, not-found และ analytics DB failure ขณะติดต่อ
- [ ] Production-mode network: ปกติหนึ่ง event request, retry bounded, ไม่มี unexpected _rsc หรือ /_next/image, GTM absent denied/admin, ไม่มี GA4 destination/collect; มี Ads หลังยินยอมเท่านั้น
- [ ] ตรวจ UI banner/dialog/Footer keyboard/focus/long Thai text และมือถือไม่บังปุ่มติดต่อ
- [ ] รัน `npm.cmd run lint`, `npm.cmd run build`, focused tests และ `npm.cmd run test:e2e`; ตรวจ runner/config ว่ารวม `tests/site-analytics.spec.ts` จริงและเพิ่ม test selection ที่จำเป็น ไม่อ้าง browser ผ่านจาก build อย่างเดียว

## งาน 7 — Scheduler, rollout และ operator documentation

Files create: `worker-analytics-retention.js`, `worker-analytics-retention.test.ts`, `docs/analytics/operations.md`

Files modify: `worker.js` เพิ่ม scheduled handler, `wrangler.jsonc` daily cron `15 0 * * *` บน staging และทุก production target, `docs/ai/structure.html`, deployment validation tests

- [ ] Tests scheduler disabled/wrong-site ไม่มี delete, bounded batches/timeout, repeated run idempotent, error ถูก surface และ log ไม่มี secret/payload
- [ ] Implement scheduled -> restricted Tenant RPC โดยตรง; no HTTP purge endpoint; verify actual Cloudflare env binding and scheduled execution on staging
- [ ] Runbook ระบุ required config แบบไม่มีค่า secret, GTM readiness, migration-wide effect, activation timestamp, rotation window, data coverage/retention และ rollback ไม่มี drop table
- [ ] ตรวจ staging project isolation ก่อน SQL writes; readiness ต้องผ่านทั้ง DB grants/report/collector/retention/consent/browser
- [ ] แยก deployment authorization จาก implementation: เตรียม reviewed patch และ per-target activation steps ก่อนรันออนไลน์
- [ ] หลัง staging ผ่านและ rollout ได้รับอนุญาต ให้ CI migrate/deploy ทุก production target พร้อม collector/retention enabled ไม่เพิ่ม manual activation รายเว็บ ตรวจเทียบ click/DB/report, health และ technical logs ทุก domain; บันทึกเวลาเริ่มและ deploy failure แยกราย target เพราะ matrix ไม่ได้สำเร็จพร้อมกันแบบ atomic

## Completion evidence

บันทึก test commands/result, SQL integration target ที่ไม่เปิดเผย secret, desktop/mobile browser evidence, GTM container version ที่ตรวจ และรายการงาน online ที่ยังไม่ได้ทำ แยก “โค้ดพร้อม” จาก “production เปิดแล้ว” อย่างชัดเจน ไม่ใช้ข้อจำกัดภายนอกเป็นเหตุหยุดงาน local ที่ทำต่อได้
