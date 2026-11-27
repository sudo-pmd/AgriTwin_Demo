import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polygon, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import {
  SAT_ATTRIBUTION,
  SAT_MAX_NATIVE_ZOOM,
  SAT_MAX_ZOOM,
  SAT_TILES,
} from '../../utils/mapTiles';
import L from 'leaflet';
import * as turf from '@turf/turf';
import Glyph from '../ui/Glyph';
import PageHeader from '../ui/PageHeader';
import type { Account } from '../../auth/accounts';
import type {
  CropKey,
  DocumentKind,
  GeoPoint,
  ParcelConfig,
  ParcelDocument,
  VerificationStatus,
} from '../../types/agritwin';
import { CROP_CATALOG } from '../../data/seedData';
import {
  documentLabel,
  putDocumentFile,
  deleteDocumentFile,
  storageUsage,
} from '../../storage/parcels';
import {
  DocumentLimitError,
  MAX_DOSSIER_BYTES,
  MAX_FILE_BYTES,
  MAX_PHOTOS,
  MAX_STORAGE_BYTES,
  documentsProblem,
  inspectFile,
  megabytes,
} from '../../utils/documentLimits';
import { formatNumber } from '../../utils/format';


const REQUIRED: DocumentKind[] = ['identite', 'foncier'];
const OPTIONAL: DocumentKind[] = ['exploitation', 'photo'];

const STEPS = ['Identité', 'Localisation', 'Pièces', 'Récapitulatif'] as const;

const STATUS_META: Record<VerificationStatus, { label: string; className: string }> = {
  brouillon: { label: 'Brouillon', className: 'border-[#cbd5e1] bg-white text-slate-600' },
  soumis: { label: 'En vérification', className: 'border-[#fcd34d] bg-[#fffbeb] text-[#b45309]' },
  verifie: { label: 'Vérifiée', className: 'border-[#bbf7d0] bg-[#f0fdf4] text-forest-700' },
  rejete: { label: 'Rejetée', className: 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]' },
};

const SOILS = [
  'Sablo-argileux (Dior)',
  'Sableux littoral (Niayes)',
  'Argileux (plateau)',
  'Limono-sableux (fleuve)',
];

function centreIcon(): L.DivIcon {
  return L.divIcon({
    className: 'agritwin-probe-icon',
    html: '<div style="width:26px;height:26px;transform:translate(-13px,-13px);border:2px solid #fff;background:#14532d;box-shadow:0 2px 8px rgba(2,6,23,.5)"></div>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function MapEvents({
  drawing,
  onPlace,
  onVertex,
}: {
  drawing: boolean;
  onPlace: (point: GeoPoint) => void;
  onVertex: (point: [number, number]) => void;
}) {
  useMapEvents({
    click(event) {
      if (drawing) onVertex([event.latlng.lat, event.latlng.lng]);
      else onPlace({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
    dblclick() {},
  });
  return null;
}

/** Turf exige un anneau fermé : le premier point doit être répété à la fin. */
function closedRing(points: [number, number][]): [number, number][] {
  const ring: [number, number][] = points.map(([lat, lng]) => [lng, lat]);
  const [first] = ring;
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
  return ring;
}

function polygonArea(points: [number, number][]): number {
  if (points.length < 3) return 0;
  return turf.area(turf.polygon([closedRing(points)])) / 10_000;
}

interface ParcelSetupProps {
  account: Account;
  configs: ParcelConfig[];
  certified: { id: string; name: string; areaHa: number; kitSerial: string; documents: number }[];
  onOpenParcel: (id: string) => void;
  onSave: (config: ParcelConfig) => void;
  onSubmit: (config: ParcelConfig) => void;
}

export default function ParcelSetup({
  account,
  configs,
  certified,
  onOpenParcel,
  onSave,
  onSubmit,
}: ParcelSetupProps) {
  const mine = configs.filter((config) => config.accountId === account.id);
  const [draft, setDraft] = useState<ParcelConfig | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deviceBytes, setDeviceBytes] = useState<number | null>(null);
  // Pièces réellement rattachées à une déclaration enregistrée.
  const storedIds = useRef<Set<string>>(new Set());
  // Pièces retirées de la déclaration : effacées seulement à l'enregistrement.
  const removedIds = useRef<Set<string>>(new Set());

  // Occupation réelle du stockage local, tous dossiers confondus.
  const refreshUsage = () => {
    void storageUsage()
      .then((usage) => setDeviceBytes(usage.bytes))
      .catch(() => setDeviceBytes(null));
  };
  useEffect(refreshUsage, []);

  const patch = (next: Partial<ParcelConfig>) => {
    setDraft((current) => (current ? { ...current, ...next } : current));
    setSaved(false);
  };

  /** Abandonne la déclaration courante et efface les pièces jamais enregistrées. */
  const discardDraft = () => {
    for (const document of draft?.documents ?? []) {
      if (!storedIds.current.has(document.id)) void deleteDocumentFile(document.id);
    }
    removedIds.current.clear();
    setDraft(null);
  };

  const openExisting = (config: ParcelConfig) => {
    discardDraft();
    config.documents.forEach((document) => storedIds.current.add(document.id));
    setDraft(structuredClone(config));
    setStep(0);
    setError(null);
    setSaved(false);
  };

  const startNew = () => {
    discardDraft();
    const id = `PARC-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    setDraft({
      id,
      accountId: account.id,
      name: '',
      ownerName: account.name,
      ownerRole: 'Exploitant individuel',
      centre: { lat: 14.7167, lng: -16.4492 },
      areaHa: 1,
      boundary: [],
      cropKey: 'oignon',
      soilType: SOILS[0],
      seed: Math.floor(Math.random() * 100000),
      createdAt: new Date().toISOString(),
      documents: [],
      verification: { status: 'brouillon' },
    });
    setStep(0);
    setError(null);
    setSaved(false);
  };

  const addFiles = async (kind: DocumentKind, files: FileList | null) => {
    if (!draft || !files) return;
    // Le champ est vidé par l'appelant : on fige la sélection avant tout await.
    const selected = Array.from(files);
    const added: ParcelDocument[] = [];
    const rejected: string[] = [];
    let photos = draft.documents.filter((document) => document.kind === 'photo').length;
    let totalBytes = draft.documents.reduce((sum, document) => sum + document.size, 0);
    let storageFailed = false;
    let freeBytes = MAX_STORAGE_BYTES;
    try {
      freeBytes = MAX_STORAGE_BYTES - (await storageUsage()).bytes;
    } catch {
      // Stockage illisible : putDocumentFile refusera de toute façon.
      freeBytes = MAX_STORAGE_BYTES;
    }

    for (const file of selected) {
      let inspected: Awaited<ReturnType<typeof inspectFile>>;
      try {
        inspected = await inspectFile(file, kind);
      } catch {
        rejected.push(`${file.name} — fichier illisible`);
        continue;
      }
      if ('problem' in inspected) {
        rejected.push(`${file.name} — ${inspected.problem}`);
        continue;
      }
      if (kind === 'photo' && photos >= MAX_PHOTOS) {
        rejected.push(`${file.name} — ${MAX_PHOTOS} photos maximum`);
        continue;
      }
      if (totalBytes + file.size > MAX_DOSSIER_BYTES) {
        rejected.push(`${file.name} — quota du dossier de ${megabytes(MAX_DOSSIER_BYTES)} atteint`);
        continue;
      }
      if (file.size > freeBytes) {
        rejected.push(
          `${file.name} — espace local saturé (${megabytes(MAX_STORAGE_BYTES)} pour toutes les pièces)`,
        );
        continue;
      }

      const doc: ParcelDocument = {
        id: `DOC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        kind,
        label: documentLabel(kind),
        fileName: file.name,
        size: file.size,
        mime: inspected.mime,
        uploadedAt: new Date().toISOString(),
        status: 'en_attente',
      };
      try {
        await putDocumentFile(doc.id, file);
      } catch (storageError) {
        if (storageError instanceof DocumentLimitError) {
          rejected.push(`${file.name} — ${storageError.message}`);
          continue;
        }
        storageFailed = true;
        break;
      }
      added.push(doc);
      totalBytes += file.size;
      freeBytes -= file.size;
      if (kind === 'photo') photos += 1;
    }

    if (added.length > 0) {
      setDraft((current) =>
        current ? { ...current, documents: [...current.documents, ...added] } : current,
      );
      setSaved(false);
    }

    const notices: string[] = [];
    if (rejected.length > 0) {
      notices.push(
        `Fichier(s) ignoré(s) : ${rejected.slice(0, 3).join(' · ')}${
          rejected.length > 3 ? ` · +${rejected.length - 3} autre(s)` : ''
        }`,
      );
    }
    if (storageFailed) {
      notices.push(
        'Le stockage local du navigateur est saturé ou indisponible : certains fichiers n’ont pas pu être conservés.',
      );
    }
    setError(notices.length > 0 ? notices.join(' ') : null);
    refreshUsage();
  };

  const removeDocument = (doc: ParcelDocument) => {
    removedIds.current.add(doc.id);
    setDraft((current) =>
      current
        ? { ...current, documents: current.documents.filter((item) => item.id !== doc.id) }
        : current,
    );
    setSaved(false);
  };

  const hasRequired = useMemo(() => {
    if (!draft) return false;
    return REQUIRED.every((kind) => draft.documents.some((doc) => doc.kind === kind));
  }, [draft]);

  const validate = (forSubmit: boolean): string | null => {
    if (!draft) return 'Aucune parcelle en cours.';
    if (draft.name.trim().length < 3) return 'Donnez un nom à la parcelle (3 caractères minimum).';
    if (!Number.isFinite(draft.areaHa) || draft.areaHa <= 0) return 'La surface doit être positive.';
    if (
      !Number.isFinite(draft.centre.lat) ||
      !Number.isFinite(draft.centre.lng) ||
      Math.abs(draft.centre.lat) > 90 ||
      Math.abs(draft.centre.lng) > 180
    ) {
      return 'Coordonnées GPS invalides (latitude entre -90 et 90, longitude entre -180 et 180).';
    }
    const documentsIssue = documentsProblem(draft.documents);
    if (documentsIssue) return documentsIssue;
    if (forSubmit && !hasRequired) return "Pièce d'identité et titre foncier (ou bail) obligatoires.";
    return null;
  };

  const persist = (forSubmit: boolean) => {
    if (!draft) return;
    const problem = validate(forSubmit);
    if (problem) {
      setError(problem);
      return;
    }
    // Un dossier déjà contrôlé repart en brouillon dès qu'il est modifié.
    const reviewed =
      draft.verification.status === 'soumis' || draft.verification.status === 'verifie';
    const next: ParcelConfig = {
      ...draft,
      documents: draft.documents.map((document) => ({
        ...document,
        status: 'en_attente' as const,
        note: undefined,
      })),
      verification: forSubmit
        ? { status: 'soumis', submittedAt: new Date().toISOString() }
        : reviewed
          ? { status: 'brouillon' }
          : draft.verification,
    };
    next.documents.forEach((document) => storedIds.current.add(document.id));
    for (const id of removedIds.current) {
      void deleteDocumentFile(id);
      storedIds.current.delete(id);
    }
    removedIds.current.clear();
    setError(null);
    setDraft(next);
    refreshUsage();
    if (forSubmit) onSubmit(next);
    else onSave(next);
    setSaved(true);
  };

  const points = draft?.boundary ?? [];
  const centre = draft?.centre ?? { lat: 14.7167, lng: -16.4492 };
  const dossierBytes = draft?.documents.reduce((sum, document) => sum + document.size, 0) ?? 0;
  const [drawing, setDrawing] = useState(false);

  const setCentre = (point: GeoPoint) => {
    patch({
      centre: { lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) },
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Déclaration & conformité"
        title="Mes parcelles"
        description="Déclarez la géométrie de votre parcelle, déposez les pièces justificatives et suivez la vérification réalisée par les équipes AgriTwin."
        actions={
          <button type="button" className="btn-primary" onClick={startNew}>
            <Glyph name="plus" className="h-4 w-4" />
            Nouvelle parcelle
          </button>
        }
      />

      {certified.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Parcelles certifiées de votre exploitation
          </p>
          <ul className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {certified.map((parcel) => (
              <li key={parcel.id}>
                <button
                  type="button"
                  onClick={() => onOpenParcel(parcel.id)}
                  className="interactive-card group flex w-full items-start justify-between gap-3 border border-[#dde5ee] bg-white p-3.5 text-left hover:border-forest-400"
                >
                  <span className="min-w-0">
                    <span className="chip border-[#bbf7d0] bg-[#f0fdf4] text-forest-700">
                      <Glyph name="shieldCheck" className="h-3 w-3" />
                      Certifiée
                    </span>
                    <span className="mt-2 block font-serif text-lg leading-tight text-slateink-800">
                      {parcel.name}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-slate-600">
                      {formatNumber(parcel.areaHa, 2)} ha · {parcel.kitSerial} ·{' '}
                      {parcel.documents} pièce(s)
                    </span>
                  </span>
                  <Glyph
                    name="arrowRight"
                    className="mt-1 h-4 w-4 shrink-0 text-forest-700 transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mine.length > 0 && (
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {mine.map((config) => {
            const meta = STATUS_META[config.verification.status];
            const active = draft?.id === config.id;
            return (
              <li key={config.id}>
                <button
                  type="button"
                  onClick={() => openExisting(config)}
                  className={`interactive-card w-full border p-3.5 text-left ${
                    active
                      ? 'border-forest-700 bg-forest-50/40'
                      : 'border-[#dde5ee] bg-white hover:border-forest-400'
                  }`}
                >
                  <span className={`chip ${meta.className}`}>{meta.label}</span>
                  <p className="mt-2 font-serif text-lg leading-tight text-slateink-800">
                    {config.name}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">
                    {config.centre.lat.toFixed(4)}, {config.centre.lng.toFixed(4)}
                  </p>
                  <p className="mt-0.5 text-[12px] text-slate-600">
                    {formatNumber(config.areaHa, 2)} ha · {CROP_CATALOG[config.cropKey].spec.name} ·{' '}
                    {config.documents.length} pièce(s)
                  </p>
                  {config.verification.status === 'rejete' && config.verification.note && (
                    <p className="mt-1.5 text-[11px] font-semibold text-[#b91c1c]">
                      {config.verification.note}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!draft && mine.length === 0 && certified.length === 0 && (
        <div className="border border-dashed border-[#cbd5e1] bg-white px-5 py-10 text-center">
          <Glyph name="parcel" className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-3 font-serif text-lg text-slateink-800">Aucune parcelle sélectionnée</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-slate-500">
            Créez une parcelle pour saisir ses coordonnées GPS, déposer vos papiers et demander la
            certification AgriTwin.
          </p>
          <button type="button" className="btn-secondary mt-4" onClick={startNew}>
            <Glyph name="plus" className="h-4 w-4" />
            Déclarer une parcelle
          </button>
        </div>
      )}

      {draft && (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dde5ee] px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="eyebrow">Parcelle {draft.id}</p>
              <h2 className="truncate font-serif text-xl text-slateink-800">
                {draft.name || 'Nouvelle déclaration'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className={`chip ${STATUS_META[draft.verification.status].className}`}>
                {STATUS_META[draft.verification.status].label}
              </span>
              <button type="button" className="btn-ghost px-2" onClick={discardDraft}>
                <Glyph name="close" className="h-4 w-4" />
                <span className="sr-only">Fermer</span>
              </button>
            </div>
          </div>

          <ol className="grid grid-cols-2 border-b border-[#dde5ee] sm:grid-cols-4">
            {STEPS.map((label, index) => {
              const active = index === step;
              const done = index < step;
              return (
                <li key={label} className="border-r border-[#e6edf4] last:border-r-0">
                  <button
                    type="button"
                    onClick={() => setStep(index)}
                    aria-current={active ? 'step' : undefined}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-semibold transition ${
                      active
                        ? 'bg-forest-700 text-white'
                        : done
                          ? 'bg-forest-50 text-forest-800'
                          : 'bg-white text-slate-500 hover:bg-[#f8fafc]'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center border text-[10px] ${
                        active
                          ? 'border-white/40 text-white'
                          : done
                            ? 'border-forest-300 text-forest-700'
                            : 'border-[#cbd5e1] text-slate-500'
                      }`}
                    >
                      {done ? <Glyph name="check" className="h-3 w-3" /> : index + 1}
                    </span>
                    <span className="leading-tight">{label}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="px-4 py-4 sm:px-5">
            {step === 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="parcel-name">
                    Nom de la parcelle
                  </label>
                  <input
                    id="parcel-name"
                    className="field"
                    value={draft.name}
                    onChange={(event) => patch({ name: event.target.value })}
                    placeholder="Parcelle Ngoné — Mboro"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="parcel-crop">
                    Culture principale
                  </label>
                  <select
                    id="parcel-crop"
                    className="field"
                    value={draft.cropKey}
                    onChange={(event) => patch({ cropKey: event.target.value as CropKey })}
                  >
                    {(Object.keys(CROP_CATALOG) as CropKey[]).map((key) => (
                      <option key={key} value={key}>
                        {CROP_CATALOG[key].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="parcel-soil">
                    Type de sol
                  </label>
                  <select
                    id="parcel-soil"
                    className="field"
                    value={draft.soilType}
                    onChange={(event) => patch({ soilType: event.target.value })}
                  >
                    {SOILS.map((soil) => (
                      <option key={soil} value={soil}>
                        {soil}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="parcel-owner">
                    Titulaire
                  </label>
                  <input
                    id="parcel-owner"
                    className="field"
                    value={draft.ownerName}
                    onChange={(event) => patch({ ownerName: event.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="parcel-role">
                    Qualité
                  </label>
                  <input
                    id="parcel-role"
                    className="field"
                    value={draft.ownerRole}
                    onChange={(event) => patch({ ownerRole: event.target.value })}
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div>
                    <label className="field-label" htmlFor="parcel-lat">
                      Latitude
                    </label>
                    <input
                      id="parcel-lat"
                      className="field font-mono text-[13px]"
                      inputMode="decimal"
                      value={draft.centre.lat}
                      onChange={(event) =>
                        setCentre({ lat: Number(event.target.value), lng: draft.centre.lng })
                      }
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="parcel-lng">
                      Longitude
                    </label>
                    <input
                      id="parcel-lng"
                      className="field font-mono text-[13px]"
                      inputMode="decimal"
                      value={draft.centre.lng}
                      onChange={(event) =>
                        setCentre({ lat: draft.centre.lat, lng: Number(event.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="parcel-area">
                      Surface (ha)
                    </label>
                    <input
                      id="parcel-area"
                      className="field font-mono text-[13px]"
                      inputMode="decimal"
                      value={draft.areaHa}
                      onChange={(event) => patch({ areaHa: Number(event.target.value) })}
                    />
                  </div>
                  <div className="flex items-end">
                    <span className="chip w-full justify-center">
                      {points.length >= 3 ? 'Contour tracé' : 'Centre seul'}
                    </span>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-[#eef3f8]">
                  <MapContainer
                    center={[centre.lat, centre.lng]}
                    zoom={15}
                    scrollWheelZoom
                    className="h-[260px] w-full sm:h-[340px]"
                    doubleClickZoom={false}
                  >
                    <TileLayer
                      url={SAT_TILES}
                      attribution={SAT_ATTRIBUTION}
                      maxZoom={SAT_MAX_ZOOM}
                      maxNativeZoom={SAT_MAX_NATIVE_ZOOM}
                    />
                    <MapEvents
                      drawing={drawing}
                      onPlace={setCentre}
                      onVertex={(point) =>
                        patch({
                          boundary: [...draft.boundary, point],
                        })
                      }
                    />
                    <Marker position={[centre.lat, centre.lng]} icon={centreIcon()} />
                    {points.length >= 2 && (
                      <Polyline
                        positions={points}
                        pathOptions={{ color: '#4ade80', weight: 2, dashArray: '5 4' }}
                      />
                    )}
                    {points.length >= 3 && (
                      <Polygon
                        positions={points}
                        pathOptions={{
                          color: '#4ade80',
                          weight: 2,
                          fillColor: '#22c55e',
                          fillOpacity: 0.16,
                        }}
                      />
                    )}
                  </MapContainer>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#dde5ee] px-3 py-2">
                    <p className="text-[11px] text-slate-500">
                      {drawing
                        ? 'Touchez la carte pour poser un sommet du contour.'
                        : 'Touchez la carte pour déplacer le centre de la parcelle.'}
                    </p>
                    <div className="flex gap-1.5">
                      {drawing ? (
                        <>
                          <button
                            type="button"
                            className="btn-secondary px-2 py-1 text-[11px]"
                            onClick={() => {
                              const area = polygonArea(points);
                              if (area > 0) {
                                const centroid = turf.centroid(turf.polygon([closedRing(points)]))
                                  .geometry.coordinates;
                                patch({
                                  areaHa: Number(area.toFixed(2)),
                                  centre: { lat: centroid[1], lng: centroid[0] },
                                });
                              }
                              setDrawing(false);
                            }}
                          >
                            <Glyph name="check" className="h-3.5 w-3.5" />
                            Terminer
                          </button>
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1 text-[11px]"
                            onClick={() => patch({ boundary: [] })}
                          >
                            Effacer
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn-secondary px-2 py-1 text-[11px]"
                          onClick={() => {
                            patch({ boundary: [] });
                            setDrawing(true);
                          }}
                        >
                          <Glyph name="pencil" className="h-3.5 w-3.5" />
                          Dessiner le contour
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Surface calculée automatiquement à partir du contour (projection turf). Sans
                  contour, une emprise circulaire est générée à partir de la surface déclarée pour le
                  calcul du Score Vert.
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                {[...REQUIRED, ...OPTIONAL].map((kind) => {
                  const docs = draft.documents.filter((doc) => doc.kind === kind);
                  const required = REQUIRED.includes(kind);
                  return (
                    <div key={kind} className="border border-[#dde5ee]">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef3f8] px-3 py-2">
                        <div>
                          <p className="text-[12px] font-bold text-slateink-800">
                            {documentLabel(kind)}
                            {required ? (
                              <span className="ml-1 text-[#b91c1c]">*</span>
                            ) : (
                              <span className="ml-1 text-[10px] font-semibold uppercase text-slate-400">
                                facultatif
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {kind === 'photo'
                              ? `JPG ou PNG, ${MAX_PHOTOS} photos maximum, ${megabytes(
                                  MAX_FILE_BYTES,
                                )} par photo.`
                              : `PDF, JPG ou PNG, ${megabytes(MAX_FILE_BYTES)} maximum par fichier.`}
                          </p>
                        </div>
                        <label className="btn-secondary cursor-pointer px-2.5 py-1 text-[11px]">
                          <Glyph name="upload" className="h-3.5 w-3.5" />
                          Déposer
                          <input
                            type="file"
                            className="sr-only"
                            accept={
                              kind === 'photo'
                                ? 'image/jpeg,image/png'
                                : 'application/pdf,image/jpeg,image/png'
                            }
                            multiple={kind === 'photo'}
                            onChange={(event) => {
                              void addFiles(kind, event.target.files);
                              event.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                      {docs.length === 0 ? (
                        <p className="px-3 py-3 text-[12px] text-slate-400">Aucun fichier déposé.</p>
                      ) : (
                        <ul className="divide-y divide-[#eef3f8]">
                          {docs.map((doc) => (
                            <li
                              key={doc.id}
                              className="flex items-center justify-between gap-3 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[12px] font-semibold text-slateink-800">
                                  {doc.fileName}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {(doc.size / 1024).toFixed(0)} Ko ·{' '}
                                  {doc.status === 'verifie'
                                    ? 'vérifié'
                                    : doc.status === 'rejete'
                                      ? 'rejeté'
                                      : 'en attente de contrôle'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void removeDocument(doc)}
                                className="btn-ghost shrink-0 px-2 py-1"
                                aria-label={`Retirer ${doc.fileName}`}
                              >
                                <Glyph name="trash" className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
                <p className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#eef3f8] bg-[#fbfdfc] px-3 py-2 text-[11px] text-slate-500">
                  <span>
                    Quota du dossier : {megabytes(MAX_DOSSIER_BYTES)} au total, {MAX_PHOTOS}{' '}
                    photos maximum, {megabytes(MAX_FILE_BYTES)} par pièce.
                  </span>
                  <span className="text-right">
                    <span
                      className={`block font-semibold ${
                        dossierBytes > MAX_DOSSIER_BYTES * 0.9
                          ? 'text-[#b45309]'
                          : 'text-slateink-800'
                      }`}
                    >
                      {megabytes(dossierBytes)} utilisés
                    </span>
                    {deviceBytes !== null && (
                      <span className="block text-[10px] text-slate-400">
                        Appareil : {megabytes(deviceBytes)} / {megabytes(MAX_STORAGE_BYTES)} toutes
                        pièces
                      </span>
                    )}
                  </span>
                </p>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Les fichiers sont conservés localement sur cet appareil pour la démonstration. En
                  production, ils sont chiffrés et transmis au dossier de vérification AgriTwin.
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <dl className="divide-y divide-[#eef3f8] overflow-hidden rounded-xl border border-[#eef3f8]">
                  {[
                    ['Nom', draft.name || '—'],
                    ['Titulaire', `${draft.ownerName} — ${draft.ownerRole}`],
                    ['Culture', CROP_CATALOG[draft.cropKey].label],
                    ['Sol', draft.soilType],
                    ['Coordonnées', `${draft.centre.lat.toFixed(5)}, ${draft.centre.lng.toFixed(5)}`],
                    ['Surface', `${formatNumber(draft.areaHa, 2)} ha`],
                    ['Contour', points.length >= 3 ? `${points.length} sommets` : 'Emprise générée'],
                    ['Pièces', `${draft.documents.length} fichier(s) · ${megabytes(dossierBytes)}`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 px-3 py-2">
                      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
                      <dd className="text-right text-[12px] font-semibold text-slateink-800">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="rounded-xl border border-[#eef3f8] bg-[#fbfdfc] p-3.5">
                  <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                    <Glyph name="shieldCheck" className="h-4 w-4 text-forest-600" />
                    Contrôle AgriTwin
                  </p>
                  <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-slate-600">
                    <li>1. Vérification de l’identité du titulaire et du titre foncier ou bail.</li>
                    <li>2. Recoupement du contour GPS avec l’orthophoto et le cadastre local.</li>
                    <li>3. Pose du boîtier scellé par un technicien, puis démarrage des relevés.</li>
                    <li>4. Certification de la parcelle et ouverture du Score Vert.</li>
                  </ul>
                  {draft.verification.status === 'verifie' && (
                    <p className="mt-2 border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-2 text-[11px] font-semibold text-forest-700">
                      Parcelle certifiée le{' '}
                      {draft.verification.reviewedAt
                        ? new Date(draft.verification.reviewedAt).toLocaleDateString('fr-FR')
                        : '—'}{' '}
                      par {draft.verification.reviewer ?? 'AgriTwin'}.
                    </p>
                  )}
                  {draft.verification.status === 'soumis' && (
                    <p className="mt-2 border border-[#fcd34d] bg-[#fffbeb] px-2.5 py-2 text-[11px] font-semibold text-[#b45309]">
                      Dossier transmis le{' '}
                      {draft.verification.submittedAt
                        ? new Date(draft.verification.submittedAt).toLocaleDateString('fr-FR')
                        : '—'}
                      . Délai de contrôle habituel : 72 h ouvrées. Toute modification enregistrée
                      maintenant repassera le dossier en brouillon et annulera cette transmission.
                    </p>
                  )}
                  {draft.verification.status === 'rejete' && draft.verification.note && (
                    <p className="mt-2 border border-[#fecaca] bg-[#fef2f2] px-2.5 py-2 text-[11px] font-semibold text-[#b91c1c]">
                      Motif du rejet : {draft.verification.note}
                    </p>
                  )}
                </div>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="mt-3 flex items-start gap-2 border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] font-semibold text-[#b91c1c]"
              >
                <Glyph name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}
            {saved && !error && (
              <p className="mt-3 flex items-start gap-2 border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-[12px] font-semibold text-forest-700">
                <Glyph name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {draft.verification.status === 'soumis'
                  ? 'Dossier transmis aux équipes AgriTwin pour vérification.'
                  : 'Brouillon enregistré — le dossier devra être soumis pour contrôle.'}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef3f8] bg-[#fbfdfc] px-4 py-3 sm:px-5">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              disabled={step === 0}
            >
              <Glyph name="arrowRight" className="h-4 w-4 rotate-180" />
              Précédent
            </button>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={() => persist(false)}>
                Enregistrer le brouillon
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    const problem = validate(false);
                    if (problem) {
                      setError(problem);
                      return;
                    }
                    setError(null);
                    setStep((value) => Math.min(STEPS.length - 1, value + 1));
                  }}
                >
                  Continuer
                  <Glyph name="arrowRight" className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => persist(true)}
                  disabled={draft.verification.status === 'soumis'}
                >
                  <Glyph name="shieldCheck" className="h-4 w-4" />
                  {draft.verification.status === 'soumis'
                    ? 'En attente de contrôle'
                    : 'Soumettre à vérification'}
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
