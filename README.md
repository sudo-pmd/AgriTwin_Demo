# AgriTwin — jumeau numérique de parcelle & Score Vert

AgriTwin est un démonstrateur fonctionnel d'application agricole pour l'accès au financement rural au Sénégal. Il transforme les relevés d'un boîtier scellé, les observations satellite et les pièces d'un dossier en un **Score Vert** opposable, consultable par un exploitant, une institution financière et un agent de conformité.

Le projet est une **application monopage React/TypeScript** : elle ne dépend d'aucune API métier, d'aucune clé payante et d'aucune base de données distante. Les comptes, parcelles, pièces et relevés sont conservés dans le navigateur.

---

## 1. Principes de conception

| Principe | Traduction dans le code |
|---|---|
| **Zéro service payant** | Aucune requête métier ; satellite, météo et capteurs sont simulés par des fonctions déterministes. Seules les tuiles de fond de carte sont distantes. |
| **Une seule source de vérité** | Les règles de score vivent dans `src/utils/greenScoreEngine.ts` et sont importées par l'interface, la page Méthodologie et le PDF. |
| **Traçabilité** | Chaque relevé est signé en SHA-256 et chaîné au précédent ; toute réécriture casse la chaîne. |
| **Vocabulaire honnête** | L'interface distingue « données capteur certifiées » et « simulation démo », et la page Méthodologie liste les limites. |
| **Local d'abord** | `localStorage` pour la structure, IndexedDB pour les fichiers, exports autonomes pour la portabilité. |
| **Accessibilité et mobile** | Palette contrastée, libellés ARIA, navigation clavier, mise en page vérifiée à 320–375 px. |

---

## 2. Stack technique

| Brique | Version | Usage |
|---|---|---|
| React | 18.3 | Interface et état applicatif |
| TypeScript | 5.6 | Typage strict de bout en bout |
| Vite | 5.4 | Build et serveur de développement |
| Tailwind CSS | 3.4 | Styles, palette et responsive |
| Leaflet + react-leaflet | 1.9 / 4.2 | Carte satellite, contours, sondes |
| Three.js | 0.170 | Monde 3D du site public « Le champ virtuel » |
| @turf/turf | 7.1 | Surface, centroïde, découpage en zones |
| Recharts | 2.13 | Courbes de télémétrie |
| jsPDF + jspdf-autotable | 2.5 / 3.8 | Dossier de crédit PDF |
| Web Crypto, IndexedDB, Web Audio | natives | SHA-256, stockage des pièces, lecture vocale |

Aucune autre dépendance n'est utilisée. Les icônes sont des SVG maison (`src/components/ui/icons.tsx`), les polices sont servies depuis `public/fonts`.

Le dépôt contient **deux sites distincts**, avec leur propre entrée, leur propre build et leur propre port :

| Site | Commande | URL | Sortie |
|---|---|---|---|
| Application AgriTwin (exploitant, banque, conformité) | `npm run dev` | `127.0.0.1:5173` | `dist/` |
| Site public « Le champ virtuel » (démo jouable) | `npm run dev:demo` | `127.0.0.1:5174` | `dist-demo/` |

---

## 3. Arborescence

```
.
├── index.html                  Entrée Vite (lang fr, meta, logo)
├── vite.config.ts              React + hôte/port de développement
├── tailwind.config.js          Palette, polices, animations
├── postcss.config.js
├── vercel.json                 Build du site public sur Vercel, cache et en-têtes
├── tsconfig*.json              Configuration TypeScript (app / node)
├── public/
│   ├── agritwin-logo.webp
│   └── fonts/                  Polices auto-hébergées
├── docs/
│   ├── kits-agritwin.md        Composition et coûts des kits matériels
│   ├── deploiement-optimal.md  Stratégie d'hébergement et d'exploitation
│   └── deploiement-vercel.md   Procédure Vercel détaillée
├── demo/                       Second site public « Le champ virtuel » (autonome)
│   ├── index.html              Entrée Vite du site public
│   ├── vite.config.ts          Racine demo/, port 5174, build dist-demo/
│   ├── tsconfig.json           Typage strict du site public
│   └── src/
│       ├── main.tsx            Montage React
│       ├── App.tsx             Accueil, HUD, missions, télémétrie, récit
│       ├── audio.ts            Retours sonores Web Audio (aucun fichier)
│       ├── styles.css          Direction artistique du site public
│       └── scene/
│           ├── world.ts        Monde 3D : décor, survol, marche, interactions
│           └── model.ts        Missions, scellés, Score Vert, textes wolof
└── src/
    ├── main.tsx                Montage React
    ├── App.tsx                 Orchestrateur : état, navigation, score, exports
    ├── index.css               Couche Tailwind, composants CSS, styles Leaflet
    ├── types/agritwin.ts       Modèle de données partagé
    ├── auth/accounts.ts        Comptes locaux, session, rôles, réinitialisation
    ├── data/
    │   ├── seedData.ts         Parcelles de démonstration, 90 jours de relevés
    │   └── wolofPhrases.ts     Textes wolof, alertes vocales, questions rapides
    ├── demo/guidedDemo.ts      Parcours guidé en 9 étapes
    ├── storage/parcels.ts      Persistance des déclarations et des pièces
    ├── utils/
    │   ├── greenScoreEngine.ts Score Vert, verdict de crédit, assurance
    │   ├── cryptoChain.ts      Signature et vérification SHA-256
    │   ├── agronomyEngine.ts   Rendement, azote, conseils d'irrigation
    │   ├── documentLimits.ts   Règles et détection réelle des pièces
    │   ├── evidenceBundle.ts   Archive ZIP vérifiable hors ligne
    │   ├── pdfGenerator.ts     Dossier de crédit PDF
    │   └── format.ts           Nombres, dates, FCFA
    ├── verification/verifier.html  Vérificateur autonome (SHA-256 en JS pur)
    └── components/
        ├── auth/AuthScreen.tsx
        ├── layout/AppShell.tsx
        ├── layout/IoTSimulatorDrawer.tsx
        ├── methodology/ScoreMethodology.tsx
        ├── parcel/ParcelSetup.tsx

        ├── module1-map/ParcelMap.tsx
        ├── module2-monitoring/{KpiCards,TelemetryCharts,VoiceAssistant,AgroJournalModal}.tsx
        ├── module3-simulator/YieldSimulator.tsx
        ├── module4-finance/{GreenScoreCard,CryptoAuditTable,LenderPortal}.tsx
        ├── verification/VerificationQueue.tsx
        ├── demo/GuidedDemo.tsx
        └── ui/{Glyph,icons}.tsx
```

---

## 4. Flux de données

```
seedData.ts ──► ParcelDataset (parcelle + 90 relevés + intrants + signalements)
                        │
                        ▼
              signRecords() — SHA-256 chaîné
                        │
                        ▼
        datasets (état App) ──► verifyChain() ──► chaîne valide ?
                        │                              │
                        ▼                              ▼
              computeGreenScore() ──────────► intégrité 0/20 si rupture
                        │
        ┌───────────────┼────────────────┬───────────────┐
        ▼               ▼                ▼               ▼
   ScoreVert      verdict crédit    assurance       PDF / archive ZIP
```

`App.tsx` est l'unique orchestrateur : il construit les jeux de données, signe les relevés, calcule score, verdict et alertes, puis distribue aux vues. Les composants de module reçoivent des props et ne recalculent jamais les règles métier.

---

## 5. Rôles et navigation

Trois rôles, définis dans `auth/accounts.ts` et `types/agritwin.ts` :

| Rôle | Espace | Sections de navigation |
|---|---|---|
| `exploitant` | Production | Ma parcelle · Exploitation (Carte, Surveillance, Alertes) · Décision (Simulateur) · Financement (Score Vert, Preuve & audit) |
| `financeur` | Crédit | Portefeuille (Dossiers) |
| `verificateur` | Back-office | Back-office (Vérifications) |

Une section **Référentiel → Méthodologie & limites** est ajoutée aux trois rôles. Les sections sont déclarées dans `App.tsx` (`EXPLOITANT_SECTIONS`, `FINANCEUR_SECTIONS`, `VERIFICATEUR_SECTIONS`, `METHODOLOGY_SECTION`) et rendues par `AppShell`.

Les clés de vue sont : `parcel`, `map`, `monitoring`, `alerts`, `simulator`, `score`, `audit`, `portal`, `verification`, `methodology`.

---

## 6. Catalogue des fonctionnalités

### 6.1 Authentification et comptes
**Où :** `src/components/auth/AuthScreen.tsx`, `src/auth/accounts.ts`

- Connexion par téléphone (+221) et mot de passe ; création de compte avec nom, organisation et rôle (exploitant ou financeur ; le rôle conformité est réservé aux comptes internes).
- Comptes de démonstration affichés sur l'écran d'entrée (mot de passe commun `demo1234`) et bouton « Entrer ».
- Session persistée ; déconnexion depuis la barre latérale ou le menu du compte.
- Réinitialisation complète (comptes, session, déclarations, pièces) utilisée par la démo guidée.
- Les mots de passe sont hachés localement ; ce mécanisme est **de démonstration**, pas une authentification de production.

### 6.2 Déclaration de parcelle et pièces justificatives
**Où :** `src/components/parcel/ParcelSetup.tsx`

Parcours en quatre étapes :

1. **Identité** — nom, culture (oignon, tomate, arachide, mil, piment), type de sol, titulaire, qualité.
2. **Localisation** — latitude/longitude, surface, carte satellite Esri ; tracé du contour au toucher ou à la souris ; surface recalculée par Turf ; centroïde recalculé à la fin du tracé.
3. **Pièces** — pièce d'identité et titre foncier/bail obligatoires ; justificatif d'exploitation et photos facultatifs (4 maximum). Chaque fichier est contrôlé puis stocké.
4. **Récapitulatif** — synthèse, rappel de la procédure de contrôle, enregistrement en brouillon ou soumission.

Statuts de vérification : `brouillon` → `soumis` → `verifie` ou `rejete`. Toute modification d'un dossier déjà soumis ou certifié le renvoie en brouillon et remet les pièces « en attente ».

Contrôles de fichiers (`src/utils/documentLimits.ts`) :

- 10 Mo par pièce, 25 Mo par dossier, 60 Mo pour toutes les pièces de l'appareil ;
- 4 photos maximum ;
- type réel déduit de la signature binaire, jamais du MIME déclaré ni de l'extension ;
- **PDF accepté si la signature `%PDF` apparaît dans les 1 024 premiers octets** (les PDF précédés d'octets parasites sont valides) ; PNG et JPEG doivent commencer le fichier par leur signature ;
- contrôle identique à l'import et à l'écriture IndexedDB (`putDocumentFile`), pour qu'un état fabriqué hors interface ne puisse pas être enregistré.

Les fichiers sont conservés dans IndexedDB (`agritwin-verification`, magasin `documents`) ; les métadonnées dans `localStorage`. Les pièces orphelines sont purgées au démarrage et à l'enregistrement.

### 6.3 Carte et jumeau numérique
**Où :** `src/components/module1-map/ParcelMap.tsx`

- Fond satellite Esri, contour de la parcelle, trois zones homogènes (Nord/Centre/Sud) avec leur statut optimal/vigilance/critique.
- Trois calques : zones et sondes, NDVI Sentinel-2, humidité radar Sentinel-1.
- Sondes cliquables : humidité, NDVI, radar, état du scellé, batterie ; la zone témoin est distinguée.
- Tracé d'une nouvelle parcelle directement sur la carte, avec édition des sommets par glisser-déposer ; calcul de surface et découpage automatique en zones (état local à l'écran, non persisté).
- Curseur temporel sur les 90 jours : les valeurs affichées suivent le jour sélectionné.

### 6.4 Surveillance continue
**Où :** `src/components/module2-monitoring/`

- `KpiCards.tsx` — humidité à 15 cm et 35 cm, températures sol/air, pluie, EC/pH, état matériel (batterie, RSSI, scellé, accéléromètre).
- `TelemetryCharts.tsx` — courbes d'humidité, pluviométrie/irrigation, NDVI et radar sur l'historique.
- `AgroJournalModal.tsx` — saisie des apports d'engrais (NPK 10-10-20, urée 46 %, fumure organique), conversion en kg N/ha selon la surface, signalements phytosanitaires (type, gravité, note, date).
- Bilan minéral : azote apporté vs besoin de la culture, avec pourcentage de couverture.

### 6.5 Assistant vocal et alertes bilingues
**Où :** `src/components/module2-monitoring/VoiceAssistant.tsx`, `src/data/wolofPhrases.ts`

- Alertes classées critique / vigilance / information, avec identifiant (`ALR-…`), message et traduction.
- Lecture en **français** via la synthèse vocale du navigateur.
- Diffusion **wolof** : texte wolof affiché avec sa traduction française, et séquence sonore générée par Web Audio (pas de fichier audio à charger). Il s'agit d'un repère sonore de démonstration, pas d'une voix wolof enregistrée.
- Questions rapides (« état de l'humidité », « faut-il arroser ? », « quel Score Vert pour la banque ? ») avec réponse construite à partir des données réelles de la parcelle, dans la langue choisie.

### 6.6 Alertes et actions correctives
**Où :** `src/App.tsx` (`deriveAlerts`), vue `alerts`

Règles appliquées au dernier relevé :

| Alerte | Déclencheur |
|---|---|
| `ALR-SAT-01` incohérence sonde/satellite | écart > 15 points entre humidité 15 cm et radar Sentinel-1 |
| `ALR-SEAL-02` sécurité du boîtier | scellé rompu (avec mention de l'accéléromètre) |
| `ALR-HEAT-03` chaleur et stress hydrique | air ≥ 35 °C et humidité < 20 % |
| `ALR-HYD-03` alerte hydrique | humidité < 20 % |
| `ALR-HYD-04` vigilance | humidité < 22 % |
| `ALR-SAL-05` salinité | EC > 1,5 dS/m |
| `ALR-PHY-06` phytosanitaire | signalement de moins de 14 jours |
| `ALR-OK` | aucune alerte |

Chaque alerte propose des actions qui renvoient vers la surveillance, le simulateur ou la preuve.

### 6.7 Simulateur de rendement
**Où :** `src/components/module3-simulator/YieldSimulator.tsx`, `src/utils/agronomyEngine.ts`

Trois leviers : irrigation (−50 % à +50 %), azote (0 à 200 kg N/ha), décalage du calendrier cultural (−15 à +15 jours). Le moteur applique :

- satisfaction hydrique `0,82 + 0,35 × (Δ/100)`, bornée à 0,3–1, avec malus au-delà de +25 % d'excès ;
- réponse minérale `0,65 + 0,35 × (1 − e^(−0,022 N))` ;
- calendrier `max(0,75 ; 1 − 0,012 × |décalage|)` ;
- salinité `1,0` si EC ≤ 1,2, sinon `max(0,5 ; 1 − 0,18 × (EC − 1,2))`.

Le rendement potentiel de la culture est multiplié par ces indices, puis converti en production, chiffre d'affaires, coût de l'eau (65 000 FCFA/ha de référence), coût engrais (450 FCFA/kg N) et marge nette.

### 6.8 Score Vert
**Où :** `src/utils/greenScoreEngine.ts`, `src/components/module4-finance/GreenScoreCard.tsx`, page `methodology`

Score sur 100, quatre composantes :

| Composante | Poids | Calcul |
|---|---:|---|
| Régularité hydrique | 35 | part des jours avec humidité 15 cm dans 20–35 % |
| Vigueur végétative | 25 | NDVI × 32, plafonné à 25 |
| Santé du sol | 20 | 20 si EC ≤ 1,4 et pH 6,0–7,5 ; 14 si EC ≤ 2,0 ; sinon 7 |
| Intégrité | 20 | 20 si chaîne valide **et** scellé intact **et** écart satellite ≤ 15 ; sinon 0 |

Seuils : **≥ 75** profil A (éligible), **≥ 50** profil B (suivi coopératif), **< 50** profil C. Une fraude, une chaîne invalide ou un dossier gelé suspend le décaissement. L'exploitant contrôle le partage par consentement ; sans consentement, le portail financeur est verrouillé.

### 6.9 Preuve cryptographique et audit
**Où :** `src/utils/cryptoChain.ts`, `src/components/module4-finance/CryptoAuditTable.tsx`, vue `audit`

- Sérialisation canonique de chaque relevé (identifiant, horodatage, appareil, mesures à précision fixe, scellé, source).
- Empreinte `SHA-256(hash précédent || payload)`, chaînée depuis un bloc génésis.
- Vérification bloc par bloc : lien précédent, empreinte recalculée, continuité ; production d'une empreinte globale.
- Journal tabulaire défilant, nombre de blocs signés, date du dernier relevé, état du scellé.
- Tableau de partage et de conservation (consentement, loi 2008-12/CDP, nombre de signatures).

### 6.10 Dossier de crédit PDF
**Où :** `src/utils/pdfGenerator.ts`

PDF généré par jsPDF + autotable : identité de l'exploitation, parcelle, surface, GPS, boîtier, composition du score, performances sur 90 jours, décision de crédit, assurance, empreinte de chaîne, numéro de dossier `AT-<parcelle>-<année>`. Le numéro et l'empreinte rendent le document comparable à l'archive.

### 6.11 Archive vérifiable hors ligne
**Où :** `src/utils/evidenceBundle.ts`, `src/verification/verifier.html`

- Génère une archive ZIP (écriture « stored » maison, CRC32 et répertoire central) contenant le PDF, `preuve.json` (format `agritwin-dossier/1`) et un vérificateur HTML autonome.
- `verifier.html` recalcule les empreintes **en JavaScript pur**, sans `crypto.subtle`, pour fonctionner ouverte directement en `file://`.
- Six contrôles : format `agritwin-dossier/1`, chaîne de blocs, empreinte globale, recalcul du Score Vert et de ses quatre composantes, empreinte du PDF déposé, cohérence d'identité du dossier. Le contrôle du PDF est signalé « non effectué » si le fichier n'est pas joint.
- Toute altération d'un relevé ou du PDF est détectée et localisée (bloc de rupture, score déclaré vs recalculé).

### 6.12 Portail financeur
**Où :** `src/components/module4-finance/LenderPortal.tsx`

- Accès conditionné au consentement de l'exploitant ; message explicite en cas de refus.
- Identité de l'exploitation, décision de crédit, taux, justification.
- Quatre indicateurs de score, performances vérifiées sur 90 jours, assurance climatique indicielle avec déclencheurs (sécheresse 17 %, excès d'eau 36 %) et indemnisation estimée.
- Téléchargement du PDF et de l'archive vérifiable.

### 6.13 Back-office de conformité
**Où :** `src/components/verification/VerificationQueue.tsx`

- File des dossiers soumis, sélection d'un dossier, consultation des pièces et de leurs statuts.
- Décision : certifier ou rejeter avec note obligatoire ; horodatage et identité du relecteur enregistrés.
- Refus d'une décision sur un dossier qui n'est plus « soumis » (retiré ou modifié entre-temps).

### 6.14 Simulateur IoT (banc de démonstration)
**Où :** `src/components/layout/IoTSimulatorDrawer.tsx`, fonction `inject` dans `App.tsx`

Quatre injections et une remise à zéro :

- relevé normal (humidité 26,5 %, NDVI 0,75) ;
- vague de chaleur (39,5 °C, humidité 14,8 %) ;
- fraude sonde/satellite (humidité 44 % contre radar 20,7 %) ;
- arrachement du boîtier (scellé rompu, mouvement détecté) ;
- réinitialisation des 90 jours.

Chaque relevé injecté est horodaté, signé et chaîné comme un relevé normal, avec le badge « Simulation démo ».

### 6.15 Démo guidée
**Où :** `src/demo/guidedDemo.ts`, `src/components/demo/GuidedDemo.tsx`

Parcours de neuf étapes qui force le rôle et la vue : introduction, déclaration, soumission, certification, surveillance, fraude, gel du dossier, audit, décision bancaire. Les pièces de démonstration sont générées localement.

### 6.16 Méthodologie et limites
**Où :** `src/components/methodology/ScoreMethodology.tsx`

Page de transparence : formule et pondérations importées du moteur, seuils, provenance des données (mesuré/estimé/simulé), huit limites d'interprétation et limites du démonstrateur. Les constantes affichées sont celles du calcul, ce qui empêche toute divergence.

### 6.17 Site public « Le champ virtuel »
**Où :** `demo/` — second site autonome (`npm run dev:demo`, port 5174, build `dist-demo/`)

Démonstrateur grand public, volontairement séparé de l'application métier : aucune navigation, session
ou route n'est partagée avec AgriTwin. Il sert à montrer le projet à n'importe qui, sur un écran
comme sur un téléphone.

- **Le monde** — parcelle de 1,5 ha : ciel dégradé et nuages, horizon de baobabs, parcelles voisines,
  sol texturé, 18 billons d'oignons Violet de Galmi en rangs serrés, goutte-à-goutte, haie,
  boîtier solaire scellé, vanne d'irrigation, passerelle LoRaWAN et faisceau animé. Une coupe du sol
  en radiographie s'ouvre sous une sonde plantée (racines, volume d'eau).
- **Deux caméras** — *Survol* (OrbitControls, molette, clic direct dans la parcelle) et *Marche* en
  première personne façon jeu : ZQSD/les flèches, souris capturée (ou glissement si la capture est
  refusée), Maj pour courir, Espace pour sauter, E pour interagir. Le relief est suivi au sol, le mât
  est solide, la caméra oscille à la foulée. Mini-carte orientée, invite d'action et manette tactile
  pour les écrans tactiles.
- **Cinq missions** — 1) lire le sol (calques NDVI puis radar, retour aux zones) ; 2) planter les
  trois sondes sur les balises ; 3) raccorder les quatre éléments du kit au mât ; 4) vague de
  chaleur, 95 s d'humidité qui chute, ouvrir la vanne ; 5) inspecter les trois scellés et signaler
  l'intrusion. Score : **68 → 54 → 86 → 66** (dossier verrouillé), avec les poids officiels
  35/25/20/20.
- **Le récit** — sous la scène, trois sections expliquent le sol, la preuve et le financement, plus
  un encart « Ce que cette démonstration ne prouve pas » et les chiffres du dossier.

C'est ce site que déploie le `vercel.json` de la racine (`npm run build:demo` → `dist-demo/`) ;
l'application métier se déploie dans un second projet Vercel (voir `docs/deploiement-vercel.md`).

Le parcours est isolé : il ne réécrit aucun des 90 relevés chaînés. Les valeurs de sol (EC 1,65 dS/m,
pH 6,8), les poids et les seuils du score sont ceux du moteur réel ; les échantillons de scellés sont
fictifs. En développement uniquement, la scène s'expose sur `window.__field` pour les vérifications.

### 6.18 Coque applicative et responsive
**Où :** `src/components/layout/AppShell.tsx`

- Barre latérale fixe à partir de 1024 px ; tiroir de navigation en dessous.
- Sections repliables, vue active mise en évidence, sous-menu accessible au clavier.
- En-tête : menu, logo, sélecteur de parcelle, score, simulateur, menu de compte.
- **Sur mobile (< 640 px), le sélecteur de parcelle occupe sa propre rangée pleine largeur, en 16 px** (évite le zoom automatique iOS) ; sur écran large il reste dans la barre, avec une largeur bornée. Une seule liste est visible à la fois, donc un seul contrôle accessible.
- Menu de compte : identité, organisation, téléphone, état de la chaîne, rôle, déconnexion.
- Tiroir « simulateur IoT » à droite, fermeture par Échap ou clic sur le voile.

---

## 7. Modèle de données

`src/types/agritwin.ts` définit les entités partagées :

- `AccountRole`, `Account` (dans `auth/accounts.ts`) ;
- `ParcelConfig` : déclaration en cours (géométrie, culture, sol, pièces, vérification) ;
- `Parcel` : parcelle enrichie pour l'affichage (zones, cultures, boîtier, documents) ;
- `ParcelZone`, `GeoPoint` ;
- `TelemetryRecord` : 90 jours de mesures, scellé, accéléromètre, RSSI, NDVI, radar, source, `prevHash`/`hash` ;
- `ParcelDataset` : parcelle + relevés + intrants + signalements + consentement + gel + simulation ;
- `GreenScoreResult`, `CreditVerdict`, `AlertMessage`, `ParcelDocument`, `VerificationStatus`.

---

## 8. Stockage local

| Clé / base | Contenu |
|---|---|
| `agritwin.accounts.v1` (localStorage) | Comptes, mots de passe hachés, rôles |
| `agritwin.session.v1` (localStorage) | Session courante |
| `agritwin.parcels.v1` (localStorage) | Déclarations, métadonnées des pièces, statuts |
| `agritwin-verification` / `documents` (IndexedDB) | Fichiers binaires des pièces |

Règles : 10 Mo par pièce, 25 Mo par dossier, 60 Mo par appareil, 4 photos. Les fichiers ne sont jamais envoyés à un serveur. Vider le stockage du navigateur détruit donc les dossiers ; l'archive `.zip` est la copie portable.

---

## 9. Limites assumées

- Données satellite, météo et capteurs **simulées** de façon déterministe ; aucune connexion à Sentinel ou à un boîtier réel.
- Le wolof est **écrit** et accompagné d'un repère sonore, pas d'une voix enregistrée.
- Authentification et rôles locaux : un utilisateur qui maîtrise le navigateur peut modifier son stockage.
- La signature SHA-256 prouve l'absence de réécriture locale, pas l'origine physique de la mesure.
- Une seule sonde de référence couvre trois zones : le score ne décrit pas la variabilité fine.
- Pas de partage multi-appareils, pas de notifications, pas de sauvegarde serveur.

---

## 10. Où intervenir

| Objectif | Fichier |
|---|---|
| Ajouter une vue ou un rôle | `src/App.tsx` (sections + rendu), `src/components/layout/AppShell.tsx` |
| Modifier les poids ou seuils du score | `src/utils/greenScoreEngine.ts` (la page Méthodologie suit automatiquement) |
| Changer les règles d'import | `src/utils/documentLimits.ts` et `src/storage/parcels.ts` |
| Ajouter une culture ou une parcelle de démonstration | `src/data/seedData.ts` |
| Modifier le rendement ou les conseils | `src/utils/agronomyEngine.ts` |
| Ajouter une alerte | `deriveAlerts` dans `src/App.tsx` |
| Modifier le PDF | `src/utils/pdfGenerator.ts` |
| Modifier l'archive ou le vérificateur | `src/utils/evidenceBundle.ts`, `src/verification/verifier.html` |
| Modifier les textes wolof | `src/data/wolofPhrases.ts` |
| Ajuster la charte ou le responsive | `tailwind.config.js`, `src/index.css`, classes des composants |

---

## 11. Documentation complémentaire

- [`docs/deploiement-optimal.md`](./docs/deploiement-optimal.md) — architecture d'hébergement, cache, en-têtes, limites d'un site statique.
- [`docs/deploiement-vercel.md`](./docs/deploiement-vercel.md) — procédure Vercel, domaine, prévisualisations, dépannage.
- [`docs/kits-agritwin.md`](./docs/kits-agritwin.md) — composition matérielle, coûts rendus Dakar, segments et budgets.

---

*Démonstrateur réalisé pour le concours AKTIION 2026 — École Polytechnique de Thiès. Les données affichées sont simulées ; aucune promesse de crédit réel n'est formulée.*
