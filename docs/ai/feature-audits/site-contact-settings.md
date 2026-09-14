# Site Contact Settings: รายการปรับปรุงในอนาคต

**สถานะ:** มีรายการปรับปรุง  
**Audit ล่าสุด:** 2026-09-07  
**ขอบเขต:** Public phone, LINE, Messenger, Facebook, public bank display, admin contact editor และ contact actions ทุกหน้า

เอกสารนี้บันทึกผล audit เพื่อใช้ปรับโครงสร้างภายหลัง โดยยังไม่เปลี่ยนพฤติกรรม, API หรือฐานข้อมูลในตอนนี้

## Data flow ปัจจุบัน

```text
Admin contact editor
  -> components/admin/settings/contact-settings-page.tsx
  -> /api/admin/site-settings/contact
  -> lib/site-contact-settings/

Public actions
  -> lib/site-contact.ts
  -> Header / Footer / Mobile nav / Home / Guide / Legal / Villa booking
```

## สิ่งที่ทำได้ดีอยู่แล้ว

- ใช้ `site_contact_settings` เป็น canonical owner แยกจาก `site_settings`.
- Route Handler ตรวจ admin auth แล้ว delegate ไป domain module.
- Validation ตรวจเบอร์, URL, จำนวนเบอร์ 1–4 รายการ และ fallback ของข้อมูลผิดรูปแบบ.
- Public components รับ resolved settings โดยไม่ query ซ้ำเอง.
- Cache/revalidation แยกจาก Site Settings หลัก.
- Targeted test ที่ตรวจใน audit ผ่าน 9 files และ 49 tests.

## สิ่งที่ควรปรับปรุง

### 1. ลบ default exports ที่ไม่มี consumer

`lib/site-contact.ts` มี `phoneContacts` และ `contactLinks` ที่สร้างจาก default settings แต่ไม่พบ consumer ภายนอกใช้

ควรลบเพื่อป้องกันการ import ค่า default คงที่แทน resolved settings ในอนาคต.

### 2. สร้าง public contact action projection

หลาย component แปลง phone contacts เป็น `tel:` และสร้าง LINE/Messenger links เอง

ควรเพิ่ม `buildPublicContactActions(settings)` เพื่อคืน model ที่ปลอดภัยพร้อม render แล้วให้ component ใช้ตามความจำเป็น.

### 3. แยก public และ private payment contracts

ข้อมูลธนาคารใน contract ปัจจุบันเป็นข้อมูลแสดงสาธารณะ แต่ข้อมูล payment อนาคตอาจมีความลับ

ควรมี type/boundary ชัดเจน เช่น:

```text
PublicContactSettings
AdminPaymentSettings
```

ห้ามเพิ่มข้อมูลลับลงใน public contact contract หรือส่งผ่าน public layout.

### 4. แยกส่วนของ contact editor

หน้า contact editor รวม form และ preview/summary

ควรแยกเป็น:

```text
components/admin/settings/contact/
  contact-form.tsx
  phone-contact-list.tsx
  bank-preview.tsx
  contact-summary.tsx
```

### 5. ป้องกัน concurrent edits

เป็น singleton settings ที่ save ทั้งก้อน และใน audit นี้ไม่พบ revision token

เพิ่ม revision/`updated_at` check สำหรับ PATCH เพื่อกัน admin หลายคนบันทึกทับกัน.

### 6. เพิ่ม audit log

การแก้เบอร์หรือบัญชีธนาคารมีผลกับลูกค้าโดยตรง

เพิ่ม history ที่เก็บผู้แก้, เวลา, field ที่เปลี่ยน และค่า old/new ที่ redact ตามความเหมาะสม.

### 7. เพิ่ม cross-consumer integration tests

เพิ่ม flow: แก้ setting -> save -> Header/Footer/Home/Villa booking แสดงค่าใหม่ และ public links ปลอดภัย.

### 8. ทำ consumer ownership map

บันทึก field -> UI consumer -> link type -> test เพื่อให้รู้ผลกระทบก่อนเพิ่มหรือเปลี่ยน contact field.

## สิ่งที่ไม่อยู่ในขอบเขตของเอกสารนี้

- การย้ายข้อมูล payment ภายในเข้ามาใน public settings.
- การเปลี่ยน public URL หรือ cache policy ทันที.
- การรวม contact settings กลับไป `site_settings`.

## หลักเกณฑ์ก่อนเริ่มปรับในอนาคต

- คง canonical owner และ public link validation.
- ตรวจ migration/RLS อย่างรอบคอบเมื่อเพิ่ม audit log หรือ payment domain.
- ตรวจทุก public contact consumer, targeted tests, lint และ build ก่อนสรุปงาน.
