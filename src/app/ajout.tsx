import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BarreRepartition, Bouton, Ecran, IcBas, IcCheck, IcCode, IcEclair, IcLoupe, IcPlus, IcRetour, LigneMacros, Rond, Segment, Sub, T, fmt, s as ui,
} from '../components/ui';
import {
  Aliment, AlimentData, ajouterEntree, enregistrerProduitOFF, favoris, grammageRapide, macrosPour, mesAliments, recents, rechercheLocale, somme, Totaux,
} from '../db/repo';
import { useData, useJour } from '../lib/hooks';
import { rechercheEnLigne } from '../lib/off';
import { C, F, REPAS, RepasKey, repasInfo, repasParDefaut, shadow } from '../theme';

type Panier = Record<string, { a: Aliment; g: number; m: Totaux }>;
type Onglet = 'recents' | 'favoris' | 'perso';

export default function Ajout() {
  const params = useLocalSearchParams<{ repas?: RepasKey }>();
  const [repas, setRepas] = useState<RepasKey>(params.repas ?? repasParDefaut());
  const [choixRepas, setChoixRepas] = useState(false);
  const jour = useJour();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [onglet, setOnglet] = useState<Onglet>('recents');
  const [panier, setPanier] = useState<Panier>({});
  const [enLigne, setEnLigne] = useState<{ etat: 'rien' | 'charge' | 'ok' | 'erreur'; items: AlimentData[]; msg?: string }>({ etat: 'rien', items: [] });
  const [envoi, setEnvoi] = useState(false);

  const [liste] = useData(async () => {
    if (q.trim().length >= 2) return rechercheLocale(q);
    if (onglet === 'favoris') return favoris();
    if (onglet === 'perso') return mesAliments();
    return recents();
  }, [q, onglet]);

  const items = Object.values(panier);
  const total = useMemo(() => somme(items.map((i) => i.m)), [items]);

  const basculer = async (a: Aliment) => {
    if (panier[a.id]) {
      const { [a.id]: _, ...reste } = panier;
      setPanier(reste);
      return;
    }
    const { g } = await grammageRapide(a);
    setPanier((p) => ({ ...p, [a.id]: { a, g, m: macrosPour(a, g) } }));
  };

  const ouvrir = (a: Aliment) => router.push({ pathname: '/aliment/[id]', params: { id: a.id, repas } });

  const chercherEnLigne = async () => {
    if (q.trim().length < 2) return;
    setEnLigne({ etat: 'charge', items: [] });
    try {
      setEnLigne({ etat: 'ok', items: await rechercheEnLigne(q) });
    } catch (e) {
      setEnLigne({ etat: 'erreur', items: [], msg: e instanceof Error ? e.message : 'Recherche impossible.' });
    }
  };

  const depuisEnLigne = async (d: AlimentData, action: 'ouvrir' | 'ajouter') => {
    const a = await enregistrerProduitOFF(d);
    if (action === 'ouvrir') ouvrir(a);
    else basculer(a);
  };

  const valider = async () => {
    setEnvoi(true);
    for (const i of items) await ajouterEntree(jour, repas, i.a, i.g);
    setEnvoi(false);
    router.back();
  };

  const vide = !liste?.length && !(q.trim().length >= 2);
  return (
    <View style={{ flex: 1 }}>
      <Ecran bas={items.length ? 110 : 10}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Rond label="Retour" onPress={() => router.back()}>
            <IcRetour couleur={C.lavText} />
          </Rond>
          <Pressable accessibilityRole="button" accessibilityLabel="Changer de repas" onPress={() => setChoixRepas((v) => !v)} style={{ flex: 1 }}>
            <Sub style={{ fontFamily: F.bodyBold }}>Ajouter au</Sub>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontFamily: F.display, fontSize: 26, color: C.ink }}>{repasInfo(repas).nom}</Text>
              <IcBas couleur={C.lavText} taille={18} epais={2.8} />
            </View>
          </Pressable>
        </View>
        {choixRepas ? (
          <Segment
            options={REPAS.map((r) => ({ k: r.key, t: r.court }))}
            valeur={repas}
            onChange={(k) => {
              setRepas(k);
              setChoixRepas(false);
            }}
          />
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 16, minHeight: 52, ...shadow, shadowOpacity: 0.1 }}>
          <IcLoupe couleur={C.ink2} taille={19} />
          <TextInput
            value={q}
            onChangeText={(t) => {
              setQ(t);
              setEnLigne({ etat: 'rien', items: [] });
            }}
            placeholder="Rechercher un aliment, une marque"
            placeholderTextColor="#9A94B0"
            accessibilityLabel="Rechercher un aliment"
            returnKeyType="search"
            style={{ flex: 1, fontFamily: F.body, fontSize: 15, color: C.ink, paddingVertical: 0 }}
          />
          {q ? (
            <Pressable accessibilityLabel="Effacer" onPress={() => setQ('')} hitSlop={10}>
              <Text style={{ fontFamily: F.bodyBold, color: C.ink2, fontSize: 18 }}>×</Text>
            </Pressable>
          ) : null}
        </View>

        {!q ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { t: 'Scanner', I: IcCode, bg: C.lavDark, fg: '#fff', go: () => router.push({ pathname: '/scan', params: { repas } }) },
              { t: 'Créer un aliment', I: IcPlus, bg: C.mintSoft, fg: '#1F7A50', go: () => router.push({ pathname: '/creer', params: { repas } }) },
              { t: 'Saisie rapide', I: IcEclair, bg: C.peachSoft, fg: C.peachText, go: () => router.push({ pathname: '/rapide', params: { repas } }) },
            ].map((b) => (
              <Pressable
                key={b.t}
                accessibilityRole="button"
                onPress={b.go}
                style={({ pressed }) => [ui.carte, { flex: 1, alignItems: 'center', gap: 6, padding: 10, minHeight: 84, borderRadius: 22, justifyContent: 'center' }, pressed && { opacity: 0.8 }]}
              >
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: b.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <b.I couleur={b.fg} taille={20} epais={2.2} />
                </View>
                <Text style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: C.ink, textAlign: 'center' }}>{b.t}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={[ui.carte, { padding: 10, gap: 4 }]}>
          {!q ? (
            <View style={{ flexDirection: 'row', marginBottom: 4 }} accessibilityRole="tablist">
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
            <Sub style={{ paddingHorizontal: 6, paddingVertical: 4 }}>Dans tes aliments</Sub>
          )}

          {(liste ?? []).map((a) => (
            <LigneAliment key={a.id} a={a} choisi={panier[a.id]} onOuvrir={() => ouvrir(a)} onBasculer={() => basculer(a)} />
          ))}

          {vide ? (
            <Sub style={{ textAlign: 'center', padding: 14 }}>
              {onglet === 'recents'
                ? 'Les aliments que tu ajoutes apparaîtront ici. Commence par scanner un produit.'
                : onglet === 'favoris'
                  ? 'Touche l’étoile sur la fiche d’un aliment pour le mettre en favori.'
                  : 'Tes aliments créés à la main apparaîtront ici.'}
            </Sub>
          ) : null}
          {q.trim().length >= 2 && !liste?.length ? <Sub style={{ textAlign: 'center', padding: 10 }}>Rien dans tes aliments.</Sub> : null}

          {q.trim().length >= 2 ? (
            enLigne.etat === 'rien' ? (
              <Bouton variante="doux" titre="Chercher sur Open Food Facts" onPress={chercherEnLigne} style={{ marginTop: 4, minHeight: 46, borderRadius: 18 }} />
            ) : enLigne.etat === 'charge' ? (
              <ActivityIndicator color={C.lav} style={{ padding: 14 }} />
            ) : enLigne.etat === 'erreur' ? (
              <Sub style={{ textAlign: 'center', padding: 10, color: C.errText }}>{enLigne.msg}</Sub>
            ) : (
              <>
                <Sub style={{ paddingHorizontal: 6, paddingTop: 8 }}>
                  Sur Open Food Facts · {enLigne.items.length} résultat{enLigne.items.length > 1 ? 's' : ''}
                </Sub>
                {enLigne.items.map((d) => (
                  <View key={d.code_barres!} style={[ui.ligne, { backgroundColor: 'transparent', minHeight: 58 }]}>
                    <Pressable accessibilityRole="button" onPress={() => depuisEnLigne(d, 'ouvrir')} style={{ flex: 1, gap: 1 }}>
                      <T style={{ fontFamily: F.bodyBold }} numberOfLines={1}>{d.nom}</T>
                      <Sub numberOfLines={1}>{[d.marque, `${d.kcal_100g} kcal / 100 g`].filter(Boolean).join(' · ')}</Sub>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Ajouter ${d.nom}`} onPress={() => depuisEnLigne(d, 'ajouter')} style={addStyle(false)}>
                      <Text style={{ fontFamily: F.bodyBold, fontSize: 20, color: C.lavText }}>+</Text>
                    </Pressable>
                  </View>
                ))}
              </>
            )
          ) : null}
        </View>
      </Ecran>

      {items.length ? (
        <View
          style={{
            position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom, 10) + 4, flexDirection: 'row', alignItems: 'center', gap: 12,
            backgroundColor: '#fff', borderRadius: 28, padding: 12, paddingLeft: 18, ...shadow, shadowOpacity: 0.25, elevation: 8,
          }}
        >
          <View style={{ flex: 1, gap: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={{ fontFamily: F.display, fontSize: 22, color: C.ink }}>{fmt(total.kcal)} kcal</Text>
              <Sub>{items.length} aliment{items.length > 1 ? 's' : ''}</Sub>
            </View>
            <BarreRepartition t={total} />
            <LigneMacros t={total} unite=" g" />
          </View>
          <Bouton titre={envoi ? '…' : 'Ajouter'} onPress={valider} disabled={envoi} />
        </View>
      ) : null}
    </View>
  );
}

const addStyle = (on: boolean) => ({
  width: 44, height: 44, borderRadius: 22, borderWidth: 2.4, borderColor: on ? C.lavText : C.lav,
  backgroundColor: on ? C.lavText : '#fff', alignItems: 'center' as const, justifyContent: 'center' as const,
});

function LigneAliment({ a, choisi, onOuvrir, onBasculer }: { a: Aliment; choisi?: { g: number; m: Totaux }; onOuvrir: () => void; onBasculer: () => void }) {
  const [rapide] = useData(() => grammageRapide(a), [a.id, a.dernier_g]);
  const g = choisi?.g ?? rapide?.g ?? 100;
  const kcal = choisi?.m.kcal ?? macrosPour(a, g).kcal;
  const etoile = rapide?.libelle.startsWith('★');
  return (
    <View style={[ui.ligne, { backgroundColor: choisi ? C.lavSoft : 'transparent', minHeight: 58 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir ${a.nom}`} onPress={onOuvrir} style={{ flex: 1, gap: 1, minHeight: 44, justifyContent: 'center' }}>
        <T style={{ fontFamily: F.bodyBold }} numberOfLines={1}>{a.nom}</T>
        <Sub numberOfLines={1}>
          {etoile ? `${rapide!.libelle} · ` : ''}
          {fmt(g)} g · {fmt(kcal)} kcal{a.marque ? ` · ${a.marque}` : ''}
        </Sub>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={choisi ? `Retirer ${a.nom}` : `Ajouter ${a.nom}`}
        onPress={onBasculer}
        style={addStyle(!!choisi)}
      >
        {choisi ? <IcCheck couleur="#fff" taille={18} epais={3} /> : <Text style={{ fontFamily: F.bodyBold, fontSize: 20, color: C.lavText }}>+</Text>}
      </Pressable>
    </View>
  );
}
