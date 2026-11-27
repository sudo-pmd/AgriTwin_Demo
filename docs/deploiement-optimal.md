# Déploiement optimal d'AgriTwin

Ce document décrit la cible de déploiement recommandée pour ce projet, les arbitrages techniques qui la justifient et les points de vigilance. Les instructions pas-à-pas pour Vercel sont dans [`deploiement-vercel.md`](./deploiement-vercel.md).

---

## 1. Nature de l'application, donc de l'hébergement

AgriTwin est une **application monopage (SPA) entièrement statique** :

- React 18 + TypeScript, compilée par Vite en HTML/CSS/JS ;
- aucune requête vers une API métier : les comptes, les parcelles, les pièces et les relevés vivent dans le navigateur (`localStorage` + IndexedDB) ;
- les seules requêtes sortantes sont les **tuiles satellite Esri** de la carte (affichage) ;
- les calculs lourds (SHA-256, PDF, ZIP) s'exécutent côté client.

Conséquence : **aucun serveur Node, aucune base de données, aucune variable d'environnement n'est nécessaire**. Le bon déploiement est un hébergement de fichiers statiques derrière un CDN, en HTTPS.

Ce que cela implique aussi : les données ne sont **pas partagées entre appareils**. Un déploiement public ne crée pas de comptes serveur ; chaque navigateur a son propre registre local. Toute évolution vers un vrai partage banque/exploitant exigera un back-end (voir §8).

---

## 2. Architecture cible recommandée

```
Navigateur
   │  HTTPS
   ▼
CDN / hébergeur statique  ──►  dist/ (index.html + assets hashés + logo + audio)
   │
   ├── tuiles satellite Esri (affichage cartographique)
   └── stockage local du navigateur (localStorage + IndexedDB)
```

Recommandation par défaut : **Vercel** (ou Cloudflare Pages / Netlify), car :

- build Vite détecté automatiquement ;
- CDN mondial et HTTPS gratuit ;
- *preview deployments* par branche, utiles pour une soutenance ou une revue ;
- en-têtes HTTP et réécritures SPA configurables par fichier (`vercel.json`) ;
- aucun coût tant que le trafic reste dans l'offre gratuite.

Alternatives valables :

| Plateforme | Atout | À savoir |
|---|---|---|
| **Cloudflare Pages** | CDN très rapide en Afrique de l'Ouest, offre gratuite large | Réécriture SPA via `_redirects` |
| **Netlify** | Simplicité, formulaires et previews | `_redirects` ou `netlify.toml` |
| **GitHub Pages** | Gratuit, intégré au dépôt | Pas de réécriture SPA native ; chemin de base à adapter ; HTTPS via le domaine `github.io` |
| **S3 + CloudFront** | Contrôle total, coût maîtrisé | Configuration manuelle (réécriture, invalidation, TLS) |

À éviter pour ce projet : un hébergement Node mutualisé classique (cPanel, VPS) sans CDN. Rien ne l'exige, et le temps de réponse en Afrique de l'Ouest serait moins bon qu'avec un CDN.

---

## 3. Build de production

Le build produit un dossier `dist/` autonome :

- `index.html` (point d'entrée, références absolues `/assets/...`) ;
- `assets/index-<hash>.js` et `.css` (noms hachés → cache long) ;
- `agritwin-logo.webp` et `fonts/` (fichiers publics copiés tels quels).

Points structurants :

1. **Pas de `base` personnalisée** : l'application est prévue pour être servie à la racine du domaine. Servir dans un sous-chemin (`/agritwin/`) demanderait de définir `base` dans `vite.config.ts` et de vérifier les chemins du logo et des tuiles.
2. **Réécriture SPA obligatoire** : l'application n'utilise pas de routeur, mais une réécriture de toutes les routes vers `index.html` évite les 404 si une URL profonde est partagée ou rechargée un jour.
3. **Cache différencié** : les fichiers `assets/*` peuvent être mis en cache un an (leur nom change à chaque build) ; `index.html` doit rester non mis en cache, sinon un ancien bundle continue d'être servi après déploiement.
4. **Compression** : laisser le CDN servir Brotli/Gzip (Vercel, Cloudflare et Netlify le font automatiquement).
5. **Poids** : le bundle principal dépasse 1,4 Mo (Leaflet, Turf, Recharts, jsPDF). C'est acceptable pour une démonstration, mais un découpage par route (`React.lazy`) et le chargement différé de `jspdf`/`html2canvas` amélioreraient nettement le premier affichage.

---

## 4. En-têtes HTTP recommandés

Le fichier `vercel.json` du dépôt définit déjà :

- `framework: vite`, `buildCommand: npm run build`, `outputDirectory: dist` ;
- la réécriture `/(.*)` → `/index.html` ;
- un cache immuable d'un an pour `/assets/*` et `/fonts/*`.

Compléments utiles pour la production :

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(self)" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }
      ]
    },
    {
      "source": "/index.html",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }]
    }
  ]
}
```

Une **Content-Security-Policy** stricte est souhaitable mais demande d'autoriser explicitement :

- `https://server.arcgisonline.com` (tuiles de la carte) et les images `data:`/`blob:` de Leaflet ;
- `'unsafe-inline'` pour les styles injectés par Leaflet et Recharts (ou des nonces, impossibles sans serveur) ;
- `blob:` pour les téléchargements PDF/ZIP générés côté client.

Sans back-end, ces en-têtes se posent dans la configuration de l'hébergeur, pas dans le code.

---

## 5. Nom de domaine, HTTPS et géographie

- Un domaine propre (ex. `agritwin.sn`) évite de dépendre du domaine de l'hébergeur et rassure un jury ou un partenaire.
- HTTPS est **obligatoire en pratique** : `crypto.subtle` (signature SHA-256), le presse-papiers, la synthèse vocale et IndexedDB sont plus restrictifs en HTTP. Les plateformes recommandées fournissent un certificat automatique.
- Pour un public majoritairement sénégalais, un CDN avec présence en Afrique de l'Ouest (Cloudflare, Vercel Edge) réduit la latence. Les tuiles Esri restent le principal poste de latence ressenti sur la carte.
- Prévoir une page de secours ou un message si les tuiles satellite ne se chargent pas : la carte reste fonctionnelle, mais l'imagerie est un service tiers.

---

## 6. Intégration et livraison continues

Chaîne recommandée :

1. dépôt Git (GitHub/GitLab) avec `package-lock.json` versionné ;
2. build reproductible via `npm ci` puis `npm run build` ;
3. vérifications avant déploiement : `npm run typecheck` et `npm run build` ;
4. déploiement automatique de la branche principale en production, et de chaque branche/PR en **preview** ;
5. conservation des artefacts de build et des journaux de déploiement pour la traçabilité.

Un pipeline minimal (GitHub Actions) peut se limiter à `npm ci`, `npm run typecheck`, `npm run build`. Il n'y a **aucun secret à injecter** : ne pas créer de variables d'environnement inutiles, elles donneraient une fausse impression de configuration requise.

---

## 7. Vérification après mise en ligne

À contrôler sur l'URL publique, pas seulement en local :

- la page d'accueil s'affiche et le logo se charge ;
- une connexion avec un compte de démonstration fonctionne ;
- un rechargement direct d'une URL profonde renvoie bien l'application (réécriture SPA) ;
- la carte affiche les tuiles Esri ;
- l'import d'une pièce (PDF/JPG/PNG) fonctionne, y compris un PDF précédé d'octets parasites ;
- l'export PDF et l'archive `.zip` se téléchargent, et `verifier.html` s'ouvre en `file://` ;
- le changement de parcelle reste utilisable à 375 px et à 320 px ;
- la console ne montre ni erreur de chargement de module ni blocage CSP.

---

## 8. Limites d'un déploiement purement statique

| Limite | Conséquence | Évolution nécessaire |
|---|---|---|
| Données par navigateur | Un dossier créé sur un téléphone n'existe pas sur l'ordinateur de la banque | API + base de données + authentification serveur |
| Effacement du stockage | Vider les données du navigateur détruit déclarations et pièces | Sauvegarde serveur, exports réguliers |
| Quotas navigateur | 60 Mo de pièces par appareil, IndexedDB peut être purgé | Stockage objet (S3/R2) |
| Rôles non sécurisés | Les comptes et mots de passe sont locaux, donc non opposables | Authentification serveur (OIDC), contrôle d'accès |
| Signature SHA-256 locale | Prouve l'absence de réécriture locale, pas l'origine de la mesure | Horodatage serveur, signature matérielle, ancrage externe |
| Pas de notifications | Alertes visibles seulement à l'ouverture | Files d'attente, e-mail/SMS, tâches planifiées |

Ces limites sont assumées et documentées dans l'application (page « Méthodologie & limites ») ; le déploiement ne doit pas laisser croire à un service bancaire opérationnel.

---

## 9. Coûts et exploitation

- **Hébergement** : offre gratuite suffisante pour une démonstration et un jury ; prévoir un plan payant si le trafic ou les previews se multiplient.
- **Tuiles Esri** : usage de démonstration ; une exploitation commerciale doit vérifier les conditions d'utilisation ou basculer vers un fournisseur de tuiles licencié.
- **Maintenance** : aucune dépendance serveur à surveiller ; en revanche, les bibliothèques (Leaflet, jsPDF, Turf) doivent être mises à jour pour les correctifs de sécurité.
- **Sauvegarde** : rien à sauvegarder côté serveur, mais les exports `.zip` produits par les utilisateurs sont la seule copie durable de leurs dossiers.

---

## 10. Résumé de la cible

| Élément | Choix |
|---|---|
| Type d'hébergement | Statique + CDN |
| Plateforme recommandée | Vercel |
| Build | `npm ci && npm run build` → `dist/` |
| Réécriture | Toutes les routes → `index.html` |
| Cache | `assets/*` immuable 1 an ; `index.html` revalidé |
| HTTPS | Obligatoire (Web Crypto, IndexedDB, micro) |
| Variables d'environnement | Aucune |
| Back-end | Aucun pour le démonstrateur ; requis pour un usage multi-appareils |
| Surveillance | Journaux de build + vérification manuelle post-déploiement |
