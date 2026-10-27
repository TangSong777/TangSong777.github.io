'use strict';

/**
 * 侧栏替换：隐藏「站点概览」的日志/分类/标签计数，改为标签云 + 归档。
 * 注入在 site-state-wrap 之前，主题模板本身不做修改。
 */
hexo.extend.filter.register('after_render:html', (str) => {
  const anchor = '<div class="site-state-wrap';
  if (!str.includes(anchor)) return str;
  if (str.includes('sidebar-widgets')) return str;

  const root = hexo.config.root || '/';
  const join = (path) => `${root}${String(path || '').replace(/^\/+/, '')}`;

  const allTags = hexo.locals.get('tags').toArray();

  const tags = allTags
    .map((tag) => ({
      name: tag.name,
      path: tag.path,
      count: (tag.posts && tag.posts.length) || tag.count || 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
    .slice(0, 24);

  const archiveCounts = new Map();
  for (const post of hexo.locals.get('posts').toArray()) {
    const key = `${post.date.year()}-${String(post.date.month() + 1).padStart(2, '0')}`;
    archiveCounts.set(key, (archiveCounts.get(key) || 0) + 1);
  }
  const archives = [...archiveCounts.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 8);

  const tagHtml = tags.length
    ? tags.map((tag) => `<a class="sidebar-tag" href="${join(tag.path)}">${tag.name}<sup>${tag.count}</sup></a>`).join('')
    : '<span class="sidebar-empty">暂无标签</span>';

  const archiveHtml = archives.length
    ? archives.map(([key, count]) => {
      const [year, month] = key.split('-');
      return `<a class="sidebar-archive" href="${join(`archives/${year}/${month}/`)}">${key}<sup>${count}</sup></a>`;
    }).join('')
    : '<span class="sidebar-empty">暂无归档</span>';

  const catAll = hexo.locals.get('categories').toArray()
    .map((cat) => ({
      name: cat.name,
      path: cat.path,
      count: (cat.posts && cat.posts.length) || cat.count || 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));

  const categoryHtml = catAll.length
    ? catAll.map((cat) => `<a class="sidebar-category" href="${join(cat.path)}">${cat.name}<sup>${cat.count}</sup></a>`).join('')
    : '<span class="sidebar-empty">暂无分类</span>';

  const block = [
    '<div class="sidebar-widgets">',
    `<div class="sidebar-widget"><h3>标签<a class="sidebar-widget-more" href="${join('tags/')}">全部 →</a></h3><div class="sidebar-tags">${tagHtml}</div></div>`,
    `<div class="sidebar-widget"><h3>分类<a class="sidebar-widget-more" href="${join('categories/')}">全部 →</a></h3><div class="sidebar-categories">${categoryHtml}</div></div>`,
    `<div class="sidebar-widget"><h3>归档<a class="sidebar-widget-more" href="${join('archives/')}">全部 →</a></h3><div class="sidebar-archives">${archiveHtml}</div></div>`,
    '</div>',
  ].join('');

  return str.replace(anchor, `${block}${anchor}`);
});
