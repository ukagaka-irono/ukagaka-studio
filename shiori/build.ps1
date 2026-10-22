# 伺かスタジオ - 32bit の手伝いをビルドする
#
#   .\build.ps1          yaya_host.exe（「ためす」が YAYA を動かすための 32bit の手伝い）
#   .\build.ps1 -Test    テスト用の test_host.exe と slow_saori.dll も
#
# ゴーストの栞は YAYA の公式ビルド（third_party\yaya\yaya.dll）をそのまま使うので、
# ここでは栞そのものは組みません。SSP と同じ 32bit の yaya.dll を読みこむものだけを作ります。
#
[CmdletBinding()]
param(
    [switch]$Test,
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $root
$dist = Join-Path $root 'dist'
$obj  = Join-Path $root 'obj\x86'

if ($Clean -and (Test-Path $obj)) { Remove-Item -Recurse -Force $obj }
New-Item -ItemType Directory -Force -Path $dist, $obj | Out-Null

# ---- 32bit の MSVC 環境 ----------------------------------------------------
function Import-VcVars([string]$targetArch) {
    $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    $vsPath = $null
    if (Test-Path $vswhere) {
        $vsPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    }
    if (-not $vsPath) {
        $guess = Get-ChildItem "$env:ProgramFiles\Microsoft Visual Studio" -Directory -ErrorAction SilentlyContinue |
                 Sort-Object Name -Descending | Select-Object -First 1
        if ($guess) { $vsPath = (Get-ChildItem $guess.FullName -Directory | Select-Object -First 1).FullName }
    }
    if (-not $vsPath) { throw 'Visual Studio (C++ ビルドツール) が見つかりませんでした。' }

    $bat = Join-Path $vsPath 'VC\Auxiliary\Build\vcvarsall.bat'
    if (-not (Test-Path $bat)) { throw "vcvarsall.bat が見つかりません: $bat" }

    $lines = cmd /c "`"$bat`" $targetArch >nul 2>&1 && set"
    foreach ($line in $lines) {
        if ($line -match '^([^=]+)=(.*)$') {
            Set-Item -Path ("Env:" + $matches[1]) -Value $matches[2] -ErrorAction SilentlyContinue
        }
    }
}

$cl = Get-Command cl -ErrorAction SilentlyContinue
$isX86Env = $cl -and $env:LIB -and -not ($cl.Source -match '\\Hostx64\\x64\\' -or $env:VSCMD_ARG_TGT_ARCH -eq 'x64')
if (-not $isX86Env) {
    Write-Host '[x86] MSVC 環境を読み込みます (x86)...' -ForegroundColor DarkGray
    Import-VcVars 'x86'
}

$clCommon = @('/nologo', '/O2', '/MT', '/EHsc', '/W3', '/utf-8', '/D_CRT_SECURE_NO_WARNINGS')

# ---- YAYA を動かす手伝い（yaya_host.exe）------------------------------------
# 伺かスタジオの「ためす」が、SSP と同じ 32bit の yaya.dll を動かすために使います。
# 64bit の exe からは直に読めないので、32bit で組みます。studio\build.ps1 が exe に埋め込みます。
$hostObj = Join-Path $obj 'yayahost'
New-Item -ItemType Directory -Force -Path $hostObj | Out-Null
$hostOut = Join-Path $dist 'yaya_host.exe'
Write-Host '[x86] YAYA の手伝い (yaya_host.exe) をビルド中...' -ForegroundColor Cyan
& cl @clCommon /DUNICODE /D_UNICODE (Join-Path $repo 'studio\yaya_host\yaya_host.cpp') `
    "/Fo:$hostObj\" "/Fe:$hostOut" /link /SUBSYSTEM:CONSOLE
if ($LASTEXITCODE -ne 0) { throw 'yaya_host.exe のビルドに失敗しました。' }
Write-Host "[x86] OK -> $hostOut" -ForegroundColor Green

# ---- テスト用 --------------------------------------------------------------
#   test_host.exe  … SSP のかわりに yaya.dll を読みこんで、イベントを順にたずねる
#   slow_saori.dll … 待つ呼び出しを確かめるための、おそい SAORI
if ($Test) {
    $testObj = Join-Path $obj 'testbuild'
    New-Item -ItemType Directory -Force -Path $testObj | Out-Null

    $testOut = Join-Path $dist 'test_host.exe'
    Write-Host '[x86] テストホストをビルド中...' -ForegroundColor Cyan
    & cl @clCommon (Join-Path $root 'test\test_host.cpp') `
        "/Fo:$testObj\" "/Fe:$testOut" /link /SUBSYSTEM:CONSOLE
    if ($LASTEXITCODE -ne 0) { throw 'テストホストのビルドに失敗しました。' }
    Write-Host "[x86] OK -> $testOut" -ForegroundColor Green

    $saoriOut = Join-Path $dist 'slow_saori.dll'
    Write-Host '[x86] テスト用の SAORI をビルド中...' -ForegroundColor Cyan
    & cl @clCommon (Join-Path $root 'test\saori\slow_saori.cpp') `
        "/Fo:$testObj\" "/Fe:$saoriOut" /link /DLL /EXPORT:load /EXPORT:unload /EXPORT:request
    if ($LASTEXITCODE -ne 0) { throw 'テスト用 SAORI のビルドに失敗しました。' }
    Write-Host "[x86] OK -> $saoriOut" -ForegroundColor Green
}
