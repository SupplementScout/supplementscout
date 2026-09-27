param([switch]$ValidateOnly)

$ErrorActionPreference = 'Stop'
$expectedBaseline = 'dbb25b8679fea1b13a8f7238820e739198b21f49'
git merge-base --is-ancestor $expectedBaseline HEAD
if ($LASTEXITCODE -ne 0) { throw 'RA004_INVENTORY_BASELINE_MISMATCH' }
$trackedStatus = @(git status --porcelain) -join "`n"
if ($trackedStatus.Trim()) { throw 'RA004_INVENTORY_WORKTREE_DIRTY' }

Write-Host 'RA-004: jeden odczyt inventory staging schema w jednej transakcji read-only.'
Write-Host 'Nie wykonuje migracji, DDL, DML, preflightu ani canary.'
Write-Host 'INVENTORY_LAUNCHER_VALIDATION_PASS' -ForegroundColor Green
if ($ValidateOnly) { exit 0 }

function ConvertFrom-MaskedInput([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

$databaseUrl = ConvertFrom-MaskedInput 'Wklej staging database URL'
try {
  $env:RA004_INVENTORY_DATABASE_URL = $databaseUrl
  & node (Join-Path $PSScriptRoot 'ra004-staging-schema-inventory.js')
  $exitCode = $LASTEXITCODE
} finally {
  $env:RA004_INVENTORY_DATABASE_URL = ''
  $databaseUrl = $null
}
if ($exitCode -ne 0) { throw "RA004_INVENTORY_FAILED_$exitCode" }
Write-Host 'Nacisnij Enter dopiero po zrobieniu zdjecia wyniku:'
[void](Read-Host)
