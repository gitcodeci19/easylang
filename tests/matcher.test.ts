import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateEnglishAnswer,
  evaluateTurkishAnswer,
  levenshteinDistance,
  normalizeTurkish,
} from '../src/shared/matcher.ts';

test('normalizeTurkish handles Turkish locale casing and punctuation', () => {
  assert.equal(normalizeTurkish('  İSTEKSİZ (çok), Gönülsüz! '), 'isteksiz gönülsüz');
});

test('evaluateTurkishAnswer matches exact, diacritic-folded, and minor typos', () => {
  const accepted = ['isteksiz', 'gönülsüz', 'çekingen'];

  const exact = evaluateTurkishAnswer('İsteksiz', accepted, 'word');
  assert.equal(exact.isCorrect, true);
  assert.equal(exact.matchKind, 'exact');

  const folded = evaluateTurkishAnswer('gonulsuz', accepted, 'word');
  assert.equal(folded.isCorrect, true);
  assert.equal(folded.matchKind, 'normalized');

  const typo = evaluateTurkishAnswer('isteksz', accepted, 'word');
  assert.equal(typo.isCorrect, true);
  assert.equal(typo.matchKind, 'fuzzy');

  const wrong = evaluateTurkishAnswer('hevesli', accepted, 'word');
  assert.equal(wrong.isCorrect, false);
});

test('evaluateTurkishAnswer evaluates sentence overlap fairly', () => {
  const accepted = ['Vaktim tükeniyor.'];
  const close = evaluateTurkishAnswer('Vaktim tukeniyor', accepted, 'sentence');
  assert.equal(close.isCorrect, true);

  const unrelated = evaluateTurkishAnswer('Hava bugün çok güzel', accepted, 'sentence');
  assert.equal(unrelated.isCorrect, false);
});

test('levenshteinDistance computes expected edit counts', () => {
  assert.equal(levenshteinDistance('araba', 'araba'), 0);
  assert.equal(levenshteinDistance('araba', 'arab'), 1);
  assert.equal(levenshteinDistance('kitap', 'defter'), 5);
  assert.equal(levenshteinDistance('abc', 'xyz'), 3);
});

test('evaluateTurkishAnswer accepts multi-synonym comma input and evaluateEnglishAnswer handles contractions and minor typos', () => {
  const spaceMeanings = ['uzay', 'alan', 'yer', 'boşluk'];
  assert.equal(evaluateTurkishAnswer('uzay', spaceMeanings, 'word').isCorrect, true);
  assert.equal(evaluateTurkishAnswer('alan', spaceMeanings, 'word').isCorrect, true);
  assert.equal(evaluateTurkishAnswer('uzay, alan', spaceMeanings, 'word').isCorrect, true);

  assert.equal(evaluateEnglishAnswer("I don't know", ['I do not know'], 'sentence').isCorrect, true);
  assert.equal(evaluateEnglishAnswer('to watch', ['watch'], 'word').isCorrect, true);
  assert.equal(evaluateEnglishAnswer('spcae', ['space'], 'word').isCorrect, true);
  assert.equal(evaluateEnglishAnswer('hello', ['goodbye'], 'word').isCorrect, false);
});

test('offline evaluator accepts rich Turkish and English paraphrases, synonyms, and register variants without AI', () => {
  // 1. "Michael Jackson died in 2009." -> öldü / ölmüştür / hayatını kaybetti / vefat etti / 2009 yılında
  const mjTarget = ["Michael Jackson 2009'da öldü."];
  assert.equal(evaluateTurkishAnswer("Michael Jackson 2009'da ölmüştür", mjTarget, 'sentence').isCorrect, true);
  assert.equal(evaluateTurkishAnswer('Michael Jackson 2009 yılında öldü', mjTarget, 'sentence').isCorrect, true);
  assert.equal(evaluateTurkishAnswer('Michael Jackson 2009 yılında hayatını kaybetti.', mjTarget, 'sentence').isCorrect, true);
  assert.equal(evaluateTurkishAnswer("Michael Jackson 2009'da vefat etti", mjTarget, 'sentence').isCorrect, true);

  // 2. "I forgot the password to my Spotify account." -> şifre / parola / hesap / üyelik / explicit pronoun
  const spotifyTrTarget = ['Spotify hesabımın şifresini unuttum.'];
  assert.equal(evaluateTurkishAnswer('Spotify hesabımın parolasını unuttum', spotifyTrTarget, 'sentence').isCorrect, true);
  assert.equal(evaluateTurkishAnswer('Ben Spotify hesabımın şifresini unuttum', spotifyTrTarget, 'sentence').isCorrect, true);
  assert.equal(evaluateTurkishAnswer('Benim Spotify üyeliğimin parolasını unuttum', spotifyTrTarget, 'sentence').isCorrect, true);

  // 3. English paraphrases in TR->EN mode
  const spotifyEnTarget = ['I forgot the password to my Spotify account.'];
  assert.equal(evaluateEnglishAnswer('I forgot my Spotify account password', spotifyEnTarget, 'sentence').isCorrect, true);
  assert.equal(evaluateEnglishAnswer('I forgot the password of my Spotify account', spotifyEnTarget, 'sentence').isCorrect, true);
  assert.equal(evaluateEnglishAnswer('I forgot the passcode for my Spotify account', spotifyEnTarget, 'sentence').isCorrect, true);

  const mjEnTarget = ['Michael Jackson died in 2009.'];
  assert.equal(evaluateEnglishAnswer('Michael Jackson passed away in 2009.', mjEnTarget, 'sentence').isCorrect, true);

  // 4. Localized word synonyms (kız çocuğu / kız evlat, şifre / parola)
  assert.equal(evaluateTurkishAnswer('kız evlat', ['kız çocuğu'], 'word').isCorrect, true);
  assert.equal(evaluateTurkishAnswer('parola', ['şifre'], 'word').isCorrect, true);
  assert.equal(evaluateTurkishAnswer('alışveriş merkezi', ['AVM'], 'word').isCorrect, true);

  // 5. Negation polarity protection: affirmative must not match explicit negative
  assert.equal(evaluateTurkishAnswer('Ben yorgunum', ['Ben yorgun değilim.'], 'sentence').isCorrect, false);
  assert.equal(evaluateEnglishAnswer('I am ready', ['I am not ready.'], 'sentence').isCorrect, false);
});
