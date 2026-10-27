'use strict';

/**
 * /tags/ 与 /categories/ 的总览页。
 *
 * 之前站里这两个页面都不存在：标签和分类只能从文章底部或侧栏的某个小组件点进去，
 * 没有一个「到底有哪些」的入口。标签页先补上，分类页跟着补齐。
 *
 * 不用主题自带的 tagcloud —— 它是按文章数缩放字号的老式云图，字大小从 12px 跳到 40px，
 * 同一排三四种字号没法扫读，也跟全站「胶囊 + 角标计数」的语言不是一路。
 * 这里用恒字号药丸 + 三档视觉权重（1 篇 / 2 篇 / 3 篇以上）表达热度。
 */

const TAXONOMIES = {
  tags: {
    path: 'tags/index.html',
    label: '标签',
    lead: (n, p) => `共 ${n} 个标签、${p} 篇文章。点标签看这个主题下的全部文章。`,
    link: (root) => `想按主题看？<a class="taxonomy-link" href="${root}categories/">按分类浏览 →</a>`,
  },
  categories: {
    path: 'categories/index.html',
    label: '分类',
    lead: (n, p) => `共 ${n} 个分类、${p} 篇文章。分类比标签粗一档，适合从大块入手。`,
    link: (root) => `想按关键词看？<a class="taxonomy-link" href="${root}tags/">按标签浏览 →</a>`,
  },
};

hexo.extend.filter.register('after_render:html', (str, data) => {
  if (!data || !data.path) return str;

  const kind = Object.keys(TAXONOMIES).find((key) => TAXONOMIES[key].path === data.path);
  if (!kind) return str;
  if (str.includes('tag-index-grid')) return str;

  const conf = TAXONOMIES[kind];
  const root = hexo.config.root || '/';
  const all = hexo.locals.get(kind);

  const esc = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const items = all
    .toArray()
    .map((item) => {
      const posts = item.posts ? item.posts.toArray() : [];
      posts.sort((a, b) => b.date - a.date);
      return {
        name: item.name,
        path: item.path,
        count: posts.length || item.count || 0,
        posts: posts.slice(0, 2).map((p) => p.title),
      };
    });

  if (!items.length) return str;

  items.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));

  const postCount = hexo.locals.get('posts').toArray().length;

  const html = items
    .map((item) => {
      const tier = item.count >= 3 ? ' is-major' : item.count === 2 ? ' is-mid' : '';
      const href = `${root}${String(item.path || '').replace(/^\/+/, '')}`;
      const shown = item.posts.filter(Boolean);
      const more = item.count - shown.length;
      const postLine = shown.length
        ? `<span class="tii-posts">${shown.map(esc).join(' · ')}${more > 0 ? ` 等 ${item.count} 篇` : ''}</span>`
        : `<span class="tii-posts tii-empty">暂无文章</span>`;
      return `<a class="tag-index-item${tier}" href="${href}"><span class="tii-head">${esc(item.name)}<sup>${item.count}</sup></span>${postLine}</a>`;
    })
    .join('');

  const block = [
    `<div class="tag-index is-${kind}">`,
    `<p class="tag-index-lead">${conf.lead(items.length, postCount)}</p>`,
    `<div class="tag-index-grid">${html}</div>`,
    `<p class="tag-index-foot">${conf.link(root)}</p>`,
    '</div>',
  ].join('');

  // 页面正文容器；注进去比改模板稳，也不碰 node_modules 里的主题。
  return str.replace('<div class="post-body"', `${block}<div class="post-body"`);
});
