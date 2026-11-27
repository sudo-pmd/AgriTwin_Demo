import type { CSSProperties } from 'react';
import Glyph, { type GlyphName } from './Glyph';

interface IconProps {
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
  'aria-hidden'?: boolean;
}

function make(name: GlyphName) {
  return function Icon({ className, style, strokeWidth }: IconProps) {
    return <Glyph name={name} className={className} style={style} strokeWidth={strokeWidth} />;
  };
}

export const Activity = make('activity');
export const AlertOctagon = make('alert');
export const AlertTriangle = make('alert');
export const ArrowDownRight = make('arrowDownRight');
export const ArrowRight = make('arrowRight');
export const ArrowUpRight = make('arrowUpRight');
export const AudioLines = make('waves');
export const BatteryCharging = make('battery');
export const Building2 = make('building');
export const CalendarDays = make('calendar');
export const Check = make('check');
export const CheckCircle2 = make('check');
export const ClipboardList = make('file');
export const CloudRain = make('droplet');
export const Download = make('download');
export const Droplets = make('droplet');
export const FileText = make('file');
export const Fingerprint = make('shieldCheck');
export const FlaskConical = make('flask');
export const Gauge = make('chart');
export const Info = make('info');
export const Languages = make('message');
export const Layers = make('layers');
export const Leaf = make('leaf');
export const Loader2 = make('refresh');
export const Lock = make('lock');
export const Map = make('map');
export const MessageSquare = make('message');
export const PencilRuler = make('pencil');
export const Play = make('play');
export const Plus = make('plus');
export const Radar = make('sensor');
export const Radio = make('sensor');
export const RotateCcw = make('refresh');
export const Satellite = make('sensor');
export const ShieldAlert = make('shieldAlert');
export const ShieldCheck = make('shieldCheck');
export const Signal = make('signal');
export const Sprout = make('sprout');
export const Square = make('stop');
export const Thermometer = make('thermometer');
export const ThermometerSun = make('thermometer');
export const Trash2 = make('trash');
export const TrendingUp = make('chart');
export const Umbrella = make('shield');
export const Unlock = make('unlock');
export const Volume2 = make('speaker');
export const Wallet = make('building');
export const Waves = make('waves');
export const Wrench = make('shieldAlert');
export const X = make('close');
