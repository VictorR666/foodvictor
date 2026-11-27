import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BlocAjout } from '../../components/BlocAjout';
import { CerclesMacros } from '../../components/CerclesMacros';
import { Vignette } from '../../components/Visuel';
import { Bouton, Carte, Champ, Ecran, IcBas, IcEtoile, IcPoubelle, Progression, Rond, Segment, Sub, T, fmt } from '../../components/ui';
import { Entree, ZERO, ciblesRepas, creerRepasFavori, entreesDuJour, getObjectifs, restaurerEntree, somme, supprimerEntree } from '../../db/repo';
import { libelleJour, titreJour } from '../../lib/date';
import { useData, useJour } from '../../lib/hooks';
import { C, F, MACRO, REPAS, RepasKey, repasInfo, repasParDefaut, shadow } from '../../theme';

/**
 * Page repas (fusion du détail et de l'ajout, comme Foodvisor) :
 * en haut les kcal et les cercles de macros du repas, puis ce qu'on y a mis,
 * puis directement les outils d'ajout. Les compteurs bougent à chaque ajout.
 */
export default function Repas() {
  const p = useLocalSearchParams<{ repas?: RepasKey }>();
  const [repas, setRepas] = useState<RepasKey>(p.repas ?? repasParDefaut());
  const [choix, setChoix] = useState(false);
  const r = repasInfo(repas);
  const jour = useJour();
  const [data] = useData(async () => {
    const [es, obj] = await Promise.all([entreesDuJour(jour), getObjectifs(jour)]);
    return { es: es.filter((e) => e.repas === repas), cibles: ciblesRepas(obj, repas) };
  }, [jour, repas]);
  const [supprimee, setSupprimee] = useState<Entree | null>(null);
  // Enregistrer le repas en favori : nom proposé à partir des aliments, modifiable.
  const [nomFavori, setNomFavori] = useState<string | null>(null);
  const [favoriOk, setFavoriOk] = useState<string | null>(null);

  const es = data?.es ?? [];
  const cibles = data?.cibles ?? ZERO;
  const t = somme(es);
  const reste = cibles.kcal - t.kcal;

  return (
    <View style={{ flex: 1 }}>
      <Ecran bas={supprimee ? 80 : 10}>
        {/* En-tête */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Changer de repas" onPress={() => setChoix((v) => !v)} style={{ flex: 1, paddingLeft: 4 }}>
            <Sub style={{ fontFamily: F.bodyBold }}>{titreJour(jour) === libelleJour(jour) ? libelleJour(jour) : `${titreJour(jour)} · ${libelleJour(jour)}`}</Sub>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontFamily: F.display, fontSize: 26, color: C.ink }}>{r.nom}</Text>
              <IcBas couleur={C.lavText} taille={18} epais={2.8} />
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => ({ backgroundColor: C.ink, borderRadius: 999, minHeight: 48, paddingHorizontal: 22, justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}
          >
            <Text style={{ color: '#fff', fontFamily: F.bodyBold, fontSize: 16 }}>Terminé</Text>
          </Pressable>
        </View>
        {choix ? (
          <Segment
            options={REPAS.map((x) => ({ k: x.key, t: x.court }))}
            valeur={repas}
            onChange={(k) => {
              setRepas(k);
              setChoix(false);
            }}
          />
        ) : null}

        {/* Bilan du repas */}
        <Carte style={{ gap: 14 }}>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <T style={{ fontFamily: F.bodyBold }}>
                <Text style={{ fontFamily: F.display, fontSize: 22 }}>{fmt(t.kcal)}</Text> / {fmt(cibles.kcal)} kcal
              </T>
              <Sub style={{ fontFamily: F.bodyBold, color: reste < 0 ? MACRO.proteines.text : C.ink2 }}>
                {reste >= 0 ? `${fmt(reste)} kcal restantes` : `${fmt(-reste)} kcal en trop`}
              </Sub>
            </View>
            <Progression ratio={cibles.kcal ? t.kcal / cibles.kcal : 0} degrade hauteur={10} />
          </View>
          <CerclesMacros t={t} cibles={cibles} />
        </Carte>

        {/* Ce qu'il y a dans le repas */}
        {es.length ? (
          <Carte style={{ gap: 4, paddingVertical: 10 }}>
            <Sub style={{ fontFamily: F.bodyBold, paddingHorizontal: 4, paddingBottom: 2 }}>
              Dans ce repas · {es.length} aliment{es.length > 1 ? 's' : ''}
            </Sub>
            {es.map((e) => (
              <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Vignette
                  taille={42}
                  a={{ nom: e.libelle, source: e.source_aliment ?? 'perso', categorie: e.categorie, image_url: e.image_url,
                    proteines_100g: e.proteines, glucides_100g: e.glucides, lipides_100g: e.lipides }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Modifier ${e.libelle}`}
                  disabled={!e.aliment_id}
                  onPress={() => e.aliment_id && router.push({ pathname: '/aliment/[id]', params: { id: e.aliment_id, entree: e.id, repas: e.repas } })}
                  style={{ flex: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 }}
                >
                  <T style={{ fontFamily: F.bodyBold }} numberOfLines={1}>{e.libelle}</T>
                  <Sub>
                    {fmt(e.kcal)} kcal{e.quantite_g ? `, ${fmt(e.quantite_g, 1)} g` : ' · saisie rapide'}
                  </Sub>
                </Pressable>
                <Rond
                  label={`Supprimer ${e.libelle}`}
                  fond="transparent"
                  onPress={async () => {
                    await supprimerEntree(e.id);
                    setSupprimee(e);
                  }}
                >
                  <IcPoubelle couleur={C.ink2} taille={19} />
                </Rond>
              </View>
            ))}
            {nomFavori === null ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setFavoriOk(null);
                  const noms = [...new Set(es.map((e) => e.libelle.split(',')[0]))];
                  setNomFavori(noms.slice(0, 2).join(' + ') + (noms.length > 2 ? '…' : ''));
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 4 }}
              >
                <IcEtoile couleur={favoriOk ? C.okText : C.peachText} taille={17} epais={2.2} />
                <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: favoriOk ? C.okText : C.peachText }}>
                  {favoriOk ? `« ${favoriOk} » enregistré en repas favori` : 'Enregistrer en repas favori'}
                </Text>
              </Pressable>
            ) : (
              <View style={{ gap: 8, paddingTop: 6, paddingHorizontal: 4 }}>
                <Champ label="Nom du repas favori" accessibilityLabel="Nom du repas favori" value={nomFavori} onChangeText={setNomFavori} autoFocus selectTextOnFocus maxLength={60} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Bouton variante="doux" titre="Annuler" petit style={{ flex: 1 }} onPress={() => setNomFavori(null)} />
                  <Bouton
                    titre="Enregistrer"
                    petit
                    style={{ flex: 1 }}
                    disabled={!nomFavori.trim()}
                    onPress={async () => {
                      await creerRepasFavori(nomFavori, repas, es);
                      setFavoriOk(nomFavori.trim());
                      setNomFavori(null);
                    }}
                  />
                </View>
                <Sub style={{ fontSize: 12 }}>
                  Les {es.length} aliments et leurs quantités. Tu le retrouveras dans « Habituels » et « Favoris » pour tout ajouter d’un « + ».
                </Sub>
              </View>
            )}
          </Carte>
        ) : null}

        {/* Ajout */}
        <Text style={{ fontFamily: F.display, fontSize: 19, color: C.ink, paddingHorizontal: 4, paddingTop: 4 }}>Ajouter des aliments</Text>
        <BlocAjout repas={repas} jour={jour} />
      </Ecran>

      {supprimee ? (
        <View
          style={{
            position: 'absolute', left: 16, right: 16, bottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.ink,
            borderRadius: 999, paddingVertical: 8, paddingLeft: 18, paddingRight: 8, ...shadow,
          }}
        >
          <Text style={{ flex: 1, color: '#fff', fontFamily: F.bodyBold }} numberOfLines={1}>« {supprimee.libelle} » supprimé</Text>
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              await restaurerEntree(supprimee.id);
              setSupprimee(null);
            }}
            style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontFamily: F.bodyBold }}>Annuler</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => setSupprimee(null)} style={{ minHeight: 40, paddingHorizontal: 8, justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontFamily: F.bodyBold, fontSize: 18 }}>×</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
