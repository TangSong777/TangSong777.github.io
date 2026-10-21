'use strict';

/**
 * 归档页标题补全：NexT 默认只显示年份，这里补成「2026 年 9 月」，
 * 并把顶部问候语与计数改为当前页的篇数。
 *
 * after_render:html 的 this 上下文拿不到 page 字段，因此从 canonical 链接反推年月。
 */
hexo.extend.filter.register('after_render:html', function (str) {
  if (!str.includes('collection-header')) return str;

  const canonical = /<link rel="canonical" href="([^"]+)"/.exec(str);
  if (!canonical) return str;

  const matched = /\/archives\/(\d{4})(?:\/(\d{2}))?\//.exec(canonical[1]);
  if (!matched) return str;

  const year = Number(matched[1]);
  const month = matched[2] ? Number(matched[2]) : null;

  const posts = hexo.locals.get('posts').toArray().filter((post) => {
    const date = post.date;
    return date.year() === year && (!month || date.month() + 1 === month);
  });
  const count = posts.length;
  const label = month ? `${year} 年 ${month} 月` : `${year} 年`;

  return str
    .replace(/(目前共计\s*)\d+(\s*篇日志)/, `$1${count}$2`)
    .replace(
      /<span class="collection-header">\d{4}(<span class="collection-year-count">\d+<\/span>)?<\/span>/,
      `<span class="collection-header">${label}<span class="collection-year-count">${count}</span></span>`,
    );
});
