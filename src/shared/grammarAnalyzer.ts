import {
  ACTIVE_HAS_CONTRACTION_PARTS,
  CLAUSE_ADVERBS,
  COMMON_BASE_VERBS,
  CONTRACTED_SUBJECT_AUX,
  DETERMINER_WORDS,
  FINITE_AUXILIARY_WORDS,
  GOING_TO_PLACE_OR_DET,
  IMPERATIVE_HOMOGRAPH_STARTERS,
  IMPERATIVE_START_VERBS,
  INVARIANT_VERBS,
  IRREGULAR_PLURAL_NOUNS,
  IRREGULAR_V2_SET,
  MUST_BE_DUTY_ADJS,
  NON_CONTINUOUS_ING_WORDS,
  NON_GERUND_ING_WORDS,
  NON_VERB_AFTER_PRONOUN,
  NON_VERB_ED_WORDS,
  PARTICIPIAL_ADJECTIVES,
  PARTICIPIAL_ING_ADJECTIVES,
  PLURAL_DETERMINERS,
  POSSESSIVE_TIME_OR_NOUN_BEFORE_S,
  SINGULAR_ONLY_DETERMINERS,
  SINGULAR_S_NOUNS,
  SUBJECT_PRONOUNS,
} from './grammarLexicon.ts';
import type { ExtraGrammarRuleId, VoiceCoachRuleId, WeakSkillId } from './types';

/**
 * Syntactically aware English grammar analyzer covering all 35 voice-coach rules
 * (18 core Remedial workshops + 17 foundational grammar guides).
 *
 * Key linguistic disambiguations enforced here:
 * - Clause vs. preposition distinction (`before / after / until / till / when / once`)
 *   using clause-level predicate counting, infinitive exclusion (`to + V1`), contracted
 *   pronoun recognition (`you've`, `he's`), and subject-verb agreement checking.
 * - True passive voice (`be + V3`) vs. participial adjectives, `be used to` (accustomed),
 *   and contracted `'s` Present Perfect (`It's been`, `He's got`, `She's lived`).
 * - Simple Past vs. negative/inverted/passive Present Perfect (`haven't responded`,
 *   `Have you ever tried`, `have been cancelled`), `-ed` base verbs (`succeed`, `need`),
 *   contractions (`won't`), compounds (`built-in`, `LED`), and homographs (`a bit`, `turn left`).
 * - Epistemic deduction (`must be tired/true`) vs. passive/deontic obligation (`must be fired`).
 * - Conditionals (`if / would`) vs. polite offers (`Would you like/mind...?`) and reported backshift.
 * - Existential `there is/are` vs. locative adverb `over there / was there`.
 * - Relative clauses vs. embedded/interrogative WH-clauses (`arguing about who`, `no matter who`).
 */

// Participles used as passive/perfect V3 forms (`been` excluded from passive main participles).
const UNAMBIGUOUS_PASSIVE_V3 =
  '(?:done|seen|made|gone|taken|written|found|heard|known|got|gotten|had|given|told|said|built|sold|sent|held|paid|born|caught|hurt|left|kept|met|lost|won|bought|brought|thought|felt|chosen|broken|spoken|driven|eaten|fallen|flown|forgotten|grown|hidden|ridden|risen|shown|sung|sat|slept|spent|stood|stolen|swum|taught|thrown|understood|worn|woken|begun|drunk|beaten|drawn|fed|fought|forgiven|frozen|hung|laid|led|lent|lit|meant|proven|proved|rung|shaken|shot|sunk|slid|stuck|struck|sworn|swept|torn|wound)';

const PASSIVE_V3_PATTERN =
  `(?:${UNAMBIGUOUS_PASSIVE_V3}|run|set|shut|put|read|cut|hit|let|cost|beat|quit|split|spread)`;

const PERFECT_V3_PATTERN = `(?:been|${PASSIVE_V3_PATTERN})`;

// Negative lookbehind/lookahead prevent contractions (`won't`) and hyphenated adjectives (`built-in`) matching V2 verbs.
const IRREGULAR_V2_RE = new RegExp(
  `(?<![a-z'-])(?:${Array.from(IRREGULAR_V2_SET).join('|')})(?![a-z'-])`,
  'i'
);

const LINKING_VERBS = new Set([
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'get', 'gets', 'got', 'gotten', 'getting',
  'become', 'becomes', 'became', 'becoming',
  'seem', 'seems', 'seemed', 'feel', 'feels', 'felt',
  'look', 'looks', 'looked', 'sound', 'sounds', 'sounded',
  'stay', 'stays', 'stayed', 'remain', 'remains', 'remained',
]);

const PHRASAL_OBJ = '(?:(?:it|them|him|her|me|us|that|this)\\s+)?';

const PHRASAL_VERB_RE = new RegExp(
  [
    '\\b(?:get(?:s|ting)?|got|gotten)\\s+(?:off|on|up|rid\\s+of|along|back|through)\\b',
    '\\b(?:get(?:s|ting)?|got|gotten)\\s+over\\b(?!\\s+(?:there|here)\\b)',
    `\\b(?:take(?:s|n|ing)?|took)\\s+${PHRASAL_OBJ}(?:away|off|over|up|care\\s+of)\\b`,
    '\\bcut(?:s|ting)?\\s+[\\w\'\\s]{0,18}\\bshort\\b',
    '\\b(?:speak(?:s|ing)?|spoke|spoken)\\s+out\\b',
    `\\b(?:giv(?:e|es|ing|en)|gave)\\s+${PHRASAL_OBJ}up\\b`,
    `\\bturn(?:s|ed|ing)?\\s+${PHRASAL_OBJ}(?:on|off|down|up|out)\\b`,
    '\\blook(?:s|ed|ing)?\\s+(?:forward\\s+to|after|up|for|into)\\b',
    `\\bfigur(?:e|es|ed|ing)\\s+${PHRASAL_OBJ}out\\b`,
    '\\b(?:run(?:s|ning)?|ran)\\s+out\\s+of\\b',
    `\\bput(?:s|ting)?\\s+${PHRASAL_OBJ}(?:off|away|down|up\\s+with)\\b`,
    '\\b(?:hang(?:s|ing)?|hung)\\s+out\\b',
    '\\bwork(?:s|ed|ing)?\\s+out\\b',
    '\\bshow(?:s|ed|ing)?\\s+up\\b',
    '\\b(?:break(?:s|ing)?|broke|broken)\\s+down\\b',
    '\\b(?:carry(?:ing)?|carries|carried)\\s+out\\b',
    '\\b(?:find(?:s|ing)?|found)\\s+out\\b',
    `\\bset(?:s|ting)?\\s+${PHRASAL_OBJ}up\\b`,
    `\\bpick(?:s|ed|ing)?\\s+${PHRASAL_OBJ}up\\b`,
    '\\b(?:wak(?:e|es|ing)|woke|woken)\\s+up\\b',
    '\\b(?:grow(?:s|ing|n)?|grew)\\s+up\\b',
    '\\bcalm(?:s|ed|ing)?\\s+down\\b',
    '\\bslow(?:s|ed|ing)?\\s+down\\b',
    '\\bstay(?:s|ed|ing)?\\s+up\\b',
    '\\b(?:catch(?:es|ing)?|caught)\\s+up\\b',
    '\\bcheck(?:s|ed|ing)?\\s+(?:in|out)\\b',
    '\\bend(?:s|ed|ing)?\\s+up\\b',
    '\\bmov(?:e|es|ed|ing)\\s+on\\b(?!\\s+(?:my|your|his|her|its|our|their|the|a|an)\\s+(?:back|floor|table|wall|screen|road|street|ground|roof|ceiling|surface|arm|leg|hand|face|skin)\\b)',
    '\\b(?:com(?:e|es|ing)|came)\\s+(?:up\\s+with|across)\\b',
  ].join('|'),
  'i'
);

/* ==================== MORPHOSYNTACTIC HELPERS ==================== */

/** Return true if `word` is the 3rd-person singular `-s/-es/-ies` inflection of a known English verb. */
function isKnown3sgVerb(word: string): boolean {
  if (word.length < 3 || !word.endsWith('s')) return false;
  if (word === 'has' || word === 'does' || word === 'goes') return true;
  if (SINGULAR_S_NOUNS.has(word) || FINITE_AUXILIARY_WORDS.has(word)) return false;
  if (word.endsWith('ies') && word.length >= 4) {
    if (COMMON_BASE_VERBS.has(`${word.slice(0, -3)}y`)) return true;
  }
  if (word.endsWith('es') && word.length >= 4) {
    if (COMMON_BASE_VERBS.has(word.slice(0, -2))) return true;
  }
  return COMMON_BASE_VERBS.has(word.slice(0, -1));
}

/**
 * Return true if `word` can function as an active finite simple-past verb (`V2`).
 * Unlike `PARTICIPIAL_ADJECTIVES`, verbs like `finished`, `closed`, `organized` ARE valid active past verbs
 * when preceded by a subject rather than a linking verb (`be / get / feel / look / seem`).
 */
function isActiveFinitePastVerb(word: string, prevWord = ''): boolean {
  if (IRREGULAR_V2_SET.has(word)) {
    if (word === 'bit' && /^(?:a|one|every|little|tiny|small)$/.test(prevWord)) return false;
    if (word === 'shot' && /^(?:a|an|the|one|two|three|my|your|his|her|its|our|their|flu|long|good|best|last|first|final|only)$/.test(prevWord)) {
      return false;
    }
    if (word === 'left' && /^(?:the|my|your|his|her|its|our|their|turn|turned|turning|when|if|while|nothing|anything|something|hour|hours|day|days|time|minutes|weeks|months|years|paper|sugar|room|food)$/.test(prevWord)) {
      return false;
    }
    if (word === 'saw' && /^(?:a|an|the|chain|hand|power|table|circular)$/.test(prevWord)) return false;
    if (word === 'rose' && /^(?:a|an|the|red|white|yellow|pink|my|your|his|her)$/.test(prevWord)) return false;
    return true;
  }
  if (word.length < 4 || !word.endsWith('ed')) return false;
  if (NON_VERB_ED_WORDS.has(word)) return false;
  if (PARTICIPIAL_ADJECTIVES.has(word) && (LINKING_VERBS.has(prevWord) || CLAUSE_ADVERBS.has(prevWord) || prevWord === 'very' || prevWord === 'so' || prevWord === 'too' || prevWord === 'quite' || DETERMINER_WORDS.has(prevWord))) {
    return false;
  }
  return true;
}

function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\-\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^['\-]+|['\-]+$/g, ''))
    .filter(Boolean);
}

/**
 * Determine whether a token slice `[0..endIdx)` looks like a plural noun phrase
 * rather than a singular noun phrase (used to enforce English subject-verb agreement).
 */
function isPluralSubjectSlice(words: string[], endIdx: number): boolean {
  if (endIdx <= 0) return false;
  if (words.slice(0, endIdx).includes('and')) return true;

  const first = words[0]!;
  if (PLURAL_DETERMINERS.has(first)) return true;

  let headIdx = endIdx - 1;
  while (headIdx > 0 && CLAUSE_ADVERBS.has(words[headIdx]!)) {
    headIdx -= 1;
  }
  const head = words[headIdx]!;

  if (SINGULAR_ONLY_DETERMINERS.has(first)) return false;
  if (IRREGULAR_PLURAL_NOUNS.has(head)) return true;
  if (
    head.endsWith('s') &&
    head.length >= 3 &&
    !SINGULAR_S_NOUNS.has(head) &&
    !head.endsWith('ss') &&
    !head.endsWith("'s")
  ) {
    return true;
  }
  return false;
}

/**
 * Check whether a single clause segment (already stripped of trailing commas/clauses)
 * contains a grammatical Subject + Finite Verb sequence.
 */
function hasFiniteClauseInSegment(segment: string): boolean {
  // Remove case-sensitive acronym `LED` before lowercasing so "LED lights" is never read as verb `led`
  const sanitized = segment.replace(/\bLED\b/g, 'light');
  const words = tokenizeWords(sanitized);
  if (words.length < 2) return false;

  const first = words[0]!;
  if (first === 'to') return false;
  if (first.endsWith('ing') && !NON_GERUND_ING_WORDS.has(first)) return false;

  // 1. Contracted pronoun + auxiliary ("you've eaten", "he's coming", "it's raining", "we'll leave")
  if (CONTRACTED_SUBJECT_AUX.has(first)) {
    return true;
  }

  // 2. Bare subject pronoun + optional adverb(s) + agreeing verb/auxiliary
  if (SUBJECT_PRONOUNS.has(first)) {
    let idx = 1;
    while (idx < words.length && CLAUSE_ADVERBS.has(words[idx]!)) {
      idx += 1;
    }
    const v = words[idx];
    if (!v) return false;
    if (DETERMINER_WORDS.has(v) || NON_VERB_AFTER_PRONOUN.has(v)) return false;
    if (FINITE_AUXILIARY_WORDS.has(v)) return true;
    const prev = words[idx - 1] ?? first;
    if (first === 'he' || first === 'she' || first === 'it') {
      return isKnown3sgVerb(v) || isActiveFinitePastVerb(v, prev) || INVARIANT_VERBS.has(v);
    }
    if (first === 'there') {
      return FINITE_AUXILIARY_WORDS.has(v) || isKnown3sgVerb(v) || isActiveFinitePastVerb(v, prev);
    }
    return COMMON_BASE_VERBS.has(v) || isActiveFinitePastVerb(v, prev) || INVARIANT_VERBS.has(v);
  }

  // 3. Lexical Noun Phrase subject + agreeing Finite Verb (stopping at infinitive `to`!)
  const startsWithDet = DETERMINER_WORDS.has(first);
  const minVerbIdx = startsWithDet ? 2 : 1;
  const maxScan = Math.min(words.length, 7);

  for (let i = 1; i < maxScan; i += 1) {
    const w = words[i]!;
    const prev = words[i - 1]!;

    // Stop scanning at an infinitive marker `to` ("after four PM to sleep better")
    if (w === 'to') break;
    if (CLAUSE_ADVERBS.has(w)) continue;
    if (i < minVerbIdx) continue;
    if (DETERMINER_WORDS.has(prev)) continue;

    if (FINITE_AUXILIARY_WORDS.has(w)) {
      return true;
    }
    if (/'(?:ll|ve|re|d)$/.test(w)) {
      return true;
    }
    if (w.endsWith("'s") && i + 1 < words.length) {
      const nextAfterS = words[i + 1]!;
      if (
        /^(?:been|got|gotten|going|not|already|ready|available|over|done)$/.test(nextAfterS)
      ) {
        return true;
      }
    }

    const pluralSubj = isPluralSubjectSlice(words, i);

    // 3rd-person singular verb ("my leg heals", "the fat lady sings", "a paper shapes public debate")
    if (!pluralSubj && isKnown3sgVerb(w) && !prev.endsWith("'s")) {
      return true;
    }

    // Plural subject + base present verb ("real users ever see them", "tickets go on sale")
    if (pluralSubj && (COMMON_BASE_VERBS.has(w) || INVARIANT_VERBS.has(w)) && !prev.endsWith("'s")) {
      return true;
    }

    // Active past tense verb (regular `-ed`, irregular V2, or invariant past like "the storm hit")
    if (isActiveFinitePastVerb(w, prev) && !prev.endsWith("'s")) {
      return true;
    }
    if (!pluralSubj && INVARIANT_VERBS.has(w) && !prev.endsWith("'s") && !SINGULAR_ONLY_DETERMINERS.has(prev)) {
      return true;
    }
  }

  return false;
}

/**
 * Check whether a text span already contains a main-clause predicate (finite verb, auxiliary,
 * `used to`, or imperative verb) — used to distinguish prepositional modifiers inside a subject NP
 * ("Drinking cold water after a hot walk feels awesome") from post-predicate subordinate clauses.
 */
function hasClausePredicate(span: string): boolean {
  const trimmed = span.trim();
  if (!trimmed) return false;

  if (/\bused\s+to\s+[a-z]{2,}\b/i.test(trimmed)) return true;
  if (matchesImperativesLets(trimmed)) return true;

  const parts = trimmed.split(/[,;:.?!—–]+/).filter((p) => p.trim().length > 0);
  for (const p of parts) {
    if (matchesImperativesLets(p)) return true;
    if (hasFiniteClauseInSegment(p)) return true;
  }
  return false;
}

/**
 * Count distinct finite verb/auxiliary predicates inside a comma-free text span
 * (used when no main-clause predicate precedes a subordinator and there is no comma).
 */
function countFinitePredicatesInSpan(span: string): number {
  const words = tokenizeWords(span.replace(/\bLED\b/g, 'light'));
  let count = 0;
  let inVerbCluster = false;

  for (let i = 0; i < words.length; i += 1) {
    const w = words[i]!;
    if (w === 'to') {
      i += 1;
      inVerbCluster = false;
      continue;
    }
    if (CLAUSE_ADVERBS.has(w)) continue;

    const prev = i > 0 ? words[i - 1]! : '';
    const isPred =
      CONTRACTED_SUBJECT_AUX.has(w) ||
      FINITE_AUXILIARY_WORDS.has(w) ||
      (i >= 1 && !DETERMINER_WORDS.has(prev) && (isKnown3sgVerb(w) || isActiveFinitePastVerb(w, prev)));

    if (isPred) {
      if (!inVerbCluster) {
        count += 1;
        inVerbCluster = true;
      }
    } else {
      inVerbCluster = false;
    }
  }
  return count;
}

/**
 * Full-sentence syntactic test: determines whether a subordinator (`before`, `after`, `until`,
 * `till`, `when`, `whenever`, `once`, `as soon as`, `by the time`) at `[subIndex, subIndex+subLen)`
 * introduces a genuine finite subordinate clause rather than a prepositional noun phrase.
 *
 * Enforces the English two-predicate law: if NO main-clause predicate precedes the subordinator
 * (e.g. inside a gerund/noun subject like "Drinking cold water after a hot walk feels awesome."
 * or fronted "After the stop the train accelerated quickly."), the single finite verb after the NP
 * belongs to the MAIN clause, not the prepositional phrase.
 */
function isSubordinatorFollowedByFiniteClause(
  en: string,
  subIndex: number,
  subLen: number
): boolean {
  const left = en.slice(0, subIndex).trim();
  const right = en.slice(subIndex + subLen).trim();
  if (!right) return false;

  const firstClause = right.split(/[,;.?!—–]/)[0]?.trim() ?? '';
  if (!firstClause) return false;

  const firstTok = tokenizeWords(firstClause)[0] ?? '';
  if (!firstTok || firstTok === 'to') return false;
  if (firstTok.endsWith('ing') && !NON_GERUND_ING_WORDS.has(firstTok)) return false;

  if (hasClausePredicate(left)) {
    return hasFiniteClauseInSegment(firstClause);
  }

  // No main-clause predicate precedes `sub` (fronted or inside subject NP):
  const commaIdx = right.indexOf(',');
  if (commaIdx > 0) {
    const beforeComma = right.slice(0, commaIdx).trim();
    const afterComma = right.slice(commaIdx + 1).trim();
    return hasFiniteClauseInSegment(beforeComma) && hasClausePredicate(afterComma);
  }

  return hasFiniteClauseInSegment(firstClause) && countFinitePredicatesInSpan(firstClause) >= 2;
}

/**
 * Check whether a standalone fragment following a time subordinator contains a finite clause
 * (exported for direct unit testing and fragment-level disambiguation).
 */
export function hasFiniteClauseAfter(fragment: string): boolean {
  const clauseSlice = fragment.split(/[,;.?!—–]/)[0]?.trim() ?? '';
  if (!clauseSlice) return false;
  return hasFiniteClauseInSegment(clauseSlice);
}

/**
 * Detect whether a finite clause fragment is in the past tense (excluding Present Perfect
 * `have/has/'ve + V3` and stative participial adjectives like `gets crowded`).
 */
function isPastTenseClause(clause: string, fullSentence: string): boolean {
  const withoutPresentPerfect = clause
    .replace(/\bLED\b/g, 'light')
    .replace(
      new RegExp(
        `\\b(?:have|has|haven't|hasn't|[a-z]+'ve)\\s+(?:(?:not|never|ever|just|already|still|recently|finally)\\s+){0,2}(?:${PERFECT_V3_PATTERN}|[a-z]{2,}ed)\\b`,
        'gi'
      ),
      ' '
    );

  const words = tokenizeWords(withoutPresentPerfect);
  const sentenceHasPastMain =
    /\b(?:was|were|wasn't|weren't|did|didn't|had|hadn't|used\s+to)\b/i.test(fullSentence) ||
    IRREGULAR_V2_RE.test(fullSentence.replace(/\bLED\b/g, 'light'));

  for (let i = 0; i < words.length; i += 1) {
    const w = words[i]!;
    const prev = i > 0 ? words[i - 1]! : '';
    if (
      w === 'was' ||
      w === 'were' ||
      w === "wasn't" ||
      w === "weren't" ||
      w === 'had' ||
      w === "hadn't" ||
      w === 'did' ||
      w === "didn't"
    ) {
      return true;
    }
    if (isActiveFinitePastVerb(w, prev) && !DETERMINER_WORDS.has(prev)) {
      return true;
    }
    if (sentenceHasPastMain && INVARIANT_VERBS.has(w) && i >= 1 && !DETERMINER_WORDS.has(prev)) {
      return true;
    }
  }
  return false;
}

/**
 * Detect prepositional uses of `before / after / until / till / during / within / between / without`
 * followed by a noun phrase (e.g. "before an exam", "after a hot walk", "until midnight", "during the meeting").
 */
export function hasTimePrepositionPhrase(en: string): boolean {
  const prepRe = /\b(before|after|until|till|during|within|between|without)\s+([^,;.?!—–]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = prepRe.exec(en)) !== null) {
    const prep = m[1]!.toLowerCase();
    const after = m[2]!.trim();
    if (!after) continue;

    const beforeCtx = en.slice(Math.max(0, m.index - 28), m.index).trim().toLowerCase();

    if (prep === 'after') {
      if (
        /\b(?:look|looks|looked|looking|take|takes|took|taking|name|named|chase|chasing|go|goes|went|going|run|runs|ran|running)$/.test(
          beforeCtx
        ) ||
        /\b(?:am|is|are|was|were|be|been|'m|'s|'re)(?:\s+(?:not|all|still|just|only|really))?$/.test(
          beforeCtx
        ) ||
        /^all\b/i.test(after)
      ) {
        continue;
      }
    }

    if (prep === 'before' && /^long\b/i.test(after)) continue;
    if ((prep === 'until' || prep === 'till') && /^when\b/i.test(after)) continue;

    const firstWord = tokenizeWords(after)[0] ?? '';
    if (!firstWord) continue;
    if (firstWord.endsWith('ing') && !NON_GERUND_ING_WORDS.has(firstWord)) continue;

    if (prep === 'during' || prep === 'within' || prep === 'between' || prep === 'without') {
      return true;
    }
    if (!isSubordinatorFollowedByFiniteClause(en, m.index, prep.length)) {
      return true;
    }
  }
  return false;
}

/* ==================== 18 CORE REMEDIAL SKILL MATCHERS ==================== */

function matchesTimeClauses(en: string): boolean {
  const trimmed = en.trim();

  const subRe = /\b(as\s+soon\s+as|by\s+the\s+time|until|till|before|after|when|whenever|once)\s+([^,;.?!—–]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = subRe.exec(trimmed)) !== null) {
    const sub = m[1]!.toLowerCase();
    const after = m[2]!.trim();
    const beforeCtx = trimmed.slice(Math.max(0, m.index - 28), m.index).trim().toLowerCase();

    if (
      sub === 'after' &&
      (/\b(?:look|looks|looked|looking|take|takes|took|taking|name|named|chase|chasing|go|goes|went|going|run|runs|ran|running)$/.test(
        beforeCtx
      ) ||
        /\b(?:am|is|are|was|were|be|been|'m|'s|'re)(?:\s+(?:not|all|still|just|only|really))?$/.test(
          beforeCtx
        ) ||
        /^all\b/i.test(after))
    ) {
      continue;
    }
    if ((sub === 'until' || sub === 'till') && /^when\b/i.test(after)) continue;
    if (
      sub === 'when' &&
      m.index === 0 &&
      /^(?:am|is|are|was|were|do|does|did|have|has|had|will|would|can|could|should|may|might)\b/i.test(after)
    ) {
      continue;
    }
    // Exclude indirect-question `when` ("It doesn't matter when you come", "Tell me when he arrives")
    if (
      sub === 'when' &&
      /\b(?:tell|ask|asked|know|knew|wonder|wondered|remember|forget|decide|see|explain|say|said|matter|matters)(?:\s+(?:me|us|him|her|them|you))?$/.test(
        beforeCtx
      )
    ) {
      continue;
    }

    if (!isSubordinatorFollowedByFiniteClause(trimmed, m.index, m[1]!.length)) {
      continue;
    }
    if (sub === 'when' && matchesPastContinuous(trimmed) && !/\b(?:will|'ll|going\s+to)\b/i.test(trimmed)) {
      continue;
    }
    if (isPastTenseClause(after, trimmed) && !/\b(?:will|'ll|won't|going\s+to)\b/i.test(trimmed)) {
      continue;
    }
    return true;
  }
  return false;
}

function matchesPastContinuous(en: string): boolean {
  return (
    /\b(?:was|were|wasn't|weren't)\s+(?:not\s+|still\s+|always\s+|just\s+)?[a-z]{2,}ing\b/i.test(en) ||
    /\b(?:was|were|wasn't|weren't)\s+(?:i|you|we|they|he|she|it)\s+[a-z]{2,}ing\b/i.test(en)
  );
}

function matchesWasVsWere(en: string): boolean {
  return /\b(?:was|were|wasn't|weren't)\b/i.test(en);
}

function matchesShouldVsHaveTo(en: string): boolean {
  if (
    /\b(?:should|shouldn't|ought\s+to|(?:have|has|had|don't\s+have|doesn't\s+have|didn't\s+have|do\s+not\s+have|does\s+not\s+have|did\s+not\s+have)\s+to|mustn't)\b/i.test(
      en
    )
  ) {
    return true;
  }

  const mustRe = /\bmust\s+(?:not\s+)?([a-z']+)\s*([a-z']*)\s*([a-z']*)/gi;
  let m: RegExpExecArray | null;
  while ((m = mustRe.exec(en)) !== null) {
    const w1 = m[1]!.toLowerCase();
    const w2 = (m[2] ?? '').toLowerCase();
    const w3 = (m[3] ?? '').toLowerCase();
    if (w1 === 'have') {
      if (w2 === 'to') return true;
      continue;
    }
    if (w1 === 'be') {
      const candidatePart = CLAUSE_ADVERBS.has(w2) || w2 === 'not' ? w3 : w2;
      if (
        !PARTICIPIAL_ADJECTIVES.has(candidatePart) &&
        !NON_VERB_ED_WORDS.has(candidatePart) &&
        (candidatePart.endsWith('ed') || new RegExp(`^${PASSIVE_V3_PATTERN}$`, 'i').test(candidatePart))
      ) {
        return true;
      }
      if (MUST_BE_DUTY_ADJS.has(w2) || (w2 === 'in' && w3 === 'possession')) {
        return true;
      }
      continue;
    }
    return true;
  }
  return false;
}

function matchesBeGetUsedTo(en: string): boolean {
  const re =
    /\b(am|is|are|was|were|be|been|being|'m|'s|'re|get|gets|got|gotten|getting|become|becomes|became|becoming)\s+(?:(?:not|never|still|already|slowly|quickly|gradually|finally|easily|almost|mostly|really|very|ever|soon|eventually)\s+){0,2}used\s+to\s+([a-z']+)(?:\s+([a-z']+))?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(en)) !== null) {
    const aux = m[1]!.toLowerCase();
    const after = m[2]!.toLowerCase();
    const after2 = (m[3] ?? '').toLowerCase();
    if (/^(?:get|gets|got|gotten|getting|become|becomes|became|becoming)$/.test(aux)) {
      return true;
    }
    if (
      (after.endsWith('ing') && !NON_GERUND_ING_WORDS.has(after)) ||
      (after === 'not' && after2.endsWith('ing')) ||
      DETERMINER_WORDS.has(after) ||
      /^(?:it|this|that|them|him|her|me|us|you|people|cold|heat|noise|work|life|stress|traffic|crowds|weather|pressure|spicy|early|late|hard|long|loud|dark|mountain|late-hour)$/.test(
        after
      )
    ) {
      return true;
    }
  }
  return false;
}

function matchesUsedToHabit(en: string): boolean {
  if (
    /\b(?:am|is|are|was|were|be|been|being|'m|'s|'re|get|gets|got|gotten|getting|become|becomes|became|becoming)\s+(?:(?:not|never|still|already|slowly|quickly|gradually|finally|easily|almost|mostly|often|commonly|widely|ever|soon|eventually)\s+){0,2}used\s+to\b/i.test(
      en
    )
  ) {
    return false;
  }
  return /\b(?:used\s+to|didn't\s+use\s+to|did\s+not\s+use\s+to|did\s+(?:i|you|we|they|he|she|it|[a-z]+)\s+use\s+to)\s+[a-z]{2,}\b/i.test(
    en
  );
}

function matchesPresentPerfect(en: string): boolean {
  const ppRe = new RegExp(
    `(?:^|\\s)(?:(should|shouldn't|would|wouldn't|could|couldn't|might|may|must|will|won't|can't|cannot|needn't|to|'d|'ll)\\s+(?:not\\s+)?)?(?:(have|has|haven't|hasn't)|([a-z]+)'ve)\\s+(?:(?:not|n't|never|ever|just|already|still|recently|finally|always|often|both|even)\\s+){0,2}(${PERFECT_V3_PATTERN}|[a-z]{2,}ed)\\b`,
    'gi'
  );
  let m: RegExpExecArray | null;
  while ((m = ppRe.exec(en)) !== null) {
    const precedingModal = m[1];
    const contractedHost = (m[3] ?? '').toLowerCase();
    const part = m[4]!.toLowerCase();
    if (precedingModal) continue;
    if (/^(?:would|should|could|might|may|must)$/.test(contractedHost)) continue;
    if (NON_VERB_ED_WORDS.has(part)) continue;
    return true;
  }

  if (
    /\b(?:he|she|it|there|that|what|who|everything|nothing|weather|everyone|someone|nobody|[a-z]+)'s\s+(?:(?:not|never|ever|just|already|still|recently|constantly)\s+)?(?:been|lived|happened|written|worked|stayed|waited|finished|started|gone|come|seen|heard|tried|decided|forgotten|learned|lost|won|bought|brought|taken|given|found|left|kept|met|known|thought|felt|grown|fallen|risen|done\s+(?:nothing|everything|something|it|that|this|a|the))\b/i.test(
      en
    )
  ) {
    return true;
  }

  const invRe = new RegExp(
    `\\b(?:have|has)\\s+(?:i|you|we|they|he|she|it)\\s+(?:(?:ever|never|already|just|not|still|recently)\\s+){0,2}(${PERFECT_V3_PATTERN}|[a-z]{2,}ed)\\b`,
    'i'
  );
  const invMatch = invRe.exec(en);
  return Boolean(invMatch && !NON_VERB_ED_WORDS.has(invMatch[1]!.toLowerCase()));
}

function matchesPassiveVoice(en: string): boolean {
  const passiveRe = new RegExp(
    `(?:^|[\\s,;:(])(?:([a-z]+)'(m|s|re)|\\b(am|is|are|was|were|be|been|being))\\s+(?:(?:not|never|always|often|usually|just|already|still|recently|finally|quickly|carefully|slowly|completely|totally|mostly|widely|easily|badly|heavily|seriously|officially|originally|commonly|strictly|currently|frequently|newly|nearly|now|being)\\s+){0,2}(${PASSIVE_V3_PATTERN}|[a-z]{2,}ed)\\b(\\s+by\\b)?`,
    'gi'
  );
  let m: RegExpExecArray | null;
  while ((m = passiveRe.exec(en)) !== null) {
    const contractedHost = (m[1] ?? '').toLowerCase();
    const contractedSuffix = (m[2] ?? '').toLowerCase();
    const fullAux = (m[3] ?? '').toLowerCase();
    const part = m[4]!.toLowerCase();
    const hasByAgent = Boolean(m[5]);

    if (NON_VERB_ED_WORDS.has(part)) continue;

    if (contractedSuffix === 's') {
      if (ACTIVE_HAS_CONTRACTION_PARTS.has(part)) continue;
      if (part === 'done' && /^(?:he|she|who)$/.test(contractedHost)) continue;
    }

    if (part === 'used') {
      const tail = en.slice(m.index + m[0].length).trim().toLowerCase();
      if (
        /^to\s+(?:not\s+)?[a-z]{2,}ing\b/.test(tail) ||
        /^to\s+(?:the|a|an|my|your|his|her|our|their|it|this|that|these|those|them|him|her|me|us|you|people|mountain|cold|heat|noise|work|life|stress|traffic|crowds|weather|pressure|spicy|early|late|hard|long|loud|dark|late-hour)\b/.test(
          tail
        )
      ) {
        continue;
      }
      if (/^to\s+[a-z]{2,}\b/.test(tail) || hasByAgent || /^for\b/.test(tail)) {
        return true;
      }
      continue;
    }

    if (part === 'done') {
      const tail = en.slice(m.index + m[0].length).trim().toLowerCase();
      if (
        /^[a-z]{2,}ing\b/.test(tail) &&
        (fullAux === 'are' || contractedSuffix === 're' || fullAux === 'am' || contractedSuffix === 'm')
      ) {
        continue;
      }
    }

    if (PARTICIPIAL_ADJECTIVES.has(part) && !hasByAgent) continue;
    return true;
  }

  const invPassiveRe = new RegExp(
    `\\b(?:am|is|are|was|were)\\s+(?:i|you|we|they|he|she|it|this|that|these|those|(?:the|my|your|his|her|our|their)\\s+[a-z]+)\\s+(?:being\\s+)?(${PASSIVE_V3_PATTERN}|[a-z]{2,}ed)\\b`,
    'i'
  );
  const invM = invPassiveRe.exec(en);
  if (invM) {
    const part = invM[1]!.toLowerCase();
    if (!NON_VERB_ED_WORDS.has(part) && !PARTICIPIAL_ADJECTIVES.has(part)) {
      return true;
    }
  }
  return false;
}

function isGoingToPhysicalMovement(
  en: string,
  matchIndex: number,
  afterWord: string,
  fullTail: string
): boolean {
  const lowerAfter = afterWord.toLowerCase();
  if (GOING_TO_PLACE_OR_DET.has(lowerAfter)) return true;
  if (lowerAfter === 'work') {
    const before = en.slice(Math.max(0, matchIndex - 32), matchIndex).toLowerCase();
    if (
      /\b(?:it|that|this|nothing|plan|idea|method|system|thing|strategy)(?:'s|\s+is|\s+was)?(?:\s+not)?\s*$/.test(
        before
      )
    ) {
      return false;
    }
    if (/^work\s+(?:out|on|hard|well|better|with|for|together|properly|anymore|at\s+home)\b/i.test(fullTail)) {
      return false;
    }
    return true;
  }
  return false;
}

function matchesGoingToVsWill(en: string): boolean {
  const goingRe = /\b(?:going\s+to|gonna)\s+([a-z']+)/gi;
  let gm: RegExpExecArray | null;
  while ((gm = goingRe.exec(en)) !== null) {
    const tail = en.slice(gm.index + gm[0].length - gm[1]!.length);
    if (!isGoingToPhysicalMovement(en, gm.index, gm[1]!, tail)) return true;
  }
  if (/(?:'ll|\bwon't)\b/i.test(en)) return true;

  const willRe =
    /(?:^|\s)(?:(a|an|the|my|your|his|her|its|our|their|free|strong|good|bad|last|own|iron|human|divine|against)\s+)?will\b/gi;
  let wm: RegExpExecArray | null;
  while ((wm = willRe.exec(en)) !== null) {
    if (!wm[1]) return true;
  }
  return false;
}

function matchesConditionalsWould(en: string): boolean {
  const trimmed = en.trim();
  if (
    /\bif\s+(?:i|you|we|they|he|she|it|there|the\s+[a-z]+|my\s+[a-z]+|your\s+[a-z]+|someone|anyone|everyone|nobody|weather|things)\s+[a-z']+/i.test(
      trimmed
    ) &&
    !/\b(?:ask|asked|wonder|wondered|wondering|know|knew|tell|told|see|check|decide|care|matter|sure|remember)(?:\s+(?:me|us|him|her|them|you))?\s+if\b/i.test(
      trimmed
    )
  ) {
    return true;
  }
  if (
    /^(?:had|were)\s+(?:i|you|we|they|he|she|it)\s+/i.test(trimmed) &&
    /\b(?:would|wouldn't|might|could)\b/i.test(trimmed)
  ) {
    return true;
  }

  if (/\b(?:would|wouldn't)\b/i.test(trimmed)) {
    if (
      !/\bif\b/i.test(trimmed) &&
      (/\b(?:would|wouldn't)\s+(?:like|love|prefer|rather)\b/i.test(trimmed) ||
        /\b(?:would|wouldn't)\s+you(?:\s+[a-z]+)?\s+(?:like|love|prefer|mind|please|care\s+for|stop|go|allow|sign|use)\b/i.test(
          trimmed
        ))
    ) {
      return false;
    }
    if (
      !/\b(?:if|without|otherwise)\b/i.test(trimmed) &&
      /\b(?:said|told|thought|knew|hoped|believed|warned|figured|suspected|guessed|imagined|wondered|wondering|promised|expected|suspicion)\b[^.?!]{0,45}\b(?:would|wouldn't)\b/i.test(
        trimmed
      )
    ) {
      return false;
    }
    return true;
  }
  return false;
}

function matchesContrastLinkers(en: string): boolean {
  const cleaned = en
    .replace(/\bas\s+though\b/gi, ' ')
    .replace(/\bhowever\s+(?:you|they|we|he|she|i)\s+(?:like|want|wish|prefer|choose)\b/gi, ' ');
  return /\b(?:although|even\s+though|though|despite|in\s+spite\s+of|unless|however|whereas)\b/i.test(cleaned);
}

function matchesPhrasalVerbs(en: string): boolean {
  return PHRASAL_VERB_RE.test(en);
}

function matchesPrepositionsCore(en: string): boolean {
  return /\b(?:in\s+(?:the\s+(?:morning|afternoon|evening|past|future|end|middle|city|country|world|room|kitchen|car|park|office)|(?:19|20)\d\d|january|february|march|april|may|june|july|august|september|october|november|december|(?:the\s+)?(?:spring|summer|autumn|fall|winter)|a\s+(?:minute|moment|week|month|year|day|few\s+(?:minutes|days|weeks)))|on\s+(?:mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?|time|the\s+(?:weekend|bus|train|plane|phone|internet|way|left|right|floor|wall|table|first|second|third)|my\s+birthday|weekdays|weekends)|at\s+(?:night|noon|midnight|dawn|dusk|sunrise|sunset|home|work|school|university|the\s+(?:moment|weekend|office|station|airport|door|corner|end|beginning|same\s+time)|present|\d{1,2}(?::\d{2})?(?:\s*(?:am|pm|o'clock))?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)|for\s+(?:a\s+(?:long\s+time|short\s+time|while|minute|hour|day|week|month|year)|(?:a\s+(?:few|couple\s+of)|\d+|two|three|four|five|six|seven|eight|nine|ten|many|several)\s+(?:more\s+)?(?:seconds|minutes|hours|days|weeks|months|years|decades|centuries|ages|time)|ages|years|months|weeks|days|hours|minutes)|since\s+(?:(?:19|20)\d\d|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|last|morning|noon|childhood|then|january|february|march|april|may|june|july|august|september|october|november|december))\b/i.test(
    en
  );
}

function matchesModalPossibility(en: string): boolean {
  if (/\b(?:may|might)\s+(?:not\s+)?(?:be|have|[a-z]{2,})\b/i.test(en)) return true;
  if (/\bcould\s+(?:have|be)\b/i.test(en)) return true;

  const dedRe = /\b(must|can't|cannot)\s+(?:be|have)\s+([a-z']+)\s*([a-z']*)/gi;
  let m: RegExpExecArray | null;
  while ((m = dedRe.exec(en)) !== null) {
    const modal = m[1]!.toLowerCase();
    const w1 = m[2]!.toLowerCase();
    const w2 = (m[3] ?? '').toLowerCase();
    if (/\bhave\b/i.test(m[0])) {
      if (w1 === 'to') continue;
      return true;
    }
    const candidatePart = CLAUSE_ADVERBS.has(w1) || w1 === 'not' ? w2 : w1;
    const isPassiveParticiple =
      !PARTICIPIAL_ADJECTIVES.has(candidatePart) &&
      !NON_VERB_ED_WORDS.has(candidatePart) &&
      (candidatePart.endsWith('ed') || new RegExp(`^${PASSIVE_V3_PATTERN}$`, 'i').test(candidatePart));

    if (isPassiveParticiple) continue;
    if (modal === 'must' && (MUST_BE_DUTY_ADJS.has(w1) || (w1 === 'in' && w2 === 'possession'))) {
      continue;
    }
    return true;
  }
  return false;
}

function matchesInfinitiveGerund(en: string): boolean {
  const verbGerundRe =
    /\b(?:enjoy|enjoys|enjoyed|avoid|avoids|avoided|finish|finishes|finished|keep|keeps|kept|suggest|suggests|suggested|mind|minds|admit|admits|admitted|deny|denies|denied|delay|delays|delayed|postpone|postpones|postponed|risk|risks|risked|miss|misses|missed|practice|practices|practiced|practise|practises|consider|considers|considered|imagine|imagines|imagined|recommend|recommends|recommended|quit|quits|involve|involves|involved|require|requires|required|beat|beats|appreciate|appreciates|dislike|dislikes|worth|busy|stop|stops|stopped|start|starts|started|begin|begins|began|continue|continues|continued|prefer|prefers|love|loves|like|likes|hate|hates|try|tries|tried|spend(?:s|ing)?\s+(?:time|hours|days|money)|spent\s+(?:time|hours|days|money))\s+([a-z]{2,}ing)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = verbGerundRe.exec(en)) !== null) {
    if (!NON_GERUND_ING_WORDS.has(m[1]!.toLowerCase())) return true;
  }

  const prepGerundRe =
    /\b(?:without|by|instead\s+of|besides|before|after|despite|in\s+spite\s+of|good\s+at|bad\s+at|interested\s+in|tired\s+of|afraid\s+of|worried\s+about|excited\s+about|thinking\s+about|dreaming\s+of|looking\s+forward\s+to|capable\s+of|responsible\s+for|insist(?:s|ed)?\s+on|succeed(?:s|ed)?\s+in|prevent(?:s|ed)?\s+\w+\s+from)\s+([a-z]{2,}ing)\b/gi;
  while ((m = prepGerundRe.exec(en)) !== null) {
    if (!NON_GERUND_ING_WORDS.has(m[1]!.toLowerCase())) return true;
  }

  const subjGerund = /^([A-Z][a-z]{2,}ing)\b/.exec(en.trim());
  if (subjGerund && !NON_GERUND_ING_WORDS.has(subjGerund[1]!.toLowerCase())) return true;

  return /\b(?:want|wants|wanted|decide|decides|decided|hope|hopes|hoped|plan|plans|planned|promise|promises|promised|refuse|refuses|refused|agree|agrees|agreed|learn|learns|learned|need|needs|needed|try|tries|tried|manage|manages|managed|offer|offers|offered|afford|expect|expects|expected|choose|chooses|chose|fail|fails|failed|pretend|pretends|seem|seems|seemed|tend|tends|deserve|deserves|hesitate|hesitates|prepare|prepares|prepared|arrange|arranged|attempt|attempted|claim|claims|wish|wishes|forget|forgets|forgot|remember|remembers|can't\s+wait|cannot\s+wait|would\s+like|would\s+love)\s+(?:(?:me|you|him|her|us|them)\s+)?to\s+[a-z]{2,}\b/i.test(
    en
  );
}

function matchesNegationQuestions(en: string): boolean {
  const trimmed = en.trim();
  const cleanedHaveTo = trimmed.replace(/\b(?:don't|doesn't|didn't|do\s+not|does\s+not|did\s+not)\s+have\s+to\b/gi, '');
  if (/\b(?:don't|doesn't|didn't|do\s+not|does\s+not|did\s+not)\s+[a-z]{2,}\b/i.test(cleanedHaveTo)) {
    return true;
  }
  return (
    trimmed.endsWith('?') &&
    /^(?:do|does|did|are|is|was|were|have|has|can|could|will|would|should)\s+(?:i|you|we|they|he|she|it|there|the\s+[a-z]+|your\s+[a-z]+|this|that)\b/i.test(
      trimmed
    )
  );
}

function matchesWordOrderCue(en: string): boolean {
  return /\b(?:never|always|usually|often|sometimes|rarely|seldom|very\s+much|a\s+lot|every\s+(?:day|morning|evening|night|week|weekend))\b/i.test(
    en
  );
}

/* ==================== 17 EXTRA VOICE-COACH GRAMMAR MATCHERS ==================== */

function matchesPastPerfect(en: string): boolean {
  const fullHadRe = new RegExp(
    `\\b(?:had|hadn't)\\s+(?:(?:not|never|already|just|ever|still|recently|finally|almost|barely|hardly)\\s+){0,2}(${PERFECT_V3_PATTERN}|[a-z]{2,}ed)\\b`,
    'gi'
  );
  let m: RegExpExecArray | null;
  while ((m = fullHadRe.exec(en)) !== null) {
    if (!NON_VERB_ED_WORDS.has(m[1]!.toLowerCase())) return true;
  }

  const contRe = new RegExp(
    `[a-z]+'d\\s+(?:(?:not|never|already|just|ever|still|recently)\\s+){0,2}(been|${UNAMBIGUOUS_PASSIVE_V3}|[a-z]{2,}ed)\\b`,
    'gi'
  );
  while ((m = contRe.exec(en)) !== null) {
    if (!NON_VERB_ED_WORDS.has(m[1]!.toLowerCase())) return true;
  }

  const invRe = new RegExp(
    `^had\\s+(?:i|you|we|they|he|she|it)\\s+(?:not\\s+)?(${PERFECT_V3_PATTERN}|[a-z]{2,}ed)\\b`,
    'i'
  );
  const inv = invRe.exec(en.trim());
  return Boolean(inv && !NON_VERB_ED_WORDS.has(inv[1]!.toLowerCase()));
}

function matchesReportedSpeech(en: string): boolean {
  const thatRe =
    /\b(?:said|told|explained|mentioned|replied|answered|promised|warned|reminded|informed)\s+(?:(?:me|us|him|her|them|you)\s+)?that\s+([a-z']+)(?:\s+([a-z']+))?/gi;
  let tm: RegExpExecArray | null;
  while ((tm = thatRe.exec(en)) !== null) {
    const next1 = tm[1]!.toLowerCase();
    const next2 = (tm[2] ?? '').toLowerCase();
    if (/^(?:himself|herself|myself|yourself|ourselves|yourselves|themselves|too|also|again|before|yesterday|today)$/.test(next1)) {
      continue;
    }
    if (next2 || CONTRACTED_SUBJECT_AUX.has(next1)) {
      return true;
    }
  }

  if (
    /\b(?:said|told|explained|mentioned|replied|answered|promised|warned|reminded|informed)\s+(?:(?:me|us|him|her|them|you)\s+)?(?:i|you|we|they|he|she|it)\s+(?:was|were|had|would|could|didn't|couldn't|wouldn't|should)\b/i.test(
      en
    )
  ) {
    return true;
  }
  return /\b(?:asked|wonder|wonders|wondered|want\s+to\s+know|wanted\s+to\s+know|tell\s+me|told\s+me)\s+(?:(?:me|us|him|her|them|you)\s+)?(?:if|whether|where|when|why|what|who|how)\s+(?:i|you|we|they|he|she|it|i'm|you're|we're|they're|he's|she's|it's|you've|i've|he'll|you'd|the\s+[a-z]+|my\s+[a-z]+|your\s+[a-z]+)\b/i.test(
    en
  );
}

function matchesCauseEffectLinkers(en: string): boolean {
  return (
    /\b(?:because\s+of|because|due\s+to|owing\s+to|therefore|consequently|as\s+a\s+result|in\s+order\s+to|so\s+that)\b/i.test(
      en
    ) || /,\s+so\s+(?:i|you|we|they|he|she|it|there|i'll|we'll|let's)\b/i.test(en)
  );
}

function matchesRelativeClauses(en: string): boolean {
  const trimmed = en.trim();

  const relRe = /\b([a-z]+)(,)?\s+(who|whom|whose|which)\s+([a-z']+)/gi;
  let m: RegExpExecArray | null;
  while ((m = relRe.exec(trimmed)) !== null) {
    const prev = m[1]!.toLowerCase();
    const hasComma = Boolean(m[2]);
    const relWord = m[3]!.toLowerCase();
    const nextWord = m[4]!.toLowerCase();

    if (hasComma && trimmed.endsWith('?') && (relWord === 'who' || relWord === 'whose')) {
      continue;
    }
    if (
      /^(?:about|on|for|at|from|of|by|with|into|matter|ask|asked|wonder|wondered|wondering|know|knew|tell|told|see|saw|decide|decided|remember|forget|forgot|explain|explained|understand|care|guess|curating|choosing|deciding|asking|wondering|knowing|telling|seeing|checking|learning|finding|figuring|saying|me|us|him|her|them|you)$/.test(
        prev
      )
    ) {
      continue;
    }
    if (relWord === 'whose' && /^(?:is|are|was|were)$/.test(nextWord)) {
      continue;
    }
    return true;
  }

  if (
    /\b(?:place|city|town|country|house|home|room|cafe|café|restaurant|school|office|street|park|hotel|shop|store|building|village|island|beach|area|spot|point|studio)\s+where\s+(?:i|you|we|they|he|she|it|people|everyone|the\s+[a-z]+)\b/i.test(
      trimmed
    )
  ) {
    return true;
  }

  return /\b(?:something|anything|nothing|everything|someone|anyone|person|people|things|books|movies|songs|games|friends|man|woman|way|reason|rule|habit|idea|movie|book|song|game|app|tool|system|place|video)\s+that\s+(?:is|are|was|were|has|have|had|can|could|will|would|should|might|makes|helps|shows|gives|takes|keeps|needs|works|lives|i|you|we|they|he|she)\b/i.test(
    trimmed
  );
}

function matchesCanCouldAble(en: string): boolean {
  if (/\b(?:am|is|are|was|were|be|been)\s+(?:not\s+)?able\s+to\b/i.test(en)) return true;
  const stripped = en.replace(
    /\b(?:could\s+(?:be|have)|(?:can't|cannot)\s+be(?!\s+(?:killed|stopped|broken|seen|heard|found|done|made|used|fixed|solved|replaced|removed|changed|avoided|prevented|ignored|denied|measured|trusted|beaten|reached|opened|closed|saved|cured|healed)))\b/gi,
    ''
  );
  return /\b(?:can|can't|cannot|could|couldn't)\b/i.test(stripped);
}

function matchesReflexivesReciprocals(en: string): boolean {
  return /\b(?:myself|yourself|himself|herself|itself|ourselves|yourselves|themselves|each\s+other|one\s+another)\b/i.test(
    en
  );
}

function matchesComparativesSuperlatives(en: string): boolean {
  const cleaned = en.replace(
    /\bas\s+far\s+as\s+(?:i\s+(?:know|remember|can\s+tell|am\s+concerned)|possible)\b/gi,
    ' '
  );

  const compRe =
    /\b(more|less|better|worse|farther|further|[a-z]{3,}er)\s+(?:([a-z]+)\s+)?than\s+([a-z0-9']+)/gi;
  let m: RegExpExecArray | null;
  while ((m = compRe.exec(cleaned)) !== null) {
    const w = m[1]!.toLowerCase();
    const mid = (m[2] ?? '').toLowerCase();
    const afterThan = m[3]!.toLowerCase();
    if (w === 'other' || w === 'rather') continue;
    if (
      (w === 'more' || w === 'less') &&
      !mid &&
      /^(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred|thousand|million|half|once|twice|a)$/.test(
        afterThan
      )
    ) {
      continue;
    }
    return true;
  }

  if (
    /\bthe\s+(?:most|least|best|worst|farthest|furthest|oldest|eldest|youngest|biggest|smallest|fastest|slowest|highest|lowest|longest|shortest|strongest|weakest|heaviest|lightest|cheapest|easiest|hardest|closest|safest|warmest|coldest|hottest|brightest|darkest|quietest|loudest|busiest|happiest|smartest|earliest|latest|tallest|greatest|nearest|nicest|richest|poorest)\b/i.test(
      cleaned
    )
  ) {
    return true;
  }

  return /\bas\s+(?:fast|tall|good|bad|big|small|short|old|young|much|many|early|late|hard|easy|strong|busy|high|low|far|close|warm|cold|hot|bright|clear|clean|safe|important|useful|careful|quiet|loud|quick|simple|happy|smart|rich|cheap|heavy|light)\s+as\b/i.test(
    cleaned
  );
}

function matchesThereIsItIs(en: string): boolean {
  const trimmed = en.trim();

  const thereRe = /\bthere(?:\s+(?:is|are|was|were|isn't|aren't|wasn't|weren't)|'s)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = thereRe.exec(trimmed)) !== null) {
    const before = trimmed.slice(0, m.index).trim().toLowerCase();
    if (!before) return true;
    if (/\b(?:over|up|down|out|right|in|back|from)$/.test(before)) continue;
    if (
      /[,;:.?!—–]$/.test(before) ||
      /\b(?:that|because|if|when|while|since|although|though|so|and|but|or|yet|surely|perhaps|maybe|actually|obviously|apparently|unfortunately|luckily|fortunately|think|thought|know|knew|said|say|saying|believe|suppose|hope|wish|seem|seems|mean|means|wonder|check|see|hear|heard|feel|felt|find|found|notice|noticed|realize|realized|accidents|instead|of|today|now|here|then|still|never|always)$/.test(
        before
      )
    ) {
      return true;
    }
  }

  if (
    trimmed.endsWith('?') &&
    (/(?:^|[,;]\s*)(?:is|are|was|were|isn't|aren't|wasn't|weren't)\s+there\b/i.test(trimmed) ||
      /\b(?:how\s+(?:many|much)|what|why)\b[^?]{0,35}\b(?:is|are|was|were)\s+there\b/i.test(trimmed))
  ) {
    return true;
  }

  return /\bit\s+(?:is|'s|was|isn't|wasn't)\s+(?:(?:so|very|really|quite|too|not|always)\s+)?(?:important|easy|hard|difficult|possible|impossible|better|best|good|great|nice|kind|rude|wise|smart|clever|safe|dangerous|helpful|useful|necessary|essential|worth|common|normal|natural|strange|weird|funny|sad|clear|obvious|fun|boring|tiring|frustrating|exciting|wrong|right|fair|unfair|illegal|legal|free|expensive|cheap|time)\s+(?:for\s+\w+\s+)?to\s+[a-z]{2,}\b/i.test(
    trimmed
  );
}

function matchesQuantifiersCount(en: string): boolean {
  const stripped = en
    .replace(
      /\bmuch\s+(?:more|less|better|worse|bigger|smaller|faster|slower|higher|lower|longer|shorter|stronger|heavier|cheaper|older|younger|easier|harder|closer|warmer|colder|taller|earlier|later|[a-z]{3,}er)\b/gi,
      ' '
    )
    .replace(/\ba\s+little\s+(?:bit|more|less)\b/gi, ' ')
    .replace(/\bas\s+much\s+as\b/gi, ' ');

  return /\b(?:too\s+much|too\s+many|how\s+much|how\s+many|so\s+much|so\s+many|as\s+much\s+[a-z]{2,}\s+as|as\s+many\s+[a-z]{2,}|a\s+lot\s+of|lots\s+of|plenty\s+of|a\s+few|a\s+little\s+(?:time|money|water|sleep|energy|hope|chance|help|progress|information|experience|patience|effort|work|room|space|milk|sugar|salt|coffee|tea|food|luck)|little\s+(?:time|money|water|sleep|energy|hope|chance|help|progress|information|experience|patience|effort|work|room|space|food)|enough\s+[a-z]{2,}|[a-z]{3,}\s+enough|several\s+[a-z]{2,}|many\s+[a-z]{2,}|much\s+(?!of\s+a\b)[a-z]{2,}|few\s+[a-z]{2,}|some\s+[a-z]{2,}|any\s+[a-z]{2,})\b/i.test(
    stripped
  );
}

function matchesPresentContinuous(en: string): boolean {
  const pcRe =
    /(?:^|[\s,;:(])(?:([a-z]+)'(m|s|re)|\b(am|is|are))\s+(?:(?:not|still|currently|always|just|now|slowly|quickly|really|probably)\s+)?([a-z]{2,}ing)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = pcRe.exec(en)) !== null) {
    const host = (m[1] ?? '').toLowerCase();
    const suffix = (m[2] ?? '').toLowerCase();
    const ing = m[4]!.toLowerCase();

    if (suffix === 's' && POSSESSIVE_TIME_OR_NOUN_BEFORE_S.has(host)) continue;
    if (PARTICIPIAL_ING_ADJECTIVES.has(ing) || NON_CONTINUOUS_ING_WORDS.has(ing)) continue;

    const after = en.slice(m.index + m[0].length).trim().toLowerCase();
    if (ing === 'going') {
      const toNext = /^to\s+([a-z']+)/.exec(after);
      const goingIdx = m.index + m[0].length - ing.length;
      if (toNext && !isGoingToPhysicalMovement(en, goingIdx, toNext[1]!, after.slice(3).trim())) {
        continue;
      }
    }
    if (ing === 'getting' && /^used\s+to\b/.test(after)) continue;
    return true;
  }

  const invRe = /\b(?:am|is|are)\s+(?:i|you|we|they|he|she|it)\s+([a-z]{2,}ing)\b/i;
  const inv = invRe.exec(en);
  if (inv) {
    const ing = inv[1]!.toLowerCase();
    if (ing !== 'going' && !PARTICIPIAL_ING_ADJECTIVES.has(ing) && !NON_CONTINUOUS_ING_WORDS.has(ing)) {
      return true;
    }
  }
  return false;
}

function matchesWhQuestions(en: string): boolean {
  return /^(?:what|where|why|when|who|whom|which|whose|how)\b.*\?$/i.test(en.trim());
}

function matchesImperativesLets(en: string): boolean {
  const trimmed = en.trim();
  if (trimmed.endsWith('?')) return false;
  if (/^(?:let's|let\s+us)\s+[a-z]{2,}\b/i.test(trimmed)) return true;

  if (/^[a-z]+-[a-z]+/i.test(trimmed)) return false;

  const prefixMatch = /^(please|always|never|don't|do\s+not)\s+([a-z]+)\b/i.exec(trimmed);
  if (prefixMatch) {
    return IMPERATIVE_START_VERBS.has(prefixMatch[2]!.toLowerCase());
  }

  const startMatch = /^([a-z]+)(?:\s+|$|[.,!;:])/i.exec(trimmed);
  if (!startMatch) return false;
  const verb = startMatch[1]!.toLowerCase();
  if (!IMPERATIVE_START_VERBS.has(verb)) return false;

  if (IMPERATIVE_HOMOGRAPH_STARTERS.has(verb)) {
    const firstClause = trimmed.split(/[,;:.!—–]/)[0] ?? trimmed;
    const words = tokenizeWords(firstClause);
    const second = words[1] ?? '';
    // `Verb + Det/ObjectPronoun/Particle` ("Check your notes", "Lock your screen", "Clean it", "Plug in...") is always imperative
    if (
      DETERMINER_WORDS.has(second) ||
      /^(?:me|us|him|her|it|them|yourself|yourselves|up|down|in|out|off|on|away|back|over|around|through)$/.test(
        second
      )
    ) {
      return true;
    }
    for (let i = 1; i < Math.min(words.length, 5); i += 1) {
      const w = words[i]!;
      const prev = words[i - 1]!;
      if (/^(?:and|or|before|after|when|whenever|while|if|unless|so|because|until|till|that|what|where|how|who)$/.test(w)) {
        break;
      }
      if (DETERMINER_WORDS.has(prev)) continue;
      if (FINITE_AUXILIARY_WORDS.has(w) || isKnown3sgVerb(w) || isActiveFinitePastVerb(w, prev)) {
        return false;
      }
    }
  }
  return true;
}

function matchesSimplePast(en: string): boolean {
  const stripped = en
    // 0. Strip case-sensitive acronyms (`LED`) & proper-name / noun homographs of irregular V2 verbs
    .replace(/\bLED\b/g, 'light')
    .replace(/^Rose\s+(?=(?:is|was|has|had|will|would|can|could|[a-z]+s)\b)/, 'She ')
    .replace(/\b(?:a|one|every|little|tiny|small)\s+(?:little\s+)?bit\b/gi, ' ')
    .replace(/\b(?:a|an|the|one|two|three|my|your|his|her|its|our|their|flu|long|good|best|last|first|final|only)\s+shot\b/gi, ' ')
    .replace(/\b(?:on\s+the|to\s+the|turn|turned|turning|the|my|your|his|her|its|our|their|far|upper|lower)\s+left\b/gi, ' ')
    .replace(/\b(?:nothing|anything|something|none|no\s+[a-z]+|time|minutes?|hours?|days?|weeks?|months?|years?|sugar|milk|food|money|room|space|paper|battery|power|energy|gas|fuel|water|coffee)\s+left\b/gi, ' ')
    .replace(/\b(?:when|if|while)\s+left\b/gi, ' ')
    .replace(/\b(?:a|an|the|red|white|yellow|pink|my|your|his|her)\s+rose\b/gi, ' ')
    .replace(/\b(?:a|an|the|chain|hand|power|table|circular)\s+saw\b/gi, ' ')
    // 1. `have/has/had/haven't/hasn't/hadn't/'ve/'d + (adv)* + been + (adv)* + V3` (Perfect Passive)
    .replace(
      new RegExp(
        `\\b(?:have|has|had|haven't|hasn't|hadn't|[a-z]+'ve|[a-z]+'d)\\s+(?:(?:not|n't|never|ever|just|already|still|recently|finally|always|often|even|both)\\s+){0,2}been\\s+(?:(?:not|never|always|often|usually|just|already|still|recently|finally|quickly|carefully|slowly|completely|totally|mostly|widely|easily|badly|heavily|seriously|officially|originally|commonly|strictly|newly)\\s+){0,2}(?:${PASSIVE_V3_PATTERN}|[a-z]{2,}ed)\\b`,
        'gi'
      ),
      ' '
    )
    // 2. Active Present/Past Perfect
    .replace(
      new RegExp(
        `\\b(?:have|has|had|haven't|hasn't|hadn't|[a-z]+'ve|[a-z]+'d)\\s+(?:(?:not|n't|never|ever|just|already|still|recently|finally|always|often|even|both)\\s+){0,2}(?:${PERFECT_V3_PATTERN}|[a-z]{2,}ed)\\b`,
        'gi'
      ),
      ' '
    )
    // 3. Inverted Present/Past Perfect questions
    .replace(
      new RegExp(
        `\\b(?:have|has|had)\\s+(?:i|you|we|they|he|she|it|anybody|anyone|someone|everyone)\\s+(?:(?:ever|never|already|just|not|still|recently|been)\\s+){0,3}(?:${PERFECT_V3_PATTERN}|[a-z]{2,}ed)\\b`,
        'gi'
      ),
      ' '
    )
    // 4. Passive & stative `be + (adv)* + V3` and inverted passive questions
    .replace(
      new RegExp(
        `\\b(?:am|is|are|was|were|wasn't|weren't|isn't|aren't|be|been|being|[a-z]+'m|[a-z]+'s|[a-z]+'re)\\s+(?:(?:not|never|always|often|usually|just|already|still|recently|finally|quickly|carefully|slowly|completely|totally|mostly|widely|easily|badly|heavily|seriously|officially|originally|commonly|strictly|currently|frequently|newly|very|really|quite|both|all|so|too|being)\\s+){0,2}(?:${PASSIVE_V3_PATTERN}|[a-z]{2,}ed)\\b`,
        'gi'
      ),
      ' '
    )
    .replace(
      new RegExp(
        `\\b(?:am|is|are|was|were)\\s+(?:i|you|we|they|he|she|it|this|that|these|those|(?:the|my|your|his|her|our|their)\\s+[a-z]+)\\s+(?:being\\s+)?(?:${PASSIVE_V3_PATTERN}|[a-z]{2,}ed)\\b`,
        'gi'
      ),
      ' '
    )
    // 5. Modal perfects & `used to`
    .replace(
      /\b(?:should|shouldn't|would|wouldn't|could|couldn't|might|may|must)\s+(?:not\s+)?have\s+(?:been\s+)?[a-z']+\b/gi,
      ' '
    )
    .replace(/\b(?:used\s+to|didn't\s+use\s+to|did\s+not\s+use\s+to)\b/gi, ' ')
    // 6. Causatives & participial modifiers
    .replace(
      /\b(?:have|has|get|gets|need|needs|want|wants)\s+(?:(?:my|your|his|her|its|our|their|the|a|an|this|that|it|them)\s+(?:[a-z]+\s+){0,2})?[a-z]{3,}ed\b/gi,
      ' '
    )
    .replace(/\bno\s+[a-z]{2,}ing\s+allowed\b/gi, ' ')
    .replace(
      /\b(?:though|although|when|if|once|with\s+(?:his|her|my|your|our|their)\s+[a-z]+)\s+(?:(?:seriously|badly|heavily|slightly|tightly)\s+)?[a-z]{3,}ed\b/gi,
      ' '
    );

  if (/\b(?:didn't|did\s+not|did\s+(?:i|you|we|they|he|she|it|[a-z]+))\b/i.test(stripped)) {
    return true;
  }
  if (IRREGULAR_V2_RE.test(stripped)) {
    return true;
  }
  if (
    /\b(?:i|you|we|they|he|she)\s+read\b/i.test(stripped) &&
    /\b(?:yesterday|last\s+(?:night|week|month|year|summer|winter|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|ago)\b/i.test(
      en
    )
  ) {
    return true;
  }

  const regPastRe = /\b([a-z']+)\s+([a-z]{3,}ed)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = regPastRe.exec(stripped)) !== null) {
    const prev = m[1]!.toLowerCase();
    const w = m[2]!.toLowerCase();
    if (DETERMINER_WORDS.has(prev) || prev === 'to' || prev === 'very' || prev === 'so' || prev === 'too' || prev === 'quite') {
      continue;
    }
    if (isActiveFinitePastVerb(w, prev)) {
      return true;
    }
  }
  return false;
}

function matchesSimplePresent(en: string): boolean {
  const trimmed = en.trim();
  if (trimmed.endsWith('?') || matchesImperativesLets(trimmed)) return false;

  if (
    matchesSimplePast(trimmed) ||
    matchesPastContinuous(trimmed) ||
    matchesPastPerfect(trimmed) ||
    matchesUsedToHabit(trimmed) ||
    matchesWasVsWere(trimmed) ||
    matchesPresentPerfect(trimmed) ||
    matchesGoingToVsWill(trimmed) ||
    matchesShouldVsHaveTo(trimmed) ||
    matchesCanCouldAble(trimmed) ||
    matchesModalPossibility(trimmed) ||
    /\b(?:would|wouldn't)\b/i.test(trimmed)
  ) {
    return false;
  }

  if (
    /\b(?:i\s+am|i'm|he\s+is|he's|she\s+is|she's|it\s+is|it's|we\s+are|we're|you\s+are|you're|they\s+are|they're|[a-z]+\s+(?:is|are|isn't|aren't))\b/i.test(
      trimmed
    ) &&
    !matchesPresentContinuous(trimmed) &&
    !matchesPassiveVoice(trimmed)
  ) {
    return true;
  }

  const pronVerbRe =
    /\b(?:i|you|we|they)\s+(?:(?:never|always|usually|often|sometimes|rarely|really|still|also)\s+)?([a-z']+)\b/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pronVerbRe.exec(trimmed)) !== null) {
    const v = pm[1]!.toLowerCase();
    if (
      !FINITE_AUXILIARY_WORDS.has(v) &&
      !DETERMINER_WORDS.has(v) &&
      v !== 'used' &&
      !v.endsWith('ed') &&
      !v.includes("'")
    ) {
      return true;
    }
  }

  const words = tokenizeWords(trimmed);
  for (let i = 1; i < words.length; i += 1) {
    const w = words[i]!;
    const prev = words[i - 1]!;
    if (DETERMINER_WORDS.has(prev) || prev === 'to' || prev.endsWith("'s")) continue;
    if (isKnown3sgVerb(w)) return true;
    if (isPluralSubjectSlice(words, i) && COMMON_BASE_VERBS.has(w)) return true;
  }

  return false;
}

function matchesArticles(en: string): boolean {
  return /\b(?:a|an|the)\s+[a-z]{2,}\b/i.test(en);
}

/* ==================== UNIFIED DISPATCHERS ==================== */

/**
 * Evaluate whether an English sentence genuinely exemplifies one of the 18 core Remedial skills.
 */
export function matchesGrammarSkill(skillId: WeakSkillId, en: string): boolean {
  const text = en.trim();
  if (!text) return false;

  switch (skillId) {
    case 'was_vs_were':
      return matchesWasVsWere(text);
    case 'should_vs_have_to':
      return matchesShouldVsHaveTo(text);
    case 'used_to_habit':
      return matchesUsedToHabit(text);
    case 'past_continuous':
      return matchesPastContinuous(text);
    case 'present_perfect':
      return matchesPresentPerfect(text);
    case 'passive_voice':
      return matchesPassiveVoice(text);
    case 'going_to_vs_will':
      return matchesGoingToVsWill(text);
    case 'conditionals_would':
      return matchesConditionalsWould(text);
    case 'contrast_linkers':
      return matchesContrastLinkers(text);
    case 'time_clauses':
      return matchesTimeClauses(text);
    case 'phrasal_verbs':
      return matchesPhrasalVerbs(text);
    case 'prepositions_core':
      return matchesPrepositionsCore(text);
    case 'modal_possibility':
      return matchesModalPossibility(text);
    case 'infinitive_gerund':
      return matchesInfinitiveGerund(text);
    case 'negation_questions':
      return matchesNegationQuestions(text);
    case 'word_order_syntax':
      return matchesWordOrderCue(text);
    case 'listening_gap':
      return /\b(?:can't|won't|didn't|has\s+been|have\s+been|going\s+to|want\s+to|a\s+lot\s+of|there's|it's)\b/i.test(
        text
      );
    case 'trouble_vocab':
      return true;
  }
}

/**
 * Evaluate whether an English sentence exemplifies one of the 17 extra voice-coach grammar rules.
 */
export function matchesExtraGrammarRule(ruleId: ExtraGrammarRuleId, en: string): boolean {
  const text = en.trim();
  if (!text) return false;

  switch (ruleId) {
    case 'simple_present':
      return matchesSimplePresent(text);
    case 'articles_a_an_the':
      return matchesArticles(text);
    case 'simple_past':
      return matchesSimplePast(text);
    case 'can_could_able':
      return matchesCanCouldAble(text);
    case 'quantifiers_count':
      return matchesQuantifiersCount(text);
    case 'present_continuous':
      return matchesPresentContinuous(text);
    case 'wh_questions':
      return matchesWhQuestions(text);
    case 'imperatives_lets':
      return matchesImperativesLets(text);
    case 'comparatives_superlatives':
      return matchesComparativesSuperlatives(text);
    case 'relative_clauses':
      return matchesRelativeClauses(text);
    case 'reflexives_reciprocals':
      return matchesReflexivesReciprocals(text);
    case 'there_is_it_is':
      return matchesThereIsItIs(text);
    case 'reported_speech':
      return matchesReportedSpeech(text);
    case 'be_get_used_to':
      return matchesBeGetUsedTo(text);
    case 'cause_effect_linkers':
      return matchesCauseEffectLinkers(text);
    case 'past_perfect':
      return matchesPastPerfect(text);
    case 'time_place_prepositions_extra':
      return hasTimePrepositionPhrase(text);
  }
}

export function matchesVoiceCoachRule(ruleId: VoiceCoachRuleId, en: string): boolean {
  if (
    ruleId === 'simple_present' ||
    ruleId === 'articles_a_an_the' ||
    ruleId === 'simple_past' ||
    ruleId === 'can_could_able' ||
    ruleId === 'quantifiers_count' ||
    ruleId === 'present_continuous' ||
    ruleId === 'wh_questions' ||
    ruleId === 'imperatives_lets' ||
    ruleId === 'comparatives_superlatives' ||
    ruleId === 'relative_clauses' ||
    ruleId === 'reflexives_reciprocals' ||
    ruleId === 'there_is_it_is' ||
    ruleId === 'reported_speech' ||
    ruleId === 'be_get_used_to' ||
    ruleId === 'cause_effect_linkers' ||
    ruleId === 'past_perfect' ||
    ruleId === 'time_place_prepositions_extra'
  ) {
    return matchesExtraGrammarRule(ruleId, en);
  }
  return matchesGrammarSkill(ruleId, en);
}

const REMEDIAL_PRIORITY_ORDER: readonly WeakSkillId[] = [
  'conditionals_would',
  'contrast_linkers',
  'used_to_habit',
  'passive_voice',
  'past_continuous',
  'present_perfect',
  'time_clauses',
  'phrasal_verbs',
  'should_vs_have_to',
  'modal_possibility',
  'going_to_vs_will',
  'infinitive_gerund',
  'prepositions_core',
  'negation_questions',
  'was_vs_were',
];

function pruneRedundantWasWere(matched: VoiceCoachRuleId[], text: string): void {
  if (
    !matched.includes('was_vs_were') ||
    (!matched.includes('past_continuous') &&
      !matched.includes('passive_voice') &&
      !matched.includes('conditionals_would') &&
      !matched.includes('there_is_it_is'))
  ) {
    return;
  }
  const withoutAux = text
    .replace(/\b(?:was|were|wasn't|weren't)\s+(?:not\s+|still\s+|always\s+|just\s+)?[a-z]{2,}ing\b/gi, '')
    .replace(/\b(?:was|were|wasn't|weren't)\s+(?:i|you|we|they|he|she|it)\s+[a-z]{2,}ing\b/gi, '')
    .replace(/\bif\s+(?:i|he|she|it)\s+were\b/gi, '')
    .replace(/\bthere\s+(?:was|were|wasn't|weren't)\b/gi, '')
    .replace(
      new RegExp(
        `\\b(?:was|were|wasn't|weren't)\\s+(?:(?:not|never|always|often|usually|just|already|still|recently|finally|quickly|carefully|slowly|completely|totally|mostly|widely|easily|badly|heavily|seriously|officially|originally|commonly|strictly|being)\\s+){0,2}(?:${PASSIVE_V3_PATTERN}|[a-z]{2,}ed)\\b`,
        'gi'
      ),
      ''
    );
  if (!/\b(?:was|were|wasn't|weren't)\b/i.test(withoutAux)) {
    const idx = matched.indexOf('was_vs_were');
    if (idx >= 0) matched.splice(idx, 1);
  }
}

/**
 * Return matching 18-skill Remedial grammar IDs for weakness diagnosis & card selection.
 */
export function analyzeEnglishGrammarSkills(en: string): WeakSkillId[] {
  const text = en.trim();
  if (!text) return [];

  const matched: WeakSkillId[] = [];
  for (const skillId of REMEDIAL_PRIORITY_ORDER) {
    if (matchesGrammarSkill(skillId, text)) {
      matched.push(skillId);
    }
  }
  pruneRedundantWasWere(matched, text);
  return matched;
}

const VOICE_TIER_1_ORDER: readonly VoiceCoachRuleId[] = [
  'conditionals_would',
  'be_get_used_to',
  'used_to_habit',
  'past_perfect',
  'reported_speech',
  'passive_voice',
  'contrast_linkers',
  'cause_effect_linkers',
  'past_continuous',
  'present_perfect',
  'time_clauses',
  'phrasal_verbs',
  'relative_clauses',
  'should_vs_have_to',
  'modal_possibility',
  'can_could_able',
  'going_to_vs_will',
  'reflexives_reciprocals',
  'comparatives_superlatives',
  'there_is_it_is',
  'infinitive_gerund',
  'time_place_prepositions_extra',
  'prepositions_core',
  'quantifiers_count',
  'present_continuous',
  'wh_questions',
  'imperatives_lets',
];

const VOICE_TIER_2_ORDER: readonly VoiceCoachRuleId[] = [
  'negation_questions',
  'was_vs_were',
  'simple_past',
  'simple_present',
];

/**
 * Analyze an English sentence across ALL 35 voice-coach rules, ordered from most specific
 * structural patterns to broad core tenses and contextual article/word-order helpers.
 */
export function analyzeVoiceCoachRules(en: string): VoiceCoachRuleId[] {
  const text = en.trim();
  if (!text) return [];

  const matched: VoiceCoachRuleId[] = [];
  for (const ruleId of VOICE_TIER_1_ORDER) {
    if (matchesVoiceCoachRule(ruleId, text)) {
      matched.push(ruleId);
    }
  }
  for (const ruleId of VOICE_TIER_2_ORDER) {
    if (matchesVoiceCoachRule(ruleId, text)) {
      matched.push(ruleId);
    }
  }

  pruneRedundantWasWere(matched, text);

  if (matched.includes('conditionals_would') && matched.includes('simple_past')) {
    const idx = matched.indexOf('simple_past');
    if (idx >= 0) matched.splice(idx, 1);
  }

  if (matched.includes('there_is_it_is') && matched.includes('simple_present') && matched.length >= 2) {
    const idx = matched.indexOf('simple_present');
    if (idx >= 0) matched.splice(idx, 1);
  }

  if (
    matched.includes('wh_questions') &&
    matched.includes('negation_questions') &&
    !/\b(?:don't|doesn't|didn't|do\s+not|does\s+not|did\s+not)\b/i.test(text)
  ) {
    const idx = matched.indexOf('negation_questions');
    if (idx >= 0) matched.splice(idx, 1);
  }

  if (matched.length < 2 && matchesArticles(text)) {
    matched.push('articles_a_an_the');
  }

  return matched;
}
