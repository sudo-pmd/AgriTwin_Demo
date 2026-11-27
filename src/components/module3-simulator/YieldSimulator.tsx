import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Droplets,
  FlaskConical,
  Gauge,
  Sprout,
  TrendingUp,
} from '../ui/icons';
import type { Parcel, TelemetryRecord } from '../../types/agritwin';
import {
  DEFAULT_PARAMS,
  cropStage,
  projectYield,
  type SimulationParams,
} from '../../utils/agronomyEngine';
import { formatFCFA, formatNumber } from '../../utils/format';

interface YieldSimulatorProps {
  parcel: Parcel;
  records: TelemetryRecord[];
}

function SliderRow({
  icon: Icon,
  label,
  hint,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  icon: typeof Droplets;
  label: string;
  hint: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 rounded-lg bg-forest-50 p-1.5 text-forest-600">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-slateink-800">{label}</p>
            <p className="text-[11px] leading-tight text-slate-500">{hint}</p>
          </div>
        </div>
        <span className="chip whitespace-nowrap bg-[#0f172a] text-white">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-forest-700"
        aria-label={label}
      />
      <div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-400">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export default function YieldSimulator({ parcel, records }: YieldSimulatorProps) {
  const latest = records[records.length - 1];
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [applied, setApplied] = useState(false);

  const baseline = useMemo(() => projectYield(parcel, latest.ec, DEFAULT_PARAMS), [parcel, latest.ec]);
  const scenario = useMemo(() => projectYield(parcel, latest.ec, params), [parcel, latest.ec, params]);

  const deltaPct = (next: number, base: number) => {
    if (base === 0) return 0;
    return ((next - base) / Math.abs(base)) * 100;
  };

  const rows = [
    {
      label: 'Rendement estimé',
      base: `${formatNumber(baseline.yieldTPerHa, 2)} t/ha`,
      next: `${formatNumber(scenario.yieldTPerHa, 2)} t/ha`,
      delta: deltaPct(scenario.yieldTPerHa, baseline.yieldTPerHa),
    },
    {
      label: 'Production totale',
      base: `${formatNumber(baseline.totalProductionT, 2)} t`,
      next: `${formatNumber(scenario.totalProductionT, 2)} t`,
      delta: deltaPct(scenario.totalProductionT, baseline.totalProductionT),
    },
    {
      label: 'Consommation d’eau',
      base: `${formatNumber(baseline.waterM3, 0)} m³`,
      next: `${formatNumber(scenario.waterM3, 0)} m³`,
      delta: deltaPct(scenario.waterM3, baseline.waterM3),
    },
    {
      label: 'Marge nette',
      base: formatFCFA(baseline.netMargin, true),
      next: formatFCFA(scenario.netMargin, true),
      delta: deltaPct(scenario.netMargin, baseline.netMargin),
    },
  ];

  const chartData = [
    {
      name: 'Situation actuelle',
      rendement: Number(baseline.yieldTPerHa.toFixed(2)),
      marge: Math.round(baseline.netMargin / 1000),
    },
    {
      name: 'Scénario simulé',
      rendement: Number(scenario.yieldTPerHa.toFixed(2)),
      marge: Math.round(scenario.netMargin / 1000),
    },
  ];

  const allRows: { label: string; base: string; next: string; delta?: number }[] = [
    ...rows,
    {
      label: 'Revenu brut',
      base: formatFCFA(baseline.grossRevenue, true),
      next: formatFCFA(scenario.grossRevenue, true),
    },
    {
      label: 'Coût total',
      base: formatFCFA(baseline.totalCost, true),
      next: formatFCFA(scenario.totalCost, true),
    },
  ];

  const update = (patch: Partial<SimulationParams>) => {
    setApplied(false);
    setParams((current) => ({ ...current, ...patch }));
  };

  const resetParams = () => {
    setApplied(false);
    setParams(DEFAULT_PARAMS);
  };

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="card p-4 lg:p-5">
        <h2 className="text-lg leading-tight text-slateink-800">Simulateur agronomique</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Testez vos décisions sur la copie numérique avant de les appliquer au champ.
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="chip bg-[#f8fafc] text-slate-600 ring-1 ring-[#e2e8f0]">
            {parcel.crop.name} · {parcel.crop.variety}
          </span>
          <span className="chip bg-[#f8fafc] text-slate-600 ring-1 ring-[#e2e8f0]">
            Y max {formatNumber(parcel.crop.yMax)} t/ha
          </span>
          <span className="chip bg-[#f8fafc] text-slate-600 ring-1 ring-[#e2e8f0]">
            EC {formatNumber(latest.ec, 2)} dS/m
          </span>
          <span className="chip bg-[#f8fafc] text-slate-600 ring-1 ring-[#e2e8f0]">
            {cropStage(parcel, 68)}
          </span>
        </div>

        <div className="mt-3 space-y-2.5">
          <SliderRow
            icon={Droplets}
            label="Variation de l’irrigation (ΔI)"
            hint="Ajustement du volume apporté sur la campagne"
            value={params.irrigationDelta}
            display={`${params.irrigationDelta > 0 ? '+' : ''}${params.irrigationDelta} %`}
            min={-50}
            max={50}
            step={5}
            onChange={(value) => update({ irrigationDelta: value })}
          />
          <SliderRow
            icon={FlaskConical}
            label="Dose d’engrais azoté (N)"
            hint="Azote total apporté sur le cycle"
            value={params.nitrogen}
            display={`${params.nitrogen} kg/ha`}
            min={0}
            max={200}
            step={10}
            onChange={(value) => update({ nitrogen: value })}
          />
          <SliderRow
            icon={Sprout}
            label="Décalage du calendrier cultural (ΔT)"
            hint="Avance ou retard du semis / des interventions"
            value={params.calendarShift}
            display={`${params.calendarShift > 0 ? '+' : ''}${params.calendarShift} j`}
            min={-15}
            max={15}
            step={1}
            onChange={(value) => update({ calendarShift: value })}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {[
            { label: 'S eau', value: scenario.scoreWater },
            { label: 'S engrais', value: scenario.scoreFertilizer },
            { label: 'S calendrier', value: scenario.scoreCalendar },
            { label: 'S salinité', value: scenario.scoreSalinity },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-[#f8fafc] px-2 py-1.5 text-center ring-1 ring-[#e2e8f0]">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="text-sm font-extrabold text-slateink-800">{formatNumber(item.value, 3)}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-500">
          <span>
            Coût eau : {formatFCFA(scenario.waterCostPerHa, true)} / ha
          </span>
          <button type="button" onClick={resetParams} className="font-bold text-forest-700 hover:underline">
            Réinitialiser les curseurs
          </button>
        </div>
      </section>

      <section className="card p-4 lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-lg leading-tight text-slateink-800">
              Situation actuelle vs scénario simulé
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Modèle mécaniste de bilan hydrique inspiré du cadre AquaCrop (FAO)
            </p>
          </div>
          <span
            className={`chip ${
              scenario.netMargin >= baseline.netMargin
                ? 'bg-[#f0fdf4] text-forest-600'
                : 'bg-[#fef2f2] text-[#b91c1c]'
            }`}
          >
            {scenario.netMargin >= baseline.netMargin ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {formatFCFA(scenario.netMargin - baseline.netMargin, true)} d’écart
          </span>
        </div>

        <div className="mt-3 space-y-2 sm:hidden">
          {allRows.map((row) => (
            <div key={row.label} className="rounded-xl border border-[#e2e8f0] p-2.5">
              <p className="text-xs font-bold text-slateink-800">{row.label}</p>
              <dl className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Actuel
                  </dt>
                  <dd className="mt-0.5 font-semibold text-slate-600">{row.base}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Simulé
                  </dt>
                  <dd className="mt-0.5 font-bold text-slateink-800">{row.next}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Écart
                  </dt>
                  <dd
                    className={`mt-0.5 font-bold ${
                      row.delta === undefined
                        ? 'text-slate-400'
                        : row.delta > 0.05
                          ? 'text-forest-600'
                          : row.delta < -0.05
                            ? 'text-[#b91c1c]'
                            : 'text-slate-500'
                    }`}
                  >
                    {row.delta === undefined
                      ? '—'
                      : `${row.delta > 0 ? '+' : ''}${formatNumber(row.delta, 1)} %`}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        <div className="mt-3 hidden overflow-hidden rounded-xl border border-[#e2e8f0] sm:block">
          <table className="w-full text-sm">
            <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-bold">Indicateur</th>
                <th className="px-3 py-2 text-right font-bold">Actuel</th>
                <th className="px-3 py-2 text-right font-bold">Simulé</th>
                <th className="px-3 py-2 text-right font-bold">Écart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {allRows.map((row) => (
                <tr key={row.label}>
                  <td className="px-3 py-2 font-semibold text-slateink-800">{row.label}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{row.base}</td>
                  <td className="px-3 py-2 text-right font-bold text-slateink-800">{row.next}</td>
                  <td
                    className={`px-3 py-2 text-right font-bold ${
                      row.delta === undefined
                        ? 'text-slate-400'
                        : row.delta > 0.05
                          ? 'text-forest-600'
                          : row.delta < -0.05
                            ? 'text-[#b91c1c]'
                            : 'text-slate-400'
                    }`}
                  >
                    {row.delta === undefined
                      ? '—'
                      : `${row.delta > 0 ? '+' : ''}${formatNumber(row.delta, 1)} %`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 h-[190px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={(value) => `${value} k`}
              />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                formatter={(value, name) =>
                  name === 'Rendement (t/ha)'
                    ? [`${formatNumber(Number(value), 2)} t/ha`, name]
                    : [`${formatNumber(Number(value), 0)} k FCFA`, name]
                }
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="rendement" name="Rendement (t/ha)" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.name === 'Situation actuelle' ? '#94a3b8' : '#15803d'} />
                ))}
              </Bar>
              <Bar yAxisId="right" dataKey="marge" name="Marge nette (k FCFA)" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.name === 'Situation actuelle' ? '#cbd5e1' : '#0284c7'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="btn-primary" onClick={() => setApplied(true)}>
            <CheckCircle2 className="h-4 w-4" />
            Appliquer ces recommandations à mon calendrier
          </button>
          <span className="text-[11px] font-semibold text-slate-500">
            Marge nette simulée : <span className="font-bold text-slateink-800">{formatFCFA(scenario.netMargin)}</span>
          </span>
        </div>

        {applied && (
          <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-xs font-semibold text-forest-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            Recommandations appliquées au calendrier cultural : irrigation{' '}
            {params.irrigationDelta > 0 ? '+' : ''}
            {params.irrigationDelta} %, azote {params.nitrogen} kg/ha, décalage{' '}
            {params.calendarShift > 0 ? '+' : ''}
            {params.calendarShift} jour(s). Le plan d’irrigation de la parcelle a été mis à jour.
            <ArrowRight className="ml-auto h-4 w-4 shrink-0" />
          </div>
        )}
      </section>
    </div>
  );
}
