# Legal Pages: รายการปรับปรุงในอนาคต

**สถานะ:** มีรายการปรับปรุง  
**Audit ล่าสุด:** 2026-09-07  
**ขอบเขต:** Terms, Privacy, public structured-content renderer, admin editor, publish state และ legal CMS persistence

เอกสารนี้บันทึกผล audit เพื่อใช้ปรับโครงสร้างภายหลัง โดยยังไม่เปลี่ยนพฤติกรรม, API หรือฐานข้อมูลในตอนนี้

## Data flow ปัจจุบัน

```text
Public pages
  -> /terms และ /privacy
  -> components/legal/
  -> lib/legal-pages/server.ts

Admin editor
  -> components/admin/legal/
  -> /api/admin/legal-pages
  -> lib/legal-pages/admin-route.ts
```

## สิ่งที่ทำได้ดีอยู่แล้ว

- Fixed slug allowlist จำกัดให้มีเพียง `terms` และ `privacy`.
- Public renderer รองรับเฉพาะ structured blocks และ safe links.
- ไม่มี raw admin HTML ผ่าน `dangerouslySetInnerHTML`.
- Draft/published state และ `publishedAt` มี validation.
- Public server read ซ่อน draft และใช้ default ปลอดภัยเมื่อ CMS มีปัญหา.
- Route Handler แยก auth และ domain logic.
- Targeted test ที่ตรวจใน audit ผ่าน 5 files และ 54 tests.

## สิ่งที่ควรปรับปรุง

### 1. ย้าย public content normalization ออกจาก component

`components/legal/legal-page.tsx` parse `unknown[]` และ sanitize links เอง

เพิ่ม `lib/legal-pages/public-dto.ts` เพื่อ normalize เป็น typed safe blocks แล้วให้ component รับผิดชอบ render เท่านั้น.

### 2. ตรวจและรวมเฉพาะ primitive ที่ซ้ำกับ Guides

Guides และ Legal Pages มี text block, marks และ safe link logic ใกล้กัน

เปรียบเทียบ schema ก่อนรวมเฉพาะ primitive ที่เหมือนจริง เช่น safe link normalization หรือ inline mark model โดยไม่บังคับรวม renderer ทั้งก้อน.

### 3. เพิ่ม fallback observability

เมื่อ CMS ล้มเหลว public page แสดง default ได้ดี แต่ operator อาจไม่รู้ว่า fallback เกิดขึ้น

เพิ่ม degraded/fallback status ใน admin health/status panel หรือ internal logging ที่ไม่เปิดเผยข้อมูลสาธารณะ.

### 4. เพิ่ม legal version history

เพิ่ม immutable version/audit history ที่เก็บผู้แก้, เวลา, สถานะ publish และ content snapshot เพื่อการตรวจย้อนหลัง.

### 5. ป้องกัน concurrent edits

เพิ่ม revision/`updated_at` check ตอน save เพื่อกันแอดมินเขียนทับร่างของกันและกัน.

### 6. แยก admin editor composition เมื่อ UI โตขึ้น

เมื่อเพิ่ม format/tool ใหม่ ให้แยก:

```text
components/admin/legal/
  legal-page-editor.tsx
  legal-page-preview.tsx
  use-legal-page-draft.ts
```

### 7. เพิ่ม publish workflow integration tests

เพิ่ม flow: draft -> preview -> publish -> public route -> sitemap/metadata รวมถึง rollback เมื่อ persistence หรือ revalidation ล้มเหลว.

### 8. ทำ legal feature map

ระบุ content schema, allowed link protocols, defaults, cache tag, publish rules และ test files.

## สิ่งที่ไม่อยู่ในขอบเขตของเอกสารนี้

- Rich-text ที่รับ arbitrary HTML จากแอดมิน.
- การเพิ่ม slug/page type นอกเหนือจาก Terms และ Privacy.
- การเปลี่ยน URL หรือ cache policy ทันที.

## หลักเกณฑ์ก่อนเริ่มปรับในอนาคต

- รักษา structured-content safety และ public fallback behavior.
- เพิ่ม validation/contract tests ก่อนย้าย parser หรือ renderer.
- ตรวจ public/admin UI, cache, sitemap และ metadata เมื่อเปลี่ยน publish flow.
- รัน targeted tests, lint และ build ก่อนสรุปงาน.
