# Customer Reviews: รายการปรับปรุงในอนาคต

**สถานะ:** มีรายการปรับปรุง  
**Audit ล่าสุด:** 2026-09-07  
**ขอบเขต:** รูปภาพรีวิว/หลักฐานลูกค้าบนหน้าแรก

เอกสารนี้บันทึกผล audit เพื่อใช้ปรับโครงสร้างภายหลัง โดยยังไม่เปลี่ยนพฤติกรรม, API หรือฐานข้อมูลในตอนนี้

## ขอบเขตปัจจุบัน

Feature นี้จัดการรูปภาพรีวิว/หลักฐานลูกค้าบนหน้าแรก ไม่ใช่ระบบรีวิวรายบ้านแบบดาวและคอมเมนต์

Data flow ปัจจุบัน:

```text
Admin page
  -> /api/admin/customer-reviews
  -> lib/customer-reviews/admin-route.ts
  -> Supabase tables + Storage

Public homepage
  -> lib/customer-reviews/server.ts
  -> customer-review cache
  -> customer proof/review section
```

ไฟล์หลัก:

- `components/admin/customer-reviews/admin-customer-reviews-page.tsx`
- `app/(admin)/api/admin/customer-reviews/route.ts`
- `lib/customer-reviews/admin-route.ts`
- `lib/customer-reviews/server.ts`
- `lib/customer-reviews/types.ts`
- `supabase/migrations/20260710041207_create_customer_review_images.sql`

## สิ่งที่ทำได้ดีอยู่แล้ว

- Route Handler รับผิดชอบเฉพาะ auth และส่งต่องานให้ `lib`.
- ฝั่ง server ตรวจชนิด, นามสกุล, และขนาดไฟล์ก่อนอัปโหลด.
- การอัปโหลดมีแนวทาง cleanup เมื่อบันทึก metadata ไม่สำเร็จ.
- ข้อมูลหน้า public มี cache/revalidation แยกตาม feature.
- Test ปัจจุบันครอบคลุม public read, admin route, bulk delete และการ export รูปจาก crop.

## สิ่งที่ควรปรับปรุง

### 1. แยก UI ตามหน้าที่

`admin-customer-reviews-page.tsx` รวม upload, crop, image library, alt editing, delete mode, homepage queue, reorder, preview และ auth handling ไว้ในไฟล์เดียว

ควรแยกเป็น component/hook ตามหน้าที่ เช่น:

```text
components/admin/customer-reviews/
  admin-customer-reviews-page.tsx
  customer-review-upload.tsx
  customer-review-crop-dialog.tsx
  customer-review-image-library.tsx
  customer-review-homepage-queue.tsx
  customer-review-delete-dialog.tsx
  customer-review-layout-preview.tsx
  use-customer-review-admin.ts
```

เป้าหมาย: UI component รับผิดชอบการ render และ event เฉพาะส่วน; state และการประสาน API อยู่ใน hook ที่ตั้งชื่อสื่อความหมาย.

### 2. รวมกติกา upload ที่ใช้ร่วมกัน

กติกา upload เช่นขนาดสูงสุด 6 MB, MIME type และ extension ถูกประกาศทั้งใน client และ server ซึ่งอาจเปลี่ยนไม่พร้อมกันได้

ควรเพิ่ม module ที่ปลอดภัยสำหรับทั้ง browser และ server:

```text
lib/customer-reviews/upload-policy.ts
```

Module นี้ควร export ค่ากลางและ helper ที่ไม่พึ่ง Node.js/Supabase ส่วน server ต้องตรวจซ้ำทุกครั้งก่อนบันทึก เพราะ client validation ไม่ใช่ security boundary.

### 3. แยก admin logic ตาม domain

`lib/customer-reviews/admin-route.ts` รวม request parsing, image conversion, Storage, database writes, queue persistence และ delete cleanup ไว้ด้วยกัน

ควรแยกเป็น module ตามความรับผิดชอบ เช่น:

```text
lib/customer-reviews/
  admin-image-library.ts    # list, alt, visibility, delete metadata
  admin-assets.ts           # upload, conversion, storage, cleanup history
  admin-homepage-queue.ts   # queue/layout validation and RPC persistence
  admin-route.ts            # dispatch request ไปยัง module ข้างต้น
```

เป้าหมาย: URL และ HTTP contract ปัจจุบันยังคงเดิมได้ แต่การหาและ test logic แต่ละ flow ง่ายขึ้น.

### 4. ทำ PATCH contract ให้ชัดตาม action

`PATCH /api/admin/customer-reviews` รองรับการแก้ข้อมูลรูปและบันทึก homepage queue ซึ่งเป็นความรับผิดชอบคนละแบบ

ควรแยก type, parser และ handler ของแต่ละ action ให้ชัดเจนก่อน หากในอนาคต flow โตขึ้นค่อยพิจารณาแยก endpoint เช่น queue settings ออกจาก image metadata.

### 5. เพิ่ม test ตาม user flow ที่ยังขาด

ควรเพิ่ม component/integration test สำหรับ:

- upload สำเร็จและอัปโหลดล้มเหลว
- แก้ alt text สำเร็จและ validation error
- hide/show รูป
- บันทึก homepage queue และ layout
- drag reorder queue
- access token หมดอายุหรือ API ตอบ unauthorized
- API error แล้ว UI แสดง error/retry ได้ถูกต้อง
- cleanup state ของ preview/object URL เมื่อปิด crop dialog หรือเปลี่ยนไฟล์

### 6. ทำ feature map สำหรับผู้ดูแลโค้ด

เพิ่มส่วนสรุปสั้นในเอกสารโครงสร้างหรือเอกสาร feature โดยระบุ UI, API, server logic, ตาราง Supabase, Storage path, cache tag และ test ที่เกี่ยวข้อง เพื่อให้เริ่มแก้ feature นี้ได้โดยไม่ต้องค้นทั้ง repository.

## สิ่งที่ไม่อยู่ในขอบเขตของเอกสารนี้

- ระบบรีวิวรายบ้านแบบคะแนนดาว, comment, booking code, รูปรีวิว และ audit log
- การเปลี่ยน API URL หรือ migration ฐานข้อมูลทันที
- การเปลี่ยน public homepage layout หรือ content ของหน้าเว็บ

## หลักเกณฑ์ก่อนเริ่มปรับในอนาคต

- คงพฤติกรรมและ API contract เดิม เว้นแต่มีการอนุมัติเปลี่ยนชัดเจน.
- แยกพร้อมเพิ่ม/ปรับ tests ของ flow ที่ย้าย.
- ตรวจ upload validation ฝั่ง server เสมอ.
- ทดสอบ targeted tests ของ feature และ lint/build ตามกฎโปรเจกต์ก่อนสรุปงาน.
