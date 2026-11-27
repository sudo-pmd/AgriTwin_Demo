import {
  BatteryCharging,
  Droplets,
  FlaskConical,
  ShieldAlert,
  ShieldCheck,
  Signal,
  Thermometer,
  Waves,
} from '../ui/icons';
import type { ReactNode } from 'react';
import type { Parcel, TelemetryRecord } from '../../types/agritwin';
import { formatNumber } from '../../utils/format';

interface KpiCardsProps {
  parcel: Parcel;
  latest: TelemetryRecord;
}

function moistureTone(value: number): { label: string; className: string; bar: string } {
  if (value < 18) return { label: 'Critique', className: 'bg-[#fef2f2] text-[#b91c1c]', bar: 'bg-[#dc2626]' };
  if (value < 22) return { label: 'Vigilance', className: 'bg-[#fffbeb] text-[#b45309]', bar: 'bg-[#d97706]' };
  if (value <= 34) return { label: 'Optimal', className: 'bg-[#f0fdf4] text-forest-600', bar: 'bg-forest-500' };
  return { label: 'Saturation', className: 'bg-[#f0f9ff] text-tech', bar: 'bg-tech' };
}

function MoistureGauge({ value }: { value: number }) {
  const position = Math.min(100, Math.max(0, (value / 45) * 100));
  return (
    <div className="mt-3">
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[#f1f5f9]">
        <div className="absolute inset-y-0 left-0 w-[40%] bg-[#fecaca]" />
        <div className="absolute inset-y-0 left-[40%] w-[9%] bg-[#fde68a]" />
        <div className="absolute inset-y-0 left-[48.9%] w-[26.6%] bg-[#bbf7d0]" />
        <div className="absolute inset-y-0 left-[75.5%] w-[24.5%] bg-[#bae6fd]" />
        <div
          className="absolute top-1/2 h-4 w-1.5 -translate-y-1/2 rounded-full bg-[#0f172a] shadow"
          style={{ left: `calc(${position}% - 3px)` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-500">
        <span>0 %</span>
        <span>18</span>
        <span>22</span>
        <span>34</span>
        <span>45 %</span>
      </div>
    </div>
  );
}

function CardShell({
  icon: Icon,
  title,
  children,
  tone = 'text-forest-600',
}: {
  icon: typeof Droplets;
  title: string;
  children: ReactNode;
  tone?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${tone}`} />
        <p className="text-[11px] font-bold uppercase leading-tight tracking-wide text-slate-500">
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

export default function KpiCards({ parcel, latest }: KpiCardsProps) {
  const tone = moistureTone(latest.moisture15);
  const deepDelta = latest.moisture35 - latest.moisture15;
  const ecAlert = latest.ec > 1.5;
  const phOk = latest.ph >= 6 && latest.ph <= 7.5;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <CardShell icon={Droplets} title="Humidité sol · 15 cm (racines)">
        <div className="mt-1.5 flex items-end justify-between">
          <p className="text-3xl font-extrabold leading-none text-slateink-800">
            {formatNumber(latest.moisture15)}
            <span className="ml-0.5 text-base font-bold text-slate-400">%</span>
          </p>
          <span className={`chip ${tone.className}`}>{tone.label}</span>
        </div>
        <MoistureGauge value={latest.moisture15} />
      </CardShell>

      <CardShell icon={Waves} title="Humidité sol · 35 cm (drainage)" tone="text-tech">
        <div className="mt-1.5 flex items-end justify-between">
          <p className="text-3xl font-extrabold leading-none text-slateink-800">
            {formatNumber(latest.moisture35)}
            <span className="ml-0.5 text-base font-bold text-slate-400">%</span>
          </p>
          <span className={`chip ${deepDelta >= 0 ? 'bg-[#f0f9ff] text-tech' : 'bg-[#fffbeb] text-[#b45309]'}`}>
            {deepDelta >= 0 ? '+' : ''}
            {formatNumber(deepDelta)} pts
          </span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Réserve profonde {deepDelta >= 4 ? 'reconstituée' : 'limitée'} · le front hydrique{' '}
          {deepDelta >= 4 ? 'progresse normalement vers la zone racinaire.' : 'reste bloqué en surface.'}
        </p>
      </CardShell>

      <CardShell icon={Thermometer} title="Température sol / air & pluie" tone="text-[#b45309]">
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <div>
            <p className="text-2xl font-extrabold leading-none text-slateink-800">
              {formatNumber(latest.soilTemp)}
              <span className="text-sm font-bold text-slate-400"> °C</span>
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sol</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold leading-none text-slateink-800">
              {formatNumber(latest.airTemp)}
              <span className="text-sm font-bold text-slate-400"> °C</span>
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Air</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-[#f8fafc] px-2.5 py-1.5">
          <span className="text-[11px] font-semibold text-slate-500">Pluviométrie</span>
          <span className="text-sm font-bold text-tech">{formatNumber(latest.rainfall)} mm</span>
        </div>
      </CardShell>

      <CardShell
        icon={FlaskConical}
        title="Salinité (EC) & acidité (pH)"
        tone={ecAlert ? 'text-[#b45309]' : 'text-forest-600'}
      >
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <div>
            <p className={`text-2xl font-extrabold leading-none ${ecAlert ? 'text-[#b45309]' : 'text-slateink-800'}`}>
              {formatNumber(latest.ec, 2)}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">dS/m</p>
          </div>
          <div>
            <p className={`text-2xl font-extrabold leading-none ${phOk ? 'text-slateink-800' : 'text-[#b45309]'}`}>
              {formatNumber(latest.ph, 2)}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">pH</p>
          </div>
        </div>
        <p
          className={`mt-2.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
            ecAlert ? 'bg-[#fffbeb] text-[#b45309]' : 'bg-[#f0fdf4] text-forest-600'
          }`}
        >
          {ecAlert
            ? `EC > 1,5 dS/m — lessivage recommandé (${parcel.soilType.split('—')[0].trim()})`
            : 'Salinité sous le seuil d’alerte de 1,5 dS/m'}
        </p>
      </CardShell>

      <CardShell icon={BatteryCharging} title="État matériel du boîtier" tone="text-slateink-800">
        <div className="mt-1.5 flex items-end justify-between">
          <p className="text-3xl font-extrabold leading-none text-slateink-800">
            {latest.battery}
            <span className="ml-0.5 text-base font-bold text-slate-400">%</span>
          </p>
          <span className="chip bg-[#f0fdf4] text-forest-600">Solaire</span>
        </div>
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#f1f5f9]">
          <div className="h-full rounded-full bg-forest-500" style={{ width: `${latest.battery}%` }} />
        </div>
        <div className="mt-3 space-y-1.5 text-[11px] font-semibold">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Scellé physique</span>
            <span className={`inline-flex items-center gap-1 ${latest.sealOk ? 'text-forest-600' : 'text-[#dc2626]'}`}>
              {latest.sealOk ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              {latest.sealOk ? 'Intact' : 'Alerte ouverture'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Signal LoRa</span>
            <span className="inline-flex items-center gap-1 text-slateink-700">
              <Signal className="h-3.5 w-3.5" />
              {latest.rssi} dBm
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Boîtier</span>
            <span className="font-mono text-[10px] text-slateink-700">{parcel.kitSerial}</span>
          </div>
        </div>
      </CardShell>
    </div>
  );
}
