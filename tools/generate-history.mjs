#!/usr/bin/env node
/**
 * 用编程式 API 生成岁月史书站点。
 * 目录树读取 siyuan-data.js（parts 层级 + order 顺序），
 * 折叠状态在服务端渲染时确定：当前页面路径展开，其余默认只展开第一层。
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import Hexo from '/srv/blog/repo/node_modules/hexo/dist/hexo/index.js';

const require = createRequire('/srv/blog/repo/package.json');
const { marked } = require('marked');

const baseDir = '/srv/blog/history-site';
const hexo = new Hexo(baseDir, { silent: false });

function loadDocuments() {
  const file = path.join(baseDir, 'source/js/siyuan-data.js');
  const text = fs.readFileSync(file, 'utf8');
  const json = text.replace(/^window\.SiyuanKnowledgeData\s*=\s*/, '').replace(/;\s*$/, '');
  return JSON.parse(json).documents;
}

function buildTree(documents) {
  const root = { children: new Map(), doc: null };
  for (const doc of documents) {
    if (!Array.isArray(doc.parts)) continue;
    // parts 为空 = 顶层文档（岁月史书），作为整棵树的根
    if (!doc.parts.length) { root.doc = doc; continue; }
    let node = root;
    for (const part of doc.parts) {
      if (!node.children.has(part)) node.children.set(part, { name: part, children: new Map(), doc: null });
      node = node.children.get(part);
    }
    node.doc = doc;
  }
  return root;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[char]));
}

function sortEntry(a, b) {
  const orderA = a[1].doc && typeof a[1].doc.order === 'number' ? a[1].doc.order : Number.MAX_SAFE_INTEGER;
  const orderB = b[1].doc && typeof b[1].doc.order === 'number' ? b[1].doc.order : Number.MAX_SAFE_INTEGER;
  return orderA - orderB || a[0].localeCompare(b[0], 'zh-CN', { numeric: true });
}

function renderTree(node, depth, prefix, currentParts, useRefs, collapseAll) {
  const entries = [...node.children.entries()].sort(sortEntry);
  return entries.map(([name, child]) => {
    const parts = [...prefix, name];
    const inPath = currentParts.length >= parts.length && parts.every((part, index) => part === currentParts[index]);
    const realChildren = child.children.size > 0;
    const refs = useRefs && child.doc && refMap.get(child.doc.url) ? refMap.get(child.doc.url) : [];
    const hasChildren = realChildren || refs.length > 0;

    // 真实子级：深度 >= 1 折叠；待归档也默认折叠；纯引用子级默认展开
    const collapsed = collapseAll
      ? realChildren && !inPath
      : (realChildren && depth >= 1 && !inPath) || (realChildren && name === '待归档');
    const caret = collapsed ? '▸' : '▾';
    const active = inPath && parts.length === currentParts.length ? ' is-active' : '';

    const title = escapeHtml(child.doc ? child.doc.title || name : name);
    const link = child.doc
      ? `<a class="toc-link${active}" href="${escapeHtml(child.doc.url)}">${title}</a>`
      : `<span class="toc-label">${title}</span>`;
    const toggle = hasChildren
      ? `<button class="toc-toggle" type="button" aria-expanded="${!collapsed}" aria-label="展开或收起"><span class="toc-caret">${caret}</span></button>`
      : '<span class="toc-toggle is-leaf" aria-hidden="true"></span>';

    const realKids = realChildren ? renderTree(child, depth + 1, parts, currentParts, useRefs, collapseAll) : '';
    const refKids = refs.map((ref) => (
      `<li class="toc-node toc-node-ref" data-depth="${depth + 1}">` +
      '<span class="toc-toggle is-leaf" aria-hidden="true"></span>' +
      `<a class="toc-link" href="${escapeHtml(ref.url)}">${escapeHtml(ref.title)}</a></li>`
    )).join('');
    const kids = (realKids || refKids) ? `<ul class="toc-children">${realKids}${refKids}</ul>` : '';
    const classes = `toc-node${collapsed ? ' is-collapsed' : ''}`;

    return `<li class="${classes}" data-depth="${depth}" data-key="${escapeHtml(parts.join('/'))}">${toggle}${link}${kids}</li>`;
  }).join('');
}

function pageToParts(pagePath) {
  return String(pagePath || '')
    .replace(/^siyuan\//, '')
    .replace(/\/?index\.html$/, '')
    .split('/')
    .filter(Boolean);
}

let tree = null;
let refMap = new Map();

// 从导入生成的 markdown 里读取「本文引用」，作为文档的虚拟子级
function buildRefMap() {
  const refCandidates = [
    path.join(baseDir, 'source', 'siyuan', 'All', '03-人物档案'),
    path.join(baseDir, 'source', 'siyuan', '03-人物档案'),
  ];
  const root = refCandidates.find((candidate) => fs.existsSync(candidate));
  if (!root) return;
  const map = new Map();

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (entry.name !== 'index.md') continue;
      const text = fs.readFileSync(full, 'utf8');
      const permalinkMatch = text.match(/^permalink:\s*'?([^'\n]+)'?/m);
      if (!permalinkMatch) continue;
      const url = '/' + permalinkMatch[1].replace(/^\/+/, '');
      // 优先取正文里的「人物列表」章节，其次取「本文引用」
      let block = '';
      const listStart = text.indexOf('## 人物列表');
      if (listStart >= 0) {
        const listEnd = text.indexOf('\n## ', listStart + 1);
        block = text.slice(listStart, listEnd > 0 ? listEnd : undefined);
      } else {
        const refStart = text.indexOf('### 本文引用');
        if (refStart < 0) continue;
        const refEnd = text.indexOf('### 反向引用');
        block = text.slice(refStart, refEnd > 0 ? refEnd : undefined);
      }
      const links = [];
      const re = /^- \[([^\]]+)\]\(([^)]+)\)/gm;
      let match;
      while ((match = re.exec(block))) {
        const target = match[2].trim();
        if (!target.startsWith('/siyuan/')) continue;
        links.push({ url: target, title: match[1].trim() });
      }
      if (links.length) {
        map.set(url, links);
        const titleMatch = text.match(/^title:\s*'?([^'\n]+)'?/m);
        if (titleMatch) map.set('title:' + titleMatch[1].trim(), links);
      }
    }
  }

  walk(root);
  return map;
}

try {
  hexo.env.init = true;
  await hexo.init();

  hexo.extend.renderer.register('md', 'html', (data) => marked.parse(data.text, { gfm: true, breaks: false }), true);
  hexo.extend.renderer.register('markdown', 'html', (data) => marked.parse(data.text, { gfm: true, breaks: false }), true);

  refMap = buildRefMap();

  hexo.extend.helper.register('historyNav', function () {
    const page = this.page || {};
    if (!tree) tree = buildTree(loadDocuments());
    const currentParts = pageToParts(page.path);
    const rootDoc = tree.doc;
    if (!rootDoc) {
      return `<ul class="toc-tree">${renderTree(tree, 0, [], currentParts, false)}</ul>`;
    }
    // 顶层文档「岁月史书」作为根节点，各分类挂在其下（depth 1 → 默认折叠）
    const inner = renderTree(tree, 1, [], currentParts, false);
    const active = currentParts.length === 0 ? ' is-active' : '';
    return `<ul class="toc-tree toc-root">` +
      `<li class="toc-node toc-node-root" data-depth="0" data-key="${escapeHtml(rootDoc.title)}">` +
      `<button class="toc-toggle" type="button" aria-expanded="true" aria-label="展开或收起"><span class="toc-caret">▾</span></button>` +
      `<a class="toc-link${active}" href="${escapeHtml(rootDoc.url)}">${escapeHtml(rootDoc.title)}</a>` +
      (inner ? `<ul class="toc-children">${inner}</ul>` : '') +
      `</li></ul>`;
  });

  // 首页看板：按分类渲染成可折叠的小目录树（不重复渲染分类文档本身）
  // 人物档案只保留「索引」这一支
  hexo.extend.helper.register('categoryNav', function (group) {
    if (!tree) tree = buildTree(loadDocuments());
    const all = tree.children.get('All') || tree;
    const node = all && all.children.get(group);
    if (!node) return '';

    let target = node;
    let prefix = [group];
    if (group === '03-人物档案') {
      const indexNode = node.children.get('索引');
      if (indexNode) {
        target = indexNode;
        prefix = [group, '索引'];
      }
    }
    if (!target.children.size) return '';
    return `<ul class="toc-tree">${renderTree(target, 0, prefix, [], true, group !== '03-人物档案')}</ul>`;
  });

  function stripHtml(html) {
    return String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  hexo.extend.filter.register('after_generate', function () {
    const pages = hexo.locals.get('pages').toArray()
      .filter((entry) => String(entry.path || '').startsWith('siyuan/'));
    const index = pages.map((entry) => ({
      title: entry.title || '',
      url: '/' + String(entry.path).replace(/index\.html$/, ''),
      text: stripHtml(entry.content || '').slice(0, 12000),
    })).filter((entry) => entry.title || entry.text);
    fs.mkdirSync(path.join(baseDir, 'public'), { recursive: true });
    fs.writeFileSync(path.join(baseDir, 'public', 'search-index.json'), JSON.stringify(index));
    console.log(`[搜索索引] ${index.length} 篇文档`);
  });

  await hexo.call('generate', {});
  await hexo.exit();
  console.log('[生成完成]');
} catch (error) {
  console.error('[生成失败]', error.message);
  try { await hexo.exit(); } catch { /* ignore */ }
  process.exitCode = 1;
}
