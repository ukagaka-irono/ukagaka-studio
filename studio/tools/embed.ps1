# 伺かスタジオ - UI・栞・サンプルを exe に埋め込むためのリソースを作る
#
#   assets.rc      … rc.exe に渡すリソース定義
#   assets_gen.h   … パス → リソースID の対応表
#
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$PublicDir,
    [Parameter(Mandatory = $true)][string]$StageDir,
    [string]$YayaDllPath,
    [string]$YayaHostPath,
    [string]$YayaResDir,
    [string]$YayaBaseDir,
    [string]$SamplePath,
    [string]$SampleEnPath,
    [string]$IconPath,
    [string]$Version = '0.0.0'
)

$ErrorActionPreference = 'Stop'

$MimeMap = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.ico'  = 'image/x-icon'
    '.woff2' = 'font/woff2'
    '.map'  = 'application/json; charset=utf-8'
}

$assetsDir = Join-Path $StageDir 'assets'
if (Test-Path $assetsDir) { Remove-Item -Recurse -Force $assetsDir }
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null

# ---- UI ファイルを ASCII 名で並べ直す（rc.exe に日本語パスを渡さないため）----
# ui\test\ は画面では使わない（node で動かすテスト）ので、exe には入れません
# package.json も node むけの印なので入れません
$files = Get-ChildItem -Path $PublicDir -Recurse -File |
    Where-Object { $_.FullName -notmatch '\\test\\' -and $_.Name -ne 'package.json' } |
    Sort-Object FullName
$entries = @()
$id = 1000
foreach ($f in $files) {
    $rel = $f.FullName.Substring((Resolve-Path $PublicDir).Path.Length).TrimStart('\', '/')
    $webPath = '/' + ($rel -replace '\\', '/')
    $stageName = 'a{0}.bin' -f $id
    Copy-Item $f.FullName (Join-Path $assetsDir $stageName) -Force
    $ext = $f.Extension.ToLowerInvariant()
    $mimeType = if ($MimeMap.ContainsKey($ext)) { $MimeMap[$ext] } else { 'application/octet-stream' }
    $entries += [pscustomobject]@{ Path = $webPath; Id = $id; Mime = $mimeType; File = $stageName }
    $id++
}

# ---- 栞・サンプル・アイコン ----------------------------------------------
$rc = New-Object System.Text.StringBuilder
[void]$rc.AppendLine('// このファイルは studio\tools\embed.ps1 が自動生成します。編集しないでください。')

if ($IconPath -and (Test-Path $IconPath)) {
    Copy-Item $IconPath (Join-Path $assetsDir 'ukagaka-studio.ico') -Force
    [void]$rc.AppendLine('101 ICON "assets\\ukagaka-studio.ico"')
}
# YAYA 一式。書き出すゴーストに入れ、「ためす」も作業用のフォルダに書き出して使います。
#   yaya.dll（公式ビルド）・yaya_host.exe（32bit の手伝い）・しくみの辞書・「ためす」の入り口・yaya_base
# 書き出すときのフォルダでの名前と、リソースの番号の対応を assets_gen.h の kYayaKit に書きます。
$kit = @()
function Add-KitFile([string]$from, [string]$name, [int]$kitId) {
    if (-not ($from -and (Test-Path $from))) {
        Write-Warning "[embed] $name が見つかりません。YAYA の「ためす」が動かない exe になります。"
        return
    }
    $stageName = 'y{0}.bin' -f $kitId
    Copy-Item $from (Join-Path $assetsDir $stageName) -Force
    [void]$rc.AppendLine(('{0} RCDATA "assets\\{1}"' -f $kitId, $stageName))
    $script:kit += [pscustomobject]@{ Name = $name; Id = $kitId }
}
Add-KitFile $YayaDllPath 'yaya.dll' 903
Add-KitFile $YayaHostPath 'yaya_host.exe' 904
if ($YayaResDir) {
    Add-KitFile (Join-Path $YayaResDir 'studio_runtime.dic') 'studio_runtime.dic' 905
    Add-KitFile (Join-Path $YayaResDir 'studio_preview.dic') 'studio_preview.dic' 906
}
$kitId = 910
if ($YayaBaseDir -and (Test-Path $YayaBaseDir)) {
    foreach ($f in (Get-ChildItem $YayaBaseDir -File | Sort-Object Name)) {
        Add-KitFile $f.FullName ('yaya_base\' + $f.Name) $kitId
        $kitId++
    }
}
if ($SamplePath -and (Test-Path $SamplePath)) {
    Copy-Item $SamplePath (Join-Path $assetsDir 'sample.json') -Force
    [void]$rc.AppendLine('901 RCDATA "assets\\sample.json"')
}
# 英語のサンプル（exe の言語が英語のとき、はじめて起動したときに置く）
if ($SampleEnPath -and (Test-Path $SampleEnPath)) {
    Copy-Item $SampleEnPath (Join-Path $assetsDir 'sample-en.json') -Force
    [void]$rc.AppendLine('902 RCDATA "assets\\sample-en.json"')
}
foreach ($e in $entries) {
    [void]$rc.AppendLine(('{0} RCDATA "assets\\{1}"' -f $e.Id, $e.File))
}

# ---- exe のプロパティに出るバージョン情報 ----------------------------------
$nums = @($Version -split '[.\-+]' | Where-Object { $_ -match '^\d+$' })
while ($nums.Count -lt 4) { $nums += '0' }
$v4 = ($nums[0..3]) -join ','
[void]$rc.AppendLine('')
[void]$rc.AppendLine('1 VERSIONINFO')
[void]$rc.AppendLine("FILEVERSION $v4")
[void]$rc.AppendLine("PRODUCTVERSION $v4")
[void]$rc.AppendLine('FILEOS 0x4L')
[void]$rc.AppendLine('FILETYPE 0x1L')
[void]$rc.AppendLine('{')
[void]$rc.AppendLine(' BLOCK "StringFileInfo"')
[void]$rc.AppendLine(' {')
[void]$rc.AppendLine('  BLOCK "041104b0"')          # 日本語 + Unicode
[void]$rc.AppendLine('  {')
[void]$rc.AppendLine('   VALUE "ProductName", "伺かスタジオ"')
[void]$rc.AppendLine('   VALUE "FileDescription", "伺かスタジオ - 伺かゴーストをブロックで作る"')
[void]$rc.AppendLine('   VALUE "FileVersion", "' + $Version + '"')
[void]$rc.AppendLine('   VALUE "ProductVersion", "' + $Version + '"')
[void]$rc.AppendLine('   VALUE "OriginalFilename", "ukagaka-studio.exe"')
[void]$rc.AppendLine('  }')
[void]$rc.AppendLine(' }')
[void]$rc.AppendLine(' BLOCK "VarFileInfo"')
[void]$rc.AppendLine(' {')
[void]$rc.AppendLine('  VALUE "Translation", 0x411, 1200')
[void]$rc.AppendLine(' }')
[void]$rc.AppendLine('}')

$rcPath = Join-Path $StageDir 'assets.rc'
[System.IO.File]::WriteAllText($rcPath, $rc.ToString(), (New-Object System.Text.UTF8Encoding($false)))

# ---- 対応表 ---------------------------------------------------------------
$h = New-Object System.Text.StringBuilder
[void]$h.AppendLine('// このファイルは studio\tools\embed.ps1 が自動生成します。編集しないでください。')
[void]$h.AppendLine('#pragma once')
[void]$h.AppendLine('')
[void]$h.AppendLine('struct WebAsset { const char* path; int id; const char* mime; };')
[void]$h.AppendLine('')
[void]$h.AppendLine('static const WebAsset kWebAssets[] = {')
foreach ($e in $entries) {
    [void]$h.AppendLine(('    {{ "{0}", {1}, "{2}" }},' -f $e.Path, $e.Id, $e.Mime))
}
[void]$h.AppendLine('};')
[void]$h.AppendLine(('static const int kWebAssetCount = {0};' -f $entries.Count))
[void]$h.AppendLine('')
[void]$h.AppendLine('// YAYA 一式（作業用のフォルダでの名前とリソースの番号）')
[void]$h.AppendLine('struct YayaKitFile { const wchar_t* name; int id; };')
[void]$h.AppendLine('static const YayaKitFile kYayaKit[] = {')
foreach ($k in $kit) {
    [void]$h.AppendLine(('    {{ L"{0}", {1} }},' -f ($k.Name -replace '\\', '\\'), $k.Id))
}
if (-not $kit.Count) { [void]$h.AppendLine('    { L"", 0 },') }
[void]$h.AppendLine('};')
[void]$h.AppendLine(('static const int kYayaKitCount = {0};' -f $kit.Count))

$hPath = Join-Path $StageDir 'assets_gen.h'
[System.IO.File]::WriteAllText($hPath, $h.ToString(), (New-Object System.Text.UTF8Encoding($false)))

# ---- 版（VERSION の中身。画面が /api/state で読みます）---------------------
$vh = "// このファイルは studio\tools\embed.ps1 が自動生成します。編集しないでください。`r`n#pragma once`r`n" +
      "#define STUDIO_VERSION `"$Version`"`r`n"
[System.IO.File]::WriteAllText((Join-Path $StageDir 'version_gen.h'), $vh, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ("[embed] UI {0} ファイルを埋め込みます" -f $entries.Count) -ForegroundColor DarkGray
