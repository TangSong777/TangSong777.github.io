// 给 <img> 补 width/height —— 图片加载后页面不再跳（CLS）。
// 全站 141 个 <img>，带 width 的是 0 个：字体和 CSS 都按「图还没来」的尺寸排好版，
// 图一到就整体下推。浏览器手里有宽高比就能先留好位置。
//
// 读的是 source/ 而不是 public/：`after_render:html` 触发时 public/ 里的图片
// 还没拷贝过去（那是 after_generate 阶段的事），读 public/ 会全部读空。
'use strict';

var fs = require('fs');
var path = require('path');

var cache = Object.create(null);

function pngSize(buf) {
  if (buf.length < 24) return null;
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function gifSize(buf) {
  if (buf.length < 10) return null;
  if (buf.toString('ascii', 0, 3) !== 'GIF') return null;
  return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
}

function jpegSize(buf) {
  if (buf.length < 4) return null;
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  var i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    var marker = buf[i + 1];
    // SOF0..SOF15，跳过 DHT(C4)/JPG(C8)/DAC(CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
    }
    var len = buf.readUInt16BE(i + 2);
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

function webpSize(buf) {
  if (buf.length < 30) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  var kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8L') {
    var b = buf.readUInt32LE(21);
    return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8X') {
    return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
  }
  return null;
}

function sizeOfFile(abs) {
  if (cache[abs] !== undefined) return cache[abs];
  var size = null;
  try {
    var fd = fs.openSync(abs, 'r');
    var buf = Buffer.alloc(65536);
    var n = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    buf = buf.slice(0, n);
    size = pngSize(buf) || jpegSize(buf) || gifSize(buf) || webpSize(buf);
  } catch (e) {
    size = null;
  }
  if (!size || !size.w || !size.h) size = null;
  cache[abs] = size;
  return size;
}

var stats = { filled: 0, missing: 0, skipped: 0, missingList: {} };

hexo.log.info('[img-size] 脚本已加载');

hexo.extend.filter.register('after_render:html', function (str) {
  var sourceDir = hexo.source_dir;
  var publicDir = hexo.public_dir;

  return str.replace(/<img\b[^>]*>/g, function (tag) {
    if (/\bwidth\s*=/.test(tag) || /\bheight\s*=/.test(tag)) { stats.skipped++; return tag; }

    var m = tag.match(/\bsrc\s*=\s*"([^"]+)"/);
    if (!m || /^https?:|^data:/.test(m[1])) { stats.skipped++; return tag; }

    var rel = decodeURIComponent(m[1].split('?')[0].split('#')[0]);
    if (!/\.(png|jpe?g|gif|webp)$/i.test(rel)) { stats.skipped++; return tag; }

    var bare = rel.replace(/^\/+/, '');
    // source/ 优先（渲染阶段图片还没拷进 public/），public/ 兜底
    var size = sizeOfFile(path.join(sourceDir, bare)) || sizeOfFile(path.join(publicDir, bare));
    if (!size) {
      stats.missing++;
      stats.missingList[rel] = true;
      return tag;
    }

    stats.filled++;
    return tag.replace(/^<img\b/, '<img width="' + size.w + '" height="' + size.h + '"');
  });
});

// 注意：不要在这里打印「补了几个」。Hexo 8 的页面渲染跑在子进程里，
// 父进程的 stats 恒为 0，打出来会是「补宽高 0 个」，纯属误导。
// 验证方式改成直接数产物：
//   grep -rho '<img [^>]*width=' --include=*.html public | wc -l
