import {
  REMEDIAL_SKILL_CATALOG,
  REMEDIAL_SKILL_ORDER,
  REMEDIAL_VOICE_TRANSCRIPTS,
} from './remedialCatalog.ts';
import type {
  ExtraGrammarRuleId,
  RemedialBriefingExample,
  VoiceCoachRuleId,
} from './types';

export interface VoiceCoachRuleSpec {
  id: VoiceCoachRuleId;
  icon: string;
  titleTr: string;
  titleEn: string;
  headlineTr: string;
  headlineEn: string;
  transcriptTr: string;
  summaryEn: string;
  examples: RemedialBriefingExample[];
}

export const EXTRA_GRAMMAR_RULE_ORDER: readonly ExtraGrammarRuleId[] = [
  'simple_present',
  'articles_a_an_the',
  'simple_past',
  'can_could_able',
  'quantifiers_count',
  'present_continuous',
  'wh_questions',
  'imperatives_lets',
  'comparatives_superlatives',
  'relative_clauses',
  'reflexives_reciprocals',
  'there_is_it_is',
  'reported_speech',
  'be_get_used_to',
  'cause_effect_linkers',
  'past_perfect',
  'time_place_prepositions_extra',
];

export const VOICE_COACH_RULE_ORDER: readonly VoiceCoachRuleId[] = [
  ...REMEDIAL_SKILL_ORDER,
  ...EXTRA_GRAMMAR_RULE_ORDER,
];

const EXTRA_GRAMMAR_RULES: Record<ExtraGrammarRuleId, VoiceCoachRuleSpec> = {
  simple_present: {
    id: 'simple_present',
    icon: '⏱️',
    titleTr: 'Geniş Zaman (Simple Present)',
    titleEn: 'Simple Present',
    headlineTr: 'Alışkanlıklar ve genel doğrular: he/she/it gelince fiile -s ekle!',
    headlineEn: 'Habits & general truths: add -s for he/she/it!',
    transcriptTr:
      'İngilizcede günlük alışkanlıklardan, genel doğrulardan ve her zaman geçerli kurallardan söz ederken geniş zaman kullanılır. Özne "I", "you", "we" veya "they" olduğunda fiil yalın kalır; örneğin "Short study sessions beat cramming all night" veya "We drink coffee every morning" gibi. Ancak özne tekil üçüncü şahıs, yani "he", "she" veya "it" olduğunda fiil "works" ya da "boils" örneğindeki gibi son takı alır; mesela "She works from home" veya "Water boils at one hundred degrees" şeklinde söylenir. Eylem değil de durum anlatıyorsan "am", "is" ve "are" yardımcı fiilleri kullanılır.',
    summaryEn:
      'Use Simple Present for routines, facts, and general truths. Keep the base verb for I/you/we/they, add -s/-es for he/she/it, and use am/is/are for states.',
    examples: [
      {
        en: 'Short daily study sessions beat cramming all night.',
        tr: 'Kısa günlük çalışma seansları bütün gece ezber yapmaktan iyidir.',
        highlight: 'beat',
      },
      {
        en: 'She works from home on Fridays.',
        tr: 'Cuma günleri evden çalışır.',
        highlight: 'works',
      },
      {
        en: 'Water boil at one hundred degrees.',
        tr: 'YANLIŞ! "Water" tekil (it) olduğu için "-s" gerekir → "Water BOILS..."',
        highlight: 'boil → boils',
        isTrap: true,
        trapNoteEn: '"Water" is 3rd-person singular, so it requires "boils".',
      },
    ],
  },
  articles_a_an_the: {
    id: 'articles_a_an_the',
    icon: '🔤',
    titleTr: 'a / an / the (Artikeller)',
    titleEn: 'Articles (a / an / the)',
    headlineTr: 'İlk kez ve genel tekil → a / an | Belirli ve bilinen → the!',
    headlineEn: 'First mention singular → a / an | Specific known noun → the!',
    transcriptTr:
      'İngilizcede isimlerin önüne gelen "a", "an" ve "the" kelimeleri konuşanın ne kadar belirli bir şeyden bahsettiğini gösterir. Herhangi bir tekil şeyden ilk kez söz ediyorsan sessiz sesle başlayan kelimelerde "a", sesli sesle başlayanlarda ise "an" kullanılır; örneğin "a book" ve "an exam" gibi. Hem senin hem karşındakinin bildiği belirli bir nesneden veya dünyada tek olan şeylerden bahsediyorsan "the" gelir; mesela "the sun" veya "the exam we took yesterday" gibi. Genel kavramlarda ve çoğul genellemelerde ise, örneğin "Dogs are loyal" derken, hiç artikel kullanılmaz.',
    summaryEn:
      'Use "a" before consonant sounds and "an" before vowel sounds for non-specific singular nouns, "the" for specific/unique nouns, and zero article for plural generalizations.',
    examples: [
      {
        en: 'I need a pen and an umbrella.',
        tr: 'Bir kaleme ve bir şemsiyeye ihtiyacım var.',
        highlight: 'a pen / an umbrella',
      },
      {
        en: 'Dogs are loyal animals.',
        tr: 'Köpekler sadık hayvanlardır. (Genel çoğul → artikel yok)',
        highlight: 'Dogs',
      },
      {
        en: 'I have a exam tomorrow morning.',
        tr: 'YANLIŞ! "exam" sesli harf sesiyle başlar → "AN exam".',
        highlight: 'a exam → an exam',
        isTrap: true,
        trapNoteEn: 'Use "an" before a vowel sound: "an exam".',
      },
    ],
  },
  simple_past: {
    id: 'simple_past',
    icon: '🕰️',
    titleTr: 'Düz Geçmiş Zaman (Simple Past)',
    titleEn: 'Simple Past (V2)',
    headlineTr: 'Bitmiş geçmiş olaylar: olumluda V2 / -ed, soruda ve olumsuzda did + V1!',
    headlineEn: 'Finished past events: V2 / -ed in statements, did + V1 in negatives/questions!',
    transcriptTr:
      'Geçmişte belirli bir anda başlayıp tamamen bitmiş olaylar için düz geçmiş zaman kullanılır. Düzenli fiillerin sonuna geçmiş zaman takısı eklenir; örneğin "work" kelimesi "worked", "study" ise "studied" olur. Düzensiz fiillerde ise ikinci hâl ezberlenir; mesela "go" yerine "went", "see" yerine "saw", "buy" yerine "bought" söylenir. Olumlu cümlede özne fark etmeksizin hep aynı geçmiş biçim kullanılır: "I went home early" ve "She saw the movie yesterday" gibi. Ama olumsuz veya soru yaparken "did" devreye girer ve ana fiil tekrar yalın hâline döner.',
    summaryEn:
      'Use Simple Past for completed past actions: regular -ed or irregular V2 in positive clauses, and did / did not + base verb in questions and negatives.',
    examples: [
      {
        en: 'She saw the movie yesterday.',
        tr: 'Dün filmi izledi.',
        highlight: 'saw',
      },
      {
        en: 'We studied for two hours last night.',
        tr: 'Dün gece iki saat ders çalıştık.',
        highlight: 'studied',
      },
      {
        en: 'I buyed a new headset last week.',
        tr: 'YANLIŞ! "buy" düzensiz fiildir → "I BOUGHT a new headset."',
        highlight: 'buyed → bought',
        isTrap: true,
        trapNoteEn: '"buy" is irregular; its past form is "bought".',
      },
    ],
  },
  can_could_able: {
    id: 'can_could_able',
    icon: '💪',
    titleTr: 'can / could / be able to',
    titleEn: 'can / could / be able to',
    headlineTr: 'Şimdi → can | Geçmiş veya kibar istek → could | Gelecek → will be able to!',
    headlineEn: 'Now → can | Past or polite request → could | Future → will be able to!',
    transcriptTr:
      'Yetenek, ihtimal ve kibar istek anlatırken "I can", "could" ve "be able to" kalıplarını kullanırız. Şu an yapabildiğin şeyler için "I can speak English" veya "we can do this" gibi yapılar kullanılır. Geçmişteki genel yetenekler veya daha kibar ricalar için "could" tercih edilir; mesela "Could you help me with this?" ya da "I could not sleep last night" şeklinde söylenir. Gelecek zaman veya "have" gibi yapılardan sonra "will can" denemeyeceği için onun yerine "be able to" devreye girer; örneğin "You will be able to finish it tomorrow" gibi.',
    summaryEn:
      'Use "can" for present ability, "could" for past ability or polite requests, and "be able to" after auxiliaries like "will" or "have".',
    examples: [
      {
        en: 'Could you help me with this task?',
        tr: 'Bu görevde bana yardımcı olabilir misin?',
        highlight: 'Could you',
      },
      {
        en: 'You will be able to finish it tomorrow.',
        tr: 'Yarın bunu bitirebileceksin.',
        highlight: 'will be able to',
      },
      {
        en: 'I will can join the meeting later.',
        tr: 'YANLIŞ! "will" sonrası "can" gelmez → "I will BE ABLE TO join."',
        highlight: 'will can → will be able to',
        isTrap: true,
        trapNoteEn: 'Never combine "will" + "can"; use "will be able to".',
      },
    ],
  },
  quantifiers_count: {
    id: 'quantifiers_count',
    icon: '⚖️',
    titleTr: 'much / many / some / any',
    titleEn: 'Quantifiers (much / many / some / any)',
    headlineTr: 'Sayılabilir → many / a few | Sayılamaz → much / a little!',
    headlineEn: 'Countable → many / a few | Uncountable → much / a little!',
    transcriptTr:
      'İngilizcede miktar belirtirken ismin sayılabilir mi yoksa sayılamaz mı olduğuna bakmak gerekir. Kitap veya elma gibi sayılabilen çoğullarda "many" ve "a few" kullanılır; örneğin "many books" ve "a few friends" gibi. Su, zaman veya para gibi sayılamayan isimlerde ise "much" ve "a little" gelir; mesela "too much noise" veya "a little time" şeklinde söylenir. Olumlu cümlelerde genelde "some", olumsuz ve soru cümlelerinde ise "any" tercih edilir; "enough" kelimesi isimden önce, sıfattan sonra yer alır.',
    summaryEn:
      'Pair countable plurals with many / a few, uncountable nouns with much / a little, positive clauses with some, negatives/questions with any, and place enough before nouns / after adjectives.',
    examples: [
      {
        en: 'There is too much noise in the street.',
        tr: 'Sokakta çok fazla gürültü var.',
        highlight: 'too much noise',
      },
      {
        en: 'We have enough time to check the details.',
        tr: 'Detayları kontrol etmek için yeterli zamanımız var.',
        highlight: 'enough time',
      },
      {
        en: 'I do not have many time today.',
        tr: 'YANLIŞ! "time" sayılamaz → "I do not have MUCH time."',
        highlight: 'many time → much time',
        isTrap: true,
        trapNoteEn: '"time" is uncountable, so use "much time", not "many time".',
      },
    ],
  },
  present_continuous: {
    id: 'present_continuous',
    icon: '🎬',
    titleTr: 'Şimdiki Zaman (am/is/are + -ing)',
    titleEn: 'Present Continuous',
    headlineTr: 'Şu an olanlar ve kesinleşmiş yakın planlar: am / is / are + V-ing!',
    headlineEn: 'Happening right now or fixed near plans: am / is / are + V-ing!',
    transcriptTr:
      'Tam şu konuşma anında gerçekleşen olayları veya bu günlerde geçici olarak süren durumları anlatırken şimdiki zaman kullanılır. Yapı her zaman özneye göre "am", "is" veya "are" ve ardından fiilin "reading" veya "working" gibi devam hâliyle kurulur; örneğin "I am reading a book right now" veya "She is working on a new project this week" gibi. Ayrıca ajandanda kesinleşmiş yakın gelecek planlarını anlatırken de kullanılır; mesela "We are meeting at seven tonight" gibi. Unutma, "know", "want" veya "believe" gibi duygu ve zihin fiilleri genelde şimdiki zamanda kullanılmaz.',
    summaryEn:
      'Use am/is/are + V-ing for actions happening right now, temporary ongoing projects, or fixed near-future arrangements. Avoid -ing with stative verbs like know, want, or believe.',
    examples: [
      {
        en: 'She is working on a new project this week.',
        tr: 'Bu hafta yeni bir proje üzerinde çalışıyor.',
        highlight: 'is working',
      },
      {
        en: 'We are meeting at seven tonight.',
        tr: 'Bu akşam yedide buluşuyoruz.',
        highlight: 'are meeting',
      },
      {
        en: 'I am knowing the answer already.',
        tr: 'YANLIŞ! "know" durum fiilidir, -ing almaz → "I KNOW the answer."',
        highlight: 'am knowing → know',
        isTrap: true,
        trapNoteEn: '"know" is a stative verb and is not used in Present Continuous.',
      },
    ],
  },
  wh_questions: {
    id: 'wh_questions',
    icon: '❓',
    titleTr: 'Soru Kelimeleri (WH-Questions)',
    titleEn: 'WH-Questions',
    headlineTr: 'WH-kelimesi başa, hemen arkasına yardımcı fiil gelir (özne sorusu hariç)!',
    headlineEn: 'Put the WH-word first, followed immediately by the auxiliary verb!',
    transcriptTr:
      'İngilizcede "what", "where", "why", "when" ve "how" gibi soru kelimeleri her zaman cümlenin en başına gelir. Hemen arkasından düz cümle gibi özne değil, mutlaka yardımcı fiil gelir; örneğin "Where do you live?", "When did she arrive?" veya "Why are they waiting?" şeklinde kurulur. "How long" süreyi, "how many" sayılabilen adedi, "how much" ise sayılamayan miktarı veya fiyatı sorar. Tek istisna, "Who called you?" örneğindeki gibi soru kelimesi doğrudan öznenin kendisi olduğunda araya "do" veya "did" konulmamasıdır.',
    summaryEn:
      'Start with the WH-word followed by auxiliary + subject + verb ("Where do you live?"). Only drop do/did when the WH-word itself is the subject ("Who called you?").',
    examples: [
      {
        en: 'When did she arrive at the station?',
        tr: 'İstasyona ne zaman vardı?',
        highlight: 'When did she arrive',
      },
      {
        en: 'Who called you this morning?',
        tr: 'Bu sabah seni kim aradı? (Özne sorusu → did yok)',
        highlight: 'Who called',
      },
      {
        en: 'Where you live in Turkey?',
        tr: 'YANLIŞ! WH sonrası yardımcı fiil şart → "Where DO you live?"',
        highlight: 'Where you → Where do you',
        isTrap: true,
        trapNoteEn: 'Add the auxiliary "do": "Where do you live?"',
      },
    ],
  },
  imperatives_lets: {
    id: 'imperatives_lets',
    icon: '👉',
    titleTr: 'Emir ve Öneri (Imperatives & Let us)',
    titleEn: 'Imperatives & Suggestions',
    headlineTr: 'Özne olmadan yalın fiille başla; birlikte öneri için Let us + V1!',
    headlineEn: 'Start directly with the base verb; use Let us / Let’s + V1 for suggestions!',
    transcriptTr:
      'İngilizcede birine talimat, tavsiye veya uyarı verirken özne söylemeden doğrudan fiilin en yalın hâliyle cümleye başlarız. Örneğin "Check your notes carefully" veya "Take a deep breath" cümlelerinde gizli özne her zaman "you" olarak anlaşılır. Yasak ya da olumsuz uyarı verirken fiilin başına "do not" veya "never" getirilir; mesela "Do not forget your keys" ve "Never give up" gibi. Karşındakine birlikte bir şey yapmayı önerirken ise "Let us" kalıbı ve ardından yalın fiil kullanılır; örneğin "Let us take a short break" gibi.',
    summaryEn:
      'Imperatives omit the subject and start with the bare verb ("Check your notes"), negate with Do not / Don’t / Never, and make joint suggestions with Let us / Let’s + base verb.',
    examples: [
      {
        en: 'Check your notes carefully before the exam.',
        tr: 'Sınavdan önce notlarını dikkatlice kontrol et.',
        highlight: 'Check',
      },
      {
        en: 'Do not forget your keys on the desk.',
        tr: 'Anahtarlarını masada unutma.',
        highlight: 'Do not forget',
      },
      {
        en: 'Let us to take a short break.',
        tr: 'YANLIŞ! "Let us" sonrası "to" gelmez → "Let us TAKE a short break."',
        highlight: 'to take → take',
        isTrap: true,
        trapNoteEn: 'Use the bare infinitive after "Let us / Let’s": no "to".',
      },
    ],
  },
  comparatives_superlatives: {
    id: 'comparatives_superlatives',
    icon: '📊',
    titleTr: 'Karşılaştırma ve En Üstünlük',
    titleEn: 'Comparatives & Superlatives',
    headlineTr: '2 şey → -er / more + than | Grup içi en → the -est / the most!',
    headlineEn: '2 things → -er / more + than | Top of a group → the -est / the most!',
    transcriptTr:
      'İki şeyi karşılaştırırken kısa sıfatlar "faster" veya "taller" biçimini alır, uzun sıfatların önüne ise "more" getirilir ve karşılaştırma mutlaka "than" kelimesiyle bağlanır; örneğin "faster than" ve "more useful than" gibi. Bir grup içindeki en üstün olanı söylerken kısa sıfatlarda "the fastest" veya "the tallest" biçimi, uzun sıfatlarda ise "the most" kullanılır; mesela "the most important" şeklinde söylenir. İki şeyin eşit olduğunu anlatmak için "as tall as" kalıbı kullanılır; "good" kelimesinin "better" ve "the best", "bad" kelimesinin ise "worse" ve "the worst" olduğunu unutma.',
    summaryEn:
      'Use -er / more + than to compare two items, the -est / the most for superlatives, as + adj + as for equality, and memorize irregulars (good → better → the best, bad → worse → the worst).',
    examples: [
      {
        en: 'This shortcut is much faster than the main road.',
        tr: 'Bu kestirme ana yoldan çok daha hızlı.',
        highlight: 'faster than',
      },
      {
        en: 'That was the most useful lesson of the week.',
        tr: 'Bu haftanın en faydalı dersiydi.',
        highlight: 'the most useful',
      },
      {
        en: 'This phone is more better than the old one.',
        tr: 'YANLIŞ! "better" zaten karşılaştırmadır, "more" eklenmez → "BETTER than".',
        highlight: 'more better → better',
        isTrap: true,
        trapNoteEn: 'Never double up "more" with an irregular comparative like "better".',
      },
    ],
  },
  relative_clauses: {
    id: 'relative_clauses',
    icon: '🔗',
    titleTr: 'Sıfat Cümlecikleri (who / which / that)',
    titleEn: 'Relative Clauses',
    headlineTr: 'İnsan → who | Nesne → which | Her ikisi → that | Yer → where | Sahiplik → whose!',
    headlineEn: 'People → who | Things → which | Either → that | Place → where | Possession → whose!',
    transcriptTr:
      'İngilizcede bir ismi ayrı bir cümleyle tarif etmek için sıfat cümlecikleri kullanılır. İnsanları tanıtırken "who", nesneleri ve kavramları tanıtırken "which", her ikisi için günlük konuşmada "that" kelimesi bağlaç görevi görür; örneğin "The teacher who helped me" veya "The movie which we watched" gibi. Yer belirtirken "where", sahiplik bildirirken ise "whose" kullanılır; mesela "The cafe where we met" veya "A friend whose sister lives in London" şeklinde söylenir. Bu yapılar Türkçedeki "yapan, eden, olan" eklerinin İngilizcedeki tam karşılığıdır.',
    summaryEn:
      'Connect descriptive clauses to nouns using who (people), which (things), that (both in everyday speech), where (places), and whose (possession).',
    examples: [
      {
        en: 'The teacher who helped me lives nearby.',
        tr: 'Bana yardım eden öğretmen yakında yaşıyor.',
        highlight: 'who helped me',
      },
      {
        en: 'This is the cafe where we first met.',
        tr: 'İlk tanıştığımız kafe burası.',
        highlight: 'where we first met',
      },
      {
        en: 'The movie who we watched was brilliant.',
        tr: 'YANLIŞ! Nesneler için "who" değil → "The movie WHICH / THAT we watched".',
        highlight: 'who → which / that',
        isTrap: true,
        trapNoteEn: 'Use "which" or "that" for things, never "who".',
      },
    ],
  },
  reflexives_reciprocals: {
    id: 'reflexives_reciprocals',
    icon: '🪞',
    titleTr: 'myself / yourself / each other',
    titleEn: 'Reflexive & Reciprocal Pronouns',
    headlineTr: 'Kendi kendine → -self | Karşılıklı birbirine → each other!',
    headlineEn: 'Action on oneself → -self | Mutual action → each other!',
    transcriptTr:
      'Bir cümlede işi yapan özne ile o işten etkilenen kişi aynıysa dönüşlü zamirler kullanılır: "myself", "yourself", "himself", "herself", "ourselves" ve "themselves". Örneğin "I taught myself English" dediğinde İngilizceyi kendi kendine öğrendiğini anlatırsın; "by myself" ifadesi ise tek başıma anlamına gelir. İki veya daha fazla kişinin birbiriyle karşılıklı yaptığı eylemlerde ise dönüşlü zamir yerine her zaman "each other" kullanılır; örneğin "We help each other every day" cümlesi birbirimize yardım ederiz demektir.',
    summaryEn:
      'Use reflexive pronouns (myself, himself, themselves) when subject and object are the same person ("by myself" = alone), and use "each other" for mutual actions.',
    examples: [
      {
        en: 'I taught myself how to code.',
        tr: 'Kod yazmayı kendi kendime öğrendim.',
        highlight: 'myself',
      },
      {
        en: 'We help each other every day.',
        tr: 'Her gün birbirimize yardım ederiz.',
        highlight: 'each other',
      },
      {
        en: 'They looked at themselves in surprise. (birbirlerine baktılar anlamında)',
        tr: 'YANLIŞ! Karşılıklı bakışma için "themselves" değil → "EACH OTHER"!',
        highlight: 'themselves → each other',
        isTrap: true,
        trapNoteEn: '"themselves" means looking at their own reflection; mutual action requires "each other".',
      },
    ],
  },
  there_is_it_is: {
    id: 'there_is_it_is',
    icon: '📍',
    titleTr: 'There is / There are & It is ... to',
    titleEn: 'There is/are & It is + adj + to',
    headlineTr: 'Var olmak → There is / are | Eylem yorumu → It is + sıfat + to + fiil!',
    headlineEn: 'Existence → There is / are | Evaluating an action → It is + adj + to + V1!',
    transcriptTr:
      'Türkçedeki "var" anlamını İngilizcede tekil ve sayılamayan şeyler için "there is", çoğullar için ise "there are" kalıbı verir; örneğin "There is a problem" ve "There are three options" gibi. Geçmişte vardı demek için "there was" ve "there were" kullanılır. Bir eylemi yorumlarken ise özneyi boş bırakmamak için cümleye "it is" ile başlayıp sıfat ve ardından "to" ile fiil getiririz; mesela "It is important to practice every day" veya "It is easy to make mistakes" kalıpları İngilizcede çok sık kullanılır.',
    summaryEn:
      'Use "there is" (singular/uncountable) and "there are" (plural) to express existence, and "It is + adjective + to + verb" to comment on actions.',
    examples: [
      {
        en: 'There are three options on the screen.',
        tr: 'Ekranda üç seçenek var.',
        highlight: 'There are',
      },
      {
        en: 'It is important to practice every day.',
        tr: 'Her gün pratik yapmak önemlidir.',
        highlight: 'It is important to',
      },
      {
        en: 'Is easy to make mistakes at first.',
        tr: 'YANLIŞ! İngilizcede özne boş kalamaz → "IT IS easy to make mistakes."',
        highlight: 'Is easy → It is easy',
        isTrap: true,
        trapNoteEn: 'English requires the dummy subject "It": "It is easy to..."',
      },
    ],
  },
  reported_speech: {
    id: 'reported_speech',
    icon: '💬',
    titleTr: 'Aktarım ve Dolaylı Sorular',
    titleEn: 'Reported Speech & Indirect Questions',
    headlineTr: 'Geçmiş aktarımda zaman 1 adım geri kayar; dolaylı soruda düz cümle sırası!',
    headlineEn: 'Backshift tense after said/told; keep statement word order in indirect questions!',
    transcriptTr:
      'Başkasının söylediği bir sözü veya sorduğu bir soruyu aktarırken dolaylı anlatım kullanılır. Aktarım fiili geçmiş zamandaysa, yani "said" veya "told" ile başlıyorsak, aktarılan cümlenin zamanı genelde bir adım geçmişe kayar; örneğin "He said that he was tired" gibi. "Say something" tek başına veya "say to me" şeklinde kullanılır; "tell" ise mutlaka bir kişiyle gelir, yani "She told me" denir, "She said me" denmez. Dolaylı sorularda ise soru sırası bozulur ve düz cümle dizilimine geçilir; örneğin "She asked if I was ready" veya "I wonder where he lives" şeklinde söylenir.',
    summaryEn:
      'Backshift tenses after past reporting verbs (said/told). Use "told + person" (never "said me"), and keep normal subject-verb order in indirect questions ("I wonder where he lives").',
    examples: [
      {
        en: 'She told me that the flight was delayed.',
        tr: 'Bana uçuşun ertelendiğini söyledi.',
        highlight: 'told me',
      },
      {
        en: 'I wonder where he lives now.',
        tr: 'Şimdi nerede yaşadığını merak ediyorum.',
        highlight: 'where he lives',
      },
      {
        en: 'She said me she was busy.',
        tr: 'YANLIŞ! Kişi varsa "said me" değil → "She TOLD me" veya "said TO me".',
        highlight: 'said me → told me',
        isTrap: true,
        trapNoteEn: 'Use "told me" (or "said to me"), never "said me".',
      },
    ],
  },
  be_get_used_to: {
    id: 'be_get_used_to',
    icon: '🔄',
    titleTr: 'be used to / get used to (Alışık Olmak)',
    titleEn: 'be / get used to + -ing / noun',
    headlineTr: 'Alışık olmak → be used to + -ing | Alışmak → get used to + -ing!',
    headlineEn: 'Accustomed → be used to + -ing/noun | Adapting → get used to + -ing/noun!',
    transcriptTr:
      'Bu kalıp, eskiden yapardım anlamına gelen "used to" yapısıyla çok karıştırılır ama anlamı tamamen farklıdır. Önünde "am", "is", "are" olduğunda "be used to" bir şeye alışık olmak demektir; önünde "get" olduğunda ise "get used to" o şeye zamanla alışmak anlamına gelir. En kritik kural şudur: bu kalıptaki "to" bir edattır, bu yüzden ardından yalın fiil değil, mutlaka bir isim ya da "waking" ve "driving" gibi devam hâlinde bir fiil gelir. Örneğin "I am used to waking up early" erken kalkmaya alışığım, "You will get used to the new routine" ise yeni rutine alışacaksın demektir.',
    summaryEn:
      'Unlike past-habit "used to + V1", "be used to" (accustomed) and "get used to" (adapt) take a noun or gerund (-ing) because "to" is a preposition.',
    examples: [
      {
        en: 'I am used to waking up early in winter.',
        tr: 'Kışın erken kalkmaya alışığım.',
        highlight: 'am used to waking',
      },
      {
        en: 'You will soon get used to the new routine.',
        tr: 'Yeni rutine yakında alışacaksın.',
        highlight: 'get used to',
      },
      {
        en: 'She is used to drive in heavy traffic.',
        tr: 'YANLIŞ! "be used to" sonrası -ing gelir → "is used to DRIVING".',
        highlight: 'drive → driving',
        isTrap: true,
        trapNoteEn: 'After "be/get used to", always use a gerund (-ing) or noun.',
      },
    ],
  },
  cause_effect_linkers: {
    id: 'cause_effect_linkers',
    icon: '⚡',
    titleTr: 'because / because of / so / in order to',
    titleEn: 'Cause, Effect & Purpose Linkers',
    headlineTr: 'Cümle → because | İsim → because of / due to | Sonuç → so | Amaç → in order to!',
    headlineEn: 'Clause → because | Noun → because of / due to | Result → so | Purpose → in order to!',
    transcriptTr:
      'Sebep, sonuç ve amaç kurarken doğru bağlacı seçmek cümlenin akışını tamamen değiştirir. Arkasından özne ve fiil içeren tam bir cümle geliyorsa "because" kullanılır; örneğin "We stayed home because it was raining" gibi. Sadece bir isim geliyorsa "because of" veya "due to" tercih edilir; mesela "because of the rain" şeklinde söylenir. Sonuç belirtirken "so" veya daha resmî "therefore", amaç anlatırken ise fiilin yalın hâliyle "in order to" veya "to" kullanılır; örneğin "I woke up early in order to catch the train" gibi.',
    summaryEn:
      'Follow "because" with a full clause, "because of / due to" with a noun phrase, "so / therefore" for results, and "in order to / to + V1" for purpose.',
    examples: [
      {
        en: 'The flight was delayed because of the fog.',
        tr: 'Uçuş sis yüzünden ertelendi. (İsim → because of)',
        highlight: 'because of',
      },
      {
        en: 'I woke up early in order to catch the train.',
        tr: 'Trene yetişmek için erken uyandım.',
        highlight: 'in order to',
      },
      {
        en: 'We stayed indoors because the heavy rain.',
        tr: 'YANLIŞ! İsim tamlaması varsa "of" şart → "BECAUSE OF the heavy rain".',
        highlight: 'because → because of',
        isTrap: true,
        trapNoteEn: 'Use "because of" before a noun phrase without a verb.',
      },
    ],
  },
  past_perfect: {
    id: 'past_perfect',
    icon: '⏪',
    titleTr: 'Geçmişin Geçmişi (had + V3)',
    titleEn: 'Past Perfect (had + V3)',
    headlineTr: 'İki geçmiş olaydan DAHA ÖNCE olanı işaretlemek için: had + V3!',
    headlineEn: 'Mark the EARLIER of two past events with had + V3!',
    transcriptTr:
      'Geçmişte yaşanmış iki olaydan hangisinin daha önce olduğunu netleştirmek için "had" ve fiilin üçüncü hâliyle kurulan geçmişin geçmişi kullanılır. Örneğin "When we arrived at the station, the train had already left" cümlesinde trenin gitmesi, bizim istasyona varmamızdan daha önce gerçekleşmiştir. "Already", "never" ve "just" gibi kelimeler "had" ile üçüncü hâl arasına girer; örneğin "I had never seen snow before that winter" gibi. Tek bir geçmiş olay anlatıyorsan bu yapıya gerek yoktur; yalnızca iki geçmiş olay arasında sıra kurarken devreye girer.',
    summaryEn:
      'Use had + past participle (V3) only to show that one past action happened before another past reference point.',
    examples: [
      {
        en: 'When we arrived, the train had already left.',
        tr: 'Vardığımızda tren çoktan gitmişti.',
        highlight: 'had already left',
      },
      {
        en: 'I had never seen snow before that winter.',
        tr: 'O kıştan önce hiç kar görmemiştim.',
        highlight: 'had never seen',
      },
      {
        en: 'She had finish the report before noon.',
        tr: 'YANLIŞ! "had" sonrası fiil 3. hâlde olmalı → "She had FINISHED".',
        highlight: 'finish → finished',
        isTrap: true,
        trapNoteEn: 'Past Perfect always uses the 3rd form (V3): "had finished".',
      },
    ],
  },
  time_place_prepositions_extra: {
    id: 'time_place_prepositions_extra',
    icon: '🗺️',
    titleTr: 'before / after / during / without',
    titleEn: 'Prepositions: before / after / during / without',
    headlineTr: 'İsim önüne gelen zaman ve konum sınırları: before an exam, during the meeting!',
    headlineEn: 'Time & context boundaries before nouns: before an exam, during the meeting!',
    transcriptTr:
      '"Before", "after", "until", "during" ve "without" gibi edatlar doğrudan bir isim veya zaman ifadesinin önüne gelerek net sınırlar çizer. Örneğin "before an exam" sınavdan önce, "after dinner" akşam yemeğinden sonra, "during the meeting" ise toplantı boyunca demektir. Burada çok sık yapılan bir hata vardır: "during" her zaman bir olay isminin önüne gelir, saat veya gün sayısının önüne gelmez; "during three hours" değil, "for three hours" denir. Ayrıca iki nokta arası için "between", eksiklik anlatmak için ise "without coffee" örneğindeki gibi "without" kullanılır.',
    summaryEn:
      'Use before, after, until, during, between, and without directly before noun phrases. Remember: use "during" with events ("during the meeting"), never durations ("for three hours").',
    examples: [
      {
        en: 'Review your notes calmly before an exam.',
        tr: 'Sınavdan önce notlarını sakince gözden geçir.',
        highlight: 'before an exam',
      },
      {
        en: 'Please silence your phone during the meeting.',
        tr: 'Toplantı boyunca lütfen telefonunu sessize al.',
        highlight: 'during the meeting',
      },
      {
        en: 'I studied English during three hours.',
        tr: 'YANLIŞ! Sayılı sürede "during" değil → "FOR three hours"!',
        highlight: 'during → for',
        isTrap: true,
        trapNoteEn: 'Use "for" with counted durations ("for three hours") and "during" with named events.',
      },
    ],
  },
};

const VALID_VOICE_COACH_SET = new Set<string>(VOICE_COACH_RULE_ORDER);

export function isValidVoiceCoachRuleId(value: string): value is VoiceCoachRuleId {
  return VALID_VOICE_COACH_SET.has(value);
}

/**
 * Retrieve unified voice-coach metadata (title, headline, verbatim transcript, examples)
 * for any of the 35 supported grammar & vocabulary voiceover rules.
 */
export function getVoiceCoachRuleSpec(ruleId: VoiceCoachRuleId): VoiceCoachRuleSpec {
  if (ruleId in EXTRA_GRAMMAR_RULES) {
    return EXTRA_GRAMMAR_RULES[ruleId as ExtraGrammarRuleId];
  }
  const weakId = ruleId as keyof typeof REMEDIAL_SKILL_CATALOG;
  const rem = REMEDIAL_SKILL_CATALOG[weakId];
  return {
    id: weakId,
    icon: rem.icon,
    titleTr: rem.titleTr,
    titleEn: rem.titleEn,
    headlineTr: rem.briefing.headlineTr,
    headlineEn: rem.briefing.headlineEn,
    transcriptTr: REMEDIAL_VOICE_TRANSCRIPTS[weakId],
    summaryEn: rem.briefing.goldenRuleEn,
    examples: rem.briefing.examples,
  };
}
