/* 只在产物上压缩 CSS：源码保持可读，public/css/siyuan-knowledge.css 出站前压一遍。
   - 去掉注释、把连续空白折成一个空格、去掉 {} 与 , 两侧的空格
   - 字符串（单双引号）内的内容原样保留，避免吃掉 content: " " 这类写法
   - 不动 calc() 里的空格（我们不去 + - 两侧的空白）
   - 压缩后若产物反而变大，就保留原文件

   注意：after_generate 触发时 source 下的静态文件还没被拷进 public
   （实测那一刻 public/css/siyuan-knowledge.css 不存在），所以主入口挂在
   hexo.on('exit')，after_generate 作为兜底。 */
'use strict';

const fs = require('fs');
const path = require('path');

const TARGETS = ['css/siyuan-knowledge.css', 'css/main.css'];

function minifyCss(input) {
  let out = '';
  let i = 0;
  const n = input.length;
  while (i < n) {
    const ch = input[i];
    if (ch === '/' && input[i + 1] === '*') {
      const end = input.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      out += ch;
      i++;
      while (i < n) {
        const c = input[i];
        out += c;
        i++;
        if (c === '\\') {
          if (i < n) { out += input[i]; i++; }
          continue;
        }
        if (c === quote) break;
      }
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f') {
      let j = i;
      while (j < n && ' \t\n\r\f'.includes(input[j])) j++;
      const prev = out[out.length - 1];
      const next = input[j];
      const drop = prev === undefined || next === undefined ||
        '{};,>'.includes(prev) || '{};,>'.includes(next);
      if (!drop) out += ' ';
      i = j;
      continue;
    }
    out += ch;
    i++;
  }
  return out.trim() + '\n';
}

function runAll(tag) {
  const log = [];
  for (const rel of TARGETS) {
    const file = path.join(hexo.public_dir, rel);
    if (!fs.existsSync(file)) { log.push(rel + ' 不存在'); continue; }
    const raw = fs.readFileSync(file, 'utf8');
    const mini = minifyCss(raw);
    if (mini.length >= raw.length) { log.push(rel + ' 没变小，保留'); continue; }
    fs.writeFileSync(file, mini, 'utf8');
    log.push(rel + ' ' + raw.length + ' → ' + mini.length + ' (-' +
      ((1 - mini.length / raw.length) * 100).toFixed(1) + '%)');
  }
  try { fs.writeFileSync('/tmp/css-min.log', tag + ': ' + log.join(' / ') + '\n'); } catch (e) {}
  log.forEach(function (line) { hexo.log.info('[css-min:' + tag + '] ' + line); });
}

hexo.extend.filter.register('after_generate', function () { runAll('after_generate'); });
hexo.on('exit', function () { runAll('exit'); });
