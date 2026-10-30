# Villa Availability & Calendar

ตรวจเมื่อ: 2026-09-07; อัปเดต validation และ diagnostics: 2026-10-30
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

ปรับแล้ว: UI ตรวจว่ามีข้อมูลของเดือนที่แสดงหรือไม่ หากไม่มีจะแสดง “โหลดข้อมูลปฏิทินเดือนนี้ไม่สำเร็จ” และ “ยังยืนยันวันว่างไม่ได้” พร้อมปุ่มโหลดหน้าใหม่ วันที่ยังถูกปิดเลือกและซ่อนคำอธิบายสีสถานะจนกว่าจะมีข้อมูล โดยใช้ contract เดิม ไม่ต้องส่ง `unavailableMonths` เพิ่มผ่าน component หลายชั้น

### 2. ทำ date model กลางตามเวลา Bangkok

Server ใช้ `Asia/Bangkok` เพื่อสร้าง month key แต่ client ใช้ `new Date()` ตาม timezone ของเครื่องผู้ชม ควรมี helper หรือ contract เดียวสำหรับวันนี้, month key และ day key เพื่อไม่ให้การแสดงผลคลาดเคลื่อนใกล้เที่ยงคืนหรือเมื่อผู้ชมอยู่คนละ timezone

### 3. ทำ upstream contract และกติกาทับซ้อนให้เป็นทางการ

เพิ่ม runtime validation ที่ network boundary แล้วใน `booking-calendar-validation.ts`: ต้องมี event arrays ครบ, ราคาวันทั้งเจ็ดเป็นตัวเลขไม่ติดลบหรือ null และมีตัวเลขอย่างน้อยหนึ่งวัน, วันที่และช่วงวันที่ถูกต้อง, optional metadata มีชนิดข้อมูลตาม contract ไม่แปลงตัวเลขแบบ string ให้อัตโนมัติ และไม่ข้าม booking ที่ผิดรูปแบบจนกลายเป็นวันว่าง หากตรวจไม่ผ่านจะใช้ `unavailable` ทั้งเดือน กติกา priority ของ normalization และ permissive fixtures ของ pure helper ยังเหมือนเดิม ส่วนการตั้งชื่อ priority และสรุป business contract เรื่องช่วงวันยังเป็นงานถัดไป

### 4. กำหนด request budget ของการ preload

อนุมัติเพิ่มเพดานวันที่ 2026-10-30: เดือนเริ่มต้นที่ปฏิทินแสดงตาม `Asia/Bangkok` โหลดได้รวมสูงสุด 4 ครั้ง (ครั้งแรก + retry อีกไม่เกิน 3 ครั้ง) โดยลองต่อเฉพาะเมื่อครั้งล่าสุด timeout และหยุดทันทีเมื่อสำเร็จหรือเป็น error ชนิดอื่น เปิด Detail ยัง preload 14 เดือนเหมือนเดิม รวมจึงสูงสุด 17 attempts ต่อ document แต่ละ attempt จำกัด 8 วินาที กรณี timeout ทั้ง 4 ครั้งอาจรอประมาณ 32 วินาทีบวก overhead ก่อนแสดงข้อมูลไม่พร้อม เดือนอื่นไม่ retry และไม่มี browser calendar request เพิ่ม การจำกัด concurrency ของ 14 เดือนแรกยังเป็นงานถัดไป

### 5. เพิ่ม observability ของ upstream calendar

เพิ่ม log ฝั่ง server และติดตาม retry ที่อนุมัติแล้ว โดย cache และ timeout ต่อ attempt ยังเหมือนเดิม:

- `booking_calendar_fetch_failed`: `loadId`, property id ที่ผ่าน allowlist ตัวเลข, เดือน, `attempt: 1|2|3|4`, `httpStatus`, `durationMs`, `invalidField` และ `reason` ซึ่งเป็น `missing_token`, `http_error`, `timeout`, `network_error`, `invalid_json`, `invalid_payload` หรือ `normalization_error`
- `booking_calendar_preload`: หนึ่ง summary ต่อการโหลดหน้า พร้อม `loadId` เดียวกับ failure logs, จำนวนเดือนที่ขอ/โหลดสำเร็จ, `retryCount: 0..3`, `fetchAttemptCount: 14..17`, `unavailableMonths`, `currentMonth`, `currentMonthAvailable` และเวลารวม
- ไม่บันทึก token, request/response body, URL, exception message หรือข้อมูลภายในรายการจอง

วิธีไล่อาการต้องรีเฟรช: ใน Cloudflare Worker Logs กรอง event ข้างต้นและ property id ของบ้าน แล้วเทียบ `loadId` ของการเปิดครั้งแรกกับหลัง refresh อ่าน preload summary สุดท้ายก่อน: `retryCount>0` พร้อม `currentMonthAvailable=true` หมายถึงฟื้นข้อมูลสำเร็จแล้ว แม้จะมี timeout warning ของ `attempt: 1` หาก `currentMonthAvailable=false` ให้ดู failure ที่มี `loadId` เดียวกันและ `attempt`; `http_error` พร้อม 429 ชี้ไปที่ rate limit, `timeout` คือเกิน 8 วินาที, `invalid_json` คือ parse ไม่ผ่าน และ `invalid_payload` ให้ดูชื่อกลุ่มข้อมูลใน `invalidField` หากข้อมูลครบทั้งสองครั้งแต่หน้าว่าง ให้ตรวจ client render ต่อ หากการเปิดครั้งแรกไม่มี summary แต่ refresh มี ให้ตรวจเวอร์ชัน deploy และการเสิร์ฟหน้า cache เพิ่ม อย่าสรุปสาเหตุจากภาพอย่างเดียว

### 6. ตั้งชื่อ private API ให้สื่อ boundary

`public-booking-calendar-route.ts` และ policy `publicCalendar` เป็น endpoint สำหรับ server consumer ที่ต้องใช้ Bearer token ควรเปลี่ยนชื่อ หรือบันทึก boundary นี้ให้เด่นชัด เพื่อลดโอกาสที่ผู้แก้โค้ดภายหลังจะนำไปเรียกจาก browser

### 7. เก็บ context วันที่เลือกไปกับ contact analytics

เมื่อผู้ชมเลือกวันแล้วกด LINE, Messenger หรือโทร ควรส่ง villa id, วันที่เลือก, สถานะ และราคาไปกับ event หรือข้อความเริ่มต้น เพื่อวัด conversion และช่วยแอดมินรู้ช่วงวันที่ลูกค้าสนใจ

### 8. ทำ calendar flow map

บันทึกเส้นทาง `Detail server → preload → normalization → client calendar → contact` พร้อม env token, timeout, cache policy และ failure states ไว้ในเอกสารเดียว เพื่อให้แก้ feature โดยไม่กระทบความปลอดภัยหรือความสดของวันว่าง

## การตรวจสอบที่รันแล้ว

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
