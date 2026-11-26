import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { AlimentData } from '../db/repo';
import { getReglage } from '../db/repo';

/**
 * Client Open Food Facts, écrit pour ne jamais se faire bloquer :
 * - User-Agent « Foodvictor/<version> (<email>) » sur chaque requête ;
 * - quotas locaux sous ceux d'OFF : 15 lectures produit / min, 10 recherches / min ;
 * - un seul appel en cours par code-barres (les doublons attendent la même réponse) ;
 * - réessais limités, avec délai croissant + aléa, seulement sur réseau / 429 / 5xx ;
 * - pas de recherche à la frappe : la recherche en ligne n'est lancée que sur un bouton.
 * Le cache, lui, est la base locale : un produit déjà connu ne repasse jamais par ici.
 */

const PROD = 'https://world.openfoodfacts.org';
const STAGING = 'https://world.openfoodfacts.net'; // identifiants off / off
// Moteur de recherche d'OFF (Search-a-licious) : rapide et compatible navigateur.
// L'ancienne recherche /cgi/search.pl renvoie souvent 503 sans en-tête CORS (= « Failed to fetch »).
const RECHERCHE = 'https://search.openfoodfacts.org';
const FIELDS = [
  'code', 'product_name', 'product_name_fr', 'brands', 'quantity', 'serving_size', 'serving_quantity', 'nutriments',
  'image_front_url', 'image_front_small_url', 'image_url',
].join(',');

export class OffQuotaError extends Error {
  constructor(public attendreSec: number) {
    super(`Limite Open Food Facts atteinte, réessaie dans ${attendreSec} s.`);
  }
}
export class OffIntrouvable extends Error {
  constructor() {
    super('Produit introuvable sur Open Food Facts.');
  }
}

// --- Quotas glissants sur 60 s (marge de sécurité sous les limites officielles) ---
const LIMITES = { produit: 12, recherche: 8 };
const historique: Record<keyof typeof LIMITES, number[]> = { produit: [], recherche: [] };

function reserver(type: keyof typeof LIMITES) {
  const t = Date.now();
  const h = historique[type].filter((x) => t - x < 60_000);
  historique[type] = h;
  if (h.length >= LIMITES[type]) {
    throw new OffQuotaError(Math.ceil((60_000 - (t - h[0])) / 1000));
  }
  h.push(t);
}

async function base() {
  const staging = (await getReglage('off_staging')) === '1';
  return { url: staging ? STAGING : PROD, staging };
}

async function userAgent() {
  const email = (await getReglage('contact_email')) || 'contact-non-renseigne';
  const version = Constants.expoConfig?.version ?? '1.0.0';
  return `Foodvictor/${version} (${email})`;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function requete(path: string, essais = 3): Promise<any> {
  const { url, staging } = await base();
  return requeteUrl(url + path, staging, essais);
}

const MSG_INDISPONIBLE = 'Open Food Facts ne répond pas pour le moment (serveur indisponible). Réessaie dans quelques minutes.';

async function requeteUrl(adresse: string, staging: boolean, essais = 3): Promise<any> {
  // Un navigateur interdit de changer le User-Agent : sur le web, on ne l'envoie pas (cela forcerait
  // en plus une requête de pré-vérification CORS). L'app Android, elle, s'identifie.
  const headers: Record<string, string> = Platform.OS === 'web' ? {} : { 'User-Agent': await userAgent(), Accept: 'application/json' };
  if (staging) headers.Authorization = 'Basic b2ZmOm9mZg=='; // off:off
  let derniere: unknown;
  for (let essai = 0; essai < essais; essai++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12_000);
      const res = await fetch(adresse, { headers, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 404) return { status: 0 };
      if (res.status === 429 || res.status >= 500) {
        derniere = new Error(`HTTP ${res.status}`);
      } else if (!res.ok) {
        throw new Error(`Open Food Facts a refusé la requête (HTTP ${res.status}).`); // autre 4xx : on ne réessaie pas
      } else {
        return await res.json();
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Open Food Facts a refusé')) throw e;
      derniere = e;
    }
    if (essai < essais - 1) await dormir(1000 * 2 ** essai + Math.random() * 500);
  }
  // « Failed to fetch » : réseau coupé, ou page d'erreur du serveur sans en-tête CORS.
  const detail = derniere instanceof Error ? derniere.message : '';
  if (/failed to fetch|network|load failed|abort|HTTP 5|HTTP 429/i.test(detail) || !detail) throw new Error(MSG_INDISPONIBLE);
  throw new Error(`Open Food Facts ne répond pas (${detail}).`);
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
}
const r1 = (n: number) => Math.round(n * 10) / 10;

export function produitVersAliment(p: any): AlimentData & { nutrimentsManquants: boolean } {
  const n = p?.nutriments ?? {};
  let kcal = num(n['energy-kcal_100g']);
  if (kcal == null) {
    const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
    if (kj != null) kcal = kj / 4.184;
  }
  const prot = num(n['proteins_100g']);
  const gluc = num(n['carbohydrates_100g']);
  const lip = num(n['fat_100g']);
  const serving = num(p?.serving_quantity);
  return {
    source: 'off',
    code_barres: String(p?.code ?? ''),
    nom: String(p?.product_name_fr || p?.product_name || 'Produit sans nom').trim(),
    marque: p?.brands ? String(p.brands).split(',')[0].trim() : null,
    kcal_100g: Math.round(kcal ?? 0),
    proteines_100g: r1(prot ?? 0),
    glucides_100g: r1(gluc ?? 0),
    lipides_100g: r1(lip ?? 0),
    fibres_100g: r1(num(n['fiber_100g']) ?? 0),
    portion_produit_g: serving && serving > 0 ? serving : null,
    portion_produit_lib: p?.serving_size ? String(p.serving_size) : null,
    // photo de face (400 px) ; '' = OFF n'en a pas (on ne redemandera pas)
    image_url: String(p?.image_front_url || p?.image_url || p?.image_front_small_url || ''),
    nutrimentsManquants: kcal == null && prot == null && gluc == null && lip == null,
  };
}

// Un seul appel en cours par code-barres.
const enCours = new Map<string, Promise<ReturnType<typeof produitVersAliment>>>();

export function produitParCode(code: string) {
  const existant = enCours.get(code);
  if (existant) return existant;
  const p = (async () => {
    reserver('produit');
    const json = await requete(`/api/v2/product/${encodeURIComponent(code)}?fields=${FIELDS}`);
    if (!json || json.status !== 1 || !json.product) throw new OffIntrouvable();
    return produitVersAliment({ ...json.product, code: json.product.code ?? code });
  })();
  enCours.set(code, p);
  p.finally(() => enCours.delete(code)).catch(() => {});
  return p;
}

export type ResultatEnLigne = {
  code: string;
  nom: string;
  marque: string | null;
  quantite: string | null;
  image_url: string;
  /** Valeurs nutritionnelles si la recherche les a données ; sinon lues à la sélection (1 lecture produit). */
  complet: AlimentData | null;
};

const marqueDe = (b: unknown) => {
  const premiere = Array.isArray(b) ? b[0] : typeof b === 'string' ? b.split(',')[0] : null;
  return premiere ? String(premiere).replace(/^[a-z]{2}:/, '').trim() || null : null;
};

/**
 * Recherche en ligne, déclenchée uniquement par un bouton (jamais à la frappe).
 * 1. Search-a-licious (nom, marque, photo) ; 2. si indisponible, l'ancienne recherche (avec nutriments).
 */
export async function rechercheEnLigne(q: string): Promise<ResultatEnLigne[]> {
  reserver('recherche');
  const termes = encodeURIComponent(q.trim());
  try {
    const champs = 'code,product_name,product_name_fr,brands,quantity,image_front_url,image_front_small_url,image_url';
    const json = await requeteUrl(`${RECHERCHE}/search?q=${termes}&langs=fr&page_size=20&fields=${champs}`, false, 2);
    const hits: any[] = json?.hits ?? [];
    return hits
      .filter((h) => h?.code)
      .map((h) => ({
        code: String(h.code),
        nom: String(h.product_name_fr || h.product_name || 'Produit sans nom').trim(),
        marque: marqueDe(h.brands),
        quantite: h.quantity ? String(h.quantity) : null,
        image_url: String(h.image_front_url || h.image_url || h.image_front_small_url || ''),
        complet: null,
      }));
  } catch {
    const params = `search_terms=${termes}&search_simple=1&action=process&json=1&page_size=20&fields=${FIELDS}`;
    const json = await requete(`/cgi/search.pl?${params}`, 2);
    const list: any[] = json?.products ?? [];
    return list
      .map(produitVersAliment)
      .filter((a) => a.code_barres && !a.nutrimentsManquants)
      .map(({ nutrimentsManquants: _n, ...a }) => ({
        code: a.code_barres!, nom: a.nom, marque: a.marque, quantite: null, image_url: a.image_url ?? '', complet: a,
      }));
  }
}
