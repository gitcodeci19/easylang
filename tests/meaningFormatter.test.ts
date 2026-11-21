import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractDisplayMeanings,
  formatDisplayMeaningsInline,
} from '../src/shared/meaningFormatter.ts';

test('extractDisplayMeanings strips mechanical sentence clones while keeping natural alternatives', () => {
  // Exact IKEA bookshelf sentence from UI screenshot (4 raw entries -> 2 distinct natural translations)
  const ikea = extractDisplayMeanings(
    [
      'Oğlum ve eşim yeni IKEA kitaplığını iki saatte kurdu.',
      'Erkek çocuğum ile kocam yeni IKEA rafını iki saat içinde monte etti.',
      'Oğlum ve eşim yeni IKEA kitaplığını iki saatte kurmuştur.',
      'Erkek çocuğum ile kocam yeni IKEA rafını iki saat içinde monte etmiştir.',
    ],
    'sentence'
  );
  assert.equal(ikea.primary, 'Oğlum ve eşim yeni IKEA kitaplığını iki saatte kurdu.');
  assert.deepEqual(ikea.alternatives, [
    'Erkek çocuğum ile kocam yeni IKEA rafını iki saat içinde monte etti.',
  ]);
  assert.equal(ikea.hiddenCount, 0);

  // Leading subject pronoun clone collapses to 1 sentence
  const pronounClone = extractDisplayMeanings(
    [
      'Eskiden her sabah üç fincan kahve içerdim.',
      'Ben eskiden her sabah üç fincan kahve içerdim.',
    ],
    'sentence'
  );
  assert.equal(pronounClone.primary, 'Eskiden her sabah üç fincan kahve içerdim.');
  assert.deepEqual(pronounClone.alternatives, []);

  // 7-variant weather sentence collapses to 2 genuinely distinct translations
  const weather = extractDisplayMeanings(
    [
      'Hava durumu uygulaması güneşli dedi ama bütün öğleden sonra sağanak yağdı.',
      'Uygulama güneş gösteriyordu fakat bardaktan boşanırcasına yağdı.',
      'Hava durumu uygulaması güneşli dedi ama bütün öğleden sonra sağanak yağmıştır.',
      'Hava durumu uygulaması güneşli dedi fakat bütün öğleden sonra sağanak yağdı.',
      'Hava durumu uygulaması güneşli dedi ama tüm öğleden sonra sağanak yağdı.',
      'Uygulama güneş gösteriyordu fakat bardaktan boşanırcasına yağmıştır.',
      'Uygulama güneş gösteriyordu ama bardaktan boşanırcasına yağdı.',
    ],
    'sentence'
  );
  assert.equal(
    weather.primary,
    'Hava durumu uygulaması güneşli dedi ama bütün öğleden sonra sağanak yağdı.'
  );
  assert.deepEqual(weather.alternatives, [
    'Uygulama güneş gösteriyordu fakat bardaktan boşanırcasına yağdı.',
  ]);
});

test('extractDisplayMeanings and formatDisplayMeaningsInline handle word synonyms cleanly', () => {
  const wordRes = extractDisplayMeanings(
    ['tavsiye', 'öğüt', 'Tavsiye', 'nasihat', '  '],
    'word'
  );
  assert.equal(wordRes.primary, 'tavsiye');
  assert.deepEqual(wordRes.alternatives, ['öğüt', 'nasihat']);

  assert.equal(
    formatDisplayMeaningsInline(['tavsiye', 'öğüt', 'nasihat'], 'word'),
    'tavsiye · öğüt · nasihat'
  );
  assert.equal(
    formatDisplayMeaningsInline(
      [
        'Oğlum ve eşim yeni IKEA kitaplığını iki saatte kurdu.',
        'Oğlum ve eşim yeni IKEA kitaplığını iki saatte kurmuştur.',
      ],
      'sentence'
    ),
    'Oğlum ve eşim yeni IKEA kitaplığını iki saatte kurdu.'
  );
});
