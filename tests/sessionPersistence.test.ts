import assert from 'node:assert/strict';
import test from 'node:test';
import { buildUnitLessonExercises } from '../src/shared/curriculum.ts';
import {
  chooseActiveSessionToResume,
  isValidActiveRemedialSession,
  isValidActiveRoadmapSession,
  mergePendingTutorReplyIntoHistory,
  mergeRemedialBriefingAiIntoSession,
} from '../src/shared/roadmapCoach.ts';
import {
  ACTIVE_REMEDIAL_SESSION_VERSION,
  ACTIVE_ROADMAP_SESSION_VERSION,
  type Card,
  type RemedialActiveSession,
  type RoadmapActiveSession,
} from '../src/shared/types.ts';
import { buildRemedialLessonPlan } from '../src/shared/weaknessDetector.ts';

const SAMPLE_CARDS: Card[] = [
  {
    id: 'w_run_out',
    en: 'run out of',
    phonetic: '',
    acceptedTr: ['tükenmek', 'bitmek'],
    type: 'word',
    level: 'B1',
    pos: 'verb',
    exampleEn: "We've run out of milk.",
    exampleTr: 'Sütümüz bitmiş.',
    source: 'builtin',
  },
  {
    id: 'w_should_demo',
    en: 'should',
    phonetic: '',
    acceptedTr: ['meli', 'gerekir'],
    type: 'word',
    level: 'A2',
    pos: 'verb',
    exampleEn: 'You should drink more water.',
    exampleTr: 'Daha fazla su içmelisin.',
    source: 'builtin',
  },
  {
    id: 'w_water',
    en: 'water',
    phonetic: '/ˈwɔːtər/',
    acceptedTr: ['su'],
    type: 'word',
    level: 'A1',
    pos: 'noun',
    exampleEn: 'I drink water every morning.',
    exampleTr: 'Her sabah su içerim.',
    source: 'builtin',
    unitId: 'u01_greetings',
  },
  {
    id: 'w_coffee',
    en: 'coffee',
    phonetic: '/ˈkɒfi/',
    acceptedTr: ['kahve'],
    type: 'word',
    level: 'A1',
    pos: 'noun',
    exampleEn: 'She drinks coffee before work.',
    exampleTr: 'İşe gitmeden önce kahve içer.',
    source: 'builtin',
    unitId: 'u01_greetings',
  },
  {
    id: 'w_bread',
    en: 'bread',
    phonetic: '/bred/',
    acceptedTr: ['ekmek'],
    type: 'word',
    level: 'A1',
    pos: 'noun',
    exampleEn: 'Fresh bread smells amazing.',
    exampleTr: 'Taze ekmek harika kokar.',
    source: 'builtin',
    unitId: 'u01_greetings',
  },
  {
    id: 'w_apple',
    en: 'apple',
    phonetic: '/ˈæpəl/',
    acceptedTr: ['elma'],
    type: 'word',
    level: 'A1',
    pos: 'noun',
    exampleEn: 'He eats an apple after lunch.',
    exampleTr: 'Öğle yemeğinden sonra elma yer.',
    source: 'builtin',
    unitId: 'u01_greetings',
  },
  {
    id: 's_hello',
    en: 'Nice to meet you.',
    phonetic: '',
    acceptedTr: ['Tanıştığımıza memnun oldum.'],
    type: 'sentence',
    level: 'A1',
    pos: 'phrase',
    exampleEn: 'Nice to meet you.',
    exampleTr: 'Tanıştığımıza memnun oldum.',
    source: 'builtin',
    unitId: 'u01_greetings',
  },
  {
    id: 's_how_are_you',
    en: 'How are you doing today?',
    phonetic: '',
    acceptedTr: ['Bugün nasılsın?'],
    type: 'sentence',
    level: 'A1',
    pos: 'phrase',
    exampleEn: 'How are you doing today?',
    exampleTr: 'Bugün nasılsın?',
    source: 'builtin',
    unitId: 'u01_greetings',
  },
];

function makeRemedialSession(
  overrides: Partial<RemedialActiveSession> = {},
  now: number = 1_700_000_000_000
): RemedialActiveSession {
  const plan = buildRemedialLessonPlan('was_vs_were', null, SAMPLE_CARDS, {}, now);
  return {
    version: ACTIVE_REMEDIAL_SESSION_VERSION,
    stage: 'lesson',
    skillId: 'was_vs_were',
    plan,
    weakness: null,
    queue: plan.exercises,
    currentIdx: 2,
    totalInitial: plan.exercises.length,
    firstTryCorrect: 2,
    combo: 2,
    maxCombo: 2,
    cheatSheetOpen: true,
    readyToFinish: false,
    draft: {
      spotBugFound: true,
      spotSelectedFix: 'were',
      spotWrongTaps: 1,
      spotSafeIndices: [0],
    },
    checkedState: {
      isCorrect: false,
      skipped: false,
      userAnswer: 'was',
      explanationNote: 'You/We/They özneleriyle WERE kullanılır.',
      retryId: 'rem_retry_2',
      overridden: false,
    },
    tutorOpen: true,
    tutorHistory: [
      { role: 'user', text: 'Neden were kullanıldı?' },
      { role: 'assistant', text: 'Çünkü özne çoğul (we).' },
    ],
    tutorDraft: 'Peki you için?',
    updatedAt: now,
    ...overrides,
  };
}

function makeRoadmapSession(
  overrides: Partial<RoadmapActiveSession> = {},
  now: number = 1_700_000_000_000
): RoadmapActiveSession {
  const queue = buildUnitLessonExercises('u01_greetings', 0, SAMPLE_CARDS, {}, now, 0);
  return {
    version: ACTIVE_ROADMAP_SESSION_VERSION,
    unitId: 'u01_greetings',
    nodeIndex: 0,
    stepIndex: 0,
    queue,
    currentIdx: 1,
    firstTryCorrectCount: 1,
    totalInitial: queue.length,
    combo: 1,
    maxCombo: 1,
    mistakesMap: {},
    strongWords: ['water'],
    byKindStats: { select_meaning: { correct: 1, wrong: 0 } },
    readyToFinish: false,
    draft: {
      placedTileIndices: [2, 0, 1],
      typedText: 'We have run out of milk',
    },
    checkedState: {
      isCorrect: true,
      skipped: false,
      userAnswer: 'We have run out of milk',
      aiApproved: true,
      aiProviderBadge: 'AI1',
      overridden: false,
    },
    tutorOpen: true,
    tutorHistory: [{ role: 'user', text: 'Neden run kullanılıyor?' }],
    tutorDraft: '',
    updatedAt: now,
    ...overrides,
  };
}

test('isValidActiveRemedialSession validates JSON round-tripped briefing, lesson, and readyToFinish sessions', () => {
  const now = 1_700_000_000_000;

  const briefing = JSON.parse(
    JSON.stringify(makeRemedialSession({ stage: 'briefing', currentIdx: 0 }, now))
  );
  assert.equal(isValidActiveRemedialSession(briefing, now + 5_000), true);

  const lesson = JSON.parse(JSON.stringify(makeRemedialSession({}, now)));
  assert.equal(isValidActiveRemedialSession(lesson, now + 5_000), true);
  assert.deepEqual(lesson.draft.spotSafeIndices, [0]);
  assert.equal(lesson.checkedState.retryId, 'rem_retry_2');
  assert.equal(lesson.tutorOpen, true);
  assert.equal(lesson.tutorDraft, 'Peki you için?');

  const readyToFinish = makeRemedialSession(
    {
      currentIdx: 99,
      readyToFinish: true,
    },
    now
  );
  assert.equal(isValidActiveRemedialSession(readyToFinish, now + 5_000), true);
});

test('isValidActiveRemedialSession rejects expired, malformed, out-of-bounds, and wrong-version snapshots', () => {
  const now = 1_700_000_000_000;
  const expired = makeRemedialSession({}, now - 25 * 3_600_000);
  assert.equal(isValidActiveRemedialSession(expired, now), false);

  assert.equal(
    isValidActiveRemedialSession(makeRemedialSession({ version: 999 }, now), now),
    false
  );
  assert.equal(
    isValidActiveRemedialSession(
      makeRemedialSession({ skillId: 'nonexistent_skill' as RemedialActiveSession['skillId'] }, now),
      now
    ),
    false
  );
  assert.equal(
    isValidActiveRemedialSession(
      makeRemedialSession({ currentIdx: 500, readyToFinish: false }, now),
      now
    ),
    false
  );
  assert.equal(
    isValidActiveRemedialSession(makeRemedialSession({ queue: [] }, now), now),
    false
  );
});

test('isValidActiveRoadmapSession validates draft/checked/tutor fields and remains compatible with legacy v6 snapshots', () => {
  const now = 1_700_000_000_000;
  const full = JSON.parse(JSON.stringify(makeRoadmapSession({}, now)));
  assert.equal(isValidActiveRoadmapSession(full, now + 10_000), true);

  // Legacy v6 snapshot without draft, checkedState, or tutor fields
  const legacy = makeRoadmapSession(
    {
      draft: undefined,
      checkedState: undefined,
      tutorOpen: undefined,
      tutorHistory: undefined,
      tutorDraft: undefined,
    },
    now
  );
  assert.equal(isValidActiveRoadmapSession(legacy, now + 10_000), true);

  // Expired (> 24h)
  const expired = makeRoadmapSession({}, now - 26 * 3_600_000);
  assert.equal(isValidActiveRoadmapSession(expired, now), false);
});

test('chooseActiveSessionToResume prioritizes active Remedial/Roadmap sessions by recency and falls back to savedMode', () => {
  const now = 1_700_000_000_000;
  const remBrief = makeRemedialSession({ stage: 'briefing', updatedAt: now - 10_000 }, now);
  const remLesson = makeRemedialSession({ stage: 'lesson', updatedAt: now - 2_000 }, now);
  const rmLesson = makeRoadmapSession({ updatedAt: now - 5_000 }, now);

  // 1. Only Remedial briefing active -> resumes remedial briefing even if savedMode is 'path'
  const d1 = chooseActiveSessionToResume({
    roadmapSession: null,
    remedialSession: remBrief,
    savedMode: 'path',
    now,
  });
  assert.equal(d1.target, 'remedial_session');
  if (d1.target === 'remedial_session') {
    assert.equal(d1.session.stage, 'briefing');
  }

  // 2. Only Roadmap lesson active -> resumes roadmap lesson even if savedMode is 'remedial'
  const d2 = chooseActiveSessionToResume({
    roadmapSession: rmLesson,
    remedialSession: null,
    savedMode: 'remedial',
    now,
  });
  assert.equal(d2.target, 'roadmap_session');

  // 3. Both active -> picks newer Remedial lesson (-2s vs -5s)
  const d3 = chooseActiveSessionToResume({
    roadmapSession: rmLesson,
    remedialSession: remLesson,
    savedMode: 'path',
    now,
  });
  assert.equal(d3.target, 'remedial_session');

  // 4. Both active -> picks newer Roadmap lesson (-1s vs -10s)
  const d4 = chooseActiveSessionToResume({
    roadmapSession: { ...rmLesson, updatedAt: now - 1_000 },
    remedialSession: remBrief,
    savedMode: 'remedial',
    now,
  });
  assert.equal(d4.target, 'roadmap_session');

  // 5. Expired sessions -> cleanly restores savedMode ('remedial')
  const d5 = chooseActiveSessionToResume({
    roadmapSession: { ...rmLesson, updatedAt: now - 48 * 3_600_000 },
    remedialSession: { ...remLesson, updatedAt: now - 30 * 3_600_000 },
    savedMode: 'remedial',
    now,
  });
  assert.deepEqual(d5, { target: 'mode_view', mode: 'remedial' });

  // 6. No active sessions -> preserves 'path'
  const d6 = chooseActiveSessionToResume({
    roadmapSession: null,
    remedialSession: null,
    savedMode: 'path',
    now,
  });
  assert.deepEqual(d6, { target: 'mode_view', mode: 'path' });
});

test('mergeRemedialBriefingAiIntoSession merges AI note & deduplicated extra examples idempotently', () => {
  const now = 1_700_000_000_000;
  const baseSession = makeRemedialSession({ stage: 'briefing', currentIdx: 0 }, now);
  const existingExample = baseSession.plan.briefing.examples[0]!;

  const merged = mergeRemedialBriefingAiIntoSession(
    baseSession,
    'was_vs_were',
    {
      personalNote: 'We were late örneğinde was yazmıştın; we her zaman were alır.',
      extraExamples: [
        // Duplicate of existing example (different casing) should be ignored
        { en: existingExample.en.toUpperCase(), tr: 'dup', highlight: 'were' },
        { en: 'They were streaming GTA 6 all night.', tr: 'Bütün gece GTA 6 yayını yapıyorlardı.', highlight: 'were' },
      ],
    },
    now + 2_000
  );

  assert.ok(merged);
  assert.equal(merged.plan.briefing.source, 'ai');
  assert.equal(
    merged.plan.briefing.personalNote,
    'We were late örneğinde was yazmıştın; we her zaman were alır.'
  );
  assert.equal(merged.plan.briefing.examples.length, baseSession.plan.briefing.examples.length + 1);

  // Idempotent: calling again on already AI-enriched session returns null
  const second = mergeRemedialBriefingAiIntoSession(
    merged,
    'was_vs_were',
    { personalNote: 'other', extraExamples: [] },
    now + 4_000
  );
  assert.equal(second, null);

  // Wrong skillId returns null
  const wrongSkill = mergeRemedialBriefingAiIntoSession(
    baseSession,
    'should_vs_have_to',
    { personalNote: 'other', extraExamples: [] },
    now + 4_000
  );
  assert.equal(wrongSkill, null);
});

test('mergePendingTutorReplyIntoHistory appends AI reply only when matching unanswered user turn is last', () => {
  const pending = [{ role: 'user' as const, text: 'Neden run kullanılıyor?' }];
  const merged = mergePendingTutorReplyIntoHistory(
    pending,
    'Neden run kullanılıyor?',
    '"run out of" deyim olarak "tükenmek/bitmek" demektir.'
  );
  assert.deepEqual(merged, [
    { role: 'user', text: 'Neden run kullanılıyor?' },
    { role: 'assistant', text: '"run out of" deyim olarak "tükenmek/bitmek" demektir.' },
  ]);

  // Idempotent: once assistant already replied, returns null
  assert.equal(
    mergePendingTutorReplyIntoHistory(merged ?? [], 'Neden run kullanılıyor?', 'duplicate'),
    null
  );

  // Mismatched question returns null
  assert.equal(
    mergePendingTutorReplyIntoHistory(pending, 'Başka bir soru?', 'cevap'),
    null
  );

  // Empty history returns null
  assert.equal(mergePendingTutorReplyIntoHistory([], 'Soru?', 'Cevap'), null);
});
