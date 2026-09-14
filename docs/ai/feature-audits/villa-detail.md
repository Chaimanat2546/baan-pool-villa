# Villa Detail: รายการปรับปรุงในอนาคต

**สถานะ:** มีรายการปรับปรุง  
**Audit ล่าสุด:** 2026-09-07  
**ขอบเขต:** หน้ารายละเอียดบ้าน `/villas/:id`, ข้อมูลบ้าน, รูปภาพ, ปฏิทินจอง, detail layout และข้อมูลประกอบ

เอกสารนี้บันทึกผล audit เพื่อใช้ปรับโครงสร้างภายหลัง โดยยังไม่เปลี่ยนพฤติกรรม, API หรือฐานข้อมูลในตอนนี้

## Data flow ปัจจุบัน

```text
/villas/:id
  -> app/(public)/villas/[id]/page.tsx
  -> components/villas/detail/
  -> lib/villas/, lib/detail-layout/, lib/advertisements/
  -> Supabase + external villa/booking APIs
```

ไฟล์เริ่มต้นที่เกี่ยวข้อง:

- `app/(public)/villas/[id]/page.tsx`
- `components/villas/detail/page.tsx`
- `components/villas/detail/detail-client-shell.tsx`
- `components/villas/detail/detail-layout-renderer.tsx`
- `lib/villas/server.ts`
- `lib/villas/detail.ts`
- `lib/villas/images.ts`
- `lib/villas/booking-calendar.ts`
- `lib/detail-layout/`

## สิ่งที่ทำได้ดีอยู่แล้ว

- Route หลักรับผิดชอบ metadata, server data loading, JSON-LD และส่ง props ให้ UI.
- UI แยกตามงานหลักแล้ว เช่น gallery, booking calendar, sidebar, layout renderer และ advertisements.
- Gallery modal โหลดแบบ dynamic และ lower detail blocks ใช้ deferred rendering.
- Logic ปฏิทิน, รูปภาพ, รายละเอียดบ้าน และ CMS layout แยกเป็น module.
- มี fallback เมื่อ external detail API หรือ gallery load ล้มเหลว.
- Targeted test ที่ตรวจใน audit ผ่าน 25 files และ 223 tests.

## สิ่งที่ควรปรับปรุง

### 1. จัดกลุ่ม component ตาม sub-feature

`components/villas/detail/` มีไฟล์ระดับเดียวจำนวนมากจากหลาย sub-feature ทำให้ต้องค้นหลายไฟล์เมื่อแก้หน้า detail

ควรจัดเป็นกลุ่ม เช่น:

```text
components/villas/detail/
  gallery/
  booking/
  layout/
  content/
  shared/
  page.tsx
  detail-client-shell.tsx
```

เป้าหมาย: ชื่อ path บอกขอบเขตงานชัด และ import/ownership ของแต่ละส่วนหาได้ง่ายขึ้น.

### 2. แยก data use case ใน `lib/villas/server.ts`

ไฟล์นี้รวมการอ่าน listing, search, card options, sitemap และ detail page data ไว้ด้วยกัน แม้แต่ละส่วนมีผู้ใช้และเหตุผลในการเปลี่ยนต่างกัน

ควรแยกตาม use case เช่น:

```text
lib/villas/
  listings.ts
  search.ts
  card-options.ts
  sitemap.ts
  detail-page-data.ts
```

Cache และ query helper ควรอยู่ใกล้ use case ที่ใช้งาน เพื่อให้ตาม data flow ได้จากชื่อไฟล์.

### 3. แยก renderer ตาม layout version

`detail-layout-renderer.tsx` มี rendering flow ของ layout V1 และ V2 อยู่ร่วมกัน

ควรแยกเป็น module เช่น:

```text
components/villas/detail/layout/
  detail-layout-renderer.tsx
  render-v1-layout.tsx
  render-v2-layout.tsx
```

Renderer หลักควรรับผิดชอบเลือก version และประกอบ props ส่วน version-specific rendering อยู่ในไฟล์ของตัวเอง.

### 4. ทำ feature map ของ Villa Detail

Villa Detail ใช้หลาย data source: listing, external detail API, gallery, calendar, site settings, contact settings, web styles, CMS layout และ advertisements

ควรมี feature map ระบุ:

- source และ fallback ของข้อมูลแต่ละชนิด
- cache tag/cache duration ที่เกี่ยวข้อง
- public/private API endpoint และ consumer
- component ที่ render ข้อมูลนั้น
- test file ที่คุ้มครอง flow

### 5. ทำ API map สำหรับ `/api/villas/[id]`

Endpoint detail, images, proxy, download และ booking calendar มีขอบเขตต่างกัน แต่ไม่เห็นจาก folder tree อย่างเดียวว่า endpoint ใด public/private หรือใช้ cache แบบใด

ควรบันทึก API map ที่ระบุ method, access level, cache policy, input validation และ consumer ของแต่ละ endpoint.

### 6. เพิ่ม route-level integration tests

ปัจจุบันมี unit/component tests จำนวนมากแล้ว ควรเพิ่ม test ระดับ route/page composition เพื่อยืนยันการรวมข้อมูลทั้งหมดของ `/villas/:id`

กรณีที่ควรครอบคลุม:

- external detail API ล้มเหลวและใช้ fallback
- gallery load ล้มเหลวแต่หน้า detail ยัง render
- calendar preload ล้มเหลวและ fallback state ถูกต้อง
- detail layout ปิด advertisements แล้วไม่มี data request ที่ไม่จำเป็น
- metadata fallback สำหรับบ้านที่ไม่พบ

### 7. แยก guest reviews ออกจาก review videos

Detail layout ปัจจุบันมี block `review_videos` ซึ่งเป็นวิดีโอรีวิว ไม่ควรนำมาใช้ปนกับระบบรีวิวดาว/คอมเมนต์ของผู้เข้าพัก

เมื่อเพิ่มระบบรีวิวรายบ้าน ให้สร้าง block ใหม่ เช่น `guest_reviews` และให้ data/validation/persistence อยู่ใน `lib/villa-reviews` โดย UI อยู่ใน `components/villas/detail/reviews`.

## สิ่งที่ไม่อยู่ในขอบเขตของเอกสารนี้

- การออกแบบหรือ implement ระบบรีวิวดาว/คอมเมนต์จริง
- การเปลี่ยน API URL, cache policy หรือฐานข้อมูลทันที
- การยกเลิก fallback ของ external APIs

## หลักเกณฑ์ก่อนเริ่มปรับในอนาคต

- คง behavior, SEO, JSON-LD, cache และ public API contract เดิม เว้นแต่มีการอนุมัติเปลี่ยนชัดเจน.
- ย้าย module พร้อมปรับ imports และ targeted tests ในรอบเดียวกัน.
- ตรวจทั้ง desktop/mobile และ production network behavior เมื่อเปลี่ยน public detail UI, image delivery หรือ cache.
- รัน lint, targeted tests และ build ก่อนสรุปงาน.
