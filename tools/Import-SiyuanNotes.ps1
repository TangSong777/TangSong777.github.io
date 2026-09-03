<#
.SYNOPSIS
  将思源导出的“学习笔记”转换为 Hexo + NexT 的独立知识库。

.DESCRIPTION
  - 普通博客 source/_posts 不会被修改。
  - 知识库生成到 source/siyuan/**/index.md，不进入首页时间线。
  - 资源生成到 source/images/siyuan。
  - 自动生成全文档树、正向引用、反向引用和块锚点链接。
  - 重复运行只重建上述思源专用目录和数据文件。

.EXAMPLE
  cd D:\WorkSpace\MyServer\MyBlog
  powershell -ExecutionPolicy Bypass -File .\tools\Import-SiyuanNotes.ps1
  npx hexo clean
  npx hexo generate
  npx hexo server
#>
[CmdletBinding()]
param(
    [string]$SourceDir = '',
    [string]$BlogDir = 'D:\WorkSpace\MyServer\MyBlog',
    [string]$PrivateValuesFile = '',
    [bool]$ExcludeDailyNote = $false,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$Warnings = [System.Collections.Generic.List[string]]::new()
$script:RedactionCount = 0
$PrivateValues = [System.Collections.Generic.List[string]]::new()
$ReferencedAssets = @{}

function Write-Utf8NoBom([string]$Path, [string]$Text) {
    $parent = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $parent)) {
        [void](New-Item -ItemType Directory -Path $parent -Force)
    }
    [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

function Get-RelativeUnixPath([string]$Base, [string]$Path) {
    # Windows PowerShell 5 uses .NET Framework, which has no Path.GetRelativePath.
    $basePath = [System.IO.Path]::GetFullPath($Base).TrimEnd('\') + '\'
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $baseUri = [System.Uri]::new($basePath)
    $pathUri = [System.Uri]::new($fullPath)
    return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($pathUri).ToString()).Replace('\', '/')
}

function Get-Slug([string]$Value) {
    $slug = $Value.Trim()
    $slug = $slug -replace '[\s\u00A0]+', '-'
    $slug = $slug -replace '[<>:"/\\|?*#%]', '-'
    $slug = $slug -replace '-{2,}', '-'
    return $slug.Trim('-', '.')
}

function Escape-Yaml([string]$Value) {
    return "'" + ($Value -replace "'", "''") + "'"
}

function Replace-SensitiveValue([string]$Text, [string]$Pattern, [string]$Replacement) {
    return [regex]::Replace($Text, $Pattern, {
        param($m)
        $script:RedactionCount++
        if ($Replacement -match '\$\{') {
            return $m.Result($Replacement)
        }
        return $Replacement
    })
}

function Protect-PersonalInformation([object]$Doc, [string]$Text) {
    $isPersonalRouterRecord = $Doc.Relative -ieq '其他笔记/计算机网络/个人路由配置记录.md'
    $isZeroTierDocument = $Doc.Relative -match '(?i)zerotier' -or $Doc.Title -match '(?i)zerotier'

    if ($isPersonalRouterRecord) {
        # Preserve table labels while removing credentials and personally identifying WLAN values.
        $Text = Replace-SensitiveValue $Text '(?im)^(\|\s*(?:管理账户|管理密码|WiFi\s*名称|WiFi\s*密码)\s*\|\s*)`[^`]*`(\s*\|)' '${1}`[已隐藏]`${2}'
        # Home LAN topology and assigned addresses.
        $Text = Replace-SensitiveValue $Text '(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?:/\d{1,2})?(?![\d.])' '[已隐藏 IP 地址]'
        # ZeroTier node IDs are 10 hex characters; network IDs are 16.
        $Text = Replace-SensitiveValue $Text '(?i)\b[0-9a-f]{10}\b' '[已隐藏设备 ID]'
        $Text = Replace-SensitiveValue $Text '(?i)\b[0-9a-f]{16}\b' '[已隐藏 Network ID]'
    } elseif ($isZeroTierDocument) {
        # A 16-hex token in ZeroTier documentation is a Network ID, even when copied into commands.
        $Text = Replace-SensitiveValue $Text '(?i)\b[0-9a-f]{16}\b' '[已隐藏 Network ID]'
    }

    # Keep RFC example addresses useful in tutorials, hide real-looking email addresses.
    $Text = [regex]::Replace($Text, '(?i)\b[A-Z0-9._%+-]+@(?<domain>[A-Z0-9.-]+\.[A-Z]{2,})\b', {
        param($m)
        if ($m.Groups['domain'].Value -ieq 'example.com') { return $m.Value }
        $script:RedactionCount++
        return '[已隐藏邮箱]'
    })

    # Optional user-maintained literal denylist. The real file is ignored by Git.
    foreach ($value in $PrivateValues) {
        $Text = Replace-SensitiveValue $Text ([regex]::Escape($value)) '[已隐藏]'
    }

    return $Text
}

function Get-FrontMatter([string]$Text) {
    $result = [ordered]@{ Raw = ''; Body = $Text; Fields = @{} }
    if ($Text -match '(?s)\A---\s*\r?\n(?<yaml>.*?)\r?\n---\s*\r?\n?') {
        $result.Raw = $Matches.yaml
        $result.Body = $Text.Substring($Matches[0].Length)
        foreach ($line in ($Matches.yaml -split '\r?\n')) {
            if ($line -match '^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*?)\s*$') {
                $value = $Matches[2].Trim().Trim("'").Trim('"')
                $result.Fields[$Matches[1].ToLowerInvariant()] = $value
            }
        }
    }
    return $result
}

function Normalize-SourceTarget([string]$CurrentFile, [string]$Target) {
    try {
        $decoded = [System.Uri]::UnescapeDataString($Target.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
        if ($decoded.StartsWith('\') -or $decoded.StartsWith('/')) {
            $candidate = Join-Path $SourceDir $decoded.TrimStart('\', '/')
        } else {
            $candidate = Join-Path (Split-Path -Parent $CurrentFile) $decoded
        }
        return Get-RelativeUnixPath $SourceDir ([System.IO.Path]::GetFullPath($candidate))
    } catch {
        return $null
    }
}

function Resolve-AssetTarget([string]$CurrentFile, [string]$Target) {
    try {
        $decoded = [System.Uri]::UnescapeDataString($Target.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
        if ($decoded.StartsWith('\') -or $decoded.StartsWith('/')) {
            $candidate = Join-Path $SourceDir $decoded.TrimStart('\', '/')
        } else {
            $candidate = Join-Path (Split-Path -Parent $CurrentFile) $decoded
        }
        $fullPath = [System.IO.Path]::GetFullPath($candidate)
        $sourceRelative = Get-RelativeUnixPath $SourceDir $fullPath
        $segments = @($sourceRelative -split '/')
        $assetIndex = -1
        for ($i = $segments.Count - 1; $i -ge 0; $i--) {
            if ($segments[$i] -ieq 'assets') { $assetIndex = $i; break }
        }
        if ($assetIndex -lt 0) { return $null }

        $outputParts = [System.Collections.Generic.List[string]]::new()
        for ($i = 0; $i -lt $assetIndex; $i++) { $outputParts.Add($segments[$i]) }
        for ($i = $assetIndex + 1; $i -lt $segments.Count; $i++) { $outputParts.Add($segments[$i]) }
        $outputRelative = ($outputParts -join '/')
        $urlRelative = (($outputParts | ForEach-Object { [System.Uri]::EscapeDataString($_) }) -join '/')
        return [pscustomobject]@{ Source = $fullPath; Relative = $outputRelative; UrlRelative = $urlRelative }
    } catch {
        return $null
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $BlogDir '_config.yml') -PathType Leaf)) {
    throw "目标不是有效的 Hexo 项目：$BlogDir"
}
if (-not $SourceDir) { $SourceDir = Join-Path $BlogDir 'origin\学习笔记.md' }
if (-not (Test-Path -LiteralPath $SourceDir -PathType Container)) {
    throw "找不到思源导出目录：$SourceDir"
}

if (-not $PrivateValuesFile) { $PrivateValuesFile = Join-Path $BlogDir 'tools\siyuan-private-values.txt' }
if (Test-Path -LiteralPath $PrivateValuesFile -PathType Leaf) {
    foreach ($line in [System.IO.File]::ReadAllLines($PrivateValuesFile)) {
        $value = $line.Trim()
        if ($value -and -not $value.StartsWith('#')) { $PrivateValues.Add($value) }
    }
    Write-Host "[隐私] 已载入 $($PrivateValues.Count) 条自定义隐藏值" -ForegroundColor Cyan
}

$NotebookTitle = [System.IO.Path]::GetFileNameWithoutExtension((Split-Path -Leaf $SourceDir))
$OutputRoot = Join-Path $BlogDir 'source\siyuan'
$AssetOutput = Join-Path $BlogDir 'source\images\siyuan'
$DataOutput = Join-Path $BlogDir 'source\js\siyuan-data.js'
$ReportOutput = Join-Path $BlogDir 'siyuan-import-report.txt'

$Documents = [System.Collections.Generic.List[object]]::new()
$ByRelative = @{}
$ByTitle = @{}
$BlockIndex = @{}

Write-Host "[扫描] $SourceDir" -ForegroundColor Cyan
foreach ($file in Get-ChildItem -LiteralPath $SourceDir -Recurse -File -Filter '*.md' | Sort-Object FullName) {
    $relative = Get-RelativeUnixPath $SourceDir $file.FullName
    $segments = $relative -split '/'
    $isDaily = $segments[0] -ieq 'daily note' -or $relative -ieq 'daily note.md'
    if ($ExcludeDailyNote -and $isDaily) { continue }

    $text = [System.IO.File]::ReadAllText($file.FullName)
    $front = Get-FrontMatter $text
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    $title = if ($front.Fields.title) { $front.Fields.title } else { $baseName }
    $date = if ($front.Fields.date) { $front.Fields.date } else { '2026-08-31T00:00:00+08:00' }
    $updated = if ($front.Fields.lastmod) { $front.Fields.lastmod } elseif ($front.Fields.updated) { $front.Fields.updated } else { $date }

    $pathParts = [System.Collections.Generic.List[string]]::new()
    for ($i = 0; $i -lt ($segments.Count - 1); $i++) { [void]$pathParts.Add((Get-Slug $segments[$i])) }
    $isNotebookRoot = ($segments.Count -eq 1 -and $baseName -eq $NotebookTitle)
    if (-not $isNotebookRoot) { [void]$pathParts.Add((Get-Slug $baseName)) }
    $urlTail = ($pathParts -join '/')
    $url = if ($urlTail) { "/siyuan/$urlTail/" } else { '/siyuan/' }
    $targetDir = if ($pathParts.Count) { Join-Path $OutputRoot ($pathParts -join '\') } else { $OutputRoot }

    $doc = [pscustomobject]@{
        SourcePath = $file.FullName
        Relative = $relative
        Title = $title
        BaseName = $baseName
        Body = $front.Body
        Date = $date
        Updated = $updated
        Url = $url
        Parts = @($pathParts)
        TargetPath = Join-Path $targetDir 'index.md'
        IsDaily = $isDaily
        Tags = [System.Collections.Generic.HashSet[string]]::new()
        Outgoing = [System.Collections.Generic.HashSet[string]]::new()
        ConvertedBody = ''
    }
    $Documents.Add($doc)
    $ByRelative[$relative.ToLowerInvariant()] = $doc
    if (-not $ByTitle.ContainsKey($title.ToLowerInvariant())) { $ByTitle[$title.ToLowerInvariant()] = [System.Collections.Generic.List[object]]::new() }
    $ByTitle[$title.ToLowerInvariant()].Add($doc)

    foreach ($m in [regex]::Matches($front.Body, '(?i)\bid=["''](?<id>\d{14}-[a-z0-9]{7})["'']')) {
        $id = $m.Groups['id'].Value
        if (-not $BlockIndex.ContainsKey($id)) { $BlockIndex[$id] = $doc }
    }
}

function Resolve-Document([object]$Current, [string]$Target) {
    if ([string]::IsNullOrWhiteSpace($Target)) { return $null }
    $clean = $Target.Trim().Trim('<', '>')
    if ($clean -match '^(?i)(https?:|mailto:|tel:|data:|javascript:)') { return $null }
    if ($clean -match '^siyuan://blocks/(?<id>\d{14}-[a-z0-9]{7})') {
        if ($BlockIndex.ContainsKey($Matches.id)) { return $BlockIndex[$Matches.id] }
        return $null
    }
    $pathOnly = ($clean -split '#', 2)[0]
    if (-not $pathOnly) { return $null }
    if ($pathOnly -notmatch '(?i)\.md$') { return $null }
    $relative = Normalize-SourceTarget $Current.SourcePath $pathOnly
    if ($relative -and $ByRelative.ContainsKey($relative.ToLowerInvariant())) { return $ByRelative[$relative.ToLowerInvariant()] }
    return $null
}

function Get-Anchor([string]$Target) {
    if ($Target -match '#(?<anchor>[^#]+)$') { return '#' + $Matches.anchor }
    if ($Target -match '^siyuan://blocks/(?<id>\d{14}-[a-z0-9]{7})') { return '#' + $Matches.id }
    return ''
}

Write-Host "[转换] $($Documents.Count) 篇文档" -ForegroundColor Cyan
foreach ($doc in $Documents) {
    $body = Protect-PersonalInformation $doc $doc.Body

    # Protect fenced and inline code before applying Markdown link transforms.
    $codeFragments = [System.Collections.Generic.List[string]]::new()
    $protectCode = {
        param($m)
        $index = $codeFragments.Count
        $codeFragments.Add($m.Value)
        return "@@SIYUAN_CODE_$index@@"
    }
    $body = [regex]::Replace($body, '(?ms)^(```|~~~).*?^\1\s*$', $protectCode)
    $body = [regex]::Replace($body, '`[^`\r\n]+`', $protectCode)

    # NexT 已显示页面标题，移除开头重复的同名 H1（包括连续重复）。
    $escapedTitle = [regex]::Escape($doc.Title.Trim())
    $body = [regex]::Replace($body, "(?m)\A(?:\s*#\s+$escapedTitle\s*\r?\n)+", '')

    # 提取思源的“# 标签 #”格式。
    foreach ($m in [regex]::Matches($body, '(?m)^\s*#\s+([^#\r\n]+?)\s+#\s*$')) {
        [void]$doc.Tags.Add($m.Groups[1].Value.Trim())
    }
    $body = [regex]::Replace($body, '(?m)^\s*#\s+([^#\r\n]+?)\s+#\s*$', '')

    # 图片统一指向公开资源目录，并保留 assets 下的相对子路径。
    $body = [regex]::Replace($body, '!\[(?<alt>[^\]]*)\]\((?<target>[^\)]+)\)', {
        param($m)
        $target = $m.Groups['target'].Value.Trim().Trim('<', '>')
        $plainTarget = ($target -split '\s+["'']', 2)[0]
        if ($plainTarget -match '^(?i)(https?:|data:)') { return $m.Value }
        $assetInfo = Resolve-AssetTarget $doc.SourcePath $plainTarget
        if ($assetInfo) {
            if (-not (Test-Path -LiteralPath $assetInfo.Source -PathType Leaf)) {
                $Warnings.Add("缺失资源：$($doc.Relative) -> $plainTarget")
            } else {
                $key = $assetInfo.Relative.ToLowerInvariant()
                if ($ReferencedAssets.ContainsKey($key) -and $ReferencedAssets[$key].Source -ne $assetInfo.Source) {
                    $Warnings.Add("资源输出路径冲突：$($ReferencedAssets[$key].Source) <-> $($assetInfo.Source)")
                } else {
                    $ReferencedAssets[$key] = $assetInfo
                }
            }
            return "![$($m.Groups['alt'].Value)](/images/siyuan/$($assetInfo.UrlRelative))"
        }
        return $m.Value
    })

    # Markdown 文档链接和 siyuan:// 块链接。
    $body = [regex]::Replace($body, '(?<!!)\[(?<label>[^\]]+)\]\((?<target>[^\)]+)\)', {
        param($m)
        $label = $m.Groups['label'].Value
        $target = $m.Groups['target'].Value.Trim().Trim('<', '>')
        if ($target.StartsWith('#')) { return $m.Value }
        $resolved = Resolve-Document $doc $target
        if ($resolved) {
            [void]$doc.Outgoing.Add($resolved.Relative)
            return "[$label]($($resolved.Url)$(Get-Anchor $target))"
        }
        if ($target -match '^siyuan://blocks/') {
            $Warnings.Add("无法解析思源块链接：$($doc.Relative) -> $target")
            return $label
        }
        if ($target -match '(?i)\.md(?:#|$)') {
            $Warnings.Add("找不到引用目标：$($doc.Relative) -> $target")
        }
        return $m.Value
    })

    # [[文档]] 和 [[目标|显示文字]]。
    $body = [regex]::Replace($body, '\[\[(?<target>[^\]|]+)(?:\|(?<label>[^\]]+))?\]\]', {
        param($m)
        $targetName = $m.Groups['target'].Value.Trim()
        $label = if ($m.Groups['label'].Success) { $m.Groups['label'].Value.Trim() } else { $targetName }
        $key = $targetName.ToLowerInvariant()
        if ($ByTitle.ContainsKey($key) -and $ByTitle[$key].Count -eq 1) {
            $resolved = $ByTitle[$key][0]
            [void]$doc.Outgoing.Add($resolved.Relative)
            return "[$label]($($resolved.Url))"
        }
        $Warnings.Add("无法唯一解析双链：$($doc.Relative) -> [[$targetName]]")
        return $label
    })

    # 清理残留的裸 siyuan://blocks 死链。
    $body = [regex]::Replace($body, 'siyuan://blocks/(?<id>\d{14}-[a-z0-9]{7})', {
        param($m)
        $id = $m.Groups['id'].Value
        if ($BlockIndex.ContainsKey($id)) { return $BlockIndex[$id].Url + '#' + $id }
        $Warnings.Add("无法解析裸块链接：$($doc.Relative) -> $id")
        return $id
    })

    # 思源把块锚点导出为 display:none；浏览器无法可靠滚动到无布局位置的元素。
    # 改为零尺寸但可定位的锚点，具体滚动和高亮由知识库脚本完成。
    $body = [regex]::Replace(
        $body,
        '(?i)<span\s+id=["''](?<id>\d{14}-[a-z0-9]{7})["'']\s+style=["'']display:\s*none;?["'']\s*>\s*</span>',
        '<span id="${id}" class="siyuan-block-anchor" aria-hidden="true"></span>'
    )

    # Restore code exactly as exported.
    $body = [regex]::Replace($body, '@@SIYUAN_CODE_(?<index>\d+)@@', {
        param($m)
        return $codeFragments[[int]$m.Groups['index'].Value]
    })
    $doc.ConvertedBody = $body.Trim()
}

$Incoming = @{}
foreach ($doc in $Documents) { $Incoming[$doc.Relative] = [System.Collections.Generic.List[object]]::new() }
foreach ($doc in $Documents) {
    foreach ($relative in $doc.Outgoing) {
        if ($Incoming.ContainsKey($relative) -and $relative -ne $doc.Relative) { $Incoming[$relative].Add($doc) }
    }
}

function Get-Categories([object]$Doc) {
    $items = [System.Collections.Generic.List[string]]::new()
    $items.Add($NotebookTitle)
    $relativeParts = $Doc.Relative -split '/'
    for ($i = 0; $i -lt ($relativeParts.Count - 1); $i++) { $items.Add($relativeParts[$i]) }
    if ($relativeParts.Count -eq 1 -and $Doc.BaseName -ne $NotebookTitle) { $items.Add($Doc.BaseName) }
    return $items | Select-Object -Unique
}

if (-not $DryRun) {
    Write-Host '[写入] 重建知识库专用目录' -ForegroundColor Cyan
    if (Test-Path -LiteralPath $OutputRoot) { Remove-Item -LiteralPath $OutputRoot -Recurse -Force }
    if (Test-Path -LiteralPath $AssetOutput) { Remove-Item -LiteralPath $AssetOutput -Recurse -Force }
    [void](New-Item -ItemType Directory -Path $OutputRoot -Force)

    [void](New-Item -ItemType Directory -Path $AssetOutput -Force)
    foreach ($asset in $ReferencedAssets.Values) {
        $destination = Join-Path $AssetOutput $asset.Relative.Replace('/', '\')
        $destinationParent = Split-Path -Parent $destination
        if (-not (Test-Path -LiteralPath $destinationParent)) {
            [void](New-Item -ItemType Directory -Path $destinationParent -Force)
        }
        Copy-Item -LiteralPath $asset.Source -Destination $destination -Force
    }

    foreach ($doc in $Documents) {
        $yaml = [System.Collections.Generic.List[string]]::new()
        $yaml.Add('---')
        $yaml.Add("title: $(Escape-Yaml $doc.Title)")
        $yaml.Add("date: $(Escape-Yaml $doc.Date)")
        $yaml.Add("updated: $(Escape-Yaml $doc.Updated)")
        $yaml.Add('layout: page')
        $yaml.Add('type: siyuan-note')
        $yaml.Add("notebook: $(Escape-Yaml $NotebookTitle)")
        $yaml.Add("permalink: $(Escape-Yaml $doc.Url.TrimStart('/'))")
        $yaml.Add("siyuan_source: $(Escape-Yaml $doc.Relative)")
        $yaml.Add('comments: false')
        $yaml.Add('categories:')
        foreach ($category in Get-Categories $doc) { $yaml.Add("  - $(Escape-Yaml $category)") }
        if ($doc.Tags.Count) {
            $yaml.Add('tags:')
            foreach ($tag in ($doc.Tags | Sort-Object)) { $yaml.Add("  - $(Escape-Yaml $tag)") }
        }
        $yaml.Add('---')

        $references = [System.Collections.Generic.List[string]]::new()
        $outDocs = @($doc.Outgoing | Where-Object { $ByRelative.ContainsKey($_.ToLowerInvariant()) } | ForEach-Object { $ByRelative[$_.ToLowerInvariant()] } | Sort-Object Title -Unique)
        $inDocs = @($Incoming[$doc.Relative] | Sort-Object Title -Unique)
        if ($outDocs.Count -or $inDocs.Count) {
            $references.Add('')
            $references.Add('<section class="siyuan-references" aria-label="文档引用">')
            $references.Add('')
            $references.Add('## 文档关系')
            if ($outDocs.Count) {
                $references.Add('')
                $references.Add('### 本文引用')
                foreach ($item in $outDocs) { $references.Add("- [$($item.Title)]($($item.Url))") }
            }
            if ($inDocs.Count) {
                $references.Add('')
                $references.Add('### 反向引用')
                foreach ($item in $inDocs) { $references.Add("- [$($item.Title)]($($item.Url))") }
            }
            $references.Add('')
            $references.Add('</section>')
        }

        $content = ($yaml -join "`n") + "`n`n" + $doc.ConvertedBody + "`n" + ($references -join "`n") + "`n"
        Write-Utf8NoBom $doc.TargetPath $content
    }

    # 浏览器端文档树数据。
    $treeItems = foreach ($doc in $Documents) {
        [ordered]@{ title = $doc.Title; url = $doc.Url; parts = @($doc.Parts); daily = $doc.IsDaily }
    }
    $articleRoot = Join-Path $BlogDir 'source\_posts'
    $articleCount = @(Get-ChildItem -LiteralPath $articleRoot -Recurse -File -Filter '*.md' -ErrorAction SilentlyContinue).Count
    $payload = [ordered]@{
        notebook = $NotebookTitle
        generatedAt = (Get-Date).ToString('o')
        articleCount = $articleCount
        documents = @($treeItems)
    } | ConvertTo-Json -Depth 8 -Compress
    Write-Utf8NoBom $DataOutput "window.SiyuanKnowledgeData = $payload;`n"

    $report = [System.Collections.Generic.List[string]]::new()
    $report.Add("思源知识库导入报告 - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
    $report.Add("源目录：$SourceDir")
    $report.Add("文档数量：$($Documents.Count)")
    $report.Add("引用资源数量：$($ReferencedAssets.Count)")
    $report.Add("警告数量：$($Warnings.Count)")
    $report.Add("隐私脱敏：$script:RedactionCount 处")
    $report.Add('')
    foreach ($warning in $Warnings) { $report.Add("- $warning") }
    Write-Utf8NoBom $ReportOutput ($report -join "`n")
}

Write-Host "[完成] 文档 $($Documents.Count)，警告 $($Warnings.Count)" -ForegroundColor Green
if ($DryRun) { Write-Host '[预演] 未写入任何文件' -ForegroundColor Yellow }
if ($Warnings.Count) { Write-Host "查看报告：$ReportOutput" -ForegroundColor Yellow }
