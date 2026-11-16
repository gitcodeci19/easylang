import { isCardEligible } from './srs.ts';
import type {
  Card,
  CefrLevel,
  ConceptNote,
  ConceptStage,
  ConceptTrackerState,
  ConceptWeakPointInput,
  ContentMode,
  UserCardProgress,
} from './types';

export const CONCEPT_STAGE_GAPS: Record<0 | 1 | 2, number> = {
  0: 2, // 1st check after 2 other questions (never back-to-back)
  1: 4, // 2nd reinforcement after 4 other questions
  2: 10, // Long-term retention check after 10 questions before marking mastered
};

/** Global cooldown between any two concept-targeted prompts to avoid repetitive drills. */
export const MIN_QUESTIONS_BETWEEN_CONCEPT_PROMPTS = 2;
const MAX_CONCEPT_NOTES = 100;

interface GrammarRule {
  id: string;
  triggerTokens: string[];
  sentenceMatch: RegExp;
  pattern: string;
  label: string;
  explanation: string;
}

const GRAMMAR_RULES: GrammarRule[] = [
  {
    id: 'grammar:used_to',
    triggerTokens: ['to', 'used', 'used to'],
    sentenceMatch: /\bused\s+to\b/i,
    pattern: '\\bused\\s+to\\b',
    label: "'used to' habit structure & 'to' infinitive link",
    explanation:
      "'used to + verb' expresses past habits or states that no longer happen (\"eskiden ...-ardı\"). Here 'to' links the base verb ('be', 'live', etc.) to the pattern.",
  },
  {
    id: 'grammar:have_to',
    triggerTokens: ['to', 'have', 'has', 'had', 'have to', 'has to', 'had to'],
    sentenceMatch: /\b(?:have|has|had)\s+to\b/i,
    pattern: '\\b(?:have|has|had)\\s+to\\b',
    label: "'have to / had to' obligation modal",
    explanation:
      "'have/has/had + to + verb' expresses necessity or obligation (\"-mek zorunda olmak\"); 'to' links the base verb.",
  },
  {
    id: 'grammar:going_to',
    triggerTokens: ['to', 'going', 'going to'],
    sentenceMatch: /\bgoing\s+to\b/i,
    pattern: '\\bgoing\\s+to\\b',
    label: "'be going to' planned future",
    explanation:
      "'be going to + verb' expresses an intention or strong near-future expectation (\"-ecek/-acak\").",
  },
  {
    id: 'grammar:infinitive_to',
    triggerTokens: ['to'],
    sentenceMatch: /\bto\s+[a-z]{2,}\b/i,
    pattern: '\\bto\\s+[a-z]{2,}\\b',
    label: "'to + verb' infinitive / 'to' direction preposition",
    explanation:
      "Before a verb, 'to' forms an infinitive (purpose or linking action); before a noun, it shows direction toward something (\"-e/-a\").",
  },
  {
    id: 'grammar:for_since',
    triggerTokens: ['for', 'since'],
    sentenceMatch: /\b(?:for|since)\b/i,
    pattern: '\\b(?:for|since)\\b',
    label: "'for' vs 'since' duration & starting point",
    explanation:
      "'for' states duration ('for 2 hours') or purpose; 'since' marks a starting point in time ('since 2020') or means 'because'.",
  },
  {
    id: 'grammar:would',
    triggerTokens: ['would', "'d"],
    sentenceMatch: /\bwould\b/i,
    pattern: '\\bwould\\b',
    label: "'would' conditional / polite request / past habit",
    explanation:
      "'would' indicates hypothetical outcomes ('-erdi/-ardı'), polite requests, or repeated past habits.",
  },
  {
    id: 'grammar:should_ought',
    triggerTokens: ['should', 'ought', 'ought to'],
    sentenceMatch: /\b(?:should|ought\s+to)\b/i,
    pattern: '\\b(?:should|ought\\s+to)\\b',
    label: "'should / ought to' advice & expectation",
    explanation:
      "'should' and 'ought to' express advice, recommendation, or expectation ('-meli/-malı').",
  },
  {
    id: 'grammar:past_continuous',
    triggerTokens: ['was', 'were', 'was taking', 'past continuous', '-ing', 'taking'],
    sentenceMatch: /\b(?:was|were)\s+[a-z]{2,}ing\b/i,
    pattern: '\\b(?:was|were)\\s+[a-z]{2,}ing\\b',
    label: "'was/were + V-ing' (Past Continuous)",
    explanation:
      "'was/were + verb-ing' describes an ongoing action at a moment in the past ('yapıyordum / yürüyordum'), distinct from a completed single past action ('yaptım').",
  },
  {
    id: 'grammar:present_perfect',
    triggerTokens: ['have', 'has', 'had', 'been', 'present perfect', 'have been', 'has been'],
    sentenceMatch: /\b(?:have|has|had|'ve|'s|'d)\s+(?:been|done|seen|made|gone|taken|written|found|heard|known|got|gotten|had)\b/i,
    pattern: "\\b(?:have|has|had|'ve|'s|'d)\\s+(?:been|done|seen|made|gone|taken|written|found|heard|known|got|gotten|had)\\b",
    label: "'have/has + V3' (Present/Past Perfect)",
    explanation:
      "'have/has + past participle' connects a past action or experience to the present rather than framing it as a closed past event.",
  },
  {
    id: 'grammar:future_will',
    triggerTokens: ['will', "'ll", 'future'],
    sentenceMatch: /\b(?:will|'ll)\s+[a-z]{2,}\b/i,
    pattern: "\\b(?:will|'ll)\\s+[a-z]{2,}\\b",
    label: "'will + verb' (Future Tense)",
    explanation:
      "'will' marks a future decision, prediction, or promise ('-ecek/-acak').",
  },
  {
    id: 'grammar:contrast',
    triggerTokens: ['although', 'though', 'despite', 'unless', 'however'],
    sentenceMatch: /\b(?:although|though|despite|unless|however)\b/i,
    pattern: '\\b(?:although|though|despite|unless|however)\\b',
    label: 'Contrast & condition linkers (although / unless / despite)',
    explanation:
      "These linkers introduce an unexpected contrast ('-e rağmen') or an exception/condition ('-medikçe').",
  },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createInitialConceptState(): ConceptTrackerState {
  return {
    notes: [],
    lastConceptPromptAtQuestion: -10,
  };
}

export function compileConceptRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, 'i');
  } catch {
    return null;
  }
}

export interface InferredConceptSpec {
  id: string;
  label: string;
  focusToken: string;
  pattern: string;
  explanation: string;
}

/**
 * Derive a canonical concept ID, regex matcher, and Turkish fallback explanation
 * from the source card + focused token/AI weakPoint.
 */
export function inferConceptSpec(
  card: Card,
  rawFocusToken: string,
  aiWeakPoint?: ConceptWeakPointInput
): InferredConceptSpec {
  const focusToken = (rawFocusToken || aiWeakPoint?.token || card.en).trim().slice(0, 64);
  const lowerToken = focusToken.toLowerCase();

  for (const rule of GRAMMAR_RULES) {
    const tokenHit = rule.triggerTokens.some(
      (t) => t === lowerToken || lowerToken.includes(t)
    );
    const labelHit = aiWeakPoint?.label
      ? rule.triggerTokens.some((t) => aiWeakPoint.label.toLowerCase().includes(t))
      : false;
    if ((tokenHit || labelHit) && rule.sentenceMatch.test(card.en)) {
      return {
        id: rule.id,
        label: aiWeakPoint?.label?.trim() || rule.label,
        focusToken,
        pattern: rule.pattern,
        explanation: aiWeakPoint?.explanation?.trim() || rule.explanation,
      };
    }
  }

  const normalizedKey = (aiWeakPoint?.key || lowerToken)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

  const escaped = escapeRegex(focusToken);
  const pattern = focusToken.length >= 2 ? `\\b${escaped}\\b` : escaped;

  return {
    id: `token:${normalizedKey || 'custom'}`,
    label: aiWeakPoint?.label?.trim() || `Usage of '${focusToken}'`,
    focusToken,
    pattern,
    explanation:
      aiWeakPoint?.explanation?.trim() ||
      `In "${card.en}", '${focusToken}' contributes to the meaning: ${card.acceptedTr.slice(0, 2).join(', ')}.`,
  };
}

/**
 * Record or re-activate a weak-spot/grammar concept and schedule its first
 * non-consecutive check after CONCEPT_STAGE_GAPS[0] (2) questions.
 */
export function upsertConceptNote(
  state: ConceptTrackerState,
  card: Card,
  focusToken: string,
  currentQuestionSeq: number,
  now: number,
  aiWeakPoint?: ConceptWeakPointInput
): { nextState: ConceptTrackerState; note: ConceptNote } {
  const spec = inferConceptSpec(card, focusToken, aiWeakPoint);
  const notes = [...state.notes];
  const idx = notes.findIndex((n) => n.id === spec.id);
  const nextCheck = currentQuestionSeq + CONCEPT_STAGE_GAPS[0];

  if (idx >= 0) {
    const prev = notes[idx]!;
    const practiced = Array.from(new Set([...prev.practicedCardIds, card.id])).slice(-24);
    const updated: ConceptNote = {
      ...prev,
      label: spec.label,
      focusToken: spec.focusToken,
      sourceCardId: card.id,
      sourceEn: card.en,
      explanation: spec.explanation,
      pattern: spec.pattern,
      stage: 0,
      nextCheckAtQuestion: nextCheck,
      practicedCardIds: practiced,
      wrongCount: prev.wrongCount + 1,
      lastPracticedAt: now,
      masteredAt: null,
    };
    notes[idx] = updated;
    return { nextState: { ...state, notes }, note: updated };
  }

  const created: ConceptNote = {
    id: spec.id,
    label: spec.label,
    focusToken: spec.focusToken,
    sourceCardId: card.id,
    sourceEn: card.en,
    explanation: spec.explanation,
    pattern: spec.pattern,
    stage: 0,
    nextCheckAtQuestion: nextCheck,
    practicedCardIds: [card.id],
    attempts: 1,
    correctCount: 0,
    wrongCount: 1,
    createdAt: now,
    lastPracticedAt: now,
    masteredAt: null,
  };

  notes.unshift(created);
  const trimmed = notes.slice(0, MAX_CONCEPT_NOTES);
  return { nextState: { ...state, notes: trimmed }, note: created };
}

export function countUnusedMatchingCards(concept: ConceptNote, cards: Card[]): number {
  const re = compileConceptRegex(concept.pattern);
  if (!re) return 0;
  const practiced = new Set(concept.practicedCardIds);
  let count = 0;
  for (const c of cards) {
    if (c.id === concept.sourceCardId || practiced.has(c.id)) continue;
    if (re.test(c.en)) count += 1;
  }
  return count;
}

export interface DueConceptSelection {
  concept: ConceptNote;
  card: Card;
  progress: UserCardProgress | null;
}

/**
 * Pick an overdue concept and a varied (non-repeated) card matching that concept.
 * Enforces a cooldown gap so concept-focused questions are spaced out over time.
 */
export function selectDueConceptAndCard(
  state: ConceptTrackerState,
  cards: Card[],
  progressMap: Record<string, UserCardProgress>,
  currentQuestionSeq: number,
  filters: {
    contentMode: ContentMode;
    levels: CefrLevel[];
    includeUserCards: boolean;
  },
  randomFn: () => number = Math.random
): DueConceptSelection | null {
  if (
    state.lastConceptPromptAtQuestion >= 0 &&
    currentQuestionSeq - state.lastConceptPromptAtQuestion < MIN_QUESTIONS_BETWEEN_CONCEPT_PROMPTS
  ) {
    return null;
  }

  const dueConcepts = state.notes
    .filter((n) => n.stage < 3 && n.masteredAt === null && currentQuestionSeq >= n.nextCheckAtQuestion)
    .sort((a, b) => {
      const overdueA = currentQuestionSeq - a.nextCheckAtQuestion;
      const overdueB = currentQuestionSeq - b.nextCheckAtQuestion;
      if (overdueB !== overdueA) return overdueB - overdueA;
      return a.lastPracticedAt - b.lastPracticedAt;
    });

  for (const concept of dueConcepts) {
    const re = compileConceptRegex(concept.pattern);
    if (!re) continue;

    const practicedSet = new Set(concept.practicedCardIds);
    const matchingAll = cards.filter((c) => re.test(c.en));
    if (matchingAll.length === 0) continue;

    // Prefer unused cards != sourceCardId, prioritizing sentences for grammar clarity
    const unused = matchingAll.filter(
      (c) => c.id !== concept.sourceCardId && !practicedSet.has(c.id)
    );

    let candidates = unused.filter((c) =>
      isCardEligible(c, filters.contentMode, filters.levels, filters.includeUserCards)
    );
    if (candidates.length === 0) candidates = unused;

    if (candidates.length > 0) {
      const sentences = candidates.filter((c) => c.type === 'sentence');
      const pool = sentences.length > 0 ? sentences : candidates;
      const idx = Math.floor(randomFn() * Math.min(pool.length, 15));
      const chosen = pool[idx] ?? pool[0]!;
      return {
        concept,
        card: chosen,
        progress: progressMap[chosen.id] ?? null,
      };
    }

    // Fallback when all matching cards in the deck were already seen: pick oldest non-last card
    const lastId = concept.practicedCardIds[concept.practicedCardIds.length - 1];
    const rotated = matchingAll.filter((c) => c.id !== lastId);
    const fallbackPool = rotated.length > 0 ? rotated : matchingAll;
    const idx = Math.floor(randomFn() * fallbackPool.length);
    const chosen = fallbackPool[idx] ?? fallbackPool[0]!;
    return {
      concept,
      card: chosen,
      progress: progressMap[chosen.id] ?? null,
    };
  }

  return null;
}

/**
 * Advance or reset a concept note's spaced mastery stage after the user answers.
 * Stage progression: 0 (+2q) -> 1 (+4q) -> 2 (+10q) -> 3 (mastered).
 */
export function advanceConceptAfterAnswer(
  state: ConceptTrackerState,
  conceptId: string,
  cardId: string,
  isCorrect: boolean,
  currentQuestionSeq: number,
  now: number,
  reflaggedConfusion: boolean = false
): { nextState: ConceptTrackerState; updated: ConceptNote | null; progressNote: string } {
  const idx = state.notes.findIndex((n) => n.id === conceptId);
  if (idx < 0) {
    return { nextState: state, updated: null, progressNote: '' };
  }

  const notes = [...state.notes];
  const prev = notes[idx]!;
  const practiced = Array.from(new Set([...prev.practicedCardIds, cardId])).slice(-24);

  let nextStage: ConceptStage = prev.stage;
  let nextCheckAtQuestion = prev.nextCheckAtQuestion;
  let masteredAt: number | null = prev.masteredAt;
  let progressNote = '';

  if (reflaggedConfusion || !isCorrect) {
    nextStage = 0;
    masteredAt = null;
    nextCheckAtQuestion = currentQuestionSeq + CONCEPT_STAGE_GAPS[0];
    progressNote = `🔁 "${prev.label}" queued again (next check in ${CONCEPT_STAGE_GAPS[0]} questions).`;
  } else if (prev.stage === 0) {
    nextStage = 1;
    nextCheckAtQuestion = currentQuestionSeq + CONCEPT_STAGE_GAPS[1];
    progressNote = `🎯 "${prev.label}" cleared Stage 1 (next check in ${CONCEPT_STAGE_GAPS[1]} questions).`;
  } else if (prev.stage === 1) {
    nextStage = 2;
    nextCheckAtQuestion = currentQuestionSeq + CONCEPT_STAGE_GAPS[2];
    progressNote = `⏳ "${prev.label}" cleared Stage 2 — final retention test in 10 questions!`;
  } else {
    nextStage = 3;
    masteredAt = now;
    nextCheckAtQuestion = currentQuestionSeq;
    progressNote = `🏆 "${prev.label}" passed the +10 question retention check and is mastered!`;
  }

  const updated: ConceptNote = {
    ...prev,
    stage: nextStage,
    nextCheckAtQuestion,
    practicedCardIds: practiced,
    attempts: prev.attempts + 1,
    correctCount: prev.correctCount + (isCorrect && !reflaggedConfusion ? 1 : 0),
    wrongCount: prev.wrongCount + (!isCorrect || reflaggedConfusion ? 1 : 0),
    lastPracticedAt: now,
    masteredAt,
  };

  notes[idx] = updated;
  return {
    nextState: {
      notes,
      lastConceptPromptAtQuestion: state.lastConceptPromptAtQuestion,
    },
    updated,
    progressNote,
  };
}

export function getConceptStageSummary(concept: ConceptNote, currentQuestionSeq: number): string {
  if (concept.stage >= 3 || concept.masteredAt !== null) {
    return '🏆 Mastered (passed 10-question check)';
  }
  const remaining = Math.max(0, concept.nextCheckAtQuestion - currentQuestionSeq);
  const stageText =
    concept.stage === 0
      ? 'Stage 1/3 · Initial Reinforcement'
      : concept.stage === 1
        ? 'Stage 2/3 · Mid Check'
        : 'Stage 3/3 · +10Q Retention Test';
  const dueText = remaining === 0 ? 'Due on next eligible prompt' : `Due in ${remaining} question${remaining === 1 ? '' : 's'}`;
  return `${stageText} · ${dueText}`;
}
