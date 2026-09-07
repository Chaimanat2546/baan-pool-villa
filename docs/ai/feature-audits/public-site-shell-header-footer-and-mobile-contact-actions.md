# Public Site Shell: Header, Footer & Mobile Contact Actions

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## จุดที่ทำได้ดี

- Header, Footer และ mobile actions ใช้ shared contact settings
- tests components/layout และ site-contact-settings ผ่าน 13 test files, 54 tests

## รายการที่ควรปรับในอนาคต

1. ทำ navigation/contact map: owner, source settings และ tracking event ของทุก link/action
2. ทำ resolved public shell snapshot เพื่อลด coupling กับหลาย settings domains
3. กำหนด active-link/fallback policy สำหรับ missing/invalid/disabled links
4. ทำ mobile interaction matrix: drawer, focus, Escape, scroll lock, safe area และ keyboard
5. ทำ contact analytics contract เดียวที่มี location/context แต่ไม่ส่ง PII
6. เพิ่ม accessibility regression tests สำหรับ landmarks, icon labels, focus, contrast และ target size
7. ทำ shell performance budget สำหรับ request, prefetch และ client JS ทุก public route
8. ทำ admin preview parity และระบุ demo contact data ให้ชัด

## การตรวจสอบที่รันแล้ว

`npm.cmd test -- components/layout lib/site-contact-settings`

ผลลัพธ์: ผ่าน 13 test files, 54 tests
