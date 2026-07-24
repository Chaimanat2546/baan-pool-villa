# Deploy Guide

คู่มือนี้ใช้กับโปรเจคแบบหลายเว็บที่ใช้ codebase เดียวกัน แต่แยก Worker, URL, cache bucket, Supabase DB/content และค่า env ต่อเว็บ

## หลักการ

- เว็บหนึ่งตัว = Wrangler env หนึ่งตัวใน `wrangler.jsonc`
- ไฟล์ `.env.<site>` ใช้สำหรับ local และตอน build เท่านั้น ห้าม commit
- ค่า `NEXT_PUBLIC_*` ถูกฝังตอน `next build` จึงต้อง copy env ของเว็บนั้นเป็น `.env` ก่อน build ทุกครั้ง
- Cloudflare runtime config ต้องตั้งแยกต่อ env ด้วย โดยเฉพาะ secrets และ public vars ที่ไม่ได้เขียนไว้ใน `wrangler.jsonc`
- ตอนนี้อย่าใช้ `npm.cmd run deploy:cf` กับหลายเว็บ เพราะ script นั้นไม่ได้ส่ง `-e <env>`

## Env ปัจจุบัน

| Site | Wrangler env | Worker | Public URL | R2 cache bucket | Local env file |
| --- | --- | --- | --- | --- | --- |
| Baan Party Pattaya | `baanparty` | `baan-pool-villa` | `https://www.baanpartypattaya.com` | `baan-pool-villa-next-cache` | `.env.baanparty` |
| Baan 02 | `baan02` | `baan-pool-villa02` | `https://www.poolvillapattaya.co.th` | `baan-pool-villa02-next-cache` | `.env.baan02` |

## เพิ่มเว็บใหม่

1. ตั้งชื่อ env สั้นๆ เช่น `baan03`
2. ตั้งชื่อ Worker ให้ unique เช่น `baan-pool-villa03`
3. ตั้งชื่อ R2 bucket ให้ unique เช่น `baan-pool-villa03-next-cache`
4. สร้างไฟล์ local env:

```powershell
Copy-Item .env.example .env.baan03
```

5. เติมค่าใน `.env.baan03` ให้ครบ โดยไม่ commit ไฟล์นี้
6. เพิ่ม block ใหม่ใน `wrangler.jsonc` ใต้ `env` โดย copy จาก env เดิม แล้วแก้เฉพาะ:

```jsonc
"baan03": {
  "name": "baan-pool-villa03",
  "version_metadata": {
    "binding": "CF_VERSION_METADATA"
  },
  "images": {
    "binding": "IMAGES"
  },
  "vars": {
    "NEXT_PUBLIC_SITE_URL": "https://www.your-new-site.example"
  },
  "services": [
    {
      "binding": "WORKER_SELF_REFERENCE",
      "service": "baan-pool-villa03"
    }
  ],
  "r2_buckets": [
    {
      "binding": "NEXT_INC_CACHE_R2_BUCKET",
      "bucket_name": "baan-pool-villa03-next-cache"
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "name": "NEXT_CACHE_DO_QUEUE",
        "class_name": "DOQueueHandler"
      },
      {
        "name": "NEXT_TAG_CACHE_DO_SHARDED",
        "class_name": "DOShardedTagCache"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["DOQueueHandler"]
    },
    {
      "tag": "v2",
      "new_sqlite_classes": ["DOShardedTagCache"]
    }
  ],
  "secrets": {
    "required": [
      "CALENDAR_INTERNAL_API_TOKEN",
      "DEVILLE_BEARER_TOKEN",
      "SUPABASE_PUBLISHABLE_KEY"
    ]
  }
}
```

7. สร้าง R2 bucket:

```powershell
npx.cmd wrangler r2 bucket create baan-pool-villa03-next-cache
```

8. ตั้ง Cloudflare secrets ต่อ env:

```powershell
npx.cmd wrangler secret put DEVILLE_BEARER_TOKEN -e baanparty
npx.cmd wrangler secret put SUPABASE_PUBLISHABLE_KEY -e baanparty
npx.cmd wrangler secret put PATTAYA_BOOKINGS_API_TOKEN -e baanparty
npx.cmd wrangler secret put TURNSTILE_SECRET_KEY -e baanparty
```

`CALENDAR_INTERNAL_API_TOKEN` เป็น Bearer token สำหรับ Private Calendar API เท่านั้น
ไม่ใช่ `PATTAYA_BOOKINGS_API_TOKEN` ซึ่งใช้เรียก upstream Pattaya bookings API ใช้คนละค่าต่อ env
และห้ามเก็บใน `.env`, `wrangler.jsonc`, source code, URL, log หรือชื่อที่ขึ้นต้นด้วย
`NEXT_PUBLIC_` Browser ไม่เรียก Calendar API และไม่ได้รับ token นี้
ตั้งค่า token นี้ด้วย PowerShell RNG snippet ด้านล่างเท่านั้น

สร้างและบันทึก secret โดยไม่แสดงค่าบนหน้าจอด้วย PowerShell:

```powershell
$calendarInternalTokenBytes = New-Object byte[] 32
$calendarInternalTokenRng = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $calendarInternalTokenRng.GetBytes($calendarInternalTokenBytes)
  [Convert]::ToBase64String($calendarInternalTokenBytes) |
    npx.cmd wrangler secret put CALENDAR_INTERNAL_API_TOKEN -e baanparty
} finally {
  $calendarInternalTokenRng.Dispose()
}
```

รันชุดคำสั่งสร้างค่านี้ใหม่ตั้งแต่บรรทัดแรกสำหรับแต่ละ Wrangler env ที่ใช้งาน:
`baanparty`, `baan02`, และ `baanPMhee` โดยเปลี่ยนหลัง `-e` ให้ตรงกับ env นั้น
ทุก env ต้องได้ค่าที่สุ่มแยกกัน ห้ามคัดลอก Bearer token ระหว่างกัน

ต้องตั้ง `CALENDAR_INTERNAL_API_TOKEN` ใหม่ใน env เป้าหมายก่อน deploy โค้ดใหม่นี้
หลัง deploy และยืนยันการทำงานสำเร็จแล้วเท่านั้น จึงลบ `CALENDAR_ACCESS_SECRET` เดิมได้

ถ้าขั้นตอนสร้างค่าสุ่มเกิด error ให้หยุดทันที ห้ามนำ `$calendarInternalTokenBytes`
ไปใช้ต่อ เพราะอาจยังเป็น byte ศูนย์ทั้งหมดและคาดเดาได้

ตรวจเฉพาะรายชื่อ secret หลังตั้งค่า:

```powershell
npx.cmd wrangler secret list -e baanparty
npx.cmd wrangler secret list -e baan02
npx.cmd wrangler secret list -e baanPMhee
```

คำสั่งตรวจจะแสดงเฉพาะชื่อ secret โดยไม่เปิดเผยค่าจริง

9. ตั้ง public vars ใน Cloudflare dashboard ของ Worker/env นั้น:

```text
NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL
NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_TURNSTILE_SITE_KEY
```

`NEXT_PUBLIC_SITE_URL` อยู่ใน `wrangler.jsonc` แล้ว แต่ต้องมีค่าเดียวกันใน `.env.<site>` สำหรับตอน build

สำหรับ Private Calendar API ค่านี้ต้องเป็น HTTPS official domain ที่ขึ้นต้นด้วย
`www.` เท่านั้น Worker จะอนุญาต host นี้และ apex คู่กันแบบ exact match
เช่น `https://www.example.com` จะอนุญาตเฉพาะ `www.example.com` กับ
`example.com` ส่วน sibling subdomain และ `*.workers.dev` alias จะถูกปฏิเสธ
ถ้ายังไม่มี official `www` domain ห้ามเดาหรือใช้ Workers.dev alias แทน เพราะ
Calendar API จะ fail closed ด้วย `503` จนกว่าจะตั้งค่า domain ที่อนุมัติแล้ว

## Deploy ทีละเว็บ

คำสั่ง `opennextjs-cloudflare deploy` ใช้ `.open-next` ที่ build ไว้แล้ว ถ้าเปลี่ยน `.env` แล้วต้อง run `opennextjs-cloudflare build -e <env>` ใหม่ก่อน deploy เสมอ

### Deploy `baanparty`

```powershell
Copy-Item -Force .env.baanparty .env
npm.cmd run lint
npm.cmd test
npx.cmd opennextjs-cloudflare build -e baanparty
npx.cmd opennextjs-cloudflare deploy -e baanparty
npm.cmd run prewarm:cf -- --url=https://www.baanpartypattaya.com
```

### Deploy `baan02`

```powershell
Copy-Item -Force .env.baan02 .env
npm.cmd run lint
npm.cmd test
npx.cmd opennextjs-cloudflare build -e baan02
npx.cmd opennextjs-cloudflare deploy -e baan02
npm.cmd run prewarm:cf -- --url=https://www.poolvillapattaya.co.th
```

### Deploy เว็บใหม่

แทนชื่อ env, env file และ URL ให้ตรงกับเว็บนั้น:

```powershell
Copy-Item -Force .env.baan03 .env
npm.cmd run lint
npm.cmd test
npx.cmd opennextjs-cloudflare build -e baan03
npx.cmd opennextjs-cloudflare deploy -e baan03
npm.cmd run prewarm:cf -- --url=https://your-new-site.example
```

## Local staging

ถ้าต้องการรันเว็บ local แต่ใช้ DB online ให้สร้างไฟล์แยก เช่น:

```text
.env.baanparty.staging
```

ตั้งค่า `NEXT_PUBLIC_SITE_URL` เป็น local:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL=
NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
DEVILLE_BEARER_TOKEN=
PATTAYA_BOOKINGS_API_TOKEN=
SUPABASE_PUBLISHABLE_KEY=
TURNSTILE_SECRET_KEY=
```

แล้วรัน:

```powershell
Copy-Item -Force .env.baanparty.staging .env
npm.cmd run dev
```

ถ้า staging ชี้ DB production จริง ให้ใช้สำหรับอ่านข้อมูลหรือทดสอบ UI เท่านั้น อย่า save admin/blog/settings/upload เพราะจะเขียนข้อมูลจริง

## เช็คก่อน deploy

- `.env` ต้องมาจากเว็บที่กำลัง deploy
- `wrangler.jsonc` env name ต้องตรงกับ `-e <env>`
- `services[].service` ต้องตรงกับ Worker name ของ env นั้น
- R2 bucket ต้องแยกต่อเว็บ
- Cloudflare secrets ต้องตั้งครบต่อ env
- Supabase public URL/key ต้องเป็น DB ของเว็บนั้น
- หลัง deploy ให้เช็ค `x-bpv-html-cache` จาก `MISS` เป็น `HIT` บน public page ที่ prewarm

## คำสั่งช่วยตรวจ config

```powershell
npx.cmd wrangler deploy --dry-run -e baanparty
npx.cmd wrangler deploy --dry-run -e baan02
```

Dry-run ควรเห็น bindings เหล่านี้:

```text
NEXT_CACHE_DO_QUEUE
NEXT_TAG_CACHE_DO_SHARDED
NEXT_INC_CACHE_R2_BUCKET
WORKER_SELF_REFERENCE
IMAGES
ASSETS
CF_VERSION_METADATA
NEXT_PUBLIC_SITE_URL
CALENDAR_API_RATE_LIMITER
```

## ถ้า deploy แล้ว DB ผิดเว็บ

สาเหตุที่พบบ่อยคือ `.open-next` ยังเป็น build ของเว็บก่อนหน้า เช่น deploy `baan02` แต่ `.open-next` ยังฝังค่า `baanparty`

แก้ด้วยการ copy env ของเว็บนั้น แล้ว build ใหม่ก่อน deploy:

```powershell
Copy-Item -Force .env.baan02 .env
npx.cmd opennextjs-cloudflare build -e baan02
npx.cmd opennextjs-cloudflare deploy -e baan02
```

ถ้ายังผิด ให้เช็ค Cloudflare dashboard ของ Worker/env นั้นว่า public vars เหล่านี้เป็น DB ของเว็บนั้นจริง:

```text
NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL
NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY
```
