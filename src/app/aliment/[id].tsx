import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Anneau, Bouton, Carte, Ecran, IcCrayon, IcEtoile, IcRetour, Lab, Legende, Puce, Rond, Segment, Sub, Titre, fmt, lireNombre,
} from '../../components/ui';
import {
  Aliment, ajouterEntree, ajouterPortion, basculerFavori, definirPortionFavorite, getAliment, getEntree, grammageRapide, macrosPour,
  modifierEntree, portionsDe, supprimerPortion,
} from '../../db/repo';
import { useData, useJour } from '../../lib/hooks';
import { C, F, MACRO, MACRO_KEYS, REPAS, RepasKey, repasInfo, repasParDefaut } from '../../theme';

export default function FicheAliment() {
  const p = useLocalSearchParams<{ id: string; repas?: RepasKey; entree?: string; source?: string }>();
  const jour = useJour();
  const [data] = useData(async () => {
    const [a, portions, e] = await Promise.all([getAliment(p.id), portionsDe(p.id), p.entree ? getEntree(p.entree) : null]);
    return { a, portions, e };
  }, [p.id, p.entree]);
  const a = data?.a;
  const [qte, setQte] = useState('');
  const [repas, setRepas] = useState<RepasKey>(p.repas ?? repasParDefaut());
  const [nouveau, setNouveau] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);

  // quantité de départ : celle de l'entrée modifiée, sinon le grammage favori / dernier
  useEffect(() => {
    if (!a || qte) return;
    if (data?.e?.quantite_g) {
      setQte(String(data.e.quantite_g));
      setRepas(data.e.repas);
    } else grammageRapide(a).then((r) => setQte(String(r.g)));
  }, [a, data?.e]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!a) return <Ecran><Sub>Chargement…</Sub></Ecran>;

  const g = lireNombre(qte);
  const m = macrosPour(a, g);
  const portions = data?.portions ?? [];
  const pas = g >= 100 ? 10 : 5;

  const valider = async () => {
    if (g <= 0) return;
    if (data?.e) await modifierEntree(data.e.id, a, g, repas);
    else await ajouterEntree(jour, repas, a, g);
    router.back();
  };

  const enregistrerGrammage = async () => {
    const lib = (nouveau ?? '').trim() || `${fmt(g)} g`;
    if (g <= 0) return;
    const id = await ajouterPortion(a.id, lib, g);
    if (!portions.length) await definirPortionFavorite(a.id, id); // le premier devient favori
    setNouveau(null);
  };

  return (
    <Ecran>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Rond label="Retour" onPress={() => router.back()}>
          <IcRetour couleur={C.lavText} />
        </Rond>
        <View style={{ flex: 1 }}>
          <Titre style={{ fontSize: 22 }} numberOfLines={2}>{a.nom}</Titre>
          <Sub style={{ fontFamily: F.bodyBold, color: a.source === 'off' ? C.okText : C.ink2 }}>
            {[a.marque, a.source === 'off' ? (p.source === 'scan' ? 'Scanné · Open Food Facts' : 'Open Food Facts') : a.source === 'ciqual' ? 'Table Ciqual (Anses)' : 'Mon aliment'].filter(Boolean).join(' · ')}
          </Sub>
        </View>
        {a.source === 'perso' ? (
          <Rond label="Modifier l'aliment" onPress={() => router.push({ pathname: '/creer', params: { id: a.id } })}>
            <IcCrayon couleur={C.lavText} taille={19} />
          </Rond>
        ) : null}
        <Rond label={a.favori ? 'Retirer des favoris' : 'Ajouter aux favoris'} fond={a.favori ? C.peachSoft : '#fff'} onPress={() => basculerFavori(a)}>
          <IcEtoile couleur={C.peachText} taille={20} epais={2.2} />
        </Rond>
      </View>

      <Carte style={{ gap: 12 }}>
        <Lab>Quantité</Lab>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Rond label={`Moins ${pas} g`} fond={C.lavSoft} taille={48} onPress={() => setQte(String(Math.max(0, g - pas)))}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 22, color: C.lavText }}>−</Text>
          </Rond>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.soft, borderRadius: 999, minHeight: 52, paddingHorizontal: 18 }}>
            <TextInput
              accessibilityLabel="Quantité en grammes"
              value={qte}
              onChangeText={(t) => setQte(t.replace(/[^0-9.,]/g, ''))}
              keyboardType="decimal-pad"
              selectTextOnFocus
              style={{ flex: 1, fontFamily: F.display, fontSize: 26, color: C.ink, paddingVertical: 0 }}
            />
            <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.ink2 }}>g</Text>
          </View>
          <Rond label={`Plus ${pas} g`} fond={C.lavSoft} taille={48} onPress={() => setQte(String(g + pas))}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 22, color: C.lavText }}>+</Text>
          </Rond>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {portions.map((pt) => (
            <Puce
              key={pt.id}
              titre={`${pt.favori ? '★ ' : ''}${pt.libelle} · ${fmt(pt.grammes)} g`}
              actif={g === pt.grammes}
              onPress={() => setQte(String(pt.grammes))}
              onLongPress={() => setMenu(pt.id)}
            />
          ))}
          {a.portion_produit_g ? (
            <Puce titre={`${a.portion_produit_lib || 'Portion'} · ${fmt(a.portion_produit_g)} g`} actif={g === a.portion_produit_g && !portions.some((x) => x.grammes === g)} onPress={() => setQte(String(a.portion_produit_g))} />
          ) : null}
          <Puce titre="100 g" actif={g === 100 && !portions.some((x) => x.grammes === 100)} onPress={() => setQte('100')} />
          {nouveau === null ? (
            <Pressable accessibilityRole="button" onPress={() => setNouveau('')} style={{ minHeight: 38, borderRadius: 999, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 2, borderColor: C.lavSoft }}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.lavText }}>+ Enregistrer ce grammage</Text>
            </Pressable>
          ) : null}
        </View>
        {menu ? (() => {
          const pt = portions.find((x) => x.id === menu);
          if (!pt) return null;
          return (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', backgroundColor: C.soft, borderRadius: 20, padding: 8 }}>
              <Sub style={{ fontFamily: F.bodyBold, paddingHorizontal: 6 }}>{pt.libelle} :</Sub>
              <Puce titre={pt.favori ? 'Retirer le favori' : '★ Mettre en favori'} onPress={() => { definirPortionFavorite(a.id, pt.favori ? null : pt.id); setMenu(null); }} />
              <Puce titre="Supprimer" onPress={() => { supprimerPortion(pt.id); setMenu(null); }} />
              <Puce titre="Fermer" onPress={() => setMenu(null)} />
            </View>
          );
        })() : null}
        {nouveau !== null ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput
              autoFocus
              value={nouveau}
              onChangeText={setNouveau}
              placeholder={`Nom, ex. Mon bol (${fmt(g)} g)`}
              placeholderTextColor="#9A94B0"
              accessibilityLabel="Nom du grammage"
              style={{ flex: 1, backgroundColor: C.soft, borderRadius: 999, minHeight: 44, paddingHorizontal: 14, fontFamily: F.body, color: C.ink }}
            />
            <Bouton petit titre="OK" onPress={enregistrerGrammage} />
          </View>
        ) : (
          <Sub style={{ fontSize: 12 }}>Appui long sur un grammage enregistré pour le mettre en favori : le « + » rapide l’utilisera.</Sub>
        )}
      </Carte>

      <Carte>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <Anneau t={m} taille={120} centre={fmt(m.kcal)} sousCentre="kcal" />
          <Legende t={m} />
        </View>
        <View style={{ borderTopWidth: 1.5, borderTopColor: 'rgba(141,123,240,0.15)', paddingTop: 10, gap: 6 }}>
          <Lab>Pour 100 g</Lab>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>{fmt(a.kcal_100g)}</Text>
              <Sub style={{ fontSize: 12 }}>kcal</Sub>
            </View>
            {MACRO_KEYS.map((k) => (
              <View key={k} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: MACRO[k].text }}>{fmt(a[`${k}_100g` as keyof Aliment] as number, 1)}</Text>
                <Sub style={{ fontSize: 12 }}>{MACRO[k].nom.slice(0, 5)}.</Sub>
              </View>
            ))}
          </View>
        </View>
      </Carte>

      <View style={{ gap: 6 }}>
        <Lab style={{ paddingLeft: 4 }}>Repas</Lab>
        <Segment options={REPAS.map((r) => ({ k: r.key, t: r.court }))} valeur={repas} onChange={setRepas} />
      </View>

      <Bouton
        titre={data?.e ? 'Enregistrer la modification' : `Ajouter au ${repasInfo(repas).nom.toLowerCase()}`}
        onPress={valider}
        disabled={g <= 0}
      />
    </Ecran>
  );
}
