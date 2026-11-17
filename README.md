# Yapay Zeka Destekli Dil Öğrenme Tarayıcı Eklentisi

### EKLENTİ NELER YAPABİLİYOR?

- Tarayıcınızda herhangi bir sekmede Duolingo benzeri İngilizce dersleri yapabilirsiniz.
- Yapay Zeka her hatanızı not eder ve özellikle sadece eksiklerinizi gidecerek şekilde dersler işlemeye başlar
- Web tarayıcınız açık olduğu sürece her 20 dakika da bir sizi soru çözmeye teşvik eder.

---

<p align="center">
  <img src="docs/gifs/01-auto-exposure-ai.gif" alt="Her 20 dakikada otomatik soru çıkaran ve anlamı yakalayan EasyLang AI kartı" width="820" />
</p>

<p align="center">
  <img src="docs/gifs/02-mistake-focus-loop.gif" alt="YouTube izlerken hatayı yakalayıp AI açıklaması sunan ve odak listesine alan EasyLang kartı" width="820" />
</p>

https://github.com/user-attachments/assets/8c34cede-0d40-493f-ba9c-981a12020011

---

### 📦 Nasıl Kurulur? (Chrome / Edge / Brave)

1. **[Releases](https://github.com/gitcodeci19/easylang/releases/latest)** sayfasından hazır `EasyLang-v1.0.0.zip` dosyasını indir ve bir klasöre çıkart.
2. Tarayıcıda `chrome://extensions` aç, sağ üstten **Geliştirici modu**nu aç.
3. **Paketlenmemiş öğe yükle** de ve çıkarttığın klasörü seç.

<details>
<summary>Kaynak Koddan Derleme & Gizlilik</summary>

```bash
npm install
npm run build
```

- Tüm bilgilerin ve API anahtarın sadece kendi tarayıcında kalır.
- Veri kaynakları: [ATTRIBUTIONS.md](ATTRIBUTIONS.md)

</details>
