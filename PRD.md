# PRD: Baan Pool Villa

- สถานะ: Draft
- อัปเดตล่าสุด: 2026-06-05
- ผลิตภัณฑ์: เว็บไซต์ค้นหาและติดต่อจองบ้านพักพูลวิลล่าในพัทยา
- ชื่อแบรนด์เริ่มต้นในระบบ: Pool Villas Pattaya

## 1. ภาพรวมผลิตภัณฑ์

Baan Pool Villa เป็นเว็บไซต์สำหรับช่วยให้ลูกค้าค้นหาบ้านพักพูลวิลล่าที่เหมาะกับจำนวนผู้เข้าพัก ทำเล จำนวนห้องนอน งบประมาณ สิ่งอำนวยความสะดวก และรหัสบ้านพัก ก่อนติดต่อทีมงานผ่านช่องทางโทรศัพท์ LINE หรือ Messenger เพื่อปิดการจอง

ระบบปัจจุบันใช้ Next.js App Router เป็น public website และ admin CMS ขนาดกะทัดรัด โดยดึงข้อมูลบ้านพักหลักจาก external villa APIs, ใช้ Supabase สำหรับรูปภาพแกลเลอรีบ้านพักและข้อมูล CMS/settings, และมี admin tools สำหรับจัดหน้าแรก ตั้งค่าแบรนด์/SEO/contact จัดบทความ จัด TikTok และจัด layout หน้ารายละเอียดบ้านพัก

## 2. ปัญหาที่ต้องแก้

ลูกค้าที่มองหาบ้านพักพูลวิลล่ามักต้องเปรียบเทียบหลายปัจจัยพร้อมกัน เช่น ทำเล จำนวนคน ห้องนอน ราคา รูปบ้าน และสิ่งอำนวยความสะดวก หากข้อมูลกระจัดกระจายหรือค้นหายาก จะทำให้ลูกค้าออกจากเว็บก่อนติดต่อจอง

ฝั่งทีมงานต้องการปรับหน้าแรก แบรนด์ ช่องทางติดต่อ คอนเทนต์ SEO และเนื้อหาประกอบการขายได้เอง โดยไม่ต้องแก้โค้ดทุกครั้ง แต่ยังต้องรักษาความถูกต้องของข้อมูลจากระบบบ้านพักหลักและไม่ทำให้หน้าเว็บช้าหรือ SEO เสีย

## 3. เป้าหมาย

1. ช่วยให้ลูกค้าค้นหาบ้านพักที่ตรงเงื่อนไขได้เร็วจากหน้าแรกและหน้าค้นหา
2. ทำให้หน้ารายละเอียดบ้านพักให้ข้อมูลเพียงพอต่อการตัดสินใจติดต่อจอง
3. เพิ่ม conversion ผ่าน contact actions ที่เห็นง่ายทั้ง mobile และ desktop
4. ให้ทีมงานปรับหน้าแรก แบรนด์ ช่องทางติดต่อ บทความ TikTok และ layout หน้ารายละเอียดได้จากหลังบ้าน
5. รองรับ SEO สำหรับหน้าแรก หน้าค้นหา หน้ารายละเอียดบ้านพัก บทความ และ sitemap
6. ลดความเสี่ยงจาก external data failure ด้วย cache, fallback, loading, empty และ error states ที่ชัดเจน

## 4. สิ่งที่ไม่อยู่ในขอบเขต

1. ระบบจองและชำระเงินออนไลน์แบบ end-to-end
2. ระบบสมาชิกสำหรับลูกค้าทั่วไป
3. การจัดการ inventory บ้านพักหลักจากหลังบ้านของเว็บนี้
4. การคำนวณ availability แบบ real-time
5. การเปิดใช้ admin modules ที่ยัง disabled อยู่ เช่น จัดการบ้านพัก รูปภาพบ้านพัก และผู้ดูแล
6. การเพิ่มปุ่ม near-sea filter ที่มองเห็นบนหน้าค้นหา เว้นแต่มีการตัดสินใจ product ใหม่

## 5. กลุ่มผู้ใช้

### 5.1 ลูกค้าทั่วไป

กลุ่มครอบครัว กลุ่มเพื่อน บริษัท หรือผู้จัดทริปที่ต้องการบ้านพักพูลวิลล่าในพัทยาและพื้นที่ใกล้เคียง ต้องการค้นหาด้วยจำนวนคน งบประมาณ ทำเล ห้องนอน และสิ่งอำนวยความสะดวก แล้วติดต่อทีมงานเพื่อสอบถามหรือจอง

### 5.2 ทีมจองและทีมขาย

ผู้ดูแลช่องทางติดต่อ ต้องการให้ลูกค้าเห็นเบอร์โทร LINE Messenger และข้อมูลที่ช่วยปิดการจองได้เร็ว เช่น ราคาเริ่มต้น รหัสบ้านพัก จำนวนคน รูปภาพ และรายละเอียดสำคัญ

### 5.3 ทีมคอนเทนต์และแอดมินเว็บไซต์

ผู้ดูแลเว็บที่ต้องจัดหน้าแรก ปรับแบรนด์/SEO/contact ลงบทความ จัดวิดีโอ TikTok และปรับ layout หน้ารายละเอียด โดยต้องเห็น preview/status และ error จากระบบอย่างชัดเจน

## 6. User Journey หลัก

### 6.1 ค้นหาจากหน้าแรก

1. ลูกค้าเข้าหน้าแรก
2. เห็น hero image และ search controls
3. เลือกทำเล จำนวนคน ห้องนอน ราคา และเงื่อนไขที่ต้องการ
4. กดค้นหาแล้วไปที่ `/search` พร้อม query params
5. เห็นรายการบ้านพักที่ตรงเงื่อนไข
6. เปิดหน้ารายละเอียดบ้านพัก
7. ติดต่อทีมงานผ่าน phone, LINE หรือ Messenger

### 6.2 ค้นหาจากหน้าค้นหา

1. ลูกค้าเข้าหน้า `/search`
2. ปรับ filter, ค้นด้วยรหัสบ้าน, เลือก sort order หรือเปิดจากลิงก์ที่มี `nearSea=1`
3. ระบบแสดงผลลัพธ์แบบ incremental page size เพื่อไม่ render บ้านทุกหลังพร้อมกัน
4. หากข้อมูล catalog ยังไม่ครบ ระบบ hydrate เพิ่มผ่าน `/api/houses`
5. ลูกค้ากดดูรายละเอียดหรือโหลดรายการเพิ่ม

### 6.3 อ่านบทความแล้วไปยังบ้านพัก

1. ลูกค้าเข้าหน้า `/guides` หรือบทความจาก SEO/social
2. อ่านเนื้อหาแนะนำบ้านพักหรือการเตรียมตัวเที่ยว
3. เห็นบ้านพักแนะนำที่ผูกกับบทความ
4. เปิดหน้ารายละเอียดบ้านพักและติดต่อทีมงาน

### 6.4 จัดการหลังบ้าน

1. แอดมินเข้าสู่ `/admin/login`
2. ไปยัง module ที่ต้องจัดการ เช่น หน้าแรก ตั้งค่าเว็บ บทความ TikTok หรือ layout รายละเอียดบ้านพัก
3. แก้ draft และดู preview/status
4. กดบันทึกผ่าน admin API
5. ระบบ validate, persist ลง Supabase, revalidate cache/tag/path ที่เกี่ยวข้อง และแสดงผลสำเร็จหรือ error ที่อ่านออก

## 7. Functional Requirements

### 7.1 Public Site

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| PUB-01 | หน้า public layout ต้องใช้ site settings สำหรับชื่อเว็บ theme colors logo และ contact actions | P0 | เมื่อ settings โหลดได้ UI ใช้ค่า settings; เมื่อโหลดไม่ได้ใช้ defaults ที่ production-safe |
| PUB-02 | หน้าแรกต้องมี hero search, home villa sections, destinations, TikTok, articles, FAQ และ contact section | P0 | หน้าแรก render ได้แม้บาง section ไม่มีข้อมูล และไม่ส่ง full villa catalog ไป client โดยไม่จำเป็น |
| PUB-03 | Hero search ต้องสร้าง query params ที่หน้าค้นหาอ่านได้ | P0 | เงื่อนไขจาก hero ส่งต่อไป `/search` และ normalize ค่า max price/filters ถูกต้อง |
| PUB-04 | Home villa sections ต้องมาจาก CMS และรองรับ manual, near-sea และ slice modes | P0 | แอดมินจัด section แล้ว public home แสดง villa rail ตามลำดับและ CTA ที่ตั้งไว้ |
| PUB-05 | หน้าค้นหาต้องรองรับ zone, guests, bedrooms, amenities, max price, house id, sort order และ `nearSea=1` URL param | P0 | query params ถูก parse, filter และ sort ถูกต้อง; near-sea ทำงานจาก URL โดยไม่ต้องมี visible toggle |
| PUB-06 | Search results ต้องแสดงแบบ incremental | P0 | โหลดครั้งแรกแสดง 12 รายการ และกดดูเพิ่มได้โดยไม่ render catalog ทั้งหมดทันที |
| PUB-07 | Search ต้องมี loading, empty และ error states | P0 | เมื่อ API fail แสดงข้อความโหลดไม่สำเร็จ; เมื่อไม่พบรายการแสดง empty state และปุ่มล้างตัวกรอง |
| PUB-08 | Villa cards ต้อง reuse shared listing components | P0 | Home, search และ recommendations ใช้ card/price/stats/amenities จาก `components/villas/listing` |
| PUB-09 | หน้ารายละเอียดบ้านพักต้องแสดงข้อมูล listing, detail data, gallery, booking/contact sidebar และ recommended villas | P0 | หน้า `/villas/:id` render ด้วย data ที่มี; หากไม่พบบ้านพักเข้าสู่ not-found |
| PUB-10 | Gallery บ้านพักต้องใช้ Supabase image rows ที่ match villa id | P0 | ภาพ detail gallery สร้าง public URL จาก `image_name` ผ่าน helper ที่เป็น source of truth |
| PUB-11 | Contact actions ต้องใช้ shared contact config | P0 | Header/footer/mobile bottom/contact section ไม่ hard-code contact links ซ้ำใน component |
| PUB-12 | Guide list/detail ต้องแสดง published guides และ villa recommendations | P1 | บทความ published อยู่ใน `/guides` และ `/guides/:slug`; draft ไม่แสดง public |
| PUB-13 | TikTok homepage section ต้องใช้ settings และ lazy embed | P1 | แสดงวิดีโอชุดแรกตาม settings และ defer third-party iframe จนผู้ใช้กดเล่น |

### 7.2 Admin CMS

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| ADM-01 | Admin routes ต้องมี auth/session guard และ redirect ไป login เฉพาะ auth failure จริง | P0 | 401/session failure ไป `/admin/login`; Supabase/storage permission error แสดงใน form |
| ADM-02 | Admin UI ต้องใช้สไตล์ Modern SaaS Dashboard / Clean Card UI ที่ compact และภาษาไทย | P0 | หน้า settings, sections, guides, TikTok และ detail layout มี density/spacing/copy สอดคล้องกัน |
| ADM-03 | Settings admin ต้องจัดการ site name, colors, logo, hero image, contact, bank และ SEO | P0 | Save แล้ว validate, persist, revalidate public settings และแสดง error details เมื่อผิดพลาด |
| ADM-04 | Upload logo/hero ต้อง validate MIME/extension ฝั่ง server และมี retention | P0 | Accept เฉพาะ jpeg/png/webp, จำกัดขนาดไฟล์, เก็บเฉพาะ latest retained assets ตาม helper |
| ADM-05 | Home sections admin ต้องรองรับ create/update ordering, mode, fallback, limit, CTA และ manual house IDs | P0 | Save แล้ว public home section เปลี่ยนตาม config และมี preview ก่อนบันทึก |
| ADM-06 | Guides admin ต้องรองรับ draft/published, slug, excerpt, cover image, content blocks, tags และ recommended house IDs | P1 | Published guides แสดง public; slug unique; upload failure แสดง error และ cleanup conservative |
| ADM-07 | TikTok admin ต้องจัดการ account URL และ video URLs | P1 | บันทึกเฉพาะ URL ที่ validate ได้ และไม่ถูก overwrite จาก general site settings API |
| ADM-08 | Detail layout admin ต้องจัด layout หน้ารายละเอียดบ้านพัก | P1 | Save config แล้ว detail renderer ใช้ layout version/config ล่าสุด |
| ADM-09 | External data refresh API ต้องมี auth และ revalidate cache ที่เกี่ยวข้อง | P1 | แอดมิน refresh แล้ว listings/detail cache ถูก invalidated ตาม helper กลาง |
| ADM-10 | Disabled admin modules ต้องไม่แสดงเป็น action ที่ใช้งานได้ | P2 | เมนูบ้านพัก รูปภาพ และผู้ดูแลยัง disabled จนกว่าจะมี scope ใหม่ |

### 7.3 Data และ Integrations

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| DATA-01 | Villa listings ต้องดึงจาก `https://www.devillegroups.com/api/json/getHouse_deville.json` | P0 | Normalize เป็น `VillaListing` และ cache ตาม `lib/cache-policy.ts` |
| DATA-02 | Listing cover images ต้องใช้ host `https://devillegroups.com/imgs/profile_imgs_large/{img_name}` | P0 | URL ถูกสร้างจาก helper ไม่ hard-code ใน component |
| DATA-03 | Villa detail data ต้องดึงจาก Deville Central API ด้วย `DEVILLE_BEARER_TOKEN` | P0 | Missing token หรือ API unavailable ต้องไม่ทำให้ทั้งหน้า crash โดยไม่จำเป็น |
| DATA-04 | Detail gallery ต้องอ่าน Supabase rows ที่ `images.property_id` match `h_id` / `house_id` | P0 | Public images API และ detail page คืนรูปที่ถูกต้องตามบ้านพัก |
| DATA-05 | Home sections, settings, guides, TikTok และ detail layout ต้อง persist ผ่าน Supabase-backed CMS | P0 | Public reads มี fallback/cache; admin writes มี validation/auth/revalidation |
| DATA-06 | Public URL/canonical/sitemap ต้องใช้ `NEXT_PUBLIC_SITE_URL` หรือ fallback ที่ถูกต้อง | P1 | Metadata, sitemap และ JSON-LD สร้าง absolute URL ได้ถูกต้อง |

### 7.4 SEO, Accessibility และ UX States

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| SEO-01 | Metadata ต้องสร้างผ่าน shared SEO helpers | P0 | หน้า home/search/guides/detail มี title, description, canonical, OG/Twitter metadata |
| SEO-02 | JSON-LD ต้อง serialize ผ่าน shared serializer | P0 | ไม่มีการ hand-write JSON-LD ที่ไม่ escape `<` |
| SEO-03 | Sitemap ต้องรวม home, search, villa detail และ guide URLs ตามข้อมูลที่ publish | P1 | `/sitemap.xml` สะท้อนข้อมูล villa/guides ที่พร้อม public |
| A11Y-01 | รูป content ต้องมี alt text ที่มีความหมาย | P0 | Logo/hero/guide/gallery ใช้ alt จาก settings/data หรือ fallback ที่ไม่ misleading |
| A11Y-02 | Form controls และ action buttons ต้องมี accessible names และ keyboard reachability | P0 | Search/admin forms ใช้ semantic input/button/select และมี focus state |
| UX-01 | Loading skeletons ต้องมีใน public/admin routes สำคัญ | P1 | home/search/detail/admin settings/sections/guides/TikTok/detail-layout มี loading UI ที่สอดคล้องกัน |
| UX-02 | Long text, file names และ status messages ต้องไม่ทำ layout แตกบน mobile | P1 | ข้อความ wrap/truncate ตามบริบทและตรวจ mobile/desktop เมื่อเปลี่ยน UI |

## 8. Non-Functional Requirements

### 8.1 Performance

1. หน้าแรกต้องส่งข้อมูลไป client เท่าที่จำเป็น ไม่ส่ง full catalog หากใช้เฉพาะ summary/sections
2. Search ต้อง hydrate full catalog เมื่อจำเป็นต่อ interaction เท่านั้น
3. External villa listing/detail caches ใช้ TTL และ cache tags กลาง
4. YouTube/TikTok embeds ต้อง defer third-party iframe จนผู้ใช้มี interaction เมื่อทำได้
5. Detail routes ใช้ ISR 15 นาทีและ generate on first request เพื่อไม่ prebuild villa ทุกหลัง

### 8.2 Reliability

1. External API failure ต้องมี user-facing error หรือ fallback ที่เข้าใจได้
2. Admin save ต้องแสดง validation, Supabase, storage หรือ authorization error ตามข้อมูลที่ระบบคืนมา
3. Supabase settings unavailable ต้อง fallback เป็น defaults ที่ปลอดภัยต่อ production
4. Cache revalidation ต้องรวม public surface ที่ได้รับผล เช่น home, detail, guides, sitemap และ settings-driven layout

### 8.3 Security

1. ห้าม expose service-role key หรือ bearer token ใน client, route response หรือ `NEXT_PUBLIC_*`
2. Admin APIs ต้องตรวจ auth ก่อน write/persist/refresh
3. Uploads ต้อง validate MIME type, extension และขนาดไฟล์ฝั่ง server
4. Public links จาก settings/admin/external data ต้อง validate protocol ก่อน render
5. JSON-LD ต้อง escape ค่าที่อาจมี `<`

### 8.4 Maintainability

1. Shared source of truth ต้องอยู่ใน `lib` หรือ feature owner ที่เหมาะสม
2. ห้ามคำนวณราคา, contact links, cache policy, SEO defaults หรือ image URLs แบบ ad hoc ใน component
3. Route files ต้องบางและ delegate ไปยัง feature modules/helpers
4. เมื่อเพิ่ม route/helper/settings/data contract ต้องอัปเดต `docs/ai/structure.html` ใน change เดียวกัน

## 9. Success Metrics

1. Search-to-detail click-through rate เพิ่มขึ้นหลังผู้ใช้ตั้ง filter
2. Detail-to-contact click rate ผ่าน phone, LINE หรือ Messenger
3. Zero-result rate ใน search ต่ำและผู้ใช้สามารถ recovery ด้วยการล้าง filter
4. Admin save success rate สูง และ admin errors มีข้อมูลพอให้แก้ไขได้
5. Organic landing pages จาก villa detail และ guides มี impressions/clicks เพิ่มขึ้น
6. Production build, lint และ targeted tests ผ่านก่อน release

## 10. Release Readiness

สำหรับ documentation-only changes ให้ตรวจ manual diff/read-through ก็เพียงพอ

สำหรับ frontend หรือ Next.js changes ก่อนจบงานต้องผ่าน:

1. `npm.cmd run lint`
2. `npm.cmd run build`
3. Browser verification ของหน้าที่แตะทั้ง mobile และ desktop

สำหรับ shared data, settings, validation, pricing, image, detail, admin API หรือ Supabase persistence changes ให้รัน targeted tests ก่อน แล้วตามด้วย lint และ build เช่น:

1. `npm.cmd test -- lib/villas`
2. `npm.cmd test -- lib/site-settings`
3. `npm.cmd test -- lib/home-sections`
4. `npm.cmd test -- lib/guides`
5. `npm.cmd test -- lib/detail-layout`

## 11. Dependencies

1. Next.js 16.2.6 App Router และ React 19.2.4
2. Tailwind CSS v4
3. Supabase SSR/client libraries
4. External Deville villa listing/detail APIs
5. Supabase Storage สำหรับ site assets และ guide assets
6. OpenNext/Cloudflare deployment path สำหรับ preview/deploy
7. Environment variables ตามที่ระบุใน `AGENTS.md`

## 12. Risks และ Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| External villa API unavailable | Search/detail ข้อมูลไม่ครบ | ใช้ cache, error state, refresh API และ fallback status |
| Settings/CMS Supabase unavailable | Branding/contact/content อาจหาย | ใช้ defaults production-safe และแสดง admin error ชัดเจน |
| Admin save revalidation ไม่ครบ | Public page ยังแสดงข้อมูลเก่า | ใช้ `lib/cache-revalidation.ts` เป็น owner กลาง |
| Hard-coded contact/price/image logic หลุดเข้า component | ข้อมูล public ไม่สอดคล้อง | ใช้ shared helpers และ targeted tests |
| Third-party embeds ทำให้หน้าแรกช้า | UX/SEO แย่ลง | ใช้ thumbnail/lazy embed strategy |
| Schema changes กับ Supabase online ไม่ idempotent | Migration/patch fail หรือกระทบข้อมูลจริง | ใช้ migration สำหรับ local ใหม่ และ minimal idempotent patch SQL สำหรับ online project |

## 13. Product Decisions ที่ยืนยันแล้วจาก repo

1. Search page ต้องรับ `nearSea=1` ผ่าน URL แต่ไม่แสดง near-sea toggle
2. Search results ต้อง paginate/incremental display ไม่ render บ้านทุกหลังทันที
3. Public/admin theme colors ต้องมาจาก site settings theme variables เมื่อทำได้
4. Hero image ใช้ภาพเดียวสำหรับ desktop และ mobile
5. Admin CMS/settings pages ใช้ master-detail-preview หรือ summary/status pattern เมื่อเหมาะสม
6. Villa data หลักยังมาจาก external APIs ไม่ใช่ admin CRUD ในเว็บนี้
7. Detail gallery ใช้ Supabase image rows ที่ match villa id
8. Pricing display ต้องใช้ shared villa price commission logic ใน `lib`
