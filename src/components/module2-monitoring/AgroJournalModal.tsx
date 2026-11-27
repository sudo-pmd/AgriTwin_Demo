import { useMemo, useState } from 'react';
import { CalendarDays, Check, ClipboardList, Leaf, Plus, Sprout, X } from '../ui/icons';
import type { FertilizerEntry, Parcel, PestReport } from '../../types/agritwin';
import { PEST_OPTIONS } from '../../data/wolofPhrases';
import {
  nitrogenFromProduct,
  type FertilizerProduct,
} from '../../utils/agronomyEngine';
import { formatDate, formatNumber } from '../../utils/format';

interface AgroJournalModalProps {
  open: boolean;
  onClose: () => void;
  parcel: Parcel;
  fertilizers: FertilizerEntry[];
  pests: PestReport[];
  onAddFertilizer: (input: { type: FertilizerProduct; quantityKg: number; date: string }) => void;
  onAddPest: (input: { type: PestReport['type']; severity: PestReport['severity']; note: string; date: string }) => void;
}

const PRODUCTS: { value: FertilizerProduct; ratio: string }[] = [
  { value: 'NPK 10-10-20', ratio: '10 % N' },
  { value: 'Urée 46%', ratio: '46 % N' },
  { value: 'Fumure organique', ratio: '3 % N' },
];

export default function AgroJournalModal({
  open,
  onClose,
  parcel,
  fertilizers,
  pests,
  onAddFertilizer,
  onAddPest,
}: AgroJournalModalProps) {
  const [tab, setTab] = useState<'fertilizer' | 'pest'>('fertilizer');
  const [product, setProduct] = useState<FertilizerProduct>('NPK 10-10-20');
  const [quantity, setQuantity] = useState('50');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [pestType, setPestType] = useState<PestReport['type']>('Chenilles');
  const [severity, setSeverity] = useState<PestReport['severity']>('modérée');
  const [note, setNote] = useState('');
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const appliedNitrogen = fertilizers.reduce((sum, entry) => sum + entry.nitrogenKgHa, 0);
  const need = parcel.crop.nitrogenNeed;
  const coverage = Math.min(100, Math.round((appliedNitrogen / need) * 100));

  const timeline = useMemo(() => {
    const entries = [
      ...fertilizers.map((entry) => ({
        id: entry.id,
        date: entry.date,
        kind: 'engrais' as const,
        title: `Apport ${entry.type}`,
        detail: `${entry.quantityKg} kg · ${formatNumber(entry.nitrogenKgHa)} kg N/ha`,
        severity: null,
      })),
      ...pests.map((entry) => ({
        id: entry.id,
        date: entry.date,
        kind: 'phyto' as const,
        title: `Signalement ${entry.type}`,
        detail: `Sévérité ${entry.severity}${entry.note ? ` — ${entry.note}` : ''}`,
        severity: entry.severity,
      })),
    ];
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [fertilizers, pests]);

  if (!open) return null;

  const submitFertilizer = () => {
    const quantityKg = Number(quantity);
    if (!quantityKg || quantityKg <= 0) return;
    onAddFertilizer({ type: product, quantityKg, date: new Date(date).toISOString() });
    setConfirmation(
      `Apport de ${quantityKg} kg de ${product} enregistré — ${formatNumber(
        nitrogenFromProduct(product, quantityKg, parcel.areaHa),
      )} kg N/ha, intégré au bilan minéral.`,
    );
    setQuantity('50');
  };

  const submitPest = () => {
    onAddPest({ type: pestType, severity, note, date: new Date(date).toISOString() });
    setConfirmation(`Signalement ${pestType} enregistré sur la frise chronologique.`);
    setNote('');
  };

  return (
    <div className="fixed inset-0 z-[1600] flex items-end justify-center bg-[#0f172a]/50 p-0 sm:items-center sm:p-6">
      <div className="scroll-thin max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl bg-white shadow-lift sm:rounded-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-[#e2e8f0] bg-white px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="card-title">Module 2 · suivi terrain</p>
            <h2 className="mt-0.5 text-lg leading-snug text-slateink-800 sm:text-xl">
              Journal agronomique — bilan minéral &amp; phytosanitaire
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {parcel.shortName} · {parcel.crop.name} {parcel.crop.variety} ·{' '}
              {formatNumber(parcel.areaHa)} ha
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost p-2" aria-label="Fermer le journal">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Bilan azoté de la campagne
                </p>
                <span className="chip bg-white text-forest-600 ring-1 ring-[#e2e8f0]">
                  {coverage} % du besoin
                </span>
              </div>
              <div className="mt-3 flex items-end gap-3">
                <p className="text-3xl font-extrabold leading-none text-slateink-800">
                  {formatNumber(appliedNitrogen)}
                  <span className="ml-1 text-sm font-bold text-slate-400">kg N/ha apportés</span>
                </p>
              </div>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
                <div
                  className={`h-full rounded-full ${
                    coverage >= 85 ? 'bg-forest-500' : coverage >= 50 ? 'bg-[#d97706]' : 'bg-[#f59e0b]'
                  }`}
                  style={{ width: `${coverage}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-slate-500">
                <span>0</span>
                <span>Besoin du stade cultural : {need} kg N/ha</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                Le bilan minéral remplace les capteurs NPK peu fiables : chaque apport déclaré est
                converti en azote disponible puis confronté au lessivage hydrique mesuré.
              </p>
            </div>

            <div className="rounded-xl border border-[#e2e8f0] p-2">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#f1f5f9] p-1">
                <button
                  type="button"
                  onClick={() => setTab('fertilizer')}
                  className={`rounded-md px-2 py-2 text-[11px] font-bold leading-snug ${
                    tab === 'fertilizer' ? 'bg-white text-forest-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  + Déclarer un apport d’engrais
                </button>
                <button
                  type="button"
                  onClick={() => setTab('pest')}
                  className={`rounded-md px-2 py-2 text-[11px] font-bold leading-snug ${
                    tab === 'pest' ? 'bg-white text-forest-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Signaler un incident phytosanitaire
                </button>
              </div>

              {tab === 'fertilizer' ? (
                <div className="space-y-2.5 p-2 pt-3">
                  <div>
                    <label className="field-label" htmlFor="fert-type">
                      Type d’engrais
                    </label>
                    <select
                      id="fert-type"
                      className="field"
                      value={product}
                      onChange={(event) => setProduct(event.target.value as FertilizerProduct)}
                    >
                      {PRODUCTS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.value} ({item.ratio})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="field-label" htmlFor="fert-qty">
                        Quantité (kg)
                      </label>
                      <input
                        id="fert-qty"
                        type="number"
                        min={1}
                        className="field"
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="fert-date">
                        Date
                      </label>
                      <input
                        id="fert-date"
                        type="date"
                        className="field"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                      />
                    </div>
                  </div>
                  <button type="button" className="btn-primary w-full" onClick={submitFertilizer}>
                    <Plus className="h-4 w-4" />
                    Enregistrer l’apport
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 p-2 pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    {PEST_OPTIONS.map((option) => (
                      <button
                        key={option.type}
                        type="button"
                        onClick={() => setPestType(option.type)}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-bold transition ${
                          pestType === option.type
                            ? 'border-forest-500 bg-forest-50 text-forest-700'
                            : 'border-[#e2e8f0] bg-white text-slate-600 hover:border-forest-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="field-label" htmlFor="pest-severity">
                        Sévérité
                      </label>
                      <select
                        id="pest-severity"
                        className="field"
                        value={severity}
                        onChange={(event) => setSeverity(event.target.value as PestReport['severity'])}
                      >
                        <option value="faible">Faible</option>
                        <option value="modérée">Modérée</option>
                        <option value="élevée">Élevée</option>
                      </select>
                    </div>
                    <div>
                      <label className="field-label" htmlFor="pest-date">
                        Date
                      </label>
                      <input
                        id="pest-date"
                        type="date"
                        className="field"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="pest-note">
                      Observation (optionnel)
                    </label>
                    <textarea
                      id="pest-note"
                      className="field min-h-[62px] resize-y"
                      placeholder="Localisation, foyers observés…"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </div>
                  <button type="button" className="btn-primary w-full" onClick={submitPest}>
                    <Plus className="h-4 w-4" />
                    Enregistrer le signalement
                  </button>
                </div>
              )}
            </div>

            {confirmation && (
              <div className="flex items-start gap-2 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-xs font-semibold text-forest-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                {confirmation}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#e2e8f0] p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              <CalendarDays className="h-4 w-4 text-tech" />
              Frise chronologique
            </p>
            <ul className="mt-3 space-y-2.5">
              {timeline.map((event) => (
                <li key={event.id} className="relative border-l-2 border-[#e2e8f0] pl-3">
                  <span
                    className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full ring-2 ring-white ${
                      event.kind === 'engrais' ? 'bg-forest-500' : 'bg-[#d97706]'
                    }`}
                  />
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {formatDate(event.date)} · {event.kind === 'engrais' ? 'Intrant' : 'Phytosanitaire'}
                  </p>
                  <p className="text-sm font-bold text-slateink-800">{event.title}</p>
                  <p className="text-xs leading-relaxed text-slate-500">{event.detail}</p>
                </li>
              ))}
              {timeline.length === 0 && (
                <li className="text-xs text-slate-500">Aucun événement consigné.</li>
              )}
            </ul>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#f8fafc] px-3 py-2 text-[11px] leading-relaxed text-slate-500">
              <Leaf className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest-600" />
              Un ravageur déclaré est traité comme un aléa sanitaire : la baisse de NDVI associée
              n’est pas imputée à une négligence d’irrigation dans le Score Vert.
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <Sprout className="h-3.5 w-3.5 text-forest-600" />
              Stade cultural : {parcel.crop.name === 'Tomate' ? 'grossissement des fruits' : 'bulbaison'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
