import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { BarreDepassement, Ecran, IcBas, IcCalendrier, IcDroite, IcRetour, IcSync, Rond, fmt } from '../../components/ui';
import { CerclesMacros } from '../../components/CerclesMacros';
import { Entree, Totaux, ZERO, ciblesRepas, entreesDuJour, getObjectifs, somme } from '../../db/repo';
import { LETTRE_JOUR, addDays, isoDate, libelleJour, parseIso, semaine, titreJour } from '../../lib/date';
import { setJour, useData, useJour } from '../../lib/hooks';
import { EtatSync, surEtatSync } from '../../lib/sync';
import { C, F, MACRO, MACRO_KEYS, REPAS, RepasKey, repasInfo } from '../../theme';

// Accueil épuré façon Foodvisor : bandeau coloré (kcal + 4 barres), puis la journée et les 4 repas.
const BANDEAU = '#F4F3F7'; // blanc grisâtre, très léger
const PISTE = '#E6E3EE';
const TRAIT = '#EEEBF6';

export default function Journal() {
  const jour = useJour();
  const [data] = useData(async () => {
    const [entrees, obj] = await Promise.all([entreesDuJour(jour), getObjectifs(jour)]);
    return { entrees, obj };
  }, [jour]);
  const [sync, setSync] = useState<EtatSync>();
  const [details, setDetails] = useState(false);
  const [semaineOuverte, setSemaineOuverte] = useState(false);
  const [ouverts, setOuverts] = useState<Partial<Record<RepasKey, boolean>>>({});
  useEffect(() => surEtatSync(setSync), []);

  const entrees = data?.entrees ?? [];
  const obj = data?.obj;
  const total = somme(entrees);
  const objectif = obj?.kcal ?? 0;
  const restant = objectif - total.kcal;
  const today = isoDate();
  const cibleMacro = (k: (typeof MACRO_KEYS)[number]) =>
    obj ? { proteines: obj.proteines_g, glucides: obj.glucides_g, lipides: obj.lipides_g, fibres: obj.fibres_g }[k] : 0;

  // On ne montre la sauvegarde que si elle demande une action.
  const alerteSync =
    sync?.etat === 'erreur' ? { label: 'Sauvegarde en erreur', bg: C.errBg, fg: C.errText }
      : sync?.etat === 'non_configure' ? { label: 'Sauvegarde non configurée', bg: C.warnBg, fg: C.warnText }
        : null;

  return (
    <Ecran bas={90} style={{ padding: 0, gap: 0 }}>
      {/* Bandeau */}
      <View style={{ backgroundColor: BANDEAU, paddingTop: 18, paddingBottom: 42, paddingHorizontal: 20 }}>
        {alerteSync ? (
          <Rond label={alerteSync.label} fond={alerteSync.bg} taille={38} onPress={() => router.navigate('/sauvegarde')} style={{ position: 'absolute', right: 14, top: 12, zIndex: 1 }}>
            <IcSync couleur={alerteSync.fg} taille={17} />
          </Rond>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Chiffre valeur={total.kcal} legende="Consommées" />
          <AnneauKcal ratio={objectif ? total.kcal / objectif : 0} depasse={restant < 0}>
            <Text style={{ fontFamily: F.display, fontSize: 28, color: restant < 0 ? MACRO.proteines.text : C.ink, lineHeight: 32 }}>
              {fmt(Math.abs(restant))}
            </Text>
            <Text style={{ fontFamily: F.bodySemi, fontSize: 12.5, color: C.ink2 }}>{restant < 0 ? 'kcal en trop' : 'kcal restantes'}</Text>
          </AnneauKcal>
          <Chiffre valeur={objectif} legende="Objectif" />
        </View>

        <View style={{ flexDirection: 'row', gap: 14, marginTop: 22 }}>
          {MACRO_KEYS.map((k) => {
            const cible = cibleMacro(k);
            const trop = !!cible && total[k] > cible;
            return (
              <View key={k} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
                <BarreDepassement ratio={cible ? total[k] / cible : 0} couleur={MACRO[k].fill} fonce={MACRO[k].fonce} fond={PISTE} />
                <Text numberOfLines={1} style={{ fontFamily: F.bodySemi, fontSize: 13, color: C.ink2 }}>{MACRO[k].nom}</Text>
                {details ? (
                  <Text style={{ fontFamily: F.body, fontSize: 12.5, color: trop ? MACRO[k].text : C.ink, marginTop: -4 }}>
                    {fmt(total[k])} / {fmt(cible)} g
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={details ? 'Masquer le détail des macros' : 'Voir le détail des macros'}
          onPress={() => setDetails((d) => !d)}
          style={{ alignSelf: 'center', marginTop: 6, width: 56, height: 32, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ transform: [{ rotate: details ? '180deg' : '0deg' }] }}>
            <IcBas couleur={C.ink2} taille={22} epais={2.4} />
          </View>
        </Pressable>
      </View>

      {/* Feuille blanche */}
      <View style={{ marginTop: -26, backgroundColor: C.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 16, paddingTop: 16, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Rond label="Jour précédent" fond={BANDEAU} taille={48} onPress={() => setJour(addDays(jour, -1))}>
            <IcRetour couleur={C.ink} taille={20} epais={2.6} />
          </Rond>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${libelleJour(jour)}, choisir un autre jour`}
            onPress={() => setSemaineOuverte((o) => !o)}
            style={{ flex: 1, minHeight: 48, borderRadius: 999, backgroundColor: BANDEAU, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}
          >
            <IcCalendrier couleur={C.ink} taille={22} epais={2} />
            <Text style={{ fontFamily: F.display, fontSize: 19, color: C.ink }}>{titreJour(jour)}</Text>
          </Pressable>
          <Rond label="Jour suivant" fond={BANDEAU} taille={48} onPress={() => setJour(addDays(jour, 1))}>
            <IcDroite couleur={C.ink} taille={20} epais={2.6} />
          </Rond>
        </View>

        {semaineOuverte ? (
          <View style={{ flexDirection: 'row', gap: 4, paddingTop: 6 }}>
            {semaine(jour).map((d) => {
              const on = d === jour;
              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  accessibilityLabel={libelleJour(d)}
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    setJour(d);
                    setSemaineOuverte(false);
                  }}
                  style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6, borderRadius: 16, minHeight: 50,
                    backgroundColor: on ? C.ink : 'transparent', borderWidth: d === today && !on ? 1.5 : 0, borderColor: C.lav }}
                >
                  <Text style={{ fontFamily: F.body, fontSize: 11, color: on ? '#fff' : C.ink2 }}>{LETTRE_JOUR[parseIso(d).getDay()]}</Text>
                  <Text style={{ fontFamily: F.display, fontSize: 16, color: on ? '#fff' : C.ink }}>{parseIso(d).getDate()}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {semaineOuverte && jour !== today ? (
          <Pressable accessibilityRole="button" onPress={() => { setJour(today); setSemaineOuverte(false); }} style={{ alignSelf: 'center', minHeight: 36, justifyContent: 'center', paddingHorizontal: 12 }}>
            <Text style={{ fontFamily: F.body, fontSize: 13.5, color: C.lavText }}>Revenir à aujourd'hui</Text>
          </Pressable>
        ) : null}

        <View style={{ height: 10 }} />
        {REPAS.map((r, i) => {
          const es = entrees.filter((e) => e.repas === r.key);
          const precedentPlein = i > 0 && entrees.some((e) => e.repas === REPAS[i - 1].key);
          return (
            <Repas
              key={r.key}
              repasKey={r.key}
              es={es}
              cibles={obj ? ciblesRepas(obj, r.key) : ZERO}
              trait={i > 0 && !es.length && !precedentPlein}
              ouvert={!!ouverts[r.key]}
              basculer={() => setOuverts((o) => ({ ...o, [r.key]: !o[r.key] }))}
            />
          );
        })}
      </View>
    </Ecran>
  );
}

function Chiffre({ valeur, legende }: { valeur: number; legende: string }) {
  return (
    <View style={{ width: 92, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: F.display, fontSize: 22, color: C.ink }}>{fmt(valeur)}</Text>
      <Text style={{ fontFamily: F.bodySemi, fontSize: 13, color: C.ink2 }}>{legende}</Text>
    </View>
  );
}

/** Cercle des kcal du jour : piste blanche, progression qui part du haut. */
function AnneauKcal({ ratio, depasse, children }: { ratio: number; depasse: boolean; children: React.ReactNode }) {
  const taille = 132, ep = 9, r = (taille - ep) / 2, L = 2 * Math.PI * r;
  const part = Math.max(0, Math.min(1, ratio));
  const trop = Math.max(0, Math.min(1, ratio - 1));
  return (
    <View style={{ width: taille, height: taille, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={taille} height={taille} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke={PISTE} strokeWidth={ep} />
        {part > 0 ? (
          <Circle
            cx={taille / 2} cy={taille / 2} r={r} fill="none"
            stroke={C.lav} strokeWidth={ep} strokeLinecap={part < 1 ? 'round' : 'butt'}
            strokeDasharray={`${part * L} ${L}`}
          />
        ) : null}
        {trop > 0 ? (
          <Circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke={C.lavDark} strokeWidth={ep} strokeLinecap="round" strokeDasharray={`${trop * L} ${L}`} />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

/** Petit cercle de progression du repas (à la place d'une illustration). */
function MiniAnneau({ ratio, depasse }: { ratio: number; depasse: boolean }) {
  const taille = 46, ep = 5, r = (taille - ep) / 2, L = 2 * Math.PI * r;
  const part = Math.max(0, Math.min(1, ratio));
  const trop = Math.max(0, Math.min(1, ratio - 1));
  return (
    <Svg width={taille} height={taille} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke={C.soft} strokeWidth={ep} />
      {part > 0 ? (
        <Circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke={C.lav} strokeWidth={ep} strokeLinecap={part < 1 ? 'round' : 'butt'} strokeDasharray={`${part * L} ${L}`} />
      ) : null}
      {trop > 0 ? (
        <Circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke={C.lavDark} strokeWidth={ep} strokeLinecap="round" strokeDasharray={`${trop * L} ${L}`} />
      ) : null}
    </Svg>
  );
}

/** Un repas : vide = simple ligne séparée par un trait ; avec des aliments = carte bordée. */
function Repas({
  repasKey, es, cibles, trait, ouvert, basculer,
}: { repasKey: RepasKey; es: Entree[]; cibles: Totaux; trait: boolean; ouvert: boolean; basculer: () => void }) {
  const r = repasInfo(repasKey);
  const t = somme(es);
  const plein = es.length > 0;
  const ouvrir = () => router.push({ pathname: '/repas/[repas]', params: { repas: r.key } });
  return (
    <View
      style={[
        { paddingHorizontal: 16, paddingVertical: plein ? 16 : 20, gap: 12 },
        plein ? { borderWidth: 1.5, borderColor: TRAIT, borderRadius: 26, marginVertical: 6, backgroundColor: '#fff' } : null,
        trait ? { borderTopWidth: 1.5, borderTopColor: TRAIT, marginHorizontal: 0 } : null,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir ${r.nom}`} onPress={ouvrir} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 48 }}>
          <MiniAnneau ratio={cibles.kcal ? t.kcal / cibles.kcal : 0} depasse={t.kcal > cibles.kcal} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: F.display, fontSize: 19, color: C.ink }}>{r.nom}</Text>
            <Text style={{ fontFamily: F.bodySemi, fontSize: 15, color: t.kcal > cibles.kcal ? MACRO.proteines.text : C.ink2 }}>
              {fmt(t.kcal)} / {fmt(cibles.kcal)} kcal
            </Text>
          </View>
        </Pressable>
        <Rond label={`Ajouter au ${r.nom.toLowerCase()}`} fond={C.ink} onPress={ouvrir} taille={46}>
          <Text style={{ color: '#fff', fontSize: 26, fontFamily: F.bodySemi, lineHeight: 28 }}>+</Text>
        </Rond>
      </View>

      {plein ? (
        <>
          <Pressable onPress={ouvrir} accessibilityRole="button" accessibilityLabel={`Aliments du ${r.nom.toLowerCase()}`}>
            <Text numberOfLines={2} style={{ fontFamily: F.bodySemi, fontSize: 15, color: C.ink, lineHeight: 21 }}>{regrouper(es)}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ouvert ? `Masquer les macros du ${r.nom.toLowerCase()}` : `Voir les macros du ${r.nom.toLowerCase()}`}
            onPress={basculer}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 32 }}
          >
            <Text style={{ fontFamily: F.body, fontSize: 13.5, color: C.lavText }}>{ouvert ? 'Masquer les macros' : 'Voir les macros'}</Text>
            <View style={{ transform: [{ rotate: ouvert ? '180deg' : '0deg' }] }}>
              <IcBas couleur={C.lavText} taille={16} epais={2.6} />
            </View>
          </Pressable>
          {ouvert ? <CerclesMacros t={t} cibles={cibles} taille={60} /> : null}
        </>
      ) : null}
    </View>
  );
}

/** « Weetabix original ×2 (272 kcal), Lait (56 kcal) » : un même aliment n'apparaît qu'une fois. */
function regrouper(es: Entree[]) {
  const m = new Map<string, { n: number; kcal: number }>();
  es.forEach((e) => {
    const x = m.get(e.libelle) ?? { n: 0, kcal: 0 };
    m.set(e.libelle, { n: x.n + 1, kcal: x.kcal + e.kcal });
  });
  return [...m.entries()].map(([nom, x]) => `${nom}${x.n > 1 ? ` ×${x.n}` : ''} (${fmt(x.kcal)} kcal)`).join(', ');
}
