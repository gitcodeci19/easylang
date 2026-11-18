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
