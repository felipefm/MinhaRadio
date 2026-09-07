/* Service Worker — Rádio Player Online v3.0
   Caminhos relativos: funciona em qualquer subpasta / repositório. */
const CACHE_NAME = 'radio-player-v3.0.0';

const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './radioData.js',
    './wakeLock.js',
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
            .catch((err) => console.error('SW: falha ao cachear o app shell', err))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Só gerencia recursos do próprio app. Streams de áudio e a API de busca
    // passam direto pela rede (nunca são cacheados).
    if (url.origin !== self.location.origin) return;
    if (/\.(mp3|aac|m3u8|ts|ogg|opus|pls)(\?|$)/i.test(url.pathname)) return;

    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req)
                .then((res) => {
                    if (res && res.ok && res.type === 'basic') {
                        const copy = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
                    }
                    return res;
                })
                .catch(() => caches.match('./index.html'));
        })
    );
});
