# Villa Detail Layout CMS

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## ขอบเขตปัจจุบัน

Feature นี้กำหนดลำดับ, column และการเปิด/ปิด block ใน Villa Detail ผ่าน `site_settings.detail_layout` Admin editor รองรับ layout V1/V2, drag-and-drop, preview และ gallery settings; public renderer แสดง layout จาก config ที่ validate แล้วและ revalidate cache หลังบันทึก

## จุดที่ทำได้ดี

- มี type, defaults, validation และ compatibility สำหรับ layout V1/V2
- Admin route รวม auth delegation, request parsing, validation, persistence และ cache revalidation ไว้ฝั่ง server
- public renderer ถูกแยกเป็น renderer, helpers, parts และ block renderer
- admin มี canvas, block library, row settings และ preview เป็นส่วนประกอบแยกแล้ว
- public domain และ renderer tests ผ่าน 5 test files, 62 tests

## ข้อสังเกตการตรวจสอบ

ชุด test ของ admin drag-and-drop รันไม่ได้ใน workspace ปัจจุบัน เพราะ `node_modules` ไม่มี `@dnd-kit/core`, `@dnd-kit/sortable` และ `@dnd-kit/utilities` แม้ packages อยู่ใน `package.json` และ lockfile. ข้อนี้ชี้ไปที่ dependency installation ของ environment ไม่ใช่ข้อสรุปว่า component หรือ test เสีย

## รายการที่ควรปรับในอนาคต

### 1. แยก controller ของ admin editor

`admin-detail-layout-page.tsx` รวม fetch/save, draft state, drag-and-drop, reset, gallery style, mobile rail และ UI ไว้ด้วยกัน ควรให้เหลือเป็น coordinator แล้วแยก hook เช่น `use-detail-layout-editor`, `use-detail-layout-save`, `use-layout-dnd` และ section UI ตามหน้าที่

### 2. แยก canvas ตามชนิด layout

`layout-canvas.tsx` รองรับ V1/V2, wide/narrow rows, locked sections และ DnD หลายรูปแบบ ควรแยก canvas V1, canvas V2, row components และ drop-zone components เพื่อให้การแก้ layout version ใหม่ไม่กระทบของเดิม

### 3. ทำ block registry กลาง

การเพิ่ม block ใหม่ต้องแก้ type, defaults, validator, admin library, preview, renderer, data loading และ test หลายจุด ควรมี registry เดียวระบุ label, capability, renderer owner, ค่า default และเงื่อนไข `hideWhenEmpty` โดยยังให้ UI/server มี implementation ของตนเอง

### 4. ทำ lifecycle ของ V1 → V2 ให้ชัด

ควรบันทึกว่า V1 ยังจำเป็นกับข้อมูลใด, ทาง migrate เป็น V2, เงื่อนไขที่จะหยุดสร้าง V1 และแผนลบ compatibility ในอนาคต

### 5. ป้องกัน concurrent save

Layout เป็น JSON ก้อนเดียวใน `site_settings.detail_layout` การแก้พร้อมกันจาก admin สองคนอาจบันทึกทับกัน ควรมี revision หรือ `updated_at` token และแจ้ง stale draft ก่อน save

### 6. ป้องกัน race ตอนสร้าง settings แถวแรก

save flow ใช้ update ก่อน แล้ว insert ถ้าไม่พบ row ควรมี strategy สำหรับกรณีผู้ดูแลสองคน save ครั้งแรกพร้อมกัน เช่น upsert หรือจัดการ unique conflict แล้วอ่านค่าล่าสุด

### 7. ทำ block data-requirements map

บาง block ทำให้หน้า Detail ต้อง preload ข้อมูลเฉพาะ เช่น advertisements ควรบันทึกว่าแต่ละ block ต้องใช้ data อะไร, cache tag ใด, loading/failure fallback แบบไหน เพื่อป้องกันเปิด block ใหม่แล้วข้อมูลไม่ถูกโหลดหรือโหลดเกินจำเป็น

### 8. ตรวจ preview ให้ตรง public renderer

Admin preview เป็น representation แยกจาก renderer จริง ควรมี contract หรือ visual test สำหรับ layout สำคัญ เพื่อไม่ให้สิ่งที่เห็นก่อน save ต่างจากหน้า Villa Detail จริง

### 9. แยกการบันทึก Gallery style กับ Layout ให้ชัด

Gallery style ใช้ API contract คนละชุดกับ detail layout ควรกำหนดชัดว่า save แยกกันหรือเป็น transaction เดียว, error หนึ่งส่วนกระทบอีกส่วนอย่างไร และมี unsaved-state indicator แบบใด

### 10. ทำ dependency verification ใน CI/local setup

เพิ่ม check ที่ยืนยันว่า `npm ci` ติดตั้ง `@dnd-kit/core`, `@dnd-kit/sortable` และ `@dnd-kit/utilities` ก่อนรัน admin tests เพื่อไม่ให้ test suite ถูกข้ามเพราะ dependency หาย

### 11. ทำ layout/cache/version map

บันทึกเส้นทาง `admin save → validation → site_settings → revalidation → public detail renderer` พร้อม V1/V2 และ cache version group เพื่อให้แก้ feature โดยเห็นผลกระทบครบ

## การตรวจสอบที่รันแล้ว

`npm.cmd test -- lib/detail-layout components/villas/detail/__tests__/detail-layout-renderer.test.tsx components/villas/detail/__tests__/detail-layout-renderer-helpers.test.ts`

ผลลัพธ์: ผ่าน 5 test files, 62 tests

คำสั่งที่รวม `components/admin/detail-layout` ไม่ผ่าน เนื่องจาก dependency `@dnd-kit/*` หายจาก `node_modules`
