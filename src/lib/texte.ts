/** Texte de recherche : minuscules, sans accents, sans ponctuation (« Pâtes, cuites » → « pates cuites »). */
export function normaliser(s: string) {
  return s
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Mots d'une recherche ; « oeufs » cherche aussi « oeuf » (pluriels). */
export function motsRecherche(q: string) {
  return normaliser(q)
    .split(' ')
    .filter(Boolean)
    .map((m) => (m.length > 3 && m.endsWith('s') ? m.slice(0, -1) : m));
}
