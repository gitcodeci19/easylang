import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REMEDIAL_SKILL_CATALOG,
  REMEDIAL_SKILL_ORDER,
} from '../src/shared/remedialCatalog.ts';
import {
  getRemedialQuestionAudioId,
  REMEDIAL_QUESTION_SCRIPTS,
} from '../src/shared/remedialQuestionScripts.ts';
import type {
  Card,
  ConceptTrackerState,
  RemedialMasteryRecord,
  ReviewEvent,
  RoadmapLessonRecord,
  UserCardProgress,
} from '../src/shared/types.ts';
import {
  buildRemedialLessonPlan,
  detectAnswerConfusionSkills,
  diagnoseUserWeaknesses,
  findRemedialQuestionAudioForSentence,
  getResolvedRemedialSkillIds,
  tokenizeSentenceForBank,
} from '../src/shared/weaknessDetector.ts';

function makeWord(id: string, en: string, tr: string, level: Card['level'] = 'B1'): Card {
  return {
    id,
    type: 'word',
    level,
    pos: 'verb',
    en,
    phonetic: '',
    acceptedTr: [tr],
    exampleEn: `We should ${en} before noon.`,
    exampleTr: `Öğleden önce ${tr} gerekiyor.`,
    source: 'builtin',
  };
}

function makeSentence(id: string, en: string, tr: string, level: Card['level'] = 'B1'): Card {
  return {
    id,
    type: 'sentence',
    level,
    pos: 'sentence',
    en,
    phonetic: '',
    acceptedTr: [tr],
    exampleEn: '',
    exampleTr: '',
    source: 'builtin',
  };
}

test('detects was vs were swap immediately as critical weakness', () => {
  const now = 1_750_000_000_000;
  const c1 = makeSentence('s_1', 'My friends were waiting outside.', 'Arkadaşlarım dışarıda bekliyordu.');
  const roadmapHistory: RoadmapLessonRecord[] = [
    {
      id: 'rm_1',
      completedAt: now - 3_600_000,
      unitId: 'u3',
      unitTitleTr: 'Geçmiş',
      unitTitleEn: 'Past',
      nodeIndex: 1,
      stepIndex: 0,
      accuracyPct: 70,
      xpEarned: 15,
      totalQuestions: 8,
      firstTryCorrect: 6,
      repeatedMistakeCount: 1,
      strongWords: [],
      mistakes: [
        {
          cardId: c1.id,
          en: c1.en,
          expected: 'My friends were waiting outside.',
          kind: 'free_translation',
          direction: 'tr-to-en',
          wrongCount: 2,
          repeatedWrong: true,
          lastUserAnswer: 'My friends was waiting outside.',
        },
      ],
      byKind: {},
    },
  ];

  const diagnosed = diagnoseUserWeaknesses({
    cards: [c1],
    progressMap: {},
    reviewHistory: [],
    roadmapHistory,
    conceptState: { notes: [], lastConceptPromptAtQuestion: -10 },
    now,
  });

  assert.ok(diagnosed.length > 0);
  assert.equal(diagnosed[0]!.skillId, 'was_vs_were');
  assert.equal(diagnosed[0]!.severity, 'critical');
  assert.ok(diagnosed[0]!.evidenceExamples.some((e) => e.en.includes('were waiting')));
});

test('detects should vs have to confusion in both English and Turkish answers', () => {
  const enConfusion = detectAnswerConfusionSkills({
    en: 'You should listen to this album.',
    expected: 'You should listen to this album.',
    userAnswer: 'You have to listen to this album.',
    kind: 'free_translation',
  });
  assert.ok(enConfusion.some((h) => h.skillId === 'should_vs_have_to' && h.bonus >= 30));

  const trConfusion = detectAnswerConfusionSkills({
    en: 'You should take a break.',
    expected: 'Bir mola vermelisin.',
    userAnswer: 'Bir mola vermek zorundasın.',
    kind: 'free_translation',
  });
  assert.ok(trConfusion.some((h) => h.skillId === 'should_vs_have_to' && h.bonus >= 30));
});

test('diagnoses realistic multi-signal weaknesses (passive, word order, listening, phrasal verbs, trouble vocab)', () => {
  const now = 1_750_000_000_000;
  const cards: Card[] = [
    makeSentence('s_pass', 'We were invited to the party.', 'Partiye davet edildik.'),
    makeSentence('s_wo', 'The birds are building a nest.', 'Kuşlar bir yuva yapıyor.'),
    makeSentence('s_aud', 'My dog has been missing for three days.', 'Köpeğim üç gündür kayıp.'),
    makeSentence('s_pv', 'We had to cut our vacation short.', 'Tatilimizi yarıda kesmek zorunda kaldık.'),
    makeWord('w_assign', 'assignment', 'ödev'),
    makeWord('w_depart', 'depart', 'ayrılmak'),
  ];

  const roadmapHistory: RoadmapLessonRecord[] = [
    {
      id: 'rm_mix',
      completedAt: now - 1_000_000,
      unitId: 'u4',
      unitTitleTr: 'Günlük',
      unitTitleEn: 'Daily',
      nodeIndex: 2,
      stepIndex: 0,
      accuracyPct: 62,
      xpEarned: 15,
      totalQuestions: 8,
      firstTryCorrect: 5,
      repeatedMistakeCount: 2,
      strongWords: [],
      mistakes: [
        {
          cardId: 's_wo',
          en: 'The birds are building a nest.',
          expected: 'The birds are building a nest.',
          kind: 'word_bank',
          direction: 'tr-to-en',
          wrongCount: 2,
          repeatedWrong: true,
          lastUserAnswer: 'are The birds building a nest',
        },
        {
          cardId: 's_aud',
          en: 'My dog has been missing for three days.',
          expected: 'My dog has been missing for three days.',
          kind: 'audio_dictation',
          direction: 'en-audio',
          wrongCount: 2,
          repeatedWrong: true,
          lastUserAnswer: 'My dog missing for three days',
        },
        {
          cardId: 's_pass',
          en: 'We were invited to the party.',
          expected: 'Partiye davet edildik.',
          kind: 'free_translation',
          direction: 'en-to-tr',
          wrongCount: 1,
          repeatedWrong: false,
          lastUserAnswer: 'Partiye davet ettik.',
        },
      ],
      byKind: {
        word_bank: { correct: 1, wrong: 3 },
        audio_dictation: { correct: 0, wrong: 2 },
      },
    },
  ];

  const reviewHistory: ReviewEvent[] = [
    {
      timestamp: now - 2_000_000,
      cardId: 's_pv',
      en: 'We had to cut our vacation short.',
      level: 'B1',
      posGroup: 'sentence',
      topic: 'travel',
      isCorrect: false,
      responseMs: 9000,
      ratingBefore: 1150,
      ratingAfter: 1135,
    },
  ];

  const progressMap: Record<string, UserCardProgress> = {
    w_assign: {
      cardId: 'w_assign',
      streak: 0,
      intervalDays: 0,
      nextDueAt: now,
      retryAt: now + 60_000,
      retryCount: 2,
      lastReviewedAt: now - 500_000,
      totalCorrect: 1,
      totalWrong: 4,
    },
    w_depart: {
      cardId: 'w_depart',
      streak: 0,
      intervalDays: 0,
      nextDueAt: now,
      retryAt: null,
      retryCount: 0,
      lastReviewedAt: now - 500_000,
      totalCorrect: 0,
      totalWrong: 3,
    },
  };

  const conceptState: ConceptTrackerState = {
    lastConceptPromptAtQuestion: 10,
    notes: [
      {
        id: 'token:were_invited',
        label: 'Passive voice (were invited)',
        focusToken: 'were invited',
        sourceCardId: 's_pass',
        sourceEn: 'We were invited to the party.',
        explanation: 'Be + V3 forms passive voice.',
        pattern: '\\bwere\\s+invited\\b',
        stage: 0,
        nextCheckAtQuestion: 12,
        practicedCardIds: ['s_pass'],
        attempts: 1,
        correctCount: 0,
        wrongCount: 2,
        createdAt: now - 800_000,
        lastPracticedAt: now - 800_000,
        masteredAt: null,
      },
    ],
  };

  const diagnosed = diagnoseUserWeaknesses({
    cards,
    progressMap,
    reviewHistory,
    roadmapHistory,
    conceptState,
    now,
  });

  const ids = new Set(diagnosed.map((d) => d.skillId));
  assert.ok(ids.has('word_order_syntax'), 'must detect word_order_syntax');
  assert.ok(ids.has('listening_gap'), 'must detect listening_gap');
  assert.ok(ids.has('passive_voice'), 'must detect passive_voice');
  assert.ok(ids.has('phrasal_verbs'), 'must detect phrasal_verbs');
  assert.ok(ids.has('trouble_vocab'), 'must detect trouble_vocab');

  const passive = diagnosed.find((d) => d.skillId === 'passive_voice')!;
  assert.ok(passive.relatedConceptIds.includes('token:were_invited'));
});

test('graduates workshops passed at >=80% even with AI overlay, ignores later correct reviews, and resurfaces on a new mistake', () => {
  const now = 1_750_000_000_000;
  const c1 = makeSentence('s_1', 'They were excited about GTA 6.', 'GTA 6 için heyecanlıydılar.');
  const w1 = makeWord('w_platform', 'platform', 'platform', 'B1');
  const roadmapHistory: RoadmapLessonRecord[] = [
    {
      id: 'rm_old',
      completedAt: now - 2 * 86_400_000,
      unitId: 'u2',
      unitTitleTr: 'Geçmiş',
      unitTitleEn: 'Past',
      nodeIndex: 0,
      stepIndex: 0,
      accuracyPct: 60,
      xpEarned: 15,
      totalQuestions: 6,
      firstTryCorrect: 4,
      repeatedMistakeCount: 1,
      strongWords: [],
      mistakes: [
        {
          cardId: c1.id,
          en: c1.en,
          expected: c1.en,
          kind: 'free_translation',
          direction: 'tr-to-en',
          wrongCount: 2,
          repeatedWrong: true,
          lastUserAnswer: 'They was excited about GTA 6.',
        },
        {
          cardId: w1.id,
          en: w1.en,
          expected: 'platform',
          kind: 'select_meaning',
          direction: 'en-to-tr',
          wrongCount: 3,
          repeatedWrong: true,
          lastUserAnswer: 'durum',
        },
      ],
      byKind: {},
    },
  ];

  // User had an earlier miss on w_platform, then later answered it CORRECTLY after completing the workshop
  const completedAt = now - 3_600_000;
  const progressMap: Record<string, UserCardProgress> = {
    [w1.id]: {
      cardId: w1.id,
      streak: 2,
      intervalDays: 3,
      nextDueAt: now + 86_400_000,
      retryAt: null,
      retryCount: 0,
      lastReviewedAt: now - 60_000, // newer than completedAt, but CORRECT (streak=2, retryAt=null)
      totalCorrect: 2,
      totalWrong: 3,
    },
  };

  // Related concept was advanced to stage 1 on completion (lastPracticedAt >= completedAt, NOT a new failure)
  const conceptState: ConceptTrackerState = {
    lastConceptPromptAtQuestion: 10,
    notes: [
      {
        id: 'rule:was_were',
        label: 'was vs were',
        focusToken: 'were',
        sourceCardId: c1.id,
        sourceEn: c1.en,
        explanation: 'Use were with plural subjects.',
        pattern: '\\bwere\\b',
        stage: 1,
        nextCheckAtQuestion: 15,
        practicedCardIds: [c1.id],
        attempts: 2,
        correctCount: 1,
        wrongCount: 1,
        createdAt: now - 2 * 86_400_000,
        lastPracticedAt: now - 30_000, // newer than completedAt, but stage 1 = correct advance
        masteredAt: null,
      },
    ],
  };

  const aiOverlay = [
    {
      skillId: 'was_vs_were' as const,
      severity: 'critical' as const,
      reason: 'They ile was kullanmışsın.',
    },
    {
      skillId: 'trouble_vocab' as const,
      severity: 'critical' as const,
      reason: 'platform kelimesini karıştırıyor.',
    },
  ];

  const beforeMastery = diagnoseUserWeaknesses({
    cards: [c1, w1],
    progressMap,
    reviewHistory: [],
    roadmapHistory,
    conceptState,
    aiExtraWeaknesses: aiOverlay,
    now,
  });
  assert.equal(beforeMastery.find((d) => d.skillId === 'was_vs_were')?.severity, 'critical');
  assert.equal(beforeMastery.find((d) => d.skillId === 'trouble_vocab')?.severity, 'critical');

  // Completing with < 80% keeps the skill active
  const belowThreshold = diagnoseUserWeaknesses({
    cards: [c1, w1],
    progressMap,
    reviewHistory: [],
    roadmapHistory,
    conceptState,
    aiExtraWeaknesses: aiOverlay,
    remedialProgress: {
      was_vs_were: {
        skillId: 'was_vs_were',
        completions: 1,
        lastAccuracyPct: 67,
        lastCompletedAt: completedAt,
        bestAccuracyPct: 67,
      },
    },
    now,
  });
  assert.ok(belowThreshold.some((d) => d.skillId === 'was_vs_were'));

  // Completing with >= 80% (90% / 100%) graduates BOTH skills completely, even when AI overlay still lists them
  const remedialProgress: Record<string, RemedialMasteryRecord> = {
    was_vs_were: {
      skillId: 'was_vs_were',
      completions: 1,
      lastAccuracyPct: 90,
      lastCompletedAt: completedAt,
      bestAccuracyPct: 90,
    },
    trouble_vocab: {
      skillId: 'trouble_vocab',
      completions: 1,
      lastAccuracyPct: 100,
      lastCompletedAt: completedAt,
      bestAccuracyPct: 100,
    },
  };

  const afterMastery = diagnoseUserWeaknesses({
    cards: [c1, w1],
    progressMap,
    reviewHistory: [],
    roadmapHistory,
    conceptState,
    aiExtraWeaknesses: aiOverlay,
    remedialProgress,
    now,
  });
  assert.equal(afterMastery.find((d) => d.skillId === 'was_vs_were'), undefined);
  assert.equal(afterMastery.find((d) => d.skillId === 'trouble_vocab'), undefined);

  const resolvedIds = getResolvedRemedialSkillIds({
    cards: [c1, w1],
    progressMap,
    reviewHistory: [],
    roadmapHistory,
    conceptState,
    remedialProgress,
    now,
  });
  assert.ok(resolvedIds.includes('was_vs_were'));
  assert.ok(resolvedIds.includes('trouble_vocab'));

  // A genuinely NEW mistake AFTER completedAt resurfaces was_vs_were immediately
  const withNewMistake = diagnoseUserWeaknesses({
    cards: [c1, w1],
    progressMap,
    reviewHistory: [],
    roadmapHistory: [
      ...roadmapHistory,
      {
        ...roadmapHistory[0]!,
        id: 'rm_new',
        completedAt: completedAt + 600_000,
        mistakes: [roadmapHistory[0]!.mistakes[0]!],
      },
    ],
    conceptState,
    remedialProgress,
    now,
  });
  assert.ok(withNewMistake.some((d) => d.skillId === 'was_vs_were'));
  assert.equal(withNewMistake.find((d) => d.skillId === 'trouble_vocab'), undefined);
});

test('does not falsely blame grammar rules the user reproduced accurately in English attempts', () => {
  const now = 1_750_000_000_000;
  const c1 = makeSentence(
    's_dog',
    'My dog has been missing for three days.',
    'Köpeğim üç gündür kayıp.'
  );
  const roadmapHistory: RoadmapLessonRecord[] = [
    {
      id: 'rm_prec',
      completedAt: now - 1000,
      unitId: 'u4',
      unitTitleTr: 'Zaman',
      unitTitleEn: 'Time',
      nodeIndex: 1,
      stepIndex: 0,
      accuracyPct: 75,
      xpEarned: 15,
      totalQuestions: 8,
      firstTryCorrect: 6,
      repeatedMistakeCount: 1,
      strongWords: [],
      mistakes: [
        {
          cardId: c1.id,
          en: c1.en,
          expected: c1.en,
          kind: 'audio_dictation',
          direction: 'en-audio',
          wrongCount: 2,
          repeatedWrong: true,
          lastUserAnswer: 'My dog missing for three days',
        },
      ],
      byKind: {},
    },
  ];

  const diagnosed = diagnoseUserWeaknesses({
    cards: [c1],
    progressMap: {},
    reviewHistory: [],
    roadmapHistory,
    conceptState: { notes: [], lastConceptPromptAtQuestion: -10 },
    now,
  });

  const ids = new Set(diagnosed.map((d) => d.skillId));
  assert.ok(ids.has('listening_gap'), 'must detect listening_gap');
  assert.ok(ids.has('present_perfect'), 'must detect omitted has been -> present_perfect');
  assert.ok(!ids.has('prepositions_core'), 'must NOT blame prepositions_core when "for three days" was typed accurately');
});

test('all 18 remedial workshops have 100% valid briefings, duels, spot_fix token indices, scenarios, and lesson plans', () => {
  const sampleDeck: Card[] = [
    makeSentence('m_1', "I can't wait to play GTA 6.", 'GTA 6 oynamak için sabırsızlanıyorum.'),
    makeSentence('m_2', 'I feel good when I listen to rock music.', 'Rock müzik dinlediğimde kendimi iyi hissediyorum.'),
    makeSentence('m_3', 'We were invited to the launch party.', 'Lansman partisine davet edildik.'),
    makeSentence('m_4', 'You should back up your project tonight.', 'Projeni bu gece yedeklemelisin.'),
    makeWord('w_1', 'assignment', 'ödev'),
    makeWord('w_2', 'admit', 'kabul etmek'),
    makeWord('w_3', 'depart', 'ayrılmak'),
    makeWord('w_4', 'announce', 'duyurmak'),
  ];

  assert.equal(REMEDIAL_SKILL_ORDER.length, 18);

  for (const skillId of REMEDIAL_SKILL_ORDER) {
    const spec = REMEDIAL_SKILL_CATALOG[skillId];
    assert.ok(spec, `Catalog missing ${skillId}`);
    assert.ok(spec.briefing.headlineTr.length > 5, `${skillId} missing headlineTr`);
    assert.ok(spec.briefing.goldenRuleTr.length > 10, `${skillId} missing goldenRuleTr`);
    assert.ok(spec.briefing.mnemonicTr.length > 10, `${skillId} missing mnemonicTr`);
    assert.ok(spec.briefing.examples.length >= 3, `${skillId} needs >= 3 examples`);

    for (const duel of spec.duels) {
      assert.equal(duel.choices.length, 2, `${skillId} duel must have 2 choices`);
      assert.notEqual(duel.choices[0], duel.choices[1], `${skillId} duel duplicate choices`);
      assert.ok(
        duel.choices.includes(duel.correctChoice),
        `${skillId} duel correctChoice "${duel.correctChoice}" not in choices`
      );
    }

    for (const sf of spec.spotFixes) {
      assert.ok(
        sf.buggyTokenIndex >= 0 && sf.buggyTokenIndex < sf.buggyTokens.length,
        `${skillId} spotFix buggyTokenIndex out of bounds`
      );
      assert.equal(new Set(sf.fixChoices).size, 3, `${skillId} spotFix must have 3 unique choices`);
      assert.ok(
        sf.fixChoices.includes(sf.correctFixToken),
        `${skillId} spotFix correctFixToken "${sf.correctFixToken}" not in fixChoices`
      );
      const patched = [...sf.buggyTokens];
      patched[sf.buggyTokenIndex] = sf.correctFixToken;
      assert.equal(
        patched.join(' '),
        sf.correctedSentence,
        `${skillId} spotFix token replacement must exactly equal correctedSentence`
      );
    }

    for (const sc of spec.scenarios) {
      assert.equal(new Set(sc.choices).size, 3, `${skillId} scenario must have 3 unique choices`);
      assert.ok(
        sc.choices.includes(sc.correctChoice),
        `${skillId} scenario correctChoice not in choices`
      );
    }

    const plan = buildRemedialLessonPlan(skillId, null, sampleDeck, {}, 123456);
    assert.ok(plan.exercises.length >= 4, `${skillId} plan must have >= 4 exercises`);
    assert.ok(
      plan.exercises.some((e) => e.kind === 'contrast_duel'),
      `${skillId} plan missing contrast_duel`
    );
    assert.ok(
      plan.exercises.some((e) => e.kind === 'spot_fix'),
      `${skillId} plan missing spot_fix`
    );
    assert.ok(
      plan.exercises.some((e) => e.kind === 'scenario_pick'),
      `${skillId} plan missing scenario_pick`
    );
    assert.ok(
      plan.exercises.some((e) => e.kind === 'free_translation'),
      `${skillId} plan missing free_translation`
    );
  }
});

test('all 92 pre-authored remedial questions have exact 1-to-1 ElevenLabs scripts and balanced interleaving', () => {
  const expectedIds = new Set<string>();
  for (const skillId of REMEDIAL_SKILL_ORDER) {
    const spec = REMEDIAL_SKILL_CATALOG[skillId];
    spec.duels.forEach((_, idx) => {
      expectedIds.add(getRemedialQuestionAudioId(skillId, 'duel', idx + 1));
    });
    spec.spotFixes.forEach((_, idx) => {
      expectedIds.add(getRemedialQuestionAudioId(skillId, 'spot', idx + 1));
    });
    spec.scenarios.forEach((_, idx) => {
      expectedIds.add(getRemedialQuestionAudioId(skillId, 'scen', idx + 1));
    });
  }

  assert.equal(expectedIds.size, 92, 'Expected exactly 92 pre-authored remedial questions');
  assert.equal(
    Object.keys(REMEDIAL_QUESTION_SCRIPTS).length,
    92,
    'REMEDIAL_QUESTION_SCRIPTS must contain exactly 92 entries'
  );

  for (const audioId of expectedIds) {
    const script = REMEDIAL_QUESTION_SCRIPTS[audioId];
    assert.ok(script && script.trim().length >= 120, `Missing or too-short script for ${audioId}`);
    assert.ok(!/\bV[123]\b|\bSVO\b|[→/]/.test(script), `Script ${audioId} has TTS-unfriendly symbol/abbrev: ${script}`);
  }

  // Verify interleaving & stable template-to-audioId mapping across seeds
  const richDeck: Card[] = [
    makeSentence('s_w1', 'My friends were waiting for the train at dusk.', 'Arkadaşlarım alacakaranlıkta treni bekliyordu.'),
    makeSentence('s_w2', 'She was happy about her exam score yesterday.', 'Dün sınav puanı konusunda mutluydu.'),
    makeSentence('s_w3', 'The concerts were louder than we expected.', 'Konserler beklediğimizden daha gürültülüydü.'),
    makeWord('w_1', 'assignment', 'ödev'),
    makeWord('w_2', 'depart', 'ayrılmak'),
    makeWord('w_3', 'announce', 'duyurmak'),
    makeWord('w_4', 'avoid', 'kaçınmak'),
    makeWord('w_5', 'schedule', 'program'),
    makeWord('w_6', 'confirm', 'onaylamak'),
  ];

  const wasPlan = buildRemedialLessonPlan('was_vs_were', null, richDeck, {}, 424242);
  assert.equal(wasPlan.exercises.length, 8);
  assert.equal(wasPlan.exercises[0]!.kind, 'cloze_blank', 'Grammar lesson should start with personalized cloze');
  assert.equal(wasPlan.exercises[0]!.questionAudioId, undefined);
  assert.equal(wasPlan.exercises[1]!.kind, 'contrast_duel', 'Followed immediately by ElevenLabs duel');
  assert.ok(wasPlan.exercises[1]!.questionAudioId?.startsWith('was_vs_were__duel_'));
  assert.equal(wasPlan.exercises[2]!.kind, 'spot_fix');
  assert.equal(wasPlan.exercises[3]!.kind, 'word_bank', 'Mid-lesson personalized word_bank');
  assert.equal(wasPlan.exercises[4]!.kind, 'contrast_duel');
  assert.equal(wasPlan.exercises[5]!.kind, 'scenario_pick');
  assert.equal(wasPlan.exercises[6]!.kind, 'spot_fix');
  assert.equal(wasPlan.exercises[7]!.kind, 'free_translation', 'Final boss personalized translation');

  // Verify shuffled duel keeps exact original template audioId
  for (const seed of [1, 7, 99, 7777]) {
    const p = buildRemedialLessonPlan('was_vs_were', null, richDeck, {}, seed);
    const duels = p.exercises.filter((e) => e.kind === 'contrast_duel');
    for (const dEx of duels) {
      const idxMatch = /__duel_(\d+)$/.exec(dEx.questionAudioId ?? '');
      assert.ok(idxMatch, `Invalid duel audioId: ${dEx.questionAudioId}`);
      const origTemplate = REMEDIAL_SKILL_CATALOG.was_vs_were.duels[Number(idxMatch[1]) - 1]!;
      assert.equal(dEx.promptText, origTemplate.promptSentence, 'audioId must always match its exact template');
    }
  }

  // Verify trouble_vocab alternates personal vocab_recall and ElevenLabs drills when missed words exist
  const tvProgress: Record<string, UserCardProgress> = {
    w_1: {
      cardId: 'w_1',
      streak: 0,
      intervalDays: 0,
      nextDueAt: 0,
      retryAt: null,
      retryCount: 1,
      lastReviewedAt: 1000,
      totalCorrect: 0,
      totalWrong: 3,
    },
    w_2: {
      cardId: 'w_2',
      streak: 0,
      intervalDays: 0,
      nextDueAt: 0,
      retryAt: null,
      retryCount: 1,
      lastReviewedAt: 1000,
      totalCorrect: 0,
      totalWrong: 2,
    },
    w_3: {
      cardId: 'w_3',
      streak: 0,
      intervalDays: 0,
      nextDueAt: 0,
      retryAt: null,
      retryCount: 1,
      lastReviewedAt: 1000,
      totalCorrect: 0,
      totalWrong: 2,
    },
  };
  const tvPlan = buildRemedialLessonPlan('trouble_vocab', null, richDeck, tvProgress, 12345);
  assert.equal(tvPlan.exercises[0]!.kind, 'vocab_recall');
  assert.equal(tvPlan.exercises[1]!.kind, 'contrast_duel');
  assert.ok(tvPlan.exercises[1]!.questionAudioId?.startsWith('trouble_vocab__duel_'));
  assert.equal(tvPlan.exercises[2]!.kind, 'vocab_recall');
  assert.equal(tvPlan.exercises[3]!.kind, 'spot_fix');
  assert.equal(tvPlan.exercises[tvPlan.exercises.length - 1]!.kind, 'free_translation');

  // Verify Roadmap sentence lookup resolves matching bundled question voiceovers
  const hitBirds = findRemedialQuestionAudioForSentence('The birds are building a nest.');
  assert.equal(hitBirds?.questionAudioId, 'word_order_syntax__duel_1');
  const hitDog = findRemedialQuestionAudioForSentence('my dog has been missing for three days');
  assert.equal(hitDog?.questionAudioId, 'listening_gap__duel_2');
  assert.equal(findRemedialQuestionAudioForSentence('A completely unrelated sentence here.'), null);
});

test('tokenizeSentenceForBank preserves times, decimals, currency, percentages, thousands, and ordinals', () => {
  assert.deepEqual(
    tokenizeSentenceForBank("The bus didn't arrive until 9:00 AM."),
    ['The', 'bus', "didn't", 'arrive', 'until', '9:00', 'AM']
  );
  assert.deepEqual(
    tokenizeSentenceForBank('The train departs at 7:30 p.m.!'),
    ['The', 'train', 'departs', 'at', '7:30', 'p.m.']
  );
  assert.deepEqual(
    tokenizeSentenceForBank('Watching tutorials at 1.5x speed costs $19.99 (50% off for 1,000 users).'),
    ['Watching', 'tutorials', 'at', '1.5x', 'speed', 'costs', '$19.99', '50%', 'off', 'for', '1,000', 'users']
  );
  assert.deepEqual(
    tokenizeSentenceForBank('The match ended 2-2 in 2022.'),
    ['The', 'match', 'ended', '2-2', 'in', '2022']
  );
  assert.deepEqual(
    tokenizeSentenceForBank("Otobüs saat 9:00'a kadar gelmedi."),
    ['Otobüs', 'saat', "9:00'a", 'kadar', 'gelmedi']
  );
  assert.deepEqual(
    tokenizeSentenceForBank('Isaac Newton 17. yüzyılda yaşadı.'),
    ['Isaac', 'Newton', '17.', 'yüzyılda', 'yaşadı']
  );
  assert.deepEqual(
    tokenizeSentenceForBank("I can't wait to play GTA 6."),
    ['I', "can't", 'wait', 'to', 'play', 'GTA', '6']
  );
});
