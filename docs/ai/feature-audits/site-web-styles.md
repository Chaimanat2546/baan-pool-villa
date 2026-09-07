# Site Web Styles

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## ขอบเขตปัจจุบัน

Feature นี้ควบคุมรูปแบบร่วมของเว็บไซต์สามส่วน: Header, Gallery และ Villa Card. ข้อมูลอยู่ใน `site_web_styles` ตาม `style_type`; admin API มี GET/PATCH แยกตาม type และ public consumers อ่าน snapshot ที่ normalize แล้วผ่าน cached `getSiteWebStyles`

## จุดที่ทำได้ดี

- มี type, defaults และ validation ตาม style type
- admin API จำกัด style type และ validate field ที่อนุญาต
- Gallery validate สี, image source, show cover และ category order ครบตาม contract
- public read fallback เป็น defaults ได้เมื่อข้อมูลหรือ Supabase ใช้งานไม่ได้
- save revalidate site-web-style cache และคืน warning หาก refresh cache ไม่สำเร็จ
- มี tests validation, server, category migration, admin route และ legacy header route ผ่าน 8 test files, 28 tests

## รายการที่ควรปรับในอนาคต

### 1. ทำชื่อและ owner ให้ตรงกัน

หน้า `/admin/settings/web-style` ใช้ component ชื่อ `header-settings-page.tsx` และ Header ยังผ่าน legacy endpoint `/api/admin/site-header-settings` ที่แปลงข้อมูลไป-กลับจาก `site_web_styles` ควรวางแผนย้ายไปใช้ชื่อและ contract เดียว เพื่อให้ผู้แก้โค้ดรู้ว่า Header เป็นส่วนหนึ่งของ Web Styles แล้ว

### 2. รวมจุดเข้าจัดการ Web Styles ให้สอดคล้อง

Header กับ Villa Card อยู่หน้า Web Style แต่ Gallery editor อยู่ใน Detail Layout editor แม้ใช้ domain/API เดียวกัน ควรกำหนด UX ว่าตั้งค่ารวมหน้าเดียว หรือแยกโดยแต่ละหน้าต้องบอกความเป็นเจ้าของอย่างชัดเจน

### 3. ทำ style registry กลาง

ตอนเพิ่ม style type ใหม่ต้องแก้ type, defaults, validation, admin route allowlist, normalize และ public consumer หลายตำแหน่ง ควรมี registry ที่บอก type, variant, options schema, default และ cache impact

### 4. ป้องกัน concurrent edit

แต่ละ style row ใช้ upsert โดยไม่มี revision token ผู้ดูแลสองคนแก้ Gallery เดียวกันอาจบันทึกทับกัน ควรใช้ revision หรือ `updated_at` ใน GET และ PATCH เพื่อแจ้ง stale draft

### 5. กำหนด contract ระหว่าง Gallery `imageSource: system` กับ Villa Card Images

ตัวเลือกนี้ทำให้ header gallery ใน Detail ใช้ชุดรูปจากระบบ card image ซึ่งมี cover override และ custom order ของแต่ละบ้าน ควรมี compatibility map และ preview/fallback ที่บอกชัดว่าบ้านที่ยังไม่มี config จะเห็นรูปอะไร

### 6. ทำ migration policy ของ `categoryOrder`

Gallery category ต้องมีครบทุก key และมี test migration อยู่แล้ว ควรบันทึกขั้นตอนเมื่อเพิ่ม, ลบ หรือ rename category เพื่อไม่ให้ config เดิมถูก reset แบบเงียบ ๆ หรือทำให้ category หายจาก public gallery

### 7. ทำ cache-revalidation recovery

API บันทึกข้อมูลสำเร็จแต่ cache refresh ล้มเหลวจะคืน warning ซึ่งดีแล้ว ควรกำหนดวิธี retry หรือ health status เพื่อให้การตั้งค่าใหม่ไม่ค้างจนหมด TTL โดยไม่มีใครรู้

### 8. เพิ่ม cross-consumer test

ทดสอบ style เดียวกันใน Header public, Home/Search/Guide cards, Detail gallery, activity gallery และ mobile/desktop เพื่อให้การแก้ option ไม่กระทบหน้าหนึ่งโดยไม่ตั้งใจ

### 9. ทำ style-consumer map

บันทึก field → admin editor → database row → public consumers → cache tag เช่น `gallery.showCover`, `gallery.imageSource`, `houseCard.variant`, `header.variant` เพื่อให้รู้ว่าต้องแก้ไฟล์ใดเมื่อเพิ่มตัวเลือกใหม่

## การตรวจสอบที่รันแล้ว

`npm.cmd test -- lib/site-web-styles app/(admin)/api/admin/site-web-styles/[styleType]/route.test.ts app/(admin)/api/admin/site-header-settings/route.test.ts lib/site-header-settings components/admin/settings/__tests__/header-settings-page.test.tsx components/admin/detail-layout/__tests__/gallery-style-editor.test.tsx`

ผลลัพธ์: ผ่าน 8 test files, 28 tests
