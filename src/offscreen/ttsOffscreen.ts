import * as tts from '@mintplex-labs/piper-tts-web';
import * as ort from 'onnxruntime-web/wasm';
import type { NeuralTtsStatus } from '../shared/types.ts';

const DEFAULT_VOICE_ID = 'en_US-hfc_female-medium' as const;
const MAX_WAV_CACHE_ENTRIES = 48;

// Force single-threaded WASM inside MV3 offscreen documents (no SharedArrayBuffer / blob worker CSP issues).
// piper-tts-web assigns `ort.env.wasm.numThreads = navigator.hardwareConcurrency` during init(),
// so locking the property ensures onnxruntime-web always uses local `ort-wasm-simd.wasm`.
try {
  const ortAny = (ort as unknown as { default?: typeof ort }).default ?? ort;
  if (ortAny?.env?.wasm) {
    ortAny.env.wasm.proxy = false;
    Object.defineProperty(ortAny.env.wasm, 'numThreads', {
      get: () => 1,
      set: () => {
        // Keep single-threaded for MV3 CSP compatibility
      },
      configurable: true,
    });
  }
} catch {
  // Ignore if env.wasm is non-configurable
}

interface OffscreenTtsMessage {
  target?: string;
  action?: 'SPEAK' | 'CANCEL' | 'PREPARE' | 'STATUS';
  text?: string;
  rate?: number;
}

const state: NeuralTtsStatus = {
  voiceId: DEFAULT_VOICE_ID,
  cached: false,
  ready: false,
  downloading: false,
  progressPercent: 0,
};

let sessionPromise: Promise<tts.TtsSession> | null = null;
let sessionInstance: tts.TtsSession | null = null;
let synthQueue: Promise<void> = Promise.resolve();
let activePlaySeq = 0;
let activeAudio: HTMLAudioElement | null = null;
let activeBlobUrl: string | null = null;

const wavCache = new Map<string, Blob>();

function getLocalWasmPaths() {
  return {
    onnxWasm: chrome.runtime.getURL('tts/'),
    piperWasm: chrome.runtime.getURL('tts/piper_phonemize.wasm'),
    piperData: chrome.runtime.getURL('tts/piper_phonemize.data'),
  };
}

function broadcastStatus(): void {
  try {
    void chrome.runtime.sendMessage({
      type: 'NEURAL_TTS_PROGRESS',
      status: { ...state },
    });
  } catch {
    // Ignore when no listener is open (e.g. options page closed)
  }
}

async function refreshCachedFlag(): Promise<boolean> {
  try {
    const storedVoices = await tts.stored();
    state.cached = storedVoices.includes(DEFAULT_VOICE_ID);
    if (state.cached && !state.downloading) {
      state.progressPercent = 100;
    }
    return state.cached;
  } catch {
    return state.cached;
  }
}

function stopCurrentPlayback(): void {
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // Ignore audio pause errors
    }
    activeAudio = null;
  }
  if (activeBlobUrl) {
    try {
      URL.revokeObjectURL(activeBlobUrl);
    } catch {
      // Ignore revoke errors
    }
    activeBlobUrl = null;
  }
}

function putWavCache(key: string, blob: Blob): void {
  if (wavCache.has(key)) {
    wavCache.delete(key);
  }
  wavCache.set(key, blob);
  if (wavCache.size > MAX_WAV_CACHE_ENTRIES) {
    const oldestKey = wavCache.keys().next().value;
    if (oldestKey !== undefined) {
      wavCache.delete(oldestKey);
    }
  }
}

async function ensureSession(): Promise<tts.TtsSession> {
  if (sessionInstance && state.ready) {
    return sessionInstance;
  }
  if (sessionPromise) {
    return sessionPromise;
  }

  sessionPromise = (async () => {
    state.error = undefined;
    const alreadyCached = await refreshCachedFlag();
    if (!alreadyCached) {
      state.downloading = true;
      state.progressPercent = 1;
      broadcastStatus();
    }

    try {
      const session = await tts.TtsSession.create({
        voiceId: DEFAULT_VOICE_ID,
        wasmPaths: getLocalWasmPaths(),
        progress: (prog) => {
          if (prog.url === tts.INFERENCE_PROGRESS_URL) return;
          if (prog.total > 0) {
            const pct = Math.max(1, Math.min(99, Math.round((prog.loaded / prog.total) * 100)));
            if (pct !== state.progressPercent) {
              state.downloading = true;
              state.progressPercent = pct;
              broadcastStatus();
            }
          }
        },
      });

      sessionInstance = session;
      state.cached = true;
      state.ready = true;
      state.downloading = false;
      state.progressPercent = 100;
      state.error = undefined;
      broadcastStatus();
      return session;
    } catch (err) {
      sessionPromise = null;
      sessionInstance = null;
      tts.TtsSession._instance = null;
      state.ready = false;
      state.downloading = false;
      state.error = err instanceof Error ? err.message : String(err);
      broadcastStatus();
      throw err;
    }
  })();

  return sessionPromise;
}

function playWavBlob(blob: Blob, rate: number, seq: number): Promise<void> {
  if (seq !== activePlaySeq) return Promise.resolve();
  stopCurrentPlayback();

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.playbackRate = Math.max(0.55, Math.min(1.5, Number.isFinite(rate) ? rate : 1.0));
  activeAudio = audio;
  activeBlobUrl = url;

  const cleanup = () => {
    if (activeAudio === audio) {
      activeAudio = null;
    }
    if (activeBlobUrl === url) {
      activeBlobUrl = null;
    }
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore revoke errors
    }
  };

  audio.addEventListener('ended', cleanup, { once: true });
  audio.addEventListener('error', cleanup, { once: true });

  return audio.play().catch((err) => {
    cleanup();
    throw err;
  });
}

async function handleSpeak(text: string, rate: number): Promise<void> {
  const cleaned = text.trim();
  if (!cleaned) return;

  const mySeq = ++activePlaySeq;
  stopCurrentPlayback();

  const cachedBlob = wavCache.get(cleaned);
  if (cachedBlob) {
    // Refresh LRU order
    putWavCache(cleaned, cachedBlob);
    await playWavBlob(cachedBlob, rate, mySeq);
    return;
  }

  const session = await ensureSession();
  if (mySeq !== activePlaySeq) return;

  // Serialize ONNX + eSpeak WASM inference so concurrent clicks never collide
  let wavBlob: Blob | null = null;
  const job = synthQueue.then(async () => {
    if (mySeq !== activePlaySeq) return;
    wavBlob = await session.predict(cleaned);
  });
  synthQueue = job.catch(() => {
    // Keep queue alive after a single failed inference
  });
  await job;

  if (mySeq !== activePlaySeq || !wavBlob) return;
  putWavCache(cleaned, wavBlob);
  await playWavBlob(wavBlob, rate, mySeq);
}

chrome.runtime.onMessage.addListener((message: OffscreenTtsMessage, _sender, sendResponse) => {
  if (message?.target !== 'tts-offscreen') return false;

  (async () => {
    switch (message.action) {
      case 'CANCEL': {
        activePlaySeq += 1;
        stopCurrentPlayback();
        sendResponse({ ok: true });
        break;
      }
      case 'STATUS': {
        await refreshCachedFlag();
        sendResponse({ ok: true, status: { ...state } });
        break;
      }
      case 'PREPARE': {
        await ensureSession();
        sendResponse({ ok: true, status: { ...state } });
        break;
      }
      case 'SPEAK': {
        await handleSpeak(message.text ?? '', message.rate ?? 1.0);
        sendResponse({ ok: true, status: { ...state } });
        break;
      }
      default:
        sendResponse({ ok: false, error: 'Unknown offscreen TTS action' });
    }
  })().catch((err) => {
    sendResponse({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      status: { ...state },
    });
  });

  return true;
});
