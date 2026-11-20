import type { AnalyticsSummary } from '../shared/analytics';
import { autoTagEnglishQuotesForCoach } from '../shared/bilingualTtsSplit.ts';
import {
  getAiLanguagePromptName,
  resolveSupportedLanguage,
  type SupportedLanguageCode,
} from '../shared/i18n.ts';
import {
  buildFallbackRoadmapCoachBanner,
  LESSON_KIND_LABELS,
  summarizeRecentRoadmapLessons,
} from '../shared/roadmapCoach.ts';
import {
  type AiFailoverCooldowns,
  clearAiFailoverCooldowns,
  getAiFailoverCooldowns,
  saveRoadmapCoachInsight,
  setAiFailoverCooldown,
} from '../shared/storage.ts';
import { REMEDIAL_SKILL_ORDER } from '../shared/remedialCatalog.ts';
import {
  type AiDiagnosedOverlayItem,
  isValidWeakSkillId,
} from '../shared/weaknessDetector.ts';
import type {
  AiConfig,
  AiGrammarCoachItem,
  AiGrammarCoachResult,
  AiProviderIndex,
  AiTutorChatTurn,
  AiTutorContext,
  Card,
  CefrLevel,
  ConceptNote,
  ConceptWeakPointInput,
  FeedbackLanguageMode,
  PageAnswerEvaluation,
  PageTranslationDirection,
  RemedialBriefingExample,
  ReviewEvent,
  RoadmapCoachInsight,
  RoadmapLessonRecord,
  ValidatedPageChallenge,
  WeakSkillId,
} from '../shared/types';

export const PRIMARY_FAILOVER_TIMEOUT_MS = 8_000;
export const PRIMARY_FAILOVER_COOLDOWN_MS = 30 * 60_000;

const FALLBACK_SYSTEM_PROMPT =
  'You are an experienced English-to-Turkish language teacher. Evaluate the user’s Turkish answer. If the core meaning is accurate but the user missed or questioned a specific grammar pattern (e.g., to, used to, preposition, tense), accept the answer (isCorrect: true) and populate weakPoint. Respond ONLY with valid JSON: {"isCorrect": boolean, "note": "brief explanation", "weakPoint": {"token": "...", "label": "...", "explanation": "..."} | null}';

/**
 * Resolves the active feedback/explanation language code from `AiConfig`,
 * falling back to the browser UI language when set to `'auto'`.
 */
export function resolveFeedbackLanguage(
  mode: FeedbackLanguageMode | undefined,
  browserLangOverride?: string
): SupportedLanguageCode {
  return resolveSupportedLanguage(mode, browserLangOverride);
}

function getFeedbackLanguageName(aiConfig: AiConfig): string {
  return getAiLanguagePromptName(aiConfig.feedbackLanguage);
}

function cleanBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

/** Extract a JSON object even if the model wrapped it in markdown fences or prose. */
export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    const parsed = JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function extractChoiceText(data: {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }> | null;
      reasoning_content?: string | null;
      reasoning?: string | null;
    };
  }>;
}): string {
  const msg = data.choices?.[0]?.message;
  if (!msg) return '';

  if (typeof msg.content === 'string' && msg.content.trim()) {
    return msg.content.trim();
  }
  if (Array.isArray(msg.content)) {
    const joined = msg.content.map((p) => p?.text ?? '').join('').trim();
    if (joined) return joined;
  }
  if (typeof msg.reasoning_content === 'string' && msg.reasoning_content.trim()) {
    return msg.reasoning_content.trim();
  }
  if (typeof msg.reasoning === 'string' && msg.reasoning.trim()) {
    return msg.reasoning.trim();
  }
  return '';
}

function formatHttpError(status: number, errText: string): string {
  const snippet = errText.trim().slice(0, 140);
  if (status === 401 || status === 403) {
    return `API ${status} (Invalid or unauthorized API key${snippet ? `: ${snippet}` : ''})`;
  }
  if (status === 429) {
    return `API 429 (Rate limit or quota exceeded — try again shortly)`;
  }
  if (status >= 500) {
    return `API ${status} (Provider server error or high load)`;
  }
  return `API ${status}: ${snippet || 'Request rejected'}`;
}

async function callChatCompletionOnce(
  aiConfig: AiConfig,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
  maxTokens: number
): Promise<{ ok: true; text: string } | { ok: false; status: number; message: string; retryable: boolean }> {
  const baseUrl = cleanBaseUrl(aiConfig.baseUrl);
  const controller = new AbortController();
  const timeoutSec = Math.max(1, Math.round(timeoutMs / 1000));
  const timer = setTimeout(
    () => controller.abort(new Error(`Request timed out after ${timeoutSec}s.`)),
    timeoutMs
  );

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiConfig.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: aiConfig.model.trim(),
        temperature: 0.1,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const retryable = res.status === 429 || res.status >= 502;
      return {
        ok: false,
        status: res.status,
        message: formatHttpError(res.status, errText),
        retryable,
      };
    }

    const data = (await res.json()) as Parameters<typeof extractChoiceText>[0];
    return { ok: true, text: extractChoiceText(data) };
  } catch (err) {
    if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
      throw new Error(`Timeout: Provider did not respond within ${timeoutSec}s.`);
    }
    if (err instanceof TypeError) {
      throw new Error('Network error: Unable to reach provider endpoint (check internet, VPN, or Base URL).');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export interface ConfiguredAiProvider {
  index: AiProviderIndex;
  config: AiConfig;
}

function getSlotCredentials(
  aiConfig: AiConfig,
  slot: AiProviderIndex
): { enabled: boolean; baseUrl: string; apiKey: string; model: string } {
  if (slot === 1) {
    return {
      enabled: aiConfig.enabled,
      baseUrl: cleanBaseUrl(aiConfig.baseUrl),
      apiKey: aiConfig.apiKey.trim(),
      model: aiConfig.model.trim(),
    };
  }
  if (slot === 2) {
    return {
      enabled: Boolean(aiConfig.fallbackEnabled),
      baseUrl: cleanBaseUrl(aiConfig.fallbackBaseUrl ?? ''),
      apiKey: (aiConfig.fallbackApiKey ?? '').trim(),
      model: (aiConfig.fallbackModel ?? '').trim(),
    };
  }
  return {
    enabled: Boolean(aiConfig.fallback2Enabled),
    baseUrl: cleanBaseUrl(aiConfig.fallback2BaseUrl ?? ''),
    apiKey: (aiConfig.fallback2ApiKey ?? '').trim(),
    model: (aiConfig.fallback2Model ?? '').trim(),
  };
}

function buildSlotAiConfig(aiConfig: AiConfig, slot: AiProviderIndex): AiConfig | null {
  const creds = getSlotCredentials(aiConfig, slot);
  if (!creds.baseUrl || !creds.apiKey || !creds.model) return null;
  if (slot > 1 && !creds.enabled) return null;
  return {
    ...aiConfig,
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    model: creds.model,
    fallbackEnabled: false,
    fallback2Enabled: false,
  };
}

/** Return configured active providers in priority order (AI1 -> AI2 -> AI3). */
export function getConfiguredProviders(aiConfig: AiConfig): ConfiguredAiProvider[] {
  const slots: AiProviderIndex[] = [1, 2, 3];
  const result: ConfiguredAiProvider[] = [];
  for (const slot of slots) {
    const built = buildSlotAiConfig(aiConfig, slot);
    if (built) {
      result.push({ index: slot, config: built });
    }
  }
  return result;
}

/** Order providers so non-cooled-down providers run first, keeping cooled ones as last-resort fallback. */
export function orderProvidersForExecution(
  providers: ConfiguredAiProvider[],
  cooldowns: AiFailoverCooldowns,
  now: number = Date.now()
): ConfiguredAiProvider[] {
  const ready: ConfiguredAiProvider[] = [];
  const cooled: ConfiguredAiProvider[] = [];
  for (const p of providers) {
    const until = cooldowns[p.index] ?? 0;
    if (until > now) {
      cooled.push(p);
    } else {
      ready.push(p);
    }
  }
  return [...ready, ...cooled];
}

export function selectActiveProvider(
  providers: ConfiguredAiProvider[],
  cooldowns: AiFailoverCooldowns,
  now: number = Date.now()
): { provider: ConfiguredAiProvider | null; activeUntil: number | null } {
  if (providers.length === 0) return { provider: null, activeUntil: null };
  const ready = providers.find((p) => (cooldowns[p.index] ?? 0) <= now) ?? providers[0]!;
  // If AI1 (primary) is skipped due to cooldown, report its remaining cooldown window
  const primaryCooldown = cooldowns[1] ?? 0;
  const activeUntil =
    ready.index !== 1 && primaryCooldown > now ? primaryCooldown : null;
  return { provider: ready, activeUntil };
}

export function hasConfiguredAiProvider(aiConfig: AiConfig): boolean {
  if (!aiConfig.enabled) return false;
  return getConfiguredProviders(aiConfig).length > 0;
}

async function callSingleProviderCompletion(
  aiConfig: AiConfig,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
  maxTokens: number,
  allowRetry: boolean
): Promise<string> {
  const first = await callChatCompletionOnce(aiConfig, systemPrompt, userPrompt, timeoutMs, maxTokens);
  if (first.ok) return first.text;

  if (allowRetry && first.retryable) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const second = await callChatCompletionOnce(aiConfig, systemPrompt, userPrompt, timeoutMs, maxTokens);
    if (second.ok) return second.text;
    throw new Error(second.message);
  }

  throw new Error(first.message);
}

async function callChatCompletionWithSource(
  aiConfig: AiConfig,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number = 22_000,
  maxTokens: number = 750
): Promise<{ text: string; providerIndex: AiProviderIndex }> {
  const configured = getConfiguredProviders(aiConfig);
  if (configured.length === 0) {
    throw new Error('AI settings incomplete (Base URL, API Key, or Model is empty).');
  }

  const cooldowns = await getAiFailoverCooldowns();
  const ordered = orderProvidersForExecution(configured, cooldowns);
  let lastErr: unknown;

  for (let i = 0; i < ordered.length; i += 1) {
    const candidate = ordered[i]!;
    const hasNext = i < ordered.length - 1;
    // Fast 8s failover when another backup follows; full timeout on final candidate
    const effectiveTimeout = hasNext
      ? Math.min(timeoutMs, PRIMARY_FAILOVER_TIMEOUT_MS)
      : Math.max(timeoutMs, 22_000);

    try {
      const text = await callSingleProviderCompletion(
        candidate.config,
        systemPrompt,
        userPrompt,
        effectiveTimeout,
        maxTokens,
        !hasNext
      );
      if ((cooldowns[candidate.index] ?? 0) > 0) {
        await setAiFailoverCooldown(candidate.index, 0);
      }
      return { text, providerIndex: candidate.index };
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (hasNext) {
        const nextCandidate = ordered[i + 1]!;
        console.warn(
          `[EnTrRecall AI] AI${candidate.index} (${candidate.config.model}) failed (${msg}); falling back to AI${nextCandidate.index} (${nextCandidate.config.model}) for 30 min.`
        );
        await setAiFailoverCooldown(candidate.index, Date.now() + PRIMARY_FAILOVER_COOLDOWN_MS);
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? 'AI request failed'));
}

async function callChatCompletion(
  aiConfig: AiConfig,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number = 22_000,
  maxTokens: number = 750
): Promise<string> {
  const { text } = await callChatCompletionWithSource(
    aiConfig,
    systemPrompt,
    userPrompt,
    timeoutMs,
    maxTokens
  );
  return text;
}

export type AiEvalOutcome =
  | {
      ok: true;
      isCorrect: boolean;
      note?: string;
      weakPoint?: ConceptWeakPointInput;
      providerIndex: AiProviderIndex;
    }
  | { ok: false; reason: 'disabled' | 'error'; errorMessage?: string };

function parseWeakPoint(raw: unknown): ConceptWeakPointInput | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const token = typeof obj.token === 'string' ? obj.token.trim() : '';
  const label = typeof obj.label === 'string' ? obj.label.trim() : '';
  const explanation = typeof obj.explanation === 'string' ? obj.explanation.trim() : '';
  if (!token || !explanation) return undefined;
  return {
    key: typeof obj.key === 'string' ? obj.key.trim() : undefined,
    token,
    label: label || `Usage of '${token}'`,
    explanation,
  };
}

function inferWeakPointFromNoteIfOmitted(
  card: Card,
  note: string | undefined
): ConceptWeakPointInput | undefined {
  if (!note || card.type !== 'sentence') return undefined;
  const lower = note.toLowerCase();
  const hasGrammarCaveat =
    lower.includes('zaman farkı') ||
    lower.includes('tense') ||
    lower.includes('past continuous') ||
    lower.includes('simple past') ||
    lower.includes('present perfect') ||
    lower.includes('used to') ||
    lower.includes('edilgen') ||
    lower.includes('passive');
  if (!hasGrammarCaveat) return undefined;

  if (/\b(?:was|were)\s+[a-z]{2,}ing\b/i.test(card.en)) {
    const match = card.en.match(/\b(?:was|were)\s+[a-z]{2,}ing\b/i)?.[0] ?? 'was';
    return {
      key: 'past_continuous',
      token: match,
      label: "'was/were + V-ing' (Past Continuous)",
      explanation: note,
    };
  }
  if (/\bused\s+to\b/i.test(card.en)) {
    return {
      key: 'used_to',
      token: 'used to',
      label: "'used to' structure",
      explanation: note,
    };
  }
  return undefined;
}

const OMISSION_CLAIM_RE =
  /(?:^|[^a-zçğıöşü])(atlanm[ıi]ş|eksik|unutulmuş|yazar?ken\s+atlan|omitted|missing|missed|left\s+out)(?:$|[^a-zçğıöşü])/i;
const OMISSION_TOKEN_BEFORE_RE =
  /['"’“]([^'"’”]{2,25})['"’”]\s*(?:[^\n.;,!?]{0,28}?)(?:atlanm[ıi]ş|eksik|unutulmuş|yazar?ken\s+atlan|omitted|missing|missed|left\s+out)(?:$|[^a-zçğıöşü])/gi;
const OMISSION_TOKEN_AFTER_RE =
  /(?:^|[^a-zçğıöşü])(?:omitted|missing|missed|left\s+out|atlanm[ıi]ş|eksik|unutulmuş)\s*(?:[^\n.;,!?]{0,16}?)['"’“]([^'"’”]{2,25})['"’”]/gi;

/**
 * Guard against small-model hallucinations where the AI claims a specific quoted
 * word/detail (e.g. `'eve' detayı atlanmış`) was omitted even though that word
 * or its root is already present in `userAnswer`. Only inspects quoted tokens
 * directly paired with an omission verb so valid contrastive feedback like
 * `"Sen 'zaten' yazmışsın ama 'until' unutulmuş"` is preserved.
 */
export function sanitizeHallucinatedOmission(
  userAnswer: string,
  note: string | undefined,
  weakPoint: ConceptWeakPointInput | undefined
): { note: string | undefined; weakPoint: ConceptWeakPointInput | undefined } {
  const combinedText = `${note ?? ''} ${weakPoint?.explanation ?? ''}`;
  if (!OMISSION_CLAIM_RE.test(combinedText)) {
    return { note, weakPoint };
  }

  const normUser = userAnswer
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-zçğıöşü0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const userWords = normUser.split(' ').filter(Boolean);

  const omissionTargets = [
    ...Array.from(combinedText.matchAll(OMISSION_TOKEN_BEFORE_RE)),
    ...Array.from(combinedText.matchAll(OMISSION_TOKEN_AFTER_RE)),
  ];
  for (const m of omissionTargets) {
    const quoted = (m[1] ?? '').toLocaleLowerCase('tr-TR').trim();
    if (!quoted || quoted.length < 2) continue;
    // Check if the quoted word or its 2-4 char Turkish root (e.g. 'ev' for 'eve') is already in userAnswer
    const root = quoted.length >= 4 ? quoted.slice(0, 4) : quoted.slice(0, 2);
    const presentInAnswer = userWords.some(
      (w) => w === quoted || w.startsWith(quoted) || (root.length >= 2 && w.startsWith(root))
    );
    if (presentInAnswer) {
      return {
        note: undefined,
        weakPoint: undefined,
      };
    }
  }

  return { note, weakPoint };
}

export async function evaluateAnswerWithAi(
  card: Card,
  userAnswer: string,
  aiConfig: AiConfig,
  options?: { contextNote?: string }
): Promise<AiEvalOutcome> {
  if (!hasConfiguredAiProvider(aiConfig)) {
    return { ok: false, reason: 'disabled' };
  }

  const feedbackLang = getFeedbackLanguageName(aiConfig);
  const baseSystemPrompt = aiConfig.systemPrompt.trim() || FALLBACK_SYSTEM_PROMPT;
  const systemPrompt = `${baseSystemPrompt}
[Important Instructions]:
1. Override any earlier language preference and write all "note", "weakPoint.label", and "weakPoint.explanation" feedback in clear, natural ${feedbackLang}.
2. CRITICAL: Read every word of the User's answer carefully before writing your note. NEVER claim a word or detail (such as 'eve', a time word, or a pronoun) was omitted if that word or its root/synonym appears in the User's answer!
3. The "Reference Turkish meanings" list may be incomplete or omit common senses of polysemous words (e.g., "space" = "uzay / alan / boşluk / yer", "watch" = "izlemek / kol saati", "spring" = "ilkbahar / bahar / yay", "fall" = "düşmek / sonbahar", "bank" = "banka / kıyı", "light" = "ışık / hafif"). Judge against true English-Turkish meaning, and ALWAYS accept valid synonyms, standard dictionary senses, minor 1-2 letter spelling typos (or missing Turkish diacritics like s/ş, c/ç, g/ğ, i/ı, o/ö, u/ü), optional omitted pronouns, and natural Turkish word order as "isCorrect": true!
4. If the user's translation is accurate (even via synonym or slight typo), set "isCorrect": true, set "weakPoint": null, and keep "note" brief and clear (mentioning any tiny typo gently).
5. When "isCorrect": false, ALWAYS populate "note" with 1-2 clear sentences explaining the exact mistake in the user's translation. Only populate "weakPoint" when there is a genuine, unmistakable grammar or vocabulary pattern to reinforce (e.g., translating Past Continuous "I was taking a walk" as Simple Past, missing "used to", or confusing a core verb).
6. Write "weakPoint.explanation" as a timeless, standalone rule ONLY about "weakPoint.token" in ${feedbackLang}. NEVER mention other unrelated phrases from the current sentence (such as 'let me know') and NEVER refer to the user's specific wrong phrasing so it makes complete sense when shown on future cards.
JSON schema: {"isCorrect": boolean, "note": "brief explanation in ${feedbackLang}", "weakPoint": {"token": "relevant English token/pattern (e.g. was taking / used to / arrive)", "label": "short grammar title in ${feedbackLang}", "explanation": "concise standalone rule ONLY for token in ${feedbackLang}"} | null}`;

  const userPrompt = [
    `Type: ${card.type === 'sentence' ? 'Sentence' : 'Word'} (${card.level})`,
    `English: ${card.en}`,
    `Reference Turkish meanings: ${card.acceptedTr.join(', ')}`,
    card.exampleEn && card.type === 'word' ? `Example sentence: ${card.exampleEn}` : '',
    options?.contextNote ? `Exercise format: ${options.contextNote}` : '',
    `User's Turkish answer / note: "${userAnswer}"`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const { text: content, providerIndex } = await callChatCompletionWithSource(
      aiConfig,
      systemPrompt,
      userPrompt,
      30_000,
      600
    );
    const parsed = extractJsonObject(content);
    if (!parsed || typeof parsed.isCorrect !== 'boolean') {
      const preview = content ? ` (Raw: "${content.slice(0, 70)}")` : ' (Empty response)';
      return { ok: false, reason: 'error', errorMessage: `Model returned invalid JSON${preview}.` };
    }
    const rawNote = typeof parsed.note === 'string' ? parsed.note.trim() : undefined;
    const rawWeakPoint =
      parseWeakPoint(parsed.weakPoint) ?? inferWeakPointFromNoteIfOmitted(card, rawNote);
    const sanitized = sanitizeHallucinatedOmission(userAnswer, rawNote, rawWeakPoint);
    return {
      ok: true,
      isCorrect: parsed.isCorrect,
      note: sanitized.note,
      weakPoint: sanitized.weakPoint,
      providerIndex,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[EnTrRecall AI fallback]', msg);
    return { ok: false, reason: 'error', errorMessage: msg };
  }
}

/** Explain what a specific word/grammar token does in the given card sentence. */
export async function explainConceptWithAi(
  card: Card,
  focusToken: string,
  userQuestion: string | undefined,
  aiConfig: AiConfig
): Promise<{ label: string; explanation: string } | null> {
  if (!hasConfiguredAiProvider(aiConfig)) return null;

  const feedbackLang = getFeedbackLanguageName(aiConfig);
  const systemPrompt =
    `You are an English-to-Turkish language coach. Explain the unclear part of the sentence in 1-2 clear sentences in ${feedbackLang}. Return ONLY JSON: {"label": "short structure title in ${feedbackLang}", "explanation": "concise explanation in ${feedbackLang}"}`;
  const userPrompt = [
    `Card (${card.level}): ${card.en}`,
    `Turkish meaning: ${card.acceptedTr.join(', ')}`,
    `Flagged part: "${focusToken}"`,
    userQuestion?.trim() ? `User question: "${userQuestion.trim()}"` : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const content = await callChatCompletion(aiConfig, systemPrompt, userPrompt, 9_000);
    const parsed = extractJsonObject(content);
    if (!parsed) return null;
    const label = typeof parsed.label === 'string' ? parsed.label.trim() : '';
    const explanation = typeof parsed.explanation === 'string' ? parsed.explanation.trim() : '';
    if (!explanation) return null;
    return {
      label: label || `Usage of '${focusToken}'`,
      explanation,
    };
  } catch {
    return null;
  }
}

/**
 * Generate 2 fresh practice sentence cards testing a tracked concept when the
 * built-in deck has fewer than 2 unused variations.
 */
export async function generateConceptPracticeCards(
  concept: ConceptNote,
  aiConfig: AiConfig,
  targetLevel: CefrLevel = 'B1'
): Promise<Card[]> {
  if (!hasConfiguredAiProvider(aiConfig)) return [];

  const safeTargetLevel: CefrLevel =
    targetLevel === 'A1' ||
    targetLevel === 'A2' ||
    targetLevel === 'B1' ||
    targetLevel === 'B2' ||
    targetLevel === 'C1'
      ? targetLevel
      : 'B1';

  const systemPrompt =
    `Generate 2 natural, modern everyday English practice sentences at CEFR level ${safeTargetLevel} using the target structure/word in different contexts along with natural Turkish translations. Return ONLY JSON: {"items": [{"en": "...", "tr": ["..."], "level": "${safeTargetLevel}"}]}`;
  const userPrompt = [
    `Target CEFR level: ${safeTargetLevel}`,
    `Target structure/word: "${concept.focusToken}" (${concept.label})`,
    `Reference sentence (do not repeat): "${concept.sourceEn}"`,
    `Explanation: ${concept.explanation}`,
  ].join('\n');

  try {
    const content = await callChatCompletion(aiConfig, systemPrompt, userPrompt, 10_000);
    const parsed = extractJsonObject(content);
    if (!parsed || !Array.isArray(parsed.items)) return [];

    const validLevels = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    const out: Card[] = [];
    const stamp = Date.now();
    for (let i = 0; i < parsed.items.length && out.length < 2; i += 1) {
      const item = parsed.items[i] as Record<string, unknown> | undefined;
      if (!item) continue;
      const en = typeof item.en === 'string' ? item.en.trim() : '';
      const trArr = Array.isArray(item.tr)
        ? item.tr.map((t) => String(t).trim()).filter(Boolean)
        : [];
      const lvlRaw = typeof item.level === 'string' ? item.level.trim().toUpperCase() : safeTargetLevel;
      const level = (validLevels.has(lvlRaw) ? lvlRaw : safeTargetLevel) as Card['level'];
      if (!en || trArr.length === 0) continue;
      out.push({
        id: `u_concept_${stamp.toString(36)}_${i}`,
        type: 'sentence',
        level,
        pos: 'sentence',
        en,
        phonetic: '',
        acceptedTr: trArr,
        exampleEn: '',
        exampleTr: '',
        source: 'user',
        origin: 'ai_concept',
        createdAt: stamp + i,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function translateSelectionWithAi(
  text: string,
  aiConfig: AiConfig
): Promise<string[]> {
  if (!hasConfiguredAiProvider(aiConfig)) return [];
  const systemPrompt =
    'Return 1-3 natural Turkish translations for the given English word or sentence. Respond ONLY with JSON: {"translations": ["..."]}';

  try {
    const content = await callChatCompletion(aiConfig, systemPrompt, `English: ${text}`, 8_000);
    const parsed = extractJsonObject(content);
    if (!parsed || !Array.isArray(parsed.translations)) return [];
    return parsed.translations
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 3);
  } catch {
    return [];
  }
}

async function fetchModelsFromEndpoint(rawBaseUrl: string, rawApiKey: string): Promise<string[]> {
  const baseUrl = cleanBaseUrl(rawBaseUrl);
  const apiKey = rawApiKey.trim();
  if (!baseUrl || !apiKey) {
    throw new Error('Base URL and API Key are required to fetch models.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch models (HTTP ${res.status})`);
    }
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    return (data.data ?? [])
      .map((m) => m.id?.trim() ?? '')
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchModelsForSlot(
  aiConfig: AiConfig,
  slot: AiProviderIndex
): Promise<string[]> {
  const creds = getSlotCredentials(aiConfig, slot);
  return fetchModelsFromEndpoint(creds.baseUrl, creds.apiKey);
}

async function testSingleProvider(config: AiConfig, timeoutMs: number): Promise<{ ok: boolean; reply: string }> {
  const baseUrl = cleanBaseUrl(config.baseUrl);
  if (!baseUrl || !config.apiKey.trim() || !config.model.trim()) {
    throw new Error('Fill in Base URL, API Key, and Model before testing.');
  }
  const content = await callSingleProviderCompletion(
    config,
    'Return ONLY short JSON: {"status": "ok", "message": "Connection succeeded"}',
    'Test',
    timeoutMs,
    120,
    false
  );
  return { ok: true, reply: content.slice(0, 160) };
}

export async function testProviderConnection(
  aiConfig: AiConfig,
  slot: AiProviderIndex
): Promise<{ ok: boolean; reply: string }> {
  const creds = getSlotCredentials(aiConfig, slot);
  const timeoutMs = slot === 1 ? 30_000 : 25_000;
  const res = await testSingleProvider(
    {
      ...aiConfig,
      baseUrl: creds.baseUrl,
      apiKey: creds.apiKey,
      model: creds.model,
    },
    timeoutMs
  );
  if (slot === 1) {
    await clearAiFailoverCooldowns();
  } else {
    await setAiFailoverCooldown(slot, 0);
  }
  return res;
}

/**
 * Generate a concise 1-2 sentence micro-report from the last 5 Roadmap lessons
 * explaining overall momentum and recurring errors / trouble areas.
 */
export async function generateRoadmapCoachBanner(
  records: RoadmapLessonRecord[],
  aiConfig: AiConfig,
  uiLanguage?: FeedbackLanguageMode
): Promise<RoadmapCoachInsight> {
  const effectiveLang =
    uiLanguage && uiLanguage !== 'auto'
      ? uiLanguage
      : aiConfig.feedbackLanguage ?? 'auto';
  const lang = resolveSupportedLanguage(effectiveLang);
  const langName = getAiLanguagePromptName(lang);
  const fallback = buildFallbackRoadmapCoachBanner(records, lang);

  if (!hasConfiguredAiProvider(aiConfig) || records.length === 0) {
    await saveRoadmapCoachInsight(fallback);
    return fallback;
  }

  const recent = records.slice(-5);
  const summary = summarizeRecentRoadmapLessons(recent, 5);
  const lessonLines = recent.map((rec, idx) => {
    const missPreview =
      rec.mistakes.length > 0
        ? rec.mistakes
            .slice(0, 4)
            .map(
              (m) =>
                `${m.en}(${LESSON_KIND_LABELS[m.kind].en}${m.repeatedWrong ? ',repeated' : ''},misses=${m.wrongCount})`
            )
            .join('; ')
        : 'none';
    return `${idx + 1}. Unit "${rec.unitTitleEn}" (${rec.accuracyPct}%, repeatedMisses=${rec.repeatedMistakeCount}): mistakes=[${missPreview}]`;
  });

  const recurringWordsText =
    summary.recurringWords.length > 0
      ? summary.recurringWords
          .map(
            (w) =>
              `"${w.en}" (expected "${w.expected}", missed ${w.wrongCount}x across ${w.repeatedLessons} lesson(s))`
          )
          .join('; ')
      : 'None';

  const weakKindsText =
    summary.weakKinds.length > 0
      ? summary.weakKinds
          .map((wk) => `${LESSON_KIND_LABELS[wk.kind].en}: ${wk.accuracyPct}%`)
          .join(', ')
      : 'None';

  const strongKindsText =
    summary.strongKinds.length > 0
      ? summary.strongKinds.map((k) => LESSON_KIND_LABELS[k].en).join(', ')
      : 'General recall';

  const systemPrompt = [
    `You are a supportive language-coach banner inside a Duolingo-style vocabulary app. Write ONLY in ${langName}.`,
    'Analyze ONLY the provided last-5-lesson metrics and mistakes.',
    'Produce a single crisp 1-2 sentence micro-report (MAXIMUM 170 characters total!) that goes at the top-left of the Roadmap screen.',
    'Examples of tone:',
    lang === 'tr'
      ? '- "İlerlemen çok iyi! Son 5 derste %94 doğrulukla harika gidiyorsun."\n- "İlerlemen iyi ancak dinle & yaz ve \'arrive\' kelimesinde sık takılıyorsun."'
      : '- "Great progress! 94% accuracy over your last 5 lessons with steady flow."\n- "Good progress, though you frequently stumble on audio dictation and \'arrive\'."',
    'Rules:',
    '1) Never invent mistakes or words not listed in the stats.',
    '2) Mention specific recurring missed words or weak exercise skills ONLY when present in the data; if none exist, praise momentum concisely.',
    '3) Respond ONLY with JSON: {"status": "great" | "good" | "focus", "message": "..."}',
  ].join('\n');

  const userPrompt = [
    `Last ${summary.lessonCount} lesson(s) average accuracy: ${summary.avgAccuracyPct}%`,
    `Accuracy trend: ${summary.trend}`,
    `Total repeated retry misses: ${summary.totalRepeatedMistakes}`,
    `Weak exercise types: ${weakKindsText}`,
    `Recurring missed words: ${recurringWordsText}`,
    `Strong exercise types: ${strongKindsText}`,
    `Lesson log:\n${lessonLines.join('\n')}`,
  ].join('\n');

  try {
    const content = await callChatCompletion(aiConfig, systemPrompt, userPrompt, 10_000);
    const parsed = extractJsonObject(content);
    const rawMsg = typeof parsed?.message === 'string' ? parsed.message.trim() : '';
    const rawStatus = typeof parsed?.status === 'string' ? parsed.status.trim() : '';
    if (!rawMsg) {
      await saveRoadmapCoachInsight(fallback);
      return fallback;
    }

    const status: RoadmapCoachInsight['status'] =
      rawStatus === 'great' || rawStatus === 'good' || rawStatus === 'focus'
        ? rawStatus
        : fallback.status;

    const insight: RoadmapCoachInsight = {
      status,
      message: rawMsg.replace(/\s+/g, ' ').slice(0, 210),
      generatedAt: Date.now(),
      lessonCountAnalyzed: summary.lessonCount,
      source: 'ai',
    };
    await saveRoadmapCoachInsight(insight);
    return insight;
  } catch {
    await saveRoadmapCoachInsight(fallback);
    return fallback;
  }
}

export async function generateAiCoachReport(
  summary: AnalyticsSummary,
  aiConfig: AiConfig,
  conceptNotes: ConceptNote[] = []
): Promise<string> {
  if (!hasConfiguredAiProvider(aiConfig)) {
    throw new Error('Enter an API key and enable AI in the AI Evaluation tab first.');
  }

  const levelLines = summary.byLevel
    .filter((b) => b.attempts > 0)
    .map((b) => `${b.label}: ${b.accuracy}% (${b.correct}/${b.attempts})`)
    .join(', ');

  const posLines = summary.byPos
    .filter((b) => b.attempts > 0)
    .map((b) => `${b.label}: ${b.accuracy}% (${b.correct}/${b.attempts})`)
    .join(', ');

  const topicLines = summary.byTopic
    .filter((b) => b.attempts > 0)
    .map((b) => `${b.label}: ${b.accuracy}% (${b.correct}/${b.attempts})`)
    .join(', ');

  const hardWords = summary.hardCards
    .slice(0, 6)
    .map((h) => `${h.card.en} (${h.progress.totalWrong} misses)`)
    .join(', ');

  const activeConcepts = conceptNotes
    .filter((c) => c.stage < 3)
    .slice(0, 6)
    .map((c) => `${c.label} (Stage ${c.stage + 1}/3)`)
    .join(', ');

  const userPrompt = [
    `User Stats:`,
    `- Elo Skill Rating: ${summary.profile.rating} | Estimated CEFR: ${summary.cefr.level}`,
    `- Total Answered: ${summary.profile.totalAnswered} | Overall Accuracy: ${summary.overallAccuracy}%`,
    `- Best Streak: ${summary.profile.bestStreak}`,
    `- CEFR Breakdown: ${levelLines || 'Not enough data yet'}`,
    `- Part-of-Speech Breakdown: ${posLines || 'Not enough data yet'}`,
    `- Topic Breakdown: ${topicLines || 'Not enough data yet'}`,
    `- Hardest Cards: ${hardWords || 'None'}`,
    `- Tracked Grammar / Focus Points: ${activeConcepts || 'None'}`,
  ].join('\n');

  const feedbackLang = getFeedbackLanguageName(aiConfig);
  const systemPrompt =
    `You are a personalized English-to-Turkish learning coach. Review the user stats below and provide up to 4 concise, actionable bullet points in ${feedbackLang} covering current level assessment and concrete study priorities. Avoid fluff; stick strictly to the data.`;

  return callChatCompletion(aiConfig, systemPrompt, userPrompt, 25_000);
}

/**
 * Validate a small batch (up to 3) of script-extracted candidate sentences with AI,
 * confirming one is a genuine, self-contained, meaningful sentence and preparing
 * its reference translation ahead of highlighting it on the page.
 */
export async function validatePageSentenceCandidates(
  candidates: Array<{ id: string; blockIndex: number; text: string }>,
  direction: PageTranslationDirection,
  aiConfig: AiConfig
): Promise<ValidatedPageChallenge | null> {
  if (!hasConfiguredAiProvider(aiConfig)) {
    throw new Error('Enable AI and add an API key in Settings → AI Evaluation first.');
  }
  if (candidates.length === 0) return null;

  const dirLabel =
    direction === 'tr-to-en' ? 'Turkish to English' : 'English to Turkish';
  const feedbackLang = getFeedbackLanguageName(aiConfig);

  const systemPrompt = [
    'You validate webpage sentences for a translation quiz.',
    'Review the JSON list of candidate strings extracted from a webpage.',
    'Pick the FIRST candidate that is a real, grammatically complete, self-contained, meaningful sentence worth translating (skip navigation labels, cookie notices, fragments, broken syntax, or pure code/metadata).',
    `Translate the accepted candidate accurately from ${dirLabel}.`,
    `Respond ONLY with valid JSON: {"valid": boolean, "candidateId": "matching id or null", "referenceTranslation": "natural translation in target language", "notes": "1 short helpful grammar/vocab hint in ${feedbackLang} or null"}`,
  ].join(' ');

  const userPrompt = [
    `Direction: ${dirLabel}`,
    `Candidates: ${JSON.stringify(candidates.map((c) => ({ id: c.id, text: c.text })))}`,
  ].join('\n');

  const { text } = await callChatCompletionWithSource(
    aiConfig,
    systemPrompt,
    userPrompt,
    20_000,
    380
  );
  const parsed = extractJsonObject(text);
  if (!parsed || parsed.valid !== true) return null;

  const pickedId = typeof parsed.candidateId === 'string' ? parsed.candidateId.trim() : '';
  const picked = candidates.find((c) => c.id === pickedId) ?? candidates[0]!;
  const ref =
    typeof parsed.referenceTranslation === 'string'
      ? parsed.referenceTranslation.trim()
      : '';
  if (!ref) return null;

  const notes = typeof parsed.notes === 'string' && parsed.notes.trim() ? parsed.notes.trim() : undefined;

  return {
    candidateId: picked.id,
    blockIndex: picked.blockIndex,
    sentence: picked.text,
    direction,
    referenceTranslation: ref,
    notes,
  };
}

/** Grade a user's translation attempt for a highlighted in-page sentence without affecting main SRS stats. */
export async function evaluatePageTranslationWithAi(
  sourceSentence: string,
  referenceTranslation: string,
  direction: PageTranslationDirection,
  userAnswer: string,
  aiConfig: AiConfig
): Promise<PageAnswerEvaluation> {
  if (!hasConfiguredAiProvider(aiConfig)) {
    throw new Error('Enable AI and add an API key in Settings → AI Evaluation first.');
  }

  const dirLabel =
    direction === 'tr-to-en' ? 'Turkish → English' : 'English → Turkish';
  const resolvedLang = resolveFeedbackLanguage(aiConfig.feedbackLanguage);
  const feedbackLang = getFeedbackLanguageName(aiConfig);

  const systemPrompt = [
    'You are a strict yet fair bilingual English/Turkish teacher.',
    `Evaluate the user's ${dirLabel} translation of the highlighted webpage sentence.`,
    'Accept accurate paraphrases, natural phrasing, synonyms, and minor punctuation/typo slips; reject inaccurate meaning, key omissions, or wrong tense/polarity.',
    `Respond ONLY with valid JSON: {"isCorrect": boolean, "feedback": "1-2 concise sentences in ${feedbackLang} explaining what was accurate or what missed the meaning"}`,
  ].join(' ');

  const userPrompt = [
    `Direction: ${dirLabel}`,
    `Source sentence: "${sourceSentence}"`,
    `Reference translation: "${referenceTranslation}"`,
    `User translation: "${userAnswer}"`,
  ].join('\n');

  const { text, providerIndex } = await callChatCompletionWithSource(
    aiConfig,
    systemPrompt,
    userPrompt,
    22_000,
    320
  );
  const parsed = extractJsonObject(text);
  if (!parsed || typeof parsed.isCorrect !== 'boolean') {
    throw new Error('AI returned an invalid JSON evaluation response.');
  }

  return {
    isCorrect: parsed.isCorrect,
    feedback:
      typeof parsed.feedback === 'string' && parsed.feedback.trim()
        ? parsed.feedback.trim()
        : parsed.isCorrect
          ? resolvedLang === 'tr'
            ? 'Doğru çeviri!'
            : 'Accurate translation!'
          : resolvedLang === 'tr'
            ? 'Anlam kaynak cümleden farklı görünüyor.'
            : 'Meaning differs from the source sentence.',
    referenceTranslation,
    providerIndex,
  };
}

/**
 * Evaluate a Duolingo-roadmap exercise in either direction (`en-to-tr`, `tr-to-en`,
 * or near-miss `en-audio` dictation), accepting valid synonyms, natural word-order
 * variants in Word Bank, contractions, and minor typos.
 */
export async function evaluateRoadmapAnswerWithAi(
  params: {
    card: Card;
    direction: 'en-to-tr' | 'tr-to-en' | 'en-audio';
    kind: 'word_bank' | 'audio_dictation' | 'free_translation';
    promptText: string;
    expectedAnswers: string[];
    userAnswer: string;
  },
  aiConfig: AiConfig
): Promise<AiEvalOutcome> {
  if (!hasConfiguredAiProvider(aiConfig)) {
    return { ok: false, reason: 'disabled' };
  }

  if (params.direction === 'en-to-tr') {
    const contextNote =
      params.kind === 'word_bank'
        ? 'Turkish sentence built from word tiles (accept natural Turkish word order if accurate)'
        : 'Open Turkish translation in learning path';
    // When a word card is exercised via its example sentence (e.g. en-to-tr word_bank),
    // evaluate against the actual prompted sentence & expected Turkish sentence instead of the lone headword.
    const promptedText = params.promptText.trim();
    const isExampleSentencePrompt =
      params.card.type === 'word' &&
      promptedText.length > 0 &&
      promptedText.toLowerCase() !== params.card.en.trim().toLowerCase();
    const effectiveCard: Card = isExampleSentencePrompt
      ? {
          ...params.card,
          type: 'sentence',
          en: promptedText,
          acceptedTr:
            params.expectedAnswers.length > 0
              ? params.expectedAnswers
              : params.card.exampleTr
                ? [params.card.exampleTr]
                : params.card.acceptedTr,
        }
      : params.card;
    return evaluateAnswerWithAi(effectiveCard, params.userAnswer, aiConfig, { contextNote });
  }

  const feedbackLang = getFeedbackLanguageName(aiConfig);
  const isAudio = params.direction === 'en-audio' || params.kind === 'audio_dictation';
  const systemPrompt = isAudio
    ? [
        'You grade an English listening-dictation attempt for a language learner.',
        `Write all "note" explanations in clear, natural ${feedbackLang}.`,
        'Accept contraction variants (don\'t = do not, I\'m = I am), optional punctuation differences, and minor 1-character harmless typos if the spoken words match accurately.',
        'Reject if core content words are missing, substituted, or wrong tense/meaning.',
        `Respond ONLY with valid JSON: {"isCorrect": boolean, "note": "brief helpful feedback in ${feedbackLang}", "weakPoint": null}`,
      ].join(' ')
    : [
        'You are an experienced Turkish-to-English language teacher.',
        `Evaluate whether the learner's English answer accurately translates the Turkish prompt. Write all "note" feedback in clear, natural ${feedbackLang}.`,
        params.kind === 'word_bank'
          ? 'The user arranged English word tiles. Accept valid alternative English word orders (e.g. adverb placement) if grammatical and faithful in meaning.'
          : 'Accept valid English synonyms (e.g., big/large, maybe/perhaps, kids/children, start/begin), contractions (don\'t = do not), natural phrasings, and minor 1-2 character spelling typos (note any typo gently). Reject opposite meanings, wrong tense/polarity, or wrong vocabulary.',
        `Respond ONLY with valid JSON: {"isCorrect": boolean, "note": "1-2 concise sentences in ${feedbackLang}", "weakPoint": null}`,
      ].join(' ');

  const audioTarget = params.promptText.trim() || params.expectedAnswers[0] || params.card.en;
  const userPrompt = [
    `Level: ${params.card.level} (${params.kind})`,
    isAudio
      ? `Spoken English target: "${audioTarget}"`
      : `Turkish prompt: "${params.promptText}"`,
    `Reference English: ${params.expectedAnswers.slice(0, 3).join(' | ') || audioTarget}`,
    `User's English answer: "${params.userAnswer}"`,
  ].join('\n');

  try {
    const { text: content, providerIndex } = await callChatCompletionWithSource(
      aiConfig,
      systemPrompt,
      userPrompt,
      25_000,
      420
    );
    const parsed = extractJsonObject(content);
    if (!parsed || typeof parsed.isCorrect !== 'boolean') {
      const preview = content ? ` (Raw: "${content.slice(0, 70)}")` : ' (Empty response)';
      return { ok: false, reason: 'error', errorMessage: `Model returned invalid JSON${preview}.` };
    }
    const rawNote = typeof parsed.note === 'string' ? parsed.note.trim() : undefined;
    const sanitized = sanitizeHallucinatedOmission(params.userAnswer, rawNote, undefined);
    return {
      ok: true,
      isCorrect: parsed.isCorrect,
      note: sanitized.note,
      weakPoint: undefined,
      providerIndex,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: 'error', errorMessage: msg };
  }
}

/**
 * Generate a personalized Stage 0 AI briefing note and optional modern examples
 * tailored to the learner's real mistakes for a specific remedial weakness workshop.
 */
export async function generateRemedialBriefingWithAi(
  params: {
    skillId: WeakSkillId;
    titleTr: string;
    titleEn: string;
    evidence: Array<{ en: string; userAnswer?: string; expected?: string }>;
    language?: FeedbackLanguageMode;
  },
  aiConfig: AiConfig
): Promise<{
  personalNote: string;
  extraExamples: RemedialBriefingExample[];
  providerIndex?: AiProviderIndex;
} | null> {
  if (!hasConfiguredAiProvider(aiConfig)) return null;

  const effectiveLang =
    params.language && params.language !== 'auto'
      ? params.language
      : aiConfig.feedbackLanguage ?? 'auto';
  const langName = getAiLanguagePromptName(resolveSupportedLanguage(effectiveLang));

  const evidenceLines =
    params.evidence.length > 0
      ? params.evidence
          .slice(0, 5)
          .map(
            (e, idx) =>
              `${idx + 1}. Target: "${e.en}"${e.expected ? ` | Expected: "${e.expected}"` : ''}${e.userAnswer ? ` | User wrote: "${e.userAnswer}"` : ''}`
          )
          .join('\n')
      : 'No prior mistake logs — general introductory lesson.';

  const systemPrompt = [
    `You are a witty, crystal-clear English-to-Turkish private tutor starting a 1-on-1 remedial micro-lesson. Write explanations in natural ${langName}.`,
    'Explain what this grammar/usage rule REALLY means before exercises begin, directly referencing the learner’s real past mistakes when provided so they instantly have an "aha!" moment.',
    'Keep "personalNote" concise (2-3 punchy sentences, max 340 chars, zero fluff).',
    'Provide 2 fresh, modern everyday English examples (gaming, music, streaming, coding, coffee, travel — not boring textbook lines!) illustrating the rule cleanly.',
    `Respond ONLY with valid JSON: {"personalNote": "...", "extraExamples": [{"en": "...", "tr": "...", "highlight": "key token"}]}`,
  ].join('\n');

  const userPrompt = [
    `Workshop: ${params.titleEn} (${params.titleTr}) [id=${params.skillId}]`,
    `Learner’s real past mistake evidence:\n${evidenceLines}`,
  ].join('\n');

  try {
    const { text, providerIndex } = await callChatCompletionWithSource(
      aiConfig,
      systemPrompt,
      userPrompt,
      14_000,
      460
    );
    const parsed = extractJsonObject(text);
    if (!parsed) return null;
    const personalNote =
      typeof parsed.personalNote === 'string' ? parsed.personalNote.trim().slice(0, 420) : '';
    const extraExamples: RemedialBriefingExample[] = [];
    if (Array.isArray(parsed.extraExamples)) {
      for (const raw of parsed.extraExamples.slice(0, 2)) {
        const obj = raw as Record<string, unknown> | null;
        if (!obj || typeof obj !== 'object') continue;
        const en = typeof obj.en === 'string' ? obj.en.trim() : '';
        const tr = typeof obj.tr === 'string' ? obj.tr.trim() : '';
        const highlight = typeof obj.highlight === 'string' ? obj.highlight.trim() : '';
        if (en && tr) {
          extraExamples.push({ en, tr, highlight });
        }
      }
    }
    if (!personalNote && extraExamples.length === 0) return null;
    return { personalNote, extraExamples, providerIndex };
  } catch {
    return null;
  }
}

/**
 * Perform an on-demand AI deep diagnostic scan across the user's recent Roadmap mistakes,
 * Recall errors, and active concept notes to uncover subtle recurring grammar patterns
 * (e.g., `was` vs `were`, `should` vs `have to`, passive voice, word order).
 */
export async function diagnoseWeaknessesWithAi(
  params: {
    roadmapHistory: RoadmapLessonRecord[];
    reviewHistory: ReviewEvent[];
    conceptNotes: ConceptNote[];
    cardsById: Map<string, Card>;
    resolvedSkillIds?: WeakSkillId[];
    language?: FeedbackLanguageMode;
  },
  aiConfig: AiConfig
): Promise<AiDiagnosedOverlayItem[]> {
  if (!hasConfiguredAiProvider(aiConfig)) {
    throw new Error('Enable AI and add an API key in Settings → AI Evaluation first.');
  }

  const resolvedSet = new Set<WeakSkillId>(params.resolvedSkillIds ?? []);
  const remainingAllowedIds = REMEDIAL_SKILL_ORDER.filter((id) => !resolvedSet.has(id));
  if (remainingAllowedIds.length === 0) {
    return [];
  }

  const effectiveLang =
    params.language && params.language !== 'auto'
      ? params.language
      : aiConfig.feedbackLanguage ?? 'auto';
  const langName = getAiLanguagePromptName(resolveSupportedLanguage(effectiveLang));

  // Collect up to 24 concrete recent mistake items
  const mistakeLines: string[] = [];
  for (const rec of params.roadmapHistory.slice(-15).reverse()) {
    for (const m of rec.mistakes) {
      mistakeLines.push(
        `[Roadmap/${m.kind}] "${m.en}" | expected="${m.expected}" | user="${m.lastUserAnswer}" | misses=${m.wrongCount}`
      );
      if (mistakeLines.length >= 16) break;
    }
    if (mistakeLines.length >= 16) break;
  }

  for (const ev of params.reviewHistory.slice(-80).reverse()) {
    if (ev.isCorrect) continue;
    const card = params.cardsById.get(ev.cardId);
    if (!card) continue;
    mistakeLines.push(`[Recall/${card.type}/${card.level}] "${card.en}" (expected: ${card.acceptedTr[0] ?? ''})`);
    if (mistakeLines.length >= 24) break;
  }

  const activeConceptLines = params.conceptNotes
    .filter((c) => c.stage < 3 && c.masteredAt === null)
    .slice(0, 8)
    .map((c) => `[Concept] "${c.focusToken}" (${c.label}) from "${c.sourceEn}"`);

  if (mistakeLines.length === 0 && activeConceptLines.length === 0) {
    return [];
  }

  const allowedIds = remainingAllowedIds.join(', ');
  const resolvedClause =
    resolvedSet.size > 0
      ? `The learner has ALREADY mastered these workshops with >=80% accuracy — DO NOT return or mention them: [${Array.from(resolvedSet).join(', ')}]. Focus strictly on remaining unmastered gaps.`
      : '';
  const systemPrompt = [
    `You are an expert English diagnostic analyst reviewing a Turkish learner’s real error history. Write all "reason" explanations in concise, natural ${langName} (max 150 chars each).`,
    `Map the learner’s REAL recurring blind spots strictly to these allowed skill IDs: [${allowedIds}].`,
    ...(resolvedClause ? [resolvedClause] : []),
    'Identify up to 5 highest-impact weaknesses (for instance: confusing should vs have to, was vs were, passive voice be+V3, word order syntax, missing listening function words, phrasal verbs, time clauses).',
    'NEVER invent mistakes not present in the log.',
    `Respond ONLY with valid JSON: {"weaknesses": [{"skillId": "one of allowed IDs", "severity": "critical" | "focus" | "polish", "reason": "sharp personal diagnosis in ${langName}", "evidenceSample": "short quoted example from the log"}]}`,
  ].join('\n');

  const userPrompt = [
    'Recent Mistakes Log:',
    ...mistakeLines,
    ...(activeConceptLines.length > 0 ? ['', 'Active Concept Gaps:', ...activeConceptLines] : []),
  ].join('\n');

  const { text } = await callChatCompletionWithSource(
    aiConfig,
    systemPrompt,
    userPrompt,
    22_000,
    650
  );
  const parsed = extractJsonObject(text);
  if (!parsed || !Array.isArray(parsed.weaknesses)) return [];

  const out: AiDiagnosedOverlayItem[] = [];
  const seen = new Set<WeakSkillId>();
  for (const raw of parsed.weaknesses) {
    const obj = raw as Record<string, unknown> | null;
    if (!obj || typeof obj !== 'object') continue;
    const rawId = typeof obj.skillId === 'string' ? obj.skillId.trim() : '';
    if (!isValidWeakSkillId(rawId) || resolvedSet.has(rawId) || seen.has(rawId)) continue;
    seen.add(rawId);
    const reason = typeof obj.reason === 'string' ? obj.reason.trim().slice(0, 200) : '';
    if (!reason) continue;
    const sevRaw = typeof obj.severity === 'string' ? obj.severity.trim() : 'focus';
    const severity: AiDiagnosedOverlayItem['severity'] =
      sevRaw === 'critical' || sevRaw === 'focus' || sevRaw === 'polish' ? sevRaw : 'focus';
    const evidenceSample =
      typeof obj.evidenceSample === 'string' && obj.evidenceSample.trim()
        ? obj.evidenceSample.trim().slice(0, 120)
        : undefined;
    out.push({ skillId: rawId, reason, severity, evidenceSample });
    if (out.length >= 5) break;
  }

  return out;
}

/**
 * Answer a learner's on-the-spot question about the current exercise or sentence
 * (e.g. "neden run kullanılıyor çünkü run koşmak?") with clear, concise logic,
 * everyday bonus examples, and an optional suggested focus token to pin as a weak spot.
 */
export async function askAiTutorWithContext(
  params: {
    question: string;
    context: AiTutorContext;
    history?: AiTutorChatTurn[];
    language?: FeedbackLanguageMode;
  },
  aiConfig: AiConfig
): Promise<{
  answer: string;
  suggestedFocusToken?: string;
  providerIndex?: AiProviderIndex;
}> {
  if (!hasConfiguredAiProvider(aiConfig)) {
    throw new Error('Enable AI and add a free API key in Settings → AI Evaluation first.');
  }

  const question = params.question.trim().slice(0, 400);
  if (!question) {
    throw new Error('Question cannot be empty.');
  }

  const effectiveLang =
    params.language && params.language !== 'auto'
      ? params.language
      : aiConfig.feedbackLanguage ?? 'auto';
  const langName = getAiLanguagePromptName(resolveSupportedLanguage(effectiveLang));

  const systemPrompt = [
    `You are a friendly, sharp English-to-Turkish private tutor answering a learner's live question mid-lesson. Respond ONLY in clear, natural ${langName}.`,
    'Address the learner’s EXACT question first (e.g. if they ask why "run" is used in "We\'ve run out of milk" when "run" means koşmak, explain clearly that "run out of" is a phrasal verb meaning "tükenmek/bitmek", and note any tense/V3 nuance like run-ran-run after "have").',
    'Give 1-2 short, modern everyday examples when helpful.',
    'Keep "answer" concise, structured, and easy to read inside a compact popup (max ~550 characters, plain text with short line breaks — no heavy markdown tables or walls of text).',
    'Set "suggestedFocusToken" to the single English word/pattern worth remembering (e.g. "run out of", "were", "have to") or null.',
    'Respond ONLY with valid JSON: {"answer": "...", "suggestedFocusToken": "short English phrase or null"}',
  ].join('\n');

  const historyBlock = (params.history ?? [])
    .slice(-4)
    .map((h) => `${h.role === 'user' ? 'Learner' : 'Tutor'}: ${h.text.slice(0, 240)}`)
    .join('\n');

  const ctx = params.context;
  const userPrompt = [
    `Current English target: "${ctx.sentenceEn}"`,
    ctx.meaningTr ? `Turkish meaning: "${ctx.meaningTr}"` : '',
    ctx.promptText && ctx.promptText !== ctx.sentenceEn ? `Exercise prompt: "${ctx.promptText}"` : '',
    ctx.expectedAnswer && ctx.expectedAnswer !== ctx.sentenceEn
      ? `Expected answer: "${ctx.expectedAnswer}"`
      : '',
    ctx.userAnswer ? `Learner's attempt: "${ctx.userAnswer}"` : '',
    ctx.existingExplanation ? `Shown explanation: "${ctx.existingExplanation}"` : '',
    historyBlock ? `Previous Q&A on this card:\n${historyBlock}` : '',
    `Learner's question right now: "${question}"`,
  ]
    .filter(Boolean)
    .join('\n');

  const { text, providerIndex } = await callChatCompletionWithSource(
    aiConfig,
    systemPrompt,
    userPrompt,
    22_000,
    560
  );

  const parsed = extractJsonObject(text);
  const rawAnswer =
    parsed && typeof parsed.answer === 'string' && parsed.answer.trim()
      ? parsed.answer.trim()
      : text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();

  if (!rawAnswer) {
    throw new Error('AI returned an empty reply.');
  }

  const suggestedFocusToken =
    parsed &&
    typeof parsed.suggestedFocusToken === 'string' &&
    parsed.suggestedFocusToken.trim().length >= 2
      ? parsed.suggestedFocusToken.trim().slice(0, 48)
      : undefined;

  return {
    answer: rawAnswer.slice(0, 950),
    suggestedFocusToken,
    providerIndex,
  };
}

/**
 * Generate independent, sentence-specific Turkish grammar lessons (1 to 3 distinct points),
 * where each rule has its own verbatim displayed & spoken explanation (`explanationTr`),
 * exact highlight target (`focusPhrase`), headline, and 2 tailored everyday examples.
 */
export async function generateAiGrammarCoach(
  params: {
    sentenceEn: string;
    meaningTr?: string;
    detectedRules?: string[];
    language?: FeedbackLanguageMode;
  },
  aiConfig: AiConfig
): Promise<AiGrammarCoachResult> {
  if (!hasConfiguredAiProvider(aiConfig)) {
    throw new Error('AI modu için Ayarlar → AI - API Ayarları bölümünden ücretsiz bir anahtar eklemelisin.');
  }

  const sentenceEn = params.sentenceEn.trim().slice(0, 320);
  if (!sentenceEn) {
    throw new Error('Açıklanacak İngilizce cümle bulunamadı.');
  }

  const systemPrompt = [
    'You are a master Turkish English teacher creating independent mini voice-lessons for the MOST VALUABLE learning points inside one English sentence.',
    'Analyze the sentence independently — DO NOT just pick surface-level textbook tags. Think like a sharp Turkish learner reading this exact sentence for the first time and ask: "What is the REAL trap, hidden meaning, idiom, preposition nuance, or structural trick here?"',
    'STRICT LINGUISTIC ACCURACY & GENERAL-TO-CONTEXTUAL TEACHING RULES (CRITICAL — ZERO MISINFORMATION):',
    '- NEVER attribute a neighboring verb’s meaning to a preposition, particle, or noun! (BAD/WRONG: saying "against" means "yaslanmak" or calling "against" a verb in "He was leaning against the wall" — "lean" is the verb meaning "yaslanmak", NOT "against"!).',
    '- NEVER mislabel parts of speech (never call an edat/preposition a "fiil", or a noun an "edat").',
    '- ALWAYS teach a preposition or keyword’s GENERAL core meaning first, then explain how and why it works in this sentence! Example for "He was leaning against the wall": explain that [[against]] is a preposition (edat) whose general meaning is "-e karşı / zıt yönde" or "bir yüzeye temas ederek, dayanarak", whereas [[lean]] is the verb meaning "yaslanmak / eğilmek". Because Turkish says "duvara (-e) yaslanmak", learners mistakenly want to use [[to]], but English uses [[against]] whenever something presses onto or rests in physical contact with a surface (just like [[put the ladder against the wall]], alongside its general opposition sense [[against the rules]]).',
    '- In any verb + preposition collocation (e.g. "lean against", "depend on", "apologize for", "talk over"), clearly separate what the verb means vs what the preposition generally does and why English pairs them together.',
    'STRICT PEDAGOGICAL PRIORITY (order items from #1 most insightful to #3):',
    '1. FIRST PRIORITY — Preposition functions & nuances, verb+preposition collocations, phrasal verbs, non-literal usages, and Turkish-to-English interference traps (e.g., general meaning of "against" + why English says "lean against" instead of "lean to"; general meaning of "over" + why "over a cup of coffee" means "kahve eşliğinde"; "run out of" = tükenmek; "instead of" = yerine).',
    '2. SECOND PRIORITY — Meaningful grammar & phrase structures (tenses with nuance like past continuous "was leaning" for an ongoing action at a past moment, modals, passive, conditionals, gerund/infinitive, relative/time clauses, measure phrases like "a cup of", contrast/cause linkers).',
    '3. LOWEST PRIORITY — Basic A1 mechanics like plain "a/an/the" or simple regular "-ed" past tense. SKIP trivial "a/an" or plain "-ed" whenever the sentence already has richer prepositional, lexical, or structural teaching points!',
    'Return 1 to 3 DISTINCT, high-value items (never invent structures absent from the sentence). Each item is listened to SEPARATELY, so each must stand completely on its own without referring to other items and without greetings like "Merhaba!".',
    'For EACH item return:',
    '- "ruleTitle": ultra-short 2-4 word accurate Turkish tab title (e.g. "against: Karşı / Yüzeye Temas", "lean against: Duvara Yaslanmak", "over: Eşliğinde", "was leaning: Geçmişte Süreç"). NEVER write a false title like "against: Yaslanmak"!',
    '- "focusPhrase": exact verbatim substring from the English sentence so the UI highlights it (e.g. "against the wall", "leaning against", "was leaning").',
    '- "headlineTr": 1 punchy, linguistically accurate golden takeaway sentence in natural Turkish (max 95 chars; use normal quotes for English words here, NO [[...]] brackets).',
    '- "explanationTr": 3-4 clear, calm, natural Turkish sentences (NO anglicisms like "spesifikleştirmek" or "artikl"; NO bullet marks, NO markdown asterisks, NO emojis, NO codes like (V1)). State BOTH the general meaning/function of the word or preposition AND how it combines with the verb/context in this sentence. This text is BOTH displayed AND read aloud verbatim. HIDDEN VOICE TAG RULE: wrap ONLY English words/phrases inside [[...]] (e.g. [[against]], [[lean]], [[lean against]], [[to]]) — NEVER put quotes around [[...]]. For Turkish quoted words/meanings use normal double quotes "..." (e.g. "-e karşı", "yaslanmak", "dayanarak"). The UI automatically hides [[...]] as clean quotes while our bilingual engine sends ONLY [[...]] to the English voice and EVERYTHING ELSE to the Turkish voice!',
    '- "examples": 2 short, modern everyday examples fitting THIS usage: [{"en": "...", "tr": "..."}].',
    'Respond ONLY with valid JSON:',
    '{"items":[{"ruleTitle":"...","focusPhrase":"...","headlineTr":"...","explanationTr":"...","examples":[{"en":"...","tr":"..."}]}]}',
  ].join('\n');

  const userPrompt = [
    `English sentence: "${sentenceEn}"`,
    params.meaningTr ? `Turkish meaning: "${params.meaningTr}"` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const { text, providerIndex } = await callChatCompletionWithSource(
    aiConfig,
    systemPrompt,
    userPrompt,
    24_000,
    1050
  );

  const parsed = extractJsonObject(text);
  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error('AI gramer açıklaması beklenen biçimde dönmedi. Lütfen tekrar dene.');
  }

  const items: AiGrammarCoachItem[] = [];
  for (const raw of parsed.items.slice(0, 3)) {
    if (!raw || typeof raw !== 'object') continue;
    const obj = raw as Record<string, unknown>;
    const stripBrackets = (s: string): string => s.replace(/\[\[([^\[\]\n]+)\]\]/g, '"$1"').trim();
    const ruleTitle =
      typeof obj.ruleTitle === 'string'
        ? obj.ruleTitle.replace(/\[\[|\]\]/g, '').trim().slice(0, 48)
        : '';
    const focusPhrase =
      typeof obj.focusPhrase === 'string'
        ? obj.focusPhrase.replace(/\[\[|\]\]/g, '').trim().slice(0, 64)
        : '';
    const headlineTr =
      typeof obj.headlineTr === 'string' && obj.headlineTr.trim()
        ? stripBrackets(obj.headlineTr).slice(0, 110)
        : ruleTitle;
    const rawExplanationTr =
      typeof obj.explanationTr === 'string'
        ? obj.explanationTr
            .replace(/[*#_`]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 560)
        : '';
    if (!ruleTitle || !rawExplanationTr) continue;

    const rawExamples = Array.isArray(obj.examples) ? obj.examples : [];
    const examples: Array<{ en: string; tr: string }> = [];
    for (const ex of rawExamples.slice(0, 2)) {
      if (!ex || typeof ex !== 'object') continue;
      const eObj = ex as Record<string, unknown>;
      const en = typeof eObj.en === 'string' ? eObj.en.trim().slice(0, 160) : '';
      const tr = typeof eObj.tr === 'string' ? eObj.tr.trim().slice(0, 180) : '';
      if (en && tr) examples.push({ en, tr });
    }

    const explanationTr = autoTagEnglishQuotesForCoach(rawExplanationTr, [
      sentenceEn,
      focusPhrase,
      ...examples.map((e) => e.en),
    ]);

    items.push({ ruleTitle, focusPhrase, headlineTr, explanationTr, examples });
  }

  if (items.length === 0) {
    throw new Error('AI bu cümle için açıklama maddesi üretemedi.');
  }

  return {
    items,
    providerIndex,
  };
}
