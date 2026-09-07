# Public Image Delivery & Proxy

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## ขอบเขตปัจจุบัน

Feature นี้ส่งภาพบ้านสู่ public browser ผ่าน same-origin routes โดยไม่เปิด source host. รองรับ exact card manifest, image display, legacy URL-addressed proxy และ download; ทุก shape มี validation, rate limit และ cache policy ของตนเอง

## จุดที่ทำได้ดี

- public browser เห็นเฉพาะ same-origin image routes และไม่เผย upstream source host
- query-free, duplicate-key และ unsupported shapes ได้ private `404` ก่อน rate limit หรือ Supabase read
- แยก rate limit ระหว่าง card manifest, image delivery และ download
- validate HTTPS URL และปฏิเสธ credential, localhost, loopback, private และ link-local hosts
- image id-addressed delivery ตรวจ ownership ระหว่างบ้านกับรูป
- tests image proxy, cover proxy, card image config และ public proxy ผ่าน 5 test files, 88 tests

## รายการที่ควรปรับในอนาคต

### 1. แยก `images.ts` ตามความรับผิดชอบ

แยก source-gallery read, URL validation, cover override, card image resolution และ public delivery เป็น owners ที่ชัดเจน

### 2. ทำ request-shape registry

ระบุ shape, input schema, privacy level, cache policy, rate limit และ consumer ของ card manifest, display image, legacy URL proxy และ download ไว้กลางเดียว

### 3. วางแผนถอน legacy URL-addressed proxy

บันทึก callers ที่เหลือ, metrics การใช้งาน และเงื่อนไขถอน เพื่อไม่ให้มีสอง security boundary ถาวร

### 4. ทำ image ownership map

ระบุ listing cover, uploaded cover override, source gallery, card manifest, detail gallery และ download ว่าอ้างอิงข้อมูล/ตรวจ ownership ที่ใด

### 5. ทำ observability ที่ไม่เก็บ URL ลับ

log request classification, reject reason, house/image id, status, cache outcome และ upstream failure โดยไม่ log source URL เต็มหรือ query ที่อ่อนไหว

### 6. ทำ distributed abuse protection

กำหนดชั้น Cloudflare/KV/Worker สำหรับ traffic จริง โดยคง budget แยก metadata, image bytes และ download

### 7. ทดสอบ production network contract

ตรวจ Home/Search/Guide/Detail ว่าไม่มี upstream host, ไม่มี `/_next/image`, ใช้ id-addressed route และ unsupported query ได้ private `404`

### 8. ทำ image cache invalidation map

ระบุว่าการแก้ cover, custom card image, source gallery หรือ external refresh ต้อง invalidate tag/version group ใด

### 9. ทำ fallback UX สำหรับ proxy failure

กำหนด placeholder, retry และ alt text เมื่อ image proxy หรือ metadata ล้มเหลวให้เหมือนกันทุก consumer

## การตรวจสอบที่รันแล้ว

`npm.cmd test -- lib/__tests__/public-image-proxy.test.ts lib/villas/__tests__/images.test.ts lib/villas/__tests__/image-proxy.test.ts lib/villas/__tests__/cover-image-proxy.test.ts lib/villas/__tests__/card-image-config-admin.test.ts`

ผลลัพธ์: ผ่าน 5 test files, 88 tests
