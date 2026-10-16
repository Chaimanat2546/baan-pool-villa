# แบบ API สถิติช่วงเวลาเดียวกันของทุกวัน — baan-pool-villa

วันที่: 2026-10-16 (Asia/Bangkok)
สถานะ: ลงมือทำและทดสอบ local แล้วตามคำยืนยันผู้ใช้; ยังไม่ commit/PR/deploy หรือใช้ migration บน remote

## เป้าหมายและความหมาย

Webook ต้องเลือกหลายวันและกรองเวลาชุดเดียวกันของทุกวันได้ เช่น 14–16 ต.ค. 09:00–18:00 หมายถึงสามช่วงแยกกัน ไม่รวมกลางคืนระหว่างวัน วันที่รวมวันต้นและวันท้าย เวลาเป็น `[start, end)` ตาม Asia/Bangkok: รวม 09:00 พอดีและไม่รวม 18:00 พอดี

ใช้ timestamp รับ event เข้าฐานข้อมูลเดิม ไม่เพิ่ม tracker, identity, ตาราง event หรือ dependencies เวลาเลือกทีละชั่วโมง เริ่ม 00:00–23:00 สิ้นสุด 01:00–24:00 และเริ่มต้องน้อยกว่าสิ้นสุด ไม่รองรับช่วงข้ามคืน 18:00–09:00

## ทางเลือกและข้อเสนอ

| ทางเลือก | ผลและความเสี่ยง |
| --- | --- |
| Webook เรียก API 1.1 แยกทุกวัน | ไม่ต้องเพิ่ม contract แต่จำนวน request โตตามวันและ tenant เสี่ยง timeout/quota; ไม่เลือก |
| เปลี่ยนความหมาย contract 1.1 | request เดิมยังเหมือนกันแต่ความหมายกว้างขึ้นและ client เก่าอาจตีความผิด; ไม่เลือก |
| เพิ่ม contract 1.2 บน endpoint เดิม | แยกความหมายชัดเจน ใช้ SQL aggregate ครั้งเดียวต่อช่วงและไม่เปลี่ยน 1.0/1.1; แนะนำ |

## สัญญา API ที่เป็นข้อตกลงร่วมกับ Webook

`POST /api/analytics/v1/report` ใช้ guard/token, tenant identity ที่ server เลือก, no-store, timeout และขนาด response สูงสุดเดิม

```json
{
  "contract_version": "1.2",
  "granularity": "day",
  "from_date": "2026-10-14",
  "to_date": "2026-10-16",
  "from_time": "09:00",
  "to_time": "18:00",
  "timezone": "Asia/Bangkok",
  "as_of": "2026-10-16T04:00:00.000Z",
  "villa_id": null
}
```

- 1.2 ยอมรับเฉพาะ fields ข้างต้น; ไม่รับ endpoint/site ID จาก request body
- `from_date <= to_date`; รับวันเดียวได้เพื่อรองรับ chunk สุดท้ายของ Webook แต่ Webook เลือก 1.1 สำหรับรายงานวันเดียวตามปกติ
- จำกัดวันในหนึ่ง request เหมือน validator ปัจจุบัน: ส่วนต่างวันที่ต้องน้อยกว่า 92 วัน; Webook แบ่งครั้งละ 90 วันรวมต้นท้าย
- `as_of` เป็น canonical UTC snapshot เดียวกันของทุก chunk/tenant/ชุดเปรียบเทียบ; คงข้อจำกัดอนาคตและวันที่จริงเดิม
- 1.0 ยังเป็นรายวันเต็มวัน ไม่มี clock fields; 1.1 ยังเป็นรายชั่วโมงวันเดียวและปฏิเสธหลายวันเหมือนเดิม
- Response 1.2 echo query/version/site ที่ตรงกัน พร้อม `generated_at`, `coverage`, `totals`, `unattributed`, `daily`, `villas` รูปเดิม ไม่มี field `hourly`
- `daily` มีหนึ่งแถวต่อวันที่รวมต้นท้ายเรียงวัน แม้จำนวนเป็นศูนย์หรือช่วงเวลาของวันนั้นยังไม่เริ่ม; วันใดที่ as_of ยังไม่ถึง window start ต้องมี metrics ศูนย์ทุกตัว และ Webook ใช้ snapshot แยกข้อมูลอนาคตออกจากศูนย์ที่สังเกตแล้ว
- ทุก metric ต้องมี `sum(daily) = totals = sum(villas) + unattributed`; คงข้อจำกัดจำนวนบ้าน/ขนาด response/จำนวนเต็มปลอดภัยเดิม

## การคำนวณ SQL

เพิ่ม migration ใหม่ `supabase/migrations/20261016010000_add_daily_time_window_analytics.sql` และ patch `supabase/patches/20261016_daily_time_window_analytics.sql` ที่มี DDL เดียวกัน ห้ามแก้ migration 1.1 เดิม

ขยาย `private.analytics_report(jsonb,text)` เดิม โดยรักษา wrapper/grants/search_path/site initialization และคำนวณ filtered base ครั้งเดียว:

1. ใช้ index-friendly timestamp bound ตั้งแต่วันแรกเวลาเริ่ม ถึงวันสุดท้ายเวลาสิ้นสุด ตัดที่ `as_of`
2. เพิ่มเงื่อนไขเวลาไทยของแต่ละ event ต้องอยู่ตั้งแต่ชั่วโมงเริ่มถึงก่อนชั่วโมงสิ้นสุด สำหรับ 1.2 เท่านั้น ห้ามใช้ bound ข้อแรกอย่างเดียวเพราะจะรวมกลางคืนของวันกลาง
3. `24:00` ใช้ชั่วโมงสิ้นสุดเลข 24 และ timestamp เที่ยงคืนวันถัดไป ไม่ parse PostgreSQL/JavaScript time ที่ wrap กลับเป็น 00:00
4. totals/daily/villas/unattributed ทุกชุดอ่าน base เดียวกัน ไม่กรองซ้ำต่างสูตร; หนึ่งวันไม่ถูกนับซ้ำเมื่อแบ่ง chunk
5. `coverage.range_complete` เปรียบเทียบเวลาเริ่มของช่วงที่เลือกในวันแรกกับ retention watermark แบบ microsecond เดิม; coverage ไม่ได้หมายความว่าช่วงวันนี้จบแล้ว

ตัวอย่าง snapshot วันที่ 16 ต.ค. เวลา 11:30: รายงาน 14–16 ต.ค. 09:00–18:00 รวมวันที่ 14/15 ครบช่วง และวันที่ 16 เฉพาะ 09:00–11:30 ส่วนที่เหลือยังไม่เกิด; snapshot 08:30 ของวันที่ 16 ให้ยอดวันนั้นเป็นศูนย์และ consumer แสดงช่องว่างก่อนช่วงเริ่ม

## ขอบเขตไฟล์และความปลอดภัย

- `lib/analytics/types.ts`: เพิ่ม `AnalyticsDailyWindowReportQuery` ลง union
- `lib/analytics/validation.ts`: ตรวจ 1.2 พร้อม start/end envelope; predicate รายวันอยู่ใน SQL ด้วย ไม่พึ่ง TypeScript อย่างเดียว
- `lib/analytics/routes.ts`, `server.ts`, `worker-analytics-access.js`: ใช้ boundary เดิม ตรวจ regression; ไม่เปลี่ยน health 1.0 ให้ประกาศ 1.2 โดยไม่พิสูจน์ capability
- migration/patch ใหม่: tenant DB เท่านั้น ไม่มี catalog schema/RLS/collector change
- `docs/analytics/operations.md`, `docs/ai/structure.html`: เพิ่ม contract, เจ้าของ schema, คำสั่งทดสอบและลำดับ rollout

## Acceptance และ rollout

ทดสอบ validator/route และ PostgreSQL จริงในฐานข้อมูลทิ้งได้ ครอบคลุมขอบ 08:59:59.999999/09:00/17:59:59.999999/18:00 ทั้งวันแรก วันกลาง วันท้าย, 23:00–24:00, snapshot, retention, villa filter, identity/roles, replay migration และ contract เก่า

Producer implementation และ migration ต้องพร้อมทุก tenant ที่ Webook allowlist ก่อนเปิดใช้ consumer 1.2 ไม่ใช้ health 1.0 เป็นหลักฐานความพร้อม ให้ยิง 1.2 read-only โดยใช้ as_of ปัจจุบันและวันที่ไม่เกินวันของ snapshot เพื่อตรวจ query echo และ sum invariants จริงทุก tenant

งานปัจจุบันจัดทำเอกสารเท่านั้น การ merge/deploy และ apply migration ออนไลน์เป็นขั้นตอนภายหลัง ต้องได้รับอนุญาตตามกฎแต่ละโปรเจกต์ และยืนยันเป้าหมาย Production ก่อนดำเนินการ

แผนของโปรเจกต์นี้: [implementation plan](../plans/2026-10-16-daily-time-window-analytics.md)
เอกสาร Webook คู่กัน: `docs/superpowers/specs/2026-10-16-daily-time-window-analytics-design.md` ใน repository Webook
