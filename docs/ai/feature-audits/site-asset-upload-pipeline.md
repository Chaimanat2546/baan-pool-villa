# Site Asset Upload Pipeline

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## รายการที่ควรปรับในอนาคต

1. ทำ asset lifecycle map: preview → upload → conversion → storage → history → proxy → replacement/delete/retention
2. ทำ asset-type registry: MIME, extension, size, dimensions, conversion, retention, consumer และ cache impact
3. ป้องกัน concurrent upload ด้วย revision token และ cleanup ของไฟล์ที่แพ้ race
4. ทำ conservative orphan cleanup job พร้อม audit log
5. ทำ image safety policy: EXIF, orientation, decompression limit, animation และ server MIME sniffing
6. ทำ public asset proxy contract: transforms, cache, fallback, privacy และ invalidation
7. เพิ่ม upload observability: type, size bucket, conversion time, storage/cleanup outcome
8. ทำ E2E upload → save → public render → cache refresh → replace/delete รวม failure paths

## การตรวจสอบที่รันแล้ว

`npm.cmd test -- lib/site-settings/__tests__/asset-proxy.test.ts lib/site-settings/__tests__/admin-assets-route.test.ts lib/site-settings/__tests__/validation.test.ts`

ผลลัพธ์: ผ่าน 2 test files, 31 tests
