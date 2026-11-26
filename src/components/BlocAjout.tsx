import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Bouton, IcCheck, IcCode, IcEclair, IcEtoile, IcLoupe, IcPlus, Sub, T, fmt, s as ui,
} from './ui';
import {
  Aliment, ajouterEntree, alimentParCode, enregistrerProduitOFF, favoris, grammageRapide, macrosPour, mesAliments, recents, rechercheLocale,
} from '../db/repo';
import { useData } from '../lib/hooks';
import { Vignette } from './Visuel';
import { ResultatEnLigne, produitParCode, rechercheEnLigne } from '../lib/off';
import { C, F, RepasKey } from '../theme';

type Onglet = 'recents' | 'favoris' | 'perso';
// Navigateur : pas de cadre noir autour du champ quand il a le focus (le contour lavande suffit).
const sansContour = Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none', borderWidth: 0 } as object) : {};
const PREMIERS = 8; // résultats montrés avant « Voir plus »

/** Famille d'un aliment pour les filtres : groupe Ciqual, sinon d'où il vient. */
const familleDe = (a: Aliment) => {
  const c = a.categorie ?? (a.source === 'perso' ? 'Mes aliments' : 'Produits scannés');
  // « Pommes de terre et autres tubercules » → « Pommes de terre »
  return c.length > 24 && c.includes(' et ') ? c.slice(0, c.indexOf(' et ')) : c;
};

/**
 * Bloc d'ajout façon Foodvisor : raccourcis, recherche, récents / favoris / mes aliments.
 * Le « + » ajoute tout de suite au repas avec le grammage favori (ou la dernière quantité).
 * Toucher le nom ouvre la fiche pour choisir une autre quantité.
 */
export function BlocAjout({ repas, jour }: { repas: RepasKey; jour: string }) {
  const [q, setQ] = useState('');
  const [onglet, setOnglet] = useState<Onglet>('recents');
  const [enLigne, setEnLigne] = useState<{ etat: 'rien' | 'charge' | 'ok' | 'erreur'; items: ResultatEnLigne[]; msg?: string }>({ etat: 'rien', items: [] });

  const [liste] = useData(async () => {
    if (q.trim().length >= 2) return rechercheLocale(q);
    if (onglet === 'favoris') return favoris();
    if (onglet === 'perso') return mesAliments();
    return recents();
  }, [q, onglet]);

  // Filtre par famille (Fruits, Légumes…) et nombre de résultats affichés : remis à zéro à chaque recherche.
  const [famille, setFamille] = useState<string | null>(null);
  const [montres, setMontres] = useState(PREMIERS);
  useEffect(() => {
    setFamille(null);
    setMontres(PREMIERS);
  }, [q]);
  const familles = useMemo(() => {
    const n = new Map<string, number>();
    for (const a of liste ?? []) n.set(familleDe(a), (n.get(familleDe(a)) ?? 0) + 1);
    return [...n.entries()];
  }, [liste]);

  const ouvrir = (a: Aliment) => router.push({ pathname: '/aliment/[id]', params: { id: a.id, repas } });
  const ajouterVite = async (a: Aliment) => {
    const { g } = await grammageRapide(a);
    await ajouterEntree(jour, repas, a, g);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const chercherEnLigne = async () => {
    if (q.trim().length < 2) return;
    setEnLigne({ etat: 'charge', items: [] });
    try {
      setEnLigne({ etat: 'ok', items: await rechercheEnLigne(q) });
    } catch (e) {
      setEnLigne({ etat: 'erreur', items: [], msg: e instanceof Error ? e.message : 'Recherche impossible.' });
    }
  };

  // Résultat en ligne → aliment local. Si la recherche n'a pas donné les valeurs, une seule lecture produit
  // (rien du tout si le produit est déjà dans la base).
  const [ouvertureEnCours, setOuvertureEnCours] = useState<string | null>(null);
  const depuisEnLigne = async (r: ResultatEnLigne, action: 'ouvrir' | 'ajouter') => {
    if (ouvertureEnCours) return;
    setOuvertureEnCours(r.code);
    try {
      let a = r.complet ? await enregistrerProduitOFF(r.complet) : await alimentParCode(r.code);
      if (!a) {
        const { nutrimentsManquants, ...d } = await produitParCode(r.code);
        if (nutrimentsManquants) {
          router.push({ pathname: '/creer', params: { code: r.code, nom: d.nom, marque: d.marque ?? '', repas } });
          return;
        }
        a = await enregistrerProduitOFF(d);
      }
      if (action === 'ouvrir') ouvrir(a);
      else await ajouterVite(a);
    } catch (e) {
      setEnLigne((x) => ({ ...x, msg: e instanceof Error ? e.message : 'Produit indisponible.' }));
    } finally {
      setOuvertureEnCours(null);
    }
  };

  const recherche = q.trim().length >= 2;
  const outils = [
    { t: 'Code-barres', I: IcCode, go: () => router.push({ pathname: '/scan', params: { repas } }) },
    { t: 'Favoris', I: IcEtoile, go: () => { setQ(''); setOnglet('favoris'); } },
    { t: 'Créer', I: IcPlus, go: () => router.push({ pathname: '/creer', params: { repas } }) },
    { t: 'Saisie rapide', I: IcEclair, go: () => router.push({ pathname: '/rapide', params: { repas } }) },
  ];

  return (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2, paddingHorizontal: 2 }}>
        {outils.map((o) => (
          <Pressable
            key={o.t}
            accessibilityRole="button"
            onPress={o.go}
            style={({ pressed }) => ({ alignItems: 'center', gap: 5, opacity: pressed ? 0.75 : 1 })}
          >
            <View style={{ width: 82, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: '#E4DEFA', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <o.I couleur={C.lavText} taille={22} epais={2.2} />
            </View>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: C.ink }}>{o.t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 16, minHeight: 52, borderWidth: 2, borderColor: '#D9D2F7' }}>
        <IcLoupe couleur={C.ink2} taille={19} />
        <TextInput
          value={q}
          onChangeText={(t) => {
            setQ(t);
            setEnLigne({ etat: 'rien', items: [] });
          }}
          placeholder="Rechercher un aliment"
          placeholderTextColor="#9A94B0"
          accessibilityLabel="Rechercher un aliment"
          returnKeyType="search"
          onSubmitEditing={() => {
            if (recherche && !liste?.length) chercherEnLigne();
          }}
          style={[{ flex: 1, fontFamily: F.body, fontSize: 15, color: C.ink, paddingVertical: 0 }, sansContour]}
        />
        {q ? (
          <Pressable accessibilityLabel="Effacer" onPress={() => setQ('')} hitSlop={10}>
            <Text style={{ fontFamily: F.bodyBold, color: C.ink2, fontSize: 18 }}>×</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[ui.carte, { padding: 8, gap: 2 }]}>
        {!recherche ? (
          <View style={{ flexDirection: 'row', marginBottom: 2 }} accessibilityRole="tablist">
            {([
              ['recents', 'Récents'],
              ['favoris', 'Favoris'],
              ['perso', 'Mes aliments'],
            ] as [Onglet, string][]).map(([k, t]) => (
              <Pressable
                key={k}
                accessibilityRole="tab"
                accessibilityState={{ selected: onglet === k }}
                onPress={() => setOnglet(k)}
                style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: onglet === k ? C.lavText : 'transparent' }}
              >
                <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: onglet === k ? C.lavText : C.ink2 }}>{t}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Sub style={{ paddingHorizontal: 8, paddingVertical: 6 }}>Tes aliments et la table Ciqual</Sub>
        )}

        {recherche && (liste?.length ?? 0) > PREMIERS && familles.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 6, paddingBottom: 6 }}>
            {[['Tout', liste!.length] as [string, number], ...familles].map(([f, n]) => {
              const actif = f === 'Tout' ? famille === null : famille === f;
              return (
                <Pressable
                  key={f}
                  accessibilityRole="button"
                  accessibilityState={{ selected: actif }}
                  onPress={() => {
                    setFamille(f === 'Tout' ? null : f);
                    setMontres(PREMIERS);
                  }}
                  style={{ paddingHorizontal: 12, minHeight: 34, borderRadius: 17, justifyContent: 'center', maxWidth: 220,
                    backgroundColor: actif ? C.lavText : C.soft, borderWidth: 1.5, borderColor: actif ? C.lavText : '#E4DEFA' }}
                >
                  <Text numberOfLines={1} style={{ fontFamily: F.bodyBold, fontSize: 13, color: actif ? '#fff' : C.ink }}>
                    {f} <Text style={{ color: actif ? '#E4DEFA' : C.ink2 }}>{n}</Text>
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {(() => {
          const filtres = recherche && famille ? (liste ?? []).filter((a) => familleDe(a) === famille) : liste ?? [];
          const visibles = recherche ? filtres.slice(0, montres) : filtres;
          const reste = filtres.length - visibles.length;
          return (
            <>
              {visibles.map((a) => (
                <LigneAliment key={a.id} a={a} onOuvrir={() => ouvrir(a)} onAjouter={() => ajouterVite(a)} />
              ))}
              {reste > 0 ? (
                <Pressable accessibilityRole="button" onPress={() => setMontres((m) => m + 20)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.lavText }}>
                    Voir plus ({reste} autre{reste > 1 ? 's' : ''})
                  </Text>
                </Pressable>
              ) : null}
            </>
          );
        })()}

        {!recherche && !liste?.length ? (
          <Sub style={{ textAlign: 'center', padding: 14 }}>
            {onglet === 'recents'
              ? 'Les aliments que tu ajoutes apparaîtront ici. Commence par scanner un produit.'
              : onglet === 'favoris'
                ? 'Touche l’étoile sur la fiche d’un aliment pour le mettre en favori.'
                : 'Tes aliments créés à la main apparaîtront ici.'}
          </Sub>
        ) : null}
        {recherche && !liste?.length ? <Sub style={{ textAlign: 'center', padding: 10 }}>Rien trouvé ici : essaie Open Food Facts pour les produits de marque.</Sub> : null}

        {recherche ? (
          enLigne.etat === 'rien' ? (
            <Bouton variante="doux" titre="Chercher sur Open Food Facts" onPress={chercherEnLigne} style={{ marginTop: 4, minHeight: 46, borderRadius: 18 }} />
          ) : enLigne.etat === 'charge' ? (
            <ActivityIndicator color={C.lav} style={{ padding: 14 }} />
          ) : enLigne.etat === 'erreur' ? (
            <Sub style={{ textAlign: 'center', padding: 10, color: C.errText }}>{enLigne.msg}</Sub>
          ) : (
            <>
              <Sub style={{ paddingHorizontal: 8, paddingTop: 8 }}>
                Sur Open Food Facts · {enLigne.items.length} résultat{enLigne.items.length > 1 ? 's' : ''}
              </Sub>
              {enLigne.msg ? <Sub style={{ textAlign: 'center', padding: 6, color: C.errText }}>{enLigne.msg}</Sub> : null}
              {enLigne.items.map((d) => (
                <View key={d.code} style={[ui.ligne, { backgroundColor: 'transparent', minHeight: 60, gap: 10 }]}>
                  <Vignette
                    a={{ nom: d.nom, source: 'off', image_url: d.image_url, proteines_100g: d.complet?.proteines_100g ?? 0,
                      glucides_100g: d.complet?.glucides_100g ?? 0, lipides_100g: d.complet?.lipides_100g ?? 0 }}
                  />
                  <Pressable accessibilityRole="button" onPress={() => depuisEnLigne(d, 'ouvrir')} style={{ flex: 1, gap: 1 }}>
                    <T style={{ fontFamily: F.bodyBold }} numberOfLines={2}>{d.nom}</T>
                    {d.marque ? <Text style={{ fontFamily: F.bodyBold, fontSize: 11.5, color: C.ink2, textTransform: 'uppercase' }} numberOfLines={1}>{d.marque}</Text> : null}
                    <Sub>{d.complet ? `${d.complet.kcal_100g} kcal / 100 g` : d.quantite ?? ''}</Sub>
                  </Pressable>
                  {ouvertureEnCours === d.code ? (
                    <ActivityIndicator color={C.lav} style={{ width: 46 }} />
                  ) : (
                    <BoutonPlus label={`Ajouter ${d.nom}`} onPress={() => depuisEnLigne(d, 'ajouter')} />
                  )}
                </View>
              ))}
            </>
          )
        ) : null}
      </View>
    </View>
  );
}

function BoutonPlus({ label, onPress }: { label: string; onPress: () => Promise<void> | void }) {
  const [fait, setFait] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (t.current) clearTimeout(t.current);
  }, []);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={async () => {
        await onPress();
        setFait(true);
        if (t.current) clearTimeout(t.current);
        t.current = setTimeout(() => setFait(false), 1400);
      }}
      style={({ pressed }) => ({
        width: 46, height: 46, borderRadius: 23, borderWidth: 2.2, borderColor: fait ? C.okText : C.ink,
        backgroundColor: fait ? C.okBg : '#fff', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1,
      })}
    >
      {fait ? <IcCheck couleur={C.okText} taille={20} epais={3} /> : <Text style={{ fontFamily: F.bodyBold, fontSize: 22, color: C.ink, lineHeight: 24 }}>+</Text>}
    </Pressable>
  );
}

function LigneAliment({ a, onOuvrir, onAjouter }: { a: Aliment; onOuvrir: () => void; onAjouter: () => Promise<void> }) {
  const [rapide] = useData(() => grammageRapide(a), [a.id, a.dernier_g]);
  const g = rapide?.g ?? 100;
  const kcal = macrosPour(a, g).kcal;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 6, paddingRight: 4, borderBottomWidth: 1, borderBottomColor: '#F0EDFA' }}>
      <Pressable accessibilityElementsHidden importantForAccessibility="no" onPress={onOuvrir}>
        <Vignette a={a} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir ${a.nom}`} onPress={onOuvrir} style={{ flex: 1, gap: 1, minHeight: 44, justifyContent: 'center' }}>
        <T style={{ fontFamily: F.bodyBold, fontSize: 15.5 }} numberOfLines={2}>{a.nom}</T>
        {a.marque ? <Text style={{ fontFamily: F.bodyBold, fontSize: 11.5, color: C.ink2, textTransform: 'uppercase' }} numberOfLines={1}>{a.marque}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: a.source === 'off' ? '#8ED3C4' : a.source === 'ciqual' ? '#F3C77A' : C.lav }} />
          <Sub numberOfLines={1} style={{ flex: 1 }}>
            {fmt(kcal)} kcal, {rapide?.libelle.startsWith('★') ? `${rapide.libelle} (${fmt(g, 1)} g)` : `${fmt(g, 1)} g`}
          </Sub>
        </View>
      </Pressable>
      <BoutonPlus label={`Ajouter ${a.nom}`} onPress={onAjouter} />
    </View>
  );
}

