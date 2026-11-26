import type { Aliment } from '../db/repo';
import { MACRO, MacroKey } from '../theme';
import { normaliser } from './texte';

/**
 * Visuel d'un aliment quand il n'a pas de photo (table Ciqual, aliments perso) :
 * un emoji tiré du nom ou de la famille, sur la couleur pastel de sa macro dominante.
 */

// Testés dans l'ordre sur le début du nom (« pomme de terre » avant « pomme »).
const PAR_NOM: [RegExp, string][] = [
  [/^pomme de terre|^frite|^puree de pomme de terre|^gnocchi/, '🥔'],
  [/^banane/, '🍌'], [/^pomme|^compote/, '🍎'], [/^poire/, '🍐'], [/^orange|^clementine|^mandarine/, '🍊'],
  [/^citron/, '🍋'], [/^raisin/, '🍇'], [/^fraise|^framboise/, '🍓'], [/^cerise/, '🍒'], [/^peche|^abricot|^nectarine/, '🍑'],
  [/^ananas/, '🍍'], [/^kiwi/, '🥝'], [/^mangue/, '🥭'], [/^noix de coco|^coco/, '🥥'], [/^melon/, '🍈'], [/^pasteque/, '🍉'],
  [/^myrtille|^cassis|^mure/, '🫐'], [/^avocat/, '🥑'], [/^tomate/, '🍅'], [/^carotte/, '🥕'], [/^brocoli|^chou/, '🥦'],
  [/^mais/, '🌽'], [/^champignon/, '🍄'], [/^poivron|^piment/, '🫑'], [/^concombre|^cornichon|^courgette/, '🥒'],
  [/^aubergine/, '🍆'], [/^oignon|^echalote/, '🧅'], [/^ail\b/, '🧄'], [/^salade|^laitue|^epinard|^mache|^roquette/, '🥬'],
  [/^haricot|^lentille|^pois chiche|^feve/, '🫘'], [/^riz/, '🍚'], [/^pate|^spaghetti|^nouille|^lasagne/, '🍝'],
  [/^flocon|^muesli|^porridge|^granola/, '🥣'], [/^pain|^baguette|^biscotte/, '🍞'], [/^croissant|^pain au chocolat/, '🥐'],
  [/^galette|^crepe/, '🥞'], [/^oeuf/, '🥚'], [/^poulet|^dinde|^canard/, '🍗'], [/^boeuf|^steak|^veau|^agneau|^porc/, '🥩'],
  [/^jambon|^lardon|^bacon|^saucisse/, '🥓'], [/^saumon|^thon|^cabillaud|^poisson|^sardine|^truite/, '🐟'],
  [/^crevette|^moule|^huitre|^crabe/, '🦐'], [/^fromage|^emmental|^comte|^camembert|^mozzarella|^chevre/, '🧀'],
  [/^lait|^yaourt|^fromage blanc|^skyr/, '🥛'], [/^beurre/, '🧈'], [/^huile|^olive/, '🫒'], [/^chocolat|^cacao/, '🍫'],
  [/^miel|^confiture/, '🍯'], [/^cafe/, '☕'], [/^the\b|^tisane/, '🍵'], [/^jus|^nectar|^soda|^boisson/, '🧃'],
  [/^eau/, '💧'], [/^amande|^noisette|^noix|^cacahuete|^pistache|^cajou/, '🥜'], [/^pizza/, '🍕'], [/^sandwich|^burger/, '🥪'],
  [/^soupe|^veloute/, '🥣'], [/^glace|^sorbet/, '🍨'], [/^gateau|^tarte|^cake|^brownie|^muffin/, '🍰'], [/^biscuit|^cookie/, '🍪'],
];

// Familles de la table Ciqual.
const PAR_FAMILLE: [RegExp, string][] = [
  [/infantile/, '🍼'], [/fruits a coque/, '🥜'], [/fruit/, '🍎'], [/legumineuse/, '🫘'], [/legume|algue/, '🥦'],
  [/pommes de terre/, '🥔'], [/petit dejeuner|barre/, '🥣'], [/pates riz|farine/, '🍚'], [/pain/, '🍞'], [/viennoiserie/, '🥐'],
  [/gateau|patisserie|pates a tarte/, '🍰'], [/biscuits sucre/, '🍪'], [/aperitif/, '🥨'], [/charcuterie/, '🥓'],
  [/viande/, '🥩'], [/mollusque|crustace/, '🦐'], [/poisson|mer/, '🐟'], [/oeuf/, '🥚'], [/fromage/, '🧀'],
  [/lait|laitier|creme/, '🥛'], [/beurre|margarine|matiere grasse/, '🧈'], [/huile/, '🫒'], [/eaux/, '💧'],
  [/alcool/, '🍷'], [/boisson/, '🧃'], [/chocolat/, '🍫'], [/confiserie/, '🍬'], [/confiture|sucre|miel/, '🍯'],
  [/glace|sorbet|glace/, '🍨'], [/soupe/, '🥣'], [/pizza|crepe/, '🍕'], [/sandwich/, '🥪'], [/salade/, '🥗'],
  [/plat/, '🍲'], [/sauce|condiment|culinaire/, '🫙'], [/epice|herbe|sel/, '🌿'], [/vegetari/, '🌱'], [/feuillete|entree/, '🥧'],
];

export function emojiDe(a: Pick<Aliment, 'nom' | 'source'> & { categorie?: string | null }) {
  const nom = normaliser(a.nom);
  for (const [re, e] of PAR_NOM) if (re.test(nom)) return e;
  const fam = normaliser(a.categorie ?? '');
  if (fam) for (const [re, e] of PAR_FAMILLE) if (re.test(fam)) return e;
  return a.source === 'off' ? '🛒' : '🍽️';
}

/** Macro qui apporte le plus de calories : sert à colorer le fond du visuel. */
export function macroDominante(a: Pick<Aliment, 'proteines_100g' | 'glucides_100g' | 'lipides_100g'>): MacroKey {
  const kcal: [MacroKey, number][] = [
    ['proteines', a.proteines_100g * 4],
    ['glucides', a.glucides_100g * 4],
    ['lipides', a.lipides_100g * 9],
  ];
  return kcal.sort((x, y) => y[1] - x[1])[0][1] > 0 ? kcal[0][0] : 'fibres';
}

export const fondDe = (a: Pick<Aliment, 'proteines_100g' | 'glucides_100g' | 'lipides_100g'>) => MACRO[macroDominante(a)].bg;
