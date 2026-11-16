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
    MISSING_OXFORD_TRANSLATIONS,
)

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
)

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


def clean_tr_gloss(raw: str) -> list[tuple[str, bool]]:
    """Normalize a FreeDict Turkish translation into (clean_text, is_domain_tagged) pairs."""
    text = raw.strip()
    if not text:
        return []
    lowered = text.lower()
    if any(pat in lowered for pat in NOISY_TR_PATTERNS):
        return []

    is_domain = bool(DOMAIN_TAG_RE.match(text))
    text = TAG_PREFIX_RE.sub("", text).strip()
    text = BRACKET_NOTE_RE.sub("", text).strip()

    if "(" in text or ")" in text:
        return []

    sub_match = SUBENTRY_SPLIT_RE.search(text)
    if sub_match:
        text = text[: sub_match.start()].strip()

    text = PUNCT_END_RE.sub("", text).strip()
    if not text or ":" in text or "." in text:
        return []

    parts = [MULTISPACE_RE.sub(" ", p).strip() for p in re.split(r"[,;/]", text)]
    results: list[tuple[str, bool]] = []
    for part in parts:
        part = PUNCT_END_RE.sub("", part).strip()
        if not part:
            continue
        word_count = len(part.split())
        if word_count > 4 or len(part) > 40 or len(part) < 2:
            continue
        if re.search(r"\b(the|and|with|from|into|somebody|something|one's)\b", part.lower()):
            continue
        results.append((part, is_domain))
    return results


def parse_freedict(tei_path: Path) -> dict[str, list[tuple[str, bool]]]:
    """Parse FreeDict eng-tur.tei into {english_headword_lower: [(tr_meaning, is_domain), ...]}."""
    print("[parse] FreeDict eng-tur.tei...")
    ns = {"tei": "http://www.tei-c.org/ns/1.0"}
    tree = ET.parse(tei_path)
    root = tree.getroot()

    translations: dict[str, list[tuple[str, bool]]] = defaultdict(list)
    seen_per_word: dict[str, set[str]] = defaultdict(set)

    for entry in root.findall(".//tei:entry", ns):
        orth_el = entry.find("./tei:form/tei:orth", ns)
        if orth_el is None or not orth_el.text:
            continue
        headword = MULTISPACE_RE.sub(" ", orth_el.text.strip().lower())
        if not headword or len(headword) > 40:
            continue

        for quote_el in entry.findall(".//tei:sense/tei:cit[@type='trans']/tei:quote", ns):
            if not quote_el.text:
                continue
            for candidate, is_domain in clean_tr_gloss(quote_el.text):
                key = candidate.casefold()
                if key not in seen_per_word[headword]:
                    seen_per_word[headword].add(key)
                    translations[headword].append((candidate, is_domain))

    print(f"[parse] FreeDict headwords with clean Turkish meanings: {len(translations)}")
    return dict(translations)


def rank_meanings_for_pos(candidates: list[tuple[str, bool]], pos: str) -> list[str]:
    """Prioritize non-jargon, POS-consistent, concise Turkish meanings."""
    pos_lower = pos.lower()
    wants_verb = "verb" in pos_lower and "adverb" not in pos_lower

    def is_tr_infinitive(text: str) -> bool:
        last = text.split()[-1].casefold()
        return last.endswith(("mak", "mek"))

    def sort_key(item: tuple[int, tuple[str, bool]]) -> tuple[int, int, int, int]:
        idx, (text, is_domain) = item
        inf = is_tr_infinitive(text)
        pos_mismatch = 1 if (wants_verb != inf) else 0
        return (1 if is_domain else 0, pos_mismatch, len(text.split()), idx)

    ranked = sorted(enumerate(candidates), key=sort_key)
    return [text for _, (text, _) in ranked][:6]


def parse_tatoeba(
    links_path: Path, tur_path: Path, eng_path: Path
) -> tuple[list[tuple[str, str]], dict[str, tuple[str, str]]]:
    """Load proper-noun-free English-Turkish Tatoeba sentence pairs and build a word->example index."""
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
    word_examples: dict[str, tuple[str, str]] = {}

    # Seed word_examples with our AI-curated sentences first for maximum quality
    for en_cur, tr_cur, _ in CURATED_SENTENCES:
        for tok in WORD_TOKEN_RE.findall(en_cur.casefold()):
            if tok not in word_examples:
                word_examples[tok] = (en_cur, tr_cur)

    for tur_id, eng_ids in tur_to_eng.items():
        tr_text = tur_sentences.get(tur_id)
        if not tr_text:
            continue
        for eng_id in eng_ids[:1]:
            en_text = eng_sentences.get(eng_id)
            if not en_text:
                continue
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

            if 4 <= len(en_words) <= 9:
                for tok in WORD_TOKEN_RE.findall(norm_en):
                    if tok not in word_examples:
                        word_examples[tok] = (en_text, tr_text)
                        # Also index simple stem variants so inflected examples help base headwords
                        if tok.endswith("s") and len(tok) > 4 and tok[:-1] not in word_examples:
                            word_examples[tok[:-1]] = (en_text, tr_text)
                        if tok.endswith("ed") and len(tok) > 5 and tok[:-2] not in word_examples:
                            word_examples[tok[:-2]] = (en_text, tr_text)
                        if tok.endswith("ing") and len(tok) > 6 and tok[:-3] not in word_examples:
                            word_examples[tok[:-3]] = (en_text, tr_text)
            break

    pairs.sort(key=lambda p: (len(p[0].split()), len(p[0])))
    print(f"[parse] Clean proper-noun-free Tatoeba EN-TR sentence pairs: {len(pairs)}")
    return pairs, word_examples


def synthesize_fallback_example(word: str, pos: str, tr_meaning: str) -> tuple[str, str]:
    """Generate a clean, natural bilingual example when a rare or compound headword has no corpus match."""
    pos_low = pos.lower()
    w = word.strip()
    tr = tr_meaning.strip()
    if "adverb" in pos_low:
        return (
            f"The team handled the entire situation {w}.",
            f"Ekip tüm durumu {tr} ele aldı.",
        )
    if "adjective" in pos_low:
        return (
            f"This approach proved to be very {w} in practice.",
            f"Bu yaklaşımın pratikte çok {tr} olduğu kanıtlandı.",
        )
    if "verb" in pos_low:
        clean_tr_stem = re.sub(r"(mak|mek)$", "", tr).strip()
        return (
            f"We need to {w} this carefully before making a decision.",
            f"Karar vermeden önce bunu dikkatlice {clean_tr_stem}memiz gerekiyor.",
        )
    return (
        f"Understanding the concept of {w} is essential in this field.",
        f"Bu alanda {tr} kavramını anlamak çok önemlidir.",
    )


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

    def add_sentence(en_text: str, tr_text: str, lvl: str) -> None:
        key = en_text.strip().casefold()
        if not key or key in seen_en:
            return
        seen_en.add(key)
        idx = len(sentence_cards) + 1
        sentence_cards.append(
            {
                "id": f"s_{idx:04d}",
                "type": "sentence",
                "level": lvl,
                "pos": "sentence",
                "en": en_text.strip(),
                "phonetic": "",
                "acceptedTr": [tr_text.strip()],
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
    tatoeba_pairs, word_examples = parse_tatoeba(links_path, tur_path, eng_path)

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
        raw_candidates = freedict.get(key, [])
        tr_list = rank_meanings_for_pos(raw_candidates, pos) if raw_candidates else []

        # Use AI-curated translations when FreeDict lacks the Oxford 5000 word
        if not tr_list and key in MISSING_OXFORD_TRANSLATIONS:
            tr_list = list(MISSING_OXFORD_TRANSLATIONS[key])
            rescued_from_curated += 1

        if not tr_list:
            continue
        seen_words.add(key)

        ex_pair = word_examples.get(key)
        if not ex_pair:
            # Try first token for multi-word headwords like 'according to', 'used to'
            for part_tok in WORD_TOKEN_RE.findall(key):
                if len(part_tok) >= 4 and part_tok in word_examples:
                    ex_pair = word_examples[part_tok]
                    break

        if ex_pair and not has_synthetic_or_proper_name(ex_pair[0]):
            example_en, example_tr = ex_pair
        else:
            example_en, example_tr = synthesize_fallback_example(word, pos, tr_list[0])

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

    all_cards = word_cards + sentence_cards
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(all_cards, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    size_kb = OUT_FILE.stat().st_size / 1024
    print(
        f"[done] Rescued {rescued_from_curated} missing Oxford words + added {added_curated_phrases} new phrasal verbs/idioms/vocab.\n"
        f"[done] Wrote {len(word_cards)} words/phrases + {len(sentence_cards)} natural sentences "
        f"= {len(all_cards)} total cards to {OUT_FILE} ({size_kb:.1f} KB)"
    )
    return {"words": len(word_cards), "sentences": len(sentence_cards), "total": len(all_cards)}


if __name__ == "__main__":
    build_cards()
