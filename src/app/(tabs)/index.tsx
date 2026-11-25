import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  Carte, Ecran, IcCheck, IcRepas, IcSync, Jauge, Rond, Sub, T, Titre, fmt, s as ui,
} from '../../components/ui';
import { entreesDuJour, getObjectifs, objectifRepasKcal, somme } from '../../db/repo';
import { LETTRE_JOUR, isoDate, parseIso, semaine, titreJour, libelleJour, addDays } from '../../lib/date';
import { setJour, useData, useJour } from '../../lib/hooks';
import { surEtatSync, EtatSync } from '../../lib/sync';
import { useEffect, useState } from 'react';
import { C, F, MACRO, MACRO_KEYS, REPAS, shadow } from '../../theme';

export default function Journal() {
  const jour = useJour();
  const [data] = useData(async () => {
    const [entrees, obj] = await Promise.all([entreesDuJour(jour), getObjectifs(jour)]);
    return { entrees, obj };
  }, [jour]);
  const [sync, setSync] = useState<EtatSync>();
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
            const pct = cible ? Math.min(1, total[k] / cible) : 0;
            return (
              <View key={k} style={{ flex: 1, gap: 4 }}>
                <Text numberOfLines={1} style={{ fontFamily: F.bodyBold, fontSize: 12, color: MACRO[k].text }}>{MACRO[k].nom}</Text>
                <View style={{ height: 6, borderRadius: 999, backgroundColor: MACRO[k].bg, overflow: 'hidden' }}>
                  <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: MACRO[k].fill, borderRadius: 999 }} />
                </View>
                <Text style={{ fontFamily: F.body, fontSize: 12, color: C.ink2 }}>
                  <Text style={{ color: C.ink, fontFamily: F.bodyBold }}>{fmt(total[k])}</Text> / {fmt(cible)} g
                </Text>
              </View>
            );
          })}
        </View>
      </Carte>

      {/* Repas */}
      {REPAS.map((r) => {
        const es = entrees.filter((e) => e.repas === r.key);
        const t = somme(es);
        const cible = obj ? objectifRepasKcal(obj, r.key) : 0;
        const Icone = IcRepas[r.key];
        const noms = es.map((e) => e.libelle).join(', ');
        return (
          <View key={r.key} style={[ui.carte, { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingLeft: 14 }]}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: r.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Icone couleur={r.fg} taille={22} epais={2.2} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${r.nom}, ${Math.round(t.kcal)} sur ${cible} kcal`}
              onPress={() => router.push({ pathname: '/repas/[repas]', params: { repas: r.key } })}
              style={{ flex: 1, minHeight: 44, justifyContent: 'center', gap: 1 }}
            >
              <T style={{ fontFamily: F.bodyBold, fontSize: 15.5 }}>{r.nom}</T>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: t.kcal > cible ? MACRO.proteines.text : C.lavText }}>
                {fmt(t.kcal)} <Text style={{ fontFamily: F.body, color: C.ink2 }}>/ {fmt(cible)} kcal</Text>
              </Text>
              {es.length ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {MACRO_KEYS.map((k) => (
                    <Text key={k} style={{ fontFamily: F.bodyBold, fontSize: 11.5, color: MACRO[k].text }}>
                      {MACRO[k].lettre} {fmt(t[k])}
                    </Text>
                  ))}
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.body, fontSize: 11.5, color: C.ink2 }}>· {noms}</Text>
                </View>
              ) : null}
            </Pressable>
            <Rond
              label={`Ajouter au ${r.nom.toLowerCase()}`}
              fond={C.lavText}
              onPress={() => router.push({ pathname: '/ajout', params: { repas: r.key } })}
              style={{ ...shadow, shadowColor: C.lavText, shadowOpacity: 0.3 }}
            >
              <Text style={{ color: '#fff', fontSize: 24, fontFamily: F.bodyBold, lineHeight: 26 }}>+</Text>
            </Rond>
          </View>
        );
      })}
    </Ecran>
  );
}
