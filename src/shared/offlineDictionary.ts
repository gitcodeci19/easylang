import { EN_SYNONYM_GROUPS, foldTurkishDiacritics } from './matcher.ts';
import {
  EXTRA_EN_SYNONYM_GROUPS,
  IRREGULAR_LEMMAS,
  OFFLINE_CORE_LEXICON,
  POS_TR_MAP,
  TR_DISPLAY_SYNONYM_GROUPS,
} from './offlineDictionaryData.ts';
import type { Card } from './types.ts';

export interface OfflineWordEntry {
  /** Original hovered word as queried. */
  query: string;
  /** Dictionary headword / base lemma (e.g. "go" for "went"). */
  lemma: string;
  /** Optional Turkish grammatical inflection note (e.g. "geçmiş zaman", "çoğul", "kısaltma"). */
  inflectionNoteTr?: string;
  /** Optional phonetic transcription (IPA). */
  phonetic?: string;
  /** Concise Turkish part-of-speech label (e.g. "fiil", "isim", "sıfat"). */
  posTr?: string;
  /** Optional CEFR level badge (e.g. "A2", "B1"). */
  level?: string;
  /** Deduplicated Turkish meanings & synonyms (primary meanings first). */
  meaningsTr: string[];
  /** Optional English synonyms for the lemma. */
  englishSynonyms?: string[];
}

interface IndexedWordRecord {
  lemma: string;
  inflectionNoteTr?: string;
  phonetic?: string;
  posList: string[];
  level?: string;
  meaningsTr: string[];
  englishSynonyms: string[];
}

export interface OfflineDictionaryIndex {
  readonly entries: ReadonlyMap<string, IndexedWordRecord>;
  readonly size: number;
}

const CEFR_ORDER: Record<string, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

const MAX_DISPLAY_TR_MEANINGS = 6;
const MAX_DISPLAY_EN_SYNONYMS = 5;

const TURKISH_ONLY_CHAR_RE = /[çğıİöşüâîûÇĞÖŞÜÂÎÛ]/;

// Build fast lookup maps for properly accented Turkish display synonyms and English synonyms
const TR_DISPLAY_SYN_MAP = new Map<string, number[]>();
TR_DISPLAY_SYNONYM_GROUPS.forEach((group, idx) => {
  for (const term of group) {
    const key = term.toLocaleLowerCase('tr-TR').trim();
    const list = TR_DISPLAY_SYN_MAP.get(key);
    if (list) {
      if (!list.includes(idx)) list.push(idx);
    } else {
      TR_DISPLAY_SYN_MAP.set(key, [idx]);
    }
  }
});

const COMBINED_EN_SYN_GROUPS: ReadonlyArray<readonly string[]> = [
  ...EN_SYNONYM_GROUPS,
  ...EXTRA_EN_SYNONYM_GROUPS,
];

const EN_DISPLAY_SYN_MAP = new Map<string, number[]>();
COMBINED_EN_SYN_GROUPS.forEach((group, idx) => {
  for (const term of group) {
    const key = term.toLowerCase().trim();
    const list = EN_DISPLAY_SYN_MAP.get(key);
    if (list) {
      if (!list.includes(idx)) list.push(idx);
    } else {
      EN_DISPLAY_SYN_MAP.set(key, [idx]);
    }
  }
});

const SPECIFIC_SPELLING_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['gray', 'grey'],
  ['mom', 'mum'],
  ['toward', 'towards'],
  ['airplane', 'aeroplane'],
  ['tire', 'tyre'],
  ['curb', 'kerb'],
  ['plow', 'plough'],
  ['program', 'programme'],
  ['jewelry', 'jewellery'],
  ['pajamas', 'pyjamas'],
  ['aluminum', 'aluminium'],
  ['mold', 'mould'],
  ['aging', 'ageing'],
  ['judgment', 'judgement'],
  ['acknowledgment', 'acknowledgement'],
  ['cozy', 'cosy'],
  ['skepticism', 'scepticism'],
  ['skeptic', 'sceptic'],
  ['skeptical', 'sceptical'],
  ['donut', 'doughnut'],
  ['check', 'cheque'],
  ['license', 'licence'],
  ['defense', 'defence'],
  ['offense', 'offence'],
  ['pretense', 'pretence'],
  ['practice', 'practise'],
  ['fulfill', 'fulfil'],
  ['skillful', 'skilful'],
  ['enrollment', 'enrolment'],
  ['installment', 'instalment'],
  ['canceled', 'cancelled'],
  ['canceling', 'cancelling'],
  ['traveled', 'travelled'],
  ['traveling', 'travelling'],
  ['traveler', 'traveller'],
  ['labeled', 'labelled'],
  ['labeling', 'labelling'],
  ['modeled', 'modelled'],
  ['modeling', 'modelling'],
];

const SPECIFIC_SPELLING_MAP = new Map<string, string[]>();
for (const [a, b] of SPECIFIC_SPELLING_PAIRS) {
  const la = SPECIFIC_SPELLING_MAP.get(a) ?? [];
  if (!la.includes(b)) la.push(b);
  SPECIFIC_SPELLING_MAP.set(a, la);

  const lb = SPECIFIC_SPELLING_MAP.get(b) ?? [];
  if (!lb.includes(a)) lb.push(a);
  SPECIFIC_SPELLING_MAP.set(b, lb);
}

/** Normalize a raw hovered English token for dictionary lookup. */
export function normalizeLookupToken(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[’‘`´]/g, "'")
    .replace(/^[^a-zA-Z]+|[^a-zA-Z']+$/g, '')
    .replace(/^'+|'+$/g, '')
    .toLowerCase();
  return cleaned;
}

/** Map an English POS label from cards.json to a concise Turkish POS label. */
function mapPosToTurkish(pos: string): string {
  const key = pos.trim().toLowerCase();
  if (!key) return '';
  return POS_TR_MAP[key] ?? key;
}

/** Split and deduplicate Turkish meanings cleanly while preserving Turkish diacritics. */
function extractCleanTurkishMeanings(rawList: readonly string[]): string[] {
  const out: string[] = [];
  const seenFolded = new Set<string>();

  for (const item of rawList) {
    if (!item) continue;
    const parts = item
      .split(/[;,/]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('(Edit Turkish'));
    for (const part of parts) {
      const folded = foldTurkishDiacritics(part);
      if (!folded || seenFolded.has(folded)) continue;
      seenFolded.add(folded);
      out.push(part);
    }
  }
  return out;
}

function appendUniqueMeanings(target: string[], additions: readonly string[]): void {
  const seen = new Set(target.map((m) => foldTurkishDiacritics(m)));
  for (const add of additions) {
    const trimmed = add.trim();
    const folded = foldTurkishDiacritics(trimmed);
    if (!trimmed || !folded || seen.has(folded)) continue;
    seen.add(folded);
    target.push(trimmed);
  }
}

function appendUniquePos(target: string[], rawPos: string, prepend = false): void {
  if (!rawPos) return;
  const parts = rawPos
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts) {
    if (!target.includes(part)) {
      if (prepend) {
        target.unshift(part);
      } else {
        target.push(part);
      }
    }
  }
}

/**
 * Build an in-memory offline dictionary index from all EasyLang cards plus the
 * curated offline core lexicon. Safe to call in popup, options, or background worker.
 */
export function buildOfflineDictionaryIndex(cards: readonly Card[]): OfflineDictionaryIndex {
  const map = new Map<string, IndexedWordRecord>();

  for (const card of cards) {
    if (card.type !== 'word') continue;
    const key = card.en
      .trim()
      .replace(/[’‘`´]/g, "'")
      .replace(/\s+/g, ' ')
      .toLowerCase();
    if (!key) continue;

    const meanings = extractCleanTurkishMeanings(card.acceptedTr);
    if (meanings.length === 0) continue;

    const posTr = mapPosToTurkish(card.pos);
    const existing = map.get(key);
    if (!existing) {
      const posList: string[] = [];
      appendUniquePos(posList, posTr);
      map.set(key, {
        lemma: card.en.trim(),
        phonetic: card.phonetic?.trim() || undefined,
        posList,
        level: card.level,
        meaningsTr: meanings,
        englishSynonyms: [],
      });
    } else {
      appendUniquePos(existing.posList, posTr);
      appendUniqueMeanings(existing.meaningsTr, meanings);
      if (!existing.phonetic && card.phonetic?.trim()) {
        existing.phonetic = card.phonetic.trim();
      }
      if (
        card.level &&
        existing.level &&
        (CEFR_ORDER[card.level] ?? 99) < (CEFR_ORDER[existing.level] ?? 99)
      ) {
        existing.level = card.level;
      }
    }
  }

  for (const [rawKey, sup] of Object.entries(OFFLINE_CORE_LEXICON)) {
    const key = rawKey.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      const posList: string[] = [];
      appendUniquePos(posList, sup.posTr);
      map.set(key, {
        lemma: sup.lemma ?? rawKey,
        inflectionNoteTr: sup.inflectionNoteTr,
        phonetic: sup.phonetic,
        posList,
        level: sup.level,
        meaningsTr: [...sup.meaningsTr],
        englishSynonyms: sup.englishSynonyms ? [...sup.englishSynonyms] : [],
      });
    } else {
      appendUniqueMeanings(existing.meaningsTr, sup.meaningsTr);
      appendUniquePos(existing.posList, sup.posTr, key === 'go');
      if (!existing.phonetic && sup.phonetic) {
        existing.phonetic = sup.phonetic;
      }
      if (sup.englishSynonyms) {
        for (const syn of sup.englishSynonyms) {
          if (!existing.englishSynonyms.includes(syn)) {
            existing.englishSynonyms.push(syn);
          }
        }
      }
    }
  }

  return { entries: map, size: map.size };
}

/** Generate US ↔ UK English spelling variants so both conventions resolve offline. */
export function generateSpellingVariants(word: string): string[] {
  const variants: string[] = [];
  const push = (v: string): void => {
    if (v && v !== word && !variants.includes(v)) variants.push(v);
  };

  const specific = SPECIFIC_SPELLING_MAP.get(word);
  if (specific) {
    for (const s of specific) push(s);
  }

  // -or <-> -our (favorite/favourite, color/colour, neighborhood/neighbourhood, rumor/rumour)
  if (/or(s|ed|ing|ite|ites|ful|hood|less|able|ous)?$/.test(word) && word.length >= 5) {
    push(word.replace(/or(s|ed|ing|ite|ites|ful|hood|less|able|ous)?$/, 'our$1'));
  }
  if (/our(s|ed|ing|ite|ites|ful|hood|less|able|ous)?$/.test(word) && word.length >= 6) {
    push(word.replace(/our(s|ed|ing|ite|ites|ful|hood|less|able|ous)?$/, 'or$1'));
  }

  // -er <-> -re (theater/theatre, center/centre, kilometer/kilometre, meter/metre)
  if (/(?:cent|theat|met|lit|fib|somb|calib|spect|lust)ers?$/.test(word)) {
    push(word.replace(/er(s)?$/, 're$1'));
  }
  if (/(?:cent|theat|met|lit|fib|somb|calib|spect|lust)res?$/.test(word)) {
    push(word.replace(/re(s)?$/, 'er$1'));
  }

  // -ize/-yze <-> -ise/-yse (customize/customise, organize/organise, analyze/analyse)
  if (/iz(e|es|ed|ing|ation|ations|er|ers)$/.test(word) && word.length >= 6) {
    push(word.replace(/iz(e|es|ed|ing|ation|ations|er|ers)$/, 'is$1'));
  }
  if (/is(e|es|ed|ing|ation|ations|er|ers)$/.test(word) && word.length >= 6) {
    push(word.replace(/is(e|es|ed|ing|ation|ations|er|ers)$/, 'iz$1'));
  }
  if (/yz(e|es|ed|ing)$/.test(word) && word.length >= 6) {
    push(word.replace(/yz(e|es|ed|ing)$/, 'ys$1'));
  }
  if (/ys(e|es|ed|ing)$/.test(word) && word.length >= 6) {
    push(word.replace(/ys(e|es|ed|ing)$/, 'yz$1'));
  }

  // -og <-> -ogue (catalog/catalogue, dialog/dialogue)
  if (/(?:catal|dial|anal|monol|prol|epil)ogs?$/.test(word)) {
    push(word.replace(/og(s)?$/, 'ogue$1'));
  }
  if (/(?:catal|dial|anal|monol|prol|epil)ogues?$/.test(word)) {
    push(word.replace(/ogue(s)?$/, 'og$1'));
  }

  // -lled/-lling <-> -led/-ling (travelled/traveled, cancelled/canceled)
  if (/ll(ed|ing|er|ers)$/.test(word) && word.length >= 6) {
    push(word.replace(/ll(ed|ing|er|ers)$/, 'l$1'));
  } else if (/[aeiou]l(ed|ing|er|ers)$/.test(word) && word.length >= 6) {
    push(word.replace(/([aeiou])l(ed|ing|er|ers)$/, '$1ll$2'));
  }

  return variants;
}

interface StemCandidate {
  stem: string;
  noteTr: string;
  isErSuffix?: boolean;
}

/** Generate ordered regular English inflectional stems with Turkish grammatical labels. */
function generateMorphologicalCandidates(word: string): StemCandidate[] {
  const out: StemCandidate[] = [];
  const seen = new Set<string>();
  const add = (stem: string, noteTr: string, isErSuffix = false): void => {
    if (!stem || stem.length < 2 || stem === word || seen.has(stem)) return;
    seen.add(stem);
    out.push({ stem, noteTr, isErSuffix });
  };

  // Possessive 's or plural possessive s'
  if (word.endsWith("'s") && word.length > 3) {
    add(word.slice(0, -2), 'iyelik eki (-in/-ın)');
  }

  // Plurals & 3rd person singular -s / -es / -ies / -ves
  if (word.endsWith('ies') && word.length > 4) {
    add(`${word.slice(0, -3)}y`, 'çoğul / geniş zaman');
  }
  if (word.endsWith('ves') && word.length > 4) {
    add(`${word.slice(0, -3)}f`, 'çoğul');
    add(`${word.slice(0, -3)}fe`, 'çoğul');
  }
  if (word.endsWith('es') && word.length > 3) {
    add(word.slice(0, -2), 'çoğul / geniş zaman');
    add(word.slice(0, -1), 'çoğul / geniş zaman');
  }
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 2) {
    add(word.slice(0, -1), 'çoğul / geniş zaman');
  }

  // Past tense / past participle -ied / -ed
  if (word.endsWith('ied') && word.length > 4) {
    add(`${word.slice(0, -3)}y`, 'geçmiş zaman / sıfat');
  }
  if (word.endsWith('ed') && word.length > 3) {
    const base = word.slice(0, -2);
    add(base, 'geçmiş zaman / sıfat');
    add(`${base}e`, 'geçmiş zaman / sıfat');
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      add(base.slice(0, -1), 'geçmiş zaman / sıfat');
    }
  }

  // Continuous / gerund -ing
  if (word.endsWith('ing') && word.length > 4) {
    const base = word.slice(0, -3);
    add(base, 'süreç / -ing');
    add(`${base}e`, 'süreç / -ing');
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      add(base.slice(0, -1), 'süreç / -ing');
    }
    if (base.endsWith('y')) {
      add(`${base.slice(0, -1)}ie`, 'süreç / -ing');
    }
  }

  // Comparatives & superlatives
  if (word.endsWith('ier') && word.length > 4) {
    add(`${word.slice(0, -3)}y`, 'karşılaştırma (-er)');
  }
  if (word.endsWith('iest') && word.length > 5) {
    add(`${word.slice(0, -4)}y`, 'en üstünlük (-est)');
  }
  if (word.endsWith('er') && word.length > 4) {
    const base = word.slice(0, -2);
    add(base, 'karşılaştırma (-er)', true);
    add(`${base}e`, 'karşılaştırma (-er)', true);
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      add(base.slice(0, -1), 'karşılaştırma (-er)', true);
    }
  }
  if (word.endsWith('est') && word.length > 5) {
    const base = word.slice(0, -3);
    add(base, 'en üstünlük (-est)');
    add(`${base}e`, 'en üstünlük (-est)');
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      add(base.slice(0, -1), 'en üstünlük (-est)');
    }
  }

  // Adverbs -ily / -ally / -ly
  if (word.endsWith('ily') && word.length > 5) {
    add(`${word.slice(0, -3)}y`, 'zarf (-ly)');
  }
  if (word.endsWith('ally') && word.length > 6) {
    add(word.slice(0, -2), 'zarf (-ly)');
    add(word.slice(0, -4), 'zarf (-ly)');
  }
  if (word.endsWith('ly') && word.length > 4) {
    const base = word.slice(0, -2);
    add(base, 'zarf (-ly)');
    add(`${base}e`, 'zarf (-ly)');
    if (base.endsWith('l')) {
      add(`${base}e`, 'zarf (-ly)');
    }
  }

  return out;
}

/** Enrich Turkish meanings with properly accented Turkish synonyms so single meanings expand richly. */
function enrichTurkishMeanings(primaryMeanings: readonly string[]): string[] {
  const result = [...primaryMeanings];
  if (result.length >= MAX_DISPLAY_TR_MEANINGS) {
    return result.slice(0, MAX_DISPLAY_TR_MEANINGS);
  }

  const seenFolded = new Set(result.map((m) => foldTurkishDiacritics(m)));

  // Enrich especially when the word has fewer than 4 listed meanings
  if (result.length < 4) {
    for (const baseMeaning of primaryMeanings) {
      const key = baseMeaning.toLocaleLowerCase('tr-TR').trim();
      const groupIndices = TR_DISPLAY_SYN_MAP.get(key);
      if (!groupIndices) continue;

      for (const gIdx of groupIndices) {
        const group = TR_DISPLAY_SYNONYM_GROUPS[gIdx];
        if (!group) continue;
        for (const syn of group) {
          const folded = foldTurkishDiacritics(syn);
          if (!folded || seenFolded.has(folded)) continue;
          seenFolded.add(folded);
          result.push(syn);
          if (result.length >= MAX_DISPLAY_TR_MEANINGS) {
            return result;
          }
        }
      }
    }
  }

  return result.slice(0, MAX_DISPLAY_TR_MEANINGS);
}

/** Collect English synonyms for a base lemma from shared synonym groups + supplement data. */
function collectEnglishSynonyms(
  lemma: string,
  query: string,
  extra: readonly string[]
): string[] {
  const lemmaLow = lemma.toLowerCase().trim();
  const queryLow = query.toLowerCase().trim();
  const out: string[] = [];
  const seen = new Set<string>([lemmaLow, queryLow]);

  const add = (syn: string): void => {
    const clean = syn.trim();
    const low = clean.toLowerCase();
    if (!clean || seen.has(low)) return;
    seen.add(low);
    out.push(clean);
  };

  for (const s of extra) {
    add(s);
    if (out.length >= MAX_DISPLAY_EN_SYNONYMS) return out;
  }

  const groups = EN_DISPLAY_SYN_MAP.get(lemmaLow);
  if (groups) {
    for (const gIdx of groups) {
      const group = COMBINED_EN_SYN_GROUPS[gIdx];
      if (!group) continue;
      for (const word of group) {
        add(word);
        if (out.length >= MAX_DISPLAY_EN_SYNONYMS) return out;
      }
    }
  }

  return out;
}

function materializeEntry(
  rawQuery: string,
  record: IndexedWordRecord,
  overrideInflectionNote?: string
): OfflineWordEntry {
  const meaningsTr = enrichTurkishMeanings(record.meaningsTr);
  const englishSynonyms = collectEnglishSynonyms(
    record.lemma,
    rawQuery,
    record.englishSynonyms
  );
  const posTr =
    record.posList.length > 0 ? record.posList.slice(0, 2).join(' / ') : undefined;

  return {
    query: rawQuery.trim(),
    lemma: record.lemma,
    inflectionNoteTr: overrideInflectionNote ?? record.inflectionNoteTr,
    phonetic: record.phonetic,
    posTr,
    level: record.level,
    meaningsTr,
    englishSynonyms: englishSynonyms.length > 0 ? englishSynonyms : undefined,
  };
}

function findDirectOrSpellingRecord(
  index: OfflineDictionaryIndex,
  token: string
): IndexedWordRecord | null {
  const direct = index.entries.get(token);
  if (direct) return direct;

  for (const variant of generateSpellingVariants(token)) {
    const hit = index.entries.get(variant);
    if (hit) return hit;
  }
  return null;
}

/**
 * Look up an English word in the offline dictionary index.
 * Supports direct entries, US/UK spelling variants, contractions, irregular forms,
 * and regular English inflections, always enriching with Turkish & English synonyms.
 */
export function lookupOfflineWord(
  index: OfflineDictionaryIndex,
  rawWord: string
): OfflineWordEntry | null {
  if (!rawWord || TURKISH_ONLY_CHAR_RE.test(rawWord)) {
    return null;
  }

  const norm = normalizeLookupToken(rawWord);
  if (!norm) return null;
  // Ignore standalone 1-letter fragments except real English words "i" and "a"
  if (norm.length === 1 && norm !== 'i' && norm !== 'a') {
    return null;
  }

  // 1. Direct or US/UK spelling match
  const directRecord = findDirectOrSpellingRecord(index, norm);
  if (directRecord) {
    return materializeEntry(rawWord, directRecord);
  }

  // 2. Hyphen-joined fallback (e.g. "wi-fi" vs "wifi")
  if (norm.includes('-')) {
    const joined = norm.replace(/-/g, '');
    const joinedRecord = findDirectOrSpellingRecord(index, joined);
    if (joinedRecord) {
      return materializeEntry(rawWord, joinedRecord);
    }
  }

  // 3. Irregular verbs, irregular noun plurals, irregular comparatives/superlatives
  const irregular = IRREGULAR_LEMMAS[norm];
  if (irregular) {
    const [baseLemma, noteTr] = irregular;
    const baseRecord = findDirectOrSpellingRecord(index, baseLemma);
    if (baseRecord) {
      return materializeEntry(rawWord, baseRecord, noteTr);
    }
  }

  // 4. Regular morphological stemming (+ spelling normalization on stems)
  const candidates = generateMorphologicalCandidates(norm);
  for (const cand of candidates) {
    const stemRecord = findDirectOrSpellingRecord(index, cand.stem);
    if (stemRecord) {
      let noteTr = cand.noteTr;
      if (
        cand.isErSuffix &&
        stemRecord.posList.includes('fiil') &&
        !stemRecord.posList.includes('sıfat') &&
        !stemRecord.posList.includes('zarf')
      ) {
        noteTr = 'yapan / araç (-er)';
      }
      return materializeEntry(rawWord, stemRecord, noteTr);
    }

    // Handle double inflection such as "teammates'" or irregular plural + possessive ("children's")
    if (norm.endsWith("'s")) {
      const irrBase = IRREGULAR_LEMMAS[cand.stem];
      if (irrBase) {
        const irrRecord = findDirectOrSpellingRecord(index, irrBase[0]);
        if (irrRecord) {
          return materializeEntry(rawWord, irrRecord, `${irrBase[1]} + iyelik`);
        }
      }
    }
  }

  // 5. Fallback for spelling variant -> morphological stem (e.g. "customizing" -> "customising" -> "customise")
  for (const variant of generateSpellingVariants(norm)) {
    const varIrr = IRREGULAR_LEMMAS[variant];
    if (varIrr) {
      const hit = findDirectOrSpellingRecord(index, varIrr[0]);
      if (hit) return materializeEntry(rawWord, hit, varIrr[1]);
    }
    for (const cand of generateMorphologicalCandidates(variant)) {
      const hit = findDirectOrSpellingRecord(index, cand.stem);
      if (hit) return materializeEntry(rawWord, hit, cand.noteTr);
    }
  }

  return null;
}
