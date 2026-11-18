import type { AnswerEvaluation, CardType } from './types';

const TR_DIACRITIC_MAP: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  İ: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
};

const TR_STOP_WORDS = new Set([
  'bir',
  've',
  'ile',
  'de',
  'da',
  'ki',
  'mi',
  'mı',
  'mu',
  'mü',
  'bu',
  'şu',
  'o',
  'ben',
  'sen',
  'biz',
  'siz',
]);

/**
 * Normalize Turkish text for comparison: lowercase using tr-TR locale,
 * remove parenthetical notes and punctuation, and collapse whitespace.
 */
export function normalizeTurkish(input: string): string {
  return input
    .toLocaleLowerCase('tr-TR')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/['"`’“”.,!?;:()\[\]{}\-_/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fold Turkish diacritics to ASCII equivalents so minor keyboard misses still match. */
export function foldTurkishDiacritics(input: string): string {
  return normalizeTurkish(input).replace(/[çğıİöşüâîû]/g, (ch) => TR_DIACRITIC_MAP[ch] ?? ch);
}

/** Standard Levenshtein edit distance between two short strings. */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    const chA = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j += 1) {
      const cost = chA === b.charCodeAt(j - 1) ? 0 : 1;
      const del = (prev[j] ?? 0) + 1;
      const ins = (curr[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j] ?? 0;
    }
  }

  return prev[b.length] ?? 0;
}

/** Return true if two equal-length words differ only by a single adjacent letter swap (e.g. "spcae" vs "space"). */
function isAdjacentTransposition(a: string, b: string): boolean {
  if (a.length !== b.length || a.length < 4) return false;
  let foundSwap = false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === b[i]) continue;
    if (foundSwap) return false;
    if (i + 1 < a.length && a[i] === b[i + 1] && a[i + 1] === b[i]) {
      foundSwap = true;
      i += 1;
    } else {
      return false;
    }
  }
  return foundSwap;
}

/** Allow small prefix matching for Turkish agglutinative suffixes (e.g., "gitmek" vs "gitme"). */
function stemOverlapScore(userTokens: string[], targetTokens: string[]): number {
  const filteredUser = userTokens.filter((t) => !TR_STOP_WORDS.has(t));
  const filteredTarget = targetTokens.filter((t) => !TR_STOP_WORDS.has(t));
  const u = filteredUser.length > 0 ? filteredUser : userTokens;
  const t = filteredTarget.length > 0 ? filteredTarget : targetTokens;

  if (u.length === 0 || t.length === 0) return 0;

  let matched = 0;
  for (const targetTok of t) {
    const found = u.some((userTok) => {
      if (userTok === targetTok) return true;
      const minLen = Math.min(userTok.length, targetTok.length);
      if (minLen >= 4) {
        const prefixLen = Math.min(4, minLen);
        if (userTok.slice(0, prefixLen) === targetTok.slice(0, prefixLen)) {
          return true;
        }
      }
      return levenshteinDistance(userTok, targetTok) <= 1 && minLen >= 4;
    });
    if (found) matched += 1;
  }

  // Symmetric recall + precision harmonic mean so single lucky word doesn't pass a long sentence
  const recall = matched / t.length;
  const precision = matched / u.length;
  if (recall + precision === 0) return 0;
  return (2 * recall * precision) / (recall + precision);
}

/**
 * Evaluate a user's Turkish translation against accepted answers.
 * Applies exact/normalized match, ASCII diacritic folding, typo tolerance,
 * and token-stem overlap for multi-word sentences.
 */
export function evaluateTurkishAnswer(
  userInput: string,
  acceptedAnswers: string[],
  cardType: CardType
): AnswerEvaluation {
  const rawTrimmed = userInput.trim();
  const normUser = normalizeTurkish(rawTrimmed);
  const foldedUser = foldTurkishDiacritics(rawTrimmed);

  if (!normUser) {
    return { isCorrect: false, matchKind: 'none', matchedTranslation: null, similarity: 0 };
  }

  // If the user typed multiple comma/slash-separated synonyms (e.g. "uzay, alan"), accept if any segment matches
  if (/[,;/]/.test(rawTrimmed)) {
    const segments = rawTrimmed
      .split(/[,;/]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    if (segments.length > 1) {
      for (const seg of segments) {
        const segEval = evaluateSingleTurkishSegment(seg, acceptedAnswers, cardType);
        if (segEval.isCorrect) return segEval;
      }
    }
  }

  return evaluateSingleTurkishSegment(rawTrimmed, acceptedAnswers, cardType);
}

function evaluateSingleTurkishSegment(
  rawTrimmed: string,
  acceptedAnswers: string[],
  cardType: CardType
): AnswerEvaluation {
  const normUser = normalizeTurkish(rawTrimmed);
  const foldedUser = foldTurkishDiacritics(rawTrimmed);

  let bestScore = 0;
  let bestTarget: string | null = null;

  for (const candidate of acceptedAnswers) {
    const normCand = normalizeTurkish(candidate);
    if (!normCand) continue;

    if (rawTrimmed.toLocaleLowerCase('tr-TR') === candidate.trim().toLocaleLowerCase('tr-TR')) {
      return {
        isCorrect: true,
        matchKind: 'exact',
        matchedTranslation: candidate,
        similarity: 1,
      };
    }

    if (normUser === normCand || foldedUser === foldTurkishDiacritics(candidate)) {
      return {
        isCorrect: true,
        matchKind: 'normalized',
        matchedTranslation: candidate,
        similarity: 1,
      };
    }

    // Typo tolerance on folded strings
    const foldedCand = foldTurkishDiacritics(candidate);
    const maxLen = Math.max(foldedUser.length, foldedCand.length);
    const dist = levenshteinDistance(foldedUser, foldedCand);
    const similarity = maxLen > 0 ? 1 - dist / maxLen : 0;

    if (similarity > bestScore) {
      bestScore = similarity;
      bestTarget = candidate;
    }

    const allowedEdits = cardType === 'word' ? (maxLen >= 8 ? 2 : maxLen >= 4 ? 1 : 0) : Math.floor(maxLen * 0.18);
    if ((dist <= allowedEdits && similarity >= 0.78) || isAdjacentTransposition(foldedUser, foldedCand)) {
      return {
        isCorrect: true,
        matchKind: 'fuzzy',
        matchedTranslation: candidate,
        similarity: Math.max(similarity, 0.85),
      };
    }

    // Sentence or multi-word phrase token overlap
    if (cardType === 'sentence' || normCand.includes(' ')) {
      const userTokens = foldedUser.split(' ').filter(Boolean);
      const candTokens = foldedCand.split(' ').filter(Boolean);
      const overlap = stemOverlapScore(userTokens, candTokens);
      if (overlap > bestScore) {
        bestScore = overlap;
        bestTarget = candidate;
      }
      if (overlap >= 0.65) {
        return {
          isCorrect: true,
          matchKind: 'overlap',
          matchedTranslation: candidate,
          similarity: overlap,
        };
      }
    }
  }

  return {
    isCorrect: false,
    matchKind: 'none',
    matchedTranslation: bestTarget,
    similarity: bestScore,
  };
}

const EN_CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bcan't\b/gi, 'cannot'],
  [/\bcan\s+not\b/gi, 'cannot'],
  [/\bwon't\b/gi, 'will not'],
  [/\bshan't\b/gi, 'shall not'],
  [/([a-z])n't\b/gi, '$1 not'],
  [/\bi'm\b/gi, 'i am'],
  [/\byou're\b/gi, 'you are'],
  [/\bwe're\b/gi, 'we are'],
  [/\bthey're\b/gi, 'they are'],
  [/\bi've\b/gi, 'i have'],
  [/\byou've\b/gi, 'you have'],
  [/\bwe've\b/gi, 'we have'],
  [/\bthey've\b/gi, 'they have'],
  [/\bi'll\b/gi, 'i will'],
  [/\byou'll\b/gi, 'you will'],
  [/\bhe'll\b/gi, 'he will'],
  [/\bshe'll\b/gi, 'she will'],
  [/\bit'll\b/gi, 'it will'],
  [/\bwe'll\b/gi, 'we will'],
  [/\bthey'll\b/gi, 'they will'],
  [/\bit's\b/gi, 'it is'],
  [/\bthat's\b/gi, 'that is'],
  [/\bthere's\b/gi, 'there is'],
  [/\bhere's\b/gi, 'here is'],
  [/\bwhat's\b/gi, 'what is'],
  [/\bwho's\b/gi, 'who is'],
];

/** Normalize English text (lowercase, expand contractions, strip punctuation). */
export function normalizeEnglish(input: string): string {
  let s = input.toLowerCase().replace(/[’`]/g, "'");
  for (const [re, rep] of EN_CONTRACTIONS) {
    s = s.replace(re, rep);
  }
  return s
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[.,!?;:"'()\[\]{}\-_/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Evaluate a user's English translation locally (used ahead of AI check in TR->EN mode).
 * Keeps fuzzy overlap threshold high (>= 0.85) so paraphrased answers escalate to AI cleanly.
 */
export function evaluateEnglishAnswer(
  userInput: string,
  acceptedEnglish: string[],
  cardType: CardType
): AnswerEvaluation {
  const normUser = normalizeEnglish(userInput);
  if (!normUser) {
    return { isCorrect: false, matchKind: 'none', matchedTranslation: null, similarity: 0 };
  }

  let bestScore = 0;
  let bestTarget: string | null = null;
  const userWithoutTo = normUser.replace(/^to\s+/, '');

  for (const cand of acceptedEnglish) {
    const normCand = normalizeEnglish(cand);
    if (!normCand) continue;

    if (userInput.trim().toLowerCase() === cand.trim().toLowerCase()) {
      return { isCorrect: true, matchKind: 'exact', matchedTranslation: cand, similarity: 1 };
    }

    const candWithoutTo = normCand.replace(/^to\s+/, '');
    if (normUser === normCand || (cardType === 'word' && userWithoutTo === candWithoutTo)) {
      return { isCorrect: true, matchKind: 'normalized', matchedTranslation: cand, similarity: 1 };
    }

    const maxLen = Math.max(normUser.length, normCand.length);
    const dist = levenshteinDistance(normUser, normCand);
    const sim = maxLen > 0 ? 1 - dist / maxLen : 0;
    if (sim > bestScore) {
      bestScore = sim;
      bestTarget = cand;
    }

    if (
      (cardType === 'word' && maxLen >= 5 && dist <= 1 && sim >= 0.8) ||
      isAdjacentTransposition(normUser, normCand)
    ) {
      return { isCorrect: true, matchKind: 'fuzzy', matchedTranslation: cand, similarity: Math.max(sim, 0.85) };
    }

    if (cardType === 'sentence' && maxLen >= 10 && dist <= Math.min(2, Math.floor(maxLen * 0.08)) && sim >= 0.88) {
      return { isCorrect: true, matchKind: 'fuzzy', matchedTranslation: cand, similarity: sim };
    }
  }

  return {
    isCorrect: false,
    matchKind: 'none',
    matchedTranslation: bestTarget,
    similarity: bestScore,
  };
}
