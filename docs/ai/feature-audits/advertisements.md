# Advertisements CMS

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## ขอบเขตปัจจุบัน

Feature นี้แสดง “กิจกรรมที่น่าสนใจ” ใน Villa Detail ตาม `location_zone` ของบ้านและ zone `all` ข้อมูลถูกอ่านจาก Supabase `advertisements` และ `advertisement_images`; รูปถูกสร้างเป็น URL ไปยัง R2 Worker แล้วเปิด gallery popup ในหน้า Detail

## จุดที่ทำได้ดี

- public read กรองเฉพาะ `is_active = true` และ zone ของบ้านหรือ `all`
- image id และ image name ถูก validate ก่อนนำไปสร้าง URL
- URL รับเฉพาะ HTTPS และไม่รับ credential ใน URL
- public data ถูกจำกัดจำนวน และ image rows ถูกเรียงลำดับก่อนส่งออก
- Detail page ยังแสดงเนื้อหาหลักได้เมื่อ advertisement อ่านไม่สำเร็จ
- CSP รวม image origin ของ advertisement แล้ว
- test ของ data read, URL builder, renderer, lightbox, Next config และ CSP ผ่าน 50 tests

## รายการที่ควรปรับในอนาคต

### 1. ระบุ owner ของข้อมูลให้ครบ

ใน repo มีเฉพาะส่วนอ่านและแสดงผล แต่การสร้าง/แก้ไข advertisement, upload รูป และจัดลำดับข้อมูลอยู่นอกระบบนี้ ควรทำแผนผังว่า Supabase, R2 Worker, env URL pattern และหน้า Detail ใครเป็น owner เพื่อให้รู้จุดแก้เมื่อข้อมูลหรือรูปมีปัญหา

### 2. ทำ admin/content workflow ให้เป็นทางการ

หากจะบริหารข้อมูลจากระบบนี้ในอนาคต ควรมี flow เพิ่ม, แก้, ปิดใช้งาน, จัด zone, จัดลำดับรูป, preview และลบ พร้อม validation กับ asset cleanup ไม่ควรให้ public consumer รับภาระจัดการข้อมูลที่ผิดพลาดเอง

### 3. ทำ runtime schema ของข้อมูล Supabase

`lib/advertisements/server.ts` cast ข้อมูลจาก Supabase เป็น type ภายในเป็นหลัก ควรมี parser/normalizer ที่ตรวจ id, title, zone, active state และ image rows ชัดเจน พร้อมบันทึกเหตุผลเมื่อข้าม row ที่เสีย

### 4. กำหนด cache invalidation เมื่อ CMS เปลี่ยน

ปัจจุบันใช้ cache 12 ชั่วโมง แต่ใน repo ยังไม่เห็น save flow ที่ revalidate tag `advertisements` ควรกำหนด webhook หรือ admin save trigger เพื่อให้การเปิด/ปิด/เปลี่ยนรูปมีผลตามเวลาที่คาดได้

### 5. แยก public DTO กับ content model

`PublicAdvertisement` มีเพียง id, title และ URLs ซึ่งเหมาะกับการแสดงผลปัจจุบัน แต่ควรกำหนด content model แยกต่างหากหากในอนาคตมี caption, link, CTA, ช่วงเวลาเผยแพร่ หรือการจัดลำดับต่อ zone เพื่อไม่ให้ public DTO โตปะปนกับข้อมูลหลังบ้าน

### 6. เพิ่มสถานะ degraded และ observability

เมื่ออ่านข้อมูลล้มเหลว หน้า Detail ยังทำงานต่อได้ ซึ่งถูกต้อง แต่ผู้ใช้จะไม่เห็น section และทีมอาจไม่รู้ปัญหา ควรมี log หรือ metric ที่ปลอดภัย และกำหนดว่าจะมี fallback หรือ admin health status หรือไม่

### 7. ทำ image lifecycle และ health check

รูปอยู่ที่ R2 Worker ต่างจากภาพบ้าน ควรบันทึกข้อกำหนดชื่อไฟล์, ขนาด/MIME, retention, การลบไฟล์เมื่อ record ถูกลบ และวิธีตรวจรูปเสียหรือ Worker URL pattern ผิด

### 8. ทดสอบ cross-boundary flow

เพิ่ม integration test สำหรับ zone `all`, zone บ้าน, ไม่มี zone, รูปเสีย, title ผิดรูปแบบ, cache invalidation และ CSP/image origin ให้ครอบคลุมเส้นทาง Supabase → URL builder → Detail block → lightbox

## การตรวจสอบที่รันแล้ว

`npm.cmd test -- lib/advertisements components/villas/detail/__tests__/detail-layout-renderer.test.tsx components/villas/detail/__tests__/gallery-lightbox.test.tsx lib/__tests__/next-config.test.ts lib/security/__tests__/csp.test.ts`

ผลลัพธ์: ผ่าน 5 test files, 50 tests
