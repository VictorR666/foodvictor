import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Bouton, Carte, Champ, ChampNombre, Ecran, IcRetour, Lab, Rond, Segment, Sub, T, Titre, lireNombre } from '../components/ui';
import { ajouterSaisieRapide } from '../db/repo';
import { useJour } from '../lib/hooks';
import { C, F, MACRO, MACRO_KEYS, MacroKey, REPAS, RepasKey, repasParDefaut } from '../theme';

/** Saisie rapide : des kcal (et éventuellement des macros) sans aliment, ex. un repas au resto. */
export default function Rapide() {
  const p = useLocalSearchParams<{ repas?: RepasKey }>();
  const jour = useJour();
  const [repas, setRepas] = useState<RepasKey>(p.repas ?? repasParDefaut());
  const [libelle, setLibelle] = useState('');
  const [v, setV] = useState<Record<'kcal' | MacroKey, string>>({ kcal: '', proteines: '', glucides: '', lipides: '', fibres: '' });
  const kcal = lireNombre(v.kcal);

  const ajouter = async () => {
    await ajouterSaisieRapide(jour, repas, libelle.trim(), {
      kcal: Math.round(kcal),
      proteines: lireNombre(v.proteines),
      glucides: lireNombre(v.glucides),
      lipides: lireNombre(v.lipides),
      fibres: lireNombre(v.fibres),
    });
    router.back();
  };

  return (
    <Ecran>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Rond label="Retour" onPress={() => router.back()}>
          <IcRetour couleur={C.lavText} />
        </Rond>
        <Titre style={{ flex: 1 }}>Saisie rapide</Titre>
      </View>
      <Sub>Pour un repas dont tu ne connais que les calories (resto, plat préparé…). Les macros sont facultatives.</Sub>
      <Carte style={{ gap: 12 }}>
        <Champ label="Nom (facultatif)" value={libelle} onChangeText={setLibelle} placeholder="Ex. Resto midi" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <T style={{ flex: 1, fontFamily: F.bodyBold }}>Énergie</T>
          <ChampNombre label="Kilocalories" valeur={v.kcal} onChange={(t) => setV({ ...v, kcal: t })} unite="kcal" />
        </View>
        {MACRO_KEYS.map((k) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: MACRO[k].text, alignItems: 'center', justifyContent: 'center' }}>
              <T style={{ color: '#fff', fontFamily: F.bodyBold }}>{MACRO[k].lettre}</T>
            </View>
            <T style={{ flex: 1, fontFamily: F.bodyBold }}>{MACRO[k].nom}</T>
            <ChampNombre label={MACRO[k].nom} valeur={v[k]} onChange={(t) => setV({ ...v, [k]: t })} unite="g" />
          </View>
        ))}
      </Carte>
      <View style={{ gap: 6 }}>
        <Lab style={{ paddingLeft: 4 }}>Repas</Lab>
        <Segment options={REPAS.map((r) => ({ k: r.key, t: r.court }))} valeur={repas} onChange={setRepas} />
      </View>
      <Bouton titre="Ajouter" onPress={ajouter} disabled={kcal <= 0} />
    </Ecran>
  );
}
