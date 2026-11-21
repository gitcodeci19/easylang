import { getUiStrings, resolveSupportedLanguage } from '../shared/i18n';
import { playCorrectSfx, playWrongSfx } from '../shared/sfx';
import { cancelEnglishSpeech, speakEnglishText as speakSentence } from '../shared/speech';
import { evaluateDictationAnswer } from '../shared/srs';
import type {
  ExtensionMessage,
  ListeningChallenge,
} from '../shared/types';
import {
  installWordHoverTooltip,
  type WordHoverTooltipController,
} from '../shared/wordHoverTooltip';
import {
  buildCloseSvg,
  lookupOfflineWordFromBackground,
  renderToast,
} from './widget';

const LISTENING_HOST_ID = 'etr-listening-quiz-host';
const sessionAskedIds: string[] = [];
let activeEscapeHandler: ((e: KeyboardEvent) => void) | null = null;
let blurredCaptionContainer: HTMLElement | null = null;
let activeListeningTooltip: WordHoverTooltipController | null = null;

function sendBgMessage<T = unknown>(message: ExtensionMessage): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function isolateKeyboardEvents(el: HTMLElement): void {
  const stop = (e: Event) => {
    e.stopPropagation();
  };
  el.addEventListener('keydown', stop);
  el.addEventListener('keyup', stop);
  el.addEventListener('keypress', stop);
}

function restoreBlurredYouTubeCaptions(): void {
  if (blurredCaptionContainer) {
    blurredCaptionContainer.style.filter = '';
    blurredCaptionContainer = null;
  }
}

export function removeListeningQuiz(): void {
  if (activeEscapeHandler) {
    window.removeEventListener('keydown', activeEscapeHandler);
    activeEscapeHandler = null;
  }
  activeListeningTooltip?.dispose();
  activeListeningTooltip = null;
  restoreBlurredYouTubeCaptions();
  cancelEnglishSpeech();
  document.getElementById(LISTENING_HOST_ID)?.remove();
}

/**
 * If the user is actively watching a YouTube video with visible English captions,
 * captures the live caption line and rewinds the video 4 seconds so they can transcribe it.
 */
function tryCaptureLiveYouTubeCaption(): {
  sentenceEn: string;
  replayVideoSegment: () => void;
} | null {
  if (!window.location.hostname.includes('youtube.com')) return null;
  const video = document.querySelector<HTMLVideoElement>('video.html5-main-video, video');
  const segments = Array.from(document.querySelectorAll<HTMLElement>('.ytp-caption-segment'));
  if (!video || segments.length === 0) return null;

  const captionText = segments
    .map((s) => s.textContent?.trim() ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = captionText.split(/\s+/).filter(Boolean);
  if (words.length < 4 || words.length > 26) return null;

  const captionWindow = document.querySelector<HTMLElement>('.ytp-caption-window-container');
  if (captionWindow) {
    blurredCaptionContainer = captionWindow;
    captionWindow.style.filter = 'blur(9px)';
  }

  const clipStart = Math.max(0, video.currentTime - 4.2);
  const clipEnd = video.currentTime + 0.6;

  const replayVideoSegment = () => {
    video.currentTime = clipStart;
    void video.play();
    window.setTimeout(() => {
      if (!video.paused && video.currentTime >= clipEnd) {
        video.pause();
      }
    }, Math.round((clipEnd - clipStart) * 1000) + 250);
  };

  return { sentenceEn: captionText, replayVideoSegment };
}

const LISTENING_CSS = `
  :host {
    all: initial;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  .etr-lq-card {
    position: fixed;
    top: 14px;
    right: 14px;
    z-index: 2147483645;
    width: min(382px, calc(100vw - 28px));
    background: #111117;
    color: #f4f4f6;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 12px 14px;
    box-shadow: 0 20px 44px rgba(0, 0, 0, 0.68), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 12.5px;
    line-height: 1.42;
    overflow: hidden;
  }

  .etr-lq-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: #10b981;
  }

  .etr-lq-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .etr-lq-badges {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }

  .etr-lq-badge {
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 10px;
    font-weight: 700;
    padding: 3px 6px;
    border-radius: 5px;
    background: rgba(16, 185, 129, 0.13);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.32);
  }

  .etr-lq-meta {
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 10px;
    font-weight: 600;
    padding: 3px 6px;
    border-radius: 5px;
    background: #1a1a23;
    color: #a1a1b2;
    border: 1px solid rgba(255, 255, 255, 0.09);
  }

  .etr-lq-close {
    background: #181821;
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: #9090a2;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }

  .etr-lq-close:hover {
    background: rgba(225, 29, 72, 0.22);
    border-color: rgba(244, 63, 94, 0.5);
    color: #ffe4e6;
  }

  .etr-lq-audio-bar {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
    background: #161720;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 6px;
  }

  .etr-lq-audio-btn {
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: #1e202b;
    color: #e4e4ee;
    border-radius: 6px;
    height: 26px;
    padding: 0 9px;
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
  }

  .etr-lq-audio-btn:first-child {
    background: rgba(16, 185, 129, 0.14);
    border-color: rgba(16, 185, 129, 0.36);
    color: #6ee7b7;
  }

  .etr-lq-audio-btn:hover {
    background: #272936;
    border-color: rgba(16, 185, 129, 0.5);
    color: #ffffff;
  }

  .etr-lq-cant-listen-btn {
    margin-left: auto;
    border: 1px solid rgba(148, 163, 184, 0.24);
    background: rgba(148, 163, 184, 0.08);
    color: #cbd5e1;
    border-radius: 6px;
    height: 26px;
    padding: 0 9px;
    font: inherit;
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
  }

  .etr-lq-cant-listen-btn:hover:not(:disabled) {
    background: rgba(148, 163, 184, 0.16);
    border-color: rgba(148, 163, 184, 0.42);
    color: #f8fafc;
  }

  .etr-lq-cant-listen-btn:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .etr-lq-prompt {
    color: #9e9eb0;
    font-size: 11.5px;
  }

  .etr-lq-textarea {
    width: 100%;
    min-height: 54px;
    resize: vertical;
    background: #0c0c11;
    color: #f4f4f6;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 7px;
    padding: 8px 10px;
    font: inherit;
    font-size: 13px;
    outline: none;
    transition: border-color 0.14s, box-shadow 0.14s;
  }

  .etr-lq-textarea:focus {
    border-color: #10b981;
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
  }

  .etr-lq-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }

  .etr-lq-btn {
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    height: 28px;
    padding: 0 11px;
    font: inherit;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
  }

  .etr-lq-btn-primary {
    background: #059669;
    color: #ffffff;
    border-color: rgba(110, 231, 183, 0.3);
    font-weight: 700;
  }

  .etr-lq-btn-primary:hover {
    background: #10b981;
  }

  .etr-lq-btn-ghost {
    background: #181821;
    color: #a4a4b4;
    border-color: rgba(255, 255, 255, 0.09);
  }

  .etr-lq-btn-ghost:hover {
    background: #22222e;
    color: #f4f4f6;
    border-color: rgba(255, 255, 255, 0.18);
  }

  .etr-lq-diff {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 7px 8px;
    border-radius: 8px;
    background: #16161f;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .etr-lq-word-ok {
    padding: 2px 6px;
    border-radius: 5px;
    background: rgba(16, 185, 129, 0.13);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.28);
    font-size: 11.5px;
    font-weight: 600;
  }

  .etr-lq-word-miss {
    padding: 2px 6px;
    border-radius: 5px;
    background: rgba(225, 29, 72, 0.13);
    color: #fb7185;
    border: 1px solid rgba(225, 29, 72, 0.3);
    font-size: 11.5px;
    font-weight: 600;
  }

  .etr-lq-meaning {
    font-size: 11.5px;
    color: #b4b4c4;
    padding: 6px 9px;
    background: #16161f;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 7px;
  }

  .etr-lq-compare {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    border-radius: 8px;
    background: #16161f;
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 12px;
  }

  .etr-lq-compare-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .etr-lq-compare-lbl {
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #828296;
  }

  .etr-lq-compare-user {
    color: #fcd34d;
    word-break: break-word;
  }

  .etr-lq-compare-ref {
    color: #34d399;
    font-weight: 600;
    word-break: break-word;
  }

  /* Ice White & Modern Cobalt Tactile 3D Override */
  .etr-lq-card {
    background-color: #f9fbfe;
    background-image:
      radial-gradient(circle at 82% 14%, rgba(37, 99, 235, 0.04), transparent 56%),
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='440' height='300' viewBox='0 0 440 300' fill='none'%3E%3Cpath d='M0 74 C 73 32, 147 32, 220 74 C 293 116, 367 116, 440 74' stroke='%233b82f6' stroke-opacity='0.075' stroke-width='1.2'/%3E%3Cpath d='M0 96 C 73 58, 147 58, 220 96 C 293 134, 367 134, 440 96' stroke='%2364748b' stroke-opacity='0.055' stroke-width='1'/%3E%3Cpath d='M0 224 C 73 262, 147 262, 220 224 C 293 186, 367 186, 440 224' stroke='%2364748b' stroke-opacity='0.07' stroke-width='1.2'/%3E%3Cpath d='M0 244 C 73 278, 147 278, 220 244 C 293 210, 367 210, 440 244' stroke='%233b82f6' stroke-opacity='0.05' stroke-width='1'/%3E%3C/svg%3E");
    background-size: 100% 100%, 440px 300px;
    color: #0f172a;
    border: 2px solid #e2e8f0;
    border-bottom: 4px solid #cbd5e1;
    border-radius: 18px;
    box-shadow: 0 20px 48px rgba(15, 23, 42, 0.16);
  }
  .etr-lq-head {
    background: #ffffff;
    border-bottom: 2px solid #e2e8f0;
  }
  .etr-lq-badge {
    background: #eff6ff;
    border: 1.5px solid #bfdbfe;
    color: #1d4ed8;
  }
  .etr-lq-meta {
    background: #f1f5f9;
    border: 1.5px solid #e2e8f0;
    color: #475569;
  }
  .etr-lq-close {
    background: #ffffff;
    border: 2px solid #e2e8f0;
    color: #475569;
  }
  .etr-lq-close:hover {
    background: #ffe4e6;
    border-color: #fda4af;
    color: #be123c;
  }
  .etr-lq-audio-bar {
    background: #ffffff;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
  }
  .etr-lq-audio-btn,
  .etr-lq-cant-listen-btn,
  .etr-lq-btn,
  .etr-lq-btn-ghost {
    background: #ffffff;
    border: 2px solid #e2e8f0;
    border-bottom: 3px solid #cbd5e1;
    color: #334155;
    border-radius: 10px;
    font-weight: 700;
  }
  .etr-lq-audio-btn:hover,
  .etr-lq-cant-listen-btn:hover:not(:disabled),
  .etr-lq-btn-ghost:hover {
    background: #eff6ff;
    border-color: #93c5fd;
    border-bottom-color: #3b82f6;
    color: #1d4ed8;
  }
  .etr-lq-audio-btn:first-child,
  .etr-lq-btn-primary {
    background: #2563eb;
    border-color: #2563eb;
    border-bottom-color: #1d4ed8;
    color: #ffffff;
  }
  .etr-lq-audio-btn:first-child:hover,
  .etr-lq-btn-primary:hover {
    background: #3b82f6;
    border-color: #3b82f6;
    border-bottom-color: #1d4ed8;
    color: #ffffff;
  }
  .etr-lq-prompt,
  .etr-lq-compare-lbl {
    color: #475569;
  }
  .etr-lq-meaning {
    background: #ffffff;
    border: 1.5px solid #e2e8f0;
    color: #334155;
  }
  .etr-lq-textarea {
    background: #ffffff;
    color: #0f172a;
    border: 2px solid #cbd5e1;
    border-radius: 12px;
  }
  .etr-lq-textarea:focus {
    background: #ffffff;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
  }
  .etr-lq-compare,
  .etr-lq-diff {
    background: #ffffff;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
  }
  .etr-lq-compare-user {
    color: #b45309;
    font-weight: 600;
  }
  .etr-lq-compare-ref,
  .etr-lq-word-ok {
    color: #15803d;
  }
  .etr-lq-word-ok {
    background: #dcfce7;
    border-color: #86efac;
  }
  .etr-lq-word-miss {
    background: #ffe4e6;
    border-color: #fda4af;
    color: #be123c;
  }
`;

export async function launchListeningQuiz(): Promise<void> {
  removeListeningQuiz();

  const liveYt = tryCaptureLiveYouTubeCaption();

  const response = await sendBgMessage<{
    ok: boolean;
    challenge?: ListeningChallenge;
    error?: string;
  }>({
    type: 'GET_LISTENING_CHALLENGE',
    excludeIds: sessionAskedIds.slice(-60),
  });

  if (!liveYt && (!response?.ok || !response.challenge)) {
    renderToast(response?.error ?? 'Could not load a listening sentence.');
    return;
  }

  const fallbackChallenge = response?.challenge;
  const langMode = fallbackChallenge?.uiLanguage ?? 'auto';
  const ui = getUiStrings(langMode);
  const isTr = resolveSupportedLanguage(langMode) === 'tr';

  const sentenceEn = liveYt?.sentenceEn ?? fallbackChallenge!.sentenceEn;
  const meaningTr = liveYt ? '' : (fallbackChallenge?.meaningTr ?? '');
  const wordCount = sentenceEn.trim().split(/\s+/).length;
  const levelLabel = liveYt ? 'YouTube' : (fallbackChallenge?.level ?? 'B1');

  if (fallbackChallenge?.cardId) {
    sessionAskedIds.push(fallbackChallenge.cardId);
  }

  const host = document.createElement('div');
  host.id = LISTENING_HOST_ID;
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = LISTENING_CSS;

  const card = createEl('div', 'etr-lq-card');
  isolateKeyboardEvents(card);

  const head = createEl('div', 'etr-lq-head');
  const badges = createEl('div', 'etr-lq-badges');
  badges.append(
    createEl('span', 'etr-lq-badge', ui.listeningTitle),
    createEl('span', 'etr-lq-meta', `${levelLabel} · ${wordCount}w`)
  );

  const closeBtn = createEl('button', 'etr-lq-close');
  closeBtn.type = 'button';
  closeBtn.title = ui.closeBtn;
  closeBtn.setAttribute('aria-label', ui.closeBtn);
  closeBtn.appendChild(buildCloseSvg());
  closeBtn.addEventListener('click', () => removeListeningQuiz());
  head.append(badges, closeBtn);

  const audioBar = createEl('div', 'etr-lq-audio-bar');
  const playNormalBtn = createEl('button', 'etr-lq-audio-btn', `▶ ${ui.playNormal}`);
  playNormalBtn.type = 'button';
  playNormalBtn.addEventListener('click', () => {
    if (liveYt) {
      liveYt.replayVideoSegment();
    } else {
      speakSentence(sentenceEn, 0.96);
    }
  });

  const playSlowBtn = createEl('button', 'etr-lq-audio-btn', ui.playSlow);
  playSlowBtn.type = 'button';
  playSlowBtn.addEventListener('click', () => {
    speakSentence(sentenceEn, 0.72);
  });

  const cantListenBtn = createEl(
    'button',
    'etr-lq-cant-listen-btn',
    isTr ? 'Şu an sesi dinleyemiyorum' : "Can't listen right now"
  );
  cantListenBtn.type = 'button';

  audioBar.append(playNormalBtn, playSlowBtn, cantListenBtn);

  const promptEl = createEl('div', 'etr-lq-prompt', ui.listeningPrompt);
  const textarea = createEl('textarea', 'etr-lq-textarea');
  textarea.placeholder = ui.listeningPlaceholder;

  const checkBtn = createEl('button', 'etr-lq-btn etr-lq-btn-primary', ui.checkAnswer);
  checkBtn.type = 'button';

  const skipBtn = createEl('button', 'etr-lq-btn etr-lq-btn-ghost', ui.dontKnow);
  skipBtn.type = 'button';
  skipBtn.title = ui.nextListening;
  skipBtn.addEventListener('click', () => {
    void launchListeningQuiz();
  });

  const actions = createEl('div', 'etr-lq-actions');
  actions.append(skipBtn, checkBtn);

  const bodyWrap = createEl('div');
  bodyWrap.style.display = 'flex';
  bodyWrap.style.flexDirection = 'column';
  bodyWrap.style.gap = '8px';
  bodyWrap.append(promptEl, textarea, actions);

  card.append(head, audioBar, bodyWrap);
  shadow.append(style, card);
  activeListeningTooltip = installWordHoverTooltip({
    root: shadow,
    delayMs: 1500,
    lookupWord: lookupOfflineWordFromBackground,
  });
  (document.body ?? document.documentElement).appendChild(host);

  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      removeListeningQuiz();
    }
  };
  activeEscapeHandler = escHandler;
  card.addEventListener('keydown', escHandler);
  window.addEventListener('keydown', escHandler);

  if (liveYt) {
    liveYt.replayVideoSegment();
  } else {
    speakSentence(sentenceEn, 0.96);
  }
  requestAnimationFrame(() => textarea.focus({ preventScroll: true }));

  const appendMeaningIfPresent = (): void => {
    if (!meaningTr) return;
    const meaningEl = createEl(
      'div',
      'etr-lq-meaning',
      isTr ? `Anlam: ${meaningTr}` : `Meaning: ${meaningTr}`
    );
    meaningEl.dataset.wordLang = 'tr';
    bodyWrap.appendChild(meaningEl);
  };

  const handleNeutralAudioBypass = (): void => {
    cancelEnglishSpeech();
    restoreBlurredYouTubeCaptions();
    cantListenBtn.disabled = true;
    bodyWrap.replaceChildren();

    const statusLine = createEl(
      'div',
      'etr-lq-prompt',
      isTr
        ? 'Dinlemeden kabul edildi · Doğru veya yanlış işlenmedi'
        : 'Accepted without audio · Not scored as right or wrong'
    );
    statusLine.style.fontWeight = '700';
    statusLine.style.color = '#475569';

    const compareBox = createEl('div', 'etr-lq-compare');
    const refRow = createEl('div', 'etr-lq-compare-row');
    const refValEl = createEl('div', 'etr-lq-compare-ref', sentenceEn);
    refValEl.dataset.wordLang = 'en';
    refRow.append(
      createEl('span', 'etr-lq-compare-lbl', isTr ? 'Cümle' : 'Sentence'),
      refValEl
    );
    compareBox.appendChild(refRow);

    bodyWrap.append(statusLine, compareBox);
    appendMeaningIfPresent();

    const nextRow = createEl('div', 'etr-lq-actions');
    const doneBtn = createEl('button', 'etr-lq-btn etr-lq-btn-ghost', ui.closeBtn);
    doneBtn.type = 'button';
    doneBtn.addEventListener('click', () => removeListeningQuiz());
    nextRow.appendChild(doneBtn);
    bodyWrap.appendChild(nextRow);
    doneBtn.focus({ preventScroll: true });
  };

  cantListenBtn.addEventListener('click', handleNeutralAudioBypass);

  const handleSubmit = () => {
    const attempt = textarea.value.trim();
    if (!attempt) {
      textarea.focus();
      return;
    }

    cantListenBtn.disabled = true;
    restoreBlurredYouTubeCaptions();
    const evaluation = evaluateDictationAnswer(sentenceEn, attempt);
    if (evaluation.isCorrect) {
      playCorrectSfx();
    } else {
      playWrongSfx();
    }
    void sendBgMessage({
      type: 'RECORD_LISTENING_RESULT',
      cardId: liveYt ? undefined : fallbackChallenge?.cardId,
      isCorrect: evaluation.isCorrect,
      accuracyPercent: evaluation.accuracyPercent,
    }).catch(() => {});
    bodyWrap.replaceChildren();

    const scoreLine = createEl(
      'div',
      'etr-lq-prompt',
      isTr
        ? `${evaluation.isCorrect ? '✓' : '✕'} Doğruluk: %${evaluation.accuracyPercent}${evaluation.isCorrect ? ' · +5 XP' : ''}`
        : `${evaluation.isCorrect ? '✓' : '✕'} Accuracy: ${evaluation.accuracyPercent}%${evaluation.isCorrect ? ' · +5 XP' : ''}`
    );
    scoreLine.style.fontWeight = '700';
    scoreLine.style.color = evaluation.isCorrect ? '#15803d' : '#be123c';

    const compareBox = createEl('div', 'etr-lq-compare');
    const userRow = createEl('div', 'etr-lq-compare-row');
    const userValEl = createEl('div', 'etr-lq-compare-user', attempt);
    userValEl.dataset.wordLang = 'en';
    userRow.append(
      createEl('span', 'etr-lq-compare-lbl', isTr ? 'Senin Cevabın' : 'Your Answer'),
      userValEl
    );
    const refRow = createEl('div', 'etr-lq-compare-row');
    const refValEl = createEl('div', 'etr-lq-compare-ref', sentenceEn);
    refValEl.dataset.wordLang = 'en';
    refRow.append(
      createEl('span', 'etr-lq-compare-lbl', isTr ? 'Doğru Cümle' : 'Correct Sentence'),
      refValEl
    );
    compareBox.append(userRow, refRow);

    const diffBox = createEl('div', 'etr-lq-diff');
    diffBox.dataset.wordLang = 'en';
    for (const tok of evaluation.tokens) {
      if (tok.matched) {
        diffBox.appendChild(createEl('span', 'etr-lq-word-ok', tok.expected));
      } else {
        const label = tok.actual ? `${tok.actual} → ${tok.expected}` : `∅ → ${tok.expected}`;
        diffBox.appendChild(createEl('span', 'etr-lq-word-miss', label));
      }
    }

    bodyWrap.append(scoreLine, compareBox, diffBox);
    appendMeaningIfPresent();

    const nextRow = createEl('div', 'etr-lq-actions');
    const doneBtn = createEl('button', 'etr-lq-btn etr-lq-btn-ghost', ui.closeBtn);
    doneBtn.type = 'button';
    doneBtn.addEventListener('click', () => removeListeningQuiz());

    const nextBtn = createEl('button', 'etr-lq-btn etr-lq-btn-primary', ui.nextListening);
    nextBtn.type = 'button';
    nextBtn.addEventListener('click', () => {
      void launchListeningQuiz();
    });

    nextRow.append(doneBtn, nextBtn);
    bodyWrap.appendChild(nextRow);
    nextBtn.focus({ preventScroll: true });
  };

  checkBtn.addEventListener('click', handleSubmit);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  });
}
