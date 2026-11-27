import type { Parcel, YieldProjection } from '../types/agritwin';

export interface SimulationParams {
  /** Variation d'irrigation en % (-50 → +50) */
  irrigationDelta: number;
  /** Dose d'azote kg/ha (0 → 200) */
  nitrogen: number;
  /** Décalage du calendrier cultural en jours (-15 → +15) */
  calendarShift: number;
}

export const DEFAULT_PARAMS: SimulationParams = {
  irrigationDelta: 0,
  nitrogen: 100,
  calendarShift: 0,
};

export function clampParams(params: SimulationParams): SimulationParams {
  return {
    irrigationDelta: Math.min(50, Math.max(-50, params.irrigationDelta)),
    nitrogen: Math.min(200, Math.max(0, params.nitrogen)),
    calendarShift: Math.min(15, Math.max(-15, params.calendarShift)),
  };
}

/** S_eau — indice de satisfaction hydrique (avec malus d'excès). */
export function waterSatisfaction(deltaI: number): number {
  const base = Math.min(1.0, Math.max(0.3, 0.82 + 0.35 * (deltaI / 100)));
  const malus = deltaI <= 25 ? 0 : 0.15 * ((deltaI - 25) / 25);
  return base - malus;
}

/** S_engrais — indice de réponse minérale. */
export function fertilizerResponse(nitrogenKgHa: number): number {
  return 0.65 + 0.35 * (1 - Math.exp(-0.022 * nitrogenKgHa));
}

/** S_cal — indice de calendrier cultural. */
export function calendarIndex(shiftDays: number): number {
  return Math.max(0.75, 1.0 - 0.012 * Math.abs(shiftDays));
}

/** S_sal — indice de salinité du sol, lié à la dernière mesure EC. */
export function salinityIndex(ec: number): number {
  if (ec <= 1.2) return 1.0;
  return Math.max(0.5, 1.0 - 0.18 * (ec - 1.2));
}

export function projectYield(parcel: Parcel, ec: number, params: SimulationParams): YieldProjection {
  const p = clampParams(params);
  const scoreWater = waterSatisfaction(p.irrigationDelta);
  const scoreFertilizer = fertilizerResponse(p.nitrogen);
  const scoreCalendar = calendarIndex(p.calendarShift);
  const scoreSalinity = salinityIndex(ec);

  const yieldTPerHa =
    parcel.crop.yMax * scoreWater * scoreFertilizer * scoreCalendar * scoreSalinity;
  const totalProductionT = yieldTPerHa * parcel.areaHa;
  const grossRevenue = totalProductionT * parcel.crop.pricePerTon;
  const waterCostPerHa = 65_000 * (1 + p.irrigationDelta / 100);
  const waterM3 = parcel.crop.waterPerHa * (1 + p.irrigationDelta / 100) * parcel.areaHa;
  const totalCost =
    parcel.areaHa * (parcel.crop.baseCostPerHa + p.nitrogen * 450 + waterCostPerHa);
  const netMargin = grossRevenue - totalCost;

  return {
    irrigationDelta: p.irrigationDelta,
    nitrogen: p.nitrogen,
    calendarShift: p.calendarShift,
    scoreWater,
    scoreFertilizer,
    scoreCalendar,
    scoreSalinity,
    yieldTPerHa,
    totalProductionT,
    grossRevenue,
    waterCostPerHa,
    waterM3,
    totalCost,
    netMargin,
  };
}

export type FertilizerProduct = 'NPK 10-10-20' | 'Urée 46%' | 'Fumure organique';

const NITROGEN_RATIO: Record<FertilizerProduct, number> = {
  'NPK 10-10-20': 0.1,
  'Urée 46%': 0.46,
  'Fumure organique': 0.03,
};

/** kg N / ha apportés par un produit, à l'échelle de la parcelle. */
export function nitrogenFromProduct(
  product: FertilizerProduct,
  quantityKg: number,
  areaHa: number,
): number {
  if (areaHa <= 0) return 0;
  return Math.round(((quantityKg * NITROGEN_RATIO[product]) / areaHa) * 10) / 10;
}

export function irrigationAdvice(moisture15: number, ec: number): string {
  if (moisture15 < 18) {
    return `Irrigation urgente : l'humidité à quinze centimètres est de ${moisture15.toFixed(
      1,
    )} pour cent, sous le seuil critique. Apportez quinze à vingt millimètres dès maintenant, sans engrais pour éviter les brûlures racinaires.${ec > 1.5 ? ' Profitez-en pour lessiver la salinité du sol.' : ''}`;
  }
  if (moisture15 < 22) {
    return `Une irrigation légère de dix à douze millimètres est recommandée aujourd'hui : l'humidité à quinze centimètres est de ${moisture15.toFixed(
      1,
    )} pour cent. Reportez l'apport d'engrais après le retour de l'humidité.`;
  }
  if (moisture15 <= 34) {
    return `Inutile d'arroser aujourd'hui : l'humidité à quinze centimètres est optimale à ${moisture15.toFixed(
      1,
    )} pour cent. C'est le bon moment pour un apport d'engrais azoté fractionné, suivi d'une irrigation légère.`;
  }
  return `Sol proche de la saturation (${moisture15.toFixed(
    1,
  )} pour cent) : suspendez l'irrigation deux jours et vérifiez le drainage de la zone basse.`;
}

export function cropStage(parcel: Parcel, daysSinceSowing: number): string {
  if (daysSinceSowing < 20) return 'Levée / installation';
  if (daysSinceSowing < 45) return 'Croissance végétative';
  if (daysSinceSowing < 75) return 'Tubérisation / floraison';
  return parcel.crop.name === 'Tomate' ? 'Grossissement des fruits' : 'Bulbaison';
}
