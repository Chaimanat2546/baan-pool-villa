# Villa Gallery & Lightbox

ตรวจเมื่อ: 2026-09-07  
สถานะ: มีรายการปรับปรุง

## รายการที่ควรปรับในอนาคต

1. ทำ gallery state model กลางสำหรับ active image, category, mode, return target และ failed images
2. ทำ gallery data contract: source, cover visibility, category, standard/system, download eligibility และ fallback
3. ทดสอบ modal accessibility: focus trap, Escape, return focus, keyboard navigation และ scroll lock
4. ทำ mobile media matrix: swipe, thumbnail scroll, safe area, landscape, slow network และ orientation
5. กำหนด image-failure policy: placeholder/skip/recover โดยไม่ทำ state หมวดเสีย
6. ทำ analytics contract สำหรับ open/change category/view/download โดยไม่ส่ง source URL
7. ทำ visual regression สำหรับ lightbox, categorized grid, custom colors, no-cover และ system source
8. ทำ performance budget สำหรับ metadata, lazy-load boundary, thumbnail requests และ full-image preload

## การตรวจสอบที่รันแล้ว

`npm.cmd test -- components/villas/detail/__tests__/gallery.test.tsx components/villas/detail/__tests__/gallery-lightbox.test.tsx components/villas/detail/__tests__/gallery-overview-modal.test.tsx components/villas/detail/__tests__/gallery-modal-style.test.ts`

ผลลัพธ์: ผ่าน 3 test files, 16 tests
