export interface BilingualTtsSegment {
  lang: 'tr' | 'en';
  text: string;
  /** Range `[startWordIdx, endWordIdx)` of whitespace tokens in the displayed text covered by this segment. */
  startWordIdx: number;
  endWordIdx: number;
}

const TURKISH_ONLY_CHARS_RE = /[ğüşöçıİĞÜŞÖÇ]/;
const COMMON_TURKISH_ASCII_WORDS = new Set([
  've', 'veya', 'ile', 'ama', 'fakat', 'ancak', 'gibi', 'icin', 'olarak', 'burada', 'orada',
  'bu', 'su', 'bir', 'cok', 'daha', 'en', 'her', 'hic', 'var', 'yok', 'degil', 'zaman',
  'cumle', 'kelime', 'fiil', 'ozne', 'gecmis', 'simdi', 'gelecek', 'tekil', 'cogul', 'olumsuz',
  'soru', 'ornek', 'mesela', 'yani', 'kural', 'anlam', 'anlami', 'anlamina', 'hayir', 'evet', 'tamam', 'yerine',
  'gidelim', 'yapalim', 'edelim', 'olur', 'oldu', 'isim', 'sifat', 'zarf', 'hal', 'hali',
  'fincan', 'kahve', 'bardak', 'cay', 'yemek', 'ev', 'okul', 'masa', 'kitap', 'kalem', 'gun',
  'arka', 'geri', 'on', 'yan', 'ust', 'alt', 'ic', 'dis', 'araba', 'arac', 'ayna', 'aynasi',
  'kavram', 'terim', 'ifade', 'kadar', 'sonra', 'once', 'beraber', 'birlikte', 'esliginde',
  'durum', 'olay', 'kisi', 'insan', 'cocuk', 'kiz', 'erkek', 'kadin', 'adam', 'arkadas',
  'baba', 'anne', 'kardes', 'abi', 'abla', 'bebek', 'es', 'koca', 'kari', 'aile', 'oda',
  'kapi', 'pencere', 'duvar', 'yatak', 'koltuk', 'sandalye', 'bahce', 'sokak', 'cadde', 'sehir',
  'ulke', 'dunya', 'hava', 'deniz', 'yol', 'tren', 'ucak', 'otobus', 'bilet', 'para', 'fiyat',
  'hesap', 'kart', 'telefon', 'bilgisayar', 'ekran', 'oyun', 'film', 'muzik', 'ses', 'resim',
  'renk', 'beyaz', 'siyah', 'kirmizi', 'mavi', 'yesil', 'sari', 'uzun', 'kisa', 'yeni', 'eski',
  'buyuk', 'kucuk', 'guzel', 'iyi', 'kotu', 'kolay', 'zor', 'hizli', 'yavas', 'sicak', 'soguk',
  'temiz', 'kirli', 'dolu', 'bos', 'acik', 'kapali', 'dogru', 'yanlis', 'fark', 'farkli', 'ayni',
  'tane', 'parca', 'kisim', 'taraf', 'yon', 'sekil', 'bicim', 'tur', 'cesit', 'miktar', 'sayi',
]);

const TURKISH_ASCII_SUFFIX_RE =
  /(?:lar|ler|dan|den|tan|ten|nda|nde|nin|nun|mak|mek|iyor|acak|ecek|dir|dur|tir|tur|lik|luk|siz|suz|살)$/i;

function isLikelyTurkishAsciiToken(word: string): boolean {
  const low = word.toLowerCase();
  if (COMMON_TURKISH_ASCII_WORDS.has(low)) return true;
  if (low.length >= 6 && TURKISH_ASCII_SUFFIX_RE.test(low) && !/[wxq]/i.test(low)) return true;
  return false;
}

function normalizeMarkupQuotes(input: string): string {
  return input
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // Normalize accidental `"[[word]]"` or `'[[word]]'` into clean `[[word]]`
    .replace(/["'`]\s*\[\[([^\[\]\n]{1,140})\]\]\s*["'`]/g, '[[$1]]')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert hidden AI language markers (`[[a cup of]]`) into clean quoted display text (`"a cup of"`)
 * so learners never see raw technical tags while preserving exact whitespace token alignment.
 */
export function stripCoachMarkupForDisplay(input: string): string {
  return normalizeMarkupQuotes(input)
    .replace(/\[\[([^\[\]\n]{1,140})\]\]/g, (_, inner: string) => `"${inner.trim()}"`)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Automatically wrap any quoted English words/phrases (`"Rear"`, `"view"`, `'rear-view mirror'`)
 * inside `[[...]]` using the known English tokens from `sentenceEn`, `focusPhrase`, and `examples`,
 * while leaving Turkish quoted phrases (`'geri aynası'`, `'arka'`, `"bir fincan kahve"`) untouched.
 */
export function autoTagEnglishQuotesForCoach(
  explanationTr: string,
  englishContextTexts: string[] = []
): string {
  const normalized = normalizeMarkupQuotes(explanationTr);
  if (!normalized) return '';

  const contextWords = new Set<string>();
  for (const txt of englishContextTexts) {
    const tokens = txt
      .toLowerCase()
      .replace(/[^a-z0-9'\-\s]/g, ' ')
      .split(/[\s\-]+/)
      .filter(Boolean);
    for (const tok of tokens) {
      contextWords.add(tok);
    }
  }

  return normalized.replace(
    /(?<!\[)"([^"\[\]\n]{1,120})"(?!\])|(?<=^|[\s(,;:])'([A-Za-z][A-Za-z0-9\s\-']{0,80}[A-Za-z0-9])'(?=$|[\s.,;:!?)])/g,
    (fullMatch, dblInner?: string, sglInner?: string) => {
      const inner = (dblInner ?? sglInner ?? '').trim();
      if (!inner || TURKISH_ONLY_CHARS_RE.test(inner)) return fullMatch;

      const words = inner
        .toLowerCase()
        .replace(/[^a-z'\-\s]/g, ' ')
        .split(/[\s\-]+/)
        .filter(Boolean);
      if (words.length === 0) return fullMatch;
      if (words.every((w) => isLikelyTurkishAsciiToken(w))) return fullMatch;

      const matchesContext = words.some((w) => contextWords.has(w));
      if (matchesContext || looksEnglishQuotedSegment(inner)) {
        return `[[${inner}]]`;
      }
      return fullMatch;
    }
  );
}

function looksEnglishQuotedSegment(raw: string): boolean {
  const cleaned = raw.trim();
  if (!cleaned || !/[A-Za-z]/.test(cleaned)) return false;
  if (TURKISH_ONLY_CHARS_RE.test(cleaned)) return false;

  const words = cleaned
    .toLowerCase()
    .replace(/[^a-z'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return false;
  if (words.every((w) => isLikelyTurkishAsciiToken(w))) return false;
  return true;
}

/**
 * Split an AI coaching explanation into alternating Turkish (`tr` -> EMA Lightning 48 kHz)
 * and English (`en` -> HFC Female) segments with exact whitespace word index ranges
 * aligned to `stripCoachMarkupForDisplay(input)`.
 *
 * When hidden `[[...]]` markers are present (preferred AI output), ONLY `[[...]]` spans
 * route to the English voice — quoted Turkish words like `"bir fincan kahve"` stay 100% Turkish!
 */
export function splitBilingualCoachSegments(input: string): BilingualTtsSegment[] {
  const raw = autoTagEnglishQuotesForCoach(input);
  if (!raw) return [];

  const hasExplicitTags = /\[\[[^\[\]\n]{1,140}\]\]/.test(raw);
  const display = stripCoachMarkupForDisplay(raw);

  // Build token offsets in `display` for karaoke sync
  const tokenOffsets: Array<{ start: number; end: number }> = [];
  const tokRe = /\S+/g;
  let tm: RegExpExecArray | null;
  while ((tm = tokRe.exec(display)) !== null) {
    tokenOffsets.push({ start: tm.index, end: tm.index + tm[0].length });
  }

  const charRangeToWords = (charStart: number, charEnd: number): [number, number] => {
    let first = -1;
    let last = -1;
    for (let i = 0; i < tokenOffsets.length; i += 1) {
      const tok = tokenOffsets[i]!;
      if (tok.end > charStart && tok.start < charEnd) {
        if (first < 0) first = i;
        last = i + 1;
      }
    }
    return first >= 0 ? [first, last] : [0, 0];
  };

  const segments: BilingualTtsSegment[] = [];
  const pushSegment = (lang: 'tr' | 'en', rawText: string, displayStart: number, displayEnd: number): void => {
    const cleaned = rawText
      .replace(/^[\s"'`.,;:!?]+|[\s"'`]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned || !/[A-Za-z0-9ğüşöçıİĞÜŞÖÇ]/.test(cleaned)) return;
    const [wStart, wEnd] = charRangeToWords(displayStart, displayEnd);
    const prev = segments[segments.length - 1];
    if (prev && prev.lang === lang) {
      prev.text = `${prev.text} ${cleaned}`;
      if (wEnd > prev.endWordIdx) prev.endWordIdx = wEnd;
    } else {
      segments.push({ lang, text: cleaned, startWordIdx: wStart, endWordIdx: wEnd });
    }
  };

  if (hasExplicitTags) {
    // 100% deterministic mode: ONLY `[[...]]` spans route to English TTS; all Turkish quotes stay on EMA!
    const tagRe = /\[\[([^\[\]\n]{1,140})\]\]/g;
    let lastRawIdx = 0;
    let displayCursor = 0;
    let m: RegExpExecArray | null;

    while ((m = tagRe.exec(raw)) !== null) {
      if (m.index > lastRawIdx) {
        const trSlice = raw.slice(lastRawIdx, m.index);
        const dispEnd = displayCursor + trSlice.length;
        pushSegment('tr', trSlice, displayCursor, dispEnd);
        displayCursor = dispEnd;
      }
      const enInner = m[1]!.trim();
      const dispQuotedLen = enInner.length + 2; // `"..."` in display text
      const dispEnd = displayCursor + dispQuotedLen;
      if (enInner) {
        // Safety guard: even inside `[[...]]`, if it has Turkish-only letters, keep on EMA
        const targetLang = TURKISH_ONLY_CHARS_RE.test(enInner) ? 'tr' : 'en';
        pushSegment(targetLang, enInner, displayCursor, dispEnd);
      }
      displayCursor = dispEnd;
      lastRawIdx = m.index + m[0].length;
    }

    if (lastRawIdx < raw.length) {
      const tail = raw.slice(lastRawIdx);
      pushSegment('tr', tail, displayCursor, displayCursor + tail.length);
    }
    return segments;
  }

  // Legacy fallback (when no `[[...]]` tags are present)
  const quoteRe =
    /"([^"\n]{1,140})"|`([^`\n]{1,140})`|(?<=^|[\s(,;:])'([A-Za-z][A-Za-z0-9\s\-']{0,80}[A-Za-z0-9])'(?=$|[\s.,;:!?)])/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = quoteRe.exec(display)) !== null) {
    if (m.index > lastIdx) {
      pushSegment('tr', display.slice(lastIdx, m.index), lastIdx, m.index);
    }
    const quoted = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    const matchEnd = m.index + m[0].length;
    if (quoted) {
      pushSegment(looksEnglishQuotedSegment(quoted) ? 'en' : 'tr', quoted, m.index, matchEnd);
    }
    lastIdx = matchEnd;
  }

  if (lastIdx < display.length) {
    pushSegment('tr', display.slice(lastIdx), lastIdx, display.length);
  }

  return segments;
}
