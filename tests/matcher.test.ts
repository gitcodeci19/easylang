import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateEnglishAnswer,
  evaluateTurkishAnswer,
  evaluateWordBankAnswer,
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

test('offline Turkish matcher blocks verb negation flips, past/future swaps, 4-char prefix traps, and repeated-word gaming', () => {
  // 1. Verb negation polarity (even when Levenshtein distance is 1 char like geliyorum vs gelmiyorum!)
  assert.equal(evaluateTurkishAnswer('Dün sinemaya gitmedim.', ['Dün sinemaya gittim.'], 'sentence').isCorrect, false);
  assert.equal(evaluateTurkishAnswer('Yarın okula gelmiyorum.', ['Yarın okula geliyorum.'], 'sentence').isCorrect, false);
  assert.equal(evaluateTurkishAnswer('Bunu asla yapmaz.', ['Bunu yapar.'], 'sentence').isCorrect, false);
  assert.equal(evaluateTurkishAnswer('Anahtarı almayı unutmayın.', ['Anahtarı almayı unutun.'], 'sentence').isCorrect, false);

  // Positive verbal noun ("alışmam") must NOT falsely trigger negation
  assert.equal(
    evaluateTurkishAnswer('Yeni klavye düzenine alışmam birkaç haftamı aldı.', ['Yeni klavye düzenine alışmam birkaç haftamı almıştır.'], 'sentence').isCorrect,
    true
  );

  // 2. Past vs future tense contradiction
  assert.equal(
    evaluateTurkishAnswer('Dün sabah toplantıya katıldım.', ['Yarın sabah toplantıya katılacağım.'], 'sentence').isCorrect,
    false
  );
  assert.equal(
    evaluateTurkishAnswer('Toplantıya katıldım.', ['Toplantıya katılacağım.'], 'sentence').isCorrect,
    false
  );

  // 3. No false 4-char prefix collisions & core noun swaps caught offline
  assert.equal(
    evaluateTurkishAnswer('Yeni arabam parka yakın.', ['Yeni evim parka yakın.'], 'sentence').isCorrect,
    false
  );
  assert.equal(
    evaluateTurkishAnswer("Kardeşim yarın Ankara'ya trenle gidecek.", ["Kardeşim yarın İstanbul'a trenle gidecek."], 'sentence').isCorrect,
    false
  );
  assert.equal(
    evaluateTurkishAnswer('wi-fi sinyalı arka oturma odasında süper zayıf çekiyor.', ['Arka yatak odasında Wi-Fi sinyali çok zayıf.'], 'sentence').isCorrect,
    false
  );

  // 4. Number mismatch caught offline (5 saat != iki saat, 2015 != 2009)
  assert.equal(
    evaluateTurkishAnswer(
      'Oğlum ve eşim yeni IKEA kitaplığını 5 saatte kurdu.',
      ['Oğlum ve eşim yeni IKEA kitaplığını iki saatte kurdu.'],
      'sentence'
    ).isCorrect,
    false
  );
  assert.equal(
    evaluateTurkishAnswer(
      "Michael Jackson 2015'te öldü.",
      ["Michael Jackson 2009'da öldü."],
      'sentence'
    ).isCorrect,
    false
  );

  // 5. Repeated-word gaming must fail 1-to-1 matching
  assert.equal(
    evaluateTurkishAnswer('kedi kedi kedi', ['Kedi bahçede uyuyor.'], 'sentence').isCorrect,
    false
  );
});

test('offline Turkish matcher accepts natural numbers, apostrophes, colloquial phrasing, and synonyms without AI', () => {
  // Number word <-> digit equivalence ("2 saatte" vs "iki saatte", "40 dakika" vs "kırk dakika")
  assert.equal(
    evaluateTurkishAnswer(
      'Oğlum ve eşim yeni IKEA kitaplığını 2 saatte monte etti.',
      ['Oğlum ve eşim yeni IKEA kitaplığını iki saatte kurdu.'],
      'sentence'
    ).isCorrect,
    true
  );
  assert.equal(
    evaluateTurkishAnswer(
      'Tren 40 dakika sonra kalkıyor.',
      ['Tren kırk dakika sonra kalkıyor.'],
      'sentence'
    ).isCorrect,
    true
  );

  // Natural colloquial Turkish for Wi-Fi card when room is right ("yatak odasında" + "süper zayıf çekiyor")
  assert.equal(
    evaluateTurkishAnswer(
      'wi-fi sinyalı arka yatak odasında süper zayıf çekiyor.',
      ['Arka yatak odasında Wi-Fi sinyali çok zayıf.'],
      'sentence'
    ).isCorrect,
    true
  );

  // Apostrophe proper nouns + natural conjunction/synonym swaps
  assert.equal(
    evaluateTurkishAnswer(
      'Kardeşim yarın İstanbula trenle gidecek',
      ["Kardeşim yarın İstanbul'a trenle gidecek."],
      'sentence'
    ).isCorrect,
    true
  );
  assert.equal(
    evaluateTurkishAnswer(
      'Dün akşam yeni kafede sıcak kahve yudumladık.',
      ['Dün akşam yeni kafede sıcak kahve içtik.'],
      'sentence'
    ).isCorrect,
    true
  );

  // Clock time normalization (09:00 <-> 9:00 <-> 9.00) in both Turkish and English
  assert.equal(
    evaluateTurkishAnswer(
      "Otobüs saat 09.00'a kadar gelmedi.",
      ["Otobüs saat 9:00'a kadar gelmedi."],
      'sentence'
    ).isCorrect,
    true
  );
  assert.equal(
    evaluateEnglishAnswer(
      "The bus didn't arrive until 09:00 AM",
      ["The bus didn't arrive until 9:00 AM."],
      'sentence'
    ).isCorrect,
    true
  );
});

test('evaluateWordBankAnswer enforces strict token order and blocks scrambled, missing, or extra tiles', () => {
  const targetEn = ['My wife works from home three days a week in our upstairs study room.'];

  // Exact screenshot regression: scrambled prepositions/nouns + missing "study"
  const scrambled = evaluateWordBankAnswer(
    'My wife works three days in a week from upstairs our room home',
    targetEn,
    'tr-to-en'
  );
  assert.equal(scrambled.isCorrect, false);
  assert.equal(scrambled.matchKind, 'none');

  // Missing a single content word ("study") even in otherwise right order must fail
  const missingWord = evaluateWordBankAnswer(
    'My wife works from home three days a week in our upstairs room',
    targetEn,
    'tr-to-en'
  );
  assert.equal(missingWord.isCorrect, false);

  // Inserting a distractor tile ("sweep") must fail
  const extraDistractor = evaluateWordBankAnswer(
    'My wife works from home three days a week in our upstairs study room sweep',
    targetEn,
    'tr-to-en'
  );
  assert.equal(extraDistractor.isCorrect, false);

  // Exact sequence (without trailing period) passes cleanly
  const validEn = evaluateWordBankAnswer(
    'My wife works from home three days a week in our upstairs study room',
    targetEn,
    'tr-to-en'
  );
  assert.equal(validEn.isCorrect, true);
  assert.equal(validEn.matchKind, 'normalized');

  // Contraction normalization still passes when exact sequence matches
  const validContraction = evaluateWordBankAnswer(
    "I don't want to wait",
    ['I do not want to wait.'],
    'tr-to-en'
  );
  assert.equal(validContraction.isCorrect, true);

  // Turkish word_bank also enforces strict order and rejects missing/scrambled words
  const targetTr = ['Eşim haftada üç gün üst kattaki çalışma odamızda evden çalışıyor.'];
  assert.equal(
    evaluateWordBankAnswer(
      'Eşim haftada üç gün üst kattaki çalışma odamızda evden çalışıyor',
      targetTr,
      'en-to-tr'
    ).isCorrect,
    true
  );
  assert.equal(
    evaluateWordBankAnswer(
      'Eşim üç gün çalışma evden odamızda haftada çalışıyor',
      targetTr,
      'en-to-tr'
    ).isCorrect,
    false
  );
});

test('evaluateEnglishAnswer blocks scrambled word order, subject-object inversions, and repeated-word gaming', () => {
  const targetEn = ['My wife works from home three days a week in our upstairs study room.'];

  // Broken word order + missing "study" must also fail free-translation offline matcher
  assert.equal(
    evaluateEnglishAnswer(
      'My wife works three days in a week from upstairs our room home',
      targetEn,
      'sentence'
    ).isCorrect,
    false
  );

  // Subject/object inversion with identical words must fail
  assert.equal(
    evaluateEnglishAnswer('The man bit the dog', ['The dog bit the man.'], 'sentence').isCorrect,
    false
  );

  // Repeated-word gaming must fail
  assert.equal(
    evaluateEnglishAnswer('wife works wife works wife works', targetEn, 'sentence').isCorrect,
    false
  );

  // Genuine clause-level movement preserving phrase structure still passes offline
  assert.equal(
    evaluateEnglishAnswer(
      'My wife works from home in our upstairs study room three days a week',
      targetEn,
      'sentence'
    ).isCorrect,
    true
  );
});
