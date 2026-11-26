/*
 * Service worker de Foodvictor (web).
 * 1. Ajoute les en-têtes COOP/COEP que GitHub Pages ne permet pas de configurer :
 *    sans eux, la base SQLite du navigateur ne peut pas démarrer.
 * 2. Hors ligne : réseau d'abord (les mises à jour arrivent dès l'ouverture), cache sinon.
 * 3. Photos des produits (Open Food Facts) gardées en cache : affichées même hors ligne, téléchargées une fois.
 */
const CACHE = 'foodvictor-v1';
const PHOTOS = 'fv-photos';
const MAX_PHOTOS = 300;
let sansCors = false; // le serveur photo ne répond pas en CORS : on laisse alors le navigateur charger seul

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) =>
  e.waitUntil(
    (async () => {
      // Supprime les caches des versions précédentes de l'app.
      for (const k of await caches.keys()) if (k.startsWith('foodvictor-') && k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  ),
);

// Sous COEP, une image servie par le service worker doit dire qu'elle peut être affichée par une autre origine.
function pourLaPage(res) {
  const h = new Headers(res.headers);
  h.set('Cross-Origin-Resource-Policy', 'cross-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

async function photo(req) {
  const cache = await caches.open(PHOTOS);
  const hit = await cache.match(req.url);
  if (hit) return pourLaPage(hit);
  let res;
  try {
    res = await fetch(req.url, { mode: 'cors', credentials: 'omit' });
  } catch {
    sansCors = true;
    return fetch(req.url, { mode: 'no-cors', credentials: 'omit' });
  }
  if (res.ok) {
    await cache.put(req.url, res.clone());
    const cles = await cache.keys();
    for (const k of cles.slice(0, Math.max(0, cles.length - MAX_PHOTOS))) await cache.delete(k);
  }
  return pourLaPage(res);
}

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
  if (req.method === 'GET' && !sansCors && /^images\.openfoodfacts\.(org|net)$/.test(url.hostname)) {
    e.respondWith(photo(req));
    return;
  }
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
