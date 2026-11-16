import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  CURRICULUM_UNITS,
  buildUnitLessonExercises,
  completeRoadmapNode,
  completeRoadmapNodeStep,
  computeRoadmapProgress,
  createInitialRoadmapState,
  getCardsForUnit,
} from '../src/shared/curriculum.ts';
import type { Card } from '../src/shared/types.ts';

const deckCards = JSON.parse(
  fs.readFileSync(path.resolve('public/data/cards.json'), 'utf8')
) as Card[];

test('CURRICULUM_UNITS defines 20 structured thematic units across 5 CEFR sections', () => {
  assert.equal(CURRICULUM_UNITS.length, 20);
  const animalsUnit = CURRICULUM_UNITS.find((u) => u.id === 'u02_animals');
  const sportsUnit = CURRICULUM_UNITS.find((u) => u.id === 'u06_sports');
  const cinemaUnit = CURRICULUM_UNITS.find((u) => u.id === 'u07_cinema');
  const freqUnit = CURRICULUM_UNITS.find((u) => u.id === 'u05_frequency');
  const safetyUnit = CURRICULUM_UNITS.find((u) => u.id === 'u10_imperatives_safety');

  assert.ok(animalsUnit, 'Animals unit must exist');
  assert.ok(sportsUnit, 'Sports unit must exist');
  assert.ok(cinemaUnit, 'Cinema unit must exist');
  assert.ok(freqUnit, 'Frequency adverbs unit must exist');
  assert.ok(safetyUnit, 'Safety & imperatives unit must exist');

  for (const unit of CURRICULUM_UNITS) {
    assert.equal(unit.nodes.length, 5);
    assert.ok(unit.guidebook.tipTitleTr.length > 0);
    assert.ok(unit.guidebook.keyPhrases.length > 0);
  }
});

test('getCardsForUnit retrieves rich thematic cards for Animals, Sports, and Cinema', () => {
  const animalCards = getCardsForUnit('u02_animals', deckCards);
  const sportCards = getCardsForUnit('u06_sports', deckCards);
  const cinemaCards = getCardsForUnit('u07_cinema', deckCards);

  assert.ok(animalCards.length >= 40, `Expected >= 40 animal cards, got ${animalCards.length}`);
  assert.ok(sportCards.length >= 40, `Expected >= 40 sport cards, got ${sportCards.length}`);
  assert.ok(cinemaCards.length >= 40, `Expected >= 40 cinema cards, got ${cinemaCards.length}`);

  assert.ok(animalCards.some((c) => c.en === 'lion' || c.en === 'dolphin'));
  assert.ok(sportCards.some((c) => c.en === 'referee' || c.en === 'stadium'));
  assert.ok(cinemaCards.some((c) => c.en === 'director' || c.en === 'subtitles'));
});

test('completeRoadmapNode awards XP, claims mid-unit chest, and unlocks next unit upon completion', () => {
  let state = createInitialRoadmapState();

  // Complete nodes 0, 1, 2 of Unit 1 -> should auto-claim chest (+25 XP) on node 2
  const r0 = completeRoadmapNode(state, 'u01_basics', 0);
  state = r0.nextState;
  assert.equal(r0.xpEarned, 15);

  const r1 = completeRoadmapNode(state, 'u01_basics', 1);
  state = r1.nextState;
  assert.equal(r1.xpEarned, 15);

  const r2 = completeRoadmapNode(state, 'u01_basics', 2);
  state = r2.nextState;
  // 20 XP for duo_radio + 25 XP chest bonus = 45 XP
  assert.equal(r2.xpEarned, 45);
  assert.ok(state.claimedChestUnitIds.includes('u01_basics'));

  // Complete nodes 3 and 4 -> Unit 1 completes and unlocks Unit 2 (u02_animals)
  state = completeRoadmapNode(state, 'u01_basics', 3).nextState;
  const r4 = completeRoadmapNode(state, 'u01_basics', 4);
  state = r4.nextState;
  assert.equal(r4.unitJustCompleted, true);
  assert.ok(state.unlockedUnitIds.includes('u02_animals'));
  assert.equal(state.activeUnitId, 'u02_animals');
});

test('completeRoadmapNode with jump_test ("BURAYA ATLA!") unlocks target unit and prior units', () => {
  const initial = createInitialRoadmapState();
  const jumpRes = completeRoadmapNode(initial, 'u07_cinema', 'jump_test');

  assert.ok(jumpRes.nextState.unlockedUnitIds.includes('u07_cinema'));
  assert.ok(jumpRes.nextState.unlockedUnitIds.includes('u06_sports'));
  assert.ok(jumpRes.nextState.completedNodeIds.includes('u07_cinema:0'));

  const computed = computeRoadmapProgress(jumpRes.nextState, deckCards, {});
  const cinemaProg = computed.find((u) => u.unit.id === 'u07_cinema');
  assert.equal(cinemaProg?.isUnlocked, true);
  assert.equal(cinemaProg?.nodes[0]?.status, 'completed');
  assert.equal(cinemaProg?.nodes[1]?.status, 'active');
});

test('buildUnitLessonExercises builds 8 varied scaffolded exercises per step with disjoint cohorts and spiral review', () => {
  const step0 = buildUnitLessonExercises('u01_basics', 0, deckCards, {}, 42, 0);
  const step1 = buildUnitLessonExercises('u01_basics', 0, deckCards, {}, 42, 1);
  const step2 = buildUnitLessonExercises('u01_basics', 0, deckCards, {}, 42, 2);

  assert.equal(step0.length, 8);
  assert.equal(step1.length, 8);
  assert.equal(step2.length, 8);

  // First question of Step 0, Step 1, Step 2 must introduce different words (no repeated opening question)
  assert.notEqual(step0[0]?.card.id, step1[0]?.card.id);
  assert.notEqual(step1[0]?.card.id, step2[0]?.card.id);

  assert.ok(step0.some((e) => e.kind === 'select_meaning'));
  assert.ok(step0.some((e) => e.kind === 'cloze_blank'));
  assert.ok(step0.some((e) => e.kind === 'word_bank'));
  assert.ok(step0.some((e) => e.kind === 'free_translation'));

  const ex2 = buildUnitLessonExercises('u06_sports', 2, deckCards, {}, 99, 0);
  assert.equal(ex2.length, 8);
  assert.ok(ex2.some((e) => e.kind === 'audio_dictation'));
});

test('completeRoadmapNodeStep requires 3 steps (1/3 -> 2/3 -> 3/3) to complete a node', () => {
  let state = createInitialRoadmapState();

  const s1 = completeRoadmapNodeStep(state, 'u01_basics', 0);
  state = s1.nextState;
  assert.equal(s1.completedSteps, 1);
  assert.equal(s1.totalSteps, 3);
  assert.equal(s1.nodeJustCompleted, false);

  const s2 = completeRoadmapNodeStep(state, 'u01_basics', 0);
  state = s2.nextState;
  assert.equal(s2.completedSteps, 2);
  assert.equal(s2.nodeJustCompleted, false);

  const s3 = completeRoadmapNodeStep(state, 'u01_basics', 0);
  state = s3.nextState;
  assert.equal(s3.completedSteps, 3);
  assert.equal(s3.nodeJustCompleted, true);
  assert.ok(state.completedNodeIds.includes('u01_basics:0'));
});
