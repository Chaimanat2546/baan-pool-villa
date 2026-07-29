# Central User Manager Bearer Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `webook` Control Plane that stores one encrypted Bearer token per Tenant, calls each verified `baan-pool-villa` Agent, and adds or rotates Tenants without deploying `webook`.

**Architecture:** The server-only registry stores AES-256-GCM ciphertext bound to Tenant/token/KEK versions. Authorized central administrators dispatch strict idempotent operations through a no-redirect HTTP client that decrypts one token only in request memory and sends it to the exact registry origin.

**Tech Stack:** Next.js 16, TypeScript, Supabase/Postgres, Web Crypto AES-GCM/SHA-256, Cloudflare Workers, Vitest, existing `webook` admin components.

## Global Constraints

- Execute this plan only in a writable `webook` checkout after reading that repository’s current `AGENTS.md`, structure docs, and local Next.js docs.
- Do not implement this plan inside `baan-pool-villa`.
- One Tenant token is exactly 32 bytes encoded as 43-character unpadded base64url.
- Token input is hidden prompt or bounded stdin only; never CLI arguments, Browser UI, URLs, logs, or audit.
- `CENTRAL_USER_MANAGER_TOKEN_KEK` is one server-only 32-byte key; it is never in the database or `NEXT_PUBLIC_*`.
- Adding a Tenant must not build or deploy `webook`.
- Rotation is immediate cutover with Tenant inactive throughout; no old/new token overlap.
- Existing `public.users` RLS remains unchanged and is never trusted for Central authorization.
- Do not commit unless the user explicitly instructs.

## Cross-Repository Contract

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

```ts
interface AgentOperationRequest {
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
```

---

### Task 1: Freeze Control Plane contracts, normalization, and request hashes

**Files:**
- Create: `server/central-user-manager/contracts.ts`
- Create: `server/central-user-manager/request-hash.ts`
- Create: `server/central-user-manager/safe-errors.ts`
- Test: `tests/central-user-manager-contracts.test.ts`

**Interfaces:**
- Produces strict Browser DTOs, Agent DTOs, stable normalization, and `hashCentralOperationBinding(binding)`.

- [ ] Write failing tests for Tenant/operation UUIDs, supported actions, page bounds, normalized email, no extra keys, and operation ID reuse with changed binding.
- [ ] Run the focused test; expected failure is missing modules.
- [ ] Implement bounded strict parsers and canonical SHA-256 request binding over Tenant ID, actor UID, action, and normalized payload.
- [ ] Ensure safe errors contain no destination, token, ciphertext, IV, KEK, temporary password, or raw Agent body.
- [ ] Rerun focused tests; expected result is all pass.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 2: Add encrypted registry schema and transactional operation tables

**Files:**
- Create with Supabase CLI: `supabase/migrations/<timestamp>_central_user_manager_bearer.sql`
- Test: `tests/central-user-manager-migration.test.ts`

**Interfaces:**
- Produces `customer_projects`, `user_management_operations`, and append-only `central_user_audit_events` contracts.

- [ ] Write failing SQL-source tests for encrypted token fields, nonsecret public projection, operation binding, append-only audit, RLS, exact grants, and no plaintext token column.
- [ ] Create registry fields equivalent to:

```text
bearer_token_ciphertext
bearer_token_iv
bearer_token_version
bearer_token_kek_version
bearer_token_fingerprint
bearer_token_updated_at
```

- [ ] Add constraints for positive token/KEK versions, bounded ciphertext/IV/fingerprint, active-state prerequisites, exact HTTPS origin, unique project ref, and one active record per Tenant UUID.
- [ ] Add transactional RPCs for first claim, exact retry, conflicting UUID reuse, dispatch ownership, completion, ambiguity, reconciliation state, activation, deactivation, and rotation version update.
- [ ] Revoke Browser roles from encrypted columns and operation/audit tables; server repositories use service-role explicit projections.
- [ ] Run the focused migration test and apply only to a disposable local database.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 3: Implement exact UID/role authorization

**Files:**
- Create: `server/auth/central-user-manager-admin.ts`
- Test: `tests/central-user-manager-auth.test.ts`

**Interfaces:**
- Produces `requireCentralUserManagerAdmin(): Promise<{ actorUid: string }>` for pages and every API route.

- [ ] Write failing tests for no session, legacy email-only match, zero/multiple rows, role other than 1, exact one UID row with role 1, and database error.
- [ ] Run the focused test; expected failure is missing guard.
- [ ] Implement `auth.getUser()` with the SSR session, then exact UID + `role_id=1` lookup through the existing server-only service client.
- [ ] Do not use generic email fallback, username, `mid`, localized role labels, or existing broad RLS.
- [ ] Rerun focused tests; expected result is all pass.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 4: Add KEK configuration and AES-GCM token vault

**Files:**
- Create: `server/central-user-manager/config.ts`
- Create: `server/central-user-manager/token-vault.ts`
- Test: `tests/central-user-manager-token-vault.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces `encryptTenantToken(input)`, `decryptTenantToken(record)`, `fingerprintTenantToken(token)`, and KEK version selection.

- [ ] Write failing tests for missing/invalid KEK, valid token, fresh random 96-bit IV, round trip, Tenant swap, token-version swap, KEK-version swap, tampered ciphertext/tag, fingerprint stability, and no plaintext serialization.
- [ ] Use exact AAD:

```text
CUM-BEARER-TOKEN-V1
<tenant UUID>
<token version>
<KEK version>
```

- [ ] Run `npm.cmd test -- tests/central-user-manager-token-vault.test.ts`; expected failure is missing vault.
- [ ] Implement AES-256-GCM with Web Crypto and inject random source/keyring for deterministic tests.
- [ ] Keep plaintext lifetime within local request/provisioning scope; never cache decrypted tokens.
- [ ] Rerun focused tests; expected result is all pass.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 5: Validate Agent origins and implement repositories

**Files:**
- Create: `server/central-user-manager/agent-origin.ts`
- Create: `server/repositories/customer-projects.ts`
- Create: `server/repositories/user-management-operations.ts`
- Create: `server/repositories/central-user-audit-events.ts`
- Test: `tests/central-user-manager-agent-origin.test.ts`
- Test: `tests/central-user-manager-repositories.test.ts`

**Interfaces:**
- Produces exact verified registry records, safe projections, operation claim/finalization, and append-only audit.

- [ ] Write failing origin tests for HTTPS/443 success and rejection of HTTP, credentials, path/query/fragment, non-443 port, redirects, localhost, IP literals, private/link-local/confusable hosts.
- [ ] Write failing fake-query/RPC tests for active lookup, inactive/missing Tenant, safe list projection, encrypted-field isolation, exact retry, conflicting reuse, ambiguity, reconciliation, and audit insertion.
- [ ] Implement URL normalization with `new URL()` and explicit protocol/host/port rules.
- [ ] Implement explicit server-only select lists; Browser projections exclude origin, project ref, token fields, and secrets.
- [ ] Sanitize and cap stored audit/error values; never audit raw payload or temporary password.
- [ ] Run both focused tests.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 6: Build the Bearer Agent HTTP client

**Files:**
- Create: `server/central-user-manager/agent-client.ts`
- Test: `tests/central-user-manager-agent-client.test.ts`

**Interfaces:**
- Consumes verified registry record and `decryptTenantToken`.
- Produces `getAgentHealth(...)` and `sendAgentOperation(...)` with definite-versus-ambiguous result typing.

- [ ] Write failing injected-fetch tests for exact URL, Bearer header, `X-CUM-Version`, health/list/mutation, timeout, redirect, non-JSON, oversized response, wrong protocol/Tenant/version, safe 4xx/5xx, and network ambiguity.
- [ ] Run the focused test; expected failure is missing client.
- [ ] Build URLs only from verified origin plus constant paths, with `redirect: "error"`, `cache: "no-store"`, 10-second default timeout, and bounded response reads.
- [ ] Decrypt one token immediately before fetch and attach:

```ts
headers.set("Authorization", `Bearer ${token}`);
headers.set("X-CUM-Version", "1");
```

- [ ] Never log fetch options, headers, body, raw Agent response, or `temporaryPassword`.
- [ ] Treat transport timeout/network failure after dispatch as ambiguous; never automatically resend a mutation.
- [ ] Rerun focused tests; expected result is all pass.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 7: Orchestrate idempotent operations and one-time secrets

**Files:**
- Create: `server/services/central-user-manager.ts`
- Test: `tests/central-user-manager-service.test.ts`

**Interfaces:**
- Produces authorized list/mutation/reconciliation orchestration for API routes.

- [ ] Write failing tests for inactive Tenant, first dispatch, double-click, changed binding, completed retry, Agent in-progress/quarantine, timeout ambiguity, central finalization failure, and first-response password handling.
- [ ] Run the focused test; expected failure is missing service.
- [ ] Implement claim → winning dispatch → safe persistence/audit → response flow.
- [ ] Hold Agent `temporaryPassword` in a local variable only; persist and audit the safe result first, then build the first HTTP response.
- [ ] If finalization/audit fails after Agent success, discard the password and mark `needs_review`; reconciliation never recreates the mutation.
- [ ] Rerun focused tests; expected result is all pass.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 8: Add authenticated no-store Control Plane routes

**Files:**
- Create: `server/central-user-manager/api-response.ts`
- Create: `app/api/admin/user-manager/health/route.ts`
- Create: `app/api/admin/user-manager/operations/route.ts`
- Create: `app/api/admin/user-manager/operations/[operationId]/reconcile/route.ts`
- Test: `tests/central-user-manager-api-routes.test.ts`

**Interfaces:**
- Consumes exact admin guard and orchestration service.
- Produces Browser-safe Central User Manager HTTP API.

- [ ] Read the current `webook` Next.js Route Handler/caching docs.
- [ ] Write failing tests for unauthenticated, role denied, malformed/oversized JSON, operation mismatch, inactive Tenant, success, one-time password, exact retry, timeout, and reconciliation.
- [ ] Implement exact JSON content type, no-extra-key validation, request caps, and the approved no-store/security headers.
- [ ] Authenticate every route independently; never rely only on layout/menu hiding.
- [ ] Confirm responses never contain Agent origin, project ref, token fields, ciphertext, IV, KEK version, or raw provider errors.
- [ ] Run the focused route test.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 9: Build the master-detail-status UI and lifecycle dialogs

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
- Create: `components/admin/user-manager/create-user-dialog.tsx`
- Create: `components/admin/user-manager/user-action-dialog.tsx`
- Create: `components/admin/user-manager/temporary-password-dialog.tsx`
- Create: `components/admin/user-manager/operation-status-card.tsx`
- Test: `tests/central-user-manager-page.test.ts`
- Test: `tests/central-user-manager-view-model.test.ts`
- Test: `tests/central-user-manager-actions.test.ts`
- Test: `tests/temporary-password-dialog.test.ts`

**Interfaces:**
- Consumes only safe project/user/operation DTOs.
- Produces project selection, user lifecycle actions, health/status, and one-time password presentation.

- [ ] Write failing tests for no projects, selection, UUID reuse on double-click/retry, pagination, long text, four statuses, empty/loading/error, quarantine, and reconciliation.
- [ ] Write failing action tests for email-only create, reissue, suspend, reactivate/new password, disabled double-click, clipboard failure, acknowledgement, and password-state clearing on dialog close.
- [ ] Implement compact desktop left/center/right master-detail-status layout and narrow stacked layout using existing components.
- [ ] Keep temporary password only in React memory; never URL, storage, toast, analytics, error reporting, or DOM after close.
- [ ] Add accessible names, keyboard/focus behavior, Thai admin copy, truncation/wrapping, and safe error states.
- [ ] Run focused UI tests and inspect desktop/mobile rendering.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 10: Add capability-gated navigation

**Files:**
- Modify: `app/admin/layout.tsx`
- Modify: `components/layout/admin-shell.tsx`
- Modify: `components/layout/admin-desktop-sidebar.tsx`
- Modify: `tests/layout-sidebar-ui.test.ts`
- Test: `tests/central-user-manager-navigation.test.ts`

**Interfaces:**
- Consumes `requireCentralUserManagerAdmin` capability result.
- Produces Thai navigation item `จัดการผู้ใช้ลูกค้า` without weakening page/API guards.

- [ ] Write failing desktop/mobile/collapsed tests for exact UID role 1 visibility and all denial cases.
- [ ] Derive `canManageCentralUsers` server-side and pass only the boolean to navigation.
- [ ] Add `/admin/user-manager` menu entry; do not alter unrelated permissions.
- [ ] Run navigation tests and inspect all sidebar variants.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 11: Build safe onboarding and immediate-rotation CLI

**Files:**
- Create: `scripts/central-user-manager/provision-tenant.mjs`
- Create: `scripts/central-user-manager/provisioning/config.mjs`
- Create: `scripts/central-user-manager/provisioning/token-input.mjs`
- Create: `scripts/central-user-manager/provisioning/supabase-auth.mjs`
- Create: `scripts/central-user-manager/provisioning/attestation.mjs`
- Create: `scripts/central-user-manager/provisioning/registry.mjs`
- Create: `scripts/central-user-manager/provisioning/target-deploy.mjs`
- Test: `tests/central-user-manager-provisioning.test.ts`
- Modify: `package.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes operator management credentials, hidden/stdin Tenant token, target repo/environment, and central repositories.
- Produces inactive registration, target-only secret install/deploy, verified activation, and immediate rotation.

- [ ] Verify current official Supabase Management API and Cloudflare/Wrangler command behavior before implementation.
- [ ] Write failing fake-fetch/process tests for dry run, hidden input, rejection of token CLI argument, exact token validation, target-only deploy, encrypted registration, health/list checks, inactive-on-failure, and no secret output.
- [ ] Default to dry run; require explicit `--apply`, Tenant UUID, display name, target project ref, exact origin, Wrangler environment, and absolute target repo.
- [ ] Initial onboarding order: register inactive → install target secret → encrypt/store central token → deploy target only → health → list → activate.
- [ ] Rotation order: deactivate → stop/quarantine in-flight operations → install/deploy target token → encrypt/store incremented central version → health/list → reactivate.
- [ ] Never rebuild/deploy `webook`; never pass token on the command line; never print a recovery command containing the token.
- [ ] Run focused provisioning tests.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 12: Add KEK rotation and operator documentation

**Files:**
- Create: `scripts/central-user-manager/rotate-kek.mjs`
- Test: `tests/central-user-manager-kek-rotation.test.ts`
- Create: `docs/central-user-manager.md`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/api.md`

**Interfaces:**
- Produces resumable old-KEK-to-new-KEK re-encryption without changing Tenant plaintext tokens.

- [ ] Write failing tests for dry run, mixed versions, fresh IV per row, Tenant-bound verification, resumable rerun, partial failure, and old-key removal gate.
- [ ] Implement bounded batch re-encryption using both server-only keys; verify every row before marking its new KEK version.
- [ ] Document onboarding, immediate rotation downtime, KEK rotation, deactivation, lost password response, quarantine, one-sided repair, audit privacy, and incident queries.
- [ ] State the accepted risk: Bearer possession grants Agent capability and Bearer-only is not equivalent to Access plus Ed25519.
- [ ] Run the KEK rotation test.
- [ ] Review the diff; do not commit without explicit user instruction.

### Task 13: Complete Control Plane verification and staged rollout

**Files:**
- Modify only files proven deficient during verification.

**Interfaces:**
- Produces production-readiness evidence across `webook` and two Tenant Agents.

- [ ] Search for leakage:

```powershell
rg -n "temporaryPassword|Authorization|bearer_token_|TOKEN_KEK|agentOrigin|console\\.(log|error)|localStorage|sessionStorage" app components server scripts tests
```

- [ ] Review every match for persistence, logging, Browser serialization, URL, and analytics exposure.
- [ ] Run focused Central User Manager tests, then the repository’s typecheck, lint, full test, and build commands.
- [ ] Inspect `/admin/user-manager` desktop/mobile for all project, user, operation, error, and one-time-password states.
- [ ] Inspect network/RSC/server logs for no secret, no destination registry data, no cached operation response, and no redirect following.
- [ ] Run security matrix: unauthenticated, wrong role, Browser-crafted destination, token A/B isolation, UUID conflict, double-click, timeout, finalization failure, rotation failure, and KEK mismatch.
- [ ] Complete staging lifecycle on two different Tenant tokens and prove adding Tenant 2 did not change the `webook` deployment version.
- [ ] Review `git diff --check`, `git status --short`, and full diff.
- [ ] Stop at commit-ready state and report exact evidence; do not commit without explicit user instruction.

## Control Plane Acceptance Gate

- Exact Auth UID plus exactly one role-1 row protects page and every API.
- Registry ciphertext is Tenant/token/KEK-version bound and never Browser-readable.
- Decrypted token exists only in bounded server memory immediately around an Agent fetch.
- Browser cannot select an Agent destination or read a credential.
- Immediate rotation keeps the Tenant inactive until the new pairing passes health and list.
- Ambiguous mutations never auto-replay and one-time passwords never persist.
- Adding a Tenant deploys only that Tenant and does not deploy `webook`.
- Focused tests, full repository checks, responsive/network inspection, security matrix, and two-Tenant staging lifecycle all pass.
