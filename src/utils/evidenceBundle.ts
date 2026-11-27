import type {
  CreditVerdict,
  GreenScoreResult,
  ParcelDataset,
  ParcelVerification,
} from '../types/agritwin';
import { GENESIS_HASH, verifyChain } from './cryptoChain';

/** Archive autoportante : PDF scellé + preuve JSON + vérificateur statique. */
export interface EvidenceInput {
  dataset: ParcelDataset;
  score: GreenScoreResult;
  verdict: CreditVerdict;
  assurance: { label: string; detail: string };
  pdf: { filename: string; bytes: ArrayBuffer };
  verification?: ParcelVerification | null;
  verifierHtml: string;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const FORMAT = 'agritwin-dossier/1';
const SCORE_VERSION = 'green-score/1';
const CANONICAL_VERSION = 'agritwin-canonical/1';

const encoder = new TextEncoder();

async function sha256Bytes(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/* ---------- ZIP « stored » : aucune dépendance, aucune compression ---------- */

let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c >>> 0;
    }
  }
  return crcTable;
}

function crc32(data: Uint8Array): number {
  const table = getCrcTable();
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    c = table[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosStamp(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function zipStore(entries: ZipEntry[]): Uint8Array {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  const stamp = dosStamp(new Date());
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);

    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true); // noms en UTF-8
    localView.setUint16(8, 0, true); // méthode : stored
    localView.setUint16(10, stamp.time, true);
    localView.setUint16(12, stamp.date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, entry.data.length, true);
    localView.setUint32(22, entry.data.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, stamp.time, true);
    centralView.setUint16(14, stamp.date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, entry.data.length, true);
    centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);

    localChunks.push(local, entry.data);
    centralChunks.push(central);
    offset += local.length + entry.data.length;
  }

  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const output = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const chunk of [...localChunks, ...centralChunks, end]) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}

/* ---------- Contenu du dossier ---------- */

function reference(parcelId: string, issuedAt: Date): string {
  const month = String(issuedAt.getMonth() + 1).padStart(2, '0');
  const day = String(issuedAt.getDate()).padStart(2, '0');
  return `AT-${parcelId}-${issuedAt.getFullYear()}-${month}${day}`;
}

function readme(referenceId: string): string {
  return [
    `AgriTwin — dossier de crédit vérifiable ${referenceId}`,
    '',
    'Contenu de l’archive :',
    '  • dossier-credit.pdf  Dossier de crédit remis à l’institution financière.',
    '  • preuve.json         Relevés signés, empreinte de chaîne, score et empreinte du PDF.',
    '  • verifier.html       Page de vérification autonome (aucun réseau, aucun serveur).',
    '',
    'Comment vérifier :',
    '  1. Extraire l’archive, puis ouvrir verifier.html dans un navigateur (double-clic).',
    '  2. Déposer preuve.json, et dossier-credit.pdf pour contrôler aussi le PDF.',
    '  3. La page recalcule la chaîne SHA-256, l’empreinte globale, le Score Vert',
    '     et l’empreinte du PDF, puis affiche chaque contrôle.',
    '',
    'Portée : la chaîne SHA-256 prouve la cohérence interne et l’absence d’altération',
    'depuis la scellée. Elle ne prouve ni l’identité de l’émetteur, ni une date certaine,',
    'ni la véracité des mesures physiques. Ce dossier n’a pas de valeur légale.',
  ].join('\n');
}

export async function buildEvidenceBundle(input: EvidenceInput): Promise<{
  filename: string;
  reference: string;
  zip: Uint8Array;
  proof: Record<string, unknown>;
}> {
  const { dataset, score, verdict, assurance, pdf, verification, verifierHtml } = input;
  const { parcel, records } = dataset;
  const issuedAt = new Date();
  const referenceId = reference(parcel.id, issuedAt);
  const chain = await verifyChain(records);
  const pdfHash = await sha256Bytes(pdf.bytes);
  const first = records[0];
  const latest = records[records.length - 1];

  const proof = {
    format: FORMAT,
    reference: referenceId,
    genereLe: issuedAt.toISOString(),
    application: {
      nom: 'AgriTwin',
      version: '1.0',
      moteurScore: SCORE_VERSION,
      canonicalisation: CANONICAL_VERSION,
      algorithme: 'SHA-256',
    },
    dossier: {
      parcelle: {
        id: parcel.id,
        nom: parcel.name,
        titulaire: parcel.owner,
        role: parcel.ownerRole,
        culture: parcel.crop.name,
        variete: parcel.crop.variety,
        surfaceHa: parcel.areaHa,
        centre: parcel.center,
        boitier: parcel.kitSerial,
        campagne: {
          premierReleve: first?.timestamp ?? null,
          dernierReleve: latest?.timestamp ?? null,
          blocs: records.length,
        },
      },
      verification: verification ?? { statut: 'non_renseigne' },
      score: { ...score },
      verdict: { ...verdict },
      assurance,
      consentementPartage: dataset.consent,
      simulation: dataset.simulationActive,
    },
    chaine: {
      algorithme: 'SHA-256',
      genesis: GENESIS_HASH,
      blocs: records.length,
      valide: chain.valid,
      empreinteGlobale: chain.globalHash,
      ruptureAu: chain.brokenAt ?? null,
    },
    releves: records,
    fichiers: [
      {
        nom: pdf.filename,
        role: 'dossier-pdf',
        sha256: pdfHash,
        octets: pdf.bytes.byteLength,
      },
      {
        nom: 'preuve.json',
        role: 'preuve',
        note: 'Ce fichier est la preuve elle-même : son empreinte ne peut pas y être inscrite.',
      },
      {
        nom: 'verifier.html',
        role: 'verificateur',
        note: 'Page autonome fournie avec l’archive, sans dépendance externe.',
      },
    ],
    avertissements: [
      'Les séries de mesures de ce démonstrateur sont générées localement, sans capteur physique ni téléchargement satellitaire.',
      'La chaîne SHA-256 est recalculable par quiconque : elle prouve la cohérence, pas l’identité de l’émetteur.',
      'Le dossier n’a aucune valeur légale et ne remplace ni expertise ni horodatage qualifié.',
    ],
  };

  const zip = zipStore([
    { name: 'dossier-credit.pdf', data: new Uint8Array(pdf.bytes) },
    { name: 'preuve.json', data: encoder.encode(JSON.stringify(proof, null, 2)) },
    { name: 'verifier.html', data: encoder.encode(verifierHtml) },
    { name: 'LISEZ-MOI.txt', data: encoder.encode(readme(referenceId)) },
  ]);

  return {
    filename: `AgriTwin_Dossier_${parcel.id}_${issuedAt
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '')}.zip`,
    reference: referenceId,
    zip,
    proof,
  };
}

function saveBytes(filename: string, bytes: Uint8Array, mime: string): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const url = URL.createObjectURL(new Blob([copy.buffer], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function exportEvidenceBundle(input: EvidenceInput): Promise<{
  filename: string;
  reference: string;
}> {
  const bundle = await buildEvidenceBundle(input);
  saveBytes(bundle.filename, bundle.zip, 'application/zip');
  return { filename: bundle.filename, reference: bundle.reference };
}
