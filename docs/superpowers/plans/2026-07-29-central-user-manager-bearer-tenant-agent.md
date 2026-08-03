# Central User Manager Bearer Tenant Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `baan-pool-villa` Tenant Agent that authenticates `webook` with one exact per-Tenant Bearer token while preserving the approved Central User Manager lifecycle, fencing, idempotency, and quarantine behavior.

**Architecture:** Two no-store internal Route Handlers validate a server-only per-Tenant Bearer token and exact local Tenant identity before delegating to isolated operation services. The Agent keeps its own Supabase secret, durable operation/lease state, and credential fence; it never receives target configuration from the Browser or stores temporary passwords.

**Tech Stack:** Next.js 16 Route Handlers, TypeScript 6, Supabase Auth/Postgres, Web Crypto, Vitest, Cloudflare Workers/OpenNext.

## Global Constraints

- Read `AGENTS.md`, `docs/ai/structure.html`, and the relevant local Next.js 16 docs before code changes.
- Use `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and `08-caching.md` for Route Handler behavior.
- Token format is exactly 32 random bytes encoded as 43-character unpadded base64url.
- Accept only `Authorization: Bearer <token>` with literal `Bearer` and one ASCII space.
- `CENTRAL_USER_MANAGER_BEARER_TOKEN` and `SUPABASE_SECRET_KEY` are server-only and never appear under `NEXT_PUBLIC_*`.
- Every Agent response is private/no-store, nonredirecting, bounded, and secret-safe.
- Preserve all existing user changes.
- Do not commit unless the user explicitly instructs; any task-end commit is an optional checkpoint only after that authorization.

## Fixed Interfaces

```ts
export interface VerifiedCentralBearerRequest {
  tokenVersion: number;
}

export interface AgentOperationRequest {
  tenantId: string;
  operationId: string;
  actorUid: string;
  action:
    | "list_users"
    | "create_user"
    | "reissue_temporary_password"
    | "suspend_user"
    | "reactivate_user";
  payload: Record<string, unknown>;
}

export type AgentOperationStatus =
  | "completed"
  | "in_progress"
  | "needs_review"
  | "quarantined";
```

```http
GET /api/internal/central-user-manager/v1/health
Authorization: Bearer <43-character Tenant token>
X-CUM-Version: 1
```

```http
POST /api/internal/central-user-manager/v1/operations
Authorization: Bearer <43-character Tenant token>
X-CUM-Version: 1
Content-Type: application/json
```

---

### Task 1: Freeze strict contracts and temporary-password generation

**Files:**
- Create: `lib/central-user-manager/contracts.ts`
- Create: `lib/central-user-manager/email.ts`
- Create: `lib/central-user-manager/password.ts`
- Create: `lib/central-user-manager/safe-errors.ts`
- Test: `lib/central-user-manager/__tests__/contracts.test.ts`
- Test: `lib/central-user-manager/__tests__/password.test.ts`

**Interfaces:**
- Produces: `parseAgentOperationRequest(value)`, `normalizeAdminEmail(value)`, `generateTemporaryPassword(crypto?)`, and safe DTOs used by every later task.

- [ ] Write failing tests for exact UUIDs, supported actions, no-extra-key payloads, page size `1..100`, lowercase/trimmed email, and bounded safe errors.
- [ ] Write failing password tests proving 20 printable nonspace ASCII characters with lowercase, uppercase, digit, symbol, rejection sampling, injectable Web Crypto, and no `Math.random()`.
- [ ] Run `npm.cmd test -- lib/central-user-manager/__tests__/contracts.test.ts lib/central-user-manager/__tests__/password.test.ts`; expected failure is missing modules.
- [ ] Implement the narrow exported functions and these status DTOs:

```ts
export interface AgentOperationResponse {
  operationId: string;
  status: AgentOperationStatus;
  stage: string;
  result?: {
    users?: CentralAdminUser[];
    pagination?: { page: number; pageSize: number; hasMore: boolean };
    user?: CentralAdminUser;
    temporaryPassword?: string;
  };
  error?: { code: string; message: string };
}
```

- [ ] Rerun the focused tests; expected result is all pass.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 2: Add exact Bearer parsing and timing-safe verification

**Files:**
- Create: `lib/central-user-manager/bearer-auth.ts`
- Test: `lib/central-user-manager/__tests__/bearer-auth.test.ts`

**Interfaces:**
- Consumes: server configuration from Task 3 through an injected expected token.
- Produces: `requireCentralBearer(request, expectedToken, tokenVersion): Promise<VerifiedCentralBearerRequest | Response>`.

- [ ] Write table-driven failing tests for valid credential, missing header, duplicate/comma-joined values, lowercase/mixed scheme, tabs, double spaces, trailing data, invalid base64url, 42/44-character tokens, and wrong token.
- [ ] Add tests proving malformed expected configuration returns `503`, credential failure returns `401` plus `WWW-Authenticate: Bearer`, and neither response contains credential material.
- [ ] Add a dependency-injected comparison test that proves both valid tokens are SHA-256 hashed and exactly 32 digest bytes are compared.
- [ ] Run `npm.cmd test -- lib/central-user-manager/__tests__/bearer-auth.test.ts`; expected failure is missing implementation.
- [ ] Implement strict parsing and fixed-work digest comparison:

```ts
export async function requireCentralBearer(
  request: Request,
  expectedToken: string,
  tokenVersion: number,
): Promise<VerifiedCentralBearerRequest | Response>;
```

- [ ] Never log or return the supplied token, expected token, digest, or Authorization header.
- [ ] Rerun the focused test; expected result is all pass.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 3: Add server-only Agent configuration and secret client

**Files:**
- Create: `lib/central-user-manager/config.ts`
- Create: `lib/central-user-manager/supabase-admin.ts`
- Test: `lib/central-user-manager/__tests__/config.test.ts`
- Modify: `.env.example`
- Modify: `wrangler.jsonc`

**Interfaces:**
- Produces: `getCentralUserManagerAgentConfig(): CentralUserManagerAgentConfig` and `createCentralUserManagerAdminClient(config)`.

- [ ] Write failing tests for disabled Agent, missing/malformed Tenant UUID, project ref, version fields, attestation fields, Bearer token, token version, and Supabase secret.
- [ ] Define the exact server configuration:

```ts
interface CentralUserManagerAgentConfig {
  enabled: boolean;
  credentialFenceEnabled: boolean;
  tenantId: string;
  projectRef: string;
  agentVersion: string;
  schemaVersion: string;
  tokenVersion: number;
  bearerToken: string;
  authAttestation: { version: string; digest: string; checkedAt: string };
  supabaseSecretKey: string;
}
```

- [ ] Run `npm.cmd test -- lib/central-user-manager/__tests__/config.test.ts`; expected failure is missing owner.
- [ ] Implement strict server-only validation; use a nonpersistent Supabase client with `autoRefreshToken: false` and `persistSession: false`.
- [ ] Add `CENTRAL_USER_MANAGER_BEARER_TOKEN` and `SUPABASE_SECRET_KEY` to every Wrangler environment’s required secrets, plus bounded nonsecret Tenant/version configuration.
- [ ] Rerun focused tests and inspect `git diff -- wrangler.jsonc .env.example`.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 4: Create the prepare migration and operation repository

**Files:**
- Create with Supabase CLI: `supabase/migrations/<timestamp>_prepare_central_user_manager_agent.sql`
- Create: `lib/central-user-manager/operation-repository.ts`
- Test: `lib/central-user-manager/__tests__/migration-contract.test.ts`
- Test: `lib/central-user-manager/__tests__/operation-repository.test.ts`

**Interfaces:**
- Produces transactional RPC wrappers for claim, renew, stage commit, completion, quarantine, and forced-password-change fencing.

- [ ] Create the migration with `supabase migration new prepare_central_user_manager_agent`.
- [ ] Write failing SQL contract tests for `must_change_password`, positive `credential_version`, case-insensitive unique email, operation/lock tables, RLS, explicit revokes, private security-definer functions, fixed `search_path`, and no direct `auth.users` mutation.
- [ ] Add `public.admin_user_operations` and `public.admin_user_mutation_locks` with the exact states/actions/fence fields from the approved design.
- [ ] Add narrow `service_role` wrappers:

```text
claim_admin_user_operation
renew_admin_user_operation_lease
commit_admin_user_operation_stage
complete_admin_user_operation
quarantine_admin_user_operation
claim_forced_password_change
advance_forced_password_change
```

- [ ] Write failing fake-RPC tests for first claim, exact retry, conflicting reuse, active lease, higher-fence takeover, renewal, completion, and permanent quarantine.
- [ ] Implement one TypeScript wrapper per RPC, 30-second default lease, cryptographic lease tokens, persisted SHA-256 lease-token hashes, and safe database error mapping.
- [ ] Run `npm.cmd test -- lib/central-user-manager/__tests__/migration-contract.test.ts lib/central-user-manager/__tests__/operation-repository.test.ts`.
- [ ] Apply only to a disposable local database; never reset a populated remote project.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 5: Build the Supabase Auth provider adapter

**Files:**
- Create: `lib/central-user-manager/auth-provider.ts`
- Test: `lib/central-user-manager/__tests__/auth-provider.test.ts`

**Interfaces:**
- Produces: list, exact-email lookup, create, metadata/password update, ban/unban, transient verification, and global signout operations with deadlines.

- [ ] Write failing tests for pagination, confirmed create, normalized lookup, unrelated metadata preservation, immutable provenance, ban/unban, transient same-UID verification, global signout, and timeout.
- [ ] Run the focused test; expected failure is missing adapter.
- [ ] Implement provider methods only through Supabase Admin API. New managed users receive:

```json
{
  "credential_version": 1,
  "bpv_admin_managed": true,
  "bpv_created_operation_id": "<operation UUID>"
}
```

- [ ] Require provider timeout plus five-second margin to remain below the operation lease.
- [ ] Ensure provider errors never contain a password, access token, refresh token, or secret.
- [ ] Rerun focused tests; expected result is all pass.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 6: Implement list/create and lifecycle state machines

**Files:**
- Create: `lib/central-user-manager/operation-service.ts`
- Create: `lib/central-user-manager/reconciled-list-repository.ts`
- Create with CLI: `supabase/migrations/<CLI-generated>_list_reconciled_admin_users.sql`
- Test: `lib/central-user-manager/__tests__/operation-service-list.test.ts`
- Test: `lib/central-user-manager/__tests__/reconciled-list-repository.test.ts`
- Test: `lib/central-user-manager/__tests__/task6-round5-list-migration-contract.test.ts`
- Test: `lib/central-user-manager/__tests__/operation-service-create.test.ts`
- Test: `lib/central-user-manager/__tests__/operation-service-lifecycle.test.ts`

**Interfaces:**
- Consumes: strict contracts, operation repository, password generator, and Auth adapter.
- Produces: `executeCentralUserOperation(context, request): Promise<AgentOperationResponse>`.

- [ ] Write failing list tests for exact UID joins, one-sided rows, version mismatch, max 100 rows, and four Thai status mappings.
- [ ] Implement `list_users` through one narrow server-only repository and one
  service-role-only public RPC. Its private fixed/empty-search-path
  `SECURITY DEFINER` implementation may only `SELECT` the required documented
  `auth.users` fields and `public.admin_users`, `FULL OUTER JOIN` exact UIDs,
  compute global normalized-email ownership, and page by normalized display
  email then UID. Revoke direct private/public execution from all roles before
  granting only the public wrapper to `service_role`. This read-only SQL
  exception is list-only; mutations retain Auth Admin API ownership.
- [ ] Write failing create tests for success, existing email, exact completed retry without password, proven compensation, unproven ownership, provider timeout, and recovery at every durable stage.
- [ ] Write failing reissue/suspend/reactivate tests for version advancement, DB-first denial, new-password-only reactivation, lower-fence late outcome, timeout, quarantine, and concurrent email operations.
- [ ] Implement durable `provider_intent` before every provider mutation and `provider_outcome` after every definite result.
- [ ] Keep password only in a local variable and first successful response; persistence and retries contain only safe state.
- [ ] Implement the exact lifecycle ordering from the approved spec, including inactive DB authority for suspend and inactive-until-verified reactivation.
- [ ] Run all three focused files; expected result is all pass.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 7: Add authenticated health and operation Route Handlers

**Files:**
- Create: `lib/central-user-manager/route-response.ts`
- Create: `lib/central-user-manager/health-service.ts`
- Create: `app/(admin)/api/internal/central-user-manager/v1/health/route.ts`
- Create: `app/(admin)/api/internal/central-user-manager/v1/operations/route.ts`
- Test: `app/(admin)/api/internal/central-user-manager/v1/health/route.test.ts`
- Test: `app/(admin)/api/internal/central-user-manager/v1/operations/route.test.ts`

**Interfaces:**
- Consumes: Task 2 Bearer guard, Task 3 config, and Task 6 service.
- Produces: exact internal HTTP contract used by `webook`.

- [ ] Read the local Next.js Route Handler and caching guides named in Global Constraints.
- [ ] Write failing route tests for disabled Agent, wrong method, malformed expected secret, missing/wrong Bearer, Tenant mismatch, wrong `X-CUM-Version`, content type, 16 KiB limit, JSON/schema failure, success, exact retry, and safe provider error.
- [ ] Run both route tests; expected failure is missing routes.
- [ ] Implement health GET with no body and operations POST with exact JSON content type.
- [ ] Apply every response header:

```ts
{
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer"
}
```

- [ ] Verify the Bearer guard runs before body parsing or persistence and no route redirects.
- [ ] Rerun both focused tests; expected result is all pass.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 8: Bypass custom Worker caches and add rate limiting

**Files:**
- Create: `worker-central-user-manager.js`
- Modify: `worker.js`
- Modify: `wrangler.jsonc`
- Test: `tests/worker-central-user-manager.test.ts`

**Interfaces:**
- Produces: exact path classifier and per-IP Agent rate-limit gate before OpenNext dispatch.

- [ ] Write failing tests proving only the two exact internal paths bypass HTML/JSON/image caches, never cache responses, reject the 61st request per IP/minute, and do not match lookalike paths.
- [ ] Run the focused test; expected failure is missing classifier/gate.
- [ ] Add a dedicated rate-limit binding per Wrangler environment and branch before every custom cache read/write.
- [ ] Keep Bearer verification in the Next route; the Worker wrapper only rate-limits, bypasses caches, and enforces safe response headers.
- [ ] Rerun `npm.cmd test -- tests/worker-central-user-manager.test.ts` plus touched Worker policy tests.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 9: Replace cached admin authorization with credential fencing

**Files:**
- Modify: `lib/admin/home-config-auth.ts`
- Modify: `lib/admin/route-helpers.ts`
- Test: `lib/admin/__tests__/home-config-auth.test.ts`
- Test: `lib/admin/__tests__/route-helpers.test.ts`

**Interfaces:**
- Produces uncached protected-admin authorization used by every admin route.

- [ ] Replace cache-hit tests with failing cases proving every request calls `auth.getClaims(token)` and `auth.getUser(token)`.
- [ ] Cover invalid claims, stale/current user mismatch, absent/nonpositive version, inactive row, forced-change row, duplicate/no profile, and valid exact match.
- [ ] Remove the 30-second positive cache and authorize only when JWT version equals current Auth metadata version equals DB version, with active true and forced flag false.
- [ ] Return stable codes `session_invalid`, `admin_inactive`, `password_change_required`, and `credential_version_mismatch`.
- [ ] Run the two focused tests; expected result is all pass.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 10: Implement forced temporary-password change

**Files:**
- Create: `lib/admin/forced-password-change.ts`
- Create: `app/(admin)/api/admin/session/route.ts`
- Create: `app/(admin)/api/admin/change-password/route.ts`
- Create: `app/(admin)/admin/change-password/page.tsx`
- Create: `components/admin/login/admin-forced-password-change-form.tsx`
- Modify: `components/admin/admin-auth.ts`
- Modify: `components/admin/login/admin-login-form.tsx`
- Modify: `components/admin/layout/admin-shell.tsx`
- Test: `lib/admin/__tests__/forced-password-change.test.ts`
- Test: `app/(admin)/api/admin/session/route.test.ts`
- Test: `app/(admin)/api/admin/change-password/route.test.ts`
- Test: `components/admin/login/__tests__/admin-forced-password-change-form.test.tsx`
- Modify test: `components/admin/login/__tests__/admin-login-form.test.tsx`
- Modify test: `components/admin/layout/__tests__/admin-shell.test.tsx`

**Interfaces:**
- Produces forced-session routing and exact `N → N+1 → N+2` password-change state machine.

- [ ] Write failing service tests for wrong temporary password, lease conflict, each Auth/DB ambiguity, late fence, successful version transitions, and quarantine.
- [ ] Write failing UI/route tests proving forced users may use only session check, password change, and signout; inactive users are signed out.
- [ ] Implement current temporary password, new password, and confirmation fields using existing password validation.
- [ ] Implement exact DB/Auth CAS sequence from the approved design; clear `must_change_password` only at exact `N+2`, then clear Browser session and require fresh login.
- [ ] Preserve OTP recovery and keep project-wide current-password reauthentication disabled.
- [ ] Run all focused forced-password tests.
- [ ] Render login and forced-change pages locally at mobile and desktop widths.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 11: Backfill metadata and enforce database credential fence

**Files:**
- Create: `scripts/central-user-manager/backfill-admin-auth-metadata.mjs`
- Create: `scripts/central-user-manager/backfill-lib.mjs`
- Create: `supabase/migrations/<timestamp>_enforce_admin_credential_fence.sql`
- Test: `tests/central-user-manager-backfill.test.ts`
- Test: `lib/central-user-manager/__tests__/credential-fence-migration.test.ts`

**Interfaces:**
- Produces dry-run/apply backfill and final RLS/function enforcement.

- [ ] Write failing tests for duplicates, one-sided accounts, metadata preservation, idempotent rerun, redacted report, exact-self SELECT policy, and DB/JWT version match.
- [ ] Implement dry-run by default; require `--apply --project-ref <exact-ref>`.
- [ ] Backfill version 1 and `bpv_admin_managed=true` without inventing creation provenance.
- [ ] Create enforcement migration only after backfill verification; update `private.is_home_config_admin()` and narrow browser SELECT to exact self.
- [ ] Run focused tests and apply only to a selected safe environment in prepare → backfill → enforce order.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 12: Add Tenant provisioning, rotation, and documentation

**Files:**
- Create: `scripts/central-user-manager/auth-attestation.mjs`
- Create: `scripts/central-user-manager/validate-bearer-token.mjs`
- Create: `docs/central-user-manager/tenant-provisioning.md`
- Modify: `README.md`
- Modify: `docs/ai/structure.html`
- Test: `tests/central-user-manager-auth-attestation.test.ts`
- Test: `tests/central-user-manager-bearer-provisioning.test.ts`

**Interfaces:**
- Produces pure token validation and attestation helpers consumed by the `webook` provisioning CLI.

- [ ] Write failing tests for exact 43-character base64url decoding to 32 bytes, canonical Auth attestation, token version reporting, and redacted failures.
- [ ] Implement validation helpers that accept token only as an in-memory string and never print it.
- [ ] Document initial install, immediate rotation downtime, inactive-on-failure behavior, prepare/backfill/enforce rollout, lost password response, quarantine, and one-sided repair.
- [ ] Update the structure map with both routes, cache bypass, helpers, schema ownership, forced-password flow, and targeted tests.
- [ ] Run both focused tests.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 13: Complete Tenant verification and staged rollout

**Files:**
- Modify only files proven deficient by verification.

**Interfaces:**
- Produces verified Tenant Agent release evidence for Control Plane integration.

- [ ] Search for leakage:

```powershell
rg -n "CENTRAL_USER_MANAGER_BEARER_TOKEN|Authorization|temporaryPassword|SUPABASE_SECRET_KEY|Math\\.random|console\\.(log|error)" app components lib scripts tests worker*.js
```

- [ ] Review every match; env names and in-memory DTO fields are allowed, values/logging/persistence are not.
- [ ] Run focused Central User Manager tests.
- [ ] Run `npm.cmd run lint`, `npm.cmd test`, and `npm.cmd run build`.
- [ ] Render touched admin pages on mobile and desktop and inspect loading, error, long-text, and forced-change states.
- [ ] Run production browser/network checks proving no cache of internal routes, no secret in payload/log, and bounded request counts.
- [ ] Stage-test two Tenants with different tokens; prove A cannot authorize B.
- [ ] Exercise list, create, lost response, reissue, forced change, old-session denial, suspend, reactivate, injected timeout, quarantine, and exact reconciliation.
- [ ] Review `git diff --check`, `git status --short`, and the full diff.
- [ ] Stop at commit-ready state and report evidence; do not commit without explicit user instruction.

## Tenant Acceptance Gate

- Both exact internal paths require the correct per-Tenant Bearer token.
- Malformed expected configuration fails closed with `503`; bad callers receive `401`.
- Token A never authorizes Tenant B.
- No custom cache stores or serves an Agent response.
- User lifecycle, idempotency, one-time password, quarantine, and credential fence match the approved design.
- Adding or rotating a Tenant deploys only that Tenant.
- Focused tests, full lint, full tests, build, responsive inspection, network inspection, and staging lifecycle all pass.
