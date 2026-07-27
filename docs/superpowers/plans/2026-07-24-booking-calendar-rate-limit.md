# Booking Calendar Rate Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แยก Rate Limit ของ Booking Calendar API เป็น 120 requests ต่อ IP ต่อ 60 วินาที โดยไม่กระทบ public API อื่น

**Architecture:** เพิ่ม `publicCalendar` ใน shared in-memory rate limiter ที่มีอยู่ แล้วเปลี่ยน Booking Calendar route ให้เลือก policy ใหม่นี้ ตัวนับใช้ `CF-Connecting-IP` และรวมทุก villa/month ใน bucket เดียวต่อ IP ตามชื่อ policy

**Tech Stack:** Next.js 16 Route Handler, TypeScript, Vitest, Cloudflare request headers

## Global Constraints

- จำกัดเฉพาะ `GET /api/villas/:id/booking-calendar`
- 120 requests ต่อ 60 วินาทีต่อ `CF-Connecting-IP`
- request ที่ 121 ตอบ `429`, `Retry-After`, `retryAfterSeconds` และ `Cache-Control: no-store`
- ตรวจ Rate Limit ก่อน validation และก่อนเรียก upstream
- ไม่เปลี่ยน `publicDetail` หรือ public API อื่น
- ไม่ commit โดยไม่ได้รับคำสั่งจากผู้ใช้

---

### Task 1: เพิ่ม Calendar Policy และผูกเข้ากับ Route

**Files:**
- Modify: `lib/api/rate-limit.ts`
- Modify: `app/(public)/api/villas/[id]/booking-calendar/route.ts`
- Test: `lib/api/__tests__/rate-limit.test.ts`
- Test: `lib/villas/__tests__/public-routes.test.ts`

**Interfaces:**
- Consumes: `limitPublicApiRequest(request, policy)` และ `CF-Connecting-IP`
- Produces: `PublicRateLimitPolicy` ที่รองรับ `"publicCalendar"` และ config `{ limit: 120, windowMs: 60_000 }`

- [ ] **Step 1: เขียน failing tests**

เพิ่ม assertion ใน shared helper test:

```ts
expect(PUBLIC_RATE_LIMIT_POLICIES.publicCalendar).toEqual({
  limit: 120,
  windowMs: 60_000,
});
```

เปลี่ยน Calendar route test ให้ใช้เพดานใหม่ และพิสูจน์ว่า counter แยกจาก `publicDetail`:

```ts
for (
  let index = 0;
  index < PUBLIC_RATE_LIMIT_POLICIES.publicCalendar.limit;
  index += 1
) {
  expect((await GET(request, context)).status).not.toBe(429);
}

expect((await GET(request, context)).status).toBe(429);
```

- [ ] **Step 2: รัน test เพื่อยืนยัน RED**

Run:

```powershell
npm.cmd test -- lib/api/__tests__/rate-limit.test.ts lib/villas/__tests__/public-routes.test.ts
```

Expected: FAIL เพราะยังไม่มี `publicCalendar` และ route ยังใช้ `publicDetail`

- [ ] **Step 3: เพิ่ม implementation ขั้นต่ำ**

แก้ union และ config:

```ts
export type PublicRateLimitPolicy =
  | "publicCatalog"
  | "publicDetail"
  | "publicCalendar"
  | "publicDownload";

export const PUBLIC_RATE_LIMIT_POLICIES = {
  publicCatalog: { limit: 120, windowMs: ONE_MINUTE_MS },
  publicDetail: { limit: 90, windowMs: ONE_MINUTE_MS },
  publicCalendar: { limit: 120, windowMs: ONE_MINUTE_MS },
  publicDownload: { limit: 20, windowMs: ONE_MINUTE_MS },
} satisfies Record<PublicRateLimitPolicy, PublicRateLimitPolicyConfig>;
```

แก้ Calendar route:

```ts
const rateLimitResponse = limitPublicApiRequest(request, "publicCalendar");
```

- [ ] **Step 4: รัน targeted tests เพื่อยืนยัน GREEN**

Run:

```powershell
npm.cmd test -- lib/api/__tests__/rate-limit.test.ts lib/villas/__tests__/public-routes.test.ts
```

Expected: PASS

- [ ] **Step 5: อัปเดต structure map**

แก้ `docs/ai/structure.html` ให้ระบุว่า Booking Calendar ใช้ policy เฉพาะ 120 requests/IP/minute และข้อจำกัดว่า counter อยู่ใน memory ต่อ runtime instance

- [ ] **Step 6: ตรวจสอบทั้งหมด**

Run:

```powershell
npm.cmd test -- lib/api lib/villas/__tests__/public-routes.test.ts
npm.cmd run lint
npm.cmd run build
git diff --check
```

Expected: tests, lint, build และ diff check ผ่าน โดยไม่มี regression ใหม่
