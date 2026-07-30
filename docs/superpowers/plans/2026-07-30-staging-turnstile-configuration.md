# Staging Turnstile Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Cloudflare Turnstile on the staging admin login, then use the authenticated refresh flow to replace stale villa-detail fallbacks.

**Architecture:** Keep the Turnstile secret in the staging Worker secret store and inject the public site key into the Next.js client bundle during a fresh OpenNext build. Deploy only the `staging` Wrangler environment, verify the login challenge and server verification boundary, then refresh external villa tags through the existing authenticated admin action.

**Tech Stack:** Next.js App Router, Cloudflare Turnstile, OpenNext for Cloudflare, Wrangler, Vitest, in-app browser.

## Global Constraints

- Read both Turnstile values only from `.env.staging`; never print them or copy them into tracked configuration.
- Deploy only `baan-pool-villa-staging`; never modify or deploy production.
- Send the secret to Wrangler through ASCII stdin so no BOM is introduced.
- Run focused Turnstile tests only; do not run the full test suite.
- Do not commit unless the user explicitly requests a commit.

---

### Task 1: Validate the staging Turnstile boundary

**Files:**
- Read: `.env.staging`
- Test: `lib/admin/__tests__/turnstile.test.ts`
- Test: `lib/admin/__tests__/turnstile-route.test.ts`
- Test: `components/admin/login/__tests__/admin-login-form.test.tsx`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` from `.env.staging`.
- Produces: evidence that both values are non-empty, ASCII-only, BOM-free, and that the existing client/server Turnstile contract passes.

- [ ] **Step 1: Validate key shape without displaying values**

Run a Node script that reads `.env.staging` and reports only `configured`, `asciiOnly`, `leadingBom`, and length for the two required names.

Expected: both values are configured, ASCII-only, and have no leading BOM.

- [ ] **Step 2: Run the focused Turnstile tests**

Run:

```powershell
npm.cmd test -- lib/admin/__tests__/turnstile.test.ts lib/admin/__tests__/turnstile-route.test.ts components/admin/login/__tests__/admin-login-form.test.tsx
```

Expected: all selected tests pass.

- [ ] **Step 3: Review Task 1 results**

Stop if either key-shape validation or any focused test fails. Do not upload secrets or build until the failure is understood.

### Task 2: Install the staging secret and build the public key

**Files:**
- Read: `.env.staging`
- Generated: `.open-next/**`

**Interfaces:**
- Consumes: validated Turnstile values from Task 1.
- Produces: a new staging Worker secret version and a fresh OpenNext artifact whose browser bundle contains the staging site key.

- [ ] **Step 1: Upload the staging secret**

Use a Node child process to parse `.env.staging`, set
`CLOUDFLARE_ACCOUNT_ID=0df55f166fa309dcc904e992c43f86db`, and pipe
`TURNSTILE_SECRET_KEY` as ASCII stdin to:

```powershell
npx.cmd wrangler secret put TURNSTILE_SECRET_KEY --env staging
```

Expected: Wrangler reports `Success! Uploaded secret TURNSTILE_SECRET_KEY`.

- [ ] **Step 2: Build with the staging public key**

Use `dotenv.parse()` in a Node child process to merge `.env.staging` into the
build process environment, then run:

```powershell
npx.cmd opennextjs-cloudflare build
```

Expected: the OpenNext build completes successfully and regenerates
`.open-next`.

- [ ] **Step 3: Review Task 2 results**

Confirm the build did not print either Turnstile value. Stop before deployment
if the build fails or loads a different environment file over the injected
values.

### Task 3: Deploy and verify staging

**Files:**
- Deploy: `.open-next/**`
- Runtime config: `wrangler.jsonc` environment `staging`

**Interfaces:**
- Consumes: the fresh OpenNext artifact and the installed Worker secret.
- Produces: a staging-only deployment with a working Turnstile client/server pair.

- [ ] **Step 1: Deploy the built artifact to staging**

Run:

```powershell
$env:OPEN_NEXT_DEPLOY='true'
$env:CLOUDFLARE_ACCOUNT_ID='0df55f166fa309dcc904e992c43f86db'
npx.cmd wrangler deploy --env staging
```

Expected: deployment succeeds for
`https://baan-pool-villa-staging.chaymanus2003.workers.dev` and reports a new
version ID.

- [ ] **Step 2: Verify the missing-token boundary**

POST an empty JSON body to:

```text
/api/admin/login/turnstile
```

Expected: a structured client error for a missing Turnstile token, with no
provider secret or raw provider diagnostics.

- [ ] **Step 3: Verify the admin login UI**

Open `/admin/login` in the in-app browser and inspect the rendered page.

Expected: the Turnstile widget renders and the login form no longer reports a
missing Turnstile configuration.

- [ ] **Step 4: User authentication checkpoint**

The user completes the Turnstile challenge and signs in with their staging
admin account. Do not inspect or handle their password, browser storage, or
session tokens.

- [ ] **Step 5: Refresh external villa data**

After the authenticated admin shell loads, use its existing external-data
refresh action, which sends the confirmation and `tags-only` scope expected by
`/api/admin/external-data/refresh`.

Expected: the UI reports that the external villa data cache refresh was
requested.

- [ ] **Step 6: Verify stale details were replaced**

Request `/api/villas/1401` and `/api/villas/1402`.

Expected: both return HTTP `200`, `detailStatus: "available"`, and a populated
detail payload from Deville Central. Houses `1406` and `1698` may remain
`unavailable` because Deville Central itself returns `404` for those IDs.

- [ ] **Step 7: Final focused verification**

Run:

```powershell
npm.cmd test -- lib/admin/__tests__/turnstile.test.ts lib/admin/__tests__/turnstile-route.test.ts components/admin/login/__tests__/admin-login-form.test.tsx
git diff --check
```

Expected: focused tests and whitespace validation pass. Report the staging
version ID, Turnstile UI status, refresh result, and villa-detail smoke results.
