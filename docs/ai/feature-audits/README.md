# Feature Audit Backlog

โฟลเดอร์นี้เก็บผล audit ราย feature เพื่อใช้วางแผนปรับปรุงโค้ดในอนาคต
ไม่ใช่ specification ของ feature และไม่ใช่หลักฐานว่าได้แก้ไขแล้ว

## วิธีใช้

1. ดูตารางด้านล่างเพื่อเลือก feature ที่ต้องการตรวจหรือปรับ
2. เปิดไฟล์ของ feature นั้นเพื่อดูขอบเขต, จุดที่ควรปรับ และ test ที่เกี่ยวข้อง
3. ก่อนเริ่มแก้ ให้เปลี่ยนสถานะเป็น `กำลังปรับปรุง` พร้อมระบุวันที่
4. เมื่อทำครบและผ่านการตรวจ ให้เปลี่ยนสถานะเป็น `เสร็จแล้ว` และบันทึกสิ่งที่เปลี่ยน

## สถานะ

| สถานะ | ความหมาย |
|---|---|
| `ยังไม่ได้ audit` | ยังไม่เคยตรวจโครงสร้างของ feature นี้ |
| `มีรายการปรับปรุง` | audit แล้วและมีเรื่องต้องแก้ในอนาคต |
| `กำลังปรับปรุง` | กำลังแก้ตามเอกสาร audit |
| `เสร็จแล้ว` | รายการใน audit รอบนั้นแก้และตรวจแล้ว |

## Feature index

| Feature | สถานะ | Audit ล่าสุด | เอกสาร | สิ่งที่ต้องติดตาม |
|---|---|---|---|---|
| Customer review images (หน้าแรก) | มีรายการปรับปรุง | 2026-09-07 | [customer-reviews.md](./customer-reviews.md) | แยก UI, shared upload policy, แยก admin logic, เพิ่ม flow tests |
| Villa detail | มีรายการปรับปรุง | 2026-09-07 | [villa-detail.md](./villa-detail.md) | จัดกลุ่ม component, แยก villa data use case, API/feature map, route integration tests |
| Guides CMS | มีรายการปรับปรุง | 2026-09-07 | [guides.md](./guides.md) | แยก admin/editor/public renderer, content-block schema กลาง, integration tests |
| Site settings | มีรายการปรับปรุง | 2026-09-07 | [site-settings.md](./site-settings.md) | แยก validation/contracts, ownership map, compatibility ledger, end-to-end flows |
| Home sections | มีรายการปรับปรุง | 2026-09-07 | [home-sections.md](./home-sections.md) | แยก admin editor, snapshot contract, concurrent edits, render/cache maps |
| Villa search | มีรายการปรับปรุง | 2026-09-07 | [villa-search.md](./villa-search.md) | แยก search state, query contract, versioned snapshots, end-to-end flow |
| Site contact settings | มีรายการปรับปรุง | 2026-09-07 | [site-contact-settings.md](./site-contact-settings.md) | contact action model, public/private boundary, audit log, concurrent edits |
| Legal pages | มีรายการปรับปรุง | 2026-09-07 | [legal-pages.md](./legal-pages.md) | typed public content, fallback observability, version history, publish flow |
| TikTok settings & embeds | มีรายการปรับปรุง | 2026-09-07 | [tiktok.md](./tiktok.md) | domain ownership, oEmbed contract/cache, admin split, provider status |
| Villa card images | มีรายการปรับปรุง | 2026-09-07 | [villa-card-images.md](./villa-card-images.md) | แยก admin/data/image helpers, image-resolution contract, concurrent edits, asset lifecycle |
| Villa availability & calendar | มีรายการปรับปรุง | 2026-09-07 | [booking-calendar.md](./booking-calendar.md) | unavailable UI state, Bangkok date model, upstream contract, request budget, observability |
| Advertisements CMS | มีรายการปรับปรุง | 2026-09-07 | [advertisements.md](./advertisements.md) | data ownership, content workflow, runtime contract, cache invalidation, asset lifecycle |
| Villa detail layout CMS | มีรายการปรับปรุง | 2026-09-07 | [villa-detail-layout.md](./villa-detail-layout.md) | editor/canvas split, block registry, V1/V2 lifecycle, concurrent saves, test dependency |
| Site web styles | มีรายการปรับปรุง | 2026-09-07 | [site-web-styles.md](./site-web-styles.md) | owner naming, settings navigation, style registry, concurrent edits, cross-consumer contract |
| Admin authentication & session security | มีรายการปรับปรุง | 2026-09-07 | [admin-authentication.md](./admin-authentication.md) | session flow, route policy, browser threat model, diagnostics, security audit log |
| Central user management | มีรายการปรับปรุง | 2026-09-07 | [central-user-management.md](./central-user-management.md) | lifecycle ownership, state map, protocol upgrades, operator recovery, audit trail |
| External villa data refresh | มีรายการปรับปรุง | 2026-09-07 | [external-villa-data-refresh.md](./external-villa-data-refresh.md) | refresh UX, distributed cooldown, audit log, result contract, cache impact map |
| SEO settings & sitemap | มีรายการปรับปรุง | 2026-09-07 | [seo-settings-and-sitemap.md](./seo-settings-and-sitemap.md) | ownership map, legacy projection, page registry, preview, sitemap observability |
| Public image delivery & proxy | มีรายการปรับปรุง | 2026-09-07 | [public-image-delivery-and-proxy.md](./public-image-delivery-and-proxy.md) | helper ownership, request registry, legacy proxy retirement, cache and security maps |
| Cloudflare edge cache & public cache policy | มีรายการปรับปรุง | 2026-09-07 | [cloudflare-edge-cache-and-public-cache-policy.md](./cloudflare-edge-cache-and-public-cache-policy.md) | policy registry, route map, drift tests, invalidation trace, observability |
| Marketing tags & Google Tag Manager | มีรายการปรับปรุง | 2026-09-07 | [marketing-tags-and-google-tag-manager.md](./marketing-tags-and-google-tag-manager.md) | tracking plan, consent, event schema, preview, audit log |
| Production deployment & prewarm | มีรายการปรับปรุง | 2026-09-07 | [production-deployment-and-prewarm.md](./production-deployment-and-prewarm.md) | deployment state, migration ownership, prewarm report, rollback, observability |
| Public site shell | มีรายการปรับปรุง | 2026-09-07 | [public-site-shell-header-footer-and-mobile-contact-actions.md](./public-site-shell-header-footer-and-mobile-contact-actions.md) | navigation map, shell snapshot, mobile a11y, analytics, performance budget |
| Villa gallery & lightbox | มีรายการปรับปรุง | 2026-09-07 | [villa-gallery-and-lightbox.md](./villa-gallery-and-lightbox.md) | state model, gallery contract, modal a11y, mobile behavior, performance budget |
| Public API rate limiting | มีรายการปรับปรุง | 2026-09-07 | [public-api-rate-limiting.md](./public-api-rate-limiting.md) | distributed limits, policy registry, abuse response, IP policy, error contract |
| Site asset upload pipeline | มีรายการปรับปรุง | 2026-09-07 | [site-asset-upload-pipeline.md](./site-asset-upload-pipeline.md) | lifecycle, asset registry, concurrency, cleanup, image safety, proxy contract |
| External villa catalog integration | มีรายการปรับปรุง | 2026-09-07 | [external-villa-catalog-integration.md](./external-villa-catalog-integration.md) | server split, upstream contract, source map, degraded policy, refresh consistency |
| Admin password security | มีรายการปรับปรุง | 2026-09-07 | [admin-password-security.md](./admin-password-security.md) | lifecycle map, recovery UX, audit log, abuse controls, owner boundary |

เมื่อ audit feature ใหม่ ให้เพิ่มหนึ่งแถวในตารางนี้และสร้างไฟล์ชื่อ `kebab-case` ในโฟลเดอร์เดียวกัน.
