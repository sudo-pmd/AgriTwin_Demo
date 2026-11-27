import * as turf from '@turf/turf';
import type {
  GeoPoint,
  Parcel,
  ParcelDataset,
  ParcelId,
  ParcelZone,
  PestReport,
  ZoneId,
  ZoneStatus,
  FertilizerEntry,
  TelemetryRecord,
  CropKey,
  CropSpec,
  ParcelConfig,
} from '../types/agritwin';

export const HISTORY_DAYS = 90;

const TODAY = new Date(2026, 10, 22, 8, 0, 0);

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function timestampFor(dayIndex: number): string {
  const date = new Date(TODAY.getTime());
  date.setDate(date.getDate() - (HISTORY_DAYS - 1 - dayIndex));
  return date.toISOString();
}

export function dateFor(dayIndex: number): string {
  return timestampFor(dayIndex);
}

function smoothstep(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

function zoneStatus(moisture: number, ec: number): ZoneStatus {
  if (moisture < 20 || ec > 2.0) return 'critique';
  if (moisture < 22 || ec > 1.5) return 'vigilance';
  return 'optimal';
}

/* ------------------------------------------------------------------ */
/* Géométrie                                                           */
/* ------------------------------------------------------------------ */

function buildBoundary(center: GeoPoint, areaHa: number): [number, number][] {
  const radiusKm = Math.sqrt((areaHa * 10_000) / Math.PI) / 1000;
  const base = turf.circle([center.lng, center.lat], radiusKm, {
    steps: 6,
    units: 'kilometers',
  });
  const scale = Math.sqrt((areaHa * 10_000) / turf.area(base));
  const scaled = turf.transformScale(base, scale) as GeoJSON.Feature<GeoJSON.Polygon>;
  return scaled.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
}

interface ZoneSeed {
  ndvi: number;
  moisture: number;
  ec: number;
  reference?: boolean;
}

const ZONE_IDS: ZoneId[] = ['Z1', 'Z2', 'Z3'];
const ZONE_LABELS = ['Z1 Nord', 'Z2 Centre', 'Z3 Sud'];

/**
 * Découpe le contour en trois bandes homogènes Nord / Centre / Sud,
 * puis place la sonde recommandée au barycentre de chaque bande.
 */
export function splitIntoZones(
  boundary: [number, number][],
  seeds: ZoneSeed[],
  deviceId: string,
): ParcelZone[] {
  const boundaryFeature = turf.polygon([boundary.map(([lat, lng]) => [lng, lat])]);
  const [minX, minY, maxX, maxY] = turf.bbox(boundaryFeature);
  const bandHeight = (maxY - minY) / 3;

  return ZONE_IDS.map((id, index) => {
    const seed = seeds[index];
    const bandIndex = 2 - index;
    const band = turf.bboxPolygon([
      minX,
      minY + bandHeight * bandIndex,
      maxX,
      minY + bandHeight * (bandIndex + 1),
    ]);

    const clipped = turf.intersect(
      turf.featureCollection([boundaryFeature, band]) as never,
    ) as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null;

    const geometry = clipped?.geometry ?? band.geometry;
    const ringSource =
      geometry.type === 'MultiPolygon'
        ? geometry.coordinates[0][0]
        : (geometry as GeoJSON.Polygon).coordinates[0];

    const centroid = turf.centroid(clipped ?? band).geometry.coordinates;

    return {
      id,
      label: ZONE_LABELS[index],
      ndvi: seed.ndvi,
      moisture: seed.moisture,
      status: zoneStatus(seed.moisture, seed.ec),
      ring: ringSource.map(([lng, lat]) => [lat, lng] as [number, number]),
      probe: { lat: centroid[1], lng: centroid[0] },
      probeLabel: seed.reference ? `${deviceId} · sonde témoin` : `${deviceId} · sonde ${id}`,
      isReferenceProbe: Boolean(seed.reference),
    } satisfies ParcelZone;
  });
}

export function ringsToGeoJson(rings: { ring: [number, number][] }[]) {
  return rings.map((zone) => zone.ring.map(([lat, lng]) => [lng, lat]));
}

/* ------------------------------------------------------------------ */
/* Séries de télémétrie                                                */
/* ------------------------------------------------------------------ */

interface SeriesDefinition {
  deviceId: string;
  moisture15: (day: number) => number;
  moisture35: (day: number) => number;
  soilTemp: (day: number) => number;
  airTemp: (day: number) => number;
  airHumidity: (day: number) => number;
  ec: (day: number) => number;
  ph: (day: number) => number;
  ndvi: (day: number) => number;
  ndviReference: (day: number) => number;
  rainfall: Record<number, number>;
  irrigationEvery: number;
  irrigationAmount: number;
  batteryBase: number;
}

function buildRecords(parcelId: ParcelId, definition: SeriesDefinition): TelemetryRecord[] {
  const records: TelemetryRecord[] = [];
  for (let day = 0; day < HISTORY_DAYS; day += 1) {
    const moisture15 = round1(definition.moisture15(day));
    const sentinel1Humidity = round1(
      Math.max(5, Math.min(45, moisture15 * 0.95 + 2.5)),
    );
    records.push({
      id: `${parcelId}-BLK-${String(day + 1).padStart(3, '0')}`,
      timestamp: timestampFor(day),
      dayIndex: day,
      deviceId: definition.deviceId,
      moisture15,
      moisture35: round1(definition.moisture35(day)),
      soilTemp: round1(definition.soilTemp(day)),
      airTemp: round1(definition.airTemp(day)),
      airHumidity: Math.round(definition.airHumidity(day)),
      rainfall: definition.rainfall[day] ?? 0,
      irrigation: day % definition.irrigationEvery === 0 ? definition.irrigationAmount : 0,
      ec: round2(definition.ec(day)),
      ph: round2(definition.ph(day)),
      battery: Math.max(
        72,
        Math.round(definition.batteryBase - day * 0.09 + Math.sin(day * 0.5) * 2),
      ),
      sealOk: true,
      accelerometerMotion: false,
      rssi: -68 - Math.round(Math.abs(Math.sin(day * 0.37)) * 18),
      ndvi: round3(definition.ndvi(day)),
      ndviReference: round3(definition.ndviReference(day)),
      sentinel1Humidity,
      source: 'sensor',
    });
  }
  return records;
}

/* ------------------------------------------------------------------ */
/* Exploitation 1 — Bambey                                             */
/* ------------------------------------------------------------------ */

const BAMBEY_CENTER: GeoPoint = { lat: 14.7005, lng: -16.4676 };

function bambeyMoisture15(day: number): number {
  if (day <= 19) return 17.6 + day * 0.055;
  if (day <= 70) return 27 + 3.2 * Math.sin(day * 0.31) + 1.2 * Math.sin(day * 0.09);
  if (day >= 89) return 19.2;
  return 19.8 - (day - 70) * 0.033;
}

const bambeyZones: ZoneSeed[] = [
  { ndvi: 0.703, moisture: 19.2, ec: 1.2 },
  { ndvi: 0.766, moisture: 27.4, ec: 1.18, reference: true },
  { ndvi: 0.751, moisture: 26.1, ec: 1.17 },
];

const bambeyBoundary = buildBoundary(BAMBEY_CENTER, 1.5);

const BAMBEY: Parcel = {
  id: 'PARC-BMB-001',
  name: 'Parcelle Pilote Bambey — Coopérative Baol',
  shortName: 'Parcelle Pilote Bambey',
  owner: 'Moussa Diop',
  ownerRole: 'Exploitant individuel',
  mode: 'Individuel',
  center: BAMBEY_CENTER,
  gpsLabel: '14.7005° N, 16.4676° O — Région de Bambey (UADB)',
  areaHa: 1.5,
  soilType: 'Sablo-argileux (Dior)',
  crop: {
    name: 'Oignon',
    variety: 'Violet de Galmi',
    yMax: 32.0,
    pricePerTon: 250_000,
    baseCostPerHa: 180_000,
    waterPerHa: 4200,
    sowingDate: '2026-09-15',
    nitrogenNeed: 120,
  },
  kitSerial: 'KIT-AGRI-8842',
  kitInstalled: '2026-08-28',
  boundary: bambeyBoundary,
  zones: splitIntoZones(bambeyBoundary, bambeyZones, 'KIT-AGRI-8842'),
  probeCount: 1,
  ownerAccountId: 'acc-demo-exploitant',
  verification: {
    status: 'verifie',
    submittedAt: '2026-08-20T09:10:00.000Z',
    reviewedAt: '2026-08-26T14:20:00.000Z',
    reviewer: 'Ibrahima Fall · conformité AgriTwin',
    note: 'Titre foncier et bail coopératif concordants, contour vérifié sur orthophoto.',
  },
  documents: [
    {
      id: 'DOC-BMB-01',
      kind: 'identite',
      label: "Pièce d'identité",
      fileName: 'cni-moussa-diop.pdf',
      size: 184_320,
      mime: 'application/pdf',
      uploadedAt: '2026-08-20T09:02:00.000Z',
      status: 'verifie',
    },
    {
      id: 'DOC-BMB-02',
      kind: 'foncier',
      label: 'Titre foncier ou bail',
      fileName: 'bail-cooperative-baol.pdf',
      size: 421_504,
      mime: 'application/pdf',
      uploadedAt: '2026-08-20T09:04:00.000Z',
      status: 'verifie',
    },
    {
      id: 'DOC-BMB-03',
      kind: 'photo',
      label: 'Photo de la parcelle',
      fileName: 'parcelle-bambey-sud.jpg',
      size: 1_248_000,
      mime: 'image/jpeg',
      uploadedAt: '2026-08-20T09:06:00.000Z',
      status: 'verifie',
    },
  ],
};

const BAMBEY_RECORDS = buildRecords('PARC-BMB-001', {
  deviceId: 'KIT-AGRI-8842',
  moisture15: bambeyMoisture15,
  moisture35: (day) => bambeyMoisture15(day) + 5.2 + 1.1 * Math.sin(day * 0.2),
  soilTemp: (day) => 26.4 + 2.2 * Math.sin(day * 0.19),
  airTemp: (day) => 29 + 3.6 * Math.sin(day * 0.21) + 1.1 * Math.sin(day * 0.77),
  airHumidity: (day) => 64 + 9 * Math.sin(day * 0.23),
  ec: (day) => 1.05 + 0.15 * (day / 89),
  ph: (day) => 6.7 + 0.12 * Math.sin(day * 0.14),
  ndvi: (day) => 0.25 + 0.49 * smoothstep(day / 89),
  ndviReference: (day) => 0.27 + 0.53 * smoothstep(day / 89),
  rainfall: { 14: 2.5, 41: 3.5, 67: 18, 82: 2 },
  irrigationEvery: 4,
  irrigationAmount: 6,
  batteryBase: 97,
});

const BAMBEY_FERTILIZERS: FertilizerEntry[] = [
  {
    id: 'FERT-BMB-01',
    date: timestampFor(30),
    type: 'NPK 10-10-20',
    quantityKg: 150,
    nitrogenKgHa: round1((150 * 0.1) / 1.5),
  },
  {
    id: 'FERT-BMB-02',
    date: timestampFor(62),
    type: 'Urée 46%',
    quantityKg: 100,
    nitrogenKgHa: round1((100 * 0.46) / 1.5),
  },
];

/* ------------------------------------------------------------------ */
/* Exploitation 2 — Niayes-Sud                                         */
/* ------------------------------------------------------------------ */

const NIAYES_CENTER: GeoPoint = { lat: 14.845, lng: -17.162 };

function niayesMoisture15(day: number): number {
  if (day <= 39) return 18.3 + day * 0.03 + 0.45 * Math.sin(day * 0.6);
  if (day <= 75) return 26.5 + 2.6 * Math.sin(day * 0.27) + 1.0 * Math.sin(day * 0.71);
  return 19.6 - (day - 76) * 0.09;
}

const niayesZones: ZoneSeed[] = [
  { ndvi: 0.712, moisture: 23.4, ec: 1.65 },
  { ndvi: 0.742, moisture: 25.1, ec: 1.6, reference: true },
  { ndvi: 0.727, moisture: 22.8, ec: 1.68 },
];

const niayesBoundary = buildBoundary(NIAYES_CENTER, 6);

const NIAYES: Parcel = {
  id: 'PARC-NYS-002',
  name: 'Bloc Coopératif Niayes-Sud (8 producteurs mutualisés)',
  shortName: 'Bloc Coopératif Niayes-Sud',
  owner: 'Fatou Ndiaye',
  ownerRole: 'Présidente de groupement',
  mode: 'Coopératif (HaaS)',
  center: NIAYES_CENTER,
  gpsLabel: '14.8450° N, 17.1620° O — Zone maraîchère des Niayes',
  areaHa: 6,
  soilType: 'Sableux littoral (Niayes) — 8 parcelles de 0,75 ha',
  crop: {
    name: 'Tomate',
    variety: 'Mongal F1',
    yMax: 40.0,
    pricePerTon: 220_000,
    baseCostPerHa: 240_000,
    waterPerHa: 5200,
    sowingDate: '2026-09-20',
    nitrogenNeed: 150,
  },
  kitSerial: 'KIT-AGRI-9104',
  kitInstalled: '2026-09-02',
  boundary: niayesBoundary,
  zones: splitIntoZones(niayesBoundary, niayesZones, 'KIT-AGRI-9104'),
  producerCount: 8,
  probeCount: 1,
  ownerAccountId: 'acc-demo-exploitant',
  verification: {
    status: 'verifie',
    submittedAt: '2026-08-24T10:30:00.000Z',
    reviewedAt: '2026-08-30T11:05:00.000Z',
    reviewer: 'Ibrahima Fall · conformité AgriTwin',
    note: 'Convention de groupement et plan de découpage des 8 parcelles validés.',
  },
  documents: [
    {
      id: 'DOC-NYS-01',
      kind: 'identite',
      label: "Pièce d'identité",
      fileName: 'cni-fatou-ndiaye.pdf',
      size: 199_680,
      mime: 'application/pdf',
      uploadedAt: '2026-08-24T10:12:00.000Z',
      status: 'verifie',
    },
    {
      id: 'DOC-NYS-02',
      kind: 'foncier',
      label: 'Titre foncier ou bail',
      fileName: 'convention-groupement-niayes.pdf',
      size: 512_000,
      mime: 'application/pdf',
      uploadedAt: '2026-08-24T10:14:00.000Z',
      status: 'verifie',
    },
  ],
};

const NIAYES_RECORDS = buildRecords('PARC-NYS-002', {
  deviceId: 'KIT-AGRI-9104',
  moisture15: niayesMoisture15,
  moisture35: (day) => niayesMoisture15(day) + 4.6 + 0.9 * Math.sin(day * 0.24),
  soilTemp: (day) => 27.2 + 2.0 * Math.sin(day * 0.17),
  airTemp: (day) => 30.2 + 3.1 * Math.sin(day * 0.2) + 1.0 * Math.sin(day * 0.66),
  airHumidity: (day) => 70 + 8 * Math.sin(day * 0.25),
  ec: (day) => 1.48 + 0.17 * (day / 89),
  ph: (day) => 6.32 + 0.1 * Math.sin(day * 0.16),
  ndvi: (day) =>
    0.22 + 0.52 * smoothstep(day / 89) - 0.018 * Math.exp(-Math.pow((day - 86) / 3, 2)),
  ndviReference: (day) => 0.25 + 0.55 * smoothstep(day / 89),
  rainfall: { 12: 5, 30: 4, 48: 11, 63: 6, 74: 2 },
  irrigationEvery: 3,
  irrigationAmount: 7,
  batteryBase: 95,
});

const NIAYES_FERTILIZERS: FertilizerEntry[] = [
  {
    id: 'FERT-NYS-01',
    date: timestampFor(28),
    type: 'NPK 10-10-20',
    quantityKg: 1200,
    nitrogenKgHa: round1((1200 * 0.1) / 6),
  },
  {
    id: 'FERT-NYS-02',
    date: timestampFor(58),
    type: 'Urée 46%',
    quantityKg: 600,
    nitrogenKgHa: round1((600 * 0.46) / 6),
  },
];

const NIAYES_PESTS: PestReport[] = [
  {
    id: 'PEST-NYS-01',
    date: timestampFor(86),
    type: 'Thrips',
    severity: 'modérée',
    note: 'Foyers localisés sur la parcelle 4 du bloc, traitement localisé en cours.',
  },
];

/* ------------------------------------------------------------------ */
/* Datasets                                                            */
/* ------------------------------------------------------------------ */

export type SeedDatasets = Record<ParcelId, ParcelDataset>;

export function buildSeedDatasets(): SeedDatasets {
  return {
    'PARC-BMB-001': {
      parcel: BAMBEY,
      records: BAMBEY_RECORDS.map((record) => ({ ...record })),
      fertilizers: BAMBEY_FERTILIZERS.map((entry) => ({ ...entry })),
      pests: [],
      consent: true,
      frozen: false,
      simulationActive: false,
    },
    'PARC-NYS-002': {
      parcel: NIAYES,
      records: NIAYES_RECORDS.map((record) => ({ ...record })),
      fertilizers: NIAYES_FERTILIZERS.map((entry) => ({ ...entry })),
      pests: NIAYES_PESTS.map((entry) => ({ ...entry })),
      consent: false,
      frozen: false,
      simulationActive: false,
    },
  };
}

export const PARCELS: Parcel[] = [BAMBEY, NIAYES];

export function parcelZonePolygons(parcel: Parcel): number[][][][] {
  return parcel.zones.map((zone) => [zone.ring.map(([lat, lng]) => [lng, lat])]);
}

/* ------------------------------------------------------------------ */
/* Parcelles déclarées par un exploitant                               */
/* ------------------------------------------------------------------ */

export const CROP_CATALOG: Record<CropKey, { label: string; spec: CropSpec }> = {
  oignon: {
    label: 'Oignon — Violet de Galmi',
    spec: {
      name: 'Oignon',
      variety: 'Violet de Galmi',
      yMax: 32,
      pricePerTon: 250_000,
      baseCostPerHa: 180_000,
      waterPerHa: 4200,
      sowingDate: '2026-09-15',
      nitrogenNeed: 120,
    },
  },
  tomate: {
    label: 'Tomate — Mongal F1',
    spec: {
      name: 'Tomate',
      variety: 'Mongal F1',
      yMax: 40,
      pricePerTon: 220_000,
      baseCostPerHa: 240_000,
      waterPerHa: 5200,
      sowingDate: '2026-09-20',
      nitrogenNeed: 150,
    },
  },
  arachide: {
    label: 'Arachide — 55-437',
    spec: {
      name: 'Arachide',
      variety: '55-437',
      yMax: 1.9,
      pricePerTon: 320_000,
      baseCostPerHa: 95_000,
      waterPerHa: 2600,
      sowingDate: '2026-07-05',
      nitrogenNeed: 40,
    },
  },
  mil: {
    label: 'Mil — Souna 3',
    spec: {
      name: 'Mil',
      variety: 'Souna 3',
      yMax: 1.6,
      pricePerTon: 180_000,
      baseCostPerHa: 70_000,
      waterPerHa: 2200,
      sowingDate: '2026-07-12',
      nitrogenNeed: 30,
    },
  },
  piment: {
    label: 'Piment — sélection locale',
    spec: {
      name: 'Piment',
      variety: 'Sélection locale',
      yMax: 12,
      pricePerTon: 400_000,
      baseCostPerHa: 210_000,
      waterPerHa: 4800,
      sowingDate: '2026-09-05',
      nitrogenNeed: 110,
    },
  },
};

function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function boundaryForConfig(config: ParcelConfig): [number, number][] {
  const boundary =
    config.boundary.length >= 3
      ? config.boundary
      : buildBoundary(config.centre, Math.max(0.1, config.areaHa));
  const [first] = boundary;
  const [last] = boundary.slice(-1);
  // Un anneau dessiné à la main n'est pas refermé : turf exige premier = dernier point.
  return first[0] === last[0] && first[1] === last[1] ? boundary : [...boundary, first];
}

/**
 * Fabrique une exploitation complète à partir de la déclaration de
 * l'exploitant. Les 90 jours sont générés de façon déterministe à partir
 * de la graine de la parcelle, et marqués comme simulation tant que le
 * boîtier n'a pas été posé par un technicien.
 */
export function buildConfigDataset(config: ParcelConfig): ParcelDataset {
  const crop = CROP_CATALOG[config.cropKey].spec;
  const rand = mulberry32(config.seed);
  const boundary = boundaryForConfig(config);
  const kitSerial = `KIT-AGRI-${String(4100 + (config.seed % 4800)).padStart(4, '0')}`;
  const phase = rand() * Math.PI * 2;
  const ecBase = 0.95 + rand() * 0.35;
  const zoneNdvi = 0.72 + rand() * 0.05;
  const zoneMoisture = 24.5 + rand() * 2.5;

  const parcel: Parcel = {
    id: config.id,
    name: config.name,
    shortName: config.name.length > 38 ? `${config.name.slice(0, 36)}…` : config.name,
    owner: config.ownerName,
    ownerRole: config.ownerRole,
    mode: 'Individuel',
    center: config.centre,
    gpsLabel: `${config.centre.lat.toFixed(4)}° N, ${Math.abs(config.centre.lng).toFixed(
      4,
    )}° O — ${config.soilType}`,
    areaHa: config.areaHa,
    soilType: config.soilType,
    crop: { ...crop, sowingDate: '2026-09-15' },
    kitSerial,
    kitInstalled: config.createdAt.slice(0, 10),
    boundary,
    zones: splitIntoZones(
      boundary,
      [
        { ndvi: zoneNdvi * 0.95, moisture: zoneMoisture - 1.6, ec: ecBase },
        { ndvi: zoneNdvi, moisture: zoneMoisture, ec: ecBase, reference: true },
        { ndvi: zoneNdvi * 0.98, moisture: zoneMoisture + 0.7, ec: ecBase },
      ],
      kitSerial,
    ),
    probeCount: 1,
    ownerAccountId: config.accountId,
    verification: config.verification,
    documents: config.documents,
  };

  const rainfall: Record<number, number> = {};
  for (let day = 0; day < HISTORY_DAYS; day += 1) {
    if (rand() > 0.93) rainfall[day] = round1(2 + rand() * 14);
  }

  const records = buildRecords(config.id, {
    deviceId: kitSerial,
    moisture15: (day) => {
      const base = 24.6 + 3.3 * Math.sin(day * 0.27 + phase) + 1.1 * Math.sin(day * 0.71);
      const dry = day > 82 ? (day - 82) * 0.3 : 0;
      return Math.max(15.8, base - dry);
    },
    moisture35: (day) =>
      27 + 2.4 * Math.sin(day * 0.22 + phase) + 1.0 * Math.sin(day * 0.5) - (day > 82 ? (day - 82) * 0.16 : 0),
    soilTemp: (day) => 26.8 + 2.1 * Math.sin(day * 0.18 + phase),
    airTemp: (day) => 29.8 + 3.4 * Math.sin(day * 0.2) + 1.0 * Math.sin(day * 0.68 + phase),
    airHumidity: (day) => 63 + 9 * Math.sin(day * 0.23 + phase),
    ec: (day) => ecBase + 0.18 * (day / 89),
    ph: (day) => 6.5 + 0.18 * Math.sin(day * 0.15 + phase),
    ndvi: (day) => 0.23 + 0.5 * smoothstep(day / 89),
    ndviReference: (day) => 0.26 + 0.53 * smoothstep(day / 89),
    rainfall,
    irrigationEvery: 3,
    irrigationAmount: 6,
    batteryBase: 96,
  });

  return {
    parcel,
    records,
    fertilizers: [],
    pests: [],
    consent: false,
    frozen: false,
    simulationActive: true,
  };
}
