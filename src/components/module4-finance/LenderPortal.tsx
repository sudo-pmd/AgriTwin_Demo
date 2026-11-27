import {
  Building2,
  Download,
  Droplets,
  FileText,
  Fingerprint,
  Leaf,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  Umbrella,
  Wallet,
} from '../ui/icons';
import type {
  CreditVerdict,
  GreenScoreResult,
  Parcel,
  ParcelDataset,
} from '../../types/agritwin';
import { assuranceStatus } from '../../utils/greenScoreEngine';
import { formatDate, formatFCFA, formatNumber } from '../../utils/format';

interface LenderPortalProps {
  parcel: Parcel;
  dataset: ParcelDataset;
  score: GreenScoreResult;
  verdict: CreditVerdict;
  onDownload: () => void;
  downloading: boolean;
  onExportBundle: () => void;
  exporting: boolean;
}

const TONE_STYLES = {
  green: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', icon: ShieldCheck },
  amber: { bg: '#fffbeb', border: '#fde68a', text: '#b45309', icon: ShieldAlert },
  red: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', icon: ShieldAlert },
} as const;

function Stat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Droplets;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold leading-none text-slateink-800">{value}</p>
      <p className="mt-1 text-[10px] leading-tight text-slate-500">{detail}</p>
    </div>
  );
}

export default function LenderPortal({
  parcel,
  dataset,
  score,
  verdict,
  onDownload,
  downloading,
  onExportBundle,
  exporting,
}: LenderPortalProps) {
  const latest = dataset.records[dataset.records.length - 1];
  const assurance = assuranceStatus(dataset, score);
  const assuranceTone = TONE_STYLES[assurance.tone];
  const AssurIcon = assuranceTone.icon;
  const verdictTone = TONE_STYLES[verdict.tone];
  const VerdictIcon = verdictTone.icon;
  const totalRain = dataset.records.reduce((sum, record) => sum + record.rainfall, 0);
  const totalIrrigation = dataset.records.reduce((sum, record) => sum + record.irrigation, 0);

  if (!dataset.consent) {
    return (
      <section className="card mx-auto mt-4 max-w-3xl p-6 text-center lg:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f8fafc] ring-1 ring-[#e2e8f0]">
          <Lock className="h-7 w-7 text-slate-400" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-slateink-800">Accès aux données restreint</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          L’exploitant n’a pas encore activé le partage de son dossier (protection des données
          personnelles CDP). Aucune donnée agronomique ni Score Vert ne peut être consulté par
          l’institution financière avant consentement explicite.
        </p>
        <div className="mx-auto mt-4 max-w-xl rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-left text-xs leading-relaxed text-slate-600">
          <p className="font-bold text-slateink-800">Exploitation sélectionnée</p>
          <p>
            {parcel.name} · {parcel.owner} ({parcel.ownerRole})
          </p>
          <p className="mt-1">
            Pour la démonstration, basculez en <span className="font-bold">Vue Exploitant</span>,
            onglet <span className="font-bold">4. Mon Score Vert</span>, puis activez l’interrupteur de
            partage. Le portail se déverrouille immédiatement.
          </p>
        </div>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Concours AKTIION 2026 · École Polytechnique de Thiès
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] bg-[#0f172a] px-4 py-3 text-white lg:px-5">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-white/10 p-2">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
                Portail institution financière &amp; assurance
              </p>
              <h2 className="text-base font-bold">Dossier de crédit Score Vert</h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className="chip bg-white/10 text-white">
              <FileText className="h-3.5 w-3.5" />
              AT-{parcel.id}-{new Date().getFullYear()}
            </span>
            <span className="chip bg-[#f0fdf4] text-forest-700">Consentement CDP actif</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 px-4 py-4 lg:grid-cols-[1.15fr_1fr] lg:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Identité de l’exploitation
            </p>
            <h3 className="mt-0.5 text-lg font-extrabold leading-tight text-slateink-800">
              {parcel.name}
            </h3>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {[
                ['Titulaire', `${parcel.owner} — ${parcel.ownerRole}`],
                ['Mode', parcel.mode],
                ['Culture', `${parcel.crop.name} ${parcel.crop.variety}`],
                ['Surface', `${formatNumber(parcel.areaHa)} ha`],
                ['GPS', parcel.gpsLabel.split('—')[0].trim()],
                ['Boîtier scellé', parcel.kitSerial],
                ['Sol', parcel.soilType.split('—')[0].trim()],
                ['Dernier relevé', formatDate(latest.timestamp)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {label}
                  </dt>
                  <dd className="font-semibold leading-snug text-slateink-800">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div
            className="rounded-xl border p-3.5"
            style={{ background: verdictTone.bg, borderColor: verdictTone.border }}
          >
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: verdictTone.text }}>
              <VerdictIcon className="h-3.5 w-3.5" />
              Décision de crédit intrants par tranches
            </p>
            <p className="mt-1.5 text-sm font-extrabold uppercase leading-snug" style={{ color: verdictTone.text }}>
              {verdict.badge}
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-extrabold leading-none" style={{ color: verdictTone.text }}>
                {score.total}
              </span>
              <span className="pb-1 text-xs font-bold text-slate-500">/100 · {verdict.rate}</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-600">{verdict.rationale}</p>
            {score.fraudDetected && (
              <p className="mt-1.5 rounded-md bg-white/70 px-2 py-1 text-[10px] font-bold text-[#b91c1c]">
                ANOMALIE DE COHÉRENCE SONDE / SATELLITE — composante intégrité à 0/20.
              </p>
            )}
            {dataset.frozen && (
              <p className="mt-1.5 rounded-md bg-white/70 px-2 py-1 text-[10px] font-bold text-[#b91c1c]">
                Dossier gelé : scellé physique rompu (accéléromètre).
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={Droplets}
          label="Régularité hydrique"
          value={`${score.water}/35`}
          detail={`${score.waterDaysInRange} jours sur ${score.totalDays} dans la plage 20–35 %`}
        />
        <Stat
          icon={Leaf}
          label="Vigueur végétative"
          value={`${score.vegetation}/25`}
          detail={`NDVI Sentinel-2 ${formatNumber(latest.ndvi, 2)} observé`}
        />
        <Stat
          icon={Sprout}
          label="Santé du sol"
          value={`${score.soil}/20`}
          detail={`EC ${formatNumber(latest.ec, 2)} dS/m · pH ${formatNumber(latest.ph, 2)}`}
        />
        <Stat
          icon={Fingerprint}
          label="Intégrité de la preuve"
          value={`${score.integrity}/20`}
          detail={`Écart sonde / radar ${formatNumber(score.satelliteGap)} pts · ${dataset.records.length} blocs SHA-256`}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_1fr]">
        <section className="card p-4 lg:p-5">
          <h3 className="text-lg leading-tight text-slateink-800">
            Performances agronomiques vérifiées (90 jours)
          </h3>
          <div className="mt-2.5 overflow-hidden rounded-xl border border-[#e2e8f0]">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-[#e2e8f0]">
                {[
                  ['Jours avec humidité 15 cm dans [20 % – 35 %]', `${score.waterDaysInRange} / ${score.totalDays}`],
                  ['Cumul pluviométrique enregistré', `${formatNumber(totalRain)} mm`],
                  ['Cumul irrigation déclarée', `${formatNumber(totalIrrigation)} mm`],
                  ['NDVI actuel vs référence de la culture', `${formatNumber(latest.ndvi, 2)} / ${formatNumber(latest.ndviReference, 2)}`],
                  ['Réserve profonde (35 cm)', `${formatNumber(latest.moisture35)} %`],
                  ['Écart moyen sonde / satellite', `${formatNumber(score.satelliteGap)} pts (tolérance 15)`],
                  ['Signalements phytosanitaires', `${dataset.pests.length} consigné(s)`],
                  ['Empreinte de chaîne validée', score.chainValid ? 'Oui' : 'Non'],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td className="px-3 py-1.5 text-slate-600">{label}</td>
                    <td className="px-3 py-1.5 text-right font-bold text-slateink-800">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
            Recoupement multi-sources : chaque mesure est confrontée aux séries Sentinel-1 (humidité
            de surface) et Sentinel-2 (indice végétatif) avant d’être intégrée au dossier.
          </p>
        </section>

        <section className="card p-4 lg:p-5">
          <h3 className="text-lg leading-tight text-slateink-800">
            Assurance climatique indicielle
          </h3>
          <div
            className="mt-2.5 rounded-xl border p-3"
            style={{ background: assuranceTone.bg, borderColor: assuranceTone.border }}
          >
            <p className="flex items-center gap-1.5 text-xs font-extrabold" style={{ color: assuranceTone.text }}>
              <AssurIcon className="h-4 w-4" />
              {assurance.label}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{assurance.detail}</p>
          </div>

          <h4 className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Déclencheurs paramétrés
          </h4>
          <ul className="mt-1.5 space-y-1.5 text-[11px] text-slate-600">
            <li className="flex justify-between gap-2 rounded-lg bg-[#f8fafc] px-2.5 py-1.5">
              <span>Sécheresse — humidité 15 cm</span>
              <span className="font-bold text-slateink-800">seuil 17 % sur 48 h</span>
            </li>
            <li className="flex justify-between gap-2 rounded-lg bg-[#f8fafc] px-2.5 py-1.5">
              <span>Excès d’eau — radar Sentinel-1</span>
              <span className="font-bold text-slateink-800">seuil 36 % sur 24 h</span>
            </li>
            <li className="flex justify-between gap-2 rounded-lg bg-[#f8fafc] px-2.5 py-1.5">
              <span>Indemnisation estimée</span>
              <span className="font-bold text-slateink-800">
                {formatFCFA(parcel.areaHa * 120_000, true)}
              </span>
            </li>
          </ul>
        </section>
      </div>

      <section className="card p-4 lg:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2 text-xs text-slate-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" />
            <p className="max-w-2xl leading-relaxed">
              Dossier consulté avec le consentement explicite de l’exploitant, conformément à la loi
              sénégalaise n° 2008-12 (CDP). L’export PDF scellé reprend l’empreinte SHA-256 globale de
              la chaîne de mesures et la validation croisée Sentinel-1/2.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={onDownload} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Télécharger le Dossier de Crédit Score Vert (PDF)
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={onExportBundle}
              disabled={exporting}
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Archive vérifiable (.zip)
            </button>
          </div>
        </div>
        <p className="mt-2 border-t border-[#eef3f8] pt-2 text-[11px] leading-relaxed text-slate-500">
          L’archive contient le PDF, <span className="font-mono">preuve.json</span> (relevés signés,
          empreinte de chaîne, empreinte du PDF) et{' '}
          <span className="font-mono">verifier.html</span> : la banque ouvre cette page hors ligne,
          dépose les deux fichiers et le navigateur recalcule toute la chaîne SHA-256, sans serveur ni
          service tiers.
        </p>
      </section>
    </div>
  );
}
