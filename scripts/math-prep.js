'use strict';

/**
 * 渲染前的两处 Markdown 清理（只改渲染输入，不写回源文件）。
 *
 * 1) `$$ … $$` 压成单行
 *    hexo-renderer-marked 会把跨行的 $$ 块拆成 <p>$$<br>…<br>$$</p>，
 *    而 hexo-filter-mathjax 在 after_post_render 阶段按文本节点找定界符，
 *    夹进 <br> 之后就认不出来，公式只能以源码形式露出来。
 *    这里在 before_post_render 阶段把块内换行压成空格。
 *
 * 2) 去掉零宽空格 U+200B
 *    思源导出会在标题/正文里塞零宽空格（例如 `## **2.**​[链接]`），
 *    它会把 Markdown 的强调语法切断，页面上就显示成 `**2.**` 这样的字面星号。
 *
 * 代码块（``` 围栏 / 缩进代码）内的内容一律跳过，避免破坏示例。
 */
hexo.extend.filter.register('before_post_render', function (data) {
  var text = data.content;
  if (typeof text !== 'string' || !text) return data;

  var lines = text.split('\n');
  var out = [];
  var inFence = false;
  var fence = '';

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();

    if (inFence) {
      if (trimmed.indexOf(fence) === 0) inFence = false;
      out.push(line);
      continue;
    }

    var m = /^(```+|~~~+)/.exec(trimmed);
    if (m) {
      inFence = true;
      fence = m[1];
      out.push(line);
      continue;
    }

    out.push(line.split('\u200b').join(''));
  }

  var cleaned = out.join('\n');

  // 压平 $$ … $$ 块（跳过围栏内内容由上面的循环保证：这里再按同样的围栏切一遍）
  var parts = cleaned.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/);
  for (var k = 0; k < parts.length; k++) {
    if (k % 2 === 1) continue; // 奇数下标是围栏块
    parts[k] = parts[k].replace(/\$\$([\s\S]*?)\$\$/g, function (whole, body) {
      return '$$' + body.replace(/\s*\n\s*/g, ' ').trim() + '$$';
    });
  }

  data.content = parts.join('');
  return data;
});
