import { openAiTutorDrawer } from './aiTutorDrawer';
import { advanceConceptAfterAnswer } from './concepts';
import {
  getActiveGuideAssistantId,
  stopGuideAssistant,
} from './guideAssistant';
import { resolveSupportedLanguage } from './i18n';
import { evaluateEnglishAnswer, evaluateTurkishAnswer } from './matcher';
import { formatLessonProgressCounter } from './placementTest';
import { REMEDIAL_SKILL_CATALOG, REMEDIAL_VOICE_TRANSCRIPTS } from './remedialCatalog';
import { playCorrectSfx, playLessonCompleteSfx, playTapSfx, playWrongSfx } from './sfx';
import {
  cancelEnglishSpeech,
  DEFAULT_ENGLISH_TTS_RATE,
  speakEnglishText as speakEnglish,
} from './speech';
import {
  getRemedialSkillIconName,
  setIconLabel,
  setIconOnly,
  uiIconSvg,
} from './uiIcons';
import { attachWordBankTileGesture } from './wordBankDrag';
import {
  clearActiveRemedialSession,
  clearActiveRoadmapSession,
  getConceptState,
  getRoadmapState,
  getSkillProfile,
  recordRemedialCompletion,
  saveActiveRemedialSession,
  saveConceptState,
  saveOpenGuidebookUnitId,
  isAiApiConfigured,
  saveRoadmapState,
  saveRoadmapUiMode,
} from './storage';
import {
  createQuestionVoiceCard,
  createRuleAudioPlayer,
  mountSyncedTranscript,
  openTeachMeDrawer,
  type QuestionVoiceCardController,
  stopActiveRuleAudio,
} from './teachMeDrawer';
import {
  ACTIVE_REMEDIAL_SESSION_VERSION,
  type AiTutorChatTurn,
  type AnswerOutcomeResult,
  type Card,
  type CheckedFeedbackSnapshot,
  type DiagnosedWeakness,
  type ExerciseDraftState,
  type ExtensionMessage,
  type FeedbackLanguageMode,
  type RemedialActiveSession,
  type RemedialBriefingExample,
  type RemedialExercise,
  type RemedialLessonPlan,
  type RemedialMasteryRecord,
  type UserCardProgress,
  type WeakSkillId,
} from './types';
import {
  type AiDiagnosedOverlayItem,
  buildRemedialLessonPlan,
  detectHelpSkillsForQuestion,
  getAllRemedialCatalogItems,
  hasRichTeachMeSkills,
} from './weaknessDetector';

export interface RemedialViewContext {
  container: HTMLElement;
  uiLanguage: FeedbackLanguageMode;
  aiActive: boolean;
  allCards: Card[];
  progressMap: Record<string, UserCardProgress>;
  diagnosedWeaknesses: DiagnosedWeakness[];
  remedialProgress: Record<string, RemedialMasteryRecord>;
  onSwitchToPath: () => void;
  onRefreshDiagnosis: (aiOverlay?: AiDiagnosedOverlayItem[]) => Promise<void>;
  onXpUpdated?: () => Promise<DiagnosedWeakness[] | void>;
}

/**
 * Toggle crimson theme class on document.body so popup/options chrome reflects active mode.
 */
export function setCrimsonThemeActive(active: boolean): void {
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.toggle('remedial-crimson-active', active);
  }
}

/**
 * Shared top-level 2-tab mode switcher rendered inside both Yol Haritası and Özel Dersler views.
 */
export function createModeTabBar(params: {
  activeMode: 'path' | 'remedial';
  urgentCount: number;
  isTr: boolean;
  onSelectMode: (mode: 'path' | 'remedial') => void;
}): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'duo-mode-tabs';
  bar.setAttribute('role', 'tablist');

  const pathWrap = document.createElement('div');
  pathWrap.className = 'duo-mode-tab-wrap';

  const pathTab = document.createElement('button');
  pathTab.type = 'button';
  pathTab.role = 'tab';
  pathTab.setAttribute('aria-selected', String(params.activeMode === 'path'));
  pathTab.className = `duo-mode-tab is-path ${params.activeMode === 'path' ? 'is-active' : ''}`;
  setIconLabel(pathTab, 'map', params.isTr ? 'Yol Haritası' : 'Learning Path', 14);
  pathTab.addEventListener('click', () => {
    if (params.activeMode !== 'path') params.onSelectMode('path');
  });

  pathWrap.append(pathTab);

  const remWrap = document.createElement('div');
  remWrap.className = 'duo-mode-tab-wrap';

  const remTab = document.createElement('button');
  remTab.type = 'button';
  remTab.role = 'tab';
  remTab.setAttribute('aria-selected', String(params.activeMode === 'remedial'));
  remTab.className = `duo-mode-tab is-remedial ${params.activeMode === 'remedial' ? 'is-active' : ''}`;

  setIconLabel(remTab, 'layers', params.isTr ? 'Özel Dersler' : 'Remedial Studio', 14);

  if (params.urgentCount > 0) {
    const badge = document.createElement('span');
    badge.className = 'duo-mode-badge';
    badge.textContent = String(params.urgentCount);
    remTab.appendChild(badge);
  }

  remTab.addEventListener('click', () => {
    if (params.activeMode !== 'remedial') params.onSelectMode('remedial');
  });

  remWrap.append(remTab);

  bar.append(pathWrap, remWrap);
  return bar;
}

/** Safely append English text while wrapping the matched highlight substring in `<mark>`. */
function appendHighlightedText(parent: HTMLElement, text: string, highlight: string): void {
  const cleanHl = highlight.trim();
  if (!cleanHl || cleanHl.includes('→') || cleanHl.includes('/')) {
    parent.textContent = text;
    return;
  }
  const idx = text.toLowerCase().indexOf(cleanHl.toLowerCase());
  if (idx < 0) {
    parent.textContent = text;
    return;
  }
  if (idx > 0) {
    parent.append(document.createTextNode(text.slice(0, idx)));
  }
  const mark = document.createElement('mark');
  mark.className = 'rem-hl';
  mark.textContent = text.slice(idx, idx + cleanHl.length);
  parent.append(mark);
  if (idx + cleanHl.length < text.length) {
    parent.append(document.createTextNode(text.slice(idx + cleanHl.length)));
  }
}

function getUrgentWeaknessCount(weaknesses: DiagnosedWeakness[]): number {
  return weaknesses.filter((w) => w.severity === 'critical' || w.severity === 'focus').length;
}

/**
 * Render the Crimson "Özel Dersler" Weak-Spot Studio hub screen.
 */
export function renderRemedialHub(ctx: RemedialViewContext): void {
  const isTr = resolveSupportedLanguage(ctx.uiLanguage) === 'tr';
  setCrimsonThemeActive(true);
  ctx.container.replaceChildren();

  const root = document.createElement('div');
  root.className = 'duo-roadmap-root is-remedial-crimson';

  root.appendChild(
    createModeTabBar({
      activeMode: 'remedial',
      urgentCount: getUrgentWeaknessCount(ctx.diagnosedWeaknesses),
      isTr,
      onSelectMode: (mode) => {
        if (mode === 'path') ctx.onSwitchToPath();
      },
    })
  );

  // Crimson Hero Header
  const hero = document.createElement('div');
  hero.className = 'rem-hero';

  const heroLeft = document.createElement('div');
  heroLeft.className = 'rem-hero-left';

  const heroTitle = document.createElement('div');
  heroTitle.className = 'rem-hero-title';
  heroTitle.textContent = isTr ? 'AI Zayıf Nokta Atölyesi' : 'AI Weak-Spot Studio';

  const criticalCount = ctx.diagnosedWeaknesses.filter((w) => w.severity === 'critical').length;
  const focusCount = ctx.diagnosedWeaknesses.filter((w) => w.severity === 'focus').length;
  const activeIds = new Set(ctx.diagnosedWeaknesses.map((w) => w.skillId));
  const resolvedCount = Object.values(ctx.remedialProgress).filter(
    (m) => m.lastAccuracyPct >= 80 && !activeIds.has(m.skillId)
  ).length;
  const resolvedSuffix =
    resolvedCount > 0
      ? isTr
        ? ` · ✓ ${resolvedCount} konu kapatıldı`
        : ` · ✓ ${resolvedCount} resolved`
      : '';
  const heroSub = document.createElement('div');
  heroSub.className = 'rem-hero-sub';
  heroSub.textContent =
    ctx.diagnosedWeaknesses.length > 0
      ? isTr
        ? `${criticalCount} kritik · ${focusCount} odak${resolvedSuffix}`
        : `${criticalCount} critical · ${focusCount} focus${resolvedSuffix}`
      : resolvedCount > 0
        ? isTr
          ? `Harika! Tespit edilen tüm eksiklerini kapattın (✓ ${resolvedCount} konu). Yeni hata olursa burada otomatik çıkar.`
          : `Awesome! You cleared all diagnosed weak spots (✓ ${resolvedCount} resolved). New slips appear here automatically.`
        : isTr
          ? 'Tüm geçmişin temiz görünüyor! Alttan istediğin özel konuyu hemen çalışabilirsin.'
          : 'Your error log looks clean! Pick any targeted workshop below to sharpen your edge.';

  heroLeft.append(heroTitle, heroSub);

  const scanBtn = document.createElement('button');
  scanBtn.type = 'button';
  scanBtn.className = 'rem-ai-scan-btn';
  setIconLabel(scanBtn, 'sparkles', isTr ? 'AI Derin Tara' : 'AI Deep Scan', 13);
  scanBtn.disabled = !ctx.aiActive;
  scanBtn.title = ctx.aiActive
    ? isTr
      ? 'Son hatalarını yapay zekâ ile derinlemesine analiz et'
      : 'Run an AI deep scan across your recent error history'
    : isTr
      ? 'Ayarlar → AI Değerlendirme bölümünden API anahtarı ekleyin'
      : 'Enable AI in Settings → AI Evaluation first';

  const scanStatus = document.createElement('div');
  scanStatus.className = 'rem-scan-status';
  scanStatus.hidden = true;

  scanBtn.addEventListener('click', async () => {
    scanBtn.disabled = true;
    setIconLabel(scanBtn, 'sparkles', isTr ? 'Taranıyor...' : 'Scanning...', 13);
    scanStatus.hidden = false;
    scanStatus.textContent = isTr
      ? 'Yapay zekâ son hatalarındaki gizli kalıpları tarıyor...'
      : 'AI is scanning your recent mistakes for hidden patterns...';
    try {
      const res = (await chrome.runtime.sendMessage({
        type: 'DIAGNOSE_WEAKNESSES_AI',
        language: ctx.uiLanguage,
      } satisfies ExtensionMessage)) as {
        ok?: boolean;
        weaknesses?: AiDiagnosedOverlayItem[];
        error?: string;
      };
      if (res?.ok && Array.isArray(res.weaknesses)) {
        await ctx.onRefreshDiagnosis(res.weaknesses);
        return;
      }
      scanStatus.textContent =
        res?.error ||
        (isTr
          ? 'AI taraması tamamlanamadı. Yerel teşhis aktif.'
          : 'AI scan unavailable. Local diagnosis remains active.');
    } catch {
      scanStatus.textContent = isTr
        ? 'AI bağlantısı kurulamadı. Yerel teşhis aktif.'
        : 'Could not reach AI. Local diagnosis remains active.';
    } finally {
      scanBtn.disabled = !ctx.aiActive;
      setIconLabel(scanBtn, 'sparkles', isTr ? 'AI Derin Tara' : 'AI Deep Scan', 13);
    }
  });

  hero.append(heroLeft, scanBtn);
  root.appendChild(hero);
  root.appendChild(scanStatus);

  // Scrollable content area
  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'rem-scroll-body';

  const launchSkill = (skillId: WeakSkillId, weakness: DiagnosedWeakness | null): void => {
    const plan = buildRemedialLessonPlan(
      skillId,
      weakness,
      ctx.allCards,
      ctx.progressMap,
      Date.now()
    );
    renderRemedialBriefing(ctx, plan, weakness);
  };

  if (ctx.diagnosedWeaknesses.length > 0) {
    const secLabel = document.createElement('div');
    secLabel.className = 'rem-section-label';
    secLabel.textContent = isTr
      ? `SANA ÖZEL TESPİT EDİLEN DERSLER (${ctx.diagnosedWeaknesses.length})`
      : `PERSONALIZED WEAKNESS LESSONS (${ctx.diagnosedWeaknesses.length})`;
    scrollWrap.appendChild(secLabel);

    const listEl = document.createElement('div');
    listEl.className = 'rem-card-list';

    for (const w of ctx.diagnosedWeaknesses) {
      const mastery = ctx.remedialProgress[w.skillId];

      const card = document.createElement('div');
      card.className = `rem-card sev-${w.severity}`;

      const topRow = document.createElement('div');
      topRow.className = 'rem-card-top';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'rem-card-title-wrap';

      const iconEl = document.createElement('span');
      iconEl.className = 'rem-card-icon';
      setIconOnly(iconEl, getRemedialSkillIconName(w.skillId), 14);

      const titleCol = document.createElement('div');
      titleCol.className = 'rem-card-title-col';
      const titleEl = document.createElement('div');
      titleEl.className = 'rem-card-title';
      titleEl.textContent = isTr ? w.titleTr : w.titleEn;

      const subEl = document.createElement('div');
      subEl.className = 'rem-card-sub';
      subEl.textContent = isTr ? w.subtitleTr : w.subtitleEn;
      titleCol.append(titleEl, subEl);
      titleWrap.append(iconEl, titleCol);

      const sevPill = document.createElement('span');
      sevPill.className = `rem-sev-pill sev-${w.severity}`;
      sevPill.textContent =
        w.severity === 'critical'
          ? isTr
            ? 'Öncelikli'
            : 'Priority'
          : w.severity === 'focus'
            ? isTr
              ? 'Odak'
              : 'Focus'
            : isTr
              ? 'Pekiştir'
              : 'Polish';

      topRow.append(titleWrap, sevPill);
      card.appendChild(topRow);

      // Personal evidence or AI diagnostic reason
      if (w.aiReason) {
        const aiBox = document.createElement('div');
        aiBox.className = 'rem-evidence-box is-ai';
        aiBox.textContent = w.aiReason;
        card.appendChild(aiBox);
      } else if (w.evidenceExamples.length > 0) {
        const ev = w.evidenceExamples[0]!;
        const evBox = document.createElement('div');
        evBox.className = 'rem-evidence-box';
        const userSnippet =
          ev.userAnswer && ev.userAnswer !== '(skipped)'
            ? isTr
              ? ` · Cevabın: "${ev.userAnswer.slice(0, 42)}"`
              : ` · You wrote: "${ev.userAnswer.slice(0, 42)}"`
            : '';
        evBox.textContent = isTr
          ? `Takıldığın örnek: "${ev.en.slice(0, 56)}"${userSnippet}`
          : `Missed example: "${ev.en.slice(0, 56)}"${userSnippet}`;
        card.appendChild(evBox);
      }

      const bottomRow = document.createElement('div');
      bottomRow.className = 'rem-card-bottom';

      const metaEl = document.createElement('div');
      metaEl.className = 'rem-card-meta';
      const errTxt = isTr ? `${w.errorCount} sinyal` : `${w.errorCount} signals`;
      const mastTxt = mastery
        ? isTr
          ? ` · ✓ En iyi %${mastery.bestAccuracyPct}`
          : ` · ✓ Best ${mastery.bestAccuracyPct}%`
        : '';
      metaEl.textContent = `${errTxt}${mastTxt}`;

      const enterBtn = document.createElement('button');
      enterBtn.type = 'button';
      enterBtn.className = 'rem-enter-btn';
      enterBtn.textContent = isTr ? 'Derse Gir →' : 'Start Lesson →';
      enterBtn.addEventListener('click', () => launchSkill(w.skillId, w));

      bottomRow.append(metaEl, enterBtn);
      card.appendChild(bottomRow);
      listEl.appendChild(card);
    }

    scrollWrap.appendChild(listEl);
  }

  // Collapsible full catalog so user can manually study ANY of the 18 topics
  const catalogDetails = document.createElement('details');
  catalogDetails.className = 'rem-all-catalog';
  if (ctx.diagnosedWeaknesses.length === 0) {
    catalogDetails.open = true;
  }

  const summary = document.createElement('summary');
  summary.className = 'rem-catalog-summary';
  summary.textContent = isTr
    ? `Tüm Özel Konu Atölyeleri (${getAllRemedialCatalogItems().length})`
    : `Browse All Special Workshops (${getAllRemedialCatalogItems().length})`;
  catalogDetails.appendChild(summary);

  const catalogGrid = document.createElement('div');
  catalogGrid.className = 'rem-catalog-grid';
  const diagnosedById = new Map(ctx.diagnosedWeaknesses.map((w) => [w.skillId, w]));

  for (const spec of getAllRemedialCatalogItems()) {
    const mastery = ctx.remedialProgress[spec.skillId];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `rem-catalog-chip ${mastery ? 'is-done' : ''}`;

    const chipTop = document.createElement('span');
    chipTop.className = 'rem-chip-title';
    setIconLabel(chipTop, getRemedialSkillIconName(spec.skillId), isTr ? spec.titleTr : spec.titleEn, 12);

    const chipSub = document.createElement('span');
    chipSub.className = 'rem-chip-sub';
    chipSub.textContent = mastery
      ? isTr
        ? `✓ %${mastery.bestAccuracyPct} · Tekrarla`
        : `✓ ${mastery.bestAccuracyPct}% · Replay`
      : isTr
        ? 'Anlatım + Pratik →'
        : 'Briefing + Drills →';

    btn.append(chipTop, chipSub);
    btn.addEventListener('click', () => launchSkill(spec.skillId, diagnosedById.get(spec.skillId) ?? null));
    catalogGrid.appendChild(btn);
  }

  catalogDetails.appendChild(catalogGrid);
  scrollWrap.appendChild(catalogDetails);
  root.appendChild(scrollWrap);
  ctx.container.appendChild(root);
}

/**
 * Render Stage 0: Pre-Lesson Interactive AI Coach Briefing BEFORE any exercise starts.
 * Shows Golden Rule, playable modern DOĞRU ✓ vs TUZAK ✕ examples, Mnemonic hook,
 * and asynchronously enriches with an AI personal note referencing the user's real mistakes.
 */
export function renderRemedialBriefing(
  ctx: RemedialViewContext,
  plan: RemedialLessonPlan,
  weakness: DiagnosedWeakness | null,
  resumedSession?: RemedialActiveSession
): void {
  const isTr = resolveSupportedLanguage(ctx.uiLanguage) === 'tr';
  setCrimsonThemeActive(true);
  cancelEnglishSpeech();
  void clearActiveRoadmapSession();
  void saveOpenGuidebookUnitId(null);
  void saveRoadmapUiMode('remedial');
  ctx.container.replaceChildren();

  let briefTutorHistory: AiTutorChatTurn[] = resumedSession?.tutorHistory
    ? [...resumedSession.tutorHistory]
    : [];
  let briefTutorOpen = Boolean(resumedSession?.tutorOpen);
  let briefTutorDraft = resumedSession?.tutorDraft ?? '';

  const persistBriefing = (): void => {
    void saveActiveRemedialSession({
      version: ACTIVE_REMEDIAL_SESSION_VERSION,
      stage: 'briefing',
      skillId: plan.skillId,
      plan,
      weakness,
      queue: plan.exercises.map((item) => ({ ...item })),
      currentIdx: 0,
      totalInitial: plan.exercises.length,
      firstTryCorrect: 0,
      combo: 0,
      maxCombo: 0,
      cheatSheetOpen: false,
      readyToFinish: false,
      tutorOpen: briefTutorOpen,
      tutorHistory: [...briefTutorHistory],
      tutorDraft: briefTutorDraft || undefined,
      updatedAt: Date.now(),
    });
  };
  persistBriefing();

  const root = document.createElement('div');
  root.className = 'duo-lesson-session is-remedial-crimson';

  // Top bar
  const topBar = document.createElement('div');
  topBar.className = 'duo-lesson-topbar rem-brief-topbar';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'duo-lesson-exit';
  backBtn.textContent = '←';
  backBtn.title = isTr ? 'Özel Derslere Dön' : 'Back to Remedial Studio';
  backBtn.addEventListener('click', () => {
    cancelEnglishSpeech();
    stopActiveRuleAudio();
    if (getActiveGuideAssistantId() === 'tour_remedial_briefing') {
      stopGuideAssistant();
    }
    briefAudioPlayer.dispose();
    void clearActiveRemedialSession().finally(() => {
      renderRemedialHub(ctx);
    });
  });

  const titleEl = document.createElement('div');
  titleEl.className = 'rem-brief-top-title';
  setIconLabel(titleEl, getRemedialSkillIconName(plan.skillId), isTr ? plan.titleTr : plan.titleEn, 14);

  const openBriefTutor = (): void => {
    briefTutorOpen = true;
    persistBriefing();
    openAiTutorDrawer({
      host: root,
      uiLanguage: ctx.uiLanguage,
      aiActive: ctx.aiActive,
      crimson: true,
      history: briefTutorHistory,
      draftQuestion: briefTutorDraft,
      onHistoryChanged: (nextHist) => {
        briefTutorHistory = [...nextHist];
        persistBriefing();
      },
      onDraftChanged: (nextDraft) => {
        briefTutorDraft = nextDraft;
        persistBriefing();
      },
      onClosed: () => {
        briefTutorOpen = false;
        persistBriefing();
      },
      context: {
        sentenceEn: `${plan.titleEn} — ${plan.briefing.examples[0]?.en ?? ''}`,
        meaningTr: isTr ? plan.briefing.goldenRuleTr : plan.briefing.goldenRuleEn,
        promptText: isTr ? plan.titleTr : plan.titleEn,
      },
    });
  };

  const briefTopActions = document.createElement('div');
  briefTopActions.className = 'rem-brief-top-actions';

  const askBriefBtn = document.createElement('button');
  askBriefBtn.type = 'button';
  askBriefBtn.className = 'duo-ask-ai-btn is-crimson';
  setIconLabel(askBriefBtn, 'message', isTr ? 'AI’a Sor' : 'Ask AI', 13);
  askBriefBtn.title = isTr
    ? 'Bu kural hakkında aklına takılanı yapay zekâya sor'
    : 'Ask the AI tutor any question about this rule';
  askBriefBtn.addEventListener('click', openBriefTutor);

  briefTopActions.append(askBriefBtn);
  topBar.append(backBtn, titleEl, briefTopActions);
  root.appendChild(topBar);

  // Scrollable briefing body
  const body = document.createElement('div');
  body.className = 'duo-lesson-stage rem-brief-body';

  // Unified Coach Card: integrated Audio Player + Headline + Verbatim Transcript + Mnemonic
  const briefAudioPlayer = createRuleAudioPlayer({
    skillId: plan.skillId,
    isTr,
    crimson: true,
  });

  const ruleCard = document.createElement('div');
  ruleCard.className = 'rem-golden-rule';

  const audioSlotWrap = document.createElement('div');
  audioSlotWrap.className = 'rem-coach-audio-wrap';
  audioSlotWrap.appendChild(briefAudioPlayer.element);

  const ruleContent = document.createElement('div');
  ruleContent.className = 'rem-coach-text-wrap';

  const headline = document.createElement('h3');
  headline.className = 'rem-brief-headline';
  headline.textContent = isTr ? plan.briefing.headlineTr : plan.briefing.headlineEn;

  const ruleText = document.createElement('p');
  ruleText.className = 'rem-brief-rule-text';
  const transcriptText = isTr
    ? REMEDIAL_VOICE_TRANSCRIPTS[plan.skillId] || plan.briefing.goldenRuleTr
    : plan.briefing.goldenRuleEn;
  const briefTranscriptSync = mountSyncedTranscript(
    ruleText,
    plan.skillId,
    transcriptText,
    isTr,
    (startMs) => {
      briefAudioPlayer.seekToMs(startMs, true);
    }
  );
  briefAudioPlayer.setOnTimeMs(briefTranscriptSync.update);

  ruleContent.append(headline, ruleText);
  ruleCard.append(audioSlotWrap, ruleContent);
  body.appendChild(ruleCard);

  // Examples section + inline opt-in AI Note trigger on the same header row
  const exHeaderRow = document.createElement('div');
  exHeaderRow.className = 'rem-examples-header-row';

  const exHeader = document.createElement('div');
  exHeader.className = 'rem-section-label';
  exHeader.textContent = isTr ? 'ÖRNEKLER & TUZAKLAR' : 'EXAMPLES & TRAPS';

  const aiToggleBtn = document.createElement('button');
  aiToggleBtn.type = 'button';
  aiToggleBtn.className = 'rem-ai-toggle-pill';
  setIconLabel(aiToggleBtn, 'sparkles', isTr ? 'AI Özel Notu ▾' : 'AI Coach Note ▾', 12);

  exHeaderRow.append(exHeader, aiToggleBtn);
  body.appendChild(exHeaderRow);

  const aiSlot = document.createElement('div');
  aiSlot.className = 'rem-ai-note';
  aiSlot.hidden = true;
  const aiSlotLabel = document.createElement('div');
  aiSlotLabel.className = 'rem-ai-note-lbl';
  const aiSlotBody = document.createElement('p');
  aiSlotBody.className = 'rem-ai-note-body';

  if (plan.briefing.source === 'ai' && plan.briefing.personalNote) {
    aiSlotLabel.textContent = isTr ? 'AI Özel Öğretmenin Notu' : 'Your AI Private Tutor';
    aiSlotBody.textContent = plan.briefing.personalNote;
  } else if (weakness?.aiReason) {
    aiSlotLabel.textContent = isTr ? 'AI Koçunun Kişisel Notu' : 'AI Coach Note';
    aiSlotBody.textContent = weakness.aiReason;
  } else if (weakness && weakness.evidenceExamples.length > 0) {
    const firstEv = weakness.evidenceExamples[0]!;
    aiSlotLabel.textContent = isTr ? 'Neden Bu Dersi Açtık?' : 'Why This Lesson?';
    aiSlotBody.textContent = isTr
      ? `Geçmişinde "${firstEv.en}" örneğinde takıldın. Yukarıdaki kuralı dinledikten sonra alıştırmalarla pekiştireceğiz.`
      : `You stumbled on "${firstEv.en}" earlier. Review the rule above, then lock it in with interactive drills.`;
  } else {
    aiSlotLabel.textContent = isTr ? 'Özel Ders Hazır' : 'Workshop Ready';
    aiSlotBody.textContent = isTr
      ? 'Önce kuralı ve tuzakları gör, ardından alıştırmalarla pekiştir.'
      : 'Review the core logic and traps first, then master them via interactive drills.';
  }
  aiSlot.append(aiSlotLabel, aiSlotBody);
  body.appendChild(aiSlot);

  const examplesList = document.createElement('div');
  examplesList.className = 'rem-examples-list';

  const appendExampleCard = (ex: RemedialBriefingExample, isAiExtra = false): void => {
    const card = document.createElement('div');
    card.className = `rem-example-card ${ex.isTrap ? 'is-trap' : 'is-good'} ${isAiExtra ? 'is-ai-extra' : ''}`;

    const topLine = document.createElement('div');
    topLine.className = 'rem-ex-top-line';

    const tag = document.createElement('span');
    tag.className = `rem-ex-tag ${ex.isTrap ? 'is-trap' : 'is-good'}`;
    tag.textContent = ex.isTrap ? '✕' : '✓';
    tag.title = ex.isTrap
      ? isTr
        ? 'Yaygın Tuzak (Yanlış)'
        : 'Common Trap'
      : isAiExtra
        ? isTr
          ? 'AI Örneği'
          : 'AI Example'
        : isTr
          ? 'Doğru Kullanım'
          : 'Correct';

    const enEl = document.createElement('div');
    enEl.className = 'rem-ex-en';
    enEl.dataset.wordLang = 'en';
    appendHighlightedText(enEl, ex.en, ex.highlight);

    topLine.append(tag, enEl);

    if (!ex.isTrap) {
      const spkBtn = document.createElement('button');
      spkBtn.type = 'button';
      spkBtn.className = 'duo-audio-mini-btn rem-ex-spk';
      setIconOnly(spkBtn, 'volume', 14);
      spkBtn.title = isTr ? 'Dinle' : 'Listen';
      spkBtn.addEventListener('click', () => speakEnglish(ex.en));
      topLine.appendChild(spkBtn);
    }

    const trEl = document.createElement('div');
    trEl.className = 'rem-ex-tr';
    trEl.dataset.wordLang = 'tr';
    trEl.textContent = ex.isTrap ? (isTr ? ex.tr : ex.trapNoteEn || ex.tr) : ex.tr;

    card.append(topLine, trEl);
    examplesList.appendChild(card);
  };

  const baseExampleCount =
    REMEDIAL_SKILL_CATALOG[plan.skillId]?.briefing.examples.length ?? plan.briefing.examples.length;
  for (let i = 0; i < plan.briefing.examples.length; i += 1) {
    appendExampleCard(plan.briefing.examples[i]!, i >= baseExampleCount);
  }
  body.appendChild(examplesList);

  root.appendChild(body);

  // Footer CTA
  const footer = document.createElement('div');
  footer.className = 'duo-lesson-footer rem-brief-footer';

  const infoPill = document.createElement('span');
  infoPill.className = 'rem-brief-count';
  infoPill.textContent = isTr
    ? `${plan.exercises.length} yaratıcı alıştırma · +25 XP`
    : `${plan.exercises.length} interactive drills · +25 XP`;

  const startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.className = 'duo-btn-check rem-start-btn';
  startBtn.textContent = isTr ? 'Anladım, Pratiğe Başla! →' : 'Got It, Start Drills! →';
  startBtn.addEventListener('click', () => {
    cancelEnglishSpeech();
    stopActiveRuleAudio();
    if (getActiveGuideAssistantId() === 'tour_remedial_briefing') {
      stopGuideAssistant();
    }
    briefAudioPlayer.dispose();
    startRemedialLessonSession(ctx, plan, weakness);
  });

  footer.append(infoPill, startBtn);
  root.appendChild(footer);
  ctx.container.appendChild(root);

  if (briefTutorOpen) {
    openBriefTutor();
  }

  // Only fetch optional AI personal note when the user clicks the ✨ AI Özel Notu pill
  let aiRequested = false;
  let alive = true;
  startBtn.addEventListener('click', () => {
    alive = false;
  });
  backBtn.addEventListener('click', () => {
    alive = false;
  });

  aiToggleBtn.addEventListener('click', () => {
    const nextOpen = aiSlot.hidden;
    aiSlot.hidden = !nextOpen;
    aiToggleBtn.classList.toggle('is-open', nextOpen);
    setIconLabel(
      aiToggleBtn,
      'sparkles',
      nextOpen
        ? isTr
          ? 'AI Notunu Gizle ▴'
          : 'Hide AI Note ▴'
        : isTr
          ? 'AI Özel Notu ▾'
          : 'AI Coach Note ▾',
      12
    );

    if (!nextOpen || aiRequested || !ctx.aiActive || plan.briefing.source === 'ai') {
      return;
    }
    aiRequested = true;
    aiSlotLabel.textContent = isTr ? 'AI Koç kişiselleştiriyor...' : 'AI Coach personalizing...';
    void chrome.runtime
      .sendMessage({
        type: 'GENERATE_REMEDIAL_BRIEFING',
        skillId: plan.skillId,
        titleTr: plan.titleTr,
        titleEn: plan.titleEn,
        evidence: (weakness?.evidenceExamples ?? []).slice(0, 4).map((e) => ({
          en: e.en,
          userAnswer: e.userAnswer,
          expected: e.expected,
        })),
        language: ctx.uiLanguage,
      } satisfies ExtensionMessage)
      .then((res) => {
        if (!alive || !root.isConnected) return;
        const payload = res as {
          ok?: boolean;
          briefingAi?: {
            personalNote: string;
            extraExamples: RemedialBriefingExample[];
          };
        };
        if (payload?.ok && payload.briefingAi) {
          if (payload.briefingAi.personalNote) {
            plan.briefing.personalNote = payload.briefingAi.personalNote;
            aiSlotLabel.textContent = isTr
              ? 'AI Özel Öğretmenin Notu'
              : 'Your AI Private Tutor';
            aiSlotBody.textContent = payload.briefingAi.personalNote;
          }
          const existingEn = new Set(plan.briefing.examples.map((ex) => ex.en.trim().toLowerCase()));
          for (const extra of payload.briefingAi.extraExamples) {
            const key = extra.en.trim().toLowerCase();
            if (!key || existingEn.has(key)) continue;
            existingEn.add(key);
            plan.briefing.examples.push(extra);
            appendExampleCard(extra, true);
          }
          plan.briefing.source = 'ai';
          persistBriefing();
        } else {
          aiSlotLabel.textContent = isTr ? 'Ders Özeti' : 'Lesson Overview';
        }
      })
      .catch(() => {
        if (!alive || !root.isConnected) return;
        aiSlotLabel.textContent = isTr ? 'Ders Özeti' : 'Lesson Overview';
      });
  });
}

function getExerciseBadgeInfo(
  kind: RemedialExercise['kind'],
  isTr: boolean
): { badge: string; instruction: string } {
  switch (kind) {
    case 'contrast_duel':
      return {
        badge: isTr ? 'İkili Düello' : 'Contrast Duel',
        instruction: isTr ? 'Boşluğa uygun olanı seç' : 'Choose the right option',
      };
    case 'spot_fix':
      return {
        badge: isTr ? 'Cümle Düzeltme' : 'Spot & Fix',
        instruction: isTr
          ? 'Hatalı kelimeyi işaretle ve doğrusunu seç'
          : 'Tap the wrong word and replace it',
      };
    case 'scenario_pick':
      return {
        badge: isTr ? 'Senaryo' : 'Scenario',
        instruction: isTr
          ? 'En doğal İngilizce karşılığı seç'
          : 'Choose the most natural reply',
      };
    case 'vocab_recall':
      return {
        badge: isTr ? 'Kelime' : 'Vocabulary',
        instruction: isTr
          ? 'Doğru Türkçe anlamı seç'
          : 'Select the Turkish meaning',
      };
    case 'cloze_blank':
      return {
        badge: isTr ? 'Boşluk Doldurma' : 'Fill in the Blank',
        instruction: isTr
          ? 'Cümleye en uygun seçeneği seç'
          : 'Complete the sentence',
      };
    case 'word_bank':
      return {
        badge: isTr ? 'Cümle İnşası' : 'Sentence Builder',
        instruction: isTr
          ? 'Kelimeleri sıraya dizerek cümleyi kur'
          : 'Arrange the words to build the sentence',
      };
    case 'free_translation':
      return {
        badge: isTr ? 'Çeviri' : 'Translation',
        instruction: isTr
          ? 'Cümleyi İngilizceye çevir'
          : 'Translate into English',
      };
  }
}

/**
 * Run the 6-format interactive Crimson Remedial Lesson Session.
 */
export function startRemedialLessonSession(
  ctx: RemedialViewContext,
  plan: RemedialLessonPlan,
  weakness: DiagnosedWeakness | null,
  resumedSession?: RemedialActiveSession
): void {
  const isTr = resolveSupportedLanguage(ctx.uiLanguage) === 'tr';
  setCrimsonThemeActive(true);
  cancelEnglishSpeech();
  void clearActiveRoadmapSession();
  void saveOpenGuidebookUnitId(null);
  void saveRoadmapUiMode('remedial');

  const queue: RemedialExercise[] = resumedSession
    ? resumedSession.queue.map((item) => ({ ...item }))
    : plan.exercises.map((item) => ({ ...item }));
  const totalInitial = resumedSession ? resumedSession.totalInitial : queue.length;
  const lessonStartMs = Date.now();
  let currentIdx = resumedSession ? Math.max(0, resumedSession.currentIdx) : 0;
  let firstTryCorrect = resumedSession ? resumedSession.firstTryCorrect : 0;
  let combo = resumedSession ? resumedSession.combo : 0;
  let maxCombo = resumedSession ? resumedSession.maxCombo : 0;
  let cheatSheetOpen = Boolean(resumedSession?.cheatSheetOpen);
  let activeKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  let activeQuestionPlayer: QuestionVoiceCardController | null = null;

  const disposeQuestionPlayer = (): void => {
    if (activeQuestionPlayer) {
      activeQuestionPlayer.dispose();
      activeQuestionPlayer = null;
    }
  };

  let currentDraft: ExerciseDraftState = {};
  let currentCheckedState: CheckedFeedbackSnapshot | undefined;
  let currentTutorOpen = false;
  let currentTutorHistory: AiTutorChatTurn[] = [];
  let currentTutorDraft = '';

  const persistLesson = (readyToFinish: boolean = false): void => {
    void saveActiveRemedialSession({
      version: ACTIVE_REMEDIAL_SESSION_VERSION,
      stage: 'lesson',
      skillId: plan.skillId,
      plan,
      weakness,
      queue,
      currentIdx,
      totalInitial,
      firstTryCorrect,
      combo,
      maxCombo,
      cheatSheetOpen,
      readyToFinish,
      draft: { ...currentDraft },
      checkedState: currentCheckedState ? { ...currentCheckedState } : undefined,
      tutorOpen: currentTutorOpen,
      tutorHistory: [...currentTutorHistory],
      tutorDraft: currentTutorDraft || undefined,
      updatedAt: Date.now(),
    });
  };

  const detachKeys = (): void => {
    if (activeKeyHandler) {
      document.removeEventListener('keydown', activeKeyHandler);
      activeKeyHandler = null;
    }
  };

  ctx.container.replaceChildren();
  const sessionEl = document.createElement('div');
  sessionEl.className = 'duo-lesson-session is-remedial-crimson';
  ctx.container.appendChild(sessionEl);

  const renderExercise = (restored?: {
    draft?: ExerciseDraftState;
    checkedState?: CheckedFeedbackSnapshot;
    tutorOpen?: boolean;
    tutorHistory?: AiTutorChatTurn[];
    tutorDraft?: string;
  }): void => {
    detachKeys();
    disposeQuestionPlayer();
    cancelEnglishSpeech();

    if (currentIdx >= queue.length) {
      stopActiveRuleAudio();
      persistLesson(true);
      void finishRemedialSession();
      return;
    }
    stopActiveRuleAudio();

    currentDraft = restored?.draft ? { ...restored.draft } : {};
    currentCheckedState = restored?.checkedState ? { ...restored.checkedState } : undefined;
    currentTutorOpen = Boolean(restored?.tutorOpen);
    currentTutorHistory = restored?.tutorHistory ? [...restored.tutorHistory] : [];
    currentTutorDraft = restored?.tutorDraft ?? '';
    persistLesson(false);

    const ex = queue[currentIdx]!;
    const hasQuestionVoiceover = Boolean(ex.questionAudioId && ex.questionVoiceScriptTr);
    const { instruction } = getExerciseBadgeInfo(ex.kind, isTr);
    sessionEl.replaceChildren();

    // Top Bar
    const topBar = document.createElement('div');
    topBar.className = 'duo-lesson-topbar';

    const exitBtn = document.createElement('button');
    exitBtn.type = 'button';
    exitBtn.className = 'duo-lesson-exit';
    exitBtn.textContent = '✕';
    exitBtn.title = isTr ? 'Atölyeye Dön' : 'Back to Studio';
    exitBtn.addEventListener('click', () => {
      detachKeys();
      disposeQuestionPlayer();
      cancelEnglishSpeech();
      stopActiveRuleAudio();
      void clearActiveRemedialSession().finally(() => {
        renderRemedialHub(ctx);
      });
    });

    const progressTrack = document.createElement('div');
    progressTrack.className = 'duo-progress-track';
    const progressFill = document.createElement('div');
    progressFill.className = 'duo-progress-fill';
    progressTrack.appendChild(progressFill);

    const counterEl = document.createElement('span');
    counterEl.className = 'duo-q-counter-pill is-crimson';
    const refreshRemCounter = (checked: boolean): void => {
      const counter = formatLessonProgressCounter(currentIdx, queue.length, checked, isTr);
      counterEl.textContent = counter.indexText;
      const doneCount = checked ? currentIdx + 1 : currentIdx;
      const pct = Math.max(6, Math.min(100, Math.round((doneCount / Math.max(1, queue.length)) * 100)));
      progressFill.style.width = `${pct}%`;
    };
    refreshRemCounter(Boolean(currentCheckedState));

    const rulePeekBtn = document.createElement('button');
    rulePeekBtn.type = 'button';
    rulePeekBtn.className = 'rem-rule-peek-btn';
    setIconLabel(rulePeekBtn, 'book', isTr ? 'Kural' : 'Rule', 13);

    const openRemTutor = (): void => {
      currentTutorOpen = true;
      persistLesson(false);
      const isCheckedNow = Boolean(currentCheckedState);
      const solution = ex.correctedSentence ?? ex.correctChoice ?? ex.expectedAnswers[0] ?? '';
      openAiTutorDrawer({
        host: sessionEl,
        card: ex.card,
        uiLanguage: ctx.uiLanguage,
        aiActive: ctx.aiActive,
        crimson: true,
        history: currentTutorHistory,
        draftQuestion: currentTutorDraft,
        onHistoryChanged: (nextHist) => {
          currentTutorHistory = [...nextHist];
          persistLesson(false);
        },
        onDraftChanged: (nextDraft) => {
          currentTutorDraft = nextDraft;
          persistLesson(false);
        },
        onClosed: () => {
          currentTutorOpen = false;
          persistLesson(false);
        },
        context: {
          sentenceEn: isCheckedNow ? ex.audioText || solution || ex.promptText : ex.promptText,
          meaningTr: ex.postAnswerSubtext || ex.promptSubtext,
          promptText: ex.promptText,
          expectedAnswer: isCheckedNow ? solution : undefined,
          userAnswer: isCheckedNow ? currentCheckedState?.userAnswer : undefined,
          exerciseKind: ex.kind,
          existingExplanation: isCheckedNow
            ? currentCheckedState?.explanationNote || (isTr ? ex.explanationTr : ex.explanationEn)
            : undefined,
        },
      });
    };

    const remSampleText =
      ex.correctedSentence || ex.audioText || ex.expectedAnswers[0] || ex.promptText;
    const detectedRemSkills = detectHelpSkillsForQuestion({
      englishText: remSampleText,
      cardType: ex.card.type,
      exerciseKind: ex.kind,
      primarySkillId: plan.skillId,
    });
    const shouldGlowRemTeach = hasRichTeachMeSkills(detectedRemSkills);

    const openRemTeachMe = async (): Promise<void> => {
      const isCheckedNow = Boolean(currentCheckedState);
      const useAi = await isAiApiConfigured();
      openTeachMeDrawer({
        host: sessionEl,
        detectedSkills: detectedRemSkills,
        uiLanguage: ctx.uiLanguage,
        crimson: true,
        initialAiMode: useAi,
        sentenceEn: remSampleText,
        meaningTr: ex.card.acceptedTr.join(', '),
        sentenceHint: isCheckedNow ? remSampleText : ex.promptText,
      });
    };

    const teachRemBtn = document.createElement('button');
    teachRemBtn.type = 'button';
    teachRemBtn.className = `duo-teach-btn is-crimson${shouldGlowRemTeach ? ' is-glow' : ''}`;
    setIconLabel(teachRemBtn, 'headphones', isTr ? 'Öğret' : 'Teach', 13);
    teachRemBtn.title = isTr
      ? 'Bu sorudaki kuralları sesli ve yazılı dinle (API bağlıysa canlı AI + EMA)'
      : 'Listen & read rules in this drill';
    teachRemBtn.addEventListener('click', () => void openRemTeachMe());

    const askRemTopBtn = document.createElement('button');
    askRemTopBtn.type = 'button';
    askRemTopBtn.className = 'duo-ask-ai-btn is-crimson';
    setIconLabel(askRemTopBtn, 'message', isTr ? 'AI’a Sor' : 'Ask AI', 13);
    askRemTopBtn.title = isTr
      ? 'Bu alıştırma hakkında yapay zekâya sor'
      : 'Ask AI tutor about this drill';
    askRemTopBtn.addEventListener('click', openRemTutor);

    const comboEl = document.createElement('span');
    comboEl.className = `duo-combo-pill ${combo >= 2 ? 'visible' : ''}`;
    if (combo >= 2) {
      setIconLabel(comboEl, 'flame', `${combo}x`, 12);
    }

    const topActions = document.createElement('div');
    topActions.className = 'duo-topbar-actions';
    if (hasQuestionVoiceover) {
      topActions.append(rulePeekBtn, askRemTopBtn);
    } else {
      topActions.append(teachRemBtn, rulePeekBtn, askRemTopBtn);
    }
    if (combo >= 2) {
      topActions.appendChild(comboEl);
    }
    topBar.append(exitBtn, progressTrack, counterEl, topActions);
    sessionEl.appendChild(topBar);

    // Inline toggleable cheat-sheet drawer
    const cheatBox = document.createElement('div');
    cheatBox.className = 'rem-cheatsheet';
    cheatBox.hidden = !cheatSheetOpen;
    const rawMnemonic = isTr ? plan.briefing.mnemonicTr : plan.briefing.mnemonicEn;
    const cleanMnemonic = rawMnemonic.replace(/^[💡]\s*/u, '').replace(/❌/gu, '✕');
    cheatBox.textContent = `${isTr ? plan.briefing.goldenRuleTr : plan.briefing.goldenRuleEn}  ${cleanMnemonic}`;
    sessionEl.appendChild(cheatBox);

    rulePeekBtn.addEventListener('click', () => {
      cheatSheetOpen = !cheatSheetOpen;
      cheatBox.hidden = !cheatSheetOpen;
      persistLesson(false);
    });

    // Main stage
    const stage = document.createElement('div');
    stage.className = 'duo-lesson-stage';

    // Keep stage clean: only surface a minimal retry pill when re-practicing a missed drill
    if (ex.isRetryRequeue) {
      const badgeEl = document.createElement('div');
      badgeEl.className = 'duo-ex-badge rem-ex-badge';
      badgeEl.textContent = isTr ? 'Tekrar' : 'Retry';
      stage.appendChild(badgeEl);
    }

    // spot_fix already displays its interactive 2-step guide inside the proofreader card
    if (ex.kind !== 'spot_fix') {
      const instrEl = document.createElement('div');
      instrEl.className = 'duo-ex-instruction';
      instrEl.textContent = instruction;
      stage.appendChild(instrEl);
    }

    // Interaction state (hydrated from persisted draft if resuming)
    let selectedChoice: string | null = currentDraft.selectedChoice ?? null;
    const placedTiles: Array<{ bankIdx: number; text: string }> = [];
    if (ex.kind === 'word_bank' && Array.isArray(currentDraft.placedTileIndices)) {
      const tiles = ex.wordBankTiles ?? [];
      const seenIdx = new Set<number>();
      for (const idx of currentDraft.placedTileIndices) {
        if (typeof idx === 'number' && idx >= 0 && idx < tiles.length && !seenIdx.has(idx)) {
          seenIdx.add(idx);
          placedTiles.push({ bankIdx: idx, text: tiles[idx]! });
        }
      }
    }
    let freeInputEl: HTMLInputElement | null = null;
    let spotBugFound = Boolean(currentDraft.spotBugFound);
    let spotSelectedFix: string | null = currentDraft.spotSelectedFix ?? null;
    let spotWrongTaps = typeof currentDraft.spotWrongTaps === 'number' ? currentDraft.spotWrongTaps : 0;
    const spotSafeSet = new Set<number>(
      Array.isArray(currentDraft.spotSafeIndices) ? currentDraft.spotSafeIndices : []
    );
    let locked = false;

    const footerBar = document.createElement('div');
    footerBar.className = 'duo-lesson-footer';

    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'duo-btn-secondary';
    skipBtn.textContent = isTr ? 'Geç' : 'Skip';

    const checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.className = 'duo-btn-check';
    checkBtn.textContent = isTr ? 'Kontrol Et' : 'Check';
    checkBtn.disabled = true;

    const updateCheckEnabled = (): void => {
      if (locked) {
        checkBtn.disabled = true;
        return;
      }
      if (
        ex.kind === 'contrast_duel' ||
        ex.kind === 'scenario_pick' ||
        ex.kind === 'vocab_recall' ||
        ex.kind === 'cloze_blank'
      ) {
        checkBtn.disabled = !selectedChoice;
      } else if (ex.kind === 'spot_fix') {
        checkBtn.disabled = !(spotBugFound && spotSelectedFix);
      } else if (ex.kind === 'word_bank') {
        checkBtn.disabled = placedTiles.length === 0;
      } else {
        checkBtn.disabled = !(freeInputEl?.value.trim().length);
      }
    };

    // ==================== EXERCISE FORMAT RENDERERS ====================
    if (ex.kind === 'contrast_duel') {
      const promptCard = document.createElement('div');
      promptCard.className = 'duo-ex-prompt-card rem-duel-prompt';
      const pText = document.createElement('div');
      pText.className = 'duo-ex-prompt-text';
      pText.dataset.wordLang = 'en';
      const parts = ex.promptText.split('___');
      if (parts.length === 2) {
        pText.append(document.createTextNode(parts[0]!));
        const blankSpan = document.createElement('span');
        blankSpan.className = 'rem-duel-blank';
        blankSpan.textContent = selectedChoice || '  ?  ';
        pText.append(blankSpan, document.createTextNode(parts[1]!));
      } else {
        pText.textContent = ex.promptText;
      }
      promptCard.appendChild(pText);

      if (ex.promptSubtext) {
        const sub = document.createElement('div');
        sub.className = 'rem-prompt-sub-plain is-meaning-cue';
        sub.dataset.wordLang = 'tr';
        sub.textContent = ex.promptSubtext;
        promptCard.appendChild(sub);
      }
      stage.appendChild(promptCard);

      const duelGrid = document.createElement('div');
      duelGrid.className = 'rem-duel-grid';
      const btns: HTMLButtonElement[] = [];

      for (let i = 0; i < (ex.choices?.length ?? 0); i += 1) {
        const ch = ex.choices![i]!;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.choiceVal = ch;
        btn.dataset.wordLang = 'en';
        btn.className = `duo-choice-card rem-duel-btn ${selectedChoice === ch ? 'selected' : ''}`;
        btn.innerHTML = `<span class="duo-choice-key">${i + 1}</span><span class="rem-duel-val"></span>`;
        btn.querySelector('.rem-duel-val')!.textContent = ch;
        btn.addEventListener('click', () => {
          if (locked) return;
          selectedChoice = ch;
          currentDraft.selectedChoice = ch;
          playTapSfx();
          btns.forEach((b) => b.classList.toggle('selected', b === btn));
          const blankEl = promptCard.querySelector('.rem-duel-blank');
          if (blankEl) blankEl.textContent = ch;
          speakEnglish(ch, DEFAULT_ENGLISH_TTS_RATE, { isQuickTile: ch.trim().split(/\s+/).length <= 3 });
          updateCheckEnabled();
          persistLesson(false);
        });
        btns.push(btn);
        duelGrid.appendChild(btn);
      }
      stage.appendChild(duelGrid);

      activeKeyHandler = (e: KeyboardEvent) => {
        if (!sessionEl.isConnected) {
          detachKeys();
          return;
        }
        if (locked || sessionEl.querySelector('.ait-overlay')) return;
        const num = Number(e.key);
        if (num >= 1 && num <= btns.length) {
          e.preventDefault();
          btns[num - 1]!.click();
        } else if (e.key === 'Enter' && !checkBtn.disabled) {
          e.preventDefault();
          checkBtn.click();
        }
      };
      document.addEventListener('keydown', activeKeyHandler);
    } else if (ex.kind === 'spot_fix' && ex.buggyTokens && typeof ex.buggyTokenIndex === 'number') {
      const buggyTok = ex.buggyTokens[ex.buggyTokenIndex] ?? '';

      // Editorial proofreader card (visually distinct from Word Bank tiles)
      const proofCard = document.createElement('div');
      proofCard.className = 'rem-proofread-card';

      const stepper = document.createElement('div');
      stepper.className = 'rem-spot-stepper';

      const step1Pill = document.createElement('span');
      step1Pill.className = 'rem-spot-step';
      const stepArrow = document.createElement('span');
      stepArrow.className = 'rem-spot-step-sep';
      stepArrow.textContent = '›';
      const step2Pill = document.createElement('span');
      step2Pill.className = 'rem-spot-step';
      stepper.append(step1Pill, stepArrow, step2Pill);

      const syncStepper = (): void => {
        if (!spotBugFound) {
          step1Pill.className = 'rem-spot-step is-active is-step1-hero';
          setIconLabel(
            step1Pill,
            'edit',
            isTr ? '1. Hatalı kelimeyi işaretle' : '1. Tap the wrong word',
            12
          );
          step2Pill.className = 'rem-spot-step';
          step2Pill.textContent = isTr ? '2. Doğrusunu seç' : '2. Choose fix';
        } else if (!spotSelectedFix) {
          step1Pill.className = 'rem-spot-step is-done';
          step1Pill.textContent = `✓ "${buggyTok}"`;
          step2Pill.className = 'rem-spot-step is-active is-step2-hero';
          step2Pill.textContent = isTr ? '2. Doğrusunu seç' : '2. Choose fix';
        } else {
          step1Pill.className = 'rem-spot-step is-done';
          step1Pill.textContent = `✓ "${buggyTok}"`;
          step2Pill.className = 'rem-spot-step is-done';
          step2Pill.textContent = `✓ "${spotSelectedFix}"`;
        }
      };

      const sentenceBox = document.createElement('div');
      sentenceBox.className = `rem-bug-sentence ${spotBugFound ? 'is-resolved-step1' : ''}`;
      sentenceBox.dataset.wordLang = 'en';

      const meaningRow = document.createElement('div');
      meaningRow.className = 'rem-proofread-meaning';
      meaningRow.dataset.wordLang = 'tr';
      if (ex.promptSubtext) {
        const langPill = document.createElement('span');
        langPill.className = 'rem-proofread-lang';
        langPill.textContent = 'TR';
        const meaningText = document.createElement('span');
        meaningText.className = 'rem-proofread-meaning-text';
        meaningText.textContent = ex.promptSubtext;
        meaningRow.append(langPill, meaningText);
      }

      proofCard.append(stepper, sentenceBox);
      if (ex.promptSubtext) {
        proofCard.appendChild(meaningRow);
      }

      const feedbackMini = document.createElement('div');
      feedbackMini.className = 'rem-spot-status';
      feedbackMini.hidden = true;

      const fixWrap = document.createElement('div');
      fixWrap.className = 'rem-fix-wrap';
      fixWrap.hidden = !spotBugFound;

      const fixLabel = document.createElement('div');
      fixLabel.className = 'rem-fix-label';
      const errChip = document.createElement('span');
      errChip.className = 'rem-fix-err-chip';
      errChip.textContent = buggyTok;
      if (isTr) {
        fixLabel.append(errChip, document.createTextNode(' yerine hangisi gelmeli?'));
      } else {
        fixLabel.append(document.createTextNode('Replace '), errChip, document.createTextNode(' with:'));
      }

      const fixRow = document.createElement('div');
      fixRow.className = 'rem-fix-row';
      fixRow.dataset.wordLang = 'en';
      fixWrap.append(fixLabel, fixRow);

      const renderTokenDiff = (btn: HTMLButtonElement, original: string, replacement: string | null): void => {
        btn.replaceChildren();
        if (replacement) {
          const oldSpan = document.createElement('span');
          oldSpan.className = 'rem-bug-old';
          oldSpan.textContent = original;
          const newSpan = document.createElement('span');
          newSpan.className = 'rem-bug-new';
          newSpan.textContent = replacement;
          btn.append(oldSpan, newSpan);
          btn.classList.add('is-patched');
        } else {
          const lbl = document.createElement('span');
          lbl.className = 'rem-bug-token-label';
          lbl.textContent = original;
          btn.appendChild(lbl);
          btn.classList.remove('is-patched');
        }
      };

      const tokenBtns: HTMLButtonElement[] = [];
      for (let i = 0; i < ex.buggyTokens.length; i += 1) {
        const tok = ex.buggyTokens[i]!;
        const tBtn = document.createElement('button');
        tBtn.type = 'button';
        tBtn.className = 'rem-bug-token';
        tBtn.style.setProperty('--tok-i', String(i));
        const tokLabel = document.createElement('span');
        tokLabel.className = 'rem-bug-token-label';
        tokLabel.textContent = tok;
        tBtn.appendChild(tokLabel);
        if (spotSafeSet.has(i)) {
          tBtn.classList.add('is-safe-word');
        }
        if (i === ex.buggyTokenIndex) {
          if (spotBugFound) {
            tBtn.classList.add('is-bug-found');
            if (spotSelectedFix) {
              renderTokenDiff(tBtn, tok, spotSelectedFix);
            }
          } else if (spotWrongTaps >= 2) {
            tBtn.classList.add('is-nudge-hint');
          }
        }
        tBtn.addEventListener('click', () => {
          if (locked || spotBugFound) return;
          if (i === ex.buggyTokenIndex) {
            playTapSfx();
            spotBugFound = true;
            currentDraft.spotBugFound = true;
            tBtn.classList.remove('is-nudge-hint');
            tBtn.classList.add('is-bug-found');
            sentenceBox.classList.add('is-resolved-step1');
            feedbackMini.hidden = true;
            fixWrap.hidden = false;
            syncStepper();
            updateCheckEnabled();
            persistLesson(false);
          } else {
            spotWrongTaps += 1;
            spotSafeSet.add(i);
            currentDraft.spotWrongTaps = spotWrongTaps;
            currentDraft.spotSafeIndices = [...spotSafeSet];
            tBtn.classList.add('is-safe-word');
            feedbackMini.hidden = false;
            feedbackMini.className = 'rem-spot-status is-miss';
            feedbackMini.textContent = isTr
              ? `"${tok}" doğru kullanılmış — başka bir kelimeyi incele.`
              : `"${tok}" is correct here — check another word.`;
            if (spotWrongTaps >= 2) {
              tokenBtns[ex.buggyTokenIndex!]?.classList.add('is-nudge-hint');
            }
            persistLesson(false);
          }
        });
        tokenBtns.push(tBtn);
        sentenceBox.appendChild(tBtn);
      }

      const fixBtns: HTMLButtonElement[] = [];
      const fixChoices = ex.fixChoices ?? [];
      for (let idx = 0; idx < fixChoices.length; idx += 1) {
        const fChoice = fixChoices[idx]!;
        const fBtn = document.createElement('button');
        fBtn.type = 'button';
        fBtn.dataset.choiceVal = fChoice;
        fBtn.className = `duo-choice-card rem-fix-btn ${spotSelectedFix === fChoice ? 'selected' : ''}`;
        const keyBadge = document.createElement('span');
        keyBadge.className = 'duo-choice-key';
        keyBadge.textContent = String(idx + 1);
        const valSpan = document.createElement('span');
        valSpan.className = 'rem-fix-val';
        valSpan.textContent = fChoice;
        fBtn.append(keyBadge, valSpan);
        fBtn.addEventListener('click', () => {
          if (locked) return;
          spotSelectedFix = fChoice;
          currentDraft.spotSelectedFix = fChoice;
          fixBtns.forEach((b) => b.classList.toggle('selected', b === fBtn));
          const targetTokBtn = tokenBtns[ex.buggyTokenIndex!];
          if (targetTokBtn) {
            renderTokenDiff(targetTokBtn, buggyTok, fChoice);
          }
          speakEnglish(fChoice, DEFAULT_ENGLISH_TTS_RATE, { isQuickTile: fChoice.trim().split(/\s+/).length <= 3 });
          syncStepper();
          updateCheckEnabled();
          persistLesson(false);
        });
        fixBtns.push(fBtn);
        fixRow.appendChild(fBtn);
      }

      syncStepper();
      stage.append(proofCard, feedbackMini, fixWrap);

      activeKeyHandler = (e: KeyboardEvent) => {
        if (!sessionEl.isConnected) {
          detachKeys();
          return;
        }
        if (locked || !spotBugFound || sessionEl.querySelector('.ait-overlay')) return;
        const num = Number(e.key);
        if (num >= 1 && num <= fixBtns.length) {
          e.preventDefault();
          fixBtns[num - 1]!.click();
        } else if (e.key === 'Enter' && !checkBtn.disabled) {
          e.preventDefault();
          checkBtn.click();
        }
      };
      document.addEventListener('keydown', activeKeyHandler);
    } else if (ex.kind === 'scenario_pick') {
      const scenBox = document.createElement('div');
      scenBox.className = 'rem-scenario-box';
      scenBox.dataset.wordLang = isTr ? 'tr' : 'en';
      const scenEyebrow = document.createElement('div');
      scenEyebrow.className = 'rem-scenario-eyebrow';
      scenEyebrow.textContent = isTr ? 'DURUM' : 'SITUATION';
      const scenText = document.createElement('div');
      scenText.className = 'rem-scenario-text';
      scenText.textContent = isTr ? ex.promptText : ex.promptSubtext || ex.promptText;
      scenBox.append(scenEyebrow, scenText);
      stage.appendChild(scenBox);

      const list = document.createElement('div');
      list.className = 'rem-scenario-choices';
      const btns: HTMLButtonElement[] = [];

      for (let i = 0; i < (ex.choices?.length ?? 0); i += 1) {
        const ch = ex.choices![i]!;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.choiceVal = ch;
        btn.dataset.wordLang = 'en';
        btn.className = `duo-choice-card rem-scenario-btn ${selectedChoice === ch ? 'selected' : ''}`;
        btn.innerHTML = `<span class="duo-choice-key">${i + 1}</span><span class="rem-scen-val"></span>`;
        btn.querySelector('.rem-scen-val')!.textContent = ch;
        btn.addEventListener('click', () => {
          if (locked) return;
          selectedChoice = ch;
          currentDraft.selectedChoice = ch;
          playTapSfx();
          btns.forEach((b) => b.classList.toggle('selected', b === btn));
          speakEnglish(ch);
          updateCheckEnabled();
          persistLesson(false);
        });
        btns.push(btn);
        list.appendChild(btn);
      }
      stage.appendChild(list);

      activeKeyHandler = (e: KeyboardEvent) => {
        if (!sessionEl.isConnected) {
          detachKeys();
          return;
        }
        if (locked || sessionEl.querySelector('.ait-overlay')) return;
        const num = Number(e.key);
        if (num >= 1 && num <= btns.length) {
          e.preventDefault();
          btns[num - 1]!.click();
        } else if (e.key === 'Enter' && !checkBtn.disabled) {
          e.preventDefault();
          checkBtn.click();
        }
      };
      document.addEventListener('keydown', activeKeyHandler);
    } else if (ex.kind === 'cloze_blank' || ex.kind === 'vocab_recall') {
      const promptCard = document.createElement('div');
      promptCard.className = 'duo-ex-prompt-card';
      const promptMain = document.createElement('div');
      promptMain.className = 'duo-ex-prompt-main';
      if (ex.kind === 'vocab_recall' && ex.audioText) {
        const spk = document.createElement('button');
        spk.type = 'button';
        spk.className = 'duo-audio-mini-btn';
        setIconOnly(spk, 'volume', 14);
        spk.title = isTr ? 'Telaffuzu dinle' : 'Listen';
        spk.addEventListener('click', () => speakEnglish(ex.card.en));
        promptMain.appendChild(spk);
      }
      const pText = document.createElement('div');
      pText.className = 'duo-ex-prompt-text';
      pText.dataset.wordLang = ex.direction === 'tr-to-en' ? 'tr' : 'en';
      pText.textContent = ex.promptText;
      promptMain.appendChild(pText);
      promptCard.appendChild(promptMain);
      if (ex.promptSubtext) {
        const sub = document.createElement('div');
        sub.className = `rem-prompt-sub-plain${ex.kind === 'cloze_blank' ? ' is-meaning-cue' : ''}`;
        sub.dataset.wordLang = 'tr';
        sub.textContent = ex.promptSubtext;
        promptCard.appendChild(sub);
      }
      stage.appendChild(promptCard);

      const grid = document.createElement('div');
      grid.className = 'duo-choices-grid';
      const choicesAreEnglish = ex.kind === 'cloze_blank' || ex.direction === 'tr-to-en';
      const btns: HTMLButtonElement[] = [];
      for (let i = 0; i < (ex.choices?.length ?? 0); i += 1) {
        const ch = ex.choices![i]!;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.choiceVal = ch;
        btn.dataset.wordLang = choicesAreEnglish ? 'en' : 'tr';
        btn.className = `duo-choice-card ${selectedChoice === ch ? 'selected' : ''}`;
        btn.innerHTML = `<span class="duo-choice-key">${i + 1}</span><span class="duo-choice-val"></span>`;
        btn.querySelector('.duo-choice-val')!.textContent = ch;
        btn.addEventListener('click', () => {
          if (locked) return;
          selectedChoice = ch;
          currentDraft.selectedChoice = ch;
          playTapSfx();
          btns.forEach((b) => b.classList.toggle('selected', b === btn));
          if (ex.kind === 'cloze_blank' || ex.direction === 'tr-to-en') {
            speakEnglish(ch, DEFAULT_ENGLISH_TTS_RATE, { isQuickTile: ch.trim().split(/\s+/).length <= 3 });
          }
          updateCheckEnabled();
          persistLesson(false);
        });
        btns.push(btn);
        grid.appendChild(btn);
      }
      stage.appendChild(grid);

      activeKeyHandler = (e: KeyboardEvent) => {
        if (!sessionEl.isConnected) {
          detachKeys();
          return;
        }
        if (locked || sessionEl.querySelector('.ait-overlay')) return;
        const num = Number(e.key);
        if (num >= 1 && num <= btns.length) {
          e.preventDefault();
          btns[num - 1]!.click();
        } else if (e.key === 'Enter' && !checkBtn.disabled) {
          e.preventDefault();
          checkBtn.click();
        }
      };
      document.addEventListener('keydown', activeKeyHandler);
    } else if (ex.kind === 'word_bank') {
      const promptCard = document.createElement('div');
      promptCard.className = 'duo-ex-prompt-card';
      const pText = document.createElement('div');
      pText.className = 'duo-ex-prompt-text';
      pText.dataset.wordLang = ex.direction === 'en-to-tr' ? 'en' : 'tr';
      pText.textContent = ex.promptText;
      promptCard.appendChild(pText);
      stage.appendChild(promptCard);

      const answerTray = document.createElement('div');
      answerTray.className = 'duo-wb-answer-tray';
      answerTray.dataset.wordLang = ex.direction === 'en-to-tr' ? 'tr' : 'en';
      answerTray.dataset.placeholder = isTr
        ? 'Kelimeleri seçerek veya sürükleyerek cümleyi buraya kur…'
        : 'Click or drag words here to build the sentence…';
      const bankTray = document.createElement('div');
      bankTray.className = 'duo-wb-bank-tray';
      bankTray.dataset.wordLang = ex.direction === 'en-to-tr' ? 'tr' : 'en';

      const commitPlacedTilesChange = (): void => {
        currentDraft.placedTileIndices = placedTiles.map((p) => p.bankIdx);
        renderTrays();
        updateCheckEnabled();
        persistLesson(false);
      };

      const renderTrays = (): void => {
        answerTray.replaceChildren();
        bankTray.replaceChildren();

        for (let i = 0; i < placedTiles.length; i += 1) {
          const item = placedTiles[i]!;
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'duo-wb-tile placed';
          chip.textContent = item.text;
          chip.setAttribute(
            'aria-label',
            isTr
              ? `${item.text} — geri koymak için tıkla veya sürükleyip yerini değiştir`
              : `${item.text} — click to put back or drag to reorder`
          );
          attachWordBankTileGesture({
            chip,
            word: item.text,
            source: 'answer',
            answerTray,
            bankTray,
            isLocked: () => locked,
            onTap: () => {
              playTapSfx();
              placedTiles.splice(i, 1);
              commitPlacedTilesChange();
            },
            onDropIntoAnswer: (insertIndex) => {
              const [moved] = placedTiles.splice(i, 1);
              if (moved) {
                const clamped = Math.max(0, Math.min(placedTiles.length, insertIndex));
                placedTiles.splice(clamped, 0, moved);
                commitPlacedTilesChange();
              }
            },
            onDropBackToBank: () => {
              placedTiles.splice(i, 1);
              commitPlacedTilesChange();
            },
          });
          answerTray.appendChild(chip);
        }

        const usedIndices = new Set(placedTiles.map((p) => p.bankIdx));
        const tiles = ex.wordBankTiles ?? [];
        for (let i = 0; i < tiles.length; i += 1) {
          const tok = tiles[i]!;
          const used = usedIndices.has(i);
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = `duo-wb-tile ${used ? 'ghost' : ''}`;
          chip.disabled = used;
          const lbl = document.createElement('span');
          lbl.className = 'duo-wb-ghost-label';
          lbl.textContent = tok;
          chip.appendChild(lbl);
          if (!used) {
            chip.setAttribute(
              'aria-label',
              isTr
                ? `${tok} — eklemek için tıkla veya istediğin aralığa sürükle`
                : `${tok} — click to add or drag into any position`
            );
            attachWordBankTileGesture({
              chip,
              word: tok,
              source: 'bank',
              answerTray,
              bankTray,
              isLocked: () => locked,
              onTap: () => {
                speakEnglish(tok, DEFAULT_ENGLISH_TTS_RATE, { isQuickTile: true });
                placedTiles.push({ bankIdx: i, text: tok });
                commitPlacedTilesChange();
              },
              onDropIntoAnswer: (insertIndex) => {
                speakEnglish(tok, DEFAULT_ENGLISH_TTS_RATE, { isQuickTile: true });
                const clamped = Math.max(0, Math.min(placedTiles.length, insertIndex));
                placedTiles.splice(clamped, 0, { bankIdx: i, text: tok });
                commitPlacedTilesChange();
              },
            });
          }
          bankTray.appendChild(chip);
        }
      };

      renderTrays();
      stage.append(answerTray, bankTray);
    } else {
      // free_translation boss challenge
      const promptCard = document.createElement('div');
      promptCard.className = 'duo-ex-prompt-card';
      const pText = document.createElement('div');
      pText.className = 'duo-ex-prompt-text';
      pText.dataset.wordLang = ex.direction === 'en-to-tr' ? 'en' : 'tr';
      pText.textContent = ex.promptText;
      promptCard.appendChild(pText);
      if (ex.promptSubtext) {
        const sub = document.createElement('div');
        sub.className = 'rem-prompt-sub-plain';
        sub.dataset.wordLang = 'tr';
        sub.textContent = ex.promptSubtext;
        promptCard.appendChild(sub);
      }
      stage.appendChild(promptCard);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'duo-free-input';
      input.placeholder = isTr ? 'İngilizce çevirini yaz...' : 'Type your English translation...';
      input.autocomplete = 'off';
      input.spellcheck = false;
      if (currentDraft.typedText) {
        input.value = currentDraft.typedText;
      }
      input.addEventListener('input', () => {
        currentDraft.typedText = input.value;
        updateCheckEnabled();
        persistLesson(false);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !checkBtn.disabled && !locked) {
          e.preventDefault();
          checkBtn.click();
        }
      });
      freeInputEl = input;
      stage.appendChild(input);
      if (!currentCheckedState && !currentTutorOpen) {
        setTimeout(() => input.focus(), 20);
      }
    }

    // Inline iridescent AI soundwave voice explanation directly below the question
    if (hasQuestionVoiceover && ex.questionAudioId && ex.questionVoiceScriptTr) {
      activeQuestionPlayer = createQuestionVoiceCard({
        questionAudioId: ex.questionAudioId,
        scriptTr: ex.questionVoiceScriptTr,
        isTr,
      });
      stage.appendChild(activeQuestionPlayer.element);
    }

    sessionEl.appendChild(stage);
    updateCheckEnabled();

    // ==================== SHARED FEEDBACK FOOTER RENDERER ====================
    const renderCheckedFooter = (snap: CheckedFeedbackSnapshot): void => {
      locked = true;
      detachKeys();
      skipBtn.disabled = true;
      checkBtn.disabled = true;
      if (freeInputEl) freeInputEl.disabled = true;
      refreshRemCounter(true);

      const effectiveCorrect = snap.isCorrect || Boolean(snap.overridden);
      const expectedChoiceNorm = (
        ex.kind === 'spot_fix' ? ex.correctFixToken ?? '' : ex.correctChoice ?? ''
      )
        .trim()
        .toLowerCase();
      const chosenNorm = (snap.userAnswer ?? '').trim().toLowerCase();
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
      for (const tile of stage.querySelectorAll<HTMLButtonElement>('.duo-wb-tile.placed')) {
        tile.classList.remove('is-result-correct', 'is-result-wrong');
        tile.classList.add(effectiveCorrect ? 'is-result-correct' : 'is-result-wrong');
      }

      footerBar.className = `duo-lesson-footer ${effectiveCorrect ? 'is-correct' : 'is-wrong'}`;
      footerBar.replaceChildren();

      const fbText = document.createElement('div');
      fbText.className = 'duo-fb-text';

      const badgeRow = document.createElement('div');
      badgeRow.className = 'duo-fb-badges';
      const titleEl = document.createElement('span');
      titleEl.className = 'duo-fb-title';
      titleEl.textContent = snap.overridden
        ? isTr
          ? '✓ Doğru kabul edildi'
          : '✓ Marked correct'
        : effectiveCorrect
          ? isTr
            ? '✓ Harika! Doğru Cevap'
            : '✓ Spot On!'
          : isTr
            ? '✕ Tekrar Bakalım'
            : '✕ Let’s Review';
      badgeRow.appendChild(titleEl);

      if (snap.aiApproved) {
        const aiTag = document.createElement('span');
        aiTag.className = 'duo-fb-ai-tag';
        aiTag.textContent = isTr ? 'AI Onayı' : 'AI Approved';
        badgeRow.appendChild(aiTag);
      }
      fbText.appendChild(badgeRow);

      const solutionText =
        ex.correctedSentence ?? ex.correctChoice ?? ex.expectedAnswers[0] ?? '';
      let solRow: HTMLDivElement | null = null;
      if (!effectiveCorrect && solutionText) {
        solRow = document.createElement('div');
        solRow.className = 'duo-fb-solution';
        solRow.append(document.createTextNode(isTr ? 'Doğrusu: ' : 'Solution: '));
        const strong = document.createElement('strong');
        strong.dataset.wordLang =
          ex.kind === 'vocab_recall' && ex.direction === 'en-to-tr' ? 'tr' : 'en';
        strong.textContent = solutionText;
        solRow.appendChild(strong);
        fbText.appendChild(solRow);
      }

      if (snap.explanationNote && (!hasQuestionVoiceover || effectiveCorrect)) {
        const noteEl = document.createElement('div');
        noteEl.className = 'duo-fb-note';
        noteEl.textContent = snap.explanationNote;
        fbText.appendChild(noteEl);
      }

      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'duo-fb-actions';

      if (ex.audioText) {
        const spk = document.createElement('button');
        spk.type = 'button';
        spk.className = 'duo-audio-mini-btn';
        setIconOnly(spk, 'volume', 14);
        spk.title = isTr ? 'İngilizce cümleyi dinle' : 'Listen';
        spk.addEventListener('click', () => speakEnglish(ex.audioText));
        actionsWrap.appendChild(spk);
      }

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = `duo-btn-continue ${effectiveCorrect ? 'ok' : 'err'}`;
      nextBtn.textContent = isTr ? 'Devam Et' : 'Continue';
      nextBtn.addEventListener('click', () => {
        currentIdx += 1;
        currentDraft = {};
        currentCheckedState = undefined;
        currentTutorOpen = false;
        currentTutorHistory = [];
        currentTutorDraft = '';
        if (currentIdx >= queue.length) {
          persistLesson(true);
          void finishRemedialSession();
        } else {
          renderExercise();
        }
      });
      actionsWrap.appendChild(nextBtn);

      footerBar.append(fbText, actionsWrap);
      if (!currentTutorOpen) {
        nextBtn.focus();
      }
    };

    // ==================== EVALUATION LOGIC ====================
    const evaluateCurrent = async (skipped: boolean): Promise<void> => {
      if (locked) return;
      locked = true;
      detachKeys();
      skipBtn.disabled = true;
      checkBtn.disabled = true;
      if (freeInputEl) freeInputEl.disabled = true;

      let isCorrect = false;
      let aiApproved = false;
      let extraNote = isTr ? ex.explanationTr : ex.explanationEn;

      if (!skipped) {
        if (
          ex.kind === 'contrast_duel' ||
          ex.kind === 'scenario_pick' ||
          ex.kind === 'vocab_recall' ||
          ex.kind === 'cloze_blank'
        ) {
          isCorrect =
            (selectedChoice ?? '').trim().toLowerCase() ===
            (ex.correctChoice ?? '').trim().toLowerCase();
        } else if (ex.kind === 'spot_fix') {
          isCorrect =
            spotBugFound &&
            (spotSelectedFix ?? '').trim().toLowerCase() ===
              (ex.correctFixToken ?? '').trim().toLowerCase();
        } else if (ex.kind === 'word_bank') {
          const built = placedTiles.map((p) => p.text).join(' ').trim();
          const res = evaluateEnglishAnswer(built, ex.expectedAnswers, ex.card.type);
          isCorrect = res.isCorrect;
        } else {
          const typed = freeInputEl?.value.trim() ?? '';
          const localRes =
            ex.direction === 'tr-to-en'
              ? evaluateEnglishAnswer(typed, ex.expectedAnswers, ex.card.type)
              : evaluateTurkishAnswer(typed, ex.expectedAnswers, ex.card.type);
          isCorrect = localRes.isCorrect;

          if (!isCorrect && ctx.aiActive && typed.length > 0) {
            checkBtn.textContent = isTr ? 'AI Kontrol Ediyor...' : 'AI Checking...';
            try {
              const aiResp = (await chrome.runtime.sendMessage({
                type: 'EVALUATE_ROADMAP_EXERCISE',
                card: ex.card,
                direction: ex.direction,
                kind: 'free_translation',
                promptText: ex.promptText,
                expectedAnswers: ex.expectedAnswers,
                userAnswer: typed,
                localCorrect: false,
                localScore: localRes.similarity,
                recordProgress: false,
              } satisfies ExtensionMessage)) as { ok?: boolean; result?: AnswerOutcomeResult };
              if (aiResp?.ok && aiResp.result?.evaluation) {
                isCorrect = aiResp.result.evaluation.isCorrect;
                if (isCorrect) aiApproved = true;
                if (aiResp.result.evaluation.aiNote) {
                  extraNote = aiResp.result.evaluation.aiNote;
                }
              }
            } catch {
              // Keep local result if AI call fails
            }
          }
        }
      }

      const retryId = `${ex.id}_retry_${currentIdx}`;
      if (isCorrect) {
        if (!ex.isRetryRequeue) firstTryCorrect += 1;
        combo += 1;
        if (combo > maxCombo) maxCombo = combo;
      } else {
        combo = 0;
        queue.push({ ...ex, id: retryId, isRetryRequeue: true });
      }

      const userAnswerText = skipped
        ? '(skipped)'
        : ex.kind === 'spot_fix'
          ? spotSelectedFix ?? ''
          : ex.kind === 'word_bank'
            ? placedTiles.map((p) => p.text).join(' ').trim()
            : ex.kind === 'free_translation'
              ? freeInputEl?.value.trim() ?? ''
              : selectedChoice ?? '';

      const snap: CheckedFeedbackSnapshot = {
        isCorrect,
        skipped,
        userAnswer: userAnswerText,
        explanationNote: extraNote,
        aiApproved,
        retryId: isCorrect ? undefined : retryId,
        overridden: false,
      };
      currentCheckedState = snap;
      if (isCorrect) {
        playCorrectSfx();
      } else {
        playWrongSfx();
      }
      persistLesson(false);
      renderCheckedFooter(snap);

      // In Remedial Studio, if the learner chose a wrong answer without listening first,
      // automatically play the dedicated voice explanation so the rule sinks in right away.
      if (!skipped && !isCorrect && activeQuestionPlayer && !activeQuestionPlayer.wasPlayedManually()) {
        activeQuestionPlayer.playAutoOnWrong();
      }
    };

    skipBtn.addEventListener('click', () => void evaluateCurrent(true));
    checkBtn.addEventListener('click', () => void evaluateCurrent(false));
    footerBar.append(skipBtn, checkBtn);
    sessionEl.appendChild(footerBar);

    if (currentCheckedState) {
      renderCheckedFooter(currentCheckedState);
    }
    if (currentTutorOpen) {
      openRemTutor();
    }
  };

  const finishRemedialSession = async (): Promise<void> => {
    detachKeys();
    disposeQuestionPlayer();
    cancelEnglishSpeech();
    await clearActiveRemedialSession();

    const accuracyPct = Math.round((firstTryCorrect / Math.max(1, totalInitial)) * 100);
    const xpEarned = 25 + (maxCombo >= 4 ? 5 : 0);
    const now = Date.now();

    // 1. Award XP into Roadmap state
    const curState = await getRoadmapState();
    await saveRoadmapState({
      ...curState,
      xp: curState.xp + xpEarned,
      dailyXp: curState.dailyXp + xpEarned,
    });

    // 2. Persist Remedial Mastery Record
    await recordRemedialCompletion(plan.skillId, accuracyPct, now);

    // 3. Advance related Concept Notes if accuracy >= 75%
    let conceptsAdvanced = 0;
    if (accuracyPct >= 75 && plan.relatedConceptIds.length > 0) {
      let cState = await getConceptState();
      const profile = await getSkillProfile();
      for (const cid of plan.relatedConceptIds) {
        const adv = advanceConceptAfterAnswer(
          cState,
          cid,
          `remedial_${plan.skillId}`,
          true,
          profile.totalAnswered,
          now
        );
        if (adv.updated) {
          cState = adv.nextState;
          conceptsAdvanced += 1;
        }
      }
      if (conceptsAdvanced > 0) {
        await saveConceptState(cState);
      }
    }

    const refreshedList = (await ctx.onXpUpdated?.()) ?? ctx.diagnosedWeaknesses;
    ctx.diagnosedWeaknesses = refreshedList;

    sessionEl.replaceChildren();
    const summary = document.createElement('div');
    summary.className = 'duo-lesson-complete rem-complete';

    const badge = document.createElement('div');
    badge.className = 'duo-complete-badge rem-complete-badge';
    badge.innerHTML = uiIconSvg(accuracyPct >= 80 ? 'award' : 'check', 28);

    const title = document.createElement('h2');
    title.className = 'duo-complete-title';
    title.textContent = isTr ? 'Özel Ders Tamamlandı!' : 'Special Workshop Complete!';

    const sub = document.createElement('p');
    sub.className = 'duo-complete-sub';
    const graduationNote =
      accuracyPct >= 80
        ? isTr
          ? ' Bu konu aktif eksikler listenden kapatıldı (yeni hata yapmadığın sürece tekrar çıkmaz).'
          : ' This topic has been cleared from your active weak-spot list.'
        : isTr
          ? ' %80 ve üzeri doğrulukla tamamladığında bu konu aktif eksikler listenden otomatik kapanır.'
          : ' Score 80%+ to automatically clear this topic from your active weak-spot list.';
    sub.textContent = isTr
      ? `"${plan.titleTr}" konusundaki eksiğini güçlendirdin.${graduationNote}${conceptsAdvanced > 0 ? ` (${conceptsAdvanced} AI kavram notu da ilerledi!)` : ''}`
      : `You sharpened "${plan.titleEn}".${graduationNote}${conceptsAdvanced > 0 ? ` (${conceptsAdvanced} tracked AI concepts advanced!)` : ''}`;

    const elapsedSec = Math.max(1, Math.round((Date.now() - lessonStartMs) / 1000));
    const elapsedFmt = `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`;
    playLessonCompleteSfx();

    const metrics = document.createElement('div');
    metrics.className = 'duo-complete-metrics';
    metrics.innerHTML = `
      <div class="duo-complete-stat is-gold">
        <span class="duo-cs-label">${isTr ? 'Kazanılan XP' : 'XP Earned'}</span>
        <span class="duo-cs-val rem-accent">+${xpEarned} XP</span>
      </div>
      <div class="duo-complete-stat is-green">
        <span class="duo-cs-label">${isTr ? 'Doğruluk' : 'Accuracy'}</span>
        <span class="duo-cs-val ok">${accuracyPct}%</span>
      </div>
      <div class="duo-complete-stat is-cobalt">
        <span class="duo-cs-label">${isTr ? 'Süre' : 'Time'}</span>
        <span class="duo-cs-val cobalt">${elapsedFmt}</span>
      </div>
    `;

    const btnRow = document.createElement('div');
    btnRow.className = 'rem-complete-actions';

    const nextWeak = ctx.diagnosedWeaknesses.find(
      (w) => w.skillId !== plan.skillId && (w.severity === 'critical' || w.severity === 'focus')
    );

    if (nextWeak) {
      const nextWeakBtn = document.createElement('button');
      nextWeakBtn.type = 'button';
      nextWeakBtn.className = 'duo-btn-check rem-start-btn';
      nextWeakBtn.textContent = isTr
        ? `Sonraki: ${nextWeak.titleTr.split('(')[0]!.trim()} →`
        : `Next: ${nextWeak.titleEn.split('(')[0]!.trim()} →`;
      nextWeakBtn.addEventListener('click', () => {
        const nextPlan = buildRemedialLessonPlan(
          nextWeak.skillId,
          nextWeak,
          ctx.allCards,
          ctx.progressMap,
          Date.now()
        );
        renderRemedialBriefing(ctx, nextPlan, nextWeak);
      });
      btnRow.appendChild(nextWeakBtn);
    }

    const backHubBtn = document.createElement('button');
    backHubBtn.type = 'button';
    backHubBtn.className = nextWeak ? 'duo-btn-secondary' : 'duo-btn-check rem-start-btn';
    backHubBtn.textContent = isTr ? 'Atölyeye Dön' : 'Back to Studio';
    backHubBtn.addEventListener('click', () => {
      void ctx.onRefreshDiagnosis();
    });
    btnRow.appendChild(backHubBtn);

    summary.append(badge, title, sub, metrics, btnRow);
    sessionEl.appendChild(summary);
  };

  if (resumedSession?.readyToFinish || currentIdx >= queue.length) {
    void finishRemedialSession();
  } else {
    renderExercise(
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
