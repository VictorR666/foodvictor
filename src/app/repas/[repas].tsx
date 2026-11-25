import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Anneau, Bouton, Carte, Ecran, IcPoubelle, IcRetour, LigneMacros, Legende, Progression, Rond, Sub, T, Titre, fmt, s as ui,
} from '../../components/ui';
import {
  Entree, entreesDuJour, getObjectifs, objectifRepasKcal, restaurerEntree, somme, supprimerEntree,
} from '../../db/repo';
import { libelleJour } from '../../lib/date';
import { useData, useJour } from '../../lib/hooks';
import { C, F, RepasKey, repasInfo } from '../../theme';

export default function Repas() {
  const { repas } = useLocalSearchParams<{ repas: RepasKey }>();
  const r = repasInfo(repas);
  const jour = useJour();
  const [data] = useData(async () => {
    const [es, obj] = await Promise.all([entreesDuJour(jour), getObjectifs(jour)]);
    return { es: es.filter((e) => e.repas === r.key), cible: objectifRepasKcal(obj, r.key) };
  }, [jour, r.key]);
  const [supprimee, setSupprimee] = useState<Entree | null>(null);

  const es = data?.es ?? [];
  const cible = data?.cible ?? 0;
  const t = somme(es);

  const supprimer = async (e: Entree) => {
    await supprimerEntree(e.id);
    setSupprimee(e);
  };

  return (
    <Ecran bas={supprimee ? 70 : 0}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Rond label="Retour au journal" onPress={() => router.back()}>
          <IcRetour couleur={C.lavText} />
        </Rond>
        <View style={{ flex: 1 }}>
          <Sub style={{ fontFamily: F.bodyBold }}>{libelleJour(jour)}</Sub>
          <Titre>{r.nom}</Titre>
        </View>
        <Rond label={`Ajouter au ${r.nom.toLowerCase()}`} fond={C.lavText} onPress={() => router.push({ pathname: '/ajout', params: { repas: r.key } })}>
          <Text style={{ color: '#fff', fontSize: 24, fontFamily: F.bodyBold, lineHeight: 26 }}>+</Text>
        </Rond>
      </View>

      <Carte>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <Anneau t={t} taille={130} centre={fmt(t.kcal)} sousCentre={`/ ${fmt(cible)} kcal`} />
          <Legende t={t} />
        </View>
        <Progression ratio={cible ? t.kcal / cible : 0} degrade hauteur={8} />
        <Sub>
          {cible
            ? t.kcal <= cible
              ? `${Math.round((t.kcal / cible) * 100)} % de l'objectif · ${fmt(cible - t.kcal)} kcal restantes`
              : `${fmt(t.kcal - cible)} kcal au-dessus de l'objectif du repas`
            : 'Pas d’objectif pour ce repas'}
        </Sub>
      </Carte>

      <Carte style={{ gap: 8 }}>
        <Titre style={{ fontSize: 18, paddingHorizontal: 4 }}>
          {es.length ? `${es.length} aliment${es.length > 1 ? 's' : ''}` : 'Rien pour le moment'}
        </Titre>
        {es.map((e) => (
          <View key={e.id} style={ui.ligne}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Modifier ${e.libelle}`}
              disabled={!e.aliment_id}
              onPress={() => e.aliment_id && router.push({ pathname: '/aliment/[id]', params: { id: e.aliment_id, entree: e.id, repas: e.repas } })}
              style={{ flex: 1, gap: 1, minHeight: 44, justifyContent: 'center' }}
            >
              <T style={{ fontFamily: F.bodyBold }} numberOfLines={1}>{e.libelle}</T>
              <Sub>{e.quantite_g ? `${fmt(e.quantite_g)} g` : 'Saisie rapide'} · <Text style={{ color: C.ink, fontFamily: F.bodyBold }}>{fmt(e.kcal)} kcal</Text></Sub>
              <LigneMacros t={e} />
            </Pressable>
            <Rond label={`Supprimer ${e.libelle}`} fond="transparent" onPress={() => supprimer(e)}>
              <IcPoubelle couleur={C.ink2} taille={19} />
            </Rond>
          </View>
        ))}
        {!es.length ? (
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
            <Bouton petit titre="Scanner" onPress={() => router.push({ pathname: '/scan', params: { repas: r.key } })} />
            <Bouton petit variante="doux" titre="Chercher un aliment" onPress={() => router.push({ pathname: '/ajout', params: { repas: r.key } })} />
          </View>
        ) : null}
      </Carte>

      {es.length ? <Bouton variante="doux" titre="+ Ajouter un aliment" onPress={() => router.push({ pathname: '/ajout', params: { repas: r.key } })} /> : null}

      {supprimee ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.ink, borderRadius: 999, paddingVertical: 8, paddingLeft: 18, paddingRight: 8 }}>
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
        </View>
      ) : null}
    </Ecran>
  );
}
