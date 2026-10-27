'use strict';

/**
 * 学习笔记详情页的页尾导航。
 *
 * 笔记是一棵深树（`siyuan/其他笔记/Rock5B+/串流方案/` 这类），可一篇笔记读完以后
 * 页尾什么都没有：要么滚回顶部点面包屑，要么按浏览器后退。而面包屑只回答「我在哪」，
 * 不回答「同一层还有什么」。这里补两块：
 *   1. 同层的上一篇 / 下一篇；
 *   2. 上一级目录 + 学习笔记索引两个胶囊。
 *
 * 为什么放在页尾而不是顶部：面包屑已经在顶部回答了「位置」，页尾才是「读完了，接下来」。
 *
 * 关于「同层」的定义：不能直接用 page.path 的 dirname —— Hexo 里
 * `siyuan/其他笔记/index.html` 的 dirname 是 `siyuan/其他笔记/`，
 * 而它真正的兄弟是 `siyuan/手册/index.html` 这类（同在 `siyuan/` 下）。
 * 所以要把路径末尾的 index.html 去掉再按「最后一段」拆父子，才是读者心里的同一层。
 */

const escaped = (text) => String(text == null ? '' : text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const HOMEPAGE = 'siyuan/index.html';

/** page.path 形如 siyuan/其他笔记/Rock5B+/index.html，转成站内绝对路径 */
const toHref = (pagePath) => `${hexo.config.root || '/'}${String(pagePath || '')
  .replace(/index\.html$/, '')
  .replace(/^\/+/, '')}`;

/** 去掉 index.html 后的节点路径：siyuan/其他笔记/Rock5B+/ */
const toNode = (pagePath) => String(pagePath || '').replace(/index\.html$/, '');

/** 节点的父节点路径：siyuan/其他笔记/Rock5B+/ → siyuan/其他笔记/ */
const toParent = (node) => {
  const trimmed = node.replace(/\/$/, '');
  const cut = trimmed.lastIndexOf('/');
  return cut < 0 ? '' : `${trimmed.slice(0, cut + 1)}`;
};

let index = null;

function buildIndex() {
  const byPath = new Map();
  const byParent = new Map();

  for (const page of hexo.locals.get('pages').toArray()) {
    const path = String(page.path || '');
    if (!path.startsWith('siyuan/')) continue;
    byPath.set(path, page);
    if (path === 'siyuan/index.html') continue;
    const parent = toParent(toNode(path));
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(page);
  }

  for (const list of byParent.values()) {
    list.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN'));
  }

  return { byPath, byParent };
}

/** 把导航插到 .post-body 这个 div 闭合之前（不动主题模板） */
function insertBeforePostBodyClose(html, block) {
  const start = html.indexOf('<div class="post-body"');
  if (start < 0) return html;

  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = re.exec(html))) {
    if (match[0] === '</div>') depth -= 1;
    else depth += 1;
    if (depth === 0) return html.slice(0, match.index) + block + html.slice(match.index);
  }
  return html;
}

hexo.extend.filter.register('after_render:html', (str, data) => {
  if (!data || !data.path) return str;
  const path = String(data.path);
  if (!path.startsWith('siyuan/') || path === HOMEPAGE) return str;
  if (str.includes('class="note-nav"')) return str;
  if (!index) index = buildIndex();

  const node = toNode(path);
  const parent = toParent(node);
  const list = index.byParent.get(parent) || [];
  const pos = list.findIndex((item) => String(item.path) === path);

  const prev = pos > 0 ? list[pos - 1] : null;
  const next = pos >= 0 && pos < list.length - 1 ? list[pos + 1] : null;

  const card = (item, kind) => (item
    ? `<a class="note-nav-item is-${kind}" href="${toHref(item.path)}"><span>${kind === 'prev' ? '上一篇' : '下一篇'}</span><strong>${escaped(item.title)}</strong></a>`
    : '<span class="note-nav-item is-placeholder" aria-hidden="true"></span>');

  // 上一级：父节点自己有 index.html 才给链接；父节点就是学习笔记首页时，不重复给两个一样的目标
  const upPage = parent ? index.byPath.get(`${parent}index.html`) : null;
  const ups = [];
  if (upPage && String(upPage.path) !== HOMEPAGE) {
    ups.push(`<a href="${toHref(upPage.path)}">↑ 返回 ${escaped(upPage.title)}</a>`);
  }
  ups.push(`<a href="${hexo.config.root || '/'}siyuan/">⌂ 学习笔记索引</a>`);

  const block = [
    '<div class="note-nav-wrap">',
    '<nav class="note-nav">',
    card(prev, 'prev'),
    card(next, 'next'),
    '</nav>',
    `<div class="note-nav-up">${ups.join('')}</div>`,
    '</div>',
  ].join('');

  return insertBeforePostBodyClose(str, block);
});
