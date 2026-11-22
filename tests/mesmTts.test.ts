import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_ENGLISH_TTS_RATE,
  SLOW_ENGLISH_TTS_RATE,
} from '../src/shared/speech.ts';
import {
  applyMesmLevelAndTrim,
  getMesmVoiceOpfsName,
  getMesmVoiceUrl,
  isMesmVoiceMode,
  MESM_VOICE_CATALOG,
  normalizeMesmText,
  normalizeTtsVoiceMode,
  parsePdnBinary,
  postProcessEspeakToMisaki,
  splitMesmSentences,
  tokenizeMesmPhonemes,
} from '../src/shared/mesmTtsFrontend.ts';

test('normalizeTtsVoiceMode migrates all legacy/removed English voice modes cleanly to mesm_heart', () => {
  assert.equal(normalizeTtsVoiceMode('mesm_heart'), 'mesm_heart');
  assert.equal(normalizeTtsVoiceMode('neural'), 'mesm_heart');
  assert.equal(normalizeTtsVoiceMode('mesm_hadley'), 'mesm_heart');
  assert.equal(normalizeTtsVoiceMode('mesm_bryony'), 'mesm_heart');
  assert.equal(normalizeTtsVoiceMode('mesm_miles'), 'mesm_heart');
  assert.equal(normalizeTtsVoiceMode('kokoro_heart'), 'mesm_heart');
  assert.equal(normalizeTtsVoiceMode('kitten_bella'), 'mesm_heart');
  assert.equal(normalizeTtsVoiceMode('hybrid'), 'mesm_heart');
  assert.equal(normalizeTtsVoiceMode(undefined), 'mesm_heart');
  assert.equal(isMesmVoiceMode('mesm_heart'), true);
  assert.equal(isMesmVoiceMode('neural'), false);
});

test('mesm-tts catalog exposes only Heart v2g with valid fallback URL and OPFS filename', () => {
  assert.equal(
    getMesmVoiceUrl('mesm_heart'),
    'https://huggingface.co/mesmertech/mesm-tts/resolve/main/web/v2/models/v2g.pdn'
  );
  assert.equal(getMesmVoiceOpfsName('mesm_heart'), 'mesm_heart_v2g.pdn');
  assert.deepEqual(Object.keys(MESM_VOICE_CATALOG), ['mesm_heart']);
});

test('normalizeMesmText and splitMesmSentences handle titles, money, times, and abbreviations', () => {
  assert.equal(normalizeMesmText('Dr. Smith paid $12.50 at 3:05.'), 'Doctor Smith paid 12 dollars and 50 cents at 3 oh 5.');
  const sentences = splitMesmSentences('Dr. Smith arrived at 8. He brought two reports! Did everyone agree?');
  assert.deepEqual(sentences, [
    'Dr. Smith arrived at 8.',
    'He brought two reports!',
    'Did everyone agree?',
  ]);
});

test('postProcessEspeakToMisaki and tokenizeMesmPhonemes convert diphthongs and wrap [0, ...ids, 0]', () => {
  const misaki = postProcessEspeakToMisaki('ɔːlðˈoʊ ðə pɹəpˈoʊzəl kəmˈɪɾi ɹˈeɪzd tʃaɪld dʒɔɪ');
  assert.ok(misaki.includes('O'), 'expected oʊ -> O');
  assert.ok(misaki.includes('A'), 'expected eɪ -> A');
  assert.ok(misaki.includes('T'), 'expected flap ɾ -> T');
  assert.ok(misaki.includes('ʧ'), 'expected tʃ -> ʧ');
  assert.ok(misaki.includes('ʤ'), 'expected dʒ -> ʤ');
  assert.ok(misaki.includes('I'), 'expected aɪ -> I');
  assert.ok(misaki.includes('Y'), 'expected ɔɪ -> Y');
  assert.ok(misaki.includes('ᵊl'), 'expected word-final əl -> ᵊl');

  const ids = tokenizeMesmPhonemes(misaki);
  assert.equal(ids[0], 0);
  assert.equal(ids[ids.length - 1], 0);
  assert.ok(ids.length > 10 && ids.length <= 512);
  assert.deepEqual(tokenizeMesmPhonemes('   '), []);
});

test('applyMesmLevelAndTrim limits peaks via soft knee and trims outer silence', () => {
  const pcm = new Float32Array(24000);
  for (let i = 10000; i < 12000; i += 1) {
    pcm[i] = 0.95 * Math.sin(i * 0.1);
  }
  const out = applyMesmLevelAndTrim(pcm, 6.0, 24000);
  assert.ok(out.length < pcm.length / 2, 'expected outer silence trimmed');
  let maxAbs = 0;
  for (let i = 0; i < out.length; i += 1) {
    maxAbs = Math.max(maxAbs, Math.abs(out[i]!));
  }
  assert.ok(maxAbs <= 1.0, `soft knee must keep peaks <= 1.0, got ${maxAbs}`);
});

test('parsePdnBinary parses valid PDN1 header and rejects corrupt magic', () => {
  const hdrJson = JSON.stringify({ cfg: { icfg: [1], fcfg: [0.5], text: { max_pos: 512 } }, tensors: [] });
  const hdrBytes = new TextEncoder().encode(hdrJson);
  const payload = new Uint8Array([10, 20, 30, 40]);
  const buf = new Uint8Array(8 + hdrBytes.length + payload.length);
  buf.set([80, 68, 78, 49], 0); // PDN1
  new DataView(buf.buffer).setUint32(4, hdrBytes.length, true);
  buf.set(hdrBytes, 8);
  buf.set(payload, 8 + hdrBytes.length);

  const parsed = parsePdnBinary(buf);
  assert.equal(parsed.hdr.cfg.text.max_pos, 512);
  assert.deepEqual(Array.from(parsed.blob), [10, 20, 30, 40]);

  assert.throws(() => parsePdnBinary(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])), /Invalid PDN magic/);
});

test('bundled public/tts/mesm_pdn.wasm and mesm_heart_v2g.pdn exist and are valid', () => {
  const wasmPath = path.resolve(import.meta.dirname, '../public/tts/mesm_pdn.wasm');
  assert.ok(fs.existsSync(wasmPath), 'public/tts/mesm_pdn.wasm must exist');
  const wasmBytes = fs.readFileSync(wasmPath);
  assert.ok(wasmBytes.byteLength > 50_000 && wasmBytes.byteLength < 300_000, 'unexpected mesm_pdn.wasm size');
  assert.equal(WebAssembly.validate(wasmBytes), true);

  const pdnPath = path.resolve(import.meta.dirname, '../public/tts/mesm_heart_v2g.pdn');
  assert.ok(fs.existsSync(pdnPath), 'public/tts/mesm_heart_v2g.pdn must exist');
  const pdnBytes = fs.readFileSync(pdnPath);
  assert.ok(pdnBytes.byteLength > 2_000_000 && pdnBytes.byteLength < 3_000_000, 'unexpected mesm_heart_v2g.pdn size');
  const parsed = parsePdnBinary(new Uint8Array(pdnBytes.buffer, pdnBytes.byteOffset, pdnBytes.byteLength));
  assert.equal(parsed.hdr.cfg.text.max_pos, 512);
  assert.ok(parsed.hdr.tensors.length > 20);
});

test('default and slow English TTS rate constants match 0.85x and 0.50x', () => {
  assert.equal(DEFAULT_ENGLISH_TTS_RATE, 0.85);
  assert.equal(SLOW_ENGLISH_TTS_RATE, 0.5);
});
