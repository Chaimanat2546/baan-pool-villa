# Central User Manager webook RPC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the minimal `webook` admin caller for all five user-management actions and a dedicated Staging Worker that can reach Tenant Agents only through explicit named-entrypoint Service Bindings.

**Architecture:** `webook` authenticates an exact role-1 operator, resolves a Tenant UUID through a compile-time allowlist, obtains the binding from OpenNext's Cloudflare context, calls `executeOperation`, validates the untrusted RPC result, and writes a password-free audit event. A small Thai admin page lists users and exposes create, reissue, suspend, and reactivate actions. Staging uses a separate Wrangler config pinned to the verified `chaymanus2003` account ID.

**Tech Stack:** Next.js 16.2.9 App Router, React 19, TypeScript, OpenNext Cloudflare, Cloudflare Service Bindings RPC, Supabase/Postgres, Node test runner, existing Shadcn UI.

## Global Constraints

- Work in `C:\Users\chaym\Projects\webook`; read its `AGENTS.md` before every implementation session.
- Because this is non-trivial auth/Supabase work, execution must use the repository's read-only `webook_explorer` before edits and `webook_reviewer` after implementation; only the main agent edits.
- Do not install, remove, or upgrade dependencies.
- Read the installed Next.js 16.2.9 route/server-action docs and current OpenNext `getCloudflareContext` and Cloudflare Service Binding docs before coding.
- Use TDD and exact role-1 authorization on every page/action boundary.
- Browser input may contain only Tenant UUID, operation UUID, action, and strict action payload; it never supplies a Worker, binding, URL, origin, project ref, or secret.
- Do not add Bearer, Agent-origin, token encryption, KEK, token rotation, dynamic dispatch, Cloudflare Access, IP allowlisting, or HTTP Agent fetch code.
- Do not persist temporary passwords, operation payloads, or raw RPC/provider errors.
- Staging Cloudflare account ID is exactly `0df55f166fa309dcc904e992c43f86db` and the workers.dev identity is `chaymanus2003`.
- Any other Cloudflare account, including `poolvilla`, must fail before upload or mutation.
- Do not deploy, mutate remote Supabase, create secrets, or commit unless separately authorized.

---

### Task 1: Add exact central-admin authorization

**Files:**
- Modify: `server/auth/admin.ts`
- Modify: `app/admin/layout.tsx`
- Modify: `components/layout/admin-shell.tsx`
- Modify: `components/layout/admin-desktop-sidebar.tsx`
- Create: `tests/central-user-manager-auth.test.ts`

**Interfaces:**
- Consumes: existing `requireAdmin()` and `AdminUserForAuth.role_id`.
- Produces: `canManageCentralUsers(user)` and `requireCentralUserManagerAdmin()`.

- [ ] **Step 1: Write failing authorization tests**

```ts
assert.equal(canManageCentralUsers({ role_id: 1 }), true);
assert.equal(canManageCentralUsers({ role_id: 2 }), false);
assert.equal(canManageCentralUsers(null), false);
```

Assert the Central guard rejects unauthenticated, missing-profile, and non-role-1 users and returns exact `user.id`, `adminUser`, and request-scoped Supabase client for role 1.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm.cmd run test -- tests/central-user-manager-auth.test.ts`

Expected: FAIL because the guard does not exist.

- [ ] **Step 3: Implement the exact guard**

```ts
export function canManageCentralUsers(
  user: Pick<AdminUserForAuth, "role_id"> | null,
): boolean {
  return user?.role_id === 1;
}

export async function requireCentralUserManagerAdmin() {
  const session = await requireAdmin();
  if (!canManageCentralUsers(session.adminUser)) throw new Error("Unauthorized");
  return session;
}
```

Keep redirect behavior only for true unauthenticated sessions; return a forbidden page/action error for a signed-in non-role-1 user.

- [ ] **Step 4: Pass permission into the shell and add a role-1-only Thai navigation item**

Add `/admin/user-manager` labelled `จัดการผู้ใช้`. Hiding navigation is not authorization.

- [ ] **Step 5: Run auth and shell tests**

Run: `npm.cmd run test -- tests/central-user-manager-auth.test.ts tests/layout-sidebar-ui.test.ts`

Expected: PASS.

- [ ] **Step 6: Review without committing**

Confirm quotation/accommodation permissions are unchanged.

### Task 2: Create a password-free central audit table

**Files:**
- Create via `npm.cmd exec supabase -- migration new central_user_manager_rpc_audit`: one generated `supabase/migrations/*_central_user_manager_rpc_audit.sql`
- Create: `server/repositories/central-user-audit.ts`
- Create: `tests/central-user-manager-audit-migration.test.ts`
- Create: `tests/central-user-manager-audit-repository.test.ts`

**Interfaces:**
- Consumes: existing server-only Supabase admin client.
- Produces: `startCentralUserAudit(input)` and `finishCentralUserAudit(input)` with safe fields only.

- [ ] **Step 1: Generate the migration path with the installed Supabase CLI**

Run: `npm.cmd exec supabase -- migration new central_user_manager_rpc_audit`

Expected: exactly one new migration ending `_central_user_manager_rpc_audit.sql`. Do not apply it remotely.

- [ ] **Step 2: Write failing migration contract tests**

Assert one `public.central_user_audit_events` table with UUID operation identity, Tenant UUID, actor UID, allowlisted action/status, safe error code, timestamps, RLS forced, and no payload/password/token/origin/binding columns. Assert `anon` and `authenticated` have no table privileges and `service_role` has the required explicit projection/write privileges.

- [ ] **Step 3: Run migration tests and confirm RED**

Run: `npm.cmd run test -- tests/central-user-manager-audit-migration.test.ts`

Expected: FAIL because the generated migration is empty.

- [ ] **Step 4: Implement the migration**

```sql
create table public.central_user_audit_events (
  operation_id uuid primary key,
  tenant_id uuid not null,
  actor_uid uuid not null,
  action text not null check (action in (
    'list_users','create_user','reissue_temporary_password','suspend_user','reactivate_user'
  )),
  status text not null check (status in ('started','completed','in_progress','needs_review','quarantined','failed')),
  safe_error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.central_user_audit_events enable row level security;
alter table public.central_user_audit_events force row level security;
revoke all on public.central_user_audit_events from public, anon, authenticated;
grant select, insert, update on public.central_user_audit_events to service_role;
```

Add constraints that `completed_at` and `safe_error_code` match terminal versus nonterminal status. Do not store email or temporary password.

- [ ] **Step 5: Write failing repository tests**

Test exact insert, exact operation-bound terminal update, exact duplicate retry with matching Tenant/actor/action, rejection of conflicting operation UUID reuse, safe-code length cap, and error redaction with an injected fake client.

- [ ] **Step 6: Implement the repository with explicit projections**

```ts
export interface CentralAuditStart {
  operationId: string;
  tenantId: string;
  actorUid: string;
  action: CentralUserAction;
}
```

Never accept a payload or password parameter.

- [ ] **Step 7: Run migration/repository tests and advisors locally**

Run: `npm.cmd run test -- tests/central-user-manager-audit-migration.test.ts tests/central-user-manager-audit-repository.test.ts`

Run the migration only against disposable local Supabase, then run `npm.cmd exec supabase -- db advisors --local`. The installed CLI is `2.108.0`, above the required `2.81.3`. Expected: PASS/no security findings for the new table.

- [ ] **Step 8: Review without committing**

Confirm no Browser role can read audit rows and no production-like remote database was touched.

### Task 3: Define the Tenant allowlist and binding resolver

**Files:**
- Create: `server/central-user-manager/contracts.ts`
- Create: `server/central-user-manager/tenant-bindings.ts`
- Create: `server/central-user-manager/cloudflare-bindings.ts`
- Create: `tests/central-user-manager-tenant-bindings.test.ts`
- Create: `cloudflare-env.d.ts`

**Interfaces:**
- Consumes: `getCloudflareContext({ async: true })` from `@opennextjs/cloudflare`.
- Produces: `resolveCentralUserTenant(tenantId)`, `getCentralUserBinding(tenantId)`, and `CentralUserManagerBinding.executeOperation(input)`.

- [ ] **Step 1: Write failing allowlist tests**

Assert canonical UUID parsing; the approved Staging Tenant UUID `2b4e0c23-b66c-43c8-892c-ac1a9b5f2ccb`; active/inactive behavior; unknown UUID failure; and proof that no caller-supplied key performs dynamic `env[key]` access.

- [ ] **Step 2: Define the shared wire types and strict result parser**

Repeat the Tenant RPC contract exactly, including `protocolVersion: 1`, five actions, list bounds, normalized email shape, safe statuses, and one-time password constraints. Treat RPC output as `unknown` and validate exact keys before returning it to orchestration.

- [ ] **Step 3: Implement an explicit resolver**

```ts
export const STAGING_TENANT_ID = "2b4e0c23-b66c-43c8-892c-ac1a9b5f2ccb";

export async function getCentralUserBinding(tenantId: string) {
  if (tenantId !== STAGING_TENANT_ID) throw new CentralUserManagerError("tenant_unavailable");
  const { env } = await getCloudflareContext({ async: true });
  return env.CUM_BAAN_POOL_VILLA_STAGING;
}
```

Declare `CUM_BAAN_POOL_VILLA_STAGING` as a typed Service Binding. Do not index `env` with a string.

- [ ] **Step 4: Run binding tests**

Run: `npm.cmd run test -- tests/central-user-manager-tenant-bindings.test.ts`

Expected: PASS.

- [ ] **Step 5: Review without committing**

Confirm the Browser cannot select a destination and source contains no Agent URL or Bearer.

### Task 4: Implement the RPC client and orchestration service

**Files:**
- Create: `server/central-user-manager/agent-client.ts`
- Create: `server/services/central-user-manager.ts`
- Create: `tests/central-user-manager-agent-client.test.ts`
- Create: `tests/central-user-manager-service.test.ts`

**Interfaces:**
- Consumes: exact admin guard, binding resolver, RPC result parser, and audit repository.
- Produces: `runCentralUserOperation(input)` returning a Browser-safe operation result.

- [ ] **Step 1: Write failing client tests**

Cover exact input, correct binding, invalid result, wrong operation ID/action, thrown RPC, oversized list, unsafe error, temporary password on disallowed action, and no redirect/HTTP/Bearer behavior.

- [ ] **Step 2: Implement the binding client**

```ts
export async function callTenantAgent(
  request: CentralUserRpcRequest,
  binding = await getCentralUserBinding(request.tenantId),
): Promise<CentralUserRpcResult> {
  const raw = await binding.executeOperation(request);
  return parseCentralUserRpcResult(raw, request);
}
```

Catch thrown RPC errors and return one `agent_unavailable` classification; never serialize the thrown value.

- [ ] **Step 3: Write failing orchestration tests**

Assert exact role-1 authorization precedes audit/binding work, start audit precedes RPC, terminal audit follows safe result, duplicate operation reuse is deterministic, and temporary password is returned only to the current action response and never passed to audit.

- [ ] **Step 4: Implement orchestration**

```ts
export interface RunCentralUserOperationInput {
  tenantId: string;
  operationId: string;
  action: CentralUserAction;
  payload: CentralUserPayload;
}
```

Derive `actorUid` only from `requireCentralUserManagerAdmin().user.id`; reject any Browser actor field. Call `startCentralUserAudit`, the binding client, then `finishCentralUserAudit` with status and safe error code only.

- [ ] **Step 5: Run client/service tests**

Run: `npm.cmd run test -- tests/central-user-manager-agent-client.test.ts tests/central-user-manager-service.test.ts`

Expected: PASS.

- [ ] **Step 6: Review without committing**

Search the new server folder for `fetch(`, `Authorization`, `Bearer`, URL parsing, token, KEK, and dynamic env access; expected no transport-secret matches.

### Task 5: Build the minimal Thai user-management page

**Files:**
- Create: `app/admin/user-manager/page.tsx`
- Create: `app/admin/user-manager/actions.ts`
- Create: `components/admin/user-manager/user-manager-page.tsx`
- Create: `components/admin/user-manager/user-action-dialog.tsx`
- Create: `components/admin/user-manager/one-time-password-dialog.tsx`
- Create: `tests/central-user-manager-actions.test.ts`
- Create: `tests/central-user-manager-ui.test.tsx`

**Interfaces:**
- Consumes: `runCentralUserOperation` and exact role-1 guard.
- Produces: paginated list and four mutation interactions for the approved Staging Tenant.

- [ ] **Step 1: Write failing Server Action tests**

Assert strict form/action parsing, 16 KiB Browser request cap at the action boundary, canonical operation UUID validation, role-1 check on every invocation, stable Thai safe errors, and no password persistence/logging.

- [ ] **Step 2: Implement narrow Server Actions**

Use one internal action dispatcher with exported action wrappers. Accept only Tenant UUID, one client-generated canonical operation UUID, and action-specific fields. The UI creates the UUID once with `crypto.randomUUID()` before submission and reuses that exact UUID only for an explicit retry of the same normalized request; the server never derives authority from it.

- [ ] **Step 3: Write failing UI tests**

Cover loading, empty, error, long email, pagination, create, reissue confirmation, suspend/reactivate confirmation, abnormal status, keyboard labels/focus, and one-time password close/copy warning. Assert password disappears when the dialog closes and cannot be reopened from state/history.

- [ ] **Step 4: Implement the compact admin UI**

Use existing Shadcn components. Keep one Tenant summary, a paginated table/cards, and dialogs; do not add a registry editor, token UI, health dashboard, origin fields, or placeholder actions. Admin copy is Thai; technical status codes may remain English where useful.

- [ ] **Step 5: Run action/UI tests**

Run: `npm.cmd run test -- tests/central-user-manager-actions.test.ts tests/central-user-manager-ui.test.tsx`

Expected: PASS.

- [ ] **Step 6: Render and inspect locally**

Inspect `/admin/user-manager` at mobile, tablet, and desktop widths. Verify loading, empty, error, long-email, password-dialog, and action-disabled states. Fix only evidence-backed layout/accessibility issues.

- [ ] **Step 7: Review without committing**

Confirm the page source and Browser network contain no binding name, Worker target, project ref, Supabase secret, or retained password.

### Task 6: Add an account-pinned webook Staging deployment config

**Files:**
- Create: `wrangler.staging.jsonc`
- Create: `scripts/assert-staging-cloudflare-target.mjs`
- Create: `tests/cloudflare-staging-boundary.test.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: deployed Tenant Worker `baan-pool-villa-staging` named export `CentralUserManagerEntrypoint`.
- Produces: local build/upload commands that can target only account `0df55f166fa309dcc904e992c43f86db` and Worker `webook-staging`.

- [ ] **Step 1: Write failing deployment-boundary tests**

Assert exact `account_id`, Worker name, workers.dev enabled, isolated R2 bucket, binding name, target service, named entrypoint, no production route, and no Bearer/Agent URL variables. Assert the guard rejects missing/wrong `CLOUDFLARE_ACCOUNT_ID` when supplied and accepts only the exact ID.

- [ ] **Step 2: Create the isolated config**

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "account_id": "0df55f166fa309dcc904e992c43f86db",
  "name": "webook-staging",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-06-30",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "workers_dev": true,
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "r2_buckets": [{ "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "webook-staging-next-cache" }],
  "services": [{
    "binding": "CUM_BAAN_POOL_VILLA_STAGING",
    "service": "baan-pool-villa-staging",
    "entrypoint": "CentralUserManagerEntrypoint"
  }]
}
```

- [ ] **Step 3: Implement the preflight and scripts**

The preflight parses `wrangler.staging.jsonc`, requires the exact account/name/binding values, and rejects a nonblank `CLOUDFLARE_ACCOUNT_ID` that differs. Add scripts that always call the preflight before OpenNext upload/deploy with `-c wrangler.staging.jsonc`.

```json
{
  "upload:cf:staging": "node scripts/assert-staging-cloudflare-target.mjs && opennextjs-cloudflare build && opennextjs-cloudflare upload -c wrangler.staging.jsonc",
  "deploy:cf:staging": "node scripts/assert-staging-cloudflare-target.mjs && opennextjs-cloudflare build && opennextjs-cloudflare deploy -c wrangler.staging.jsonc"
}
```

- [ ] **Step 4: Run boundary tests and dry-run config inspection**

Run: `npm.cmd run test -- tests/cloudflare-staging-boundary.test.ts tests/cloudflare-deploy.test.ts`

Run: `npm.cmd exec wrangler -- deploy --dry-run -c wrangler.staging.jsonc --outdir .wrangler/staging-dry-run`

Expected: tests PASS; dry run names only `webook-staging`, the exact account ID/config, isolated R2, and the one named-entrypoint binding. It performs no upload.

- [ ] **Step 5: Update setup documentation**

Document the verified `chaymanus2003` boundary, exact workers.dev hostname `webook-staging.chaymanus2003.workers.dev`, required Staging Supabase secrets, target-first binding order, and prohibition on `poolvilla`. Do not document secret values.

- [ ] **Step 6: Review without committing or deploying**

Confirm no generic deploy script can silently substitute the Staging config and no production binding exists.

### Task 7: Complete local webook verification

**Files:**
- Modify only files proven deficient by verification.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: a deploy-ready but not deployed `webook` Staging change set.

- [ ] **Step 1: Run focused tests**

Run: `npm.cmd run test -- tests/central-user-manager-auth.test.ts tests/central-user-manager-audit-migration.test.ts tests/central-user-manager-audit-repository.test.ts tests/central-user-manager-tenant-bindings.test.ts tests/central-user-manager-agent-client.test.ts tests/central-user-manager-service.test.ts tests/central-user-manager-actions.test.ts tests/central-user-manager-ui.test.tsx tests/cloudflare-staging-boundary.test.ts`

Expected: PASS.

- [ ] **Step 2: Run repository verification**

Run: `npm.cmd run typecheck`

Run: `npm.cmd run lint`

Run: `npm.cmd run test`

Run: `npm.cmd run build`

Expected: PASS.

- [ ] **Step 3: Inspect UI and Browser data**

Verify mobile/tablet/desktop and loading/empty/error/long-text/one-time-password states. Inspect RSC/Server Action payloads and rendered HTML for no binding name, Agent target, project ref, secret, raw error, or password after dialog close.

- [ ] **Step 4: Inspect final deployment configuration**

Run the preflight with the exact allowed account ID; then run it with a different ID and with `poolvilla` as a human label in a test fixture. Expected: exact ID passes and every other ID fails before OpenNext build/upload.

- [ ] **Step 5: Inspect scope without committing**

Run: `git diff --check`

Run: `git status --short`

Run: `git diff`

Expected: only Central User Manager, Staging boundary, migration, tests, and required docs. Do not apply migrations, upload, deploy, set secrets, or commit.

## webook Plan Acceptance Gate

- Exact role-1 authorization protects page and every action.
- Browser cannot select or learn a Tenant destination.
- `webook` uses a typed named-entrypoint Service Binding and no Agent HTTP/Bearer client.
- All five actions work through the orchestration service.
- Audit contains no email, payload, password, token, binding, origin, or raw error.
- One-time password is request-local and UI-ephemeral.
- Staging config is pinned to `0df55f166fa309dcc904e992c43f86db`, `webook-staging`, and the staging Tenant binding.
- Every other account, including `poolvilla`, fails before upload.
- Focused tests, typecheck, lint, full tests, build, UI inspection, and dry-run config inspection pass.
- No remote database or Cloudflare resource was mutated.
