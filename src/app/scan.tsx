import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bouton, IcRetour, Rond, Sub } from '../components/ui';
import { alimentParCode, enregistrerProduitOFF } from '../db/repo';
import { OffIntrouvable, OffQuotaError, produitParCode } from '../lib/off';
import { C, F, RepasKey } from '../theme';

/**
 * Scan : la caméra lit le même code plusieurs fois par seconde.
 * On garde la première lecture, on verrouille tant que le produit est traité,
 * et on ignore le même code pendant 5 s : un scan = au plus un appel à Open Food Facts.
 */
export default function Scan() {
  const { repas } = useLocalSearchParams<{ repas?: RepasKey }>();
  const [perm, demander] = useCameraPermissions();
  const verrou = useRef(false);
  const dernier = useRef<{ code: string; t: number } | null>(null);
  const [etat, setEtat] = useState<{ type: 'vise' | 'charge' | 'erreur'; msg?: string; code?: string }>({ type: 'vise' });
  const [manuel, setManuel] = useState<string | null>(null);

  // en revenant sur l'écran, on peut rescanner
  useFocusEffect(
    useCallback(() => {
      verrou.current = false;
      setEtat({ type: 'vise' });
    }, []),
  );

  const traiter = async (code: string) => {
    const t = Date.now();
    if (verrou.current) return;
    if (dernier.current && dernier.current.code === code && t - dernier.current.t < 5000) return;
    verrou.current = true;
    dernier.current = { code, t };
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setEtat({ type: 'charge', code });
    try {
      // 1. cache local : aucun appel réseau si le produit est déjà connu
      const local = await alimentParCode(code);
      if (local) {
        router.replace({ pathname: '/aliment/[id]', params: { id: local.id, repas, source: 'scan' } });
        return;
      }
      // 2. Open Food Facts
      const p = await produitParCode(code);
      if (p.nutrimentsManquants) {
        router.replace({ pathname: '/creer', params: { code, nom: p.nom, marque: p.marque ?? '', repas } });
        return;
      }
      const { nutrimentsManquants: _ignore, ...data } = p;
      const a = await enregistrerProduitOFF(data);
      router.replace({ pathname: '/aliment/[id]', params: { id: a.id, repas, source: 'scan' } });
    } catch (e) {
      if (e instanceof OffIntrouvable) {
        router.replace({ pathname: '/creer', params: { code, repas } });
        return;
      }
      setEtat({ type: 'erreur', code, msg: e instanceof OffQuotaError ? e.message : e instanceof Error ? e.message : 'Erreur inconnue.' });
    }
  };

  const lu = (r: BarcodeScanningResult) => {
    if (r.data) traiter(r.data.trim());
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#241F33' }}>
      {perm?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={etat.type === 'vise' ? lu : undefined}
        />
      ) : null}
      <SafeAreaView style={{ flex: 1, padding: 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Rond label="Retour" onPress={() => router.back()}>
            <IcRetour couleur={C.lavText} />
          </Rond>
          <Text style={{ flex: 1, fontFamily: F.display, fontSize: 24, color: '#fff' }}>Scanner</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setManuel(manuel === null ? '' : null)}
            style={{ backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: F.bodyBold, color: C.lavText, fontSize: 13 }}>Saisir le code</Text>
          </Pressable>
        </View>

        {manuel !== null ? (
          <View style={{ flexDirection: 'row', gap: 8, backgroundColor: '#fff', borderRadius: 22, padding: 8 }}>
            <TextInput
              autoFocus
              value={manuel}
              onChangeText={(t) => setManuel(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
              placeholder="Chiffres sous le code-barres"
              placeholderTextColor="#9A94B0"
              accessibilityLabel="Code-barres"
              style={{ flex: 1, backgroundColor: C.soft, borderRadius: 999, minHeight: 44, paddingHorizontal: 14, fontFamily: F.body, color: C.ink }}
            />
            <Bouton petit titre="OK" disabled={manuel.length < 8} onPress={() => traiter(manuel)} />
          </View>
        ) : null}

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          {!perm ? null : !perm.granted ? (
            <View style={{ backgroundColor: '#fff', borderRadius: 28, padding: 20, gap: 12, alignItems: 'center' }}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.ink, textAlign: 'center' }}>
                Foodvictor a besoin de la caméra pour lire les codes-barres.
              </Text>
              <Bouton titre="Autoriser la caméra" onPress={demander} />
            </View>
          ) : (
            <>
              <View style={{ width: 260, height: 150 }}>
                {[
                  { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 18 },
                  { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 18 },
                  { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 18 },
                  { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 18 },
                ].map((st, i) => (
                  <View key={i} style={[{ position: 'absolute', width: 36, height: 36, borderColor: '#B9AEF5' }, st]} />
                ))}
                <View style={{ position: 'absolute', left: 16, right: 16, top: 73, height: 4, borderRadius: 2, backgroundColor: C.peach }} />
              </View>
              <View style={{ backgroundColor: 'rgba(36,31,51,0.7)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 }}>
                <Text style={{ color: '#fff', fontFamily: F.bodyBold, fontSize: 13.5 }}>
                  {etat.type === 'charge' ? `Recherche du produit ${etat.code}…` : 'Vise le code-barres, ça scanne tout seul'}
                </Text>
              </View>
              {etat.type === 'charge' ? <ActivityIndicator color="#fff" /> : null}
            </>
          )}
        </View>

        {etat.type === 'erreur' ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 28, padding: 16, gap: 10 }}>
            <Text style={{ fontFamily: F.bodyBold, color: C.errText, fontSize: 14 }}>{etat.msg}</Text>
            <Sub>Code {etat.code}</Sub>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Bouton
                petit
                titre="Réessayer"
                onPress={() => {
                  verrou.current = false;
                  dernier.current = null;
                  if (etat.code) traiter(etat.code);
                }}
              />
              <Bouton petit variante="doux" titre="Créer l'aliment" onPress={() => router.replace({ pathname: '/creer', params: { code: etat.code, repas } })} />
              <Bouton
                petit
                variante="doux"
                titre="Autre code"
                onPress={() => {
                  verrou.current = false;
                  setEtat({ type: 'vise' });
                }}
              />
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
