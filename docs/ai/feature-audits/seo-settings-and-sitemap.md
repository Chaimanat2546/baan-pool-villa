# SEO Settings & Sitemap

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## ขอบเขตปัจจุบัน

Feature นี้จัดการ SEO templates ใน `site_seo_settings`, metadata/OG image, JSON-LD และ `/sitemap.xml`. Sitemap รวม static, villa, guide และ legal URLs; guide/legal CMS ที่ล้มเหลวให้ sitemap แบบ partial ได้ ขณะที่ villa source failure ทำให้ route ล้มเหลวตามตั้งใจ

## จุดที่ทำได้ดี

- มี SEO data domain, metadata helper และ JSON-LD helper แยกชัดเจน
- metadata ใช้ site settings เป็น fallback และสร้าง absolute image URLs
- sitemap กำหนด 24-hour route cache และใช้ source-specific cached reads
- sitemap ใช้ `lastModified` เฉพาะ Guide/Legal ที่มี timestamp จากแหล่งเชื่อถือได้
- test SEO, JSON-LD, SEO rows/server, sitemap และ admin editor ผ่าน 6 test files, 36 tests

## รายการที่ควรปรับในอนาคต

### 1. ทำ SEO ownership map

ระบุว่าแต่ละ route ใช้ template ไหน, fallback ไป global ที่ใด, ใช้ OG image ไหน, สร้าง JSON-LD ประเภทใด และอยู่ใน sitemap หรือไม่ เพื่อป้องกันการเพิ่มหน้าใหม่แล้วตกหล่น

### 2. วางแผนเลิก legacy projection

`site-seo-settings/rows.ts` ยังแปลง SEO rows กลับเป็น field แบบเดิมใน `site_settings` ควรบันทึกว่า compatibility นี้จำเป็นถึงเมื่อไร และ migration/remove plan เพื่อไม่ให้สอง model ค่อย ๆ diverge

### 3. รวม page-type registry

ตอนเพิ่ม SEO page type ต้องแก้ array, row mapping, persistence, admin editor, metadata consumer และ tests หลายจุด ควรมี registry กลางที่บอก page type, fields, route consumer และ default/fallback

### 4. เพิ่ม preview ที่ตรงผลจริง

Admin ควรเห็นตัวอย่าง title, meta description, Google snippet, Open Graph และ social share จาก draft เดียวกัน รวมถึงสถานะความยาว/ภาพที่ขาด ก่อนกด save

### 5. ทำ concurrent-save protection

SEO rows เป็น global content; admin หลายคนบันทึกพร้อมกันอาจทับกัน ควรใช้ revision หรือ `updated_at` token พร้อม stale draft message

### 6. ทำ sitemap observability

Guides/Legal CMS ล้มเหลวแล้ว sitemap จะ fallback เป็น partial ได้ตามตั้งใจ ควรมี log, metric หรือ health check เพื่อให้รู้ว่า sitemap ขาด URL โดยไม่ได้ตั้งใจ

### 7. ทดสอบ canonical/indexability แบบ production

เพิ่ม smoke test สำหรับ canonical URL, robots, OG image absolute URL, JSON-LD parse, sitemap XML และตรวจว่าทุก sitemap URL ตอบ 200/ไม่ redirect chain

### 8. ทำ policy ของ `lastModified`

บันทึกแหล่งข้อมูลที่อนุญาตให้ใช้และเงื่อนไขห้ามใส่ `lastModified` เพื่อไม่ส่งสัญญาณผิดให้ crawler

### 9. ทำ SEO change/cache map

ระบุ `admin save → site_seo_settings → cache tag/edge version → generateMetadata/sitemap` เพื่อให้รู้ผลของการแก้ title, OG image หรือ keywords ในแต่ละ route

## การตรวจสอบที่รันแล้ว

`npm.cmd test -- lib/__tests__/seo.test.ts lib/__tests__/json-ld.test.ts lib/site-seo-settings app/sitemap.test.ts components/admin/settings/__tests__/seo-settings-page.test.tsx`

ผลลัพธ์: ผ่าน 6 test files, 36 tests
