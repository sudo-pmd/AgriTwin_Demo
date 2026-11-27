import { useState } from 'react';
import Glyph from '../ui/Glyph';
import { DEMO_LOGINS, signIn, signUp, type Account } from '../../auth/accounts';
import type { AccountRole } from '../../types/agritwin';

interface AuthScreenProps {
  onAuthenticated: (account: Account) => void;
  onStartDemo?: () => void;
}

const ROLE_LABEL: Record<AccountRole, string> = {
  exploitant: 'Exploitant / coopérative',
  financeur: 'Institution financière',
  verificateur: 'Conformité AgriTwin',
};

const ROLE_SHORT: Record<AccountRole, string> = {
  exploitant: 'Exploitant',
  financeur: 'Financeur',
  verificateur: 'Conformité',
};

export default function AuthScreen({ onAuthenticated, onStartDemo }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [role, setRole] = useState<AccountRole>('exploitant');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<{ account?: Account; error?: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.account) onAuthenticated(result.account);
    } catch {
      setError(
        'Connexion impossible : vérifiez que votre navigateur autorise le stockage local et Web Crypto.',
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'login') {
      void run(() => signIn(phone, password));
    } else {
      void run(() => signUp({ name, phone, password, role, organisation }));
    }
  };

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next);
    setError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="rounded-[22px] border border-[#e6edf4] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_26px_50px_-26px_rgba(15,23,42,0.28)] transition-shadow duration-300 hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_34px_62px_-28px_rgba(15,23,42,0.32)] sm:p-8">
          <div className="flex items-center gap-3">
            <img
              src="./agritwin-logo.webp"
              alt="Emblème AgriTwin"
              className="h-11 w-11 rounded-xl border border-forest-100 bg-forest-50 object-contain p-1 shadow-[0_8px_16px_-10px_rgba(20,83,45,0.65)]"
            />
            <div>
              <p className="font-serif text-xl leading-none text-slateink-800">AgriTwin</p>
              <p className="mt-1 text-[11.5px] font-medium text-slate-400">
                Jumeau numérique &amp; Score Vert
              </p>
            </div>
          </div>

          <div className="mt-6 flex rounded-xl bg-[#f1f5f9] p-1 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]">
            {(
              [
                ['login', 'Connexion'],
                ['signup', 'Créer un compte'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => switchMode(key)}
                aria-pressed={mode === key}
                className={`flex-1 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold transition-all duration-200 ${
                  mode === key
                    ? 'bg-white text-forest-800 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_6px_12px_-8px_rgba(15,23,42,0.35)]'
                    : 'text-slate-500 hover:bg-white/60 hover:text-slateink-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4">
            {mode === 'signup' && (
              <>
                <label className="block" htmlFor="signup-name">
                  <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">
                    Nom complet
                  </span>
                  <input
                    id="signup-name"
                    className="w-full rounded-xl border border-[#dbe4ee] bg-white px-3 py-2.5 text-[14.5px] text-slateink-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-[#c3d2e2] focus:border-forest-500 focus:ring-4 focus:ring-forest-500/10"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Aminata Seck"
                    autoComplete="name"
                  />
                </label>

                <label className="block" htmlFor="signup-org">
                  <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">
                    Exploitation ou organisation
                  </span>
                  <input
                    id="signup-org"
                    className="w-full rounded-xl border border-[#dbe4ee] bg-white px-3 py-2.5 text-[14.5px] text-slateink-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-[#c3d2e2] focus:border-forest-500 focus:ring-4 focus:ring-forest-500/10"
                    value={organisation}
                    onChange={(event) => setOrganisation(event.target.value)}
                    placeholder="Coopérative de Mboro"
                    autoComplete="organization"
                  />
                </label>

                <fieldset>
                  <legend className="mb-1.5 block text-[12px] font-semibold text-slate-600">
                    Type de compte
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {(['exploitant', 'financeur'] as AccountRole[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRole(value)}
                        aria-pressed={role === value}
                        className={`rounded-xl border px-3 py-2 text-left text-[11.5px] font-semibold leading-snug transition-all duration-200 ${
                          role === value
                            ? 'border-forest-500 bg-forest-50 text-forest-800 shadow-[0_6px_14px_-10px_rgba(20,83,45,0.7)]'
                            : 'border-[#dbe4ee] bg-white text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:-translate-y-px hover:border-[#c3d2e2] hover:text-slateink-800 hover:shadow-[0_8px_16px_-12px_rgba(15,23,42,0.4)]'
                        }`}
                      >
                        {ROLE_LABEL[value]}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            <label className="block" htmlFor="auth-phone">
              <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">
                Téléphone
              </span>
              <div className="flex items-center rounded-xl border border-[#dbe4ee] bg-white shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-[#c3d2e2] focus-within:border-forest-500 focus-within:ring-4 focus-within:ring-forest-500/10">
                <span className="pl-3 text-[13px] font-medium text-slate-400">+221</span>
                <input
                  id="auth-phone"
                  className="w-full bg-transparent px-2.5 py-2.5 text-[14.5px] text-slateink-800 outline-none placeholder:text-slate-400"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="77 000 00 01"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
            </label>

            <label className="block" htmlFor="auth-password">
              <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">
                Mot de passe
              </span>
              <input
                id="auth-password"
                type="password"
                className="w-full rounded-xl border border-[#dbe4ee] bg-white px-3 py-2.5 text-[14.5px] text-slateink-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-[#c3d2e2] focus:border-forest-500 focus:ring-4 focus:ring-forest-500/10"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === 'login' ? '••••••••' : '6 caractères minimum'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] font-medium leading-snug text-[#b91c1c] shadow-[0_6px_14px_-12px_rgba(185,28,28,0.6)]"
              >
                <Glyph name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest-800 px-4 py-3 text-[13.5px] font-semibold text-white shadow-[0_10px_20px_-12px_rgba(10,42,23,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-forest-700 hover:shadow-[0_16px_26px_-14px_rgba(10,42,23,0.85)] active:translate-y-0 active:shadow-[0_4px_10px_-8px_rgba(10,42,23,0.8)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {busy ? 'Vérification…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
              <Glyph name="arrowRight" className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-4 text-center text-[12px] text-slate-500">
            {mode === 'login' ? 'Pas encore de compte ?' : 'Déjà inscrit ?'}{' '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
              className="font-semibold text-forest-700 underline decoration-forest-200 decoration-2 underline-offset-2 transition-colors hover:text-forest-600 hover:decoration-forest-500"
            >
              {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
            </button>
          </p>
        </div>

        <div className="mt-4 rounded-[18px] border border-[#e6edf4] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_18px_36px_-26px_rgba(15,23,42,0.28)] transition-shadow duration-300 hover:shadow-[0_2px_4px_rgba(15,23,42,0.04),0_26px_46px_-26px_rgba(15,23,42,0.3)]">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Démonstration
            </p>
            <p className="font-mono text-[10.5px] text-slate-400">demo1234</p>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {DEMO_LOGINS.map((demo) => (
              <button
                key={demo.phone}
                type="button"
                disabled={busy}
                onClick={() => void run(() => signIn(demo.phone, demo.password))}
                className="rounded-xl border border-[#e6edf4] bg-white px-2 py-2 text-[11.5px] font-semibold text-slateink-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-200 hover:-translate-y-px hover:border-forest-200 hover:bg-forest-50 hover:text-forest-800 hover:shadow-[0_10px_18px_-14px_rgba(20,83,45,0.7)] active:translate-y-0 disabled:opacity-50"
              >
                {ROLE_SHORT[demo.role]}
              </button>
            ))}
          </div>
          {onStartDemo && (
            <button
              type="button"
              onClick={onStartDemo}
              disabled={busy}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-[#dbe4ee] bg-white px-3 py-2 text-[12px] font-semibold text-slateink-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-200 hover:-translate-y-px hover:border-forest-300 hover:bg-forest-50 hover:text-forest-800 hover:shadow-[0_10px_20px_-14px_rgba(20,83,45,0.6)] active:translate-y-0"
            >
              <Glyph name="play" className="h-3 w-3" />
              Démo guidée
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
