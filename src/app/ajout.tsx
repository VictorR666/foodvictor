import { Redirect, useLocalSearchParams } from 'expo-router';
import { RepasKey, repasParDefaut } from '../theme';

/** L'ajout fait désormais partie de la page repas. */
export default function Ajout() {
  const p = useLocalSearchParams<{ repas?: RepasKey }>();
  return <Redirect href={{ pathname: '/repas/[repas]', params: { repas: p.repas ?? repasParDefaut() } }} />;
}
