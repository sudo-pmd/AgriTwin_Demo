# Déployer AgriTwin sur Vercel

Guide pas-à-pas, de l'import du dépôt à la vérification en production. Les deux sites sont des SPA Vite sans back-end : le déploiement ne nécessite **aucune variable d'environnement, aucune base de données et aucun secret**.

> Le fichier `vercel.json` est déjà présent à la racine. Il construit le **site public « Le champ virtuel »** (`demo/`, sortie `dist-demo/`) : c'est le site destiné à l'URL publique. Les étapes ci-dessous n'ont donc rien à recréer.

---

## 0. Deux sites dans le dépôt

| Site | Commande | Sortie | Déploiement |
|---|---|---|---|
| Site public « Le champ virtuel » (`demo/`) | `npm run build:demo` | `dist-demo/` | Projet Vercel par défaut, à la racine du domaine |
| Application AgriTwin (exploitant, banque, conformité) | `npm run build` | `dist/` | Second projet Vercel, mêmes réglages surchargés dans le tableau de bord |

Pour le site public : importer le dépôt et déployer, sans rien changer (voir §3).

Pour l'application métier, créer un **second projet** sur le même dépôt et surcharger dans **Settings → Build and Deployment** :

- **Build Command** : `npm run build`
- **Output Directory** : `dist`

Les en-têtes et le cache de `vercel.json` restent appliqués ; l'application n'utilise pas de route serveur, donc aucune autre configuration n'est nécessaire.

---

## 1. Prérequis

- Un compte Vercel (offre Hobby gratuite suffisante pour une démonstration).
- Le projet poussé sur un dépôt GitHub, GitLab ou Bitbucket.
- Localement : Node.js 20 ou plus récent et npm (uniquement pour vérifier le build avant de déployer).
- Le fichier `package-lock.json` doit être versionné : Vercel s'en sert pour un `npm ci` reproductible.

Vérification locale avant tout déploiement :

```bash
npm ci
npm run typecheck:demo
npm run build:demo
```

Le build doit produire un dossier `dist-demo/` contenant `index.html`, `assets/` et `agritwin-logo.webp`. Si `dist-demo/` est créé, le déploiement a de bonnes chances d'aboutir.

Pour l'application métier, remplacer par `npm run typecheck && npm run build` (sortie `dist/`).

---

## 2. Ce que fait `vercel.json`

```json
{
  "framework": "vite",
  "installCommand": "npm ci",
  "buildCommand": "npm run build:demo",
  "outputDirectory": "dist-demo",
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/(.*).webp",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=604800" }]
    },
    {
      "source": "/",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), fullscreen=(self)" }
      ]
    }
  ]
}
```

- **Aucune réécriture** : le site public n'a qu'une seule page (les sections sont des ancres `#champ`, `#projet`). Une URL inconnue renvoie donc une 404 honnête plutôt que la page d'accueil.
- **`headers`** : les fichiers dont le nom contient un hash de build sont mis en cache un an ; `index.html` est revalidé à chaque visite, ce qui permet de récupérer le nouveau bundle immédiatement après un déploiement.
- **`installCommand`** : `npm ci` à la racine, puisque `demo/` consomme le `node_modules` du dépôt (le lockfile est versionné).
- **`vercel-build`** : le script `package.json` fait la même chose que `buildCommand`, utile si la commande est surchargée par erreur dans le tableau de bord.

---

## 3. Déploiement par l'interface Vercel (recommandé)

1. Se connecter à <https://vercel.com> puis **Add New… → Project**.
2. **Import Git Repository** : autoriser Vercel à lire le dépôt si nécessaire, puis **Import** sur le bon dépôt.
3. Dans l'écran de configuration :
   - **Project Name** : `agritwin` (ou le nom souhaité ; il détermine l'URL `*.vercel.app`).
   - **Framework Preset** : `Vite` (détecté automatiquement).
   - **Root Directory** : `.` — laisser vide si le projet est à la racine du dépôt ; sinon indiquer le sous-dossier qui contient `package.json`.
   - **Build and Output Settings** : laisser « Override » désactivé. `vercel.json` fournit déjà `npm run build` et `dist`.
   - **Environment Variables** : **aucune**. Ne pas en créer.
   - **Node.js Version** : `20.x` (Settings → General → Node.js Version si besoin).
4. Cliquer **Deploy**. Le premier build prend généralement une à deux minutes (installation des dépendances puis compilation Vite).
5. À la fin, Vercel affiche l'URL de production du type `https://agritwin.vercel.app`.

### Ce qui se passe pendant le build

- `npm ci` installe les dépendances exactes du `package-lock.json` ;
- `npm run build:demo` compile le site public avec Vite ; three.js est isolé dans son propre chunk, ce qui garde le bundle applicatif léger et met le moteur 3D en cache d'un déploiement à l'autre ;
- Vercel publie `dist-demo/` sur son CDN et attribue un certificat HTTPS automatique.

Un avertissement « some chunks are larger than 900 kB » peut apparaître : il est informatif, pas bloquant (three.js représente l'essentiel du poids).

---

## 4. Déploiement par la CLI (alternative)

Utile pour déployer sans passer par l'interface, ou depuis une machine sans accès au dépôt.

```bash
npm install -g vercel
vercel login
```

Puis, depuis la racine du projet :

```bash
vercel          # déploiement de prévisualisation, URL unique
vercel --prod   # déploiement de production
```

La CLI détecte Vite, lit `vercel.json`, construit le projet et envoie `dist/`. Le dossier `.vercel/` créé localement est déjà ignoré par `.gitignore` : ne pas le versionner.

Pour lier explicitement le dossier à un projet existant :

```bash
vercel link
```

---

## 5. Domaines personnalisés et HTTPS

1. Vercel → projet → **Settings → Domains → Add**.
2. Saisir le domaine (ex. `agritwin.sn` ou `app.agritwin.sn`).
3. Vercel indique l'enregistrement DNS à créer :
   - sous-domaine : `CNAME` vers `cname.vercel-dns.com` ;
   - domaine racine : `A` vers l'adresse fournie, ou délégation des serveurs de noms à Vercel.
4. Attendre la propagation DNS (quelques minutes à quelques heures). Le certificat TLS est émis automatiquement.
5. Choisir le domaine principal dans **Settings → Domains** ; les autres redirigent vers lui.

HTTPS n'est pas optionnel : sans lui, `crypto.subtle` (signature SHA-256 des relevés), IndexedDB et la synthèse vocale peuvent être bloqués par le navigateur.

---

## 6. Prévisualisations, production et retours arrière

- Chaque **pull request** ou branche pousse automatiquement un *Preview Deployment* avec sa propre URL. Idéal pour faire relire une évolution avant la soutenance.
- La branche de production (par défaut `main`) déclenche le déploiement de production.
- **Rollback** : onglet **Deployments** → choisir un déploiement antérieur → menu `⋯` → **Promote to Production** (ou **Rollback**). Le retour est immédiat, sans reconstruire.
- Les URLs de prévisualisation sont publiques par défaut ; ne pas y déposer de données sensibles. Ici, les données saisies restent dans le navigateur du visiteur, pas sur Vercel.

---

## 7. Vérifications après le premier déploiement

À faire sur l'URL publique, dans un navigateur, pas seulement en local :

Site public « Le champ virtuel » :

| Contrôle | Attendu |
|---|---|
| Accueil | Champ 3D visible, menu « Survol / Marche / Son / Aide » lisible, aucune erreur console |
| Visite | « Commencer la visite » passe en marche, souris capturée, ZQSD fonctionnels |
| Rechargement | La page revient sur l'accueil (pas de 404, pas d'asset manquant) |
| Mobile | À 375 px, le menu se réduit en icônes et ne déborde pas |
| WebGL absent | Un message clair remplace la scène, sans page blanche |

Application AgriTwin (second projet) :

| Contrôle | Attendu |
|---|---|
| Page d'accueil | Écran de connexion AgriTwin, logo visible, aucune erreur console |
| Connexion démo | Bouton « Entrer » d'un compte de démonstration → tableau de bord |
| Rechargement | Rafraîchir la page reste sur l'application (réécriture SPA) |
| Lien direct | Ouvrir une URL inconnue (`/xyz`) affiche l'application, pas une 404 |
| Carte | Tuiles satellite Esri visibles |
| Pièces | Déposer un PDF, un JPG et un PNG ; les formats sont acceptés |
| PDF bancaire | Téléchargement du dossier de crédit |
| Archive | Téléchargement du `.zip`, ouverture de `verifier.html` en local |
| Mobile | À 375 px, le sélecteur de parcelle occupe sa propre rangée et ne déborde pas |
| HTTPS | Cadenas présent, aucune alerte de contenu mixte |

Tester également en **navigation privée** : IndexedDB y est parfois restreint, ce qui est une limite du navigateur et non du déploiement.

---

## 8. Durcissement facultatif des en-têtes

Pour ajouter une politique de cache explicite sur `index.html` et quelques en-têtes de sécurité, compléter le tableau `headers` de `vercel.json` :

```json
{
  "source": "/index.html",
  "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }]
},
{
  "source": "/(.*)",
  "headers": [
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
    { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(self)" }
  ]
}
```

Une CSP stricte demanderait d'autoriser `https://server.arcgisonline.com` (tuiles), `data:`/`blob:` (Leaflet, PDF, ZIP) et les styles en ligne de Leaflet/Recharts. La mettre en place seulement après avoir vérifié la carte et les exports sur une preview.

---

## 9. Problèmes fréquents

| Symptôme | Cause probable | Correction |
|---|---|---|
| 404 au rechargement d'une page | Réécriture absente ou `vercel.json` non pris en compte | Vérifier la section `rewrites`, redéployer |
| Page blanche, assets en 404 | Projet déployé dans un sous-chemin, ou mauvais **Root Directory** | Servir à la racine ; corriger le dossier racine |
| Ancienne version affichée après déploiement | `index.html` mis en cache | Ajouter l'en-tête `Cache-Control: max-age=0, must-revalidate` |
| Build échoue sur TypeScript | Erreur de typage | Lancer `npm run typecheck` localement et corriger avant de pousser |
| `vite: not found` | Dépendances non installées ou `node_modules` envoyé sans `package-lock.json` | Versionner `package-lock.json`, laisser Vercel exécuter `npm ci` |
| Version de Node refusée | Version par défaut différente | Settings → General → Node.js Version → `20.x` |
| Téléchargements PDF/ZIP bloqués | Réglage du navigateur ou extension | Tester en navigation normale, autoriser les téléchargements |
| Carte vide, tuiles bloquées | Réseau ou blocage du domaine Esri | Vérifier la console ; la carte reste utilisable sans imagerie |
| « crypto.subtle is undefined » | Site servi en HTTP | Utiliser l'URL HTTPS de Vercel |
| Données absentes d'un appareil à l'autre | Stockage local par navigateur, comportement voulu | Aucun correctif côté Vercel ; prévoir un back-end |

---

## 10. Coûts et limites de la plateforme

- L'offre Hobby est gratuite pour un usage de démonstration, avec des quotas de bande passante et de builds ; les valeurs exactes évoluent, à vérifier sur la page tarifs de Vercel.
- Un projet statique ne consomme ni fonction serverless ni base de données : le coût reste marginal même avec plusieurs centaines de visiteurs.
- Les déploiements de prévisualisation sont illimités en pratique, mais chacun consomme un build.
- Aucune sauvegarde de données utilisateur n'est à prévoir côté Vercel : tout est dans le navigateur du visiteur. Les exports `.zip` sont la seule copie durable.

---

## 11. Résumé express

1. `npm ci && npm run typecheck && npm run build` en local.
2. Pousser sur Git.
3. Vercel → **Add New → Project** → importer le dépôt → laisser Vite et `vercel.json` faire le reste → **Deploy**.
4. Aucune variable d'environnement.
5. Ajouter le domaine, vérifier HTTPS.
6. Tester connexion, rechargement, carte, import de pièces, PDF, ZIP et affichage 375 px.
