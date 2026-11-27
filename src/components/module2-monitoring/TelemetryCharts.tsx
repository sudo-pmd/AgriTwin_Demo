import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CloudRain, Leaf, Satellite } from '../ui/icons';
import type { Parcel, TelemetryRecord } from '../../types/agritwin';
import { formatDate, formatNumber, relativeDayLabel } from '../../utils/format';

interface TelemetryChartsProps {
  parcel: Parcel;
  records: TelemetryRecord[];
}

export default function TelemetryCharts({ parcel, records }: TelemetryChartsProps) {
  const data = useMemo(
    () =>
      records.map((record) => ({
        day: relativeDayLabel(record.dayIndex, records.length),
        date: formatDate(record.timestamp),
        moisture: record.moisture15,
        radar: record.sentinel1Humidity,
        rain: record.rainfall,
        irrigation: record.irrigation,
        ndvi: record.ndvi,
        reference: record.ndviReference,
      })),
    [records],
  );

  const rainTotal = records.reduce((sum, record) => sum + record.rainfall, 0);
  const meanGap =
    records.reduce((sum, record) => sum + Math.abs(record.moisture15 - record.sentinel1Humidity), 0) /
    Math.max(1, records.length);
  const latest = records[records.length - 1];

  const tooltipStyle = {
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    fontSize: 12,
    boxShadow: '0 10px 30px -12px rgba(15,23,42,.28)',
  };

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      <section className="card p-4 lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-lg leading-tight text-slateink-800">
              Croisement hydrique capteur / radar Sentinel-1
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Humidité racinaire, radar SAR et apports d’eau sur 90 jours
            </p>
          </div>
          <span className="chip bg-[#f0f9ff] text-tech">
            <CloudRain className="h-3.5 w-3.5" />
            {formatNumber(rainTotal, 1)} mm cumulés
          </span>
        </div>

        <div className="mt-3 h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 4, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={14} tickMargin={6} />
              <YAxis
                yAxisId="moisture"
                domain={[0, 45]}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis
                yAxisId="water"
                orientation="right"
                domain={[0, 25]}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => `Journée ${label}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
              <Bar
                yAxisId="water"
                dataKey="rain"
                name="Pluie (mm)"
                stackId="water"
                fill="#0284c7"
                barSize={5}
                radius={[2, 2, 0, 0]}
              />
              <Bar
                yAxisId="water"
                dataKey="irrigation"
                name="Irrigation (mm)"
                stackId="water"
                fill="#7dd3fc"
                barSize={5}
                radius={[2, 2, 0, 0]}
              />
              <Line
                yAxisId="moisture"
                type="monotone"
                dataKey="moisture"
                name="Humidité capteur 15 cm (%)"
                stroke="#14532d"
                strokeWidth={2.2}
                dot={false}
              />
              <Line
                yAxisId="moisture"
                type="monotone"
                dataKey="radar"
                name="Radar Sentinel-1 (%)"
                stroke="#0284c7"
                strokeWidth={1.8}
                strokeDasharray="5 4"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500">
          <span>
            Écart moyen sonde / radar : <span className="text-slateink-800">{formatNumber(meanGap)} pts</span>
          </span>
          <span>
            Dernier relevé : <span className="text-slateink-800">{latest.deviceId}</span>
          </span>
        </div>
      </section>

      <section className="card p-4 lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-lg leading-tight text-slateink-800">
              Croissance végétale · NDVI Sentinel-2
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Courbe observée comparée à la référence optimale de la culture
            </p>
          </div>
          <span className="chip bg-forest-50 text-forest-600">
            NDVI {formatNumber(latest.ndvi, 2)} / réf. {formatNumber(latest.ndviReference, 2)}
          </span>
        </div>

        <div className="mt-3 h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -22 }}>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={14} tickMargin={6} />
              <YAxis domain={[0.1, 0.9]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => v.toFixed(1)} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => `Journée ${label}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
              <Line
                type="monotone"
                dataKey="reference"
                name="Référence optimale"
                stroke="#94a3b8"
                strokeWidth={1.6}
                strokeDasharray="6 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="ndvi"
                name="NDVI observé (Sentinel-2)"
                stroke="#16a34a"
                strokeWidth={2.6}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500">
          <span>
            Culture : <span className="text-slateink-800">{parcel.crop.name} {parcel.crop.variety}</span>
          </span>
          <span>
            Semis : <span className="text-slateink-800">15/09/2026</span>
          </span>
          <span>
            Vigueur : <span className="text-forest-600">
              {latest.ndvi >= 0.65 ? 'confirmée' : latest.ndvi >= 0.45 ? 'modérée' : 'faible'}
            </span>
          </span>
        </div>
      </section>
    </div>
  );
}
