// Petit bus d'événements : prévient l'interface et la synchro qu'une donnée a changé.
type Listener = () => void;
const listeners = new Set<Listener>();

export function onDataChange(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitDataChange() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // un écouteur en erreur ne doit pas bloquer les autres
    }
  });
}
