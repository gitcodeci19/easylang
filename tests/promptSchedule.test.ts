import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyManualTriggerResume,
  applyPromptScheduleUpdate,
  clampIntervalMinutes,
} from '../src/shared/promptSchedule.ts';
import type { ExtensionSettings } from '../src/shared/types.ts';

const BASE_SETTINGS: ExtensionSettings = {
  enabled: true,
  intervalMinutes: 20,
  retryDelayMinutes: 20,
  contentMode: 'mixed',
  levels: ['A1', 'A2', 'B1', 'B2', 'C1'],
  includeUserCards: true,
  autoSpeak: false,
  ttsVoiceMode: 'mesm_heart',
  skipFullscreen: true,
  autoCloseCorrectSeconds: 0,
  quietHoursStart: null,
  quietHoursEnd: null,
  autoTranslateContextMenu: true,
  blockedDomains: [],
  mutedUntil: null,
  pausedUntilManual: false,
  adaptiveDifficulty: true,
  uiLanguage: 'tr',
};

test('applyPromptScheduleUpdate changes interval, clears mute, and clamps bounds', () => {
  const muted = { ...BASE_SETTINGS, mutedUntil: Date.now() + 3_600_000, enabled: false, pausedUntilManual: true };
  const updated = applyPromptScheduleUpdate(muted, { intervalMinutes: 45, clearMute: true });

  assert.equal(updated.intervalMinutes, 45);
  assert.equal(updated.enabled, true);
  assert.equal(updated.pausedUntilManual, false);
  assert.equal(updated.mutedUntil, null);

  assert.equal(clampIntervalMinutes(0), 1);
  assert.equal(clampIntervalMinutes(999), 240);
  assert.equal(clampIntervalMinutes(Number.NaN), 20);
});

test('pause until manual preserves last intervalMinutes and resumes on Quick Quiz trigger', () => {
  const custom45 = applyPromptScheduleUpdate(BASE_SETTINGS, { intervalMinutes: 45 });
  const paused = applyPromptScheduleUpdate(custom45, {
    enabled: false,
    pausedUntilManual: true,
    clearMute: true,
  });

  assert.equal(paused.enabled, false);
  assert.equal(paused.pausedUntilManual, true);
  assert.equal(paused.intervalMinutes, 45);
  assert.equal(paused.mutedUntil, null);

  const resumed = applyManualTriggerResume(paused);
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.next.enabled, true);
  assert.equal(resumed.next.pausedUntilManual, false);
  assert.equal(resumed.next.intervalMinutes, 45);
});

test('permanent Options-page disable (pausedUntilManual=false) is not overridden by Quick Quiz', () => {
  const optionsDisabled: ExtensionSettings = {
    ...BASE_SETTINGS,
    enabled: false,
    pausedUntilManual: false,
  };

  const result = applyManualTriggerResume(optionsDisabled);
  assert.equal(result.resumed, false);
  assert.equal(result.next.enabled, false);
});
