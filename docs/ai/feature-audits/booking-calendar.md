# Villa Availability & Calendar

ตรวจเมื่อ: 2026-11-07
สถานะ: มีรายการปรับปรุง

## ขอบเขตปัจจุบัน

หน้ารายละเอียดบ้านดึงราคาและสถานะจองของเดือนปัจจุบันตามเวลา `Asia/Bangkok` จาก Pattaya booking API ฝั่งเซิร์ฟเวอร์ เมื่อเปลี่ยนเดือนหรือกดลองใหม่ เบราว์เซอร์ขอเฉพาะเดือนนั้นผ่าน `/api/villas/:id/calendar` ปฏิทินบนมือถือและเดสก์ท็อปใช้ข้อมูลชุดเดียวกัน

## จุดที่ทำได้ดี

- token ของ upstream อยู่บน server เท่านั้น
- เบราว์เซอร์ได้รับเฉพาะข้อมูลปฏิทินที่ผ่านการแปลงรูปแบบแล้ว
- private Route Handler ตรวจ Bearer token, villa/month input และ rate limit
- หน้ารายละเอียดและข้อมูลปฏิทินใช้ `no-store` หน้าวิลล่าข้ามแคชของ Worker และการอุ่นแคช
- normalization รวมกติกา priority ของ booking, holiday และ promotion ไว้ฝั่ง server
- UI ถูกแยกเป็น panel, day cell, month caption, dialog และ contact actions แล้ว
- เมื่อโหลดพลาด หน้าจะแสดงสถานะและให้ลองใหม่เฉพาะปฏิทิน

## รายการที่ควรปรับในอนาคต

### 1. ทำ date model กลางตามเวลา Bangkok

Server ใช้ `Asia/Bangkok` เพื่อสร้าง month key แต่ client ใช้ `new Date()` ตาม timezone ของเครื่องผู้ชม ควรมี helper หรือ contract เดียวสำหรับวันนี้, month key และ day key เพื่อไม่ให้การแสดงผลคลาดเคลื่อนใกล้เที่ยงคืนหรือเมื่อผู้ชมอยู่คนละ timezone

### 2. ทำ upstream contract และกติกาทับซ้อนให้เป็นทางการ

`booking-calendar.ts` รับข้อมูลภายนอกหลายชนิดและเลือกผลด้วย priority ควรตั้งชื่อ priority, validation runtime ของ payload และ contract test ทุกกรณี booking/promotion/holiday ซ้อนกัน รวมถึงกติกา check-in/check-out ว่าวันใดควรปิดจริง

### 3. ตั้งชื่อ private API ให้สื่อ boundary

`public-booking-calendar-route.ts` และ policy `publicCalendar` เป็น endpoint สำหรับ server consumer ที่ต้องใช้ Bearer token ควรเปลี่ยนชื่อ หรือบันทึก boundary นี้ให้เด่นชัด เพื่อลดโอกาสที่ผู้แก้โค้ดภายหลังจะนำไปเรียกจาก browser

### 4. เก็บ context วันที่เลือกไปกับ contact analytics

เมื่อผู้ชมเลือกวันแล้วกด LINE, Messenger หรือโทร ควรส่ง villa id, วันที่เลือก, สถานะ และราคาไปกับ event หรือข้อความเริ่มต้น เพื่อวัด conversion และช่วยแอดมินรู้ช่วงวันที่ลูกค้าสนใจ

### 5. ทำ calendar flow map

บันทึกเส้นทาง `Detail server → preload → normalization → client calendar → contact` พร้อม env token, timeout, cache policy และ failure states ไว้ในเอกสารเดียว เพื่อให้แก้ feature โดยไม่กระทบความปลอดภัยหรือความสดของวันว่าง

## การตรวจสอบ

`npm.cmd test -- lib/villas/__tests__/booking-calendar.test.ts lib/villas/__tests__/booking-calendar-preload.test.ts lib/api/__tests__/calendar-internal-auth.test.ts components/villas/detail/__tests__/booking-sidebar.test.tsx components/villas/detail/__tests__/booking-calendar-ui.test.ts components/villas/detail/__tests__/booking-calendar-parts.test.tsx components/villas/detail/__tests__/booking-calendar-day-detail-dialog.test.tsx`

ตรวจสอบ `app/(public)/api/villas/[id]/calendar/route.test.ts` และ `worker-cache-policy.test.ts` เพิ่มเมื่อแก้เส้นทางโหลดข้อมูลหรือกติกาแคช ค้นหาเหตุขัดข้องใน log ด้วย `booking_calendar_fetch_failed`
