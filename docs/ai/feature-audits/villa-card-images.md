# Villa Card Images

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## ขอบเขตปัจจุบัน

Feature นี้จัดการภาพที่ใช้บน card ของบ้าน: รูปปกที่อัปโหลดเอง, การเลือกรูปจากแกลเลอรี, ลำดับภาพ และรูปแบบ card. ภาพถูกใช้ต่อใน Home, Search, Guide และ Detail โดยส่งผ่าน same-origin proxy เพื่อไม่เปิดเผย source host ต้นทางแก่ผู้ชมสาธารณะ

## จุดที่ทำได้ดี

- ตัวเลือกรูปและการแก้ไขเป็น admin-only
- การแสดงผลสาธารณะไม่เผย source host ของ upstream image
- ลำดับการเลือกรูปมีอยู่ชัดเจน: custom image, `cover_select`, แล้วจึง outside/inside image
- มี test ครอบคลุม validation, config, upload/delete cover, image proxy และ admin flow หลัก

## รายการที่ควรปรับในอนาคต

### 1. แยกหน้าจอ admin ตามหน้าที่

`components/admin/villa-card-images/admin-villa-card-images-page.tsx` รวม style, รายชื่อบ้าน, search/pagination, ตัวเลือกรูป, upload/delete cover, dialog จัดลำดับ และการบันทึกไว้ในไฟล์เดียว ควรแยกเป็น `card-style-settings`, `house-image-list`, `house-image-editor`, `cover-upload`, `image-picker`, `image-order-dialog` และ hook `use-villa-card-image-editor` เพื่อให้แก้แต่ละ flow ได้ตรงจุด

### 2. แยก server helper ตาม domain

`lib/villas/card-image-config-admin.ts` รวมการ parse request, list บ้าน, resolve gallery, save style/config, storage history, delete และ cache revalidation ควรแยก owner เช่น `card-image-list.ts`, `card-image-config.ts`, `card-cover-assets.ts`, `card-image-route.ts`

### 3. แยกหน้าที่ใน image helper สาธารณะ

`lib/villas/images.ts` ครอบคลุมการอ่าน source image, proxy URL, URL validation, cover override และการ resolve card image ควรแยก `source-images`, `cover-overrides`, `card-display-images`, `public-image-delivery` เพื่อไม่ให้การแก้ proxy กระทบกติกาเลือกรูปโดยไม่ตั้งใจ

### 4. ทำ contract ของผลการเลือกรูปให้ชัด

กติกา fallback ของ card มีผลกับหลายหน้าสาธารณะ ควรมี type เช่น `CardImageResolution` ที่บอก image, source และเหตุผลที่เลือก พร้อม contract test ของทุกกรณี custom/cover-select/outside-inside/ไม่มีรูป

### 5. ทำ ownership map ของ style กับรูปต่อบ้าน

รูปแบบ card อยู่ใน `site_web_styles.house_card` แต่รูปต่อบ้านอยู่ใน card-image config ควรบันทึกแผนผัง field, owner, admin UI และ public consumer เพื่อป้องกันการย้ายหรือแก้ style แล้วไปทับ config รูปของแต่ละบ้าน

### 6. ป้องกันการบันทึกทับกันของผู้ดูแล

การแก้ลำดับรูป, custom images และ cover ของบ้านเดียวกันควรมี revision หรือ `updated_at` token ใน request เพื่อแจ้ง stale save แทนการให้การบันทึกครั้งหลังทับข้อมูลที่คนอื่นเพิ่งแก้

### 7. ทำ asset lifecycle ให้ตรวจสอบได้

ควรระบุวงจรของ local preview, upload storage, upload history, การผูกกับ config, rollback เมื่อ save ไม่สำเร็จ, delete และ retention เพื่อป้องกันไฟล์กำพร้าหรือ config ชี้ไปยังไฟล์ที่ลบแล้ว

### 8. ทดสอบผลลัพธ์ข้าม public consumer

เพิ่ม integration test ว่าภาพที่เลือกและลำดับเดียวกันไปถึง Home, Search, Guide และ Detail จริง รวมถึงไม่ปรากฏ upstream source host หรือ public `/_next/image` request

### 9. บันทึก cache และ route map ของ feature

ระบุ admin route, cache tag, revalidation trigger, proxy route และ public consumer ของ card image ไว้ร่วมกัน เพื่อให้การแก้ภาพหนึ่งหลังรู้ขอบเขต cache ที่เกี่ยวข้อง

## การตรวจสอบที่รันแล้ว

`npm.cmd test -- components/admin/villa-card-images lib/villas/__tests__/card-image-config-admin.test.ts lib/villas/__tests__/images.test.ts lib/villas/__tests__/cover-image-proxy.test.ts lib/villas/__tests__/image-proxy.test.ts`

ผลลัพธ์: ผ่าน 5 test files, 90 tests
