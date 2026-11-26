import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Bouton, Carte, ChampNombre, Ecran, IcCible, IcRepas, Segment, Sub, T, Titre, fmt, lireNombre, s as ui } from '../../components/ui';
import { getObjectifs, saveObjectifs } from '../../db/repo';
import { isoDate, libelleJour } from '../../lib/date';
import { C, F, MACRO, MACRO_KEYS, REPAS } from '../../theme';

type Form = {
  kcal: string; proteines: string; glucides: string; lipides: string; fibres: string;
  unite: 'kcal' | 'pct'; petit_dej: string; dejeuner: string; diner: string; collation: string;
};

export default function Objectifs() {
  const [f, setF] = useState<Form | null>(null);
  const [depuis, setDepuis] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    getObjectifs(isoDate()).then((o) => {
      setDepuis(o.date_debut);
      setF({
        kcal: String(o.kcal), proteines: String(o.proteines_g), glucides: String(o.glucides_g), lipides: String(o.lipides_g),
        fibres: String(o.fibres_g), unite: o.unite_repas, petit_dej: String(o.obj_petit_dej), dejeuner: String(o.obj_dejeuner),
        diner: String(o.obj_diner), collation: String(o.obj_collation),
      });
    });
  }, []);

  if (!f) return <Ecran><Sub>Chargement…</Sub></Ecran>;
  const set = (p: Partial<Form>) => {
    setF({ ...f, ...p });
    setOk(false);
  };
  const kcal = lireNombre(f.kcal);
  const kcalMacro = { proteines: 4, glucides: 4, lipides: 9, fibres: 0 } as const;
  const somMacros = MACRO_KEYS.reduce((s, k) => s + lireNombre(f[k]) * kcalMacro[k], 0);
  const repasVals = REPAS.map((r) => lireNombre(f[r.key]));
  const totalRepas = repasVals.reduce((a, b) => a + b, 0);
  const cibleRepas = f.unite === 'pct' ? 100 : kcal;
  const repasOk = Math.abs(totalRepas - cibleRepas) < (f.unite === 'pct' ? 0.5 : 5);

  const changerUnite = (u: 'kcal' | 'pct') => {
    if (u === f.unite || !kcal) return set({ unite: u });
    const conv = (v: string) => String(Math.round(u === 'pct' ? (lireNombre(v) * 100) / kcal : (lireNombre(v) * kcal) / 100));
    set({ unite: u, petit_dej: conv(f.petit_dej), dejeuner: conv(f.dejeuner), diner: conv(f.diner), collation: conv(f.collation) });
  };

  const enregistrer = async () => {
    await saveObjectifs({
      kcal, proteines_g: lireNombre(f.proteines), glucides_g: lireNombre(f.glucides), lipides_g: lireNombre(f.lipides),
      fibres_g: lireNombre(f.fibres), unite_repas: f.unite, obj_petit_dej: lireNombre(f.petit_dej), obj_dejeuner: lireNombre(f.dejeuner),
      obj_diner: lireNombre(f.diner), obj_collation: lireNombre(f.collation),
    });
    setDepuis(isoDate());
    setOk(true);
  };

  return (
    <Ecran bas={90}>
      <View style={{ paddingHorizontal: 4 }}>
        <Sub style={{ fontFamily: F.bodyBold }}>{depuis ? `En vigueur depuis le ${libelleJour(depuis).toLowerCase()}` : 'Valeurs par défaut'}</Sub>
        <Titre style={{ fontSize: 30 }}>Objectifs</Titre>
      </View>

      <Carte style={{ gap: 9 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.lav, alignItems: 'center', justifyContent: 'center' }}>
            <IcCible couleur="#fff" taille={18} epais={2.2} />
          </View>
          <Titre style={{ fontSize: 18, flex: 1 }}>Journée</Titre>
          <ChampNombre label="Objectif kcal du jour" valeur={f.kcal} onChange={(t) => set({ kcal: t })} unite="kcal" largeur={60} />
        </View>
        {MACRO_KEYS.map((k) => {
          const g = lireNombre(f[k]);
          const kc = g * kcalMacro[k];
          return (
            <View key={k} style={[ui.ligne, { paddingLeft: 8, minHeight: 56 }]}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: MACRO[k].text, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontFamily: F.bodyBold, fontSize: 14 }}>{MACRO[k].lettre}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: F.bodyBold }}>{MACRO[k].nom}</T>
                <Sub>{k === 'fibres' ? 'Objectif minimum' : `${fmt(kc)} kcal · ${kcal ? Math.round((kc * 100) / kcal) : 0} %`}</Sub>
              </View>
              <ChampNombre label={`${MACRO[k].nom} en grammes`} valeur={f[k]} onChange={(t) => set({ [k]: t } as Partial<Form>)} unite="g" largeur={44} />
            </View>
          );
        })}
        <Pastille ok={Math.abs(somMacros - kcal) <= kcal * 0.05} texte={`Les macros font ${fmt(somMacros)} kcal sur ${fmt(kcal)}`} />
      </Carte>

      <Carte style={{ gap: 9 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.peach, alignItems: 'center', justifyContent: 'center' }}>
            <IcRepas.dejeuner couleur="#fff" taille={18} epais={2.2} />
          </View>
          <Titre style={{ fontSize: 18 }}>Par repas</Titre>
        </View>
        <Segment options={[{ k: 'kcal', t: 'kcal fixes' }, { k: 'pct', t: '% du jour' }]} valeur={f.unite} onChange={changerUnite} />
        {REPAS.map((r, i) => (
          <View key={r.key} style={[ui.ligne, { minHeight: 56 }]}>
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: F.bodyBold }}>{r.nom}</T>
              <Sub>{f.unite === 'pct' ? `${fmt((kcal * repasVals[i]) / 100)} kcal` : `${kcal ? Math.round((repasVals[i] * 100) / kcal) : 0} % du jour`}</Sub>
            </View>
            <ChampNombre label={`${r.nom} en ${f.unite === 'pct' ? 'pourcentage' : 'kcal'}`} valeur={f[r.key]} onChange={(t) => set({ [r.key]: t } as Partial<Form>)} unite={f.unite === 'pct' ? '%' : 'kcal'} largeur={48} />
          </View>
        ))}
        <Pastille
          ok={repasOk}
          texte={f.unite === 'pct' ? `Total ${fmt(totalRepas)} %${repasOk ? '' : ' : il faut 100 %'}` : `Total ${fmt(totalRepas)} kcal sur ${fmt(kcal)}`}
        />
      </Carte>

      <Bouton titre={ok ? 'Enregistré ✓' : 'Enregistrer'} onPress={enregistrer} disabled={!kcal} />
      <Sub style={{ textAlign: 'center' }}>Un changement s’applique à partir d’aujourd’hui ; les jours passés gardent leurs objectifs.</Sub>
    </Ecran>
  );
}

function Pastille({ ok, texte }: { ok: boolean; texte: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 3, backgroundColor: ok ? C.okBg : C.warnBg }}>
      <Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: ok ? C.okText : C.warnText }}>{texte}</Text>
    </View>
  );
}
