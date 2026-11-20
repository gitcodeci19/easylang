import {
  type AiGrammarCoachController,
  createAiGrammarCoachView,
  stopActiveTurkishCoachAudio,
} from './aiGrammarCoachView';
import { renderHighlightedPhrase, renderHighlightedSentence } from './grammarHighlighter';
import {
  createGuideHelpButton,
  getActiveGuideAssistantId,
  registerBeforeGuidePlayHook,
  stopGuideAssistant,
} from './guideAssistant';
import { resolveSupportedLanguage } from './i18n';
import { findActiveWordIndex, REMEDIAL_AUDIO_WORD_TIMINGS } from './remedialAudioTimings';
import { REMEDIAL_QUESTION_AUDIO_WORD_TIMINGS } from './remedialQuestionAudioTimings';
import { getRemedialQuestionAudioRelativePath } from './remedialQuestionScripts';
import { cancelEnglishSpeech, speakEnglishText as speakEnglish } from './speech';
import type { FeedbackLanguageMode, VoiceCoachRuleId } from './types';
import { getVoiceCoachRuleSpec, VOICE_COACH_RULE_ORDER } from './voiceCoachCatalog';

let activeRuleAudio: HTMLAudioElement | null = null;
let activeRuleStopCallback: (() => void) | null = null;
let activeWebAudioCtx: AudioContext | null = null;
let activeWebAudioSource: AudioBufferSourceNode | null = null;

registerBeforeGuidePlayHook(() => {
  stopActiveRuleAudio();
});

/**
 * Stop any currently playing voiceover track cleanly across popup, options, or web widget.
 * Pass `includeCoach = false` when EMA coach audio is about to replace playback itself,
 * avoiding an async IPC stop race.
 */
export function stopActiveRuleAudio(includeCoach = true): void {
  if (activeRuleAudio) {
    try {
      activeRuleAudio.pause();
      activeRuleAudio.currentTime = 0;
      activeRuleAudio.removeAttribute('src');
    } catch {
      // Ignore cleanup failures
    }
    activeRuleAudio = null;
  }
  if (activeWebAudioSource) {
    try {
      activeWebAudioSource.stop();
      activeWebAudioSource.disconnect();
    } catch {
      // Already stopped
    }
    activeWebAudioSource = null;
  }
  if (activeWebAudioCtx) {
    try {
      void activeWebAudioCtx.close();
    } catch {
      // Ignore
    }
    activeWebAudioCtx = null;
  }
  if (activeRuleStopCallback) {
    const cb = activeRuleStopCallback;
    activeRuleStopCallback = null;
    cb();
  }
  if (includeCoach) {
    stopActiveTurkishCoachAudio();
  }
}

export function getRemedialAudioRelativePath(skillId: VoiceCoachRuleId): string {
  return `audio/remedial/${skillId}.mp3`;
}

function resolveExtensionRelativeUrl(rel: string): string {
  if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
    return chrome.runtime.getURL(rel);
  }
  return rel;
}

function resolveExtensionAudioUrl(skillId: VoiceCoachRuleId): string {
  return resolveExtensionRelativeUrl(getRemedialAudioRelativePath(skillId));
}

function formatAudioSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const total = Math.floor(sec);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export interface CreateRuleAudioPlayerOptions {
  skillId: VoiceCoachRuleId;
  isTr: boolean;
  crimson?: boolean;
  compact?: boolean;
  autoPlay?: boolean;
  onTimeMs?: (currentMs: number, isPlaying: boolean) => void;
  /** Optional relative audio path (e.g. `audio/remedial_questions/was_vs_were__duel_1.mp3`) overriding the skill rule track. */
  customAudioRelativePath?: string;
  /** Optional custom play button tooltip when overriding the audio track. */
  customPlayTitle?: string;
  /** Optional callback fired if the bundled MP3 track cannot be loaded (e.g. not yet generated). */
  onAudioUnavailable?: () => void;
}

export interface RuleAudioPlayerController {
  element: HTMLElement;
  dispose: () => void;
  seekToMs: (ms: number, autoPlay?: boolean) => void;
  setOnTimeMs: (listener: ((currentMs: number, isPlaying: boolean) => void) | null) => void;
}

/**
 * Shared word-by-word karaoke highlighter + click-to-seek renderer for any
 * transcript with 1-to-1 acoustic [startMs, endMs] timestamps.
 */
function mountSyncedWordSpans(
  container: HTMLElement,
  timings: ReadonlyArray<readonly [number, number]> | undefined,
  text: string,
  onSeekMs?: (startMs: number) => void
): { update: (currentMs: number, isPlaying: boolean) => void } {
  const tokens = text.trim().split(/\s+/).filter(Boolean);

  if (!timings || timings.length !== tokens.length) {
    container.textContent = text;
    return { update: () => {} };
  }

  container.replaceChildren();
  const spans: HTMLSpanElement[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    if (i > 0) {
      container.appendChild(document.createTextNode(' '));
    }
    const span = document.createElement('span');
    span.className = 'tm-sync-word';
    span.textContent = tokens[i]!;
    if (onSeekMs) {
      const startMs = timings[i]![0];
      span.classList.add('is-seekable');
      span.title = 'Bu kelimeden dinle';
      span.addEventListener('click', () => onSeekMs(startMs));
    }
    spans.push(span);
    container.appendChild(span);
  }

  let activeIdx = -1;

  return {
    update: (currentMs: number, isPlaying: boolean) => {
      const nextIdx =
        currentMs < 0 || (!isPlaying && currentMs === 0)
          ? -1
          : findActiveWordIndex(timings, currentMs);

      if (nextIdx === activeIdx) return;
      if (activeIdx >= 0 && activeIdx < spans.length) {
        spans[activeIdx]!.classList.remove('is-active');
      }
      if (nextIdx >= 0 && nextIdx < spans.length) {
        spans[nextIdx]!.classList.add('is-active');
      }
      activeIdx = nextIdx;
    },
  };
}

/**
 * Mount clickable, word-by-word synchronized transcript spans inside `container`.
 * When `skillId` has acoustic timestamps matching `text`'s whitespace tokens, each word
 * illuminates in lockstep with audio playback and supports click-to-seek.
 */
export function mountSyncedTranscript(
  container: HTMLElement,
  skillId: VoiceCoachRuleId,
  text: string,
  isTr: boolean,
  onSeekMs?: (startMs: number) => void
): { update: (currentMs: number, isPlaying: boolean) => void } {
  if (!isTr) {
    container.textContent = text;
    return { update: () => {} };
  }
  return mountSyncedWordSpans(container, REMEDIAL_AUDIO_WORD_TIMINGS[skillId], text, onSeekMs);
}

/**
 * Build a compact studio voiceover audio player bar backed by bundled ElevenLabs MP3 files.
 * Includes Play/Pause, Restart, 60fps seekable timeline + word sync clock, mm:ss clock, and speed control.
 */
export function createRuleAudioPlayer(
  options: CreateRuleAudioPlayerOptions
): RuleAudioPlayerController {
  const { skillId, isTr } = options;
  const spec = getVoiceCoachRuleSpec(skillId);
  const resolvedTrackUrl = options.customAudioRelativePath
    ? resolveExtensionRelativeUrl(options.customAudioRelativePath)
    : resolveExtensionAudioUrl(skillId);

  const bar = document.createElement('div');
  bar.className = `tm-audio-bar ${options.crimson ? 'is-crimson' : ''} ${
    options.compact ? 'is-compact' : ''
  }`;

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'tm-audio-play-btn';
  playBtn.textContent = '▶';
  playBtn.title =
    options.customPlayTitle ??
    (isTr
      ? `Sesli Anlatımı Dinle / Duraklat (${spec.titleTr.split('(')[0]!.trim()})`
      : `Play / Pause Voiceover (${spec.titleEn.split('(')[0]!.trim()})`);

  const restartBtn = document.createElement('button');
  restartBtn.type = 'button';
  restartBtn.className = 'tm-audio-mini-btn';
  restartBtn.textContent = '↺';
  restartBtn.title = isTr ? 'Baştan Oynat' : 'Restart';

  const rangeEl = document.createElement('input');
  rangeEl.type = 'range';
  rangeEl.className = 'tm-audio-range';
  rangeEl.min = '0';
  rangeEl.max = '100';
  rangeEl.step = '0.02';
  rangeEl.value = '0';
  rangeEl.setAttribute(
    'aria-label',
    isTr ? 'Sesli anlatım ilerlemesi' : 'Voiceover progress'
  );

  const timeSpan = document.createElement('span');
  timeSpan.className = 'tm-audio-time';
  timeSpan.textContent = '0:00';

  const speeds = [0.85, 1.0, 1.15];
  let speedIdx = 1;
  const speedBtn = document.createElement('button');
  speedBtn.type = 'button';
  speedBtn.className = 'tm-audio-speed-btn';
  speedBtn.textContent = '1.0x';
  speedBtn.title = isTr ? 'Oynatma Hızı' : 'Playback Speed';

  bar.append(playBtn, restartBtn, rangeEl, timeSpan, speedBtn);

  let audio: HTMLAudioElement | null = null;
  let disposed = false;
  let isPlayingWebAudio = false;
  let webAudioDecoded: AudioBuffer | null = null;
  let webAudioStartCtxTime = 0;
  let webAudioOffsetSec = 0;
  let webAudioRate = speeds[speedIdx] ?? 1.0;
  let syncRafId: number | null = null;
  let timeListener: ((currentMs: number, isPlaying: boolean) => void) | null =
    options.onTimeMs ?? null;

  const stopSyncLoop = (): void => {
    if (syncRafId !== null) {
      cancelAnimationFrame(syncRafId);
      syncRafId = null;
    }
  };

  const emitTime = (currentMs: number, isPlaying: boolean): void => {
    timeListener?.(currentMs, isPlaying);
  };

  const getWebAudioCurrentSec = (): number => {
    if (!isPlayingWebAudio || !activeWebAudioCtx || !webAudioDecoded) return 0;
    const elapsed = (activeWebAudioCtx.currentTime - webAudioStartCtxTime) * webAudioRate;
    return Math.max(0, Math.min(webAudioDecoded.duration, webAudioOffsetSec + elapsed));
  };

  const tickSync = (): void => {
    syncRafId = null;
    if (disposed) return;

    if (isPlayingWebAudio && activeWebAudioCtx && webAudioDecoded) {
      const sec = getWebAudioCurrentSec();
      const dur = webAudioDecoded.duration;
      rangeEl.max = String(dur);
      rangeEl.value = String(sec);
      timeSpan.textContent = `${formatAudioSeconds(sec)} / ${formatAudioSeconds(dur)}`;
      emitTime(sec * 1000, true);
      syncRafId = requestAnimationFrame(tickSync);
      return;
    }

    if (audio && !audio.paused && !audio.ended) {
      const sec = audio.currentTime;
      const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      if (dur > 0) {
        rangeEl.max = String(dur);
        rangeEl.value = String(sec);
        timeSpan.textContent = `${formatAudioSeconds(sec)} / ${formatAudioSeconds(dur)}`;
      }
      emitTime(sec * 1000, true);
      syncRafId = requestAnimationFrame(tickSync);
    }
  };

  const startSyncLoop = (): void => {
    stopSyncLoop();
    if (!disposed) {
      syncRafId = requestAnimationFrame(tickSync);
    }
  };

  const syncPlayUi = (playing: boolean): void => {
    playBtn.textContent = playing ? '⏸' : '▶';
    bar.classList.toggle('is-playing', playing);
    if (playing) {
      startSyncLoop();
    } else {
      stopSyncLoop();
    }
  };

  const resetUi = (): void => {
    isPlayingWebAudio = false;
    syncPlayUi(false);
    emitTime(-1, false);
  };

  const playViaWebAudioFallback = async (startOffsetSec = 0): Promise<void> => {
    stopGuideAssistant();
    stopActiveRuleAudio();
    cancelEnglishSpeech();
    try {
      let decoded = webAudioDecoded;
      const ctx = new AudioContext();
      activeWebAudioCtx = ctx;
      if (!decoded) {
        const resp = await fetch(resolvedTrackUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buf = await resp.arrayBuffer();
        if (disposed) return;
        decoded = await ctx.decodeAudioData(buf);
        if (disposed) return;
        webAudioDecoded = decoded;
      }
      const clampedStart = Math.max(0, Math.min(decoded.duration - 0.05, startOffsetSec));
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      webAudioRate = speeds[speedIdx] ?? 1.0;
      src.playbackRate.value = webAudioRate;
      src.connect(ctx.destination);
      activeWebAudioSource = src;
      activeRuleStopCallback = resetUi;
      webAudioOffsetSec = clampedStart;
      webAudioStartCtxTime = ctx.currentTime;
      isPlayingWebAudio = true;
      rangeEl.max = String(decoded.duration);
      rangeEl.value = String(clampedStart);
      syncPlayUi(true);
      emitTime(clampedStart * 1000, true);
      src.onended = () => {
        if (activeWebAudioSource === src) {
          isPlayingWebAudio = false;
          if (!disposed) {
            syncPlayUi(false);
            rangeEl.value = '0';
            timeSpan.textContent = `0:00 / ${formatAudioSeconds(decoded.duration)}`;
            emitTime(-1, false);
          }
        }
      };
      src.start(0, clampedStart);
    } catch {
      timeSpan.textContent = isTr ? 'Ses eklenmedi' : 'Audio missing';
      syncPlayUi(false);
      emitTime(-1, false);
      options.onAudioUnavailable?.();
    }
  };

  const ensureAudio = (): HTMLAudioElement => {
    if (audio) return audio;
    const el = new Audio(resolvedTrackUrl);
    el.preload = 'metadata';
    const initialRate = speeds[speedIdx] ?? 1.0;
    el.defaultPlaybackRate = initialRate;
    el.playbackRate = initialRate;
    el.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        rangeEl.max = String(el.duration);
        timeSpan.textContent = `${formatAudioSeconds(el.currentTime)} / ${formatAudioSeconds(el.duration)}`;
      }
    });
    el.addEventListener('timeupdate', () => {
      const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
      rangeEl.value = String(el.currentTime);
      timeSpan.textContent = dur
        ? `${formatAudioSeconds(el.currentTime)} / ${formatAudioSeconds(dur)}`
        : formatAudioSeconds(el.currentTime);
    });
    el.addEventListener('ended', () => {
      syncPlayUi(false);
      rangeEl.value = '0';
      emitTime(-1, false);
    });
    el.addEventListener('pause', () => {
      syncPlayUi(false);
      emitTime(el.currentTime * 1000, false);
    });
    el.addEventListener('play', () => {
      syncPlayUi(true);
      emitTime(el.currentTime * 1000, true);
    });
    audio = el;
    return el;
  };

  const seekToMs = (ms: number, autoPlay = true): void => {
    const targetSec = Math.max(0, ms / 1000);
    if (isPlayingWebAudio) {
      void playViaWebAudioFallback(targetSec);
      return;
    }
    const el = ensureAudio();
    const applySeek = (): void => {
      const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : targetSec + 1;
      el.currentTime = Math.min(dur, targetSec);
      rangeEl.value = String(el.currentTime);
      emitTime(el.currentTime * 1000, !el.paused || autoPlay);
    };

    if (el.readyState >= 1) {
      applySeek();
    } else {
      el.addEventListener('loadedmetadata', applySeek, { once: true });
    }

    if (autoPlay) {
      stopGuideAssistant();
      cancelEnglishSpeech();
      if (activeRuleAudio && activeRuleAudio !== el) {
        stopActiveRuleAudio();
      } else if (activeWebAudioSource) {
        stopActiveRuleAudio();
      }
      activeRuleAudio = el;
      activeRuleStopCallback = resetUi;
      void el.play().catch(() => playViaWebAudioFallback(targetSec));
    }
  };

  const togglePlay = async (): Promise<void> => {
    if (isPlayingWebAudio) {
      stopActiveRuleAudio();
      return;
    }
    const el = ensureAudio();
    if (!el.paused) {
      el.pause();
      return;
    }
    stopGuideAssistant();
    cancelEnglishSpeech();
    if (activeRuleAudio && activeRuleAudio !== el) {
      stopActiveRuleAudio();
    } else if (activeWebAudioSource) {
      stopActiveRuleAudio();
    }
    activeRuleAudio = el;
    activeRuleStopCallback = resetUi;
    try {
      await el.play();
    } catch {
      await playViaWebAudioFallback(el.currentTime || 0);
    }
  };

  playBtn.addEventListener('click', () => {
    void togglePlay();
  });

  restartBtn.addEventListener('click', () => {
    seekToMs(0, true);
  });

  rangeEl.addEventListener('input', () => {
    const target = Number(rangeEl.value);
    if (!Number.isFinite(target)) return;
    if (isPlayingWebAudio) {
      void playViaWebAudioFallback(target);
      return;
    }
    const el = ensureAudio();
    el.currentTime = target;
    emitTime(target * 1000, !el.paused);
  });

  speedBtn.addEventListener('click', () => {
    if (isPlayingWebAudio && activeWebAudioCtx) {
      webAudioOffsetSec = getWebAudioCurrentSec();
      webAudioStartCtxTime = activeWebAudioCtx.currentTime;
    }
    speedIdx = (speedIdx + 1) % speeds.length;
    const rate = speeds[speedIdx] ?? 1.0;
    webAudioRate = rate;
    speedBtn.textContent = `${rate.toFixed(rate === 1 ? 1 : 2).replace(/\.00$/, '.0')}x`;
    if (audio) {
      audio.defaultPlaybackRate = rate;
      audio.playbackRate = rate;
    }
    if (activeWebAudioSource) activeWebAudioSource.playbackRate.value = rate;
  });

  // Preload metadata quietly inside popup/options so duration appears immediately
  try {
    ensureAudio();
  } catch {
    // Ignore preload failure
  }

  if (options.autoPlay) {
    void togglePlay();
  }

  return {
    element: bar,
    seekToMs,
    setOnTimeMs: (listener) => {
      timeListener = listener;
    },
    dispose: () => {
      disposed = true;
      stopSyncLoop();
      timeListener = null;
      if (audio && activeRuleAudio === audio) {
        stopActiveRuleAudio();
      } else if (audio) {
        try {
          audio.pause();
          audio.removeAttribute('src');
        } catch {
          // Ignore
        }
      }
      audio = null;
    },
  };
}

/**
 * Build a compact inline audio player bound to a specific pre-authored remedial question's
 * ElevenLabs voiceover MP3 (`audio/remedial_questions/<questionAudioId>.mp3`).
 */
export function createQuestionAudioPlayer(options: {
  skillId: VoiceCoachRuleId;
  questionAudioId: string;
  isTr: boolean;
  crimson?: boolean;
  compact?: boolean;
  onAudioUnavailable?: () => void;
}): RuleAudioPlayerController {
  return createRuleAudioPlayer({
    skillId: options.skillId,
    isTr: options.isTr,
    crimson: options.crimson ?? true,
    compact: options.compact ?? true,
    customAudioRelativePath: getRemedialQuestionAudioRelativePath(options.questionAudioId),
    customPlayTitle: options.isTr
      ? 'Bu soruya özel sesli anlatımı oynat / duraklat'
      : 'Play / pause voice explanation for this question',
    onAudioUnavailable: options.onAudioUnavailable,
  });
}

export interface QuestionVoiceCardController {
  element: HTMLElement;
  /** Automatically activate and start narration (used when user answers wrong without listening first). */
  playAutoOnWrong: () => void;
  /** Returns true if the learner manually clicked to play narration on this question. */
  wasPlayedManually: () => boolean;
  /** Cleanly stops playback and releases listeners/RAF handles. */
  dispose: () => void;
}

/**
 * Render an aesthetic AI-aurora animated soundwave card for a per-question ElevenLabs narration.
 * Idle state shows a sleek iridescent banner with gently breathing soundwave bars ("Bu Soruya Özel Sesli Anlatım").
 * Clicking (or calling `playAutoOnWrong`) expands subtle scrub/speed/transcript controls and animates the live waveform.
 */
export function createQuestionVoiceCard(options: {
  questionAudioId: string;
  scriptTr: string;
  isTr: boolean;
}): QuestionVoiceCardController {
  const { questionAudioId, scriptTr, isTr } = options;
  const resolvedTrackUrl = resolveExtensionRelativeUrl(
    getRemedialQuestionAudioRelativePath(questionAudioId)
  );

  const card = document.createElement('div');
  card.className = 'ai-voice-card';

  const inner = document.createElement('div');
  inner.className = 'ai-voice-inner';

  const triggerBtn = document.createElement('button');
  triggerBtn.type = 'button';
  triggerBtn.className = 'ai-voice-trigger';
  triggerBtn.setAttribute(
    'aria-label',
    isTr ? 'Bu soruya özel sesli anlatımı dinle' : 'Listen to voice explanation for this question'
  );

  // Left: Iridescent 5-bar animated soundwave orb
  const waveOrb = document.createElement('span');
  waveOrb.className = 'ai-voice-wave-orb';
  waveOrb.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 5; i += 1) {
    const barEl = document.createElement('span');
    barEl.className = `ai-voice-bar b${i + 1}`;
    waveOrb.appendChild(barEl);
  }

  // Center: Title + dynamic subtitle
  const copyWrap = document.createElement('span');
  copyWrap.className = 'ai-voice-copy';

  const titleEl = document.createElement('span');
  titleEl.className = 'ai-voice-title';
  titleEl.textContent = isTr
    ? 'Bu Soruya Özel Sesli Anlatım'
    : 'Voice Explanation for This Question';

  const subEl = document.createElement('span');
  subEl.className = 'ai-voice-sub';
  subEl.textContent = isTr ? 'Dinlemek için tıkla' : 'Tap to listen';

  copyWrap.append(titleEl, subEl);

  // Right: Action pill chip
  const chipEl = document.createElement('span');
  chipEl.className = 'ai-voice-chip';
  chipEl.textContent = isTr ? '✦ Dinle' : '✦ Listen';

  triggerBtn.append(waveOrb, copyWrap, chipEl);

  // Expandable slim control strip (revealed on click or auto-play)
  const controlsWrap = document.createElement('div');
  controlsWrap.className = 'ai-voice-controls';
  controlsWrap.hidden = true;

  const rangeEl = document.createElement('input');
  rangeEl.type = 'range';
  rangeEl.className = 'ai-voice-range';
  rangeEl.min = '0';
  rangeEl.max = '100';
  rangeEl.step = '0.02';
  rangeEl.value = '0';
  rangeEl.style.setProperty('--ai-progress', '0%');
  rangeEl.setAttribute('aria-label', isTr ? 'Sesli anlatım ilerlemesi' : 'Voiceover progress');

  const controlsMeta = document.createElement('div');
  controlsMeta.className = 'ai-voice-controls-meta';

  const timeSpan = document.createElement('span');
  timeSpan.className = 'ai-voice-time';
  timeSpan.textContent = '0:00';

  const miniActions = document.createElement('div');
  miniActions.className = 'ai-voice-mini-actions';

  const restartBtn = document.createElement('button');
  restartBtn.type = 'button';
  restartBtn.className = 'ai-voice-ghost-btn';
  restartBtn.textContent = '↺';
  restartBtn.title = isTr ? 'Baştan oynat' : 'Restart';

  const speeds = [0.85, 1.0, 1.15];
  let speedIdx = 1;
  const speedBtn = document.createElement('button');
  speedBtn.type = 'button';
  speedBtn.className = 'ai-voice-ghost-btn';
  speedBtn.textContent = '1.0x';
  speedBtn.title = isTr ? 'Oynatma hızı' : 'Playback speed';

  const scriptToggleBtn = document.createElement('button');
  scriptToggleBtn.type = 'button';
  scriptToggleBtn.className = 'ai-voice-ghost-btn is-script-btn';
  scriptToggleBtn.textContent = isTr ? 'Metni Gör ▾' : 'Script ▾';

  miniActions.append(restartBtn, speedBtn, scriptToggleBtn);
  controlsMeta.append(timeSpan, miniActions);
  controlsWrap.append(rangeEl, controlsMeta);

  // Collapsible verbatim script panel
  const scriptBox = document.createElement('div');
  scriptBox.className = 'ai-voice-script';
  scriptBox.hidden = true;

  const scriptStatus = document.createElement('div');
  scriptStatus.className = 'ai-voice-script-status';
  scriptStatus.hidden = true;

  const scriptBody = document.createElement('p');
  scriptBody.className = 'ai-voice-script-body';
  scriptBody.dataset.wordLang = 'tr';

  scriptBox.append(scriptStatus, scriptBody);
  inner.append(triggerBtn, controlsWrap, scriptBox);
  card.appendChild(inner);

  let audio: HTMLAudioElement | null = null;
  let disposed = false;
  let isPlayingWebAudio = false;
  let webAudioDecoded: AudioBuffer | null = null;
  let webAudioStartCtxTime = 0;
  let webAudioOffsetSec = 0;
  let webAudioRate = speeds[speedIdx] ?? 1.0;
  let syncRafId: number | null = null;
  let knownDurationSec = 0;
  let playedManually = false;
  let isAutoTriggered = false;
  let hasStartedOnce = false;
  let userCollapsedScript = false;

  const stopSyncLoop = (): void => {
    if (syncRafId !== null) {
      cancelAnimationFrame(syncRafId);
      syncRafId = null;
    }
  };

  const setScriptOpen = (open: boolean): void => {
    scriptBox.hidden = !open;
    scriptToggleBtn.classList.toggle('is-open', open);
    scriptToggleBtn.textContent = open
      ? isTr
        ? 'Metni Gizle ▴'
        : 'Hide ▴'
      : isTr
        ? 'Metni Gör ▾'
        : 'Script ▾';
  };

  const updateProgressDisplay = (sec: number, dur: number): void => {
    const safeDur = Number.isFinite(dur) && dur > 0 ? dur : knownDurationSec;
    if (safeDur > 0) {
      knownDurationSec = safeDur;
      const clampedSec = Math.max(0, Math.min(safeDur, sec));
      const pct = Math.min(100, Math.max(0, (clampedSec / safeDur) * 100));
      rangeEl.max = String(safeDur);
      rangeEl.value = String(clampedSec);
      rangeEl.style.setProperty('--ai-progress', `${pct.toFixed(2)}%`);
      timeSpan.textContent = `${formatAudioSeconds(clampedSec)} / ${formatAudioSeconds(safeDur)}`;
    } else {
      timeSpan.textContent = formatAudioSeconds(sec);
    }
  };

  const refreshCopy = (playing: boolean, ended = false): void => {
    if (playing) {
      subEl.textContent = isAutoTriggered
        ? isTr
          ? 'Yanlış cevap · asistan otomatik anlatıyor'
          : 'Wrong answer · explaining automatically'
        : isTr
          ? 'Asistan anlatıyor · duraklatmak için tıkla'
          : 'Assistant speaking · tap to pause';
      chipEl.textContent = isTr ? '⏸ Duraklat' : '⏸ Pause';
      return;
    }

    const durSuffix = knownDurationSec > 0 ? ` · ${formatAudioSeconds(knownDurationSec)}` : '';
    if (!hasStartedOnce || ended) {
      subEl.textContent = isTr
        ? `Dinlemek için tıkla${durSuffix}`
        : `Tap to listen${durSuffix}`;
      chipEl.textContent = ended ? (isTr ? '↺ Tekrar' : '↺ Replay') : isTr ? '✦ Dinle' : '✦ Listen';
    } else {
      subEl.textContent = isTr ? 'Duraklatıldı · devam etmek için tıkla' : 'Paused · tap to resume';
      chipEl.textContent = isTr ? '▶ Devam' : '▶ Resume';
    }
  };

  const revealControls = (): void => {
    card.classList.add('is-activated');
    controlsWrap.hidden = false;
    if (!userCollapsedScript) {
      setScriptOpen(true);
    }
  };

  const getWebAudioCurrentSec = (): number => {
    if (!isPlayingWebAudio || !activeWebAudioCtx || !webAudioDecoded) return 0;
    const elapsed = (activeWebAudioCtx.currentTime - webAudioStartCtxTime) * webAudioRate;
    return Math.max(0, Math.min(webAudioDecoded.duration, webAudioOffsetSec + elapsed));
  };

  let seekToMsImpl: (ms: number, autoPlay?: boolean) => void = () => {};
  const syncedScript = mountSyncedWordSpans(
    scriptBody,
    REMEDIAL_QUESTION_AUDIO_WORD_TIMINGS[questionAudioId],
    scriptTr,
    (startMs) => seekToMsImpl(startMs, true)
  );

  const tickSync = (): void => {
    syncRafId = null;
    if (disposed) return;

    if (isPlayingWebAudio && activeWebAudioCtx && webAudioDecoded) {
      const sec = getWebAudioCurrentSec();
      updateProgressDisplay(sec, webAudioDecoded.duration);
      syncedScript.update(sec * 1000, true);
      syncRafId = requestAnimationFrame(tickSync);
      return;
    }

    if (audio && !audio.paused && !audio.ended) {
      const sec = audio.currentTime;
      updateProgressDisplay(sec, audio.duration);
      syncedScript.update(sec * 1000, true);
      syncRafId = requestAnimationFrame(tickSync);
    }
  };

  const syncPlayUi = (playing: boolean, ended = false): void => {
    card.classList.toggle('is-playing', playing);
    if (playing) {
      hasStartedOnce = true;
      revealControls();
      stopSyncLoop();
      if (!disposed) syncRafId = requestAnimationFrame(tickSync);
    } else {
      stopSyncLoop();
      if (ended) {
        syncedScript.update(-1, false);
      }
    }
    refreshCopy(playing, ended);
  };

  const resetUi = (): void => {
    isPlayingWebAudio = false;
    syncedScript.update(-1, false);
    syncPlayUi(false);
  };

  const handleUnavailable = (): void => {
    revealControls();
    scriptStatus.hidden = false;
    scriptStatus.textContent = isTr
      ? 'Ses dosyası yüklenemedi — yazılı anlatım aşağıda:'
      : 'Audio unavailable — read the explanation below:';
    setScriptOpen(true);
    syncPlayUi(false);
  };

  const playViaWebAudioFallback = async (startOffsetSec = 0): Promise<void> => {
    stopGuideAssistant();
    stopActiveRuleAudio();
    cancelEnglishSpeech();
    try {
      let decoded = webAudioDecoded;
      const ctx = new AudioContext();
      activeWebAudioCtx = ctx;
      if (!decoded) {
        const resp = await fetch(resolvedTrackUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buf = await resp.arrayBuffer();
        if (disposed) return;
        decoded = await ctx.decodeAudioData(buf);
        if (disposed) return;
        webAudioDecoded = decoded;
      }
      const clampedStart = Math.max(0, Math.min(decoded.duration - 0.05, startOffsetSec));
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      webAudioRate = speeds[speedIdx] ?? 1.0;
      src.playbackRate.value = webAudioRate;
      src.connect(ctx.destination);
      activeWebAudioSource = src;
      activeRuleStopCallback = resetUi;
      webAudioOffsetSec = clampedStart;
      webAudioStartCtxTime = ctx.currentTime;
      isPlayingWebAudio = true;
      updateProgressDisplay(clampedStart, decoded.duration);
      syncPlayUi(true);
      src.onended = () => {
        if (activeWebAudioSource === src) {
          isPlayingWebAudio = false;
          if (!disposed) {
            isAutoTriggered = false;
            card.classList.remove('is-auto-triggered');
            updateProgressDisplay(0, decoded.duration);
            syncPlayUi(false, true);
          }
        }
      };
      src.start(0, clampedStart);
    } catch {
      handleUnavailable();
    }
  };

  const ensureAudio = (): HTMLAudioElement => {
    if (audio) return audio;
    const el = new Audio(resolvedTrackUrl);
    el.preload = 'metadata';
    const initialRate = speeds[speedIdx] ?? 1.0;
    el.defaultPlaybackRate = initialRate;
    el.playbackRate = initialRate;
    el.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        knownDurationSec = el.duration;
        updateProgressDisplay(el.currentTime, el.duration);
        if (el.paused) refreshCopy(false);
      }
    });
    el.addEventListener('timeupdate', () => {
      updateProgressDisplay(el.currentTime, el.duration);
      syncedScript.update(el.currentTime * 1000, !el.paused && !el.ended);
    });
    el.addEventListener('ended', () => {
      isAutoTriggered = false;
      card.classList.remove('is-auto-triggered');
      updateProgressDisplay(0, el.duration);
      syncedScript.update(-1, false);
      syncPlayUi(false, true);
    });
    el.addEventListener('pause', () => {
      if (!el.ended) {
        syncedScript.update(el.currentTime * 1000, false);
        syncPlayUi(false);
      }
    });
    el.addEventListener('play', () => {
      syncedScript.update(el.currentTime * 1000, true);
      syncPlayUi(true);
    });
    audio = el;
    return el;
  };

  const startPlayback = async (fromStart = false): Promise<void> => {
    if (disposed) return;
    const el = ensureAudio();
    if (fromStart) {
      try {
        el.currentTime = 0;
      } catch {
        // Seek will apply after metadata loads
      }
    }
    stopGuideAssistant();
    cancelEnglishSpeech();
    if (activeRuleAudio && activeRuleAudio !== el) {
      stopActiveRuleAudio();
    } else if (activeWebAudioSource) {
      stopActiveRuleAudio();
    }
    activeRuleAudio = el;
    activeRuleStopCallback = resetUi;
    const rate = speeds[speedIdx] ?? 1.0;
    el.defaultPlaybackRate = rate;
    el.playbackRate = rate;
    try {
      await el.play();
    } catch {
      await playViaWebAudioFallback(fromStart ? 0 : el.currentTime || 0);
    }
  };

  seekToMsImpl = (ms: number, autoPlay = true): void => {
    playedManually = true;
    isAutoTriggered = false;
    card.classList.remove('is-auto-triggered');
    const targetSec = Math.max(0, ms / 1000);
    updateProgressDisplay(targetSec, knownDurationSec);
    syncedScript.update(targetSec * 1000, autoPlay);
    if (isPlayingWebAudio) {
      void playViaWebAudioFallback(targetSec);
      return;
    }
    const el = ensureAudio();
    const applySeek = (): void => {
      const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : targetSec + 1;
      el.currentTime = Math.min(dur, targetSec);
      updateProgressDisplay(el.currentTime, dur);
      syncedScript.update(el.currentTime * 1000, !el.paused || autoPlay);
    };
    if (el.readyState >= 1) {
      applySeek();
    } else {
      el.addEventListener('loadedmetadata', applySeek, { once: true });
    }
    if (autoPlay) {
      void startPlayback(false);
    }
  };

  const togglePlay = async (): Promise<void> => {
    playedManually = true;
    isAutoTriggered = false;
    card.classList.remove('is-auto-triggered');
    if (isPlayingWebAudio) {
      stopActiveRuleAudio();
      return;
    }
    const el = ensureAudio();
    if (!el.paused) {
      el.pause();
      return;
    }
    await startPlayback(false);
  };

  triggerBtn.addEventListener('click', () => {
    void togglePlay();
  });

  restartBtn.addEventListener('click', () => {
    playedManually = true;
    isAutoTriggered = false;
    card.classList.remove('is-auto-triggered');
    if (isPlayingWebAudio) {
      void playViaWebAudioFallback(0);
      return;
    }
    void startPlayback(true);
  });

  rangeEl.addEventListener('input', () => {
    const target = Number(rangeEl.value);
    if (!Number.isFinite(target)) return;
    updateProgressDisplay(target, knownDurationSec);
    if (isPlayingWebAudio) {
      syncedScript.update(target * 1000, true);
      void playViaWebAudioFallback(target);
      return;
    }
    const el = ensureAudio();
    el.currentTime = target;
    syncedScript.update(target * 1000, !el.paused);
  });

  speedBtn.addEventListener('click', () => {
    if (isPlayingWebAudio && activeWebAudioCtx) {
      webAudioOffsetSec = getWebAudioCurrentSec();
      webAudioStartCtxTime = activeWebAudioCtx.currentTime;
    }
    speedIdx = (speedIdx + 1) % speeds.length;
    const rate = speeds[speedIdx] ?? 1.0;
    webAudioRate = rate;
    speedBtn.textContent = `${rate.toFixed(rate === 1 ? 1 : 2).replace(/\.00$/, '.0')}x`;
    if (audio) {
      audio.defaultPlaybackRate = rate;
      audio.playbackRate = rate;
    }
    if (activeWebAudioSource) activeWebAudioSource.playbackRate.value = rate;
  });

  scriptToggleBtn.addEventListener('click', () => {
    const nextOpen = scriptBox.hidden;
    userCollapsedScript = !nextOpen;
    setScriptOpen(nextOpen);
  });

  // Preload metadata quietly so duration badge appears immediately
  try {
    ensureAudio();
  } catch {
    // Ignore preload failure
  }

  return {
    element: card,
    playAutoOnWrong: () => {
      if (disposed || playedManually || isPlayingWebAudio || (audio && !audio.paused)) {
        return;
      }
      isAutoTriggered = true;
      card.classList.add('is-auto-triggered');
      revealControls();
      void startPlayback(true);
    },
    wasPlayedManually: () => playedManually,
    dispose: () => {
      disposed = true;
      stopSyncLoop();
      if (audio && activeRuleAudio === audio) {
        stopActiveRuleAudio();
      } else if (audio) {
        try {
          audio.pause();
          audio.removeAttribute('src');
        } catch {
          // Ignore
        }
      }
      audio = null;
    },
  };
}

/**
 * Build a branching connector ("│" -> horizontal rail -> downward arrows) aligning
 * directly above a 1-, 2-, or 3-column grid of clickable grammar rule choices.
 */
function buildBranchTreeElement(columnCount: number, activeColumnIndex: number): HTMLElement {
  const tree = document.createElement('div');
  tree.className = 'tm-branch-tree';
  tree.setAttribute('aria-hidden', 'true');

  const stem = document.createElement('div');
  stem.className = 'tm-branch-stem';
  tree.appendChild(stem);

  const legs = document.createElement('div');
  legs.className = 'tm-branch-legs';
  legs.style.gridTemplateColumns = `repeat(${columnCount}, minmax(0, 1fr))`;

  for (let i = 0; i < columnCount; i += 1) {
    const leg = document.createElement('div');
    leg.className = `tm-branch-leg ${i === activeColumnIndex ? 'is-active' : ''}`;

    const drop = document.createElement('span');
    drop.className = 'tm-branch-drop';

    const arrow = document.createElement('span');
    arrow.className = 'tm-branch-arrow';

    leg.append(drop, arrow);
    legs.appendChild(leg);
  }

  tree.appendChild(legs);
  return tree;
}

function buildRuleWrittenBody(
  skillId: VoiceCoachRuleId,
  isTr: boolean,
  compact: boolean,
  player?: RuleAudioPlayerController
): HTMLElement {
  const spec = getVoiceCoachRuleSpec(skillId);
  const wrap = document.createElement('div');
  wrap.className = `tm-rule-body ${compact ? 'is-compact' : ''}`;

  const headline = document.createElement('div');
  headline.className = 'tm-headline';
  headline.textContent = isTr ? spec.headlineTr : spec.headlineEn;

  const golden = document.createElement('p');
  golden.className = 'tm-golden-text';
  const transcriptText = isTr ? spec.transcriptTr : spec.summaryEn;

  if (player) {
    const sync = mountSyncedTranscript(golden, skillId, transcriptText, isTr, (startMs) => {
      player.seekToMs(startMs, true);
    });
    player.setOnTimeMs(sync.update);
  } else {
    golden.textContent = transcriptText;
  }

  wrap.append(headline, golden);

  const exList = document.createElement('div');
  exList.className = 'tm-examples';
  const examples = compact ? spec.examples.slice(0, 3) : spec.examples;
  for (const ex of examples) {
    const row = document.createElement('div');
    row.className = `tm-ex-row ${ex.isTrap ? 'is-trap' : 'is-good'}`;

    const top = document.createElement('div');
    top.className = 'tm-ex-top';

    const tag = document.createElement('span');
    tag.className = `tm-ex-tag ${ex.isTrap ? 'is-trap' : 'is-good'}`;
    tag.textContent = ex.isTrap
      ? isTr
        ? '✕ TUZAK'
        : '✕ TRAP'
      : isTr
        ? '✓ DOĞRU'
        : '✓ GOOD';
    top.appendChild(tag);

    if (!ex.isTrap) {
      const spk = document.createElement('button');
      spk.type = 'button';
      spk.className = 'tm-ex-speak';
      spk.textContent = '🔊';
      spk.title = isTr ? 'İngilizceyi dinle' : 'Listen';
      spk.addEventListener('click', () => {
        stopGuideAssistant();
        stopActiveRuleAudio();
        speakEnglish(ex.en, 1.0);
      });
      top.appendChild(spk);
    }

    const enLine = document.createElement('div');
    enLine.className = 'tm-ex-en';
    enLine.dataset.wordLang = 'en';
    enLine.textContent = ex.en;

    const trLine = document.createElement('div');
    trLine.className = 'tm-ex-tr';
    trLine.dataset.wordLang = 'tr';
    trLine.textContent = ex.tr;

    row.append(top, enLine, trLine);
    exList.appendChild(row);
  }
  wrap.appendChild(exList);
  return wrap;
}

export interface OpenTeachMeDrawerOptions {
  host: HTMLElement;
  detectedSkills: VoiceCoachRuleId[];
  uiLanguage: FeedbackLanguageMode;
  crimson?: boolean;
  sentenceHint?: string;
  sentenceEn?: string;
  meaningTr?: string;
  initialAiMode?: boolean;
  onSkillChange?: (skillId: VoiceCoachRuleId | null) => void;
}

/**
 * Open the "🎧 Bana Öğret" slide-up drawer listing rules detected in the current question
 * (plus access to all 35 grammar & coaching voiceovers), complete with synced playback + written notes.
 */
export function openTeachMeDrawer(options: OpenTeachMeDrawerOptions): void {
  const isTr = resolveSupportedLanguage(options.uiLanguage) === 'tr';
  const existing = options.host.querySelector('.tm-overlay');
  if (existing) {
    stopActiveRuleAudio();
    existing.remove();
  }

  const detected =
    options.detectedSkills.length > 0 ? options.detectedSkills : (['trouble_vocab'] as VoiceCoachRuleId[]);
  let selectedSkill: VoiceCoachRuleId = detected[0]!;
  let showAllCatalog = false;
  let aiMode = Boolean(options.initialAiMode);
  let activePlayerDispose: (() => void) | null = null;
  let activeAiCoachCtrl: AiGrammarCoachController | null = null;

  const overlay = document.createElement('div');
  overlay.className = `tm-overlay ${options.crimson ? 'is-crimson' : ''}`;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  let ctxBar: HTMLElement | null = null;
  const sentenceHintText = options.sentenceHint?.trim() ?? '';
  const aiTargetSentence = (options.sentenceEn || sentenceHintText).trim();

  const syncSentenceHighlight = (skill: VoiceCoachRuleId | null): void => {
    if (ctxBar && sentenceHintText) {
      renderHighlightedSentence(ctxBar, sentenceHintText, skill, 'tm-rule-glow');
    }
    options.onSkillChange?.(skill);
  };

  const syncAiPhraseHighlight = (phrase: string | null): void => {
    if (ctxBar && sentenceHintText) {
      renderHighlightedPhrase(ctxBar, sentenceHintText, phrase, 'tm-rule-glow is-ai');
    }
  };

  const closeDrawer = (): void => {
    document.removeEventListener('keydown', onEscKey);
    activePlayerDispose?.();
    activeAiCoachCtrl?.dispose();
    activeAiCoachCtrl = null;
    stopActiveRuleAudio();
    if (getActiveGuideAssistantId() === 'tour_teach_me') {
      stopGuideAssistant();
    }
    syncSentenceHighlight(null);
    overlay.remove();
  };

  const onEscKey = (e: KeyboardEvent): void => {
    if (!overlay.isConnected) {
      document.removeEventListener('keydown', onEscKey);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeDrawer();
    }
  };
  document.addEventListener('keydown', onEscKey);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDrawer();
  });

  const panel = document.createElement('div');
  panel.className = 'tm-panel';
  panel.addEventListener('keydown', (e) => e.stopPropagation());

  // Header
  const header = document.createElement('div');
  header.className = 'tm-header';

  const title = document.createElement('span');
  title.className = 'tm-title';
  title.textContent = isTr ? '🎧 Bana Öğret · Kural & Sesli Koç' : '🎧 Teach Me · Rule & Voice Coach';

  const headerActions = document.createElement('div');
  headerActions.className = 'tm-header-actions';

  const helpBtn = createGuideHelpButton('tour_teach_me', {
    isTr,
    variant: 'pill',
    labelTr: 'Bu ne işe yarıyor?',
    labelEn: 'How it works?',
  });

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'tm-close-btn';
  closeBtn.textContent = '✕';
  closeBtn.title = isTr ? 'Kapat (Esc)' : 'Close (Esc)';
  closeBtn.addEventListener('click', closeDrawer);
  headerActions.append(helpBtn, closeBtn);
  header.append(title, headerActions);
  panel.appendChild(header);

  if (sentenceHintText) {
    ctxBar = document.createElement('div');
    ctxBar.className = 'tm-ctx-strip';
    ctxBar.textContent = sentenceHintText;
    panel.appendChild(ctxBar);
  }

  // Detected rules selector + All 18 toggle
  const pickerSec = document.createElement('div');
  pickerSec.className = 'tm-picker-section';

  const pickerHead = document.createElement('div');
  pickerHead.className = 'tm-picker-head';

  const pickerLbl = document.createElement('span');
  pickerLbl.className = 'tm-picker-lbl';
  pickerLbl.textContent = isTr ? 'HANGİSİNDE TAKILDIN?' : 'WHICH ONE TRIPPED YOU UP?';

  const toggleAllBtn = document.createElement('button');
  toggleAllBtn.type = 'button';
  toggleAllBtn.className = 'tm-toggle-all-btn';

  const syncToggleLabel = (): void => {
    toggleAllBtn.textContent = showAllCatalog
      ? isTr
        ? 'Sadece Bu Soru'
        : 'Question Only'
      : isTr
        ? `Tümü (${VOICE_COACH_RULE_ORDER.length})`
        : `All (${VOICE_COACH_RULE_ORDER.length})`;
  };
  syncToggleLabel();

  pickerHead.append(pickerLbl, toggleAllBtn);
  pickerSec.appendChild(pickerHead);

  const branchSlot = document.createElement('div');
  branchSlot.className = 'tm-branch-slot';
  pickerSec.appendChild(branchSlot);

  const pillsWrap = document.createElement('div');
  pillsWrap.className = 'tm-pills-wrap';
  pickerSec.appendChild(pillsWrap);
  panel.appendChild(pickerSec);

  const detailScroll = document.createElement('div');
  detailScroll.className = 'tm-detail-scroll';
  panel.appendChild(detailScroll);

  const renderPills = (): void => {
    branchSlot.replaceChildren();
    pillsWrap.replaceChildren();
    const listToShow: VoiceCoachRuleId[] = showAllCatalog
      ? [...detected, ...VOICE_COACH_RULE_ORDER.filter((id) => !detected.includes(id))]
      : detected;

    if (!showAllCatalog) {
      const colCount = Math.min(3, Math.max(1, listToShow.length === 4 ? 2 : listToShow.length));
      const selectedIdx = listToShow.indexOf(selectedSkill);
      const activeCol = selectedIdx >= 0 ? selectedIdx % colCount : -1;
      branchSlot.hidden = false;
      branchSlot.appendChild(buildBranchTreeElement(colCount, activeCol));
      pillsWrap.className = 'tm-choice-grid';
      pillsWrap.style.gridTemplateColumns = `repeat(${colCount}, minmax(0, 1fr))`;

      for (const sid of listToShow) {
        const spec = getVoiceCoachRuleSpec(sid);
        const isSelected = sid === selectedSkill;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `tm-choice-card ${isSelected ? 'is-selected' : ''}`;
        btn.setAttribute('aria-pressed', String(isSelected));

        const nameEl = document.createElement('span');
        nameEl.className = 'tm-choice-name';
        nameEl.textContent = `${spec.icon} ${
          isTr ? spec.titleTr.split('(')[0]!.trim() : spec.titleEn.split('(')[0]!.trim()
        }`;

        const hintEl = document.createElement('span');
        hintEl.className = 'tm-choice-cue';
        hintEl.textContent = isSelected
          ? isTr
            ? '✓ Seçili'
            : '✓ Selected'
          : isTr
            ? '▶ Dinle'
            : '▶ Listen';

        btn.append(nameEl, hintEl);
        btn.addEventListener('click', () => {
          if (selectedSkill === sid) return;
          selectedSkill = sid;
          renderPills();
          renderDetail(true);
          syncSentenceHighlight(selectedSkill);
        });
        pillsWrap.appendChild(btn);
      }
      return;
    }

    branchSlot.hidden = true;
    pillsWrap.className = 'tm-pills-wrap';
    pillsWrap.style.gridTemplateColumns = '';

    for (const sid of listToShow) {
      const spec = getVoiceCoachRuleSpec(sid);
      const isDetected = detected.includes(sid);
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `tm-skill-pill ${sid === selectedSkill ? 'is-selected' : ''} ${
        isDetected ? 'is-detected' : ''
      }`;
      pill.textContent = `${spec.icon} ${isTr ? spec.titleTr.split('(')[0]!.trim() : spec.titleEn.split('(')[0]!.trim()}`;
      pill.addEventListener('click', () => {
        if (selectedSkill === sid) return;
        selectedSkill = sid;
        renderPills();
        renderDetail(true);
        syncSentenceHighlight(selectedSkill);
      });
      pillsWrap.appendChild(pill);
    }
  };

  const renderDetail = (autoPlayOnSwitch: boolean): void => {
    activePlayerDispose?.();
    activePlayerDispose = null;
    activeAiCoachCtrl?.dispose();
    activeAiCoachCtrl = null;
    detailScroll.replaceChildren();

    pickerSec.hidden = aiMode;

    if (aiMode) {
      stopActiveRuleAudio();
      activeAiCoachCtrl = createAiGrammarCoachView({
        sentenceEn: aiTargetSentence,
        meaningTr: options.meaningTr,
        detectedSkills: detected,
        uiLanguage: options.uiLanguage,
        compact: false,
        onBeforeAudioPlay: () => stopActiveRuleAudio(false),
        onFocusPhrase: (phrase) => syncAiPhraseHighlight(phrase),
        onFallbackOffline: () => {
          aiMode = false;
          renderPills();
          syncSentenceHighlight(selectedSkill);
          renderDetail(false);
        },
      });
      detailScroll.appendChild(activeAiCoachCtrl.element);
      return;
    }

    const player = createRuleAudioPlayer({
      skillId: selectedSkill,
      isTr,
      crimson: options.crimson,
      autoPlay: autoPlayOnSwitch,
    });
    activePlayerDispose = player.dispose;

    const written = buildRuleWrittenBody(selectedSkill, isTr, false, player);
    detailScroll.append(player.element, written);
  };

  toggleAllBtn.addEventListener('click', () => {
    showAllCatalog = !showAllCatalog;
    syncToggleLabel();
    renderPills();
  });

  renderPills();
  renderDetail(false);
  if (!aiMode) {
    syncSentenceHighlight(selectedSkill);
  }

  overlay.appendChild(panel);
  options.host.appendChild(overlay);
}

/**
 * Render an inline collapsible "🎧 Bana Öğret" panel inside a Shadow DOM host (used by Web Recall Widget)
 * so learners can list matching grammar rules, play ElevenLabs voiceovers, or switch to live AI + İlkiz mode.
 */
export function buildInlineTeachMePanel(options: {
  detectedSkills: VoiceCoachRuleId[];
  isTr: boolean;
  sentenceEn?: string;
  meaningTr?: string;
  uiLanguage?: FeedbackLanguageMode;
  initialAiMode?: boolean;
  guideHost?: HTMLElement | ShadowRoot;
  onClose?: () => void;
  onSkillChange?: (skillId: VoiceCoachRuleId | null) => void;
  onFocusPhrase?: (phrase: string | null) => void;
  onAiModeChange?: (aiMode: boolean) => void;
}): {
  element: HTMLElement;
  dispose: () => void;
  getSelectedSkill: () => VoiceCoachRuleId;
  isAiMode: () => boolean;
  setAiMode: (enabled: boolean) => void;
  getActiveFocusPhrase: () => string | null;
} {
  const { isTr } = options;
  const detected =
    options.detectedSkills.length > 0 ? options.detectedSkills : (['trouble_vocab'] as VoiceCoachRuleId[]);
  let selectedSkill: VoiceCoachRuleId = detected[0]!;
  let aiMode = Boolean(options.initialAiMode);
  let activeDispose: (() => void) | null = null;
  let activeAiCoachCtrl: AiGrammarCoachController | null = null;

  const box = document.createElement('div');
  box.className = 'etr-teach-panel';

  const headRow = document.createElement('div');
  headRow.className = 'etr-teach-head-row';

  const head = document.createElement('div');
  head.className = 'etr-teach-head';

  const headActions = document.createElement('div');
  headActions.className = 'etr-teach-head-actions';

  const helpBtn = createGuideHelpButton('tour_teach_me', {
    isTr,
    variant: 'dot',
    extraClass: 'etr-teach-help-btn',
    host: options.guideHost,
  });
  headActions.appendChild(helpBtn);

  if (options.onClose) {
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'etr-teach-close-btn';
    closeBtn.textContent = isTr ? '✕ Kapat' : '✕ Close';
    closeBtn.title = isTr ? 'Anlatımı kapat' : 'Close guide';
    closeBtn.addEventListener('click', () => options.onClose?.());
    headActions.appendChild(closeBtn);
  }

  headRow.append(head, headActions);

  const branchSlot = document.createElement('div');
  branchSlot.className = 'tm-branch-slot';

  const pills = document.createElement('div');
  pills.className = 'etr-teach-grid';

  const body = document.createElement('div');
  body.className = 'etr-teach-body';

  const renderSelected = (autoPlay: boolean): void => {
    activeDispose?.();
    activeDispose = null;
    activeAiCoachCtrl?.dispose();
    activeAiCoachCtrl = null;
    body.replaceChildren();

    box.classList.toggle('is-ai-mode', aiMode);
    head.textContent = aiMode
      ? isTr
        ? '✦ AI CANLI ÖĞRETMEN · EMA'
        : '✦ AI LIVE TEACHER · EMA'
      : isTr
        ? '🎧 HANGİSİNDE TAKILDIN?'
        : '🎧 WHICH ONE TRIPPED YOU UP?';
    branchSlot.hidden = aiMode;
    pills.hidden = aiMode;

    if (aiMode) {
      stopActiveRuleAudio();
      activeAiCoachCtrl = createAiGrammarCoachView({
        sentenceEn: options.sentenceEn ?? '',
        meaningTr: options.meaningTr,
        detectedSkills: detected,
        uiLanguage: options.uiLanguage ?? (isTr ? 'tr' : 'en'),
        compact: true,
        onBeforeAudioPlay: () => stopActiveRuleAudio(false),
        onFocusPhrase: (phrase) => options.onFocusPhrase?.(phrase),
        onFallbackOffline: () => setAiMode(false),
      });
      body.appendChild(activeAiCoachCtrl.element);
      return;
    }

    const player = createRuleAudioPlayer({
      skillId: selectedSkill,
      isTr,
      compact: true,
      autoPlay,
    });
    activeDispose = player.dispose;

    const spec = getVoiceCoachRuleSpec(selectedSkill);
    const textWrap = document.createElement('div');
    textWrap.className = 'etr-teach-text';

    const headEl = document.createElement('div');
    headEl.className = 'etr-teach-headline';
    headEl.textContent = isTr ? spec.headlineTr : spec.headlineEn;

    const ruleEl = document.createElement('div');
    ruleEl.className = 'etr-teach-rule';
    const transcriptText = isTr ? spec.transcriptTr : spec.summaryEn;
    const sync = mountSyncedTranscript(ruleEl, selectedSkill, transcriptText, isTr, (startMs) => {
      player.seekToMs(startMs, true);
    });
    player.setOnTimeMs(sync.update);

    textWrap.append(headEl, ruleEl);
    body.append(player.element, textWrap);
  };

  const renderPills = (): void => {
    branchSlot.replaceChildren();
    pills.replaceChildren();

    const colCount = Math.min(3, Math.max(1, detected.length === 4 ? 2 : detected.length));
    const selectedIdx = detected.indexOf(selectedSkill);
    const activeCol = selectedIdx >= 0 ? selectedIdx % colCount : -1;
    branchSlot.appendChild(buildBranchTreeElement(colCount, activeCol));
    pills.style.gridTemplateColumns = `repeat(${colCount}, minmax(0, 1fr))`;

    for (const sid of detected) {
      const spec = getVoiceCoachRuleSpec(sid);
      const isSelected = sid === selectedSkill;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `etr-teach-choice ${isSelected ? 'is-active' : ''}`;
      btn.setAttribute('aria-pressed', String(isSelected));

      const titleEl = document.createElement('span');
      titleEl.className = 'etr-teach-choice-title';
      titleEl.textContent = `${spec.icon} ${
        isTr ? spec.titleTr.split('(')[0]!.trim() : spec.titleEn.split('(')[0]!.trim()
      }`;

      const cueEl = document.createElement('span');
      cueEl.className = 'etr-teach-choice-cue';
      cueEl.textContent = isSelected
        ? isTr
          ? '✓ Seçili'
          : '✓ Selected'
        : isTr
          ? '▶ Dinle'
          : '▶ Listen';

      btn.append(titleEl, cueEl);
      btn.addEventListener('click', () => {
        if (selectedSkill === sid) return;
        selectedSkill = sid;
        renderPills();
        renderSelected(true);
        options.onSkillChange?.(selectedSkill);
      });
      pills.appendChild(btn);
    }
  };

  const setAiMode = (enabled: boolean): void => {
    if (aiMode === enabled) return;
    aiMode = enabled;
    options.onAiModeChange?.(aiMode);
    if (!aiMode) {
      renderPills();
      options.onSkillChange?.(selectedSkill);
    }
    renderSelected(false);
  };

  renderPills();
  renderSelected(false);
  if (!aiMode) {
    options.onSkillChange?.(selectedSkill);
  }
  box.append(headRow, branchSlot, pills, body);

  return {
    element: box,
    getSelectedSkill: () => selectedSkill,
    isAiMode: () => aiMode,
    setAiMode,
    getActiveFocusPhrase: () => activeAiCoachCtrl?.getActiveFocusPhrase() ?? null,
    dispose: () => {
      activeDispose?.();
      activeDispose = null;
      activeAiCoachCtrl?.dispose();
      activeAiCoachCtrl = null;
      stopActiveRuleAudio();
      if (getActiveGuideAssistantId() === 'tour_teach_me') {
        stopGuideAssistant();
      }
      options.onSkillChange?.(null);
      options.onFocusPhrase?.(null);
    },
  };
}
