# Cloudflare Edge Cache & Public Cache Policy

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## ขอบเขตปัจจุบัน

Feature นี้กำหนด public cache behavior ของ HTML, JSON และ image bytes ผ่าน Next data cache, Cloudflare Worker cache, version tokens และ cache revalidation helpers. Admin/API/private routes, download, RSC/prefetch และ cookie/query variants มี bypass rules เฉพาะ

## จุดที่ทำได้ดี

- แยก HTML, JSON, image และ private route policies
- มี explicit bypass สำหรับ admin, API, RSC/prefetch, cookie, query และ `Set-Cookie`
- cache keys รวม deployment/version groups เพื่อช่วย cut over CMS data
- version-store operations มี deadline, retry และ fallback behavior
- tests Worker cache policy, HTML version, resilience, cache policy และ revalidation ผ่าน 5 test files, 131 tests

## รายการที่ควรปรับในอนาคต

1. ทำ cache policy registry เดียว: route class, key, TTL, bypass, version groups, invalidation trigger และ verification command
2. ทำ route-to-cache map แยก HTML, JSON, image bytes, downloads, private API และ booking calendar พร้อมเหตุผล freshness/security
3. เพิ่ม drift test เปรียบเทียบ route allowlists ระหว่าง Worker, `lib/cache-policy.ts` และ revalidation helpers
4. ทำ invalidation trace ให้ทุก admin save/refresh ตอบได้ว่า tag/version group ใดถูกเปลี่ยนและข้อมูลใหม่จะปรากฏเมื่อไร
5. ทำ cache observability dashboard จาก HIT/MISS/BYPASS, route class, timeout/retry และ version-read failure โดยไม่ log cookie/query/token
6. ทำ recovery policy เมื่อ KV/R2 version store ล้มเหลวต่อเนื่อง เช่น alert threshold, fallback duration และ post-recovery check
7. ทดสอบ production cache matrix สำหรับ HTML, RSC/prefetch, cookie/query, admin/API, card manifest, image proxy และ download
8. แยก active cache rules ออกจาก historical notes ในเอกสาร เพื่อไม่ให้แก้ตาม behavior ที่หมดอายุ

## การตรวจสอบที่รันแล้ว

`npm.cmd test -- worker-cache-policy.test.ts worker-html-cache-version.test.ts worker-cache-resilience.test.ts lib/__tests__/cache-policy.test.ts lib/cache-revalidation.test.ts`

ผลลัพธ์: ผ่าน 5 test files, 131 tests
