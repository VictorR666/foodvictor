import ciqual from '../../data/ciqual.json';
import { db } from '../db';
import { completerRecherche, getReglage, now, setReglage, texteRecherche } from '../db/repo';
import { emitDataChange } from './events';

/**
 * Aliments génériques de la table Ciqual (Anses) : riz, flocons d'avoine, poulet, fruits…
 * Chargés une fois dans la base locale (puis à chaque nouvelle version de la table),
 * pour être cherchés hors ligne comme tes propres aliments.
 * Ils ne partent pas dans la Google Sheet (la table est déjà dans l'app),
 * sauf si tu modifies l'un d'eux (favori…).
 */
type Ligne = [string, string, string, number, number, number, number, number];
const table = ciqual as unknown as { version: string; genere_le: string; aliments: Ligne[]; attribution: string; fichier: string };

export const CIQUAL_INFO = { version: table.version, fichier: table.fichier, date: table.genere_le, nombre: table.aliments.length };
const CLE = 'ciqual_version';

let enCours: Promise<void> | null = null;

export function chargerCiqual() {
  if (!enCours) enCours = charger().finally(() => (enCours = null));
  return enCours;
}

async function charger() {
  await completerRecherche();
  const version = `${table.fichier}|${table.genere_le}|${table.aliments.length}|categorie`;
  if ((await getReglage(CLE)) === version) return;
  const t = now();
  const st = await db.prepareAsync(
    `INSERT INTO aliments (id, source, code_barres, nom, marque, kcal_100g, proteines_100g, glucides_100g, lipides_100g, fibres_100g,
       portion_produit_g, portion_produit_lib, favori, dernier_g, utilise_le, modifie_le, supprime, recherche, categorie)
     VALUES (?, 'ciqual', NULL, ?, NULL, ?, ?, ?, ?, ?, NULL, NULL, 0, NULL, NULL, ?, 0, ?, ?)
     ON CONFLICT(id) DO UPDATE SET nom = excluded.nom, kcal_100g = excluded.kcal_100g, proteines_100g = excluded.proteines_100g,
       glucides_100g = excluded.glucides_100g, lipides_100g = excluded.lipides_100g, fibres_100g = excluded.fibres_100g,
       recherche = excluded.recherche, categorie = excluded.categorie`,
  );
  try {
    await db.withTransactionAsync(async () => {
      for (const [code, nom, groupe, kcal, p, g, l, f] of table.aliments) {
        const categorie = groupe && groupe !== '-' ? groupe.charAt(0).toUpperCase() + groupe.slice(1) : null;
        await st.executeAsync(`ciqual-${code}`, nom, kcal, p, g, l, f, t, texteRecherche(nom), categorie);
      }
    });
  } finally {
    await st.finalizeAsync();
  }
  await setReglage(CLE, version);
  emitDataChange();
}
