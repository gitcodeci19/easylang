import type { OfflineWordEntry } from './offlineDictionary.ts';
import { DEFAULT_ENGLISH_TTS_RATE, speakEnglishText } from './speech.ts';
import { uiIconSvg } from './uiIcons.ts';

export interface WordHoverTooltipOptions {
  /** Target Document (popup/options) or ShadowRoot (content-script overlay). */
  root: Document | ShadowRoot;
  /** Offline dictionary resolver; may be synchronous or async (e.g. background IPC). */
  lookupWord: (word: string) => OfflineWordEntry | null | Promise<OfflineWordEntry | null>;
  /** Hover dwell duration in milliseconds before showing the tooltip (default 1500ms). */
  delayMs?: number;
}

export interface WordHoverTooltipController {
  hide: () => void;
  dispose: () => void;
}

interface WordHit {
  key: string;
  word: string;
  subWord?: string;
  rect: DOMRect;
  element: Element;
  textNode: Text;
  startOffset: number;
  endOffset: number;
}

const STYLE_ATTR = 'data-el-word-tip-style';
const TOOLTIP_CLASS = 'el-word-tip';
const PROBE_CLASS = 'el-word-probe';
const HIGHLIGHT_DELAY_MS = 300;
const DEFAULT_DWELL_MS = 1500;
const HIDE_GRACE_MS = 180;
const RECT_TOLERANCE_PX = 2.5;

const TURKISH_CHAR_RE = /[çğıİöşüâîûÇĞÖŞÜÂÎÛ]/;
const ENGLISH_WORD_RE = /^[a-zA-Z]+(?:['-][a-zA-Z]+)*$/;
const WORD_SCAN_RE = /[A-Za-zÀ-ÖØ-öø-ÿçğıİöşüâîûÇĞÖŞÜÂÎÛ]+(?:[’‘'-][A-Za-zÀ-ÖØ-öø-ÿçğıİöşüâîûÇĞÖŞÜÂÎÛ]+)*/g;

/**
 * UI chrome and strictly Turkish-only containers where English hover tooltips
 * must never appear.
 */
const EXCLUDED_SELECTOR = [
  `.${TOOLTIP_CLASS}`,
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '.top-bar',
  '.quick-actions',
  '.duo-mode-tabs',
  '.duo-map-hud',
  '.duo-lesson-topbar',
  '.duo-lesson-footer',
  '.duo-ex-badge',
  '.duo-ex-instruction',
  '.rem-spot-stepper',
  '.rem-scenario-box',
  '.rem-proofread-meaning',
  '.duo-ex-prompt-sub.is-meaning-cue',
  '.rem-prompt-sub-plain.is-meaning-cue',
  '.rem-ex-tr',
  '.duo-guide-tr',
  '.etr-header',
  '.etr-footer',
  '.etr-actions',
  '.etr-lq-head',
  '.etr-lq-actions',
  '.etr-pq-head',
  '.etr-pq-actions',
  '.tabs',
  '.el-help-trigger',
  '.duo-audio-mini-btn',
  '.duo-audio-big-btn',
  '.duo-audio-slow-btn',
  '.ai-voice-header',
  '.ai-voice-trigger',
  '.ai-voice-controls',
  '.tm-audio-bar',
  '.tm-header',
  '.tm-picker-section',
].join(', ');

/**
 * High-frequency ASCII-only Turkish words that distinguish Turkish prose from English
 * even when no Turkish diacritics appear in a short phrase.
 */
const TURKISH_ASCII_WORDS = new Set([
  'bir', 've', 'ile', 'bu', 'ben', 'sen', 'biz', 'siz', 'ama', 'fakat', 'veya',
  'ancak', 'kadar', 'gibi', 'daha', 'olan', 'olarak', 'neden', 'nasil', 'nerede',
  'zaman', 'kural', 'durum', 'soru', 'cevap', 'anlam', 'kelime', 'cumle', 'metni',
  'dinle', 'devam', 'kontrol', 'tekrar', 'harika', 'yanlis', 'dogru', 'ipucu',
  'hemen', 'simdi', 'bugun', 'yarin', 'burada', 'orada', 'sadece', 'hem', 'bile',
  'tane', 'yeni', 'eski', 'kolay', 'zor', 'ozel', 'ders', 'harita', 'ayarlar',
  'analiz', 'kartlar', 'ekle', 'sil', 'kapat', 'iptal', 'kaydet', 'temizle',
  'sifirla', 'filtre', 'seviye', 'puan', 'seri', 'hedef', 'tamam', 'evet', 'hayir',
  'lutfen', 'merhaba', 'selam', 'var', 'yok', 'icin', 'once', 'sonra', 'karsi',
  'yerine', 'hangisi', 'gelmeli', 'degil', 'olur', 'oldu', 'etmek', 'yapmak',
  'kullan', 'sec', 'yaz', 'gor', 'gizle', 'bak', 'sor', 'al', 'ver', 'kendi',
  'hepsi', 'biri', 'kimi', 'hangi', 'kac', 'cok', 'az', 'en', 'pek', 'hep',
  'hala', 'yine', 'tekrar', 'baska', 'ayni', 'farkli', 'buyuk', 'kucuk', 'iyi',
  'kotu', 'guzel', 'onemli', 'gerekli', 'uygun', 'dogal', 'hizli', 'yavas',
]);

/**
 * Short English/Turkish homographs that appear frequently in Turkish UI/sentences
 * (e.g. "her gün", "son soru", "on dakika", "can dost", "at", "in", "an").
 * Outside explicitly tagged `[data-word-lang="en"]` surfaces or English quotes,
 * these require clear English neighboring words to trigger.
 */
const EN_TR_HOMOGRAPHS = new Set([
  'her', 'son', 'on', 'in', 'an', 'at', 'can', 'top', 'bin', 'bar', 'ben',
  'var', 'kar', 'yol', 'hat', 'kap', 'kat', 'kol', 'mal', 'pas', 'pay', 'ray',
  'sap', 'soy', 'tel', 'ten', 'tur', 'yan', 'yer', 'zam', 'zar', 'zor', 'bit',
  'set', 'not', 'net', 'mat', 'mod', 'ton', 'rol', 'gol', 'tip', 'bot', 'kot',
  'kod', 'pil', 'hal', 'ham', 'han', 'hap', 'has', 'hey', 'hiz', 'ip', 'it',
  'iz', 'kek', 'kel', 'kin', 'kip', 'kit', 'kiz', 'kor', 'koy', 'koz', 'kul',
  'kum', 'kup', 'kur', 'kus', 'kut', 'tek', 'tam', 'bol', 'dar', 'mor', 'gri',
  'al', 'ol', 'et', 'el', 'ev', 'ay', 'ac', 'ak', 'as', 'az', 'ek', 'en', 'er',
  'es', 'is', 'ok', 'ot', 'oy', 'oz', 'un', 'us', 'uz', 'far', 'fan', 'fin',
  'fon', 'gar', 'gaz', 'gem', 'gen', 'got', 'gum', 'gun', 'gut', 'pan', 'par',
  'pat', 'pen', 'per', 'pet', 'pin', 'pit', 'pop', 'pot', 'pub', 'ram', 'rap',
  'rat', 'red', 'rem', 'rep', 'rib', 'rid', 'rig', 'rim', 'rip', 'rob', 'rod',
  'rot', 'row', 'rub', 'rug', 'rum', 'run', 'rut', 'sad', 'sag', 'sal', 'sam',
  'san', 'sat', 'say', 'sea', 'sec', 'see', 'sew', 'sin', 'sip', 'sir', 'sis',
  'sit', 'six', 'ski', 'sky', 'sob', 'sod', 'sow', 'soy', 'spa', 'spy', 'sub',
  'sum', 'sun', 'sup', 'tab', 'tag', 'tan', 'tap', 'tar', 'tat', 'tax', 'tea',
  'ted', 'tee', 'tie', 'tin', 'toe', 'tom', 'too', 'tot', 'tow', 'toy', 'try',
  'tub', 'tug', 'two', 'urn', 'use', 'van', 'vat', 'vet', 'vex', 'via', 'vie',
  'vow', 'wad', 'wag', 'wan', 'war', 'was', 'wax', 'way', 'web', 'wed', 'wee',
  'wet', 'who', 'why', 'wig', 'win', 'wit', 'woe', 'wok', 'won', 'woo', 'wow',
  'wry', 'yak', 'yam', 'yap', 'yaw', 'yea', 'yen', 'yep', 'yes', 'yet', 'yew',
  'yin', 'yip', 'yon', 'you', 'yow', 'zag', 'zap', 'zed', 'zee', 'zen', 'zig',
  'zip', 'zit', 'zoo', 'bal', 'bay', 'baz', 'bel', 'bet', 'bey', 'bez', 'bil',
  'bir', 'biz', 'bos', 'boy', 'buz', 'cam', 'cep', 'cop', 'dal', 'dam', 'dan',
  'dem', 'den', 'dev', 'dik', 'dil', 'din', 'dip', 'diz', 'dun', 'dus', 'dut',
  'duz', 'ebe', 'ece', 'eda', 'efe', 'ege', 'fil', 'hak', 'kal', 'kan', 'kas',
  'kaz', 'kez', 'kim', 'kir', 'koc', 'kok', 'kop', 'kos', 'lam', 'lav', 'laz',
  'leb', 'lif', 'lik', 'lim', 'log', 'lop', 'lor', 'los', 'lot', 'luk', 'mac',
  'maf', 'mah', 'mak', 'man', 'mar', 'mas', 'may', 'men', 'met', 'mey', 'mil',
  'mim', 'mir', 'mis', 'mit', 'mol', 'mom', 'mum', 'muz', 'nal', 'nam', 'nar',
  'nas', 'nay', 'naz', 'nem', 'ney', 'nil', 'nim', 'oda', 'oje', 'ole', 'oma',
  'ora', 'org', 'ork', 'ors', 'oya', 'pak', 'pal', 'pek', 'pes', 'pey', 'pik',
  'pir', 'pis', 'pit', 'plaj', 'plan', 'poz', 'pul', 'pus', 'put', 'rab', 'raf',
  'rak', 'ran', 'raz', 'ren', 'rey', 'rez', 'rik', 'ris', 'riz', 'rom', 'ruh',
  'ruj', 'ruk', 'rum', 'rus', 'ruz', 'sac', 'saf', 'sag', 'sah', 'sak', 'sal',
  'sam', 'san', 'sar', 'sat', 'sav', 'say', 'saz', 'sec', 'sed', 'sef', 'sek',
  'sel', 'sem', 'sen', 'ser', 'ses', 'sev', 'sey', 'sih', 'sik', 'sil', 'sim',
  'sir', 'sis', 'sok', 'sol', 'som', 'sor', 'sos', 'soz', 'suc', 'sur', 'sus',
  'sut', 'tac', 'tag', 'tah', 'tak', 'tal', 'tan', 'tap', 'tar', 'tas', 'tat',
  'tav', 'tay', 'taz', 'tef', 'tek', 'tem', 'ter', 'tes', 'tez', 'tik', 'til',
  'tim', 'tir', 'tis', 'tok', 'tol', 'top', 'tor', 'tos', 'toz', 'tuf', 'tul',
  'tum', 'tun', 'tup', 'tus', 'tut', 'tuz', 'ucu', 'ufa', 'ulu', 'uma', 'ura',
  'ust', 'uta', 'uyu', 'uza', 'vad', 'vah', 'vak', 'val', 'van', 'vay', 'vaz',
  'veh', 'vel', 'ver', 'vey', 'viz', 'vuk', 'vur', 'yad', 'yag', 'yah', 'yak',
  'yal', 'yam', 'yap', 'yar', 'yas', 'yat', 'yay', 'yaz', 'yed', 'yek', 'yel',
  'yem', 'yen', 'yes', 'yet', 'yik', 'yil', 'yok', 'yom', 'yon', 'yos', 'yoz',
  'yuk', 'yun', 'yur', 'yut', 'yuz', 'zak', 'zal', 'zan', 'zat', 'zay', 'zek',
  'zem', 'zen', 'zer', 'zev', 'zik', 'zil', 'zir', 'zit', 'ziy', 'zok', 'zon',
  'zop', 'zuh', 'zul', 'zum', 'zur',
]);

const CLEAR_ENGLISH_CONTEXT_WORDS = new Set([
  'the', 'is', 'are', 'was', 'were', 'am', 'be', 'been', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'should', 'could', 'might', 'must',
  'cannot', 'this', 'that', 'these', 'those', 'with', 'from', 'about', 'into',
  'over', 'under', 'after', 'before', 'between', 'through', 'during', 'without',
  'because', 'while', 'where', 'when', 'which', 'what', 'whose', 'whom', 'they',
  'them', 'their', 'she', 'he', 'him', 'his', 'we', 'our', 'you', 'your', 'my',
  'me', 'it', 'its', 'not', 'very', 'just', 'always', 'never', 'often', 'usually',
  'really', 'already', 'still', 'again', 'here', 'there', 'today', 'yesterday',
  'tomorrow', 'every', 'some', 'many', 'much', 'more', 'most', 'other', 'another',
  'going', 'want', 'need', 'like', 'know', 'think', 'make', 'take', 'come', 'go',
  'try', 'trying', 'get', 'getting', 'give', 'tell', 'work', 'play', 'live',
]);

/**
 * Determine whether a character offset inside `text` lies within double quotation marks
 * (`"..."` or `“...”`) whose quoted content appears to be English (no Turkish diacritics).
 */
export function isOffsetInsideEnglishQuote(text: string, offset: number): boolean {
  const quotePattern = /["“]([^"”]{1,160})["”]/g;
  let match: RegExpExecArray | null;
  while ((match = quotePattern.exec(text)) !== null) {
    const start = match.index + 1;
    const end = start + (match[1]?.length ?? 0);
    if (offset >= start && offset <= end) {
      const inner = match[1] ?? '';
      if (!inner || TURKISH_CHAR_RE.test(inner)) return false;
      const tokens = inner
        .toLowerCase()
        .replace(/[’‘`]/g, "'")
        .match(/[a-z]+(?:'[a-z]+)?/g);
      if (!tokens || tokens.length === 0) return false;
      // Reject quoted Turkish phrases made solely of Turkish ASCII words
      const trCount = tokens.filter((t) => TURKISH_ASCII_WORDS.has(t)).length;
      const enCount = tokens.filter((t) => CLEAR_ENGLISH_CONTEXT_WORDS.has(t)).length;
      if (trCount > 0 && enCount === 0 && trCount >= Math.ceil(tokens.length * 0.5)) {
        return false;
      }
      return true;
    }
  }
  return false;
}

export interface WordLanguageGuardInput {
  word: string;
  contextText: string;
  wordStartOffset: number;
  explicitLang?: 'en' | 'tr' | null;
}

/**
 * Pure language guard deciding whether a hovered word should trigger the offline
 * English dictionary tooltip. Prevents false positives on Turkish UI and Turkish
 * sentences (including homographs like "her", "son", "on", "can", "at", "in")
 * while permitting English quotes inside Turkish explanations and all English surfaces.
 */
export function shouldAllowWordHover(input: WordLanguageGuardInput): boolean {
  const normalized = input.word.trim().replace(/[’‘`´]/g, "'");
  if (!normalized || TURKISH_CHAR_RE.test(normalized) || !ENGLISH_WORD_RE.test(normalized)) {
    return false;
  }

  const lower = normalized.toLowerCase();
  if (lower.length === 1 && lower !== 'i' && lower !== 'a') {
    return false;
  }

  if (input.explicitLang === 'en') {
    return true;
  }

  const inEnQuote = isOffsetInsideEnglishQuote(input.contextText, input.wordStartOffset);
  if (input.explicitLang === 'tr') {
    return inEnQuote;
  }

  if (inEnQuote) {
    return true;
  }

  // Untagged container: inspect surrounding text for Turkish markers
  const ctx = input.contextText || '';
  if (TURKISH_CHAR_RE.test(ctx)) {
    return false;
  }

  const words = ctx
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .match(/[a-z]+(?:'[a-z]+)?/g) ?? [];

  if (words.length === 0) return false;

  let trScore = 0;
  let enScore = 0;
  for (const w of words) {
    if (TURKISH_ASCII_WORDS.has(w)) trScore += 1;
    if (CLEAR_ENGLISH_CONTEXT_WORDS.has(w) || w.includes("'")) enScore += 1;
  }

  if (trScore > 0 && enScore === 0) {
    return false;
  }
  if (trScore >= 2 && trScore >= enScore) {
    return false;
  }

  // For short EN/TR homographs outside explicit EN tags, require clear English context
  if (EN_TR_HOMOGRAPHS.has(lower)) {
    if (words.length === 1) return false;
    return enScore >= 1 && enScore > trScore;
  }

  return true;
}

const TOOLTIP_CSS = `
.${PROBE_CLASS} {
  position: fixed;
  z-index: 2147483646;
  pointer-events: none;
  border-radius: 6px;
  background: rgba(56, 189, 248, 0.22);
  border: 1px solid rgba(125, 211, 252, 0.62);
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.26);
  overflow: hidden;
  opacity: 0;
  transform: scale(0.95);
  transition:
    opacity 0.16s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.16s cubic-bezier(0.16, 1, 0.3, 1),
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.${PROBE_CLASS}[hidden] {
  display: none !important;
}

.${PROBE_CLASS}.is-charging {
  opacity: 1;
  transform: scale(1);
}

.${PROBE_CLASS}.is-active {
  opacity: 1;
  transform: scale(1);
  background: rgba(251, 191, 36, 0.22);
  border-color: rgba(251, 191, 36, 0.72);
  box-shadow: 0 0 16px rgba(251, 191, 36, 0.28);
}

.${PROBE_CLASS}-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2.5px;
  width: 100%;
  background: linear-gradient(90deg, #38bdf8, #818cf8, #fbbf24);
  transform-origin: left center;
  transform: scaleX(0);
}

.${PROBE_CLASS}.is-charging .${PROBE_CLASS}-bar {
  animation: elWordProbeFill var(--el-probe-ms, 1200ms) cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
}

.${PROBE_CLASS}.is-active .${PROBE_CLASS}-bar {
  opacity: 0;
  transition: opacity 0.15s ease;
}

@keyframes elWordProbeFill {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

.${TOOLTIP_CLASS} {
  position: fixed;
  z-index: 2147483647;
  max-width: min(312px, calc(100vw - 16px));
  min-width: 184px;
  padding: 11px 13px 11px;
  border-radius: 13px;
  background: linear-gradient(165deg, rgba(24, 28, 46, 0.985) 0%, rgba(15, 18, 30, 0.985) 100%);
  color: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.34);
  box-shadow:
    0 22px 50px rgba(0, 0, 0, 0.82),
    0 0 0 1px rgba(251, 191, 36, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.11);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  text-align: left;
  pointer-events: auto;
  overflow: hidden;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.${TOOLTIP_CLASS}::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2.5px;
  background: linear-gradient(90deg, #38bdf8 0%, #818cf8 45%, #fbbf24 100%);
}

.${TOOLTIP_CLASS}.is-visible {
  opacity: 1;
  transform: translateY(0);
}

.${TOOLTIP_CLASS}[hidden] {
  display: none !important;
}

.${TOOLTIP_CLASS}-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 3px;
}

.${TOOLTIP_CLASS}-word-group {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
}

.${TOOLTIP_CLASS}-word {
  font-size: 14.5px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.01em;
}

.${TOOLTIP_CLASS}-phonetic {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10.5px;
  color: #94a3b8;
}

.${TOOLTIP_CLASS}-meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.${TOOLTIP_CLASS}-badge {
  font-size: 9.5px;
  font-weight: 700;
  padding: 1.5px 5.5px;
  border-radius: 5px;
  background: rgba(148, 163, 184, 0.14);
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.28);
  white-space: nowrap;
}

.${TOOLTIP_CLASS}-badge.is-level {
  background: rgba(56, 189, 248, 0.14);
  color: #7dd3fc;
  border-color: rgba(56, 189, 248, 0.32);
}

.${TOOLTIP_CLASS}-spk {
  appearance: none;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #e2e8f0;
  border-radius: 6px;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.${TOOLTIP_CLASS}-spk:hover {
  background: rgba(56, 189, 248, 0.24);
  border-color: rgba(56, 189, 248, 0.55);
  color: #ffffff;
}

.${TOOLTIP_CLASS}-lemma {
  font-size: 10.5px;
  color: #7dd3fc;
  margin-bottom: 6px;
  font-weight: 500;
}

.${TOOLTIP_CLASS}-tr-box {
  margin-top: 6px;
  padding: 7px 8px;
  border-radius: 9px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.24);
}

.${TOOLTIP_CLASS}-tr-lbl {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #fbbf24;
  margin-bottom: 5px;
}

.${TOOLTIP_CLASS}-meanings {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.${TOOLTIP_CLASS}-pill {
  display: inline-block;
  padding: 2.5px 8px;
  border-radius: 7px;
  font-size: 11.5px;
  font-weight: 500;
  color: #fde68a;
  background: rgba(245, 158, 11, 0.11);
  border: 1px solid rgba(251, 191, 36, 0.26);
  line-height: 1.32;
}

.${TOOLTIP_CLASS}-pill.is-primary {
  font-weight: 700;
  font-size: 12px;
  color: #fef9c3;
  background: rgba(245, 158, 11, 0.24);
  border-color: rgba(251, 191, 36, 0.62);
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.15);
}

.${TOOLTIP_CLASS}-ensyn {
  margin-top: 7px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 10.5px;
}

.${TOOLTIP_CLASS}-ensyn-lbl {
  color: #94a3b8;
  font-weight: 600;
  margin-right: 2px;
}

.${TOOLTIP_CLASS}-ensyn-val {
  color: #c4b5fd;
  font-weight: 500;
}

/* Warm Champagne-Ivory & Brushed Gold Light Tooltip Override (automatically disabled in Dark Mode) */
:root:not([data-theme="dark"]) .${PROBE_CLASS}.is-active,
:host(:not([data-theme="dark"])) .${PROBE_CLASS}.is-active {
  background: rgba(199, 130, 20, 0.16);
  border-color: rgba(199, 130, 20, 0.7);
  box-shadow: 0 0 12px rgba(199, 130, 20, 0.2);
}

:root:not([data-theme="dark"]) .${TOOLTIP_CLASS},
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS} {
  background: #fffdf7;
  color: #1f1a12;
  border: 2px solid #e5d7b3;
  border-bottom: 4px solid #cfb882;
  border-radius: 14px;
  box-shadow: 0 14px 36px rgba(41, 30, 12, 0.16);
}

:root:not([data-theme="dark"]) .${TOOLTIP_CLASS}::before,
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS}::before {
  background: linear-gradient(90deg, #c78214 0%, #eab308 55%, #d9921d 100%);
}

:root:not([data-theme="dark"]) .${TOOLTIP_CLASS}-word,
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS}-word {
  color: #1f1a12;
}

:root:not([data-theme="dark"]) .${TOOLTIP_CLASS}-phonetic,
:root:not([data-theme="dark"]) .${TOOLTIP_CLASS}-ipa,
:root:not([data-theme="dark"]) .${TOOLTIP_CLASS}-lemma,
:root:not([data-theme="dark"]) .${TOOLTIP_CLASS}-ensyn-lbl,
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS}-phonetic,
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS}-ipa,
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS}-lemma,
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS}-ensyn-lbl {
  color: #6e604b;
}

:root:not([data-theme="dark"]) .${TOOLTIP_CLASS}-badge,
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS}-badge {
  background: #f4ecd4;
  color: #3d3427;
  border-color: #decb99;
}

:root:not([data-theme="dark"]) .${TOOLTIP_CLASS}-badge.is-level,
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS}-badge.is-level {
  background: #fef7de;
  color: #854d0e;
  border-color: #e6c674;
}

:root:not([data-theme="dark"]) .${TOOLTIP_CLASS}-spk,
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS}-spk {
  background: #fef7de;
  border-color: #e6c674;
  color: #965e08;
}

:root:not([data-theme="dark"]) .${TOOLTIP_CLASS}-spk:hover,
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS}-spk:hover {
  background: #c78214;
  border-color: #c78214;
  color: #ffffff;
}

:root:not([data-theme="dark"]) .${TOOLTIP_CLASS}-tr-box,
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS}-tr-box {
  background: #faf3dc;
  border: 1.5px solid #e6cb82;
}

:root:not([data-theme="dark"]) .${TOOLTIP_CLASS}-tr-lbl,
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS}-tr-lbl {
  color: #965e08;
  font-weight: 800;
}

:root:not([data-theme="dark"]) .${TOOLTIP_CLASS}-pill,
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS}-pill {
  background: #fffdf7;
  border: 1.5px solid #e6c674;
  color: #5c3a09;
  font-weight: 600;
}

:root:not([data-theme="dark"]) .${TOOLTIP_CLASS}-pill.is-primary,
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS}-pill.is-primary {
  background: #fef2c5;
  border: 1.5px solid #d9921d;
  color: #5c3a09;
  font-weight: 800;
  box-shadow: 0 2px 0 #e8cb7e;
}

:root:not([data-theme="dark"]) .${TOOLTIP_CLASS}-meaning,
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS}-meaning {
  color: #1f1a12;
}

:root:not([data-theme="dark"]) .${TOOLTIP_CLASS}-alt,
:root:not([data-theme="dark"]) .${TOOLTIP_CLASS}-ensyn-val,
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS}-alt,
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS}-ensyn-val {
  color: #854d0e;
  font-weight: 600;
}

:root:not([data-theme="dark"]) .${TOOLTIP_CLASS}-ensyn,
:host(:not([data-theme="dark"])) .${TOOLTIP_CLASS}-ensyn {
  border-top-color: #e8ddc0;
}
`;

function rectContainsPoint(rect: DOMRect, x: number, y: number): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false;
  return (
    x >= rect.left - RECT_TOLERANCE_PX &&
    x <= rect.right + RECT_TOLERANCE_PX &&
    y >= rect.top - RECT_TOLERANCE_PX &&
    y <= rect.bottom + RECT_TOLERANCE_PX
  );
}

function getWordRectAtPoint(
  doc: Document,
  textNode: Text,
  start: number,
  end: number,
  x: number,
  y: number
): DOMRect | null {
  try {
    const range = doc.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, end);
    const rects = range.getClientRects();
    for (let i = 0; i < rects.length; i += 1) {
      const r = rects[i]!;
      if (rectContainsPoint(r, x, y)) {
        return r;
      }
    }
  } catch {
    // Ignore stale text node range errors
  }
  return null;
}

/** Find the specific hyphenated sub-segment under `(x, y)` if `word` contains hyphens. */
function findHyphenSubWordAtPoint(
  doc: Document,
  textNode: Text,
  wordStart: number,
  rawWord: string,
  x: number,
  y: number
): string | undefined {
  if (!rawWord.includes('-')) return undefined;
  let segStart = 0;
  const parts = rawWord.split('-');
  for (const part of parts) {
    const absStart = wordStart + segStart;
    const absEnd = absStart + part.length;
    if (part.length >= 2 && getWordRectAtPoint(doc, textNode, absStart, absEnd, x, y)) {
      return part;
    }
    segStart += part.length + 1;
  }
  return undefined;
}

function hitTestTextNode(
  doc: Document,
  textNode: Text,
  x: number,
  y: number,
  hintOffset?: number
): WordHit | null {
  const data = textNode.data;
  if (!data || !data.trim()) return null;

  const parentEl = textNode.parentElement;
  if (!parentEl) return null;

  // Quick bounding check on the whole text node when no caret offset is provided
  if (hintOffset === undefined) {
    try {
      const fullRange = doc.createRange();
      fullRange.selectNodeContents(textNode);
      const rects = fullRange.getClientRects();
      let insideNode = false;
      for (let i = 0; i < rects.length; i += 1) {
        if (rectContainsPoint(rects[i]!, x, y)) {
          insideNode = true;
          break;
        }
      }
      if (!insideNode) return null;
    } catch {
      return null;
    }
  }

  WORD_SCAN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WORD_SCAN_RE.exec(data)) !== null) {
    const rawWord = match[0];
    const start = match.index;
    const end = start + rawWord.length;
    if (hintOffset !== undefined && (hintOffset < start - 1 || hintOffset > end + 1)) {
      continue;
    }
    const rect = getWordRectAtPoint(doc, textNode, start, end, x, y);
    if (rect) {
      const subWord = findHyphenSubWordAtPoint(doc, textNode, start, rawWord, x, y);
      return {
        key: `${start}:${end}:${rawWord}`,
        word: rawWord,
        subWord,
        rect,
        element: parentEl,
        textNode,
        startOffset: start,
        endOffset: end,
      };
    }
  }

  return null;
}

interface CaretPositionLike {
  offsetNode: Node | null;
  offset: number;
}

type DocumentWithCaret = Document & {
  caretPositionFromPoint?: (x: number, y: number) => CaretPositionLike | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

function findWordHitAtPoint(root: Document | ShadowRoot, x: number, y: number): WordHit | null {
  const ownerDoc = root instanceof Document ? root : root.ownerDocument;
  if (!ownerDoc) return null;

  // Fast path in Light DOM via native browser caret hit-testing
  if (root instanceof Document) {
    const docCaret = root as DocumentWithCaret;
    let node: Node | null = null;
    let offset = 0;

    if (typeof docCaret.caretPositionFromPoint === 'function') {
      const pos = docCaret.caretPositionFromPoint(x, y);
      if (pos) {
        node = pos.offsetNode;
        offset = pos.offset;
      }
    } else if (typeof docCaret.caretRangeFromPoint === 'function') {
      const range = docCaret.caretRangeFromPoint(x, y);
      if (range) {
        node = range.startContainer;
        offset = range.startOffset;
      }
    }

    if (node && node.nodeType === Node.TEXT_NODE) {
      const hit = hitTestTextNode(ownerDoc, node as Text, x, y, offset);
      if (hit) return hit;
    }
  }

  // Universal Shadow-DOM-safe & button-text fallback via elementFromPoint + Range rects
  const el =
    typeof root.elementFromPoint === 'function' ? root.elementFromPoint(x, y) : null;
  if (!el) return null;
  if (el.closest(EXCLUDED_SELECTOR)) return null;

  const walker = ownerDoc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let inspected = 0;
  let current = walker.nextNode();
  while (current && inspected < 40) {
    inspected += 1;
    const hit = hitTestTextNode(ownerDoc, current as Text, x, y);
    if (hit) return hit;
    current = walker.nextNode();
  }

  return null;
}

function resolveExplicitLang(element: Element): 'en' | 'tr' | null {
  const tagged = element.closest<HTMLElement>('[data-word-lang]');
  const val = tagged?.dataset.wordLang;
  if (val === 'en' || val === 'tr') return val;
  return null;
}

function getContextTextForHit(hit: WordHit): { text: string; offset: number } {
  const raw = hit.textNode.data;
  const parent = hit.element.parentElement;
  // When a sentence is split across inline spans (e.g. karaoke word spans or highlights),
  // walk the containing block/parent to recover the exact offset within the full sentence.
  const container =
    raw.trim().length <= hit.word.length + 3 && parent
      ? parent.closest('p, div, li, button, td, span.duo-choice-label') ?? parent
      : null;

  if (container && container.contains(hit.textNode)) {
    const ownerDoc = hit.textNode.ownerDocument;
    if (ownerDoc) {
      const walker = ownerDoc.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let combined = '';
      let exactOffset = -1;
      let node = walker.nextNode();
      while (node) {
        if (node === hit.textNode) {
          exactOffset = combined.length + hit.startOffset;
        }
        combined += (node as Text).data;
        node = walker.nextNode();
      }
      if (exactOffset !== -1) {
        return { text: combined, offset: exactOffset };
      }
    }
  }
  return { text: raw, offset: hit.startOffset };
}

function ensureTooltipStyle(root: Document | ShadowRoot): void {
  if (root.querySelector(`style[${STYLE_ATTR}="1"]`)) return;
  const ownerDoc = root instanceof Document ? root : root.ownerDocument;
  if (!ownerDoc) return;
  const style = ownerDoc.createElement('style');
  style.setAttribute(STYLE_ATTR, '1');
  style.textContent = TOOLTIP_CSS;
  if (root instanceof Document) {
    (root.head ?? root.documentElement).appendChild(style);
  } else {
    root.appendChild(style);
  }
}

/**
 * Install the 1.5-second offline English word hover tooltip on a Document or ShadowRoot.
 * Never mutates exercise text DOM; tracks word boundaries via caret/range hit-testing.
 */
export function installWordHoverTooltip(
  options: WordHoverTooltipOptions
): WordHoverTooltipController {
  const { root, lookupWord, delayMs = DEFAULT_DWELL_MS } = options;
  const ownerDoc = root instanceof Document ? root : root.ownerDocument;
  if (!ownerDoc) {
    return { hide: () => {}, dispose: () => {} };
  }

  ensureTooltipStyle(root);

  const probeEl = ownerDoc.createElement('div');
  probeEl.className = PROBE_CLASS;
  probeEl.setAttribute('aria-hidden', 'true');
  probeEl.hidden = true;
  const probeBarEl = ownerDoc.createElement('div');
  probeBarEl.className = `${PROBE_CLASS}-bar`;
  probeEl.appendChild(probeBarEl);

  const tooltipEl = ownerDoc.createElement('div');
  tooltipEl.className = TOOLTIP_CLASS;
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.hidden = true;

  if (root instanceof Document) {
    const mountTarget = root.body ?? root.documentElement;
    mountTarget.append(probeEl, tooltipEl);
  } else {
    root.append(probeEl, tooltipEl);
  }

  const probeDelayMs = Math.min(HIGHLIGHT_DELAY_MS, Math.floor(delayMs * 0.25));
  const chargeDurationMs = Math.max(120, delayMs - probeDelayMs);

  let probeTimer: ReturnType<typeof setTimeout> | null = null;
  let dwellTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingHit: WordHit | null = null;
  let pendingEntryPromise: Promise<OfflineWordEntry | null> | null = null;
  let shownHitKey: string | null = null;
  let pointerInsideTooltip = false;
  let lookupToken = 0;
  let disposed = false;

  // Map each Text node to a stable numeric id so identical words in different nodes get distinct keys
  const nodeIds = new WeakMap<Text, number>();
  let nextNodeId = 1;
  const getNodeId = (n: Text): number => {
    let id = nodeIds.get(n);
    if (!id) {
      id = nextNodeId++;
      nodeIds.set(n, id);
    }
    return id;
  };

  const clearProbeTimer = (): void => {
    if (probeTimer !== null) {
      clearTimeout(probeTimer);
      probeTimer = null;
    }
  };

  const clearDwellTimer = (): void => {
    if (dwellTimer !== null) {
      clearTimeout(dwellTimer);
      dwellTimer = null;
    }
  };

  const clearHideTimer = (): void => {
    if (hideTimer !== null) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  const hideProbe = (): void => {
    clearProbeTimer();
    probeEl.classList.remove('is-charging', 'is-active');
    probeEl.hidden = true;
  };

  const positionProbeRect = (rect: DOMRect): void => {
    const padX = 4;
    const padY = 2;
    probeEl.style.left = `${Math.round(rect.left - padX)}px`;
    probeEl.style.top = `${Math.round(rect.top - padY)}px`;
    probeEl.style.width = `${Math.max(8, Math.round(rect.width + padX * 2))}px`;
    probeEl.style.height = `${Math.max(10, Math.round(rect.height + padY * 2))}px`;
  };

  const showChargingProbe = (rect: DOMRect): void => {
    positionProbeRect(rect);
    probeEl.style.setProperty('--el-probe-ms', `${chargeDurationMs}ms`);
    probeEl.classList.remove('is-active', 'is-charging');
    probeEl.hidden = false;
    // Force reflow so the bottom charge sweep animation restarts cleanly per word
    void probeBarEl.offsetWidth;
    probeEl.classList.add('is-charging');
  };

  const activateProbe = (rect: DOMRect): void => {
    positionProbeRect(rect);
    probeEl.classList.remove('is-charging');
    probeEl.classList.add('is-active');
    probeEl.hidden = false;
  };

  const resolveOfflineEntry = async (hit: WordHit): Promise<OfflineWordEntry | null> => {
    let entry = await lookupWord(hit.word);
    if (!entry && hit.subWord && hit.subWord.toLowerCase() !== hit.word.toLowerCase()) {
      entry = await lookupWord(hit.subWord);
    }
    return entry;
  };

  const hide = (): void => {
    clearProbeTimer();
    clearDwellTimer();
    clearHideTimer();
    hideProbe();
    pendingHit = null;
    pendingEntryPromise = null;
    shownHitKey = null;
    lookupToken += 1;
    tooltipEl.classList.remove('is-visible');
    tooltipEl.hidden = true;
  };

  const scheduleHideWithGrace = (): void => {
    clearHideTimer();
    hideTimer = setTimeout(() => {
      hideTimer = null;
      if (!pointerInsideTooltip) {
        hide();
      }
    }, HIDE_GRACE_MS);
  };

  const positionTooltip = (anchorRect: DOMRect): void => {
    const vw = window.innerWidth || ownerDoc.documentElement.clientWidth || 460;
    const vh = window.innerHeight || ownerDoc.documentElement.clientHeight || 600;
    const margin = 8;
    const gap = 10;

    tooltipEl.style.left = '0px';
    tooltipEl.style.top = '0px';
    tooltipEl.hidden = false;

    const tipRect = tooltipEl.getBoundingClientRect();
    const tipW = tipRect.width || 240;
    const tipH = tipRect.height || 86;

    const centerX = anchorRect.left + anchorRect.width / 2;
    const left = Math.max(margin, Math.min(vw - tipW - margin, Math.round(centerX - tipW / 2)));

    const spaceAbove = anchorRect.top - margin - gap;
    const spaceBelow = vh - anchorRect.bottom - margin - gap;
    const placeAbove = spaceAbove >= tipH || spaceAbove >= spaceBelow;

    const rawTop = placeAbove ? anchorRect.top - tipH - gap : anchorRect.bottom + gap;
    const top = Math.max(margin, Math.min(vh - tipH - margin, Math.round(rawTop)));

    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  };

  const renderTooltipContent = (entry: OfflineWordEntry): void => {
    tooltipEl.replaceChildren();

    const head = ownerDoc.createElement('div');
    head.className = `${TOOLTIP_CLASS}-head`;

    const wordGroup = ownerDoc.createElement('div');
    wordGroup.className = `${TOOLTIP_CLASS}-word-group`;

    const wordEl = ownerDoc.createElement('span');
    wordEl.className = `${TOOLTIP_CLASS}-word`;
    wordEl.textContent = entry.query;
    wordGroup.appendChild(wordEl);

    if (entry.phonetic) {
      const phonEl = ownerDoc.createElement('span');
      phonEl.className = `${TOOLTIP_CLASS}-phonetic`;
      phonEl.textContent = entry.phonetic;
      wordGroup.appendChild(phonEl);
    }

    const meta = ownerDoc.createElement('div');
    meta.className = `${TOOLTIP_CLASS}-meta`;

    if (entry.posTr) {
      const posBadge = ownerDoc.createElement('span');
      posBadge.className = `${TOOLTIP_CLASS}-badge`;
      posBadge.textContent = entry.posTr;
      meta.appendChild(posBadge);
    }
    if (entry.level) {
      const lvlBadge = ownerDoc.createElement('span');
      lvlBadge.className = `${TOOLTIP_CLASS}-badge is-level`;
      lvlBadge.textContent = entry.level;
      meta.appendChild(lvlBadge);
    }

    const spkBtn = ownerDoc.createElement('button');
    spkBtn.type = 'button';
    spkBtn.className = `${TOOLTIP_CLASS}-spk`;
    spkBtn.innerHTML = uiIconSvg('volume', 13);
    spkBtn.title = 'Telaffuzu dinle';
    spkBtn.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
    });
    spkBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      speakEnglishText(entry.query, DEFAULT_ENGLISH_TTS_RATE, { isQuickTile: true });
    });
    meta.appendChild(spkBtn);

    head.append(wordGroup, meta);
    tooltipEl.appendChild(head);

    const showLemmaRow =
      entry.lemma.toLowerCase() !== entry.query.toLowerCase() || Boolean(entry.inflectionNoteTr);
    if (showLemmaRow) {
      const lemmaRow = ownerDoc.createElement('div');
      lemmaRow.className = `${TOOLTIP_CLASS}-lemma`;
      const parts: string[] = [];
      if (entry.lemma.toLowerCase() !== entry.query.toLowerCase()) {
        parts.push(`← ${entry.lemma}`);
      }
      if (entry.inflectionNoteTr) {
        parts.push(entry.inflectionNoteTr);
      }
      lemmaRow.textContent = parts.join(' · ');
      tooltipEl.appendChild(lemmaRow);
    }

    const trBox = ownerDoc.createElement('div');
    trBox.className = `${TOOLTIP_CLASS}-tr-box`;

    const trLbl = ownerDoc.createElement('div');
    trLbl.className = `${TOOLTIP_CLASS}-tr-lbl`;
    trLbl.textContent =
      entry.meaningsTr.length > 1 ? 'Türkçe · Eş Anlamlar' : 'Türkçe Anlamı';

    const meaningsWrap = ownerDoc.createElement('div');
    meaningsWrap.className = `${TOOLTIP_CLASS}-meanings`;
    entry.meaningsTr.forEach((meaning, idx) => {
      const pill = ownerDoc.createElement('span');
      pill.className = `${TOOLTIP_CLASS}-pill${idx === 0 ? ' is-primary' : ''}`;
      pill.textContent = meaning;
      meaningsWrap.appendChild(pill);
    });
    trBox.append(trLbl, meaningsWrap);
    tooltipEl.appendChild(trBox);

    if (entry.englishSynonyms && entry.englishSynonyms.length > 0) {
      const synRow = ownerDoc.createElement('div');
      synRow.className = `${TOOLTIP_CLASS}-ensyn`;

      const lbl = ownerDoc.createElement('span');
      lbl.className = `${TOOLTIP_CLASS}-ensyn-lbl`;
      lbl.textContent = 'Eş anlam (EN):';

      const val = ownerDoc.createElement('span');
      val.className = `${TOOLTIP_CLASS}-ensyn-val`;
      val.textContent = entry.englishSynonyms.join(' · ');

      synRow.append(lbl, val);
      tooltipEl.appendChild(synRow);
    }
  };

  const resolveAndShow = async (
    hit: WordHit,
    fullKey: string,
    prefetchedPromise?: Promise<OfflineWordEntry | null> | null
  ): Promise<void> => {
    const token = ++lookupToken;
    try {
      const entry = await (prefetchedPromise ?? resolveOfflineEntry(hit));
      if (disposed || token !== lookupToken || !entry || entry.meaningsTr.length === 0) {
        hideProbe();
        return;
      }
      if (!hit.textNode.isConnected) {
        hideProbe();
        return;
      }

      // Recompute fresh rect right before displaying in case layout shifted
      const freshRect =
        getWordRectAtPoint(
          ownerDoc,
          hit.textNode,
          hit.startOffset,
          hit.endOffset,
          hit.rect.left + hit.rect.width / 2,
          hit.rect.top + hit.rect.height / 2
        ) ?? hit.rect;

      activateProbe(freshRect);
      renderTooltipContent(entry);
      positionTooltip(freshRect);
      shownHitKey = fullKey;
      requestAnimationFrame(() => {
        if (!disposed && shownHitKey === fullKey && !tooltipEl.hidden) {
          tooltipEl.classList.add('is-visible');
        }
      });
    } catch {
      hideProbe();
    }
  };

  let rafPending = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  const cancelPendingHover = (): void => {
    clearProbeTimer();
    clearDwellTimer();
    pendingHit = null;
    pendingEntryPromise = null;
    if (tooltipEl.hidden) {
      hideProbe();
    }
  };

  const processPointerPosition = (): void => {
    rafPending = false;
    if (disposed || pointerInsideTooltip) return;

    const hit = findWordHitAtPoint(root, lastPointerX, lastPointerY);
    if (!hit) {
      cancelPendingHover();
      if (!tooltipEl.hidden) {
        scheduleHideWithGrace();
      }
      return;
    }

    if (hit.element.closest(EXCLUDED_SELECTOR)) {
      cancelPendingHover();
      if (!tooltipEl.hidden) {
        scheduleHideWithGrace();
      }
      return;
    }

    const explicitLang = resolveExplicitLang(hit.element);
    const { text: ctxText, offset: ctxOffset } = getContextTextForHit(hit);
    const allowed = shouldAllowWordHover({
      word: hit.word,
      contextText: ctxText,
      wordStartOffset: ctxOffset,
      explicitLang,
    });

    if (!allowed) {
      cancelPendingHover();
      if (!tooltipEl.hidden) {
        scheduleHideWithGrace();
      }
      return;
    }

    const fullKey = `${getNodeId(hit.textNode)}:${hit.key}`;

    // Already showing tooltip for this exact word -> keep it open steadily
    if (shownHitKey === fullKey && !tooltipEl.hidden) {
      clearHideTimer();
      return;
    }

    // Already counting down for this exact word -> do NOT reset timer on cursor micro-jitter
    if (pendingHit && `${getNodeId(pendingHit.textNode)}:${pendingHit.key}` === fullKey) {
      pendingHit = hit;
      return;
    }

    // Moved to a brand new English word
    cancelPendingHover();
    if (!tooltipEl.hidden) {
      tooltipEl.classList.remove('is-visible');
      tooltipEl.hidden = true;
      shownHitKey = null;
      hideProbe();
    }

    pendingHit = hit;

    // 0 -> 300ms: completely quiet. At 300ms: check offline entry and animate gentle selection halo.
    probeTimer = setTimeout(() => {
      probeTimer = null;
      if (disposed || !pendingHit) return;
      const activeKey = `${getNodeId(pendingHit.textNode)}:${pendingHit.key}`;
      if (activeKey !== fullKey || !pendingHit.textNode.isConnected) return;

      const currentHit = pendingHit;
      const entryPromise = resolveOfflineEntry(currentHit);
      pendingEntryPromise = entryPromise;

      void entryPromise.then((entry) => {
        if (disposed || !pendingHit) return;
        const nowKey = `${getNodeId(pendingHit.textNode)}:${pendingHit.key}`;
        if (nowKey !== fullKey || !pendingHit.textNode.isConnected) return;
        if (!entry || entry.meaningsTr.length === 0) return;

        const freshRect =
          getWordRectAtPoint(
            ownerDoc,
            currentHit.textNode,
            currentHit.startOffset,
            currentHit.endOffset,
            currentHit.rect.left + currentHit.rect.width / 2,
            currentHit.rect.top + currentHit.rect.height / 2
          ) ?? currentHit.rect;
        showChargingProbe(freshRect);
      });
    }, probeDelayMs);

    // At 1500ms: reveal the full meanings + synonyms card.
    dwellTimer = setTimeout(() => {
      dwellTimer = null;
      if (disposed || !pendingHit) return;
      const activeKey = `${getNodeId(pendingHit.textNode)}:${pendingHit.key}`;
      if (activeKey !== fullKey) return;
      void resolveAndShow(pendingHit, fullKey, pendingEntryPromise);
    }, delayMs);
  };

  const onPointerMove = (e: Event): void => {
    const pe = e as PointerEvent;
    if (pe.pointerType === 'touch') return;
    if (pe.buttons !== 0) {
      hide();
      return;
    }
    const target = pe.target as Node | null;
    if (target && tooltipEl.contains(target)) {
      pointerInsideTooltip = true;
      clearHideTimer();
      return;
    }
    lastPointerX = pe.clientX;
    lastPointerY = pe.clientY;
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(processPointerPosition);
    }
  };

  const onPointerDown = (e: Event): void => {
    const target = e.target as Node | null;
    if (target && tooltipEl.contains(target)) return;
    hide();
  };

  const onTooltipEnter = (): void => {
    pointerInsideTooltip = true;
    clearHideTimer();
  };

  const onTooltipLeave = (): void => {
    pointerInsideTooltip = false;
    scheduleHideWithGrace();
  };

  const onDismissEvent = (): void => {
    hide();
  };

  // In Shadow DOM overlays, moving the cursor off the widget onto the host webpage
  // stops pointermove inside the ShadowRoot; detect that on window so timers cancel cleanly.
  const shadowHost = root instanceof ShadowRoot ? root.host : null;
  const onHostWindowPointerMove = (e: PointerEvent): void => {
    if (!shadowHost || disposed || pointerInsideTooltip) return;
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    if (path.includes(shadowHost)) return;
    cancelPendingHover();
    if (!tooltipEl.hidden) {
      scheduleHideWithGrace();
    }
  };

  const targetRoot = root as EventTarget;
  targetRoot.addEventListener('pointermove', onPointerMove, { passive: true });
  targetRoot.addEventListener('pointerdown', onPointerDown, true);
  targetRoot.addEventListener('pointerleave', onDismissEvent, { passive: true });
  targetRoot.addEventListener('scroll', onDismissEvent, true);
  targetRoot.addEventListener('wheel', onDismissEvent, { passive: true });
  tooltipEl.addEventListener('pointerenter', onTooltipEnter);
  tooltipEl.addEventListener('pointerleave', onTooltipLeave);
  window.addEventListener('keydown', onDismissEvent, true);
  window.addEventListener('blur', onDismissEvent);
  if (shadowHost) {
    window.addEventListener('pointermove', onHostWindowPointerMove, { passive: true });
  }

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    hide();
    targetRoot.removeEventListener('pointermove', onPointerMove);
    targetRoot.removeEventListener('pointerdown', onPointerDown, true);
    targetRoot.removeEventListener('pointerleave', onDismissEvent);
    targetRoot.removeEventListener('scroll', onDismissEvent, true);
    targetRoot.removeEventListener('wheel', onDismissEvent);
    tooltipEl.removeEventListener('pointerenter', onTooltipEnter);
    tooltipEl.removeEventListener('pointerleave', onTooltipLeave);
    window.removeEventListener('keydown', onDismissEvent, true);
    window.removeEventListener('blur', onDismissEvent);
    if (shadowHost) {
      window.removeEventListener('pointermove', onHostWindowPointerMove);
    }
    probeEl.remove();
    tooltipEl.remove();
  };

  return { hide, dispose };
}
