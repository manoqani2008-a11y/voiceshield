# 🛡️ VoiceShield - Real-Time AI Deepfake Voice Protection

**VoiceShield** — telefon qo'ng'irog'i davomida suhbatdoshning ovozi sun'iy intellekt (ElevenLabs, VALL-E, Bark, TTS) tomonidan klonlanganligini real vaqtda aniqlovchi va moliyaviy firibgarliklarning oldini oluvchi kiberxavfsizlik tizimi.

---

## 📁 Loyiha tuzilishi

```text
nmadr/
├── index.html                 # Asosiy interfeys (Smartfon UI + Boshqaruv paneli)
├── style.css                  # Zamonaviy kibersavfsizlik dizayni (Dark mode, to'lqinlar)
├── app.js                     # Web Audio API (Mikrofon, DSP algoritmi, WebSocket)
├── run_app.bat                # 1-klikda ilovani brauzerda ishga tushirish
├── start_backend.bat          # Python serverni ishga tushirish (FastAPI + WebSockets)
└── backend/
    ├── main.py                # FastAPI server va WebSocket audio qabul qiluvchi
    ├── detector.py            # Akustik tahlil va AI deepfake klassifikatori
    └── requirements.txt       # Python kutubxonalari
```

---

## ⚡ Qanday ishga tushiriladi?

### 1-usul: Darhol brauzerda sinash (Hech qanday o'rnatishsiz)
1. Jilddagi **`run_app.bat`** faylini ikki marta bosing (yoki `index.html` faylini Google Chrome / Edge / Opera da oching).
2. Brauzer mikrofonga ruxsat so'raganda **"Ruxsat berish"** (Allow) tugmasini bosing.
3. Ekranda **"Javob"** tugmasini bosing va gapiring:
   - Haqiqiy ovozingiz tahlil qilinadi, to'lqin chiziladi va xavf darajasi yashil (xavfsiz) ko'rinadi.
   - Chap paneldagi **"Simulyatsiya: Deepfake"** rejimiga o'tsangiz, tizim qizil ogohlantirish beradi va **"Ikkinchi kanal orqali tasdiqlash"** oynasi ochiladi!

### 2-usul: Python AI Backend bilan ishga tushirish
1. Kompyuteringizda Python o'rnatilgan bo'lsa, **`start_backend.bat`** faylini ishga tushiring.
2. Server `http://localhost:8000` manzilida ishga tushadi va audio oqimini WebSocket orqali qabul qila boshlaydi.

---

## 🔬 Deepfake qanday aniqlanadi? (Akustik parametrlar)

1. **Spektral Tekislik (Spectral Flatness / SFM):**
   - Zamonaviy neyrotarmoq vocoderlari (HiFi-GAN, MelGAN) inson ovoz paychalaridek tabiiy nafas va garmonikani to'liq takrorlay olmaydi. Spektrda xarakterli tekis sintetik qoldiq hosil bo'ladi.
2. **Pitch Monotonligi (Asosiy ton):**
   - Sun'iy sintez qilingan ovozlarda insonning tabiiy mikrotebranishlari (micro-jitter) kam bo'lib, ovoz g'ayritabiiy silliq yoki monoton bo'ladi.
3. **Yuqori chastota kesilishi (Cutoff):**
   - Ko'plab TTS modellari audioni 16kHz yoki 22kHz chastotada yaratadi, natijada yuqori garmonikalar keskin uzilib qoladi.

---

## 🔐 2-Kanal orqali tasdiqlash qanday ishlaydi?
Agar qo'ng'iroqdagi AI ehtimoli 70% dan oshsa:
1. Ilova rahbarning kontaktlardagi haqiqiy raqamiga (SMS yoki Telegram orqali) 4 xonali bir martalik maxfiy kod jo'natadi.
2. Xodim suhbatdoshdan: *"Menga SMS orqali borgan tasdiq kodini ayting"* deb so'raydi.
3. Klonlangan ovoz orqasidagi firibgar bu kodni ko'ra olmagani sababli firibgarlik darhol fosh bo'ladi!
