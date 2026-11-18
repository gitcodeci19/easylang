import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceConceptAfterAnswer,
  consolidateConceptState,
  createInitialConceptState,
  MAX_ACTIVE_CONCEPTS,
  sanitizeConceptExplanationForCard,
  selectDueConceptAndCard,
  upsertConceptNote,
} from '../src/shared/concepts.ts';
import type { Card } from '../src/shared/types.ts';

function makeSentence(id: string, en: string, tr: string): Card {
  return {
    id,
    type: 'sentence',
    level: 'A2',
    pos: 'sentence',
    en,
    phonetic: '',
    acceptedTr: [tr],
    exampleEn: en,
    exampleTr: tr,
    source: 'builtin',
  };
}

test('flagging "to" in "I used to be thin." schedules spaced non-consecutive reviews through +2 -> +4 -> +10 -> mastered', () => {
  const sourceCard = makeSentence('c1', 'I used to be thin.', 'Eskiden zayıftım.');
  const varCard1 = makeSentence('c2', 'Tom used to shine my shoes.', 'Tom ayakkabılarımı boyardı.');
  const varCard2 = makeSentence('c3', 'There used to be an old temple here.', 'Eskiden burada eski bir tapınak vardı.');
  const varCard3 = makeSentence('c4', 'We used to talk over a cup of coffee.', 'Eskiden bir kahve eşliğinde konuşurduk.');
  const unrelatedCard = makeSentence('c5', 'Good morning!', 'Günaydın!');
  const deck = [sourceCard, varCard1, varCard2, varCard3, unrelatedCard];

  let state = createInitialConceptState();

  // Captured at question #10 -> first check at #12 (+2 gap)
  const flagged = upsertConceptNote(state, sourceCard, 'to', 10, 1_000);
  state = flagged.nextState;

  assert.equal(flagged.note.id, 'grammar:used_to');
  assert.equal(flagged.note.stage, 0);
  assert.equal(flagged.note.nextCheckAtQuestion, 12);

  // At question #11: NOT due yet (never consecutive)
  const tooEarly = selectDueConceptAndCard(state, deck, {}, 11, {
    contentMode: 'mixed',
    levels: ['A1', 'A2', 'B1', 'B2'],
    includeUserCards: true,
  });
  assert.equal(tooEarly, null);

  // At question #12: due, and must NOT repeat sourceCard ("I used to be thin.")
  const pick1 = selectDueConceptAndCard(
    state,
    deck,
    {},
    12,
    { contentMode: 'mixed', levels: ['A1', 'A2', 'B1', 'B2'], includeUserCards: true },
    () => 0
  );
  assert.ok(pick1);
  assert.notEqual(pick1.card.id, sourceCard.id);
  assert.match(pick1.card.en, /\bused\s+to\b/i);

  // Cooldown guard: immediately at question #13, even if concept wasn't completed yet, do not spam consecutively
  const cooldownState = { ...state, lastConceptPromptAtQuestion: 12 };
  const blockedByCooldown = selectDueConceptAndCard(cooldownState, deck, {}, 13, {
    contentMode: 'mixed',
    levels: ['A1', 'A2', 'B1', 'B2'],
    includeUserCards: true,
  });
  assert.equal(blockedByCooldown, null);

  // Stage 0 -> 1 (+4 gap => #16)
  const adv1 = advanceConceptAfterAnswer(state, flagged.note.id, pick1.card.id, true, 12, 2_000);
  state = adv1.nextState;
  assert.equal(adv1.updated?.stage, 1);
  assert.equal(adv1.updated?.nextCheckAtQuestion, 16);

  // Stage 1 -> 2 (+10 gap => #26 long-term check)
  const adv2 = advanceConceptAfterAnswer(state, flagged.note.id, varCard2.id, true, 16, 3_000);
  state = adv2.nextState;
  assert.equal(adv2.updated?.stage, 2);
  assert.equal(adv2.updated?.nextCheckAtQuestion, 26);

  // If missed during long-term check (#26), resets to stage 0 (+2 gap => #28) instead of falsely graduating
  const failLongTerm = advanceConceptAfterAnswer(state, flagged.note.id, varCard3.id, false, 26, 4_000);
  assert.equal(failLongTerm.updated?.stage, 0);
  assert.equal(failLongTerm.updated?.nextCheckAtQuestion, 28);
  assert.equal(failLongTerm.updated?.masteredAt, null);

  // If passed at long-term check (#26) -> Stage 3 Mastered
  const passLongTerm = advanceConceptAfterAnswer(state, flagged.note.id, varCard3.id, true, 26, 4_000);
  assert.equal(passLongTerm.updated?.stage, 3);
  assert.ok(passLongTerm.updated?.masteredAt);
});

test('past continuous nuance ("I was taking a walk.") maps to canonical was/were + V-ing rule and selects varied examples', () => {
  const src = makeSentence('p1', 'I was taking a walk.', 'Ben yürüyüş yapıyordum.');
  const other1 = makeSentence('p2', 'She was reading a book.', 'O kitap okuyordu.');
  const other2 = makeSentence('p3', 'I like apples.', 'Elmaları severim.');

  let state = createInitialConceptState();
  const flagged = upsertConceptNote(state, src, 'was taking', 5, 1_000, {
    key: 'past_continuous',
    token: 'was taking',
    label: "'was/were + V-ing' (Past Continuous)",
    explanation: 'Past Continuous vs Simple Past',
  });
  state = flagged.nextState;

  assert.equal(flagged.note.id, 'grammar:past_continuous');
  const nextPick = selectDueConceptAndCard(
    state,
    [src, other1, other2],
    {},
    7,
    { contentMode: 'mixed', levels: ['A1', 'A2', 'B1', 'B2'], includeUserCards: true },
    () => 0
  );
  assert.ok(nextPick);
  assert.equal(nextPick.card.id, 'p2');
});

test('sanitizeConceptExplanationForCard drops sentences referencing stale phrases from an earlier source card', () => {
  const explanation =
    "'Arrive' fiili 'varmak' anlamına gelir, 'yaklaşmak' değildir. Ayrıca 'let me know' ifadesi Türkçede 'bana haber ver' şeklinde çevrilir.";
  const cleaned = sanitizeConceptExplanationForCard(
    explanation,
    'Let me know as soon as you arrive at the terminal.',
    "I didn't arrive until it was already too late."
  );
  assert.equal(cleaned, "'Arrive' fiili 'varmak' anlamına gelir, 'yaklaşmak' değildir.");
});

test('upsertConceptNote merges overlapping active tokens and caps active concepts at MAX_ACTIVE_CONCEPTS', () => {
  const card = makeSentence('c10', "Let's cut the movie short, it is getting too late.", 'Filmi kısa keselim, çok geç oluyor.');
  let state = createInitialConceptState();

  state = upsertConceptNote(state, card, 'getting too late', 10, 1000).nextState;
  state = upsertConceptNote(state, card, 'is getting too late', 11, 2000).nextState;
  state = upsertConceptNote(state, card, 'it is getting too late', 12, 3000).nextState;

  const activeAfterOverlap = state.notes.filter((n) => n.stage < 3);
  assert.equal(activeAfterOverlap.length, 1, 'Overlapping tokens from the same phrase must merge into 1 active concept');

  // Add 12 distinct tokens -> active queue stays capped at MAX_ACTIVE_CONCEPTS
  const distinctWords = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima'];
  for (let i = 0; i < distinctWords.length; i += 1) {
    const w = distinctWords[i]!;
    const c = makeSentence(`d_${i}`, `We noticed ${w} clearly.`, `${w} fark ettik.`);
    state = upsertConceptNote(state, c, w, 20 + i, 4000 + i * 100).nextState;
  }
  const consolidated = consolidateConceptState(state);
  const activeCount = consolidated.notes.filter((n) => n.stage < 3).length;
  assert.equal(activeCount, MAX_ACTIVE_CONCEPTS);
});
