import type { CardType } from './types.ts';

export interface DisplayMeanings {
  primary: string;
  alternatives: string[];
  /** Number of additional non-duplicate meanings omitted by the display cap. */
  hiddenCount: number;
}

const LEADING_SUBJECT_PRONOUNS = new Set(['ben', 'sen', 'o', 'biz', 'siz', 'onlar']);

const MECHANICAL_SYNONYM_MAP: Readonly<Record<string, string>> = {
  fakat: 'ama',
  lakin: 'ama',
  ancak: 'ama',
  zira: 'cunku',
  tum: 'butun',
  yine: 'tekrar',
  cabuk: 'hizli',
  cabucak: 'hizli',
  hizlica: 'hizli',
  nihayet: 'sonunda',
  daima: 'herzaman',
  bircok: 'cogu',
  sebep: 'neden',
  niye: 'neden',
  parolasi: 'sifresi',
  parola: 'sifre',
  tesekkurler: 'tesekkur',
  yanitiniz: 'cevap',
  yanit: 'cevap',
};

function foldTurkishAscii(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toCanonicalSentenceTokens(text: string): string[] {
  const folded = foldTurkishAscii(text)
    .replace(/\bsu anda\b/g, 'simdi')
    .replace(/\bher zaman\b/g, 'herzaman')
    .replace(/\bpek cok\b/g, 'cogu');

  const rawTokens = folded.split(' ').filter(Boolean);
  if (rawTokens.length > 1 && LEADING_SUBJECT_PRONOUNS.has(rawTokens[0]!)) {
    rawTokens.shift();
  }

  return rawTokens.map((tok) => {
    const mapped = MECHANICAL_SYNONYM_MAP[tok] ?? tok;
    // Collapse mechanical formal past endings ("kurdu" vs "kurmuştur", "etti" vs "etmiştir")
    if (mapped.length >= 6) {
      return mapped.replace(/(?:m[iu]st[iu]r|d[iu]r|t[iu]r)$/, '');
    }
    return mapped;
  });
}

function areMechanicalSentenceClones(aTokens: readonly string[], bTokens: readonly string[]): boolean {
  if (aTokens.length === 0 || bTokens.length === 0) return false;
  if (
    aTokens.length === bTokens.length &&
    aTokens.every((t, i) => t === bTokens[i])
  ) {
    return true;
  }

  const setA = new Set(aTokens);
  const setB = new Set(bTokens);
  let inter = 0;
  for (const t of setA) {
    if (setB.has(t)) inter += 1;
  }
  const union = setA.size + setB.size - inter;
  if (union > 0 && inter / union >= 0.68) {
    return true;
  }

  // Catch identical sentence structure where only verb inflection stem differs ("kurdu" vs "kur")
  if (aTokens.length === bTokens.length && aTokens.length >= 3) {
    let unrelatedDiffs = 0;
    for (let i = 0; i < aTokens.length; i += 1) {
      const a = aTokens[i]!;
      const b = bTokens[i]!;
      if (a !== b && !(a.length >= 3 && b.length >= 3 && a.slice(0, 3) === b.slice(0, 3))) {
        unrelatedDiffs += 1;
      }
    }
    if (unrelatedDiffs === 0) {
      return true;
    }
  }

  return false;
}

/**
 * Extract clean, user-friendly Turkish meanings for UI display without mutating `card.acceptedTr`.
 *
 * - For `word` cards: deduplicates case-insensitively and returns concise synonyms.
 * - For `sentence` cards: strips mechanical grading clones (optional subject pronouns,
 *   `-mıştır`/`-dır` verb copies, and `ama`/`fakat` or `tüm`/`bütün` swaps) while keeping
 *   genuinely distinct natural alternative translations.
 */
export function extractDisplayMeanings(
  acceptedTr: readonly string[],
  cardType: CardType,
  maxAlternatives?: number
): DisplayMeanings {
  const cleaned = acceptedTr.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return { primary: '', alternatives: [], hiddenCount: 0 };
  }

  if (cardType === 'word') {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const item of cleaned) {
      const key = item.toLocaleLowerCase('tr-TR');
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }
    const cap = maxAlternatives ?? 4;
    const alts = unique.slice(1, 1 + cap);
    return {
      primary: unique[0] ?? '',
      alternatives: alts,
      hiddenCount: Math.max(0, unique.length - 1 - alts.length),
    };
  }

  const kept: string[] = [];
  const keptTokenLists: string[][] = [];
  for (const candidate of cleaned) {
    const tokens = toCanonicalSentenceTokens(candidate);
    if (keptTokenLists.some((existing) => areMechanicalSentenceClones(tokens, existing))) {
      continue;
    }
    kept.push(candidate);
    keptTokenLists.push(tokens);
  }

  const cap = maxAlternatives ?? 2;
  const alts = kept.slice(1, 1 + cap);
  return {
    primary: kept[0] ?? '',
    alternatives: alts,
    hiddenCount: Math.max(0, kept.length - 1 - alts.length),
  };
}

/**
 * Compact single-line representation for tables and summary rows:
 * - Words: "tavsiye · öğüt · nasihat"
 * - Sentences: primary sentence cleanly (never comma-concatenating full sentences with "., ").
 */
export function formatDisplayMeaningsInline(
  acceptedTr: readonly string[],
  cardType: CardType
): string {
  const { primary, alternatives } = extractDisplayMeanings(
    acceptedTr,
    cardType,
    cardType === 'word' ? 3 : 0
  );
  if (!primary) return '';
  if (cardType === 'word' && alternatives.length > 0) {
    return [primary, ...alternatives].join(' · ');
  }
  return primary;
}
