import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IcCible, IcCode, IcJournal, IcProgres, IcSync } from '../../components/ui';
import { C, F, shadow } from '../../theme';

const ONGLETS: Record<string, { titre: string; Icone: typeof IcJournal }> = {
  index: { titre: 'Journal', Icone: IcJournal },
  progres: { titre: 'Progrès', Icone: IcProgres },
  objectifs: { titre: 'Objectifs', Icone: IcCible },
  sauvegarde: { titre: 'Sauvegarde', Icone: IcSync },
};

function Barre({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes;
  const bouton = (i: number) => {
    const r = routes[i];
    const info = ONGLETS[r.name];
    if (!info) return null;
    const actif = state.index === i;
    const couleur = actif ? C.lavText : C.ink2;
    return (
      <Pressable
        key={r.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: actif }}
        onPress={() => {
          if (!actif) navigateToTab(r.key);
        }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 52 }}
      >
        <info.Icone couleur={couleur} taille={22} epais={2.2} />
        <Text style={{ fontFamily: F.bodyBold, fontSize: 11.5, color: couleur }}>{info.titre}</Text>
      </Pressable>
    );
  };
  return (
    <View
      style={{
        position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom, 10) + 4, flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.98)', borderRadius: 28, paddingHorizontal: 8, paddingVertical: 2, ...shadow, shadowOpacity: 0.2,
      }}
    >
      {bouton(0)}
      {bouton(1)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Scanner un code-barres"
        onPress={() => router.push('/scan')}
        style={({ pressed }) => ({
          width: 62, height: 62, marginTop: -30, borderRadius: 31, backgroundColor: C.lavDark, alignItems: 'center', justifyContent: 'center',
          ...shadow, shadowColor: C.lavDark, shadowOpacity: 0.45, elevation: 6, opacity: pressed ? 0.85 : 1,
        })}
      >
        <IcCode couleur="#fff" taille={26} epais={2.2} />
      </Pressable>
      {bouton(2)}
      {bouton(3)}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <Barre {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="progres" />
      <Tabs.Screen name="objectifs" />
      <Tabs.Screen name="sauvegarde" />
    </Tabs>
  );
}
