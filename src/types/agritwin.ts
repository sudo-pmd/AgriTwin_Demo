export type ParcelId = string;

export type AccountRole = 'exploitant' | 'financeur' | 'verificateur';

export type CropKey = 'oignon' | 'tomate' | 'arachide' | 'mil' | 'piment';

export type DocumentKind = 'identite' | 'foncier' | 'exploitation' | 'photo';

export type DocumentStatus = 'en_attente' | 'verifie' | 'rejete';

export type VerificationStatus = 'brouillon' | 'soumis' | 'verifie' | 'rejete';

export interface ParcelDocument {
  id: string;
  kind: DocumentKind;
  label: string;
  fileName: string;
  size: number;
  mime: string;
  uploadedAt: string;
  status: DocumentStatus;
  note?: string;
}

export interface ParcelVerification {
  status: VerificationStatus;
  submittedAt?: string;
  reviewedAt?: string;
  reviewer?: string;
  note?: string;
}

export interface ParcelConfig {
  id: string;
  accountId: string;
  name: string;
  ownerName: string;
  ownerRole: string;
  centre: GeoPoint;
  areaHa: number;
  boundary: [number, number][];
  cropKey: CropKey;
  soilType: string;
  seed: number;
  createdAt: string;
  documents: ParcelDocument[];
  verification: ParcelVerification;
}

export type ZoneId = 'Z1' | 'Z2' | 'Z3';

export type ZoneStatus = 'optimal' | 'vigilance' | 'critique';

export type DataSource = 'sensor' | 'simulation';

export type AlertSeverity = 'critique' | 'vigilance' | 'info';

export type SatelliteCheck = 'consistent' | 'gap';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ParcelZone {
  id: ZoneId;
  label: string;
  ndvi: number;
  moisture: number;
  status: ZoneStatus;
  /** Leaflet order: [lat, lng] */
  ring: [number, number][];
  probe: GeoPoint;
  probeLabel: string;
  isReferenceProbe: boolean;
}

export interface CropSpec {
  name: string;
  variety: string;
  /** Rendement potentiel t/ha */
  yMax: number;
  /** FCFA / tonne */
  pricePerTon: number;
  /** FCFA / ha */
  baseCostPerHa: number;
  /** m3 / ha pour l'itinéraire de référence */
  waterPerHa: number;
  sowingDate: string;
  /** Besoin azoté total du cycle, kg N/ha */
  nitrogenNeed: number;
}

export interface Parcel {
  id: ParcelId;
  name: string;
  shortName: string;
  owner: string;
  ownerRole: string;
  mode: 'Individuel' | 'Coopératif (HaaS)';
  center: GeoPoint;
  gpsLabel: string;
  areaHa: number;
  soilType: string;
  crop: CropSpec;
  kitSerial: string;
  kitInstalled: string;
  boundary: [number, number][];
  zones: ParcelZone[];
  producerCount?: number;
  probeCount: number;
  ownerAccountId?: string;
  verification: ParcelVerification;
  documents: ParcelDocument[];
}

export interface TelemetryRecord {
  id: string;
  timestamp: string;
  /** 0 = J-89, 89 = aujourd'hui */
  dayIndex: number;
  deviceId: string;
  moisture15: number;
  moisture35: number;
  soilTemp: number;
  airTemp: number;
  airHumidity: number;
  rainfall: number;
  irrigation: number;
  ec: number;
  ph: number;
  battery: number;
  sealOk: boolean;
  accelerometerMotion: boolean;
  rssi: number;
  ndvi: number;
  ndviReference: number;
  sentinel1Humidity: number;
  source: DataSource;
  prevHash?: string;
  hash?: string;
}

export interface FertilizerEntry {
  id: string;
  date: string;
  type: 'NPK 10-10-20' | 'Urée 46%' | 'Fumure organique';
  quantityKg: number;
  /** kg N / ha apportés (estimé) */
  nitrogenKgHa: number;
}

export interface PestReport {
  id: string;
  date: string;
  type: 'Chenilles' | 'Thrips' | 'Mildiou' | 'Jaunissement';
  severity: 'faible' | 'modérée' | 'élevée';
  note?: string;
}

export interface AlertMessage {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  /** Texte exact lu par la synthèse vocale française */
  voiceFr: string;
  /** Texte exact affiché et « prononcé » en wolof */
  voiceWolof: string;
  wolofTranslation: string;
}

export interface GreenScoreResult {
  total: number;
  water: number;
  vegetation: number;
  soil: number;
  integrity: number;
  profile: 'A' | 'B' | 'C';
  fraudDetected: boolean;
  satelliteGap: number;
  chainValid: boolean;
  sealOk: boolean;
  waterDaysInRange: number;
  totalDays: number;
}

export type CreditDecision = 'eligible' | 'suivi' | 'suspendu';

export interface CreditVerdict {
  decision: CreditDecision;
  badge: string;
  tone: 'green' | 'amber' | 'red';
  rationale: string;
  rate: string;
}

export interface YieldProjection {
  irrigationDelta: number;
  nitrogen: number;
  calendarShift: number;
  scoreWater: number;
  scoreFertilizer: number;
  scoreCalendar: number;
  scoreSalinity: number;
  yieldTPerHa: number;
  totalProductionT: number;
  grossRevenue: number;
  waterCostPerHa: number;
  waterM3: number;
  totalCost: number;
  netMargin: number;
}

export interface BaselineProjection extends YieldProjection {}

export interface ParcelDataset {
  parcel: Parcel;
  records: TelemetryRecord[];
  fertilizers: FertilizerEntry[];
  pests: PestReport[];
  consent: boolean;
  frozen: boolean;
  simulationActive: boolean;
  lastInjection?: string;
}

export type InjectionKind = 'normal' | 'heat' | 'fraud' | 'tamper';

export interface ChainVerification {
  valid: boolean;
  checked: number;
  total: number;
  brokenAt?: string;
  globalHash: string;
}
