/**
 * Modèle public de la démonstration « Le champ virtuel ».
 *
 * Les chiffres du Score Vert sont ceux du moteur AgriTwin (35 / 25 / 20 / 20,
 * seuils 75 et 50) ; le sol de la parcelle est celui du jeu de données
 * (EC 1,65 dS/m, pH 6,8). La démo est isolée : elle ne signe aucun relevé et
 * n'écrit donc jamais dans la chaîne SHA-256 du dossier certifié.
 */

export type Layer = 'zones' | 'ndvi' | 'radar';
export type Mode = 'orbit' | 'walk';

export const SCORE_WEIGHTS = { water: 35, vegetation: 25, soil: 20, integrity: 20 } as const;
export const ELIGIBLE_THRESHOLD = 75;
export const REVIEW_THRESHOLD = 50;

export const FIELD_SOIL = { ec: 1.65, ph: 6.8 } as const;

/** Trois zones pédoclimatiques de la parcelle de Bambey (1,5 ha). */
export const BANDS = [
  { key: 'north', label: 'Z1 Nord', detail: 'Sableuse sèche', tone: 'amber' },
  { key: 'centre', label: 'Z2 Centre', detail: 'Optimale', tone: 'leaf' },
  { key: 'south', label: 'Z3 Sud', detail: 'Légèrement saline', tone: 'sand' },
] as const;

export interface Slot {
  x: number;
  z: number;
  zone: string;
  /** Empreinte du scellé prévue au registre de la coopérative. */
  seal: string;
}

/** Emplacements optimaux : un point de mesure par zone pédoclimatique. */
export const SLOTS: Slot[] = [
  { x: -6, z: -38, zone: 'Nord', seal: 'a41f9c7d2b8e5f30' },
  { x: 4, z: 0, zone: 'Centre', seal: '7e2b9d4c1f60a835' },
  { x: 12, z: 38, zone: 'Sud', seal: 'c85a3e17d94b206f' },
];

/** Le scellé qui ne concorde pas avec le registre (sonde Nord). */
export const TAMPERED_SLOT = 0;

export type MissionId = 'scan' | 'sensors' | 'kit' | 'water' | 'fraud';

export interface Objective {
  id: string;
  label: string;
}

export interface Mission {
  id: MissionId;
  index: number;
  kicker: string;
  title: string;
  brief: string;
  objectives: Objective[];
  hint: string;
}

export const MISSIONS: Mission[] = [
  {
    id: 'scan',
    index: 1,
    kicker: 'Le diagnostic',
    title: 'Lire le sol depuis l’espace',
    brief:
      'Sentinel-2 mesure la vigueur des plants, Sentinel-1 l’humidité sous la surface. Activez les deux calques, puis revenez aux zones pédoclimatiques.',
    objectives: [
      { id: 'ndvi', label: 'Calque végétation (NDVI)' },
      { id: 'radar', label: 'Calque humidité radar' },
      { id: 'zones', label: 'Revenir aux trois zones' },
    ],
    hint: 'Les trois pastilles de calques sont en bas à gauche de l’écran.',
  },
  {
    id: 'sensors',
    index: 2,
    kicker: 'Les capteurs',
    title: 'Choisir les trois points de mesure',
    brief:
      'Trois sols, trois comportements. Rejoignez chaque balise et plantez la sonde : la coupe du sol s’ouvre sous vos pieds.',
    objectives: SLOTS.map((slot, index) => ({
      id: `slot-${index}`,
      label: `Sonde plantée en zone ${slot.zone}`,
    })),
    hint: 'Suivez le faisceau vertical d’une balise, approchez-vous, puis appuyez sur E.',
  },
  {
    id: 'kit',
    index: 3,
    kicker: 'L’installation',
    title: 'Raccorder le kit au boîtier',
    brief:
      'Quatre éléments à monter sur le mât, au pied de la parcelle. Chaque geste allume une voie du boîtier et fait remonter la télémétrie.',
    objectives: [
      { id: 'panel', label: 'Panneau solaire 20 Wc' },
      { id: 'rain', label: 'Pluviomètre à auget' },
      { id: 'link', label: 'Passerelle LoRaWAN' },
      { id: 'seal', label: 'Scellé numéroté' },
    ],
    hint: 'Le mât est au nord-ouest, à l’angle du champ. Suivez le faisceau, puis appuyez sur E.',
  },
  {
    id: 'water',
    index: 4,
    kicker: 'La vague de chaleur',
    title: 'Sauver la récolte',
    brief:
      '39,5 °C à l’ombre. L’humidité du sol chute de minute en minute : rejoignez la vanne au pied du boîtier et ouvrez le goutte-à-goutte avant que le sol ne descende sous 14 %.',
    objectives: [
      { id: 'heat', label: 'Alerte chaleur reçue' },
      { id: 'open', label: 'Irrigation ouverte' },
    ],
    hint: 'Le volant rouge est à quelques pas du mât. Appuyez sur E pour ouvrir l’irrigation.',
  },
  {
    id: 'fraud',
    index: 5,
    kicker: 'L’enquête',
    title: 'Démasquer la sonde trafiquée',
    brief:
      'Trois scellés, trois empreintes. L’une ne correspond pas au registre de la coopérative : inspectez chaque sonde, comparez, puis signalez l’intrusion.',
    objectives: [
      { id: 'inspect-0', label: 'Inspecter la sonde Nord' },
      { id: 'inspect-1', label: 'Inspecter la sonde Centre' },
      { id: 'inspect-2', label: 'Inspecter la sonde Sud' },
      { id: 'report', label: 'Signaler le scellé rompu' },
    ],
    hint: 'Chaque sonde porte son étiquette : approchez-vous, puis appuyez sur E pour lire son empreinte.',
  },
];

export interface KitPart {
  id: string;
  label: string;
  detail: string;
}

export const KIT_PARTS: KitPart[] = [
  { id: 'panel', label: 'Panneau solaire', detail: '20 Wc · IP67' },
  { id: 'rain', label: 'Pluviomètre', detail: 'Auget 0,2 mm' },
  { id: 'link', label: 'Passerelle', detail: 'LoRaWAN · 8 km' },
  { id: 'seal', label: 'Scellé', detail: 'SHA-256 chaîné' },
];

export interface Scenario {
  heat: boolean;
  irrigation: boolean;
  tampered: boolean;
}

export interface ScoreBreakdown {
  water: number;
  vegetation: number;
  soil: number;
  integrity: number;
  total: number;
  profile: 'A' | 'B' | 'C';
  verdict: { label: string; tone: 'green' | 'amber' | 'red'; detail: string };
}

export function scoreBreakdown(scenario: Scenario): ScoreBreakdown {
  let water = 14;
  let vegetation = 20;
  if (scenario.heat) {
    water = 8;
    vegetation = 12;
  }
  if (scenario.irrigation) {
    water = 32;
    vegetation = 20;
  }
  const soil = 14;
  const integrity = scenario.tampered ? 0 : 20;
  const total = water + vegetation + soil + integrity;
  const profile = total >= ELIGIBLE_THRESHOLD ? 'A' : total >= REVIEW_THRESHOLD ? 'B' : 'C';

  const verdict = scenario.tampered
    ? {
        label: 'Décaissement bloqué',
        tone: 'red' as const,
        detail:
          'Empreinte SHA-256 non concordante et scellé rompu : le dossier bancaire est verrouillé jusqu’à l’inspection physique.',
      }
    : total >= ELIGIBLE_THRESHOLD
      ? {
          label: 'Éligible — tranche 2 autorisée',
          tone: 'green' as const,
          detail: 'Régularité hydrique confirmée, chaîne cryptographique intacte.',
        }
      : total >= REVIEW_THRESHOLD
        ? {
            label: 'Éligible sous suivi coopératif',
            tone: 'amber' as const,
            detail: 'Profil technique acceptable : contre-visite du technicien avant décaissement.',
          }
        : {
            label: 'Décaissement suspendu',
            tone: 'red' as const,
            detail: 'Stress hydrique sévère : le dossier repasse en revue avant toute nouvelle tranche.',
          };

  return { water, vegetation, soil, integrity, total, profile, verdict };
}

/** Humidité de départ, plancher et plafond après irrigation (en % volumique). */
export const MOISTURE = { start: 28.4, floor: 12.6, irrigated: 31.6, alarm: 14 } as const;

/** Durée avant que la parcelle atteigne le plancher (secondes). */
export const HEAT_COUNTDOWN = 95;

export const VOICE = {
  heat: {
    wolof:
      'Tàng bi dafa ëmb, ndox mi ci suuf bi dafa wàññi : fukk ak juroom-benn pour cent. Joxe ndox léegi, te naanal plant yi.',
    fr: 'La chaleur est accablante et l’eau du sol est tombée à seize pour cent. Irriguez immédiatement.',
  },
  irrigation: {
    wolof: 'Ndox mi dellusi na ci suuf bi. Tool bi dafa wér, Score Vert bi yéex na.',
    fr: 'L’eau est revenue dans le sol. La parcelle va mieux, le Score Vert remonte.',
  },
  fraud: {
    wolof: 'Sonde bi ñu kàcc ko. Dossier crédit bi ñu ko tëye ba teknisiën bi ñów.',
    fr: 'La sonde a été arrachée. Le dossier de crédit est verrouillé jusqu’à la visite du technicien.',
  },
} as const;

/** Empreinte réelle (SHA-256) du relevé présenté au public. */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function shortSeal(seal: string): string {
  return `${seal.slice(0, 4)}·${seal.slice(4, 8)}·${seal.slice(8, 12)}`;
}
