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
  computeRoadmapAccuracyStats,
  isValidActiveRoadmapSession,
  summarizeRecentRoadmapLessons,
} from '../src/shared/roadmapCoach.ts';
import {
  cancelEnglishSpeech,
  formatTextForEnglishTts,
  hasBrowserNaturalEnglishVoice,
  pickBestEnglishVoice,
  shouldUseNeuralTts,
  speakEnglishText,
} from '../src/shared/speech.ts';
import {
  ACTIVE_ROADMAP_SESSION_VERSION,
  type Card,
  type RoadmapActiveSession,
  type RoadmapLessonRecord,
  type UserCardProgress,
} from '../src/shared/types.ts';
import { computeTrayInsertionIndex } from '../src/shared/wordBankDrag.ts';

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

  // Regression: exampleEn mentions and idioms must not pull unrelated B2/C1 words into thematic units
  const animalIds = new Set(animalCards.map((c) => c.id));
  for (const leakedId of ['w_inch', 'w_mount', 's_0273']) {
    assert.ok(!animalIds.has(leakedId), `u02_animals must not include ${leakedId}`);
  }
  assert.ok(!animalCards.some((c) => /\b(wing it|left wing|let the cat out of the bag)\b/i.test(c.en)));
  assert.ok(!sportCards.some((c) => /\b(run out|in the long run)\b/i.test(c.en)));

  const shoppingCards = getCardsForUnit('u09_shopping', deckCards);
  assert.ok(!shoppingCards.some((c) => /\bpay attention\b/i.test(c.en)));

  const healthCards = getCardsForUnit('u11_health', deckCards);
  assert.ok(!healthCards.some((c) => /\bby heart\b/i.test(c.en)));

  const lawCards = getCardsForUnit('u20_law_philosophy', deckCards);
  assert.ok(!lawCards.some((c) => /\bmother-in-law\b/i.test(c.en)));
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

test('completeRoadmapNodeStep requires 5 steps (1/5 -> 2/5 -> 3/5 -> 4/5 -> 5/5) to complete a node', () => {
  let state = createInitialRoadmapState();

  for (let expectedStep = 1; expectedStep <= 4; expectedStep += 1) {
    const res = completeRoadmapNodeStep(state, 'u01_basics', 0);
    state = res.nextState;
    assert.equal(res.completedSteps, expectedStep);
    assert.equal(res.totalSteps, 5);
    assert.equal(res.nodeJustCompleted, false);
  }

  const s5 = completeRoadmapNodeStep(state, 'u01_basics', 0);
  state = s5.nextState;
  assert.equal(s5.completedSteps, 5);
  assert.equal(s5.totalSteps, 5);
  assert.equal(s5.nodeJustCompleted, true);
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

  // select_en & tr-to-en free_translation show a single meaning; cloze_blank & audio_dictation hide Turkish spoiler pre-check and reveal after
  const sampleExercises = [
    ...buildUnitLessonExercises('u02_animals', 1, deckCards, {}, 17, 0),
    ...buildUnitLessonExercises('u02_animals', 2, deckCards, {}, 17, 0),
  ];
  for (const ex of sampleExercises) {
    if (ex.kind === 'select_en' || (ex.kind === 'free_translation' && ex.direction === 'tr-to-en')) {
      assert.equal(ex.promptText, ex.card.acceptedTr[0] ?? ex.card.exampleTr ?? '');
    }
    if (ex.kind === 'audio_dictation') {
      assert.equal(ex.promptSubtext, '');
      assert.ok((ex.postAnswerSubtext ?? '').length > 0);
    }
    if (ex.kind === 'cloze_blank') {
      // cloze_blank displays the Turkish sentence cue pre-check so frequency/context blanks are unambiguous
      assert.ok(ex.promptSubtext.trim().length > 0);
      assert.ok((ex.postAnswerSubtext ?? '').length > 0);
    }
  }

  // If a missed sentence card not already in the fresh cohort is scheduled for spiral review in select_en,
  // promptText must show a single clean sentence (not ".,") and all distractors must be sentences.
  const animalCardsPool = getCardsForUnit('u02_animals', deckCards);
  const baselineStepCardIds = new Set(
    buildUnitLessonExercises('u02_animals', 0, deckCards, {}, 77, 1).map((ex) => ex.card.id)
  );
  const animalSentence =
    animalCardsPool.find((c) => c.type === 'sentence' && !baselineStepCardIds.has(c.id) && c.acceptedTr.length > 1) ??
    animalCardsPool.find((c) => c.type === 'sentence' && !baselineStepCardIds.has(c.id));
  assert.ok(animalSentence, 'Expected an animal sentence card in u02_animals outside baseline cohort');
  const reviewExercises = buildUnitLessonExercises(
    'u02_animals',
    0,
    deckCards,
    {
      [animalSentence.id]: {
        cardId: animalSentence.id,
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
    (ex) => ex.kind === 'select_en' && ex.card.id === animalSentence.id
  );
  assert.ok(matchedSentenceSelectEn, 'Expected missed sentence card in select_en spiral review');
  assert.ok(!matchedSentenceSelectEn.promptText.includes('.,'));
  assert.equal(matchedSentenceSelectEn.promptText, animalSentence.acceptedTr[0]);
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
    version: ACTIVE_ROADMAP_SESSION_VERSION,
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

test('formatTextForEnglishTts expands awkward contractions like "we\'ve" and pickBestEnglishVoice avoids non-English voices', () => {
  assert.equal(formatTextForEnglishTts("we've", true), 'we have');
  assert.equal(formatTextForEnglishTts("We've been waiting.", true), 'We have been waiting.');
  assert.equal(formatTextForEnglishTts("I've", true), 'I have');
  assert.equal(formatTextForEnglishTts("i've finished", true), 'I have finished');
  assert.equal(formatTextForEnglishTts("I'm ready.", false), 'I am ready.');

  const mixedLocalAndCloud = [
    { lang: 'tr-TR', name: 'Microsoft Tolga - Turkish', localService: true },
    { lang: 'en-US', name: 'Google US English', localService: false },
    { lang: 'en-US', name: 'Microsoft David - English (United States)', localService: true },
  ] as unknown as SpeechSynthesisVoice[];

  const pickedNatural = pickBestEnglishVoice(mixedLocalAndCloud, true);
  assert.equal(pickedNatural?.lang, 'en-US');
  assert.equal(pickedNatural?.name, 'Google US English');

  const pickedLocal = pickBestEnglishVoice(mixedLocalAndCloud, false);
  assert.equal(pickedLocal?.lang, 'en-US');
  assert.equal(pickedLocal?.localService, true);

  const cloudOnlyVoices = [
    { lang: 'tr-TR', name: 'Microsoft Tolga - Turkish', localService: true },
    { lang: 'en-GB', name: 'Google UK English Male', localService: false },
    { lang: 'en-US', name: 'Google US English', localService: false },
  ] as unknown as SpeechSynthesisVoice[];

  const pickedCloudFallback = pickBestEnglishVoice(cloudOnlyVoices);
  assert.equal(pickedCloudFallback?.lang, 'en-US');
  assert.equal(pickedCloudFallback?.name, 'Google US English');

  const trOnly = [
    { lang: 'tr-TR', name: 'Microsoft Tolga - Turkish', localService: true },
  ] as unknown as SpeechSynthesisVoice[];
  assert.equal(pickBestEnglishVoice(trOnly), null);

  const braveOfflineVoices = [
    { lang: 'tr-TR', name: 'Microsoft Tolga - Turkish', localService: true },
    { lang: 'en-US', name: 'Microsoft David - English (United States)', localService: true },
    { lang: 'en-US', name: 'Microsoft Zira - English (United States)', localService: true },
  ] as unknown as SpeechSynthesisVoice[];

  const edgeNaturalVoices = [
    { lang: 'en-US', name: 'Microsoft Aria Online (Natural) - English (United States)', localService: false },
  ] as unknown as SpeechSynthesisVoice[];

  assert.equal(hasBrowserNaturalEnglishVoice(mixedLocalAndCloud), true);
  assert.equal(hasBrowserNaturalEnglishVoice(edgeNaturalVoices), true);
  assert.equal(hasBrowserNaturalEnglishVoice(braveOfflineVoices), false);
  assert.equal(hasBrowserNaturalEnglishVoice(trOnly), false);

  // Piper neural voice is permanently active for all English speech across every browser and mode
  assert.equal(shouldUseNeuralTts('hybrid', braveOfflineVoices, false), true);
  assert.equal(shouldUseNeuralTts('hybrid', braveOfflineVoices, true), true);
  assert.equal(shouldUseNeuralTts('hybrid', mixedLocalAndCloud, false), true);
  assert.equal(shouldUseNeuralTts('hybrid', edgeNaturalVoices, false), true);
  assert.equal(shouldUseNeuralTts('neural', mixedLocalAndCloud, false), true);
  assert.equal(shouldUseNeuralTts('neural', mixedLocalAndCloud, true), true);
  assert.equal(shouldUseNeuralTts('local', braveOfflineVoices, false), true);
});

test('speakEnglishText permanently routes through Piper neural TTS and queues rapid quick-tile clicks', () => {
  const g = globalThis as unknown as {
    chrome?: unknown;
    window?: unknown;
  };
  const origChrome = g.chrome;
  const origWindow = g.window;

  const sentMessages: Array<{ type: string; text?: string; queue?: boolean }> = [];
  let browserSpeakCalls = 0;

  g.window = {
    speechSynthesis: {
      speak: () => {
        browserSpeakCalls += 1;
      },
      cancel: () => {},
    },
  };
  g.chrome = {
    runtime: {
      sendMessage: (msg: { type: string; text?: string; queue?: boolean }) => {
        sentMessages.push(msg);
        return Promise.resolve({ ok: true });
      },
    },
  };

  try {
    cancelEnglishSpeech();
    sentMessages.length = 0;

    // 1. Rapid consecutive tile taps queue via SPEAK_NEURAL_TTS without touching browser speechSynthesis
    speakEnglishText('This', 1.0, { isQuickTile: true });
    speakEnglishText('tea', 1.0, { isQuickTile: true });
    speakEnglishText('is', 1.0, { isQuickTile: true });

    assert.equal(browserSpeakCalls, 0, 'Browser speechSynthesis.speak must never be called');
    assert.deepEqual(
      sentMessages.map((m) => ({ type: m.type, text: m.text, queue: m.queue })),
      [
        { type: 'SPEAK_NEURAL_TTS', text: 'This', queue: true },
        { type: 'SPEAK_NEURAL_TTS', text: 'tea', queue: true },
        { type: 'SPEAK_NEURAL_TTS', text: 'is', queue: true },
      ]
    );

    // 2. Normal sentence playback interrupts queued tiles (queue: false)
    speakEnglishText('This tea is very nice.', 1.0);
    assert.deepEqual(sentMessages[sentMessages.length - 1], {
      type: 'SPEAK_NEURAL_TTS',
      text: 'This tea is very nice.',
      rate: 1,
      reqId: sentMessages[sentMessages.length - 1] && (sentMessages[sentMessages.length - 1] as { reqId?: number }).reqId,
      queue: false,
    });

    // 3. Tapping two tiles rapidly after a normal sentence interrupts the sentence on tile 1 (queue: false)
    // and queues tile 2 right behind tile 1 (queue: true)
    sentMessages.length = 0;
    speakEnglishText('This', 1.0, { isQuickTile: true });
    speakEnglishText('tea', 1.0, { isQuickTile: true });
    assert.deepEqual(
      sentMessages.map((m) => ({ type: m.type, text: m.text, queue: m.queue })),
      [
        { type: 'SPEAK_NEURAL_TTS', text: 'This', queue: false },
        { type: 'SPEAK_NEURAL_TTS', text: 'tea', queue: true },
      ]
    );
  } finally {
    cancelEnglishSpeech();
    g.chrome = origChrome;
    g.window = origWindow;
  }
});

test('multiple-choice answer positions are well-distributed for large Date.now()-style seeds', () => {
  const positionCounts = new Map<number, number>([
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ]);
  const baseTimestamp = 1795029000000;
  for (let offset = 0; offset < 25; offset += 1) {
    const exercises = buildUnitLessonExercises('u02_animals', 0, deckCards, {}, baseTimestamp + offset * 137, 0);
    for (const ex of exercises) {
      if (ex.choices && ex.correctChoice && ex.choices.length === 4) {
        const idx = ex.choices.indexOf(ex.correctChoice);
        assert.ok(idx >= 0 && idx <= 3);
        positionCounts.set(idx, (positionCounts.get(idx) ?? 0) + 1);
      }
    }
  }
  // Every answer slot 0..3 must be represented meaningfully instead of locking onto slot 3
  for (const slot of [0, 1, 2, 3]) {
    assert.ok((positionCounts.get(slot) ?? 0) >= 10, `Expected slot ${slot} to appear >= 10 times, got ${positionCounts.get(slot)}`);
  }
});

test('spiral review releases recovered words after streak >= 2 and modern sentences integrate cleanly without cross-unit leakage', () => {
  // 1. Modern sentences (including GTA 6, rock music, and C1 science/law) exist with stable m_ IDs
  const gtaCard = deckCards.find((c) => c.en === "I can't wait to play GTA 6.");
  const rockCard = deckCards.find((c) => c.en === 'I feel good when I listen to rock music.');
  assert.ok(gtaCard && gtaCard.id.startsWith('m_'), 'Expected GTA 6 modern sentence card');
  assert.ok(rockCard && rockCard.id.startsWith('m_'), 'Expected rock music modern sentence card');
  assert.equal(gtaCard.unitId, 'u07_cinema');

  const c1Sentences = deckCards.filter((c) => c.type === 'sentence' && c.level === 'C1');
  assert.ok(c1Sentences.length >= 40, `Expected >= 40 C1 sentences, got ${c1Sentences.length}`);

  // Explicit-unit modern card stays exclusive to its unit (e.g. sea turtles m_ card only in u02_animals)
  const turtlesCard = deckCards.find((c) => c.en.includes('sea turtles swimming near the quiet beach'));
  assert.ok(turtlesCard && turtlesCard.unitId === 'u02_animals');
  const travelPool = getCardsForUnit('u08_travel', deckCards);
  assert.ok(!travelPool.some((c) => c.id === turtlesCard.id));

  // 2. Clean modern examples replaced awkward Tatoeba lines on wing & inch
  const wingCard = deckCards.find((c) => c.id === 'w_wing');
  assert.ok(wingCard && !wingCard.exampleEn.toLowerCase().includes('communism'));
  const inchCard = deckCards.find((c) => c.id === 'w_inch');
  assert.ok(inchCard && inchCard.exampleEn.toLowerCase().includes('monitor'));

  // 3. A word missed once in Step 0 and then answered right twice must NOT lock into every subsequent step
  const animalWords = getCardsForUnit('u02_animals', deckCards).filter((c) => c.type === 'word');
  const recoveredWord = animalWords[0]!;
  const recoveredProgress: Record<string, UserCardProgress> = {
    [recoveredWord.id]: {
      cardId: recoveredWord.id,
      retryAt: null,
      retryCount: 0,
      nextDueAt: Date.now() + 86_400_000,
      streak: 3,
      intervalDays: 7,
      totalCorrect: 4,
      totalWrong: 1,
      lastReviewedAt: Date.now(),
    },
  };
  let appearancesAcross25Steps = 0;
  for (let node = 0; node < 5; node += 1) {
    for (let step = 0; step < 5; step += 1) {
      const exs = buildUnitLessonExercises('u02_animals', node, deckCards, recoveredProgress, 1795000000000 + node * 100 + step, step);
      for (const ex of exs) {
        if (ex.card.id === recoveredWord.id) appearancesAcross25Steps += 1;
      }
    }
  }
  assert.ok(
    appearancesAcross25Steps <= 4,
    `Expected recovered word to appear <= 4 times across 25 steps (not locked into every lesson), got ${appearancesAcross25Steps}`
  );

  // 4. Cloze blank properly masks irregular phrasal verb inflections ("break down" -> "broke down")
  const breakDownExercises = buildUnitLessonExercises('u15_phrasal_verbs', 0, deckCards, {}, 123, 1);
  const allPhrasalCloze = [
    ...breakDownExercises,
    ...buildUnitLessonExercises('u15_phrasal_verbs', 1, deckCards, {}, 123, 1),
    ...buildUnitLessonExercises('u15_phrasal_verbs', 3, deckCards, {}, 123, 0),
  ].filter((e) => e.kind === 'cloze_blank' && e.card.en === 'break down');
  for (const ex of allPhrasalCloze) {
    assert.equal(ex.correctChoice?.toLowerCase(), 'broke down');
    assert.ok(ex.promptText.includes('_______'));
  }
});

test('computeTrayInsertionIndex allows dropping word-bank tiles into any position (start, middle gaps, end, and multi-row)', () => {
  // Empty tray -> index 0
  assert.equal(computeTrayInsertionIndex([], 120, 200), 0);

  // Single row: [My] (20..60), [uncle's] (66..136), [was] (142..190), [teaching] (196..276) at y=180..208
  const rowRects = [
    { left: 20, top: 180, width: 40, height: 28 }, // midX = 40
    { left: 66, top: 180, width: 70, height: 28 }, // midX = 101
    { left: 142, top: 180, width: 48, height: 28 }, // midX = 166
    { left: 196, top: 180, width: 80, height: 28 }, // midX = 236
  ];

  // Before "My"
  assert.equal(computeTrayInsertionIndex(rowRects, 25, 194), 0);
  // Between "My" and "uncle's"
  assert.equal(computeTrayInsertionIndex(rowRects, 75, 194), 1);
  // Between "uncle's" and "was" (e.g., inserting "job" -> "My uncle's job was teaching")
  assert.equal(computeTrayInsertionIndex(rowRects, 138, 194), 2);
  // Between "was" and "teaching"
  assert.equal(computeTrayInsertionIndex(rowRects, 192, 194), 3);
  // After "teaching"
  assert.equal(computeTrayInsertionIndex(rowRects, 260, 194), 4);

  // Wrapped 2nd row at y=216..244
  const multiRowRects = [
    ...rowRects,
    { left: 20, top: 216, width: 64, height: 28 }, // index 4, midX = 52
    { left: 90, top: 216, width: 60, height: 28 }, // index 5, midX = 120
  ];
  assert.equal(computeTrayInsertionIndex(multiRowRects, 30, 230), 4);
  assert.equal(computeTrayInsertionIndex(multiRowRects, 80, 230), 5);
  assert.equal(computeTrayInsertionIndex(multiRowRects, 145, 230), 6);
});

test('computeRoadmapAccuracyStats excludes neutrally bypassed audio questions without marking right or wrong', () => {
  assert.deepEqual(computeRoadmapAccuracyStats(4, 8, 4), {
    gradedTotal: 4,
    accuracyPct: 100,
  });
  assert.deepEqual(computeRoadmapAccuracyStats(3, 8, 4), {
    gradedTotal: 4,
    accuracyPct: 75,
  });
  assert.deepEqual(computeRoadmapAccuracyStats(0, 4, 4), {
    gradedTotal: 0,
    accuracyPct: 100,
  });

  const sampleExercise = buildUnitLessonExercises('u01_basics', 2, deckCards, {}, 1795000000000, 0)[0]!;
  const session: RoadmapActiveSession = {
    version: ACTIVE_ROADMAP_SESSION_VERSION,
    unitId: 'u01_basics',
    nodeIndex: 2,
    stepIndex: 0,
    queue: [sampleExercise],
    currentIdx: 0,
    firstTryCorrectCount: 0,
    totalInitial: 1,
    neutralBypassedCount: 1,
    combo: 2,
    maxCombo: 2,
    mistakesMap: {},
    strongWords: [],
    byKindStats: {},
    checkedState: {
      isCorrect: false,
      skipped: false,
      audioBypassed: true,
      userAnswer: '(audio_unavailable)',
    },
    updatedAt: Date.now(),
  };
  assert.equal(isValidActiveRoadmapSession(session, Date.now()), true);
});
