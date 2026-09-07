# Home Sections: รายการปรับปรุงในอนาคต

**สถานะ:** มีรายการปรับปรุง  
**Audit ล่าสุด:** 2026-09-07  
**ขอบเขต:** Homepage mixed layout, villa rails, fixed sections, admin section editor, initial/deferred render plan และ cache lifecycle

เอกสารนี้บันทึกผล audit เพื่อใช้ปรับโครงสร้างภายหลัง โดยยังไม่เปลี่ยนพฤติกรรม, API หรือฐานข้อมูลในตอนนี้

## Data flow ปัจจุบัน

```text
Admin editor
  -> components/admin/sections/
  -> /api/admin/home-sections
  -> lib/home-sections/

Public homepage
  -> components/villas/home/
  -> /api/home-sections + /api/home-deferred
  -> lib/home-sections/
```

## สิ่งที่ทำได้ดีอยู่แล้ว

- บันทึก layout และ rail snapshot แบบ atomic ผ่าน RPC.
- Validation ครอบคลุม fixed sections, rail identity, slug, CTA URL, manual IDs และลำดับ.
- Public renderer รองรับ layout แบบ mixed ระหว่าง rail และ fixed sections.
- แยก critical first rail ออกจาก deferred content เพื่อลดโหลดหน้าแรก.
- มี rate limit และ public response จำกัดข้อมูล.
- Targeted test ที่ตรวจใน audit ผ่าน 27 files และ 165 tests.

## สิ่งที่ควรปรับปรุง

### 1. แยก controller ของ admin editor

`admin-sections-page.tsx` รวม state, auth, fetch, save, drag/drop, manual preview/search, delete, validation และ error focus

ควรแยกเป็น:

```text
components/admin/sections/
  use-home-sections-editor.ts
  home-layout-editor.tsx
  section-editor-panel.tsx
  manual-house-selection.tsx
  home-section-save-flow.ts
```

### 2. สร้าง snapshot contract กลาง

Layout และ rails มีความสัมพันธ์กัน แต่ validation กระจายระหว่าง `layout.ts`, `validation.ts`, admin route และ admin draft helpers

ควรมี canonical parser/normalizer เช่น `HomeSectionsSnapshot` ที่ public read, admin GET/PUT และ editor ใช้ร่วมกัน.

### 3. ป้องกัน concurrent admin edits

API บันทึก snapshot ทั้งก้อน และใน audit นี้ไม่พบ revision token ใน client contract

ควรเพิ่ม `revision` หรือ `updated_at` ใน snapshot แล้วปฏิเสธ stale save พร้อมให้ UI reload/merge เพื่อป้องกันแอดมินคนหลังเขียนทับการแก้ของคนแรก.

### 4. ทำ initial/deferred render plan เป็น DTO ชัดเจน

หน้าแรกมีทั้ง critical initial content และ deferred content ซึ่งเป็นกติกาสำคัญต่อ performance แต่ตามจากชื่อไฟล์ลำบาก

ควรมี type เช่น:

```text
HomeInitialRenderPlan
HomeDeferredRenderPlan
```

พร้อม owner และ tests ที่ชัดเจน.

### 5. ทำ ownership map ของ section keys

`lib/home-sections` เป็น CMS config ขณะที่ `components/villas/home` render TikTok, guide, review image, hero และ rail

ควรมี map ระบุทุก section key พร้อม:

- data owner
- UI owner
- settings/CMS owner
- public consumer
- cache/revalidation owner

### 6. ทำ revalidation map

Save หนึ่งครั้งกระทบ Next data cache, Cloudflare HTML cache version และ JSON API cache

ควรบันทึก tag, edge version group, route/consumer และวิธีตรวจผลหลัง save.

### 7. เพิ่ม concurrent-edit tests

เพิ่ม test สำหรับ:

- stale revision
- save conflict
- reload แล้ว save ใหม่
- ยืนยันว่า conflict ไม่เกิด partial write

### 8. เพิ่ม end-to-end admin-to-public flow

เพิ่ม browser flow:

- admin reorder/disable/add rail
- save
- cache refresh
- หน้าแรก mobile/desktop แสดง order ถูกต้อง
- initial/deferred content ไม่ซ้ำ
- request budget ยังผ่าน

## สิ่งที่ไม่อยู่ในขอบเขตของเอกสารนี้

- การลดความสามารถของ mixed layout หรือ deferred rendering.
- การเปลี่ยน cache duration หรือ public API URL ทันที.
- การเพิ่ม section type ใหม่.

## หลักเกณฑ์ก่อนเริ่มปรับในอนาคต

- คง atomic save และ fallback behavior เดิมระหว่าง refactor.
- เพิ่ม contract tests ก่อนย้าย parser/normalizer.
- ตรวจ admin editor และ public homepage ทั้ง desktop/mobile รวมถึง production network budget.
- รัน targeted tests, lint และ build ก่อนสรุปงาน.
