import React from 'react';
import {
  Pressable, PressableProps, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextProps, TextStyle, View, ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { C, F, MACRO, MACRO_KEYS, MacroKey, shadow } from '../theme';
import type { Totaux } from '../db/repo';

// ---------- Texte ----------
export function T({ style, ...p }: TextProps) {
  return <Text {...p} style={[{ fontFamily: F.body, color: C.ink, fontSize: 14.5 }, style]} />;
}
export function Titre({ style, ...p }: TextProps) {
  return <Text {...p} style={[{ fontFamily: F.display, color: C.ink, fontSize: 26 }, style]} />;
}
export function Sub({ style, ...p }: TextProps) {
  return <Text {...p} style={[{ fontFamily: F.body, color: C.ink2, fontSize: 12.5 }, style]} />;
}
export function Lab({ style, ...p }: TextProps) {
  return (
    <Text
      {...p}
      style={[{ fontFamily: F.bodyBold, color: C.ink2, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' }, style]}
    />
  );
}

// ---------- Fond doux lavande / pêche ----------
export function Fond() {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="lav" cx="0%" cy="0%" r="70%">
          <Stop offset="0" stopColor="#EEE9FF" stopOpacity="1" />
          <Stop offset="1" stopColor="#EEE9FF" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="pea" cx="100%" cy="100%" r="70%">
          <Stop offset="0" stopColor="#FFE9DD" stopOpacity="1" />
          <Stop offset="1" stopColor="#FFE9DD" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={C.bg} />
      <Rect width="100%" height="100%" fill="url(#lav)" />
      <Rect width="100%" height="100%" fill="url(#pea)" />
    </Svg>
  );
}

/** Écran standard : fond, marges sûres, défilement. */
export function Ecran({
  children, scroll = true, bas = 0, style,
}: { children: React.ReactNode; scroll?: boolean; bas?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Fond />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[{ padding: 16, paddingBottom: 24 + bas, gap: 12 }, style]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1, padding: 16, gap: 12 }, style]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

export function Carte({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return <View style={[s.carte, style]}>{children}</View>;
}

// ---------- Boutons ----------
type BtnProps = PressableProps & { titre: string; variante?: 'plein' | 'doux' | 'blanc'; style?: StyleProp<ViewStyle>; petit?: boolean };
export function Bouton({ titre, variante = 'plein', style, petit, disabled, ...p }: BtnProps) {
  const plein = variante === 'plein';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      {...p}
      style={({ pressed }) => [
        s.btn,
        petit && { minHeight: 44, borderRadius: 999, paddingHorizontal: 16 },
        plein && { backgroundColor: C.lavDark, ...shadow, shadowColor: C.lavDark },
        variante === 'doux' && { backgroundColor: C.lavSoft },
        variante === 'blanc' && { backgroundColor: '#fff', ...shadow },
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.85 },
        style,
      ]}
    >
      <Text style={{ fontFamily: F.bodyBold, fontSize: petit ? 13.5 : 16, color: plein ? '#fff' : C.lavText }}>{titre}</Text>
    </Pressable>
  );
}

export function Rond({
  children, label, onPress, fond = '#fff', taille = 44, style,
}: { children: React.ReactNode; label: string; onPress?: () => void; fond?: string; taille?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        { width: taille, height: taille, borderRadius: taille / 2, backgroundColor: fond, alignItems: 'center', justifyContent: 'center' },
        fond === '#fff' && shadow,
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function Puce({ titre, actif, onPress, onLongPress }: { titre: string; actif?: boolean; onPress?: () => void; onLongPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!actif }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [s.puce, actif && { backgroundColor: C.lavText }, pressed && { opacity: 0.8 }]}
    >
      <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: actif ? '#fff' : C.ink2 }}>{titre}</Text>
    </Pressable>
  );
}

export function Segment<K extends string>({ options, valeur, onChange }: { options: { k: K; t: string }[]; valeur: K; onChange: (k: K) => void }) {
  return (
    <View style={s.seg} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.k === valeur;
        return (
          <Pressable
            key={o.k}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.k)}
            style={[s.segBtn, on && { backgroundColor: '#fff', ...shadow, shadowOpacity: 0.18, elevation: 2 }]}
          >
            <Text numberOfLines={1} style={{ fontFamily: F.bodyBold, fontSize: 13, color: on ? C.lavText : C.ink2 }}>{o.t}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Champs ----------
export function Champ({ label, style, ...p }: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Lab>{label}</Lab> : null}
      <TextInput placeholderTextColor="#9A94B0" {...p} style={[s.champ, style as StyleProp<TextStyle>]} />
    </View>
  );
}

export function ChampNombre({
  valeur, onChange, unite, label, largeur = 64,
}: { valeur: string; onChange: (v: string) => void; unite: string; label: string; largeur?: number }) {
  return (
    <View style={s.fld}>
      <TextInput
        accessibilityLabel={label}
        value={valeur}
        onChangeText={(t) => onChange(t.replace(/[^0-9.,]/g, ''))}
        keyboardType="decimal-pad"
        selectTextOnFocus
        style={{ width: largeur, fontFamily: F.display, fontSize: 18, color: C.ink, textAlign: 'right', paddingVertical: 0 }}
      />
      <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.ink2 }}>{unite}</Text>
    </View>
  );
}

export const lireNombre = (v: string) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
export const fmt = (n: number, dec = 0) =>
  (Math.round(n * 10 ** dec) / 10 ** dec).toLocaleString('fr-FR', { maximumFractionDigits: dec });

// ---------- Macros ----------
export function LigneMacros({ t, unite = '', style }: { t: Totaux; unite?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }, style]}>
      {MACRO_KEYS.map((k) => (
        <Text key={k} style={{ fontFamily: F.bodyBold, fontSize: 12, color: MACRO[k].text }}>
          {MACRO[k].lettre} {fmt(t[k], t[k] < 10 && t[k] % 1 ? 1 : 0)}
          {unite}
        </Text>
      ))}
    </View>
  );
}

/** Barre empilée P / G / L selon leur part des kcal. */
export function BarreRepartition({ t, hauteur = 8 }: { t: Totaux; hauteur?: number }) {
  const p = t.proteines * 4, g = t.glucides * 4, l = t.lipides * 9;
  const tot = p + g + l || 1;
  return (
    <View style={{ flexDirection: 'row', height: hauteur, borderRadius: 999, overflow: 'hidden', gap: 2, backgroundColor: C.soft }}>
      <View style={{ flex: p / tot, backgroundColor: MACRO.proteines.fill }} />
      <View style={{ flex: g / tot, backgroundColor: MACRO.glucides.fill }} />
      <View style={{ flex: l / tot, backgroundColor: MACRO.lipides.fill }} />
    </View>
  );
}

/**
 * Barre façon cercles de macros : se remplit dans la couleur pastel,
 * puis le dépassement repart de la gauche dans la teinte foncée (plafonné à une barre de plus).
 */
export function BarreDepassement({ ratio, couleur, fonce, fond, hauteur = 8 }: { ratio: number; couleur: string; fonce: string; fond: string; hauteur?: number }) {
  const base = Math.max(0, Math.min(1, ratio));
  const trop = Math.max(0, Math.min(1, ratio - 1));
  return (
    <View style={{ alignSelf: 'stretch', height: hauteur, borderRadius: 999, backgroundColor: fond, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${base * 100}%`, borderRadius: 999, backgroundColor: couleur }} />
      {trop > 0 ? (
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${trop * 100}%`, borderRadius: 999, backgroundColor: fonce }} />
      ) : null}
    </View>
  );
}

export function Progression({ ratio, couleur, fond = C.lavSoft, hauteur = 6, degrade }: { ratio: number; couleur?: string; fond?: string; hauteur?: number; degrade?: boolean }) {
  const pct = Math.max(0, Math.min(1, ratio));
  return (
    <View style={{ height: hauteur, borderRadius: 999, backgroundColor: fond, overflow: 'hidden' }}>
      {degrade ? (
        <Svg width={`${pct * 100}%`} height={hauteur}>
          <Defs>
            <LinearGradient id="g" x1="0" x2="1">
              <Stop offset="0" stopColor={C.lav} />
              <Stop offset="1" stopColor={ratio > 1 ? '#F0695E' : C.peach} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height={hauteur} rx={hauteur / 2} fill="url(#g)" />
        </Svg>
      ) : (
        <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 999, backgroundColor: couleur }} />
      )}
    </View>
  );
}

/** Jauge en demi-cercle (kcal restantes). */
export function Jauge({ ratio, depasse }: { ratio: number; depasse?: boolean }) {
  const L = Math.PI * 75;
  const v = Math.max(0, Math.min(1, ratio)) * L;
  return (
    <Svg viewBox="0 0 190 104" width={180} height={99}>
      <Defs>
        <LinearGradient id="arc" x1="0" x2="1">
          <Stop offset="0" stopColor={C.lav} />
          <Stop offset="1" stopColor={depasse ? '#F0695E' : C.peach} />
        </LinearGradient>
      </Defs>
      <Path d="M20 95A75 75 0 0 1 170 95" fill="none" stroke={C.lavSoft} strokeWidth={14} strokeLinecap="round" />
      {v > 0 ? (
        <Path d="M20 95A75 75 0 0 1 170 95" fill="none" stroke="url(#arc)" strokeWidth={14} strokeLinecap="round" strokeDasharray={`${v} ${L}`} />
      ) : null}
    </Svg>
  );
}

/** Anneau de répartition des macros, kcal au centre. */
export function Anneau({ t, taille = 120, centre, sousCentre }: { t: Totaux; taille?: number; centre: string; sousCentre: string }) {
  const r = taille / 2 - 14;
  const L = 2 * Math.PI * r;
  const parts = [
    { v: t.proteines * 4, c: MACRO.proteines.fill },
    { v: t.glucides * 4, c: MACRO.glucides.fill },
    { v: t.lipides * 9, c: MACRO.lipides.fill },
  ];
  const tot = parts.reduce((a, p) => a + p.v, 0);
  let off = 0;
  return (
    <View style={{ width: taille, height: taille }}>
      <Svg width={taille} height={taille} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke={C.soft} strokeWidth={15} />
        {tot > 0 &&
          parts.map((p, i) => {
            const len = (p.v / tot) * L;
            const el = len > 0.5 ? (
              <Circle
                key={i}
                cx={taille / 2}
                cy={taille / 2}
                r={r}
                fill="none"
                stroke={p.c}
                strokeWidth={15}
                strokeDasharray={`${Math.max(len - 2, 0.5)} ${L}`}
                strokeDashoffset={-off}
              />
            ) : null;
            off += len;
            return el;
          })}
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontFamily: F.display, fontSize: 28, color: C.ink, lineHeight: 30 }}>{centre}</Text>
        <Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: C.ink2 }}>{sousCentre}</Text>
      </View>
    </View>
  );
}

export function Legende({ t, kcalPct = true }: { t: Totaux; kcalPct?: boolean }) {
  const tot = t.proteines * 4 + t.glucides * 4 + t.lipides * 9 || 1;
  const pct = (k: MacroKey) => (k === 'fibres' || !kcalPct ? '' : ` · ${Math.round(((k === 'lipides' ? 9 : 4) * t[k] * 100) / tot)} %`);
  return (
    <View style={{ flex: 1, gap: 9 }}>
      {MACRO_KEYS.map((k) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: MACRO[k].fill }} />
          <T style={{ flex: 1, fontFamily: F.bodyBold, fontSize: 13.5 }}>{MACRO[k].nom}</T>
          <Sub>
            {fmt(t[k], 1)} g{pct(k)}
          </Sub>
        </View>
      ))}
    </View>
  );
}

// ---------- Icônes (traits simples) ----------
type IcProps = { taille?: number; couleur?: string; epais?: number };
const ic = (d: string) =>
  function Icone({ taille = 20, couleur = C.ink, epais = 2.4 }: IcProps) {
    return (
      <Svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth={epais} strokeLinecap="round" strokeLinejoin="round">
        <Path d={d} />
      </Svg>
    );
  };
export const IcRetour = ic('M15 5l-7 7 7 7');
export const IcCheck = ic('M5 12.5l4.5 4.5L19 7.5');
export const IcPlus = ic('M12 5v14M5 12h14');
export const IcCode = ic('M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3M8 9v6M11 9v6M14 9v6M17 9v6');
export const IcLoupe = ic('M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM16 16l4 4');
export const IcEclair = ic('M13 3L5 14h6l-1 7 8-11h-6z');
export const IcEtoile = ic('M12 4l2.5 5 5.5.8-4 3.9.9 5.5L12 16.6 7.1 19.2l.9-5.5-4-3.9 5.5-.8z');
export const IcBas = ic('M6 9l6 6 6-6');
export const IcJournal = ic('M8 4h8a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM9 9h6M9 13h6M9 17h3');
export const IcProgres = ic('M5 19V11M12 19V5M19 19v-6');
export const IcCible = ic('M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z');
export const IcSync = ic('M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5');
export const IcPoubelle = ic('M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12');
export const IcCalendrier = ic('M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4 10h16M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01');
export const IcDroite = ic('M9 5l7 7-7 7');
export const IcCrayon = ic('M4 20h4L19 9l-4-4L4 16zM13 7l4 4');

export const IcRepas: Record<string, React.FC<IcProps>> = {
  petit_dej: ic('M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 4v2M4 13H2M22 13h-2M6.3 7.3L5 6M17.7 7.3L19 6M3 19h18'),
  dejeuner: ic('M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z'),
  diner: ic('M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z'),
  collation: ic('M12 8c-3-2-7-1-7 4s3 8 5 8c1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 5-3 5-8s-4-6-7-4zM12 8c0-2 1-4 3-5'),
};

export const s = StyleSheet.create({
  carte: { backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 28, padding: 16, gap: 10, ...shadow },
  btn: { minHeight: 52, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  puce: { minHeight: 38, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.soft },
  seg: { flexDirection: 'row', backgroundColor: C.soft, borderRadius: 999, padding: 3, gap: 3 },
  segBtn: { flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  champ: {
    backgroundColor: C.soft, borderRadius: 16, minHeight: 48, paddingHorizontal: 14, fontFamily: F.body, fontSize: 15, color: C.ink,
  },
  fld: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, minHeight: 44,
    ...shadow, shadowOpacity: 0.1, elevation: 1,
  },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 14, paddingRight: 8, borderRadius: 20, backgroundColor: C.soft },
});
