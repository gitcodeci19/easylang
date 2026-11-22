/**
 * Frontend & pure-WASM (`PDN1`) runtime helpers for `mesmertech/mesm-tts` Heart (`v2g.pdn`, Apache-2.0, 24 kHz).
 *
 * Distilled from Kokoro-82M (`af_heart`, 2.3 MB) and executed at ~50x-90x real-time on a single CPU
 * thread via the bundled 149 KB WebAssembly engine (`public/tts/mesm_pdn.wasm`) with zero GPU usage.
 */

import type { TtsVoiceMode } from './types.ts';

export type MesmVoiceMode = 'mesm_heart';

export interface MesmVoiceMeta {
  mode: MesmVoiceMode;
  key: string;
  alias: string;
  pdnRelPath: string;
  bundledRelPath: string;
  opfsName: string;
  sizeLabel: string;
  gainDb: number;
  gapScale: number;
  leadKeepSec: number;
  labelTr: string;
  labelEn: string;
}

export const MESM_SAMPLE_RATE = 24000;
export const MESM_HF_BASE_URL = 'https://huggingface.co/mesmertech/mesm-tts/resolve/main';

export const MESM_HEART_VOICE: Readonly<MesmVoiceMeta> = {
  mode: 'mesm_heart',
  key: 'heart',
  alias: 'Heart',
  // v2g (2.3 MB) has the lowest WER (5.48%) and avoids single-word initial-'h' stop artifacts
  pdnRelPath: 'web/v2/models/v2g.pdn',
  bundledRelPath: 'tts/mesm_heart_v2g.pdn',
  opfsName: 'mesm_heart_v2g.pdn',
  sizeLabel: '2.3 MB',
  gainDb: 2.4,
  gapScale: 1.0,
  leadKeepSec: 0.02,
  labelTr: 'Yapay Zeka Sesi (Heart · US Kadın)',
  labelEn: 'AI Neural Voice (Heart · US Female)',
};

export const MESM_VOICE_CATALOG: Readonly<Record<MesmVoiceMode, MesmVoiceMeta>> = {
  mesm_heart: MESM_HEART_VOICE,
};

export function isMesmVoiceMode(mode: unknown): mode is MesmVoiceMode {
  return mode === 'mesm_heart';
}

/**
 * Normalize stored `ttsVoiceMode` to the single permanent English neural voice (`mesm_heart`),
 * migrating any legacy Piper/Kokoro/multi-voice settings cleanly.
 */
export function normalizeTtsVoiceMode(_mode: unknown): TtsVoiceMode {
  return 'mesm_heart';
}

export function getMesmVoiceUrl(voiceMode: MesmVoiceMode = 'mesm_heart'): string {
  return `${MESM_HF_BASE_URL}/${MESM_VOICE_CATALOG[voiceMode].pdnRelPath}`;
}

export function getMesmVoiceOpfsName(voiceMode: MesmVoiceMode = 'mesm_heart'): string {
  return MESM_VOICE_CATALOG[voiceMode].opfsName;
}

// Exact verified Misaki/Kokoro 114-token vocabulary from `mesmertech/mesm-tts/tokenizer.json`
const MESM_VOCAB: Readonly<Record<string, number>> = {
  $: 0,
  ';': 1,
  ':': 2,
  ',': 3,
  '.': 4,
  '!': 5,
  '?': 6,
  '\u2014': 9,
  '\u2026': 10,
  '"': 11,
  '(': 12,
  ')': 13,
  '\u201c': 14,
  '\u201d': 15,
  ' ': 16,
  '\u0303': 17,
  '\u02a3': 18,
  '\u02a5': 19,
  '\u02a6': 20,
  '\u02a8': 21,
  '\u1d5d': 22,
  '\uab67': 23,
  A: 24,
  I: 25,
  O: 31,
  Q: 33,
  S: 35,
  T: 36,
  W: 39,
  Y: 41,
  '\u1d4a': 42,
  a: 43,
  b: 44,
  c: 45,
  d: 46,
  e: 47,
  f: 48,
  h: 50,
  i: 51,
  j: 52,
  k: 53,
  l: 54,
  m: 55,
  n: 56,
  o: 57,
  p: 58,
  q: 59,
  r: 60,
  s: 61,
  t: 62,
  u: 63,
  v: 64,
  w: 65,
  x: 66,
  y: 67,
  z: 68,
  '\u0251': 69,
  '\u0250': 70,
  '\u0252': 71,
  '\u00e6': 72,
  '\u03b2': 75,
  '\u0254': 76,
  '\u0255': 77,
  '\u00e7': 78,
  '\u0256': 80,
  '\u00f0': 81,
  '\u02a4': 82,
  '\u0259': 83,
  '\u025a': 85,
  '\u025b': 86,
  '\u025c': 87,
  '\u025f': 90,
  '\u0261': 92,
  '\u0265': 99,
  '\u0268': 101,
  '\u026a': 102,
  '\u029d': 103,
  '\u026f': 110,
  '\u0270': 111,
  '\u014b': 112,
  '\u0273': 113,
  '\u0272': 114,
  '\u0274': 115,
  '\u00f8': 116,
  '\u0278': 118,
  '\u03b8': 119,
  '\u0153': 120,
  '\u0279': 123,
  '\u027e': 125,
  '\u027b': 126,
  '\u0281': 128,
  '\u027d': 129,
  '\u0282': 130,
  '\u0283': 131,
  '\u0288': 132,
  '\u02a7': 133,
  '\u028a': 135,
  '\u028b': 136,
  '\u028c': 138,
  '\u0263': 139,
  '\u0264': 140,
  '\u03c7': 142,
  '\u028e': 143,
  '\u0292': 147,
  '\u0294': 148,
  '\u02c8': 156,
  '\u02cc': 157,
  '\u02d0': 158,
  '\u02b0': 162,
  '\u02b2': 164,
  '\u2193': 169,
  '\u2192': 171,
  '\u2197': 172,
  '\u2198': 173,
  '\u1d7b': 177,
};

// Official Misaki `EspeakFallback` table (`web/v2/frontend/misaki.js`, Apache-2.0).
// Paradee/mesm-tts only saw Misaki symbols during training (`A`/`I`/`O`/`W`/`Y`/`T`/`ʧ`/`ʤ`),
// so raw eSpeak-NG diphthongs must be mapped here to avoid mispronunciation.
const ESPEAK_TO_MISAKI: ReadonlyArray<readonly [string, string]> = [
  ['ʔˌn̩', 'ʔn'],
  ['ʔn̩', 'ʔn'],
  ['aɪ', 'I'],
  ['aʊ', 'W'],
  ['dʒ', 'ʤ'],
  ['eɪ', 'A'],
  ['e', 'A'],
  ['tʃ', 'ʧ'],
  ['ɔɪ', 'Y'],
  ['ʲo', 'jo'],
  ['ʲə', 'jə'],
  ['ʲ', ''],
  ['ɚ', 'əɹ'],
  ['r', 'ɹ'],
  ['x', 'k'],
  ['ç', 'k'],
  ['ɬ', 'l'],
  ['̃', ''],
];

function splitNumberForMesm(match: string): string {
  if (match.includes('.')) return match;
  if (match.includes(':')) {
    const [hStr, mStr] = match.split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    if (m === 0) return `${h} o'clock`;
    if (m < 10) return `${h} oh ${m}`;
    return `${h} ${m}`;
  }
  const year = parseInt(match.slice(0, 4), 10);
  if (year < 1100 || year % 1000 < 10) return match;
  const left = match.slice(0, 2);
  const right = parseInt(match.slice(2, 4), 10);
  const suffix = match.endsWith('s') ? 's' : '';
  if (year % 1000 >= 100 && year % 1000 <= 999) {
    if (right === 0) return `${left} hundred${suffix}`;
    if (right < 10) return `${left} oh ${right}${suffix}`;
  }
  return `${left} ${right}${suffix}`;
}

function flipMoneyForMesm(match: string): string {
  const bill = match[0] === '$' ? 'dollar' : 'pound';
  const body = match.slice(1);
  if (Number.isNaN(Number(body))) return `${body} ${bill}s`;
  if (!match.includes('.')) {
    const suffix = body === '1' ? '' : 's';
    return `${body} ${bill}${suffix}`;
  }
  const [b = '0', c = '0'] = body.split('.');
  const d = parseInt(c.padEnd(2, '0'), 10);
  const coins =
    match[0] === '$' ? (d === 1 ? 'cent' : 'cents') : d === 1 ? 'penny' : 'pence';
  return `${b} ${bill}${b === '1' ? '' : 's'} and ${d} ${coins}`;
}

function pointNumForMesm(match: string): string {
  const [a = '', b = ''] = match.split('.');
  return `${a} point ${b.split('').join(' ')}`;
}

/**
 * Normalize English text (years, times, currencies, decimals, titles, punctuation)
 * before US-English eSpeak-NG phonemization.
 */
export function normalizeMesmText(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/«/g, '“')
    .replace(/»/g, '”')
    .replace(/[“”]/g, '"')
    .replace(/\(/g, '«')
    .replace(/\)/g, '»')
    .replace(/[^\S \n]/g, ' ')
    .replace(/  +/g, ' ')
    .replace(/\bD[Rr]\.(?= [A-Z])/g, 'Doctor')
    .replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, 'Mister')
    .replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, 'Miss')
    .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, 'Mrs')
    .replace(/\betc\.(?! [A-Z])/gi, 'etc')
    .replace(/\b(y)eah?\b/gi, "$1e'a")
    .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, splitNumberForMesm)
    .replace(/(?<=\d),(?=\d)/g, '')
    .replace(
      /[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi,
      flipMoneyForMesm
    )
    .replace(/\d*\.\d+/g, pointNumForMesm)
    .replace(/(?<=\d)-(?=\d)/g, ' to ')
    .replace(/(?<=\d)S/g, ' S')
    .replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S")
    .replace(/(?<=X')S\b/g, 's')
    .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (m) => m.replace(/\./g, '-'))
    .replace(/(?<=[A-Z])\.(?=[A-Z])/gi, '-')
    .trim();
}

const ABBREV_RE =
  /(?:^|[\s"“(])(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Gov|Sen|Rep|Capt|Lt|Col|Sgt|Adm|Mt|Ft|No|Nos|vs|etc|Inc|Ltd|Co|Corp|Bros|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|[A-Z]|(?:[A-Za-z]\.)+[A-Za-z])\.$/;
const SENTENCE_END_RE = /[.!?…]["”’')\]]*$/;
const SENTENCE_BREAK_RE = /\s+(?=[A-Z"“(\d])/g;

/**
 * Split multi-sentence text into natural utterance units matching `mesm-tts` training boundaries
 * while keeping abbreviations (`Dr. Smith`, `U.S. Army`) intact.
 */
export function splitMesmSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const pieces: string[] = [];
  let start = 0;
  for (const m of cleaned.matchAll(SENTENCE_BREAK_RE)) {
    const idx = m.index ?? 0;
    if (SENTENCE_END_RE.test(cleaned.slice(0, idx))) {
      pieces.push(cleaned.slice(start, idx));
      start = idx + m[0].length;
    }
  }
  pieces.push(cleaned.slice(start));

  const out: string[] = [];
  for (const p of pieces) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    if (out.length > 0 && ABBREV_RE.test(out[out.length - 1]!)) {
      out[out.length - 1] = `${out[out.length - 1]!} ${trimmed}`;
    } else {
      out.push(trimmed);
    }
  }
  return out;
}

/**
 * Convert raw US-English eSpeak-NG IPA output into Misaki phoneme spelling expected by `mesm-tts`.
 */
export function postProcessEspeakToMisaki(rawIpa: string): string {
  let ps = rawIpa
    .replace(/kəkˈoːɹoʊ/g, 'kˈoʊkəɹoʊ')
    .replace(/kəkˈɔːɹəʊ/g, 'kˈəʊkəɹəʊ')
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, ' ')
    .replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, 'z')
    .replace(/(?<=nˈaɪn)ti(?!ː)/g, 'di');

  for (const [from, to] of ESPEAK_TO_MISAKI) {
    ps = ps.split(from).join(to);
  }
  ps = ps.replace(/(\S)̩/gu, 'ᵊ$1').replace(/̩/g, '');
  ps = ps.replace(/əl(?=[\s;:,.!?—…"“”()]|$)/gu, 'ᵊl');
  ps = ps.replace(/ɐ(?![\s;:,.!?—…"“”()]|$)/gu, 'ə');
  ps = ps
    .split('oʊ')
    .join('O')
    .split('ɜːɹ')
    .join('ɜɹ')
    .split('ɜː')
    .join('ɜɹ')
    .split('ɪə')
    .join('iə')
    .split('ː')
    .join('');
  ps = ps.split('o').join('ɔ');
  return ps.split('ɾ').join('T').split('ʔ').join('t').trim();
}

/**
 * Encode Misaki phoneme characters into `mesm-tts` token IDs (`[0, ...ids, 0]`, max 512).
 */
export function tokenizeMesmPhonemes(misaki: string): number[] {
  const trimmed = misaki.trim();
  if (!trimmed) return [];
  const ids: number[] = [0];
  for (const ch of trimmed) {
    const id = MESM_VOCAB[ch];
    if (id !== undefined) {
      ids.push(id);
      if (ids.length >= 511) break;
    }
  }
  if (ids.length <= 1) return [];
  ids.push(0);
  return ids;
}

/**
 * Apply `mesm-tts` per-voice `gain_db` + soft-knee limiter above 0.9, then trim excess silence
 * while retaining a 25ms soft edge and 4ms micro-fade so rapid playback never clicks or clips.
 */
export function applyMesmLevelAndTrim(
  rawPcm: Float32Array,
  gainDb: number,
  sampleRate = MESM_SAMPLE_RATE
): Float32Array {
  if (rawPcm.length === 0) return rawPcm;
  const gain = Math.pow(10, gainDb / 20);
  const leveled = new Float32Array(rawPcm.length);
  const threshold = 0.006;
  let firstActive = -1;
  let lastActive = -1;

  for (let i = 0; i < rawPcm.length; i += 1) {
    let y = rawPcm[i]! * gain;
    const ay = Math.abs(y);
    if (ay > 0.9) {
      y = Math.sign(y) * (0.9 + 0.1 * Math.tanh((ay - 0.9) / 0.1));
    }
    leveled[i] = y;
    if (Math.abs(y) >= threshold) {
      if (firstActive < 0) firstActive = i;
      lastActive = i;
    }
  }

  if (firstActive < 0) return leveled;
  const margin = Math.round(sampleRate * 0.025);
  const start = Math.max(0, firstActive - margin);
  const end = Math.min(leveled.length, lastActive + 1 + margin);
  const slice = leveled.slice(start, end);

  const fade = Math.min(Math.round(sampleRate * 0.004), Math.floor(slice.length / 4));
  for (let i = 0; i < fade; i += 1) {
    const w = i / Math.max(1, fade);
    slice[i] = slice[i]! * w;
    slice[slice.length - 1 - i] = slice[slice.length - 1 - i]! * w;
  }
  return slice;
}

interface PdnTensorEntry {
  name: string;
  dtype: 'f32' | 'f16' | 'q8' | 'q4' | 'i32' | 'q6';
  shape?: number[];
  rows?: number;
  cols?: number;
  off: number;
  bits?: number;
  group?: number;
  ngroups?: number;
  soff?: number;
}

export interface PdnHeader {
  cfg: {
    icfg: number[];
    fcfg: number[];
    text: { max_pos: number };
  };
  tensors: PdnTensorEntry[];
}

interface PdnWasmExports {
  memory: WebAssembly.Memory;
  pdn_alloc(size: number): number;
  pdn_init(blobPtr: number, descPtr: number, count: number, icPtr: number, fcPtr: number): number;
  pdn_missing(): number;
  pdn_noise_mode(det: number, seed: number): void;
  pdn_text(idsPtr: number, len: number, speed: number): number;
  pdn_decode(): number;
  pdn_wave(): number;
}

export interface MesmPdnEngine {
  readonly maxPos: number;
  synth(ids: Int32Array, speed?: number): Float32Array;
}

const PDN_DTYPE_CODE: Readonly<Record<string, number>> = {
  f32: 0,
  f16: 1,
  q8: 2,
  q4: 3,
  i32: 4,
  q6: 5,
};

/**
 * Parse a `mesm-tts` `.pdn` weight archive (`PDN1` magic + uint32 header byte length + JSON + blob).
 */
export function parsePdnBinary(bytes: Uint8Array): { hdr: PdnHeader; blob: Uint8Array } {
  if (bytes.byteLength < 12) {
    throw new Error('Invalid PDN file: truncated header');
  }
  const magic = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  if (magic !== 'PDN1') {
    throw new Error(`Invalid PDN magic: ${magic}`);
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerLen = dv.getUint32(4, true);
  if (8 + headerLen > bytes.byteLength) {
    throw new Error('Invalid PDN file: header exceeds payload size');
  }
  const hdr = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + headerLen))) as PdnHeader;
  return { hdr, blob: bytes.subarray(8 + headerLen) };
}

/**
 * Instantiate the pure-WASM `mesm_pdn.wasm` engine (zero external imports, 100% MV3 CSP safe).
 */
export async function createMesmPdnEngine(
  wasmBytes: ArrayBuffer | Uint8Array,
  pdnBytes: Uint8Array
): Promise<MesmPdnEngine> {
  const wasmBuf: ArrayBuffer =
    wasmBytes instanceof ArrayBuffer ? wasmBytes : (wasmBytes.slice().buffer as ArrayBuffer);
  const { instance } = await WebAssembly.instantiate(wasmBuf, {});
  const ex = instance.exports as unknown as PdnWasmExports;
  const { hdr, blob } = parsePdnBinary(pdnBytes);
  const cfg = hdr.cfg;

  const u8 = () => new Uint8Array(ex.memory.buffer);
  const put = (src: ArrayBufferView) => {
    const ptr = ex.pdn_alloc(src.byteLength);
    u8().set(new Uint8Array(src.buffer, src.byteOffset, src.byteLength), ptr);
    return ptr;
  };

  const blobPtr = put(blob);
  const tensors = hdr.tensors;
  const desc = new Uint8Array(64 * tensors.length);
  const dv = new DataView(desc.buffer);
  const encoder = new TextEncoder();

  for (let i = 0; i < tensors.length; i += 1) {
    const t = tensors[i]!;
    const offset = 64 * i;
    desc.set(encoder.encode(t.name).subarray(0, 23), offset);
    const numel = t.shape ? t.shape.reduce((a, b) => a * b, 1) : (t.rows ?? 1) * (t.cols ?? 1);
    const rows = t.rows ?? 1;
    const cols = t.rows ? (t.cols ?? 1) : numel;
    const fields = [
      PDN_DTYPE_CODE[t.dtype] ?? 0,
      rows,
      cols,
      t.off,
      t.bits ?? 0,
      t.group ?? 0,
      t.ngroups ?? 0,
      t.soff ?? 0,
      numel,
    ];
    for (let k = 0; k < fields.length; k += 1) {
      dv.setInt32(offset + 24 + 4 * k, fields[k]!, true);
    }
  }

  const descPtr = put(desc);
  const icPtr = put(Int32Array.from([...cfg.icfg, 0, 0, 0, 0, 0, 0, 0, 0]));
  const fcPtr = put(Float32Array.from(cfg.fcfg));
  const maxPos = cfg.text.max_pos || 512;
  const idsPtr = ex.pdn_alloc(4 * maxPos);

  const missingCount = ex.pdn_init(blobPtr, descPtr, tensors.length, icPtr, fcPtr);
  if (missingCount !== 0) {
    const ptr = ex.pdn_missing();
    const mem = u8();
    let end = ptr;
    while (end < mem.length && mem[end] !== 0 && end - ptr < 300) end += 1;
    const missingNames = new TextDecoder().decode(mem.subarray(ptr, end));
    throw new Error(`PDN engine init failed (${missingCount} missing tensors): ${missingNames}`);
  }

  let seed = 1;
  return {
    maxPos,
    synth(ids: Int32Array, speed = 1.0): Float32Array {
      const clamped = ids.length > maxPos ? ids.subarray(0, maxPos) : ids;
      new Int32Array(ex.memory.buffer, idsPtr, clamped.length).set(clamped);
      ex.pdn_noise_mode(0, seed);
      seed += 1;
      ex.pdn_text(idsPtr, clamped.length, speed);
      const sampleCount = ex.pdn_decode();
      if (sampleCount <= 0) return new Float32Array(0);
      return new Float32Array(ex.memory.buffer, ex.pdn_wave(), sampleCount).slice();
    },
  };
}
