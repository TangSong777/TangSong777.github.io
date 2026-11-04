/* 站点 Service Worker
   目的：把「HTML → CSS/JS」这两轮往返压成一轮，二次访问几乎零等待。
   策略：
     - 带 ?v= 版本号的静态资源：缓存优先（URL 变了自然会取新的）
     - 不带宽高号的静态资源（主题自带的 utils/sidebar/next-boot）：先用缓存、后台刷新
     - 页面导航：网络优先，失败回落缓存（离线也能看）
   版本号由 scripts/sw-version.js 在每次构建时替换，激活时清掉旧版本缓存。 */
var VERSION = '__SITE_VERSION__';
var CACHE = 'yhblog-' + VERSION;
var ASSET_RE = /^\/(css|js|images|img|fonts)\//;

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key.indexOf('yhblog-') === 0 && key !== CACHE) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function put(cache, request, response) {
  if (response && response.ok && response.status === 200) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (ASSET_RE.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(function (cache) {
        return cache.match(request).then(function (hit) {
          if (hit) {
            if (!url.search) {
              // 没有版本号的资源：先给旧的，后台悄悄更新
              fetch(request).then(function (res) { put(cache, request, res); }).catch(function () {});
            }
            return hit;
          }
          return fetch(request).then(function (res) { return put(cache, request, res); });
        });
      })
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (res) {
        return caches.open(CACHE).then(function (cache) { return put(cache, request, res); });
      }).catch(function () {
        return caches.match(request).then(function (hit) { return hit || caches.match('/'); });
      })
    );
  }
});
