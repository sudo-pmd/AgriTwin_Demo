import { useEffect, useState } from 'react';
import Glyph from '../ui/Glyph';

interface GuidedDemoProps {
  index: number;
  total: number;
  title: string;
  description: string;
  cta: string;
  hint?: string;
  busy: boolean;
  canBack: boolean;
  onNext: () => void;
  onBack: () => void;
  onReset: () => void;
  onExit: () => void;
}

export default function GuidedDemo({
  index,
  total,
  title,
  description,
  cta,
  hint,
  busy,
  canBack,
  onNext,
  onBack,
  onReset,
  onExit,
}: GuidedDemoProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  const progress = Math.round(((index + 1) / total) * 100);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed bottom-3 right-3 z-[1400] inline-flex items-center gap-2 rounded-full border border-[#bbf7d0] bg-white px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-forest-700 shadow-lift animate-rise"
      >
        <span className="grid h-4 w-4 place-items-center rounded-full bg-forest-700 text-[9px] text-white">
          {index + 1}
        </span>
        Démo guidée
        <Glyph name="chevronDown" className="h-3.5 w-3.5 rotate-180" />
      </button>
    );
  }

  return (
    <aside
      aria-label="Démo guidée AgriTwin"
      className="fixed inset-x-3 bottom-3 z-[1400] overflow-hidden rounded-[16px] border border-[#e6edf4] bg-white shadow-lift animate-rise sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[392px]"
    >
      <div className="h-[3px] bg-[#eef3f8]">
        <div
          className="h-full bg-forest-600 transition-all duration-500 ease-smooth"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-[#eef3f8] bg-gradient-to-b from-white to-[#fbfdfc] px-3.5 py-2">
        <span className="inline-flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.13em] text-forest-700">
          <Glyph name="play" className="h-3 w-3" />
          Démo guidée · {index + 1}/{total}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Réduire le panneau de démonstration"
            className="grid h-7 w-7 place-items-center rounded-[9px] text-slate-400 transition hover:bg-[#f1f5f9] hover:text-slate-600"
          >
            <Glyph name="chevronDown" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onExit}
            aria-label="Quitter la démonstration"
            className="grid h-7 w-7 place-items-center rounded-[9px] text-slate-400 transition hover:bg-[#fef2f2] hover:text-[#b91c1c]"
          >
            <Glyph name="close" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-3.5 py-3" aria-live="polite">
        <h2 className="font-serif text-[17px] leading-snug text-slateink-800">{title}</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{description}</p>
        {hint && (
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-slate-500">
            <Glyph name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            {hint}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-[#eef3f8] bg-[#fbfdfc] px-3 py-2.5">
        <button
          type="button"
          className="btn-primary flex-1 px-3 text-[12.5px]"
          onClick={onNext}
          disabled={busy}
        >
          {busy ? 'Traitement…' : cta}
          <Glyph name="arrowRight" className="h-4 w-4" />
        </button>
        {canBack && (
          <button
            type="button"
            className="btn-secondary px-2.5"
            onClick={onBack}
            disabled={busy}
            aria-label="Revenir à l’étape précédente"
          >
            <Glyph name="arrowRight" className="h-4 w-4 rotate-180" />
          </button>
        )}
        <button
          type="button"
          className="btn-ghost px-2"
          onClick={onReset}
          disabled={busy}
          title="Réinitialiser et relancer la démonstration"
          aria-label="Réinitialiser et relancer la démonstration"
        >
          <Glyph name="refresh" className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
