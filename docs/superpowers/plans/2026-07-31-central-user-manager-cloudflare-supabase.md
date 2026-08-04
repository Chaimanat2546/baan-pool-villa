# Central User Manager Cloudflare–Supabase Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make privileged Central User Manager Supabase calls from Cloudflare staging present an explicit backend User-Agent so health and operations no longer fail as browser-originated secret-key requests.

**Architecture:** Keep `createCentralUserManagerAdminClient` as the only construction point for the privileged client. Add one stable server-identifying header through Supabase's supported `global.headers` option; do not change authentication, API contracts, persistence, or database schema.

**Tech Stack:** TypeScript, Next.js, `@supabase/supabase-js` 2.108.2, Vitest, Cloudflare Workers/OpenNext.

## Global Constraints

- Keep the existing `sb_secret_` key and Bearer-authenticated Agent API.
- Limit the header change to the Central User Manager privileged client.
- Do not expose or log secrets.
- Run targeted tests and the narrow Central User Manager typecheck only before staging deployment.
- Do not change database schema, operation fencing, or safe error responses.

---

### Task 1: Add and verify the backend request identity

**Files:**
- Create: `lib/central-user-manager/__tests__/supabase-admin.test.ts`
- Modify: `lib/central-user-manager/supabase-admin.ts`

**Interfaces:**
- Consumes: `CentralUserManagerAgentConfig` and `createClient(url, key, options)` from `@supabase/supabase-js`.
- Produces: the unchanged `createCentralUserManagerAdminClient(config)` function, whose requests include `User-Agent: baan-pool-villa-central-user-manager/1.0`.

- [ ] **Step 1: Write the failing integration-style unit test**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { CentralUserManagerAgentConfig } from "../config";
import { createCentralUserManagerAdminClient } from "../supabase-admin";

const CONFIG = {
  supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co",
  supabaseSecretKey: "sb_secret_example",
} as CentralUserManagerAgentConfig;

describe("Central User Manager privileged Supabase client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("identifies privileged requests as backend traffic", async () => {
    const fetchStub = vi.fn(async (_input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("user-agent")).toBe(
        "baan-pool-villa-central-user-manager/1.0",
      );
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchStub);

    const client = createCentralUserManagerAdminClient(CONFIG);
    await client.rpc("central_user_manager_health_probe_v1", {});

    expect(fetchStub).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
npm.cmd test -- lib/central-user-manager/__tests__/supabase-admin.test.ts
```

Expected: FAIL because the request does not yet contain the required backend User-Agent.

- [ ] **Step 3: Add the minimal client option**

Add to the existing `createClient` options in
`lib/central-user-manager/supabase-admin.ts`:

```ts
global: {
  headers: {
    "User-Agent": "baan-pool-villa-central-user-manager/1.0",
  },
},
```

- [ ] **Step 4: Run targeted verification**

Run:

```powershell
npm.cmd test -- lib/central-user-manager/__tests__/supabase-admin.test.ts lib/central-user-manager/__tests__/health-service.test.ts lib/central-user-manager/__tests__/production-context.test.ts
npx.cmd tsc -p tsconfig.central-user-owner.json --pretty false
npm.cmd exec eslint -- lib/central-user-manager/supabase-admin.ts lib/central-user-manager/__tests__/supabase-admin.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 5: Review and commit Task 1**

Review only the two Task 1 files, then run:

```powershell
git add -- lib/central-user-manager/supabase-admin.ts lib/central-user-manager/__tests__/supabase-admin.test.ts
git commit -m "fix: identify privileged Supabase requests as backend"
```

### Task 2: Deploy and verify staging

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: the verified Task 1 Worker bundle and existing staging secrets/configuration.
- Produces: a new `baan-pool-villa-staging` Worker version with working Central User Manager health and read-only list calls.

- [ ] **Step 1: Build the Cloudflare artifact**

Run:

```powershell
npm.cmd run build:cf
```

Expected: OpenNext build exits 0.

- [ ] **Step 2: Deploy only staging**

Run:

```powershell
npm.cmd exec opennextjs-cloudflare deploy -- --env staging
```

Expected: deployment reports the `baan-pool-villa-staging` Worker URL and a new version ID.

- [ ] **Step 3: Verify from the central staging UI**

For Tenant `2b4e0c23-b66c-43c8-892c-ac1a9b5f2ccb`, verify:

```text
GET /api/admin/user-manager/health
POST /api/admin/user-manager/operations  (read-only list action)
```

Expected: health returns `ok: true`; list operation completes without `provider_failure`, and the UI enables user-management actions.

- [ ] **Step 4: Push the completed branch**

Run:

```powershell
git push origin codex/central-user-manager-bearer
```

Expected: remote branch advances to the Task 1 commit.
