import type {
  Card,
  CefrLevel,
  LessonExercise,
  LessonExerciseKind,
  UserCardProgress,
} from './types';

export type { LessonExercise, LessonExerciseKind };

export type RoadmapNodeKind = 'skill' | 'story' | 'duo_radio' | 'practice' | 'unit_review';

export interface GuidebookPhrase {
  en: string;
  tr: string;
  noteTr: string;
  noteEn: string;
}

export interface UnitGuidebook {
  tipTitleTr: string;
  tipTitleEn: string;
  tipBodyTr: string;
  tipBodyEn: string;
  keyPhrases: GuidebookPhrase[];
}

export interface UnitNodeDefinition {
  index: number;
  kind: RoadmapNodeKind;
  titleTr: string;
  titleEn: string;
  subtitleTr: string;
  subtitleEn: string;
  xpReward: number;
}

export interface CurriculumUnit {
  id: string;
  unitNumber: number;
  sectionNumber: number;
  sectionTitleTr: string;
  sectionTitleEn: string;
  level: CefrLevel;
  titleTr: string;
  titleEn: string;
  subtitleTr: string;
  subtitleEn: string;
  icon: string;
  themeColor: string;
  lipColor: string;
  keywords: RegExp;
  guidebook: UnitGuidebook;
  nodes: UnitNodeDefinition[];
}

export interface RoadmapState {
  xp: number;
  dailyXp: number;
  dailyXpGoal: number;
  dailyLessonsCompleted: number;
  lastDailyDate: string;
  activeUnitId: string;
  /** When true, periodic/manual prompts also prioritize cards from activeUnitId. */
  focusUnitOnly: boolean;
  /** Completed node keys formatted as `${unitId}:${nodeIndex}` */
  completedNodeIds: string[];
  /** Per-node step progress (0..2 before completion; 3 = node completed) */
  nodeStepProgress: Record<string, number>;
  /** Unit IDs whose mid-unit chest reward (+25 XP) has been claimed */
  claimedChestUnitIds: string[];
  /** Unit IDs unlocked via completion or "BURAYA ATLA!" jump test */
  unlockedUnitIds: string[];
  /** 0 = active/locked, 1 = unit completed, 2 = legendary gold */
  unitCrownLevels: Record<string, number>;
}

function makeStandardNodes(unitTitleTr: string, unitTitleEn: string): UnitNodeDefinition[] {
  return [
    {
      index: 0,
      kind: 'skill',
      titleTr: `${unitTitleTr} · Kelime Keşfi`,
      titleEn: `${unitTitleEn} · Word Discovery`,
      subtitleTr: 'Temel kelimeleri görsel ve işitsel ipuçlarıyla tanı',
      subtitleEn: 'Discover core vocabulary with visual and audio scaffolding',
      xpReward: 15,
    },
    {
      index: 1,
      kind: 'story',
      titleTr: `${unitTitleTr} · Bağlam & Cümle Kurma`,
      titleEn: `${unitTitleEn} · Context & Sentence Builder`,
      subtitleTr: 'Kelime bankası ve boşluk doldurma ile cümle içinde kullan',
      subtitleEn: 'Use words in context with Word Bank and fill-in-the-blank',
      xpReward: 15,
    },
    {
      index: 2,
      kind: 'duo_radio',
      titleTr: `${unitTitleTr} · Radyo & Dikte`,
      titleEn: `${unitTitleEn} · Audio Lab & Dictation`,
      subtitleTr: 'Gerçek hızda ve yavaş (0.75x) dinleyerek cümleyi yakala',
      subtitleEn: 'Listen at 1.0x and 0.75x speed and transcribe what you hear',
      xpReward: 20,
    },
    {
      index: 3,
      kind: 'practice',
      titleTr: `${unitTitleTr} · Zayıf Nokta Antrenmanı`,
      titleEn: `${unitTitleEn} · Weak-Point Drill`,
      subtitleTr: 'Zorlandığın kelimeleri ve cümle kalıplarını pekiştir',
      subtitleEn: 'Reinforce fragile words and sentence patterns',
      xpReward: 20,
    },
    {
      index: 4,
      kind: 'unit_review',
      titleTr: `${unitTitleTr} · Ünite Ustası Testi`,
      titleEn: `${unitTitleEn} · Unit Mastery Crown`,
      subtitleTr: 'Üniteyi altın kupayla tamamlamak için karma sınavı geç',
      subtitleEn: 'Pass the mixed mastery challenge to earn the unit crown',
      xpReward: 30,
    },
  ];
}

export const CURRICULUM_UNITS: CurriculumUnit[] = [
  // ==================== SECTION 1: A1 FOUNDATIONS ====================
  {
    id: 'u01_basics',
    unitNumber: 1,
    sectionNumber: 1,
    sectionTitleTr: '1. KISIM · A1 Başlangıç Temelleri',
    sectionTitleEn: 'SECTION 1 · A1 Foundations',
    level: 'A1',
    titleTr: 'Selamlaşma ve Günlük Temeller',
    titleEn: 'Greetings & Daily Basics',
    subtitleTr: 'Kendini tanıt, kibarca soru sor ve temel günlük ifadeleri kur',
    subtitleEn: 'Introduce yourself, ask polite questions, and master everyday basics',
    icon: '👋',
    themeColor: '#58cc02',
    lipColor: '#46a302',
    keywords:
      /\b(hello|hi|morning|evening|night|please|thank|welcome|sorry|excuse|name|meet|friend|neighbor|polite|introduce|hometown|speak|language|yes|no|help|today|tomorrow)\b/i,
    guidebook: {
      tipTitleTr: 'Tanışma ve Kibarlık Kalıpları',
      tipTitleEn: 'Introductions & Polite Expressions',
      tipBodyTr:
        'İngilizcede bir konuşmayı başlatırken "Excuse me" (Affedersiniz / Bakar mısınız) dikkat çekmek için, "Sorry" ise özür dilemek için kullanılır. İlk kez tanıştığın birine "Nice to meet you" diyebilirsin.',
      tipBodyEn:
        'Use "Excuse me" to get someone’s attention politely, and "Sorry" to apologize. Say "Nice to meet you" when meeting someone for the first time.',
      keyPhrases: [
        {
          en: 'Nice to meet you, where are you from?',
          tr: 'Tanıştığımıza memnun oldum, nerelisin?',
          noteTr: '"from" memleket/köken belirtir.',
          noteEn: '"from" indicates origin or hometown.',
        },
        {
          en: 'Excuse me, do you speak English?',
          tr: 'Affedersiniz, İngilizce konuşuyor musunuz?',
          noteTr: 'Geniş zaman sorularda "Do you + fiil" kullanılır.',
          noteEn: 'Present simple questions use "Do you + base verb".',
        },
      ],
    },
    nodes: makeStandardNodes('Günlük Temeller', 'Daily Basics'),
  },
  {
    id: 'u02_animals',
    unitNumber: 2,
    sectionNumber: 1,
    sectionTitleTr: '1. KISIM · A1 Başlangıç Temelleri',
    sectionTitleEn: 'SECTION 1 · A1 Foundations',
    level: 'A1',
    titleTr: 'Hayvanlar Alemi ve Doğa Dostları',
    titleEn: 'Animals & Wildlife',
    subtitleTr: 'Evcil ve vahşi hayvanları, vücut bölümlerini ve doğadaki yaşamlarını öğren',
    subtitleEn: 'Learn pets, wild animals, body parts like paws & wings, and wildlife habits',
    icon: '🦁',
    themeColor: '#ff9600',
    lipColor: '#cc7800',
    keywords:
      /\b(animal|dog|cat|bird|fish|horse|cow|sheep|pig|chicken|lion|tiger|bear|elephant|giraffe|monkey|snake|rabbit|mouse|wolf|fox|deer|whale|shark|dolphin|eagle|owl|penguin|turtle|squirrel|bee|ant|butterfly|spider|frog|duck|pet|zoo|wildlife|veterinarian|paw|wing|feather|fur|beak|tail|nest|predator|prey|habitat|flock|herd|hibernate|endangered)\b/i,
    guidebook: {
      tipTitleTr: 'Hayvanlar, Sürü İsimleri ve Özellikler',
      tipTitleEn: 'Animals, Collective Nouns & Features',
      tipBodyTr:
        'İngilizcede hayvanların vücut bölümleri insanlardan farklı kelimelerle anlatılır: el/ayak yerine "paw" (pati), tüy/saç yerine "fur" (kürk) veya "feather" (kuş tüyü), ağız yerine "beak" (gaga) kullanılır. Ayrıca hayvan grupları için "a flock of birds" (kuş sürüsü), "a pack of wolves" (kurt sürüsü) ve "a herd of elephants" (fil sürüsü) denir.',
      tipBodyEn:
        'Use specific words for animal anatomy: "paw" (pati), "fur" (kürk), "feather" (kuş tüyü), and "beak" (gaga). Group nouns include "a flock of birds", "a pack of wolves", and "a herd of elephants".',
      keyPhrases: [
        {
          en: 'The veterinarian examined the injured bird and bandaged its wing.',
          tr: 'Veteriner yaralı kuşu muayene etti ve kanadını sardı.',
          noteTr: 'Hayvanlar için iyelik sıfatı olarak genellikle "its" kullanılır.',
          noteEn: 'Use "its" as the possessive determiner for animals.',
        },
        {
          en: 'A flock of birds flew south before the winter storm arrived.',
          tr: 'Kış fırtınası gelmeden önce bir kuş sürüsü güneye uçtu.',
          noteTr: '"flock" kuş ve koyun sürüleri için kullanılır.',
          noteEn: '"flock" is used for groups of birds or sheep.',
        },
      ],
    },
    nodes: makeStandardNodes('Hayvanlar Alemi', 'Animals & Wildlife'),
  },
  {
    id: 'u03_food',
    unitNumber: 3,
    sectionNumber: 1,
    sectionTitleTr: '1. KISIM · A1 Başlangıç Temelleri',
    sectionTitleEn: 'SECTION 1 · A1 Foundations',
    level: 'A1',
    titleTr: 'Yiyecek, İçecek ve Mutfak',
    titleEn: 'Food, Drinks & Kitchen',
    subtitleTr: 'Restoranda sipariş ver, yemek malzemelerini ve pişirme yöntemlerini tanı',
    subtitleEn: 'Order at restaurants and learn ingredients, flavors, and cooking verbs',
    icon: '🍎',
    themeColor: '#1cb0f6',
    lipColor: '#1899d6',
    keywords:
      /\b(food|eat|drink|water|bread|milk|meat|fruit|apple|orange|banana|vegetable|potato|tomato|rice|soup|cheese|egg|sugar|salt|pepper|coffee|tea|breakfast|lunch|dinner|restaurant|kitchen|cook|bake|boil|fry|meal|taste|delicious|hungry|thirsty|menu|recipe|ingredient|dessert|plate|spoon|fork|knife|glass|bottle)\b/i,
    guidebook: {
      tipTitleTr: 'Sayılabilen / Sayılamayan Yiyecekler & Sipariş',
      tipTitleEn: 'Countable vs. Uncountable Food & Ordering',
      tipBodyTr:
        '"Water, milk, bread, rice" gibi sıvı ve taneli gıdalar sayılamaz; miktar belirtmek için "a glass of water" (bir bardak su) veya "a slice of bread" (bir dilim ekmek) kullanılır. Sipariş verirken "Could I have...?" kalıbı en doğal ve kibar seçenektir.',
      tipBodyEn:
        'Liquids and grains like "water, milk, bread, rice" are uncountable; pair them with containers ("a bottle of water", "a bowl of soup"). Use "Could I have...?" when ordering.',
      keyPhrases: [
        {
          en: 'Fresh garlic and olive oil are the main ingredients in this recipe.',
          tr: 'Taze sarımsak ve zeytinyağı bu tarifteki ana malzemelerdir.',
          noteTr: '"ingredient" yemek malzemesi, "recipe" yemek tarifidir.',
          noteEn: '"ingredient" means food component; "recipe" means cooking instructions.',
        },
        {
          en: 'Could we see the menu and have a bottle of still water, please?',
          tr: 'Menüyü görebilir miyiz ve lütfen bir şişe su alabilir miyiz?',
          noteTr: '"still water" normal içme suyu, "sparkling water" maden suyudur.',
          noteEn: '"still water" is non-carbonated water.',
        },
      ],
    },
    nodes: makeStandardNodes('Yemek & Mutfak', 'Food & Kitchen'),
  },
  {
    id: 'u04_family_home',
    unitNumber: 4,
    sectionNumber: 1,
    sectionTitleTr: '1. KISIM · A1 Başlangıç Temelleri',
    sectionTitleEn: 'SECTION 1 · A1 Foundations',
    level: 'A1',
    titleTr: 'Aile, İnsanlar ve Ev Yaşamı',
    titleEn: 'Family, People & Home',
    subtitleTr: 'Aile bireylerini, evin bölümlerini ve günlük ev eşyalarını anlat',
    subtitleEn: 'Describe family members, rooms of the house, and household items',
    icon: '🏠',
    themeColor: '#ce82ff',
    lipColor: '#a568cc',
    keywords:
      /\b(family|mother|father|parent|sister|brother|son|daughter|child|children|baby|uncle|aunt|cousin|grandmother|grandfather|wife|husband|home|house|room|bedroom|bathroom|living|garden|door|window|wall|floor|roof|stairs|chair|table|bed|sofa|mirror|key|clean|wash)\b/i,
    guidebook: {
      tipTitleTr: '"Home" ve "House" Arasındaki Fark',
      tipTitleEn: 'Difference Between "Home" and "House"',
      tipBodyTr:
        '"House" fiziksel binayı (üç odalı bir ev), "Home" ise aidiyet duyulan yuvayı anlatır. Ayrıca "go home / come home / stay at home" ifadelerinde "home" kelimesinden önce "to" edatı GELMEZ.',
      tipBodyEn:
        '"House" refers to the physical building, while "home" is where you live emotionally. Never put "to" before "home" in "go home" or "come home".',
      keyPhrases: [
        {
          en: 'We used to live in a small apartment near the coast.',
          tr: 'Eskiden sahilin yakınında küçük bir dairede yaşardık.',
          noteTr: '"apartment" apartman dairesi demektir.',
          noteEn: '"apartment" refers to a flat inside a building.',
        },
      ],
    },
    nodes: makeStandardNodes('Aile & Ev', 'Family & Home'),
  },
  {
    id: 'u05_frequency',
    unitNumber: 5,
    sectionNumber: 1,
    sectionTitleTr: '1. KISIM · A1 Başlangıç Temelleri',
    sectionTitleEn: 'SECTION 1 · A1 Foundations',
    level: 'A1',
    titleTr: 'Sıklık Zarflarını Kullan',
    titleEn: 'Use Frequency Adverbs & Routines',
    subtitleTr: 'Alışkanlıklarını always, usually, often, rarely ve never ile ifade et',
    subtitleEn: 'Express habits and routines with always, usually, often, rarely, and never',
    icon: '⏰',
    themeColor: '#ff4b4b',
    lipColor: '#ea2b2b',
    keywords:
      /\b(always|usually|often|frequently|sometimes|occasionally|seldom|rarely|never|daily|weekly|monthly|routine|habit|schedule|early|late|every|morning|wake|sleep|clock|hour|minute|weekend)\b/i,
    guidebook: {
      tipTitleTr: 'Sıklık Zarfları Cümlede Nereye Gelir?',
      tipTitleEn: 'Word Order of Frequency Adverbs',
      tipBodyTr:
        '"Always (%100), usually (%85), often (%70), sometimes (%50), rarely (%15), never (%0)" gibi sıklık zarfları normal fiillerden ÖNCE ("I usually wake up at 7"), ancak "am / is / are" yardımcı fiillerinden SONRA ("She is never late") gelir.',
      tipBodyEn:
        'Place frequency adverbs BEFORE main verbs ("I usually wake up early"), but AFTER the verb "to be" ("She is never late").',
      keyPhrases: [
        {
          en: 'She is never late for meetings because she always leaves home early.',
          tr: 'Toplantılara asla geç kalmaz çünkü evden her zaman erken çıkar.',
          noteTr: '"is never late" (be + zarf) ve "always leaves" (zarf + fiil) farkına dikkat et!',
          noteEn: 'Notice "is never" (after be) vs. "always leaves" (before main verb).',
        },
        {
          en: 'How often do you practice speaking English with native speakers?',
          tr: 'Ana dili İngilizce olanlarla ne sıklıkla İngilizce konuşma pratiği yapıyorsun?',
          noteTr: '"How often...?" ne sıklıkla sorusunu sorar.',
          noteEn: '"How often...?" asks about frequency.',
        },
      ],
    },
    nodes: makeStandardNodes('Sıklık Zarfları', 'Frequency Adverbs'),
  },

  // ==================== SECTION 2: A2 LIFESTYLE, SPORTS & CULTURE ====================
  {
    id: 'u06_sports',
    unitNumber: 6,
    sectionNumber: 2,
    sectionTitleTr: '2. KISIM · A2 Yaşam, Spor ve Kültür',
    sectionTitleEn: 'SECTION 2 · A2 Lifestyle, Sports & Culture',
    level: 'A2',
    titleTr: 'Spor, Antrenman ve Rekabet',
    titleEn: 'Sports, Fitness & Competition',
    subtitleTr: 'Maç terimlerini, spor dallarını, antrenman ve şampiyonluk ifadelerini öğren',
    subtitleEn: 'Master sports vocabulary, match terms, workouts, and competition phrases',
    icon: '⚽',
    themeColor: '#58cc02',
    lipColor: '#46a302',
    keywords:
      /\b(sport|football|soccer|basketball|tennis|volleyball|swim|swimming|run|runner|race|marathon|match|game|team|teammate|player|coach|referee|goalkeeper|opponent|spectator|win|lose|draw|score|scoreboard|goal|penalty|ball|stadium|pitch|court|olympic|gym|workout|exercise|fitness|stretch|endurance|athlete|champion|championship|tournament|league|medal|trophy|archery)\b/i,
    guidebook: {
      tipTitleTr: 'Sporlarda "Play", "Go" ve "Do" Ayrımı',
      tipTitleEn: 'Using "Play", "Go", and "Do" with Sports',
      tipBodyTr:
        'Topla ve takımla oynanan rekabetçi sporlar için "PLAY" (play football, play tennis, play basketball); sonu "-ing" ile biten açık hava/hareket sporları için "GO" (go swimming, go running, go cycling); bireysel salon/dövüş/esneme sporları için "DO" (do yoga, do gymnastics, do karate) kullanılır.',
      tipBodyEn:
        'Use "PLAY" for ball and team games (play football, tennis), "GO" for -ing activities (go swimming, running), and "DO" for individual disciplines (do yoga, gymnastics, archery).',
      keyPhrases: [
        {
          en: 'The referee blew the whistle to start the second half of the match.',
          tr: 'Hakem maçın ikinci yarısını başlatmak için düdüğü çaldı.',
          noteTr: '"referee" hakem, "second half" ikinci yarı demektir.',
          noteEn: '"referee" officiates the game; "second half" is the second 45-minute period.',
        },
        {
          en: 'The match ended in a draw after ninety minutes of intense play.',
          tr: 'Maç doksan dakikalık yoğun oyunun ardından berabere bitti.',
          noteTr: '"end in a draw" berabere bitmek anlamına gelir.',
          noteEn: '"end in a draw" means neither team won.',
        },
      ],
    },
    nodes: makeStandardNodes('Spor & Rekabet', 'Sports & Fitness'),
  },
  {
    id: 'u07_cinema',
    unitNumber: 7,
    sectionNumber: 2,
    sectionTitleTr: '2. KISIM · A2 Yaşam, Spor ve Kültür',
    sectionTitleEn: 'SECTION 2 · A2 Lifestyle, Sports & Culture',
    level: 'A2',
    titleTr: 'Sinema, Dizi ve Sahne Sanatları',
    titleEn: 'Cinema, Movies & Performing Arts',
    subtitleTr: 'Film türleri, senaryo, yönetmenlik, altyazı ve sahne sanatları hakkında konuş',
    subtitleEn: 'Talk about film genres, directors, screenplays, subtitles, and theater',
    icon: '🎬',
    themeColor: '#ce82ff',
    lipColor: '#a568cc',
    keywords:
      /\b(movie|film|cinema|actor|actress|director|screenplay|script|scene|screen|theater|theatre|drama|comedy|horror|thriller|documentary|sequel|premiere|trailer|subtitles|soundtrack|audience|stage|spotlight|rehearsal|role|character|plot|cast|concert|music|song|episode|series|show|camera|studio)\b/i,
    guidebook: {
      tipTitleTr: 'Sinema ve Dizi Terimlerini Doğal Kullanmak',
      tipTitleEn: 'Natural Cinema & Series Vocabulary',
      tipBodyTr:
        'Bir filmin hikayesini anlatırken "plot" (olay örgüsü), oyuncuların tamamı için "cast" (oyuncu kadrosu), devam filmi için "sequel", tanıtım videosu için "trailer" ve altyazı için "subtitles" kullanılır. "In the original language with subtitles" kalıbı çok sık kullanılır.',
      tipBodyEn:
        'Use "plot" for the storyline, "cast" for all actors, "sequel" for a follow-up movie, "trailer" for the preview clip, and "subtitles" for on-screen text.',
      keyPhrases: [
        {
          en: 'I prefer watching movies in their original language with subtitles.',
          tr: 'Filmleri orijinal dilinde altyazılı olarak izlemeyi tercih ederim.',
          noteTr: '"prefer + V-ing" bir şeyi yapmayı tercih etmek demektir.',
          noteEn: '"prefer + V-ing" expresses general preference.',
        },
        {
          en: 'The detective movie had a clever plot with an unexpected twist.',
          tr: 'Dedektif filminin beklenmedik bir ters köşeye sahip zekice bir olay örgüsü vardı.',
          noteTr: '"plot twist" hikayedeki sürpriz ters köşedir.',
          noteEn: 'A "plot twist" is a surprise turn in the story.',
        },
      ],
    },
    nodes: makeStandardNodes('Sinema & Sahne', 'Cinema & Media'),
  },
  {
    id: 'u08_travel',
    unitNumber: 8,
    sectionNumber: 2,
    sectionTitleTr: '2. KISIM · A2 Yaşam, Spor ve Kültür',
    sectionTitleEn: 'SECTION 2 · A2 Lifestyle, Sports & Culture',
    level: 'A2',
    titleTr: 'Seyahat, Havalimanı ve Yön Bulma',
    titleEn: 'Travel, Flights & Directions',
    subtitleTr: 'Uçuş, pasaport, otel rezervasyonu ve şehir içi yön tariflerini öğren',
    subtitleEn: 'Navigate airports, hotels, tickets, passports, and city directions',
    icon: '✈️',
    themeColor: '#1cb0f6',
    lipColor: '#1899d6',
    keywords:
      /\b(travel|trip|journey|flight|plane|airport|boarding|passport|luggage|suitcase|baggage|hotel|reservation|ticket|train|station|platform|bus|taxi|subway|map|street|road|bridge|corner|direction|tour|tourist|vacation|holiday|beach|island|museum|guide|border|passenger|abroad|destination)\b/i,
    guidebook: {
      tipTitleTr: '"Trip", "Travel" ve "Journey" Farkı',
      tipTitleEn: '"Trip" vs. "Travel" vs. "Journey"',
      tipBodyTr:
        '"Travel" genellikle fiil veya genel seyahat kavramı olarak kullanılır ("I love travelling"). Gidip dönülen belirli bir gezi için "trip" ("a business trip / a weekend trip"), iki nokta arasındaki uzun yolculuk süreci içinse "journey" kullanılır.',
      tipBodyEn:
        'Use "trip" for a specific visit ("a weekend trip"), "journey" for the transit from A to B, and "travel" as a verb or general uncountable noun.',
      keyPhrases: [
        {
          en: 'Watch your step when getting off the train onto the platform.',
          tr: 'Trenden perona inerken adımınıza dikkat edin.',
          noteTr: '"get on" (binmek) ve "get off" (inmek) toplu taşıma için kullanılır.',
          noteEn: 'Use "get on / get off" for trains, buses, and planes.',
        },
      ],
    },
    nodes: makeStandardNodes('Seyahat & Yönler', 'Travel & Directions'),
  },
  {
    id: 'u09_shopping',
    unitNumber: 9,
    sectionNumber: 2,
    sectionTitleTr: '2. KISIM · A2 Yaşam, Spor ve Kültür',
    sectionTitleEn: 'SECTION 2 · A2 Lifestyle, Sports & Culture',
    level: 'A2',
    titleTr: 'Alışveriş, Moda ve Harcamalar',
    titleEn: 'Shopping, Style & Money',
    subtitleTr: 'Fiyat sor, beden/renk seç, indirimleri ve ödeme yöntemlerini konuş',
    subtitleEn: 'Ask about prices, choose sizes and clothes, and handle payments & refunds',
    icon: '🛍️',
    themeColor: '#ff9600',
    lipColor: '#cc7800',
    keywords:
      /\b(shop|shopping|store|market|mall|buy|sell|pay|price|cost|cheap|expensive|discount|sale|receipt|refund|cash|card|wallet|money|coin|bill|shirt|jacket|coat|dress|shoes|boots|hat|pocket|size|wear|fit|try|customer)\b/i,
    guidebook: {
      tipTitleTr: 'Kıyafet Denemek ve İade Etmek',
      tipTitleEn: 'Trying On Clothes & Refunds',
      tipBodyTr:
        'Bir kıyafeti denemek için "try on" ("Can I try this jacket on?"), bedenin uyması için "fit" ("These shoes don’t fit me"), yakışması için "suit" ("That color suits you"), fiş için "receipt" ve para iadesi için "refund" kullanılır.',
      tipBodyEn:
        'Use "try on" to test clothes, "fit" for correct size, "suit" for looking good, "receipt" for proof of purchase, and "refund" for money back.',
      keyPhrases: [
        {
          en: 'Keep your receipt in case you want to exchange or return the shirt.',
          tr: 'Gömleği değiştirmek veya iade etmek ihtimaline karşı fişinizi saklayın.',
          noteTr: '"in case" (...olur diye / ihtimaline karşı) tedbir bildirir.',
          noteEn: '"in case" expresses precaution for a possible future situation.',
        },
      ],
    },
    nodes: makeStandardNodes('Alışveriş & Moda', 'Shopping & Style'),
  },
  {
    id: 'u10_imperatives_safety',
    unitNumber: 10,
    sectionNumber: 2,
    sectionTitleTr: '2. KISIM · A2 Yaşam, Spor ve Kültür',
    sectionTitleEn: 'SECTION 2 · A2 Lifestyle, Sports & Culture',
    level: 'A2',
    titleTr: 'Emir Cümleleri ve Güvenlik Tavsiyesi Ver',
    titleEn: 'Imperatives & Give Safety Advice',
    subtitleTr: 'Olumlu/olumsuz emir kipleri ve uyarı kalıplarıyla güvenlik tavsiyeleri ver',
    subtitleEn: 'Give clear instructions, warnings, and safety advice using imperatives',
    icon: '🛡️',
    themeColor: '#00cd9c',
    lipColor: '#00a37c',
    keywords:
      /\b(seatbelt|helmet|precaution|slippery|hazard|danger|dangerous|safe|safety|careful|warning|caution|emergency|lock|password|protect|fire|alarm|exit|rule|follow|never|always|make sure|watch out|look out|remember|forget)\b/i,
    guidebook: {
      tipTitleTr: 'Emir Cümleleri ve Güvenlik Uyarıları',
      tipTitleEn: 'Imperatives & Safety Warnings',
      tipBodyTr:
        'İngilizcede olumlu talimat ve tavsiye verirken cümleye doğrudan yalın fiille başlanır: "Fasten your seatbelt" (Emniyet kemerini bağla), "Make sure you lock the door" (Kapıyı kilitlediğinden emin ol). Olumsuz uyarılar için "Don’t..." veya daha güçlü uyarı için "Never..." ("Never share your password") kullanılır.',
      tipBodyEn:
        'Start affirmative instructions with the base verb ("Fasten your seatbelt", "Watch your step"). Use "Don’t..." or "Never..." for prohibitions and safety warnings.',
      keyPhrases: [
        {
          en: 'Always fasten your seatbelt before the car starts moving.',
          tr: 'Araba hareket etmeye başlamadan önce her zaman emniyet kemerinizi bağlayın.',
          noteTr: '"Always + yalın fiil" güçlü bir kural veya tavsiye bildirir.',
          noteEn: '"Always + base verb" gives a strong safety instruction.',
        },
        {
          en: 'Never share your bank password or verification code with strangers.',
          tr: 'Banka şifrenizi veya doğrulama kodunuzu asla yabancılarla paylaşmayın.',
          noteTr: '"Never + yalın fiil" kesin yasak/uyarı ifade eder.',
          noteEn: '"Never + base verb" expresses a strict safety rule.',
        },
      ],
    },
    nodes: makeStandardNodes('Güvenlik Tavsiyesi', 'Safety & Imperatives'),
  },

  // ==================== SECTION 3: B1 INDEPENDENT COMMUNICATION ====================
  {
    id: 'u11_health',
    unitNumber: 11,
    sectionNumber: 3,
    sectionTitleTr: '3. KISIM · B1 Bağımsız İletişim',
    sectionTitleEn: 'SECTION 3 · B1 Independent Communication',
    level: 'B1',
    titleTr: 'Sağlık, Vücut ve Tıp',
    titleEn: 'Health, Body & Medicine',
    subtitleTr: 'Belirtileri anlat, doktor muayenesi, tedavi ve sağlıklı yaşam kavramlarını öğren',
    subtitleEn: 'Describe symptoms, medical treatments, anatomy, and healthy habits',
    icon: '🩺',
    themeColor: '#ff4b4b',
    lipColor: '#ea2b2b',
    keywords:
      /\b(health|healthy|doctor|nurse|hospital|clinic|medicine|pill|prescription|treatment|surgery|symptom|fever|cough|headache|pain|ache|hurt|sick|ill|disease|infection|virus|vaccine|blood|heart|brain|lung|stomach|bone|muscle|skin|breath|breathe|recover|stress|sleep)\b/i,
    guidebook: {
      tipTitleTr: 'Ağrı ve Belirti Anlatma Kalıpları',
      tipTitleEn: 'Describing Pain & Symptoms',
      tipBodyTr:
        '"Hurt" fiildir ("My back hurts" — Sırtım ağrıyor), "ache" ise çoğunlukla vücut bölümüyle birleşip isim olur ("headache, toothache, stomachache"). "Prescription" doktor reçetesi, "recover from" ise bir hastalıktan iyileşmektir.',
      tipBodyEn:
        'Use "hurt" as a verb ("My knee hurts") and "ache" in compound nouns ("headache, stomachache"). Use "recover from" for getting better after illness.',
      keyPhrases: [
        {
          en: 'The doctor wrote a prescription and advised me to rest for three days.',
          tr: 'Doktor reçete yazdı ve üç gün dinlenmemi tavsiye etti.',
          noteTr: '"advise someone to do something" tavsiye vermek kalıbıdır.',
          noteEn: 'Pattern: "advise + person + to + verb".',
        },
      ],
    },
    nodes: makeStandardNodes('Sağlık & Vücut', 'Health & Medicine'),
  },
  {
    id: 'u12_emotions',
    unitNumber: 12,
    sectionNumber: 3,
    sectionTitleTr: '3. KISIM · B1 Bağımsız İletişim',
    sectionTitleEn: 'SECTION 3 · B1 Independent Communication',
    level: 'B1',
    titleTr: 'Duygular, Karakter ve İlişkiler',
    titleEn: 'Emotions, Empathy & Relationships',
    subtitleTr: 'Hislerini, kişilik özelliklerini, empatiyi ve sosyal ilişkileri incelikle ifade et',
    subtitleEn: 'Express feelings, personality traits, trust, and interpersonal dynamics',
    icon: '💬',
    themeColor: '#ce82ff',
    lipColor: '#a568cc',
    keywords:
      /\b(feel|feeling|emotion|happy|glad|cheerful|excited|proud|confident|calm|relaxed|relieved|grateful|sad|upset|disappointed|lonely|angry|furious|annoyed|afraid|scared|anxious|nervous|worried|embarrassed|ashamed|jealous|curious|honest|loyal|generous|selfish|patient|stubborn|trust|respect|forgive|apologize|argue|relationship)\b/i,
    guidebook: {
      tipTitleTr: '-ed ve -ing Sıfatları (Excited vs. Exciting)',
      tipTitleEn: '-ed vs. -ing Adjectives',
      tipBodyTr:
        'Sonu "-ed" ile biten sıfatlar kişinin KENDİ hissini ("I am bored / excited / tired"), sonu "-ing" ile biten sıfatlar ise o duyguyu yaratan dış durumu ("The movie was boring / exciting / tiring") anlatır.',
      tipBodyEn:
        'Adjectives ending in "-ed" describe how a person feels ("I felt exhausted"); "-ing" adjectives describe what causes the feeling ("an exhausting journey").',
      keyPhrases: [
        {
          en: 'I was deeply grateful for her honest advice during a difficult time.',
          tr: 'Zor bir zamanda verdiği dürüst tavsiye için ona derinden minnettardım.',
          noteTr: '"grateful for" bir şey için minnettar olmaktır.',
          noteEn: 'Use "grateful to [person] for [something]".',
        },
      ],
    },
    nodes: makeStandardNodes('Duygular & Karakter', 'Emotions & Character'),
  },
  {
    id: 'u13_education',
    unitNumber: 13,
    sectionNumber: 3,
    sectionTitleTr: '3. KISIM · B1 Bağımsız İletişim',
    sectionTitleEn: 'SECTION 3 · B1 Independent Communication',
    level: 'B1',
    titleTr: 'Eğitim, Kampüs ve Öğrenme',
    titleEn: 'Education, Study & Campus',
    subtitleTr: 'Üniversite, sınavlar, burs, ödevler ve öğrenme yöntemleri hakkında konuş',
    subtitleEn: 'Discuss university life, exams, scholarships, assignments, and learning',
    icon: '🎓',
    themeColor: '#1cb0f6',
    lipColor: '#1899d6',
    keywords:
      /\b(school|university|college|campus|student|teacher|professor|lecture|lesson|course|class|classroom|exam|test|grade|score|degree|diploma|scholarship|assignment|homework|essay|project|library|study|learn|knowledge|skill|memorize|revise|graduate|curriculum)\b/i,
    guidebook: {
      tipTitleTr: 'Sınav ve Akademik İfadeler',
      tipTitleEn: 'Exams & Academic Collocations',
      tipBodyTr:
        'Sınava girmek "take an exam", sınavı geçmek "pass an exam", sınavdan kalmak "fail an exam", sınav öncesi tekrar yapmak ise "revise for an exam" ile ifade edilir.',
      tipBodyEn:
        'Standard collocations: "take an exam", "pass an exam", "fail an exam", and "revise for an exam".',
      keyPhrases: [
        {
          en: 'She received a full scholarship to study architecture at the university.',
          tr: 'Üniversitede mimarlık okumak için tam burs kazandı.',
          noteTr: '"scholarship" eğitim bursudur.',
          noteEn: '"scholarship" is financial aid awarded for academic achievement.',
        },
      ],
    },
    nodes: makeStandardNodes('Eğitim & Kampüs', 'Education & Study'),
  },
  {
    id: 'u14_nature_weather',
    unitNumber: 14,
    sectionNumber: 3,
    sectionTitleTr: '3. KISIM · B1 Bağımsız İletişim',
    sectionTitleEn: 'SECTION 3 · B1 Independent Communication',
    level: 'B1',
    titleTr: 'Doğa, İklim ve Coğrafya',
    titleEn: 'Nature, Weather & Landscapes',
    subtitleTr: 'Hava olayları, coğrafi şekiller, ekosistem ve doğal afetler üzerine konuş',
    subtitleEn: 'Describe weather patterns, geographical features, climate, and nature',
    icon: '🌿',
    themeColor: '#58cc02',
    lipColor: '#46a302',
    keywords:
      /\b(nature|natural|weather|climate|temperature|forecast|rain|snow|wind|storm|thunder|lightning|fog|cloud|sun|sunshine|drought|flood|earthquake|river|lake|sea|ocean|wave|coast|shore|mountain|hill|valley|desert|forest|jungle|tree|leaf|branch|soil|earth|environment)\b/i,
    guidebook: {
      tipTitleTr: 'Hava Durumu ve Doğal Olaylar',
      tipTitleEn: 'Weather Forecasts & Natural Phenomena',
      tipBodyTr:
        'Hava tahmini için "weather forecast", kuraklık için "drought", sel için "flood", gök gürültüsü için "thunder" ve şimşek için "lightning" kullanılır.',
      tipBodyEn:
        'Key terms: "weather forecast" (tahmin), "drought" (kuraklık), "flood" (sel), "thunder" (gök gürültüsü), and "lightning" (şimşek).',
      keyPhrases: [
        {
          en: 'According to the weather forecast, heavy rain is expected along the coast.',
          tr: 'Hava tahminine göre sahil boyunca şiddetli yağmur bekleniyor.',
          noteTr: '"heavy rain" sağanak/şiddetli yağmur demektir.',
          noteEn: 'Use "heavy" (not "strong") with rain and snow.',
        },
      ],
    },
    nodes: makeStandardNodes('Doğa & İklim', 'Nature & Weather'),
  },
  {
    id: 'u15_phrasal_verbs',
    unitNumber: 15,
    sectionNumber: 3,
    sectionTitleTr: '3. KISIM · B1 Bağımsız İletişim',
    sectionTitleEn: 'SECTION 3 · B1 Independent Communication',
    level: 'B1',
    titleTr: 'Deyimsel Fiiller ve Geçmiş Alışkanlıklar',
    titleEn: 'Phrasal Verbs & Past Habits',
    subtitleTr: 'Günlük İngilizcenin belkemiği olan deyimsel fiilleri ve "used to" kalıbını öğren',
    subtitleEn: 'Master high-frequency phrasal verbs and "used to" for past habits',
    icon: '⚡',
    themeColor: '#ff9600',
    lipColor: '#cc7800',
    keywords:
      /\b(used to|give up|look after|look for|look forward|turn on|turn off|turn down|put off|put on|take off|find out|run out|carry on|get along|break down|bring up|call off|catch up|come across|figure out|grow up|hang out|pick up|set up|show up|work out)\b/i,
    guidebook: {
      tipTitleTr: '"Used to" vs. "Be used to" ve Phrasal Verbs',
      tipTitleEn: '"Used to" vs. "Be used to" & Phrasal Verbs',
      tipBodyTr:
        '"I used to + yalın fiil" geçmişte yapıp artık bıraktığın alışkanlıkları anlatır ("I used to live here" — Eskiden burada yaşardım). "I am used to + V-ing/isim" ise bir şeye alışkın olmayı anlatır.',
      tipBodyEn:
        '"used to + verb" describes a past state or habit no longer true. "be used to + noun/-ing" means being accustomed to something.',
      keyPhrases: [
        {
          en: 'We ran out of milk, so I picked some up on my way home.',
          tr: 'Sütümüz bitti, bu yüzden eve gelirken biraz aldım.',
          noteTr: '"run out of" tükenmek/bitmek, "pick up" uğrayıp almak demektir.',
          noteEn: '"run out of" means have none left; "pick up" means buy on the way.',
        },
      ],
    },
    nodes: makeStandardNodes('Deyimsel Fiiller', 'Phrasal Verbs'),
  },

  // ==================== SECTION 4: B2 PROFESSIONAL & MODERN WORLD ====================
  {
    id: 'u16_business',
    unitNumber: 16,
    sectionNumber: 4,
    sectionTitleTr: '4. KISIM · B2 Profesyonel ve Modern Dünya',
    sectionTitleEn: 'SECTION 4 · B2 Professional & Modern World',
    level: 'B2',
    titleTr: 'İş Dünyası, Kariyer ve Yönetim',
    titleEn: 'Business, Career & Management',
    subtitleTr: 'Toplantı, müzakere, bütçe, sözleşme ve kariyer gelişimi terimlerinde ustalaş',
    subtitleEn: 'Master workplace negotiations, budgets, contracts, and leadership terms',
    icon: '💼',
    themeColor: '#1cb0f6',
    lipColor: '#1899d6',
    keywords:
      /\b(business|company|corporation|enterprise|office|workplace|career|profession|promotion|resign|retire|hire|recruit|interview|candidate|colleague|manager|director|executive|client|customer|contract|agreement|negotiate|deal|budget|profit|revenue|loss|salary|wage|tax|invest|investment|market|economy|strategy|deadline|meeting)\b/i,
    guidebook: {
      tipTitleTr: 'Profesyonel İş İngilizcesi Kalıpları',
      tipTitleEn: 'Professional Business Collocations',
      tipBodyTr:
        'Bir son teslim tarihine yetişmek "meet a deadline", sözleşme imzalamak "sign a contract", terfi almak "get promoted" ve istifa etmek "resign" ile ifade edilir.',
      tipBodyEn:
        'Key workplace collocations: "meet a deadline", "reach an agreement", "get promoted", and "allocate a budget".',
      keyPhrases: [
        {
          en: 'Our team worked overtime to meet the project deadline before Friday.',
          tr: 'Ekibimiz cuma gününden önce proje teslim tarihine yetişmek için fazla mesai yaptı.',
          noteTr: '"meet a deadline" son teslim tarihine yetişmek demektir.',
          noteEn: '"meet a deadline" means finish on time.',
        },
      ],
    },
    nodes: makeStandardNodes('İş & Kariyer', 'Business & Career'),
  },
  {
    id: 'u17_tech',
    unitNumber: 17,
    sectionNumber: 4,
    sectionTitleTr: '4. KISIM · B2 Profesyonel ve Modern Dünya',
    sectionTitleEn: 'SECTION 4 · B2 Professional & Modern World',
    level: 'B2',
    titleTr: 'Teknoloji, Yazılım ve Yapay Zeka',
    titleEn: 'Technology, Software & AI',
    subtitleTr: 'Yazılım, veri güvenliği, algoritmalar ve dijital dönüşüm kavramlarını kullan',
    subtitleEn: 'Discuss software engineering, cybersecurity, algorithms, and innovation',
    icon: '💻',
    themeColor: '#00cd9c',
    lipColor: '#00a37c',
    keywords:
      /\b(computer|software|hardware|data|database|internet|network|server|cloud|digital|system|device|screen|code|compile|program|developer|algorithm|artificial|intelligence|robot|automation|cyber|security|encryption|privacy|update|upgrade|bug|interface|application|wireless|battery|sensor)\b/i,
    guidebook: {
      tipTitleTr: 'Teknoloji ve Yazılım Terimleri',
      tipTitleEn: 'Tech & Software Terminology',
      tipBodyTr:
        '"Data" bilimsel ve teknik metinlerde sayılamayan tekil isim gibi ("The data shows...") kullanılır. "Encrypt" veriyi şifrelemek, "deploy" ise yazılımı canlıya almaktır.',
      tipBodyEn:
        'In modern tech English, "data" normally takes a singular verb ("The data is encrypted").',
      keyPhrases: [
        {
          en: 'The new algorithm processes large datasets with remarkable accuracy.',
          tr: 'Yeni algoritma büyük veri kümelerini dikkat çekici bir doğrulukla işliyor.',
          noteTr: '"process data" veriyi işlemek demektir.',
          noteEn: '"process data" is the standard collocation.',
        },
      ],
    },
    nodes: makeStandardNodes('Teknoloji & AI', 'Tech & Software'),
  },
  {
    id: 'u18_media_debate',
    unitNumber: 18,
    sectionNumber: 4,
    sectionTitleTr: '4. KISIM · B2 Profesyonel ve Modern Dünya',
    sectionTitleEn: 'SECTION 4 · B2 Professional & Modern World',
    level: 'B2',
    titleTr: 'Medya, Gazetecilik ve Tartışma',
    titleEn: 'Media, Journalism & Debate',
    subtitleTr: 'Haber kaynaklarını değerlendir, argüman kur ve karşıt görüşleri tartış',
    subtitleEn: 'Evaluate news sources, structure arguments, and debate viewpoints',
    icon: '📰',
    themeColor: '#ce82ff',
    lipColor: '#a568cc',
    keywords:
      /\b(media|news|newspaper|journalist|press|broadcast|article|headline|source|reliable|biased|objective|opinion|debate|argument|claim|persuade|convince|controversial|issue|public|influence|censorship|rumor|fact|contradict|nevertheless|furthermore|whereas)\b/i,
    guidebook: {
      tipTitleTr: 'Tartışma Bağlaçları (Whereas, Nevertheless, Furthermore)',
      tipTitleEn: 'Discourse Markers for Debate',
      tipBodyTr:
        'İki durumu karşılaştırırken "whereas" (...iken / oysa), karşıtlığa rağmen devam ederken "nevertheless / nonetheless" (buna rağmen / yine de), argümana güçlü bir ek yaparken "furthermore / moreover" (dahası / üstelik) kullanılır.',
      tipBodyEn:
        'Use "whereas" for direct contrast, "nevertheless" for concession, and "furthermore" to add a supporting argument.',
      keyPhrases: [
        {
          en: 'Always verify whether a news source is reliable before sharing an article.',
          tr: 'Bir makaleyi paylaşmadan önce haber kaynağının güvenilir olup olmadığını her zaman doğrulayın.',
          noteTr: '"whether" (...olup olmadığını) dolaylı sorularda kullanılır.',
          noteEn: '"whether" introduces an indirect yes/no condition.',
        },
      ],
    },
    nodes: makeStandardNodes('Medya & Tartışma', 'Media & Debate'),
  },

  // ==================== SECTION 5: C1 ACADEMIC & MASTERY ====================
  {
    id: 'u19_science_research',
    unitNumber: 19,
    sectionNumber: 5,
    sectionTitleTr: '5. KISIM · C1 Akademik ve İleri Ustalaşma',
    sectionTitleEn: 'SECTION 5 · C1 Academic & Advanced Mastery',
    level: 'C1',
    titleTr: 'Bilim, Araştırma ve Metodoloji',
    titleEn: 'Science, Research & Methodology',
    subtitleTr: 'Hipotez, kanıt, nedensellik ve akademik analiz kavramlarını ileri düzeyde kullan',
    subtitleEn: 'Master hypotheses, empirical evidence, causality, and academic analysis',
    icon: '🔬',
    themeColor: '#ff9600',
    lipColor: '#cc7800',
    keywords:
      /\b(science|scientific|scientist|research|theory|hypothesis|experiment|laboratory|evidence|empirical|method|methodology|analysis|analyze|evaluate|assess|factor|variable|correlation|consequence|phenomenon|inevitable|crucial|significant|substantial|comprehensive|plausible|ambiguous)\b/i,
    guidebook: {
      tipTitleTr: 'Akademik Nedensellik ve Kesinlik Dereceleri',
      tipTitleEn: 'Academic Causality & Hedging',
      tipBodyTr:
        'Bilimsel İngilizcede aşırı kesin iddialardan kaçınmak için "plausible" (makul/olası), "empirical evidence" (deneysel kanıt) ve "correlate with" (ile ilişkili olmak) gibi nüanslı ifadeler tercih edilir.',
      tipBodyEn:
        'Academic writing relies on precise adjectives like "plausible", "substantial", "ambiguous", and "empirical".',
      keyPhrases: [
        {
          en: 'The researchers found a strong correlation between sleep quality and memory retention.',
          tr: 'Araştırmacılar uyku kalitesi ile hafızada tutma arasında güçlü bir korelasyon buldu.',
          noteTr: '"correlation between A and B" iki değişken arasındaki ilişkidir.',
          noteEn: 'Pattern: "correlation between A and B".',
        },
      ],
    },
    nodes: makeStandardNodes('Bilim & Araştırma', 'Science & Research'),
  },
  {
    id: 'u20_law_philosophy',
    unitNumber: 20,
    sectionNumber: 5,
    sectionTitleTr: '5. KISIM · C1 Akademik ve İleri Ustalaşma',
    sectionTitleEn: 'SECTION 5 · C1 Academic & Advanced Mastery',
    level: 'C1',
    titleTr: 'Hukuk, Etik ve İleri Soyut Kavramlar',
    titleEn: 'Law, Ethics & Advanced Nuance',
    subtitleTr: 'C1 seviyesindeki soyut sıfatları, hukuki kavramları ve felsefi ayrımları fethet',
    subtitleEn: 'Conquer C1 abstract vocabulary, legal principles, and philosophical nuance',
    icon: '⚖️',
    themeColor: '#ff4b4b',
    lipColor: '#ea2b2b',
    keywords:
      /\b(law|legal|court|judge|trial|justice|crime|guilty|innocent|verdict|constitution|policy|regulation|rights|freedom|ethics|moral|integrity|dilemma|conscience|ubiquitous|ephemeral|pragmatic|Eloquent|resilient|scrutiny|precedent|jurisdiction|accountability|autonomy)\b/i,
    guidebook: {
      tipTitleTr: 'C1 Soyut Kelimeler ve Hukuki İfadeler',
      tipTitleEn: 'C1 Abstract Vocabulary & Legal Terms',
      tipBodyTr:
        '"Ubiquitous" (her yerde bulunan), "pragmatic" (pragmatik/sonuç odaklı), "scrutiny" (titiz inceleme/denetim) ve "accountability" (hesap verebilirlik) C1 seviyesinin en güçlü kelimelerindendir.',
      tipBodyEn:
        'Words like "ubiquitous", "scrutiny", "precedent", and "accountability" distinguish advanced C1 fluency.',
      keyPhrases: [
        {
          en: 'Public officials must act with transparency and accountability at all times.',
          tr: 'Kamu görevlileri her zaman şeffaflık ve hesap verebilirlikle hareket etmelidir.',
          noteTr: '"accountability" sorumluluk ve hesap verebilirlik demektir.',
          noteEn: '"accountability" means responsibility for one’s actions.',
        },
      ],
    },
    nodes: makeStandardNodes('Hukuk & İleri Kavramlar', 'Law & C1 Nuance'),
  },
];

export function getLocalDateKey(now: number = Date.now()): string {
  const d = new Date(now);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const STEPS_PER_NODE = 3;

export function createInitialRoadmapState(now: number = Date.now()): RoadmapState {
  return {
    xp: 0,
    dailyXp: 0,
    dailyXpGoal: 30,
    dailyLessonsCompleted: 0,
    lastDailyDate: getLocalDateKey(now),
    activeUnitId: CURRICULUM_UNITS[0]!.id,
    focusUnitOnly: false,
    completedNodeIds: [],
    nodeStepProgress: {},
    claimedChestUnitIds: [],
    unlockedUnitIds: [CURRICULUM_UNITS[0]!.id],
    unitCrownLevels: {},
  };
}

export function normalizeRoadmapState(
  raw: Partial<RoadmapState> | null | undefined,
  now: number = Date.now()
): RoadmapState {
  const base = createInitialRoadmapState(now);
  if (!raw) return base;
  const today = getLocalDateKey(now);
  const isSameDay = raw.lastDailyDate === today;

  const rawXp = typeof raw.xp === 'number' ? Math.max(0, raw.xp) : 0;
  let completedNodeIds = Array.isArray(raw.completedNodeIds)
    ? [...new Set(raw.completedNodeIds)]
    : [];
  let unlockedUnitIds = Array.isArray(raw.unlockedUnitIds)
    ? [...new Set(raw.unlockedUnitIds)]
    : [CURRICULUM_UNITS[0]!.id];
  let activeUnitId =
    typeof raw.activeUnitId === 'string' && CURRICULUM_UNITS.some((u) => u.id === raw.activeUnitId)
      ? raw.activeUnitId
      : CURRICULUM_UNITS[0]!.id;
  let unitCrownLevels =
    raw.unitCrownLevels && typeof raw.unitCrownLevels === 'object'
      ? { ...raw.unitCrownLevels }
      : {};

  // Auto-repair if accidental "Sync to B2" mass-unlocked 20+ nodes without matching XP
  if (completedNodeIds.length >= 20 && rawXp < 450) {
    const firstUnitId = CURRICULUM_UNITS[0]!.id;
    const earnedNodesCount = Math.min(4, Math.max(0, Math.floor(rawXp / 20)));
    completedNodeIds = [];
    for (let i = 0; i < earnedNodesCount; i += 1) {
      completedNodeIds.push(`${firstUnitId}:${i}`);
    }
    unlockedUnitIds = [firstUnitId];
    activeUnitId = firstUnitId;
    unitCrownLevels = {};
  }

  const unlocked = new Set<string>(unlockedUnitIds);
  unlocked.add(CURRICULUM_UNITS[0]!.id);

  return {
    xp: rawXp,
    dailyXp: isSameDay && typeof raw.dailyXp === 'number' ? Math.max(0, raw.dailyXp) : 0,
    dailyXpGoal: typeof raw.dailyXpGoal === 'number' && raw.dailyXpGoal > 0 ? raw.dailyXpGoal : 30,
    dailyLessonsCompleted:
      isSameDay && typeof raw.dailyLessonsCompleted === 'number'
        ? Math.max(0, raw.dailyLessonsCompleted)
        : 0,
    lastDailyDate: today,
    activeUnitId,
    focusUnitOnly: Boolean(raw.focusUnitOnly),
    completedNodeIds,
    nodeStepProgress:
      raw.nodeStepProgress && typeof raw.nodeStepProgress === 'object'
        ? { ...raw.nodeStepProgress }
        : {},
    claimedChestUnitIds: Array.isArray(raw.claimedChestUnitIds)
      ? [...new Set(raw.claimedChestUnitIds)]
      : [],
    unlockedUnitIds: [...unlocked],
    unitCrownLevels,
  };
}

export function getUnitById(unitId: string): CurriculumUnit {
  return CURRICULUM_UNITS.find((u) => u.id === unitId) ?? CURRICULUM_UNITS[0]!;
}

/**
 * Retrieve the thematic card pool for a given CurriculumUnit.
 * Priority 1: Explicit `card.unitId === unit.id`
 * Priority 2: Cards matching `unit.keywords` at the unit's CEFR level
 * Priority 3: Cards matching `unit.keywords` at adjacent CEFR levels
 * Priority 4: Level fallback so a unit never has fewer than 24 cards
 */
export function getCardsForUnit(unitId: string, allCards: Card[]): Card[] {
  const unit = getUnitById(unitId);
  const seen = new Set<string>();
  const result: Card[] = [];

  const pushUnique = (c: Card): void => {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      result.push(c);
    }
  };

  for (const c of allCards) {
    if (c.unitId === unit.id) {
      pushUnique(c);
    }
  }

  for (const c of allCards) {
    if (c.level === unit.level && unit.keywords.test(`${c.en} ${c.exampleEn}`)) {
      pushUnique(c);
    }
  }

  if (result.length < 75) {
    for (const c of allCards) {
      if (unit.keywords.test(`${c.en} ${c.exampleEn}`)) {
        pushUnique(c);
        if (result.length >= 130) break;
      }
    }
  }

  if (result.length < 60) {
    for (const c of allCards) {
      if (c.level === unit.level) {
        pushUnique(c);
        if (result.length >= 90) break;
      }
    }
  }

  return result;
}

export interface ComputedNodeState {
  unitId: string;
  node: UnitNodeDefinition;
  nodeKey: string;
  status: 'completed' | 'active' | 'locked';
  completedSteps: number;
  totalSteps: number;
}

export interface ComputedUnitProgress {
  unit: CurriculumUnit;
  isUnlocked: boolean;
  isCompleted: boolean;
  crownLevel: number;
  completedNodesCount: number;
  totalNodesCount: number;
  chestUnlocked: boolean;
  chestClaimed: boolean;
  nodes: ComputedNodeState[];
  totalUnitCards: number;
  masteredUnitCards: number;
}

/**
 * Compute full Roadmap path state for all 20 units, combining explicit lesson node completions
 * with existing SRS card mastery so users who already answered cards see real progress too.
 */
export function computeRoadmapProgress(
  state: RoadmapState,
  allCards: Card[],
  progressMap: Record<string, UserCardProgress>
): ComputedUnitProgress[] {
  const completedSet = new Set(state.completedNodeIds);
  const unlockedSet = new Set(state.unlockedUnitIds);
  const chestSet = new Set(state.claimedChestUnitIds);
  unlockedSet.add(CURRICULUM_UNITS[0]!.id);

  // Cascade unlock: if previous unit has all 5 nodes completed, unlock the next unit
  for (let i = 0; i < CURRICULUM_UNITS.length; i += 1) {
    const u = CURRICULUM_UNITS[i]!;
    const allNodesDone = u.nodes.every((n) => completedSet.has(`${u.id}:${n.index}`));
    if (allNodesDone && i + 1 < CURRICULUM_UNITS.length) {
      unlockedSet.add(CURRICULUM_UNITS[i + 1]!.id);
    }
  }

  return CURRICULUM_UNITS.map((unit) => {
    const unitCards = getCardsForUnit(unit.id, allCards);
    let masteredUnitCards = 0;
    for (const c of unitCards) {
      const p = progressMap[c.id];
      if (p && (p.streak >= 2 || p.totalCorrect >= 2)) {
        masteredUnitCards += 1;
      }
    }

    const isUnlocked = unlockedSet.has(unit.id);
    let foundFirstIncomplete = false;

    const nodes: ComputedNodeState[] = unit.nodes.map((node) => {
      const nodeKey = `${unit.id}:${node.index}`;
      const isDone = completedSet.has(nodeKey);
      const rawSteps = state.nodeStepProgress?.[nodeKey] ?? 0;
      if (isDone) {
        return {
          unitId: unit.id,
          node,
          nodeKey,
          status: 'completed',
          completedSteps: STEPS_PER_NODE,
          totalSteps: STEPS_PER_NODE,
        };
      }
      if (isUnlocked && !foundFirstIncomplete) {
        foundFirstIncomplete = true;
        return {
          unitId: unit.id,
          node,
          nodeKey,
          status: 'active',
          completedSteps: Math.min(STEPS_PER_NODE - 1, Math.max(0, rawSteps)),
          totalSteps: STEPS_PER_NODE,
        };
      }
      return {
        unitId: unit.id,
        node,
        nodeKey,
        status: 'locked',
        completedSteps: 0,
        totalSteps: STEPS_PER_NODE,
      };
    });

    const completedNodesCount = nodes.filter((n) => n.status === 'completed').length;
    const isCompleted = completedNodesCount === unit.nodes.length;
    const chestUnlocked = completedNodesCount >= 3;
    const chestClaimed = chestSet.has(unit.id);
    const crownLevel = state.unitCrownLevels[unit.id] ?? (isCompleted ? 1 : 0);

    return {
      unit,
      isUnlocked,
      isCompleted,
      crownLevel,
      completedNodesCount,
      totalNodesCount: unit.nodes.length,
      chestUnlocked,
      chestClaimed,
      nodes,
      totalUnitCards: unitCards.length,
      masteredUnitCards,
    };
  });
}

/**
 * Record completion of a roadmap node (or a "BURAYA ATLA!" unit jump test)
 * and return the updated `RoadmapState` along with XP awarded.
 */
export function completeRoadmapNode(
  state: RoadmapState,
  unitId: string,
  nodeIndex: number | 'jump_test',
  bonusXp: number = 0,
  now: number = Date.now()
): { nextState: RoadmapState; xpEarned: number; unitJustCompleted: boolean } {
  const normalized = normalizeRoadmapState(state, now);
  const unitIdx = CURRICULUM_UNITS.findIndex((u) => u.id === unitId);
  const unit = CURRICULUM_UNITS[unitIdx] ?? CURRICULUM_UNITS[0]!;

  const completedSet = new Set(normalized.completedNodeIds);
  const unlockedSet = new Set(normalized.unlockedUnitIds);
  const chestSet = new Set(normalized.claimedChestUnitIds);
  const crowns = { ...normalized.unitCrownLevels };

  let baseXp = 15;

  if (nodeIndex === 'jump_test') {
    baseXp = 40;
    // Unlock this unit and mark all earlier units unlocked
    for (let i = 0; i <= unitIdx; i += 1) {
      unlockedSet.add(CURRICULUM_UNITS[i]!.id);
    }
    completedSet.add(`${unit.id}:0`);
  } else {
    const nodeDef = unit.nodes[nodeIndex];
    baseXp = nodeDef?.xpReward ?? 15;
    completedSet.add(`${unit.id}:${nodeIndex}`);
    unlockedSet.add(unit.id);
  }

  // Auto-claim chest (+25 XP) when node 2 (3rd node) is completed
  const completedCountAfter = unit.nodes.filter((n) =>
    completedSet.has(`${unit.id}:${n.index}`)
  ).length;
  let chestBonus = 0;
  if (completedCountAfter >= 3 && !chestSet.has(unit.id)) {
    chestSet.add(unit.id);
    chestBonus = 25;
  }

  const allDone = completedCountAfter === unit.nodes.length;
  let nextActiveUnitId = unit.id;
  if (allDone) {
    crowns[unit.id] = Math.max(1, (crowns[unit.id] ?? 0) + 1);
    if (unitIdx + 1 < CURRICULUM_UNITS.length) {
      const nextUnit = CURRICULUM_UNITS[unitIdx + 1]!;
      unlockedSet.add(nextUnit.id);
      nextActiveUnitId = nextUnit.id;
    }
  }

  const xpEarned = baseXp + chestBonus + Math.max(0, bonusXp);
  const nextStepMap = { ...normalized.nodeStepProgress };
  if (typeof nodeIndex === 'number') {
    nextStepMap[`${unit.id}:${nodeIndex}`] = STEPS_PER_NODE;
  } else {
    nextStepMap[`${unit.id}:0`] = STEPS_PER_NODE;
  }

  return {
    xpEarned,
    unitJustCompleted: allDone,
    nextState: {
      ...normalized,
      xp: normalized.xp + xpEarned,
      dailyXp: normalized.dailyXp + xpEarned,
      dailyLessonsCompleted: normalized.dailyLessonsCompleted + 1,
      activeUnitId: nextActiveUnitId,
      completedNodeIds: [...completedSet],
      nodeStepProgress: nextStepMap,
      claimedChestUnitIds: [...chestSet],
      unlockedUnitIds: [...unlockedSet],
      unitCrownLevels: crowns,
    },
  };
}

/**
 * Advance a single step (`1/3 -> 2/3 -> 3/3`) within a roadmap node.
 * On the 3rd step (`3/3`), the node itself is marked completed and the next node unlocks.
 */
export function completeRoadmapNodeStep(
  state: RoadmapState,
  unitId: string,
  nodeIndex: number | 'jump_test',
  bonusXp: number = 0,
  now: number = Date.now()
): {
  nextState: RoadmapState;
  xpEarned: number;
  completedSteps: number;
  totalSteps: number;
  nodeJustCompleted: boolean;
  unitJustCompleted: boolean;
} {
  const normalized = normalizeRoadmapState(state, now);
  if (nodeIndex === 'jump_test') {
    const res = completeRoadmapNode(normalized, unitId, 'jump_test', bonusXp, now);
    return {
      ...res,
      completedSteps: 1,
      totalSteps: 1,
      nodeJustCompleted: true,
    };
  }

  const unit = getUnitById(unitId);
  const nodeKey = `${unit.id}:${nodeIndex}`;
  const alreadyDone = normalized.completedNodeIds.includes(nodeKey);
  const prevSteps = alreadyDone ? STEPS_PER_NODE : (normalized.nodeStepProgress[nodeKey] ?? 0);
  const nextSteps = alreadyDone ? STEPS_PER_NODE : Math.min(STEPS_PER_NODE, prevSteps + 1);

  if (!alreadyDone && nextSteps < STEPS_PER_NODE) {
    const stepXp = 10 + Math.max(0, bonusXp);
    const nextStepMap = {
      ...normalized.nodeStepProgress,
      [nodeKey]: nextSteps,
    };
    const unlockedSet = new Set(normalized.unlockedUnitIds);
    unlockedSet.add(unit.id);

    return {
      xpEarned: stepXp,
      completedSteps: nextSteps,
      totalSteps: STEPS_PER_NODE,
      nodeJustCompleted: false,
      unitJustCompleted: false,
      nextState: {
        ...normalized,
        xp: normalized.xp + stepXp,
        dailyXp: normalized.dailyXp + stepXp,
        dailyLessonsCompleted: normalized.dailyLessonsCompleted + 1,
        activeUnitId: unit.id,
        nodeStepProgress: nextStepMap,
        unlockedUnitIds: [...unlockedSet],
      },
    };
  }

  const fullRes = completeRoadmapNode(normalized, unit.id, nodeIndex, bonusXp, now);
  return {
    ...fullRes,
    completedSteps: STEPS_PER_NODE,
    totalSteps: STEPS_PER_NODE,
    nodeJustCompleted: true,
  };
}

/**
 * Compute the user's independent Roadmap Course Level (separate from 20-min Recall Elo).
 */
export function getRoadmapCourseRank(state: RoadmapState): {
  courseLevel: CefrLevel;
  highestUnlockedUnit: CurriculumUnit;
  completedNodesCount: number;
  totalNodesCount: number;
} {
  const unlockedSet = new Set(state.unlockedUnitIds);
  let highestUnit = CURRICULUM_UNITS[0]!;
  for (const u of CURRICULUM_UNITS) {
    if (unlockedSet.has(u.id)) {
      highestUnit = u;
    }
  }
  const totalNodesCount = CURRICULUM_UNITS.reduce((acc, u) => acc + u.nodes.length, 0);
  return {
    courseLevel: highestUnit.level,
    highestUnlockedUnit: highestUnit,
    completedNodesCount: state.completedNodeIds.length,
    totalNodesCount,
  };
}

function deterministicShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed || 1;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

function cleanToken(w: string): string {
  return w.replace(/^[.,!?;:"'()[\]]+|[.,!?;:"'()[\]]+$/g, '').trim();
}

/**
 * Build a scaffolded lesson for a given Unit, Node (`0..4`), and Step (`0..2`)!
 * Uses disjoint cohort slicing across the 15 steps of a unit (`slot = nodeIndex * 3 + stepIndex`)
 * so every step introduces fresh vocabulary/sentences while weaving in 1-2 spiral reviews from
 * earlier steps in a different exercise format.
 */
export function buildUnitLessonExercises(
  unitId: string,
  nodeIndex: number | 'jump_test',
  allCards: Card[],
  progressMap: Record<string, UserCardProgress>,
  seed: number = Date.now(),
  stepIndex: number = 0
): LessonExercise[] {
  const unit = getUnitById(unitId);
  const unitCards = getCardsForUnit(unit.id, allCards);
  const unitSeed = hashString(unit.id);

  // Separate pure word cards and pure sentence cards first so w() and s() do not collide on the same card
  const rawWords = unitCards.filter((c) => c.type === 'word');
  const rawPureSentences = unitCards.filter((c) => c.type === 'sentence');
  const wordsWithExamples = rawWords.filter(
    (c) => c.exampleEn && c.exampleEn.trim().split(/\s+/).length >= 4
  );

  // Deterministic unit-level ordering (explicit unitId cards distributed evenly with thematic matches)
  const explicitWords = deterministicShuffle(
    rawWords.filter((c) => c.unitId === unit.id),
    unitSeed
  );
  const extraWords = deterministicShuffle(
    rawWords.filter((c) => c.unitId !== unit.id),
    unitSeed + 101
  );
  const orderedWords: Card[] = [];
  const maxW = Math.max(explicitWords.length, extraWords.length);
  for (let i = 0; i < maxW; i += 1) {
    if (i < explicitWords.length) orderedWords.push(explicitWords[i]!);
    if (i < extraWords.length) orderedWords.push(extraWords[i]!);
  }

  const explicitSents = deterministicShuffle(
    rawPureSentences.filter((c) => c.unitId === unit.id),
    unitSeed + 202
  );
  const extraSents = deterministicShuffle(
    rawPureSentences.filter((c) => c.unitId !== unit.id),
    unitSeed + 303
  );
  // Interleave pure sentences with example-bearing words (offset by half the pool so they never collide with current step's words)
  const shiftedExampleWords = deterministicShuffle(wordsWithExamples, unitSeed + 404);
  const orderedSentences: Card[] = [...explicitSents, ...extraSents, ...shiftedExampleWords];

  const distractorPoolTrWords = (rawWords.length >= 4 ? rawWords : allCards.filter((c) => c.type === 'word'))
    .map((c) => c.acceptedTr[0] ?? '')
    .filter((t) => t.length > 0);
  const unitPureSentTr = rawPureSentences
    .map((c) => c.acceptedTr[0] ?? '')
    .filter((t) => t.length > 0);
  const distractorPoolTrSentences =
    unitPureSentTr.length >= 4
      ? unitPureSentTr
      : allCards
          .filter((c) => c.type === 'sentence' && (c.acceptedTr[0] ?? '').length > 0)
          .slice(0, 40)
          .map((c) => c.acceptedTr[0] ?? '');

  const distractorPoolEnWords = rawWords.map((c) => c.en).filter((t) => t.length > 1);
  const unitPureSentEn = rawPureSentences.map((c) => c.en).filter((t) => t.length > 1);
  const distractorPoolEnSentences =
    unitPureSentEn.length >= 4
      ? unitPureSentEn
      : allCards
          .filter((c) => c.type === 'sentence' && c.en.length > 1)
          .slice(0, 40)
          .map((c) => c.en);

  const distractorPoolTrTokens = unitCards
    .flatMap((c) => (c.acceptedTr[0] ?? '').split(/\s+/))
    .map((t) => cleanToken(t))
    .filter((t) => t.length >= 2);

  const pickDistractors = (correct: string, pool: string[], count: number, s: number): string[] => {
    const normCorrect = correct.trim().toLowerCase();
    const candidates = deterministicShuffle(
      [...new Set(pool.filter((x) => x.trim().toLowerCase() !== normCorrect))],
      s
    );
    return candidates.slice(0, count);
  };

  const cardsShareMeaning = (a: Card, b: Card): boolean => {
    const aSet = new Set(a.acceptedTr.map((t) => t.trim().toLowerCase()));
    return b.acceptedTr.some((t) => aSet.has(t.trim().toLowerCase()));
  };

  const makeSelectMeaning = (card: Card, idx: number, isReview = false): LessonExercise => {
    const correct = card.acceptedTr[0] ?? '';
    let trPool: string[];
    if (card.type === 'sentence') {
      trPool = distractorPoolTrSentences;
    } else {
      const samePosTr = rawWords
        .filter((c) => c.id !== card.id && c.pos === card.pos && !cardsShareMeaning(card, c))
        .map((c) => c.acceptedTr[0] ?? '')
        .filter((t) => t.length > 0);
      trPool =
        samePosTr.length >= 4
          ? samePosTr
          : rawWords
              .filter((c) => c.id !== card.id && !cardsShareMeaning(card, c))
              .map((c) => c.acceptedTr[0] ?? '')
              .filter((t) => t.length > 0);
      if (trPool.length < 3) trPool = distractorPoolTrWords;
    }
    const distractors = pickDistractors(correct, trPool, 3, seed + idx * 13);
    const choices = deterministicShuffle([correct, ...distractors], seed + idx * 17);
    return {
      id: `ex_${unit.id}_${idx}_sel_tr`,
      kind: 'select_meaning',
      card,
      isNewWord: !isReview && !progressMap[card.id],
      promptText: card.en,
      promptSubtext: card.phonetic || (card.exampleEn ? `"${card.exampleEn}"` : ''),
      audioText: card.en,
      choices,
      correctChoice: correct,
      expectedAnswers: card.acceptedTr,
      direction: 'en-to-tr',
    };
  };

  const makeSelectEn = (card: Card, idx: number, isReview = false): LessonExercise => {
    const correct = card.en;
    let pool: string[];
    if (card.type === 'sentence') {
      pool = distractorPoolEnSentences;
    } else {
      const samePosEn = rawWords
        .filter((c) => c.id !== card.id && c.pos === card.pos && !cardsShareMeaning(card, c))
        .map((c) => c.en)
        .filter((t) => t.length > 1);
      const unitWordEn = rawWords
        .filter((c) => c.id !== card.id && !cardsShareMeaning(card, c))
        .map((c) => c.en)
        .filter((t) => t.length > 1);
      pool =
        samePosEn.length >= 4
          ? samePosEn
          : unitWordEn.length >= 4
            ? unitWordEn
            : distractorPoolEnWords.length >= 4
              ? distractorPoolEnWords
              : allCards.filter((c) => c.type === 'word').slice(0, 40).map((c) => c.en);
    }
    const distractors = pickDistractors(correct, pool, 3, seed + idx * 19);
    const choices = deterministicShuffle([correct, ...distractors], seed + idx * 23);
    const promptText = card.acceptedTr[0] ?? card.exampleTr ?? '';
    return {
      id: `ex_${unit.id}_${idx}_sel_en`,
      kind: 'select_en',
      card,
      isNewWord: !isReview && !progressMap[card.id],
      promptText,
      promptSubtext: '',
      postAnswerSubtext: card.exampleTr || undefined,
      audioText: card.en,
      choices,
      correctChoice: correct,
      expectedAnswers: [card.en],
      direction: 'tr-to-en',
    };
  };

  const makeClozeBlank = (card: Card, idx: number): LessonExercise => {
    const sentenceEn = card.exampleEn && card.exampleEn.length >= 10 ? card.exampleEn : card.en;
    const sentenceTr =
      card.exampleTr && card.exampleTr.length >= 5
        ? card.exampleTr
        : (card.acceptedTr[0] ?? '');

    const rawTokens = sentenceEn.split(/\s+/);
    let targetWord = card.type === 'word' ? card.en : '';
    let maskedSentence = sentenceEn;

    const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = targetWord ? new RegExp(`\\b${escaped}[a-z]*\\b`, 'i') : null;
    const match = regex ? sentenceEn.match(regex) : null;

    if (match && match[0]) {
      targetWord = cleanToken(match[0]);
      maskedSentence = sentenceEn.replace(regex!, '_______');
    } else {
      const contentWords = rawTokens
        .map((t, i) => ({ clean: cleanToken(t), index: i }))
        .filter((x) => x.clean.length >= 4);
      const chosen = contentWords[idx % Math.max(1, contentWords.length)] ?? {
        clean: cleanToken(rawTokens[0] ?? card.en),
        index: 0,
      };
      targetWord = chosen.clean;
      maskedSentence = rawTokens
        .map((t, i) => (i === chosen.index ? '_______' : t))
        .join(' ');
    }

    const distractors = pickDistractors(
      targetWord,
      distractorPoolEnWords.length >= 4
        ? distractorPoolEnWords
        : ['always', 'careful', 'wildlife', 'stadium'],
      3,
      seed + idx * 29
    );
    const choices = deterministicShuffle([targetWord, ...distractors], seed + idx * 31);

    return {
      id: `ex_${unit.id}_${idx}_cloze`,
      kind: 'cloze_blank',
      card,
      isNewWord: false,
      promptText: maskedSentence,
      promptSubtext: '',
      postAnswerSubtext: sentenceTr,
      audioText: sentenceEn,
      choices,
      correctChoice: targetWord,
      expectedAnswers: [targetWord],
      direction: 'tr-to-en',
    };
  };

  const makeWordBank = (card: Card, idx: number, enToTr = false): LessonExercise => {
    const sentenceEn =
      card.type === 'sentence'
        ? card.en
        : card.exampleEn && card.exampleEn.trim().length >= 10
          ? card.exampleEn
          : card.en;
    const sentenceTr =
      card.type === 'sentence'
        ? (card.acceptedTr[0] ?? '')
        : card.exampleTr || (card.acceptedTr[0] ?? '');

    const trTokens = sentenceTr
      .split(/\s+/)
      .map((t) => cleanToken(t))
      .filter(Boolean);

    if (enToTr && trTokens.length >= 3) {
      const extraTr = pickDistractors(
        trTokens[0] ?? '',
        ['her', 'zaman', 'çok', 'dün', 'birlikte', 'hemen', 'için', ...distractorPoolTrTokens],
        3,
        seed + idx * 35
      ).filter((w) => !trTokens.some((t) => t.toLowerCase() === w.toLowerCase()));

      const wordBankTiles = deterministicShuffle(
        [...trTokens, ...extraTr.slice(0, 3)],
        seed + idx * 39
      );

      return {
        id: `ex_${unit.id}_${idx}_wb_tr`,
        kind: 'word_bank',
        card,
        isNewWord: false,
        promptText: sentenceEn,
        promptSubtext: 'Cümleyi Türkçeye çevir',
        audioText: sentenceEn,
        wordBankTiles,
        targetTokens: trTokens,
        expectedAnswers: [trTokens.join(' '), sentenceTr],
        direction: 'en-to-tr',
      };
    }

    const targetTokens = sentenceEn
      .split(/\s+/)
      .map((t) => cleanToken(t))
      .filter(Boolean);

    const extraTiles = pickDistractors(
      targetTokens[0] ?? '',
      ['always', 'never', 'quickly', 'under', 'their', 'before', 'around', 'while', ...distractorPoolEnWords],
      3,
      seed + idx * 37
    ).filter((w) => !targetTokens.some((t) => t.toLowerCase() === w.toLowerCase()));

    const wordBankTiles = deterministicShuffle(
      [...targetTokens, ...extraTiles.slice(0, 3)],
      seed + idx * 41
    );

    return {
      id: `ex_${unit.id}_${idx}_wb`,
      kind: 'word_bank',
      card,
      isNewWord: false,
      promptText: sentenceTr,
      promptSubtext: 'Cümleyi İngilizceye çevir',
      audioText: sentenceEn,
      wordBankTiles,
      targetTokens,
      expectedAnswers: [targetTokens.join(' '), sentenceEn],
      direction: 'tr-to-en',
    };
  };

  const makeAudioDictation = (card: Card, idx: number): LessonExercise => {
    const sentenceEn =
      card.type === 'sentence'
        ? card.en
        : card.exampleEn && card.exampleEn.trim().length >= 10
          ? card.exampleEn
          : card.en;
    const meaningTr =
      card.type === 'sentence'
        ? (card.acceptedTr[0] ?? '')
        : card.exampleTr || (card.acceptedTr[0] ?? '');

    const targetTokens = sentenceEn
      .split(/\s+/)
      .map((t) => cleanToken(t))
      .filter(Boolean);

    const extraTiles = pickDistractors(
      targetTokens[0] ?? '',
      ['the', 'into', 'from', 'often', 'very', ...distractorPoolEnWords],
      3,
      seed + idx * 43
    ).filter((w) => !targetTokens.some((t) => t.toLowerCase() === w.toLowerCase()));

    const wordBankTiles = deterministicShuffle(
      [...targetTokens, ...extraTiles.slice(0, 2)],
      seed + idx * 47
    );

    return {
      id: `ex_${unit.id}_${idx}_audio`,
      kind: 'audio_dictation',
      card,
      isNewWord: false,
      promptText: sentenceEn,
      promptSubtext: meaningTr,
      audioText: sentenceEn,
      wordBankTiles,
      targetTokens,
      expectedAnswers: [sentenceEn, targetTokens.join(' ')],
      direction: 'en-audio',
    };
  };

  const makeFreeTranslation = (card: Card, idx: number, trToEn = false): LessonExercise => {
    if (trToEn) {
      const trPrompt = card.acceptedTr[0] ?? card.exampleTr ?? '';
      return {
        id: `ex_${unit.id}_${idx}_free_en`,
        kind: 'free_translation',
        card,
        isNewWord: false,
        promptText: trPrompt || card.en,
        promptSubtext: card.type === 'word' && card.exampleTr ? `"${card.exampleTr}"` : '',
        audioText: card.en,
        expectedAnswers: [card.en],
        direction: 'tr-to-en',
      };
    }

    return {
      id: `ex_${unit.id}_${idx}_free`,
      kind: 'free_translation',
      card,
      isNewWord: false,
      promptText: card.en,
      promptSubtext: card.phonetic || '',
      audioText: card.en,
      expectedAnswers: card.acceptedTr,
      direction: 'en-to-tr',
    };
  };

  // Compute unique lesson slot (0..14 across 5 nodes x 3 steps) so every step has a fresh cohort!
  const numericNode = typeof nodeIndex === 'number' ? nodeIndex : 4;
  const safeStep = Math.max(0, Math.min(2, stepIndex));
  const lessonSlot = nodeIndex === 'jump_test' ? 14 : numericNode * STEPS_PER_NODE + safeStep;

  const wordBaseOffset = lessonSlot * 4;
  const sentBaseOffset = lessonSlot * 3;
  const usedIdsInStep = new Set<string>();

  const pickFreshWord = (offset: number): Card => {
    const pool = orderedWords.length > 0 ? orderedWords : orderedSentences;
    for (let probe = 0; probe < pool.length; probe += 1) {
      const candidate = pool[(wordBaseOffset + offset + probe) % pool.length]!;
      if (!usedIdsInStep.has(candidate.id)) {
        usedIdsInStep.add(candidate.id);
        return candidate;
      }
    }
    return pool[(wordBaseOffset + offset) % pool.length]!;
  };

  const pickFreshSentence = (offset: number): Card => {
    const pool = orderedSentences.length > 0 ? orderedSentences : orderedWords;
    for (let probe = 0; probe < pool.length; probe += 1) {
      const candidate = pool[(sentBaseOffset + offset + probe) % pool.length]!;
      if (!usedIdsInStep.has(candidate.id)) {
        usedIdsInStep.add(candidate.id);
        return candidate;
      }
    }
    return pool[(sentBaseOffset + offset) % pool.length]!;
  };

  // Pick a Spiral Review card from an earlier step in this unit (or a weak card with errors)
  const pickSpiralReviewWord = (reviewOffset: number): Card => {
    const missedCards = unitCards.filter((c) => (progressMap[c.id]?.totalWrong ?? 0) > 0 && !usedIdsInStep.has(c.id));
    if (missedCards.length > 0) {
      const chosen = missedCards[reviewOffset % missedCards.length]!;
      usedIdsInStep.add(chosen.id);
      return chosen;
    }
    if (lessonSlot > 0 && orderedWords.length > 0) {
      const prevSlot = Math.max(0, lessonSlot - 1 - (reviewOffset % Math.max(1, lessonSlot)));
      const prevIdx = (prevSlot * 4 + reviewOffset) % orderedWords.length;
      const candidate = orderedWords[prevIdx]!;
      if (!usedIdsInStep.has(candidate.id)) {
        usedIdsInStep.add(candidate.id);
        return candidate;
      }
    }
    return pickFreshWord(reviewOffset + 3);
  };

  const nw0 = pickFreshWord(0);
  const nw1 = pickFreshWord(1);
  const nw2 = pickFreshWord(2);
  const ns0 = pickFreshSentence(0);
  const ns1 = pickFreshSentence(1);
  const ns2 = pickFreshSentence(2);
  const rev0 = lessonSlot > 0 ? pickSpiralReviewWord(0) : pickFreshWord(3);

  if (nodeIndex === 0) {
    // Node 0: Word Discovery (3 steps: each step introduces 3 new words + 2 sentences + 1 spiral review + 1 scaffolded revisit)
    return [
      makeSelectMeaning(nw0, 0),
      makeSelectMeaning(nw1, 1),
      makeSelectEn(nw2, 2),
      makeWordBank(ns0, 3, safeStep % 2 === 1),
      makeClozeBlank(nw0, 4), // Scaffolded revisit of nw0 in sentence context!
      makeSelectEn(rev0, 5, lessonSlot > 0),
      makeWordBank(ns1, 6, safeStep % 2 === 0),
      makeFreeTranslation(nw1, 7),
    ];
  }

  if (nodeIndex === 1) {
    // Node 1: Context & Sentence Builder (Both EN->TR and TR->EN Word Banks + Cloze + Spiral Review)
    return [
      makeSelectMeaning(nw0, 0),
      makeClozeBlank(nw1, 1),
      makeWordBank(ns0, 2, true), // EN -> TR Word Bank
      makeClozeBlank(rev0, 3), // Spiral review from Node 0!
      makeWordBank(ns1, 4, false), // TR -> EN Word Bank
      makeSelectEn(nw2, 5),
      makeWordBank(ns2, 6, safeStep % 2 === 1),
      makeFreeTranslation(ns0, 7),
    ];
  }

  if (nodeIndex === 2) {
    // Node 2: Duo Radio & Audio Dictation (Varied listening + context + spiral review)
    const ns3 = pickFreshSentence(3);
    return [
      makeAudioDictation(nw0, 0),
      makeSelectMeaning(nw1, 1),
      makeAudioDictation(ns0, 2),
      makeWordBank(ns1, 3, true),
      makeAudioDictation(ns2, 4),
      makeClozeBlank(rev0, 5), // Spiral review from earlier steps
      makeAudioDictation(ns3, 6),
      makeFreeTranslation(nw2, 7),
    ];
  }

  if (nodeIndex === 3) {
    // Node 3: Weak-Point & Spiral Drill
    const rev1 = pickSpiralReviewWord(1);
    return [
      makeSelectEn(nw0, 0),
      makeClozeBlank(rev0, 1),
      makeWordBank(ns0, 2, false),
      makeAudioDictation(ns1, 3),
      makeWordBank(ns2, 4, true),
      makeClozeBlank(rev1, 5),
      makeFreeTranslation(nw1, 6, true),
      makeFreeTranslation(ns0, 7),
    ];
  }

  // Node 4 (Unit Mastery Crown) or 'jump_test' (BURAYA ATLA!)
  const rev1 = pickSpiralReviewWord(1);
  return [
    makeSelectMeaning(nw0, 0),
    makeSelectEn(nw1, 1),
    makeClozeBlank(rev0, 2),
    makeWordBank(ns0, 3, true),
    makeAudioDictation(ns1, 4),
    makeWordBank(ns2, 5, false),
    makeFreeTranslation(rev1, 6),
    makeFreeTranslation(nw2, 7, true),
  ];
}
