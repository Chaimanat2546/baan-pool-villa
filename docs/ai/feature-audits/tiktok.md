# TikTok Settings & Homepage Embeds: รายการปรับปรุงในอนาคต

**สถานะ:** มีรายการปรับปรุง  
**Audit ล่าสุด:** 2026-09-07  
**ขอบเขต:** Admin TikTok editor, video-to-villa link, oEmbed metadata, signed thumbnails และ lazy homepage player

เอกสารนี้บันทึกผล audit เพื่อใช้ปรับโครงสร้างภายหลัง โดยยังไม่เปลี่ยนพฤติกรรม, API หรือฐานข้อมูลในตอนนี้

## Data flow ปัจจุบัน

```text
Admin
  -> components/admin/tiktok/
  -> /api/admin/tiktok + /api/admin/tiktok/villas
  -> lib/site-settings/admin-tiktok-route.ts
  -> lib/tiktok/villa-links.ts

Public homepage
  -> components/villas/home/tiktok-*.tsx
  -> TikTok oEmbed + signed thumbnail URL
```

## สิ่งที่ทำได้ดีอยู่แล้ว

- จำกัด admin villa search และคืนเฉพาะ safe `{ id, title }`.
- Validate TikTok URL และ house ID ฝั่ง server.
- เก็บเฉพาะ URL และ optional house ID; ไม่เชื่อ browser title.
- Resolve ชื่อบ้านจาก catalog ฝั่ง server.
- Lazy-load player หลัง interaction และ thumbnail เมื่อใกล้ viewport.
- จำกัดจำนวนวิดีโอ, dedupe video ID และมี oEmbed fallback.
- มี memory/localStorage cache สำหรับ oEmbed metadata.
- Targeted test ที่ตรวจใน audit ผ่าน 9 files และ 62 tests.

## สิ่งที่ควรปรับปรุง

### 1. ย้าย shared oEmbed helper ไป domain library

Admin form import `loadTikTokClientOEmbed` จาก `components/villas/home/` แม้ helper ถูกใช้มากกว่าหนึ่ง feature

ย้ายไป `lib/tiktok/client-oembed.ts` เพื่อเป็น browser-safe external-data helper ที่มี owner ชัดเจน.

### 2. ทำ TikTok เป็น standalone domain

Types/link resolution อยู่ `lib/tiktok` แต่ persistence/admin route อยู่ `lib/site-settings`

ย้าย TikTok validation, admin route, types และ persistence orchestration ไป `lib/tiktok/`; site settings คงเป็น data source เท่านั้น.

### 3. แยก admin form ตามหน้าที่

`tiktok-form.tsx` รวม video list, drag/drop, preview, villa search, oEmbed title และ save UI

ควรแยก:

```text
components/admin/tiktok/
  tiktok-video-list.tsx
  tiktok-video-editor.tsx
  tiktok-villa-picker.tsx
  tiktok-home-preview.tsx
  use-tiktok-draft.ts
```

### 4. กำหนด signed thumbnail cache policy

oEmbed metadata cache มี TTL 24 ชั่วโมง แต่ signed thumbnail URL อาจมีอายุใช้งานต่างจาก metadata

กำหนด policy แยก metadata TTL/thumbnail usability และรองรับ refresh เมื่อ thumbnail load ล้มเหลว.

### 5. สร้าง normalized external-data contract

สร้าง `TikTokEmbedMetadata` ที่มี field allowlist, URL validation, safe failure reason และ versioned cache record.

### 6. เพิ่ม provider health status ใน admin

แสดงสถานะต่อวิดีโอ เช่น valid, thumbnail unavailable, player unavailable หรือ linked villa missing.

### 7. ป้องกัน concurrent edits

เพิ่ม revision/`updated_at` check เพื่อกัน reorder/edit ของ admin หลายคนทับกัน.

### 8. เพิ่ม end-to-end admin-to-public flow

เพิ่ม flow: add/reorder/link villa -> save -> cache refresh -> homepage แสดงลำดับ/ลิงก์ถูก, ไม่โหลด player ก่อน interaction และ thumbnail failure fallback ถูกต้อง.

### 9. ทำ feature map

ระบุ data source, public payload, provider request, cache/TTL, fallback และ owner ของแต่ละส่วน.

## สิ่งที่ไม่อยู่ในขอบเขตของเอกสารนี้

- Persist title/author ที่ browser อ่านจาก oEmbed.
- โหลด TikTok player ทุก video ตั้งแต่หน้าแรก render.
- เปลี่ยนรูปแบบ site settings table หรือ API URL ทันที.

## หลักเกณฑ์ก่อนเริ่มปรับในอนาคต

- คง server-side URL/house validation และ minimal public payload.
- ตรวจ cache/fallback ของ external provider โดยไม่ทำ request budget ของหน้าแรกแย่ลง.
- รัน targeted tests, lint, build และ browser network verification ก่อนสรุปงาน.
