import type { ExtensionSettings } from './types';

export const QUICK_INTERVAL_PRESETS = [15, 20, 45, 60] as const;

export interface PromptSchedulePatch {
  intervalMinutes?: number;
  enabled?: boolean;
  pausedUntilManual?: boolean;
  clearMute?: boolean;
}

/** Clamp a periodic prompt interval into the supported 1..240 minute range. */
export function clampIntervalMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 20;
  return Math.max(1, Math.min(240, Math.round(minutes)));
}

/**
 * Apply an inline schedule update from the floating recall widget while preserving
 * the learner's last chosen intervalMinutes when pausing until manual resume.
 */
export function applyPromptScheduleUpdate(
  current: ExtensionSettings,
  patch: PromptSchedulePatch
): ExtensionSettings {
  const nextInterval =
    patch.intervalMinutes !== undefined
      ? clampIntervalMinutes(patch.intervalMinutes)
      : current.intervalMinutes;

  if (patch.pausedUntilManual === true) {
    return {
      ...current,
      intervalMinutes: nextInterval,
      enabled: false,
      pausedUntilManual: true,
      mutedUntil: null,
    };
  }

  const nextEnabled =
    patch.enabled !== undefined
      ? patch.enabled
      : patch.intervalMinutes !== undefined
        ? true
        : current.enabled;

  const nextPausedUntilManual =
    patch.pausedUntilManual !== undefined
      ? patch.pausedUntilManual
      : nextEnabled
        ? false
        : Boolean(current.pausedUntilManual);

  const nextMutedUntil =
    patch.clearMute || patch.intervalMinutes !== undefined ? null : current.mutedUntil;

  return {
    ...current,
    intervalMinutes: nextInterval,
    enabled: nextEnabled,
    pausedUntilManual: nextPausedUntilManual,
    mutedUntil: nextMutedUntil,
  };
}

/**
 * When the learner paused auto-prompts with "Pause until I turn it back on"
 * (`pausedUntilManual: true`) and later clicks "Şimdi Sor" / Quick Quiz,
 * automatically restore periodic prompts at their last saved intervalMinutes.
 * Leaves permanent Options-page `enabled: false` (where `pausedUntilManual` is false) intact.
 */
export function applyManualTriggerResume(current: ExtensionSettings): {
  next: ExtensionSettings;
  resumed: boolean;
} {
  if (!current.enabled && current.pausedUntilManual === true) {
    return {
      resumed: true,
      next: {
        ...current,
        enabled: true,
        pausedUntilManual: false,
        mutedUntil: null,
      },
    };
  }
  return { resumed: false, next: current };
}
