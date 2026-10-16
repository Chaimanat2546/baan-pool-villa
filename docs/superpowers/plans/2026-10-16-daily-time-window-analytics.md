# Daily Time Window Analytics — Producer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in this chat. Steps use checkbox (`- [ ]`) syntax for tracking. ใช้ subagent-driven-development เฉพาะเมื่อผู้ใช้เลือกวิธีนั้น

**Goal:** เพิ่ม API contract 1.2 สำหรับกรองช่วงเวลาเดียวกันของทุกวันและส่งยอดรายวันที่ตรงกับยอดรวม

**Architecture:** ขยาย authenticated report route และ private SQL RPC เดิม เพิ่ม query union แยกจาก 1.0/1.1 ใช้ filtered base ร่วมกันทุก aggregation และ rollout producer ก่อน consumer

**Tech Stack:** TypeScript, Next.js, Supabase PostgreSQL, Cloudflare/OpenNext, Vitest และ local Docker PostgreSQL ที่มีอยู่

**Spec:** [Producer design](../specs/2026-10-16-daily-time-window-analytics-design.md)

## Global Constraints

- เวลา `Asia/Bangkok`; `[start, end)`; เริ่ม 00:00–23:00 สิ้นสุด 01:00–24:00; ไม่รองรับข้ามคืน
- 1.2 ใช้ granularity=day และใช้ clocks ซ้ำทุกวัน; ยอมรับวันเดียวใน chunk; ส่วนต่างวันที่ <92 วันต่อ request
- 1.0/1.1 และ guard/identity/roles/limits เดิมต้องไม่เปลี่ยนความหมาย
- ไม่เพิ่ม dependencies, tracker, identity หรือตาราง event; เพิ่ม migration และ patch ใหม่ ห้ามแก้ migration เดิม
- ไม่ deploy/apply migration ออนไลน์/commit/push อัตโนมัติจากการอนุมัติเอกสารครั้งนี้

## Review Focus

1. Event นอกเวลาในวันกลางถูกตัดจริง ไม่ใช่แค่ตัดวันแรก/วันท้าย — Task 2
2. End=24:00 ไม่ wrap เป็น 00:00; ขอบเวลาแบบ microsecond ไม่รั่ว — Task 1/2
3. Snapshot ก่อนเริ่ม/ระหว่าง/หลังสิ้นสุดและ retention ในวันเดียวกันไม่ทำให้ totals ผิด — Task 2
4. Client เก่าและ direct RPC ที่ส่งข้อมูลผิดยังถูกตรวจเหมือนเดิม — Task 1/2
5. Tenant ที่ยังไม่อัปเกรดไม่ถูก health 1.0 บอกว่ารองรับ 1.2 — Task 3

## Task 1: Query contract และ HTTP validation

**Files:** Modify `lib/analytics/types.ts`, `lib/analytics/validation.ts`, `lib/analytics/__tests__/routes.test.ts`; Create `lib/analytics/__tests__/daily-time-window-validation.test.ts`; inspect `lib/analytics/routes.ts`, `server.ts`

**Interfaces:** เพิ่ม `AnalyticsDailyWindowReportQuery extends AnalyticsReportFields` ที่มี contract_version="1.2", granularity="day", from_time/to_time:string ใน `AnalyticsReportQuery`; `validateReportQuery(value:unknown, now?:Date)` คง return `{query,start,end}` โดย start/end เป็น bounding envelope ไม่ได้แทน predicate ทุกวัน

- [ ] เขียน failing test: 14–16 ต.ค. 09:00–18:00, snapshot และ now ของ unit test=`2026-10-17T00:00:00.000Z` ต้องได้ start=`2026-10-14T02:00:00.000Z`, end=`2026-10-16T11:00:00.000Z`, echo query ไม่เปลี่ยน
- [ ] เพิ่ม tests วันเดียว 1.2, end24, 92 inclusive days ผ่าน/93 วันไม่ผ่าน, เริ่ม=สิ้นสุด/ย้อนกลับ/09:30/clock ขาด/extra site_id/granularity=hour/as_of ผิดต้อง reject; HTTP 1.2 ผ่านไป storage โดย guard เดิม และ unauthorized ยังไม่เรียก storage
- [ ] Run `npm.cmd test -- lib/analytics/__tests__/daily-time-window-validation.test.ts lib/analytics/__tests__/routes.test.ts`; ยืนยันเคส valid 1.2 FAIL ก่อน implementation
- [ ] เพิ่ม union/validation ตาม spec โดยตรวจค่า typeof ก่อนเทียบเวลา; ไม่เปลี่ยนขอบ 1.0/1.1 และไม่แก้ collector
- [ ] Run `npm.cmd test -- lib/analytics`; ต้องผ่านทั้งเก่าและใหม่ รวม 1.1 ที่ยัง reject หลายวัน
- [ ] หลังผู้ใช้อนุมัติให้ commit implementation ให้ commit task นี้เป็น `feat: validate daily time window reports`

## Task 2: SQL aggregation และ regression ฐานข้อมูลจริง

**Files:** Create `supabase/migrations/20261016010000_add_daily_time_window_analytics.sql`, `supabase/patches/20261016_daily_time_window_analytics.sql`, `scripts/daily-time-window-site-analytics-test.sql`, `scripts/test-daily-time-window-site-analytics-db.mjs`; reuse `scripts/hourly-site-analytics-test.sql`, `scripts/legacy-site-analytics-test.sql`

**Interfaces:** `public.analytics_report(p_query jsonb,p_site_id text)` และ `private.analytics_report` signature เดิม; 1.2 response คือ query/version/site echo + totals/unattributed/daily/villas/coverage เดิม ไม่มี hourly

- [ ] เขียน SQL fixture 12–14 ต.ค. (วันในอดีต ใช้ snapshot `2026-10-15T00:00:00.000Z` เพื่อไม่ติดข้อห้าม as_of อนาคตของฐานข้อมูลจริง) ใส่ page_view ที่ 08:59:59.999999, 09:00, 17:59:59.999999 และ 18:00 ทุกวัน (เวลาไทย); q1.2 09–18 snapshot หลังจบต้องได้ daily `[2,2,2]`, totals=6 และ sum(villas)+unattributed=6
- [ ] เพิ่ม SQL assertions: 23–24, ทั้งห้า event metrics/channel, villa filter, snapshot 14 ต.ค. 08:30/11:30/18:00, retention 12 ต.ค. 08:59:59.999999/09:00:00.000001, query fields ผิด/direct RPC, tenant identity และ grants
- [ ] เพิ่ม runner ตามรูป `test-hourly-site-analytics-db.mjs`: create DB ชื่อ process-owned ใน local container ที่ระบุ, โหลด base+1.1+1.2+1.2 ซ้ำ, assert migration=patch, รัน SQL ใหม่+hourly+legacy, finally drop เฉพาะ DB ที่สร้าง ห้ามอ่าน .env
- [ ] Run `node scripts/test-daily-time-window-site-analytics-db.mjs <local-supabase_db_container>`; ยืนยัน FAIL เพราะยังไม่รองรับ 1.2
- [ ] เพิ่ม migration/patch ให้ byte-equivalent หลัง normalize newline; predicate SQL ใช้ timestamp envelope และชั่วโมงเวลาไทยราย event สำหรับ 1.2; aggregates ทุกชุดใช้ materialized base เดียว คง DDL boundary/roles/ขนาดเดิม
- [ ] Run runner ซ้ำ; ต้อง PASS ใหม่/legacy/hourly/replay/role isolation และไม่มี disposable DB เหลือ
- [ ] หลังอนุมัติ commit implementation ให้ commit เป็น `feat: aggregate recurring daily time windows`

## Task 3: เอกสารและ producer readiness gate

**Files:** Modify `docs/analytics/operations.md`, `docs/ai/structure.html`; inspect workflow/migration rollout ที่ใช้อยู่ก่อนเสนอ deploy

**Interfaces:** Consumer Webook ใช้ contract 1.2 ตาม spec ร่วม; health.contract_version="1.0" เดิมไม่ใช่ readiness proof

- [ ] อัปเดต request example, recurring-vs-continuous semantics, SQL/test ownership, migration/patch, unsupported 422 และลำดับ rollout โดยไม่บันทึก credentials
- [ ] Run `npm.cmd test`, `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `npm.cmd run build` และ local SQL runner; ทุก command ต้อง exit0 พร้อมสรุป warning เดิมแยกจาก error
- [ ] Review query guard/SQL duplicate semantics/retention/legacy; ไม่มี blocker ก่อนส่งต่อ Webook integration
- [ ] เตรียม read-only acceptance query 1.2 (ตัวอย่างใน spec) และตรวจ echoed version/query, daily row count, sum invariants ต่อ tenant หลังได้รับสิทธิ์ deploy; อย่าใช้ health อย่างเดียว
- [ ] เมื่อต้อง rollout ในอนาคต ระบุ Supabase/Cloudflare targets จริงทุก tenant และขออนุญาต Production ตามกฎก่อน merge/deploy/apply migration; ยืนยัน API ทุก tenant พร้อมแล้วจึงอนุญาต Webook rollout

## Handoff และลำดับที่แนะนำ

ทำ Task 1 → 2 → Webook contract/integration tasks → full review/local checks ของทั้งสองโปรเจกต์ → ส่งผลตรวจให้ผู้ใช้ตัดสินใจ commit/PR/deploy Producer ก่อน Webook การเขียนแผนไม่ได้ยืนยันว่าฐานข้อมูลหรือ API ออนไลน์รองรับแล้ว

## Execution result — 2026-10-16

Implementation and local verification completed. Checkboxes above retain the original detailed execution recipe; commit, PR and deployment steps remain deferred. See Webook docs/superpowers/reports/2026-10-16-daily-time-window-analytics.md for exact check results, browser scope and rollout dependency.
