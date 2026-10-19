/* 薄肌健康 - Service Worker 离线缓存 */
var CACHE_NAME = 'boji-health-v16';
var ASSETS = [
  './',
  './index.html',
  './profile.html',
  './water.html',
  './sleep.html',
  './eat.html',
  './move.html',
  './week.html',
  './data.html',
  './settings.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './css/style.css',
  './js/storage.js',
  './js/calculator.js',
  './js/water.js',
  './js/sleep.js',
  './js/share.js',
  './js/exporter.js',
  './js/menu.js',
  './js/chart.js',
  './js/chart.umd.min.js',
  './js/app.js',
  './data/prompts/daily.txt',
  './data/prompts/weekly.txt',
  './data/prompts/food.txt',
  './data/prompts/body.txt',
  './data/prompts/sleep.txt',
  './sell/README.md',
  './README.md'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // 逐个添加，避免个别404导致整体失败
      return Promise.allSettled(ASSETS.map(function (url) { return cache.add(url); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_NAME) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* 页面点击"发现新版本"后发消息：立即接管所有客户端（v1.12） */
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'TAKE_OVER') {
    self.skipWaiting();
    self.clients.claim();
  }
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (resp) {
        // 同源资源顺手缓存；CDN（Chart.js）失败时返回离线提示由页面处理
        if (resp && resp.status === 200) {
          var copy = resp.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(e.request, copy); });
        }
        return resp;
      }).catch(function () {
        if (e.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
