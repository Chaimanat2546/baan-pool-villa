# GitHub Actions Multi-Client Production Deployment Design

**Date:** 2026-07-27  
**Status:** Confirmed design, pending implementation plan

## Goal

Merge to `master` once and automatically deploy the same application commit to
all three production clients:

- `baanparty`
- `baan02`
- `baanPMhee`

The workflow must remove local `.env` switching, keep private runtime secrets
out of the repository and build artifacts, allow one client to fail without
stopping the others, and make the failed client independently rerunnable.

## Current State

`wrangler.jsonc` already owns three Wrangler environments with independent
Worker names, public site URLs, rate-limit namespaces, R2 incremental-cache
buckets, service bindings, and Durable Object bindings. Local builds currently
use ignored `.env.baanparty`, `.env.baan02`, and `.env.baanPMhee` files, while
the package scripts expose only a generic OpenNext build/deploy command.

The repository default branch is `master`, the three Workers belong to one
Cloudflare account, and the repository is public. A manual Playwright workflow
already establishes Ubuntu, `npm ci`, and the project production smoke-test
conventions.

Because the clients have different `NEXT_PUBLIC_*` values, Next.js freezes
those values during `next build`. The workflow therefore performs one merge
but three independent OpenNext builds.

## Selected Architecture

Add one production deployment workflow under `.github/workflows`. It runs on a
push to `master`, uses the standard Ubuntu runner with Node.js 24, and has two
stages:

1. `verify` installs the locked dependencies and runs ESLint and the full
   Vitest suite once.
2. `deploy` is a three-entry matrix. Each entry installs dependencies, loads
   its client-specific public build variables, builds OpenNext, deploys with
   `opennextjs-cloudflare deploy --env` followed by its matrix target, and runs
   the existing public HTML prewarm verification against that client's
   canonical URL.

The matrix uses `fail-fast: false`. A build, deploy, or post-deploy check
failure for one client does not cancel another client's job. GitHub can then
rerun only the failed job against the same commit.

Production workflow concurrency prevents overlapping production deployment
runs. An in-progress deployment is never canceled merely because another
commit reaches `master`.

## Deployment Targets

The workflow matrix contains only public routing metadata:

| Target | Canonical URL |
| --- | --- |
| `baanparty` | `https://www.baanpartypattaya.com` |
| `baan02` | `https://www.poolvillapattaya.co.th` |
| `baanPMhee` | `https://baan-pool-villa03.poolvilla.workers.dev` |

The matrix target names must exactly match `wrangler.jsonc`. The canonical URL
is supplied to the OpenNext build as `NEXT_PUBLIC_SITE_URL`, used as the GitHub
deployment URL, and passed explicitly to the prewarm script. The implementation
must validate that each matrix URL matches the corresponding
`wrangler.jsonc` `vars.NEXT_PUBLIC_SITE_URL` value before rollout.

Three GitHub Environments use the same names as the matrix targets. They have
no manual approval gate because the approved flow is automatic after merge.
Each environment restricts deployments to `master`.

## Configuration and Secret Ownership

Repository-level GitHub Actions secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The Cloudflare API token is scoped to the one production account. Its initial
permission set is `Workers Scripts Write`, `Workers R2 Storage Write`, and
`Account Settings Read`. `Workers Routes Write` is added only for explicitly
configured zones if the workflow later owns route changes. The workflow never
prints either credential.

Each GitHub Environment owns only the public, client-specific values required
during `next build`:

- `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL`
- `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

`NEXT_PUBLIC_SITE_URL` remains version-controlled in the deployment matrix and
`wrangler.jsonc` because it is public routing configuration.

Runtime-only credentials and configuration remain Cloudflare Worker secrets for
each Wrangler environment and are not copied into GitHub build variables or
reconstructed as an `.env` file:

- `CALENDAR_INTERNAL_API_TOKEN`
- `DEVILLE_BEARER_TOKEN`
- `PATTAYA_BOOKINGS_API_TOKEN`
- `SUPABASE_PUBLISHABLE_KEY`
- `TURNSTILE_SECRET_KEY`

`SUPABASE_PUBLISHABLE_KEY` is public by design, but keeping its server-runtime
copy in Cloudflare avoids creating a second CI-owned runtime configuration path.

Before enabling automatic deployment, the rollout checks that every target has
the required secret names configured in Cloudflare without reading or logging
their values. `wrangler.jsonc` should declare the complete required-name list
consistently for all three environments.

## Workflow Security

- Deployment runs only from the trusted `master` branch, never from
  `pull_request` code or forks.
- Workflow permissions default to read-only and grant only
  `contents: read` unless implementation proves another permission is needed.
- The workflow uses locked dependencies through `npm ci`.
- Official GitHub actions are pinned to reviewed immutable revisions where
  practical.
- No `.env` file, secret JSON file, build output, or log containing private
  credentials is uploaded as an artifact.
- GitHub Environment branch restrictions provide an additional guard around
  client-specific build configuration.
- The Cloudflare token is account-scoped and follows least privilege.

## Detailed Data Flow

1. A pull request is merged and produces a push to `master`.
2. GitHub starts the production workflow for that commit.
3. `verify` checks out the commit, restores the npm download cache, installs
   with `npm ci`, then runs lint and the complete test suite.
4. A failed `verify` job prevents every deployment.
5. A successful `verify` job releases the three matrix jobs.
6. Each matrix job resolves its matching GitHub Environment.
7. The job checks that required public build variables and Cloudflare
   credentials are non-empty without printing their values.
8. The job runs a client-specific OpenNext build with the target's public
   variables.
9. The job deploys the generated output using the matching Wrangler
   environment.
10. The existing prewarm script requests the target's bounded public route set
    and verifies the expected HTML cache transition.
11. The job writes a secret-free GitHub step summary containing the target,
    commit SHA, canonical URL, and final phase reached.

Each matrix job has a bounded timeout. Dependency installation and OpenNext
output are isolated per runner so one client's build cannot reuse another
client's inlined public values.

## Failure and Recovery Contract

- Lint or test failure: deploy nothing.
- One client build failure: do not deploy that client; continue the other
  clients.
- One client deployment failure: keep successful clients live; mark only the
  failed client job red.
- Prewarm or smoke-check failure after deployment: keep the new deployment
  live, mark that client job red, and clearly report that deployment succeeded
  but verification failed.
- Cloudflare authentication failure: fail affected jobs without exposing
  credentials.
- Missing configuration: fail before build or deploy with the missing variable
  name, never its value.
- Retry: use GitHub's **Re-run failed jobs** action so the same commit is built
  and deployed only for failed matrix entries.
- Rollback: remain an explicit operator action for the affected Worker.
  Automatic cross-Worker rollback is intentionally excluded.

Successful clients are never automatically rolled back because another client
failed.

## Verification

Implementation verification must cover:

1. workflow syntax and matrix expansion for exactly the three approved
   targets;
2. a strict match between matrix target names and `wrangler.jsonc`
   environments;
3. canonical URL equality between the matrix and Wrangler configuration;
4. required GitHub variable-name checks without printing values;
5. complete Cloudflare runtime secret-name declarations for every target;
6. `fail-fast: false` and production concurrency behavior;
7. `master` as the only automatic deployment branch;
8. read-only workflow permissions;
9. ESLint and the full Vitest suite before deployment;
10. one OpenNext production build per client;
11. deployment through the matching `--env` value;
12. post-deploy prewarm verification against the matching canonical URL; and
13. secret-free failure messages and job summaries.

Before the workflow file is merged, run the repository's full Vitest suite,
ESLint, and local production/OpenNext build checks using ignored local
environment files. Configure GitHub Environments and repository secrets before
the merge that first introduces the workflow, because that merge itself will
trigger the initial production deployment.

After the first run, inspect all three GitHub jobs and perform the production
browser/network checks required by `docs/ai/structure.html`, including public
HTML cache transitions and the absence of unexpected public `/_next/image` or
RSC requests.

## Documentation

Implementation updates the deployment guidance and `docs/ai/structure.html`
with:

- the production workflow owner;
- GitHub/Cloudflare configuration ownership;
- the one-merge/three-build behavior;
- retry and rollback instructions; and
- the initial setup order that prevents the first automatic run from starting
  without credentials.

No secret values appear in documentation.

## Cost and Operational Impact

The public repository can use standard GitHub-hosted runners without Actions
minute charges. Three parallel build jobs reduce elapsed deployment time but
consume three concurrent runners. The workflow does not upload build artifacts,
which avoids unnecessary Actions artifact storage.

Cloudflare runtime and storage usage remain on the existing account and
resources. This design adds deployment API activity but no new Cloudflare
product.

## References

- [Next.js environment variables](https://nextjs.org/docs/app/guides/self-hosting)
- [Cloudflare Workers with GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [Cloudflare API token templates](https://developers.cloudflare.com/fundamentals/api/reference/template/)
- [GitHub deployment environments](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments)
- [GitHub workflow and job reruns](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Cloudflare Worker rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)

## Out of Scope

- Automatic deployment from pull requests, feature branches, or forks.
- Automatic rollback across all three Workers.
- Moving private runtime secrets from Cloudflare into GitHub.
- Database migrations, Supabase schema changes, or seed execution.
- Cloudflare Workers for Platforms or a new multi-tenant runtime.
- Client-specific application branches.
- Slack, email, or other third-party deployment notifications.
- Refactoring public configuration into a new runtime configuration service.
