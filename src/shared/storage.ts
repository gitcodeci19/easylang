import { createInitialSkillProfile } from './analytics.ts';
import { consolidateConceptState, createInitialConceptState } from './concepts.ts';
import {
  createInitialRoadmapState,
  normalizeRoadmapState,
  type RoadmapState,
} from './curriculum.ts';
import {
  createDefaultOnboardingState,
  normalizeOnboardingState,
  parseFullBackupJson,
} from './onboarding.ts';
import { normalizePageSentenceKey } from './pageSentenceExtractor.ts';
import { isAiConceptCard } from './srs.ts';
import { parseImportedCards } from './textImport.ts';
import type {
  ActivePrompt,
  ActiveTabRecord,
  AiConfig,
  AiProviderIndex,
  Card,
  ConceptTrackerState,
  DailyStats,
  ExtensionSettings,
  FullBackupPayload,
  RemedialActiveSession,
  RemedialAiOverlayCache,
  RemedialMasteryRecord,
  ReviewEvent,
  RoadmapActiveSession,
  RoadmapCoachInsight,
  RoadmapLessonRecord,
  UserCardProgress,
  UserOnboardingState,
  UserSkillProfile,
  WeakSkillId,
} from './types';

export const DEFAULT_SYSTEM_PROMPT = [
  'You are an experienced English-to-Turkish language teacher.',
  'Evaluate whether the user’s Turkish answer accurately captures the meaning of the English word or sentence.',
  'Accept valid synonyms, natural Turkish phrasings, and minor typos; reject clearly different or opposite meanings.',
  'If the user captures the core meaning correctly but reveals a gap or omission around a specific grammar structure (e.g., used to, preposition, tense), accept the core translation when reasonable (isCorrect: true) and populate weakPoint.',
  'Respond ONLY with valid JSON: {"isCorrect": boolean, "note": "brief explanation (1-2 sentences max)", "weakPoint": {"token": "problematic word/pattern", "label": "short title", "explanation": "concise grammar explanation"} | null}',
].join(' ');

export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: false,
  alwaysEvaluate: true,
  feedbackLanguage: 'auto',
  baseUrl: 'https://api.groq.com/openai/v1',
  apiKey: '',
  model: 'qwen/qwen3.8-27b',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  fallbackEnabled: false,
  fallbackBaseUrl: 'https://api.tokenlab.amd.com/v1',
  fallbackApiKey: '',
  fallbackModel: 'DeepSeek-V4-Flash',
  fallback2Enabled: false,
  fallback2BaseUrl: 'https://integrate.api.nvidia.com/v1',
  fallback2ApiKey: '',
  fallback2Model: 'google/gemma-4-31b-it',
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  intervalMinutes: 20,
  retryDelayMinutes: 20,
  contentMode: 'mixed',
  levels: ['A1', 'A2', 'B1', 'B2', 'C1'],
  includeUserCards: true,
  autoSpeak: false,
  ttsVoiceMode: 'hybrid',
  skipFullscreen: true,
  autoCloseCorrectSeconds: 0,
  quietHoursStart: null,
  quietHoursEnd: null,
  autoTranslateContextMenu: true,
  blockedDomains: [],
  mutedUntil: null,
  adaptiveDifficulty: true,
};

const STORAGE_KEYS = {
  USER_CARDS: 'userCards',
  CARD_OVERRIDES: 'cardOverrides',
  DELETED_CARD_IDS: 'deletedCardIds',
  PROGRESS_MAP: 'progressMap',
  SKILL_PROFILE: 'skillProfile',
  REVIEW_HISTORY: 'reviewHistory',
  CONCEPT_STATE: 'conceptState',
  DAILY_STATS: 'dailyStats',
  NEXT_ALARM_AT: 'nextAlarmAt',
  SETTINGS: 'settings',
  AI_CONFIG: 'aiConfig',
  AI_FAILOVER_UNTIL: 'aiFailoverUntil',
  AI_FAILOVER_COOLDOWNS: 'aiFailoverCooldowns',
  PAGE_QUIZ_ASKED_SENTENCES: 'pageQuizAskedSentences',
  LISTENING_ASKED_IDS: 'listeningAskedIds',
  ROADMAP_STATE: 'roadmapState',
  ROADMAP_ACTIVE_SESSION: 'roadmapActiveSession',
  REMEDIAL_ACTIVE_SESSION: 'remedialActiveSession',
  ROADMAP_UI_MODE: 'roadmapUiMode',
  ROADMAP_OPEN_GUIDEBOOK: 'roadmapOpenGuidebook',
  REMEDIAL_AI_OVERLAY: 'remedialAiOverlay',
  ROADMAP_HISTORY: 'roadmapHistory',
  ROADMAP_COACH_INSIGHT: 'roadmapCoachInsight',
  REMEDIAL_PROGRESS: 'remedialProgress',
  ONBOARDING_STATE: 'onboardingState',
  STORAGE_HYGIENE_VERSION: 'storageHygieneVersion',
} as const;

const CURRENT_STORAGE_HYGIENE_VERSION = 1;
const MAX_AI_CONCEPT_USER_CARDS = 20;
const MAX_LISTENING_ASKED_IDS = 120;
const MAX_REVIEW_HISTORY = 1000;
const MAX_ROADMAP_HISTORY = 200;
const MAX_ASKED_PAGE_SENTENCES = 1000;

const SESSION_KEYS = {
  LAST_ACTIVE_TAB: 'lastActiveTab',
  PENDING_PROMPT: 'pendingPrompt',
  CURRENT_PROMPT: 'currentPrompt',
} as const;

let builtinCardsCache: Card[] | null = null;
let allCardsCache: Card[] | null = null;

export function invalidateAllCardsCache(): void {
  allCardsCache = null;
}

if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName === 'local' &&
      (STORAGE_KEYS.USER_CARDS in changes ||
        STORAGE_KEYS.CARD_OVERRIDES in changes ||
        STORAGE_KEYS.DELETED_CARD_IDS in changes)
    ) {
      allCardsCache = null;
    }
  });
}

/** Return YYYY-MM-DD in the user's local timezone. */
export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createEmptyDailyStats(dateKey: string = getLocalDateKey()): DailyStats {
  return {
    date: dateKey,
    shown: 0,
    correct: 0,
    wrong: 0,
    overriddenCorrect: 0,
  };
}

/** Load built-in cards packaged in data/cards.json (cached in memory). */
export async function loadBuiltinCards(): Promise<Card[]> {
  if (builtinCardsCache) return builtinCardsCache;
  const url = chrome.runtime.getURL('data/cards.json');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load built-in cards (${response.status})`);
  }
  const parsed = (await response.json()) as Card[];
  builtinCardsCache = parsed;
  return parsed;
}

export async function getSettings(): Promise<ExtensionSettings> {
  const res = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
  const raw = res[STORAGE_KEYS.SETTINGS] as Partial<ExtensionSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
}

export async function saveSettings(partial: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await getSettings();
  const merged: ExtensionSettings = { ...current, ...partial };
  await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: merged });
  return merged;
}

/** Store AI credentials locally only (never synced) to keep API keys private. */
export async function getAiConfig(): Promise<AiConfig> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.AI_CONFIG);
  const raw = res[STORAGE_KEYS.AI_CONFIG] as Partial<AiConfig> | undefined;
  return { ...DEFAULT_AI_CONFIG, ...(raw ?? {}) };
}

export async function saveAiConfig(partial: Partial<AiConfig>): Promise<AiConfig> {
  const current = await getAiConfig();
  const merged: AiConfig = { ...current, ...partial };
  await chrome.storage.local.set({
    [STORAGE_KEYS.AI_CONFIG]: merged,
    [STORAGE_KEYS.AI_FAILOVER_UNTIL]: 0,
    [STORAGE_KEYS.AI_FAILOVER_COOLDOWNS]: {},
  });
  return merged;
}

export type AiFailoverCooldowns = Partial<Record<AiProviderIndex, number>>;

export async function getAiFailoverCooldowns(): Promise<AiFailoverCooldowns> {
  const res = await chrome.storage.local.get([
    STORAGE_KEYS.AI_FAILOVER_COOLDOWNS,
    STORAGE_KEYS.AI_FAILOVER_UNTIL,
  ]);
  const map = (res[STORAGE_KEYS.AI_FAILOVER_COOLDOWNS] as AiFailoverCooldowns | undefined) ?? {};
  const legacyPrimaryUntil = res[STORAGE_KEYS.AI_FAILOVER_UNTIL];
  if (typeof legacyPrimaryUntil === 'number' && legacyPrimaryUntil > Date.now() && !map[1]) {
    return { ...map, 1: legacyPrimaryUntil };
  }
  return map;
}

export async function setAiFailoverCooldown(
  providerIndex: AiProviderIndex,
  untilTimestamp: number
): Promise<void> {
  const current = await getAiFailoverCooldowns();
  if (untilTimestamp <= 0) {
    delete current[providerIndex];
  } else {
    current[providerIndex] = untilTimestamp;
  }
  await chrome.storage.local.set({
    [STORAGE_KEYS.AI_FAILOVER_COOLDOWNS]: current,
    ...(providerIndex === 1 ? { [STORAGE_KEYS.AI_FAILOVER_UNTIL]: Math.max(0, untilTimestamp) } : {}),
  });
}

export async function clearAiFailoverCooldowns(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.AI_FAILOVER_COOLDOWNS]: {},
    [STORAGE_KEYS.AI_FAILOVER_UNTIL]: 0,
  });
}

export async function getUserCards(): Promise<Card[]> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.USER_CARDS);
  return (res[STORAGE_KEYS.USER_CARDS] as Card[] | undefined) ?? [];
}

export async function saveUserCards(cards: Card[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.USER_CARDS]: cards });
  invalidateAllCardsCache();
}

export async function getCardOverrides(): Promise<Record<string, Card>> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.CARD_OVERRIDES);
  return (res[STORAGE_KEYS.CARD_OVERRIDES] as Record<string, Card> | undefined) ?? {};
}

export async function saveCardOverride(card: Card): Promise<void> {
  const overrides = await getCardOverrides();
  overrides[card.id] = card;
  await chrome.storage.local.set({ [STORAGE_KEYS.CARD_OVERRIDES]: overrides });
  invalidateAllCardsCache();
}

export async function getDeletedCardIds(): Promise<string[]> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.DELETED_CARD_IDS);
  return (res[STORAGE_KEYS.DELETED_CARD_IDS] as string[] | undefined) ?? [];
}

export async function markCardDeleted(cardId: string): Promise<void> {
  const userCards = await getUserCards();
  const filteredUser = userCards.filter((c) => c.id !== cardId);
  if (filteredUser.length !== userCards.length) {
    await saveUserCards(filteredUser);
  }
  const deleted = new Set(await getDeletedCardIds());
  deleted.add(cardId);
  await chrome.storage.local.set({ [STORAGE_KEYS.DELETED_CARD_IDS]: Array.from(deleted) });
  invalidateAllCardsCache();
}

/** Merge built-in cards, overrides, deletions, and user-created cards (memoized for WeakMap index speed). */
export async function getAllCards(): Promise<Card[]> {
  if (allCardsCache) return allCardsCache;
  const [builtin, userCards, overrides, deletedIds] = await Promise.all([
    loadBuiltinCards(),
    getUserCards(),
    getCardOverrides(),
    getDeletedCardIds(),
  ]);

  const deletedSet = new Set(deletedIds);
  const merged: Card[] = [];

  for (const card of userCards) {
    if (!deletedSet.has(card.id)) {
      merged.push(overrides[card.id] ?? card);
    }
  }
  for (const card of builtin) {
    if (!deletedSet.has(card.id)) {
      merged.push(overrides[card.id] ?? card);
    }
  }

  allCardsCache = merged;
  return merged;
}

export async function upsertUserCard(card: Card): Promise<void> {
  const userCards = await getUserCards();
  const idx = userCards.findIndex((c) => c.id === card.id);
  if (idx >= 0) {
    userCards[idx] = card;
  } else {
    userCards.unshift(card);
  }
  await saveUserCards(userCards);
}

export async function getProgressMap(): Promise<Record<string, UserCardProgress>> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.PROGRESS_MAP);
  return (res[STORAGE_KEYS.PROGRESS_MAP] as Record<string, UserCardProgress> | undefined) ?? {};
}

export async function saveProgressEntry(progress: UserCardProgress): Promise<void> {
  const map = await getProgressMap();
  map[progress.cardId] = progress;
  await chrome.storage.local.set({ [STORAGE_KEYS.PROGRESS_MAP]: map });
}

export async function resetAllProgress(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.PROGRESS_MAP]: {},
    [STORAGE_KEYS.SKILL_PROFILE]: createInitialSkillProfile(),
    [STORAGE_KEYS.REVIEW_HISTORY]: [],
    [STORAGE_KEYS.CONCEPT_STATE]: createInitialConceptState(),
    [STORAGE_KEYS.DAILY_STATS]: createEmptyDailyStats(),
    [STORAGE_KEYS.ROADMAP_STATE]: createInitialRoadmapState(),
    [STORAGE_KEYS.ROADMAP_HISTORY]: [],
    [STORAGE_KEYS.REMEDIAL_PROGRESS]: {},
  });
  await chrome.storage.local.remove([
    STORAGE_KEYS.ROADMAP_ACTIVE_SESSION,
    STORAGE_KEYS.REMEDIAL_ACTIVE_SESSION,
    STORAGE_KEYS.ROADMAP_UI_MODE,
    STORAGE_KEYS.ROADMAP_OPEN_GUIDEBOOK,
    STORAGE_KEYS.REMEDIAL_AI_OVERLAY,
    STORAGE_KEYS.ROADMAP_COACH_INSIGHT,
  ]);
}

export async function getRoadmapState(): Promise<RoadmapState> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.ROADMAP_STATE);
  const raw = res[STORAGE_KEYS.ROADMAP_STATE] as Partial<RoadmapState> | undefined;
  return normalizeRoadmapState(raw);
}

export async function saveRoadmapState(patch: Partial<RoadmapState>): Promise<RoadmapState> {
  const current = await getRoadmapState();
  const next = normalizeRoadmapState({ ...current, ...patch });
  await chrome.storage.local.set({ [STORAGE_KEYS.ROADMAP_STATE]: next });
  return next;
}

export async function getActiveRoadmapSession(): Promise<RoadmapActiveSession | null> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.ROADMAP_ACTIVE_SESSION);
  return (res[STORAGE_KEYS.ROADMAP_ACTIVE_SESSION] as RoadmapActiveSession | undefined) ?? null;
}

export async function saveActiveRoadmapSession(session: RoadmapActiveSession): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.ROADMAP_ACTIVE_SESSION]: session });
}

export async function clearActiveRoadmapSession(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.ROADMAP_ACTIVE_SESSION);
}

export async function getActiveRemedialSession(): Promise<RemedialActiveSession | null> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.REMEDIAL_ACTIVE_SESSION);
  return (res[STORAGE_KEYS.REMEDIAL_ACTIVE_SESSION] as RemedialActiveSession | undefined) ?? null;
}

export async function saveActiveRemedialSession(session: RemedialActiveSession): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.REMEDIAL_ACTIVE_SESSION]: session });
}

export async function clearActiveRemedialSession(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.REMEDIAL_ACTIVE_SESSION);
}

export async function getRoadmapUiMode(): Promise<'path' | 'remedial'> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.ROADMAP_UI_MODE);
  return res[STORAGE_KEYS.ROADMAP_UI_MODE] === 'remedial' ? 'remedial' : 'path';
}

export async function saveRoadmapUiMode(mode: 'path' | 'remedial'): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.ROADMAP_UI_MODE]: mode });
}

export async function getOpenGuidebookUnitId(): Promise<string | null> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.ROADMAP_OPEN_GUIDEBOOK);
  const raw = res[STORAGE_KEYS.ROADMAP_OPEN_GUIDEBOOK];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

export async function saveOpenGuidebookUnitId(unitId: string | null): Promise<void> {
  if (!unitId) {
    await chrome.storage.local.remove(STORAGE_KEYS.ROADMAP_OPEN_GUIDEBOOK);
    return;
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.ROADMAP_OPEN_GUIDEBOOK]: unitId });
}

export async function getRemedialAiOverlay(): Promise<RemedialAiOverlayCache | null> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.REMEDIAL_AI_OVERLAY);
  const raw = res[STORAGE_KEYS.REMEDIAL_AI_OVERLAY] as RemedialAiOverlayCache | undefined;
  if (!raw || !Array.isArray(raw.items) || typeof raw.updatedAt !== 'number') return null;
  if (Date.now() - raw.updatedAt > 24 * 3_600_000) return null;
  return raw;
}

export async function saveRemedialAiOverlay(items: RemedialAiOverlayCache['items']): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.REMEDIAL_AI_OVERLAY]: {
      items,
      updatedAt: Date.now(),
    } satisfies RemedialAiOverlayCache,
  });
}

export async function getRoadmapHistory(): Promise<RoadmapLessonRecord[]> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.ROADMAP_HISTORY);
  const raw = res[STORAGE_KEYS.ROADMAP_HISTORY];
  return Array.isArray(raw) ? (raw as RoadmapLessonRecord[]) : [];
}

export async function appendRoadmapLessonRecord(
  record: RoadmapLessonRecord
): Promise<RoadmapLessonRecord[]> {
  const current = await getRoadmapHistory();
  const next = [...current, record];
  const trimmed =
    next.length > MAX_ROADMAP_HISTORY
      ? next.slice(next.length - MAX_ROADMAP_HISTORY)
      : next;
  await chrome.storage.local.set({ [STORAGE_KEYS.ROADMAP_HISTORY]: trimmed });
  return trimmed;
}

export async function getRoadmapCoachInsight(): Promise<RoadmapCoachInsight | null> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.ROADMAP_COACH_INSIGHT);
  return (res[STORAGE_KEYS.ROADMAP_COACH_INSIGHT] as RoadmapCoachInsight | undefined) ?? null;
}

export async function saveRoadmapCoachInsight(insight: RoadmapCoachInsight): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.ROADMAP_COACH_INSIGHT]: insight });
}

export async function getRemedialProgress(): Promise<Record<string, RemedialMasteryRecord>> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.REMEDIAL_PROGRESS);
  const raw = res[STORAGE_KEYS.REMEDIAL_PROGRESS];
  return raw && typeof raw === 'object' ? (raw as Record<string, RemedialMasteryRecord>) : {};
}

export async function recordRemedialCompletion(
  skillId: WeakSkillId,
  accuracyPct: number,
  now: number = Date.now()
): Promise<Record<string, RemedialMasteryRecord>> {
  const current = await getRemedialProgress();
  const prev = current[skillId];
  const clampedAcc = Math.max(0, Math.min(100, Math.round(accuracyPct)));
  current[skillId] = {
    skillId,
    completions: (prev?.completions ?? 0) + 1,
    lastAccuracyPct: clampedAcc,
    lastCompletedAt: now,
    bestAccuracyPct: Math.max(prev?.bestAccuracyPct ?? 0, clampedAcc),
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.REMEDIAL_PROGRESS]: current });
  return current;
}

export async function getConceptState(): Promise<ConceptTrackerState> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.CONCEPT_STATE);
  const raw = res[STORAGE_KEYS.CONCEPT_STATE] as Partial<ConceptTrackerState> | undefined;
  return {
    notes: Array.isArray(raw?.notes) ? raw.notes : [],
    lastConceptPromptAtQuestion:
      typeof raw?.lastConceptPromptAtQuestion === 'number' ? raw.lastConceptPromptAtQuestion : -10,
  };
}

export async function saveConceptState(state: ConceptTrackerState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.CONCEPT_STATE]: state });
}

export async function deleteConceptNoteById(conceptId: string): Promise<ConceptTrackerState> {
  const current = await getConceptState();
  const next: ConceptTrackerState = {
    ...current,
    notes: current.notes.filter((n) => n.id !== conceptId),
  };
  await saveConceptState(next);
  return next;
}

export async function getSkillProfile(): Promise<UserSkillProfile> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.SKILL_PROFILE);
  const raw = res[STORAGE_KEYS.SKILL_PROFILE] as Partial<UserSkillProfile> | undefined;
  return { ...createInitialSkillProfile(), ...(raw ?? {}) };
}

export async function saveSkillProfile(profile: UserSkillProfile): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.SKILL_PROFILE]: profile });
}

export async function getReviewHistory(): Promise<ReviewEvent[]> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.REVIEW_HISTORY);
  return (res[STORAGE_KEYS.REVIEW_HISTORY] as ReviewEvent[] | undefined) ?? [];
}

export async function appendReviewEvent(event: ReviewEvent): Promise<void> {
  const history = await getReviewHistory();
  history.push(event);
  const trimmed =
    history.length > MAX_REVIEW_HISTORY
      ? history.slice(history.length - MAX_REVIEW_HISTORY)
      : history;
  await chrome.storage.local.set({ [STORAGE_KEYS.REVIEW_HISTORY]: trimmed });
}

export async function replaceLastReviewEventForCard(
  cardId: string,
  updater: (ev: ReviewEvent) => ReviewEvent
): Promise<void> {
  const history = await getReviewHistory();
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.cardId === cardId) {
      history[i] = updater(history[i]!);
      await chrome.storage.local.set({ [STORAGE_KEYS.REVIEW_HISTORY]: history });
      return;
    }
  }
}

export async function getDailyStats(): Promise<DailyStats> {
  const today = getLocalDateKey();
  const res = await chrome.storage.local.get(STORAGE_KEYS.DAILY_STATS);
  const stored = res[STORAGE_KEYS.DAILY_STATS] as DailyStats | undefined;
  if (!stored || stored.date !== today) {
    return createEmptyDailyStats(today);
  }
  return stored;
}

export async function updateDailyStats(
  updater: (current: DailyStats) => DailyStats
): Promise<DailyStats> {
  const current = await getDailyStats();
  const next = updater(current);
  await chrome.storage.local.set({ [STORAGE_KEYS.DAILY_STATS]: next });
  return next;
}

export async function getNextAlarmAt(): Promise<number | null> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.NEXT_ALARM_AT);
  return (res[STORAGE_KEYS.NEXT_ALARM_AT] as number | null | undefined) ?? null;
}

export async function setNextAlarmAt(timestamp: number | null): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.NEXT_ALARM_AT]: timestamp });
}

export async function getLastActiveTab(): Promise<ActiveTabRecord | null> {
  const res = await chrome.storage.session.get(SESSION_KEYS.LAST_ACTIVE_TAB);
  return (res[SESSION_KEYS.LAST_ACTIVE_TAB] as ActiveTabRecord | null | undefined) ?? null;
}

export async function setLastActiveTab(record: ActiveTabRecord | null): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEYS.LAST_ACTIVE_TAB]: record });
}

export async function getPendingPrompt(): Promise<ActivePrompt | null> {
  const res = await chrome.storage.session.get(SESSION_KEYS.PENDING_PROMPT);
  return (res[SESSION_KEYS.PENDING_PROMPT] as ActivePrompt | null | undefined) ?? null;
}

export async function setPendingPrompt(prompt: ActivePrompt | null): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEYS.PENDING_PROMPT]: prompt });
}

export async function getCurrentPrompt(): Promise<ActivePrompt | null> {
  const res = await chrome.storage.session.get(SESSION_KEYS.CURRENT_PROMPT);
  return (res[SESSION_KEYS.CURRENT_PROMPT] as ActivePrompt | null | undefined) ?? null;
}

export async function setCurrentPrompt(prompt: ActivePrompt | null): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEYS.CURRENT_PROMPT]: prompt });
}

/** Return the persisted list of normalized page sentences already sent to the user. */
export async function getAskedPageSentences(): Promise<string[]> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.PAGE_QUIZ_ASKED_SENTENCES);
  const stored = res[STORAGE_KEYS.PAGE_QUIZ_ASKED_SENTENCES];
  return Array.isArray(stored) ? stored.filter((x): x is string => typeof x === 'string') : [];
}

/** Record a page sentence persistently so it will not be picked again on future runs or reloads. */
export async function markPageSentenceAsked(sentence: string): Promise<void> {
  const key = normalizePageSentenceKey(sentence);
  if (!key) return;
  const current = await getAskedPageSentences();
  const deduped = current.filter((item) => item !== key);
  deduped.push(key);
  const trimmed =
    deduped.length > MAX_ASKED_PAGE_SENTENCES
      ? deduped.slice(deduped.length - MAX_ASKED_PAGE_SENTENCES)
      : deduped;
  await chrome.storage.local.set({ [STORAGE_KEYS.PAGE_QUIZ_ASKED_SENTENCES]: trimmed });
}

/** Remove only a specific page's sentence keys from persistent history (used when an entire page is exhausted). */
export async function clearAskedPageSentencesSubset(sentencesToClear: Iterable<string>): Promise<void> {
  const clearSet = new Set(
    Array.from(sentencesToClear, (s) => normalizePageSentenceKey(s)).filter(Boolean)
  );
  if (clearSet.size === 0) return;
  const current = await getAskedPageSentences();
  const remaining = current.filter((item) => !clearSet.has(item));
  await chrome.storage.local.set({ [STORAGE_KEYS.PAGE_QUIZ_ASKED_SENTENCES]: remaining });
}

/**
 * Retrieve onboarding & level-gating state.
 * Existing users who already have any answered cards, SRS progress, XP, custom cards,
 * or configured API keys are automatically recognized as experienced users (`completed: true`)
 * without altering their existing ratings, settings, or history.
 */
export async function getOnboardingState(): Promise<UserOnboardingState> {
  const localRes = await chrome.storage.local.get([
    STORAGE_KEYS.ONBOARDING_STATE,
    STORAGE_KEYS.SKILL_PROFILE,
    STORAGE_KEYS.PROGRESS_MAP,
    STORAGE_KEYS.ROADMAP_STATE,
    STORAGE_KEYS.AI_CONFIG,
    STORAGE_KEYS.USER_CARDS,
  ]);
  const storedRaw = localRes[STORAGE_KEYS.ONBOARDING_STATE] as
    | Partial<UserOnboardingState>
    | undefined;

  if (storedRaw && typeof storedRaw === 'object' && typeof storedRaw.completed === 'boolean') {
    return normalizeOnboardingState(storedRaw, storedRaw.completed);
  }

  const profile = localRes[STORAGE_KEYS.SKILL_PROFILE] as Partial<UserSkillProfile> | undefined;
  const progress = localRes[STORAGE_KEYS.PROGRESS_MAP] as
    | Record<string, UserCardProgress>
    | undefined;
  const roadmap = localRes[STORAGE_KEYS.ROADMAP_STATE] as Partial<RoadmapState> | undefined;
  const ai = localRes[STORAGE_KEYS.AI_CONFIG] as Partial<AiConfig> | undefined;
  const userCards = localRes[STORAGE_KEYS.USER_CARDS] as Card[] | undefined;

  const hasExistingData =
    (profile?.totalAnswered ?? 0) > 0 ||
    Object.keys(progress ?? {}).length > 0 ||
    (roadmap?.xp ?? 0) > 0 ||
    (roadmap?.completedNodeIds?.length ?? 0) > 0 ||
    Boolean(ai?.apiKey && ai.apiKey.trim().length > 0) ||
    (userCards?.length ?? 0) > 0;

  const initial = createDefaultOnboardingState(hasExistingData);
  if (hasExistingData) {
    await chrome.storage.local.set({ [STORAGE_KEYS.ONBOARDING_STATE]: initial });
  }
  return initial;
}

export async function saveOnboardingState(
  patch: Partial<UserOnboardingState>
): Promise<UserOnboardingState> {
  const current = await getOnboardingState();
  const next = normalizeOnboardingState({ ...current, ...patch }, current.completed);
  await chrome.storage.local.set({ [STORAGE_KEYS.ONBOARDING_STATE]: next });
  return next;
}

export async function getListeningAskedIds(): Promise<string[]> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.LISTENING_ASKED_IDS);
  const raw = res[STORAGE_KEYS.LISTENING_ASKED_IDS];
  return Array.isArray(raw) ? (raw as string[]) : [];
}

export async function appendListeningAskedId(cardId: string): Promise<void> {
  if (!cardId) return;
  const current = await getListeningAskedIds();
  const deduped = current.filter((id) => id !== cardId);
  deduped.push(cardId);
  const trimmed =
    deduped.length > MAX_LISTENING_ASKED_IDS
      ? deduped.slice(deduped.length - MAX_LISTENING_ASKED_IDS)
      : deduped;
  await chrome.storage.local.set({ [STORAGE_KEYS.LISTENING_ASKED_IDS]: trimmed });
}

export interface StorageHygieneReport {
  ran: boolean;
  removedOrphanProgress: number;
  removedAiConceptCards: number;
  consolidatedConcepts: number;
  removedLegacyKeys: string[];
}

/**
 * Safely clean up legacy dead storage keys (`cardVisuals`), orphan `progressMap` entries
 * from deleted/renamed dataset IDs, duplicate/overflow auto-generated AI concept cards
 * (strictly preserving all manual user cards), and overlapping overdue concept notes.
 */
export async function runStorageHygiene(force: boolean = false): Promise<StorageHygieneReport> {
  const verRes = await chrome.storage.local.get(STORAGE_KEYS.STORAGE_HYGIENE_VERSION);
  const currentVer = Number(verRes[STORAGE_KEYS.STORAGE_HYGIENE_VERSION] ?? 0);
  if (!force && currentVer >= CURRENT_STORAGE_HYGIENE_VERSION) {
    return {
      ran: false,
      removedOrphanProgress: 0,
      removedAiConceptCards: 0,
      consolidatedConcepts: 0,
      removedLegacyKeys: [],
    };
  }

  const [builtin, userCards, progressMap, conceptState, rawLegacy] = await Promise.all([
    loadBuiltinCards(),
    getUserCards(),
    getProgressMap(),
    getConceptState(),
    chrome.storage.local.get('cardVisuals'),
  ]);

  // 1. Deduplicate and cap auto-generated AI concept cards without touching any manual user card
  const manualCards: Card[] = [];
  const aiConceptCards: Card[] = [];
  const seenAiEn = new Set<string>();
  for (const card of userCards) {
    if (!isAiConceptCard(card)) {
      manualCards.push(card.origin ? card : { ...card, origin: 'manual' });
      continue;
    }
    const key = card.en.trim().toLowerCase();
    if (!key || seenAiEn.has(key)) continue;
    seenAiEn.add(key);
    aiConceptCards.push({ ...card, origin: 'ai_concept' });
  }

  // Keep only the most recent AI concept cards (preferring those with active retry or recent activity)
  aiConceptCards.sort((a, b) => {
    const pa = progressMap[a.id];
    const pb = progressMap[b.id];
    const retryDiff = Number(Boolean(pb?.retryAt)) - Number(Boolean(pa?.retryAt));
    if (retryDiff !== 0) return retryDiff;
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });
  const keptAiCards = aiConceptCards.slice(0, MAX_AI_CONCEPT_USER_CARDS);
  const nextUserCards = [...manualCards, ...keptAiCards];
  const removedAiConceptCards = Math.max(0, userCards.length - nextUserCards.length);

  // 2. Remove orphan progressMap entries whose cardId no longer exists in builtin or userCards
  const validIds = new Set<string>([
    ...builtin.map((c) => c.id),
    ...nextUserCards.map((c) => c.id),
  ]);
  const cleanedProgress: Record<string, UserCardProgress> = {};
  let removedOrphanProgress = 0;
  for (const [cid, entry] of Object.entries(progressMap)) {
    if (validIds.has(cid)) {
      cleanedProgress[cid] = entry;
    } else {
      removedOrphanProgress += 1;
    }
  }

  // 3. Consolidate overlapping/flooded active concept notes
  const nextConceptState = consolidateConceptState(conceptState);
  const consolidatedConcepts = Math.max(0, conceptState.notes.length - nextConceptState.notes.length);

  const updates: Record<string, unknown> = {
    [STORAGE_KEYS.STORAGE_HYGIENE_VERSION]: CURRENT_STORAGE_HYGIENE_VERSION,
  };
  if (removedAiConceptCards > 0 || userCards.some((c) => !c.origin)) {
    updates[STORAGE_KEYS.USER_CARDS] = nextUserCards;
  }
  if (removedOrphanProgress > 0) {
    updates[STORAGE_KEYS.PROGRESS_MAP] = cleanedProgress;
  }
  if (consolidatedConcepts > 0) {
    updates[STORAGE_KEYS.CONCEPT_STATE] = nextConceptState;
  }
  await chrome.storage.local.set(updates);

  const removedLegacyKeys: string[] = [];
  if ('cardVisuals' in rawLegacy) {
    await chrome.storage.local.remove('cardVisuals');
    removedLegacyKeys.push('cardVisuals');
  }

  invalidateAllCardsCache();
  return {
    ran: true,
    removedOrphanProgress,
    removedAiConceptCards,
    consolidatedConcepts,
    removedLegacyKeys,
  };
}

/**
 * Serialize all user progress into a portable JSON backup (explicitly excluding API keys).
 */
export async function exportFullBackupJson(): Promise<{ json: string; filename: string }> {
  const now = Date.now();
  const [
    skillProfile,
    progressMap,
    roadmapState,
    conceptState,
    userCards,
    deletedCardIds,
    reviewHistory,
    dailyStats,
    settings,
    onboardingCurrent,
    askedPageSentences,
    roadmapHistory,
    roadmapCoachInsight,
    cardOverrides,
    remedialProgress,
  ] = await Promise.all([
    getSkillProfile(),
    getProgressMap(),
    getRoadmapState(),
    getConceptState(),
    getUserCards(),
    getDeletedCardIds(),
    getReviewHistory(),
    getDailyStats(),
    getSettings(),
    getOnboardingState(),
    getAskedPageSentences(),
    getRoadmapHistory(),
    getRoadmapCoachInsight(),
    getCardOverrides(),
    getRemedialProgress(),
  ]);

  const updatedOnboarding = await saveOnboardingState({
    ...onboardingCurrent,
    lastBackupAt: now,
  });

  const payload: FullBackupPayload = {
    schema: 'en-tr-recall-backup-v1',
    exportedAt: now,
    skillProfile,
    progressMap,
    roadmapState: roadmapState as unknown as Record<string, unknown>,
    conceptState,
    userCards,
    deletedCardIds,
    reviewHistory,
    dailyStats,
    settings,
    onboardingState: updatedOnboarding,
    askedPageSentences,
    roadmapHistory,
    roadmapCoachInsight,
    cardOverrides,
    remedialProgress,
  };

  return {
    json: JSON.stringify(payload, null, 2),
    filename: `easylang-backup-${getLocalDateKey(new Date(now))}.json`,
  };
}

/**
 * Restore progress from an uploaded `.json` backup (full backup v1 or legacy custom card array).
 * Local AI credentials (`aiConfig`) remain untouched on this device.
 */
export async function restoreFromBackupText(
  rawText: string
): Promise<
  | { ok: true; kind: 'full'; cardsCount: number; rating: number; xp: number }
  | { ok: true; kind: 'cards'; cardsCount: number }
  | { ok: false }
> {
  const full = parseFullBackupJson(rawText);
  if (full) {
    const normalizedRoadmap = normalizeRoadmapState(
      full.roadmapState as Partial<RoadmapState>,
      Date.now()
    );
    const restoredOnboarding: UserOnboardingState = {
      ...full.onboardingState,
      completed: true,
    };

    await chrome.storage.local.set({
      [STORAGE_KEYS.SKILL_PROFILE]: full.skillProfile,
      [STORAGE_KEYS.PROGRESS_MAP]: full.progressMap,
      [STORAGE_KEYS.ROADMAP_STATE]: normalizedRoadmap,
      [STORAGE_KEYS.CONCEPT_STATE]: full.conceptState,
      [STORAGE_KEYS.USER_CARDS]: full.userCards,
      [STORAGE_KEYS.DELETED_CARD_IDS]: full.deletedCardIds,
      [STORAGE_KEYS.REVIEW_HISTORY]: full.reviewHistory,
      [STORAGE_KEYS.DAILY_STATS]: full.dailyStats,
      [STORAGE_KEYS.ONBOARDING_STATE]: restoredOnboarding,
      ...(Array.isArray(full.askedPageSentences)
        ? { [STORAGE_KEYS.PAGE_QUIZ_ASKED_SENTENCES]: full.askedPageSentences }
        : {}),
      ...(Array.isArray(full.roadmapHistory)
        ? { [STORAGE_KEYS.ROADMAP_HISTORY]: full.roadmapHistory }
        : {}),
      ...(full.roadmapCoachInsight
        ? { [STORAGE_KEYS.ROADMAP_COACH_INSIGHT]: full.roadmapCoachInsight }
        : {}),
      ...(full.cardOverrides && typeof full.cardOverrides === 'object'
        ? { [STORAGE_KEYS.CARD_OVERRIDES]: full.cardOverrides }
        : {}),
      ...(full.remedialProgress && typeof full.remedialProgress === 'object'
        ? { [STORAGE_KEYS.REMEDIAL_PROGRESS]: full.remedialProgress }
        : {}),
    });

    if (full.settings && typeof full.settings === 'object') {
      await saveSettings(full.settings);
    }
    await chrome.storage.local.remove([
      STORAGE_KEYS.ROADMAP_ACTIVE_SESSION,
      STORAGE_KEYS.REMEDIAL_ACTIVE_SESSION,
      STORAGE_KEYS.ROADMAP_OPEN_GUIDEBOOK,
      STORAGE_KEYS.REMEDIAL_AI_OVERLAY,
    ]);
    invalidateAllCardsCache();

    return {
      ok: true,
      kind: 'full',
      cardsCount: full.userCards.length,
      rating: full.skillProfile.rating,
      xp: normalizedRoadmap.xp,
    };
  }

  // Legacy fallback: allow uploading plain Card[] JSON / TSV deck export
  const { cards } = parseImportedCards(rawText);
  if (cards.length > 0) {
    const existing = await getUserCards();
    const seen = new Set(existing.map((c) => c.en.toLowerCase()));
    const merged = [...cards.filter((c) => !seen.has(c.en.toLowerCase())), ...existing];
    await saveUserCards(merged);
    await saveOnboardingState({ completed: true });
    return {
      ok: true,
      kind: 'cards',
      cardsCount: cards.length,
    };
  }

  return { ok: false };
}
