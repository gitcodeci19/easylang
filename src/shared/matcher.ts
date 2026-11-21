import type { AnswerEvaluation, CardType } from './types';

const TR_DIACRITIC_MAP: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  İ: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
};

const TR_STOP_WORDS = new Set([
  'bir',
  've',
  'ile',
  'de',
  'da',
  'ki',
  'mi',
  'mı',
  'mu',
  'mü',
  'bu',
  'şu',
  'su',
  'o',
  'ben',
  'sen',
  'biz',
  'siz',
  'onlar',
  'benim',
  'senin',
  'onun',
  'bizim',
  'sizin',
  'onların',
  'onlarin',
  'kendisi',
  'kendi',
  'olarak',
  'doğru',
  'dogru',
  'ise',
  'için',
  'icin',
  'kadar',
  'gibi',
  'daha',
  'çok',
  'cok',
  'biraz',
]);

/**
 * Multi-word Turkish phrase normalizations applied on folded ASCII strings
 * so natural paraphrases (e.g. "hayatını kaybetti" vs "öldü" vs "vefat etti",
 * "2009 yılında" vs "2009'da", "kız çocuğu" vs "kız evlat") converge cleanly.
 */
const TR_PHRASE_CANONICAL_RULES: Array<[RegExp, string]> = [
  [/\bwi\s+fi\b/g, 'wifi'],
  [/\bhayatini\s+kaybet(ti|mistir|mis|tiler)\b/g, 'oldu'],
  [/\bvefat\s+et(ti|mistir|mis|tiler)\b/g, 'oldu'],
  [/\byasama\s+veda\s+et(ti|mistir)\b/g, 'oldu'],
  [/\b(\d{4})\s+yilinda\b/g, '$1'],
  [/\bkiz\s+cocu(gu|k|gum|gun)\b/g, 'kizcocuk'],
  [/\bkiz\s+evla(di|t|dim)\b/g, 'kizcocuk'],
  [/\berkek\s+cocu(gu|k|gum|gun)\b/g, 'erkekcocuk'],
  [/\berkek\s+evla(di|t|dim)\b/g, 'erkekcocuk'],
  [/\byatak\s+oda(si|sinda|sina|sindan|yi|m|mda|ma)?\b/g, 'yatakodasi'],
  [/\boturma\s+oda(si|sinda|sina|sindan|yi|m|mda|ma)?\b/g, 'salon'],
  [/\balisveris\s+merkezi(nde|ne|nden|ni|nin)?\b/g, 'avm'],
  [/\byazilim\s+hata(si|lari)\b/g, 'bug'],
  [/\bcep\s+telefon(u|um|un|una|unda|undan)?\b/g, 'telefon'],
  [/\belektronik\s+posta(yi|ya|da|dan)?\b/g, 'eposta'],
  [/\be\s+posta(yi|ya|da|dan)?\b/g, 'eposta'],
  [/\bev\s+odev(i|im|ini|in|leri)?\b/g, 'odev'],
  [/\bsatin\s+al(mak|di|dim|din|dik|dilar|iyor|iyorum|acak|acagim|mis)\b/g, 'al$1'],
  [/\bmonte\s+et(mek|ti|tim|tin|tik|tiler|mistir|mis|iyor|iyorum|ecek|ecegim)?\b/g, 'kur$1'],
  [/\bbir\s+araya\s+getir(mek|di|dim|din|dik|ebildi|iyor|ecek)?\b/g, 'birlestir$1'],
  [/\byardim\s+et(mek|ti|tim|tin|tik|iyor|iyorum|ecek)\b/g, 'yardim'],
  [/\byardimci\s+ol(mak|du|dum|dun|duk|uyor|uyorum|acak)\b/g, 'yardim'],
  [/\bdevam\s+et(mek|ti|tim|tik|iyor|ecek)\b/g, 'surdur'],
  [/\bher\s+zaman\b/g, 'daima'],
  [/\bsu\s+an(da)?\b/g, 'simdi'],
  [/\bpek\s+cok\b/g, 'bircok'],
  [/\bara\s+sira\b/g, 'bazen'],
  [/\bgeri\s+don(mek|du|dum|dun|duk|uyor|ecek)?\b/g, 'don$1'],
  [/\bfark\s+et(mek|ti|tim|tin|tik|mistir|mis|iyor|ecek)?\b/g, 'anla$1'],
  [/\bkarar\s+ver(mek|di|dim|din|dik|mistir|mis|iyor|ecek)?\b/g, 'kararlas$1'],
];

/**
 * Semantic Turkish synonym groups (in folded ASCII root/stem form).
 * Words sharing a group match each other in both word and sentence evaluation.
 */
const TR_SYNONYM_GROUPS: string[][] = [
  ['sifre', 'parola'],
  ['hesap', 'uyelik', 'profil'],
  ['oldu', 'olmustur', 'olmek', 'vefat'],
  ['kizcocuk', 'kizi', 'kizim'],
  ['erkekcocuk', 'ogul', 'oglu', 'oglum'],
  ['koca', 'es', 'esi'],
  ['kari', 'es', 'esi'],
  ['anne', 'ana', 'valide'],
  ['baba', 'peder'],
  ['kardes', 'abi', 'agabey', 'abla', 'baci'],
  ['ebeveyn', 'annebaba'],
  ['arkadas', 'dost', 'ahbap'],
  ['ev', 'konut', 'yuva', 'daire'],
  ['araba', 'otomobil', 'arac', 'vasita'],
  ['ucak', 'tayyare'],
  ['guzel', 'hos', 'sik', 'zarif'],
  ['harika', 'muhtesem', 'super', 'muthis', 'sahane', 'kusursuz', 'mukemmel', 'fevkalade', 'enfes'],
  ['iyi', 'ala', 'hos'],
  ['kotu', 'fena', 'berbat', 'rezalet'],
  ['buyuk', 'iri', 'kocaman', 'devasa', 'genis'],
  ['kucuk', 'ufak', 'minik'],
  ['hizli', 'cabuk', 'suratli', 'seri'],
  ['yavas', 'agir', 'sakin'],
  ['kolay', 'basit', 'rahat'],
  ['zor', 'guc', 'cetin', 'zahmetli'],
  ['onemli', 'muhim', 'kritik', 'degerli', 'kaydadeger', 'manidar'],
  ['farkli', 'baska', 'degisik', 'ayri'],
  ['ayni', 'benzer', 'esit', 'farksiz'],
  ['mutlu', 'sevincli', 'mesut', 'neseli', 'memnun'],
  ['uzgun', 'mutsuz', 'kederli', 'huzunlu'],
  ['kizgin', 'ofkeli', 'sinirli', 'asabi'],
  ['korkmus', 'urkek', 'endiseli', 'kaygili', 'gergin', 'stresli', 'tedirgin'],
  ['cesur', 'yurekli', 'korkusuz', 'ozguvenli', 'emin'],
  ['yorgun', 'bitkin', 'halsiz'],
  ['hasta', 'rahatsiz', 'keyifsiz'],
  ['doktor', 'hekim', 'tabip'],
  ['hastane', 'klinik'],
  ['ameliyat', 'operasyon', 'cerrahi'],
  ['ilac', 'hap', 'tedavi'],
  ['iyilesmek', 'duzelmek', 'toparlanmak'],
  ['aci', 'agri', 'sizi', 'acimak', 'agrimak', 'incitmek'],
  ['kalp', 'yurek', 'gonul'],
  ['ogrenci', 'talebe'],
  ['ogretmen', 'hoca', 'egitmen', 'muallim'],
  ['okul', 'mektep', 'kolej'],
  ['universite', 'fakulte', 'kampus'],
  ['ders', 'kurs', 'egitim', 'konferans'],
  ['sinav', 'test', 'imtihan'],
  ['odev', 'gorev', 'atama'],
  ['not', 'puan', 'derece', 'sinif'],
  ['beceri', 'yetenek', 'kabiliyet', 'huner', 'maharet', 'marifet'],
  ['soru', 'sual'],
  ['cevap', 'yanit', 'karsilik'],
  ['sorun', 'problem', 'mesele', 'sikinti', 'ariza', 'hata', 'bug'],
  ['sebep', 'neden', 'gerekce', 'etken', 'faktor', 'unsur'],
  ['sonuc', 'netice', 'etki'],
  ['amac', 'hedef', 'gaye', 'niyet'],
  ['ornek', 'misal', 'numune'],
  ['hikaye', 'oyku', 'masal'],
  ['film', 'sinema', 'yapim'],
  ['dizi', 'seri'],
  ['fragman', 'tanitim'],
  ['yonetmen', 'mudur', 'rejisor'],
  ['izleyici', 'seyirci', 'dinleyici', 'kitle'],
  ['sarki', 'parca', 'ezgi'],
  ['fiyat', 'ucret', 'bedel', 'tutar', 'maliyet', 'eder'],
  ['indirim', 'iskonto', 'kampanya', 'tenzilat'],
  ['fis', 'makbuz', 'fatura'],
  ['magaza', 'dukkan', 'market', 'avm'],
  ['musteri', 'alici', 'danisan', 'muvekkil'],
  ['hediye', 'armagan'],
  ['guvenlik', 'emniyet', 'koruma'],
  ['guvenli', 'emniyetli', 'guvende', 'salim'],
  ['uyari', 'ikaz', 'ihtar'],
  ['kask', 'migfer', 'baslik'],
  ['tehlike', 'risk', 'tehdit'],
  ['duygu', 'his', 'heyecan'],
  ['saygi', 'hurmet', 'itibar'],
  ['affetmek', 'bagislamak', 'hosgormek'],
  ['doga', 'tabiat', 'cevre'],
  ['ekonomi', 'iktisat', 'tasarruf'],
  ['yatirim', 'sermaye'],
  ['sirket', 'firma', 'kurum', 'ortaklik'],
  ['yonetici', 'mudur', 'patron', 'lider'],
  ['veri', 'bilgi', 'data', 'malumat'],
  ['donanim', 'hirdavat', 'ekipman', 'cihaz'],
  ['yazilim', 'program', 'uygulama'],
  ['ag', 'sebeke', 'baglanti'],
  ['sistem', 'duzen', 'usul', 'yapi'],
  ['yukseltmek', 'guncellemek', 'gelistirmek'],
  ['derlemek', 'toplamak'],
  ['arastirma', 'arastirmak', 'inceleme', 'analiz'],
  ['kanit', 'delil', 'ispat', 'taniklik'],
  ['yasal', 'hukuki', 'kanuni', 'mesru'],
  ['dava', 'yargilama', 'mahkeme', 'durusma', 'deneme'],
  ['ahlak', 'ahlaki', 'etik', 'erdem'],
  ['ozgurluk', 'hurriyet', 'bagimsizlik'],
  ['yardim', 'destek', 'katki'],
  ['konusmak', 'soylemek', 'anlatmak', 'demek'],
  ['tanistirmak', 'tanitmak', 'takdim'],
  ['kazanmak', 'yenmek', 'galip'],
  ['kaybetmek', 'yenilmek', 'yitirmek'],
  ['sik', 'genellikle', 'cogunlukla'],
  ['aliskanlik', 'rutin', 'duzen', 'adet', 'aliski'],
  ['emekli', 'cekilmek'],
  ['tavuk', 'pilic'],
  ['bebek', 'yavru'],
  ['egzersiz', 'antrenman', 'idman', 'alistirma'],
  ['lig', 'sampiyona', 'turnuva'],
  ['sahne', 'podyum'],
  ['korku', 'dehset', 'gerilim'],
  ['rezervasyon', 'ayirtma'],
  ['rehber', 'kilavuz'],
  ['istasyon', 'durak', 'terminal', 'gar'],
  ['varis', 'hedef', 'istikamet', 'rota'],
  ['sicaklik', 'hararet', 'derece'],
  ['tahmin', 'ongoru'],
  ['ama', 'fakat', 'ancak', 'lakin'],
  ['cunku', 'zira'],
  ['tekrar', 'yine', 'yeniden'],
  ['sonunda', 'nihayet'],
  ['butun', 'tum', 'tamami'],
  ['daima', 'hep', 'surekli'],
  ['simdi', 'hemen', 'derhal'],
  ['zayif', 'dusuk', 'gucsuz'],
  ['kur', 'kurmak', 'birlestir', 'birlestirmek'],
  ['bircok', 'cogu', 'fazla'],
  ['vakit', 'zaman', 'sure'],
  ['tuken', 'tukenmek', 'bit', 'bitmek'],
  ['basla', 'baslamak', 'giris', 'girismek'],
  ['bitir', 'bitirmek', 'tamamla', 'tamamlamak'],
  ['anla', 'anlamak', 'kavra', 'kavramak', 'coz', 'cozmek'],
  ['dusun', 'dusunmek', 'san', 'sanmak', 'zannet', 'zannetmek'],
  ['iste', 'istemek', 'arzula', 'arzulamak', 'dile', 'dilemek'],
  ['bak', 'bakmak', 'incele', 'incelemek'],
  ['bul', 'bulmak', 'kesfet', 'kesfetmek'],
  ['ver', 'vermek', 'sun', 'sunmak', 'sagla', 'saglamak'],
  ['bazen', 'zamanla'],
  ['kitaplik', 'raf'],
  ['wifi', 'internet', 'kablosuz'],
];

const TR_SYNONYM_MAP = new Map<string, Set<number>>();
TR_SYNONYM_GROUPS.forEach((group, groupIdx) => {
  for (const word of group) {
    const existing = TR_SYNONYM_MAP.get(word);
    if (existing) {
      existing.add(groupIdx);
    } else {
      TR_SYNONYM_MAP.set(word, new Set([groupIdx]));
    }
  }
});

const TR_NUMBER_WORD_RULES: Array<[RegExp, string]> = [
  [/\bon\s+bir\b/g, '11'],
  [/\bon\s+iki\b/g, '12'],
  [/\bon\s+üç\b/g, '13'],
  [/\bon\s+dört\b/g, '14'],
  [/\bon\s+beş\b/g, '15'],
  [/\bon\s+altı\b/g, '16'],
  [/\bon\s+yedi\b/g, '17'],
  [/\bon\s+sekiz\b/g, '18'],
  [/\bon\s+dokuz\b/g, '19'],
  [/\bsıfır\b/g, '0'],
  [/\biki\b/g, '2'],
  [/\büç\b/g, '3'],
  [/\bdört\b/g, '4'],
  [/\bbeş\b/g, '5'],
  [/\baltı\s+(saat|dakika|gün|hafta|ay|yıl|sene|kişi|tane|adet|lira|dolar|euro|fincan|bardak|kilometre|metre)\b/g, '6 $1'],
  [/\byedi\b/g, '7'],
  [/\bsekiz\b/g, '8'],
  [/\bdokuz\b/g, '9'],
  [/\bon\b/g, '10'],
  [/\byirmi\b/g, '20'],
  [/\botuz\b/g, '30'],
  [/\bkırk\b/g, '40'],
  [/\belli\b/g, '50'],
  [/\baltmış\b/g, '60'],
  [/\byetmiş\b/g, '70'],
  [/\bseksen\b/g, '80'],
  [/\bdoksan\b/g, '90'],
];

/**
 * Normalize Turkish text for comparison: lowercase using tr-TR locale,
 * preserve Turkish apostrophe-inflected proper nouns as single tokens,
 * remove parenthetical notes and punctuation, and collapse whitespace.
 */
export function normalizeTurkish(input: string): string {
  return input
    .toLocaleLowerCase('tr-TR')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b0([1-9])([:.]\d{2})\b/g, '$1$2')
    .replace(
      /(\d+)['’](?:da|de|ta|te|dan|den|tan|ten|a|e|i|ı|u|ü|ya|ye|yi|yı|yu|yü|nin|nın|nun|nün|in|ın|un|ün)\b/g,
      '$1'
    )
    .replace(/([a-zçğıöşü])['’]([a-zçğıöşü]{1,5})\b/g, '$1$2')
    .replace(/['"`’“”.,!?;:()\[\]{}\-_/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fold Turkish diacritics to ASCII equivalents (after normalizing unambiguous Turkish number words). */
export function foldTurkishDiacritics(input: string): string {
  let s = normalizeTurkish(input);
  for (const [re, rep] of TR_NUMBER_WORD_RULES) {
    s = s.replace(re, rep);
  }
  return s.replace(/[çğıİöşüâîû]/g, (ch) => TR_DIACRITIC_MAP[ch] ?? ch);
}

function canonicalizeTurkishPhrases(foldedInput: string): string {
  let s = foldedInput;
  for (const [re, rep] of TR_PHRASE_CANONICAL_RULES) {
    s = s.replace(re, rep);
  }
  return s.replace(/\s+/g, ' ').trim();
}

const TR_SUFFIX_RE =
  /(?:mistir|mustur|mektedir|maktadir|iyordum|uyorum|iyorum|iyorsun|uyorsun|iyoruz|uyoruz|iyorlar|uyorlar|acagim|ecegim|acaksin|eceksin|acagiz|ecegiz|acaklar|ecekler|larimiz|lerimiz|larindan|lerinden|sinda|sinde|sindan|sinden|siniz|sunuz|dilar|diler|dular|tilar|tiler|tular|mistim|mustum|misti|mustu|acak|ecek|iyor|uyor|yorum|yorsun|yoruz|yorlar|larin|lerin|imiz|umuz|iniz|unuz|sina|sine|sini|sunu|lari|leri|ndan|nden|inin|unun|imin|umun|ina|ine|una|une|dan|den|tan|ten|dir|dur|tir|tur|mak|mek|dim|dum|tim|tum|din|dun|tin|tun|dik|duk|tik|tuk|sin|sun|lar|ler|lik|luk|mis|mus|yor|di|du|ti|tu|im|um|in|un|yi|yu|ya|ye|da|de|ta|te|si|su|i|u|a|e)$/;

/**
 * Generate root/stem candidates for a folded Turkish token, including
 * reversal of Turkish final-consonant softening (b->p, d->t, g->k, c->c).
 */
function getTurkishStemCandidates(token: string): string[] {
  const candidates = new Set<string>([token]);

  const addWithSofteningReversal = (stem: string) => {
    if (stem.length < 2) return;
    candidates.add(stem);
    const last = stem[stem.length - 1];
    const base = stem.slice(0, -1);
    if (last === 'b') candidates.add(`${base}p`);
    else if (last === 'd') candidates.add(`${base}t`);
    else if (last === 'g') candidates.add(`${base}k`);
  };

  addWithSofteningReversal(token);

  let current = token;
  for (let pass = 0; pass < 2; pass += 1) {
    if (current.length <= 3) break;
    const stripped = current.replace(TR_SUFFIX_RE, '');
    if (!stripped || stripped === current || stripped.length < 2) break;
    addWithSofteningReversal(stripped);
    current = stripped;
  }

  return Array.from(candidates);
}

/** Check if two folded Turkish tokens share a synonym group via any of their stem candidates. */
function areTurkishTokensSynonymous(tokA: string, tokB: string): boolean {
  const stemsA = getTurkishStemCandidates(tokA);
  const stemsB = getTurkishStemCandidates(tokB);

  const groupsA = new Set<number>();
  for (const s of stemsA) {
    const g = TR_SYNONYM_MAP.get(s);
    if (g) g.forEach((id) => groupsA.add(id));
  }
  if (groupsA.size === 0) return false;

  for (const s of stemsB) {
    const g = TR_SYNONYM_MAP.get(s);
    if (g) {
      for (const id of g) {
        if (groupsA.has(id)) return true;
      }
    }
  }
  return false;
}

/** Standard Levenshtein edit distance between two short strings. */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    const chA = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j += 1) {
      const cost = chA === b.charCodeAt(j - 1) ? 0 : 1;
      const del = (prev[j] ?? 0) + 1;
      const ins = (curr[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j] ?? 0;
    }
  }

  return prev[b.length] ?? 0;
}

/** Return true if two equal-length words differ only by a single adjacent letter swap (e.g. "spcae" vs "space"). */
function isAdjacentTransposition(a: string, b: string): boolean {
  if (a.length !== b.length || a.length < 4) return false;
  let foundSwap = false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === b[i]) continue;
    if (foundSwap) return false;
    if (i + 1 < a.length && a[i] === b[i + 1] && a[i + 1] === b[i]) {
      foundSwap = true;
      i += 1;
    } else {
      return false;
    }
  }
  return foundSwap;
}

const TR_FUTURE_NOUN_EXCLUSIONS = new Set([
  'bacak', 'kucak', 'ocak', 'sicak', 'ucak', 'sancak', 'oyuncak', 'salincak',
]);

function isTurkishFutureVerbToken(tok: string): boolean {
  if (tok.length < 5 || TR_FUTURE_NOUN_EXCLUSIONS.has(tok)) return false;
  return /(?:acag|eceg|acak|ecek)(?:im|in|iz|sin|siniz|lar|ler|ti|tim|tin|tik)?$/.test(tok);
}

function isTurkishPastVerbToken(tok: string): boolean {
  if (tok.length < 4) return false;
  return /(?:mistir|mustur|misti|mustu|mistim|mustum|dilar|diler|dular|tilar|tiler|tular|dim|dum|tim|tum|din|dun|tin|tun|dik|duk|tik|tuk|di|du|ti|tu)$/.test(
    tok
  );
}

function tokensMatchTurkish(userTok: string, targetTok: string): boolean {
  if (userTok === targetTok) return true;

  // Block matching the same verb across opposite tenses (e.g. "katılacağım" vs "katıldım")
  const userFut = isTurkishFutureVerbToken(userTok);
  const targetFut = isTurkishFutureVerbToken(targetTok);
  const userPast = !userFut && isTurkishPastVerbToken(userTok);
  const targetPast = !targetFut && isTurkishPastVerbToken(targetTok);
  if ((userFut && targetPast) || (targetFut && userPast)) {
    return false;
  }

  if (areTurkishTokensSynonymous(userTok, targetTok)) return true;

  const stemsU = getTurkishStemCandidates(userTok);
  const stemsT = getTurkishStemCandidates(targetTok);
  for (const su of stemsU) {
    for (const st of stemsT) {
      if (su === st && su.length >= 3) return true;
    }
  }

  const minLen = Math.min(userTok.length, targetTok.length);
  if (minLen >= 5 && (levenshteinDistance(userTok, targetTok) <= 1 || isAdjacentTransposition(userTok, targetTok))) {
    return true;
  }
  return false;
}

const TR_EXPLICIT_NEG_WORDS = new Set([
  'degil',
  'degilim',
  'degilsin',
  'degildir',
  'degiliz',
  'degilsiniz',
  'degiller',
  'yok',
  'yoktur',
  'asla',
  'hicbir',
  'hicbiri',
  'hicbirini',
  'hicbirimiz',
]);

const TR_NEG_MAZ_NOUN_EXCLUSIONS = new Set([
  'namaz', 'bogaz', 'kiraz', 'ayaz', 'maraz', 'pekmez', 'comez', 'biraz',
]);

const TR_NEG_MAD_NOUN_EXCLUSIONS = new Set([
  'damadi', 'damadim', 'damadin', 'damadimiz',
]);

/**
 * Detect Turkish sentence negation reliably from BOTH standalone negation words
 * and unambiguous negative verb inflections (without false-triggering on nouns
 * or verbal nouns like "alışmam", "elma", "sinema", "tamam", "devam").
 */
function hasTurkishNegation(tokens: readonly string[]): boolean {
  for (const tok of tokens) {
    if (TR_EXPLICIT_NEG_WORDS.has(tok)) return true;
    if (tok.length < 5) continue;
    // Progressive negative: gelmiyor, gitmiyorum, bilmiyordu, cekmiyor, sevmiyor
    if (/(?:miy|muy|may|mey)(?:or|ordu|ordun|orduk|ordunuz|ordular|orum|orsun|oruz|orsunuz|orlar|ormus)$/.test(tok)) {
      return true;
    }
    // Past negative: gitmedim, yapmadi, almadik, gelmediler
    if (!TR_NEG_MAD_NOUN_EXCLUSIONS.has(tok) && /(?:mad|med)(?:i|im|in|ik|iniz|ilar|iler)$/.test(tok)) {
      return true;
    }
    // Evidential past negative: gitmemis, yapmamistir
    if (/(?:mamis|memis)(?:tir|tur|im|in|iz|sin|siniz|lar|ler|ti|tim|tin|tik)?$/.test(tok)) {
      return true;
    }
    // Future negative: gitmeyecegim, yapmayacak, katilmayacagim
    if (/(?:mayacag|meyeceg|mayacak|meyecek)(?:im|in|iz|sin|siniz|lar|ler|ti|tim|tin|tik)?$/.test(tok)) {
      return true;
    }
    // Aorist negative: yapmaz, gelmez, ucamaz, sevmezdi
    if (
      !TR_NEG_MAZ_NOUN_EXCLUSIONS.has(tok) &&
      /(?:maz|mez)(?:im|in|sin|siniz|lar|ler|di|dim|din|dik|lerdi|mis)?$/.test(tok)
    ) {
      return true;
    }
    // Necessitative negative: kalmamaliydin, gitmemelisin, yapmamali
    if (/(?:mamali|memeli)(?:yim|sin|yiz|siniz|lar|ler|ydi|ydim|ydin|ydik)?$/.test(tok)) {
      return true;
    }
    // Plural negative imperative: unutmayin, yapmayiniz
    if (/(?:mayin|meyin|mayiniz|meyiniz)$/.test(tok)) {
      return true;
    }
  }
  return false;
}

const TR_EXPLICIT_PAST_ADVERBS = new Set(['dun', 'eskiden']);
const TR_EXPLICIT_FUTURE_ADVERBS = new Set(['yarin', 'haftaya', 'seneye']);

function hasPastVsFutureTimeConflict(
  userTokens: readonly string[],
  targetTokens: readonly string[]
): boolean {
  const userPast = userTokens.some((t) => TR_EXPLICIT_PAST_ADVERBS.has(t));
  const userFuture = userTokens.some((t) => TR_EXPLICIT_FUTURE_ADVERBS.has(t));
  const targetPast = targetTokens.some((t) => TR_EXPLICIT_PAST_ADVERBS.has(t));
  const targetFuture = targetTokens.some((t) => TR_EXPLICIT_FUTURE_ADVERBS.has(t));
  return (
    (userPast && !userFuture && targetFuture && !targetPast) ||
    (userFuture && !userPast && targetPast && !targetFuture)
  );
}

/**
 * Compute 1-to-1 greedy content-token F1 overlap between Turkish sentences,
 * guarded by negation polarity and explicit past/future time-adverb checks.
 */
function stemOverlapScore(
  userTokens: string[],
  targetTokens: string[]
): { score: number; contentLen: number } {
  if (hasTurkishNegation(userTokens) !== hasTurkishNegation(targetTokens)) {
    return { score: 0, contentLen: Math.max(userTokens.length, targetTokens.length) };
  }
  if (hasPastVsFutureTimeConflict(userTokens, targetTokens)) {
    return { score: 0, contentLen: Math.max(userTokens.length, targetTokens.length) };
  }

  const filteredUser = userTokens.filter((t) => !TR_STOP_WORDS.has(t));
  const filteredTarget = targetTokens.filter((t) => !TR_STOP_WORDS.has(t));
  const u = filteredUser.length > 0 ? filteredUser : userTokens;
  const t = filteredTarget.length > 0 ? filteredTarget : targetTokens;

  if (u.length === 0 || t.length === 0) return { score: 0, contentLen: 0 };

  // Pass 1: exact matches 1-to-1; Pass 2: synonym/stem/typo matches 1-to-1 (prevents repeated-word gaming)
  const usedU = new Set<number>();
  const usedT = new Set<number>();
  let matchedPairs = 0;

  for (let ti = 0; ti < t.length; ti += 1) {
    for (let ui = 0; ui < u.length; ui += 1) {
      if (usedU.has(ui)) continue;
      if (u[ui] === t[ti]) {
        usedU.add(ui);
        usedT.add(ti);
        matchedPairs += 1;
        break;
      }
    }
  }

  for (let ti = 0; ti < t.length; ti += 1) {
    if (usedT.has(ti)) continue;
    for (let ui = 0; ui < u.length; ui += 1) {
      if (usedU.has(ui)) continue;
      if (tokensMatchTurkish(u[ui]!, t[ti]!)) {
        usedU.add(ui);
        usedT.add(ti);
        matchedPairs += 1;
        break;
      }
    }
  }

  const recall = matchedPairs / t.length;
  const precision = matchedPairs / u.length;
  if (recall + precision === 0) return { score: 0, contentLen: Math.max(u.length, t.length) };
  return {
    score: (2 * recall * precision) / (recall + precision),
    contentLen: Math.max(u.length, t.length),
  };
}

function extractRequiredEntitiesFromCandidate(
  rawCandidate: string,
  canonCandTokens: readonly string[]
): string[] {
  const required = new Set<string>();
  // 1. All numeric values (including normalized Turkish number words like iki -> 2, kirk -> 40)
  for (const tok of canonCandTokens) {
    if (/^\d+$/.test(tok)) {
      required.add(tok);
    }
  }
  // 2. Interior capitalized proper nouns in the reference sentence (e.g. "İstanbul'a", "IKEA", "Jackson")
  const rawWords = rawCandidate.trim().split(/\s+/).filter(Boolean);
  for (let i = 1; i < rawWords.length; i += 1) {
    const prev = rawWords[i - 1] ?? '';
    if (/[.!?]$/.test(prev)) continue; // Start of a new sentence, not an interior proper noun
    const w = rawWords[i]!.replace(/^["'(«]+|["')».,!?;:]+$/g, '');
    if (!w || w.length < 3) continue;
    // Detect uppercase Turkish initial (A-Z, ÇĞİÖŞÜ)
    if (/^[A-ZÇĞİÖŞÜ]/.test(w)) {
      const folded = canonicalizeTurkishPhrases(foldTurkishDiacritics(w));
      for (const tok of folded.split(' ').filter((x) => x.length >= 3)) {
        required.add(tok);
      }
    }
  }
  return Array.from(required);
}

function hasMissingRequiredNumberOrProperNoun(
  userTokens: readonly string[],
  rawCandidate: string,
  canonCandTokens: readonly string[]
): boolean {
  const required = extractRequiredEntitiesFromCandidate(rawCandidate, canonCandTokens);
  if (required.length === 0) return false;
  for (const req of required) {
    const found = userTokens.some((ut) => tokensMatchTurkish(ut, req));
    if (!found) return true;
  }
  return false;
}

function getSentenceOverlapThreshold(contentLen: number): number {
  if (contentLen <= 2) return 0.9;
  if (contentLen <= 4) return 0.78;
  return 0.74;
}

/**
 * Evaluate a user's Turkish translation against accepted answers.
 * Applies exact/normalized match, ASCII diacritic folding, typo tolerance,
 * canonical phrase equivalence, and synonym-aware token-stem overlap.
 */
export function evaluateTurkishAnswer(
  userInput: string,
  acceptedAnswers: string[],
  cardType: CardType
): AnswerEvaluation {
  const rawTrimmed = userInput.trim();
  const normUser = normalizeTurkish(rawTrimmed);

  if (!normUser) {
    return { isCorrect: false, matchKind: 'none', matchedTranslation: null, similarity: 0 };
  }

  // If the user typed multiple comma/slash-separated synonyms (e.g. "uzay, alan"), accept if any segment matches
  if (/[,;/]/.test(rawTrimmed)) {
    const segments = rawTrimmed
      .split(/[,;/]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    if (segments.length > 1) {
      for (const seg of segments) {
        const segEval = evaluateSingleTurkishSegment(seg, acceptedAnswers, cardType);
        if (segEval.isCorrect) return segEval;
      }
    }
  }

  return evaluateSingleTurkishSegment(rawTrimmed, acceptedAnswers, cardType);
}

function evaluateSingleTurkishSegment(
  rawTrimmed: string,
  acceptedAnswers: string[],
  cardType: CardType
): AnswerEvaluation {
  const normUser = normalizeTurkish(rawTrimmed);
  const foldedUser = foldTurkishDiacritics(rawTrimmed);
  const canonUser = canonicalizeTurkishPhrases(foldedUser);

  let bestScore = 0;
  let bestTarget: string | null = null;

  for (const candidate of acceptedAnswers) {
    const normCand = normalizeTurkish(candidate);
    if (!normCand) continue;

    if (rawTrimmed.toLocaleLowerCase('tr-TR') === candidate.trim().toLocaleLowerCase('tr-TR')) {
      return {
        isCorrect: true,
        matchKind: 'exact',
        matchedTranslation: candidate,
        similarity: 1,
      };
    }

    const foldedCand = foldTurkishDiacritics(candidate);
    const canonCand = canonicalizeTurkishPhrases(foldedCand);

    if (normUser === normCand || foldedUser === foldedCand || canonUser === canonCand) {
      return {
        isCorrect: true,
        matchKind: 'normalized',
        matchedTranslation: candidate,
        similarity: 1,
      };
    }

    // Direct word-level synonym equivalence (e.g. "parola" for "şifre", "kız evlat" for "kız çocuğu")
    if (cardType === 'word' && areTurkishTokensSynonymous(canonUser, canonCand)) {
      return {
        isCorrect: true,
        matchKind: 'normalized',
        matchedTranslation: candidate,
        similarity: 0.95,
      };
    }

    const userTokens = canonUser.split(' ').filter(Boolean);
    const candTokens = canonCand.split(' ').filter(Boolean);
    const hasPolarityConflict =
      hasTurkishNegation(userTokens) !== hasTurkishNegation(candTokens) ||
      hasPastVsFutureTimeConflict(userTokens, candTokens) ||
      (cardType === 'sentence' &&
        hasMissingRequiredNumberOrProperNoun(userTokens, candidate, candTokens));

    if (hasPolarityConflict) {
      continue;
    }

    // Typo tolerance on folded strings (never bypasses negation/time polarity guards)
    const maxLen = Math.max(foldedUser.length, foldedCand.length);
    const dist = levenshteinDistance(foldedUser, foldedCand);
    const similarity = maxLen > 0 ? 1 - dist / maxLen : 0;

    if (similarity > bestScore) {
      bestScore = similarity;
      bestTarget = candidate;
    }

    const allowedEdits =
      cardType === 'word'
        ? maxLen >= 8
          ? 2
          : maxLen >= 4
            ? 1
            : 0
        : Math.min(3, Math.floor(maxLen * 0.1));
    const minFuzzySim = cardType === 'word' ? 0.78 : 0.88;
    if ((dist <= allowedEdits && similarity >= minFuzzySim) || isAdjacentTransposition(foldedUser, foldedCand)) {
      return {
        isCorrect: true,
        matchKind: 'fuzzy',
        matchedTranslation: candidate,
        similarity: Math.max(similarity, 0.85),
      };
    }

    // Sentence or multi-word phrase token overlap (using both raw-folded and phrase-canonicalized tokens)
    if (cardType === 'sentence' || normCand.includes(' ') || normUser.includes(' ')) {
      const { score: overlap, contentLen } = stemOverlapScore(userTokens, candTokens);
      if (overlap > bestScore) {
        bestScore = overlap;
        bestTarget = candidate;
      }
      if (overlap >= getSentenceOverlapThreshold(contentLen)) {
        return {
          isCorrect: true,
          matchKind: 'overlap',
          matchedTranslation: candidate,
          similarity: overlap,
        };
      }
    }
  }

  return {
    isCorrect: false,
    matchKind: 'none',
    matchedTranslation: bestTarget,
    similarity: bestScore,
  };
}

const EN_CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bcan't\b/gi, 'cannot'],
  [/\bcan\s+not\b/gi, 'cannot'],
  [/\bwon't\b/gi, 'will not'],
  [/\bshan't\b/gi, 'shall not'],
  [/([a-z])n't\b/gi, '$1 not'],
  [/\bi'm\b/gi, 'i am'],
  [/\byou're\b/gi, 'you are'],
  [/\bwe're\b/gi, 'we are'],
  [/\bthey're\b/gi, 'they are'],
  [/\bi've\b/gi, 'i have'],
  [/\byou've\b/gi, 'you have'],
  [/\bwe've\b/gi, 'we have'],
  [/\bthey've\b/gi, 'they have'],
  [/\bi'll\b/gi, 'i will'],
  [/\byou'll\b/gi, 'you will'],
  [/\bhe'll\b/gi, 'he will'],
  [/\bshe'll\b/gi, 'she will'],
  [/\bit'll\b/gi, 'it will'],
  [/\bwe'll\b/gi, 'we will'],
  [/\bthey'll\b/gi, 'they will'],
  [/\bit's\b/gi, 'it is'],
  [/\bthat's\b/gi, 'that is'],
  [/\bthere's\b/gi, 'there is'],
  [/\bhere's\b/gi, 'here is'],
  [/\bwhat's\b/gi, 'what is'],
  [/\bwho's\b/gi, 'who is'],
];

const EN_PHRASE_CANONICAL_RULES: Array<[RegExp, string]> = [
  [/\bpassed\s+away\b/g, 'died'],
  [/\bpasses\s+away\b/g, 'dies'],
  [/\bpass\s+away\b/g, 'die'],
  [/\bshopping\s+(?:mall|center|centre)\b/g, 'mall'],
  [/\b(?:cell|mobile|smart)\s+phone\b/g, 'phone'],
  [/\bcellphone\b/g, 'phone'],
  [/\bsmartphone\b/g, 'phone'],
  [/\be\s+mail\b/g, 'email'],
  [/\ba\s+lot\s+of\b/g, 'many'],
  [/\blots\s+of\b/g, 'many'],
  [/\bhave\s+got\b/g, 'have'],
  [/\bhas\s+got\b/g, 'has'],
  [/\bneed\s+to\b/g, 'must'],
  [/\bhave\s+to\b/g, 'must'],
  [/\bhas\s+to\b/g, 'must'],
  [/\bhad\s+to\b/g, 'needed'],
  [/\bis\s+going\s+to\b/g, 'will'],
  [/\bare\s+going\s+to\b/g, 'will'],
  [/\bam\s+going\s+to\b/g, 'will'],
];

const EN_STOP_WORDS = new Set(['a', 'an', 'the', 'to', 'of', 'for', 'in', 'on', 'at', 'by', 'with', 'that', 'into']);

const EN_NEGATION_WORDS = new Set(['not', 'never', 'no', 'nothing', 'nobody', 'none', 'neither', 'nowhere', 'cannot']);

export const EN_SYNONYM_GROUPS: string[][] = [
  ['movie', 'film', 'cinema'],
  ['movies', 'films'],
  ['tv', 'television'],
  ['phone', 'telephone'],
  ['auto', 'automobile', 'car', 'vehicle'],
  ['plane', 'airplane', 'aeroplane', 'aircraft'],
  ['cab', 'taxi'],
  ['bike', 'bicycle'],
  ['sofa', 'couch'],
  ['fall', 'autumn'],
  ['ill', 'sick', 'unwell'],
  ['big', 'large', 'huge'],
  ['small', 'little', 'tiny'],
  ['fast', 'quick', 'rapid'],
  ['rapidly', 'quickly', 'fast'],
  ['slow', 'sluggish'],
  ['happy', 'glad', 'joyful', 'pleased'],
  ['sad', 'unhappy', 'upset'],
  ['angry', 'mad', 'furious'],
  ['scared', 'afraid', 'frightened', 'terrified'],
  ['nervous', 'anxious', 'worried'],
  ['confident', 'sure', 'certain'],
  ['easy', 'simple'],
  ['hard', 'difficult', 'tough'],
  ['smart', 'clever', 'intelligent', 'bright'],
  ['important', 'significant', 'crucial', 'essential', 'vital'],
  ['start', 'begin', 'commence'],
  ['started', 'began'],
  ['finish', 'end', 'complete'],
  ['finished', 'ended', 'completed'],
  ['buy', 'purchase'],
  ['bought', 'purchased'],
  ['help', 'assist', 'aid', 'support'],
  ['helped', 'assisted'],
  ['answer', 'reply', 'respond'],
  ['answered', 'replied', 'responded'],
  ['speak', 'talk'],
  ['spoke', 'talked'],
  ['say', 'tell'],
  ['said', 'told'],
  ['choose', 'pick', 'select'],
  ['chose', 'picked', 'selected'],
  ['fix', 'repair'],
  ['fixed', 'repaired'],
  ['return', 'go back', 'come back'],
  ['returned', 'came back', 'went back'],
  ['continue', 'keep going', 'carry on'],
  ['continued', 'kept going'],
  ['recover', 'heal', 'get well', 'get better'],
  ['recovered', 'healed', 'got better'],
  ['forgive', 'pardon', 'excuse'],
  ['forgave', 'pardoned'],
  ['hurt', 'ache', 'pain'],
  ['hurts', 'aches'],
  ['surgery', 'operation'],
  ['doctor', 'physician'],
  ['medicine', 'medication', 'drug', 'pill'],
  ['exam', 'test', 'quiz'],
  ['assignment', 'homework', 'task'],
  ['grade', 'mark', 'score'],
  ['lecture', 'class', 'lesson', 'course'],
  ['student', 'pupil'],
  ['teacher', 'instructor', 'professor'],
  ['skill', 'ability', 'talent'],
  ['revise', 'review', 'study'],
  ['shop', 'store'],
  ['mall', 'market'],
  ['price', 'cost', 'fee'],
  ['discount', 'sale', 'reduction'],
  ['receipt', 'bill', 'invoice'],
  ['client', 'customer'],
  ['company', 'corporation', 'firm', 'business'],
  ['executive', 'manager', 'director', 'boss'],
  ['gift', 'present'],
  ['trash', 'garbage', 'rubbish', 'waste'],
  ['apartment', 'flat'],
  ['elevator', 'lift'],
  ['holiday', 'vacation'],
  ['soccer', 'football'],
  ['kid', 'child'],
  ['kids', 'children'],
  ['baby', 'infant'],
  ['dad', 'father', 'daddy'],
  ['mom', 'mother', 'mum', 'mommy'],
  ['parent', 'parents'],
  ['husband', 'spouse', 'partner'],
  ['wife', 'spouse', 'partner'],
  ['friend', 'pal', 'buddy', 'mate'],
  ['password', 'passcode', 'pin'],
  ['account', 'profile', 'membership'],
  ['bug', 'glitch', 'error', 'defect'],
  ['hardware', 'equipment', 'device'],
  ['software', 'application', 'app', 'program'],
  ['upgrade', 'update', 'improve'],
  ['upgraded', 'updated', 'improved'],
  ['data', 'information', 'info'],
  ['network', 'connection', 'grid'],
  ['evidence', 'proof'],
  ['factor', 'cause', 'reason', 'element'],
  ['research', 'study', 'investigation'],
  ['legal', 'lawful', 'legitimate'],
  ['trial', 'hearing', 'lawsuit', 'case'],
  ['moral', 'ethical'],
  ['safe', 'secure'],
  ['safety', 'security', 'protection'],
  ['warning', 'alert', 'caution'],
  ['often', 'frequently', 'regularly'],
  ['usually', 'normally', 'generally'],
  ['habit', 'routine', 'custom'],
  ['destination', 'goal', 'target'],
  ['reservation', 'booking'],
  ['guide', 'tour guide', 'leader'],
  ['station', 'stop', 'terminal'],
  ['forecast', 'prediction'],
  ['temperature', 'heat'],
  ['nature', 'environment'],
];

const EN_SYNONYM_MAP = new Map<string, Set<number>>();
EN_SYNONYM_GROUPS.forEach((group, groupIdx) => {
  for (const word of group) {
    const existing = EN_SYNONYM_MAP.get(word);
    if (existing) {
      existing.add(groupIdx);
    } else {
      EN_SYNONYM_MAP.set(word, new Set([groupIdx]));
    }
  }
});

function areEnglishTokensSynonymous(a: string, b: string): boolean {
  if (a === b) return true;
  const groupsA = EN_SYNONYM_MAP.get(a);
  const groupsB = EN_SYNONYM_MAP.get(b);
  if (!groupsA || !groupsB) return false;
  for (const id of groupsA) {
    if (groupsB.has(id)) return true;
  }
  return false;
}

/** Normalize English text (lowercase, expand contractions, strip punctuation). */
export function normalizeEnglish(input: string): string {
  let s = input.toLowerCase().replace(/[’`]/g, "'");
  for (const [re, rep] of EN_CONTRACTIONS) {
    s = s.replace(re, rep);
  }
  return s
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b0([1-9])([:.]\d{2})\b/g, '$1$2')
    .replace(/[.,!?;:"'()\[\]{}\-_/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalizeEnglishPhrases(normInput: string): string {
  let s = normInput;
  for (const [re, rep] of EN_PHRASE_CANONICAL_RULES) {
    s = s.replace(re, rep);
  }
  return s.replace(/\s+/g, ' ').trim();
}

function englishOverlapScore(userTokens: string[], candTokens: string[]): number {
  const userHasNeg = userTokens.some((t) => EN_NEGATION_WORDS.has(t));
  const candHasNeg = candTokens.some((t) => EN_NEGATION_WORDS.has(t));
  if (userHasNeg !== candHasNeg) return 0;

  const u = userTokens.filter((t) => !EN_STOP_WORDS.has(t));
  const c = candTokens.filter((t) => !EN_STOP_WORDS.has(t));
  const effU = u.length > 0 ? u : userTokens;
  const effC = c.length > 0 ? c : candTokens;
  if (effU.length === 0 || effC.length === 0) return 0;

  const tokenMatches = (tokA: string, tokB: string): boolean => {
    if (tokA === tokB) return true;
    if (areEnglishTokensSynonymous(tokA, tokB)) return true;
    const minLen = Math.min(tokA.length, tokB.length);
    if (minLen >= 5 && (levenshteinDistance(tokA, tokB) <= 1 || isAdjacentTransposition(tokA, tokB))) {
      return true;
    }
    return false;
  };

  let matchedC = 0;
  for (const ct of effC) {
    if (effU.some((ut) => tokenMatches(ut, ct))) matchedC += 1;
  }
  let matchedU = 0;
  for (const ut of effU) {
    if (effC.some((ct) => tokenMatches(ut, ct))) matchedU += 1;
  }

  const recall = matchedC / effC.length;
  const precision = matchedU / effU.length;
  if (recall + precision === 0) return 0;
  return (2 * recall * precision) / (recall + precision);
}

/**
 * Evaluate a user's English translation locally (used ahead of AI check in TR->EN mode).
 * Supports contractions, phrase canonicalization, synonym equivalence, and content-word reordering
 * (e.g. "I forgot my Spotify account password" vs "I forgot the password to my Spotify account").
 */
export function evaluateEnglishAnswer(
  userInput: string,
  acceptedEnglish: string[],
  cardType: CardType
): AnswerEvaluation {
  const normUser = normalizeEnglish(userInput);
  if (!normUser) {
    return { isCorrect: false, matchKind: 'none', matchedTranslation: null, similarity: 0 };
  }

  const canonUser = canonicalizeEnglishPhrases(normUser);
  let bestScore = 0;
  let bestTarget: string | null = null;
  const userWithoutTo = normUser.replace(/^(?:to|a|an|the)\s+/, '');
  const canonUserWithoutTo = canonUser.replace(/^(?:to|a|an|the)\s+/, '');

  for (const cand of acceptedEnglish) {
    const normCand = normalizeEnglish(cand);
    if (!normCand) continue;
    const canonCand = canonicalizeEnglishPhrases(normCand);

    if (userInput.trim().toLowerCase() === cand.trim().toLowerCase()) {
      return { isCorrect: true, matchKind: 'exact', matchedTranslation: cand, similarity: 1 };
    }

    const candWithoutTo = normCand.replace(/^(?:to|a|an|the)\s+/, '');
    const canonCandWithoutTo = canonCand.replace(/^(?:to|a|an|the)\s+/, '');
    if (
      normUser === normCand ||
      canonUser === canonCand ||
      (cardType === 'word' && (userWithoutTo === candWithoutTo || canonUserWithoutTo === canonCandWithoutTo))
    ) {
      return { isCorrect: true, matchKind: 'normalized', matchedTranslation: cand, similarity: 1 };
    }

    if (cardType === 'word' && areEnglishTokensSynonymous(canonUserWithoutTo, canonCandWithoutTo)) {
      return { isCorrect: true, matchKind: 'normalized', matchedTranslation: cand, similarity: 0.95 };
    }

    const maxLen = Math.max(normUser.length, normCand.length);
    const dist = levenshteinDistance(normUser, normCand);
    const sim = maxLen > 0 ? 1 - dist / maxLen : 0;
    if (sim > bestScore) {
      bestScore = sim;
      bestTarget = cand;
    }

    if (
      (cardType === 'word' && maxLen >= 5 && dist <= 1 && sim >= 0.8) ||
      isAdjacentTransposition(normUser, normCand)
    ) {
      return { isCorrect: true, matchKind: 'fuzzy', matchedTranslation: cand, similarity: Math.max(sim, 0.85) };
    }

    if (cardType === 'sentence' && maxLen >= 10 && dist <= Math.min(2, Math.floor(maxLen * 0.08)) && sim >= 0.88) {
      return { isCorrect: true, matchKind: 'fuzzy', matchedTranslation: cand, similarity: sim };
    }

    if (cardType === 'sentence' || normCand.includes(' ')) {
      const uTokens = canonUser.split(' ').filter(Boolean);
      const cTokens = canonCand.split(' ').filter(Boolean);
      const overlap = englishOverlapScore(uTokens, cTokens);
      if (overlap > bestScore) {
        bestScore = overlap;
        bestTarget = cand;
      }
      if (overlap >= 0.84) {
        return { isCorrect: true, matchKind: 'overlap', matchedTranslation: cand, similarity: overlap };
      }
    }
  }

  return {
    isCorrect: false,
    matchKind: 'none',
    matchedTranslation: bestTarget,
    similarity: bestScore,
  };
}
