import assert from 'node:assert/strict';
import test from 'node:test';
import {
  exportCardsAsTsv,
  parseImportedCards,
} from '../src/shared/textImport.ts';

test('parseImportedCards parses TSV rows with multiple Turkish meanings', () => {
  const tsv = [
    'en\ttr\ttype\tlevel\texampleEn\texampleTr',
    'resilient\tdayanıklı | dirençli\tword\tB2\tShe is resilient.\tO dayanıklıdır.',
    'Take it easy.\tSakin ol | Kafana takma\tsentence\tA2',
  ].join('\n');

  const { cards, errors } = parseImportedCards(tsv);
  assert.equal(errors.length, 0);
  assert.equal(cards.length, 2);
  assert.equal(cards[0]?.en, 'resilient');
  assert.deepEqual(cards[0]?.acceptedTr, ['dayanıklı', 'dirençli']);
  assert.equal(cards[1]?.type, 'sentence');
  assert.equal(cards[1]?.level, 'A2');
});

test('parseImportedCards parses JSON arrays and round-trips TSV export', () => {
  const jsonInput = JSON.stringify([
    { en: 'scarce', tr: 'kıt; nadir', level: 'C1' },
  ]);
  const { cards, errors } = parseImportedCards(jsonInput);
  assert.equal(errors.length, 0);
  assert.equal(cards.length, 1);
  assert.deepEqual(cards[0]?.acceptedTr, ['kıt', 'nadir']);

  const tsvOut = exportCardsAsTsv(cards);
  assert.match(tsvOut, /scarce\tkıt \| nadir\tword\tC1/);
});
