export type SupportedLanguageCode =
  | 'en'
  | 'tr'
  | 'fr'
  | 'es'
  | 'de'
  | 'ja'
  | 'pt'
  | 'ru'
  | 'it'
  | 'ko'
  | 'zh'
  | 'ar';

export type FeedbackLanguageMode = 'auto' | SupportedLanguageCode;

export interface LanguageOption {
  code: FeedbackLanguageMode;
  label: string;
  aiPromptName: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'auto', label: 'Auto', aiPromptName: 'Auto' },
  { code: 'en', label: 'English', aiPromptName: 'English' },
  { code: 'tr', label: 'Türkçe', aiPromptName: 'Turkish (Türkçe)' },
  { code: 'fr', label: 'Français', aiPromptName: 'French (Français)' },
  { code: 'es', label: 'Español', aiPromptName: 'Spanish (Español)' },
  { code: 'de', label: 'Deutsch', aiPromptName: 'German (Deutsch)' },
  { code: 'ja', label: '日本語', aiPromptName: 'Japanese (日本語)' },
  { code: 'pt', label: 'Português', aiPromptName: 'Portuguese (Português)' },
  { code: 'ru', label: 'Русский', aiPromptName: 'Russian (Русский)' },
  { code: 'it', label: 'Italiano', aiPromptName: 'Italian (Italiano)' },
  { code: 'ko', label: '한국어', aiPromptName: 'Korean (한국어)' },
  { code: 'zh', label: '中文', aiPromptName: 'Simplified Chinese (简体中文)' },
  { code: 'ar', label: 'العربية', aiPromptName: 'Arabic (العربية)' },
];

const SUPPORTED_CODES = new Set<SupportedLanguageCode>([
  'en',
  'tr',
  'fr',
  'es',
  'de',
  'ja',
  'pt',
  'ru',
  'it',
  'ko',
  'zh',
  'ar',
]);

/**
 * Resolve `'auto'` or any language code into one of the 12 supported language codes.
 */
export function resolveSupportedLanguage(
  mode: FeedbackLanguageMode | undefined,
  browserLangOverride?: string
): SupportedLanguageCode {
  if (mode && mode !== 'auto' && SUPPORTED_CODES.has(mode)) {
    return mode;
  }

  const raw =
    browserLangOverride ??
    (typeof chrome !== 'undefined' && typeof chrome.i18n?.getUILanguage === 'function'
      ? chrome.i18n.getUILanguage()
      : typeof navigator !== 'undefined'
        ? navigator.language
        : 'en');

  const prefix = raw.toLowerCase().split(/[-_]/)[0] as SupportedLanguageCode;
  if (SUPPORTED_CODES.has(prefix)) {
    return prefix;
  }
  return 'en';
}

export function getAiLanguagePromptName(
  mode: FeedbackLanguageMode | undefined,
  browserLangOverride?: string
): string {
  const code = resolveSupportedLanguage(mode, browserLangOverride);
  const found = LANGUAGE_OPTIONS.find((o) => o.code === code);
  return found?.aiPromptName ?? 'English';
}

export interface UiStrings {
  askNowBtn: string;
  pageQuizBtn: string;
  listeningQuizBtn: string;
  muteHourBtn: string;
  unmuteBtn: string;
  settingsAiBtn: string;
  correctToday: string;
  missedToday: string;
  retryQueue: string;
  mastered: string;
  checkAnswer: string;
  dontKnow: string;
  nextQuestion: string;
  closeBtn: string;
  listeningTitle: string;
  listeningPrompt: string;
  listeningPlaceholder: string;
  playNormal: string;
  playSlow: string;
  nextListening: string;
}

const UI_STRINGS: Record<SupportedLanguageCode, UiStrings> = {
  en: {
    askNowBtn: 'Quick Quiz',
    pageQuizBtn: 'Challenge',
    listeningQuizBtn: 'Listen & Type',
    muteHourBtn: 'Mute 1h',
    unmuteBtn: 'Unmute',
    settingsAiBtn: 'Settings',
    correctToday: 'Correct',
    missedToday: 'Missed',
    retryQueue: 'Queue',
    mastered: 'Mastered',
    checkAnswer: 'Check',
    dontKnow: 'Skip',
    nextQuestion: 'Next →',
    closeBtn: 'Close',
    listeningTitle: 'Listen & Type',
    listeningPrompt: 'Listen and type what you hear in English:',
    listeningPlaceholder: 'Type what you heard in English...',
    playNormal: 'Play 0.85x',
    playSlow: 'Slow 0.50x',
    nextListening: 'Next →',
  },
  tr: {
    askNowBtn: 'Şimdi Sor',
    pageQuizBtn: 'Challenge',
    listeningQuizBtn: 'Dinle & Yaz',
    muteHourBtn: '1s Sustur',
    unmuteBtn: 'Sesi Aç',
    settingsAiBtn: 'Ayarlar',
    correctToday: 'Doğru',
    missedToday: 'Yanlış',
    retryQueue: 'Kuyruk',
    mastered: 'Öğrenilen',
    checkAnswer: 'Kontrol Et',
    dontKnow: 'Bilmiyorum',
    nextQuestion: 'Sonraki →',
    closeBtn: 'Kapat',
    listeningTitle: 'Dinle & Yaz',
    listeningPrompt: 'Sesli cümleyi dinle ve duyduğun İngilizceyi yaz:',
    listeningPlaceholder: 'Duyduğun İngilizce cümleyi yaz...',
    playNormal: 'Dinle 0.85x',
    playSlow: 'Yavaş 0.50x',
    nextListening: 'Sonraki →',
  },
  fr: {
    askNowBtn: 'Quiz rapide',
    pageQuizBtn: 'Challenge',
    listeningQuizBtn: 'Écoute & Texte',
    muteHourBtn: 'Muet 1h',
    unmuteBtn: 'Réactiver',
    settingsAiBtn: 'Paramètres',
    correctToday: 'Corrects',
    missedToday: 'Manqués',
    retryQueue: 'Attente',
    mastered: 'Maîtrisés',
    checkAnswer: 'Vérifier',
    dontKnow: 'Passer',
    nextQuestion: 'Suivant →',
    closeBtn: 'Fermer',
    listeningTitle: 'Écoute & Texte',
    listeningPrompt: 'Écoutez et tapez la phrase anglaise entendue :',
    listeningPlaceholder: 'Tapez la phrase anglaise entendue...',
    playNormal: 'Écouter 0.85x',
    playSlow: 'Lent 0.50x',
    nextListening: 'Suivant →',
  },
  es: {
    askNowBtn: 'Quiz rápido',
    pageQuizBtn: 'Challenge',
    listeningQuizBtn: 'Escucha y Escribe',
    muteHourBtn: 'Silenciar 1h',
    unmuteBtn: 'Activar',
    settingsAiBtn: 'Ajustes',
    correctToday: 'Aciertos',
    missedToday: 'Fallos',
    retryQueue: 'Cola',
    mastered: 'Dominadas',
    checkAnswer: 'Comprobar',
    dontKnow: 'Saltar',
    nextQuestion: 'Siguiente →',
    closeBtn: 'Cerrar',
    listeningTitle: 'Escucha y Escribe',
    listeningPrompt: 'Escucha y escribe la oración en inglés:',
    listeningPlaceholder: 'Escribe la oración en inglés...',
    playNormal: 'Escuchar 0.85x',
    playSlow: 'Lento 0.50x',
    nextListening: 'Siguiente →',
  },
  de: {
    askNowBtn: 'Schnelltest',
    pageQuizBtn: 'Challenge',
    listeningQuizBtn: 'Hören & Tippen',
    muteHourBtn: '1h stumm',
    unmuteBtn: 'Aktivieren',
    settingsAiBtn: 'Einstellungen',
    correctToday: 'Richtig',
    missedToday: 'Falsch',
    retryQueue: 'Wartend',
    mastered: 'Gelernt',
    checkAnswer: 'Prüfen',
    dontKnow: 'Überspringen',
    nextQuestion: 'Weiter →',
    closeBtn: 'Schließen',
    listeningTitle: 'Hören & Tippen',
    listeningPrompt: 'Höre zu und tippe den gehörten englischen Satz ein:',
    listeningPlaceholder: 'Gehörten englischen Satz eingeben...',
    playNormal: 'Hören 0.85x',
    playSlow: 'Langsam 0.50x',
    nextListening: 'Weiter →',
  },
  ja: {
    askNowBtn: '今すぐテスト',
    pageQuizBtn: 'Challenge',
    listeningQuizBtn: 'リスニング',
    muteHourBtn: '1時間停止',
    unmuteBtn: '再開',
    settingsAiBtn: '設定',
    correctToday: '正解',
    missedToday: '不正解',
    retryQueue: '復習待ち',
    mastered: '習得済',
    checkAnswer: '確認',
    dontKnow: 'スキップ',
    nextQuestion: '次へ →',
    closeBtn: '閉じる',
    listeningTitle: 'リスニング',
    listeningPrompt: '音声を聞いて英文を入力してください：',
    listeningPlaceholder: '聞こえた英文を入力...',
    playNormal: '再生 0.85x',
    playSlow: '低速 0.50x',
    nextListening: '次へ →',
  },
  pt: {
    askNowBtn: 'Quiz rápido',
    pageQuizBtn: 'Challenge',
    listeningQuizBtn: 'Ouvir e Digitar',
    muteHourBtn: 'Silenciar 1h',
    unmuteBtn: 'Reativar',
    settingsAiBtn: 'Configurações',
    correctToday: 'Certas',
    missedToday: 'Erradas',
    retryQueue: 'Fila',
    mastered: 'Dominadas',
    checkAnswer: 'Verificar',
    dontKnow: 'Pular',
    nextQuestion: 'Próxima →',
    closeBtn: 'Fechar',
    listeningTitle: 'Ouvir e Digitar',
    listeningPrompt: 'Ouça e digite a frase em inglês:',
    listeningPlaceholder: 'Digite a frase em inglês...',
    playNormal: 'Ouvir 0.85x',
    playSlow: 'Lento 0.50x',
    nextListening: 'Próximo →',
  },
  ru: {
    askNowBtn: 'Быстрый тест',
    pageQuizBtn: 'Challenge',
    listeningQuizBtn: 'Слух и ввод',
    muteHourBtn: 'Пауза 1ч',
    unmuteBtn: 'Включить',
    settingsAiBtn: 'Настройки',
    correctToday: 'Верно',
    missedToday: 'Ошибки',
    retryQueue: 'Очередь',
    mastered: 'Изучено',
    checkAnswer: 'Проверить',
    dontKnow: 'Пропустить',
    nextQuestion: 'Далее →',
    closeBtn: 'Закрыть',
    listeningTitle: 'Слух и ввод',
    listeningPrompt: 'Прослушайте и введите английское предложение:',
    listeningPlaceholder: 'Введите услышанное предложение...',
    playNormal: 'Слушать 0.85x',
    playSlow: 'Медленно 0.50x',
    nextListening: 'Далее →',
  },
  it: {
    askNowBtn: 'Quiz rapido',
    pageQuizBtn: 'Challenge',
    listeningQuizBtn: 'Ascolta e Scrivi',
    muteHourBtn: 'Muto 1h',
    unmuteBtn: 'Riattiva',
    settingsAiBtn: 'Impostazioni',
    correctToday: 'Corrette',
    missedToday: 'Errate',
    retryQueue: 'In coda',
    mastered: 'Apprese',
    checkAnswer: 'Verifica',
    dontKnow: 'Salta',
    nextQuestion: 'Avanti →',
    closeBtn: 'Chiudi',
    listeningTitle: 'Ascolta e Scrivi',
    listeningPrompt: 'Ascolta e scrivi la frase inglese:',
    listeningPlaceholder: 'Scrivi la frase inglese...',
    playNormal: 'Ascolta 0.85x',
    playSlow: 'Lento 0.50x',
    nextListening: 'Avanti →',
  },
  ko: {
    askNowBtn: '빠른 퀴즈',
    pageQuizBtn: 'Challenge',
    listeningQuizBtn: '듣고 쓰기',
    muteHourBtn: '1시간 무음',
    unmuteBtn: '무음 해제',
    settingsAiBtn: '설정',
    correctToday: '정답',
    missedToday: '오답',
    retryQueue: '대기열',
    mastered: '마스터',
    checkAnswer: '확인',
    dontKnow: '건너뛰기',
    nextQuestion: '다음 →',
    closeBtn: '닫기',
    listeningTitle: '듣고 쓰기',
    listeningPrompt: '음성을 듣고 들리는 영어 문장을 입력하세요:',
    listeningPlaceholder: '들린 영어 문장을 입력하세요...',
    playNormal: '재생 0.85x',
    playSlow: '느리게 0.50x',
    nextListening: '다음 →',
  },
  zh: {
    askNowBtn: '快速测验',
    pageQuizBtn: 'Challenge',
    listeningQuizBtn: '听音拼写',
    muteHourBtn: '静音1小时',
    unmuteBtn: '取消静音',
    settingsAiBtn: '设置',
    correctToday: '正确',
    missedToday: '错误',
    retryQueue: '待复习',
    mastered: '已掌握',
    checkAnswer: '检查',
    dontKnow: '跳过',
    nextQuestion: '下一题 →',
    closeBtn: '关闭',
    listeningTitle: '听音拼写',
    listeningPrompt: '请听录音并输入完整英文句子：',
    listeningPlaceholder: '输入你听到的英文句子...',
    playNormal: '播放 0.85x',
    playSlow: '慢速 0.50x',
    nextListening: '下一题 →',
  },
  ar: {
    askNowBtn: 'اختبار سريع',
    pageQuizBtn: 'Challenge',
    listeningQuizBtn: 'استماع وكتابة',
    muteHourBtn: 'كتم ساعة',
    unmuteBtn: 'إلغاء الكتم',
    settingsAiBtn: 'الإعدادات',
    correctToday: 'صحيحة',
    missedToday: 'خاطئة',
    retryQueue: 'المراجعة',
    mastered: 'متقنة',
    checkAnswer: 'تحقق',
    dontKnow: 'تخطي',
    nextQuestion: 'التالي ←',
    closeBtn: 'إغلاق',
    listeningTitle: 'استماع وكتابة',
    listeningPrompt: 'استمع واكتب الجملة الإنجليزية:',
    listeningPlaceholder: 'اكتب الجملة الإنجليزية...',
    playNormal: 'استماع 0.85x',
    playSlow: 'بطيء 0.50x',
    nextListening: 'التالي ←',
  },
};

export function getUiStrings(
  mode: FeedbackLanguageMode | undefined,
  browserLangOverride?: string
): UiStrings {
  const code = resolveSupportedLanguage(mode, browserLangOverride);
  return UI_STRINGS[code] ?? UI_STRINGS.en;
}
