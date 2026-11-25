/* Service worker: permite abrir la app sin internet.
   Cambia VERSION cada vez que subas cambios para que los celulares se actualicen. */
const VERSION = 'jabelya-v7';
const ARCHIVOS = [
  './', 'index.html', 'pedidos/', 'pedidos/manifest.webmanifest', 'styles.css', 'app.js', 'db.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'assets/gota.png', 'assets/logo.jpg',
  'assets/stickers/en-camino.webp', 'assets/stickers/gracias.webp', 'assets/stickers/con-gusto.webp', 'assets/stickers/a-la-orden.webp',
  'dueno/', 'dueno/manifest.webmanifest',
  'icons/dueno-192.png', 'icons/dueno-512.png',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin) {
    // Primero internet (para tener siempre la última versión), si no hay, la copia guardada.
    e.respondWith(fetch(e.request).then((r) => { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  }
});
