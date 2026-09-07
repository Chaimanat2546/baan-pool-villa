# External Villa Data Refresh

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## ขอบเขตปัจจุบัน

Feature นี้เป็น admin action ที่ revalidate cache ของข้อมูลบ้านจากระบบต้นทาง: listing, detail, card image และ gallery image รวมถึง JSON edge cache version groups. API ต้องเป็น active admin, ต้องส่ง confirmation header และรับ scope เดียวคือ `tags-only`; ไม่บังคับ regenerate public path

## จุดที่ทำได้ดี

- route ใช้ shared admin authorization และ origin check
- ต้องมี explicit confirmation ก่อน revalidate
- scope ถูกจำกัดเป็น `tags-only` และปฏิเสธ `full-public`/unknown scope
- revalidation อยู่ใน helper กลางและระบุ cache tags/version groups ชัดเจน
- มี cooldown 60 วินาทีเป็น defense-in-depth
- test auth, confirmation, scope, cooldown, cache tags และ settings sidebar ผ่าน 3 test files, 22 tests

## รายการที่ควรปรับในอนาคต

### 1. ปรับข้อความ UX ให้ตรงการทำงาน

ปัจจุบันข้อความสื่อว่า “อัปเดตข้อมูลสำเร็จ” แต่ระบบจริงคือขอ refresh cache; การดึงข้อมูลต้นทางจะเกิดใน request ถัดไป ควรบอกผลลัพธ์นี้ชัดเจน เพื่อลดความเข้าใจว่าปุ่มได้ตรวจข้อมูลใหม่เสร็จแล้ว

### 2. ย้าย cooldown จาก memory ใน process

`lastRefreshRequestedAt` อยู่ใน memory ของ instance เดียว จึงไม่ครอบคลุมหลาย Worker/instance และหายหลัง restart ควรกำหนด distributed cooldown เช่น KV, Durable Object หรือฐานข้อมูล หรือระบุชัดว่าเป็นเพียง defense-in-depth

### 3. แยก cooldown ตาม actor และ scope

cooldown ปัจจุบันเป็น global ต่อ instance ทำให้ admin คนหนึ่งอาจบล็อกอีกคนโดยไม่รู้ ควรกำหนด key เช่น actor + action + scope พร้อม audit record

### 4. มี refresh audit log

เก็บว่าใครกด, เมื่อไร, scope ใด, request สำเร็จหรือไม่ และ cache groups ใดถูก invalidate โดยไม่เก็บ token เพื่อช่วยตรวจว่าข้อมูลเก่ายังมาจาก cache หรือจากต้นทาง

### 5. ทำ refresh result contract

ปัจจุบัน response บอกเพียง `refreshed: true` ควรกำหนดว่าการ revalidate tag, HTML/JSON edge version bump และ upstream fetch เป็นคนละขั้น พร้อมสถานะ partial failure ที่ชัดเจน

### 6. จัดการ partial failure ของ revalidation

หาก tag revalidation สำเร็จแต่ edge-version bump ล้มเหลว ควรคืน warning หรือ operation id และมี retry path ไม่ควรให้ admin เห็นเป็น failure หรือ success แบบคลุมเครือ

### 7. รวม scope contract ฝั่ง client/server

`tags-only` ซ้ำเป็น string ใน UI และ server ควรมี shared type, label และ allowed scopes เพื่อให้การเพิ่ม scope ใหม่ไม่ทำให้ UI, API และ cache policy ไม่ตรงกัน

### 8. ทำ cache-impact map

บันทึกว่า refresh นี้มีผลกับ listing, detail, card image, gallery image และ JSON edge versions โดยไม่มีผลกับ path regeneration เพื่อให้ผู้แก้ feature อื่นไม่ใช้ปุ่มนี้ผิดจุด

### 9. เพิ่ม integration test หลัง refresh

ทดสอบว่า request สาธารณะถัดไปอ่านข้อมูลใหม่จริง และ route/cache ที่ไม่เกี่ยวข้องไม่ถูก invalidate รวมถึงกรณีหลาย admin กดพร้อมกัน

## การตรวจสอบที่รันแล้ว

`npm.cmd test -- lib/villas/__tests__/admin-refresh-route.test.ts lib/cache-revalidation.test.ts lib/cache-revalidation-route.test.ts components/admin/settings/__tests__/settings-layout-shell.test.tsx`

ผลลัพธ์: ผ่าน 3 test files, 22 tests
