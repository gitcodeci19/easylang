import type {
  PageLanguage,
  PageSentenceCandidate,
  PageTranslationDirection,
} from './types';

export interface ReadablePageBlockInput {
  blockIndex: number;
  text: string;
  inViewport: boolean;
  tagPriority: number;
}

const TURKISH_CHAR_RE = /[çğıİöşüÇĞÖŞÜ]/g;

const TURKISH_STOPWORDS_RE =
  /\b(bir|ve|bu|şu|su|için|icin|ile|ama|fakat|ancak|çünkü|cunku|değil|degil|olarak|daha|gibi|kadar|nasıl|nasil|neden|zaman|şey|sey|var|varsa|yok|çok|cok|en|her|ben|sen|biz|siz|onlar|olan|göre|gore|sonra|önce|once|üzerinde|uzerinde|hakkında|hakkinda|arada|şekilde|sekilde|böyle|boyle|şimdi|simdi|artık|artik|henüz|henuz|büyük|buyuk|küçük|kucuk|yeni|eski|aynı|ayni|ne|ilk|ki|da|de|mi|mı|mu|mü|bile|hala|hâlâ|bazı|bazi|sadece|zaten|diyorum|bence)\b/gi;

const ENGLISH_STOPWORDS_RE =
  /\b(the|and|that|have|for|not|with|you|this|but|his|from|they|say|her|she|or|an|will|my|one|all|would|there|their|what|so|about|which|when|make|can|like|time|just|know|take|people|into|year|your|good|some|could|them|than|then|now|look|only|come|its|over|think|also|after|use|how|our|work|first|well|way|even|new|want|because|any|these|give|day|most|is|are|was|were|be|been|has|had|does|did|should|might|while)\b/gi;

const ABBREVIATION_SET = new Set([
  'dr.',
  'mr.',
  'mrs.',
  'ms.',
  'prof.',
  'sr.',
  'jr.',
  'vs.',
  'etc.',
  'e.g.',
  'i.e.',
  'vb.',
  'örn.',
  'bkz.',
  'yy.',
  'no.',
  'inc.',
  'ltd.',
  'st.',
  'fig.',
  'approx.',
]);

const BOILERPLATE_NOISE_RE =
  /\b(cookies?|çerez(?:ler)?|privacy policy|gizlilik politikası|terms of service|kullanım koşulları|all rights reserved|tüm hakları saklıdır|subscribe now|abone ol|sign in|log in|giriş yap|accept all|tümünü kabul et)\b/i;

const CODE_OR_URL_RE = /(https?:\/\/|www\.|=>|===|!==|\{\s*\}|<\/?[a-z]+>|const\s+[a-z_$])/i;

/** Match metric/statistical data lines (units, percentages, colon-separated key:value stats). */
const METRIC_DATA_NOISE_RE =
  /(%|\|\s*\S|\b\d+(?:[.,]\d+)?\s*(?:mbps|gbps|gb|tb|mb|kb|khz|mhz|ghz|km|milyon|milyar|million|billion)\b)/i;

/** Strip leading bullet symbols, checkmarks, or decorative emojis while preserving the sentence text. */
export function stripLeadingBullets(raw: string): string {
  return raw
    .replace(/^[\s•▪▫▸▹►▻>\-–—✓✔☑✅❎★☆🌐🏢📊📈📉📌📍🔹🔸👉⚡]+/u, '')
    .replace(/^(?:\p{Extended_Pictographic}|\uFE0F|\u200D)+\s*/u, '')
    .trim();
}

/**
 * Determine whether a text sample is predominantly Turkish or English
 * using character signals and function-word density (no AI tokens used).
 */
export function detectTextLanguage(text: string): {
  lang: PageLanguage;
  trScore: number;
  enScore: number;
} {
  const trCharMatches = text.match(TURKISH_CHAR_RE)?.length ?? 0;
  const trWordMatches = text.match(TURKISH_STOPWORDS_RE)?.length ?? 0;
  const enWordMatches = text.match(ENGLISH_STOPWORDS_RE)?.length ?? 0;

  const trScore = trCharMatches * 2.5 + trWordMatches * 3;
  const enScore = enWordMatches * 2.5;

  return {
    lang: trScore > enScore ? 'tr' : 'en',
    trScore,
    enScore,
  };
}

/**
 * Split a prose paragraph or block into individual sentences using punctuation rules
 * while avoiding splits on common abbreviations (Dr., e.g., vb.) and decimals.
 */
export function splitBlockIntoSentences(rawText: string): string[] {
  const normalized = rawText.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i]!;
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;

    // Handle ellipsis or repeated punctuation like "..." / "?!" by advancing to the last mark
    let endPunctIdx = i;
    while (
      endPunctIdx + 1 < normalized.length &&
      (normalized[endPunctIdx + 1] === '.' ||
        normalized[endPunctIdx + 1] === '!' ||
        normalized[endPunctIdx + 1] === '?')
    ) {
      endPunctIdx += 1;
    }

    // Consume optional closing quote or parenthesis attached to punctuation
    let boundaryIdx = endPunctIdx;
    while (
      boundaryIdx + 1 < normalized.length &&
      /["'”’)\]]/.test(normalized[boundaryIdx + 1]!)
    ) {
      boundaryIdx += 1;
    }

    const nextChar = normalized[boundaryIdx + 1];
    // Must be end of block OR whitespace followed by another token
    if (nextChar !== undefined && !/\s/.test(nextChar)) {
      i = boundaryIdx;
      continue;
    }

    if (ch === '.') {
      const prevChar = i > 0 ? normalized[i - 1]! : '';
      const afterSpaceChar = normalized[boundaryIdx + 2] ?? '';
      // Avoid splitting decimal/version numbers like 3.14 or v1.2 when adjacent to digits
      if (/\d/.test(prevChar) && /\d/.test(afterSpaceChar)) {
        i = boundaryIdx;
        continue;
      }

      // Check token ending at this dot against abbreviations
      const sliceUpToDot = normalized.slice(start, endPunctIdx + 1);
      const lastToken = sliceUpToDot.split(/\s+/).pop()?.toLowerCase() ?? '';
      if (ABBREVIATION_SET.has(lastToken)) {
        i = boundaryIdx;
        continue;
      }

      // Single uppercase initial like "A. Smith"
      if (/^[A-ZÇĞİÖŞÜ]\.$/.test(sliceUpToDot.split(/\s+/).pop() ?? '')) {
        i = boundaryIdx;
        continue;
      }
    }

    // Require next non-space character (if any) to look like a new sentence start
    const restTrimmed = normalized.slice(boundaryIdx + 1).trimStart();
    if (restTrimmed.length > 0 && !/^["'“‘(\[]?[A-ZÇĞİÖŞÜ0-9]/.test(restTrimmed)) {
      i = boundaryIdx;
      continue;
    }

    const candidate = normalized.slice(start, boundaryIdx + 1).trim();
    if (candidate) {
      sentences.push(candidate);
    }
    start = boundaryIdx + 1;
    while (start < normalized.length && /\s/.test(normalized[start]!)) {
      start += 1;
    }
    i = boundaryIdx;
  }

  const tail = normalized.slice(start).trim();
  if (tail) {
    sentences.push(tail);
  }

  return sentences;
}

function isSentenceCleanEnough(sentence: string): boolean {
  if (sentence.length < 32 || sentence.length > 220) return false;
  if (!/[.!?]["'”’)\]]?$/.test(sentence)) return false;
  if (!/^[A-ZÇĞİÖŞÜ"'“‘(\[]/.test(sentence)) return false;

  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length < 5 || words.length > 34) return false;

  // Reject ALL-CAPS headings or banners
  const letters = sentence.replace(/[^a-zA-ZçğıİöşüÇĞÖŞÜ]/g, '');
  if (letters.length < 18) return false;
  const upperLetters = letters.replace(/[^A-ZÇĞİÖŞÜ]/g, '');
  if (upperLetters.length / letters.length > 0.65) return false;

  // Reject statistical/table rows, metric summaries, and number-heavy lines (0 AI tokens used)
  const digits = sentence.replace(/\D/g, '');
  if (digits.length / sentence.length > 0.12) return false;
  const numberGroups = sentence.match(/\d+(?:[.,]\d+)?/g) ?? [];
  if (numberGroups.length > 2) return false;
  if (sentence.includes(':') && digits.length > 0) return false;
  if (METRIC_DATA_NOISE_RE.test(sentence)) return false;

  if (CODE_OR_URL_RE.test(sentence)) return false;
  if (BOILERPLATE_NOISE_RE.test(sentence)) return false;

  return true;
}

/** Normalize a sentence into a canonical key for deduplicating previously asked page sentences. */
export function normalizePageSentenceKey(sentence: string): string {
  return sentence.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export interface PageSentenceSelectionOptions {
  /** Randomize order within the top-scoring band so repeated visits pick varied sentences. */
  diversify?: boolean;
  /** Optional RNG override for deterministic testing. */
  randomFn?: () => number;
}

/**
 * Extract, language-match, and rank candidate sentences from scraped DOM blocks
 * using zero AI tokens. Majority page language governs which sentences are picked:
 * - Majority Turkish page -> pick Turkish sentences -> ask user for English (`tr-to-en`)
 * - Majority English page -> pick English sentences -> ask user for Turkish (`en-to-tr`)
 */
export function selectPageSentenceCandidates(
  blocks: ReadablePageBlockInput[],
  excludeTexts: Set<string> = new Set(),
  maxCandidates: number = 12,
  options: PageSentenceSelectionOptions = {}
): {
  pageLang: PageLanguage;
  direction: PageTranslationDirection;
  candidates: PageSentenceCandidate[];
} {
  const combinedText = blocks.map((b) => b.text).join('\n');
  const pageLangInfo = detectTextLanguage(combinedText);
  const pageLang: PageLanguage = pageLangInfo.lang;
  const direction: PageTranslationDirection = pageLang === 'tr' ? 'tr-to-en' : 'en-to-tr';

  const seen = new Set<string>(
    Array.from(excludeTexts, (s) => normalizePageSentenceKey(s)).filter(Boolean)
  );
  const scored: PageSentenceCandidate[] = [];

  for (const block of blocks) {
    const sentences = splitBlockIntoSentences(block.text);
    for (const rawSentence of sentences) {
      const cleaned = stripLeadingBullets(
        rawSentence.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim()
      );
      const key = normalizePageSentenceKey(cleaned);
      if (seen.has(key)) continue;
      if (!isSentenceCleanEnough(cleaned)) continue;

      const langCheck = detectTextLanguage(cleaned);
      // On mixed-language pages, ensure the chosen sentence genuinely matches majority language
      if (langCheck.lang !== pageLang) continue;
      if (pageLang === 'tr' && langCheck.trScore < 3) continue;
      if (pageLang === 'en' && langCheck.enScore < 2.5) continue;

      seen.add(key);

      const wordCount = cleaned.split(/\s+/).length;
      let score = block.tagPriority * 10;
      if (block.inViewport) score += 25;
      // Sweet spot for a pleasant translation challenge: 7 to 18 words
      if (wordCount >= 7 && wordCount <= 18) score += 15;
      else if (wordCount <= 24) score += 6;

      // Boost strongly monolingual sentences over code-switched lines
      if (pageLang === 'tr') {
        score += Math.min(18, langCheck.trScore - langCheck.enScore);
      } else {
        score += Math.min(18, langCheck.enScore - langCheck.trScore);
      }

      scored.push({
        id: `b${block.blockIndex}_${scored.length}`,
        blockIndex: block.blockIndex,
        text: cleaned,
        lang: pageLang,
        score,
      });
    }
  }

  if (options.diversify && scored.length > 1) {
    const rand = options.randomFn ?? Math.random;
    // Sort first to isolate the strongest candidates, then add bounded score jitter for variety.
    scored.sort((a, b) => b.score - a.score);
    const pool = scored.slice(0, Math.max(maxCandidates * 2, 16)).map((item) => ({
      item,
      jittered: item.score + (rand() * 28 - 14),
    }));
    pool.sort((a, b) => b.jittered - a.jittered);
    return {
      pageLang,
      direction,
      candidates: pool.slice(0, maxCandidates).map((p) => p.item),
    };
  }

  scored.sort((a, b) => b.score - a.score);
  return {
    pageLang,
    direction,
    candidates: scored.slice(0, maxCandidates),
  };
}
