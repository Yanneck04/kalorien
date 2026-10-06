// Service Worker – Kalorien & Gewicht
// Bei jeder Änderung an den App-Dateien die Versionsnummer erhöhen.
const VERSION = 'kalorien-v2';
const SHELL_CACHE = VERSION;
const RUNTIME_CACHE = 'kalorien-runtime-v1';

const SHELL_FILES = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png'
];

// Fremde Hosts, die cache-first im Laufzeit-Cache landen dürfen
const CACHEABLE_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    try {
      await cache.addAll(SHELL_FILES);
    } catch (e) {
      // Einzeln versuchen, damit ein fehlender Eintrag nicht alles blockiert
      await Promise.all(SHELL_FILES.map(async (url) => {
        try { await cache.add(url); } catch (err) { /* ignorieren */ }
      }));
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = [SHELL_CACHE, RUNTIME_CACHE];
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // POST (z. B. api.anthropic.com) nie anfassen

  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // Network-first für alle eigenen Dateien: nach einem Update kommen index.html,
    // app.js und styles.css sofort gemeinsam in der neuen Version (kein Mischstand).
    // Offline greift der Cache.
    const isHtml = req.mode === 'navigate' ||
      (req.headers.get('accept') || '').includes('text/html');
    event.respondWith(networkFirst(req, isHtml));
    return;
  }

  if (CACHEABLE_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req));
  }
  // Alle anderen Origins (u. a. api.anthropic.com): nicht abfangen
});

async function networkFirst(req, isHtml) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    // no-cache: beim Server nachfragen statt den HTTP-Cache (GitHub Pages: 10 min) zu nehmen
    const res = await fetch(req, { cache: 'no-cache' });
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const cached = (await cache.match(req, { ignoreSearch: true })) ||
      (isHtml ? (await cache.match('index.html')) || (await cache.match('./')) : null);
    if (cached) return cached;
    return new Response('Offline – bitte später erneut versuchen.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
  return res;
}
