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
    throw "Duplicate approved build variable in .env.$Target.local: $name"
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
    throw "Approved build variable is empty in .env.$Target.local: $name"
  }

  $buildValues[$name] = $value
}

$missingNames = @(
  $approvedBuildNames |
    Where-Object { -not $buildValues.ContainsKey($_) }
)
if ($missingNames.Count -gt 0) {
  throw "Missing approved build variables in .env.$Target.local: $($missingNames -join ', ')"
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
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE."
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
