import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { migrate } from '../db';
import { demarrerSyncAuto } from '../lib/sync';
import { C } from '../theme';

export default function RootLayout() {
  const [fonts] = useFonts({ Fredoka_600SemiBold, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold });
  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Web : la base SQLite du navigateur exige l'isolation d'origine (apportée par le service worker).
  const webPasPret = Platform.OS === 'web' && typeof window !== 'undefined' && !window.crossOriginIsolated;
  const [lent, setLent] = useState(false);
  useEffect(() => {
    if (!webPasPret) return;
    const t = setTimeout(() => setLent(true), 4000);
    return () => clearTimeout(t);
  }, [webPasPret]);

  useEffect(() => {
    if (webPasPret) return;
    let stop: (() => void) | undefined;
    migrate()
      .then(() => {
        setPret(true);
        stop = demarrerSyncAuto();
      })
      .catch((e) => setErreur(String(e?.message ?? e)));
    return () => stop?.();
  }, [webPasPret]);

  if (webPasPret) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: C.bg }}>
        <ActivityIndicator color={C.lav} />
        {lent ? (
          <Text style={{ color: C.ink, textAlign: 'center' }}>
            Préparation de l’app… Si ça dure, recharge la page. Foodvictor fonctionne dans Chrome sur Android.
          </Text>
        ) : null}
      </View>
    );
  }

  if (erreur) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.bg }}>
        <Text style={{ color: C.ink, textAlign: 'center' }}>La base de données n’a pas pu s’ouvrir : {erreur}</Text>
      </View>
    );
  }
  if (!fonts || !pret) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.lav} />
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scan" options={{ animation: 'fade_from_bottom' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
