# Staging Workers.dev Booking Calendar Host Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permit the exact configured staging Worker hostname to reach private booking-calendar Bearer authentication while preserving the production `www` plus apex boundary.

**Architecture:** Extend `getBookingCalendarAccessDecision` with one narrow direct-Worker-host branch. A valid `<worker>.<account>.workers.dev` configuration permits only an exact hostname match; normal `www` configurations retain their existing exact-host and apex behavior.

**Tech Stack:** JavaScript Cloudflare Worker wrapper, Vitest, Wrangler

## Global Constraints

- Keep production `www` and apex behavior unchanged.
- Require HTTPS for configuration and requests.
- Reject sibling Workers, extra subdomains, broad `workers.dev` hosts, and malformed configuration.
- Do not change Bearer validation, rate-limit values, cache behavior, or production secrets.
- Do not commit unless the user explicitly requests it.

---

### Task 1: Exact Direct Workers.dev Host Policy

**Files:**
- Modify: `worker-cache-policy.test.ts`
- Modify: `worker-calendar-access.test.ts`
- Modify: `worker-cache-policy.js`
- Modify: `docs/ai/structure.html`

**Interfaces:**
- Consumes: `getBookingCalendarAccessDecision(request, configuredSiteUrl)`
- Produces: the existing access-decision shape `{ allowed, candidate, reason }`

- [ ] **Step 1: Write failing policy and guard tests**

Add literal cases proving the exact configured hostname
`baan-pool-villa-staging.chaymanus2003.workers.dev` is accepted, while
`other-worker.chaymanus2003.workers.dev`,
`preview.baan-pool-villa-staging.chaymanus2003.workers.dev`, and
`chaymanus2003.workers.dev` fail closed. Add a guard-level case showing that a
valid request on the exact staging hostname proceeds through Bearer checking.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npm.cmd test -- worker-cache-policy.test.ts worker-calendar-access.test.ts
```

Expected: the exact staging hostname cases fail because current configuration
requires a hostname beginning with `www.`.

- [ ] **Step 3: Implement the minimal hostname branch**

Add a small predicate that recognizes exactly four non-empty labels ending in
`.workers.dev`. In `getBookingCalendarAccessDecision`, accept either the
existing `www.` configuration or that direct Worker form. For the direct Worker
form, compare only the exact configured hostname; do not derive or allow an
apex counterpart.

- [ ] **Step 4: Update the structure map**

Amend the Worker cache-policy description in `docs/ai/structure.html` to record
that direct configured staging `workers.dev` hostnames are exact-match only,
while production `www.` hosts retain their one apex counterpart.

- [ ] **Step 5: Run targeted verification and verify GREEN**

Run:

```powershell
npm.cmd test -- worker-cache-policy.test.ts worker-calendar-access.test.ts
npm.cmd run lint -- worker-cache-policy.js worker-cache-policy.test.ts worker-calendar-access.test.ts
```

Expected: both test files and focused lint pass with no warnings.

### Task 2: Deploy and Verify Staging

**Files:**
- Deploy existing OpenNext artifact with the updated Worker wrapper.

**Interfaces:**
- Consumes: staging Wrangler environment and its existing bindings.
- Produces: active staging deployment with a newly rotated 256-bit calendar Bearer token.

- [ ] **Step 1: Deploy only staging**

Run:

```powershell
npx.cmd wrangler deploy --env staging
```

Expected: `baan-pool-villa-staging` deploys successfully without changing
production Workers.

- [ ] **Step 2: Rotate the staging calendar token and smoke test in one process**

Generate 32 random bytes with Node `crypto.randomBytes`, send the Base64URL value
to Wrangler over stdin, retain it only in process memory, then call:

`GET /api/villas/1981/booking-calendar?month=2026-07`

Expected:

- no Authorization header returns `401`;
- `Authorization: Bearer <new token>` returns `200`;
- no temporary token file exists.

- [ ] **Step 3: Report the active version and preserve the checkpoint**

Read the staging deployment status and report the active version ID, targeted
test results, and smoke statuses. Do not commit or deploy production.
