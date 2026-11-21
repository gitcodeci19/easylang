import { openAiTutorDrawer } from './aiTutorDrawer';
import {
  STEPS_PER_NODE,
  buildUnitLessonExercises,
  completeRoadmapNodeStep,
  computeRoadmapProgress,
  createInitialRoadmapState,
  CURRICULUM_UNITS,
  getCardsForUnit,
  getRoadmapCourseRank,
  type ComputedNodeState,
  type ComputedUnitProgress,
  type CurriculumUnit,
  type LessonExercise,
  type RoadmapNodeKind,
  type RoadmapState,
} from './curriculum';
import { resolveSupportedLanguage } from './i18n';
import { evaluateEnglishAnswer, evaluateTurkishAnswer } from './matcher';
import {
  createModeTabBar,
  renderRemedialBriefing,
  renderRemedialHub,
  setCrimsonThemeActive,
  startRemedialLessonSession,
  type RemedialViewContext,
} from './remedialView';
import {
  buildFallbackRoadmapCoachBanner,
  chooseActiveSessionToResume,
  computeRoadmapAccuracyStats,
} from './roadmapCoach';
import {
  formatLessonProgressCounter,
  getPlacementAvailability,
  PLACEMENT_RETAKE_COOLDOWN_DAYS,
  PLACEMENT_TOTAL_QUESTIONS,
} from './placementTest';
import { startPlacementTestSession } from './placementTestView';
import { cancelEnglishSpeech, speakEnglishText as speakEnglish } from './speech';
import { evaluateDictationAnswer } from './srs';
import { attachWordBankTileGesture } from './wordBankDrag';
import {
  appendRoadmapLessonRecord,
  clearActiveRemedialSession,
  clearActiveRoadmapSession,
  getActiveRemedialSession,
  getActiveRoadmapSession,
  getAiConfig,
  getAllCards,
  getConceptState,
  getOpenGuidebookUnitId,
  getProgressMap,
  getRemedialAiOverlay,
  getRemedialProgress,
  getReviewHistory,
  getRoadmapCoachInsight,
  getRoadmapHistory,
  getRoadmapState,
  getRoadmapUiMode,
  saveActiveRoadmapSession,
  saveOpenGuidebookUnitId,
  saveRemedialAiOverlay,
  saveRoadmapCoachInsight,
  isAiApiConfigured,
  saveRoadmapState,
  saveRoadmapUiMode,
} from './storage';
import {
  createQuestionVoiceCard,
  openTeachMeDrawer,
  type QuestionVoiceCardController,
  stopActiveRuleAudio,
} from './teachMeDrawer';
import {
  ACTIVE_ROADMAP_SESSION_VERSION,
  type AiTutorChatTurn,
  type AnswerOutcomeResult,
  type Card,
  type CheckedFeedbackSnapshot,
  type ConceptTrackerState,
  type DiagnosedWeakness,
  type ExerciseDraftState,
  type ExtensionMessage,
  type FeedbackLanguageMode,
  type LessonExerciseKind,
  type RemedialMasteryRecord,
  type ReviewEvent,
  type RoadmapActiveSession,
  type RoadmapCoachInsight,
  type RoadmapKindStatMap,
  type RoadmapLessonRecord,
  type RoadmapMistakeItem,
  type UserCardProgress,
} from './types';
import {
  type AiDiagnosedOverlayItem,
  detectHelpSkillsForQuestion,
  diagnoseUserWeaknesses,
  findRemedialQuestionAudioForSentence,
  getResolvedRemedialSkillIds,
  hasRichTeachMeSkills,
} from './weaknessDetector';

export interface RoadmapViewOptions {
  container: HTMLElement;
  uiLanguage?: FeedbackLanguageMode;
  onStateUpdated?: (state: RoadmapState) => void;
}

interface RoadmapUiLabels {
  unitPrefix: (u: number) => string;
  guidebookBtn: string;
  focusBtn: string;
  focusedBtn: string;
  dailyXpFmt: (cur: number, goal: number) => string;
  startBadge: string;
  jumpHereBadge: string;
  chestLabel: string;
  chestOpened: string;
  wordsMasteredFmt: (m: number, total: number) => string;
  guideTipHeader: string;
  guidePhrasesHeader: string;
  guideWordsHeader: string;
  closeBtn: string;
  checkBtn: string;
  aiCheckingBtn: string;
  aiActiveBadge: string;
  aiApprovedTag: string;
  aiDisabledTip: string;
  overrideBtn: string;
  overrideAcceptedTitle: string;
  continueBtn: string;
  skipBtn: string;
  cantListenBtn: string;
  audioBypassTitle: string;
  audioBypassNote: string;
  audioBypassSolutionLabel: string;
  newWordBadge: string;
  retryBadge: string;
  wordBankHint: string;
  typeAnswerPlaceholder: string;
  typeEnglishPlaceholder: string;
  correctHeader: string;
  wrongHeader: string;
  correctAnswerLabel: string;
  lessonCompleteTitle: string;
  lessonCompleteSub: string;
  xpEarnedLabel: string;
  accuracyLabel: string;
  finishLessonBtn: string;
  comboFmt: (n: number) => string;
  instrSelectMeaning: string;
  instrSelectEn: string;
  instrCloze: string;
  instrWordBank: string;
  instrWordBankTr: string;
  instrAudio: string;
  instrFree: string;
  instrFreeEn: string;
  nodeLabels: Record<RoadmapNodeKind, string>;
}

function getRoadmapLabels(langMode: FeedbackLanguageMode | undefined): {
  isTr: boolean;
  L: RoadmapUiLabels;
} {
  const code = resolveSupportedLanguage(langMode);
  const isTr = code === 'tr';
  if (isTr) {
    return {
      isTr: true,
      L: {
        unitPrefix: (u) => `Ünite ${u}`,
        guidebookBtn: 'Rehber',
        focusBtn: 'Odakla',
        focusedBtn: 'Odaklı ✓',
        dailyXpFmt: (cur, goal) => `Günlük ${cur}/${goal} XP`,
        startBadge: 'BAŞLAT',
        jumpHereBadge: 'BURAYA ATLA',
        chestLabel: '+25 XP Sandık',
        chestOpened: '25 XP Alındı',
        wordsMasteredFmt: (m, total) => `${m}/${total} öğrenildi`,
        guideTipHeader: 'Gramer & Kullanım Notu',
        guidePhrasesHeader: 'Örnek Kalıplar',
        guideWordsHeader: 'Ünite Kelime ve Cümleleri',
        closeBtn: 'Kapat',
        checkBtn: 'Kontrol Et',
        aiCheckingBtn: '✨ AI Kontrol Ediyor...',
        aiActiveBadge: '✨ AI',
        aiApprovedTag: '✨ AI Onayı',
        aiDisabledTip: '💡 Eş anlam ve küçük yazım hataları için AI - API Ayarları bölümünden ücretsiz anahtar ekleyebilirsin.',
        overrideBtn: '✓ Doğru Say',
        overrideAcceptedTitle: '✓ Doğru kabul edildi',
        continueBtn: 'Devam Et',
        skipBtn: 'Geç',
        cantListenBtn: '🔇 Şu an sesi dinleyemiyorum',
        audioBypassTitle: '🔇 Dinlemeden geçildi (Kabul edildi)',
        audioBypassNote: 'Bu soru doğru veya yanlış olarak işaretlenmedi.',
        audioBypassSolutionLabel: 'Cümle:',
        newWordBadge: 'YENİ KELİME',
        retryBadge: 'HATA TEKRARI',
        wordBankHint: 'Kelimelere tıklayarak veya sürükleyerek cümleyi kur:',
        typeAnswerPlaceholder: 'Türkçe çeviriyi yazın...',
        typeEnglishPlaceholder: 'İngilizce karşılığını yazın...',
        correctHeader: 'Doğru Cevap',
        wrongHeader: 'Doğru Çözüm:',
        correctAnswerLabel: 'Cevap:',
        lessonCompleteTitle: 'Ders Tamamlandı',
        lessonCompleteSub: 'Bu adımı tamamladın ve yol haritasında ilerledin.',
        xpEarnedLabel: 'Kazanılan XP',
        accuracyLabel: 'Doğruluk',
        finishLessonBtn: 'Yol Haritasına Dön',
        comboFmt: (n) => `${n}x Seri`,
        instrSelectMeaning: 'Doğru anlamı seçin:',
        instrSelectEn: 'İngilizce karşılığını seçin:',
        instrCloze: 'Boşluğa uygun kelimeyi seçin:',
        instrWordBank: 'Kelime bankasıyla İngilizceye çevirin:',
        instrWordBankTr: 'Kelime bankasıyla Türkçeye çevirin:',
        instrAudio: 'Dinlediğiniz cümleyi kelimelerle kurun:',
        instrFree: 'Türkçe çevirisini yazın:',
        instrFreeEn: 'İngilizceye çevirin:',
        nodeLabels: {
          skill: 'Kelime Keşfi',
          story: 'Bağlam & Cümle',
          duo_radio: 'Radyo & Dikte',
          practice: 'Zayıf Noktalar',
          unit_review: 'Ünite Testi',
        },
      },
    };
  }

  return {
    isTr: false,
    L: {
      unitPrefix: (u) => `Unit ${u}`,
      guidebookBtn: 'Guide',
      focusBtn: 'Focus',
      focusedBtn: 'Focused ✓',
      dailyXpFmt: (cur, goal) => `Daily ${cur}/${goal} XP`,
      startBadge: 'START',
      jumpHereBadge: 'JUMP HERE',
      chestLabel: '+25 XP Chest',
      chestOpened: '25 XP Claimed',
      wordsMasteredFmt: (m, total) => `${m}/${total} mastered`,
      guideTipHeader: 'Grammar & Usage Note',
      guidePhrasesHeader: 'Key Phrases',
      guideWordsHeader: 'Unit Vocabulary & Sentences',
      closeBtn: 'Close',
      checkBtn: 'Check',
      aiCheckingBtn: '✨ AI Checking...',
      aiActiveBadge: '✨ AI',
      aiApprovedTag: '✨ AI Approved',
      aiDisabledTip: '💡 Add a free AI key under AI - API Keys so synonyms & minor typos are accepted.',
      overrideBtn: '✓ Accept Answer',
      overrideAcceptedTitle: '✓ Marked as correct',
      continueBtn: 'Continue',
      skipBtn: 'Skip',
      cantListenBtn: "🔇 Can't listen right now",
      audioBypassTitle: '🔇 Accepted without audio',
      audioBypassNote: 'Not scored as right or wrong.',
      audioBypassSolutionLabel: 'Sentence:',
      newWordBadge: 'NEW WORD',
      retryBadge: 'MISTAKE REVIEW',
      wordBankHint: 'Tap or drag word tiles to build the sentence:',
      typeAnswerPlaceholder: 'Type Turkish translation...',
      typeEnglishPlaceholder: 'Type English translation...',
      correctHeader: 'Correct',
      wrongHeader: 'Solution:',
      correctAnswerLabel: 'Answer:',
      lessonCompleteTitle: 'Lesson Complete',
      lessonCompleteSub: 'You cleared this step and advanced on the path.',
      xpEarnedLabel: 'XP Earned',
      accuracyLabel: 'Accuracy',
      finishLessonBtn: 'Back to Roadmap',
      comboFmt: (n) => `${n}x Streak`,
      instrSelectMeaning: 'Select the correct meaning:',
      instrSelectEn: 'Select the English match:',
      instrCloze: 'Fill in the blank:',
      instrWordBank: 'Build the English sentence:',
      instrWordBankTr: 'Build the Turkish sentence:',
      instrAudio: 'Tap what you hear:',
      instrFree: 'Translate into Turkish:',
      instrFreeEn: 'Translate into English:',
      nodeLabels: {
        skill: 'Vocabulary',
        story: 'Context Builder',
        duo_radio: 'Audio Dictation',
        practice: 'Weak Points',
        unit_review: 'Unit Crown',
      },
    },
  };
}

function getNodeIconSvg(kind: RoadmapNodeKind | 'jump_test' | 'chest', completed: boolean): string {
  if (kind === 'chest') {
    return `
      <svg class="duo-node-glyph" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="10" width="18" height="10" rx="2" stroke="currentColor" stroke-width="2"/>
        <path d="M3 10C3 7.5 5 5.5 7.5 5.5H16.5C19 5.5 21 7.5 21 10" stroke="currentColor" stroke-width="2"/>
        <rect x="10.5" y="9" width="3" height="4" rx="0.8" fill="currentColor"/>
      </svg>
    `;
  }

  if (kind === 'jump_test') {
    return `
      <svg class="duo-node-glyph" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M5 5L14 12L5 19V5Z" fill="currentColor"/>
        <rect x="16" y="5" width="2.8" height="14" rx="1" fill="currentColor"/>
      </svg>
    `;
  }

  if (completed && kind !== 'unit_review') {
    return `
      <svg class="duo-node-glyph" width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M20 6.5L9.5 17L4.5 12" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  if (kind === 'skill') {
    return `
      <svg class="duo-node-glyph" width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 3L14.7 8.5L20.8 9.4L16.4 13.7L17.4 19.8L12 16.9L6.6 19.8L7.6 13.7L3.2 9.4L9.3 8.5L12 3Z" fill="currentColor"/>
      </svg>
    `;
  }

  if (kind === 'story') {
    return `
      <svg class="duo-node-glyph" width="21" height="21" viewBox="0 0 24 24" fill="none">
        <path d="M3 6.2C3 5 4 4 5.2 4H10.5C11.3 4 12 4.7 12 5.5V19C12 18.4 11.5 18 11 18H5.2C4 18 3 17 3 15.8V6.2ZM21 6.2C21 5 20 4 18.8 4H13.5C12.7 4 12 4.7 12 5.5V19C12 18.4 12.5 18 13 18H18.8C20 18 21 17 21 15.8V6.2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    `;
  }

  if (kind === 'duo_radio') {
    return `
      <svg class="duo-node-glyph" width="21" height="21" viewBox="0 0 24 24" fill="none">
        <path d="M4 13V11C4 6.6 7.6 3 12 3C16.4 3 20 6.6 20 11V13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        <rect x="3" y="12" width="4.5" height="7.5" rx="2.2" fill="currentColor"/>
        <rect x="16.5" y="12" width="4.5" height="7.5" rx="2.2" fill="currentColor"/>
      </svg>
    `;
  }

  if (kind === 'practice') {
    return `
      <svg class="duo-node-glyph" width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2.5" y="9" width="2.5" height="6" rx="1" fill="currentColor"/>
        <rect x="5.5" y="7" width="3" height="10" rx="1" fill="currentColor"/>
        <rect x="8.5" y="10.8" width="7" height="2.4" fill="currentColor"/>
        <rect x="15.5" y="7" width="3" height="10" rx="1" fill="currentColor"/>
        <rect x="19" y="9" width="2.5" height="6" rx="1" fill="currentColor"/>
      </svg>
    `;
  }

  return `
    <svg class="duo-node-glyph" width="21" height="21" viewBox="0 0 24 24" fill="none">
      <path d="M7 4H17V9C17 11.8 14.8 14 12 14C9.2 14 7 11.8 7 9V4Z" stroke="currentColor" stroke-width="2"/>
      <path d="M9 19H15M12 14V19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M7 6H4.5V8.5C4.5 10 5.6 11 7 11M17 6H19.5V8.5C19.5 10 18.4 11 17 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  `;
}

const WINDING_OFFSETS_PX = [0, -48, 0, 48, 0];

export class RoadmapController {
  private container: HTMLElement;
  private uiLanguage: FeedbackLanguageMode;
  private onStateUpdated?: (state: RoadmapState) => void;

  private allCards: Card[] = [];
  private progressMap: Record<string, UserCardProgress> = {};
  private state: RoadmapState | null = null;
  private aiActive: boolean = false;
  private historyRecords: RoadmapLessonRecord[] = [];
  private reviewHistory: ReviewEvent[] = [];
  private conceptState: ConceptTrackerState = { notes: [], lastConceptPromptAtQuestion: -10 };
  private remedialProgress: Record<string, RemedialMasteryRecord> = {};
  private diagnosedWeaknesses: DiagnosedWeakness[] = [];
  private aiDiagnosticOverlay: AiDiagnosedOverlayItem[] = [];
  private activeMode: 'path' | 'remedial' = 'path';
  private coachInsight: RoadmapCoachInsight | null = null;

  constructor(options: RoadmapViewOptions) {
    this.container = options.container;
    this.uiLanguage = options.uiLanguage ?? 'auto';
    this.onStateUpdated = options.onStateUpdated;
  }

  public async setLanguage(lang: FeedbackLanguageMode, shouldRefresh: boolean = true): Promise<void> {
    this.uiLanguage = lang;
    if (shouldRefresh) {
      await this.refresh();
    }
  }

  public setMode(mode: 'path' | 'remedial'): void {
    this.activeMode = mode;
    void saveRoadmapUiMode(mode);
    void saveOpenGuidebookUnitId(null);
    if (mode === 'remedial') {
      renderRemedialHub(this.buildRemedialContext());
    } else {
      setCrimsonThemeActive(false);
      this.renderPathView();
    }
  }

  private recomputeDiagnosis(): DiagnosedWeakness[] {
    this.diagnosedWeaknesses = diagnoseUserWeaknesses({
      cards: this.allCards,
      progressMap: this.progressMap,
      reviewHistory: this.reviewHistory,
      roadmapHistory: this.historyRecords,
      conceptState: this.conceptState,
      remedialProgress: this.remedialProgress,
      aiExtraWeaknesses: this.aiDiagnosticOverlay,
    });
    return this.diagnosedWeaknesses;
  }

  private buildRemedialContext(): RemedialViewContext {
    return {
      container: this.container,
      uiLanguage: this.uiLanguage,
      aiActive: this.aiActive,
      allCards: this.allCards,
      progressMap: this.progressMap,
      diagnosedWeaknesses: this.diagnosedWeaknesses,
      remedialProgress: this.remedialProgress,
      onSwitchToPath: () => {
        this.activeMode = 'path';
        void saveRoadmapUiMode('path');
        setCrimsonThemeActive(false);
        this.renderPathView();
      },
      onRefreshDiagnosis: async (aiOverlay?: AiDiagnosedOverlayItem[]) => {
        if (aiOverlay) {
          this.aiDiagnosticOverlay = aiOverlay;
          await saveRemedialAiOverlay(aiOverlay);
        }
        const [progressMap, historyRecords, reviewHistory, conceptState, remedialProgress, state] =
          await Promise.all([
            getProgressMap(),
            getRoadmapHistory(),
            getReviewHistory(),
            getConceptState(),
            getRemedialProgress(),
            getRoadmapState(),
          ]);
        this.progressMap = progressMap;
        this.historyRecords = historyRecords;
        this.reviewHistory = reviewHistory;
        this.conceptState = conceptState;
        this.remedialProgress = remedialProgress;
        this.state = state;
        this.onStateUpdated?.(state);
        this.recomputeDiagnosis();
        renderRemedialHub(this.buildRemedialContext());
      },
      onXpUpdated: async () => {
        const [state, remedialProgress, conceptState] = await Promise.all([
          getRoadmapState(),
          getRemedialProgress(),
          getConceptState(),
        ]);
        this.state = state;
        this.remedialProgress = remedialProgress;
        this.conceptState = conceptState;
        if (this.aiDiagnosticOverlay.length > 0) {
          const resolvedSet = new Set(
            getResolvedRemedialSkillIds({
              cards: this.allCards,
              progressMap: this.progressMap,
              reviewHistory: this.reviewHistory,
              roadmapHistory: this.historyRecords,
              conceptState: this.conceptState,
              remedialProgress: this.remedialProgress,
            })
          );
          const pruned = this.aiDiagnosticOverlay.filter((item) => !resolvedSet.has(item.skillId));
          if (pruned.length !== this.aiDiagnosticOverlay.length) {
            this.aiDiagnosticOverlay = pruned;
            await saveRemedialAiOverlay(pruned);
          }
        }
        this.onStateUpdated?.(state);
        return this.recomputeDiagnosis();
      },
    };
  }

  public async refresh(options?: { skipAutoResume?: boolean }): Promise<void> {
    const [
      cards,
      progressMap,
      state,
      aiCfg,
      activeSession,
      activeRemedialSession,
      savedMode,
      savedAiOverlay,
      openGuidebookUnitId,
      historyRecords,
      coachInsight,
      reviewHistory,
      conceptState,
      remedialProgress,
    ] = await Promise.all([
      getAllCards(),
      getProgressMap(),
      getRoadmapState(),
      getAiConfig(),
      getActiveRoadmapSession(),
      getActiveRemedialSession(),
      getRoadmapUiMode(),
      getRemedialAiOverlay(),
      getOpenGuidebookUnitId(),
      getRoadmapHistory(),
      getRoadmapCoachInsight(),
      getReviewHistory(),
      getConceptState(),
      getRemedialProgress(),
    ]);
    this.allCards = cards;
    this.progressMap = progressMap;
    this.state = state;
    this.historyRecords = historyRecords;
    this.reviewHistory = reviewHistory;
    this.conceptState = conceptState;
    this.remedialProgress = remedialProgress;
    if (savedAiOverlay && savedAiOverlay.items.length > 0) {
      this.aiDiagnosticOverlay = savedAiOverlay.items;
    }
    this.aiActive = Boolean(
      aiCfg.enabled &&
        ((aiCfg.apiKey.trim() && aiCfg.baseUrl.trim() && aiCfg.model.trim()) ||
          (aiCfg.fallbackEnabled && aiCfg.fallbackApiKey?.trim()) ||
          (aiCfg.fallback2Enabled && aiCfg.fallback2ApiKey?.trim()))
    );
    this.recomputeDiagnosis();

    const resolvedLang = resolveSupportedLanguage(this.uiLanguage);
    const fallbackBanner = buildFallbackRoadmapCoachBanner(historyRecords, resolvedLang);
    if (!coachInsight || (coachInsight.lessonCountAnalyzed === 0 && historyRecords.length > 0)) {
      this.coachInsight = fallbackBanner;
    } else {
      this.coachInsight = coachInsight;
    }

    if (!options?.skipAutoResume) {
      const decision = chooseActiveSessionToResume({
        roadmapSession: activeSession,
        remedialSession: activeRemedialSession,
        savedMode,
      });

      if (decision.target === 'remedial_session') {
        this.activeMode = 'remedial';
        if (decision.session.stage === 'briefing') {
          renderRemedialBriefing(
            this.buildRemedialContext(),
            decision.session.plan,
            decision.session.weakness,
            decision.session
          );
        } else {
          startRemedialLessonSession(
            this.buildRemedialContext(),
            decision.session.plan,
            decision.session.weakness,
            decision.session
          );
        }
        return;
      }

      if (decision.target === 'roadmap_session') {
        const resumedUnit = CURRICULUM_UNITS.find((u) => u.id === decision.session.unitId);
        if (resumedUnit) {
          this.activeMode = 'path';
          setCrimsonThemeActive(false);
          this.startLessonSession(
            resumedUnit,
            decision.session.nodeIndex,
            decision.session.stepIndex,
            decision.session
          );
          return;
        }
        void clearActiveRoadmapSession();
      }

      this.activeMode = decision.target === 'mode_view' ? decision.mode : savedMode;
    }

    if (this.activeMode === 'remedial') {
      renderRemedialHub(this.buildRemedialContext());
      return;
    }

    this.renderPathView();
    if (!options?.skipAutoResume && openGuidebookUnitId) {
      const gbUnit = CURRICULUM_UNITS.find((u) => u.id === openGuidebookUnitId);
      if (gbUnit) {
        this.openGuidebookModal(gbUnit);
      } else {
        void saveOpenGuidebookUnitId(null);
      }
    }
  }

  private renderPathView(scrollMode: 'active_node' | 'unit_top' = 'active_node'): void {
    if (!this.state) return;
    setCrimsonThemeActive(false);
    const { isTr, L } = getRoadmapLabels(this.uiLanguage);
    const unitsProgress = computeRoadmapProgress(this.state, this.allCards, this.progressMap);
    const activeUnitProg =
      unitsProgress.find((u) => u.unit.id === this.state?.activeUnitId) ?? unitsProgress[0]!;
    const activeUnit = activeUnitProg.unit;
    const courseRank = getRoadmapCourseRank(this.state);
    const resolvedLang = resolveSupportedLanguage(this.uiLanguage);

    this.container.replaceChildren();

    const root = document.createElement('div');
    root.className = 'duo-roadmap-root';

    // Mode switcher bar: Yol Haritası (violet) | 🔥 Özel Dersler (crimson)
    const urgentWeakCount = this.diagnosedWeaknesses.filter(
      (w) => w.severity === 'critical' || w.severity === 'focus'
    ).length;
    root.appendChild(
      createModeTabBar({
        activeMode: 'path',
        urgentCount: urgentWeakCount,
        isTr,
        onSelectMode: (mode) => {
          if (mode === 'remedial') {
            this.activeMode = 'remedial';
            void saveRoadmapUiMode('remedial');
            void saveOpenGuidebookUnitId(null);
            renderRemedialHub(this.buildRemedialContext());
          }
        },
      })
    );

    // 1. Minimal, Calm Unit Header Bar (Unit Picker + Concise 1-Line Progress + Quiet Actions)
    const unitBar = document.createElement('div');
    unitBar.className = 'duo-unit-bar';

    const unitBarLeft = document.createElement('div');
    unitBarLeft.className = 'duo-unit-bar-left';

    const unitSelect = document.createElement('select');
    unitSelect.className = 'duo-unit-picker';
    unitSelect.setAttribute('aria-label', 'Select Unit');
    for (const up of unitsProgress) {
      const opt = document.createElement('option');
      opt.value = up.unit.id;
      const title = isTr ? up.unit.titleTr : up.unit.titleEn;
      const mark = up.isCompleted ? '✓ ' : '';
      opt.textContent = `${mark}${L.unitPrefix(up.unit.unitNumber)} · ${title}`;
      if (up.unit.id === activeUnit.id) opt.selected = true;
      unitSelect.appendChild(opt);
    }

    const subMeta = document.createElement('div');
    subMeta.className = 'duo-unit-submeta';
    subMeta.textContent = isTr
      ? `${activeUnit.level} · ${activeUnitProg.masteredUnitCards}/${activeUnitProg.totalUnitCards} kelime`
      : `${activeUnit.level} · ${activeUnitProg.masteredUnitCards}/${activeUnitProg.totalUnitCards} words`;
    subMeta.title = isTr
      ? `Harita: ${courseRank.courseLevel} (${courseRank.completedNodesCount}/${courseRank.totalNodesCount} ders) · ${L.dailyXpFmt(this.state.dailyXp, this.state.dailyXpGoal)}`
      : `Course: ${courseRank.courseLevel} (${courseRank.completedNodesCount}/${courseRank.totalNodesCount} lessons) · ${L.dailyXpFmt(this.state.dailyXp, this.state.dailyXpGoal)}`;

    unitBarLeft.append(unitSelect, subMeta);

    const unitBarRight = document.createElement('div');
    unitBarRight.className = 'duo-unit-bar-actions';

    const guideBtn = document.createElement('button');
    guideBtn.type = 'button';
    guideBtn.className = 'duo-bar-btn';
    guideBtn.textContent = L.guidebookBtn;
    guideBtn.addEventListener('click', () => this.openGuidebookModal(activeUnit));

    const focusBtn = document.createElement('button');
    focusBtn.type = 'button';
    const isFocused = Boolean(this.state.focusUnitOnly);
    focusBtn.className = `duo-bar-btn ${isFocused ? 'is-active' : ''}`;
    focusBtn.textContent = isFocused ? L.focusedBtn : L.focusBtn;
    focusBtn.title = isTr
      ? 'Arka plan 20 dk sorularını bu üniteden sor (alt seviye ünitelerde Elo korunur)'
      : 'Prioritize this unit for 20-min recall prompts (Elo drop protected on lower-level units)';
    focusBtn.addEventListener('click', async () => {
      const nextFocus = !this.state?.focusUnitOnly;
      this.state = await saveRoadmapState({
        activeUnitId: activeUnit.id,
        focusUnitOnly: nextFocus,
      });
      this.onStateUpdated?.(this.state);
      this.renderPathView();
    });

    const resetMapBtn = document.createElement('button');
    resetMapBtn.type = 'button';
    resetMapBtn.className = 'duo-bar-btn';
    resetMapBtn.textContent = '↺';
    resetMapBtn.title = isTr
      ? 'Sadece Yol Haritası ilerlemesini Ünite 1 başına sıfırla (20dk Recall ELO puanınız korunur)'
      : 'Reset Roadmap progress back to Unit 1 (keeps your 20m Recall Elo intact)';
    resetMapBtn.addEventListener('click', async () => {
      const msg = isTr
        ? 'Sadece Yol Haritası ilerlemesi Ünite 1 başına sıfırlansın mı? (20dk Recall ELO puanınız ve öğrenilen kelimeleriniz silinmez.)'
        : 'Reset only Roadmap progress back to Unit 1? (Your 20m Recall Elo and learned cards will not be affected.)';
      if (!window.confirm(msg)) return;
      await clearActiveRoadmapSession();
      await saveOpenGuidebookUnitId(null);
      const fresh = createInitialRoadmapState();
      this.state = await saveRoadmapState(fresh);
      this.onStateUpdated?.(this.state);
      this.renderPathView();
    });

    unitBarRight.append(guideBtn, focusBtn, resetMapBtn);
    unitBar.append(unitBarLeft, unitBarRight);
    root.appendChild(unitBar);

    // 2. Scrollable S-Curve Roadmap Canvas
    const pathScroll = document.createElement('div');
    pathScroll.className = 'duo-skill-path';

    // Smart collapsible floating AI Coach pill tucked cleanly INSIDE the Roadmap canvas (0px chrome bloat)
    const insight =
      this.coachInsight ?? buildFallbackRoadmapCoachBanner(this.historyRecords, resolvedLang);
    const coachStrip = document.createElement('button');
    coachStrip.type = 'button';
    coachStrip.className = `duo-coach-strip status-${insight.status}`;
    coachStrip.setAttribute('aria-expanded', 'false');

    const coachHead = document.createElement('div');
    coachHead.className = 'duo-coach-head';

    const coachDot = document.createElement('span');
    coachDot.className = 'duo-coach-dot';
    coachDot.setAttribute('aria-hidden', 'true');

    const coachTag = document.createElement('span');
    coachTag.className = 'duo-coach-tag';
    coachTag.textContent =
      insight.lessonCountAnalyzed > 0
        ? isTr
          ? insight.source === 'ai'
            ? `AI Koç · Son ${insight.lessonCountAnalyzed} Ders`
            : `Son ${insight.lessonCountAnalyzed} Ders Özeti`
          : insight.source === 'ai'
            ? `AI Coach · Last ${insight.lessonCountAnalyzed}`
            : `Last ${insight.lessonCountAnalyzed} Summary`
        : isTr
          ? 'AI Koç'
          : 'AI Coach';

    const coachChevron = document.createElement('span');
    coachChevron.className = 'duo-coach-chevron';
    coachChevron.textContent = '▾';

    coachHead.append(coachDot, coachTag, coachChevron);

    const coachMsg = document.createElement('div');
    coachMsg.className = 'duo-coach-msg';
    coachMsg.textContent = insight.message;
    coachMsg.hidden = true;

    coachStrip.append(coachHead, coachMsg);
    coachStrip.addEventListener('click', () => {
      const nextOpen = coachMsg.hidden;
      coachMsg.hidden = !nextOpen;
      coachStrip.classList.toggle('is-expanded', nextOpen);
      coachStrip.setAttribute('aria-expanded', String(nextOpen));
      coachChevron.textContent = nextOpen ? '▴' : '▾';
    });
    pathScroll.appendChild(coachStrip);

    // Integrated CEFR Placement Exam Gate inside the very top of the Roadmap canvas
    // Visually distinct (Sky/Cyan diagnostic card) so users never confuse it with a regular lesson
    const placementRes = this.state.placementResult;
    const placementAvail = getPlacementAvailability(this.state);
    const placementCard = document.createElement('div');
    placementCard.className = `duo-placement-banner${placementRes ? ' is-done' : ''}`;

    const placementInfo = document.createElement('div');
    placementInfo.className = 'duo-placement-info';

    const placementEyebrow = document.createElement('span');
    placementEyebrow.className = 'duo-placement-eyebrow';
    placementEyebrow.textContent = placementRes
      ? isTr
        ? `SEVİYE TESPİT SINAVI · SONUÇ ${placementRes.level}`
        : `PLACEMENT EXAM · RESULT ${placementRes.level}`
      : isTr
        ? `SEVİYE TESPİT SINAVI · ${PLACEMENT_TOTAL_QUESTIONS} SORU`
        : `PLACEMENT EXAM · ${PLACEMENT_TOTAL_QUESTIONS} QUESTIONS`;
    placementInfo.appendChild(placementEyebrow);

    const placementTitle = document.createElement('div');
    placementTitle.className = 'duo-placement-title';
    placementTitle.textContent = placementRes
      ? isTr
        ? `Gerçek Seviyen: ${placementRes.level} (${placementRes.score}/${placementRes.total})`
        : `Your Real Level: ${placementRes.level} (${placementRes.score}/${placementRes.total})`
      : isTr
        ? 'Gerçek Seviyemi Belirle (A1 → C1)'
        : 'Measure Your Real Level (A1 → C1)';
    placementInfo.appendChild(placementTitle);

    const placementSub = document.createElement('div');
    placementSub.className = 'duo-placement-sub';
    if (!placementRes) {
      placementSub.textContent = isTr
        ? 'Normal ders değildir — seviyene göre uygun ünitelerin kilidini açar'
        : 'Not a regular lesson — unlocks roadmap units matching your level';
    } else if (placementAvail.freeImmediateRemaining > 0) {
      placementSub.textContent = isTr
        ? `1 anlık tekrar hakkın kaldı (2. çözümden sonra ${PLACEMENT_RETAKE_COOLDOWN_DAYS} günde bir açılır)`
        : `1 immediate retake left (then unlocks every ${PLACEMENT_RETAKE_COOLDOWN_DAYS} days)`;
    } else if (!placementAvail.canTake) {
      placementSub.textContent = isTr
        ? `Tekrar ölçüm ${PLACEMENT_RETAKE_COOLDOWN_DAYS} günde bir açılır · Üniteleri atlamak için "BURAYA ATLA"yı kullanabilirsin`
        : `Retakes unlock every ${PLACEMENT_RETAKE_COOLDOWN_DAYS} days · Use "JUMP HERE" to skip units anytime`;
    } else {
      placementSub.textContent = isTr
        ? 'Yeni 7 günlük ölçüm hakkın açıldı — seviyeni güncelleyebilirsin'
        : 'Your 7-day retake window is open — re-test your level anytime';
    }
    placementInfo.appendChild(placementSub);

    const placementBtn = document.createElement('button');
    placementBtn.type = 'button';
    placementBtn.className = `duo-placement-cta${placementRes ? ' is-retake' : ''}`;
    placementBtn.disabled = !placementAvail.canTake;
    if (!placementRes) {
      placementBtn.textContent = isTr ? 'Seviye Testini Başlat →' : 'Start Level Exam →';
    } else if (!placementAvail.canTake) {
      placementBtn.textContent = isTr
        ? `⏳ ${placementAvail.daysRemaining} gün sonra`
        : `⏳ In ${placementAvail.daysRemaining}d`;
      placementBtn.title = isTr
        ? `2. çözümden sonra seviye testi ${PLACEMENT_RETAKE_COOLDOWN_DAYS} günde bir açılır`
        : `Placement exam retakes unlock every ${PLACEMENT_RETAKE_COOLDOWN_DAYS} days after your 2nd attempt`;
    } else if (placementAvail.freeImmediateRemaining > 0) {
      placementBtn.textContent = isTr ? 'Tekrar Ölç (1 hak)' : 'Retake (1 left)';
    } else {
      placementBtn.textContent = isTr ? 'Seviyeni Tekrar Ölç' : 'Retake Level Exam';
    }
    placementBtn.addEventListener('click', () => {
      if (!placementAvail.canTake) return;
      void clearActiveRoadmapSession();
      void saveOpenGuidebookUnitId(null);
      startPlacementTestSession({
        container: this.container,
        allCards: this.allCards,
        uiLanguage: this.uiLanguage,
        attemptSeedSalt: placementAvail.attemptsCount * 9973,
        onExit: () => {
          this.renderPathView();
        },
        onCompleted: (nextState) => {
          this.state = nextState;
          this.onStateUpdated?.(nextState);
          this.renderPathView('unit_top');
        },
      });
    });

    placementCard.append(placementInfo, placementBtn);
    pathScroll.appendChild(placementCard);

    for (const up of unitsProgress) {
      const secEl = this.buildUnitSectionElement(
        up,
        isTr,
        L,
        activeUnit.id,
        courseRank,
        this.state.xp
      );
      pathScroll.appendChild(secEl);
    }

    unitSelect.addEventListener('change', async () => {
      const nextId = unitSelect.value;
      this.state = await saveRoadmapState({ activeUnitId: nextId });
      this.onStateUpdated?.(this.state);
      this.renderPathView('unit_top');
    });

    root.appendChild(pathScroll);
    this.container.appendChild(root);

    requestAnimationFrame(() => {
      if (scrollMode === 'unit_top') {
        const targetEl = pathScroll.querySelector(`[data-unit-section="${activeUnit.id}"]`);
        targetEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      const activeSec = pathScroll.querySelector(`[data-unit-section="${activeUnit.id}"]`);
      const targetRow =
        activeSec?.querySelector<HTMLElement>('.duo-node-row.is-active') ??
        pathScroll.querySelector<HTMLElement>('.duo-node-row.is-active') ??
        activeSec;
      if (targetRow) {
        targetRow.scrollIntoView({ behavior: 'auto', block: 'center' });
        const focusBtnTarget = targetRow.querySelector<HTMLButtonElement>('.duo-node-btn');
        focusBtnTarget?.focus({ preventScroll: true });
      }
    });
  }

  private buildUnitSectionElement(
    up: ComputedUnitProgress,
    isTr: boolean,
    L: RoadmapUiLabels,
    activeUnitId: string,
    courseRank: ReturnType<typeof getRoadmapCourseRank>,
    totalXp: number
  ): HTMLElement {
    const { unit } = up;
    const sec = document.createElement('section');
    sec.className = `duo-unit-section ${up.isUnlocked ? 'unlocked' : 'locked'} ${
      unit.id === activeUnitId ? 'is-selected' : ''
    }`;
    sec.dataset.unitSection = unit.id;

    // Clean Section Divider Header
    const header = document.createElement('header');
    header.className = 'duo-unit-divider';

    const hrLeft = document.createElement('hr');
    const titleWrap = document.createElement('div');
    titleWrap.className = 'duo-divider-chip';

    const numBadge = document.createElement('span');
    numBadge.className = 'duo-divider-lvl';
    numBadge.textContent = `${unit.level} · #${unit.unitNumber}`;

    const h3 = document.createElement('span');
    h3.className = 'duo-unit-divider-title';
    h3.textContent = isTr ? unit.titleTr : unit.titleEn;

    const miniGuide = document.createElement('button');
    miniGuide.type = 'button';
    miniGuide.className = 'duo-divider-guide';
    miniGuide.textContent = L.guidebookBtn;
    miniGuide.addEventListener('click', () => this.openGuidebookModal(unit));

    titleWrap.append(numBadge, h3, miniGuide);
    const hrRight = document.createElement('hr');
    header.append(hrLeft, titleWrap, hrRight);
    sec.appendChild(header);

    const nodesTrack = document.createElement('div');
    nodesTrack.className = 'duo-nodes-track';

    // If locked, offer a sleek "BURAYA ATLA" pill at the start of the unit
    if (!up.isUnlocked) {
      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.className = 'duo-jump-pill-btn';
      jumpBtn.innerHTML = `${getNodeIconSvg('jump_test', false)} <span>${L.jumpHereBadge}</span>`;
      jumpBtn.addEventListener('click', () => {
        this.startLessonSession(unit, 'jump_test');
      });
      nodesTrack.appendChild(jumpBtn);
    }

    for (let i = 0; i < up.nodes.length; i += 1) {
      const nodeState = up.nodes[i]!;
      const offsetPx = WINDING_OFFSETS_PX[i % WINDING_OFFSETS_PX.length] ?? 0;

      const row = document.createElement('div');
      row.className = `duo-node-row ${nodeState.status === 'active' ? 'is-active' : ''}`;
      row.style.transform = `translateX(${offsetPx}px)`;

      // Vertical connector line to next node
      if (i < up.nodes.length - 1) {
        const nextOffset = WINDING_OFFSETS_PX[(i + 1) % WINDING_OFFSETS_PX.length] ?? 0;
        const dx = nextOffset - offsetPx;
        const connSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        connSvg.setAttribute('class', 'duo-node-connector');
        connSvg.setAttribute('viewBox', '-80 0 160 44');
        const isDone = nodeState.status === 'completed';
        connSvg.innerHTML = `
          <line x1="0" y1="0" x2="${dx}" y2="44"
            stroke="${isDone ? 'rgba(245, 158, 11, 0.45)' : 'rgba(255, 255, 255, 0.09)'}"
            stroke-width="2.5" stroke-dasharray="${isDone ? 'none' : '4 4'}" />
        `;
        row.appendChild(connSvg);
      }

      if (nodeState.status === 'active') {
        const callout = document.createElement('div');
        callout.className = 'duo-node-callout';
        const nextStepNum = Math.min(nodeState.totalSteps, nodeState.completedSteps + 1);
        callout.textContent =
          nodeState.completedSteps === 0
            ? `${L.startBadge} · 1/${nodeState.totalSteps}`
            : isTr
              ? `ADIM ${nextStepNum}/${nodeState.totalSteps}`
              : `STEP ${nextStepNum}/${nodeState.totalSteps}`;
        row.appendChild(callout);
      }

      const ringWrap = document.createElement('div');
      ringWrap.className = `duo-node-ring-wrap ${nodeState.status}`;

      if (nodeState.status === 'active') {
        const stepPct =
          nodeState.completedSteps === 0
            ? 14
            : Math.round((nodeState.completedSteps / nodeState.totalSteps) * 100);
        const dashOffset = 226 - (226 * stepPct) / 100;
        const ringSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        ringSvg.setAttribute('class', 'duo-progress-ring');
        ringSvg.setAttribute('viewBox', '0 0 84 84');
        ringSvg.innerHTML = `
          <circle cx="42" cy="42" r="36" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="4.5"/>
          <circle cx="42" cy="42" r="36" fill="none" stroke="#8b5cf6" stroke-width="4.5"
            stroke-linecap="round" stroke-dasharray="226" stroke-dashoffset="${dashOffset}"
            transform="rotate(-90 42 42)"/>
        `;
        ringWrap.appendChild(ringSvg);
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `duo-node-btn state-${nodeState.status} kind-${nodeState.node.kind}`;
      btn.title = isTr
        ? `${nodeState.node.titleTr} · Adım ${Math.min(nodeState.totalSteps, nodeState.completedSteps + 1)}/${nodeState.totalSteps}`
        : `${nodeState.node.titleEn} · Step ${Math.min(nodeState.totalSteps, nodeState.completedSteps + 1)}/${nodeState.totalSteps}`;
      btn.innerHTML = getNodeIconSvg(
        nodeState.node.kind,
        nodeState.status === 'completed'
      );

      // Direct 1-click lesson launch at the node's current step (0, 1, or 2)
      btn.addEventListener('click', () => {
        const stepToLaunch =
          nodeState.status === 'completed'
            ? Math.floor(Date.now() / 1000) % STEPS_PER_NODE
            : nodeState.completedSteps;
        this.startLessonSession(unit, nodeState.node.index, stepToLaunch);
      });

      ringWrap.appendChild(btn);

      if (nodeState.status === 'active') {
        const xpSidePill = document.createElement('div');
        xpSidePill.className = `duo-active-xp-pill ${i === 2 ? 'is-left' : 'is-right'}`;
        xpSidePill.title = isTr
          ? `Yol Haritası Kurs Seviyesi: ${courseRank.courseLevel} (${courseRank.completedNodesCount}/${courseRank.totalNodesCount} ders tamamlandı · ${totalXp} XP)`
          : `Roadmap Course Rank: ${courseRank.courseLevel} (${courseRank.completedNodesCount}/${courseRank.totalNodesCount} lessons · ${totalXp} XP)`;

        const lvlSpan = document.createElement('span');
        lvlSpan.className = 'duo-axp-lvl';
        lvlSpan.textContent = courseRank.courseLevel;

        const xpSpan = document.createElement('span');
        xpSpan.className = 'duo-axp-val';
        xpSpan.textContent = `${totalXp} XP`;

        xpSidePill.append(lvlSpan, xpSpan);
        ringWrap.appendChild(xpSidePill);
      }

      row.appendChild(ringWrap);

      const cap = document.createElement('div');
      cap.className = `duo-node-caption ${nodeState.status}`;
      cap.textContent =
        nodeState.status === 'active'
          ? `${L.nodeLabels[nodeState.node.kind]} (${nodeState.completedSteps}/${nodeState.totalSteps})`
          : L.nodeLabels[nodeState.node.kind];
      row.appendChild(cap);

      // Compact inline chest badge next to Node 3 (index 2)
      if (i === 2) {
        const chestBadge = document.createElement('div');
        chestBadge.className = `duo-inline-chest ${
          up.chestClaimed ? 'claimed' : up.chestUnlocked ? 'unlocked' : 'locked'
        }`;
        chestBadge.innerHTML = `${getNodeIconSvg('chest', up.chestClaimed)} <span>${
          up.chestClaimed ? L.chestOpened : L.chestLabel
        }</span>`;
        row.appendChild(chestBadge);
      }

      nodesTrack.appendChild(row);
    }

    sec.appendChild(nodesTrack);
    return sec;
  }

  private openGuidebookModal(unit: CurriculumUnit): void {
    const { isTr, L } = getRoadmapLabels(this.uiLanguage);
    const unitCards = getCardsForUnit(unit.id, this.allCards);
    void saveOpenGuidebookUnitId(unit.id);

    const existing = this.container.querySelector('.duo-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'duo-modal-overlay';

    const onEsc = (e: KeyboardEvent): void => {
      if (!overlay.isConnected) {
        document.removeEventListener('keydown', onEsc);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    };
    const closeModal = (): void => {
      document.removeEventListener('keydown', onEsc);
      overlay.remove();
      void saveOpenGuidebookUnitId(null);
    };
    document.addEventListener('keydown', onEsc);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    const modal = document.createElement('div');
    modal.className = 'duo-guide-modal';

    const top = document.createElement('div');
    top.className = 'duo-guide-top';

    const title = document.createElement('h3');
    title.textContent = `${L.unitPrefix(unit.unitNumber)}: ${
      isTr ? unit.titleTr : unit.titleEn
    } · ${L.guidebookBtn}`;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'duo-modal-close';
    closeBtn.textContent = `✕ ${L.closeBtn}`;
    closeBtn.addEventListener('click', closeModal);

    top.append(title, closeBtn);

    const body = document.createElement('div');
    body.className = 'duo-guide-body';

    const tipBox = document.createElement('div');
    tipBox.className = 'duo-guide-tip-box';
    const tipHead = document.createElement('h4');
    tipHead.textContent = `${L.guideTipHeader} — ${
      isTr ? unit.guidebook.tipTitleTr : unit.guidebook.tipTitleEn
    }`;
    const tipText = document.createElement('p');
    tipText.textContent = isTr ? unit.guidebook.tipBodyTr : unit.guidebook.tipBodyEn;
    tipBox.append(tipHead, tipText);
    body.appendChild(tipBox);

    const phrasesHead = document.createElement('h4');
    phrasesHead.className = 'duo-guide-sec-title';
    phrasesHead.textContent = L.guidePhrasesHeader;
    body.appendChild(phrasesHead);

    for (const kp of unit.guidebook.keyPhrases) {
      const pRow = document.createElement('div');
      pRow.className = 'duo-guide-phrase-card';

      const spk = document.createElement('button');
      spk.type = 'button';
      spk.className = 'duo-audio-mini-btn';
      spk.textContent = '🔊';
      spk.addEventListener('click', () => speakEnglish(kp.en, 1.0));

      const txt = document.createElement('div');
      txt.innerHTML = `
        <div class="duo-kp-en" data-word-lang="en">${kp.en}</div>
        <div class="duo-kp-tr" data-word-lang="tr">${kp.tr}</div>
        <div class="duo-kp-note">${isTr ? kp.noteTr : kp.noteEn}</div>
      `;
      pRow.append(spk, txt);
      body.appendChild(pRow);
    }

    const wordsHead = document.createElement('h4');
    wordsHead.className = 'duo-guide-sec-title';
    wordsHead.textContent = `${L.guideWordsHeader} (${unitCards.length})`;
    body.appendChild(wordsHead);

    const wordGrid = document.createElement('div');
    wordGrid.className = 'duo-guide-word-list';

    for (const card of unitCards.slice(0, 45)) {
      const item = document.createElement('div');
      item.className = 'duo-guide-word-item';

      const spk = document.createElement('button');
      spk.type = 'button';
      spk.className = 'duo-audio-mini-btn';
      spk.textContent = '🔊';
      spk.addEventListener('click', () => speakEnglish(card.en, 1.0));

      const content = document.createElement('div');
      content.className = 'duo-guide-word-text';
      const enLine = document.createElement('div');
      enLine.className = 'duo-gw-en';
      enLine.dataset.wordLang = 'en';
      enLine.textContent = `${card.en} ${card.phonetic ? `(${card.phonetic})` : ''}`;

      const trLine = document.createElement('div');
      trLine.className = 'duo-gw-tr';
      trLine.dataset.wordLang = 'tr';
      trLine.textContent =
        card.type === 'sentence'
          ? (card.acceptedTr[0] ?? '')
          : card.acceptedTr.slice(0, 3).join(', ');
      content.append(enLine, trLine);

      const prog = this.progressMap[card.id];
      const badge = document.createElement('span');
      badge.className = `duo-gw-badge ${prog && prog.streak >= 2 ? 'mastered' : ''}`;
      badge.textContent = prog && prog.streak >= 2 ? '✓' : card.level;

      item.append(spk, content, badge);
      wordGrid.appendChild(item);
    }

    body.appendChild(wordGrid);
    modal.append(top, body);
    overlay.appendChild(modal);
    this.container.appendChild(overlay);
  }

  public startLessonSession(
    unit: CurriculumUnit,
    nodeIndex: number | 'jump_test',
    stepIndex: number = 0,
    resumedSession?: RoadmapActiveSession
  ): void {
    const { isTr, L } = getRoadmapLabels(this.uiLanguage);
    setCrimsonThemeActive(false);
    void clearActiveRemedialSession();
    void saveOpenGuidebookUnitId(null);
    void saveRoadmapUiMode('path');

    const queue: LessonExercise[] = resumedSession
      ? resumedSession.queue.map((item) => ({ ...item }))
      : buildUnitLessonExercises(
          unit.id,
          nodeIndex,
          this.allCards,
          this.progressMap,
          Date.now(),
          stepIndex
        );

    let currentIdx = resumedSession ? Math.max(0, resumedSession.currentIdx) : 0;
    let firstTryCorrectCount = resumedSession ? resumedSession.firstTryCorrectCount : 0;
    const totalInitial = resumedSession ? resumedSession.totalInitial : queue.length;
    let neutralBypassedCount = Math.max(0, resumedSession?.neutralBypassedCount ?? 0);
    let combo = resumedSession ? resumedSession.combo : 0;
    let maxCombo = resumedSession ? resumedSession.maxCombo : 0;
    const mistakesMap: Record<string, RoadmapMistakeItem> = resumedSession
      ? { ...(resumedSession.mistakesMap ?? {}) }
      : {};
    const strongWordsSet = new Set<string>(resumedSession?.strongWords ?? []);
    const byKindStats: RoadmapKindStatMap = resumedSession
      ? { ...(resumedSession.byKindStats ?? {}) }
      : {};

    let currentDraft: ExerciseDraftState = {};
    let currentCheckedState: CheckedFeedbackSnapshot | undefined;
    let currentTutorOpen = false;
    let currentTutorHistory: AiTutorChatTurn[] = [];
    let currentTutorDraft = '';
    let activeQuestionVoiceCard: QuestionVoiceCardController | null = null;

    const disposeRoadmapVoiceCard = (): void => {
      if (activeQuestionVoiceCard) {
        activeQuestionVoiceCard.dispose();
        activeQuestionVoiceCard = null;
      }
    };

    const persistActiveSession = (
      idxToSave: number = currentIdx,
      readyToFinish: boolean = false
    ): void => {
      void saveActiveRoadmapSession({
        version: ACTIVE_ROADMAP_SESSION_VERSION,
        unitId: unit.id,
        nodeIndex,
        stepIndex,
        queue,
        currentIdx: idxToSave,
        firstTryCorrectCount,
        totalInitial,
        neutralBypassedCount,
        combo,
        maxCombo,
        mistakesMap,
        strongWords: [...strongWordsSet],
        byKindStats,
        readyToFinish,
        draft: { ...currentDraft },
        checkedState: currentCheckedState ? { ...currentCheckedState } : undefined,
        tutorOpen: currentTutorOpen,
        tutorHistory: [...currentTutorHistory],
        tutorDraft: currentTutorDraft || undefined,
        updatedAt: Date.now(),
      });
    };

    if (!resumedSession) {
      persistActiveSession(0, false);
      if (this.state && this.state.activeUnitId !== unit.id && typeof nodeIndex === 'number') {
        void saveRoadmapState({ activeUnitId: unit.id }).then((nextState) => {
          this.state = nextState;
        });
      }
    }

    this.container.replaceChildren();
    const sessionEl = document.createElement('div');
    sessionEl.className = 'duo-lesson-session';
    this.container.appendChild(sessionEl);

    const renderCurrentExercise = (restored?: {
      draft?: ExerciseDraftState;
      checkedState?: CheckedFeedbackSnapshot;
      tutorOpen?: boolean;
      tutorHistory?: AiTutorChatTurn[];
      tutorDraft?: string;
    }): void => {
      disposeRoadmapVoiceCard();
      if (currentIdx >= queue.length) {
        cancelEnglishSpeech();
        stopActiveRuleAudio();
        persistActiveSession(currentIdx, true);
        void finishLesson();
        return;
      }
      cancelEnglishSpeech();
      stopActiveRuleAudio();

      currentDraft = restored?.draft ? { ...restored.draft } : {};
      currentCheckedState = restored?.checkedState ? { ...restored.checkedState } : undefined;
      currentTutorOpen = Boolean(restored?.tutorOpen);
      currentTutorHistory = restored?.tutorHistory ? [...restored.tutorHistory] : [];
      currentTutorDraft = restored?.tutorDraft ?? '';
      persistActiveSession(currentIdx, false);

      const ex = queue[currentIdx]!;
      sessionEl.replaceChildren();

      const topBar = document.createElement('div');
      topBar.className = 'duo-lesson-topbar';

      const exitBtn = document.createElement('button');
      exitBtn.type = 'button';
      exitBtn.className = 'duo-lesson-exit';
      exitBtn.textContent = '✕';
      exitBtn.title = L.closeBtn;
      exitBtn.addEventListener('click', () => {
        disposeRoadmapVoiceCard();
        cancelEnglishSpeech();
        stopActiveRuleAudio();
        void (async () => {
          await clearActiveRoadmapSession();
          await this.refresh({ skipAutoResume: true });
        })();
      });

      const counterEl = document.createElement('span');
      counterEl.className = 'duo-q-counter-pill';
      const refreshLessonCounter = (checked: boolean): void => {
        const counter = formatLessonProgressCounter(currentIdx, queue.length, checked, isTr);
        counterEl.textContent = counter.indexText;
      };
      refreshLessonCounter(Boolean(currentCheckedState));

      const comboBadge = document.createElement('span');
      comboBadge.className = `duo-combo-pill ${combo >= 2 ? 'visible' : ''}`;
      comboBadge.textContent = combo >= 2 ? L.comboFmt(combo) : '';
      comboBadge.hidden = combo < 2;

      const correctDisplay =
        ex.correctChoice ??
        (ex.targetTokens ? ex.targetTokens.join(' ') : ex.expectedAnswers[0] ?? '');

      const openExerciseTutor = (): void => {
        currentTutorOpen = true;
        persistActiveSession(currentIdx, false);
        const isCheckedNow = Boolean(currentCheckedState);
        const expected = correctDisplay || ex.card.en;
        openAiTutorDrawer({
          host: sessionEl,
          card: ex.card,
          uiLanguage: this.uiLanguage,
          aiActive: this.aiActive,
          history: currentTutorHistory,
          draftQuestion: currentTutorDraft,
          onHistoryChanged: (nextHist) => {
            currentTutorHistory = [...nextHist];
            persistActiveSession(currentIdx, false);
          },
          onDraftChanged: (nextDraft) => {
            currentTutorDraft = nextDraft;
            persistActiveSession(currentIdx, false);
          },
          onClosed: () => {
            currentTutorOpen = false;
            persistActiveSession(currentIdx, false);
          },
          context: {
            sentenceEn: isCheckedNow
              ? ex.audioText || ex.card.en || expected
              : ex.direction === 'tr-to-en'
                ? ex.promptText
                : ex.audioText || ex.promptText || ex.card.en,
            meaningTr:
              ex.postAnswerSubtext ||
              (ex.direction === 'tr-to-en' ? ex.promptText : ex.card.acceptedTr[0]),
            promptText: ex.promptText,
            expectedAnswer: isCheckedNow ? expected : undefined,
            userAnswer: isCheckedNow ? currentCheckedState?.userAnswer : undefined,
            exerciseKind: ex.kind,
            existingExplanation: isCheckedNow ? currentCheckedState?.explanationNote : undefined,
          },
        });
      };

      const sentenceCandidate =
        ex.audioText && ex.audioText.trim().split(/\s+/).length >= 3
          ? ex.audioText
          : ex.card.type === 'sentence'
            ? ex.card.en
            : ex.card.exampleEn && ex.kind !== 'select_meaning' && ex.kind !== 'select_en'
              ? ex.card.exampleEn
              : ex.card.en || ex.expectedAnswers[0] || ex.promptText;
      const isSentencePrompt = sentenceCandidate.trim().split(/\s+/).length >= 3;
      const detectedHelpSkills = detectHelpSkillsForQuestion({
        englishText: sentenceCandidate,
        cardType: isSentencePrompt ? 'sentence' : ex.card.type,
        exerciseKind: ex.kind,
      });
      const shouldGlowTeach = hasRichTeachMeSkills(detectedHelpSkills);

      const openExerciseTeachMe = async (): Promise<void> => {
        const isCheckedNow = Boolean(currentCheckedState);
        const useAi = await isAiApiConfigured();
        openTeachMeDrawer({
          host: sessionEl,
          detectedSkills: detectedHelpSkills,
          uiLanguage: this.uiLanguage,
          crimson: false,
          initialAiMode: useAi,
          sentenceEn: sentenceCandidate,
          meaningTr: ex.card.acceptedTr.join(', '),
          sentenceHint: isCheckedNow
            ? sentenceCandidate
            : ex.direction === 'tr-to-en' || ex.kind === 'cloze_blank' || ex.kind === 'audio_dictation'
              ? ex.promptText
              : ex.card.en,
        });
      };

      const teachTopBtn = document.createElement('button');
      teachTopBtn.type = 'button';
      teachTopBtn.className = `duo-teach-btn${shouldGlowTeach ? ' is-glow' : ''}`;
      teachTopBtn.textContent = isTr ? '🎧 Öğret' : '🎧 Teach';
      teachTopBtn.title = isTr
        ? 'Bu sorudaki kuralları sesli ve yazılı dinle (API bağlıysa canlı AI + EMA)'
        : 'Listen & read rules in this question';
      teachTopBtn.addEventListener('click', () => void openExerciseTeachMe());

      const askTopBtn = document.createElement('button');
      askTopBtn.type = 'button';
      askTopBtn.className = 'duo-ask-ai-btn';
      askTopBtn.textContent = isTr ? '💬 AI’a Sor' : '💬 Ask AI';
      askTopBtn.title = isTr
        ? 'Bu soru hakkında yapay zekâya istediğini sor (örn. neden bu kelime kullanıldı?)'
        : 'Ask the AI tutor any question about this exercise';
      askTopBtn.addEventListener('click', openExerciseTutor);

      const topActions = document.createElement('div');
      topActions.className = 'duo-topbar-actions';
      topActions.append(teachTopBtn, askTopBtn);
      if (combo >= 2) {
        topActions.appendChild(comboBadge);
      }
      topBar.append(exitBtn, counterEl, topActions);
      sessionEl.appendChild(topBar);

      const stage = document.createElement('div');
      stage.className = 'duo-lesson-stage';

      if (ex.isRetryRequeue) {
        const b = document.createElement('span');
        b.className = 'duo-ex-badge retry';
        b.textContent = L.retryBadge;
        stage.appendChild(b);
      } else if (ex.isNewWord) {
        const b = document.createElement('span');
        b.className = 'duo-ex-badge new-word';
        b.textContent = L.newWordBadge;
        stage.appendChild(b);
      }

      const instr = document.createElement('div');
      instr.className = 'duo-ex-instruction';
      instr.textContent =
        ex.kind === 'select_meaning'
          ? L.instrSelectMeaning
          : ex.kind === 'select_en'
            ? L.instrSelectEn
            : ex.kind === 'cloze_blank'
              ? L.instrCloze
              : ex.kind === 'word_bank'
                ? ex.direction === 'en-to-tr'
                  ? L.instrWordBankTr
                  : L.instrWordBank
                : ex.kind === 'audio_dictation'
                  ? L.instrAudio
                  : ex.direction === 'tr-to-en'
                    ? L.instrFreeEn
                    : L.instrFree;
      stage.appendChild(instr);

      let autoPlayTimer: ReturnType<typeof setTimeout> | null = null;
      const cancelAutoPlay = (): void => {
        if (autoPlayTimer) {
          clearTimeout(autoPlayTimer);
          autoPlayTimer = null;
        }
      };

      const promptCard = document.createElement('div');
      promptCard.className = 'duo-ex-prompt-card';
      let disableAudioBypassBtn: (() => void) | null = null;
      let triggerAudioBypass: (() => void) | null = null;

      if (ex.kind === 'audio_dictation') {
        const audioRow = document.createElement('div');
        audioRow.className = 'duo-audio-hero-row';

        const playNormal = document.createElement('button');
        playNormal.type = 'button';
        playNormal.className = 'duo-audio-big-btn';
        playNormal.innerHTML = '🔊 <span>1.0x</span>';
        playNormal.addEventListener('click', () => {
          cancelAutoPlay();
          speakEnglish(ex.audioText, 1.0);
        });

        const playSlow = document.createElement('button');
        playSlow.type = 'button';
        playSlow.className = 'duo-audio-slow-btn';
        playSlow.innerHTML = '<span>0.75x</span>';
        playSlow.addEventListener('click', () => {
          cancelAutoPlay();
          speakEnglish(ex.audioText, 0.72);
        });

        audioRow.append(playNormal, playSlow);

        const bypassRow = document.createElement('div');
        bypassRow.className = 'duo-audio-bypass-row';
        const cantListenBtn = document.createElement('button');
        cantListenBtn.type = 'button';
        cantListenBtn.className = 'duo-audio-cant-listen-btn';
        cantListenBtn.textContent = L.cantListenBtn;
        cantListenBtn.disabled = Boolean(currentCheckedState);
        cantListenBtn.addEventListener('click', () => {
          triggerAudioBypass?.();
        });
        disableAudioBypassBtn = () => {
          cantListenBtn.disabled = true;
        };
        bypassRow.appendChild(cantListenBtn);

        promptCard.append(audioRow, bypassRow);
        // Settle 220ms after popup/stage render so Chrome's cloud TTS stream does not clip opening words
        if (!currentCheckedState) {
          autoPlayTimer = setTimeout(() => {
            autoPlayTimer = null;
            if (promptCard.isConnected) {
              speakEnglish(ex.audioText, 1.0);
            }
          }, 220);
        }
      } else {
        const promptMain = document.createElement('div');
        promptMain.className = 'duo-ex-prompt-main';

        // Never read or expose English audio before checking when asking TR->EN or cloze blanks
        const allowQuestionAudio =
          ex.direction === 'en-to-tr' && ex.kind !== 'cloze_blank';
        if (allowQuestionAudio) {
          const spk = document.createElement('button');
          spk.type = 'button';
          spk.className = 'duo-audio-mini-btn';
          spk.textContent = '🔊';
          spk.addEventListener('click', () => {
            cancelAutoPlay();
            speakEnglish(ex.audioText, 1.0);
          });
          promptMain.appendChild(spk);
        }

        const pText = document.createElement('div');
        pText.className = 'duo-ex-prompt-text';
        pText.dataset.wordLang = ex.direction === 'tr-to-en' ? 'tr' : 'en';
        pText.textContent = ex.promptText;

        promptMain.appendChild(pText);
        promptCard.appendChild(promptMain);

        if (ex.promptSubtext) {
          const pSub = document.createElement('div');
          pSub.className = `duo-ex-prompt-sub${ex.kind === 'cloze_blank' ? ' is-meaning-cue' : ''}`;
          pSub.dataset.wordLang = 'tr';
          if (!allowQuestionAudio) {
            pSub.style.paddingLeft = '0';
          }
          pSub.textContent = ex.promptSubtext;
          promptCard.appendChild(pSub);
        }

        if (allowQuestionAudio && !currentCheckedState) {
          autoPlayTimer = setTimeout(() => {
            autoPlayTimer = null;
            if (promptCard.isConnected) {
              speakEnglish(ex.audioText, 1.0);
            }
          }, 220);
        }
      }

      stage.appendChild(promptCard);

      let getUserResponse: () => string = () => '';
      let canSubmit: () => boolean = () => false;
      let lockControls: () => void = () => {};

      const footerBar = document.createElement('div');
      footerBar.className = 'duo-lesson-footer';

      const skipBtn = document.createElement('button');
      skipBtn.type = 'button';
      skipBtn.className = 'duo-btn-secondary';
      skipBtn.textContent = L.skipBtn;

      const checkBtn = document.createElement('button');
      checkBtn.type = 'button';
      checkBtn.className = 'duo-btn-check';
      checkBtn.textContent = L.checkBtn;
      checkBtn.disabled = true;

      const refreshCheckDisabled = (): void => {
        checkBtn.disabled = !canSubmit();
      };

      if (
        ex.kind === 'select_meaning' ||
        ex.kind === 'select_en' ||
        ex.kind === 'cloze_blank'
      ) {
        let selectedOption = currentDraft.selectedChoice ?? '';
        const choicesGrid = document.createElement('div');
        choicesGrid.className = 'duo-choices-grid';

        const choicesAreEnglish =
          ex.kind === 'select_en' || ex.kind === 'cloze_blank' || ex.direction === 'tr-to-en';
        const optionBtns: HTMLButtonElement[] = [];
        for (let i = 0; i < (ex.choices ?? []).length; i += 1) {
          const choiceText = ex.choices![i]!;
          const cBtn = document.createElement('button');
          cBtn.type = 'button';
          cBtn.dataset.choiceVal = choiceText;
          cBtn.dataset.wordLang = choicesAreEnglish ? 'en' : 'tr';
          cBtn.className = `duo-choice-card ${selectedOption === choiceText ? 'selected' : ''}`;
          cBtn.innerHTML = `<span class="duo-choice-key">${i + 1}</span> <span class="duo-choice-label">${choiceText}</span>`;
          cBtn.addEventListener('click', () => {
            selectedOption = choiceText;
            currentDraft.selectedChoice = choiceText;
            for (const b of optionBtns) b.classList.remove('selected');
            cBtn.classList.add('selected');
            if (choicesAreEnglish) {
              cancelAutoPlay();
              const isShortChoice = choiceText.trim().split(/\s+/).length <= 3;
              speakEnglish(choiceText, 1.0, { isQuickTile: isShortChoice });
            }
            refreshCheckDisabled();
            persistActiveSession(currentIdx, false);
          });
          optionBtns.push(cBtn);
          choicesGrid.appendChild(cBtn);
        }

        getUserResponse = () => selectedOption;
        canSubmit = () => selectedOption.trim().length > 0;
        lockControls = () => {
          for (const b of optionBtns) b.disabled = true;
        };
        stage.appendChild(choicesGrid);
      } else if (ex.kind === 'word_bank' || ex.kind === 'audio_dictation') {
        const tiles = ex.wordBankTiles ?? [];
        const usedIndices: number[] = [];
        if (Array.isArray(currentDraft.placedTileIndices)) {
          const seen = new Set<number>();
          for (const idx of currentDraft.placedTileIndices) {
            if (typeof idx === 'number' && idx >= 0 && idx < tiles.length && !seen.has(idx)) {
              seen.add(idx);
              usedIndices.push(idx);
            }
          }
        }
        let wbLocked = false;

        const answerTray = document.createElement('div');
        answerTray.className = 'duo-wb-answer-tray';
        answerTray.dataset.placeholder = isTr
          ? 'Kelimeleri seçerek veya sürükleyerek cümleyi buraya kur…'
          : 'Click or drag words here to build the sentence…';

        const bankTray = document.createElement('div');
        bankTray.className = 'duo-wb-bank-tray';

        const commitUsedIndicesChange = (): void => {
          currentDraft.placedTileIndices = [...usedIndices];
          renderWordBankState();
          refreshCheckDisabled();
          persistActiveSession(currentIdx, false);
        };

        const renderWordBankState = (): void => {
          answerTray.replaceChildren();
          bankTray.replaceChildren();

          for (let pos = 0; pos < usedIndices.length; pos += 1) {
            const tileIdx = usedIndices[pos]!;
            const word = tiles[tileIdx]!;
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'duo-wb-tile placed';
            chip.dataset.wordLang = ex.direction === 'en-to-tr' ? 'tr' : 'en';
            chip.disabled = wbLocked;
            chip.setAttribute(
              'aria-label',
              isTr
                ? `${word} — geri koymak için tıkla veya sürükleyip yerini değiştir`
                : `${word} — click to put back or drag to reorder`
            );
            chip.textContent = word;
            attachWordBankTileGesture({
              chip,
              word,
              source: 'answer',
              answerTray,
              bankTray,
              isLocked: () => wbLocked,
              onTap: () => {
                usedIndices.splice(pos, 1);
                commitUsedIndicesChange();
              },
              onDropIntoAnswer: (insertIndex) => {
                const [moved] = usedIndices.splice(pos, 1);
                if (typeof moved === 'number') {
                  const clamped = Math.max(0, Math.min(usedIndices.length, insertIndex));
                  usedIndices.splice(clamped, 0, moved);
                  commitUsedIndicesChange();
                }
              },
              onDropBackToBank: () => {
                usedIndices.splice(pos, 1);
                commitUsedIndicesChange();
              },
            });
            answerTray.appendChild(chip);
          }

          for (let idx = 0; idx < tiles.length; idx += 1) {
            const word = tiles[idx]!;
            const usedPos = usedIndices.indexOf(idx);
            const isUsed = usedPos !== -1;
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = `duo-wb-tile ${isUsed ? 'ghost' : ''}`;
            chip.disabled = wbLocked;
            chip.setAttribute('aria-pressed', isUsed ? 'true' : 'false');

            if (isUsed) {
              const hiddenSpan = document.createElement('span');
              hiddenSpan.className = 'duo-wb-ghost-label';
              hiddenSpan.style.visibility = 'hidden';
              hiddenSpan.textContent = word;
              chip.appendChild(hiddenSpan);
              chip.title = isTr ? 'Geri almak için tıkla' : 'Click to restore';
              chip.addEventListener('click', () => {
                if (wbLocked) return;
                usedIndices.splice(usedPos, 1);
                commitUsedIndicesChange();
              });
            } else {
              chip.textContent = word;
              chip.dataset.wordLang = ex.direction === 'en-to-tr' ? 'tr' : 'en';
              chip.setAttribute(
                'aria-label',
                isTr
                  ? `${word} — eklemek için tıkla veya istediğin aralığa sürükle`
                  : `${word} — click to add or drag into any position`
              );
              attachWordBankTileGesture({
                chip,
                word,
                source: 'bank',
                answerTray,
                bankTray,
                isLocked: () => wbLocked,
                onTap: () => {
                  usedIndices.push(idx);
                  if (ex.direction !== 'en-to-tr') {
                    speakEnglish(word, 1.0, { isQuickTile: true });
                  }
                  commitUsedIndicesChange();
                },
                onDropIntoAnswer: (insertIndex) => {
                  const clamped = Math.max(0, Math.min(usedIndices.length, insertIndex));
                  usedIndices.splice(clamped, 0, idx);
                  if (ex.direction !== 'en-to-tr') {
                    speakEnglish(word, 1.0, { isQuickTile: true });
                  }
                  commitUsedIndicesChange();
                },
              });
            }
            bankTray.appendChild(chip);
          }
        };

        renderWordBankState();
        getUserResponse = () => usedIndices.map((i) => tiles[i]!).join(' ');
        canSubmit = () => usedIndices.length > 0;
        lockControls = () => {
          wbLocked = true;
          renderWordBankState();
        };
        stage.append(answerTray, bankTray);
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'duo-free-input';
        input.placeholder =
          ex.direction === 'tr-to-en' ? L.typeEnglishPlaceholder : L.typeAnswerPlaceholder;
        if (currentDraft.typedText) {
          input.value = currentDraft.typedText;
        }
        input.addEventListener('input', () => {
          currentDraft.typedText = input.value;
          refreshCheckDisabled();
          persistActiveSession(currentIdx, false);
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && canSubmit()) {
            e.preventDefault();
            void evaluateCurrent(false);
          }
        });
        getUserResponse = () => input.value.trim();
        canSubmit = () => input.value.trim().length > 0;
        lockControls = () => {
          input.disabled = true;
        };
        stage.appendChild(input);
        if (!currentCheckedState && !currentTutorOpen) {
          setTimeout(() => input.focus(), 40);
        }
      }

      // If this Roadmap sentence matches one of our 92 bundled ElevenLabs question narrations,
      // offer the same iridescent AI soundwave button below the question (manual click-only, never auto-played).
      const matchedQuestionAudio = isSentencePrompt
        ? findRemedialQuestionAudioForSentence(sentenceCandidate)
        : null;
      if (matchedQuestionAudio) {
        activeQuestionVoiceCard = createQuestionVoiceCard({
          questionAudioId: matchedQuestionAudio.questionAudioId,
          scriptTr: matchedQuestionAudio.questionVoiceScriptTr,
          isTr,
        });
        stage.appendChild(activeQuestionVoiceCard.element);
      }

      sessionEl.appendChild(stage);
      refreshCheckDisabled();

      const mistakeKey = `${ex.card.id}::${ex.kind}`;
      let evaluated = false;

      const renderCheckedFooter = (snap: CheckedFeedbackSnapshot): void => {
        evaluated = true;
        lockControls();
        disableAudioBypassBtn?.();
        skipBtn.disabled = true;
        checkBtn.disabled = true;
        refreshLessonCounter(true);

        const isAudioBypass = Boolean(snap.audioBypassed);
        const effectiveCorrect = !isAudioBypass && (snap.isCorrect || Boolean(snap.overridden));
        const expectedChoiceNorm = (ex.correctChoice ?? '').trim().toLowerCase();
        const chosenNorm = (snap.userAnswer ?? '').trim().toLowerCase();
        if (!isAudioBypass) {
          for (const btn of stage.querySelectorAll<HTMLButtonElement>('.duo-choice-card')) {
            btn.classList.remove('is-result-correct', 'is-result-wrong');
            const valNorm = (btn.dataset.choiceVal ?? '').trim().toLowerCase();
            if (!valNorm) continue;
            if (expectedChoiceNorm && valNorm === expectedChoiceNorm) {
              btn.classList.add('is-result-correct');
            } else if (!effectiveCorrect && chosenNorm && valNorm === chosenNorm) {
              btn.classList.add('is-result-wrong');
            }
          }
        }
        footerBar.className = `duo-lesson-footer ${
          isAudioBypass ? 'is-neutral' : effectiveCorrect ? 'is-correct' : 'is-wrong'
        }`;
        footerBar.replaceChildren();

        const fbText = document.createElement('div');
        fbText.className = 'duo-fb-text';

        const titleRow = document.createElement('div');
        titleRow.className = 'duo-fb-badges';
        const titleEl = document.createElement('span');
        titleEl.className = 'duo-fb-title';
        titleEl.textContent = isAudioBypass
          ? L.audioBypassTitle
          : snap.overridden
            ? L.overrideAcceptedTitle
            : effectiveCorrect
              ? `✓ ${L.correctHeader}`
              : `✕ ${L.wrongHeader}`;
        titleRow.appendChild(titleEl);

        if (snap.aiApproved) {
          const tag = document.createElement('span');
          tag.className = 'duo-fb-ai-tag';
          tag.textContent = snap.aiProviderBadge
            ? `${L.aiApprovedTag} · ${snap.aiProviderBadge}`
            : L.aiApprovedTag;
          titleRow.appendChild(tag);
        }
        fbText.appendChild(titleRow);

        let solRow: HTMLDivElement | null = null;
        if (!effectiveCorrect) {
          solRow = document.createElement('div');
          solRow.className = 'duo-fb-solution';
          solRow.append(
            document.createTextNode(
              `${isAudioBypass ? L.audioBypassSolutionLabel : L.correctAnswerLabel} `
            )
          );
          const strongAns = document.createElement('strong');
          strongAns.dataset.wordLang = ex.direction === 'en-to-tr' ? 'tr' : 'en';
          strongAns.textContent = correctDisplay;
          solRow.appendChild(strongAns);
          fbText.appendChild(solRow);
        }

        if (ex.postAnswerSubtext) {
          const revealEl = document.createElement('div');
          revealEl.className = 'duo-fb-note';
          revealEl.textContent = isTr
            ? `Anlamı: ${ex.postAnswerSubtext}`
            : `Meaning: ${ex.postAnswerSubtext}`;
          fbText.appendChild(revealEl);
        }

        if (isAudioBypass) {
          const bypassNoteEl = document.createElement('div');
          bypassNoteEl.className = 'duo-fb-note';
          bypassNoteEl.textContent = L.audioBypassNote;
          fbText.appendChild(bypassNoteEl);
        } else if (snap.explanationNote) {
          const noteEl = document.createElement('div');
          noteEl.className = 'duo-fb-note';
          noteEl.textContent = snap.explanationNote;
          fbText.appendChild(noteEl);
        }

        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'duo-fb-actions';

        if (ex.audioText && (ex.direction === 'tr-to-en' || ex.kind === 'cloze_blank' || isAudioBypass)) {
          const replaySpk = document.createElement('button');
          replaySpk.type = 'button';
          replaySpk.className = 'duo-audio-mini-btn';
          replaySpk.textContent = '🔊';
          replaySpk.title = isTr ? 'İngilizce telaffuzu dinle' : 'Listen to pronunciation';
          replaySpk.addEventListener('click', () => speakEnglish(ex.audioText, 1.0));
          actionsWrap.appendChild(replaySpk);
        }

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = `duo-btn-continue ${isAudioBypass ? 'neutral' : effectiveCorrect ? 'ok' : 'err'}`;
        nextBtn.textContent = L.continueBtn;
        nextBtn.addEventListener('click', () => {
          currentIdx += 1;
          currentDraft = {};
          currentCheckedState = undefined;
          currentTutorOpen = false;
          currentTutorHistory = [];
          currentTutorDraft = '';
          if (currentIdx >= queue.length) {
            persistActiveSession(currentIdx, true);
            void finishLesson();
          } else {
            renderCurrentExercise();
          }
        });
        actionsWrap.appendChild(nextBtn);

        footerBar.append(fbText, actionsWrap);
        if (!currentTutorOpen) {
          nextBtn.focus();
        }
      };

      const evaluateCurrent = async (skipped: boolean): Promise<void> => {
        if (evaluated) return;
        evaluated = true;
        const userAns = skipped ? '' : getUserResponse();

        lockControls();
        disableAudioBypassBtn?.();
        skipBtn.disabled = true;
        checkBtn.disabled = true;

        let isCorrect = false;
        let explanationNote = '';
        let aiApproved = false;
        let aiProviderBadge = '';

        if (!skipped) {
          if (
            ex.kind === 'select_meaning' ||
            ex.kind === 'select_en' ||
            ex.kind === 'cloze_blank'
          ) {
            isCorrect =
              userAns.trim().toLowerCase() === (ex.correctChoice ?? '').trim().toLowerCase();
            if (!ex.isRetryRequeue) {
              void chrome.runtime
                .sendMessage({
                  type: isCorrect ? 'SUBMIT_ANSWER' : 'MARK_DONT_KNOW',
                  cardId: ex.card.id,
                  userAnswer: isCorrect ? (ex.card.acceptedTr[0] ?? ex.card.en) : userAns,
                  card: ex.card,
                  source: 'roadmap',
                } satisfies ExtensionMessage)
                .catch(() => {});
            }
          } else {
            const expectedJoined = (ex.targetTokens ?? []).join(' ') || ex.expectedAnswers[0] || '';
            const evalCardType = ex.kind === 'word_bank' ? 'sentence' : ex.card.type;
            let localCorrect = false;
            let localScore = 0;
            let needsAiCheck = false;

            if (ex.kind === 'audio_dictation') {
              const dictEval = evaluateDictationAnswer(expectedJoined, userAns);
              localCorrect = dictEval.isCorrect;
              localScore = dictEval.accuracyPercent;
              needsAiCheck = !localCorrect && localScore >= 65;
            } else if (ex.direction === 'en-to-tr') {
              const trCandidates = Array.from(
                new Set([...ex.expectedAnswers, ...ex.card.acceptedTr].filter(Boolean))
              );
              const localTr = evaluateTurkishAnswer(userAns, trCandidates, evalCardType);
              const dictMatch =
                ex.kind === 'word_bank' && evaluateDictationAnswer(expectedJoined, userAns).isCorrect;
              localCorrect = dictMatch || localTr.isCorrect;
              localScore = Math.round((dictMatch ? 1 : localTr.similarity) * 100);
              const isStrong =
                dictMatch ||
                localTr.matchKind === 'exact' ||
                localTr.matchKind === 'normalized' ||
                (ex.kind === 'free_translation' && localTr.isCorrect && localTr.similarity >= 0.86);
              needsAiCheck = !isStrong;
            } else {
              const enCandidates = Array.from(
                new Set([
                  ...ex.expectedAnswers,
                  ex.card.en,
                  ...(ex.card.exampleEn ? [ex.card.exampleEn] : []),
                ].filter(Boolean))
              );
              const localEn = evaluateEnglishAnswer(userAns, enCandidates, evalCardType);
              const dictMatch =
                ex.kind === 'word_bank' && evaluateDictationAnswer(expectedJoined, userAns).isCorrect;
              localCorrect = dictMatch || localEn.isCorrect;
              localScore = Math.round((dictMatch ? 1 : localEn.similarity) * 100);
              const isStrong =
                dictMatch ||
                localEn.matchKind === 'exact' ||
                localEn.matchKind === 'normalized' ||
                (ex.kind === 'free_translation' && localEn.isCorrect && localEn.similarity >= 0.88);
              needsAiCheck = !isStrong;
            }

            isCorrect = localCorrect;
            const msgPayload: ExtensionMessage = {
              type: 'EVALUATE_ROADMAP_EXERCISE',
              card: ex.card,
              direction: ex.direction,
              kind: ex.kind,
              promptText: ex.promptText,
              expectedAnswers: ex.expectedAnswers,
              userAnswer: userAns,
              localCorrect,
              localScore,
              recordProgress: !ex.isRetryRequeue,
            };

            if (this.aiActive && needsAiCheck) {
              checkBtn.textContent = L.aiCheckingBtn;
              checkBtn.classList.add('is-checking');
              try {
                const res = (await chrome.runtime.sendMessage(msgPayload)) as {
                  ok: boolean;
                  result?: AnswerOutcomeResult;
                };
                if (res?.ok && res.result) {
                  const ev = res.result.evaluation;
                  isCorrect = ev.isCorrect;
                  explanationNote = ev.aiNote ?? '';
                  aiApproved = ev.isCorrect && ev.matchKind === 'ai';
                  if (ev.aiStatus === 'used' && ev.aiProviderIndex) {
                    aiProviderBadge = `AI${ev.aiProviderIndex}`;
                  }
                }
              } catch {
                // Keep local evaluation on transport failure
              }
            } else {
              void chrome.runtime.sendMessage(msgPayload).catch(() => {});
              if (!isCorrect && !this.aiActive && (ex.kind === 'free_translation' || ex.kind === 'word_bank')) {
                explanationNote = L.aiDisabledTip;
              }
            }
          }
        } else if (!ex.isRetryRequeue) {
          void chrome.runtime
            .sendMessage({
              type: 'MARK_DONT_KNOW',
              cardId: ex.card.id,
              card: ex.card,
              source: 'roadmap',
            } satisfies ExtensionMessage)
            .catch(() => {});
        }

        const prevKindStats = byKindStats[ex.kind] ?? { correct: 0, wrong: 0 };
        byKindStats[ex.kind] = {
          correct: prevKindStats.correct + (isCorrect ? 1 : 0),
          wrong: prevKindStats.wrong + (isCorrect ? 0 : 1),
        };

        const retryId = `${ex.id}_retry_${queue.length}`;
        if (isCorrect) {
          if (!ex.isRetryRequeue) {
            firstTryCorrectCount += 1;
          }
          if (ex.card.en) {
            strongWordsSet.add(ex.card.en);
          }
          combo += 1;
          if (combo > maxCombo) maxCombo = combo;
        } else {
          combo = 0;
          const prevMistake = mistakesMap[mistakeKey];
          const nextWrongCount = (prevMistake?.wrongCount ?? 0) + 1;
          mistakesMap[mistakeKey] = {
            cardId: ex.card.id,
            en: ex.card.en,
            expected:
              ex.expectedAnswers[0] ??
              ex.correctChoice ??
              ex.card.acceptedTr[0] ??
              ex.card.en,
            kind: ex.kind,
            direction: ex.direction,
            wrongCount: nextWrongCount,
            repeatedWrong: nextWrongCount >= 2 || Boolean(ex.isRetryRequeue),
            lastUserAnswer: (userAns || '').trim() || (skipped ? '(skipped)' : ''),
          };
          queue.push({
            ...ex,
            id: retryId,
            isRetryRequeue: true,
          });
        }

        const snap: CheckedFeedbackSnapshot = {
          isCorrect,
          skipped,
          userAnswer: (userAns || '').trim() || (skipped ? '(skipped)' : ''),
          explanationNote: explanationNote || undefined,
          aiApproved,
          aiProviderBadge: aiProviderBadge || undefined,
          retryId: isCorrect ? undefined : retryId,
          overridden: false,
        };
        currentCheckedState = snap;
        persistActiveSession(currentIdx, false);
        renderCheckedFooter(snap);
      };

      triggerAudioBypass = (): void => {
        if (evaluated) return;
        evaluated = true;
        cancelAutoPlay();
        cancelEnglishSpeech();
        lockControls();
        disableAudioBypassBtn?.();
        skipBtn.disabled = true;
        checkBtn.disabled = true;

        if (!ex.isRetryRequeue) {
          neutralBypassedCount += 1;
        }
        const snap: CheckedFeedbackSnapshot = {
          isCorrect: false,
          skipped: false,
          audioBypassed: true,
          userAnswer: '(audio_unavailable)',
        };
        currentCheckedState = snap;
        persistActiveSession(currentIdx, false);
        renderCheckedFooter(snap);
      };

      skipBtn.addEventListener('click', () => void evaluateCurrent(true));
      checkBtn.addEventListener('click', () => void evaluateCurrent(false));

      footerBar.append(skipBtn, checkBtn);
      sessionEl.appendChild(footerBar);

      if (currentCheckedState) {
        renderCheckedFooter(currentCheckedState);
      }
      if (currentTutorOpen) {
        openExerciseTutor();
      }
    };

    const finishLesson = async (): Promise<void> => {
      await clearActiveRoadmapSession();
      const currentState = await getRoadmapState();
      const comboBonus = maxCombo >= 4 ? 5 : 0;
      const stepRes = completeRoadmapNodeStep(
        currentState,
        unit.id,
        nodeIndex,
        comboBonus
      );
      this.state = await saveRoadmapState(stepRes.nextState);
      this.onStateUpdated?.(this.state);

      const { gradedTotal, accuracyPct } = computeRoadmapAccuracyStats(
        firstTryCorrectCount,
        totalInitial,
        neutralBypassedCount
      );
      const mistakeItems = Object.values(mistakesMap);
      const repeatedMistakeCount = mistakeItems.filter((m) => m.repeatedWrong).length;
      const lessonRecord: RoadmapLessonRecord = {
        id: `rm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        completedAt: Date.now(),
        unitId: unit.id,
        unitTitleTr: unit.titleTr,
        unitTitleEn: unit.titleEn,
        nodeIndex,
        stepIndex,
        accuracyPct,
        xpEarned: stepRes.xpEarned,
        totalQuestions: gradedTotal,
        firstTryCorrect: firstTryCorrectCount,
        repeatedMistakeCount,
        strongWords: [...strongWordsSet].slice(0, 8),
        mistakes: mistakeItems,
        byKind: byKindStats,
      };
      const updatedHistory = await appendRoadmapLessonRecord(lessonRecord);
      this.historyRecords = updatedHistory;
      const langCode = resolveSupportedLanguage(this.uiLanguage);
      const instantInsight = buildFallbackRoadmapCoachBanner(updatedHistory, langCode);
      this.coachInsight = instantInsight;
      await saveRoadmapCoachInsight(instantInsight);

      const completeHeading = stepRes.nodeJustCompleted
        ? `${L.lessonCompleteTitle} (${stepRes.completedSteps}/${stepRes.totalSteps} ✓)`
        : isTr
          ? `Adım ${stepRes.completedSteps}/${stepRes.totalSteps} Tamamlandı!`
          : `Step ${stepRes.completedSteps}/${stepRes.totalSteps} Complete!`;
      const completeSub = stepRes.nodeJustCompleted
        ? L.lessonCompleteSub
        : isTr
          ? `Bu düğümü tamamlamak için ${stepRes.totalSteps - stepRes.completedSteps} adım daha kaldı.`
          : `${stepRes.totalSteps - stepRes.completedSteps} more step(s) to complete this node.`;

      sessionEl.replaceChildren();
      const summary = document.createElement('div');
      summary.className = 'duo-lesson-complete';
      summary.innerHTML = `
        <div class="duo-complete-badge" style="font-size:${stepRes.nodeJustCompleted ? '20px' : '13px'}">${stepRes.nodeJustCompleted ? '✓' : `${stepRes.completedSteps}/${stepRes.totalSteps}`}</div>
        <h2 class="duo-complete-title">${completeHeading}</h2>
        <p class="duo-complete-sub">${completeSub}</p>
        <div class="duo-complete-metrics">
          <div class="duo-complete-stat">
            <span class="duo-cs-label">${L.xpEarnedLabel}</span>
            <span class="duo-cs-val accent">+${stepRes.xpEarned} XP</span>
          </div>
          <div class="duo-complete-stat">
            <span class="duo-cs-label">${L.accuracyLabel}</span>
            <span class="duo-cs-val ok">${accuracyPct}%</span>
          </div>
        </div>
      `;

      const coachBox = document.createElement('div');
      coachBox.className = `duo-complete-coach status-${instantInsight.status}`;
      const coachLabel = document.createElement('div');
      coachLabel.className = 'duo-complete-coach-lbl';
      coachLabel.textContent = isTr
        ? `✨ Son ${instantInsight.lessonCountAnalyzed} Ders Analizi`
        : `✨ Last ${instantInsight.lessonCountAnalyzed}-Lesson Analysis`;
      const coachBody = document.createElement('p');
      coachBody.className = 'duo-complete-coach-msg';
      coachBody.textContent = instantInsight.message;
      coachBox.append(coachLabel, coachBody);
      summary.appendChild(coachBox);

      if (this.aiActive) {
        void chrome.runtime
          .sendMessage({
            type: 'GENERATE_ROADMAP_COACH_BANNER',
            language: this.uiLanguage,
          } satisfies ExtensionMessage)
          .then((res) => {
            const payload = res as { ok?: boolean; insight?: RoadmapCoachInsight } | undefined;
            if (payload?.ok && payload.insight) {
              this.coachInsight = payload.insight;
              coachBox.className = `duo-complete-coach status-${payload.insight.status}`;
              coachLabel.textContent = isTr
                ? `✨ AI · Son ${payload.insight.lessonCountAnalyzed} Ders`
                : `✨ AI · Last ${payload.insight.lessonCountAnalyzed}`;
              coachBody.textContent = payload.insight.message;
            }
          })
          .catch(() => {});
      }

      const btnRow = document.createElement('div');
      btnRow.style.display = 'flex';
      btnRow.style.gap = '8px';
      btnRow.style.marginTop = '6px';

      if (!stepRes.nodeJustCompleted && typeof nodeIndex === 'number') {
        const nextStepBtn = document.createElement('button');
        nextStepBtn.type = 'button';
        nextStepBtn.className = 'duo-btn-continue ok';
        nextStepBtn.textContent = isTr
          ? `Adım ${stepRes.completedSteps + 1}/${stepRes.totalSteps}'e Devam Et →`
          : `Continue to Step ${stepRes.completedSteps + 1}/${stepRes.totalSteps} →`;
        nextStepBtn.addEventListener('click', async () => {
          nextStepBtn.disabled = true;
          this.progressMap = await getProgressMap();
          this.startLessonSession(unit, nodeIndex, stepRes.completedSteps);
        });
        btnRow.appendChild(nextStepBtn);
      }

      const doneBtn = document.createElement('button');
      doneBtn.type = 'button';
      doneBtn.className = stepRes.nodeJustCompleted ? 'duo-btn-check' : 'duo-btn-secondary';
      doneBtn.textContent = L.finishLessonBtn;
      doneBtn.addEventListener('click', () => {
        void this.refresh({ skipAutoResume: true });
      });
      btnRow.appendChild(doneBtn);

      summary.appendChild(btnRow);
      sessionEl.appendChild(summary);
    };

    if (resumedSession?.readyToFinish || currentIdx >= queue.length) {
      void finishLesson();
    } else {
      renderCurrentExercise(
        resumedSession
          ? {
              draft: resumedSession.draft,
              checkedState: resumedSession.checkedState,
              tutorOpen: resumedSession.tutorOpen,
              tutorHistory: resumedSession.tutorHistory,
              tutorDraft: resumedSession.tutorDraft,
            }
          : undefined
      );
    }
  }
}
