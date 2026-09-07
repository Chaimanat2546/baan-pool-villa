# Marketing Tags & Google Tag Manager

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## ขอบเขตปัจจุบัน

Feature นี้เก็บ GTM settings, โหลด public GTM หลัง interaction และส่ง DataLayer event สำหรับ villa view/contact

## รายการที่ควรปรับในอนาคต

1. ทำ tracking plan กลาง: event, trigger, payload, consent, owner และปลายทาง
2. ทำ consent/cookie policy และ behavior เมื่อผู้ใช้ปฏิเสธ
3. ทำ typed event schema/versioning พร้อม regression tests
4. เพิ่ม admin preview/debug mode ก่อน publish GTM ID
5. ทำ audit log การเปลี่ยน GTM ID โดยปิดบางส่วนของค่า
6. แยก product analytics contract ออกจาก vendor-specific GTM tags
7. ทำ production network test: โหลดหลัง trigger, event ครั้งเดียว และไม่ส่ง PII/ไม่โหลดบน admin

## การตรวจสอบที่รันแล้ว

`lib/__tests__/marketing-data-layer.test.ts` ผ่าน 4 tests

หมายเหตุ: test paths อื่นที่ระบุเดิมไม่พบใน workspace ปัจจุบัน จึงต้องจัดทำ test map ของ feature นี้เพิ่มเติม
