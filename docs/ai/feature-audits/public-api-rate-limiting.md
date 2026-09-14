# Public API Rate Limiting

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## รายการที่ควรปรับในอนาคต

1. ย้าย rate limit จาก in-memory ไป distributed store สำหรับ production multi-instance
2. ทำ policy registry ระบุ route/action, key, limit, window, burst และ response behavior
3. แยก key ตามความเสี่ยง: IP, actor, villa id หรือ booking code โดยไม่เก็บ PII ดิบ
4. ทำ observability สำหรับ 429, bucket pressure, bypass และ client-IP missing
5. กำหนด trusted proxy/IP policy เพื่อป้องกัน spoofed forwarding headers
6. ทำ abuse-response plan เช่น captcha escalation, temporary block และ alert threshold
7. ทดสอบ cross-instance, clock boundary, bucket cleanup, IPv6 และ Cloudflare header variants
8. ทำ API error contract กลางสำหรับ retry-after, safe error code และ client UX

## การตรวจสอบที่รันแล้ว

`npm.cmd test -- lib/api/__tests__/rate-limit.test.ts lib/api/__tests__/errors.test.ts`

ผลลัพธ์: ผ่าน 15 tests
