import { getUnitById, type RoadmapState } from './curriculum.ts';
import { resolveSupportedLanguage } from './i18n.ts';
import {
  applyPlacementResultToRoadmap,
  buildPlacementTestQuestions,
  evaluatePlacementAnswers,
  formatLessonProgressCounter,
  getRecommendedRecallLevelsForPlacement,
  PLACEMENT_TIERS,
  type PlacementAnswerRecord,
  type PlacementEvaluationResult,
  type PlacementTierLevel,
} from './placementTest.ts';
import { cancelEnglishSpeech, speakEnglishText as speakEnglish } from './speech.ts';
import {
  getRoadmapState,
  getSettings,
  saveOnboardingState,
  saveRoadmapState,
  saveSettings,
} from './storage.ts';
import { stopActiveRuleAudio } from './teachMeDrawer.ts';
import type { Card, FeedbackLanguageMode } from './types.ts';

export interface PlacementTestViewOptions {
  container: HTMLElement;
  allCards: Card[];
  uiLanguage: FeedbackLanguageMode;
  /** Optional deterministic salt added to Date.now() so consecutive retakes pull fresh cards. */
  attemptSeedSalt?: number;
  onExit: () => void;
  onCompleted: (nextState: RoadmapState) => void;
}

const LEVEL_TITLES: Record<PlacementTierLevel, { tr: string; en: string }> = {
  A1: { tr: 'A1 · Başlangıç', en: 'A1 · Beginner' },
  A2: { tr: 'A2 · Temel', en: 'A2 · Elementary' },
  B1: { tr: 'B1 · Orta Seviye', en: 'B1 · Intermediate' },
  B2: { tr: 'B2 · Orta-Üstü', en: 'B2 · Upper-Intermediate' },
  C1: { tr: 'C1 · İleri Seviye', en: 'C1 · Advanced' },
};

/**
 * Mount and run the 15-question progressive CEFR Placement Test ("Gerçek Seviyemi Belirle").
 * Answers are never re-queued so the test stays concise (~1.5–2 min), then additively unlocks
 * all earned Roadmap units and lets the user jump directly to their detected unit.
 */
export function startPlacementTestSession(options: PlacementTestViewOptions): void {
  const { container, allCards, uiLanguage, attemptSeedSalt = 0, onExit, onCompleted } = options;
  const isTr = resolveSupportedLanguage(uiLanguage) === 'tr';

  const questions = buildPlacementTestQuestions(allCards, Date.now() + attemptSeedSalt);
  if (questions.length === 0) {
    onExit();
    return;
  }

  let currentIdx = 0;
  const answers: PlacementAnswerRecord[] = [];
  let activeKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  const detachKeys = (): void => {
    if (activeKeyHandler) {
      document.removeEventListener('keydown', activeKeyHandler);
      activeKeyHandler = null;
    }
  };

  container.replaceChildren();
  const sessionEl = document.createElement('div');
  sessionEl.className = 'duo-lesson-session';
  container.appendChild(sessionEl);

  const renderResultView = async (evaluation: PlacementEvaluationResult): Promise<void> => {
    detachKeys();
    cancelEnglishSpeech();
    stopActiveRuleAudio();

    const [currentRoadmap, currentSettings] = await Promise.all([
      getRoadmapState(),
      getSettings(),
    ]);
    const applied = applyPlacementResultToRoadmap(currentRoadmap, evaluation, Date.now());
    const savedState = await saveRoadmapState(applied.nextState);
    const targetUnit = getUnitById(evaluation.targetUnitId);

    const recommendedLevels = getRecommendedRecallLevelsForPlacement(evaluation.placedLevel);
    const currentLevelsSorted = [...currentSettings.levels].sort().join(',');
    const recommendedSorted = [...recommendedLevels].sort().join(',');
    const shouldOfferRecallSync = currentLevelsSorted !== recommendedSorted;

    sessionEl.replaceChildren();

    const wrap = document.createElement('div');
    wrap.className = 'duo-lesson-complete duo-placement-result';

    const badge = document.createElement('div');
    badge.className = 'duo-complete-badge duo-placement-lvl-badge';
    badge.textContent = evaluation.placedLevel;

    const title = document.createElement('h2');
    title.className = 'duo-complete-title';
    const levelLabel = isTr
      ? LEVEL_TITLES[evaluation.placedLevel].tr
      : LEVEL_TITLES[evaluation.placedLevel].en;
    title.textContent = isTr
      ? `Seviyen: ${levelLabel}`
      : `Your Level: ${levelLabel}`;

    const sub = document.createElement('p');
    sub.className = 'duo-complete-sub';
    const unitTitle = isTr ? targetUnit.titleTr : targetUnit.titleEn;
    if (applied.preservedHigherLevel && savedState.placementResult) {
      sub.textContent = isTr
        ? `Bu denemedeki skorun ${evaluation.placedLevel}; ancak daha önce ulaştığın ${savedState.placementResult.level} seviyen ve açık ünitelerin korundu.`
        : `This attempt scored ${evaluation.placedLevel}; your previously proven ${savedState.placementResult.level} level and unlocked units remain protected.`;
    } else {
      sub.textContent = isTr
        ? evaluation.targetUnitNumber > 1
          ? `Ünite 1 → Ünite ${evaluation.targetUnitNumber} arası (${evaluation.unlockedUnitIds.length} ünite) açıldı. Başlangıç üniten: #${evaluation.targetUnitNumber} ${unitTitle}.`
          : `Temelden sağlam başlaman için Ünite 1 (${unitTitle}) hazır.`
        : evaluation.targetUnitNumber > 1
          ? `Unlocked Units 1 → ${evaluation.targetUnitNumber} (${evaluation.unlockedUnitIds.length} units). Starting unit: #${evaluation.targetUnitNumber} ${unitTitle}.`
          : `Unit 1 (${unitTitle}) is ready so you build a strong foundation.`;
    }

    const metrics = document.createElement('div');
    metrics.className = 'duo-complete-metrics';

    const scoreStat = document.createElement('div');
    scoreStat.className = 'duo-complete-stat';
    scoreStat.innerHTML = `
      <span class="duo-cs-label">${isTr ? 'Skor' : 'Score'}</span>
      <span class="duo-cs-val ok">${evaluation.totalCorrect} / ${evaluation.totalQuestions}</span>
    `;

    const unlockStat = document.createElement('div');
    unlockStat.className = 'duo-complete-stat';
    unlockStat.innerHTML = `
      <span class="duo-cs-label">${isTr ? 'Açık Ünite' : 'Unlocked'}</span>
      <span class="duo-cs-val accent">${savedState.unlockedUnitIds.length} / 20</span>
    `;
    metrics.append(scoreStat, unlockStat);

    if (applied.xpEarned > 0) {
      const xpStat = document.createElement('div');
      xpStat.className = 'duo-complete-stat';
      xpStat.innerHTML = `
        <span class="duo-cs-label">${isTr ? 'Ödül' : 'Bonus'}</span>
        <span class="duo-cs-val accent">+${applied.xpEarned} XP</span>
      `;
      metrics.appendChild(xpStat);
    }

    // 5-tier compact breakdown chips (A1..C1)
    const tiersGrid = document.createElement('div');
    tiersGrid.className = 'duo-placement-tiers';
    for (const tier of PLACEMENT_TIERS) {
      const got = evaluation.correctByLevel[tier];
      const tot = evaluation.totalByLevel[tier];
      const chip = document.createElement('div');
      chip.className = `duo-placement-tier-chip ${
        tot > 0 && got === tot ? 'is-pass' : got > 0 ? 'is-mid' : 'is-miss'
      }`;
      chip.innerHTML = `<span class="tier-lvl">${tier}</span><span class="tier-val">${got}/${tot}</span>`;
      tiersGrid.appendChild(chip);
    }

    const actions = document.createElement('div');
    actions.className = 'duo-placement-result-actions';

    const activeUnitAfter = getUnitById(savedState.activeUnitId);
    const goBtn = document.createElement('button');
    goBtn.type = 'button';
    goBtn.className = 'duo-btn-continue ok';
    goBtn.textContent = isTr
      ? `Ünite ${activeUnitAfter.unitNumber}'e Git →`
      : `Go to Unit ${activeUnitAfter.unitNumber} →`;
    goBtn.addEventListener('click', () => {
      onCompleted(savedState);
    });
    actions.appendChild(goBtn);

    if (shouldOfferRecallSync && !applied.preservedHigherLevel) {
      const syncBtn = document.createElement('button');
      syncBtn.type = 'button';
      syncBtn.className = 'duo-btn-secondary duo-placement-sync-btn';
      syncBtn.textContent = isTr
        ? `20 dk kart seviyesini de ${evaluation.placedLevel} yap`
        : `Also set 20m recall cards to ${evaluation.placedLevel}`;
      syncBtn.addEventListener('click', async () => {
        syncBtn.disabled = true;
        await saveSettings({ levels: recommendedLevels });
        if (
          evaluation.placedLevel === 'B1' ||
          evaluation.placedLevel === 'B2' ||
          evaluation.placedLevel === 'C1'
        ) {
          await saveOnboardingState({
            b1GateActive: false,
            b1GateAccepted: true,
          });
        }
        syncBtn.textContent = isTr
          ? `✓ Kart seviyesi ${evaluation.placedLevel} yapıldı`
          : `✓ Recall cards updated to ${evaluation.placedLevel}`;
      });
      actions.appendChild(syncBtn);
    }

    wrap.append(badge, title, sub, metrics, tiersGrid, actions);
    sessionEl.appendChild(wrap);
    goBtn.focus({ preventScroll: true });
  };

  const renderQuestion = (): void => {
    detachKeys();
    cancelEnglishSpeech();
    stopActiveRuleAudio();

    if (currentIdx >= questions.length) {
      const result = evaluatePlacementAnswers(answers);
      void renderResultView(result);
      return;
    }

    const item = questions[currentIdx]!;
    const ex = item.exercise;
    sessionEl.replaceChildren();

    // 1. Top bar: Exit + Progress bar + Placement title pill
    const topBar = document.createElement('div');
    topBar.className = 'duo-lesson-topbar';

    const exitBtn = document.createElement('button');
    exitBtn.type = 'button';
    exitBtn.className = 'duo-lesson-exit';
    exitBtn.textContent = '✕';
    exitBtn.title = isTr ? 'Seviye Testinden Çık' : 'Exit Placement Test';
    exitBtn.addEventListener('click', () => {
      detachKeys();
      cancelEnglishSpeech();
      stopActiveRuleAudio();
      onExit();
    });

    const progTrack = document.createElement('div');
    progTrack.className = 'duo-lesson-prog-track';
    const progFill = document.createElement('div');
    progFill.className = 'duo-lesson-prog-fill';
    progFill.style.width = `${Math.min(100, Math.round((currentIdx / questions.length) * 100))}%`;
    progTrack.appendChild(progFill);

    const modeTag = document.createElement('span');
    modeTag.className = 'duo-placement-top-tag';
    modeTag.textContent = isTr ? '🎯 Seviye Testi' : '🎯 Placement';

    topBar.append(exitBtn, progTrack, modeTag);
    sessionEl.appendChild(topBar);

    // 2. Prominent Question Counter & Remaining Strip
    const statusBar = document.createElement('div');
    statusBar.className = 'duo-lesson-status-bar';

    const statusLeft = document.createElement('div');
    statusLeft.className = 'duo-status-left';
    const qIndexEl = document.createElement('span');
    qIndexEl.className = 'duo-q-index';
    const tierBadge = document.createElement('span');
    tierBadge.className = 'duo-q-step';
    tierBadge.textContent = isTr ? `Seviye ${item.tier}` : `Level ${item.tier}`;
    statusLeft.append(qIndexEl, tierBadge);

    const qRemEl = document.createElement('span');
    qRemEl.className = 'duo-q-remaining';

    const refreshCounter = (checked: boolean): void => {
      const counter = formatLessonProgressCounter(currentIdx, questions.length, checked, isTr);
      qIndexEl.textContent = counter.indexText;
      qRemEl.textContent = counter.remainingText;
      qRemEl.classList.toggle('is-last', counter.isLast);
      qRemEl.classList.toggle('is-done', counter.isDone);
    };
    refreshCounter(false);

    statusBar.append(statusLeft, qRemEl);
    sessionEl.appendChild(statusBar);

    // 3. Stage
    const stage = document.createElement('div');
    stage.className = 'duo-lesson-stage';

    const instr = document.createElement('div');
    instr.className = 'duo-ex-instruction';
    instr.textContent =
      ex.kind === 'select_meaning'
        ? isTr
          ? 'Doğru Türkçe anlamını seçin:'
          : 'Select the correct meaning:'
        : ex.kind === 'cloze_blank'
          ? isTr
            ? 'Boşluğa uygun İngilizce kelimeyi seçin:'
            : 'Fill in the blank:'
          : isTr
            ? 'İngilizce karşılığını seçin:'
            : 'Select the English match:';
    stage.appendChild(instr);

    const promptCard = document.createElement('div');
    promptCard.className = 'duo-ex-prompt-card';
    const promptMain = document.createElement('div');
    promptMain.className = 'duo-ex-prompt-main';

    const allowManualAudio = ex.direction === 'en-to-tr' && ex.kind !== 'cloze_blank';
    if (allowManualAudio && ex.audioText) {
      const spk = document.createElement('button');
      spk.type = 'button';
      spk.className = 'duo-audio-mini-btn';
      spk.textContent = '🔊';
      spk.title = isTr ? 'Telaffuzu dinle' : 'Listen';
      spk.addEventListener('click', () => speakEnglish(ex.audioText, 1.0));
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
      if (!allowManualAudio) {
        pSub.style.paddingLeft = '0';
      }
      pSub.textContent = ex.promptSubtext;
      promptCard.appendChild(pSub);
    }
    stage.appendChild(promptCard);

    // 4. Multiple-choice grid
    let selectedOption = '';
    let evaluated = false;
    const choicesGrid = document.createElement('div');
    choicesGrid.className = 'duo-choices-grid';
    const choicesAreEnglish =
      ex.kind === 'select_en' || ex.kind === 'cloze_blank' || ex.direction === 'tr-to-en';
    const optionBtns: HTMLButtonElement[] = [];

    const footerBar = document.createElement('div');
    footerBar.className = 'duo-lesson-footer';

    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'duo-btn-secondary';
    skipBtn.textContent = isTr ? 'Bilmiyorum' : "Don't Know";

    const checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.className = 'duo-btn-check';
    checkBtn.textContent = isTr ? 'Kontrol Et' : 'Check';
    checkBtn.disabled = true;

    for (let i = 0; i < (ex.choices ?? []).length; i += 1) {
      const choiceText = ex.choices![i]!;
      const cBtn = document.createElement('button');
      cBtn.type = 'button';
      cBtn.dataset.choiceVal = choiceText;
      cBtn.dataset.wordLang = choicesAreEnglish ? 'en' : 'tr';
      cBtn.className = 'duo-choice-card';
      cBtn.innerHTML = `<span class="duo-choice-key">${i + 1}</span> <span class="duo-choice-label"></span>`;
      cBtn.querySelector('.duo-choice-label')!.textContent = choiceText;
      cBtn.addEventListener('click', () => {
        if (evaluated) return;
        selectedOption = choiceText;
        for (const b of optionBtns) b.classList.remove('selected');
        cBtn.classList.add('selected');
        checkBtn.disabled = false;
      });
      optionBtns.push(cBtn);
      choicesGrid.appendChild(cBtn);
    }
    stage.appendChild(choicesGrid);
    sessionEl.appendChild(stage);

    const submitAnswer = (skipped: boolean): void => {
      if (evaluated) return;
      evaluated = true;
      for (const b of optionBtns) b.disabled = true;
      skipBtn.disabled = true;
      checkBtn.disabled = true;

      const expectedNorm = (ex.correctChoice ?? '').trim().toLowerCase();
      const chosenNorm = skipped ? '' : selectedOption.trim().toLowerCase();
      const isCorrect = !skipped && Boolean(expectedNorm) && chosenNorm === expectedNorm;

      answers.push({ tier: item.tier, isCorrect });
      progFill.style.width = `${Math.min(100, Math.round(((currentIdx + 1) / questions.length) * 100))}%`;
      refreshCounter(true);

      for (const btn of optionBtns) {
        const valNorm = (btn.dataset.choiceVal ?? '').trim().toLowerCase();
        if (valNorm === expectedNorm) {
          btn.classList.add('is-result-correct');
        } else if (!isCorrect && chosenNorm && valNorm === chosenNorm) {
          btn.classList.add('is-result-wrong');
        }
      }

      footerBar.className = `duo-lesson-footer ${isCorrect ? 'is-correct' : 'is-wrong'}`;
      footerBar.replaceChildren();

      const fbText = document.createElement('div');
      fbText.className = 'duo-fb-text';
      const titleEl = document.createElement('div');
      titleEl.className = 'duo-fb-title';
      titleEl.textContent = isCorrect
        ? isTr
          ? '✓ Doğru'
          : '✓ Correct'
        : isTr
          ? '✕ Doğru Cevap:'
          : '✕ Correct Answer:';
      fbText.appendChild(titleEl);

      if (!isCorrect && ex.correctChoice) {
        const solRow = document.createElement('div');
        solRow.className = 'duo-fb-solution';
        const strongAns = document.createElement('strong');
        strongAns.textContent = ex.correctChoice;
        solRow.appendChild(strongAns);
        fbText.appendChild(solRow);
      }

      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'duo-fb-actions';
      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = `duo-btn-continue ${isCorrect ? 'ok' : 'err'}`;
      const isFinalQuestion = currentIdx + 1 >= questions.length;
      nextBtn.textContent = isFinalQuestion
        ? isTr
          ? 'Sonucu Gör →'
          : 'See Result →'
        : isTr
          ? 'Devam Et'
          : 'Continue';
      nextBtn.addEventListener('click', () => {
        currentIdx += 1;
        renderQuestion();
      });
      actionsWrap.appendChild(nextBtn);
      footerBar.append(fbText, actionsWrap);
      nextBtn.focus({ preventScroll: true });
    };

    skipBtn.addEventListener('click', () => submitAnswer(true));
    checkBtn.addEventListener('click', () => submitAnswer(false));

    footerBar.append(skipBtn, checkBtn);
    sessionEl.appendChild(footerBar);

    activeKeyHandler = (e: KeyboardEvent) => {
      if (!sessionEl.isConnected) {
        detachKeys();
        return;
      }
      if (!evaluated) {
        const num = Number(e.key);
        if (num >= 1 && num <= optionBtns.length) {
          e.preventDefault();
          optionBtns[num - 1]!.click();
        } else if (e.key === 'Enter' && !checkBtn.disabled) {
          e.preventDefault();
          submitAnswer(false);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const contBtn = footerBar.querySelector<HTMLButtonElement>('.duo-btn-continue');
        contBtn?.click();
      }
    };
    document.addEventListener('keydown', activeKeyHandler);
  };

  renderQuestion();
}
