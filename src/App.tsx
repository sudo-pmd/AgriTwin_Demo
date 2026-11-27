import { useEffect, useMemo, useState } from 'react';
import Glyph from './components/ui/Glyph';
import PageHeader from './components/ui/PageHeader';
import AppShell, { type NavSection } from './components/layout/AppShell';
import IoTSimulatorDrawer from './components/layout/IoTSimulatorDrawer';
import ParcelMap from './components/module1-map/ParcelMap';
import KpiCards from './components/module2-monitoring/KpiCards';
import TelemetryCharts from './components/module2-monitoring/TelemetryCharts';
import VoiceAssistant from './components/module2-monitoring/VoiceAssistant';
import AgroJournalModal from './components/module2-monitoring/AgroJournalModal';
import YieldSimulator from './components/module3-simulator/YieldSimulator';
import GreenScoreCard from './components/module4-finance/GreenScoreCard';
import CryptoAuditTable from './components/module4-finance/CryptoAuditTable';
import LenderPortal from './components/module4-finance/LenderPortal';
import ParcelSetup from './components/parcel/ParcelSetup';
import VerificationQueue from './components/verification/VerificationQueue';
import AuthScreen from './components/auth/AuthScreen';
import ScoreMethodology from './components/methodology/ScoreMethodology';
import GuidedDemo from './components/demo/GuidedDemo';
import { DEMO_PARCEL_ID, DEMO_STEPS, createDemoParcel } from './demo/guidedDemo';
import {
  buildConfigDataset,
  buildSeedDatasets,
} from './data/seedData';
import { VOICE_ALERTS, type VoicePhrase } from './data/wolofPhrases';
import {
  DEFAULT_PARAMS,
  nitrogenFromProduct,
  projectYield,
  type FertilizerProduct,
} from './utils/agronomyEngine';
import {
  assuranceStatus,
  computeGreenScore,
  creditVerdict,
} from './utils/greenScoreEngine';
import { signAppend, signRecords, verifyChain, type ChainVerification } from './utils/cryptoChain';
import { generateCreditPdf } from './utils/pdfGenerator';
import { exportEvidenceBundle } from './utils/evidenceBundle';
import verifierHtml from './verification/verifier.html?raw';
import { formatDate, formatNumber } from './utils/format';
import {
  ensureAccounts,
  persistSession,
  resetAccounts,
  restoreSession,
  signOut,
  type Account,
} from './auth/accounts';
import {
  clearParcelStorage,
  loadParcelConfigs,
  purgeOrphanDocuments,
  upsertParcelConfig,
} from './storage/parcels';
import type {
  AlertMessage,
  AlertSeverity,
  GreenScoreResult,
  InjectionKind,
  ParcelConfig,
  ParcelDataset,
  PestReport,
  TelemetryRecord,
  VerificationStatus,
} from './types/agritwin';

const EXPLOITANT_SECTIONS: NavSection[] = [
  {
    key: 'parcel',
    label: 'Ma parcelle',
    glyph: 'parcel',
    hint: 'Déclaration & pièces',
    items: [
      {
        key: 'parcel',
        label: 'Déclaration & pièces',
        glyph: 'parcel',
        hint: 'GPS, pièces justificatives, certification',
      },
    ],
  },
  {
    key: 'exploitation',
    label: 'Exploitation',
    glyph: 'map',
    hint: 'Carte, capteurs, alertes',
    items: [
      { key: 'map', label: 'Carte & zones', glyph: 'map', hint: 'Jumeau numérique de la parcelle' },
      { key: 'monitoring', label: 'Surveillance', glyph: 'sensor', hint: 'Sol, microclimat, bilan minéral' },
      { key: 'alerts', label: 'Alertes', glyph: 'alert', hint: 'Diagnostics et actions correctives' },
    ],
  },
  {
    key: 'decision',
    label: 'Décision',
    glyph: 'flask',
    hint: 'Simulateur de rendement',
    items: [
      { key: 'simulator', label: 'Simulateur', glyph: 'chart', hint: 'Scénarios agronomiques' },
    ],
  },
  {
    key: 'finance',
    label: 'Financement',
    glyph: 'sprout',
    hint: 'Score Vert et preuve',
    items: [
      { key: 'score', label: 'Score Vert', glyph: 'sprout', hint: 'Dossier de crédit et consentement' },
      { key: 'audit', label: 'Preuve & audit', glyph: 'shieldCheck', hint: 'Journal des blocs SHA-256' },
    ],
  },
];

const FINANCEUR_SECTIONS: NavSection[] = [
  {
    key: 'credit',
    label: 'Portefeuille',
    glyph: 'building',
    hint: 'Dossiers certifiés',
    items: [
      { key: 'portal', label: 'Dossiers', glyph: 'building', hint: 'Consultation et export des dossiers' },
    ],
  },
];

const VERIFICATEUR_SECTIONS: NavSection[] = [
  {
    key: 'backoffice',
    label: 'Back-office',
    glyph: 'shieldCheck',
    hint: 'File de vérification',
    items: [
      { key: 'verification', label: 'Vérifications', glyph: 'shieldCheck', hint: 'Contrôle des pièces déposées' },
    ],
  },
];

const METHODOLOGY_SECTION: NavSection = {
  key: 'reference',
  label: 'Référentiel',
  glyph: 'file',
  hint: 'Méthodologie & limites',
  items: [
    {
      key: 'methodology',
      label: 'Méthodologie & limites',
      glyph: 'file',
      hint: 'Formule, seuils, provenance des données',
    },
  ],
};

const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  brouillon: 'Brouillon',
  soumis: 'En vérification',
  verifie: 'Certifiée',
  rejete: 'Rejetée',
};

const VERIFICATION_TONE: Record<VerificationStatus, string> = {
  brouillon: 'border-[#cbd5e1] bg-white text-slate-600',
  soumis: 'border-[#fcd34d] bg-[#fffbeb] text-[#b45309]',
  verifie: 'border-[#bbf7d0] bg-[#f0fdf4] text-forest-700',
  rejete: 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]',
};

function alertFrom(
  id: string,
  severity: AlertSeverity,
  title: string,
  message: string,
  phrase: VoicePhrase,
): AlertMessage {
  return {
    id,
    severity,
    title,
    message,
    voiceFr: phrase.fr,
    voiceWolof: phrase.wolof,
    wolofTranslation: phrase.frTranslation,
  };
}

function deriveAlerts(dataset: ParcelDataset): AlertMessage[] {
  const latest = dataset.records[dataset.records.length - 1];
  const alerts: AlertMessage[] = [];
  const gap = Math.abs(latest.moisture15 - latest.sentinel1Humidity);
  const zone = dataset.parcel.zones.find((item) => item.status === 'critique') ?? dataset.parcel.zones[0];

  if (gap > 15) {
    alerts.push(
      alertFrom(
        'ALR-SAT-01',
        'critique',
        'Anomalie de cohérence sonde / satellite',
        `Écart de ${formatNumber(gap)} points entre la sonde (${formatNumber(
          latest.moisture15,
        )} %) et le radar Sentinel-1 (${formatNumber(
          latest.sentinel1Humidity,
        )} %) alors que la pluviométrie locale est de ${formatNumber(
          latest.rainfall,
        )} mm. La composante intégrité du Score Vert est ramenée à 0/20.`,
        VOICE_ALERTS.fraud,
      ),
    );
  }

  if (!latest.sealOk) {
    alerts.push(
      alertFrom(
        'ALR-SEAL-02',
        'critique',
        'Sécurité physique du boîtier',
        `Le scellé du boîtier ${dataset.parcel.kitSerial} est rompu${
          latest.accelerometerMotion
            ? ' et un mouvement d’arrachement a été détecté par l’accéléromètre'
            : ''
        }. Le dossier de crédit est gelé jusqu’à inspection du technicien.`,
        VOICE_ALERTS.tamper,
      ),
    );
  }

  if (latest.airTemp >= 35 && latest.moisture15 < 20) {
    alerts.push(
      alertFrom(
        'ALR-HEAT-03',
        'critique',
        'Vague de chaleur & stress hydrique',
        `Température de l’air à ${formatNumber(latest.airTemp)} °C et humidité racinaire à ${formatNumber(
          latest.moisture15,
        )} % (zone ${zone.label}). Irrigation immédiate et ombrage des jeunes plants recommandés.`,
        VOICE_ALERTS.heat,
      ),
    );
  } else if (latest.moisture15 < 20) {
    alerts.push(
      alertFrom(
        'ALR-HYD-03',
        'critique',
        'Alerte hydrique active',
        `Humidité du sol à 15 cm : ${formatNumber(latest.moisture15)} % sur la zone ${
          zone.label
        }, sous le seuil critique de 20 % depuis 48 h. Radar Sentinel-1 : ${formatNumber(
          latest.sentinel1Humidity,
        )} %. Irriguez sous 6 heures.`,
        VOICE_ALERTS.hydric,
      ),
    );
  } else if (latest.moisture15 < 22) {
    alerts.push(
      alertFrom(
        'ALR-HYD-04',
        'vigilance',
        'Humidité en baisse',
        `Humidité du sol à 15 cm : ${formatNumber(latest.moisture15)} % — zone de vigilance. Prévoyez une irrigation légère de 10 à 12 mm.`,
        VOICE_ALERTS.hydric,
      ),
    );
  }

  if (latest.ec > 1.5 && !dataset.frozen) {
    alerts.push(
      alertFrom(
        'ALR-SAL-05',
        'vigilance',
        'Salinité du sol en hausse',
        `Conductivité électrique à ${formatNumber(latest.ec, 2)} dS/m, au-dessus du seuil de 1,5 dS/m. Privilégiez un lessivage contrôlé et évitez les apports de chlorure.`,
        VOICE_ALERTS.salinity,
      ),
    );
  }

  const recentPest = dataset.pests.find(
    (report) => new Date(latest.timestamp).getTime() - new Date(report.date).getTime() <= 14 * 86_400_000,
  );
  if (recentPest) {
    alerts.push(
      alertFrom(
        'ALR-PHY-06',
        'vigilance',
        `Signalement phytosanitaire — ${recentPest.type}`,
        `Attaque ${recentPest.severity} consignée le ${formatDate(
          recentPest.date,
        )}. Traitement localisé recommandé ; la baisse de NDVI associée est traitée comme un aléa sanitaire.`,
        VOICE_ALERTS.pest,
      ),
    );
  }

  if (alerts.length === 0) {
    alerts.push(
      alertFrom(
        'ALR-OK',
        'info',
        'Aucune alerte critique',
        'La parcelle présente un état hydrique, minéral et sanitaire satisfaisant. Poursuivez le pilotage actuel.',
        VOICE_ALERTS.allClear,
      ),
    );
  }

  const order: Record<AlertSeverity, number> = { critique: 0, vigilance: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

function SourceBadge({ simulation }: { simulation: boolean }) {
  return (
    <span
      className={`chip ${
        simulation
          ? 'border-[#fcd34d] bg-[#fffbeb] text-[#b45309]'
          : 'border-[#bbf7d0] bg-[#f0fdf4] text-forest-700'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 ${simulation ? 'bg-[#d97706]' : 'bg-forest-600'}`}
        aria-hidden="true"
      />
      {simulation ? 'Simulation démo' : 'Données capteur certifiées'}
    </span>
  );
}

function InfoTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[10px] border border-[#eef3f8] bg-white/70 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-0.5 text-[13px] font-semibold leading-snug text-slateink-800 sm:text-sm">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{detail}</p>
    </div>
  );
}

export default function App() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [configs, setConfigs] = useState<ParcelConfig[]>(() => loadParcelConfigs());
  const [datasets, setDatasets] = useState<Record<string, ParcelDataset> | null>(null);

  // Aucun fichier IndexedDB ne doit survivre à la déclaration qui le référence.
  useEffect(() => {
    const keep = loadParcelConfigs().flatMap((config) =>
      config.documents.map((document) => document.id),
    );
    void purgeOrphanDocuments(keep).catch(() => {
      // Stockage local indisponible (navigation privée) : on n'interrompt pas l'app.
    });
  }, []);
  const [parcelId, setParcelId] = useState('PARC-BMB-001');
  const [tab, setTab] = useState('map');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportedBundle, setExportedBundle] = useState<string | null>(null);
  const [chains, setChains] = useState<Record<string, ChainVerification>>({});
  const [error, setError] = useState<string | null>(null);
  const [demoIndex, setDemoIndex] = useState<number | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);

  // Changer de vue ou de parcelle repart du haut : sinon le nouveau contenu
  // apparaît sous l'en-tête collant, sans son titre.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [tab, parcelId]);

  // Chaque étape de la démo force le rôle et la vue, sans passer par les menus.
  useEffect(() => {
    if (demoIndex === null || !accounts) return;
    const step = DEMO_STEPS[demoIndex];
    const target = accounts.find(
      (item) => item.role === step.role && item.id.startsWith('acc-demo-'),
    );
    if (target && target.id !== account?.id) {
      persistSession(target);
      setAccount(target);
    }
    setTab(step.tab);
    setParcelId(DEMO_PARCEL_ID);
    setError(null);
  }, [demoIndex]);

  useEffect(() => {
    let alive = true;
    void ensureAccounts().then((list) => {
      if (!alive) return;
      setAccounts(list);
      setAccount(restoreSession(list));
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const seed = buildSeedDatasets();
      const custom: Record<string, ParcelDataset> = {};
      for (const config of configs) custom[config.id] = buildConfigDataset(config);
      const merged = { ...seed, ...custom };
      const signed: Record<string, ParcelDataset> = {};
      for (const key of Object.keys(merged)) {
        signed[key] = { ...merged[key], records: await signRecords(merged[key].records) };
      }
      if (alive) setDatasets(signed);
    })();
    return () => {
      alive = false;
    };
  }, [configs]);

  const availableParcels = useMemo(() => {
    if (!datasets || !account) return [];
    const all = Object.values(datasets);
    if (account.role === 'verificateur') return all.map((item) => item.parcel);
    if (account.role === 'financeur') return all.map((item) => item.parcel);
    return all
      .filter((item) => !item.parcel.ownerAccountId || item.parcel.ownerAccountId === account.id)
      .map((item) => item.parcel);
  }, [datasets, account]);

  useEffect(() => {
    if (availableParcels.length === 0) return;
    if (!availableParcels.some((parcel) => parcel.id === parcelId)) {
      setParcelId(availableParcels[0].id);
    }
  }, [availableParcels, parcelId]);

  const dataset =
    datasets && availableParcels.some((parcel) => parcel.id === parcelId)
      ? (datasets[parcelId] ?? null)
      : null;
  const chain = dataset ? chains[dataset.parcel.id] : undefined;

  useEffect(() => {
    if (!dataset) return;
    let alive = true;
    verifyChain(dataset.records).then((verification) => {
      if (alive) {
        setChains((previous) => ({ ...previous, [dataset.parcel.id]: verification }));
      }
    });
    return () => {
      alive = false;
    };
  }, [dataset]);

  const score = useMemo<GreenScoreResult | null>(() => {
    if (!dataset || !chain) return null;
    const latest = dataset.records[dataset.records.length - 1];
    return computeGreenScore({
      records: dataset.records,
      ndvi: latest.ndvi,
      ec: latest.ec,
      ph: latest.ph,
      sealOk: latest.sealOk,
      chainValid: chain.valid,
    });
  }, [dataset, chain]);

  const verdict = useMemo(
    () => (score && dataset ? creditVerdict(score, dataset.frozen) : null),
    [score, dataset],
  );
  const assurance = useMemo(
    () => (score && dataset ? assuranceStatus(dataset, score) : null),
    [score, dataset],
  );
  const alerts = useMemo(() => (dataset ? deriveAlerts(dataset) : []), [dataset]);

  const pestNote = useMemo(() => {
    if (!dataset) return null;
    const latestRecord = dataset.records[dataset.records.length - 1];
    const recent = dataset.pests.find(
      (report) =>
        new Date(latestRecord.timestamp).getTime() - new Date(report.date).getTime() <=
        14 * 86_400_000,
    );
    if (!recent) return null;
    const days = Math.max(
      1,
      Math.round(
        (new Date(latestRecord.timestamp).getTime() - new Date(recent.date).getTime()) / 86_400_000,
      ),
    );
    return `Signalement ${recent.type} (${recent.severity}) il y a ${days} jour(s) : la baisse de NDVI associée est traitée comme un aléa sanitaire et non comme une négligence d’irrigation.`;
  }, [dataset]);

  /** Réinitialisation complète : comptes, session, déclarations, pièces. */
  const resetAll = async () => {
    const fresh = await resetAccounts();
    await clearParcelStorage();
    setAccounts(fresh);
    setConfigs([]);
    setChains({});
    setDrawerOpen(false);
    setJournalOpen(false);
    setPending(false);
    setError(null);
    setTab('map');
    setParcelId('PARC-BMB-001');
    const exploitant = fresh.find((item) => item.role === 'exploitant');
    if (exploitant) {
      persistSession(exploitant);
      setAccount(exploitant);
    }
  };

  const startDemo = async () => {
    const hasOwnData = configs.some((config) => config.id !== DEMO_PARCEL_ID);
    if (
      hasOwnData &&
      !window.confirm(
        'La démo guidée réinitialise tous les comptes et toutes les données locales (parcelles, pièces déposées). Continuer ?',
      )
    ) {
      return;
    }
    setDemoBusy(true);
    try {
      await resetAll();
      setDemoIndex(0);
    } finally {
      setDemoBusy(false);
    }
  };

  if (!accounts) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8fafc] px-6">
        <div className="text-center">
          <img
            src="./agritwin-logo.webp"
            alt="AgriTwin"
            className="mx-auto h-16 w-16 object-contain"
          />
          <p className="mt-4 font-serif text-2xl text-slateink-800">AgriTwin</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Ouverture du registre…
          </p>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <AuthScreen
        onAuthenticated={(next) => {
          persistSession(next);
          setAccount(next);
          setTab(next.role === 'verificateur' ? 'verification' : next.role === 'financeur' ? 'portal' : 'map');
        }}
        onStartDemo={() => void startDemo()}
      />
    );
  }

  if (!datasets) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8fafc] px-6">
        <div className="text-center">
          <p className="font-serif text-2xl text-slateink-800">Préparation du dossier</p>
          <p className="mt-2 text-[12px] text-slate-500">
            Signature et vérification des 90 relevés SHA-256…
          </p>
        </div>
      </div>
    );
  }

  const role = account.role;
  const roleSections =
    role === 'verificateur'
      ? VERIFICATEUR_SECTIONS
      : role === 'financeur'
        ? FINANCEUR_SECTIONS
        : EXPLOITANT_SECTIONS;
  const sections = [...roleSections, METHODOLOGY_SECTION];
  const activeKey = sections.some((section) => section.items.some((item) => item.key === tab))
    ? tab
    : sections[0].items[0].key;

  const parcels = availableParcels;
  const latest = dataset?.records[dataset.records.length - 1];

  const updateDataset = (id: string, updater: (current: ParcelDataset) => ParcelDataset) => {
    setDatasets((previous) =>
      previous ? { ...previous, [id]: updater(previous[id]) } : previous,
    );
  };

  const inject = async (kind: InjectionKind) => {
    if (pending || !dataset) return;
    setPending(true);
    const current = datasets[dataset.parcel.id];
    const currentLatest = current.records[current.records.length - 1];
    const index = current.records.length;
    const record: TelemetryRecord = {
      id: `${current.parcel.id}-SIM-${String(index + 1).padStart(3, '0')}`,
      timestamp: new Date().toISOString(),
      dayIndex: index,
      deviceId: current.parcel.kitSerial,
      moisture15: currentLatest.moisture15,
      moisture35: currentLatest.moisture35,
      soilTemp: currentLatest.soilTemp,
      airTemp: currentLatest.airTemp,
      airHumidity: currentLatest.airHumidity,
      rainfall: 0,
      irrigation: 0,
      ec: currentLatest.ec,
      ph: currentLatest.ph,
      battery: currentLatest.battery,
      sealOk: true,
      accelerometerMotion: false,
      rssi: currentLatest.rssi,
      ndvi: currentLatest.ndvi,
      ndviReference: currentLatest.ndviReference,
      sentinel1Humidity: currentLatest.sentinel1Humidity,
      source: 'simulation',
    };

    let label = 'Relevé normal injecté';
    switch (kind) {
      case 'normal':
        record.moisture15 = 26.5;
        record.moisture35 = 30.1;
        record.ndvi = 0.75;
        record.sentinel1Humidity = 27.2;
        record.airTemp = 31.2;
        record.soilTemp = 27.4;
        record.battery = 96;
        record.rainfall = 0;
        break;
      case 'heat':
        record.airTemp = 39.5;
        record.soilTemp = 34.6;
        record.moisture15 = 14.8;
        record.moisture35 = 16.2;
        record.sentinel1Humidity = 15.6;
        record.airHumidity = 38;
        label = 'Vague de chaleur simulée';
        break;
      case 'fraud':
        record.moisture15 = 44;
        record.moisture35 = 29.4;
        record.sentinel1Humidity = 20.7;
        record.rainfall = 0;
        record.irrigation = 0;
        label = 'Fraude sonde / satellite injectée';
        break;
      case 'tamper':
        record.sealOk = false;
        record.accelerometerMotion = true;
        label = 'Arrachement de boîtier simulé';
        break;
      default:
        break;
    }

    const records = await signAppend(current.records, record);
    updateDataset(dataset.parcel.id, (item) => ({
      ...item,
      records,
      simulationActive: true,
      frozen: kind === 'tamper' ? true : item.frozen,
      lastInjection: label,
    }));
    setPending(false);
  };

  const resetDemo = async () => {
    if (pending || !dataset) return;
    setPending(true);
    const config = configs.find((item) => item.id === dataset.parcel.id);
    const fresh = config ? buildConfigDataset(config) : buildSeedDatasets()[dataset.parcel.id];
    const records = await signRecords(fresh.records);
    updateDataset(dataset.parcel.id, () => ({ ...fresh, records }));
    setPending(false);
  };

  const toggleConsent = (value: boolean) => {
    if (!dataset) return;
    updateDataset(dataset.parcel.id, (item) => ({ ...item, consent: value }));
  };

  const addFertilizer = (input: { type: FertilizerProduct; quantityKg: number; date: string }) => {
    if (!dataset) return;
    updateDataset(dataset.parcel.id, (item) => ({
      ...item,
      fertilizers: [
        {
          id: `FERT-${Date.now()}`,
          date: input.date,
          type: input.type,
          quantityKg: input.quantityKg,
          nitrogenKgHa: nitrogenFromProduct(input.type, input.quantityKg, item.parcel.areaHa),
        },
        ...item.fertilizers,
      ],
    }));
  };

  const addPest = (input: {
    type: PestReport['type'];
    severity: PestReport['severity'];
    note: string;
    date: string;
  }) => {
    if (!dataset) return;
    updateDataset(dataset.parcel.id, (item) => ({
      ...item,
      pests: [{ id: `PEST-${Date.now()}`, ...input }, ...item.pests],
    }));
  };

  const downloadPdf = async () => {
    if (downloading || !dataset || !score || !verdict || !assurance) return;
    const lastRecord = dataset.records[dataset.records.length - 1];
    setDownloading(true);
    setError(null);
    try {
      const projection = projectYield(dataset.parcel, lastRecord.ec, DEFAULT_PARAMS);
      await generateCreditPdf({
        parcel: dataset.parcel,
        dataset,
        score,
        verdict,
        assurance: { label: assurance.label, detail: assurance.detail },
        projection,
        chainHash: chain?.globalHash ?? '',
      });
    } catch (pdfError) {
      console.error(pdfError);
      setError('La génération du PDF a échoué. Vérifiez que le navigateur autorise les téléchargements.');
    } finally {
      setDownloading(false);
    }
  };

  /** Archive autoportante : PDF + preuve.json + vérificateur hors ligne. */
  const exportBundle = async () => {
    if (exporting || !dataset || !score || !verdict || !assurance) return;
    const lastRecord = dataset.records[dataset.records.length - 1];
    setExporting(true);
    setError(null);
    setExportedBundle(null);
    try {
      const projection = projectYield(dataset.parcel, lastRecord.ec, DEFAULT_PARAMS);
      const pdf = await generateCreditPdf(
        {
          parcel: dataset.parcel,
          dataset,
          score,
          verdict,
          assurance: { label: assurance.label, detail: assurance.detail },
          projection,
          chainHash: chain?.globalHash ?? '',
        },
        { download: false },
      );
      const result = await exportEvidenceBundle({
        dataset,
        score,
        verdict,
        assurance: { label: assurance.label, detail: assurance.detail },
        pdf: { filename: pdf.filename, bytes: pdf.bytes },
        verification: dataset.parcel.verification,
        verifierHtml,
      });
      setExportedBundle(result.filename);
    } catch (bundleError) {
      console.error(bundleError);
      setError(
        'L’archive vérifiable n’a pas pu être générée. Vérifiez que le navigateur autorise les téléchargements.',
      );
    } finally {
      setExporting(false);
    }
  };

  /** Modifier une déclaration déjà contrôlée la renvoie en brouillon. */
  const saveConfig = (config: ParcelConfig) => {
    const reviewed =
      config.verification.status === 'soumis' || config.verification.status === 'verifie';
    const next: ParcelConfig = reviewed
      ? {
          ...config,
          documents: config.documents.map((document) => ({
            ...document,
            status: 'en_attente' as const,
            note: undefined,
          })),
          verification: { status: 'brouillon' },
        }
      : config;
    setConfigs(upsertParcelConfig(next));
    setParcelId(next.id);
  };

  const submitConfig = (config: ParcelConfig) => {
    const next: ParcelConfig = {
      ...config,
      documents: config.documents.map((document) => ({
        ...document,
        status: 'en_attente' as const,
        note: undefined,
      })),
      verification: {
        status: 'soumis',
        submittedAt: new Date().toISOString(),
      },
    };
    setConfigs(upsertParcelConfig(next));
    setParcelId(next.id);
  };

  /** Décision de contrôle ; refuse un dossier disparu ou qui n'est plus soumis. */
  const decideParcel = (id: string, status: VerificationStatus, note: string): boolean => {
    const target = configs.find((config) => config.id === id);
    if (!target || target.verification.status !== 'soumis') {
      setError(
        'Ce dossier n’est plus en attente de contrôle : il a été retiré ou modifié par son titulaire.',
      );
      return false;
    }
    const next: ParcelConfig = {
      ...target,
      documents:
        status === 'verifie'
          ? target.documents.map((document) => ({ ...document, status: 'verifie' as const }))
          : status === 'rejete'
            ? target.documents.map((document) => ({
                ...document,
                status: 'rejete' as const,
                note,
              }))
            : target.documents,
      verification: {
        ...target.verification,
        status,
        note,
        reviewedAt: new Date().toISOString(),
        reviewer: `${account.name} · ${account.organisation}`,
      },
    };
    setConfigs(upsertParcelConfig(next));
    setError(null);
    return true;
  };

  const demoParcel = configs.find((config) => config.id === DEMO_PARCEL_ID);

  const restartDemo = async () => {
    setDemoBusy(true);
    try {
      await resetAll();
      setDemoIndex(0);
    } finally {
      setDemoBusy(false);
    }
  };

  const runDemoStep = async () => {
    if (demoIndex === null) return;
    const step = DEMO_STEPS[demoIndex];
    setDemoBusy(true);
    try {
      if (step.action === 'create' && accounts) {
        const exploitant = accounts.find((item) => item.role === 'exploitant');
        if (exploitant && !configs.some((config) => config.id === DEMO_PARCEL_ID)) {
          const config = await createDemoParcel(exploitant);
          setConfigs(upsertParcelConfig(config));
          setParcelId(config.id);
        }
      }

      if (step.action === 'submit' && demoParcel) {
        const status = demoParcel.verification.status;
        if (status !== 'soumis' && status !== 'verifie') submitConfig(demoParcel);
      }

      if (step.action === 'certify' && demoParcel?.verification.status === 'soumis') {
        const decided = decideParcel(
          DEMO_PARCEL_ID,
          'verifie',
          'Contour recoupé avec l’orthophoto, pièces d’identité et titre foncier conformes.',
        );
        if (!decided) return;
      }

      if (step.action === 'fraud') {
        if (!dataset || dataset.parcel.id !== DEMO_PARCEL_ID) {
          setError(
            'La parcelle de démonstration n’est pas encore sélectionnée : revenez à l’étape précédente.',
          );
          return;
        }
        if (!score?.fraudDetected) await inject('fraud');
      }

      setDemoIndex((current) => {
        if (current === null) return null;
        return current >= DEMO_STEPS.length - 1 ? null : current + 1;
      });
    } catch {
      setError(
        'La démonstration n’a pas pu se poursuivre : le stockage local du navigateur est indisponible.',
      );
    } finally {
      setDemoBusy(false);
    }
  };

  const appliedNitrogen = dataset
    ? dataset.fertilizers.reduce((sum, entry) => sum + entry.nitrogenKgHa, 0)
    : 0;
  const nitrogenCoverage = dataset
    ? Math.min(100, Math.round((appliedNitrogen / dataset.parcel.crop.nitrogenNeed) * 100))
    : 0;

  const verification = dataset?.parcel.verification;

  return (
    <div className="min-h-screen">
      <AppShell
        account={account}
        sections={sections}
        activeKey={activeKey}
        onNavigate={setTab}
        parcels={role === 'verificateur' ? [] : parcels}
        selectedParcelId={parcelId}
        onSelectParcel={(id) => {
          setParcelId(id);
          setError(null);
        }}
        onOpenSimulator={role === 'exploitant' ? () => setDrawerOpen(true) : undefined}
        onOpenDemo={() => void startDemo()}
        score={role === 'verificateur' ? undefined : score?.total}
        simulationActive={Boolean(dataset?.simulationActive)}
        integrityOk={Boolean(chain?.valid)}
        onSignOut={() => {
          signOut();
          setAccount(null);
        }}
      >
      <main key={activeKey} className="mx-auto w-full max-w-[1440px] animate-rise px-4 py-5 lg:px-7 lg:py-6">
        {error && (
          <div className="mb-3 flex items-start gap-2 border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] font-semibold text-[#b91c1c]">
            <Glyph name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {tab === 'methodology' && (
          <div className="space-y-4">
            <PageHeader
              eyebrow="Référentiel · Transparence"
              title="Méthodologie & limites du Score Vert"
              description="Formule appliquée, pondérations, seuils de décision et provenance exacte de chaque donnée — y compris ce que le score ne prétend pas prouver."
              badges={
                <span className="chip">
                  <Glyph name="file" className="h-3.5 w-3.5" />
                  Version 1.0 · 2026
                </span>
              }
            />
            <ScoreMethodology />
          </div>
        )}

        {role === 'verificateur' && tab !== 'methodology' && (
          <VerificationQueue account={account} configs={configs} onDecision={decideParcel} />
        )}

        {role === 'financeur' && tab !== 'methodology' && dataset && score && verdict && (
          <div className="space-y-4">
            <PageHeader
              eyebrow={`Portail financeur · ${account.organisation}`}
              title="Dossiers de crédit Score Vert"
              description={`Consultation du dossier certifié de ${dataset.parcel.owner} — ${dataset.parcel.shortName}. Le partage reste soumis au consentement de l’exploitant.`}
              badges={<SourceBadge simulation={dataset.simulationActive} />}
            />
            {exportedBundle && (
              <div className="flex items-start gap-2 border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-[12px] font-semibold text-forest-700">
                <Glyph name="shieldCheck" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Archive vérifiable générée : <span className="font-mono text-[11.5px]">{exportedBundle}</span>
                  . Extrayez-la et ouvrez <span className="font-mono">verifier.html</span> pour
                  recalculer la preuve hors ligne.
                </span>
              </div>
            )}
            <LenderPortal
              parcel={dataset.parcel}
              dataset={dataset}
              score={score}
              verdict={verdict}
              onDownload={downloadPdf}
              downloading={downloading}
              onExportBundle={exportBundle}
              exporting={exporting}
            />
          </div>
        )}

        {role === 'exploitant' && tab === 'parcel' && (
          <ParcelSetup
            account={account}
            configs={configs}
            certified={parcels
              .filter(
                (parcel) =>
                  parcel.ownerAccountId === account.id &&
                  !configs.some((config) => config.id === parcel.id),
              )
              .map((parcel) => ({
                id: parcel.id,
                name: parcel.name,
                areaHa: parcel.areaHa,
                kitSerial: parcel.kitSerial,
                documents: parcel.documents.length,
              }))}
            onOpenParcel={(id) => {
              setParcelId(id);
              setTab('map');
            }}
            onSave={saveConfig}
            onSubmit={submitConfig}
          />
        )}

        {role === 'exploitant' && tab !== 'parcel' && tab !== 'methodology' && !dataset && (
          <div className="border border-dashed border-[#cbd5e1] bg-white px-6 py-14 text-center">
            <Glyph name="parcel" className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-3 font-serif text-xl text-slateink-800">Aucune parcelle déclarée</p>
            <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-slate-500">
              Déclarez une parcelle et déposez vos pièces pour ouvrir votre jumeau numérique et votre
              Score Vert.
            </p>
            <button type="button" className="btn-primary mt-4" onClick={() => setTab('parcel')}>
              Déclarer ma parcelle
              <Glyph name="arrowRight" className="h-4 w-4" />
            </button>
          </div>
        )}

        {role === 'exploitant' && dataset && latest && score && tab === 'map' && (
          <div className="space-y-4">
            <PageHeader
              eyebrow="Module 1 · Jumeau numérique"
              title={dataset.parcel.name}
              description={`${dataset.parcel.owner} · ${dataset.parcel.crop.name} ${dataset.parcel.crop.variety} · ${formatNumber(dataset.parcel.areaHa, 2)} ha · boîtier ${dataset.parcel.kitSerial}`}
              badges={
                <>
                  {verification && (
                    <span className={`chip ${VERIFICATION_TONE[verification.status]}`}>
                      <Glyph
                        name={verification.status === 'verifie' ? 'shieldCheck' : 'shieldAlert'}
                        className="h-3.5 w-3.5"
                      />
                      {VERIFICATION_LABEL[verification.status]}
                    </span>
                  )}
                  <SourceBadge simulation={dataset.simulationActive} />
                </>
              }
              actions={
                <button type="button" className="btn-secondary" onClick={() => setTab('parcel')}>
                  <Glyph name="pencil" className="h-4 w-4" />
                  Modifier la parcelle
                </button>
              }
            />

            {verification && verification.status !== 'verifie' && (
              <div
                className={`flex flex-wrap items-center justify-between gap-2 border px-3 py-2 text-[12px] font-semibold ${
                  verification.status === 'rejete'
                    ? 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]'
                    : 'border-[#fcd34d] bg-[#fffbeb] text-[#b45309]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Glyph name="shieldAlert" className="h-4 w-4" />
                  {verification.status === 'rejete'
                    ? `Dossier rejeté — ${verification.note ?? 'pièces à compléter'}`
                    : verification.status === 'soumis'
                      ? 'Dossier transmis, en attente de contrôle AgriTwin (72 h ouvrées).'
                      : 'Parcelle non certifiée : les données affichées sont simulées.'}
                </span>
                <button type="button" className="link text-[12px]" onClick={() => setTab('parcel')}>
                  Ouvrir le dossier
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-2 gap-y-3 border-y border-[#eef3f8] py-3 lg:grid-cols-4">
              <InfoTile
                label="Exploitant"
                value={dataset.parcel.owner}
                detail={`${dataset.parcel.ownerRole} · ${dataset.parcel.mode}`}
              />
              <InfoTile
                label="Culture"
                value={`${dataset.parcel.crop.name} — ${dataset.parcel.crop.variety}`}
                detail={`Semis 15/09/2026 · ${formatNumber(dataset.parcel.areaHa)} ha`}
              />
              <InfoTile
                label="Localisation"
                value={dataset.parcel.gpsLabel.split('—')[0].trim()}
                detail={dataset.parcel.gpsLabel.split('—')[1]?.trim() ?? ''}
              />
              <InfoTile
                label="Équipement"
                value={dataset.parcel.kitSerial}
                detail={`Scellé ${latest.sealOk ? 'intact' : 'rompu'} · batterie ${latest.battery} % · ${
                  dataset.parcel.documents.length
                } pièce(s)`}
              />
            </div>

            <ParcelMap key={dataset.parcel.id} parcel={dataset.parcel} records={dataset.records} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {dataset.parcel.zones.map((zone) => (
                <div key={zone.id} className="card flex items-center justify-between gap-3 p-3.5">
                  <div className="min-w-0">
                    <p className="eyebrow">
                      {zone.label} {zone.isReferenceProbe ? '· témoin' : ''}
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-slateink-800">
                      Humidité {formatNumber(zone.moisture)} % · NDVI {formatNumber(zone.ndvi, 2)}
                    </p>
                    <p className="truncate font-mono text-[11px] text-slate-500">{zone.probeLabel}</p>
                  </div>
                  <span
                    className={`chip shrink-0 ${
                      zone.status === 'optimal'
                        ? 'border-[#bbf7d0] bg-[#f0fdf4] text-forest-700'
                        : zone.status === 'vigilance'
                          ? 'border-[#fcd34d] bg-[#fffbeb] text-[#b45309]'
                          : 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]'
                    }`}
                  >
                    {zone.status === 'optimal' ? 'Optimal' : zone.status === 'vigilance' ? 'Vigilance' : 'Critique'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {role === 'exploitant' && dataset && latest && score && tab === 'monitoring' && (
          <div className="space-y-4">
            <PageHeader
              eyebrow="Module 2 · Surveillance continue"
              title="Sol, microclimat et alertes"
              description={`Dernier relevé ${formatDate(latest.timestamp)} · boîtier ${dataset.parcel.kitSerial} · LoRa ${latest.rssi} dBm`}
              badges={<SourceBadge simulation={latest.source === 'simulation'} />}
            />

            <KpiCards parcel={dataset.parcel} latest={latest} />
            <TelemetryCharts parcel={dataset.parcel} records={dataset.records} />

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[0.85fr_1.15fr]">
              <section className="card flex flex-col p-4 lg:p-5">
                <h2 className="font-serif text-lg text-slateink-800">Bilan minéral &amp; phytosanitaire</h2>
                <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
                  Suivi des intrants déclarés, en remplacement des capteurs NPK.
                </p>
                <div className="mt-3 rounded-xl border border-[#eef3f8] bg-[#fbfdfc] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Azote apporté
                    </span>
                    <span className="chip bg-white text-forest-700">{nitrogenCoverage} % du besoin</span>
                  </div>
                  <p className="num mt-1 text-2xl font-semibold text-slateink-800">
                    {formatNumber(appliedNitrogen)}
                    <span className="ml-1 text-[12px] font-medium text-slate-500">
                      / {dataset.parcel.crop.nitrogenNeed} kg N/ha
                    </span>
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
                    <div
                      className={`h-full ${nitrogenCoverage >= 85 ? 'bg-forest-500' : 'bg-[#d97706]'}`}
                      style={{ width: `${nitrogenCoverage}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {dataset.fertilizers.slice(0, 3).map((entry) => (
                      <span key={entry.id} className="chip bg-white text-slate-600">
                        {entry.type} · {entry.quantityKg} kg
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-2.5 rounded-xl border border-[#eef3f8] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Signalements phytosanitaires
                  </p>
                  {dataset.pests.length > 0 ? (
                    <ul className="mt-1 divide-y divide-[#eef3f8] text-[12px] text-slateink-800">
                      {dataset.pests.slice(0, 3).map((report) => (
                        <li key={report.id} className="flex items-center justify-between gap-2 py-1">
                          <span className="font-semibold">
                            {report.type} · {report.severity}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {formatDate(report.date)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-[12px] text-slate-500">
                      Aucun incident consigné sur la campagne.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  className="btn-secondary mt-3 w-full"
                  onClick={() => setJournalOpen(true)}
                >
                  <Glyph name="file" className="h-4 w-4" />
                  Ouvrir le journal agronomique
                  <Glyph name="arrowRight" className="ml-auto h-4 w-4" />
                </button>
              </section>

              <VoiceAssistant dataset={dataset} alerts={alerts} score={score.total} />
            </div>
          </div>
        )}

        {role === 'exploitant' && dataset && tab === 'simulator' && (
          <div className="space-y-4">
            <PageHeader
              eyebrow="Module 3 · Décision"
              title="Tester une décision avant de l’appliquer"
              description={`${dataset.parcel.shortName} · ${formatNumber(dataset.parcel.areaHa)} ha · prix de vente ${formatNumber(
                dataset.parcel.crop.pricePerTon,
                0,
              )} FCFA/t`}
              badges={<SourceBadge simulation={dataset.simulationActive} />}
            />
            <YieldSimulator parcel={dataset.parcel} records={dataset.records} />
          </div>
        )}

        {role === 'exploitant' && dataset && latest && score && verdict && assurance && tab === 'score' && (
          <div className="space-y-4">
            <PageHeader
              eyebrow="Module 4 · Financement"
              title="Dossier de crédit et Score Vert"
              description="Historique certifié, contrôle d’intégrité SHA-256 et partage encadré par la loi 2008-12 (CDP)."
              badges={
                <>
                  {verification && (
                    <span className={`chip ${VERIFICATION_TONE[verification.status]}`}>
                      <Glyph
                        name={verification.status === 'verifie' ? 'shieldCheck' : 'shieldAlert'}
                        className="h-3.5 w-3.5"
                      />
                      {VERIFICATION_LABEL[verification.status]}
                    </span>
                  )}
                  <SourceBadge simulation={dataset.simulationActive} />
                </>
              }
            />

            <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
              <GreenScoreCard
                score={score}
                parcel={dataset.parcel}
                consent={dataset.consent}
                onConsentChange={toggleConsent}
                onDownload={downloadPdf}
                downloading={downloading}
                frozen={dataset.frozen}
                ec={latest.ec}
                ph={latest.ph}
                pestNote={pestNote}
              />
              <section className="window">
                <div className="window-head">
                  <h2 className="window-title">Preuve d’intégrité</h2>
                  <span className="window-hint">SHA-256</span>
                </div>
                <div className="window-body space-y-3">
                  <div
                    className={`flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 ${
                      chain?.valid
                        ? 'border-[#bbf7d0] bg-[#f0fdf4]'
                        : 'border-[#fecaca] bg-[#fef2f2]'
                    }`}
                  >
                    <Glyph
                      name={chain?.valid ? 'shieldCheck' : 'shieldAlert'}
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        chain?.valid ? 'text-forest-700' : 'text-[#b91c1c]'
                      }`}
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-[12.5px] font-semibold ${
                          chain?.valid ? 'text-forest-700' : 'text-[#b91c1c]'
                        }`}
                      >
                        {chain?.valid ? 'Chaîne de mesures intègre' : 'Chaîne à vérifier'}
                      </p>
                      <p className="mt-0.5 break-all font-mono text-[10.5px] leading-relaxed text-slate-500">
                        {chain ? `${chain.globalHash.slice(0, 24)}…` : 'Calcul de l’empreinte…'}
                      </p>
                    </div>
                  </div>
                  <ul className="divide-y divide-[#eef3f8] text-[12px] text-slate-600">
                    <li className="flex items-center justify-between gap-2 py-1.5">
                      <span>Blocs signés</span>
                      <span className="num font-semibold text-slateink-800">
                        {dataset.records.length}
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2 py-1.5">
                      <span>Scellé du boîtier</span>
                      <span
                        className={`font-semibold ${
                          latest.sealOk ? 'text-forest-700' : 'text-[#b91c1c]'
                        }`}
                      >
                        {latest.sealOk ? 'Intact' : 'Rompu'}
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2 py-1.5">
                      <span>Dernier relevé</span>
                      <span className="font-mono text-[11px] text-slateink-800">
                        {formatDate(latest.timestamp)}
                      </span>
                    </li>
                  </ul>
                  <button
                    type="button"
                    className="btn-secondary w-full"
                    onClick={() => setTab('audit')}
                  >
                    <Glyph name="file" className="h-4 w-4" />
                    Ouvrir le journal des blocs
                    <Glyph name="arrowRight" className="ml-auto h-4 w-4" />
                  </button>
                </div>
              </section>
            </div>

            <section className="card flex flex-wrap items-center justify-between gap-3 p-4 lg:px-5">
              <div className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-600">
                <Glyph name="building" className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" />
                <p className="max-w-3xl">
                  Le Score Vert peut déclencher le déblocage conditionnel des tranches d’intrants et
                  l’indemnisation d’assurance climatique indicielle. Le partage avec l’institution
                  financière reste sous le contrôle exclusif de l’exploitant.
                </p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setTab('parcel')}>
                Gérer mes pièces justificatives
                <Glyph name="arrowRight" className="h-4 w-4" />
              </button>
            </section>
          </div>
        )}
        {role === 'exploitant' && dataset && latest && tab === 'alerts' && (
          <div className="space-y-4">
            <PageHeader
              eyebrow="Module 2 · Diagnostic"
              title="Alertes et actions correctives"
              description={`${dataset.parcel.shortName} · dernier relevé ${formatDate(
                latest.timestamp,
              )} · seuils de référence : humidité 20 %, air 35 °C, salinité 1,5 dS/m.`}
              badges={<SourceBadge simulation={dataset.simulationActive} />}
            />

            <div className="grid grid-cols-3 gap-2.5 sm:max-w-md">
              {[
                {
                  label: 'Critiques',
                  value: alerts.filter((item) => item.severity === 'critique').length,
                  tone: 'text-[#b91c1c]',
                },
                {
                  label: 'Vigilances',
                  value: alerts.filter((item) => item.severity === 'vigilance').length,
                  tone: 'text-[#b45309]',
                },
                {
                  label: 'Informations',
                  value: alerts.filter((item) => item.severity === 'info').length,
                  tone: 'text-forest-700',
                },
              ].map((entry) => (
                <div key={entry.label} className="stat">
                  <p className={`num text-2xl font-semibold ${entry.tone}`}>{entry.value}</p>
                  <p className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-slate-500">
                    {entry.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-2.5">
              {alerts.map((alert) => {
                const critique = alert.severity === 'critique';
                const vigilance = alert.severity === 'vigilance';
                const tone = critique
                  ? 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]'
                  : vigilance
                    ? 'border-[#fcd34d] bg-[#fffbeb] text-[#b45309]'
                    : 'border-[#bbf7d0] bg-[#f0fdf4] text-forest-700';
                return (
                  <article
                    key={alert.id}
                    className={`window border-l-[3px] ${
                      critique
                        ? 'border-l-[#dc2626]'
                        : vigilance
                          ? 'border-l-[#d97706]'
                          : 'border-l-[#16a34a]'
                    }`}
                  >
                    <div className="flex items-start gap-3 p-3.5 sm:p-4">
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border ${tone}`}
                      >
                        <Glyph
                          name={critique ? 'alert' : vigilance ? 'info' : 'check'}
                          className="h-4 w-4"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`chip ${tone}`}>{alert.severity}</span>
                          <span className="font-mono text-[10px] text-slate-400">{alert.id}</span>
                        </div>
                        <h2 className="mt-1.5 font-serif text-[16px] leading-snug text-slateink-800 sm:text-[17px]">
                          {alert.title}
                        </h2>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
                          {alert.message}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="chip normal-case tracking-normal">
                            FR · {alert.voiceFr}
                          </span>
                          <span className="chip normal-case tracking-normal">
                            WO · {alert.voiceWolof}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <section className="window">
              <div className="window-head">
                <h2 className="window-title">Actions recommandées</h2>
                <span className="window-hint">ordre de priorité</span>
              </div>
              <div className="window-body grid gap-2.5 sm:grid-cols-3">
                <button
                  type="button"
                  className="stat group text-left transition hover:border-[#bbf7d0] hover:bg-[#f7fdf9]"
                  onClick={() => setTab('monitoring')}
                >
                  <Glyph name="droplet" className="h-4 w-4 text-tech" />
                  <p className="mt-2 text-[12.5px] font-semibold text-slateink-800">
                    Vérifier le bilan hydrique
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    Sondes 15/35 cm, pluviométrie et radar Sentinel-1.
                  </p>
                </button>
                <button
                  type="button"
                  className="stat group text-left transition hover:border-[#bbf7d0] hover:bg-[#f7fdf9]"
                  onClick={() => setTab('simulator')}
                >
                  <Glyph name="flask" className="h-4 w-4 text-forest-600" />
                  <p className="mt-2 text-[12.5px] font-semibold text-slateink-800">
                    Tester une irrigation
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    Chiffrer l’effet d’un apport sur le rendement et le Score Vert.
                  </p>
                </button>
                <button
                  type="button"
                  className="stat group text-left transition hover:border-[#bbf7d0] hover:bg-[#f7fdf9]"
                  onClick={() => setTab('audit')}
                >
                  <Glyph name="shieldCheck" className="h-4 w-4 text-forest-600" />
                  <p className="mt-2 text-[12.5px] font-semibold text-slateink-800">
                    Contrôler la preuve
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    Journal SHA-256 opposable en cas de litige de crédit.
                  </p>
                </button>
              </div>
            </section>
          </div>
        )}

        {role === 'exploitant' && dataset && latest && tab === 'audit' && (
          <div className="space-y-4">
            <PageHeader
              eyebrow="Module 4 · Preuve & audit"
              title="Journal cryptographique de la parcelle"
              description="Chaque relevé est signé en SHA-256 et chaîné au précédent : toute réécriture de l’historique casse la signature et invalide le dossier de crédit."
              badges={
                <>
                  <span
                    className={`chip ${
                      chain?.valid
                        ? 'border-[#bbf7d0] bg-[#f0fdf4] text-forest-700'
                        : 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]'
                    }`}
                  >
                    <Glyph
                      name={chain?.valid ? 'shieldCheck' : 'shieldAlert'}
                      className="h-3.5 w-3.5"
                    />
                    {chain?.valid ? 'Chaîne intègre' : 'Chaîne à vérifier'}
                  </span>
                  <SourceBadge simulation={dataset.simulationActive} />
                </>
              }
              actions={
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={downloadPdf}
                  disabled={downloading}
                >
                  <Glyph name="download" className="h-4 w-4" />
                  {downloading ? 'Génération…' : 'Exporter le dossier PDF'}
                </button>
              }
            />

            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <div className="stat">
                <p className="eyebrow">Blocs signés</p>
                <p className="num mt-1 text-lg font-semibold text-slateink-800">
                  {dataset.records.length}
                </p>
              </div>
              <div className="stat">
                <p className="eyebrow">Scellé boîtier</p>
                <p
                  className={`mt-1 text-lg font-semibold ${
                    latest.sealOk ? 'text-forest-700' : 'text-[#b91c1c]'
                  }`}
                >
                  {latest.sealOk ? 'Intact' : 'Rompu'}
                </p>
              </div>
              <div className="stat">
                <p className="eyebrow">Dernier relevé</p>
                <p className="mt-1 font-mono text-[13px] font-medium text-slateink-800">
                  {formatDate(latest.timestamp)}
                </p>
              </div>
              <div className="stat min-w-0">
                <p className="eyebrow">Empreinte globale</p>
                <p className="mt-1 truncate font-mono text-[13px] font-medium text-slateink-800">
                  {chain ? `${chain.globalHash.slice(0, 10)}…` : 'Calcul…'}
                </p>
              </div>
            </div>

            <section className="window">
              <div className="window-head">
                <h2 className="window-title">Journal des blocs</h2>
                <span className="window-hint">{dataset.records.length} relevés chaînés</span>
              </div>
              <div className="window-body window-body-flush">
                <CryptoAuditTable records={dataset.records} />
              </div>
            </section>

            <section className="window">
              <div className="window-head">
                <h2 className="window-title">Partage et conservation</h2>
              </div>
              <div className="window-body grid gap-2.5 sm:grid-cols-3">
                <div className="stat">
                  <p className="eyebrow">Consentement</p>
                  <p className="mt-1 text-[12.5px] font-semibold text-slateink-800">
                    {dataset.consent ? 'Partage autorisé' : 'Partage bloqué'}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    L’exploitant garde la main sur la transmission du dossier.
                  </p>
                </div>
                <div className="stat">
                  <p className="eyebrow">Base légale</p>
                  <p className="mt-1 text-[12.5px] font-semibold text-slateink-800">
                    Loi 2008-12 (CDP)
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    Données déclaratives et télémétrie certifiée du kit.
                  </p>
                </div>
                <div className="stat">
                  <p className="eyebrow">Traçabilité</p>
                  <p className="mt-1 text-[12.5px] font-semibold text-slateink-800">
                    {dataset.records.length} signatures
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    Vérifiables hors ligne, sans service tiers payant.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      <footer className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-2 sm:pb-6 lg:px-8">
        <div className="border-t border-[#dde5ee] pt-4">
          <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
            <div className="max-w-sm">
              <div className="flex items-center gap-2">
                <img src="./agritwin-logo.webp" alt="" className="h-6 w-6 object-contain" />
                <span className="font-serif text-[15px] leading-none text-slateink-800">
                  AgriTwin
                </span>
                <span className="chip border-[#bbf7d0] bg-[#f0fdf4] text-forest-700">Prototype</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                Jumeau numérique de parcelle et Score Vert pour l’accès au financement rural.
                Démonstrateur hors ligne : relevés Sentinel-1/2 simulés, aucun service payant.
              </p>
            </div>

            <div className="flex flex-wrap gap-x-10 gap-y-4 text-[11px]">
              <div>
                <p className="eyebrow">Ressources</p>
                <ul className="mt-1.5 space-y-1.5">
                  <li>
                    <button
                      type="button"
                      onClick={() => setTab('methodology')}
                      className="link min-h-[32px] text-[11px] font-semibold"
                    >
                      Méthodologie du Score Vert
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      className="link min-h-[32px] text-[11px] font-semibold"
                    >
                      Revenir en haut
                    </button>
                  </li>
                </ul>
              </div>
              <div>
                <p className="eyebrow">Traçabilité</p>
                <ul className="mt-1.5 space-y-1 text-slate-500">
                  <li className="font-mono">
                    {dataset ? `${dataset.records.length} blocs SHA-256` : 'Chaîne locale'}
                  </li>
                  <li>Sentinel-1/2 simulées</li>
                  <li>Consentement — loi 2008-12 (CDP)</li>
                </ul>
              </div>
              <div>
                <p className="eyebrow">Version</p>
                <ul className="mt-1.5 space-y-1 text-slate-500">
                  <li>Prototype v1.0</li>
                  <li>React · Vite · TypeScript</li>
                  <li>Données stockées localement</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#eef3f8] pt-3 text-[10.5px] text-slate-400">
            <p>© 2026 AgriTwin — École Polytechnique de Thiès. Tous droits réservés.</p>
            <p className="font-mono uppercase tracking-[0.08em]">
              Concours AKTIION 2026 · démonstrateur
            </p>
          </div>
        </div>
      </footer>
      </AppShell>

      {role === 'exploitant' && dataset && latest && score && (
        <IoTSimulatorDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onInject={inject}
          onReset={resetDemo}
          pending={pending}
          summary={{
            score: score.total,
            gap: Math.abs(latest.moisture15 - latest.sentinel1Humidity),
            sealOk: latest.sealOk,
            fraud: score.fraudDetected,
            records: dataset.records.length,
            lastInjection: dataset.lastInjection,
          }}
        />
      )}

      {demoIndex !== null && (
        <GuidedDemo
          index={demoIndex}
          total={DEMO_STEPS.length}
          title={DEMO_STEPS[demoIndex].title}
          description={DEMO_STEPS[demoIndex].description}
          cta={DEMO_STEPS[demoIndex].cta}
          hint={DEMO_STEPS[demoIndex].hint}
          busy={demoBusy}
          canBack={demoIndex > 0}
          onNext={() => void runDemoStep()}
          onBack={() =>
            setDemoIndex((current) => (current === null ? null : Math.max(0, current - 1)))
          }
          onReset={() => void restartDemo()}
          onExit={() => setDemoIndex(null)}
        />
      )}

      {role === 'exploitant' && dataset && (
        <AgroJournalModal
          open={journalOpen}
          onClose={() => setJournalOpen(false)}
          parcel={dataset.parcel}
          fertilizers={dataset.fertilizers}
          pests={dataset.pests}
          onAddFertilizer={addFertilizer}
          onAddPest={addPest}
        />
      )}
    </div>
  );
}
