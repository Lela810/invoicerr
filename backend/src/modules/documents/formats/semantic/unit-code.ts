/**
 * A document line stores its unit as a UN/ECE Recommendation N°20 code when one was picked, or as
 * the free text typed. EN 16931 requires a code on every line (BT-130) and `@e-invoice-eu/core`
 * rejects any value outside the Rec20 list, so free text is exported as C62 ("one"), except the
 * older English words in LEGACY_EXPORT_CODES, which keep the code they always had.
 */

/** The Rec20 codes the line's unit field offers, in display order. */
export const SUGGESTED_UNIT_CODES = [
  'H87',
  'C62',
  'HUR',
  'DAY',
  'WEE',
  'MON',
  'ANN',
  'KGM',
  'GRM',
  'LTR',
  'MTR',
  'KMT',
  'SET',
  'BX',
] as const;

export type SuggestedUnitCode = (typeof SUGGESTED_UNIT_CODES)[number];

/** English labels, the fallback for a locale with no translation of its own. */
export const SUGGESTED_UNIT_LABELS: Readonly<Record<SuggestedUnitCode, string>> = {
  H87: 'Piece',
  C62: 'Unit',
  HUR: 'Hour',
  DAY: 'Day',
  WEE: 'Week',
  MON: 'Month',
  ANN: 'Year',
  KGM: 'Kilogram',
  GRM: 'Gram',
  LTR: 'Litre',
  MTR: 'Metre',
  KMT: 'Kilometre',
  SET: 'Set',
  BX: 'Box',
};

/**
 * Free text that names exactly one unit, in the languages the product ships in, matched trimmed and
 * case-insensitively. A word that could mean two things in one of those languages ("m": metre or
 * minute, "lata": years or a tin, "tag": day or a label, "pc": piece or a computer) is deliberately
 * absent and stays free text.
 */
export const UNAMBIGUOUS_UNIT_WORDS: Readonly<Record<SuggestedUnitCode, readonly string[]>> = {
  H87: [
    'piece',
    'pieces',
    'pcs',

    'pièce',
    'pièces',
    'stück',
    'stk',
    'pezzo',
    'pezzi',
    'sztuka',
    'sztuki',
    'szt',
    'szt.',
    'peça',
    'peças',
  ],
  C62: [
    'unit',
    'units',
    'unité',
    'unités',
    'einheit',
    'einheiten',
    'unità',
    'jednostka',
    'unidade',
    'unidades',
  ],
  HUR: [
    'h',
    'hr',
    'hrs',
    'hour',
    'hours',
    'heure',
    'heures',
    'stunde',
    'stunden',

    'ore',
    'godzina',
    'godziny',
    'godzin',
    'godz.',
    'hora',
    'horas',
  ],
  DAY: ['day', 'days', 'jour', 'jours', 'tage', 'giorno', 'giorni', 'dzień', 'dni', 'dia', 'dias'],
  WEE: [
    'week',
    'weeks',
    'semaine',
    'semaines',
    'woche',
    'wochen',
    'settimana',
    'settimane',
    'tydzień',
    'tygodnie',
    'semana',
    'semanas',
  ],
  MON: ['month', 'months', 'mois', 'monat', 'monate', 'mese', 'mesi', 'miesiąc', 'miesiące', 'mês', 'meses'],
  ANN: ['year', 'years', 'année', 'années', 'jahr', 'jahre', 'anno', 'anni', 'rok', 'ano', 'anos'],
  KGM: [
    'kg',
    'kilogram',
    'kilograms',
    'kilogramme',
    'kilogrammes',
    'kilogramm',
    'chilogrammo',
    'chilogrammi',
    'kilogramy',
    'quilograma',
    'quilogramas',
  ],
  GRM: ['g', 'gram', 'grams', 'gramme', 'grammes', 'gramm', 'grammo', 'grammi', 'gramy', 'grama', 'gramas'],
  LTR: ['l', 'litre', 'litres', 'liter', 'liters', 'litro', 'litri', 'litr', 'litry', 'litros'],
  MTR: ['metre', 'metres', 'meter', 'meters', 'mètre', 'mètres', 'metro', 'metri', 'metr', 'metry', 'metros'],
  KMT: [
    'km',
    'kilometre',
    'kilometres',
    'kilometer',
    'kilometers',
    'kilomètre',
    'kilomètres',
    'chilometro',
    'chilometri',
    'kilometr',
    'kilometry',
    'quilómetro',
    'quilómetros',
  ],
  SET: ['set', 'sets', 'zestaw', 'zestawy', 'conjunto', 'conjuntos'],
  BX: ['box', 'boxes', 'boîte', 'boîtes', 'scatola', 'scatole', 'pudełko', 'pudełka', 'caixa', 'caixas'],
};

const SUGGESTED: ReadonlySet<string> = new Set(SUGGESTED_UNIT_CODES);

const CODE_BY_WORD: ReadonlyMap<string, SuggestedUnitCode> = new Map(
  SUGGESTED_UNIT_CODES.flatMap((code) => UNAMBIGUOUS_UNIT_WORDS[code].map((word) => [word, code] as const)),
);

/**
 * How text stored before units became codes is exported, frozen so an issued invoice's XML never
 * changes. Free text it does not list is exported as C62.
 */
const LEGACY_EXPORT_CODES: Readonly<Record<string, string>> = {
  hour: 'HUR',
  hours: 'HUR',
  day: 'DAY',
  days: 'DAY',
  week: 'WEE',
  weeks: 'WEE',
  month: 'MON',
  months: 'MON',
  year: 'ANN',
  years: 'ANN',
  unit: 'C62',
  units: 'C62',
  piece: 'C62',
  pieces: 'C62',
  kg: 'KGM',
  kilogram: 'KGM',
  kilograms: 'KGM',
  g: 'GRM',
  gram: 'GRM',
  grams: 'GRM',
  l: 'LTR',
  litre: 'LTR',
  litres: 'LTR',
  liter: 'LTR',
  liters: 'LTR',
  m: 'MTR',
  meter: 'MTR',
  meters: 'MTR',
  metre: 'MTR',
  metres: 'MTR',
  km: 'KMT',
  set: 'SET',
  box: 'BX',
};

/** The Rec20 code a stored unit stands for, used by the migration to turn free text into a code. */
export function knownUnitCode(unit: string): SuggestedUnitCode | undefined {
  const trimmed = unit.trim();
  if (SUGGESTED.has(trimmed)) return trimmed as SuggestedUnitCode;
  return CODE_BY_WORD.get(trimmed.toLowerCase());
}

/** The BT-130 code exported for a stored unit: the code itself, or the frozen mapping of older text. */
export function unitCodeFor(unit: string): string {
  const trimmed = unit.trim();
  if (SUGGESTED.has(trimmed)) return trimmed;
  return LEGACY_EXPORT_CODES[trimmed.toLowerCase()] ?? 'C62';
}
