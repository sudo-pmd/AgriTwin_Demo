import { jsPDF } from 'jspdf';
import * as autoTableModule from 'jspdf-autotable';
import type {
  CreditVerdict,
  GreenScoreResult,
  Parcel,
  ParcelDataset,
  YieldProjection,
} from '../types/agritwin';
import { sha256Hex } from './cryptoChain';
import { formatFCFA, formatDate, formatNumber } from './format';

export interface PdfInput {
  parcel: Parcel;
  dataset: ParcelDataset;
  score: GreenScoreResult;
  verdict: CreditVerdict;
  assurance: { label: string; detail: string };
  projection: YieldProjection;
  chainHash: string;
}

const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const GREEN: [number, number, number] = [21, 128, 61];
const NAVY: [number, number, number] = [15, 23, 42];

type AutoTableFn = (doc: jsPDF, options: Record<string, unknown>) => void;

/**
 * jspdf-autotable est distribué sous forme de bundle webpack (CommonJS) :
 * selon le bundler, la fonction peut être le module lui-même, `default`
 * ou `default.default`. On normalise une fois pour toutes.
 */
function resolveAutoTable(moduleValue: unknown): AutoTableFn {
  let candidate: unknown = moduleValue;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof candidate === 'function') return candidate as AutoTableFn;
    if (candidate && typeof candidate === 'object' && 'default' in candidate) {
      candidate = (candidate as { default: unknown }).default;
      continue;
    }
    break;
  }
  if (typeof candidate === 'function') return candidate as AutoTableFn;
  throw new Error('Plugin jspdf-autotable introuvable');
}

let resolvedAutoTable: AutoTableFn | null = null;

function autoTable(doc: jsPDF, options: Record<string, unknown>): void {
  if (!resolvedAutoTable) resolvedAutoTable = resolveAutoTable(autoTableModule);
  resolvedAutoTable(doc, options);
}

const VERDICT_COLORS: Record<
  'green' | 'amber' | 'red',
  { fill: [number, number, number]; line: [number, number, number]; text: [number, number, number] }
> = {
  green: { fill: [240, 253, 244], line: [22, 163, 74], text: [21, 128, 61] },
  amber: { fill: [255, 251, 235], line: [217, 119, 6], text: [180, 83, 9] },
  red: { fill: [254, 242, 242], line: [220, 38, 38], text: [185, 28, 28] },
};

function sectionTitle(doc: jsPDF, index: number, label: string, y: number): number {
  doc.setFillColor(...GREEN);
  doc.roundedRect(14, y, 5.5, 5.5, 1, 1, 'F');
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(`${index}. ${label.toUpperCase()}`, 22, y + 4.2);
  doc.setDrawColor(226, 232, 240);
  doc.line(14, y + 7.5, 196, y + 7.5);
  return y + 12;
}

function paragraph(doc: jsPDF, text: string, y: number, options?: { size?: number; color?: [number, number, number]; bold?: boolean }): number {
  const size = options?.size ?? 9;
  doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...(options?.color ?? MUTED));
  const lines = doc.splitTextToSize(text, 182) as string[];
  doc.text(lines, 14, y);
  return y + lines.length * (size * 0.48) + 2.5;
}

export async function generateCreditPdf(
  input: PdfInput,
  options?: { download?: boolean },
): Promise<{ filename: string; documentHash: string; bytes: ArrayBuffer }> {
  const { parcel, dataset, score, verdict, assurance, projection, chainHash } = input;
  const latest = dataset.records[dataset.records.length - 1];
  const issuedAt = new Date();
  const dossierId = `AT-${parcel.id}-${issuedAt.getFullYear()}-${String(issuedAt.getMonth() + 1).padStart(2, '0')}${String(issuedAt.getDate()).padStart(2, '0')}`;

  const documentHash = await sha256Hex(
    [dossierId, parcel.id, score.total, score.water, score.vegetation, score.soil, score.integrity, latest.timestamp, chainHash, issuedAt.toISOString()].join('|'),
  );

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setProperties({
    title: `Dossier de crédit Score Vert — ${parcel.name}`,
    subject: 'Jumeau numérique agricole et certification financière',
    author: 'AgriTwin',
    keywords: 'AgriTwin, Score Vert, crédit agricole, Sentinel-1, Sentinel-2, SHA-256',
  });

  /* ---------- En-tête institutionnel ---------- */
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setFillColor(...GREEN);
  doc.rect(0, 34, 210, 1.6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.text('AgriTwin', 14, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text('Jumeau numérique de parcelle agricole & plateforme de certification', 14, 21.5);
  doc.text('Dossier de financement rural — Concours AKTIION 2026, École Polytechnique de Thiès', 14, 26.5);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`Émis le ${issuedAt.toLocaleDateString('fr-FR')}`, 196, 15, { align: 'right' });
  doc.setFont('courier', 'normal');
  doc.text(dossierId, 196, 21, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text('Document certifié — usage bancaire', 196, 26.5, { align: 'right' });

  /* ---------- Bloc 2 : identité ---------- */
  let y = 45;
  y = sectionTitle(doc, 2, "Fiche d'identité de l'exploitation", y);

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8.5, cellPadding: 2.2, textColor: INK, lineColor: [226, 232, 240], lineWidth: 0.2 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 48 },
      1: { cellWidth: 43 },
      2: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 48 },
      3: { cellWidth: 43 },
    },
    body: [
      ['Exploitation', parcel.name, 'Identifiant dossier', dossierId],
      ['Propriétaire / gestionnaire', `${parcel.owner}\n${parcel.ownerRole}`, 'Mode de gestion', parcel.mode],
      [
        'Coordonnées GPS',
        parcel.gpsLabel,
        'Surface totale',
        `${formatNumber(parcel.areaHa)} ha`,
      ],
      [
        'Culture',
        `${parcel.crop.name} — ${parcel.crop.variety}`,
        'Type de sol',
        parcel.soilType,
      ],
      [
        'Semis / campagne',
        formatDate(parcel.crop.sowingDate),
        'Boîtier scellé',
        parcel.kitSerial,
      ],
      [
        'Date du dernier relevé',
        formatDate(latest.timestamp),
        'Blocs de télémétrie',
        `${dataset.records.length} relevés signés`,
      ],
      [
        'Consentement CDP',
        dataset.consent ? 'Partage autorisé par l’exploitant' : 'Partage non autorisé',
        'Zones homogènes',
        parcel.zones.map((zone) => zone.id).join(' · '),
      ],
    ],
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  /* ---------- Bloc 3 : Score Vert ---------- */
  y = sectionTitle(doc, 3, 'Score Vert et recommandation', y);

  const blockHeight = 30;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, y, 60, blockHeight, 2, 2, 'FD');
  doc.setTextColor(...GREEN);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('SCORE VERT', 18, y + 6);
  doc.setFontSize(30);
  doc.setTextColor(...INK);
  doc.text(`${score.total}`, 18, y + 19);
  const scoreWidth = doc.getTextWidth(`${score.total}`);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text('/ 100', 18 + scoreWidth + 1.5, y + 19);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GREEN);
  doc.text(`PROFIL ${score.profile}`, 18, y + 26);

  autoTable(doc, {
    startY: y,
    margin: { left: 78, right: 14 },
    theme: 'grid',
    styles: { fontSize: 8.3, cellPadding: 1.9, textColor: INK, lineColor: [226, 232, 240], lineWidth: 0.2 },
    head: [['Critère', 'Points', 'Détail']],
    headStyles: { fillColor: [20, 83, 45], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 44 }, 1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' }, 2: { cellWidth: 58 } },
    body: [
      ['Régularité hydrique', `${score.water} / 35`, `${score.waterDaysInRange} jours sur ${score.totalDays} dans [20–35 %]`],
      ['Vigueur végétative', `${score.vegetation} / 25`, `NDVI ${formatNumber(latest.ndvi, 2)} (Sentinel-2)`],
      ['Santé du sol', `${score.soil} / 20`, `EC ${formatNumber(latest.ec, 2)} dS/m · pH ${formatNumber(latest.ph, 2)}`],
      ['Intégrité de la preuve', `${score.integrity} / 20`, `Écart sonde/radar ${formatNumber(score.satelliteGap)} pts`],
    ],
  });
  const tableEnd = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  y = Math.max(y + blockHeight, tableEnd) + 5;

  const verdictColors = VERDICT_COLORS[verdict.tone];
  doc.setFillColor(...verdictColors.fill);
  doc.setDrawColor(...verdictColors.line);
  doc.roundedRect(14, y, 182, 17, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...verdictColors.text);
  doc.text(`RECOMMANDATION BANCAIRE : ${verdict.badge}`, 18, y + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...MUTED);
  const rationale = doc.splitTextToSize(`${verdict.rationale} ${verdict.rate}.`, 174) as string[];
  doc.text(rationale, 18, y + 11.5);
  y += 17 + Math.max(0, rationale.length - 1) * 3.4 + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(...MUTED);
  doc.text('ASSURANCE CLIMATIQUE INDICIELLE', 14, y);
  y = paragraph(doc, `${assurance.label} — ${assurance.detail}`, y + 4, { size: 8 });

  /* ---------- Bloc 4 : performances ---------- */
  doc.addPage();
  y = 20;
  y = sectionTitle(doc, 4, 'Performances agronomiques et projection économique', y);

  const totalRain = dataset.records.reduce((sum, record) => sum + record.rainfall, 0);
  const totalIrrigation = dataset.records.reduce((sum, record) => sum + record.irrigation, 0);

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8.3, cellPadding: 2, textColor: INK, lineColor: [226, 232, 240], lineWidth: 0.2 },
    head: [['Indicateur vérifié — 90 jours', 'Valeur', 'Source / méthode']],
    headStyles: { fillColor: [20, 83, 45], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 74 }, 1: { cellWidth: 42, fontStyle: 'bold' }, 2: { cellWidth: 66 } },
    body: [
      ['Jours avec humidité 15 cm dans [20 % – 35 %]', `${score.waterDaysInRange} / ${score.totalDays}`, 'Sonde capacitive 15 cm'],
      ['Humidité racinaire au dernier relevé', `${formatNumber(latest.moisture15)} %`, 'Sonde capacitive 15 cm'],
      ['Réserve profonde (35 cm)', `${formatNumber(latest.moisture35)} %`, 'Sonde capacitive 35 cm'],
      ['Cumul pluviométrique', `${formatNumber(totalRain)} mm`, 'Pluviomètre à augets'],
      ['Cumul irrigation déclarée', `${formatNumber(totalIrrigation)} mm`, 'Journal cultural'],
      ['NDVI observé / référence', `${formatNumber(latest.ndvi, 2)} / ${formatNumber(latest.ndviReference, 2)}`, 'Sentinel-2 (10 m)'],
      ['Humidité radar de surface', `${formatNumber(latest.sentinel1Humidity)} %`, 'Sentinel-1 SAR'],
      ['Écart sonde / satellite', `${formatNumber(score.satelliteGap)} pts`, 'Recoupement multi-sources'],
      ['Salinité (EC) et pH', `${formatNumber(latest.ec, 2)} dS/m · ${formatNumber(latest.ph, 2)}`, 'Sonde EC / pH'],
      ['Intégrité cryptographique', score.chainValid ? 'Chaîne valide' : 'Chaîne invalide', `${dataset.records.length} blocs SHA-256`],
    ],
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text('Projection de rendement et marge nette (itinéraire de référence)', 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    theme: 'striped',
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8.3, cellPadding: 2, textColor: INK },
    columnStyles: { 0: { cellWidth: 84 }, 1: { cellWidth: 46, fontStyle: 'bold' }, 2: { cellWidth: 52, fontStyle: 'bold' } },
    head: [['Poste', 'Résultat', 'Unité']],
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    body: [
      ['Rendement estimé', formatNumber(projection.yieldTPerHa, 2), 't / ha'],
      ['Production totale', formatNumber(projection.totalProductionT, 2), 'tonnes'],
      ['Revenu brut', formatFCFA(projection.grossRevenue), 'FCFA'],
      ['Coût total (intrants, eau, base)', formatFCFA(projection.totalCost), 'FCFA'],
      ['Marge nette prévisionnelle', formatFCFA(projection.netMargin), 'FCFA'],
      ['Consommation d’eau', formatNumber(projection.waterM3, 0), 'm³'],
    ],
    bodyStyles: { textColor: INK },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;

  if (y > 232) {
    doc.addPage();
    y = 20;
  }

  /* ---------- Bloc 5 : certificat ---------- */
  y = sectionTitle(doc, 5, "Certificat d'authenticité numérique", y);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, 182, 46, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text('Numéro de série du boîtier scellé', 18, y + 7);
  doc.setFont('courier', 'normal');
  doc.text(parcel.kitSerial, 18, y + 11.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Validation croisée satellite', 18, y + 18.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...MUTED);
  doc.text('Sentinel-1 SAR (humidité de surface) & Sentinel-2 (NDVI) — recalage Copernicus', 18, y + 22.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text('Empreinte globale SHA-256 de la chaîne de mesures', 18, y + 29.5);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(2, 132, 199);
  const chainGroups = (chainHash || 'non disponible').match(/.{1,16}/g) ?? [];
  chainGroups.slice(0, 4).forEach((group, index) => {
    doc.text(group, 18 + (index % 2) * 88, y + 34 + Math.floor(index / 2) * 4);
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text('Empreinte SHA-256 du présent document', 18, y + 42.5);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...GREEN);
  doc.text(documentHash.slice(0, 64), 18 + 62, y + 42.5);

  y += 52;
  y = paragraph(
    doc,
    "Certificat : les relevés présentés ont été horodatés et signés dès le microcontrôleur du boîtier de terrain, puis chaînés en SHA-256 et recoupés avec les observations satellitaires Sentinel-1 et Sentinel-2. Toute altération d'un bloc invalide la chaîne et annule la composante intégrité du Score Vert. Document produit automatiquement par le démonstrateur AgriTwin ; les données historiques sont générées de façon déterministe pour la démonstration du concours.",
    y,
    { size: 7.6 },
  );

  y = paragraph(
    doc,
    `Partage des données : ${dataset.consent ? 'consentement explicite de l’exploitant enregistré' : 'aucun consentement de partage enregistré'} — loi sénégalaise n° 2008-12 relative à la protection des données à caractère personnel (CDP).`,
    y + 1,
    { size: 7.6, color: [180, 83, 9], bold: true },
  );

  /* ---------- Pieds de page ---------- */
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 283, 196, 283);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`AgriTwin · Dossier ${dossierId} · ${parcel.shortName}`, 14, 288);
    doc.text(`Page ${page} / ${pageCount}`, 196, 288, { align: 'right' });
  }

  const filename = `AgriTwin_ScoreVert_${parcel.id}.pdf`;
  const bytes = doc.output('arraybuffer') as ArrayBuffer;
  if (options?.download !== false) doc.save(filename);
  return { filename, documentHash, bytes };
}
