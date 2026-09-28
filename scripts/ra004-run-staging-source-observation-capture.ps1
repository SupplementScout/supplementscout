[CmdletBinding()]
param([switch]$ValidateOnly)

$ErrorActionPreference = 'Stop'
$databaseUrl = $null
try {
  Write-Host 'RA-004: piec ograniczonych obserwacji SOURCE_OBSERVED na stagingu.'
  Write-Host 'Database URL jest maskowany i pozostaje tylko w pamieci procesu.'
  if (-not $env:NODE_EXTRA_CA_CERTS -or -not (Test-Path -LiteralPath $env:NODE_EXTRA_CA_CERTS -PathType Leaf)) {
    throw 'RA004_CA_CONFIGURATION_MISSING'
  }
  & node -e "require('./ra004-acl-rls-readonly-audit').validateLocalCa(process.env.NODE_EXTRA_CA_CERTS)"
  if ($LASTEXITCODE -ne 0) { throw 'RA004_CA_CONFIGURATION_MISMATCH' }
  Write-Host 'LAUNCHER_VALIDATION_PASS' -ForegroundColor Green
  if ($ValidateOnly) { return }

  $secureValue = Read-Host -Prompt 'Staging database URL' -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
  try { $databaseUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  $confirmation = Read-Host 'Wpisz START, aby zapisac dokladnie piec obserwacji'
  if ($confirmation -cne 'START') { throw 'RA004_SOURCE_OBSERVATION_CANCELLED' }

  $env:RA004_OWNER_DATABASE_URL = $databaseUrl
  & node --use-system-ca (Join-Path $PSScriptRoot 'ra004-staging-source-observation-capture.js')
  if ($LASTEXITCODE -ne 0) { throw "RA004_SOURCE_OBSERVATION_FAILED_$LASTEXITCODE" }
}
catch {
  Write-Host ''
  Write-Host "ZATRZYMANO: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
finally {
  $env:RA004_OWNER_DATABASE_URL = ''
  $databaseUrl = $null
}
