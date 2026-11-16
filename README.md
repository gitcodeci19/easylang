**Dil / Language:** 🇹🇷 **Türkçe** · [🇬🇧 English](README.en.md)

# ⚡ EasyLang - Yapay Zeka Destekli

**Tarayıcıda gezinirken ücretsiz yapay zeka desteğiyle İngilizce öğren — sadece ezber değil, hatanı anlayan ve seni adım adım geliştiren akıllı öğrenme.**

EasyLang; Chrome, Edge ve Brave tarayıcılarında çalışan, **yapay zeka destekli gelişim** odaklı bir dil öğrenme eklentisidir. Ek bir uygulamaya girmeden, günlük internette gezinirken karşına çıkan sorularla seviyeni adım adım yukarı taşır.

<p align="center">
  <img src="docs/screenshots/01-popup-roadmap.png" alt="EasyLang Ana Menü ve Öğrenme Yolu" width="440" />
</p>

---

## 🤖 Neden Yapay Zeka Destekli Gelişim?

Klasik kelime kartları sadece "doğru" ya da "yanlış" der ve aynı cevabı ezberlemeni bekler. EasyLang'de ise yapay zeka seni gerçek bir öğretmen gibi takip eder:

- **Kelimeyi değil, anlamı ölçer:** Farklı ama doğru bir kelime kullandığında cevabını reddetmez, kabul eder ve neden doğru olduğunu sade bir dille açıklar.
- **Zayıf noktalarını otomatik yakalar:** Cümle içindeki küçük zaman veya anlam hatalarını fark eder, o konuyu çalışma listene ekler ve birkaç soru sonra tekrar sorarak hatanı kalıcı olarak düzeltir.
- **Sana özel AI Çalışma Koçu:** Şimdiye kadarki tüm doğrularını ve zorlandığın konuları inceleyip neye çalışman gerektiğini söyler.
- **Kotayı boşa harcamaz:** Birebir doğru yazdığın cevapları internet veya API kullanmadan cihazında anında onaylar; yapay zekayı yalnızca gerçekten gerektiğinde devreye sokar.

---

## 👀 Nasıl Çalışır?

### 1. Öğrenme Yolu ve Günlük Pratik
Eklenti simgesine tıklayıp konulara bölünmüş derslerden devam edebilir veya alttaki butonlarla **Şimdi Sor**, **Challenge** ve **Dinle & Yaz** modlarını hemen açabilirsin.

- Başlangıç seviyesindeysen (`A1–A2`), önce temeli sağlamlaştırman için zorluk otomatik dengelenir; seviyen yükseldikçe bir üst aşamaya geçmek isteyip istemediğin sana sorulur.

---

### 2. Gezdiğin Sayfada Canlı Çeviri (`Challenge`)
Okuduğun bir haber, forum veya blog sayfasını tek tıkla alıştırmaya dönüştür:

1. Menüden **Challenge** butonuna tıkla *(veya `Alt+Shift+P`)*.
2. Eklenti sayfadan doğal bir cümle seçip sarıyla işaretler; ok işaretiyle seni doğrudan cevap kutusuna yönlendirir.
3. Çevirini yaz, yapay zeka anında değerlendirsin.

<p align="center">
  <img src="docs/screenshots/02-challenge-mode.png" alt="Web Sayfasında Challenge Modu" width="760" />
</p>

---

### 3. Akıllı Geri Bildirim ve Otomatik Hata Takibi
EasyLang hem hızı hem de derin öğrenmeyi bir arada sunar:

| Anında Kontrol *(API Harcamaz)* | Anlama Göre AI Onayı | AI Dilbilgisi ve Odak Takibi |
| :---: | :---: | :---: |
| <img src="docs/screenshots/03-offline-exact-match.png" alt="Cihaz içi hızlı doğru kontrolü" width="270" /> | <img src="docs/screenshots/04-ai-semantic-feedback.png" alt="Yapay zekanın eş anlamlı cevabı kabul etmesi" width="270" /> | <img src="docs/screenshots/05-ai-grammar-focus.png" alt="Yapay zekanın hatayı yakalayıp odak listesine eklemesi" width="270" /> |
| Doğru bildiğin standart cevapları kotan hiç eksilmeden anında onaylar. | Sözlükten farklı ama doğru bir ifade yazdığında *(ör. "peron" yerine "reyon")* cevabını kabul eder. | İnce anlam farkını yakalar, nedenini açıklar ve o kuralı birkaç soru sonra tekrar test eder. |

---

### 4. Gelişim Paneli ve AI Çalışma Koçu (`Gelişimim`)
Hangi seviyede olduğunu, doğruluk oranını, hangi konu ve kelime türlerinde güçlü veya zayıf olduğunu tek ekranda gör. Alttaki **AI Çalışma Koçu** ile tek tıkla kişisel gelişim tavsiyesi al.

<p align="center">
  <img src="docs/screenshots/06-progress-analytics.png" alt="Gelişimim ve AI Çalışma Koçu" width="760" />
</p>

---

### 5. Ücretsiz Yapay Zeka Kurulumu (`AI - API Ayarları`)
Kendi ücretsiz yapay zeka anahtarını eklemek 1 dakikanı alır. Arayüz içindeki rehber sana sırasıyla hangi siteye girip anahtar alacağını tek tek anlatır:

- **Groq** — *⭐ Önerilen (Çok Hızlı & Zeki)*
- **NVIDIA NIM** — *🧠 Yavaş ama Daha Akıllı*
- **AMD TokenLab** — *⚖️ Yavaş / İyi Yedek*

İstersen **Ana API** yanına **Yedek API** de ekleyebilirsin; biri limitine takılırsa eklenti kesintisiz şekilde diğerine geçer.

<p align="center">
  <img src="docs/screenshots/07-ai-api-setup.png" alt="Ücretsiz AI API Ayarları" width="760" />
</p>

---

## ✨ Diğer Kolaylıklar

- **Dinle & Yaz (`Alt+Shift+L`):** İngilizce cümleyi normal veya yavaş hızda dinleyip yazarak kulak ve yazım pratiği yap.
- **Unuttuklarını Tam Zamanında Hatırlatır:** Yanlış yaptığın kartlar 20 dakika sonra tekrar gelir; öğrendikçe aralığı uzar.
- **Site Engelleme:** Banka, sınav veya iş sitelerinde eklentiyi tek tıkla kapatabilirsin.
- **12 Dil Desteği:** İlk kurulumda tarayıcı dilini otomatik tanır; arayüz ve AI açıklamaları Türkçe dahil 12 dilde çalışır.
- **Kendi Kelimelerini Ekle & Yedekle:** Ayarlar bölümünden kendi kelime ve cümlelerini ekleyebilir, ilerlemeni tek dosyayla yedekleyebilirsin *(API anahtarların güvenlik için yedeğe dahil edilmez)*.

---

## 📦 Kurulum (Chrome / Edge / Brave)

1. Projeyi bilgisayarına indir, kur ve derle:
   ```bash
   npm install
   npm run build
   ```
2. Tarayıcıda `chrome://extensions` *(veya Edge için `edge://extensions`)* adresini aç.
3. Sağ üstten **Geliştirici modu**nu aç.
4. **Paketlenmemiş öğe yükle** butonuna bas ve oluşan `dist` klasörünü seç.

---

## 🔒 Gizlilik

- Bu depoda hiçbir kişisel bilgi, takip aracı veya gömülü API anahtarı bulunmaz.
- API anahtarların ve tüm ilerlemen yalnızca kendi tarayıcında saklanır; sadece senin tanımladığın AI servisiyle paylaşılır.

<details>
<summary>🛠 Geliştirici Komutları & Veri Kaynakları</summary>

```bash
npm run typecheck   # TypeScript kontrolü
npm test            # Birim testleri (42 test)
npm run build       # dist/ klasörünü oluştur
npm run watch       # Değişikliklerde otomatik derle
```

*(İsteğe bağlı)* Kart veri setini yeniden oluşturmak için:

```bash
npm run build:data
npm run build
```

Açık kaynak kelime ve cümle kaynakları için [ATTRIBUTIONS.md](ATTRIBUTIONS.md) dosyasına bakabilirsin.

</details>
