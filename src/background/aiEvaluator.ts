import type { AnalyticsSummary } from '../shared/analytics';
import {
  getAiLanguagePromptName,
  resolveSupportedLanguage,
  type SupportedLanguageCode,
} from '../shared/i18n.ts';
import {
  type AiFailoverCooldowns,
  clearAiFailoverCooldowns,
  getAiFailoverCooldowns,
  setAiFailoverCooldown,
} from '../shared/storage.ts';
import type {
  AiConfig,
  AiProviderIndex,
  Card,
  ConceptNote,
  ConceptWeakPointInput,
  FeedbackLanguageMode,
  PageAnswerEvaluation,
  PageTranslationDirection,
  ValidatedPageChallenge,
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
  aiConfig: AiConfig
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
3. If the user's translation is natural and accurate, set "isCorrect": true, set "weakPoint": null, and keep "note" brief and encouraging.
4. When "isCorrect": false, ALWAYS populate "note" with 1-2 clear sentences explaining the exact mistake in the user's translation. Only populate "weakPoint" when there is a genuine, unmistakable grammar or vocabulary pattern to reinforce (e.g., translating Past Continuous "I was taking a walk" as Simple Past, missing "used to", or confusing a core verb).
5. Write "weakPoint.explanation" as a timeless, standalone rule ONLY about "weakPoint.token" in ${feedbackLang}. NEVER mention other unrelated phrases from the current sentence (such as 'let me know') and NEVER refer to the user's specific wrong phrasing so it makes complete sense when shown on future cards.
JSON schema: {"isCorrect": boolean, "note": "brief explanation in ${feedbackLang}", "weakPoint": {"token": "relevant English token/pattern (e.g. was taking / used to / arrive)", "label": "short grammar title in ${feedbackLang}", "explanation": "concise standalone rule ONLY for token in ${feedbackLang}"} | null}`;

  const userPrompt = [
    `Type: ${card.type === 'sentence' ? 'Sentence' : 'Word'} (${card.level})`,
    `English: ${card.en}`,
    `Reference Turkish meanings: ${card.acceptedTr.join(', ')}`,
    card.exampleEn && card.type === 'word' ? `Example sentence: ${card.exampleEn}` : '',
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
  aiConfig: AiConfig
): Promise<Card[]> {
  if (!hasConfiguredAiProvider(aiConfig)) return [];

  const systemPrompt =
    'Generate 2 short everyday English practice sentences using the target structure/word in different contexts along with natural Turkish translations. Return ONLY JSON: {"items": [{"en": "...", "tr": ["..."], "level": "A2"}]}';
  const userPrompt = [
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
      const lvlRaw = typeof item.level === 'string' ? item.level.trim().toUpperCase() : 'B1';
      const level = (validLevels.has(lvlRaw) ? lvlRaw : 'B1') as Card['level'];
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
