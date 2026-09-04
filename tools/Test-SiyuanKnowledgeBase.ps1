<#
.SYNOPSIS
  验证思源知识库的生成结果、内部链接、资源引用与基础隐私规则。

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Test-SiyuanKnowledgeBase.ps1
#>
[CmdletBinding()]
param(
    [string]$BlogDir = '',
    [switch]$Strict
)

$ErrorActionPreference = 'Stop'
if (-not $BlogDir) { $BlogDir = Split-Path -Parent $PSScriptRoot }
$Errors = [System.Collections.Generic.List[string]]::new()
$Warnings = [System.Collections.Generic.List[string]]::new()

function Add-Error([string]$Message) { $Errors.Add($Message) }
function Add-Warning([string]$Message) { $Warnings.Add($Message) }

$knowledgeRoot = Join-Path $BlogDir 'source\siyuan'
$assetRoot = Join-Path $BlogDir 'source\images\siyuan'
$dataPath = Join-Path $BlogDir 'source\js\siyuan-data.js'
$privateKnowledgeRelative = '能力体系'
$privateKnowledgeUrl = '/siyuan/能力体系/'

if (-not (Test-Path -LiteralPath $knowledgeRoot -PathType Container)) { Add-Error "缺少知识库目录：$knowledgeRoot" }
if (-not (Test-Path -LiteralPath $dataPath -PathType Leaf)) { Add-Error "缺少目录数据：$dataPath" }
if ($Errors.Count) {
    $Errors | ForEach-Object { Write-Host "[错误] $_" -ForegroundColor Red }
    exit 1
}

$dataText = [System.IO.File]::ReadAllText($dataPath)
if ($dataText.IndexOf($privateKnowledgeUrl, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
    Add-Error '目录数据包含永久私密的能力体系 URL'
}
$jsonText = $dataText -replace '^\s*window\.SiyuanKnowledgeData\s*=\s*', '' -replace ';\s*$', ''
try { $data = $jsonText | ConvertFrom-Json } catch { Add-Error "siyuan-data.js 不是有效 JSON：$($_.Exception.Message)" }

$pages = @(Get-ChildItem -LiteralPath $knowledgeRoot -Recurse -File -Filter 'index.md')
$privateKnowledgeRoot = Join-Path $knowledgeRoot $privateKnowledgeRelative
if (Test-Path -LiteralPath $privateKnowledgeRoot) {
    Add-Error "永久私密目录被生成：$privateKnowledgeRoot"
}
if ($data -and $pages.Count -ne @($data.documents).Count) {
    Add-Error "页面数量 $($pages.Count) 与目录数据 $(@($data.documents).Count) 不一致"
}

$knownUrls = @{}
if ($data) {
    foreach ($doc in @($data.documents)) {
        $url = ([string]$doc.url).TrimEnd('/') + '/'
        if ($knownUrls.ContainsKey($url)) { Add-Error "重复 URL：$url" } else { $knownUrls[$url] = $true }
    }
    $actualArticles = @(Get-ChildItem -LiteralPath (Join-Path $BlogDir 'source\_posts') -Recurse -File -Filter '*.md' -ErrorAction SilentlyContinue).Count
    if ($null -ne $data.articleCount -and [int]$data.articleCount -ne $actualArticles) {
        Add-Warning "文章计数已过期：数据为 $($data.articleCount)，实际为 $actualArticles；请重新导入"
    }
}

$privateValues = [System.Collections.Generic.List[string]]::new()
$privateValuesPath = Join-Path $BlogDir 'tools\siyuan-private-values.txt'
if (Test-Path -LiteralPath $privateValuesPath) {
    foreach ($line in [System.IO.File]::ReadAllLines($privateValuesPath)) {
        $value = $line.Trim()
        if ($value -and -not $value.StartsWith('#')) { $privateValues.Add($value) }
    }
}

foreach ($page in $pages) {
    $bytes = [System.IO.File]::ReadAllBytes($page.FullName)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        Add-Error "文件带 UTF-8 BOM：$($page.FullName)"
    }
    $text = [System.IO.File]::ReadAllText($page.FullName)
    $prose = [regex]::Replace($text, '(?ms)^(```|~~~).*?^\1\s*$', '')
    $prose = [regex]::Replace($prose, '`[^`\r\n]+`', '')
    if ($text -notmatch '(?s)\A---\s*\r?\n.*?\r?\n---') { Add-Error "缺少 front matter：$($page.FullName)" }
    if ($text -notmatch '(?m)^type:\s*siyuan-note\s*$') { Add-Error "缺少 type: siyuan-note：$($page.FullName)" }
    if ($prose -match 'siyuan://blocks/') { Add-Error "残留 siyuan:// 死链：$($page.FullName)" }

    foreach ($match in [regex]::Matches($text, '(?<!!)\[[^\]]+\]\((?<url>/siyuan/[^\s\)#]+)(?:#[^\)]*)?\)')) {
        $url = [System.Uri]::UnescapeDataString($match.Groups['url'].Value).TrimEnd('/') + '/'
        if (-not $knownUrls.ContainsKey($url)) { Add-Error "无目标的站内链接：$($page.FullName) -> $url" }
    }
    foreach ($match in [regex]::Matches($text, '!\[[^\]]*\]\(/images/siyuan/(?<asset>[^\)\s]+)\)')) {
        $asset = [System.Uri]::UnescapeDataString($match.Groups['asset'].Value).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path -LiteralPath (Join-Path $assetRoot $asset) -PathType Leaf)) {
            Add-Warning "缺失图片：$($page.FullName) -> $asset"
        }
    }
    foreach ($value in $privateValues) {
        if ($text.IndexOf($value, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            Add-Error "命中自定义隐私值：$($page.FullName)"
        }
    }
}

$routerPage = Join-Path $knowledgeRoot '其他笔记\计算机网络\个人路由配置记录\index.md'
if (Test-Path -LiteralPath $routerPage) {
    $routerText = [System.IO.File]::ReadAllText($routerPage)
    if ($routerText -match '(?i)\b[0-9a-f]{16}\b') { Add-Error '个人路由配置仍含疑似 ZeroTier Network ID' }
    if ($routerText -match '(?<![\d.])(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)(?:\d{1,3}\.){1,2}\d{1,3}(?:/\d{1,2})?(?![\d.])') {
        Add-Error '个人路由配置仍含私网 IP 地址'
    }
}

$publicIndex = Join-Path $BlogDir 'public\index.html'
if (Test-Path -LiteralPath (Join-Path $BlogDir 'public')) {
    if (-not (Test-Path -LiteralPath $publicIndex -PathType Leaf)) { Add-Error 'public 目录存在，但缺少首页 index.html' }
    foreach ($required in @('public\siyuan\index.html', 'public\archives\index.html', 'public\js\site-shell.js', 'public\js\siyuan-knowledge.js', 'public\css\siyuan-knowledge.css')) {
        if (-not (Test-Path -LiteralPath (Join-Path $BlogDir $required) -PathType Leaf)) { Add-Error "构建产物缺失：$required" }
    }
    $privatePublicRoot = Join-Path $BlogDir 'public\siyuan\能力体系'
    if (Test-Path -LiteralPath $privatePublicRoot) {
        Add-Error "构建产物包含永久私密目录：$privatePublicRoot"
    }
}

Write-Host "[检查] 页面 $($pages.Count)，错误 $($Errors.Count)，警告 $($Warnings.Count)" -ForegroundColor Cyan
$Warnings | Select-Object -Unique | ForEach-Object { Write-Host "[警告] $_" -ForegroundColor Yellow }
$Errors | Select-Object -Unique | ForEach-Object { Write-Host "[错误] $_" -ForegroundColor Red }

if ($Errors.Count -or ($Strict -and $Warnings.Count)) { exit 1 }
Write-Host '[通过] 知识库结构与关键安全检查通过' -ForegroundColor Green
