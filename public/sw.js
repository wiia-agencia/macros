/* Macros · service worker: guarda la app en el móvil para abrirla sin conexión.
   La página se pide siempre primero a la red (así un cambio llega a la primera); si no hay red, o tarda, sale la guardada.
   No guarda nada de lo que apuntas: eso vive en el almacenamiento del navegador. */
const VERSION = 'bc9eb7a96367';
const CACHE = 'macros-' + VERSION;
const FIJOS = ['/', '/manifest.webmanifest', '/icono.svg', '/icono-180.png', '/icono-192.png', '/icono-512.png', '/icono-maskable-512.png'];
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FIJOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.indexOf('macros-') === 0 && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  if (r.mode !== 'navigate') {                                         // iconos y manifiesto: lo guardado; si no está, la red
    e.respondWith(caches.match(r, { cacheName: CACHE }).then((g) => g || fetch(r)));
    return;
  }
  const red = fetch(r).then((x) => {                                   // la página: de la red, y de paso se guarda la nueva
    if (!x.ok) return x;
    const copia = x.clone();
    return caches.open(CACHE).then((c) => c.put('/', copia)).then(() => x);
  });
  e.waitUntil(red.catch(() => {}));
  e.respondWith(caches.match('/', { cacheName: CACHE }).then((guardada) => {
    if (!guardada) return red;
    return Promise.race([red.then((x) => (x.ok ? x : guardada)), espera(3000).then(() => guardada)]).catch(() => guardada);
  }));
});
