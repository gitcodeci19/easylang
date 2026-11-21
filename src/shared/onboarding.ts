import { createInitialSkillProfile } from './analytics.ts';
import { resolveSupportedLanguage, type SupportedLanguageCode } from './i18n.ts';
import type {
  Card,
  CefrLevel,
  ExtensionSettings,
  FeedbackLanguageMode,
  FullBackupPayload,
  UserCardProgress,
  UserOnboardingState,
  UserSkillProfile,
} from './types';

export const B1_PROMOTION_ELO_THRESHOLD = 1100;
const DAY_MS = 86_400_000;
const BACKUP_NUDGE_REAPPEAR_DAYS = 14;
const BACKUP_DISMISS_DAYS = 7;

const CEFR_RANK: Record<CefrLevel, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

export function createDefaultOnboardingState(completed = false): UserOnboardingState {
  return {
    completed,
    initialCurrentLevel: null,
    targetLevel: null,
    b1GateActive: false,
    b1GateAccepted: completed,
    b1PromptDismissedUntil: null,
    lastBackupAt: null,
    backupReminderDismissedUntil: null,
  };
}

export function normalizeOnboardingState(
  raw: Partial<UserOnboardingState> | null | undefined,
  fallbackCompleted = false
): UserOnboardingState {
  const base = createDefaultOnboardingState(fallbackCompleted);
  if (!raw) return base;
  return {
    completed: typeof raw.completed === 'boolean' ? raw.completed : fallbackCompleted,
    initialCurrentLevel: raw.initialCurrentLevel ?? null,
    targetLevel: raw.targetLevel ?? null,
    b1GateActive: Boolean(raw.b1GateActive),
    b1GateAccepted: typeof raw.b1GateAccepted === 'boolean' ? raw.b1GateAccepted : fallbackCompleted,
    b1PromptDismissedUntil:
      typeof raw.b1PromptDismissedUntil === 'number' ? raw.b1PromptDismissedUntil : null,
    lastBackupAt: typeof raw.lastBackupAt === 'number' ? raw.lastBackupAt : null,
    backupReminderDismissedUntil:
      typeof raw.backupReminderDismissedUntil === 'number'
        ? raw.backupReminderDismissedUntil
        : null,
  };
}

/**
 * Compute initial Recall settings, starting Elo rating, and B1 readiness gate config
 * when a first-time user completes onboarding.
 *
 * Guardrail rule:
 * - Beginners choosing `A1` or `A2` are intentionally capped at max `A2` cards initially
 *   (`['A1', 'A2']`), even if they aspire to `B1`/`B2`/`C1`/`C2`, to prevent overwhelm & churn.
 *   They unlock `B1` only after reaching `1100+ ELO` and confirming readiness.
 * - Users choosing `B1`, `B2`, or `C1` already know their limits, so no gate is placed.
 */
export function buildInitialProfileForOnboarding(options: {
  nativeLanguage: FeedbackLanguageMode;
  currentLevel: CefrLevel;
  targetLevel: CefrLevel;
}): {
  uiLanguage: FeedbackLanguageMode;
  initialLevels: CefrLevel[];
  initialRating: number;
  onboardingPatch: UserOnboardingState;
} {
  const curRank = CEFR_RANK[options.currentLevel] ?? 1;
  const tgtRank = Math.max(curRank, CEFR_RANK[options.targetLevel] ?? curRank);
  const effectiveTarget =
    (Object.keys(CEFR_RANK).find((k) => CEFR_RANK[k as CefrLevel] === tgtRank) as CefrLevel) ??
    options.targetLevel;

  if (options.currentLevel === 'A1' || options.currentLevel === 'A2') {
    const wantsB1Plus = tgtRank >= CEFR_RANK.B1;
    const initialRating = options.currentLevel === 'A1' ? 820 : 960;
    return {
      uiLanguage: options.nativeLanguage,
      // Always feed i+1 A1/A2 mix for A1/A2 starters; never overwhelm with B1+ upfront
      initialLevels: ['A1', 'A2'],
      initialRating,
      onboardingPatch: {
        completed: true,
        initialCurrentLevel: options.currentLevel,
        targetLevel: effectiveTarget,
        b1GateActive: wantsB1Plus,
        b1GateAccepted: !wantsB1Plus,
        b1PromptDismissedUntil: null,
        lastBackupAt: null,
        backupReminderDismissedUntil: null,
      },
    };
  }

  // B1 and above: open up from (current or A2 for warm-up) up to target (capped at C1 deck)
  const datasetLevels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
  const minRank = Math.max(CEFR_RANK.A2, curRank);
  const maxRank = Math.min(CEFR_RANK.C1, tgtRank);
  const selectedLevels = datasetLevels.filter((lvl) => {
    const r = CEFR_RANK[lvl];
    return r >= minRank && r <= maxRank;
  });

  const initialRating =
    options.currentLevel === 'B1'
      ? 1150
      : options.currentLevel === 'B2'
        ? 1350
        : 1550;

  return {
    uiLanguage: options.nativeLanguage,
    initialLevels: selectedLevels.length > 0 ? selectedLevels : ['B1', 'B2'],
    initialRating,
    onboardingPatch: {
      completed: true,
      initialCurrentLevel: options.currentLevel,
      targetLevel: effectiveTarget,
      b1GateActive: false,
      b1GateAccepted: true,
      b1PromptDismissedUntil: null,
      lastBackupAt: null,
      backupReminderDismissedUntil: null,
    },
  };
}

/**
 * Compute tomorrow's local timestamp when user clicks "No" on the B1 readiness check
 * so we ask again every next day until they confirm or enable B1.
 */
export function getTomorrowPromptTimestamp(now: number = Date.now()): number {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  // Guarantee at least 4 hours even if answered late at 23:55
  return Math.max(nextMidnight.getTime(), now + 4 * 3_600_000);
}

/**
 * Determine whether the persistent "Are you ready for B1?" banner should be displayed.
 * Stays visible forever while unanswered (`b1PromptDismissedUntil === null`), and returns
 * every next day if dismissed with "No".
 */
export function shouldShowB1ReadinessPrompt(
  onboarding: UserOnboardingState,
  skillProfile: UserSkillProfile,
  settings: ExtensionSettings,
  now: number = Date.now()
): boolean {
  if (!onboarding.completed || !onboarding.b1GateActive || onboarding.b1GateAccepted) {
    return false;
  }
  if (settings.levels.includes('B1')) {
    return false;
  }
  if (skillProfile.rating < B1_PROMOTION_ELO_THRESHOLD) {
    return false;
  }
  if (onboarding.b1PromptDismissedUntil !== null && now < onboarding.b1PromptDismissedUntil) {
    return false;
  }
  return true;
}

/**
 * Unlock `'B1'` into active CEFR levels once user confirms readiness.
 */
export function applyB1PromotionDecision(
  onboarding: UserOnboardingState,
  settings: ExtensionSettings,
  accepted: boolean,
  now: number = Date.now()
): { nextOnboarding: UserOnboardingState; nextLevels: CefrLevel[] } {
  if (accepted) {
    const nextSet = new Set<CefrLevel>(settings.levels);
    nextSet.add('B1');
    const ordered: CefrLevel[] = (['A1', 'A2', 'B1', 'B2', 'C1'] as CefrLevel[]).filter((l) =>
      nextSet.has(l)
    );
    return {
      nextLevels: ordered,
      nextOnboarding: {
        ...onboarding,
        b1GateActive: false,
        b1GateAccepted: true,
        b1PromptDismissedUntil: null,
      },
    };
  }

  return {
    nextLevels: settings.levels,
    nextOnboarding: {
      ...onboarding,
      b1PromptDismissedUntil: getTomorrowPromptTimestamp(now),
    },
  };
}

/**
 * Decide whether to display a natural, non-intrusive backup reminder pill
 * once the user has built meaningful progress they wouldn't want to lose.
 */
export function shouldShowBackupNudge(
  onboarding: UserOnboardingState,
  skillProfile: UserSkillProfile,
  roadmapCompletedNodesCount: number,
  now: number = Date.now()
): boolean {
  if (!onboarding.completed) return false;
  const activityUnits = skillProfile.totalAnswered + roadmapCompletedNodesCount * 6;
  if (activityUnits < 10) return false;

  if (
    onboarding.backupReminderDismissedUntil !== null &&
    now < onboarding.backupReminderDismissedUntil
  ) {
    return false;
  }
  if (
    onboarding.lastBackupAt !== null &&
    now - onboarding.lastBackupAt < BACKUP_NUDGE_REAPPEAR_DAYS * DAY_MS
  ) {
    return false;
  }
  return true;
}

export function getBackupNudgeSnoozeTimestamp(now: number = Date.now()): number {
  return now + BACKUP_DISMISS_DAYS * DAY_MS;
}

/**
 * Parse and validate an uploaded backup JSON text.
 * Supports full progress backup (`en-tr-recall-backup-v1`).
 */
export function parseFullBackupJson(rawText: string): FullBackupPayload | null {
  try {
    const parsed = JSON.parse(rawText) as Partial<FullBackupPayload> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.schema !== 'en-tr-recall-backup-v1') return null;

    const baseProfile = createInitialSkillProfile();
    return {
      schema: 'en-tr-recall-backup-v1',
      exportedAt: typeof parsed.exportedAt === 'number' ? parsed.exportedAt : Date.now(),
      skillProfile: { ...baseProfile, ...(parsed.skillProfile ?? {}) },
      progressMap:
        parsed.progressMap && typeof parsed.progressMap === 'object'
          ? (parsed.progressMap as Record<string, UserCardProgress>)
          : {},
      conceptState:
        parsed.conceptState && Array.isArray(parsed.conceptState.notes)
          ? parsed.conceptState
          : { notes: [], lastConceptPromptAtQuestion: -10 },
      userCards: Array.isArray(parsed.userCards) ? (parsed.userCards as Card[]) : [],
      deletedCardIds: Array.isArray(parsed.deletedCardIds) ? parsed.deletedCardIds : [],
      reviewHistory: Array.isArray(parsed.reviewHistory) ? parsed.reviewHistory : [],
      dailyStats: parsed.dailyStats ?? {
        date: '',
        shown: 0,
        correct: 0,
        wrong: 0,
        overriddenCorrect: 0,
      },
      settings: parsed.settings as ExtensionSettings,
      onboardingState: normalizeOnboardingState(parsed.onboardingState, true),
      roadmapState:
        parsed.roadmapState && typeof parsed.roadmapState === 'object'
          ? parsed.roadmapState
          : {},
      askedPageSentences: Array.isArray(parsed.askedPageSentences)
        ? parsed.askedPageSentences
        : [],
      roadmapHistory: Array.isArray(parsed.roadmapHistory)
        ? parsed.roadmapHistory
        : undefined,
      roadmapCoachInsight:
        parsed.roadmapCoachInsight && typeof parsed.roadmapCoachInsight === 'object'
          ? parsed.roadmapCoachInsight
          : undefined,
      cardOverrides:
        parsed.cardOverrides && typeof parsed.cardOverrides === 'object'
          ? parsed.cardOverrides
          : undefined,
      remedialProgress:
        parsed.remedialProgress && typeof parsed.remedialProgress === 'object'
          ? parsed.remedialProgress
          : undefined,
    };
  } catch {
    return null;
  }
}

export interface OnboardingCopy {
  title: string;
  subtitle: string;
  btnFirstTime: string;
  btnFirstTimeSub: string;
  btnReturning: string;
  btnReturningSub: string;
  backBtn: string;
  lblNativeLang: string;
  lblCurrentLevel: string;
  lblTargetLevel: string;
  a1CapNotice: string;
  btnStartLearning: string;
  restoreTitle: string;
  restoreDesc: string;
  restoreUploadBtn: string;
  restorePlaceholder: string;
  restoreConfirmBtn: string;
  restoreError: string;
  restoreSkipBtn: string;
  b1ReadyTitle: string;
  b1ReadyDesc: string;
  b1ReadyYes: string;
  b1ReadyNo: string;
  backupNudgeShort: string;
  backupNudgeDash: string;
  backupBtnNow: string;
  backupBtnLater: string;
  backupBtnUpload: string;
  backupSyncedToday: string;
  backupStatusNever: string;
  backupStatusLastFmt: (dateStr: string) => string;
  backupKeyNotice: string;
}

const ONBOARDING_COPY_MAP: Partial<Record<SupportedLanguageCode, OnboardingCopy>> = {
  tr: {
    title: 'LingoEx’e Hoş Geldin',
    subtitle: 'Başlamak için sana uygun seçeneği seç:',
    btnFirstTime: 'İLK DEFA KULLANIYORUM',
    btnFirstTimeSub: 'Seviyene göre dengeli başlangıç ayarla',
    btnReturning: 'ZATEN DAHA ÖNCE KULLANDIM',
    btnReturningSub: 'Eski ilerleme yedeğini (.json) geri yükle',
    backBtn: '← Geri',
    lblNativeLang: 'Ana Dilin (Açıklamalar & Arayüz)',
    lblCurrentLevel: 'Mevcut İngilizce Seviyen',
    lblTargetLevel: 'Hedeflediğin Seviye',
    a1CapNotice:
      'Sağlam ilerlemen ve sıkılmaman için başlangıçta sorular en fazla A2 seviyesinde sorulacak. Elo puanın B1 barajına (1100+) çıktığında sana hazır olup olmadığını soracağız.',
    btnStartLearning: 'Öğrenmeye Başla →',
    restoreTitle: 'Eski İlerlemeyi Geri Yükle',
    restoreDesc:
      'Daha önce indirdiğin yedek dosyasını (.json) seç veya JSON içeriğini aşağıya yapıştır:',
    restoreUploadBtn: 'Dosya Seç (.json)',
    restorePlaceholder: 'Yedek JSON içeriğini buraya yapıştırabilirsin...',
    restoreConfirmBtn: 'Yedeği Yükle ve Devam Et',
    restoreError: 'Geçerli bir LingoEx yedeği (.json) veya kart listesi bulunamadı.',
    restoreSkipBtn: 'Yedeksiz Devam Et',
    b1ReadyTitle: 'Elo puanın B1 seviyesine ulaştı!',
    b1ReadyDesc: 'Kendini B1 seviyesindeki kelimeleri ve cümleleri öğrenmek için hazır hissediyor musun?',
    b1ReadyYes: 'Evet, B1’e Geç',
    b1ReadyNo: 'Hayır, Yarın Sor',
    backupNudgeShort: 'Verilerin yalnızca bu cihazda saklanır — kaybolmaması için yedeğini al.',
    backupNudgeDash:
      'İlerlemen ve Elo geçmişin yalnızca bu tarayıcıda tutulur. Tarayıcı/eklenti silinirse kaybetmemek için yedek al.',
    backupBtnNow: '⬇ Yedek İndir (.json)',
    backupBtnLater: 'Sonra hatırlat',
    backupBtnUpload: '⬆ Yükle',
    backupSyncedToday: '✓ Son yedek: Bugün alındı',
    backupStatusNever: 'Son yedek: Henüz alınmadı',
    backupStatusLastFmt: (d) => `Son yedek: ${d}`,
    backupKeyNotice: 'Not: API anahtarları güvenlik nedeniyle yedek dosyasına dahil edilmez.',
  },
  en: {
    title: 'Welcome to LingoEx',
    subtitle: 'Choose how you would like to get started:',
    btnFirstTime: "I'M USING THIS FOR THE FIRST TIME",
    btnFirstTimeSub: 'Set your language, level, and safe starting pace',
    btnReturning: "I'VE USED THIS BEFORE",
    btnReturningSub: 'Restore your previous progress backup (.json)',
    backBtn: '← Back',
    lblNativeLang: 'Your Native Language (UI & Explanations)',
    lblCurrentLevel: 'Current English Level',
    lblTargetLevel: 'Target Level',
    a1CapNotice:
      'To build real momentum without burnout, prompts start capped at A2 even if your goal is B1+. Once your Elo reaches 1100+, we will ask if you feel ready for B1.',
    btnStartLearning: 'Start Learning →',
    restoreTitle: 'Restore Previous Progress',
    restoreDesc: 'Select a previously exported backup (.json) file or paste its JSON below:',
    restoreUploadBtn: 'Choose Backup (.json)',
    restorePlaceholder: 'Paste your backup JSON content here...',
    restoreConfirmBtn: 'Restore Backup & Continue',
    restoreError: 'Could not parse a valid LingoEx backup (.json) or card list.',
    restoreSkipBtn: 'Continue Without Backup',
    b1ReadyTitle: 'Your Elo reached B1 readiness!',
    b1ReadyDesc: 'Do you feel ready to unlock B1 words and sentences now?',
    b1ReadyYes: 'Yes, Unlock B1',
    b1ReadyNo: 'No, Ask Tomorrow',
    backupNudgeShort: 'Progress lives locally in this browser — save a quick JSON backup.',
    backupNudgeDash:
      'Your progress and Elo live only in this browser. Download a backup so you never lose it.',
    backupBtnNow: '⬇ Download Backup',
    backupBtnLater: 'Remind later',
    backupBtnUpload: '⬆ Restore',
    backupSyncedToday: '✓ Last backup: Today',
    backupStatusNever: 'Last backup: Not yet taken',
    backupStatusLastFmt: (d) => `Last backup: ${d}`,
    backupKeyNotice: 'Note: API keys are excluded from backups for your security.',
  },
  de: {
    title: 'Willkommen bei LingoEx',
    subtitle: 'Wähle deinen Startmodus:',
    btnFirstTime: 'ERSTE NUTZUNG',
    btnFirstTimeSub: 'Sprache und passendes Startniveau festlegen',
    btnReturning: 'BEREITS GENUTZT',
    btnReturningSub: 'Vorheriges Fortschritts-Backup (.json) laden',
    backBtn: '← Zurück',
    lblNativeLang: 'Deine Muttersprache',
    lblCurrentLevel: 'Aktuelles Englischniveau',
    lblTargetLevel: 'Zielniveau',
    a1CapNotice:
      'Um Überforderung zu vermeiden, starten Fragen zunächst bis maximal A2. Sobald dein Elo 1100+ erreicht, fragen wir dich, ob du bereit für B1 bist.',
    btnStartLearning: 'Lernen starten →',
    restoreTitle: 'Fortschritt wiederherstellen',
    restoreDesc: 'Backup-Datei (.json) wählen oder JSON unten einfügen:',
    restoreUploadBtn: 'Datei wählen (.json)',
    restorePlaceholder: 'Backup-JSON hier einfügen...',
    restoreConfirmBtn: 'Wiederherstellen',
    restoreError: 'Kein gültiges Backup (.json) erkannt.',
    restoreSkipBtn: 'Ohne Backup fortfahren',
    b1ReadyTitle: 'B1-Niveau erreicht!',
    b1ReadyDesc: 'Fühlst du dich bereit für B1-Aufgaben?',
    b1ReadyYes: 'Ja, B1 aktivieren',
    b1ReadyNo: 'Nein, morgen fragen',
    backupNudgeShort: 'Daten werden lokal gespeichert – jetzt Backup sichern.',
    backupNudgeDash: 'Dein Fortschritt wird nur lokal gespeichert. Lade regelmäßig ein Backup herunter.',
    backupBtnNow: '⬇ Backup (.json)',
    backupBtnLater: 'Später erinnern',
    backupBtnUpload: '⬆ Laden',
    backupSyncedToday: '✓ Letztes Backup: Heute',
    backupStatusNever: 'Noch kein Backup erstellt',
    backupStatusLastFmt: (d) => `Letztes Backup: ${d}`,
    backupKeyNotice: 'Hinweis: API-Schlüssel werden aus Sicherheitsgründen nicht exportiert.',
  },
  fr: {
    title: 'Bienvenue sur LingoEx',
    subtitle: 'Choisissez comment commencer :',
    btnFirstTime: 'PREMIÈRE UTILISATION',
    btnFirstTimeSub: 'Configurer votre langue et votre niveau de départ',
    btnReturning: 'DÉJÀ UTILISÉ',
    btnReturningSub: 'Importer une sauvegarde (.json) existante',
    backBtn: '← Retour',
    lblNativeLang: 'Votre langue maternelle',
    lblCurrentLevel: "Niveau d'anglais actuel",
    lblTargetLevel: 'Niveau visé',
    a1CapNotice:
      'Pour éviter le découragement, les questions restent limitées à A2 au début. À 1100+ Elo, nous vous demanderons si vous êtes prêt pour B1.',
    btnStartLearning: 'Commencer →',
    restoreTitle: 'Restaurer la progression',
    restoreDesc: 'Sélectionnez votre fichier (.json) ou collez le contenu ci-dessous :',
    restoreUploadBtn: 'Choisir (.json)',
    restorePlaceholder: 'Collez votre JSON ici...',
    restoreConfirmBtn: 'Restaurer et continuer',
    restoreError: 'Fichier de sauvegarde JSON invalide.',
    restoreSkipBtn: 'Continuer sans sauvegarde',
    b1ReadyTitle: 'Seuil B1 atteint !',
    b1ReadyDesc: 'Vous sentez-vous prêt(e) à passer aux questions B1 ?',
    b1ReadyYes: 'Oui, activer B1',
    b1ReadyNo: 'Non, demain',
    backupNudgeShort: 'Données stockées localement — pensez à sauvegarder.',
    backupNudgeDash: 'Vos progrès sont stockés localement. Téléchargez une sauvegarde pour les protéger.',
    backupBtnNow: '⬇ Sauvegarder',
    backupBtnLater: 'Plus tard',
    backupBtnUpload: '⬆ Restaurer',
    backupSyncedToday: '✓ Dernière sauvegarde : Aujourd’hui',
    backupStatusNever: 'Aucune sauvegarde effectuée',
    backupStatusLastFmt: (d) => `Dernière sauvegarde : ${d}`,
    backupKeyNotice: 'Note : les clés API sont exclues des sauvegardes par sécurité.',
  },
  es: {
    title: 'Bienvenido a LingoEx',
    subtitle: 'Elige cómo quieres empezar:',
    btnFirstTime: 'PRIMERA VEZ QUE LO USO',
    btnFirstTimeSub: 'Configura tu idioma y nivel inicial',
    btnReturning: 'YA LO HE USADO ANTES',
    btnReturningSub: 'Restaura tu copia de seguridad (.json)',
    backBtn: '← Atrás',
    lblNativeLang: 'Tu idioma nativo',
    lblCurrentLevel: 'Nivel actual de inglés',
    lblTargetLevel: 'Nivel objetivo',
    a1CapNotice:
      'Para evitar frustraciones, empezarás con preguntas hasta A2. Al llegar a 1100+ Elo te preguntaremos si estás listo para B1.',
    btnStartLearning: 'Empezar →',
    restoreTitle: 'Restaurar progreso',
    restoreDesc: 'Sube tu archivo (.json) o pega el JSON abajo:',
    restoreUploadBtn: 'Elegir archivo (.json)',
    restorePlaceholder: 'Pega tu JSON aquí...',
    restoreConfirmBtn: 'Restaurar y continuar',
    restoreError: 'Archivo JSON de respaldo no válido.',
    restoreSkipBtn: 'Continuar sin respaldo',
    b1ReadyTitle: '¡Nivel B1 alcanzado!',
    b1ReadyDesc: '¿Te sientes listo para desbloquear preguntas B1?',
    b1ReadyYes: 'Sí, activar B1',
    b1ReadyNo: 'No, preguntar mañana',
    backupNudgeShort: 'Tus datos solo están en este navegador — guarda un respaldo.',
    backupNudgeDash: 'Tu progreso se guarda solo en este navegador. Descarga una copia para no perderlo.',
    backupBtnNow: '⬇ Descargar copia',
    backupBtnLater: 'Más tarde',
    backupBtnUpload: '⬆ Restaurar',
    backupSyncedToday: '✓ Última copia: Hoy',
    backupStatusNever: 'Copia aún no realizada',
    backupStatusLastFmt: (d) => `Última copia: ${d}`,
    backupKeyNotice: 'Nota: las claves API no se incluyen por seguridad.',
  },
};

export function getOnboardingCopy(
  mode?: FeedbackLanguageMode,
  browserLangOverride?: string
): OnboardingCopy {
  const code = resolveSupportedLanguage(mode, browserLangOverride);
  // Show language note safely using resolved UI language (auto falls back to Chrome UI language)
  return ONBOARDING_COPY_MAP[code] ?? ONBOARDING_COPY_MAP.en!;
}
