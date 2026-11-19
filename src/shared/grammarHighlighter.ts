import {
  isActiveFinitePastVerb,
  isKnown3sgVerb,
  isSubordinatorFollowedByFiniteClause,
  PASSIVE_V3_PATTERN,
  PERFECT_V3_PATTERN,
  PHRASAL_VERB_RE,
  UNAMBIGUOUS_PASSIVE_V3,
} from './grammarAnalyzer.ts';
import {
  CLAUSE_ADVERBS,
  COMMON_BASE_VERBS,
  DETERMINER_WORDS,
  IMPERATIVE_START_VERBS,
  NON_CONTINUOUS_ING_WORDS,
  NON_GERUND_ING_WORDS,
  NON_VERB_ED_WORDS,
  PARTICIPIAL_ADJECTIVES,
  PARTICIPIAL_ING_ADJECTIVES,
  SUBJECT_PRONOUNS,
} from './grammarLexicon.ts';
import type { VoiceCoachRuleId } from './types';

export interface HighlightSpan {
  start: number;
  end: number;
}

const STOPWORDS_FOR_VOCAB = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'than', 'that', 'this', 'these', 'those',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'not', 'no', 'yes',
  'in', 'on', 'at', 'to', 'for', 'from', 'with', 'about', 'by', 'of', 'into', 'over', 'after', 'before',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'very', 'just', 'so', 'too', 'also', 'here', 'there',
]);

function collectRegexSpans(
  text: string,
  pattern: RegExp,
  filter?: (m: RegExpExecArray) => boolean,
  groupIndex?: number
): HighlightSpan[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  const spans: HighlightSpan[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!m[0]) {
      re.lastIndex += 1;
      continue;
    }
    if (filter && !filter(m)) continue;
    if (groupIndex !== undefined && m[groupIndex] !== undefined) {
      const sub = m[groupIndex]!;
      const rel = m[0].indexOf(sub);
      if (rel >= 0) {
        spans.push({ start: m.index + rel, end: m.index + rel + sub.length });
        continue;
      }
    }
    spans.push({ start: m.index, end: m.index + m[0].length });
  }
  return spans;
}

function mergeSpans(spans: HighlightSpan[]): HighlightSpan[] {
  if (spans.length <= 1) return spans;
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: HighlightSpan[] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i]!;
    const prev = merged[merged.length - 1]!;
    if (cur.start <= prev.end) {
      prev.end = Math.max(prev.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

function spansOverlap(a: HighlightSpan, b: HighlightSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

function findWasVsWereSpans(text: string): HighlightSpan[] {
  const all = collectRegexSpans(text, /\b(?:was|were|wasn't|weren't)\b/gi);
  if (all.length <= 1) return all;

  // Prefer non-auxiliary occurrences (exclude past continuous / passive / if-were / there-was)
  const auxSpans = mergeSpans([
    ...collectRegexSpans(
      text,
      /\b(?:was|were|wasn't|weren't)\s+(?:not\s+|still\s+|always\s+|just\s+)?[a-z]{2,}ing\b/gi
    ),
    ...collectRegexSpans(text, /\bif\s+(?:i|he|she|it)\s+were\b/gi),
    ...collectRegexSpans(text, /\bthere\s+(?:was|were|wasn't|weren't)\b/gi),
    ...findPassiveVoiceSpans(text),
  ]);
  const standalone = all.filter((s) => !auxSpans.some((a) => spansOverlap(s, a)));
  return standalone.length > 0 ? standalone : all;
}

function findPastContinuousSpans(text: string): HighlightSpan[] {
  return mergeSpans([
    ...collectRegexSpans(
      text,
      /\b(?:was|were|wasn't|weren't)\s+(?:(?:not|still|always|just|already|quietly|slowly)\s+)?([a-z]{2,}ing)\b/gi,
      (m) => !NON_CONTINUOUS_ING_WORDS.has(m[1]!.toLowerCase())
    ),
    ...collectRegexSpans(
      text,
      /\b(?:was|were|wasn't|weren't)\s+(?:i|you|we|they|he|she|it)\s+([a-z]{2,}ing)\b/gi,
      (m) => !NON_CONTINUOUS_ING_WORDS.has(m[1]!.toLowerCase())
    ),
  ]);
}

function findPresentContinuousSpans(text: string): HighlightSpan[] {
  const goingToSpans = collectRegexSpans(text, /\bgoing\s+to\s+[a-z]{2,}\b/gi);
  const raw = mergeSpans([
    ...collectRegexSpans(
      text,
      /(?:\b(?:am|is|are|isn't|aren't)|(?:i'm|you're|we're|they're|he's|she's|it's))\s+(?:(?:not|still|always|just|currently|now|really|already)\s+)?([a-z]{2,}ing)\b/gi,
      (m) => {
        const ing = m[1]!.toLowerCase();
        return !NON_CONTINUOUS_ING_WORDS.has(ing) && !PARTICIPIAL_ING_ADJECTIVES.has(ing);
      }
    ),
    ...collectRegexSpans(
      text,
      /\b(?:am|is|are|isn't|aren't)\s+(?:i|you|we|they|he|she|it)\s+(?:(?:still|currently|now|not)\s+)?([a-z]{2,}ing)\b/gi,
      (m) => {
        const ing = m[1]!.toLowerCase();
        return !NON_CONTINUOUS_ING_WORDS.has(ing) && !PARTICIPIAL_ING_ADJECTIVES.has(ing);
      }
    ),
  ]);
  const filtered = raw.filter((s) => !goingToSpans.some((g) => spansOverlap(s, g)));
  return filtered.length > 0 ? filtered : raw;
}

function findPassiveVoiceSpans(text: string): HighlightSpan[] {
  const passiveRe = new RegExp(
    `\\b(?:am|is|are|was|were|isn't|aren't|wasn't|weren't|be|been|being|get|gets|got|gotten|getting)\\s+(?:(?:not|never|always|often|usually|just|already|still|recently|finally|quickly|carefully|slowly|completely|totally|mostly|widely|easily|badly|heavily|seriously|officially|originally|commonly|strictly|being)\\s+){0,2}(${PASSIVE_V3_PATTERN}|[a-z]{2,}ed)\\b`,
    'gi'
  );
  return collectRegexSpans(text, passiveRe, (m) => {
    const part = m[1]!.toLowerCase();
    if (PARTICIPIAL_ADJECTIVES.has(part) || NON_VERB_ED_WORDS.has(part)) return false;
    if (part === 'used') {
      const after = text.slice(m.index + m[0].length).trimStart().toLowerCase();
      if (/^to\s+(?:the|a|an|this|that|my|your|his|her|its|our|their|[a-z]+ing)\b/.test(after)) {
        return false;
      }
    }
    return true;
  });
}

function findPresentPerfectSpans(text: string): HighlightSpan[] {
  const v3 = `(${PERFECT_V3_PATTERN}|[a-z]{2,}ed)`;
  return mergeSpans([
    ...collectRegexSpans(
      text,
      new RegExp(
        `(?:\\b(?:have|has|haven't|hasn't)|[a-z]+'ve)\\s+(?:(?:not|never|ever|already|just|always|recently|still|finally|almost|barely|hardly|really)\\s+){0,2}${v3}\\b`,
        'gi'
      ),
      (m) => !NON_VERB_ED_WORDS.has(m[1]!.toLowerCase())
    ),
    ...collectRegexSpans(
      text,
      new RegExp(
        `\\b(?:he's|she's|it's|that's|there's|who's|what's)\\s+(?:(?:not|never|ever|already|just|always|recently|still)\\s+){0,2}(been|got|gotten|${UNAMBIGUOUS_PASSIVE_V3}|[a-z]{2,}ed)\\b`,
        'gi'
      ),
      (m) => {
        const w = m[1]!.toLowerCase();
        return !NON_VERB_ED_WORDS.has(w) && !PARTICIPIAL_ADJECTIVES.has(w);
      }
    ),
    ...collectRegexSpans(
      text,
      new RegExp(
        `\\b(?:have|has|haven't|hasn't)\\s+(?:i|you|we|they|he|she|it)\\s+(?:(?:ever|never|already|just|not|yet|still)\\s+){0,2}${v3}\\b`,
        'gi'
      ),
      (m) => !NON_VERB_ED_WORDS.has(m[1]!.toLowerCase())
    ),
  ]);
}

function findPastPerfectSpans(text: string): HighlightSpan[] {
  const v3 = `(${PERFECT_V3_PATTERN}|[a-z]{2,}ed)`;
  return mergeSpans([
    ...collectRegexSpans(
      text,
      new RegExp(
        `\\b(?:had|hadn't)\\s+(?:(?:not|never|already|just|ever|still|recently|finally|almost|barely|hardly)\\s+){0,2}${v3}\\b`,
        'gi'
      ),
      (m) => !NON_VERB_ED_WORDS.has(m[1]!.toLowerCase())
    ),
    ...collectRegexSpans(
      text,
      new RegExp(
        `[a-z]+'d\\s+(?:(?:not|never|already|just|ever|still|recently)\\s+){0,2}(been|${UNAMBIGUOUS_PASSIVE_V3}|[a-z]{2,}ed)\\b`,
        'gi'
      ),
      (m) => !NON_VERB_ED_WORDS.has(m[1]!.toLowerCase())
    ),
    ...collectRegexSpans(
      text,
      new RegExp(`\\bhad\\s+(?:i|you|we|they|he|she|it)\\s+(?:not\\s+)?${v3}\\b`, 'gi'),
      (m) => !NON_VERB_ED_WORDS.has(m[1]!.toLowerCase())
    ),
  ]);
}

function findUsedToHabitSpans(text: string): HighlightSpan[] {
  const beGetUsed = findBeGetUsedToSpans(text);
  const raw = mergeSpans([
    ...collectRegexSpans(text, /\b(?:didn't|did\s+not)\s+use\s+to\s+[a-z']+\b/gi),
    ...collectRegexSpans(text, /\bdid\s+(?:i|you|he|she|it|we|they)\s+use\s+to\s+[a-z']+\b/gi),
    ...collectRegexSpans(text, /\bused\s+to\s+[a-z']+\b/gi),
  ]);
  return raw.filter((s) => !beGetUsed.some((b) => spansOverlap(s, b)));
}

function findBeGetUsedToSpans(text: string): HighlightSpan[] {
  return collectRegexSpans(
    text,
    /(?:\b(?:am|is|are|was|were|isn't|aren't|wasn't|weren't|be|been|being|get|gets|got|gotten|getting|become|becomes|became)|[a-z]+(?:'m|'s|'re))\s+(?:(?:not|never|already|still|finally|slowly|gradually|really|quite|very)\s+)?used\s+to(?:\s+[a-z']+)?\b/gi
  );
}

function findGoingToVsWillSpans(text: string): HighlightSpan[] {
  return mergeSpans([
    ...collectRegexSpans(
      text,
      /(?:(?:\b(?:am|is|are|was|were|isn't|aren't|wasn't|weren't)|[a-z]+(?:'m|'s|'re))\s+(?:not\s+)?)?\bgoing\s+to\s+([a-z']+)\b/gi,
      (m) => !DETERMINER_WORDS.has(m[1]!.toLowerCase())
    ),
    ...collectRegexSpans(text, /\bgonna\s+[a-z']+\b/gi),
    ...collectRegexSpans(
      text,
      /(?:\b(?:will|won't)|[a-z]+'ll)\s+(?:(?:not|probably|definitely|always|never|still|soon|just|be)\s+)?[a-z']+\b/gi
    ),
  ]);
}

function findShouldVsHaveToSpans(text: string): HighlightSpan[] {
  return mergeSpans([
    ...collectRegexSpans(
      text,
      /\b(?:don't|doesn't|didn't|do\s+not|does\s+not|did\s+not|will|won't)?\s*(?:have|has|had)\s+to\s+[a-z']+\b/gi
    ),
    ...collectRegexSpans(
      text,
      /\b(?:should|shouldn't|ought\s+to|must|mustn't|need\s+to|needs\s+to|needed\s+to|don't\s+need\s+to|doesn't\s+need\s+to)\s+(?:not\s+)?[a-z']+\b/gi
    ),
    ...collectRegexSpans(text, /\b(?:should|shouldn't|ought\s+to|must|mustn't|have\s+to|has\s+to|had\s+to)\b/gi),
  ]);
}

function findModalPossibilitySpans(text: string): HighlightSpan[] {
  return mergeSpans([
    ...collectRegexSpans(text, /\b(?:may|might|could)\s+(?:not\s+)?(?:have\s+[a-z']+|be\s+[a-z']+|[a-z']+)\b/gi),
    ...collectRegexSpans(text, /\b(?:must|can't|cannot)\s+(?:have|be)\s+(?:not\s+)?[a-z']+\b/gi),
  ]);
}

function findCanCouldAbleSpans(text: string): HighlightSpan[] {
  return mergeSpans([
    ...collectRegexSpans(
      text,
      /(?:\b(?:will|won't|may|might|should|would|am|is|are|was|were|be|been|have\s+been|has\s+been)\s+(?:not\s+)?)?\b(?:able|unable)\s+to\s+[a-z']+\b/gi
    ),
    ...collectRegexSpans(text, /\b(?:can|can't|cannot|could|couldn't)\s+(?:not\s+)?[a-z']+\b/gi),
    ...collectRegexSpans(text, /\b(?:can|can't|cannot|could|couldn't|able\s+to|unable\s+to)\b/gi),
  ]);
}

function findConditionalsWouldSpans(text: string): HighlightSpan[] {
  return mergeSpans([
    ...collectRegexSpans(text, /\bif\s+(?:i|he|she|it)\s+were\b/gi),
    ...collectRegexSpans(text, /\b(?:if|unless|provided\s+that|as\s+long\s+as|in\s+case|even\s+if|wish(?:es|ed)?)\b/gi),
    ...collectRegexSpans(
      text,
      /(?:\b(?:would|wouldn't|could|might)|[a-z]+'d)\s+(?:not\s+)?(?:have\s+[a-z']+|[a-z']+)\b/gi
    ),
  ]);
}

function findContrastLinkersSpans(text: string): HighlightSpan[] {
  return collectRegexSpans(
    text,
    /\b(?:even\s+though|in\s+spite\s+of|on\s+the\s+other\s+hand|instead\s+of|although|though|despite|however|whereas|nevertheless|nonetheless|unless|while|yet|but)\b/gi
  );
}

function findCauseEffectLinkersSpans(text: string): HighlightSpan[] {
  return collectRegexSpans(
    text,
    /\b(?:because\s+of|as\s+a\s+result|due\s+to|owing\s+to|so\s+that|that's\s+why|because|therefore|consequently|hence|thus|since|so)\b/gi
  );
}

function findTimeClausesSpans(text: string): HighlightSpan[] {
  const subRe = /\b(as\s+soon\s+as|by\s+the\s+time|until|till|before|after|when|whenever|once|while)\s+([^,;.?!—–]+)/gi;
  const spans: HighlightSpan[] = [];
  let m: RegExpExecArray | null;
  while ((m = subRe.exec(text)) !== null) {
    const sub = m[1]!;
    if (isSubordinatorFollowedByFiniteClause(text, m.index, sub.length)) {
      spans.push({ start: m.index, end: m.index + sub.length });
    }
  }
  return spans;
}

function findTimePlacePrepositionsExtraSpans(text: string): HighlightSpan[] {
  const prepRe =
    /\b(in\s+front\s+of|next\s+to|out\s+of|before|after|until|till|during|within|between|among|without|across|through|behind|beside|above|below|under|over|near|around|along|towards?|into|onto)\b/gi;
  const spans: HighlightSpan[] = [];
  let m: RegExpExecArray | null;
  while ((m = prepRe.exec(text)) !== null) {
    const prep = m[1]!.toLowerCase();
    // Skip `before/after/until/till` when it introduces a finite time clause rather than a noun phrase
    if (
      (prep === 'before' || prep === 'after' || prep === 'until' || prep === 'till') &&
      isSubordinatorFollowedByFiniteClause(text, m.index, m[1]!.length)
    ) {
      continue;
    }
    spans.push({ start: m.index, end: m.index + m[1]!.length });
  }
  return spans;
}

function findPrepositionsCoreSpans(text: string): HighlightSpan[] {
  const specific = collectRegexSpans(
    text,
    /\b(?:in\s+(?:the\s+(?:morning|afternoon|evening|past|future|end|middle|city|country|world|room|kitchen|car|park|office)|(?:19|20)\d\d|january|february|march|april|may|june|july|august|september|october|november|december|(?:the\s+)?(?:spring|summer|autumn|fall|winter)|a\s+(?:minute|moment|week|month|year|day|few\s+(?:minutes|days|weeks)))|on\s+(?:mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?|time|the\s+(?:weekend|bus|train|plane|phone|internet|way|left|right|floor|wall|table|first|second|third)|my\s+birthday|weekdays|weekends)|at\s+(?:night|noon|midnight|dawn|dusk|sunrise|sunset|home|work|school|university|the\s+(?:moment|weekend|office|station|airport|door|corner|end|beginning|same\s+time)|present|\d{1,2}(?::\d{2})?(?:\s*(?:am|pm|o'clock))?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)|for\s+(?:a\s+(?:long\s+time|short\s+time|while|minute|hour|day|week|month|year)|(?:a\s+(?:few|couple\s+of)|\d+|two|three|four|five|six|seven|eight|nine|ten|many|several)\s+(?:more\s+)?(?:seconds|minutes|hours|days|weeks|months|years|decades|centuries|ages|time)|ages|years|months|weeks|days|hours|minutes)|since\s+(?:(?:19|20)\d\d|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|last|morning|noon|childhood|then|january|february|march|april|may|june|july|august|september|october|november|december))\b/gi
  );
  if (specific.length > 0) return specific;

  // Exclude infinitive `to + base verb`
  return collectRegexSpans(text, /\b(in|on|at|for|since|from|with|about|by|of|to)\b/gi, (m) => {
    if (m[1]!.toLowerCase() !== 'to') return true;
    const nextMatch = /^\s+([a-z']+)/i.exec(text.slice(m.index + m[0].length));
    const nextWord = nextMatch?.[1]?.toLowerCase() ?? '';
    return !COMMON_BASE_VERBS.has(nextWord);
  });
}

function findInfinitiveGerundSpans(text: string): HighlightSpan[] {
  const spans: HighlightSpan[] = [];

  // 1. Verb + gerund
  spans.push(
    ...collectRegexSpans(
      text,
      /\b(?:enjoy|enjoys|enjoyed|avoid|avoids|avoided|finish|finishes|finished|keep|keeps|kept|suggest|suggests|suggested|mind|minds|admit|admits|admitted|deny|denies|denied|delay|delays|delayed|postpone|postpones|postponed|risk|risks|risked|miss|misses|missed|practice|practices|practiced|practise|practises|consider|considers|considered|imagine|imagines|imagined|recommend|recommends|recommended|quit|quits|involve|involves|involved|require|requires|required|appreciate|appreciates|dislike|dislikes|worth|busy|stop|stops|stopped|start|starts|started|begin|begins|began|continue|continues|continued|prefer|prefers|love|loves|like|likes|hate|hates|try|tries|tried|spend(?:s|ing)?\s+(?:time|hours|days|money)|spent\s+(?:time|hours|days|money))\s+([a-z]{2,}ing)\b/gi,
      (m) => !NON_GERUND_ING_WORDS.has(m[1]!.toLowerCase())
    )
  );

  // 2. Preposition + gerund
  spans.push(
    ...collectRegexSpans(
      text,
      /\b(?:without|by|instead\s+of|besides|before|after|despite|in\s+spite\s+of|good\s+at|bad\s+at|interested\s+in|tired\s+of|afraid\s+of|worried\s+about|excited\s+about|thinking\s+about|dreaming\s+of|looking\s+forward\s+to|capable\s+of|responsible\s+for|insist(?:s|ed)?\s+on|succeed(?:s|ed)?\s+in)\s+([a-z]{2,}ing)\b/gi,
      (m) => !NON_GERUND_ING_WORDS.has(m[1]!.toLowerCase())
    )
  );

  // 3. Subject gerund at start of sentence ("Drinking cold water...")
  const subj = /^(\s*)([A-Z][a-z]{2,}ing)\b/.exec(text);
  if (subj && !NON_GERUND_ING_WORDS.has(subj[2]!.toLowerCase())) {
    const start = subj[1]!.length;
    spans.push({ start, end: start + subj[2]!.length });
  }

  // 4. `to + V1` infinitives (skipping `going to`, `used to`, `have/has/had to`, `ought to`)
  const excludedTo = mergeSpans([
    ...collectRegexSpans(text, /\b(?:going|used|use|have|has|had|ought|able|unable)\s+to\b/gi),
  ]);
  const infSpans = collectRegexSpans(text, /\bto\s+([a-z]{2,})\b/gi, (m) => {
    const verb = m[1]!.toLowerCase();
    if (DETERMINER_WORDS.has(verb) || SUBJECT_PRONOUNS.has(verb)) return false;
    if (excludedTo.some((ex) => spansOverlap(ex, { start: m.index, end: m.index + 2 }))) {
      return false;
    }
    return COMMON_BASE_VERBS.has(verb) || !NON_VERB_ED_WORDS.has(verb);
  });
  spans.push(...infSpans);

  return mergeSpans(spans);
}

function findNegationQuestionsSpans(text: string): HighlightSpan[] {
  const spans: HighlightSpan[] = [
    ...collectRegexSpans(
      text,
      /\b(?:don't|doesn't|didn't|do\s+not|does\s+not|did\s+not|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|won't|can't|cannot|couldn't|shouldn't|wouldn't|mustn't|not|never)\b/gi
    ),
  ];
  if (text.trim().endsWith('?')) {
    spans.push(
      ...collectRegexSpans(
        text,
        /^\s*(?:do|does|did|are|is|am|was|were|have|has|had|can|could|will|would|should)\b/gi
      )
    );
  }
  return mergeSpans(spans);
}

function findWhQuestionsSpans(text: string): HighlightSpan[] {
  return collectRegexSpans(
    text,
    /\b(?:how\s+(?:many|much|long|often|far|old|well|fast)|what\s+time|what\s+kind\s+of|what|where|when|why|who|whom|whose|which|how)(?:\s+(?:do|does|did|am|is|are|was|were|have|has|had|will|would|can|could|should))?\b/gi,
    (m) => text.includes('?') || m.index === 0
  );
}

function findImperativesLetsSpans(text: string): HighlightSpan[] {
  const explicit = mergeSpans([
    ...collectRegexSpans(text, /\b(?:let's|let\s+us)\s+(?:not\s+)?[a-z']+\b/gi),
    ...collectRegexSpans(text, /^\s*(?:please\s+)?(?:don't|do\s+not|never)\s+[a-z']+\b/gi),
    ...collectRegexSpans(text, /^\s*please\s+[a-z']+\b/gi),
  ]);
  if (explicit.length > 0) return explicit;

  const first = /^\s*([A-Za-z']+)/.exec(text);
  if (first) {
    const word = first[1]!.toLowerCase();
    if (IMPERATIVE_START_VERBS.has(word) || COMMON_BASE_VERBS.has(word)) {
      const start = text.indexOf(first[1]!);
      return [{ start, end: start + first[1]!.length }];
    }
  }
  return [];
}

function findComparativesSuperlativesSpans(text: string): HighlightSpan[] {
  return mergeSpans([
    ...collectRegexSpans(text, /\bthe\s+(?:most|least)\s+[a-z-]+\b/gi),
    ...collectRegexSpans(text, /\bthe\s+(?:best|worst|farthest|furthest|[a-z]{3,}est)\b/gi),
    ...collectRegexSpans(text, /\b(?:more|less)\s+[a-z-]+(?:\s+than)?\b/gi),
    ...collectRegexSpans(text, /\b(?:better|worse|farther|further|older|younger|bigger|smaller|faster|slower|easier|harder|cheaper|higher|lower|longer|shorter|stronger|weaker|warmer|colder|hotter|cleaner|safer|healthier|happier|busier|closer|sooner|later|earlier|deeper|wider|louder|quieter|smarter|richer|poorer|nicer|taller|heavier|lighter|brighter|darker|simpler)(?:\s+than)?\b/gi),
    ...collectRegexSpans(text, /\bas\s+[a-z-]+\s+as\b/gi),
  ]);
}

function findRelativeClausesSpans(text: string): HighlightSpan[] {
  return collectRegexSpans(text, /\b(who|whom|whose|which|that|where|when)\b/gi, (m) => {
    if (m.index < 3) return false;
    const before = text.slice(0, m.index).trim();
    if (before.endsWith('?') || before.endsWith('!')) return false;
    return true;
  });
}

function findReflexivesReciprocalsSpans(text: string): HighlightSpan[] {
  return collectRegexSpans(
    text,
    /\b(?:myself|yourself|himself|herself|itself|ourselves|yourselves|themselves|each\s+other|one\s+another)\b/gi
  );
}

function findThereIsItIsSpans(text: string): HighlightSpan[] {
  return mergeSpans([
    ...collectRegexSpans(
      text,
      /\b(?:there(?:'s|'re|\s+(?:is|are|was|were|isn't|aren't|wasn't|weren't|will\s+be|has\s+been|have\s+been|might\s+be|should\s+be))|(?:is|are|was|were)\s+there)\b/gi
    ),
    ...collectRegexSpans(
      text,
      /\b(?:it's|it\s+(?:is|was|isn't|wasn't|takes|took|seems|seemed|feels|felt|looks|sounds))\b/gi
    ),
  ]);
}

function findReportedSpeechSpans(text: string): HighlightSpan[] {
  return collectRegexSpans(
    text,
    /\b(?:said|told|asked|explained|mentioned|replied|answered|promised|warned|reminded|informed|admitted|claimed|wondered|wanted\s+to\s+know)(?:\s+(?:me|us|him|her|them|you))?(?:\s+(?:that|if|whether|to|not\s+to))?\b/gi
  );
}

function findQuantifiersCountSpans(text: string): HighlightSpan[] {
  return collectRegexSpans(
    text,
    /\b(?:a\s+lot\s+of|lots\s+of|plenty\s+of|too\s+much|too\s+many|a\s+few|a\s+little|a\s+couple\s+of|most\s+of|all\s+of|none\s+of|some\s+of|any\s+of|much|many|few|little|some|any|several|enough|every|each|both|either|neither)\b/gi
  );
}

function findSimplePastSpans(text: string): HighlightSpan[] {
  const excluded = mergeSpans([
    ...findPresentPerfectSpans(text),
    ...findPastPerfectSpans(text),
    ...findPassiveVoiceSpans(text),
  ]);
  const spans: HighlightSpan[] = [
    ...collectRegexSpans(text, /\b(?:did|didn't|did\s+not)\b/gi),
  ];

  const wordRe = /\b([A-Za-z']+)\b/g;
  let prevWord = '';
  let m: RegExpExecArray | null;
  while ((m = wordRe.exec(text)) !== null) {
    const raw = m[1]!;
    const lower = raw.toLowerCase();
    const span = { start: m.index, end: m.index + raw.length };
    if (
      !excluded.some((ex) => spansOverlap(ex, span)) &&
      lower !== 'was' &&
      lower !== 'were' &&
      lower !== 'had' &&
      lower !== 'did' &&
      isActiveFinitePastVerb(lower, prevWord)
    ) {
      spans.push(span);
    }
    prevWord = lower;
  }

  return mergeSpans(spans);
}

function findSimplePresentSpans(text: string): HighlightSpan[] {
  const excluded = mergeSpans([
    ...findPresentContinuousSpans(text),
    ...findPresentPerfectSpans(text),
    ...findPassiveVoiceSpans(text),
    ...findGoingToVsWillSpans(text),
  ]);

  const spans: HighlightSpan[] = [
    ...collectRegexSpans(text, /\b(?:do|does|don't|doesn't)\b/gi),
  ];

  const wordRe = /\b([A-Za-z']+)\b/g;
  let prevWord = '';
  let m: RegExpExecArray | null;
  while ((m = wordRe.exec(text)) !== null) {
    const raw = m[1]!;
    const lower = raw.toLowerCase();
    const span = { start: m.index, end: m.index + raw.length };

    if (!excluded.some((ex) => spansOverlap(ex, span))) {
      if (isKnown3sgVerb(lower) && !DETERMINER_WORDS.has(prevWord)) {
        spans.push(span);
      } else if (
        (lower === 'am' || lower === 'is' || lower === 'are' || lower === "isn't" || lower === "aren't") &&
        prevWord !== 'there'
      ) {
        spans.push(span);
      } else if (
        (prevWord === 'i' || prevWord === 'you' || prevWord === 'we' || prevWord === 'they') &&
        COMMON_BASE_VERBS.has(lower)
      ) {
        spans.push(span);
      }
    }
    prevWord = lower;
  }

  return mergeSpans(spans);
}

function findWordOrderSpans(text: string): HighlightSpan[] {
  const cues = collectRegexSpans(
    text,
    /\b(?:never|always|usually|often|sometimes|rarely|seldom|already|still|just|very\s+much|a\s+lot|every\s+(?:day|morning|evening|night|week|weekend))\b/gi
  );
  if (cues.length > 0) return cues;
  // Fallback: highlight the opening subject + verb pair
  return collectRegexSpans(text, /^\s*[A-Za-z']+\s+[A-Za-z']+\b/i);
}

function findTroubleVocabSpans(text: string): HighlightSpan[] {
  const words = collectRegexSpans(text, /\b[A-Za-z'-]{3,}\b/g);
  if (words.length <= 2) return words;
  const contentWords = words.filter((s) => {
    const w = text.slice(s.start, s.end).toLowerCase();
    return !STOPWORDS_FOR_VOCAB.has(w) && w.length >= 5;
  });
  if (contentWords.length > 0) {
    // Highlight up to the 2 longest / most salient vocabulary words
    const ranked = [...contentWords].sort(
      (a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start
    );
    return mergeSpans(ranked.slice(0, 2));
  }
  return words.slice(0, 2);
}

function findListeningGapSpans(text: string): HighlightSpan[] {
  const linked = mergeSpans([
    ...collectRegexSpans(text, /\b[a-z]+(?:'ve|'ll|'d|'re|'m|'s|n't)\b/gi),
    ...collectRegexSpans(text, /\b(?:going\s+to|want\s+to|have\s+to|used\s+to|out\s+of|a\s+lot\s+of|kind\s+of|sort\s+of)\b/gi),
  ]);
  if (linked.length > 0) return linked;
  return findTroubleVocabSpans(text);
}

/**
 * Find exact character spans within an English sentence that exemplify `ruleId`.
 * Covers all 35 Voice Coach grammar rules exhaustively.
 */
export function findRuleHighlightSpans(sentence: string, ruleId: VoiceCoachRuleId): HighlightSpan[] {
  if (!sentence.trim()) return [];

  switch (ruleId) {
    case 'was_vs_were':
      return findWasVsWereSpans(sentence);
    case 'articles_a_an_the':
      return collectRegexSpans(sentence, /\b(?:a|an|the)\b/gi);
    case 'past_continuous':
      return findPastContinuousSpans(sentence);
    case 'present_continuous':
      return findPresentContinuousSpans(sentence);
    case 'passive_voice':
      return findPassiveVoiceSpans(sentence);
    case 'present_perfect':
      return findPresentPerfectSpans(sentence);
    case 'past_perfect':
      return findPastPerfectSpans(sentence);
    case 'used_to_habit':
      return findUsedToHabitSpans(sentence);
    case 'be_get_used_to':
      return findBeGetUsedToSpans(sentence);
    case 'going_to_vs_will':
      return findGoingToVsWillSpans(sentence);
    case 'should_vs_have_to':
      return findShouldVsHaveToSpans(sentence);
    case 'modal_possibility':
      return findModalPossibilitySpans(sentence);
    case 'can_could_able':
      return findCanCouldAbleSpans(sentence);
    case 'conditionals_would':
      return findConditionalsWouldSpans(sentence);
    case 'contrast_linkers':
      return findContrastLinkersSpans(sentence);
    case 'cause_effect_linkers':
      return findCauseEffectLinkersSpans(sentence);
    case 'time_clauses':
      return findTimeClausesSpans(sentence);
    case 'time_place_prepositions_extra':
      return findTimePlacePrepositionsExtraSpans(sentence);
    case 'prepositions_core':
      return findPrepositionsCoreSpans(sentence);
    case 'phrasal_verbs':
      return collectRegexSpans(sentence, PHRASAL_VERB_RE);
    case 'infinitive_gerund':
      return findInfinitiveGerundSpans(sentence);
    case 'negation_questions':
      return findNegationQuestionsSpans(sentence);
    case 'wh_questions':
      return findWhQuestionsSpans(sentence);
    case 'imperatives_lets':
      return findImperativesLetsSpans(sentence);
    case 'comparatives_superlatives':
      return findComparativesSuperlativesSpans(sentence);
    case 'relative_clauses':
      return findRelativeClausesSpans(sentence);
    case 'reflexives_reciprocals':
      return findReflexivesReciprocalsSpans(sentence);
    case 'there_is_it_is':
      return findThereIsItIsSpans(sentence);
    case 'reported_speech':
      return findReportedSpeechSpans(sentence);
    case 'quantifiers_count':
      return findQuantifiersCountSpans(sentence);
    case 'simple_past':
      return findSimplePastSpans(sentence);
    case 'simple_present':
      return findSimplePresentSpans(sentence);
    case 'word_order_syntax':
      return findWordOrderSpans(sentence);
    case 'trouble_vocab':
      return findTroubleVocabSpans(sentence);
    case 'listening_gap':
      return findListeningGapSpans(sentence);
  }
}

/**
 * Render `sentence` inside `container`, wrapping tokens matching `ruleId` in glowing `<mark>` elements.
 * Passing `ruleId = null` cleanly resets the container to plain text.
 */
export function renderHighlightedSentence(
  container: HTMLElement,
  sentence: string,
  ruleId: VoiceCoachRuleId | null,
  markClass: string = 'etr-rule-glow'
): void {
  if (!ruleId) {
    container.textContent = sentence;
    return;
  }

  const spans = findRuleHighlightSpans(sentence, ruleId);
  if (spans.length === 0) {
    container.textContent = sentence;
    return;
  }

  const frag = document.createDocumentFragment();
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor) {
      frag.appendChild(document.createTextNode(sentence.slice(cursor, span.start)));
    }
    const mark = document.createElement('mark');
    mark.className = markClass;
    mark.textContent = sentence.slice(span.start, span.end);
    frag.appendChild(mark);
    cursor = span.end;
  }
  if (cursor < sentence.length) {
    frag.appendChild(document.createTextNode(sentence.slice(cursor)));
  }

  container.replaceChildren(frag);
}

/**
 * Highlight an arbitrary exact phrase (e.g. from AI Grammar Coach `focusPhrase`) inside `sentence`.
 * Case-insensitive whole-word match first, falling back to substring match; clears when `phrase` is empty.
 */
export function renderHighlightedPhrase(
  container: HTMLElement,
  sentence: string,
  phrase: string | null,
  markClass: string = 'etr-rule-glow is-ai'
): void {
  const target = phrase?.trim();
  if (!target) {
    container.textContent = sentence;
    return;
  }

  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let spans = collectRegexSpans(sentence, new RegExp(`\\b${escaped}\\b`, 'gi'));
  if (spans.length === 0) {
    spans = collectRegexSpans(sentence, new RegExp(escaped, 'gi'));
  }
  if (spans.length === 0) {
    container.textContent = sentence;
    return;
  }

  const frag = document.createDocumentFragment();
  let cursor = 0;
  for (const span of mergeSpans(spans)) {
    if (span.start > cursor) {
      frag.appendChild(document.createTextNode(sentence.slice(cursor, span.start)));
    }
    const mark = document.createElement('mark');
    mark.className = markClass;
    mark.textContent = sentence.slice(span.start, span.end);
    frag.appendChild(mark);
    cursor = span.end;
  }
  if (cursor < sentence.length) {
    frag.appendChild(document.createTextNode(sentence.slice(cursor)));
  }
  container.replaceChildren(frag);
}
