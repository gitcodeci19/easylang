import type {
  Card,
  CefrLevel,
  PosGroup,
  ReviewEvent,
  TopicDomain,
  UserCardProgress,
  UserSkillProfile,
} from './types';

export const INITIAL_SKILL_RATING = 1000;
const MIN_RATING = 600;
const MAX_RATING = 2000;

export const LEVEL_DIFFICULTY: Record<CefrLevel, number> = {
  A1: 800,
  A2: 1000,
  B1: 1200,
  B2: 1400,
  C1: 1600,
  C2: 1800,
};

export const TOPIC_LABELS: Record<TopicDomain, string> = {
  business: 'Business & Finance',
  tech: 'Tech & Science',
  health: 'Health & Body',
  travel: 'Travel & Places',
  emotion: 'Emotions & Communication',
  academic: 'Academic & Concepts',
  nature: 'Nature & Environment',
  daily: 'Daily Life',
};

export const POS_LABELS: Record<PosGroup, string> = {
  noun: 'Nouns',
  verb: 'Verbs',
  adjective: 'Adjectives',
  adverb: 'Adverbs',
  sentence: 'Sentences',
  grammar: 'Grammar / Other',
};

const TOPIC_KEYWORDS: Array<{ topic: TopicDomain; pattern: RegExp }> = [
  {
    topic: 'business',
    pattern:
      /\b(business|company|office|market|money|bank|price|cost|profit|salary|wage|contract|trade|sell|buy|customer|client|manager|career|job|tax|budget|finance|economy|invest|firm|brand|deal|industry|workplace|startup|freelance|remote|portfolio|deadline|meeting|email|shipping|cart|sale|promo|discount|store|shop|refund|payment|şirket|ticaret|para|banka|maaş|fiyat|müşteri|sözleşme|ekonomi|iş|kargo|indirim|bütçe|toplantı)\b/i,
  },
  {
    topic: 'tech',
    pattern:
      /\b(computer|software|data|internet|network|digital|system|device|screen|code|coding|program|robot|science|technology|machine|engine|electric|energy|signal|app|server|phone|battery|algorithm|ai|gpu|laptop|keyboard|browser|ping|wifi|wi-fi|password|backup|cloud|encryption|latency|debug|bug|open-source|extension|gaming|esports|steam|discord|bilgisayar|yazılım|veri|teknoloji|sistem|bilim|cihaz|enerji|ekran|klavye|şifre|yapay zekâ)\b/i,
  },
  {
    topic: 'health',
    pattern:
      /\b(health|doctor|hospital|medicine|pain|sick|disease|body|heart|brain|blood|sleep|muscle|skin|breath|breathe|injury|fever|diet|stress|mental|posture|gym|workout|marathon|jog|stretch|caffeine|headache|shower|sağlık|doktor|hastane|ilaç|ağrı|hasta|vücut|kalp|uyku|tedavi|antrenman|spor|duruş)\b/i,
  },
  {
    topic: 'travel',
    pattern:
      /\b(travel|trip|airport|flight|plane|train|bus|ticket|hotel|road|street|city|country|border|map|station|journey|drive|ship|luggage|passport|subway|metro|boarding|coast|island|beach|vacation|holiday|camp|camping|tokyo|europe|traffic|yolculuk|seyahat|havalimanı|uçak|tren|bilet|otel|şehir|harita|istasyon|pasaport|tatil|kamp)\b/i,
  },
  {
    topic: 'emotion',
    pattern:
      /\b(feel|happy|sad|angry|fear|love|hate|hope|trust|agree|argue|promise|honest|proud|shame|worry|surprise|anxious|calm|kind|friend|smile|cry|music|rock|song|concert|movie|film|cinema|game|gta|spotify|podcast|episode|spoiler|laugh|excited|nervous|mood|burnout|hobby|enjoy|fun|duygu|mutlu|üzgün|kızgın|korku|sevgi|umut|güven|dürüst|endişe|müzik|film|konser|oyun|arkadaş)\b/i,
  },
  {
    topic: 'nature',
    pattern:
      /\b(nature|weather|rain|snow|wind|sun|sunset|sunrise|river|sea|ocean|mountain|forest|tree|plant|animal|earth|climate|environment|storm|sky|fire|water|cat|dog|horse|bird|fish|lion|elephant|frog|snake|monkey|spider|bear|wolf|whale|sheep|cow|chicken|pig|pet|wildlife|habitat|nest|wing|tail|feather|fur|turtle|squirrel|owl|dolphin|parrot|doğa|hava|yağmur|rüzgar|deniz|orman|ağaç|hayvan|iklim|çevre|kedi|köpek|kuş|at)\b/i,
  },
  {
    topic: 'academic',
    pattern:
      /\b(theory|concept|evidence|research|study|analysis|method|methodology|principle|factor|logic|reason|policy|law|legal|court|judge|verdict|justice|ethics|moral|philosophy|constitution|copyright|privacy|autonomy|accountability|history|culture|society|education|university|knowledge|abstract|significant|evaluate|hypothesis|experiment|correlation|quantum|neuroplasticity|assignment|exam|course|tutorial|fluency|teori|kavram|kanıt|araştırma|yöntem|ilke|tarih|kültür|toplum|eğitim|bilgi|hukuk|adalet|felsefe)\b/i,
  },
];

const topicCache = new WeakMap<Card, TopicDomain>();

export function createInitialSkillProfile(): UserSkillProfile {
  return {
    rating: INITIAL_SKILL_RATING,
    totalAnswered: 0,
    totalCorrect: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastUpdatedAt: 0,
  };
}

export function classifyCardTopic(card: Card): TopicDomain {
  const cached = topicCache.get(card);
  if (cached) return cached;
  const haystack = `${card.en} ${card.acceptedTr.join(' ')} ${card.exampleEn} ${card.exampleTr}`;
  let resolved: TopicDomain = 'daily';
  for (const rule of TOPIC_KEYWORDS) {
    if (rule.pattern.test(haystack)) {
      resolved = rule.topic;
      break;
    }
  }
  topicCache.set(card, resolved);
  return resolved;
}

export function normalizePosGroup(pos: string, type: Card['type']): PosGroup {
  if (type === 'sentence') return 'sentence';
  const p = pos.toLowerCase();
  if (p.includes('adverb') || p === 'adv') return 'adverb';
  if (p.includes('verb') || p === 'v') return 'verb';
  if (p.includes('adjective') || p === 'adj') return 'adjective';
  if (p.includes('noun') || p === 'n') return 'noun';
  return 'grammar';
}

export function getCardDifficultyRating(card: Card): number {
  const base = LEVEL_DIFFICULTY[card.level] ?? 1200;
  return base + (card.type === 'sentence' ? 50 : 0);
}

/** Map numeric Elo/IRT rating to an estimated CEFR level and progress within that band. */
export function ratingToCefrProgress(rating: number): {
  level: CefrLevel;
  bandPercent: number;
  nextLevel: CefrLevel | null;
} {
  const bands: Array<{ level: CefrLevel; min: number; max: number; next: CefrLevel | null }> = [
    { level: 'A1', min: 600, max: 900, next: 'A2' },
    { level: 'A2', min: 900, max: 1100, next: 'B1' },
    { level: 'B1', min: 1100, max: 1300, next: 'B2' },
    { level: 'B2', min: 1300, max: 1500, next: 'C1' },
    { level: 'C1', min: 1500, max: 1700, next: 'C2' },
    { level: 'C2', min: 1700, max: 2000, next: null },
  ];

  for (const band of bands) {
    if (rating < band.max || band.next === null) {
      const clamped = Math.max(band.min, Math.min(band.max, rating));
      const bandPercent = Math.round(((clamped - band.min) / (band.max - band.min)) * 100);
      return { level: band.level, bandPercent, nextLevel: band.next };
    }
  }

  return { level: 'A2', bandPercent: 50, nextLevel: 'B1' };
}

export function getConfidenceLabel(totalAnswered: number): string {
  if (totalAnswered < 15) return 'Low (Calibrating · 15+ answers recommended)';
  if (totalAnswered < 50) return 'Medium (Improving)';
  return 'High (Stable estimate)';
}

/**
 * Update the user's skill profile using an Elo/IRT-inspired expected accuracy formula.
 * Harder cards grant larger gains when answered correctly; easy misses penalize more.
 */
export function applyAnswerToSkillProfile(
  profile: UserSkillProfile,
  card: Card,
  isCorrect: boolean,
  options: {
    responseMs: number;
    isRetryAttempt: boolean;
    now: number;
  }
): { nextProfile: UserSkillProfile; delta: number } {
  const cardDiff = getCardDifficultyRating(card);
  const expected = 1 / (1 + 10 ** ((cardDiff - profile.rating) / 400));

  // Higher K-factor during first 20 questions for faster initial calibration
  const baseK = profile.totalAnswered < 20 ? 44 : 28;
  const speedMultiplier = isCorrect && options.responseMs > 0 && options.responseMs <= 4500 ? 1.15 : 1;
  const retryMultiplier = isCorrect && options.isRetryAttempt ? 0.65 : 1;
  const k = baseK * speedMultiplier * retryMultiplier;

  const actual = isCorrect ? 1 : 0;
  let delta = Math.round(k * (actual - expected));
  const ratingGap = profile.rating - cardDiff;
  if (isCorrect) {
    if (ratingGap >= 350) {
      // Anti-farming cap: cards 350+ Elo below the user's current level grant 0 Elo
      delta = 0;
    } else if (ratingGap >= 200) {
      delta = Math.min(1, Math.max(0, delta));
    } else if (delta < 3) {
      delta = 3;
    }
  } else if (delta > -3) {
    delta = -3;
  }

  const nextRating = Math.max(MIN_RATING, Math.min(MAX_RATING, profile.rating + delta));
  const actualDelta = nextRating - profile.rating;
  const nextStreak = isCorrect ? profile.currentStreak + 1 : 0;

  return {
    delta: actualDelta,
    nextProfile: {
      rating: nextRating,
      totalAnswered: profile.totalAnswered + 1,
      totalCorrect: profile.totalCorrect + (isCorrect ? 1 : 0),
      currentStreak: nextStreak,
      bestStreak: Math.max(profile.bestStreak, nextStreak),
      lastUpdatedAt: options.now,
    },
  };
}

export interface BucketMetric {
  key: string;
  label: string;
  attempts: number;
  correct: number;
  accuracy: number;
  mastered: number;
  avgResponseMs: number;
}

export interface AnalyticsSummary {
  profile: UserSkillProfile;
  cefr: { level: CefrLevel; bandPercent: number; nextLevel: CefrLevel | null };
  confidenceLabel: string;
  overallAccuracy: number;
  avgResponseMs: number;
  byLevel: BucketMetric[];
  byPos: BucketMetric[];
  byTopic: BucketMetric[];
  strongestTopics: BucketMetric[];
  weakestTopics: BucketMetric[];
  ratingSeries: Array<{ rating: number; timestamp: number; isCorrect: boolean }>;
  hardCards: Array<{ card: Card; progress: UserCardProgress }>;
}

/**
 * Compute full multi-dimensional analytics across CEFR levels, parts of speech,
 * semantic topic domains, response speed, and rating trajectory.
 */
export function buildAnalyticsSummary(
  cards: Card[],
  progressMap: Record<string, UserCardProgress>,
  profile: UserSkillProfile,
  history: ReviewEvent[]
): AnalyticsSummary {
  const cardById = new Map<string, Card>();
  for (const c of cards) cardById.set(c.id, c);

  type Accum = {
    attempts: number;
    correct: number;
    mastered: number;
    responseSum: number;
    responseCount: number;
  };

  const levelAcc = new Map<CefrLevel, Accum>();
  const posAcc = new Map<PosGroup, Accum>();
  const topicAcc = new Map<TopicDomain, Accum>();

  const ensureAcc = <K>(map: Map<K, Accum>, key: K): Accum => {
    let existing = map.get(key);
    if (!existing) {
      existing = { attempts: 0, correct: 0, mastered: 0, responseSum: 0, responseCount: 0 };
      map.set(key, existing);
    }
    return existing;
  };

  // Seed mastered/progress totals from progressMap (covers cards answered before history logging)
  for (const prog of Object.values(progressMap)) {
    const card = cardById.get(prog.cardId);
    if (!card) continue;
    const isMastered = prog.streak >= 2 && prog.retryAt === null ? 1 : 0;
    const pos = normalizePosGroup(card.pos, card.type);
    const topic = classifyCardTopic(card);

    ensureAcc(levelAcc, card.level).mastered += isMastered;
    ensureAcc(posAcc, pos).mastered += isMastered;
    ensureAcc(topicAcc, topic).mastered += isMastered;
  }

  let totalResponseSum = 0;
  let totalResponseCount = 0;

  if (history.length > 0) {
    for (const ev of history) {
      const l = ensureAcc(levelAcc, ev.level);
      l.attempts += 1;
      l.correct += ev.isCorrect ? 1 : 0;

      const p = ensureAcc(posAcc, ev.posGroup);
      p.attempts += 1;
      p.correct += ev.isCorrect ? 1 : 0;

      const t = ensureAcc(topicAcc, ev.topic);
      t.attempts += 1;
      t.correct += ev.isCorrect ? 1 : 0;

      if (ev.responseMs > 0 && ev.responseMs < 120_000) {
        l.responseSum += ev.responseMs;
        l.responseCount += 1;
        p.responseSum += ev.responseMs;
        p.responseCount += 1;
        t.responseSum += ev.responseMs;
        t.responseCount += 1;
        totalResponseSum += ev.responseMs;
        totalResponseCount += 1;
      }
    }
  } else {
    // Fallback to aggregate progressMap if no review history events exist yet
    for (const prog of Object.values(progressMap)) {
      const card = cardById.get(prog.cardId);
      if (!card) continue;
      const attempts = prog.totalCorrect + prog.totalWrong;
      if (attempts === 0) continue;

      const l = ensureAcc(levelAcc, card.level);
      l.attempts += attempts;
      l.correct += prog.totalCorrect;

      const p = ensureAcc(posAcc, normalizePosGroup(card.pos, card.type));
      p.attempts += attempts;
      p.correct += prog.totalCorrect;

      const t = ensureAcc(topicAcc, classifyCardTopic(card));
      t.attempts += attempts;
      t.correct += prog.totalCorrect;
    }
  }

  const toMetrics = <K extends string>(
    keys: K[],
    map: Map<K, Accum>,
    labelMap: Record<K, string>
  ): BucketMetric[] =>
    keys.map((key) => {
      const acc = map.get(key) ?? {
        attempts: 0,
        correct: 0,
        mastered: 0,
        responseSum: 0,
        responseCount: 0,
      };
      return {
        key,
        label: labelMap[key],
        attempts: acc.attempts,
        correct: acc.correct,
        accuracy: acc.attempts > 0 ? Math.round((acc.correct / acc.attempts) * 100) : 0,
        mastered: acc.mastered,
        avgResponseMs:
          acc.responseCount > 0 ? Math.round(acc.responseSum / acc.responseCount) : 0,
      };
    });

  const levelLabels: Record<CefrLevel, string> = {
    A1: 'A1 (Beginner)',
    A2: 'A2 (Elementary)',
    B1: 'B1 (Intermediate)',
    B2: 'B2 (Upper-Int.)',
    C1: 'C1 (Advanced)',
    C2: 'C2 (Mastery)',
  };

  const byLevel = toMetrics(['A1', 'A2', 'B1', 'B2', 'C1'], levelAcc, levelLabels);
  const byPos = toMetrics(
    ['noun', 'verb', 'adjective', 'adverb', 'sentence', 'grammar'],
    posAcc,
    POS_LABELS
  ).sort((a, b) => b.attempts - a.attempts);

  const byTopic = toMetrics(
    ['daily', 'emotion', 'business', 'tech', 'travel', 'health', 'academic', 'nature'],
    topicAcc,
    TOPIC_LABELS
  ).sort((a, b) => b.accuracy - a.accuracy || b.attempts - a.attempts);

  const qualifiedTopics = byTopic.filter((t) => t.attempts >= 2);
  const strongestTopics = [...qualifiedTopics]
    .sort((a, b) => b.accuracy - a.accuracy || b.attempts - a.attempts)
    .slice(0, 3);
  const weakestTopics = [...qualifiedTopics]
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
    .slice(0, 3);

  const hardCards = Object.values(progressMap)
    .filter((p) => p.totalWrong > 0 && cardById.has(p.cardId))
    .sort((a, b) => b.totalWrong - a.totalWrong || (a.streak - b.streak))
    .slice(0, 10)
    .map((p) => ({ card: cardById.get(p.cardId)!, progress: p }));

  const overallAccuracy =
    profile.totalAnswered > 0
      ? Math.round((profile.totalCorrect / profile.totalAnswered) * 100)
      : 0;

  return {
    profile,
    cefr: ratingToCefrProgress(profile.rating),
    confidenceLabel: getConfidenceLabel(profile.totalAnswered),
    overallAccuracy,
    avgResponseMs: totalResponseCount > 0 ? Math.round(totalResponseSum / totalResponseCount) : 0,
    byLevel,
    byPos,
    byTopic,
    strongestTopics,
    weakestTopics,
    ratingSeries: history.slice(-40).map((h) => ({
      rating: h.ratingAfter,
      timestamp: h.timestamp,
      isCorrect: h.isCorrect,
    })),
    hardCards,
  };
}
