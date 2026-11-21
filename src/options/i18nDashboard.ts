import { resolveSupportedLanguage, type SupportedLanguageCode } from '../shared/i18n';
import type { FeedbackLanguageMode } from '../shared/types';

export interface DashboardStrings {
  pageTitle: string;
  brandTitle: string;
  askNow: string;
  resetProgress: string;
  resetConfirm: string;

  tabRoadmap: string;
  tabSettings: string;
  tabAnalytics: string;
  tabAi: string;
  tabCards: string;

  // Settings tab
  lblInterval: string;
  hintInterval: string;
  lblRetryDelay: string;
  hintRetryDelay: string;
  lblContentMode: string;
  optMixed: string;
  optWords: string;
  optSentences: string;
  lblCefrLevels: string;
  lblQuietHours: string;
  lblQuietStart: string;
  lblQuietEnd: string;
  phQuietStart: string;
  phQuietEnd: string;
  lblBlockedDomains: string;
  phBlockedDomains: string;
  hintBlockedDomains: string;
  togEnabled: string;
  togAdaptive: string;
  togIncludeUser: string;
  togSkipFullscreen: string;
  togAutoSpeak: string;
  togAutoTranslate: string;
  btnSaveSettings: string;
  msgSaved: string;

  // Analytics tab
  metricLevel: string;
  metricAccuracy: string;
  metricSpeed: string;
  chartTitle: string;
  levelsTitle: string;
  posTitle: string;
  topicsTitle: string;
  hardWordsTitle: string;
  coachTitle: string;
  coachDesc: string;
  btnCoach: string;
  coachLoading: string;
  focusTitle: string;
  focusDesc: string;
  noDataYet: string;
  noAttemptsYet: string;
  chartMinPoints: string;
  topicNeedMore: string;
  noHardWords: string;
  noFocusPoints: string;
  strongestPrefix: string;
  needsFocusPrefix: string;
  currentStreak: string;
  bestStreak: string;
  correctLabel: string;
  missesLabel: string;
  masteredLabel: string;
  towardLabel: string;
  answeredLabel: string;
  btnRemove: string;
  exampleLabel: string;

  // AI tab
  aiEnableLabel: string;
  aiAlwaysLabel: string;
  aiLangLabel: string;
  aiPrimaryTitle: string;
  aiPrimaryBadge: string;
  aiPresetLabel: string;
  aiApiKeyLabel: string;
  aiKeyPlaceholder: string;
  btnShow: string;
  btnHide: string;
  aiQuickModelLabel: string;
  aiModelIdLabel: string;
  btnFetchModels: string;
  btnFetch: string;
  aiBaseUrlLabel: string;
  btnSaveAi: string;
  btnTestPrimary: string;
  aiBackupSummary: string;
  ai2Enable: string;
  aiSwapBtn: string;
  ai2BaseUrl: string;
  ai2Key: string;
  ai2KeyPh: string;
  ai2Preset: string;
  ai2ModelId: string;
  ai2Test: string;
  ai3Enable: string;
  ai3BaseUrl: string;
  ai3Key: string;
  ai3KeyPh: string;
  ai3Preset: string;
  ai3ModelId: string;
  ai3Test: string;
  btnSaveAllAi: string;
  aiPromptSummary: string;
  aiPromptLabel: string;
  btnResetPrompt: string;
  btnSavePrompt: string;
  msgAiSaved: string;
  msgFetchingModels: string;
  msgTesting: string;
  aiFreeGuideTitle: string;
  aiFreeGuideSub: string;
  tagGroq: string;
  tagNvidia: string;
  tagAmd: string;
  descGroq: string;
  descNvidia: string;
  descAmd: string;
  noApiTitle: string;
  noApiDesc: string;
  noApiBtn: string;

  // Custom cards & import inside Settings
  settingsCardsHeading: string;
  addTitle: string;
  lblNewEn: string;
  phNewEn: string;
  lblNewTr: string;
  phNewTr: string;
  lblNewType: string;
  optWord: string;
  optSentence: string;
  lblNewLevel: string;
  lblExEn: string;
  lblExTr: string;
  btnAddCard: string;
  msgAdded: string;
  bulkTitle: string;
  bulkDesc: string;
  btnChooseFile: string;
  noFileSelected: string;
  btnImport: string;
  btnExportTsv: string;
  btnExportJson: string;

  // Cards tab
  phSearch: string;
  fltAll: string;
  fltRetry: string;
  fltHard: string;
  fltUser: string;
  fltWord: string;
  fltSentence: string;
  fltAllLevels: string;
  thLevelType: string;
  thEnglish: string;
  thTurkish: string;
  thStatus: string;
  thAction: string;
  btnPrev: string;
  btnNext: string;
  badgeCustom: string;
  statusNew: string;
  statusRetry: string;
  statusStreak: string;
  showingCards: string;

  // Summary bar
  sumLevel: string;
  sumPath: string;
  sumCards: string;
  sumRetry: string;
  sumMastered: string;
  sumToday: string;
}

const EN_DASHBOARD: DashboardStrings = {
  pageTitle: 'LingoEx · Dashboard',
  brandTitle: 'LingoEx',
  askNow: 'Quick Quiz',
  resetProgress: 'Reset Data',
  resetConfirm: 'Reset all learning history, ratings, focus notes, and retry queue?',

  tabRoadmap: 'Learning Path',
  tabSettings: 'Settings',
  tabAnalytics: 'My Progress',
  tabAi: 'AI - API Keys',
  tabCards: 'My Words',

  lblInterval: 'Quiz Interval (minutes)',
  hintInterval: 'Default: 20 minutes',
  lblRetryDelay: 'Retry Mistakes After (min)',
  hintRetryDelay: 'Wait time before missed words return (default: 20 min)',
  lblContentMode: 'Question Mix',
  optMixed: 'Mixed (Words + Sentences)',
  optWords: 'Words Only',
  optSentences: 'Sentences Only',
  lblCefrLevels: 'Difficulty Levels',
  lblQuietHours: 'Quiet Hours (0–23, leave blank = off)',
  lblQuietStart: 'From',
  lblQuietEnd: 'To',
  phQuietStart: '23',
  phQuietEnd: '08',
  lblBlockedDomains: 'Paused Websites',
  phBlockedDomains: 'One domain per line:\nexample.com\n*.exam-portal.edu',
  hintBlockedDomains: 'Never interrupts on these domains. You can also toggle a site from the popup.',
  togEnabled: 'Auto-ask questions on timer',
  togAdaptive: 'Adaptive difficulty (focus on weak areas & Elo)',
  togIncludeUser: 'Include my custom & imported cards',
  togSkipFullscreen: 'Pause while watching fullscreen videos',
  togAutoSpeak: 'Auto-pronounce English prompt when opened',
  togAutoTranslate: 'Suggest translations on right-click selection',
  btnSaveSettings: 'Save Changes',
  msgSaved: 'Saved ✓',

  metricLevel: 'My Level (Elo)',
  metricAccuracy: 'Accuracy',
  metricSpeed: 'Avg. Speed',
  chartTitle: 'Progress Curve',
  levelsTitle: 'Level Breakdown',
  posTitle: 'Word Types',
  topicsTitle: 'Topics',
  hardWordsTitle: 'Tricky Words',
  coachTitle: 'AI Study Coach',
  coachDesc: 'Analyzes your Elo, CEFR bands, topics, and mistakes to recommend 4 study priorities.',
  btnCoach: 'Get Study Tips',
  coachLoading: 'Analyzing your learning stats...',
  focusTitle: 'Grammar & Focus Tracker',
  focusDesc: 'Pinned words and grammar rules reappear across varied sentences (+2 → +4 → +10).',
  noDataYet: 'No cards answered yet.',
  noAttemptsYet: 'No attempts yet',
  chartMinPoints: 'Answer at least 2 cards to plot your rating curve.',
  topicNeedMore: 'Answer at least 2 cards per topic to identify strengths and weak areas.',
  noHardWords: 'No missed cards recorded yet.',
  noFocusPoints: 'No focus points tracked yet.',
  strongestPrefix: 'Strongest',
  needsFocusPrefix: 'Needs focus',
  currentStreak: 'Streak',
  bestStreak: 'Best',
  correctLabel: 'correct',
  missesLabel: 'misses',
  masteredLabel: 'mastered',
  towardLabel: 'toward',
  answeredLabel: 'correct',
  btnRemove: 'Remove',
  exampleLabel: 'Example',

  aiEnableLabel: 'Enable AI Semantic Grading & Context-Menu Translation',
  aiAlwaysLabel: 'Evaluate every answer with AI (off = only call AI when local matcher rejects)',
  aiLangLabel: 'Interface & AI Explanation Language',
  aiPrimaryTitle: 'Primary API',
  aiPrimaryBadge: 'Primary',
  aiPresetLabel: 'Provider',
  aiApiKeyLabel: 'API Key (Stored Locally Only)',
  aiKeyPlaceholder: 'Paste your API key',
  btnShow: 'Show',
  btnHide: 'Hide',
  aiQuickModelLabel: 'Quick Model',
  aiModelIdLabel: 'Model ID',
  btnFetchModels: 'Fetch Models',
  btnFetch: 'Fetch',
  aiBaseUrlLabel: 'Primary API Base URL',
  btnSaveAi: 'Save',
  btnTestPrimary: 'Test Connection',
  aiBackupSummary: 'Backup APIs (Optional)',
  ai2Enable: 'Backup API 1',
  aiSwapBtn: 'Set Groq Primary',
  ai2BaseUrl: 'Backup API 1 Base URL',
  ai2Key: 'Backup API 1 Key',
  ai2KeyPh: 'Optional backup API key',
  ai2Preset: 'Quick Model',
  ai2ModelId: 'Model ID',
  ai2Test: 'Test',
  ai3Enable: 'Backup API 2',
  ai3BaseUrl: 'Backup API 2 Base URL',
  ai3Key: 'Backup API 2 Key',
  ai3KeyPh: 'Optional 2nd backup API key',
  ai3Preset: 'Quick Model',
  ai3ModelId: 'Model ID',
  ai3Test: 'Test',
  btnSaveAllAi: 'Save Settings',
  aiPromptSummary: 'Advanced (Custom Base URL & System Prompt)',
  aiPromptLabel: 'Custom Grading System Prompt',
  btnResetPrompt: 'Restore Default',
  btnSavePrompt: 'Save',
  msgAiSaved: 'AI settings saved ✓',
  msgFetchingModels: 'Fetching models...',
  msgTesting: 'Testing connection...',
  aiFreeGuideTitle: 'Recommended Free AI Services',
  aiFreeGuideSub: 'Click any provider to inspect top supported models and select with one click',
  tagGroq: '⭐ Recommended (Ultra-Fast & Smart)',
  tagNvidia: '🧠 Slower but Smarter',
  tagAmd: '⚖️ Slower / Solid Backup',
  descGroq: 'Tested as the best overall free API: both very fast and accurate (console.groq.com).',
  descNvidia: 'Larger reasoning models with slower response times than Groq (build.nvidia.com).',
  descAmd: 'Free developer credits hosting top open-weight models; great backup (tokenlab.amd.com).',
  noApiTitle: 'No AI API key added yet',
  noApiDesc: 'Get a free Groq API key in 1 minute to unlock Challenge mode and smart AI explanations.',
  noApiBtn: 'Get Free API & Setup →',

  settingsCardsHeading: 'Custom Cards & Import / Export',
  addTitle: 'Add Word or Sentence',
  lblNewEn: 'English Word or Sentence',
  phNewEn: 'e.g. resilient or Take it easy.',
  lblNewTr: 'Meanings (comma or ; separated)',
  phNewTr: 'e.g. dayanıklı, dirençli, esnek',
  lblNewType: 'Type',
  optWord: 'Word',
  optSentence: 'Sentence',
  lblNewLevel: 'Level',
  lblExEn: 'Example Sentence (optional)',
  lblExTr: 'Example Translation (optional)',
  btnAddCard: 'Add Word',
  msgAdded: 'Added ✓',
  bulkTitle: 'Import / Export Cards',
  bulkDesc: 'Paste TSV (word[TAB]meaning1 | meaning2), CSV, or JSON — or pick a file.',
  btnChooseFile: '📁 Choose File',
  noFileSelected: 'No file selected',
  btnImport: 'Import',
  btnExportTsv: 'Export TSV',
  btnExportJson: 'Export JSON',

  phSearch: 'Search words or meanings...',
  fltAll: 'All Words',
  fltRetry: 'Retry Queue',
  fltHard: 'Tricky Words',
  fltUser: 'My Custom Words',
  fltWord: 'Words Only',
  fltSentence: 'Sentences Only',
  fltAllLevels: 'All Levels',
  thLevelType: 'Level / Type',
  thEnglish: 'English',
  thTurkish: 'Meanings',
  thStatus: 'Status',
  thAction: 'Action',
  btnPrev: '← Previous',
  btnNext: 'Next →',
  badgeCustom: 'Custom',
  statusNew: 'New',
  statusRetry: 'Retry',
  statusStreak: 'Streak',
  showingCards: 'cards',

  sumLevel: 'Level',
  sumPath: 'Path',
  sumCards: 'cards',
  sumRetry: 'in queue',
  sumMastered: 'mastered',
  sumToday: 'Today',
};

const TR_DASHBOARD: DashboardStrings = {
  pageTitle: 'LingoEx · Panel',
  brandTitle: 'LingoEx',
  askNow: 'Hızlı Soru',
  resetProgress: 'Sıfırla',
  resetConfirm: 'Tüm öğrenme geçmişi, Elo puanı, odak notları ve tekrar kuyruğu sıfırlansın mı?',

  tabRoadmap: 'Öğrenme Yolu',
  tabSettings: 'Ayarlar',
  tabAnalytics: 'Gelişimim',
  tabAi: 'AI - API Ayarları',
  tabCards: 'Kelimelerim',

  lblInterval: 'Soru Sıklığı (dakika)',
  hintInterval: 'Varsayılan: 20 dakika',
  lblRetryDelay: 'Yanlışları Tekrarla (dakika)',
  hintRetryDelay: 'Yanlış kartların tekrar sorulma süresi (varsayılan: 20 dk)',
  lblContentMode: 'Soru Türü',
  optMixed: 'Karışık (Kelime + Cümle)',
  optWords: 'Sadece Kelimeler',
  optSentences: 'Sadece Cümleler',
  lblCefrLevels: 'Aktif Seviyeler',
  lblQuietHours: 'Sessiz Saatler (0–23 saat aralığı, boş = kapalı)',
  lblQuietStart: 'Başlangıç',
  lblQuietEnd: 'Bitiş',
  phQuietStart: '23',
  phQuietEnd: '08',
  lblBlockedDomains: 'Hariç Tutulan Siteler',
  phBlockedDomains: 'Her satıra bir alan adı:\nexample.com\n*.sinav-portali.edu',
  hintBlockedDomains: 'Bu sitelerde soru penceresi açılmaz. Aktif siteyi eklenti açılır menüsünden de kapatabilirsin.',
  togEnabled: 'Zamanlayıcıyla otomatik soru sor',
  togAdaptive: 'Uyarlanabilir zorluk (zayıf olduğun yerlere ve Elo puanına odaklan)',
  togIncludeUser: 'Kendi eklediğim kartları da sor',
  togSkipFullscreen: 'Tam ekran video izlerken soruları ertele',
  togAutoSpeak: 'Kart açıldığında İngilizce ifadeyi seslendir',
  togAutoTranslate: 'Sağ tıkla kelime eklerken anlam önerisi getir',
  btnSaveSettings: 'Değişiklikleri Kaydet',
  msgSaved: 'Kaydedildi ✓',

  metricLevel: 'Seviyem (Elo)',
  metricAccuracy: 'Doğruluk Oranı',
  metricSpeed: 'Ort. Yanıt Süresi',
  chartTitle: 'Puan Gelişim Eğrisi',
  levelsTitle: 'Seviye Dağılımı',
  posTitle: 'Kelime Türleri',
  topicsTitle: 'Konu Alanları',
  hardWordsTitle: 'En Çok Zorlanılanlar',
  coachTitle: 'AI Çalışma Koçu',
  coachDesc: 'Elo puanını, seviyelerini ve hatalarını inceleyip 4 odak önerisi çıkarır.',
  btnCoach: 'Çalışma Önerisi Al',
  coachLoading: 'Öğrenme verilerin inceleniyor...',
  focusTitle: 'Odak & Gramer Takibi',
  focusDesc: 'Takıldığın kelimeler ve gramer kuralları farklı cümlelerde (+2 → +4 → +10 soru sonra) tekrar çıkar.',
  noDataYet: 'Henüz yanıtlanan kart yok.',
  noAttemptsYet: 'Henüz deneme yok',
  chartMinPoints: 'Eğriyi görmek için en az 2 kart yanıtla.',
  topicNeedMore: 'Güçlü ve zayıf yönleri görmek için konu başına en az 2 kart yanıtla.',
  noHardWords: 'Henüz yanlış yapılan kart yok.',
  noFocusPoints: 'Henüz odak noktası kaydedilmedi.',
  strongestPrefix: 'En güçlü',
  needsFocusPrefix: 'Odaklanılmalı',
  currentStreak: 'Seri',
  bestStreak: 'En iyi',
  correctLabel: 'doğru',
  missesLabel: 'yanlış',
  masteredLabel: 'öğrenilen',
  towardLabel: 'hedef',
  answeredLabel: 'doğru',
  btnRemove: 'Kaldır',
  exampleLabel: 'Örnek',

  aiEnableLabel: 'AI Anlamsal Değerlendirmeyi ve Sağ Tık Çevirisini Etkinleştir',
  aiAlwaysLabel: 'Her cevabı AI ile değerlendir (kapalı = sadece yerel eşleştirici reddettiğinde AI kullan)',
  aiLangLabel: 'Arayüz ve AI Açıklama Dili',
  aiPrimaryTitle: 'ANA API',
  aiPrimaryBadge: 'Birincil',
  aiPresetLabel: 'Sağlayıcı',
  aiApiKeyLabel: 'API Anahtarı (Yalnızca Tarayıcıda Saklanır)',
  aiKeyPlaceholder: 'API anahtarınızı yapıştırın',
  btnShow: 'Göster',
  btnHide: 'Gizle',
  aiQuickModelLabel: 'Hızlı Model',
  aiModelIdLabel: 'Model ID',
  btnFetchModels: 'Modelleri Getir',
  btnFetch: 'Getir',
  aiBaseUrlLabel: 'Ana API Base URL',
  btnSaveAi: 'Kaydet',
  btnTestPrimary: 'Bağlantıyı Test Et',
  aiBackupSummary: "Yedek API'ler (Opsiyonel)",
  ai2Enable: 'Yedek API 1',
  aiSwapBtn: 'Groq Ayarla',
  ai2BaseUrl: 'Yedek API 1 Base URL',
  ai2Key: 'Yedek API 1 Anahtarı',
  ai2KeyPh: 'İsteğe bağlı yedek API anahtarı',
  ai2Preset: 'Hızlı Model',
  ai2ModelId: 'Model ID',
  ai2Test: 'Test Et',
  ai3Enable: 'Yedek API 2',
  ai3BaseUrl: 'Yedek API 2 Base URL',
  ai3Key: 'Yedek API 2 Anahtarı',
  ai3KeyPh: 'İsteğe bağlı 2. yedek API anahtarı',
  ai3Preset: 'Hızlı Model',
  ai3ModelId: 'Model ID',
  ai3Test: 'Test Et',
  btnSaveAllAi: 'Ayarları Kaydet',
  aiPromptSummary: 'Gelişmiş (Özel Base URL & Sistem Komutu)',
  aiPromptLabel: 'Özel Değerlendirme Sistem Komutu',
  btnResetPrompt: 'Varsayılana Sıfırla',
  btnSavePrompt: 'Kaydet',
  msgAiSaved: 'AI ayarları kaydedildi ✓',
  msgFetchingModels: 'Modeller getiriliyor...',
  msgTesting: 'Bağlantı test ediliyor...',
  aiFreeGuideTitle: 'Tavsiye Edilen Ücretsiz AI Servisleri',
  aiFreeGuideSub: 'Üzerine tıkla → desteklediği en iyi modelleri gör ve tek tıkla seç',
  tagGroq: '⭐ Önerilen (Çok Hızlı & Zeki)',
  tagNvidia: '🧠 Yavaş ama Daha Akıllı',
  tagAmd: '⚖️ Yavaş / İyi Yedek',
  descGroq: 'Testlerde hem hız hem zekâ olarak en iyi sonucu veren ücretsiz servis (console.groq.com).',
  descNvidia: 'Büyük modellerde derin dil analizi sunar ama yanıt süresi Groq’a göre yavaştır (build.nvidia.com).',
  descAmd: 'Ücretsiz geliştirici kredisiyle güçlü modeller sunar; yedek API için uygundur (tokenlab.amd.com).',
  noApiTitle: 'Henüz AI API anahtarı eklenmedi',
  noApiDesc: 'Challenge modu ve akıllı AI değerlendirmesi için 1 dakikada ücretsiz anahtar alıp ekleyebilirsin.',
  noApiBtn: 'Ücretsiz API Al & Kur →',

  settingsCardsHeading: 'Özel Kartlar & İçe / Dışa Aktar',
  addTitle: 'Yeni Kelime / Cümle Ekle',
  lblNewEn: 'İngilizce Kelime veya Cümle',
  phNewEn: 'örn. resilient veya Take it easy.',
  lblNewTr: 'Kabul Edilen Anlamlar (virgül veya ; ile ayır)',
  phNewTr: 'örn. dayanıklı, dirençli, esnek',
  lblNewType: 'Tür',
  optWord: 'Kelime',
  optSentence: 'Cümle',
  lblNewLevel: 'Seviye',
  lblExEn: 'Örnek Cümle (isteğe bağlı)',
  lblExTr: 'Örnek Çeviri (isteğe bağlı)',
  btnAddCard: 'Kartı Ekle',
  msgAdded: 'Eklendi ✓',
  bulkTitle: 'Toplu İçe / Dışa Aktar',
  bulkDesc: 'TSV (ingilizce[TAB]anlam1 | anlam2), CSV veya JSON yapıştır ya da dosya yükle.',
  btnChooseFile: '📁 Dosya Seç',
  noFileSelected: 'Dosya seçilmedi',
  btnImport: 'İçe Aktar',
  btnExportTsv: 'TSV İndir',
  btnExportJson: 'JSON İndir',

  phSearch: 'İngilizce veya Türkçe ara...',
  fltAll: 'Tüm Kelimeler',
  fltRetry: 'Tekrar Kuyruğu',
  fltHard: 'Zor Kartlar',
  fltUser: 'Özel Kartlarım',
  fltWord: 'Sadece Kelimeler',
  fltSentence: 'Sadece Cümleler',
  fltAllLevels: 'Tüm Seviyeler',
  thLevelType: 'Seviye / Tür',
  thEnglish: 'İngilizce',
  thTurkish: 'Anlamlar',
  thStatus: 'Durum',
  thAction: 'İşlem',
  btnPrev: '← Önceki',
  btnNext: 'Sonraki →',
  badgeCustom: 'Özel',
  statusNew: 'Yeni',
  statusRetry: 'Tekrar',
  statusStreak: 'Seri',
  showingCards: 'kart',

  sumLevel: 'Seviye',
  sumPath: 'Yol',
  sumCards: 'kart',
  sumRetry: 'kuyrukta',
  sumMastered: 'öğrenilen',
  sumToday: 'Bugün',
};

const DASHBOARD_OVERRIDES: Partial<Record<SupportedLanguageCode, Partial<DashboardStrings>>> = {
  tr: TR_DASHBOARD,
  fr: {
    askNow: 'Quiz rapide',
    resetProgress: 'Réinitialiser',
    tabRoadmap: "Parcours d'apprentissage",
    tabSettings: 'Paramètres',
    tabAnalytics: 'Ma progression',
    tabAi: 'IA - Clés API',
    tabCards: 'Mes mots',
    btnSaveSettings: 'Enregistrer',
    btnSaveAi: 'Enregistrer IA',
    btnTestPrimary: 'Tester',
    aiLangLabel: "Langue de l'interface et de l'IA",
    msgSaved: 'Enregistré ✓',
  },
  es: {
    askNow: 'Quiz rápido',
    resetProgress: 'Reiniciar',
    tabRoadmap: 'Ruta de aprendizaje',
    tabSettings: 'Ajustes',
    tabAnalytics: 'Mi progreso',
    tabAi: 'IA - Claves API',
    tabCards: 'Mis palabras',
    btnSaveSettings: 'Guardar',
    btnSaveAi: 'Guardar IA',
    btnTestPrimary: 'Probar conexión',
    aiLangLabel: 'Idioma de interfaz e IA',
    msgSaved: 'Guardado ✓',
  },
  de: {
    askNow: 'Schnelltest',
    resetProgress: 'Zurücksetzen',
    tabRoadmap: 'Lernpfad',
    tabSettings: 'Einstellungen',
    tabAnalytics: 'Mein Fortschritt',
    tabAi: 'KI - API-Schlüssel',
    tabCards: 'Meine Wörter',
    btnSaveSettings: 'Speichern',
    btnSaveAi: 'KI speichern',
    btnTestPrimary: 'Verbindung testen',
    aiLangLabel: 'Sprache der Oberfläche & KI',
    msgSaved: 'Gespeichert ✓',
  },
  ja: {
    askNow: 'クイックテスト',
    resetProgress: 'リセット',
    tabRoadmap: '学習パス',
    tabSettings: '設定',
    tabAnalytics: '学習の進捗',
    tabAi: 'AI - API設定',
    tabCards: '単語帳',
    btnSaveSettings: '保存する',
    btnSaveAi: 'AI設定を保存',
    btnTestPrimary: '接続テスト',
    aiLangLabel: 'UI・AI解説の言語',
    msgSaved: '保存しました ✓',
  },
  pt: {
    askNow: 'Quiz rápido',
    resetProgress: 'Redefinir',
    tabRoadmap: 'Trilha de aprendizado',
    tabSettings: 'Configurações',
    tabAnalytics: 'Meu progresso',
    tabAi: 'IA - Chaves API',
    tabCards: 'Minhas palavras',
    btnSaveSettings: 'Salvar',
    btnSaveAi: 'Salvar IA',
    btnTestPrimary: 'Testar conexão',
    aiLangLabel: 'Idioma da interface e IA',
    msgSaved: 'Salvo ✓',
  },
  ru: {
    askNow: 'Быстрый тест',
    resetProgress: 'Сбросить',
    tabRoadmap: 'Путь обучения',
    tabSettings: 'Настройки',
    tabAnalytics: 'Мой прогресс',
    tabAi: 'ИИ - API ключи',
    tabCards: 'Мои слова',
    btnSaveSettings: 'Сохранить',
    btnSaveAi: 'Сохранить ИИ',
    btnTestPrimary: 'Проверить',
    aiLangLabel: 'Язык интерфейса и ИИ',
    msgSaved: 'Сохранено ✓',
  },
  it: {
    askNow: 'Quiz rapido',
    resetProgress: 'Ripristina',
    tabRoadmap: 'Percorso di studio',
    tabSettings: 'Impostazioni',
    tabAnalytics: 'I miei progressi',
    tabAi: 'IA - Chiavi API',
    tabCards: 'Le mie parole',
    btnSaveSettings: 'Salva',
    btnSaveAi: 'Salva IA',
    btnTestPrimary: 'Test connessione',
    aiLangLabel: 'Lingua interfaccia e IA',
    msgSaved: 'Salvato ✓',
  },
  ko: {
    askNow: '빠른 퀴즈',
    resetProgress: '초기화',
    tabRoadmap: '학습 경로',
    tabSettings: '설정',
    tabAnalytics: '내 진행 상황',
    tabAi: 'AI - API 키',
    tabCards: '내 단어장',
    btnSaveSettings: '저장하기',
    btnSaveAi: 'AI 저장',
    btnTestPrimary: '연결 테스트',
    aiLangLabel: 'UI 및 AI 설명 언어',
    msgSaved: '저장됨 ✓',
  },
  zh: {
    askNow: '快速测验',
    resetProgress: '重置进度',
    tabRoadmap: '学习路线',
    tabSettings: '设置',
    tabAnalytics: '我的进度',
    tabAi: 'AI - API 密钥',
    tabCards: '我的词库',
    btnSaveSettings: '保存',
    btnSaveAi: '保存 AI',
    btnTestPrimary: '测试连接',
    aiLangLabel: '界面与 AI 解释语言',
    msgSaved: '已保存 ✓',
  },
  ar: {
    askNow: 'اختبار سريع',
    resetProgress: 'إعادة ضبط',
    tabRoadmap: 'مسار التعلم',
    tabSettings: 'الإعدادات',
    tabAnalytics: 'تقدمي',
    tabAi: 'الذكاء الاصطناعي - API',
    tabCards: 'كلماتي',
    btnSaveSettings: 'حفظ',
    btnSaveAi: 'حفظ الذكاء الاصطناعي',
    btnTestPrimary: 'اختبار الاتصال',
    aiLangLabel: 'لغة الواجهة وشرح الذكاء الاصطناعي',
    msgSaved: 'تم الحفظ ✓',
  },
};

export function getDashboardStrings(
  mode: FeedbackLanguageMode | undefined,
  browserLangOverride?: string
): DashboardStrings {
  const code = resolveSupportedLanguage(mode, browserLangOverride);
  const override = DASHBOARD_OVERRIDES[code];
  return override ? { ...EN_DASHBOARD, ...override } : EN_DASHBOARD;
}

export function applyDashboardTranslations(
  mode: FeedbackLanguageMode | undefined
): DashboardStrings {
  const s = getDashboardStrings(mode);
  document.title = s.pageTitle;
  document.documentElement.lang = resolveSupportedLanguage(mode);

  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = el.dataset.i18n as keyof DashboardStrings | undefined;
    if (key && typeof s[key] === 'string') {
      el.textContent = s[key];
    }
  }

  for (const el of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    '[data-i18n-ph]'
  )) {
    const key = el.dataset.i18nPh as keyof DashboardStrings | undefined;
    if (key && typeof s[key] === 'string') {
      el.placeholder = s[key];
    }
  }

  return s;
}
