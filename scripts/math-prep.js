'use strict';

/**
 * 思源导出的 Markdown 预处理 + 高亮补转
 *
 * 1) before_post_render：去掉 U+200B 零宽空格（思源导出会插在 ** 与 [ 之间，
 *    切断 Markdown 强调语法，页面会露出字面 **2.**）；
 *    把跨行 $$ … $$ 压成单行（hexo-filter-mathjax 在 after_post_render 跑，
 *    多行公式被 marked 插进 <br> 后就认不出定界符了）；
 *    清掉思源 `**注意：**​**==…==**` 这类拼接留下的 ****。
 * 2) after_post_render（priority 10，排在 mathjax 的 5 之后）：
 *    把 ==高亮== 转成 <mark>。放在 HTML 阶段做，MathJax 就完全看不到 <mark>，
 *    避免之前在源文本里插入 HTML 标签导致 MathJax 抛
 *    "Can't find handler for document" 的问题。
 */

var CJK = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/;

function flattenDisplayMath(text) {
  var parts = text.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/);
  for (var i = 0; i < parts.length; i++) {
    if (i % 2 === 1) continue;
    parts[i] = parts[i].replace(/\$\$([\s\S]*?)\$\$/g, function (whole, body) {
      return '$$' + body.replace(/\s*\n\s*/g, ' ').trim() + '$$';
    });
  }
  return parts.join('');
}

function convertHighlights(html) {
  // 代码块 / 行内代码里不能改；按标签切段，只处理文本段
  var chunks = String(html).split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>)/i);
  for (var i = 0; i < chunks.length; i++) {
    if (i % 2 === 1) continue;
    chunks[i] = chunks[i].replace(/==([^=\n<][^\n<]{0,200}?)==/g, function (whole, body) {
      if (body.indexOf('==') !== -1) return whole;
      if (!CJK.test(body)) return whole;
      return '<mark>' + body + '</mark>';
    });
  }
  return chunks.join('');
}

hexo.extend.filter.register('before_post_render', function (data) {
  var text = data.content;
  if (typeof text !== 'string' || !text) return data;
  text = text.split('\u200b').join('');
  text = flattenDisplayMath(text);
  text = text.replace(/\*{4,}/g, '');
  data.content = text;
  return data;
});

hexo.extend.filter.register('after_post_render', function (data) {
  if (typeof data.content !== 'string') return data;
  if (data.content.indexOf('==') === -1) return data;
  data.content = convertHighlights(data.content);
  return data;
}, 10);
