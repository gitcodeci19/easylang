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
import {
  buildFallbackRoadmapCoachBanner,
  isValidActiveRoadmapSession,
  summarizeRecentRoadmapLessons,
} from '../src/shared/roadmapCoach.ts';
import type {
  Card,
  RoadmapActiveSession,
  RoadmapLessonRecord,
} from '../src/shared/types.ts';

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

  // Practice (Node 3) and Unit Review (Node 4) include bidirectional EN->TR and TR->EN free translations
  const ex4 = buildUnitLessonExercises('u01_basics', 4, deckCards, {}, 99, 0);
  assert.ok(ex4.some((e) => e.kind === 'free_translation' && e.direction === 'en-to-tr'));
  assert.ok(ex4.some((e) => e.kind === 'free_translation' && e.direction === 'tr-to-en'));

  // Polysemous A1/A2 vocabulary includes clean everyday senses without archaic artifacts
  const spaceCard = deckCards.find((c) => c.id === 'w_space');
  assert.ok(spaceCard?.acceptedTr.includes('uzay'));
  assert.ok(spaceCard?.acceptedTr.includes('alan'));
  const fallCard = deckCards.find((c) => c.id === 'w_fall');
  assert.ok(fallCard?.acceptedTr.includes('sonbahar'));
  assert.ok(!fallCard?.acceptedTr.includes('fahişe'));
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

test('cleaned deck removes railway/Latin/archaic FreeDict artifacts from A1-B2 words', () => {
  const byId = new Map(deckCards.map((c) => [c.id, c]));

  const frog = byId.get('w_frog');
  assert.deepEqual(frog?.acceptedTr, ['kurbağa']);

  const elephant = byId.get('w_elephant');
  assert.ok(elephant?.acceptedTr.includes('fil'));
  assert.ok(!elephant?.acceptedTr.includes('külfetli'));

  const hello = byId.get('w_hello');
  assert.ok(hello?.acceptedTr.includes('merhaba'));

  const guitar = byId.get('w_guitar');
  assert.equal(guitar?.acceptedTr[0], 'gitar');

  const tooth = byId.get('w_tooth');
  assert.equal(tooth?.acceptedTr[0], 'diş');

  const shouldCard = byId.get('w_should');
  assert.ok(!shouldCard?.acceptedTr.some((t) => t.includes('vız gelir')));

  const spoon = byId.get('w_spoon');
  assert.ok(!spoon?.acceptedTr.includes('oynaşmak'));

  const lemon = byId.get('w_lemon');
  assert.ok(!lemon?.acceptedTr.includes('Citrus limon'));
  const carrot = byId.get('w_carrot');
  assert.ok(!carrot?.acceptedTr.includes('Daucus carota'));

  const wingItSentence = deckCards.find((c) => c.en === "I'll have to wing it.");
  assert.ok(wingItSentence, '"I\'ll have to wing it." sentence card should exist');
  assert.ok(
    wingItSentence.acceptedTr.some((t) => t.toLowerCase().includes('doğaçlama')),
    'wing it should map to natural Turkish idiom meaning (doğaçlama)'
  );
  assert.ok(
    !wingItSentence.acceptedTr.some((t) => t.toLowerCase().includes('kanadından')),
    'literal mistranslation must not appear'
  );

  // Spot check systematic A1/A2/B1/B2/C1 FreeDict cleanup (no archaic/OCR homonyms)
  assert.deepEqual(byId.get('w_truck')?.acceptedTr, ['kamyon', 'yük arabası']);
  assert.equal(byId.get('w_good')?.acceptedTr[0], 'iyi');
  assert.equal(byId.get('w_clock')?.acceptedTr[0], 'saat');
  assert.equal(byId.get('w_forty')?.acceptedTr[0], 'kırk');
  assert.equal(byId.get('w_cigarette')?.acceptedTr[0], 'sigara');
  assert.equal(byId.get('w_pet')?.acceptedTr[0], 'evcil hayvan');
  assert.equal(byId.get('w_plane')?.acceptedTr[0], 'uçak');
  assert.equal(byId.get('w_road')?.acceptedTr[0], 'yol');
  assert.equal(byId.get('w_yes')?.acceptedTr[0], 'evet');
  assert.equal(byId.get('w_write')?.acceptedTr[0], 'yazmak');
  assert.equal(byId.get('w_sunday')?.acceptedTr[0], 'pazar');
  assert.equal(byId.get('w_species')?.acceptedTr[0], 'tür');
  assert.equal(byId.get('w_swim')?.acceptedTr[0], 'yüzmek');
  assert.equal(byId.get('w_campus')?.acceptedTr[0], 'kampüs');
  assert.equal(byId.get('w_despite')?.acceptedTr[0], '-e rağmen');
  assert.equal(byId.get('w_pale')?.acceptedTr[0], 'solgun');

  // select_en & tr-to-en free_translation show a single meaning, and cloze_blank hides Turkish spoiler pre-check
  const sampleExercises = buildUnitLessonExercises('u02_animals', 1, deckCards, {}, 17, 0);
  for (const ex of sampleExercises) {
    if (ex.kind === 'select_en' || (ex.kind === 'free_translation' && ex.direction === 'tr-to-en')) {
      assert.equal(ex.promptText, ex.card.acceptedTr[0] ?? ex.card.exampleTr ?? '');
    }
    if (ex.kind === 'cloze_blank') {
      assert.equal(ex.promptSubtext, '');
      assert.ok((ex.postAnswerSubtext ?? '').length > 0);
    }
  }

  // If a missed sentence card is scheduled for spiral review in select_en,
  // promptText must show a single clean sentence (not ".,") and all distractors must be sentences.
  const reviewExercises = buildUnitLessonExercises(
    'u02_animals',
    0,
    deckCards,
    {
      [wingItSentence.id]: {
        cardId: wingItSentence.id,
        retryAt: null,
        retryCount: 0,
        nextDueAt: Date.now(),
        streak: 0,
        intervalDays: 1,
        totalCorrect: 0,
        totalWrong: 2,
        lastReviewedAt: Date.now(),
      },
    },
    77,
    1
  );
  const matchedSentenceSelectEn = reviewExercises.find(
    (ex) => ex.kind === 'select_en' && ex.card.id === wingItSentence.id
  );
  assert.ok(matchedSentenceSelectEn, 'Expected missed sentence card in select_en spiral review');
  assert.ok(!matchedSentenceSelectEn.promptText.includes('.,'));
  assert.equal(matchedSentenceSelectEn.promptText, wingItSentence.acceptedTr[0]);
  for (const ch of matchedSentenceSelectEn.choices ?? []) {
    assert.ok(ch.trim().split(/\s+/).length >= 2, `Expected sentence distractor, got "${ch}"`);
  }
});

function makeLessonRec(
  id: string,
  accuracyPct: number,
  mistakes: RoadmapLessonRecord['mistakes'],
  byKind: RoadmapLessonRecord['byKind']
): RoadmapLessonRecord {
  return {
    id,
    completedAt: Date.now(),
    unitId: 'u02_animals',
    unitTitleTr: 'Hayvanlar & Doğa',
    unitTitleEn: 'Animals & Nature',
    nodeIndex: 0,
    stepIndex: 0,
    accuracyPct,
    xpEarned: 15,
    totalQuestions: 8,
    firstTryCorrect: Math.round((8 * accuracyPct) / 100),
    repeatedMistakeCount: mistakes.filter((m) => m.repeatedWrong).length,
    strongWords: ['lion'],
    mistakes,
    byKind,
  };
}

test('summarizeRecentRoadmapLessons and buildFallbackRoadmapCoachBanner analyze strictly the last 5 lessons', () => {
  const oldestOutsideWindow = makeLessonRec(
    'old_1',
    40,
    [
      {
        cardId: 'w_ancient_slip',
        en: 'ancient',
        expected: 'eski',
        kind: 'select_meaning',
        direction: 'en-to-tr',
        wrongCount: 4,
        repeatedWrong: true,
        lastUserAnswer: 'yeni',
      },
    ],
    { select_meaning: { correct: 1, wrong: 4 } }
  );

  const greatLast5 = [1, 2, 3, 4, 5].map((n) =>
    makeLessonRec(`g_${n}`, 94, [], {
      select_meaning: { correct: 4, wrong: 0 },
      free_translation: { correct: 4, wrong: 0 },
    })
  );

  const greatBanner = buildFallbackRoadmapCoachBanner([oldestOutsideWindow, ...greatLast5], 'tr');
  assert.equal(greatBanner.status, 'great');
  assert.equal(greatBanner.lessonCountAnalyzed, 5);
  assert.ok(greatBanner.message.includes('İlerlemen çok iyi'));
  assert.ok(!greatBanner.message.includes('ancient'));

  const mixedLessons: RoadmapLessonRecord[] = [
    makeLessonRec(
      'm_1',
      75,
      [
        {
          cardId: 'w_frog',
          en: 'frog',
          expected: 'kurbağa',
          kind: 'free_translation',
          direction: 'tr-to-en',
          wrongCount: 2,
          repeatedWrong: true,
          lastUserAnswer: 'toad',
        },
      ],
      {
        free_translation: { correct: 1, wrong: 3 },
        select_meaning: { correct: 4, wrong: 0 },
      }
    ),
    makeLessonRec(
      'm_2',
      82,
      [
        {
          cardId: 'w_frog',
          en: 'frog',
          expected: 'kurbağa',
          kind: 'free_translation',
          direction: 'tr-to-en',
          wrongCount: 1,
          repeatedWrong: false,
          lastUserAnswer: 'forg',
        },
      ],
      {
        free_translation: { correct: 2, wrong: 2 },
        select_meaning: { correct: 4, wrong: 0 },
      }
    ),
  ];

  const summary = summarizeRecentRoadmapLessons(mixedLessons, 5);
  assert.equal(summary.recurringWords[0]?.en, 'frog');
  assert.equal(summary.recurringWords[0]?.wrongCount, 3);
  assert.equal(summary.weakKinds[0]?.kind, 'free_translation');

  const mixedBanner = buildFallbackRoadmapCoachBanner(mixedLessons, 'tr');
  assert.equal(mixedBanner.status, 'good');
  assert.ok(mixedBanner.message.includes('yazılı çeviri'));
  assert.ok(mixedBanner.message.includes('frog'));
});

test('isValidActiveRoadmapSession validates interrupted sessions including readyToFinish boundary', () => {
  const sampleQueue = buildUnitLessonExercises('u01_basics', 0, deckCards, {}, 7, 0);
  const validMid: RoadmapActiveSession = {
    version: 2,
    unitId: 'u01_basics',
    nodeIndex: 0,
    stepIndex: 0,
    queue: sampleQueue,
    currentIdx: 3,
    firstTryCorrectCount: 3,
    totalInitial: sampleQueue.length,
    combo: 3,
    maxCombo: 3,
    mistakesMap: {},
    strongWords: ['hello'],
    byKindStats: {},
    readyToFinish: false,
    updatedAt: Date.now(),
  };

  assert.equal(isValidActiveRoadmapSession(validMid), true);
  assert.equal(
    isValidActiveRoadmapSession({
      ...validMid,
      currentIdx: sampleQueue.length,
      readyToFinish: true,
    }),
    true
  );
  assert.equal(
    isValidActiveRoadmapSession({
      ...validMid,
      currentIdx: sampleQueue.length,
      readyToFinish: false,
    }),
    false
  );
  assert.equal(isValidActiveRoadmapSession({ ...validMid, queue: [] }), false);
  assert.equal(isValidActiveRoadmapSession(null), false);
});
