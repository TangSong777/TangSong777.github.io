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
// 这两个脚本也用内容指纹：以前写死 `?v=20261037`，每次改完都得手工 bump，
// 忘了就是「改了没生效」；siyuan-data.js 还会在每次笔记同步时整体重写。
const shellVersion = hashOf('source/js/site-shell.js');
const knowledgeVersion = hashOf('source/js/siyuan-knowledge.js');
const dataVersion = hashOf('source/js/siyuan-data.js');
const polishCssVersion = hashOf('source/css/polish.css');
const polishJsVersion = hashOf('source/js/polish.js');
const polishStyle = `<link rel="stylesheet" href="${siteRoot}css/polish.css?v=${polishCssVersion}">`;
const polishScript = `<script src="${siteRoot}js/polish.js?v=${polishJsVersion}" defer></script>`;
const notesCssVersion = hashOf('source/css/notes-v2.css');
const notesJsVersion = hashOf('source/js/notes-v2.js');
const notesStyle = `<link rel="stylesheet" href="${siteRoot}css/notes-v2.css?v=${notesCssVersion}">`;
const notesScript = `<script src="${siteRoot}js/notes-v2.js?v=${notesJsVersion}" defer></scr` + 'ipt>';
const treeJsVersion = hashOf('source/js/notes-tree.js');
const treeScript = `<script src="${siteRoot}js/notes-tree.js?v=${treeJsVersion}" defer></scr` + 'ipt>';
const shell = `<script src="${siteRoot}js/site-shell.js?v=${shellVersion}" defer></script>`;
const knowledge = `<script src="${siteRoot}js/siyuan-data.js?v=${dataVersion}" defer></script><script src="${siteRoot}js/siyuan-knowledge.js?v=${knowledgeVersion}" defer></script>`;

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
  hexo.extend.injector.register('head_end', polishStyle, type);
  hexo.extend.injector.register('body_end', shell, type);
  hexo.extend.injector.register('body_end', polishScript, type);
});

// 首页与笔记页都要 siyuan-knowledge.js：它不只做笔记页的 TOC 高亮/引用聚焦，
// setupBlogHome()（hero、双栏、右侧 rail、blog-home-mode）也在里面。
// Round 76 为省 10KB 把它从首页拆掉，结果 11-02 首页退回 NexT 原始卡片流 + 深色侧栏。
// 回归教训：按页裁剪脚本前，先确认被裁掉的脚本里没有其它页面的初始化逻辑。
hexo.extend.injector.register('body_end', knowledge, 'home');
hexo.extend.injector.register('body_end', knowledge, 'page');

// 学习笔记页的组件层（对标 yhblogs.cn 文章页）：只在 page 类型注入，
// 规则全部限定 body.siyuan-mode，首页/文章页/归档页不受影响。
hexo.extend.injector.register('head_end', notesStyle, 'page');
hexo.extend.injector.register('body_end', notesScript, 'page');
// 左侧全文档目录（重写版）：纯链接 + 整页跳转，不再做前端路由
hexo.extend.injector.register('body_end', treeScript, 'page');

// 给主题自己输出的 main.css 补上同样的缓存指纹（NexT 模板不改，只在渲染结果里替换）。
hexo.extend.filter.register('after_render:html', html => html.replace(
  /(<link[^>]+href=")([^"]*?css\/main\.css)(")/gi,
  (match, head, href, tail) => (/[?&]v=/.test(href) ? match : `${head}${href}?v=${mainCssVersion}${tail}`)
));

/**
 * 构建期统计。
 *
 * 首页右侧的「N 文章 / N 笔记」原来读的是 `source/js/siyuan-data.js` 里的
 * `articleCount` —— 那是笔记同步脚本（每天 04:15 / 13:10）抓的快照。
 * 文章是用工作台单独上传的，同步没跑，这个数字就一直停在旧值：
 * 11-02 发了《岁月史书》，首页还写着 5 篇。
 *
 * 所以这里在构建时直接数：文章数取 Hexo 的 posts，笔记数数 `source/siyuan`
 * 下生成的 index.md（排除 daily-note）。构建一次就一定是当次真实的数。
 */
function countSiteStats() {
  const stats = { articles: 0, notes: 0, daily: 0 };
  try {
    stats.articles = hexo.locals.get('posts').length;
  } catch (err) {
    hexo.log.warn(`[stats] 读不到文章列表：${err.message}`);
  }
  const siyuanRoot = path.join(hexo.base_dir, 'source', 'siyuan');
  try {
    const walk = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name === 'index.md') {
          const relative = path.relative(siyuanRoot, full).split(path.sep).join('/');
          if (relative.startsWith('daily-note/')) stats.daily += 1;
          else stats.notes += 1;
        }
      }
    };
    walk(siyuanRoot);
  } catch (err) {
    hexo.log.warn(`[stats] 数不到笔记目录：${err.message}`);
  }
  return stats;
}

// 注意：脚本是在 Hexo 载入阶段执行的，那时 posts 还没读完，
// `hexo.locals.get('posts').length` 会得到 0。所以必须等到真正渲染时才数，
// 并且缓存第一次的结果，避免每页都去遍历一遍目录。
let cachedStats = null;

hexo.extend.filter.register('after_render:html', html => {
  if (!cachedStats) {
    cachedStats = countSiteStats();
    hexo.log.info(`[stats] 文章 ${cachedStats.articles} 篇，笔记 ${cachedStats.notes} 篇（日记 ${cachedStats.daily} 篇）`);
  }
  const payload = JSON.stringify(cachedStats).replace(/</g, '\\u003c');
  const tag = `<script>window.__SITE_STATS__=${payload};</script>`;
  return html.includes('</head>') ? html.replace('</head>', `${tag}</head>`) : html;
});

// Defer below-the-fold content images without delaying the small profile avatar.
hexo.extend.filter.register('after_render:html', html => html.replace(/<img\b(?![^>]*\bloading=)([^>]*?)>/gi, (tag, attrs) => {
  if (/\/images\/avatar\.(?:jpe?g|png|webp)/i.test(attrs)) return tag;
  return `<img loading="lazy" decoding="async"${attrs}>`;
}));
