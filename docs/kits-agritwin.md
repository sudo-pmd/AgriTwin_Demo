# Kits AgriTwin — composition, coûts réels et segments

> Document de travail pour la présentation PowerPoint. Prix constatés le **23 novembre 2026**, sources listées en fin de document. Les totaux sont des **ordres de grandeur pour un dossier de concours**, à remplacer par des devis fournisseurs avant tout engagement.

---

## 1. Méthode de chiffrage (à mettre sur une slide)

| Paramètre | Valeur retenue | Justification |
|---|---|---|
| Euro → FCFA | **655,957** | Parité fixe BCEAO, cours du 23/11/2026 |
| Dollar → FCFA | **600** | BCEAO, cours de vente du 23/11/2026 (599,75) |
| Livre → FCFA | **786** | BCEAO, cours de vente du 23/11/2026 |
| Prix fournisseur | HT, hors port | Catalogues distributeurs EU/US/Chine |
| Coût « rendu Dakar » | **prix × 1,30** | Hypothèse : fret, douane, transit, marge importateur (à remplacer par un transitaire) |
| Prix local Sénégal | TTC (TVA 18 %) | Catalogue NRJSOLAIRE, Jumia, revendeurs Dakar |
| Assemblage | 6 000 FCFA/h | Hypothèse atelier Dakar |
| Pose terrain | 2 à 3 h technicien + déplacement | Salaire technicien électricien : 219 000 à 648 000 FCFA/mois, soit ≈ 10 000–25 000 FCFA/jour |

**Ce que les totaux n'incluent pas** : marge commerciale AgriTwin, garantie, pièces de rechange, formation (sauf kits C et D), abonnement plateforme, inflation, frais bancaires.

---

## 2. Ce que le kit doit mesurer (contrainte produit)

Le Score Vert impose quatre mesures que le matériel doit fournir :

1. **Humidité du sol à 15 cm et à 35 cm** — la composante « régularité hydrique » compare chaque jour à la fenêtre 20–35 %.
2. **NDVI** — vient du satellite (Sentinel-2), pas du kit, mais le kit doit horodater pour l'alignement.
3. **EC et pH** — composante « santé du sol » (20 / 14 / 7 points).
4. **Intégrité physique** : scellé, accéléromètre, RSSI, batterie — sinon la composante intégrité tombe à 0.

Conséquence directe : un simple capteur d'humidité à 12 000 FCFA ne suffit pas. Le kit minimal conforme doit inclure **2 profondeurs + EC/pH + scellé + LoRa**.

Architecture en trois blocs :

- **Capteurs** : 1 sonde 4-en-1 (humidité, température, pH, EC) par zone de référence, + sondes d'humidité pour les zones secondaires.
- **Boîtier scellé** : nœud LoRaWAN, carte d'interface, accéléromètre, contact de scellé, batterie, régulateur.
- **Énergie et connectivité** : panneau 20–40 Wc, batterie 7–12 Ah, passerelle LoRaWAN mutualisée entre parcelles.

---

## 3. Prix unitaires constatés (le cœur du dossier)

### 3.1 Sondes de sol

| Référence | Ce qu'elle mesure | Prix constaté | Rendu Dakar (×1,30) |
|---|---|---|---|
| DFRobot **SEN0193** | humidité capacitive, non étanche long terme | 5,90 $ | ≈ 4 600 FCFA |
| DFRobot **SEN0308** | humidité capacitive IP65 | 14,90 $ | ≈ 11 600 FCFA |
| DFRobot **SEN0604** | humidité, température, **pH, EC**, RS485, IP68 | **69 $** | **≈ 54 000 FCFA** |
| METER **TEROS 12** | humidité, température, EC, précision recherche | 271 $ | ≈ 211 400 FCFA |
| METER TEROS 12 (variante Modbus) | idem, sortie Modbus | 399 $ | ≈ 311 000 FCFA |
| Atlas Scientific pH (circuit + sonde labo) | pH eau/extrait, haute précision | 45,99 $ + 99,99 $ | ≈ 113 000 FCFA |
| Atlas Scientific conductivité | EC eau, K=1 | 67,99 $ + 149,99 $ | ≈ 170 000 FCFA |

**Choix AgriTwin** : la **SEN0604 à 54 000 FCFA** est le meilleur compromis. Elle donne les quatre variables dans un seul corps IP68 et divise le coût par 4 face à une TEROS 12. Limite à dire en slide : précision pH/EC de qualité « indicative » (sonde bas coût), suffisante pour un seuil 1,4 / 2,0 dS/m et un pH 6–7,5, insuffisante pour un rapport d'essai agronomique.

### 3.2 Acquisition et transmission

| Référence | Rôle | Prix constaté | Rendu Dakar |
|---|---|---|---|
| Milesight **UC100** | nœud LoRaWAN RS485 Modbus | 46,22 € | ≈ 39 400 FCFA |
| Milesight **UC300** | nœud LoRaWAN RS485 + 6 analogiques + 4-20 mA | 199 $ | ≈ 155 000 FCFA |
| Dragino **LSN50v2** | nœud LoRaWAN, 2 ADC, IP66, batterie incluse | 45–69 € | ≈ 38 000–59 000 FCFA |
| Dragino **PS-NA** | nœud LoRaWAN 4-20 mA / 0-30 V | 53,78 € | ≈ 45 800 FCFA |
| Dragino **LPS8N** (intérieur) | passerelle LoRaWAN 8 canaux | 118–230 € | ≈ 100 000–196 000 FCFA |
| Dragino **DLOS8N** (extérieur IP65) | passerelle LoRaWAN extérieure | 251,26 € | **≈ 214 000 FCFA** |

### 3.3 Boîtier, énergie, connectivité, pose

| Poste | Référence / source | Prix |
|---|---|---|
| Boîtier IP66/67 180×130×150 | Fibox MNX PCM 150/150 | 28,77 £ HT → ≈ 29 000 FCFA rendu |
| Boîtier IP66/67 255×180×150 | Fibox MNX PCM 200/150 | 88,70 € HT → ≈ 75 600 FCFA rendu (négociable 60 € en volume) |
| Connecteurs M12 IP67 | Tensility / binder | 15–18 $ pièce → 25 000 FCFA avec câbles |
| Panneau 20 Wc | 177 FCFA/Wc (catalogue sénégalais) | 10 000–12 000 FCFA |
| Panneau 40 Wc | idem | 18 000–22 000 FCFA |
| Batterie 12 V 7 Ah GEL | Performances Services / NRJSOLAIRE | 10 000–15 100 FCFA |
| Batterie 12 V 12 Ah | NRJSOLAIRE | 14 400 FCFA |
| Régulateur PWM 10–20 A | Kaaraangegui Solaire | 10 000–17 500 FCFA |
| Forfait data 30 j, 2 Go | Orange Sénégal, pass prépayé | 2 000 FCFA/mois |
| Station météo (pluie, T, HR, vent) importée et posée | Kolonell, Sénégal 2026 | 380 000 FCFA |
| Station météo Weenat (pluie, T, HR) | grille publique 2023 | 560 € HT ≈ 367 000 FCFA |
| Davis Vantage Pro2 Plus installée | Kolonell, Sénégal | 1,8–2,5 M FCFA |
| Capteur d'humidité bas coût en gros, Dakar | Kolonell (Alibaba + acheminement) | 12 000 FCFA |

---

## 4. Les quatre configurations

### Kit A — « Essentiel » · 1 parcelle, 2 profondeurs

| Composant | Qté | P.U. | Total |
|---|---:|---:|---:|
| Sonde 4-en-1 RS485 SEN0604 (15 cm et 35 cm) | 2 | 54 000 | 108 000 |
| Nœud LoRaWAN UC100 | 1 | 39 400 | 39 400 |
| Boîtier IP67 + presse-étoupes | 1 | 29 000 | 29 000 |
| Connectique M12 + 4 m de câble | 1 | 22 000 | 22 000 |
| Scellé + accéléromètre + horloge | 1 | 4 000 | 4 000 |
| Carte d'interface, protection, composants | 1 | 12 000 | 12 000 |
| Panneau 20 Wc | 1 | 12 000 | 12 000 |
| Batterie 12 V 7 Ah | 1 | 10 000 | 10 000 |
| Régulateur PWM 10 A | 1 | 10 000 | 10 000 |
| Mât, colliers, plaque de pose | 1 | 10 000 | 10 000 |
| **Sous-total matériel** | | | **256 400** |
| Assemblage et test (2 h) | | 12 000 | 12 000 |
| Pose et mise en service | | 30 000 | 30 000 |
| **TOTAL** | | | **≈ 300 000 FCFA** |

**Fourchette : 280 000 – 320 000 FCFA** (≈ 430–490 €). Coût par hectare sur 1,5 ha : ≈ 200 000 FCFA/ha.

### Kit B — « Trois zones » · parcelle de 2 à 10 ha

| Composant | Qté | P.U. | Total |
|---|---:|---:|---:|
| Sonde 4-en-1 SEN0604 (une par zone) | 3 | 54 000 | 162 000 |
| Nœud LoRaWAN UC100 | 1 | 39 400 | 39 400 |
| Boîtier IP67 255×180×150 | 1 | 75 600 | 75 600 |
| Connectique + 15 m de câble | 1 | 35 000 | 35 000 |
| Scellé + accéléromètre | 1 | 4 000 | 4 000 |
| Carte d'interface / bus RS485 isolé | 1 | 15 000 | 15 000 |
| Panneau 40 Wc | 1 | 20 000 | 20 000 |
| Batterie 12 V 12 Ah | 1 | 14 400 | 14 400 |
| Régulateur PWM | 1 | 10 000 | 10 000 |
| Mât et fixations | 1 | 12 000 | 12 000 |
| **Sous-total matériel** | | | **387 400** |
| Assemblage (3 h) | | 18 000 | 18 000 |
| Pose (3 sondes) | | 45 000 | 45 000 |
| **TOTAL** | | | **≈ 450 000 FCFA** |

**Fourchette : 420 000 – 470 000 FCFA** (≈ 640–715 €). Coût par hectare sur 5 ha : ≈ 90 000 FCFA/ha.

> Point technique à vérifier avant la slide : les SEN0604 doivent avoir des **adresses Modbus distinctes** pour partager un bus. Sinon, prévoir un UC100 par sonde (+39 400 FCFA par zone) ou passer au UC300.

### Kit C — « Coopérative » · 3 parcelles + passerelle + météo

| Composant | Qté | P.U. | Total |
|---|---:|---:|---:|
| Kit B (matériel) | 3 | 387 400 | 1 162 200 |
| Passerelle extérieure DLOS8N | 1 | 214 000 | 214 000 |
| Station météo installée | 1 | 380 000 | 380 000 |
| Mât/pylône passerelle + parasurtenseur | 1 | 60 000 | 60 000 |
| Pose des 3 kits | 3 | 45 000 | 135 000 |
| Pose et paramétrage passerelle | 1 | 80 000 | 80 000 |
| Formation et mise en service | 1 | 55 000 | 55 000 |
| **TOTAL** | | | **≈ 2 086 000 FCFA** |

**Fourchette : 2,0 – 2,3 M FCFA** (≈ 3 000–3 500 €) pour 3 parcelles, soit **52 000 FCFA/ha** sur 40 ha.

La passerelle est **mutualisée** : elle couvre plusieurs parcelles dans un rayon de 2 à 5 km en zone rurale dégagée. C'est le principal levier de coût par hectare.

### Kit D — « Recherche / parcelle pilote » · métrologie de référence

| Composant | Qté | P.U. | Total |
|---|---:|---:|---:|
| Sonde TEROS 12 (15 et 35 cm) | 2 | 211 400 | 422 800 |
| Nœud UC100 | 1 | 39 400 | 39 400 |
| Boîtier, énergie, câblage | 1 | 90 000 | 90 000 |
| Passerelle DLOS8N | 1 | 214 000 | 214 000 |
| Station météo | 1 | 380 000 | 380 000 |
| Pose, étalonnage, formation | 1 | 150 000 | 150 000 |
| **TOTAL** | | | **≈ 1 296 000 FCFA** |

**Fourchette : 1,25 – 1,45 M FCFA.** Destiné à une parcelle de référence, un projet de recherche ou une vitrine de coopérative, pas au déploiement de masse.

---

## 5. À qui les kits sont destinés, et avec quel budget

| Segment | Profil type | Surface | Kit recommandé | Budget d'achat | Alternative locative |
|---|---|---|---:|---:|---|
| **Petit producteur** | maraîcher individuel, 1 zone, revenu saisonnier | 0,5–2 ha | A | **280–320 k FCFA** | 15 000–20 000 FCFA/mois |
| **Exploitation moyenne** | 3 zones, salariés, accès crédit intrants | 2–10 ha | B | **420–470 k FCFA** | 20 000–25 000 FCFA/mois |
| **Coopérative / agrégateur** | 20–100 ha, plusieurs membres, besoin de preuve collective | 20–100 ha | C (3 parcelles + passerelle) | **2,0–2,3 M FCFA** | 60 000–90 000 FCFA/mois |
| **Recherche / agro-industrie** | station de référence, essais, certification | 1–5 ha | D | **1,25–1,45 M FCFA** | sur devis |
| **IMF / assureur** | pas de matériel, consomme la preuve | — | API + portail | 0 matériel | licence plateforme |

**Trois positionnements de prix à expliciter en slide :**

1. **Achat comptant** — le producteur possède le kit, AgriTwin vend la plateforme.
2. **Leasing / HaaS** — 30 % d'apport puis 24–36 mois, sur le modèle observé au Sénégal chez AgriSense (30 % cash, 70 % leasing 36 mois). Cela abaisse la barrière d'entrée à 15–25 k FCFA/mois.
3. **Subvention / projet** — coopérative ou bailleur finance le kit C, la valeur se mesure en hectares couverts et en dossiers bancables.

---

## 6. Coûts récurrents (à ne pas oublier dans le business plan)

| Poste | Montant | Fréquence |
|---|---:|---|
| Pass data passerelle (2 Go) | 2 000 FCFA | mois |
| Plateforme AgriTwin | 5 000–15 000 FCFA | mois (hypothèse ; benchmark local 65 000 FCFA/mois pour une offre automatisation complète) |
| Maintenance préventive (nettoyage, joints, vérification) | 20 000 FCFA | an et par kit |
| Étalonnage pH (solutions + main-d'œuvre) | 15 000 FCFA | an |
| Remplacement batterie | 10 000–14 400 FCFA | 2–3 ans |
| Remplacement sonde 4-en-1 | 54 000 FCFA | 2–3 ans |
| Abonnement réseau LoRaWAN opéré | sur devis | mois (alternative à la passerelle privée) |

**Coût de possession sur 3 ans, kit A** : 298 000 + (5 000 × 36) + (2 000 × 36) + 60 000 + 10 000 ≈ **620 000 FCFA**, soit ≈ 207 000 FCFA/an. C'est ce chiffre — pas le prix d'achat — qu'un producteur compare à son revenu.

---

## 7. Comparaisons de marché à citer

| Référence marché | Prix | Enseignement |
|---|---:|---|
| Capteur d'humidité bas coût en gros, Dakar (Kolonell, 2026) | 12 000 FCFA | Le marché local sait acheter des capteurs nus ; ils ne donnent ni EC/pH, ni scellé, ni preuve. |
| Station météo importée + posée (Kolonell) | 380 000 FCFA | Le prix de notre station est aligné sur le marché sénégalais. |
| Davis Vantage Pro2 Plus installée | 1,8–2,5 M FCFA | Segment premium, hors de portée d'un petit producteur. |
| SoilSense (Europe) — achat station 2 capteurs | 649 € + 90 €/an ≈ 485 000 FCFA | Un kit B à 450 000 FCFA reste **moins cher** qu'une station européenne d'entrée. |
| SoilSense — location | 300 €/an ≈ 197 000 FCFA/an | Benchmark direct du HaaS AgriTwin. |
| Plateforme agricole locale complète | 65 000 FCFA/mois | Notre 5 000–15 000 FCFA/mois est un prix d'entrée agressif, à justifier par le périmètre. |
| Équipement IoT moyen par exploitation de 10 ha (AgriSense) | 8–12 M FCFA | Notre kit C à 2,1 M FCFA couvre 3 parcelles : positionnement « preuve bancaire », pas « automatisation ». |

---

## 8. Plan de la présentation PowerPoint (12 slides)

| # | Titre | Message clé | Visuel |
|---|---|---|---|
| 1 | Le kit AgriTwin | Un boîtier scellé qui produit une preuve bancable, pas seulement des courbes | Photo produit + score 84/100 |
| 2 | Ce que le Score Vert exige | 2 profondeurs, EC/pH, scellé, LoRa : quatre contraintes matérielles | Schéma des 4 composantes → capteurs |
| 3 | Architecture | 3 blocs + passerelle mutualisée | Schéma capteurs → boîtier → passerelle → plateforme |
| 4 | Méthode de chiffrage | Prix publics, taux BCEAO, fret ×1,30, pose sénégalaise | Tableau des hypothèses |
| 5 | Prix unitaires du marché | SEN0604 à 54 k contre TEROS 12 à 211 k : le choix du compromis | Tableau comparatif fournisseurs |
| 6 | Kit A — Essentiel | 300 000 FCFA pour rendre une parcelle bancable | Nomenclature + photo |
| 7 | Kit B — Trois zones | 450 000 FCFA, 90 000 FCFA/ha | Nomenclature + implantation |
| 8 | Kit C — Coopérative | 2,1 M FCFA pour 3 parcelles, passerelle mutualisée | Carte de couverture 5 km |
| 9 | Kit D — Recherche | 1,3 M FCFA pour une métrologie de référence | Photo TEROS + station |
| 10 | Segments et budgets | De 280 k à 2,3 M FCFA selon la surface et le nombre de zones | Matrice segment × budget |
| 11 | Modèles économiques | Achat, HaaS 15–25 k/mois, subvention coopérative | Trois colonnes avec TCO 3 ans |
| 12 | Limites et prochaines étapes | Prix indicatifs, adresses Modbus à valider, devis à obtenir | Risques + planning pilote |

---

## 9. Limites du chiffrage

- Les prix fournisseurs sont des **prix catalogue publics**, pas des offres négociées : en volume (100 kits), compter −20 à −30 % sur les sondes et les nœuds.
- Le multiplicateur **×1,30** est une hypothèse de fret/douane, non un devis transitaire ; il peut varier de 1,2 à 1,5 selon le mode d'import.
- La **SEN0604** est annoncée IP68 et RS485, mais ses performances pH/EC en sol ne sont pas documentées par un essai indépendant. À valider par une campagne de comparaison contre une TEROS 12 avant de promettre une précision.
- Les adresses Modbus multiples sur un même bus ne sont pas confirmées par la fiche produit : c'est le principal risque technique du kit B.
- La **main-d'œuvre** est estimée à partir des grilles de salaires sénégalaises, pas d'un devis d'installateur.
- Les prix locaux incluent la TVA (18 %) ; les prix importés sont HT. Les totaux mélangent donc les deux régimes, ce qui est volontaire pour refléter le coût réel, mais doit être dit à l'oral.

---

## 10. Sources

Consultées le 23 novembre 2026.

**Sondes et acquisition**
- DFRobot SEN0604 (4-en-1 RS485, 69 $) : https://www.dfrobot.com/product-2830.html
- DFRobot SEN0308 (humidité IP65, 14,90 $) : https://www.dfrobot.com/product-2054.html
- DFRobot SEN0193 (humidité capacitive, 5,90 $) : https://www.dfrobot.com/product-1385.html
- DFRobot pH labo (29,50–39,50 $) : https://www.dfrobot.com/product-1025.html
- DFRobot EC K=1 (69,90 $) : https://www.dfrobot.com/product-1123.html
- METER TEROS 12 (271 $) : https://metergroup.com/products/teros-12
- Apogee TEROS 12 Modbus (399 $) : https://www.apogeeinstruments.com/teros-12-soil-moisture-sensor-modbus-output
- Atlas Scientific EZO pH (45,99 $) : https://atlas-scientific.com/embedded-solutions/ezo-ph-circuit
- Atlas Scientific EZO EC (67,99 $) : https://atlas-scientific.com/embedded-solutions/ezo-conductivity-circuit

**Nœuds et passerelles**
- Milesight UC100 (à partir de 46,22 €) : https://shopiot.eu/collections/lorawan-controllers-bridges
- Milesight UC300 (199 $) : https://emergentmetering.com/products/milesight-uc300-lorawan-4g-iot-controller
- Dragino LSN50v2 (45 €) : https://shop.molukas.com/en/nodes/77-dragino-lsn50v2-lorawan-waterproof-long-range-sensor-node-eu868-8500mah-6973956300569.html
- Dragino PS-NA (à partir de 53,78 €) : https://shopiot.eu/collections/lorawan-controllers-bridges
- Dragino LPS8N (118 € chez exp-tech) : https://exp-tech.de/en/products/dragino-lps8n-868-868mhz-indoor-lorawan-gateway
- Dragino DLOS8N extérieure (251,26 € HT) : https://shopiot.eu/products/dragino-dlos8n-outdoor-lorawan-gateway-sx1302

**Boîtier et connectique**
- Fibox PCM 150/150 (28,77 £ HT) : https://www.ilecsys.co.uk/manufacturers/fibox/mnx/pcm-150-150-g
- Fibox PCM 200/150 (88,70 € HT) : https://www.evg.de/en/pcm_200150_t-fibox_enclosure_pc_255x180x150_ip66_ip67_ik08
- Connecteurs M12 IP67 (15–18 $) : https://www.tensility.com/collections/category-connectors-circular/connector-coding_x

**Énergie et connectivité au Sénégal**
- Prix du solaire 2026, 177 FCFA/Wc, panneaux 35 400–134 520 FCFA TTC : https://nrjsolaire.sn/prix-solaire-senegal/
- Panneaux locaux (100 Wc à 25 000 FCFA) : https://www.nolabi.com/prix-des-panneaux-solaires-au-senegal-combien-prevoir
- Batterie 12 V 7 Ah GEL à 10 000 FCFA : https://performanceservices.sn/index.php?controller=product&id_product=425&rewrite=batterie-onduleur-solaire-gel-12v-7ah
- Batteries 12-09Ah / 12-12Ah : https://nrjsolaires.com/collections/batterie
- Régulateur PWM 20 A à 10 000 FCFA : https://kaaraangeguisolaire.com/wdk-listing/regulateur-pwm-20a-solar
- Pass data Orange 30 j, 2 Go à 2 000 FCFA : https://vivreausenegal.fr/pratique/internet-mobile

**Marché sénégalais et références**
- Capteur humidité en gros 12 000 FCFA, station 380 000 FCFA, équipement 10 ha 8–12 M FCFA : https://kolonell.com/fr/blog/agriculture-connectee-iot-senegal-2026
- Modèle leasing 30 % / 36 mois et plateforme 65 000 FCFA/mois : https://kolonell.com/en/blog/iot-connected-agriculture-senegal-2026
- Davis Vantage Pro2 installée 1,8–2,5 M FCFA : https://kolonell.com/en/blog/iot-irrigation-senegal-suppliers-2026
- SoilSense, achat 649 € + 90 €/an, location 300 €/an : https://www.soilsense.io/fr/systeme
- Station Weenat 560 € HT : https://station-meteo.io/weenat
- Grille salaires techniciens électriciens Sénégal : https://wageindicator.org/fr-sn/travail-au-senegal/emplois-et-revenus/senegal-techniciens-en-electricite/

**Change**
- BCEAO, cours du 23/11/2026 : https://www.bceao.int/fr/cours/cours-des-devises-contre-Franc-CFA-appliquer-aux-transferts
- Parité fixe EUR/XOF : https://www.tresor.economie.gouv.fr/tresor-international/la-zone-franc/les-principes-et-modalites-de-fonctionnement-de-la-cooperation-monetaire
