import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractJsonObject,
  getConfiguredProviders,
  orderProvidersForExecution,
  resolveFeedbackLanguage,
  sanitizeHallucinatedOmission,
  selectActiveProvider,
} from '../src/background/aiEvaluator.ts';
import type { AiConfig } from '../src/shared/types.ts';

test('extractJsonObject parses plain JSON, fenced JSON, and JSON embedded in prose', () => {
  assert.deepEqual(
    extractJsonObject('{"isCorrect": true, "note": "Doğru çeviri."}'),
    { isCorrect: true, note: 'Doğru çeviri.' }
  );

  assert.deepEqual(
    extractJsonObject('```json\n{"isCorrect": false, "note": "Farklı anlam."}\n```'),
    { isCorrect: false, note: 'Farklı anlam.' }
  );

  assert.deepEqual(
    extractJsonObject('Değerlendirme:\n{"isCorrect": true, "note": "Uygun"}\nTeşekkürler.'),
    { isCorrect: true, note: 'Uygun' }
  );

  assert.equal(extractJsonObject('geçersiz yanıt'), null);
});

test('3-tier AI provider chain (AI1 -> AI2 -> AI3) respects enabled flags and sticky cooldown ordering', () => {
  const cfg: AiConfig = {
    enabled: true,
    alwaysEvaluate: true,
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: 'dummy-key-1',
    model: 'qwen/qwen3.8-27b',
    systemPrompt: 'sys',
    fallbackEnabled: true,
    fallbackBaseUrl: 'https://api.tokenlab.amd.com/v1',
    fallbackApiKey: 'dummy-key-2',
    fallbackModel: 'DeepSeek-V4-Flash',
    fallback2Enabled: true,
    fallback2BaseUrl: 'https://integrate.api.nvidia.com/v1',
    fallback2ApiKey: 'dummy-key-3',
    fallback2Model: 'google/gemma-4-31b-it',
  };

  const providers = getConfiguredProviders(cfg);
  assert.deepEqual(
    providers.map((p) => [p.index, p.config.model]),
    [
      [1, 'qwen/qwen3.8-27b'],
      [2, 'DeepSeek-V4-Flash'],
      [3, 'google/gemma-4-31b-it'],
    ]
  );

  const now = 1_000_000;
  // When AI1 and AI2 are both in cooldown, execution starts with AI3 and keeps AI1/AI2 as last resort
  const ordered = orderProvidersForExecution(
    providers,
    { 1: now + 60_000, 2: now + 30_000 },
    now
  );
  assert.deepEqual(
    ordered.map((p) => p.index),
    [3, 1, 2]
  );

  const active = selectActiveProvider(providers, { 1: now + 60_000 }, now);
  assert.equal(active.provider?.index, 2);
  assert.equal(active.activeUntil, now + 60_000);
});

test('resolveFeedbackLanguage honors explicit setting and browser language auto-detection', () => {
  assert.equal(resolveFeedbackLanguage('tr', 'en-US'), 'tr');
  assert.equal(resolveFeedbackLanguage('en', 'tr-TR'), 'en');
  assert.equal(resolveFeedbackLanguage('fr', 'en-US'), 'fr');
  assert.equal(resolveFeedbackLanguage('es', 'en-US'), 'es');
  assert.equal(resolveFeedbackLanguage('ja', 'en-US'), 'ja');
  assert.equal(resolveFeedbackLanguage('auto', 'tr-TR'), 'tr');
  assert.equal(resolveFeedbackLanguage('auto', 'fr-FR'), 'fr');
  assert.equal(resolveFeedbackLanguage('auto', 'ja-JP'), 'ja');
  assert.equal(resolveFeedbackLanguage('auto', 'en-US'), 'en');
  assert.equal(resolveFeedbackLanguage(undefined, 'tr-TR'), 'tr');
});

test('sanitizeHallucinatedOmission strips hallucinated missing-word note and weakPoint when word is in userAnswer', () => {
  const hallucinated = sanitizeHallucinatedOmission(
    'Çok geç oldu, filmi yarıda kesip eve gidelim.',
    "Cümlenin anlamı doğru aktarılmış; 'eve' detayı atlanmış olsa da genel mesaj (filmi kesip gitmek) korunmuştur.",
    {
      label: 'Yön ve Yer Belirtme',
      token: 'go home',
      explanation: "İngilizce 'go home' ifadesi Türkçeye çevrilirken 'eve' yön zarfı eklenerek 'eve gidelim' şeklinde tamamlanmalıdır.",
    }
  );
  assert.equal(hallucinated.note, undefined);
  assert.equal(hallucinated.weakPoint, undefined);

  // Legitimate omission (user actually omitted 'eve') is preserved
  const genuine = sanitizeHallucinatedOmission(
    'Çok geç oldu, filmi yarıda kesip gidelim.',
    "Cümlenin anlamı doğru aktarılmış; 'eve' detayı atlanmış olsa da genel mesaj korunmuştur.",
    {
      label: 'Yön ve Yer Belirtme',
      token: 'go home',
      explanation: "İngilizce 'go home' ifadesi Türkçeye çevrilirken 'eve' yön zarfı eklenmelidir.",
    }
  );
  assert.ok((genuine.note ?? '').includes('atlanmış'));
  assert.equal(genuine.weakPoint?.label, 'Yön ve Yer Belirtme');
});
