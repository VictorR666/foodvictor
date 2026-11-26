import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

// Une seule base locale : le téléphone est la source de vérité.
// Ouverte de façon asynchrone dans migrate() (obligatoire dans le navigateur, où SQLite tourne dans un worker).
let base: SQLite.SQLiteDatabase | null = null;
function ouverte() {
  if (!base) throw new Error('La base de données n’est pas encore ouverte.');
  return base;
}
type DB = SQLite.SQLiteDatabase;
export const db = {
  execAsync: ((...a: Parameters<DB['execAsync']>) => ouverte().execAsync(...a)) as DB['execAsync'],
  runAsync: ((...a: unknown[]) => (ouverte().runAsync as (...x: unknown[]) => unknown)(...a)) as DB['runAsync'],
  getFirstAsync: ((...a: unknown[]) => (ouverte().getFirstAsync as (...x: unknown[]) => unknown)(...a)) as DB['getFirstAsync'],
  getAllAsync: ((...a: unknown[]) => (ouverte().getAllAsync as (...x: unknown[]) => unknown)(...a)) as DB['getAllAsync'],
  withTransactionAsync: ((t: () => Promise<void>) => ouverte().withTransactionAsync(t)) as DB['withTransactionAsync'],
  prepareAsync: ((sql: string) => ouverte().prepareAsync(sql)) as DB['prepareAsync'],
};

// Colonnes synchronisées, dans l'ordre exact des onglets Google Sheets (voir apps-script/Code.gs).
export const SYNC_COLUMNS = {
  aliments: [
    'id', 'source', 'code_barres', 'nom', 'marque', 'kcal_100g', 'proteines_100g', 'glucides_100g',
    'lipides_100g', 'fibres_100g', 'portion_produit_g', 'portion_produit_lib', 'favori', 'modifie_le', 'supprime',
  ],
  portions: ['id', 'aliment_id', 'libelle', 'grammes', 'favori', 'modifie_le', 'supprime'],
  entrees: [
    'id', 'date', 'repas', 'aliment_id', 'libelle', 'quantite_g', 'kcal', 'proteines', 'glucides', 'lipides',
    'fibres', 'cree_le', 'modifie_le', 'supprime',
  ],
  objectifs: [
    'id', 'date_debut', 'kcal', 'proteines_g', 'glucides_g', 'lipides_g', 'fibres_g', 'unite_repas',
    'obj_petit_dej', 'obj_dejeuner', 'obj_diner', 'obj_collation', 'modifie_le', 'supprime',
  ],
} as const;
export type SyncTable = keyof typeof SYNC_COLUMNS;

const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS aliments (
    id TEXT PRIMARY KEY NOT NULL,
    source TEXT NOT NULL,              -- off | perso
    code_barres TEXT,
    nom TEXT NOT NULL,
    marque TEXT,
    kcal_100g REAL NOT NULL DEFAULT 0,
    proteines_100g REAL NOT NULL DEFAULT 0,
    glucides_100g REAL NOT NULL DEFAULT 0,
    lipides_100g REAL NOT NULL DEFAULT 0,
    fibres_100g REAL NOT NULL DEFAULT 0,
    portion_produit_g REAL,
    portion_produit_lib TEXT,
    favori INTEGER NOT NULL DEFAULT 0,
    dernier_g REAL,
    utilise_le TEXT,
    modifie_le TEXT NOT NULL,
    supprime INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_aliments_code ON aliments(code_barres);
  CREATE TABLE IF NOT EXISTS portions (
    id TEXT PRIMARY KEY NOT NULL,
    aliment_id TEXT NOT NULL,
    libelle TEXT NOT NULL,
    grammes REAL NOT NULL,
    favori INTEGER NOT NULL DEFAULT 0,
    modifie_le TEXT NOT NULL,
    supprime INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_portions_aliment ON portions(aliment_id);
  CREATE TABLE IF NOT EXISTS entrees (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    repas TEXT NOT NULL,
    aliment_id TEXT,
    libelle TEXT NOT NULL,
    quantite_g REAL,
    kcal REAL NOT NULL DEFAULT 0,
    proteines REAL NOT NULL DEFAULT 0,
    glucides REAL NOT NULL DEFAULT 0,
    lipides REAL NOT NULL DEFAULT 0,
    fibres REAL NOT NULL DEFAULT 0,
    cree_le TEXT NOT NULL,
    modifie_le TEXT NOT NULL,
    supprime INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_entrees_date ON entrees(date);
  CREATE TABLE IF NOT EXISTS objectifs (
    id TEXT PRIMARY KEY NOT NULL,
    date_debut TEXT NOT NULL,
    kcal REAL NOT NULL,
    proteines_g REAL NOT NULL,
    glucides_g REAL NOT NULL,
    lipides_g REAL NOT NULL,
    fibres_g REAL NOT NULL,
    unite_repas TEXT NOT NULL DEFAULT 'pct',
    obj_petit_dej REAL NOT NULL,
    obj_dejeuner REAL NOT NULL,
    obj_diner REAL NOT NULL,
    obj_collation REAL NOT NULL,
    modifie_le TEXT NOT NULL,
    supprime INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sync_file (
    tbl TEXT NOT NULL,
    row_id TEXT NOT NULL,
    tentatives INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tbl, row_id)
  );
  CREATE TABLE IF NOT EXISTS reglages (
    cle TEXT PRIMARY KEY NOT NULL,
    valeur TEXT
  );
  `,
  // v2 : colonne de recherche sans accents (riz, pâtes = pates…) pour les aliments, dont ceux de la table Ciqual
  `
  ALTER TABLE aliments ADD COLUMN recherche TEXT;
  CREATE INDEX IF NOT EXISTS idx_aliments_source ON aliments(source);
  `,
  // v3 : catégorie (groupe Ciqual : fruits, légumes…) pour filtrer les résultats de recherche
  `
  ALTER TABLE aliments ADD COLUMN categorie TEXT;
  `,
];

/** Dans un navigateur, une seule fenêtre peut tenir la base ouverte à la fois. */
export function estErreurDejaOuverte(e: unknown) {
  return /Access Handle|createSyncAccessHandle|NoModificationAllowed|déjà ouverte/i.test(String((e as Error)?.message ?? e));
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ouvrirBase() {
  // Après un rechargement, l'ancienne page peut mettre un instant à lâcher la base : on réessaie quelques fois.
  for (let essai = 0; ; essai++) {
    try {
      return await SQLite.openDatabaseAsync('foodvictor.db');
    } catch (e) {
      if (Platform.OS !== 'web' || !estErreurDejaOuverte(e) || essai >= 7) throw e;
      await pause(300 * (essai + 1));
    }
  }
}

/** Libère la base (web : quand la page se ferme, pour que la suivante puisse l'ouvrir). */
export async function fermerBase() {
  const b = base;
  base = null;
  if (b) await b.closeAsync().catch(() => {});
}

export async function migrate() {
  if (!base) base = await ouvrirBase();
  if (Platform.OS !== 'web') await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let v = row?.user_version ?? 0;
  while (v < MIGRATIONS.length) {
    await db.execAsync(MIGRATIONS[v]);
    v += 1;
    await db.execAsync(`PRAGMA user_version = ${v}`);
  }
}
