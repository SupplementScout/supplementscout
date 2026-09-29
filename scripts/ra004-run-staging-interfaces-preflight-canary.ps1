[CmdletBinding()]
param([switch]$ValidateOnly)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot

function ConvertFrom-MaskedInput {
  param([Parameter(Mandatory = $true)][string]$Prompt)

  $secureValue = Read-Host -Prompt $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

$databaseUrl = $null
$storageKey = $null
$storageEmail = $null
$storagePassword = $null
try {
  Write-Host 'RA-004: piec swiezych SOURCE_OBSERVED i natychmiast jeden read-only canary.'
  Write-Host 'Wszystkie wklejane dane sa maskowane i pozostaja tylko w pamieci procesu.'
  if (-not $env:NODE_EXTRA_CA_CERTS -or -not (Test-Path -LiteralPath $env:NODE_EXTRA_CA_CERTS -PathType Leaf)) {
    throw 'RA004_CA_CONFIGURATION_MISSING'
  }
  $caValidator = Join-Path $PSScriptRoot 'ra004-acl-rls-readonly-audit.js'
  & node -e "require(process.argv[1]).validateLocalCa(process.env.NODE_EXTRA_CA_CERTS)" $caValidator
  if ($LASTEXITCODE -ne 0) { throw 'RA004_CA_CONFIGURATION_MISMATCH' }
  $coordinator = Join-Path $PSScriptRoot 'ra004-staging-execution-coordinator.js'
  & node -e "require(process.argv[1]).assertActivationExecutable()" $coordinator
  if ($LASTEXITCODE -ne 0) { throw 'RA004_ACTIVATION_TERMINAL' }
  Write-Host 'LAUNCHER_VALIDATION_PASS' -ForegroundColor Green
  if ($ValidateOnly) { return }

  $databaseUrl = ConvertFrom-MaskedInput 'Staging database URL'
  $storageKey = ConvertFrom-MaskedInput 'Staging publishable key'
  $storageEmail = ConvertFrom-MaskedInput 'E-mail staging Auth user'
  $storagePassword = ConvertFrom-MaskedInput 'Haslo staging Auth user'
  $confirmation = Read-Host 'Wpisz START, aby rozpoczac jedna atomowa obserwacje i read-only canary'
  if ($confirmation -cne 'START') { throw 'RA004_EXECUTION_CANCELLED' }

  $env:RA004_OWNER_DATABASE_URL = $databaseUrl
  $env:RA004_STORAGE_ANON_KEY = $storageKey
  $env:RA004_STORAGE_EMAIL = $storageEmail
  $env:RA004_STORAGE_PASSWORD = $storagePassword
  & node --use-system-ca $coordinator
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
  $databaseUrl = $null
  $storageKey = $null
  $storageEmail = $null
  $storagePassword = $null
}
