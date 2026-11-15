// Service worker for the installed web app.
// It only shows a friendly page when a screen is opened with no connection.
// It never stores pages, API answers or finance data on the phone.
/** The project type check uses DOM types, which lack service worker globals. */
const worker = /** @type {any} */ (self);
const CACHE = 'mamoor-offline-v1';
const OFFLINE_URL = '/offline.html';

worker.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .then(() => worker.skipWaiting()),
  );
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => worker.clients.claim()),
  );
});

worker.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
