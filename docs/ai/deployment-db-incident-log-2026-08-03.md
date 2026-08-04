# Deployment และ Database Incident Log — 3 สิงหาคม 2026

เอกสารนี้บันทึกปัญหา การแก้ไข และความเสี่ยงคงค้างจากการเปิดใช้
Central User Manager (CUM) ระหว่าง Baan Party, Poolvillapattaya, PMhee และ
Webook โดยไม่เก็บ secret หรือค่า environment จริง

## ขอบเขตระบบ

| ระบบ | Worker / โปรเจกต์ |
| --- | --- |
| Baan Party | `baan-pool-villa` |
| Poolvillapattaya | `baan-pool-villa02` |
| PMhee | `baan-pool-villa03` |
| Webook | `webook-admin` |

แต่ละ tenant ใช้ Supabase แยกกัน แต่ Worker ทั้งหมดอยู่ Cloudflare account
เดียวกัน และ Webook ติดต่อ tenant ผ่าน Cloudflare Service Binding เท่านั้น

## ปัญหาที่พบและการแก้ไข

### 1. Webook ชี้ Worker ผิดหรือหา Worker ไม่พบ

**อาการ:** Wrangler แจ้งว่า Service Binding อ้างถึง Worker ที่ไม่พบ หรือหน้า
จัดการผู้ใช้ไม่สามารถเรียก tenant ได้

**สาเหตุ:** ชื่อ Worker ใน `wrangler.jsonc` ไม่ตรง Worker ที่ deploy จริง หรือ
ยังไม่ deploy Worker ปลายทาง

**การแก้:** กำหนด Service Binding ของ Webook แบบ explicit ต่อ tenant และใช้
ชื่อ Worker จริง เช่น `baan-pool-villa02` และ `baan-pool-villa03`

**ข้อควรระวัง:** ห้ามใช้ public HTTP หรือ Bearer-token fallback แทน Service
Binding

### 2. Webook ใช้ Supabase ผิด environment

**อาการ:** หน้า Login ของ Webook ชี้ DB Production แทน Staging หรือกลับกัน

**สาเหตุ:** ค่า `NEXT_PUBLIC_SUPABASE_URL` และ
`NEXT_PUBLIC_SUPABASE_ANON_KEY` ถูกฝังใน browser bundle ตั้งแต่ build;
การเปลี่ยน Cloudflare secret ภายหลังไม่เปลี่ยน bundle ที่ deploy แล้ว

**การแก้:** โหลด `.env.staging.local` หรือ `.env.production.local` ที่ถูกต้อง
ก่อน `opennextjs-cloudflare build` ทุกครั้ง แล้วจึง deploy

### 3. Worker ไม่มี secret ที่จำเป็น

**อาการ:** Wrangler ปฏิเสธ deploy ด้วยข้อความ required secret missing หรือ
feature ฝั่ง server ใช้งานไม่ได้หลัง deploy

**สาเหตุ:** `.env.<tenant>` อยู่ในเครื่องเท่านั้น ไม่ได้อัปโหลดไป Cloudflare
โดยอัตโนมัติ

**การแก้:** ตั้ง Cloudflare secret แยกต่อ Worker เช่น
`SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY` และ
`TURNSTILE_SECRET_KEY`

### 4. Turnstile ตอบ 503 ตอนกด Login

**อาการ:** หน้า Login และ widget แสดงได้ แต่ POST
`/api/admin/login/turnstile` ตอบ `503`

**สาเหตุ:** browser bundle มี `NEXT_PUBLIC_TURNSTILE_SITE_KEY` จากตอน build
แต่ Worker runtime ไม่มีค่านี้ แม้จะมี `TURNSTILE_SECRET_KEY` แล้ว

**การแก้:** ตั้งทั้ง `TURNSTILE_SECRET_KEY` และ
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` บน Worker และ build โดยโหลด public site key
ที่ถูกต้อง

### 5. Tenant ไม่มี CUM schema

**อาการ:** Webook แสดงข้อความ “ไม่สามารถจัดการผู้ใช้ได้ในขณะนี้” หรือ list
ผู้ใช้ไม่ได้

**สาเหตุ:** Supabase ของ tenant ไม่มี CUM RPC, operation/audit tables หรือ
health/list contract ที่ Worker ต้องใช้

**การแก้:** ลง migration CUM เฉพาะชุดที่จำเป็นลง Baan02 และ PMhee รวมถึง RPC
สำหรับ health, reconciled user list และ user-operation state machine

### 6. ผู้ใช้ทั้งหมดเป็นสถานะ `abnormal`

**อาการ:** Webook อ่านรายชื่อได้ แต่ทุกบัญชีเป็น `abnormal`

**สาเหตุ:** `public.admin_users` จับคู่กับ `auth.users` ได้ แต่
`auth.users.raw_app_meta_data` ยังไม่มี `bpv_admin_managed=true` และ
`credential_version=1`

**การแก้:** รัน backfill แบบ dry-run ก่อน แล้ว apply หลังอนุมัติ

| Tenant | ผล backfill ที่ยืนยันแล้ว |
| --- | --- |
| Poolvillapattaya | อัปเดต 4 ผู้ใช้, ตรวจแล้ว `active` 4 ผู้ใช้ |
| PMhee | อัปเดต 2 ผู้ใช้, ตรวจแล้ว `active` 2 ผู้ใช้ |

Backfill ไม่เปลี่ยน password, email, role หรือสร้าง/ลบผู้ใช้

### 7. Webook Production ขาด audit schema

**อาการ:** การทำงาน CUM ฝั่ง Webook อาจแจ้งว่า central user audit
ไม่พร้อมใช้งาน

**สาเหตุ:** Webook Production ไม่มีตาราง `public.central_user_audit_events`

**การแก้:** ลง migration
`20260802090000_central_user_manager_rpc_audit.sql` และตรวจผ่าน Data API
สำเร็จ

## สถานะ migration และความเสี่ยง

### สถานะจริง

- CUM migration บน Baan02 และ PMhee ถูกลงด้วย `supabase db query` โดยตรง
- Webook Production มี schema โฆษณาเก่า 3 ส่วนอยู่จริง แต่ migration history
  ไม่บันทึก
- ตาราง audit CUM ของ Webook Production ถูกลงด้วย `supabase db query`
  โดยตรง

### ผลกระทบ

Schema ใช้งานได้ แต่ `supabase migration list` อาจแสดงว่า migration ขาด
ทั้งที่ schema มีอยู่แล้ว ดังนั้นห้ามใช้คำสั่งต่อไปนี้โดยไม่ตรวจสอบ:

```text
supabase db push --include-all
```

คำสั่งดังกล่าวอาจพยายามรัน migration เก่าซ้ำและทำให้ deploy DB ล้ม

### แนวทาง cleanup ที่ต้องทำภายหลัง

1. ตรวจ schema จริงและ migration history ของแต่ละ Supabase project
2. แบ่ง migration เป็น: มี schema แล้ว, ขาดจริง, และเลิกใช้แล้ว
3. ใช้ `supabase migration repair --status applied` เฉพาะ migration ที่
   ตรวจแล้วว่า schema ถูกลงจริง
4. ห้ามลบ migration เก่าจาก git เพื่อแก้ history
5. หลัง history ตรงกัน จึงค่อยกลับมาใช้ `supabase db push` ตามปกติ

## สถานะคงค้าง

- ต้องยืนยันว่า Baan03 deploy สำเร็จหลังตั้ง secret ที่ขาดครบ และ CUM health
  ผ่านจาก Webook
- ต้อง deploy `webook-admin` build Production หลังโหลด
  `.env.production.local` และตั้ง Cloudflare runtime secrets ให้ตรงกัน
- ต้องทำ migration-history reconciliation แยกเป็นงานเฉพาะ ไม่ควรทำพร้อมการ
  deploy ฟีเจอร์

## มาตรฐานที่ควรใช้ต่อไป

### Deploy

ทุก target ต้องมีคำสั่ง deploy ของตนเองที่ทำตามลำดับนี้:

1. โหลดไฟล์ environment ที่ถูกต้อง
2. ตรวจ Supabase project ref ที่คาดหวัง
3. ตรวจชื่อ Cloudflare secrets ที่จำเป็นโดยไม่แสดงค่า
4. build
5. deploy ไปชื่อ Worker ที่ล็อกไว้
6. smoke test: Login/Turnstile, CUM health และ list users

### Migration

1. สร้าง migration ใหม่ใน git ก่อนทุกครั้ง
2. ทดสอบ Staging ก่อน Production
3. หลีกเลี่ยง SQL ตรง ยกเว้น incident/repair ที่มีเอกสารกำกับ
4. สำหรับ tenant ใหม่ ให้ใช้ baseline schema ที่เป็นปัจจุบัน แทนการไล่รัน
   migration เก่าทั้งหมด

### Secrets และ environment

- `NEXT_PUBLIC_*`: ต้องมีตอน build; ค่า runtime ที่ server route อ่านต้องตั้ง
  บน Worker เพิ่มด้วย
- secret ฝั่ง server: ตั้งผ่าน Cloudflare secret เท่านั้น
- ไม่ commit `.env` หรือค่า secret ลง git
