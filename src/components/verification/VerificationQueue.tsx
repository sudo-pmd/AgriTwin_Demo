import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Polygon, TileLayer } from 'react-leaflet';
import {
  SAT_ATTRIBUTION,
  SAT_MAX_NATIVE_ZOOM,
  SAT_MAX_ZOOM,
  SAT_TILES,
} from '../../utils/mapTiles';
import Glyph from '../ui/Glyph';
import PageHeader from '../ui/PageHeader';
import type { Account } from '../../auth/accounts';
import type { ParcelConfig, ParcelDocument, VerificationStatus } from '../../types/agritwin';
import { CROP_CATALOG } from '../../data/seedData';
import { getDocumentFile } from '../../storage/parcels';
import { formatNumber } from '../../utils/format';


interface VerificationQueueProps {
  account: Account;
  configs: ParcelConfig[];
  /** Renvoie faux si le dossier a disparu ou n'est plus soumis. */
  onDecision: (id: string, status: VerificationStatus, note: string) => boolean;
}

function DocumentRow({ document }: { document: ParcelDocument }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;
    let created: string | null = null;
    void getDocumentFile(document.id)
      .then((blob) => {
        if (!active) return;
        if (!blob) {
          setMissing(true);
          return;
        }
        created = URL.createObjectURL(blob);
        setUrl(created);
      })
      .catch(() => {
        if (active) setMissing(true);
      });
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [document.id]);

  return (
    <li className="flex items-center gap-3 border-b border-[#eef3f8] px-3 py-2 last:border-b-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#eef3f8] bg-[#fbfdfc] text-slate-500">
        <Glyph name={document.mime.startsWith('image/') ? 'camera' : 'file'} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-slateink-800">{document.label}</p>
        <p className="truncate font-mono text-[11px] text-slate-500">{document.fileName}</p>
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary shrink-0 px-2 py-1 text-[11px]"
        >
          <Glyph name="eye" className="h-3.5 w-3.5" />
          Ouvrir
        </a>
      ) : (
        <span className="shrink-0 text-[11px] text-slate-400">
          {missing ? 'Fichier absent' : 'Chargement…'}
        </span>
      )}
    </li>
  );
}

export default function VerificationQueue({ account, configs, onDecision }: VerificationQueueProps) {
  const pending = configs.filter((config) => config.verification.status === 'soumis');
  const processed = configs.filter((config) =>
    ['verifie', 'rejete'].includes(config.verification.status),
  );
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const list = tab === 'pending' ? pending : processed;
  const [selectedId, setSelectedId] = useState<string | null>(pending[0]?.id ?? null);
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const selected = useMemo(
    () => list.find((config) => config.id === selectedId) ?? list[0] ?? null,
    [list, selectedId],
  );

  useEffect(() => {
    setNote(selected?.verification.note ?? '');
    setFeedback(null);
  }, [selected?.id, selected?.verification.note]);

  const decide = (status: VerificationStatus, value: string) => {
    if (!selected) return;
    if (!onDecision(selected.id, status, value)) {
      setFeedback(
        'Ce dossier n’est plus disponible : la file a été mise à jour. Sélectionnez un autre dossier.',
      );
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={`Conformité · ${account.organisation}`}
        title="Vérification des parcelles"
        description="Contrôlez l’identité, le titre foncier et la géométrie déclarée avant de certifier la parcelle et d’ouvrir son Score Vert."
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[340px_1fr]">
        <section className="card self-start">
          <div className="grid grid-cols-2 border-b border-[#dde5ee]">
            {(
              [
                ['pending', `À vérifier (${pending.length})`],
                ['done', `Traitées (${processed.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key);
                  setSelectedId(null);
                }}
                className={`px-3 py-2.5 text-[12px] font-semibold ${
                  tab === key
                    ? 'bg-forest-700 text-white'
                    : 'bg-white text-slate-500 hover:bg-[#f8fafc]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12px] text-slate-500">
              Aucun dossier dans cette file.
            </p>
          ) : (
            <ul className="divide-y divide-[#eef3f8]">
              {list.map((config) => (
                <li key={config.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(config.id)}
                    className={`w-full px-3.5 py-3 text-left transition-all duration-200 ${
                      selected?.id === config.id
                        ? 'bg-forest-50/50 shadow-[inset_2px_0_0_#14532d]'
                        : 'hover:bg-[#f7fbf8] hover:shadow-[inset_2px_0_0_#86efac]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] font-semibold text-slateink-800">
                        {config.name}
                      </p>
                      <span className="shrink-0 font-mono text-[10px] text-slate-400">
                        {config.id.slice(-6)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {config.ownerName} · {formatNumber(config.areaHa, 2)} ha ·{' '}
                      {config.documents.length} pièce(s)
                    </p>
                    {config.verification.status === 'soumis' && config.verification.submittedAt && (
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-[#b45309]">
                        Déposé le{' '}
                        {new Date(config.verification.submittedAt).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!selected ? (
          <section className="card grid place-items-center px-6 py-16 text-center">
            <div>
              <Glyph name="shieldCheck" className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-3 font-serif text-lg text-slateink-800">File vide</p>
              <p className="mt-1 text-[12px] text-slate-500">
                Les nouvelles déclarations apparaîtront ici dès leur transmission.
              </p>
            </div>
          </section>
        ) : (
          <section className="card">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#dde5ee] px-4 py-3">
              <div>
                <p className="eyebrow">Dossier {selected.id}</p>
                <h2 className="mt-0.5 font-serif text-xl leading-tight text-slateink-800">
                  {selected.name}
                </h2>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  {selected.ownerName} — {selected.ownerRole} ·{' '}
                  {CROP_CATALOG[selected.cropKey].label}
                </p>
              </div>
              <span className="chip border-[#eef3f8] bg-[#fbfdfc] text-slate-600">
                {selected.verification.status === 'verifie'
                  ? 'Certifiée'
                  : selected.verification.status === 'rejete'
                    ? 'Rejetée'
                    : 'En attente'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 px-4 py-4 xl:grid-cols-[1fr_1fr]">
              <div>
                <dl className="divide-y divide-[#eef3f8] overflow-hidden rounded-xl border border-[#eef3f8]">
                  {[
                    ['Coordonnées', `${selected.centre.lat.toFixed(5)}, ${selected.centre.lng.toFixed(5)}`],
                    ['Surface', `${formatNumber(selected.areaHa, 2)} ha`],
                    ['Sol', selected.soilType],
                    ['Contour', selected.boundary.length >= 3 ? `${selected.boundary.length} sommets` : 'Emprise générée'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 px-3 py-2">
                      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
                      <dd className="text-right font-mono text-[12px] text-slateink-800">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-2 overflow-hidden rounded-xl border border-[#eef3f8]">
                  <MapContainer
                    center={[selected.centre.lat, selected.centre.lng]}
                    zoom={15}
                    scrollWheelZoom={false}
                    className="h-[190px] w-full"
                  >
                    <TileLayer
                      url={SAT_TILES}
                      attribution={SAT_ATTRIBUTION}
                      maxZoom={SAT_MAX_ZOOM}
                      maxNativeZoom={SAT_MAX_NATIVE_ZOOM}
                    />
                    <Polygon
                      positions={
                        selected.boundary.length >= 3
                          ? selected.boundary
                          : [
                              [selected.centre.lat + 0.002, selected.centre.lng - 0.002],
                              [selected.centre.lat + 0.002, selected.centre.lng + 0.002],
                              [selected.centre.lat - 0.002, selected.centre.lng + 0.002],
                              [selected.centre.lat - 0.002, selected.centre.lng - 0.002],
                            ]
                      }
                      pathOptions={{
                        color: '#4ade80',
                        weight: 2,
                        fillColor: '#22c55e',
                        fillOpacity: 0.15,
                      }}
                    />
                  </MapContainer>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Pièces déposées ({selected.documents.length})
                </p>
                <ul className="mt-1.5 overflow-hidden rounded-xl border border-[#eef3f8]">
                  {selected.documents.map((document) => (
                    <DocumentRow key={document.id} document={document} />
                  ))}
                  {selected.documents.length === 0 && (
                    <li className="px-3 py-4 text-[12px] text-slate-500">Aucune pièce déposée.</li>
                  )}
                </ul>

                {selected.verification.status === 'soumis' && (
                  <>
                    <label className="field-label mt-4" htmlFor="review-note">
                      Observation interne
                    </label>
                    <textarea
                      id="review-note"
                      className="field min-h-[74px] resize-y"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Concordance du titre, écart de contour, pièce illisible…"
                    />
                  </>
                )}

                {feedback && (
                  <p
                    role="alert"
                    className="mt-2 border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[11.5px] font-semibold text-[#b91c1c]"
                  >
                    {feedback}
                  </p>
                )}

                {selected.verification.status === 'soumis' ? (
                  <>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => decide('verifie', note)}
                      >
                        <Glyph name="shieldCheck" className="h-4 w-4" />
                        Certifier la parcelle
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-[#b91c1c]"
                        onClick={() => decide('rejete', note || 'Pièces incomplètes.')}
                      >
                        <Glyph name="close" className="h-4 w-4" />
                        Rejeter
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                      La décision est horodatée et signée par {account.name}. Le titulaire est
                      notifié dans son espace et peut corriger son dossier en cas de rejet.
                    </p>
                  </>
                ) : (
                  <div className="mt-2 rounded-[10px] border border-[#eef3f8] bg-[#fbfdfc] px-3 py-2 text-[11.5px] leading-relaxed text-slate-600">
                    <p className="font-semibold text-slateink-800">
                      Dossier{' '}
                      {selected.verification.status === 'verifie'
                        ? 'déjà certifié'
                        : selected.verification.status === 'rejete'
                          ? 'rejeté'
                          : 'encore en brouillon'}
                    </p>
                    <p className="mt-0.5">
                      {selected.verification.reviewedAt
                        ? `Décision du ${new Date(
                            selected.verification.reviewedAt,
                          ).toLocaleDateString('fr-FR')} par ${
                            selected.verification.reviewer ?? 'AgriTwin'
                          }. `
                        : ''}
                      {selected.verification.note
                        ? `Observation : ${selected.verification.note}`
                        : 'Aucune observation.'}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Aucune décision possible tant que le titulaire n’a pas resoumis son dossier.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
