import { useEffect, useState } from 'react';
import { CheckCircle2, Fingerprint, Loader2, ShieldAlert, ShieldCheck } from '../ui/icons';
import type { TelemetryRecord } from '../../types/agritwin';
import { shortHash, verifyChain, type ChainVerification } from '../../utils/cryptoChain';
import { formatDate, formatNumber } from '../../utils/format';

interface CryptoAuditTableProps {
  records: TelemetryRecord[];
}

export default function CryptoAuditTable({ records }: CryptoAuditTableProps) {
  const [result, setResult] = useState<ChainVerification | null>(null);
  const [running, setRunning] = useState(false);
  const signed = records.every((record) => Boolean(record.hash));
  const rows = records.slice(-10).reverse();

  useEffect(() => {
    setResult(null);
  }, [records]);

  const runVerification = async () => {
    setRunning(true);
    try {
      const verification = await verifyChain(records);
      setResult(verification);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="card p-4 lg:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg leading-tight text-slateink-800">
            Journal d’audit cryptographique
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Chaîne SHA-256 recalculée sur les {records.length} relevés — 10 derniers blocs affichés.
          </p>
        </div>
        <span className="chip bg-[#f8fafc] text-slate-600 ring-1 ring-[#e2e8f0]">
          {records.length} blocs · WebCrypto
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary" onClick={runVerification} disabled={running || !signed}>
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 text-forest-600" />}
          Vérifier l’intégrité de la chaîne cryptographique
        </button>
        {!signed && (
          <span className="text-[11px] font-semibold text-slate-500">
            Signature des blocs en cours…
          </span>
        )}
      </div>

      {result && (
        <div
          className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold ${
            result.valid
              ? 'border-[#bbf7d0] bg-[#f0fdf4] text-forest-700'
              : 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]'
          }`}
        >
          {result.valid ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>
            {result.valid
              ? `Vérification réussie : ${result.checked}/${result.total} blocs authentifiés sans altération.`
              : `Vérification interrompue : rupture de chaîne au bloc du ${
                  result.brokenAt ? formatDate(result.brokenAt) : '—'
                } (${result.checked}/${result.total} blocs valides).`}
          </span>
        </div>
      )}

      <div
        className="scroll-thin mt-3 overflow-x-auto rounded-xl border border-[#e2e8f0]"
        role="region"
        aria-label="Journal d’audit cryptographique, tableau défilable horizontalement"
        tabIndex={0}
      >
        <table className="w-full min-w-[600px] text-xs">
          <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2.5 py-2 text-left font-bold">Horodatage</th>
              <th className="px-2.5 py-2 text-left font-bold">ID Boîtier</th>
              <th className="px-2.5 py-2 text-right font-bold">Humidité 15 cm</th>
              <th className="px-2.5 py-2 text-left font-bold">Hash précédent</th>
              <th className="px-2.5 py-2 text-left font-bold">Hash actuel (SHA-256)</th>
              <th className="px-2.5 py-2 text-right font-bold">Contrôle satellite</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {rows.map((record) => {
              const gap = Math.abs(record.moisture15 - record.sentinel1Humidity);
              const coherent = gap <= 15;
              return (
                <tr
                  key={record.id + record.timestamp}
                  className="transition-colors duration-150 hover:bg-[#f6faf7]"
                >
                  <td className="whitespace-nowrap px-2.5 py-1.5 font-semibold text-slateink-800">
                    {formatDate(record.timestamp)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-[10px] text-slate-500">
                    {record.deviceId}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-semibold text-slateink-800">
                    {formatNumber(record.moisture15)} %
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-[10px] text-slate-500">
                    {shortHash(record.prevHash, 8)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 font-mono text-[10px] text-tech">
                    {shortHash(record.hash, 12)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-right">
                    <span
                      className={`chip ${
                        coherent ? 'bg-[#f0fdf4] text-forest-600' : 'bg-[#fef2f2] text-[#b91c1c]'
                      }`}
                    >
                      {coherent ? `Cohérent · ${formatNumber(gap)} pts` : `Écart ${formatNumber(gap)} pts`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-1 text-[10px] font-semibold text-slate-500 sm:hidden">
        Tableau défilable horizontalement — 6 colonnes · faites glisser vers la gauche.
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold text-slate-500">
        <span>
          Empreinte globale du dossier :{' '}
          <span className="font-mono text-[10px] text-slateink-800">
            {result?.globalHash ? shortHash(result.globalHash, 24) : '—'}
          </span>
        </span>
        <span>Algorithme : SHA-256 · API native window.crypto.subtle</span>
      </div>
    </section>
  );
}
