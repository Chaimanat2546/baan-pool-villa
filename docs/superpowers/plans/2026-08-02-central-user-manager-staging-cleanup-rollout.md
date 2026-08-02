# Central User Manager Staging Cleanup and Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the now-unused Tenant health-probe database surface from Staging and perform a no-fallback RPC cutover under the verified `chaymanus2003` Cloudflare account.

**Architecture:** Cleanup is an additive idempotent migration applied only after RPC code proves there are no health callers. Deployment scripts pin Staging to one immutable Cloudflare account ID and fail before upload for every other account. Remote database apply, secret removal, upload, and activation are separate destructive/external approvals after local implementation passes.

**Tech Stack:** Supabase/Postgres migrations and advisors, Cloudflare Wrangler/OpenNext, PowerShell, Vitest.

## Global Constraints

- Work in `C:\Users\chaym\Projects\baan-pool-villa`.
- Production Supabase project `zkxpozvhvmgqfrwnlfrn` is comparison-only and must never receive a write, migration, restore, test mutation, or cleanup statement.
- Tenant Staging project `lsbbbbibhtbwrvrqggwq` is the only Tenant database cleanup target.
- Staging Cloudflare account ID is exactly `0df55f166fa309dcc904e992c43f86db`; every other account, including `poolvilla`, is denied.
- Never edit existing migrations or delete migration history.
- Retain operation, mutation-lock, mutation-fence, provider-event, credential-version, and forced-password-change data structures.
- Do not apply remote SQL, delete secrets, upload, deploy, activate, or commit without a separate explicit approval naming the exact operation.
- Resolve exact absolute targets before any destructive step and preserve recoverable backup/restore evidence.

---

### Task 1: Add a live-schema cleanup audit

**Files:**
- Create: `scripts/central-user-manager/audit-health-cleanup.sql`
- Create: `scripts/central-user-manager/audit-health-cleanup.mjs`
- Create: `tests/central-user-manager-health-cleanup-audit.test.ts`

**Interfaces:**
- Consumes: a server-only Staging database connection supplied through bounded stdin/environment, never a CLI argument.
- Produces: a redacted JSON report containing project ref, exact candidate functions, dependencies, grants, and retained table/column presence.

- [ ] **Step 1: Write failing pure-parser and redaction tests**

Assert exact project ref `lsbbbbibhtbwrvrqggwq`, rejection of Production ref, rejection of unknown ref, four exact health function identities, zero unexpected dependents, retained operation tables/columns, and absence of connection strings/passwords in output.

- [ ] **Step 2: Implement the read-only catalog query**

Query `pg_proc`, `pg_namespace`, `pg_depend`, `pg_roles`, `information_schema.routine_privileges`, `information_schema.tables`, and `information_schema.columns`. The candidate allowlist is exactly:

```text
public.central_user_manager_health_probe_v1()
private.central_user_manager_health_probe_v1_impl()
private.central_user_manager_suspension_checkpoint_health_v1()
private.central_user_manager_forced_password_health_v1()
```

The retained allowlist includes all four `admin_user_*` operation tables plus `public.admin_users.must_change_password` and `credential_version`.

- [ ] **Step 3: Implement fail-closed report validation**

The script exits nonzero for a wrong/missing project ref, missing candidate identity, unexpected dependent, missing retained object, or any non-read-only statement in the SQL file. It prints only object names, counts, grantees, and safe status.

- [ ] **Step 4: Run tests locally**

Run: `npm.cmd test -- tests/central-user-manager-health-cleanup-audit.test.ts`

Expected: PASS without connecting to an online project.

- [ ] **Step 5: Review without committing**

Confirm the audit cannot execute DDL/DML and cannot accept Production as target.

### Task 2: Create the additive health-probe cleanup migration

**Files:**
- Create via `npm.cmd exec supabase -- migration new remove_central_user_manager_health_probe`: one generated `supabase/migrations/*_remove_central_user_manager_health_probe.sql`
- Create: `lib/central-user-manager/__tests__/health-cleanup-migration-contract.test.ts`
- Modify: `docs/ai/structure.html`

**Interfaces:**
- Consumes: Task 1's zero-unexpected-dependency proof and the completed Tenant RPC cutover.
- Produces: an idempotent migration dropping only four zero-argument health functions.

- [ ] **Step 1: Generate the migration with the installed Supabase CLI**

Run: `npm.cmd exec supabase -- migration new remove_central_user_manager_health_probe`

Expected: one new migration; do not apply it remotely.

- [ ] **Step 2: Write failing migration contract tests**

Assert drop order is public wrapper first, then private helpers; every statement uses exact signature and `if exists`; no `cascade`; no table/column/policy/trigger/data statement; and retained state-machine identities are absent from destructive SQL.

- [ ] **Step 3: Implement minimal SQL**

```sql
drop function if exists public.central_user_manager_health_probe_v1();
drop function if exists private.central_user_manager_forced_password_health_v1();
drop function if exists private.central_user_manager_suspension_checkpoint_health_v1();
drop function if exists private.central_user_manager_health_probe_v1_impl();
notify pgrst, 'reload schema';
```

Do not use `cascade` and do not drop any table or column.

- [ ] **Step 4: Run migration contracts and local disposable database verification**

Run: `npm.cmd test -- lib/central-user-manager/__tests__/health-cleanup-migration-contract.test.ts lib/central-user-manager/__tests__/migration-contract.test.ts lib/central-user-manager/__tests__/credential-fence-migration.test.ts`

Apply the composed migrations only to disposable local Supabase, run the cleanup migration twice to prove idempotency, then run `npm.cmd exec supabase -- db advisors --local`. The installed CLI meets the required version floor.

Expected: PASS; four health functions absent; retained tables/functions/policies present; no advisor regression.

- [ ] **Step 5: Update structure ownership**

Document the new cleanup migration, retained database owners, exact staging-only audit/apply gate, and focused tests.

- [ ] **Step 6: Review without committing or applying remotely**

Run `git diff --check` and inspect the exact migration. Confirm Production ref does not appear in an executable write path.

### Task 3: Pin Tenant Staging deployment to chaymanus2003

**Files:**
- Create: `scripts/assert-staging-deploy-target.mjs`
- Create: `scripts/staging-deploy-target.test.ts`
- Modify: `package.json`
- Modify: `wrangler.jsonc`
- Modify: `docs/central-user-manager/tenant-provisioning.md`

**Interfaces:**
- Consumes: Wrangler environment `staging` and optional `CLOUDFLARE_ACCOUNT_ID`.
- Produces: guarded Staging dry-run/upload/deploy scripts pinned to account `0df55f166fa309dcc904e992c43f86db` and Worker `baan-pool-villa-staging`.

- [ ] **Step 1: Write failing deployment-target tests**

Assert exact account ID, `staging` environment, Worker name, exact site URL suffix `.chaymanus2003.workers.dev`, Staging service/self bindings, and rejection of missing/wrong environment or any nonmatching account ID.

- [ ] **Step 2: Implement the preflight**

Parse `wrangler.jsonc` after removing comments with the repository's existing JSONC approach. Require the Staging name and URL already present, and require the exact account ID from a Staging-specific non-secret configuration owner. Reject a nonblank `CLOUDFLARE_ACCOUNT_ID` override unless it equals the allowlisted ID.

```js
export const STAGING_CLOUDFLARE_ACCOUNT_ID = "0df55f166fa309dcc904e992c43f86db";
export const STAGING_WORKER_NAME = "baan-pool-villa-staging";
```

Do not change production environment destinations.

- [ ] **Step 3: Add guarded scripts**

Add scripts for Staging dry-run, upload, and deploy that call the assertion first and pass `--env staging`. Keep deploy separate from upload so the operator can inspect the uploaded version before activation.

- [ ] **Step 4: Run tests and a Wrangler dry run**

Run: `npm.cmd test -- scripts/staging-deploy-target.test.ts scripts/production-deploy-config.test.ts`

Run the guarded Wrangler/OpenNext dry-run path only. Expected: it resolves `baan-pool-villa-staging` and the exact account ID, produces local output, and makes no upload.

- [ ] **Step 5: Update the Thai runbook**

Document exact account ID, `chaymanus2003`, prohibition on `poolvilla`, target-first RPC deployment, legacy `404`, separate secret deletion approval, and no public fallback.

- [ ] **Step 6: Review without committing or deploying**

Confirm no production environment or account selection changed.

### Task 4: Prepare the no-overlap remote cutover packet

**Files:**
- Create: `docs/central-user-manager/staging-rpc-cutover.md`
- Modify no runtime code.

**Interfaces:**
- Consumes: locally verified Tenant and `webook` implementation plans plus Tasks 1–3.
- Produces: a command-by-command approval packet; it does not execute it.

- [ ] **Step 1: Record immutable targets and stop conditions**

Record:

```text
Tenant Supabase Staging: lsbbbbibhtbwrvrqggwq
Production comparison only: zkxpozvhvmgqfrwnlfrn
Cloudflare account: 0df55f166fa309dcc904e992c43f86db
Tenant Worker: baan-pool-villa-staging
Tenant RPC entrypoint: CentralUserManagerEntrypoint
webook Worker: webook-staging
```

State that a dedicated `webook` Staging Supabase project ref is still required before any `webook` remote migration/deploy; never reuse an unverified production-like project.

- [ ] **Step 2: Write the exact ordered cutover checklist**

Order: verify backups/restore point → prove exact accounts/projects → mark Tenant inactive → resolve/quarantine in-flight operations → deploy Tenant RPC with legacy `404` → upload/deploy `webook-staging` binding → run binding-only `list_users` → run four approved disposable-user actions → activate Tenant → verify retired Bearer still gets `404` → delete Bearer/attestation secrets → run read-only cleanup audit → separately approve/apply cleanup migration → rerun advisors and all five actions.

- [ ] **Step 3: Add rollback rules**

Rollback keeps Tenant inactive and uses only a mutually compatible RPC revision. It never restores public Bearer routes, clones Production, uses `cascade`, or writes to `zkxpozvhvmgqfrwnlfrn`.

- [ ] **Step 4: Add evidence checklist**

Require deployment version IDs, safe HTTP/RPC statuses, Tenant/project IDs, schema object counts, advisor results, and redacted audit operation IDs. Forbid Authorization headers, Bearers, database URLs/passwords, Supabase keys, temporary passwords, and raw provider errors.

- [ ] **Step 5: Review without executing**

Run `git diff --check`; verify every mutation step says it requires separate explicit approval and exact target resolution.

### Task 5: Complete local cleanup/rollout verification

**Files:**
- Modify only files proven deficient by verification.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: a reviewed cleanup migration and deployment packet with zero remote mutation.

- [ ] **Step 1: Run focused tests**

Run: `npm.cmd test -- tests/central-user-manager-health-cleanup-audit.test.ts lib/central-user-manager/__tests__/health-cleanup-migration-contract.test.ts scripts/staging-deploy-target.test.ts`

Expected: PASS.

- [ ] **Step 2: Run retained database safety tests**

Run: `npm.cmd test -- lib/central-user-manager/__tests__/migration-contract.test.ts lib/central-user-manager/__tests__/credential-fence-migration.test.ts lib/central-user-manager/__tests__/operation-repository.test.ts lib/central-user-manager/__tests__/profile-repository.test.ts lib/central-user-manager/__tests__/reconciled-list-repository.test.ts`

Expected: PASS.

- [ ] **Step 3: Run lint, full tests, and build**

Run: `npm.cmd run lint`

Run: `npm.cmd test`

Run: `npm.cmd run build`

Expected: PASS.

- [ ] **Step 4: Inspect final diff and remote state**

Run: `git diff --check`, `git status --short`, and the full diff. Confirm no online migration history, database object, secret, Worker version, route, or account state changed during plan execution.

## Cleanup and Rollout Plan Acceptance Gate

- Cleanup drops only four exact health functions with no `cascade`.
- All operation-safety tables, columns, functions, grants, and tests remain.
- Audit/apply tooling refuses Production and every project except `lsbbbbibhtbwrvrqggwq`.
- Tenant Staging tooling allows only account `0df55f166fa309dcc904e992c43f86db`.
- `poolvilla` and every other account fail before upload.
- The remote cutover packet has a no-overlap order and no-Bearer rollback.
- A dedicated `webook` Staging Supabase project ref is an explicit prerequisite, not guessed.
- No remote mutation occurs without a later exact approval.
