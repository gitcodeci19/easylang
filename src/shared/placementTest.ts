import {
  buildUnitLessonExercises,
  CURRICULUM_UNITS,
  normalizeRoadmapState,
  type RoadmapState,
} from './curriculum.ts';
import type { Card, CefrLevel, LessonExercise } from './types.ts';

export type PlacementTierLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export const PLACEMENT_TIERS: readonly PlacementTierLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
export const PLACEMENT_QUESTIONS_PER_TIER = 3;
export const PLACEMENT_TOTAL_QUESTIONS = PLACEMENT_TIERS.length * PLACEMENT_QUESTIONS_PER_TIER;
export const PLACEMENT_COMPLETION_XP = 30;
/** Users may run the placement exam twice back-to-back; afterwards a 7-day cooldown applies. */
export const PLACEMENT_FREE_CONSECUTIVE_ATTEMPTS = 2;
export const PLACEMENT_RETAKE_COOLDOWN_DAYS = 7;
export const PLACEMENT_RETAKE_COOLDOWN_MS = PLACEMENT_RETAKE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export interface PlacementAvailability {
  canTake: boolean;
  attemptsCount: number;
  /** How many immediate (cooldown-free) attempts remain from the initial 2-attempt allowance. */
  freeImmediateRemaining: number;
  cooldownRemainingMs: number;
  daysRemaining: number;
}

/**
 * Evaluate whether the user can start the Placement Exam right now:
 * - Attempts 1 and 2 are immediately allowed back-to-back.
 * - From the 2nd completed attempt onward, a 7-day cooldown applies between attempts.
 */
export function getPlacementAvailability(
  state: RoadmapState,
  now: number = Date.now()
): PlacementAvailability {
  const prev = state.placementResult;
  if (!prev) {
    return {
      canTake: true,
      attemptsCount: 0,
      freeImmediateRemaining: PLACEMENT_FREE_CONSECUTIVE_ATTEMPTS,
      cooldownRemainingMs: 0,
      daysRemaining: 0,
    };
  }

  const attemptsCount = Math.max(1, Math.floor(prev.attemptsCount ?? 1));
  if (attemptsCount < PLACEMENT_FREE_CONSECUTIVE_ATTEMPTS) {
    return {
      canTake: true,
      attemptsCount,
      freeImmediateRemaining: PLACEMENT_FREE_CONSECUTIVE_ATTEMPTS - attemptsCount,
      cooldownRemainingMs: 0,
      daysRemaining: 0,
    };
  }

  const elapsed = Math.max(0, now - prev.completedAt);
  const cooldownRemainingMs = Math.max(0, PLACEMENT_RETAKE_COOLDOWN_MS - elapsed);
  const canTake = cooldownRemainingMs === 0;
  const daysRemaining = canTake ? 0 : Math.max(1, Math.ceil(cooldownRemainingMs / 86_400_000));

  return {
    canTake,
    attemptsCount,
    freeImmediateRemaining: 0,
    cooldownRemainingMs,
    daysRemaining,
  };
}

export interface PlacementQuestion {
  id: string;
  tier: PlacementTierLevel;
  unitId: string;
  exercise: LessonExercise;
}

export interface PlacementAnswerRecord {
  tier: PlacementTierLevel;
  isCorrect: boolean;
}

export interface PlacementEvaluationResult {
  placedLevel: PlacementTierLevel;
  targetUnitId: string;
  targetUnitNumber: number;
  unlockedUnitIds: string[];
  totalCorrect: number;
  totalQuestions: number;
  correctByLevel: Record<PlacementTierLevel, number>;
  totalByLevel: Record<PlacementTierLevel, number>;
}

export interface LessonProgressCounterText {
  /** e.g. "Soru 3 / 8" or "Q 3 / 8" */
  indexText: string;
  /** e.g. "Kalan: 6 soru", "Son soru!", or "Tamamlandı ✓" */
  remainingText: string;
  /** True when the learner is viewing the final question before answering. */
  isLast: boolean;
  /** True when the final question has just been checked. */
  isDone: boolean;
}

/**
 * Format unmistakable question-index and remaining-question strings shared across
 * Roadmap lessons, Placement Test, and Remedial Studio sessions.
 */
export function formatLessonProgressCounter(
  currentIdx: number,
  totalCount: number,
  isChecked: boolean,
  isTr: boolean
): LessonProgressCounterText {
  const safeTotal = Math.max(1, totalCount);
  const currentNumber = Math.min(safeTotal, Math.max(1, currentIdx + 1));
  const remaining = isChecked
    ? Math.max(0, safeTotal - currentIdx - 1)
    : Math.max(1, safeTotal - currentIdx);

  const indexText = isTr
    ? `Soru ${currentNumber} / ${safeTotal}`
    : `Q ${currentNumber} / ${safeTotal}`;

  if (isChecked && remaining === 0) {
    return {
      indexText,
      remainingText: isTr ? 'Son soru bitti ✓' : 'All done ✓',
      isLast: false,
      isDone: true,
    };
  }

  if (!isChecked && remaining === 1) {
    return {
      indexText,
      remainingText: isTr ? 'Son soru!' : 'Last question!',
      isLast: true,
      isDone: false,
    };
  }

  return {
    indexText,
    remainingText: isTr ? `Kalan: ${remaining} soru` : `${remaining} left`,
    isLast: false,
    isDone: false,
  };
}

function isMultipleChoiceExercise(ex: LessonExercise): boolean {
  return (
    (ex.kind === 'select_meaning' || ex.kind === 'cloze_blank' || ex.kind === 'select_en') &&
    Array.isArray(ex.choices) &&
    ex.choices.length >= 4 &&
    Boolean(ex.correctChoice) &&
    ex.choices.some(
      (c) => c.trim().toLowerCase() === (ex.correctChoice ?? '').trim().toLowerCase()
    )
  );
}

/**
 * Build a balanced 15-question progressive CEFR placement test (3 × A1, 3 × A2, 3 × B1,
 * 3 × B2, 3 × C1) using only fast multiple-choice exercises (1 EN→TR meaning, 1 in-context
 * cloze blank, and 1 TR→EN match per tier) so the test stays concise (~1.5–2 min) without
 * typing or mandatory audio while tolerating single accidental slips.
 */
export function buildPlacementTestQuestions(
  allCards: Card[],
  seed: number = Date.now()
): PlacementQuestion[] {
  const safeSeed = Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) : 1;
  const usedCardIds = new Set<string>();
  const questions: PlacementQuestion[] = [];

  for (let tierIdx = 0; tierIdx < PLACEMENT_TIERS.length; tierIdx += 1) {
    const tier = PLACEMENT_TIERS[tierIdx]!;
    const tierUnits = CURRICULUM_UNITS.filter((u) => u.level === tier);
    if (tierUnits.length === 0) continue;

    // Rotate across units in the tier so retakes surface fresh questions across topics
    const unitOffset = (safeSeed + tierIdx * 7) % tierUnits.length;
    const firstUnit = tierUnits[unitOffset]!;
    const secondUnit = tierUnits[(unitOffset + 1) % tierUnits.length]!;
    const thirdUnit = tierUnits[(unitOffset + 2) % tierUnits.length]!;
    const stepBase = (safeSeed + tierIdx * 3) % 5;

    const pickFromUnit = (
      unitId: string,
      preferredKinds: readonly LessonExercise['kind'][],
      slotSalt: number
    ): PlacementQuestion | null => {
      // Probe multiple node/step combinations to strongly prefer exact tier-level cards
      const probeSpecs: Array<{ nodeIndex: number; stepIndex: number }> = [
        { nodeIndex: 0, stepIndex: (stepBase + slotSalt) % 5 },
        { nodeIndex: 1, stepIndex: (stepBase + slotSalt + 1) % 5 },
        { nodeIndex: 4, stepIndex: (stepBase + slotSalt + 2) % 5 },
        { nodeIndex: 3, stepIndex: (stepBase + slotSalt + 3) % 5 },
        { nodeIndex: 2, stepIndex: (stepBase + slotSalt + 4) % 5 },
      ];

      let fallbackPick: LessonExercise | null = null;
      for (const spec of probeSpecs) {
        const exercises = buildUnitLessonExercises(
          unitId,
          spec.nodeIndex,
          allCards,
          {},
          safeSeed + tierIdx * 97 + slotSalt * 31 + spec.nodeIndex * 13,
          spec.stepIndex
        );

        for (const prefKind of preferredKinds) {
          const candidates = exercises.filter(
            (ex) =>
              ex.kind === prefKind &&
              isMultipleChoiceExercise(ex) &&
              !usedCardIds.has(ex.card.id)
          );
          const exactTier = candidates.find((ex) => ex.card.level === tier);
          if (exactTier) {
            usedCardIds.add(exactTier.card.id);
            return {
              id: `plc_${tier}_${slotSalt}_${exactTier.card.id}`,
              tier,
              unitId,
              exercise: {
                ...exactTier,
                isNewWord: false,
                isRetryRequeue: false,
              },
            };
          }
          if (!fallbackPick && candidates[0]) {
            fallbackPick = candidates[0];
          }
        }
      }

      if (fallbackPick) {
        usedCardIds.add(fallbackPick.card.id);
        return {
          id: `plc_${tier}_${slotSalt}_${fallbackPick.card.id}`,
          tier,
          unitId,
          exercise: {
            ...fallbackPick,
            isNewWord: false,
            isRetryRequeue: false,
          },
        };
      }
      return null;
    };

    const q1 = pickFromUnit(firstUnit.id, ['select_meaning', 'select_en', 'cloze_blank'], 0);
    if (q1) questions.push(q1);

    const q2 = pickFromUnit(secondUnit.id, ['cloze_blank', 'select_en', 'select_meaning'], 1);
    if (q2) questions.push(q2);

    const q3 = pickFromUnit(thirdUnit.id, ['select_en', 'cloze_blank', 'select_meaning'], 2);
    if (q3) questions.push(q3);
  }

  return questions;
}

/**
 * Evaluate 3-questions-per-tier (15 total) placement answers to determine the learner's
 * real CEFR band and the exact Roadmap unit up to which units should be unlocked.
 *
 * Uses foundation guards so lucky C1 guesses cannot override missed A1/A2 items,
 * while passing a tier (>= 2/3) reliably unlocks the corresponding stretch of units
 * even with an occasional single slip.
 */
export function evaluatePlacementAnswers(
  answers: readonly PlacementAnswerRecord[]
): PlacementEvaluationResult {
  const correctByLevel: Record<PlacementTierLevel, number> = {
    A1: 0,
    A2: 0,
    B1: 0,
    B2: 0,
    C1: 0,
  };
  const totalByLevel: Record<PlacementTierLevel, number> = {
    A1: 0,
    A2: 0,
    B1: 0,
    B2: 0,
    C1: 0,
  };

  let totalCorrect = 0;
  for (const ans of answers) {
    totalByLevel[ans.tier] += 1;
    if (ans.isCorrect) {
      correctByLevel[ans.tier] += 1;
      totalCorrect += 1;
    }
  }

  const a1 = correctByLevel.A1;
  const a2 = correctByLevel.A2;
  const b1 = correctByLevel.B1;
  const b2 = correctByLevel.B2;
  const c1 = correctByLevel.C1;
  const tot = totalCorrect;

  // Determine target Roadmap unit number (1..20) and placed CEFR level
  let placedLevel: PlacementTierLevel = 'A1';
  let targetUnitNumber = 1;

  if (c1 === 3 && b2 >= 2 && a1 + a2 + b1 + b2 >= 10) {
    placedLevel = 'C1';
    targetUnitNumber = 20;
  } else if (c1 >= 2 && b2 >= 2 && a1 + a2 + b1 >= 7) {
    placedLevel = 'C1';
    targetUnitNumber = 19;
  } else if (b2 === 3 && b1 >= 2 && a1 + a2 + b1 >= 7) {
    placedLevel = 'B2';
    targetUnitNumber = 18;
  } else if (b2 >= 2 && b1 >= 2 && a1 + a2 >= 4) {
    placedLevel = 'B2';
    targetUnitNumber = 16;
  } else if (b1 === 3 && a1 + a2 >= 4) {
    placedLevel = 'B1';
    targetUnitNumber = 14;
  } else if ((b1 >= 2 && a1 + a2 >= 4) || (a1 >= 2 && a2 === 3 && a1 + a2 + b1 >= 6)) {
    placedLevel = 'B1';
    targetUnitNumber = 11;
  } else if (a2 >= 2 && a1 >= 2) {
    placedLevel = 'A2';
    targetUnitNumber = 8;
  } else if ((a1 === 3 && tot >= 4) || (a1 >= 2 && a2 >= 1 && tot >= 4)) {
    placedLevel = 'A2';
    targetUnitNumber = 6;
  } else if (a1 >= 2 || tot >= 3) {
    placedLevel = 'A1';
    targetUnitNumber = 3;
  } else {
    placedLevel = 'A1';
    targetUnitNumber = 1;
  }

  const targetIdx = Math.max(0, Math.min(CURRICULUM_UNITS.length - 1, targetUnitNumber - 1));
  const targetUnit = CURRICULUM_UNITS[targetIdx] ?? CURRICULUM_UNITS[0]!;
  const unlockedUnitIds = CURRICULUM_UNITS.slice(0, targetIdx + 1).map((u) => u.id);

  return {
    placedLevel,
    targetUnitId: targetUnit.id,
    targetUnitNumber: targetUnit.unitNumber,
    unlockedUnitIds,
    totalCorrect,
    totalQuestions: answers.length,
    correctByLevel,
    totalByLevel,
  };
}

/**
 * Additively unlock all Roadmap units earned by a Placement Test result without
 * erasing any higher progress or downgrading a previously proven higher level,
 * increment `attemptsCount`, and award one-time XP.
 */
export function applyPlacementResultToRoadmap(
  state: RoadmapState,
  result: PlacementEvaluationResult,
  now: number = Date.now()
): {
  nextState: RoadmapState;
  newlyUnlockedCount: number;
  xpEarned: number;
  preservedHigherLevel: boolean;
} {
  const normalized = normalizeRoadmapState(state, now);
  const prev = normalized.placementResult;
  const unlockedSet = new Set<string>(normalized.unlockedUnitIds);
  const beforeCount = unlockedSet.size;
  for (const unitId of result.unlockedUnitIds) {
    unlockedSet.add(unitId);
  }
  const newlyUnlockedCount = Math.max(0, unlockedSet.size - beforeCount);
  const xpEarned = prev ? 0 : PLACEMENT_COMPLETION_XP;
  const nextAttemptsCount = (prev ? Math.max(1, prev.attemptsCount) : 0) + 1;

  const prevTargetIdx = prev
    ? CURRICULUM_UNITS.findIndex((u) => u.id === prev.targetUnitId)
    : -1;
  const newTargetIdx = CURRICULUM_UNITS.findIndex((u) => u.id === result.targetUnitId);
  const preservedHigherLevel = Boolean(prev && prevTargetIdx > newTargetIdx);

  const nextActiveUnitId = preservedHigherLevel
    ? normalized.activeUnitId
    : result.targetUnitId;

  const nextState: RoadmapState = {
    ...normalized,
    xp: normalized.xp + xpEarned,
    dailyXp: normalized.dailyXp + xpEarned,
    activeUnitId: nextActiveUnitId,
    unlockedUnitIds: [...unlockedSet],
    placementResult: preservedHigherLevel && prev
      ? {
          ...prev,
          unlockedCount: unlockedSet.size,
          completedAt: now,
          attemptsCount: nextAttemptsCount,
        }
      : {
          level: result.placedLevel,
          score: result.totalCorrect,
          total: result.totalQuestions,
          targetUnitId: result.targetUnitId,
          unlockedCount: unlockedSet.size,
          completedAt: now,
          attemptsCount: nextAttemptsCount,
        },
  };

  return { nextState, newlyUnlockedCount, xpEarned, preservedHigherLevel };
}

/**
 * Recommended active recall card levels (`settings.enabledLevels`) matching a tested CEFR tier.
 */
export function getRecommendedRecallLevelsForPlacement(level: CefrLevel): CefrLevel[] {
  switch (level) {
    case 'A1':
    case 'A2':
      return ['A1', 'A2'];
    case 'B1':
      return ['A2', 'B1'];
    case 'B2':
      return ['B1', 'B2'];
    case 'C1':
    case 'C2':
      return ['B2', 'C1'];
  }
}
