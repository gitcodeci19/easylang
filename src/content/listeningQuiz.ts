import { getUiStrings, resolveSupportedLanguage } from '../shared/i18n';
import { speakEnglishText as speakSentence } from '../shared/speech';
import { evaluateDictationAnswer } from '../shared/srs';
import type {
  ExtensionMessage,
  ListeningChallenge,
} from '../shared/types';
import { buildCloseSvg, renderToast } from './widget';

const LISTENING_HOST_ID = 'etr-listening-quiz-host';
const sessionAskedIds: string[] = [];
let activeEscapeHandler: ((e: KeyboardEvent) => void) | null = null;
let blurredCaptionContainer: HTMLElement | null = null;

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
  restoreBlurredYouTubeCaptions();
  if (typeof window.speechSynthesis !== 'undefined') {
    window.speechSynthesis.cancel();
  }
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
    z-index: 2147483647;
    width: min(388px, calc(100vw - 28px));
    background-color: #0b0914;
    background-image:
      radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139, 92, 246, 0.14), transparent 70%),
      radial-gradient(rgba(196, 181, 253, 0.04) 1px, transparent 0);
    background-size: 100% 100%, 12px 12px;
    color: #f4f4f6;
    border: 1px solid rgba(196, 181, 253, 0.16);
    border-radius: 11px;
    padding: 13px 14px;
    box-shadow: 0 18px 42px rgba(7, 4, 18, 0.72), inset 0 1px 0 rgba(233, 213, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 9px;
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
    background: linear-gradient(90deg, #a855f7, #7c3aed);
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
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.14);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .etr-lq-meta {
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 10px;
    font-weight: 600;
    padding: 3px 6px;
    border-radius: 4px;
    background: #17171c;
    color: #a1a1aa;
    border: 1px solid rgba(255, 255, 255, 0.09);
  }

  .etr-lq-close {
    background: rgba(244, 63, 94, 0.12);
    border: 1px solid rgba(244, 63, 94, 0.36);
    color: #fda4af;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.14s, color 0.14s, border-color 0.14s;
  }

  .etr-lq-close:hover {
    background: rgba(244, 63, 94, 0.28);
    border-color: rgba(244, 63, 94, 0.72);
    color: #ffffff;
  }

  .etr-lq-audio-bar {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
    background: #111115;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 7px;
    padding: 6px;
  }

  .etr-lq-audio-btn {
    border: 1px solid rgba(255, 255, 255, 0.09);
    background: #17171c;
    color: #f4f4f6;
    border-radius: 5px;
    height: 26px;
    padding: 0 9px;
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.14s ease, border-color 0.14s ease;
  }

  .etr-lq-audio-btn:hover {
    background: #22222a;
    border-color: rgba(255, 255, 255, 0.18);
  }

  .etr-lq-prompt {
    color: #a1a1aa;
    font-size: 11.5px;
  }

  .etr-lq-textarea {
    width: 100%;
    min-height: 56px;
    resize: vertical;
    background: #120f1e;
    color: #f4f4f6;
    border: 1px solid rgba(196, 181, 253, 0.16);
    border-radius: 7px;
    padding: 8px 10px;
    font: inherit;
    font-size: 13px;
    outline: none;
  }

  .etr-lq-textarea:focus {
    border-color: #a855f7;
  }

  .etr-lq-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }

  .etr-lq-btn {
    border: 1px solid rgba(196, 181, 253, 0.12);
    border-radius: 6px;
    height: 29px;
    padding: 0 11px;
    font: inherit;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .etr-lq-btn-primary {
    background: linear-gradient(135deg, #9333ea, #7c3aed);
    color: #ffffff;
    border-color: rgba(196, 181, 253, 0.35);
    font-weight: 700;
  }

  .etr-lq-btn-primary:hover {
    background: linear-gradient(135deg, #a855f7, #8b5cf6);
  }

  .etr-lq-btn-ghost {
    background: #131317;
    color: #a1a1aa;
    border-color: rgba(255, 255, 255, 0.09);
  }

  .etr-lq-btn-ghost:hover {
    background: #1f1f26;
    color: #f4f4f6;
  }

  .etr-lq-diff {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px;
    border-radius: 7px;
    background: #111115;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .etr-lq-word-ok {
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.14);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
    font-size: 11.5px;
    font-weight: 600;
  }

  .etr-lq-word-miss {
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(244, 63, 94, 0.14);
    color: #fb7185;
    border: 1px solid rgba(244, 63, 94, 0.32);
    font-size: 11.5px;
    font-weight: 600;
  }

  .etr-lq-meaning {
    font-size: 11.5px;
    color: #a1a1aa;
    padding: 6px 8px;
    background: #111115;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
  }

  .etr-lq-compare {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 8px 10px;
    border-radius: 7px;
    background: #111115;
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 12px;
  }

  .etr-lq-compare-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .etr-lq-compare-lbl {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #71717a;
  }

  .etr-lq-compare-user {
    color: #fbbf24;
    word-break: break-word;
  }

  .etr-lq-compare-ref {
    color: #34d399;
    font-weight: 600;
    word-break: break-word;
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

  audioBar.append(playNormalBtn, playSlowBtn);

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

  const handleSubmit = () => {
    const attempt = textarea.value.trim();
    if (!attempt) {
      textarea.focus();
      return;
    }

    restoreBlurredYouTubeCaptions();
    const evaluation = evaluateDictationAnswer(sentenceEn, attempt);
    bodyWrap.replaceChildren();

    const scoreLine = createEl(
      'div',
      'etr-lq-prompt',
      isTr
        ? `${evaluation.isCorrect ? '✓' : '✕'} Doğruluk: %${evaluation.accuracyPercent}`
        : `${evaluation.isCorrect ? '✓' : '✕'} Accuracy: ${evaluation.accuracyPercent}%`
    );
    scoreLine.style.fontWeight = '700';
    scoreLine.style.color = evaluation.isCorrect ? '#34d399' : '#fbbf24';

    const compareBox = createEl('div', 'etr-lq-compare');
    const userRow = createEl('div', 'etr-lq-compare-row');
    userRow.append(
      createEl('span', 'etr-lq-compare-lbl', isTr ? 'Senin Cevabın' : 'Your Answer'),
      createEl('div', 'etr-lq-compare-user', attempt)
    );
    const refRow = createEl('div', 'etr-lq-compare-row');
    refRow.append(
      createEl('span', 'etr-lq-compare-lbl', isTr ? 'Doğru Cümle' : 'Correct Sentence'),
      createEl('div', 'etr-lq-compare-ref', sentenceEn)
    );
    compareBox.append(userRow, refRow);

    const diffBox = createEl('div', 'etr-lq-diff');
    for (const tok of evaluation.tokens) {
      if (tok.matched) {
        diffBox.appendChild(createEl('span', 'etr-lq-word-ok', tok.expected));
      } else {
        const label = tok.actual ? `${tok.actual} → ${tok.expected}` : `∅ → ${tok.expected}`;
        diffBox.appendChild(createEl('span', 'etr-lq-word-miss', label));
      }
    }

    bodyWrap.append(scoreLine, compareBox, diffBox);

    if (meaningTr) {
      bodyWrap.appendChild(
        createEl('div', 'etr-lq-meaning', isTr ? `Anlam: ${meaningTr}` : `Meaning: ${meaningTr}`)
      );
    }

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
