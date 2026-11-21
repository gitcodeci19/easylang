import {
  analyzeEnglishGrammarSkills,
  analyzeVoiceCoachRules,
  matchesGrammarSkill,
} from './grammarAnalyzer.ts';
import {
  REMEDIAL_SKILL_CATALOG,
  REMEDIAL_SKILL_ORDER,
  type RemedialSkillSpec,
} from './remedialCatalog.ts';
import {
  getRemedialQuestionAudioId,
  REMEDIAL_QUESTION_SCRIPTS,
} from './remedialQuestionScripts.ts';
import { isValidVoiceCoachRuleId } from './voiceCoachCatalog.ts';
import type {
  Card,
  ConceptTrackerState,
  DiagnosedWeakness,
  LessonExerciseKind,
  RemedialBriefing,
  RemedialBriefingExample,
  RemedialExercise,
  RemedialLessonPlan,
  RemedialMasteryRecord,
  ReviewEvent,
  RoadmapLessonRecord,
  UserCardProgress,
  VoiceCoachRuleId,
  WeakSkillId,
} from './types';

export interface AiDiagnosedOverlayItem {
  skillId: WeakSkillId;
  reason: string;
  severity?: 'critical' | 'focus' | 'polish';
  evidenceSample?: string;
}

export interface DiagnoseWeaknessesInput {
  cards: Card[];
  progressMap: Record<string, UserCardProgress>;
  reviewHistory: ReviewEvent[];
  roadmapHistory: RoadmapLessonRecord[];
  conceptState: ConceptTrackerState;
  remedialProgress?: Record<string, RemedialMasteryRecord>;
  aiExtraWeaknesses?: AiDiagnosedOverlayItem[];
  now?: number;
}

const DAY_MS = 86_400_000;

const VALID_SKILL_ID_SET = new Set<string>(REMEDIAL_SKILL_ORDER);

export function isValidWeakSkillId(value: string): value is WeakSkillId {
  return VALID_SKILL_ID_SET.has(value);
}

function normalizeSeed32(seed: number): number {
  let h = 2166136261 >>> 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number): () => number {
  let a = normalizeSeed32(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const arr = [...items];
  const rnd = seededRandom(seed);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function recencyWeight(timestamp: number, now: number): number {
  const ageDays = Math.max(0, (now - timestamp) / DAY_MS);
  if (ageDays <= 3) return 1.0;
  if (ageDays <= 14) return 0.85;
  if (ageDays <= 45) return 0.68;
  return 0.52;
}

function tokenizeSimple(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zçğıöşü0-9'\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function computeOrderMismatchScore(expected: string, actual: string): number {
  const expTokens = tokenizeSimple(expected);
  const actTokens = tokenizeSimple(actual);
  if (expTokens.length < 4 || actTokens.length < 4) return 0;

  const expSet = new Set(expTokens);
  let shared = 0;
  for (const t of actTokens) {
    if (expSet.has(t)) shared += 1;
  }
  const overlapRatio = shared / Math.max(expTokens.length, actTokens.length);
  if (overlapRatio < 0.6) return 0;

  let samePos = 0;
  const minLen = Math.min(expTokens.length, actTokens.length);
  for (let i = 0; i < minLen; i += 1) {
    if (expTokens[i] === actTokens[i]) samePos += 1;
  }
  const posRatio = samePos / Math.max(1, minLen);
  return posRatio < 0.6 ? 1 : 0;
}

interface ConfusionHit {
  skillId: WeakSkillId;
  bonus: number;
}

/**
 * Deep forensic inspection comparing the prompt, expected answer, and user's actual wrong answer
 * to detect specific grammar confusions (e.g. `was` vs `were`, `should` vs `have to`, word order,
 * passive voice misunderstood as active, dropped listening words, wrong prepositions).
 */
export function detectAnswerConfusionSkills(params: {
  en: string;
  expected?: string;
  userAnswer?: string;
  kind?: LessonExerciseKind;
}): ConfusionHit[] {
  const hits: ConfusionHit[] = [];
  const en = params.en.trim();
  const expected = (params.expected ?? '').trim();
  const userAns = (params.userAnswer ?? '').trim();
  const lowEn = en.toLowerCase();
  const lowExp = expected.toLowerCase();
  const lowUser = userAns.toLowerCase();

  // 1. Direct was <-> were swap
  const hasWasInTarget = /\b(?:was|wasn't)\b/i.test(en) || /\b(?:was|wasn't)\b/i.test(expected);
  const hasWereInTarget = /\b(?:were|weren't)\b/i.test(en) || /\b(?:were|weren't)\b/i.test(expected);
  const userHasWas = /\b(?:was|wasn't)\b/i.test(userAns);
  const userHasWere = /\b(?:were|weren't)\b/i.test(userAns);
  if ((hasWereInTarget && userHasWas && !userHasWere) || (hasWasInTarget && userHasWere && !userHasWas)) {
    hits.push({ skillId: 'was_vs_were', bonus: 32 });
  }

  // 2. Direct should <-> have to / must confusion (English or Turkish nuance)
  const targetHasShould = /\b(?:should|shouldn't|ought\s+to)\b/i.test(en) || /\b(?:should|shouldn't)\b/i.test(expected);
  const targetHasHaveTo = /\b(?:have|has|had|don't\s+have|doesn't\s+have)\s+to\b/i.test(en) || /\b(?:have|has|had)\s+to\b/i.test(expected);
  const userHasShould = /\b(?:should|shouldn't)\b/i.test(userAns);
  const userHasHaveTo = /\b(?:have|has|had|must)\s*to?\b/i.test(userAns);
  const userHasTrObligation = /\bzorunda|mecbur/i.test(lowUser);
  const userHasTrAdvice = /\bgerekir|tavsiye|meli\b|malı\b/i.test(lowUser);
  const isEnglishUserAttempt = params.kind === 'word_bank' || params.kind === 'audio_dictation' || (expected === en && userAns.length > 0 && !/[çğıöşü]/i.test(userAns));
  const userMatchedTargetModal =
    isEnglishUserAttempt &&
    ((targetHasShould && userHasShould) || (targetHasHaveTo && userHasHaveTo));
  if (
    (targetHasShould && (userHasHaveTo || userHasTrObligation)) ||
    (targetHasHaveTo && (userHasShould || (userHasTrAdvice && !userHasTrObligation)))
  ) {
    hits.push({ skillId: 'should_vs_have_to', bonus: 32 });
  } else if ((targetHasShould || targetHasHaveTo) && !userMatchedTargetModal) {
    hits.push({ skillId: 'should_vs_have_to', bonus: 14 });
  }

  // 3. Passive voice (be + V3) confusion
  if (matchesGrammarSkill('passive_voice', en)) {
    // Check if passive English sentence missed passive Turkish suffix (-ıldı/-ildi/-ulur/-ilir/-edildi)
    const missingTrPassive =
      lowUser.length > 0 &&
      !/[ıiuü]l(?:d[ıiuü]|m[ıiuü]|ur|ir|ıyor|iyor|acak|ecek)|edild/i.test(lowUser) &&
      /[ıiuü]l(?:d[ıiuü]|ur|ir)|edild/i.test(lowExp);
    hits.push({ skillId: 'passive_voice', bonus: missingTrPassive ? 26 : 14 });
  }

  // 4. Word-order syntax error (true scrambled word order, not a single distractor swap in right order)
  if (params.kind === 'word_bank') {
    const scrambled = computeOrderMismatchScore(expected || en, userAns);
    if (scrambled) {
      hits.push({ skillId: 'word_order_syntax', bonus: 28 });
    } else if (!userAns || userAns === '(skipped)') {
      hits.push({ skillId: 'word_order_syntax', bonus: 12 });
    }
  } else if (userAns && computeOrderMismatchScore(expected || en, userAns)) {
    hits.push({ skillId: 'word_order_syntax', bonus: 22 });
  }

  // 5. Listening gap (audio_dictation errors, especially omitted words)
  if (params.kind === 'audio_dictation') {
    const expWords = tokenizeSimple(expected || en);
    const actWords = tokenizeSimple(userAns);
    const omittedWords = userAns !== '(skipped)' && actWords.length > 0 && actWords.length < expWords.length;
    hits.push({ skillId: 'listening_gap', bonus: omittedWords ? 26 : 18 });
  }

  // 5B. Omitted Present Perfect auxiliary (e.g. "My dog missing" vs "My dog has been missing")
  if (
    matchesGrammarSkill('present_perfect', en) &&
    isEnglishUserAttempt &&
    userAns.length > 0 &&
    !matchesGrammarSkill('present_perfect', userAns)
  ) {
    hits.push({ skillId: 'present_perfect', bonus: 24 });
  }

  // 6. going to <-> will swap
  if (
    (/\bgoing\s+to\b/i.test(lowEn + ' ' + lowExp) && /\bwill\b/i.test(lowUser)) ||
    (/\bwill\b/i.test(lowEn + ' ' + lowExp) && /\bgoing\s+to\b/i.test(lowUser))
  ) {
    hits.push({ skillId: 'going_to_vs_will', bonus: 26 });
  }

  // 7. Preposition swap (in/on/at/for/since)
  const targetPrep = /\b(in|on|at|for|since)\b/i.exec(lowExp || lowEn)?.[1];
  const userPrep = /\b(in|on|at|for|since)\b/i.exec(lowUser)?.[1];
  if (targetPrep && userPrep && targetPrep !== userPrep) {
    hits.push({ skillId: 'prepositions_core', bonus: 22 });
  }

  // 8. Negation double-past / 3rd-person error (didn't went / doesn't likes)
  if (/\b(?:didn't|did\s+not)\s+[a-z]+(?:ed|went|saw|came|took|made|ate|gave)\b/i.test(userAns) ||
      /\b(?:doesn't|does\s+not)\s+[a-z]{3,}s\b/i.test(userAns)) {
    hits.push({ skillId: 'negation_questions', bonus: 26 });
  }

  // 9. Infinitive vs Gerund swap (enjoy to X / decide Xing)
  if (
    (/\bto\s+[a-z]{2,}\b/i.test(lowExp) && /\b[a-z]{3,}ing\b/i.test(lowUser)) ||
    (/\b[a-z]{3,}ing\b/i.test(lowExp) && /\bto\s+[a-z]{2,}\b/i.test(lowUser))
  ) {
    hits.push({ skillId: 'infinitive_gerund', bonus: 22 });
  }

  return hits;
}

interface SkillAccumulator {
  score: number;
  errorCount: number;
  newestErrorAt: number;
  evidence: DiagnosedWeakness['evidenceExamples'];
  evidenceKeys: Set<string>;
  relatedConceptIds: Set<string>;
  relatedCardIds: Set<string>;
  aiReason?: string;
}

function createAccumulator(): SkillAccumulator {
  return {
    score: 0,
    errorCount: 0,
    newestErrorAt: 0,
    evidence: [],
    evidenceKeys: new Set(),
    relatedConceptIds: new Set(),
    relatedCardIds: new Set(),
  };
}

function pushEvidence(
  acc: SkillAccumulator,
  item: DiagnosedWeakness['evidenceExamples'][number]
): void {
  const key = `${item.en.trim().toLowerCase()}|${item.source}`;
  if (acc.evidenceKeys.has(key)) return;
  acc.evidenceKeys.add(key);
  if (acc.evidence.length < 6) {
    acc.evidence.push(item);
  }
}

export function matchGrammarSkillsForEnglish(en: string): WeakSkillId[] {
  return analyzeEnglishGrammarSkills(en);
}

const GENERIC_FALLBACK_HELP_SKILLS = new Set<VoiceCoachRuleId>([
  'word_order_syntax',
  'trouble_vocab',
  'listening_gap',
]);

/**
 * Returns true when a prompt/card contains 2+ substantive grammar/usage voice guides
 * (excluding generic fallbacks like word order, vocab, or listening), so "Bana Öğret"
 * only glows on grammar-rich sentences rather than on every routine prompt.
 */
export function hasRichTeachMeSkills(detectedSkills: readonly VoiceCoachRuleId[]): boolean {
  let substantiveCount = 0;
  for (const sid of detectedSkills) {
    if (!GENERIC_FALLBACK_HELP_SKILLS.has(sid)) {
      substantiveCount += 1;
    }
  }
  return substantiveCount >= 2;
}

/**
 * Detect relevant grammar & coaching rules (across all 35 voice-coach guides) inside a prompt/card
 * for on-demand "Teach Me" (`🎧 Bana Öğret`) audio & written help.
 */
export function detectHelpSkillsForQuestion(params: {
  englishText: string;
  cardType?: 'word' | 'sentence';
  exerciseKind?: string;
  primarySkillId?: VoiceCoachRuleId;
}): VoiceCoachRuleId[] {
  const detected = new Set<VoiceCoachRuleId>();
  if (params.primarySkillId && isValidVoiceCoachRuleId(params.primarySkillId)) {
    detected.add(params.primarySkillId);
  }

  const en = (params.englishText || '').trim();
  const wordCount = en ? en.split(/\s+/).filter(Boolean).length : 0;

  if (en && (params.cardType !== 'word' || wordCount >= 3)) {
    for (const rid of analyzeVoiceCoachRules(en)) {
      detected.add(rid);
    }
  }

  if (params.exerciseKind === 'audio_dictation') {
    detected.add('listening_gap');
  }

  const hasWordOrderCue = en ? matchesGrammarSkill('word_order_syntax', en) : false;
  if (
    params.exerciseKind === 'word_bank' ||
    hasWordOrderCue ||
    (detected.size === 0 && ((params.cardType === 'sentence' && wordCount >= 4) || wordCount >= 5))
  ) {
    detected.add('word_order_syntax');
  }

  if ((params.cardType === 'word' && wordCount < 3) || detected.size === 0) {
    detected.add('trouble_vocab');
  }

  return Array.from(detected).slice(0, 3);
}

function matchSkillsForConcept(
  conceptId: string,
  focusToken: string,
  label: string,
  sourceEn: string
): WeakSkillId[] {
  const combined = `${conceptId} ${focusToken} ${label}`;
  const matched = new Set<WeakSkillId>();

  for (const skillId of REMEDIAL_SKILL_ORDER) {
    if (skillId === 'trouble_vocab') continue;
    const spec = REMEDIAL_SKILL_CATALOG[skillId];
    if (spec.conceptPattern.test(combined)) {
      matched.add(skillId);
    }
  }

  if (matched.size === 0 && sourceEn) {
    for (const sid of matchGrammarSkillsForEnglish(sourceEn)) {
      matched.add(sid);
    }
  }

  if (matched.size === 0) {
    matched.add('trouble_vocab');
  }

  return Array.from(matched);
}

/**
 * Multi-signal weakness diagnostic engine inspecting ALL 4 persisted user history stores
 * (`roadmapHistory`, `reviewHistory`, `progressMap`, `conceptState`) plus optional AI deep-scan
 * overlays, ranked by severity and cooled down gently after successful remedial completion.
 */
export const REMEDIAL_MASTERY_ACCURACY_THRESHOLD = 80;

function collectSkillAccumulators(input: DiagnoseWeaknessesInput): Map<WeakSkillId, SkillAccumulator> {
  const now = input.now ?? Date.now();
  const cardsById = new Map<string, Card>();
  for (const card of input.cards) {
    cardsById.set(card.id, card);
  }

  const accMap = new Map<WeakSkillId, SkillAccumulator>();
  const getAcc = (skillId: WeakSkillId): SkillAccumulator => {
    let acc = accMap.get(skillId);
    if (!acc) {
      acc = createAccumulator();
      accMap.set(skillId, acc);
    }
    return acc;
  };

  // ==================== SIGNAL 1: ROADMAP LESSON HISTORY ====================
  let wordBankCorrect = 0;
  let wordBankWrong = 0;
  let newestWbWrongAt = 0;
  let audioCorrect = 0;
  let audioWrong = 0;
  let newestAudioWrongAt = 0;

  for (const rec of input.roadmapHistory) {
    const rw = recencyWeight(rec.completedAt, now);

    if (rec.byKind?.word_bank) {
      wordBankCorrect += rec.byKind.word_bank.correct;
      wordBankWrong += rec.byKind.word_bank.wrong;
      if (rec.byKind.word_bank.wrong > 0) {
        newestWbWrongAt = Math.max(newestWbWrongAt, rec.completedAt);
      }
    }
    if (rec.byKind?.audio_dictation) {
      audioCorrect += rec.byKind.audio_dictation.correct;
      audioWrong += rec.byKind.audio_dictation.wrong;
      if (rec.byKind.audio_dictation.wrong > 0) {
        newestAudioWrongAt = Math.max(newestAudioWrongAt, rec.completedAt);
      }
    }

    for (const m of rec.mistakes) {
      const card = cardsById.get(m.cardId);
      const enText = m.en || card?.en || '';
      const repeatMult = m.repeatedWrong ? 1.45 : 1.0;
      const basePts = Math.min(24, 9 + (m.wrongCount - 1) * 5) * repeatMult * rw;

      // 1A. Deep answer-diff confusion detection
      const confusions = detectAnswerConfusionSkills({
        en: enText,
        expected: m.expected,
        userAnswer: m.lastUserAnswer,
        kind: m.kind,
      });
      const boostedSet = new Set<WeakSkillId>();
      for (const hit of confusions) {
        const acc = getAcc(hit.skillId);
        acc.score += hit.bonus * repeatMult * rw;
        acc.errorCount += m.wrongCount;
        acc.newestErrorAt = Math.max(acc.newestErrorAt, rec.completedAt);
        if (m.cardId) acc.relatedCardIds.add(m.cardId);
        pushEvidence(acc, {
          en: enText,
          userAnswer: m.lastUserAnswer,
          expected: m.expected,
          source: 'roadmap',
        });
        boostedSet.add(hit.skillId);
      }

      // 1B. Grammar regex matches on the sentence (skip if user answered in English and got that exact pattern right!)
      const isEnglishAttempt = m.direction === 'tr-to-en' || m.direction === 'en-audio';
      const grammarHits = matchGrammarSkillsForEnglish(enText);
      for (const sid of grammarHits) {
        if (boostedSet.has(sid)) continue;
        const spec = REMEDIAL_SKILL_CATALOG[sid];
        if (
          isEnglishAttempt &&
          m.lastUserAnswer &&
          m.lastUserAnswer !== '(skipped)' &&
          matchesGrammarSkill(sid, m.lastUserAnswer)
        ) {
          // User reproduced this exact grammar structure cleanly; the mistake was elsewhere in the sentence.
          continue;
        }
        const acc = getAcc(sid);
        acc.score += basePts;
        acc.errorCount += m.wrongCount;
        acc.newestErrorAt = Math.max(acc.newestErrorAt, rec.completedAt);
        if (m.cardId) acc.relatedCardIds.add(m.cardId);
        pushEvidence(acc, {
          en: enText,
          userAnswer: m.lastUserAnswer,
          expected: m.expected,
          source: 'roadmap',
        });
      }

      // 1C. Single-word / vocabulary misses feed trouble_vocab
      const isSingleWord = card?.type === 'word' || tokenizeSimple(enText).length <= 2;
      if (isSingleWord && m.kind !== 'audio_dictation') {
        const acc = getAcc('trouble_vocab');
        acc.score += basePts * 0.9;
        acc.errorCount += m.wrongCount;
        acc.newestErrorAt = Math.max(acc.newestErrorAt, rec.completedAt);
        if (m.cardId) acc.relatedCardIds.add(m.cardId);
        pushEvidence(acc, {
          en: enText,
          userAnswer: m.lastUserAnswer,
          expected: m.expected,
          source: 'roadmap',
        });
      }
    }
  }

  // Aggregate exercise-kind accuracy signals (word_bank & audio_dictation)
  const wbTotal = wordBankCorrect + wordBankWrong;
  if (wbTotal >= 3 && wordBankWrong >= 2 && wordBankCorrect / wbTotal < 0.78) {
    const acc = getAcc('word_order_syntax');
    acc.score += Math.round((1 - wordBankCorrect / wbTotal) * 35);
    acc.newestErrorAt = Math.max(acc.newestErrorAt, newestWbWrongAt);
  }
  const audTotal = audioCorrect + audioWrong;
  if (audTotal >= 2 && audioWrong >= 1 && audioCorrect / audTotal < 0.8) {
    const acc = getAcc('listening_gap');
    acc.score += Math.round((1 - audioCorrect / audTotal) * 35);
    acc.newestErrorAt = Math.max(acc.newestErrorAt, newestAudioWrongAt);
  }

  // ==================== SIGNAL 2: REVIEW HISTORY (POPUP RECALL + HESITATION) ====================
  for (const ev of input.reviewHistory) {
    const card = cardsById.get(ev.cardId);
    if (!card) continue;
    const rw = recencyWeight(ev.timestamp, now);

    if (!ev.isCorrect) {
      const grammarHits = matchGrammarSkillsForEnglish(card.en);
      for (const sid of grammarHits) {
        const acc = getAcc(sid);
        acc.score += 11 * rw;
        acc.errorCount += 1;
        acc.newestErrorAt = Math.max(acc.newestErrorAt, ev.timestamp);
        acc.relatedCardIds.add(card.id);
        pushEvidence(acc, {
          en: card.en,
          expected: card.acceptedTr[0],
          source: 'recall',
        });
      }

      if (card.type === 'word') {
        const acc = getAcc('trouble_vocab');
        acc.score += 9 * rw;
        acc.errorCount += 1;
        acc.newestErrorAt = Math.max(acc.newestErrorAt, ev.timestamp);
        acc.relatedCardIds.add(card.id);
        pushEvidence(acc, {
          en: card.en,
          expected: card.acceptedTr[0],
          source: 'recall',
        });
      }
    } else if (ev.responseMs >= 11_000) {
      // Subtle hesitation signal: user answered correctly but struggled >= 11 seconds
      const grammarHits = matchGrammarSkillsForEnglish(card.en);
      for (const sid of grammarHits) {
        const acc = getAcc(sid);
        acc.score += 2.5 * rw;
        acc.relatedCardIds.add(card.id);
      }
    }
  }

  // ==================== SIGNAL 3: PROGRESS MAP (CHRONIC WRONG / RETRY CARDS) ====================
  for (const prog of Object.values(input.progressMap)) {
    if (prog.totalWrong <= 0) continue;
    const card = cardsById.get(prog.cardId);
    if (!card) continue;

    // If user already recovered strong mastery (streak >= 4 and no retry), soften weight
    const activeFactor = prog.retryAt !== null ? 1.35 : prog.streak === 0 ? 1.1 : prog.streak >= 4 ? 0.35 : 0.7;
    const pts = Math.min(20, prog.totalWrong * 6) * activeFactor;
    // Only treat lastReviewedAt as a fresh error timestamp if the card is still in a failed/retry state.
    // A later CORRECT review updates lastReviewedAt too and must never resurrect a graduated workshop.
    const isCurrentlyFailed = prog.retryAt !== null || prog.streak === 0;
    const errorTs = isCurrentlyFailed ? prog.lastReviewedAt ?? 0 : 0;

    const grammarHits = matchGrammarSkillsForEnglish(card.en);
    for (const sid of grammarHits) {
      const acc = getAcc(sid);
      acc.score += pts * 0.7;
      if (acc.errorCount === 0) acc.errorCount += prog.totalWrong;
      if (errorTs > 0) acc.newestErrorAt = Math.max(acc.newestErrorAt, errorTs);
      acc.relatedCardIds.add(card.id);
      pushEvidence(acc, {
        en: card.en,
        expected: card.acceptedTr[0],
        source: 'progress',
      });
    }

    if (card.type === 'word' && (prog.totalWrong >= 2 || prog.retryAt !== null || prog.streak === 0)) {
      const acc = getAcc('trouble_vocab');
      acc.score += pts * 0.85;
      if (acc.errorCount === 0) acc.errorCount += prog.totalWrong;
      if (errorTs > 0) acc.newestErrorAt = Math.max(acc.newestErrorAt, errorTs);
      acc.relatedCardIds.add(card.id);
      pushEvidence(acc, {
        en: card.en,
        expected: card.acceptedTr[0],
        source: 'progress',
      });
    }
  }

  // ==================== SIGNAL 4: CONCEPT TRACKER (AI & USER-FLAGGED GAPS) ====================
  for (const note of input.conceptState.notes) {
    if (note.stage >= 3 || note.masteredAt !== null) continue;
    const stagePts = note.stage === 0 ? 22 : note.stage === 1 ? 15 : 10;
    // Stage 0 means newly captured or failed back to stage 0; higher stages only advance on CORRECT checks.
    const noteErrorTs = note.stage === 0 ? note.lastPracticedAt || note.createdAt : note.createdAt;
    const skills = matchSkillsForConcept(note.id, note.focusToken, note.label, note.sourceEn);
    for (const sid of skills) {
      const acc = getAcc(sid);
      acc.score += stagePts;
      acc.errorCount += Math.max(1, note.wrongCount);
      acc.newestErrorAt = Math.max(acc.newestErrorAt, noteErrorTs);
      acc.relatedConceptIds.add(note.id);
      if (note.sourceCardId) acc.relatedCardIds.add(note.sourceCardId);
      pushEvidence(acc, {
        en: note.sourceEn || note.focusToken,
        expected: note.label,
        source: 'concept',
      });
    }
  }

  // ==================== SIGNAL 5: OPTIONAL AI DEEP DIAGNOSIS OVERLAY ====================
  // Note: AI deep scan analyzes past logs and is NOT a new error committed at `now`;
  // never overwrite `newestErrorAt` with `now`, otherwise mastered skills could never graduate.
  if (input.aiExtraWeaknesses && input.aiExtraWeaknesses.length > 0) {
    for (const item of input.aiExtraWeaknesses) {
      if (!isValidWeakSkillId(item.skillId)) continue;
      const acc = getAcc(item.skillId);
      const aiBonus = item.severity === 'critical' ? 32 : item.severity === 'focus' ? 22 : 12;
      acc.score += aiBonus;
      acc.errorCount = Math.max(1, acc.errorCount);
      if (item.reason.trim()) {
        acc.aiReason = item.reason.trim();
      }
      if (item.evidenceSample?.trim()) {
        pushEvidence(acc, {
          en: item.evidenceSample.trim(),
          source: 'ai',
        });
      }
    }
  }

  return accMap;
}

function isSkillResolvedByMastery(
  mastery: RemedialMasteryRecord | undefined,
  newestErrorAt: number
): boolean {
  if (!mastery) return false;
  return (
    mastery.lastAccuracyPct >= REMEDIAL_MASTERY_ACCURACY_THRESHOLD &&
    mastery.lastCompletedAt >= newestErrorAt
  );
}

/**
 * Return all remedial skill IDs that the learner has already passed (>=80% accuracy)
 * with no newer mistakes since completion, so AI Deep Scan never re-suggests solved topics.
 */
export function getResolvedRemedialSkillIds(input: DiagnoseWeaknessesInput): WeakSkillId[] {
  const progress = input.remedialProgress;
  if (!progress) return [];
  const accMap = collectSkillAccumulators({ ...input, aiExtraWeaknesses: [] });
  const resolved: WeakSkillId[] = [];
  for (const [skillId, mastery] of Object.entries(progress)) {
    if (!isValidWeakSkillId(skillId)) continue;
    const acc = accMap.get(skillId);
    const newestErrorAt = acc?.newestErrorAt ?? 0;
    if (isSkillResolvedByMastery(mastery, newestErrorAt)) {
      resolved.push(skillId);
    }
  }
  return resolved;
}

/**
 * Multi-signal weakness diagnostic engine inspecting ALL 4 persisted user history stores
 * (`roadmapHistory`, `reviewHistory`, `progressMap`, `conceptState`) plus optional AI deep-scan
 * overlays. Workshops passed at >=80% accuracy automatically graduate out of the active list
 * until a genuinely new mistake in that skill occurs.
 */
export function diagnoseUserWeaknesses(input: DiagnoseWeaknessesInput): DiagnosedWeakness[] {
  const accMap = collectSkillAccumulators(input);

  // ==================== BUILD RANKED DIAGNOSIS LIST ====================
  const results: DiagnosedWeakness[] = [];
  for (const [skillId, acc] of accMap.entries()) {
    if (acc.score < 9) continue;
    const spec = REMEDIAL_SKILL_CATALOG[skillId];
    if (!spec) continue;

    const mastery = input.remedialProgress?.[skillId];
    if (isSkillResolvedByMastery(mastery, acc.newestErrorAt)) {
      // Graduated: user passed this workshop with >=80% accuracy and made no new mistakes since.
      continue;
    }

    const finalScore = Math.round(acc.score);
    const lastMasteredAt =
      mastery && mastery.bestAccuracyPct >= REMEDIAL_MASTERY_ACCURACY_THRESHOLD
        ? mastery.lastCompletedAt
        : undefined;

    const severity: DiagnosedWeakness['severity'] =
      finalScore >= 38 ? 'critical' : finalScore >= 18 ? 'focus' : 'polish';

    results.push({
      skillId,
      titleTr: spec.titleTr,
      titleEn: spec.titleEn,
      subtitleTr: spec.subtitleTr,
      subtitleEn: spec.subtitleEn,
      severity,
      score: finalScore,
      errorCount: Math.max(1, acc.errorCount),
      evidenceExamples: acc.evidence.slice(0, 4),
      relatedConceptIds: Array.from(acc.relatedConceptIds),
      relatedCardIds: Array.from(acc.relatedCardIds).slice(0, 12),
      aiReason: acc.aiReason,
      lastMasteredAt,
    });
  }

  results.sort((a, b) => {
    const sevRank = (s: DiagnosedWeakness['severity']) => (s === 'critical' ? 3 : s === 'focus' ? 2 : 1);
    const diff = sevRank(b.severity) - sevRank(a.severity);
    if (diff !== 0) return diff;
    if (b.score !== a.score) return b.score - a.score;
    return b.errorCount - a.errorCount;
  });

  return results;
}

export function getAllRemedialCatalogItems(): RemedialSkillSpec[] {
  return REMEDIAL_SKILL_ORDER.map((id) => REMEDIAL_SKILL_CATALOG[id]);
}

function makeSyntheticCard(id: string, en: string, tr: string): Card {
  return {
    id,
    type: 'sentence',
    level: 'B1',
    pos: 'sentence',
    en,
    phonetic: '',
    acceptedTr: [tr],
    exampleEn: '',
    exampleTr: '',
    source: 'builtin',
  };
}

/**
 * Strip only outer sentence punctuation from a whitespace-delimited token
 * so internal punctuation inside times (9:00, 7:30), decimals (1.5x, $19.99),
 * thousands separators (1,000), scores/fractions (2-2, 3/4), percentages (50%),
 * contractions (didn't), dotted abbreviations (a.m., p.m., U.S.), and
 * mid-sentence Turkish ordinals (17. yüzyılda) stays intact.
 */
function cleanBankToken(rawToken: string, nextRawToken?: string): string {
  let token = rawToken.trim();
  if (!token) return '';
  token = token.replace(/^[.,!?;:"'“”‘’()[\]{}]+/, '');
  if (/^(?:[a-zA-Z]\.){2,}[,!?;:"'“”‘’()[\]{}]*$/.test(token)) {
    token = token.replace(/[,!?;:"'“”‘’()[\]{}]+$/, '');
  } else if (
    /^\d+\.$/.test(token) &&
    nextRawToken &&
    /^[a-zçğıöşü]/.test(nextRawToken.trim())
  ) {
    // Preserve mid-sentence Turkish ordinal dot (e.g. "17. yüzyılda")
  } else {
    token = token.replace(/[.,!?;:"'“”‘’()[\]{}]+$/, '');
  }
  return token.trim();
}

export function tokenizeSentenceForBank(sentence: string): string[] {
  const rawTokens = sentence.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < rawTokens.length; i += 1) {
    const cleaned = cleanBankToken(rawTokens[i]!, rawTokens[i + 1]);
    if (cleaned) out.push(cleaned);
  }
  return out;
}

function pickSkillSentenceCards(
  skillId: WeakSkillId,
  weakness: DiagnosedWeakness | null,
  allCards: Card[],
  progressMap: Record<string, UserCardProgress>,
  seed: number
): Card[] {
  const spec = REMEDIAL_SKILL_CATALOG[skillId];
  const cardsById = new Map<string, Card>();
  for (const c of allCards) cardsById.set(c.id, c);

  const picked: Card[] = [];
  const seen = new Set<string>();

  // 1. Prioritize user's real missed/related sentence cards first
  if (weakness) {
    for (const cid of weakness.relatedCardIds) {
      const c = cardsById.get(cid);
      if (!c || seen.has(c.id)) continue;
      if (skillId === 'trouble_vocab' ? c.type === 'word' : c.type === 'sentence') {
        seen.add(c.id);
        picked.push(c);
      }
    }
  }

  // 2. For trouble_vocab, add user's highest-error word cards
  if (skillId === 'trouble_vocab') {
    const wrongWords = allCards
      .filter((c) => c.type === 'word' && !seen.has(c.id) && (progressMap[c.id]?.totalWrong ?? 0) > 0)
      .sort((a, b) => (progressMap[b.id]?.totalWrong ?? 0) - (progressMap[a.id]?.totalWrong ?? 0));
    for (const c of wrongWords.slice(0, 6)) {
      seen.add(c.id);
      picked.push(c);
    }
    return picked;
  }

  // 3. Modern sentences (`m_*`) matching the target grammar skill get top priority for fun relevance!
  const matchingModern = allCards.filter(
    (c) =>
      c.type === 'sentence' &&
      c.id.startsWith('m_') &&
      !seen.has(c.id) &&
      matchesGrammarSkill(skillId, c.en) &&
      spec.sentencePattern.test(c.en) &&
      tokenizeSentenceForBank(c.en).length >= 4 &&
      tokenizeSentenceForBank(c.en).length <= 10
  );
  for (const c of shuffleWithSeed(matchingModern, seed + 17).slice(0, 4)) {
    seen.add(c.id);
    picked.push(c);
  }

  // 4. General built-in sentences matching the pattern
  if (picked.length < 5) {
    const matchingGeneral = allCards.filter(
      (c) =>
        c.type === 'sentence' &&
        !seen.has(c.id) &&
        matchesGrammarSkill(skillId, c.en) &&
        spec.sentencePattern.test(c.en) &&
        tokenizeSentenceForBank(c.en).length >= 4 &&
        tokenizeSentenceForBank(c.en).length <= 10
    );
    for (const c of shuffleWithSeed(matchingGeneral, seed + 31).slice(0, 5 - picked.length)) {
      seen.add(c.id);
      picked.push(c);
    }
  }

  return picked;
}

function foldTurkishKey(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mutually interchangeable grammar forms that must never co-occur as cloze distractors. */
const INTERCHANGEABLE_GRAMMAR_GROUPS: readonly string[][] = [
  ['may', 'might', 'could'],
  ['although', 'though', 'even though'],
  ['have to', 'must', 'need to'],
  ['has to', 'must', 'needs to'],
  ['until', 'till'],
];

function areGrammaticallyInterchangeable(a: string, b: string): boolean {
  const la = a.trim().toLowerCase();
  const lb = b.trim().toLowerCase();
  if (la === lb) return true;
  for (const grp of INTERCHANGEABLE_GRAMMAR_GROUPS) {
    if (grp.includes(la) && grp.includes(lb)) return true;
  }
  return false;
}

function buildDynamicClozeExercise(
  skillId: WeakSkillId,
  card: Card,
  allCards: Card[],
  seed: number
): RemedialExercise | null {
  const spec = REMEDIAL_SKILL_CATALOG[skillId];
  const match = spec.sentencePattern.exec(card.en);
  if (!match || !match[0]) return null;
  const target = match[0].trim();
  if (target.length < 2 || target.length > 22) return null;

  const esc = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordBoundaryRe = new RegExp(`(?<![A-Za-z0-9-])${esc}(?![A-Za-z0-9-])`);
  if (!wordBoundaryRe.test(card.en)) return null;
  const blanked = card.en.replace(wordBoundaryRe, '_____');
  if (blanked === card.en || !blanked.includes('_____')) return null;

  // Distractors chosen to be strictly distinct (never mutually interchangeable with target)
  const distractorPoolBySkill: Partial<Record<WeakSkillId, string[]>> = {
    was_vs_were: ['was', 'were', 'is', 'are', 'been'],
    should_vs_have_to: ['should', 'have to', 'has to', "don't have to", 'having to'],
    used_to_habit: ['used to', 'use to', 'using to', 'was used'],
    past_continuous: ['was going', 'were going', 'did', 'had'],
    present_perfect: ['have been', 'has been', 'did', 'was'],
    passive_voice: ['was', 'were', 'is', 'are', 'did'],
    going_to_vs_will: ['going to', 'will', 'was', 'did', 'go to'],
    conditionals_would: ['would', 'will', 'were', 'am'],
    contrast_linkers: ['although', 'despite', 'unless', 'because'],
    time_clauses: ['until', 'as soon as', 'during', 'despite'],
    phrasal_verbs: ['give up', 'figure out', 'get off', 'put off', 'take away'],
    prepositions_core: ['in', 'on', 'at', 'for', 'since'],
    modal_possibility: ['may', 'might', 'could', "can't", 'did', 'was'],
    infinitive_gerund: ['to play', 'playing', 'to go', 'going'],
    negation_questions: ["didn't", "doesn't", "don't", "wasn't"],
  };

  const baseDistractors = (distractorPoolBySkill[skillId] ?? ['was', 'were', 'should', 'have to']).filter(
    (d) => !areGrammaticallyInterchangeable(d, target)
  );

  // Pull extra word distractors from deck if needed
  const fallbackWords = shuffleWithSeed(
    allCards.filter((c) => c.type === 'word' && c.en.toLowerCase() !== target.toLowerCase()).slice(0, 40),
    seed + 41
  ).map((c) => c.en);

  const chosenDistractors: string[] = [];
  const seen = new Set<string>([target.toLowerCase()]);
  for (const cand of [...shuffleWithSeed(baseDistractors, seed + 53), ...fallbackWords]) {
    const low = cand.toLowerCase();
    if (seen.has(low) || areGrammaticallyInterchangeable(cand, target)) continue;
    if (chosenDistractors.some((d) => areGrammaticallyInterchangeable(d, cand))) continue;
    seen.add(low);
    chosenDistractors.push(cand);
    if (chosenDistractors.length >= 3) break;
  }

  const choices = shuffleWithSeed([target, ...chosenDistractors], seed + 61);
  return {
    id: `rem_cloze_${skillId}_${card.id}`,
    kind: 'cloze_blank',
    card,
    promptText: blanked,
    promptSubtext: card.acceptedTr[0] ?? '',
    postAnswerSubtext: card.acceptedTr[0],
    explanationTr: `Doğru kalıp "${target}" — cümlenin tamamı: "${card.en}"`,
    explanationEn: `Correct target "${target}" — full sentence: "${card.en}"`,
    audioText: card.en,
    choices,
    correctChoice: target,
    expectedAnswers: [target],
    direction: 'en-to-tr',
  };
}

function buildDynamicWordBankExercise(
  skillId: WeakSkillId,
  card: Card,
  allCards: Card[],
  seed: number
): RemedialExercise | null {
  const targetTokens = tokenizeSentenceForBank(card.en);
  if (targetTokens.length < 4 || targetTokens.length > 10) return null;

  const targetLower = new Set(targetTokens.map((t) => t.toLowerCase()));
  const distractorPool = shuffleWithSeed(
    ['was', 'were', 'should', 'have', 'to', 'never', 'always', 'did', 'will', 'been', ...allCards.filter((c) => c.type === 'word').slice(0, 15).map((c) => c.en)],
    seed + 79
  ).filter((w) => !targetLower.has(w.toLowerCase()) && !w.includes(' '));

  const extras = distractorPool.slice(0, 2);
  const wordBankTiles = shuffleWithSeed([...targetTokens, ...extras], seed + 83);

  return {
    id: `rem_wb_${skillId}_${card.id}`,
    kind: 'word_bank',
    card,
    promptText: card.acceptedTr[0] ?? card.en,
    promptSubtext: `${card.level} · Kelimeleri sıraya diz`,
    postAnswerSubtext: card.acceptedTr[0],
    explanationTr: `Doğal İngilizce dizilim: "${card.en}"`,
    explanationEn: `Natural English order: "${card.en}"`,
    audioText: card.en,
    wordBankTiles,
    targetTokens,
    expectedAnswers: [card.en],
    direction: 'tr-to-en',
  };
}

/**
 * Build a complete, engaging 7-8 exercise Remedial Lesson Plan for any WeakSkillId:
 * Stage 0 interactive briefing + Contrast Duels + Spot-the-Bug Detective +
 * Real-Life Scenario + Dynamic Cloze + Word Bank + Free Translation Boss Challenge.
 */
export function buildRemedialLessonPlan(
  skillId: WeakSkillId,
  weakness: DiagnosedWeakness | null,
  allCards: Card[],
  progressMap: Record<string, UserCardProgress>,
  seed: number = Date.now()
): RemedialLessonPlan {
  const spec = REMEDIAL_SKILL_CATALOG[skillId];
  const matchedCards = pickSkillSentenceCards(skillId, weakness, allCards, progressMap, seed);

  // Clone briefing and enrich trouble_vocab examples with the user's real missed words
  let briefing: RemedialBriefing = {
    ...spec.briefing,
    examples: [...spec.briefing.examples],
  };

  if (skillId === 'trouble_vocab' && matchedCards.length > 0) {
    const personalExamples: RemedialBriefingExample[] = matchedCards.slice(0, 4).map((c) => ({
      en: c.exampleEn || c.en,
      tr: c.exampleTr || c.acceptedTr.slice(0, 2).join(', '),
      highlight: c.en,
    }));
    briefing = {
      ...briefing,
      examples: personalExamples,
    };
  }

  // 1. Pre-authored ElevenLabs-voiced Contrast Duels (up to 2, preserving stable template index)
  const indexedDuels = spec.duels.map((template, origIdx) => ({ template, origIdx }));
  const selectedDuels = shuffleWithSeed(indexedDuels, seed + 11).slice(0, 2);
  const duelExercises: RemedialExercise[] = selectedDuels.map(({ template: d, origIdx }, i) => {
    const audioId = getRemedialQuestionAudioId(skillId, 'duel', origIdx + 1);
    const shuffledChoices = shuffleWithSeed(d.choices, seed + 100 + i);
    return {
      id: `rem_duel_${audioId}`,
      kind: 'contrast_duel',
      card: makeSyntheticCard(`rem_c_duel_${audioId}`, d.fullSentence, d.meaningTr),
      promptText: d.promptSentence,
      promptSubtext: d.promptSubtextTr,
      postAnswerSubtext: d.meaningTr,
      explanationTr: d.explanationTr,
      explanationEn: d.explanationEn,
      audioText: d.fullSentence,
      choices: shuffledChoices,
      correctChoice: d.correctChoice,
      expectedAnswers: [d.correctChoice],
      direction: 'en-to-tr',
      questionAudioId: audioId,
      questionVoiceScriptTr: REMEDIAL_QUESTION_SCRIPTS[audioId],
    };
  });

  // 2. Pre-authored ElevenLabs-voiced Spot-the-Bug Detective (up to 2, preserving stable template index)
  const indexedSpots = spec.spotFixes.map((template, origIdx) => ({ template, origIdx }));
  const selectedSpots = shuffleWithSeed(indexedSpots, seed + 23).slice(0, 2);
  const spotExercises: RemedialExercise[] = selectedSpots.map(({ template: sf, origIdx }, i) => {
    const audioId = getRemedialQuestionAudioId(skillId, 'spot', origIdx + 1);
    const shuffledFixChoices = shuffleWithSeed(sf.fixChoices, seed + 200 + i);
    return {
      id: `rem_spot_${audioId}`,
      kind: 'spot_fix',
      card: makeSyntheticCard(`rem_c_spot_${audioId}`, sf.correctedSentence, sf.meaningTr),
      promptText: sf.buggyTokens.join(' '),
      promptSubtext: sf.meaningTr,
      postAnswerSubtext: sf.meaningTr,
      explanationTr: sf.explanationTr,
      explanationEn: sf.explanationEn,
      audioText: sf.correctedSentence,
      buggyTokens: [...sf.buggyTokens],
      buggyTokenIndex: sf.buggyTokenIndex,
      fixChoices: shuffledFixChoices,
      correctFixToken: sf.correctFixToken,
      correctedSentence: sf.correctedSentence,
      expectedAnswers: [sf.correctedSentence],
      direction: 'en-to-tr',
      questionAudioId: audioId,
      questionVoiceScriptTr: REMEDIAL_QUESTION_SCRIPTS[audioId],
    };
  });

  // 3. Pre-authored ElevenLabs-voiced Real-Life Scenario Pick (1)
  const scenario = spec.scenarios[0];
  let scenExercise: RemedialExercise | null = null;
  if (scenario) {
    const audioId = getRemedialQuestionAudioId(skillId, 'scen', 1);
    scenExercise = {
      id: `rem_scen_${audioId}`,
      kind: 'scenario_pick',
      card: makeSyntheticCard(`rem_c_scen_${audioId}`, scenario.correctChoice, scenario.meaningTr),
      promptText: scenario.scenarioTr,
      promptSubtext: scenario.scenarioEn,
      postAnswerSubtext: scenario.meaningTr,
      explanationTr: scenario.explanationTr,
      explanationEn: scenario.explanationEn,
      audioText: scenario.correctChoice,
      choices: shuffleWithSeed(scenario.choices, seed + 301),
      correctChoice: scenario.correctChoice,
      expectedAnswers: [scenario.correctChoice],
      direction: 'tr-to-en',
      questionAudioId: audioId,
      questionVoiceScriptTr: REMEDIAL_QUESTION_SCRIPTS[audioId],
    };
  }

  // 4. Dynamic personalized drills from user's real missed / modern cards
  const vocabExercises: RemedialExercise[] = [];
  let clozeEx: RemedialExercise | null = null;
  let wbEx: RemedialExercise | null = null;

  if (skillId === 'trouble_vocab' && matchedCards.length > 0) {
    // Build personal vocab_recall drills with level+POS-matched, zero-synonym-collision distractors
    const allWordPool = allCards.filter((c) => c.type === 'word' && c.acceptedTr.length > 0);
    for (let i = 0; i < Math.min(3, matchedCards.length); i += 1) {
      const targetWord = matchedCards[i]!;
      const targetMeaningsSet = new Set(targetWord.acceptedTr.map(foldTurkishKey));
      const sameLevelPos = allWordPool.filter(
        (w) =>
          w.id !== targetWord.id &&
          w.level === targetWord.level &&
          w.pos === targetWord.pos &&
          !w.acceptedTr.some((t) => targetMeaningsSet.has(foldTurkishKey(t)))
      );
      const broaderPool = allWordPool.filter(
        (w) =>
          w.id !== targetWord.id &&
          !w.acceptedTr.some((t) => targetMeaningsSet.has(foldTurkishKey(t)))
      );
      const sourcePool = sameLevelPos.length >= 6 ? sameLevelPos : broaderPool;
      const pickedDistractors: string[] = [];
      const seenDist = new Set<string>([foldTurkishKey(targetWord.acceptedTr[0]!)]);
      for (const cand of shuffleWithSeed(sourcePool, seed + 400 + i)) {
        const label = cand.acceptedTr[0] ?? '';
        const k = foldTurkishKey(label);
        if (!k || seenDist.has(k) || targetMeaningsSet.has(k)) continue;
        seenDist.add(k);
        pickedDistractors.push(label);
        if (pickedDistractors.length >= 3) break;
      }

      if (pickedDistractors.length >= 2) {
        const primaryMeaning = targetWord.acceptedTr[0]!;
        const meaningPreview = targetWord.acceptedTr.slice(0, 3).join(', ');
        vocabExercises.push({
          id: `rem_tv_mc_${targetWord.id}`,
          kind: 'vocab_recall',
          card: targetWord,
          promptText: targetWord.en,
          promptSubtext: targetWord.exampleEn
            ? `${targetWord.phonetic ? `${targetWord.phonetic} · ` : ''}"${targetWord.exampleEn}"`
            : targetWord.phonetic || `${targetWord.level} · ${targetWord.pos}`,
          postAnswerSubtext: targetWord.exampleTr || meaningPreview,
          explanationTr: `"${targetWord.en}" = ${meaningPreview}.`,
          explanationEn: `"${targetWord.en}" means ${meaningPreview}.`,
          audioText: targetWord.exampleEn || targetWord.en,
          choices: shuffleWithSeed([primaryMeaning, ...pickedDistractors], seed + 450 + i),
          correctChoice: primaryMeaning,
          expectedAnswers: targetWord.acceptedTr,
          direction: 'en-to-tr',
        });
      }
    }
  } else {
    // Dynamic Cloze from matched sentence (prioritizing user's real missed card)
    const clozeCard = matchedCards[0];
    if (clozeCard) {
      clozeEx = buildDynamicClozeExercise(skillId, clozeCard, allCards, seed);
    }

    // Dynamic Word Bank from matched sentence
    const wbCard = matchedCards[1] ?? matchedCards[0];
    if (wbCard) {
      wbEx = buildDynamicWordBankExercise(skillId, wbCard, allCards, seed);
    }
  }

  // 5. Final Boss Mini-Challenge: Free Translation (AI-graded when enabled!)
  const bossCard =
    (skillId === 'trouble_vocab' ? matchedCards[0] : matchedCards[2] ?? matchedCards[0]) ??
    makeSyntheticCard(
      `rem_boss_${skillId}`,
      spec.duels[0]?.fullSentence ?? spec.briefing.examples[0]!.en,
      spec.duels[0]?.meaningTr ?? spec.briefing.examples[0]!.tr
    );

  const bossEn = bossCard.type === 'word' && bossCard.exampleEn ? bossCard.exampleEn : bossCard.en;
  const bossTr =
    bossCard.type === 'word' && bossCard.exampleTr
      ? bossCard.exampleTr
      : bossCard.acceptedTr[0] ?? bossEn;

  const bossEx: RemedialExercise = {
    id: `rem_boss_${skillId}_${bossCard.id}`,
    kind: 'free_translation',
    card: bossCard,
    promptText: bossTr,
    promptSubtext: spec.titleTr,
    postAnswerSubtext: bossTr,
    explanationTr: `Örnek doğru cevap: "${bossEn}"`,
    explanationEn: `Reference answer: "${bossEn}"`,
    audioText: bossEn,
    expectedAnswers: [bossEn],
    direction: 'tr-to-en',
  };

  // 6. Balanced Interleaving:
  // Start with a user-personalized mistake drill, then alternate smoothly with
  // pre-authored ElevenLabs-narrated drills, finishing with the personalized Boss Challenge.
  const orderedSlots: Array<RemedialExercise | null | undefined> =
    skillId === 'trouble_vocab'
      ? [
          vocabExercises[0],
          duelExercises[0],
          vocabExercises[1],
          spotExercises[0],
          vocabExercises[2],
          duelExercises[1],
          scenExercise,
          bossEx,
        ]
      : [
          clozeEx,
          duelExercises[0],
          spotExercises[0],
          wbEx,
          duelExercises[1],
          scenExercise,
          spotExercises[1],
          bossEx,
        ];

  const exercises: RemedialExercise[] = orderedSlots.filter(
    (item): item is RemedialExercise => Boolean(item)
  );

  return {
    skillId,
    titleTr: spec.titleTr,
    titleEn: spec.titleEn,
    briefing,
    exercises: exercises.slice(0, 8),
    relatedConceptIds: weakness?.relatedConceptIds ?? [],
  };
}

export interface MatchedRemedialQuestionAudio {
  skillId: WeakSkillId;
  questionAudioId: string;
  questionVoiceScriptTr: string;
}

let cachedSentenceToQuestionAudio: Map<string, MatchedRemedialQuestionAudio> | null = null;

function normalizeSentenceForAudioLookup(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Look up whether an English sentence (e.g. inside a Roadmap exercise) exactly matches
 * one of the 92 pre-authored remedial questions that have a bundled ElevenLabs explanation MP3.
 */
export function findRemedialQuestionAudioForSentence(
  englishText: string
): MatchedRemedialQuestionAudio | null {
  const key = normalizeSentenceForAudioLookup(englishText);
  if (!key || key.split(' ').length < 3) return null;

  if (!cachedSentenceToQuestionAudio) {
    cachedSentenceToQuestionAudio = new Map<string, MatchedRemedialQuestionAudio>();
    for (const skillId of REMEDIAL_SKILL_ORDER) {
      const spec = REMEDIAL_SKILL_CATALOG[skillId];
      spec.duels.forEach((d, idx) => {
        const audioId = getRemedialQuestionAudioId(skillId, 'duel', idx + 1);
        const scriptTr = REMEDIAL_QUESTION_SCRIPTS[audioId];
        if (!scriptTr) return;
        const norm = normalizeSentenceForAudioLookup(d.fullSentence);
        if (norm && !cachedSentenceToQuestionAudio!.has(norm)) {
          cachedSentenceToQuestionAudio!.set(norm, {
            skillId,
            questionAudioId: audioId,
            questionVoiceScriptTr: scriptTr,
          });
        }
      });
      spec.spotFixes.forEach((sf, idx) => {
        const audioId = getRemedialQuestionAudioId(skillId, 'spot', idx + 1);
        const scriptTr = REMEDIAL_QUESTION_SCRIPTS[audioId];
        if (!scriptTr) return;
        const norm = normalizeSentenceForAudioLookup(sf.correctedSentence);
        if (norm && !cachedSentenceToQuestionAudio!.has(norm)) {
          cachedSentenceToQuestionAudio!.set(norm, {
            skillId,
            questionAudioId: audioId,
            questionVoiceScriptTr: scriptTr,
          });
        }
      });
      spec.scenarios.forEach((sc, idx) => {
        const audioId = getRemedialQuestionAudioId(skillId, 'scen', idx + 1);
        const scriptTr = REMEDIAL_QUESTION_SCRIPTS[audioId];
        if (!scriptTr) return;
        const norm = normalizeSentenceForAudioLookup(sc.correctChoice);
        if (norm && !cachedSentenceToQuestionAudio!.has(norm)) {
          cachedSentenceToQuestionAudio!.set(norm, {
            skillId,
            questionAudioId: audioId,
            questionVoiceScriptTr: scriptTr,
          });
        }
      });
    }
  }

  return cachedSentenceToQuestionAudio.get(key) ?? null;
}
