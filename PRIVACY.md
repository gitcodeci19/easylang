# LingoEx Privacy Policy / Gizlilik Politikası

**Last updated / Son güncelleme:** 2026-11-20

---

## English

### 1. Overview
**LingoEx** is a privacy-first Chrome extension for active-recall English learning. The developer does **not** operate any backend servers, analytics, telemetry, ads, or user tracking systems, and does **not** collect, sell, rent, or transfer personal user data.

### 2. Data Stored Locally in Your Browser
All user data stays inside your browser via Chrome's built-in `chrome.storage.local` and `chrome.storage.sync` APIs:
- Learning progress, spaced-repetition intervals, curriculum progress, and practice statistics
- Personal flashcard decks and mistake/weakness logs
- User preferences (CEFR level, reminder interval, excluded websites list, UI language)
- Optional user-supplied AI API keys (BYOK — Bring Your Own Key)

You can export, clear, or uninstall the extension at any time to remove this data from your browser.

### 3. External Network Requests (User-Initiated Only)
LingoEx does not send background browsing history anywhere. External requests occur **only** when triggered by explicit user actions:
- **Context Menu Translation (`api.mymemory.translated.net`):** When you right-click selected English text and choose *Add to deck*, only that selected word/phrase is sent to MyMemory to fetch candidate Turkish translations.
- **Optional AI Tutor & Grading (BYOK):** If you optionally configure your own API key (e.g., Groq, Google Gemini, NVIDIA, AMD TokenLab, or OpenRouter), only the current practice card/question and your answer are sent directly from your browser to the provider you chose.
- **Voice Model / Pronunciation:** If English neural voice model files are not already bundled locally, they may be fetched once from Hugging Face (`huggingface.co`). Opening pronunciation examples via YouGlish opens `youglish.com` in a tab at your click.

### 4. Browser Permissions
- `storage`: Saves learning progress, settings, deck cards, and optional API configuration locally/in Chrome sync.
- `alarms`: Schedules periodic recall prompts and snooze timers.
- `tabs` & `scripting`: Injects and controls the floating practice card and page-sentence challenge on non-excluded pages when active.
- `idle`: Delays scheduled prompts cleanly when the user is away from the keyboard.
- `contextMenus`: Adds selected text on a webpage to the user's deck via right-click.
- `offscreen`: Plays offline English audio and guided voiceovers in Manifest V3.
- Host permissions (`http://*/*`, `https://*/*`): Displays the in-page practice overlay on user-permitted sites and detects visible sentences only during an active page challenge.

### 5. Contact
For privacy questions or support, please open an issue at:  
https://github.com/gitcodeci19/easylang/issues

---

## Türkçe

### 1. Genel Bakış
**LingoEx**, aktif hatırlama yöntemiyle İngilizce öğrenmeye odaklanan bir Chrome eklentisidir. Geliştirici herhangi bir sunucu, analiz/telemetri aracı, reklam ağı veya kullanıcı takip sistemi **işletmez**; kişisel verileri **toplamaz, satmaz veya üçüncü taraflarla paylaşmaz**.

### 2. Tarayıcınızda Yerel Olarak Saklanan Veriler
Tüm kullanıcı verileri yalnızca kendi tarayıcınızda (`chrome.storage.local` ve `chrome.storage.sync`) tutulur:
- Öğrenme geçmişi, aralıklı tekrar aralıkları, ünite ilerlemesi ve istatistikler
- Kişisel kelime desteleri ve hata kayıtları
- Kullanıcı ayarları (seviye, hatırlatma sıklığı, hariç tutulan siteler, arayüz dili)
- İsteğe bağlı olarak kullanıcının kendi girdiği yapay zekâ API anahtarları

Bu verileri dilediğiniz zaman ayarlardan dışa aktarabilir, sıfırlayabilir veya eklentiyi kaldırarak tarayıcınızdan tamamen silebilirsiniz.

### 3. Harici Ağ İstekleri (Yalnızca Kullanıcı Tetiklediğinde)
LingoEx gezinme geçmişinizi arka planda hiçbir yere göndermez. Dış ağ istekleri **yalnızca** kullanıcı bir özelliği açıkça tetiklediğinde gerçekleşir:
- **Sağ Tık Çevirisi (`api.mymemory.translated.net`):** Bir sayfada seçtiğiniz kelimeye sağ tıklayıp *desteye ekle* dediğinizde yalnızca seçili metin Türkçe karşılık önerisi almak için gönderilir.
- **İsteğe Bağlı Yapay Zekâ Değerlendirmesi:** Kendi API anahtarınızı eklediğinizde (Groq, Google Gemini, NVIDIA, AMD TokenLab veya OpenRouter) yalnızca aktif pratik sorusu ve sizin yazdığınız cevap doğrudan seçtiğiniz sağlayıcıya iletilir.
- **Ses Modeli / Telaffuz:** Yerel pakette yoksa İngilizce ses modeli dosyası bir defaya mahsus Hugging Face (`huggingface.co`) üzerinden indirilebilir; YouGlish bağlantısı ise yalnızca tıkladığınızda yeni sekmede açılır.

### 4. İletişim
Gizlilik veya destek talepleri için:  
https://github.com/gitcodeci19/easylang/issues
