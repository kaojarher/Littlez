/* 小智 PWA Service Worker
   - 殼層（HTML / 圖示）：網路優先，離線時退回快取，確保更新能即時生效
   - 3D 模型（raw.githubusercontent.com）：快取優先，離線也能顯示角色
   - AI 對話 API（Puter / OpenAI 相容端點 / Ollama）一律不攔截 */
var VERSION = 'xiaozhi-v1';
var SHELL = VERSION + '-shell';
var RUNTIME = VERSION + '-runtime';
var SHELL_FILES = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './maskable-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL).then(function (c) {
      return Promise.all(SHELL_FILES.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf(VERSION) !== 0; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function networkFirst(req, cacheName) {
  return fetch(req).then(function (res) {
    if (res && (res.ok || res.type === 'opaque')) {
      var copy = res.clone();
      caches.open(cacheName).then(function (c) { c.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) {
      return hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
    });
  });
}
function cacheFirst(req, cacheName) {
  return caches.match(req).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) {
        var copy = res.clone();
        caches.open(cacheName).then(function (c) { c.put(req, copy); });
      }
      return res;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(networkFirst(req, SHELL));
  } else if (url.hostname === 'raw.githubusercontent.com' && /\.vrm($|\?)/i.test(url.pathname)) {
    e.respondWith(cacheFirst(req, RUNTIME));
  } else if (url.hostname === 'js.puter.com') {
    e.respondWith(networkFirst(req, RUNTIME));
  }
  // 其他（含所有 AI API）不攔截，直接走網路
});

self.addEventListener('message', function (e) {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
