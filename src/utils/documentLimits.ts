import type { DocumentKind, ParcelDocument } from '../types/agritwin';

/** Règles des pièces justificatives : une seule source pour l'UI et le stockage. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 4;
export const MAX_DOSSIER_BYTES = 25 * 1024 * 1024;
/** Espace total occupé par les pièces de tous les dossiers de cet appareil. */
export const MAX_STORAGE_BYTES = 60 * 1024 * 1024;

export type AllowedMime = 'application/pdf' | 'image/jpeg' | 'image/png';
export const ALLOWED_MIME: readonly AllowedMime[] = ['application/pdf', 'image/jpeg', 'image/png'];

export class DocumentLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentLimitError';
  }
}

export function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

/** Fenêtre inspectée pour retrouver la signature PDF. */
export const PDF_SIGNATURE_WINDOW_BYTES = 1024;

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46]; // %PDF

/**
 * Cherche `%PDF` n'importe où dans les premiers octets : certains PDF valides
 * sont précédés d'octets parasites (BOM, préambule de passerelle, en-tête de
 * générateur) et restent ouvrables par les lecteurs.
 */
function hasPdfSignature(head: Uint8Array): boolean {
  const lastOffset = head.length - PDF_SIGNATURE.length;
  for (let offset = 0; offset <= lastOffset; offset += 1) {
    if (PDF_SIGNATURE.every((byte, index) => head[offset + index] === byte)) return true;
  }
  return false;
}

/**
 * Type réel déduit de la signature binaire. `file.type` et l'extension sont
 * déclaratifs : un MIME vide ou falsifié ne doit pas suffire à passer.
 */
export async function detectMime(blob: Blob): Promise<AllowedMime | null> {
  const head = new Uint8Array(
    await blob.slice(0, PDF_SIGNATURE_WINDOW_BYTES).arrayBuffer(),
  );
  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => head[index] === byte);
  // PNG et JPEG sont stricts : leur signature doit ouvrir le fichier.
  if (startsWith(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (startsWith(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (hasPdfSignature(head)) return 'application/pdf';
  return null;
}

/** Contrôle d'un fichier : taille, type réel et nature attendue pour la pièce. */
export async function inspectFile(
  file: File,
  kind: DocumentKind,
): Promise<{ mime: AllowedMime } | { problem: string }> {
  if (file.size === 0) return { problem: 'fichier vide' };
  if (file.size > MAX_FILE_BYTES) return { problem: `dépasse ${megabytes(MAX_FILE_BYTES)}` };
  const mime = await detectMime(file);
  if (!mime) return { problem: 'format non pris en charge (PDF, JPG ou PNG)' };
  if (kind === 'photo' && mime === 'application/pdf') {
    return { problem: 'une photo doit être un JPG ou un PNG' };
  }
  return { mime };
}

/**
 * Contrôle du dossier complet, appliqué à l'enregistrement : une déclaration
 * dont l'état aurait été fabriqué hors de l'interface ne peut pas être sauvée.
 */
export function documentsProblem(documents: ParcelDocument[]): string | null {
  if (documents.filter((document) => document.kind === 'photo').length > MAX_PHOTOS) {
    return `${MAX_PHOTOS} photos maximum.`;
  }
  const total = documents.reduce((sum, document) => sum + document.size, 0);
  if (total > MAX_DOSSIER_BYTES) return `Le dossier dépasse ${megabytes(MAX_DOSSIER_BYTES)}.`;
  if (documents.some((document) => document.size <= 0 || document.size > MAX_FILE_BYTES)) {
    return `Chaque pièce doit peser moins de ${megabytes(MAX_FILE_BYTES)}.`;
  }
  if (documents.some((document) => !ALLOWED_MIME.includes(document.mime as AllowedMime))) {
    return 'Format de pièce non autorisé (PDF, JPG ou PNG).';
  }
  if (documents.some((document) => document.kind === 'photo' && document.mime === 'application/pdf')) {
    return 'Une photo doit être un JPG ou un PNG.';
  }
  return null;
}
