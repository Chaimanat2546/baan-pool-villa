# Villa Search: รายการปรับปรุงในอนาคต

**สถานะ:** มีรายการปรับปรุง  
**Audit ล่าสุด:** 2026-09-07  
**ขอบเขต:** Search URL/query, filters, sorting, pagination, public catalog API, session restore และ search UI

เอกสารนี้บันทึกผล audit เพื่อใช้ปรับโครงสร้างภายหลัง โดยยังไม่เปลี่ยนพฤติกรรม, API หรือฐานข้อมูลในตอนนี้

## Data flow ปัจจุบัน

```text
/search
  -> app/(public)/search/page.tsx
  -> components/villas/search/
  -> /api/houses
  -> lib/villas/filters.ts + public-houses-route.ts + server.ts
```

## สิ่งที่ทำได้ดีอยู่แล้ว

- Query จาก URL ถูก normalize ทั้ง initial server render และ public API.
- Public API จำกัด page size/page number และ rate limit ก่อนโหลดข้อมูล.
- ผลค้นหาโหลดเป็นหน้า ไม่ hydrate catalog ทั้งหมด.
- มี draft filters ก่อน submit.
- ใช้ abort controller และ request sequence ป้องกัน stale response.
- เก็บ pagination state ใน session storage เพื่อ restore การกลับหน้าค้นหา.
- Targeted test ที่ตรวจใน audit ผ่าน 7 files และ 93 tests.

## สิ่งที่ควรปรับปรุง

### 1. แยก state/controller ของ Search Page

`components/villas/search/page.tsx` รวม URL sync, draft/applied state, fetch, pagination, session snapshot, error state และ render

ควรแยกเป็น:

```text
components/villas/search/
  use-villa-search-state.ts
  use-catalog-pagination.ts
  search-session-snapshot.ts
  search-results.tsx
  search-result-toolbar.tsx
```

### 2. สร้าง search query contract กลาง

Query behavior กระจายระหว่าง `filters.ts`, `page-data.ts`, `public-houses-route.ts` และ UI helpers

ควรเพิ่ม `lib/villas/search-contract.ts` เป็นเจ้าของ:

- query parse/serialize
- sort keys
- page size/page number limits
- public search response DTO

### 3. รวม pagination constants

Default page size และขอบเขต pagination มีมากกว่าหนึ่ง module

ย้าย constants ไป contract กลาง เพื่อป้องกัน server/UI เปลี่ยนไม่พร้อมกัน.

### 4. กำหนด state model ชัดเจน

Search มี initial props, browser URL, draft filters, applied filters และ session snapshot

บันทึกและ implement state flow เดียว:

```text
URL intent -> applied query -> loaded catalog pages -> draft form
```

### 5. ทำ session snapshot เป็น versioned contract

สร้าง `SearchSessionSnapshotV1` พร้อม validation, TTL/versioning และกติกาว่าเมื่อใดต้องล้าง snapshot.

### 6. แยก Search Intent จาก Catalog Page

ผลลัพธ์ที่ browser มีอาจเป็น partial catalog

สร้าง type แยกระหว่าง `SearchIntent` และ `CatalogPage` เพื่อไม่ให้ UI ตีความข้อมูลที่โหลดบางส่วนว่าเป็น catalog ครบ.

### 7. เพิ่ม mobile drawer accessibility tests

เพิ่ม test สำหรับ focus, Escape, การปิด drawer, apply/cancel และ draft sync เมื่อ URL query เปลี่ยน.

### 8. เพิ่ม end-to-end search flow

เพิ่ม browser flow:

- filter -> URL -> refresh
- back/forward
- session restore
- load more
- network request จำกัดและไม่มีผลซ้ำ

### 9. ทำ feature map

ระบุ query fields, data owner, API contract, pagination behavior, cache policy, database filtering RPC และ test files.

## สิ่งที่ไม่อยู่ในขอบเขตของเอกสารนี้

- โหลด catalog ทั้งหมดมา filter ใน browser.
- เปลี่ยน public API URL หรือ cache policy ทันที.
- เพิ่ม visible near-sea toggle โดยไม่มี product decision.

## หลักเกณฑ์ก่อนเริ่มปรับในอนาคต

- คง bounded server-side pagination และ rate limiting.
- เพิ่ม contract tests ก่อนย้าย query parser หรือ state.
- ตรวจ URL, browser navigation, mobile drawer และ network behavior.
- รัน targeted tests, lint และ build ก่อนสรุปงาน.
