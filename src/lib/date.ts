const pad = (n: number) => String(n).padStart(2, '0');

/** Date locale au format AAAA-MM-JJ. */
export function isoDate(d: Date = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIso(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number) {
  const d = parseIso(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function libelleJour(s: string) {
  const d = parseIso(s);
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}

export function titreJour(s: string) {
  const today = isoDate();
  if (s === today) return "Aujourd'hui";
  if (s === addDays(today, -1)) return 'Hier';
  if (s === addDays(today, 1)) return 'Demain';
  return libelleJour(s);
}

/** Les 7 jours (lundi → dimanche) de la semaine qui contient `s`. */
export function semaine(s: string) {
  const d = parseIso(s);
  const lundi = addDays(s, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(lundi, i));
}

export const LETTRE_JOUR = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export function heure(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
