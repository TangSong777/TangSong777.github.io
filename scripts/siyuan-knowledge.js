/* Custom assets injected without modifying the NexT theme package. */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const siteRoot = hexo.config.root || '/';

/**
 * CSS 缓存指纹。
 *
 * 背景：`main.css` 与 `siyuan-knowledge.css` 一直是不带版本号的静态链接，
 * 而 blogs 走 Fastly（cache-control: max-age=600）—— 改完样式发布后，
 * 用户（包括我自己）最多要看 10 分钟的旧样式，好几次误判成「改动没生效」。
 *
 * 做法：构建时按内容算 md5 前 8 位挂到 `?v=` 上。内容一变指纹就变，
 * CDN 缓存自然失效；内容没变则链接不变，缓存照旧命中。
 * 这样不用手工 bump 版本号，也不会每次构建都无意义地失效缓存。
 */
function hashOf(relPath) {
  try {
    const file = path.join(hexo.base_dir, relPath);
    return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
  } catch (err) {
    hexo.log.warn(`[assets] 读不到 ${relPath}，缓存指纹降级为 0：${err.message}`);
    return '0';
  }
}

const siyuanCssVersion = hashOf('source/css/siyuan-knowledge.css');
const mainCssVersion = hashOf('source/_data/styles.styl');

const style = `<link rel="stylesheet" href="${siteRoot}css/siyuan-knowledge.css?v=${siyuanCssVersion}">`;
const shell = `<script src="${siteRoot}js/site-shell.js?v=20261030" defer></script>`;
const knowledge = `<script src="${siteRoot}js/siyuan-data.js?v=20261030" defer></script><script src="${siteRoot}js/siyuan-knowledge.js?v=20261030" defer></script>`;

// 导航流畅化：浏览器预渲染（悬停即准备）+ 跨文档平滑过渡，纯原生零 JS 开销
// 这一项不改变任何视觉样式，只影响页面切换手感
const navEnhance = [
  '<script type="speculationrules">',
  '{"prerender":[{"where":{"href_matches":"/*"},"eagerness":"moderate"}]}',
  '</scr' + 'ipt>',
  '<style>',
  '@view-transition{navigation:auto}',
  '::view-transition-old(root){animation:vt-out .18s ease both}',
  '::view-transition-new(root){animation:vt-in .18s ease both}',
  '@keyframes vt-out{to{opacity:0}}',
  '@keyframes vt-in{from{opacity:0}}',
  '@media (prefers-reduced-motion:reduce){',
  '::view-transition-old(root),::view-transition-new(root){animation:none}',
  '}',
  '</style>'
].join('');

['home', 'post', 'page', 'archive', 'tag', 'category'].forEach(type => {
  hexo.extend.injector.register('head_end', navEnhance, type);
  hexo.extend.injector.register('head_end', style, type);
  hexo.extend.injector.register('body_end', shell, type);
});

// The full document index is only needed by the home and knowledge pages.
hexo.extend.injector.register('body_end', knowledge, 'home');
hexo.extend.injector.register('body_end', knowledge, 'page');

// 给主题自己输出的 main.css 补上同样的缓存指纹（NexT 模板不改，只在渲染结果里替换）。
hexo.extend.filter.register('after_render:html', html => html.replace(
  /(<link[^>]+href=")([^"]*?css\/main\.css)(")/gi,
  (match, head, href, tail) => (/[?&]v=/.test(href) ? match : `${head}${href}?v=${mainCssVersion}${tail}`)
));

// Defer below-the-fold content images without delaying the small profile avatar.
hexo.extend.filter.register('after_render:html', html => html.replace(/<img\b(?![^>]*\bloading=)([^>]*?)>/gi, (tag, attrs) => {
  if (/\/images\/avatar\.(?:jpe?g|png|webp)/i.test(attrs)) return tag;
  return `<img loading="lazy" decoding="async"${attrs}>`;
}));
