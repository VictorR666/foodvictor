import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { db, SYNC_COLUMNS, SyncTable } from '../db';
import { appliquerLignes, Entree, getObjectifs, objectifRepasKcal, toutesLesLignes } from '../db/repo';
import { isoDate, addDays } from './date';
import { repasInfo } from '../theme';

export type Periode = 7 | 30 | 'tout';

function depuis(p: Periode) {
  return p === 'tout' ? '0000-01-01' : addDays(isoDate(), -(p - 1));
}

function cellule(v: unknown, sep: string) {
  if (v == null) return '';
  const s = String(v);
  return /["\n\r]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(lignes: (string | number | null)[][], excelFr: boolean) {
  const sep = excelFr ? ';' : ',';
  const fmt = (v: string | number | null) =>
    typeof v === 'number' && excelFr ? String(v).replace('.', ',') : v;
  // BOM UTF-8 pour qu'Excel affiche les accents
  return '﻿' + lignes.map((l) => l.map((v) => cellule(fmt(v), sep)).join(sep)).join('\r\n');
}

async function partager(nom: string, contenu: string, mime: string) {
  if (Platform.OS === 'web') return partagerWeb(nom, contenu, mime);
  const f = new File(Paths.cache, nom);
  if (f.exists) f.delete();
  f.create();
  await f.write(contenu);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: nom });
  }
}

/** Navigateur : feuille de partage d'Android si possible (mail, Drive…), sinon téléchargement. */
async function partagerWeb(nom: string, contenu: string, mime: string) {
  const fichier = new globalThis.File([contenu], nom, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [fichier] })) {
    try {
      await nav.share({ files: [fichier], title: nom });
      return;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(fichier);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function choisirFichierWeb(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => resolve(input.files?.[0] ? await input.files[0].text() : null);
    input.click();
  });
}

export async function exporterCsvDetaille(p: Periode, excelFr = false) {
  const rows = await db.getAllAsync<Entree & { marque: string | null; code_barres: string | null; source: string | null }>(
    `SELECT e.*, a.marque, a.code_barres, a.source FROM entrees e LEFT JOIN aliments a ON a.id = e.aliment_id
     WHERE e.supprime = 0 AND e.date >= ? ORDER BY e.date, e.cree_le`,
    depuis(p),
  );
  const lignes: (string | number | null)[][] = [
    ['date', 'repas', 'aliment', 'marque', 'code_barres', 'source', 'quantite_g', 'kcal', 'proteines_g', 'glucides_g', 'lipides_g', 'fibres_g'],
    ...rows.map((r) => [
      r.date, repasInfo(r.repas).nom, r.libelle, r.marque, r.code_barres, r.aliment_id ? r.source : 'rapide',
      r.quantite_g, r.kcal, r.proteines, r.glucides, r.lipides, r.fibres,
    ]),
  ];
  await partager(`foodvictor-detail-${isoDate()}.csv`, csv(lignes, excelFr), 'text/csv');
}

export async function exporterCsvResume(p: Periode, excelFr = false) {
  const rows = await db.getAllAsync<{ date: string; repas: string; kcal: number; proteines: number; glucides: number; lipides: number; fibres: number }>(
    `SELECT date, repas, SUM(kcal) kcal, SUM(proteines) proteines, SUM(glucides) glucides, SUM(lipides) lipides, SUM(fibres) fibres
     FROM entrees WHERE supprime = 0 AND date >= ? GROUP BY date, repas ORDER BY date`,
    depuis(p),
  );
  const parJour = new Map<string, typeof rows>();
  rows.forEach((r) => parJour.set(r.date, [...(parJour.get(r.date) ?? []), r]));
  const lignes: (string | number | null)[][] = [[
    'date', 'kcal', 'objectif_kcal', 'ecart_kcal', 'proteines_g', 'objectif_proteines_g', 'glucides_g', 'objectif_glucides_g',
    'lipides_g', 'objectif_lipides_g', 'fibres_g', 'objectif_fibres_g',
    'kcal_petit_dej', 'kcal_dejeuner', 'kcal_diner', 'kcal_collation', 'objectif_kcal_dejeuner',
  ]];
  for (const [date, rs] of parJour) {
    const o = await getObjectifs(date);
    const t = rs.reduce((a, r) => ({ kcal: a.kcal + r.kcal, p: a.p + r.proteines, g: a.g + r.glucides, l: a.l + r.lipides, f: a.f + r.fibres }), { kcal: 0, p: 0, g: 0, l: 0, f: 0 });
    const k = (rep: string) => Math.round(rs.find((r) => r.repas === rep)?.kcal ?? 0);
    const r1 = (n: number) => Math.round(n * 10) / 10;
    lignes.push([
      date, Math.round(t.kcal), o.kcal, Math.round(t.kcal - o.kcal), r1(t.p), o.proteines_g, r1(t.g), o.glucides_g,
      r1(t.l), o.lipides_g, r1(t.f), o.fibres_g, k('petit_dej'), k('dejeuner'), k('diner'), k('collation'),
      objectifRepasKcal(o, 'dejeuner'),
    ]);
  }
  await partager(`foodvictor-resume-${isoDate()}.csv`, csv(lignes, excelFr), 'text/csv');
}

export async function exporterJson() {
  const tables: Record<string, unknown[]> = {};
  for (const t of Object.keys(SYNC_COLUMNS) as SyncTable[]) tables[t] = await toutesLesLignes(t);
  const contenu = JSON.stringify({ app: 'foodvictor', schema: 1, exporte_le: new Date().toISOString(), tables }, null, 1);
  await partager(`foodvictor-sauvegarde-${isoDate()}.json`, contenu, 'application/json');
}

/** Réimporte un fichier JSON exporté par l'app. */
export async function importerJson() {
  let texte: string | null;
  if (Platform.OS === 'web') texte = await choisirFichierWeb();
  else {
    const res = await File.pickFileAsync({ mimeTypes: ['application/json', '*/*'] });
    texte = res.canceled || !res.result ? null : await res.result.text();
  }
  if (!texte) return 0;
  const data = JSON.parse(texte);
  if (data?.app !== 'foodvictor' || !data.tables) throw new Error("Ce fichier n'est pas une sauvegarde Foodvictor.");
  let n = 0;
  for (const t of Object.keys(SYNC_COLUMNS) as SyncTable[]) {
    const rows = (data.tables[t] ?? []) as Record<string, unknown>[];
    await appliquerLignes(t, rows);
    n += rows.length;
  }
  return n;
}
