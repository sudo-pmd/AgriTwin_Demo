import { useMemo, useState } from 'react';
import { MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import {
  SAT_ATTRIBUTION,
  SAT_MAX_NATIVE_ZOOM,
  SAT_MAX_ZOOM,
  SAT_TILES,
} from '../../utils/mapTiles';
import L from 'leaflet';
import * as turf from '@turf/turf';
import {
  Check,
  Layers,
  PencilRuler,
  Radar,
  Satellite,
  Sprout,
  Trash2,
  X,
} from '../ui/icons';
import type { Parcel, ParcelZone, TelemetryRecord } from '../../types/agritwin';
import { HISTORY_DAYS, splitIntoZones } from '../../data/seedData';
import { formatDate, formatNumber, relativeDayLabel } from '../../utils/format';

type LayerMode = 'zones' | 'ndvi' | 'radar';

interface ParcelMapProps {
  parcel: Parcel;
  records: TelemetryRecord[];
}

interface DrawnParcel {
  ring: [number, number][];
  areaHa: number;
  zones: ParcelZone[];
}


const STATUS_COLORS = { optimal: '#16a34a', vigilance: '#d97706', critique: '#dc2626' } as const;

function ndviColor(value: number): string {
  if (value < 0.4) return '#ea580c';
  if (value <= 0.65) return '#eab308';
  return '#15803d';
}

function radarColor(value: number): string {
  if (value < 18) return '#dc2626';
  if (value < 22) return '#d97706';
  if (value < 30) return '#0284c7';
  return '#0369a1';
}

function probeIcon(reference: boolean, status: keyof typeof STATUS_COLORS): L.DivIcon {
  const fill = reference ? '#0f172a' : STATUS_COLORS[status];
  return L.divIcon({
    className: 'agritwin-probe-icon',
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:999px;background:${fill};border:2.5px solid #ffffff;box-shadow:0 2px 8px rgba(2,6,23,.55)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5s6 6.2 6 10.2a6 6 0 0 1-12 0c0-4 6-10.2 6-10.2Z"/></svg>
      ${reference ? '<span style="position:absolute;inset:-6px;border-radius:999px;border:1.5px dashed rgba(255,255,255,.8)"></span>' : ''}
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function vertexIcon(): L.DivIcon {
  return L.divIcon({
    className: 'agritwin-probe-icon',
    html: '<div style="width:14px;height:14px;border-radius:3px;background:#f8fafc;border:2px solid #14532d;box-shadow:0 1px 4px rgba(2,6,23,.6)"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function MapInteractions({
  drawing,
  onAddPoint,
  onFinish,
}: {
  drawing: boolean;
  onAddPoint: (point: [number, number]) => void;
  onFinish: () => void;
}) {
  useMapEvents({
    click(event) {
      if (drawing) onAddPoint([event.latlng.lat, event.latlng.lng]);
    },
    dblclick() {
      if (drawing) onFinish();
    },
  });
  return null;
}

export default function ParcelMap({ parcel, records }: ParcelMapProps) {
  const [layer, setLayer] = useState<LayerMode>('zones');
  const [dayIndex, setDayIndex] = useState(HISTORY_DAYS - 1);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [drawn, setDrawn] = useState<DrawnParcel | null>(null);
  const [editing, setEditing] = useState(false);

  const latest = records[records.length - 1];
  const timelineRecord = records[Math.min(dayIndex, records.length - 1)];
  const ndviRatio = latest.ndvi > 0 ? timelineRecord.ndvi / latest.ndvi : 1;

  const zoneStyle = (zone: ParcelZone) => {
    if (layer === 'ndvi') {
      const value = zone.ndvi * ndviRatio;
      return { color: '#ffffff', weight: 1.5, fillColor: ndviColor(value), fillOpacity: 0.6 };
    }
    if (layer === 'radar') {
      const value = zone.moisture * (0.88 + 0.12 * Math.min(1, ndviRatio));
      return { color: '#ffffff', weight: 1.5, fillColor: radarColor(value), fillOpacity: 0.6 };
    }
    return {
      color: '#ffffff',
      weight: 1.5,
      fillColor: STATUS_COLORS[zone.status],
      fillOpacity: 0.42,
    };
  };

  const legend = useMemo(() => {
    if (layer === 'ndvi') {
      return [
        { color: '#ea580c', label: 'NDVI < 0,40' },
        { color: '#eab308', label: '0,40 – 0,65' },
        { color: '#15803d', label: '> 0,65 (vigueur)' },
      ];
    }
    if (layer === 'radar') {
      return [
        { color: '#dc2626', label: '< 18 % (sec)' },
        { color: '#d97706', label: '18 – 22 %' },
        { color: '#0284c7', label: '22 – 30 %' },
        { color: '#0369a1', label: '> 30 % (saturé)' },
      ];
    }
    return [
      { color: STATUS_COLORS.optimal, label: 'Optimal' },
      { color: STATUS_COLORS.vigilance, label: 'Vigilance' },
      { color: STATUS_COLORS.critique, label: 'Critique' },
    ];
  }, [layer]);

  const finishDrawing = () => {
    if (draft.length < 3) return;
    const ring = [...draft];
    const polygon = turf.polygon([ring.map(([lat, lng]) => [lng, lat])]);
    const areaHa = turf.area(polygon) / 10_000;
    const zones = splitIntoZones(
      ring,
      [
        { ndvi: latest.ndvi * 0.96, moisture: latest.moisture15 - 1.4, ec: latest.ec },
        { ndvi: latest.ndvi, moisture: latest.moisture15, ec: latest.ec, reference: true },
        { ndvi: latest.ndvi * 0.99, moisture: latest.moisture15 + 0.6, ec: latest.ec },
      ],
      'NOUVEAU',
    );
    setDrawn({ ring, areaHa, zones });
    setDraft([]);
    setDrawing(false);
    setEditing(false);
  };

  const cancelDrawing = () => {
    setDraft([]);
    setDrawing(false);
  };

  const moveVertex = (index: number, position: [number, number]) => {
    if (!drawn) return;
    const ring = drawn.ring.map((point, i) => (i === index ? position : point));
    const polygon = turf.polygon([ring.map(([lat, lng]) => [lng, lat])]);
    setDrawn({ ...drawn, ring, areaHa: turf.area(polygon) / 10_000 });
  };

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3 lg:px-5">
        <div>
          <h2 className="text-lg leading-tight text-slateink-800">
            Cartographie interactive &amp; jumeau spatial
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {parcel.shortName} · {formatNumber(parcel.areaHa, 1)} ha · {parcel.crop.name} (
            {parcel.crop.variety}) · {parcel.zones.length} zones homogènes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {drawing ? (
            <>
              <button type="button" className="btn-primary" onClick={finishDrawing} disabled={draft.length < 3}>
                <Check className="h-4 w-4" />
                Terminer le tracé ({draft.length} points)
              </button>
              <button type="button" className="btn-secondary" onClick={cancelDrawing}>
                <X className="h-4 w-4" />
                Annuler
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setDrawing(true);
                  setDraft([]);
                }}
              >
                <PencilRuler className="h-4 w-4" />
                Tracer une nouvelle parcelle
              </button>
              {drawn && (
                <>
                  <button
                    type="button"
                    className={`btn-secondary ${editing ? 'ring-2 ring-forest-500' : ''}`}
                    onClick={() => setEditing((value) => !value)}
                  >
                    <Sprout className="h-4 w-4" />
                    {editing ? 'Terminer l’édition' : 'Éditer les contours'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setDrawn(null)}>
                    <Trash2 className="h-4 w-4" />
                    Effacer
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5 lg:px-5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Calques</span>
        {(
          [
            { id: 'zones', label: 'Zones homogènes & sondes', icon: Layers },
            { id: 'ndvi', label: 'Indice végétatif (Sentinel-2 NDVI)', icon: Sprout },
            { id: 'radar', label: 'Humidité radar (Sentinel-1 SAR)', icon: Radar },
          ] as const
        ).map((option) => {
          const Icon = option.icon;
          const active = layer === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setLayer(option.id)}
              aria-pressed={active}
              className={`chip chip-action border ${
                active
                  ? 'border-forest-700 bg-forest-700 text-white shadow-sm'
                  : 'border-[#cbd5e1] bg-white text-slate-600 hover:border-forest-400'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {option.label}
            </button>
          );
        })}
        {layer === 'radar' && (
          <span className="chip border border-tech/30 bg-[#f0f9ff] text-tech">
            <Satellite className="h-3.5 w-3.5" />
            Observation radar traversant la couverture nuageuse
          </span>
        )}
      </div>

      <div className="relative">
        <MapContainer
          key={parcel.id}
          center={[parcel.center.lat, parcel.center.lng]}
          zoom={parcel.areaHa > 3 ? 14 : 16}
          scrollWheelZoom
          doubleClickZoom={!drawing}
          className="h-[360px] w-full sm:h-[430px]"
        >
          <TileLayer
            url={SAT_TILES}
            attribution={SAT_ATTRIBUTION}
            maxZoom={SAT_MAX_ZOOM}
            maxNativeZoom={SAT_MAX_NATIVE_ZOOM}
          />
          <MapInteractions drawing={drawing} onAddPoint={(point) => setDraft((p) => [...p, point])} onFinish={finishDrawing} />

          <Polygon
            positions={parcel.boundary}
            pathOptions={{ color: '#ffffff', weight: 4, fillOpacity: 0, opacity: 0.95 }}
          />

          {parcel.zones.map((zone) => (
            <Polygon key={zone.id} positions={zone.ring} pathOptions={zoneStyle(zone)}>
              <Popup>
                <div className="min-w-[190px] text-slateink-800">
                  <p className="text-sm font-bold">
                    {zone.label} {zone.isReferenceProbe ? '· zone témoin' : ''}
                  </p>
                  <dl className="mt-1.5 space-y-0.5 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Humidité 15 cm</dt>
                      <dd className="font-semibold">{formatNumber(zone.moisture)} %</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">NDVI Sentinel-2</dt>
                      <dd className="font-semibold">{formatNumber(zone.ndvi, 2)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">État</dt>
                      <dd className="font-semibold capitalize">{zone.status}</dd>
                    </div>
                  </dl>
                </div>
              </Popup>
            </Polygon>
          ))}

          {parcel.zones.map((zone) => (
            <Marker
              key={`probe-${zone.id}`}
              position={[zone.probe.lat, zone.probe.lng]}
              icon={probeIcon(zone.isReferenceProbe, zone.status)}
            >
              <Popup>
                <div className="min-w-[200px] text-slateink-800">
                  <p className="text-sm font-bold">{zone.probeLabel}</p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-forest-600">
                    Sonde recommandée — barycentre {zone.label}
                  </p>
                  <dl className="mt-1.5 space-y-0.5 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Dernière mesure</dt>
                      <dd className="font-semibold">{formatNumber(latest.moisture15)} %</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Radar Sentinel-1</dt>
                      <dd className="font-semibold">{formatNumber(latest.sentinel1Humidity)} %</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Scellé physique</dt>
                      <dd className={`font-semibold ${latest.sealOk ? 'text-forest-600' : 'text-[#dc2626]'}`}>
                        {latest.sealOk ? 'Intact' : 'Alerte ouverture'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Batterie solaire</dt>
                      <dd className="font-semibold">{latest.battery} %</dd>
                    </div>
                  </dl>
                </div>
              </Popup>
            </Marker>
          ))}

          {drawing && draft.length > 0 && (
            <>
              <Polyline positions={draft} pathOptions={{ color: '#f8fafc', weight: 3, dashArray: '6 5' }} />
              {draft.map((point, index) => (
                <Marker key={`draft-${index}`} position={point} icon={vertexIcon()} />
              ))}
            </>
          )}

          {drawn && (
            <>
              <Polygon
                positions={drawn.ring}
                pathOptions={{ color: '#4ade80', weight: 3, fillColor: '#22c55e', fillOpacity: 0.18, dashArray: '7 5' }}
              />
              {editing &&
                drawn.ring.map((point, index) => (
                  <Marker
                    key={`vertex-${index}`}
                    position={point}
                    icon={vertexIcon()}
                    draggable
                    eventHandlers={{
                      dragend: (event) => {
                        const latlng = (event.target as L.Marker).getLatLng();
                        moveVertex(index, [latlng.lat, latlng.lng]);
                      },
                    }}
                  />
                ))}
            </>
          )}
        </MapContainer>

        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-white/20 bg-[#0f172a]/85 px-3 py-2 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Légende</p>
          <ul className="mt-1 space-y-0.5">
            {legend.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5 text-[11px] font-medium">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
                {item.label}
              </li>
            ))}
          </ul>
        </div>

        {drawing && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-[500] w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-xl bg-[#0f172a]/90 px-3 py-1.5 text-center text-[11px] font-semibold leading-snug text-white shadow-lg sm:rounded-full sm:px-4 sm:text-xs">
            Touchez la carte pour ajouter un sommet · double-cliquez pour terminer
          </div>
        )}
      </div>

      <div className="border-t border-[#e2e8f0] px-4 py-3 lg:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slateink-700">
            <Satellite className="h-4 w-4 text-tech" />
            Curseur temporel
            <span className="chip bg-[#f8fafc] text-slate-600 ring-1 ring-[#e2e8f0]">
              {relativeDayLabel(timelineRecord.dayIndex, records.length)} · {formatDate(timelineRecord.timestamp)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500">
            <span>NDVI {formatNumber(timelineRecord.ndvi, 2)}</span>
            <span>Humidité {formatNumber(timelineRecord.moisture15)} %</span>
            <span>Radar {formatNumber(timelineRecord.sentinel1Humidity)} %</span>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={records.length - 1}
          value={Math.min(dayIndex, records.length - 1)}
          onChange={(event) => setDayIndex(Number(event.target.value))}
          className="timeline-slider mt-2.5 w-full"
          aria-label="Curseur temporel de la parcelle"
        />
        <div className="mt-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          <span>J-{records.length - 1}</span>
          <span>Aujourd’hui</span>
        </div>
      </div>

      {drawn && (
        <div className="border-t border-[#e2e8f0] bg-forest-50/60 px-4 py-3 lg:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-forest-700">
                Nouvelle parcelle vectorisée — {formatNumber(drawn.areaHa, 2)} ha
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                Surface calculée par @turf/turf · découpage automatique en {drawn.zones.length} sous-zones
                homogènes · sonde recommandée placée au barycentre de chaque zone.
              </p>
            </div>
            <div className="flex gap-1.5">
              {drawn.zones.map((zone) => (
                <span
                  key={zone.id}
                  className="chip bg-white text-slate-600 ring-1 ring-[#e2e8f0]"
                  style={{ borderLeft: `3px solid ${STATUS_COLORS[zone.status]}` }}
                >
                  {zone.id} · {formatNumber(zone.moisture)} %
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
