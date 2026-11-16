import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeWeaknessProfile,
  evaluateDictationAnswer,
  recordCorrectProgress,
  recordWrongProgress,
  selectNextCard,
} from '../src/shared/srs.ts';
import type { Card, ReviewEvent, UserCardProgress } from '../src/shared/types.ts';
import { buildSmartYouGlishQuery } from '../src/shared/youglish.ts';

const SAMPLE_CARDS: Card[] = [
  {
    id: 'w_apple',
    type: 'word',
    level: 'A1',
    pos: 'noun',
    en: 'apple',
    phonetic: '',
    acceptedTr: ['elma'],
    exampleEn: '',
    exampleTr: '',
    source: 'builtin',
  },
  {
    id: 'w_reluctant',
    type: 'word',
    level: 'B2',
    pos: 'adj',
    en: 'reluctant',
    phonetic: '',
    acceptedTr: ['isteksiz'],
    exampleEn: '',
    exampleTr: '',
    source: 'builtin',
  },
  {
    id: 's_0001',
    type: 'sentence',
    level: 'A2',
    pos: 'sentence',
    en: 'I need some sleep.',
    phonetic: '',
    acceptedTr: ['Biraz uykuya ihtiyacım var.'],
    exampleEn: '',
    exampleTr: '',
    source: 'builtin',
  },
];

test('wrong answer schedules card into 20-minute retry queue and prioritizes it when due', () => {
  const t0 = 1_700_000_000_000;
  const wrongOutcome = recordWrongProgress(null, 'w_reluctant', t0, 20);

  assert.equal(wrongOutcome.progress.retryAt, t0 + 20 * 60_000);
  assert.equal(wrongOutcome.progress.retryCount, 1);
  assert.equal(wrongOutcome.nextRepeatLabel, 'Retry in 20 min');

  const progressMap: Record<string, UserCardProgress> = {
    w_reluctant: wrongOutcome.progress,
  };

  // Before 20 minutes (e.g. +10 min), retry card should NOT be selected yet
  const at10Min = selectNextCard(
    SAMPLE_CARDS,
    progressMap,
    t0 + 10 * 60_000,
    { contentMode: 'mixed', levels: ['A1', 'A2', 'B1', 'B2', 'C1'], includeUserCards: true },
    () => 0
  );
  assert.ok(at10Min);
  assert.notEqual(at10Min.card.id, 'w_reluctant');
  assert.equal(at10Min.isRetry, false);

  // At 20 minutes (even 15 seconds early within grace window), retry card MUST be selected first
  const at20Min = selectNextCard(
    SAMPLE_CARDS,
    progressMap,
    t0 + 19 * 60_000 + 45_000,
    { contentMode: 'mixed', levels: ['A1', 'A2', 'B1', 'B2', 'C1'], includeUserCards: true },
    () => 0
  );
  assert.ok(at20Min);
  assert.equal(at20Min.card.id, 'w_reluctant');
  assert.equal(at20Min.isRetry, true);
  assert.equal(at20Min.retryAttempt, 2);
});

test('correct answer clears retry queue and advances SRS interval', () => {
  const t0 = 1_700_000_000_000;
  const wrong = recordWrongProgress(null, 'w_reluctant', t0, 20).progress;
  const firstCorrect = recordCorrectProgress(wrong, 'w_reluctant', t0 + 20 * 60_000);

  assert.equal(firstCorrect.progress.retryAt, null);
  assert.equal(firstCorrect.progress.retryCount, 0);
  assert.equal(firstCorrect.progress.streak, 1);
  assert.equal(firstCorrect.progress.intervalDays, 1);

  const secondCorrect = recordCorrectProgress(
    firstCorrect.progress,
    'w_reluctant',
    t0 + 2 * 86_400_000
  );
  assert.equal(secondCorrect.progress.streak, 2);
  assert.equal(secondCorrect.progress.intervalDays, 3);
});

test('weakness-driven adaptive engine prioritizes weak topics/POS and accelerates effortless cards', () => {
  const t0 = 1_700_000_000_000;

  // Fast, error-free streak accelerates SRS interval (3d -> 5d) so mastered cards appear less often
  const cleanFirst = recordCorrectProgress(null, 'w_apple', t0, 2200).progress;
  const cleanSecond = recordCorrectProgress(cleanFirst, 'w_apple', t0 + 86_400_000, 2100).progress;
  assert.equal(cleanSecond.intervalDays, 5);

  // User struggles with 'emotion'/adjective cards and masters 'daily'/noun cards
  const history: ReviewEvent[] = [
    {
      cardId: 'w_apple',
      en: 'apple',
      level: 'A1',
      posGroup: 'noun',
      topic: 'daily',
      isCorrect: true,
      responseMs: 2500,
      ratingBefore: 1000,
      ratingAfter: 1012,
      timestamp: t0 - 4000,
    },
    {
      cardId: 'w_apple',
      en: 'apple',
      level: 'A1',
      posGroup: 'noun',
      topic: 'daily',
      isCorrect: true,
      responseMs: 2400,
      ratingBefore: 1012,
      ratingAfter: 1022,
      timestamp: t0 - 3000,
    },
    {
      cardId: 'w_reluctant',
      en: 'reluctant',
      level: 'B2',
      posGroup: 'adjective',
      topic: 'emotion',
      isCorrect: false,
      responseMs: 14_000,
      ratingBefore: 1022,
      ratingAfter: 1004,
      timestamp: t0 - 2000,
    },
    {
      cardId: 'w_reluctant',
      en: 'reluctant',
      level: 'B2',
      posGroup: 'adjective',
      topic: 'emotion',
      isCorrect: false,
      responseMs: 15_000,
      ratingBefore: 1004,
      ratingAfter: 988,
      timestamp: t0 - 1000,
    },
  ];

  const profile = computeWeaknessProfile(history);
  assert.ok((profile.topicWeights.emotion ?? 0) > 0);
  assert.ok((profile.topicWeights.daily ?? 0) < 0);
  assert.ok((profile.posWeights.adjective ?? 0) > 0);
  assert.ok((profile.posWeights.noun ?? 0) < 0);

  // When selecting unseen cards, the adjective/emotion card is ranked ahead of the mastered daily/noun card
  const pick = selectNextCard(
    SAMPLE_CARDS,
    {},
    t0,
    {
      contentMode: 'word',
      levels: ['A1', 'A2', 'B1', 'B2', 'C1'],
      includeUserCards: true,
      preferredRating: 1150,
      reviewHistory: history,
    },
    () => 0
  );
  assert.equal(pick?.card.id, 'w_reluctant');
});

test('evaluateDictationAnswer grades word-by-word listening transcription accurately', () => {
  const res = evaluateDictationAnswer(
    'Consistent reading habits strengthen vocabulary retention.',
    'Consistent reading habit strengthen vocabulary retention'
  );
  assert.equal(res.tokens.length, 6);
  assert.equal(res.tokens[0]?.matched, true);
  assert.equal(res.tokens[2]?.matched, false);
  assert.equal(res.accuracyPercent, 83);
  assert.equal(res.isCorrect, false);

  const exact = evaluateDictationAnswer(
    'I need some sleep.',
    'i need some sleep'
  );
  assert.equal(exact.accuracyPercent, 100);
  assert.equal(exact.isCorrect, true);

  // LCS alignment keeps trailing matching words ('work.') green even when middle words ('back to') were replaced by 'the'
  const partial = evaluateDictationAnswer(
    'I need to get back to work.',
    'I need to get the work'
  );
  assert.equal(partial.tokens.length, 7);
  assert.equal(partial.tokens[4]?.expected, 'back');
  assert.equal(partial.tokens[4]?.actual, 'the');
  assert.equal(partial.tokens[4]?.matched, false);
  assert.equal(partial.tokens[5]?.expected, 'to');
  assert.equal(partial.tokens[5]?.actual, null);
  assert.equal(partial.tokens[5]?.matched, false);
  assert.equal(partial.tokens[6]?.expected, 'work.');
  assert.equal(partial.tokens[6]?.matched, true);
  assert.equal(partial.accuracyPercent, 71);
});

test('buildSmartYouGlishQuery strips punctuation and proper nouns for high-hit YouGlish searches', () => {
  assert.equal(
    buildSmartYouGlishQuery('May I have a piece of it ?'),
    'May I have a piece of it'
  );
  assert.equal(
    buildSmartYouGlishQuery('I want to go talk to Tom.'),
    'I want to go talk to'
  );
  assert.equal(
    buildSmartYouGlishQuery("Tom didn't know what to say!"),
    "didn't know what to say"
  );
});
