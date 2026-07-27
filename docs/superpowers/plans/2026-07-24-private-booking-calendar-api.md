# Private Booking Calendar API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preload 14 booking-calendar months into each villa page while keeping the existing calendar route available only to server-side consumers with a secret Bearer token.

**Architecture:** The villa Server Component calls the shared upstream loader directly and passes a bounded 14-month record through the existing detail component tree. The browser performs no calendar fetch. A Worker guard and the Next Route Handler independently validate `CALENDAR_INTERNAL_API_TOKEN`; the private response bypasses Edge JSON caching and is limited to 60 requests per IP per minute.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Vitest, Cloudflare Workers/OpenNext, Wrangler rate-limit bindings, Web Crypto.

## Global Constraints

- Work on branch `refactor/site_settings` and preserve unrelated user changes.
- Do not run `git commit` unless the user explicitly asks; use review checkpoints instead of automatic commit steps.
- Read relevant local Next.js 16 docs before touching routes or caching; the required caching and Route Handler guides were reviewed during design.
- Use `CALENDAR_INTERNAL_API_TOKEN` only on the server; never expose it through `NEXT_PUBLIC_*`, HTML, RSC, URL, response body, or logs.
- `PATTAYA_BOOKINGS_API_TOKEN` remains unchanged and continues to authenticate only the upstream Pattaya bookings API.
- Villa navigation is exactly previous one month, current month, and next 12 months: 14 months total.
- Villa HTML Edge Cache is 900 seconds. The existing booking data cache remains 900 seconds, so worst-case visible upstream staleness is approximately 30 minutes.
- The Private Calendar API accepts `month=YYYY-MM` and integer `months=1..14`, defaulting to one month.
- Private API responses and errors use `Cache-Control: private, no-store`.
- Keep `hot_holidays` priority above ordinary `holidays`; bookings continue to override both.
- Update `docs/ai/structure.html` because the public contract and cache flow change.

---

### Task 1: Add the 14-month server preload owner

**Files:**
- Create: `lib/villas/booking-calendar-preload.ts`
- Create: `lib/villas/__tests__/booking-calendar-preload.test.ts`
- Read only: `lib/villas/booking-calendar.ts`

**Interfaces:**
- Consumes: `fetchVillaBookingCalendar(propertyId: string, month: string): Promise<FetchVillaBookingCalendarResult>`
- Produces:

```ts
export interface VillaBookingCalendarPreload {
  calendars: Record<string, BookingCalendarMonth>;
  unavailableMonths: string[];
}

export function getBangkokBookingCalendarMonthKeys(
  now?: Date,
): string[];

export async function preloadVillaBookingCalendars(
  propertyId: string,
  now?: Date,
): Promise<VillaBookingCalendarPreload>;
```

- [ ] **Step 1: Write failing tests for Bangkok month boundaries and partial failure**

Mock `fetchVillaBookingCalendar`, then assert:

```ts
expect(
  getBangkokBookingCalendarMonthKeys(
    new Date("2026-07-31T18:30:00.000Z"),
  ),
).toEqual([
  "2026-07",
  "2026-08",
  "2026-09",
  "2026-10",
  "2026-11",
  "2026-12",
  "2027-01",
  "2027-02",
  "2027-03",
  "2027-04",
  "2027-05",
  "2027-06",
  "2027-07",
  "2027-08",
]);
```

The instant above is already August 1 in Bangkok, so July is the previous month. Add a test where one mocked month returns `unavailable` and verify the other 13 calendars remain present while the failed key appears in `unavailableMonths`.

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run:

```powershell
npm.cmd test -- lib/villas/__tests__/booking-calendar-preload.test.ts
```

Expected: FAIL because `booking-calendar-preload.ts` does not exist.

- [ ] **Step 3: Implement deterministic Bangkok month generation and resilient loading**

Use `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).formatToParts(now)` to obtain the Bangkok year/month. Generate offsets `-1..12` with UTC month arithmetic. Use `Promise.allSettled` around all 14 loader calls; add only `status === "available"` calendars to the record and classify every other result as unavailable.

- [ ] **Step 4: Run preload and existing normalization tests**

Run:

```powershell
npm.cmd test -- lib/villas/__tests__/booking-calendar-preload.test.ts lib/villas/__tests__/booking-calendar.test.ts
```

Expected: PASS, including the existing `hot_holidays` priority assertions.

- [ ] **Step 5: Review checkpoint**

Inspect `git diff --check` and confirm this task changes no route, client, Worker, or secret behavior yet. Do not commit without a new explicit instruction.

---

### Task 2: Replace browser fetching with initial calendar props

**Files:**
- Modify: `app/(public)/villas/[id]/page.tsx`
- Modify: `components/villas/detail/types.ts`
- Modify: `components/villas/detail/page.tsx`
- Modify: `components/villas/detail/detail-client-shell.tsx`
- Modify: `components/villas/detail/detail-layout-renderer.tsx`
- Modify: `components/villas/detail/detail-layout-blocks.tsx`
- Modify: `components/villas/detail/booking-sidebar.tsx`
- Modify: `components/villas/detail/booking-calendar-panel.tsx`
- Modify: `components/villas/detail/__tests__/booking-sidebar.test.tsx`
- Delete: `components/villas/detail/booking-calendar-client-cache.ts`
- Delete: `components/villas/detail/booking-calendar-client-token.ts`
- Delete: `components/villas/detail/__tests__/booking-calendar-client-cache.test.ts`

**Interfaces:**
- Consumes: `preloadVillaBookingCalendars(id)` from Task 1
- Produces: `bookingCalendars: Record<string, BookingCalendarMonth>` passed from the route page to every `BookingSidebar`

- [ ] **Step 1: Rewrite sidebar tests around initial data**

Create a fixture keyed only by month:

```ts
const bookingCalendars = {
  "2026-07": {
    days: {
      "2026-07-15": {
        disabled: false,
        displayPrice: "9,900",
        guestCapacity: "12",
        holidayAlert: null,
        icons: [],
        kind: "base",
        label: "วันธรรมดา",
        price: 9900,
        promotionMessage: null,
        tone: "default",
      },
    },
    month: "2026-07",
    status: "available",
  },
} satisfies Record<string, BookingCalendarMonth>;
```

Pass the fixture to `BookingSidebar`, mock `global.fetch`, change months through the existing navigation, and assert `fetch` is never called. Add a missing-month case and assert its date buttons stay disabled.

- [ ] **Step 2: Run the sidebar test and verify prop failures**

Run:

```powershell
npm.cmd test -- components/villas/detail/__tests__/booking-sidebar.test.tsx
```

Expected: FAIL because the component tree does not accept `bookingCalendars`.

- [ ] **Step 3: Wire the server preload into the villa route**

Add `preloadVillaBookingCalendars(id)` to the page-level `Promise.all`. Pass `calendarPreload.calendars` as `bookingCalendars` to `VillaDetailPage`. Do not call the private route and do not read `CALENDAR_INTERNAL_API_TOKEN` in the page.

- [ ] **Step 4: Carry the bounded record through existing owners**

Add `bookingCalendars` to `VillaDetailPageProps`, `VillaDetailClientShellProps`, `DetailLayoutBlockContext`, and `DetailLayoutRenderer` props. Pass the same record to both the mobile and desktop `BookingSidebar` instances so neither creates its own request.

- [ ] **Step 5: Remove client request state**

Change `BookingCalendarPanel` to accept:

```ts
interface BookingCalendarPanelProps {
  bookingCalendars: Record<string, BookingCalendarMonth>;
  contactLinks: { line: string; messenger: string };
  fallbackPrice: number | null;
  primaryPhoneContact?: { href: string; phone: string };
}
```

Resolve the visible month with `bookingCalendars[visibleMonthKey] ?? null`. Remove `listingId`, `useEffect`, request dedupe, retry, token refresh, and client cache imports. Delete the two client loader files and their obsolete cache test.

- [ ] **Step 6: Run the focused component tests**

Run:

```powershell
npm.cmd test -- components/villas/detail/__tests__/booking-sidebar.test.tsx components/villas/detail/__tests__/booking-calendar-ui.test.ts
```

Expected: PASS with zero `fetch` calls from calendar navigation.

- [ ] **Step 7: Review checkpoint**

Search:

```powershell
rg -n "booking-calendar-token|X-BPV-Calendar|loadBookingCalendar|fetchBookingCalendarWithToken" components app
```

Expected: no browser-side references. Do not commit without a new explicit instruction.

---

### Task 3: Protect the retained Next Calendar API with a secret Bearer

**Files:**
- Create: `lib/api/calendar-internal-auth.ts`
- Create: `lib/api/__tests__/calendar-internal-auth.test.ts`
- Modify: `app/(public)/api/villas/[id]/booking-calendar/route.ts`
- Modify: `lib/villas/public-booking-calendar-route.ts`
- Modify: `lib/villas/__tests__/public-routes.test.ts`
- Modify: `lib/api/rate-limit.ts`
- Modify: `lib/api/__tests__/rate-limit.test.ts`

**Interfaces:**
- Produces:

```ts
export async function requireCalendarInternalBearer(
  request: Request,
): Promise<Response | null>;
```

- The route applies authorization, then the `publicCalendar` policy at 60/IP/minute, then validation/loading.

- [ ] **Step 1: Write failing authorization tests**

Cover:

```ts
await expectStatus({ secret: undefined, authorization: undefined }, 503);
await expectStatus({ secret: "a".repeat(43), authorization: undefined }, 401);
await expectStatus({
  secret: "a".repeat(43),
  authorization: "Bearer wrong",
}, 401);
await expectAllowed({
  secret: "a".repeat(43),
  authorization: `Bearer ${"a".repeat(43)}`,
});
```

Assert rejected responses contain `Cache-Control: private, no-store`; `401` also contains `WWW-Authenticate: Bearer`.

- [ ] **Step 2: Run auth tests and confirm the missing-module failure**

Run:

```powershell
npm.cmd test -- lib/api/__tests__/calendar-internal-auth.test.ts
```

Expected: FAIL because the auth helper does not exist.

- [ ] **Step 3: Implement timing-safe server authorization**

Read `process.env.CALENDAR_INTERNAL_API_TOKEN`, require at least 32 characters, parse exactly one `Bearer ` credential, hash expected and supplied values to equal-length SHA-256 byte arrays, and compare without an early-exit byte mismatch. Return `503` for missing configuration, `401` for missing/invalid credentials, and `null` for success. Never include either credential in an error or log.

- [ ] **Step 4: Make route tests require Bearer and support a bounded batch**

Update tests so every success/validation/rate-limit case sets the valid Authorization header. Add assertions for:

```text
months absent -> one object
months=1 -> one object
months=14 -> fourteen objects
months=0, months=15, months=6.5, duplicate months -> 400
```

Also assert success now uses `Cache-Control: private, no-store`.

- [ ] **Step 5: Implement the private route contract**

In the Route Handler, call `await requireCalendarInternalBearer(request)` before rate limiting. Change `PUBLIC_RATE_LIMIT_POLICIES.publicCalendar.limit` from `120` to `60`.

In `buildVillaBookingCalendarResponse`, require exactly one `month` and at most one `months`, parse the latter as an ASCII integer from 1 through 14, and retain UTC month arithmetic. Replace the prior public cache header with:

```ts
const PRIVATE_CALENDAR_HEADERS = {
  "Cache-Control": "private, no-store",
};
```

Apply it to success, validation, missing-upstream-token, and upstream-unavailable responses.

- [ ] **Step 6: Run route, auth, and rate-limit tests**

Run:

```powershell
npm.cmd test -- lib/api/__tests__/calendar-internal-auth.test.ts lib/api/__tests__/rate-limit.test.ts lib/villas/__tests__/public-routes.test.ts
```

Expected: PASS; the 61st request from one IP receives `429`.

- [ ] **Step 7: Review checkpoint**

Confirm no test or production code places `CALENDAR_INTERNAL_API_TOKEN` in a `NEXT_PUBLIC_*` variable or response. Do not commit without a new explicit instruction.

---

### Task 4: Replace the Worker token flow with a private Bearer guard

**Files:**
- Modify: `worker-calendar-access.js`
- Modify: `worker-calendar-access.test.ts`
- Modify: `worker-cache-policy.js`
- Modify: `worker-cache-policy.test.ts`
- Modify: `worker.js`
- Modify: `wrangler.jsonc`
- Delete: `worker-calendar-token.js`
- Delete: `worker-calendar-token.test.ts`

**Interfaces:**
- Consumes Worker env:

```ts
{
  CALENDAR_INTERNAL_API_TOKEN: string;
  CALENDAR_API_RATE_LIMITER: { limit(input: { key: string }): Promise<{ success: boolean }> };
  NEXT_PUBLIC_SITE_URL: string;
}
```

- Produces: `handleBookingCalendarAccess(request, env): Promise<Response | null>`

- [ ] **Step 1: Replace Worker tests with the private flow**

Test exact configured `www` and apex hosts, reject sibling hosts such as `cl.example.com`, reject missing/wrong Bearer with `401`, reject missing secret/binding with `503`, reject the 61st IP request with `429`, and allow a valid request by returning `null`.

Also assert `/api/villas/:id/booking-calendar-token` is no longer a guarded or existing endpoint.

- [ ] **Step 2: Run Worker tests and verify failures against the old HMAC flow**

Run:

```powershell
npm.cmd test -- worker-calendar-access.test.ts worker-calendar-token.test.ts worker-cache-policy.test.ts
```

Expected: FAIL because the current implementation expects browser marker/HMAC tokens and three rate-limit bindings.

- [ ] **Step 3: Implement the simple Worker Bearer guard**

Keep the exact-host decision, remove the browser marker and token endpoint target, validate `GET` plus the Bearer credential with Web Crypto timing-safe comparison, then call `CALENDAR_API_RATE_LIMITER.limit({ key: clientIp })`. Return only `404`, `401`, `405`, `429`, or `503` no-store JSON responses; never log Authorization.

- [ ] **Step 4: Remove Calendar API from Worker JSON Edge caching**

Delete calendar query handling from `createJsonEdgeCacheKey`, `getJsonCacheVersionGroups`, `getJsonCacheControl`, and `getJsonEdgeCacheDecision`. The access guard must run before OpenNext, but authorized responses still bypass shared Edge JSON cache.

Change `VILLA_DETAIL_HTML_EDGE_CACHE_CONTROL` to `public, s-maxage=900` and update its test.

- [ ] **Step 5: Simplify Wrangler bindings**

For each environment:

- replace required `CALENDAR_ACCESS_SECRET` with `CALENDAR_INTERNAL_API_TOKEN`
- replace the three token behavior bindings with one `CALENDAR_API_RATE_LIMITER`
- reuse the existing per-environment IP namespace IDs `91013`, `92013`, and `93013`
- configure `limit: 60`, `period: 60`

Delete the HMAC token module and test.

- [ ] **Step 6: Run Worker tests and Wrangler dry-runs**

Run:

```powershell
npm.cmd test -- worker-calendar-access.test.ts worker-cache-policy.test.ts
npx.cmd wrangler deploy --dry-run -e baanparty
npx.cmd wrangler deploy --dry-run -e baan02
```

Expected: PASS; each dry-run reports only `CALENDAR_API_RATE_LIMITER` for this feature at 60/60 and requires `CALENDAR_INTERNAL_API_TOKEN`.

- [ ] **Step 7: Review checkpoint**

Search:

```powershell
rg -n "CALENDAR_ACCESS_SECRET|CALENDAR_TOKEN_|X-BPV-Calendar|booking-calendar-token" worker*.js worker*.ts wrangler.jsonc
```

Expected: no matches. Do not commit without a new explicit instruction.

---

### Task 5: Update deployment and architecture documentation

**Files:**
- Modify: `DEPLOY.md`
- Modify: `docs/ai/structure.html`
- Keep: `docs/superpowers/specs/2026-07-24-private-booking-calendar-api-design.md`

**Interfaces:**
- Documents the server preload, Private API contract, 900-second HTML cache, secret rotation, and removal of the browser token flow.

- [ ] **Step 1: Update deployment instructions**

Document safe generation compatible with older PowerShell:

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

Repeat generation independently for `baan02`. State that the new secret must exist before deploy and that `CALENDAR_ACCESS_SECRET` should be deleted only after successful verification. Do not deploy.

- [ ] **Step 2: Update the structure map**

Replace the public browser calendar/token descriptions with:

- 14-month Server Component preload
- initial-prop client calendar with no fetch
- private Bearer Route Handler and Worker guard
- 60/IP/minute defense-in-depth limit
- private no-store API response
- 15-minute villa HTML Edge Cache and possible 30-minute combined staleness

Remove obsolete token endpoint, HMAC, marker, and client-cache ownership entries.

- [ ] **Step 3: Verify documentation and stale references**

Run:

```powershell
rg -n "CALENDAR_ACCESS_SECRET|CALENDAR_TOKEN_|X-BPV-Calendar|booking-calendar-token|HMAC token" DEPLOY.md docs/ai/structure.html app components lib worker*.js worker*.ts wrangler.jsonc
git diff --check
```

Expected: no obsolete production references; historical approved specs may still describe the earlier design.

- [ ] **Step 4: Review checkpoint**

Confirm the docs clearly distinguish `CALENDAR_INTERNAL_API_TOKEN` from `PATTAYA_BOOKINGS_API_TOKEN`. Do not commit without a new explicit instruction.

---

### Task 6: Full verification and browser proof

**Files:**
- Modify only if verification reveals a defect in files already listed above.

**Interfaces:**
- Produces evidence that the public page has bounded requests and the private route rejects unauthorized callers.

- [ ] **Step 1: Run the complete automated suite**

Run:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Expected: all tests pass, ESLint has no new errors, and the production build succeeds.

- [ ] **Step 2: Run static safety checks**

Run:

```powershell
rg -n "CALENDAR_INTERNAL_API_TOKEN" app components
rg -n "fetch\\(" components/villas/detail/booking-calendar-panel.tsx components/villas/detail/booking-sidebar.tsx
git diff --check
```

Expected: the secret is referenced only in server/Worker/deploy code, calendar UI contains no fetch, and the diff has no whitespace errors.

- [ ] **Step 3: Perform production-mode browser network verification**

Start the production build locally, open `/villas/1981`, and inspect mobile and desktop. Confirm:

- the current month renders immediately
- navigation reaches all 14 bounded months
- missing data disables only the affected month
- no request contains `booking-calendar` or `booking-calendar-token`
- no unexpected `_rsc` request appears
- no public `/_next/image` request appears
- route/API counts remain bounded

- [ ] **Step 4: Verify the private API boundary without printing the secret**

Call the local/preview route without Authorization and expect `401`. Call it with the secret supplied from a server-side environment variable and expect `200`, one to 14 calendars, and `Cache-Control: private, no-store`. Do not echo the token into terminal output.

- [ ] **Step 5: Final review checkpoint**

Summarize changed files, tests, browser request counts, known cache staleness, and required pre-deploy secret commands. Leave all changes uncommitted unless the user explicitly requests a commit.
