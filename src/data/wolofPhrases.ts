import type { ParcelDataset, PestReport } from '../types/agritwin';

export interface VoicePhrase {
  fr: string;
  wolof: string;
  frTranslation: string;
}

export const VOICE_INTRO: VoicePhrase = {
  fr: "Assistant vocal AgriTwin. Voici les alertes actives sur votre parcelle.",
  wolof: 'Jërëjëf. Man la AgriTwin, sama joxe ndimbal ci tool bi.',
  frTranslation: "Merci. Je suis AgriTwin, votre assistant pour la parcelle.",
};

export const VOICE_ALERTS = {
  hydric: {
    fr: "Alerte hydrique : l'humidité du sol à quinze centimètres est inférieure au seuil critique sur la zone Nord. Irriguez dans les six heures.",
    wolof: 'Ndox mi ci suuf bi dafa wàññi ci bérab bi ci bëj-gànnaar. Joxe ndox ci tool bi ci ay waxtu juroom-benn.',
    frTranslation:
      "L'eau du sol est très faible dans la zone Nord. Il faut irriguer dans les six heures.",
  },
  heat: {
    fr: "Vague de chaleur détectée : température de l'air trente-neuf degrés et demi, humidité du sol quatorze pour cent. Stress hydrique sévère, irriguez immédiatement et ombragez les jeunes plants.",
    wolof: 'Tàng bi dafa ëmb. Ndox mi ci suuf bi dafa wàññi lool. Joxe ndox léegi, te naanal ay plant yi.',
    frTranslation:
      "La chaleur est forte et l'eau du sol très faible. Irriguez maintenant et protégez les jeunes plants.",
  },
  fraud: {
    fr: "Anomalie de cohérence entre la sonde et le satellite. Une hausse brutale de l'humidité mesurée n'est pas confirmée par le radar Sentinel un. La composante intégrité du Score Vert est annulée.",
    wolof: 'Sonde bi ak satellite bi ñuñu sampoo. Ndox mi sonde bi natt, radar bi manul ko confirmé. Score Vert bi tuddu na.',
    frTranslation:
      "La sonde et le satellite ne concordent pas. L'intégrité du Score Vert est annulée.",
  },
  tamper: {
    fr: "Alerte de sécurité physique : le boîtier scellé a été ouvert ou arraché. Le dossier de crédit est gelé jusqu'à inspection du technicien.",
    wolof: 'Boîtier bi ñu ubbi walla ñu kàcc ko. Dossier crédit bi ñu ko téye ba teknisiën bi ñów.',
    frTranslation:
      "Le boîtier a été ouvert ou arraché. Le dossier de crédit est gelé jusqu'à la visite du technicien.",
  },
  normal: {
    fr: "Relevé reçu et authentifié. Humidité du sol vingt-six pour cent, indice de végétation zéro virgule sept cinq. Aucune anomalie détectée.",
    wolof: 'Relevé bi ñu ko jot te ñu ko seet. Ndox mi ci suuf bi ñaari-fukk ak juroom-benn pour cent. Kenn jafe-jafe amul.',
    frTranslation:
      "Le relevé a été reçu et authentifié. Humidité du sol vingt-six pour cent, aucune anomalie détectée.",
  },
  salinity: {
    fr: "Salinité du sol en hausse : conductivité électrique un virgule six cinq. Privilégiez un lessivage contrôlé et évitez les apports de chlorure.",
    wolof: 'Suuf bi dafa am sel lool. Na nga lessiver ndox mi, te bàyyi chlorure bi.',
    frTranslation:
      "Le sol est trop salé. Faites un lessivage contrôlé et évitez les chlorures.",
  },
  pest: {
    fr: "Signalement phytosanitaire enregistré : attaque modérée de thrips. Un traitement localisé est recommandé sur la zone concernée.",
    wolof: 'Jafe-jafe ci plant yi ñu ko bind : thrips am na. Na nga faj bérab bi.',
    frTranslation:
      "Un signalement phytosanitaire est enregistré : attaque de thrips. Traitez la zone concernée.",
  },
  allClear: {
    fr: "Aucune alerte critique. La parcelle est dans un état hydrique et sanitaire satisfaisant.",
    wolof: 'Jafe-jafe bu mag amul. Tool bi dafa baax.',
    frTranslation: "Aucune alerte critique. La parcelle est en bon état.",
  },
} satisfies Record<string, VoicePhrase>;

export const QUICK_QUESTIONS = [
  {
    id: 'humidity',
    labelFr: "Quel est l'état de l'humidité dans mon champ ?",
    labelWolof: 'Naka la ndox mi nekk ci sama tool ?',
  },
  {
    id: 'action',
    labelFr: "Dois-je arroser ou mettre de l'engrais aujourd'hui ?",
    labelWolof: 'Ndax naa joxe ndox walla engrais tey ?',
  },
  {
    id: 'score',
    labelFr: 'Quel est mon Score Vert pour la banque ?',
    labelWolof: 'Ñaata sama Score Vert ci bank bi ?',
  },
] as const;

export type QuickQuestionId = (typeof QUICK_QUESTIONS)[number]['id'];

export interface QuickAnswer {
  fr: string;
  wolof: string;
  frTranslation: string;
}

function n1(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

export function buildQuickAnswer(
  id: QuickQuestionId,
  dataset: ParcelDataset,
  score: number,
  irrigationAdvice: string,
): QuickAnswer {
  const latest = dataset.records[dataset.records.length - 1];
  const zone = dataset.parcel.zones[0];
  if (id === 'humidity') {
    const state = latest.moisture15 < 20 ? 'critique' : latest.moisture15 < 22 ? 'en vigilance' : 'optimale';
    return {
      fr: `Humidité du sol à quinze centimètres : ${n1(latest.moisture15)} pour cent, situation ${state}. Réserve profonde à trente-cinq centimètres : ${n1(latest.moisture35)} pour cent. La zone ${zone.label} est la plus sensible.`,
      wolof: `Ndox mi ci suuf bi : ${n1(latest.moisture15)} pour cent. Suuf bi ci ${n1(latest.moisture35)} pour cent. ${zone.label} la gën a jafe.`,
      frTranslation: `Humidité à 15 cm : ${n1(latest.moisture15)} %. Réserve profonde : ${n1(latest.moisture35)} %. Zone la plus sensible : ${zone.label}.`,
    };
  }
  if (id === 'action') {
    return {
      fr: irrigationAdvice,
      wolof:
        latest.moisture15 < 22
          ? 'Joxe ndox ci tool bi tey, te bàyyi engrais bi ba ndox mi dellusi.'
          : "Engrais bi man nga ko joxe, ndox mi dootul. Def na nga bilan azoté bi ci journal bi.",
      frTranslation:
        latest.moisture15 < 22
          ? "Irriguez aujourd'hui et reportez l'engrais après le retour de l'humidité."
          : "Vous pouvez apporter l'engrais, l'humidité est suffisante. Complétez le bilan azoté dans le journal.",
    };
  }
  return {
    fr: `Votre Score Vert est de ${score} points sur cent. Il combine ${dataset.fertilizers.length > 0 ? 'la régularité hydrique, la vigueur végétative, la santé du sol et l’intégrité des données' : 'la régularité hydrique, la vigueur végétative et l’intégrité des données'}. ${score >= 75 ? 'Le dossier est éligible au déblocage de la tranche deux.' : score >= 50 ? 'Le dossier est éligible sous suivi coopératif.' : 'Le décaissement est suspendu, un audit est requis.'}`,
    wolof: `Sa Score Vert : ${score} ci 100. ${score >= 75 ? 'Dossier bi man nañu ko joxe tranche 2.' : score >= 50 ? 'Dossier bi éligible na ci suivi coopératif.' : 'Décaissement bi ñu ko tëye, audit lañu koy def.'}`,
    frTranslation: `Score Vert : ${score}/100. ${score >= 75 ? 'Éligible au déblocage de la tranche 2.' : score >= 50 ? 'Éligible sous suivi coopératif.' : 'Décaissement suspendu, audit requis.'}`,
  };
}

export const PEST_OPTIONS: { type: PestReport['type']; label: string }[] = [
  { type: 'Chenilles', label: 'Chenilles' },
  { type: 'Thrips', label: 'Thrips' },
  { type: 'Mildiou', label: 'Mildiou' },
  { type: 'Jaunissement', label: 'Jaunissement' },
];
