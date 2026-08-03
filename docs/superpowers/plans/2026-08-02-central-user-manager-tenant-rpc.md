# Central User Manager Tenant RPC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Tenant Agent's public Bearer/HTTP API with one Cloudflare named RPC entrypoint while preserving all five user-management actions and their safety state machines.

**Architecture:** The public Worker wrapper exports `CentralUserManagerEntrypoint` and blocks both legacy HTTP paths plus one private OpenNext bridge path. The named entrypoint alone calls the bridge, which invokes a pure TypeScript RPC service that validates, canonicalizes, executes, and safely projects an operation. Bearer, health, rate-limit, and public Agent route code are removed rather than retained as fallback.

**Tech Stack:** Next.js 16.2.9 App Router, TypeScript, Cloudflare Workers `WorkerEntrypoint`, OpenNext Cloudflare, Supabase, Vitest.

## Global Constraints

- Work in `C:\Users\chaym\Projects\baan-pool-villa` and preserve unrelated user changes.
- Before code changes, reread `AGENTS.md`, `docs/ai/structure.html`, the approved design, Next.js route-handler docs in `node_modules/next/dist/docs/`, and current Cloudflare named RPC docs.
- Use TDD for every behavior change.
- Keep exactly five actions: `list_users`, `create_user`, `reissue_temporary_password`, `suspend_user`, and `reactivate_user`.
- Export exactly one Agent RPC method: `executeOperation(input: unknown)`.
- Do not retain a Bearer, HTTP, Access, IP-allowlist, or custom-header fallback.
- Public legacy and private bridge paths must return the same `404` before OpenNext, cache, rate limiter, configuration, or Supabase work.
- Do not change `zkxpozvhvmgqfrwnlfrn`, any online database, or any Cloudflare deployment in this plan.
- Do not edit existing Supabase migrations.
- Do not commit unless the user explicitly authorizes it.

---

### Task 1: Define and hash the RPC contract

**Files:**
- Create: `lib/central-user-manager/rpc-contract.ts`
- Create: `lib/central-user-manager/__tests__/rpc-contract.test.ts`
- Modify: `lib/central-user-manager/contracts.ts`

**Interfaces:**
- Consumes: existing canonical UUID and email normalization owners.
- Produces: `CentralUserRpcRequest`, `CentralUserRpcResult`, `parseCentralUserRpcRequest(value)`, and `hashCentralUserRpcRequest(request, crypto?)`.

- [ ] **Step 1: Write failing contract tests**

Cover exact keys, `protocolVersion: 1`, all five actions, wrong Tenant/operation/actor UUID shapes, inherited/extra keys, page bounds, normalized email, stable key-order-independent hashing, and hash changes for every normalized field.

```ts
const left = parseCentralUserRpcRequest({
  protocolVersion: 1,
  tenantId,
  operationId,
  actorUid,
  action: "create_user",
  payload: { email: " ADMIN@EXAMPLE.COM " },
});
assert.equal(left.payload.email, "admin@example.com");
assert.equal(
  await hashCentralUserRpcRequest(left),
  await hashCentralUserRpcRequest({ ...left, payload: { email: "admin@example.com" } }),
);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm.cmd test -- lib/central-user-manager/__tests__/rpc-contract.test.ts`

Expected: FAIL because `rpc-contract.ts` does not exist.

- [ ] **Step 3: Implement the narrow contract owner**

Use an exact-key parser and explicit action-specific canonical lines; do not use generic recursive serialization.

```ts
export type CentralUserRpcRequest =
  | (Omit<AgentOperationRequest, "action" | "payload"> & {
      protocolVersion: 1;
      action: "list_users";
      payload: { page: number; pageSize: number };
    })
  | (Omit<AgentOperationRequest, "action" | "payload"> & {
      protocolVersion: 1;
      action: Exclude<CentralUserAction, "list_users">;
      payload: { email: string };
    });

export type CentralUserRpcResult =
  | { ok: true; operation: AgentOperationResponse }
  | { ok: false; error: { code: "invalid_request" | "agent_unavailable"; message: string } };

export function canonicalCentralUserRpcText(request: CentralUserRpcRequest): string {
  const payload = request.action === "list_users"
    ? `${request.payload.page}\n${request.payload.pageSize}`
    : request.payload.email;
  return `1\n${request.tenantId}\n${request.operationId}\n${request.actorUid}\n${request.action}\n${payload}`;
}
```

Hash UTF-8 canonical text with SHA-256 and return lowercase hex.

- [ ] **Step 4: Run focused contract tests**

Run: `npm.cmd test -- lib/central-user-manager/__tests__/rpc-contract.test.ts lib/central-user-manager/__tests__/contracts.test.ts`

Expected: PASS.

- [ ] **Step 5: Review the diff without committing**

Confirm no `Request`, `Response`, header, URL, Bearer, binding name, or provider configuration appears in the RPC contract.

### Task 2: Build the pure RPC execution service

**Files:**
- Create: `lib/central-user-manager/rpc-service.ts`
- Create: `lib/central-user-manager/__tests__/rpc-service.test.ts`
- Create: `lib/central-user-manager/safe-result.ts`
- Create: `lib/central-user-manager/__tests__/safe-result.test.ts`
- Modify: `lib/central-user-manager/route-response.ts`

**Interfaces:**
- Consumes: `parseCentralUserRpcRequest`, `hashCentralUserRpcRequest`, `getCentralUserManagerAgentConfig`, `createProductionCentralUserOperationContext`, and `executeCentralUserOperation`.
- Produces: `executeCentralUserManagerRpc(input, dependencies?) => Promise<CentralUserRpcResult>` and `projectSafeCentralUserOperation(config, request, operation)`.

- [ ] **Step 1: Write failing service and projection tests**

Assert validation, disabled Agent, Tenant mismatch, hashing failure, context failure, operation failure, exact successful list/mutation projection, one-time temporary-password allowlist, and raw-error redaction. Assert every failure before context creation where applicable.

```ts
const result = await executeCentralUserManagerRpc(wrongTenantRequest, {
  getConfig: () => config,
  createContext: () => { throw new Error("must not run"); },
  execute: async () => { throw new Error("must not run"); },
});
assert.deepEqual(result, {
  ok: false,
  error: { code: "invalid_request", message: "Invalid user management request." },
});
```

- [ ] **Step 2: Run the tests and confirm RED**

Run: `npm.cmd test -- lib/central-user-manager/__tests__/rpc-service.test.ts lib/central-user-manager/__tests__/safe-result.test.ts`

Expected: FAIL because the new owners do not exist.

- [ ] **Step 3: Extract only safe projection logic from `route-response.ts`**

Move the allowlists and projection helpers, not HTTP helpers, into `safe-result.ts`.

```ts
export function projectSafeCentralUserOperation(
  config: CentralUserManagerAgentConfig,
  request: CentralUserRpcRequest,
  operation: AgentOperationResponse,
): AgentOperationResponse | null;
```

Return `null` for any identity/action/stage/result mismatch. Preserve the current one-time-password rules exactly.

- [ ] **Step 4: Implement the fail-closed RPC coordinator**

```ts
export async function executeCentralUserManagerRpc(
  input: unknown,
  dependencies: RpcServiceDependencies = PRODUCTION_DEPENDENCIES,
): Promise<CentralUserRpcResult> {
  try {
    const request = parseCentralUserRpcRequest(input);
    const config = dependencies.getConfig();
    if (!config.enabled || request.tenantId !== config.tenantId) return INVALID_REQUEST;
    const requestHash = await dependencies.hashRequest(request);
    const context = dependencies.createContext(config, requestHash);
    const operation = await dependencies.execute(context, request);
    const safe = projectSafeCentralUserOperation(config, request, operation);
    return safe ? { ok: true, operation: safe } : AGENT_UNAVAILABLE;
  } catch {
    return AGENT_UNAVAILABLE;
  }
}
```

Distinguish parse/disabled/Tenant mismatch as `invalid_request`; collapse dependency exceptions and unsafe projections to `agent_unavailable`.

- [ ] **Step 5: Run service, projection, and operation tests**

Run: `npm.cmd test -- lib/central-user-manager/__tests__/rpc-service.test.ts lib/central-user-manager/__tests__/safe-result.test.ts lib/central-user-manager/__tests__/operation-service-list.test.ts lib/central-user-manager/__tests__/operation-service-create.test.ts lib/central-user-manager/__tests__/operation-service-lifecycle.test.ts`

Expected: PASS.

- [ ] **Step 6: Review the diff without committing**

Confirm `operation-service.ts` and its database/Auth sequencing remain behaviorally unchanged.

### Task 3: Add the private OpenNext bridge and named Worker entrypoint

**Files:**
- Create: `app/(admin)/api/_worker/central-user-manager/route.ts`
- Create: `app/(admin)/api/_worker/central-user-manager/route.test.ts`
- Modify: `worker-central-user-manager.js`
- Modify: `worker-central-user-manager.test.ts`
- Modify: `worker.js`

**Interfaces:**
- Consumes: `executeCentralUserManagerRpc(input)` inside Next and `openNextWorker.fetch(request, env, ctx)` inside the Worker wrapper.
- Produces: named export `CentralUserManagerEntrypoint extends WorkerEntrypoint` with the only public RPC method `executeOperation(input)`.

- [ ] **Step 1: Write failing bridge and Worker tests**

Assert the bridge calls the pure service and returns its structured result; the public wrapper returns uniform `404` for both legacy paths and `/_worker/central-user-manager` for every method and Authorization header; and the named entrypoint alone dispatches to OpenNext.

```ts
for (const path of [
  "/api/internal/central-user-manager/v1/health",
  "/api/internal/central-user-manager/v1/operations",
  "/api/_worker/central-user-manager",
]) {
  const response = await worker.fetch(new Request(`https://tenant.example${path}`), env, ctx);
  assert.equal(response.status, 404);
}
```

- [ ] **Step 2: Run the tests and confirm RED**

Run: `npm.cmd test -- worker-central-user-manager.test.ts "app/(admin)/api/_worker/central-user-manager/route.test.ts"`

Expected: FAIL because the bridge and named entrypoint do not exist.

- [ ] **Step 3: Replace ingress middleware with a constant private-path blocker**

```js
const BLOCKED_CENTRAL_USER_PATHS = new Set([
  "/api/internal/central-user-manager/v1/health",
  "/api/internal/central-user-manager/v1/operations",
  "/api/_worker/central-user-manager",
]);

export function blockPublicCentralUserManagerRequest(request) {
  return BLOCKED_CENTRAL_USER_PATHS.has(new URL(request.url).pathname)
    ? new Response(null, { status: 404 })
    : null;
}
```

Delete rate-limit and Agent hardening-response behavior from this Worker owner.

- [ ] **Step 4: Implement the bridge route**

```ts
export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); }
  catch { input = null; }
  return Response.json(await executeCentralUserManagerRpc(input));
}
```

The outer Worker prevents Internet access; this route contains no Bearer, caller identity, destination, or Supabase logic.

- [ ] **Step 5: Export the named entrypoint from `worker.js`**

```js
import { WorkerEntrypoint } from "cloudflare:workers";

export class CentralUserManagerEntrypoint extends WorkerEntrypoint {
  async executeOperation(input) {
    try {
      const response = await openNextWorker.fetch(new Request(
        "https://worker.internal/api/_worker/central-user-manager",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
      ), this.env, this.ctx);
      return await response.json();
    } catch {
      return { ok: false, error: { code: "agent_unavailable", message: "User management is unavailable." } };
    }
  }
}
```

Run `blockPublicCentralUserManagerRequest` before calendar access or cache lookup in the default `fetch` handler.

- [ ] **Step 6: Run bridge and Worker tests**

Run: `npm.cmd test -- worker-central-user-manager.test.ts "app/(admin)/api/_worker/central-user-manager/route.test.ts" worker-cache-policy.test.ts`

Expected: PASS with no rate-limiter expectation for Central User Manager.

- [ ] **Step 7: Review the diff without committing**

Confirm the only route to OpenNext's private bridge is the named entrypoint and all Internet aliases use the default wrapper.

### Task 4: Remove Bearer, health, and HTTP Agent owners

**Files:**
- Delete: `lib/central-user-manager/bearer-auth.ts`
- Delete: `lib/central-user-manager/health-service.ts`
- Delete: `lib/central-user-manager/health-route-handler.ts`
- Delete: `lib/central-user-manager/operations-route-handler.ts`
- Delete: `lib/central-user-manager/__tests__/bearer-auth.test.ts`
- Delete: `lib/central-user-manager/__tests__/health-service.test.ts`
- Delete: `lib/central-user-manager/__tests__/health-migration-contract.test.ts`
- Delete: `app/(admin)/api/internal/central-user-manager/v1/health/route.ts`
- Delete: `app/(admin)/api/internal/central-user-manager/v1/operations/route.ts`
- Delete: `app/(admin)/api/internal/central-user-manager/v1/health/route.test.ts`
- Delete: `app/(admin)/api/internal/central-user-manager/v1/operations/route.test.ts`
- Delete: `scripts/central-user-manager/validate-bearer-token.mjs`
- Delete: `scripts/central-user-manager/auth-attestation.mjs`
- Delete: `tests/central-user-manager-bearer-provisioning.test.ts`
- Delete: `tests/central-user-manager-auth-attestation.test.ts`
- Modify: `lib/central-user-manager/config.ts`
- Modify: `lib/central-user-manager/supabase-admin.ts`
- Modify: `tsconfig.central-user-owner.json`
- Modify: `wrangler.jsonc`

**Interfaces:**
- Consumes: RPC owners from Tasks 1–3.
- Produces: minimal `CentralUserManagerAgentConfig` containing `enabled`, `tenantId`, `projectRef`, `supabaseUrl`, and `supabaseSecretKey` only.

- [ ] **Step 1: Rewrite config tests to define the minimal contract**

Assert missing/false enabled behavior, canonical Tenant UUID, exact project ref, Supabase URL/project match, and server-only secret presence. Assert removed Bearer, token version, credential-fence feature flag, agent/schema version, and attestation variables have no effect.

- [ ] **Step 2: Run config and owner typechecks to confirm RED**

Run: `npm.cmd test -- lib/central-user-manager/__tests__/config.test.ts lib/central-user-manager/__tests__/supabase-admin.test.ts`

Expected: FAIL against the legacy config shape.

- [ ] **Step 3: Shrink configuration and delete legacy owners**

```ts
export interface CentralUserManagerAgentConfig {
  enabled: boolean;
  tenantId: string;
  projectRef: string;
  supabaseUrl: string;
  supabaseSecretKey: string;
}
```

Credential fencing remains always enforced in database policies and state-machine functions; remove only its runtime bypass flag.

- [ ] **Step 4: Remove legacy Wrangler values and secret requirements**

Remove `CENTRAL_USER_MANAGER_BEARER_TOKEN`, `CENTRAL_USER_MANAGER_TOKEN_VERSION`, agent/schema versions, auth attestation values, `CENTRAL_USER_MANAGER_CREDENTIAL_FENCE_ENABLED`, and `CENTRAL_USER_MANAGER_RATE_LIMITER` from every environment. Keep `CENTRAL_USER_MANAGER_AGENT_ENABLED`, Tenant/project identity, Supabase URL, and Supabase secret requirements.

- [ ] **Step 5: Update the narrow typecheck project**

Include `rpc-contract.ts`, `safe-result.ts`, `rpc-service.ts`, the private bridge route, `production-context.ts`, and the existing operation owners. Exclude every deleted route/health file.

- [ ] **Step 6: Search for legacy references**

Run:

```powershell
rg -n "CENTRAL_USER_MANAGER_BEARER_TOKEN|CENTRAL_USER_MANAGER_TOKEN_VERSION|requireCentralBearer|central_user_manager_health_probe|createHealthRouteHandlers|createOperationsRouteHandlers" app lib worker*.js scripts tests wrangler.jsonc tsconfig*.json
```

Expected: no active-code/config matches; migration history may still contain health function names.

- [ ] **Step 7: Run focused tests and typecheck**

Run: `npm.cmd test -- lib/central-user-manager/__tests__ worker-central-user-manager.test.ts "app/(admin)/api/_worker/central-user-manager/route.test.ts"`

Run: `npx.cmd tsc -p tsconfig.central-user-owner.json --pretty false`

Expected: PASS.

- [ ] **Step 8: Review the diff without committing**

Confirm no compatibility fallback survives and no unrelated booking-calendar Bearer code was changed.

### Task 5: Replace provisioning documentation and structure ownership

**Files:**
- Replace: `docs/central-user-manager/tenant-provisioning.md`
- Modify: `docs/ai/structure.html`
- Modify: `docs/superpowers/specs/2026-08-02-central-user-manager-service-binding-rpc-design.md` only if implementation evidence requires a factual correction

**Interfaces:**
- Consumes: final code/config boundaries.
- Produces: an RPC-only Tenant provisioning and cutover runbook.

- [ ] **Step 1: Rewrite the Thai runbook around binding-only provisioning**

Document: Tenant inactive gate, fixed Tenant UUID, named entrypoint name, target-first deploy order, `webook` binding deploy, `list_users` readiness, four disposable-user staging mutations, legacy public `404`, retired-secret removal, quarantine, and no-Bearer rollback.

- [ ] **Step 2: Update `docs/ai/structure.html`**

Replace HTTP/Bearer/health ownership and tests with RPC contract/service/bridge/entrypoint ownership, public-path `404`, minimal config, and the new focused verification commands.

- [ ] **Step 3: Search documentation for stale canonical instructions**

Run: `rg -n "Bearer-only|CENTRAL_USER_MANAGER_BEARER_TOKEN|authenticated health|tokenVersion|health route" docs README.md`

Classify old dated specs/plans as historical rather than rewriting them; remove stale instructions only from active runbooks and structure docs.

- [ ] **Step 4: Run documentation checks**

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 5: Review the diff without committing**

Confirm the active runbook never suggests restoring Bearer or calling a public Agent URL.

### Task 6: Complete local verification

**Files:**
- Modify only files proven deficient by verification.

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: a deploy-ready Tenant RPC change set without remote mutations.

- [ ] **Step 1: Run all targeted Central User Manager tests**

Run: `npm.cmd test -- lib/central-user-manager/__tests__ worker-central-user-manager.test.ts "app/(admin)/api/_worker/central-user-manager/route.test.ts"`

Expected: PASS.

- [ ] **Step 2: Run adjacent Worker and admin-auth tests**

Run: `npm.cmd test -- worker-cache-policy.test.ts worker-calendar-access.test.ts lib/admin/__tests__/home-config-auth.test.ts lib/admin/__tests__/route-helpers.test.ts`

Expected: PASS.

- [ ] **Step 3: Run narrow and full verification**

Run: `npx.cmd tsc -p tsconfig.central-user-owner.json --pretty false`

Run: `npm.cmd run lint`

Run: `npm.cmd test`

Run: `npm.cmd run build`

Expected: all PASS.

- [ ] **Step 4: Inspect local public boundaries**

Run the built Worker locally and request both legacy paths and the private bridge with no header, a malformed Bearer, and a retired valid-format Bearer. Expected: identical empty `404` responses with no `_rsc`, redirect, rate-limit, or Supabase request. Invoke the named entrypoint through a local Service Binding and confirm `list_users` reaches only the configured test dependency/project.

- [ ] **Step 5: Inspect final scope**

Run: `git diff --check`

Run: `git status --short`

Run: `git diff -- app lib worker.js worker-central-user-manager.js wrangler.jsonc tsconfig.central-user-owner.json docs scripts tests`

Expected: only approved RPC cutover, removal, tests, and documentation changes. Do not commit or deploy.

## Tenant Plan Acceptance Gate

- Exactly one named RPC method exists.
- Both legacy HTTP paths and the private bridge return `404` from public fetch.
- No Central User Manager Bearer, token version, health runtime, or rate limiter remains.
- All five actions retain their operation/recovery behavior.
- Wrong Tenant and invalid input fail before privileged client creation.
- Canonical request identity and safe projection tests pass.
- Targeted tests, narrow typecheck, lint, full tests, and build pass.
- No online database, Cloudflare Worker, or secret was mutated.
