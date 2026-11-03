// يعمل بدون إنترنت: يخزّن كل ملفات التطبيق
const VERSION = 'waqti-v1.0.0';
const CORE = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/store.js', 'js/time.js', 'js/i18n.js', 'js/ui.js', 'js/router.js', 'js/worship.js', 'js/schedule.js',
  'js/notify.js', 'js/ics.js', 'js/cities.js', 'js/itemform.js',
  'js/views/today.js', 'js/views/tasks.js', 'js/views/worship.js', 'js/views/study.js', 'js/views/health.js', 'js/views/habits.js',
  'js/views/family.js', 'js/views/stats.js', 'js/views/settings.js', 'js/views/cats.js', 'js/views/more.js', 'js/views/onboarding.js', 'js/views/fields.js',
  'vendor/adhan.js', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'i18n/en.json', 'i18n/ar.json',
];
const LANGS = ['fr', 'es', 'pt', 'de', 'it', 'nl', 'ru', 'uk', 'pl', 'tr', 'el', 'fa', 'ur', 'he', 'hi', 'bn', 'ta', 'zh', 'ja', 'ko', 'id', 'ms', 'vi', 'th', 'tl', 'sw'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(CORE);
    await Promise.all(LANGS.map((l) => c.add(`i18n/${l}.json`).catch(() => {})));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cached = await caches.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(async (r) => {
      if (r.ok) (await caches.open(VERSION)).put(e.request, r.clone());
      return r;
    }).catch(() => null);
    return cached || (await net) || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error());
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return self.clients.openWindow('./#/today');
  })());
});
