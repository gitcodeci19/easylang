import type { TtsVoiceMode } from './types.ts';

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
 * Piper AI neural voice (`en_US-hfc_female-medium`) is the permanent English voice
 * across all browsers and surfaces; browser `speechSynthesis` is never used for English.
 */
export function shouldUseNeuralTts(
  _mode: TtsVoiceMode = 'neural',
  _voices: SpeechSynthesisVoice[] = [],
  _isQuickTile: boolean = false
): boolean {
  return true;
}

let speakRequestSeq = 0;
let activeSpeechKind: 'none' | 'normal' | 'tile' = 'none';
let neuralTtsUsedRecently = false;

/**
 * Cancel any queued or currently playing English Piper neural TTS utterance.
 */
export function cancelEnglishSpeech(): void {
  speakRequestSeq += 1;
  activeSpeechKind = 'none';
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
  /**
   * When true, queue behind currently speaking quick-tile utterances instead of cancelling
   * the previous word. Defaults to `true` when `isQuickTile` is true.
   */
  queue?: boolean;
  mode?: TtsVoiceMode;
}

/**
 * Speak English text exclusively using the local Piper AI neural voice (`en_US-hfc_female-medium`).
 * Browser `window.speechSynthesis` is never used.
 *
 * Rapid word-bank tile taps (`isQuickTile: true`) queue sequentially instead of cutting off
 * the previous word, while normal sentence playback interrupts immediately.
 */
export function speakEnglishText(
  text: string,
  rate: number = 1.0,
  options: SpeakOptions = {}
): void {
  const spoken = formatTextForEnglishTts(text, true);
  if (!spoken) return;
  if (typeof chrome === 'undefined' || typeof chrome.runtime?.sendMessage !== 'function') return;

  const isQuickTile = Boolean(options.isQuickTile);
  const queueRequested = options.queue ?? isQuickTile;
  const interruptingNormal = activeSpeechKind === 'normal';
  const shouldInterrupt = !queueRequested || interruptingNormal;
  const shouldQueue = !shouldInterrupt;

  activeSpeechKind = isQuickTile ? 'tile' : 'normal';
  const reqId = ++speakRequestSeq;
  neuralTtsUsedRecently = true;

  try {
    void chrome.runtime
      .sendMessage({
        type: 'SPEAK_NEURAL_TTS',
        text: spoken,
        rate,
        reqId,
        queue: shouldQueue,
      })
      .catch(() => {
        // Ignore when background worker is restarting
      });
  } catch {
    // Ignore messaging errors
  }
}
