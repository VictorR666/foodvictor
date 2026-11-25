# Foodvictor

Journal alimentaire perso pour Android : calories, protéines, glucides, lipides et fibres, à partir d'Open Food Facts et de tes propres aliments. Scan de code-barres, grammages favoris, objectifs par jour et par repas, sauvegarde automatique dans Google Sheets, export CSV / JSON.

Pas de compte, pas de pub : tout est stocké sur le téléphone (SQLite) et recopié dans ta Google Sheet.

## 1. Installer sur ton téléphone

Foodvictor est d'abord une **web app**, comme le dashboard Maison : rien à installer depuis un store, mises à jour automatiques.

**Mise en ligne (une fois)**
1. Le dépôt GitHub doit s'appeler `foodvictor` (l'app est servie sous `/foodvictor/`) et être public (GitHub Pages gratuit).
2. Dépôt › **Settings › Pages › Source : GitHub Actions**.
3. À chaque modification poussée sur `main`, `.github/workflows/web.yml` construit et publie l'app sur `https://<ton-compte>.github.io/foodvictor/` (2 à 3 minutes).

**Sur le téléphone**
1. Ouvre l'adresse dans **Chrome**.
2. Menu ⋮ › **Ajouter à l'écran d'accueil** (ou « Installer l'application »).
3. Au premier scan, autorise la caméra.

Les mises à jour arrivent toutes seules : il suffit de rouvrir l'app (réseau d'abord, cache hors ligne sinon).

**Plus tard : la version Android native.** Le même code produit une app Android avec un scan natif plus fluide ; sa construction sera ajoutée quand la web app sera stabilisée (la clé de signature ne sera jamais stockée dans ce dépôt public).

**Pour développer sur ordinateur (facultatif)** : `npm install` puis `npx expo start --web`.

### Notes techniques web
- La base SQLite du navigateur a besoin des en-têtes COOP/COEP. GitHub Pages ne permet pas de les régler, donc `public/sw.js` (service worker) les ajoute ; à la toute première visite, la page se recharge une fois.
- Un navigateur n'autorise pas à changer le User-Agent : sur le web, les requêtes Open Food Facts partent sans. Toutes les autres règles anti-blocage s'appliquent.

## 2. Brancher la sauvegarde Google Sheets

1. Crée une Google Sheet vide, par exemple « Foodvictor · Journal ».
2. **Extensions › Apps Script**, colle le contenu de `apps-script/Code.gs`.
3. Remplace `SECRET` par une longue phrase que toi seul connais.
4. Sélectionne la fonction `installer` et clique ▶ (accepte les autorisations) : les onglets `aliments`, `portions`, `entrees`, `objectifs` et `jours` sont créés.
5. **Déployer › Nouveau déploiement › Application Web** : « Exécuter en tant que : moi », « Qui a accès : Tout le monde ». Copie l'URL qui finit par `/exec`.
6. Dans l'app, onglet **Sauvegarde › Réglages de la feuille** : colle l'URL, la clé secrète et ton email, puis « Enregistrer et synchroniser ».

Ensuite, chaque ajout, modification ou suppression part dans la feuille quelques secondes plus tard (ou dès que le réseau revient). L'onglet `jours` calcule tout seul les totaux par jour. Une suppression coche la colonne `supprime` au lieu d'effacer la ligne.

Changement de téléphone : installe l'app, remets l'URL et la clé, puis **Restaurer depuis Google Sheets**.

Si tu modifies le script plus tard : **Déployer › Gérer les déploiements › Modifier › Nouvelle version**, sinon l'ancienne version reste en ligne.

## 3. Comment l'app ménage Open Food Facts

Pour ne jamais se faire bloquer (`src/lib/off.ts`) :

- chaque requête s'identifie (`Foodvictor/1.0.0 (ton email)`) ;
- quotas locaux sous ceux d'Open Food Facts : 12 lectures produit et 8 recherches par minute au maximum (limites officielles : 15 et 10) ;
- un scan = au plus un appel : la caméra est verrouillée dès la première lecture et le même code est ignoré pendant 5 s ;
- un produit déjà scanné est lu dans la base locale, sans réseau ;
- la recherche dans la barre ne fouille que tes aliments ; Open Food Facts n'est interrogé que par le bouton « Chercher sur Open Food Facts » ;
- réessais limités (3) avec délai croissant, uniquement sur erreur réseau, 429 ou 5xx ;
- jamais de rafraîchissement en masse du cache.

Un serveur de test (`world.openfoodfacts.net`) peut être activé dans Sauvegarde › Avancé pour développer.

Les données Open Food Facts sont sous licence ODbL : <https://world.openfoodfacts.org>.

## 4. Organisation du code

```
src/
  app/                 écrans (Expo Router)
    (tabs)/            Journal, Progrès, Objectifs, Sauvegarde + barre avec le bouton de scan
    repas/[repas].tsx  détail d'un repas
    ajout.tsx          ajout d'aliments (récents, favoris, recherche, panier)
    aliment/[id].tsx   fiche aliment : quantité, grammages perso, macros
    scan.tsx           lecteur de code-barres
    creer.tsx          créer / modifier un aliment perso
    rapide.tsx         saisie rapide de kcal
  db/                  schéma SQLite et requêtes
  lib/                 Open Food Facts, synchro Sheets, exports, dates
  components/ui.tsx    composants et icônes (style Dashboard Maison)
  theme.ts             couleurs, une couleur par macro
apps-script/Code.gs    script de sauvegarde Google Sheets
```

Commandes utiles : `npm run typecheck`, `npx expo start`.
