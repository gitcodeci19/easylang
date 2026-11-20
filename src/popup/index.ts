import { ratingToCefrProgress } from '../shared/analytics';
import {
  ASSISTANT_GUIDE_LABELS,
  type AssistantGuideId,
  playGuideAssistant,
  playGuideOnce,
  stopGuideAssistant,
  toggleGuideAssistant,
} from '../shared/guideAssistant';
import { getUiStrings, resolveSupportedLanguage } from '../shared/i18n';
import {
  buildOfflineDictionaryIndex,
  lookupOfflineWord,
  type OfflineDictionaryIndex,
} from '../shared/offlineDictionary';
import { RoadmapController } from '../shared/roadmapView';
import { isUrlBlocked } from '../shared/siteFilter';
import {
  getAiConfig,
  getAllCards,
  getSettings,
  saveAiConfig,
  saveSettings,
} from '../shared/storage';
import type {
  Card,
  ExtensionMessage,
  FeedbackLanguageMode,
  StatusSnapshot,
} from '../shared/types';
import { installWordHoverTooltip } from '../shared/wordHoverTooltip';

const enabledToggle = document.getElementById('enabled-toggle') as HTMLInputElement;
const popupLangSelect = document.getElementById('popup-lang-select') as HTMLSelectElement;
const countdownText = document.getElementById('countdown-text') as HTMLElement;
const rankChip = document.getElementById('rank-chip') as HTMLElement;
const miniTelemetry = document.getElementById('mini-telemetry') as HTMLElement;

const muteHourBtn = document.getElementById('mute-hour-btn') as HTMLButtonElement;
const toggleBlockSiteBtn = document.getElementById('toggle-block-site-btn') as HTMLButtonElement;
const openOptionsBtn = document.getElementById('open-options-btn') as HTMLButtonElement;

const roadmapMount = document.getElementById('popup-roadmap-mount') as HTMLElement;

const triggerNowBtn = document.getElementById('trigger-now-btn') as HTMLButtonElement;
const triggerNowLabel = document.getElementById('trigger-now-label') as HTMLElement;
const pageQuizBtn = document.getElementById('page-quiz-btn') as HTMLButtonElement;
const pageQuizLabel = document.getElementById('page-quiz-label') as HTMLElement;
const listeningQuizBtn = document.getElementById('listening-quiz-btn') as HTMLButtonElement;
const listeningQuizLabel = document.getElementById('listening-quiz-label') as HTMLElement;
const popupFeedback = document.getElementById('popup-feedback') as HTMLElement;

import {
  applyB1PromotionDecision,
  buildInitialProfileForOnboarding,
  getBackupNudgeSnoozeTimestamp,
  getOnboardingCopy,
  shouldShowB1ReadinessPrompt,
  shouldShowBackupNudge,
  type OnboardingCopy,
} from '../shared/onboarding';
import {
  exportFullBackupJson,
  getAiConfig as obGetAiConfig,
  getOnboardingState,
  getRoadmapState as obGetRoadmapState,
  getSettings as obGetSettings,
  getSkillProfile as obGetSkillProfile,
  restoreFromBackupText,
  saveAiConfig as obSaveAiConfig,
  saveOnboardingState,
  saveSettings as obSaveSettings,
  saveSkillProfile as obSaveSkillProfile,
} from '../shared/storage';
import { resolveSupportedLanguage as obResolveSupportedLang } from '../shared/i18n';
import type {
  CefrLevel as ObCefrLevel,
  ExtensionMessage as ObExtensionMessage,
  FeedbackLanguageMode as ObFeedbackLang,
} from '../shared/types';

let currentStatus: StatusSnapshot | null = null;
let currentActiveTab: chrome.tabs.Tab | null = null;

const roadmapController = new RoadmapController({
  container: roadmapMount,
  uiLanguage: 'auto',
  onStateUpdated: () => {
    void fetchStatus();
  },
});

function isTurkishUi(status?: StatusSnapshot | null): boolean {
  return resolveSupportedLanguage(status?.settings.uiLanguage ?? 'auto') === 'tr';
}

function formatRemaining(ms: number, isTr: boolean): string {
  if (ms <= 0) return isTr ? 'Hazır' : 'Ready';
  const totalSec = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function updateCurrentTabBlockButton(status: StatusSnapshot, isTr: boolean): void {
  const url = currentActiveTab?.url;
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    toggleBlockSiteBtn.hidden = true;
    return;
  }

  let hostname = '';
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    toggleBlockSiteBtn.hidden = true;
    return;
  }

  const blocked = isUrlBlocked(url, status.settings.blockedDomains);
  toggleBlockSiteBtn.hidden = false;
  toggleBlockSiteBtn.classList.toggle('is-blocked', blocked);
  toggleBlockSiteBtn.title = blocked
    ? isTr
      ? `${hostname} üzerinde yeniden etkinleştir`
      : `Re-enable on ${hostname}`
    : isTr
      ? `${hostname} üzerinde çalıştırma`
      : `Disable on ${hostname}`;
}

function renderStatus(status: StatusSnapshot): void {
  currentStatus = status;
  enabledToggle.checked = status.settings.enabled;
  const langMode = status.settings.uiLanguage ?? 'auto';
  popupLangSelect.value = langMode;
  const ui = getUiStrings(langMode);
  const isTr = isTurkishUi(status);

  triggerNowLabel.textContent = isTr ? 'Şimdi Sor' : 'Quick Quiz';
  pageQuizLabel.textContent = 'Challenge';
  listeningQuizLabel.textContent = isTr ? 'Dinle & Yaz' : 'Listen & Type';

  const cefr = ratingToCefrProgress(status.skillProfile.rating);
  rankChip.textContent = `${cefr.level} · ${status.skillProfile.rating}`;
  rankChip.title = isTr
    ? `20dk & Canlı Kart Recall ELO Seviyeniz: ${cefr.level} (${status.skillProfile.rating} ELO) · Seri: ${status.skillProfile.currentStreak}`
    : `20m & Live Prompt Recall Elo: ${cefr.level} (${status.skillProfile.rating} ELO) · Streak: ${status.skillProfile.currentStreak}`;

  miniTelemetry.textContent = `${status.dailyStats.correct}✓ · ${status.masteredCount}★`;
  miniTelemetry.title = isTr
    ? `Bugün ${status.dailyStats.correct} doğru, ${status.dailyStats.wrong} yanlış · ${status.retryQueueCount} tekrar kuyruğu · ${status.masteredCount} öğrenilen`
    : `Today ${status.dailyStats.correct} correct, ${status.dailyStats.wrong} missed · ${status.retryQueueCount} retry queue · ${status.masteredCount} mastered`;

  const isMuted =
    status.settings.mutedUntil !== null && status.settings.mutedUntil > Date.now();

  muteHourBtn.classList.toggle('is-active', isMuted);
  if (isMuted && status.settings.mutedUntil) {
    const minsLeft = Math.max(1, Math.ceil((status.settings.mutedUntil - Date.now()) / 60_000));
    countdownText.textContent = isTr ? `Sessiz ${minsLeft}dk` : `Muted ${minsLeft}m`;
    muteHourBtn.title = `${ui.unmuteBtn} (${minsLeft}m)`;
  } else {
    muteHourBtn.title = ui.muteHourBtn;
    if (!status.settings.enabled) {
      countdownText.textContent = isTr ? 'Manuel' : 'Manual';
    } else if (status.hasPendingPrompt) {
      countdownText.textContent = isTr ? 'Hazır' : 'Ready';
    } else if (status.nextAlarmAt) {
      countdownText.textContent = formatRemaining(status.nextAlarmAt - Date.now(), isTr);
    } else {
      countdownText.textContent = `${status.settings.intervalMinutes}m`;
    }
  }

  openOptionsBtn.title = ui.settingsAiBtn;
  updateCurrentTabBlockButton(status, isTr);
  syncStaticGuideTooltips(isTr);
}

function syncStaticGuideTooltips(isTr: boolean): void {
  document.querySelectorAll<HTMLButtonElement>('.el-help-trigger[data-guide-id]').forEach((btn) => {
    const gid = btn.dataset.guideId as AssistantGuideId | undefined;
    if (!gid || !(gid in ASSISTANT_GUIDE_LABELS)) return;
    const meta = ASSISTANT_GUIDE_LABELS[gid];
    btn.title = isTr
      ? `${meta.tr} (Sesli anlatım · Durdurmak için tekrar tıkla)`
      : `${meta.en} (Voice guide · Click again to stop)`;
  });
}

document.querySelectorAll<HTMLButtonElement>('.el-help-trigger[data-guide-id]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const gid = btn.dataset.guideId as AssistantGuideId | undefined;
    if (!gid || !(gid in ASSISTANT_GUIDE_LABELS)) return;
    toggleGuideAssistant(gid, {
      isTr: isTurkishUi(currentStatus),
      triggerEl: btn,
    });
  });
});

window.addEventListener('pagehide', () => stopGuideAssistant());
window.addEventListener('beforeunload', () => stopGuideAssistant());

async function fetchStatus(): Promise<void> {
  const [tabs, res, settings, ai] = await Promise.all([
    chrome.tabs.query({ active: true, currentWindow: true }),
    chrome.runtime.sendMessage({ type: 'GET_STATUS' } satisfies ExtensionMessage) as Promise<{
      ok: boolean;
      status?: StatusSnapshot;
    }>,
    getSettings(),
    getAiConfig(),
  ]);
  void refreshPopupNotices();
  currentActiveTab = tabs[0] ?? null;

  const effectiveLang =
    settings.uiLanguage && settings.uiLanguage !== 'auto'
      ? settings.uiLanguage
      : ai.feedbackLanguage && ai.feedbackLanguage !== 'auto'
        ? ai.feedbackLanguage
        : settings.uiLanguage ?? ai.feedbackLanguage ?? 'auto';

  if (res?.ok && res.status) {
    res.status.settings.uiLanguage = effectiveLang;
    renderStatus(res.status);
  }
}

enabledToggle.addEventListener('change', async () => {
  await saveSettings({ enabled: enabledToggle.checked });
  const res = (await chrome.runtime.sendMessage({
    type: 'SETTINGS_UPDATED',
  } satisfies ExtensionMessage)) as { ok: boolean; status?: StatusSnapshot };
  if (res?.ok && res.status) {
    renderStatus(res.status);
  }
});

popupLangSelect.addEventListener('change', async () => {
  const mode = (popupLangSelect.value || 'auto') as FeedbackLanguageMode;
  await Promise.all([
    saveSettings({ uiLanguage: mode }),
    saveAiConfig({ feedbackLanguage: mode }),
  ]);
  await roadmapController.setLanguage(mode);
  const res = (await chrome.runtime.sendMessage({
    type: 'SETTINGS_UPDATED',
  } satisfies ExtensionMessage)) as { ok: boolean; status?: StatusSnapshot };
  if (res?.ok && res.status) {
    res.status.settings.uiLanguage = mode;
    renderStatus(res.status);
  }
});

async function triggerCardOnPage(): Promise<void> {
  triggerNowBtn.disabled = true;
  popupFeedback.hidden = true;
  const res = (await chrome.runtime.sendMessage({
    type: 'TRIGGER_NOW',
    tabId: currentActiveTab?.id,
  } satisfies ExtensionMessage)) as { ok: boolean; delivered?: boolean; reason?: string };

  triggerNowBtn.disabled = false;
  if (res?.delivered) {
    window.close();
  } else {
    const isTr = isTurkishUi(currentStatus);
    popupFeedback.hidden = false;
    popupFeedback.textContent =
      res?.reason === 'blocked_site'
        ? isTr
          ? 'Bu sitede bildirimler kapalı.'
          : 'Prompts are disabled on this site.'
        : isTr
          ? 'Normal bir web sayfası sekmesi açın.'
          : 'Open a regular webpage tab first.';
  }
}

async function triggerPageQuizOnPage(): Promise<void> {
  pageQuizBtn.disabled = true;
  popupFeedback.hidden = true;
  const res = (await chrome.runtime.sendMessage({
    type: 'START_PAGE_QUIZ',
    tabId: currentActiveTab?.id,
  } satisfies ExtensionMessage)) as { ok: boolean; delivered?: boolean; reason?: string };

  pageQuizBtn.disabled = false;
  if (res?.delivered) {
    window.close();
  } else {
    const isTr = isTurkishUi(currentStatus);
    popupFeedback.hidden = false;
    popupFeedback.textContent =
      res?.reason === 'blocked_site'
        ? isTr
          ? 'Bu sitede sayfa modu kapalı.'
          : 'Page Quiz is disabled on this site.'
        : isTr
          ? 'Normal bir web sayfası sekmesi açın.'
          : 'Open a regular webpage tab first.';
  }
}

async function triggerListeningQuizOnPage(): Promise<void> {
  listeningQuizBtn.disabled = true;
  popupFeedback.hidden = true;
  const res = (await chrome.runtime.sendMessage({
    type: 'START_LISTENING_QUIZ',
    tabId: currentActiveTab?.id,
  } satisfies ExtensionMessage)) as { ok: boolean; delivered?: boolean; reason?: string };

  listeningQuizBtn.disabled = false;
  if (res?.delivered) {
    window.close();
  } else {
    const isTr = isTurkishUi(currentStatus);
    popupFeedback.hidden = false;
    popupFeedback.textContent =
      res?.reason === 'blocked_site'
        ? isTr
          ? 'Bu sitede dinleme modu kapalı.'
          : 'Listening mode is disabled on this site.'
        : isTr
          ? 'Normal bir web sayfası sekmesi açın.'
          : 'Open a regular webpage tab first.';
  }
}

triggerNowBtn.addEventListener('click', () => void triggerCardOnPage());
pageQuizBtn.addEventListener('click', () => void triggerPageQuizOnPage());
listeningQuizBtn.addEventListener('click', () => void triggerListeningQuizOnPage());

muteHourBtn.addEventListener('click', async () => {
  const isMuted =
    currentStatus?.settings.mutedUntil !== null &&
    (currentStatus?.settings.mutedUntil ?? 0) > Date.now();

  muteHourBtn.disabled = true;
  const res = (await chrome.runtime.sendMessage(
    isMuted
      ? ({ type: 'CLEAR_MUTE' } satisfies ExtensionMessage)
      : ({ type: 'MUTE_FOR_HOURS', hours: 1 } satisfies ExtensionMessage)
  )) as { ok: boolean; status?: StatusSnapshot };

  muteHourBtn.disabled = false;
  if (res?.ok && res.status) {
    renderStatus(res.status);
  }
});

toggleBlockSiteBtn.addEventListener('click', async () => {
  const url = currentActiveTab?.url;
  if (!url) return;
  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    return;
  }
  toggleBlockSiteBtn.disabled = true;
  const res = (await chrome.runtime.sendMessage({
    type: 'TOGGLE_BLOCK_HOST',
    host: hostname,
  } satisfies ExtensionMessage)) as {
    ok: boolean;
    blocked?: boolean;
    status?: StatusSnapshot;
  };
  toggleBlockSiteBtn.disabled = false;
  if (res?.ok && res.status) {
    renderStatus(res.status);
  }
});

openOptionsBtn.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage();
});

window.setInterval(() => {
  if (!currentStatus || !currentStatus.settings.enabled || !currentStatus.nextAlarmAt) return;
  if (currentStatus.hasPendingPrompt) return;
  if (currentStatus.settings.mutedUntil && currentStatus.settings.mutedUntil > Date.now()) return;
  countdownText.textContent = formatRemaining(
    currentStatus.nextAlarmAt - Date.now(),
    isTurkishUi(currentStatus)
  );
}, 1000);

const OB_LANG_CHOICES: Array<{ code: ObFeedbackLang; label: string }> = [
  { code: 'tr', label: 'Türkçe (Turkish)' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch (German)' },
  { code: 'fr', label: 'Français (French)' },
  { code: 'es', label: 'Español (Spanish)' },
  { code: 'it', label: 'Italiano (Italian)' },
  { code: 'pt', label: 'Português (Portuguese)' },
  { code: 'ru', label: 'Русский (Russian)' },
  { code: 'ja', label: '日本語 (Japanese)' },
  { code: 'ko', label: '한국어 (Korean)' },
  { code: 'zh', label: '中文 (Chinese)' },
  { code: 'ar', label: 'العربية (Arabic)' },
];

const OB_CEFR_RANK: Record<ObCefrLevel, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

function showTransientPopupNotice(message: string): void {
  const feedbackEl = document.getElementById('popup-feedback');
  if (!feedbackEl) return;
  feedbackEl.textContent = message;
  feedbackEl.hidden = false;
  window.setTimeout(() => {
    feedbackEl.hidden = true;
  }, 4000);
}

function triggerJsonDownload(filename: string, jsonText: string): void {
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

let noticeListenersBound = false;

async function refreshPopupNotices(): Promise<void> {
  const b1Banner = document.getElementById('b1-ready-banner');
  const b1Title = document.getElementById('b1-banner-title');
  const b1Sub = document.getElementById('b1-banner-sub');
  const b1AcceptBtn = document.getElementById('b1-accept-btn');
  const b1DeferBtn = document.getElementById('b1-defer-btn');

  const backupBanner = document.getElementById('backup-nudge-banner');
  const backupTitle = document.getElementById('backup-nudge-title');
  const backupSub = document.getElementById('backup-nudge-sub');
  const backupDownloadBtn = document.getElementById('backup-nudge-download');
  const backupLaterBtn = document.getElementById('backup-nudge-later');

  const noApiBanner = document.getElementById('no-api-popup-banner');
  const noApiTitle = document.getElementById('no-api-popup-title');
  const noApiSub = document.getElementById('no-api-popup-sub');
  const noApiSetupBtn = document.getElementById('no-api-popup-setup');
  const noApiLaterBtn = document.getElementById('no-api-popup-later');

  if (!b1Banner || !backupBanner) return;

  const [onboarding, skillProfile, settings, rmState, ai] = await Promise.all([
    getOnboardingState(),
    obGetSkillProfile(),
    obGetSettings(),
    obGetRoadmapState(),
    obGetAiConfig(),
  ]);

  const copy = getOnboardingCopy(ai.feedbackLanguage);
  const isTrLang = obResolveSupportedLang(ai.feedbackLanguage) === 'tr';

  if (!noticeListenersBound) {
    noticeListenersBound = true;

    b1AcceptBtn?.addEventListener('click', () => {
      void (async () => {
        const [curOb, curSettings] = await Promise.all([getOnboardingState(), obGetSettings()]);
        const decision = applyB1PromotionDecision(curOb, curSettings, true);
        await Promise.all([
          saveOnboardingState(decision.nextOnboarding),
          obSaveSettings({ ...curSettings, levels: decision.nextLevels }),
        ]);
        await chrome.runtime.sendMessage({
          type: 'SETTINGS_UPDATED',
        } satisfies ObExtensionMessage);
        b1Banner.hidden = true;
        await fetchStatus();
      })();
    });

    b1DeferBtn?.addEventListener('click', () => {
      void (async () => {
        const [curOb, curSettings] = await Promise.all([getOnboardingState(), obGetSettings()]);
        const decision = applyB1PromotionDecision(curOb, curSettings, false);
        await saveOnboardingState(decision.nextOnboarding);
        await chrome.runtime.sendMessage({
          type: 'SETTINGS_UPDATED',
        } satisfies ObExtensionMessage);
        b1Banner.hidden = true;
      })();
    });

    backupDownloadBtn?.addEventListener('click', () => {
      void (async () => {
        const { json, filename } = await exportFullBackupJson();
        triggerJsonDownload(filename, json);
        await saveOnboardingState({ lastBackupAt: Date.now() });
        backupBanner.hidden = true;
        showTransientPopupNotice(copy.backupSyncedToday);
      })();
    });

    backupLaterBtn?.addEventListener('click', () => {
      void (async () => {
        await saveOnboardingState({
          backupReminderDismissedUntil: getBackupNudgeSnoozeTimestamp(),
        });
        backupBanner.hidden = true;
      })();
    });

    noApiSetupBtn?.addEventListener('click', () => {
      void chrome.tabs.create({ url: chrome.runtime.getURL('options.html?tab=ai') });
    });

    noApiLaterBtn?.addEventListener('click', () => {
      try {
        localStorage.setItem('easylang_no_api_snooze_until', String(Date.now() + 3 * 86_400_000));
      } catch {
        // Ignore storage quota errors in ephemeral view
      }
      if (noApiBanner) noApiBanner.hidden = true;
    });
  }

  const showB1 = shouldShowB1ReadinessPrompt(onboarding, skillProfile, settings);
  if (showB1) {
    if (b1Title) b1Title.textContent = copy.b1ReadyTitle;
    if (b1Sub) b1Sub.textContent = copy.b1ReadyDesc;
    if (b1AcceptBtn) b1AcceptBtn.textContent = copy.b1ReadyYes;
    if (b1DeferBtn) b1DeferBtn.textContent = copy.b1ReadyNo;
    b1Banner.hidden = false;
    backupBanner.hidden = true;
    if (noApiBanner) noApiBanner.hidden = true;
    return;
  }

  b1Banner.hidden = true;
  const completedNodes = Array.isArray(rmState.completedNodeIds) ? rmState.completedNodeIds.length : 0;
  const showBackup = shouldShowBackupNudge(onboarding, skillProfile, completedNodes);
  if (showBackup) {
    if (backupTitle) backupTitle.textContent = copy.backupNudgeShort;
    if (backupSub) backupSub.textContent = copy.backupKeyNotice;
    if (backupDownloadBtn) backupDownloadBtn.textContent = copy.backupBtnNow;
    if (backupLaterBtn) backupLaterBtn.textContent = copy.backupBtnLater;
    backupBanner.hidden = false;
    if (noApiBanner) noApiBanner.hidden = true;
    return;
  }

  backupBanner.hidden = true;
  if (noApiBanner) {
    const hasAnyKey = Boolean(
      ai.apiKey?.trim() || ai.fallbackApiKey?.trim() || ai.fallback2ApiKey?.trim()
    );
    let snoozedUntil = 0;
    try {
      snoozedUntil = Number(localStorage.getItem('easylang_no_api_snooze_until') || '0');
    } catch {
      snoozedUntil = 0;
    }
    const showNoApi = onboarding.completed && !hasAnyKey && Date.now() >= snoozedUntil;
    if (showNoApi) {
      if (noApiTitle) {
        noApiTitle.textContent = isTrLang
          ? 'Ücretsiz AI Değerlendirmesini Aç'
          : 'Enable Free AI Evaluation';
      }
      if (noApiSub) {
        noApiSub.textContent = isTrLang
          ? '1 dakikada ücretsiz Groq API anahtarı al — adım adım rehber burada.'
          : 'Get a free Groq API key in 1 minute — step-by-step guide inside.';
      }
      if (noApiSetupBtn) {
        noApiSetupBtn.textContent = isTrLang ? 'Adım Adım Kur →' : 'Setup Guide →';
      }
      if (noApiLaterBtn) {
        noApiLaterBtn.textContent = isTrLang ? 'Sonra' : 'Later';
      }
      noApiBanner.hidden = false;
    } else {
      noApiBanner.hidden = true;
    }
  }
}

function applyPopupOnboardingCopy(
  copy: OnboardingCopy,
  currentLevel: ObCefrLevel,
  targetLevel: ObCefrLevel
): void {
  const setText = (id: string, value: string): void => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText('ob-choice-title', copy.title);
  setText('ob-choice-sub', copy.subtitle);
  setText('ob-new-title', copy.btnFirstTime);
  setText('ob-new-sub', copy.btnFirstTimeSub);
  setText('ob-returning-title', copy.btnReturning);
  setText('ob-returning-sub', copy.btnReturningSub);
  setText('ob-back-from-new', copy.backBtn);
  setText('ob-back-from-returning', copy.backBtn);
  setText('ob-form-title', copy.btnFirstTime);
  setText('ob-native-label', copy.lblNativeLang);
  setText('ob-current-label', copy.lblCurrentLevel);
  setText('ob-target-label', copy.lblTargetLevel);
  setText('ob-start-btn', copy.btnStartLearning);
  setText('ob-restore-title', copy.restoreTitle);
  setText('ob-restore-sub', copy.restoreDesc);
  setText('ob-file-label', copy.restoreUploadBtn);
  setText('ob-restore-btn', copy.restoreConfirmBtn);
  setText('ob-skip-restore-btn', copy.restoreSkipBtn);

  const backupTextarea = document.getElementById('ob-backup-text') as HTMLTextAreaElement | null;
  if (backupTextarea) {
    backupTextarea.placeholder = copy.restorePlaceholder;
  }

  const noticeEl = document.getElementById('ob-cap-notice');
  if (noticeEl) {
    const needsCapNotice =
      (currentLevel === 'A1' || currentLevel === 'A2') &&
      (OB_CEFR_RANK[targetLevel] ?? 1) >= OB_CEFR_RANK.B1;
    noticeEl.textContent = copy.a1CapNotice;
    noticeEl.hidden = !needsCapNotice;
  }
}

async function ensurePopupOnboarding(): Promise<boolean> {
  const onboarding = await getOnboardingState();
  if (onboarding.completed) return false;

  const overlay = document.getElementById('popup-onboarding');
  if (!overlay) return false;

  const stepChoice = document.getElementById('ob-step-choice');
  const stepNew = document.getElementById('ob-step-new');
  const stepReturning = document.getElementById('ob-step-returning');
  const chooseNewBtn = document.getElementById('ob-choose-new');
  const chooseReturningBtn = document.getElementById('ob-choose-returning');
  const backFromNewBtn = document.getElementById('ob-back-from-new');
  const backFromReturningBtn = document.getElementById('ob-back-from-returning');
  const nativeLangSelect = document.getElementById('ob-native-lang') as HTMLSelectElement | null;
  const curLevelsWrap = document.getElementById('ob-cur-levels');
  const tgtLevelsWrap = document.getElementById('ob-tgt-levels');
  const startBtn = document.getElementById('ob-start-btn') as HTMLButtonElement | null;
  const backupFileInput = document.getElementById('ob-backup-file') as HTMLInputElement | null;
  const backupTextarea = document.getElementById('ob-backup-text') as HTMLTextAreaElement | null;
  const restoreErrorEl = document.getElementById('ob-restore-error');
  const restoreBtn = document.getElementById('ob-restore-btn') as HTMLButtonElement | null;
  const skipRestoreBtn = document.getElementById('ob-skip-restore-btn') as HTMLButtonElement | null;
  const obGuideReplayBtn = document.getElementById('ob-guide-replay-btn') as HTMLButtonElement | null;
  const obGuideReplayLabel = document.getElementById('ob-guide-replay-label');

  let selectedLang: ObFeedbackLang = obResolveSupportedLang('auto');
  let selectedCurrent: ObCefrLevel = 'A1';
  let selectedTarget: ObCefrLevel = 'B1';
  let activeCopy = getOnboardingCopy('auto');
  let activeStep: 'choice' | 'new' | 'returning' = 'choice';

  const stepGuideMap: Record<'choice' | 'new' | 'returning', AssistantGuideId> = {
    choice: 'welcome_onboarding',
    new: 'onboarding_profile',
    returning: 'onboarding_restore',
  };

  const syncObGuideLabel = (): void => {
    const isTrOb = obResolveSupportedLang(selectedLang) === 'tr';
    if (obGuideReplayLabel) {
      obGuideReplayLabel.textContent = isTrOb ? 'Sesli Anlatım' : 'Voice Guide';
    }
    if (obGuideReplayBtn) {
      obGuideReplayBtn.title = isTrOb
        ? 'Bu adımın sesli anlatımını dinle veya durdur'
        : 'Play or stop voice guide for this step';
    }
  };

  if (nativeLangSelect && nativeLangSelect.options.length === 0) {
    for (const opt of OB_LANG_CHOICES) {
      const optionEl = document.createElement('option');
      optionEl.value = opt.code;
      optionEl.textContent = opt.label;
      nativeLangSelect.appendChild(optionEl);
    }
    nativeLangSelect.value = selectedLang;
  }

  const syncLevelPills = (): void => {
    curLevelsWrap?.querySelectorAll<HTMLButtonElement>('.ob-pill').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.level === selectedCurrent);
    });
    tgtLevelsWrap?.querySelectorAll<HTMLButtonElement>('.ob-pill').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.level === selectedTarget);
    });
    applyPopupOnboardingCopy(activeCopy, selectedCurrent, selectedTarget);
    syncObGuideLabel();
  };

  const showStep = (step: 'choice' | 'new' | 'returning'): void => {
    activeStep = step;
    if (stepChoice) stepChoice.hidden = step !== 'choice';
    if (stepNew) stepNew.hidden = step !== 'new';
    if (stepReturning) stepReturning.hidden = step !== 'returning';
    void playGuideAssistant(stepGuideMap[step], {
      isTr: obResolveSupportedLang(selectedLang) === 'tr',
      triggerEl: obGuideReplayBtn,
      isAutoPlay: true,
    });
  };

  syncLevelPills();
  document.body.classList.add('is-onboarding-open');
  overlay.hidden = false;
  showStep('choice');

  await new Promise<void>((resolve) => {
    const finishOnboarding = (): void => {
      stopGuideAssistant();
      document.body.classList.remove('is-onboarding-open');
      overlay.hidden = true;
      resolve();
    };

    obGuideReplayBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleGuideAssistant(stepGuideMap[activeStep], {
        isTr: obResolveSupportedLang(selectedLang) === 'tr',
        triggerEl: obGuideReplayBtn,
      });
    });

    chooseNewBtn?.addEventListener('click', () => showStep('new'));
    chooseReturningBtn?.addEventListener('click', () => showStep('returning'));
    backFromNewBtn?.addEventListener('click', () => showStep('choice'));
    backFromReturningBtn?.addEventListener('click', () => showStep('choice'));

    nativeLangSelect?.addEventListener('change', () => {
      selectedLang = nativeLangSelect.value as ObFeedbackLang;
      activeCopy = getOnboardingCopy(selectedLang);
      applyPopupOnboardingCopy(activeCopy, selectedCurrent, selectedTarget);
      syncObGuideLabel();
    });

    curLevelsWrap?.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('.ob-pill');
      const lvl = target?.dataset.level as ObCefrLevel | undefined;
      if (!lvl) return;
      selectedCurrent = lvl;
      if ((OB_CEFR_RANK[selectedTarget] ?? 1) < (OB_CEFR_RANK[selectedCurrent] ?? 1)) {
        selectedTarget = selectedCurrent === 'C1' ? 'C2' : selectedCurrent;
      }
      syncLevelPills();
    });

    tgtLevelsWrap?.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('.ob-pill');
      const lvl = target?.dataset.level as ObCefrLevel | undefined;
      if (!lvl) return;
      selectedTarget = lvl;
      if ((OB_CEFR_RANK[selectedTarget] ?? 1) < (OB_CEFR_RANK[selectedCurrent] ?? 1)) {
        selectedTarget = selectedCurrent;
      }
      syncLevelPills();
    });

    backupFileInput?.addEventListener('change', () => {
      const file = backupFileInput.files?.[0];
      if (!file) return;
      void file.text().then((text) => {
        if (backupTextarea) backupTextarea.value = text;
        const lbl = document.getElementById('ob-file-label');
        if (lbl) lbl.textContent = `✓ ${file.name}`;
        if (restoreErrorEl) restoreErrorEl.hidden = true;
      });
    });

    startBtn?.addEventListener('click', () => {
      void (async () => {
        if (startBtn) startBtn.disabled = true;
        const plan = buildInitialProfileForOnboarding({
          nativeLanguage: selectedLang,
          currentLevel: selectedCurrent,
          targetLevel: selectedTarget,
        });
        const [curSettings, curAi, curProfile] = await Promise.all([
          obGetSettings(),
          obGetAiConfig(),
          obGetSkillProfile(),
        ]);
        await Promise.all([
          obSaveSettings({ ...curSettings, levels: plan.initialLevels, uiLanguage: plan.uiLanguage }),
          obSaveAiConfig({ ...curAi, feedbackLanguage: plan.uiLanguage }),
          obSaveSkillProfile({ ...curProfile, rating: plan.initialRating }),
          saveOnboardingState(plan.onboardingPatch),
        ]);
        await chrome.runtime.sendMessage({
          type: 'SETTINGS_UPDATED',
        } satisfies ObExtensionMessage);
        finishOnboarding();
      })();
    });

    restoreBtn?.addEventListener('click', () => {
      void (async () => {
        if (restoreErrorEl) restoreErrorEl.hidden = true;
        const raw = backupTextarea?.value ?? '';
        const res = await restoreFromBackupText(raw);
        if (!res.ok) {
          if (restoreErrorEl) {
            restoreErrorEl.textContent = activeCopy.restoreError;
            restoreErrorEl.hidden = false;
          }
          return;
        }
        await chrome.runtime.sendMessage({
          type: 'SETTINGS_UPDATED',
        } satisfies ObExtensionMessage);
        finishOnboarding();
      })();
    });

    skipRestoreBtn?.addEventListener('click', () => {
      void (async () => {
        await saveOnboardingState({ completed: true, b1GateAccepted: true });
        finishOnboarding();
      })();
    });
  });

  return true;
}

async function initPopup(): Promise<void> {
  const justCompletedOnboarding = await ensurePopupOnboarding();
  const [settings, ai] = await Promise.all([getSettings(), getAiConfig()]);
  const initialLang =
    settings.uiLanguage && settings.uiLanguage !== 'auto'
      ? settings.uiLanguage
      : ai.feedbackLanguage && ai.feedbackLanguage !== 'auto'
        ? ai.feedbackLanguage
        : settings.uiLanguage ?? ai.feedbackLanguage ?? 'auto';
  await Promise.all([
    fetchStatus(),
    roadmapController.setLanguage(initialLang),
  ]);
  if (justCompletedOnboarding) {
    void playGuideOnce('tour_home_roadmap', {
      isTr: resolveSupportedLanguage(initialLang) === 'tr',
    });
  }
}

let popupDictCardsRef: Card[] | null = null;
let popupDictIndex: OfflineDictionaryIndex | null = null;

async function lookupPopupOfflineWord(word: string) {
  const cards = await getAllCards();
  if (!popupDictIndex || popupDictCardsRef !== cards) {
    popupDictIndex = buildOfflineDictionaryIndex(cards);
    popupDictCardsRef = cards;
  }
  return lookupOfflineWord(popupDictIndex, word);
}

installWordHoverTooltip({
  root: document,
  delayMs: 1500,
  lookupWord: lookupPopupOfflineWord,
});

void initPopup();
