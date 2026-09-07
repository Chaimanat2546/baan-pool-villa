# Admin Password Security

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## รายการที่ควรปรับในอนาคต

1. ทำ password lifecycle map: temporary password, first login, forced change, reset, reissue, credential bump และ sign-out
2. กำหนด recovery UX สำหรับ reset link หมดอายุ, email ไม่ถึง, session invalid และ provider failure
3. ทำ security event audit โดยไม่เก็บ password/token
4. ระบุ rate limit, verification, enumeration prevention และ alert threshold ของ password flows
5. ทำ security-copy contract ที่ไม่เปิดเผยการมีอยู่ของบัญชี
6. ทำ E2E matrix: expired/reused link, forced password, suspended user, mismatch, simultaneous reset และ global sign-out
7. ทำ owner boundary ระหว่าง Supabase Auth, `admin_users`, forced-password service, Central User Manager และ browser UI

## การตรวจสอบที่รันแล้ว

`npm.cmd test -- lib/admin/__tests__/forced-password-change.test.ts components/admin/settings/__tests__/admin-password-security-card.test.tsx app/(admin)/api/admin/change-password/route.test.ts`

ผลลัพธ์: ผ่าน 3 test files, 58 tests
