# External Villa Catalog Integration

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## รายการที่ควรปรับในอนาคต

1. แยก `lib/villas/server.ts` ตาม catalog/listing, detail, search, sitemap, card projection และ upstream client
2. ทำ upstream parser/normalizer contract สำหรับ schema, nullable fields, fallback และ unknown enum
3. ทำ source-of-truth map ของ upstream, Supabase override, derived field, consumer และ cache tag
4. ทำ degraded-data policy เมื่อ detail/price/images upstream ล้มเหลว
5. ทำ refresh consistency/version model สำหรับ listing/detail/images ที่ refresh คนละเวลา
6. เพิ่ม upstream observability โดยไม่เก็บ token/body อ่อนไหว
7. ทำ sanitized upstream fixtures สำหรับ malformed/missing/pagination scenarios
8. ทำ field deprecation process สำหรับ upstream contract changes

## การตรวจสอบที่รันแล้ว

`npm.cmd test -- lib/villas/__tests__/server.test.ts lib/villas/__tests__/filters.test.ts lib/villas/__tests__/search-options.test.ts`

ผลลัพธ์: ผ่าน 2 test files, 61 tests
