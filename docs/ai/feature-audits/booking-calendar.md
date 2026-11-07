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

## การตรวจข้อมูลและ log

`booking-calendar-validation.ts` ตรวจข้อมูลจากต้นทางก่อนนำมาแสดง ทั้งราคาวันทั้งเจ็ด ช่วงวันที่ และรายการจองหรือโปรโมชัน เมื่อข้อมูลผิดรูปแบบ ระบบจะแสดงสถานะโหลดไม่ได้และเปิดให้ลองใหม่

- `booking_calendar_preload` ระบุเดือนปัจจุบัน จำนวนเดือนและจำนวนคำขอในรอบเปิดหน้า ใช้ `loadId` เดียวกับ warning ถ้าโหลดไม่สำเร็จ
- `booking_calendar_fetch_failed` ระบุสาเหตุ เช่น timeout, HTTP status, JSON ผิดรูปแบบ หรือข้อมูลไม่ผ่าน validation พร้อมรหัสบ้าน เดือน และเวลาที่ใช้ โดยไม่มีโทเคนหรือข้อมูลการจองดิบ

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


## ผลตรวจของวิธีเดิมเมื่อ 2026-10-30

ผลด้านล่างมาจากช่วงที่หน้าโหลดล่วงหน้า 14 เดือนและลองซ้ำฝั่งเซิร์ฟเวอร์

### ผลจำลองความช้าก่อนเพิ่ม retry วันที่ 2026-10-30

ใช้ production build เดิมกับ Edge ทั้ง desktop/mobile โดยแทรกข้อมูลปฏิทินสังเคราะห์เฉพาะโปรเซสทดสอบ ไม่เปลี่ยน production API หรือ request budget ของแอป:

| เงื่อนไข | ผลที่สังเกตได้ |
| --- | --- |
| ฝั่ง browser: latency 300 ms, download 250 KiB/s, upload 64 KiB/s และ CPU ช้าลง 4 เท่า | ราคาปรากฏในการเปิดครั้งแรกประมาณ 2 วินาที ไม่ต้อง refresh แต่กดเปลี่ยนเดือนเร็วขณะที่ยังมี scripts โหลดค้างอยู่ 16–17 requests ไม่ตอบสนอง รอ scripts โหลดเสร็จแล้วกดใหม่จึงเปลี่ยนเดือนได้ ไม่มี page error และไม่มี browser calendar API request |
| API เดือนปัจจุบันตอบหลัง 3 วินาที | แสดง skeleton ระหว่างรอ จากนั้นราคาแสดงเองประมาณ 3.1 วินาที ทั้งสองขนาดหน้าจอ ไม่ต้อง refresh |
| API เดือนปัจจุบันตอบหลัง 12 วินาที ซึ่งเกิน timeout 8 วินาที | หลังประมาณ 8.2 วินาที แสดงข้อมูลไม่พร้อม, ปิดเลือกวันที่ทั้งเดือน และ log `timeout` พร้อม `currentMonthAvailable=false`; เดือนอื่นยังสำเร็จ 13 เดือน |
| หลัง timeout ให้ต้นทางกลับมาปกติ แต่ยังเปิด document เดิม | รอต่ออีก 2 วินาทีแล้วยังไม่มีการเรียก API เพิ่มและไม่ฟื้นเอง เพราะข้อมูลเดือนที่ล้มเหลวไม่มีอยู่ใน props; เมื่อ reload จึงเรียก 14 เดือนใหม่และแสดงราคาได้ |

พบเส้นทางที่ทำให้อาการเหมือน “ต้อง refresh จึงมีข้อมูล” ได้ แต่ยังไม่ใช่หลักฐานยืนยันเหตุการณ์บนเว็บจริง ต้องเทียบ failure/preload logs หลัง deploy ก่อนเลือกการแก้เรื่อง retry, cache หรือการแยกโหลดข้อมูล ส่วนปุ่มที่ยังไม่ตอบสนองระหว่าง JavaScript โหลดเป็นข้อสังเกตอีกเรื่องหนึ่ง และการทดสอบนี้ยังไม่ได้แก้พฤติกรรมดังกล่าว

### ผลจำลองรอบจำกัด 2 attempts วันที่ 2026-10-30

Production build กับข้อมูลสังเคราะห์ผ่าน 8 browser checks ครบ desktop/mobile:

- ครั้งแรก timeout และครั้งที่สองสำเร็จ: ราคาแสดงเองประมาณ 8.7–8.8 วินาที รวม 15 upstream attempts และ main document เพียงหนึ่งคำขอ ไม่มี refresh, browser calendar API, `_rsc` หรือ `/_next/image` request
- timeout ทั้งสองครั้ง: หยุดที่ 15 attempts หลังประมาณ 16.4–16.7 วินาที แสดงข้อมูลไม่พร้อมและไม่เปิดเลือกวันที่ ไม่มีครั้งที่สาม
- เดือนอนาคต timeout หรือเดือนเริ่มต้นตอบ HTTP 503: คง 14 attempts ไม่ retry
- warning ครั้งแรกและ summary หลัง retry ใช้ `loadId` เดียวกัน พร้อม `attempt`, `retryCount` และ `fetchAttemptCount` ที่ตรงกับคำขอจริง

### ผลจำลองเพดานรวม 4 attempts วันที่ 2026-10-30

ผ่าน 4 browser checks บน production build ครบ desktop/mobile: จำลอง timeout สามครั้งแล้วสำเร็จครั้งที่สี่ ราคาแสดงเองประมาณ 24.7–25.0 วินาทีโดย document โหลดเพียงครั้งเดียว รวม 17 attempts ไม่มี browser calendar API, `_rsc` หรือ `/_next/image` requests เมื่อ timeout ครบทั้งสี่ครั้ง ระบบหยุดที่ 17 attempts หลังประมาณ 32.5 วินาที แสดงข้อมูลไม่พร้อมและไม่เปิดเลือกวันที่ ไม่มีครั้งที่ห้า ชุด unit tests ยืนยันเพิ่มว่าสำเร็จครั้งที่ 2 หรือ 3 ก็หยุดทันที ไม่ต้องใช้ครบทั้งสี่ครั้ง

`npm.cmd test -- lib/villas/__tests__/booking-calendar.test.ts lib/villas/__tests__/booking-calendar-preload.test.ts lib/api/__tests__/calendar-internal-auth.test.ts components/villas/detail/__tests__/booking-sidebar.test.tsx components/villas/detail/__tests__/booking-calendar-ui.test.ts components/villas/detail/__tests__/booking-calendar-parts.test.tsx components/villas/detail/__tests__/booking-calendar-day-detail-dialog.test.tsx`

ผลตรวจก่อนรวม master วันที่ 2026-10-30: `npm.cmd test` ผ่าน 284 test files / 2,451 tests, lint และ production build ผ่าน การตรวจ validation ก่อนเพิ่ม retry ใช้ข้อมูล API จริงของบ้าน 773, 289 และ 2122 และ production network smoke ผ่าน desktop/mobile ที่ 36 same-origin requests / 7 API requests ต่อหน้า เพดานรวมสี่ครั้งผ่าน 4 browser checks ตามรายละเอียดด้านบน ยังไม่ได้ deploy เพื่อเก็บหลักฐานของอาการที่ผู้ใช้รายงานจริง

ผลตรวจหลังรวม `origin/master` ที่ `ae4b490` วันที่ 2026-10-30: เก็บการซ่อนราคาและปิดเลือกวันที่ผ่านมาไว้ร่วมกับ validation, log และ retry สี่ครั้ง ปรับเวลาจำลองในเทสต์ recovery เป็น 14 ก.ค. เพื่อให้ fixture 15 ก.ค. ยังเป็นอนาคต `npm.cmd test` ผ่าน 297 test files / 2,569 tests, lint และ production build ผ่าน ตรวจ production build ด้วยข้อมูลปฏิทินสังเคราะห์ครบ desktop/mobile: ฟื้นในครั้งที่สี่ประมาณ 24.7–25.2 วินาทีโดยไม่ reload และหยุดเมื่อ timeout ครบสี่ครั้งประมาณ 32.5–32.6 วินาที ทั้งคู่ไม่เกิน 17 attempts ผ่าน browser checks 4 เคส และ network smoke อีก 2 เคส ที่ 38 same-origin requests / 7 API requests ต่อหน้า ไม่มี browser calendar API, `_rsc` หรือ `/_next/image` requests ตรวจภาพแล้วราคาวันย้อนหลังถูกซ่อนและราคาวันปัจจุบัน/อนาคตยังแสดง ยังไม่ได้ commit, deploy หรือรัน migration บนฐานข้อมูลออนไลน์
