# Production Deployment Runbook

## Normal Release

Pull requests targeting `master` run the `Deploy production clients` workflow
with the same verification, matrix, credential checks, target validation, and
OpenNext builds as production, but the Cloudflare deploy command uses
`--dry-run`. Production deploys automatically on push to `master` (normally
when a PR is merged) and use the real deploy command for
`baanparty`, `baan02`, `baanPMhee`, `flukNasa`, and `villaMedia` independently.

When the pushed commit changes a file under `supabase/migrations/**`, the
workflow runs a five-Tenant migration gate before any Worker deploy. That
directory owns only Tenant migrations, and the workflow stages them in a
temporary directory before applying them to `baanparty`, `baan02`, `baanPMhee`,
`flukNasa`, and `villaMedia`. Catalog/image history is physically separate under
`supabase-catalog/migrations` and must be run only from the catalog database's
own project. Seed files and ad-hoc patch SQL do not trigger the gate. Every
migration target must succeed before the deploy matrix starts. If any Tenant
migration fails, deployment is blocked for that commit.

For each target, CD verifies `CLOUDFLARE_API_TOKEN` through Cloudflare
`/client/v4/user/tokens/verify` before target validation, build, or deploy. It
sends the token only as a Bearer credential and does not print the token or API
response.

Do not copy a client `.env` file over `.env` for production deployment.

## Configuration Ownership

| Scope | Names | Owner |
| --- | --- | --- |
| GitHub repository secrets | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Repository Actions settings |
| GitHub repository or organization secret | `SUPABASE_ACCESS_TOKEN` | Authenticates the Supabase CLI for the migration gate; keep the value out of workflow output |
| GitHub Environment secret | `SUPABASE_PUBLISHABLE_KEY` | Matching deployment environment; required for villa-catalog and sitemap builds |
| GitHub Environment secret | `SUPABASE_DB_PASSWORD` | Unique database password for that environment's migration target |
| GitHub Environment variables | `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL`, `NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Matching deployment environment |
| Version-controlled public URL | `NEXT_PUBLIC_SITE_URL` | `scripts/production-deploy-config.mjs` and matching `wrangler.jsonc` environment |
| Cloudflare Worker secrets | `CALENDAR_INTERNAL_API_TOKEN`, `DEVILLE_BEARER_TOKEN`, `PATTAYA_BOOKINGS_API_TOKEN`, `SUPABASE_PUBLISHABLE_KEY`, `TURNSTILE_SECRET_KEY` | Matching Wrangler environment |

Never place Cloudflare Worker secret values in GitHub variables, workflow YAML,
documentation, command arguments, or logs.

`SUPABASE_PUBLISHABLE_KEY` is the one build-time exception: configure it as a
secret in each matching GitHub Environment so the villa catalog and
`/sitemap.xml` can build. Its GitHub Environment and Cloudflare Worker copies
must stay synchronized; never print either value.

## One-Time GitHub Setup

1. Add repository secrets `CLOUDFLARE_ACCOUNT_ID` and
   `CLOUDFLARE_API_TOKEN`.
2. Create GitHub Environments named `baanparty`, `baan02`, `baanPMhee`, `flukNasa`, and `villaMedia`.
3. Restrict each environment to deployments from `master`.
4. Do not add a required-reviewer gate; the approved release is automatic.
5. Add the three public build variables and the
   `SUPABASE_PUBLISHABLE_KEY` secret to each matching environment.
6. Do not store the four runtime-only Worker secrets in GitHub.
7. Provision and verify `CALENDAR_INTERNAL_API_TOKEN`,
   `DEVILLE_BEARER_TOKEN`, `PATTAYA_BOOKINGS_API_TOKEN`,
   `SUPABASE_PUBLISHABLE_KEY`, and `TURNSTILE_SECRET_KEY` for each matching
   Worker environment without exposing
   their values. Keep the `SUPABASE_PUBLISHABLE_KEY` value synchronized with
   its matching GitHub Environment secret.
8. Add `SUPABASE_ACCESS_TOKEN` at repository or organization scope. Add a
   different `SUPABASE_DB_PASSWORD` secret to each environment:
   `baanparty`, `baan02`, `baanPMhee`, `flukNasa`, and `villaMedia`. Never put
   either secret value in documentation, commands, logs, summaries, or
   artifacts.
9. Complete this setup before merging the workflow file because that merge
   triggers the first production deployment.

## Cloudflare Token Scope

Use one token scoped to the production account with:

- `Workers Scripts Write`
- `Workers R2 Storage Write`
- `Account Settings Read`

Do not add zone permissions while routes remain outside `wrangler.jsonc`.

## Pre-Merge Checks

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run validate:deploy:cf
```

Verify Cloudflare secret names without printing their values:

```powershell
npx.cmd wrangler secret list --env baanparty --format json
npx.cmd wrangler secret list --env baan02 --format json
npx.cmd wrangler secret list --env baanPMhee --format json
npx.cmd wrangler secret list --env flukNasa --format json
npx.cmd wrangler secret list --env villaMedia --format json
```

## Failed Deployment

Open the failed workflow run and choose **Re-run failed jobs**. Successful
matrix jobs stay unchanged; the failed target rebuilds and deploys the same
commit SHA.

For a failed migration gate, correct the database or configuration issue first,
then choose **Re-run failed jobs** for the same commit. The workflow reruns the
failed Tenant migration jobs and keeps deployment blocked until all five targets
pass; database rollback is not automated.

If prewarm fails after deploy, the Worker remains deployed. Inspect the job
summary to distinguish build, deploy, and prewarm outcomes.

## Rollback

Rollback is explicit and target-specific. Run only the command for the affected
Worker:

```powershell
npx.cmd wrangler rollback --env baanparty
npx.cmd wrangler rollback --env baan02
npx.cmd wrangler rollback --env baanPMhee
npx.cmd wrangler rollback --env flukNasa
npx.cmd wrangler rollback --env villaMedia
```

Never roll back all clients automatically because one client failed.

## Manual Recovery Deployment

GitHub Actions is the normal release path. For an explicitly approved manual
deployment, run the tracked helper from the repository root and pass exactly
one approved target:

```powershell
.\scripts\deploy-client.ps1 -Target baanparty
```

The helper derives `.env.<target>.local` only after PowerShell validates the target,
loads only the five approved build variables into the current process, rejects
missing or empty values, and restores every previous process value in
`finally`. It never copies a client file over `.env` or prints loaded values.

```powershell
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("baanparty", "baan02", "baanPMhee", "flukNasa", "villaMedia")]
  [string]$Target
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$approvedBuildNames = @(
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL",
  "NEXT_PUBLIC_HOME_CONFIG_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "SUPABASE_PUBLISHABLE_KEY"
)

$clientEnvPath = Join-Path -Path (Get-Location) -ChildPath ".env.$Target.local"
if (-not (Test-Path -LiteralPath $clientEnvPath -PathType Leaf)) {
  throw "Missing client environment file: .env.$Target.local"
}

$escapedNames = $approvedBuildNames |
  ForEach-Object { [Regex]::Escape($_) }
$assignmentPattern =
  "^\s*(?<name>$($escapedNames -join '|'))\s*=(?<value>.*)$"
$buildValues = @{}

foreach ($line in Get-Content -LiteralPath $clientEnvPath) {
  if ($line -notmatch $assignmentPattern) {
    continue
  }

  $name = $Matches.name
  if ($buildValues.ContainsKey($name)) {
    throw "Duplicate approved build variable in .env.${Target}.local: $name"
  }

  $value = $Matches.value.Trim()
  if ($value.Length -ge 2) {
    $firstCharacter = $value[0]
    $lastCharacter = $value[$value.Length - 1]
    if (
      ($firstCharacter -eq '"' -and $lastCharacter -eq '"') -or
      ($firstCharacter -eq "'" -and $lastCharacter -eq "'")
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }
  }

  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Approved build variable is empty in .env.${Target}.local: $name"
  }

  $buildValues[$name] = $value
}

$missingNames = @(
  $approvedBuildNames |
    Where-Object { -not $buildValues.ContainsKey($_) }
)
if ($missingNames.Count -gt 0) {
  throw "Missing approved build variables in .env.${Target}.local: $($missingNames -join ', ')"
}

function Invoke-NativeChecked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,

    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,

    [Parameter(Mandatory = $true)]
    [string]$Description
  )

  & $FilePath @Arguments
  $nativeExitCode = $LASTEXITCODE
  if ($nativeExitCode -ne 0) {
    throw "$Description failed with exit code $nativeExitCode."
  }
}

$previousProcessValues = @{}
foreach ($name in $approvedBuildNames) {
  $previousProcessValues[$name] =
    [Environment]::GetEnvironmentVariable($name, "Process")
}

try {
  foreach ($name in $approvedBuildNames) {
    [Environment]::SetEnvironmentVariable(
      $name,
      $buildValues[$name],
      "Process"
    )
  }

  Invoke-NativeChecked `
    -FilePath "npm.cmd" `
    -Arguments @("run", "validate:deploy:cf", "--", $Target) `
    -Description "Deployment configuration validation"

  Invoke-NativeChecked `
    -FilePath "npm.cmd" `
    -Arguments @("run", "build:cf") `
    -Description "OpenNext build"

  Invoke-NativeChecked `
    -FilePath "npm.cmd" `
    -Arguments @("run", "deploy:cf:built", "--", "--env", $Target) `
    -Description "Worker deployment"

  Invoke-NativeChecked `
    -FilePath "npm.cmd" `
    -Arguments @(
      "run",
      "prewarm:cf",
      "--",
      "--url=$($buildValues['NEXT_PUBLIC_SITE_URL'])"
    ) `
    -Description "Public HTML prewarm"
} finally {
  foreach ($name in $approvedBuildNames) {
    [Environment]::SetEnvironmentVariable(
      $name,
      $previousProcessValues[$name],
      "Process"
    )
  }
}
```

Example:

```powershell
.\Invoke-BpvRecovery.ps1 -Target baan02
```

Local `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` credentials must
already be available at process scope to the validator and deploy command. The
helper never reads Cloudflare credentials from a client environment file. The
validator runs before the build, and the same validated target and
`NEXT_PUBLIC_SITE_URL` are used for deploy and prewarm. Never deploy a build
produced with another client's public variables.

## First Production Verification

After the first automatic production release:

1. Confirm the `Verify` job and all five deploy jobs passed for the same commit
   SHA. Do not accept a mix of jobs from different workflow runs or commits.
2. Inspect desktop and mobile rendering for the homepage, `/search`, one real
   `/guides/<slug>` page, and one real `/villas/<id>` page on every client:
   - `https://www.baanpartypattaya.com`
   - `https://www.poolvillapattaya.co.th`
   - `https://www.pmheevilla.com`
   - `https://fluk-nasa-poolvilla.poolvilla.workers.dev`
   - `https://villa-media-poolvilla.poolvilla.workers.dev`
3. In browser network tools, confirm there are no unexpected `/_next/image` or
   `_rsc` requests and route/API request counts remain bounded for each flow.
4. Request allowlisted public HTML twice and confirm `x-bpv-html-cache`
   transitions from `MISS` to `HIT`.
5. Confirm RSC requests, requests with cookies or query strings, admin routes,
   and unsupported API routes bypass the public HTML cache.
6. Confirm each client emits only its own canonical URL and uses its assigned
   Supabase project and Turnstile site key. No identifier may cross between
   clients; compare configured identities without printing key values in logs.
