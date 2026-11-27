import type { ReactNode } from 'react';
import Glyph, { type GlyphName } from '../ui/Glyph';
import {
  ELIGIBLE_THRESHOLD,
  MOISTURE_MAX,
  MOISTURE_MIN,
  NDVI_TO_POINTS,
  REVIEW_THRESHOLD,
  SATELLITE_TOLERANCE,
  SCORE_WEIGHTS,
  SOIL_EC_OPTIMAL,
  SOIL_EC_TOLERATED,
  SOIL_PH_MAX,
  SOIL_PH_MIN,
  SOIL_POINTS,
} from '../../utils/greenScoreEngine';

const TOTAL =
  SCORE_WEIGHTS.water + SCORE_WEIGHTS.vegetation + SCORE_WEIGHTS.soil + SCORE_WEIGHTS.integrity;

/** Seuil décimal à la française, avec une décimale fixe (6,0 et non 6). */
const decimal = (value: number) => value.toFixed(1).replace('.', ',');

interface ComponentDoc {
  glyph: GlyphName;
  label: string;
  points: number;
  formula: string;
  detail: string;
}

const COMPONENTS: ComponentDoc[] = [
  {
    glyph: 'droplet',
    label: 'Régularité hydrique',
    points: SCORE_WEIGHTS.water,
    formula: `${SCORE_WEIGHTS.water} × (jours dans la fenêtre ÷ jours de campagne)`,
    detail: `Un jour compte si l'humidité à 15 cm reste entre ${MOISTURE_MIN} % et ${MOISTURE_MAX} %. La composante mesure la régularité du pilotage, pas le volume d'eau apporté.`,
  },
  {
    glyph: 'leaf',
    label: 'Vigueur végétative',
    points: SCORE_WEIGHTS.vegetation,
    formula: `min(${SCORE_WEIGHTS.vegetation} ; NDVI × ${NDVI_TO_POINTS})`,
    detail:
      'Le NDVI du dernier relevé est converti en points puis plafonné : une parcelle très vigoureuse ne compense jamais un défaut d’intégrité.',
  },
  {
    glyph: 'sprout',
    label: 'Santé et salinité du sol',
    points: SCORE_WEIGHTS.soil,
    formula: `${SOIL_POINTS.optimal} / ${SOIL_POINTS.partial} / ${SOIL_POINTS.degraded} points selon EC et pH`,
    detail: `${SOIL_POINTS.optimal} points si EC ≤ ${decimal(SOIL_EC_OPTIMAL)} dS/m et pH entre ${decimal(SOIL_PH_MIN)} et ${decimal(SOIL_PH_MAX)} ; ${SOIL_POINTS.partial} si EC ≤ ${decimal(SOIL_EC_TOLERATED)} ; ${SOIL_POINTS.degraded} au-delà. Un sol salinisé garde une note partielle, jamais nulle.`,
  },
  {
    glyph: 'shieldCheck',
    label: 'Intégrité physique et cryptographique',
    points: SCORE_WEIGHTS.integrity,
    formula: `${SCORE_WEIGHTS.integrity} points ou 0 — condition binaire`,
    detail: `Les ${SCORE_WEIGHTS.integrity} points exigent une chaîne SHA-256 valide, un scellé intact et un écart sonde / radar sous ${SATELLITE_TOLERANCE} points. Sinon la composante tombe à zéro.`,
  },
];

const PROVENANCE: {
  label: string;
  className: string;
  rows: { label: string; detail: string }[];
}[] = [
  {
    label: 'Mesuré (scénario capteur)',
    className: 'border-[#bbf7d0] bg-[#f0fdf4] text-forest-700',
    rows: [
      {
        label: 'Humidité à 15 et 35 cm, températures, humidité de l’air',
        detail: 'Sondes du boîtier, un relevé par jour.',
      },
      {
        label: 'Conductivité électrique et pH',
        detail: 'Sonde de sol, utilisés pour la composante « santé du sol ».',
      },
      {
        label: 'Pluviométrie et irrigation',
        detail: 'Pluviomètre du kit et apports déclarés par l’exploitant.',
      },
      {
        label: 'Batterie, RSSI LoRa, scellé, accéléromètre',
        detail: 'Diagnostic matériel : ce sont eux qui conditionnent l’intégrité.',
      },
    ],
  },
  {
    label: 'Estimé par imagerie satellite',
    className: 'border-[#bae6fd] bg-[#f0f9ff] text-[#0369a1]',
    rows: [
      {
        label: 'NDVI (vigueur végétative)',
        detail: `Sentinel-2 dans le scénario, converti par NDVI × ${NDVI_TO_POINTS} puis plafonné.`,
      },
      {
        label: 'Humidité radar',
        detail: 'Sentinel-1 dans le scénario ; sert de contre-mesure à la sonde.',
      },
    ],
  },
  {
    label: 'Simulé / généré localement',
    className: 'border-[#fcd34d] bg-[#fffbeb] text-[#b45309]',
    rows: [
      {
        label: 'Les 90 relevés de la campagne',
        detail:
          'Générés par fonctions déterministes et une graine de parcelle, sans image satellite ni capteur connecté.',
      },
      {
        label: 'Les incidents injectés (chaleur, fraude, arrachement)',
        detail: 'Ajoutés par le simulateur IoT, puis signés comme de vrais relevés.',
      },
    ],
  },
];

const LIMITS: { title: string; detail: string }[] = [
  {
    title: 'Le rendement réel',
    detail: 'Le score mesure un pilotage, pas la récolte effectivement sortie du champ.',
  },
  {
    title: 'La propriété foncière',
    detail:
      'Le titre ou bail est contrôlé visuellement ; ni cadastre ni registre foncier ne sont consultés.',
  },
  {
    title: 'La solvabilité',
    detail:
      'Aucun remboursement, revenu ou endettement n’entre dans le calcul : c’est un indicateur technique, pas une note de crédit complète.',
  },
  {
    title: 'L’absence de fraude',
    detail:
      'Les incohérences sonde / radar, un scellé rompu ou une chaîne altérée sont détectés ; une falsification cohérente ou une collusion ne le seraient pas.',
  },
  {
    title: 'La représentativité spatiale',
    detail:
      'Une sonde de référence couvre trois zones : la variabilité fine dans la parcelle n’est pas décrite.',
  },
  {
    title: 'La qualité du produit',
    detail: 'Calibre, conservation et résidus ne sont pas mesurés.',
  },
  {
    title: 'La stabilité dans le temps',
    detail:
      'Le score dépend du dernier relevé : un incident isolé peut suspendre un dossier régulier, une fraude non détectée peut le maintenir haut.',
  },
  {
    title: 'La conformité juridique',
    detail: 'Ni expertise, ni attestation officielle, ni preuve au sens d’un texte réglementaire.',
  },
];

function Panel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="window">
      <div className="window-head">
        <h2 className="window-title">{title}</h2>
        {hint && <span className="window-hint">{hint}</span>}
      </div>
      <div className="window-body space-y-3">{children}</div>
    </section>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{children}</p>
  );
}

export default function ScoreMethodology() {
  return (
    <div className="space-y-3">
      <Panel title="La formule" hint={`${TOTAL} points`}>
        <p className="max-w-4xl text-[12px] leading-relaxed text-slate-600">
          Quatre composantes, aucune pondération cachée ni apprentissage automatique. Chaque
          composante est arrondie séparément puis additionnée : le total est un entier de 0 à {TOTAL},
          dont se déduisent le profil et la décision.
        </p>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {COMPONENTS.map((component) => (
            <div key={component.label} className="stat">
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slateink-800">
                  <Glyph name={component.glyph} className="h-4 w-4 shrink-0 text-forest-600" />
                  {component.label}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-slate-500">
                  {component.points} pts
                </span>
              </div>
              <p className="mt-1.5 font-mono text-[11px] leading-snug text-forest-700">
                {component.formula}
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600">{component.detail}</p>
            </div>
          ))}
        </div>

        <p className="border-t border-[#eef3f8] pt-2 text-[11px] leading-relaxed text-slate-500">
          Pondérations et barèmes importés de{' '}
          <span className="font-mono text-[10.5px]">src/utils/greenScoreEngine.ts</span> : cette page
          ne peut pas diverger du calcul réel.
        </p>
      </Panel>

      <Panel title="Seuils de décision" hint="règles bloquantes incluses">
        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="stat border-[#bbf7d0] bg-[#f0fdf4]">
            <p className="eyebrow text-forest-700">≥ {ELIGIBLE_THRESHOLD} points</p>
            <p className="mt-1 text-[12.5px] font-semibold text-forest-800">Profil A — éligible</p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-slate-600">
              Tranche 2 débloquée, taux préférentiel.
            </p>
          </div>
          <div className="stat border-[#fcd34d] bg-[#fffbeb]">
            <p className="eyebrow text-[#b45309]">
              {REVIEW_THRESHOLD} à {ELIGIBLE_THRESHOLD - 1} points
            </p>
            <p className="mt-1 text-[12.5px] font-semibold text-[#92400e]">
              Profil B — suivi coopératif
            </p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-slate-600">
              Contre-visite du technicien avant décaissement.
            </p>
          </div>
          <div className="stat border-[#fecaca] bg-[#fef2f2]">
            <p className="eyebrow text-[#b91c1c]">&lt; {REVIEW_THRESHOLD} points</p>
            <p className="mt-1 text-[12.5px] font-semibold text-[#b91c1c]">Profil C — suspendu</p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-slate-600">
              Audit contradictoire avant tout décaissement.
            </p>
          </div>
        </div>

        <div>
          <SubHeading>Règles qui priment sur le total</SubHeading>
          <ul className="mt-1.5 space-y-1.5 text-[12px] leading-relaxed text-slate-600">
            <li className="flex items-start gap-2">
              <Glyph name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b91c1c]" />
              Écart sonde / radar supérieur à {SATELLITE_TOLERANCE} points : fraude détectée,
              intégrité à 0 et décaissement suspendu, quel que soit le score.
            </li>
            <li className="flex items-start gap-2">
              <Glyph name="shieldAlert" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b91c1c]" />
              Scellé rompu ou arrachement : dossier gelé jusqu’à inspection matérielle.
            </li>
            <li className="flex items-start gap-2">
              <Glyph name="lock" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b91c1c]" />
              Chaîne SHA-256 invalide : aucune décision favorable, même avec un score élevé.
            </li>
          </ul>
        </div>
      </Panel>

      <Panel title="Provenance des données" hint="mesuré, estimé, simulé">
        <p className="text-[11.5px] leading-relaxed text-slate-600">
          Aucune image satellite n’est téléchargée et aucun capteur n’est connecté : les 90 relevés
          sont générés localement. Le badge « Données capteur certifiées » décrit le scénario (kit
          scellé, source déclarée <span className="font-mono text-[11px]">sensor</span>), pas une
          provenance réelle.
        </p>
        <div className="grid gap-2.5 lg:grid-cols-3">
          {PROVENANCE.map((group) => (
            <div key={group.label} className="rounded-[10px] border border-[#eef3f8] p-3">
              <span className={`chip ${group.className}`}>{group.label}</span>
              <dl className="mt-2 divide-y divide-[#f1f5f9]">
                {group.rows.map((row) => (
                  <div key={row.label} className="py-1.5">
                    <dt className="text-[12px] font-semibold text-slateink-800">{row.label}</dt>
                    <dd className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
                      {row.detail}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Hypothèses de démonstration : rendement potentiel, prix de vente, coûts et besoin azoté du
          catalogue de cultures ; barème de taux 6,5 % / 9,0 % par campagne.
        </p>
      </Panel>

      <Panel title="Limites" hint="interprétation et démonstrateur">
        <div>
          <SubHeading>Ce que le score ne prouve pas</SubHeading>
          <ul className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {LIMITS.map((limit) => (
              <li key={limit.title} className="stat">
                <p className="flex items-start gap-1.5 text-[12px] font-semibold text-slateink-800">
                  <Glyph name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {limit.title}
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600">{limit.detail}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-[#eef3f8] pt-3">
          <SubHeading>Démonstrateur et production</SubHeading>
          <div className="mt-1.5 grid gap-2.5 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold text-slate-500">Aujourd’hui</p>
              <ul className="mt-1 space-y-1 text-[11.5px] leading-relaxed text-slate-600">
                <li>· Séries générées localement, aucun appel satellite.</li>
                <li>· Comptes et pièces stockés dans le navigateur, par appareil.</li>
                <li>· Mots de passe de démonstration publics (<span className="font-mono">demo1234</span>).</li>
                <li>· PDF produit dans le navigateur, sans horodatage qualifié.</li>
                <li>· Aucune valeur légale ni contractuelle.</li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500">En production</p>
              <ul className="mt-1 space-y-1 text-[11.5px] leading-relaxed text-slate-600">
                <li>· Boîtier certifié et scellé, identité du kit vérifiée.</li>
                <li>· Images Sentinel-1/2 réelles, horodatées à la source.</li>
                <li>· Signature côté serveur et journal d’audit inaltérable.</li>
                <li>· Authentification forte et politique de conservation.</li>
                <li>· Méthode validée par l’institution financière.</li>
              </ul>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
