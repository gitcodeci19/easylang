import { resolveSupportedLanguage } from '../shared/i18n';
import {
  normalizePageSentenceKey,
  selectPageSentenceCandidates,
  type ReadablePageBlockInput,
} from '../shared/pageSentenceExtractor';
import {
  clearAskedPageSentencesSubset,
  getAskedPageSentences,
  getSettings,
  markPageSentenceAsked,
} from '../shared/storage';
import type {
  ExtensionMessage,
  PageAnswerEvaluation,
  PageTranslationDirection,
  ValidatedPageChallenge,
} from '../shared/types';
import { installWordHoverTooltip } from '../shared/wordHoverTooltip';
import {
  buildCloseSvg,
  lookupOfflineWordFromBackground,
  renderToast,
} from './widget';

const PAGE_QUIZ_HOST_ID = 'etr-page-quiz-host';
const HIGHLIGHT_ATTR = 'data-etr-page-highlight';

const BLOCK_SELECTOR =
  'p, div, li, blockquote, dd, figcaption, td, article, section, main';

const EXCLUDED_ANCESTOR_SELECTOR = [
  'script',
  'style',
  'noscript',
  'svg',
  'canvas',
  'nav',
  'header',
  'footer',
  'aside',
  'form',
  'button',
  'input',
  'textarea',
  'select',
  'code',
  'pre',
  'kbd',
  'samp',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  '[contenteditable="true"]',
  '[aria-hidden="true"]',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="menubar"]',
  '[role="toolbar"]',
  '.bbCodeBlock-title',
  '.message-userDetails',
  '.message-attribution',
  '.message-actionBar',
  '.reactionsBar',
].join(', ');

const SKIP_TEXT_PARENT_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'CODE',
  'PRE',
  'BUTTON',
  'SVG',
  'INPUT',
  'TEXTAREA',
  'SELECT',
]);

/** Child block tags whose text belongs to their own block entry rather than an outer container. */
const NESTED_BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'BLOCKQUOTE',
  'UL',
  'OL',
  'LI',
  'DL',
  'DT',
  'DD',
  'TABLE',
  'THEAD',
  'TBODY',
  'TR',
  'TD',
  'TH',
  'SECTION',
  'ARTICLE',
  'MAIN',
  'ASIDE',
  'NAV',
  'HEADER',
  'FOOTER',
  'FORM',
  'FIGURE',
  'FIGCAPTION',
  'DETAILS',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
]);

type OwnTextToken =
  | { kind: 'text'; node: Text; value: string }
  | { kind: 'break' };

interface DomBlockRecord extends ReadablePageBlockInput {
  element: Element;
}

interface CharPosition {
  node: Text;
  startOffset: number;
  endOffset: number;
}

const sessionExcludedSentences = new Set<string>();
let activeCleanup: (() => void) | null = null;
let currentRequestToken = 0;

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

/**
 * Unwraps all yellow `<mark data-etr-page-highlight="1">` nodes created by this quiz
 * and merges adjacent text nodes back into pristine host DOM.
 */
export function clearPageHighlights(): void {
  const marks = document.querySelectorAll(`mark[${HIGHLIGHT_ATTR}="1"]`);
  const parentsToNormalize = new Set<Node>();

  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parentsToNormalize.add(parent);
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
  }

  for (const parent of parentsToNormalize) {
    if (parent instanceof Element || parent instanceof DocumentFragment) {
      parent.normalize();
    }
  }
}

/** Removes the active page-quiz popover, listeners, and DOM yellow highlights. */
export function removePageHighlightQuiz(): void {
  currentRequestToken += 1;
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }
  document.getElementById(PAGE_QUIZ_HOST_ID)?.remove();
  clearPageHighlights();
}

function isElementVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    Number(style.opacity) === 0
  ) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width >= 40 && rect.height >= 12;
}

function getTagPriority(el: Element): number {
  // Deprioritize quoted reply blocks so primary post/article text is preferred when available.
  if (el.closest('blockquote, .bbCodeBlock--quote, q')) {
    return 1;
  }
  const lower = el.tagName.toLowerCase();
  if (lower === 'p') return 3;
  if (
    lower === 'div' &&
    el.closest('article, main, [role="main"], .message-body, .bbWrapper, .post-content')
  ) {
    return 3;
  }
  if (lower === 'div' || lower === 'li' || lower === 'dd' || lower === 'figcaption') {
    return 2;
  }
  return 1;
}

/**
 * Collects only the direct text and inline-element text belonging to `root`,
 * without descending into nested block containers (`div`, `p`, `blockquote`, etc.)
 * that are evaluated as separate candidate blocks.
 */
function collectOwnTextTokens(root: Element): OwnTextToken[] {
  const tokens: OwnTextToken[] = [];

  const visit = (parent: Node) => {
    for (let child = parent.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === Node.TEXT_NODE) {
        const value = child.nodeValue ?? '';
        if (value) {
          tokens.push({ kind: 'text', node: child as Text, value });
        }
        continue;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as Element;
      if (el.id === 'en-tr-recall-shadow-host' || el.id === PAGE_QUIZ_HOST_ID) continue;

      const tag = el.tagName.toUpperCase();
      if (tag === 'BR') {
        tokens.push({ kind: 'break' });
        continue;
      }
      if (SKIP_TEXT_PARENT_TAGS.has(tag) || NESTED_BLOCK_TAGS.has(tag)) {
        continue;
      }
      if (el.matches(EXCLUDED_ANCESTOR_SELECTOR)) {
        continue;
      }

      visit(el);
    }
  };

  visit(root);
  return tokens;
}

/**
 * Extracts normalized readable text belonging directly to `root` (and its inline children).
 */
function extractCleanElementText(root: Element): string {
  const tokens = collectOwnTextTokens(root);
  const parts: string[] = [];
  for (const token of tokens) {
    if (token.kind === 'break') {
      parts.push(' ');
    } else {
      parts.push(token.value);
    }
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
}

/**
 * Scans the active webpage DOM for visible, non-navigation prose blocks using pure DOM & regex rules.
 * Supports both semantic `<p>` articles and `<div>`/`<br>` forum/comment layouts (e.g. XenForo, Reddit, SPA).
 */
function collectReadablePageBlocks(): DomBlockRecord[] {
  const rawElements = Array.from(document.querySelectorAll(BLOCK_SELECTOR));
  const blocks: DomBlockRecord[] = [];
  const viewH = window.innerHeight || 800;

  for (const el of rawElements) {
    if (el.id === 'en-tr-recall-shadow-host' || el.id === PAGE_QUIZ_HOST_ID) continue;
    if (el.closest('#en-tr-recall-shadow-host, #etr-page-quiz-host')) continue;
    if (el.closest(EXCLUDED_ANCESTOR_SELECTOR)) continue;

    const text = extractCleanElementText(el);
    if (text.length < 25) continue;

    if (!isElementVisible(el)) continue;

    const rect = el.getBoundingClientRect();
    const inViewport = rect.bottom > 0 && rect.top < viewH;

    blocks.push({
      element: el,
      blockIndex: blocks.length,
      text,
      inViewport,
      tagPriority: getTagPriority(el),
    });
  }

  return blocks;
}

/**
 * Maps whitespace-collapsed sentence boundaries back onto exact Text nodes and wraps them in yellow `<mark>` tags.
 */
function highlightSentenceInElement(root: Element, targetSentence: string): HTMLElement[] {
  clearPageHighlights();

  const tokens = collectOwnTextTokens(root);
  const chars: string[] = [];
  const positions: Array<CharPosition | null> = [];
  let inWhitespace = true; // Trim leading whitespace.

  for (const token of tokens) {
    if (token.kind === 'break') {
      if (!inWhitespace) {
        chars.push(' ');
        positions.push(null);
        inWhitespace = true;
      }
      continue;
    }

    const raw = token.value;
    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw.charAt(i);
      if (/\s/.test(ch)) {
        if (!inWhitespace) {
          chars.push(' ');
          positions.push({ node: token.node, startOffset: i, endOffset: i + 1 });
          inWhitespace = true;
        }
      } else {
        chars.push(ch);
        positions.push({ node: token.node, startOffset: i, endOffset: i + 1 });
        inWhitespace = false;
      }
    }
  }

  while (chars.length > 0 && chars[chars.length - 1] === ' ') {
    chars.pop();
    positions.pop();
  }

  const normalized = chars.join('');
  const cleanTarget = targetSentence.replace(/\s+/g, ' ').trim();
  let matchStart = normalized.indexOf(cleanTarget);
  if (matchStart < 0) {
    matchStart = normalized.toLowerCase().indexOf(cleanTarget.toLowerCase());
  }
  if (matchStart < 0 || cleanTarget.length === 0) {
    return [];
  }

  const matchEnd = Math.min(normalized.length, matchStart + cleanTarget.length);
  const nodeSlices: Array<{ node: Text; startOffset: number; endOffset: number }> = [];

  for (let i = matchStart; i < matchEnd; i += 1) {
    const pos = positions[i];
    if (!pos) continue;
    const last = nodeSlices[nodeSlices.length - 1];
    if (last && last.node === pos.node) {
      last.endOffset = pos.endOffset;
    } else {
      nodeSlices.push({
        node: pos.node,
        startOffset: pos.startOffset,
        endOffset: pos.endOffset,
      });
    }
  }

  const marks: HTMLElement[] = [];
  for (const slice of nodeSlices) {
    if (!slice.node.parentNode || slice.endOffset <= slice.startOffset) continue;
    const targetNode =
      slice.startOffset > 0 ? slice.node.splitText(slice.startOffset) : slice.node;
    const len = slice.endOffset - slice.startOffset;
    if (len < targetNode.length) {
      targetNode.splitText(len);
    }

    const mark = document.createElement('mark');
    mark.setAttribute(HIGHLIGHT_ATTR, '1');
    mark.style.cssText =
      'background-color: #fde047 !important; color: #111827 !important; ' +
      'border-radius: 4px !important; padding: 1px 4px !important; ' +
      'outline: 2px solid #f59e0b !important; ' +
      'box-shadow: 0 0 14px rgba(250, 204, 21, 0.65) !important; font-style: inherit !important;';

    targetNode.parentNode?.insertBefore(mark, targetNode);
    mark.appendChild(targetNode);
    marks.push(mark);
  }

  return marks;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function createSvgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag);
}

function getAnchorRectForConnector(
  marks: HTMLElement[],
  preferBottom: boolean
): DOMRect | null {
  const visibleRects = marks
    .map((m) => m.getBoundingClientRect())
    .filter((r) => r.width > 0 || r.height > 0);
  const first = visibleRects[0];
  if (!first) return null;
  if (preferBottom) {
    return visibleRects.reduce((best, r) => (r.bottom > best.bottom ? r : best), first);
  }
  return visibleRects.reduce((best, r) => (r.top < best.top ? r : best), first);
}

function getMarksBoundingBox(marks: HTMLElement[]): {
  minLeft: number;
  minTop: number;
  maxRight: number;
  maxBottom: number;
} | null {
  let minLeft = Number.POSITIVE_INFINITY;
  let minTop = Number.POSITIVE_INFINITY;
  let maxRight = Number.NEGATIVE_INFINITY;
  let maxBottom = Number.NEGATIVE_INFINITY;

  for (const mark of marks) {
    const rect = mark.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    minLeft = Math.min(minLeft, rect.left);
    minTop = Math.min(minTop, rect.top);
    maxRight = Math.max(maxRight, rect.right);
    maxBottom = Math.max(maxBottom, rect.bottom);
  }

  if (!Number.isFinite(minTop)) return null;
  return { minLeft, minTop, maxRight, maxBottom };
}

const PAGE_QUIZ_CSS = `
  :host {
    all: initial;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  .etr-pq-connector {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 2147483644;
    overflow: visible;
  }

  .etr-pq-locate {
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.34);
    color: #fcd34d;
    height: 24px;
    padding: 0 7px;
    border-radius: 6px;
    cursor: pointer;
    font: inherit;
    font-size: 10.5px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-left: auto;
    margin-right: 4px;
    transition: background 0.12s, border-color 0.12s;
  }

  .etr-pq-locate:hover {
    background: rgba(245, 158, 11, 0.22);
    border-color: #fbbf24;
  }

  .etr-pq-card {
    position: fixed;
    z-index: 2147483645;
    width: min(388px, calc(100vw - 24px));
    background: #111117;
    color: #f4f4f6;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 12px 14px;
    box-shadow: 0 20px 44px rgba(0, 0, 0, 0.72), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 12.5px;
    line-height: 1.42;
    overflow: hidden;
  }

  .etr-pq-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: #f59e0b;
  }

  .etr-pq-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .etr-pq-badges {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }

  .etr-pq-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 10px;
    font-weight: 700;
    padding: 3px 6px;
    border-radius: 5px;
    background: rgba(245, 158, 11, 0.13);
    color: #fcd34d;
    border: 1px solid rgba(245, 158, 11, 0.32);
    letter-spacing: 0.02em;
  }

  .etr-pq-dir {
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 10px;
    font-weight: 700;
    padding: 3px 6px;
    border-radius: 5px;
    background: #1a1a23;
    color: #a1a1b2;
    border: 1px solid rgba(255, 255, 255, 0.09);
  }

  .etr-pq-close {
    background: #181821;
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: #9090a2;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }

  .etr-pq-close:hover {
    background: rgba(225, 29, 72, 0.22);
    border-color: rgba(244, 63, 94, 0.5);
    color: #ffe4e6;
  }

  .etr-pq-prompt {
    font-size: 11.5px;
    color: #9e9eb0;
  }

  .etr-pq-textarea {
    width: 100%;
    min-height: 52px;
    max-height: 130px;
    resize: vertical;
    background: #0c0c11;
    color: #f4f4f6;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 7px;
    padding: 8px 10px;
    font: inherit;
    font-size: 13px;
    line-height: 1.4;
    outline: none;
    transition: border-color 0.14s, box-shadow 0.14s;
  }

  .etr-pq-textarea:focus {
    border-color: #f59e0b;
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.18);
  }

  .etr-pq-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }

  .etr-pq-btn {
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
    transition: transform 0.08s ease, background-color 0.12s ease, opacity 0.12s ease;
  }

  .etr-pq-btn:disabled {
    opacity: 0.48;
    cursor: wait;
  }

  .etr-pq-btn-primary,
  .etr-pq-btn-next {
    background: #f59e0b;
    color: #111117;
    border-color: rgba(253, 224, 71, 0.4);
    font-weight: 800;
  }

  .etr-pq-btn-primary:hover:not(:disabled),
  .etr-pq-btn-next:hover:not(:disabled) {
    background: #fbbf24;
  }

  .etr-pq-btn-ghost {
    background: #181821;
    color: #a4a4b4;
    border-color: rgba(255, 255, 255, 0.09);
  }

  .etr-pq-btn-ghost:hover:not(:disabled) {
    background: #22222e;
    color: #f4f4f6;
    border-color: rgba(255, 255, 255, 0.18);
  }

  .etr-pq-result {
    border-radius: 8px;
    padding: 2px 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .etr-pq-verdict {
    font-weight: 800;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 6px;
    align-self: flex-start;
  }

  .etr-pq-result.ok .etr-pq-verdict {
    background: rgba(16, 185, 129, 0.13);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.32);
  }

  .etr-pq-result.bad .etr-pq-verdict {
    background: rgba(225, 29, 72, 0.14);
    color: #fb7185;
    border: 1px solid rgba(225, 29, 72, 0.34);
  }

  .etr-pq-bubble {
    border-radius: 8px;
    padding: 7px 10px;
    font-size: 12.5px;
    line-height: 1.42;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-left-width: 3px;
    background: #171720;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .etr-pq-bubble-label {
    font-size: 9.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.055em;
  }

  /* Sky/Cyan AI Evaluation — consistent across all EasyLang surfaces */
  .etr-pq-bubble-ai {
    background: rgba(14, 165, 233, 0.09);
    border-color: rgba(14, 165, 233, 0.24);
    border-left-color: #0ea5e9;
    color: #e0f2fe;
  }

  .etr-pq-bubble-ai .etr-pq-bubble-label {
    color: #38bdf8;
  }

  .etr-pq-bubble-bad {
    background: rgba(225, 29, 72, 0.09);
    border-color: rgba(225, 29, 72, 0.22);
    border-left-color: #e11d48;
    color: #ffe4e6;
  }

  .etr-pq-bubble-bad .etr-pq-bubble-label {
    color: #fb7185;
  }

  .etr-pq-bubble-good {
    background: rgba(16, 185, 129, 0.09);
    border-color: rgba(16, 185, 129, 0.24);
    border-left-color: #10b981;
    color: #ecfdf5;
    font-weight: 600;
  }

  .etr-pq-bubble-good .etr-pq-bubble-label {
    color: #34d399;
  }

  .etr-pq-bubble-ref {
    background: #16161f;
    border-color: rgba(255, 255, 255, 0.08);
    border-left-color: rgba(255, 255, 255, 0.22);
    color: #e4e4ec;
  }

  .etr-pq-bubble-ref .etr-pq-bubble-label {
    color: #8e8ea2;
  }

  .etr-pq-bubble-note {
    background: rgba(245, 158, 11, 0.08);
    border-color: rgba(245, 158, 11, 0.22);
    border-left-color: #f59e0b;
    color: #fef3c7;
    font-size: 11.5px;
  }

  .etr-pq-bubble-note .etr-pq-bubble-label {
    color: #fcd34d;
  }

  .etr-pq-loading-pill {
    position: fixed;
    top: 14px;
    right: 14px;
    z-index: 2147483647;
    background: #111117;
    color: #fcd34d;
    border: 1px solid rgba(245, 158, 11, 0.36);
    border-radius: 8px;
    padding: 7px 12px;
    font-size: 11.5px;
    font-weight: 600;
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.65);
  }
`;

function mountLoadingPill(isTr: boolean): HTMLElement {
  document.getElementById(PAGE_QUIZ_HOST_ID)?.remove();
  const host = document.createElement('div');
  host.id = PAGE_QUIZ_HOST_ID;
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = PAGE_QUIZ_CSS;
  const pill = createEl(
    'div',
    'etr-pq-loading-pill',
    isTr ? 'Challenge hazırlanıyor...' : 'Preparing page challenge...'
  );
  shadow.append(style, pill);
  (document.body ?? document.documentElement).appendChild(host);
  return host;
}

function getDirectionLabels(
  direction: PageTranslationDirection,
  isTr: boolean
): {
  dirBadge: string;
  promptText: string;
  placeholder: string;
} {
  if (direction === 'en-to-tr') {
    return {
      dirBadge: 'EN → TR',
      promptText: isTr
        ? 'Sarı işaretli İngilizce cümleyi Türkçeye çevirin:'
        : 'Translate the highlighted English sentence into Turkish:',
      placeholder: isTr ? 'Türkçe çevirisini yazın...' : 'Type the Turkish translation...',
    };
  }
  return {
    dirBadge: 'TR → EN',
    promptText: isTr
      ? 'Sarı işaretli Türkçe cümleyi İngilizceye çevirin:'
      : 'Translate the highlighted Turkish sentence into English:',
    placeholder: isTr ? 'İngilizce çevirisini yazın...' : 'Type the English translation...',
  };
}

function renderAnchoredQuizBox(
  challenge: ValidatedPageChallenge,
  marks: HTMLElement[],
  isTr: boolean
): void {
  document.getElementById(PAGE_QUIZ_HOST_ID)?.remove();

  const host = document.createElement('div');
  host.id = PAGE_QUIZ_HOST_ID;
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = PAGE_QUIZ_CSS;

  const card = createEl('div', 'etr-pq-card');
  isolateKeyboardEvents(card);

  const { dirBadge, promptText, placeholder } = getDirectionLabels(challenge.direction, isTr);

  const head = createEl('div', 'etr-pq-head');
  const badges = createEl('div', 'etr-pq-badges');
  badges.append(
    createEl('span', 'etr-pq-badge', 'Challenge'),
    createEl('span', 'etr-pq-dir', dirBadge)
  );
  const locateBtn = createEl('button', 'etr-pq-locate', isTr ? '↘ Metne Git' : '↘ Locate Text');
  locateBtn.type = 'button';
  locateBtn.title = isTr ? 'İşaretli sarı metne odaklan' : 'Scroll to highlighted sentence';
  locateBtn.addEventListener('click', () => {
    const firstMark = marks[0];
    if (firstMark) {
      firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => reposition(), 320);
    }
  });
  const closeBtn = createEl('button', 'etr-pq-close');
  closeBtn.type = 'button';
  closeBtn.title = isTr ? 'Kapat' : 'Close';
  closeBtn.setAttribute('aria-label', isTr ? 'Kapat' : 'Close');
  closeBtn.appendChild(buildCloseSvg());
  closeBtn.addEventListener('click', () => removePageHighlightQuiz());
  head.append(badges, locateBtn, closeBtn);

  const connectorSvg = createSvgEl('svg');
  connectorSvg.setAttribute('class', 'etr-pq-connector');
  const defs = createSvgEl('defs');
  const marker = createSvgEl('marker');
  marker.setAttribute('id', 'etr-pq-arrowhead');
  marker.setAttribute('viewBox', '0 0 12 12');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '6');
  marker.setAttribute('markerWidth', '9');
  marker.setAttribute('markerHeight', '9');
  marker.setAttribute('orient', 'auto-start-reverse');
  const markerPath = createSvgEl('path');
  markerPath.setAttribute('d', 'M 1 1.5 L 11 6 L 1 10.5 L 3.5 6 z');
  markerPath.setAttribute('fill', '#facc15');
  markerPath.setAttribute('stroke', '#111827');
  markerPath.setAttribute('stroke-width', '0.8');
  marker.appendChild(markerPath);
  defs.append(marker);

  const connectorShadow = createSvgEl('path');
  connectorShadow.setAttribute('fill', 'none');
  connectorShadow.setAttribute('stroke', 'rgba(11, 9, 20, 0.72)');
  connectorShadow.setAttribute('stroke-width', '6');
  connectorShadow.setAttribute('stroke-linecap', 'round');

  const connectorLine = createSvgEl('path');
  connectorLine.setAttribute('fill', 'none');
  connectorLine.setAttribute('stroke', '#facc15');
  connectorLine.setAttribute('stroke-width', '3');
  connectorLine.setAttribute('stroke-linecap', 'round');
  connectorLine.setAttribute('marker-end', 'url(#etr-pq-arrowhead)');

  const sourcePulse = createSvgEl('circle');
  sourcePulse.setAttribute('r', '9');
  sourcePulse.setAttribute('fill', 'rgba(250, 204, 21, 0.24)');
  sourcePulse.setAttribute('stroke', '#f59e0b');
  sourcePulse.setAttribute('stroke-width', '1.8');

  const sourceDot = createSvgEl('circle');
  sourceDot.setAttribute('r', '4.5');
  sourceDot.setAttribute('fill', '#fde047');
  sourceDot.setAttribute('stroke', '#111827');
  sourceDot.setAttribute('stroke-width', '1.4');

  connectorSvg.append(defs, connectorShadow, connectorLine, sourcePulse, sourceDot);

  const promptEl = createEl('div', 'etr-pq-prompt', promptText);

  const textarea = createEl('textarea', 'etr-pq-textarea');
  textarea.placeholder = placeholder;

  const submitBtn = createEl('button', 'etr-pq-btn etr-pq-btn-primary', isTr ? 'Kontrol Et' : 'Check');
  submitBtn.type = 'button';

  const skipBtn = createEl('button', 'etr-pq-btn etr-pq-btn-ghost', isTr ? 'Başka Cümle' : 'Another Sentence');
  skipBtn.type = 'button';
  skipBtn.addEventListener('click', () => {
    void launchPageHighlightQuiz();
  });

  const actionRow = createEl('div', 'etr-pq-actions');
  actionRow.append(skipBtn, submitBtn);

  const bodyContainer = createEl('div');
  bodyContainer.style.display = 'flex';
  bodyContainer.style.flexDirection = 'column';
  bodyContainer.style.gap = '8px';
  bodyContainer.append(promptEl, textarea, actionRow);

  card.append(head, bodyContainer);
  shadow.append(style, connectorSvg, card);
  const pageQuizTooltip = installWordHoverTooltip({
    root: shadow,
    delayMs: 1500,
    lookupWord: lookupOfflineWordFromBackground,
  });
  (document.body ?? document.documentElement).appendChild(host);

  const reposition = () => {
    const bounds = getMarksBoundingBox(marks);
    if (!bounds) return;

    const cardRect = card.getBoundingClientRect();
    const cardWidth = cardRect.width || 420;
    const margin = 14;
    const gap = 42;

    const spaceAbove = bounds.minTop - margin - gap;
    const spaceBelow = window.innerHeight - bounds.maxBottom - margin - gap;
    const placeAbove = spaceAbove >= cardRect.height || (spaceBelow < cardRect.height && spaceAbove >= spaceBelow);

    if (placeAbove && spaceAbove >= 160) {
      card.style.maxHeight = `${Math.max(160, Math.round(spaceAbove))}px`;
      card.style.overflowY = 'auto';
    } else if (!placeAbove && spaceBelow >= 160) {
      card.style.maxHeight = `${Math.max(160, Math.round(spaceBelow))}px`;
      card.style.overflowY = 'auto';
    } else {
      card.style.maxHeight = `${Math.max(180, window.innerHeight - margin * 2)}px`;
      card.style.overflowY = 'auto';
    }

    const updatedRect = card.getBoundingClientRect();
    const cardHeight = updatedRect.height || 185;

    const anchorCenterX = (bounds.minLeft + bounds.maxRight) / 2;
    const left = Math.max(
      margin,
      Math.min(window.innerWidth - cardWidth - margin, anchorCenterX - cardWidth / 2)
    );

    const rawTop = placeAbove ? bounds.minTop - cardHeight - gap : bounds.maxBottom + gap;

    const finalLeft = Math.round(left);
    const finalTop = Math.round(
      Math.max(margin, Math.min(window.innerHeight - cardHeight - margin, rawTop))
    );

    card.style.left = `${finalLeft}px`;
    card.style.top = `${finalTop}px`;

    // Draw connector arrow directly from the yellow highlight to the quiz box edge.
    const cardBottom = finalTop + cardHeight;
    const cardIsAbove = cardBottom <= bounds.minTop;
    const anchorRect = getAnchorRectForConnector(marks, !cardIsAbove);
    if (!anchorRect) {
      connectorSvg.style.display = 'none';
      return;
    }

    connectorSvg.style.display = 'block';
    const sx = Math.round((anchorRect.left + anchorRect.right) / 2);
    const sy = Math.round(cardIsAbove ? anchorRect.top - 7 : anchorRect.bottom + 7);
    const ex = Math.round(
      Math.max(finalLeft + 26, Math.min(finalLeft + cardWidth - 26, sx))
    );
    const ey = Math.round(
      cardIsAbove
        ? cardBottom + 5
        : finalTop >= anchorRect.bottom
          ? finalTop - 5
          : Math.max(finalTop + 12, Math.min(cardBottom - 12, sy))
    );

    const dy = Math.abs(sy - ey);
    const curveOffset = Math.max(20, dy * 0.45);
    const c1y = Math.round(cardIsAbove ? sy - curveOffset : sy + curveOffset);
    const c2y = Math.round(cardIsAbove ? ey + curveOffset : ey - curveOffset);
    const d = `M ${sx} ${sy} C ${sx} ${c1y}, ${ex} ${c2y}, ${ex} ${ey}`;

    connectorShadow.setAttribute('d', d);
    connectorLine.setAttribute('d', d);
    sourcePulse.setAttribute('cx', String(sx));
    sourcePulse.setAttribute('cy', String(sy));
    sourceDot.setAttribute('cx', String(sx));
    sourceDot.setAttribute('cy', String(sy));
  };

  const escapeHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      removePageHighlightQuiz();
    }
  };

  card.addEventListener('keydown', escapeHandler);
  window.addEventListener('scroll', reposition, { passive: true });
  window.addEventListener('resize', reposition, { passive: true });
  window.addEventListener('keydown', escapeHandler);

  activeCleanup = () => {
    pageQuizTooltip.dispose();
    card.removeEventListener('keydown', escapeHandler);
    window.removeEventListener('scroll', reposition);
    window.removeEventListener('resize', reposition);
    window.removeEventListener('keydown', escapeHandler);
  };

  reposition();
  requestAnimationFrame(() => {
    reposition();
    textarea.focus({ preventScroll: true });
  });

  const handleSubmit = async () => {
    const userAnswer = textarea.value.trim();
    if (!userAnswer) {
      textarea.focus();
      return;
    }

    submitBtn.disabled = true;
    skipBtn.disabled = true;
    submitBtn.textContent = isTr ? 'Kontrol ediliyor...' : 'Checking...';

    try {
      const response = await sendBgMessage<{
        ok: boolean;
        result?: PageAnswerEvaluation;
        error?: string;
      }>({
        type: 'EVALUATE_PAGE_TRANSLATION',
        direction: challenge.direction,
        sourceSentence: challenge.sentence,
        referenceTranslation: challenge.referenceTranslation,
        userAnswer,
      });

      if (!response?.ok || !response.result) {
        submitBtn.disabled = false;
        skipBtn.disabled = false;
        submitBtn.textContent = isTr ? 'Kontrol Et' : 'Check';
        renderToast(response?.error ?? (isTr ? 'AI kontrolü başarısız oldu.' : 'AI check failed.'));
        return;
      }

      const evaluation = response.result;
      void sendBgMessage({
        type: 'RECORD_PAGE_QUIZ_RESULT',
        isCorrect: evaluation.isCorrect,
      }).catch(() => {});
      bodyContainer.replaceChildren();

      const resultBox = createEl(
        'div',
        `etr-pq-result ${evaluation.isCorrect ? 'ok' : 'bad'}`
      );
      const verdict = createEl(
        'div',
        'etr-pq-verdict',
        evaluation.isCorrect
          ? isTr
            ? '✓ Doğru çeviri · +5 XP'
            : '✓ Accurate translation · +5 XP'
          : isTr
            ? '✕ Geliştirilebilir çeviri'
            : '✕ Needs improvement'
      );

      const userBubble = createEl(
        'div',
        `etr-pq-bubble ${evaluation.isCorrect ? 'etr-pq-bubble-good' : 'etr-pq-bubble-bad'}`
      );
      const userTextEl = createEl('div', undefined, userAnswer);
      userTextEl.dataset.wordLang = challenge.direction === 'tr-to-en' ? 'en' : 'tr';
      userBubble.append(
        createEl(
          'span',
          'etr-pq-bubble-label',
          evaluation.isCorrect
            ? isTr
              ? '✓ SENİN CEVABIN'
              : '✓ YOUR ANSWER'
            : isTr
              ? '✕ SENİN CEVABIN'
              : '✕ YOUR ANSWER'
        ),
        userTextEl
      );

      const refBubble = createEl(
        'div',
        evaluation.isCorrect
          ? 'etr-pq-bubble etr-pq-bubble-ref'
          : 'etr-pq-bubble etr-pq-bubble-good'
      );
      const refTextEl = createEl('div', undefined, evaluation.referenceTranslation);
      refTextEl.dataset.wordLang = challenge.direction === 'tr-to-en' ? 'en' : 'tr';
      refBubble.append(
        createEl(
          'span',
          'etr-pq-bubble-label',
          evaluation.isCorrect
            ? isTr
              ? 'ÖRNEK ÇEVİRİ'
              : 'REFERENCE TRANSLATION'
            : isTr
              ? '✓ DOĞRU ANLAM / ÖRNEK ÇEVİRİ'
              : '✓ REFERENCE TRANSLATION'
        ),
        refTextEl
      );

      const aiBubble = createEl('div', 'etr-pq-bubble etr-pq-bubble-ai');
      aiBubble.append(
        createEl('span', 'etr-pq-bubble-label', isTr ? 'AI DEĞERLENDİRMESİ' : 'AI FEEDBACK'),
        createEl('div', undefined, evaluation.feedback)
      );

      resultBox.append(verdict, userBubble, refBubble, aiBubble);

      if (challenge.notes) {
        const noteBubble = createEl('div', 'etr-pq-bubble etr-pq-bubble-note');
        noteBubble.append(
          createEl('span', 'etr-pq-bubble-label', isTr ? 'İPUCU' : 'HINT'),
          createEl('div', undefined, challenge.notes)
        );
        resultBox.append(noteBubble);
      }

      const nextRow = createEl('div', 'etr-pq-actions');
      const doneBtn = createEl('button', 'etr-pq-btn etr-pq-btn-ghost', isTr ? 'Kapat' : 'Close');
      doneBtn.type = 'button';
      doneBtn.addEventListener('click', () => removePageHighlightQuiz());

      const nextBtn = createEl('button', 'etr-pq-btn etr-pq-btn-next', isTr ? 'Sonraki →' : 'Next →');
      nextBtn.type = 'button';
      nextBtn.addEventListener('click', () => {
        void launchPageHighlightQuiz();
      });

      nextRow.append(doneBtn, nextBtn);
      bodyContainer.append(resultBox, nextRow);
      reposition();
      nextBtn.focus({ preventScroll: true });
    } catch (error) {
      submitBtn.disabled = false;
      skipBtn.disabled = false;
      submitBtn.textContent = isTr ? 'Kontrol Et' : 'Check';
      const msg = error instanceof Error ? error.message : String(error);
      renderToast(isTr ? `Hata: ${msg}` : `Error: ${msg}`);
    }
  };

  submitBtn.addEventListener('click', () => {
    void handleSubmit();
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  });
}

/**
 * Runs the script-based page sentence scan, validates candidates with AI (up to 3 at a time),
 * highlights the verified sentence in yellow, and renders the floating translation box above it.
 */
export async function launchPageHighlightQuiz(): Promise<void> {
  removePageHighlightQuiz();
  const token = currentRequestToken;

  const blocks = collectReadablePageBlocks();
  if (blocks.length === 0) {
    renderToast('No readable text blocks found on this page.');
    return;
  }

  const settings = await getSettings();
  const isTr = resolveSupportedLanguage(settings.uiLanguage ?? 'auto') === 'tr';

  const persistedAsked = await getAskedPageSentences();
  if (token !== currentRequestToken) return;

  const combinedExcluded = new Set<string>([
    ...persistedAsked,
    ...sessionExcludedSentences,
  ]);

  let extraction = selectPageSentenceCandidates(blocks, combinedExcluded, 12, {
    diversify: true,
  });

  if (extraction.candidates.length === 0 && combinedExcluded.size > 0) {
    // Check if unexcluded sentences exist on this page; if so, cycle only this page's history.
    const allPageCandidates = selectPageSentenceCandidates(blocks, new Set(), 60, {
      diversify: true,
    });
    if (allPageCandidates.candidates.length > 0) {
      const pageKeys = allPageCandidates.candidates.map((c) => normalizePageSentenceKey(c.text));
      for (const k of pageKeys) {
        sessionExcludedSentences.delete(k);
      }
      await clearAskedPageSentencesSubset(pageKeys);
      if (token !== currentRequestToken) return;
      renderToast(
        isTr
          ? 'Bu sayfadaki tüm cümleler soruldu — yeni tur başlatılıyor.'
          : 'All sentences on this page were quizzed once — cycling fresh sentences.'
      );
      extraction = allPageCandidates;
    }
  }

  if (extraction.candidates.length === 0) {
    renderToast(
      isTr
        ? 'Bu sayfada çeviriye uygun tam Türkçe veya İngilizce cümle bulunamadı.'
        : 'No suitable complete Turkish or English sentences were found on this page.'
    );
    return;
  }

  mountLoadingPill(isTr);

  let verifiedChallenge: ValidatedPageChallenge | null = null;
  let lastError: string | undefined;

  // Send at most 2 small batches (3 sentences each) so token usage remains minimal.
  for (let offset = 0; offset < Math.min(6, extraction.candidates.length); offset += 3) {
    if (token !== currentRequestToken) return;
    const batch = extraction.candidates.slice(offset, offset + 3).map((c) => ({
      id: c.id,
      blockIndex: c.blockIndex,
      text: c.text,
    }));

    try {
      const response = await sendBgMessage<{
        ok: boolean;
        challenge?: ValidatedPageChallenge | null;
        error?: string;
      }>({
        type: 'VALIDATE_PAGE_SENTENCES',
        direction: extraction.direction,
        candidates: batch,
      });

      if (token !== currentRequestToken) return;

      if (!response?.ok) {
        lastError = response?.error ?? 'AI sentence validation failed.';
        break;
      }

      if (response.challenge) {
        verifiedChallenge = response.challenge;
        break;
      }

      // Persist AI-rejected candidates so they are never sent to AI again on future runs.
      for (const item of batch) {
        sessionExcludedSentences.add(normalizePageSentenceKey(item.text));
        await markPageSentenceAsked(item.text);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      break;
    }
  }

  if (token !== currentRequestToken) return;
  document.getElementById(PAGE_QUIZ_HOST_ID)?.remove();

  if (!verifiedChallenge) {
    renderToast(
      lastError ?? 'Could not find a meaningful translatable sentence on this page.'
    );
    return;
  }

  const matchedBlock = blocks.find((b) => b.blockIndex === verifiedChallenge.blockIndex);
  if (!matchedBlock) {
    renderToast('Selected sentence block is no longer available on the page.');
    return;
  }

  const marks = highlightSentenceInElement(matchedBlock.element, verifiedChallenge.sentence);
  if (marks.length === 0) {
    sessionExcludedSentences.add(normalizePageSentenceKey(verifiedChallenge.sentence));
    renderToast('Could not highlight that sentence in the page DOM. Try again.');
    return;
  }

  sessionExcludedSentences.add(normalizePageSentenceKey(verifiedChallenge.sentence));
  await markPageSentenceAsked(verifiedChallenge.sentence);
  if (token !== currentRequestToken) {
    clearPageHighlights();
    return;
  }

  const initialBounds = getMarksBoundingBox(marks);
  const firstMark = marks[0];
  if (
    firstMark &&
    initialBounds &&
    (initialBounds.minTop < 170 || initialBounds.maxBottom > window.innerHeight - 60)
  ) {
    firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      if (token === currentRequestToken) {
        renderAnchoredQuizBox(verifiedChallenge, marks, isTr);
      }
    }, 320);
    return;
  }

  renderAnchoredQuizBox(verifiedChallenge, marks, isTr);
}
