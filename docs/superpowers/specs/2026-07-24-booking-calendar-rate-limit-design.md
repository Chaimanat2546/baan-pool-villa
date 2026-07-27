# Booking Calendar API Rate Limit

## เป้าหมาย

จำกัดการเรียก `GET /api/villas/:id/booking-calendar` แยกตาม IP โดยไม่กระทบ API รายละเอียดบ้านหรือ API สาธารณะอื่น และยังให้ผู้ใช้ทั่วไปที่ไม่ล็อกอินเปิดปฏิทินได้ตามเดิม

## การออกแบบ

- เพิ่ม policy `publicCalendar` ใน shared public API rate limiter
- กำหนด `120` requests ต่อ `60` วินาที
- ใช้ `CF-Connecting-IP` เป็น client key ตามพฤติกรรมปัจจุบันของระบบ
- ใช้ bucket เดียวต่อ IP สำหรับ Calendar API ทุก villa และทุก month เพื่อป้องกันการเลี่ยงเพดานด้วยการเปลี่ยน URL
- เรียก rate limiter ใน booking-calendar route ก่อน validation และก่อนเรียก upstream booking API
- เมื่อเกินเพดาน ตอบ `429 Too Many Requests` พร้อม `Retry-After`, `retryAfterSeconds` และ `Cache-Control: no-store`
- ไม่เปลี่ยน policy `publicDetail` และไม่กระทบ API อื่น

## ข้อจำกัด

ตัวนับปัจจุบันเก็บใน memory ของแต่ละ runtime instance จึงเป็นการป้องกันเบื้องต้น ไม่ใช่ global counter ที่แม่นยำข้ามทุก Cloudflare instance หากต้องการความแม่นยำระดับระบบรวมในอนาคต ควรย้ายไปใช้ Cloudflare Rate Limiting

## การทดสอบ

- ยืนยันว่า 120 requests แรกผ่าน Rate Limit
- request ที่ 121 ได้ `429`
- ยืนยันว่า request ที่ถูกบล็อกไม่เรียก upstream booking API
- ยืนยันว่า Calendar ใช้ policy แยกจาก `publicDetail`
- รัน targeted tests ของ shared API rate limiter และ public villa routes
- รัน lint และ production build
