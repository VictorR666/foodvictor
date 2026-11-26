import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F } from '../theme';

/**
 * Lecteur de code-barres pour le navigateur (Chrome Android).
 * Corrige la mise au point :
 *  - choisit la caméra arrière qui sait faire la mise au point automatique (sur beaucoup de téléphones,
 *    Chrome ouvre par défaut l'ultra grand-angle, qui n'a pas d'autofocus) ;
 *  - demande la mise au point continue, et refait le point quand on touche l'image ;
 *  - zoom ×2 possible pour scanner sans coller le téléphone au produit (la mise au point est meilleure de plus loin) ;
 *  - lampe si le téléphone la propose.
 */

type Caps = MediaTrackCapabilities & {
  focusMode?: string[];
  torch?: boolean;
  zoom?: { min: number; max: number; step?: number };
  pointsOfInterest?: unknown;
};
type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
const CLE_CAMERA = 'foodvictor-camera';

async function creerDetecteur(): Promise<Detector> {
  const W = window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } };
  if (W.BarcodeDetector) {
    try {
      const ok = (await W.BarcodeDetector.getSupportedFormats?.()) ?? FORMATS;
      if (FORMATS.some((f) => ok.includes(f))) return new W.BarcodeDetector({ formats: FORMATS.filter((f) => ok.includes(f)) });
    } catch {
      // on passe au polyfill
    }
  }
  // Polyfill (téléphones sans lecteur intégré) : le moteur .wasm est servi par l'app elle-même,
  // pas par un CDN, pour marcher hors ligne et sans dépendre d'un tiers.
  const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector');
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? '/foodvictor/zxing_reader.wasm' : prefix + path),
    },
  });
  return new BarcodeDetector({ formats: FORMATS as never }) as unknown as Detector;
}

function camerasArriere(list: MediaDeviceInfo[]) {
  const video = list.filter((d) => d.kind === 'videoinput');
  const arriere = video.filter((d) => /back|rear|arri|environment|0$/i.test(d.label));
  return arriere.length ? arriere : video;
}

export function ScannerWeb({ actif, onCode }: { actif: boolean; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const flux = useRef<MediaStream | null>(null);
  const piste = useRef<MediaStreamTrack | null>(null);
  const detecteur = useRef<Detector | null>(null);
  const actifRef = useRef(actif);
  const onCodeRef = useRef(onCode);
  actifRef.current = actif;
  onCodeRef.current = onCode;

  const [erreur, setErreur] = useState<string | null>(null);
  const [caps, setCaps] = useState<Caps>({});
  const [lampe, setLampe] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [point, setPoint] = useState(false);
  const cameraIdRef = useRef<string | null>(null);
  cameraIdRef.current = cameraId;

  const arreter = () => {
    flux.current?.getTracks().forEach((t) => t.stop());
    flux.current = null;
    piste.current = null;
  };

  const appliquer = async (c: MediaTrackConstraintSet) => {
    try {
      await piste.current?.applyConstraints({ advanced: [c] });
    } catch {
      // réglage non pris en charge par ce téléphone
    }
  };

  const demarrer = useCallback(async (deviceId: string | null, essaiAuto: boolean) => {
    arreter();
    setErreur(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      flux.current = s;
      const t = s.getVideoTracks()[0];
      piste.current = t;
      const c: Caps = (t.getCapabilities?.() ?? {}) as Caps;

      // Caméra sans autofocus (souvent l'ultra grand-angle) : on essaie les autres caméras arrière.
      const liste = camerasArriere(await navigator.mediaDevices.enumerateDevices());
      setCameras(liste);
      if (essaiAuto && !c.focusMode?.includes('continuous') && liste.length > 1) {
        const actuel = t.getSettings().deviceId;
        for (const d of liste) {
          if (d.deviceId === actuel) continue;
          arreter();
          const s2 = await navigator.mediaDevices.getUserMedia({ audio: false, video: { deviceId: { exact: d.deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
          const t2 = s2.getVideoTracks()[0];
          const c2 = (t2.getCapabilities?.() ?? {}) as Caps;
          if (c2.focusMode?.includes('continuous')) {
            flux.current = s2;
            piste.current = t2;
            setCaps(c2);
            setCameraId(d.deviceId);
            try { localStorage.setItem(CLE_CAMERA, d.deviceId); } catch { /* stockage indisponible */ }
            break;
          }
          s2.getTracks().forEach((x) => x.stop());
        }
        if (!flux.current) {
          try { if (actuel) localStorage.setItem(CLE_CAMERA, actuel); } catch { /* rien */ }
          return demarrer(actuel ?? null, false);
        }
      } else {
        setCaps(c);
        setCameraId(t.getSettings().deviceId ?? deviceId);
      }

      const cc = (piste.current?.getCapabilities?.() ?? {}) as Caps;
      if (cc.focusMode?.includes('continuous')) await appliquer({ focusMode: 'continuous' } as MediaTrackConstraintSet);
      setLampe(false);
      setZoom(1);
      if (video.current && flux.current) {
        video.current.srcObject = flux.current;
        await video.current.play().catch(() => {});
      }
    } catch (e) {
      const nom = (e as Error)?.name;
      if (deviceId && nom === 'OverconstrainedError') return demarrer(null, true);
      setErreur(
        nom === 'NotAllowedError'
          ? 'L’accès à la caméra est refusé. Autorise-le dans Chrome (icône à gauche de l’adresse › Autorisations), puis réessaie.'
          : 'Impossible d’ouvrir la caméra.',
      );
    }
  }, []);

  // ouverture
  useEffect(() => {
    let memo: string | null = null;
    try { memo = localStorage.getItem(CLE_CAMERA); } catch { /* rien */ }
    demarrer(memo, !memo);
    creerDetecteur().then((d) => (detecteur.current = d)).catch(() => setErreur('Lecture des codes-barres non disponible sur ce navigateur.'));
    const visible = () => {
      if (document.visibilityState === 'hidden') arreter();
      else if (!flux.current) demarrer(cameraIdRef.current, false);
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      document.removeEventListener('visibilitychange', visible);
      arreter();
    };
  }, [demarrer]);

  // boucle de détection (~6 images / s)
  useEffect(() => {
    let stop = false;
    let enCours = false;
    const id = setInterval(async () => {
      if (stop || enCours || !actifRef.current || !detecteur.current || !video.current || video.current.readyState < 2) return;
      enCours = true;
      try {
        const res = await detecteur.current.detect(video.current);
        const code = res.find((r) => /^\d{8,14}$/.test(r.rawValue))?.rawValue;
        if (code && actifRef.current) onCodeRef.current(code);
      } catch {
        // image illisible, on continue
      } finally {
        enCours = false;
      }
    }, 160);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  const refairePoint = async () => {
    setPoint(true);
    setTimeout(() => setPoint(false), 700);
    if (caps.focusMode?.includes('single-shot')) {
      await appliquer({ focusMode: 'single-shot' } as MediaTrackConstraintSet);
      setTimeout(() => {
        if (caps.focusMode?.includes('continuous')) appliquer({ focusMode: 'continuous' } as MediaTrackConstraintSet);
      }, 900);
    } else if (caps.focusMode?.includes('continuous')) {
      await appliquer({ focusMode: 'manual' } as MediaTrackConstraintSet);
      await appliquer({ focusMode: 'continuous' } as MediaTrackConstraintSet);
    }
  };

  const zoomMax = caps.zoom?.max ?? 1;
  const zooms = [1, 2, 3].filter((z) => z <= zoomMax);
  const changerZoom = async () => {
    const i = zooms.indexOf(zoom);
    const z = zooms[(i + 1) % zooms.length] ?? 1;
    setZoom(z);
    await appliquer({ zoom: z } as MediaTrackConstraintSet);
  };
  const basculerLampe = async () => {
    const v = !lampe;
    setLampe(v);
    await appliquer({ torch: v } as MediaTrackConstraintSet);
  };
  const cameraSuivante = () => {
    if (cameras.length < 2) return;
    const i = cameras.findIndex((c) => c.deviceId === cameraId);
    const suivante = cameras[(i + 1) % cameras.length];
    try { localStorage.setItem(CLE_CAMERA, suivante.deviceId); } catch { /* rien */ }
    demarrer(suivante.deviceId, false);
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      {createElement('video', {
        ref: (el: HTMLVideoElement | null) => {
          video.current = el;
          if (el && flux.current && el.srcObject !== flux.current) {
            el.srcObject = flux.current;
            el.play().catch(() => {});
          }
        },
        playsInline: true,
        muted: true,
        autoPlay: true,
        onClick: refairePoint,
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#241F33' },
      })}
      <View pointerEvents="none" style={{ position: 'absolute', top: '36%', alignSelf: 'center', width: 260, height: 150 }}>
        {[
          { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 18 },
          { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 18 },
          { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 18 },
          { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 18 },
        ].map((st, i) => (
          <View key={i} style={[{ position: 'absolute', width: 36, height: 36, borderColor: '#fff' }, st]} />
        ))}
      </View>
      {point ? (
        <View pointerEvents="none" style={{ position: 'absolute', alignSelf: 'center', top: '42%', width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: '#fff' }} />
      ) : null}
      {erreur ? (
        <View style={{ position: 'absolute', left: 16, right: 16, top: '40%', backgroundColor: '#fff', borderRadius: 24, padding: 16, gap: 10 }}>
          <Text style={{ fontFamily: F.bodyBold, color: C.errText, fontSize: 14 }}>{erreur}</Text>
          <Pressable onPress={() => demarrer(null, true)} style={{ alignSelf: 'flex-start', backgroundColor: C.lavDark, borderRadius: 999, minHeight: 44, paddingHorizontal: 18, justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontFamily: F.bodyBold }}>Réessayer</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 28, flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
        {zooms.length > 1 ? <Commande titre={`Zoom ×${zoom}`} onPress={changerZoom} /> : null}
        {caps.torch ? <Commande titre={lampe ? 'Lampe : oui' : 'Lampe'} onPress={basculerLampe} actif={lampe} /> : null}
        {cameras.length > 1 ? <Commande titre="Autre caméra" onPress={cameraSuivante} /> : null}
      </View>
      <Text style={{ position: 'absolute', left: 0, right: 0, bottom: 84, textAlign: 'center', color: '#fff', fontFamily: F.bodyBold, fontSize: 12.5, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}>
        Flou ? Touche l’image pour refaire le point, ou recule un peu.
      </Text>
    </View>
  );
}

function Commande({ titre, onPress, actif }: { titre: string; onPress: () => void; actif?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: actif ? C.peach : 'rgba(255,255,255,0.92)', borderRadius: 999, minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ fontFamily: F.bodyBold, color: actif ? '#fff' : C.lavText, fontSize: 13.5 }}>{titre}</Text>
    </Pressable>
  );
}
