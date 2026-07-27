# Booking Calendar Exact Host Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject booking-calendar API requests whose exact hostname differs from the configured public site hostname.

**Architecture:** Add a pure access-decision helper beside the existing Worker cache policy helpers and call it at the top of the Worker fetch handler, before any image, JSON, or HTML cache lookup. Use `NEXT_PUBLIC_SITE_URL` as the single source of truth and fail closed for booking-calendar requests when it is missing or invalid.

**Tech Stack:** Cloudflare Workers ES modules, JavaScript, Vitest

## Global Constraints

- Protect only `/api/villas/:id/booking-calendar`.
- Compare exact hostnames; do not allow suffix or wildcard matches.
- Do not change successful booking-calendar cache keys or TTLs.
- Return a non-cacheable `404` for a rejected hostname.
- Preserve existing uncommitted booking-calendar normalization changes.
- Do not commit unless ภู explicitly requests it.

---

### Task 1: Exact Host Decision and Enforcement

**Files:**
- Modify: `worker-cache-policy.test.ts`
- Modify: `worker-cache-policy.js`
- Modify: `worker.js`
- Modify: `docs/ai/structure.html`

**Interfaces:**
- Produces: `getBookingCalendarHostAccessDecision(request, configuredSiteUrl)`
- Consumes: `env.NEXT_PUBLIC_SITE_URL` in the Worker fetch handler

- [ ] **Step 1: Write failing policy tests**

Add tests proving that the configured hostname is allowed, a sibling subdomain is denied, invalid configuration fails closed, and unrelated paths are not candidates.

- [ ] **Step 2: Run the focused Worker policy test and verify RED**

Run `npm.cmd test -- worker-cache-policy.test.ts`.

Expected: failure because `getBookingCalendarHostAccessDecision` is not exported.

- [ ] **Step 3: Implement the minimal pure decision helper**

Parse both URLs with `new URL()`, reuse `isVillaBookingCalendarApiPath`, and compare `requestUrl.hostname === configuredUrl.hostname`.

- [ ] **Step 4: Enforce the decision before cache lookup**

Call the helper at the beginning of `worker.fetch`. Return JSON `{ "error": "Not found." }` with status `404` and `Cache-Control: no-store` when denied.

- [ ] **Step 5: Document the security boundary**

Update the Worker row in `docs/ai/structure.html` to state that booking-calendar JSON requests require the exact configured public hostname before edge-cache lookup.

- [ ] **Step 6: Verify**

Run:

```powershell
npm.cmd test -- worker-cache-policy.test.ts
npm.cmd test -- lib/villas/__tests__/booking-calendar.test.ts
npm.cmd run lint
npm.cmd run build
```

Expected: focused tests, lint, and production build exit successfully.
