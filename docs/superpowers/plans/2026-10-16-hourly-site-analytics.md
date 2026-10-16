# Hourly Site Analytics Producer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. ใช้ inline execution เป็นแนวทางที่แนะนำ; ถ้าผู้ใช้เลือก delegation ค่อยใช้ superpowers:subagent-driven-development

**Goal:** เพิ่มรายงานรายชั่วโมงที่กรองช่วงเวลาไทยได้ โดย API รายวันและ collector เดิมยังทำงาน

**Architecture:** ขยาย report endpoint และ private SQL RPC เดิมด้วย contract 1.1 สำหรับวันเดียว ใช้ event timestamp/index และ privileged boundary เดิม Aggregate ที่ tenant database แล้วส่งเฉพาะยอดรวมให้ Webook

**Tech Stack:** Next.js 16.3.0, TypeScript, Supabase PostgreSQL, Cloudflare/OpenNext, Vitest, isolated PGlite

**Spec:** [แบบกลางสองโปรเจกต์](../../../../webook/docs/superpowers/specs/2026-10-16-hourly-website-analytics-design.md)

## Global Constraints

- เวลา `Asia/Bangkok`; `[start, end)`; เลือกทีละชั่วโมง ค่าเริ่มต้น `00:00`–`24:00`
- `1.0` คง fields/ผลลัพธ์เดิม; `1.1` ต้องมี granularity=hour, from_time/to_time และ from_date=to_date
- ไม่เพิ่ม dependencies, tracker, visitor/session ID, ตาราง event ใหม่ หรือการเก็บข้อมูลส่วนบุคคล
- ห้ามแก้ migration เดิม; ใช้ migration ใหม่และ idempotent patch ที่มี DDL เดียวกัน
- รายงานใช้ tenant DB เท่านั้น ไม่ใช้ shared catalog หรือ DB ของ Webook; คง authorization/no-store/quota/body size/timeout เดิม
- ไม่ commit/push/deploy จนผู้ใช้สั่ง การ merge master มี production migration/deploy workflow จึงต้องได้รับอนุญาต Production ก่อน
- การมี spec/plan หรือ SQL ใน source ไม่ยืนยันว่า online database ถูกเปลี่ยนแล้ว

## Review Focus

1. ชั่วโมงสุดท้ายและ 24:00 ต้องไม่รวม event ของวันถัดไป — Task 1/2
2. as_of ตรงต้นชั่วโมงหรือก่อนช่วงที่เลือกต้องไม่สร้างอนาคตเป็นศูนย์ที่สังเกตแล้ว — Task 2
3. ต้นทางอัปเดต SQL/Worker ไม่พร้อมกันต้องไม่ทำลายรายงาน 1.0 — Task 2/3
4. เรียก RPC โดยตรงต้องผ่าน validation/tenant/role boundary เช่นเดียวกับ HTTP — Task 2
5. coverage เริ่มกลางชั่วโมงและการ replay patch ต้องไม่เพิ่มสิทธิ์หรือแก้ข้อมูล event — Task 2

## ก่อนเริ่ม

- [ ] อ่าน spec กลางและ AGENTS.md; ตรวจ `git status --short`, branch และ worktree ของ repo นี้ ไม่แตะงานที่มีอยู่
- [ ] อ่าน `docs/ai/structure.html#site-analytics`, `docs/analytics/operations.md` และ Next guides ใน `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` และ `05-server-and-client-components.md` ก่อนเปลี่ยนโค้ด Next
- [ ] ใช้ branch/worktree ของ repo นี้ตาม workflow ที่ผู้ใช้เลือก แยกจาก branch Webook
- [ ] ตรวจ local SQL test runtime ตาม import ใน `scripts/test-site-analytics-db.mjs`; ตอนเขียนแผน `.superpowers/analytics-test-runtime/node_modules/@electric-sql/pglite` ไม่มีอยู่ ห้ามข้าม SQL tests หรือเอา Production มาแทน หากยังขาด ให้ขออนุมัติการติดตั้ง isolated runtime ตามเอกสารเดิม โดยไม่แก้ package.json/lockfile ของแอป

## File Ownership

| Files | หน้าที่ |
|---|---|
| `lib/analytics/types.ts`, `validation.ts` | union request 1.0/1.1, strict validation, UTC bounds |
| `lib/analytics/routes.ts`, `server.ts` | ส่ง typed query ไป RPC ผ่าน guard เดิม |
| migration/patch ใหม่ | hourly filtering/aggregation, คง grants และ report 1.0 |
| `lib/analytics/__tests__/*`, SQL runner | contract/route/DB regression |
| `docs/analytics/operations.md`, `docs/ai/structure.html` | contract, ownership และ rollout จริง |

## Task 1: Request 1.1 และช่วงเวลาไทย

**Files:** Modify `lib/analytics/types.ts`, `lib/analytics/validation.ts`; Test `lib/analytics/__tests__/validation.test.ts`

**Interfaces:**
- `AnalyticsReportQuery = AnalyticsDailyReportQuery | AnalyticsHourlyReportQuery` ใช้ interfaces สำหรับแต่ละ object; daily มี shape เดิม ส่วน hourly มี contract_version: "1.1", granularity: "hour", from_time/to_time: string และ fields ร่วมเดิม
- คง `validateReportQuery(value: unknown, now?: Date): { query: AnalyticsReportQuery; start: string; end: string }`; start คือ requestedStart, end คือ min(requestedEnd, as_of) ที่อาจ <= start สำหรับอนาคต ไม่ throw เพียงเพราะเวลาภายในวันนี้ยังมาไม่ถึง
- Unknown version => UNSUPPORTED_CONTRACT; keys ผิด/ขาด => INVALID_QUERY; date/time/as_of ผิด => INVALID_RANGE

- [ ] เพิ่ม failing tests ชื่อ `maps an hourly Thai range to half-open UTC bounds`, `accepts 24:00 only as end`, `rejects malformed hourly queries without weakening v1.0` โดยตั้ง date=2026-10-15, snapshot=2026-10-16T04:00:00.000Z:
  - 09:00–18:00 => start `2026-10-15T02:00:00.000Z`, end `2026-10-15T11:00:00.000Z`
  - 23:00–24:00 => start `2026-10-15T16:00:00.000Z`, end `2026-10-15T17:00:00.000Z`
  - ปฏิเสธ 24:00 เป็น start, 09:30, 9:00, 24:01, 18:00–09:00, เวลาเท่ากัน, to_date คนละวัน, วัน rollover, เวลา field ขาด, extra site_id และ 1.0 ที่แนบเวลา
  - Request 1.0 เดิมและ UNKNOWN version เดิมยังให้ผลเดิม; as_of กลางชั่วโมง 1.1 ยังรับและคืน clamped end
- [ ] Run `npm.cmd test -- lib/analytics/__tests__/validation.test.ts`; ยืนยัน fail ใน cases ที่เพิ่มก่อนแก้ implementation
- [ ] Implement union และ branching validator โดยใช้ date/villa/as_of checks เดิม เพิ่ม strict field list ตาม version และ helper ชั่วโมงที่ไม่รับ minute แฝง ไม่ใช้ browser/server local timezone
- [ ] Run test เดิมอีกครั้ง; ต้องผ่านทั้งหมดและตรวจ diff ไม่มีการผ่อน validation event

## Task 2: SQL aggregation และ migration/patch ที่ replay ได้

**Files:** Create `supabase/migrations/20261016000000_add_hourly_site_analytics.sql`, `supabase/patches/20261016_hourly_site_analytics.sql`; Modify/Test `scripts/test-site-analytics-db.mjs`

**Interfaces:**
- คง `private.analytics_report(p_query jsonb,p_site_id text) returns jsonb` และ public wrapper เดิม
- Response 1.0 unchanged; 1.1 เพิ่ม `hourly: { start,end,page_views,phone_clicks,chat_clicks,line_clicks,gallery_opens }[]` ตาม spec ไม่มี contact_clicks ใน upstream
- ทุก aggregate มาจาก base เดียวกันที่กรอง site/villa/requestedStart/effectiveEnd; daily 1 row และ totals ใน 1.1 เป็นยอดช่วงเวลาที่เลือก

- [ ] เพิ่ม failing SQL cases ใน runner ก่อน legacy fixtures และครอบ fixture transaction ด้วย rollback เพื่อไม่ทำให้ counts ของเดิมเปลี่ยน:
  - `hourly excludes both outside boundaries`: fixtures ที่ 08:59:59.999, 09:00, 09:59:59.999, 10:00, 17:59:59.999, 18:00 ไทย; 09–18 นับ 4 events, hourly ยาว 9, bucket แรกนับ 2, bucket สุดท้ายนับ 1
  - `24:00 excludes next-day events`: 23:59:59.999 รวม, วันถัดไป 00:00 ไม่รวม
  - `snapshot clips current hour`: วันนี้ 09–18, as_of 10:30 ไทย มี 2 rows, row 10–11 นับถึง 10:30 ไม่รวม event ที่ as_of พอดี; as_of 10:00 มีแค่ 09–10; as_of <=09:00 มี [] และ totals=0
  - `hourly coverage is time-based`: watermark 09:30, start09:00 => range_complete=false, start10:00=>true
  - ทุก metric: sum(hourly)=sum(daily)=totals และ sum(villas)+unattributed=totals; ทดสอบ villain filter และ event ของอีก site ไม่ถูกรวม
  - direct RPC ปฏิเสธเวลา invalid/version/keys ผิด; anon/authenticated เรียกไม่ได้; service_role รายงานได้แต่ SELECT raw events ไม่ได้
  - 1.0 fixture เดิมยังได้รูปแบบ/ยอดเดิม ไม่มี hourly; existing 2,000 villas/10,001 rejection/retention ยังผ่าน
- [ ] Run `node scripts/test-site-analytics-db.mjs`; ต้องเห็น contract 1.1 failure บน SQL เก่าก่อนเขียน migration (หลังเตรียม isolated runtime แล้วเท่านั้น)
- [ ] Implement migration ใหม่และ patch ด้วย CREATE OR REPLACE โดยคง security definer/search_path/owner/public invoker grants; SQL ตรวจ query ไม่พึ่งเพียง TS; ใช้ clock bounds แยกจาก series และ max 24 buckets
- [ ] ให้ runner apply base migration ตามเดิม จากนั้น migration ใหม่ 2 ครั้งและ patch 2 ครั้งก่อน tests; assert migration/patch bytes หลัง normalize LF เท่ากัน และ replay ไม่เพิ่มข้อมูล/สิทธิ์ ไม่เปลี่ยน insert/cleanup
- [ ] Run SQL runner; ต้อง PASS ทั้ง hourly + legacy และ inspect SQL ว่าไม่มี DDL กับ catalog, destructive drop หรือการขยายสิทธิ์ raw events

## Task 3: Route integration, docs และ local verification

**Files:** Modify `lib/analytics/__tests__/routes.test.ts`, `docs/analytics/operations.md`, `docs/ai/structure.html`; Update `lib/analytics/routes.ts`/`server.ts` เฉพาะ type narrowing/error boundary ที่จำเป็น

**Interfaces:** `handleAnalyticsRequest(request: Request): Promise<Response>` เรียก `getAnalyticsReport(query: AnalyticsReportQuery): Promise<unknown>` เดิม; guard ก่อน storage, server config เป็น owner ของ site ID

- [ ] เพิ่ม route tests `forwards a validated hourly query under report authorization`, `rejects invalid hourly input before storage`, `keeps hourly responses private and bounded`: query ไป storage ตรง 1.1, auth denial ไม่มี storage calls, invalid=>422, quota=>429, failure/oversize ไม่เผย SQL/token; 1.0 report และ health คงเดิม
- [ ] Run `npm.cmd test -- lib/analytics/__tests__/routes.test.ts`; ตรวจ fail สำหรับพฤติกรรมใหม่ก่อนแก้ route หากจำเป็น ไม่เปลี่ยน Worker guard เพื่อเพิ่ม route ใหม่
- [ ] ทำ route/types wiring ให้ tests ผ่าน โดยไม่แก้ collector client หรือ Google tracking
- [ ] Update operations และ structure section site-analytics: อ้าง spec กลาง/contract1.1, time filtering, migration owner, fixtures, deploy order และข้อจำกัด timestamp เป็น server ingestion time แยกจาก historical notes เดิม
- [ ] Run `npm.cmd test -- lib/analytics worker-analytics-access.test.ts worker-analytics-retention.test.ts scripts/production-deploy-workflow.test.ts`, SQL runner, `npm.cmd test`, `npm.cmd run lint`, `npx.cmd tsc --noEmit --pretty false`, `npm.cmd run build`, `git diff --check`; บันทึกผลจริงทุกคำสั่ง ห้ามกล่าวว่าผ่านจากแผน
- [ ] Review diff เทียบ spec รวม query 1.0 unchanged, 1.1 unauthorized, UTC/Thai boundaries, 24h maximum และ migration manifest มีไฟล์ใหม่ (`node scripts/production-deploy-config.mjs tenant-migrations` เป็น read-only)
- [ ] หากผู้ใช้สั่ง commit ให้ commit เฉพาะไฟล์ของ feature นี้พร้อมผลตรวจ; มิฉะนั้นคงเป็น working diff ที่พร้อม review

## Release Handoff (ไม่ใช่คำสั่ง deploy ในรอบจัดทำแผน)

- [ ] Local producer report 1.0/1.1 + SQL verification ผ่านก่อนเริ่ม consumer integration
- [ ] เมื่อได้รับงาน deploy ให้ตรวจ target producer Staging จาก config จริงก่อน apply migration/deploy/report probes; ห้ามใช้ Webook Supabase project เป็น tenant แทน
- [ ] ทดสอบ bounded integration ผ่าน Webook allowlisted server adapter และ fixture/ต้นทาง Staging ที่ยืนยันแล้ว อย่าส่ง token ไป browser/URL/log
- [ ] Production rollout ต้องอนุมัติเป็นงานใหม่รวม exact targets; migration gate และ CI deploy matrix ทำครบห้า tenants ไม่ถือเว็บเดียวสำเร็จเท่ากับครบ
- [ ] Rollback app เป็น 1.0 ได้ โดยคง SQL additive และ raw events เดิม

## สถานะการวางแผน

ผู้ใช้เลือก inline execution และทำ local implementation/verification แล้ว: Vitest 2425 ผ่าน, ESLint/tsc/Next build ผ่าน, disposable Docker SQL/HTTP integration ผ่าน ดู docs/superpowers/hourly-progress.md และ verification report ของ consumer ใน worktree ที่ระบุใน ledger ไม่มี commit/push/online migration/deploy หรือการติดตั้ง dependency
