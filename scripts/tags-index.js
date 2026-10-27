'use strict';

/**
 * /tags/ 标签总览页。
 *
 * 之前站里没有这个页面：标签只能从文章底部的标签、或侧栏的「标签」小组件点进去，
 * 没有一个「有哪些标签」的入口。
 *
 * 这里不用主题自带的 tagcloud —— 它是按文章数缩放字号的老式云图，和全站
 * 「胶囊 + 角标计数」的语言不是一路。改成自己渲染一层药丸网格，
 * 用三档视觉权重代替字号缩放（1 篇 / 2 篇 / 3 篇以上），字号始终一致，读起来更稳。
 */
hexo.extend.filter.register('after_render:html', (str, data) => {
  if (!data || data.path !== 'tags/index.html') return str;
  if (str.includes('tag-index-grid')) return str;

  const root = hexo.config.root || '/';
  const tags = hexo.locals.get('tags').toArray().map((tag) => ({
    name: tag.name,
    path: tag.path,
    count: (tag.posts && tag.posts.length) || tag.count || 0,
  }));

  if (!tags.length) return str;

  tags.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));

  const postCount = hexo.locals.get('posts').toArray().length;

  const items = tags
    .map((tag) => {
      const tier = tag.count >= 3 ? ' is-major' : tag.count === 2 ? ' is-mid' : '';
      const href = `${root}${String(tag.path || '').replace(/^\/+/, '')}`;
      return `<a class="tag-index-item${tier}" href="${href}">${tag.name}<sup>${tag.count}</sup></a>`;
    })
    .join('');

  const block = [
    '<div class="tag-index">',
    `<p class="tag-index-lead">共 ${tags.length} 个标签、${postCount} 篇文章。点标签看这个主题下的全部文章。</p>`,
    `<div class="tag-index-grid">${items}</div>`,
    '</div>',
  ].join('');

  // 页面正文容器；注进去比改模板稳，也不碰 node_modules 里的主题。
  return str.replace('<div class="post-body"', `${block}<div class="post-body"`);
});
