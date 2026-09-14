# Site Settings: รายการปรับปรุงในอนาคต

**สถานะ:** มีรายการปรับปรุง  
**Audit ล่าสุด:** 2026-09-07  
**ขอบเขต:** Site identity, theme, hero, assets, SEO compatibility, TikTok, marketing tags และ admin settings sections

เอกสารนี้บันทึกผล audit เพื่อใช้ปรับโครงสร้างภายหลัง โดยยังไม่เปลี่ยนพฤติกรรม, API หรือฐานข้อมูลในตอนนี้

## Data flow ปัจจุบัน

```text
Admin settings UI
  -> components/admin/settings/
  -> /api/admin/site-settings/:section
  -> lib/site-settings/

Specialized setting domains
  -> lib/site-contact-settings/
  -> lib/site-seo-settings/
  -> lib/site-web-styles/
  -> lib/site-header-settings/

Public consumers
  -> public layout, metadata, theme variables, home and villa detail pages
```

## สิ่งที่ทำได้ดีอยู่แล้ว

- Admin UI แยกตาม section เช่น brand, theme, hero, SEO และ contact.
- Section API มี allowlist, field ownership และป้องกัน payload ข้าม section.
- Contact ใช้ endpoint และ data contract แยก.
- Upload มี validation, conversion, rollback, retention cleanup และ structured errors.
- มี shared hook สำหรับ load/save/dirty state ของ section.
- Server validation ครอบคลุม URL, สี, SEO, image metadata, TikTok และ GTM.
- มี cache/revalidation และ schema fallback ระหว่าง migration.
- Targeted test ที่ตรวจใน audit ผ่าน 33 files และ 230 tests.

## สิ่งที่ควรปรับปรุง

### 1. แยก validation ตาม domain

`lib/site-settings/validation.ts` รวม brand, theme, hero, SEO, TikTok, GTM, upload และ retention ไว้ในไฟล์เดียว

ควรแยกเป็น module เช่น:

```text
lib/site-settings/
  brand-validation.ts
  theme-validation.ts
  hero-validation.ts
  seo-validation.ts
  asset-validation.ts
```

คง facade export กลางเท่าที่มีผู้ใช้หลายจุด เพื่อไม่ให้ import surface กระจัดกระจายโดยไม่จำเป็น.

### 2. แยก section contracts ตามหน้าที่

`admin-section-contracts.ts` รวม section definitions, database projection, field ownership, multipart parsing, upload ownership, response mapping และ payload building

ควรแยกเป็น:

```text
lib/site-settings/
  section-definitions.ts
  section-request.ts
  section-response.ts
  section-persistence.ts
```

### 3. ทำ ownership map ของ settings

ชื่อ module หลายส่วนใกล้กัน: site settings, contact settings, SEO settings, web styles และ header settings

ควรมีตารางระบุว่า setting แต่ละตัวมี:

- owner module
- table/column หรือ canonical data source
- admin API และ admin UI
- public consumers
- cache tag
- test files

เพื่อให้เพิ่ม setting ใหม่ได้ถูกเจ้าของตั้งแต่ต้น.

### 4. ทำ compatibility ledger

มี schema/column fallback เพื่อให้การ deploy migration ปลอดภัย แต่ fallback ที่ค้างอยู่นานอาจทำให้การอ่าน/เขียนซับซ้อนขึ้น

ควรบันทึก fallback แต่ละรายการพร้อม:

- migration ที่เกี่ยวข้อง
- เหตุผลที่ยังต้องรองรับ
- หลักฐาน production verification ที่ต้องมี
- เงื่อนไขและขั้นตอนสำหรับลบ fallback

### 5. ระบุ boundary ของ asset pipeline

Site Settings ใช้ asset upload pipeline ของตัวเอง ขณะเดียวกันการแปลงรูปเป็น helper กลาง

ควรบันทึกชัดเจนว่า:

- `lib/image-conversion.ts` เป็น generic conversion owner
- `lib/site-settings/admin-asset-uploads.ts` เป็น settings persistence/history/retention owner
- feature อื่นต้องไม่ reuse settings persistence logic โดยตรง

### 6. เพิ่ม end-to-end settings flows

แม้ unit/API tests ครอบคลุมมากแล้ว ควรเพิ่ม flow ข้ามชั้น:

- แก้ Brand/Theme/Hero/SEO
- save สำเร็จ
- cache revalidation
- public layout/page เห็นค่าที่อัปเดต
- asset save ล้มเหลวและ rollback ถูกต้อง

### 7. ทำ checklist สำหรับเพิ่ม setting ใหม่

เพิ่ม checklist ที่ใช้ก่อนเริ่มเปลี่ยน setting:

- Type และ production-safe default
- Validation/normalization
- Schema หรือ migration
- API contract
- Admin UI
- Public consumer
- Cache/revalidation
- Tests
- Compatibility lifecycle หากเป็น migration

## สิ่งที่ไม่อยู่ในขอบเขตของเอกสารนี้

- การรวม contact, SEO หรือ web styles กลับเข้า `lib/site-settings`.
- การเปลี่ยน schema/API/cache policy ทันที.
- การลบ fallback ก่อนมี production verification ตาม migration ที่เกี่ยวข้อง.

## หลักเกณฑ์ก่อนเริ่มปรับในอนาคต

- รักษา owner และ data contract ของ setting เดิมระหว่าง refactor.
- เพิ่ม/ปรับ tests ก่อนย้าย validation หรือ persistence.
- ตรวจ admin/public UI, cache/revalidation, lint และ build ก่อนสรุปงาน.
