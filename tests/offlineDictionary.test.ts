import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildOfflineDictionaryIndex,
  lookupOfflineWord,
} from '../src/shared/offlineDictionary.ts';
import {
  REMEDIAL_SKILL_CATALOG,
  REMEDIAL_SKILL_ORDER,
} from '../src/shared/remedialCatalog.ts';
import type { Card } from '../src/shared/types.ts';
import {
  isOffsetInsideEnglishQuote,
  shouldAllowWordHover,
} from '../src/shared/wordHoverTooltip.ts';

const CARDS_PATH = path.resolve(process.cwd(), 'public', 'data', 'cards.json');
const ALL_CARDS: Card[] = JSON.parse(fs.readFileSync(CARDS_PATH, 'utf8')) as Card[];
const DICT_INDEX = buildOfflineDictionaryIndex(ALL_CARDS);

test('offline dictionary resolves direct cards and enriches single-meaning words with Turkish & English synonyms', () => {
  const bad = lookupOfflineWord(DICT_INDEX, 'bad');
  assert.ok(bad, 'expected entry for "bad"');
  assert.ok(bad.meaningsTr.length >= 3, `expected >= 3 Turkish meanings for "bad", got ${bad.meaningsTr.join(', ')}`);
  assert.ok(bad.meaningsTr.includes('kötü'));
  assert.ok(bad.englishSynonyms && bad.englishSynonyms.length >= 2, 'expected English synonyms for "bad"');

  const hospital = lookupOfflineWord(DICT_INDEX, 'hospital');
  assert.ok(hospital, 'expected entry for "hospital"');
  assert.ok(hospital.meaningsTr.includes('hastane'));
  assert.ok(hospital.meaningsTr.length >= 2, 'expected Turkish synonyms for "hospital"');

  const awesome = lookupOfflineWord(DICT_INDEX, 'awesome');
  assert.ok(awesome, 'expected entry for "awesome"');
  assert.ok(awesome.meaningsTr.length >= 3);
  assert.ok(awesome.englishSynonyms && awesome.englishSynonyms.includes('amazing'));

  const bug = lookupOfflineWord(DICT_INDEX, 'bug');
  assert.ok(bug, 'expected entry for "bug"');
  assert.ok(!bug.posTr?.includes('isim / isim'), `POS should be deduplicated, got "${bug.posTr}"`);
});

test('offline dictionary lemmatizes regular English inflections with Turkish inflection notes', () => {
  const cases: Array<[string, string]> = [
    ['teammates', 'teammate'],
    ['listening', 'listen'],
    ['stopped', 'stop'],
    ['studies', 'study'],
    ['knives', 'knife'],
    ['trying', 'try'],
    ['dying', 'die'],
    ['louder', 'loud'],
    ['bravely', 'brave'],
    ["uncle's", 'uncle'],
    ['galaxies', 'galaxy'],
    ['customizing', 'customize'],
  ];

  for (const [query, expectedLemma] of cases) {
    const hit = lookupOfflineWord(DICT_INDEX, query);
    assert.ok(hit, `expected offline lookup hit for "${query}"`);
    assert.equal(
      hit.lemma.toLowerCase(),
      expectedLemma.toLowerCase(),
      `expected "${query}" -> lemma "${expectedLemma}", got "${hit.lemma}"`
    );
    assert.ok(hit.meaningsTr.length >= 1);
  }
});

test('offline dictionary resolves irregular verbs, plurals, comparatives, auxiliaries, and contractions', () => {
  const irregularCases: Array<[string, string]> = [
    ['went', 'go'],
    ['gone', 'go'],
    ['bought', 'buy'],
    ['made', 'make'],
    ['taken', 'take'],
    ['children', 'child'],
    ['teeth', 'tooth'],
    ['farther', 'far'],
    ['farthest', 'far'],
    ['worst', 'worst'],
    ['was', 'be'],
    ['were', 'be'],
    ['been', 'be'],
    ['has', 'have'],
    ['had', 'have'],
    ['did', 'do'],
    ["don't", 'do not'],
    ['don’t', 'do not'],
    ["didn't", 'did not'],
    ["can't", 'cannot'],
    ["won't", 'will not'],
    ["i've", 'i have'],
    ["should've", 'should have'],
    ["they're", 'they are'],
    ["let's", 'let us'],
  ];

  for (const [query, expectedLemma] of irregularCases) {
    const hit = lookupOfflineWord(DICT_INDEX, query);
    assert.ok(hit, `expected hit for "${query}"`);
    assert.equal(
      hit.lemma.toLowerCase(),
      expectedLemma.toLowerCase(),
      `expected "${query}" -> "${expectedLemma}", got "${hit.lemma}"`
    );
    assert.ok(hit.meaningsTr.length >= 1, `expected at least one Turkish meaning for "${query}"`);
  }

  for (const multiWord of ['went', 'better', 'worst', 'was', "don't", "should've", 'children']) {
    const hit = lookupOfflineWord(DICT_INDEX, multiWord);
    assert.ok(hit && hit.meaningsTr.length >= 2, `expected multiple Turkish meanings for "${multiWord}"`);
  }

  const went = lookupOfflineWord(DICT_INDEX, 'went');
  assert.ok(went?.posTr?.startsWith('fiil'), `expected "went" POS to start with "fiil", got "${went?.posTr}"`);
});

test('offline dictionary normalizes US and UK spelling variants cleanly', () => {
  const variants = [
    'favorite',
    'theater',
    'colorful',
    'neighborhood',
    'defense',
    'rumors',
    'kilometers',
    'customising',
  ];

  for (const word of variants) {
    const hit = lookupOfflineWord(DICT_INDEX, word);
    assert.ok(hit, `expected US/UK spelling hit for "${word}"`);
    assert.ok(hit.meaningsTr.length >= 1);
  }
});

test('word hover language guard blocks Turkish words and homographs while allowing English sentences and quotes', () => {
  // Reject Turkish diacritics
  assert.equal(
    shouldAllowWordHover({
      word: 'şifre',
      contextText: 'Şifreni unutma',
      wordStartOffset: 0,
    }),
    false
  );

  // Reject EN/TR homographs inside Turkish sentences (with or without diacritics)
  const trDiacritic = 'Her son yeni bir başlangıçtır ve on dakika sonra biter.';
  for (const homograph of ['Her', 'son', 'on']) {
    assert.equal(
      shouldAllowWordHover({
        word: homograph,
        contextText: trDiacritic,
        wordStartOffset: trDiacritic.indexOf(homograph),
      }),
      false,
      `expected Turkish homograph "${homograph}" to be blocked in Turkish sentence`
    );
  }

  const trAscii = 'Her son bir baslangic ve ben on dakika sonra gelirim';
  for (const homograph of ['Her', 'son', 'ben', 'on']) {
    assert.equal(
      shouldAllowWordHover({
        word: homograph,
        contextText: trAscii,
        wordStartOffset: trAscii.indexOf(homograph),
      }),
      false,
      `expected ASCII Turkish homograph "${homograph}" to be blocked`
    );
  }

  // Allow the SAME homographs inside explicit English containers or English sentences
  const enSentence = 'You should call her son on Friday at ten.';
  for (const word of ['her', 'son', 'on', 'at']) {
    assert.equal(
      shouldAllowWordHover({
        word,
        contextText: enSentence,
        wordStartOffset: enSentence.indexOf(word),
      }),
      true,
      `expected English "${word}" to be allowed in English sentence`
    );
  }

  assert.equal(
    shouldAllowWordHover({
      word: 'her',
      contextText: 'her',
      wordStartOffset: 0,
      explicitLang: 'en',
    }),
    true
  );

  // Mixed Turkish explanation with quoted English example
  const mixedTr = 'İngilizcede öneri verirken "You should call her" deriz, her durumda değil.';
  const quotedHerIdx = mixedTr.indexOf('her"');
  const turkishHerIdx = mixedTr.lastIndexOf('her ');
  assert.equal(isOffsetInsideEnglishQuote(mixedTr, quotedHerIdx), true);
  assert.equal(isOffsetInsideEnglishQuote(mixedTr, turkishHerIdx), false);

  assert.equal(
    shouldAllowWordHover({
      word: 'her',
      contextText: mixedTr,
      wordStartOffset: quotedHerIdx,
      explicitLang: 'tr',
    }),
    true,
    'expected quoted English word inside Turkish transcript to be allowed'
  );
  assert.equal(
    shouldAllowWordHover({
      word: 'her',
      contextText: mixedTr,
      wordStartOffset: turkishHerIdx,
      explicitLang: 'tr',
    }),
    false,
    'expected unquoted Turkish homograph inside Turkish transcript to be blocked'
  );
});

test('offline dictionary achieves >=97% token coverage across cards.json and >=99.5% across Remedial workshops', () => {
  const fullFreq = new Map<string, number>();
  const remFreq = new Map<string, number>();

  const scan = (text: string | undefined, target: Map<string, number>): void => {
    if (!text) return;
    const cleaned = text.replace(/[’‘`]/g, "'");
    for (const m of cleaned.toLowerCase().matchAll(/[a-z]+(?:[-'][a-z]+)*/g)) {
      const w = m[0];
      if (w.length === 1 && w !== 'i' && w !== 'a') continue;
      target.set(w, (target.get(w) ?? 0) + 1);
    }
  };

  for (const card of ALL_CARDS) {
    scan(card.en, fullFreq);
    scan(card.exampleEn, fullFreq);
  }

  for (const id of REMEDIAL_SKILL_ORDER) {
    const spec = REMEDIAL_SKILL_CATALOG[id];
    for (const ex of spec.briefing.examples) {
      scan(ex.en, fullFreq);
      scan(ex.en, remFreq);
    }
    for (const duel of spec.duels) {
      scan(duel.fullSentence, fullFreq);
      scan(duel.fullSentence, remFreq);
      for (const ch of duel.choices) {
        scan(ch, fullFreq);
        scan(ch, remFreq);
      }
    }
    for (const sf of spec.spotFixes) {
      scan(sf.correctedSentence, fullFreq);
      scan(sf.correctedSentence, remFreq);
      for (const tok of sf.buggyTokens) {
        scan(tok, fullFreq);
        scan(tok, remFreq);
      }
      for (const fc of sf.fixChoices) {
        scan(fc, fullFreq);
        scan(fc, remFreq);
      }
    }
    for (const sc of spec.scenarios) {
      for (const ch of sc.choices) {
        scan(ch, fullFreq);
        scan(ch, remFreq);
      }
    }
  }

  const measureCoverage = (freq: Map<string, number>): number => {
    let total = 0;
    let covered = 0;
    for (const [word, count] of freq.entries()) {
      total += count;
      if (lookupOfflineWord(DICT_INDEX, word)) {
        covered += count;
      }
    }
    return total > 0 ? (covered / total) * 100 : 100;
  };

  const fullPct = measureCoverage(fullFreq);
  const remPct = measureCoverage(remFreq);

  assert.ok(fullPct >= 97.0, `Expected full corpus offline coverage >= 97%, got ${fullPct.toFixed(2)}%`);
  assert.ok(remPct >= 99.5, `Expected Remedial catalog offline coverage >= 99.5%, got ${remPct.toFixed(2)}%`);
});
