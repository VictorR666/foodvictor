import * as Crypto from 'expo-crypto';
import { db, SYNC_COLUMNS, SyncTable } from './index';
import { emitDataChange } from '../lib/events';
import { isoDate } from '../lib/date';
import { motsRecherche, normaliser } from '../lib/texte';
import type { RepasKey } from '../theme';

// ---------- Types ----------
export type Aliment = {
  id: string;
  source: 'off' | 'perso' | 'ciqual';
  code_barres: string | null;
  nom: string;
  marque: string | null;
  kcal_100g: number;
  proteines_100g: number;
  glucides_100g: number;
  lipides_100g: number;
  fibres_100g: number;
  portion_produit_g: number | null;
  portion_produit_lib: string | null;
  favori: number;
  dernier_g: number | null;
  utilise_le: string | null;
  modifie_le: string;
  supprime: number;
};

export type Portion = {
  id: string;
  aliment_id: string;
  libelle: string;
  grammes: number;
  favori: number;
  modifie_le: string;
  supprime: number;
};

export type Entree = {
  id: string;
  date: string;
  repas: RepasKey;
  aliment_id: string | null;
  libelle: string;
  quantite_g: number | null;
  kcal: number;
  proteines: number;
  glucides: number;
  lipides: number;
  fibres: number;
  cree_le: string;
  modifie_le: string;
  supprime: number;
};

export type Objectifs = {
  id: string;
  date_debut: string;
  kcal: number;
  proteines_g: number;
  glucides_g: number;
  lipides_g: number;
  fibres_g: number;
  unite_repas: 'kcal' | 'pct';
  obj_petit_dej: number;
  obj_dejeuner: number;
  obj_diner: number;
  obj_collation: number;
  modifie_le: string;
  supprime: number;
};

export type Totaux = { kcal: number; proteines: number; glucides: number; lipides: number; fibres: number };
export const ZERO: Totaux = { kcal: 0, proteines: 0, glucides: 0, lipides: 0, fibres: 0 };

// ---------- Outils ----------
export const uid = () => Crypto.randomUUID();
export const now = () => new Date().toISOString();
const r1 = (n: number) => Math.round(n * 10) / 10;

export function macrosPour(a: Pick<Aliment, 'kcal_100g' | 'proteines_100g' | 'glucides_100g' | 'lipides_100g' | 'fibres_100g'>, g: number): Totaux {
  const k = g / 100;
  return {
    kcal: Math.round(a.kcal_100g * k),
    proteines: r1(a.proteines_100g * k),
    glucides: r1(a.glucides_100g * k),
    lipides: r1(a.lipides_100g * k),
    fibres: r1(a.fibres_100g * k),
  };
}

export function somme(list: Totaux[]): Totaux {
  return list.reduce(
    (t, e) => ({
      kcal: t.kcal + e.kcal,
      proteines: t.proteines + e.proteines,
      glucides: t.glucides + e.glucides,
      lipides: t.lipides + e.lipides,
      fibres: t.fibres + e.fibres,
    }),
    { ...ZERO },
  );
}

async function enqueue(tbl: SyncTable, id: string) {
  await db.runAsync('INSERT OR REPLACE INTO sync_file (tbl, row_id, tentatives) VALUES (?, ?, 0)', tbl, id);
}

async function changed(tbl: SyncTable, id: string) {
  await enqueue(tbl, id);
  emitDataChange();
}

// ---------- Réglages ----------
export async function getReglage(cle: string) {
  const r = await db.getFirstAsync<{ valeur: string | null }>('SELECT valeur FROM reglages WHERE cle = ?', cle);
  return r?.valeur ?? null;
}
export async function setReglage(cle: string, valeur: string | null) {
  await db.runAsync('INSERT OR REPLACE INTO reglages (cle, valeur) VALUES (?, ?)', cle, valeur);
}

// ---------- Objectifs ----------
export const OBJECTIFS_DEFAUT: Omit<Objectifs, 'id' | 'date_debut' | 'modifie_le' | 'supprime'> = {
  kcal: 2200,
  proteines_g: 140,
  glucides_g: 250,
  lipides_g: 70,
  fibres_g: 30,
  unite_repas: 'pct',
  obj_petit_dej: 25,
  obj_dejeuner: 35,
  obj_diner: 30,
  obj_collation: 10,
};

export async function getObjectifs(date: string): Promise<Objectifs> {
  const o = await db.getFirstAsync<Objectifs>(
    'SELECT * FROM objectifs WHERE supprime = 0 AND date_debut <= ? ORDER BY date_debut DESC LIMIT 1',
    date,
  );
  if (o) return o;
  // aucun objectif aussi ancien : on prend le plus ancien connu, sinon les valeurs par défaut
  const first = await db.getFirstAsync<Objectifs>('SELECT * FROM objectifs WHERE supprime = 0 ORDER BY date_debut ASC LIMIT 1');
  return first ?? { id: '', date_debut: date, modifie_le: '', supprime: 0, ...OBJECTIFS_DEFAUT };
}

/** Un changement d'objectif prend effet aujourd'hui et ne réécrit pas les jours passés. */
export async function saveObjectifs(o: Omit<Objectifs, 'id' | 'date_debut' | 'modifie_le' | 'supprime'>) {
  const today = isoDate();
  const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM objectifs WHERE date_debut = ? AND supprime = 0', today);
  const id = existing?.id ?? uid();
  await db.runAsync(
    `INSERT OR REPLACE INTO objectifs (id, date_debut, kcal, proteines_g, glucides_g, lipides_g, fibres_g, unite_repas,
      obj_petit_dej, obj_dejeuner, obj_diner, obj_collation, modifie_le, supprime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    id, today, o.kcal, o.proteines_g, o.glucides_g, o.lipides_g, o.fibres_g, o.unite_repas,
    o.obj_petit_dej, o.obj_dejeuner, o.obj_diner, o.obj_collation, now(),
  );
  await changed('objectifs', id);
}

/** Cibles d'un repas : ses kcal, et les macros du jour au prorata de ces kcal. */
export function ciblesRepas(o: Objectifs, repas: RepasKey): Totaux {
  const kcal = objectifRepasKcal(o, repas);
  const k = o.kcal ? kcal / o.kcal : 0;
  return { kcal, proteines: o.proteines_g * k, glucides: o.glucides_g * k, lipides: o.lipides_g * k, fibres: o.fibres_g * k };
}

export function ciblesJour(o: Objectifs): Totaux {
  return { kcal: o.kcal, proteines: o.proteines_g, glucides: o.glucides_g, lipides: o.lipides_g, fibres: o.fibres_g };
}

export function objectifRepasKcal(o: Objectifs, repas: RepasKey) {
  const v = { petit_dej: o.obj_petit_dej, dejeuner: o.obj_dejeuner, diner: o.obj_diner, collation: o.obj_collation }[repas];
  return Math.round(o.unite_repas === 'pct' ? (o.kcal * v) / 100 : v);
}

// ---------- Journal ----------
export async function entreesDuJour(date: string) {
  return db.getAllAsync<Entree>('SELECT * FROM entrees WHERE date = ? AND supprime = 0 ORDER BY cree_le', date);
}

export async function getEntree(id: string) {
  return db.getFirstAsync<Entree>('SELECT * FROM entrees WHERE id = ?', id);
}

export async function ajouterEntree(date: string, repas: RepasKey, a: Aliment, grammes: number) {
  const m = macrosPour(a, grammes);
  const id = uid();
  const t = now();
  await db.runAsync(
    `INSERT INTO entrees (id, date, repas, aliment_id, libelle, quantite_g, kcal, proteines, glucides, lipides, fibres, cree_le, modifie_le, supprime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    id, date, repas, a.id, a.nom, grammes, m.kcal, m.proteines, m.glucides, m.lipides, m.fibres, t, t,
  );
  await db.runAsync('UPDATE aliments SET dernier_g = ?, utilise_le = ? WHERE id = ?', grammes, t, a.id);
  await changed('entrees', id);
  return id;
}

export async function ajouterSaisieRapide(date: string, repas: RepasKey, libelle: string, m: Totaux) {
  const id = uid();
  const t = now();
  await db.runAsync(
    `INSERT INTO entrees (id, date, repas, aliment_id, libelle, quantite_g, kcal, proteines, glucides, lipides, fibres, cree_le, modifie_le, supprime)
     VALUES (?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 0)`,
    id, date, repas, libelle || 'Saisie rapide', m.kcal, m.proteines, m.glucides, m.lipides, m.fibres, t, t,
  );
  await changed('entrees', id);
}

export async function modifierEntree(id: string, a: Aliment, grammes: number, repas: RepasKey) {
  const m = macrosPour(a, grammes);
  await db.runAsync(
    `UPDATE entrees SET repas = ?, quantite_g = ?, kcal = ?, proteines = ?, glucides = ?, lipides = ?, fibres = ?, modifie_le = ? WHERE id = ?`,
    repas, grammes, m.kcal, m.proteines, m.glucides, m.lipides, m.fibres, now(), id,
  );
  await db.runAsync('UPDATE aliments SET dernier_g = ? WHERE id = ?', grammes, a.id);
  await changed('entrees', id);
}

export async function supprimerEntree(id: string) {
  await db.runAsync('UPDATE entrees SET supprime = 1, modifie_le = ? WHERE id = ?', now(), id);
  await changed('entrees', id);
}

export async function restaurerEntree(id: string) {
  await db.runAsync('UPDATE entrees SET supprime = 0, modifie_le = ? WHERE id = ?', now(), id);
  await changed('entrees', id);
}

// ---------- Aliments ----------
export async function getAliment(id: string) {
  return db.getFirstAsync<Aliment>('SELECT * FROM aliments WHERE id = ?', id);
}

export async function alimentParCode(code: string) {
  return db.getFirstAsync<Aliment>(
    "SELECT * FROM aliments WHERE code_barres = ? AND supprime = 0 ORDER BY CASE source WHEN 'perso' THEN 0 ELSE 1 END LIMIT 1",
    code,
  );
}

export type AlimentData = Omit<Aliment, 'id' | 'favori' | 'dernier_g' | 'utilise_le' | 'modifie_le' | 'supprime'>;

/** Enregistre (ou met à jour) un produit venu d'Open Food Facts dans le cache local. */
export async function enregistrerProduitOFF(p: AlimentData) {
  const ex = p.code_barres
    ? await db.getFirstAsync<{ id: string }>("SELECT id FROM aliments WHERE code_barres = ? AND source = 'off'", p.code_barres)
    : null;
  const id = ex?.id ?? uid();
  if (ex) {
    await db.runAsync(
      `UPDATE aliments SET nom = ?, marque = ?, kcal_100g = ?, proteines_100g = ?, glucides_100g = ?, lipides_100g = ?, fibres_100g = ?,
        portion_produit_g = ?, portion_produit_lib = ?, modifie_le = ?, supprime = 0, recherche = ? WHERE id = ?`,
      p.nom, p.marque, p.kcal_100g, p.proteines_100g, p.glucides_100g, p.lipides_100g, p.fibres_100g,
      p.portion_produit_g, p.portion_produit_lib, now(), texteRecherche(p.nom, p.marque), id,
    );
  } else {
    await insererAliment(id, p);
  }
  await changed('aliments', id);
  return (await getAliment(id))!;
}

async function insererAliment(id: string, p: AlimentData) {
  await db.runAsync(
    `INSERT INTO aliments (id, source, code_barres, nom, marque, kcal_100g, proteines_100g, glucides_100g, lipides_100g, fibres_100g,
      portion_produit_g, portion_produit_lib, favori, dernier_g, utilise_le, modifie_le, supprime, recherche)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, 0, ?)`,
    id, p.source, p.code_barres, p.nom, p.marque, p.kcal_100g, p.proteines_100g, p.glucides_100g, p.lipides_100g,
    p.fibres_100g, p.portion_produit_g, p.portion_produit_lib, now(), texteRecherche(p.nom, p.marque),
  );
}

export async function creerAlimentPerso(p: Omit<AlimentData, 'source'>) {
  const id = uid();
  await insererAliment(id, { ...p, source: 'perso' });
  await changed('aliments', id);
  return (await getAliment(id))!;
}

export async function modifierAliment(id: string, p: Omit<AlimentData, 'source'>) {
  await db.runAsync(
    `UPDATE aliments SET nom = ?, marque = ?, code_barres = ?, kcal_100g = ?, proteines_100g = ?, glucides_100g = ?, lipides_100g = ?,
      fibres_100g = ?, portion_produit_g = ?, portion_produit_lib = ?, modifie_le = ?, recherche = ? WHERE id = ?`,
    p.nom, p.marque, p.code_barres, p.kcal_100g, p.proteines_100g, p.glucides_100g, p.lipides_100g, p.fibres_100g,
    p.portion_produit_g, p.portion_produit_lib, now(), texteRecherche(p.nom, p.marque), id,
  );
  await changed('aliments', id);
}

export async function basculerFavori(a: Aliment) {
  await db.runAsync('UPDATE aliments SET favori = ?, modifie_le = ? WHERE id = ?', a.favori ? 0 : 1, now(), a.id);
  await changed('aliments', a.id);
}

export async function recents(limit = 30) {
  return db.getAllAsync<Aliment>(
    'SELECT * FROM aliments WHERE supprime = 0 AND utilise_le IS NOT NULL ORDER BY utilise_le DESC LIMIT ?',
    limit,
  );
}
export async function favoris() {
  return db.getAllAsync<Aliment>('SELECT * FROM aliments WHERE supprime = 0 AND favori = 1 ORDER BY nom COLLATE NOCASE');
}
export async function mesAliments() {
  return db.getAllAsync<Aliment>("SELECT * FROM aliments WHERE supprime = 0 AND source = 'perso' ORDER BY nom COLLATE NOCASE");
}
export const texteRecherche = (nom: string, marque?: string | null) => normaliser(`${nom} ${marque ?? ''}`);

/**
 * Recherche locale uniquement (tes aliments + la table Ciqual) : elle peut tourner à chaque frappe
 * sans toucher Open Food Facts. Sans accents, tous les mots doivent apparaître.
 * Ordre : aliments déjà utilisés, favoris, noms qui commencent par le premier mot, puis les plus courts.
 */
export async function rechercheLocale(q: string) {
  const mots = motsRecherche(q);
  if (!mots.length) return [];
  const brut = normaliser(q).split(' ')[0]; // premier mot tel que tapé (« pates » passe devant « pâté »)
  const conditions = mots.map(() => 'recherche LIKE ?').join(' AND ');
  return db.getAllAsync<Aliment>(
    `SELECT * FROM aliments WHERE supprime = 0 AND (${conditions} OR code_barres = ?)
     ORDER BY (utilise_le IS NULL), favori DESC, (recherche LIKE ?) DESC, (recherche LIKE ?) DESC, (recherche LIKE ?) DESC,
       (source = 'ciqual'), length(nom), nom COLLATE NOCASE
     LIMIT 50`,
    ...mots.map((m) => `%${m}%`), q.trim(), `${brut}%`, `${mots[0]}%`, `%${brut}%`,
  );
}

/** Complète la colonne de recherche des aliments qui n'en ont pas (anciens, restaurés depuis la feuille). */
export async function completerRecherche() {
  const rows = await db.getAllAsync<{ id: string; nom: string; marque: string | null }>(
    'SELECT id, nom, marque FROM aliments WHERE recherche IS NULL',
  );
  if (!rows.length) return;
  await db.withTransactionAsync(async () => {
    for (const r of rows) await db.runAsync('UPDATE aliments SET recherche = ? WHERE id = ?', texteRecherche(r.nom, r.marque), r.id);
  });
}

// ---------- Grammages perso ----------
export async function portionsDe(alimentId: string) {
  return db.getAllAsync<Portion>(
    'SELECT * FROM portions WHERE aliment_id = ? AND supprime = 0 ORDER BY favori DESC, grammes',
    alimentId,
  );
}

export async function ajouterPortion(alimentId: string, libelle: string, grammes: number) {
  const id = uid();
  await db.runAsync(
    'INSERT INTO portions (id, aliment_id, libelle, grammes, favori, modifie_le, supprime) VALUES (?, ?, ?, ?, 0, ?, 0)',
    id, alimentId, libelle, grammes, now(),
  );
  await changed('portions', id);
  return id;
}

/** Un seul grammage favori par aliment : c'est lui qu'utilise le « + » rapide. */
export async function definirPortionFavorite(alimentId: string, portionId: string | null) {
  const t = now();
  const prev = await db.getAllAsync<{ id: string }>('SELECT id FROM portions WHERE aliment_id = ? AND favori = 1', alimentId);
  await db.runAsync('UPDATE portions SET favori = 0, modifie_le = ? WHERE aliment_id = ? AND favori = 1', t, alimentId);
  for (const p of prev) await enqueue('portions', p.id);
  if (portionId) {
    await db.runAsync('UPDATE portions SET favori = 1, modifie_le = ? WHERE id = ?', t, portionId);
    await enqueue('portions', portionId);
  }
  emitDataChange();
}

export async function supprimerPortion(id: string) {
  await db.runAsync('UPDATE portions SET supprime = 1, favori = 0, modifie_le = ? WHERE id = ?', now(), id);
  await changed('portions', id);
}

/** Quantité utilisée par le « + » rapide : grammage favori, sinon dernière quantité, sinon portion produit, sinon 100 g. */
export async function grammageRapide(a: Aliment): Promise<{ g: number; libelle: string }> {
  const fav = await db.getFirstAsync<Portion>('SELECT * FROM portions WHERE aliment_id = ? AND favori = 1 AND supprime = 0', a.id);
  if (fav) return { g: fav.grammes, libelle: `★ ${fav.libelle}` };
  if (a.dernier_g) return { g: a.dernier_g, libelle: 'Dernière fois' };
  if (a.portion_produit_g) return { g: a.portion_produit_g, libelle: a.portion_produit_lib || 'Portion' };
  return { g: 100, libelle: '100 g' };
}

// ---------- Historique ----------
export async function totauxParJour(depuis: string) {
  return db.getAllAsync<Totaux & { date: string }>(
    `SELECT date, SUM(kcal) kcal, SUM(proteines) proteines, SUM(glucides) glucides, SUM(lipides) lipides, SUM(fibres) fibres
     FROM entrees WHERE supprime = 0 AND date >= ? GROUP BY date ORDER BY date DESC`,
    depuis,
  );
}

// ---------- Synchro / export ----------
export async function lignePourSync(tbl: SyncTable, id: string) {
  const cols = SYNC_COLUMNS[tbl].join(', ');
  return db.getFirstAsync<Record<string, unknown>>(`SELECT ${cols} FROM ${tbl} WHERE id = ?`, id);
}

export async function toutesLesLignes(tbl: SyncTable) {
  const cols = SYNC_COLUMNS[tbl].join(', ');
  return db.getAllAsync<Record<string, unknown>>(`SELECT ${cols} FROM ${tbl}`);
}

/** Restauration : remplace les lignes locales par celles de la feuille (la plus récente gagne). */
export async function appliquerLignes(tbl: SyncTable, rows: Record<string, unknown>[]) {
  const cols = SYNC_COLUMNS[tbl] as readonly string[];
  const placeholders = cols.map(() => '?').join(', ');
  await db.withTransactionAsync(async () => {
    for (const r of rows) {
      if (!r.id) continue;
      const local = await db.getFirstAsync<{ modifie_le: string }>(`SELECT modifie_le FROM ${tbl} WHERE id = ?`, String(r.id));
      if (local && String(local.modifie_le) > String(r.modifie_le ?? '')) continue;
      const values = cols.map((c) => {
        const v = r[c];
        if (v === '' || v === undefined) return null;
        if (typeof v === 'boolean') return v ? 1 : 0;
        return v as string | number | null;
      });
      if (local) {
        const set = cols.filter((c) => c !== 'id').map((c) => `${c} = ?`).join(', ');
        await db.runAsync(`UPDATE ${tbl} SET ${set} WHERE id = ?`, ...values.slice(1), String(r.id));
      } else {
        await db.runAsync(`INSERT INTO ${tbl} (${cols.join(', ')}) VALUES (${placeholders})`, ...values);
      }
    }
  });
  if (tbl === 'aliments') await completerRecherche();
  emitDataChange();
}

export async function fileSync(limit = 200) {
  return db.getAllAsync<{ tbl: SyncTable; row_id: string; tentatives: number }>(
    'SELECT * FROM sync_file ORDER BY tentatives, rowid LIMIT ?',
    limit,
  );
}
export async function nbEnAttente() {
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) n FROM sync_file');
  return r?.n ?? 0;
}
export async function retirerDeLaFile(items: { tbl: string; row_id: string }[]) {
  for (const i of items) await db.runAsync('DELETE FROM sync_file WHERE tbl = ? AND row_id = ?', i.tbl, i.row_id);
}
export async function marquerEchec(items: { tbl: string; row_id: string }[]) {
  for (const i of items) await db.runAsync('UPDATE sync_file SET tentatives = tentatives + 1 WHERE tbl = ? AND row_id = ?', i.tbl, i.row_id);
}
export async function toutRemettreEnFile() {
  for (const tbl of Object.keys(SYNC_COLUMNS) as SyncTable[]) {
    await db.runAsync(`INSERT OR IGNORE INTO sync_file (tbl, row_id, tentatives) SELECT '${tbl}', id, 0 FROM ${tbl}`);
  }
}
