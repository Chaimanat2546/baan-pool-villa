# แบบออกแบบ Migration Gate ของ Supabase สำหรับ Tenant

**วันที่:** 2026-08-28  
**สถานะ:** อนุมัติแบบออกแบบแล้ว รอแผนการพัฒนา

## เป้าหมาย

เมื่อมีการ push เข้า `master` ที่เปลี่ยนไฟล์ใต้ `supabase/migrations/` ให้ apply
migration history ชุดเดียวกันกับฐานข้อมูล production ของ Tenant ทุกตัว ก่อนเริ่ม
deploy Worker ใด ๆ โดยมี 5 target คือ `baanparty`, `baan02`, `baanPMhee`,
`flukNasa` และ `villaMedia`

หาก migration ฐานข้อมูลตัวใดล้มเหลว ต้องไม่เริ่ม deploy Worker ใดเลย แต่ถ้าไม่มี
การเปลี่ยนไฟล์ source migration ให้ใช้ขั้นตอน deploy เดิมต่อไป

## สมมติฐานและขอบเขต

- ฐานข้อมูลของทั้ง 5 Tenant มี migration history ที่สมบูรณ์ชุดเดียวกันจาก
  `supabase/migrations/` ดังนั้น source migration ทุกไฟล์มีเจตนาให้ใช้กับทุก Tenant
- มีเพียงการเปลี่ยนใต้ source migration directory เท่านั้นที่เป็น trigger อัตโนมัติ
  ไม่รวม seed, bootstrap SQL หรือ patch SQL ที่ดูแลแยกต่างหาก
- งานนี้ไม่ migrate `staging`, ไม่สร้างฐานข้อมูลใหม่ และไม่ rollback อัตโนมัติ
- GitHub Environment ที่ตั้งชื่อตาม deployment target ทั้ง 5 มีอยู่แล้ว และแยก
  configuration ของแต่ละ Tenant

## สถาปัตยกรรมที่เลือก

ขยาย pipeline `deploy-production.yml` เดิมให้มี 3 ระยะ:

1. `verify` ยังรัน lint และ test suite ทั้งหมดเหมือนเดิม และส่งออก deployment
   matrix เดิมพร้อม boolean `migrations_changed` ซึ่งคำนวณจากช่วง commit ที่ push
2. `migrate` จะถูกข้ามถ้า `migrations_changed` เป็น false หากเป็น true จะขยาย
   matrix ทั้ง 5 target, ยืนยันตัวตนด้วย Supabase CLI, link ไปยัง project ref ที่
   ระบุชัดใน matrix แล้วรัน `supabase db push --linked --include-all`
3. `deploy` รอทั้ง `verify` และ `migrate` และจะเริ่มได้เฉพาะเมื่อ `migrate`
   สำเร็จ หรือถูกข้ามโดยตั้งใจเพราะไม่มีไฟล์ migration เปลี่ยน จากนั้นจึงใช้ขั้นตอน
   build และ Cloudflare deploy ราย Tenant แบบเดิม

`migrate` ตั้ง `fail-fast: false` เพื่อให้เห็นผลของทุก Tenant หากตัวหนึ่งล้มเหลว
job โดยรวมต้องล้มเหลวและไม่เริ่ม deploy matrix แม้ Tenant อื่นจะยังรันต่อเพื่อเก็บ
ผลลัพธ์ครบทุกตัว การรันจะจำกัด concurrent jobs ไว้ที่ 2 งาน เพื่อลดการเปิด database
connection พร้อมกัน 5 ตัว แต่ยังไม่ช้าจนเกินไป

## เจ้าของ Configuration

`wrangler.jsonc` ยังคงเป็นแหล่งข้อมูลหลักของ
`CENTRAL_USER_MANAGER_PROJECT_REF` สำหรับแต่ละ deployment target helper ของ
deployment configuration จะอ่าน ตรวจสอบ และเพิ่มค่านี้ให้ทุก matrix entry โดยต้อง
ปฏิเสธ project ref ที่หายไปหรือรูปแบบไม่ถูกต้อง และ workflow ห้ามรับ project ref
จาก workflow input หรือ pull request

credential ใหม่เก็บเป็น GitHub secret เท่านั้น:

| ที่เก็บ | Secret | หน้าที่ |
| --- | --- | --- |
| Repository หรือ organization | `SUPABASE_ACCESS_TOKEN` | ยืนยันตัวตนของ Supabase CLI กับ account ที่ได้รับอนุญาต |
| GitHub Environment ของแต่ละ target | `SUPABASE_DB_PASSWORD` | ให้ CLI เชื่อมต่อฐานข้อมูล target นั้น โดยแต่ละ Tenant ใช้ค่าของตัวเอง |

workflow ต้องไม่แสดงค่า secret ทั้งสองผ่าน command, diagnostic, summary หรือ
artifact และไม่ใช้ `SUPABASE_PUBLISHABLE_KEY` เพราะไม่ใช่ credential สำหรับ migrate
ฐานข้อมูล

## ลำดับการทำงานและข้อตกลงเมื่อผิดพลาด

changed-file check ทำเฉพาะ trusted push ไปยัง `master` เท่านั้น การรันจาก pull request
ยังคงตรวจสอบและ dry-run Cloudflare deploy ได้ตามเดิม แต่ห้ามเขียนฐานข้อมูล ในกรณี
push แรกที่ไม่มี before SHA ตามปกติ implementation ต้องเทียบกับ parent commit และ
ต้อง fail closed หากไม่สามารถหาช่วง commit ที่เชื่อถือได้

ในแต่ละ migration matrix entry job จะ:

1. checkout commit ที่ถูก push อย่างเจาะจง
2. ติดตั้ง official Supabase CLI action ที่ pin เวอร์ชันแล้ว
3. ใช้เฉพาะ project ref จาก tracked configuration ที่ถูกแปลงลง matrix
4. link CLI กับ ref นั้น แล้ว push source migration ที่ยังค้าง
5. เขียน summary ที่ไม่มี secret โดยระบุ target, project ref, commit และผลลัพธ์

Supabase migration history ทำให้ migration ที่เคย apply แล้วถูกข้ามได้อย่างปลอดภัย
และ `--include-all` รองรับ repository ที่ remote history ขาด source entry เก่า หาก
link หรือ push ผิดพลาด Tenant นั้นถือว่าล้มเหลว Tenant อื่นยังทำต่อได้ แต่ห้าม
release deployment จนกว่าทั้ง 5 จะสำเร็จ การกู้คืนคือแก้ไขโดย operator แล้วใช้ GitHub
**Re-run failed jobs** กับ commit เดิม โดยไม่ทำ database rollback อัตโนมัติ

## ไฟล์และการทดสอบ

- `.github/workflows/deploy-production.yml`: เพิ่ม changed-migration detection,
  migration matrix job และเงื่อนไข dependency/skip ของ deploy
- `scripts/production-deploy-config.mjs`: ตรวจ project ref และส่งออกพร้อม
  deployment matrix โดยไม่ทำข้อมูล Tenant ซ้ำ
- test ของ deployment configuration helper ที่มีอยู่: ยืนยัน project ref ของทั้ง
  5 target, กรณี project ref หาย/ผิดรูปแบบ และ matrix shape
- `README.md`, `docs/deployment.md` และ `docs/ai/structure.html`: อธิบาย migration
  gate, ชื่อ secret ที่ต้องตั้ง, การตั้ง GitHub Environment, trigger path และขั้นตอน
  recovery โดยไม่บันทึกค่า secret ใด

การตรวจสอบ implementation จะประกอบด้วย focused helper tests, การ parse/ตรวจโครงสร้าง
workflow YAML ตามแนวทางที่ repository ใช้อยู่, `npm run lint` และ production build
checks ตามคู่มือโครงการ ก่อน merge ต้องตั้ง `SUPABASE_ACCESS_TOKEN` และ
`SUPABASE_DB_PASSWORD` ใน Environment ทั้ง 5 ให้เรียบร้อย มิฉะนั้น merge แรกที่แก้
migration จะถูก block จากการ deploy ตามการออกแบบ

## นอกขอบเขต

- การ apply `supabase/seed.sql`, bootstrap SQL หรือ patch SQL เฉพาะกิจ
- การเขียน migration จาก pull request, fork, local preview หรือ staging
- การสร้าง/อ่าน database password จาก repository configuration หรือ Cloudflare
- การ retry migration ที่ล้มเหลวหรือ rollback Tenant ใดแบบอัตโนมัติ
- การ deploy ต่อเมื่อ migration สำเร็จเพียงบาง Tenant
