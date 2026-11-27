import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Switch, Text, View } from 'react-native';
import { alerte, confirmer } from '../../lib/dialogue';
import {
  Bouton, Carte, Champ, Ecran, IcCheck, IcRepas, IcSync, Lab, Segment, Sub, T, Titre, s as ui,
} from '../../components/ui';
import { getReglage, setReglage, toutRemettreEnFile } from '../../db/repo';
import { heure, isoDate, libelleJour } from '../../lib/date';
import { exporterCsvDetaille, exporterCsvResume, exporterJson, importerJson, Periode } from '../../lib/export';
import { EtatSync, restaurerDepuisSheets, surEtatSync, synchroniser } from '../../lib/sync';
import { C, F } from '../../theme';
import { CIQUAL_INFO } from '../../lib/ciqual';

export default function Sauvegarde() {
  const [etat, setEtat] = useState<EtatSync>();
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [email, setEmail] = useState('');
  const [staging, setStaging] = useState(false);
  const [configOuverte, setConfigOuverte] = useState(false);
  const [periode, setPeriode] = useState<'7' | '30' | 'tout'>('30');
  const [format, setFormat] = useState<'std' | 'fr'>('fr');
  const [occupe, setOccupe] = useState<string | null>(null);

  useEffect(() => surEtatSync(setEtat), []);
  useEffect(() => {
    (async () => {
      setUrl((await getReglage('sheets_url')) ?? '');
      setSecret((await getReglage('sheets_secret')) ?? '');
      setEmail((await getReglage('contact_email')) ?? '');
      setStaging((await getReglage('off_staging')) === '1');
      if (!(await getReglage('sheets_url'))) setConfigOuverte(true);
    })();
  }, []);

  const tache = async (nom: string, f: () => Promise<unknown>) => {
    setOccupe(nom);
    try {
      await f();
    } catch (e) {
      alerte('Oups', e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(null);
    }
  };

  const enregistrerConfig = () =>
    tache('config', async () => {
      const premiere = !(await getReglage('sheets_url'));
      await setReglage('sheets_url', url.trim());
      await setReglage('sheets_secret', secret.trim());
      await setReglage('contact_email', email.trim());
      if (premiere) await toutRemettreEnFile(); // première connexion : on envoie tout l'historique
      setConfigOuverte(false);
      await synchroniser();
    });

  const p: Periode = periode === 'tout' ? 'tout' : (Number(periode) as 7 | 30);
  const statut = !etat || etat.etat === 'non_configure'
    ? { bg: C.warnBg, fg: C.warnText, titre: 'Sauvegarde non configurée', sous: 'Relie l’app à ta Google Sheet ci-dessous.' }
    : etat.etat === 'erreur'
      ? { bg: C.errBg, fg: C.errText, titre: 'Dernière sauvegarde en échec', sous: etat.message ?? '' }
      : etat.etat === 'en_cours'
        ? { bg: C.lavSoft, fg: C.lavText, titre: 'Sauvegarde en cours…', sous: '' }
        : {
          bg: C.okBg, fg: C.okText, titre: etat.enAttente ? 'Sauvegarde en attente' : 'Tout est sauvegardé',
          sous: etat.derniere
            ? `${etat.derniere.slice(0, 10) === isoDate() ? 'Aujourd’hui' : libelleJour(etat.derniere.slice(0, 10))} à ${heure(etat.derniere)} · ${etat.enAttente} changement${etat.enAttente > 1 ? 's' : ''} en attente`
            : '',
        };

  return (
    <Ecran bas={90}>
      <View style={{ paddingHorizontal: 4 }}>
        <Sub style={{ fontFamily: F.bodyBold }}>Google Sheets et export</Sub>
        <Titre style={{ fontSize: 30 }}>Sauvegarde</Titre>
      </View>

      <Carte>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: statut.bg }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: statut.fg, alignItems: 'center', justifyContent: 'center' }}>
            {etat?.etat === 'en_cours' ? <ActivityIndicator color="#fff" /> : etat?.etat === 'ok' && !etat.enAttente ? <IcCheck couleur="#fff" /> : <IcSync couleur="#fff" taille={19} />}
          </View>
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: F.bodyBold }}>{statut.titre}</T>
            {statut.sous ? <Text style={{ fontFamily: F.body, fontSize: 12.5, color: statut.fg }}>{statut.sous}</Text> : null}
          </View>
        </View>
        {etat?.scriptAncien ? (
          <View style={{ padding: 12, borderRadius: 18, backgroundColor: C.warnBg, gap: 4 }}>
            <T style={{ fontFamily: F.bodyBold, color: C.warnText }}>Mets à jour le script Google</T>
            <Text style={{ fontFamily: F.body, fontSize: 12.5, color: C.warnText }}>
              Tes repas favoris attendent d’être sauvegardés. Recopie la nouvelle version de Code.gs dans Apps Script, puis
              Déployer › Gérer les déploiements › Modifier › Nouvelle version. Ils partiront tout seuls ensuite.
            </Text>
          </View>
        ) : null}
        {etat?.etat !== 'non_configure' ? (
          <Bouton titre="Synchroniser maintenant" onPress={() => synchroniser()} disabled={etat?.etat === 'en_cours'} />
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => setConfigOuverte((v) => !v)} style={[ui.ligne, { minHeight: 52 }]}>
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: F.bodyBold }}>Réglages de la feuille</T>
            <Sub numberOfLines={1}>{url ? url.replace(/^https:\/\//, '') : 'Adresse du script et clé secrète'}</Sub>
          </View>
          <Text style={{ fontFamily: F.bodyBold, color: C.lavText, paddingRight: 8 }}>{configOuverte ? 'Fermer' : 'Modifier'}</Text>
        </Pressable>
        {configOuverte ? (
          <View style={{ gap: 10 }}>
            <Sub>Installe le script du dossier apps-script (voir le README), puis colle ici son adresse /exec et la clé choisie.</Sub>
            <Champ label="Adresse du script" value={url} onChangeText={setUrl} placeholder="https://script.google.com/macros/s/…/exec" autoCapitalize="none" autoCorrect={false} />
            <Champ label="Clé secrète" value={secret} onChangeText={setSecret} secureTextEntry autoCapitalize="none" autoCorrect={false} />
            {Platform.OS !== 'web' ? (
              <Champ label="Ton email (envoyé à Open Food Facts pour identifier l’app)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            ) : null}
            <Bouton titre={occupe === 'config' ? '…' : 'Enregistrer et synchroniser'} onPress={enregistrerConfig} disabled={!url.trim() || !secret.trim()} />
          </View>
        ) : null}
      </Carte>

      <Carte>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.peach, alignItems: 'center', justifyContent: 'center' }}>
            <IcRepas.dejeuner couleur="#fff" taille={18} epais={2.2} />
          </View>
          <Titre style={{ fontSize: 18 }}>Export ponctuel</Titre>
        </View>
        <Segment options={[{ k: '7', t: '7 jours' }, { k: '30', t: '30 jours' }, { k: 'tout', t: 'Tout' }]} valeur={periode} onChange={setPeriode} />
        <Segment options={[{ k: 'fr', t: 'Excel français (;)' }, { k: 'std', t: 'Standard (,)' }]} valeur={format} onChange={setFormat} />
        <LigneExport titre="CSV détaillé" sous="Une ligne par aliment mangé" occupe={occupe === 'det'} onPress={() => tache('det', () => exporterCsvDetaille(p, format === 'fr'))} />
        <LigneExport titre="CSV résumé" sous="Une ligne par jour, avec objectifs" occupe={occupe === 'res'} onPress={() => tache('res', () => exporterCsvResume(p, format === 'fr'))} />
        <LigneExport titre="Sauvegarde JSON" sous="Tout, réimportable" occupe={occupe === 'json'} onPress={() => tache('json', exporterJson)} />
      </Carte>

      <Carte>
        <Titre style={{ fontSize: 18 }}>Restauration</Titre>
        <Sub>Nouveau téléphone ou réinstallation : l’app se reconstruit à partir de ta feuille ou d’un fichier JSON.</Sub>
        <Bouton
          variante="doux"
          titre={occupe === 'restore' ? '…' : 'Restaurer depuis Google Sheets'}
          onPress={async () => {
            const ok = await confirmer('Restaurer ?', 'Les données de la feuille seront fusionnées avec celles du téléphone (la version la plus récente de chaque ligne gagne).', 'Restaurer');
            if (ok) tache('restore', async () => alerte('Restauré', `${await restaurerDepuisSheets()} lignes récupérées.`));
          }}
        />
        <Bouton
          variante="doux"
          titre={occupe === 'import' ? '…' : 'Importer un fichier JSON'}
          onPress={() => tache('import', async () => {
            const n = await importerJson();
            if (n) alerte('Importé', `${n} lignes récupérées.`);
          })}
        />
      </Carte>

      <Carte style={{ gap: 6 }}>
        <Lab>Sources des données</Lab>
        <Sub>
          Aliments génériques : table Ciqual de l’Anses ({CIQUAL_INFO.nombre} aliments, {CIQUAL_INFO.fichier.replace(/\.xlsx?$/, '')}), mise à jour automatique chaque mois.
          Produits de marque : Open Food Facts (licence ODbL).
        </Sub>
      </Carte>

      <Carte style={{ gap: 6 }}>
        <Lab>Avancé</Lab>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: F.bodyBold }}>Serveur de test Open Food Facts</T>
            <Sub>Pour développer sans toucher la vraie base. À laisser désactivé au quotidien.</Sub>
          </View>
          <Switch
            value={staging}
            onValueChange={async (v) => {
              setStaging(v);
              await setReglage('off_staging', v ? '1' : '0');
            }}
            trackColor={{ true: C.lav, false: C.lavSoft }}
            thumbColor="#fff"
          />
        </View>
      </Carte>
    </Ecran>
  );
}

function LigneExport({ titre, sous, onPress, occupe }: { titre: string; sous: string; onPress: () => void; occupe: boolean }) {
  return (
    <View style={[ui.ligne, { minHeight: 56 }]}>
      <View style={{ flex: 1 }}>
        <T style={{ fontFamily: F.bodyBold }}>{titre}</T>
        <Sub>{sous}</Sub>
      </View>
      <Bouton petit variante="blanc" titre={occupe ? '…' : 'Partager'} onPress={onPress} disabled={occupe} />
    </View>
  );
}
