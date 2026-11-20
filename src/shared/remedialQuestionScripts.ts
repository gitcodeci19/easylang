import type { WeakSkillId } from './types';

export type RemedialStaticTemplateKind = 'duel' | 'spot' | 'scen';

/** Relative folder inside `public/` where per-question ElevenLabs MP3 files live. */
export const REMEDIAL_QUESTION_AUDIO_DIR = 'audio/remedial_questions';

/**
 * Build the deterministic audio/script key for any pre-authored static remedial question.
 * Example: `was_vs_were__duel_1`, `passive_voice__spot_2`, `time_clauses__scen_1`.
 */
export function getRemedialQuestionAudioId(
  skillId: WeakSkillId,
  kind: RemedialStaticTemplateKind,
  oneBasedIndex: number
): string {
  return `${skillId}__${kind}_${oneBasedIndex}`;
}

export function getRemedialQuestionAudioRelativePath(audioId: string): string {
  return `${REMEDIAL_QUESTION_AUDIO_DIR}/${audioId}.mp3`;
}

/**
 * Hand-crafted Turkish ElevenLabs voiceover scripts for all 92 pre-authored
 * remedial workshop questions (39 contrast duels, 35 spot-fixes, 18 scenarios).
 * Written specifically for smooth Turkish + English multilingual pronunciation:
 * no slash symbols, raw grammar abbreviations (V1/V2/V3), or tricky apostrophes.
 */
export const REMEDIAL_QUESTION_SCRIPTS: Record<string, string> = {
  // ==================== 1. was_vs_were (6) ====================
  was_vs_were__duel_1:
    'Bu soruda ilk bakacağın yer öznedir. "My teammates", yani takım arkadaşlarım, birden fazla kişi olduğu için çoğuldur. İngilizcede tekil öznelerde "was", çoğul öznelerde ise her zaman "were" kullanılır. Bu yüzden doğru cümle "My teammates were exhausted" olur. Mesela "My friends were ready" veya "The players were tired" cümlelerinde de aynı kural geçerlidir.',
  was_vs_were__duel_2:
    'Burada karşındaki tek bir kişi bile olsa özne "you" olduğu için kural hiç değişmez: "you" her zaman "were" ile kullanılır. Yani "Was you listening" değil, "Were you listening to rock music?" demelisin. Benzer şekilde "Were you at home?" ya da "You were right" örneklerini aklında tut.',
  was_vs_were__duel_3:
    'Bu cümlede özne "The new update", yani tek bir güncellemedir. Tek bir kişi ya da tek bir nesne söz konusuysa geçmişte "idi" demek için "was" seçilir. Doğru yapı "The new update was finally released" olur. Tıpkı "The movie was amazing" veya "My phone was silent" örneklerindeki gibi.',
  was_vs_were__spot_1:
    'Bu cümledeki hata "was" kelimesindedir. Çünkü cümlenin öznesi "All the tickets", yani bütün biletler, çoğuldur. Çoğul bir özneyle "was" kullanılmaz, yerine "were" gelir: "All the tickets were sold out in minutes". Mesela "The seats were empty" veya "All the lights were off" gibi.',
  was_vs_were__spot_2:
    'Soru cümlesinde de kural aynıdır: "you" öznesi hiçbir zaman "was" almaz. Bu yüzden "Why was you late?" yanlıştır, doğrusu "Why were you late to the stream?" olmalıdır. Aynı kalıbı "Where were you yesterday?" ya da "Were you busy?" sorularında da kullanırsın.',
  was_vs_were__scen_1:
    'Bu senaryoda iki ayrı özne var ve ikisini ayrı kontrol etmelisin. İlk yarıda "The concert" tekil olduğu için "was awesome" denir. İkinci yarıda ise "the band members" çoğul olduğu için "were super energetic" gelir. Örneğin "The food was great and the waiters were kind" cümlesinde de iki taraf öznesine göre ayrılır.',

  // ==================== 2. should_vs_have_to (6) ====================
  should_vs_have_to__duel_1:
    'Birine kahve önermek yasal bir mecburiyet değil, samimi bir tavsiyedir. İngilizcede iyi fikir ve öneri verirken "have to" değil "should" kullanırız: "You should try the iced latte here". Örneğin "You should watch this series" veya "You should take a short break" gibi.',
  should_vs_have_to__duel_2:
    'Havalimanı kapısında pasaport göstermek senin keyfine kalmış bir öneri değildir; resmî bir kuraldır. Dıştan gelen mecburiyetlerde "should" yerine "have to" kullanılır: "Passengers have to show their passport". Tıpkı "Drivers have to wear a seatbelt" ya da "We have to submit the form" örneklerindeki gibi.',
  should_vs_have_to__duel_3:
    'Olumsuzda anlam farkı çok kritiktir. "should not" yapmasan iyi olur demektir; oysa burada "erken uyanmak zorunda değilim, gerek yok" demek istiyoruz. Zorunluluğun olmadığını anlatmak için "do not have to" kullanılır: "I do not have to wake up early". Mesela "You do not have to pay today" yani bugün ödemene gerek yok gibi.',
  should_vs_have_to__spot_1:
    'Buradaki tuzak "should" kelimesinden sonra "to" eklenmesidir. "have to" kalıbında "to" vardır ama "should" doğrudan yalın fiille birleşir, asla "to" almaz. Doğrusu "You should back up your code today" olur. Aynı şekilde "You should call her" veya "We should leave now" deriz.',
  should_vs_have_to__spot_2:
    'Özne "He", "She" ya da "It" olduğunda "have to" kalıbı çekimlenir ve "has to" olur. Bu yüzden "He have to submit" yanlıştır; doğrusu "He has to submit his assignment tonight" şeklindedir. Örneğin "She has to work late" ya da "It has to be ready" cümlelerinde de "has to" kullanılır.',
  should_vs_have_to__scen_1:
    'Uykusuz kalan bir arkadaşına baskı kurmadan yumuşak bir tavsiye verirken en doğal kalıp "should" ve ardından yalın fiildir: "You should get some sleep before work". "do not have to" uyumana gerek yok anlamına gelip anlamı bozar. Mesela "You should drink more water" veya "You should rest a bit" de aynı tondadır.',

  // ==================== 3. used_to_habit (5) ====================
  used_to_habit__duel_1:
    'Olumlu bir cümlede eskiden yapıp artık bıraktığın bir alışkanlığı anlatırken geçmiş zamanı göstermek için sondaki harfi unutmadan "used to" yazarsın: "I used to spend hours customizing my desktop wallpaper". Örneğin "I used to play football" ya da "She used to live in Izmir" gibi.',
  used_to_habit__duel_2:
    'Bu cümlede olumsuz yardımcı fiil "did not" zaten geçmiş zamanı taşıyor. Bu yüzden arkasından gelen kalıp yalın hâline döner ve "used to" değil "use to" olur: "He did not use to like spicy food". Tıpkı "I did not use to drink tea" veya "We did not use to travel much" örneklerindeki gibi.',
  used_to_habit__spot_1:
    '"used to" kalıbının ardından gelen ana fiil her zaman yalın birinci hâlinde kalır; geçmiş zaman hâline çevrilmez. Bu yüzden "used to went" yanlıştır, doğrusu "We used to go to that arcade together" olmalıdır. Örneğin "I used to eat fast food" veya "They used to meet every Friday" gibi.',
  used_to_habit__spot_2:
    'Soru cümlesi "Did" ile başladığı için geçmiş zaman görevini "Did" üstlenir. Bu durumda "used to" içindeki geçmiş takısı düşer ve "use to" olarak yazılır: "Did you use to collect vinyl records?". Aynı mantıkla "Did you use to play chess?" veya "Did she use to work here?" sorulur.',
  used_to_habit__scen_1:
    'Eski bir alışkanlığı bugünkü yeni düzeninle kıyaslarken en temiz yapı "used to" ve yalın fiildir: "I used to stay up late, but now I sleep early". İkinci seçenekte "staying" hatalıdır, üçüncü seçenekteki "am used to" ise alışık olmak anlamına gelir. Mesela "I used to skip breakfast, but now I eat every morning" gibi.',

  // ==================== 4. past_continuous (5) ====================
  past_continuous__duel_1:
    'Kulaklığın aniden kapandığı anda podcast dinleme eylemi arka planda devam ediyordu. Geçmişte sürerken başka bir olayla bölünen eylemler "was" ya da "were" ve devam hâliyle kurulur: "I was listening to a podcast when my headphones died". Örneğin "I was walking home when it started to rain" veya "He was reading when I knocked" gibi.',
  past_continuous__duel_2:
    'Sorudaki ana fiil "doing" şeklinde devam hâlindedir. Devam hâlindeki bir fiille "did" kullanılmaz; özne "you" olduğu için yardımcı fiil "were" seçilir: "What were you doing at midnight yesterday?". Benzer şekilde "Where were you going?" ya da "Who were you talking to?" diye sorarsın.',
  past_continuous__spot_1:
    'Özne "we", yani biz, çoğul olduğu için "was driving" hatadır. Çoğul öznelerle geçmişte devam eden eylemde "were" kullanılır: "While we were driving home, it started snowing". Tıpkı "While they were waiting" veya "While we were eating dinner" cümlelerindeki gibi.',
  past_continuous__spot_2:
    'Burada özne "She" tekil bir kişidir; bu yüzden "were coding" yerine "was coding" kullanılmalıdır: "She was coding when the laptop crashed". Aynı şekilde "He was sleeping when the alarm rang" veya "My brother was studying all night" deriz.',
  past_continuous__scen_1:
    'Telefon çaldığı anda duş alma eylemi devam ettiği için uzun eylem "was taking", onu bölen kısa arama ise "called" olur: "Sorry, I was taking a shower when you called". Dikkat et, "was take" eksiktir çünkü devam takısı yoktur. Mesela "I was cooking dinner when you texted" cümlesi de birebir aynı kalıptır.',

  // ==================== 5. present_perfect (5) ====================
  present_perfect__duel_1:
    'Hayat boyunca bugüne kadar yaşanan ya da hiç yaşanmayan deneyimlerde "never" ile birlikte "have" ve fiilin üçüncü hâli kullanılır: "I have never played an instrument". "did" bitmiş belirli bir geçmiş zaman içindir. Örneğin "I have never tried sushi" veya "We have never met before" gibi.',
  present_perfect__duel_2:
    '"since 2019" ifadesi 2019 yılında başlayıp bugün hâlâ devam eden bir durumu gösterir. Geçmişi bugüne bağlayan bu köprüde "she" öznesiyle "has" ve üçüncü hâl kullanılır: "She has lived in this city since 2019". Mesela "He has worked here since Monday" ya da "She has known him for years" gibi.',
  present_perfect__spot_1:
    '"have" yardımcı fiilinden sonra fiilin ikinci hâli olan "went" asla gelmez, üçüncü hâl gerekir. Bir yere gidip geri döndüğünü anlatırken "been" kullanılır: "We have been to that cafe three times". Örneğin "I have been to London twice" veya "Have you ever been there?" gibi.',
  present_perfect__spot_2:
    'Cümlenin sonunda "yesterday" yani dün gibi kesin bitmiş bir zaman var. Kesin geçmiş zaman kelimeleriyle "has finished" kullanılmaz, doğrudan sade geçmiş zaman seçilir: "He finished his project yesterday". Tıpkı "I watched that film last night" ya da "We met two days ago" örneklerindeki gibi.',
  present_perfect__scen_1:
    'Bir işi şu ana kadar yapıp yapmadığını sorarken "yet" kelimesi her zaman "Have you" ve fiilin üçüncü hâliyle eşleşir: "Have you played the new demo yet?". Örneğin "Have you finished the book yet?" veya "Have you eaten lunch yet?" sorularını da aynı şekilde kurarsın.',

  // ==================== 6. passive_voice (5) ====================
  passive_voice__duel_1:
    'Burada ekibimiz başkasını davet etmedi, turnuvaya davet edildi. Yani özne işi yapan değil, o işten etkilenen taraftır. Edilgen anlam için tekil "squad" öznesiyle "was invited" kullanılır: "Our whole squad was invited to the weekend tournament". Mesela "My sister was chosen" veya "The letter was sent" gibi.',
  passive_voice__duel_2:
    'Kulaklıklar kendi kendini üretemez, Almanya içinde üretilir. Özne "These headphones" çoğul olduğu ve genel bir gerçek anlatıldığı için edilgen yapı "are made" olur: "These headphones are made in Germany". Benzer şekilde "These cars are built in Japan" veya "Bananas are grown in warm climates" denir.',
  passive_voice__spot_1:
    'Edilgen çatıda "was" kelimesinin ardından fiil yalın kalamaz, mutlaka üçüncü hâline geçmelidir. Bu yüzden "was update" yanlıştır; doğrusu "The server was updated at three in the morning" olur. Tıpkı "The window was broken" veya "The bug was fixed" cümlelerindeki gibi.',
  passive_voice__spot_2:
    'Cümlenin öznesi "Three new maps", yani üç yeni harita, çoğuldur. Bu yüzden edilgen yapıda "was added" değil "were added" kullanılmalıdır: "Three new maps were added today". Örneğin "Two new songs were released" ya da "All the emails were deleted" gibi.',
  passive_voice__scen_1:
    'Eğer "I invited" dersen partiye ben davet ettim demiş olursun. Seni davet ettiklerini, yani davet edildiğini anlatmak için edilgen yapı şarttır: "I was invited to the party last night". Mesela "I was told the news" bana haber verildi, "I was asked a question" ise bana bir soru soruldu demektir.',

  // ==================== 7. going_to_vs_will (5) ====================
  going_to_vs_will__duel_1:
    'Arkadaşının şarj aletini unuttuğunu tam şu an öğrendin ve o anda yardım teklif ediyorsun. Konuşma anında verilen anlık kararlarda ve tekliflerde "will" kullanılır: "Do not worry, I will bring mine". Mesela telefon çaldığında "I will answer it" ya da "I will carry your bag" demen gibi.',
  going_to_vs_will__duel_2:
    'Gökyüzündeki kara bulutlar şu an gözünle gördüğün somut bir kanıttır. Elde net bir belirti veya kanıt varken yapılan yakın gelecek tahminlerinde "be going to" tercih edilir: "Look at the dark clouds, it is going to rain any minute". Tıpkı "Watch out, that glass is going to fall!" örneğindeki gibi.',
  going_to_vs_will__spot_1:
    '"going to" kalıbı hiçbir zaman tek başına kullanılmaz; önünde mutlaka özneye uygun "am", "is" ya da "are" bulunmalıdır. Özne "We" olduğu için doğrusu "We are going to stream the finals tonight" olur. Örneğin "I am going to call him" veya "She is going to study medicine" gibi.',
  going_to_vs_will__spot_2:
    '"will" yardımcı fiilinden sonra asla "to" kelimesi getirilmez; doğrudan yalın fiil gelir. Bu yüzden "I will to send" yanlıştır, doğrusu "I will send you the link now" şeklindedir. Aynı kural "I will check it" ve "They will arrive soon" cümlelerinde de geçerlidir.',
  going_to_vs_will__scen_1:
    'Biletleri önceden aldığın için bu artık kesinleşmiş bir plandır. Önceden kararlaştırılmış planları anlatırken "be going to" kullanılır: "We are going to see a rock concert this Saturday". Diğer seçeneklerde ya "to" fazladır ya da "are" eksiktir. Mesela "I am going to visit my parents next weekend" gibi.',

  // ==================== 8. conditionals_would (5) ====================
  conditionals_would__duel_1:
    'Cümlenin ikinci yarısında "would visit" olduğu için bunun hayalî bir varsayım olduğunu hemen anlarsın. Hayalî koşul cümlelerinde "if" tarafı geçmiş zaman biçimi alır ve "I" ile "were" kullanılır: "If I were fluent in Japanese, I would visit Tokyo next year". Tıpkı "If I were rich, I would travel the world" gibi.',
  conditionals_would__duel_2:
    'Bu cümle hayal değil, gerçek bir neden sonuç ilişkisidir: kısayola basarsan uygulama kaydeder. "if" tarafı geniş zamanda yani "press" olduğunda, sonuç tarafında "would" değil "will" kullanılır: "If you press this shortcut, the app will save automatically". Mesela "If it rains, I will take a taxi" gibi.',
  conditionals_would__spot_1:
    'Birine "senin yerinde olsam" diye tavsiye verirken sabit hayalî koşul kalıbı "If I were you" şeklindedir; "am" ile "would" bir arada uyuşmaz. Doğrusu "If I were you, I would take that job" olur. Örneğin "If I were you, I would talk to him" ya da "If I were you, I would wait" gibi.',
  conditionals_would__spot_2:
    'Koşul tarafında "If she had a car" yani arabası olsaydı diyerek hayal kuruyoruz. "if" tarafı geçmiş zamanlı hayal olduğuna göre sonuç tarafı da "will" değil "would" ile dengelenmelidir: "If she had a car, she would drive to work". Benzer şekilde "If we knew his number, we would call him" deriz.',
  conditionals_would__scen_1:
    '"if" kelimesinin içine asla "would" konulmaz ve "would not" sonrası fiil daima yalın kalır. Bu yüzden tek doğru kalıp "If I were you, I would not sell that old computer" şeklindedir. Mesela "If I were you, I would not quit now" veya "If I were you, I would save that file" gibi.',

  // ==================== 9. contrast_linkers (5) ====================
  contrast_linkers__duel_1:
    'Boşluktan hemen sonra özne ve çekimli fiil değil, "being tired" şeklinde bir isim fiil grubu geliyor. Tam cümleyle "Although", isim veya devam hâliyle ise "Despite" kullanılır. Bu yüzden doğru cevap "Despite being tired, he stayed up to finish the episode" olur. Mesela "Despite the cold weather, we walked" gibi.',
  contrast_linkers__duel_2:
    'Burada "herkes sesli sohbete katılmadıkça" anlamında olumsuz bir şart var. İngilizcede "eğer olmazsa" veya "-medikçe" anlamını tek kelimeyle "unless" verir: "We cannot start the raid unless everyone joins voice chat". Örneğin "You will miss the bus unless you hurry" veya "Do not call unless it is urgent" gibi.',
  contrast_linkers__spot_1:
    '"the high price" yani yüksek fiyat ifadesinde bir fiil yoktur, sadece bir isim tamlamasıdır. "Although" mutlaka özne ve fiil içeren tam bir cümle ister; isim grubunun başına ise "Despite" gelir: "Despite the high price, everyone bought it". Eğer "Although" demek isteseydin "Although the price was high" demen gerekirdi.',
  contrast_linkers__spot_2:
    'İşte en sık yapılan tuzak: "unless" kelimesi zaten kendi içinde olumsuzluk taşır. Yanına bir kez daha "do not" eklersen çift olumsuzluk olur ve anlam bozulur. Doğrusu "Do not close the tabs unless they freeze" şeklindedir. Mesela "I will go out unless it rains", yani yağmur yağmazsa dışarı çıkacağım gibi.',
  contrast_linkers__scen_1:
    '"traffic was terrible" ifadesi öznesi ve fiili olan tam bir cümledir. Tam cümlenin başına "Despite" değil "Although" konur ve unutma, "Despite of" diye bir kalıp İngilizcede yoktur. Doğru cümle "Although traffic was terrible, I made it on time" olur. Tıpkı "Although I was nervous, I spoke clearly" gibi.',

  // ==================== 10. time_clauses (5) ====================
  time_clauses__duel_1:
    'Eve varma işi gelecekte olsa bile, "as soon as" bir zaman bağlacıdır ve zaman bağlaçlarının hemen içine asla "will" konulmaz. Bağlaç içindeki fiil geniş zamanda kalır: "I will start downloading the game as soon as I get home". Mesela "Call me as soon as you land" veya "I will tell him when I see him" gibi.',
  time_clauses__duel_2:
    'Yedekleme bitene kadar tarayıcıyı kapatmaman gerekiyor. Bir eylemin belirli bir ana kadar sürmesini anlatırken "as soon as" değil "until" kullanılır: "Do not close the browser until the backup finishes". Tıpkı "Stay here until I return" ya da "Wait until the light turns green" örneklerindeki gibi.',
  time_clauses__spot_1:
    'Gelecekten söz etsek bile "when" bağlacından sonra "will be" kullanmak hatadır. Zaman bağlacının içinde geniş zaman kullanılır ve doğru cümle "Let me know when you are ready" olur. Benzer şekilde "Text me when you arrive" veya "We will eat when the pizza gets here" deriz.',
  time_clauses__spot_2:
    '"wait" yani beklemek fiili bir noktaya kadar devam eden bir eylemdir. Yağmur durana kadar beklediler demek için "as soon as" yerine "until" gerekir: "They waited until the rain stopped". Örneğin "We waited until midnight" veya "She worked until everyone left" gibi.',
  time_clauses__scen_1:
    '"biter bitmez" anlamını veren bağlaç "as soon as" kalıbıdır ve gelecekten bahsetse de içindeki fiil geniş zaman alır. "the meeting" tekil olduğu için fiil "ends" olur: "I will text you as soon as the meeting ends". Mesela "I will pay you back as soon as I get paid" örneği de aynı yapıdadır.',

  // ==================== 11. phrasal_verbs (6) ====================
  phrasal_verbs__duel_1:
    'Bu iki deyimsel fiilin anlamı taban tabana zıttır. "figure out" bir sorunu çözmek ve anlamak, "give up" ise pes etmek demektir. Kodun neden çalışmadığını sonunda çözdüm demek için doğrusu "I finally figured out why the code was not compiling" olur. Mesela "Can you figure out this puzzle?" veya "Never give up" gibi.',
  phrasal_verbs__duel_2:
    'İngilizcede bir etkinliği planlanandan erken bitirmek ve yarıda kesmek için sabit kalıp "cut something short" şeklindedir. Bu yüzden doğru cümle "We had to cut our trip short due to the storm" olur. Benzer şekilde "He cut the meeting short" yani toplantıyı kısa kesti, ya da "Rain cut the match short" deriz.',
  phrasal_verbs__duel_3:
    'Otobüs, tren ve metro gibi toplu taşıma araçlarından inerken "get off" kullanılır. "get over" ise bir üzüntüyü ya da hastalığı atlatmak demektir. Bu yüzden doğru seçim "Do not forget your umbrella when you get off the subway" olur. Örneğin "We get off at the next stop" veya "She got off the bus" gibi.',
  phrasal_verbs__spot_1:
    '"turn down" gibi bölünebilen deyimsel fiillerde "it", "them" veya "me" gibi kısa zamirler asla en sona atılmaz, mutlaka ortaya konur. Bu yüzden "turn down it" yanlıştır; doğrusu "please turn it down" olur. Tıpkı "turn it off", "pick it up" veya "figure it out" örneklerindeki gibi.',
  phrasal_verbs__spot_2:
    'Bir malzemenin ya da kaynağın tükenip bitmesi İngilizcede her zaman "run out of" kalıbıyla söylenir; "from" kullanılmaz. Doğrusu "We ran out of coffee beans this morning" olur. Aynı kalıbı "I ran out of time" yani vaktim bitti, veya "My phone ran out of battery" derken de kullanırsın.',
  phrasal_verbs__scen_1:
    'Üç seçenek birbirine çok benzer ama edat anlamı tamamen değiştirir. "put off" ertelemek, "put out" ateş söndürmek, "take off" ise uçağın kalkması veya kıyafet çıkarmaktır. Projeyi ertelemeyi bırakmak için doğru cümle "I need to stop putting off this project" olur. Mesela "Do not put off your homework" gibi.',

  // ==================== 12. prepositions_core (5) ====================
  prepositions_core__duel_1:
    'İçinde haftanın bir günü geçiyorsa, yanında sabah ya da gece yazsa bile edat her zaman "on" olur. "Friday night" içinde Cuma günü olduğu için "on Friday night" denir. Benzer şekilde "on Monday morning" veya "on Sunday evening" örneklerinde de hep "on" kullanılır.',
  prepositions_core__duel_2:
    'On iki yaşından beri derken toplam kaç yıl geçtiğini değil, başlangıç noktasını söylüyoruz. Başlangıç anını gösterirken "for" değil "since" kullanılır: "He has played guitar since he was twelve". Eğer toplam süre söyleseydik "for ten years" yani on yıldır derdik.',
  prepositions_core__spot_1:
    'Kesin saatlerden önce "in" kullanılmaz; tam saat noktaları her zaman "at" edatını alır. Bu yüzden doğru cümle "The train departs at seven thirty sharp" olur. Tıpkı "The class starts at nine" veya "Let us meet at noon" örneklerindeki gibi.',
  prepositions_core__spot_2:
    '"two hours" yani iki saat bir başlangıç noktası değil, sayılabilen toplam bir süredir. Toplam süre anlatırken "since" yerine her zaman "for" kullanılır: "I have waited for two hours". Mesela "for three days" veya "for five minutes" deriz; başlangıç içinse "since two o clock" kullanılır.',
  prepositions_core__scen_1:
    'Zaman piramidini adım adım uygula: haftanın günleri her zaman "on" alır, yani "on Tuesday". Kesin saatler ise her zaman "at" alır, yani "at ten in the morning". İkisi birleşince tek doğru cümle "The meeting is on Tuesday at ten" olur. Mesela "The flight is on Friday at six" gibi.',

  // ==================== 13. word_order_syntax (5) ====================
  word_order_syntax__duel_1:
    'İngilizcede düz cümle her zaman özne ile başlar, ardından yardımcı fiil ve ana fiil gelir: "The birds are building a nest". Yardımcı fiil olan "Are" başa gelirse cümle soru cümlesine dönüşür. Örneğin "The kids are playing" düz cümledir, "Are the kids playing?" ise sorudur.',
  word_order_syntax__duel_2:
    'İngilizcede iki olumsuzluk kelimesi aynı anda üst üste getirilmez; yani "Never do not" yanlıştır. Olumsuz bir uyarıda ya tek başına "Never" ya da "Do not" kullanılır ve "teach someone to do something" sırası korunur: "Never teach a fish to swim". Mesela "Never give up" veya "Never leave your door unlocked" gibi.',
  word_order_syntax__spot_1:
    'İngilizcede yardımcı fiil her zaman ana fiilden önce durur; yerleri değiştirilemez. Bu yüzden "building are" yanlıştır, doğrusu "The birds are building a nest outside" şeklindedir. Aynı şekilde "We are watching a movie" veya "She is writing an email" deriz.',
  word_order_syntax__spot_2:
    'İngilizcede fiil ile nesnenin arasına "very much" sokulmaz. "very much" ifadesi cümlenin en sonuna gider; eğer fiilden önce güçlü vurgu yapmak istiyorsan "really like" kullanırsın: "I really like playing this game". İstersen "I like coffee very much" şeklinde sonda da kullanabilirsin.',
  word_order_syntax__scen_1:
    'İngilizce cümle diziliminin altın sırasını hatırla: önce özne, sonra fiil, ardından nesne, sonra yer ve en sonda zaman. Bu sıraya tam uyan tek cümle "I listen to rock music at home every evening" şeklindedir. Mesela "She studies English at the library every day" cümlesi de aynı sırayı izler.',

  // ==================== 14. listening_gap (5) ====================
  listening_gap__duel_1:
    'Hızlı konuşmada "cannot eat" ifadesindeki sesler birbirine yapıştığı için aradaki ana fiil kolayca yutulmuş gibi duyulur. Oysa "cannot" yardımcı fiilinden sonra mutlaka yalın bir eylem fiili gelmelidir: "I cannot eat raw fish". Mesela "I cannot open this file" ya da "She cannot hear you" cümlelerinde de ana fiili mutlaka kontrol et.',
  listening_gap__duel_2:
    'Konuşmada "has been" çok hafif ve hızlı geçildiği için kulak sadece "missing" kelimesini yakalayabilir. Ancak "for three days" geçmişten bugüne süren bir zaman gösterir ve özne tekil olduğu için doğrusu "My dog has been missing for three days" olur. Tıpkı "It has been raining all morning" gibi.',
  listening_gap__spot_1:
    'Doğal konuşmada "wait to" söylenirken iki ses birleşip tek gibi duyulur; bu yüzden dinlerken "to" kolayca düşer. Fakat yazarken "wait" ile ikinci fiil arasına mutlaka "to" koymalısın: "I cannot wait to play with friends". Benzer şekilde "I want to go" ve "She needs to rest" cümlelerinde de "to" yazılır.',
  listening_gap__spot_2:
    'Hızlı İngilizcede "There are a lot of" ifadesi çok sıkışarak okunur ve aradaki "are" ile "a" kelimeleri neredeyse kaybolur. Ama tam ve doğru cümle mutlaka fiil içerir: "There are a lot of people waiting outside". Örneğin "There are a lot of cars on the road" cümlesinde de aynı yapı vardır.',
  listening_gap__scen_1:
    'Kısaltılmış "He is" ile "He has" konuşmada birebir aynı okunur; hangisi olduğunu arkasındaki kelimeden anlarsın. Burada hemen ardından fiilin üçüncü hâli olan "been" geldiği için bu kesinlikle "He has" kısaltmasıdır: "He has been working all day". Oysa "He is working" deseydi "He is" olurdu.',

  // ==================== 15. modal_possibility (5) ====================
  modal_possibility__duel_1:
    'Sunucunun yavaş olması yüzünden beklemek zorunda kalma ihtimalinden söz ediyoruz. "may" ihtimal, "have to" ise zorunluluk bildirir; ikisi birleştiğinde "zorunda kalabiliriz" anlamı doğar: "we may have to wait a few minutes". Mesela "We may have to leave early" veya "You may have to restart the app" gibi.',
  modal_possibility__duel_2:
    'Bir şeyin mantıken kesinlikle imkânsız olduğunu söylerken "must not be" kullanılmaz; her zaman "cannot be" kullanılır. Bu yüzden doğru cümle "No way, that rumor cannot be true!" olur. Örneğin "You just ate, you cannot be hungry" ya da "He cannot be at home, his car is gone" gibi.',
  modal_possibility__spot_1:
    '"might", "may", "could" ve "should" gibi kip yardımcı fiillerinden sonra gelen ana fiil hiçbir zaman ek almaz; özne "It" olsa bile yalın kalır. Bu yüzden "might rains" yanlıştır, doğrusu "It might rain later this evening" olmalıdır. Tıpkı "She might call tonight" veya "He could win" örneklerindeki gibi.',
  modal_possibility__spot_2:
    'Kip yardımcı fiillerinden sonra araya "to" konulmaz; "may" doğrudan yalın fiile bağlanır. Bu yüzden "She may to join" hatadır, doğrusu "She may join the call late" şeklindedir. Aynı kural "It may snow tomorrow" ve "We might stay longer" cümlelerinde de geçerlidir.',
  modal_possibility__scen_1:
    'Emin olmadığın bir tahminde bulunurken "might" ardından doğrudan yalın "be" ve durum sıfatı gelir; araya "to" girmez ve "might" ek almaz. Bu yüzden doğru cümle "He might be asleep right now" olur. Mesela "She might be busy" ya da "They might be stuck in traffic" gibi.',

  // ==================== 16. infinitive_gerund (5) ====================
  infinitive_gerund__duel_1:
    'İngilizcede "enjoy" yani keyif almak fiilinden sonra ikinci bir fiil geliyorsa asla "to" almaz, her zaman devam hâliyle kullanılır. Bu yüzden doğru cevap "I really enjoy going to live rock concerts" olur. Benzer şekilde "I enjoy cooking" veya "She enjoys reading mystery novels" deriz.',
  infinitive_gerund__duel_2:
    'Geleceğe yönelik karar ve niyet bildiren "decide" fiili her zaman "to" ve yalın fiil ile devam eder. Bu yüzden doğrusu "We decided to start the new campaign tonight" olur. Aynı gruptaki "want to learn" ve "plan to travel" kalıpları da hep "to" ile kurulur.',
  infinitive_gerund__spot_1:
    '"avoid" yani kaçınmak fiili, tıpkı "enjoy" ve "finish" gibi, kendisinden sonra "to" değil devam hâlindeki fiili ister. Bu yüzden "avoided to answer" yanlıştır; doğrusu "He avoided answering the question" olmalıdır. Örneğin "I avoid driving at rush hour" veya "Try to avoid making noise" gibi.',
  infinitive_gerund__spot_2:
    'İngilizcede en şaşmaz kurallardan biri şudur: "for", "about", "before", "after" gibi bir edattan hemen sonra gelen fiil her zaman devam takısı alır. Burada "for" edatı olduğu için doğrusu "Thanks for sending me the playlist!" olur. Mesela "Thanks for helping me" veya "Before leaving the house" gibi.',
  infinitive_gerund__scen_1:
    'Bir şeyi dört gözle beklemek anlamına gelen "cannot wait" kalıbı her zaman "to" ve yalın fiille tamamlanır. Bu yüzden doğru cümle "I cannot wait to play the new release!" şeklindedir. Örneğin "I cannot wait to see you" veya "We cannot wait to visit Italy" gibi.',

  // ==================== 17. negation_questions (5) ====================
  negation_questions__duel_1:
    'Cümlede "did not" yardımcı fiili zaten geçmiş zamanı üstlendiği için ana fiil bir daha geçmiş hâline çekilmez, en sade yalın hâlinde kalır. Bu yüzden "did not saved" değil "I did not save my password" demelisin. Mesela "I did not finish the report" ya da "We did not lock the door" gibi.',
  negation_questions__duel_2:
    'Geniş zamanlı sorularda özne tekil üçüncü şahıs olduğunda ek görevini baştaki "Does" taşır. Bu yüzden ana fiile bir daha ek konulmaz ve doğrusu "Does your friend like rock music too?" olur. Tıpkı "Does she live nearby?" veya "Does this shop open early?" sorularındaki gibi.',
  negation_questions__spot_1:
    '"Did" ile başlayan geçmiş zaman sorularında ana fiil her zaman birinci yalın hâline döner; ikinci hâl olan "saw" kullanılmaz. Doğru soru "Did you see the new trailer yet?" şeklindedir. Aynı kural "Did you go home?" ve "Did he buy the ticket?" cümlelerinde de geçerlidir.',
  negation_questions__spot_2:
    '"does not" olumsuz yardımcı fiili üçüncü tekil şahıs ekini zaten taşıdığı için ana fiildeki ek düşer. Yani "does not drinks" yanlıştır, doğrusu "She does not drink coffee after six" olur. Benzer şekilde "He does not eat meat" veya "It does not work offline" deriz.',
  negation_questions__scen_1:
    'Geçmişte bir eylemin yapılıp yapılmadığını sorarken formül basittir: başta "Did", sonra özne, sonra yalın fiil. Bu yüzden doğru soru "Did you watch the stream last night?" olur. "Did you watched" çift geçmiş zaman hatasıdır, "Were you watch" ise eylem fiiliyle uyumsuzdur. Mesela "Did you call your mom?" gibi.',

  // ==================== 18. trouble_vocab (4) ====================
  trouble_vocab__duel_1:
    'Bu iki kelime birbirine hiç benzemez ama sık karıştırılır. "depart" bir trenin, uçağın ya da yolcunun hareket edip ayrılması; "admit" ise bir hatayı veya gerçeği itiraf edip kabul etmektir. Tren perondan kalkıyor demek için doğru cümle "Our train departs from platform three" olur. Mesela "The flight departs at noon" gibi.',
  trouble_vocab__duel_2:
    '"announce" resmî bir haberi veya tarihi kamuoyuna duyurmak, "avoid" ise bir şeyden uzak durup kaçınmaktır. Çıkış tarihini yarın duyuracaklar demek için doğru fiil "announce" olur: "They will announce the official release date tomorrow". Örneğin "The company announced a new update" gibi.',
  trouble_vocab__spot_1:
    'Cümlede "my" yani benim kelimesinden sonra bir fiil değil, isim gelmesi gerekir. "assign" görevlendirmek anlamına gelen fiildir; onun isim hâli olan "assignment" ise ödev veya verilen görev demektir. Doğrusu "I need to submit my assignment by Friday" olur. Mesela "a difficult assignment" veya "finish the assignment" gibi.',
  trouble_vocab__scen_1:
    'İngilizcede bir projede plandan ve takvimden önde gitmek sabit bir deyimle anlatılır: "ahead of schedule". "behind schedule" ise geride kalmak demektir ve araya "of" konmaz. Bu yüzden ekibe müjde verirken "Good news, we are ahead of schedule!" dersin. Mesela "The bridge opened two weeks ahead of schedule" gibi.',
};
