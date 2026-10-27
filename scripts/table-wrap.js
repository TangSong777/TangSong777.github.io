/* 给 Markdown 生成的裸 <table> 包一层 .table-container。
 *
 * 为什么需要：siyuan-knowledge.css 里 .table-container 的圆角、阴影、
 * overflow-x: auto 早就写好了，但 hexo 的 markdown 渲染器只吐裸 <table>，
 * 这层容器从来没出现过 —— 窄屏上宽表格直接被 .post-block 的 overflow: hidden 裁掉。
 *
 * 注意：Hexo 的代码高亮会把代码包成 <figure class="highlight"><table>…
 * 那张表是行号用的，绝不能包（会破坏代码块布局）。
 */
'use strict';

var RE_FIGURE = /(<figure class="highlight[\s\S]*?<\/figure>)/g;
var RE_TABLE = /<table(?:\s[^>]*)?>[\s\S]*?<\/table>/g;

function wrapTables(html) {
  return html.replace(RE_TABLE, function (table) {
    return '<div class="table-container">' + table + '</div>';
  });
}

hexo.extend.filter.register('after_render:html', function (str) {
  var parts = str.split(RE_FIGURE);
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].indexOf('<figure class="highlight') !== 0) {
      parts[i] = wrapTables(parts[i]);
    }
  }
  return parts.join('');
});
