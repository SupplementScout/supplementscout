[CmdletBinding()]
param([switch]$ValidateOnly)

$ErrorActionPreference = 'Stop'
$expectedVersion = '2.111.0'
$confirmation = 'APPLY_RA004_STAGING_10REPS_2948AF2C'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$cliProfile = Join-Path $repositoryRoot 'tmp\ra004-supabase-cli-profile'
$cliCacheRoot = Join-Path $env:LOCALAPPDATA 'npm-cache\_npx'

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

  if (Test-Path -LiteralPath $cliCacheRoot) {
    $candidates += Get-ChildItem -LiteralPath $cliCacheRoot -Filter 'supabase.exe' -File -Recurse -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty FullName
  }

  foreach ($candidate in ($candidates | Select-Object -Unique)) {
    try {
      $startInfo = [Diagnostics.ProcessStartInfo]::new()
      $startInfo.FileName = $candidate
      $startInfo.Arguments = '--version'
      $startInfo.UseShellExecute = $false
      $startInfo.RedirectStandardOutput = $true
      $startInfo.RedirectStandardError = $true
      $startInfo.CreateNoWindow = $true
      $process = [Diagnostics.Process]::Start($startInfo)
      $versionLine = $process.StandardOutput.ReadToEnd()
      $process.StandardError.ReadToEnd() | Out-Null
      $process.WaitForExit()
      if ($process.ExitCode -eq 0 -and ([string]$versionLine).Trim() -eq $expectedVersion) {
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
try {
  Write-Host 'RA-004: jedna migracja 10 Reps, tylko staging, bez canary i produkcji.'
  Write-Host 'Wklejany sekret jest maskowany i pozostaje tylko w pamieci tego procesu.'
  New-Item -ItemType Directory -Force -Path $cliProfile,(Join-Path $cliProfile 'AppData\Roaming'),(Join-Path $cliProfile 'AppData\Local') | Out-Null
  $env:USERPROFILE = $cliProfile
  $env:APPDATA = Join-Path $cliProfile 'AppData\Roaming'
  $env:LOCALAPPDATA = Join-Path $cliProfile 'AppData\Local'
  $cliPath = Find-ExactSupabaseCli
  Write-Host 'LAUNCHER_VALIDATION_PASS' -ForegroundColor Green
  if ($ValidateOnly) { return }
  $databaseUrl = ConvertFrom-MaskedInput 'Staging database URL'
  $operatorConfirmation = Read-Host 'Wpisz APPLY, aby rozpoczac jedna probe'
  if ($operatorConfirmation -cne 'APPLY') {
    throw 'RA004_FIXTURE_EXECUTION_CANCELLED'
  }

  $env:RA004_FIXTURE_OWNER_DATABASE_URL = $databaseUrl
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
  $env:RA004_FIXTURE_SUPABASE_CLI_PATH = ''
  $env:RA004_FIXTURE_CONFIRM = ''
  $databaseUrl = $null
}
