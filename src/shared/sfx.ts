/**
 * Lightweight studio-grade Web Audio API sound effects (SFX) for LingoEx.
 * Zero external assets, zero latency, safe no-op in non-browser/test environments.
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new Ctor();
    }
    if (sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

interface ToneStep {
  freq: number;
  startSec: number;
  durSec: number;
  gain: number;
  type: OscillatorType;
  slideToFreq?: number;
  overtoneFreq?: number;
  overtoneGain?: number;
}

function playToneSequence(steps: ToneStep[], lowpassHz = 3600): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime + 0.005;
    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.setValueAtTime(lowpassHz, now);
    masterFilter.connect(ctx.destination);

    for (const s of steps) {
      const t0 = now + s.startSec;
      const t1 = t0 + s.durSec;

      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = s.type;
      osc.frequency.setValueAtTime(s.freq, t0);
      if (s.slideToFreq) {
        osc.frequency.exponentialRampToValueAtTime(s.slideToFreq, t1);
      }

      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(s.gain, t0 + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t1);

      osc.connect(env);
      env.connect(masterFilter);
      osc.start(t0);
      osc.stop(t1 + 0.02);

      if (s.overtoneFreq && s.overtoneGain) {
        const over = ctx.createOscillator();
        const overEnv = ctx.createGain();
        over.type = 'sine';
        over.frequency.setValueAtTime(s.overtoneFreq, t0);
        overEnv.gain.setValueAtTime(0.0001, t0);
        overEnv.gain.linearRampToValueAtTime(s.overtoneGain, t0 + 0.01);
        overEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + s.durSec * 0.72);
        over.connect(overEnv);
        overEnv.connect(masterFilter);
        over.start(t0);
        over.stop(t1 + 0.02);
      }
    }
  } catch {
    // Ignore audio context autoplay/hardware failures
  }
}

/** Bright, warm 2-note ascending harmonic chime for correct answers. */
export function playCorrectSfx(): void {
  playToneSequence(
    [
      {
        freq: 587.33, // D5
        startSec: 0,
        durSec: 0.16,
        gain: 0.14,
        type: 'sine',
        overtoneFreq: 1174.66,
        overtoneGain: 0.04,
      },
      {
        freq: 880.0, // A5
        startSec: 0.085,
        durSec: 0.28,
        gain: 0.16,
        type: 'sine',
        overtoneFreq: 1760.0,
        overtoneGain: 0.045,
      },
    ],
    4200
  );
}

/** Soft, unmistakable low 2-note descending wooden tone for wrong answers. */
export function playWrongSfx(): void {
  playToneSequence(
    [
      {
        freq: 246.94, // B3
        slideToFreq: 220.0,
        startSec: 0,
        durSec: 0.14,
        gain: 0.15,
        type: 'triangle',
      },
      {
        freq: 196.0, // G3
        slideToFreq: 174.61,
        startSec: 0.11,
        durSec: 0.24,
        gain: 0.16,
        type: 'triangle',
      },
    ],
    950
  );
}

/** Uplifting 4-note major arpeggio fanfare when completing a lesson or workshop. */
export function playLessonCompleteSfx(): void {
  playToneSequence(
    [
      { freq: 523.25, startSec: 0.0, durSec: 0.16, gain: 0.13, type: 'sine', overtoneFreq: 1046.5, overtoneGain: 0.03 },
      { freq: 659.25, startSec: 0.09, durSec: 0.16, gain: 0.13, type: 'sine', overtoneFreq: 1318.5, overtoneGain: 0.03 },
      { freq: 783.99, startSec: 0.18, durSec: 0.18, gain: 0.14, type: 'sine', overtoneFreq: 1567.98, overtoneGain: 0.035 },
      { freq: 1046.5, startSec: 0.28, durSec: 0.42, gain: 0.16, type: 'sine', overtoneFreq: 2093.0, overtoneGain: 0.04 },
    ],
    4800
  );
}

/** Subtle ultra-short tactile pop when tapping tiles or option cards. */
export function playTapSfx(): void {
  playToneSequence(
    [
      {
        freq: 680,
        slideToFreq: 420,
        startSec: 0,
        durSec: 0.032,
        gain: 0.045,
        type: 'sine',
      },
    ],
    2200
  );
}
