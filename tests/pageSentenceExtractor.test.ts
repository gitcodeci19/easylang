import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectTextLanguage,
  selectPageSentenceCandidates,
  splitBlockIntoSentences,
} from '../src/shared/pageSentenceExtractor.ts';

test('splitBlockIntoSentences keeps abbreviations and decimals intact while splitting real sentences', () => {
  const input =
    'Dr. Smith measured a 3.14 ratio today. She checked the logs, e.g. recent metrics, before noon! Did it work?';
  const out = splitBlockIntoSentences(input);

  assert.equal(out.length, 3);
  assert.equal(out[0], 'Dr. Smith measured a 3.14 ratio today.');
  assert.equal(out[1], 'She checked the logs, e.g. recent metrics, before noon!');
  assert.equal(out[2], 'Did it work?');
});

test('selectPageSentenceCandidates detects English-majority page -> en-to-tr and avoids fragments', () => {
  const result = selectPageSentenceCandidates([
    {
      blockIndex: 0,
      text: 'ALL RIGHTS RESERVED. Accept all cookies to continue.',
      inViewport: true,
      tagPriority: 3,
    },
    {
      blockIndex: 1,
      text: 'Researchers recently discovered that spaced repetition dramatically improves long-term vocabulary memory.',
      inViewport: true,
      tagPriority: 3,
    },
    {
      blockIndex: 2,
      text: 'const x = { a: 1 }; https://example.com/docs/api/v2/reference',
      inViewport: true,
      tagPriority: 1,
    },
  ]);

  assert.equal(result.pageLang, 'en');
  assert.equal(result.direction, 'en-to-tr');
  assert.equal(result.candidates.length, 1);
  assert.match(result.candidates[0]!.text, /spaced repetition dramatically improves/i);
});

test('selectPageSentenceCandidates detects Turkish-majority page -> tr-to-en and skips stray English quotes', () => {
  const result = selectPageSentenceCandidates([
    {
      blockIndex: 0,
      text: 'Düzenli uyku ve dengeli beslenme, gün içindeki odaklanma süresini doğrudan artırır.',
      inViewport: true,
      tagPriority: 3,
    },
    {
      blockIndex: 1,
      text: 'Bilim insanları bu durumun hafıza üzerinde önemli bir etkisi olduğunu belirtiyor.',
      inViewport: false,
      tagPriority: 3,
    },
    {
      blockIndex: 2,
      text: 'This single English sentence should not be picked on a Turkish article page.',
      inViewport: true,
      tagPriority: 3,
    },
  ]);

  assert.equal(result.pageLang, 'tr');
  assert.equal(result.direction, 'tr-to-en');
  assert.equal(result.candidates.length, 2);
  assert.ok(result.candidates.every((c) => c.lang === 'tr'));
  // Viewport Turkish block should rank first
  assert.equal(result.candidates[0]!.blockIndex, 0);
});

test('detectTextLanguage classifies pure Turkish and English samples reliably', () => {
  assert.equal(
    detectTextLanguage('Sabah kahvemi içerken yeni makaleyi baştan sona okudum.').lang,
    'tr'
  );
  assert.equal(
    detectTextLanguage(
      'Istanbulun ne kadar fukara ne kadar izbe yeri varsa apartmanlara ilk kutulari TurkNet getirdi.'
    ).lang,
    'tr'
  );
  assert.equal(
    detectTextLanguage('While drinking my morning coffee, I read the new article from start to finish.').lang,
    'en'
  );
});

test('selectPageSentenceCandidates excludes already asked sentences and diversifies top order when enabled', () => {
  const blocks = [
    {
      blockIndex: 0,
      text: 'Artificial intelligence tools transform how developers review unfamiliar codebases every day.',
      inViewport: true,
      tagPriority: 3,
    },
    {
      blockIndex: 1,
      text: 'Consistent reading habits strengthen vocabulary retention far better than passive scrolling.',
      inViewport: true,
      tagPriority: 3,
    },
    {
      blockIndex: 2,
      text: 'Careful software testing prevents subtle regressions when new browser features roll out.',
      inViewport: true,
      tagPriority: 3,
    },
  ];

  const firstPass = selectPageSentenceCandidates(blocks, new Set(), 12);
  assert.equal(firstPass.candidates.length, 3);
  const alreadyAsked = firstPass.candidates[0]!.text;

  // Exact or citation-annotated variants of an already-asked sentence must never be selected again.
  const excluded = new Set([`${alreadyAsked}[12]`]);
  const secondPass = selectPageSentenceCandidates(blocks, excluded, 12);
  assert.equal(secondPass.candidates.length, 2);
  assert.ok(secondPass.candidates.every((c) => c.text !== alreadyAsked));

  // With diversify enabled, different RNG outputs can reorder top candidates.
  const seqA = [0.05, 0.95, 0.5];
  let idxA = 0;
  const orderA = selectPageSentenceCandidates(blocks, new Set(), 12, {
    diversify: true,
    randomFn: () => seqA[idxA++] ?? 0.5,
  }).candidates.map((c) => c.blockIndex);

  const seqB = [0.95, 0.05, 0.5];
  let idxB = 0;
  const orderB = selectPageSentenceCandidates(blocks, new Set(), 12, {
    diversify: true,
    randomFn: () => seqB[idxB++] ?? 0.5,
  }).candidates.map((c) => c.blockIndex);

  assert.notDeepEqual(orderA, orderB);
});

test('selectPageSentenceCandidates filters statistical bullet rows and strips leading checkmarks with zero AI tokens', () => {
  const blocks = [
    {
      blockIndex: 0,
      text: 'Toplam Fiber Abone: 10,70 milyon (Yıllık +%22,0 | Çeyreklik +%3,8 | Pazar payı: %50,5).',
      inViewport: true,
      tagPriority: 2,
    },
    {
      blockIndex: 1,
      text: 'Hız Dağılımı: 50-100 Mbps: %30,7 | 35-50 Mbps: %23,6 | 100 Mbps üzeri: %17,3.',
      inViewport: true,
      tagPriority: 2,
    },
    {
      blockIndex: 2,
      text: 'Aylık Ortalama Kullanım: Sabit 324,7 GB | Mobil 23,3 GB.',
      inViewport: true,
      tagPriority: 2,
    },
    {
      blockIndex: 3,
      text: '✔️ Resmi olarak fiber internet kullanıcı sayısı bakır internet kullananları geçti.',
      inViewport: true,
      tagPriority: 3,
    },
  ];

  const result = selectPageSentenceCandidates(blocks, new Set(), 12);
  assert.equal(result.pageLang, 'tr');
  assert.equal(result.direction, 'tr-to-en');
  assert.equal(result.candidates.length, 1);
  assert.equal(
    result.candidates[0]!.text,
    'Resmi olarak fiber internet kullanıcı sayısı bakır internet kullananları geçti.'
  );
});
