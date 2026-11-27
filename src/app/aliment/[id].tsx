import { useEffect, useState } from 'react';
import { EnTetePhoto } from '../../components/Visuel';
import { produitParCode } from '../../lib/off';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Anneau, Bouton, Carte, Ecran, IcBas, IcCrayon, IcEtoile, IcPoubelle, IcRetour, Lab, Legende, Puce, Rond, Segment, Sub, Titre, fmt, lireNombre,
} from '../../components/ui';
import {
  Aliment, Portion, ajouterEntree, ajouterPortion, basculerFavori, definirPortionFavorite, getAliment, getEntree, grammageRapide, macrosPour,
  definirImage, modifierEntree, portionsDe, supprimerPortion,
} from '../../db/repo';
import { useData, useJour } from '../../lib/hooks';
import { C, F, MACRO, MACRO_KEYS, REPAS, RepasKey, auRepas, repasParDefaut, shadow } from '../../theme';

type Unite = { cle: string; lib: string; g: number };
/** Unités possibles pour compter en portions : tes grammages enregistrés (favori d'abord) puis la portion du produit. */
function unitesDe(a: Aliment, portions: Portion[]): Unite[] {
  const u = [...portions]
    .sort((x, y) => y.favori - x.favori)
    .map((pt) => ({ cle: pt.id, lib: pt.libelle, g: pt.grammes }));
  if (a.portion_produit_g) u.push({ cle: 'produit', lib: a.portion_produit_lib || 'Portion', g: a.portion_produit_g });
  return u.filter((x) => x.g > 0);
}
/** « 1 bouteille (250 g) » garde son libellé, « Bol » devient « Bol (40 g) ». */
const nomUnite = (u: Unite) => (/\d\s*(g|ml|cl)\b/i.test(u.lib) ? u.lib : `${u.lib} (${fmt(u.g)} g)`);
/** Dans le champ : « × bouteille » (le détail en grammes est juste en dessous). */
const courtUnite = (u: Unite) => u.lib.replace(/\s*\(.*\)\s*$/, '').replace(/^1\s+/, '').trim() || 'portion';
/** Libellé dans le sélecteur : « bouteille (250 g) », « Mon bol (40 g) ». */
const libUnite = (u: Unite) => `${courtUnite(u)} (${fmt(u.g)} g)`;
const arrondi = (n: number) => Math.round(n * 100) / 100;

const HAUT = 260; // hauteur de l'image d'en-tête
const dejaCherche = new Set<string>(); // une seule tentative de photo par produit et par session

export default function FicheAliment() {
  const p = useLocalSearchParams<{ id: string; repas?: RepasKey; entree?: string; source?: string }>();
  const jour = useJour();
  const [data] = useData(async () => {
    const [a, portions, e] = await Promise.all([getAliment(p.id), portionsDe(p.id), p.entree ? getEntree(p.entree) : null]);
    return { a, portions, e };
  }, [p.id, p.entree]);
  const a = data?.a;
  const [qte, setQte] = useState(''); // en grammes
  const [unite, setUnite] = useState<string | null>(null); // compter en portions (null = en grammes)
  const [nb, setNb] = useState('1');
  const [pret, setPret] = useState(false);
  const [repas, setRepas] = useState<RepasKey>(p.repas ?? repasParDefaut());
  const [nouveau, setNouveau] = useState<string | null>(null);
  const [deroule, setDeroule] = useState(false); // menu des unités ouvert
  const [photoKo, setPhotoKo] = useState(false); // photo qui ne charge pas (hors ligne…) : en-tête pastel

  // quantité de départ : celle de l'entrée modifiée, sinon le grammage favori / dernier
  useEffect(() => {
    if (!a || !data || pret) return;
    setPret(true);
    const depart = (q: number) => {
      setQte(String(q));
      // Si la quantité tombe juste en portions (2 bouteilles, 1,5 bol…), on l'affiche ainsi.
      const u = unitesDe(a, data.portions).find((x) => Math.abs((q / x.g) * 2 - Math.round((q / x.g) * 2)) < 0.01 && q >= x.g / 2);
      if (u) {
        setUnite(u.cle);
        setNb(String(arrondi(q / u.g)));
      }
    };
    if (data.e?.quantite_g) {
      depart(data.e.quantite_g);
      setRepas(data.e.repas);
    } else grammageRapide(a).then((r) => depart(r.g));
  }, [a, data?.e]); // eslint-disable-line react-hooks/exhaustive-deps

  // Produit scanné avant l'arrivée des photos : on va la chercher une seule fois (un appel OFF, pas plus).
  useEffect(() => {
    if (!a || a.source !== 'off' || !a.code_barres || a.image_url != null || dejaCherche.has(a.id)) return;
    dejaCherche.add(a.id);
    produitParCode(a.code_barres)
      .then((d) => definirImage(a.id, d.image_url ?? ''))
      .catch(() => {});
  }, [a]);

  if (!a) return <Ecran><Sub>Chargement…</Sub></Ecran>;

  const unites = unitesDe(a, data?.portions ?? []);
  const u = unites.find((x) => x.cle === unite) ?? null;
  const g = u ? arrondi(lireNombre(nb) * u.g) : lireNombre(qte);
  const n = lireNombre(nb);
  const choisirUnite = (x: Unite | null) => {
    if (x) {
      setUnite(x.cle);
      setNb(u?.cle === x.cle ? nb : '1');
    } else {
      setUnite(null);
      setQte(String(Math.round(g)));
    }
  };
  const m = macrosPour(a, g);
  const portions = data?.portions ?? [];
  const pas = g >= 100 ? 10 : 5;
  const surPhoto = !!a.image_url && !photoKo;

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
    <View style={{ flex: 1, backgroundColor: C.bg }}>
    <Ecran style={{ padding: 0, gap: 0 }} bas={84}>
      <EnTetePhoto a={a} hauteur={HAUT} sansPhoto={photoKo} onErreur={() => setPhotoKo(true)} />
      <View style={{ height: HAUT - 26, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Rond label="Retour" fond={surPhoto ? 'rgba(255,255,255,0.92)' : '#fff'} onPress={() => router.back()}>
            <IcRetour couleur={C.lavText} />
          </Rond>
          <View style={{ flex: 1 }} />
          {a.source === 'perso' ? (
            <Rond label="Modifier l'aliment" onPress={() => router.push({ pathname: '/creer', params: { id: a.id } })}>
              <IcCrayon couleur={C.lavText} taille={19} />
            </Rond>
          ) : null}
          <Rond label={a.favori ? 'Retirer des favoris' : 'Ajouter aux favoris'} fond={a.favori ? C.peachSoft : '#fff'} onPress={() => basculerFavori(a)}>
            <IcEtoile couleur={C.peachText} taille={20} epais={2.2} />
          </Rond>
        </View>
        <View style={{ gap: 2, paddingRight: surPhoto ? 0 : 110 }}>
          <Titre
            style={[{ fontSize: 26, lineHeight: 30 }, surPhoto && { color: '#fff', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 8 }]}
            numberOfLines={3}
          >
            {a.nom}
          </Titre>
          <Text
            style={{ fontFamily: F.bodyBold, fontSize: 13, letterSpacing: 0.3, color: surPhoto ? 'rgba(255,255,255,0.92)' : C.ink2 }}
            numberOfLines={1}
          >
            {[a.marque?.toUpperCase(), a.source === 'off' ? (p.source === 'scan' ? 'Scanné · Open Food Facts' : 'Open Food Facts') : a.source === 'ciqual' ? 'Table Ciqual (Anses)' : 'Mon aliment'].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: -26, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, paddingTop: 20, gap: 12 }}>
      {/* Quantité façon Foodvisor : [nombre | unité ▾], le menu liste toutes les unités */}
      <Carte style={{ gap: 8, zIndex: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'stretch', backgroundColor: C.soft, borderRadius: 999, minHeight: 54, borderWidth: 2, borderColor: deroule ? C.lav : '#E4DEFA' }}>
          <TextInput
            accessibilityLabel={u ? 'Nombre de portions' : 'Quantité en grammes'}
            value={u ? nb : qte}
            onChangeText={(t) => (u ? setNb : setQte)(t.replace(/[^0-9.,]/g, ''))}
            keyboardType="decimal-pad"
            selectTextOnFocus
            style={{ width: 92, textAlign: 'center', fontFamily: F.display, fontSize: 22, color: C.ink, paddingVertical: 0, borderRightWidth: 2, borderRightColor: '#E4DEFA' }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Unité : ${u ? libUnite(u) : 'grammes'}. Changer`}
            onPress={() => setDeroule((d) => !d)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 14, gap: 8 }}
          >
            <Text style={{ flex: 1, fontFamily: F.bodyBold, fontSize: 16, color: C.ink }} numberOfLines={1}>
              {u ? libUnite(u) : 'g'}
            </Text>
            <View style={{ transform: [{ rotate: deroule ? '180deg' : '0deg' }] }}>
              <IcBas couleur={C.ink2} taille={20} epais={2.4} />
            </View>
          </Pressable>
        </View>
        {u && n !== 1 ? <Sub style={{ paddingLeft: 20, marginTop: -2 }}>Soit {fmt(g, 1)} g</Sub> : null}

        {deroule ? (
          <View
            style={{
              position: 'absolute', left: 16, right: 16, top: 74, backgroundColor: '#fff', borderRadius: 18, paddingVertical: 6,
              borderWidth: 1, borderColor: '#ECE8F7', ...shadow,
            }}
          >
            {[null, ...unites].map((x) => {
              const perso = x ? portions.find((pt) => pt.id === x.cle) : undefined;
              const actif = (u?.cle ?? null) === (x?.cle ?? null);
              return (
                <View key={x?.cle ?? 'g'} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingLeft: 16, paddingRight: 6, backgroundColor: actif ? C.lavSoft : 'transparent' }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      choisirUnite(x);
                      setDeroule(false);
                    }}
                    style={{ flex: 1, minHeight: 48, justifyContent: 'center' }}
                  >
                    <Text style={{ fontFamily: actif ? F.bodyBold : F.body, fontSize: 16, color: C.ink }} numberOfLines={1}>
                      {x ? libUnite(x) : 'g'}
                    </Text>
                  </Pressable>
                  {perso ? (
                    <>
                      <Rond
                        label={perso.favori ? `Retirer ${perso.libelle} des favoris` : `${perso.libelle} par défaut pour le +`}
                        fond="transparent"
                        taille={40}
                        onPress={() => definirPortionFavorite(a.id, perso.favori ? null : perso.id)}
                      >
                        <IcEtoile couleur={perso.favori ? C.peachText : '#C9C3DC'} taille={18} epais={2.2} />
                      </Rond>
                      <Rond label={`Supprimer ${perso.libelle}`} fond="transparent" taille={40} onPress={() => supprimerPortion(perso.id)}>
                        <IcPoubelle couleur="#B7B0CC" taille={17} />
                      </Rond>
                    </>
                  ) : null}
                </View>
              );
            })}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setDeroule(false);
                setNouveau('');
              }}
              style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#F0EDFA', marginTop: 4 }}
            >
              <Text style={{ fontFamily: F.bodyBold, fontSize: 14.5, color: C.lavText }}>+ Enregistrer {fmt(g, 1)} g comme grammage</Text>
            </Pressable>
          </View>
        ) : null}

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
            <Rond label="Annuler" fond="transparent" taille={40} onPress={() => setNouveau(null)}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 18, color: C.ink2 }}>×</Text>
            </Rond>
          </View>
        ) : null}
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
      </View>
    </Ecran>

    {/* Bouton toujours visible en bas, comme sur Foodvisor */}
    <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
      <Bouton
        titre={data?.e ? 'Enregistrer la modification' : `Ajouter ${auRepas(repas)} · ${fmt(m.kcal)} kcal`}
        onPress={valider}
        disabled={g <= 0}
      />
    </View>
    </View>
  );
}
