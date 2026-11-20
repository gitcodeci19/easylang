import * as ort from 'onnxruntime-web/wasm';
import { createPiperPhonemize } from 'piper-phonemize';
import { splitBilingualCoachSegments, stripCoachMarkupForDisplay } from '../shared/bilingualTtsSplit.ts';
import { formatTextForEnglishTts } from '../shared/speech.ts';
import {
  buildEmaPieceInputs,
  buildEmaTimeline,
  chunkEmaText,
  generateSeededGaussianNoise,
  normalizeEmaTurkishText,
  resampleLinear,
} from '../shared/emaFrontend.ts';
import type { CoachPlaybackProgress, NeuralTtsStatus } from '../shared/types.ts';

const EN_VOICE_ID = 'en_US-hfc_female-medium' as const;
const TR_VOICE_ID = 'tr_TR-ema-lightning' as const;
const MAX_EN_WAV_CACHE = 96;
const MAX_COACH_WAV_CACHE = 6;
const MAX_PIPER_CHUNK_CHARS = 360;

// Force single-threaded WASM inside MV3 offscreen documents (no SharedArrayBuffer / blob worker CSP issues).
const ortRuntime = (ort as unknown as { default?: typeof ort }).default ?? ort;
try {
  if (ortRuntime?.env?.wasm) {
    ortRuntime.env.wasm.proxy = false;
    ortRuntime.env.wasm.wasmPaths = chrome.runtime.getURL('tts/');
    Object.defineProperty(ortRuntime.env.wasm, 'numThreads', {
      get: () => 1,
      set: () => {
        // Keep single-threaded for MV3 CSP compliance
      },
      configurable: true,
    });
  }
} catch {
  // Ignore if non-configurable
}

interface PiperModelConfig {
  audio: { sample_rate: number };
  espeak: { voice: string };
  inference: { noise_scale: number; length_scale: number; noise_w: number };
  speaker_id_map?: Record<string, number>;
}

interface EmaModelConfig {
  vocab: string[];
  sample_rate: number;
  hop: number;
  latent_dim: number;
  steps: number;
  times: number[];
  letter_pos: boolean;
}

interface OffscreenTtsMessage {
  target?: string;
  action?: 'SPEAK' | 'CANCEL' | 'PREPARE' | 'STATUS' | 'COACH_SPEAK' | 'COACH_CONTROL';
  text?: string;
  rate?: number;
  queue?: boolean;
  requestId?: string;
  command?: 'pause' | 'resume' | 'stop' | 'seek' | 'rate';
  value?: number;
}

function getLocalWasmUrls() {
  return {
    onnxDir: chrome.runtime.getURL('tts/'),
    piperWasm: chrome.runtime.getURL('tts/piper_phonemize.wasm'),
    piperData: chrome.runtime.getURL('tts/piper_phonemize.data'),
  };
}

async function readOpfsFile(fileName: string): Promise<Blob | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('piper', { create: true });
    const fileHandle = await dir.getFileHandle(fileName);
    return await fileHandle.getFile();
  } catch {
    return null;
  }
}

async function writeOpfsFile(fileName: string, blob: Blob): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('piper', { create: true });
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  } catch {
    // Ignore OPFS write failure (model still runs in memory)
  }
}

async function fetchRemoteBlobWithProgress(
  url: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Model download failed (HTTP ${res.status})`);
  }
  const total = Number(res.headers.get('Content-Length') ?? 0);
  const reader = res.body?.getReader();
  if (!reader) {
    return await res.blob();
  }
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      onProgress?.(loaded, total);
    }
  }
  const parts = chunks.map(
    (c) => c.buffer.slice(c.byteOffset, c.byteOffset + c.byteLength) as ArrayBuffer
  );
  return new Blob(parts, { type: res.headers.get('Content-Type') ?? 'application/octet-stream' });
}

function pcm2wav(buffer: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bufferLength = buffer.length;
  const headerLength = 44;
  const view = new DataView(new ArrayBuffer(bufferLength * 2 + headerLength));
  view.setUint32(0, 1179011410, true); // RIFF
  view.setUint32(4, view.buffer.byteLength - 8, true);
  view.setUint32(8, 1163280727, true); // WAVE
  view.setUint32(12, 544501094, true); // fmt
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, numChannels * 2 * sampleRate, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 1635017060, true); // data
  view.setUint32(40, 2 * bufferLength, true);

  let p = headerLength;
  for (let i = 0; i < bufferLength; i += 1) {
    const v = buffer[i]!;
    if (v >= 1) view.setInt16(p, 32767, true);
    else if (v <= -1) view.setInt16(p, -32768, true);
    else view.setInt16(p, (v * 32768) | 0, true);
    p += 2;
  }
  return view.buffer;
}

function splitPiperChunks(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= MAX_PIPER_CHUNK_CHARS) return [trimmed];
  const sentences = trimmed.match(/[^.!?…\n]+[.!?…]*\s*/g) ?? [trimmed];
  const out: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + s).length > MAX_PIPER_CHUNK_CHARS && cur.trim()) {
      out.push(cur.trim());
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * English Piper neural runner (`en_US-hfc_female-medium`, 22.05 kHz, cached in OPFS).
 */
class EnglishPiperRunner {
  readonly status: NeuralTtsStatus = {
    voiceId: EN_VOICE_ID,
    cached: false,
    ready: false,
    downloading: false,
    progressPercent: 0,
  };

  private initPromise: Promise<void> | null = null;
  private modelConfig: PiperModelConfig | null = null;
  private ortSession: ort.InferenceSession | null = null;
  private readonly opfsModel = 'en_US-hfc_female-medium.onnx';
  private readonly opfsConfig = 'en_US-hfc_female-medium.onnx.json';
  private readonly remoteModel =
    'https://huggingface.co/diffusionstudio/piper-voices/resolve/main/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx';
  private readonly remoteConfig =
    'https://huggingface.co/diffusionstudio/piper-voices/resolve/main/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx.json';
  private readonly onStatusChange: () => void;

  constructor(onStatusChange: () => void) {
    this.onStatusChange = onStatusChange;
  }

  async refreshAvailability(): Promise<boolean> {
    if (this.status.ready) {
      this.status.cached = true;
      this.status.progressPercent = 100;
      return true;
    }
    const opfsBlob = await readOpfsFile(this.opfsModel);
    this.status.cached = Boolean(opfsBlob);
    if (this.status.cached && !this.status.downloading) {
      this.status.progressPercent = 100;
    }
    return this.status.cached;
  }

  async ensureReady(): Promise<void> {
    if (this.ortSession && this.modelConfig && this.status.ready) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.status.error = undefined;
      try {
        let configBlob = await readOpfsFile(this.opfsConfig);
        if (!configBlob) {
          configBlob = await fetchRemoteBlobWithProgress(this.remoteConfig);
          await writeOpfsFile(this.opfsConfig, configBlob);
        }
        this.modelConfig = JSON.parse(await configBlob.text()) as PiperModelConfig;

        let modelBlob = await readOpfsFile(this.opfsModel);
        if (!modelBlob) {
          this.status.downloading = true;
          this.status.progressPercent = 1;
          this.onStatusChange();
          modelBlob = await fetchRemoteBlobWithProgress(this.remoteModel, (loaded, total) => {
            if (total > 0) {
              const pct = Math.max(1, Math.min(99, Math.round((loaded / total) * 100)));
              if (pct !== this.status.progressPercent) {
                this.status.downloading = true;
                this.status.progressPercent = pct;
                this.onStatusChange();
              }
            }
          });
          await writeOpfsFile(this.opfsModel, modelBlob);
        }

        if (ortRuntime.env?.wasm) {
          ortRuntime.env.wasm.wasmPaths = getLocalWasmUrls().onnxDir;
        }
        this.ortSession = await ortRuntime.InferenceSession.create(await modelBlob.arrayBuffer(), {
          executionProviders: ['wasm'],
        });

        this.status.cached = true;
        this.status.ready = true;
        this.status.downloading = false;
        this.status.progressPercent = 100;
        this.status.error = undefined;
        this.onStatusChange();
      } catch (err) {
        this.initPromise = null;
        this.ortSession = null;
        this.status.ready = false;
        this.status.downloading = false;
        this.status.error = err instanceof Error ? err.message : String(err);
        this.onStatusChange();
        throw err;
      }
    })();

    return this.initPromise;
  }

  async synthesizePcm(
    text: string,
    options?: { embeddedCoach?: boolean }
  ): Promise<{ pcm: Float32Array; sampleRate: number }> {
    await this.ensureReady();
    const cfg = this.modelConfig!;
    const session = this.ortSession!;
    const embeddedCoach = Boolean(options?.embeddedCoach);
    const normalizedText = formatTextForEnglishTts(text, true) || text.trim();
    const preparedText =
      embeddedCoach && normalizedText && !/[.!?]$/.test(normalizedText)
        ? `${normalizedText}.`
        : normalizedText;
    const chunks = splitPiperChunks(preparedText);
    const urls = getLocalWasmUrls();
    const parts: Float32Array[] = [];

    const noiseScale = embeddedCoach
      ? Math.min(cfg.inference.noise_scale, 0.52)
      : cfg.inference.noise_scale;
    const lengthScale = embeddedCoach
      ? cfg.inference.length_scale * 1.12
      : cfg.inference.length_scale;
    const noiseW = embeddedCoach
      ? Math.min(cfg.inference.noise_w, 0.6)
      : cfg.inference.noise_w;

    for (const chunk of chunks) {
      const phonemeIds = await new Promise<number[]>((resolve, reject) => {
        void createPiperPhonemize({
          print: (data) => {
            try {
              const parsed = JSON.parse(data) as { phoneme_ids?: number[] };
              resolve(Array.isArray(parsed.phoneme_ids) ? parsed.phoneme_ids : []);
            } catch (err) {
              reject(err);
            }
          },
          printErr: (msg) => {
            if (msg && !msg.includes('espeak')) reject(new Error(msg));
          },
          locateFile: (url) => {
            if (url.endsWith('.wasm')) return urls.piperWasm;
            if (url.endsWith('.data')) return urls.piperData;
            return url;
          },
        })
          .then((mod) => {
            mod.callMain([
              '-l',
              cfg.espeak.voice,
              '--input',
              JSON.stringify([{ text: chunk }]),
              '--espeak_data',
              '/espeak-ng-data',
            ]);
          })
          .catch(reject);
      });

      if (phonemeIds.length === 0) continue;

      const feeds: Record<string, ort.Tensor> = {
        input: new ortRuntime.Tensor('int64', BigInt64Array.from(phonemeIds.map((n) => BigInt(n))), [
          1,
          phonemeIds.length,
        ]),
        input_lengths: new ortRuntime.Tensor('int64', BigInt64Array.from([BigInt(phonemeIds.length)]), [1]),
        scales: new ortRuntime.Tensor(
          'float32',
          new Float32Array([noiseScale, lengthScale, noiseW]),
          [3]
        ),
      };
      if (cfg.speaker_id_map && Object.keys(cfg.speaker_id_map).length > 0) {
        feeds.sid = new ortRuntime.Tensor('int64', BigInt64Array.from([0n]), [1]);
      }

      const outputs = await session.run(feeds);
      const rawOut = outputs.output?.data;
      if (rawOut instanceof Float32Array) {
        parts.push(rawOut);
      }
    }

    const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const p of parts) {
      merged.set(p, offset);
      offset += p.length;
    }
    const sampleRate = cfg.audio.sample_rate || 22050;
    return {
      pcm: embeddedCoach ? trimAndFadeEmbeddedEnglishPcm(merged, sampleRate) : merged,
      sampleRate,
    };
  }
}

function trimAndFadeEmbeddedEnglishPcm(pcm: Float32Array, sampleRate: number): Float32Array {
  if (pcm.length === 0) return pcm;
  const threshold = 0.004;
  let first = 0;
  while (first < pcm.length && Math.abs(pcm[first]!) < threshold) {
    first += 1;
  }
  if (first >= pcm.length) return pcm;
  let last = pcm.length - 1;
  while (last > first && Math.abs(pcm[last]!) < threshold) {
    last -= 1;
  }
  const leadPad = Math.round(sampleRate * 0.018);
  const trailPad = Math.round(sampleRate * 0.028);
  const start = Math.max(0, first - leadPad);
  const end = Math.min(pcm.length, last + 1 + trailPad);
  const out = pcm.slice(start, end);

  const fadeInLen = Math.min(Math.round(sampleRate * 0.012), Math.floor(out.length / 4));
  for (let i = 0; i < fadeInLen; i += 1) {
    const w = 0.5 * (1 - Math.cos((Math.PI * i) / fadeInLen));
    out[i] = out[i]! * w;
  }
  const fadeOutLen = Math.min(Math.round(sampleRate * 0.016), Math.floor(out.length / 4));
  for (let i = 0; i < fadeOutLen; i += 1) {
    const idx = out.length - 1 - i;
    const w = 0.5 * (1 - Math.cos((Math.PI * i) / fadeOutLen));
    out[idx] = out[idx]! * w;
  }
  return out;
}

/**
 * EMA Lightning Turkish 48 kHz neural TTS runner (8.6M params, 4-step DiT + HiFi-GAN, Apache 2.0).
 * Runs 100% locally offline from bundled `dist/tts/ema/*.onnx` via single-threaded `onnxruntime-web`.
 */
class EmaLightningRunner {
  readonly status: NeuralTtsStatus = {
    voiceId: TR_VOICE_ID,
    cached: false,
    ready: false,
    downloading: false,
    progressPercent: 0,
  };

  private initPromise: Promise<void> | null = null;
  private config: EmaModelConfig | null = null;
  private stoi: Map<string, number> = new Map();
  private textSession: ort.InferenceSession | null = null;
  private soundSession: ort.InferenceSession | null = null;
  private decoderSession: ort.InferenceSession | null = null;
  private readonly onStatusChange: () => void;

  constructor(onStatusChange: () => void) {
    this.onStatusChange = onStatusChange;
  }

  async refreshAvailability(): Promise<boolean> {
    if (this.status.ready) {
      this.status.cached = true;
      this.status.progressPercent = 100;
      return true;
    }
    try {
      const res = await fetch(chrome.runtime.getURL('tts/ema/ema_config.json'));
      this.status.cached = res.ok;
      if (res.ok) this.status.progressPercent = 100;
      return res.ok;
    } catch {
      this.status.cached = false;
      return false;
    }
  }

  private async fetchLocalArrayBuffer(relPath: string): Promise<ArrayBuffer> {
    const res = await fetch(chrome.runtime.getURL(relPath));
    if (!res.ok) {
      throw new Error(`EMA Lightning model dosyası bulunamadı (${relPath}). Neural-TTS paketini kullandığından emin ol.`);
    }
    return res.arrayBuffer();
  }

  async ensureReady(): Promise<void> {
    if (this.textSession && this.soundSession && this.decoderSession && this.config && this.status.ready) {
      return;
    }
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.status.error = undefined;
      this.status.downloading = true;
      this.status.progressPercent = 15;
      this.onStatusChange();

      try {
        const cfgRes = await fetch(chrome.runtime.getURL('tts/ema/ema_config.json'));
        if (!cfgRes.ok) {
          throw new Error('EMA Lightning (tts/ema) dosyaları bu pakette bulunmuyor.');
        }
        const cfg = (await cfgRes.json()) as EmaModelConfig;
        this.config = cfg;
        this.stoi = new Map(cfg.vocab.map((ch, idx) => [ch, idx]));

        if (ortRuntime.env?.wasm) {
          ortRuntime.env.wasm.wasmPaths = getLocalWasmUrls().onnxDir;
        }

        const [textBuf, soundBuf, decBuf] = await Promise.all([
          this.fetchLocalArrayBuffer('tts/ema/ema_text.onnx'),
          this.fetchLocalArrayBuffer('tts/ema/ema_sound.onnx'),
          this.fetchLocalArrayBuffer('tts/ema/ema_decoder.onnx'),
        ]);
        this.status.progressPercent = 65;
        this.onStatusChange();

        this.textSession = await ortRuntime.InferenceSession.create(textBuf, {
          executionProviders: ['wasm'],
        });
        this.soundSession = await ortRuntime.InferenceSession.create(soundBuf, {
          executionProviders: ['wasm'],
        });
        this.decoderSession = await ortRuntime.InferenceSession.create(decBuf, {
          executionProviders: ['wasm'],
        });

        this.status.cached = true;
        this.status.ready = true;
        this.status.downloading = false;
        this.status.progressPercent = 100;
        this.status.error = undefined;
        this.onStatusChange();
      } catch (err) {
        this.initPromise = null;
        this.textSession = null;
        this.soundSession = null;
        this.decoderSession = null;
        this.status.ready = false;
        this.status.downloading = false;
        this.status.error = err instanceof Error ? err.message : String(err);
        this.onStatusChange();
        throw err;
      }
    })();

    return this.initPromise;
  }

  async synthesizePcm(text: string, speed: number = 0.87): Promise<{ pcm: Float32Array; sampleRate: number }> {
    await this.ensureReady();
    const cfg = this.config!;
    const normalized = normalizeEmaTurkishText(text, cfg.vocab);
    if (!normalized) return { pcm: new Float32Array(0), sampleRate: cfg.sample_rate };

    // Split on sentence boundaries first so EMA breathes naturally between sentences instead of rushing continuously
    const sentenceGroups = normalized
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const pieces: Array<{ text: string; pauseSec: number }> = [];
    for (let gIdx = 0; gIdx < sentenceGroups.length; gIdx += 1) {
      const subPieces = chunkEmaText(sentenceGroups[gIdx]!, speed);
      for (let sIdx = 0; sIdx < subPieces.length; sIdx += 1) {
        const sp = subPieces[sIdx]!;
        const isLastOverall = gIdx === sentenceGroups.length - 1 && sIdx === subPieces.length - 1;
        const isEndOfSentence = sIdx === subPieces.length - 1;
        pieces.push({
          text: sp.text,
          pauseSec: isLastOverall ? 0 : isEndOfSentence ? 0.24 : sp.pauseSec,
        });
      }
    }
    if (pieces.length === 0) return { pcm: new Float32Array(0), sampleRate: cfg.sample_rate };

    const parts: Float32Array[] = [];
    for (let pIdx = 0; pIdx < pieces.length; pIdx += 1) {
      const piece = pieces[pIdx]!;
      const { ids, cw, wstart, length: L } = buildEmaPieceInputs(piece.text, this.stoi);
      if (L === 0) continue;

      // Stage 1: TextEncoder + Duration
      const idsTensor = new ortRuntime.Tensor('int64', ids, [1, L]);
      const stage1 = await this.textSession!.run({ ids: idsTensor });
      const hTensor = stage1.h!;
      const durData = stage1.dur!.data as Float32Array;

      // Timeline + seeded Gaussian noise (seed=0 matches official Hugging Face demo)
      const { frames: T, fw, cg, fg } = buildEmaTimeline(durData, cw, wstart, speed);
      const noiseData = generateSeededGaussianNoise(cfg.steps, T, cfg.latent_dim, pIdx);

      // Stage 2: Aligner + 4-step DiT flow matching
      const stage2 = await this.soundSession!.run({
        h: hTensor,
        cw: new ortRuntime.Tensor('int64', cw, [1, L]),
        cg: new ortRuntime.Tensor('float32', cg, [1, L]),
        fw: new ortRuntime.Tensor('int64', fw, [1, T]),
        fg: new ortRuntime.Tensor('float32', fg, [1, T]),
        noise: new ortRuntime.Tensor('float32', noiseData, [1, cfg.steps, T, cfg.latent_dim]),
      });
      const latents = stage2.latents!.data as Float32Array; // [1, T, 64]

      // Transpose [1, T, 64] -> [1, 64, T] for HiFi-GAN decoder
      const C = cfg.latent_dim;
      const zTransposed = new Float32Array(C * T);
      for (let t = 0; t < T; t += 1) {
        const srcBase = t * C;
        for (let c = 0; c < C; c += 1) {
          zTransposed[c * T + t] = latents[srcBase + c]!;
        }
      }

      // Stage 3: HiFi-GAN 48 kHz Decoder
      const stage3 = await this.decoderSession!.run({
        z: new ortRuntime.Tensor('float32', zTransposed, [1, C, T]),
      });
      const audio = stage3.audio!.data as Float32Array;
      if (audio.length > 0) {
        parts.push(audio);
        if (piece.pauseSec > 0) {
          parts.push(new Float32Array(Math.round(piece.pauseSec * cfg.sample_rate)));
        }
      }
    }

    const totalLen = parts.reduce((sum, arr) => sum + arr.length, 0);
    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const arr of parts) {
      merged.set(arr, offset);
      offset += arr.length;
    }
    return { pcm: merged, sampleRate: cfg.sample_rate };
  }
}

function broadcastEnStatus(): void {
  try {
    void chrome.runtime.sendMessage({
      type: 'NEURAL_TTS_PROGRESS',
      status: { ...enRunner.status },
    });
  } catch {
    // Ignore when no listener is open
  }
}

function broadcastTrStatus(): void {
  try {
    void chrome.runtime.sendMessage({
      type: 'TURKISH_TTS_PROGRESS',
      status: { ...trRunner.status },
    });
  } catch {
    // Ignore when no listener is open
  }
}

const enRunner = new EnglishPiperRunner(broadcastEnStatus);
const trRunner = new EmaLightningRunner(broadcastTrStatus);

let synthQueue: Promise<void> = Promise.resolve();
let activePlaySeq = 0;
let explicitCancelEpoch = 0;
let activeAudio: HTMLAudioElement | null = null;
let activeBlobUrl: string | null = null;
let activeCoachRequestId: string | null = null;
let coachProgressTimer: ReturnType<typeof setInterval> | null = null;
let activeAudioEndResolver: (() => void) | null = null;

interface QueuedEnSpeech {
  text: string;
  rate: number;
  epoch: number;
  wavPromise: Promise<Blob | null>;
}

const MAX_EN_QUEUE = 12;
const enPlaybackQueue: QueuedEnSpeech[] = [];
let enQueueDraining = false;

const enWavCache = new Map<string, Blob>();
const coachWavCache = new Map<string, { blob: Blob; wordTimings: Array<[number, number]> }>();
const EMA_TEACHER_SPEED = 0.87;

function resolveActiveAudioEnd(): void {
  const resolver = activeAudioEndResolver;
  activeAudioEndResolver = null;
  resolver?.();
}

function putLru<T>(cache: Map<string, T>, key: string, value: T, maxSize: number): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size > maxSize) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

function emitCoachPlayback(progress: CoachPlaybackProgress): void {
  try {
    void chrome.runtime.sendMessage({
      type: 'COACH_TTS_PLAYBACK',
      progress,
    });
  } catch {
    // Ignore when caller closed
  }
}

function clearCoachProgressTimer(): void {
  if (coachProgressTimer !== null) {
    clearInterval(coachProgressTimer);
    coachProgressTimer = null;
  }
}

function stopCurrentPlayback(notifyCoachEnded = false): void {
  clearCoachProgressTimer();
  const prevCoachId = activeCoachRequestId;
  activeCoachRequestId = null;

  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // Ignore
    }
    activeAudio = null;
  }
  if (activeBlobUrl) {
    try {
      URL.revokeObjectURL(activeBlobUrl);
    } catch {
      // Ignore
    }
    activeBlobUrl = null;
  }
  resolveActiveAudioEnd();
  if (notifyCoachEnded && prevCoachId) {
    emitCoachPlayback({
      requestId: prevCoachId,
      playing: false,
      currentSec: 0,
      durationSec: 0,
      ended: true,
    });
  }
}

function playWavBlob(
  blob: Blob,
  rate: number,
  seq: number,
  coachRequestId?: string
): Promise<{ durationSec: number; ended: Promise<void> }> {
  if (seq !== activePlaySeq) return Promise.resolve({ durationSec: 0, ended: Promise.resolve() });
  stopCurrentPlayback(Boolean(activeCoachRequestId && activeCoachRequestId !== coachRequestId));

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.playbackRate = Math.max(0.65, Math.min(1.5, Number.isFinite(rate) ? rate : 1.0));
  activeAudio = audio;
  activeBlobUrl = url;
  activeCoachRequestId = coachRequestId ?? null;

  let myEndResolver: (() => void) | null = null;
  const endedPromise = new Promise<void>((res) => {
    myEndResolver = res;
    activeAudioEndResolver = res;
  });

  const cleanup = (ended = false) => {
    clearCoachProgressTimer();
    if (coachRequestId) {
      const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
      emitCoachPlayback({
        requestId: coachRequestId,
        playing: false,
        currentSec: ended ? 0 : audio.currentTime,
        durationSec: dur,
        ended,
      });
    }
    if (activeAudio === audio) activeAudio = null;
    if (activeBlobUrl === url) activeBlobUrl = null;
    if (activeCoachRequestId === coachRequestId) activeCoachRequestId = null;
    if (myEndResolver && activeAudioEndResolver === myEndResolver) {
      resolveActiveAudioEnd();
    } else if (myEndResolver) {
      const fn = myEndResolver;
      myEndResolver = null;
      fn();
    }
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore
    }
  };

  audio.addEventListener('ended', () => cleanup(true), { once: true });
  audio.addEventListener('error', () => cleanup(true), { once: true });

  if (coachRequestId) {
    coachProgressTimer = setInterval(() => {
      if (activeAudio !== audio || activeCoachRequestId !== coachRequestId) {
        clearCoachProgressTimer();
        return;
      }
      const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
      emitCoachPlayback({
        requestId: coachRequestId,
        playing: !audio.paused && !audio.ended,
        currentSec: audio.currentTime,
        durationSec: dur,
      });
    }, 75);
  }

  return new Promise((resolve, reject) => {
    const startPlay = () => {
      if (seq !== activePlaySeq) {
        cleanup(true);
        resolve({ durationSec: 0, ended: Promise.resolve() });
        return;
      }
      const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
      audio
        .play()
        .then(() => {
          if (coachRequestId) {
            emitCoachPlayback({
              requestId: coachRequestId,
              playing: true,
              currentSec: 0,
              durationSec: dur,
            });
          }
          resolve({ durationSec: dur, ended: endedPromise });
        })
        .catch((err) => {
          cleanup(true);
          reject(err);
        });
    };

    if (audio.readyState >= 1) {
      startPlay();
    } else {
      audio.addEventListener('loadedmetadata', startPlay, { once: true });
      audio.load();
    }
  });
}

async function enqueueSynthesis<T>(fn: () => Promise<T>): Promise<T> {
  let result!: T;
  const job = synthQueue.then(async () => {
    result = await fn();
  });
  synthQueue = job.catch(() => {
    // Keep queue alive after a single error
  });
  await job;
  return result;
}

function getOrSynthEnWav(cleaned: string, epoch: number): Promise<Blob | null> {
  const cached = enWavCache.get(cleaned);
  if (cached) {
    putLru(enWavCache, cleaned, cached, MAX_EN_WAV_CACHE);
    return Promise.resolve(cached);
  }
  return enqueueSynthesis(async () => {
    if (epoch !== activePlaySeq) return null;
    const again = enWavCache.get(cleaned);
    if (again) {
      putLru(enWavCache, cleaned, again, MAX_EN_WAV_CACHE);
      return again;
    }
    await enRunner.ensureReady();
    if (epoch !== activePlaySeq) return null;
    const { pcm, sampleRate } = await enRunner.synthesizePcm(cleaned);
    const blob = new Blob([pcm2wav(pcm, sampleRate)], { type: 'audio/wav' });
    putLru(enWavCache, cleaned, blob, MAX_EN_WAV_CACHE);
    return blob;
  });
}

async function drainEnPlaybackQueue(): Promise<void> {
  if (enQueueDraining) return;
  enQueueDraining = true;
  try {
    while (enPlaybackQueue.length > 0) {
      const item = enPlaybackQueue.shift()!;
      if (item.epoch !== activePlaySeq) continue;
      const wavBlob = await item.wavPromise;
      if (item.epoch !== activePlaySeq || !wavBlob) continue;
      const playRes = await playWavBlob(wavBlob, item.rate, item.epoch);
      if (item.epoch !== activePlaySeq) continue;
      await playRes.ended;
    }
  } catch {
    // Keep queue healthy if an utterance is aborted or blocked
  } finally {
    enQueueDraining = false;
    if (enPlaybackQueue.length > 0) {
      void drainEnPlaybackQueue();
    }
  }
}

async function handleSpeakEnglish(text: string, rate: number, queue = false): Promise<void> {
  const cleaned = text.trim();
  if (!cleaned) return;

  let myEpoch: number;
  if (!queue || activeCoachRequestId !== null) {
    myEpoch = ++activePlaySeq;
    enPlaybackQueue.length = 0;
    stopCurrentPlayback(true);
  } else {
    myEpoch = activePlaySeq;
  }

  if (enPlaybackQueue.length >= MAX_EN_QUEUE) {
    enPlaybackQueue.shift();
  }
  enPlaybackQueue.push({
    text: cleaned,
    rate,
    epoch: myEpoch,
    wavPromise: getOrSynthEnWav(cleaned, myEpoch),
  });
  void drainEnPlaybackQueue();
}

function measureActiveRms(pcm: Float32Array): { rms: number; peak: number } {
  if (pcm.length === 0) return { rms: 0, peak: 0 };
  let sumSq = 0;
  let activeCount = 0;
  let allSumSq = 0;
  let peak = 0;
  for (let i = 0; i < pcm.length; i += 1) {
    const v = pcm[i]!;
    const abs = Math.abs(v);
    if (abs > peak) peak = abs;
    const sq = v * v;
    allSumSq += sq;
    if (abs >= 0.012) {
      sumSq += sq;
      activeCount += 1;
    }
  }
  const rms =
    activeCount >= 32
      ? Math.sqrt(sumSq / activeCount)
      : Math.sqrt(allSumSq / pcm.length);
  return { rms, peak };
}

function normalizeRmsToward(pcm: Float32Array, targetRms: number): Float32Array {
  if (pcm.length === 0 || targetRms <= 0) return pcm;
  const { rms, peak } = measureActiveRms(pcm);
  if (rms < 1e-4 || peak < 1e-4) return pcm;
  const desiredGain = (targetRms * 0.9) / rms;
  const maxSafeGain = 0.88 / peak;
  const gain = Math.max(0.55, Math.min(1.35, desiredGain, maxSafeGain));
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i += 1) {
    out[i] = pcm[i]! * gain;
  }
  return out;
}

/**
 * Synthesize a single Turkish AI grammar rule using EMA Lightning (48 kHz studio Turkish voice,
 * calm 0.87 teacher pace) for Turkish prose and HFC Female (48 kHz upsampled, RMS-matched) for
 * quoted English words, returning exact per-word `[startMs, endMs]` timings for karaoke sync.
 */
async function handleSpeakTurkishCoach(
  text: string,
  rate: number,
  requestId: string
): Promise<{ durationSec: number; wordTimings: Array<[number, number]> }> {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return { durationSec: 0, wordTimings: [] };

  const mySeq = ++activePlaySeq;
  explicitCancelEpoch += 1;
  enPlaybackQueue.length = 0;
  stopCurrentPlayback(true);

  const cached = coachWavCache.get(cleaned);
  if (cached) {
    putLru(coachWavCache, cleaned, cached, MAX_COACH_WAV_CACHE);
    const playRes = await playWavBlob(cached.blob, rate, mySeq, requestId);
    return { durationSec: playRes.durationSec, wordTimings: cached.wordTimings };
  }

  const segments = splitBilingualCoachSegments(cleaned);
  if (segments.length === 0) return { durationSec: 0, wordTimings: [] };

  await trRunner.ensureReady();
  if (mySeq !== activePlaySeq) return { durationSec: 0, wordTimings: [] };

  const hasEnglishSegments = segments.some((s) => s.lang === 'en');
  let canUseEnglishVoice = false;
  if (hasEnglishSegments) {
    try {
      await enRunner.ensureReady();
      canUseEnglishVoice = true;
    } catch {
      canUseEnglishVoice = false;
    }
  }
  if (mySeq !== activePlaySeq) return { durationSec: 0, wordTimings: [] };

  const synthResult = await enqueueSynthesis(async () => {
    if (mySeq !== activePlaySeq) return null;
    const targetSampleRate = 48000;
    const pauseSamples = Math.round(targetSampleRate * 0.11);
    const silenceGap = new Float32Array(pauseSamples);
    const chunks: Float32Array[] = [];
    const tokens = stripCoachMarkupForDisplay(cleaned).split(/\s+/).filter(Boolean);
    const wordTimings: Array<[number, number]> = tokens.map(() => [0, 0]);

    let sampleCursor = 0;
    let observedEmaRms = 0;

    for (let i = 0; i < segments.length; i += 1) {
      if (mySeq !== activePlaySeq) return null;
      const seg = segments[i]!;
      let pcm48: Float32Array;
      if (seg.lang === 'en' && canUseEnglishVoice) {
        const { pcm, sampleRate } = await enRunner.synthesizePcm(seg.text, { embeddedCoach: true });
        pcm48 = resampleLinear(pcm, sampleRate, targetSampleRate);
        pcm48 = normalizeRmsToward(pcm48, observedEmaRms > 0 ? observedEmaRms : 0.14);
      } else {
        const { pcm, sampleRate } = await trRunner.synthesizePcm(seg.text, EMA_TEACHER_SPEED);
        pcm48 = sampleRate === targetSampleRate ? pcm : resampleLinear(pcm, sampleRate, targetSampleRate);
        if (observedEmaRms === 0 && pcm48.length > 0) {
          observedEmaRms = measureActiveRms(pcm48).rms;
        }
      }

      if (pcm48.length > 0) {
        if (chunks.length > 0) {
          chunks.push(silenceGap);
          sampleCursor += pauseSamples;
        }
        const segStartMs = Math.round((sampleCursor / targetSampleRate) * 1000);
        chunks.push(pcm48);
        sampleCursor += pcm48.length;
        const segEndMs = Math.round((sampleCursor / targetSampleRate) * 1000);

        // Distribute segment duration proportionally across its whitespace tokens for karaoke sync
        const wStart = Math.max(0, Math.min(tokens.length, seg.startWordIdx));
        const wEnd = Math.max(wStart, Math.min(tokens.length, seg.endWordIdx));
        if (wEnd > wStart) {
          const weights = [];
          let totalWeight = 0;
          for (let w = wStart; w < wEnd; w += 1) {
            const wLen = Math.max(2, tokens[w]!.replace(/[^A-Za-z0-9ğüşöçıİĞÜŞÖÇ]/g, '').length);
            weights.push(wLen);
            totalWeight += wLen;
          }
          let curMs = segStartMs;
          const spanMs = Math.max(1, segEndMs - segStartMs);
          for (let w = wStart; w < wEnd; w += 1) {
            const share = (weights[w - wStart]! / Math.max(1, totalWeight)) * spanMs;
            const nextMs = w === wEnd - 1 ? segEndMs : Math.round(curMs + share);
            wordTimings[w] = [Math.round(curMs), Math.max(Math.round(curMs) + 40, nextMs)];
            curMs = nextMs;
          }
        }
      }
    }

    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
    if (totalLen === 0) return null;
    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    return {
      blob: new Blob([pcm2wav(merged, targetSampleRate)], { type: 'audio/wav' }),
      wordTimings,
    };
  });

  if (mySeq !== activePlaySeq || !synthResult) return { durationSec: 0, wordTimings: [] };
  putLru(coachWavCache, cleaned, synthResult, MAX_COACH_WAV_CACHE);
  const playRes = await playWavBlob(synthResult.blob, rate, mySeq, requestId);
  return { durationSec: playRes.durationSec, wordTimings: synthResult.wordTimings };
}

function handleCoachControl(
  command: OffscreenTtsMessage['command'],
  value?: number,
  requestId?: string
): { ok: boolean; playing: boolean; currentSec: number; durationSec: number } {
  if (command === 'stop') {
    activePlaySeq += 1;
    explicitCancelEpoch += 1;
    enPlaybackQueue.length = 0;
    stopCurrentPlayback(true);
    return { ok: true, playing: false, currentSec: 0, durationSec: 0 };
  }

  if (!activeAudio || (requestId && activeCoachRequestId && activeCoachRequestId !== requestId)) {
    return { ok: false, playing: false, currentSec: 0, durationSec: 0 };
  }

  const dur = Number.isFinite(activeAudio.duration) ? activeAudio.duration : 0;
  if (command === 'pause') {
    activeAudio.pause();
  } else if (command === 'resume') {
    void activeAudio.play();
  } else if (command === 'seek' && typeof value === 'number' && Number.isFinite(value)) {
    activeAudio.currentTime = Math.max(0, Math.min(dur || value, value));
  } else if (command === 'rate' && typeof value === 'number' && Number.isFinite(value)) {
    activeAudio.playbackRate = Math.max(0.65, Math.min(1.5, value));
  }

  const statePayload: CoachPlaybackProgress = {
    requestId: activeCoachRequestId ?? requestId ?? '',
    playing: !activeAudio.paused && !activeAudio.ended,
    currentSec: activeAudio.currentTime,
    durationSec: dur,
  };
  if (statePayload.requestId) emitCoachPlayback(statePayload);
  return { ok: true, playing: statePayload.playing, currentSec: statePayload.currentSec, durationSec: dur };
}

chrome.runtime.onMessage.addListener((message: OffscreenTtsMessage, _sender, sendResponse) => {
  if (message?.target !== 'tts-offscreen') return false;

  (async () => {
    switch (message.action) {
      case 'CANCEL': {
        activePlaySeq += 1;
        explicitCancelEpoch += 1;
        enPlaybackQueue.length = 0;
        stopCurrentPlayback(true);
        sendResponse({ ok: true });
        break;
      }
      case 'STATUS': {
        await Promise.all([enRunner.refreshAvailability(), trRunner.refreshAvailability()]);
        sendResponse({
          ok: true,
          status: { ...enRunner.status },
          trStatus: { ...trRunner.status },
        });
        break;
      }
      case 'PREPARE': {
        await enRunner.ensureReady();
        sendResponse({ ok: true, status: { ...enRunner.status } });
        break;
      }
      case 'SPEAK': {
        await handleSpeakEnglish(message.text ?? '', message.rate ?? 1.0, Boolean(message.queue));
        sendResponse({ ok: true, status: { ...enRunner.status } });
        break;
      }
      case 'COACH_SPEAK': {
        const res = await handleSpeakTurkishCoach(
          message.text ?? '',
          message.rate ?? 1.0,
          message.requestId ?? `coach_${Date.now()}`
        );
        sendResponse({
          ok: true,
          durationSec: res.durationSec,
          wordTimings: res.wordTimings,
          trStatus: { ...trRunner.status },
        });
        break;
      }
      case 'COACH_CONTROL': {
        const res = handleCoachControl(message.command, message.value, message.requestId);
        sendResponse(res);
        break;
      }
      default:
        sendResponse({ ok: false, error: 'Unknown offscreen TTS action' });
    }
  })().catch((err) => {
    sendResponse({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      status: { ...enRunner.status },
      trStatus: { ...trRunner.status },
    });
  });

  return true;
});
