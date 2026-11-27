import { useEffect, useState, type ReactNode } from 'react';
import Glyph, { type GlyphName } from '../ui/Glyph';
import type { Account } from '../../auth/accounts';
import type { Parcel } from '../../types/agritwin';

export interface NavLeaf {
  key: string;
  label: string;
  glyph: GlyphName;
  hint: string;
}

export interface NavSection {
  key: string;
  label: string;
  glyph: GlyphName;
  hint: string;
  items: NavLeaf[];
}

interface AppShellProps {
  account: Account;
  sections: NavSection[];
  activeKey: string;
  onNavigate: (key: string) => void;
  parcels: Parcel[];
  selectedParcelId?: string;
  onSelectParcel: (id: string) => void;
  score?: number;
  simulationActive: boolean;
  integrityOk: boolean;
  onOpenSimulator?: () => void;
  onOpenDemo?: () => void;
  onSignOut: () => void;
  children: ReactNode;
}

const ROLE_LABEL: Record<Account['role'], string> = {
  exploitant: 'Exploitant',
  financeur: 'Financeur',
  verificateur: 'Conformité',
};

const ROLE_DETAIL: Record<Account['role'], string> = {
  exploitant: 'Espace exploitation',
  financeur: 'Espace crédit',
  verificateur: 'Back-office AgriTwin',
};

function initialsOf(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function AppShell({
  account,
  sections,
  activeKey,
  onNavigate,
  parcels,
  selectedParcelId,
  onSelectParcel,
  score,
  simulationActive,
  integrityOk,
  onOpenSimulator,
  onOpenDemo,
  onSignOut,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [manuallyOpen, setManuallyOpen] = useState<string[]>([]);

  const activeSection = sections.find((section) =>
    section.items.some((item) => item.key === activeKey),
  );
  const activeLeaf = activeSection?.items.find((item) => item.key === activeKey);

  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [activeKey]);

  useEffect(() => {
    if (!drawerOpen && !menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, menuOpen]);

  const scoreTone =
    score === undefined
      ? ''
      : score >= 75
        ? 'border-[#bbf7d0] bg-[#f0fdf4] text-forest-700'
        : score >= 50
          ? 'border-[#fcd34d] bg-[#fffbeb] text-[#b45309]'
          : 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]';

  const toggleSection = (key: string) =>
    setManuallyOpen((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );

  const go = (key: string) => {
    onNavigate(key);
    setDrawerOpen(false);
  };

  /**
   * Sélecteur de parcelle partagé par la barre (≥ sm) et par la rangée mobile.
   * Sur mobile il occupe toute la largeur et passe en 16 px pour empêcher le
   * zoom automatique de Safari iOS au focus.
   */
  const renderParcelPicker = (variant: 'bar' | 'sheet') =>
    parcels.length === 0 ? null : (
      <label
        className={`relative flex h-9 min-w-0 items-center gap-2 rounded-[10px] border border-[#e6edf4] bg-white pl-2.5 pr-2 transition-all duration-200 hover:-translate-y-px hover:border-[#c3d2e2] hover:shadow-[0_8px_18px_-14px_rgba(15,23,42,0.5)] focus-within:border-forest-500 focus-within:ring-4 focus-within:ring-forest-500/10 ${
          variant === 'sheet' ? 'w-full' : ''
        }`}
      >
        <Glyph name="parcel" className="h-4 w-4 shrink-0 text-forest-600" />
        <select
          value={selectedParcelId}
          onChange={(event) => onSelectParcel(event.target.value)}
          aria-label="Sélectionner la parcelle"
          className={`min-w-0 flex-1 appearance-none truncate bg-transparent py-1.5 pr-5 font-semibold text-slateink-800 outline-none ${
            variant === 'sheet'
              ? 'text-[16px] leading-none'
              : 'max-w-[150px] text-[12px] sm:text-[13px] xl:max-w-[220px]'
          }`}
        >
          {parcels.map((parcel) => (
            <option key={parcel.id} value={parcel.id}>
              {parcel.shortName} · {parcel.areaHa.toFixed(1).replace('.', ',')} ha
            </option>
          ))}
        </select>
        <Glyph
          name="chevronDown"
          className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400"
        />
      </label>
    );

  const renderNav = (variant: 'rail' | 'drawer') => (
    <nav aria-label="Navigation principale" className="flex flex-col gap-0.5">
      {sections.map((section) => {
        const sectionActive = section.key === activeSection?.key;
        const expanded = sectionActive || manuallyOpen.includes(section.key);
        const hasChildren = section.items.length > 1;

        return (
          <div key={section.key} className="relative">
            <button
              type="button"
              onClick={() => {
                if (hasChildren) {
                  toggleSection(section.key);
                } else {
                  go(section.items[0].key);
                }
              }}
              aria-expanded={hasChildren ? expanded : undefined}
              aria-current={sectionActive ? 'true' : undefined}
              className={`group relative flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-all duration-200 ${
                sectionActive
                  ? 'bg-white/[0.09] text-white ring-1 ring-inset ring-white/[0.06]'
                  : 'text-white/60 hover:translate-x-[2px] hover:bg-white/[0.055] hover:text-white'
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-[#4ade80] transition-all duration-200 ${
                  sectionActive ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <Glyph
                name={section.glyph}
                className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 ${
                  sectionActive ? 'text-[#86efac]' : 'text-white/45 group-hover:text-white/75'
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold leading-tight">
                  {section.label}
                </span>
                {variant === 'drawer' && (
                  <span className="mt-0.5 block truncate text-[10.5px] leading-tight text-white/40">
                    {activeLeaf && sectionActive ? activeLeaf.hint : section.hint}
                  </span>
                )}
              </span>
              {hasChildren && (
                <Glyph
                  name="chevronDown"
                  className={`h-3.5 w-3.5 shrink-0 text-white/40 transition-transform duration-200 ${
                    expanded ? 'rotate-180' : ''
                  }`}
                />
              )}
            </button>

            {hasChildren && (
              <div
                className={`grid transition-all duration-300 ease-smooth ${
                  expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <ul className="mb-1 ml-[19px] mt-1 space-y-0.5 border-l border-white/10 pl-2">
                    {section.items.map((item) => {
                      const active = item.key === activeKey;
                      return (
                        <li key={item.key}>
                          <button
                            type="button"
                            onClick={() => go(item.key)}
                            aria-current={active ? 'page' : undefined}
                            className={`flex w-full items-center gap-2 rounded-[9px] px-2 py-1.5 text-left text-[12px] transition-all duration-150 ${
                              active
                                ? 'bg-white/[0.07] font-semibold text-white'
                                : 'text-white/50 hover:translate-x-[1px] hover:bg-white/[0.04] hover:text-white/85'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`h-1 w-1 rounded-full transition-colors ${
                                active ? 'bg-[#4ade80]' : 'bg-white/25'
                              }`}
                            />
                            <span className="truncate">{item.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  const renderAccount = (variant: 'rail' | 'drawer') => (
    <div
      className={`rounded-[12px] border border-white/10 bg-white/[0.045] p-2 ${
        variant === 'drawer' ? 'mt-4' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#4ade80]/15 text-[11px] font-bold text-[#bbf7d0]">
          {initialsOf(account.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold leading-tight text-white">
            {account.name}
          </p>
          <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.1em] text-white/40">
            {ROLE_LABEL[account.role]}
          </p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          title="Se déconnecter"
          aria-label="Se déconnecter"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Glyph name="logout" className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.08] pt-2 text-[10px]">
        <span className="truncate text-white/40">{ROLE_DETAIL[account.role]}</span>
        <span
          className={`inline-flex items-center gap-1 font-semibold ${
            integrityOk ? 'text-[#86efac]' : 'text-[#fca5a5]'
          }`}
        >
          <Glyph name={integrityOk ? 'shieldCheck' : 'shieldAlert'} className="h-3 w-3" />
          {integrityOk ? 'Chaîne intègre' : 'Anomalie'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-[1100] hidden w-[258px] flex-col overflow-y-auto bg-forest-900 px-2.5 py-3 lg:flex scroll-thin-dark">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(120%_80%_at_20%_0%,rgba(74,222,128,0.16),transparent_65%)]"
        />
        <div className="relative flex items-center gap-2.5 px-1.5 pb-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-white/95 shadow-[0_2px_10px_rgba(0,0,0,0.25)]">
            <img
              src="./agritwin-logo.webp"
              alt="Emblème AgriTwin"
              className="h-7 w-7 object-contain"
            />
          </span>
          <div className="min-w-0">
            <p className="font-serif text-[18px] leading-none text-white">AgriTwin</p>
            <p className="mt-1 truncate text-[9.5px] uppercase tracking-[0.16em] text-white/40">
              Jumeau numérique
            </p>
          </div>
        </div>

        <div className="relative my-1.5 h-px bg-white/[0.08]" />
        <p className="relative px-2 pb-1 pt-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/30">
          {ROLE_DETAIL[account.role]}
        </p>
        <div className="relative">{renderNav('rail')}</div>

        <div className="relative mt-auto space-y-2 pt-4">
          {onOpenDemo && (
            <button
              type="button"
              onClick={onOpenDemo}
              className="flex w-full items-center gap-2 rounded-[10px] border border-[#4ade80]/25 bg-[#4ade80]/10 px-2.5 py-2 text-[12px] font-semibold text-[#bbf7d0] transition hover:border-[#4ade80]/45 hover:bg-[#4ade80]/15"
            >
              <Glyph name="play" className="h-3.5 w-3.5" />
              Démo guidée
              <Glyph name="arrowRight" className="ml-auto h-3.5 w-3.5 opacity-60" />
            </button>
          )}
          {renderAccount('rail')}
        </div>
      </aside>

      <div className="lg:pl-[258px]">
        <header className="sticky top-0 z-[900] border-b border-[#e6edf4] bg-white/85 backdrop-blur-md shadow-[0_10px_28px_-28px_rgba(15,23,42,0.5)] supports-[backdrop-filter]:bg-white/70">
          <div className="px-3 sm:px-5 lg:px-7">
          <div className="flex h-[58px] items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Ouvrir la navigation"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-[#e6edf4] bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-200 hover:-translate-y-px hover:border-[#c3d2e2] hover:text-slateink-800 hover:shadow-[0_8px_18px_-14px_rgba(15,23,42,0.5)] lg:hidden"
            >
              <Glyph name="menu" className="h-[18px] w-[18px]" />
            </button>

            <div className="flex items-center gap-2 lg:hidden">
              <img
                src="./agritwin-logo.webp"
                alt="AgriTwin"
                className="h-7 w-7 object-contain"
              />
              <span className="hidden font-serif text-[16px] leading-none text-slateink-800 min-[400px]:inline">
                AgriTwin
              </span>
            </div>

            <div className="ml-auto flex min-w-0 items-center gap-1.5">
              <div className="hidden min-w-0 sm:block">{renderParcelPicker('bar')}</div>
              {score !== undefined && (
                <span
                  className={`chip h-9 shrink-0 rounded-[10px] px-2.5 ${scoreTone}`}
                  title="Score Vert de la parcelle sélectionnée"
                >
                  <Glyph name="sprout" className="h-3.5 w-3.5" />
                  <span className="sm:hidden">{score}</span>
                  <span className="hidden sm:inline">Score {score}</span>
                  <span className="hidden text-slate-400 sm:inline">/100</span>
                </span>
              )}
              {simulationActive && (
                <span className="chip hidden border-[#fcd34d] bg-[#fffbeb] text-[#b45309] xl:inline-flex">
                  Simulation
                </span>
              )}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((value) => !value)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="flex h-9 items-center gap-2 rounded-[10px] border border-[#e6edf4] bg-white py-0 pl-1 pr-2 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-200 hover:-translate-y-px hover:border-[#c3d2e2] hover:shadow-[0_10px_22px_-16px_rgba(15,23,42,0.55)]"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-forest-700 text-[11px] font-bold text-white">
                    {initialsOf(account.name)}
                  </span>
                  <span className="hidden min-w-0 lg:block">
                    <span className="block max-w-[140px] truncate text-[12px] font-semibold leading-tight text-slateink-800">
                      {account.name}
                    </span>
                    <span className="block text-[9.5px] uppercase tracking-[0.08em] text-slate-500">
                      {ROLE_LABEL[account.role]}
                    </span>
                  </span>
                  <Glyph name="chevronDown" className="h-3.5 w-3.5 text-slate-400" />
                </button>

                {menuOpen && (
                  <>
                    <button
                      type="button"
                      aria-hidden="true"
                      tabIndex={-1}
                      className="fixed inset-0 z-[1000] cursor-default"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div
                      role="menu"
                      className="absolute right-0 top-[calc(100%+8px)] z-[1001] w-[268px] animate-pop overflow-hidden rounded-[14px] border border-[#e6edf4] bg-white shadow-lift"
                    >
                      <div className="border-b border-[#eef3f8] bg-gradient-to-b from-white to-[#f8fafc] px-3.5 py-3">
                        <p className="text-[13px] font-semibold text-slateink-800">{account.name}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          {account.organisation}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-slate-400">
                          +221 {account.phone}
                        </p>
                      </div>
                      <ul className="py-1 text-[11px] text-slate-500">
                        <li className="flex items-center justify-between px-3.5 py-2">
                          <span>Chaîne de mesures</span>
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              integrityOk ? 'text-forest-700' : 'text-[#b91c1c]'
                            }`}
                          >
                            <Glyph
                              name={integrityOk ? 'shieldCheck' : 'shieldAlert'}
                              className="h-3.5 w-3.5"
                            />
                            {integrityOk ? 'Intègre' : 'Anomalie'}
                          </span>
                        </li>
                        <li className="flex items-center justify-between px-3.5 py-2">
                          <span>Rôle</span>
                          <span className="font-semibold text-slateink-800">
                            {ROLE_LABEL[account.role]}
                          </span>
                        </li>
                      </ul>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={onSignOut}
                        className="flex w-full items-center gap-2 border-t border-[#eef3f8] px-3.5 py-2.5 text-[12px] font-semibold text-[#b91c1c] transition hover:bg-[#fef2f2]"
                      >
                        <Glyph name="logout" className="h-4 w-4" />
                        Se déconnecter
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {parcels.length > 0 && (
            <div className="pb-2 sm:hidden">{renderParcelPicker('sheet')}</div>
          )}
          </div>
        </header>

        {children}
      </div>

      {/* Outil de démonstration : discret, hors navigation, ne prend pas de place dans la mise en page. */}
      {onOpenSimulator && (
        <button
          type="button"
          onClick={onOpenSimulator}
          aria-label="Ouvrir le simulateur IoT (banc de démonstration)"
          title="Banc de démonstration — simulateur IoT"
          className="group fixed bottom-4 right-4 z-[950] inline-flex items-center gap-1.5 rounded-full border border-[#dbe4ee] bg-white/95 p-3 text-slate-500 shadow-card backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-forest-400 hover:text-forest-700 hover:shadow-lift sm:px-3 sm:py-2"
        >
          <span className="relative grid place-items-center">
            <Glyph name="sensor" className="h-4 w-4" />
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-[#4ade80] ring-2 ring-white"
            />
          </span>
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.08em] sm:inline">
            Démo IoT
          </span>
        </button>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-[1200] lg:hidden">
          <button
            type="button"
            aria-label="Fermer la navigation"
            className="absolute inset-0 bg-[#04120a]/55 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[286px] max-w-[86vw] flex-col overflow-y-auto rounded-r-[18px] bg-forest-900 px-2.5 py-3 shadow-[8px_0_40px_rgba(4,18,10,0.45)] animate-rise scroll-thin-dark">
            <div className="flex items-center justify-between px-1.5 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-[10px] bg-white/95">
                  <img
                    src="./agritwin-logo.webp"
                    alt="Emblème AgriTwin"
                    className="h-7 w-7 object-contain"
                  />
                </span>
                <div>
                  <p className="font-serif text-[18px] leading-none text-white">AgriTwin</p>
                  <p className="mt-1 text-[9.5px] uppercase tracking-[0.16em] text-white/40">
                    Jumeau numérique
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Fermer"
                className="grid h-8 w-8 place-items-center rounded-[9px] text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <Glyph name="close" className="h-4 w-4" />
              </button>
            </div>
            <p className="px-2 pb-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/30">
              {ROLE_DETAIL[account.role]}
            </p>
            {renderNav('drawer')}
            <div className="mt-auto space-y-2">
              {onOpenDemo && (
                <button
                  type="button"
                  onClick={onOpenDemo}
                  className="flex w-full items-center gap-2 rounded-[10px] border border-[#4ade80]/25 bg-[#4ade80]/10 px-2.5 py-2 text-[12px] font-semibold text-[#bbf7d0] transition hover:border-[#4ade80]/45 hover:bg-[#4ade80]/15"
                >
                  <Glyph name="play" className="h-3.5 w-3.5" />
                  Démo guidée
                  <Glyph name="arrowRight" className="ml-auto h-3.5 w-3.5 opacity-60" />
                </button>
              )}
              {renderAccount('drawer')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
