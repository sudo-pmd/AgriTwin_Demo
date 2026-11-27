import type { Account } from '../auth/accounts';
import type {
  AccountRole,
  DocumentKind,
  ParcelConfig,
  ParcelDocument,
} from '../types/agritwin';
import { putDocumentFile } from '../storage/parcels';

export const DEMO_PARCEL_ID = 'PARC-DEMO-NGONE';

export type DemoAction = 'none' | 'create' | 'submit' | 'certify' | 'fraud';

export interface DemoStep {
  title: string;
  description: string;
  cta: string;
  role: AccountRole;
  tab: string;
  action: DemoAction;
  hint?: string;
}

/**
 * Parcours jury : chaque étape force le rôle et la vue, puis déclenche
 * l'action réelle du produit. Aucune recherche dans les menus.
 */
export const DEMO_STEPS: DemoStep[] = [
  {
    title: 'Un dossier de crédit, de la parcelle à la preuve',
    description:
      'Neuf écrans, environ trois minutes : déclaration, contrôle de conformité, surveillance, fraude détectée, audit cryptographique, puis décision bancaire.',
    cta: 'Commencer',
    role: 'exploitant',
    tab: 'map',
    action: 'none',
    hint: 'Les comptes et données locales ont été réinitialisés pour partir d’un état propre.',
  },
  {
    title: '1 · Déclarer la parcelle',
    description:
      'Créez une parcelle géolocalisée avec son contour et trois pièces justificatives, comme le ferait un producteur à Mboro.',
    cta: 'Créer la parcelle de démonstration',
    role: 'exploitant',
    tab: 'parcel',
    action: 'create',
    hint: 'Un spécimen de pièce d’identité, de titre foncier et une photo sont générés localement.',
  },
  {
    title: '2 · Transmettre le dossier',
    description:
      'Le dossier complet part au contrôle AgriTwin. Tant qu’il est en vérification, toute modification le renverrait en brouillon.',
    cta: 'Soumettre à vérification',
    role: 'exploitant',
    tab: 'parcel',
    action: 'submit',
  },
  {
    title: '3 · Certifier la parcelle',
    description:
      'Vous êtes maintenant l’agent de conformité : le contour est recoupé avec l’orthophoto et les pièces sont contrôlées.',
    cta: 'Certifier le dossier',
    role: 'verificateur',
    tab: 'verification',
    action: 'certify',
    hint: 'La décision est horodatée et signée par l’agent ; le Score Vert s’ouvre.',
  },
  {
    title: '4 · Surveiller la parcelle',
    description:
      'Retour côté exploitant : le boîtier scellé alimente le jumeau numérique — humidité, microclimat, NDVI, intégrité de la chaîne.',
    cta: 'Passer à l’incident',
    role: 'exploitant',
    tab: 'monitoring',
    action: 'none',
  },
  {
    title: '5 · Injecter une fraude',
    description:
      'Un relevé incohérent simule une sonde trafiquée : humidité gonflée à 44 % alors que le radar Sentinel-1 mesure 20,7 %.',
    cta: 'Injecter la fraude sonde / satellite',
    role: 'exploitant',
    tab: 'monitoring',
    action: 'fraud',
  },
  {
    title: '6 · Le dossier se gèle',
    description:
      'L’écart sonde / satellite déclenche l’alerte critique, annule la composante intégrité du Score Vert et suspend le décaissement.',
    cta: 'Voir la preuve',
    role: 'exploitant',
    tab: 'alerts',
    action: 'none',
    hint: 'L’exploitant reçoit l’alerte en français et en wolof.',
  },
  {
    title: '7 · Auditer la preuve',
    description:
      'Chaque relevé est signé en SHA-256 et chaîné au précédent : la fraude ne peut pas être effacée, seulement constatée.',
    cta: 'Voir le dossier de crédit',
    role: 'exploitant',
    tab: 'audit',
    action: 'none',
  },
  {
    title: '8 · Décider côté banque',
    description:
      'Le financeur consulte le Score Vert, le motif de suspension et le journal opposable avant tout décaissement.',
    cta: 'Terminer la démo',
    role: 'exploitant',
    tab: 'score',
    action: 'none',
  },
];

const DEMO_CENTRE = { lat: 14.7394, lng: -16.4591 };

const DOC_SOURCES: { kind: DocumentKind; label: string; fileName: string }[] = [
  { kind: 'identite', label: "Pièce d'identité", fileName: 'piece-identite.png' },
  { kind: 'foncier', label: 'Titre foncier ou bail', fileName: 'titre-foncier.png' },
  { kind: 'photo', label: 'Photo de la parcelle', fileName: 'photo-parcelle.png' },
];

/** Spécimen lisible, dessiné dans le navigateur (aucun fichier externe). */
function renderSpecimen(title: string, kind: DocumentKind): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 960;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas indisponible'));
      return;
    }

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 720, 960);
    ctx.strokeStyle = '#dde5ee';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, 672, 912);

    ctx.fillStyle = '#14532d';
    ctx.fillRect(24, 24, 672, 88);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 26px sans-serif';
    ctx.fillText('AgriTwin · spécimen de démonstration', 56, 78);

    ctx.fillStyle = '#0f172a';
    ctx.font = '600 36px Georgia, serif';
    ctx.fillText(title, 56, 196);

    ctx.fillStyle = '#5b6a7d';
    ctx.font = '20px sans-serif';
    const lines = [
      `Type de pièce : ${kind}`,
      'Titulaire : Moussa Diop',
      'Parcelle : Parcelle Ngoné — Mboro',
      'Département : Mbour, région de Thiès',
      `Édité le : ${new Date().toLocaleDateString('fr-FR')}`,
      '',
      'Document fictif généré par AgriTwin pour la démonstration.',
      'Il ne possède aucune valeur légale.',
    ];
    lines.forEach((line, index) => {
      ctx.fillText(line, 56, 264 + index * 38);
    });

    ctx.save();
    ctx.translate(360, 760);
    ctx.rotate(-Math.PI / 7);
    ctx.fillStyle = 'rgba(20, 83, 45, 0.10)';
    ctx.font = 'bold 58px sans-serif';
    ctx.fillText('DÉMONSTRATION', -270, 0);
    ctx.restore();

    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Génération impossible'))),
      'image/png',
    );
  });
}

export async function createDemoParcel(account: Account): Promise<ParcelConfig> {
  const documents: ParcelDocument[] = [];
  for (const source of DOC_SOURCES) {
    const id = `DOC-DEMO-${source.kind.toUpperCase()}`;
    const blob = await renderSpecimen(source.label, source.kind);
    await putDocumentFile(id, blob);
    documents.push({
      id,
      kind: source.kind,
      label: source.label,
      fileName: source.fileName,
      size: blob.size,
      mime: 'image/png',
      uploadedAt: new Date().toISOString(),
      status: 'en_attente',
    });
  }

  const dLat = 0.0007;
  const dLng = 0.00072;

  return {
    id: DEMO_PARCEL_ID,
    accountId: account.id,
    name: 'Parcelle Ngoné — Mboro',
    ownerName: account.name,
    ownerRole: 'Exploitant individuel',
    centre: DEMO_CENTRE,
    areaHa: 2.4,
    boundary: [
      [DEMO_CENTRE.lat + dLat, DEMO_CENTRE.lng - dLng],
      [DEMO_CENTRE.lat + dLat, DEMO_CENTRE.lng + dLng],
      [DEMO_CENTRE.lat - dLat, DEMO_CENTRE.lng + dLng],
      [DEMO_CENTRE.lat - dLat, DEMO_CENTRE.lng - dLng],
    ],
    cropKey: 'oignon',
    soilType: 'Sablo-argileux (Dior)',
    seed: 2026,
    createdAt: new Date().toISOString(),
    documents,
    verification: { status: 'brouillon' },
  };
}
