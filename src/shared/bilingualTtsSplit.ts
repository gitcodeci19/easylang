export interface BilingualTtsSegment {
  lang: 'tr' | 'en';
  text: string;
  /** Range `[startWordIdx, endWordIdx)` of whitespace tokens in the original display text covered by this segment. */
  startWordIdx: number;
  endWordIdx: number;
}

const TURKISH_ONLY_CHARS_RE = /[ğüşöçıİĞÜŞÖÇ]/;
const COMMON_TURKISH_ASCII_WORDS = new Set([
  've', 'veya', 'ile', 'ama', 'fakat', 'ancak', 'gibi', 'icin', 'olarak', 'burada', 'orada',
  'bu', 'su', 'bir', 'cok', 'daha', 'en', 'her', 'hic', 'var', 'yok', 'degil', 'zaman',
  'cumle', 'kelime', 'fiil', 'ozne', 'gecmis', 'simdi', 'gelecek', 'tekil', 'cogul', 'olumsuz',
  'soru', 'ornek', 'mesela', 'yani', 'kural', 'anlam', 'hayir', 'evet', 'tamam', 'yerine',
  'gidelim', 'yapalim', 'edelim', 'olur', 'oldu', 'isim', 'sifat', 'zarf', 'hal', 'hali',
]);

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
  if (words.every((w) => COMMON_TURKISH_ASCII_WORDS.has(w))) return false;
  return true;
}

/**
 * Split a Turkish AI coaching paragraph containing quoted English words/phrases
 * (`"was"`, `"Let's go"`, `'instead of'`, `` `should` ``) into alternating
 * Turkish (`tr` -> EMA Lightning) and English (`en` -> HFC Female) segments,
 * tracking exact whitespace word index ranges for millisecond karaoke sync.
 */
export function splitBilingualCoachSegments(input: string): BilingualTtsSegment[] {
  const normalized = input
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return [];

  // Pre-compute character offsets of each whitespace token in `normalized`
  const tokenOffsets: Array<{ start: number; end: number }> = [];
  const tokRe = /\S+/g;
  let tm: RegExpExecArray | null;
  while ((tm = tokRe.exec(normalized)) !== null) {
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
  const pushSegment = (lang: 'tr' | 'en', rawText: string, charStart: number, charEnd: number): void => {
    const cleaned = rawText
      .replace(/^[\s"'`.,;:!?]+|[\s"'`]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned || !/[A-Za-z0-9ğüşöçıİĞÜŞÖÇ]/.test(cleaned)) return;
    const [wStart, wEnd] = charRangeToWords(charStart, charEnd);
    const prev = segments[segments.length - 1];
    if (prev && prev.lang === lang) {
      prev.text = `${prev.text} ${cleaned}`;
      if (wEnd > prev.endWordIdx) prev.endWordIdx = wEnd;
    } else {
      segments.push({ lang, text: cleaned, startWordIdx: wStart, endWordIdx: wEnd });
    }
  };

  // Match "...", `...`, or single-quoted English spans bounded by whitespace/punctuation (allows inner contractions like 'Let's go')
  const quoteRe =
    /"([^"\n]{1,140})"|`([^`\n]{1,140})`|(?<=^|[\s(,;:])'([A-Za-z][A-Za-z0-9\s\-']{0,80}[A-Za-z0-9])'(?=$|[\s.,;:!?)])/g;

  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = quoteRe.exec(normalized)) !== null) {
    if (m.index > lastIdx) {
      pushSegment('tr', normalized.slice(lastIdx, m.index), lastIdx, m.index);
    }
    const quoted = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    const matchEnd = m.index + m[0].length;
    if (quoted) {
      pushSegment(looksEnglishQuotedSegment(quoted) ? 'en' : 'tr', quoted, m.index, matchEnd);
    }
    lastIdx = matchEnd;
  }

  if (lastIdx < normalized.length) {
    pushSegment('tr', normalized.slice(lastIdx), lastIdx, normalized.length);
  }

  return segments;
}
