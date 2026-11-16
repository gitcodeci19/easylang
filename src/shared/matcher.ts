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
    if (dist <= allowedEdits && similarity >= 0.78) {
      return {
        isCorrect: true,
        matchKind: 'fuzzy',
        matchedTranslation: candidate,
        similarity,
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
