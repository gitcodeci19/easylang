const ONES_TR = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const TENS_TR = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
const ORDINALS_TR: Record<number, string> = {
  1: 'birinci',
  2: 'ikinci',
  3: 'üçüncü',
  4: 'dördüncü',
  5: 'beşinci',
  6: 'altıncı',
  7: 'yedinci',
  8: 'sekizinci',
  9: 'dokuzuncu',
  10: 'onuncu',
};

const TURKISH_SPECIAL = new Set(['ç', 'ğ', 'ı', 'ö', 'ş', 'ü']);
const MAX_WORD_FRAMES = 250;
const MAX_FRAMES = 3000;
const LETTERS_PER_SECOND = 18.0;
const MAX_SECONDS = 10.0;
const MAX_LETTERS = 250;
const SENTENCE_PAUSE = 0.25;
const CLAUSE_PAUSE = 0.12;

/** Convert a non-negative integer (0..999,999) into natural spoken Turkish words. */
export function turkishIntToWords(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '';
  const int = Math.floor(n);
  if (int === 0) return 'sıfır';
  if (int >= 1_000_000) return String(int);

  const parts: string[] = [];
  const thousands = Math.floor(int / 1000);
  const rem = int % 1000;

  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('bin');
    } else {
      parts.push(turkishIntToWords(thousands), 'bin');
    }
  }

  const hundreds = Math.floor(rem / 100);
  const tensUnit = rem % 100;
  if (hundreds > 0) {
    parts.push(hundreds === 1 ? 'yüz' : `${ONES_TR[hundreds]} yüz`);
  }
  const tens = Math.floor(tensUnit / 10);
  const ones = tensUnit % 10;
  if (tens > 0) parts.push(TENS_TR[tens]!);
  if (ones > 0) parts.push(ONES_TR[ones]!);

  return parts.join(' ').trim();
}

function expandTurkishNumbers(text: string): string {
  return text
    // Percentages: "%50" -> "yüzde elli"
    .replace(/%\s*(\d{1,6})/g, (_, d: string) => `yüzde ${turkishIntToWords(Number(d))}`)
    // Times: "14:30" -> "on dört otuz"
    .replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h: string, m: string) => {
      const mNum = Number(m);
      return `${turkishIntToWords(Number(h))} ${mNum === 0 ? '' : turkishIntToWords(mNum)}`.trim();
    })
    // Small ordinals common in grammar explanations: "1.", "2.", "3." (when followed by a lowercase word)
    .replace(/\b([1-9]|10)\.(?=\s+[a-zçğıöşü])/g, (_, d: string) => ORDINALS_TR[Number(d)] ?? turkishIntToWords(Number(d)))
    // Grammar shorthand: "V1", "V2", "V3", "V-ing"
    .replace(/\bV1\b/g, 'fiilin birinci hali')
    .replace(/\bV2\b/g, 'fiilin ikinci hali')
    .replace(/\bV3\b/g, 'fiilin üçüncü hali')
    .replace(/\bV-ing\b/gi, 'fiilin ing takılı hali')
    // Plain integers
    .replace(/\b\d{1,6}\b/g, (d) => turkishIntToWords(Number(d)));
}

/**
 * Normalize Turkish text into EMA Lightning's exact character alphabet (`frontend.py` mirror).
 */
export function normalizeEmaTurkishText(text: string, vocab: readonly string[]): string {
  const cleaned = expandTurkishNumbers(
    text
      .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
      .replace(/[’‘ʼ´`]/g, "'")
      .replace(/[“”„«»]/g, '"')
      .replace(/[–—−]/g, '-')
      .replace(/…/g, '...')
  )
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase();

  const vocabSet = new Set(vocab);
  let out = '';
  for (const ch of cleaned) {
    let mapped = ch;
    if (!TURKISH_SPECIAL.has(ch)) {
      mapped = ch.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    }
    if (mapped && [...mapped].every((c) => vocabSet.has(c))) {
      out += mapped;
    } else {
      out += ' ';
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

function finishEmaPiece(piece: string): string {
  const trimmedRight = piece.replace(/["')]+$/, '');
  const last = trimmedRight.slice(-1);
  if (last === '.' || last === '!' || last === '?') {
    return piece;
  }
  return `${piece.replace(/[,;:\-\s]+$/, '')}.`;
}

/**
 * Split normalized Turkish text into EMA Lightning chunks (`<= 250` chars, ending with terminal punctuation).
 */
export function chunkEmaText(text: string, speed: number = 1.0): Array<{ text: string; pauseSec: number }> {
  const limit = Math.floor(Math.min(MAX_LETTERS, LETTERS_PER_SECOND * MAX_SECONDS * Math.max(0.5, speed)));
  const pieces: Array<{ text: string; pauseSec: number }> = [];
  let rest = text.trim();

  const cutPatterns: Array<[RegExp, number]> = [
    [/[.!?]+["')]*(?= )/g, SENTENCE_PAUSE],
    [/[,;:](?= )/g, CLAUSE_PAUSE],
    [/\S(?= )/g, CLAUSE_PAUSE],
  ];

  while (rest.length > 0) {
    let cut = rest.length;
    let pauseSec = 0;

    if (rest.length > limit) {
      cut = limit;
      const slice = rest.slice(0, limit + 1);
      for (const [pattern, gap] of cutPatterns) {
        const re = new RegExp(pattern.source, 'g');
        let lastEnd = -1;
        let m: RegExpExecArray | null;
        while ((m = re.exec(slice)) !== null) {
          lastEnd = m.index + m[0].length;
        }
        if (lastEnd > 0) {
          cut = lastEnd;
          pauseSec = gap;
          break;
        }
      }
    }

    const piece = rest.slice(0, cut).trim();
    rest = rest.slice(cut).trim();
    if (/[a-zçğıöşü]/i.test(piece)) {
      pieces.push({ text: finishEmaPiece(piece), pauseSec });
    }
  }

  if (pieces.length > 0) {
    pieces[pieces.length - 1]!.pauseSec = 0;
  }
  return pieces;
}

/**
 * Build character IDs, per-character word indices (`cw`), and word start indices (`wstart`)
 * matching `ema_lightning/engine.py:Engine.piece`.
 */
export function buildEmaPieceInputs(
  pieceText: string,
  stoi: Map<string, number>
): { ids: BigInt64Array; cw: BigInt64Array; wstart: Int32Array; length: number } {
  const chars = [...pieceText];
  const L = chars.length;
  const ids = new BigInt64Array(L);
  const cw = new BigInt64Array(L);
  const wstart = new Int32Array(L);

  for (let i = 0; i < L; i += 1) {
    ids[i] = BigInt(stoi.get(chars[i]!) ?? 1);
  }

  const starts: number[] = [];
  for (let i = 0; i < L; i += 1) {
    if (chars[i] !== ' ' && (i === 0 || chars[i - 1] === ' ')) {
      starts.push(i);
    }
  }
  if (starts.length === 0) starts.push(0);

  const bounds = [0, ...starts.slice(1), L];
  for (let w = 0; w < bounds.length - 1; w += 1) {
    const a = bounds[w]!;
    const b = bounds[w + 1]!;
    for (let i = a; i < b; i += 1) {
      cw[i] = BigInt(w);
      wstart[i] = a;
    }
  }

  return { ids, cw, wstart, length: L };
}

/**
 * Compute EMA Lightning frame timeline (`fw`, `cg`, `fg`) from stage-1 character durations.
 * Mirrors `engine.py:Engine.plan` and `model.py:Acoustic.sound_stage` + `Aligner.forward` (`letter_pos=True`).
 */
export function buildEmaTimeline(
  rawDur: Float32Array,
  cw: BigInt64Array,
  wstart: Int32Array,
  speed: number = 1.0
): { frames: number; fw: BigInt64Array; cg: Float32Array; fg: Float32Array } {
  const L = rawDur.length;
  const safeSpeed = Math.max(0.5, Math.min(2.0, speed));
  const scaledDur = new Float32Array(L);
  let maxWord = 0;
  for (let i = 0; i < L; i += 1) {
    scaledDur[i] = rawDur[i]! / safeSpeed;
    const w = Number(cw[i]!);
    if (w > maxWord) maxWord = w;
  }
  const nWords = maxWord + 1;

  // Word frame counts (rounded & clamped)
  const wordDurSum = new Float64Array(nWords);
  for (let i = 0; i < L; i += 1) {
    const w = Number(cw[i]!);
    if (w >= 0) wordDurSum[w] = (wordDurSum[w] ?? 0) + scaledDur[i]!;
  }

  const wordCounts = new Int32Array(nWords);
  let totalFrames = 0;
  for (let w = 0; w < nWords; w += 1) {
    const cnt = Math.max(1, Math.min(MAX_WORD_FRAMES, Math.round(wordDurSum[w]!)));
    wordCounts[w] = cnt;
    totalFrames += cnt;
  }
  const frames = Math.min(totalFrames, MAX_FRAMES);

  const fw = new BigInt64Array(frames);
  const fp = new Float32Array(frames);
  let fIdx = 0;
  for (let w = 0; w < nWords && fIdx < frames; w += 1) {
    const cnt = wordCounts[w]!;
    for (let k = 0; k < cnt && fIdx < frames; k += 1) {
      fw[fIdx] = BigInt(w);
      fp[fIdx] = k / cnt;
      fIdx += 1;
    }
  }

  // Exact letter-pos alignment coordinates (`cg` and `fg`)
  const c = new Float32Array(L);
  const done = new Float32Array(L);
  const before = new Float32Array(L);
  const wordCSum = new Float32Array(nWords);
  const wlen = new Float32Array(nWords);

  let acc = 0;
  for (let i = 0; i < L; i += 1) {
    const ci = Math.max(1e-4, scaledDur[i]!);
    c[i] = ci;
    before[i] = acc;
    acc += ci;
    done[i] = acc;
    const w = Number(cw[i]!);
    if (w >= 0) {
      wordCSum[w] = (wordCSum[w] ?? 0) + ci;
      wlen[w] = (wlen[w] ?? 0) + 1;
    }
  }

  const woff = new Float32Array(nWords);
  let offAcc = 0;
  for (let w = 0; w < nWords; w += 1) {
    const wl = Math.max(1, wlen[w]!);
    wlen[w] = wl;
    woff[w] = offAcc;
    offAcc += wl;
  }

  const cg = new Float32Array(L);
  for (let i = 0; i < L; i += 1) {
    const w = Number(cw[i]!);
    const ws = wstart[i]!;
    const denom = Math.max(1e-8, wordCSum[w]!);
    const cp = Math.max(0, Math.min(1, (done[i]! - before[ws]! - 0.5 * c[i]!) / denom));
    cg[i] = woff[w]! + cp * wlen[w]!;
  }

  const fg = new Float32Array(frames);
  for (let t = 0; t < frames; t += 1) {
    const w = Number(fw[t]!);
    fg[t] = woff[w]! + fp[t]! * wlen[w]!;
  }

  return { frames, fw, cg, fg };
}

/** Deterministic standard normal N(0,1) noise `[1, steps, frames, latentDim]` via Mulberry32 + Box-Muller. */
export function generateSeededGaussianNoise(
  steps: number,
  frames: number,
  latentDim: number,
  seed: number = 0
): Float32Array {
  let s = (seed >>> 0) || 1;
  const rand = (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const total = steps * frames * latentDim;
  const out = new Float32Array(total);
  for (let i = 0; i < total; i += 2) {
    const u1 = Math.max(1e-7, rand());
    const u2 = rand();
    const mag = Math.sqrt(-2.0 * Math.log(u1));
    const z0 = mag * Math.cos(2.0 * Math.PI * u2);
    const z1 = mag * Math.sin(2.0 * Math.PI * u2);
    out[i] = z0;
    if (i + 1 < total) out[i + 1] = z1;
  }
  return out;
}

/**
 * 4-point Catmull-Rom cubic Hermite resampler to upsample 22,050 Hz English Piper (`HFC Female`)
 * clips to 48,000 Hz EMA Lightning audio smoothly without linear-stepping metallic artifacts.
 */
export function resampleLinear(pcm: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || pcm.length === 0) return pcm;
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.round(pcm.length / ratio));
  const out = new Float32Array(outLen);
  const lastIdx = pcm.length - 1;

  if (pcm.length < 4) {
    for (let i = 0; i < outLen; i += 1) {
      const srcPos = i * ratio;
      const i0 = Math.floor(srcPos);
      const i1 = Math.min(lastIdx, i0 + 1);
      const frac = srcPos - i0;
      out[i] = pcm[i0]! * (1 - frac) + pcm[i1]! * frac;
    }
    return out;
  }

  for (let i = 0; i < outLen; i += 1) {
    const srcPos = i * ratio;
    const i1 = Math.floor(srcPos);
    const t = srcPos - i1;
    const i0 = Math.max(0, i1 - 1);
    const i2 = Math.min(lastIdx, i1 + 1);
    const i3 = Math.min(lastIdx, i1 + 2);

    const y0 = pcm[i0]!;
    const y1 = pcm[i1]!;
    const y2 = pcm[i2]!;
    const y3 = pcm[i3]!;

    const c0 = y1;
    const c1 = 0.5 * (y2 - y0);
    const c2 = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
    const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
    out[i] = ((c3 * t + c2) * t + c1) * t + c0;
  }
  return out;
}
