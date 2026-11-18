import type { FeedbackLanguageMode, SupportedLanguageCode } from './i18n';

export type { FeedbackLanguageMode, SupportedLanguageCode };
export type CardType = 'word' | 'sentence';
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type CardSource = 'builtin' | 'user';

export interface Card {
  id: string;
  type: CardType;
  level: CefrLevel;
  pos: string;
  en: string;
  phonetic: string;
  acceptedTr: string[];
  exampleEn: string;
  exampleTr: string;
  source: CardSource;
  createdAt?: number;
  /** Optional explicit thematic curriculum unit ID (e.g., 'u02_animals', 'u06_sports', 'u07_cinema'). */
  unitId?: string;
}

export interface UserCardProgress {
  cardId: string;
  /** Timestamp when a missed card must reappear (priority retry queue). */
  retryAt: number | null;
  /** How many consecutive times the card was missed in the current retry cycle. */
  retryCount: number;
  /** Spaced repetition due timestamp after mastering/answering correctly. */
  nextDueAt: number;
  /** Consecutive correct answers. */
  streak: number;
  /** Current SRS interval in days. */
  intervalDays: number;
  totalCorrect: number;
  totalWrong: number;
  lastReviewedAt: number;
}

export type ContentMode = 'mixed' | 'word' | 'sentence';

export interface ExtensionSettings {
  enabled: boolean;
  /** Periodic trigger interval in minutes (default 20). */
  intervalMinutes: number;
  /** Delay before a wrongly answered card reappears (default 20). */
  retryDelayMinutes: number;
  contentMode: ContentMode;
  levels: CefrLevel[];
  includeUserCards: boolean;
  autoSpeak: boolean;
  skipFullscreen: boolean;
  autoCloseCorrectSeconds: number;
  /** Quiet hours in 24h format (0-23). Disabled if null. */
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  /** Optional MyMemory translation lookup when adding a right-clicked selection. */
  autoTranslateContextMenu: boolean;
  /** Domains or URL prefixes where the extension must never run or inject UI. */
  blockedDomains: string[];
  /** Timestamp until which periodic/pending prompts are muted (e.g. 1-hour mute). */
  mutedUntil: number | null;
  /** Weight card selection toward the user's estimated skill rating. */
  adaptiveDifficulty: boolean;
  /** Preferred native / UI / AI explanation language ('auto' matches browser language). */
  uiLanguage?: FeedbackLanguageMode;
}

export type TopicDomain =
  | 'business'
  | 'tech'
  | 'health'
  | 'travel'
  | 'emotion'
  | 'academic'
  | 'nature'
  | 'daily';

export type PosGroup = 'noun' | 'verb' | 'adjective' | 'adverb' | 'sentence' | 'grammar';

export interface UserSkillProfile {
  rating: number;
  totalAnswered: number;
  totalCorrect: number;
  currentStreak: number;
  bestStreak: number;
  lastUpdatedAt: number;
}

export interface UserOnboardingState {
  /** True once user finishes onboarding OR automatically for existing users with prior activity/settings. */
  completed: boolean;
  /** Self-reported current CEFR level chosen on first-time setup. */
  initialCurrentLevel: CefrLevel | null;
  /** Target CEFR level chosen on first-time setup. */
  targetLevel: CefrLevel | null;
  /** True when user started below B1 (`A1` or `A2`) with target `B1+`, keeping B1+ gated until Elo readiness. */
  b1GateActive: boolean;
  /** True once user confirmed they feel ready for B1+ (or started at B1+). */
  b1GateAccepted: boolean;
  /** Timestamp until which the B1 readiness prompt is snoozed (tomorrow after clicking No); null means keep showing. */
  b1PromptDismissedUntil: number | null;
  /** Timestamp when user last downloaded a full JSON progress backup. */
  lastBackupAt: number | null;
  /** Timestamp until which the inline backup nudge banner is snoozed (e.g. +7 days). */
  backupReminderDismissedUntil: number | null;
}

export interface FullBackupPayload {
  schema: 'en-tr-recall-backup-v1';
  exportedAt: number;
  skillProfile: UserSkillProfile;
  progressMap: Record<string, UserCardProgress>;
  conceptState: ConceptTrackerState;
  userCards: Card[];
  deletedCardIds: string[];
  reviewHistory: ReviewEvent[];
  dailyStats: DailyStats;
  settings: ExtensionSettings;
  onboardingState: UserOnboardingState;
  /** RoadmapState stored safely as record to avoid circular type imports */
  roadmapState: Record<string, unknown>;
  askedPageSentences?: string[];
}

export interface ReviewEvent {
  cardId: string;
  en: string;
  level: CefrLevel;
  posGroup: PosGroup;
  topic: TopicDomain;
  isCorrect: boolean;
  responseMs: number;
  ratingBefore: number;
  ratingAfter: number;
  timestamp: number;
}

export type AiProviderIndex = 1 | 2 | 3;

export interface AiConfig {
  enabled: boolean;
  alwaysEvaluate: boolean;
  /** Preferred language for AI explanations, hints, and coach reports ('auto' follows browser UI language). */
  feedbackLanguage?: FeedbackLanguageMode;
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  /** Optional secondary/fallback OpenAI-compatible provider (AI2, e.g. AMD TokenLab). */
  fallbackEnabled?: boolean;
  fallbackBaseUrl?: string;
  fallbackApiKey?: string;
  fallbackModel?: string;
  /** Optional tertiary OpenAI-compatible provider (AI3, e.g. NVIDIA NIM / Gemini). */
  fallback2Enabled?: boolean;
  fallback2BaseUrl?: string;
  fallback2ApiKey?: string;
  fallback2Model?: string;
}

export interface DailyStats {
  /** YYYY-MM-DD in local time. */
  date: string;
  shown: number;
  correct: number;
  wrong: number;
  overriddenCorrect: number;
}

export interface ActiveTabRecord {
  tabId: number;
  windowId: number;
  url: string;
  updatedAt: number;
}

export type ConceptStage = 0 | 1 | 2 | 3;

export interface ConceptWeakPointInput {
  key?: string;
  token: string;
  label: string;
  explanation: string;
}

export interface ConceptNote {
  id: string;
  label: string;
  focusToken: string;
  sourceCardId: string;
  sourceEn: string;
  explanation: string;
  pattern: string;
  /** 0: captured (+2q), 1: check 1 (+4q), 2: retention check (+10q), 3: mastered */
  stage: ConceptStage;
  nextCheckAtQuestion: number;
  practicedCardIds: string[];
  attempts: number;
  correctCount: number;
  wrongCount: number;
  createdAt: number;
  lastPracticedAt: number;
  masteredAt: number | null;
}

export interface ConceptTrackerState {
  notes: ConceptNote[];
  lastConceptPromptAtQuestion: number;
}

export type LessonExerciseKind =
  | 'select_meaning'
  | 'select_en'
  | 'word_bank'
  | 'cloze_blank'
  | 'audio_dictation'
  | 'free_translation';

export interface LessonExercise {
  id: string;
  kind: LessonExerciseKind;
  card: Card;
  isNewWord: boolean;
  promptText: string;
  promptSubtext: string;
  /** Optional contextual translation revealed ONLY after the user checks their answer (e.g. for cloze_blank). */
  postAnswerSubtext?: string;
  audioText: string;
  /** Options for multiple-choice (`select_meaning`, `select_en`, `cloze_blank`) */
  choices?: string[];
  correctChoice?: string;
  /** Shuffled word tiles for `word_bank` and `audio_dictation` */
  wordBankTiles?: string[];
  targetTokens?: string[];
  /** Expected string(s) for grading */
  expectedAnswers: string[];
  direction: 'en-to-tr' | 'tr-to-en' | 'en-audio';
  isRetryRequeue?: boolean;
}

export interface RoadmapMistakeItem {
  cardId: string;
  en: string;
  expected: string;
  kind: LessonExerciseKind;
  direction: 'en-to-tr' | 'tr-to-en' | 'en-audio';
  wrongCount: number;
  repeatedWrong: boolean;
  lastUserAnswer: string;
}

export type RoadmapKindStatMap = Partial<
  Record<LessonExerciseKind, { correct: number; wrong: number }>
>;

export const ACTIVE_ROADMAP_SESSION_VERSION = 2 as const;

export interface RoadmapActiveSession {
  version: number;
  unitId: string;
  nodeIndex: number | 'jump_test';
  stepIndex: number;
  queue: LessonExercise[];
  currentIdx: number;
  firstTryCorrectCount: number;
  totalInitial: number;
  combo: number;
  maxCombo: number;
  mistakesMap: Record<string, RoadmapMistakeItem>;
  strongWords: string[];
  byKindStats: RoadmapKindStatMap;
  readyToFinish?: boolean;
  updatedAt: number;
}

export interface RoadmapLessonRecord {
  id: string;
  completedAt: number;
  unitId: string;
  unitTitleTr: string;
  unitTitleEn: string;
  nodeIndex: number | 'jump_test';
  stepIndex: number;
  accuracyPct: number;
  xpEarned: number;
  totalQuestions: number;
  firstTryCorrect: number;
  repeatedMistakeCount: number;
  strongWords: string[];
  mistakes: RoadmapMistakeItem[];
  byKind: RoadmapKindStatMap;
}

export interface RoadmapCoachInsight {
  status: 'great' | 'good' | 'focus';
  message: string;
  generatedAt: number;
  lessonCountAnalyzed: number;
  source: 'ai' | 'local';
}

export interface ActivePrompt {
  card: Card;
  progress: UserCardProgress | null;
  isRetry: boolean;
  retryAttempt: number;
  shownAt: number;
  targetConcept?: {
    id: string;
    label: string;
    focusToken: string;
    stage: ConceptStage;
    explanation: string;
    sourceCardId?: string;
    sourceEn?: string;
  };
}

export interface AnswerEvaluation {
  isCorrect: boolean;
  matchKind: 'exact' | 'normalized' | 'fuzzy' | 'overlap' | 'ai' | 'none';
  matchedTranslation: string | null;
  similarity: number;
  aiNote?: string;
  aiStatus?: 'used' | 'disabled' | 'error';
  aiProviderIndex?: AiProviderIndex;
  weakPoint?: ConceptWeakPointInput;
}

export interface AnswerOutcomeResult {
  evaluation: AnswerEvaluation;
  updatedProgress: UserCardProgress;
  nextRepeatLabel: string;
  ratingDelta: number;
  newRating: number;
  estimatedLevel: CefrLevel;
  recordedConcept?: ConceptNote;
  conceptProgressNote?: string;
}

export type PageLanguage = 'tr' | 'en';
export type PageTranslationDirection = 'tr-to-en' | 'en-to-tr';

export interface PageSentenceCandidate {
  id: string;
  blockIndex: number;
  text: string;
  lang: PageLanguage;
  score: number;
}

export interface ValidatedPageChallenge {
  candidateId: string;
  blockIndex: number;
  sentence: string;
  direction: PageTranslationDirection;
  referenceTranslation: string;
  notes?: string;
}

export interface PageAnswerEvaluation {
  isCorrect: boolean;
  feedback: string;
  referenceTranslation: string;
  providerIndex?: AiProviderIndex;
}

export interface ListeningChallenge {
  cardId: string;
  sentenceEn: string;
  meaningTr: string;
  level: CefrLevel;
  wordCount: number;
  uiLanguage: FeedbackLanguageMode;
}

export interface DictationWordToken {
  expected: string;
  actual: string | null;
  matched: boolean;
}

export interface DictationEvaluation {
  isCorrect: boolean;
  accuracyPercent: number;
  tokens: DictationWordToken[];
}

export type ExtensionMessage =
  | { type: 'USER_ACTIVITY' }
  | { type: 'SHOW_CARD'; payload: ActivePrompt }
  | { type: 'HIDE_CARD' }
  | { type: 'SHOW_TOAST'; message: string; variant?: 'success' | 'info' | 'error' }
  | {
      type: 'SUBMIT_ANSWER';
      cardId: string;
      userAnswer: string;
      card?: Card;
      source?: 'recall' | 'roadmap';
    }
  | {
      type: 'MARK_DONT_KNOW';
      cardId: string;
      card?: Card;
      source?: 'recall' | 'roadmap';
    }
  | { type: 'OVERRIDE_CORRECT'; cardId: string; card?: Card; source?: 'recall' | 'roadmap' }
  | { type: 'FLAG_CONCEPT_GAP'; cardId: string; focusToken: string; userQuestion?: string; card?: Card }
  | { type: 'DELETE_CONCEPT_NOTE'; conceptId: string }
  | { type: 'SNOOZE_PROMPT'; minutes: number }
  | { type: 'MUTE_FOR_HOURS'; hours: number }
  | { type: 'CLEAR_MUTE' }
  | { type: 'DISMISS_PROMPT'; cardId: string }
  | { type: 'TRIGGER_NOW'; tabId?: number }
  | { type: 'START_PAGE_QUIZ'; tabId?: number }
  | { type: 'RUN_PAGE_QUIZ' }
  | { type: 'START_LISTENING_QUIZ'; tabId?: number }
  | { type: 'RUN_LISTENING_QUIZ' }
  | { type: 'GET_LISTENING_CHALLENGE'; excludeIds?: string[] }
  | {
      type: 'VALIDATE_PAGE_SENTENCES';
      direction: PageTranslationDirection;
      candidates: Array<{ id: string; blockIndex: number; text: string }>;
    }
  | {
      type: 'EVALUATE_PAGE_TRANSLATION';
      direction: PageTranslationDirection;
      sourceSentence: string;
      referenceTranslation: string;
      userAnswer: string;
    }
  | {
      type: 'EVALUATE_ROADMAP_EXERCISE';
      card: Card;
      direction: 'en-to-tr' | 'tr-to-en' | 'en-audio';
      kind: 'word_bank' | 'audio_dictation' | 'free_translation';
      promptText: string;
      expectedAnswers: string[];
      userAnswer: string;
      localCorrect: boolean;
      localScore: number;
      recordProgress: boolean;
    }
  | { type: 'TOGGLE_BLOCK_HOST'; host: string }
  | { type: 'TEST_AI_CONNECTION' }
  | { type: 'FETCH_AI_MODELS' }
  | { type: 'TEST_FALLBACK_AI_CONNECTION' }
  | { type: 'FETCH_FALLBACK_AI_MODELS' }
  | { type: 'TEST_FALLBACK2_AI_CONNECTION' }
  | { type: 'FETCH_FALLBACK2_AI_MODELS' }
  | { type: 'GENERATE_AI_COACH_REPORT' }
  | { type: 'GENERATE_ROADMAP_COACH_BANNER'; language?: FeedbackLanguageMode }
  | { type: 'GET_STATUS' }
  | { type: 'SETTINGS_UPDATED' };

export interface StatusSnapshot {
  settings: ExtensionSettings;
  nextAlarmAt: number | null;
  retryQueueCount: number;
  totalCards: number;
  masteredCount: number;
  dailyStats: DailyStats;
  lastActiveTab: ActiveTabRecord | null;
  hasPendingPrompt: boolean;
  aiEnabled: boolean;
  aiModel: string;
  aiProviderIndex?: AiProviderIndex;
  aiFallbackActiveUntil?: number | null;
  skillProfile: UserSkillProfile;
  activeConceptsCount: number;
  masteredConceptsCount: number;
}
