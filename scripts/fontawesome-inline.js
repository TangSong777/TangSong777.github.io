'use strict';

/**
 * 把 Font Awesome 的 <i class="fa fa-xxx"> 换成内联 SVG，并摘掉 cdnjs 的外链 CSS。
 *
 * 为什么这么做（2026-10-28 实测）：
 *   首页 domContentLoaded 1196 ms，本地资源每个只要 4–43 ms，
 *   耗时全部压在 cdnjs 的三个 font-awesome 文件上（609–668 ms），
 *   它们合计 147 KB，占全部传输 381 KB 的 38%，而全站实际只用到 11 个图标。
 *
 * 换成内联 SVG 之后：
 *   - 少 1 个外链 CSS + 2 个 webfont，共 3 个请求、147 KB；
 *   - 图标随 HTML 一起到达，不存在「先空白再补」的跳变；
 *   - 颜色用 currentColor 继承，不再受字体渲染差异影响（板子上的
 *     chromium 曾把某些字符渲染成方块）。
 *
 * 以后如果模板里冒出新图标，会打 warn 并原样保留 <i>，不会静默丢失。
 */

var ICONS = {
  'home': '<path d="M3.2 11.3 12 3.7l8.8 7.6"/><path d="M5.6 9.5V20.3h12.8V9.5"/>',
  'archive': '<rect x="3.2" y="4.2" width="17.6" height="4.2" rx="1"/>' +
    '<path d="M5.2 8.4v10.1a2 2 0 0 0 2 2h9.6a2 2 0 0 0 2-2V8.4"/><path d="M10 12.4h4"/>',
  'book-open': '<path d="M12 6.9c-1.6-1.2-4-2-8.2-2v12.4c4.2 0 6.6.8 8.2 2 1.6-1.2 4-2 8.2-2V4.9c-4.2 0-6.6.8-8.2 2z"/>' +
    '<path d="M12 6.9v12.4"/>',
  'heart': '<path d="M12 20.1S3.6 15 3.6 9.7A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8.4 2.5c0 5.3-8.4 10.4-8.4 10.4z"/>',
  'thumbtack': '<path d="M8 3.8h8"/><path d="M9.7 3.8v5.7l-2.7 3.3h10l-2.7-3.3V3.8"/><path d="M12 12.6v7.8"/>',
  'arrow-up': '<path d="M12 20.2V4.2"/><path d="M5.6 10.6 12 4.2l6.4 6.4"/>',
  'calendar': '<rect x="3.4" y="5.2" width="17.2" height="15.2" rx="2.2"/>' +
    '<path d="M8.2 3.2v4M15.8 3.2v4M3.4 10.2h17.2"/>',
  'calendar-check': '<rect x="3.4" y="5.2" width="17.2" height="15.2" rx="2.2"/>' +
    '<path d="M8.2 3.2v4M15.8 3.2v4M3.4 10.2h17.2"/><path d="M8.8 15.2 11 17.4l4.4-4.6"/>',
  'folder': '<path d="M3.4 7.6a1.6 1.6 0 0 1 1.6-1.6h3.7l2 2.6h8.3a1.6 1.6 0 0 1 1.6 1.6v8.6a1.6 1.6 0 0 1-1.6 1.6H5a1.6 1.6 0 0 1-1.6-1.6z"/>',
  'angle-left': '<path d="M14.6 5.2 7.8 12l6.8 6.8"/>',
  'angle-right': '<path d="M9.4 5.2 16.2 12l-6.8 6.8"/>'
};

var RE_ICON = /<i class="(?:fa|fas|far)\s+fa-([a-z0-9-]+)((?:\s+fa-[a-z0-9-]+)*)"><\/i>/g;
var RE_LINK = /[ \t]*<link[^>]+font-awesome[^>]*>\s*\n?/g;

var unknown = Object.create(null);

function build(name, extra) {
  var body = ICONS[name];
  if (!body) return null;
  var mod = '';
  if (/\bfa-fw\b/.test(extra)) mod = ' fa-icon--fw';
  else if (/\bfa-lg\b/.test(extra)) mod = ' fa-icon--lg';
  return '<svg class="fa-icon' + mod + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    body + '</svg>';
}

hexo.extend.filter.register('after_render:html', function (html) {
  if (html.indexOf('fa-') === -1 && html.indexOf('font-awesome') === -1) return html;

  var replaced = 0;
  var out = html.replace(RE_ICON, function (whole, name, extra) {
    var svg = build(name, extra || '');
    if (svg === null) {
      unknown[name] = true;
      return whole;
    }
    replaced++;
    return svg;
  });

  var droppedLink = RE_LINK.test(out);
  out = out.replace(RE_LINK, '');

  if (droppedLink && replaced > 0) {
    // 只记一次摘要，免得 87 个页面刷屏
    if (!hexo.__faSummaried) {
      hexo.__faSummaried = true;
      hexo.log.info('fontawesome-inline: 图标转为内联 SVG，已移除 cdnjs 外链');
    }
  }
  return out;
});

hexo.extend.filter.register('after_generate', function () {
  var names = Object.keys(unknown);
  if (names.length) {
    hexo.log.warn('fontawesome-inline: 这些图标没有对应的 SVG，已原样保留 <i>：' + names.join(', '));
    hexo.log.warn('fontawesome-inline: 请在 scripts/fontawesome-inline.js 的 ICONS 里补上 path。');
  }
});
