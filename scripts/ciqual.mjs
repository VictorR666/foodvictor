/**
 * Télécharge la table officielle Ciqual (Anses) et la réduit à ce dont l'app a besoin :
 * nom, groupe, kcal, protéines, glucides, lipides, fibres pour 100 g.
 * Écrit data/ciqual.json. Lancé par .github/workflows/ciqual.yml (le serveur GitHub a accès à internet).
 *
 * Sources essayées dans l'ordre :
 *  1. version la plus récente sur recherche.data.gouv (doi:10.57745/RDMHWY)
 *  2. version 2020 sur data.gouv.fr (Licence Ouverte)
 * Usage local avec un fichier déjà téléchargé : node scripts/ciqual.mjs chemin/vers/table.xlsx
 */
import fs from 'node:fs';
import * as XLSX from 'xlsx';

const UA = { 'User-Agent': 'Foodvictor-data-script (github.com/VictorR666/foodvictor)', Accept: 'application/json' };

async function json(url) {
  const r = await fetch(url, { headers: UA, redirect: 'follow' });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}

const SOURCES = [
  {
    nom: 'recherche.data.gouv (version la plus récente)',
    async trouver() {
      const j = await json('https://entrepot.recherche.data.gouv.fr/api/datasets/:persistentId/?persistentId=doi:10.57745/RDMHWY');
      const v = j.data.latestVersion;
      const files = v.files.map((f) => f.dataFile);
      console.log('  fichiers :', files.map((f) => f.filename).join(' | '));
      const tableurs = files.filter((f) => /\.xlsx?$/i.test(f.filename));
      const f = tableurs.find((x) => /fr/i.test(x.filename) && !/doc/i.test(x.filename)) ?? tableurs.find((x) => !/doc|eng/i.test(x.filename)) ?? tableurs[0];
      if (!f) throw new Error('aucun fichier Excel');
      return { url: `https://entrepot.recherche.data.gouv.fr/api/access/datafile/${f.id}`, fichier: f.filename, version: `${v.versionNumber}.${v.versionMinorNumber}` };
    },
  },
  {
    nom: 'data.gouv.fr (Ciqual 2020)',
    async trouver() {
      const j = await json('https://www.data.gouv.fr/api/1/datasets/5369a15fa3a729239d2065b7/');
      console.log('  ressources :', j.resources.map((r) => `${r.title} [${r.format}]`).join(' | '));
      const tableurs = j.resources.filter((r) => /xls/i.test(`${r.format} ${r.url}`));
      const f = tableurs.find((r) => /fr/i.test(`${r.title} ${r.url}`) && !/eng|doc/i.test(`${r.title} ${r.url}`)) ?? tableurs[0];
      if (!f) throw new Error('aucun fichier Excel');
      return { url: f.url, fichier: f.title, version: '2020' };
    },
  },
];

function nombre(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim().toLowerCase();
  if (!s || s === '-') return null;
  if (s.startsWith('trace')) return 0;
  if (s.startsWith('<')) return 0; // sous le seuil de détection
  const n = parseFloat(s.replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function colonne(entetes, ...motifs) {
  for (const m of motifs) {
    const i = entetes.findIndex((h) => m.test(String(h ?? '')));
    if (i >= 0) return i;
  }
  return -1;
}

export function convertir(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  for (const nomFeuille of wb.SheetNames) {
    const lignes = XLSX.utils.sheet_to_json(wb.Sheets[nomFeuille], { header: 1, raw: true, defval: null });
    const iEntete = lignes.findIndex((l) => l.some((c) => /alim_code/i.test(String(c ?? ''))));
    if (iEntete < 0) continue;
    const h = lignes[iEntete].map((c) => String(c ?? '').replace(/\s+/g, ' ').trim());
    const c = {
      code: colonne(h, /^alim_code$/i),
      nom: colonne(h, /^alim_nom_fr$/i, /alim_nom_fr/i),
      groupe: colonne(h, /^alim_ssgrp_nom_fr$/i, /^alim_grp_nom_fr$/i),
      kcal: colonne(h, /1169.?2011.*kcal/i, /nergie.*kcal/i, /kcal.?100/i),
      p: colonne(h, /Prot.*Jones/i, /^Prot[ée]ines/i),
      g: colonne(h, /^Glucides \(g.?100/i, /^Glucides/i),
      l: colonne(h, /^Lipides \(g.?100/i, /^Lipides/i),
      f: colonne(h, /^Fibres alimentaires/i, /^Fibres/i),
    };
    console.log('  feuille', nomFeuille, 'colonnes :', JSON.stringify(Object.fromEntries(Object.entries(c).map(([k, i]) => [k, h[i]]))));
    if (Object.values(c).some((i) => i < 0)) {
      console.log('  en-têtes disponibles :', h.filter((x) => /nergie|kcal|prot|gluc|lipid|fibre/i.test(x)).join(' | '));
      throw new Error(`colonnes manquantes dans « ${nomFeuille} »`);
    }
    const r1 = (n) => (n == null ? null : Math.round(n * 10) / 10);
    const aliments = [];
    for (const l of lignes.slice(iEntete + 1)) {
      const code = l[c.code];
      const nom = l[c.nom] ? String(l[c.nom]).replace(/\s+/g, ' ').trim() : '';
      if (!code || !nom) continue;
      const p = nombre(l[c.p]);
      const g = nombre(l[c.g]);
      const li = nombre(l[c.l]);
      const f = nombre(l[c.f]);
      let kcal = nombre(l[c.kcal]);
      if (kcal == null && [p, g, li].some((x) => x != null)) kcal = 4 * (p ?? 0) + 4 * (g ?? 0) + 9 * (li ?? 0) + 2 * (f ?? 0);
      if (kcal == null) continue;
      aliments.push([String(code), nom, l[c.groupe] ? String(l[c.groupe]).replace(/\s+/g, ' ').trim() : '', Math.round(kcal), r1(p) ?? 0, r1(g) ?? 0, r1(li) ?? 0, r1(f) ?? 0]);
    }
    return aliments;
  }
  throw new Error('aucune feuille avec la colonne alim_code');
}

async function main() {
  let buffer;
  let meta;
  if (process.argv[2]) {
    buffer = fs.readFileSync(process.argv[2]);
    meta = { fichier: process.argv[2], version: 'local', url: null };
  } else {
    for (const s of SOURCES) {
      try {
        console.log('Source :', s.nom);
        meta = await s.trouver();
        console.log('  téléchargement :', meta.fichier, meta.url);
        const r = await fetch(meta.url, { headers: { 'User-Agent': UA['User-Agent'] }, redirect: 'follow' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        buffer = Buffer.from(await r.arrayBuffer());
        convertir(buffer); // vérifie que le fichier est lisible avant de le garder
        meta.source = s.nom;
        break;
      } catch (e) {
        console.log('  échec :', e.message);
        buffer = null;
      }
    }
  }
  if (!buffer) throw new Error('Aucune source Ciqual disponible.');
  const aliments = convertir(buffer);
  if (aliments.length < 1000) throw new Error(`Seulement ${aliments.length} aliments : fichier inattendu.`);
  const sortie = {
    attribution: 'Anses. Table de composition nutritionnelle des aliments Ciqual. https://ciqual.anses.fr/',
    source: meta.source ?? meta.fichier,
    fichier: meta.fichier,
    version: meta.version,
    genere_le: new Date().toISOString().slice(0, 10),
    colonnes: ['code', 'nom', 'groupe', 'kcal', 'proteines', 'glucides', 'lipides', 'fibres'],
    aliments,
  };
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/ciqual.json', JSON.stringify(sortie));
  console.log(`OK : ${aliments.length} aliments → data/ciqual.json`);
  console.log('Exemples :', aliments.filter((a) => /^(Riz|Flocon|Poulet)/.test(a[1])).slice(0, 6).map((a) => a.join(' | ')).join('\n  '));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
