# Tenant Supabase Migration Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply every changed source migration to all five production Tenant databases before any `master` deployment begins.

**Architecture:** The tracked Wrangler configuration remains the only owner of target-to-project-ref mapping. The verification job determines whether a trusted push changed `supabase/migrations/**`; a five-entry Supabase CLI matrix then gates the existing five-entry Cloudflare deployment matrix.

**Tech Stack:** GitHub Actions, Supabase CLI 2.x through `supabase/setup-cli`, Node.js 24, Vitest, TypeScript JSONC parsing, Wrangler 4.

**Spec:** `docs/superpowers/specs/2026-08-28-tenant-supabase-migrations-design.md`

## Global Constraints

- Automatic database writes occur only on a push to `master` that changes `supabase/migrations/**`.
- The exact approved targets are `baanparty`, `baan02`, `baanPMhee`, `flukNasa`, and `villaMedia`.
- Every target has the same source migration history; no per-Tenant migration filter exists.
- `wrangler.jsonc` owns `CENTRAL_USER_MANAGER_PROJECT_REF`; never duplicate a project ref in workflow YAML or GitHub variables.
- Repository/organization secret: `SUPABASE_ACCESS_TOKEN`; environment-scoped secret: `SUPABASE_DB_PASSWORD`.
- Do not expose database URLs, passwords, access tokens, or secrets in commands, test fixtures, summaries, artifacts, or documentation.
- A failed migration blocks all deployments; a migration job skipped because no migration changed does not block deployment.
- Pull requests must never write a database and keep their existing Cloudflare dry-run behavior.
- Do not run `supabase/seed.sql`, bootstrap SQL, or patch SQL automatically.
- Preserve unrelated working-tree changes. Do not commit, push, or alter GitHub secrets/environments without explicit user approval.

---

## File Structure

- Modify `scripts/production-deploy-config.mjs`: validate each target project ref and generate one target/site URL/project ref matrix from Wrangler config.
- Modify `scripts/production-deploy-config.test.ts`: cover the five-entry matrix and invalid/missing project-ref rejection.
- Modify `.github/workflows/deploy-production.yml`: detect source-migration changes, run the gated migration matrix, and make deploy wait for it.
- Modify `scripts/production-deploy-workflow.test.ts`: statically assert the trusted-write gate, CLI commands, secret scope, and deploy dependency.
- Modify `README.md`, `docs/deployment.md`, and `docs/ai/structure.html`: document the operational setup and recovery path without secret values.

### Task 1: Make the deployment matrix include validated project refs

**Files:**

- Modify: `scripts/production-deploy-config.mjs`
- Modify: `scripts/production-deploy-config.test.ts`

**Interfaces:**

- Produces `getDeploymentMatrix(config, targets = PRODUCTION_DEPLOYMENT_TARGETS): { include: Array<{ target: string; siteUrl: string; projectRef: string }> }`.
- `validateWranglerDeploymentConfig(config)` returns `true` only when all five URL/project-ref pairs are valid.
- CLI `node scripts/production-deploy-config.mjs matrix` prints the JSON matrix containing five `projectRef` values.

- [ ] **Step 1: Add failing matrix expectations**

Update the existing exact-matrix test to read `wrangler.jsonc` first and expect this shape:

```ts
expect(getDeploymentMatrix(config)).toEqual({
  include: expect.arrayContaining([
    expect.objectContaining({ target: "baanparty", projectRef: "lpxsktjrkjzwbxvhjogo" }),
    expect.objectContaining({ target: "baan02", projectRef: "vfqxpujsvgdqtrzpxobh" }),
    expect.objectContaining({ target: "baanPMhee", projectRef: "zkxpozvhvmgqfrwnlfrn" }),
    expect.objectContaining({ target: "flukNasa", projectRef: "clrmtotmrpccddhoyxaf" }),
    expect.objectContaining({ target: "villaMedia", projectRef: "nzxlbkcccfqoqqvhfmev" }),
  ]),
});
```

Add two tests that clone the parsed config, delete `config.env.baan02.vars.CENTRAL_USER_MANAGER_PROJECT_REF`, then set it to `"not-a-project-ref"`. Expect errors respectively containing `baan02 is missing CENTRAL_USER_MANAGER_PROJECT_REF` and `baan02 has an invalid CENTRAL_USER_MANAGER_PROJECT_REF`.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```powershell
npm.cmd test -- scripts/production-deploy-config.test.ts
```

Expected: FAIL because the current matrix has no `projectRef` and validation accepts the altered config.

- [ ] **Step 3: Implement the smallest configuration contract**

In `scripts/production-deploy-config.mjs`:

1. Add `const PROJECT_REF_VARIABLE = "CENTRAL_USER_MANAGER_PROJECT_REF"`.
2. Add `normalizeProjectRef(target, value)` that accepts only `/^[a-z]{20}$/` and throws `target is missing ...` or `target has an invalid ...` without including the value.
3. During `validateWranglerDeploymentConfig`, validate every approved target's `vars[PROJECT_REF_VARIABLE]` in addition to its existing URL and required-secret checks.
4. Add `getDeploymentMatrix(config, targets = PRODUCTION_DEPLOYMENT_TARGETS)` that returns `include` entries in the existing target order, each with `target`, `siteUrl`, and the normalized `projectRef` from the matching Wrangler environment.
5. Change the `matrix` CLI path to call `getDeploymentMatrix(config)`. Remove or replace the former config-free `createDeploymentMatrix` export; update all imports in its test.

- [ ] **Step 4: Run the focused test and configuration CLI**

Run:

```powershell
npm.cmd test -- scripts/production-deploy-config.test.ts
node scripts/production-deploy-config.mjs matrix
npm.cmd run validate:deploy:cf
```

Expected: test passes; matrix contains five entries and only public target metadata/project refs; validator succeeds.

- [ ] **Step 5: Review checkpoint**

Run:

```powershell
git diff -- scripts/production-deploy-config.mjs scripts/production-deploy-config.test.ts
git diff --check
```

Do not stage or commit.

### Task 2: Add the migration gate to GitHub Actions

**Files:**

- Modify: `.github/workflows/deploy-production.yml`
- Modify: `scripts/production-deploy-workflow.test.ts`

**Interfaces:**

- `verify` output `migrations_changed` is exactly `"true"` or `"false"`.
- `migrate` runs only when `github.event_name == 'push'` and `migrations_changed == 'true'`.
- `deploy` needs `verify` and `migrate`, and may run only when the migration result is `success` or `skipped`.

- [ ] **Step 1: Write failing workflow-contract tests**

Add static tests asserting that the workflow contains all of the following:

```ts
expect(workflow).toContain("fetch-depth: 0");
expect(workflow).toContain("migrations_changed");
expect(workflow).toContain("supabase/migrations/");
expect(workflow).toContain("github.event_name == 'push'");
expect(workflow).toContain("SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}");
expect(workflow).toContain("SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}");
expect(workflow).toContain("supabase link --project-ref \"$BPV_SUPABASE_PROJECT_REF\"");
expect(workflow).toContain("supabase db push --linked --include-all");
expect(workflow).toContain("needs: [verify, migrate]");
expect(workflow).toContain("needs.migrate.result == 'success' || needs.migrate.result == 'skipped'");
```

Also assert that the migration job has `fail-fast: false`, `max-parallel: 2`, `environment.name: ${{ matrix.target }}`, and that its summary never references either secret name after the migration step's `env:` block.

- [ ] **Step 2: Run the workflow test and confirm it fails**

Run:

```powershell
npm.cmd test -- scripts/production-deploy-workflow.test.ts
```

Expected: FAIL because no migration job or changed-file output exists.

- [ ] **Step 3: Implement changed-file detection in `verify`**

Set checkout `fetch-depth: 0`. Add `migrations_changed` to verify job outputs and a bash step that:

```bash
if [ "$GITHUB_EVENT_NAME" != "push" ]; then
  printf 'migrations_changed=false\n' >> "$GITHUB_OUTPUT"
  exit 0
fi

if [ "$GITHUB_EVENT_BEFORE" = "0000000000000000000000000000000000000000" ]; then
  git rev-parse "$GITHUB_SHA^" >/dev/null
  migration_range="$GITHUB_SHA^..$GITHUB_SHA"
else
  git cat-file -e "$GITHUB_EVENT_BEFORE^{commit}"
  migration_range="$GITHUB_EVENT_BEFORE..$GITHUB_SHA"
fi

if git diff --quiet "$migration_range" -- supabase/migrations/; then
  printf 'migrations_changed=false\n' >> "$GITHUB_OUTPUT"
else
  printf 'migrations_changed=true\n' >> "$GITHUB_OUTPUT"
fi
```

Pass `GITHUB_EVENT_BEFORE: ${{ github.event.before }}` and `GITHUB_SHA: ${{ github.sha }}` through the step environment. A missing commit causes the shell step to fail, so a trusted push cannot silently deploy when the changed range is unknown.

- [ ] **Step 4: Implement the migration matrix job**

Insert `migrate` between `verify` and `deploy` with:

```yaml
  migrate:
    name: Migrate ${{ matrix.target }}
    needs: verify
    if: ${{ github.event_name == 'push' && needs.verify.outputs.migrations_changed == 'true' }}
    runs-on: ubuntu-latest
    timeout-minutes: 30
    strategy:
      fail-fast: false
      max-parallel: 2
      matrix: ${{ fromJSON(needs.verify.outputs.matrix) }}
    environment:
      name: ${{ matrix.target }}
```

Check out with `persist-credentials: false`, install the reviewed immutable revision of `supabase/setup-cli` v3 with CLI version `2.115.0`, and run a migration step whose only environment variables are:

```yaml
SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
BPV_SUPABASE_PROJECT_REF: ${{ matrix.projectRef }}
```

The bash command is exactly:

```bash
supabase link --project-ref "$BPV_SUPABASE_PROJECT_REF"
supabase db push --linked --include-all
```

Add an `always()` summary containing target, project ref, commit, and migration step outcome only. It must not echo command environment or secret names.

- [ ] **Step 5: Gate the existing deploy job**

Change the deploy job dependency and condition to:

```yaml
    needs: [verify, migrate]
    if: ${{ always() && needs.verify.result == 'success' && (needs.migrate.result == 'success' || needs.migrate.result == 'skipped') }}
```

Keep its existing matrix, PR dry-run path, Cloudflare credential scope, and `max-parallel: 3`. This lets pull requests deploy dry-run after `migrate` is skipped but blocks production deploy when any migration entry fails.

- [ ] **Step 6: Run targeted tests**

Run:

```powershell
npm.cmd test -- scripts/production-deploy-config.test.ts scripts/production-deploy-workflow.test.ts
```

Expected: PASS. Review the generated workflow text to ensure a pull request cannot reference either migration secret.

- [ ] **Step 7: Review checkpoint**

Run:

```powershell
git diff -- .github/workflows/deploy-production.yml scripts/production-deploy-workflow.test.ts
git diff --check
```

Do not stage or commit.

### Task 3: Document setup and recovery

**Files:**

- Modify: `README.md`
- Modify: `docs/deployment.md`
- Modify: `docs/ai/structure.html`

**Interfaces:**

- Operators can configure credentials, recognize the migration gate, and rerun a failed job without being given secret values.

- [ ] **Step 1: Update the deployment runbook**

In `docs/deployment.md`, add a **Tenant Supabase migration gate** section before **Failed Deployment**. State that a `master` push changing `supabase/migrations/**` migrates all five targets before deploy; identify the two secret names and their scope; state that a failure prevents all deploy jobs; and instruct operators to correct the failing schema/configuration then choose **Re-run failed jobs** for the same commit. Add `SUPABASE_ACCESS_TOKEN` to the repository-secret table and `SUPABASE_DB_PASSWORD` to the GitHub Environment-secret table.

In **One-Time GitHub Setup**, add the repository secret and one environment secret for each of `baanparty`, `baan02`, `baanPMhee`, `flukNasa`, and `villaMedia`. Do not include a secret value or command that passes one as an argument.

- [ ] **Step 2: Update repository and structure documentation**

In `README.md`, expand the existing workflow paragraph to say migrations run before deployment only when `supabase/migrations/` changes, and link to `docs/deployment.md` for setup and recovery.

In `docs/ai/structure.html`, update the `.github/workflows/deploy-production.yml` ownership note to include the tested five-Tenant migration gate, source-of-truth project refs in `wrangler.jsonc`, and `scripts/production-deploy-workflow.test.ts` verification.

- [ ] **Step 3: Verify documentation is consistent and secret-free**

Run:

```powershell
rg -n "SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD|supabase/migrations|Re-run failed jobs|baanparty|baan02|baanPMhee|flukNasa|villaMedia" README.md docs/deployment.md docs/ai/structure.html
rg -n "SUPABASE_DB_PASSWORD=.*|SUPABASE_ACCESS_TOKEN=.*" README.md docs/deployment.md docs/ai/structure.html .github/workflows/deploy-production.yml
git diff --check
```

Expected: documentation names the setup and all five targets; the second search returns no credentials assigned to values.

- [ ] **Step 4: Review checkpoint**

Run:

```powershell
git diff -- README.md docs/deployment.md docs/ai/structure.html
git status --short
```

Do not stage or commit.

### Task 4: Final verification and external readiness

**Files:**

- Verify only; no new source changes.

- [ ] **Step 1: Run all focused migration-gate checks**

Run:

```powershell
npm.cmd test -- scripts/production-deploy-config.test.ts scripts/production-deploy-workflow.test.ts
npm.cmd run validate:deploy:cf
```

Expected: PASS; the configuration matrix validates all five project refs.

- [ ] **Step 2: Run repository verification**

Run:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
git diff --check
```

Expected: all commands exit successfully and no whitespace errors occur.

- [ ] **Step 3: Request external setup only after code review**

Before the merge that first changes a migration, obtain explicit authorization to set or verify GitHub configuration. The required external state is:

1. one repository/organization `SUPABASE_ACCESS_TOKEN` authorized for the five approved projects;
2. one `SUPABASE_DB_PASSWORD` secret in each of the five existing target environments;
3. no database credential in workflow YAML, repository variables, Cloudflare config, or logs.

Verify only secret names through GitHub's UI or `gh secret list`; never print a value. Do not deploy or manually run a remote migration during implementation.

- [ ] **Step 4: Final review checkpoint**

Report the focused/full test, lint, and build results; list the external secret names that remain to be configured; and present the exact changed-file list. Do not claim the remote workflow has run until a reviewed `master` merge triggers it.
