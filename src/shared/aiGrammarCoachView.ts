import { stripCoachMarkupForDisplay } from './bilingualTtsSplit';
import { stopGuideAssistant } from './guideAssistant';
import { findActiveWordIndex } from './remedialAudioTimings';
import { cancelEnglishSpeech, speakEnglishText as speakEnglish } from './speech';
import type {
  AiGrammarCoachItem,
  AiGrammarCoachResult,
  CoachPlaybackProgress,
  ExtensionMessage,
  FeedbackLanguageMode,
  NeuralTtsStatus,
  VoiceCoachRuleId,
} from './types';
import { setIconLabel, setIconOnly } from './uiIcons';
import { getVoiceCoachRuleSpec } from './voiceCoachCatalog';

const coachResultCache = new Map<string, AiGrammarCoachResult>();
const MAX_COACH_CACHE = 32;

function cacheCoachResult(key: string, value: AiGrammarCoachResult): void {
  if (coachResultCache.has(key)) coachResultCache.delete(key);
  coachResultCache.set(key, value);
  if (coachResultCache.size > MAX_COACH_CACHE) {
    const oldest = coachResultCache.keys().next().value;
    if (oldest !== undefined) coachResultCache.delete(oldest);
  }
}

function formatSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const total = Math.floor(sec);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function buildAiBranchTree(columnCount: number, activeColumnIndex: number): HTMLElement {
  const tree = document.createElement('div');
  tree.className = 'tm-branch-tree is-ai';
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

/**
 * Stop any currently playing EMA Lightning Turkish AI coach audio cleanly via background -> offscreen.
 */
export function stopActiveTurkishCoachAudio(): void {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      void chrome.runtime
        .sendMessage({ type: 'CONTROL_TURKISH_COACH', command: 'stop' } satisfies ExtensionMessage)
        .catch(() => {
          // Ignore when offscreen or background is idle
        });
    } catch {
      // Ignore messaging errors
    }
  }
}

export interface CreateAiGrammarCoachViewOptions {
  sentenceEn: string;
  meaningTr?: string;
  detectedSkills: VoiceCoachRuleId[];
  uiLanguage: FeedbackLanguageMode;
  compact?: boolean;
  onBeforeAudioPlay?: () => void;
  onFocusPhrase?: (phrase: string | null) => void;
  onFallbackOffline?: () => void;
}

export interface AiGrammarCoachController {
  element: HTMLElement;
  dispose: () => void;
  getActiveFocusPhrase: () => string | null;
}

/**
 * Mount a live AI Grammar Coach panel mirroring the side-by-side branching picker of `Bana Öğret`
 * in warm amber/gold: each grammar rule has its own independent card, exact highlighted phrase,
 * verbatim spoken/displayed transcript with karaoke sync, tailored examples, and separate EMA Lightning audio.
 */
export function createAiGrammarCoachView(
  options: CreateAiGrammarCoachViewOptions
): AiGrammarCoachController {
  const sentenceEn = options.sentenceEn.trim();
  const root = document.createElement('div');
  root.className = `ai-coach-panel ${options.compact ? 'is-compact' : ''}`;

  let disposed = false;
  let selectedIdx = 0;
  let activeFocusPhrase: string | null = null;
  let activeCoachData: AiGrammarCoachResult | null = null;
  let currentRequestId = `ema_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  let isPlaying = false;
  let hasSynthesized = false;
  let isSynthesizing = false;
  let durationSec = 0;
  let currentSec = 0;
  let activeWordTimings: Array<[number, number]> = [];
  let activeWordSpans: HTMLSpanElement[] = [];
  let highlightedWordIdx = -1;
  const speeds = [0.9, 1.0, 1.15];
  let speedIdx = 1;

  // Player DOM refs (recreated per active rule)
  let playBtnRef: HTMLButtonElement | null = null;
  let restartBtnRef: HTMLButtonElement | null = null;
  let rangeRef: HTMLInputElement | null = null;
  let timeRef: HTMLElement | null = null;
  let statusBadgeRef: HTMLElement | null = null;
  let playerBarRef: HTMLElement | null = null;

  const updateKaraokeWord = (ms: number, playing: boolean): void => {
    const nextIdx =
      ms < 0 || (!playing && ms === 0) || activeWordTimings.length === 0
        ? -1
        : findActiveWordIndex(activeWordTimings, ms);
    if (nextIdx === highlightedWordIdx) return;
    if (highlightedWordIdx >= 0 && highlightedWordIdx < activeWordSpans.length) {
      activeWordSpans[highlightedWordIdx]!.classList.remove('is-active');
    }
    if (nextIdx >= 0 && nextIdx < activeWordSpans.length) {
      activeWordSpans[nextIdx]!.classList.add('is-active');
    }
    highlightedWordIdx = nextIdx;
  };

  const syncPlayerUi = (): void => {
    if (playBtnRef) {
      playBtnRef.textContent = isSynthesizing ? '✦' : isPlaying ? '⏸' : '▶';
      playBtnRef.disabled = isSynthesizing;
    }
    if (restartBtnRef) {
      restartBtnRef.disabled = isSynthesizing;
    }
    if (playerBarRef) {
      playerBarRef.classList.toggle('is-playing', isPlaying);
      playerBarRef.classList.toggle('is-synthesizing', isSynthesizing);
    }
    if (rangeRef && durationSec > 0) {
      rangeRef.max = String(durationSec);
      rangeRef.value = String(Math.min(durationSec, currentSec));
    }
    if (timeRef) {
      if (durationSec > 0) {
        timeRef.textContent = `${formatSec(currentSec)} / ${formatSec(durationSec)}`;
      } else {
        timeRef.textContent = '0:00';
      }
    }
    updateKaraokeWord(isSynthesizing ? -1 : currentSec * 1000, isPlaying);
  };

  const onRuntimeMessage = (msg: {
    type?: string;
    progress?: CoachPlaybackProgress;
    status?: NeuralTtsStatus;
  }): void => {
    if (disposed) return;
    if (msg?.type === 'TURKISH_TTS_PROGRESS' && msg.status?.downloading && statusBadgeRef) {
      statusBadgeRef.textContent = `EMA Lightning yükleniyor %${msg.status.progressPercent}…`;
      return;
    }
    if (msg?.type === 'COACH_TTS_PLAYBACK' && msg.progress) {
      if (msg.progress.requestId !== currentRequestId) return;
      isPlaying = msg.progress.playing;
      currentSec = msg.progress.currentSec;
      if (msg.progress.durationSec > 0) durationSec = msg.progress.durationSec;
      if (msg.progress.ended) {
        isPlaying = false;
        currentSec = 0;
        updateKaraokeWord(-1, false);
      }
      syncPlayerUi();
    }
  };

  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener(onRuntimeMessage);
  }

  const synthesizedScripts = new Set<string>();

  const startEmaNarration = async (scriptText: string): Promise<void> => {
    const cleanedScript = scriptText.replace(/\s+/g, ' ').trim();
    if (disposed || !cleanedScript) return;
    options.onBeforeAudioPlay?.();
    stopGuideAssistant();
    cancelEnglishSpeech();

    const reqId = `ema_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    currentRequestId = reqId;
    const isLikelyCached = synthesizedScripts.has(cleanedScript);
    isSynthesizing = !isLikelyCached;
    isPlaying = false;
    hasSynthesized = false;
    currentSec = 0;
    durationSec = 0;
    activeWordTimings = [];
    updateKaraokeWord(-1, false);
    if (statusBadgeRef) {
      statusBadgeRef.textContent = 'EMA Lightning · 48 kHz';
    }
    syncPlayerUi();

    try {
      const res = (await chrome.runtime.sendMessage({
        type: 'SPEAK_TURKISH_COACH',
        text: cleanedScript,
        rate: speeds[speedIdx] ?? 1.0,
        requestId: reqId,
      } satisfies ExtensionMessage)) as
        | { ok?: boolean; durationSec?: number; wordTimings?: Array<[number, number]>; error?: string }
        | undefined;
      if (disposed || currentRequestId !== reqId) return;

      isSynthesizing = false;
      if (res?.ok) {
        synthesizedScripts.add(cleanedScript);
        hasSynthesized = true;
        isPlaying = true;
        if (typeof res.durationSec === 'number' && res.durationSec > 0) {
          durationSec = res.durationSec;
        }
        if (Array.isArray(res.wordTimings) && res.wordTimings.length === activeWordSpans.length) {
          activeWordTimings = res.wordTimings;
          // Bind click-to-seek on each karaoke word span
          activeWordSpans.forEach((span, i) => {
            const startMs = activeWordTimings[i]?.[0];
            if (typeof startMs === 'number') {
              span.classList.add('is-seekable');
              span.title = 'Bu kelimeden dinle';
              span.onclick = () => {
                const sec = startMs / 1000;
                currentSec = sec;
                void chrome.runtime.sendMessage({
                  type: 'CONTROL_TURKISH_COACH',
                  command: 'seek',
                  value: sec,
                  requestId: currentRequestId,
                } satisfies ExtensionMessage);
                syncPlayerUi();
              };
            }
          });
        }
        if (statusBadgeRef) statusBadgeRef.textContent = 'EMA Lightning · 48 kHz';
      } else if (statusBadgeRef) {
        statusBadgeRef.textContent = res?.error
          ? `EMA ses hatası: ${res.error}`
          : 'EMA Lightning başlatılamadı.';
      }
      syncPlayerUi();
    } catch (err) {
      if (disposed || currentRequestId !== reqId) return;
      isSynthesizing = false;
      isPlaying = false;
      if (statusBadgeRef) {
        statusBadgeRef.textContent =
          err instanceof Error ? `Ses hatası: ${err.message}` : 'EMA ses hatası';
      }
      syncPlayerUi();
    }
  };

  const renderCoachResult = (data: AiGrammarCoachResult, initialIdx: number, autoNarrate: boolean): void => {
    activeCoachData = data;
    selectedIdx = Math.max(0, Math.min(data.items.length - 1, initialIdx));
    root.replaceChildren();

    const branchSlot = document.createElement('div');
    branchSlot.className = 'tm-branch-slot';

    const grid = document.createElement('div');
    grid.className = 'ai-coach-choice-grid';

    const detailWrap = document.createElement('div');
    detailWrap.className = 'ai-coach-detail-wrap';

    const renderActiveDetail = (item: AiGrammarCoachItem, shouldPlay: boolean): void => {
      detailWrap.replaceChildren();
      activeWordSpans = [];
      activeWordTimings = [];
      highlightedWordIdx = -1;
      hasSynthesized = false;
      isPlaying = false;
      isSynthesizing = false;
      currentSec = 0;
      durationSec = 0;

      // Highlight this exact rule's focusPhrase inside the question sentence above!
      activeFocusPhrase = item.focusPhrase.trim() || null;
      options.onFocusPhrase?.(activeFocusPhrase);

      // 1. Dedicated EMA Lightning audio bar for THIS rule only
      const audioWrap = document.createElement('div');
      audioWrap.className = 'ai-coach-audio-wrap';

      const audioTop = document.createElement('div');
      audioTop.className = 'ai-coach-audio-top';

      const badge = document.createElement('span');
      badge.className = 'ai-coach-voice-badge';
      badge.textContent = 'EMA Lightning · 48 kHz';
      statusBadgeRef = badge;

      const regenBtn = document.createElement('button');
      regenBtn.type = 'button';
      regenBtn.className = 'ai-coach-regen-btn';
      regenBtn.textContent = '↻ Yenile';
      regenBtn.title = 'Bu cümle için yapay zekâdan yeni açıklama üret';
      regenBtn.addEventListener('click', () => {
        coachResultCache.delete(sentenceEn);
        stopActiveTurkishCoachAudio();
        void loadAndRender(true);
      });

      audioTop.append(badge, regenBtn);

      const bar = document.createElement('div');
      bar.className = `tm-audio-bar is-ai ${options.compact ? 'is-compact' : ''}`;
      playerBarRef = bar;

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'tm-audio-play-btn';
      playBtn.textContent = '▶';
      playBtn.title = 'EMA Lightning sesli anlatımı oynat / duraklat';
      playBtnRef = playBtn;

      const restartBtn = document.createElement('button');
      restartBtn.type = 'button';
      restartBtn.className = 'tm-audio-mini-btn';
      restartBtn.textContent = '↺';
      restartBtn.title = 'Baştan oynat';
      restartBtnRef = restartBtn;

      const synthWaveEl = document.createElement('div');
      synthWaveEl.className = 'ai-coach-synth-wave';
      synthWaveEl.setAttribute('role', 'status');
      synthWaveEl.setAttribute('aria-live', 'polite');

      const buildWaveGroup = (side: 'left' | 'right', count: number): HTMLElement => {
        const group = document.createElement('span');
        group.className = `ai-coach-wave-group is-${side}`;
        group.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < count; i += 1) {
          const barEl = document.createElement('i');
          barEl.className = 'ai-coach-wave-bar';
          group.appendChild(barEl);
        }
        return group;
      };

      const synthLabelEl = document.createElement('span');
      synthLabelEl.className = 'ai-coach-synth-label';
      synthLabelEl.textContent = 'Hazırlanıyor…';

      synthWaveEl.append(buildWaveGroup('left', 7), synthLabelEl, buildWaveGroup('right', 7));

      const rangeEl = document.createElement('input');
      rangeEl.type = 'range';
      rangeEl.className = 'tm-audio-range';
      rangeEl.min = '0';
      rangeEl.max = '100';
      rangeEl.step = '0.05';
      rangeEl.value = '0';
      rangeRef = rangeEl;

      const timeEl = document.createElement('span');
      timeEl.className = 'tm-audio-time';
      timeEl.textContent = '0:00';
      timeRef = timeEl;

      const speedBtn = document.createElement('button');
      speedBtn.type = 'button';
      speedBtn.className = 'tm-audio-speed-btn';
      const curRate = speeds[speedIdx] ?? 1.0;
      speedBtn.textContent = `${curRate.toFixed(curRate === 1 ? 1 : 2).replace(/\.00$/, '.0')}x`;
      speedBtn.title = 'Oynatma Hızı';

      playBtn.addEventListener('click', async () => {
        if (isSynthesizing) return;
        if (!hasSynthesized || (currentSec === 0 && !isPlaying)) {
          await startEmaNarration(item.explanationTr);
          return;
        }
        const cmd = isPlaying ? 'pause' : 'resume';
        if (cmd === 'resume') {
          options.onBeforeAudioPlay?.();
          stopGuideAssistant();
          cancelEnglishSpeech();
        }
        const res = (await chrome.runtime.sendMessage({
          type: 'CONTROL_TURKISH_COACH',
          command: cmd,
          requestId: currentRequestId,
        } satisfies ExtensionMessage)) as { ok?: boolean; playing?: boolean } | undefined;
        if (res?.ok) {
          isPlaying = Boolean(res.playing);
          syncPlayerUi();
        } else if (cmd === 'resume') {
          await startEmaNarration(item.explanationTr);
        }
      });

      restartBtn.addEventListener('click', () => {
        if (isSynthesizing) return;
        void startEmaNarration(item.explanationTr);
      });

      rangeEl.addEventListener('input', () => {
        const target = Number(rangeEl.value);
        if (!Number.isFinite(target)) return;
        currentSec = target;
        void chrome.runtime.sendMessage({
          type: 'CONTROL_TURKISH_COACH',
          command: 'seek',
          value: target,
          requestId: currentRequestId,
        } satisfies ExtensionMessage);
        syncPlayerUi();
      });

      speedBtn.addEventListener('click', () => {
        speedIdx = (speedIdx + 1) % speeds.length;
        const rate = speeds[speedIdx] ?? 1.0;
        speedBtn.textContent = `${rate.toFixed(rate === 1 ? 1 : 2).replace(/\.00$/, '.0')}x`;
        void chrome.runtime.sendMessage({
          type: 'CONTROL_TURKISH_COACH',
          command: 'rate',
          value: rate,
          requestId: currentRequestId,
        } satisfies ExtensionMessage);
      });

      bar.append(playBtn, restartBtn, synthWaveEl, rangeEl, timeEl, speedBtn);
      audioWrap.append(audioTop, bar);

      // 2. Verbatim Displayed & Spoken Transcript + Tailored Examples for THIS rule only
      const scrollBox = document.createElement('div');
      scrollBox.className = 'ai-coach-scroll';

      const bodyCard = document.createElement('div');
      bodyCard.className = 'ai-coach-item is-focused';

      const headLineRow = document.createElement('div');
      headLineRow.className = 'ai-coach-item-head';

      const headlineEl = document.createElement('span');
      headlineEl.className = 'ai-coach-item-title';
      headlineEl.textContent = item.headlineTr || item.ruleTitle;
      headLineRow.appendChild(headlineEl);

      if (item.focusPhrase) {
        const phrasePill = document.createElement('span');
        phrasePill.className = 'ai-coach-focus-pill';
        phrasePill.textContent = `"${item.focusPhrase}"`;
        headLineRow.appendChild(phrasePill);
      }

      const expEl = document.createElement('p');
      expEl.className = 'ai-coach-item-exp';
      const displayExplanation = stripCoachMarkupForDisplay(item.explanationTr);
      const words = displayExplanation.split(/\s+/).filter(Boolean);
      words.forEach((word, wIdx) => {
        if (wIdx > 0) expEl.appendChild(document.createTextNode(' '));
        const sp = document.createElement('span');
        sp.className = 'tm-sync-word is-ai-word';
        sp.textContent = word;
        activeWordSpans.push(sp);
        expEl.appendChild(sp);
      });

      bodyCard.append(headLineRow, expEl);

      if (item.examples.length > 0) {
        const exList = document.createElement('div');
        exList.className = 'ai-coach-examples';
        for (const ex of item.examples) {
          const row = document.createElement('div');
          row.className = 'ai-coach-ex-row';

          const exTop = document.createElement('div');
          exTop.className = 'ai-coach-ex-en-row';

          const enSpan = document.createElement('span');
          enSpan.className = 'ai-coach-ex-en';
          enSpan.textContent = ex.en;

          const spkBtn = document.createElement('button');
          spkBtn.type = 'button';
          spkBtn.className = 'ai-coach-ex-speak';
          setIconOnly(spkBtn, 'volume', 13);
          spkBtn.title = 'Örneği İngilizce dinle';
          spkBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            stopActiveTurkishCoachAudio();
            options.onBeforeAudioPlay?.();
            stopGuideAssistant();
            speakEnglish(ex.en);
          });

          exTop.append(enSpan, spkBtn);

          const trSpan = document.createElement('div');
          trSpan.className = 'ai-coach-ex-tr';
          trSpan.textContent = ex.tr;

          row.append(exTop, trSpan);
          exList.appendChild(row);
        }
        bodyCard.appendChild(exList);
      }

      scrollBox.appendChild(bodyCard);
      detailWrap.append(audioWrap, scrollBox);

      if (shouldPlay) {
        void startEmaNarration(item.explanationTr);
      }
    };

    const renderPicker = (): void => {
      branchSlot.replaceChildren();
      grid.replaceChildren();
      const count = data.items.length;
      const colCount = Math.min(3, Math.max(1, count));
      branchSlot.appendChild(buildAiBranchTree(colCount, selectedIdx % colCount));
      grid.style.gridTemplateColumns = `repeat(${colCount}, minmax(0, 1fr))`;

      data.items.forEach((item, idx) => {
        const isSelected = idx === selectedIdx;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `ai-coach-choice ${isSelected ? 'is-active' : ''}`;
        btn.setAttribute('aria-pressed', String(isSelected));

        const titleEl = document.createElement('span');
        titleEl.className = 'ai-coach-choice-title';
        titleEl.textContent = `✦ ${item.ruleTitle}`;

        const cueEl = document.createElement('span');
        cueEl.className = 'ai-coach-choice-cue';
        cueEl.textContent = isSelected ? '✓ Seçili' : '▶ Dinle';

        btn.append(titleEl, cueEl);
        btn.addEventListener('click', () => {
          if (selectedIdx === idx) return;
          selectedIdx = idx;
          renderPicker();
          renderActiveDetail(data.items[selectedIdx]!, true);
        });
        grid.appendChild(btn);
      });
    };

    renderPicker();
    renderActiveDetail(data.items[selectedIdx]!, autoNarrate);
    root.append(branchSlot, grid, detailWrap);
  };

  const renderLoading = (): void => {
    root.replaceChildren();
    const box = document.createElement('div');
    box.className = 'ai-coach-state';
    box.innerHTML =
      '<div class="ai-coach-spinner"></div>' +
      '<div class="ai-coach-state-title">✦ Yapay Zekâ bu cümleyi çözümlüyor…</div>' +
      '<div class="ai-coach-state-sub">Her gramer kuralı ayrı ders kartı olarak hazırlanıp EMA Lightning (48 kHz) ile seslendirilecek.</div>';
    root.appendChild(box);
  };

  const renderError = (errMsg: string): void => {
    root.replaceChildren();
    const box = document.createElement('div');
    box.className = 'ai-coach-state is-error';

    const title = document.createElement('div');
    title.className = 'ai-coach-state-title';
    title.textContent = 'AI Canlı Öğretmen başlatılamadı';

    const sub = document.createElement('div');
    sub.className = 'ai-coach-state-sub';
    sub.textContent = errMsg;

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '6px';
    btnRow.style.flexWrap = 'wrap';
    btnRow.style.justifyContent = 'center';

    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'ai-coach-regen-btn';
    retryBtn.textContent = '↻ Tekrar Dene';
    retryBtn.addEventListener('click', () => void loadAndRender(true));
    btnRow.appendChild(retryBtn);

    if (options.onFallbackOffline) {
      const offlineBtn = document.createElement('button');
      offlineBtn.type = 'button';
      offlineBtn.className = 'ai-coach-regen-btn';
      setIconLabel(offlineBtn, 'headphones', 'Hazır Derslere Geç', 13);
      offlineBtn.addEventListener('click', () => options.onFallbackOffline?.());
      btnRow.appendChild(offlineBtn);
    }

    box.append(title, sub, btnRow);
    root.appendChild(box);
  };

  const loadAndRender = async (forceFresh: boolean): Promise<void> => {
    if (!forceFresh) {
      const cached = coachResultCache.get(sentenceEn);
      if (cached) {
        renderCoachResult(cached, 0, true);
        return;
      }
    }

    renderLoading();
    const detectedRuleLabels = options.detectedSkills.map((sid) => {
      const spec = getVoiceCoachRuleSpec(sid);
      return `${sid} (${spec.titleTr.split('(')[0]!.trim()})`;
    });

    try {
      const res = (await chrome.runtime.sendMessage({
        type: 'GENERATE_AI_GRAMMAR_COACH',
        sentenceEn,
        meaningTr: options.meaningTr,
        detectedRules: detectedRuleLabels,
        language: options.uiLanguage,
      } satisfies ExtensionMessage)) as
        | { ok?: boolean; coach?: AiGrammarCoachResult; error?: string }
        | undefined;

      if (disposed) return;

      if (res?.ok && res.coach && res.coach.items.length > 0) {
        cacheCoachResult(sentenceEn, res.coach);
        renderCoachResult(res.coach, 0, true);
      } else {
        renderError(
          res?.error ||
            'AI yanıt veremedi. Ayarlar → AI - API Ayarları bölümünden ücretsiz bir anahtar eklediğini kontrol et.'
        );
      }
    } catch (err) {
      if (disposed) return;
      renderError(err instanceof Error ? err.message : 'Bağlantı hatası');
    }
  };

  void loadAndRender(false);

  return {
    element: root,
    getActiveFocusPhrase: () => activeFocusPhrase,
    dispose: () => {
      disposed = true;
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(onRuntimeMessage);
      }
      stopActiveTurkishCoachAudio();
      activeCoachData = null;
      options.onFocusPhrase?.(null);
    },
  };
}
