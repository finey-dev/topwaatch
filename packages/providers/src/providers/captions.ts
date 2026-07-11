import ISO6391 from 'iso-639-1';

export const captionTypes = {
  srt: 'srt',
  vtt: 'vtt',
};
export type CaptionType = keyof typeof captionTypes;

export type Caption = {
  type: CaptionType;
  id: string; // only unique per stream
  opensubtitles?: boolean;
  url: string;
  hasCorsRestrictions: boolean;
  language: string;
  // Optional fields provided by Wyzie
  flagUrl?: string;
  display?: string;
  media?: string;
  isHearingImpaired?: boolean;
  source?: string;
  encoding?: string;
};

export function getCaptionTypeFromUrl(url: string): CaptionType | null {
  const extensions = Object.keys(captionTypes) as CaptionType[];
  const type = extensions.find((v) => url.endsWith(`.${v}`));
  if (!type) return null;
  return type;
}

function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Keys must be lowercase  lookup always uses toLowerCase(). */
const LANGUAGE_NAME_MAP: Record<string, string> = {
  'chinese - hong kong': 'zh',
  'chinese - traditional': 'zh',
  chinese: 'zh',
  czech: 'cs',
  danish: 'da',
  dutch: 'nl',
  english: 'en',
  'english - sdh': 'en',
  finnish: 'fi',
  french: 'fr',
  francais: 'fr',
  français: 'fr',
  german: 'de',
  greek: 'el',
  hungarian: 'hu',
  italian: 'it',
  korean: 'ko',
  norwegian: 'no',
  polish: 'pl',
  portuguese: 'pt',
  'portuguese - brazilian': 'pt',
  'portuguese (br)': 'pt',
  'protuguese (br)': 'pt',
  romanian: 'ro',
  'spanish - european': 'es',
  'spanish - latin american': 'es',
  spanish: 'es',
  swedish: 'sv',
  turkish: 'tr',
  arabic: 'ar',
  'اَلْعَرَبِيَّةُ': 'ar',
  العربية: 'ar',
  বাংলা: 'bn',
  bengali: 'bn',
  bangla: 'bn',
  filipino: 'tl',
  tagalog: 'tl',
  indonesia: 'id',
  indonesian: 'id',
  اردو: 'ur',
  urdu: 'ur',
  bosnian: 'bs',
  bulgarian: 'bg',
  croatian: 'hr',
  estonian: 'et',
  hebrew: 'he',
  persian: 'fa',
  'farsi/persian': 'fa',
  farsi: 'fa',
  russian: 'ru',
  serbian: 'sr',
  slovenian: 'sl',
  thai: 'th',
  japanese: 'ja',
  hindi: 'hi',
  vietnamese: 'vi',
  ukrainian: 'uk',
  catalan: 'ca',
  galician: 'gl',
  basque: 'eu',
  tamil: 'ta',
  telugu: 'te',
  malayalam: 'ml',
  kannada: 'kn',
  marathi: 'mr',
  gujarati: 'gu',
  punjabi: 'pa',
  malay: 'ms',
  // Simple language codes sometimes used as labels
  ng: 'en',
  re: 'fr',
};

/**
 * Convert a language name or code (from subtitle APIs) to an ISO 639-1 code.
 */
export function labelToLanguageCode(label: string): string | null {
  if (!label || typeof label !== 'string') return null;
  const trimmed = label.trim();
  if (!trimmed) return null;

  // Already a BCP-47 / ISO code (en, en-US, pt-br, …)
  if (/^[a-z]{2,3}(-[a-z0-9]+)*$/i.test(trimmed)) {
    const base = trimmed.slice(0, 2).toLowerCase();
    if (ISO6391.validate(base)) return base;
  }

  const lower = trimmed.toLowerCase();
  const ascii = stripDiacritics(lower);

  const mapped = LANGUAGE_NAME_MAP[lower] ?? LANGUAGE_NAME_MAP[ascii];
  if (mapped) return mapped;

  // ISO6391.getCode expects English names ("French", "Indonesian")
  const fromLib =
    ISO6391.getCode(trimmed) ||
    ISO6391.getCode(lower) ||
    ISO6391.getCode(ascii) ||
    ISO6391.getCode(ascii.replace(/\b\w/g, (c) => c.toUpperCase()));
  if (fromLib && fromLib.length > 0) return fromLib;

  return null;
}

export function isValidLanguageCode(code: string | null): boolean {
  if (!code) return false;
  return ISO6391.validate(code);
}

export function removeDuplicatedLanguages(list: Caption[]) {
  const beenSeen: Record<string, true> = {};

  return list.filter((sub) => {
    if (beenSeen[sub.language]) return false;
    beenSeen[sub.language] = true;
    return true;
  });
}
