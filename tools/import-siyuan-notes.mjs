#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultBlogDir = path.dirname(scriptDir);
const DEFAULT_DATE = '2026-08-31T00:00:00+08:00';
const PRIVATE_DOCUMENT_ROOTS = ['能力体系'];
const PRIVATE_DOCUMENT_TITLES = new Set(['能力体系', '能力评估', '能力规划', '学习方法论'].map(key));
const BLOCK_ID_PATTERN = String.raw`\d{14}-[a-z0-9]{7}`;

function key(value) {
  return String(value).trim().toLocaleLowerCase('zh-CN');
}

function parseArgs(argv) {
  const options = {
    blogDir: defaultBlogDir,
    sourceDir: '',
    notebookTitle: '',
    privateValuesFile: '',
    excludeDailyNote: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`参数 ${arg} 缺少值`);
      return argv[index];
    };
    if (arg === '--blog') options.blogDir = next();
    else if (arg === '--source') options.sourceDir = next();
    else if (arg === '--notebook-title') options.notebookTitle = next().trim();
    else if (arg === '--private-values') options.privateValuesFile = next();
    else if (arg === '--exclude-daily-note') options.excludeDailyNote = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`未知参数：${arg}`);
  }

  options.blogDir = path.resolve(options.blogDir);
  options.sourceDir = path.resolve(options.sourceDir || path.join(options.blogDir, 'origin', '学习笔记.md'));
  options.privateValuesFile = path.resolve(
    options.privateValuesFile || path.join(options.blogDir, 'tools', 'siyuan-private-values.txt'),
  );
  return options;
}

function printHelp() {
  console.log(`用法：node tools/import-siyuan-notes.mjs [选项]

  --blog <目录>             Hexo 项目目录，默认自动取脚本所在项目
  --source <目录>           思源 Markdown 导出目录
  --notebook-title <名称>   笔记本名称；自动化临时导出时必须显式传入
  --private-values <文件>   自定义隐私值列表
  --exclude-daily-note      排除 daily note
  --dry-run                 只扫描和转换，不写入文件`);
}

async function exists(target, type = null) {
  try {
    const stat = await fs.stat(target);
    if (type === 'file') return stat.isFile();
    if (type === 'directory') return stat.isDirectory();
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function walkFiles(root, predicate = () => true) {
  const results = [];
  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else if (entry.isFile() && predicate(fullPath)) results.push(fullPath);
    }
  }
  await visit(root);
  return results;
}

function unixRelative(base, target) {
  return path.relative(base, target).split(path.sep).join('/');
}

function stripOuterAngles(value) {
  const trimmed = value.trim();
  return trimmed.startsWith('<') && trimmed.endsWith('>') ? trimmed.slice(1, -1) : trimmed;
}

function decodeTarget(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getSlug(value) {
  return value
    .trim()
    .replace(/[\s\u00a0]+/gu, '-')
    .replace(/[<>:"/\\|?*#%]/gu, '-')
    .replace(/-{2,}/gu, '-')
    .replace(/^[-.]+|[-.]+$/gu, '');
}

function escapeYaml(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseFrontMatter(text) {
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/u);
  if (!match) return { raw: '', body: text, fields: {} };
  const fields = {};
  for (const line of match[1].split(/\r?\n/u)) {
    const field = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*?)\s*$/u);
    if (!field) continue;
    fields[field[1].toLowerCase()] = field[2].trim().replace(/^(['"])([\s\S]*)\1$/u, '$2');
  }
  return { raw: match[1], body: text.slice(match[0].length), fields };
}

function isPrivateRelative(relative) {
  const normalized = relative.replaceAll('\\', '/').replace(/^\/+/, '');
  const normalizedKey = key(normalized);
  return PRIVATE_DOCUMENT_ROOTS.some((root) => {
    const rootKey = key(root);
    return normalizedKey === `${rootKey}.md` || normalizedKey.startsWith(`${rootKey}/`);
  });
}

function isPrivateTitle(title) {
  return PRIVATE_DOCUMENT_TITLES.has(key(title));
}

function isPathInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function normalizeSourceTarget(sourceDir, currentFile, target) {
  const decoded = decodeTarget(target).replaceAll('\\', path.sep).replaceAll('/', path.sep);
  const candidate = /^[\\/]/u.test(target)
    ? path.resolve(sourceDir, decoded.replace(/^[\\/]+/u, ''))
    : path.resolve(path.dirname(currentFile), decoded);
  return unixRelative(sourceDir, candidate);
}

function resolveAssetTarget(sourceDir, currentFile, target) {
  const decoded = decodeTarget(target).replaceAll('\\', path.sep).replaceAll('/', path.sep);
  const candidate = /^[\\/]/u.test(target)
    ? path.resolve(sourceDir, decoded.replace(/^[\\/]+/u, ''))
    : path.resolve(path.dirname(currentFile), decoded);
  const sourceRelative = unixRelative(sourceDir, candidate);
  const segments = sourceRelative.split('/');
  let assetIndex = -1;
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    if (key(segments[index]) === 'assets') {
      assetIndex = index;
      break;
    }
  }
  if (assetIndex < 0) return null;
  const outputParts = [...segments.slice(0, assetIndex), ...segments.slice(assetIndex + 1)];
  if (!outputParts.length || outputParts.some((part) => part === '..')) return null;
  return {
    source: candidate,
    relative: outputParts.join('/'),
    urlRelative: outputParts.map((part) => encodeURIComponent(part)).join('/'),
  };
}

function getAnchor(target) {
  const hash = target.match(/#([^#]+)$/u);
  if (hash) return `#${hash[1]}`;
  const block = target.match(new RegExp(`^siyuan://blocks/(${BLOCK_ID_PATTERN})`, 'iu'));
  return block ? `#${block[1]}` : '';
}

function uniqueSortedDocuments(documents) {
  const seen = new Set();
  return documents
    .filter((doc) => {
      const id = key(doc.relative);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'zh-CN', { numeric: true }));
}

async function replaceDirectory(staged, target) {
  const backup = `${target}.previous-${process.pid}`;
  await fs.rm(backup, { recursive: true, force: true });
  const hadTarget = await exists(target, 'directory');
  if (hadTarget) await fs.rename(target, backup);
  try {
    await fs.rename(staged, target);
    await fs.rm(backup, { recursive: true, force: true });
  } catch (error) {
    await fs.rm(target, { recursive: true, force: true });
    if (hadTarget && await exists(backup, 'directory')) await fs.rename(backup, target);
    throw error;
  }
}

async function atomicWrite(target, content) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}`;
  await fs.writeFile(temporary, content, 'utf8');
  await fs.rename(temporary, target);
}

function reportTime() {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(new Date());
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!await exists(path.join(options.blogDir, '_config.yml'), 'file')) {
    throw new Error(`目标不是有效的 Hexo 项目：${options.blogDir}`);
  }
  if (!await exists(options.sourceDir, 'directory')) {
    throw new Error(`找不到思源导出目录：${options.sourceDir}`);
  }

  const warnings = [];
  const fatalIssues = [];
  const privateValues = [];
  const referencedAssets = new Map();
  const excludedDocuments = [];
  const privateBlockIds = new Set();
  let redactionCount = 0;

  if (await exists(options.privateValuesFile, 'file')) {
    const lines = (await fs.readFile(options.privateValuesFile, 'utf8')).split(/\r?\n/u);
    for (const line of lines) {
      const value = line.trim();
      if (value && !value.startsWith('#')) privateValues.push(value);
    }
    console.log(`[隐私] 已载入 ${privateValues.length} 条自定义隐藏值`);
  }

  function replaceSensitive(text, expression, replacement) {
    return text.replace(expression, (...args) => {
      redactionCount += 1;
      return typeof replacement === 'function' ? replacement(...args) : replacement;
    });
  }

  function protectPersonalInformation(doc, input) {
    let text = input;
    const isPersonalRouterRecord = key(doc.relative) === key('其他笔记/计算机网络/个人路由配置记录.md');
    const isZeroTierDocument = /zerotier/iu.test(doc.relative) || /zerotier/iu.test(doc.title);

    if (isPersonalRouterRecord) {
      text = replaceSensitive(
        text,
        /^(\|\s*(?:管理账户|管理密码|WiFi\s*名称|WiFi\s*密码)\s*\|\s*)`[^`]*`(\s*\|)/gimu,
        (_match, prefix, suffix) => `${prefix}\`[已隐藏]\`${suffix}`,
      );
      text = replaceSensitive(text, /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?(?![\d.])/gu, '[已隐藏 IP 地址]');
      text = replaceSensitive(text, /\b[0-9a-f]{10}\b/giu, '[已隐藏设备 ID]');
      text = replaceSensitive(text, /\b[0-9a-f]{16}\b/giu, '[已隐藏 Network ID]');
    } else if (isZeroTierDocument) {
      text = replaceSensitive(text, /\b[0-9a-f]{16}\b/giu, '[已隐藏 Network ID]');
    }

    text = replaceSensitive(
      text,
      /\[[^\]\r\n]+@(?:\d{1,3}\.){3}\d{1,3}\]\(mailto:[^)]+\)/giu,
      '[已隐藏 SSH 地址]',
    );
    text = replaceSensitive(text, /\b[A-Z0-9._%+-]+@(?:\d{1,3}\.){3}\d{1,3}\b/giu, '[已隐藏 SSH 地址]');

    text = text.replace(/\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/giu, (match, domain) => {
      if (domain.toLowerCase() === 'example.com') return match;
      redactionCount += 1;
      return '[已隐藏邮箱]';
    });

    for (const value of privateValues) {
      text = replaceSensitive(text, new RegExp(escapeRegExp(value), 'giu'), '[已隐藏]');
    }
    return text;
  }

  const notebookTitle = options.notebookTitle || path.basename(options.sourceDir, path.extname(options.sourceDir));
  const outputRoot = path.join(options.blogDir, 'source', 'siyuan');
  const assetOutput = path.join(options.blogDir, 'source', 'images', 'siyuan');
  const dataOutput = path.join(options.blogDir, 'source', 'js', 'siyuan-data.js');
  const reportOutput = path.join(options.blogDir, 'siyuan-import-report.txt');
  const documents = [];
  const byRelative = new Map();
  const byTitle = new Map();
  const blockIndex = new Map();

  console.log(`[扫描] ${options.sourceDir}`);
  const markdownFiles = await walkFiles(options.sourceDir, (file) => file.toLowerCase().endsWith('.md'));
  for (const sourcePath of markdownFiles) {
    const relative = unixRelative(options.sourceDir, sourcePath);
    const sourceText = await fs.readFile(sourcePath, 'utf8');
    if (isPrivateRelative(relative)) {
      excludedDocuments.push(relative);
      const privateFront = parseFrontMatter(sourceText);
      PRIVATE_DOCUMENT_TITLES.add(key(privateFront.fields.title || path.basename(sourcePath, path.extname(sourcePath))));
      for (const match of sourceText.matchAll(new RegExp(`\\b(${BLOCK_ID_PATTERN})\\b`, 'giu'))) {
        privateBlockIds.add(key(match[1]));
      }
      continue;
    }

    const segments = relative.split('/');
    const isDaily = key(segments[0]) === 'daily note' || key(relative) === 'daily note.md';
    if (options.excludeDailyNote && isDaily) continue;
    const front = parseFrontMatter(sourceText);
    const baseName = path.basename(sourcePath, path.extname(sourcePath));
    const title = front.fields.title || baseName;
    const date = front.fields.date || DEFAULT_DATE;
    const updated = front.fields.lastmod || front.fields.updated || date;
    const parts = segments.slice(0, -1).map(getSlug);
    const isNotebookRoot = segments.length === 1 && baseName === notebookTitle;
    if (!isNotebookRoot) parts.push(getSlug(baseName));
    const url = parts.length ? `/siyuan/${parts.join('/')}/` : '/siyuan/';
    const doc = {
      sourcePath,
      relative,
      title,
      baseName,
      body: front.body,
      date,
      updated,
      url,
      parts,
      isDaily,
      tags: new Set(),
      outgoing: new Set(),
      convertedBody: '',
    };
    documents.push(doc);
    if (byRelative.has(key(relative))) fatalIssues.push(`源路径大小写冲突：${byRelative.get(key(relative)).relative} <-> ${relative}`);
    else byRelative.set(key(relative), doc);
    const titleKey = key(title);
    if (!byTitle.has(titleKey)) byTitle.set(titleKey, []);
    byTitle.get(titleKey).push(doc);
    for (const match of front.body.matchAll(new RegExp(`\\bid=["'](${BLOCK_ID_PATTERN})["']`, 'giu'))) {
      if (!blockIndex.has(key(match[1]))) blockIndex.set(key(match[1]), doc);
    }
  }

  if (excludedDocuments.length) {
    console.log(`[隐私] 已永久排除 ${excludedDocuments.length} 篇私密文档及其页面、目录和引用关系`);
  }

  const routeIndex = new Map();
  for (const doc of documents) {
    const routeKey = key(doc.url);
    if (routeIndex.has(routeKey)) fatalIssues.push(`页面路径冲突：${routeIndex.get(routeKey).relative} <-> ${doc.relative} -> ${doc.url}`);
    else routeIndex.set(routeKey, doc);
    if (!doc.parts.every(Boolean)) fatalIssues.push(`页面路径包含空 slug：${doc.relative}`);
  }

  function resolveDocument(current, target) {
    if (!target?.trim()) return null;
    const clean = stripOuterAngles(target);
    if (/^(?:https?:|mailto:|tel:|data:|javascript:)/iu.test(clean)) return null;
    const block = clean.match(new RegExp(`^siyuan://blocks/(${BLOCK_ID_PATTERN})`, 'iu'));
    if (block) return blockIndex.get(key(block[1])) || null;
    const pathOnly = clean.split('#', 1)[0];
    if (!pathOnly || !/\.md$/iu.test(pathOnly)) return null;
    return byRelative.get(key(normalizeSourceTarget(options.sourceDir, current.sourcePath, pathOnly))) || null;
  }

  console.log(`[转换] ${documents.length} 篇文档`);
  for (const doc of documents) {
    let body = protectPersonalInformation(doc, doc.body);
    const codeFragments = [];
    const protectCode = (match) => {
      const token = `\uE000SIYUAN_CODE_${codeFragments.length}\uE001`;
      codeFragments.push(match);
      return token;
    };
    body = body.replace(/^(```|~~~)[^\r\n]*\r?\n[\s\S]*?^\1[ \t]*$/gmu, protectCode);
    body = body.replace(/`[^`\r\n]+`/gu, protectCode);

    const titlePattern = new RegExp(`^(?:[ \\t]*#[ \\t]+${escapeRegExp(doc.title.trim())}[ \\t]*\\r?\\n)+`, 'u');
    body = body.replace(titlePattern, '');

    for (const match of body.matchAll(/^\s*#\s+([^#\r\n]+?)\s+#\s*$/gmu)) doc.tags.add(match[1].trim());
    body = body.replace(/^\s*#\s+([^#\r\n]+?)\s+#\s*$/gmu, '');

    body = body.replace(/!\[([^\]]*)\]\(([^)]+)\)/gu, (original, alt, rawTarget) => {
      const target = stripOuterAngles(rawTarget);
      const plainTarget = target.split(/\s+["']/u, 1)[0];
      if (/^(?:https?:|data:)/iu.test(plainTarget)) return original;
      const asset = resolveAssetTarget(options.sourceDir, doc.sourcePath, plainTarget);
      if (!asset) return original;
      const assetKey = key(asset.relative);
      const existing = referencedAssets.get(assetKey);
      if (existing && existing.source !== asset.source) fatalIssues.push(`资源输出路径冲突：${existing.source} <-> ${asset.source}`);
      else referencedAssets.set(assetKey, asset);
      return `![${alt}](/images/siyuan/${asset.urlRelative})`;
    });

    body = body.replace(/(?<!!)\[([^\]]+)\]\(([^)]+)\)/gu, (original, label, rawTarget) => {
      const target = stripOuterAngles(rawTarget);
      if (target.startsWith('#')) return original;
      if (/^(?:javascript:|vbscript:|data:)/iu.test(target)) {
        warnings.push(`已移除危险链接：${doc.relative} -> ${target.split(':', 1)[0]}:`);
        return label;
      }
      const pathOnly = target.split('#', 1)[0];
      if (/\.md$/iu.test(pathOnly)) {
        const relativeTarget = normalizeSourceTarget(options.sourceDir, doc.sourcePath, pathOnly);
        if (isPrivateRelative(relativeTarget)) {
          warnings.push(`已移除指向私密文档的链接：${doc.relative}`);
          return label;
        }
      }
      const block = target.match(new RegExp(`^siyuan://blocks/(${BLOCK_ID_PATTERN})`, 'iu'));
      if (block && privateBlockIds.has(key(block[1]))) {
        warnings.push(`已移除指向私密文档块的链接：${doc.relative}`);
        return label;
      }
      const resolved = resolveDocument(doc, target);
      if (resolved) {
        doc.outgoing.add(resolved.relative);
        return `[${label}](${resolved.url}${getAnchor(target)})`;
      }
      if (/^siyuan:\/\/blocks\//iu.test(target)) {
        warnings.push(`无法解析思源块链接：${doc.relative} -> ${target}`);
        return label;
      }
      if (/\.md(?:#|$)/iu.test(target)) warnings.push(`找不到引用目标：${doc.relative} -> ${target}`);
      return original;
    });

    body = body.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/gu, (_original, rawTarget, rawLabel) => {
      const targetName = rawTarget.trim();
      const label = rawLabel ? rawLabel.trim() : targetName;
      if (isPrivateTitle(targetName)) {
        warnings.push(`已移除指向私密文档的双链：${doc.relative}`);
        return label;
      }
      const candidates = byTitle.get(key(targetName));
      if (candidates?.length === 1) {
        doc.outgoing.add(candidates[0].relative);
        return `[${label}](${candidates[0].url})`;
      }
      warnings.push(`无法唯一解析双链：${doc.relative} -> [[${targetName}]]`);
      return label;
    });

    // SiYuan may export block references as ((block-id "display text")).
    body = body.replace(
      // SiYuan normally emits ((id "label")), but older/malformed exports can
      // occasionally lose the final ')'. Accept both forms so no dead block
      // syntax leaks into the published Markdown. Fenced/inline code has
      // already been protected before this replacement runs.
      new RegExp(`\\(\\((${BLOCK_ID_PATTERN})(?:\\s+["']([^"']+)["'])?\\)\\)?`, 'giu'),
      (_original, id, rawLabel) => {
        const label = rawLabel?.trim() || id;
        if (privateBlockIds.has(key(id))) {
          warnings.push(`已移除指向私密文档块的引用：${doc.relative}`);
          return '[私密文档]';
        }
        const targetDoc = blockIndex.get(key(id));
        if (targetDoc) {
          doc.outgoing.add(targetDoc.relative);
          return `[${label}](${targetDoc.url}#${id})`;
        }
        const titleCandidates = byTitle.get(key(label));
        if (titleCandidates?.length === 1) {
          doc.outgoing.add(titleCandidates[0].relative);
          return `[${label}](${titleCandidates[0].url})`;
        }
        warnings.push(`无法解析思源块引用：${doc.relative} -> ${id}`);
        return label;
      },
    );

    body = body.replace(new RegExp(`siyuan://blocks/(${BLOCK_ID_PATTERN})`, 'giu'), (_original, id) => {
      if (privateBlockIds.has(key(id))) {
        warnings.push(`已移除指向私密文档块的裸链接：${doc.relative}`);
        return '[私密文档]';
      }
      const targetDoc = blockIndex.get(key(id));
      if (targetDoc) return `${targetDoc.url}#${id}`;
      warnings.push(`无法解析裸块链接：${doc.relative} -> ${id}`);
      return id;
    });

    body = body.replace(
      new RegExp(`<span\\s+id=["'](${BLOCK_ID_PATTERN})["']\\s+style=["']display:\\s*none;?["']\\s*>\\s*</span>`, 'giu'),
      '<span id="$1" class="siyuan-block-anchor" aria-hidden="true"></span>',
    );

    body = body.replace(/\uE000SIYUAN_CODE_(\d+)\uE001/gu, (_match, index) => codeFragments[Number(index)]);
    doc.convertedBody = body.trim();
  }

  const sourceRealPath = await fs.realpath(options.sourceDir);
  for (const asset of referencedAssets.values()) {
    if (!await exists(asset.source, 'file')) {
      warnings.push(`缺失资源：${asset.source}`);
      continue;
    }
    const assetRealPath = await fs.realpath(asset.source);
    if (!isPathInside(sourceRealPath, assetRealPath)) fatalIssues.push(`资源路径越界：${asset.source}`);
  }

  if (fatalIssues.length) {
    for (const issue of [...new Set(fatalIssues)]) console.error(`[错误] ${issue}`);
    throw new Error(`导入前检查失败，共 ${new Set(fatalIssues).size} 项`);
  }
  const uniqueWarnings = [...new Set(warnings)];

  const incoming = new Map(documents.map((doc) => [doc.relative, []]));
  for (const doc of documents) {
    for (const relative of doc.outgoing) {
      if (relative !== doc.relative && incoming.has(relative)) incoming.get(relative).push(doc);
    }
  }

  function categoriesFor(doc) {
    const categories = [notebookTitle, ...doc.relative.split('/').slice(0, -1)];
    if (!doc.relative.includes('/') && doc.baseName !== notebookTitle) categories.push(doc.baseName);
    return [...new Set(categories)];
  }

  if (!options.dryRun) {
    console.log('[写入] 原子重建知识库专用目录');
    const stagingRoot = await fs.mkdtemp(path.join(options.blogDir, '.siyuan-import-'));
    const stagedKnowledge = path.join(stagingRoot, 'knowledge');
    const stagedAssets = path.join(stagingRoot, 'assets');
    await fs.mkdir(stagedKnowledge, { recursive: true });
    await fs.mkdir(stagedAssets, { recursive: true });
    try {
      for (const asset of referencedAssets.values()) {
        if (!await exists(asset.source, 'file')) continue;
        const destination = path.join(stagedAssets, ...asset.relative.split('/'));
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.copyFile(asset.source, destination);
      }

      for (const doc of documents) {
        const yaml = [
          '---',
          `title: ${escapeYaml(doc.title)}`,
          `date: ${escapeYaml(doc.date)}`,
          `updated: ${escapeYaml(doc.updated)}`,
          'layout: page',
          'type: siyuan-note',
          `notebook: ${escapeYaml(notebookTitle)}`,
          `permalink: ${escapeYaml(doc.url.replace(/^\//u, ''))}`,
          `siyuan_source: ${escapeYaml(doc.relative)}`,
          'comments: false',
          'categories:',
          ...categoriesFor(doc).map((category) => `  - ${escapeYaml(category)}`),
        ];
        if (doc.tags.size) {
          yaml.push('tags:', ...[...doc.tags].sort((a, b) => a.localeCompare(b, 'zh-CN')).map((tag) => `  - ${escapeYaml(tag)}`));
        }
        yaml.push('---');

        const references = [];
        const outgoingDocs = uniqueSortedDocuments(
          [...doc.outgoing].map((relative) => byRelative.get(key(relative))).filter(Boolean),
        );
        const incomingDocs = uniqueSortedDocuments(incoming.get(doc.relative));
        if (outgoingDocs.length || incomingDocs.length) {
          references.push('', '<section class="siyuan-references" aria-label="文档引用">', '', '## 文档关系');
          if (outgoingDocs.length) {
            references.push('', '### 本文引用', ...outgoingDocs.map((item) => `- [${item.title}](${item.url})`));
          }
          if (incomingDocs.length) {
            references.push('', '### 反向引用', ...incomingDocs.map((item) => `- [${item.title}](${item.url})`));
          }
          references.push('', '</section>');
        }
        const target = path.join(stagedKnowledge, ...doc.parts, 'index.md');
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, `${yaml.join('\n')}\n\n${doc.convertedBody}\n${references.join('\n')}\n`, 'utf8');
      }

      const articleRoot = path.join(options.blogDir, 'source', '_posts');
      const articleCount = await exists(articleRoot, 'directory')
        ? (await walkFiles(articleRoot, (file) => file.toLowerCase().endsWith('.md'))).length
        : 0;
      const payload = {
        notebook: notebookTitle,
        generatedAt: documents.map((doc) => doc.updated).sort().at(-1) || null,
        articleCount,
        documents: documents.map((doc) => ({
          title: doc.title,
          url: doc.url,
          parts: doc.parts,
          daily: doc.isDaily,
        })),
      };
      const report = [
        `思源知识库导入报告 - ${reportTime()}`,
        `源目录：${options.sourceDir}`,
        `文档数量：${documents.length}`,
        `永久排除私密文档：${excludedDocuments.length} 篇`,
        `引用资源数量：${referencedAssets.size}`,
        `警告数量：${uniqueWarnings.length}`,
        `隐私脱敏：${redactionCount} 处`,
        '',
        ...uniqueWarnings.map((warning) => `- ${warning}`),
      ].join('\n');

      await replaceDirectory(stagedKnowledge, outputRoot);
      await replaceDirectory(stagedAssets, assetOutput);
      await atomicWrite(dataOutput, `window.SiyuanKnowledgeData = ${JSON.stringify(payload)};\n`);
      await atomicWrite(reportOutput, report);
    } finally {
      await fs.rm(stagingRoot, { recursive: true, force: true });
    }
  }

  console.log(`[完成] 文档 ${documents.length}，私密排除 ${excludedDocuments.length}，资源 ${referencedAssets.size}，脱敏 ${redactionCount}，警告 ${uniqueWarnings.length}`);
  if (options.dryRun) console.log('[预演] 未写入任何文件');
  for (const warning of uniqueWarnings) console.warn(`[警告] ${warning}`);
  if (!options.dryRun && uniqueWarnings.length) console.log(`查看报告：${reportOutput}`);
}

main().catch((error) => {
  console.error(`[失败] ${error.stack || error.message}`);
  process.exitCode = 1;
});
