/* 把 source/_sw/sw.js 生成为站点根目录的 sw.js，并打上本次构建的时间戳版本。
   `_sw` 目录以 _ 开头，Hexo 不会把它当普通资源复制，因此不会和这里生成的路由冲突。
   用 generator 而不是 after_generate：生成顺序可控，版本号一定落在最终产物里。 */
'use strict';

const fs = require('fs');
const path = require('path');

hexo.extend.generator.register('service-worker', function () {
  const file = path.join(hexo.source_dir, '_sw', 'sw.js');
  if (!fs.existsSync(file)) {
    hexo.log.warn('[sw] source/_sw/sw.js 不存在，跳过');
    return [];
  }
  const version = Date.now().toString(36);
  hexo.log.info('[sw] cache version = ' + version);
  return {
    path: 'sw.js',
    data: fs.readFileSync(file, 'utf8').replace(/__SITE_VERSION__/g, version),
  };
});
