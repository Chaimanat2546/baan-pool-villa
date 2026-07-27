# Private Booking Calendar API and Server Preload

## เป้าหมาย

ให้ผู้ใช้ทั่วไปที่ไม่ได้ล็อกอินเห็นปฏิทินทันทีและเปลี่ยนเดือนได้โดยไม่เรียก Calendar API จาก Browser ขณะเดียวกันยังเก็บ API ไว้สำหรับ backend ที่เราอนุญาต โดยทุกคำขอต้องมี Bearer token ลับที่อยู่ฝั่ง Server เท่านั้น

แนวทางนี้ลดการนำ Calendar API ไปฝังบนเว็บอื่นโดยตรง แต่ไม่ได้ทำให้ข้อมูลที่แสดงต่อสาธารณะเป็นความลับ ผู้ที่ตั้งใจ scrape ยังอ่านข้อมูล 14 เดือนจาก HTML/RSC ของหน้าวิลล่าได้

## ขอบเขต

- หน้า `/villas/:id` แสดงเดือนก่อนหน้าหนึ่งเดือน เดือนปัจจุบัน และ 12 เดือนถัดไป รวม 14 เดือน
- Browser ไม่เรียก `/api/villas/:id/booking-calendar` และไม่ขอ token ชั่วคราว
- คง `GET /api/villas/:id/booking-calendar` ไว้เป็น Private API
- Private API รับเฉพาะ `Authorization: Bearer <CALENDAR_INTERNAL_API_TOKEN>`
- รองรับ `month=YYYY-MM` และ `months=1..14` โดยค่าเริ่มต้น `months=1`
- ลด Cloudflare Edge Cache ของ HTML หน้าวิลล่าจาก 24 ชั่วโมงเป็น 15 นาที
- ใช้ shared booking-calendar loader และกฎ priority เดิม รวมถึง `hot_holidays` ที่สำคัญกว่า `holidays`
- ไม่เปลี่ยน `PATTAYA_BOOKINGS_API_TOKEN` เพราะเป็น credential สำหรับ upstream API คนละหน้าที่

## สถาปัตยกรรม

### 1. Server preload สำหรับหน้าวิลล่า

Route page ของวิลล่าคำนวณช่วงเดือนตามเวลา `Asia/Bangkok` แล้วเรียก shared booking-calendar loader โดยตรง ไม่ self-fetch ผ่าน HTTP และไม่ใช้ Private API ภายในหน้าเดียวกัน

การโหลด 14 เดือนใช้ helper ฝั่ง Server ที่คืนค่า:

- calendar ที่โหลดสำเร็จ แยกตาม `YYYY-MM`
- รายชื่อเดือนที่โหลดไม่สำเร็จ

ใช้ผลลัพธ์แบบแยกเดือนเพื่อไม่ให้ upstream error เพียงเดือนเดียวทำให้ทั้งหน้าวิลล่าล้ม ข้อมูลถูกส่งเป็น initial props ไปยัง Calendar client component เพียงครั้งเดียว

### 2. Calendar client

Calendar client อ่านข้อมูล 14 เดือนจาก initial props และเปลี่ยนเดือนได้จาก state ใน Browser โดยไม่มี `fetch`, token endpoint, retry หรือ client calendar cache

ถ้าเดือนไหนไม่มีข้อมูล:

- ปุ่มวันที่ของเดือนนั้นถูก disable
- UI ยังแสดงโครงปฏิทินและ fallback price ตามพฤติกรรมเดิม
- ไม่ยิง request เพิ่มอัตโนมัติ

ช่วง navigation ยังคงจำกัดที่เดือนก่อนหน้าหนึ่งเดือนถึง 12 เดือนข้างหน้า

### 3. Private Calendar API

Route เดิมยังคงเป็น:

```http
GET /api/villas/1981/booking-calendar?month=2026-07&months=14
Authorization: Bearer <CALENDAR_INTERNAL_API_TOKEN>
```

ลำดับตรวจสอบ:

1. Exact Host Guard อนุญาตเฉพาะ configured `www` host และ apex counterpart
2. ตรวจรูปแบบ `Authorization` และเปรียบเทียบ Bearer token แบบ timing-safe
3. ใช้ rate limit แยกตาม IP ที่ 60 requests ต่อนาที
4. ตรวจ villa ID, `month` และ `months`
5. เรียก shared booking-calendar loader

ทั้ง Worker guard และ Next route ตรวจ Bearer token เพื่อให้ Worker ปฏิเสธก่อนเข้า OpenNext และให้ Route Handler ปลอดภัยแม้ถูกเรียกโดยไม่ผ่าน guard ตามปกติ

API response และทุก error response ใช้ `Cache-Control: private, no-store` ไม่เก็บ Authorization response ใน Edge Cache ส่วน shared data loader ยังคงใช้ booking-calendar data cache ตาม policy เดิม

## Secret และการตั้งค่า

- ใช้ชื่อ `CALENDAR_INTERNAL_API_TOKEN`
- เป็น Cloudflare secret แยกค่าระหว่าง `baanparty` และ `baan02`
- ห้ามใส่ใน `NEXT_PUBLIC_*`, source code, URL, log หรือ response
- backend consumer เก็บ token ใน secret/environment ฝั่ง Server และส่งผ่าน `Authorization` header เท่านั้น
- การ rotate token ทำให้ consumer ที่ยังใช้ค่าเก่าได้รับ `401` จนกว่าจะอัปเดต

ก่อน deploy โค้ดใหม่ต้องตั้ง `CALENDAR_INTERNAL_API_TOKEN` ให้ environment เป้าหมายก่อน หลังยืนยันว่าโค้ดใหม่ทำงานแล้วจึงลบ `CALENDAR_ACCESS_SECRET` และ binding ที่ใช้เฉพาะ token ชั่วคราวได้

## Cache

- HTML ของ `/villas/:id`: Cloudflare Edge Cache 15 นาที
- Browser HTML cache policy: คงพฤติกรรมปัจจุบัน
- Private Calendar API response: `private, no-store`
- Booking-calendar shared data: คง cache policy ที่ owner ปัจจุบันกำหนด

HTML Edge Cache เพิ่มความล่าช้าได้อีกสูงสุดประมาณ 15 นาที โดย shared data cache เดิมมีอายุ 15 นาทีแยกอีกชั้นหนึ่ง ดังนั้นกรณีขอบเขตเวลาไม่ตรงกัน ข้อมูลที่ผู้ใช้เห็นอาจช้ากว่าต้นทางได้สูงสุดโดยประมาณ 30 นาที แม้ HTML ของหน้าจะมีอายุไม่เกิน 15 นาที

## Error Handling

| กรณี | ผลลัพธ์ |
| --- | --- |
| Secret ฝั่ง production หาย | `503`, fail closed, `no-store` |
| ไม่มี Bearer หรือ Bearer ผิด | `401`, `WWW-Authenticate: Bearer`, `no-store` |
| Host ไม่ตรง | `404`, `no-store` |
| เกิน 60 requests/IP/minute | `429`, `Retry-After: 60`, `no-store` |
| villa ID หรือ query ผิด | `400`, `no-store` |
| upstream ล้มใน Private API | structured `5xx`, `no-store` |
| บางเดือนล้มระหว่าง preload หน้า | หน้าโหลดต่อและ disable เฉพาะเดือนที่ไม่มีข้อมูล |

ห้าม log token เต็ม ค่า secret หรือ Authorization header สามารถ log ได้เฉพาะ reason, villa ID, environment และ client identifier แบบ one-way/truncated ตามแนวทางเดิม

## สิ่งที่นำออก

- `POST /api/villas/:id/booking-calendar-token`
- HMAC token อายุห้านาที
- `X-BPV-Calendar-Token`
- `X-BPV-Calendar` browser marker
- token issuance limit และ per-token rate limit
- client token memory cache, refresh และ retry
- Browser calendar fetch/cache

Rate limit แยก IP สำหรับ Private API ยังคงอยู่เป็น defense in depth แต่ไม่กระทบผู้ใช้หน้าเว็บ เพราะหน้าเว็บไม่ได้เรียก API นี้แล้ว

## การทดสอบและหลักฐานยืนยัน

### Unit และ route tests

- Server preload สร้างเดือนครบ 14 เดือนตาม `Asia/Bangkok`
- เดือนที่ล้มหนึ่งเดือนไม่ทำให้ผลลัพธ์เดือนอื่นหาย
- Calendar client ใช้ initial data และไม่มี `fetch`
- Bearer ถูกต้องผ่าน; token หาย ผิด หรือ secret หายถูกปฏิเสธตาม status ที่กำหนด
- query ยอมรับ `months=1..14` และปฏิเสธค่าที่อยู่นอกช่วง
- rate limit เป็น 60 requests/IP/minute
- `hot_holidays` ยังคง override `holidays`
- Villa HTML Edge Cache เท่ากับ 15 นาที
- Private API ไม่ถูกเก็บใน JSON Edge Cache

### Integration verification

- รัน targeted Vitest สำหรับ booking calendar, public routes, Worker guard/cache และ villa detail
- รัน full Vitest, ESLint และ production build
- ทำ production browser network check บนหน้าวิลล่าทั้ง mobile และ desktop:
  - ไม่มี request ไป `booking-calendar` หรือ `booking-calendar-token`
  - ไม่มี `_rsc` request ที่ไม่คาดหมาย
  - ไม่มี public `/_next/image` request
  - จำนวน route/API request มีขอบเขตแน่นอน
- ตรวจ page source/RSC payload ว่ามีข้อมูลที่ UI ต้องใช้ครบ 14 เดือน
- เรียก Private API โดยไม่มี Bearer ต้องได้ `401`; Bearer ถูกต้องต้องได้ calendar response

## เกณฑ์สำเร็จ

1. ผู้ใช้ไม่ล็อกอินเปิดหน้าวิลล่าแล้วเห็นปฏิทินทันที
2. เปลี่ยนได้ครบ 14 เดือนโดย Browser ไม่ยิง Calendar API
3. Private API ใช้งานได้เฉพาะเมื่อมี Bearer secret ถูกต้อง
4. Secret ไม่ปรากฏใน client bundle, HTML, RSC, URL หรือ log
5. หน้า cache ไม่เกิน 15 นาที และเดือนไหนโหลดพลาดไม่ทำให้ทั้งหน้าล้ม
6. เอกสาร deploy และ `docs/ai/structure.html` ตรงกับระบบใหม่
