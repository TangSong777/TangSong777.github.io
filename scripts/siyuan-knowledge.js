/* Custom assets injected without modifying the NexT theme package. */
const siteRoot = hexo.config.root || '/';
const style = `<link rel="stylesheet" href="${siteRoot}css/siyuan-knowledge.css">`;
const shell = `<script src="${siteRoot}js/site-shell.js" defer></script>`;
const knowledge = `<script src="${siteRoot}js/siyuan-data.js" defer></script><script src="${siteRoot}js/siyuan-knowledge.js" defer></script>`;

['home', 'post', 'page', 'archive'].forEach(type => {
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
