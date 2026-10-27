/**
 * 原样输出 404 页。
 *
 * 为什么不放 source/404.html：Hexo 会把 source 下的 .html 当「页面」，
 * 用主题模板渲染一遍，内联 <style> 会被塞进 <meta name="description">，
 * 样式全部失效。放在 scripts/ 下不参与页面渲染，这里手动写到 public/。
 */
'use strict';

const fs = require('fs');
const path = require('path');

hexo.extend.filter.register('after_generate', function () {
  const src = path.join(hexo.base_dir, 'assets', '404.html');
  const dest = path.join(hexo.public_dir, '404.html');
  if (!fs.existsSync(src)) {
    hexo.log.warn('[404] 找不到 scripts/404.html，跳过');
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  hexo.log.info('[404] 已写出 ' + dest);
});
