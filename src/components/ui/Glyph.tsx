import type { SVGProps } from 'react';

/**
 * Jeu d'icônes maison, tracé sur une grille de 24 px, épaisseur 1,6.
 * Objectif : un langage graphique unique et sobre, loin des bibliothèques
 * génériques utilisées par défaut dans les interfaces générées.
 */
const PATHS = {
  parcel: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  map: ['M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z', 'M9 4v14', 'M15 6v14'],
  sensor: ['M12 12h.01', 'M8.2 8.2a5.4 5.4 0 0 0 0 7.6', 'M15.8 8.2a5.4 5.4 0 0 1 0 7.6', 'M5.3 5.3a9.5 9.5 0 0 0 0 13.4', 'M18.7 5.3a9.5 9.5 0 0 1 0 13.4'],
  chart: ['M4 20h16', 'M7 20v-6', 'M12 20V8', 'M17 20v-9'],
  leaf: ['M20 4C11 4 5 9 5 16c0 2 1 3 3 3 7 0 12-6 12-15Z', 'M5 19c3.5-5 7-8 11-10'],
  sprout: ['M12 20v-7', 'M12 13c0-3.3-2.4-5.5-5.5-5.5C6.5 10.8 8.9 13 12 13Z', 'M12 14c0-3 2.2-5 5-5 0 3-2.2 5-5 5Z'],
  shield: ['M12 3l7 3v6c0 4.3-2.9 7.4-7 9-4.1-1.6-7-4.7-7-9V6l7-3Z'],
  shieldCheck: ['M12 3l7 3v6c0 4.3-2.9 7.4-7 9-4.1-1.6-7-4.7-7-9V6l7-3Z', 'M9 12l2 2 4-4'],
  shieldAlert: ['M12 3l7 3v6c0 4.3-2.9 7.4-7 9-4.1-1.6-7-4.7-7-9V6l7-3Z', 'M12 8.5v4', 'M12 15.5v.01'],
  alert: ['M12 4l9 16H3L12 4Z', 'M12 10v4', 'M12 17v.01'],
  check: ['M4 12.5l5 5L20 6.5'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  chevronDown: ['M6 9l6 6 6-6'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  arrowRight: ['M4 12h15', 'M13 6l6 6-6 6'],
  download: ['M12 4v10', 'M7 10l5 5 5-5', 'M4 19h16'],
  lock: ['M4 10h16v10H4z', 'M8 10V7a4 4 0 0 1 8 0v3'],
  unlock: ['M4 10h16v10H4z', 'M8 10V7a4 4 0 0 1 7-2.7'],
  plus: ['M12 5v14', 'M5 12h14'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  building: ['M4 3h16v18H4z', 'M9 7h2', 'M13 7h2', 'M9 11h2', 'M13 11h2', 'M9 15h2', 'M13 15h2', 'M10 21v-3h4v3'],
  file: ['M6 3h8l4 4v14H6V3Z', 'M14 3v4h4', 'M9 12h6', 'M9 16h6'],
  droplet: ['M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3Z'],
  layers: ['M12 3l9 5-9 5-9-5 9-5Z', 'M3 13l9 5 9-5'],
  play: ['M7 4l13 8-13 8V4Z'],
  stop: ['M6 6h12v12H6z'],
  speaker: ['M4 9h3l4-3v12l-4-3H4V9Z', 'M15 9a4 4 0 0 1 0 6', 'M17.5 6.5a8 8 0 0 1 0 11'],
  calendar: ['M3 5h18v16H3z', 'M3 10h18', 'M8 3v4', 'M16 3v4'],
  pencil: ['M4 20l4-1 10-10-3-3L5 16l-1 4Z', 'M14 6l3 3'],
  upload: ['M12 16V5', 'M7 10l5-5 5 5', 'M4 20h16'],
  logout: ['M10 5H4v14h6', 'M14 8l4 4-4 4', 'M18 12H9'],
  info: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z', 'M12 11v5', 'M12 8v.01'],
  refresh: ['M20 12a8 8 0 1 1-2.3-5.7', 'M20 4v4h-4'],
  thermometer: ['M12 4a2 2 0 0 1 2 2v7.5a4 4 0 1 1-4 0V6a2 2 0 0 1 2-2Z', 'M12 9v6'],
  battery: ['M2 7h17v10H2z', 'M22 10v4', 'M4 9h7v6H4z'],
  signal: ['M4 20v-4', 'M9 20v-8', 'M14 20V8', 'M19 20V5'],
  waves: ['M3 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0'],
  activity: ['M3 12h4l2-6 4 12 2-6h6'],
  camera: ['M3 8h4l1.5-2h7L17 8h4v12H3V8Z', 'M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z'],
  eye: ['M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z', 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z'],
  arrowUpRight: ['M7 17L17 7', 'M9 7h8v8'],
  arrowDownRight: ['M7 7l10 10', 'M17 9v8H9'],
  flask: ['M9 3h6', 'M10 3v5l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 17l-5-9V3', 'M7.5 14h9'],
  message: ['M4 5h16v11H9l-5 4V5Z', 'M8 9h8', 'M8 12h5'],
} as const;

export type GlyphName = keyof typeof PATHS;

const FILLED = new Set<GlyphName>(['play', 'stop']);

interface GlyphProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'ref'> {
  name: GlyphName;
  size?: number;
  strokeWidth?: number;
}

export default function Glyph({
  name,
  size = 16,
  strokeWidth = 1.6,
  className,
  ...rest
}: GlyphProps) {
  const filled = FILLED.has(name);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
