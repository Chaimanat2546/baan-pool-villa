# Booking Calendar Token and Behavioral Guard

## เป้าหมาย

เพิ่มต้นทุนและตรวจจับการนำ Booking Calendar API ไปใช้ผ่าน backend proxy โดยยังให้ผู้ใช้ทั่วไปที่ไม่ล็อกอินเห็นปฏิทินได้ทันที และรักษา Edge Cache เดิมไว้

Token เป็นตัวระบุ session สำหรับการตรวจพฤติกรรม ไม่ใช่หลักฐานเด็ดขาดว่าคำขอมาจากหน้าเว็บของเรา

## ขอบเขต

- ป้องกันเฉพาะ `GET /api/villas/:id/booking-calendar`
- รองรับทั้ง configured `www.` host และ exact apex counterpart ตาม Exact Host Guard เดิม
- ใช้ร่วมกับ `X-BPV-Calendar: 1`, Host Guard และ Next.js `publicCalendar` fallback rate limit เดิม
- `baanparty` และ `baan02` ใช้ secret และ Cloudflare Rate Limiting namespace แยกกัน

## Token Flow

1. Calendar client ขอ token จาก endpoint เฉพาะ villa
2. Worker ตรวจ allowed host และ `X-BPV-Calendar: 1`
3. Worker จำกัดการออก token ไม่เกิน 20 ครั้งต่อ IP ต่อ 60 วินาที
4. Worker ออก HMAC token อายุ 5 นาที ผูกกับ villa ID, request IP, User-Agent และ expiry
5. Client ส่ง token ผ่าน `X-BPV-Calendar-Token`
6. Worker ตรวจ signature, expiry, villa ID, IP และ User-Agent ก่อนค้น Edge Cache
7. Worker จำกัด token เดียวไม่เกิน 12 ครั้งต่อ 60 วินาที และ Calendar ทั้งหมดไม่เกิน 120 ครั้งต่อ IP ต่อ 60 วินาที
8. เมื่อผ่านทุก guard แล้วจึงใช้ Calendar JSON Edge Cache และ Next.js route ตาม flow เดิม

Token endpoint และ response ที่ถูกปฏิเสธใช้ `Cache-Control: no-store` Token ห้ามอยู่ใน URL, query string, response log หรือ client persistence

## Token Format

ใช้ compact versioned token ที่มี expiry และ nonce ที่สร้างด้วย Web Crypto ส่วน HMAC input รวม:

- token version
- villa ID
- expiry
- nonce
- normalized request IP
- normalized User-Agent

Payload ที่ส่งให้ client ไม่มี IP หรือ User-Agent ดิบ ลายเซ็นใช้ HMAC-SHA-256 และตรวจด้วย Web Crypto

## Behavioral Limits

| Scope | Limit | Period |
| --- | ---: | ---: |
| Token issuance per IP | 20 | 60 seconds |
| Calendar use per token | 12 | 60 seconds |
| All Calendar requests per IP | 120 | 60 seconds |

Cloudflare Rate Limiting binding เป็น per-location counter ไม่ใช่ global exact counter ส่วน Next.js `publicCalendar` 120 requests/IP/minute ยังคงอยู่เป็น fallback หลัง Edge Cache miss/bypass

## Client Recovery

- Calendar client เก็บ token ใน memory เท่านั้น
- ใช้ token เดิมจนใกล้หมดอายุ
- เมื่อได้รับ token-expired/invalid response ให้ล้าง token ขอใหม่ และ retry Calendar request ได้หนึ่งครั้ง
- ห้าม retry ซ้ำแบบไม่จำกัด
- เมื่อได้รับ `429` ให้หยุดและเคารพ `Retry-After`
- การ dedupe และ Calendar data cache เดิมยังทำงานตามเดิม

## Error Handling

- Host/config ไม่ถูกต้อง: `404`, `no-store`
- Client marker หาย: `403`, `no-store`
- Token หาย ผิด หมดอายุ หรือ request binding ไม่ตรง: `403`, `no-store`
- Rate limit เกิน: `429`, `Retry-After: 60`, `no-store`
- Production secret หรือ required binding หาย: fail closed ด้วย `503`, `no-store`
- Local/test ใช้ dependency stub หรือ configured development secret เท่านั้น ไม่เพิ่ม production bypass

## Observability และ Privacy

- Log เฉพาะ structured rejection event: reason, villa ID, environment และ truncated one-way client identifier
- ห้าม log raw token, HMAC secret หรือ IP เต็ม
- Secret เป็น Cloudflare secret และห้ามใช้ชื่อ `NEXT_PUBLIC_*`
- Secret rotation ทำให้ token เดิมหมดผลทันที Client recovery จะขอ token ใหม่

## ข้อจำกัด

- Backend proxy ที่ตั้งใจเลียนแบบ browser ยังสามารถขอ token และ proxy response ได้
- ระบบนี้เพิ่มต้นทุน จำกัดอัตรา และสร้างสัญญาณสำหรับการบล็อก ไม่ใช่ authentication
- IP อาจเปลี่ยนเมื่อผู้ใช้สลับเครือข่าย Client ต้อง recover ด้วย token ใหม่
- Shared NAT อาจรวมผู้ใช้หลายคนไว้ที่ IP เดียว จึงเริ่มด้วยเพดานที่ผ่อนปรนและปรับหลังดู log จริง

## การทดสอบ

- HMAC token ที่ถูกต้องผ่านเฉพาะ villa, IP และ User-Agent เดิม
- Token หมดอายุ ถูกแก้ไข ข้าม villa ข้าม IP หรือข้าม User-Agent ถูกปฏิเสธ
- Token validation เกิดก่อน Calendar Edge Cache lookup
- Token endpoint และ error responses เป็น `no-store`
- Client dedupe token requests และ retry ได้สูงสุดหนึ่งครั้ง
- `429` ไม่เกิด retry loop
- Missing production secret/binding fail closed
- Worker policy tests, Calendar client tests, public route tests, full Vitest, lint และ production build ผ่าน
