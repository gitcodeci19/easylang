import {
  buildAnalyticsSummary,
  ratingToCefrProgress,
  type BucketMetric,
} from '../shared/analytics';
import { getConceptStageSummary } from '../shared/concepts';
import { getRoadmapCourseRank } from '../shared/curriculum';
import {
  ASSISTANT_GUIDE_LABELS,
  type AssistantGuideId,
  playGuideAssistant,
  playGuideOnce,
  stopGuideAssistant,
  toggleGuideAssistant,
} from '../shared/guideAssistant';
import { resolveSupportedLanguage } from '../shared/i18n';
import {
  applyB1PromotionDecision,
  buildInitialProfileForOnboarding,
  getOnboardingCopy,
  shouldShowB1ReadinessPrompt,
  type OnboardingCopy,
} from '../shared/onboarding';
import { RoadmapController } from '../shared/roadmapView';
import { parseBlockedListText } from '../shared/siteFilter';
import {
  DEFAULT_SYSTEM_PROMPT,
  deleteConceptNoteById,
  exportFullBackupJson,
  getAiConfig,
  getAllCards,
  getConceptState,
  getOnboardingState,
  getProgressMap,
  getReviewHistory,
  getRoadmapState,
  getSettings,
  getSkillProfile,
  getUserCards,
  markCardDeleted,
  resetAllProgress,
  restoreFromBackupText,
  saveAiConfig,
  saveOnboardingState,
  saveSettings,
  saveSkillProfile,
  saveUserCards,
  upsertUserCard,
} from '../shared/storage';
import {
  exportCardsAsJson,
  exportCardsAsTsv,
  parseImportedCards,
} from '../shared/textImport';
import type {
  Card,
  CefrLevel,
  ContentMode,
  ExtensionMessage,
  FeedbackLanguageMode,
  NeuralTtsStatus,
  StatusSnapshot,
  UserCardProgress,
} from '../shared/types';
import {
  applyDashboardTranslations,
  getDashboardStrings,
  type DashboardStrings,
} from './i18nDashboard';

const PAGE_SIZE = 40;

let allCards: Card[] = [];
let progressMap: Record<string, UserCardProgress> = {};
let currentPage = 1;
let currentUi: DashboardStrings = getDashboardStrings('auto');

const summaryLine = document.getElementById('summary-line') as HTMLElement;
const topbarLangSelect = document.getElementById('topbar-lang-select') as HTMLSelectElement;
const testPromptBtn = document.getElementById('test-prompt-btn') as HTMLButtonElement;
const resetProgressBtn = document.getElementById('reset-progress-btn') as HTMLButtonElement;

// Tabs
const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab'));
const tabPanels: Record<string, HTMLElement> = {
  roadmap: document.getElementById('tab-roadmap') as HTMLElement,
  settings: document.getElementById('tab-settings') as HTMLElement,
  analytics: document.getElementById('tab-analytics') as HTMLElement,
  ai: document.getElementById('tab-ai') as HTMLElement,
  cards: document.getElementById('tab-cards') as HTMLElement,
};
const optionsRoadmapMount = document.getElementById('options-roadmap-mount') as HTMLElement;
const optionsRoadmap = new RoadmapController({
  container: optionsRoadmapMount,
  uiLanguage: 'auto',
  onStateUpdated: () => {
    void loadSummary();
  },
});

// Settings elements
const settingsForm = document.getElementById('settings-form') as HTMLFormElement;
const intervalMinutesInput = document.getElementById('intervalMinutes') as HTMLInputElement;
const retryDelayMinutesInput = document.getElementById('retryDelayMinutes') as HTMLInputElement;
const contentModeSelect = document.getElementById('contentMode') as HTMLSelectElement;
const levelsGroup = document.getElementById('levels-group') as HTMLElement;
const quietStartInput = document.getElementById('quietHoursStart') as HTMLInputElement;
const quietEndInput = document.getElementById('quietHoursEnd') as HTMLInputElement;
const blockedDomainsInput = document.getElementById('blockedDomains') as HTMLTextAreaElement;
const enabledInput = document.getElementById('enabled') as HTMLInputElement;
const adaptiveDifficultyInput = document.getElementById('adaptiveDifficulty') as HTMLInputElement;
const includeUserCardsInput = document.getElementById('includeUserCards') as HTMLInputElement;

// Analytics elements
const anCefrRating = document.getElementById('an-cefr-rating') as HTMLElement;
const anBandBar = document.getElementById('an-band-bar') as HTMLElement;
const anConfidence = document.getElementById('an-confidence') as HTMLElement;
const anAccuracy = document.getElementById('an-accuracy') as HTMLElement;
const anAnswered = document.getElementById('an-answered') as HTMLElement;
const anSpeed = document.getElementById('an-speed') as HTMLElement;
const anStreak = document.getElementById('an-streak') as HTMLElement;
const analyticsChart = document.getElementById('analytics-chart') as HTMLElement;
const analyticsLevels = document.getElementById('analytics-levels') as HTMLElement;
const analyticsPos = document.getElementById('analytics-pos') as HTMLElement;
const analyticsTopicSummary = document.getElementById('analytics-topic-summary') as HTMLElement;
const analyticsTopics = document.getElementById('analytics-topics') as HTMLElement;
const analyticsHardWords = document.getElementById('analytics-hard-words') as HTMLElement;
const analyticsConcepts = document.getElementById('analytics-concepts') as HTMLElement;
const aiCoachBtn = document.getElementById('ai-coach-btn') as HTMLButtonElement;
const aiCoachOutput = document.getElementById('ai-coach-output') as HTMLElement;
const skipFullscreenInput = document.getElementById('skipFullscreen') as HTMLInputElement;
const autoSpeakInput = document.getElementById('autoSpeak') as HTMLInputElement;
const ttsVoiceModeSelect = document.getElementById('ttsVoiceMode') as HTMLSelectElement;
const neuralTtsStatusEl = document.getElementById('neural-tts-status') as HTMLElement | null;
const neuralTtsTestBtn = document.getElementById('neural-tts-test-btn') as HTMLButtonElement | null;
const autoTranslateInput = document.getElementById('autoTranslateContextMenu') as HTMLInputElement;
const settingsSavedMsg = document.getElementById('settings-saved-msg') as HTMLElement;

// AI settings elements
const aiForm = document.getElementById('ai-form') as HTMLFormElement;
const aiEnabledInput = document.getElementById('ai-enabled') as HTMLInputElement;
const aiAlwaysEvaluateInput = document.getElementById('ai-always-evaluate') as HTMLInputElement;
const aiFeedbackLanguageSelect = document.getElementById('ai-feedback-language') as HTMLSelectElement;
const aiBaseUrlInput = document.getElementById('ai-base-url') as HTMLInputElement;
const aiApiKeyInput = document.getElementById('ai-api-key') as HTMLInputElement;
const aiProviderPreset = document.getElementById('ai-provider-preset') as HTMLSelectElement;
const toggleAiKeyBtn = document.getElementById('toggle-ai-key-btn') as HTMLButtonElement;
const aiModelPreset = document.getElementById('ai-model-preset') as HTMLSelectElement;
const aiModelInput = document.getElementById('ai-model') as HTMLInputElement;
const aiFetchModelsBtn = document.getElementById('ai-fetch-models-btn') as HTMLButtonElement;
const aiSystemPromptInput = document.getElementById('ai-system-prompt') as HTMLTextAreaElement;
const aiResetPromptBtn = document.getElementById('ai-reset-prompt-btn') as HTMLButtonElement;
const aiFallbackEnabledInput = document.getElementById('ai-fallback-enabled') as HTMLInputElement;
const aiFallbackProviderPreset = document.getElementById(
  'ai-fallback-provider-preset'
) as HTMLSelectElement;
const aiFallbackBaseUrlInput = document.getElementById('ai-fallback-base-url') as HTMLInputElement;
const aiFallbackApiKeyInput = document.getElementById('ai-fallback-api-key') as HTMLInputElement;
const aiFallbackModelPreset = document.getElementById('ai-fallback-model-preset') as HTMLSelectElement;
const aiFallbackModelInput = document.getElementById('ai-fallback-model') as HTMLInputElement;
const aiFallbackFetchModelsBtn = document.getElementById('ai-fallback-fetch-models-btn') as HTMLButtonElement;
const aiFallbackTestBtn = document.getElementById('ai-fallback-test-btn') as HTMLButtonElement;
const aiFallback2EnabledInput = document.getElementById('ai-fallback2-enabled') as HTMLInputElement;
const aiFallback2ProviderPreset = document.getElementById(
  'ai-fallback2-provider-preset'
) as HTMLSelectElement;
const aiFallback2BaseUrlInput = document.getElementById('ai-fallback2-base-url') as HTMLInputElement;
const aiFallback2ApiKeyInput = document.getElementById('ai-fallback2-api-key') as HTMLInputElement;
const aiFallback2ModelPreset = document.getElementById('ai-fallback2-model-preset') as HTMLSelectElement;
const aiFallback2ModelInput = document.getElementById('ai-fallback2-model') as HTMLInputElement;
const aiFallback2FetchModelsBtn = document.getElementById('ai-fallback2-fetch-models-btn') as HTMLButtonElement;
const aiFallback2TestBtn = document.getElementById('ai-fallback2-test-btn') as HTMLButtonElement;
const aiAdvancedDetails = document.getElementById('ai-advanced-details') as HTMLDetailsElement | null;
const aiTestBtn = document.getElementById('ai-test-btn') as HTMLButtonElement;
const aiStatusMsg = document.getElementById('ai-status-msg') as HTMLElement;

// Add / Import elements
const addCardForm = document.getElementById('add-card-form') as HTMLFormElement;
const newEnInput = document.getElementById('new-en') as HTMLInputElement;
const newTrInput = document.getElementById('new-tr') as HTMLInputElement;
const newTypeSelect = document.getElementById('new-type') as HTMLSelectElement;
const newLevelSelect = document.getElementById('new-level') as HTMLSelectElement;
const newExEnInput = document.getElementById('new-ex-en') as HTMLInputElement;
const newExTrInput = document.getElementById('new-ex-tr') as HTMLInputElement;
const addCardMsg = document.getElementById('add-card-msg') as HTMLElement;

const importFileInput = document.getElementById('import-file-input') as HTMLInputElement;
const importFileName = document.getElementById('import-file-name') as HTMLElement | null;
const importTextarea = document.getElementById('import-textarea') as HTMLTextAreaElement;
const importBtn = document.getElementById('import-btn') as HTMLButtonElement;
const exportUserTsvBtn = document.getElementById('export-user-tsv-btn') as HTMLButtonElement;
const exportUserJsonBtn = document.getElementById('export-user-json-btn') as HTMLButtonElement;
const importMsg = document.getElementById('import-msg') as HTMLElement;

// Cards browser elements
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const viewFilter = document.getElementById('view-filter') as HTMLSelectElement;
const levelFilter = document.getElementById('level-filter') as HTMLSelectElement;
const cardsCountLabel = document.getElementById('cards-count-label') as HTMLElement;
const cardsTbody = document.getElementById('cards-tbody') as HTMLElement;
const prevPageBtn = document.getElementById('prev-page-btn') as HTMLButtonElement;
const nextPageBtn = document.getElementById('next-page-btn') as HTMLButtonElement;
const pageIndicator = document.getElementById('page-indicator') as HTMLElement;

function switchDashboardTab(target: string): void {
  stopGuideAssistant();
  const validTarget = tabPanels[target] ? target : 'settings';
  for (const b of tabButtons) {
    b.classList.toggle('active', b.dataset.tab === validTarget);
  }
  for (const [key, panel] of Object.entries(tabPanels)) {
    panel.hidden = key !== validTarget;
  }
  if (validTarget !== 'roadmap') {
    document.body.classList.remove('remedial-crimson-active');
    optionsRoadmapMount.replaceChildren();
  }
  if (validTarget === 'cards') {
    void refreshCardsData();
  } else if (validTarget === 'analytics') {
    void renderAnalyticsTab();
  } else if (validTarget === 'roadmap') {
    void optionsRoadmap.refresh();
  }
}

for (const btn of tabButtons) {
  btn.addEventListener('click', () => {
    switchDashboardTab(btn.dataset.tab ?? 'settings');
  });
}

async function loadSummary(): Promise<void> {
  const [res, rmState] = await Promise.all([
    chrome.runtime.sendMessage({
      type: 'GET_STATUS',
    } satisfies ExtensionMessage) as Promise<{ ok: boolean; status?: StatusSnapshot }>,
    getRoadmapState(),
  ]);
  if (!res?.ok || !res.status) return;
  const s = res.status;
  const cefr = ratingToCefrProgress(s.skillProfile.rating);
  const courseRank = getRoadmapCourseRank(rmState);
  summaryLine.textContent =
    `Elo: ${cefr.level} (${s.skillProfile.rating}) · ${currentUi.sumPath}: ${courseRank.courseLevel} (${rmState.xp} XP) · ${s.totalCards} ${currentUi.sumCards} · ` +
    `${s.retryQueueCount} ${currentUi.sumRetry} · ${s.masteredCount} ${currentUi.sumMastered} · ` +
    `${currentUi.sumToday}: ${s.dailyStats.correct}/${s.dailyStats.correct + s.dailyStats.wrong}`;
}

function renderMetricBars(container: HTMLElement, buckets: BucketMetric[]): void {
  container.replaceChildren();
  const hasAny = buckets.some((b) => b.attempts > 0 || b.mastered > 0);
  if (!hasAny) {
    const empty = document.createElement('p');
    empty.className = 'muted small';
    empty.textContent = currentUi.noDataYet;
    container.appendChild(empty);
    return;
  }

  for (const b of buckets) {
    const row = document.createElement('div');
    row.className = 'bar-row';

    const head = document.createElement('div');
    head.className = 'bar-head';
    const left = document.createElement('span');
    left.textContent = b.label;
    const right = document.createElement('span');
    right.className = 'muted';
    right.textContent =
      b.attempts > 0
        ? `${b.accuracy}% (${b.correct}/${b.attempts}) · ${b.mastered} ${currentUi.masteredLabel}`
        : currentUi.noAttemptsYet;
    head.append(left, right);

    const track = document.createElement('div');
    track.className = 'bar-track';
    const fill = document.createElement('div');
    const cls = b.attempts === 0 ? '' : b.accuracy >= 75 ? 'good' : b.accuracy >= 50 ? 'warn' : 'bad';
    fill.className = `bar-fill ${cls}`;
    fill.style.width = `${b.attempts > 0 ? Math.max(4, b.accuracy) : 0}%`;
    track.appendChild(fill);

    row.append(head, track);
    container.appendChild(row);
  }
}

function renderRatingSvgChart(
  container: HTMLElement,
  series: Array<{ rating: number; timestamp: number; isCorrect: boolean }>
): void {
  container.replaceChildren();
  if (series.length < 2) {
    const msg = document.createElement('p');
    msg.className = 'muted small';
    msg.textContent = currentUi.chartMinPoints;
    container.appendChild(msg);
    return;
  }

  const width = 420;
  const height = 140;
  const pad = 16;
  const ratings = series.map((s) => s.rating);
  const minR = Math.min(...ratings, 950) - 20;
  const maxR = Math.max(...ratings, 1050) + 20;
  const range = Math.max(40, maxR - minR);

  const coords = series.map((pt, idx) => {
    const x = pad + (idx / (series.length - 1)) * (width - pad * 2);
    const y = height - pad - ((pt.rating - minR) / range) * (height - pad * 2);
    return { x, y, ...pt };
  });

  const pointsAttr = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const dotsSvg = coords
    .map(
      (c) =>
        `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3.2" fill="${
          c.isCorrect ? '#10b981' : '#f43f5e'
        }"><title>${c.rating} ELO</title></circle>`
    )
    .join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="140" role="img" aria-label="Rating Trajectory Chart">
      <text x="${pad}" y="12" fill="#7a7a8c" font-size="10">${Math.round(maxR)}</text>
      <text x="${pad}" y="${height - 4}" fill="#7a7a8c" font-size="10">${Math.round(minR)}</text>
      <polyline fill="none" stroke="#8b5cf6" stroke-width="2.2" points="${pointsAttr}" />
      ${dotsSvg}
    </svg>
  `;
}

async function renderAnalyticsTab(): Promise<void> {
  const [cards, map, profile, history, conceptState] = await Promise.all([
    getAllCards(),
    getProgressMap(),
    getSkillProfile(),
    getReviewHistory(),
    getConceptState(),
  ]);
  const summary = buildAnalyticsSummary(cards, map, profile, history);

  anCefrRating.textContent = `${summary.cefr.level} · ${summary.profile.rating} ELO`;
  anBandBar.style.width = `${summary.cefr.bandPercent}%`;
  anConfidence.textContent = summary.cefr.nextLevel
    ? `${summary.confidenceLabel} · ${summary.cefr.bandPercent}% ${currentUi.towardLabel} ${summary.cefr.nextLevel}`
    : summary.confidenceLabel;

  anAccuracy.textContent = `${summary.overallAccuracy}%`;
  anAnswered.textContent = `${summary.profile.totalCorrect} / ${summary.profile.totalAnswered} ${currentUi.correctLabel}`;

  anSpeed.textContent =
    summary.avgResponseMs > 0 ? `${(summary.avgResponseMs / 1000).toFixed(1)} s` : '-';
  anStreak.textContent = `${currentUi.currentStreak}: ${summary.profile.currentStreak} · ${currentUi.bestStreak}: ${summary.profile.bestStreak}`;

  renderRatingSvgChart(analyticsChart, summary.ratingSeries);
  renderMetricBars(analyticsLevels, summary.byLevel);
  renderMetricBars(analyticsPos, summary.byPos);
  renderMetricBars(analyticsTopics, summary.byTopic);

  if (summary.strongestTopics.length > 0) {
    const best = summary.strongestTopics[0]!;
    const worst = summary.weakestTopics[0]!;
    analyticsTopicSummary.textContent =
      `${currentUi.strongestPrefix} ${best.label} (${best.accuracy}%)` +
      (worst && worst.key !== best.key ? ` · ${currentUi.needsFocusPrefix} ${worst.label} (${worst.accuracy}%)` : '');
  } else {
    analyticsTopicSummary.textContent = currentUi.topicNeedMore;
  }

  analyticsHardWords.replaceChildren();
  if (summary.hardCards.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted small';
    empty.textContent = currentUi.noHardWords;
    analyticsHardWords.appendChild(empty);
  } else {
    for (const item of summary.hardCards) {
      const row = document.createElement('div');
      row.className = 'hard-item';
      const left = document.createElement('span');
      left.textContent = `${item.card.en} (${item.card.level}) — ${item.card.acceptedTr.slice(0, 2).join(', ')}`;
      const right = document.createElement('span');
      right.className = 'pill retry';
      right.textContent = `${item.progress.totalWrong} ${currentUi.missesLabel}`;
      row.append(left, right);
      analyticsHardWords.appendChild(row);
    }
  }

  analyticsConcepts.replaceChildren();
  if (conceptState.notes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted small';
    empty.textContent = currentUi.noFocusPoints;
    analyticsConcepts.appendChild(empty);
  } else {
    for (const c of conceptState.notes) {
      const cardRow = document.createElement('div');
      cardRow.className = `concept-card ${c.stage >= 3 ? 'mastered' : ''}`;

      const info = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'concept-title';
      title.textContent = `${c.label} (${c.focusToken})`;
      const desc = document.createElement('div');
      desc.className = 'concept-desc';
      desc.textContent = `${c.explanation} · ${currentUi.exampleLabel}: "${c.sourceEn}"`;
      const meta = document.createElement('div');
      meta.className = 'concept-meta';
      meta.textContent = `${getConceptStageSummary(c, profile.totalAnswered)} · (${c.correctCount} ${currentUi.correctLabel} / ${c.wrongCount} ${currentUi.missesLabel})`;
      info.append(title, desc, meta);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-danger-outline btn-mini';
      delBtn.textContent = currentUi.btnRemove;
      delBtn.addEventListener('click', async () => {
        await deleteConceptNoteById(c.id);
        await renderAnalyticsTab();
      });

      cardRow.append(info, delBtn);
      analyticsConcepts.appendChild(cardRow);
    }
  }
}

aiCoachBtn.addEventListener('click', async () => {
  aiCoachBtn.disabled = true;
  aiCoachOutput.hidden = false;
  aiCoachOutput.textContent = currentUi.coachLoading;

  const res = (await chrome.runtime.sendMessage({
    type: 'GENERATE_AI_COACH_REPORT',
  } satisfies ExtensionMessage)) as { ok: boolean; report?: string; error?: string };

  aiCoachBtn.disabled = false;
  if (res?.ok && res.report) {
    aiCoachOutput.textContent = res.report;
  } else {
    aiCoachOutput.textContent = `Error: ${res?.error ?? 'Could not generate report'}`;
  }
});

function syncNumberPresetPills(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.preset-pill[data-preset-for]');
  for (const btn of buttons) {
    const targetId = btn.dataset.presetFor;
    const presetVal = btn.dataset.val;
    const input = targetId ? (document.getElementById(targetId) as HTMLInputElement | null) : null;
    btn.classList.toggle('is-active', Boolean(input && input.value.trim() === presetVal));
  }
}

document.addEventListener('click', (event) => {
  const pill = (event.target as HTMLElement).closest<HTMLButtonElement>('.preset-pill[data-preset-for]');
  if (!pill) return;
  const targetId = pill.dataset.presetFor;
  const presetVal = pill.dataset.val;
  if (!targetId || !presetVal) return;
  const input = document.getElementById(targetId) as HTMLInputElement | null;
  if (!input) return;
  input.value = presetVal;
  syncNumberPresetPills();
});

intervalMinutesInput.addEventListener('input', syncNumberPresetPills);
retryDelayMinutesInput.addEventListener('input', syncNumberPresetPills);

async function loadSettingsIntoForm(): Promise<void> {
  const s = await getSettings();
  intervalMinutesInput.value = String(s.intervalMinutes);
  retryDelayMinutesInput.value = String(s.retryDelayMinutes);
  contentModeSelect.value = s.contentMode;
  quietStartInput.value = s.quietHoursStart !== null ? String(s.quietHoursStart) : '';
  quietEndInput.value = s.quietHoursEnd !== null ? String(s.quietHoursEnd) : '';
  blockedDomainsInput.value = (s.blockedDomains ?? []).join('\n');
  enabledInput.checked = s.enabled;
  adaptiveDifficultyInput.checked = s.adaptiveDifficulty !== false;
  includeUserCardsInput.checked = s.includeUserCards;
  skipFullscreenInput.checked = s.skipFullscreen;
  autoSpeakInput.checked = s.autoSpeak;
  ttsVoiceModeSelect.value = s.ttsVoiceMode ?? 'hybrid';
  autoTranslateInput.checked = s.autoTranslateContextMenu;

  const boxes = Array.from(levelsGroup.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
  for (const box of boxes) {
    box.checked = s.levels.includes(box.value as CefrLevel);
  }
  syncNumberPresetPills();
}

const PROVIDER_PRESETS: Record<string, { baseUrl: string; model: string }> = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'qwen/qwen3.8-27b' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  amd: { baseUrl: 'https://api.tokenlab.amd.com/v1', model: 'DeepSeek-V4-Flash' },
  nvidia: { baseUrl: 'https://integrate.api.nvidia.com/v1', model: 'google/gemma-4-31b-it' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'google/gemma-3-27b-it:free' },
};

function detectProviderPreset(baseUrl: string): string {
  const lower = baseUrl.toLowerCase();
  if (lower.includes('groq.com')) return 'groq';
  if (lower.includes('generativelanguage.googleapis.com')) return 'gemini';
  if (lower.includes('tokenlab.amd.com')) return 'amd';
  if (lower.includes('integrate.api.nvidia.com')) return 'nvidia';
  if (lower.includes('openrouter.ai')) return 'openrouter';
  return 'custom';
}

function syncPresetSelect(selectEl: HTMLSelectElement, modelValue: string): void {
  const hasPreset = Array.from(selectEl.options).some((o) => o.value === modelValue);
  if (hasPreset) {
    selectEl.value = modelValue;
  }
}

interface FreeProviderModelOption {
  id: string;
  noteTr: string;
  noteEn: string;
}

// Highlighted top models per free provider (strictly <= 10 per provider)
const FREE_PROVIDER_TOP_MODELS: Record<'groq' | 'nvidia' | 'amd', FreeProviderModelOption[]> = {
  groq: [
    { id: 'qwen/qwen3.8-27b', noteTr: 'En iyi · Çok hızlı + akıllı', noteEn: 'Top Pick · Fast + smart' },
    { id: 'openai/gpt-oss-120b', noteTr: 'En akıllı 120B · Derin analiz', noteEn: 'Flagship 120B reasoning' },
    { id: 'openai/gpt-oss-20b', noteTr: 'Ultra hızlı (~1000 tok/sn)', noteEn: 'Ultra-fast (~1000 tok/s)' },
    { id: 'llama-3.3-70b-versatile', noteTr: 'Güvenilir 70B sohbet/analiz', noteEn: 'Versatile 70B general' },
    { id: 'llama-3.1-8b-instant', noteTr: 'Anlık · En düşük gecikme', noteEn: 'Instant · Lowest latency' },
    { id: 'qwen/qwen3-32b', noteTr: 'Güçlü çok dilli doğruluk', noteEn: 'Strong multilingual 32B' },
  ],
  nvidia: [
    { id: 'google/gemma-4-31b-it', noteTr: 'Güçlü Gemma 4 · İnce nüans', noteEn: 'Strong Gemma 4 nuance' },
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct', noteTr: 'Yüksek seviye cümle analizi', noteEn: 'High-accuracy Nemotron 70B' },
    { id: 'deepseek-ai/deepseek-v3', noteTr: 'Güçlü genel kavrama', noteEn: 'Strong comprehension' },
    { id: 'deepseek-ai/deepseek-r1', noteTr: 'Derin muhakeme · Yavaş', noteEn: 'Deep reasoning · Slower' },
    { id: 'meta/llama-3.1-70b-instruct', noteTr: 'Dengeli Llama 70B', noteEn: 'Balanced Llama 70B' },
    { id: 'google/gemma-3-12b-it', noteTr: 'Daha seri 12B seçenek', noteEn: 'Lighter 12B option' },
    { id: 'nv-mistralai/mistral-nemo-12b-instruct', noteTr: 'Kompakt çok dilli', noteEn: 'Compact multilingual' },
  ],
  amd: [
    { id: 'DeepSeek-V4-Flash', noteTr: 'Varsayılan · Dengeli & akıllı', noteEn: 'Default · Balanced & smart' },
    { id: 'DeepSeek-V4.1-Flash', noteTr: 'Güncel V4.1 sürümü', noteEn: 'Upgraded DeepSeek V4.1' },
    { id: 'Qwen3.8-27B', noteTr: 'Yüksek TR/EN kalitesi', noteEn: 'High language accuracy' },
    { id: 'Gemma-4-31B-IT', noteTr: 'Güçlü Gemma 4 (31B)', noteEn: 'Strong Gemma 4 (31B)' },
    { id: 'MiniCPM-V-4.7-35B-A3B', noteTr: 'Hafif MoE mimarisi', noteEn: 'Efficient MoE model' },
    { id: 'Qwen3.8-Flash-Next', noteTr: 'Seri Qwen varyantı', noteEn: 'Faster Qwen variant' },
  ],
};

function syncFreeAiChipSelection(): void {
  const activeProvider = aiProviderPreset.value;
  const activeModel = aiModelInput.value.trim();
  const chips = document.querySelectorAll<HTMLButtonElement>('.free-model-chip');
  for (const chip of chips) {
    const match = chip.dataset.provider === activeProvider && chip.dataset.model === activeModel;
    chip.classList.toggle('is-selected', match);
  }
}

interface FreeProviderGuide {
  url: string;
  ctaTr: string;
  ctaEn: string;
  stepsTr: string[];
  stepsEn: string[];
}

const FREE_PROVIDER_GUIDES: Record<'groq' | 'nvidia' | 'amd', FreeProviderGuide> = {
  groq: {
    url: 'https://console.groq.com/keys',
    ctaTr: 'Groq Keys Sayfasını Aç ↗',
    ctaEn: 'Open Groq Keys ↗',
    stepsTr: [
      'Sağdaki linkten console.groq.com/keys sayfasına git ve Google / e-posta ile ücretsiz giriş yap.',
      'Sağ üstteki "Create API Key" butonuna bas ve bir isim yaz (ör. EasyLang).',
      'Oluşan "gsk_..." ile başlayan anahtarı kopyala (pencere kapanınca tekrar gösterilmez).',
      'Aşağıdaki ANA API → API Anahtarı kutusuna yapıştırıp "Kaydet" ve "Bağlantıyı Test Et"e bas.',
    ],
    stepsEn: [
      'Open console.groq.com/keys and sign in for free using Google or email.',
      'Click "Create API Key" and give it any label (e.g. EasyLang).',
      'Copy the generated key starting with "gsk_..." right away (shown once).',
      'Paste it into Primary API → API Key below, then click Save and Test Connection.',
    ],
  },
  nvidia: {
    url: 'https://build.nvidia.com',
    ctaTr: 'NVIDIA Build Sayfasını Aç ↗',
    ctaEn: 'Open NVIDIA Build ↗',
    stepsTr: [
      'build.nvidia.com adresine git ve ücretsiz NVIDIA Developer hesabınla giriş yap (kart gerekmez).',
      'Katalogdan alttaki modellerden birine (ör. Gemma 4 31B) tıkla ve "Get API Key" seç.',
      '"Generate API Key" butonuna tıklayıp "nvapi-..." ile başlayan anahtarı kopyala.',
      'Aşağıda ANA API (veya Yedek API) alanına yapıştır, kaydet ve test et.',
    ],
    stepsEn: [
      'Visit build.nvidia.com and log in with a free NVIDIA account (no credit card needed).',
      'Open any model (e.g. Gemma 4 31B) and click "Get API Key".',
      'Click "Generate API Key" and copy the key starting with "nvapi-...".',
      'Paste it into Primary API (or Backup API) below, save, and test.',
    ],
  },
  amd: {
    url: 'https://developer.amd.com/ai-developer-program/',
    ctaTr: 'AMD Developer Portalı Aç ↗',
    ctaEn: 'Open AMD Developer Portal ↗',
    stepsTr: [
      'developer.amd.com/ai-developer-program adresine git ve "Join / Log In" ile ücretsiz kayıt ol.',
      'Giriş yaptıktan sonra panelden Token Lab (Radeon Cloud) bölümünü aç.',
      '"Get API Key" butonuna tıklayarak sana tanımlanan ücretsiz anahtarı kopyala.',
      'Aşağıdaki ANA API (veya Yedek API 1) alanına yapıştırıp kaydet.',
    ],
    stepsEn: [
      'Go to developer.amd.com/ai-developer-program and register for free (no card required).',
      'Open the Token Lab section inside your developer dashboard.',
      'Click "Get API Key" and copy your free developer API token.',
      'Paste it into Primary API (or Backup API 1) below and click Save.',
    ],
  },
};

function renderFreeAiCatalog(mode: FeedbackLanguageMode): void {
  const isTr = resolveSupportedLanguage(mode) === 'tr';

  const stepContainers = document.querySelectorAll<HTMLElement>('.free-api-steps[data-provider]');
  for (const box of stepContainers) {
    const provider = box.dataset.provider as 'groq' | 'nvidia' | 'amd' | undefined;
    const guide = provider ? FREE_PROVIDER_GUIDES[provider] : undefined;
    if (!guide) continue;
    box.replaceChildren();

    const headRow = document.createElement('div');
    headRow.className = 'free-steps-head';
    const title = document.createElement('span');
    title.className = 'free-steps-title';
    title.textContent = isTr ? '🔑 Adım Adım API Anahtarı Alma' : '🔑 Step-by-Step API Key Setup';

    const link = document.createElement('a');
    link.className = 'free-steps-link';
    link.href = guide.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = isTr ? guide.ctaTr : guide.ctaEn;

    headRow.append(title, link);

    const ol = document.createElement('ol');
    ol.className = 'free-steps-ol';
    const steps = isTr ? guide.stepsTr : guide.stepsEn;
    steps.forEach((stepText, idx) => {
      const li = document.createElement('li');
      const num = document.createElement('span');
      num.className = 'free-step-num';
      num.textContent = String(idx + 1);
      const txt = document.createElement('span');
      txt.textContent = stepText;
      li.append(num, txt);
      ol.appendChild(li);
    });

    box.append(headRow, ol);
  }

  const grids = document.querySelectorAll<HTMLElement>('.free-models-grid[data-provider]');
  for (const grid of grids) {
    const provider = grid.dataset.provider as 'groq' | 'nvidia' | 'amd' | undefined;
    if (!provider || !FREE_PROVIDER_TOP_MODELS[provider]) continue;
    grid.replaceChildren();

    const existingLabel = grid.previousElementSibling;
    if (!existingLabel || !existingLabel.classList.contains('free-models-label')) {
      const lbl = document.createElement('div');
      lbl.className = 'free-models-label';
      lbl.textContent = isTr
        ? 'Desteklediği En İyi Modeller (Seçmek için tıkla):'
        : 'Top Supported Models (Click to select):';
      grid.parentElement?.insertBefore(lbl, grid);
    } else {
      existingLabel.textContent = isTr
        ? 'Desteklediği En İyi Modeller (Seçmek için tıkla):'
        : 'Top Supported Models (Click to select):';
    }

    for (const item of FREE_PROVIDER_TOP_MODELS[provider]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'free-model-chip';
      btn.dataset.provider = provider;
      btn.dataset.model = item.id;

      const idSpan = document.createElement('span');
      idSpan.className = 'free-model-id';
      idSpan.textContent = item.id;

      const noteSpan = document.createElement('span');
      noteSpan.className = 'free-model-note';
      noteSpan.textContent = isTr ? item.noteTr : item.noteEn;

      btn.append(idSpan, noteSpan);
      btn.addEventListener('click', () => {
        const preset = PROVIDER_PRESETS[provider];
        if (!preset) return;
        aiProviderPreset.value = provider;
        aiBaseUrlInput.value = preset.baseUrl;
        aiModelInput.value = item.id;

        if (!Array.from(aiModelPreset.options).some((o) => o.value === item.id)) {
          const opt = document.createElement('option');
          opt.value = item.id;
          opt.textContent = `${provider.toUpperCase()} · ${item.id}`;
          aiModelPreset.appendChild(opt);
        }
        aiModelPreset.value = item.id;
        syncFreeAiChipSelection();
        aiStatusMsg.hidden = false;
        aiStatusMsg.textContent = `${provider.toUpperCase()} · ${item.id}`;
        if (!aiApiKeyInput.value.trim()) {
          aiApiKeyInput.focus();
        }
      });
      grid.appendChild(btn);
    }
  }
  syncFreeAiChipSelection();
}

async function loadAiConfigIntoForm(): Promise<void> {
  const ai = await getAiConfig();
  aiEnabledInput.checked = ai.enabled;
  aiAlwaysEvaluateInput.checked = ai.alwaysEvaluate !== false;
  aiFeedbackLanguageSelect.value = ai.feedbackLanguage ?? 'auto';
  aiBaseUrlInput.value = ai.baseUrl;
  aiApiKeyInput.value = ai.apiKey;
  aiModelInput.value = ai.model;
  aiSystemPromptInput.value = ai.systemPrompt;
  aiProviderPreset.value = detectProviderPreset(ai.baseUrl);
  syncPresetSelect(aiModelPreset, ai.model);

  aiFallbackEnabledInput.checked = Boolean(ai.fallbackEnabled);
  aiFallbackBaseUrlInput.value = ai.fallbackBaseUrl ?? 'https://api.tokenlab.amd.com/v1';
  aiFallbackApiKeyInput.value = ai.fallbackApiKey ?? '';
  aiFallbackModelInput.value = ai.fallbackModel ?? 'DeepSeek-V4-Flash';
  aiFallbackProviderPreset.value = detectProviderPreset(aiFallbackBaseUrlInput.value);
  syncPresetSelect(aiFallbackModelPreset, aiFallbackModelInput.value);

  aiFallback2EnabledInput.checked = Boolean(ai.fallback2Enabled);
  aiFallback2BaseUrlInput.value = ai.fallback2BaseUrl ?? 'https://integrate.api.nvidia.com/v1';
  aiFallback2ApiKeyInput.value = ai.fallback2ApiKey ?? '';
  aiFallback2ModelInput.value = ai.fallback2Model ?? 'google/gemma-4-31b-it';
  aiFallback2ProviderPreset.value = detectProviderPreset(aiFallback2BaseUrlInput.value);
  syncPresetSelect(aiFallback2ModelPreset, aiFallback2ModelInput.value);
  syncFreeAiChipSelection();
}

async function persistAiForm(): Promise<void> {
  await saveAiConfig({
    enabled: aiEnabledInput.checked,
    alwaysEvaluate: aiAlwaysEvaluateInput.checked,
    feedbackLanguage: (aiFeedbackLanguageSelect.value || 'auto') as FeedbackLanguageMode,
    baseUrl: aiBaseUrlInput.value.trim(),
    apiKey: aiApiKeyInput.value.trim(),
    model: aiModelInput.value.trim(),
    systemPrompt: aiSystemPromptInput.value.trim() || DEFAULT_SYSTEM_PROMPT,
    fallbackEnabled: aiFallbackEnabledInput.checked,
    fallbackBaseUrl: aiFallbackBaseUrlInput.value.trim(),
    fallbackApiKey: aiFallbackApiKeyInput.value.trim(),
    fallbackModel: aiFallbackModelInput.value.trim(),
    fallback2Enabled: aiFallback2EnabledInput.checked,
    fallback2BaseUrl: aiFallback2BaseUrlInput.value.trim(),
    fallback2ApiKey: aiFallback2ApiKeyInput.value.trim(),
    fallback2Model: aiFallback2ModelInput.value.trim(),
  });
}

function wireProviderPreset(
  presetSelect: HTMLSelectElement,
  baseUrlInput: HTMLInputElement,
  modelInput: HTMLInputElement,
  modelPresetSelect: HTMLSelectElement,
  apiKeyInput: HTMLInputElement
): void {
  presetSelect.addEventListener('change', () => {
    if (presetSelect.value === 'custom') {
      if (aiAdvancedDetails) aiAdvancedDetails.open = true;
      baseUrlInput.focus();
      return;
    }
    const preset = PROVIDER_PRESETS[presetSelect.value];
    if (!preset) return;
    baseUrlInput.value = preset.baseUrl;
    modelInput.value = preset.model;
    syncPresetSelect(modelPresetSelect, preset.model);
    apiKeyInput.focus();
  });
}

wireProviderPreset(
  aiProviderPreset,
  aiBaseUrlInput,
  aiModelInput,
  aiModelPreset,
  aiApiKeyInput
);
wireProviderPreset(
  aiFallbackProviderPreset,
  aiFallbackBaseUrlInput,
  aiFallbackModelInput,
  aiFallbackModelPreset,
  aiFallbackApiKeyInput
);
wireProviderPreset(
  aiFallback2ProviderPreset,
  aiFallback2BaseUrlInput,
  aiFallback2ModelInput,
  aiFallback2ModelPreset,
  aiFallback2ApiKeyInput
);

function syncDashboardGuideButtons(mode: FeedbackLanguageMode): void {
  const isTr = resolveSupportedLanguage(mode) === 'tr';
  document
    .querySelectorAll<HTMLButtonElement>('.tab-guide-row .el-help-trigger[data-guide-id]')
    .forEach((btn) => {
      const gid = btn.dataset.guideId as AssistantGuideId | undefined;
      if (!gid || !(gid in ASSISTANT_GUIDE_LABELS)) return;
      const meta = ASSISTANT_GUIDE_LABELS[gid];
      btn.title = isTr
        ? `${meta.tr} (Sesli anlatım · Durdurmak için tekrar tıkla)`
        : `${meta.en} (Voice guide · Click again to stop)`;
      const lbl = btn.querySelector<HTMLElement>('.el-help-label');
      if (lbl) {
        lbl.textContent = isTr ? 'Bu ne işe yarıyor?' : 'How does this work?';
      }
    });
}

document
  .querySelectorAll<HTMLButtonElement>('.tab-guide-row .el-help-trigger[data-guide-id]')
  .forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const gid = btn.dataset.guideId as AssistantGuideId | undefined;
      if (!gid || !(gid in ASSISTANT_GUIDE_LABELS)) return;
      const lang = (topbarLangSelect.value || 'auto') as FeedbackLanguageMode;
      toggleGuideAssistant(gid, {
        isTr: resolveSupportedLanguage(lang) === 'tr',
        triggerEl: btn,
      });
    });
  });

window.addEventListener('pagehide', () => stopGuideAssistant());
window.addEventListener('beforeunload', () => stopGuideAssistant());

function applyLanguageMode(mode: FeedbackLanguageMode): void {
  currentUi = applyDashboardTranslations(mode);
  syncDashboardGuideButtons(mode);
  topbarLangSelect.value = mode;
  aiFeedbackLanguageSelect.value = mode;
  const revealed = aiApiKeyInput.type === 'text';
  toggleAiKeyBtn.textContent = revealed ? currentUi.btnHide : currentUi.btnShow;
  renderFreeAiCatalog(mode);
  void loadSummary();
  void refreshDashboardBanners();
  if (tabPanels.analytics && !tabPanels.analytics.hidden) {
    void renderAnalyticsTab();
  }
  if (tabPanels.cards && !tabPanels.cards.hidden) {
    renderCardsTable();
  }
  if (tabPanels.roadmap && !tabPanels.roadmap.hidden) {
    void optionsRoadmap.setLanguage(mode);
  } else {
    void optionsRoadmap.setLanguage(mode, false);
  }
}

async function handleLanguageChange(mode: FeedbackLanguageMode): Promise<void> {
  applyLanguageMode(mode);
  await Promise.all([
    saveAiConfig({ feedbackLanguage: mode }),
    saveSettings({ uiLanguage: mode }),
  ]);
  await chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' } satisfies ExtensionMessage);
  aiStatusMsg.hidden = false;
  aiStatusMsg.textContent = currentUi.msgSaved;
  window.setTimeout(() => {
    aiStatusMsg.hidden = true;
  }, 2000);
}

topbarLangSelect.addEventListener('change', () => {
  const mode = (topbarLangSelect.value || 'auto') as FeedbackLanguageMode;
  void handleLanguageChange(mode);
});

aiFeedbackLanguageSelect.addEventListener('change', () => {
  const mode = (aiFeedbackLanguageSelect.value || 'auto') as FeedbackLanguageMode;
  void handleLanguageChange(mode);
});

toggleAiKeyBtn.addEventListener('click', () => {
  const reveal = aiApiKeyInput.type === 'password';
  aiApiKeyInput.type = reveal ? 'text' : 'password';
  toggleAiKeyBtn.textContent = reveal ? currentUi.btnHide : currentUi.btnShow;
});

aiModelPreset.addEventListener('change', () => {
  aiModelInput.value = aiModelPreset.value;
  syncFreeAiChipSelection();
});

aiModelInput.addEventListener('input', syncFreeAiChipSelection);
aiProviderPreset.addEventListener('change', syncFreeAiChipSelection);

aiFallbackModelPreset.addEventListener('change', () => {
  aiFallbackModelInput.value = aiFallbackModelPreset.value;
});

aiFallback2ModelPreset.addEventListener('change', () => {
  aiFallback2ModelInput.value = aiFallback2ModelPreset.value;
});

aiResetPromptBtn.addEventListener('click', () => {
  aiSystemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
});

aiForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  await persistAiForm();
  await refreshDashboardBanners();
  aiStatusMsg.hidden = false;
  aiStatusMsg.textContent = currentUi.msgAiSaved;
  window.setTimeout(() => {
    aiStatusMsg.hidden = true;
  }, 2500);
});

async function handleFetchModels(
  messageType: 'FETCH_AI_MODELS' | 'FETCH_FALLBACK_AI_MODELS' | 'FETCH_FALLBACK2_AI_MODELS',
  triggerBtn: HTMLButtonElement,
  modelInput: HTMLInputElement,
  presetSelect: HTMLSelectElement
): Promise<void> {
  await persistAiForm();
  triggerBtn.disabled = true;
  aiStatusMsg.hidden = false;
  aiStatusMsg.textContent = currentUi.msgFetchingModels;
  const res = (await chrome.runtime.sendMessage({
    type: messageType,
  } satisfies ExtensionMessage)) as { ok: boolean; models?: string[]; error?: string };
  triggerBtn.disabled = false;

  if (res?.ok && res.models && res.models.length > 0) {
    const current = modelInput.value.trim();
    presetSelect.replaceChildren();
    for (const id of res.models) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = id;
      presetSelect.appendChild(opt);
    }
    if (res.models.includes(current)) {
      presetSelect.value = current;
    }
    aiStatusMsg.textContent = `${res.models.length} ✓`;
  } else {
    aiStatusMsg.textContent = `Error: ${res?.error ?? 'Could not fetch models'}`;
  }
}

async function handleTestConnection(
  messageType: 'TEST_AI_CONNECTION' | 'TEST_FALLBACK_AI_CONNECTION' | 'TEST_FALLBACK2_AI_CONNECTION',
  triggerBtn: HTMLButtonElement
): Promise<void> {
  await persistAiForm();
  triggerBtn.disabled = true;
  aiStatusMsg.hidden = false;
  aiStatusMsg.textContent = currentUi.msgTesting;
  const res = (await chrome.runtime.sendMessage({
    type: messageType,
  } satisfies ExtensionMessage)) as {
    ok: boolean;
    result?: { ok: boolean; reply: string };
    error?: string;
  };
  triggerBtn.disabled = false;
  if (res?.ok && res.result) {
    aiStatusMsg.textContent = `OK ✓ (${res.result.reply})`;
  } else {
    aiStatusMsg.textContent = `Error: ${res?.error ?? 'Connection test failed'}`;
  }
}

aiFetchModelsBtn.addEventListener('click', () => {
  void handleFetchModels('FETCH_AI_MODELS', aiFetchModelsBtn, aiModelInput, aiModelPreset);
});

aiFallbackFetchModelsBtn.addEventListener('click', () => {
  void handleFetchModels(
    'FETCH_FALLBACK_AI_MODELS',
    aiFallbackFetchModelsBtn,
    aiFallbackModelInput,
    aiFallbackModelPreset
  );
});

aiFallback2FetchModelsBtn.addEventListener('click', () => {
  void handleFetchModels(
    'FETCH_FALLBACK2_AI_MODELS',
    aiFallback2FetchModelsBtn,
    aiFallback2ModelInput,
    aiFallback2ModelPreset
  );
});

aiTestBtn.addEventListener('click', () => {
  void handleTestConnection('TEST_AI_CONNECTION', aiTestBtn);
});

aiFallbackTestBtn.addEventListener('click', () => {
  void handleTestConnection('TEST_FALLBACK_AI_CONNECTION', aiFallbackTestBtn);
});

aiFallback2TestBtn.addEventListener('click', () => {
  void handleTestConnection('TEST_FALLBACK2_AI_CONNECTION', aiFallback2TestBtn);
});

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const checkedLevels = Array.from(
    levelsGroup.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')
  ).map((b) => b.value as CefrLevel);

  const parseHour = (val: string): number | null => {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isInteger(n) && n >= 0 && n <= 23 ? n : null;
  };

  await saveSettings({
    intervalMinutes: Math.max(1, Number(intervalMinutesInput.value) || 20),
    retryDelayMinutes: Math.max(1, Number(retryDelayMinutesInput.value) || 20),
    contentMode: contentModeSelect.value as ContentMode,
    levels: checkedLevels.length > 0 ? checkedLevels : ['A1', 'A2', 'B1', 'B2', 'C1'],
    quietHoursStart: parseHour(quietStartInput.value),
    quietHoursEnd: parseHour(quietEndInput.value),
    blockedDomains: parseBlockedListText(blockedDomainsInput.value),
    enabled: enabledInput.checked,
    adaptiveDifficulty: adaptiveDifficultyInput.checked,
    includeUserCards: includeUserCardsInput.checked,
    skipFullscreen: skipFullscreenInput.checked,
    autoSpeak: autoSpeakInput.checked,
    ttsVoiceMode: (ttsVoiceModeSelect.value || 'hybrid') as 'hybrid' | 'neural' | 'natural' | 'local',
    autoTranslateContextMenu: autoTranslateInput.checked,
  });

  await chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' } satisfies ExtensionMessage);
  settingsSavedMsg.hidden = false;
  window.setTimeout(() => {
    settingsSavedMsg.hidden = true;
  }, 2500);
  void loadSummary();
});

addCardForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const en = newEnInput.value.trim();
  const acceptedTr = newTrInput.value
    .split(/[,;|]/)
    .map((v) => v.trim())
    .filter(Boolean);

  if (!en || acceptedTr.length === 0) return;

  const card: Card = {
    id: `u_${Date.now().toString(36)}`,
    type: newTypeSelect.value as 'word' | 'sentence',
    level: newLevelSelect.value as CefrLevel,
    pos: newTypeSelect.value === 'sentence' ? 'sentence' : 'custom',
    en,
    phonetic: '',
    acceptedTr,
    exampleEn: newExEnInput.value.trim(),
    exampleTr: newExTrInput.value.trim(),
    source: 'user',
    createdAt: Date.now(),
  };

  await upsertUserCard(card);
  addCardForm.reset();
  newLevelSelect.value = 'B1';
  addCardMsg.hidden = false;
  window.setTimeout(() => {
    addCardMsg.hidden = true;
  }, 2500);
  await refreshCardsData();
  await loadSummary();
});

importFileInput.addEventListener('change', async () => {
  const file = importFileInput.files?.[0];
  if (!file) {
    if (importFileName) importFileName.textContent = currentUi.noFileSelected;
    return;
  }
  if (importFileName) importFileName.textContent = file.name;
  importTextarea.value = await file.text();
});

importBtn.addEventListener('click', async () => {
  const { cards, errors } = parseImportedCards(importTextarea.value);
  importMsg.hidden = false;

  if (cards.length === 0) {
    importMsg.textContent = errors.join(' | ') || 'No valid cards found to import.';
    return;
  }

  const existing = await getUserCards();
  await saveUserCards([...cards, ...existing]);
  importTextarea.value = '';
  importFileInput.value = '';
  if (importFileName) importFileName.textContent = currentUi.noFileSelected;
  importMsg.textContent = `Successfully imported ${cards.length} card${cards.length === 1 ? '' : 's'}.${
    errors.length > 0 ? ` (${errors.length} line${errors.length === 1 ? '' : 's'} skipped)` : ''
  }`;
  await refreshCardsData();
  await loadSummary();
});

function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

exportUserTsvBtn.addEventListener('click', async () => {
  const cards = await getUserCards();
  triggerDownload('easylang-user-cards.tsv', exportCardsAsTsv(cards), 'text/tab-separated-values');
});

exportUserJsonBtn.addEventListener('click', async () => {
  const cards = await getUserCards();
  triggerDownload('easylang-user-cards.json', exportCardsAsJson(cards), 'application/json');
});

function getFilteredCards(): Card[] {
  const q = searchInput.value.trim().toLocaleLowerCase('tr-TR');
  const view = viewFilter.value;
  const lvl = levelFilter.value;

  return allCards.filter((c) => {
    if (lvl !== 'ALL' && c.level !== lvl) return false;
    const prog = progressMap[c.id];

    if (view === 'retry' && (!prog || prog.retryAt === null)) return false;
    if (view === 'hard' && (!prog || prog.totalWrong === 0)) return false;
    if (view === 'user' && c.source !== 'user') return false;
    if (view === 'word' && c.type !== 'word') return false;
    if (view === 'sentence' && c.type !== 'sentence') return false;

    if (q) {
      const hayEn = c.en.toLowerCase();
      const hayTr = c.acceptedTr.join(' ').toLocaleLowerCase('tr-TR');
      if (!hayEn.includes(q) && !hayTr.includes(q)) return false;
    }
    return true;
  });
}

function renderCardsTable(): void {
  const filtered = getFilteredCards();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  cardsCountLabel.textContent = `${filtered.length} ${currentUi.showingCards}`;
  pageIndicator.textContent = `${currentPage} / ${totalPages}`;
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;

  cardsTbody.replaceChildren();

  for (const card of slice) {
    const tr = document.createElement('tr');
    const prog = progressMap[card.id];

    const tdMeta = document.createElement('td');
    const typeLabel = card.type === 'sentence' ? currentUi.optSentence : currentUi.optWord;
    const metaPill = document.createElement('span');
    metaPill.className = 'pill';
    metaPill.textContent = `${card.level} · ${typeLabel}`;
    tdMeta.appendChild(metaPill);
    if (card.source === 'user') {
      const customPill = document.createElement('span');
      customPill.className = 'pill ok';
      customPill.textContent = currentUi.badgeCustom;
      tdMeta.append(' ', customPill);
    }

    const tdEn = document.createElement('td');
    tdEn.textContent = card.en;

    const tdTr = document.createElement('td');
    tdTr.textContent = card.acceptedTr.join(', ');

    const tdStatus = document.createElement('td');
    if (prog?.retryAt) {
      const mins = Math.max(0, Math.ceil((prog.retryAt - Date.now()) / 60_000));
      const retryPill = document.createElement('span');
      retryPill.className = 'pill retry';
      retryPill.textContent = `${currentUi.statusRetry} (${mins}m)`;
      tdStatus.appendChild(retryPill);
    } else if (prog && prog.streak > 0) {
      const okPill = document.createElement('span');
      okPill.className = 'pill ok';
      okPill.textContent = `${currentUi.statusStreak}: ${prog.streak} (${prog.intervalDays}d)`;
      tdStatus.appendChild(okPill);
    } else {
      tdStatus.textContent = currentUi.statusNew;
    }

    const tdAction = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-danger-outline btn-mini';
    delBtn.textContent = currentUi.btnRemove;
    delBtn.addEventListener('click', async () => {
      await markCardDeleted(card.id);
      await refreshCardsData();
      await loadSummary();
    });
    tdAction.appendChild(delBtn);

    tr.append(tdMeta, tdEn, tdTr, tdStatus, tdAction);
    cardsTbody.appendChild(tr);
  }
}

async function refreshCardsData(): Promise<void> {
  [allCards, progressMap] = await Promise.all([getAllCards(), getProgressMap()]);
  renderCardsTable();
}

searchInput.addEventListener('input', () => {
  currentPage = 1;
  renderCardsTable();
});
viewFilter.addEventListener('change', () => {
  currentPage = 1;
  renderCardsTable();
});
levelFilter.addEventListener('change', () => {
  currentPage = 1;
  renderCardsTable();
});
prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage -= 1;
    renderCardsTable();
  }
});
nextPageBtn.addEventListener('click', () => {
  currentPage += 1;
  renderCardsTable();
});

testPromptBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'TRIGGER_NOW' } satisfies ExtensionMessage);
});

const DASH_OB_LANG_CHOICES: Array<{ code: FeedbackLanguageMode; label: string }> = [
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

const DASH_CEFR_RANK: Record<CefrLevel, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

function downloadJsonFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

let dashBannersBound = false;
let noApiBarDismissed = false;

async function refreshDashboardBanners(): Promise<void> {
  const b1Banner = document.getElementById('b1-ready-banner-dash');
  const b1Title = document.getElementById('dash-b1-title');
  const b1Desc = document.getElementById('dash-b1-desc');
  const b1AcceptBtn = document.getElementById('dash-b1-accept');
  const b1DeferBtn = document.getElementById('dash-b1-defer');

  const backupBar = document.getElementById('backup-status-bar');
  const backupDot = document.getElementById('backup-bar-dot');
  const backupStatus = document.getElementById('backup-bar-status');
  const backupKeyNote = document.getElementById('backup-bar-key-note');
  const backupDesc = document.getElementById('backup-bar-desc');
  const backupExportBtn = document.getElementById('backup-bar-export-btn');
  const backupImportFile = document.getElementById('backup-bar-import-file') as HTMLInputElement | null;
  const backupImportText = document.getElementById('backup-bar-import-text');

  const noApiBar = document.getElementById('no-api-nudge-bar');
  const noApiBarTitle = document.getElementById('no-api-bar-title');
  const noApiBarDesc = document.getElementById('no-api-bar-desc');
  const noApiSetupBtn = document.getElementById('no-api-setup-btn');
  const noApiDismissBtn = document.getElementById('no-api-dismiss-btn');

  const [onboarding, skillProfile, settings, ai] = await Promise.all([
    getOnboardingState(),
    getSkillProfile(),
    getSettings(),
    getAiConfig(),
  ]);

  const langMode =
    settings.uiLanguage && settings.uiLanguage !== 'auto'
      ? settings.uiLanguage
      : ai.feedbackLanguage ?? 'auto';
  const copy = getOnboardingCopy(langMode);

  if (!dashBannersBound) {
    dashBannersBound = true;

    b1AcceptBtn?.addEventListener('click', () => {
      void (async () => {
        const [curOb, curSettings] = await Promise.all([getOnboardingState(), getSettings()]);
        const decision = applyB1PromotionDecision(curOb, curSettings, true);
        await Promise.all([
          saveOnboardingState(decision.nextOnboarding),
          saveSettings({ ...curSettings, levels: decision.nextLevels }),
        ]);
        await chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' } satisfies ExtensionMessage);
        await Promise.all([loadSettingsIntoForm(), loadSummary(), refreshDashboardBanners()]);
      })();
    });

    b1DeferBtn?.addEventListener('click', () => {
      void (async () => {
        const [curOb, curSettings] = await Promise.all([getOnboardingState(), getSettings()]);
        const decision = applyB1PromotionDecision(curOb, curSettings, false);
        await saveOnboardingState(decision.nextOnboarding);
        await chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' } satisfies ExtensionMessage);
        await refreshDashboardBanners();
      })();
    });

    backupExportBtn?.addEventListener('click', () => {
      void (async () => {
        const { json, filename } = await exportFullBackupJson();
        downloadJsonFile(filename, json);
        await saveOnboardingState({ lastBackupAt: Date.now() });
        await refreshDashboardBanners();
      })();
    });

    backupImportFile?.addEventListener('change', () => {
      const file = backupImportFile.files?.[0];
      if (!file) return;
      void (async () => {
        const text = await file.text();
        const res = await restoreFromBackupText(text);
        backupImportFile.value = '';
        if (!res.ok) {
          window.alert(copy.restoreError);
          return;
        }
        await chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' } satisfies ExtensionMessage);
        await Promise.all([
          loadSummary(),
          loadSettingsIntoForm(),
          loadAiConfigIntoForm(),
          refreshCardsData(),
          refreshDashboardBanners(),
        ]);
      })();
    });

    noApiSetupBtn?.addEventListener('click', () => {
      switchDashboardTab('ai');
      const groqDetails = document.querySelector<HTMLDetailsElement>(
        '.free-api-item[data-provider="groq"]'
      );
      if (groqDetails) groqDetails.open = true;
      aiApiKeyInput.focus();
    });

    noApiDismissBtn?.addEventListener('click', () => {
      noApiBarDismissed = true;
      if (noApiBar) noApiBar.hidden = true;
    });
  }

  if (b1Banner) {
    const showB1 = shouldShowB1ReadinessPrompt(onboarding, skillProfile, settings);
    b1Banner.hidden = !showB1;
    if (showB1) {
      if (b1Title) b1Title.textContent = copy.b1ReadyTitle;
      if (b1Desc) b1Desc.textContent = copy.b1ReadyDesc;
      if (b1AcceptBtn) b1AcceptBtn.textContent = copy.b1ReadyYes;
      if (b1DeferBtn) b1DeferBtn.textContent = copy.b1ReadyNo;
    }
  }

  if (backupBar) {
    backupBar.hidden = !onboarding.completed;
    if (onboarding.completed) {
      const isRecent =
        onboarding.lastBackupAt !== null && Date.now() - onboarding.lastBackupAt < 14 * 86_400_000;
      backupBar.classList.toggle('needs-backup', !isRecent);
      backupDot?.classList.toggle('is-ok', isRecent);

      if (backupStatus) {
        if (onboarding.lastBackupAt === null) {
          backupStatus.textContent = copy.backupStatusNever;
        } else {
          const locale = resolveSupportedLanguage(langMode);
          const dateLabel = new Date(onboarding.lastBackupAt).toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
          backupStatus.textContent = copy.backupStatusLastFmt(dateLabel);
        }
      }
      if (backupKeyNote) backupKeyNote.textContent = `(${copy.backupKeyNotice})`;
      if (backupDesc) backupDesc.textContent = copy.backupNudgeDash;
      if (backupExportBtn) backupExportBtn.textContent = copy.backupBtnNow;
      if (backupImportText) backupImportText.textContent = copy.backupBtnUpload;
    }
  }

  if (noApiBar) {
    const hasAnyKey = Boolean(
      ai.apiKey?.trim() || ai.fallbackApiKey?.trim() || ai.fallback2ApiKey?.trim()
    );
    const showNoApi = onboarding.completed && !hasAnyKey && !noApiBarDismissed;
    noApiBar.hidden = !showNoApi;
    if (showNoApi) {
      if (noApiBarTitle) noApiBarTitle.textContent = currentUi.noApiTitle;
      if (noApiBarDesc) noApiBarDesc.textContent = currentUi.noApiDesc;
      if (noApiSetupBtn) noApiSetupBtn.textContent = currentUi.noApiBtn;
    }
  }
}

function applyDashOnboardingCopy(
  copy: OnboardingCopy,
  currentLevel: CefrLevel,
  targetLevel: CefrLevel
): void {
  const setText = (id: string, value: string): void => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText('dash-ob-choice-title', copy.title);
  setText('dash-ob-choice-sub', copy.subtitle);
  setText('dash-ob-new-title', copy.btnFirstTime);
  setText('dash-ob-new-sub', copy.btnFirstTimeSub);
  setText('dash-ob-returning-title', copy.btnReturning);
  setText('dash-ob-returning-sub', copy.btnReturningSub);
  setText('dash-ob-back-new', copy.backBtn);
  setText('dash-ob-back-ret', copy.backBtn);
  setText('dash-ob-form-title', copy.btnFirstTime);
  setText('dash-ob-native-label', copy.lblNativeLang);
  setText('dash-ob-current-label', copy.lblCurrentLevel);
  setText('dash-ob-target-label', copy.lblTargetLevel);
  setText('dash-ob-start-btn', copy.btnStartLearning);
  setText('dash-ob-restore-title', copy.restoreTitle);
  setText('dash-ob-restore-sub', copy.restoreDesc);
  setText('dash-ob-file-label', copy.restoreUploadBtn);
  setText('dash-ob-restore-btn', copy.restoreConfirmBtn);
  setText('dash-ob-skip-btn', copy.restoreSkipBtn);

  const textarea = document.getElementById('dash-ob-backup-text') as HTMLTextAreaElement | null;
  if (textarea) textarea.placeholder = copy.restorePlaceholder;

  const noticeEl = document.getElementById('dash-ob-cap-notice');
  if (noticeEl) {
    const showCap =
      (currentLevel === 'A1' || currentLevel === 'A2') &&
      (DASH_CEFR_RANK[targetLevel] ?? 1) >= DASH_CEFR_RANK.B1;
    noticeEl.textContent = copy.a1CapNotice;
    noticeEl.hidden = !showCap;
  }
}

async function ensureDashboardOnboarding(): Promise<boolean> {
  const onboarding = await getOnboardingState();
  if (onboarding.completed) return false;

  const overlay = document.getElementById('options-onboarding');
  if (!overlay) return false;

  const stepChoice = document.getElementById('dash-ob-step-choice');
  const stepNew = document.getElementById('dash-ob-step-new');
  const stepRet = document.getElementById('dash-ob-step-returning');
  const chooseNewBtn = document.getElementById('dash-ob-choose-new');
  const chooseRetBtn = document.getElementById('dash-ob-choose-returning');
  const backNewBtn = document.getElementById('dash-ob-back-new');
  const backRetBtn = document.getElementById('dash-ob-back-ret');
  const langSelect = document.getElementById('dash-ob-native-lang') as HTMLSelectElement | null;
  const curWrap = document.getElementById('dash-ob-cur-levels');
  const tgtWrap = document.getElementById('dash-ob-tgt-levels');
  const startBtn = document.getElementById('dash-ob-start-btn') as HTMLButtonElement | null;
  const fileInput = document.getElementById('dash-ob-backup-file') as HTMLInputElement | null;
  const textarea = document.getElementById('dash-ob-backup-text') as HTMLTextAreaElement | null;
  const errEl = document.getElementById('dash-ob-restore-error');
  const restoreBtn = document.getElementById('dash-ob-restore-btn');
  const skipBtn = document.getElementById('dash-ob-skip-btn');
  const dashObGuideBtn = document.getElementById('dash-ob-guide-btn') as HTMLButtonElement | null;
  const dashObGuideLabel = document.getElementById('dash-ob-guide-label');

  let selectedLang: FeedbackLanguageMode = resolveSupportedLanguage('auto');
  let selectedCurrent: CefrLevel = 'A1';
  let selectedTarget: CefrLevel = 'B1';
  let activeCopy = getOnboardingCopy('auto');
  let activeStep: 'choice' | 'new' | 'ret' = 'choice';

  const stepGuideMap: Record<'choice' | 'new' | 'ret', AssistantGuideId> = {
    choice: 'welcome_onboarding',
    new: 'onboarding_profile',
    ret: 'onboarding_restore',
  };

  const syncDashObGuideLabel = (): void => {
    const isTrOb = resolveSupportedLanguage(selectedLang) === 'tr';
    if (dashObGuideLabel) {
      dashObGuideLabel.textContent = isTrOb ? 'Sesli Anlatım' : 'Voice Guide';
    }
    if (dashObGuideBtn) {
      dashObGuideBtn.title = isTrOb
        ? 'Bu adımın sesli anlatımını dinle veya durdur'
        : 'Play or stop voice guide for this step';
    }
  };

  if (langSelect && langSelect.options.length === 0) {
    for (const opt of DASH_OB_LANG_CHOICES) {
      const optionEl = document.createElement('option');
      optionEl.value = opt.code;
      optionEl.textContent = opt.label;
      langSelect.appendChild(optionEl);
    }
    langSelect.value = selectedLang;
  }

  const syncPills = (): void => {
    curWrap?.querySelectorAll<HTMLButtonElement>('.dash-ob-pill').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.level === selectedCurrent);
    });
    tgtWrap?.querySelectorAll<HTMLButtonElement>('.dash-ob-pill').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.level === selectedTarget);
    });
    applyDashOnboardingCopy(activeCopy, selectedCurrent, selectedTarget);
    syncDashObGuideLabel();
  };

  const showStep = (step: 'choice' | 'new' | 'ret'): void => {
    activeStep = step;
    if (stepChoice) stepChoice.hidden = step !== 'choice';
    if (stepNew) stepNew.hidden = step !== 'new';
    if (stepRet) stepRet.hidden = step !== 'ret';
    void playGuideAssistant(stepGuideMap[step], {
      isTr: resolveSupportedLanguage(selectedLang) === 'tr',
      triggerEl: dashObGuideBtn,
      isAutoPlay: true,
    });
  };

  syncPills();
  overlay.hidden = false;
  showStep('choice');

  await new Promise<void>((resolve) => {
    const finishOnboarding = (): void => {
      stopGuideAssistant();
      overlay.hidden = true;
      resolve();
    };

    dashObGuideBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleGuideAssistant(stepGuideMap[activeStep], {
        isTr: resolveSupportedLanguage(selectedLang) === 'tr',
        triggerEl: dashObGuideBtn,
      });
    });

    chooseNewBtn?.addEventListener('click', () => showStep('new'));
    chooseRetBtn?.addEventListener('click', () => showStep('ret'));
    backNewBtn?.addEventListener('click', () => showStep('choice'));
    backRetBtn?.addEventListener('click', () => showStep('choice'));

    langSelect?.addEventListener('change', () => {
      selectedLang = langSelect.value as FeedbackLanguageMode;
      activeCopy = getOnboardingCopy(selectedLang);
      applyDashOnboardingCopy(activeCopy, selectedCurrent, selectedTarget);
      syncDashObGuideLabel();
    });

    curWrap?.addEventListener('click', (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('.dash-ob-pill');
      const lvl = btn?.dataset.level as CefrLevel | undefined;
      if (!lvl) return;
      selectedCurrent = lvl;
      if ((DASH_CEFR_RANK[selectedTarget] ?? 1) < (DASH_CEFR_RANK[selectedCurrent] ?? 1)) {
        selectedTarget = selectedCurrent === 'C1' ? 'C2' : selectedCurrent;
      }
      syncPills();
    });

    tgtWrap?.addEventListener('click', (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('.dash-ob-pill');
      const lvl = btn?.dataset.level as CefrLevel | undefined;
      if (!lvl) return;
      selectedTarget = lvl;
      if ((DASH_CEFR_RANK[selectedTarget] ?? 1) < (DASH_CEFR_RANK[selectedCurrent] ?? 1)) {
        selectedTarget = selectedCurrent;
      }
      syncPills();
    });

    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      void file.text().then((text) => {
        if (textarea) textarea.value = text;
        const lbl = document.getElementById('dash-ob-file-label');
        if (lbl) lbl.textContent = `✓ ${file.name}`;
        if (errEl) errEl.hidden = true;
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
          getSettings(),
          getAiConfig(),
          getSkillProfile(),
        ]);
        await Promise.all([
          saveSettings({ ...curSettings, levels: plan.initialLevels, uiLanguage: plan.uiLanguage }),
          saveAiConfig({ ...curAi, feedbackLanguage: plan.uiLanguage }),
          saveSkillProfile({ ...curProfile, rating: plan.initialRating }),
          saveOnboardingState(plan.onboardingPatch),
        ]);
        await chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' } satisfies ExtensionMessage);
        finishOnboarding();
      })();
    });

    restoreBtn?.addEventListener('click', () => {
      void (async () => {
        if (errEl) errEl.hidden = true;
        const res = await restoreFromBackupText(textarea?.value ?? '');
        if (!res.ok) {
          if (errEl) {
            errEl.textContent = activeCopy.restoreError;
            errEl.hidden = false;
          }
          return;
        }
        await chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' } satisfies ExtensionMessage);
        finishOnboarding();
      })();
    });

    skipBtn?.addEventListener('click', () => {
      void (async () => {
        await saveOnboardingState({ completed: true, b1GateAccepted: true });
        finishOnboarding();
      })();
    });
  });

  return true;
}

resetProgressBtn.addEventListener('click', async () => {
  if (!window.confirm(currentUi.resetConfirm)) return;
  await resetAllProgress();
  await refreshCardsData();
  await loadSummary();
  await refreshDashboardBanners();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  const nextLang =
    (changes.settings?.newValue as { uiLanguage?: FeedbackLanguageMode } | undefined)?.uiLanguage ??
    (changes.aiConfig?.newValue as { feedbackLanguage?: FeedbackLanguageMode } | undefined)
      ?.feedbackLanguage;
  if (nextLang) {
    applyLanguageMode(nextLang);
  }
  if (changes.skillProfile || changes.onboardingState || changes.settings) {
    void refreshDashboardBanners();
  }
});

async function initDashboard(): Promise<void> {
  const justCompletedOnboarding = await ensureDashboardOnboarding();
  const [settings, ai] = await Promise.all([getSettings(), getAiConfig()]);
  const initialLang: FeedbackLanguageMode =
    settings.uiLanguage && settings.uiLanguage !== 'auto'
      ? settings.uiLanguage
      : ai.feedbackLanguage && ai.feedbackLanguage !== 'auto'
        ? ai.feedbackLanguage
        : settings.uiLanguage ?? ai.feedbackLanguage ?? 'auto';

  applyLanguageMode(initialLang);

  await Promise.all([
    loadSummary(),
    loadSettingsIntoForm(),
    loadAiConfigIntoForm(),
    refreshCardsData(),
    refreshDashboardBanners(),
  ]);
  initNeuralTtsControls();
  topbarLangSelect.value = initialLang;
  aiFeedbackLanguageSelect.value = initialLang;

  const hasAnyKey = Boolean(
    ai.apiKey?.trim() || ai.fallbackApiKey?.trim() || ai.fallback2ApiKey?.trim()
  );
  if (!hasAnyKey) {
    const groqDetails = document.querySelector<HTMLDetailsElement>(
      '.free-api-item[data-provider="groq"]'
    );
    if (groqDetails) groqDetails.open = true;
  }

  const requestedTab = new URLSearchParams(window.location.search).get('tab');
  if (requestedTab && tabPanels[requestedTab]) {
    switchDashboardTab(requestedTab);
  }
  if (justCompletedOnboarding && requestedTab === 'roadmap') {
    void playGuideOnce('tour_home_roadmap', {
      isTr: resolveSupportedLanguage(initialLang) === 'tr',
    });
  }
}

function renderNeuralTtsStatus(status?: NeuralTtsStatus | null): void {
  if (!neuralTtsStatusEl || !neuralTtsTestBtn) return;
  if (!status) {
    neuralTtsStatusEl.textContent = 'Yapay Zeka Sesi (Piper · 60 MB): İlk kullanımda otomatik indirilir.';
    neuralTtsTestBtn.disabled = false;
    neuralTtsTestBtn.textContent = '▶ İndir & Test Et';
    return;
  }
  if (status.downloading) {
    neuralTtsStatusEl.textContent = `Yapay Zeka Sesi indiriliyor… %${status.progressPercent} (tek seferlik, 60 MB)`;
    neuralTtsTestBtn.disabled = true;
    neuralTtsTestBtn.textContent = `%${status.progressPercent}…`;
    return;
  }
  if (status.error) {
    neuralTtsStatusEl.textContent = `Yapay Zeka Sesi hatası: ${status.error}`;
    neuralTtsTestBtn.disabled = false;
    neuralTtsTestBtn.textContent = '↻ Tekrar Dene';
    return;
  }
  if (status.cached || status.ready) {
    neuralTtsStatusEl.textContent = '✓ Yapay Zeka Sesi (Piper · HFC Female) çevrimdışı önbellekte hazır.';
    neuralTtsTestBtn.disabled = false;
    neuralTtsTestBtn.textContent = '▶ Sesi Dinle';
    return;
  }
  neuralTtsStatusEl.textContent = 'Yapay Zeka Sesi (Piper · 60 MB): İndirilmedi (Brave/Opera için otomatik iner).';
  neuralTtsTestBtn.disabled = false;
  neuralTtsTestBtn.textContent = '▶ İndir & Test Et';
}

function initNeuralTtsControls(): void {
  if (!neuralTtsStatusEl || !neuralTtsTestBtn) return;

  chrome.runtime.onMessage.addListener((msg: { type?: string; status?: NeuralTtsStatus }) => {
    if (msg?.type === 'NEURAL_TTS_PROGRESS' && msg.status) {
      renderNeuralTtsStatus(msg.status);
    }
  });

  chrome.runtime
    .sendMessage({ type: 'GET_NEURAL_TTS_STATUS' } satisfies ExtensionMessage)
    .then((res: { ok?: boolean; status?: NeuralTtsStatus } | undefined) => {
      renderNeuralTtsStatus(res?.ok ? res.status : null);
    })
    .catch(() => renderNeuralTtsStatus(null));

  neuralTtsTestBtn.addEventListener('click', async () => {
    neuralTtsTestBtn.disabled = true;
    neuralTtsTestBtn.textContent = 'Hazırlanıyor…';
    try {
      const prep = (await chrome.runtime.sendMessage({
        type: 'PREPARE_NEURAL_TTS',
      } satisfies ExtensionMessage)) as { ok?: boolean; status?: NeuralTtsStatus } | undefined;
      if (prep?.status) renderNeuralTtsStatus(prep.status);
      if (prep?.ok) {
        await chrome.runtime.sendMessage({
          type: 'SPEAK_NEURAL_TTS',
          text: 'Hello! EasyLang neural voice is ready on this browser.',
          rate: 1.0,
        } satisfies ExtensionMessage);
      }
    } catch {
      renderNeuralTtsStatus(null);
    } finally {
      neuralTtsTestBtn.disabled = false;
    }
  });
}

void initDashboard();
