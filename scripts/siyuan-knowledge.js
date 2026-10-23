/* Custom assets injected without modifying the NexT theme package. */
const siteRoot = hexo.config.root || '/';
const style = `<link rel="stylesheet" href="${siteRoot}css/siyuan-knowledge.css">`;
// 导航流畅化：浏览器预渲染（悬停即准备）+ 跨文档平滑过渡，纯原生零 JS 开销
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

const icons = `<link rel="stylesheet" href="${siteRoot}css/icons.css">`;
const shell = `<script src="${siteRoot}js/site-shell.js?v=20261021" defer></script>`;
const knowledge = `<script src="${siteRoot}js/siyuan-data.js?v=20261021" defer></script><script src="${siteRoot}js/siyuan-knowledge.js?v=20261021" defer></script>`;

// 外壳脚本全站需要，样式和知识库数据按页注入（见下方过滤器）
hexo.extend.injector.register('head_end', style, 'page');
hexo.extend.injector.register('head_end', style, 'home');
['home', 'post', 'page', 'archive', 'tag', 'category'].forEach(type => {
  hexo.extend.injector.register('head_end', navEnhance, type);
  hexo.extend.injector.register('body_end', shell, type);
});

// 知识库索引与交互脚本只在 /siyuan/ 页面加载
hexo.extend.injector.register('body_end', knowledge, 'page');
hexo.extend.injector.register('body_end', knowledge, 'home');

// 非知识库页面移除 siyuan-* 资源（样式 35KB + 脚本 39KB），避免白加载
hexo.extend.filter.register('after_render:html', (html, data) => {
  const pagePath = String((data && data.path) || '');
  // 知识库页面（siyuan/... 与首页 siyuan 目录）保留资源
  if (pagePath.startsWith('siyuan/') || pagePath.startsWith('siyuan\\')) return html;
  return html
    .replace(/<link[^>]+href="[^"]*siyuan-knowledge\.css[^"]*"[^>]*>\s*/g, '')
    .replace(/<script[^>]+src="[^"]*siyuan-data\.js[^"]*"[^>]*>\s*<\/script>\s*/g, '')
    .replace(/<script[^>]+src="[^"]*siyuan-knowledge\.js[^"]*"[^>]*>\s*<\/script>\s*/g, '');
});

// Defer below-the-fold content images without delaying the small profile avatar.
hexo.extend.filter.register('after_render:html', html => html.replace(/<img\b(?![^>]*\bloading=)([^>]*?)>/gi, (tag, attrs) => {
  if (/\/images\/avatar\.(?:jpe?g|png|webp)/i.test(attrs)) return tag;
  return `<img loading="lazy" decoding="async"${attrs}>`;
}));
