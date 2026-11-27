import type { AccountRole } from '../types/agritwin';

export interface Account {
  id: string;
  name: string;
  phone: string;
  role: AccountRole;
  organisation: string;
  createdAt: string;
  salt: string;
  passwordHash: string;
}

const ACCOUNTS_KEY = 'agritwin.accounts.v1';
const SESSION_KEY = 'agritwin.session.v1';

const DEMO_ACCOUNTS: {
  id: string;
  name: string;
  phone: string;
  role: AccountRole;
  organisation: string;
  password: string;
}[] = [
  {
    id: 'acc-demo-exploitant',
    name: 'Moussa Diop',
    phone: '770000001',
    role: 'exploitant',
    organisation: 'Coopérative Baol · Bambey',
    password: 'demo1234',
  },
  {
    id: 'acc-demo-financeur',
    name: 'Awa Sow',
    phone: '770000002',
    role: 'financeur',
    organisation: 'IMF Baobab · Dakar',
    password: 'demo1234',
  },
  {
    id: 'acc-demo-verificateur',
    name: 'Ibrahima Fall',
    phone: '770000003',
    role: 'verificateur',
    organisation: 'Équipe conformité AgriTwin',
    password: 'demo1234',
  },
];

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readAccounts(): Account[] {
  if (typeof window === 'undefined') return [];
  return safeParse<Account[]>(window.localStorage.getItem(ACCOUNTS_KEY), []);
}

function writeAccounts(accounts: Account[]) {
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function makeSalt(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

/** Crée les trois comptes de démonstration au premier lancement. */
export async function ensureAccounts(): Promise<Account[]> {
  const existing = readAccounts();
  if (existing.length > 0) return existing;
  const seeded: Account[] = [];
  for (const demo of DEMO_ACCOUNTS) {
    const salt = makeSalt();
    seeded.push({
      id: demo.id,
      name: demo.name,
      phone: demo.phone,
      role: demo.role,
      organisation: demo.organisation,
      createdAt: new Date().toISOString(),
      salt,
      passwordHash: await hashPassword(demo.password, salt),
    });
  }
  writeAccounts(seeded);
  return seeded;
}

/** Efface comptes et session, puis recrée les trois comptes de démonstration. */
export async function resetAccounts(): Promise<Account[]> {
  window.localStorage.removeItem(ACCOUNTS_KEY);
  window.localStorage.removeItem(SESSION_KEY);
  return ensureAccounts();
}

export function normalisePhone(value: string): string {
  return value.replace(/[^\d]/g, '').replace(/^221/, '');
}

export async function signUp(input: {
  name: string;
  phone: string;
  password: string;
  role: AccountRole;
  organisation: string;
}): Promise<{ account?: Account; error?: string }> {
  const accounts = await ensureAccounts();
  const phone = normalisePhone(input.phone);
  if (input.name.trim().length < 2) return { error: 'Renseignez votre nom complet.' };
  if (phone.length < 9) return { error: 'Numéro de téléphone invalide (9 chiffres attendus).' };
  if (input.password.length < 6) return { error: 'Le mot de passe doit contenir au moins 6 caractères.' };
  if (accounts.some((account) => account.phone === phone)) {
    return { error: 'Un compte existe déjà avec ce numéro.' };
  }
  const salt = makeSalt();
  const account: Account = {
    id: `acc-${Date.now().toString(36)}`,
    name: input.name.trim(),
    phone,
    role: input.role,
    organisation: input.organisation.trim() || 'Exploitation individuelle',
    createdAt: new Date().toISOString(),
    salt,
    passwordHash: await hashPassword(input.password, salt),
  };
  writeAccounts([...accounts, account]);
  return { account };
}

export async function signIn(phone: string, password: string): Promise<{ account?: Account; error?: string }> {
  const accounts = await ensureAccounts();
  const target = accounts.find((account) => account.phone === normalisePhone(phone));
  if (!target) return { error: 'Aucun compte ne correspond à ce numéro.' };
  const hash = await hashPassword(password, target.salt);
  if (hash !== target.passwordHash) return { error: 'Mot de passe incorrect.' };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({ accountId: target.id, at: Date.now() }));
  return { account: target };
}

export function restoreSession(accounts: Account[]): Account | null {
  const session = safeParse<{ accountId?: string } | null>(window.localStorage.getItem(SESSION_KEY), null);
  if (!session?.accountId) return null;
  return accounts.find((account) => account.id === session.accountId) ?? null;
}

export function persistSession(account: Account) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({ accountId: account.id, at: Date.now() }));
}

export function signOut() {
  window.localStorage.removeItem(SESSION_KEY);
}

export const DEMO_LOGINS = DEMO_ACCOUNTS.map(({ role, name, phone, organisation, password }) => ({
  role,
  name,
  phone,
  organisation,
  password,
}));
