/* Custom assets injected without modifying the NexT theme package. */
const siteRoot = hexo.config.root || '/';
const style = `<link rel="stylesheet" href="${siteRoot}css/siyuan-knowledge.css">`;
const shell = `<script src="${siteRoot}js/site-shell.js?v=20261028" defer></script>`;
const knowledge = `<script src="${siteRoot}js/siyuan-data.js?v=20261028" defer></script><script src="${siteRoot}js/siyuan-knowledge.js?v=20261028" defer></script>`;

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

// Defer below-the-fold content images without delaying the small profile avatar.
hexo.extend.filter.register('after_render:html', html => html.replace(/<img\b(?![^>]*\bloading=)([^>]*?)>/gi, (tag, attrs) => {
  if (/\/images\/avatar\.(?:jpe?g|png|webp)/i.test(attrs)) return tag;
  return `<img loading="lazy" decoding="async"${attrs}>`;
}));
