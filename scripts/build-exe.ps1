param(
    [string]$Output = "dist\Billing Integration (Bani Swaif Water).exe",
    [switch]$NoBuild,
    [switch]$SkipPackage
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $NoBuild) {
    Write-Host '==> Building Next.js standalone bundle...'
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'next build failed.' }
}

$standalone = Join-Path $root '.next\standalone'
if (-not (Test-Path $standalone)) {
    throw "Standalone output not found: $standalone"
}

$staging = Join-Path $root 'build\exe-staging'
if (Test-Path $staging) {
    # Remove runtime junctions first so Remove-Item cannot follow them.
    foreach ($name in @('logs', 'data')) {
        $link = Join-Path $staging $name
        $item = Get-Item $link -Force -ErrorAction SilentlyContinue
        if ($item -and $item.LinkType) {
            cmd /c rmdir "`"$link`"" | Out-Null
        }
    }
    Remove-Item $staging -Recurse -Force
}
New-Item -ItemType Directory -Path $staging -Force | Out-Null

Write-Host '==> Staging standalone files...'
Copy-Item (Join-Path $standalone '*') $staging -Recurse -Force

New-Item -ItemType Directory -Path (Join-Path $staging '.next') -Force | Out-Null
Copy-Item (Join-Path $root '.next\static') (Join-Path $staging '.next\static') -Recurse -Force

if (Test-Path (Join-Path $root 'public')) {
    Copy-Item (Join-Path $root 'public') (Join-Path $staging 'public') -Recurse -Force
}

# Runtime configuration. These files are gitignored but must travel with the exe.
foreach ($name in @('.env', '.env.local')) {
    $source = Join-Path $root $name
    if (Test-Path $source) {
        Copy-Item $source (Join-Path $staging $name) -Force
    }
}

Copy-Item (Join-Path $root 'scripts\start-standalone.cjs') (Join-Path $staging 'start.cjs') -Force

# Do not ship development state or old log files.
foreach ($runtimeState in @('logs', 'data')) {
    $statePath = Join-Path $staging $runtimeState
    if (Test-Path $statePath) { Remove-Item $statePath -Recurse -Force }
}

# Ensure the Oracle native addon is present in the standalone bundle.
$oracleSource = Join-Path $root 'node_modules\oracledb'
$oracleTarget = Join-Path $staging 'node_modules\oracledb'
if (Test-Path $oracleSource) {
    if (Test-Path $oracleTarget) { Remove-Item $oracleTarget -Recurse -Force }
    Copy-Item $oracleSource $oracleTarget -Recurse -Force
}

$oracleBinary = Get-ChildItem (Join-Path $oracleTarget 'build\Release') -Filter '*win32-x64.node' -ErrorAction SilentlyContinue
if (-not $oracleBinary) {
    throw 'oracledb win32-x64 native binary is missing from the staged bundle.'
}

# Bundle the Node.js runtime used for the build. caxa used to copy it implicitly.
$nodeSource = (Get-Command node -ErrorAction Stop).Source
$nodeTarget = Join-Path $staging 'node_modules\.bin\node.exe'
New-Item -ItemType Directory -Path (Split-Path -Parent $nodeTarget) -Force | Out-Null
Copy-Item $nodeSource $nodeTarget -Force
Write-Host "==> Bundled Node.js runtime: $nodeSource"

if ($SkipPackage) {
    Write-Host "==> Staged application: $staging"
    return
}

$outPath = Join-Path $root $Output
New-Item -ItemType Directory -Path (Split-Path -Parent $outPath) -Force | Out-Null

Write-Host "==> Packaging $outPath ..."
# caxa's own archiver truncated the payload on this machine, so the exe is
# assembled from the caxa stub plus a verified tar archive (see package-exe.mjs).
node scripts\package-exe.mjs --input $staging --output $outPath --message 'Extracting Billing Integration, please wait...'
if ($LASTEXITCODE -ne 0) { throw 'packaging failed.' }

$size = [math]::Round((Get-Item $outPath).Length / 1MB, 1)
Write-Host "==> Done: $outPath ($size MB)"
