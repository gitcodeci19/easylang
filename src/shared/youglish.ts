const COMMON_PROPER_NAMES = new Set([
  'tom',
  'mary',
  'john',
  'alice',
  'bob',
  'jane',
  'jack',
  'sam',
  'jim',
  'ann',
  'anna',
  'dan',
  'mike',
  'david',
  'sarah',
  'paul',
  'peter',
  'mark',
  'lisa',
  'nancy',
  'susan',
  'karen',
  'betty',
  'helen',
  'sandra',
  'boston',
  'chicago',
  'london',
  'paris',
  'tokyo',
  'berlin',
  'rome',
  'madrid',
  'moscow',
  'australia',
  'canada',
]);

/** Words that are legitimately capitalized inside a sentence and are NOT proper nouns to strip. */
const ALLOWED_CAPITALIZED_WORDS = new Set([
  'I',
  "I'm",
  "I've",
  "I'll",
  "I'd",
  'English',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]);

const CORE_VERB_OR_GRAMMAR_RE =
  /\b(want|need|have|has|had|get|got|go|going|went|gone|come|coming|make|made|take|took|know|think|thought|say|said|see|saw|look|use|used|find|give|tell|told|work|call|try|ask|feel|seem|leave|put|mean|keep|let|begin|help|talk|turn|start|show|hear|play|run|move|like|live|believe|hold|bring|happen|write|provide|sit|stand|lose|pay|meet|include|continue|set|learn|change|lead|understand|watch|follow|stop|create|speak|read|allow|add|spend|grow|open|walk|win|offer|remember|love|consider|appear|buy|wait|serve|die|send|expect|build|stay|fall|cut|reach|kill|remain|suggest|raise|pass|sell|require|report|decide|pull|would|could|should|might|must|can't|don't|didn't|won't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|doesn't)\b/i;

function stripPunctuationKeepApostrophe(token: string): string {
  return token
    .replace(/[’‘]/g, "'")
    .replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, '');
}

function isProperNounToken(cleanedWord: string, isSentenceStart: boolean): boolean {
  if (!cleanedWord) return false;
  const baseLower = cleanedWord.replace(/'s$/i, '').toLowerCase();
  if (COMMON_PROPER_NAMES.has(baseLower)) {
    return true;
  }
  if (isSentenceStart) {
    return false;
  }
  if (ALLOWED_CAPITALIZED_WORDS.has(cleanedWord)) {
    return false;
  }
  // Mid-sentence capitalized word (e.g. "Mr.", "Smith", "Seattle") is treated as a proper noun
  return /^[A-Z][a-z]+/.test(cleanedWord);
}

function scoreContiguousSegment(words: string[]): number {
  if (words.length === 0) return -100;
  const joined = words.join(' ');
  let score = words.length * 10;

  // Sweet spot on YouGlish is 4 to 6 words
  if (words.length >= 4 && words.length <= 6) {
    score += 30;
  } else if (words.length === 3 || words.length === 7) {
    score += 18;
  } else if (words.length < 2) {
    score -= 40;
  }

  const verbMatches = joined.match(new RegExp(CORE_VERB_OR_GRAMMAR_RE.source, 'gi'))?.length ?? 0;
  score += verbMatches * 14;
  return score;
}

/**
 * Transforms an English sentence or word into a high-hit YouGlish search query:
 * 1. Strips all sentence punctuation (`?`, `.`, `!`, `,`, quotes) that causes YouGlish 0-result errors.
 * 2. Removes proper nouns (`Tom`, `Mary`, `Boston`, mid-sentence names) that prevent exact video matches,
 *    keeping the natural contiguous English phrase around them (e.g. `"I want to go talk to Tom."` -> `"I want to go talk to"`).
 * 3. For long sentences (> 7 words), extracts the strongest 5–6 word verb/collocation window so YouGlish
 *    consistently finds real YouTube clips.
 */
export function buildSmartYouGlishQuery(rawText: string): string {
  const rawTokens = rawText.trim().split(/\s+/).filter(Boolean);
  const cleanedTokens = rawTokens
    .map(stripPunctuationKeepApostrophe)
    .filter(Boolean);

  if (cleanedTokens.length === 0) {
    return rawText.replace(/[?.!,;:"“”()[\]]+/g, '').trim();
  }

  if (cleanedTokens.length <= 2) {
    return cleanedTokens.join(' ');
  }

  // Split tokens into contiguous proper-noun-free segments
  const segments: string[][] = [];
  let current: string[] = [];

  for (let i = 0; i < cleanedTokens.length; i += 1) {
    const word = cleanedTokens[i]!;
    if (isProperNounToken(word, i === 0)) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
    } else {
      current.push(word);
    }
  }
  if (current.length > 0) {
    segments.push(current);
  }

  // Pick the highest-scoring contiguous proper-noun-free segment
  let bestSegment = cleanedTokens;
  if (segments.length > 0) {
    segments.sort((a, b) => scoreContiguousSegment(b) - scoreContiguousSegment(a));
    bestSegment = segments[0]!;
  }

  // If the chosen segment is longer than 7 words, pick the best 5-word or 6-word window
  const maxWindow = 6;
  if (bestSegment.length > 7) {
    let bestWindow = bestSegment.slice(0, maxWindow);
    let bestScore = -Infinity;
    for (let winLen = 5; winLen <= maxWindow; winLen += 1) {
      for (let start = 0; start + winLen <= bestSegment.length; start += 1) {
        const candidate = bestSegment.slice(start, start + winLen);
        const s = scoreContiguousSegment(candidate);
        if (s > bestScore) {
          bestScore = s;
          bestWindow = candidate;
        }
      }
    }
    bestSegment = bestWindow;
  }

  return bestSegment.join(' ');
}

export function buildYouGlishUrl(rawText: string): { query: string; url: string } {
  const query = buildSmartYouGlishQuery(rawText);
  return {
    query,
    url: `https://youglish.com/pronounce/${encodeURIComponent(query)}/english`,
  };
}

/** Check if a sentence contains synthetic corpus names like Tom/Mary so natural sentences can be preferred. */
export function hasSyntheticProperName(sentence: string): boolean {
  return /\b(Tom|Mary|Boston)\b/.test(sentence);
}
