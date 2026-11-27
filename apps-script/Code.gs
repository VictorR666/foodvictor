/**
 * @OnlyCurrentDoc  Limite l'autorisation à CETTE feuille (pas à toutes tes Google Sheets).
 */

/**
 * Foodvictor — script de sauvegarde Google Sheets.
 *
 * Installation (5 minutes) :
 *  1. Crée une Google Sheet vide nommée « Foodvictor · Journal ».
 *  2. Extensions > Apps Script, colle ce fichier à la place du code existant.
 *  3. Remplace SECRET ci-dessous par une phrase longue que toi seul connais.
 *  4. Exécute une fois la fonction `installer` (bouton ▶) et accepte les autorisations.
 *  5. Déployer > Nouveau déploiement > type « Application Web »
 *       - Exécuter en tant que : moi
 *       - Qui a accès : Tout le monde (la clé secrète protège les données)
 *  6. Copie l'URL qui finit par /exec et colle-la, avec la clé, dans l'app (onglet Sauvegarde).
 *
 * Test : ouvre dans un navigateur  <URL /exec>?secret=<ta clé>
 *   -> {"ok":true,"ping":true}  le script répond et la clé est bonne
 *   -> {"ok":false,"error":"secret"}  la clé ne correspond pas
 */

const SECRET = 'REMPLACE-MOI-par-une-longue-phrase-secrete';

// Même ordre de colonnes que dans l'app (src/db/index.ts > SYNC_COLUMNS).
const HEADERS = {
  aliments: ['id', 'source', 'code_barres', 'nom', 'marque', 'kcal_100g', 'proteines_100g', 'glucides_100g',
    'lipides_100g', 'fibres_100g', 'portion_produit_g', 'portion_produit_lib', 'favori', 'modifie_le', 'supprime'],
  portions: ['id', 'aliment_id', 'libelle', 'grammes', 'favori', 'modifie_le', 'supprime'],
  entrees: ['id', 'date', 'repas', 'aliment_id', 'libelle', 'quantite_g', 'kcal', 'proteines', 'glucides', 'lipides',
    'fibres', 'cree_le', 'modifie_le', 'supprime'],
  objectifs: ['id', 'date_debut', 'kcal', 'proteines_g', 'glucides_g', 'lipides_g', 'fibres_g', 'unite_repas',
    'obj_petit_dej', 'obj_dejeuner', 'obj_diner', 'obj_collation', 'modifie_le', 'supprime'],
  repas_favoris: ['id', 'nom', 'repas', 'cree_le', 'modifie_le', 'supprime'],
  repas_favoris_items: ['id', 'repas_favori_id', 'aliment_id', 'libelle', 'quantite_g', 'kcal', 'proteines', 'glucides',
    'lipides', 'fibres', 'ordre', 'modifie_le', 'supprime'],
};
// Colonnes gardées en texte (sinon Sheets transforme les dates et mange les zéros des codes-barres).
const TEXTE = ['id', 'date', 'date_debut', 'code_barres', 'aliment_id', 'cree_le', 'modifie_le', 'repas', 'unite_repas', 'source', 'repas_favori_id'];

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function feuille_(ss, nom) {
  let sh = ss.getSheetByName(nom);
  if (!sh) {
    sh = ss.insertSheet(nom);
    const h = HEADERS[nom];
    h.forEach(function (col, i) {
      if (TEXTE.indexOf(col) >= 0) sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@');
    });
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function upsert_(ss, table, rows) {
  const h = HEADERS[table];
  if (!h) return 0;
  const sh = feuille_(ss, table);
  const last = sh.getLastRow();
  const index = {};
  if (last > 1) {
    sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r, i) { index[String(r[0])] = i + 2; });
  }
  const ajouts = [];
  rows.forEach(function (r) {
    const vals = h.map(function (k) { return r[k] === null || r[k] === undefined ? '' : r[k]; });
    const at = index[String(r.id)];
    if (at) {
      sh.getRange(at, 1, 1, h.length).setValues([vals]);
    } else {
      ajouts.push(vals);
      index[String(r.id)] = -1;
    }
  });
  if (ajouts.length) sh.getRange(sh.getLastRow() + 1, 1, ajouts.length, h.length).setValues(ajouts);
  return rows.length;
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents || '{}');
  if (body.secret !== SECRET) return json_({ ok: false, error: 'secret' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const parTable = {};
    (body.changes || []).forEach(function (c) { (parTable[c.table] = parTable[c.table] || []).push(c.row); });
    let n = 0;
    Object.keys(parTable).forEach(function (t) { n += upsert_(ss, t, parTable[t]); });
    // `tables` : l'app sait ainsi quels onglets ce script connaît (sinon elle garde ces lignes en attente).
    return json_({ ok: true, applied: n, tables: Object.keys(HEADERS) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  if ((e.parameter || {}).secret !== SECRET) return json_({ ok: false, error: 'secret' });
  if (e.parameter.action !== 'dump') return json_({ ok: true, ping: true });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const tables = {};
  Object.keys(HEADERS).forEach(function (t) {
    const sh = ss.getSheetByName(t);
    if (!sh || sh.getLastRow() < 2) { tables[t] = []; return; }
    const h = HEADERS[t];
    tables[t] = sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues()
      .filter(function (v) { return String(v[0]) !== ''; })
      .map(function (v) {
        const o = {};
        h.forEach(function (k, i) {
          o[k] = v[i] instanceof Date ? Utilities.formatDate(v[i], tz, 'yyyy-MM-dd') : v[i];
        });
        return o;
      });
  });
  return json_({ ok: true, tables: tables });
}

/** À lancer une fois : crée les onglets et l'onglet « jours » (totaux par jour, calculés par formule). */
function installer() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(function (t) { feuille_(ss, t); });
  let jours = ss.getSheetByName('jours');
  if (!jours) jours = ss.insertSheet('jours');
  jours.clear();
  // entrees : B = date, C = repas, G..K = kcal, protéines, glucides, lipides, fibres, N = supprime
  jours.getRange('A1').setFormula(
    '=QUERY(entrees!A:N, "select B, sum(G), sum(H), sum(I), sum(J), sum(K) where B is not null and N <> 1 group by B order by B desc ' +
    'label B \'date\', sum(G) \'kcal\', sum(H) \'proteines_g\', sum(I) \'glucides_g\', sum(J) \'lipides_g\', sum(K) \'fibres_g\'", 1)'
  );
  const vide = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
  if (vide && vide.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(vide);
}
