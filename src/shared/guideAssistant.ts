import { cancelEnglishSpeech } from './speech.ts';

/**
 * All 16 interactive Voice Guide Assistant clips covering onboarding and every UI area.
 */
export type AssistantGuideId =
  | 'welcome_onboarding'
  | 'onboarding_profile'
  | 'onboarding_restore'
  | 'tour_home_roadmap'
  | 'tour_remedial_hub'
  | 'tour_ask_now'
  | 'tour_challenge'
  | 'tour_listen_write'
  | 'tour_teach_me'
  | 'tour_ask_ai'
  | 'tour_options_analytics'
  | 'tour_options_ai_api'
  | 'tour_options_cards'
  | 'tour_options_settings'
  | 'tour_topbar_controls'
  | 'tour_remedial_briefing';

export const ASSISTANT_GUIDE_ORDER: readonly AssistantGuideId[] = [
  'welcome_onboarding',
  'onboarding_profile',
  'onboarding_restore',
  'tour_home_roadmap',
  'tour_remedial_hub',
  'tour_ask_now',
  'tour_challenge',
  'tour_listen_write',
  'tour_teach_me',
  'tour_ask_ai',
  'tour_options_analytics',
  'tour_options_ai_api',
  'tour_options_cards',
  'tour_options_settings',
  'tour_topbar_controls',
  'tour_remedial_briefing',
];

export const ASSISTANT_GUIDE_LABELS: Record<AssistantGuideId, { tr: string; en: string }> = {
  welcome_onboarding: { tr: 'Uygulama tanıtımı', en: 'Welcome intro' },
  onboarding_profile: { tr: 'Seviye ve hedef seçimi', en: 'Profile & level setup' },
  onboarding_restore: { tr: 'Yedek geri yükleme', en: 'Backup restore' },
  tour_home_roadmap: { tr: 'Yol Haritası ne işe yarar?', en: 'What is Learning Path?' },
  tour_remedial_hub: { tr: 'Özel Dersler ne işe yarar?', en: 'What is Remedial Studio?' },
  tour_ask_now: { tr: 'Şimdi Soru Sor ne işe yarar?', en: 'What does Ask Now do?' },
  tour_challenge: { tr: 'Challenge modu ne işe yarar?', en: 'What is Challenge mode?' },
  tour_listen_write: { tr: 'Dinle & Yaz ne işe yarar?', en: 'What is Listen & Write?' },
  tour_teach_me: { tr: 'Bana Öğret ne işe yarar?', en: 'What is Teach Me?' },
  tour_ask_ai: { tr: 'AI Öğretmene Sor ne işe yarar?', en: 'What is Ask AI?' },
  tour_options_analytics: { tr: 'Gelişimim sekmesi ne işe yarar?', en: 'What is Analytics?' },
  tour_options_ai_api: { tr: 'Yapay Zekâ ayarları ne işe yarar?', en: 'What are AI settings?' },
  tour_options_cards: { tr: 'Kelimelerim sekmesi ne işe yarar?', en: 'What is My Cards?' },
  tour_options_settings: { tr: 'Ayarlar sekmesi ne işe yarar?', en: 'What is Settings?' },
  tour_topbar_controls: { tr: 'Üst kontroller ne işe yarar?', en: 'What are header controls?' },
  tour_remedial_briefing: { tr: 'Ön Anlatım ekranı ne işe yarar?', en: 'What is Briefing?' },
};

const GUIDE_SEEN_STORAGE_KEY = 'easylang_guide_seen_v1';

let activeGuideAudio: HTMLAudioElement | null = null;
let activeGuideWebCtx: AudioContext | null = null;
let activeGuideWebSrc: AudioBufferSourceNode | null = null;
let activeGuideId: AssistantGuideId | null = null;
let activeTriggerEl: HTMLElement | null = null;
let pendingAutoplayGuide: { guideId: AssistantGuideId; isTr: boolean; host?: HTMLElement | ShadowRoot } | null = null;
let externalStopHook: (() => void) | null = null;

// Track floating pills per mount root (Document body or ShadowRoot)
const pillMap = new WeakMap<Node, HTMLButtonElement>();
let activePillEl: HTMLButtonElement | null = null;

/**
 * Register a hook invoked before the assistant plays (used by teachMeDrawer to stop active grammar audio).
 */
export function registerBeforeGuidePlayHook(hook: () => void): void {
  externalStopHook = hook;
}

export function getGuideAudioRelativePath(guideId: AssistantGuideId): string {
  return `audio/assistant/${guideId}.mp3`;
}

function resolveGuideAudioUrl(guideId: AssistantGuideId): string {
  const rel = getGuideAudioRelativePath(guideId);
  if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
    return chrome.runtime.getURL(rel);
  }
  return rel;
}

function getOrCreateFloatingPill(host?: HTMLElement | ShadowRoot): HTMLButtonElement | null {
  if (typeof document === 'undefined') return null;
  const mountTarget: Node | null = host ?? document.body;
  if (!mountTarget) return null;

  const existing = pillMap.get(mountTarget);
  if (existing && existing.isConnected) return existing;

  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'el-guide-pill';
  pill.hidden = true;
  pill.setAttribute('aria-live', 'polite');

  const waves = document.createElement('span');
  waves.className = 'el-guide-waves';
  waves.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 5; i += 1) {
    waves.appendChild(document.createElement('i'));
  }

  const label = document.createElement('span');
  label.className = 'el-guide-pill-label';
  label.textContent = 'Asistan Konuşuyor';

  const stopChip = document.createElement('span');
  stopChip.className = 'el-guide-pill-stop';
  stopChip.textContent = '■ Durdur';

  pill.append(waves, label, stopChip);
  pill.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pendingAutoplayGuide && !activeGuideId) {
      const pending = pendingAutoplayGuide;
      pendingAutoplayGuide = null;
      void playGuideAssistant(pending.guideId, { isTr: pending.isTr, host: pending.host });
      return;
    }
    stopGuideAssistant();
  });

  if (mountTarget instanceof ShadowRoot || mountTarget instanceof HTMLElement) {
    mountTarget.appendChild(pill);
    pillMap.set(mountTarget, pill);
    return pill;
  }
  return null;
}

function showFloatingPill(
  mode: 'speaking' | 'ready',
  isTr: boolean,
  host?: HTMLElement | ShadowRoot
): void {
  if (activePillEl && (!host || activePillEl.parentNode !== (host ?? document.body))) {
    activePillEl.hidden = true;
    activePillEl.classList.remove('is-speaking', 'is-ready');
  }
  const pill = getOrCreateFloatingPill(host);
  if (!pill) return;
  activePillEl = pill;

  const labelEl = pill.querySelector<HTMLElement>('.el-guide-pill-label');
  const stopEl = pill.querySelector<HTMLElement>('.el-guide-pill-stop');

  if (mode === 'speaking') {
    pill.classList.add('is-speaking');
    pill.classList.remove('is-ready');
    pill.title = isTr ? 'Durdurmak için tıkla' : 'Click to stop';
    if (labelEl) labelEl.textContent = isTr ? 'Asistan Konuşuyor' : 'Assistant Speaking';
    if (stopEl) stopEl.textContent = isTr ? '■ Durdur' : '■ Stop';
  } else {
    pill.classList.remove('is-speaking');
    pill.classList.add('is-ready');
    pill.title = isTr ? 'Sesli tanıtımı başlat' : 'Play voice guide';
    if (labelEl) labelEl.textContent = isTr ? 'Asistan Hazır' : 'Guide Ready';
    if (stopEl) stopEl.textContent = isTr ? '▶ Dinle' : '▶ Play';
  }
  pill.hidden = false;
}

function hideFloatingPill(): void {
  if (activePillEl) {
    activePillEl.hidden = true;
    activePillEl.classList.remove('is-speaking', 'is-ready');
  }
}

function clearActiveTriggerClass(): void {
  if (activeTriggerEl) {
    activeTriggerEl.classList.remove('is-speaking');
    activeTriggerEl.setAttribute('aria-pressed', 'false');
    activeTriggerEl = null;
  }
}

/**
 * Immediately stop any active Voice Guide Assistant playback and hide the floating waveform pill.
 */
export function stopGuideAssistant(): void {
  pendingAutoplayGuide = null;
  if (activeGuideAudio) {
    try {
      activeGuideAudio.pause();
      activeGuideAudio.currentTime = 0;
      activeGuideAudio.removeAttribute('src');
    } catch {
      // Ignore cleanup failures
    }
    activeGuideAudio = null;
  }
  if (activeGuideWebSrc) {
    try {
      activeGuideWebSrc.stop();
      activeGuideWebSrc.disconnect();
    } catch {
      // Already stopped
    }
    activeGuideWebSrc = null;
  }
  if (activeGuideWebCtx) {
    try {
      void activeGuideWebCtx.close();
    } catch {
      // Ignore
    }
    activeGuideWebCtx = null;
  }
  activeGuideId = null;
  clearActiveTriggerClass();
  hideFloatingPill();
}

export function getActiveGuideAssistantId(): AssistantGuideId | null {
  return activeGuideId;
}

export interface PlayGuideOptions {
  isTr?: boolean;
  triggerEl?: HTMLElement | null;
  host?: HTMLElement | ShadowRoot;
  isAutoPlay?: boolean;
}

async function playGuideViaWebAudioFallback(
  guideId: AssistantGuideId,
  isTr: boolean,
  host?: HTMLElement | ShadowRoot
): Promise<boolean> {
  try {
    const url = resolveGuideAudioUrl(guideId);
    const resp = await fetch(url);
    if (!resp.ok) return false;
    const buf = await resp.arrayBuffer();
    const ctx = new AudioContext();
    activeGuideWebCtx = ctx;
    const decoded = await ctx.decodeAudioData(buf);
    if (activeGuideId !== guideId) {
      void ctx.close();
      return false;
    }
    const src = ctx.createBufferSource();
    src.buffer = decoded;
    src.connect(ctx.destination);
    activeGuideWebSrc = src;
    showFloatingPill('speaking', isTr, host);
    src.onended = () => {
      if (activeGuideWebSrc === src) {
        stopGuideAssistant();
      }
    };
    src.start(0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Play a specific Voice Guide Assistant audio clip with the floating "Asistan Konuşuyor" pill.
 */
export async function playGuideAssistant(
  guideId: AssistantGuideId,
  options: PlayGuideOptions = {}
): Promise<void> {
  const isTr = options.isTr ?? true;
  stopGuideAssistant();
  externalStopHook?.();
  cancelEnglishSpeech();

  activeGuideId = guideId;
  if (options.triggerEl) {
    activeTriggerEl = options.triggerEl;
    activeTriggerEl.classList.add('is-speaking');
    activeTriggerEl.setAttribute('aria-pressed', 'true');
  }

  const el = new Audio(resolveGuideAudioUrl(guideId));
  activeGuideAudio = el;

  el.addEventListener('ended', () => {
    if (activeGuideAudio === el) {
      stopGuideAssistant();
    }
  });
  el.addEventListener('error', () => {
    if (activeGuideAudio === el) {
      stopGuideAssistant();
    }
  });

  try {
    await el.play();
    if (activeGuideAudio === el && activeGuideId === guideId) {
      showFloatingPill('speaking', isTr, options.host);
    }
  } catch (err) {
    const errName = err instanceof Error ? err.name : '';
    if (errName === 'NotAllowedError' && options.isAutoPlay) {
      // Browser blocked autoplay before user gesture: show compact ready pill so 1 click starts it
      activeGuideId = null;
      activeGuideAudio = null;
      clearActiveTriggerClass();
      pendingAutoplayGuide = { guideId, isTr, host: options.host };
      showFloatingPill('ready', isTr, options.host);
      return;
    }
    const ok = await playGuideViaWebAudioFallback(guideId, isTr, options.host);
    if (!ok && activeGuideId === guideId) {
      stopGuideAssistant();
    }
  }
}

/**
 * Toggle playback of a guide clip: clicking an active "?" button stops it immediately,
 * clicking any other "?" button switches straight to that explanation.
 */
export function toggleGuideAssistant(
  guideId: AssistantGuideId,
  options: PlayGuideOptions = {}
): void {
  if (activeGuideId === guideId) {
    stopGuideAssistant();
    return;
  }
  void playGuideAssistant(guideId, options);
}

/**
 * Auto-play a guide clip at most once (persisted in chrome.storage.local), e.g., on first landing after onboarding.
 */
export async function playGuideOnce(
  guideId: AssistantGuideId,
  options: PlayGuideOptions = {}
): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const res = await chrome.storage.local.get(GUIDE_SEEN_STORAGE_KEY);
      const seen = (res[GUIDE_SEEN_STORAGE_KEY] as Record<string, boolean> | undefined) ?? {};
      if (seen[guideId]) return;
      seen[guideId] = true;
      await chrome.storage.local.set({ [GUIDE_SEEN_STORAGE_KEY]: seen });
    }
  } catch {
    // Ignore storage failures and still play cleanly
  }
  await playGuideAssistant(guideId, { ...options, isAutoPlay: true });
}

/**
 * Build a compact "?" ("Bu ne işe yarıyor?") trigger button that plays/stops the matching assistant clip.
 */
export function createGuideHelpButton(
  guideId: AssistantGuideId,
  options: {
    isTr: boolean;
    variant?: 'dot' | 'pill';
    labelTr?: string;
    labelEn?: string;
    extraClass?: string;
    host?: HTMLElement | ShadowRoot;
  }
): HTMLButtonElement {
  const { isTr, variant = 'dot' } = options;
  const meta = ASSISTANT_GUIDE_LABELS[guideId];
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `el-help-trigger is-${variant} ${options.extraClass ?? ''}`.trim();
  btn.dataset.guideId = guideId;
  btn.setAttribute('aria-pressed', 'false');
  btn.title = isTr
    ? `${meta.tr} (Sesli anlatım · Durdurmak için tekrar tıkla)`
    : `${meta.en} (Voice guide · Click again to stop)`;

  if (variant === 'pill') {
    const q = document.createElement('span');
    q.className = 'el-help-q';
    q.textContent = '?';
    const txt = document.createElement('span');
    txt.textContent = isTr
      ? options.labelTr ?? 'Bu ne işe yarıyor?'
      : options.labelEn ?? 'How does this work?';
    btn.append(q, txt);
  } else {
    btn.textContent = '?';
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleGuideAssistant(guideId, {
      isTr,
      triggerEl: btn,
      host: options.host,
    });
  });

  return btn;
}
