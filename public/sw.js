/*
 * Service worker de Foodvictor (web).
 * 1. Ajoute les en-têtes COOP/COEP que GitHub Pages ne permet pas de configurer :
 *    sans eux, la base SQLite du navigateur ne peut pas démarrer.
 * 2. Hors ligne : réseau d'abord (les mises à jour arrivent dès l'ouverture), cache sinon.
 */
const CACHE = 'foodvictor-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

function avecEnTetes(res) {
  if (!res || res.status === 0) return res;
  const h = new Headers(res.headers);
  h.set('Cross-Origin-Embedder-Policy', 'credentialless');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // On ne touche qu'aux fichiers de l'app (pas à Open Food Facts ni à Google).
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return avecEnTetes(res);
      } catch (err) {
        const hit = (await cache.match(req)) || (req.mode === 'navigate' ? await cache.match(self.registration.scope) : null);
        if (hit) return avecEnTetes(hit);
        throw err;
      }
    })(),
  );
});
