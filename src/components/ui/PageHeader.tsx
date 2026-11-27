import type { ReactNode } from 'react';

/**
 * En-tête de page commun à toutes les vues : même panneau, même filet
 * supérieur, mêmes actions alignées. Les pages qui n'ont pas de badges
 * n'affichent simplement rien à droite.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  badges,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="relative flex flex-wrap items-end justify-between gap-3 overflow-hidden rounded-[16px] border border-[#e6edf4] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_38px_-30px_rgba(15,23,42,0.3)] transition-shadow duration-300 hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_24px_44px_-28px_rgba(15,23,42,0.34)] sm:px-5 sm:py-5">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1 font-serif text-xl leading-tight text-slateink-800 sm:text-2xl lg:text-3xl">
          {title}
        </h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-500">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {badges}
        {actions}
      </div>
    </div>
  );
}
