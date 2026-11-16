import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialSkillProfile } from '../src/shared/analytics.ts';
import {
  B1_PROMOTION_ELO_THRESHOLD,
  applyB1PromotionDecision,
  buildInitialProfileForOnboarding,
  createDefaultOnboardingState,
  getBackupNudgeSnoozeTimestamp,
  getOnboardingCopy,
  getTomorrowPromptTimestamp,
  parseFullBackupJson,
  shouldShowB1ReadinessPrompt,
  shouldShowBackupNudge,
} from '../src/shared/onboarding.ts';
import type { ExtensionSettings } from '../src/shared/types.ts';

function makeSettings(levels: ExtensionSettings['levels']): ExtensionSettings {
  return {
    enabled: false,
    intervalMinutes: 20,
    retryDelayMinutes: 20,
    contentMode: 'mixed',
    levels,
    includeUserCards: true,
    autoSpeak: false,
    skipFullscreen: true,
    autoCloseCorrectSeconds: 2,
    quietHoursStart: null,
    quietHoursEnd: null,
    autoTranslateContextMenu: true,
    blockedDomains: [],
    mutedUntil: null,
    adaptiveDifficulty: true,
    uiLanguage: 'tr',
  };
}

test('onboarding A1 starter aspiring to C1 is capped at A1/A2 with B1 gate active', () => {
  const plan = buildInitialProfileForOnboarding({
    nativeLanguage: 'tr',
    currentLevel: 'A1',
    targetLevel: 'C1',
  });

  assert.deepEqual(plan.initialLevels, ['A1', 'A2']);
  assert.equal(plan.initialRating, 820);
  assert.equal(plan.onboardingPatch.completed, true);
  assert.equal(plan.onboardingPatch.initialCurrentLevel, 'A1');
  assert.equal(plan.onboardingPatch.targetLevel, 'C1');
  assert.equal(plan.onboardingPatch.b1GateActive, true);
  assert.equal(plan.onboardingPatch.b1GateAccepted, false);
});

test('onboarding B1 and above skips B1 readiness gate and unlocks chosen range', () => {
  const b1Plan = buildInitialProfileForOnboarding({
    nativeLanguage: 'en',
    currentLevel: 'B1',
    targetLevel: 'B2',
  });
  assert.deepEqual(b1Plan.initialLevels, ['B1', 'B2']);
  assert.equal(b1Plan.initialRating, 1150);
  assert.equal(b1Plan.onboardingPatch.b1GateActive, false);
  assert.equal(b1Plan.onboardingPatch.b1GateAccepted, true);

  const b2Plan = buildInitialProfileForOnboarding({
    nativeLanguage: 'tr',
    currentLevel: 'B2',
    targetLevel: 'C2',
  });
  assert.deepEqual(b2Plan.initialLevels, ['B2', 'C1']);
  assert.equal(b2Plan.onboardingPatch.targetLevel, 'C2');
  assert.equal(b2Plan.onboardingPatch.b1GateActive, false);
});

test('B1 readiness notification stays visible when unanswered, repeats next day on No, clears on Yes', () => {
  const plan = buildInitialProfileForOnboarding({
    nativeLanguage: 'tr',
    currentLevel: 'A2',
    targetLevel: 'B2',
  });
  const settings = makeSettings(plan.initialLevels);
  const profile = createInitialSkillProfile();
  const day1Noon = new Date(2026, 10, 16, 12, 0, 0, 0).getTime();

  // Below threshold: not shown yet
  profile.rating = B1_PROMOTION_ELO_THRESHOLD - 10;
  assert.equal(shouldShowB1ReadinessPrompt(plan.onboardingPatch, profile, settings, day1Noon), false);

  // Reaches 1100+ Elo while unanswered: always stays visible
  profile.rating = B1_PROMOTION_ELO_THRESHOLD;
  assert.equal(shouldShowB1ReadinessPrompt(plan.onboardingPatch, profile, settings, day1Noon), true);
  assert.equal(
    shouldShowB1ReadinessPrompt(plan.onboardingPatch, profile, settings, day1Noon + 10 * 3_600_000),
    true
  );

  // User clicks "No" -> snoozed until tomorrow, then comes back tomorrow
  const noDecision = applyB1PromotionDecision(plan.onboardingPatch, settings, false, day1Noon);
  assert.deepEqual(noDecision.nextLevels, ['A1', 'A2']);
  assert.equal(
    shouldShowB1ReadinessPrompt(noDecision.nextOnboarding, profile, settings, day1Noon + 3_600_000),
    false
  );

  const tomorrow = getTomorrowPromptTimestamp(day1Noon);
  assert.equal(
    shouldShowB1ReadinessPrompt(noDecision.nextOnboarding, profile, settings, tomorrow),
    true
  );

  // Saying "No" on day 2 snoozes again until day 3
  const noDay2 = applyB1PromotionDecision(noDecision.nextOnboarding, settings, false, tomorrow + 60_000);
  assert.equal(
    shouldShowB1ReadinessPrompt(noDay2.nextOnboarding, profile, settings, tomorrow + 3_600_000),
    false
  );
  assert.equal(
    shouldShowB1ReadinessPrompt(
      noDay2.nextOnboarding,
      profile,
      settings,
      getTomorrowPromptTimestamp(tomorrow + 60_000)
    ),
    true
  );

  // Accepting unlocks B1 permanently
  const yesDecision = applyB1PromotionDecision(noDecision.nextOnboarding, settings, true, tomorrow);
  assert.deepEqual(yesDecision.nextLevels, ['A1', 'A2', 'B1']);
  assert.equal(yesDecision.nextOnboarding.b1GateAccepted, true);
  assert.equal(yesDecision.nextOnboarding.b1GateActive, false);
  const updatedSettings = makeSettings(yesDecision.nextLevels);
  assert.equal(
    shouldShowB1ReadinessPrompt(yesDecision.nextOnboarding, profile, updatedSettings, tomorrow + 99_999_999),
    false
  );
});

test('backup nudge appears once meaningful activity exists and respects snooze & recent backup', () => {
  const ob = createDefaultOnboardingState(true);
  const profile = createInitialSkillProfile();
  const now = 1_700_000_000_000;

  assert.equal(shouldShowBackupNudge(ob, profile, 0, now), false);

  profile.totalAnswered = 10;
  assert.equal(shouldShowBackupNudge(ob, profile, 0, now), true);

  const snoozed = {
    ...ob,
    backupReminderDismissedUntil: getBackupNudgeSnoozeTimestamp(now),
  };
  assert.equal(shouldShowBackupNudge(snoozed, profile, 0, now + 86_400_000), false);
  assert.equal(shouldShowBackupNudge(snoozed, profile, 0, now + 8 * 86_400_000), true);

  const backedUpRecently = {
    ...ob,
    lastBackupAt: now - 3 * 86_400_000,
  };
  assert.equal(shouldShowBackupNudge(backedUpRecently, profile, 0, now), false);
  assert.equal(shouldShowBackupNudge(backedUpRecently, profile, 0, now + 15 * 86_400_000), true);
});

test('parseFullBackupJson validates schema and restores progress safely', () => {
  assert.equal(parseFullBackupJson('not json'), null);
  assert.equal(parseFullBackupJson('{"schema":"other"}'), null);

  const raw = JSON.stringify({
    schema: 'en-tr-recall-backup-v1',
    exportedAt: 123456,
    skillProfile: { ...createInitialSkillProfile(), rating: 1280, totalAnswered: 44 },
    progressMap: {},
    conceptState: { notes: [], lastConceptPromptAtQuestion: 12 },
    userCards: [],
    deletedCardIds: [],
    reviewHistory: [],
    dailyStats: { date: '2026-11-16', shown: 5, correct: 4, wrong: 1, overriddenCorrect: 0 },
    settings: makeSettings(['A1', 'A2', 'B1']),
    onboardingState: createDefaultOnboardingState(true),
    roadmapState: { xp: 140 },
    askedPageSentences: [],
  });

  const parsed = parseFullBackupJson(raw);
  assert.ok(parsed);
  assert.equal(parsed.skillProfile.rating, 1280);
  assert.equal(parsed.skillProfile.totalAnswered, 44);
  assert.equal(parsed.onboardingState.completed, true);
});

test('getOnboardingCopy auto-detects browser language', () => {
  const trCopy = getOnboardingCopy('auto', 'tr-TR');
  assert.equal(trCopy.btnFirstTime, 'İLK DEFA KULLANIYORUM');
  assert.equal(trCopy.btnReturning, 'ZATEN DAHA ÖNCE KULLANDIM');

  const enCopy = getOnboardingCopy('auto', 'en-US');
  assert.ok(enCopy.btnFirstTime.length > 0);
  assert.notEqual(enCopy.btnFirstTime, trCopy.btnFirstTime);
});
