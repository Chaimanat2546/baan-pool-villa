# Reactivation Operation Conflict Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. This repository requires the main agent to make all edits.

**Goal:** Allow a suspended managed user to complete reactivation after a successful Auth update, and safely release operations already stranded before password verification.

**Architecture:** Keep the existing multi-step provider journal. Change only the SQL transition guard so the first provider intent starts from `leased`, while `password_verify` and `global_signout` start from the preceding successful `provider_outcome`. Recover only expired reactivation operations whose profile, Auth metadata, provider event, lock, and fence prove the known partial state; preserve the old operation as a non-success audit record and release only its exact lock so a fresh reactivation can issue a new one-time password.

**Tech Stack:** PostgreSQL/Supabase migrations, Vitest, Supabase CLI, Cloudflare/OpenNext.

## Global Constraints

- Do not persist or log temporary passwords, Bearer tokens, service-role keys, or user identifiers.
- Do not edit existing migrations.
- Preserve advisory locks, fence versions, provider journals, and fail-closed profile activation.
- Do not mark a partially completed reactivation as successful.
- Apply recovery only when every expected partial-state predicate matches.

---

### Task 1: Regression Contract

**Files:**
- Create: `tests/central-user-manager-reactivation-recovery.test.ts`

**Interfaces:**
- Consumes: the new migration SQL.
- Produces: executable assertions for provider-state chaining, exact recovery predicates, audit preservation, grants, and PostgREST reload.

- [ ] Write a test that requires first provider intents to accept only `leased`.
- [ ] Write a test that requires `password_verify` and `global_signout` intents to accept only `provider_outcome`.
- [ ] Write tests that require recovery to match expired `reactivate_user/provider_outcome/auth_update_succeeded` rows, aligned profile/Auth credential versions, successful Auth update events, and non-quarantined fences.
- [ ] Write tests that forbid broad operation or lock deletion and require the old operation to remain non-successful.
- [ ] Run only this test and confirm it fails because the migration is absent.

### Task 2: State-Machine and Recovery Migration

**Files:**
- Create via Supabase CLI: `supabase/migrations/<timestamp>_repair_reactivation_provider_chain.sql`

**Interfaces:**
- Produces: replacement `private.commit_admin_user_provider_intent_v2_impl` and one-time idempotent recovery for exact stranded rows.

- [ ] Create the migration with `supabase migration new repair_reactivation_provider_chain`.
- [ ] Replace the private intent function so step 1 requires `leased`, while steps 2 and 3 require `provider_outcome`; retain stage, lease, lock, fence, expiry, and unique provider-event checks.
- [ ] Under per-email advisory and row locks, identify only expired stranded reactivations with aligned Auth/profile versions and a successful `auth_update` provider event.
- [ ] Mark the old operation `needs_review` with a stable safe code, clear its lease, preserve its provider event, and release only the exact expired mutation lock without quarantining its fence.
- [ ] Keep the private function unavailable to API roles and reload PostgREST.
- [ ] Run the focused test and confirm it passes.

### Task 3: Verification and Staging

**Files:**
- Modify only generated build output ignored by Git during deployment.

**Interfaces:**
- Consumes: migration and existing staging configuration.
- Produces: applied schema, recovered staging rows, and a deployed Worker.

- [ ] Run the affected operation-service, repository, route, migration, and provisioning tests.
- [ ] Run focused ESLint and the production build.
- [ ] Request read-only reviewer analysis and resolve evidence-backed findings.
- [ ] Apply the migration to target staging with `supabase db push`.
- [ ] In a rolled-back staging transaction, prove `auth_update outcome → password_verify intent → password_verify outcome → global_signout intent`.
- [ ] Verify the two known stranded operations are non-successful, their exact locks are released, profiles remain inactive, versions remain aligned, and fences are not quarantined.
- [ ] Deploy `baan-pool-villa-staging` and verify the login endpoint plus unauthenticated internal API boundary.
