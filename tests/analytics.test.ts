import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAnswerToSkillProfile,
  buildAnalyticsSummary,
  classifyCardTopic,
  createInitialSkillProfile,
  normalizePosGroup,
  ratingToCefrProgress,
} from '../src/shared/analytics.ts';
import type { Card, ReviewEvent, UserCardProgress } from '../src/shared/types.ts';

function makeCard(overrides: Partial<Card> & { id: string }): Card {
  return {
    type: 'word',
    level: 'A2',
    pos: 'noun',
    en: 'sample',
    phonetic: '/s/',
    acceptedTr: ['ornek'],
    exampleEn: 'This is a sample.',
    exampleTr: 'Bu bir ornektir.',
    source: 'builtin',
    ...overrides,
  };
}

test('ratingToCefrProgress maps ratings to expected CEFR bands and percentages', () => {
  assert.deepEqual(ratingToCefrProgress(750), { level: 'A1', bandPercent: 50, nextLevel: 'A2' });
  assert.deepEqual(ratingToCefrProgress(1000), { level: 'A2', bandPercent: 50, nextLevel: 'B1' });
  assert.deepEqual(ratingToCefrProgress(1200), { level: 'B1', bandPercent: 50, nextLevel: 'B2' });
  assert.deepEqual(ratingToCefrProgress(1450), { level: 'B2', bandPercent: 75, nextLevel: 'C1' });
  assert.deepEqual(ratingToCefrProgress(1600), { level: 'C1', bandPercent: 50, nextLevel: 'C2' });
  assert.deepEqual(ratingToCefrProgress(1850), { level: 'C2', bandPercent: 50, nextLevel: null });
});

test('classifyCardTopic and normalizePosGroup classify cards into expected buckets', () => {
  const bizCard = makeCard({
    id: 'w1',
    pos: 'noun',
    en: 'budget',
    acceptedTr: ['butce'],
    exampleEn: 'The company increased its budget.',
  });
  const techCard = makeCard({
    id: 'w2',
    pos: 'verb',
    en: 'compile',
    acceptedTr: ['derlemek'],
    exampleEn: 'The software compiles the code quickly.',
  });
  const sentCard = makeCard({
    id: 's1',
    type: 'sentence',
    pos: 'sentence',
    en: 'Good morning.',
    acceptedTr: ['gunaydin'],
    exampleEn: 'Good morning, how are you?',
  });

  assert.equal(classifyCardTopic(bizCard), 'business');
  assert.equal(classifyCardTopic(techCard), 'tech');
  assert.equal(classifyCardTopic(sentCard), 'daily');

  assert.equal(normalizePosGroup('noun', 'word'), 'noun');
  assert.equal(normalizePosGroup('verb', 'word'), 'verb');
  assert.equal(normalizePosGroup('adjective', 'word'), 'adjective');
  assert.equal(normalizePosGroup('adverb', 'word'), 'adverb');
  assert.equal(normalizePosGroup('preposition', 'word'), 'grammar');
  assert.equal(normalizePosGroup('noun', 'sentence'), 'sentence');
});

test('applyAnswerToSkillProfile awards larger gains for harder cards and penalizes retries/wrong answers', () => {
  const initial = createInitialSkillProfile();
  const a1Card = makeCard({ id: 'a1', level: 'A1', en: 'apple', acceptedTr: ['elma'] });
  const c1Card = makeCard({ id: 'c1', level: 'C1', en: 'ubiquitous', acceptedTr: ['her yerde bulunan'] });

  const a1Win = applyAnswerToSkillProfile(initial, a1Card, true, {
    responseMs: 6000,
    isRetryAttempt: false,
    now: 1000,
  });
  const c1Win = applyAnswerToSkillProfile(initial, c1Card, true, {
    responseMs: 6000,
    isRetryAttempt: false,
    now: 1000,
  });

  assert.ok(c1Win.delta > a1Win.delta);
  assert.equal(c1Win.nextProfile.currentStreak, 1);
  assert.equal(c1Win.nextProfile.totalCorrect, 1);

  const retryWin = applyAnswerToSkillProfile(initial, c1Card, true, {
    responseMs: 6000,
    isRetryAttempt: true,
    now: 2000,
  });
  assert.ok(retryWin.delta < c1Win.delta);

  const loss = applyAnswerToSkillProfile(c1Win.nextProfile, a1Card, false, {
    responseMs: 6000,
    isRetryAttempt: false,
    now: 3000,
  });
  assert.ok(loss.delta < 0);
  assert.equal(loss.nextProfile.currentStreak, 0);
  assert.equal(loss.nextProfile.bestStreak, 1);

  // Anti-farming check: a B2 player (1350 Elo) solving an A1 card (800 Elo) gets 0 Elo gain
  const b2Profile = { ...initial, rating: 1350, totalAnswered: 30 };
  const a1FarmAttempt = applyAnswerToSkillProfile(b2Profile, a1Card, true, {
    responseMs: 2500,
    isRetryAttempt: false,
    now: 4000,
  });
  assert.equal(a1FarmAttempt.delta, 0);
  assert.equal(a1FarmAttempt.nextProfile.rating, 1350);
});

test('buildAnalyticsSummary computes strongest/weakest topics, POS accuracy, and hard cards', () => {
  const techCard = makeCard({
    id: 't1',
    level: 'B2',
    pos: 'noun',
    en: 'algorithm',
    acceptedTr: ['algoritma'],
    exampleEn: 'The algorithm processes data fast.',
  });
  const healthCard = makeCard({
    id: 'h1',
    level: 'B1',
    pos: 'verb',
    en: 'breathe',
    acceptedTr: ['nefes almak'],
    exampleEn: 'Breathe deeply at the hospital.',
  });

  const progressMap: Record<string, UserCardProgress> = {
    t1: {
      cardId: 't1',
      retryAt: null,
      retryCount: 0,
      nextDueAt: 999999,
      streak: 3,
      intervalDays: 6,
      totalCorrect: 3,
      totalWrong: 0,
      lastReviewedAt: 3000,
    },
    h1: {
      cardId: 'h1',
      retryAt: 5000,
      retryCount: 1,
      nextDueAt: 5000,
      streak: 0,
      intervalDays: 1,
      totalCorrect: 1,
      totalWrong: 2,
      lastReviewedAt: 4000,
    },
  };

  const history: ReviewEvent[] = [
    {
      cardId: 't1',
      en: 'algorithm',
      level: 'B2',
      posGroup: 'noun',
      topic: 'tech',
      isCorrect: true,
      responseMs: 3000,
      ratingBefore: 1000,
      ratingAfter: 1030,
      timestamp: 1000,
    },
    {
      cardId: 't1',
      en: 'algorithm',
      level: 'B2',
      posGroup: 'noun',
      topic: 'tech',
      isCorrect: true,
      responseMs: 2500,
      ratingBefore: 1030,
      ratingAfter: 1055,
      timestamp: 2000,
    },
    {
      cardId: 'h1',
      en: 'breathe',
      level: 'B1',
      posGroup: 'verb',
      topic: 'health',
      isCorrect: false,
      responseMs: 9000,
      ratingBefore: 1055,
      ratingAfter: 1025,
      timestamp: 3000,
    },
    {
      cardId: 'h1',
      en: 'breathe',
      level: 'B1',
      posGroup: 'verb',
      topic: 'health',
      isCorrect: false,
      responseMs: 8000,
      ratingBefore: 1025,
      ratingAfter: 995,
      timestamp: 4000,
    },
  ];

  const profile = {
    ...createInitialSkillProfile(),
    rating: 995,
    totalAnswered: 4,
    totalCorrect: 2,
    currentStreak: 0,
    bestStreak: 2,
    lastUpdatedAt: 4000,
  };

  const summary = buildAnalyticsSummary([techCard, healthCard], progressMap, profile, history);

  assert.equal(summary.overallAccuracy, 50);
  assert.equal(summary.strongestTopics[0]?.key, 'tech');
  assert.equal(summary.strongestTopics[0]?.accuracy, 100);
  assert.equal(summary.weakestTopics[0]?.key, 'health');
  assert.equal(summary.weakestTopics[0]?.accuracy, 0);
  assert.equal(summary.hardCards[0]?.card.id, 'h1');
  assert.equal(summary.ratingSeries.length, 4);
  assert.equal(summary.byPos.find((b) => b.key === 'noun')?.accuracy, 100);
  assert.equal(summary.byPos.find((b) => b.key === 'verb')?.accuracy, 0);
});
