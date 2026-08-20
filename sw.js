/* ============================================================
   sw.js — service worker do PWA.

   Estratégia:
     • app shell (HTML/CSS/JS/ícones) → cache primeiro
     • CDNs (Chart.js, Lucide, fontes) → stale-while-revalidate
     • Apps Script (dados) → sempre rede, nunca cacheado
   ============================================================ */

const VERSAO = 'cf-v1';
const SHELL = `${VERSAO}-shell`;
const EXTERNO = `${VERSAO}-cdn`;

const ARQUIVOS = [
  './',
  './index.html',
  './manifest.json',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/layout.css',
  './css/responsive.css',
  './js/utils.js',
  './js/config.js',
  './js/catalog.js',
  './js/engine.js',
  './js/api.js',
  './js/store.js',
  './js/ui.js',
  './js/forms.js',
  './js/charts.js',
  './js/router.js',
  './js/app.js',
  './js/views/dashboard.js',
  './js/views/transacoes.js',
  './js/views/assinaturas.js',
  './js/views/compras.js',
  './js/views/cartoes.js',
  './js/views/contas.js',
  './js/views/calendario.js',
  './js/views/metas.js',
  './js/views/relatorios.js',
  './js/views/configuracoes.js',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then(c => c.addAll(ARQUIVOS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[sw] falha ao pré-cachear', err))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(chaves.filter(k => !k.startsWith(VERSAO)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // dados nunca são cacheados
  if (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com') return;

  // CDNs e fontes: responde do cache e atualiza em segundo plano
  if (url.origin !== location.origin) {
    e.respondWith(
      caches.open(EXTERNO).then(async (cache) => {
        const cacheado = await cache.match(req);
        const rede = fetch(req).then(resp => {
          if (resp.ok) cache.put(req, resp.clone());
          return resp;
        }).catch(() => cacheado);
        return cacheado || rede;
      })
    );
    return;
  }

  // app shell: cache primeiro, rede como reserva
  e.respondWith(
    caches.match(req).then(cacheado =>
      cacheado || fetch(req).then(resp => {
        if (resp.ok) {
          const copia = resp.clone();
          caches.open(SHELL).then(c => c.put(req, copia));
        }
        return resp;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
