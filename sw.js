/* Service Worker — Rádio Player Online v3.4
   Caminhos relativos: funciona em qualquer subpasta / repositório. */
const CACHE_NAME = 'radio-player-v3.4.1';

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
        caches.open(CACHE_NAME).then((cache) =>
            // Busca cada asset ignorando o cache HTTP do navegador (senão o
            // Service Worker pode guardar uma cópia requentada no meio de uma
            // atualização). Um asset que falhar não derruba a instalação toda.
            Promise.all(
                ASSETS.map((url) =>
                    fetch(url, { cache: 'reload' })
                        .then((res) => (res && res.ok ? cache.put(url, res) : null))
                        .catch(() => {})
                )
            )
        )
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

    // App shell: rede primeiro (sempre pega a versão mais nova quando online);
    // o cache só entra como fallback para continuar funcionando offline.
    // `no-cache` força revalidar com o servidor: o host manda os arquivos com
    // max-age de horas, e sem isso o navegador podia entregar um app.js velho
    // junto de um index.html novo (botão novo na tela, mas sem o código dele).
    event.respondWith(
        fetch(req, { cache: 'no-cache' })
            .then((res) => {
                if (res && res.ok && res.type === 'basic') {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
                }
                return res;
            })
            .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
});
