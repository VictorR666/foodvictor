import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Carte, Ecran, LigneMacros, Progression, Segment, Sub, T, Titre, fmt, s as ui } from '../../components/ui';
import { getObjectifs, somme, totauxParJour } from '../../db/repo';
import { addDays, isoDate, libelleJour } from '../../lib/date';
import { setJour, useData } from '../../lib/hooks';
import { C, F, MACRO, MACRO_KEYS } from '../../theme';

/** Historique simple : moyennes et liste des derniers jours. */
export default function Progres() {
  const [periode, setPeriode] = useState<'7' | '30'>('7');
  const n = Number(periode);
  const [data] = useData(async () => {
    const depuis = addDays(isoDate(), -(n - 1));
    const jours = await totauxParJour(depuis);
    const objs = await Promise.all(jours.map((j) => getObjectifs(j.date)));
    return jours.map((j, i) => ({ ...j, obj: objs[i] }));
  }, [n]);
  const jours = data ?? [];
  const moy = somme(jours);
  const nj = jours.length || 1;
  const dansObjectif = jours.filter((j) => Math.abs(j.kcal - j.obj.kcal) <= j.obj.kcal * 0.1).length;

  return (
    <Ecran bas={90}>
      <View style={{ paddingHorizontal: 4 }}>
        <Sub style={{ fontFamily: F.bodyBold }}>Moyennes sur les jours remplis</Sub>
        <Titre style={{ fontSize: 30 }}>Progrès</Titre>
      </View>
      <Segment options={[{ k: '7', t: '7 jours' }, { k: '30', t: '30 jours' }]} valeur={periode} onChange={setPeriode} />

      <Carte>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ fontFamily: F.display, fontSize: 32, color: C.ink }}>{fmt(moy.kcal / nj)}</Text>
          <Sub style={{ fontFamily: F.bodyBold }}>kcal / jour en moyenne</Sub>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {MACRO_KEYS.map((k) => (
            <View key={k} style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: MACRO[k].text }}>{MACRO[k].nom}</Text>
              <T style={{ fontFamily: F.bodyBold }}>{fmt(moy[k] / nj)} g</T>
            </View>
          ))}
        </View>
        <Sub>
          {jours.length} jour{jours.length > 1 ? 's' : ''} rempli{jours.length > 1 ? 's' : ''} · {dansObjectif} à ±10 % de l’objectif kcal
        </Sub>
      </Carte>

      <Carte style={{ gap: 6 }}>
        {jours.length ? null : <Sub style={{ textAlign: 'center', padding: 12 }}>Rien sur cette période.</Sub>}
        {jours.map((j) => (
          <Pressable
            key={j.date}
            accessibilityRole="button"
            onPress={() => {
              setJour(j.date);
              router.navigate('/');
            }}
            style={[ui.ligne, { flexDirection: 'column', alignItems: 'stretch', gap: 5, paddingVertical: 10, paddingRight: 14 }]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T style={{ fontFamily: F.bodyBold }}>{libelleJour(j.date)}</T>
              <Text style={{ fontFamily: F.bodyBold, color: j.kcal > j.obj.kcal * 1.1 ? MACRO.proteines.text : C.lavText }}>
                {fmt(j.kcal)} / {fmt(j.obj.kcal)} kcal
              </Text>
            </View>
            <Progression ratio={j.kcal / j.obj.kcal} degrade fond="#fff" />
            <LigneMacros t={j} unite=" g" />
          </Pressable>
        ))}
      </Carte>
    </Ecran>
  );
}
