> Update 2026-10-07: restore owner GTM, original dataLayer events and the admin GTM editor alongside the independent collector. The Google-removal decision below is superseded; see `docs/analytics/operations.md`.

> Historical decision (2026-10-06): non-person-tracking event counts replace consent-gated analytics. No consent banner/preferences or analytics cookies/storage; fetch omits credentials and referrer. Per-event IDs only deduplicate retries, never identify visitors. Guide slugs normalize to `/guides` on client/server. Google website measurement remains disabled. Raw event retention stays 180 days with daily cleanup. Infrastructure IP processing for transport/security remains separate. Earlier consent/beacon instructions below are historical and superseded. See `docs/analytics/privacy-audit.md`.

# Site Analytics และ Google Ads Consent — แบบระบบ

## Historical decision — Search ads only (2026-10-06)

The user explicitly chose no Google measurement on the website. Remove GTM/GA4/conversion/remarketing runtime and dataLayer producers; existing stored GTM IDs must not activate tags. The consent UI now controls only the first-party collector and keeps its previously agreed opt-in/180-day policy. The legacy ads field remains solely for stored-preference compatibility and is reset to false on save. The admin marketing page explains this mode instead of offering an inactive GTM editor. Google Ads campaign settings and published GTM containers were not changed. Earlier dual-consent implementation details below are historical and superseded for Google tracking.


วันที่: 2026-10-06

สถานะ: สรุปแนวทางที่ผู้ใช้เลือกแล้ว; เอกสารนี้รอตรวจทานก่อน implementation

## เป้าหมายและขอบเขตที่ตกลง

เก็บสถิติของแต่ละเว็บไซต์ใน Supabase ของเว็บไซต์นั้น และเปิด Reporting API ตาม PV-ANALYTICS/1.0 ให้ Dashboard ภายนอกเรียกยอดสรุป ใช้ Next.js Route Handlers บน OpenNext/Cloudflare Worker เดิม พร้อมตัวป้องกันก่อนเข้า OpenNext

- ทดสอบบน staging แล้ว deploy และเปิด collector ทุก production domain ผ่าน CI matrix เดิมใน release เดียวกัน ไม่มีขั้นเปิดเฉพาะ `baanparty` (ปรับตามผู้ใช้ที่ยืนยันว่า CI deploy ทุก domain)
- เก็บ page view, คลิกโทร, คลิกแชท, คลิก LINE และเปิด gallery เท่านั้น
- Analytics ของเราไม่ผ่าน GTM; GTM ใช้ Google Ads เท่านั้น ไม่มี GA/GA4
- แยก consent สถิติและโฆษณา Google; ค่าเริ่มต้นทั้งคู่เป็นปฏิเสธ
- จำตัวเลือกในเครื่อง 180 วัน; เก็บ raw events 180 วัน
- ไม่สร้าง Dashboard, unique visitors, session tracking, booking attribution หรือ revenue analytics ในรอบนี้
- ไม่ commit, deploy, publish GTM container หรือแก้ฐานออนไลน์ในขั้นจัดทำเอกสาร

เอกสารต้นทาง: `C:/Users/chaym/Downloads/01_site_collector_development.md` เป็นข้อกำหนดอ้างอิง ไม่ใช่หลักฐานว่าระบบมีฟีเจอร์แล้ว ตัวอย่างรหัสบ้าน/ตัวเลขในนั้นไม่ใช่ข้อมูลจริง

## หลักฐานจาก repository

ตรวจโค้ดในวันที่ข้างต้น ไม่ได้ตรวจ schema, secrets, traffic หรือ GTM container ที่ deploy จริง

| Owner | ข้อค้นพบ |
| --- | --- |
| `package.json`, `wrangler.jsonc`, `worker.js` | Next.js 16.3, OpenNext, Worker เดิม; production 5 targets และ staging |
| `lib/villas/server.ts` | public ID มาจาก `listings.property_id`; `SUPABASE_URL` เป็น owner ข้อมูลบ้านกลาง |
| `lib/villa-reviews/supabase.ts` | รูปแบบ client server ของ Tenant ใช้ `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL` + `SUPABASE_SECRET_KEY` |
| `lib/marketing-data-layer.ts` | มี `view_item` และ `booking_contact_click`; channel เดิมเป็น line/messenger |
| `app/layout.tsx` | โหลด GTM จาก root รวมทั้ง noscript iframe; ต้องย้ายออกจาก root |
| `components/layout/google-tag-manager-on-interaction.tsx` | interaction ปัจจุบันเปิด GTM โดยไม่มี consent gate |
| `components/villas/detail/detail-client-shell.tsx` | gallery มี closed/overview/lightbox; view_item ใช้ ref กันซ้ำต่อ listing |
| `components/layout/mobile-bottom-nav.tsx` | ปุ่มโทรเปิด sheet ก่อน แล้วผู้ใช้กด tel link อีกที |
| `lib/api/rate-limit.ts`, `worker-calendar-access.js` | helper ทั่วไปอยู่ใน memory; calendar มี Cloudflare rate-limit binding เป็นรูปแบบอ้างอิง |
| `.github/workflows/deploy-production.yml` | source migration เปลี่ยนจะเปิด migration gate ทั้งห้า Tenant ก่อน deploy |
| `lib/cache-policy.ts` | catalog ปัจจุบัน 6 ชั่วโมง, ข้อมูลหลายประเภท 12 ชั่วโมง; ไม่เปลี่ยนค่าเดิมในงานนี้ |

ยังไม่พบ collector, reporting endpoint, analytics schema หรือ consent UI ที่ตรงสัญญานี้ในพื้นที่โค้ดที่ตรวจ

## Data flow และ ownership

```text
Public page + consent
  -> lib/analytics/client.ts
  -> same-origin POST /api/analytics/v1/events
  -> Worker access/rate/body-size guard
  -> Next.js handler -> lib/analytics/server.ts
  -> Tenant Supabase analytics_events

Dashboard backend + per-site report token
  -> POST /api/analytics/v1/report
  -> authorization + validation -> Tenant reporting RPC -> aggregate JSON

Google Ads consent -> public-only GTM -> configured Google Ads tags
```

ใช้ `lib/analytics/` เป็น owner ของ types, validation, config, client transport, navigation marker, server persistence และ report contract ส่วน consent อยู่ใน `lib/tracking-consent/` เพราะมีผู้ใช้สองระบบ UI อยู่ใน `components/layout/` ไม่เปลี่ยนทั้ง public layout เป็น Client Component

Server Analytics ใช้ Tenant URL owner เดิมเท่านั้น ไม่มี fallback ไป catalog URL ตรวจ config ก่อนสร้าง privileged client รหัสบ้านใช้ string ของ `property_id` ไม่ใช้ row UUID และไม่สร้าง FK ข้ามโปรเจกต์

ตรวจรหัสบ้านจาก catalog cache เดิม ไม่เรียก `getListingById()` ทุกคลิก: implementation ปัจจุบันของ helper นี้อ่าน Supabase โดยตรง ข้อมูลไม่พร้อมและไม่มี cache ที่เชื่อถือได้ตอบ 503; รหัสไม่อยู่ในข้อมูลที่โหลดสำเร็จตอบ 422 ใช้รายงานของ event ที่บันทึกแล้วต่อได้แม้บ้านเลิกประกาศ

## Config และขอบเขตการเปิดใช้

เพิ่ม server config: `ANALYTICS_SITE_ID`, `ANALYTICS_ENABLED`, `ANALYTICS_ALLOWED_ORIGINS`, `ANALYTICS_RETENTION_ENABLED` และ secret `ANALYTICS_REPORT_READ_TOKEN` แยกรายเว็บ ชื่อภายในต่างจากเอกสารได้ แต่ JSON contract ไม่เปลี่ยน

- `ANALYTICS_SITE_ID` เป็นค่าคงที่เฉพาะ environment ไม่ derive จาก domain; staging ต้องไม่ใช้ ID production
- ตั้ง collector และ retention enabled อย่างชัดเจนสำหรับทุก production target ใน release นี้; config ไม่ครบต้อง fail closed และ deployment preflight ต้องแจ้งข้อผิดพลาด ไม่ปล่อยเว็บที่ตั้งค่าไม่ครบผ่านเงียบ ๆ
- `ANALYTICS_ENABLED=false` ปิดรับ event โดยตอบ 503 `TRACKING_DISABLED` และ client ไม่ retry รหัสนี้; ไม่ปิดการอ่านรายงานเก่า
- `/api/analytics/v1/health` ใช้ GET และ report token คืนเฉพาะ site_id, contract_version, readiness
- รองรับ token เก่าในช่วง rotation แบบมีเวลาหมดอายุที่แน่นอน ไม่รับเก่าตลอดไป
- รายงานและ collector ใช้ no-store; ห้าม revalidate public pages เมื่อมี event
- production bindings แยก event/report rate limiter จาก Calendar ค่าเริ่มต้นเสนอ 120 event requests/60 วินาทีต่อ client และ 20 report requests/60 วินาทีต่อ site token; ทดสอบ NAT/shared-client และโหลดก่อนปรับเปิดจริง ไม่อ้างว่าเป็น global exact quota
- ใช้ trusted Cloudflare client IP เฉพาะ rate limiting ไม่เก็บลง events/logs; report limiter ไม่ log token

## Consent และ UX

กล่องตั้งค่ามีสองตัวเลือกอิสระ: “สถิติการใช้งาน” และ “โฆษณา Google” default off ปุ่ม “ยอมรับทั้งหมด”, “ปฏิเสธทั้งหมด”, “บันทึกตัวเลือก” มีลำดับและน้ำหนักที่ไม่ชักจูงให้ยอมรับ รองรับ keyboard/focus และไม่บังแถบติดต่อมือถือ

Footer มี “ตั้งค่าความเป็นส่วนตัว” เปิดแก้ไขได้ตลอด เก็บเฉพาะ policy version, สอง booleans และเวลาหมดอายุ 180 วันใน localStorage ไม่มี unique ID และไม่ต่ออายุจากการเข้าเว็บเฉย ๆ ถ้าอ่าน/เขียน storage ไม่ได้ใช้ค่าของแท็บใน memory; ไม่ถือว่าผู้ใช้ยอมรับโดยอัตโนมัติ Expired/malformed/version เก่าให้กลับ denied และขอใหม่ Sync ผ่าน storage event ระหว่างแท็บและตรวจซ้ำเมื่อ pageshow/กลับมาใช้งาน

เมื่อถอน analytics consent ยกเลิก timer/retry และ abort fetch ที่ยังยกเลิกได้ ไม่สามารถเรียกคืน beacon/request ที่ส่งไปแล้วได้ ไม่ backfill interaction ระหว่าง denied เมื่อยอมรับใหม่ เริ่มติดตาม interaction/navigation ถัดไป; ไม่สร้าง page view ย้อนหลังของหน้าที่เปิดก่อนยินยอม

Consent ของ Analytics ไม่เปลี่ยน Google consent state: `analytics_storage` ของ Google คง denied เสมอเพราะไม่ได้ใช้ GA แยก Google Ads consent ให้ควบคุม `ad_storage`, `ad_user_data`, `ad_personalization` พร้อมกันสำหรับตัวเลือกโฆษณาที่ระบุชัดเจน

## คง GTM สำหรับ Google Ads และแยกระบบสถิติของเราออกมา

คง Conversion/Remarketing ที่ใช้อยู่ ไม่เพิ่ม GA4 และไม่ลดความสามารถ Google Ads ไม่ลบหรือเปลี่ยนแท็กโฆษณาเดิมโดยยังไม่ได้ตรวจ container จริง ส่วนการรอ consent ก่อนโหลด GTM เป็นพฤติกรรมแยกต่างหากตามนโยบายความยินยอมที่ตกลง ไม่ได้หมายถึงการปิด Google Ads

ใช้ Basic Consent Mode: ไม่โหลด GTM/Google tag เมื่อยังไม่ยินยอมหรือปฏิเสธ ไม่ใช้ advanced cookieless measurement เป็นค่าเริ่มต้น ย้าย loader จาก root ไป public-only consent boundary และนำ unconditional noscript iframe ออก เพราะฝั่ง no-JS ไม่สามารถอ่าน localStorage consent ได้

ตั้ง consent defaults ก่อน tag initialization/event ทุกครั้ง ห้ามเก็บ marketing events ไว้ replay หลังยอมรับ เปลี่ยน `pushVillaDetailView`/`pushBookingContactClick` ให้ gate ด้วย ads consent แต่คงชื่อ event และ payload ที่ Google Ads อาจใช้อยู่จนตรวจ container จริง

เมื่อถอน ads consent: หยุด producer ทันที, ส่ง consent update denied ให้ runtime ที่โหลดแล้ว, บันทึกตัวเลือก และ reload เอกสารเพื่อตัด runtime ที่โหลดไปแล้ว การถอนอาจไม่ยกเลิกคำขอที่ส่งออกไปก่อนหน้า; ไม่รับรองว่าแค่ถอด script tag จะหยุด runtime ได้ หลัง reload ต้องไม่มี GTM/Ads request ภายใต้ denied

GTM container readiness ต้องตรวจ destinations, conversion linker, conversion IDs/labels, remarketing, triggers และ consent checks จริง ไม่มี GA4/Analytics destination แอบผูกกับ Google tag และไม่มี trigger ซ้ำต่อ conversion เดียว ไม่เพิ่ม Enhanced Conversions หรือข้อมูลติดต่อเข้า Google โดยอัตโนมัติ ไม่เอา event ทุกชนิดไปตั้งเป็น conversion

ปรับคำอธิบาย GA4 ecommerce ใน admin marketing tags ให้เป็น Google Ads ตามขอบเขตจริง CSP ที่อนุญาต GA domain ไม่ใช่หลักฐานว่ามี GA ทำงาน ไม่ลบ Google domains แบบเหมารวมก่อนตรวจ Ads network

อ้างอิงทางการตรวจ 2026-10-06:
- https://developers.google.com/tag-platform/security/concepts/consent-mode
- https://developers.google.com/tag-platform/security/guides/consent?consentmode=basic
- https://developers.google.com/tag-platform/security/guides/consent-debugging

## กติกา event

| จุด | Event | villa_id |
| --- | --- | --- |
| หน้า public ที่แสดงสำเร็จ | page_view | บ้านปัจจุบันเฉพาะรายละเอียดบ้าน; หน้าอื่น null |
| Booking sidebar tel/LINE/Messenger | contact_click: phone/line/chat | listing.id |
| Header, mobile bottom nav, ContactSection | contact_click: phone/line/chat ตามลิงก์จริง | null |
| Gallery closed -> overview/lightbox | gallery_open | listing.id เสมอ |

ไม่นับ admin, preview, API, health, 404, error และ loading UI Page readiness ต้องเกิดหลัง successful route ไม่พึ่ง pathname ที่ public layout อย่างเดียว Handle refresh, document navigation, client navigation และ BFCache restore ด้วย navigation marker ใน memory กลางหนึ่ง owner Query/hash-only filter changes ไม่เพิ่มยอด และ popstate/pageshow/router ต้องไม่สร้างซ้ำสำหรับ navigation เดียว

โทรบนมือถือ: เปิด sheet ยังไม่นับ; กด tel link จึงนับ Header “จองเลย” ที่เลื่อนไป contact ยังไม่นับ contact click ลิงก์ Facebook Page/email ไม่ถูกนับเป็น Messenger โดยเดาจากชื่อช่องทาง

Gallery overview -> lightbox -> overview เป็นการเปิดชุดเดิม ปิดทั้งหมดแล้วเปิดใหม่จึงเพิ่ม หากคลิกแล้วไม่มี gallery เปิดจริงไม่ส่ง event

สร้าง UUID ครั้งเดียวต่อ interaction ใช้ ID เดิมทุก retry, ไม่เก็บ offline queue fetch keepalive สำหรับ page/gallery; beacon JSON Blob สำหรับ contact และ fallback fetch เฉพาะ beacon คืน false ไม่รอส่งสำเร็จก่อนเปิดปลายทาง Retry fetch สูงสุด 2 ครั้งเฉพาะ network/429/503 ที่ retryable เคารพ Retry-After และ jitter; consent/config disabled ไม่ retry

## Collector และฐานข้อมูล

รับ JSON object เดียวไม่เกิน 16 KiB ตรวจขนาดจริงแบบ bounded read ไม่เชื่อ Content-Length อย่างเดียว Reject unknown fields รวม site_id/occurred_at และข้อมูลผู้ใช้ Validate UUID, event/channel combination, public path ไม่มี query/hash และ canonical villa ID

Origin allowlist exact match; request สาธารณะที่ไม่มี/ผิด Origin ถูกปฏิเสธ นอก development ไม่มี wildcard ส่วน report เป็น server-to-server จึงไม่บังคับ Origin แบบ collector ตรวจ method/content type/rate/schema ก่อน DB

ตารางมี event_id UUID PK, site_id, villa_id nullable, event_name, channel nullable, page_path, occurred_at จาก DB, schema_version=1 พร้อม CHECK constraints และ indexes เวลา/บ้าน+เวลา ไม่เปิด table grants แก่ anon/authenticated

Atomic insert + immutable-payload comparison: ใหม่ 201 stored, ซ้ำเหมือนเดิม 200 duplicate, ID เดิมข้อมูลต่าง 409 EVENT_ID_CONFLICT ไม่ overwrite และไม่เปลี่ยน occurred_at ใช้ privileged private implementation และ public RPC wrapper ที่ grant เฉพาะ server role ที่ต้องใช้ ไม่ reuse admin-user predicate สำหรับ collector ซึ่งรับ public interactions ผ่าน server ที่ตรวจแล้ว

Error envelope `{ error: { code, message }, request_id }`; 400 JSON, 403 origin, 405 method, 413 size, 415 type, 422 schema/query, 429 limit, 503 unavailable Log เฉพาะ request ID/code/status/duration ไม่ raw payload, Authorization, IP, User-Agent, query หรือ stack/SQL ออก public

## Reporting contract

POST `/api/analytics/v1/report`, HTTPS bearer token ของ site ปลายทาง ตรวจ token ก่อน query ไม่ส่ง secret ให้ browser/dashboard และไม่ cache response

`contract_version=1.0`, from_date/to_date inclusive สูงสุด 92 วัน, timezone Asia/Bangkok เท่านั้น, as_of UTC ไม่อนาคตเกิน 5 นาที, to_date ไม่เกินวันของ as_of, villa_id null หรือ canonical ID สร้างช่วง UTC [start,min(next midnight,as_of))

DB รวมใน statement/snapshot เดียว ส่ง totals, unattributed, daily, villas, coverage, query, site_id, contract_version, generated_at ทุกครั้ง จำนวนเต็ม nonnegative JavaScript-safe ทุก metric วันไม่มี event มีศูนย์; villas เรียงคงที่ไม่ซ้ำส่งครบ ไม่ใช้ Data API raw pagination มานับใน Worker

รวมทั่วไปต้องได้ `totals = sum(villas) + unattributed = sum(daily)` ทีละ metric เมื่อกรองบ้าน unattributed เป็นศูนย์ villas ไม่เกิน 1 แถว บ้านไม่มี event ส่งศูนย์และ [] ไม่ใช่ 404 Limit 10,000 villa groups/3 MiB; เกินตอบ 422 REPORT_TOO_LARGE ไม่ตัดแถว

as_of ไม่ใช่ distributed snapshot guarantee ข้าม sites; coverage ไม่รับรองว่าจับผู้ใช้ครบทุกคน

## Retention และ coverage

ใช้ Worker scheduled handler วันละครั้ง 00:15 UTC เรียก restricted Tenant cleanup RPC โดยตรง ไม่มี public HTTP purge endpoint ไม่ใช้ pg_cron เป็น dependency ใหม่ ไม่รวม report token กับสิทธิ์ cleanup

เพิ่ม metadata singleton ต่อ site เก็บ data_available_from และ schema identity ค่าเริ่มต้นบันทึกด้วยเวลา DB เมื่อเรียก initialize ครั้งแรก (health, report หรือ insert ก่อนเขียน event) ไม่ใช้ MIN(occurred_at) และไม่รับวันที่จาก browser เพื่อหลีกเลี่ยงการอ้าง coverage ก่อนเริ่มระบบจริง Cleanup ลบเฉพาะ `occurred_at < now() - interval '180 days'` และ site ที่ตรงกัน มี bounded batches/timeout และ retry idempotent เลื่อน watermark แบบ monotonic ใน transaction ที่เกี่ยวข้องหลัง deletion สำเร็จเท่านั้น Report ใช้ effective watermark ที่ไม่ต่ำกว่า retained-data boundary และไม่ต่ำกว่าวันเริ่มเก็บจริง

เมื่อช่วงรายงานเริ่มก่อน watermark ให้ range_complete=false แม้ daily ที่ไม่มีข้อมูลเป็นศูนย์ ห้ามตีความศูนย์นั้นเป็นช่วงวัดครบ การใช้ retention 180 วันหมายถึงย้อนหลังเก่ากว่านั้นไม่สามารถสร้างใหม่ได้ และ retry event เดิมหลังพ้น retention ไม่รับรอง dedup ข้ามประวัติที่ลบแล้ว

เปิด retention เฉพาะ environment ที่ตรวจ target identity/config แล้ว มี technical log ของเวลา/จำนวนลบ/watermark และ health การรัน ไม่ log event payload ความถี่รายวันหมายถึงข้อมูลอาจรอ cleanup ถัดไปได้ไม่เกินรอบตามปกติ; รายงาน retention job failure เป็น operational issue ไม่อ้าง hard real-time deletion SLA

## Rollout และเกณฑ์ตรวจรับ

1. ทำ migration/patch แบบ additive และทดสอบสิทธิ์/insert/report/cleanup บน DB แยกจาก production
2. deploy staging ที่ config/site_id/token/DB แยกจริง ตรวจ request budget และ consent combinations ทั้ง desktop/mobile
3. ตรวจ GTM container จริงและ privacy copy ก่อนเปิด Ads ภายใต้ gate ใหม่ ไม่ publish container จากขั้นจัดทำแผน
4. ตรวจ config/secrets/identity ของครบห้า Tenant ก่อน deployment ใช้ migration gate เดิมให้ schema พร้อมแล้ว deploy ผ่าน CI matrix เดิม โดย collector/retention เปิดทุก production target ไม่เพิ่ม manual activation รายเว็บ สวิตช์ปิดยังมีไว้กรณี incident
5. บันทึกเวลาที่เริ่มเก็บจริงรายเว็บ เทียบเหตุการณ์กับ DB/report และตรวจ error/429/query latency/จำนวนแถวของทุก domain หลัง deploy CI matrix ไม่ใช่ atomic deployment จึงตรวจผลสำเร็จ/ล้มเหลวแยกราย target และไม่ถือว่า deploy หนึ่งเว็บสำเร็จเท่ากับครบทุกเว็บ
6. rollback ปิด collector/retention ตามเหตุ เก็บ schema และข้อมูล ไม่ drop table

รัน C01-C14 จากเอกสารต้นทาง รวม boundary เวลาไทย, 2,000 บ้านครบ, token isolation, duplicate concurrency และข้อมูลไม่ครบ เพิ่ม consent matrix 4 แบบ, expired/malformed/storage failure/cross-tab, BFCache, gallery transitions, ads withdrawal และไม่มี GA4 requests/destinations

ต้องผ่าน focused Vitest, SQL integration บน staging/local test DB, lint, build และ browser/network inspection production mode ไม่มี unexpected _rsc หรือ /_next/image; จำนวน collector ปกติหนึ่ง request ต่อ eligible event และ retry มีเพดาน ไม่เพิ่ม catalog DB read ต่อคลิก

อัปเดต `docs/ai/structure.html` เมื่อเพิ่ม owners/routes/cache/settings/test guidance และจัด operator runbook ไม่แก้ SQL ออนไลน์หรือ GTM container จนขั้น rollout ที่ได้รับอนุญาต

## สิ่งที่ต้องตรวจจากระบบจริงก่อน production

- Tenant DB/secrets/site identity แยกกันตรง config และ staging ไม่ชี้ production
- Container export หรือการเข้าถึง GTM สำหรับตรวจ tag/destination/trigger; repository อย่างเดียวพิสูจน์ว่าไม่มี GA4 ไม่ได้
- Dashboard ฝั่งผู้เรียกผ่าน validator และ fixtures เดียวกัน (เอกสารฉบับ 02 ยังไม่ได้รับ)
- ข้อความ privacy ใน CMS ที่ใช้งานจริงต้องสะท้อน consent, Google Ads และ retention ใหม่; ไม่ overwrite CMS ออนไลน์จาก fallback ใน repo
- ปริมาณ traffic/ต้นทุนจริงใช้ตั้ง rate limit และ cleanup batch หลัง load test ไม่สมมติจากจำนวนบ้าน
