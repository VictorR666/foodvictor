import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  BarreDepassement, Carte, Ecran, IcBas, IcCheck, IcRepas, IcSync, Jauge, Rond, Sub, T, Titre, fmt, s as ui,
} from '../../components/ui';
import { Entree, Totaux, ZERO, ciblesRepas, entreesDuJour, getObjectifs, somme } from '../../db/repo';
import { CerclesMacros } from '../../components/CerclesMacros';
import { LETTRE_JOUR, isoDate, parseIso, semaine, titreJour, libelleJour, addDays } from '../../lib/date';
import { setJour, useData, useJour } from '../../lib/hooks';
import { surEtatSync, EtatSync } from '../../lib/sync';
import { useEffect, useState } from 'react';
import { C, F, MACRO, MACRO_KEYS, REPAS, RepasKey, auRepas, duRepas, repasInfo, shadow } from '../../theme';

export default function Journal() {
  const jour = useJour();
  const [data] = useData(async () => {
    const [entrees, obj] = await Promise.all([entreesDuJour(jour), getObjectifs(jour)]);
    return { entrees, obj };
  }, [jour]);
  const [sync, setSync] = useState<EtatSync>();
  const [ouverts, setOuverts] = useState<Partial<Record<RepasKey, boolean>>>({});
  useEffect(() => surEtatSync(setSync), []);

  const entrees = data?.entrees ?? [];
  const obj = data?.obj;
  const total = somme(entrees);
  const restant = (obj?.kcal ?? 0) - total.kcal;
  const jours = semaine(jour);
  const today = isoDate();

  const pastille =
    sync?.etat === 'erreur'
      ? { bg: C.errBg, fg: C.errText, label: 'Sauvegarde en erreur' }
      : sync?.etat === 'non_configure'
        ? { bg: C.warnBg, fg: C.warnText, label: 'Sauvegarde Google Sheets non configurée' }
        : sync?.enAttente
          ? { bg: C.lavSoft, fg: C.lavText, label: `${sync.enAttente} changement(s) en attente de sauvegarde` }
          : { bg: C.okBg, fg: C.okText, label: 'Tout est sauvegardé' };

  return (
    <Ecran bas={90}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
        <View style={{ flex: 1 }}>
          <Sub style={{ fontFamily: F.bodyBold }}>{libelleJour(jour)}</Sub>
          <Titre>{titreJour(jour)}</Titre>
        </View>
        <Rond label={pastille.label} fond={pastille.bg} onPress={() => router.navigate('/sauvegarde')}>
          {sync?.etat === 'ok' && !sync.enAttente ? <IcCheck couleur={pastille.fg} /> : <IcSync couleur={pastille.fg} taille={19} />}
        </Rond>
      </View>

      {/* Semaine */}
      <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
        <Pressable accessibilityLabel="Semaine précédente" onPress={() => setJour(addDays(jour, -7))} style={{ width: 24, alignItems: 'center', minHeight: 52, justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.bodyBold, color: C.ink2, fontSize: 18 }}>‹</Text>
        </Pressable>
        {jours.map((d) => {
          const on = d === jour;
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityLabel={libelleJour(d)}
              accessibilityState={{ selected: on }}
              onPress={() => setJour(d)}
              style={{
                flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6, borderRadius: 18, minHeight: 52,
                backgroundColor: on ? C.lavText : 'transparent', borderWidth: d === today && !on ? 1.5 : 0, borderColor: C.lav,
              }}
            >
              <Text style={{ fontFamily: F.bodyBold, fontSize: 11, color: on ? '#fff' : C.ink2 }}>{LETTRE_JOUR[parseIso(d).getDay()]}</Text>
              <Text style={{ fontFamily: F.display, fontSize: 16, color: on ? '#fff' : C.ink }}>{parseIso(d).getDate()}</Text>
            </Pressable>
          );
        })}
        <Pressable accessibilityLabel="Semaine suivante" onPress={() => setJour(addDays(jour, 7))} style={{ width: 24, alignItems: 'center', minHeight: 52, justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.bodyBold, color: C.ink2, fontSize: 18 }}>›</Text>
        </Pressable>
      </View>

      {/* Résumé du jour */}
      <Carte style={{ gap: 14, paddingBottom: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ width: 74, alignItems: 'center', paddingBottom: 6 }}>
            <Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink }}>{fmt(total.kcal)}</Text>
            <Sub style={{ fontFamily: F.bodyBold, fontSize: 12 }}>Mangé</Sub>
          </View>
          <View style={{ width: 180, height: 104, alignItems: 'center' }}>
            <Jauge ratio={obj ? total.kcal / obj.kcal : 0} depasse={restant < 0} />
            <View style={{ position: 'absolute', bottom: 4, alignItems: 'center' }}>
              <Text style={{ fontFamily: F.display, fontSize: 32, color: restant < 0 ? MACRO.proteines.text : C.ink, lineHeight: 34 }}>
                {fmt(Math.abs(restant))}
              </Text>
              <Sub style={{ fontFamily: F.bodyBold, fontSize: 12 }}>{restant < 0 ? 'kcal en trop' : 'kcal restantes'}</Sub>
            </View>
          </View>
          <View style={{ width: 74, alignItems: 'center', paddingBottom: 6 }}>
            <Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink }}>{fmt(obj?.kcal ?? 0)}</Text>
            <Sub style={{ fontFamily: F.bodyBold, fontSize: 12 }}>Objectif</Sub>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {MACRO_KEYS.map((k) => {
            const cible = obj ? { proteines: obj.proteines_g, glucides: obj.glucides_g, lipides: obj.lipides_g, fibres: obj.fibres_g }[k] : 0;
            return (
              <View key={k} style={{ flex: 1, gap: 4 }}>
                <Text numberOfLines={1} style={{ fontFamily: F.bodyBold, fontSize: 12, color: MACRO[k].text }}>{MACRO[k].nom}</Text>
                <BarreDepassement ratio={cible ? total[k] / cible : 0} couleur={MACRO[k].fill} fonce={MACRO[k].fonce} fond={MACRO[k].bg} hauteur={6} />
                <Text style={{ fontFamily: F.body, fontSize: 12, color: C.ink2 }}>
                  <Text style={{ color: C.ink, fontFamily: F.bodyBold }}>{fmt(total[k])}</Text> / {fmt(cible)} g
                </Text>
              </View>
            );
          })}
        </View>
      </Carte>

      {/* Repas */}
      {REPAS.map((r) => (
        <CarteRepas
          key={r.key}
          repasKey={r.key}
          es={entrees.filter((e) => e.repas === r.key)}
          cibles={obj ? ciblesRepas(obj, r.key) : ZERO}
          ouvert={!!ouverts[r.key]}
          basculer={() => setOuverts((o) => ({ ...o, [r.key]: !o[r.key] }))}
        />
      ))}
    </Ecran>
  );
}

/** Carte d'un repas : kcal, aliments, et les cercles de macros dépliables avec la flèche. */
function CarteRepas({
  repasKey, es, cibles, ouvert, basculer,
}: { repasKey: RepasKey; es: Entree[]; cibles: Totaux; ouvert: boolean; basculer: () => void }) {
  const r = repasInfo(repasKey);
  const t = somme(es);
  const Icone = IcRepas[r.key];
  const ouvrir = () => router.push({ pathname: '/repas/[repas]', params: { repas: r.key } });
  return (
    <View style={[ui.carte, { padding: 12, paddingLeft: 14, gap: 10 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir ${r.nom}`} onPress={ouvrir} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: r.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Icone couleur={r.fg} taille={22} epais={2.2} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <T style={{ fontFamily: F.bodyBold, fontSize: 15.5 }}>{r.nom}</T>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: t.kcal > cibles.kcal ? MACRO.proteines.text : C.lavText }}>
              {fmt(t.kcal)} <Text style={{ fontFamily: F.body, color: C.ink2 }}>/ {fmt(cibles.kcal)} kcal</Text>
            </Text>
          </View>
        </Pressable>
        <Rond label={ouvert ? `Masquer les macros ${duRepas(r.key)}` : `Voir les macros ${duRepas(r.key)}`} fond="transparent" onPress={basculer} taille={40}>
          <View style={{ transform: [{ rotate: ouvert ? '180deg' : '0deg' }] }}>
            <IcBas couleur={C.ink2} taille={20} epais={2.6} />
          </View>
        </Rond>
        <Rond
          label={`Ajouter ${auRepas(r.key)}`}
          fond={C.ink}
          onPress={ouvrir}
          style={{ ...shadow, shadowColor: C.ink, shadowOpacity: 0.25 }}
        >
          <Text style={{ color: '#fff', fontSize: 24, fontFamily: F.bodyBold, lineHeight: 26 }}>+</Text>
        </Rond>
      </View>
      {es.length ? (
        <Pressable onPress={ouvrir} accessibilityRole="button" accessibilityLabel={`Aliments ${duRepas(r.key)}`}>
          <Text numberOfLines={2} style={{ fontFamily: F.body, fontSize: 13.5, color: C.ink }}>
            {regrouper(es)}
          </Text>
        </Pressable>
      ) : null}
      {ouvert ? (
        <View style={{ borderTopWidth: 1.5, borderTopColor: '#F0EDFA', paddingTop: 12 }}>
          <CerclesMacros t={t} cibles={cibles} taille={60} />
        </View>
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
