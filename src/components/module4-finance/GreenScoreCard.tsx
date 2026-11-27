import {
  Droplets,
  Download,
  Fingerprint,
  Leaf,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  Unlock,
} from '../ui/icons';
import type { GreenScoreResult, Parcel } from '../../types/agritwin';
import { formatNumber } from '../../utils/format';
import { SCORE_WEIGHTS, SOIL_POINTS } from '../../utils/greenScoreEngine';

interface GreenScoreCardProps {
  score: GreenScoreResult;
  parcel: Parcel;
  consent: boolean;
  onConsentChange: (value: boolean) => void;
  onDownload: () => void;
  downloading: boolean;
  frozen: boolean;
  ec: number;
  ph: number;
  pestNote?: string | null;
}

export default function GreenScoreCard({
  score,
  parcel,
  consent,
  onConsentChange,
  onDownload,
  downloading,
  frozen,
  ec,
  ph,
  pestNote,
}: GreenScoreCardProps) {
  // Une fraude, une chaîne rompue ou un scellé ouvert priment sur le score brut.
  const suspended = frozen || score.fraudDetected || !score.chainValid;
  const tone = suspended
    ? '#dc2626'
    : score.total >= 75
      ? '#16a34a'
      : score.total >= 50
        ? '#d97706'
        : '#dc2626';
  const profileLabel = suspended
    ? 'Dossier suspendu'
    : score.profile === 'A'
      ? 'Profil A — éligible'
      : score.profile === 'B'
        ? 'Profil B — suivi coopératif'
        : 'Profil C — audit requis';
  const statusLabel = suspended
    ? 'Décaissement suspendu — audit requis'
    : score.total >= 75
      ? 'Éligible au déblocage de la tranche 2'
      : score.total >= 50
        ? 'Éligible sous suivi coopératif'
        : 'Décaissement suspendu — audit requis';

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(100, Math.max(0, score.total)) / 100) * circumference;

  /** La couleur d'une barre traduit la performance, comme les statuts du reste de l'app. */
  const barTone = (value: number, max: number) => {
    const ratio = value / max;
    return ratio >= 0.85 ? '#16a34a' : ratio >= 0.5 ? '#d97706' : '#dc2626';
  };

  const criteria = [
    {
      icon: Droplets,
      label: 'Régularité hydrique',
      value: score.water,
      max: SCORE_WEIGHTS.water,
      detail: `${score.waterDaysInRange}/${score.totalDays} jours avec humidité 15 cm entre 20 % et 35 %`,
      color: barTone(score.water, SCORE_WEIGHTS.water),
    },
    {
      icon: Leaf,
      label: 'Vigueur végétative',
      value: score.vegetation,
      max: SCORE_WEIGHTS.vegetation,
      detail: 'NDVI Sentinel-2 × 32, plafonné à 25 points',
      color: barTone(score.vegetation, SCORE_WEIGHTS.vegetation),
    },
    {
      icon: Sprout,
      label: 'Santé et salinité du sol',
      value: score.soil,
      max: SCORE_WEIGHTS.soil,
      detail: `EC ${formatNumber(ec, 2)} dS/m · pH ${formatNumber(ph, 2)} — barème ${SOIL_POINTS.optimal} / ${SOIL_POINTS.partial} / ${SOIL_POINTS.degraded} pts`,
      color: barTone(score.soil, SCORE_WEIGHTS.soil),
    },
    {
      icon: score.integrity > 0 ? ShieldCheck : ShieldAlert,
      label: 'Intégrité physique & cryptographique',
      value: score.integrity,
      max: SCORE_WEIGHTS.integrity,
      detail:
        score.integrity > 0
          ? `Chaîne SHA-256 valide, scellé intact, écart sonde/radar ${formatNumber(score.satelliteGap)} pts`
          : `Anomalie détectée — écart sonde/radar ${formatNumber(score.satelliteGap)} pts`,
      color: barTone(score.integrity, SCORE_WEIGHTS.integrity),
    },
  ];

  return (
    <section className="card p-4 lg:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg leading-tight text-slateink-800">Mon Score Vert</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {parcel.shortName} · campagne {parcel.crop.name} {parcel.crop.variety}
          </p>
        </div>
        <span
          className="chip border"
          style={{ borderColor: `${tone}44`, background: `${tone}12`, color: tone }}
        >
          {profileLabel}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-[190px_1fr]">
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-4">
          <svg viewBox="0 0 140 140" className="h-[150px] w-[150px]" role="img" aria-label={`Score Vert ${score.total} sur 100`}>
            <circle cx="70" cy="70" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="13" />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={tone}
              strokeWidth="13"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference - dash}`}
              transform="rotate(-90 70 70)"
            />
            <text x="70" y="68" textAnchor="middle" className="fill-[#0f172a]" style={{ fontSize: 34, fontWeight: 800 }}>
              {score.total}
            </text>
            <text x="70" y="88" textAnchor="middle" style={{ fontSize: 12, fontWeight: 600, fill: '#64748b' }}>
              / 100
            </text>
          </svg>
          <p
            className={`mt-1 text-center text-[11px] font-semibold leading-tight ${
              suspended ? 'text-[#b91c1c]' : 'text-slate-500'
            }`}
          >
            {statusLabel}
          </p>
        </div>

        <div className="space-y-2">
          {criteria.map((criterion) => {
            const Icon = criterion.icon;
            const percent = Math.round((criterion.value / criterion.max) * 100);
            return (
              <div key={criterion.label} className="rounded-lg border border-[#e2e8f0] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slateink-800">
                    <Icon className="h-3.5 w-3.5" style={{ color: criterion.color }} />
                    {criterion.label}
                  </span>
                  <span className="text-xs font-extrabold text-slateink-800">
                    {criterion.value}
                    <span className="font-semibold text-slate-400">/{criterion.max}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#f1f5f9]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${percent}%`, background: criterion.color }}
                  />
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-500">{criterion.detail}</p>
              </div>
            );
          })}
        </div>
      </div>

      {frozen && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs font-semibold text-[#b91c1c]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Dossier gelé : ouverture ou arrachement du boîtier scellé signalé par l’accéléromètre.
          Aucun décaissement possible avant inspection.
        </div>
      )}

      {!score.chainValid && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs font-semibold text-[#b91c1c]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Chaîne cryptographique altérée : la composante intégrité est annulée.
        </div>
      )}

      {pestNote && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[11px] font-semibold text-[#b45309]">
          <Leaf className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {pestNote}
        </div>
      )}

      <div className="mt-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span
              className={`mt-0.5 rounded-lg p-1.5 ${
                consent ? 'bg-forest-50 text-forest-600' : 'bg-white text-slate-400 ring-1 ring-[#e2e8f0]'
              }`}
            >
              {consent ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </span>
            <div>
              <p className="text-xs font-bold leading-snug text-slateink-800">
                Autoriser le partage de mon Dossier &amp; Score Vert avec mon institution financière
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                Conforme à la loi sénégalaise n° 2008-12 sur la protection des données personnelles
                (CDP). Consentement révocable à tout moment.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={consent}
            aria-label="Partager mon dossier avec mon institution financière"
            onClick={() => onConsentChange(!consent)}
            className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
              consent ? 'bg-forest-600' : 'bg-[#cbd5e1]'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                consent ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      <button type="button" className="btn-primary mt-3 w-full" onClick={onDownload} disabled={downloading}>
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Télécharger le Dossier de Crédit Score Vert (PDF)
      </button>
    </section>
  );
}
