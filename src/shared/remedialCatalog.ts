import type {
  RemedialBriefing,
  WeakSkillId,
} from './types';

export interface ContrastDuelTemplate {
  promptSentence: string;
  promptSubtextTr: string;
  promptSubtextEn: string;
  choices: [string, string];
  correctChoice: string;
  fullSentence: string;
  meaningTr: string;
  explanationTr: string;
  explanationEn: string;
}

export interface SpotFixTemplate {
  buggyTokens: string[];
  buggyTokenIndex: number;
  fixChoices: [string, string, string];
  correctFixToken: string;
  correctedSentence: string;
  meaningTr: string;
  explanationTr: string;
  explanationEn: string;
}

export interface ScenarioPickTemplate {
  scenarioTr: string;
  scenarioEn: string;
  choices: [string, string, string];
  correctChoice: string;
  meaningTr: string;
  explanationTr: string;
  explanationEn: string;
}

export interface RemedialSkillSpec {
  skillId: WeakSkillId;
  titleTr: string;
  titleEn: string;
  subtitleTr: string;
  subtitleEn: string;
  icon: string;
  /** Regex tested against card English text to associate cards with this skill. */
  sentencePattern: RegExp;
  /** Regex tested against concept note id / focusToken / label. */
  conceptPattern: RegExp;
  /** Optional regex for detecting confusion directly in userAnswer vs expected. */
  answerConfusionHint?: 'was_were' | 'should_have_to' | 'passive' | 'going_to_will' | 'preposition' | 'negation' | 'infinitive_gerund' | 'word_order' | 'listening';
  briefing: RemedialBriefing;
  duels: ContrastDuelTemplate[];
  spotFixes: SpotFixTemplate[];
  scenarios: ScenarioPickTemplate[];
}

export const REMEDIAL_SKILL_CATALOG: Record<WeakSkillId, RemedialSkillSpec> = {
  was_vs_were: {
    skillId: 'was_vs_were',
    titleTr: 'was vs were (Geçmişte "Olmak")',
    titleEn: 'was vs were (Past "To Be")',
    subtitleTr: 'Tekil öznede was, çoğul ve "you" öznelerinde were kullanımı',
    subtitleEn: 'Using was with singular subjects and were with plural / you',
    icon: '⚖️',
    sentencePattern: /\b(?:was|were|wasn't|weren't)\b/i,
    conceptPattern: /\b(?:was|were|wasn't|weren't|past\s+be)\b/i,
    answerConfusionHint: 'was_were',
    briefing: {
      headlineTr: '"was" ve "were" aslında aynı kelime: ikisi de geçmişte "idi / -di" demek!',
      headlineEn: '"was" and "were" share the exact same meaning — only the subject changes!',
      goldenRuleTr:
        'Tek kişi veya tek şey (I, he, she, it, the game) → WAS. Kalabalık (we, they, my friends) ve HER ZAMAN "YOU" → WERE.',
      goldenRuleEn:
        'Singular subject (I, he, she, it, the game) → WAS. Plural (we, they, my friends) and ALWAYS "you" → WERE.',
      mnemonicTr:
        '💡 Kolay Kodlama: W-A-S (3 harf = küçük/tekil) | W-E-R-E (4 harf = kalabalık/çoğul + saygılı YOU). Ekstra bonus: Hayal kurarken "If I were you" (Senin yerinde olsam) kalıbında da WERE kullanılır!',
      mnemonicEn:
        '💡 Memory Hook: W-A-S (3 letters = solo/singular) vs W-E-R-E (4 letters = crowd/plural + YOU). Bonus: Unreal wishes use "If I were you"!',
      examples: [
        {
          en: 'The concert was louder than I expected.',
          tr: 'Konser beklediğimden daha gürültülüydü.',
          highlight: 'was',
        },
        {
          en: 'We were waiting for the GTA 6 trailer all night.',
          tr: 'Bütün gece GTA 6 fragmanını bekliyorduk.',
          highlight: 'were',
        },
        {
          en: 'Were you online on Discord last night?',
          tr: 'Dün gece Discord’da çevrimiçi miydin?',
          highlight: 'Were you',
        },
        {
          en: 'My friends was at the coffee shop.',
          tr: 'YANLIŞ! "My friends" çoğuldur → "My friends WERE at the coffee shop."',
          highlight: 'was → were',
          isTrap: true,
          trapNoteTr: 'Özneye bak: "friends" (-s takısı var = çoğul) olduğu için "was" değil "were" gelir.',
          trapNoteEn: 'Check the subject: "friends" is plural, so it requires "were", never "was".',
        },
      ],
      source: 'local',
    },
    duels: [
      {
        promptSentence: 'My teammates ___ exhausted after the ranked match.',
        promptSubtextTr: 'Takım arkadaşlarım dereceli maçtan sonra bitkindiler.',
        promptSubtextEn: 'Choose the right past "to be" form for "My teammates".',
        choices: ['was', 'were'],
        correctChoice: 'were',
        fullSentence: 'My teammates were exhausted after the ranked match.',
        meaningTr: 'Takım arkadaşlarım dereceli maçtan sonra bitkindiler.',
        explanationTr: '"My teammates" çoğul (they) olduğu için 4 harfli "were" kullanılır.',
        explanationEn: '"My teammates" is plural (they), so use "were".',
      },
      {
        promptSentence: '___ you listening to rock music in the car?',
        promptSubtextTr: 'Arabada rock müzik mi dinliyordun?',
        promptSubtextEn: 'Even when talking to one person, "you" follows a strict rule.',
        choices: ['Was', 'Were'],
        correctChoice: 'Were',
        fullSentence: 'Were you listening to rock music in the car?',
        meaningTr: 'Arabada rock müzik mi dinliyordun?',
        explanationTr: '"You" tek bir kişi bile olsa İngilizcede her zaman "were" ile kullanılır.',
        explanationEn: '"You" always takes "were", whether singular or plural.',
      },
      {
        promptSentence: 'The new update ___ finally released this morning.',
        promptSubtextTr: 'Yeni güncelleme bu sabah nihayet yayınlandı.',
        promptSubtextEn: 'Check if "The new update" is singular or plural.',
        choices: ['was', 'were'],
        correctChoice: 'was',
        fullSentence: 'The new update was finally released this morning.',
        meaningTr: 'Yeni güncelleme bu sabah nihayet yayınlandı.',
        explanationTr: '"The new update" tekil (it) olduğu için "was" doğru seçimdir.',
        explanationEn: '"The new update" is singular (it), so use "was".',
      },
    ],
    spotFixes: [
      {
        buggyTokens: ['All', 'the', 'tickets', 'was', 'sold', 'out', 'in', 'minutes.'],
        buggyTokenIndex: 3,
        fixChoices: ['were', 'is', 'am'],
        correctFixToken: 'were',
        correctedSentence: 'All the tickets were sold out in minutes.',
        meaningTr: 'Tüm biletler dakikalar içinde tükendi.',
        explanationTr: '"All the tickets" çoğul olduğu için "was" yerine "were" olmalı.',
        explanationEn: '"All the tickets" is plural, so replace "was" with "were".',
      },
      {
        buggyTokens: ['Why', 'was', 'you', 'late', 'to', 'the', 'stream?'],
        buggyTokenIndex: 1,
        fixChoices: ['were', 'is', 'been'],
        correctFixToken: 'were',
        correctedSentence: 'Why were you late to the stream?',
        meaningTr: 'Yayına neden geç kaldın?',
        explanationTr: '"You" öznesiyle asla "was" kullanılmaz; her zaman "were you" denir.',
        explanationEn: 'Never pair "you" with "was" — always say "were you".',
      },
    ],
    scenarios: [
      {
        scenarioTr:
          'Arkadaşına dün geceki konserin harika geçtiğini ve grup üyelerinin çok enerjik olduğunu anlatacaksın:',
        scenarioEn:
          'Tell your friend that last night’s concert was awesome and the band members were super energetic:',
        choices: [
          'The concert was awesome, and the band members were super energetic!',
          'The concert were awesome, and the band members was super energetic!',
          'The concert was awesome, and the band members was super energetic!',
        ],
        correctChoice: 'The concert was awesome, and the band members were super energetic!',
        meaningTr: 'Konser harikaydı ve grup üyeleri süper enerjikti!',
        explanationTr: '"The concert" tekil → was; "the band members" çoğul → were.',
        explanationEn: '"The concert" is singular (was); "the band members" is plural (were).',
      },
    ],
  },

  should_vs_have_to: {
    skillId: 'should_vs_have_to',
    titleTr: 'should vs have to (Tavsiye vs Zorunluluk)',
    titleEn: 'should vs have to (Advice vs Obligation)',
    subtitleTr: 'İyi fikir / tavsiye (should) ile dış kural / mecburiyet (have to) farkı',
    subtitleEn: 'Distinguishing advice/recommendations from strict obligation',
    icon: '🧭',
    sentencePattern: /\b(?:should|shouldn't|ought\s+to|(?:have|has|had|don't\s+have|doesn't\s+have|didn't\s+have)\s+to|must|mustn't)\b/i,
    conceptPattern: /\b(?:should|have\s+to|has\s+to|had\s+to|must|ought|obligation|advice)\b/i,
    answerConfusionHint: 'should_have_to',
    briefing: {
      headlineTr: '"should" = dost tavsiyesi | "have to" = kaçış yok, zorunluluk!',
      headlineEn: '"should" = friendly advice | "have to" = real requirement or rule!',
      goldenRuleTr:
        'Yaparsan iyi olur / tavsiye → SHOULD (yapmasan ceza yok). Kural, patron, sınav veya mecburiyet → HAVE TO. Olumsuzda fark devleşir: "shouldn\'t" = yapmasan iyi olur; "don\'t have to" = yapmana gerek yok (zorunlu değil)!',
      goldenRuleEn:
        'Good idea / advice → SHOULD. External rule / necessity → HAVE TO. Crucial negative difference: "shouldn\'t" = bad idea, while "don\'t have to" = NOT required (optional)!',
      mnemonicTr:
        '💡 Test Et: Cümlenin sonuna "ama sen bilirsin" ekleyebiliyorsan → SHOULD. "Yoksa başın belaya girer / yasak" ise → HAVE TO. Ve unutma: "don\'t have to" ASLA "yasak" demek değildir, "zorunda değilsin" demektir!',
      mnemonicEn:
        '💡 Quick Test: If you can add "...it would be smart", use SHOULD. If it is a rule/deadline, use HAVE TO. Remember: "don\'t have to" means OPTIONAL, not forbidden!',
      examples: [
        {
          en: 'You should listen to this new rock album!',
          tr: 'Bu yeni rock albümünü dinlemelisin! (Tavsiye — zorunlu değil)',
          highlight: 'should',
        },
        {
          en: 'I have to finish this report before 5 PM.',
          tr: 'Bu raporu saat 5’ten önce bitirmek zorundayım. (Mecburiyet)',
          highlight: 'have to',
        },
        {
          en: 'You don’t have to pay today; it’s free for a week.',
          tr: 'Bugün ödemek zorunda değilsin; bir hafta ücretsiz.',
          highlight: "don't have to",
        },
        {
          en: 'You don’t have to smoke inside the plane.',
          tr: 'YANLIŞ! Uçakta sigara "isteğe bağlı" değil, YASAKTIR → "mustn\'t / can\'t".',
          highlight: "don't have to → mustn't",
          isTrap: true,
          trapNoteTr: '"don\'t have to" = "gerek yok" demektir. Yasak veya kötü fikir için "mustn\'t" ya da "shouldn\'t" kullan.',
          trapNoteEn: '"don\'t have to" means optional, NOT forbidden. Use "mustn\'t" or "shouldn\'t" instead.',
        },
      ],
      source: 'local',
    },
    duels: [
      {
        promptSentence: 'You ___ try the iced latte here, it tastes amazing!',
        promptSubtextTr: 'Buradaki buzlu latteyi denemelisin, tadı şahane! (Arkadaş tavsiyesi)',
        promptSubtextEn: 'A friendly recommendation, not a law.',
        choices: ['should', 'have to'],
        correctChoice: 'should',
        fullSentence: 'You should try the iced latte here, it tastes amazing!',
        meaningTr: 'Buradaki buzlu latteyi denemelisin, tadı şahane!',
        explanationTr: 'Kahve önermek bir dost tavsiyesidir, zorunluluk değil → "should".',
        explanationEn: 'Recommending coffee is friendly advice, not a rule → "should".',
      },
      {
        promptSentence: 'Passengers ___ show their passport at the gate.',
        promptSubtextTr: 'Yolcular kapıda pasaportlarını göstermek zorundadır.',
        promptSubtextEn: 'An official airport rule with no choice.',
        choices: ['should', 'have to'],
        correctChoice: 'have to',
        fullSentence: 'Passengers have to show their passport at the gate.',
        meaningTr: 'Yolcular kapıda pasaportlarını göstermek zorundadır.',
        explanationTr: 'Havalimanı kuralı dıştan gelen bir zorunluluktur → "have to".',
        explanationEn: 'An airport rule is an external requirement → "have to".',
      },
      {
        promptSentence: 'Tomorrow is Sunday, so I ___ wake up early.',
        promptSubtextTr: 'Yarın pazar, bu yüzden erken uyanmak zorunda değilim.',
        promptSubtextEn: 'It is optional (no obligation), not forbidden.',
        choices: ["shouldn't", "don't have to"],
        correctChoice: "don't have to",
        fullSentence: "Tomorrow is Sunday, so I don't have to wake up early.",
        meaningTr: 'Yarın pazar, bu yüzden erken uyanmak zorunda değilim.',
        explanationTr: '"Zorunda değilim / gerek yok" anlamı için her zaman "don\'t have to" kullanılır.',
        explanationEn: 'Zero obligation ("not necessary") is always "don\'t have to".',
      },
    ],
    spotFixes: [
      {
        buggyTokens: ['You', 'should to', 'back', 'up', 'your', 'code', 'today.'],
        buggyTokenIndex: 1,
        fixChoices: ['should', 'have', 'ought'],
        correctFixToken: 'should',
        correctedSentence: 'You should back up your code today.',
        meaningTr: 'Kodunu bugün yedeklemelisin.',
        explanationTr: '"should" yardımcı fiilinden sonra ASLA "to" gelmez! ("should back up", "have TO back up" ile karıştırma).',
        explanationEn: 'Never put "to" after "should" — unlike "have to", "should" connects straight to the base verb.',
      },
      {
        buggyTokens: ['He', 'have', 'to', 'submit', 'his', 'assignment', 'tonight.'],
        buggyTokenIndex: 1,
        fixChoices: ['has', 'is', 'having'],
        correctFixToken: 'has',
        correctedSentence: 'He has to submit his assignment tonight.',
        meaningTr: 'Ödevini bu gece teslim etmek zorunda.',
        explanationTr: '"He/She/It" ile "have to" değil "HAS to" kullanılır.',
        explanationEn: 'With he/she/it, "have to" conjugates to "has to".',
      },
    ],
    scenarios: [
      {
        scenarioTr:
          'Arkadaşın gece 3’e kadar oyun oynayıp uykusuz kalmış. Ona yumuşak bir tavsiye vereceksin (zorlama yok):',
        scenarioEn:
          'Your friend stayed up gaming until 3 AM and looks tired. Give gentle advice:',
        choices: [
          'You should get some sleep before work.',
          'You don’t have to get some sleep before work.',
          'You have to buy a new bed immediately.',
        ],
        correctChoice: 'You should get some sleep before work.',
        meaningTr: 'İşten önce biraz uyumalısın.',
        explanationTr: 'Yumuşak tavsiye ve iyi fikir bildirirken "should + V1" en doğal seçimdir.',
        explanationEn: 'Gentle advice uses "should + base verb".',
      },
    ],
  },

  used_to_habit: {
    skillId: 'used_to_habit',
    titleTr: 'used to (Eski Alışkanlıklar)',
    titleEn: 'used to (Past Habits)',
    subtitleTr: 'Eskiden düzenli yapılıp artık bırakılmış alışkanlıklar ("-ardı/-erdi")',
    subtitleEn: 'Talking about past routines that are no longer true today',
    icon: '📼',
    sentencePattern: /\b(?:used\s+to|didn't\s+use\s+to)\b/i,
    conceptPattern: /\bused\s+to\b/i,
    briefing: {
      headlineTr: '"used to" = Eskiden öyleydi, ama ARTIK DEĞİL!',
      headlineEn: '"used to" = True in the past, NO LONGER true now!',
      goldenRuleTr:
        'Olumlu cümlede "used to + fiil yalın hali" kullanılır. Olumsuz ve soruda "did" geldiği için sondaki -d düşer: "didn\'t use to" / "Did you use to...?"',
      goldenRuleEn:
        'Affirmative: "used to + base verb". Negative & questions drop the -d because "did" carries the past tense: "didn\'t use to" / "Did you use to...?"',
      mnemonicTr:
        '💡 Dikkat: "used to" (eskiden yapardım) ile "be used to + -ing" (alışık olmak) farklıdır! "I used to play" = Eskiden oynardım. "I am used to playing" = Oynamaya alışığım.',
      mnemonicEn:
        '💡 Watch out: "used to + verb" (past habit) differs from "be used to + -ing" (accustomed to).',
      examples: [
        {
          en: 'I used to play GTA Vice City after school.',
          tr: 'Eskiden okuldan sonra GTA Vice City oynardım.',
          highlight: 'used to play',
        },
        {
          en: 'She didn’t use to drink black coffee.',
          tr: 'Eskiden sade kahve içmezdi.',
          highlight: "didn't use to",
        },
        {
          en: 'Did you use to live near the sea?',
          tr: 'Eskiden denize yakın mı yaşardın?',
          highlight: 'Did ... use to',
        },
        {
          en: 'I used to playing football every weekend.',
          tr: 'YANLIŞ! "used to" sonrası fiil yalın kalır → "I used to PLAY football."',
          highlight: 'playing → play',
          isTrap: true,
          trapNoteTr: 'Önünde am/is/are yoksa "used to" sonrası -ing ekleme, yalın fiil kullan.',
          trapNoteEn: 'Without am/is/are before it, "used to" takes the bare infinitive, never -ing.',
        },
      ],
      source: 'local',
    },
    duels: [
      {
        promptSentence: 'I ___ spend hours customizing my desktop wallpaper.',
        promptSubtextTr: 'Eskiden masaüstü duvar kağıdımı özelleştirmek için saatler harcardım.',
        promptSubtextEn: 'A past habit that you no longer do.',
        choices: ['used to', 'use to'],
        correctChoice: 'used to',
        fullSentence: 'I used to spend hours customizing my desktop wallpaper.',
        meaningTr: 'Eskiden masaüstü duvar kağıdımı özelleştirmek için saatler harcardım.',
        explanationTr: 'Olumlu cümlede geçmiş zamanı göstermek için "used to" (-d ile) yazılır.',
        explanationEn: 'In positive statements, always write "used to" with the -d.',
      },
      {
        promptSentence: 'He didn’t ___ like spicy food, but now he loves it.',
        promptSubtextTr: 'Eskiden acı yemek sevmezdi ama şimdi bayılıyor.',
        promptSubtextEn: 'Notice "didn\'t" already carries the past tense.',
        choices: ['used to', 'use to'],
        correctChoice: 'use to',
        fullSentence: "He didn't use to like spicy food, but now he loves it.",
        meaningTr: 'Eskiden acı yemek sevmezdi ama şimdi bayılıyor.',
        explanationTr: '"didn\'t" geçmiş zamanı zaten taşıdığı için "use to" yalın (-d olmadan) kalır.',
        explanationEn: 'After "didn\'t", drop the -d and write "use to".',
      },
    ],
    spotFixes: [
      {
        buggyTokens: ['We', 'used', 'to', 'went', 'to', 'that', 'arcade', 'together.'],
        buggyTokenIndex: 3,
        fixChoices: ['go', 'going', 'gone'],
        correctFixToken: 'go',
        correctedSentence: 'We used to go to that arcade together.',
        meaningTr: 'Eskiden o atari salonuna birlikte giderdik.',
        explanationTr: '"used to" kalıbından sonra fiilin 2. hali (went) değil 1. hali (go) gelir.',
        explanationEn: 'Always follow "used to" with the base verb ("go", not "went").',
      },
      {
        buggyTokens: ['Did', 'you', 'used', 'to', 'collect', 'vinyl', 'records?'],
        buggyTokenIndex: 2,
        fixChoices: ['use', 'using', 'uses'],
        correctFixToken: 'use',
        correctedSentence: 'Did you use to collect vinyl records?',
        meaningTr: 'Eskiden plak biriktirir miydin?',
        explanationTr: '"Did" sorusunda fiil yalınlaşır: "Did you use to...?"',
        explanationEn: 'In "Did..." questions, write "use to" without the -d.',
      },
    ],
    scenarios: [
      {
        scenarioTr:
          'Eskiden çok geç yattığını ama artık erken uyuduğunu doğal bir İngilizceyle anlat:',
        scenarioEn: 'Explain that you stayed up late in the past, though you sleep early now:',
        choices: [
          'I used to stay up late, but now I sleep early.',
          'I use to staying up late, but now I sleep early.',
          'I am used to stay up late, so now I sleep early.',
        ],
        correctChoice: 'I used to stay up late, but now I sleep early.',
        meaningTr: 'Eskiden geç saatlere kadar otururdum ama şimdi erken uyuyorum.',
        explanationTr: 'Eski alışkanlık + şimdiki değişim tam olarak "used to + V1" kalıbının alanıdır.',
        explanationEn: 'Past routine contrasted with present change = "used to + base verb".',
      },
    ],
  },

  past_continuous: {
    skillId: 'past_continuous',
    titleTr: 'was/were + V-ing (Past Continuous)',
    titleEn: 'Past Continuous (was/were + -ing)',
    subtitleTr: 'Geçmişte tam o anda devam eden eylem ("yapıyordum") vs bitmiş eylem ("yaptım")',
    subtitleEn: 'Ongoing background actions in the past vs sudden interruptions',
    icon: '🎬',
    sentencePattern: /\b(?:was|were|wasn't|weren't)\s+[a-z]{2,}ing\b/i,
    conceptPattern: /\b(?:past\s+continuous|was\s+[a-z]+ing|were\s+[a-z]+ing|was\s+taking)\b/i,
    briefing: {
      headlineTr: 'Geçmişte bir film sahnesi düşün: arka planda AKAN olay "was/were + -ing"!',
      headlineEn: 'Think of a movie scene: the ongoing background action is "was/were + -ing"!',
      goldenRuleTr:
        'Geçmişte o an devam eden süreç → WAS/WERE + V-ING ("yürüyordum / kod yazıyordum"). O sahneyi aniden bölen olay → Simple Past V2 ("telefon çaldı").',
      goldenRuleEn:
        'Ongoing background action → WAS/WERE + V-ING. Sudden interrupting event → Simple Past (V2).',
      mnemonicTr:
        '💡 Sinema Kuralı: "When" sonrası genelde kısa şok (V2), "While" sonrası uzun akan sahne (was/were + V-ing). Örnek: "I was taking a walk when it started to rain."',
      mnemonicEn:
        '💡 Movie Rule: Long background reel = "while + was/were -ing"; sudden cut = "when + V2".',
      examples: [
        {
          en: 'I was listening to rock music when you called.',
          tr: 'Sen aradığında rock müzik dinliyordum.',
          highlight: 'was listening',
        },
        {
          en: 'They were playing co-op while the storm hit.',
          tr: 'Fırtına vururken eşli oyun oynuyorlardı.',
          highlight: 'were playing',
        },
        {
          en: 'I took a walk → "Yürüyüş yaptım" | I was taking a walk → "Yürüyüş yapıyordum".',
          tr: 'Türkçe çeviride "-dım" ile "-yordum" farkını koru!',
          highlight: 'was taking',
        },
        {
          en: 'I was cook dinner when the power went out.',
          tr: 'YANLIŞ! "was" tek başına yalın fiil almaz → "was COOKING dinner".',
          highlight: 'cook → cooking',
          isTrap: true,
          trapNoteTr: '"was/were" sonrası aktif süreç anlatıyorsan mutlaka "-ing" eki koy.',
          trapNoteEn: 'Active ongoing past actions always need -ing after was/were.',
        },
      ],
      source: 'local',
    },
    duels: [
      {
        promptSentence: 'I ___ a podcast when my headphones suddenly died.',
        promptSubtextTr: 'Kulaklığım aniden kapandığında bir podcast dinliyordum.',
        promptSubtextEn: 'Ongoing background action interrupted by "died".',
        choices: ['was listening to', 'listened to'],
        correctChoice: 'was listening to',
        fullSentence: 'I was listening to a podcast when my headphones suddenly died.',
        meaningTr: 'Kulaklığım aniden kapandığında bir podcast dinliyordum.',
        explanationTr: 'Kulaklık kapandığı anda dinleme eylemi sürüyordu → "was listening to".',
        explanationEn: 'The listening was in progress when interrupted → "was listening to".',
      },
      {
        promptSentence: 'What ___ you doing at midnight yesterday?',
        promptSubtextTr: 'Dün gece yarısı ne yapıyordun?',
        promptSubtextEn: 'Asking about an ongoing activity at a specific past moment.',
        choices: ['did', 'were'],
        correctChoice: 'were',
        fullSentence: 'What were you doing at midnight yesterday?',
        meaningTr: 'Dün gece yarısı ne yapıyordun?',
        explanationTr: '"doing" (-ing) olduğu için yardımcı fiil "did" değil "were" olmalıdır.',
        explanationEn: 'Because the main verb is "doing" (-ing), pair it with "were".',
      },
    ],
    spotFixes: [
      {
        buggyTokens: ['While', 'we', 'was', 'driving', 'home,', 'it', 'started', 'snowing.'],
        buggyTokenIndex: 2,
        fixChoices: ['were', 'are', 'did'],
        correctFixToken: 'were',
        correctedSentence: 'While we were driving home, it started snowing.',
        meaningTr: 'Eve araba sürerken kar yağmaya başladı.',
        explanationTr: '"We" öznesi çoğul olduğu için "were driving" olmalıdır.',
        explanationEn: '"We" takes "were driving", not "was driving".',
      },
      {
        buggyTokens: ['She', 'were', 'coding', 'when', 'the', 'laptop', 'crashed.'],
        buggyTokenIndex: 1,
        fixChoices: ['was', 'is', 'did'],
        correctFixToken: 'was',
        correctedSentence: 'She was coding when the laptop crashed.',
        meaningTr: 'Laptop çöktüğünde o kod yazıyordu.',
        explanationTr: '"She" tekil özne olduğu için "was coding" kullanılır.',
        explanationEn: '"She" is singular, so use "was coding".',
      },
    ],
    scenarios: [
      {
        scenarioTr:
          'Telefonunu neden açamadığını açıkla: "O sırada duş alıyordum."',
        scenarioEn: 'Explain why you missed the call: you were in the middle of a shower:',
        choices: [
          'Sorry, I was taking a shower when you called.',
          'Sorry, I took a shower when you were calling.',
          'Sorry, I was take a shower when you called.',
        ],
        correctChoice: 'Sorry, I was taking a shower when you called.',
        meaningTr: 'Üzgünüm, sen aradığında duş alıyordum.',
        explanationTr: 'Süren eylem "was taking", anlık arama "called" (V2) ile verilir.',
        explanationEn: 'Ongoing background = "was taking"; interrupting call = "called".',
      },
    ],
  },

  present_perfect: {
    skillId: 'present_perfect',
    titleTr: 'have/has + V3 (Present Perfect)',
    titleEn: 'Present Perfect (have/has + V3)',
    subtitleTr: 'Geçmişte başlayıp bugünü etkileyen durumlar ve hayat deneyimleri',
    subtitleEn: 'Connecting past experiences and ongoing duration to the present',
    icon: '🔗',
    sentencePattern: /\b(?:have|has|'ve)\s+(?:never\s+|ever\s+|just\s+|already\s+)?(?:been|done|seen|made|gone|taken|written|found|heard|known|got|gotten|had|lived|worked|played|finished|lost|started|met)\b/i,
    conceptPattern: /\b(?:present\s+perfect|have\s+been|has\s+been|have\s+\w+ed|v3|past\s+participle)\b/i,
    briefing: {
      headlineTr: 'Present Perfect = Geçmiş ile ŞİMDİ arasında köprü kurar!',
      headlineEn: 'Present Perfect builds a bridge from the past right into NOW!',
      goldenRuleTr:
        'Kesin bir geçmiş tarih YOKSA (hayat deneyimi: ever/never, az önce: just/already, hâlâ süren durum: for/since) → HAVE/HAS + V3. Kesin bitmiş tarih varsa (yesterday, in 2021, last night) → Simple Past (V2)!',
      goldenRuleEn:
        'Life experiences (ever/never), recent results (just/already), or duration until now (for/since) → HAVE/HAS + V3. Finished specific time (yesterday, last week) → Simple Past (V2).',
      mnemonicTr:
        '💡 Köprü Testi: "Yesterday / last night" görüyorsan köprü kopmuştur → HAVE kullanma! "for 3 days / since 2020 / ever / never / already" görüyorsan → HAVE/HAS + V3!',
      mnemonicEn:
        '💡 Bridge Test: Specific past time ("yesterday") breaks the bridge → V2. Open/ongoing time ("since", "ever", "just") → have/has + V3.',
      examples: [
        {
          en: 'I have already finished the main story.',
          tr: 'Ana hikâyeyi çoktan bitirdim.',
          highlight: 'have already finished',
        },
        {
          en: 'My dog has been missing for three days.',
          tr: 'Köpeğim üç gündür kayıp. (Hâlâ kayıp!)',
          highlight: 'has been',
        },
        {
          en: 'Have you ever been to a live rock festival?',
          tr: 'Hiç canlı bir rock festivaline gittin mi?',
          highlight: 'Have ... ever been',
        },
        {
          en: 'I have watched that movie yesterday.',
          tr: 'YANLIŞ! "yesterday" kesin bitmiş zamandır → "I WATCHED that movie yesterday."',
          highlight: 'have watched → watched',
          isTrap: true,
          trapNoteTr: '"yesterday / last week / two hours ago" ile asla have/has + V3 kullanma.',
          trapNoteEn: 'Never mix "yesterday / ago / last week" with have/has + V3.',
        },
      ],
      source: 'local',
    },
    duels: [
      {
        promptSentence: 'I ___ never played an instrument, but I want to learn guitar.',
        promptSubtextTr: 'Hiç enstrüman çalmadım ama gitar öğrenmek istiyorum.',
        promptSubtextEn: 'Life experience up until right now ("never").',
        choices: ['have', 'did'],
        correctChoice: 'have',
        fullSentence: 'I have never played an instrument, but I want to learn guitar.',
        meaningTr: 'Hiç enstrüman çalmadım ama gitar öğrenmek istiyorum.',
        explanationTr: 'Hayat boyu deneyim ("never") + V3 ("played") → "have".',
        explanationEn: 'Life experience with "never" + past participle takes "have".',
      },
      {
        promptSentence: 'She ___ lived in this city since 2019.',
        promptSubtextTr: '2019’dan beri bu şehirde yaşıyor.',
        promptSubtextEn: 'Started in 2019 and still true today ("since").',
        choices: ['has', 'was'],
        correctChoice: 'has',
        fullSentence: 'She has lived in this city since 2019.',
        meaningTr: '2019’dan beri bu şehirde yaşıyor.',
        explanationTr: '"since 2019" geçmişten bugüne süren durumdur ve "she" ile "has + V3" kullanılır.',
        explanationEn: '"since 2019" connects past to present; "she" takes "has lived".',
      },
    ],
    spotFixes: [
      {
        buggyTokens: ['We', 'have', 'went', 'to', 'that', 'cafe', 'three', 'times.'],
        buggyTokenIndex: 2,
        fixChoices: ['been', 'going', 'go'],
        correctFixToken: 'been',
        correctedSentence: 'We have been to that cafe three times.',
        meaningTr: 'O kafeye üç kez gittik.',
        explanationTr: '"have" sonrası 2. hal (went) değil 3. hal (been / gone) kullanılır; gidip döndüysen "been" denir.',
        explanationEn: 'Use past participle "been" after "have", never simple past "went".',
      },
      {
        buggyTokens: ['He', 'has finished', 'his', 'project', 'yesterday.'],
        buggyTokenIndex: 1,
        fixChoices: ['finished', 'finishing', 'finish'],
        correctFixToken: 'finished',
        correctedSentence: 'He finished his project yesterday.',
        meaningTr: 'Projesini dün bitirdi.',
        explanationTr: '"yesterday" kesin geçmiş zamandır; "has finished" yerine Simple Past ("finished") kullanılır.',
        explanationEn: '"yesterday" requires Simple Past ("finished"), never Present Perfect ("has finished").',
      },
    ],
    scenarios: [
      {
        scenarioTr:
          'Arkadaşına yeni çıkan bir oyunu oynayıp oynamadığını (hayat deneyimi olarak) sor:',
        scenarioEn: 'Ask a friend whether they have played a new game yet:',
        choices: [
          'Have you played the new demo yet?',
          'Did you ever playing the new demo yet?',
          'Are you played the new demo yet?',
        ],
        correctChoice: 'Have you played the new demo yet?',
        meaningTr: 'Yeni demoyu henüz oynadın mı?',
        explanationTr: '"yet" ile deneyim/sonuç sorusu "Have you + V3...?" şeklinde kurulur.',
        explanationEn: 'Questions with "yet" use "Have you + V3...?"',
      },
    ],
  },

  passive_voice: {
    skillId: 'passive_voice',
    titleTr: 'Edilgen Çatı (was/were/is + V3)',
    titleEn: 'Passive Voice (be + V3)',
    subtitleTr: 'İşi yapan değil, işten etkilenen ön planda: "davet edildi / yapıldı"',
    subtitleEn: 'Focusing on what happened to the subject ("were invited / is built")',
    icon: '🔄',
    sentencePattern: /\b(?:am|is|are|was|were|been|be)\s+(?:[a-z]{2,}(?:ed|en)|invited|built|made|sold|told|said|given|taken|written|found|known|tempted|caught|hurt|sent|held|paid|born|released|delayed|canceled|cancelled)\b/i,
    conceptPattern: /\b(?:passive|were\s+invited|was\s+tempted|is\s+said|edilgen|be\s*\+\s*v3)\b/i,
    answerConfusionHint: 'passive',
    briefing: {
      headlineTr: '"We invited" = Biz davet ETTİK | "We WERE invited" = BİZ DAVET EDİLDİK!',
      headlineEn: '"We invited" = Active (we did it) | "We WERE invited" = Passive (done to us)!',
      goldenRuleTr:
        'BE (am/is/are/was/were) + Fiilin 3. Hali (V3) gördüğünde cümleyi EDİLGEN çevir: "-ıldı / -ildi / -ulur / -ilir". Özne işi yapan değil, işe maruz kalandır!',
      goldenRuleEn:
        'Whenever you see BE (am/is/are/was/were) + Past Participle (V3), the subject RECEIVES the action instead of doing it.',
      mnemonicTr:
        '💡 Formül: [BE] + [V3] = EDİLGEN! Örnek: "was tempted" (cazibesine kapıldı/ayartıldı), "were invited" (davet edildiler), "is said to" (... olduğu söylenir).',
      mnemonicEn:
        '💡 Formula: [BE] + [V3] = PASSIVE. Examples: "were invited", "was delayed", "is said to be".',
      examples: [
        {
          en: 'We were invited to the launch party.',
          tr: 'Lansman partisine davet edildik. (Davet eden biz değiliz!)',
          highlight: 'were invited',
        },
        {
          en: 'The release date was delayed twice.',
          tr: 'Çıkış tarihi iki kez ertelendi.',
          highlight: 'was delayed',
        },
        {
          en: 'He is said to be a great guitarist.',
          tr: 'Onun harika bir gitarist olduğu söylenir.',
          highlight: 'is said to',
        },
        {
          en: 'The bug was fix by the developer.',
          tr: 'YANLIŞ! Edilgende fiil 3. halde (V3) olmalı → "The bug was FIXED".',
          highlight: 'fix → fixed',
          isTrap: true,
          trapNoteTr: '"was/were/is/are" sonrası edilgen anlamda fiil asla yalın kalmaz, V3 olur.',
          trapNoteEn: 'Passive voice always requires the 3rd form (V3): "was fixed", not "was fix".',
        },
      ],
      source: 'local',
    },
    duels: [
      {
        promptSentence: 'Our whole squad ___ to the weekend tournament.',
        promptSubtextTr: 'Tüm ekibimiz hafta sonu turnuvasına davet edildi.',
        promptSubtextEn: 'The squad received the invitation (passive!).',
        choices: ['invited', 'was invited'],
        correctChoice: 'was invited',
        fullSentence: 'Our whole squad was invited to the weekend tournament.',
        meaningTr: 'Tüm ekibimiz hafta sonu turnuvasına davet edildi.',
        explanationTr: 'Ekip davet eden değil davet EDİLEN olduğu için "was invited" (BE + V3) gerekir.',
        explanationEn: 'Because the squad received the invitation, use passive "was invited".',
      },
      {
        promptSentence: 'These headphones ___ in Germany.',
        promptSubtextTr: 'Bu kulaklıklar Almanya’da üretilir.',
        promptSubtextEn: 'Plural subject ("headphones") + passive voice.',
        choices: ['are made', 'make'],
        correctChoice: 'are made',
        fullSentence: 'These headphones are made in Germany.',
        meaningTr: 'Bu kulaklıklar Almanya’da üretilir.',
        explanationTr: 'Kulaklıklar kendi kendini üretmez; üretilir → çoğul edilgen "are made".',
        explanationEn: 'Headphones are manufactured (passive) and plural → "are made".',
      },
    ],
    spotFixes: [
      {
        buggyTokens: ['The', 'server', 'was', 'update', 'at', '3', 'AM.'],
        buggyTokenIndex: 3,
        fixChoices: ['updated', 'updating', 'updates'],
        correctFixToken: 'updated',
        correctedSentence: 'The server was updated at 3 AM.',
        meaningTr: 'Sunucu gece 3’te güncellendi.',
        explanationTr: 'Edilgen yapı "was + V3" ister → "updated".',
        explanationEn: 'Passive voice needs past participle V3: "was updated".',
      },
      {
        buggyTokens: ['Three', 'new', 'maps', 'was', 'added', 'today.'],
        buggyTokenIndex: 3,
        fixChoices: ['were', 'is', 'been'],
        correctFixToken: 'were',
        correctedSentence: 'Three new maps were added today.',
        meaningTr: 'Bugün üç yeni harita eklendi.',
        explanationTr: '"Three new maps" çoğul olduğu için "were added" olmalıdır.',
        explanationEn: '"Three new maps" is plural, so use "were added".',
      },
    ],
    scenarios: [
      {
        scenarioTr:
          'Dün akşamki partiye davet edildiğini söyleyeceksin (sen davet etmedin, seni davet ettiler):',
        scenarioEn: 'Say that you received an invitation to last night’s party:',
        choices: [
          'I was invited to the party last night.',
          'I invited to the party last night.',
          'I was inviting to the party last night.',
        ],
        correctChoice: 'I was invited to the party last night.',
        meaningTr: 'Dün geceki partiye davet edildim.',
        explanationTr: '"Davet edildim" = "I was invited" (BE + V3). "I invited" = "Ben davet ettim" olurdu!',
        explanationEn: '"I was invited" means someone invited you; "I invited" means you invited someone.',
      },
    ],
  },

  going_to_vs_will: {
    skillId: 'going_to_vs_will',
    titleTr: 'going to vs will (Gelecek Zaman Farkı)',
    titleEn: 'be going to vs will (Future Forms)',
    subtitleTr: 'Önceden yapılmış plan (going to) vs anlık karar & söz (will)',
    subtitleEn: 'Pre-decided plans (going to) vs instant decisions & promises (will)',
    icon: '🚀',
    sentencePattern: /\b(?:going\s+to|gonna|will|'ll|won't)\b/i,
    conceptPattern: /\b(?:going\s+to|future_will|will\s+\+\s+verb)\b/i,
    answerConfusionHint: 'going_to_will',
    briefing: {
      headlineTr: 'Önceden planladıysan "going to", tam şu an karar verdiysen "will"!',
      headlineEn: 'Already planned → "be going to" | Decided right this second → "will"!',
      goldenRuleTr:
        'Cebinde plan/bilet/niyet varsa veya gözünle gördüğün kanıt varsa ("Look at those dark clouds, it\'s going to rain") → BE GOING TO. Konuşma anında karar, teklif veya söz veriyorsan ("I\'ll help you!") → WILL.',
      goldenRuleEn:
        'Prior plan or visible evidence → BE GOING TO. Spontaneous decision, offer, or promise made right now → WILL.',
      mnemonicTr:
        '💡 Altın Unutma: "going to" tek başına kullanılmaz; önünde mutlaka am/is/are gerekir! ("I am going to play", "I going to" YANLIŞ).',
      mnemonicEn:
        '💡 Never drop am/is/are before "going to": always "I am going to", never "I going to".',
      examples: [
        {
          en: 'I’m going to buy GTA 6 on day one.',
          tr: 'GTA 6’yı ilk günden alacağım. (Önceden verilmiş net plan!)',
          highlight: "'m going to",
        },
        {
          en: 'Oh, your bag looks heavy — I’ll carry it for you!',
          tr: 'Aa, çantan ağır görünüyor — senin için ben taşıyayım! (Anlık teklif)',
          highlight: "I'll",
        },
        {
          en: 'Watch out! That cup is going to fall!',
          tr: 'Dikkat et! O bardak düşecek! (Gözle görülür kanıt)',
          highlight: 'is going to',
        },
        {
          en: 'I going to watch a movie tonight.',
          tr: 'YANLIŞ! "am" unutulmuş → "I AM going to watch a movie tonight."',
          highlight: 'I going → I am going',
          isTrap: true,
          trapNoteTr: '"going to" öncesinde özneye göre am / is / are koymayı unutma.',
          trapNoteEn: 'Always include am / is / are before "going to".',
        },
      ],
      source: 'local',
    },
    duels: [
      {
        promptSentence: 'Wait, you forgot your charger? Don’t worry, I ___ bring mine.',
        promptSubtextTr: 'Dur, şarj aletini mi unuttun? Merak etme, benimkini getiririm. (Anlık karar)',
        promptSubtextEn: 'A spontaneous offer made right at this moment.',
        choices: ['will', 'am going to'],
        correctChoice: 'will',
        fullSentence: "Wait, you forgot your charger? Don't worry, I will bring mine.",
        meaningTr: 'Dur, şarj aletini mi unuttun? Merak etme, benimkini getiririm.',
        explanationTr: 'Tam konuşma anında doğan yardım teklifi için "will" (I\'ll) kullanılır.',
        explanationEn: 'Spontaneous offers made in the moment use "will".',
      },
      {
        promptSentence: 'Look at the dark clouds — it ___ rain any minute.',
        promptSubtextTr: 'Kara bulutlara bak — her an yağmur yağacak. (Gözle görülür kanıt)',
        promptSubtextEn: 'Prediction based on clear visual evidence right now.',
        choices: ['is going to', 'will'],
        correctChoice: 'is going to',
        fullSentence: 'Look at the dark clouds — it is going to rain any minute.',
        meaningTr: 'Kara bulutlara bak — her an yağmur yağacak.',
        explanationTr: 'Gözle görülür kanıta dayalı tahminlerde "be going to" tercih edilir.',
        explanationEn: 'Predictions backed by visible evidence use "be going to".',
      },
    ],
    spotFixes: [
      {
        buggyTokens: ['We', 'going', 'to', 'stream', 'the', 'finals', 'tonight.'],
        buggyTokenIndex: 1,
        fixChoices: ['are going', 'will going', 'went'],
        correctFixToken: 'are going',
        correctedSentence: 'We are going to stream the finals tonight.',
        meaningTr: 'Bu gece finalleri yayınlayacağız.',
        explanationTr: '"going to" önünde "are" eksik → "We are going to".',
        explanationEn: '"We" needs "are" before "going to".',
      },
      {
        buggyTokens: ['I', 'will to', 'send', 'you', 'the', 'link', 'now.'],
        buggyTokenIndex: 1,
        fixChoices: ['will', 'going', 'am'],
        correctFixToken: 'will',
        correctedSentence: 'I will send you the link now.',
        meaningTr: 'Linki sana şimdi göndereceğim.',
        explanationTr: '"will" yardımcı fiilinden sonra ASLA "to" gelmez → "I will send".',
        explanationEn: 'Never put "to" after "will" — connect directly to the base verb ("will send").',
      },
    ],
    scenarios: [
      {
        scenarioTr:
          'Hafta sonu için arkadaşlarınla zaten bilet aldın; planını anlatıyorsun:',
        scenarioEn: 'You already bought concert tickets for the weekend. Share your plan:',
        choices: [
          'We are going to see a rock concert this Saturday.',
          'We will to see a rock concert this Saturday.',
          'We going to see a rock concert this Saturday.',
        ],
        correctChoice: 'We are going to see a rock concert this Saturday.',
        meaningTr: 'Bu cumartesi bir rock konserine gideceğiz.',
        explanationTr: 'Önceden kesinleşmiş planlar için "am/is/are + going to + V1" kullanılır.',
        explanationEn: 'Pre-arranged plans use "be going to + base verb".',
      },
    ],
  },

  conditionals_would: {
    skillId: 'conditionals_would',
    titleTr: 'Koşul Cümleleri (if & would)',
    titleEn: 'Conditionals (if & would)',
    subtitleTr: 'Gerçek olasılık (If + V1, will) vs hayalî durum (If + V2, would)',
    subtitleEn: 'Real future conditions (Type 1) vs hypothetical dreams (Type 2)',
    icon: '🪄',
    sentencePattern: /\b(?:would|wouldn't|if\s+(?:i|you|we|they|he|she|it)\s+(?:had|were|knew|could|didn't|got|won|lived))\b/i,
    conceptPattern: /\b(?:would|conditional|if\s+i\s+were)\b/i,
    briefing: {
      headlineTr: 'Gerçekse "will", hayalse "would" — ve "if" tarafına ASLA "would" koyma!',
      headlineEn: 'Real = "will", Imaginary = "would" — and NEVER put "would" inside the "if" half!',
      goldenRuleTr:
        'Tip 1 (Gerçek ihtimal): If + Geniş Zaman, WILL ("If it rains, I will stay home"). Tip 2 (Hayal / Varsayım): If + Geçmiş Zaman (V2 / were), WOULD ("If I had a million dollars, I would travel").',
      goldenRuleEn:
        'Type 1 (Likely): If + Present, WILL. Type 2 (Hypothetical): If + Past Simple (V2 / were), WOULD + base verb.',
      mnemonicTr:
        '💡 Altın Yasak: "If I would have..." YASAK! "would" her zaman virgülün ÖBÜR (sonuç) tarafında oturur.',
      mnemonicEn:
        '💡 Golden Rule: Never say "If I would...". Keep "would" strictly in the result clause!',
      examples: [
        {
          en: 'If I finish early, I will play a couple of matches.',
          tr: 'Erken bitirirsem birkaç maç oynarım. (Gerçek olasılık)',
          highlight: 'finish ... will play',
        },
        {
          en: 'If I had more free time, I would learn electric guitar.',
          tr: 'Daha fazla boş vaktim olsaydı elektro gitar öğrenirdim. (Hayal)',
          highlight: 'had ... would learn',
        },
        {
          en: 'If I were you, I would take that offer.',
          tr: 'Senin yerinde olsam o teklifi kabul ederdim.',
          highlight: 'were ... would take',
        },
        {
          en: 'If I would win the lottery, I would buy a studio.',
          tr: 'YANLIŞ! "If" tarafında "would" olmaz → "If I WON the lottery, I would buy..."',
          highlight: 'would win → won',
          isTrap: true,
          trapNoteTr: '"If" kelimesinin hemen yanına "would" veya "will" koyma; V2 (won) kullan.',
          trapNoteEn: 'Remove "would" from the if-clause; use simple past ("won").',
        },
      ],
      source: 'local',
    },
    duels: [
      {
        promptSentence: 'If I ___ fluent in Japanese, I would visit Tokyo next year.',
        promptSubtextTr: 'Japoncam akıcı olsaydı seneye Tokyo’yu ziyaret ederdim. (Hayalî durum)',
        promptSubtextEn: 'Hypothetical Type 2 conditional (result uses "would").',
        choices: ['were', 'am'],
        correctChoice: 'were',
        fullSentence: 'If I were fluent in Japanese, I would visit Tokyo next year.',
        meaningTr: 'Japoncam akıcı olsaydı seneye Tokyo’yu ziyaret ederdim.',
        explanationTr: 'Sonuç tarafında "would" olduğu için Tip 2 hayal cümlesidir → "If I were".',
        explanationEn: 'With "would" in the result, use Type 2 past form "were" in the if-clause.',
      },
      {
        promptSentence: 'If you press this shortcut, the app ___ save automatically.',
        promptSubtextTr: 'Bu kısayola basarsan uygulama otomatik kaydedecek. (Gerçek sonuç)',
        promptSubtextEn: 'Real, practical cause and effect (Type 1).',
        choices: ['will', 'would'],
        correctChoice: 'will',
        fullSentence: 'If you press this shortcut, the app will save automatically.',
        meaningTr: 'Bu kısayola basarsan uygulama otomatik kaydedecek.',
        explanationTr: '"press" geniş zaman (Tip 1) olduğu için sonuçta "will" kullanılır.',
        explanationEn: 'Present simple "press" pairs with "will" for real outcomes.',
      },
    ],
    spotFixes: [
      {
        buggyTokens: ['If', 'I', 'am', 'you,', 'I', 'would', 'take', 'that', 'job.'],
        buggyTokenIndex: 2,
        fixChoices: ['were', 'will be', 'would be'],
        correctFixToken: 'were',
        correctedSentence: 'If I were you, I would take that job.',
        meaningTr: 'Senin yerinde olsam o işi kabul ederdim.',
        explanationTr: 'Hayalî tavsiye kalıbında ("If I ... you, I would") her zaman "were" kullanılır.',
        explanationEn: 'Hypothetical advice always uses "If I were you", paired with "would".',
      },
      {
        buggyTokens: ['If', 'she', 'had', 'a', 'car,', 'she', 'will', 'drive', 'to', 'work.'],
        buggyTokenIndex: 6,
        fixChoices: ['would', 'can', 'is'],
        correctFixToken: 'would',
        correctedSentence: 'If she had a car, she would drive to work.',
        meaningTr: 'Arabası olsaydı işe arabayla giderdi.',
        explanationTr: '"If she had" geçmiş zamanlı hayal (Tip 2) olduğu için sonuçta "will" değil "would" gelir.',
        explanationEn: 'Hypothetical "If she had..." pairs with "would", not "will".',
      },
    ],
    scenarios: [
      {
        scenarioTr:
          'Arkadaşına "Senin yerinde olsam o eski bilgisayarı satmazdım" tavsiyesini ver:',
        scenarioEn: 'Give advice starting with "If I were you":',
        choices: [
          "If I were you, I wouldn't sell that old PC.",
          "If I would be you, I won't sell that old PC.",
          "If I am you, I wouldn't sold that old PC.",
        ],
        correctChoice: "If I were you, I wouldn't sell that old PC.",
        meaningTr: 'Senin yerinde olsam o eski bilgisayarı satmazdım.',
        explanationTr: 'Sabit ve doğal İngilizce kalıp: "If I were you, I would / wouldn\'t + V1".',
        explanationEn: 'Standard natural pattern: "If I were you, I would/wouldn\'t + base verb".',
      },
    ],
  },

  contrast_linkers: {
    skillId: 'contrast_linkers',
    titleTr: 'Zıtlık & Şart Bağlaçları (although / despite / unless)',
    titleEn: 'Contrast & Condition Linkers (although / despite / unless)',
    subtitleTr: '"-e rağmen" (although vs despite) ve "-medikçe" (unless) tuzakları',
    subtitleEn: 'Mastering although vs despite and the negative trap of unless',
    icon: '🔀',
    sentencePattern: /\b(?:although|even\s+though|though|despite|in\s+spite\s+of|unless|however|whereas)\b/i,
    conceptPattern: /\b(?:although|despite|unless|however|contrast)\b/i,
    briefing: {
      headlineTr: '"Although" + CÜMLE | "Despite" + İSİM/-ING | "Unless" = IF NOT!',
      headlineEn: '"Although" + CLAUSE | "Despite" + NOUN/-ING | "Unless" = IF NOT!',
      goldenRuleTr:
        '"Although / Even though" ardından özne+fiil (tam cümle) ister. "Despite" ardından sadece isim veya V-ing ister ("despite of" ASLA denmez!). "Unless" içinde zaten olumsuzluk ("-medikçe") barındırır.',
      goldenRuleEn:
        '"Although" takes subject + verb. "Despite" takes a noun or -ing (NEVER "despite of"!). "Unless" already means "if not", so do not add a second negative.',
      mnemonicTr:
        '💡 2 Altın Kısayol: 1) DESPITE kelimesi "of" sevmez ("in spite OF" sever!). 2) UNLESS gördüğünde kafanda "eğer ...-mezse" diye çevir.',
      mnemonicEn:
        '💡 Two Golden Shortcuts: 1) Never write "despite of". 2) Translate "unless" mentally as "if ... not".',
      examples: [
        {
          en: 'Although it was raining, we still went to the concert.',
          tr: 'Yağmur yağmasına rağmen yine de konsere gittik.',
          highlight: 'Although it was',
        },
        {
          en: 'Despite the rain, we still went to the concert.',
          tr: 'Yağmura rağmen yine de konsere gittik.',
          highlight: 'Despite the rain',
        },
        {
          en: 'You won’t level up unless you practice.',
          tr: 'Pratik yapmadıkça seviye atlayamazsın.',
          highlight: 'unless',
        },
        {
          en: 'Despite of the lag, I won the match.',
          tr: 'YANLIŞ! "Despite" ardından "of" konmaz → "Despite the lag, I won."',
          highlight: 'Despite of → Despite',
          isTrap: true,
          trapNoteTr: 'Ya "Despite the lag" de, ya da "In spite of the lag" de; ikisini karıştırma!',
          trapNoteEn: 'Say either "Despite the lag" or "In spite of the lag" — never mix them.',
        },
      ],
      source: 'local',
    },
    duels: [
      {
        promptSentence: '___ being tired, he stayed up to finish the episode.',
        promptSubtextTr: 'Yorgun olmasına rağmen bölümü bitirmek için uyanık kaldı.',
        promptSubtextEn: 'Followed directly by "-ing" ("being tired"), not a full subject+verb.',
        choices: ['Despite', 'Although'],
        correctChoice: 'Despite',
        fullSentence: 'Despite being tired, he stayed up to finish the episode.',
        meaningTr: 'Yorgun olmasına rağmen bölümü bitirmek için uyanık kaldı.',
        explanationTr: 'Arkasından özne+fiil değil "-ing" (being tired) geldiği için "Despite" doğrudur.',
        explanationEn: 'Followed by an -ing gerund ("being tired"), so "Despite" is required.',
      },
      {
        promptSentence: 'We can’t start the raid ___ everyone joins voice chat.',
        promptSubtextTr: 'Herkes sesli sohbete katılmadıkça baskını başlatamayız.',
        promptSubtextEn: 'Means "if everyone does not join".',
        choices: ['unless', 'despite'],
        correctChoice: 'unless',
        fullSentence: "We can't start the raid unless everyone joins voice chat.",
        meaningTr: 'Herkes sesli sohbete katılmadıkça baskını başlatamayız.',
        explanationTr: '"-medikçe / eğer ...-mezse" koşulu için "unless" kullanılır.',
        explanationEn: '"unless" expresses "if ... not" ("if everyone does not join").',
      },
    ],
    spotFixes: [
      {
        buggyTokens: ['Although', 'the', 'high', 'price,', 'everyone', 'bought', 'it.'],
        buggyTokenIndex: 0,
        fixChoices: ['Despite', 'Unless', 'Because'],
        correctFixToken: 'Despite',
        correctedSentence: 'Despite the high price, everyone bought it.',
        meaningTr: 'Yüksek fiyatına rağmen herkes onu aldı.',
        explanationTr: '"the high price" bir isim tamlamasıdır (fiil yok) → "Although" yerine "Despite" gerekir.',
        explanationEn: '"the high price" is a noun phrase with no verb, so use "Despite".',
      },
      {
        buggyTokens: ["Don't", 'close', 'the', 'tabs', 'unless', 'they', "don't freeze."],
        buggyTokenIndex: 6,
        fixChoices: ['freeze.', 'not freeze.', 'never freeze.'],
        correctFixToken: 'freeze.',
        correctedSentence: "Don't close the tabs unless they freeze.",
        meaningTr: 'Donmadıkça sekmeleri kapatma.',
        explanationTr: '"unless" zaten olumsuzdur ("-medikçe"); yanına ikinci bir "don\'t" koyarsan anlam tersine döner!',
        explanationEn: '"unless" is already negative; remove "don\'t" to avoid a double negative.',
      },
    ],
    scenarios: [
      {
        scenarioTr:
          'Çok trafik olmasına rağmen toplantıya zamanında yetiştiğini söyle:',
        scenarioEn: 'Say you arrived on time even though traffic was terrible:',
        choices: [
          'Although traffic was terrible, I made it on time.',
          'Despite traffic was terrible, I made it on time.',
          'Despite of terrible traffic, I made it on time.',
        ],
        correctChoice: 'Although traffic was terrible, I made it on time.',
        meaningTr: 'Trafik berbat olmasına rağmen zamanında yetiştim.',
        explanationTr: '"traffic was terrible" tam bir cümle olduğu için "Although" ile bağlanır.',
        explanationEn: '"traffic was terrible" is a full clause, so pair it with "Although".',
      },
    ],
  },

  time_clauses: {
    skillId: 'time_clauses',
    titleTr: 'Zaman Bağlaçları (until / as soon as / when)',
    titleEn: 'Time Clauses (until / as soon as / when)',
    subtitleTr: '"-e kadar" (until), "-er -mez" (as soon as) ve gelecek zamanda "will" yasağı',
    subtitleEn: 'Using until, as soon as, and present tense inside future time clauses',
    icon: '⏱️',
    sentencePattern: /\b(?:until|till|as\s+soon\s+as|by\s+the\s+time|before|after|while|when\s+[a-z]+(?:ing|s|ed)?)\b/i,
    conceptPattern: /\b(?:until|as\s+soon\s+as|time\s+clause|when\s+getting|didn't\s+arrive\s+until)\b/i,
    briefing: {
      headlineTr: 'Gelecekten bahsetsen bile "when / as soon as / until" yanına WILL koyma!',
      headlineEn: 'Even for the future, NEVER put "will" after when / as soon as / until!',
      goldenRuleTr:
        '• "until" = -e kadar ("didn\'t arrive until 9" = 9’a kadar gelmedi / ancak 9’da geldi)\n• "as soon as" = -er -mez ("Call me as soon as you land")\n• Altın kural: Zaman bağlacının içinde Geniş Zaman (V1) kullanılır, "will" ana cümlede durur!',
      goldenRuleEn:
        '• "until" = up to a point in time\n• "as soon as" = immediately when\n• Golden rule: Use Present Simple after when / as soon as / until — put "will" only in the main clause!',
      mnemonicTr:
        '💡 Türkçe Tercüme Tuzağı: "He didn\'t arrive until noon" → "Öğlene kadar gelmedi" (yani ancak öğlen geldi). "When getting off the train" = "Trenden inerken".',
      mnemonicEn:
        '💡 Shortcut: "as soon as I get home" (NOT "as soon as I will get home").',
      examples: [
        {
          en: 'Text me as soon as you get home.',
          tr: 'Eve varır varmaz bana mesaj at.',
          highlight: 'as soon as you get',
        },
        {
          en: 'The update didn’t drop until midnight.',
          tr: 'Güncelleme gece yarısına kadar çıkmadı (ancak gece yarısı çıktı).',
          highlight: "didn't ... until",
        },
        {
          en: 'Be careful when getting off the train.',
          tr: 'Trenden inerken dikkatli ol.',
          highlight: 'when getting off',
        },
        {
          en: 'I will call you when I will arrive.',
          tr: 'YANLIŞ! İkinci "will" fazladır → "I will call you when I ARRIVE."',
          highlight: 'will arrive → arrive',
          isTrap: true,
          trapNoteTr: '"when / before / after / as soon as" sonrasındaki fiilde "will" kullanılmaz.',
          trapNoteEn: 'Drop "will" inside the time clause: "when I arrive".',
        },
      ],
      source: 'local',
    },
    duels: [
      {
        promptSentence: 'I’ll start downloading the game as soon as I ___ home.',
        promptSubtextTr: 'Eve varır varmaz oyunu indirmeye başlayacağım.',
        promptSubtextEn: 'Future time clause introduced by "as soon as".',
        choices: ['get', 'will get'],
        correctChoice: 'get',
        fullSentence: "I'll start downloading the game as soon as I get home.",
        meaningTr: 'Eve varır varmaz oyunu indirmeye başlayacağım.',
        explanationTr: '"as soon as" zaman bağlacı içinde gelecek zaman olsa da Geniş Zaman ("get") kullanılır.',
        explanationEn: 'After "as soon as", use present simple ("get"), never "will get".',
      },
      {
        promptSentence: 'Don’t close the browser ___ the backup finishes.',
        promptSubtextTr: 'Yedekleme bitene kadar tarayıcıyı kapatma.',
        promptSubtextEn: 'Up to the moment when the backup finishes.',
        choices: ['until', 'as soon as'],
        correctChoice: 'until',
        fullSentence: "Don't close the browser until the backup finishes.",
        meaningTr: 'Yedekleme bitene kadar tarayıcıyı kapatma.',
        explanationTr: '"-e kadar" anlamı "until" ile verilir.',
        explanationEn: '"up to the point that" = "until".',
      },
    ],
    spotFixes: [
      {
        buggyTokens: ['Let', 'me', 'know', 'when', 'you', 'will be', 'ready.'],
        buggyTokenIndex: 5,
        fixChoices: ['are', 'were', 'had'],
        correctFixToken: 'are',
        correctedSentence: 'Let me know when you are ready.',
        meaningTr: 'Hazır olduğunda bana haber ver.',
        explanationTr: '"when" yan cümlesinde "will be" yerine "are" kullanılır.',
        explanationEn: 'Replace "will be" with present simple "are" after "when".',
      },
      {
        buggyTokens: ['They', 'waited', 'as soon as', 'the', 'rain', 'stopped.'],
        buggyTokenIndex: 2,
        fixChoices: ['until', 'during', 'since'],
        correctFixToken: 'until',
        correctedSentence: 'They waited until the rain stopped.',
        meaningTr: 'Yağmur durana kadar beklediler.',
        explanationTr: '"wait" (beklemek) fiili bir noktaya kadar sürdüğü için "until" ile tamamlanır.',
        explanationEn: '"wait" pairs naturally with "until", not "as soon as".',
      },
    ],
    scenarios: [
      {
        scenarioTr:
          'Arkadaşına "Toplantı biter bitmez sana yazacağım" diyeceksin:',
        scenarioEn: 'Tell your friend you will message them right after the meeting ends:',
        choices: [
          "I'll text you as soon as the meeting ends.",
          "I'll text you as soon as the meeting will end.",
          "I'll text you until the meeting ends.",
        ],
        correctChoice: "I'll text you as soon as the meeting ends.",
        meaningTr: 'Toplantı biter bitmez sana yazacağım.',
        explanationTr: '"-er -mez" = "as soon as" + Geniş Zaman ("ends").',
        explanationEn: '"as soon as" + present simple ("ends") expresses immediate future sequence.',
      },
    ],
  },

  phrasal_verbs: {
    skillId: 'phrasal_verbs',
    titleTr: 'Phrasal Verbs (Deyimsel Fiiller)',
    titleEn: 'Phrasal Verbs (Verb + Particle)',
    subtitleTr: 'Fiil + edat birleşince değişen anlamlar (get off, take away, cut short, speak out)',
    subtitleEn: 'Two-part verbs whose meaning shifts with the particle',
    icon: '🧩',
    sentencePattern: /\b(?:get(?:ting)?\s+(?:off|on|over|up|rid\s+of)|take(?:n|s|ing)?\s+(?:away|off|over|up|care\s+of)|cut\s+[\w\s]{0,18}\bshort|speak(?:ing)?\s+out|give\s+up|turn\s+(?:on|off|down|up)|look\s+(?:forward\s+to|after|up|for)|figure\s+out|run\s+out\s+of|put\s+off|hang\s+out|work\s+out|show\s+up|break\s+down|carry\s+out|find\s+out|set\s+up)\b/i,
    conceptPattern: /\b(?:phrasal|take\s+away|cut\s+short|get\s+off|speak\s+out|give\s+up|figure\s+out|put\s+off|run\s+out)\b/i,
    briefing: {
      headlineTr: 'Tek bir edat, fiilin anlamını tamamen değiştirir: kelime kelime değil BLOK olarak oku!',
      headlineEn: 'One tiny particle changes the whole verb — read phrasal verbs as a single block!',
      goldenRuleTr:
        'Fiili ve yanındaki edatı (off, out, up, away, short) birlikte tek kelime gibi düşün! Örnekler: "cut [something] short" = yarıda kesmek, "take away" = elinden almak / paket servis, "get off" = araçtan inmek, "speak out" = sesini yükseltmek / açıkça konuşmak.',
      goldenRuleEn:
        'Treat verb + particle as one vocabulary unit. Watch for split phrasal verbs where the object sits in the middle: "cut the trip short", "figure it out".',
      mnemonicTr:
        '💡 Edat Şifresi: OUT = dışarı/çözmek (figure out, speak out) | OFF = ayrılmak/ertelemek (get off, put off) | UP = tamamlamak/pes etmek (give up, show up).',
      mnemonicEn:
        '💡 Particle Decoder: OUT = solve/voice (figure out, speak out) | OFF = detach/delay (get off, put off) | UP = finish/quit (give up, show up).',
      examples: [
        {
          en: 'We had to cut our vacation short because of work.',
          tr: 'İş yüzünden tatilimizi yarıda kesmek zorunda kaldık.',
          highlight: 'cut ... short',
        },
        {
          en: 'Don’t give up — you’ll figure it out soon!',
          tr: 'Pes etme — yakında çözeceksin!',
          highlight: 'give up / figure it out',
        },
        {
          en: 'Always check your bag before getting off the bus.',
          tr: 'Otobüsten inmeden önce her zaman çantanı kontrol et.',
          highlight: 'getting off',
        },
        {
          en: 'I need to figure out it before tomorrow.',
          tr: 'YANLIŞ! "it / them / him" zamirleri araya girer → "figure IT out"!',
          highlight: 'figure out it → figure it out',
          isTrap: true,
          trapNoteTr: 'Kısa zamirler (it, me, them) her zaman phrasal verb’ün ORTASINA konur: "turn it off", "figure it out".',
          trapNoteEn: 'Pronouns like "it/them" must sit in the middle: "figure it out", never "figure out it".',
        },
      ],
      source: 'local',
    },
    duels: [
      {
        promptSentence: 'I finally ___ why the code wasn’t compiling!',
        promptSubtextTr: 'Kodun neden derlenmediğini sonunda çözdüm!',
        promptSubtextEn: '"Solve / understand" = figure out vs give up.',
        choices: ['figured out', 'gave up'],
        correctChoice: 'figured out',
        fullSentence: "I finally figured out why the code wasn't compiling!",
        meaningTr: 'Kodun neden derlenmediğini sonunda çözdüm!',
        explanationTr: '"figure out" = çözmek / anlamak; "give up" = pes etmek.',
        explanationEn: '"figure out" = solve/understand; "give up" = quit.',
      },
      {
        promptSentence: 'We had to ___ our trip short due to the storm.',
        promptSubtextTr: 'Fırtına yüzünden gezimizi yarıda kesmek zorunda kaldık.',
        promptSubtextEn: 'Idiom for ending something earlier than planned.',
        choices: ['cut', 'take'],
        correctChoice: 'cut',
        fullSentence: 'We had to cut our trip short due to the storm.',
        meaningTr: 'Fırtına yüzünden gezimizi yarıda kesmek zorunda kaldık.',
        explanationTr: '"cut [something] short" = bir şeyi planlanandan erken bitirmek / yarıda kesmek.',
        explanationEn: '"cut [something] short" means ending an activity earlier than planned.',
      },
      {
        promptSentence: 'Don’t forget your umbrella when you ___ the subway.',
        promptSubtextTr: 'Metrodan inerken şemsiyeni unutma.',
        promptSubtextEn: 'Exiting a bus, train, or subway.',
        choices: ['get off', 'get over'],
        correctChoice: 'get off',
        fullSentence: "Don't forget your umbrella when you get off the subway.",
        meaningTr: 'Metrodan inerken şemsiyeni unutma.',
        explanationTr: '"get off" = otobüs/tren/metrodan inmek; "get over" = bir şeyi atlatmak.',
        explanationEn: '"get off" = exit transit; "get over" = recover from something.',
      },
    ],
    spotFixes: [
      {
        buggyTokens: ['That', 'song', 'is', 'too', 'loud,', 'please', 'turn down it.'],
        buggyTokenIndex: 6,
        fixChoices: ['turn it down.', 'it turn down.', 'down turn it.'],
        correctFixToken: 'turn it down.',
        correctedSentence: 'That song is too loud, please turn it down.',
        meaningTr: 'O şarkı çok yüksek, lütfen sesini kıs.',
        explanationTr: '"it" zamiri phrasal verb’ün sonuna değil ORTASINA konur: "turn IT down"!',
        explanationEn: 'Pronouns like "it" always go in the middle of a separable phrasal verb: "turn it down".',
      },
      {
        buggyTokens: ['We', 'ran', 'out', 'from', 'coffee', 'beans', 'this', 'morning.'],
        buggyTokenIndex: 3,
        fixChoices: ['of', 'off', 'with'],
        correctFixToken: 'of',
        correctedSentence: 'We ran out of coffee beans this morning.',
        meaningTr: 'Bu sabah kahve çekirdeğimiz bitti.',
        explanationTr: 'Bir şeyin tükenmesi kalıbı her zaman "run out OF" şeklindedir.',
        explanationEn: 'The fixed phrasal verb is always "run out OF".',
      },
    ],
    scenarios: [
      {
        scenarioTr:
          'Önemli bir görevi ertelemeyi bırakman gerektiğini arkadaşınla paylaş:',
        scenarioEn: 'Say you need to stop delaying your big project:',
        choices: [
          'I need to stop putting off this project.',
          'I need to stop putting out this project.',
          'I need to stop taking off this project.',
        ],
        correctChoice: 'I need to stop putting off this project.',
        meaningTr: 'Bu projeyi ertelemeyi bırakmam lazım.',
        explanationTr: '"put off" = ertelemek; "put out" = söndürmek; "take off" = havalanmak/çıkarmak.',
        explanationEn: '"put off" means postpone/delay.',
      },
    ],
  },

  prepositions_core: {
    skillId: 'prepositions_core',
    titleTr: 'Kritik Edatlar (in / on / at / for / since)',
    titleEn: 'Core Prepositions (in / on / at / for / since)',
    subtitleTr: 'Zaman ve yer piramidi + "for" (süre) vs "since" (başlangıç) ayrımı',
    subtitleEn: 'The IN → ON → AT pyramid plus FOR (duration) vs SINCE (start point)',
    icon: '📍',
    sentencePattern: /\b(?:in\s+(?:the\s+morning|the\s+evening|20\d\d|january|summer)|on\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|time|the\s+weekend)|at\s+(?:night|noon|midnight|\d{1,2}(?::\d{2})?|the\s+moment)|for\s+(?:\d+|a\s+long|three|two|five|many)\s+(?:days|hours|years|weeks|minutes)|since\s+(?:20\d\d|yesterday|monday|last))\b/i,
    conceptPattern: /\b(?:for_since|preposition|in\s*\/\s*on\s*\/\s*at|for\s+vs\s+since)\b/i,
    answerConfusionHint: 'preposition',
    briefing: {
      headlineTr: 'Ters Piramit: IN (Geniş) → ON (Gün/Yüzey) → AT (Nokta Saat/Konum)!',
      headlineEn: 'Inverted Pyramid: IN (Big) → ON (Days/Surfaces) → AT (Exact Point)!',
      goldenRuleTr:
        '• IN: Aylar, yıllar, mevsimler, kapalı alanlar (in 2026, in the morning, in Istanbul)\n• ON: Günler, tarihler, yüzeyler (on Friday, on May 5, on the desk)\n• AT: Kesin saatler ve tam noktalar (at 8:00, at night, at the door)\n• FOR = toplam süre (for 3 days) | SINCE = başlangıç noktası (since Monday).',
      goldenRuleEn:
        '• IN = months, years, seasons, enclosed spaces\n• ON = days, dates, surfaces\n• AT = exact clock times, night, specific spots\n• FOR = length of time | SINCE = starting point.',
      mnemonicTr:
        '💡 Süre Testi: Sayı + zaman birimi (3 days, 2 hours) görüyorsan → FOR! Takvimde parmakla gösterebildiğin başlangıç anı (2022, Monday, 8 AM) → SINCE!',
      mnemonicEn:
        '💡 Duration Test: Countable length ("3 days") → FOR. Calendar point ("Monday", "2022") → SINCE.',
      examples: [
        {
          en: 'The concert starts at 9 PM on Saturday.',
          tr: 'Konser cumartesi günü saat 9’da başlıyor.',
          highlight: 'at 9 PM on Saturday',
        },
        {
          en: 'GTA 6 is expected to launch in autumn.',
          tr: 'GTA 6’nın sonbaharda çıkması bekleniyor.',
          highlight: 'in autumn',
        },
        {
          en: 'I have been learning English for six months.',
          tr: 'Altı aydır İngilizce öğreniyorum.',
          highlight: 'for six months',
        },
        {
          en: 'See you in Monday at the morning!',
          tr: 'YANLIŞ! Günler ON, günün bölümleri IN alır → "ON Monday IN the morning!"',
          highlight: 'in Monday → on Monday',
          isTrap: true,
          trapNoteTr: 'Haftanın günleri her zaman ON (on Monday), "morning/afternoon/evening" ise IN alır.',
          trapNoteEn: 'Days of the week always take ON; parts of the day take IN (except AT night).',
        },
      ],
      source: 'local',
    },
    duels: [
      {
        promptSentence: 'Our gaming session starts ___ Friday night.',
        promptSubtextTr: 'Oyun oturumumuz cuma gecesi başlıyor.',
        promptSubtextEn: 'Specific day of the week ("Friday night").',
        choices: ['on', 'in'],
        correctChoice: 'on',
        fullSentence: 'Our gaming session starts on Friday night.',
        meaningTr: 'Oyun oturumumuz cuma gecesi başlıyor.',
        explanationTr: 'İçinde gün adı (Friday) geçtiği için her zaman "on" kullanılır.',
        explanationEn: 'Whenever a day name ("Friday") is included, use "on".',
      },
      {
        promptSentence: 'He has played guitar ___ he was twelve.',
        promptSubtextTr: 'On iki yaşından beri gitar çalıyor.',
        promptSubtextEn: 'A starting point in time, not a total length.',
        choices: ['since', 'for'],
        correctChoice: 'since',
        fullSentence: 'He has played guitar since he was twelve.',
        meaningTr: 'On iki yaşından beri gitar çalıyor.',
        explanationTr: 'Başlangıç anını ("12 yaşından beri") gösterdiği için "since" doğrudur.',
        explanationEn: 'Marking the starting point requires "since", not "for".',
      },
    ],
    spotFixes: [
      {
        buggyTokens: ['The', 'train', 'departs', 'in', '7:30', 'sharp.'],
        buggyTokenIndex: 3,
        fixChoices: ['at', 'on', 'for'],
        correctFixToken: 'at',
        correctedSentence: 'The train departs at 7:30 sharp.',
        meaningTr: 'Tren tam 7:30’da kalkıyor.',
        explanationTr: 'Kesin saatler her zaman "at" alır → "at 7:30".',
        explanationEn: 'Exact clock times always use "at".',
      },
      {
        buggyTokens: ['I', 'have', 'waited', 'since', 'two', 'hours!'],
        buggyTokenIndex: 3,
        fixChoices: ['for', 'at', 'on'],
        correctFixToken: 'for',
        correctedSentence: 'I have waited for two hours!',
        meaningTr: 'İki saattir bekliyorum!',
        explanationTr: '"two hours" bir başlangıç değil toplam süredir → "for two hours".',
        explanationEn: '"two hours" is a duration, so it must take "for".',
      },
    ],
    scenarios: [
      {
        scenarioTr:
          'Toplantının Salı günü saat 10’da olacağını net bir şekilde yaz:',
        scenarioEn: 'Confirm the meeting time (Tuesday, 10 AM) clearly:',
        choices: [
          'The meeting is on Tuesday at 10 AM.',
          'The meeting is in Tuesday on 10 AM.',
          'The meeting is at Tuesday in 10 AM.',
        ],
        correctChoice: 'The meeting is on Tuesday at 10 AM.',
        meaningTr: 'Toplantı Salı günü saat 10’da.',
        explanationTr: 'Gün = ON Tuesday | Kesin saat = AT 10 AM.',
        explanationEn: 'Day = ON Tuesday; exact clock time = AT 10 AM.',
      },
    ],
  },

  word_order_syntax: {
    skillId: 'word_order_syntax',
    titleTr: 'İngilizce Cümle Dizilimi (SVO Kuralı)',
    titleEn: 'English Word Order (SVO Syntax)',
    subtitleTr: 'Türkçeden farklı dizilim: Özne → Fiil → Nesne → Yer → Zaman',
    subtitleEn: 'Keeping Subject → Verb → Object → Place → Time in natural English order',
    icon: '🧱',
    sentencePattern: /\b(?:never|always|usually|often|sometimes|building|teach|every\s+day|very\s+much)\b/i,
    conceptPattern: /\b(?:word\s+order|syntax|svo|dizilim)\b/i,
    answerConfusionHint: 'word_order',
    briefing: {
      headlineTr: 'Türkçede fiil sonda oturur; İngilizcede FİİL 2. SIRADAN ASLA KIPIRDAMAZ!',
      headlineEn: 'In English, the VERB stays locked right after the Subject (S → V → O)!',
      goldenRuleTr:
        'Düz cümlede sıra: [ÖZNE] + [FİİL] + [NESNE] + [YER] + [ZAMAN].\nSoru cümlesinde sadece yardımcı fiil başa geçer: [Are] [the birds] [building] [a nest]?\nEmir cümlesinde "Don\'t / Never" en başta durur: "Don\'t ever..." / "Never teach...".',
      goldenRuleEn:
        'Statements follow: Subject + Verb + Object + Place + Time.\nQuestions pull ONLY the auxiliary before the subject: "Are the birds building a nest?"\nNegative imperatives lead with "Don\'t" or "Never" (never both together!).',
      mnemonicTr:
        '💡 3 Altın Kontrol: 1) Özne ile fiilin arasına uzun nesne sokma! 2) "very much" cümlenin SONUNA gider ("I like rock music very much"). 3) "Don\'t" ve "Never" yan yana gelmez!',
      mnemonicEn:
        '💡 3 Checks: 1) Never split Verb and Object. 2) Place "very much" at the end. 3) Never stack "Don\'t" + "Never".',
      examples: [
        {
          en: 'The birds are building a nest in the tree.',
          tr: 'Kuşlar ağaçta bir yuva yapıyorlar. (Özne → Yardımcı+Fiil → Nesne → Yer)',
          highlight: 'The birds are building',
        },
        {
          en: 'I listen to rock music every morning.',
          tr: 'Her sabah rock müzik dinlerim. (Zaman ifadesi en sonda!)',
          highlight: 'listen to rock music every morning',
        },
        {
          en: 'Never teach a fish to swim.',
          tr: 'Bir balığa asla yüzmeyi öğretme. (Tek olumsuzluk: Never)',
          highlight: 'Never teach',
        },
        {
          en: 'I very much like playing GTA 6.',
          tr: 'YANLIŞ! "very much" fiil ile nesne arasına girmez → "I like playing GTA 6 VERY MUCH."',
          highlight: 'very much → end of sentence',
          isTrap: true,
          trapNoteTr: 'İngilizcede "like" ile nesnesini ayırma; derece zarfını ("very much / a lot") sona at.',
          trapNoteEn: 'Keep verb and object together; move "very much / a lot" to the end.',
        },
      ],
      source: 'local',
    },
    duels: [
      {
        promptSentence: 'Which sentence has natural English word order?',
        promptSubtextTr: 'Hangisi doğal İngilizce cümle dizilimine sahip?',
        promptSubtextEn: 'Check Subject → Auxiliary + Verb → Object order.',
        choices: [
          'The birds are building a nest.',
          'Are the birds building a nest.',
        ],
        correctChoice: 'The birds are building a nest.',
        fullSentence: 'The birds are building a nest.',
        meaningTr: 'Kuşlar bir yuva yapıyorlar.',
        explanationTr: 'Düz cümlede özne ("The birds") yardımcı fiilden ("are") önce gelir. "Are" başta olursa soru olur.',
        explanationEn: 'In a statement, the subject ("The birds") precedes "are".',
      },
      {
        promptSentence: 'Which negative advice is grammatically correct?',
        promptSubtextTr: 'Hangisi dilbilgisi olarak doğru bir olumsuz uyarıdır?',
        promptSubtextEn: 'Avoid double negatives ("Never + Don\'t").',
        choices: [
          'Never teach a fish to swim.',
          'Never don’t teach swim to fish.',
        ],
        correctChoice: 'Never teach a fish to swim.',
        fullSentence: 'Never teach a fish to swim.',
        meaningTr: 'Bir balığa asla yüzmeyi öğretme.',
        explanationTr: '"Never" ve "Don\'t" birlikte kullanılmaz; ayrıca "teach [kime] to [ne]" sırası korunur.',
        explanationEn: 'Never stack "Never" + "Don\'t", and keep "teach [someone] to [verb]".',
      },
    ],
    spotFixes: [
      {
        buggyTokens: ['The', 'birds', 'building are', 'a', 'nest', 'outside.'],
        buggyTokenIndex: 2,
        fixChoices: ['are building', 'is building', 'built are'],
        correctFixToken: 'are building',
        correctedSentence: 'The birds are building a nest outside.',
        meaningTr: 'Kuşlar dışarıda bir yuva yapıyorlar.',
        explanationTr: 'Yardımcı fiil ("are") ana fiilden ("building") her zaman ÖNCE gelir.',
        explanationEn: 'The auxiliary ("are") always comes BEFORE the main verb ("building").',
      },
      {
        buggyTokens: ['I', 'like very much', 'playing', 'GTA', '6.'],
        buggyTokenIndex: 1,
        fixChoices: ['really like', 'very like', 'much like'],
        correctFixToken: 'really like',
        correctedSentence: 'I really like playing GTA 6.',
        meaningTr: 'GTA 6 oynamayı gerçekten seviyorum.',
        explanationTr: '"very much" fiille nesne arasına girmez; fiil öncesinde "really like", cümle sonunda "very much" kullanılır.',
        explanationEn: 'Never split verb and object with "very much"; use "really like" before the verb or "very much" at the end.',
      },
    ],
    scenarios: [
      {
        scenarioTr:
          '"Her akşam evde rock müzik dinlerim" cümlesini doğru İngilizce dizilimle seç (Özne → Fiil → Nesne → Yer → Zaman):',
        scenarioEn: 'Pick the sentence with SVO + Place + Time order:',
        choices: [
          'I listen to rock music at home every evening.',
          'I every evening at home listen to rock music.',
          'Listen I rock music to every evening at home.',
        ],
        correctChoice: 'I listen to rock music at home every evening.',
        meaningTr: 'Her akşam evde rock müzik dinlerim.',
        explanationTr: 'Sıra kusursuz: I (Özne) → listen to (Fiil) → rock music (Nesne) → at home (Yer) → every evening (Zaman).',
        explanationEn: 'Exact SVO + Place + Time sequence: I → listen to → rock music → at home → every evening.',
      },
    ],
  },

  listening_gap: {
    skillId: 'listening_gap',
    titleTr: 'Dinleme & Kısaltma Yakalama',
    titleEn: 'Listening & Connected Speech',
    subtitleTr: 'Hızlı konuşmada yutulan küçük kelimeler (is, has been, eat, to, a/the)',
    subtitleEn: 'Catching reduced words & contractions in fast spoken English',
    icon: '🎧',
    sentencePattern: /\b(?:can't|won't|didn't|has\s+been|have\s+been|going\s+to|want\s+to|a\s+lot\s+of|there's|it's)\b/i,
    conceptPattern: /\b(?:listening|dictation|audio|dinleme)\b/i,
    answerConfusionHint: 'listening',
    briefing: {
      headlineTr: 'Kulak kelimeleri kaçırmıyor — İngilizcede küçük kelimeler hızlanınca birleşir!',
      headlineEn: 'Your ears are fine — small function words just blend together in fast speech!',
      goldenRuleTr:
        'İngilizce konuşulurken anlam taşıyan kelimeler (raw, fish, dog, missing) VURGULU, ara köprü kelimeler (has, been, eat, a, to, of) HIZLI ve alçak söylenir. Dinledikten sonra mutlaka "Eksik fiil var mı?" kontrolü yap!',
      goldenRuleEn:
        'Content words (nouns, main verbs) are stressed; function words (has, been, a, to, of) are spoken fast and softly. Always check if your sentence has a complete verb!',
      mnemonicTr:
        '💡 Dinleme Kontrolü: "My dog missing" yazdığında dur! İngilizcede fiilsiz cümle olmaz → "My dog HAS BEEN missing" veya "is missing" olmalı. "I can\'t raw fish" → fiil nerede? "I can\'t EAT raw fish"!',
      mnemonicEn:
        '💡 Grammar Safety Net: If your dictation lacks a main verb ("I can\'t raw fish"), replay slowly and listen for the linked verb ("eat")!',
      examples: [
        {
          en: 'I can’t eat raw fish.',
          tr: 'Çiğ balık yiyemem. ("can’t eat" hızlı konuşmada "ken-tiit" gibi tek kelime duyulur!)',
          highlight: "can't eat",
        },
        {
          en: 'My dog has been missing for three days.',
          tr: 'Köpeğim üç gündür kayıp. ("has been" hızlıca "hez-bin" olarak geçer)',
          highlight: 'has been',
        },
        {
          en: 'I can’t wait to play GTA 6.',
          tr: 'GTA 6 oynamak için sabırsızlanıyorum. ("wait to" → "weyt-tı" şeklinde birleşir)',
          highlight: 'wait to',
        },
        {
          en: 'My dog missing for three days.',
          tr: 'YANLIŞ! Yutulan yardımcı fiil eksik → "My dog HAS BEEN missing for three days."',
          highlight: 'missing → has been missing',
          isTrap: true,
          trapNoteTr: 'Dikte sonrası cümleni 2 saniye gözden geçir: Her İngilizce cümlede mutlaka bir çekimli fiil vardır.',
          trapNoteEn: 'Scan your dictation for a missing verb — every complete English clause needs one.',
        },
      ],
      source: 'local',
    },
    duels: [
      {
        promptSentence: 'Listen closely: "I can’t ___ raw fish." (Hızlı konuşmada kaybolan fiili bul!)',
        promptSubtextTr: 'Çiğ balık yiyemem — eksik ana fiili seç.',
        promptSubtextEn: '"can\'t" is a modal and MUST be followed by a verb.',
        choices: ['eat', 'to'],
        correctChoice: 'eat',
        fullSentence: "I can't eat raw fish.",
        meaningTr: 'Çiğ balık yiyemem.',
        explanationTr: '"can\'t" sonrasında mutlaka yalın bir fiil gerekir ("eat"); hızlı konuşmada t + e birleşir.',
        explanationEn: 'Modal "can\'t" requires a base verb ("eat"), which links tightly to the /t/ sound.',
      },
      {
        promptSentence: 'My dog ___ missing for three days.',
        promptSubtextTr: 'Köpeğim üç gündür kayıp (yutulan yardımcı fiili tamamla).',
        promptSubtextEn: 'Look at "for three days" + "missing".',
        choices: ['has been', 'being'],
        correctChoice: 'has been',
        fullSentence: 'My dog has been missing for three days.',
        meaningTr: 'Köpeğim üç gündür kayıp.',
        explanationTr: '"for three days" geçmişten bugüne sürdüğü için "has been" gerekir.',
        explanationEn: 'Duration up to now ("for three days") uses "has been".',
      },
    ],
    spotFixes: [
      {
        buggyTokens: ['I', "can't", 'wait', 'play', 'GTA', '6', 'with', 'friends.'],
        buggyTokenIndex: 3,
        fixChoices: ['to play', 'playing', 'played'],
        correctFixToken: 'to play',
        correctedSentence: "I can't wait to play GTA 6 with friends.",
        meaningTr: 'Arkadaşlarla GTA 6 oynamak için sabırsızlanıyorum.',
        explanationTr: 'Hızlı konuşmada "wait to" tek /t/ gibi duyulur ama yazımda "wait TO play" gerekir.',
        explanationEn: 'Even though "wait to" blends its /t/ sounds in speech, writing requires "to play".',
      },
      {
        buggyTokens: ['There', 'lot', 'of', 'people', 'waiting', 'outside.'],
        buggyTokenIndex: 1,
        fixChoices: ['are a lot', 'is lot', 'be lots'],
        correctFixToken: 'are a lot',
        correctedSentence: 'There are a lot of people waiting outside.',
        meaningTr: 'Dışarıda bekleyen bir sürü insan var.',
        explanationTr: 'Hızlı konuşmada "There are a" sıkışır ama gramatik olarak "There are a lot of" yazılır.',
        explanationEn: '"There are a" reduces fast in speech, so check for both "are" and "a".',
      },
    ],
    scenarios: [
      {
        scenarioTr:
          'Bir ses kaydında "He’s been working all day" cümlesini duyuyorsun. "He’s" buradaki hangi kısaltmadır?',
        scenarioEn: 'You hear "He’s been working all day." What does "He’s" stand for here?',
        choices: [
          'He has (He has been working)',
          'He is (He is been working)',
          'He was (He was been working)',
        ],
        correctChoice: 'He has (He has been working)',
        meaningTr: 'O bütün gündür çalışıyor.',
        explanationTr: 'Arkasından "been" (V3) geldiği için "He\'s" kesinlikle "He has" kısaltmasıdır.',
        explanationEn: 'Followed by "been" (V3), "He\'s" always expands to "He has".',
      },
    ],
  },

  modal_possibility: {
    skillId: 'modal_possibility',
    titleTr: 'İhtimal & Yetenek Kipleri (may / might / could / can\'t)',
    titleEn: 'Modals of Possibility (may / might / could / can\'t)',
    subtitleTr: 'Belki / ihtimal (%30–%60) ile kesin imkânsızlık ("can\'t be") ifadeleri',
    subtitleEn: 'Expressing uncertainty, permission, and strong deduction',
    icon: '🎲',
    sentencePattern: /\b(?:may\s+(?:be|have|not)|might\s+(?:be|have|not)|could\s+(?:be|have)|must\s+be|can't\s+be)\b/i,
    conceptPattern: /\b(?:may\s+have|might|could|modal|possibility)\b/i,
    briefing: {
      headlineTr: 'Kesin değilse "may / might / could", kesinlikle olamazsa "can\'t be"!',
      headlineEn: 'Uncertain → "may / might / could" | Impossible → "can\'t be"!',
      goldenRuleTr:
        '• may / might / could + V1 = "olabilir / belki yapar"\n• may have to = "zorunda kalabilir" (çift katmanlı!)\n• must be = "kesin öyledir" | can\'t be = "olamaz!" (NOT: "mustn\'t be" değil!).',
      goldenRuleEn:
        '• may / might / could + base verb = possible\n• may have to = might be forced to\n• must be = logically certain | can\'t be = logically impossible.',
      mnemonicTr:
        '💡 "may have to" Tuzağı: "may" (belki) + "have to" (zorunda) = "zorunda kalabilirsin"! İkisini birlikte oku.',
      mnemonicEn:
        '💡 Combo Trick: "may have to" = "might need to" (possibility + obligation combined).',
      examples: [
        {
          en: 'We may have to cancel the outdoor gig if it rains.',
          tr: 'Yağmur yağarsa açık hava konserini iptal etmek zorunda kalabiliriz.',
          highlight: 'may have to',
        },
        {
          en: 'That message can’t be real — it looks like spam.',
          tr: 'O mesaj gerçek olamaz — spam gibi duruyor.',
          highlight: "can't be",
        },
        {
          en: 'She might be stuck in traffic right now.',
          tr: 'Şu an trafikte sıkışmış olabilir.',
          highlight: 'might be',
        },
        {
          en: 'He might comes late to the meeting.',
          tr: 'YANLIŞ! Modal sonrası fiil "-s" almaz → "He might COME late."',
          highlight: 'comes → come',
          isTrap: true,
          trapNoteTr: 'may / might / could / should / can sonrası fiil HER ZAMAN yalın kalır (he/she olsa bile -s yok!).',
          trapNoteEn: 'Never add -s to the verb after may/might/could, even with he/she/it.',
        },
      ],
      source: 'local',
    },
    duels: [
      {
        promptSentence: 'The server is slow — we ___ have to wait a few minutes.',
        promptSubtextTr: 'Sunucu yavaş — birkaç dakika beklemek zorunda kalabiliriz. (İhtimal)',
        promptSubtextEn: 'Possible obligation ("might need to").',
        choices: ['may', 'must'],
        correctChoice: 'may',
        fullSentence: 'The server is slow — we may have to wait a few minutes.',
        meaningTr: 'Sunucu yavaş — birkaç dakika beklemek zorunda kalabiliriz.',
        explanationTr: '"-ebiliriz" ihtimali + "have to" zorunluluğu birleşince "may have to" olur.',
        explanationEn: '"may have to" combines possibility with necessity.',
      },
      {
        promptSentence: 'No way! That rumor ___ be true!',
        promptSubtextTr: 'İmkânsız! O söylenti doğru olamaz!',
        promptSubtextEn: 'Strong disbelief ("impossible").',
        choices: ["can't", "mustn't"],
        correctChoice: "can't",
        fullSentence: "No way! That rumor can't be true!",
        meaningTr: 'İmkânsız! O söylenti doğru olamaz!',
        explanationTr: '"Doğru olamaz" çıkarımı için "mustn\'t be" değil her zaman "can\'t be" kullanılır.',
        explanationEn: 'Logical impossibility always uses "can\'t be", never "mustn\'t be".',
      },
    ],
    spotFixes: [
      {
        buggyTokens: ['It', 'might', 'rains', 'later', 'this', 'evening.'],
        buggyTokenIndex: 2,
        fixChoices: ['rain', 'raining', 'rained'],
        correctFixToken: 'rain',
        correctedSentence: 'It might rain later this evening.',
        meaningTr: 'Bu akşam ilerleyen saatlerde yağmur yağabilir.',
        explanationTr: '"might" modalından sonra fiil -s takısı almaz → "rain".',
        explanationEn: 'Drop the -s after modal "might": "might rain".',
      },
      {
        buggyTokens: ['She', 'may to', 'join', 'the', 'call', 'late.'],
        buggyTokenIndex: 1,
        fixChoices: ['may', 'is', 'has'],
        correctFixToken: 'may',
        correctedSentence: 'She may join the call late.',
        meaningTr: 'Görüşmeye geç katılabilir.',
        explanationTr: '"may" ardından "to" gelmez; doğrudan yalın fiil ("may join") gelir.',
        explanationEn: 'Never put "to" between "may" and the base verb ("may join").',
      },
    ],
    scenarios: [
      {
        scenarioTr:
          'Arkadaşın telefonuna bakmıyor. "Uyumuş olabilir" diye tahmin yürütüyorsun:',
        scenarioEn: 'Your friend is not replying; guess that they might be asleep:',
        choices: [
          'He might be asleep right now.',
          'He might to be asleep right now.',
          'He mights be asleep right now.',
        ],
        correctChoice: 'He might be asleep right now.',
        meaningTr: 'Şu an uyuyor olabilir.',
        explanationTr: 'İhtimal tahmini: "might + be + sıfat" (to yok, -s yok).',
        explanationEn: 'Possibility guess: "might + be + adjective".',
      },
    ],
  },

  infinitive_gerund: {
    skillId: 'infinitive_gerund',
    titleTr: 'to V1 vs V-ing (İki Fiil Yan Yana)',
    titleEn: 'Infinitive (to V1) vs Gerund (V-ing)',
    subtitleTr: 'İki fiil yan yana gelince hangisi "to", hangisi "-ing" alır?',
    subtitleEn: 'Choosing between "to + verb" and "verb + -ing" after common verbs',
    icon: '🧲',
    sentencePattern: /\b(?:enjoy|avoid|finish|keep|suggest|mind|admit)\s+[a-z]{2,}ing\b|\b(?:want|decide|hope|plan|promise|refuse|can't\s+wait|agree|learn|need)\s+to\s+[a-z]{2,}\b/i,
    conceptPattern: /\b(?:infinitive|gerund|to\s*\+\s*verb|v-ing|enjoy\s+\w+ing)\b/i,
    answerConfusionHint: 'infinitive_gerund',
    briefing: {
      headlineTr: 'Gelecek hedef / niyet → TO V1 | Zevk / süreç / edat sonrası → V-ING!',
      headlineEn: 'Future goal/decision → TO V1 | Activity/enjoyment/after prepositions → V-ING!',
      goldenRuleTr:
        '• TO V1 sevenler: want, decide, hope, plan, promise, can\'t wait, need ("I can\'t wait TO play GTA 6")\n• V-ING sevenler: enjoy, finish, avoid, keep, mind, suggest, admit ("I enjoy listening to rock")\n• Her edattan (about, of, without, before, after) sonra DAİMA V-ING!',
      goldenRuleEn:
        '• TO V1 verbs: want, decide, hope, plan, promise, can\'t wait, need\n• V-ING verbs: enjoy, finish, avoid, keep, mind, suggest, admit\n• After ANY preposition (of, about, before, without) → ALWAYS V-ING!',
      mnemonicTr:
        '💡 %100 Garanti Kural: "enjoy to..." ASLA olmaz ("enjoy + -ing"). "before/after/for/about + fiil" görürsen gözün kapalı "-ing" yapıştır!',
      mnemonicEn:
        '💡 100% Rule: Never "enjoy to...". And after every preposition (about, for, before), always add -ing!',
      examples: [
        {
          en: 'I can’t wait to play GTA 6.',
          tr: 'GTA 6 oynamak için sabırsızlanıyorum.',
          highlight: 'wait to play',
        },
        {
          en: 'I really enjoy listening to rock music at night.',
          tr: 'Gece rock müzik dinlemekten gerçekten keyif alıyorum.',
          highlight: 'enjoy listening',
        },
        {
          en: 'Thanks for helping me fix the bug!',
          tr: 'Hatayı düzeltmeme yardım ettiğin için teşekkürler! (Edat "for" + -ing)',
          highlight: 'for helping',
        },
        {
          en: 'She enjoys to watch sci-fi series.',
          tr: 'YANLIŞ! "enjoy" her zaman -ing ister → "She enjoys WATCHING sci-fi series."',
          highlight: 'to watch → watching',
          isTrap: true,
          trapNoteTr: '"enjoy / finish / avoid / mind" fiilleri asla "to" almaz, daima "-ing" ile devam eder.',
          trapNoteEn: '"enjoy / finish / avoid / mind" always require a gerund (-ing).',
        },
      ],
      source: 'local',
    },
    duels: [
      {
        promptSentence: 'I really enjoy ___ to live rock concerts.',
        promptSubtextTr: 'Canlı rock konserlerine gitmekten gerçekten keyif alıyorum.',
        promptSubtextEn: 'What form always follows "enjoy"?',
        choices: ['going', 'to go'],
        correctChoice: 'going',
        fullSentence: 'I really enjoy going to live rock concerts.',
        meaningTr: 'Canlı rock konserlerine gitmekten gerçekten keyif alıyorum.',
        explanationTr: '"enjoy" fiilinden sonra her zaman V-ing ("going") gelir.',
        explanationEn: '"enjoy" is always followed by -ing ("going").',
      },
      {
        promptSentence: 'We decided ___ the new co-op campaign tonight.',
        promptSubtextTr: 'Bu gece yeni eşli hikâye moduna başlamaya karar verdik.',
        promptSubtextEn: 'Future decision verb ("decide").',
        choices: ['to start', 'starting'],
        correctChoice: 'to start',
        fullSentence: 'We decided to start the new co-op campaign tonight.',
        meaningTr: 'Bu gece yeni eşli hikâye moduna başlamaya karar verdik.',
        explanationTr: '"decide" (karar vermek) her zaman "to + V1" ister.',
        explanationEn: '"decide" always takes "to + base verb".',
      },
    ],
    spotFixes: [
      {
        buggyTokens: ['He', 'avoided', 'to answer', 'the', 'question.'],
        buggyTokenIndex: 2,
        fixChoices: ['answering', 'answered', 'answers'],
        correctFixToken: 'answering',
        correctedSentence: 'He avoided answering the question.',
        meaningTr: 'Soruyu cevaplamaktan kaçındı.',
        explanationTr: '"avoid" fiili "to" değil V-ing ("answering") ister.',
        explanationEn: '"avoid" takes a gerund (-ing): "avoided answering".',
      },
      {
        buggyTokens: ['Thanks', 'for', 'send', 'me', 'the', 'playlist!'],
        buggyTokenIndex: 2,
        fixChoices: ['sending', 'sent', 'to send'],
        correctFixToken: 'sending',
        correctedSentence: 'Thanks for sending me the playlist!',
        meaningTr: 'Bana çalma listesini gönderdiğin için teşekkürler!',
        explanationTr: '"for" bir edattır; edattan sonra gelen fiil her zaman "-ing" alır → "for sending".',
        explanationEn: 'After the preposition "for", always use -ing ("sending").',
      },
    ],
    scenarios: [
      {
        scenarioTr:
          'Bir oyunun çıkışını dört gözle beklediğini doğal İngilizceyle söyle:',
        scenarioEn: 'Express excitement about playing an upcoming game:',
        choices: [
          "I can't wait to play the new release!",
          "I can't wait playing the new release!",
          'I enjoy to play the new release!',
        ],
        correctChoice: "I can't wait to play the new release!",
        meaningTr: 'Yeni sürümü oynamak için sabırsızlanıyorum!',
        explanationTr: '"can\'t wait" kalıbı her zaman "to + V1" ile tamamlanır.',
        explanationEn: '"can\'t wait" always pairs with "to + base verb".',
      },
    ],
  },

  negation_questions: {
    skillId: 'negation_questions',
    titleTr: 'Soru & Olumsuz Kurulumu (do / does / did)',
    titleEn: 'Questions & Negatives (do / does / did)',
    subtitleTr: '"didn\'t / doesn\'t" geldiğinde ana fiilin yalınlaşması (V1 kuralı)',
    subtitleEn: 'Resetting the main verb to base form after do/does/did',
    icon: '❓',
    sentencePattern: /\b(?:don't|doesn't|didn't|did\s+you|does\s+(?:he|she|it)|do\s+you)\s+[a-z]{2,}\b/i,
    conceptPattern: /\b(?:didn't|doesn't|don't|negation|question\s+form)\b/i,
    answerConfusionHint: 'negation',
    briefing: {
      headlineTr: '"does" veya "did" yükü sırtlar — ana fiil YALIN (V1) kalır!',
      headlineEn: '"does" and "did" carry the grammar load — the main verb stays BASE (V1)!',
      goldenRuleTr:
        'Bir cümlede "didn\'t / Did" varsa geçmiş zaman yükünü o taşır; ana fiile bir daha -ed/V2 EKLEME! Aynı şekilde "doesn\'t / Does" varsa ana fiile -s EKLEME!',
      goldenRuleEn:
        'When "did / didn\'t" appears, the main verb drops back to base form (V1). When "does / doesn\'t" appears, drop the -s from the main verb!',
      mnemonicTr:
        '💡 Tek Patron Kuralı: Aynı cümlede iki geçmiş zaman eki olmaz! "I didn\'t went" ❌ → "I didn\'t GO" ✓. "Does she likes?" ❌ → "Does she LIKE?" ✓.',
      mnemonicEn:
        '💡 One Boss Rule: Only ONE word marks tense/person — "didn\'t GO", "doesn\'t LIKE".',
      examples: [
        {
          en: 'I didn’t hear the notification.',
          tr: 'Bildirimi duymadım. ("didn\'t heard" DEĞİL!)',
          highlight: "didn't hear",
        },
        {
          en: 'Does this app work offline?',
          tr: 'Bu uygulama çevrimdışı çalışıyor mu? ("works" DEĞİL!)',
          highlight: 'Does ... work',
        },
        {
          en: 'Did you enjoy the concert?',
          tr: 'Konserden keyif aldın mı?',
          highlight: 'Did ... enjoy',
        },
        {
          en: 'He didn’t went to the gym yesterday.',
          tr: 'YANLIŞ! "didn\'t" varken fiil 1. haline döner → "He didn\'t GO."',
          highlight: 'went → go',
          isTrap: true,
          trapNoteTr: '"didn\'t" görünce fiili otomatik olarak en sade 1. haline çevir.',
          trapNoteEn: 'After "didn\'t", always reset the main verb to base form ("go").',
        },
      ],
      source: 'local',
    },
    duels: [
      {
        promptSentence: 'I didn’t ___ my password before resetting the browser.',
        promptSubtextTr: 'Tarayıcıyı sıfırlamadan önce şifremi kaydetmedim.',
        promptSubtextEn: 'Main verb right after "didn\'t".',
        choices: ['save', 'saved'],
        correctChoice: 'save',
        fullSentence: "I didn't save my password before resetting the browser.",
        meaningTr: 'Tarayıcıyı sıfırlamadan önce şifremi kaydetmedim.',
        explanationTr: '"didn\'t" zaten geçmiş zamandır; ana fiil yalın ("save") kalır.',
        explanationEn: '"didn\'t" already marks past tense, so use base verb "save".',
      },
      {
        promptSentence: 'Does your friend ___ rock music too?',
        promptSubtextTr: 'Arkadaşın da rock müzik seviyor mu?',
        promptSubtextEn: '"Does" already carries the 3rd-person -s.',
        choices: ['like', 'likes'],
        correctChoice: 'like',
        fullSentence: 'Does your friend like rock music too?',
        meaningTr: 'Arkadaşın da rock müzik seviyor mu?',
        explanationTr: '"Does" -s ekini taşıdığı için ana fiil "likes" değil "like" olur.',
        explanationEn: 'Because "Does" carries the -s, keep "like" in base form.',
      },
    ],
    spotFixes: [
      {
        buggyTokens: ['Did', 'you', 'saw', 'the', 'new', 'trailer', 'yet?'],
        buggyTokenIndex: 2,
        fixChoices: ['see', 'seen', 'seeing'],
        correctFixToken: 'see',
        correctedSentence: 'Did you see the new trailer yet?',
        meaningTr: 'Yeni fragmanı gördün mü?',
        explanationTr: '"Did" sorusunda fiilin 2. hali (saw) değil 1. hali (see) kullanılır.',
        explanationEn: 'After "Did", always use base verb "see", never "saw".',
      },
      {
        buggyTokens: ['She', "doesn't", 'drinks', 'coffee', 'after', '6', 'PM.'],
        buggyTokenIndex: 2,
        fixChoices: ['drink', 'drank', 'drinking'],
        correctFixToken: 'drink',
        correctedSentence: "She doesn't drink coffee after 6 PM.",
        meaningTr: 'Saat 6’dan sonra kahve içmez.',
        explanationTr: '"doesn\'t" sonrası fiilden -s düşer → "drink".',
        explanationEn: 'Drop the -s after "doesn\'t": "doesn\'t drink".',
      },
    ],
    scenarios: [
      {
        scenarioTr:
          'Arkadaşına dün geceki yayını izleyip izlemediğini sor:',
        scenarioEn: 'Ask your friend whether they watched last night’s stream:',
        choices: [
          'Did you watch the stream last night?',
          'Did you watched the stream last night?',
          'Were you watch the stream last night?',
        ],
        correctChoice: 'Did you watch the stream last night?',
        meaningTr: 'Dün geceki yayını izledin mi?',
        explanationTr: 'Geçmiş zaman eylem sorusu: "Did + özne + V1 (watch)?"',
        explanationEn: 'Past action question: "Did + subject + base verb".',
      },
    ],
  },

  trouble_vocab: {
    skillId: 'trouble_vocab',
    titleTr: 'En Çok Takıldığın Kelimeler Kampı',
    titleEn: 'Your Trouble Vocabulary Bootcamp',
    subtitleTr: 'Geçmişte en sık hata yaptığın kişisel kelimelerle nokta atışı pratik',
    subtitleEn: 'Targeted drills built straight from the words you miss most often',
    icon: '🎯',
    sentencePattern: /.+/,
    conceptPattern: /^token:/i,
    briefing: {
      headlineTr: 'Bu ders %100 sana özel: en çok takıldığın kelimeleri hafızana kazıyoruz!',
      headlineEn: '100% personalized to your history: locking in your trickiest words!',
      goldenRuleTr:
        'Bir kelimeye 2+ kez takıldığında onu tek başına ezberlemek yetmez — mutlaka cümle içinde, zıt anlamıyla ve sesli telaffuzuyla birlikte kodla.',
      goldenRuleEn:
        'Words you miss repeatedly stick best when practiced in vivid context, paired with audio and active recall.',
      mnemonicTr:
        '💡 Hafıza Tekniği: Her kelimeyi 1 kez sesli dinle, ardından zihninde kendi hayatından kısa bir sahne (oyun, müzik, iş, arkadaş) ile eşleştir!',
      mnemonicEn:
        '💡 Memory Hook: Listen to the pronunciation once and attach each word to a personal mini-scene.',
      examples: [
        {
          en: 'I have to finish my assignment before midnight.',
          tr: 'Ödevimi/görevimi gece yarısından önce bitirmek zorundayım.',
          highlight: 'assignment',
        },
        {
          en: 'He admitted that he made a mistake.',
          tr: 'Bir hata yaptığını itiraf etti / kabul etti.',
          highlight: 'admitted',
        },
        {
          en: 'The train departs from platform four.',
          tr: 'Tren dördüncü perondan kalkıyor.',
          highlight: 'departs / platform',
        },
      ],
      source: 'local',
    },
    duels: [
      {
        promptSentence: 'Our train ___ from platform 3 in five minutes.',
        promptSubtextTr: 'Trenimiz beş dakika içinde 3. perondan kalkıyor.',
        promptSubtextEn: '"Leave / set off" (formal transit verb).',
        choices: ['departs', 'admits'],
        correctChoice: 'departs',
        fullSentence: 'Our train departs from platform 3 in five minutes.',
        meaningTr: 'Trenimiz beş dakika içinde 3. perondan kalkıyor.',
        explanationTr: '"depart" = hareket etmek / ayrılmak; "admit" = kabul/itiraf etmek.',
        explanationEn: '"depart" = leave on a journey; "admit" = confess/acknowledge.',
      },
      {
        promptSentence: 'They will ___ the official release date tomorrow.',
        promptSubtextTr: 'Resmî çıkış tarihini yarın duyuracaklar.',
        promptSubtextEn: '"Make an official public statement".',
        choices: ['announce', 'avoid'],
        correctChoice: 'announce',
        fullSentence: 'They will announce the official release date tomorrow.',
        meaningTr: 'Resmî çıkış tarihini yarın duyuracaklar.',
        explanationTr: '"announce" = duyurmak / ilan etmek; "avoid" = kaçınmak.',
        explanationEn: '"announce" = publicly declare; "avoid" = stay away from.',
      },
    ],
    spotFixes: [
      {
        buggyTokens: ['I', 'need', 'to', 'submit', 'my', 'assign', 'by', 'Friday.'],
        buggyTokenIndex: 5,
        fixChoices: ['assignment', 'assigning', 'assigned'],
        correctFixToken: 'assignment',
        correctedSentence: 'I need to submit my assignment by Friday.',
        meaningTr: 'Ödevimi/görevimi cumaya kadar teslim etmem gerekiyor.',
        explanationTr: '"my" iyelik ekinden sonra isim hali gerekir: "assign" (fiil) → "assignment" (ödev/görev).',
        explanationEn: 'After "my", use the noun form "assignment" instead of verb "assign".',
      },
    ],
    scenarios: [
      {
        scenarioTr:
          'Bir projede takvimden önde gittiğinizi ekibe güvenle bildireceksin:',
        scenarioEn: 'Tell your team that you are progressing faster than planned:',
        choices: [
          'Good news — we are ahead of schedule!',
          'Good news — we are behind of schedule!',
          'Good news — we are depart of schedule!',
        ],
        correctChoice: 'Good news — we are ahead of schedule!',
        meaningTr: 'İyi haber — programın önündeyiz!',
        explanationTr: '"ahead of schedule" = planlanandan / takvimden önde.',
        explanationEn: '"ahead of schedule" is the natural idiom for being early/on top of a timeline.',
      },
    ],
  },
};

export const REMEDIAL_SKILL_ORDER: WeakSkillId[] = [
  'was_vs_were',
  'should_vs_have_to',
  'passive_voice',
  'word_order_syntax',
  'listening_gap',
  'phrasal_verbs',
  'time_clauses',
  'used_to_habit',
  'past_continuous',
  'present_perfect',
  'going_to_vs_will',
  'conditionals_would',
  'contrast_linkers',
  'prepositions_core',
  'modal_possibility',
  'infinitive_gerund',
  'negation_questions',
  'trouble_vocab',
];

/**
 * Word-for-word transcripts of the bundled ElevenLabs Turkish voiceover MP3s
 * so learners can read along verbatim while listening in any rule view.
 */
export const REMEDIAL_VOICE_TRANSCRIPTS: Record<WeakSkillId, string> = {
  was_vs_were:
    '"was" ve "were" aslında aynı anlama gelir, ikisi de geçmişte "idi" demektir. Tek bir kişiden ya da tek bir şeyden bahsediyorsan, örneğin "The concert was awesome" derken "was" kullanırsın. Çoğul öznelerde ve karşındaki tek bir kişi bile olsa "you" öznesinde her zaman "were" gelir, örneğin "We were waiting all night" veya "Why were you late?" cümlelerinde olduğu gibi. Unutma, "my friends was" değil, "my friends were" denir.',
  should_vs_have_to:
    'Aradaki fark çok net: "should" dost tavsiyesi, "have to" ise gerçek bir zorunluluktur. Yaparsan iyi olur dediğin önerilerde, örneğin "You should get some sleep" derken "should" kullanılır. Dıştan gelen bir kural veya mecburiyet varsa, "I have to finish this report" gibi, "have to" gerekir. Olumsuzda anlam tamamen ayrılır: "should not" yapmasan iyi olur demektir; "do not have to" ise yasak değil, yapmana gerek yok anlamına gelir.',
  used_to_habit:
    'Eskiden düzenli yaptığın ama artık bıraktığın alışkanlıklar için "used to" kalıbını kullanırız. Olumlu cümlede "I used to play guitar every night" şeklinde söylenir ve sonrasında fiil her zaman yalın hâliyle gelir. Olumsuz ve soru cümlelerinde ise "did" yardımcı fiili geçmiş zamanı zaten taşıdığı için "use to" biçimine döner, örneğin "She did not use to drink black coffee" veya "Did you use to live near the sea?" gibi.',
  past_continuous:
    'Geçmişte bir film sahnesi düşün: arka planda akıp giden olayda "was" ya da "were" ile birlikte fiil "listening" veya "playing" gibi devam hâlinde söylenir. Örneğin "I was listening to rock music when you called" dediğinde, dinleme eylemi o sırada sürüyordu, arama ise onu bölen kısa olay oldu. Kısacası "yapıyordum" anlamı için "was taking" veya "were playing" yapısını, aniden oldu anlamı içinse fiilin geçmiş hâlini kullanmalısın.',
  present_perfect:
    'Present Perfect, geçmiş ile şimdi arasında köprü kuran yapıdır ve "have" ya da "has" ile fiilin üçüncü hâliyle kurulur. Hayat deneyimlerinden, az önce olmuş sonuçlardan veya hâlâ devam eden sürelerden söz ediyorsan, örneğin "I have never been there" veya "My dog has been missing for three days" cümlelerindeki gibi kullanılır. Ancak cümlede "yesterday" veya "last night" gibi kesin bitmiş bir zaman varsa köprü kopmuştur, o zaman doğrudan sade geçmiş zaman tercih edilir.',
  passive_voice:
    'İngilizcede "We invited" biz davet ettik demektir; ama "We were invited" dediğinde biz davet edildik anlamına gelir. "am", "is", "are", "was", "were" yardımcı fiillerinden birinin ardından fiilin üçüncü hâlini gördüğünde cümleyi edilgen olarak çevirmelisin. Örneğin "The release date was delayed twice" cümlesinde çıkış tarihi kendi kendini ertelemedi, ertelendi. Yani özne işi yapan değil, o işten etkilenen taraftır.',
  going_to_vs_will:
    'Önceden planladıysan "going to", tam şu an karar verdiysen "will" kullanılır. Cebinde bir plan, bilet ya da niyet varsa veya gözünle gördüğün bir kanıt bulunuyorsa, örneğin "Look at those dark clouds, it is going to rain" derken olduğu gibi, "be going to" kalıbını tercih etmelisin. Ama konuşma anında bir karar alıyor, teklifte bulunuyor veya söz veriyorsan, mesela "I will help you!" cümlesindeki gibi, bu durumda "will" devreye girer.',
  conditionals_would:
    'Koşul cümlelerinde gerçek bir ihtimalden söz ediyorsan "will", hayalî bir varsayımdan söz ediyorsan "would" kullanılır. Örneğin "If I finish early, I will play" gerçek bir plan anlatır. Ama "If I were you, I would take that offer" veya "If I had more time, I would learn guitar" tamamen hayalî durumlardır. Tek altın yasağı unutma: "if" kelimesinin bulunduğu tarafa asla "would" konulmaz, "would" her zaman sonuç kısmında yer alır.',
  contrast_linkers:
    'Zıtlık anlatırken "although" ve "despite" ikisi de "rağmen" demektir ama arkasından gelen yapı farklıdır. "Although it was raining" gibi özne ve fiil içeren tam bir cümle kuruyorsan "although" seçersin. Sadece bir isim ya da "being tired" gibi bir ifade geliyorsa "despite" kullanılır ve sakın "despite of" deme, "of" sadece "in spite of" kalıbında vardır. Bir de "unless" kelimesine dikkat et: içinde zaten olumsuzluk taşır ve "yapmadıkça" anlamını verir, yanına ikinci bir "not" ekleme.',
  time_clauses:
    'Gelecekten bahsetsen bile "when", "as soon as" ve "until" gibi zaman bağlaçlarının hemen arkasına asla "will" konulmaz. Örneğin "Call me as soon as you get home" veya "Wait until the backup finishes" cümlelerinde bağlaçtan sonraki fiil hep geniş zamanda kalır; gelecek zaman gerekiyorsa "will" sadece ana cümlede durur. Ayrıca "He did not arrive until noon" kalıbının öğlene kadar gelmedi, yani ancak öğlen geldi anlamına geldiğini aklında tut.',
  phrasal_verbs:
    'İngilizcede tek bir edat, fiilin anlamını baştan sona değiştirir; bu yüzden bunları tek kelime gibi bütün olarak okumak gerekir. Örneğin "figure out" çözmek, "put off" ertelemek, "get off" otobüsten ya da trenden inmek, "cut the trip short" ise geziyi yarıda kesmek demektir. Kısa zamirlerde sıraya özellikle dikkat et: "figure out it" değil, zamiri araya alarak "figure it out" ve "turn it down" şeklinde söylemelisin.',
  prepositions_core:
    'Zaman edatlarını büyükten küçüğe ters bir piramit gibi düşünebilirsin. Aylar, yıllar, mevsimler ve sabah akşam gibi bölümler için "in", yani "in autumn" veya "in the morning" denir. Günler ve tarihler için "on", örneğin "on Friday". Tam saatler ve gece içinse "at", yani "at nine" ve "at night" kullanılır. Süre belirtirken toplam zamanı sayıyorsan "for two hours", başlangıç noktasını gösteriyorsan "since Monday" tercih etmelisin.',
  word_order_syntax:
    'Türkçede fiil cümlenin en sonunda oturur; ama İngilizcede fiil özneden hemen sonra gelir ve yerinden kıpırdamaz. Düz cümlede her zaman şu sırayı izle: önce özne, sonra fiil, ardından nesne, sonra yer ve en sonda zaman. Örneğin "I listen to rock music at home every evening" gibi. "very much" gibi ifadeleri asla fiille nesnenin arasına sokma, cümlenin sonuna at; bir de "never" ile "do not" kelimelerini aynı cümlede üst üste getirme.',
  listening_gap:
    'Hızlı İngilizce dinlerken zorlanmanın sebebi kulaklarının kaçırması değil, küçük yardımcı kelimelerin hızlıca yutulmasıdır. Anlamı taşıyan büyük kelimeler vurgulu söylenirken, aradaki "has", "been", "to", "a" ve "of" gibi köprü kelimeler çok alçak ve birleşik okunur. Bu yüzden dinledikten sonra cümlene iki saniye göz gezdir: İngilizcede fiilsiz cümle olmaz. "My dog missing" gibi eksik bir yapı görürsen aradaki "has been" parçasının yutulduğunu hemen fark edebilirsin.',
  modal_possibility:
    'Bir şeyin olma ihtimalinden söz ederken "may", "might" veya "could" kullanırız; örneğin "She might be stuck in traffic right now" gibi. Bazen "We may have to wait" kalıbındaki gibi iki yapı birleşir ve "beklemek zorunda kalabiliriz" anlamını verir. Eğer mantıken kesin öyledir diyorsan "must be", kesinlikle olamaz diyorsan ise "must not be" değil, her zaman "cannot be" demelisin. Ayrıca "He might comes" değil, "He might come" şeklinde ek koymadan ve "to" eklemeden yalın fiil kullanılır.',
  infinitive_gerund:
    'İki fiil yan yana geldiğinde, birinci fiilin türü ikincinin "to" ile mi yoksa devam hâliyle mi geleceğini belirler. Gelecek niyet ve karar bildiren "want", "decide", "hope" ve "wait" gibi fiillerden sonra "to" gelir, örneğin "I cannot wait to play" veya "We decided to start". Buna karşılık zevk veya süreç anlatan "enjoy", "avoid", "finish" fiillerinden sonra ve "for", "about", "before" gibi her edatın arkasından daima "listening" veya "helping" biçimi kullanılır; örneğin "I enjoy listening to music" ve "Thanks for helping me" gibi.',
  negation_questions:
    'İngilizce soru ve olumsuz cümlelerde tek bir kural her şeyi çözer: yardımcı fiil yükü sırtladığında ana fiil en yalın birinci hâline döner. Cümlede "did" ya da "did not" varsa geçmiş zaman yükünü o zaten almıştır; bu yüzden "I did not went" değil, "I did not go" ve "Did you see?" demelisin. Aynı kural "does" ve "does not" için de geçerlidir: "She does not drinks" değil, ekini düşürerek "She does not drink coffee" şeklinde kurmalısın.',
  trouble_vocab:
    'Bir kelimeye iki üç kez takıldıysan onu tek başına sözlük anlamıyla ezberlemeye çalışmak hafızada kalıcı olmaz. En etkili yöntem, kelimeyi mutlaka kısa ve canlı bir cümle içinde görmek ve telaffuzuyla birlikte kendi hayatından bir sahneye bağlamaktır. Örneğin "depart" hareket etmek, "announce" duyurmak, "ahead of schedule" ise planlanandan önde gitmek demektir. Her birini kendi cümlende bir kez sesli kurduğunda kalıcı olarak yerine oturur.',
};
