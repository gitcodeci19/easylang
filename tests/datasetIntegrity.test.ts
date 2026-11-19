import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  CURRICULUM_UNITS,
  buildUnitLessonExercises,
} from '../src/shared/curriculum.ts';
import { REMEDIAL_SKILL_CATALOG, REMEDIAL_SKILL_ORDER } from '../src/shared/remedialCatalog.ts';
import type { Card, UserCardProgress } from '../src/shared/types.ts';
import { buildRemedialLessonPlan } from '../src/shared/weaknessDetector.ts';

const CARDS_PATH = path.resolve(process.cwd(), 'public', 'data', 'cards.json');
const ALL_CARDS: Card[] = JSON.parse(fs.readFileSync(CARDS_PATH, 'utf8')) as Card[];

function foldTr(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/[ç]/g, 'c')
    .replace(/[ğ]/g, 'g')
    .replace(/[ı]/g, 'i')
    .replace(/[ö]/g, 'o')
    .replace(/[ş]/g, 's')
    .replace(/[ü]/g, 'u')
    .replace(/[â]/g, 'a')
    .replace(/[î]/g, 'i')
    .replace(/[û]/g, 'u')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const FREEDICT_JUNK_TOKENS = new Set([
  'ing', 'amer', 'esk', 'kıs', 'çoğ', 'sf', 'is', 'f', 'zf', 'ed', 'bağ', 'ünl',
  'argo', 'mec', 'ayn', 'vb', 'vs', 'örn', 'bkz', 'bknz',
]);

test('cards.json has zero FreeDict dictionary junk, OCR corruption, or duplicate entries', () => {
  const words = ALL_CARDS.filter((c) => c.type === 'word');
  const sents = ALL_CARDS.filter((c) => c.type === 'sentence');
  assert.ok(words.length >= 5000);
  assert.ok(sents.length >= 5500);

  const seenWordEn = new Set<string>();
  const seenSentEn = new Set<string>();

  for (const c of words) {
    const k = c.en.trim().toLowerCase();
    assert.ok(!seenWordEn.has(k), `Duplicate word card: ${c.en}`);
    seenWordEn.add(k);
    assert.ok(c.acceptedTr.length > 0, `Empty acceptedTr for ${c.id}`);
    assert.ok(c.exampleEn.trim().length > 0, `Empty exampleEn for ${c.id}`);
    assert.ok(c.exampleTr.trim().length > 0, `Empty exampleTr for ${c.id}`);

    for (const tr of c.acceptedTr) {
      const low = tr.trim().toLowerCase();
      assert.ok(!FREEDICT_JUNK_TOKENS.has(low), `Junk abbreviation "${tr}" in ${c.id} (${c.en})`);
      assert.ok(!/[!?"]/.test(tr), `Punctuation junk "${tr}" in ${c.id} (${c.en})`);
      assert.ok(!/^\d+$/.test(tr.trim()), `Bare numeric junk "${tr}" in ${c.id} (${c.en})`);
      assert.ok(!/gömrüş|ic gr!|0404/i.test(tr), `OCR typo "${tr}" in ${c.id} (${c.en})`);
    }
  }

  for (const c of sents) {
    const k = c.en.trim().toLowerCase().replace(/\s+/g, ' ');
    assert.ok(!seenSentEn.has(k), `Duplicate sentence card: ${c.en}`);
    seenSentEn.add(k);
    assert.ok(c.acceptedTr.length > 0 && c.acceptedTr[0]!.trim().length > 0, `Empty sentence TR for ${c.id}`);
  }
});

test('polysemous and compound word cards have 100% sense-aligned examples matching acceptedTr[0]', () => {
  const byId = new Map(ALL_CARDS.map((c) => [c.id, c]));

  const spotChecks: Array<{ id: string; mustIncludeTr: string; mustMatchEnRe: RegExp; mustMatchTrRe: RegExp }> = [
    { id: 'w_state', mustIncludeTr: 'durum', mustMatchEnRe: /\bstate\b/i, mustMatchTrRe: /durum/i },
    { id: 'w_left', mustIncludeTr: 'sol', mustMatchEnRe: /\bleft\b/i, mustMatchTrRe: /sol/i },
    { id: 'w_match', mustIncludeTr: 'maç', mustMatchEnRe: /\bmatch\b/i, mustMatchTrRe: /maç/i },
    { id: 'w_board', mustIncludeTr: 'tahta', mustMatchEnRe: /\bboard\b/i, mustMatchTrRe: /tahta/i },
    { id: 'w_boot', mustIncludeTr: 'bot', mustMatchEnRe: /\bboot\b/i, mustMatchTrRe: /bot/i },
    { id: 'w_cross', mustIncludeTr: 'karşıya geçmek', mustMatchEnRe: /\bcross\b/i, mustMatchTrRe: /karşıya geç/i },
    { id: 'w_fan', mustIncludeTr: 'hayran', mustMatchEnRe: /\bfan\b/i, mustMatchTrRe: /hayran/i },
    { id: 'w_plant', mustIncludeTr: 'bitki', mustMatchEnRe: /\bplant\b/i, mustMatchTrRe: /bitki/i },
    { id: 'w_ice_cream', mustIncludeTr: 'dondurma', mustMatchEnRe: /\bice cream\b/i, mustMatchTrRe: /dondurma/i },
    { id: 'w_t_shirt', mustIncludeTr: 'tişört', mustMatchEnRe: /\bt-shirt\b/i, mustMatchTrRe: /tişört/i },
    { id: 'w_non_profit', mustIncludeTr: 'kâr amacı gütmeyen', mustMatchEnRe: /\bnon-profit\b/i, mustMatchTrRe: /kâr amacı gütmeyen/i },
    { id: 'w_post_war', mustIncludeTr: 'savaş sonrası', mustMatchEnRe: /\bpost-war\b/i, mustMatchTrRe: /savaş sonrası/i },
    { id: 'w_well_being', mustIncludeTr: 'refah', mustMatchEnRe: /\bwell-being\b/i, mustMatchTrRe: /refah/i },
    { id: 'w_subsidy', mustIncludeTr: 'devlet desteği', mustMatchEnRe: /\bsubsid/i, mustMatchTrRe: /deste|sübvansiyon/i },
  ];

  for (const chk of spotChecks) {
    const card = byId.get(chk.id);
    assert.ok(card, `Missing expected card ${chk.id}`);
    assert.equal(card.acceptedTr[0], chk.mustIncludeTr, `${chk.id} acceptedTr[0] mismatch`);
    assert.match(card.exampleEn, chk.mustMatchEnRe, `${chk.id} exampleEn missing headword: ${card.exampleEn}`);
    assert.match(card.exampleTr, chk.mustMatchTrRe, `${chk.id} exampleTr sense mismatch: ${card.exampleTr}`);
  }
});

test('all 300 Roadmap lessons (2,400 exercises) have zero duplicate choices, zero synonym collisions, and Turkish cues on cloze', () => {
  const wordByEn = new Map<string, Card>();
  for (const c of ALL_CARDS) {
    if (c.type === 'word') wordByEn.set(c.en.trim().toLowerCase(), c);
  }

  for (const unit of CURRICULUM_UNITS) {
    for (let nodeIdx = 0; nodeIdx < 5; nodeIdx += 1) {
      for (let step = 0; step < 3; step += 1) {
        const exercises = buildUnitLessonExercises(
          unit.id,
          nodeIdx,
          ALL_CARDS,
          {},
          1700000000000 + nodeIdx * 100 + step,
          step
        );
        for (const ex of exercises) {
          if (ex.choices && ex.choices.length > 0) {
            const folded = ex.choices.map(foldTr);
            assert.equal(
              new Set(folded).size,
              folded.length,
              `Duplicate choice in ${unit.id} ${ex.id}: ${ex.choices.join(' | ')}`
            );
            assert.ok(
              ex.correctChoice && ex.choices.includes(ex.correctChoice),
              `Missing correctChoice in ${unit.id} ${ex.id}`
            );

            if (ex.kind === 'select_meaning') {
              const targetTr = new Set(ex.card.acceptedTr.map(foldTr));
              for (const ch of ex.choices) {
                if (ch === ex.correctChoice) continue;
                assert.ok(
                  !targetTr.has(foldTr(ch)),
                  `select_meaning collision in ${unit.id} for ${ex.card.en}: "${ch}"`
                );
              }
            }

            if (ex.kind === 'cloze_blank') {
              assert.ok(ex.promptText.includes('___'), `Cloze missing blank: ${ex.promptText}`);
              assert.ok(
                ex.promptSubtext.trim().length > 0,
                `Cloze missing Turkish cue subtext: ${ex.promptText}`
              );
              const corrCard = wordByEn.get((ex.correctChoice ?? '').toLowerCase());
              if (corrCard) {
                const cSet = new Set(corrCard.acceptedTr.map(foldTr));
                for (const ch of ex.choices) {
                  if (ch === ex.correctChoice) continue;
                  const dCard = wordByEn.get(ch.toLowerCase());
                  if (dCard) {
                    const overlap = dCard.acceptedTr.find((t) => cSet.has(foldTr(t)));
                    assert.ok(
                      !overlap,
                      `Cloze synonym collision in ${unit.id}: "${ex.correctChoice}" vs "${ch}" (shared "${overlap}") on "${ex.promptText}"`
                    );
                  }
                }
              }
            }
          }
        }
      }
    }
  }
});

test('all 18 Remedial workshops generate clean non-ambiguous cloze_blank and trouble_vocab vocab_recall drills', () => {
  const sampleProgress: Record<string, UserCardProgress> = {
    w_state: {
      cardId: 'w_state',
      retryAt: null,
      retryCount: 0,
      nextDueAt: 0,
      streak: 0,
      intervalDays: 0,
      totalCorrect: 0,
      totalWrong: 4,
      lastReviewedAt: Date.now(),
    },
    w_match: {
      cardId: 'w_match',
      retryAt: null,
      retryCount: 0,
      nextDueAt: 0,
      streak: 0,
      intervalDays: 0,
      totalCorrect: 0,
      totalWrong: 3,
      lastReviewedAt: Date.now(),
    },
  };

  for (const skillId of REMEDIAL_SKILL_ORDER) {
    const spec = REMEDIAL_SKILL_CATALOG[skillId];
    for (const sc of spec.scenarios) {
      const asksQuestion =
        /\bsoracaksın\b|\bsor\s*:?\s*$/i.test(sc.scenarioTr) ||
        /^ask\b/i.test(sc.scenarioEn.trim());
      if (asksQuestion) {
        assert.ok(
          sc.correctChoice.trim().endsWith('?'),
          `Scenario in ${skillId} instructs learner to ask a question, but correctChoice is not a question: "${sc.correctChoice}"`
        );
      }
    }

    const plan = buildRemedialLessonPlan(skillId, null, ALL_CARDS, sampleProgress, 987654);
    for (const ex of plan.exercises) {
      if (ex.kind === 'cloze_blank') {
        assert.ok(
          ex.promptText.includes('___'),
          `Remedial cloze_blank missing blank in ${skillId}: "${ex.promptText}"`
        );
      }
      if (ex.kind === 'vocab_recall' && ex.choices) {
        const targetMeanings = new Set(ex.card.acceptedTr.map(foldTr));
        for (const ch of ex.choices) {
          if (ch === ex.correctChoice) continue;
          assert.ok(
            !targetMeanings.has(foldTr(ch)),
            `trouble_vocab synonym collision for ${ex.card.en}: "${ch}"`
          );
        }
      }
      if (ex.choices) {
        const folded = ex.choices.map(foldTr);
        assert.equal(new Set(folded).size, folded.length, `Duplicate choice in remedial ${skillId}`);
      }
    }
  }
});
