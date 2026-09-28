[CmdletBinding()]
param([switch]$ValidateOnly)

$ErrorActionPreference = 'Stop'
$expectedVersion = '2.111.0'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$cliProfile = Join-Path $repositoryRoot 'tmp\ra004-interface-cli-profile'
$cliCacheRoot = Join-Path $env:LOCALAPPDATA 'npm-cache\_npx'

function ConvertFrom-MaskedInput {
  param([Parameter(Mandatory = $true)][string]$Prompt)

  $secureValue = Read-Host -Prompt $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
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
      if ($process.ExitCode -eq 0 -and ([string]$versionLine).Trim() -eq $expectedVersion) { return $candidate }
    }
    catch { continue }
  }
  throw "Nie znaleziono Supabase CLI $expectedVersion. Zatrzymano bez polaczenia i bez zapisu."
}

$databaseUrl = $null
$storageKey = $null
$storageEmail = $null
$storagePassword = $null
try {
  Write-Host 'RA-004: jedna migracja ACL/RLS staging, jeden preflight i jeden read-only canary.'
  Write-Host 'Wszystkie wklejane dane sa maskowane i pozostaja tylko w pamieci procesu.'
  if (-not $env:NODE_EXTRA_CA_CERTS -or -not (Test-Path -LiteralPath $env:NODE_EXTRA_CA_CERTS -PathType Leaf)) {
    throw 'RA004_CA_CONFIGURATION_MISSING'
  }
  & node -e "require('./ra004-acl-rls-readonly-audit').validateLocalCa(process.env.NODE_EXTRA_CA_CERTS)"
  if ($LASTEXITCODE -ne 0) { throw 'RA004_CA_CONFIGURATION_MISMATCH' }
  New-Item -ItemType Directory -Force -Path $cliProfile,(Join-Path $cliProfile 'AppData\Roaming'),(Join-Path $cliProfile 'AppData\Local') | Out-Null
  $env:USERPROFILE = $cliProfile
  $env:APPDATA = Join-Path $cliProfile 'AppData\Roaming'
  $env:LOCALAPPDATA = Join-Path $cliProfile 'AppData\Local'
  $cliPath = Find-ExactSupabaseCli
  Write-Host 'LAUNCHER_VALIDATION_PASS' -ForegroundColor Green
  if ($ValidateOnly) { return }

  $databaseUrl = ConvertFrom-MaskedInput 'Staging database URL'
  $storageKey = ConvertFrom-MaskedInput 'Staging publishable key'
  $storageEmail = ConvertFrom-MaskedInput 'E-mail staging Auth user'
  $storagePassword = ConvertFrom-MaskedInput 'Haslo staging Auth user'
  $confirmation = Read-Host 'Wpisz START, aby rozpoczac jedna autoryzowana probe'
  if ($confirmation -cne 'START') { throw 'RA004_EXECUTION_CANCELLED' }

  $env:RA004_OWNER_DATABASE_URL = $databaseUrl
  $env:RA004_STORAGE_ANON_KEY = $storageKey
  $env:RA004_STORAGE_EMAIL = $storageEmail
  $env:RA004_STORAGE_PASSWORD = $storagePassword
  $env:RA004_SUPABASE_CLI_PATH = $cliPath

  & node --use-system-ca (Join-Path $PSScriptRoot 'ra004-staging-execution-coordinator.js')
  if ($LASTEXITCODE -ne 0) { throw "RA004_COORDINATOR_FAILED_$LASTEXITCODE" }
}
catch {
  Write-Host ''
  Write-Host "ZATRZYMANO: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
finally {
  $env:RA004_OWNER_DATABASE_URL = ''
  $env:RA004_STORAGE_ANON_KEY = ''
  $env:RA004_STORAGE_EMAIL = ''
  $env:RA004_STORAGE_PASSWORD = ''
  $env:RA004_SUPABASE_CLI_PATH = ''
  $databaseUrl = $null
  $storageKey = $null
  $storageEmail = $null
  $storagePassword = $null
}
