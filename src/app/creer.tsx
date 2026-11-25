import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Bouton, Carte, Champ, ChampNombre, Ecran, IcRetour, Lab, Rond, Segment, Sub, T, Titre, lireNombre } from '../components/ui';
import { creerAlimentPerso, getAliment, modifierAliment } from '../db/repo';
import { C, F, MACRO, MACRO_KEYS, MacroKey, RepasKey } from '../theme';

type Vals = Record<'kcal' | MacroKey, string>;

export default function Creer() {
  const p = useLocalSearchParams<{ id?: string; code?: string; nom?: string; marque?: string; repas?: RepasKey }>();
  const [nom, setNom] = useState(p.nom ?? '');
  const [marque, setMarque] = useState(p.marque ?? '');
  const [code, setCode] = useState(p.code ?? '');
  const [base, setBase] = useState<'100' | 'portion'>('100');
  const [portionG, setPortionG] = useState('');
  const [portionLib, setPortionLib] = useState('');
  const [v, setV] = useState<Vals>({ kcal: '', proteines: '', glucides: '', lipides: '', fibres: '' });

  useEffect(() => {
    if (!p.id) return;
    getAliment(p.id).then((a) => {
      if (!a) return;
      setNom(a.nom);
      setMarque(a.marque ?? '');
      setCode(a.code_barres ?? '');
      setPortionG(a.portion_produit_g ? String(a.portion_produit_g) : '');
      setPortionLib(a.portion_produit_lib ?? '');
      setV({
        kcal: String(a.kcal_100g), proteines: String(a.proteines_100g), glucides: String(a.glucides_100g),
        lipides: String(a.lipides_100g), fibres: String(a.fibres_100g),
      });
    });
  }, [p.id]);

  const pg = lireNombre(portionG);
  const facteur = base === 'portion' && pg > 0 ? 100 / pg : 1;
  const ok = nom.trim() && v.kcal !== '' && (base === '100' || pg > 0);

  const enregistrer = async () => {
    if (!ok) return;
    const r1 = (n: number) => Math.round(n * 10) / 10;
    const data = {
      nom: nom.trim(),
      marque: marque.trim() || null,
      code_barres: code.trim() || null,
      kcal_100g: Math.round(lireNombre(v.kcal) * facteur),
      proteines_100g: r1(lireNombre(v.proteines) * facteur),
      glucides_100g: r1(lireNombre(v.glucides) * facteur),
      lipides_100g: r1(lireNombre(v.lipides) * facteur),
      fibres_100g: r1(lireNombre(v.fibres) * facteur),
      portion_produit_g: pg > 0 ? pg : null,
      portion_produit_lib: pg > 0 ? portionLib.trim() || 'Portion' : null,
    };
    if (p.id) {
      await modifierAliment(p.id, data);
      router.back();
    } else {
      const a = await creerAlimentPerso(data);
      router.replace({ pathname: '/aliment/[id]', params: { id: a.id, repas: p.repas } });
    }
  };

  return (
    <Ecran>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Rond label="Retour" onPress={() => router.back()}>
          <IcRetour couleur={C.lavText} />
        </Rond>
        <Titre style={{ flex: 1 }}>{p.id ? 'Modifier l’aliment' : 'Créer un aliment'}</Titre>
      </View>
      {p.code && !p.id ? (
        <View style={{ backgroundColor: C.warnBg, borderRadius: 20, padding: 12 }}>
          <T style={{ color: C.warnText, fontFamily: F.bodyBold, fontSize: 13.5 }}>
            {p.nom ? 'Produit trouvé sans valeurs nutritionnelles.' : 'Produit introuvable sur Open Food Facts.'} Recopie l’étiquette : le prochain scan de ce code le retrouvera directement.
          </T>
        </View>
      ) : null}

      <Carte style={{ gap: 12 }}>
        <Champ label="Nom" value={nom} onChangeText={setNom} placeholder="Ex. Granola maison" />
        <Champ label="Marque (facultatif)" value={marque} onChangeText={setMarque} />
        <Champ label="Code-barres (facultatif)" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ''))} keyboardType="number-pad" />
      </Carte>

      <Carte style={{ gap: 12 }}>
        <Lab>Valeurs indiquées pour</Lab>
        <Segment options={[{ k: '100', t: '100 g' }, { k: 'portion', t: 'Une portion' }]} valeur={base} onChange={setBase} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Champ label="Portion (facultatif)" value={portionLib} onChangeText={setPortionLib} placeholder="Ex. 1 barre" />
          </View>
          <View style={{ paddingTop: 22 }}>
            <ChampNombre label="Poids de la portion" valeur={portionG} onChange={setPortionG} unite="g" />
          </View>
        </View>
        {base === 'portion' && !(pg > 0) ? <Sub style={{ color: C.errText }}>Indique le poids de la portion.</Sub> : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 }}>
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

      <Bouton titre={p.id ? 'Enregistrer' : 'Créer et choisir la quantité'} onPress={enregistrer} disabled={!ok} />
    </Ecran>
  );
}
