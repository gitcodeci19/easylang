/**
 * Pure-TypeScript American-English Misaki G2P engine for `mesm-tts` (`Heart` v2g).
 *
 * Adapted from `mesmertech/mesm-tts` `misaki_lite.mjs` (Apache-2.0, ported from `hexgrad/misaki`)
 * with `-ied` stemming, diacritic folding, compound splitting, and a compact rule-based English
 * grapheme-to-Misaki fallback so zero `espeak-ng` WASM/data blobs are required at runtime.
 */

const STRESSES = 'ˌˈ';
const PRIMARY = 'ˈ';
const SECONDARY = 'ˌ';
const VOWELS = new Set('AIOQWYaiuæɑɒɔəɛɜɪʊʌᵻ');
const CONSONANTS = new Set('bdfhjklmnpstvwzðŋɡɹɾʃʒʤʧθ');
const US_TAUS = new Set('AIOWYiuæɑəɛɪɹʊʌ');
const PUNCTS = new Set(';:,.!?—…"“”');
const NON_QUOTE_PUNCTS = new Set(';:,.!?—…');
const DIPHTHONGS = new Set('AIOQWYʤʧ');
const SUBTOKEN_JUNKS = new Set("',-._‘’/");
const SYMBOLS: Readonly<Record<string, string>> = {
  '%': 'percent',
  '&': 'and',
  '+': 'plus',
  '@': 'at',
};
const CURRENCIES: Readonly<Record<string, readonly [string, string]>> = {
  $: ['dollar', 'cent'],
  '£': ['pound', 'pence'],
  '€': ['euro', 'cent'],
};
const ORDINALS = ['st', 'nd', 'rd', 'th'] as const;
const SUBTOKEN_RE =
  /^['‘’]+|\p{Lu}(?=\p{Lu}\p{Ll})|(?:^-)?(?:\d?[,.]?\d)+|[-_]+|['‘’]{2,}|\p{L}*?(?:['‘’]\p{L})*?\p{Ll}(?=\p{Lu})|\p{L}+(?:['‘’]\p{L})*|[^-_\p{L}'‘’\d]|['‘’]+$/gu;
const ABBREVS = new Set(
  (
    'Adm Ala Apr Ariz Ark Aug Bros Calif Capt Cmdr Co Col Colo Conn Corp Dec Del Dr Feb Fla Ft Ga Gen Gov Ill Inc Ind ' +
    'Jan Jr Jul Jun Kan Kans Ky La Lt Ltd Mar Mass Md Messrs Mfg Mich Minn Miss Mo Mont Mr Mrs Ms Mt Neb Nebr Nev Nov Oct Okla Ore Pa ' +
    'Ph Prof Rep Rev Sen Sep Sept Sgt Sr St Tenn Va Wash Wis co vs etc'
  ).split(' ')
);

type LexEntry = string | Record<string, string | null>;

interface TokenContext {
  futureVowel: boolean | null;
  futureTo: boolean;
  nextIsWord: boolean;
}

interface PunctToken {
  punct: true;
  text: string;
  ps: string;
  currency?: string;
  ws: string;
}

interface WordGroupToken {
  punct?: false;
  subs: string[];
  ps?: string;
  currency?: string;
  ws: string;
}

type G2pToken = PunctToken | WordGroupToken;

export interface MisakiG2pEngine {
  phonemize(text: string): string;
}

/**
 * Sorted front-coded Misaki lexicon searched via binary search.
 */
export class MisakiLexicon {
  private readonly keys: string[];
  private readonly vals: Array<LexEntry>;

  constructor(keys: string[], vals: Array<LexEntry>) {
    this.keys = keys;
    this.vals = vals;
  }

  raw(word: string): LexEntry | undefined {
    const keys = this.keys;
    let lo = 0;
    let hi = keys.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const cur = keys[mid]!;
      if (cur === word) {
        let v = this.vals[mid]!;
        if (typeof v === 'string' && v.charCodeAt(0) === 123) {
          v = JSON.parse(v) as Record<string, string | null>;
          this.vals[mid] = v;
        }
        return v;
      }
      if (cur < word) lo = mid + 1;
      else hi = mid - 1;
    }
    return undefined;
  }

  get(word: string): LexEntry | undefined {
    const v = this.raw(word);
    if (v !== undefined || word.length < 2) return v;
    const lo = word.toLowerCase();
    const cap = word[0]!.toUpperCase() + word.slice(1).toLowerCase();
    if (word === cap && word !== lo) return this.raw(lo);
    if (word === lo && word !== cap) return this.raw(cap);
    return undefined;
  }

  has(word: string): boolean {
    return this.get(word) !== undefined;
  }
}

/**
 * Decode a front-coded `us_gold.fc.txt` / `us_silver.fc.txt` Misaki lexicon into a searchable table.
 */
export function parseMisakiLexicon(text: string): MisakiLexicon {
  const lines = text.split('\n');
  const keys: string[] = [];
  const vals: LexEntry[] = [];
  let prev = '';
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const tabIdx = line.indexOf('\t');
    if (tabIdx < 1) continue;
    const prefixLen = line.charCodeAt(0) - 48;
    const key = (prefixLen > 0 ? prev.slice(0, prefixLen) : '') + line.slice(1, tabIdx);
    const val = line.slice(tabIdx + 1).replace(/\r$/, '');
    keys.push(key);
    vals.push(val);
    prev = key;
  }
  return new MisakiLexicon(keys, vals);
}

const isAlpha = (w: string): boolean => /^\p{L}+$/u.test(w);
const isDigit = (w: string): boolean => /^[0-9]+$/.test(w);
const upper = (w: string): string => w.toUpperCase();
const lower = (w: string): string => w.toLowerCase();
const stripDiacritics = (w: string): string => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function applyStress(ps: string | null, stress: number | null): string | null {
  if (stress == null || ps == null) return ps;
  const restress = (input: string): string => {
    const items: Array<[number, string]> = [...input].map((p, i) => [i, p]);
    const moved: Record<number, number> = {};
    for (let idx = 0; idx < items.length; idx += 1) {
      const [i, p] = items[idx]!;
      if (STRESSES.includes(p)) {
        const nextVowel = items.slice(idx).find(([, ch]) => VOWELS.has(ch));
        if (nextVowel) moved[i] = nextVowel[0] - 0.5;
      }
    }
    for (const [k, target] of Object.entries(moved)) {
      items[Number(k)]![0] = target;
    }
    return items
      .sort((a, b) => a[0] - b[0])
      .map(([, p]) => p)
      .join('');
  };

  if (stress < -1) return ps.replaceAll(PRIMARY, '').replaceAll(SECONDARY, '');
  if (stress === -1 || ((stress === 0 || stress === -0.5) && ps.includes(PRIMARY))) {
    return ps.replaceAll(SECONDARY, '').replaceAll(PRIMARY, SECONDARY);
  }
  const hasStress = [...STRESSES].some((s) => ps.includes(s));
  const hasVowel = [...ps].some((c) => VOWELS.has(c));
  if ((stress === 0 || stress === 0.5 || stress === 1) && !hasStress) {
    return hasVowel ? restress(SECONDARY + ps) : ps;
  }
  if (stress >= 1 && !ps.includes(PRIMARY) && ps.includes(SECONDARY)) {
    return ps.replaceAll(SECONDARY, PRIMARY);
  }
  if (stress > 1 && !hasStress) {
    return hasVowel ? restress(PRIMARY + ps) : ps;
  }
  return ps;
}

function stressWeight(ps: string | null): number {
  if (!ps) return 0;
  let total = 0;
  for (const c of ps) total += DIPHTHONGS.has(c) ? 2 : 1;
  return total;
}

const ONES =
  'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(
    ' '
  );
const TENS = ',,twenty,thirty,forty,fifty,sixty,seventy,eighty,ninety'.split(',');
const SCALES: ReadonlyArray<readonly [number, string]> = [
  [1e12, 'trillion'],
  [1e9, 'billion'],
  [1e6, 'million'],
  [1e3, 'thousand'],
];

function cardinal(n: number): string[] {
  if (n < 20) return [ONES[n] ?? 'zero'];
  if (n < 100) {
    const tens = TENS[Math.floor(n / 10)] ?? '';
    return n % 10 ? [tens, ONES[n % 10]!] : [tens];
  }
  if (n < 1000) {
    return [ONES[Math.floor(n / 100)]!, 'hundred', ...(n % 100 ? cardinal(n % 100) : [])];
  }
  if (n < 1e15) {
    for (const [val, label] of SCALES) {
      if (n >= val) {
        const hi = Math.floor(n / val);
        const rem = n - hi * val;
        return [...cardinal(hi), label, ...(rem ? cardinal(rem) : [])];
      }
    }
  }
  return [...String(n)].map((d) => ONES[Number(d)] ?? 'zero');
}

function ordinal(n: number): string[] {
  const words = cardinal(n);
  const last = words.pop() ?? '';
  const irregular: Record<string, string> = {
    one: 'first',
    two: 'second',
    three: 'third',
    five: 'fifth',
    eight: 'eighth',
    nine: 'ninth',
    twelve: 'twelfth',
  };
  return [
    ...words,
    irregular[last] ?? (last.endsWith('y') ? `${last.slice(0, -1)}ieth` : `${last}th`),
  ];
}

function yearWords(n: number): string[] {
  const hi = Math.floor(n / 100);
  const lo = n % 100;
  if (hi === 0 || (hi % 10 === 0 && lo < 10) || hi >= 100) return cardinal(n);
  return [
    ...cardinal(hi),
    ...(lo === 0 ? ['hundred'] : lo < 10 ? ['oh', ...cardinal(lo)] : cardinal(lo)),
  ];
}

function isNumberToken(word: string, isHead: boolean): boolean {
  if (![...word].some((c) => c >= '0' && c <= '9')) return false;
  let core = word;
  for (const s of ['ing', "'d", 'ed', "'s", ...ORDINALS, 's']) {
    if (core.endsWith(s)) {
      core = core.slice(0, -s.length);
      break;
    }
  }
  return [...core].every(
    (c, i) => (c >= '0' && c <= '9') || c === ',' || c === '.' || (isHead && i === 0 && c === '-')
  );
}

/**
 * Compact rule-based English grapheme-to-Misaki fallback for rare out-of-vocabulary words
 * (such as uncommon proper names or novel brand names) so zero eSpeak WASM is required.
 */
export function fallbackRuleBasedMisaki(rawWord: string): string {
  const clean = stripDiacritics(rawWord)
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (!clean) return '';

  const len = clean.length;
  let out = '';
  let i = 0;

  while (i < len) {
    const rest = clean.slice(i);
    if (rest.startsWith('tion')) {
      out += 'ʃən';
      i += 4;
      continue;
    }
    if (rest.startsWith('sion')) {
      out += 'ʒən';
      i += 4;
      continue;
    }
    if (rest.startsWith('igh')) {
      out += 'I';
      i += 3;
      continue;
    }
    if (rest.startsWith('tch')) {
      out += 'ʧ';
      i += 3;
      continue;
    }
    if (rest.startsWith('dge')) {
      out += 'ʤ';
      i += 3;
      continue;
    }
    if (rest.startsWith('ck')) {
      out += 'k';
      i += 2;
      continue;
    }
    if (rest.startsWith('sh')) {
      out += 'ʃ';
      i += 2;
      continue;
    }
    if (rest.startsWith('ch')) {
      out += 'ʧ';
      i += 2;
      continue;
    }
    if (rest.startsWith('th')) {
      out += i === 0 && rest.length <= 4 ? 'ð' : 'θ';
      i += 2;
      continue;
    }
    if (rest.startsWith('ph')) {
      out += 'f';
      i += 2;
      continue;
    }
    if (rest.startsWith('wh')) {
      out += 'w';
      i += 2;
      continue;
    }
    if (rest.startsWith('ng')) {
      out += 'ŋ';
      i += 2;
      continue;
    }
    if (rest.startsWith('qu')) {
      out += 'kw';
      i += 2;
      continue;
    }
    if (rest.startsWith('kn') && i === 0) {
      out += 'n';
      i += 2;
      continue;
    }
    if (rest.startsWith('wr') && i === 0) {
      out += 'ɹ';
      i += 2;
      continue;
    }
    if (rest.startsWith('ee') || rest.startsWith('ea')) {
      out += 'i';
      i += 2;
      continue;
    }
    if (rest.startsWith('oo')) {
      out += 'u';
      i += 2;
      continue;
    }
    if (rest.startsWith('ou') || rest.startsWith('ow')) {
      out += 'W';
      i += 2;
      continue;
    }
    if (rest.startsWith('ai') || rest.startsWith('ay')) {
      out += 'A';
      i += 2;
      continue;
    }
    if (rest.startsWith('oi') || rest.startsWith('oy')) {
      out += 'Y';
      i += 2;
      continue;
    }
    if (rest.startsWith('au') || rest.startsWith('aw')) {
      out += 'ɔ';
      i += 2;
      continue;
    }
    if (rest.startsWith('oa')) {
      out += 'O';
      i += 2;
      continue;
    }
    if (rest.startsWith('ie') || rest.startsWith('ei')) {
      out += 'i';
      i += 2;
      continue;
    }
    if (rest.startsWith('er') || rest.startsWith('ir') || rest.startsWith('ur')) {
      out += 'ɜɹ';
      i += 2;
      continue;
    }
    if (rest.startsWith('ar')) {
      out += 'ɑɹ';
      i += 2;
      continue;
    }
    if (rest.startsWith('or')) {
      out += 'ɔɹ';
      i += 2;
      continue;
    }

    const ch = clean[i]!;
    const next = clean[i + 1] ?? '';
    const next2 = clean[i + 2] ?? '';
    // Deduplicate doubled consonants (`tt`, `ll`, `ss`, `nn`)
    if (ch === next && !'aeiou'.includes(ch)) {
      i += 1;
      continue;
    }
    // Magic silent trailing 'e'
    if (ch === 'e' && i === len - 1 && len > 2 && !'aeiou'.includes(clean[i - 1] ?? '')) {
      i += 1;
      continue;
    }
    const isSilentENext =
      i + 2 === len - 1 && next !== '' && !'aeiou'.includes(next) && next2 === 'e';

    switch (ch) {
      case 'a':
        out += isSilentENext ? 'A' : 'æ';
        break;
      case 'e':
        out += isSilentENext ? 'i' : 'ɛ';
        break;
      case 'i':
        out += isSilentENext ? 'I' : 'ɪ';
        break;
      case 'o':
        out += isSilentENext || i === len - 1 ? 'O' : 'ɑ';
        break;
      case 'u':
        out += isSilentENext ? 'ju' : 'ʌ';
        break;
      case 'y':
        out += i === 0 ? 'j' : i === len - 1 ? 'i' : 'ɪ';
        break;
      case 'c':
        out += 'eiy'.includes(next) ? 's' : 'k';
        break;
      case 'g':
        out += 'eiy'.includes(next) ? 'ʤ' : 'ɡ';
        break;
      case 'j':
        out += 'ʤ';
        break;
      case 'q':
        out += 'k';
        break;
      case 'r':
        out += 'ɹ';
        break;
      case 'x':
        out += i === 0 ? 'z' : 'ks';
        break;
      default:
        out += ch;
        break;
    }
    i += 1;
  }

  return applyStress(out, 2) ?? out;
}

const PRE_PUNCT = new Set('"“‘([{$£€');
const POST_PUNCT = new Set('"”)]}.,;:!?…');

function tokenizeText(text: string): G2pToken[] {
  const toks: G2pToken[] = [];
  let quoteOpen = false;
  const pushPunct = (t: string, ps: string) => toks.push({ punct: true, text: t, ps, ws: '' });
  const quoteChar = (open: boolean) => {
    quoteOpen = open;
    return open ? '“' : '”';
  };

  for (const m of text.matchAll(/(\S+)(\s*)/g)) {
    let chunk = m[1]!;
    const tail: Array<[string, string | null]> = [];

    while (chunk && PRE_PUNCT.has(chunk[0]!)) {
      const ch = chunk[0]!;
      if (CURRENCIES[ch]) {
        toks.push({ punct: true, text: ch, ps: '', currency: ch, ws: '' });
      } else {
        const ps =
          ch === '"'
            ? quoteChar(!(quoteOpen && /^"[^\p{L}\d]*$/u.test(chunk)))
            : ch === '“' || ch === '‘'
              ? quoteChar(true)
              : '([{'.includes(ch)
                ? '('
                : '';
        pushPunct(ch, ps);
      }
      chunk = chunk.slice(1);
    }

    while (chunk && POST_PUNCT.has(chunk.at(-1)!)) {
      const last = chunk.at(-1)!;
      if (
        last === '.' &&
        (/^(?:[A-Za-z]{1,2}\.)+[A-Za-z]{1,2}$/.test(chunk.slice(0, -1)) ||
          /^[A-Za-z]$/.test(chunk.slice(0, -1)) ||
          ABBREVS.has(chunk.slice(0, -1)))
      ) {
        break;
      }
      if (last === '.' && chunk.endsWith('...')) {
        tail.unshift(['...', '...']);
        chunk = chunk.slice(0, -3);
        continue;
      }
      const mapped =
        last === '"' || last === '”'
          ? null
          : ')]}'.includes(last)
            ? ')'
            : PUNCTS.has(last)
              ? last
              : '';
      tail.unshift([last, mapped]);
      chunk = chunk.slice(0, -1);
    }

    for (const piece of chunk.split(/(—|–|…|--)/)) {
      if (!piece) continue;
      if (/^(—|–|…|--)$/.test(piece)) {
        pushPunct(piece, piece === '…' ? '…' : '—');
        continue;
      }
      if (piece === '-') {
        pushPunct(piece, '—');
        continue;
      }
      const subs = piece.match(SUBTOKEN_RE) ?? [];
      const prevTok = toks.at(-1);
      let group: WordGroupToken;
      if (prevTok && !prevTok.punct && !prevTok.ws) {
        group = prevTok;
      } else {
        group = { subs: [], ws: '' };
        toks.push(group);
      }
      for (const s of subs) group.subs.push(s);
    }

    for (const [t, ps] of tail) {
      pushPunct(t, ps ?? quoteChar(false));
    }
    if (m[2] && toks.length > 0) {
      toks.at(-1)!.ws = ' ';
    }
  }

  for (let i = 0; i < toks.length; i += 1) {
    const tok = toks[i]!;
    if (tok.punct && tok.currency) {
      let j = i + 1;
      const isNum = (t?: G2pToken): t is WordGroupToken =>
        Boolean(
          t &&
            !t.punct &&
            t.subs.length > 0 &&
            (/\d/.test(t.subs[0]!) ||
              ['hundred', 'thousand', 'million', 'billion', 'trillion'].includes(
                lower(t.subs.join(''))
              ))
        );
      while (isNum(toks[j + 1])) j += 1;
      const target = toks[j];
      if (isNum(target)) target.currency = tok.currency;
    }
  }

  return toks;
}

function nextContext(ctx: TokenContext, ps: string | null, text: string): TokenContext {
  let fv = ctx.futureVowel;
  if (ps) {
    for (const c of ps) {
      if (VOWELS.has(c) || CONSONANTS.has(c) || NON_QUOTE_PUNCTS.has(c)) {
        fv = NON_QUOTE_PUNCTS.has(c) ? null : VOWELS.has(c);
        break;
      }
    }
  }
  return { futureVowel: fv, futureTo: text === 'to' || text === 'To', nextIsWord: false };
}

function resolveGroup(subs: string[], ps: Array<string | null>): string {
  const text = subs.join('');
  const kinds = new Set(
    [...text]
      .filter((c) => !SUBTOKEN_JUNKS.has(c))
      .map((c) => (/\p{L}/u.test(c) ? 0 : /\d/.test(c) ? 1 : 2))
  );
  const prespace = text.includes('/') || kinds.size > 1;
  if (!prespace) {
    const idx = ps
      .map((p, i): [number, number, number] => [p && p.includes(PRIMARY) ? 1 : 0, stressWeight(p), i])
      .filter(([, , i]) => Boolean(ps[i]));
    if (idx.length === 2 && subs[idx[0]![2]]!.length === 1) {
      ps[idx[1]![2]] = applyStress(ps[idx[1]![2]]!, -0.5);
    } else if (
      idx.length >= 2 &&
      idx.reduce((a, [b]) => a + b, 0) > Math.floor((idx.length + 1) / 2)
    ) {
      for (const [, , i] of idx
        .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
        .slice(0, idx.length >> 1)) {
        ps[i] = applyStress(ps[i]!, -0.5);
      }
    }
  }
  let out = '';
  for (let i = 0; i < ps.length; i += 1) {
    const p = ps[i] ?? '';
    if (i > 0 && prespace && out && !/\s$/.test(out) && p) out += ' ';
    out += p;
  }
  return out;
}

/**
 * Create a synchronous Misaki American-English G2P instance backed by `us_gold` + `us_silver`.
 */
export function createMisakiG2p(gold: MisakiLexicon, silver: MisakiLexicon): MisakiG2pEngine {
  const getNNP = (word: string): string | null => {
    const parts = [...word].filter((c) => /\p{L}/u.test(c)).map((c) => gold.get(upper(c)));
    if (parts.length === 0 || parts.some((p) => typeof p !== 'string')) return null;
    const s = applyStress((parts as string[]).join(''), 0) ?? '';
    const k = s.lastIndexOf(SECONDARY);
    return k < 0 ? s : s.slice(0, k) + PRIMARY + s.slice(k + 1);
  };

  const lookup = (word: string, stress: number | null, ctx: TokenContext | null): string | null => {
    let target = word;
    if (target === upper(target) && !gold.has(target)) target = lower(target);
    let rawEntry = gold.get(target) ?? silver.get(target) ?? null;
    let ps: string | null = null;
    if (rawEntry && typeof rawEntry === 'object') {
      if (target === upper(target) && target.length > 1 && 'NOUN' in rawEntry && rawEntry.NOUN == null) {
        ps = null;
      } else {
        ps =
          ctx && ctx.futureVowel == null && 'None' in rawEntry
            ? (rawEntry.None ?? null)
            : (rawEntry.DEFAULT ?? null);
      }
    } else {
      ps = rawEntry;
    }
    if (ps == null) return getNNP(target);
    return applyStress(ps, stress);
  };

  const isKnown = (word: string): boolean => {
    if (gold.has(word) || word in SYMBOLS || silver.has(word)) return true;
    if (!/^[A-Za-z]+$/.test(word)) return false;
    if (word.length === 1) return true;
    if (word === upper(word) && gold.has(lower(word))) return true;
    return word.slice(1) === upper(word.slice(1));
  };

  const addS = (st: string | null): string | null => {
    if (!st) return null;
    const last = st.at(-1) ?? '';
    if ('ptkfθ'.includes(last)) return `${st}s`;
    if ('szʃʒʧʤ'.includes(last)) return `${st}ᵻz`;
    return `${st}z`;
  };

  const stemS = (w: string, stress: number | null, ctx: TokenContext | null): string | null => {
    if (w.length < 3 || !w.endsWith('s')) return null;
    let st: string | undefined;
    if (!w.endsWith('ss') && isKnown(w.slice(0, -1))) {
      st = w.slice(0, -1);
    } else if (
      (w.endsWith("'s") || (w.length > 4 && w.endsWith('es') && !w.endsWith('ies'))) &&
      isKnown(w.slice(0, -2))
    ) {
      st = w.slice(0, -2);
    } else if (w.length > 4 && w.endsWith('ies') && isKnown(`${w.slice(0, -3)}y`)) {
      st = `${w.slice(0, -3)}y`;
    } else {
      return null;
    }
    return addS(lookup(st, stress, ctx));
  };

  const addEd = (st: string | null): string | null => {
    if (!st) return null;
    const last = st.at(-1) ?? '';
    if ('pkfθʃsʧ'.includes(last)) return `${st}t`;
    if (last === 'd') return `${st}ᵻd`;
    if (last !== 't') return `${st}d`;
    if (st.length < 2) return `${st}ɪd`;
    if (US_TAUS.has(st.at(-2) ?? '')) return `${st.slice(0, -1)}ɾᵻd`;
    return `${st}ᵻd`;
  };

  const stemEd = (w: string, stress: number | null, ctx: TokenContext | null): string | null => {
    if (w.length < 4 || !w.endsWith('d')) return null;
    let st: string | undefined;
    if (!w.endsWith('dd') && isKnown(w.slice(0, -1))) {
      st = w.slice(0, -1);
    } else if (w.length > 4 && w.endsWith('ied') && isKnown(`${w.slice(0, -3)}y`)) {
      st = `${w.slice(0, -3)}y`;
    } else if (w.length > 4 && w.endsWith('ed') && !w.endsWith('eed') && isKnown(w.slice(0, -2))) {
      st = w.slice(0, -2);
    } else if (
      w.length > 5 &&
      /([bcdgklmnprstvxz])\1ed$/.test(w) &&
      isKnown(w.slice(0, -3))
    ) {
      st = w.slice(0, -3);
    } else {
      return null;
    }
    return addEd(lookup(st, stress, ctx));
  };

  const addIng = (st: string | null): string | null => {
    if (!st) return null;
    if (st.length > 1 && st.at(-1) === 't' && US_TAUS.has(st.at(-2) ?? '')) {
      return `${st.slice(0, -1)}ɾɪŋ`;
    }
    return `${st}ɪŋ`;
  };

  const stemIng = (w: string, stress: number | null, ctx: TokenContext | null): string | null => {
    if (w.length < 5 || !w.endsWith('ing')) return null;
    let st: string | undefined;
    if (w.length > 5 && isKnown(w.slice(0, -3))) {
      st = w.slice(0, -3);
    } else if (isKnown(`${w.slice(0, -3)}e`)) {
      st = `${w.slice(0, -3)}e`;
    } else if (
      w.length > 5 &&
      /([bcdgklmnprstvxz])\1ing$|cking$/.test(w) &&
      isKnown(w.slice(0, -4))
    ) {
      st = w.slice(0, -4);
    } else {
      return null;
    }
    return addIng(lookup(st, stress, ctx));
  };

  const stemErEst = (w: string, stress: number | null, ctx: TokenContext | null): string | null => {
    if (w.length >= 5 && w.endsWith('er')) {
      const base = /([bcdgklmnprstvxz])\1er$/.test(w) ? w.slice(0, -3) : w.slice(0, -2);
      if (base.length >= 2 && isKnown(base)) {
        const ps = lookup(base, stress, ctx);
        return ps ? `${ps}əɹ` : null;
      }
    }
    if (w.length >= 6 && w.endsWith('est')) {
      const base = /([bcdgklmnprstvxz])\1est$/.test(w) ? w.slice(0, -4) : w.slice(0, -3);
      if (base.length >= 2 && isKnown(base)) {
        const ps = lookup(base, stress, ctx);
        return ps ? `${ps}ᵻst` : null;
      }
    }
    return null;
  };

  const specialCase = (word: string, ctx: TokenContext): string | null => {
    if (word in SYMBOLS) return lookup(SYMBOLS[word]!, null, ctx);
    const parts = word.split('.');
    if (
      word.replace(/^\.+|\.+$/g, '').includes('.') &&
      isAlpha(word.replaceAll('.', '')) &&
      Math.max(...parts.map((p) => p.length)) < 3
    ) {
      return getNNP(word);
    }
    if (word === 'a' || word === 'A') return ctx.nextIsWord ? 'ɐ' : 'ˈA';
    if (word === 'am' || word === 'Am' || word === 'AM') {
      const am = gold.get('am');
      return ctx.futureVowel == null || word !== 'am' ? (typeof am === 'string' ? am : 'æm') : 'ɐm';
    }
    if (word === 'an' || word === 'An' || word === 'AN') return 'ɐn';
    if (word === 'I') return `${SECONDARY}I`;
    if (word === 'to' || word === 'To') {
      const to = gold.get('to');
      return ctx.futureVowel == null
        ? typeof to === 'string'
          ? to
          : 'tu'
        : ctx.futureVowel
          ? 'tʊ'
          : 'tə';
    }
    if (word === 'in' || word === 'In' || word === 'IN') {
      return `${ctx.futureVowel == null ? PRIMARY : ''}ɪn`;
    }
    if (word === 'the' || word === 'The' || word === 'THE') {
      return ctx.futureVowel === true ? 'ði' : 'ðə';
    }
    if (/^vs\.?$/i.test(word)) return lookup('versus', null, ctx);
    if (word === 'used' || word === 'Used' || word === 'USED') {
      const used = gold.get('used');
      return used && typeof used === 'object' ? (used.DEFAULT ?? null) : (used ?? null);
    }
    return null;
  };

  const getWord = (word: string, stress: number | null, ctx: TokenContext): string | null => {
    const sc = specialCase(word, ctx);
    if (sc != null) return sc;
    let w = word;
    const wl = lower(w);
    if (
      w.length > 1 &&
      isAlpha(w.replaceAll("'", '')) &&
      w !== wl &&
      !gold.has(w) &&
      !silver.has(w) &&
      (w === upper(w) || w.slice(1) === lower(w.slice(1))) &&
      (gold.has(wl) ||
        silver.has(wl) ||
        stemS(wl, stress, ctx) ||
        stemEd(wl, stress, ctx) ||
        stemIng(wl, stress, ctx) ||
        stemErEst(wl, stress, ctx))
    ) {
      w = wl;
    }
    if (isKnown(w)) return lookup(w, stress, ctx);
    if (w.endsWith("s'") && isKnown(`${w.slice(0, -2)}'s`)) return lookup(`${w.slice(0, -2)}'s`, stress, ctx);
    if (w.endsWith("'") && isKnown(w.slice(0, -1))) return lookup(w.slice(0, -1), stress, ctx);
    const stemmed =
      stemS(w, stress, ctx) ??
      stemEd(w, stress, ctx) ??
      stemIng(w, stress == null ? 0.5 : stress, ctx) ??
      stemErEst(w, stress, ctx);
    if (stemmed != null) return stemmed;

    // Diacritic folding (e.g. "café" -> "cafe")
    const folded = stripDiacritics(wl);
    if (folded !== wl && folded.length > 0 && isKnown(folded)) {
      return lookup(folded, stress, ctx);
    }

    // Simple 2-part compound split (e.g. "webpages", "seatbelts", "lawnmower")
    if (/^[a-z]{6,}$/.test(folded)) {
      for (let cut = 3; cut <= folded.length - 3; cut += 1) {
        const leftPart = folded.slice(0, cut);
        const rightPart = folded.slice(cut);
        if (isKnown(leftPart)) {
          const rightPs = isKnown(rightPart) ? lookup(rightPart, -0.5, ctx) : stemS(rightPart, -0.5, ctx);
          if (rightPs) {
            const leftPs = lookup(leftPart, stress, ctx);
            if (leftPs) return `${leftPs}${rightPs}`;
          }
        }
      }
    }

    return null;
  };

  const getNumber = (word: string, currency: string | undefined, isHead: boolean): string | null => {
    const m = /[a-z']+$/.exec(word);
    const suffix = m ? m[0] : null;
    let body = suffix ? word.slice(0, -suffix.length) : word;
    const res: Array<string | null> = [];
    if (body.startsWith('-')) {
      res.push(lookup('minus', null, null));
      body = body.slice(1);
    }
    const ext = (ws: string[], stress?: number | null) => {
      for (const item of ws) {
        res.push(lookup(item, item === 'point' ? -2 : (stress ?? null), null));
      }
    };
    const digitsOf = (s: string) => {
      for (const d of s) ext(cardinal(Number(d)));
    };
    const isOrd = suffix != null && (ORDINALS as readonly string[]).includes(suffix);

    if (isDigit(body) && isOrd) {
      ext(ordinal(Number(body)));
    } else if (res.length === 0 && body.length === 4 && !currency && isDigit(body)) {
      ext(yearWords(Number(body)));
    } else if (!isHead && !body.includes('.')) {
      const num = body.replaceAll(',', '');
      if (num[0] === '0' || num.length > 3) digitsOf(num);
      else if (num.length === 3 && !num.endsWith('00')) {
        ext(cardinal(Number(num[0])));
        if (num[1] === '0') {
          res.push(lookup('O', -2, null));
          ext(cardinal(Number(num[2])));
        } else {
          ext(cardinal(Number(num.slice(1))));
        }
      } else {
        ext(cardinal(Number(num)));
      }
    } else if ((body.match(/\./g) ?? []).length > 1 || !isHead) {
      for (const num of body.replaceAll(',', '').split('.')) {
        if (!num) continue;
        if (num[0] === '0' || (num.length !== 2 && [...num.slice(1)].some((d) => d !== '0'))) {
          digitsOf(num);
        } else {
          ext(cardinal(Number(num)));
        }
      }
    } else if (currency && CURRENCIES[currency] && (!body.includes('.') || (body.split('.')[1]?.length ?? 0) < 3)) {
      const units = CURRENCIES[currency]!;
      let pairs = body
        .replaceAll(',', '')
        .split('.')
        .map((n, i): [number, string | undefined] => [n ? Number(n) : 0, units[i]])
        .filter((pair): pair is [number, string] => Boolean(pair[1]));
      if (pairs.length > 1) {
        if (pairs[1]![0] === 0) pairs = pairs.slice(0, 1);
        else if (pairs[0]![0] === 0) pairs = pairs.slice(1);
      }
      pairs.forEach(([n, unit], i) => {
        if (i > 0) res.push(lookup('and', null, null));
        ext(cardinal(n));
        res.push(
          Math.abs(n) !== 1 && unit !== 'pence' ? stemS(`${unit}s`, null, null) : lookup(unit, null, null)
        );
      });
    } else if (!body.includes('.')) {
      const n = Number(body.replaceAll(',', ''));
      ext(isOrd ? ordinal(n) : cardinal(n));
    } else {
      const [ip = '0', fp = '0'] = String(parseFloat(body.replaceAll(',', ''))).split('.');
      const fracDigits = [...(body[0] === '.' ? body.slice(1) : fp)].flatMap((d) => cardinal(Number(d)));
      ext([...(body[0] === '.' ? [] : cardinal(Number(ip))), 'point', ...fracDigits]);
    }

    if (res.length === 0 || res.some((p) => p == null)) return null;
    const joined = (res as string[]).join(' ');
    if (suffix === 's' || suffix === "'s") return addS(joined);
    if (suffix === 'ed' || suffix === "'d") return addEd(joined);
    if (suffix === 'ing') return addIng(joined);
    return joined;
  };

  const resolveLexicon = (
    text: string,
    isHead: boolean,
    currency: string | undefined,
    ctx: TokenContext
  ): string | null => {
    const w = text.replaceAll('‘', "'").replaceAll('’', "'").normalize('NFKC');
    const stress = w === lower(w) ? null : w === upper(w) ? 2 : 0.5;
    const ps = getWord(w, stress, ctx);
    if (ps != null) {
      if (currency && CURRENCIES[currency]) {
        const unitPlural = stemS(`${CURRENCIES[currency]![0]}s`, null, null);
        return unitPlural ? `${ps} ${unitPlural}` : ps;
      }
      return ps;
    }
    if (isNumberToken(w, isHead)) return getNumber(w, currency, isHead);
    return null;
  };

  const resolveOovWord = (raw: string, ctx: TokenContext): string => {
    // Handle possessive OOV names (e.g. "Fiona's", "Beethoven's") cleanly
    if (raw.endsWith("'s") && raw.length > 3) {
      const base = raw.slice(0, -2);
      const basePs = resolveLexicon(base, true, undefined, ctx) ?? fallbackRuleBasedMisaki(base);
      return addS(basePs) ?? basePs;
    }
    return fallbackRuleBasedMisaki(raw);
  };

  return {
    phonemize(text: string): string {
      const cleaned = text.replace(/\s+/g, ' ').trim();
      if (!cleaned) return '';
      const toks = tokenizeText(cleaned);
      let ctx: TokenContext = { futureVowel: null, futureTo: false, nextIsWord: false };

      for (let i = toks.length - 1; i >= 0; i -= 1) {
        const t = toks[i]!;
        if (t.punct) {
          ctx = { ...nextContext(ctx, t.ps, t.text), nextIsWord: false };
          continue;
        }
        const subs = t.subs;
        const ps: Array<string | null> = subs.map(() => null);
        let left = 0;
        let right = subs.length;
        let fallback = false;

        while (left < right) {
          const merged = subs.slice(left, right).join('');
          const p = resolveLexicon(merged, left === 0, right === subs.length ? t.currency : undefined, ctx);
          if (p != null) {
            ps[left] = p;
            for (let k = left + 1; k < right; k += 1) ps[k] = '';
            ctx = { ...nextContext(ctx, p, merged), nextIsWord: true };
            right = left;
            left = 0;
          } else if (left + 1 < right) {
            left += 1;
          } else {
            right -= 1;
            if (ps[right] == null) {
              if ([...subs[right]!].every((c) => SUBTOKEN_JUNKS.has(c))) {
                ps[right] = '';
              } else {
                fallback = true;
                break;
              }
            }
            left = 0;
          }
        }

        if (fallback) {
          const oovPs = resolveOovWord(subs.join(''), ctx);
          t.ps = oovPs;
          ctx = { ...nextContext(ctx, oovPs, subs.join('')), nextIsWord: true };
        } else {
          t.ps = subs.length === 1 ? (ps[0] ?? '') : resolveGroup(subs, ps);
        }
      }

      return toks
        .map((t) => (t.ps ?? '') + t.ws)
        .join('')
        .trim()
        .replaceAll('ɾ', 'T')
        .replaceAll('ʔ', 't');
    },
  };
}
