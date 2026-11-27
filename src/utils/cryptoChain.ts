import type { TelemetryRecord } from '../types/agritwin';

export const GENESIS_HASH = 'GENESIS-AGRITWIN-BMB';

/** Serialisation canonique et déterministe d'un relevé (ce qui est signé). */
export function canonicalPayload(record: TelemetryRecord): string {
  return [
    record.id,
    record.timestamp,
    record.deviceId,
    record.dayIndex,
    record.moisture15.toFixed(2),
    record.moisture35.toFixed(2),
    record.soilTemp.toFixed(2),
    record.airTemp.toFixed(2),
    record.airHumidity.toFixed(2),
    record.rainfall.toFixed(2),
    record.irrigation.toFixed(2),
    record.ec.toFixed(3),
    record.ph.toFixed(2),
    record.battery.toFixed(0),
    record.sealOk ? '1' : '0',
    record.accelerometerMotion ? '1' : '0',
    record.rssi.toFixed(0),
    record.ndvi.toFixed(4),
    record.sentinel1Humidity.toFixed(2),
    record.source,
  ].join('|');
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function signOne(record: TelemetryRecord, prevHash: string): Promise<TelemetryRecord> {
  const hash = await sha256Hex(`${prevHash}::${canonicalPayload(record)}`);
  return { ...record, prevHash, hash };
}

/** Recalcule la chaîne complète, du bloc génésis au dernier relevé. */
export async function signRecords(records: TelemetryRecord[]): Promise<TelemetryRecord[]> {
  const signed: TelemetryRecord[] = [];
  let prevHash = GENESIS_HASH;
  for (const record of records) {
    const next = await signOne(record, prevHash);
    signed.push(next);
    prevHash = next.hash as string;
  }
  return signed;
}

/** Ajoute un relevé en le chaînant au dernier bloc signé. */
export async function signAppend(
  records: TelemetryRecord[],
  record: TelemetryRecord,
): Promise<TelemetryRecord[]> {
  const prevHash = records.length > 0 ? (records[records.length - 1].hash ?? GENESIS_HASH) : GENESIS_HASH;
  const signed = await signOne(record, prevHash);
  return [...records, signed];
}

export interface ChainVerification {
  valid: boolean;
  checked: number;
  total: number;
  brokenAt?: string;
  globalHash: string;
}

/**
 * Vérifie chaque bloc : l'empreinte stockée doit être égale au recalcul
 * SHA-256( hash précédent || payload ), et le chaînage doit être continu.
 */
export async function verifyChain(records: TelemetryRecord[]): Promise<ChainVerification> {
  let prevHash = GENESIS_HASH;
  let brokenAt: string | undefined;
  let checked = 0;

  for (const record of records) {
    const expected = await sha256Hex(`${prevHash}::${canonicalPayload(record)}`);
    const chainLinkOk = (record.prevHash ?? '') === prevHash;
    if (!chainLinkOk || expected !== record.hash) {
      brokenAt = record.timestamp;
      break;
    }
    prevHash = expected;
    checked += 1;
  }

  const globalHash = await sha256Hex(records.map((r) => r.hash ?? 'unsigned').join(''));
  return {
    valid: brokenAt === undefined && checked === records.length && records.length > 0,
    checked,
    total: records.length,
    brokenAt,
    globalHash,
  };
}

export function shortHash(hash: string | undefined, length = 8): string {
  if (!hash) return '—';
  return hash.slice(0, length);
}
