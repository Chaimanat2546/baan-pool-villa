# Guides CMS: รายการปรับปรุงในอนาคต

**สถานะ:** มีรายการปรับปรุง  
**Audit ล่าสุด:** 2026-09-07  
**ขอบเขต:** Public guide pages, admin guide CMS, content editor, image uploads และ guide data contract

เอกสารนี้บันทึกผล audit เพื่อใช้ปรับโครงสร้างภายหลัง โดยยังไม่เปลี่ยนพฤติกรรม, API หรือฐานข้อมูลในตอนนี้

## Data flow ปัจจุบัน

```text
Public pages
  -> app/(public)/guides
  -> components/guides/
  -> lib/guides/server.ts + public-dto.ts

Admin CMS
  -> app/(admin)/admin/guides
  -> components/admin/guides/
  -> /api/admin/guides และ /api/admin/guides/assets
  -> lib/guides/admin-route.ts + admin-assets-route.ts
```

## สิ่งที่ทำได้ดีอยู่แล้ว

- แยก public read, admin persistence, upload และ validation ใน `lib/guides`.
- แยก API upload ออกจาก API บันทึก guide.
- Route Handler รับผิดชอบ auth และ delegation เป็นหลัก.
- มี validation slug, URL, house ID, image metadata และ public DTO.
- Targeted test ที่ตรวจใน audit ผ่าน 14 files และ 105 tests.

## สิ่งที่ควรปรับปรุง

### 1. แยก admin list ออกจาก editor

`admin-guides-page.tsx` รองรับทั้งหน้ารายการ guide และหน้า editor รวม state, fetch, save, delete, upload, pagination และ preview

ควรแยกเป็น:

```text
components/admin/guides/
  admin-guides-list-page.tsx
  admin-guide-editor-page.tsx
  use-admin-guides.ts
```

เป้าหมาย: หน้ารายการและหน้าจัดการเนื้อหาเปลี่ยนคนละเหตุผล จึงควรอ่านและ test แยกกันได้.

### 2. แยกส่วนประกอบของ rich-text editor

`guide-rich-text-editor.tsx` รวม toolbar, custom marks, plain-text editor, TipTap lifecycle, link control และ inline image upload

ควรแยกเป็น component เช่น:

```text
components/admin/guides/editor/
  editor-toolbar.tsx
  text-color-control.tsx
  link-control.tsx
  inline-image-upload.tsx
  editable-plain-text-field.tsx
```

### 3. แยก public content renderer

`guide-detail-page.tsx` รวมการ parse content blocks, validate link, parse YouTube, render inline formatting, render blocks, recommended villas และหน้ารวม

ควรแยกเป็น:

```text
components/guides/
  guide-content-renderer.tsx
  guide-inline-content.tsx
  guide-video-embed.tsx
  recommended-villa-sidebar.tsx
```

### 4. สร้าง content-block contract กลาง

ฝั่ง admin แปลง TipTap document เป็น guide blocks ขณะที่ public page parse/render `unknown[]` ด้วย logic อีกชุด

ควรมี schema/normalizer กลางใน `lib/guides` ที่ปลอดภัยต่อทั้ง browser และ server:

```text
lib/guides/
  content-schema.ts
  content-normalization.ts
```

Editor เป็น adapter เข้า schema นี้ และ public component ควรรับ only normalized type แทน raw `unknown[]`.

### 5. ย้าย public content normalization ออกจาก component

`public-dto.ts` ปัจจุบันเน้น summary DTO ส่วน full content parsing อยู่ใน component

ควรย้าย normalization ของ public content ไป `lib/guides/public-dto.ts` หรือ module schema กลาง เพื่อให้ UI รับผิดชอบ render เท่านั้น.

### 6. เพิ่ม integration tests ตาม user flow

เพิ่ม test ที่ครอบคลุม flow ต่อเนื่อง:

- สร้าง draft
- upload cover และ inline image
- save
- เปิด public page
- แก้ไขและ save ซ้ำ
- ลบ guide
- upload/save ล้มเหลวและ UI แสดง recovery state ถูกต้อง

### 7. ทำ feature map ของ Guides CMS

บันทึก map ที่ระบุ:

- public/admin routes
- content block schema และจุดที่แปลงข้อมูล
- asset bucket และ upload history
- cache tag และ revalidation
- test files ของแต่ละ flow

## สิ่งที่ไม่อยู่ในขอบเขตของเอกสารนี้

- การเปลี่ยนรูปแบบ content block หรือ migrate เนื้อหาเดิมทันที
- การเปลี่ยน public URL หรือ SEO behavior
- การเปลี่ยน storage bucket หรือ API contract ทันที

## หลักเกณฑ์ก่อนเริ่มปรับในอนาคต

- คง guide content ที่บันทึกอยู่เดิมให้อ่านและ render ได้ตลอดการย้าย.
- ตรวจ URL และเนื้อหา admin input ฝั่ง server เสมอ.
- เพิ่ม test ให้ครอบคลุม adapter/schema ก่อนย้าย renderer หรือ editor.
- รัน targeted tests, lint, build และตรวจ public/admin UI ก่อนสรุปงาน.
