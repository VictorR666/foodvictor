import { AppState } from 'react-native';
import { SYNC_COLUMNS, SyncTable } from '../db';
import {
  appliquerLignes, fileSync, getReglage, lignePourSync, marquerEchec, nbEnAttente, retirerDeLaFile, setReglage, now,
} from '../db/repo';
import { onDataChange } from './events';

/**
 * Sauvegarde vers Google Sheets via le script Apps Script (apps-script/Code.gs).
 * Le téléphone reste la source de vérité ; chaque changement passe par la table sync_file
 * et part dès qu'il y a du réseau. Une ligne supprimée est envoyée avec supprime = 1.
 */

export type EtatSync = {
  etat: 'non_configure' | 'ok' | 'en_cours' | 'erreur';
  derniere: string | null;
  enAttente: number;
  message?: string;
  /** Le script Google est d'une version d'avant les repas favoris (à mettre à jour). */
  scriptAncien?: boolean;
};

let etat: EtatSync = { etat: 'non_configure', derniere: null, enAttente: 0 };
const abonnes = new Set<(e: EtatSync) => void>();
function publier(p: Partial<EtatSync>) {
  etat = { ...etat, ...p };
  abonnes.forEach((f) => f(etat));
}
export function surEtatSync(f: (e: EtatSync) => void) {
  abonnes.add(f);
  f(etat);
  return () => {
    abonnes.delete(f);
  };
}

async function config() {
  const url = (await getReglage('sheets_url'))?.trim() || '';
  const secret = (await getReglage('sheets_secret'))?.trim() || '';
  return url && secret ? { url, secret } : null;
}

export async function rafraichirEtat() {
  const c = await config();
  publier({
    etat: c ? (etat.etat === 'non_configure' ? 'ok' : etat.etat) : 'non_configure',
    derniere: await getReglage('sheets_derniere_sync'),
    enAttente: await nbEnAttente(),
  });
}

let enCours: Promise<void> | null = null;
let scriptAncien = false;

export function synchroniser(): Promise<void> {
  if (!enCours) enCours = executer().finally(() => (enCours = null));
  return enCours;
}

async function executer() {
  const c = await config();
  if (!c) return rafraichirEtat();
  publier({ etat: 'en_cours' });
  try {
    // par lots de 200 jusqu'à vider la file
    for (let tour = 0; tour < 20; tour++) {
      const file = await fileSync(200);
      if (!file.length) break;
      const changes: { table: SyncTable; row: Record<string, unknown> }[] = [];
      for (const f of file) {
        const row = await lignePourSync(f.tbl, f.row_id);
        if (row) changes.push({ table: f.tbl, row });
      }
      const res = await fetch(c.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ secret: c.secret, changes }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        await marquerEchec(file);
        throw new Error(json?.error === 'secret' ? 'Clé secrète refusée par le script.' : `Le script a répondu ${res.status}.`);
      }
      // Un script Google d'avant les repas favoris ignore ces onglets : on garde ces lignes en attente
      // jusqu'à ce que le script soit mis à jour (il renvoie alors la liste des onglets qu'il connaît).
      const connues: string[] = Array.isArray(json.tables) ? json.tables : ['aliments', 'portions', 'entrees', 'objectifs'];
      const ignorees = file.filter((f) => !connues.includes(f.tbl));
      await retirerDeLaFile(file.filter((f) => connues.includes(f.tbl)));
      scriptAncien = ignorees.length > 0;
      if (scriptAncien) break;
    }
    const t = now();
    await setReglage('sheets_derniere_sync', t);
    publier({ etat: 'ok', derniere: t, enAttente: await nbEnAttente(), message: undefined, scriptAncien });
  } catch (e) {
    publier({
      etat: 'erreur',
      enAttente: await nbEnAttente(),
      message: e instanceof Error ? e.message : 'Synchronisation impossible (réseau ?).',
    });
  }
}

/** Reconstruit la base locale à partir de la feuille (nouveau téléphone, réinstallation). */
export async function restaurerDepuisSheets() {
  const c = await config();
  if (!c) throw new Error('Renseigne d’abord l’adresse du script et la clé secrète.');
  const sep = c.url.includes('?') ? '&' : '?';
  const res = await fetch(`${c.url}${sep}action=dump&secret=${encodeURIComponent(c.secret)}`);
  const json = await res.json();
  if (!json?.ok) throw new Error(json?.error === 'secret' ? 'Clé secrète refusée.' : 'Le script n’a pas renvoyé de données.');
  let total = 0;
  for (const tbl of Object.keys(SYNC_COLUMNS) as SyncTable[]) {
    const rows = (json.tables?.[tbl] ?? []) as Record<string, unknown>[];
    await appliquerLignes(tbl, rows);
    total += rows.length;
  }
  await rafraichirEtat();
  return total;
}

/** Démarre la synchro automatique : 5 s après chaque changement, au retour dans l'app, et toutes les 10 min. */
export function demarrerSyncAuto() {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const bientot = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      synchroniser();
    }, 5000);
  };
  const off1 = onDataChange(() => {
    rafraichirEtat();
    bientot();
  });
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') synchroniser();
  });
  const interval = setInterval(() => synchroniser(), 10 * 60_000);
  rafraichirEtat().then(() => synchroniser());
  return () => {
    off1();
    sub.remove();
    clearInterval(interval);
    if (timer) clearTimeout(timer);
  };
}
