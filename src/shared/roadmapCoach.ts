import type { SupportedLanguageCode } from './i18n';
import {
  ACTIVE_ROADMAP_SESSION_VERSION,
  type LessonExerciseKind,
  type RoadmapActiveSession,
  type RoadmapCoachInsight,
  type RoadmapLessonRecord,
} from './types.ts';

export interface RecentRoadmapWindowSummary {
  lessonCount: number;
  avgAccuracyPct: number;
  totalQuestions: number;
  totalRepeatedMistakes: number;
  trend: 'improving' | 'steady' | 'dipping';
  recurringWords: Array<{
    en: string;
    expected: string;
    wrongCount: number;
    repeatedLessons: number;
    kinds: LessonExerciseKind[];
  }>;
  weakKinds: Array<{
    kind: LessonExerciseKind;
    wrong: number;
    total: number;
    accuracyPct: number;
  }>;
  strongKinds: LessonExerciseKind[];
  strongWordsSample: string[];
}

export const LESSON_KIND_LABELS: Record<
  LessonExerciseKind,
  { tr: string; en: string }
> = {
  select_meaning: { tr: 'Türkçe anlam seçme', en: 'meaning selection' },
  select_en: { tr: 'İngilizce karşılık seçme', en: 'English word match' },
  word_bank: { tr: 'cümle kurma', en: 'word-bank sentence building' },
  cloze_blank: { tr: 'boşluk doldurma', en: 'fill-in-the-blank' },
  audio_dictation: { tr: 'dinle & yaz', en: 'audio dictation' },
  free_translation: { tr: 'yazılı çeviri', en: 'free typing translation' },
};

/**
 * Aggregate the latest up to 5 completed Roadmap lessons into recurring mistake words,
 * repeated retry misses, weak/strong exercise types, and accuracy trend.
 */
export function summarizeRecentRoadmapLessons(
  records: RoadmapLessonRecord[],
  maxLessons: number = 5
): RecentRoadmapWindowSummary {
  const recent = records.slice(-Math.max(1, maxLessons));
  if (recent.length === 0) {
    return {
      lessonCount: 0,
      avgAccuracyPct: 0,
      totalQuestions: 0,
      totalRepeatedMistakes: 0,
      trend: 'steady',
      recurringWords: [],
      weakKinds: [],
      strongKinds: [],
      strongWordsSample: [],
    };
  }

  let accSum = 0;
  let totalQuestions = 0;
  let totalRepeatedMistakes = 0;

  const wordMap = new Map<
    string,
    {
      en: string;
      expected: string;
      wrongCount: number;
      lessonIds: Set<string>;
      repeatedAny: boolean;
      kinds: Set<LessonExerciseKind>;
    }
  >();

  const kindTotals = new Map<LessonExerciseKind, { correct: number; wrong: number }>();
  const strongWordCounts = new Map<string, number>();

  for (const rec of recent) {
    accSum += rec.accuracyPct;
    totalQuestions += rec.totalQuestions;
    totalRepeatedMistakes += rec.repeatedMistakeCount;

    for (const w of rec.strongWords) {
      const clean = w.trim();
      if (clean) {
        strongWordCounts.set(clean, (strongWordCounts.get(clean) ?? 0) + 1);
      }
    }

    for (const [k, stats] of Object.entries(rec.byKind ?? {})) {
      const kind = k as LessonExerciseKind;
      if (!stats) continue;
      const cur = kindTotals.get(kind) ?? { correct: 0, wrong: 0 };
      cur.correct += stats.correct;
      cur.wrong += stats.wrong;
      kindTotals.set(kind, cur);
    }

    for (const m of rec.mistakes ?? []) {
      const key = m.en.trim().toLowerCase() || m.cardId;
      const existing = wordMap.get(key) ?? {
        en: m.en,
        expected: m.expected,
        wrongCount: 0,
        lessonIds: new Set<string>(),
        repeatedAny: false,
        kinds: new Set<LessonExerciseKind>(),
      };
      existing.wrongCount += Math.max(1, m.wrongCount);
      existing.lessonIds.add(rec.id);
      if (m.repeatedWrong) existing.repeatedAny = true;
      existing.kinds.add(m.kind);
      wordMap.set(key, existing);
    }
  }

  let trend: 'improving' | 'steady' | 'dipping' = 'steady';
  if (recent.length >= 3) {
    const mid = Math.floor(recent.length / 2);
    const earlyAvg =
      recent.slice(0, mid).reduce((sum, r) => sum + r.accuracyPct, 0) / Math.max(1, mid);
    const lateAvg =
      recent.slice(mid).reduce((sum, r) => sum + r.accuracyPct, 0) /
      Math.max(1, recent.length - mid);
    if (lateAvg - earlyAvg >= 6) trend = 'improving';
    else if (earlyAvg - lateAvg >= 6) trend = 'dipping';
  }

  const recurringWords = [...wordMap.values()]
    .map((item) => ({
      en: item.en,
      expected: item.expected,
      wrongCount: item.wrongCount,
      repeatedLessons: item.lessonIds.size,
      repeatedAny: item.repeatedAny,
      kinds: [...item.kinds],
    }))
    .sort((a, b) => {
      const scoreB = b.wrongCount + b.repeatedLessons * 2 + (b.repeatedAny ? 2 : 0);
      const scoreA = a.wrongCount + a.repeatedLessons * 2 + (a.repeatedAny ? 2 : 0);
      return scoreB - scoreA;
    })
    .slice(0, 4)
    .map(({ en, expected, wrongCount, repeatedLessons, kinds }) => ({
      en,
      expected,
      wrongCount,
      repeatedLessons,
      kinds,
    }));

  const kindEntries = [...kindTotals.entries()].map(([kind, counts]) => {
    const total = counts.correct + counts.wrong;
    const accuracyPct = total > 0 ? Math.round((counts.correct / total) * 100) : 100;
    return { kind, wrong: counts.wrong, total, accuracyPct };
  });

  const weakKinds = kindEntries
    .filter((entry) => entry.wrong > 0 && entry.total >= 2 && entry.accuracyPct < 85)
    .sort((a, b) => a.accuracyPct - b.accuracyPct || b.wrong - a.wrong)
    .slice(0, 2);

  const strongKinds = kindEntries
    .filter((entry) => entry.total >= 2 && entry.accuracyPct >= 88)
    .sort((a, b) => b.accuracyPct - a.accuracyPct)
    .slice(0, 2)
    .map((entry) => entry.kind);

  const missedSet = new Set(recurringWords.map((w) => w.en.toLowerCase()));
  const strongWordsSample = [...strongWordCounts.entries()]
    .filter(([word]) => !missedSet.has(word.toLowerCase()))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([word]) => word);

  return {
    lessonCount: recent.length,
    avgAccuracyPct: Math.round(accSum / recent.length),
    totalQuestions,
    totalRepeatedMistakes,
    trend,
    recurringWords,
    weakKinds,
    strongKinds,
    strongWordsSample,
  };
}

/**
 * Deterministic fallback micro-report displayed at the top-left of the Roadmap view
 * when AI is disabled or unavailable, or immediately on lesson completion before AI returns.
 */
export function buildFallbackRoadmapCoachBanner(
  records: RoadmapLessonRecord[],
  lang: SupportedLanguageCode
): RoadmapCoachInsight {
  const summary = summarizeRecentRoadmapLessons(records, 5);
  const now = Date.now();
  const isTr = lang === 'tr';

  if (summary.lessonCount === 0) {
    return {
      status: 'good',
      message: isTr
        ? 'İlk dersini tamamla; son 5 dersteki hataların ve ilerlemen burada özetlenecek.'
        : 'Complete your first lesson to see your last-5-lesson progress and focus areas here.',
      generatedAt: now,
      lessonCountAnalyzed: 0,
      source: 'local',
    };
  }

  const weakKindLabels = summary.weakKinds.map((wk) =>
    isTr ? LESSON_KIND_LABELS[wk.kind].tr : LESSON_KIND_LABELS[wk.kind].en
  );
  const weakWords = summary.recurringWords
    .slice(0, 2)
    .map((w) => `'${w.en}'`);

  const focusParts: string[] = [];
  if (weakKindLabels.length > 0) focusParts.push(weakKindLabels.join(' & '));
  if (weakWords.length > 0) focusParts.push(weakWords.join(', '));
  const focusPhrase = focusParts.join(' · ');

  if (
    summary.avgAccuracyPct >= 88 &&
    summary.totalRepeatedMistakes <= 1 &&
    summary.recurringWords.every((w) => w.wrongCount <= 1)
  ) {
    return {
      status: 'great',
      message: isTr
        ? `İlerlemen çok iyi! Son ${summary.lessonCount} derste %${summary.avgAccuracyPct} doğrulukla neredeyse hiç takılmadın.`
        : `Great progress! ${summary.avgAccuracyPct}% accuracy across your last ${summary.lessonCount} lessons with almost no slips.`,
      generatedAt: now,
      lessonCountAnalyzed: summary.lessonCount,
      source: 'local',
    };
  }

  if (summary.avgAccuracyPct >= 72) {
    const suffix = focusPhrase
      ? isTr
        ? `ancak ${focusPhrase} kısımlarında sık takılıyorsun.`
        : `but you often stumble on ${focusPhrase}.`
      : isTr
        ? 'ama tekrar eden birkaç kelimede hız kesiyorsun.'
        : 'with just a few recurring slips to smooth out.';

    return {
      status: 'good',
      message: isTr
        ? `İlerlemen iyi (%${summary.avgAccuracyPct}), ${suffix}`
        : `Good progress (${summary.avgAccuracyPct}%), ${suffix}`,
      generatedAt: now,
      lessonCountAnalyzed: summary.lessonCount,
      source: 'local',
    };
  }

  return {
    status: 'focus',
    message: isTr
      ? `Son ${summary.lessonCount} derste doğruluk %${summary.avgAccuracyPct}${
          focusPhrase ? ` — özellikle ${focusPhrase} üzerinde yoğunlaş.` : ' — kelimeleri tekrar pekiştir.'
        }`
      : `Accuracy over the last ${summary.lessonCount} lessons is ${summary.avgAccuracyPct}%${
          focusPhrase ? ` — focus closely on ${focusPhrase}.` : ' — review tricky words steadily.'
        }`,
    generatedAt: now,
    lessonCountAnalyzed: summary.lessonCount,
    source: 'local',
  };
}

/**
 * Validate a persisted active roadmap session before auto-resuming in UI.
 */
export function isValidActiveRoadmapSession(
  raw: unknown
): raw is RoadmapActiveSession {
  if (!raw || typeof raw !== 'object') return false;
  const s = raw as Partial<RoadmapActiveSession>;
  if (s.version !== ACTIVE_ROADMAP_SESSION_VERSION) return false;
  if (typeof s.unitId !== 'string' || !s.unitId) return false;
  if (typeof s.nodeIndex !== 'number' && s.nodeIndex !== 'jump_test') return false;
  if (typeof s.stepIndex !== 'number' || s.stepIndex < 0) return false;
  if (!Array.isArray(s.queue) || s.queue.length === 0) return false;
  if (typeof s.currentIdx !== 'number' || s.currentIdx < 0) return false;
  if (!s.readyToFinish && s.currentIdx >= s.queue.length) return false;
  return true;
}
