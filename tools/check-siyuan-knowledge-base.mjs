#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultBlogDir = path.dirname(scriptDir);
const PRIVATE_ROOT = '能力体系';
const PRIVATE_ROUTE_RAW = '/siyuan/能力体系/';
const PRIVATE_ROUTE_ENCODED = '/siyuan/%E8%83%BD%E5%8A%9B%E4%BD%93%E7%B3%BB/';

function key(value) {
  return String(value).trim().toLocaleLowerCase('zh-CN');
}

function parseArgs(argv) {
  const options = { blogDir: defaultBlogDir, strict: false, requirePublic: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--blog') {
      index += 1;
      if (index >= argv.length) throw Object.assign(new Error('--blog 缺少目录'), { exitCode: 2 });
      options.blogDir = argv[index];
    } else if (arg === '--strict') options.strict = true;
    else if (arg === '--require-public') options.requirePublic = true;
    else if (arg === '--source-only') options.requirePublic = false;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw Object.assign(new Error(`未知参数：${arg}`), { exitCode: 2 });
  }
  options.blogDir = path.resolve(options.blogDir);
  return options;
}

function printHelp() {
  console.log(`用法：node tools/check-siyuan-knowledge-base.mjs [选项]

  --blog <目录>       Hexo 项目目录
  --require-public    要求并检查 Hexo public 构建产物
  --source-only       只检查 source（默认）
  --strict            将普通警告也视为失败`);
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
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`发布扫描不接受符号链接：${fullPath}`);
      if (entry.isDirectory()) await visit(fullPath);
      else if (entry.isFile() && predicate(fullPath)) results.push(fullPath);
    }
  }
  await visit(root);
  return results.sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
}

function isPathInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function stripCodeAndFrontMatter(text) {
  let result = text.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/u, '');
  result = result.replace(/^(`{3,}|~{3,})[^\r\n]*\r?\n[\s\S]*?^\1[ \t]*$/gmu, '');
  result = result.replace(/(`+)([^\r\n]*?)\1/gu, '');
  return result;
}

function normalizeKnowledgeUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/siyuan/')) return null;
  const decoded = safeDecode(value.split('#', 1)[0]);
  if (decoded === null) return null;
  return `${decoded.replace(/\/+$/u, '')}/`;
}

function expectedPageForUrl(knowledgeRoot, url) {
  const normalized = normalizeKnowledgeUrl(url);
  if (!normalized) return null;
  const relative = normalized.slice('/siyuan/'.length).replace(/\/$/u, '');
  const candidate = path.resolve(knowledgeRoot, ...relative.split('/').filter(Boolean), 'index.md');
  return isPathInside(knowledgeRoot, candidate) ? candidate : null;
}

function scanHighRiskSecrets(text, file, addError) {
  const detectors = [
    ['私钥', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/iu],
    ['GitHub Token', /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/iu],
    ['AWS Access Key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u],
    ['疑似 API Bearer Token', /\b(?:Bearer|Token)\s+[A-Za-z0-9_.-]{32,}\b/iu],
    ['SSH 私网地址', /\b[A-Z0-9._%+-]+@(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)(?:\d{1,3}\.){1,2}\d{1,3}\b/iu],
  ];
  for (const [name, expression] of detectors) {
    if (expression.test(text)) addError(`${file} 命中高风险隐私检测器：${name}`);
  }
  for (const match of text.matchAll(/--accessAuthCode(?:=|\s+)([^\s"'`]+)/giu)) {
    const value = match[1];
    if (!/^(?:\[已隐藏\]|<[^>]+>|YOUR_|REPLACE_|示例|授权码)/iu.test(value)) {
      addError(`${file} 命中高风险隐私检测器：思源访问授权码`);
      break;
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const errors = [];
  const warnings = [];
  const addError = (message) => errors.push(message);
  const addWarning = (message) => warnings.push(message);
  const knowledgeRoot = path.join(options.blogDir, 'source', 'siyuan');
  const assetRoot = path.join(options.blogDir, 'source', 'images', 'siyuan');
  const dataPath = path.join(options.blogDir, 'source', 'js', 'siyuan-data.js');
  const privateKnowledgeRoot = path.join(knowledgeRoot, PRIVATE_ROOT);
  const publicRoot = path.join(options.blogDir, 'public');

  if (!await exists(knowledgeRoot, 'directory')) addError(`缺少知识库目录：${knowledgeRoot}`);
  if (!await exists(dataPath, 'file')) addError(`缺少目录数据：${dataPath}`);
  if (errors.length) throw Object.assign(new Error(errors.join('\n')), { reported: true });

  const dataText = await fs.readFile(dataPath, 'utf8');
  if (key(dataText).includes(key(PRIVATE_ROUTE_RAW)) || key(dataText).includes(key(PRIVATE_ROUTE_ENCODED))) {
    addError('目录数据包含永久私密的能力体系 URL');
  }
  const jsonText = dataText
    .replace(/^\s*window\.SiyuanKnowledgeData\s*=\s*/u, '')
    .replace(/;\s*$/u, '');
  let data = null;
  try {
    data = JSON.parse(jsonText);
  } catch (error) {
    addError(`siyuan-data.js 不是有效 JSON：${error.message}`);
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) addError('目录数据根节点必须是对象');
  if (data && typeof data.notebook !== 'string') addError('目录数据 notebook 必须是字符串');
  if (data && !Array.isArray(data.documents)) addError('目录数据 documents 必须是数组');
  if (data && (!Number.isInteger(data.articleCount) || data.articleCount < 0)) addError('目录数据 articleCount 必须是非负整数');

  const documents = Array.isArray(data?.documents) ? data.documents : [];
  const knownUrls = new Map();
  for (const [index, doc] of documents.entries()) {
    if (!doc || typeof doc !== 'object') {
      addError(`documents[${index}] 必须是对象`);
      continue;
    }
    if (typeof doc.title !== 'string' || !doc.title.trim()) addError(`documents[${index}].title 无效`);
    if (!Array.isArray(doc.parts) || doc.parts.some((part) => typeof part !== 'string')) addError(`documents[${index}].parts 无效`);
    if (typeof doc.daily !== 'boolean') addError(`documents[${index}].daily 必须是布尔值`);
    const url = normalizeKnowledgeUrl(doc.url);
    if (!url) {
      addError(`documents[${index}].url 无效：${String(doc.url)}`);
      continue;
    }
    const urlKey = key(url);
    if (knownUrls.has(urlKey)) addError(`重复 URL：${url}`);
    else knownUrls.set(urlKey, doc);
    const expectedPage = expectedPageForUrl(knowledgeRoot, url);
    if (!expectedPage || !await exists(expectedPage, 'file')) addError(`目录数据指向不存在页面：${url}`);
  }

  const pages = await walkFiles(knowledgeRoot, (file) => path.basename(file) === 'index.md');
  if (await exists(privateKnowledgeRoot)) addError(`永久私密目录被生成：${privateKnowledgeRoot}`);
  if (pages.length !== documents.length) addError(`页面数量 ${pages.length} 与目录数据 ${documents.length} 不一致`);
  const expectedPages = new Set(documents.map((doc) => expectedPageForUrl(knowledgeRoot, doc?.url)).filter(Boolean).map(key));
  for (const page of pages) {
    if (!expectedPages.has(key(page))) addError(`页面未登记到目录数据：${page}`);
  }

  const articleRoot = path.join(options.blogDir, 'source', '_posts');
  const actualArticles = await exists(articleRoot, 'directory')
    ? (await walkFiles(articleRoot, (file) => file.toLowerCase().endsWith('.md'))).length
    : 0;
  if (Number.isInteger(data?.articleCount) && data.articleCount !== actualArticles) {
    addWarning(`文章计数已过期：数据为 ${data.articleCount}，实际为 ${actualArticles}；请重新导入`);
  }

  const privateValuesPath = path.join(options.blogDir, 'tools', 'siyuan-private-values.txt');
  const privateValues = [];
  if (await exists(privateValuesPath, 'file')) {
    const privateFileMode = (await fs.stat(privateValuesPath)).mode & 0o777;
    if ((privateFileMode & 0o077) !== 0) addError('tools/siyuan-private-values.txt 权限过宽，应设置为 600');
    for (const line of (await fs.readFile(privateValuesPath, 'utf8')).split(/\r?\n/u)) {
      const value = line.trim();
      if (value && !value.startsWith('#')) privateValues.push(value);
    }
  } else {
    addWarning('未配置 tools/siyuan-private-values.txt；仅执行内置隐私规则');
  }

  for (const page of pages) {
    const bytes = await fs.readFile(page);
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) addError(`文件带 UTF-8 BOM：${page}`);
    const text = bytes.toString('utf8');
    const prose = stripCodeAndFrontMatter(text);
    scanHighRiskSecrets(text, page, addError);
    if (!/^---\s*\r?\n[\s\S]*?\r?\n---/u.test(text)) addError(`缺少 front matter：${page}`);
    if (!/^type:\s*siyuan-note\s*$/mu.test(text)) addError(`缺少 type: siyuan-note：${page}`);
    if (/siyuan:\/\/blocks\//iu.test(prose)) addError(`残留 siyuan:// 死链：${page}`);
    if (/\(\(\d{14}-[a-z0-9]{7}(?:\s+["'][^"']+["'])?\)\)?/iu.test(prose)) addError(`残留思源块引用语法：${page}`);

    for (const match of prose.matchAll(/(?<!!)\[[^\]]+\]\((\/siyuan\/[^\s)#]+)(?:#[^)]*)?\)/gu)) {
      const url = normalizeKnowledgeUrl(match[1]);
      if (!url) addError(`站内链接编码无效：${page} -> ${match[1]}`);
      else if (!knownUrls.has(key(url))) addError(`无目标的站内链接：${page} -> ${url}`);
    }
    for (const match of prose.matchAll(/!\[[^\]]*\]\(\/images\/siyuan\/([^\s)]+)\)/gu)) {
      const decoded = safeDecode(match[1]);
      if (decoded === null) {
        addError(`图片路径编码无效：${page} -> ${match[1]}`);
        continue;
      }
      const asset = path.resolve(assetRoot, ...decoded.split('/'));
      if (!isPathInside(assetRoot, asset)) addError(`图片路径越界：${page} -> ${decoded}`);
      else if (!await exists(asset, 'file')) addWarning(`缺失图片：${page} -> ${decoded}`);
    }
    for (const value of privateValues) {
      if (key(text).includes(key(value))) addError(`命中自定义隐私值：${page}`);
    }
  }

  const sourceTextFiles = await walkFiles(path.join(options.blogDir, 'source'), (file) => /\.(?:md|html?|js|json|xml|txt)$/iu.test(file));
  for (const file of sourceTextFiles) {
    const text = await fs.readFile(file, 'utf8');
    const lowered = key(text);
    if (lowered.includes(key(PRIVATE_ROUTE_RAW)) || lowered.includes(key(PRIVATE_ROUTE_ENCODED))) {
      addError(`源文件包含永久私密 URL：${file}`);
    }
    scanHighRiskSecrets(text, file, addError);
    for (const value of privateValues) {
      if (lowered.includes(key(value))) addError(`源文件命中自定义隐私值：${file}`);
    }
  }

  const routerPage = path.join(knowledgeRoot, '其他笔记', '计算机网络', '个人路由配置记录', 'index.md');
  if (await exists(routerPage, 'file')) {
    const routerText = await fs.readFile(routerPage, 'utf8');
    if (/\b[0-9a-f]{16}\b/iu.test(routerText)) addError('个人路由配置仍含疑似 ZeroTier Network ID');
    if (/\b[0-9a-f]{10}\b/iu.test(routerText)) addError('个人路由配置仍含疑似 ZeroTier 设备 ID');
    if (/(?<![\d.])(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)(?:\d{1,3}\.){1,2}\d{1,3}(?:\/\d{1,2})?(?![\d.])/u.test(routerText)) {
      addError('个人路由配置仍含私网 IP 地址');
    }
  }

  if (options.requirePublic && !await exists(publicRoot, 'directory')) addError('发布校验要求 public 目录，但该目录不存在');
  if (await exists(publicRoot, 'directory')) {
    const required = [
      'index.html',
      'siyuan/index.html',
      'archives/index.html',
      'js/site-shell.js',
      'js/siyuan-knowledge.js',
      'css/siyuan-knowledge.css',
    ];
    for (const relative of required) {
      if (!await exists(path.join(publicRoot, ...relative.split('/')), 'file')) addError(`构建产物缺失：public/${relative}`);
    }
    const privatePublicRoot = path.join(publicRoot, 'siyuan', PRIVATE_ROOT);
    if (await exists(privatePublicRoot)) addError(`构建产物包含永久私密目录：${privatePublicRoot}`);

    const publicTextFiles = await walkFiles(publicRoot, (file) => /\.(?:html?|js|json|xml|txt)$/iu.test(file));
    for (const file of publicTextFiles) {
      const text = await fs.readFile(file, 'utf8');
      const lowered = key(text);
      if (lowered.includes(key(PRIVATE_ROUTE_RAW)) || lowered.includes(key(PRIVATE_ROUTE_ENCODED))) {
        addError(`构建产物包含永久私密 URL：${file}`);
      }
      scanHighRiskSecrets(text, file, addError);
      for (const value of privateValues) {
        if (lowered.includes(key(value))) addError(`构建产物命中自定义隐私值：${file}`);
      }
    }
  }

  console.log(`[检查] 页面 ${pages.length}，错误 ${new Set(errors).size}，警告 ${new Set(warnings).size}`);
  for (const warning of new Set(warnings)) console.warn(`[警告] ${warning}`);
  for (const error of new Set(errors)) console.error(`[错误] ${error}`);
  if (errors.length || (options.strict && warnings.length)) process.exitCode = 1;
  else console.log('[通过] 知识库结构与关键安全检查通过');
}

main().catch((error) => {
  if (!error.reported) console.error(`[失败] ${error.stack || error.message}`);
  process.exitCode = error.exitCode || 1;
});
