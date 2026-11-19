import type { ExtensionSettings, TtsVoiceMode } from './types.ts';

const SINGLE_TOKEN_CONTRACTIONS: Record<string, string> = {
  "i'm": 'I am',
  "i've": 'I have',
  "i'll": 'I will',
  "i'd": 'I would',
  "we're": 'we are',
  "we've": 'we have',
  "we'll": 'we will',
  "we'd": 'we had',
  "you're": 'you are',
  "you've": 'you have',
  "you'll": 'you will',
  "you'd": 'you would',
  "they're": 'they are',
  "they've": 'they have',
  "they'll": 'they will',
  "they'd": 'they would',
  "he's": 'he is',
  "she's": 'she is',
  "it's": 'it is',
  "that's": 'that is',
  "there's": 'there is',
  "what's": 'what is',
  "where's": 'where is',
  "who's": 'who is',
  "let's": 'let us',
  "can't": 'cannot',
  "won't": 'will not',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "haven't": 'have not',
  "hasn't": 'has not',
  "hadn't": 'had not',
};

const UNAMBIGUOUS_INLINE_CONTRACTIONS: ReadonlyArray<[RegExp, (match: string) => string]> = [
  [/\bi'm\b/gi, () => 'I am'],
  [/\b(we|you|they|i|could|would|should|might|must)'ve\b/gi, (m) => {
    const base = m.slice(0, -3);
    const fixedBase = base.toLowerCase() === 'i' ? 'I' : base;
    return `${fixedBase} have`;
  }],
  [/\b(we|you|they)'re\b/gi, (m) => `${m.slice(0, -3)} are`],
  [/\b(i|we|you|they|he|she|it)'ll\b/gi, (m) => {
    const base = m.slice(0, -3);
    const fixedBase = base.toLowerCase() === 'i' ? 'I' : base;
    return `${fixedBase} will`;
  }],
];

/**
 * Normalize English text for clearer browser Web Speech synthesis so Windows/Chrome SAPI
 * engines do not misread contractions (such as pronouncing "we've" as "vi-vi").
 */
export function formatTextForEnglishTts(
  rawText: string,
  hasNativeEnglishVoice: boolean = true
): string {
  const normalized = rawText
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return '';

  const singleKey = normalized.toLowerCase();
  if (!/\s/.test(normalized) && singleKey in SINGLE_TOKEN_CONTRACTIONS) {
    return SINGLE_TOKEN_CONTRACTIONS[singleKey]!;
  }

  let spoken = normalized;
  for (const [pattern, replacer] of UNAMBIGUOUS_INLINE_CONTRACTIONS) {
    spoken = spoken.replace(pattern, replacer);
  }

  if (!hasNativeEnglishVoice) {
    for (const [contracted, expanded] of Object.entries(SINGLE_TOKEN_CONTRACTIONS)) {
      const esc = contracted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      spoken = spoken.replace(new RegExp(`\\b${esc}\\b`, 'gi'), expanded);
    }
  }

  return spoken;
}

/**
 * Pick a native English voice from `speechSynthesis.getVoices()`.
 * When `preferNatural` is true, Chrome/Edge realistic neural/network voices (`Google US English`,
 * `Microsoft Aria/Jenny Natural`) beat robotic offline voices; when false, instant `localService`
 * offline voices win to avoid network buffering stutter on rapid tile clicks.
 */
export function pickBestEnglishVoice(
  voices: SpeechSynthesisVoice[],
  preferNatural: boolean = true
): SpeechSynthesisVoice | null {
  if (!Array.isArray(voices) || voices.length === 0) return null;

  const enVoices = voices.filter((v) => /^en(?:[-_]|$)/i.test(v.lang));
  if (enVoices.length === 0) return null;

  const scoreVoice = (v: SpeechSynthesisVoice): number => {
    const lang = v.lang.toLowerCase().replace('_', '-');
    const name = v.name.toLowerCase();
    let score = 0;

    if (lang === 'en-us') score += 40;
    else if (lang === 'en-gb') score += 30;
    else score += 10;

    if (preferNatural) {
      if (name.includes('google us english')) score += 120;
      else if (name.includes('google uk english')) score += 105;
      else if (name.includes('microsoft') && name.includes('natural')) score += 115;
      else if (name.includes('aria') || name.includes('jenny') || name.includes('guy')) score += 95;
      else if (!v.localService) score += 60;
      else if (name.includes('david') || name.includes('zira') || name.includes('mark') || name.includes('samantha')) {
        score += 20;
      }
    } else {
      if (v.localService) score += 120;
      if (name.includes('david') || name.includes('zira') || name.includes('mark') || name.includes('samantha')) {
        score += 25;
      }
      if (name.includes('google us english')) score += 15;
      else if (name.includes('google uk english')) score += 12;
    }

    return score;
  };

  const ranked = [...enVoices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return ranked[0] ?? null;
}

/**
 * Returns true when the browser exposes a realistic cloud/neural English voice
 * (e.g. Chrome's `Google US English` or Edge's `Microsoft Aria/Jenny Natural`).
 * Browsers like Brave strip Google cloud TTS voices and only expose robotic OS voices,
 * so this helper triggers automatic fallback to our local Piper AI neural voice.
 */
export function hasBrowserNaturalEnglishVoice(voices: SpeechSynthesisVoice[]): boolean {
  if (!Array.isArray(voices) || voices.length === 0) return false;
  return voices.some((v) => {
    if (!/^en(?:[-_]|$)/i.test(v.lang)) return false;
    const name = v.name.toLowerCase();
    if (name.includes('google us english') || name.includes('google uk english')) return true;
    if (name.includes('microsoft') && name.includes('natural')) return true;
    if (
      !v.localService &&
      (name.includes('aria') ||
        name.includes('jenny') ||
        name.includes('guy') ||
        name.includes('sonia') ||
        name.includes('libby'))
    ) {
      return true;
    }
    if (
      (name.includes('enhanced') || name.includes('premium')) &&
      (name.includes('samantha') || name.includes('ava') || name.includes('allison') || name.includes('daniel'))
    ) {
      return true;
    }
    return false;
  });
}

/**
 * Decide whether a speech request should be routed to the local Piper AI neural engine
 * instead of `window.speechSynthesis`.
 */
export function shouldUseNeuralTts(
  mode: TtsVoiceMode,
  voices: SpeechSynthesisVoice[],
  isQuickTile: boolean = false
): boolean {
  if (mode === 'local') return false;
  if (mode === 'neural') return true;
  if (mode === 'natural') return !hasBrowserNaturalEnglishVoice(voices);
  // hybrid: sentences use Piper automatically when browser lacks a natural English voice (e.g. Brave)
  return !isQuickTile && !hasBrowserNaturalEnglishVoice(voices);
}

let cachedTtsMode: TtsVoiceMode = 'hybrid';
let storageListenerAttached = false;
let neuralTtsUsedRecently = false;

function isValidTtsMode(value: unknown): value is TtsVoiceMode {
  return value === 'hybrid' || value === 'neural' || value === 'natural' || value === 'local';
}

function initTtsPreferenceSync(): void {
  if (storageListenerAttached || typeof chrome === 'undefined' || !chrome.storage?.sync) {
    return;
  }
  storageListenerAttached = true;

  try {
    void chrome.storage.sync.get('settings', (res) => {
      const s = res?.settings as Partial<ExtensionSettings> | undefined;
      if (isValidTtsMode(s?.ttsVoiceMode)) {
        cachedTtsMode = s.ttsVoiceMode;
      }
    });
    chrome.storage.onChanged?.addListener((changes, areaName) => {
      if (areaName !== 'sync' || !changes.settings?.newValue) return;
      const s = changes.settings.newValue as Partial<ExtensionSettings>;
      if (isValidTtsMode(s?.ttsVoiceMode)) {
        cachedTtsMode = s.ttsVoiceMode;
      }
    });
  } catch {
    // Ignore storage access errors in non-extension test environments
  }
}

let speakRequestSeq = 0;
let activeUtteranceRef: SpeechSynthesisUtterance | null = null;
let pendingSpeakTimer: ReturnType<typeof setTimeout> | null = null;

function waitForVoicesOnce(synth: SpeechSynthesis, maxWaitMs: number = 300): Promise<void> {
  if (synth.getVoices().length > 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (typeof synth.removeEventListener === 'function') {
        synth.removeEventListener('voiceschanged', finish);
      }
      resolve();
    };
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', finish, { once: true });
    }
    setTimeout(finish, maxWaitMs);
  });
}

/**
 * Cancel any queued or currently playing English TTS utterance (browser or Piper neural).
 */
export function cancelEnglishSpeech(): void {
  speakRequestSeq += 1;
  if (pendingSpeakTimer) {
    clearTimeout(pendingSpeakTimer);
    pendingSpeakTimer = null;
  }
  activeUtteranceRef = null;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore cancel errors
    }
  }
  if (neuralTtsUsedRecently && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      void chrome.runtime.sendMessage({ type: 'CANCEL_NEURAL_TTS' }).catch(() => {
        // Ignore when background worker is inactive
      });
    } catch {
      // Ignore messaging errors
    }
  }
}

export interface SpeakOptions {
  isQuickTile?: boolean;
  mode?: TtsVoiceMode;
}

function speakWithBrowserSynth(
  synth: SpeechSynthesis,
  text: string,
  rate: number,
  preferNatural: boolean,
  reqId: number
): void {
  if (reqId !== speakRequestSeq) return;
  try {
    const voice = pickBestEnglishVoice(synth.getVoices(), preferNatural);
    const spoken = formatTextForEnglishTts(text, Boolean(voice));
    if (!spoken) return;

    const utter = new SpeechSynthesisUtterance(spoken);
    activeUtteranceRef = utter;
    utter.onend = () => {
      if (activeUtteranceRef === utter) activeUtteranceRef = null;
    };
    utter.onerror = () => {
      if (activeUtteranceRef === utter) activeUtteranceRef = null;
    };
    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang;
    } else {
      utter.lang = 'en-US';
    }
    utter.rate = rate;
    synth.speak(utter);
  } catch {
    // Ignore speech synthesis errors when audio context is blocked
  }
}

/**
 * Speak English text using Chrome/Edge's realistic natural voice (`Google US English` /
 * `Microsoft Natural`) when available, automatically upgrading to the local Piper AI
 * neural voice (`en_US-hfc_female-medium`) on browsers without natural cloud voices
 * (e.g. Brave) or whenever the user selects `neural` mode.
 */
export function speakEnglishText(
  text: string,
  rate: number = 1.0,
  options: SpeakOptions = {}
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  initTtsPreferenceSync();

  const synth = window.speechSynthesis;
  const reqId = ++speakRequestSeq;
  const effectiveMode = options.mode ?? cachedTtsMode;
  const isQuickTile = Boolean(options.isQuickTile);
  const preferNatural =
    effectiveMode === 'natural' || effectiveMode === 'neural'
      ? true
      : effectiveMode === 'local'
        ? false
        : !isQuickTile;

  if (pendingSpeakTimer) {
    clearTimeout(pendingSpeakTimer);
    pendingSpeakTimer = null;
  }

  const wasBusy = synth.speaking || synth.pending;
  if (wasBusy) {
    try {
      synth.cancel();
    } catch {
      // Ignore cancel errors
    }
  }
  if (neuralTtsUsedRecently && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      void chrome.runtime.sendMessage({ type: 'CANCEL_NEURAL_TTS' }).catch(() => {
        // Ignore cancel errors
      });
    } catch {
      // Ignore messaging errors
    }
  }

  const dispatchNow = () => {
    if (reqId !== speakRequestSeq) return;
    const voices = synth.getVoices();
    const canMessageBg = typeof chrome !== 'undefined' && typeof chrome.runtime?.sendMessage === 'function';

    if (canMessageBg && shouldUseNeuralTts(effectiveMode, voices, isQuickTile)) {
      const spoken = formatTextForEnglishTts(text, true);
      if (!spoken) return;
      neuralTtsUsedRecently = true;
      chrome.runtime
        .sendMessage({ type: 'SPEAK_NEURAL_TTS', text: spoken, rate, reqId })
        .then((res: { ok?: boolean } | undefined) => {
          if (reqId !== speakRequestSeq) return;
          if (!res?.ok) {
            speakWithBrowserSynth(synth, text, rate, preferNatural, reqId);
          }
        })
        .catch(() => {
          if (reqId !== speakRequestSeq) return;
          speakWithBrowserSynth(synth, text, rate, preferNatural, reqId);
        });
      return;
    }

    speakWithBrowserSynth(synth, text, rate, preferNatural, reqId);
  };

  if (effectiveMode === 'neural' || synth.getVoices().length > 0) {
    if (wasBusy) {
      pendingSpeakTimer = setTimeout(dispatchNow, 30);
    } else {
      dispatchNow();
    }
    return;
  }

  void waitForVoicesOnce(synth, 300).then(() => {
    if (reqId !== speakRequestSeq) return;
    dispatchNow();
  });
}
