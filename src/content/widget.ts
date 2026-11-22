import { sanitizeConceptExplanationForCard } from '../shared/concepts';
import { stopGuideAssistant } from '../shared/guideAssistant';
import { renderHighlightedPhrase, renderHighlightedSentence } from '../shared/grammarHighlighter';
import { getUiStrings, resolveSupportedLanguage } from '../shared/i18n';
import { extractDisplayMeanings } from '../shared/meaningFormatter';
import type { OfflineWordEntry } from '../shared/offlineDictionary';
import { QUICK_INTERVAL_PRESETS } from '../shared/promptSchedule';
import { playCorrectSfx, playWrongSfx } from '../shared/sfx';
import { speakEnglishText as speakEnglish } from '../shared/speech';
import { isAiApiConfigured } from '../shared/storage';
import { buildInlineTeachMePanel, stopActiveRuleAudio } from '../shared/teachMeDrawer';
import { setIconLabel } from '../shared/uiIcons';
import { detectHelpSkillsForQuestion, hasRichTeachMeSkills } from '../shared/weaknessDetector';
import {
  installWordHoverTooltip,
  type WordHoverTooltipController,
} from '../shared/wordHoverTooltip';
import type {
  ActivePrompt,
  AnswerOutcomeResult,
  ConceptNote,
  ExtensionMessage,
  ExtensionSettings,
  UiThemeMode,
} from '../shared/types';
import { getWidgetCss } from './widgetStyles';

const HOST_ID = 'en-tr-recall-shadow-host';
const TOAST_HOST_ID = 'en-tr-recall-toast-host';

let escapeKeyHandler: ((e: KeyboardEvent) => void) | null = null;
let activeTeachCleanup: (() => void) | null = null;
let activeWordTooltip: WordHoverTooltipController | null = null;
const contentWordLookupCache = new Map<string, OfflineWordEntry | null>();

/** Lookup an English word in the extension's offline dictionary via local background IPC. */
export async function lookupOfflineWordFromBackground(
  word: string
): Promise<OfflineWordEntry | null> {
  const key = word.trim().toLowerCase();
  if (!key) return null;
  if (contentWordLookupCache.has(key)) {
    return contentWordLookupCache.get(key) ?? null;
  }
  try {
    const res = (await chrome.runtime.sendMessage({
      type: 'LOOKUP_OFFLINE_WORD',
      word,
    } satisfies ExtensionMessage)) as { ok?: boolean; entry?: OfflineWordEntry | null } | undefined;
    const entry = res?.ok ? (res.entry ?? null) : null;
    if (contentWordLookupCache.size > 400) {
      contentWordLookupCache.clear();
    }
    contentWordLookupCache.set(key, entry);
    return entry;
  } catch {
    return null;
  }
}

export function removeRecallWidget(): void {
  if (escapeKeyHandler) {
    window.removeEventListener('keydown', escapeKeyHandler);
    escapeKeyHandler = null;
  }
  activeWordTooltip?.dispose();
  activeWordTooltip = null;
  activeTeachCleanup?.();
  activeTeachCleanup = null;
  stopActiveRuleAudio();
  stopGuideAssistant();
  document.getElementById(HOST_ID)?.remove();
}

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

/** Create a crisp vector close (X) SVG icon with consistent sizing across widgets. */
export function buildCloseSvg(): SVGSVGElement {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('fill', 'none');
  const path = document.createElementNS(svgNs, 'path');
  path.setAttribute('d', 'M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2.1');
  path.setAttribute('stroke-linecap', 'round');
  svg.appendChild(path);
  return svg;
}

function createCloseIconBtn(title: string): HTMLButtonElement {
  const btn = createEl('button', 'etr-icon-btn etr-close-btn');
  btn.type = 'button';
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.appendChild(buildCloseSvg());
  return btn;
}

function buildMiniSvg(paths: string[], size: number = 13): SVGSVGElement {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const p = document.createElementNS(svgNs, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  }
  return svg;
}

function buildClockMiniSvg(size: number = 12): SVGSVGElement {
  return buildMiniSvg(['M12 6v6l4 2', 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z'], size);
}

function buildChevronDownSvg(size: number = 11): SVGSVGElement {
  return buildMiniSvg(['M6 9l6 6 6-6'], size);
}

function buildBellOffMiniSvg(size: number = 16): SVGSVGElement {
  return buildMiniSvg(
    [
      'M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5',
      'M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7',
      'M10.3 21a1.94 1.94 0 0 0 3.4 0',
      'M2 2l20 20',
    ],
    size
  );
}

function buildPauseCircleMiniSvg(size: number = 16): SVGSVGElement {
  return buildMiniSvg(
    ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z', 'M10 15V9', 'M14 15V9'],
    size
  );
}

function isolateKeyboardEvents(el: HTMLElement): void {
  const stop = (e: Event) => {
    e.stopPropagation();
  };
  el.addEventListener('keydown', stop);
  el.addEventListener('keyup', stop);
  el.addEventListener('keypress', stop);
}

let lastToastThemeMode: UiThemeMode = 'light';

export function renderToast(message: string, themeMode?: UiThemeMode): void {
  const mode: UiThemeMode = themeMode ?? lastToastThemeMode;
  document.getElementById(TOAST_HOST_ID)?.remove();
  const host = document.createElement('div');
  host.id = TOAST_HOST_ID;
  host.dataset.theme = mode;
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = getWidgetCss(mode);
  const toast = createEl('div', 'etr-toast', message);

  shadow.append(style, toast);
  (document.body ?? document.documentElement).appendChild(host);

  window.setTimeout(() => {
    host.remove();
  }, 3600);
}

export function renderRecallWidget(
  prompt: ActivePrompt,
  settings: ExtensionSettings
): void {
  removeRecallWidget();

  const { card, isRetry, retryAttempt, targetConcept } = prompt;
  let activeSettings: ExtensionSettings = { ...settings };
  const themeMode: UiThemeMode = settings.themeMode === 'dark' ? 'dark' : 'light';
  lastToastThemeMode = themeMode;
  let promptDismissed = false;
  const currentHost = window.location.hostname.replace(/^www\./i, '');
  const displayHost = currentHost
    ? currentHost.charAt(0).toUpperCase() + currentHost.slice(1)
    : '';
  const ui = getUiStrings(settings.uiLanguage);
  const isTr = resolveSupportedLanguage(settings.uiLanguage) === 'tr';
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.dataset.theme = themeMode;
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = getWidgetCss(themeMode);

  const wrap = createEl('div', 'etr-wrap');
  const cardEl = createEl('div', 'etr-card');
  const detectedCardSkills = detectHelpSkillsForQuestion({
    englishText: card.en,
    cardType: card.type,
  });
  const shouldGlowTeach = hasRichTeachMeSkills(detectedCardSkills);

  const applyScheduleChange = async (
    patch: {
      intervalMinutes?: number;
      enabled?: boolean;
      pausedUntilManual?: boolean;
      clearMute?: boolean;
    },
    closeAfter: boolean,
    toastMessage: string
  ): Promise<boolean> => {
    try {
      const res = await sendBgMessage<{ ok?: boolean; settings?: ExtensionSettings }>({
        type: 'UPDATE_PROMPT_SCHEDULE',
        ...patch,
      });
      if (res?.settings) {
        activeSettings = res.settings;
      } else {
        activeSettings = {
          ...activeSettings,
          ...(patch.intervalMinutes !== undefined ? { intervalMinutes: patch.intervalMinutes } : {}),
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(patch.pausedUntilManual !== undefined ? { pausedUntilManual: patch.pausedUntilManual } : {}),
          ...(patch.clearMute ? { mutedUntil: null } : {}),
        };
      }
      if (closeAfter) {
        removeRecallWidget();
      }
      renderToast(toastMessage);
      return true;
    } catch {
      return false;
    }
  };

  const renderDismissScheduleView = (): void => {
    activeTeachCleanup?.();
    activeTeachCleanup = null;
    stopActiveRuleAudio();
    stopGuideAssistant();

    const mins = activeSettings.intervalMinutes;
    cardEl.className = 'etr-card is-dismiss-prompt';
    cardEl.replaceChildren();

    const header = createEl('div', 'etr-header etr-dismiss-header');
    const badge = createEl('span', 'etr-badge etr-dismiss-cadence-badge');
    badge.append(
      buildClockMiniSvg(11),
      document.createTextNode(isTr ? ` Şu an: Her ${mins} dk’da bir` : ` Active: Every ${mins}m`)
    );
    const closeNowBtn = createCloseIconBtn(isTr ? 'Kapat' : 'Close');
    closeNowBtn.addEventListener('click', removeRecallWidget);
    header.append(badge, closeNowBtn);

    const body = createEl('div', 'etr-dismiss-box');
    const title = createEl(
      'div',
      'etr-dismiss-title',
      isTr ? 'Sorular çok mu sık geliyor?' : 'Are questions popping up too often?'
    );
    const sub = createEl(
      'div',
      'etr-dismiss-sub',
      isTr
        ? 'Ayarlara girmeden sıklığı hemen değiştirebilir ya da otomatik soruları durdurabilirsin.'
        : 'Adjust how often cards appear, or pause automatic popups right here.'
    );

    const intervalBlock = createEl('div', 'etr-dismiss-section');
    const intervalLabel = createEl(
      'div',
      'etr-dismiss-section-label',
      isTr ? 'Soru aralığını değiştir' : 'Change interval'
    );
    const intervalGrid = createEl('div', 'etr-dismiss-intervals');
    for (const preset of QUICK_INTERVAL_PRESETS) {
      const isCurrent = preset === mins;
      const chip = createEl(
        'button',
        `etr-cadence-chip${isCurrent ? ' is-active' : ''}`,
        isTr
          ? `${preset} dk${isCurrent ? ' ✓' : ''}`
          : `${preset}m${isCurrent ? ' ✓' : ''}`
      );
      chip.type = 'button';
      if (isCurrent) {
        chip.title = isTr ? 'Şu an seçili süre' : 'Currently active interval';
      }
      chip.addEventListener('click', async () => {
        if (isCurrent) {
          removeRecallWidget();
          return;
        }
        await applyScheduleChange(
          { intervalMinutes: preset, enabled: true, pausedUntilManual: false, clearMute: true },
          true,
          isTr
            ? `Soru aralığı ${preset} dk olarak güncellendi.`
            : `Question interval updated to ${preset}m.`
        );
      });
      intervalGrid.appendChild(chip);
    }
    intervalBlock.append(intervalLabel, intervalGrid);

    const actionsStack = createEl('div', 'etr-dismiss-actions');

    const muteActionBtn = createEl('button', 'etr-dismiss-action is-mute');
    muteActionBtn.type = 'button';
    const muteIconWrap = createEl('span', 'etr-dismiss-action-icon');
    muteIconWrap.appendChild(buildBellOffMiniSvg(16));
    const muteTextWrap = createEl('span', 'etr-dismiss-action-text');
    muteTextWrap.append(
      createEl('span', 'etr-dismiss-action-title', isTr ? '1 saat sessize al' : 'Mute for 1 hour'),
      createEl(
        'span',
        'etr-dismiss-action-desc',
        isTr
          ? `1 saat soru çıkmaz, sonra tekrar her ${mins} dk’da bir devam eder.`
          : `Quiet for 1 hour, then automatically resumes every ${mins}m.`
      )
    );
    muteActionBtn.append(muteIconWrap, muteTextWrap);
    muteActionBtn.addEventListener('click', async () => {
      await sendBgMessage({ type: 'MUTE_FOR_HOURS', hours: 1 });
      removeRecallWidget();
      renderToast(isTr ? 'Otomatik sorular 1 saat sessize alındı.' : 'Auto-prompts muted for 1 hour.');
    });

    const pauseActionBtn = createEl('button', 'etr-dismiss-action is-pause');
    pauseActionBtn.type = 'button';
    const pauseIconWrap = createEl('span', 'etr-dismiss-action-icon');
    pauseIconWrap.appendChild(buildPauseCircleMiniSvg(16));
    const pauseTextWrap = createEl('span', 'etr-dismiss-action-text');
    pauseTextWrap.append(
      createEl(
        'span',
        'etr-dismiss-action-title',
        isTr ? 'Ben tekrar açana kadar otomatik soru sorma' : 'Pause auto-prompts until I reopen'
      ),
      createEl(
        'span',
        'etr-dismiss-action-desc',
        isTr
          ? `“Şimdi Sor” butonuna basana kadar durur; basınca tekrar ${mins} dk’da bir devam eder.`
          : `Stays off until you click Quick Quiz, then resumes every ${mins}m.`
      )
    );
    pauseActionBtn.append(pauseIconWrap, pauseTextWrap);
    pauseActionBtn.addEventListener('click', async () => {
      await applyScheduleChange(
        { enabled: false, pausedUntilManual: true, clearMute: true },
        true,
        isTr
          ? `Otomatik sorular durduruldu. “Şimdi Sor”a basınca ${mins} dk aralıkla devam eder.`
          : `Auto-prompts paused. Click Quick Quiz anytime to resume every ${mins}m.`
      );
    });

    actionsStack.append(muteActionBtn, pauseActionBtn);

    const footerRow = createEl('div', 'etr-dismiss-footer');
    if (currentHost) {
      const blockSiteBtn = createEl(
        'button',
        'etr-dismiss-link is-danger',
        isTr ? 'Bu sitede gösterme' : 'Disable on this site'
      );
      blockSiteBtn.type = 'button';
      blockSiteBtn.title = isTr
        ? `Eklenti artık ${displayHost} sayfasında çalışmasın`
        : `Stop running the extension on ${displayHost}`;
      blockSiteBtn.addEventListener('click', async () => {
        await sendBgMessage({ type: 'TOGGLE_BLOCK_HOST', host: currentHost });
        removeRecallWidget();
        renderToast(
          isTr
            ? `Eklenti artık ${displayHost} sayfasında çalışmayacak.`
            : `Disabled LingoEx on ${displayHost}.`,
          themeMode
        );
      });
      footerRow.appendChild(blockSiteBtn);
    }

    const keepCloseBtn = createEl(
      'button',
      'etr-dismiss-link',
      isTr ? 'Değiştirme, kapat' : 'Keep as is, close'
    );
    keepCloseBtn.type = 'button';
    keepCloseBtn.addEventListener('click', removeRecallWidget);
    footerRow.appendChild(keepCloseBtn);

    body.append(title, sub, intervalBlock, actionsStack, footerRow);
    cardEl.append(header, body);
  };

  const renderQuestionView = (): void => {
    cardEl.className = 'etr-card';
    cardEl.replaceChildren();

    const header = createEl('div', 'etr-header');
    const badges = createEl('div', 'etr-badges');

    const typeLabel =
      card.type === 'sentence'
        ? isTr
          ? 'Cümle'
          : 'Sentence'
        : card.pos || (isTr ? 'Kelime' : 'Word');
    badges.appendChild(createEl('span', 'etr-badge', `${card.level} · ${typeLabel}`));
    if (isRetry) {
      badges.appendChild(
        createEl(
          'span',
          'etr-badge retry',
          isTr ? `Tekrar #${retryAttempt}` : `Retry #${retryAttempt}`
        )
      );
    }
    if (targetConcept) {
      badges.appendChild(
        createEl('span', 'etr-badge focus', isTr ? 'Odak' : 'Focus')
      );
    }

    const headerActions = createEl('div', 'etr-header-actions');

    const cadenceBtn = createEl('button', 'etr-icon-btn etr-cadence-btn');
    cadenceBtn.type = 'button';
    const cadenceTextEl = createEl('span', 'etr-cadence-btn-label');
    const syncCadenceButton = (): void => {
      cadenceTextEl.textContent = activeSettings.enabled
        ? isTr
          ? `${activeSettings.intervalMinutes} dk`
          : `${activeSettings.intervalMinutes}m`
        : isTr
          ? 'Kapalı'
          : 'Off';
      cadenceBtn.title = isTr
        ? 'Soru sıklığını değiştir, ertele veya durdur'
        : 'Change question frequency, snooze, or pause';
    };
    syncCadenceButton();
    cadenceBtn.append(buildClockMiniSvg(12), cadenceTextEl, buildChevronDownSvg(11));

    const cadencePanel = createEl('div', 'etr-cadence-panel');
    cadencePanel.hidden = true;

    const renderCadencePanel = (): void => {
      cadencePanel.replaceChildren();
      const freqLabel = createEl(
        'div',
        'etr-cadence-label',
        isTr ? 'Otomatik soru sıklığı' : 'Auto-question interval'
      );
      const chipRow = createEl('div', 'etr-cadence-chips');
      for (const preset of QUICK_INTERVAL_PRESETS) {
        const isActive = activeSettings.enabled && activeSettings.intervalMinutes === preset;
        const chip = createEl(
          'button',
          `etr-cadence-chip${isActive ? ' is-active' : ''}`,
          isTr ? `${preset} dk` : `${preset}m`
        );
        chip.type = 'button';
        chip.addEventListener('click', async () => {
          const ok = await applyScheduleChange(
            { intervalMinutes: preset, enabled: true, pausedUntilManual: false, clearMute: true },
            false,
            isTr
              ? `Soru sıklığı ${preset} dk olarak ayarlandı.`
              : `Question interval set to ${preset}m.`
          );
          if (ok) {
            syncCadenceButton();
            cadencePanel.hidden = true;
            cadenceBtn.classList.remove('is-open');
          }
        });
        chipRow.appendChild(chip);
      }

      const pauseChip = createEl(
        'button',
        `etr-cadence-chip is-off${!activeSettings.enabled ? ' is-active' : ''}`,
        isTr ? 'Durdur' : 'Pause'
      );
      pauseChip.type = 'button';
      pauseChip.title = isTr
        ? '“Şimdi Sor”a basana kadar otomatik soru sorma'
        : 'Pause until you click Quick Quiz';
      pauseChip.addEventListener('click', async () => {
        const savedMins = activeSettings.intervalMinutes;
        await applyScheduleChange(
          { enabled: false, pausedUntilManual: true, clearMute: true },
          true,
          isTr
            ? `Otomatik sorular durduruldu. “Şimdi Sor”a basınca ${savedMins} dk aralıkla devam eder.`
            : `Auto-prompts paused. Click Quick Quiz to resume every ${savedMins}m.`
        );
      });
      chipRow.appendChild(pauseChip);

      const quickRow = createEl('div', 'etr-cadence-quick-row');
      const snooze5Btn = createEl(
        'button',
        'etr-cadence-quick-btn',
        isTr ? '5 dk ertele' : 'Snooze 5m'
      );
      snooze5Btn.type = 'button';
      snooze5Btn.addEventListener('click', async () => {
        await sendBgMessage({ type: 'SNOOZE_PROMPT', minutes: 5 });
        removeRecallWidget();
        renderToast(isTr ? '5 dakika ertelendi.' : 'Snoozed for 5 minutes.');
      });

      const mute1hBtn = createEl(
        'button',
        'etr-cadence-quick-btn',
        isTr ? '1 saat sessiz' : 'Mute 1h'
      );
      mute1hBtn.type = 'button';
      mute1hBtn.addEventListener('click', async () => {
        await sendBgMessage({ type: 'MUTE_FOR_HOURS', hours: 1 });
        removeRecallWidget();
        renderToast(isTr ? '1 saat sessize alındı.' : 'Muted for 1 hour.');
      });

      quickRow.append(snooze5Btn, mute1hBtn);

      if (currentHost) {
        const blockBtn = createEl(
          'button',
          'etr-cadence-quick-btn is-danger',
          isTr ? 'Bu sitede kapat' : 'Block site'
        );
        blockBtn.type = 'button';
        blockBtn.title = isTr
          ? `Eklenti artık ${displayHost} sayfasında çalışmasın`
          : `Stop running the extension on ${displayHost}`;
        blockBtn.addEventListener('click', async () => {
          await sendBgMessage({ type: 'TOGGLE_BLOCK_HOST', host: currentHost });
          removeRecallWidget();
          renderToast(
            isTr
              ? `Eklenti artık ${displayHost} sayfasında çalışmayacak.`
              : `Disabled LingoEx on ${displayHost}.`,
            themeMode
          );
        });
        quickRow.appendChild(blockBtn);
      }

      cadencePanel.append(freqLabel, chipRow, quickRow);
    };

    cadenceBtn.addEventListener('click', () => {
      const opening = cadencePanel.hidden;
      if (opening) {
        renderCadencePanel();
      }
      cadencePanel.hidden = !opening;
      cadenceBtn.classList.toggle('is-open', opening);
    });

    const closeBtn = createCloseIconBtn(isTr ? 'Kapat' : 'Dismiss');
    closeBtn.addEventListener('click', async () => {
      promptDismissed = true;
      await sendBgMessage({ type: 'DISMISS_PROMPT', cardId: card.id });
      if (activeSettings.enabled) {
        renderDismissScheduleView();
      } else {
        removeRecallWidget();
      }
    });

    headerActions.append(cadenceBtn, closeBtn);
    header.append(badges, headerActions);

    const promptRow = createEl('div', 'etr-prompt-row');
    const enEl = createEl(
      'div',
      card.type === 'sentence' ? 'etr-en is-sentence' : 'etr-en',
      card.en
    );
    enEl.dataset.wordLang = 'en';
    const speakBtn = createEl('button', 'etr-icon-btn', '▶');
    speakBtn.type = 'button';
    speakBtn.title = isTr ? 'Sesli oku' : 'Pronounce aloud';
    speakBtn.addEventListener('click', () => speakEnglish(card.en));
    promptRow.append(enEl, speakBtn);

    cardEl.append(header, cadencePanel, promptRow);

    if (card.phonetic) {
      cardEl.appendChild(createEl('div', 'etr-phonetic', card.phonetic));
    }

    const form = createEl('form', 'etr-form');
    const input = createEl('input', 'etr-input');
    input.type = 'text';
    input.placeholder = isTr ? 'Türkçe anlamını yazın...' : 'Type the Turkish meaning...';
    input.autocomplete = 'off';
    input.spellcheck = false;
    isolateKeyboardEvents(input);

    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        await sendBgMessage({ type: 'DISMISS_PROMPT', cardId: card.id });
        removeRecallWidget();
      }
    });

    const actions = createEl('div', 'etr-actions');
    const qTeachBtn = createEl(
      'button',
      `etr-btn etr-btn-teach${shouldGlowTeach ? ' is-glow' : ''}`
    );
    setIconLabel(qTeachBtn, 'headphones', isTr ? 'Bana Öğret' : 'Teach Me', 13);
    qTeachBtn.type = 'button';
    qTeachBtn.title = isTr
      ? 'Bu cümledeki gramer kurallarını sesli ve yazılı dinle (API bağlıysa canlı AI + EMA)'
      : 'Listen & read grammar rules inside this sentence';

    const dontKnowBtn = createEl('button', 'etr-btn etr-btn-ghost', ui.dontKnow);
    dontKnowBtn.type = 'button';

    const submitBtn = createEl('button', 'etr-btn etr-btn-primary', ui.checkAnswer);
    submitBtn.type = 'submit';

    actions.append(qTeachBtn, dontKnowBtn, submitBtn);
    form.append(input, actions);
    cardEl.appendChild(form);

    const qTeachHost = createEl('div', 'etr-teach-host-question');
    qTeachHost.hidden = true;
    let qTeachCtrl: ReturnType<typeof buildInlineTeachMePanel> | null = null;
    const setQuestionTeachOpen = async (open: boolean): Promise<void> => {
      qTeachHost.hidden = !open;
      qTeachBtn.classList.toggle('is-open', open);
      if (open && !qTeachCtrl) {
        const useAi = await isAiApiConfigured();
        if (qTeachHost.hidden) return;
        qTeachCtrl = buildInlineTeachMePanel({
          detectedSkills: detectedCardSkills,
          isTr,
          sentenceEn: card.en,
          meaningTr: card.acceptedTr.join(', '),
          uiLanguage: settings.uiLanguage,
          initialAiMode: useAi,
          guideHost: wrap,
          onClose: () => void setQuestionTeachOpen(false),
          onSkillChange: (skill) => renderHighlightedSentence(enEl, card.en, skill, 'etr-rule-glow'),
          onFocusPhrase: (phrase) => renderHighlightedPhrase(enEl, card.en, phrase, 'etr-rule-glow is-ai'),
        });
        activeTeachCleanup = qTeachCtrl.dispose;
        qTeachHost.appendChild(qTeachCtrl.element);
      } else if (open && qTeachCtrl) {
        if (qTeachCtrl.isAiMode()) {
          renderHighlightedPhrase(enEl, card.en, qTeachCtrl.getActiveFocusPhrase(), 'etr-rule-glow is-ai');
        } else {
          renderHighlightedSentence(enEl, card.en, qTeachCtrl.getSelectedSkill(), 'etr-rule-glow');
        }
      } else if (!open) {
        renderHighlightedSentence(enEl, card.en, null);
        stopActiveRuleAudio();
        stopGuideAssistant();
      }
    };
    qTeachBtn.addEventListener('click', () => {
      void setQuestionTeachOpen(qTeachHost.hidden);
    });
    cardEl.appendChild(qTeachHost);

    const errorLine = createEl('div', 'etr-repeat-note');
    errorLine.hidden = true;
    cardEl.appendChild(errorLine);

    let submitting = false;

    const handleSubmit = async (): Promise<void> => {
      if (submitting) return;
      const val = input.value.trim();
      if (!val) {
        input.focus();
        return;
      }
      submitting = true;
      errorLine.hidden = true;
      submitBtn.disabled = true;
      submitBtn.textContent = isTr ? 'Kontrol ediliyor...' : 'Checking...';
      try {
        const res = await sendBgMessage<{
          ok: boolean;
          result?: AnswerOutcomeResult;
          error?: string;
        }>({
          type: 'SUBMIT_ANSWER',
          cardId: card.id,
          userAnswer: val,
          card,
        });
        if (res?.ok && res.result) {
          renderOutcomeView(val, res.result);
          return;
        }
        errorLine.hidden = false;
        errorLine.textContent = res?.error ?? 'Could not reach background service.';
      } catch (err) {
        errorLine.hidden = false;
        errorLine.textContent = `Extension reloaded — press F5 to refresh this tab (${
          err instanceof Error ? err.message : 'disconnected'
        }).`;
      }
      submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = ui.checkAnswer;
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void handleSubmit();
    });

    dontKnowBtn.addEventListener('click', async () => {
      if (submitting) return;
      submitting = true;
      dontKnowBtn.disabled = true;
      const res = await sendBgMessage<{ ok: boolean; result?: AnswerOutcomeResult }>({
        type: 'MARK_DONT_KNOW',
        cardId: card.id,
        card,
      });
      if (res?.ok && res.result) {
        renderOutcomeView('', res.result);
      }
    });

    if (settings.autoSpeak) {
      speakEnglish(card.en);
    }
  };

  const renderOutcomeView = (userAnswer: string, outcome: AnswerOutcomeResult): void => {
    activeTeachCleanup?.();
    activeTeachCleanup = null;
    stopActiveRuleAudio();
    stopGuideAssistant();
    const isCorrect = outcome.evaluation.isCorrect;
    if (isCorrect) {
      playCorrectSfx();
    } else {
      playWrongSfx();
    }
    cardEl.className = `etr-card ${isCorrect ? 'state-correct' : 'state-wrong'}`;
    cardEl.replaceChildren();

    const header = createEl('div', 'etr-header');
    const badges = createEl('div', 'etr-badges');
    badges.appendChild(
      createEl(
        'span',
        `etr-badge ${isCorrect ? 'correct' : 'wrong'}`,
        isCorrect ? (isTr ? '✓ Doğru!' : '✓ Correct!') : isTr ? '✕ Yanlış' : '✕ Incorrect'
      )
    );
    badges.appendChild(createEl('span', 'etr-badge', card.level));
    if (outcome.evaluation.aiStatus === 'used' || outcome.evaluation.matchKind === 'ai') {
      const aiLabel = `AI${outcome.evaluation.aiProviderIndex ?? 1}`;
      badges.appendChild(createEl('span', 'etr-badge ai', aiLabel));
    } else if (outcome.evaluation.aiStatus === 'error') {
      badges.appendChild(createEl('span', 'etr-badge wrong', isTr ? 'AI Hatası' : 'AI Error'));
    }

    const headerActions = createEl('div', 'etr-header-actions');
    const speakBtn = createEl('button', 'etr-icon-btn', '▶');
    speakBtn.type = 'button';
    speakBtn.title = isTr ? 'Sesli oku' : 'Pronounce aloud';
    speakBtn.addEventListener('click', () => speakEnglish(card.en));

    const closeBtn = createCloseIconBtn(isTr ? 'Kapat' : 'Close');
    closeBtn.addEventListener('click', removeRecallWidget);

    headerActions.append(speakBtn, closeBtn);
    header.append(badges, headerActions);

    const enEl = createEl(
      'div',
      card.type === 'sentence' ? 'etr-en is-sentence' : 'etr-en',
      card.en
    );
    enEl.dataset.wordLang = 'en';

    const feedbackBox = createEl('div', 'etr-feedback-box');

    if (userAnswer) {
      const userBubble = createEl(
        'div',
        `etr-bubble ${isCorrect ? 'etr-bubble-good' : 'etr-bubble-bad'}`
      );
      userBubble.appendChild(
        createEl(
          'span',
          'etr-bubble-label',
          isCorrect
            ? isTr
              ? '✓ Senin Cevabın'
              : '✓ Your Answer'
            : isTr
              ? '✕ Senin Cevabın'
              : '✕ Your Answer'
        )
      );
      userBubble.appendChild(createEl('div', undefined, userAnswer));
      feedbackBox.appendChild(userBubble);
    }

    const displayMeanings = extractDisplayMeanings(card.acceptedTr, card.type);
    const ansBubble = createEl(
      'div',
      isCorrect ? 'etr-bubble etr-bubble-ref' : 'etr-bubble etr-bubble-good'
    );
    ansBubble.appendChild(
      createEl(
        'span',
        'etr-bubble-label',
        isCorrect
          ? isTr
            ? displayMeanings.alternatives.length > 0
              ? 'Kabul Edilen Anlamlar'
              : 'Kabul Edilen Anlam'
            : displayMeanings.alternatives.length > 0
              ? 'Accepted Meanings'
              : 'Accepted Meaning'
          : isTr
            ? '✓ Doğru Anlam'
            : '✓ Correct Meaning'
      )
    );

    const primaryMeaningEl = createEl('div', 'etr-ans-primary', displayMeanings.primary);
    primaryMeaningEl.dataset.wordLang = 'tr';
    ansBubble.appendChild(primaryMeaningEl);

    if (displayMeanings.alternatives.length > 0) {
      if (card.type === 'word') {
        const chipsWrap = createEl('div', 'etr-meaning-chips');
        chipsWrap.dataset.wordLang = 'tr';
        for (const alt of displayMeanings.alternatives) {
          const chip = createEl('span', 'etr-meaning-chip', alt);
          chip.dataset.wordLang = 'tr';
          chipsWrap.appendChild(chip);
        }
        ansBubble.appendChild(chipsWrap);
      } else {
        const altBlock = createEl('div', 'etr-alt-block');
        altBlock.dataset.wordLang = 'tr';
        const altLabel = createEl(
          'span',
          'etr-alt-label',
          isTr
            ? displayMeanings.alternatives.length > 1
              ? 'Alternatif çeviriler'
              : 'Alternatif çeviri'
            : displayMeanings.alternatives.length > 1
              ? 'Alternative translations'
              : 'Alternative translation'
        );
        const altList = createEl('div', 'etr-alt-list');
        for (const alt of displayMeanings.alternatives) {
          const row = createEl('div', 'etr-alt-item');
          const dot = createEl('span', 'etr-alt-dot', '•');
          const txt = createEl('span', undefined, alt);
          txt.dataset.wordLang = 'tr';
          row.append(dot, txt);
          altList.appendChild(row);
        }
        altBlock.append(altLabel, altList);
        ansBubble.appendChild(altBlock);
      }
    }
    feedbackBox.appendChild(ansBubble);

    const lowerDetails = createEl('div', 'etr-lower-details');

    if (outcome.evaluation.aiNote) {
      const aiBubble = createEl(
        'div',
        outcome.evaluation.aiStatus === 'error'
          ? 'etr-bubble etr-bubble-bad'
          : 'etr-bubble etr-bubble-ai'
      );
      aiBubble.appendChild(
        createEl(
          'span',
          'etr-bubble-label',
          outcome.evaluation.aiStatus === 'error'
            ? isTr
              ? 'AI Durumu'
              : 'AI Status'
            : isTr
              ? 'AI Değerlendirmesi'
              : 'AI Evaluation'
        )
      );
      aiBubble.appendChild(createEl('div', undefined, outcome.evaluation.aiNote));
      lowerDetails.appendChild(aiBubble);
    } else if (!isCorrect && outcome.evaluation.aiStatus === 'disabled') {
      const aiHint = createEl('div', 'etr-bubble etr-bubble-muted');
      aiHint.appendChild(
        createEl(
          'span',
          'etr-bubble-label',
          isTr ? 'AI Değerlendirmesi' : 'AI Evaluation'
        )
      );
      aiHint.appendChild(
        createEl(
          'div',
          undefined,
          isTr
            ? 'AI değerlendirmesi kapalı (Ayarlar → AI - API Ayarları kısmından etkinleştirebilirsiniz).'
            : 'AI evaluation is disabled (enable it under AI - API Keys for smart paraphrase checks).'
        )
      );
      lowerDetails.appendChild(aiHint);
    }

    if (
      card.type === 'word' &&
      card.exampleEn &&
      card.exampleEn.trim().toLowerCase() !== card.en.trim().toLowerCase()
    ) {
      const exDiv = createEl('div', 'etr-example');
      const exEnEl = createEl('div', undefined, `"${card.exampleEn}"`);
      exEnEl.dataset.wordLang = 'en';
      exDiv.appendChild(exEnEl);
      if (card.exampleTr) {
        const exTrEl = createEl('div', 'etr-example-tr', card.exampleTr);
        exTrEl.dataset.wordLang = 'tr';
        exDiv.appendChild(exTrEl);
      }
      lowerDetails.appendChild(exDiv);
    }

    const localizedRepeat = isTr
      ? outcome.nextRepeatLabel
          .replace(/^Retry in (\d+) min$/i, '$1 dk sonra tekrar')
          .replace(/^Next review in (\d+)d$/i, '$1 gün sonra tekrar')
          .replace(/^Next review in (\d+)h$/i, '$1 saat sonra tekrar')
          .replace(/^In (\d+) days?$/i, '$1 gün sonra tekrar')
          .replace(/^In (\d+) hours?$/i, '$1 saat sonra tekrar')
          .replace(/^Next review tomorrow$/i, 'Yarın tekrar')
          .replace(/^Tomorrow$/i, 'Yarın')
      : outcome.nextRepeatLabel;

    const deltaSign = outcome.ratingDelta >= 0 ? `+${outcome.ratingDelta}` : String(outcome.ratingDelta);
    const repeatNote = createEl(
      'div',
      `etr-repeat-note ${isCorrect ? 'ok' : ''}`,
      `${localizedRepeat} · ${outcome.newRating} ${deltaSign} · ${outcome.estimatedLevel}`
    );

    const conceptSlot = createEl('div');
    const renderConceptBanner = (
      concept: Pick<ConceptNote, 'label' | 'explanation'> & { sourceEn?: string },
      progressText?: string,
      includeExplanation: boolean = true
    ): void => {
      conceptSlot.replaceChildren();
      const box = createEl('div', 'etr-concept-box');
      box.appendChild(createEl('div', 'etr-concept-title', concept.label));
      const cleanExplanation = includeExplanation
        ? sanitizeConceptExplanationForCard(concept.explanation, concept.sourceEn, card.en)
        : '';
      if (cleanExplanation) {
        box.appendChild(createEl('div', undefined, cleanExplanation));
      }
      let displayProgress = progressText;
      if (displayProgress) {
        const addedMatch = displayProgress.match(
          /^(?:📌\s*)?"(.+)" added to focus list \(next check in (\d+) questions\)\.$/
        );
        const queuedMatch = displayProgress.match(
          /^(?:🔁\s*)?"(.+)" queued again \(next check in (\d+) questions\)\.$/
        );
        const stageMatch = displayProgress.match(
          /^(?:🎯\s*)?"(.+)" cleared Stage (\d+) \(next check in (\d+) questions\)\.$/
        );
        const stageFinalMatch = displayProgress.match(
          /^(?:⏳\s*)?"(.+)" cleared Stage (\d+) [–—-] final retention test in (\d+) questions!$/
        );
        const masteredMatch = displayProgress.match(
          /^(?:[✅🏆]\s*)?"(.+)" (?:mastered|passed the \+10 question retention check and is mastered)/i
        );
        if (isTr) {
          if (addedMatch) {
            displayProgress = `"${addedMatch[1]}" odak listesine eklendi (${addedMatch[2]} soru sonra tekrar).`;
          } else if (queuedMatch) {
            displayProgress = `"${queuedMatch[1]}" tekrar sıraya alındı (${queuedMatch[2]} soru sonra tekrar).`;
          } else if (stageFinalMatch) {
            displayProgress = `"${stageFinalMatch[1]}" ${stageFinalMatch[2]}. aşamayı geçti (${stageFinalMatch[3]} soru sonra son kalıcılık testi).`;
          } else if (stageMatch) {
            displayProgress = `"${stageMatch[1]}" ${stageMatch[2]}. aşamayı geçti (${stageMatch[3]} soru sonra tekrar).`;
          } else if (masteredMatch) {
            displayProgress = `"${masteredMatch[1]}" odak hedefi tamamlandı.`;
          }
        } else {
          displayProgress = displayProgress.replace(/^[📌🔁🎯⏳🏆✅]\s*/, '');
        }
      }
      box.appendChild(
        createEl(
          'div',
          'etr-concept-stage',
          displayProgress ??
            (isTr
              ? 'Odak listesine eklendi · +2, +4 ve +10 soruda tekrar'
              : 'Added to Focus · reviewed in +2, +4, +10 questions')
        )
      );
      conceptSlot.appendChild(box);
    };

    if (outcome.recordedConcept) {
      // On a passed scheduled review (no new weakPoint triggered), hide stale past-mistake text
      const isCleanReinforcementPass =
        isCorrect && !outcome.evaluation.weakPoint && Boolean(targetConcept);
      renderConceptBanner(
        outcome.recordedConcept,
        outcome.conceptProgressNote,
        !isCleanReinforcementPass
      );
    } else if (targetConcept && outcome.conceptProgressNote) {
      renderConceptBanner(targetConcept, outcome.conceptProgressNote, !isCorrect);
    }

    // Instant AI Tutor Q&A panel on Recall card
    const askAiPanel = createEl('div', 'etr-flag-panel etr-ask-panel');
    askAiPanel.hidden = true;

    const askAiHead = createEl('div', 'etr-ask-head');
    const askAiLabel = createEl(
      'span',
      'etr-label',
      isTr ? 'AI Öğretmene Sor:' : 'Ask AI Tutor:'
    );
    askAiHead.append(askAiLabel);

    const askAiHistory: Array<{ role: 'user' | 'assistant'; text: string }> = [];
    const askAiOutput = createEl('div', 'etr-ask-output');
    askAiOutput.hidden = true;

    const askAiInput = createEl('input', 'etr-input-sm');
    askAiInput.type = 'text';
    askAiInput.placeholder = isTr
      ? 'Örn: Neden "run" kullanılıyor, koşmak değil mi?'
      : 'e.g. Why is this word used here?';
    isolateKeyboardEvents(askAiInput);

    const askAiSendBtn = createEl(
      'button',
      'etr-btn etr-btn-ai-solid',
      isTr ? 'Sor' : 'Ask'
    );
    askAiSendBtn.type = 'button';

    const submitAskAi = async (): Promise<void> => {
      const q = askAiInput.value.trim();
      if (!q) {
        askAiInput.focus();
        return;
      }
      askAiSendBtn.disabled = true;
      askAiSendBtn.textContent = '...';
      askAiOutput.hidden = false;
      askAiOutput.textContent = isTr ? 'AI düşünüyor...' : 'Thinking...';
      const prevHist = [...askAiHistory];
      askAiHistory.push({ role: 'user', text: q });
      const res = await sendBgMessage<{
        ok: boolean;
        answer?: string;
        error?: string;
      }>({
        type: 'ASK_AI_TUTOR',
        question: q,
        history: prevHist,
        context: {
          sentenceEn: card.en,
          meaningTr: card.acceptedTr.join(', '),
          userAnswer: userAnswer || undefined,
          expectedAnswer: card.acceptedTr[0],
          existingExplanation: outcome.evaluation.aiNote,
        },
      });
      askAiSendBtn.disabled = false;
      askAiSendBtn.textContent = isTr ? 'Sor' : 'Ask';
      if (res?.ok && res.answer) {
        askAiHistory.push({ role: 'assistant', text: res.answer });
        askAiInput.value = '';
        askAiOutput.textContent = res.answer;
      } else {
        askAiHistory.pop();
        askAiOutput.textContent =
          res?.error ||
          (isTr
            ? 'AI şu an yanıt veremedi (Ayarlar → AI bölümünden ücretsiz anahtar eklenebilir).'
            : 'AI unavailable right now (enable AI in Settings).');
      }
    };

    askAiSendBtn.addEventListener('click', () => void submitAskAi());
    askAiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void submitAskAi();
      }
    });

    const askAiRow = createEl('div', 'etr-flag-row');
    askAiRow.append(askAiInput, askAiSendBtn);
    askAiPanel.append(askAiHead, askAiOutput, askAiRow);

    const outcomeTeachHost = createEl('div', 'etr-teach-host-outcome');
    outcomeTeachHost.hidden = true;
    let outcomeTeachCtrl: ReturnType<typeof buildInlineTeachMePanel> | null = null;

    lowerDetails.append(repeatNote, conceptSlot, askAiPanel);

    const lowerStage = createEl('div', 'etr-lower-stage');
    lowerStage.append(lowerDetails, outcomeTeachHost);

    cardEl.append(header, enEl, feedbackBox, lowerStage);

    const footer = createEl('div', 'etr-outcome-footer');
    const nextBtn = createEl('button', 'etr-btn etr-btn-next', ui.nextQuestion);
    nextBtn.type = 'button';
    nextBtn.addEventListener('click', async () => {
      nextBtn.disabled = true;
      nextBtn.textContent = '...';
      await sendBgMessage({ type: 'TRIGGER_NOW' });
    });

    const secondaryRow = createEl('div', 'etr-outcome-secondary');

    const teachOutcomeBtn = createEl(
      'button',
      `etr-btn etr-btn-teach${shouldGlowTeach ? ' is-glow' : ''}`
    );
    setIconLabel(teachOutcomeBtn, 'headphones', isTr ? 'Bana Öğret' : 'Teach Me', 13);
    teachOutcomeBtn.type = 'button';
    teachOutcomeBtn.title = isTr
      ? 'Bu cümledeki kuralları sesli ve yazılı dinle (API bağlıysa canlı AI + EMA)'
      : 'Listen & read rules in this sentence';

    const setOutcomeTeachOpen = async (open: boolean): Promise<void> => {
      outcomeTeachHost.hidden = !open;
      lowerDetails.hidden = open;
      teachOutcomeBtn.classList.toggle('is-open', open);
      if (open) {
        askAiPanel.hidden = true;
        if (!outcomeTeachCtrl) {
          const useAi = await isAiApiConfigured();
          if (outcomeTeachHost.hidden) return;
          outcomeTeachCtrl = buildInlineTeachMePanel({
            detectedSkills: detectedCardSkills,
            isTr,
            sentenceEn: card.en,
            meaningTr: card.acceptedTr.join(', '),
            uiLanguage: settings.uiLanguage,
            initialAiMode: useAi,
            guideHost: wrap,
            onClose: () => void setOutcomeTeachOpen(false),
            onSkillChange: (skill) => renderHighlightedSentence(enEl, card.en, skill, 'etr-rule-glow'),
            onFocusPhrase: (phrase) => renderHighlightedPhrase(enEl, card.en, phrase, 'etr-rule-glow is-ai'),
          });
          activeTeachCleanup = outcomeTeachCtrl.dispose;
          outcomeTeachHost.appendChild(outcomeTeachCtrl.element);
        } else if (outcomeTeachCtrl.isAiMode()) {
          renderHighlightedPhrase(enEl, card.en, outcomeTeachCtrl.getActiveFocusPhrase(), 'etr-rule-glow is-ai');
        } else {
          renderHighlightedSentence(enEl, card.en, outcomeTeachCtrl.getSelectedSkill(), 'etr-rule-glow');
        }
      } else {
        renderHighlightedSentence(enEl, card.en, null);
        stopActiveRuleAudio();
        stopGuideAssistant();
      }
    };

    teachOutcomeBtn.addEventListener('click', () => {
      void setOutcomeTeachOpen(outcomeTeachHost.hidden);
    });

    const askAiToggleBtn = createEl(
      'button',
      'etr-btn etr-btn-ai'
    );
    setIconLabel(askAiToggleBtn, 'message', isTr ? 'AI’a Sor' : 'Ask AI', 13);
    askAiToggleBtn.type = 'button';
    askAiToggleBtn.title = isTr
      ? 'Bu cümle hakkında yapay zekâya soru sor'
      : 'Ask the AI tutor about this card';
    askAiToggleBtn.addEventListener('click', () => {
      void setOutcomeTeachOpen(false);
      askAiPanel.hidden = !askAiPanel.hidden;
      if (!askAiPanel.hidden) {
        askAiPanel.scrollIntoView({ block: 'nearest' });
        askAiInput.focus();
      }
    });

    secondaryRow.append(teachOutcomeBtn, askAiToggleBtn);
    footer.append(secondaryRow, nextBtn);
    cardEl.appendChild(footer);
  };

  renderQuestionView();
  escapeKeyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (!promptDismissed) {
        promptDismissed = true;
        void sendBgMessage({ type: 'DISMISS_PROMPT', cardId: card.id });
      }
      removeRecallWidget();
    }
  };
  window.addEventListener('keydown', escapeKeyHandler);

  wrap.appendChild(cardEl);
  shadow.append(style, wrap);
  activeWordTooltip = installWordHoverTooltip({
    root: shadow,
    delayMs: 1500,
    lookupWord: lookupOfflineWordFromBackground,
  });
  (document.body ?? document.documentElement).appendChild(host);
}
