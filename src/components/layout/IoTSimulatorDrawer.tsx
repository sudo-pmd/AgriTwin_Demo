import {
  Activity,
  AlertOctagon,
  Droplets,
  Loader2,
  Radio,
  RotateCcw,
  ShieldAlert,
  ThermometerSun,
  Wrench,
  X,
} from '../ui/icons';
import type { InjectionKind } from '../../types/agritwin';

interface IoTSimulatorDrawerProps {
  open: boolean;
  onClose: () => void;
  onInject: (kind: InjectionKind) => void;
  onReset: () => void;
  pending: boolean;
  summary: {
    score: number;
    gap: number;
    sealOk: boolean;
    fraud: boolean;
    records: number;
    lastInjection?: string;
  };
}

const ACTIONS: {
  kind: InjectionKind | 'reset';
  icon: typeof Droplets;
  title: string;
  description: string;
  tone: string;
  iconTone: string;
}[] = [
  {
    kind: 'normal',
    icon: Activity,
    title: 'Injecter un relevé normal',
    description:
      'Humidité 15 cm = 26,5 %, NDVI = 0,75. Empreinte SHA-256 chaînée au relevé précédent.',
    tone: 'border-[#e2e8f0] hover:border-forest-300 hover:bg-forest-50/40',
    iconTone: 'bg-forest-50 text-forest-600',
  },
  {
    kind: 'heat',
    icon: ThermometerSun,
    title: 'Simuler vague de chaleur & stress hydrique',
    description:
      'Température air = 39,5 °C, humidité 15 cm = 14,8 %. Alerte rouge immédiate + vocal wolof.',
    tone: 'border-[#e2e8f0] hover:border-[#fcd34d] hover:bg-[#fffbeb]',
    iconTone: 'bg-[#fffbeb] text-[#b45309]',
  },
  {
    kind: 'fraud',
    icon: AlertOctagon,
    title: 'Simuler une fraude (arrosage manuel sur sonde)',
    description:
      'Humidité capteur +48 % en 15 min, pluie 0 mm, radar Sentinel-1 stable à 21 %. Écart > 15 %.',
    tone: 'border-[#e2e8f0] hover:border-[#fca5a5] hover:bg-[#fef2f2]',
    iconTone: 'bg-[#fef2f2] text-[#dc2626]',
  },
  {
    kind: 'tamper',
    icon: Wrench,
    title: 'Simuler arrachement / ouverture boîtier',
    description:
      'accéléromètre_mouvement = true, boîtier_scelle_ok = false. Alerte matérielle et gel du dossier.',
    tone: 'border-[#e2e8f0] hover:border-[#fca5a5] hover:bg-[#fef2f2]',
    iconTone: 'bg-[#fef2f2] text-[#dc2626]',
  },
  {
    kind: 'reset',
    icon: RotateCcw,
    title: 'Réinitialiser la démonstration',
    description: 'Restaure les 90 jours de données capteur certifiées et le scellé intact.',
    tone: 'border-[#e2e8f0] hover:border-slate-400 hover:bg-slate-50',
    iconTone: 'bg-slate-100 text-slate-600',
  },
];

export default function IoTSimulatorDrawer({
  open,
  onClose,
  onInject,
  onReset,
  pending,
  summary,
}: IoTSimulatorDrawerProps) {
  return (
    <>
      <div
        className={`fixed inset-0 z-[1400] bg-[#0f172a]/40 transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed right-0 top-0 z-[1500] flex h-full w-full max-w-md flex-col border-l border-[#e2e8f0] bg-white shadow-lift transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
        aria-label="Simulateur IoT"
      >
        <div className="flex items-start justify-between border-b border-[#e2e8f0] px-5 py-4">
          <div>
            <p className="card-title">Banc de démonstration</p>
            <h2 className="mt-0.5 text-lg font-bold text-slateink-800">Simulateur IoT</h2>
            <p className="mt-1 text-xs text-slate-500">
              Injectez des événements en direct devant le jury.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost -mr-2 p-2"
            aria-label="Fermer le simulateur"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-5 py-4">
          <div className="grid grid-cols-3 gap-2">
            <StatusCell
              label="Chaîne"
              value={summary.fraud ? 'Anomalie' : 'Intègre'}
              tone={summary.fraud ? 'red' : 'green'}
              icon={summary.fraud ? ShieldAlert : Radio}
            />
            <StatusCell
              label="Sonde / radar"
              value={`${summary.gap.toFixed(1).replace('.', ',')} pts`}
              tone={summary.gap > 15 ? 'red' : 'green'}
              icon={Droplets}
            />
            <StatusCell
              label="Scellé"
              value={summary.sealOk ? 'Intact' : 'Ouvert'}
              tone={summary.sealOk ? 'green' : 'red'}
              icon={Wrench}
            />
          </div>
          <p className="mt-3 text-xs font-medium text-slate-500">
            {summary.records} blocs signés · Score actuel{' '}
            <span className="font-bold text-slateink-800">{summary.score}/100</span>
          </p>
          {summary.lastInjection && (
            <p className="mt-1 rounded-md bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 ring-1 ring-[#e2e8f0]">
              Dernière action : {summary.lastInjection}
            </p>
          )}
        </div>

        <div className="scroll-thin flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.kind}
                type="button"
                disabled={pending}
                onClick={() => (action.kind === 'reset' ? onReset() : onInject(action.kind))}
                className={`group flex w-full items-start gap-3 rounded-xl border bg-white p-3.5 text-left transition-all duration-200 hover:-translate-y-[1px] hover:shadow-sm active:translate-y-0 disabled:opacity-60 ${action.tone}`}
              >
                <span className={`mt-0.5 rounded-lg p-2 ${action.iconTone}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-bold text-slateink-800">{action.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                    {action.description}
                  </span>
                </span>
                {pending && action.kind !== 'reset' && (
                  <Loader2 className="mt-2 h-4 w-4 animate-spin text-slate-400" />
                )}
              </button>
            );
          })}
        </div>

        <div className="border-t border-[#e2e8f0] px-5 py-3 text-[11px] leading-relaxed text-slate-500">
          Les relevés injectés portent le badge{' '}
          <span className="font-semibold text-[#b45309]">Simulation Démo Active</span> et restent
          horodatés et signés en SHA-256 comme les données capteur certifiées.
        </div>
      </aside>
    </>
  );
}

function StatusCell({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: 'green' | 'red';
  icon: typeof Radio;
}) {
  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p
        className={`mt-0.5 text-xs font-extrabold ${
          tone === 'green' ? 'text-forest-600' : 'text-[#dc2626]'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
