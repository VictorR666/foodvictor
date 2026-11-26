import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { Aliment } from '../db/repo';
import { emojiDe, fondDe } from '../lib/visuel';

type AlimentVisuel = Pick<Aliment, 'nom' | 'source' | 'proteines_100g' | 'glucides_100g' | 'lipides_100g'> & {
  categorie?: string | null;
  image_url?: string | null;
};

/** Petite image carrée pour les listes : photo Open Food Facts, sinon emoji sur fond pastel. */
export function Vignette({ a, taille = 46 }: { a: AlimentVisuel; taille?: number }) {
  const [erreur, setErreur] = useState(false);
  const photo = a.image_url && !erreur ? a.image_url : null;
  return (
    <View
      style={{
        width: taille, height: taille, borderRadius: taille * 0.3, overflow: 'hidden',
        backgroundColor: photo ? '#fff' : fondDe(a), alignItems: 'center', justifyContent: 'center',
        borderWidth: photo ? 1 : 0, borderColor: '#EEEAF8',
      }}
    >
      {photo ? (
        <Image source={{ uri: photo }} onError={() => setErreur(true)} resizeMode="cover" style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
      ) : (
        <Text style={{ fontSize: taille * 0.5 }}>{emojiDe(a)}</Text>
      )}
    </View>
  );
}

/**
 * Grande image d'en-tête de la fiche aliment, comme sur Foodvisor :
 * photo du produit pleine largeur (assombrie en haut et en bas pour lire les boutons et le titre),
 * sinon fond pastel avec un grand emoji.
 */
export function EnTetePhoto({ a, hauteur = 250, sansPhoto, onErreur }: { a: AlimentVisuel; hauteur?: number; sansPhoto?: boolean; onErreur?: () => void }) {
  const photo = a.image_url && !sansPhoto ? a.image_url : null;
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: hauteur, backgroundColor: photo ? '#2A2438' : fondDe(a), overflow: 'hidden' }}>
      {photo ? (
        <>
          <Image source={{ uri: photo }} onError={onErreur} resizeMode="cover" style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
          <Svg width="100%" height="100%" style={{ position: 'absolute', left: 0, top: 0 }}>
            <Defs>
              <LinearGradient id="voile" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000" stopOpacity="0.35" />
                <Stop offset="0.35" stopColor="#000" stopOpacity="0" />
                <Stop offset="0.55" stopColor="#000" stopOpacity="0.05" />
                <Stop offset="1" stopColor="#000" stopOpacity="0.65" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#voile)" />
          </Svg>
        </>
      ) : (
        <Text style={{ position: 'absolute', right: 22, top: hauteur * 0.2, fontSize: 96, opacity: 0.95 }}>{emojiDe(a)}</Text>
      )}
    </View>
  );
}
