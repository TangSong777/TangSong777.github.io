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
/* ── 页面模式类：构建期写进 <body>，而不是等 JS 运行时再加 ─────────────
   站点有四套版式，全靠 body 上的模式类切换：
     blog-home-mode / blog-post-mode / archive-mode / siyuan-mode（+ is-knowledge-home）
   这些类原来分别由 site-shell.js、siyuan-knowledge.js 在 body_end 才加，
   于是浏览器先把 NexT 的旧布局画一遍，类名到位后再整块挪位：
   实测首页版心宽度会先按 1280px 画一次再变成 1180px（CLS 0.16），
   归档页顶栏先只有品牌带、导航解析完再顶下来 68px（CLS 0.19）。
   这里在构建期就把类写进 <body>，样式从第一帧就是最终形态。 */
/* 关掉 JavaScript 时：首页列表、笔记的目录树、侧栏卡片都不出现，
   正文虽然还在，但页面上没有任何可点的入口。这里塞一段纯 HTML 的提示。 */
const noScriptHint = '<noscript class="noscript-hint">本站的目录与文章列表由脚本渲染，'
  + '开启 JavaScript 可获得完整体验；也可以直接浏览 <a href="/archives/">文章归档</a>、'
  + '<a href="/siyuan/">学习笔记</a>、<a href="/tags/">标签</a>。</noscript>';
hexo.extend.filter.register('after_render:html', html => {
  if (html.includes('noscript-hint')) return html;
  return html.replace(/<body([^>]*)>/i, function (m, attrs) {
    return '<body' + attrs + '>' + noScriptHint;
  });
});

hexo.extend.filter.register('after_render:html', (html, locals) => {
  if (!locals || !locals.path) return html;
  const page = locals.page || {};
  const p = '/' + String(locals.path).replace(/index\.html$/, '').replace(/^\/+|\/+$/g, '');
  const cls = [];

  if (/^\/(archives|tags|categories)(\/|$)/.test(p)) {
    cls.push('archive-mode');
  } else if (/^\/siyuan(\/|$)/.test(p)) {
    cls.push('siyuan-mode');
    if (p === '/siyuan') cls.push('is-knowledge-home');
  } else if (p === '/') {
    cls.push('blog-home-mode');
  } else if (page.layout === 'post') {
    cls.push('blog-post-mode');
  }
  if (!cls.length) return html;

  const names = cls.join(' ');
  return html.replace(/<body\b([^>]*)>/i, (match, attrs) => {
    if (/\sclass\s*=\s*"[^"]*"/i.test(attrs)) {
      return match.replace(/\sclass\s*=\s*"([^"]*)"/i, (m, old) => ` class="${old} ${names}"`);
    }
    return `<body${attrs} class="${names}">`;
  });
});

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
          /* 首页自身（relative === 'index.md'）不算一个分区。 */
          const top = relative.indexOf('/') > 0 ? relative.split('/')[0] : '';
          if (top) (stats.partitions = stats.partitions || {})[top] = true;
          /* 日记只算「按天」的那层：daily-note/2026/08/2026-08-03/index.md。
             daily-note/、daily-note/2026/、daily-note/2026/08/ 是目录枢纽页，
             算进「日记文档」会让首页数字比实际日记条数多。 */
          const isDatedDiary = /^daily-note\/(?:\d{4}\/)?(?:\d{2}\/)?\d{4}-\d{2}-\d{2}\/index\.md$/.test(relative);
          if (isDatedDiary) stats.daily += 1;
          else if (relative.startsWith('daily-note/')) stats.dailyHubs = (stats.dailyHubs || 0) + 1;
          else stats.notes += 1;
        }
      }
    };
    walk(siyuanRoot);
  } catch (err) {
    hexo.log.warn(`[stats] 数不到笔记目录：${err.message}`);
  }
  stats.partitions = Object.keys(stats.partitions || {}).length;
  return stats;
}

// 注意：脚本是在 Hexo 载入阶段执行的，那时 posts 还没读完，
// `hexo.locals.get('posts').length` 会得到 0。所以必须等到真正渲染时才数，
// 并且缓存第一次的结果，避免每页都去遍历一遍目录。
let cachedStats = null;

/**
 * 学习笔记首页的 hero 在构建期就写进 HTML。
 *
 * 原来这块是 `source/js/siyuan-knowledge.js` 在 DOMContentLoaded 之后插到
 * `.post-body` 最前面的 —— 插入的瞬间正文整体下移上百像素，是笔记首页
 * CLS 的主要来源（实测 0.12）。改成构建期注入后首帧就是最终布局。
 * 同时把这个页面上与 hero 重复的 `<header class="post-header">` 直接隐藏，
 * 免得客户端再隐藏一次又跳一下。
 */
function injectKnowledgeHero(html, locals) {
  if (html.indexOf('class="siyuan-hero"') >= 0) return html;
  const stats = cachedStats || { notes: 0, daily: 0, partitions: 0 };
  const title = (locals.page && locals.page.title) || '学习笔记';
  const hero = `<section class="siyuan-hero">`
    + `<div class="siyuan-hero-kicker">PERSONAL KNOWLEDGE BASE</div>`
    + `<h1>${title}</h1>`
    + `<p>沿着主题探索笔记，也可以顺着引用回到知识形成的上下文。这里与普通博客时间线相互独立。</p>`
    + `<div class="siyuan-stats">`
    + `<div class="siyuan-stat"><strong>${stats.notes}</strong><span>主题文档</span></div>`
    + `<div class="siyuan-stat"><strong>${stats.daily || 0}</strong><span>日记文档</span></div>`
    + `<div class="siyuan-stat"><strong>${stats.partitions || 0}</strong><span>知识分区</span></div>`
    + `</div></section>`;

  let out = html;
  const open = /<div\b[^>]*class="[^"]*\bpost-body\b[^"]*"[^>]*>/.exec(out);
  if (open) {
    const at = open.index + open[0].length;
    out = out.slice(0, at) + hero + out.slice(at);
  }
  out = out.replace(/<header\b([^>]*class="[^"]*\bpost-header\b[^"]*"[^>]*)>/,
    '<header$1 style="display:none">');
  return out;
}

hexo.extend.filter.register('after_render:html', (html, locals) => {
  if (!cachedStats) {
    cachedStats = countSiteStats();
    hexo.log.info(`[stats] 文章 ${cachedStats.articles} 篇，笔记 ${cachedStats.notes} 篇（日记 ${cachedStats.daily} 篇，知识分区 ${cachedStats.partitions} 个）`);
  }
  const payload = JSON.stringify(cachedStats).replace(/</g, '\\u003c');
  const tag = `<script>window.__SITE_STATS__=${payload};</script>`;
  let out = html.includes('</head>') ? html.replace('</head>', `${tag}</head>`) : html;
  if (locals && locals.path === 'siyuan/index.html') out = injectKnowledgeHero(out, locals);
  return out;
});

// Defer below-the-fold content images without delaying the small profile avatar.
hexo.extend.filter.register('after_render:html', html => html.replace(/<img\b(?![^>]*\bloading=)([^>]*?)>/gi, (tag, attrs) => {
  if (/\/images\/avatar\.(?:jpe?g|png|webp)/i.test(attrs)) return tag;
  return `<img loading="lazy" decoding="async"${attrs}>`;
}));

/**
 * 同名文档消歧。
 * 思源里允许两个目录下各有一篇同名文档（例如「嵌入式/STM32/知识点大纲」和
 * 「嵌入式/ESP32/知识点大纲」），导出来就是两个 <title>知识点大纲 | 学习与思考</title>：
 * 浏览器标签、收藏夹、搜索结果里完全分不清是谁。这里给重复的标题补上父级名称，
 * 变成「知识点大纲 · STM32 | 学习与思考」；只改 <title> 和 og:title，正文标题不动。
 */
let duplicateTitleMap = null;
function loadDuplicateTitles() {
  if (duplicateTitleMap) return duplicateTitleMap;
  duplicateTitleMap = new Map();
  try {
    const file = path.join(hexo.base_dir, 'source/js/siyuan-data.js');
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    const byTitle = new Map();
    (data.documents || []).forEach(doc => {
      const list = byTitle.get(doc.title) || [];
      list.push(doc);
      byTitle.set(doc.title, list);
    });
    byTitle.forEach((docs, title) => { if (docs.length > 1) duplicateTitleMap.set(title, docs); });
    if (duplicateTitleMap.size) {
      hexo.log.info(`[notes] 同名文档 ${duplicateTitleMap.size} 组，已按父级补全标题`);
    }
  } catch (err) {
    hexo.log.warn(`[notes] 同名标题检测跳过：${err.message}`);
  }
  return duplicateTitleMap;
}

/**
 * 社交卡片：NexT 默认只输出 og:title/description，没有配图，
 * 于是微信、Telegram、Twitter 抓到的都是纯文字卡片。
 * 这里给全站补一张 1200×630 的封面（source/images/og-cover.jpg，
 * 由首页 hero 的配色渲染而来），并把 twitter:card 升成大图模式。
 */
hexo.extend.filter.register('after_render:html', html => {
  if (!html.includes('</head>') || html.includes('property="og:image"')) return html;
  const image = `${hexo.config.url.replace(/\/$/, '')}${siteRoot}images/og-cover.jpg`;
  const tags = [
    `<meta property="og:image" content="${image}">`,
    '<meta property="og:image:type" content="image/jpeg">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="学习与思考 · 个人博客与学习笔记知识库">',
    `<meta name="twitter:image" content="${image}">`,
  ].join('');
  const withImage = html.replace('</head>', tags + '</head>');
  // NexT 已经写过 <meta name="twitter:card" content="summary">，
  // 带图时应当是大图卡片，直接改值而不是再塞一个重复标签。
  return withImage.replace(
    /<meta name="twitter:card" content="[^"]*">/,
    '<meta name="twitter:card" content="summary_large_image">'
  );
});

hexo.extend.filter.register('after_render:html', (html, locals) => {
  const p = (locals && locals.path) || '';
  if (p.indexOf('siyuan/') !== 0) return html;
  const dups = loadDuplicateTitles();
  if (!dups.size) return html;
  const pageUrl = '/' + p.replace(/index\.html$/, '');
  let hit = null;
  dups.forEach(docs => docs.forEach(doc => { if (doc.url === pageUrl) hit = doc; }));
  if (!hit || !hit.parts || hit.parts.length < 2) return html;
  const suffix = ' · ' + hit.parts[hit.parts.length - 2];
  return html
    .replace(/<title>([^<|]*?)(\s*\|)/, (m, t, bar) => `<title>${t.trim()}${suffix}${bar}`)
    .replace(/(property="og:title"\s+content=")([^"]*)(")/, (m, a, t, b) => a + t + suffix + b);
});
