import { Alert, Platform } from 'react-native';

// Alert de React Native ne fait rien dans un navigateur : on passe par les boîtes natives du navigateur.
export function alerte(titre: string, message?: string) {
  if (Platform.OS === 'web') window.alert(message ? `${titre}\n\n${message}` : titre);
  else Alert.alert(titre, message);
}

export function confirmer(titre: string, message: string, ok = 'OK'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${titre}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(titre, message, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: ok, onPress: () => resolve(true) },
    ]),
  );
}
