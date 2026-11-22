import { resolveSupportedLanguage } from '../shared/i18n';
import { playCorrectSfx, playWrongSfx } from '../shared/sfx';
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

const PAGE_QUIZ_CSS_DARK = `
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
    background: #ffffff;
    color: #1d4ed8;
    border: 2px solid #93c5fd;
    border-bottom: 3px solid #2563eb;
    border-radius: 12px;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 800;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.16);
  }
  .etr-pq-card {
    background-image:
      radial-gradient(circle at 82% 14%, rgba(245, 158, 11, 0.05), transparent 56%),
      url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320' viewBox='0 0 320 320' fill='none' stroke='%23cbd5e1' stroke-opacity='0.085' stroke-width='1.35' stroke-linecap='round' stroke-linejoin='round'><g transform='translate(28,18)'><path d='M24 2 L24 9 M21 9 L27 9 M22 9 C21 24 16 40 7 58 M26 9 C27 24 32 40 41 58 M14 34 L34 34 M10 46 L38 46 M16 58 A8 8 0 0 1 32 58 M4 58 L44 58'/></g><g transform='translate(124,34)'><path d='M4 18 L34 6 L22 28 L17 20 Z M34 6 L17 20'/><path d='M-12 28 Q-4 26 2 22' stroke-dasharray='2.5 4'/></g><g transform='translate(226,14)'><path d='M12 6 L12 18 M9 10 C12 4 15 10 12 12 M12 18 L19 25 M23 19 A4.5 4.5 0 1 0 32 19 M23 15 L19 11 M26 14 L25 9 M29 14 L30 9 M32 15 L36 11 M21 25 L34 25 L37 56 L18 56 Z M24 25 L23 56 M31 25 L32 56 M14 56 L41 56 M12 62 L43 62'/></g><g transform='translate(46,128)'><circle cx='20' cy='20' r='16'/><path d='M20 7 L23 17 L33 20 L23 23 L20 33 L17 23 L7 20 L17 17 Z'/></g><g transform='translate(142,118)'><path d='M18 4 L12 18 L24 18 Z M11 18 L25 18 L25 34 L11 34 Z M13 34 L13 64 M23 34 L23 64 M9 64 L27 64'/><circle cx='18' cy='26' r='4.5'/><path d='M18 26 L18 23.5 M18 26 L20.2 26'/></g><g transform='translate(248,128)'><path d='M8 18 L28 18 L26 32 C25 36 11 36 10 32 Z M28 21 L32 21 C34 21 34 28 31 28 L27 28 M6 38 L30 38 M14 13 C13 10 16 9 15 6 M21 13 C20 10 23 9 22 6'/></g><g transform='translate(28,224)'><path d='M4 12 C12 9 20 11 24 16 C28 11 36 9 44 12 L44 36 C36 33 28 35 24 40 C20 35 12 33 4 36 Z M24 16 L24 40 M10 18 L18 19 M10 24 L18 25 M30 19 L38 18 M30 25 L38 24'/></g><g transform='translate(136,226)'><circle cx='22' cy='22' r='17'/><ellipse cx='22' cy='22' rx='8' ry='17'/><path d='M6 16 L38 16 M6 28 L38 28 M22 5 L22 39'/></g><g transform='translate(232,230)'><path d='M4 34 L50 34 M12 34 L12 10 L16 6 L20 10 L20 34 M34 34 L34 10 L38 6 L42 10 L42 34 M20 16 L34 16 M4 26 Q12 18 12 18 M42 18 Q50 26 50 26 M20 34 A7 7 0 0 1 34 34'/></g></svg>");
    background-size: 100% 100%, 320px 320px;
    background-attachment: local, local;
  }
`;

const PAGE_QUIZ_CSS_LIGHT = `/* Ice White & Modern Cobalt Tactile 3D Override */
  .etr-pq-card {
    background-color: #fcf8ec;
    background-image:
      radial-gradient(circle at 82% 14%, rgba(199, 130, 20, 0.04), transparent 56%),
      url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320' viewBox='0 0 320 320' fill='none' stroke='%239a6b24' stroke-opacity='0.115' stroke-width='1.35' stroke-linecap='round' stroke-linejoin='round'><g transform='translate(28,18)'><path d='M24 2 L24 9 M21 9 L27 9 M22 9 C21 24 16 40 7 58 M26 9 C27 24 32 40 41 58 M14 34 L34 34 M10 46 L38 46 M16 58 A8 8 0 0 1 32 58 M4 58 L44 58'/></g><g transform='translate(124,34)'><path d='M4 18 L34 6 L22 28 L17 20 Z M34 6 L17 20'/><path d='M-12 28 Q-4 26 2 22' stroke-dasharray='2.5 4'/></g><g transform='translate(226,14)'><path d='M12 6 L12 18 M9 10 C12 4 15 10 12 12 M12 18 L19 25 M23 19 A4.5 4.5 0 1 0 32 19 M23 15 L19 11 M26 14 L25 9 M29 14 L30 9 M32 15 L36 11 M21 25 L34 25 L37 56 L18 56 Z M24 25 L23 56 M31 25 L32 56 M14 56 L41 56 M12 62 L43 62'/></g><g transform='translate(46,128)'><circle cx='20' cy='20' r='16'/><path d='M20 7 L23 17 L33 20 L23 23 L20 33 L17 23 L7 20 L17 17 Z'/></g><g transform='translate(142,118)'><path d='M18 4 L12 18 L24 18 Z M11 18 L25 18 L25 34 L11 34 Z M13 34 L13 64 M23 34 L23 64 M9 64 L27 64'/><circle cx='18' cy='26' r='4.5'/><path d='M18 26 L18 23.5 M18 26 L20.2 26'/></g><g transform='translate(248,128)'><path d='M8 18 L28 18 L26 32 C25 36 11 36 10 32 Z M28 21 L32 21 C34 21 34 28 31 28 L27 28 M6 38 L30 38 M14 13 C13 10 16 9 15 6 M21 13 C20 10 23 9 22 6'/></g><g transform='translate(28,224)'><path d='M4 12 C12 9 20 11 24 16 C28 11 36 9 44 12 L44 36 C36 33 28 35 24 40 C20 35 12 33 4 36 Z M24 16 L24 40 M10 18 L18 19 M10 24 L18 25 M30 19 L38 18 M30 25 L38 24'/></g><g transform='translate(136,226)'><circle cx='22' cy='22' r='17'/><ellipse cx='22' cy='22' rx='8' ry='17'/><path d='M6 16 L38 16 M6 28 L38 28 M22 5 L22 39'/></g><g transform='translate(232,230)'><path d='M4 34 L50 34 M12 34 L12 10 L16 6 L20 10 L20 34 M34 34 L34 10 L38 6 L42 10 L42 34 M20 16 L34 16 M4 26 Q12 18 12 18 M42 18 Q50 26 50 26 M20 34 A7 7 0 0 1 34 34'/></g></svg>");
    background-size: 100% 100%, 320px 320px;
    background-attachment: local, local;
    color: #1f1a12;
    border: 2px solid #e8ddc0;
    border-bottom: 4px solid #d5c08d;
    border-radius: 18px;
    box-shadow: 0 20px 48px rgba(41, 30, 12, 0.18);
  }
  .etr-pq-head {
    background: #faf5e6;
    border-bottom: 2px solid #e8ddc0;
  }
  .etr-pq-badge {
    background: #fef7de;
    border: 1.5px solid #ebd08b;
    color: #7d4b05;
  }
  .etr-pq-close {
    background: #fffdf7;
    border: 2px solid #e8ddc0;
    color: #544938;
  }
  .etr-pq-quote {
    background: #faf5e6;
    border: 2px solid #e8ddc0;
    border-left: 4px solid #a8680a;
    color: #1f1a12;
  }
  .etr-pq-textarea {
    background: #faf5e6;
    color: #1f1a12;
    border: 2px solid #d5c08d;
    border-radius: 12px;
  }
  .etr-pq-textarea:focus {
    background: #fffdf7;
    border-color: #a8680a;
    box-shadow: 0 0 0 3px rgba(199, 130, 20, 0.14);
  }
  .etr-pq-btn {
    background: #fffdf7;
    border: 2px solid #e8ddc0;
    border-bottom: 3px solid #d5c08d;
    color: #3d3427;
    border-radius: 10px;
    font-weight: 800;
  }
  .etr-pq-btn-primary {
    background: #a8680a;
    border-color: #a8680a;
    border-bottom-color: #7d4b05;
    color: #ffffff;
  }
  .etr-pq-result.ok .etr-pq-verdict {
    color: #15803d;
  }
  .etr-pq-result.bad .etr-pq-verdict {
    color: #be123c;
  }
  .etr-pq-bubble-good {
    background: #dcfce7;
    border-color: #86efac;
    border-left-color: #16a34a;
    color: #14532d;
  }
  .etr-pq-bubble-good .etr-pq-bubble-label {
    color: #15803d;
  }
  .etr-pq-bubble-bad {
    background: #ffe4e6;
    border-color: #fda4af;
    border-left-color: #e11d48;
    color: #881337;
  }
  .etr-pq-bubble-bad .etr-pq-bubble-label {
    color: #be123c;
  }
  .etr-pq-bubble-ref {
    background: #faf5e6;
    border-color: #e8ddc0;
    border-left-color: #bfa673;
    color: #1f1a12;
  }
  .etr-pq-bubble-ref .etr-pq-bubble-label {
    color: #544938;
  }
  .etr-pq-bubble-ai {
    background: #fef7de;
    border-color: #ebd08b;
    border-left-color: #a8680a;
    color: #714209;
  }
  .etr-pq-bubble-ai .etr-pq-bubble-label {
    color: #7d4b05;
  }
  .etr-pq-bubble-note {
    background: #fef3c7;
    border-color: #fcd34d;
    border-left-color: #f59e0b;
    color: #78350f;
  }
  .etr-pq-bubble-note .etr-pq-bubble-label {
    color: #b45309;
  }`;

function getPageQuizCss(themeMode: 'light' | 'dark'): string {
  return themeMode === 'dark' ? PAGE_QUIZ_CSS_DARK : `${PAGE_QUIZ_CSS_DARK}\n${PAGE_QUIZ_CSS_LIGHT}`;
}

function mountLoadingPill(isTr: boolean, themeMode: 'light' | 'dark'): HTMLElement {
  document.getElementById(PAGE_QUIZ_HOST_ID)?.remove();
  const host = document.createElement('div');
  host.id = PAGE_QUIZ_HOST_ID;
  host.dataset.theme = themeMode;
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = getPageQuizCss(themeMode);
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
  isTr: boolean,
  themeMode: 'light' | 'dark'
): void {
  document.getElementById(PAGE_QUIZ_HOST_ID)?.remove();

  const host = document.createElement('div');
  host.id = PAGE_QUIZ_HOST_ID;
  host.dataset.theme = themeMode;
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = getPageQuizCss(themeMode);

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
      if (evaluation.isCorrect) {
        playCorrectSfx();
      } else {
        playWrongSfx();
      }
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
  const themeMode: 'light' | 'dark' = settings.themeMode === 'dark' ? 'dark' : 'light';

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

  mountLoadingPill(isTr, themeMode);

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
        renderAnchoredQuizBox(verifiedChallenge, marks, isTr, themeMode);
      }
    }, 320);
    return;
  }

  renderAnchoredQuizBox(verifiedChallenge, marks, isTr, themeMode);
}
