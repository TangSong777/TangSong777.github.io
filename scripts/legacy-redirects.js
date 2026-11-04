// 历史永久链接的兼容跳转。
//
// 背景：CI 很长时间跑在 UTC 下，而 Hexo 用「进程时区」格式化文章日期，
// 于是 `date: 2026-10-25 00:20:00` 的文章在线上落到了 /2026/10/24/。
// 现在 workflow 已固定 TZ=Asia/Shanghai，正确地址变成 /2026/10/25/。
// 为了让已经流出去的旧链接（收藏、外站引用、搜索引擎收录）不 404，
// 这里给受影响的旧地址生成一个 0 秒跳转页，并声明 canonical 指向新地址。
const LEGACY_REDIRECTS = [
  { from: '2026/10/24/rock5b-services/', to: '/2026/10/25/rock5b-services/' },
];

function redirectHtml(target) {
  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="UTF-8">',
    `<meta http-equiv="refresh" content="0; url=${target}">`,
    `<link rel="canonical" href="${target}">`,
    '<meta name="robots" content="noindex">',
    `<title>页面已移动</title>`,
    `<script>location.replace(${JSON.stringify(target)});</script>`,
    '</head>',
    '<body style="font-family:system-ui,sans-serif;padding:40px;color:#4c4948">',
    `<p>这个地址已经更新，正在跳转到 <a href="${target}">${target}</a>。</p>`,
    '</body>',
    '</html>',
  ].join('\n');
}

hexo.extend.generator.register('legacy-redirects', function () {
  return LEGACY_REDIRECTS.map((item) => ({
    path: `${item.from}index.html`,
    data: redirectHtml(item.to),
  }));
});
