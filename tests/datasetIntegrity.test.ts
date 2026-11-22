import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  CURRICULUM_UNITS,
  STEPS_PER_NODE,
  buildUnitLessonExercises,
} from '../src/shared/curriculum.ts';
import {
  ASSISTANT_GUIDE_LABELS,
  ASSISTANT_GUIDE_ORDER,
  getGuideAudioRelativePath,
} from '../src/shared/guideAssistant.ts';
import {
  REMEDIAL_AUDIO_WORD_TIMINGS,
  findActiveWordIndex,
} from '../src/shared/remedialAudioTimings.ts';
import {
  REMEDIAL_SKILL_CATALOG,
  REMEDIAL_SKILL_ORDER,
} from '../src/shared/remedialCatalog.ts';
import {
  REMEDIAL_QUESTION_AUDIO_DIR,
  REMEDIAL_QUESTION_SCRIPTS,
} from '../src/shared/remedialQuestionScripts.ts';
import { REMEDIAL_QUESTION_AUDIO_WORD_TIMINGS } from '../src/shared/remedialQuestionAudioTimings.ts';
import {
  VOICE_COACH_RULE_ORDER,
  getVoiceCoachRuleSpec,
} from '../src/shared/voiceCoachCatalog.ts';
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

test('all 500 Roadmap lessons (4,000 exercises) have zero duplicate choices, zero synonym collisions, Turkish cues on cloze, and rich diversity', () => {
  assert.equal(STEPS_PER_NODE, 5, 'Expected 5 steps per node (0/5 -> 5/5)');
  const wordByEn = new Map<string, Card>();
  for (const c of ALL_CARDS) {
    if (c.type === 'word') wordByEn.set(c.en.trim().toLowerCase(), c);
  }

  // Spot check localized everyday meanings and pop-culture sentences
  const localizedChecks: Array<[string, string]> = [
    ['daughter', 'kız çocuğu'],
    ['trailer', 'fragman'],
    ['hardware', 'donanım'],
    ['mall', 'alışveriş merkezi'],
    ['shock', 'şok'],
    ['cop', 'polis'],
    ['flu', 'grip'],
    ['hobby', 'hobi'],
    ['fantastic', 'harika'],
    ['mum', 'anne'],
    ['staff', 'personel'],
    ['shelf', 'raf'],
    ['poem', 'şiir'],
    ['lip', 'dudak'],
    ['level', 'seviye'],
    ['ingredient', 'malzeme'],
    ['written', 'yazılı'],
    ['ban', 'yasaklamak'],
    ['accommodation', 'konaklama'],
    ['retire', 'emekli olmak'],
    ['recover', 'iyileşmek'],
  ];
  for (const [en, expectedPrimaryTr] of localizedChecks) {
    const card = wordByEn.get(en);
    assert.ok(card, `Missing word card "${en}"`);
    assert.equal(card.acceptedTr[0], expectedPrimaryTr, `Expected "${en}" primary meaning "${expectedPrimaryTr}", got "${card.acceptedTr[0]}"`);
  }

  const mjCard = ALL_CARDS.find((c) => c.en === 'Michael Jackson died in 2009.');
  assert.ok(mjCard && mjCard.acceptedTr.length >= 4, 'Expected Michael Jackson pop-culture sentence with rich TR alternatives');
  const spotifyCard = ALL_CARDS.find((c) => c.en === 'I forgot the password to my Spotify account.');
  assert.ok(spotifyCard && spotifyCard.acceptedTr.length >= 4, 'Expected Spotify pop-culture sentence with rich TR alternatives');

  for (const unit of CURRICULUM_UNITS) {
    const unitWordCounts = new Map<string, number>();
    const unitSentCounts = new Map<string, number>();

    for (let nodeIdx = 0; nodeIdx < 5; nodeIdx += 1) {
      for (let step = 0; step < STEPS_PER_NODE; step += 1) {
        const exercises = buildUnitLessonExercises(
          unit.id,
          nodeIdx,
          ALL_CARDS,
          {},
          1700000000000 + nodeIdx * 100 + step,
          step
        );
        assert.equal(exercises.length, 8);
        for (const ex of exercises) {
          const map = ex.card.type === 'word' ? unitWordCounts : unitSentCounts;
          map.set(ex.card.id, (map.get(ex.card.id) ?? 0) + 1);

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

    assert.ok(unitWordCounts.size >= 80, `${unit.id} expected >= 80 unique words across 25 steps, got ${unitWordCounts.size}`);
    assert.ok(unitSentCounts.size >= 75, `${unit.id} expected >= 75 unique sentences across 25 steps, got ${unitSentCounts.size}`);
    const maxWordRep = Math.max(...unitWordCounts.values());
    const maxSentRep = Math.max(...unitSentCounts.values());
    assert.ok(maxWordRep <= 3, `${unit.id} word repeated too often across 25 steps: maxRep=${maxWordRep}`);
    assert.equal(maxSentRep, 1, `${unit.id} sentence repeated across 25 steps: maxRep=${maxSentRep}`);
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

test('all 35 bundled ElevenLabs voiceover Opus OGG files, transcripts, and word timings exist and align 1-to-1', () => {
  const audioDir = path.resolve(process.cwd(), 'public', 'audio', 'remedial');
  assert.equal(VOICE_COACH_RULE_ORDER.length, 35, 'Expected 35 voice-coach rules');

  for (const ruleId of VOICE_COACH_RULE_ORDER) {
    const filePath = path.join(audioDir, `${ruleId}.ogg`);
    assert.ok(fs.existsSync(filePath), `Missing bundled OGG for ${ruleId}: ${filePath}`);
    const stat = fs.statSync(filePath);
    assert.ok(stat.size > 12_000, `OGG too small / corrupt for ${ruleId}: ${stat.size} bytes`);

    const spec = getVoiceCoachRuleSpec(ruleId);
    const transcript = spec.transcriptTr;
    assert.ok(transcript && transcript.length >= 120, `Missing transcript for ${ruleId}`);
    assert.ok(!transcript.includes('/') && !transcript.includes('→'), `Transcript for ${ruleId} has TTS symbols`);

    const words = transcript.trim().split(/\s+/).filter(Boolean);
    const timings = REMEDIAL_AUDIO_WORD_TIMINGS[ruleId];
    assert.ok(timings && timings.length > 0, `Missing word timings for ${ruleId}`);
    assert.equal(
      timings.length,
      words.length,
      `Timing count mismatch for ${ruleId}: ${timings.length} vs ${words.length}`
    );

    let prevStart = -1;
    for (let i = 0; i < timings.length; i += 1) {
      const [startMs, endMs] = timings[i]!;
      assert.ok(
        Number.isFinite(startMs) && Number.isFinite(endMs) && startMs >= 0 && endMs > startMs,
        `Invalid timing interval for ${ruleId}[${i}]: [${startMs}, ${endMs}]`
      );
      assert.ok(
        startMs >= prevStart,
        `Non-monotonic timing start for ${ruleId}[${i}]: ${startMs} < ${prevStart}`
      );
      prevStart = startMs;
    }

    // Verify binary-search lookup hits first word and clears during leading silence/idle
    assert.equal(findActiveWordIndex(timings, -1, 0), -1);
    assert.equal(findActiveWordIndex(timings, timings[0]![0] + 10, 0), 0);
    assert.equal(
      findActiveWordIndex(timings, timings[timings.length - 1]![0] + 10, 0),
      timings.length - 1
    );
  }
});

test('Voice Guide Assistant metadata, manifest exposure, and bundled OGG assets are valid', () => {
  assert.equal(ASSISTANT_GUIDE_ORDER.length, 16, 'Expected 16 guide assistant slots');
  assert.equal(new Set(ASSISTANT_GUIDE_ORDER).size, 16, 'Duplicate guide assistant IDs');

  const manifestPath = path.resolve(process.cwd(), 'public', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    web_accessible_resources?: Array<{ resources?: string[] }>;
  };
  const allExposed = (manifest.web_accessible_resources ?? []).flatMap((r) => r.resources ?? []);
  assert.ok(
    allExposed.includes('audio/assistant/*.ogg'),
    'manifest.json must expose audio/assistant/*.ogg in web_accessible_resources'
  );

  // onboarding_restore.ogg is pending user download (A3); verify all 15 bundled OGGs strictly
  const pendingGuides = new Set(['onboarding_restore']);
  for (const guideId of ASSISTANT_GUIDE_ORDER) {
    const labels = ASSISTANT_GUIDE_LABELS[guideId];
    assert.ok(labels && labels.tr.length > 4 && labels.en.length > 4, `Missing labels for ${guideId}`);
    assert.ok(
      !/duolingo|chatgpt/i.test(`${labels.tr} ${labels.en}`),
      `Trademark term found in guide label for ${guideId}`
    );

    const relPath = getGuideAudioRelativePath(guideId);
    const absPath = path.resolve(process.cwd(), 'public', relPath);
    if (pendingGuides.has(guideId) && !fs.existsSync(absPath)) {
      continue;
    }
    assert.ok(fs.existsSync(absPath), `Missing assistant OGG: ${absPath}`);
    const stat = fs.statSync(absPath);
    assert.ok(stat.size > 12_000, `Assistant OGG too small / corrupt for ${guideId}: ${stat.size} bytes`);
  }
});

test('all 92 per-question Remedial ElevenLabs Opus OGG files exist, have valid headers, zero orphans, and are exposed in manifest', () => {
  const questionAudioDir = path.resolve(process.cwd(), 'public', ...REMEDIAL_QUESTION_AUDIO_DIR.split('/'));
  const expectedIds = Object.keys(REMEDIAL_QUESTION_SCRIPTS);
  assert.equal(expectedIds.length, 92, 'Expected 92 per-question scripts');

  const manifestPath = path.resolve(process.cwd(), 'public', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    web_accessible_resources?: Array<{ resources?: string[] }>;
  };
  const allExposed = (manifest.web_accessible_resources ?? []).flatMap((r) => r.resources ?? []);
  assert.ok(
    allExposed.includes(`${REMEDIAL_QUESTION_AUDIO_DIR}/*.ogg`),
    `manifest.json must expose ${REMEDIAL_QUESTION_AUDIO_DIR}/*.ogg in web_accessible_resources`
  );

  const actualFiles = fs
    .readdirSync(questionAudioDir)
    .filter((f) => f.toLowerCase().endsWith('.ogg'))
    .sort();
  assert.equal(actualFiles.length, 92, `Expected 92 OGG files in ${questionAudioDir}, got ${actualFiles.length}`);

  const expectedFileSet = new Set(expectedIds.map((id) => `${id}.ogg`));
  for (const actual of actualFiles) {
    assert.ok(expectedFileSet.has(actual), `Unexpected orphan OGG in remedial_questions: ${actual}`);
  }

  for (const audioId of expectedIds) {
    const filePath = path.join(questionAudioDir, `${audioId}.ogg`);
    assert.ok(fs.existsSync(filePath), `Missing question OGG: ${filePath}`);
    const buf = fs.readFileSync(filePath);
    assert.ok(buf.length > 12_000, `Question OGG too small / corrupt for ${audioId}: ${buf.length} bytes`);
    const validHeader =
      buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53; // OggS
    assert.ok(validHeader, `Invalid Ogg Opus header for ${audioId}`);

    // Verify 1-to-1 acoustic word timings for karaoke highlighting
    const script = REMEDIAL_QUESTION_SCRIPTS[audioId]!;
    const words = script.trim().split(/\s+/).filter(Boolean);
    const timings = REMEDIAL_QUESTION_AUDIO_WORD_TIMINGS[audioId];
    assert.ok(timings && timings.length > 0, `Missing question word timings for ${audioId}`);
    assert.equal(
      timings.length,
      words.length,
      `Question word timing mismatch for ${audioId}: ${timings.length} vs ${words.length}`
    );
    let prevStart = -1;
    for (let i = 0; i < timings.length; i += 1) {
      const pair = timings[i]!;
      const startMs: number = pair[0];
      const endMs: number = pair[1];
      assert.ok(
        Number.isFinite(startMs) && Number.isFinite(endMs) && startMs >= 0 && endMs > startMs,
        `Invalid question timing interval for ${audioId}[${i}]: [${startMs}, ${endMs}]`
      );
      assert.ok(
        startMs >= prevStart,
        `Non-monotonic question timing for ${audioId}[${i}]: ${startMs} < ${prevStart}`
      );
      prevStart = startMs;
    }
    assert.equal(findActiveWordIndex(timings, timings[0]![0] + 10, 0), 0);
    assert.equal(
      findActiveWordIndex(timings, timings[timings.length - 1]![0] + 10, 0),
      timings.length - 1
    );
  }
});
