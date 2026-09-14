# Villa Availability & Calendar

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## ขอบเขตปัจจุบัน

Feature นี้แสดงวันว่าง ราคา และสถานะจองบนหน้า Detail ของบ้าน ข้อมูลถูกอ่านจาก Pattaya booking API โดย server-only token. Villa Server Component preload 14 เดือนจากเดือนปัจจุบันตาม `Asia/Bangkok` และส่งให้ client calendar โดยตรง; browser ไม่เรียก booking-calendar API และไม่ถือ token

## จุดที่ทำได้ดี

- token ของ upstream อยู่บน server เท่านั้น
- browser ไม่เรียก API ปฏิทินและไม่มี credential ฝั่ง client
- private Route Handler ตรวจ Bearer token, villa/month input และ rate limit
- availability read เป็น `no-store` เพื่อให้ข้อมูลปัจจุบัน
- normalization รวมกติกา priority ของ booking, holiday และ promotion ไว้ฝั่ง server
- UI ถูกแยกเป็น panel, day cell, month caption, dialog และ contact actions แล้ว
- test ของ normalization, preload, auth และ UI ผ่าน 49 tests

## รายการที่ควรปรับในอนาคต

### 1. แยกสถานะข้อมูลไม่พร้อมออกจากวันติดจอง

`unavailableMonths` ที่ preload ได้มายังไม่ถูกส่งไปใช้ใน UI เดือนที่โหลดไม่สำเร็จจึงถูกปิดเลือกคล้ายวันติดจอง ควรส่ง status นี้ถึง calendar และแสดงข้อความ เช่น “กำลังตรวจสอบข้อมูลเดือนนี้ กรุณาติดต่อแอดมิน” เพื่อไม่ให้ผู้ชมเข้าใจว่าเต็มจริง

### 2. ทำ date model กลางตามเวลา Bangkok

Server ใช้ `Asia/Bangkok` เพื่อสร้าง month key แต่ client ใช้ `new Date()` ตาม timezone ของเครื่องผู้ชม ควรมี helper หรือ contract เดียวสำหรับวันนี้, month key และ day key เพื่อไม่ให้การแสดงผลคลาดเคลื่อนใกล้เที่ยงคืนหรือเมื่อผู้ชมอยู่คนละ timezone

### 3. ทำ upstream contract และกติกาทับซ้อนให้เป็นทางการ

`booking-calendar.ts` รับข้อมูลภายนอกหลายชนิดและเลือกผลด้วย priority ควรตั้งชื่อ priority, validation runtime ของ payload และ contract test ทุกกรณี booking/promotion/holiday ซ้อนกัน รวมถึงกติกา check-in/check-out ว่าวันใดควรปิดจริง

### 4. กำหนด request budget ของการ preload

การเปิด Detail preload 14 เดือนพร้อมกันจาก upstream ควรระบุ concurrency, timeout รวม และพฤติกรรมเมื่อบางเดือนไม่สำเร็จ เพื่อคุมแรงกดต่อระบบต้นทางเมื่อมีผู้ชมหลายคนพร้อมกัน

### 5. เพิ่ม observability ของ upstream calendar

ปัจจุบัน error ถูกแปลงเป็น `unavailable` อย่างปลอดภัยแล้ว ควรเพิ่ม log หรือ metric ที่ไม่เผย token เช่น property id, month, timeout/HTTP status และจำนวนเดือนล้มเหลว เพื่อเห็นปัญหาก่อนลูกค้าแจ้ง

### 6. ตั้งชื่อ private API ให้สื่อ boundary

`public-booking-calendar-route.ts` และ policy `publicCalendar` เป็น endpoint สำหรับ server consumer ที่ต้องใช้ Bearer token ควรเปลี่ยนชื่อ หรือบันทึก boundary นี้ให้เด่นชัด เพื่อลดโอกาสที่ผู้แก้โค้ดภายหลังจะนำไปเรียกจาก browser

### 7. เก็บ context วันที่เลือกไปกับ contact analytics

เมื่อผู้ชมเลือกวันแล้วกด LINE, Messenger หรือโทร ควรส่ง villa id, วันที่เลือก, สถานะ และราคาไปกับ event หรือข้อความเริ่มต้น เพื่อวัด conversion และช่วยแอดมินรู้ช่วงวันที่ลูกค้าสนใจ

### 8. ทำ calendar flow map

บันทึกเส้นทาง `Detail server → preload → normalization → client calendar → contact` พร้อม env token, timeout, cache policy และ failure states ไว้ในเอกสารเดียว เพื่อให้แก้ feature โดยไม่กระทบความปลอดภัยหรือความสดของวันว่าง

## การตรวจสอบที่รันแล้ว

`npm.cmd test -- lib/villas/__tests__/booking-calendar.test.ts lib/villas/__tests__/booking-calendar-preload.test.ts lib/api/__tests__/calendar-internal-auth.test.ts components/villas/detail/__tests__/booking-sidebar.test.tsx components/villas/detail/__tests__/booking-calendar-ui.test.ts components/villas/detail/__tests__/booking-calendar-parts.test.tsx components/villas/detail/__tests__/booking-calendar-day-detail-dialog.test.tsx`

ผลลัพธ์: ผ่าน 7 test files, 49 tests
