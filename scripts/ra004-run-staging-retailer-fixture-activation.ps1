[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$expectedVersion = '2.111.0'
$confirmation = 'APPLY_RA004_STAGING_10REPS_2948AF2C'
$repositoryRoot = Split-Path -Parent $PSScriptRoot

function ConvertFrom-MaskedInput {
  param([Parameter(Mandatory = $true)][string]$Prompt)

  $secureValue = Read-Host -Prompt $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Find-ExactSupabaseCli {
  $candidates = @()
  $command = Get-Command supabase -ErrorAction SilentlyContinue
  if ($null -ne $command -and [IO.Path]::IsPathRooted($command.Source)) {
    $candidates += $command.Source
  }

  $cacheRoot = Join-Path $env:LOCALAPPDATA 'npm-cache\_npx'
  if (Test-Path -LiteralPath $cacheRoot) {
    $candidates += Get-ChildItem -LiteralPath $cacheRoot -Filter 'supabase.exe' -File -Recurse -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty FullName
  }

  foreach ($candidate in ($candidates | Select-Object -Unique)) {
    try {
      $versionLine = & $candidate --version 2>$null | Select-Object -First 1
      if ($LASTEXITCODE -eq 0 -and ([string]$versionLine).Trim() -eq $expectedVersion) {
        return $candidate
      }
    }
    catch {
      continue
    }
  }
  throw "Nie znaleziono Supabase CLI $expectedVersion. Zatrzymano bez polaczenia i bez zapisu."
}

$databaseUrl = $null
$accessToken = $null
try {
  Write-Host 'RA-004: jedna migracja 10 Reps, tylko staging, bez canary i produkcji.'
  Write-Host 'Wklejane sekrety sa maskowane i pozostaja tylko w pamieci tego procesu.'
  $databaseUrl = ConvertFrom-MaskedInput '1/2 Staging database URL'
  $accessToken = ConvertFrom-MaskedInput '2/2 Supabase personal access token (sbp_...)'
  $operatorConfirmation = Read-Host 'Wpisz APPLY, aby rozpoczac jedna probe'
  if ($operatorConfirmation -cne 'APPLY') {
    throw 'RA004_FIXTURE_EXECUTION_CANCELLED'
  }

  $cliPath = Find-ExactSupabaseCli
  $env:RA004_FIXTURE_OWNER_DATABASE_URL = $databaseUrl
  $env:RA004_FIXTURE_SUPABASE_ACCESS_TOKEN = $accessToken
  $env:RA004_FIXTURE_SUPABASE_CLI_PATH = $cliPath
  $env:RA004_FIXTURE_CONFIRM = $confirmation

  & node (Join-Path $PSScriptRoot 'ra004-staging-retailer-fixture-activation.js')
  if ($LASTEXITCODE -ne 0) {
    throw "RA004_FIXTURE_EXECUTOR_FAILED_$LASTEXITCODE"
  }
}
catch {
  Write-Host ''
  Write-Host "ZATRZYMANO: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
finally {
  $env:RA004_FIXTURE_OWNER_DATABASE_URL = ''
  $env:RA004_FIXTURE_SUPABASE_ACCESS_TOKEN = ''
  $env:RA004_FIXTURE_SUPABASE_CLI_PATH = ''
  $env:RA004_FIXTURE_CONFIRM = ''
  $databaseUrl = $null
  $accessToken = $null
}
