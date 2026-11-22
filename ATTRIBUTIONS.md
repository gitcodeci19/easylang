# Data Sources & Attributions

The built-in English–Turkish flashcard deck (`public/data/cards.json`, 10,968 cards total — including 328 modern everyday sentences) is compiled from the following open-source projects:

1. **Tatoeba Project** (`https://tatoeba.org`)
   - English–Turkish sentence pairs and contextual examples extracted from Tatoeba exports.
   - License: **CC BY 2.0 FR** / **CC0 1.0** (attributed to Tatoeba contributors).

2. **FreeDict (`eng-tur`)** (`https://freedict.org`, `https://github.com/freedict/fd-dictionaries`)
   - English–Turkish dictionary definitions.
   - License: **GNU General Public License v2.0 or later (GPL-2.0+)**.

3. **Oxford 5000 CEFR JSON** (`https://github.com/winterdl/oxford-5000-vocabulary-audio-definition`)
   - CEFR proficiency levels (`A1`–`C1`), parts of speech, and IPA phonetic transcriptions.

4. **MyMemory Translation API** (`https://mymemory.translated.net`)
   - Used optionally only when you right-click highlighted English text on a webpage and add it to your custom deck without AI translation enabled.

5. **mesm-tts (`Heart` v2g & PDN WebAssembly engine)** (`https://huggingface.co/mesmertech/mesm-tts`)
   - Offline English neural voice (`public/tts/mesm_heart_v2g.pdn` + `public/tts/mesm_pdn.wasm`), distilled from **Kokoro-82M** (`hexgrad/Kokoro-82M`) and **Paradee-8M v1.1** (`sahilmahendrakar/Paradee-8M-v1.1`).
   - Pure-JS American-English Misaki G2P (`src/shared/misakiG2p.ts`) and compressed lexicons (`public/tts/us_gold.fc.txt.gz`, `public/tts/us_silver.fc.txt.gz`), adapted from `hexgrad/misaki` and `mesmertech/mesm-tts`.
   - License: **Apache License 2.0**.

6. **EMA Lightning (Turkish 48 kHz Neural TTS)** (`https://huggingface.co/canberkkkkkk/ema-lightning`)
   - Offline Turkish grammar coach voice (`public/tts/ema/`, per-channel `int8`-packed ONNX weights).
   - License: **Apache License 2.0**.

7. **ONNX Runtime Web** (`https://github.com/microsoft/onnxruntime`)
   - Browser WebAssembly SIMD inference runtime (`ort-wasm-simd.wasm`) used for EMA Lightning.
   - License: **MIT License**.
