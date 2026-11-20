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
  [/\bhayatini\s+kaybet(ti|mistir|mis|tiler)\b/g, 'oldu'],
  [/\bvefat\s+et(ti|mistir|mis|tiler)\b/g, 'oldu'],
  [/\byasama\s+veda\s+et(ti|mistir)\b/g, 'oldu'],
  [/\b(\d{4})\s+yilinda\b/g, '$1'],
  [/\bkiz\s+cocu(gu|k|gum|gun)\b/g, 'kizcocuk'],
  [/\bkiz\s+evla(di|t|dim)\b/g, 'kizcocuk'],
  [/\berkek\s+cocu(gu|k|gum|gun)\b/g, 'erkekcocuk'],
  [/\berkek\s+evla(di|t|dim)\b/g, 'erkekcocuk'],
  [/\balisveris\s+merkezi(nde|ne|nden|ni|nin)?\b/g, 'avm'],
  [/\byazilim\s+hata(si|lari)\b/g, 'bug'],
  [/\bcep\s+telefon(u|um|un|una|unda|undan)?\b/g, 'telefon'],
  [/\belektronik\s+posta(yi|ya|da|dan)?\b/g, 'eposta'],
  [/\be\s+posta(yi|ya|da|dan)?\b/g, 'eposta'],
  [/\bev\s+odev(i|im|ini|in|leri)?\b/g, 'odev'],
  [/\bsatin\s+al(mak|di|dim|din|dik|dilar|iyor|iyorum|acak|acagim|mis)\b/g, 'al$1'],
  [/\byardim\s+et(mek|ti|tim|tin|tik|iyor|iyorum|ecek)\b/g, 'yardim'],
  [/\byardimci\s+ol(mak|du|dum|dun|duk|uyor|uyorum|acak)\b/g, 'yardim'],
  [/\bdevam\s+et(mek|ti|tim|tik|iyor|ecek)\b/g, 'surdur'],
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
  ['kaybetmek', 'yenilmek', 'yitirmek', 'unuttum', 'unutmak'],
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

/**
 * Normalize Turkish text for comparison: lowercase using tr-TR locale,
 * remove parenthetical notes and punctuation, and collapse whitespace.
 */
export function normalizeTurkish(input: string): string {
  return input
    .toLocaleLowerCase('tr-TR')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/['"`’“”.,!?;:()\[\]{}\-_/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fold Turkish diacritics to ASCII equivalents so minor keyboard misses still match. */
export function foldTurkishDiacritics(input: string): string {
  return normalizeTurkish(input).replace(/[çğıİöşüâîû]/g, (ch) => TR_DIACRITIC_MAP[ch] ?? ch);
}

function canonicalizeTurkishPhrases(foldedInput: string): string {
  let s = foldedInput;
  for (const [re, rep] of TR_PHRASE_CANONICAL_RULES) {
    s = s.replace(re, rep);
  }
  return s.replace(/\s+/g, ' ').trim();
}

const TR_SUFFIX_RE =
  /(?:mistir|mustur|mektedir|maktadir|larimiz|lerimiz|larindan|lerinden|siniz|sunuz|sini|sunu|lari|leri|ndan|nden|inin|unun|imin|umun|ina|ine|una|une|dan|den|tan|ten|dir|dur|tir|tur|mak|mek|iyor|uyor|acak|ecek|mis|mus|di|du|ti|tu|im|um|in|un|yi|yu|ya|ye|da|de|ta|te|i|u)$/;

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

function tokensMatchTurkish(userTok: string, targetTok: string): boolean {
  if (userTok === targetTok) return true;
  if (areTurkishTokensSynonymous(userTok, targetTok)) return true;

  const stemsU = getTurkishStemCandidates(userTok);
  const stemsT = getTurkishStemCandidates(targetTok);
  for (const su of stemsU) {
    for (const st of stemsT) {
      if (su === st && su.length >= 3) return true;
    }
  }

  const minLen = Math.min(userTok.length, targetTok.length);
  if (minLen >= 4) {
    const prefixLen = Math.min(4, minLen);
    if (userTok.slice(0, prefixLen) === targetTok.slice(0, prefixLen)) {
      return true;
    }
  }
  return levenshteinDistance(userTok, targetTok) <= 1 && minLen >= 4;
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
]);

/** Allow prefix, stem, softening-reversal, and synonym matching for Turkish words/sentences. */
function stemOverlapScore(userTokens: string[], targetTokens: string[]): number {
  const userHasNeg = userTokens.some((t) => TR_EXPLICIT_NEG_WORDS.has(t));
  const targetHasNeg = targetTokens.some((t) => TR_EXPLICIT_NEG_WORDS.has(t));
  if (userHasNeg !== targetHasNeg) return 0;

  const filteredUser = userTokens.filter((t) => !TR_STOP_WORDS.has(t));
  const filteredTarget = targetTokens.filter((t) => !TR_STOP_WORDS.has(t));
  const u = filteredUser.length > 0 ? filteredUser : userTokens;
  const t = filteredTarget.length > 0 ? filteredTarget : targetTokens;

  if (u.length === 0 || t.length === 0) return 0;

  let matchedTarget = 0;
  for (const targetTok of t) {
    if (u.some((userTok) => tokensMatchTurkish(userTok, targetTok))) {
      matchedTarget += 1;
    }
  }

  let matchedUser = 0;
  for (const userTok of u) {
    if (t.some((targetTok) => tokensMatchTurkish(userTok, targetTok))) {
      matchedUser += 1;
    }
  }

  // Symmetric recall + precision harmonic mean so single lucky word doesn't pass a long sentence
  const recall = matchedTarget / t.length;
  const precision = matchedUser / u.length;
  if (recall + precision === 0) return 0;
  return (2 * recall * precision) / (recall + precision);
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

    // Typo tolerance on folded strings
    const maxLen = Math.max(foldedUser.length, foldedCand.length);
    const dist = levenshteinDistance(foldedUser, foldedCand);
    const similarity = maxLen > 0 ? 1 - dist / maxLen : 0;

    if (similarity > bestScore) {
      bestScore = similarity;
      bestTarget = candidate;
    }

    const allowedEdits = cardType === 'word' ? (maxLen >= 8 ? 2 : maxLen >= 4 ? 1 : 0) : Math.floor(maxLen * 0.18);
    if ((dist <= allowedEdits && similarity >= 0.78) || isAdjacentTransposition(foldedUser, foldedCand)) {
      return {
        isCorrect: true,
        matchKind: 'fuzzy',
        matchedTranslation: candidate,
        similarity: Math.max(similarity, 0.85),
      };
    }

    // Sentence or multi-word phrase token overlap (using both raw-folded and phrase-canonicalized tokens)
    if (cardType === 'sentence' || normCand.includes(' ') || normUser.includes(' ')) {
      const userTokens = canonUser.split(' ').filter(Boolean);
      const candTokens = canonCand.split(' ').filter(Boolean);
      const overlap = stemOverlapScore(userTokens, candTokens);
      if (overlap > bestScore) {
        bestScore = overlap;
        bestTarget = candidate;
      }
      if (overlap >= 0.65) {
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
