import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { Totaux } from '../db/repo';
import { C, F, MACRO, MACRO_KEYS } from '../theme';
import { fmt } from './ui';

/** Quatre cercles « consommé / objectif » : protéines, glucides, lipides, fibres. */
export function CerclesMacros({ t, cibles, taille = 66 }: { t: Totaux; cibles: Totaux; taille?: number }) {
  const ep = 6;
  const r = (taille - ep) / 2;
  const L = 2 * Math.PI * r;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {MACRO_KEYS.map((k) => {
        const cible = cibles[k];
        const ratio = cible > 0 ? Math.min(1, t[k] / cible) : 0;
        const depasse = cible > 0 && t[k] > cible * 1.05 && k !== 'fibres';
        return (
          <View key={k} style={{ alignItems: 'center', gap: 6, flex: 1 }} accessible accessibilityLabel={`${MACRO[k].nom} : ${fmt(t[k])} sur ${fmt(cible)} grammes`}>
            <View style={{ width: taille, height: taille }}>
              <Svg width={taille} height={taille} style={{ transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke={MACRO[k].bg} strokeWidth={ep} />
                {ratio > 0 ? (
                  <Circle
                    cx={taille / 2}
                    cy={taille / 2}
                    r={r}
                    fill="none"
                    stroke={MACRO[k].fill}
                    strokeWidth={ep}
                    strokeLinecap="round"
                    strokeDasharray={`${Math.max(ratio * L, 0.1)} ${L}`}
                  />
                ) : null}
              </Svg>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: F.display, fontSize: taille > 60 ? 19 : 16, color: depasse ? MACRO.proteines.text : C.ink, lineHeight: taille > 60 ? 21 : 18 }}>
                  {fmt(t[k])}
                </Text>
                <Text style={{ fontFamily: F.body, fontSize: 11, color: C.ink2 }}>/{fmt(cible)}g</Text>
              </View>
            </View>
            <Text numberOfLines={1} style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: MACRO[k].text }}>{MACRO[k].nom}</Text>
          </View>
        );
      })}
    </View>
  );
}
