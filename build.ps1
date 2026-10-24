# 伺かスタジオをまとめてビルドする
#
#   .\build.ps1            32bit の手伝い（yaya_host.exe）→ スタジオ(64bit EXE) の順にビルド
#   .\build.ps1 -Test      テスト用のコンソール（test_host.exe など）も作り、テストも走らせる
#   .\build.ps1 -Clean     中間ファイルを消してから
#   .\build.ps1 -Release   きれいに作り直してテストし、配布用の zip を作る
#
[CmdletBinding()]
param(
    [switch]$Test,
    [switch]$Clean,
    [switch]$Release,
    [ValidateSet('x86', 'x64')]
    [string]$StudioArch = 'x64'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# 配るときは、途中の作りかけが混ざらないように作り直して、テストも必ず通す
if ($Release) { $Clean = $true; $Test = $true }

$versionFile = Join-Path $root 'VERSION'
$version = if (Test-Path $versionFile) { (Get-Content $versionFile -Raw).Trim() } else { '0.0.0' }

# それぞれ別プロセスで動かす（32bit と 64bit の環境変数が混ざらないように）
$host_exe = (Get-Process -Id $PID).Path
if (-not $host_exe) { $host_exe = 'powershell.exe' }

function Invoke-Sub([string]$script, [string[]]$scriptArgs) {
    $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $script) + $scriptArgs
    & $host_exe @all
    if ($LASTEXITCODE -ne 0) { throw "$([System.IO.Path]::GetFileName($script)) が失敗しました。" }
}

# ブロックの「そろい」だけは、ビルドが要りません。先に見ておくと、
# 書き忘れが 2 分待たずに分かります（くわしくは docs\maintenance.md）。
$node = Get-Command node -ErrorAction SilentlyContinue
if ($Test -and $node) {
    Write-Host '=== ブロックのそろい ===' -ForegroundColor Yellow
    & node (Join-Path $root 'tools\check-blocks.js')
    if ($LASTEXITCODE -ne 0) { throw 'check-blocks.js が失敗しました。' }
    Write-Host ''
}

$shioriArgs = @()
if ($Test) { $shioriArgs += '-Test' }
if ($Clean) { $shioriArgs += '-Clean' }
Write-Host '=== 32bit の手伝い (yaya_host.exe) ===' -ForegroundColor Yellow
Invoke-Sub (Join-Path $root 'shiori\build.ps1') $shioriArgs

$studioArgs = @('-Arch', $StudioArch)
if ($Test) { $studioArgs += '-Test' }
if ($Clean) { $studioArgs += '-Clean' }
Write-Host ''
Write-Host '=== 伺かスタジオ (ukagaka-studio.exe) ===' -ForegroundColor Yellow
Invoke-Sub (Join-Path $root 'studio\build.ps1') $studioArgs

# テスト。Node.js を使うのはここだけで、アプリの動作には要りません。
#   そろい   … ブロックが、YAYA への訳・説明・テストにそろっているか（上で先に走ります）
#   imports  … 書き出すゴーストに入れる yaya.dll が Windows 2000 以降で読みこめるか
#   parity   … ブロックを YAYA で動かした答えが、決めておいた答え（expected.json）と同じか。「ためす」も同じか
#   behavior … どれを選ぶか・既定の反応・間引き・保存などのふるまいが期待どおりか
#   yaya     … YAYA（third_party\yaya\）が公式のビルドのままで、訳した辞書が読みこめるか
#   export   … 書き出したファイル（surfaces.txt など）の中身が期待どおりか
#   editor   … エディタのデータ整形とチェックタブが期待どおりか
#   yayatext … YAYA の文を読んで整えて書くところが、YAYA の構文をすべて読み、本物の辞書を読み書きできるか
#   modules  … 画面のファイルが読みこめて、呼び先がそろっているか（分けたときの移し忘れ）
#   i18n     … 画面の文が日本語と英語でそろっているか
if ($Test) {
    Write-Host ''
    Write-Host '=== テスト ===' -ForegroundColor Yellow
    if (-not $node) {
        Write-Host '  Node.js が無いので飛ばします（https://nodejs.org/ で入れると走ります）' -ForegroundColor DarkYellow
    } else {
        foreach ($t in @('tools\check-imports.js',
                         'shiori\test\parity\parity.js', 'shiori\test\behavior\behavior.js',
                         'shiori\test\yaya\yaya.js',
                         'studio\test\export.js', 'ui\test\editor.js', 'ui\test\yayatext.js', 'ui\test\modules.js',
                         'ui\test\i18n.js')) {
            & node (Join-Path $root $t)
            if ($LASTEXITCODE -ne 0) { throw "$([System.IO.Path]::GetFileName($t)) が失敗しました。" }
        }
    }
}

# 配布用の zip。exe 1 つで動くので、読みものを添えるだけです。
if ($Release) {
    Write-Host ''
    Write-Host '=== 配布用のまとめ ===' -ForegroundColor Yellow
    $stage = Join-Path $root "obj\release\ukagaka-studio-$version"
    if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
    New-Item -ItemType Directory -Force $stage | Out-Null
    New-Item -ItemType Directory -Force (Join-Path $stage 'docs') | Out-Null

    Copy-Item (Join-Path $root 'ukagaka-studio.exe') $stage
    # LICENSE は「あれば入れる」ではなく、無かったら止めます。
    # 同梱している WebView2 SDK が、配るときに著作権表示を求めているためです
    # （その本文は LICENSE の後ろに入れてあります）。
    foreach ($f in @('README.md', 'README.en.md', 'CHANGELOG.md', 'LICENSE')) {
        $p = Join-Path $root $f
        if (-not (Test-Path $p)) { throw "$f がありません。配布物に入れるものです。" }
        Copy-Item $p $stage
    }
    Get-ChildItem (Join-Path $root 'docs') -Filter '*.md' -ErrorAction SilentlyContinue |
        ForEach-Object { Copy-Item $_.FullName (Join-Path $stage 'docs') }
    # exe に埋めこんだ YAYA の著作権表示とライセンス（third_party\ のうち、表示に要るものだけ）
    $tp = Join-Path $stage 'third_party'
    New-Item -ItemType Directory -Force (Join-Path $tp 'yaya'), (Join-Path $tp 'yaya-dic') | Out-Null
    Copy-Item (Join-Path $root 'third_party\README.md') $tp
    foreach ($f in @('yaya\LICENSE', 'yaya\readme-original.txt', 'yaya\README.md', 'yaya-dic\LICENSE')) {
        Copy-Item (Join-Path $root "third_party\$f") (Join-Path $tp $f)
    }
    # 文書の英語版（日本語版が正）は docs\en\ のまま入れます（中のリンクがそのまま通るように）
    New-Item -ItemType Directory -Force (Join-Path $stage 'docs\en') | Out-Null
    Get-ChildItem (Join-Path $root 'docs\en') -Filter '*.md' -ErrorAction SilentlyContinue |
        ForEach-Object { Copy-Item $_.FullName (Join-Path $stage 'docs\en') }

    $dist = Join-Path $root 'dist'
    New-Item -ItemType Directory -Force $dist | Out-Null
    $zip = Join-Path $dist "ukagaka-studio-$version.zip"
    if (Test-Path $zip) { Remove-Item -Force $zip }
    Compress-Archive -Path $stage -DestinationPath $zip
    $kb = [math]::Round((Get-Item $zip).Length / 1KB, 1)
    Write-Host "  できました -> $zip ($kb KB)" -ForegroundColor Green
    Write-Host '  中身: ukagaka-studio.exe / README.md / README.en.md / CHANGELOG.md / LICENSE / docs（英語版の docs\en も）/ third_party（YAYA のライセンス）' -ForegroundColor DarkGray
}

Write-Host ''
Write-Host "できあがりました（v$version）。ukagaka-studio.exe をダブルクリックしてください。" -ForegroundColor Green
