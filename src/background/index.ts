import {
  buildOfflineDictionaryIndex,
  lookupOfflineWord,
  type OfflineDictionaryIndex,
} from '../shared/offlineDictionary';
import { shouldShowB1ReadinessPrompt } from '../shared/onboarding';
import {
  applyManualTriggerResume,
  applyPromptScheduleUpdate,
} from '../shared/promptSchedule';
import {
  mergePendingTutorReplyIntoHistory,
  mergeRemedialBriefingAiIntoSession,
} from '../shared/roadmapCoach';
import { isUrlBlocked, normalizeBlockedEntry, toChromeExcludeMatches } from '../shared/siteFilter';
import {
  deleteConceptNoteById,
  getActiveRemedialSession,
  getActiveRoadmapSession,
  getAiConfig,
  getAllCards,
  getConceptState,
  getOnboardingState,
  getPendingPrompt,
  getProgressMap,
  getRemedialProgress,
  getReviewHistory,
  getRoadmapHistory,
  getSettings,
  getSkillProfile,
  runStorageHygiene,
  saveActiveRemedialSession,
  saveActiveRoadmapSession,
  saveRemedialAiOverlay,
  saveSettings,
  setCurrentPrompt,
  setNextAlarmAt,
  setPendingPrompt,
  upsertUserCard,
} from '../shared/storage';
import type { ActivePrompt, Card, ExtensionMessage } from '../shared/types';
import { getResolvedRemedialSkillIds } from '../shared/weaknessDetector';
import {
  askAiTutorWithContext,
  diagnoseWeaknessesWithAi,
  evaluatePageTranslationWithAi,
  fetchModelsForSlot,
  generateAiCoachReport,
  generateAiGrammarCoach,
  generateRemedialBriefingWithAi,
  generateRoadmapCoachBanner,
  testProviderConnection,
  translateSelectionWithAi,
  validatePageSentenceCandidates,
} from './aiEvaluator';
import {
  buildCurrentAnalyticsReport,
  getStatusSnapshot,
  handleEvaluateRoadmapExercise,
  handleFlagConceptGap,
  handleMarkDontKnow,
  handleOverrideCorrect,
  handleRecordListeningResult,
  handleRecordPageQuizResult,
  handleSubmitAnswer,
  isWithinQuietHours,
  prepareListeningChallenge,
  prepareNextPrompt,
} from './quizEngine';
import {
  clearLastActiveTabIfBlocked,
  clearTabIfRemoved,
  deliverMessageToTab,
  findBestTargetTab,
  isInjectableUrl,
  recordMouseTabActivity,
} from './tabTracker';

const PERIODIC_ALARM_NAME = 'en-tr-recall-periodic';
const SNOOZE_ALARM_NAME = 'en-tr-recall-snooze';
const CONTEXT_MENU_ID = 'en-tr-recall-add-selection';
const CONTENT_SCRIPT_ID = 'en-tr-recall-content';
const TRIGGER_COMMAND = 'trigger-question';
const TRIGGER_PAGE_QUIZ_COMMAND = 'trigger-page-quiz';
const TRIGGER_LISTENING_QUIZ_COMMAND = 'trigger-listening-quiz';

let cachedOfflineDictCards: Card[] | null = null;
let cachedOfflineDictIndex: OfflineDictionaryIndex | null = null;

async function getBackgroundOfflineDictIndex(): Promise<OfflineDictionaryIndex> {
  const cards = await getAllCards();
  if (!cachedOfflineDictIndex || cachedOfflineDictCards !== cards) {
    cachedOfflineDictIndex = buildOfflineDictionaryIndex(cards);
    cachedOfflineDictCards = cards;
  }
  return cachedOfflineDictIndex;
}

async function syncActionBadge(): Promise<void> {
  try {
    const [onboarding, profile, settings] = await Promise.all([
      getOnboardingState(),
      getSkillProfile(),
      getSettings(),
    ]);
    if (shouldShowB1ReadinessPrompt(onboarding, profile, settings)) {
      await chrome.action.setBadgeText({ text: 'B1' });
      await chrome.action.setBadgeBackgroundColor({ color: '#8b5cf6' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch {
    // Ignore badge errors if action API unavailable
  }
}

async function syncPeriodicAlarm(): Promise<void> {
  const settings = await getSettings();
  await chrome.alarms.clear(PERIODIC_ALARM_NAME);

  if (!settings.enabled) {
    await setNextAlarmAt(null);
    return;
  }

  const periodMinutes = Math.max(1, settings.intervalMinutes);
  await chrome.alarms.create(PERIODIC_ALARM_NAME, {
    delayInMinutes: periodMinutes,
    periodInMinutes: periodMinutes,
  });
  await setNextAlarmAt(Date.now() + periodMinutes * 60_000);
}

/**
 * Dynamically register the content script with excludeMatches so Chrome never
 * even loads content.js on websites the user blacklisted.
 */
async function syncContentScriptRegistration(): Promise<void> {
  const settings = await getSettings();
  const excludeMatches = toChromeExcludeMatches(settings.blockedDomains);

  try {
    await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  } catch {
    // Ignore when not yet registered
  }

  await chrome.scripting.registerContentScripts([
    {
      id: CONTENT_SCRIPT_ID,
      matches: ['http://*/*', 'https://*/*'],
      excludeMatches,
      js: ['content.js'],
      runAt: 'document_idle',
      persistAcrossSessions: true,
    },
  ]);

  await clearLastActiveTabIfBlocked(settings.blockedDomains);

  // Close any open widget on tabs that match newly added blocked domains
  if (settings.blockedDomains.length > 0) {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id !== undefined && isUrlBlocked(tab.url, settings.blockedDomains)) {
        void chrome.tabs.sendMessage(tab.id, { type: 'HIDE_CARD' } satisfies ExtensionMessage).catch(() => {});
      }
    }
  }
}

async function scheduleSnoozeAlarm(minutes: number): Promise<void> {
  const safeMinutes = Math.max(1, minutes);
  await chrome.alarms.clear(SNOOZE_ALARM_NAME);
  await chrome.alarms.create(SNOOZE_ALARM_NAME, {
    delayInMinutes: safeMinutes,
  });
  await setNextAlarmAt(Date.now() + safeMinutes * 60_000);
}

/**
 * If auto-prompts were paused via "Pause until I turn it back on" from the floating widget,
 * resume them at the learner's last saved interval when they manually click "Şimdi Sor".
 */
async function resumeAutoPromptsIfPausedUntilManual(): Promise<boolean> {
  const current = await getSettings();
  const { next, resumed } = applyManualTriggerResume(current);
  if (!resumed) return false;
  await saveSettings({
    enabled: next.enabled,
    pausedUntilManual: next.pausedUntilManual,
    mutedUntil: next.mutedUntil,
  });
  await syncPeriodicAlarm();
  return true;
}

function registerContextMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'LingoEx: Add "%s" to deck',
      contexts: ['selection'],
    });
  });
}

async function fetchMyMemoryTranslation(text: string): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|tr`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      responseData?: { translatedText?: string };
      matches?: Array<{ translation?: string }>;
    };
    const candidates: string[] = [];
    const primary = data.responseData?.translatedText?.trim();
    if (primary) candidates.push(primary);
    for (const match of data.matches ?? []) {
      const tr = match.translation?.trim();
      if (tr && !candidates.some((c) => c.toLowerCase() === tr.toLowerCase())) {
        candidates.push(tr);
      }
      if (candidates.length >= 3) break;
    }
    return candidates;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function hideWidgetOnOtherTabs(keepTabId: number): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (t.id !== undefined && t.id !== keepTabId) {
        void chrome.tabs.sendMessage(t.id, { type: 'HIDE_CARD' } satisfies ExtensionMessage).catch(() => {});
      }
    }
  } catch {
    // Ignore tab query failures
  }
}

async function deliverPrompt(
  prompt: ActivePrompt,
  preferredTabId?: number
): Promise<{ delivered: boolean; blockedActiveTab: boolean }> {
  const { tab, blockedActiveTab } = await findBestTargetTab(preferredTabId);
  if (!tab || tab.id === undefined) {
    await setPendingPrompt(prompt);
    return { delivered: false, blockedActiveTab };
  }

  const delivered = await deliverMessageToTab(tab.id, {
    type: 'SHOW_CARD',
    payload: prompt,
  });

  if (delivered) {
    await setPendingPrompt(null);
    void hideWidgetOnOtherTabs(tab.id);
    return { delivered: true, blockedActiveTab: false };
  }

  await setPendingPrompt(prompt);
  return { delivered: false, blockedActiveTab: false };
}

async function flushPendingPromptToTab(tab: chrome.tabs.Tab | undefined): Promise<void> {
  if (!tab || tab.id === undefined) return;
  const settings = await getSettings();
  if (!isInjectableUrl(tab.url, settings.blockedDomains)) return;

  const pending = await getPendingPrompt();
  if (!pending) return;

  const ok = await deliverMessageToTab(tab.id, {
    type: 'SHOW_CARD',
    payload: pending,
  });
  if (ok) {
    await setPendingPrompt(null);
    void hideWidgetOnOtherTabs(tab.id);
  }
}

async function triggerScheduledQuiz(
  force: boolean = false,
  preferredTabId?: number
): Promise<{ delivered: boolean; reason?: string }> {
  const onboarding = await getOnboardingState();
  if (!force && !onboarding.completed) {
    return { delivered: false, reason: 'onboarding_pending' };
  }
  let settings = await getSettings();
  if (!force && !settings.enabled) {
    return { delivered: false, reason: 'disabled' };
  }

  if (settings.mutedUntil !== null) {
    if (Date.now() < settings.mutedUntil) {
      if (!force) {
        return { delivered: false, reason: 'muted' };
      }
    } else {
      settings = await saveSettings({ mutedUntil: null });
    }
  }

  if (!force && isWithinQuietHours(settings)) {
    return { delivered: false, reason: 'quiet_hours' };
  }

  if (!force) {
    const idleState = await chrome.idle.queryState(300);
    if (idleState === 'locked' || idleState === 'idle') {
      const existingPending = await getPendingPrompt();
      if (!existingPending) {
        const prompt = await prepareNextPrompt();
        if (prompt) await setPendingPrompt(prompt);
      }
      return { delivered: false, reason: `user_${idleState}` };
    }
  }

  // When manually triggered, always grab a fresh card if no pending prompt exists
  const prompt = force
    ? await prepareNextPrompt()
    : (await getPendingPrompt()) ?? (await prepareNextPrompt());
  if (!prompt) {
    return { delivered: false, reason: 'no_cards' };
  }

  const { delivered, blockedActiveTab } = await deliverPrompt(prompt, preferredTabId);
  if (delivered) {
    return { delivered: true };
  }
  return {
    delivered: false,
    reason: blockedActiveTab ? 'blocked_site' : 'no_injectable_tab_queued_pending',
  };
}

chrome.runtime.onInstalled.addListener(() => {
  registerContextMenu();
  void syncPeriodicAlarm();
  void syncContentScriptRegistration();
  void syncActionBadge();
  void runStorageHygiene();
});

chrome.runtime.onStartup.addListener(() => {
  void syncPeriodicAlarm();
  void syncContentScriptRegistration();
  void syncActionBadge();
  void runStorageHygiene();
});

async function triggerPageQuiz(
  preferredTabId?: number
): Promise<{ delivered: boolean; reason?: string }> {
  const { tab, blockedActiveTab } = await findBestTargetTab(preferredTabId);
  if (!tab || tab.id === undefined) {
    return {
      delivered: false,
      reason: blockedActiveTab ? 'blocked_site' : 'no_injectable_tab',
    };
  }
  const delivered = await deliverMessageToTab(tab.id, { type: 'RUN_PAGE_QUIZ' });
  return delivered ? { delivered: true } : { delivered: false, reason: 'no_injectable_tab' };
}

async function triggerListeningQuiz(
  preferredTabId?: number
): Promise<{ delivered: boolean; reason?: string }> {
  const { tab, blockedActiveTab } = await findBestTargetTab(preferredTabId);
  if (!tab || tab.id === undefined) {
    return {
      delivered: false,
      reason: blockedActiveTab ? 'blocked_site' : 'no_injectable_tab',
    };
  }
  const delivered = await deliverMessageToTab(tab.id, { type: 'RUN_LISTENING_QUIZ' });
  return delivered ? { delivered: true } : { delivered: false, reason: 'no_injectable_tab' };
}

chrome.commands.onCommand.addListener((command) => {
  if (command === TRIGGER_COMMAND) {
    void (async () => {
      await resumeAutoPromptsIfPausedUntilManual();
      await triggerScheduledQuiz(true);
    })();
  } else if (command === TRIGGER_PAGE_QUIZ_COMMAND) {
    void triggerPageQuiz();
  } else if (command === TRIGGER_LISTENING_QUIZ_COMMAND) {
    void triggerListeningQuiz();
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === PERIODIC_ALARM_NAME) {
    const settings = await getSettings();
    if (settings.enabled) {
      await setNextAlarmAt(Date.now() + Math.max(1, settings.intervalMinutes) * 60_000);
    }
    await triggerScheduledQuiz(false);
  } else if (alarm.name === SNOOZE_ALARM_NAME) {
    const settings = await getSettings();
    if (settings.enabled) {
      await setNextAlarmAt(Date.now() + Math.max(1, settings.intervalMinutes) * 60_000);
    }
    await triggerScheduledQuiz(true);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void clearTabIfRemoved(tabId);
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await flushPendingPromptToTab(tab);
  } catch {
    // Tab may have closed mid-activation
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  const selection = info.selectionText?.trim();
  if (!selection) return;

  const [settings, aiConfig] = await Promise.all([getSettings(), getAiConfig()]);
  const wordCount = selection.split(/\s+/).length;
  const cardType = wordCount >= 3 ? 'sentence' : 'word';

  let translations: string[] = [];
  if (aiConfig.enabled && selection.length <= 240) {
    translations = await translateSelectionWithAi(selection, aiConfig);
  }
  if (translations.length === 0 && settings.autoTranslateContextMenu && selection.length <= 200) {
    translations = await fetchMyMemoryTranslation(selection);
  }
  if (translations.length === 0) {
    translations = ['(Edit Turkish meaning in Options)'];
  }

  const newCard: Card = {
    id: `u_${Date.now().toString(36)}`,
    type: cardType,
    level: 'B1',
    pos: cardType === 'word' ? 'custom' : 'sentence',
    en: selection,
    phonetic: '',
    acceptedTr: translations,
    exampleEn: '',
    exampleTr: '',
    source: 'user',
    origin: 'manual',
    createdAt: Date.now(),
  };

  await upsertUserCard(newCard);

  if (tab?.id !== undefined && isInjectableUrl(tab.url, settings.blockedDomains)) {
    await deliverMessageToTab(tab.id, {
      type: 'SHOW_TOAST',
      variant: 'success',
      message: `Added "${selection.slice(0, 32)}" → ${translations[0]}`,
    });
  }
});

const TTS_OFFSCREEN_PATH = 'tts-offscreen.html';
let offscreenCreatePromise: Promise<void> | null = null;

async function hasTtsOffscreenDocument(): Promise<boolean> {
  const offscreenUrl = chrome.runtime.getURL(TTS_OFFSCREEN_PATH);
  const runtimeAny = chrome.runtime as unknown as {
    getContexts?: (filter: { contextTypes?: string[]; documentUrls?: string[] }) => Promise<unknown[]>;
  };
  if (typeof runtimeAny.getContexts === 'function') {
    const contexts = await runtimeAny.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl],
    });
    return contexts.length > 0;
  }
  const offscreenAny = chrome.offscreen as unknown as {
    hasDocument?: () => Promise<boolean>;
  };
  if (typeof offscreenAny?.hasDocument === 'function') {
    return offscreenAny.hasDocument();
  }
  return false;
}

async function ensureTtsOffscreenDocument(): Promise<void> {
  if (await hasTtsOffscreenDocument()) return;
  if (offscreenCreatePromise) {
    await offscreenCreatePromise;
    return;
  }
  offscreenCreatePromise = (async () => {
    try {
      await chrome.offscreen.createDocument({
        url: TTS_OFFSCREEN_PATH,
        reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
        justification: 'Run local Piper neural TTS model and play natural English speech audio',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes('single offscreen document')) {
        throw err;
      }
    } finally {
      offscreenCreatePromise = null;
    }
  })();
  await offscreenCreatePromise;
}

let lastCoachTabId: number | null = null;
let offscreenSpeakChain: Promise<Record<string, unknown>> = Promise.resolve({ ok: true });

async function dispatchToTtsOffscreenNow(payload: {
  action: 'SPEAK' | 'CANCEL' | 'PREPARE' | 'STATUS' | 'COACH_SPEAK' | 'COACH_CONTROL';
  text?: string;
  rate?: number;
  queue?: boolean;
  voiceMode?: string;
  requestId?: string;
  command?: 'pause' | 'resume' | 'stop' | 'seek' | 'rate';
  value?: number;
}): Promise<Record<string, unknown>> {
  if (payload.action === 'CANCEL' || (payload.action === 'COACH_CONTROL' && payload.command === 'stop')) {
    if (!(await hasTtsOffscreenDocument())) {
      return { ok: true };
    }
  } else {
    await ensureTtsOffscreenDocument();
  }
  return chrome.runtime.sendMessage({
    target: 'tts-offscreen',
    ...payload,
  });
}

async function sendToTtsOffscreen(payload: {
  action: 'SPEAK' | 'CANCEL' | 'PREPARE' | 'STATUS' | 'COACH_SPEAK' | 'COACH_CONTROL';
  text?: string;
  rate?: number;
  queue?: boolean;
  voiceMode?: string;
  requestId?: string;
  command?: 'pause' | 'resume' | 'stop' | 'seek' | 'rate';
  value?: number;
}): Promise<Record<string, unknown>> {
  if (payload.action === 'SPEAK' || payload.action === 'CANCEL') {
    const next = offscreenSpeakChain
      .catch(() => ({ ok: false }))
      .then(() => dispatchToTtsOffscreenNow(payload));
    offscreenSpeakChain = next;
    return next;
  }
  return dispatchToTtsOffscreenNow(payload);
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage & { target?: string }, sender, sendResponse) => {
  const rawType = (message as { type?: string })?.type;
  if (message?.target === 'tts-offscreen' || rawType === 'NEURAL_TTS_PROGRESS') {
    return false;
  }
  if (rawType === 'COACH_TTS_PLAYBACK' || rawType === 'TURKISH_TTS_PROGRESS') {
    // Forward offscreen İlkiz progress broadcasts to the content-script tab that initiated playback
    if (lastCoachTabId !== null) {
      void chrome.tabs.sendMessage(lastCoachTabId, message).catch(() => {
        // Tab may have closed or navigated away
      });
    }
    return false;
  }
  (async () => {
    switch (message.type) {
      case 'USER_ACTIVITY': {
        await recordMouseTabActivity(sender.tab);
        await flushPendingPromptToTab(sender.tab);
        sendResponse({ ok: true });
        break;
      }
      case 'SUBMIT_ANSWER': {
        const result = await handleSubmitAnswer(
          message.cardId,
          message.userAnswer,
          Date.now(),
          message.card,
          message.source ?? 'recall'
        );
        void syncActionBadge();
        sendResponse({ ok: true, result });
        break;
      }
      case 'MARK_DONT_KNOW': {
        const result = await handleMarkDontKnow(
          message.cardId,
          Date.now(),
          message.card,
          message.source ?? 'recall'
        );
        sendResponse({ ok: true, result });
        break;
      }
      case 'OVERRIDE_CORRECT': {
        const result = await handleOverrideCorrect(
          message.cardId,
          Date.now(),
          message.card,
          message.source ?? 'recall'
        );
        void syncActionBadge();
        sendResponse({ ok: true, result });
        break;
      }
      case 'EVALUATE_ROADMAP_EXERCISE': {
        const result = await handleEvaluateRoadmapExercise(message, Date.now());
        sendResponse({ ok: true, result });
        break;
      }
      case 'FLAG_CONCEPT_GAP': {
        const concept = await handleFlagConceptGap(
          message.cardId,
          message.focusToken,
          message.userQuestion,
          Date.now(),
          message.card
        );
        sendResponse({ ok: true, concept });
        break;
      }
      case 'DELETE_CONCEPT_NOTE': {
        await deleteConceptNoteById(message.conceptId);
        sendResponse({ ok: true });
        break;
      }
      case 'SNOOZE_PROMPT': {
        await setCurrentPrompt(null);
        await setPendingPrompt(null);
        await scheduleSnoozeAlarm(message.minutes);
        sendResponse({ ok: true });
        break;
      }
      case 'MUTE_FOR_HOURS': {
        const ms = Math.max(0.1, message.hours) * 3_600_000;
        await setCurrentPrompt(null);
        await setPendingPrompt(null);
        await saveSettings({ mutedUntil: Date.now() + ms });
        const status = await getStatusSnapshot();
        sendResponse({ ok: true, status });
        break;
      }
      case 'CLEAR_MUTE': {
        await saveSettings({ mutedUntil: null });
        const status = await getStatusSnapshot();
        sendResponse({ ok: true, status });
        break;
      }
      case 'UPDATE_PROMPT_SCHEDULE': {
        const current = await getSettings();
        const next = applyPromptScheduleUpdate(current, {
          intervalMinutes: message.intervalMinutes,
          enabled: message.enabled,
          pausedUntilManual: message.pausedUntilManual,
          clearMute: message.clearMute,
        });
        const updated = await saveSettings({
          intervalMinutes: next.intervalMinutes,
          enabled: next.enabled,
          pausedUntilManual: next.pausedUntilManual,
          mutedUntil: next.mutedUntil,
        });
        await chrome.alarms.clear(SNOOZE_ALARM_NAME);
        if (!updated.enabled) {
          await setCurrentPrompt(null);
          await setPendingPrompt(null);
        }
        await syncPeriodicAlarm();
        const status = await getStatusSnapshot();
        sendResponse({ ok: true, settings: updated, status });
        break;
      }
      case 'TEST_AI_CONNECTION': {
        const aiConfig = await getAiConfig();
        const result = await testProviderConnection(aiConfig, 1);
        sendResponse({ ok: true, result });
        break;
      }
      case 'FETCH_AI_MODELS': {
        const aiConfig = await getAiConfig();
        const models = await fetchModelsForSlot(aiConfig, 1);
        sendResponse({ ok: true, models });
        break;
      }
      case 'TEST_FALLBACK_AI_CONNECTION': {
        const aiConfig = await getAiConfig();
        const result = await testProviderConnection(aiConfig, 2);
        sendResponse({ ok: true, result });
        break;
      }
      case 'FETCH_FALLBACK_AI_MODELS': {
        const aiConfig = await getAiConfig();
        const models = await fetchModelsForSlot(aiConfig, 2);
        sendResponse({ ok: true, models });
        break;
      }
      case 'TEST_FALLBACK2_AI_CONNECTION': {
        const aiConfig = await getAiConfig();
        const result = await testProviderConnection(aiConfig, 3);
        sendResponse({ ok: true, result });
        break;
      }
      case 'FETCH_FALLBACK2_AI_MODELS': {
        const aiConfig = await getAiConfig();
        const models = await fetchModelsForSlot(aiConfig, 3);
        sendResponse({ ok: true, models });
        break;
      }
      case 'GENERATE_AI_COACH_REPORT': {
        const [aiConfig, reportData] = await Promise.all([
          getAiConfig(),
          buildCurrentAnalyticsReport(),
        ]);
        const report = await generateAiCoachReport(
          reportData.summary,
          aiConfig,
          reportData.conceptNotes
        );
        sendResponse({ ok: true, report });
        break;
      }
      case 'GENERATE_ROADMAP_COACH_BANNER': {
        const [aiConfig, settings, records] = await Promise.all([
          getAiConfig(),
          getSettings(),
          getRoadmapHistory(),
        ]);
        const effectiveLang =
          message.language ??
          (settings.uiLanguage && settings.uiLanguage !== 'auto'
            ? settings.uiLanguage
            : aiConfig.feedbackLanguage ?? 'auto');
        const insight = await generateRoadmapCoachBanner(records, aiConfig, effectiveLang);
        sendResponse({ ok: true, insight });
        break;
      }
      case 'GENERATE_REMEDIAL_BRIEFING': {
        const [aiConfig, settings] = await Promise.all([getAiConfig(), getSettings()]);
        const effectiveLang =
          message.language ??
          (settings.uiLanguage && settings.uiLanguage !== 'auto'
            ? settings.uiLanguage
            : aiConfig.feedbackLanguage ?? 'auto');
        const briefingAi = await generateRemedialBriefingWithAi(
          {
            skillId: message.skillId,
            titleTr: message.titleTr,
            titleEn: message.titleEn,
            evidence: message.evidence,
            language: effectiveLang,
          },
          aiConfig
        );
        if (briefingAi) {
          const activeRem = await getActiveRemedialSession();
          const merged = mergeRemedialBriefingAiIntoSession(activeRem, message.skillId, briefingAi);
          if (merged) {
            await saveActiveRemedialSession(merged);
          }
        }
        sendResponse({ ok: Boolean(briefingAi), briefingAi });
        break;
      }
      case 'DIAGNOSE_WEAKNESSES_AI': {
        const [
          aiConfig,
          settings,
          roadmapHistory,
          reviewHistory,
          conceptState,
          allCards,
          progressMap,
          remedialProgress,
        ] = await Promise.all([
          getAiConfig(),
          getSettings(),
          getRoadmapHistory(),
          getReviewHistory(),
          getConceptState(),
          getAllCards(),
          getProgressMap(),
          getRemedialProgress(),
        ]);
        const effectiveLang =
          message.language ??
          (settings.uiLanguage && settings.uiLanguage !== 'auto'
            ? settings.uiLanguage
            : aiConfig.feedbackLanguage ?? 'auto');
        const resolvedSkillIds = getResolvedRemedialSkillIds({
          cards: allCards,
          progressMap,
          reviewHistory,
          roadmapHistory,
          conceptState,
          remedialProgress,
        });
        const cardsById = new Map<string, Card>();
        for (const c of allCards) cardsById.set(c.id, c);
        const weaknesses = await diagnoseWeaknessesWithAi(
          {
            roadmapHistory,
            reviewHistory,
            conceptNotes: conceptState.notes,
            cardsById,
            resolvedSkillIds,
            language: effectiveLang,
          },
          aiConfig
        );
        if (Array.isArray(weaknesses)) {
          await saveRemedialAiOverlay(weaknesses);
        }
        sendResponse({ ok: true, weaknesses });
        break;
      }
      case 'ASK_AI_TUTOR': {
        const [aiConfig, settings] = await Promise.all([getAiConfig(), getSettings()]);
        const effectiveLang =
          message.language ??
          (settings.uiLanguage && settings.uiLanguage !== 'auto'
            ? settings.uiLanguage
            : aiConfig.feedbackLanguage ?? 'auto');
        const reply = await askAiTutorWithContext(
          {
            question: message.question,
            context: message.context,
            history: message.history,
            language: effectiveLang,
          },
          aiConfig
        );
        if (reply.answer) {
          const [activeRem, activeRm] = await Promise.all([
            getActiveRemedialSession(),
            getActiveRoadmapSession(),
          ]);
          const nextRemHist = activeRem?.tutorOpen
            ? mergePendingTutorReplyIntoHistory(activeRem.tutorHistory, message.question, reply.answer)
            : null;
          if (activeRem && nextRemHist) {
            await saveActiveRemedialSession({
              ...activeRem,
              tutorHistory: nextRemHist,
              updatedAt: Date.now(),
            });
          } else {
            const nextRmHist = activeRm?.tutorOpen
              ? mergePendingTutorReplyIntoHistory(activeRm.tutorHistory, message.question, reply.answer)
              : null;
            if (activeRm && nextRmHist) {
              await saveActiveRoadmapSession({
                ...activeRm,
                tutorHistory: nextRmHist,
                updatedAt: Date.now(),
              });
            }
          }
        }
        sendResponse({ ok: true, ...reply });
        break;
      }
      case 'DISMISS_PROMPT': {
        await setCurrentPrompt(null);
        sendResponse({ ok: true });
        break;
      }
      case 'TRIGGER_NOW': {
        const targetTabId = message.tabId ?? sender.tab?.id;
        const resumedAuto = await resumeAutoPromptsIfPausedUntilManual();
        const res = await triggerScheduledQuiz(true, targetTabId);
        sendResponse({ ok: true, resumedAuto, ...res });
        break;
      }
      case 'START_PAGE_QUIZ': {
        const targetTabId = message.tabId ?? sender.tab?.id;
        const res = await triggerPageQuiz(targetTabId);
        sendResponse({ ok: true, ...res });
        break;
      }
      case 'START_LISTENING_QUIZ': {
        const targetTabId = message.tabId ?? sender.tab?.id;
        const res = await triggerListeningQuiz(targetTabId);
        sendResponse({ ok: true, ...res });
        break;
      }
      case 'GET_LISTENING_CHALLENGE': {
        const challenge = await prepareListeningChallenge(message.excludeIds);
        sendResponse({ ok: Boolean(challenge), challenge });
        break;
      }
      case 'RECORD_LISTENING_RESULT': {
        await handleRecordListeningResult(message.cardId, message.isCorrect, Date.now());
        sendResponse({ ok: true });
        break;
      }
      case 'RECORD_PAGE_QUIZ_RESULT': {
        await handleRecordPageQuizResult(message.isCorrect);
        sendResponse({ ok: true });
        break;
      }
      case 'RUN_STORAGE_HYGIENE': {
        const report = await runStorageHygiene(true);
        sendResponse({ ok: true, report });
        break;
      }
      case 'VALIDATE_PAGE_SENTENCES': {
        const aiConfig = await getAiConfig();
        const challenge = await validatePageSentenceCandidates(
          message.candidates,
          message.direction,
          aiConfig
        );
        sendResponse({ ok: true, challenge });
        break;
      }
      case 'EVALUATE_PAGE_TRANSLATION': {
        const aiConfig = await getAiConfig();
        const result = await evaluatePageTranslationWithAi(
          message.sourceSentence,
          message.referenceTranslation,
          message.direction,
          message.userAnswer,
          aiConfig
        );
        sendResponse({ ok: true, result });
        break;
      }
      case 'TOGGLE_BLOCK_HOST': {
        const norm = normalizeBlockedEntry(message.host);
        if (!norm) {
          sendResponse({ ok: false, error: 'Invalid host' });
          break;
        }
        const current = await getSettings();
        const exists = current.blockedDomains.includes(norm);
        const nextBlocked = exists
          ? current.blockedDomains.filter((d) => d !== norm)
          : [...current.blockedDomains, norm];

        await saveSettings({ blockedDomains: nextBlocked });
        await syncContentScriptRegistration();
        const status = await getStatusSnapshot();
        sendResponse({ ok: true, blocked: !exists, domain: norm, status });
        break;
      }
      case 'GET_STATUS': {
        const status = await getStatusSnapshot();
        sendResponse({ ok: true, status });
        break;
      }
      case 'SETTINGS_UPDATED': {
        await syncPeriodicAlarm();
        await syncContentScriptRegistration();
        await syncActionBadge();
        const status = await getStatusSnapshot();
        sendResponse({ ok: true, status });
        break;
      }
      case 'SPEAK_NEURAL_TTS': {
        const settings = await getSettings();
        const voiceMode = message.voiceMode ?? settings.ttsVoiceMode ?? 'mesm_heart';
        const res = await sendToTtsOffscreen({
          action: 'SPEAK',
          text: message.text,
          rate: message.rate,
          queue: message.queue,
          voiceMode,
        });
        sendResponse(res ?? { ok: false, error: 'No response from TTS offscreen' });
        break;
      }
      case 'CANCEL_NEURAL_TTS': {
        const res = await sendToTtsOffscreen({ action: 'CANCEL' });
        sendResponse(res ?? { ok: true });
        break;
      }
      case 'PREPARE_NEURAL_TTS': {
        const settings = await getSettings();
        const voiceMode = message.voiceMode ?? settings.ttsVoiceMode ?? 'mesm_heart';
        const res = await sendToTtsOffscreen({ action: 'PREPARE', voiceMode });
        sendResponse(res ?? { ok: false, error: 'No response from TTS offscreen' });
        break;
      }
      case 'GET_NEURAL_TTS_STATUS': {
        const settings = await getSettings();
        const voiceMode = message.voiceMode ?? settings.ttsVoiceMode ?? 'mesm_heart';
        const res = await sendToTtsOffscreen({ action: 'STATUS', voiceMode });
        sendResponse(res ?? { ok: false });
        break;
      }
      case 'GENERATE_AI_GRAMMAR_COACH': {
        const aiConfig = await getAiConfig();
        const coach = await generateAiGrammarCoach(
          {
            sentenceEn: message.sentenceEn,
            meaningTr: message.meaningTr,
            detectedRules: message.detectedRules,
            language: message.language,
          },
          aiConfig
        );
        sendResponse({ ok: true, coach });
        break;
      }
      case 'SPEAK_TURKISH_COACH': {
        lastCoachTabId = sender.tab?.id ?? null;
        const res = await sendToTtsOffscreen({
          action: 'COACH_SPEAK',
          text: message.text,
          rate: message.rate,
          requestId: message.requestId,
        });
        sendResponse(res ?? { ok: false, error: 'No response from İlkiz TTS offscreen' });
        break;
      }
      case 'CONTROL_TURKISH_COACH': {
        const res = await sendToTtsOffscreen({
          action: 'COACH_CONTROL',
          command: message.command,
          value: message.value,
          requestId: message.requestId,
        });
        sendResponse(res ?? { ok: false });
        break;
      }
      case 'LOOKUP_OFFLINE_WORD': {
        const index = await getBackgroundOfflineDictIndex();
        const entry = lookupOfflineWord(index, message.word);
        sendResponse({ ok: true, entry });
        break;
      }
      default:
        sendResponse({ ok: false, error: 'Unknown message type' });
    }
  })().catch((err) => {
    console.error('[EnTrRecall background error]', err);
    sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
  });

  return true;
});
