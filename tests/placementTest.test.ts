import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  createInitialRoadmapState,
  CURRICULUM_UNITS,
  normalizeRoadmapState,
} from '../src/shared/curriculum.ts';
import {
  applyPlacementResultToRoadmap,
  buildPlacementTestQuestions,
  evaluatePlacementAnswers,
  formatLessonProgressCounter,
  getPlacementAvailability,
  getRecommendedRecallLevelsForPlacement,
  PLACEMENT_COMPLETION_XP,
  PLACEMENT_RETAKE_COOLDOWN_MS,
  PLACEMENT_TOTAL_QUESTIONS,
  type PlacementAnswerRecord,
} from '../src/shared/placementTest.ts';
import type { Card } from '../src/shared/types.ts';

const deckCards = JSON.parse(
  fs.readFileSync(path.resolve('public/data/cards.json'), 'utf8')
) as Card[];

test('buildPlacementTestQuestions generates 15 unique progressive A1-C1 multiple-choice questions across seeds', () => {
  const expectedTiers = [
    'A1', 'A1', 'A1',
    'A2', 'A2', 'A2',
    'B1', 'B1', 'B1',
    'B2', 'B2', 'B2',
    'C1', 'C1', 'C1',
  ];

  for (const seed of [101, 20261121, 1795252962533]) {
    const questions = buildPlacementTestQuestions(deckCards, seed);
    assert.equal(questions.length, PLACEMENT_TOTAL_QUESTIONS);
    assert.equal(questions.length, 15);
    assert.deepEqual(
      questions.map((q) => q.tier),
      expectedTiers
    );

    const seenCards = new Set<string>();
    for (const q of questions) {
      assert.ok(!seenCards.has(q.exercise.card.id), `Duplicate card in placement test: ${q.exercise.card.id}`);
      seenCards.add(q.exercise.card.id);

      assert.ok(
        q.exercise.kind === 'select_meaning' ||
          q.exercise.kind === 'cloze_blank' ||
          q.exercise.kind === 'select_en',
        `Expected fast multiple-choice kind, got ${q.exercise.kind}`
      );
      const choices = q.exercise.choices ?? [];
      assert.equal(choices.length, 4, `Expected 4 choices for ${q.id}`);
      assert.equal(new Set(choices.map((c) => c.trim().toLowerCase())).size, 4);
      assert.ok(
        choices.some(
          (c) => c.trim().toLowerCase() === (q.exercise.correctChoice ?? '').trim().toLowerCase()
        ),
        `Correct choice missing from choices for ${q.id}`
      );
    }
  }
});

test('evaluatePlacementAnswers places learners fairly by 3-per-tier mastery and prevents lucky C1 guesses', () => {
  const mk = (a1: number, a2: number, b1: number, b2: number, c1: number): PlacementAnswerRecord[] => {
    const out: PlacementAnswerRecord[] = [];
    const tiers: Array<['A1' | 'A2' | 'B1' | 'B2' | 'C1', number]> = [
      ['A1', a1],
      ['A2', a2],
      ['B1', b1],
      ['B2', b2],
      ['C1', c1],
    ];
    for (const [tier, count] of tiers) {
      out.push({ tier, isCorrect: count >= 1 });
      out.push({ tier, isCorrect: count >= 2 });
      out.push({ tier, isCorrect: count >= 3 });
    }
    return out;
  };

  // Complete beginner -> Unit 1 (A1)
  const beginner = evaluatePlacementAnswers(mk(0, 0, 0, 0, 0));
  assert.equal(beginner.placedLevel, 'A1');
  assert.equal(beginner.targetUnitNumber, 1);
  assert.equal(beginner.unlockedUnitIds.length, 1);

  // Lucky C1 guesses with missed A1/A2 -> still stays safely at A1 Unit 1
  const lucky = evaluatePlacementAnswers(mk(0, 0, 0, 0, 2));
  assert.equal(lucky.placedLevel, 'A1');
  assert.equal(lucky.targetUnitNumber, 1);

  // Solid A1 + A2 -> A2 mid/upper
  const solidA2 = evaluatePlacementAnswers(mk(3, 2, 0, 0, 0));
  assert.equal(solidA2.placedLevel, 'A2');
  assert.equal(solidA2.targetUnitNumber, 8);
  assert.equal(solidA2.unlockedUnitIds.length, 8);

  // Solid A1 + A2 + B1 (2/3) -> unlocks through B1 Unit 11
  const midB1 = evaluatePlacementAnswers(mk(2, 2, 2, 0, 0));
  assert.equal(midB1.placedLevel, 'B1');
  assert.equal(midB1.targetUnitNumber, 11);
  assert.equal(midB1.unlockedUnitIds.length, 11);

  // Aced B1 (3/3) -> unlocks through Unit 14
  const upperB1 = evaluatePlacementAnswers(mk(3, 2, 3, 0, 0));
  assert.equal(upperB1.placedLevel, 'B1');
  assert.equal(upperB1.targetUnitNumber, 14);

  // Solid B2 (2/3, tolerates 1 slip!) -> unlocks through B2 Unit 16
  const solidB2 = evaluatePlacementAnswers(mk(3, 3, 2, 2, 0));
  assert.equal(solidB2.placedLevel, 'B2');
  assert.equal(solidB2.targetUnitNumber, 16);
  assert.equal(solidB2.unlockedUnitIds.length, 16);

  // Aced B2 (3/3) -> unlocks through B2 Unit 18
  const upperB2 = evaluatePlacementAnswers(mk(3, 3, 3, 3, 0));
  assert.equal(upperB2.placedLevel, 'B2');
  assert.equal(upperB2.targetUnitNumber, 18);
  assert.equal(upperB2.unlockedUnitIds.length, 18);

  // Strong B2 + C1 (2/3) -> unlocks through C1 Unit 19
  const midC1 = evaluatePlacementAnswers(mk(3, 3, 2, 2, 2));
  assert.equal(midC1.placedLevel, 'C1');
  assert.equal(midC1.targetUnitNumber, 19);

  // Perfect 15/15 -> unlocks all 20 units (C1)
  const perfect = evaluatePlacementAnswers(mk(3, 3, 3, 3, 3));
  assert.equal(perfect.placedLevel, 'C1');
  assert.equal(perfect.targetUnitNumber, CURRICULUM_UNITS.length);
  assert.equal(perfect.unlockedUnitIds.length, CURRICULUM_UNITS.length);

  assert.deepEqual(getRecommendedRecallLevelsForPlacement('B2'), ['B1', 'B2']);
  assert.deepEqual(getRecommendedRecallLevelsForPlacement('C1'), ['B2', 'C1']);
});

test('applyPlacementResultToRoadmap unlocks additively, survives normalization, and grants XP once', () => {
  const initial = createInitialRoadmapState(1_700_000_000_000);
  const mk = (a1: number, a2: number, b1: number, b2: number, c1: number): PlacementAnswerRecord[] => {
    const out: PlacementAnswerRecord[] = [];
    const tiers: Array<['A1' | 'A2' | 'B1' | 'B2' | 'C1', number]> = [
      ['A1', a1],
      ['A2', a2],
      ['B1', b1],
      ['B2', b2],
      ['C1', c1],
    ];
    for (const [tier, count] of tiers) {
      out.push({ tier, isCorrect: count >= 1 });
      out.push({ tier, isCorrect: count >= 2 });
      out.push({ tier, isCorrect: count >= 3 });
    }
    return out;
  };
  const b2Result = evaluatePlacementAnswers(mk(3, 3, 2, 2, 0));

  const firstApply = applyPlacementResultToRoadmap(initial, b2Result, 1_700_000_000_000);
  assert.equal(firstApply.xpEarned, PLACEMENT_COMPLETION_XP);
  assert.equal(firstApply.newlyUnlockedCount, 15);
  assert.equal(firstApply.nextState.unlockedUnitIds.length, 16);
  assert.equal(firstApply.nextState.activeUnitId, 'u16_business');
  assert.equal(firstApply.nextState.placementResult?.level, 'B2');

  // Round-trip through normalizeRoadmapState preserves unlocked units and placement metadata
  const normalized = normalizeRoadmapState(firstApply.nextState, 1_700_000_000_000);
  assert.equal(normalized.unlockedUnitIds.length, 16);
  assert.equal(normalized.placementResult?.score, 10);
  assert.equal(normalized.placementResult?.total, 15);
  assert.equal(normalized.placementResult?.targetUnitId, 'u16_business');

  // Retaking with lower score never removes previously unlocked units, preserves higher level, and starts 7-day cooldown
  const lowerResult = evaluatePlacementAnswers(mk(1, 0, 0, 0, 0));
  const secondTs = 1_700_000_050_000;
  const secondApply = applyPlacementResultToRoadmap(normalized, lowerResult, secondTs);
  assert.equal(secondApply.xpEarned, 0);
  assert.equal(secondApply.preservedHigherLevel, true);
  assert.equal(secondApply.nextState.unlockedUnitIds.length, 16);
  assert.equal(secondApply.nextState.activeUnitId, 'u16_business');
  assert.equal(secondApply.nextState.placementResult?.level, 'B2');
  assert.equal(secondApply.nextState.placementResult?.attemptsCount, 2);
});

test('getPlacementAvailability allows 2 consecutive attempts then enforces a 7-day cooldown', () => {
  const t0 = 1_700_000_000_000;
  const DAY = 86_400_000;
  const fresh = createInitialRoadmapState(t0);

  // Before attempt 1 -> allowed, 2 immediate attempts left
  const a0 = getPlacementAvailability(fresh, t0);
  assert.equal(a0.canTake, true);
  assert.equal(a0.freeImmediateRemaining, 2);
  assert.equal(a0.attemptsCount, 0);

  const sampleResult = evaluatePlacementAnswers([
    { tier: 'A1', isCorrect: true },
    { tier: 'A1', isCorrect: true },
    { tier: 'A1', isCorrect: true },
    { tier: 'A2', isCorrect: true },
    { tier: 'A2', isCorrect: true },
    { tier: 'A2', isCorrect: false },
    { tier: 'B1', isCorrect: false },
    { tier: 'B1', isCorrect: false },
    { tier: 'B1', isCorrect: false },
    { tier: 'B2', isCorrect: false },
    { tier: 'B2', isCorrect: false },
    { tier: 'B2', isCorrect: false },
    { tier: 'C1', isCorrect: false },
    { tier: 'C1', isCorrect: false },
    { tier: 'C1', isCorrect: false },
  ]);

  // After attempt 1 -> STILL immediately allowed (1 free immediate retake left)
  const after1 = applyPlacementResultToRoadmap(fresh, sampleResult, t0).nextState;
  const a1 = getPlacementAvailability(after1, t0 + 1000);
  assert.equal(a1.canTake, true);
  assert.equal(a1.freeImmediateRemaining, 1);
  assert.equal(a1.attemptsCount, 1);

  // After attempt 2 -> locked for 7 days
  const t2 = t0 + 60_000;
  const after2 = applyPlacementResultToRoadmap(after1, sampleResult, t2).nextState;
  const a2Immediate = getPlacementAvailability(after2, t2 + 1000);
  assert.equal(a2Immediate.canTake, false);
  assert.equal(a2Immediate.daysRemaining, 7);
  assert.equal(a2Immediate.attemptsCount, 2);

  // 3 days later -> 4 days remaining
  const a2Mid = getPlacementAvailability(after2, t2 + 3 * DAY);
  assert.equal(a2Mid.canTake, false);
  assert.equal(a2Mid.daysRemaining, 4);

  // Exactly 7 days later -> unlocked again
  const a2Unlocked = getPlacementAvailability(after2, t2 + PLACEMENT_RETAKE_COOLDOWN_MS);
  assert.equal(a2Unlocked.canTake, true);
  assert.equal(a2Unlocked.daysRemaining, 0);
});

test('formatLessonProgressCounter clearly reports current index and remaining questions in TR and EN', () => {
  assert.deepEqual(formatLessonProgressCounter(0, 8, false, true), {
    indexText: 'Soru 1 / 8',
    remainingText: 'Kalan: 8 soru',
    isLast: false,
    isDone: false,
  });
  assert.deepEqual(formatLessonProgressCounter(0, 8, true, true), {
    indexText: 'Soru 1 / 8',
    remainingText: 'Kalan: 7 soru',
    isLast: false,
    isDone: false,
  });
  assert.deepEqual(formatLessonProgressCounter(7, 8, false, true), {
    indexText: 'Soru 8 / 8',
    remainingText: 'Son soru!',
    isLast: true,
    isDone: false,
  });
  assert.deepEqual(formatLessonProgressCounter(7, 8, true, true), {
    indexText: 'Soru 8 / 8',
    remainingText: 'Son soru bitti ✓',
    isLast: false,
    isDone: true,
  });
  assert.deepEqual(formatLessonProgressCounter(2, 10, false, false), {
    indexText: 'Q 3 / 10',
    remainingText: '8 left',
    isLast: false,
    isDone: false,
  });
});
