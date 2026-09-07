# Admin Authentication & Session Security

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## ขอบเขตปัจจุบัน

Feature นี้กำหนดการเข้าถึง CMS และ admin API: browser อ่าน Supabase access token แล้วส่ง Bearer token; server ตรวจ claims, current user, `admin_users` state, forced password change และ `credential_version` ก่อนให้สิทธิ์. Login ใช้ Turnstile และ admin shell ตรวจ session ก่อนเปิด protected route

## จุดที่ทำได้ดี

- admin APIs ใช้ `requireHomeConfigAdmin` เป็น shared guard
- server ตรวจทั้ง `auth.getClaims(token)` และ `auth.getUser(token)` และผูก subject กับ user ปัจจุบัน
- access ต้องมี admin row เดียวที่ active, ไม่ถูกบังคับเปลี่ยน password และ credential version ตรงกันสามแหล่ง
- ไม่มี positive authorization cache หรือการ decode JWT ใน local code เพื่ออนุญาตสิทธิ์
- mutation route มี origin check ก่อนตรวจ bearer token
- login ใช้ Turnstile และ server-only secret
- session route ใช้ `private, no-store`
- tests auth, origin, Turnstile, session, login, forced password change, reset password และ change-password ผ่าน 8 test files, 92 tests

## รายการที่ควรปรับในอนาคต

### 1. ทำ authentication flow map

logic กระจายระหว่าง login form, admin shell, `home-config-auth`, forced-password flow, session route, Turnstile และ browser token helper ควรมีแผนผัง session lifecycle ตั้งแต่ login → active → forced password change → logout → token revocation

### 2. ทำ policy สำหรับ admin API route ใหม่

ควรเพิ่ม checklist หรือ test ที่บังคับว่า admin API ใหม่ต้องใช้ auth, origin check, structured errors และ `no-store` ตามชนิดข้อมูล เพื่อไม่ให้ route ใหม่หลุดมาตรฐาน

### 3. ระบุ threat model ของ browser session

browser อ่าน Supabase access token เพื่อใส่ Authorization header ควรบันทึกว่า token อยู่ที่ใด, อายุ session/refresh เป็นอย่างไร, ป้องกัน XSS อย่างไร และเงื่อนไขใดที่ควรพิจารณาย้ายไป cookie-based session

### 4. กำหนด session-expiry UX ระหว่างกำลังแก้ข้อมูล

หาก session หมดหรือ credential version เปลี่ยนขณะ admin กำลังแก้ form ควรนิยามว่าจะเก็บ draft ชั่วคราวหรือไม่, แจ้งข้อความใด และพาผู้ใช้กลับ login อย่างไรโดยไม่ทำให้เข้าใจว่า save สำเร็จ

### 5. ทำ CSRF/origin boundary เป็นเอกสารและ integration test

ระบบอนุญาต request ที่ไม่มี `Origin` แต่ต้องมี Bearer token ควรบันทึกเหตุผลและทดสอบ request จาก origin ที่ไม่อนุญาต, cross-origin form, missing origin และ localhost development ให้ชัด

### 6. ตรวจ login-abuse controls แบบ end-to-end

มี Turnstile แล้ว ควรบันทึกและทดสอบว่า login attempt, Turnstile failure/timeout, Supabase auth error และ rate limit ถูกติดตามหรือจำกัดในชั้นใด เพื่อไม่ให้มีช่องว่างระหว่าง browser, Cloudflare และ Supabase

### 7. ทบทวนขอบเขต error diagnostics

Admin API ส่ง `supabaseCode`, `details`, `hint` ให้ client ในบางกรณี ควรกำหนด allowlist ว่าข้อมูลใดปลอดภัยพอให้ admin browser เห็น และอะไรต้อง log ฝั่ง server พร้อม error id แทน

### 8. เพิ่ม security event audit log

เก็บเหตุการณ์ login สำเร็จ/ล้มเหลว, access ถูกปฏิเสธ, forced password change, credential invalidation และ logout โดยไม่เก็บ token/password เพื่อช่วยสืบปัญหาและตรวจเหตุผิดปกติ

### 9. ทำ end-to-end authorization matrix

ทดสอบ active admin, inactive admin, user ที่ไม่มี profile, forced password change, credential-version mismatch, expired token, invalid origin, missing bearer และ Turnstile unavailable ให้ครอบคลุมทุก entry point สำคัญ

## การตรวจสอบที่รันแล้ว

`npm.cmd test -- lib/admin/__tests__/home-config-auth.test.ts lib/admin/__tests__/turnstile-route.test.ts lib/admin/__tests__/request-origin.test.ts components/admin/__tests__/admin-auth.test.ts components/admin/login/__tests__/admin-login-form.test.tsx components/admin/login/__tests__/admin-forced-password-change-form.test.tsx components/admin/login/__tests__/admin-reset-password-form.test.tsx app/(admin)/api/admin/session/route.test.ts app/(admin)/api/admin/change-password/route.test.ts`

ผลลัพธ์: ผ่าน 8 test files, 92 tests
