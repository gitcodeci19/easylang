import {
  classifyCardTopic,
  getCardDifficultyRating,
  normalizePosGroup,
} from './analytics.ts';
import type {
  Card,
  CefrLevel,
  ContentMode,
  DictationEvaluation,
  DictationWordToken,
  PosGroup,
  ReviewEvent,
  TopicDomain,
  UserCardProgress,
} from './types';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/**
 * Grace window so a periodic 20-minute alarm firing a few seconds early
 * still picks up cards queued for 20 minutes later.
 */
const RETRY_GRACE_MS = 60_000;

export function createInitialProgress(cardId: string, now: number): UserCardProgress {
  return {
    cardId,
    retryAt: null,
    retryCount: 0,
    nextDueAt: now,
    streak: 0,
    intervalDays: 0,
    totalCorrect: 0,
    totalWrong: 0,
    lastReviewedAt: 0,
  };
}

/**
 * Update progress when the user answers correctly (or confirms override).
 * When `responseMs` is provided, fast effortless answers accelerate intervals (`1.6x`)
 * so mastered items appear much less frequently, while previously missed/slow cards
 * advance conservatively so weak spots are reinforced.
 */
export function recordCorrectProgress(
  existing: UserCardProgress | null,
  cardId: string,
  now: number,
  responseMs?: number
): { progress: UserCardProgress; nextRepeatLabel: string } {
  const base = existing ?? createInitialProgress(cardId, now);
  const nextStreak = base.streak + 1;

  // Base progressive SRS intervals: 1d -> 3d -> 7d -> 15d -> 30d -> 60d -> 90d
  let intervalDays = 1;
  if (nextStreak === 1) intervalDays = 1;
  else if (nextStreak === 2) intervalDays = 3;
  else if (nextStreak === 3) intervalDays = 7;
  else if (nextStreak === 4) intervalDays = 15;
  else intervalDays = Math.min(90, Math.round(Math.max(15, base.intervalDays) * 2));

  if (responseMs !== undefined && nextStreak >= 2) {
    const isEffortlessMastery = responseMs > 0 && responseMs <= 4200 && base.totalWrong === 0;
    const isFragileCard = base.totalWrong >= 2 || responseMs >= 16_000;
    if (isEffortlessMastery) {
      intervalDays = Math.min(120, Math.max(intervalDays + 1, Math.round(intervalDays * 1.6)));
    } else if (isFragileCard) {
      intervalDays = Math.max(1, Math.round(intervalDays * 0.72));
    }
  }

  const updated: UserCardProgress = {
    ...base,
    retryAt: null,
    retryCount: 0,
    streak: nextStreak,
    intervalDays,
    nextDueAt: now + intervalDays * DAY_MS,
    totalCorrect: base.totalCorrect + 1,
    lastReviewedAt: now,
  };

  return {
    progress: updated,
    nextRepeatLabel: `In ${intervalDays} day${intervalDays === 1 ? '' : 's'}`,
  };
}

/**
 * Update progress when the user misses a card or clicks "Don't know".
 * Schedules the card into the priority retry queue after retryDelayMinutes (default 20).
 */
export function recordWrongProgress(
  existing: UserCardProgress | null,
  cardId: string,
  now: number,
  retryDelayMinutes: number
): { progress: UserCardProgress; nextRepeatLabel: string } {
  const base = existing ?? createInitialProgress(cardId, now);
  const safeDelay = Math.max(1, retryDelayMinutes);
  const retryAt = now + safeDelay * MINUTE_MS;

  const updated: UserCardProgress = {
    ...base,
    retryAt,
    retryCount: base.retryCount + 1,
    streak: 0,
    intervalDays: 0,
    nextDueAt: retryAt,
    totalWrong: base.totalWrong + 1,
    lastReviewedAt: now,
  };

  return {
    progress: updated,
    nextRepeatLabel: `Retry in ${safeDelay} min`,
  };
}

export interface CardSelection {
  card: Card;
  progress: UserCardProgress | null;
  isRetry: boolean;
  retryAttempt: number;
}

export interface WeaknessProfile {
  topicWeights: Partial<Record<TopicDomain, number>>;
  posWeights: Partial<Record<PosGroup, number>>;
  levelWeights: Partial<Record<CefrLevel, number>>;
}

/**
 * Analyze the user's review history to identify exact weak and strong areas:
 * - Topics / parts-of-speech / CEFR levels with high error rates or slow response times
 *   receive positive priority boosts (`+10` to `+45`) so the user practices what they lack.
 * - Areas where the user is consistently accurate (`>= 85%`) and fast receive negative
 *   weights (`-15` to `-35`) so the algorithm bothers them far less on mastered skills.
 */
export function computeWeaknessProfile(reviewHistory: ReviewEvent[]): WeaknessProfile {
  const topicStats = new Map<TopicDomain, { attempts: number; wrong: number; totalMs: number }>();
  const posStats = new Map<PosGroup, { attempts: number; wrong: number; totalMs: number }>();
  const levelStats = new Map<CefrLevel, { attempts: number; wrong: number; totalMs: number }>();

  // Weight recent 120 events more strongly so current weaknesses are tracked immediately.
  const recentSlice = reviewHistory.slice(-120);

  for (const ev of recentSlice) {
    const t = topicStats.get(ev.topic) ?? { attempts: 0, wrong: 0, totalMs: 0 };
    t.attempts += 1;
    if (!ev.isCorrect) t.wrong += 1;
    t.totalMs += Math.min(30_000, Math.max(500, ev.responseMs || 4000));
    topicStats.set(ev.topic, t);

    const p = posStats.get(ev.posGroup) ?? { attempts: 0, wrong: 0, totalMs: 0 };
    p.attempts += 1;
    if (!ev.isCorrect) p.wrong += 1;
    p.totalMs += Math.min(30_000, Math.max(500, ev.responseMs || 4000));
    posStats.set(ev.posGroup, p);

    const l = levelStats.get(ev.level) ?? { attempts: 0, wrong: 0, totalMs: 0 };
    l.attempts += 1;
    if (!ev.isCorrect) l.wrong += 1;
    l.totalMs += Math.min(30_000, Math.max(500, ev.responseMs || 4000));
    levelStats.set(ev.level, l);
  }

  const scoreBucket = (stats: { attempts: number; wrong: number; totalMs: number }): number => {
    if (stats.attempts === 0) return 0;
    const errorRate = stats.wrong / stats.attempts;
    const avgMs = stats.totalMs / stats.attempts;
    const slowPenalty = Math.max(0, Math.min(1, (avgMs - 5500) / 11_000));

    // Strong mastery: >= 2 attempts with 0 errors and fast answers, or >= 4 attempts with <= 12% error rate
    if (
      (stats.attempts >= 2 && stats.wrong === 0 && avgMs <= 5500) ||
      (stats.attempts >= 4 && errorRate <= 0.12 && avgMs <= 7500)
    ) {
      return -Math.min(35, 16 + stats.attempts * 3);
    }

    // Clear weakness: errors or slow hesitation
    if (errorRate >= 0.25 || slowPenalty >= 0.35) {
      return Math.round(errorRate * 38 + slowPenalty * 14);
    }

    return 0;
  };

  const topicWeights: Partial<Record<TopicDomain, number>> = {};
  for (const [k, v] of topicStats.entries()) {
    topicWeights[k] = scoreBucket(v);
  }

  const posWeights: Partial<Record<PosGroup, number>> = {};
  for (const [k, v] of posStats.entries()) {
    posWeights[k] = scoreBucket(v);
  }

  const levelWeights: Partial<Record<CefrLevel, number>> = {};
  for (const [k, v] of levelStats.entries()) {
    levelWeights[k] = scoreBucket(v);
  }

  return { topicWeights, posWeights, levelWeights };
}

/** Check whether a card matches the user's active filter settings. */
export function isCardEligible(
  card: Card,
  contentMode: ContentMode,
  levels: CefrLevel[],
  includeUserCards: boolean
): boolean {
  if (card.source === 'user' && !includeUserCards) return false;
  if (contentMode !== 'mixed' && card.type !== contentMode) return false;
  if (card.source === 'builtin' && levels.length > 0 && !levels.includes(card.level)) {
    return false;
  }
  return true;
}

/**
 * Select the next card using the Weakness-Driven Adaptive Algorithm:
 * 1. Highest priority: due cards in the 20-min retry queue (oldest due first).
 * 2. Due previously-seen SRS cards, prioritizing fragile cards (highest wrong-to-streak ratio)
 *    and cards in weak topics while deprioritizing effortlessly mastered ones.
 * 3. Unseen cards scored by multi-dimensional weakness profile (Topic + POS + CEFR + Elo zone)
 *    so the user practices what they struggle with and sees far fewer items from mastered domains.
 * 4. Fallback: earliest/weakest scheduled card if everything was already mastered ahead of time.
 */
export function selectNextCard(
  cards: Card[],
  progressMap: Record<string, UserCardProgress>,
  now: number,
  filters: {
    contentMode: ContentMode;
    levels: CefrLevel[];
    includeUserCards: boolean;
    preferredRating?: number;
    reviewHistory?: ReviewEvent[];
  },
  randomFn: () => number = Math.random
): CardSelection | null {
  if (cards.length === 0) return null;

  const cardById = new Map<string, Card>();
  for (const c of cards) {
    cardById.set(c.id, c);
  }

  // 1. Priority retry queue (ignore strict level filter so a missed card always comes back!)
  const dueRetries = Object.values(progressMap)
    .filter((p) => p.retryAt !== null && p.retryAt <= now + RETRY_GRACE_MS && cardById.has(p.cardId))
    .sort((a, b) => (a.retryAt ?? 0) - (b.retryAt ?? 0));

  if (dueRetries.length > 0) {
    const firstRetry = dueRetries[0]!;
    const card = cardById.get(firstRetry.cardId)!;
    return {
      card,
      progress: firstRetry,
      isRetry: true,
      retryAttempt: firstRetry.retryCount + 1,
    };
  }

  const eligible = cards.filter((c) =>
    isCardEligible(c, filters.contentMode, filters.levels, filters.includeUserCards)
  );
  const pool = eligible.length > 0 ? eligible : cards;
  const weakness = computeWeaknessProfile(filters.reviewHistory ?? []);

  const getWeaknessBoost = (card: Card): number => {
    const topic = classifyCardTopic(card);
    const pos = normalizePosGroup(card.pos, card.type);
    return (
      (weakness.topicWeights[topic] ?? 0) +
      (weakness.posWeights[pos] ?? 0) * 0.8 +
      (weakness.levelWeights[card.level] ?? 0) * 0.5
    );
  };

  // 2. Due SRS reviews (excluding cards still waiting for future retryAt)
  const dueReviews: Array<{ card: Card; progress: UserCardProgress; urgency: number }> = [];
  const unseen: Card[] = [];

  for (const card of pool) {
    const prog = progressMap[card.id];
    if (!prog || prog.lastReviewedAt === 0) {
      unseen.push(card);
      continue;
    }
    if (prog.retryAt === null && prog.nextDueAt <= now) {
      const overdueDays = Math.min(14, (now - prog.nextDueAt) / DAY_MS);
      const fragility = prog.totalWrong * 12 - prog.streak * 5;
      const urgency = overdueDays * 4 + fragility + getWeaknessBoost(card);
      dueReviews.push({ card, progress: prog, urgency });
    }
  }

  if (dueReviews.length > 0) {
    dueReviews.sort((a, b) => b.urgency - a.urgency || a.progress.nextDueAt - b.progress.nextDueAt);
    const chosen = dueReviews[0]!;
    return {
      card: chosen.card,
      progress: chosen.progress,
      isRetry: false,
      retryAttempt: 0,
    };
  }

  // 3. Unseen cards: prefer user cards, then score by WeaknessProfile + Elo Zone of Proximal Development
  if (unseen.length > 0) {
    const userFirst = unseen.filter((c) => c.source === 'user');
    const candidates = userFirst.length > 0 ? userFirst : unseen;
    const hasWeaknessSignals = (filters.reviewHistory?.length ?? 0) > 0;

    if (userFirst.length === 0 && (filters.preferredRating !== undefined || hasWeaknessSignals)) {
      const target = (filters.preferredRating ?? 1000) + 25; // Slightly above current Elo for growth
      const scored = candidates.map((card) => {
        const diff = getCardDifficultyRating(card);
        const distance = Math.abs(diff - target);
        // Penalize cards that are way too easy for the user even more strongly than slightly harder ones
        const tooEasyPenalty = diff < target - 160 ? (target - diff) * 0.22 : 0;
        const eloScore = 100 - distance * 0.18 - tooEasyPenalty;
        const weaknessScore = getWeaknessBoost(card);
        return {
          card,
          score: eloScore + weaknessScore,
        };
      });

      scored.sort((a, b) => b.score - a.score);
      const windowSize = Math.min(scored.length, hasWeaknessSignals ? 10 : 25);
      const idx = Math.floor(randomFn() * windowSize);
      const chosen = scored[idx]?.card ?? scored[0]!.card;
      return {
        card: chosen,
        progress: progressMap[chosen.id] ?? null,
        isRetry: false,
        retryAttempt: 0,
      };
    }

    const windowSize = Math.min(candidates.length, 25);
    const idx = Math.floor(randomFn() * windowSize);
    const chosen = candidates[idx] ?? candidates[0]!;
    return {
      card: chosen,
      progress: progressMap[chosen.id] ?? null,
      isRetry: false,
      retryAttempt: 0,
    };
  }

  // 4. Fallback if all cards are scheduled in the future
  const idx = Math.floor(randomFn() * pool.length);
  const chosen = pool[idx] ?? pool[0]!;
  return {
    card: chosen,
    progress: progressMap[chosen.id] ?? null,
    isRetry: false,
    retryAttempt: 0,
  };
}

function cleanDictationWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, '')
    .replace(/['’]/g, '');
}

const CONTRACTION_EXPANSIONS: Record<string, string[]> = {
  dont: ['do', 'not'],
  doesnt: ['does', 'not'],
  didnt: ['did', 'not'],
  cant: ['can', 'not'],
  cannot: ['can', 'not'],
  wont: ['will', 'not'],
  isnt: ['is', 'not'],
  arent: ['are', 'not'],
  wasnt: ['was', 'not'],
  werent: ['were', 'not'],
  havent: ['have', 'not'],
  hasnt: ['has', 'not'],
  im: ['i', 'am'],
  youre: ['you', 'are'],
  were: ['we', 'are'], // only applied when original had apostrophe
  theyre: ['they', 'are'],
  its: ['it', 'is'],
  ive: ['i', 'have'],
  youve: ['you', 'have'],
  weve: ['we', 'have'],
  theyve: ['they', 'have'],
  ill: ['i', 'will'],
  youll: ['you', 'will'],
  well: ['we', 'will'],
  theyll: ['they', 'will'],
};

function expandNormalizedTokens(rawWords: string[]): string[] {
  const out: string[] = [];
  for (const w of rawWords) {
    const cleaned = cleanDictationWord(w);
    const hasApostrophe = /['’]/.test(w);
    if (cleaned === 'cannot') {
      out.push('can', 'not');
    } else if (hasApostrophe && CONTRACTION_EXPANSIONS[cleaned]) {
      out.push(...CONTRACTION_EXPANSIONS[cleaned]!);
    } else if (!hasApostrophe && (cleaned === 'dont' || cleaned === 'didnt' || cleaned === 'doesnt' || cleaned === 'cant' || cleaned === 'im' || cleaned === 'youre' || cleaned === 'theyre' || cleaned === 'ive' || cleaned === 'theyve')) {
      out.push(...CONTRACTION_EXPANSIONS[cleaned]!);
    } else {
      out.push(cleaned);
    }
  }
  return out;
}

/**
 * Grade an English listening dictation attempt word-by-word using Longest Common Subsequence (LCS)
 * alignment so skipped or inserted words in the middle never misalign matching words later in the sentence.
 */
export function evaluateDictationAnswer(
  expectedSentence: string,
  userSentence: string
): DictationEvaluation {
  const expectedRawWords = expectedSentence.trim().split(/\s+/).filter(Boolean);
  const actualRawWords = userSentence.trim().split(/\s+/).filter(Boolean);

  const m = expectedRawWords.length;
  const n = actualRawWords.length;
  if (m === 0) {
    return { isCorrect: false, accuracyPercent: 0, tokens: [] };
  }

  const expNormalized = expandNormalizedTokens(expectedRawWords);
  const actNormalized = expandNormalizedTokens(actualRawWords);
  if (expNormalized.join(' ') === actNormalized.join(' ') && expNormalized.length > 0) {
    return {
      isCorrect: true,
      accuracyPercent: 100,
      tokens: expectedRawWords.map((w) => ({ expected: w, actual: w, matched: true })),
    };
  }

  const expClean = expectedRawWords.map(cleanDictationWord);
  const actClean = actualRawWords.map(cleanDictationWord);

  // Build LCS dynamic programming table: dp[i][j] = longest match from i..m and j..n
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (expClean[i] && expClean[i] === actClean[j]) {
        dp[i]![j] = 1 + (dp[i + 1]?.[j + 1] ?? 0);
      } else {
        dp[i]![j] = Math.max(dp[i + 1]?.[j] ?? 0, dp[i]?.[j + 1] ?? 0);
      }
    }
  }

  // Extract anchored matching index pairs (expIdx, actIdx)
  const matchedPairs: Array<{ expIdx: number; actIdx: number }> = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (expClean[i] && expClean[i] === actClean[j]) {
      matchedPairs.push({ expIdx: i, actIdx: j });
      i += 1;
      j += 1;
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      i += 1;
    } else {
      j += 1;
    }
  }

  const tokens: DictationWordToken[] = [];
  let prevExp = 0;
  let prevAct = 0;

  const pushUnmatchedSegment = (expStart: number, expEnd: number, actStart: number, actEnd: number) => {
    const expLen = expEnd - expStart;
    const actLen = actEnd - actStart;
    for (let k = 0; k < expLen; k += 1) {
      const expWord = expectedRawWords[expStart + k]!;
      const pairedAct = k < actLen ? (actualRawWords[actStart + k] ?? null) : null;
      tokens.push({
        expected: expWord,
        actual: pairedAct,
        matched: false,
      });
    }
  };

  for (const pair of matchedPairs) {
    pushUnmatchedSegment(prevExp, pair.expIdx, prevAct, pair.actIdx);
    tokens.push({
      expected: expectedRawWords[pair.expIdx]!,
      actual: actualRawWords[pair.actIdx]!,
      matched: true,
    });
    prevExp = pair.expIdx + 1;
    prevAct = pair.actIdx + 1;
  }

  pushUnmatchedSegment(prevExp, m, prevAct, n);

  const matchedCount = matchedPairs.length;
  const accuracyPercent = Math.round((matchedCount / m) * 100);
  return {
    isCorrect: accuracyPercent >= 85,
    accuracyPercent,
    tokens,
  };
}
