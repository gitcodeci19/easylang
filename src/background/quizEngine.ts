import {
  applyAnswerToSkillProfile,
  buildAnalyticsSummary,
  classifyCardTopic,
  getCardDifficultyRating,
  normalizePosGroup,
  ratingToCefrProgress,
} from '../shared/analytics';
import {
  advanceConceptAfterAnswer,
  countUnusedMatchingCards,
  selectDueConceptAndCard,
  upsertConceptNote,
} from '../shared/concepts';
import { getCardsForUnit } from '../shared/curriculum';
import { evaluateEnglishAnswer, evaluateTurkishAnswer } from '../shared/matcher';
import {
  isAiConceptCard,
  recordCorrectProgress,
  recordWrongProgress,
  selectNextCard,
} from '../shared/srs';
import { hasSyntheticProperName } from '../shared/youglish';
import {
  appendListeningAskedId,
  appendReviewEvent,
  getAiConfig,
  getAiFailoverCooldowns,
  getAllCards,
  getConceptState,
  getCurrentPrompt,
  getDailyStats,
  getLastActiveTab,
  getListeningAskedIds,
  getNextAlarmAt,
  getPendingPrompt,
  getProgressMap,
  getReviewHistory,
  getRoadmapState,
  getSettings,
  getSkillProfile,
  replaceLastReviewEventForCard,
  saveConceptState,
  saveProgressEntry,
  saveRoadmapState,
  saveSkillProfile,
  setCurrentPrompt,
  updateDailyStats,
  upsertUserCard,
} from '../shared/storage';
import type {
  ActivePrompt,
  AnswerEvaluation,
  AnswerOutcomeResult,
  Card,
  ConceptNote,
  ExtensionSettings,
  ListeningChallenge,
  StatusSnapshot,
} from '../shared/types';
import {
  evaluateAnswerWithAi,
  evaluateRoadmapAnswerWithAi,
  explainConceptWithAi,
  generateConceptPracticeCards,
  getConfiguredProviders,
  hasConfiguredAiProvider,
  selectActiveProvider,
} from './aiEvaluator';

export function isWithinQuietHours(settings: ExtensionSettings, date: Date = new Date()): boolean {
  const { quietHoursStart, quietHoursEnd } = settings;
  if (quietHoursStart === null || quietHoursEnd === null) return false;
  const hour = date.getHours();
  if (quietHoursStart === quietHoursEnd) return false;
  if (quietHoursStart < quietHoursEnd) {
    return hour >= quietHoursStart && hour < quietHoursEnd;
  }
  // Overnight span (e.g., 23 -> 08)
  return hour >= quietHoursStart || hour < quietHoursEnd;
}

const RETRY_PRIORITY_GRACE_MS = 60_000;

export async function prepareNextPrompt(now: number = Date.now()): Promise<ActivePrompt | null> {
  const [settings, cards, progressMap, skillProfile, conceptState, reviewHistory, roadmapState] =
    await Promise.all([
      getSettings(),
      getAllCards(),
      getProgressMap(),
      getSkillProfile(),
      getConceptState(),
      getReviewHistory(),
      getRoadmapState(),
    ]);

  const cardById = new Map(cards.map((c) => [c.id, c]));
  const hasDueRetry = Object.values(progressMap).some(
    (p) => p.retryAt !== null && p.retryAt <= now + RETRY_PRIORITY_GRACE_MS && cardById.has(p.cardId)
  );

  // If no 20-minute retry is immediately due, check whether an overdue grammar/concept drill should run
  if (!hasDueRetry) {
    const conceptPick = selectDueConceptAndCard(
      conceptState,
      cards,
      progressMap,
      skillProfile.totalAnswered,
      {
        contentMode: settings.contentMode,
        levels: settings.levels,
        includeUserCards: settings.includeUserCards,
      }
    );

    if (conceptPick) {
      await saveConceptState({
        ...conceptState,
        lastConceptPromptAtQuestion: skillProfile.totalAnswered,
      });

      const prompt: ActivePrompt = {
        card: conceptPick.card,
        progress: conceptPick.progress,
        isRetry: false,
        retryAttempt: 0,
        shownAt: now,
        targetConcept: {
          id: conceptPick.concept.id,
          label: conceptPick.concept.label,
          focusToken: conceptPick.concept.focusToken,
          stage: conceptPick.concept.stage,
          explanation: conceptPick.concept.explanation,
          sourceCardId: conceptPick.concept.sourceCardId,
          sourceEn: conceptPick.concept.sourceEn,
        },
      };

      await setCurrentPrompt(prompt);
      await updateDailyStats((s) => ({ ...s, shown: s.shown + 1 }));
      return prompt;
    }
  }

  const candidateCards =
    !hasDueRetry && roadmapState.focusUnitOnly
      ? getCardsForUnit(roadmapState.activeUnitId, cards)
      : cards;

  const selection =
    selectNextCard(candidateCards, progressMap, now, {
      contentMode: settings.contentMode,
      levels: roadmapState.focusUnitOnly ? [] : settings.levels,
      includeUserCards: settings.includeUserCards,
      preferredRating: settings.adaptiveDifficulty ? skillProfile.rating : undefined,
      reviewHistory: settings.adaptiveDifficulty ? reviewHistory : undefined,
    }) ??
    selectNextCard(cards, progressMap, now, {
      contentMode: settings.contentMode,
      levels: settings.levels,
      includeUserCards: settings.includeUserCards,
      preferredRating: settings.adaptiveDifficulty ? skillProfile.rating : undefined,
      reviewHistory: settings.adaptiveDifficulty ? reviewHistory : undefined,
    });

  if (!selection) return null;

  const prompt: ActivePrompt = {
    card: selection.card,
    progress: selection.progress,
    isRetry: selection.isRetry,
    retryAttempt: selection.retryAttempt,
    shownAt: now,
  };

  await setCurrentPrompt(prompt);
  await updateDailyStats((s) => ({ ...s, shown: s.shown + 1 }));
  return prompt;
}

export async function prepareListeningChallenge(
  excludeIds: string[] = []
): Promise<ListeningChallenge | null> {
  const [settings, aiConfig, cards, progressMap, skillProfile, reviewHistory, persistedAskedIds] =
    await Promise.all([
      getSettings(),
      getAiConfig(),
      getAllCards(),
      getProgressMap(),
      getSkillProfile(),
      getReviewHistory(),
      getListeningAskedIds(),
    ]);

  const excludeSet = new Set([...persistedAskedIds, ...excludeIds]);
  const allSentenceCards = cards.filter(
    (c) =>
      !excludeSet.has(c.id) &&
      (c.type === 'sentence' || Boolean(c.exampleEn && c.exampleEn.trim().length >= 16))
  );
  // Prefer natural sentences without synthetic corpus names like "Tom" or "Mary"
  const naturalSentenceCards = allSentenceCards.filter(
    (c) => !hasSyntheticProperName(c.type === 'sentence' ? c.en : c.exampleEn)
  );
  const sentenceCards =
    naturalSentenceCards.length > 0 ? naturalSentenceCards : allSentenceCards;

  const pool = sentenceCards.length > 0 ? sentenceCards : cards;
  const pick = selectNextCard(pool, progressMap, Date.now(), {
    contentMode: 'sentence',
    levels: settings.levels,
    includeUserCards: settings.includeUserCards,
    preferredRating: settings.adaptiveDifficulty ? skillProfile.rating : undefined,
    reviewHistory: settings.adaptiveDifficulty ? reviewHistory : undefined,
  });

  const chosen = pick?.card ?? pool[0];
  if (!chosen) return null;

  const sentenceEn = (chosen.type === 'sentence' ? chosen.en : chosen.exampleEn || chosen.en).trim();
  const meaningTr =
    chosen.type === 'sentence'
      ? (chosen.acceptedTr[0] ?? '')
      : (chosen.exampleTr || chosen.acceptedTr[0] || '');

  return {
    cardId: chosen.id,
    sentenceEn,
    meaningTr,
    level: chosen.level,
    wordCount: sentenceEn.split(/\s+/).filter(Boolean).length,
    uiLanguage: settings.uiLanguage ?? aiConfig.feedbackLanguage ?? 'auto',
  };
}

const MAX_AI_CONCEPT_CARDS_TOTAL = 20;

function ensurePracticeVarietyInBackground(
  concept: ConceptNote,
  cards: Card[],
  aiConfig: Awaited<ReturnType<typeof getAiConfig>>,
  targetLevel: Card['level'] = 'B1'
): void {
  if (!aiConfig.enabled || !aiConfig.apiKey.trim()) return;
  if (countUnusedMatchingCards(concept, cards) >= 2) return;
  const existingAiCount = cards.filter((c) => isAiConceptCard(c)).length;
  if (existingAiCount >= MAX_AI_CONCEPT_CARDS_TOTAL) return;

  const existingNormalized = new Set(cards.map((c) => c.en.trim().toLowerCase()));
  void generateConceptPracticeCards(concept, aiConfig, targetLevel)
    .then(async (generated) => {
      for (const c of generated) {
        const key = c.en.trim().toLowerCase();
        if (!key || existingNormalized.has(key)) continue;
        existingNormalized.add(key);
        await upsertUserCard(c);
      }
    })
    .catch((err) => {
      console.warn('[EnTrRecall concept card gen]', err);
    });
}

export async function handleSubmitAnswer(
  cardId: string,
  userAnswer: string,
  now: number = Date.now(),
  cardOverride?: Card,
  source: 'recall' | 'roadmap' = 'recall'
): Promise<AnswerOutcomeResult> {
  const [settings, aiConfig, cards, progressMap, skillProfile, currentPrompt, conceptState, roadmapState] =
    await Promise.all([
      getSettings(),
      getAiConfig(),
      getAllCards(),
      getProgressMap(),
      getSkillProfile(),
      getCurrentPrompt(),
      getConceptState(),
      getRoadmapState(),
    ]);

  const deckCard = cards.find((c) => c.id === cardId);
  const promptCard = currentPrompt?.card.id === cardId ? currentPrompt.card : undefined;
  // Always evaluate against the exact card shown to the user if an ID was reassigned across dataset builds
  const card =
    cardOverride ??
    (promptCard && (!deckCard || deckCard.en !== promptCard.en) ? promptCard : (deckCard ?? promptCard));
  if (!card) {
    throw new Error(`Card not found: ${cardId}`);
  }

  let evaluation: AnswerEvaluation = evaluateTurkishAnswer(
    userAnswer,
    card.acceptedTr,
    card.type
  );

  // Skip AI call when the user already matched a reference translation closely (saves tokens & prevents hallucinated omissions)
  const isStrongLocalMatch =
    evaluation.isCorrect &&
    (evaluation.matchKind === 'exact' ||
      evaluation.matchKind === 'normalized' ||
      evaluation.similarity >= 0.82);
  const shouldCallAi =
    !isStrongLocalMatch &&
    (!evaluation.isCorrect || (aiConfig.enabled && aiConfig.alwaysEvaluate !== false));
  if (shouldCallAi) {
    const aiResult = await evaluateAnswerWithAi(card, userAnswer, aiConfig);
    if (aiResult.ok) {
      const combinedCorrect = evaluation.isCorrect || aiResult.isCorrect;
      // Never attach a distracting focus weakPoint when the answer was accepted as correct
      const effectiveWeakPoint = combinedCorrect ? undefined : aiResult.weakPoint;
      evaluation = {
        isCorrect: combinedCorrect,
        matchKind: evaluation.isCorrect ? evaluation.matchKind : aiResult.isCorrect ? 'ai' : 'none',
        matchedTranslation: combinedCorrect
          ? evaluation.matchedTranslation ?? userAnswer.trim()
          : evaluation.matchedTranslation,
        similarity: combinedCorrect ? 1 : evaluation.similarity,
        aiNote: aiResult.note,
        aiStatus: 'used',
        aiProviderIndex: aiResult.providerIndex,
        weakPoint: effectiveWeakPoint,
      };
    } else if (aiResult.reason === 'error') {
      evaluation = {
        ...evaluation,
        aiStatus: 'error',
        aiNote: `AI unavailable (${aiResult.errorMessage ?? 'unknown error'}) — local matcher applied.`,
      };
    } else {
      evaluation = {
        ...evaluation,
        aiStatus: 'disabled',
      };
    }
  }

  const existing = progressMap[cardId] ?? null;
  const isRoadmapSource = source === 'roadmap';

  // Duplicate-tab submission guard: if the same recall card was already answered seconds ago
  // and currentPrompt was already cleared, return smoothly without double-penalizing or writing a 0ms duplicate event.
  const isDuplicateRecallSubmit =
    !isRoadmapSource &&
    !currentPrompt &&
    existing !== null &&
    existing.lastReviewedAt > 0 &&
    now - existing.lastReviewedAt < 15_000;
  if (isDuplicateRecallSubmit) {
    const cefr = ratingToCefrProgress(skillProfile.rating);
    return {
      evaluation,
      updatedProgress: existing,
      nextRepeatLabel: existing.retryAt ? `Retry in ${settings.retryDelayMinutes} min` : `In ${existing.intervalDays || 1} day`,
      ratingDelta: 0,
      newRating: skillProfile.rating,
      estimatedLevel: cefr.level,
    };
  }

  const responseMs =
    currentPrompt && currentPrompt.card.id === cardId
      ? Math.min(60_000, Math.max(0, now - currentPrompt.shownAt))
      : 0;
  const isRetryAttempt = Boolean(existing && existing.retryCount > 0);

  const outcome = evaluation.isCorrect
    ? recordCorrectProgress(existing, cardId, now, responseMs)
    : recordWrongProgress(existing, cardId, now, settings.retryDelayMinutes);

  // Protect Elo from unfair -24 drops when user focuses background Recall on a lower-CEFR roadmap unit
  const isLowLevelUnitFocusCard =
    !isRoadmapSource &&
    Boolean(roadmapState.focusUnitOnly) &&
    skillProfile.rating - getCardDifficultyRating(card) >= 250;

  // Keep 20-minute Recall Elo completely separate from Roadmap exercises
  let ratingUpdate = isRoadmapSource
    ? { nextProfile: skillProfile, delta: 0 }
    : applyAnswerToSkillProfile(skillProfile, card, evaluation.isCorrect, {
        responseMs,
        isRetryAttempt,
        now,
      });
  if (isLowLevelUnitFocusCard && ratingUpdate.delta < 0) {
    ratingUpdate = {
      delta: 0,
      nextProfile: {
        ...ratingUpdate.nextProfile,
        rating: skillProfile.rating,
      },
    };
  }

  const nextQuestionSeq = ratingUpdate.nextProfile.totalAnswered;
  let nextConceptState = conceptState;
  let recordedConcept: ConceptNote | undefined;
  let conceptProgressNote: string | undefined;

  if (!isRoadmapSource && evaluation.weakPoint) {
    const upserted = upsertConceptNote(
      nextConceptState,
      card,
      evaluation.weakPoint.token,
      nextQuestionSeq,
      now,
      evaluation.weakPoint
    );
    nextConceptState = upserted.nextState;
    recordedConcept = upserted.note;
    conceptProgressNote = `📌 "${recordedConcept.label}" added to focus list (next check in 2 questions).`;
    const userCefr = ratingToCefrProgress(ratingUpdate.nextProfile.rating).level;
    ensurePracticeVarietyInBackground(recordedConcept, cards, aiConfig, userCefr);
  } else if (!isRoadmapSource && currentPrompt?.card.id === cardId && currentPrompt.targetConcept) {
    const advanced = advanceConceptAfterAnswer(
      nextConceptState,
      currentPrompt.targetConcept.id,
      cardId,
      evaluation.isCorrect,
      nextQuestionSeq,
      now
    );
    nextConceptState = advanced.nextState;
    if (advanced.updated) {
      recordedConcept = advanced.updated;
      conceptProgressNote = advanced.progressNote;
    }
  }

  await Promise.all([
    saveProgressEntry(outcome.progress),
    isRoadmapSource ? Promise.resolve() : saveSkillProfile(ratingUpdate.nextProfile),
    isRoadmapSource ? Promise.resolve() : saveConceptState(nextConceptState),
    !isRoadmapSource && evaluation.isCorrect
      ? getRoadmapState().then((rm) =>
          saveRoadmapState({
            xp: rm.xp + 5,
            dailyXp: rm.dailyXp + 5,
          })
        )
      : Promise.resolve(),
    isRoadmapSource
      ? Promise.resolve()
      : appendReviewEvent({
          cardId: card.id,
          en: card.en,
          level: card.level,
          posGroup: normalizePosGroup(card.pos, card.type),
          topic: classifyCardTopic(card),
          isCorrect: evaluation.isCorrect,
          responseMs,
          ratingBefore: skillProfile.rating,
          ratingAfter: ratingUpdate.nextProfile.rating,
          timestamp: now,
        }),
    isRoadmapSource ? Promise.resolve() : setCurrentPrompt(null),
    updateDailyStats((s) => ({
      ...s,
      correct: s.correct + (evaluation.isCorrect ? 1 : 0),
      wrong: s.wrong + (evaluation.isCorrect ? 0 : 1),
    })),
  ]);

  const cefr = ratingToCefrProgress(ratingUpdate.nextProfile.rating);

  return {
    evaluation,
    updatedProgress: outcome.progress,
    nextRepeatLabel: outcome.nextRepeatLabel,
    ratingDelta: ratingUpdate.delta,
    newRating: ratingUpdate.nextProfile.rating,
    estimatedLevel: cefr.level,
    recordedConcept,
    conceptProgressNote,
  };
}

export async function handleMarkDontKnow(
  cardId: string,
  now: number = Date.now(),
  cardOverride?: Card,
  source: 'recall' | 'roadmap' = 'recall'
): Promise<AnswerOutcomeResult> {
  const [settings, cards, progressMap, skillProfile, currentPrompt, conceptState, roadmapState] =
    await Promise.all([
      getSettings(),
      getAllCards(),
      getProgressMap(),
      getSkillProfile(),
      getCurrentPrompt(),
      getConceptState(),
      getRoadmapState(),
    ]);

  const isRoadmapSource = source === 'roadmap';
  const card = cardOverride ?? cards.find((c) => c.id === cardId);
  const existing = progressMap[cardId] ?? null;
  const responseMs =
    currentPrompt && currentPrompt.card.id === cardId
      ? Math.min(60_000, Math.max(0, now - currentPrompt.shownAt))
      : 0;
  const outcome = recordWrongProgress(existing, cardId, now, settings.retryDelayMinutes);

  const isLowLevelUnitFocusCard =
    !isRoadmapSource &&
    Boolean(roadmapState.focusUnitOnly) &&
    Boolean(card) &&
    skillProfile.rating - getCardDifficultyRating(card!) >= 250;

  let ratingUpdate =
    !isRoadmapSource && card
      ? applyAnswerToSkillProfile(skillProfile, card, false, {
          responseMs,
          isRetryAttempt: Boolean(existing && existing.retryCount > 0),
          now,
        })
      : { nextProfile: skillProfile, delta: 0 };
  if (isLowLevelUnitFocusCard && ratingUpdate.delta < 0) {
    ratingUpdate = {
      delta: 0,
      nextProfile: {
        ...ratingUpdate.nextProfile,
        rating: skillProfile.rating,
      },
    };
  }

  let nextConceptState = conceptState;
  let recordedConcept: ConceptNote | undefined;
  let conceptProgressNote: string | undefined;

  if (!isRoadmapSource && currentPrompt?.card.id === cardId && currentPrompt.targetConcept) {
    const advanced = advanceConceptAfterAnswer(
      nextConceptState,
      currentPrompt.targetConcept.id,
      cardId,
      false,
      ratingUpdate.nextProfile.totalAnswered,
      now
    );
    nextConceptState = advanced.nextState;
    if (advanced.updated) {
      recordedConcept = advanced.updated;
      conceptProgressNote = advanced.progressNote;
    }
  }

  await Promise.all([
    saveProgressEntry(outcome.progress),
    isRoadmapSource ? Promise.resolve() : saveSkillProfile(ratingUpdate.nextProfile),
    isRoadmapSource ? Promise.resolve() : saveConceptState(nextConceptState),
    !isRoadmapSource && card
      ? appendReviewEvent({
          cardId: card.id,
          en: card.en,
          level: card.level,
          posGroup: normalizePosGroup(card.pos, card.type),
          topic: classifyCardTopic(card),
          isCorrect: false,
          responseMs,
          ratingBefore: skillProfile.rating,
          ratingAfter: ratingUpdate.nextProfile.rating,
          timestamp: now,
        })
      : Promise.resolve(),
    isRoadmapSource ? Promise.resolve() : setCurrentPrompt(null),
    updateDailyStats((s) => ({ ...s, wrong: s.wrong + 1 })),
  ]);

  const cefr = ratingToCefrProgress(ratingUpdate.nextProfile.rating);

  return {
    evaluation: {
      isCorrect: false,
      matchKind: 'none',
      matchedTranslation: null,
      similarity: 0,
    },
    updatedProgress: outcome.progress,
    nextRepeatLabel: outcome.nextRepeatLabel,
    ratingDelta: ratingUpdate.delta,
    newRating: ratingUpdate.nextProfile.rating,
    estimatedLevel: cefr.level,
    recordedConcept,
    conceptProgressNote,
  };
}

export async function handleFlagConceptGap(
  cardId: string,
  focusToken: string,
  userQuestion?: string,
  now: number = Date.now(),
  cardOverride?: Card
): Promise<ConceptNote> {
  const [aiConfig, cards, skillProfile, conceptState] = await Promise.all([
    getAiConfig(),
    getAllCards(),
    getSkillProfile(),
    getConceptState(),
  ]);

  const card = cardOverride ?? cards.find((c) => c.id === cardId);
  if (!card) {
    throw new Error(`Card not found: ${cardId}`);
  }

  const aiExplain = await explainConceptWithAi(card, focusToken, userQuestion, aiConfig);
  const { nextState, note } = upsertConceptNote(
    conceptState,
    card,
    focusToken,
    skillProfile.totalAnswered,
    now,
    aiExplain
      ? {
          token: focusToken,
          label: aiExplain.label,
          explanation: aiExplain.explanation,
        }
      : undefined
  );

  await saveConceptState(nextState);
  const userCefr = ratingToCefrProgress(skillProfile.rating).level;
  ensurePracticeVarietyInBackground(note, cards, aiConfig, userCefr);
  return note;
}

/**
 * Grade a Duolingo-roadmap exercise (free typing EN->TR / TR->EN, word bank, or
 * near-miss dictation) with fast local matching and seamless AI fallback for
 * synonyms, typos, and flexible word order, without altering 20-minute Recall Elo.
 */
export async function handleEvaluateRoadmapExercise(
  payload: {
    card: Card;
    direction: 'en-to-tr' | 'tr-to-en' | 'en-audio';
    kind: 'word_bank' | 'audio_dictation' | 'free_translation';
    promptText: string;
    expectedAnswers: string[];
    userAnswer: string;
    localCorrect: boolean;
    localScore: number;
    recordProgress: boolean;
  },
  now: number = Date.now()
): Promise<AnswerOutcomeResult> {
  const [settings, aiConfig, progressMap, skillProfile] = await Promise.all([
    getSettings(),
    getAiConfig(),
    getProgressMap(),
    getSkillProfile(),
  ]);

  const { card, direction, kind, promptText, expectedAnswers, userAnswer, localCorrect, localScore } = payload;
  const evalCardType = kind === 'word_bank' ? 'sentence' : card.type;
  let evaluation: AnswerEvaluation;

  if (direction === 'en-to-tr') {
    const trCandidates = Array.from(new Set([...expectedAnswers, ...card.acceptedTr].filter(Boolean)));
    const localEval = evaluateTurkishAnswer(userAnswer, trCandidates, evalCardType);
    const isStrongLocal =
      localCorrect ||
      localEval.matchKind === 'exact' ||
      localEval.matchKind === 'normalized' ||
      (kind === 'free_translation' && localEval.isCorrect && localEval.similarity >= 0.86);

    evaluation = localCorrect
      ? { isCorrect: true, matchKind: 'exact', matchedTranslation: expectedAnswers[0] ?? null, similarity: 1 }
      : localEval;

    if (!isStrongLocal && hasConfiguredAiProvider(aiConfig)) {
      const aiRes = await evaluateRoadmapAnswerWithAi(
        { card, direction, kind, promptText, expectedAnswers: trCandidates, userAnswer },
        aiConfig
      );
      if (aiRes.ok) {
        evaluation = {
          isCorrect: aiRes.isCorrect,
          matchKind: aiRes.isCorrect ? 'ai' : 'none',
          matchedTranslation: aiRes.isCorrect ? userAnswer.trim() : evaluation.matchedTranslation,
          similarity: aiRes.isCorrect ? 1 : evaluation.similarity,
          aiNote: aiRes.note,
          aiStatus: 'used',
          aiProviderIndex: aiRes.providerIndex,
          weakPoint: aiRes.weakPoint,
        };
      } else if (aiRes.reason === 'error') {
        evaluation = {
          ...evaluation,
          aiStatus: 'error',
          aiNote: `AI unavailable (${aiRes.errorMessage ?? 'unknown error'}) — local matcher applied.`,
        };
      }
    } else if (!isStrongLocal && !hasConfiguredAiProvider(aiConfig)) {
      evaluation = { ...evaluation, aiStatus: 'disabled' };
    }
  } else if (direction === 'tr-to-en') {
    const enCandidates = Array.from(
      new Set([...expectedAnswers, card.en, ...(card.exampleEn ? [card.exampleEn] : [])].filter(Boolean))
    );
    const localEn = evaluateEnglishAnswer(userAnswer, enCandidates, evalCardType);
    const isStrongLocal =
      localCorrect ||
      localEn.matchKind === 'exact' ||
      localEn.matchKind === 'normalized' ||
      (kind === 'free_translation' && localEn.isCorrect && localEn.similarity >= 0.88);

    evaluation = localCorrect
      ? { isCorrect: true, matchKind: 'exact', matchedTranslation: expectedAnswers[0] ?? card.en, similarity: 1 }
      : localEn;

    if (!isStrongLocal && hasConfiguredAiProvider(aiConfig)) {
      const aiRes = await evaluateRoadmapAnswerWithAi(
        { card, direction, kind, promptText, expectedAnswers: enCandidates, userAnswer },
        aiConfig
      );
      if (aiRes.ok) {
        evaluation = {
          isCorrect: aiRes.isCorrect,
          matchKind: aiRes.isCorrect ? 'ai' : 'none',
          matchedTranslation: aiRes.isCorrect ? userAnswer.trim() : evaluation.matchedTranslation,
          similarity: aiRes.isCorrect ? 1 : evaluation.similarity,
          aiNote: aiRes.note,
          aiStatus: 'used',
          aiProviderIndex: aiRes.providerIndex,
        };
      } else if (aiRes.reason === 'error') {
        evaluation = {
          ...evaluation,
          aiStatus: 'error',
          aiNote: `AI unavailable (${aiRes.errorMessage ?? 'unknown error'}) — local matcher applied.`,
        };
      }
    } else if (!isStrongLocal && !hasConfiguredAiProvider(aiConfig)) {
      evaluation = { ...evaluation, aiStatus: 'disabled' };
    }
  } else {
    // audio_dictation near-miss escalation to AI for harmless contractions / punctuation / 1-char typo
    evaluation = {
      isCorrect: localCorrect,
      matchKind: localCorrect ? 'exact' : 'none',
      matchedTranslation: expectedAnswers[0] ?? card.en,
      similarity: Math.max(0, Math.min(1, localScore / 100)),
      aiStatus: hasConfiguredAiProvider(aiConfig) ? undefined : 'disabled',
    };

    if (!localCorrect && localScore >= 65 && hasConfiguredAiProvider(aiConfig)) {
      const aiRes = await evaluateRoadmapAnswerWithAi(
        { card, direction, kind, promptText, expectedAnswers, userAnswer },
        aiConfig
      );
      if (aiRes.ok) {
        evaluation = {
          isCorrect: aiRes.isCorrect,
          matchKind: aiRes.isCorrect ? 'ai' : 'none',
          matchedTranslation: aiRes.isCorrect ? userAnswer.trim() : expectedAnswers[0] ?? card.en,
          similarity: aiRes.isCorrect ? 1 : evaluation.similarity,
          aiNote: aiRes.note,
          aiStatus: 'used',
          aiProviderIndex: aiRes.providerIndex,
        };
      }
    }
  }

  const existing = progressMap[card.id] ?? null;
  const outcome = evaluation.isCorrect
    ? recordCorrectProgress(existing, card.id, now, 0)
    : recordWrongProgress(existing, card.id, now, settings.retryDelayMinutes);

  if (payload.recordProgress) {
    await Promise.all([
      saveProgressEntry(outcome.progress),
      updateDailyStats((s) => ({
        ...s,
        correct: s.correct + (evaluation.isCorrect ? 1 : 0),
        wrong: s.wrong + (evaluation.isCorrect ? 0 : 1),
      })),
    ]);
  }

  const cefr = ratingToCefrProgress(skillProfile.rating);
  return {
    evaluation,
    updatedProgress: outcome.progress,
    nextRepeatLabel: outcome.nextRepeatLabel,
    ratingDelta: 0,
    newRating: skillProfile.rating,
    estimatedLevel: cefr.level,
  };
}

/**
 * Undo the just-recorded wrong attempt (useful for Turkish sentence paraphrases)
 * and mark the card as correctly answered instead.
 */
export async function handleOverrideCorrect(
  cardId: string,
  now: number = Date.now(),
  cardOverride?: Card,
  source: 'recall' | 'roadmap' = 'recall'
): Promise<AnswerOutcomeResult> {
  const [cards, progressMap, skillProfile, history] = await Promise.all([
    getAllCards(),
    getProgressMap(),
    getSkillProfile(),
    getReviewHistory(),
  ]);
  const card = cardOverride ?? cards.find((c) => c.id === cardId);
  const current = progressMap[cardId] ?? null;
  const isRoadmapSource = source === 'roadmap';

  // Roll back the wrong increment from moments ago before applying correct SRS
  const rolledBack = current
    ? {
        ...current,
        retryAt: null,
        retryCount: Math.max(0, current.retryCount - 1),
        totalWrong: Math.max(0, current.totalWrong - 1),
      }
    : null;

  const outcome = recordCorrectProgress(rolledBack, cardId, now);

  // Restore ratingBefore from the last event for this card if available, then score as correct
  const lastEvent = isRoadmapSource ? undefined : [...history].reverse().find((ev) => ev.cardId === cardId);
  const baseProfile = {
    ...skillProfile,
    rating: lastEvent ? lastEvent.ratingBefore : skillProfile.rating,
    totalAnswered: isRoadmapSource ? skillProfile.totalAnswered : Math.max(0, skillProfile.totalAnswered - 1),
  };

  const ratingUpdate =
    !isRoadmapSource && card
      ? applyAnswerToSkillProfile(baseProfile, card, true, {
          responseMs: lastEvent?.responseMs ?? 0,
          isRetryAttempt: false,
          now,
        })
      : { nextProfile: baseProfile, delta: 0 };

  await Promise.all([
    saveProgressEntry(outcome.progress),
    isRoadmapSource ? Promise.resolve() : saveSkillProfile(ratingUpdate.nextProfile),
    isRoadmapSource
      ? Promise.resolve()
      : replaceLastReviewEventForCard(cardId, (ev) => ({
          ...ev,
          isCorrect: true,
          ratingAfter: ratingUpdate.nextProfile.rating,
        })),
    updateDailyStats((s) => ({
      ...s,
      wrong: Math.max(0, s.wrong - 1),
      correct: s.correct + 1,
      overriddenCorrect: s.overriddenCorrect + 1,
    })),
  ]);

  const cefr = ratingToCefrProgress(ratingUpdate.nextProfile.rating);

  return {
    evaluation: {
      isCorrect: true,
      matchKind: 'exact',
      matchedTranslation: null,
      similarity: 1,
    },
    updatedProgress: outcome.progress,
    nextRepeatLabel: outcome.nextRepeatLabel,
    ratingDelta: ratingUpdate.delta,
    newRating: ratingUpdate.nextProfile.rating,
    estimatedLevel: cefr.level,
  };
}

export async function getStatusSnapshot(): Promise<StatusSnapshot> {
  const [
    settings,
    aiConfig,
    failoverCooldowns,
    nextAlarmAt,
    cards,
    progressMap,
    dailyStats,
    lastActiveTab,
    pending,
    skillProfile,
    conceptState,
  ] = await Promise.all([
    getSettings(),
    getAiConfig(),
    getAiFailoverCooldowns(),
    getNextAlarmAt(),
    getAllCards(),
    getProgressMap(),
    getDailyStats(),
    getLastActiveTab(),
    getPendingPrompt(),
    getSkillProfile(),
    getConceptState(),
  ]);

  const entries = Object.values(progressMap);
  const retryQueueCount = entries.filter((p) => p.retryAt !== null).length;
  const masteredCount = entries.filter((p) => p.streak >= 2 && p.retryAt === null).length;
  const activeConceptsCount = conceptState.notes.filter((n) => n.stage < 3).length;
  const masteredConceptsCount = conceptState.notes.filter((n) => n.stage >= 3).length;

  const { provider: activeProvider, activeUntil } = selectActiveProvider(
    getConfiguredProviders(aiConfig),
    failoverCooldowns
  );

  return {
    settings,
    nextAlarmAt,
    retryQueueCount,
    totalCards: cards.length,
    masteredCount,
    dailyStats,
    lastActiveTab,
    hasPendingPrompt: pending !== null,
    aiEnabled: hasConfiguredAiProvider(aiConfig),
    aiModel: activeProvider?.config.model ?? aiConfig.model,
    aiProviderIndex: activeProvider?.index ?? 1,
    aiFallbackActiveUntil: activeUntil,
    skillProfile,
    activeConceptsCount,
    masteredConceptsCount,
  };
}

export async function handleRecordListeningResult(
  cardId: string | undefined,
  isCorrect: boolean,
  now: number = Date.now()
): Promise<void> {
  const tasks: Promise<unknown>[] = [
    updateDailyStats((s) => ({
      ...s,
      shown: s.shown + 1,
      correct: s.correct + (isCorrect ? 1 : 0),
      wrong: s.wrong + (isCorrect ? 0 : 1),
    })),
  ];

  if (isCorrect) {
    tasks.push(
      getRoadmapState().then((rm) =>
        saveRoadmapState({
          xp: rm.xp + 5,
          dailyXp: rm.dailyXp + 5,
        })
      )
    );
  }

  if (cardId) {
    tasks.push(appendListeningAskedId(cardId));
    const [settings, progressMap] = await Promise.all([getSettings(), getProgressMap()]);
    const existing = progressMap[cardId] ?? null;
    const outcome = isCorrect
      ? recordCorrectProgress(existing, cardId, now)
      : recordWrongProgress(existing, cardId, now, settings.retryDelayMinutes);
    tasks.push(saveProgressEntry(outcome.progress));
  }

  await Promise.all(tasks);
}

export async function handleRecordPageQuizResult(isCorrect: boolean): Promise<void> {
  const tasks: Promise<unknown>[] = [
    updateDailyStats((s) => ({
      ...s,
      shown: s.shown + 1,
      correct: s.correct + (isCorrect ? 1 : 0),
      wrong: s.wrong + (isCorrect ? 0 : 1),
    })),
  ];
  if (isCorrect) {
    tasks.push(
      getRoadmapState().then((rm) =>
        saveRoadmapState({
          xp: rm.xp + 5,
          dailyXp: rm.dailyXp + 5,
        })
      )
    );
  }
  await Promise.all(tasks);
}

export async function buildCurrentAnalyticsReport() {
  const [cards, progressMap, skillProfile, history, conceptState] = await Promise.all([
    getAllCards(),
    getProgressMap(),
    getSkillProfile(),
    getReviewHistory(),
    getConceptState(),
  ]);
  return {
    summary: buildAnalyticsSummary(cards, progressMap, skillProfile, history),
    conceptNotes: conceptState.notes,
  };
}
