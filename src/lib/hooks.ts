import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import { onDataChange } from './events';
import { isoDate } from './date';

// ---------- Jour affiché (partagé entre les écrans) ----------
let jour = isoDate();
const abonnesJour = new Set<() => void>();
export function setJour(d: string) {
  jour = d;
  abonnesJour.forEach((f) => f());
}
export function useJour() {
  return useSyncExternalStore(
    (f) => {
      abonnesJour.add(f);
      return () => {
        abonnesJour.delete(f);
      };
    },
    () => jour,
  );
}

/** Charge des données et les recharge quand l'écran revient au premier plan ou qu'une donnée change. */
export function useData<T>(charger: () => Promise<T>, deps: unknown[]): [T | undefined, () => void] {
  const [data, setData] = useState<T>();
  const ref = useRef(charger);
  ref.current = charger;
  const recharger = useCallback(() => {
    ref.current().then(setData).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    recharger();
    return onDataChange(recharger);
  }, [recharger]);
  useFocusEffect(recharger);
  return [data, recharger];
}
