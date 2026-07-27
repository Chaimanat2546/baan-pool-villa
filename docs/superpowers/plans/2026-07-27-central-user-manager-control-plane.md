# Central User Manager Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มหน้า Central User Manager ใน `webook` ให้ผู้ดูแลที่ `public.users.uid` ตรงกับ Supabase Auth UID และ `role_id = 1` เท่านั้น สามารถเลือกโปรเจกต์ลูกค้า ดูรายชื่อแอดมิน สร้างบัญชีด้วย temporary password ออก temporary password ใหม่ ระงับ และเปิดใช้งานใหม่ผ่าน Tenant Agent ได้ โดยไม่ถือ target Supabase key และไม่ต้อง deploy webook ใหม่เมื่อเพิ่มลูกค้า.

**Architecture:** webook เป็น Control Plane และ source of truth ของ project registry, central operation และ audit สำหรับ 20–100 tenant. Browser ส่ง tenant UUID และ operation UUID เท่านั้น; server resolve exact Agent origin จาก registry, claim operation atomically, เซ็นคำขอ Ed25519, แนบ Cloudflare Access service token และส่งไปยัง Tenant Agent แบบ no-redirect/no-store. Temporary password ผ่านหน่วยความจำ server ไปยัง one-time dialog เท่านั้นและไม่ถูก persist ทุกชั้น.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript 5, Supabase SSR/Auth/Postgres, Cloudflare Workers/OpenNext, Web Crypto Ed25519/SHA-256, Node test runner, shadcn/radix UI.

## Global Constraints

- Implement in a writable checkout of [Chaimanat2546/webook](https://github.com/Chaimanat2546/webook). The inspected temporary checkout is read-only evidence, not the implementation target.
- Before implementation, obey webook’s `AGENTS.md`: use the required explorer/reviewer subagents, preserve user changes, and do not install dependencies without ภู’s approval.
- No new dependency is required. Use built-in Web Crypto and existing Supabase/shadcn packages.
- Read webook’s local Next.js 16 docs for Route Handlers, caching, forms, and environment variables before touching those surfaces.
- Use `npx.cmd --no-install supabase migration new central_user_manager_control_plane`; never invent a migration timestamp or edit an old migration.
- Do not change the existing `public.users` RLS/policies/grants. This is an approved, documented risk boundary.
- The current webook Supabase project ref is `rqizfiayvcbozlzuvbok`; verify it before applying migrations or provisioning, but never treat a project ref as a secret.
- Never authorize Central User Manager through the existing email fallback. Exact Auth UID + exactly one `public.users` row + `role_id = 1` is mandatory.
- Never store target Supabase URL/key, Access client secret, signing private key, temporary password, JWT, or raw signed request in a public table or client bundle.
- Do not accept an Agent URL, Supabase project ref, or remote credential from browser input.
- No invite, permanent delete, customer self-service, Service Binding, Queue, Durable Object, or Workers for Platforms migration in MVP.
- Temporary password has no time-based expiry. The operator can issue a replacement at any time and communicates it to the target user outside the system.
- Do not commit until ภู explicitly asks.
- Every task starts with focused failing tests and ends with focused passing tests.

## Cross-Repository Dependency

Implement and stage the Tenant Agent plan first:

`docs/superpowers/plans/2026-07-27-central-user-manager-tenant-agent.md`

Control Plane can be developed against a deterministic fake Agent, but production activation must wait until a real tenant passes Agent health, signature, credential-fence, and staging lifecycle tests.

## Fixed Browser-to-webook Contract

Browser-facing routes:

```text
POST /api/admin/user-manager/health
POST /api/admin/user-manager/operations
POST /api/admin/user-manager/operations/{operationId}/reconcile
```

All responses use `Cache-Control: private, no-store`. Browser request bodies:

```ts
export interface HealthRequest {
  tenantId: string;
  requestId: string;
}

export interface UserManagerOperationRequest {
  operationId: string;
  tenantId: string;
  action:
    | "list_users"
    | "create_user"
    | "reissue_temporary_password"
    | "suspend_user"
    | "reactivate_user";
  payload:
    | { page: number; pageSize: number }
    | { email: string };
}
```

The browser creates UUIDs with `crypto.randomUUID()` when a health/list request begins or an action dialog opens. The same operation ID is retained across network retries and disabled double-click handling. The server ignores any browser-supplied actor, Agent origin, project ref, request hash, status, or credentials.

## Fixed webook-to-Agent Contract

Use the exact headers, canonical bytes, action schema, 60-second window, and first-response-only password behavior from the Tenant Agent plan. Control Plane imports no code from the other repository; matching contract tests use shared published test vectors copied into both repos with a protocol version.

---

### Task 1: Freeze Control Plane contracts, validation, and request hashing

**Files:**

- Create: `server/central-user-manager/contracts.ts`
- Create: `server/central-user-manager/validation.ts`
- Create: `server/central-user-manager/request-hash.ts`
- Create: `server/central-user-manager/safe-errors.ts`
- Test: `tests/central-user-manager-contracts.test.ts`
- Test: `tests/central-user-manager-request-hash.test.ts`

- [ ] Write failing tests for every browser action, strict payload discrimination, extra-key rejection, normalized email, pagination `1..100`, valid UUIDs, and bounded input.
- [ ] Define stable Thai-safe UI statuses and operation/error codes; keep provider detail server-side.
- [ ] Canonicalize the central request hash from:

```json
{
  "version": 1,
  "tenantId": "<uuid>",
  "actorUid": "<auth uuid>",
  "action": "<action>",
  "payload": "<strict normalized payload>"
}
```

- [ ] Serialize with a fixed key order and hash UTF-8 bytes using SHA-256 lowercase hex.
- [ ] Prove with tests that whitespace/key-order differences do not change the hash, while actor, tenant, action, page, or normalized email changes do.
- [ ] Ensure no password field is accepted at the browser boundary.
- [ ] Run `npm.cmd test -- tests/central-user-manager-contracts.test.ts tests/central-user-manager-request-hash.test.ts`.

### Task 2: Create the Control Plane schema migration

**Files:**

- Create with CLI: `supabase/migrations/<CLI-generated>_central_user_manager_control_plane.sql`
- Test: `tests/central-user-manager-migration.test.ts`

- [ ] Run `npx.cmd --no-install supabase migration new central_user_manager_control_plane`.
- [ ] Write a failing source-contract test that locates the migration by suffix and checks every table, constraint, index, RLS/revoke/grant, private function, wrapper, fixed `search_path`, append-only audit trigger, and schema reload.
- [ ] Create `public.customer_projects`:

```text
id uuid primary key
display_name text
target_supabase_project_ref text unique
agent_origin text unique
wrangler_environment text
is_active boolean default false
expected_agent_version text
expected_schema_version text
auth_attestation_version text
auth_attestation_digest text
auth_attestation_checked_at timestamptz
last_health_status healthy | unhealthy | unknown
last_health_checked_at timestamptz
last_health_safe_error text nullable
created_at / updated_at
```

- [ ] Add database checks for nonblank display/env/version values, Supabase ref format, lowercase 64-hex digest, HTTPS origin-only value, and sane attestation timestamp. Application validation remains stricter for SSRF protection.
- [ ] Create `public.user_management_operations`:

```text
operation_id uuid primary key
tenant_id uuid references customer_projects
actor_uid uuid
action list_users | create_user | reissue_temporary_password |
       suspend_user | reactivate_user
target_email_normalized text nullable only for list_users
request_hash text
status received | dispatching | completed | in_progress |
       needs_review | quarantined | failed_safe
agent_stage text nullable
safe_error_code / safe_error_message nullable
dispatch_attempt_count integer
created_at / dispatched_at / completed_at / updated_at
```

- [ ] Add immutable binding for operation ID → tenant, actor, action, target, request hash.
- [ ] Create `public.central_user_audit_events` with event UUID, operation UUID, tenant UUID, actor UID, action, result/status, safe stage/error data, request timestamp, and created timestamp.
- [ ] Make audit append-only with a trigger that rejects update/delete. Do not store an arbitrary raw request/response JSON blob.
- [ ] Enable RLS on all three new public tables; revoke all privileges from `anon, authenticated`; grant only the minimum to `service_role`.
- [ ] Create `private.claim_central_user_operation(...)` plus a narrow public service-role wrapper. It must atomically:
  - insert first claim as `dispatching`;
  - return exact existing state for matching retry;
  - reject the same UUID bound to different actor/request;
  - ensure only the transaction that inserted can dispatch.
- [ ] Create narrow completion/ambiguous/audit/health-update functions with compare-and-swap expected status.
- [ ] Use `SECURITY DEFINER SET search_path = pg_catalog, public, private, extensions`, explicit grants, and `notify pgrst, 'reload schema'`.
- [ ] Run the migration contract test and test the migration on a disposable local Supabase database only.

### Task 3: Add exact UID/role authorization without changing legacy auth

**Files:**

- Create: `server/auth/central-user-manager.ts`
- Modify: `server/repositories/admin-users.ts`
- Test: `tests/central-user-manager-auth.test.ts`
- Modify: `server/auth/admin.ts` only if a shared type/export is required; do not change existing fallback behavior.

- [ ] Write failing tests for exact UID + role 1 success, role 2 denial, email-only match denial, UID mismatch denial, zero rows, duplicate rows, missing service-role client, Supabase error, and unauthenticated session.
- [ ] Add `findCentralUserManagerAdminByUid(adminClient, authUid)` that queries:

```text
public.users
  select uid, role_id
  where uid = authUid and role_id = 1
  limit 2
```

- [ ] Authenticate the session with the existing SSR client’s `auth.getUser()`, then authorize with `createSupabaseAdminClient()` so this capability does not rely on the existing `users` RLS.
- [ ] Require exactly one row. Do not query by email, username, `mid`, display name, or localized role label.
- [ ] Export:

```ts
getCentralUserManagerCapability(authUid): Promise<boolean>
requireCentralUserManagerAdmin(): Promise<{
  actorUid: string;
  adminClient: SupabaseClient;
}>
```

- [ ] `require...` redirects only page requests to `/login`; API helpers must return explicit 401/403 JSON without redirect.
- [ ] Keep the existing generic `requireAdmin()` and email fallback unchanged for all unrelated webook features.
- [ ] Run the focused auth test.

### Task 4: Add server-only Control Plane configuration

**Files:**

- Modify: `lib/env.ts`
- Modify: `.env.example`
- Create: `server/central-user-manager/config.ts`
- Test: `tests/central-user-manager-config.test.ts`

- [ ] Write failing tests for absent, malformed, and valid config.
- [ ] Add server-only configuration:

```text
CENTRAL_USER_MANAGER_ACCESS_CLIENT_ID
CENTRAL_USER_MANAGER_ACCESS_CLIENT_SECRET
CENTRAL_USER_MANAGER_SIGNING_KEY_ID
CENTRAL_USER_MANAGER_SIGNING_PRIVATE_KEY_PKCS8_BASE64
CENTRAL_USER_MANAGER_PROTOCOL_VERSION=1
CENTRAL_USER_MANAGER_AGENT_TIMEOUT_MS
```

- [ ] Keep the existing `SUPABASE_SERVICE_ROLE_KEY` as the only key for the webook project; do not add any target Supabase key.
- [ ] Validate key ID, base64 PKCS#8 key material, protocol version, and timeout `1000..20000` ms.
- [ ] Default timeout to 10 seconds, lower than the target’s 30-second lease minus its processing margin.
- [ ] Add placeholders to `.env.example`, never values.
- [ ] Ensure no Central User Manager server module is imported by a Client Component.
- [ ] Run the config tests.

### Task 5: Validate project origins and sign Agent requests

**Files:**

- Create: `server/central-user-manager/agent-origin.ts`
- Create: `server/central-user-manager/agent-signature.ts`
- Create: `server/central-user-manager/protocol-test-vectors.ts`
- Test: `tests/central-user-manager-agent-origin.test.ts`
- Test: `tests/central-user-manager-agent-signature.test.ts`

- [ ] Write failing origin tests for exact HTTPS origin success and rejection of HTTP, credentials, paths, query, fragments, non-443 explicit ports, localhost, IP literals, private/link-local names, Unicode/confusable normalization, and redirects.
- [ ] Accept only an exact normalized origin stored by provisioning after Cloudflare-account ownership verification. Browser values never reach this function.
- [ ] Write failing Ed25519 tests with ephemeral keys for canonical request vectors, body mutation, actor/path/tenant mutation, wrong key, and timestamp.
- [ ] Import the base64 PKCS#8 private key with Web Crypto and sign the exact canonical format in the Tenant Agent plan.
- [ ] Hash exact serialized body bytes first and set every `X-CUM-*` header from the verified server context.
- [ ] Add static protocol test vectors containing no secrets and copy the same vector values to the target repo’s signature tests during implementation.
- [ ] Run both focused test files.

### Task 6: Implement project, operation, and audit repositories

**Files:**

- Create: `server/repositories/customer-projects.ts`
- Create: `server/repositories/user-management-operations.ts`
- Create: `server/repositories/central-user-audit-events.ts`
- Test: `tests/customer-projects-repository.test.ts`
- Test: `tests/user-management-operations-repository.test.ts`
- Test: `tests/central-user-audit-repository.test.ts`

- [ ] Write failing fake-query/RPC tests for active project lookup, inactive/missing tenant, safe list projection, operation first claim, exact retry, conflicting UUID reuse, dispatch ownership, completion, ambiguous response, health state, and append-only audit insertion.
- [ ] Return registry records only from the service-role client and only through explicit selected columns.
- [ ] Resolve Agent origin/project ref/version/attestation by tenant UUID inside the server; never accept or merge browser-supplied values.
- [ ] Keep central operation methods as thin calls to transactional RPCs.
- [ ] Create audit events for denied capability, health, list, mutation dispatch, result, ambiguous timeout, reconciliation, and provisioning activation. Do not audit secrets or raw payloads.
- [ ] Sanitize safe error code/message before persistence; cap lengths.
- [ ] Run all repository tests.

### Task 7: Build the Agent HTTP client

**Files:**

- Create: `server/central-user-manager/agent-client.ts`
- Test: `tests/central-user-manager-agent-client.test.ts`

- [ ] Write failing tests using injected fetch for health, list, mutation, Access headers, signed headers, timeout, redirect, non-JSON, oversized response, protocol/version mismatch, tenant mismatch, unsafe error body, 5xx, and network ambiguity.
- [ ] Build URL only as:

```ts
new URL(
  "/api/internal/central-user-manager/v1/health",
  verifiedRegistryOrigin,
)

new URL(
  "/api/internal/central-user-manager/v1/operations",
  verifiedRegistryOrigin,
)
```

- [ ] Use `redirect: "error"`, `cache: "no-store"`, exact JSON content type, bounded body, AbortController timeout, and these Access headers:

```text
CF-Access-Client-Id
CF-Access-Client-Secret
```

- [ ] Sign exact request bytes after JSON serialization. Do not reserialize after calculating the hash.
- [ ] Strictly validate Agent responses and cap bytes before parsing. Never reflect raw HTML/provider messages to UI.
- [ ] Distinguish a definite signed Agent result from ambiguous timeout/network failure. Never automatically resend a mutation after ambiguity.
- [ ] Never log headers, request body, raw Agent response, or `temporaryPassword`.
- [ ] Run the focused client test.

### Task 8: Orchestrate idempotent operations and one-time secrets

**Files:**

- Create: `server/services/central-user-manager.ts`
- Test: `tests/central-user-manager-service.test.ts`

- [ ] Write failing service tests for unauthorized/inactive tenant, first dispatch, double-click same UUID, mismatched retry, completed retry, Agent in-progress/quarantine, timeout ambiguity, central DB finalization failure, and first-response password handling.
- [ ] Service flow:
  1. receive exact actor from auth guard;
  2. validate/normalize body;
  3. resolve active tenant registry;
  4. calculate request hash;
  5. atomically claim central operation;
  6. only the winning claim dispatches;
  7. persist safe result and append audit;
  8. return validated result.
- [ ] If an existing exact operation is completed, return its persisted safe result without a password.
- [ ] If Agent returns a temporary password, hold it in a local variable only. Persist operation and audit without it before constructing the HTTP response.
- [ ] If central finalization/audit fails after Agent success, discard the password and return `needs_review`; exact reconciliation can recover safe state, then operator can issue a new password.
- [ ] On timeout/ambiguous transport, mark central operation `needs_review`, return no password, and enable only exact read-only reconciliation.
- [ ] `reconcileOperation` resends the same operation ID/request hash to the Agent and expects reconciliation behavior; it never creates a new mutation.
- [ ] Run the service tests.

### Task 9: Add authenticated no-store webook Route Handlers

**Files:**

- Create: `server/central-user-manager/api-auth.ts`
- Create: `server/central-user-manager/api-response.ts`
- Create: `app/api/admin/user-manager/health/route.ts`
- Create: `app/api/admin/user-manager/operations/route.ts`
- Create: `app/api/admin/user-manager/operations/[operationId]/reconcile/route.ts`
- Test: `tests/central-user-manager-api-routes.test.ts`

- [ ] Read the local Next.js 16 Route Handler and caching docs.
- [ ] Write failing route tests for unauthenticated, role denied, malformed/oversized JSON, path/body operation mismatch, inactive tenant, success, one-time password, exact retry, timeout, reconcile, and safe error headers.
- [ ] Authenticate each request with exact UID/role guard; do not rely solely on parent layout.
- [ ] Set on every response:

```text
Cache-Control: private, no-store, max-age=0
Pragma: no-cache
Expires: 0
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

- [ ] Accept only `application/json`, cap request size, reject unknown keys, and return structured Thai-safe errors.
- [ ] Confirm the response containing `temporaryPassword` cannot be cached and has no URL/query representation.
- [ ] Run route tests.

### Task 10: Build the project/user master-detail-status page

**Files:**

- Create: `app/admin/user-manager/page.tsx`
- Create: `app/admin/user-manager/loading.tsx`
- Create: `components/admin/user-manager/user-manager-page.tsx`
- Create: `components/admin/user-manager/project-list.tsx`
- Create: `components/admin/user-manager/user-table.tsx`
- Create: `components/admin/user-manager/status-panel.tsx`
- Create: `components/admin/user-manager/user-status-badge.tsx`
- Create: `components/admin/user-manager/types.ts`
- Create: `components/admin/user-manager/use-user-manager.ts`
- Test: `tests/central-user-manager-page.test.ts`
- Test: `tests/central-user-manager-view-model.test.ts`

- [ ] Write failing page/auth source tests proving the page calls `requireCentralUserManagerAdmin`, loads projects server-side, and does not expose Agent origin/project ref/access credentials to Client Component props.
- [ ] Write failing view-model tests for project selection, generated/reused operation ID, health, pagination, loading, empty, long email, active/forced/suspended/abnormal status, and quarantine action disabling.
- [ ] Implement compact Modern SaaS/Clean Card layout:
  - desktop: left project list, center user table/actions, right health/operation status;
  - narrow screen: project selector, user content, then status stack.
- [ ] Project list shows display name, active/health state, expected Agent/schema version, and attestation state. It does not show secrets.
- [ ] Selecting a project generates a browser request UUID, calls health, then a `list_users` operation with page size at most 100.
- [ ] Table columns: Email, สถานะ, สร้างเมื่อ, เข้าสู่ระบบล่าสุด, การจัดการ.
- [ ] Status labels are exactly:
  - `รอเปลี่ยนรหัส`
  - `ใช้งาน`
  - `ระงับ`
  - `ข้อมูลผิดปกติ`
- [ ] Add accessible labeled controls, keyboard focus, responsive wrapping/truncation, loading skeleton, empty state, retry state, and safe error state.
- [ ] Reuse existing `Card`, `Table`, `Badge`, `Alert`, `Input`, `Dialog`, `Button`, `Skeleton`, and `sonner` components where present. Add a shadcn component only if missing and without installing a package.
- [ ] Run page/view-model tests.

### Task 11: Add create and lifecycle dialogs with one-time password display

**Files:**

- Create: `components/admin/user-manager/create-user-dialog.tsx`
- Create: `components/admin/user-manager/user-action-dialog.tsx`
- Create: `components/admin/user-manager/temporary-password-dialog.tsx`
- Create: `components/admin/user-manager/operation-status-card.tsx`
- Test: `tests/central-user-manager-actions.test.ts`
- Test: `tests/temporary-password-dialog.test.ts`

- [ ] Write failing tests for email-only create, normalized preview, reissue confirmation, suspend confirmation, reactivate confirmation, disabled double-click, same UUID retry, one-time password clearing, clipboard failure, quarantine, and reconciliation.
- [ ] Create accepts only email. Do not add name, phone, role selector, tenant URL, or password input.
- [ ] Available row actions:
  - active/forced: ออกรหัสผ่านชั่วคราวใหม่, ระงับ;
  - suspended: เปิดใช้งานและออกรหัสผ่านใหม่;
  - abnormal/quarantined: ตรวจสอบสถานะ only.
- [ ] Reactivation copy must state that it always invalidates old access and creates a new temporary password.
- [ ] Keep returned password only in React memory. Never put it in toast, URL, local/session storage, form history, analytics, error reporting, or DOM after dialog close.
- [ ] Modal shows email, password, Copy button, warning that it is shown once, and acknowledgement before close. Closing immediately zeroes/removes the state reference.
- [ ] If the first response is lost or closed, UI instructs the operator to run a new reissue; it never claims the old password can be recovered.
- [ ] When Agent/central status is quarantined or needs review, disable all mutation buttons, show operation ID/stage/safe reason, and expose exact `ตรวจสอบสถานะ` reconciliation.
- [ ] Run both focused tests.

### Task 12: Add capability-gated navigation

**Files:**

- Modify: `app/admin/layout.tsx`
- Modify: `components/layout/admin-shell.tsx`
- Modify: `components/layout/admin-desktop-sidebar.tsx`
- Modify: `tests/layout-sidebar-ui.test.ts`
- Test: `tests/central-user-manager-navigation.test.ts`

- [ ] Write failing tests showing the menu is visible only when the exact UID has `role_id=1`, including mobile/collapsed variants.
- [ ] In the layout, derive `canManageCentralUsers` from the authenticated UID using the service-role exact capability check.
- [ ] Pass the boolean through `AdminShell` to `AdminDesktopSidebar`.
- [ ] Add `/admin/user-manager` with an appropriate users/shield icon and Thai label `จัดการผู้ใช้ลูกค้า`.
- [ ] Keep page and API guards even when the menu is hidden.
- [ ] Do not alter quotation/accommodation permissions or generic admin behavior.
- [ ] Run sidebar/navigation tests.

### Task 13: Build a safe provisioning CLI

**Files:**

- Create: `scripts/central-user-manager/provision-tenant.mjs`
- Create: `scripts/central-user-manager/provisioning/config.mjs`
- Create: `scripts/central-user-manager/provisioning/supabase-auth.mjs`
- Create: `scripts/central-user-manager/provisioning/cloudflare-access.mjs`
- Create: `scripts/central-user-manager/provisioning/attestation.mjs`
- Create: `scripts/central-user-manager/provisioning/registry.mjs`
- Test: `tests/central-user-manager-provisioning.test.ts`
- Modify: `package.json`
- Modify: `.env.example`

- [ ] Before implementation, verify the current official Supabase Management API and Cloudflare Access API schemas; do not rely on stale endpoint examples.
- [ ] Write failing pure/fake-fetch tests for dry run, config validation, Auth PATCH/GET readback, canonical attestation, Access app/policy/service-token lookup, idempotent rerun, registry insert/update, failed health, and no activation.
- [ ] Add script `central-users:provision` that defaults to dry-run. Require all of:

```text
--apply
--tenant-id <uuid>
--display-name <name>
--target-project-ref <ref>
--agent-origin <https origin>
--wrangler-environment <env>
--target-repo <absolute path>
```

- [ ] Use operator-machine-only credentials:

```text
SUPABASE_ACCESS_TOKEN
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
SUPABASE_SERVICE_ROLE_KEY   # webook registry only
```

Never pass them to the target Worker runtime.

- [ ] Supabase provisioning must PATCH then GET `/v1/projects/{ref}/config/auth`, verify:

```text
disable_signup=true
external_anonymous_users_enabled=false
password_min_length=8
password_required_characters=abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:!@#$%^&*()_+-=[]{};'\:"|<>?,./`~
password_hibp_enabled=<selected and recorded value>
security_update_password_require_reauthentication=false
```

- [ ] Calculate a versioned/timestamped digest binding exact project ref, normalized settings, policy version, and checked time. Supply the same nonsecret attestation values to target deploy and central registry.
- [ ] Cloudflare provisioning must idempotently ensure:
  - an Access application covers the two exact target paths;
  - a service-auth policy accepts the Central service token;
  - no public bypass policy exists;
  - the service token client ID matches target `common_name` verification.
- [ ] Validate exact Agent origin as HTTPS/443 and verify the deployment belongs to the configured Cloudflare account before registration.
- [ ] Invoke target deployment using the named Wrangler environment and its own secret provisioning. Never rebuild/deploy webook.
- [ ] Register the project inactive, call signed health, compare tenant/project/Agent/schema/attestation values, run signed `list_users`, then atomically activate.
- [ ] If any step fails, leave registry inactive, append a safe audit event, and print a redacted recovery command. Do not roll back proven external state blindly.
- [ ] Add package script without adding a dependency and run provisioning tests.

### Task 14: Add operator documentation and rotation/recovery procedures

**Files:**

- Create: `docs/central-user-manager.md`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/api.md`
- Modify: `.env.example`

- [ ] Document the Control Plane/Tenant Agent trust boundary and explain why adding a tenant does not redeploy webook.
- [ ] Document project onboarding, disabled signup/anonymous auth, exact password policy, target rollout phases, activation checks, and offboarding by deactivation rather than deletion.
- [ ] Document key ownership:
  - webook: Access client secret + active Ed25519 private key;
  - tenant: own Supabase secret key + Access verification settings + Ed25519 public keyring;
  - provisioning machine: Cloudflare/Supabase management credentials.
- [ ] Document Ed25519 rotation: add new public key to every tenant, switch webook active key ID, verify, then retire old key.
- [ ] Document Access service-token rotation, target secret rotation, Supabase secret-key rotation, quarantine review, one-sided account repair, lost password response, and webook DB outage after Agent success.
- [ ] Record the approved exception: existing `public.users` RLS is not changed, and Central authorization never relies on it.
- [ ] Document audit fields, retention decision, privacy constraints, and incident investigation queries that never select secrets.

### Task 15: Complete verification and staged rollout

**Files:**

- Modify only files found deficient during verification

- [ ] Search for accidental leakage and forbidden routing:

```powershell
rg -n "temporaryPassword|CF-Access-Client-Secret|SIGNING_PRIVATE|target.*SUPABASE|agentOrigin|console\\.(log|error)|localStorage|sessionStorage" app components lib server scripts tests
```

Review each match; in-memory DTO/env names are acceptable, persistence/logging/client registry data are not.

- [ ] Run focused Central User Manager tests.
- [ ] Run full webook verification:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

- [ ] Render `/admin/user-manager` locally and inspect desktop and mobile:
  - no projects;
  - inactive/unhealthy project;
  - healthy project;
  - user loading/empty/error/pagination;
  - long project/email text;
  - all four user statuses;
  - one-time password;
  - quarantine/reconciliation.
- [ ] Inspect browser network and server logs: no password in URL/log, no cached operation responses, no target origin/key in RSC/client payload, no redirect-following Agent request.
- [ ] Run security matrix:
  - unauthenticated;
  - legacy email-only match;
  - exact UID role != 1;
  - exact UID role 1;
  - browser-crafted Agent URL/ref;
  - operation UUID reuse with changed request;
  - double-click;
  - stale signature;
  - wrong Access identity;
  - Agent timeout;
  - central DB finalization failure.
- [ ] On one staging tenant, run full lifecycle: list, create, close/lost response, reissue, forced target password change, old-session denial, suspend, reactivate/new password, exact retry, injected provider timeout, quarantine, reviewed reconcile.
- [ ] Provision a second staging tenant and prove only its target Worker deploys; webook build/deployment version remains unchanged while the new project appears from registry data.
- [ ] Have the required webook reviewer subagent review security boundaries, migrations, SSRF controls, secret lifetime, idempotency, and UX. Resolve findings and rerun affected checks.
- [ ] Review `git diff --check`, `git status --short`, and full diff. Stop at commit-ready state and report exact verification evidence; do not commit without ภู’s instruction.

## Control Plane Acceptance Gate

Control Plane is production-ready only when all are true:

- Only exact Auth UID + exactly one `users` row + `role_id=1` can load the page or call APIs.
- Existing `users` RLS remains untouched and is not trusted for this authorization.
- Browser never receives Agent origin, target project ref, target Supabase key, Access secret, or signing key.
- Project registry controls every outbound destination and passes strict origin/ownership checks.
- Every Agent request passes both Access and Ed25519 protocol tests.
- Same operation UUID cannot dispatch twice or be rebound to another actor/request.
- Ambiguous mutations never auto-retry and surface exact read-only reconciliation.
- Temporary password is returned once, never persisted/logged/cached, and disappears when the modal closes.
- Reactivation always generates a new temporary password.
- Adding tenant number 21 through 100 requires target provisioning/registration only, not a webook deployment.
- Full typecheck, lint, tests, build, responsive inspection, security matrix, staging lifecycle, and reviewer pass.
