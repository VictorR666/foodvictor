// Palette reprise du Dashboard Maison (lavande / pêche / menthe) + une couleur par macro.
export const C = {
  bg: '#FDFCFF',
  ink: '#3A3350',
  ink2: '#6E6887',
  card: '#FFFFFF',
  soft: '#F5F2FF',
  lavSoft: '#EFEBFF',
  lav: '#8D7BF0',
  lavText: '#6250D4',
  lavDark: '#5641C4',
  peach: '#FF9E73',
  peachSoft: '#FFEDE3',
  peachText: '#C2572B',
  mint: '#3FA97E',
  mintSoft: '#E0F7EC',
  okBg: '#DDF6E6',
  okText: '#1F6F49',
  warnBg: '#FFEBD1',
  warnText: '#8A4F0A',
  errBg: '#FFDDD8',
  errText: '#9E2F29',
};

export type MacroKey = 'proteines' | 'glucides' | 'lipides' | 'fibres';

// fill = barres / anneaux, text = texte lisible, bg = pastille
export const MACRO: Record<MacroKey, { lettre: string; nom: string; fill: string; text: string; bg: string }> = {
  proteines: { lettre: 'P', nom: 'Protéines', fill: '#F0695E', text: '#B83A30', bg: '#FFE3E0' },
  glucides: { lettre: 'G', nom: 'Glucides', fill: '#F5A524', text: '#8A5A00', bg: '#FFF0D1' },
  lipides: { lettre: 'L', nom: 'Lipides', fill: '#5B8DEF', text: '#2F5FC4', bg: '#E1EBFF' },
  fibres: { lettre: 'F', nom: 'Fibres', fill: '#3FB57F', text: '#1F6F49', bg: '#DDF6E6' },
};
export const MACRO_KEYS: MacroKey[] = ['proteines', 'glucides', 'lipides', 'fibres'];

export const F = {
  display: 'Fredoka_600SemiBold',
  body: 'Nunito_700Bold',
  bodySemi: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_800ExtraBold',
};

export const shadow = {
  shadowColor: '#8D7BF0',
  shadowOpacity: 0.14,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
};

export type RepasKey = 'petit_dej' | 'dejeuner' | 'diner' | 'collation';
export const REPAS: { key: RepasKey; nom: string; court: string; bg: string; fg: string }[] = [
  { key: 'petit_dej', nom: 'Petit-déjeuner', court: 'Petit-déj', bg: C.peachSoft, fg: C.peachText },
  { key: 'dejeuner', nom: 'Déjeuner', court: 'Déjeuner', bg: C.mintSoft, fg: '#1F7A50' },
  { key: 'diner', nom: 'Dîner', court: 'Dîner', bg: C.lavSoft, fg: C.lavText },
  { key: 'collation', nom: 'Collation', court: 'Collation', bg: C.peachSoft, fg: C.peachText },
];
export const repasInfo = (k: RepasKey) => REPAS.find((r) => r.key === k) ?? REPAS[0];

/** Repas proposé par défaut selon l'heure. */
export function repasParDefaut(): RepasKey {
  const h = new Date().getHours();
  if (h < 11) return 'petit_dej';
  if (h < 15) return 'dejeuner';
  if (h < 18) return 'collation';
  return 'diner';
}
