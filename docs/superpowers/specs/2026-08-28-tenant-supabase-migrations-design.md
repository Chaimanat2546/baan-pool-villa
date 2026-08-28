# Tenant Supabase Migration Gate Design

**Date:** 2026-08-28  
**Status:** Approved design, pending implementation plan

## Goal

When a push to `master` changes files below `supabase/migrations/`, apply the
same migration history to every production Tenant database before deploying any
Worker. The five targets are `baanparty`, `baan02`, `baanPMhee`, `flukNasa`,
and `villaMedia`.

No Worker deployment may start when a required database migration fails. A
push that does not change a source migration keeps the current deployment flow.

## Assumptions and Scope

- All five Tenant databases use the same complete migration history in
  `supabase/migrations/`; a source migration is intended for every one.
- The source migration directory is the only automatic trigger. Seed files,
  bootstrap SQL, and manually maintained patch SQL are excluded.
- This change does not apply migrations to `staging`, create new databases, or
  perform automated rollback.
- GitHub Environments named after the five deployment targets already isolate
  per-Tenant deployment configuration.

## Selected Architecture

Extend the existing `deploy-production.yml` pipeline to have three phases:

1. `verify` continues to run lint and the full test suite. It also emits the
   existing deployment matrix and a boolean `migrations_changed` derived from
   the pushed commit range.
2. `migrate` is skipped unless `migrations_changed` is true. It expands the
   same five-target matrix, authenticates the Supabase CLI, links to the
   matrix entry's explicitly supplied project ref, and runs
   `supabase db push --linked --include-all`.
3. `deploy` waits for `verify` and `migrate`. It runs only when `migrate`
   succeeded, or when it was intentionally skipped because no migration file
   changed. It retains the current per-target build and Cloudflare deployment
   process.

`migrate` uses `fail-fast: false` so every Tenant gets an observable result.
If one fails, the job as a whole fails and the deploy matrix does not begin.
Migrations run with a bounded parallelism (initially two concurrent jobs) so
independent Tenant databases finish promptly without a burst of five database
connections.

## Configuration Ownership

`wrangler.jsonc` remains the canonical record of a deployment target's
`CENTRAL_USER_MANAGER_PROJECT_REF`. The deployment configuration helper will
read, validate, and add that value to each generated matrix entry. It must
reject a missing or invalid project ref, and the migration workflow must never
accept a project ref supplied by workflow input or a pull request.

The new Supabase credentials are GitHub secrets only:

| Owner | Secret | Purpose |
| --- | --- | --- |
| Repository or organization | `SUPABASE_ACCESS_TOKEN` | Authenticates the Supabase CLI to the authorized account. |
| Each target GitHub Environment | `SUPABASE_DB_PASSWORD` | Lets the CLI connect to that target database; its value is unique per Tenant. |

The workflow exposes neither value in commands, diagnostics, summaries, or
artifacts. The existing `SUPABASE_PUBLISHABLE_KEY` is not a database migration
credential and is not used by this job.

## Workflow and Failure Contract

The changed-file check is evaluated only for a trusted push to `master`; pull
request runs continue to validate and dry-run Cloudflare deploys without a
database write. The implementation must handle a first push where the normal
before SHA is unavailable by comparing the pushed commit's parent, and fail
closed if a reliable changed-file range cannot be determined.

For each migration matrix entry the job:

1. Checks out the exact pushed commit.
2. Installs the pinned official Supabase CLI action.
3. Uses only the matrix project ref resolved from tracked configuration.
4. Links the CLI to that ref and pushes pending source migrations.
5. Writes a secret-free summary with the target, project ref, commit, and
   result.

Supabase migration history makes already-applied migrations idempotently skip;
`--include-all` accounts for repositories whose remote history is missing
older source entries. A link or push error marks that Tenant failed. The other
Tenant matrix entries continue, but no deployment is released until all five
succeed. Recovery is an operator correction followed by GitHub **Re-run failed
jobs** for the same commit; database rollback is deliberately not automated.

## Files and Tests

- `.github/workflows/deploy-production.yml`: add changed-migration detection,
  the migration matrix job, and the deploy dependency/skip condition.
- `scripts/production-deploy-config.mjs`: validate project refs and emit them
  with the deployment matrix without duplicating tenant metadata.
- Existing tests for the deployment configuration helper: assert the five
  known project refs, rejection of missing/invalid refs, and matrix shape.
- `README.md`, `docs/deployment.md`, and `docs/ai/structure.html`: document
  the migration gate, required secret names and GitHub Environment setup,
  allowed trigger path, and recovery procedure. No secret values are recorded.

Verification will include the focused helper tests, workflow YAML parsing or
structural assertions where the repository convention supports it, `npm run
lint`, and the production build checks prescribed by the project guide. Before
merging, configure `SUPABASE_ACCESS_TOKEN` and all five environment-scoped
`SUPABASE_DB_PASSWORD` secrets; otherwise the first merge that changes a
migration will block deployments by design.

## Out of Scope

- Applying `supabase/seed.sql`, standalone bootstrap SQL, or ad-hoc patch SQL.
- Running migration writes from pull requests, forks, local preview, or
  staging.
- Deriving database passwords from repository configuration or Cloudflare.
- Automatically retrying a failed migration or rolling back any Tenant.
- Continuing deployment when only some Tenant migrations succeed.
