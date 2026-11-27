import type { ParcelConfig, ParcelDocument } from '../types/agritwin';
import {
  DocumentLimitError,
  MAX_FILE_BYTES,
  MAX_STORAGE_BYTES,
  detectMime,
  megabytes,
} from '../utils/documentLimits';

const PARCELS_KEY = 'agritwin.parcels.v1';
const DB_NAME = 'agritwin-verification';
const STORE = 'documents';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => {
      const db = request.result;
      if (db.objectStoreNames.contains(STORE)) {
        resolve(db);
        return;
      }
      // Base existante mais magasin absent (migration interrompue) : on incrémente la version.
      db.close();
      const retry = indexedDB.open(DB_NAME, db.version + 1);
      retry.onupgradeneeded = () => {
        const upgraded = retry.result;
        if (!upgraded.objectStoreNames.contains(STORE)) upgraded.createObjectStore(STORE);
      };
      retry.onsuccess = () => resolve(retry.result);
      retry.onerror = () => reject(retry.error);
    };
    request.onerror = () => reject(request.error);
  });
}

/** Une transaction, une action, fermeture garantie de la base. */
function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        let result: T | undefined;
        const request = action(tx.objectStore(STORE));
        request.onsuccess = () => {
          result = request.result;
        };
        const fail = () => {
          db.close();
          reject(tx.error);
        };
        tx.oncomplete = () => {
          db.close();
          resolve(result);
        };
        tx.onerror = fail;
        tx.onabort = fail;
      }),
  );
}

/** Espace réellement occupé par les pièces, tous dossiers confondus. */
export function storageUsage(): Promise<{ files: number; bytes: number }> {
  return openDb().then(
    (db) =>
      new Promise<{ files: number; bytes: number }>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).openCursor();
        let files = 0;
        let bytes = 0;
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            db.close();
            resolve({ files, bytes });
            return;
          }
          const blob = cursor.value as Blob;
          files += 1;
          bytes += blob.size;
          cursor.continue();
        };
        const fail = () => {
          db.close();
          reject(tx.error);
        };
        request.onerror = fail;
        tx.onabort = fail;
      }),
  );
}

/**
 * Seul point d'écriture des pièces : taille, type réel et quota global de
 * l'appareil sont vérifiés ici, quel que soit l'appelant.
 */
export async function putDocumentFile(id: string, file: Blob): Promise<void> {
  if (file.size <= 0) throw new DocumentLimitError('fichier vide');
  if (file.size > MAX_FILE_BYTES) {
    throw new DocumentLimitError(`chaque pièce est limitée à ${megabytes(MAX_FILE_BYTES)}`);
  }
  if (!(await detectMime(file))) {
    throw new DocumentLimitError('format non pris en charge (PDF, JPG ou PNG)');
  }

  const [usage, existing] = [await storageUsage(), await getDocumentFile(id)];
  const used = usage.bytes - (existing?.size ?? 0);
  if (used + file.size > MAX_STORAGE_BYTES) {
    throw new DocumentLimitError(
      `espace de stockage local plein (${megabytes(MAX_STORAGE_BYTES)} pour toutes les pièces)`,
    );
  }
  await transact('readwrite', (store) => store.put(file, id));
}

export async function getDocumentFile(id: string): Promise<Blob | null> {
  const blob = await transact<Blob>('readonly', (store) => store.get(id) as IDBRequest<Blob>);
  return blob ?? null;
}

export async function deleteDocumentFile(id: string): Promise<void> {
  await transact('readwrite', (store) => store.delete(id));
}

/**
 * Supprime les fichiers déposés qu'aucune déclaration ne référence plus
 * (brouillon abandonné, pièce retirée, dossier effacé).
 */
export async function purgeOrphanDocuments(keepIds: readonly string[]): Promise<number> {
  const keep = new Set(keepIds);
  const db = await openDb();
  try {
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const request = store.getAllKeys();
      let removed = 0;
      request.onsuccess = () => {
        for (const key of request.result) {
          if (keep.has(String(key))) continue;
          store.delete(key);
          removed += 1;
        }
      };
      tx.oncomplete = () => resolve(removed);
      const fail = () => reject(tx.error);
      tx.onerror = fail;
      tx.onabort = fail;
    });
  } finally {
    db.close();
  }
}

/** Efface toutes les déclarations locales et les pièces déposées. */
export async function clearParcelStorage(): Promise<void> {
  window.localStorage.removeItem(PARCELS_KEY);
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    const done = () => resolve();
    request.onsuccess = done;
    request.onerror = done;
    request.onblocked = done;
  });
}

export function loadParcelConfigs(): ParcelConfig[] {
  try {
    const raw = window.localStorage.getItem(PARCELS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ParcelConfig[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveParcelConfigs(configs: ParcelConfig[]) {
  window.localStorage.setItem(PARCELS_KEY, JSON.stringify(configs));
}

export function upsertParcelConfig(config: ParcelConfig): ParcelConfig[] {
  const existing = loadParcelConfigs();
  const next = existing.some((item) => item.id === config.id)
    ? existing.map((item) => (item.id === config.id ? config : item))
    : [...existing, config];
  saveParcelConfigs(next);
  return next;
}

export function documentLabel(kind: ParcelDocument['kind']): string {
  switch (kind) {
    case 'identite':
      return "Pièce d'identité";
    case 'foncier':
      return 'Titre foncier ou bail';
    case 'exploitation':
      return "Justificatif d'exploitation";
    default:
      return 'Photo de la parcelle';
  }
}
