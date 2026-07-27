# Booking Calendar Token and Behavioral Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม HMAC token ที่ผูกกับ villa/IP/User-Agent และ Cloudflare behavioral rate limits ก่อน Booking Calendar Edge Cache โดยผู้ใช้ทั่วไปยังโหลดปฏิทินอัตโนมัติ

**Architecture:** Worker ออก token จาก endpoint เฉพาะและตรวจ token ก่อน cache lookup โดยแยก crypto/validation เป็น helper ที่ทดสอบได้ Calendar client เก็บและ dedupe token ใน memory พร้อม retry ใหม่ได้หนึ่งครั้ง ส่วน Cloudflare Rate Limiting bindings จำกัดการออก token การใช้ token และ traffic รวมต่อ IP

**Tech Stack:** Cloudflare Workers, Web Crypto HMAC-SHA-256, Wrangler Rate Limiting bindings, TypeScript/JavaScript, Next.js 16 client code, Vitest

## Global Constraints

- Token อายุ 5 นาทีและส่งผ่าน `X-BPV-Calendar-Token` เท่านั้น
- Token ผูกกับ villa ID, `CF-Connecting-IP`, User-Agent และ expiry โดยไม่เปิดเผย IP/User-Agent ใน payload
- Token issuance 20/IP/60 seconds
- Token usage 12/token/60 seconds
- Calendar total 120/IP/60 seconds
- ตรวจ token และ limits ก่อน Edge Cache
- Token/error responses ใช้ `Cache-Control: no-store`
- Client retry token failure ได้หนึ่งครั้งและไม่ retry `429`
- Production ขาด secret หรือ binding ต้อง fail closed
- ไม่ log raw token, secret หรือ IP เต็ม
- ไม่ commit โดยไม่ได้รับคำสั่งจากผู้ใช้

---

### Task 1: HMAC Calendar Token Core

**Files:**
- Create: `worker-calendar-token.js`
- Create: `worker-calendar-token.test.ts`

**Interfaces:**
- Produces: `createBookingCalendarToken(input): Promise<{ expiresAt: number; token: string }>`
- Produces: `verifyBookingCalendarToken(input): Promise<{ valid: boolean; tokenId?: string }>`
- Consumes: villa ID, IP, User-Agent, secret, current time และ optional deterministic nonce สำหรับ test

- [ ] **Step 1: เขียน failing tests**

ครอบคลุม valid token, tampered token, expired token, wrong villa, wrong IP, wrong User-Agent, malformed token และ secret สั้นกว่า 32 ตัวอักษร

- [ ] **Step 2: ยืนยัน RED**

Run:

```powershell
npm.cmd test -- worker-calendar-token.test.ts
```

Expected: FAIL เพราะ module/functions ยังไม่มี

- [ ] **Step 3: เพิ่ม implementation ขั้นต่ำ**

ใช้ token format:

```text
v1.<expiresUnixSeconds>.<base64urlNonce>.<base64urlHmacSha256>
```

HMAC input:

```text
v1\n<villaId>\n<expires>\n<nonce>\n<clientIp>\n<userAgent>
```

ใช้ `crypto.subtle.sign()` และ `crypto.subtle.verify()` ห้ามเปรียบเทียบ signature ด้วย string comparison

- [ ] **Step 4: ยืนยัน GREEN**

Run targeted test เดิมและคาดว่า PASS

---

### Task 2: Worker Token Endpoint และ Behavioral Guards

**Files:**
- Modify: `worker-cache-policy.js`
- Modify: `worker-cache-policy.test.ts`
- Create: `worker-calendar-access.js`
- Create: `worker-calendar-access.test.ts`
- Modify: `worker.js`

**Interfaces:**
- Produces: `handleBookingCalendarAccess(request, env): Promise<Response | null>`
- Token endpoint: `POST /api/villas/:id/booking-calendar-token`
- Calendar endpoint: `GET /api/villas/:id/booking-calendar`
- Required env: `CALENDAR_ACCESS_SECRET`, `CALENDAR_TOKEN_ISSUER_RATE_LIMITER`, `CALENDAR_TOKEN_USAGE_RATE_LIMITER`, `CALENDAR_IP_RATE_LIMITER`

- [ ] **Step 1: เขียน failing access tests**

ทดสอบว่า:

- token endpoint ต้องผ่าน exact host/apex และ marker
- token response มี `{ token, expiresAt }` และ `no-store`
- Calendar request ที่ไม่มี/ผิด/หมดอายุ token ได้ `403`
- missing secret/binding ได้ `503`
- issuer/usage/IP limiter ปฏิเสธด้วย `429`, `Retry-After: 60`
- allowed Calendar requestคืน `null` เพื่อไปต่อยัง cache
- token validation และ limit calls เกิดก่อน cache flow
- rejection log ไม่มี raw token หรือ IP

- [ ] **Step 2: ยืนยัน RED**

Run:

```powershell
npm.cmd test -- worker-calendar-access.test.ts worker-cache-policy.test.ts
```

Expected: FAIL เพราะ endpoint และ handler ยังไม่มี

- [ ] **Step 3: เพิ่ม implementation ขั้นต่ำ**

`worker.js` ต้องเรียก:

```js
const calendarAccessResponse = await handleBookingCalendarAccess(request, env);

if (calendarAccessResponse) {
  return calendarAccessResponse;
}

return fetchWithImageEdgeCache(request, env, ctx);
```

Rate-limit keys ใช้ one-way HMAC identifiers แทน raw IP/token และทุก response ที่บล็อกเป็น JSON `no-store`

- [ ] **Step 4: ยืนยัน GREEN**

รัน targeted tests เดิมและคาดว่า PASS

---

### Task 3: Calendar Client Token Lifecycle

**Files:**
- Create: `components/villas/detail/booking-calendar-client-token.ts`
- Modify: `components/villas/detail/booking-calendar-client-cache.ts`
- Modify: `components/villas/detail/__tests__/booking-calendar-client-cache.test.ts`

**Interfaces:**
- Produces: `fetchBookingCalendarWithToken(url, listingId): Promise<Response>`
- Token cache อยู่ใน memory แยกตาม villa
- Token endpoint ใช้ `POST` และ `X-BPV-Calendar: 1`

- [ ] **Step 1: เขียน failing client tests**

ทดสอบ token request ก่อน Calendar request, dedupe token request, reuse token, refresh ก่อนหมดอายุ, retry `403` หนึ่งครั้ง และไม่ retry `429`

- [ ] **Step 2: ยืนยัน RED**

Run:

```powershell
npm.cmd test -- components/villas/detail/__tests__/booking-calendar-client-cache.test.ts
```

Expected: FAIL เพราะ client ยังส่งเฉพาะ marker

- [ ] **Step 3: เพิ่ม implementation ขั้นต่ำ**

เปลี่ยน Calendar fetch ทั้ง single และ six-month batch ให้ผ่าน token helper โดยยังคง timeout, request dedupe และ Calendar data cache เดิม

- [ ] **Step 4: ยืนยัน GREEN**

รัน targeted client tests และ `booking-sidebar.test.tsx`

---

### Task 4: Cloudflare Configuration และ Documentation

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `DEPLOY.md`
- Modify: `docs/ai/structure.html`

**Interfaces:**
- Adds three `ratelimits` bindings per environment with unique positive integer namespace IDs
- Adds required secret `CALENDAR_ACCESS_SECRET`

- [ ] **Step 1: เพิ่ม bindings**

แต่ละ environment ใช้ namespace IDs ไม่ซ้ำกัน:

```jsonc
{
  "name": "CALENDAR_TOKEN_ISSUER_RATE_LIMITER",
  "namespace_id": "91011",
  "simple": { "limit": 20, "period": 60 }
},
{
  "name": "CALENDAR_TOKEN_USAGE_RATE_LIMITER",
  "namespace_id": "91012",
  "simple": { "limit": 12, "period": 60 }
},
{
  "name": "CALENDAR_IP_RATE_LIMITER",
  "namespace_id": "91013",
  "simple": { "limit": 120, "period": 60 }
}
```

ใช้ mapping ต่อไปนี้:

| Environment | Issuer | Token usage | Calendar IP |
| --- | ---: | ---: | ---: |
| `baanparty` | `91011` | `91012` | `91013` |
| `baan02` | `92011` | `92012` | `92013` |
| `baanPMhee` | `93011` | `93012` | `93013` |

เพิ่ม `CALENDAR_ACCESS_SECRET` ใน required secrets โดยไม่ใส่ค่าจริง การใส่ bindings ให้ `baanPMhee` รักษาพฤติกรรม fail-closed โดยไม่ทำให้ environment ที่มีอยู่ขาด binding หากเปิด Calendar

- [ ] **Step 2: อัปเดตเอกสาร**

บันทึก token flow, fail-closed behavior, per-location accuracy, secret length อย่างน้อย 32 ตัวอักษร และคำสั่งตั้ง secret โดยไม่เปิดเผยค่า

- [ ] **Step 3: ตรวจ config**

Run:

```powershell
npx.cmd wrangler deploy --dry-run --env baanparty
npx.cmd wrangler deploy --dry-run --env baan02
```

Expected: config ผ่านและแสดง rate-limit bindings ครบ

---

### Task 5: Full Verification

**Files:**
- Verify all modified files

- [ ] **Step 1: Targeted tests**

```powershell
npm.cmd test -- worker-calendar-token.test.ts worker-calendar-access.test.ts worker-cache-policy.test.ts components/villas/detail/__tests__/booking-calendar-client-cache.test.ts components/villas/detail/__tests__/booking-sidebar.test.tsx lib/api lib/villas/__tests__/public-routes.test.ts
```

- [ ] **Step 2: Full verification**

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
node --check worker.js
node --check worker-calendar-token.js
node --check worker-calendar-access.js
git diff --check
```

Expected: tests, lint, build, syntax checks และ diff check ผ่านโดยไม่มี regression ใหม่
