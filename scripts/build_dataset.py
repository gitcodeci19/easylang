"""Build a clean, AI-enriched English-Turkish word, phrase, and sentence dataset.

Sources:
- Oxford 5000 CEFR JSON (words, CEFR levels, POS, phonetics, English examples)
- FreeDict eng-tur TEI XML (open-source English-Turkish translations)
- AI-curated enrichment (curated_enrichment.py):
  - All 723 Oxford 5000 words missing from FreeDict
  - 150+ Phrasal Verbs, Idioms, Collocations, Spoken Chunks & Modern Tech/Work terms
  - Curated grammar-targeted & spoken English sentence pairs
- Tatoeba exports filtered for 100% natural, proper-noun-free English-Turkish sentences
"""

from __future__ import annotations

import bz2
import csv
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

from curated_enrichment import (
    CURATED_PHRASES_AND_VOCAB,
    CURATED_SENTENCES,
    CURATED_WORD_EXAMPLES,
    MISSING_OXFORD_TRANSLATIONS,
    PRIMARY_WORD_OVERRIDES,
)
from modern_sentences import MODERN_SENTENCES

ROOT_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT_DIR / ".cache"
OUT_FILE = ROOT_DIR / "public" / "data" / "cards.json"

URLS = {
    "oxford": "https://raw.githubusercontent.com/winterdl/oxford-5000-vocabulary-audio-definition/main/data/oxford_5000.json",
    "freedict": "https://raw.githubusercontent.com/freedict/fd-dictionaries/master/eng-tur/eng-tur.tei",
    "tatoeba_links": "https://downloads.tatoeba.org/exports/per_language/tur/tur-eng_links.tsv.bz2",
    "tatoeba_tur": "https://downloads.tatoeba.org/exports/per_language/tur/tur_sentences.tsv.bz2",
    "tatoeba_eng": "https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2",
}

TAG_PREFIX_RE = re.compile(r"^(?:\([^)]{1,20}\)\s*)+")
BRACKET_NOTE_RE = re.compile(r"\([^)]{1,40}\)")
MULTISPACE_RE = re.compile(r"\s+")
PUNCT_END_RE = re.compile(r"[.;:]+$")
WORD_TOKEN_RE = re.compile(r"[a-z]+(?:'[a-z]+)?")

# Synthetic proper names frequent in corpus sentences (Tatoeba) that hurt YouGlish & naturalness
SYNTHETIC_PROPER_NOUN_RE = re.compile(
    r"\b("
    r"tom|mary|john|boston|alice|bob|jack|jim|ann|sami|layla|dan|linda|mike|bill|jane|"
    r"chicago|australia|french|japanese|german|spain|london|paris|nancy|paul|peter|sarah|"
    r"david|george|charles|henry|edward|richard|thomas|william|robert|james|ken|kate|sue|"
    r"meg|ben|ned|tim|sam|max|alex|chris|mark|luke|matthew|fadil|dima|carlos|maria|taro|"
    r"hanako|jiro|kenji|yuki|tanaka|smith|jones|brown|wilson|taylor|jackson|white|harris"
    r")\b",
    re.I,
)

ALLOWED_MID_CAP_WORDS = {
    "I",
    "I'm",
    "I've",
    "I'll",
    "I'd",
    "English",
    "Turkish",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
    "Internet",
    "Wi-Fi",
    "TV",
    "OK",
    "DNA",
    "AI",
}

GRAMMAR_TARGET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("used_to", re.compile(r"\bused\s+to\b", re.I)),
    ("have_to", re.compile(r"\b(?:have|has|had)\s+to\b", re.I)),
    ("going_to", re.compile(r"\bgoing\s+to\b", re.I)),
    ("present_perfect", re.compile(r"\b(?:have|has|'ve|'s)\s+(?:been|done|seen|made|gone|taken|written|found|heard|known|got|gotten|had|finished|started|lived|worked|learned|tried)\b", re.I)),
    ("past_continuous", re.compile(r"\b(?:was|were)\s+[a-z]{3,}ing\b", re.I)),
    ("conditional", re.compile(r"\b(?:if|unless|would|could\s+have|should\s+have)\b", re.I)),
    ("contrast_linker", re.compile(r"\b(?:although|though|despite|however|whereas|instead\s+of|even\s+though|as\s+long\s+as)\b", re.I)),
    ("modal_advice", re.compile(r"\b(?:should|ought\s+to|must|might|could)\b", re.I)),
    ("for_since", re.compile(r"\b(?:for|since)\s+(?:two|three|four|five|six|seven|eight|nine|ten|many|several|a\s+long|last|yesterday|monday|20\d\d)\b", re.I)),
]

# Skip noisy encyclopedic, domain-jargon, or meta-dictionary entries from FreeDict
NOISY_TR_PATTERNS = (
    "bkz.",
    "bknz",
    "kıs.",
    "önek",
    "sonek",
    "esk.",
    "argo",
    "bir çeşit",
    "anlamına gelen",
    "mahsus",
    "iltihabı",
    "fahişe",
    "ruhani meclis",
    "makas göbeği",
    "at tırnağının",
    "birinci kânun",
    "kompütör",
    "kompüter",
    "oynaşmak",
    "vız gelir",
    "muhatara",
    "mary'nin eline",
    "nedir bu ?",
    "mübadele",
    "trampa",
    "süprüntü",
    "külfetli",
    "hande",
    "kerime",
    "zevç",
    "mabut",
    "ilâm",
    "vekâlet",
    "meblâğ",
    "mâni",
    "kâfi",
    "âlâ",
    "tediye",
    "tesviye",
    "münakalât",
    "salâhiyet",
    "nâmevcut",
    "mükâleme",
    "muhavere",
    "teşkilât",
    "rüsum",
    "faik",
    "iptida",
    "şemsi ay",
    "bir kadın ismi",
    "quarrelsome",
    "forestry",
    "central",
    "particular",
    "catechism",
    "centum",
    "baglaç",
    "baçlaç",
    "domuz arabası",
    "değiş tokuş takas",
    "hastallk",
    "müküfat",
    "mobil ya",
    "buzdolabu",
    "gömrüşmeye",
    "ic gr!",
    "0404 dönüm",
    "0404 hektar",
    "2000 libre",
    "2240 libre",
)

FREEDICT_ABBREV_STOPWORDS = frozenset({
    "ing", "amer", "esk", "kıs", "çoğ", "sf", "is", "f", "zf", "ed", "bağ", "ünl",
    "argo", "mec", "ayn", "vb", "vs", "örn", "bkz", "bknz",
})

LEADING_PROPER_BLOCKLIST = frozenset({
    "minnesota", "tufts", "twitter", "youtube", "lidia", "franco", "yumi", "lucy",
    "emily", "sumatra", "ireland", "tokyo", "keiko", "mariko", "sabrina", "olga",
    "vladimir", "natasha", "pedro", "juan", "elena", "sofia", "marco", "paolo",
    "hans", "fritz", "claire", "pierre", "marie", "nicolas", "chloe", "diego",
    "ramon", "akira", "sato", "suzuki", "wang", "chen", "zhang", "ahmed", "fatima",
    "hassan", "omar", "leila", "yusuf", "ayse", "mehmet", "mustafa", "dan", "tom",
    "mary", "john", "alice", "bob", "jack", "jim", "ann", "sami", "layla", "linda",
    "mike", "bill", "jane", "nancy", "paul", "peter", "sarah", "david", "george",
    "charles", "henry", "edward", "richard", "thomas", "william", "robert", "james",
    "kate", "sue", "meg", "ben", "ned", "tim", "sam", "max", "alex", "chris", "mark",
    "luke", "matthew", "carlos", "maria", "taro", "hanako", "jiro", "kenji", "yuki",
    "tanaka", "boston", "chicago", "london", "paris", "spain", "australia", "brazil",
    "canada", "china", "france", "germany", "india", "italy", "japan", "korea",
    "mexico", "russia", "sweden", "texas", "california", "florida", "alaska",
})

TR_FOLD_MAP = str.maketrans("çğıöşüâîûÇĞİÖŞÜÂÎÛ", "cgiosuaiuCGIOSUAIU")
TR_HELPER_WORDS = frozenset({
    "etmek", "olmak", "yapmak", "vermek", "almak", "bir", "ve", "ile", "icin",
    "gibi", "olan", "sey", "kimse", "kisi", "taraf", "sekilde", "olarak",
})

LATIN_BINOMIAL_RE = re.compile(r"^[A-Z][a-z]{2,}\s+[a-z]{3,}(?:\s+[a-z]{2,})?$")
NON_BINOMIAL_FIRST_WORDS = frozenset({
    "Amerikan", "İngiliz", "Ingiliz", "Fransız", "Fransiz", "Alman",
    "İtalyan", "Italyan", "İspanyol", "Ispanyol", "Rus", "Çin", "Cin",
    "Japon", "Yunan", "Latin", "Türk", "Turk", "Arap", "Osmanlı", "Osmanli",
    "Avrupa", "Asya", "Afrika", "Hatay", "Adana", "Antep", "Roma", "Mısır",
    "Misir", "Katolik", "Hıristiyan", "Ortodoks", "Allah", "Allahtan",
    "Tanrı", "Noel", "Paskalya", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık", "Pazar",
    "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi",
    "Gal", "Mors", "Mary", "John", "London", "Paris", "New", "York", "God", "Lord",
})

DOMAIN_TAG_RE = re.compile(
    r"^\((?:bot|bayt|den|huk|kim|mat|müh|fiz|tıp|ask|din|dilb|çoğ|k\.dili|anat|zool|jeol|müz|ekon)\.?[^)]*\)",
    re.I,
)
SUBENTRY_SPLIT_RE = re.compile(r"\.\s+[a-z]{2,}")


def has_synthetic_or_proper_name(en_text: str) -> bool:
    """Return True if an English sentence contains synthetic corpus names or mid-sentence proper nouns."""
    if SYNTHETIC_PROPER_NOUN_RE.search(en_text):
        return True
    tokens = en_text.split()
    for idx, raw_tok in enumerate(tokens):
        if idx == 0:
            continue
        clean = raw_tok.strip(".,!?;:\"'()[]{}")
        if not clean:
            continue
        if clean[0].isupper() and clean not in ALLOWED_MID_CAP_WORDS:
            return True
    return False


def download_cached(name: str, url: str) -> Path:
    """Download a source URL into .cache/ if not already present."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    filename = url.split("/")[-1]
    dest = CACHE_DIR / filename
    if dest.exists() and dest.stat().st_size > 0:
        print(f"[cache] {name}: {dest.name}")
        return dest

    print(f"[fetch] {name}: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "EnTrRecallDatasetBuilder/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    dest.write_bytes(data)
    print(f"[saved] {dest.name} ({len(data) / 1024:.1f} KB)")
    return dest


def normalize_ocr_turkish(text: str) -> str:
    """Repair common Redhouse/FreeDict OCR glitches (I/1 confused with lowercase l)."""
    fixed = re.sub(r"(?<=[a-zçğıöşüâîû])I", "l", text)
    fixed = re.sub(r"(?<=[a-zçğıöşüâîû])1|1(?=[a-zçğıöşüâîû])", "l", fixed)
    # Fix leading OCR capital I before lowercase vowels when not an expected proper noun
    fixed = re.sub(r"\bI(?=[a-zçğıöşü]{2,})", "l", fixed)
    return fixed


def clean_tr_gloss(raw: str) -> list[tuple[str, bool]]:
    """Normalize a FreeDict Turkish translation into (clean_text, is_domain_tagged) pairs."""
    text = raw.replace("\u200b", "").strip()
    if not text:
        return []
    text = normalize_ocr_turkish(text)
    lowered = text.lower()
    if any(pat in lowered for pat in NOISY_TR_PATTERNS):
        return []

    if (
        LATIN_BINOMIAL_RE.match(text)
        and text.split()[0] not in NON_BINOMIAL_FIRST_WORDS
        and not any(ch in text for ch in "çğıöşüÇĞİÖŞÜ")
        and not re.search(r"\b(etmek|olmak|vermek|almak)\b", lowered)
    ):
        return []

    is_domain = bool(DOMAIN_TAG_RE.match(text))
    text = TAG_PREFIX_RE.sub("", text).strip()
    text = BRACKET_NOTE_RE.sub("", text).strip()

    if "(" in text or ")" in text or "?" in text or "!" in text or '"' in text:
        return []

    sub_match = SUBENTRY_SPLIT_RE.search(text)
    if sub_match:
        text = text[: sub_match.start()].strip()

    text = PUNCT_END_RE.sub("", text).strip()
    if ":" in text and len(text) <= 35 and not re.search(r"\d", text):
        text = text.replace(":", ",")
    if not text or ":" in text or "." in text:
        return []

    parts = [MULTISPACE_RE.sub(" ", p).strip() for p in re.split(r"[,;/]", text)]
    results: list[tuple[str, bool]] = []
    for part in parts:
        part = PUNCT_END_RE.sub("", part).strip()
        if not part or part.startswith("-"):
            continue
        part = normalize_ocr_turkish(part)
        part_lower = part.lower()
        if part_lower in FREEDICT_ABBREV_STOPWORDS:
            continue
        if re.fullmatch(r"\d+", part):
            continue
        if any(pat in part_lower for pat in NOISY_TR_PATTERNS):
            continue
        if (
            LATIN_BINOMIAL_RE.match(part)
            and part.split()[0] not in NON_BINOMIAL_FIRST_WORDS
            and not any(ch in part for ch in "çğıöşüÇĞİÖŞÜ")
            and not re.search(r"\b(etmek|olmak|vermek|almak)\b", part_lower)
        ):
            continue
        word_count = len(part.split())
        if word_count > 4 or len(part) > 40 or len(part) < 2:
            continue
        if re.search(
            r"\b(the|and|with|from|into|somebody|something|one's|licence|you|may|can|his|theirs|gray|shew|aged|mania|swum|statuette)\b",
            part_lower,
        ):
            continue
        if re.search(r"\b(to|of|for|with|on|at)\s+ile\b", part_lower):
            continue
        results.append((part, is_domain))
    return results


def parse_freedict(tei_path: Path) -> dict[str, list[tuple[str, bool, int]]]:
    """Parse FreeDict eng-tur.tei into {english_headword_lower: [(tr_meaning, is_domain, sense_idx), ...]}."""
    print("[parse] FreeDict eng-tur.tei...")
    ns = {"tei": "http://www.tei-c.org/ns/1.0"}
    tree = ET.parse(tei_path)
    root = tree.getroot()

    translations: dict[str, list[tuple[str, bool, int]]] = defaultdict(list)
    seen_per_word: dict[str, set[str]] = defaultdict(set)

    for entry in root.findall(".//tei:entry", ns):
        orth_el = entry.find("./tei:form/tei:orth", ns)
        if orth_el is None or not orth_el.text:
            continue
        headword = MULTISPACE_RE.sub(" ", orth_el.text.strip().lower())
        if not headword or len(headword) > 40:
            continue

        senses = entry.findall("./tei:sense", ns)
        for sense_idx, sense_el in enumerate(senses):
            for quote_el in sense_el.findall("./tei:cit[@type='trans']/tei:quote", ns):
                if not quote_el.text:
                    continue
                for candidate, is_domain in clean_tr_gloss(quote_el.text):
                    key = candidate.casefold()
                    if key == "ve" and headword != "and":
                        continue
                    if key not in seen_per_word[headword]:
                        seen_per_word[headword].add(key)
                        translations[headword].append((candidate, is_domain, sense_idx))

    print(f"[parse] FreeDict headwords with clean Turkish meanings: {len(translations)}")
    return dict(translations)


def rank_meanings_for_pos(
    candidates: list[tuple[str, bool, int]], pos: str, example_tr: str = ""
) -> list[str]:
    """Prioritize non-jargon, modern, primary-sense, POS- and example-consistent Turkish meanings."""
    pos_lower = pos.lower()
    wants_verb = "verb" in pos_lower and "adverb" not in pos_lower
    example_lower = example_tr.casefold()

    def is_tr_infinitive(text: str) -> bool:
        last = text.split()[-1].casefold()
        return last.endswith(("mak", "mek"))

    def matches_example(text: str) -> bool:
        if not example_lower:
            return False
        tokens = [t.casefold() for t in text.split() if len(t) >= 4]
        return any(tok[: max(4, len(tok) - 2)] in example_lower for tok in tokens)

    def sort_key(
        item: tuple[int, tuple[str, bool, int]]
    ) -> tuple[int, int, int, int, int, int, int]:
        idx, (text, is_domain, sense_idx) = item
        inf = is_tr_infinitive(text)
        pos_mismatch = 1 if (wants_verb != inf) else 0
        archaic_circumflex = 1 if re.search(r"[âîûÂÎÛ]", text) else 0
        ex_miss = 0 if matches_example(text) else 1
        sense_bucket = 0 if sense_idx == 0 else (1 if sense_idx == 1 else 2)
        long_phrase = 1 if len(text.split()) >= 3 else 0
        return (
            1 if is_domain else 0,
            pos_mismatch,
            archaic_circumflex,
            ex_miss,
            sense_bucket,
            long_phrase,
            idx,
        )

    ranked = sorted(enumerate(candidates), key=sort_key)
    primary = [text for _, (text, is_domain, sense_idx) in ranked if not is_domain and sense_idx <= 1]
    if primary:
        return primary[:4]
    return [text for _, (text, _, _) in ranked][:4]


def _norm_tr_match(text: str) -> str:
    folded = text.lower().translate(TR_FOLD_MAP)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", folded)).strip()


def _extract_tr_stems(meaning: str) -> list[str]:
    toks = _norm_tr_match(meaning).split()
    stems: list[str] = []
    for tok in toks:
        if tok in TR_HELPER_WORDS:
            continue
        base = tok
        if len(base) > 5 and (base.endswith("mak") or base.endswith("mek")):
            base = base[:-3]
        if len(base) >= 4:
            stems.append(base[: max(4, len(base) - 1)])
            if base[-1] in "kptc":
                stems.append(base[:-1])
        elif len(base) >= 2:
            stems.append(base)
    # Fallback when the entire meaning consists of short/helper words (e.g. 'bir', 'için', 'ile', 'yapmak', 'almak')
    if not stems and toks:
        for tok in toks:
            base = tok[:-3] if len(tok) > 5 and (tok.endswith("mak") or tok.endswith("mek")) else tok
            if len(base) >= 2:
                stems.append(base)
    return stems


def tr_meaning_matches_sentence(example_tr: str, meanings: list[str]) -> bool:
    """Return True if example_tr genuinely expresses at least one meaning in meanings."""
    if not example_tr or not meanings:
        return False
    ex_words = _norm_tr_match(example_tr).split()
    if not ex_words:
        return False
    for m in meanings:
        for stem in _extract_tr_stems(m):
            if len(stem) >= 4:
                if any(w.startswith(stem) for w in ex_words):
                    return True
            else:
                if any(w == stem or (len(stem) == 3 and w.startswith(stem)) for w in ex_words):
                    return True
    return False


def example_en_has_exact_headword(headword: str, example_en: str) -> bool:
    """Return True if example_en strictly contains the full standalone headword (never inside hyphenated compounds)."""
    w = headword.lower().strip()
    ex = example_en.lower()
    if not w or not ex:
        return False
    if " " in w or "-" in w:
        return bool(re.search(rf"(?<![a-z0-9-]){re.escape(w)}(?:s|es|ed|ing)?(?![a-z0-9-])", ex))
    if re.search(rf"(?<![a-z0-9-]){re.escape(w)}(?:s|es|ed|ing|d|er|est|ly)?(?![a-z0-9-])", ex):
        return True
    if len(w) >= 4 and w.endswith("e"):
        if re.search(rf"(?<![a-z0-9-]){re.escape(w[:-1])}(?:ing|ed|es|er|est)(?![a-z0-9-])", ex):
            return True
    if len(w) >= 4 and w.endswith("y"):
        if re.search(rf"(?<![a-z0-9-]){re.escape(w[:-1])}(?:ies|ied|ier|iest)(?![a-z0-9-])", ex):
            return True
    return False


def has_leading_weird_proper_noun(en_text: str) -> bool:
    first = en_text.split()[0] if en_text.split() else ""
    clean = re.sub(r"[^a-zA-Z']", "", first).lower().removesuffix("'s")
    return clean in LEADING_PROPER_BLOCKLIST


def parse_tatoeba(
    links_path: Path, tur_path: Path, eng_path: Path
) -> tuple[list[tuple[str, str]], dict[str, list[tuple[str, str, int]]]]:
    """Load proper-noun-free English-Turkish Tatoeba sentence pairs and build a multi-candidate word->examples pool."""
    print("[parse] Tatoeba links & sentences (filtering out synthetic proper nouns)...")
    tur_to_eng: dict[str, list[str]] = defaultdict(list)
    needed_tur_ids: set[str] = set()
    needed_eng_ids: set[str] = set()

    with bz2.open(links_path, "rt", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f, delimiter="\t")
        for row in reader:
            if len(row) < 2:
                continue
            tur_id, eng_id = row[0].strip(), row[1].strip()
            tur_to_eng[tur_id].append(eng_id)
            needed_tur_ids.add(tur_id)
            needed_eng_ids.add(eng_id)

    tur_sentences: dict[str, str] = {}
    with bz2.open(tur_path, "rt", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f, delimiter="\t")
        for row in reader:
            if len(row) >= 3 and row[0] in needed_tur_ids:
                tur_sentences[row[0]] = row[2].strip()

    eng_sentences: dict[str, str] = {}
    with bz2.open(eng_path, "rt", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f, delimiter="\t")
        for row in reader:
            if len(row) >= 3 and row[0] in needed_eng_ids:
                eng_sentences[row[0]] = row[2].strip()

    pairs: list[tuple[str, str]] = []
    seen_eng: set[str] = set()
    word_examples_pool: dict[str, list[tuple[str, str, int]]] = defaultdict(list)
    MAX_CANDS_PER_TOKEN = 45

    def index_example(en_s: str, tr_s: str, tier: int) -> None:
        if has_leading_weird_proper_noun(en_s):
            return
        seen_toks: set[str] = set()
        for tok in WORD_TOKEN_RE.findall(en_s.casefold()):
            if tok in seen_toks:
                continue
            seen_toks.add(tok)
            if len(word_examples_pool[tok]) < MAX_CANDS_PER_TOKEN:
                word_examples_pool[tok].append((en_s, tr_s, tier))
            # Index regular base forms cleanly for verbs/plurals (strict length guards)
            if tok.endswith("ies") and len(tok) > 5:
                base = tok[:-3] + "y"
                if len(word_examples_pool[base]) < MAX_CANDS_PER_TOKEN:
                    word_examples_pool[base].append((en_s, tr_s, tier))
            elif tok.endswith("ied") and len(tok) > 5:
                base = tok[:-3] + "y"
                if len(word_examples_pool[base]) < MAX_CANDS_PER_TOKEN:
                    word_examples_pool[base].append((en_s, tr_s, tier))
            elif tok.endswith("s") and not tok.endswith("ss") and len(tok) > 4:
                base = tok[:-1]
                if len(word_examples_pool[base]) < MAX_CANDS_PER_TOKEN:
                    word_examples_pool[base].append((en_s, tr_s, tier))
            elif tok.endswith("ed") and len(tok) > 5:
                for base in (tok[:-2], tok[:-1]):
                    if len(word_examples_pool[base]) < MAX_CANDS_PER_TOKEN:
                        word_examples_pool[base].append((en_s, tr_s, tier))
            elif tok.endswith("ing") and len(tok) > 6:
                for base in (tok[:-3], tok[:-3] + "e"):
                    if len(word_examples_pool[base]) < MAX_CANDS_PER_TOKEN:
                        word_examples_pool[base].append((en_s, tr_s, tier))

    # Tier 0: Modern relatable sentences first!
    for en_mod, tr_mod_list, _, _ in MODERN_SENTENCES:
        if tr_mod_list:
            index_example(en_mod, tr_mod_list[0], 0)

    # Tier 1: AI-curated clean grammar sentences
    for en_cur, tr_cur, _ in CURATED_SENTENCES:
        index_example(en_cur, tr_cur, 1)

    for tur_id, eng_ids in tur_to_eng.items():
        tr_text = tur_sentences.get(tur_id)
        if not tr_text:
            continue
        tr_text = re.sub(r",([^\s\d\"')\]])", r", \1", tr_text.replace("\u200b", "").strip())
        for eng_id in eng_ids[:1]:
            en_text = eng_sentences.get(eng_id)
            if not en_text:
                continue
            en_text = en_text.replace("\u200b", "").strip()
            en_words = en_text.split()
            if not (4 <= len(en_words) <= 12):
                continue
            if len(en_text) > 82 or len(tr_text) > 95:
                continue
            if re.search(r"[\[\]{}<>@#$%^&*_=+|\\0-9]", en_text + tr_text):
                continue
            # Strictly exclude synthetic proper nouns (Tom, Mary, Boston, etc.)
            if has_synthetic_or_proper_name(en_text) or SYNTHETIC_PROPER_NOUN_RE.search(tr_text):
                continue

            norm_en = en_text.casefold()
            if norm_en in seen_eng:
                continue
            seen_eng.add(norm_en)
            pairs.append((en_text, tr_text))

            if 4 <= len(en_words) <= 10:
                index_example(en_text, tr_text, 2)
            break

    pairs.sort(key=lambda p: (len(p[0].split()), len(p[0])))
    print(f"[parse] Clean proper-noun-free Tatoeba EN-TR sentence pairs: {len(pairs)}")
    return pairs, dict(word_examples_pool)


def synthesize_fallback_example(word: str, pos: str, tr_meaning: str) -> tuple[str, str]:
    """Generate a clean, grammatically accurate bilingual example with Turkish vowel harmony."""
    pos_low = pos.lower()
    w = word.strip()
    tr = tr_meaning.strip()
    if "adverb" in pos_low:
        return (
            f"The team handled the situation {w}.",
            f"Ekip durumu {tr} ele aldı.",
        )
    if "adjective" in pos_low:
        return (
            f"This method proved to be very {w} in practice.",
            f"Bu yöntemin pratikte çok {tr} olduğu görüldü.",
        )
    if "verb" in pos_low and tr.lower().endswith(("mak", "mek")):
        clean_tr_stem = tr[:-3].strip()
        suffix = "mamız" if tr.lower().endswith("mak") else "memiz"
        return (
            f"We need to {w} this carefully before deciding.",
            f"Karar vermeden önce bunu dikkatlice {clean_tr_stem}{suffix} gerekiyor.",
        )
    return (
        f"Understanding the concept of {w} is very useful here.",
        f"Burada {tr} kavramını anlamak çok faydalıdır.",
    )


def pick_sense_aligned_example(
    word: str,
    pos: str,
    tr_list: list[str],
    word_examples_pool: dict[str, list[tuple[str, str, int]]],
    allow_promote_meaning: bool = False,
) -> tuple[str, str, list[str]]:
    """Select an example sentence strictly matching both the English headword and Turkish acceptedTr sense."""
    key = word.strip().lower()
    if key in CURATED_WORD_EXAMPLES:
        en_s, tr_s = CURATED_WORD_EXAMPLES[key]
        return en_s, tr_s, tr_list

    # Collect candidates strictly containing the full headword (never split compounds into unrelated words!)
    raw_cands: list[tuple[str, str, int]] = []
    if " " in key or "-" in key:
        first_part = WORD_TOKEN_RE.findall(key)
        anchor = max(first_part, key=len) if first_part else ""
        for cand in word_examples_pool.get(anchor, []):
            if example_en_has_exact_headword(key, cand[0]):
                raw_cands.append(cand)
    else:
        for cand in word_examples_pool.get(key, []):
            if example_en_has_exact_headword(key, cand[0]):
                raw_cands.append(cand)

    best_pair: tuple[str, str] | None = None
    best_match_idx = 0
    best_score = -1

    for en_s, tr_s, tier in raw_cands:
        if has_synthetic_or_proper_name(en_s) or has_leading_weird_proper_noun(en_s):
            continue
        match_idx = -1
        if tr_meaning_matches_sentence(tr_s, [tr_list[0]]):
            score = 100
            match_idx = 0
        else:
            for idx_m in range(1, min(len(tr_list), 4)):
                if tr_meaning_matches_sentence(tr_s, [tr_list[idx_m]]):
                    score = 68 - idx_m * 3
                    match_idx = idx_m
                    break
        if match_idx < 0:
            # Sense mismatch (homonym/idiom/wrong POS): strictly reject!
            continue

        # Prefer modern (tier 0) > curated (tier 1) > Tatoeba (tier 2) and crisp 5-9 word length
        score += (2 - tier) * 14
        wc = len(en_s.split())
        if 5 <= wc <= 9:
            score += 6
        if score > best_score:
            best_score = score
            best_pair = (en_s, tr_s)
            best_match_idx = match_idx

    if best_pair:
        final_tr_list = list(tr_list)
        # If FreeDict put a rarer/archaic synonym first but real Turkish sentences use tr_list[match_idx],
        # promote that cleaner active sense to index 0 so acceptedTr[0] and exampleTr stay 100% aligned!
        if allow_promote_meaning and best_match_idx > 0 and best_match_idx < len(final_tr_list):
            promoted = final_tr_list.pop(best_match_idx)
            final_tr_list.insert(0, promoted)
        return best_pair[0], best_pair[1], final_tr_list
    en_fb, tr_fb = synthesize_fallback_example(word, pos, tr_list[0])
    return en_fb, tr_fb, tr_list


def normalize_level(raw: str) -> str:
    lvl = (raw or "B1").strip().upper()
    return lvl if lvl in {"A1", "A2", "B1", "B2", "C1", "C2"} else "B1"


def select_stratified_sentences(
    tatoeba_pairs: list[tuple[str, str]],
    target_total: int = 5500,
) -> list[dict[str, object]]:
    """Combine AI-curated sentences with grammar-targeted and level-balanced natural sentences."""
    sentence_cards: list[dict[str, object]] = []
    seen_en: set[str] = set()

    SENTENCE_TRANSLATION_OVERRIDES: dict[str, tuple[list[str], str | None]] = {
        "i'll have to wing it.": (
            [
                "Doğaçlama yapmam gerekecek.",
                "Hazırlıksız idare etmek zorunda kalacağım.",
                "O an doğaçlama halletmem gerekecek.",
            ],
            "B2",
        ),
    }

    def add_sentence(en_text: str, tr_text: str, lvl: str) -> None:
        clean_en = en_text.replace("\u200b", "").strip()
        clean_tr = tr_text.replace("\u200b", "").strip()
        key = clean_en.casefold()
        if not key or key in seen_en:
            return
        seen_en.add(key)
        override = SENTENCE_TRANSLATION_OVERRIDES.get(key)
        accepted_tr = list(override[0]) if override else [clean_tr]
        final_lvl = override[1] if (override and override[1]) else lvl
        idx = len(sentence_cards) + 1
        sentence_cards.append(
            {
                "id": f"s_{idx:04d}",
                "type": "sentence",
                "level": final_lvl,
                "pos": "sentence",
                "en": clean_en,
                "phonetic": "",
                "acceptedTr": accepted_tr,
                "exampleEn": "",
                "exampleTr": "",
                "source": "builtin",
            }
        )

    # 1. Add all AI-curated grammar & spoken English sentences first
    for en_text, tr_text, lvl in CURATED_SENTENCES:
        add_sentence(en_text, tr_text, lvl)

    # 2. Add up to 180 natural sentences per core grammar pattern so Concept Mastery never runs dry
    for _, pattern in GRAMMAR_TARGET_PATTERNS:
        matches = [p for p in tatoeba_pairs if pattern.search(p[0]) and p[0].casefold() not in seen_en]
        if not matches:
            continue
        quota = 180
        step = max(1, len(matches) // quota)
        for en_text, tr_text in matches[::step][:quota]:
            wc = len(en_text.split())
            lvl = "A1" if wc <= 4 else "A2" if wc <= 6 else "B1" if wc <= 9 else "B2"
            add_sentence(en_text, tr_text, lvl)

    # 3. Fill the remaining slots up to target_total evenly across length/CEFR bands
    remaining_needed = max(0, target_total - len(sentence_cards))
    if remaining_needed > 0:
        unused = [p for p in tatoeba_pairs if p[0].casefold() not in seen_en]
        step = max(1, len(unused) // remaining_needed) if len(unused) > remaining_needed else 1
        for en_text, tr_text in unused[::step][:remaining_needed]:
            wc = len(en_text.split())
            lvl = "A1" if wc <= 4 else "A2" if wc <= 6 else "B1" if wc <= 9 else "B2"
            add_sentence(en_text, tr_text, lvl)

    return sentence_cards


def build_cards() -> dict[str, object]:
    oxford_path = download_cached("Oxford 5000", URLS["oxford"])
    freedict_path = download_cached("FreeDict eng-tur", URLS["freedict"])
    links_path = download_cached("Tatoeba links", URLS["tatoeba_links"])
    tur_path = download_cached("Tatoeba tur", URLS["tatoeba_tur"])
    eng_path = download_cached("Tatoeba eng", URLS["tatoeba_eng"])

    freedict = parse_freedict(freedict_path)
    tatoeba_pairs, word_examples_pool = parse_tatoeba(links_path, tur_path, eng_path)

    raw_oxford = json.loads(oxford_path.read_text(encoding="utf-8"))
    oxford_entries = raw_oxford.values() if isinstance(raw_oxford, dict) else raw_oxford

    word_cards: list[dict[str, object]] = []
    seen_words: set[str] = set()
    rescued_from_curated = 0

    for entry in oxford_entries:
        word = str(entry.get("word", "")).strip()
        if not word:
            continue
        key = word.lower()
        if key in seen_words:
            continue

        pos = str(entry.get("type") or "noun").strip()
        if key in PRIMARY_WORD_OVERRIDES:
            tr_list = list(PRIMARY_WORD_OVERRIDES[key])
        else:
            raw_candidates = freedict.get(key, [])
            tr_list = rank_meanings_for_pos(raw_candidates, pos, "") if raw_candidates else []

        # Use AI-curated translations when FreeDict lacks the Oxford 5000 word
        if not tr_list and key in MISSING_OXFORD_TRANSLATIONS:
            tr_list = list(MISSING_OXFORD_TRANSLATIONS[key])
            rescued_from_curated += 1

        if not tr_list:
            continue
        seen_words.add(key)

        example_en, example_tr, tr_list = pick_sense_aligned_example(
            word,
            pos,
            tr_list,
            word_examples_pool,
            allow_promote_meaning=(key not in PRIMARY_WORD_OVERRIDES),
        )

        phonetic = str(entry.get("phon_br") or entry.get("phon_n_am") or "").strip()
        level = normalize_level(str(entry.get("cefr") or ""))

        word_cards.append(
            {
                "id": f"w_{re.sub(r'[^a-z0-9]+', '_', key).strip('_')}",
                "type": "word",
                "level": level,
                "pos": pos,
                "en": word,
                "phonetic": phonetic,
                "acceptedTr": tr_list,
                "exampleEn": example_en,
                "exampleTr": example_tr,
                "source": "builtin",
            }
        )

    # Add AI-curated Phrasal Verbs, Idioms, Collocations & Modern Vocabulary
    added_curated_phrases = 0
    for en_phrase, lvl, pos, tr_list, ex_en, ex_tr in CURATED_PHRASES_AND_VOCAB:
        key = en_phrase.strip().lower()
        if key in seen_words:
            # Enrich existing card with curated translations & example if already present
            for existing in word_cards:
                if str(existing["en"]).lower() == key:
                    merged_tr = list(dict.fromkeys([*tr_list, *existing["acceptedTr"]]))[:6]
                    existing["acceptedTr"] = merged_tr
                    existing["exampleEn"] = ex_en
                    existing["exampleTr"] = ex_tr
                    break
            continue

        seen_words.add(key)
        added_curated_phrases += 1
        word_cards.append(
            {
                "id": f"w_{re.sub(r'[^a-z0-9]+', '_', key).strip('_')}",
                "type": "word",
                "level": normalize_level(lvl),
                "pos": pos,
                "en": en_phrase.strip(),
                "phonetic": "",
                "acceptedTr": tr_list,
                "exampleEn": ex_en,
                "exampleTr": ex_tr,
                "source": "builtin",
            }
        )

    level_order = {"A1": 0, "A2": 1, "B1": 2, "B2": 3, "C1": 4, "C2": 5}
    word_cards.sort(key=lambda c: (level_order.get(str(c["level"]), 9), str(c["en"]).lower()))

    sentence_cards = select_stratified_sentences(tatoeba_pairs, target_total=5500)

    # Append modern, relatable, unit-tagged sentences with stable m_XXXX IDs
    # (never shifts existing w_* or s_XXXX IDs stored in user progressMap).
    seen_all_en = {str(c["en"]).strip().casefold() for c in sentence_cards}
    modern_cards: list[dict[str, object]] = []
    for idx, (en_text, tr_list, lvl, unit_id) in enumerate(MODERN_SENTENCES, start=1):
        clean_en = en_text.strip()
        key = clean_en.casefold()
        if not key or key in seen_all_en:
            continue
        seen_all_en.add(key)
        clean_tr = [t.strip() for t in tr_list if t.strip()]
        if not clean_tr:
            continue
        modern_cards.append(
            {
                "id": f"m_{idx:04d}",
                "type": "sentence",
                "level": normalize_level(lvl),
                "pos": "sentence",
                "en": clean_en,
                "phonetic": "",
                "acceptedTr": clean_tr,
                "exampleEn": "",
                "exampleTr": "",
                "source": "builtin",
                "unitId": unit_id,
            }
        )

    all_cards = word_cards + sentence_cards + modern_cards
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(all_cards, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    size_kb = OUT_FILE.stat().st_size / 1024
    print(
        f"[done] Rescued {rescued_from_curated} missing Oxford words + added {added_curated_phrases} new phrasal verbs/idioms/vocab.\n"
        f"[done] Wrote {len(word_cards)} words/phrases + {len(sentence_cards)} natural sentences + {len(modern_cards)} modern sentences "
        f"= {len(all_cards)} total cards to {OUT_FILE} ({size_kb:.1f} KB)"
    )
    return {
        "words": len(word_cards),
        "sentences": len(sentence_cards) + len(modern_cards),
        "modern": len(modern_cards),
        "total": len(all_cards),
    }


if __name__ == "__main__":
    build_cards()
