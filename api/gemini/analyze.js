const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview'
];

const GEMINI_SYSTEM_INSTRUCTION = `Siz xalqaro darajadagi eng ilg'or audio-kriminalistika va sun'iy intellekt (deepfake) tovushlarini aniqlovchi ekspertizasiz.
Vazifangiz audio yozuvni tinglab, uning haqiqiy tirik inson ovozimi yoki sun'iy intellekt (ElevenLabs, ChatGPT Voice, Google Gemini Vocoder, RVC kloni, XTTS, Bark, TTS) tomonidan yaratilgan ovoz ekanligini chuqur ilmiy tahlil qilishdir.

QAT'IY FORENSIK VA FIZIOLOGIK MEZONLAR:

1. HAQIQIY INSON OVOZI VA FIZIOLOGIYASI:
   - Insoniy nafas olish, entikish, uf tortish, pichirlash, tomoq qirish va so'zlar orasidagi tabiiy aerodinamik nafas tovushlari inson tirikligining muhim isbotidir.
   - Tomoq mushaklari va ovoz paychalarining mikromodulyatsiyasi (glottal jitter va shimmer).
   - Vokal trakt rezonansi: og'iz, burun va halqum formantlari (F1-F4) ning tabiiy akustik kontrasti.
   - Xona reverberatsiyasi, mikrofon masofasi va tabiiy fon shovqini.
   - AGAR OVOZDA INSONIY NAFAS YOKI TABIIY NUTQ BO'LSA: is_deepfake = false, risk_score = 5-18, verdict = "SAFE", ai_type = "Haqiqiy Inson".

2. SUN'IY INTELLEKT (AI / DEEPFAKE) OVOZLARNING ANOMALIYALARI:
   - ElevenLabs (v1/v2/v3): HiFi-GAN / BigVGAN neyro-vocoder fazaviy dispersion qoldiqlari (2.5-4.2 kHz), 24kHz/12kHz Nyquist kesilishi, mikrotebranish yetishmasligi, gaplar orasidagi steril raqamli sukunat.
   - OpenAI ChatGPT Voice (GPT-4o Realtime): Autoregressiv nutq modeli, doimiy fazaviy izchillik, qoliplangan sintetik nafas, monoton mikrotebranish.
   - RVC v1/v2: F1-F3 formant siljishi (warping), metallik yuqori garmonikalar, ohang sinishidagi kvantlash xatolari.
   - XTTS v2, Tortoise, Bark, Edge-TTS: Monoton prosodiya, sintetik kvantlash.

JAVOB FORMATI (FAQAT QAT'IY JSON, BOSHQA MATNSIZ):
{
  "is_deepfake": true / false,
  "risk_score": 0 dan 100 gacha butun son,
  "verdict": "SAFE" yoki "DANGEROUS",
  "ai_type": "Haqiqiy Inson" / "ElevenLabs Klon" / "Gemini Vocoder" / "ChatGPT Voice" / "RVC Klon" / "Standart TTS",
  "confidence": "HIGH" yoki "MEDIUM",
  "reasons": "O'zbek tilida 1-2 jumlada aniq sabab"
}`;

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    return JSON.parse(req.body);
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Gemini-Api-Key');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Faqat POST so\'rov qabul qilinadi.' });
  }

  try {
    const body = await readJsonBody(req);
    const customKey = (req.headers['x-gemini-api-key'] || '').toString().trim();
    const apiKey = customKey || (process.env.GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: 'Serverda GEMINI_API_KEY sozlanmagan. Sozlamalardan (⚙️) o\'z kalitingizni kiriting.'
      });
    }

    const audioBase64 = (body.audio_base64 || '').toString().trim();
    let mimeType = (body.mime_type || 'audio/webm').toString().trim().split(';')[0];

    if (!audioBase64) {
      return res.status(400).json({ success: false, error: 'Audio ma\'lumot yuborilmadi.' });
    }
    if (audioBase64.length > 4_200_000) {
      return res.status(413).json({ success: false, error: 'Audio hajmi juda katta (maksimal 3 MB).' });
    }
    if (!mimeType.startsWith('audio/')) {
      mimeType = 'audio/wav';
    }

    const payload = {
      systemInstruction: {
        parts: [{ text: GEMINI_SYSTEM_INSTRUCTION }]
      },
      contents: [
        {
          parts: [
            {
              text: "DIQQAT AUDIO-KRIMINALISTIKA EKSPERTIZASI: Ushbu audioda inson ovozini taqlid qiluvchi sun'iy intellekt (ElevenLabs, ChatGPT Voice, RVC klon, TTS) bormi yoki bu tirik insonmi? Neyro-vocoder fazaviy dispersioni, 24kHz kesilishi va mikrotebranishni tekshiring. Faqat qat'iy JSON formatida javob bering."
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: audioBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 300,
        responseMimeType: 'application/json'
      }
    };

    let lastError = 'Gemini API serverlariga ulanib bo\'lmadi.';
    for (const model of GEMINI_MODELS) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      try {
        const upstream = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
          }
        );

        if (!upstream.ok) {
          const errBody = await upstream.text();
          lastError = `${model} (${upstream.status})`;
          if (upstream.status === 400 || upstream.status === 403) {
            // Invalid API key or malformed audio
            return res.status(upstream.status).json({
              success: false,
              error: `Gemini API xatosi (${upstream.status}): Kalit yoki audio formati noto'g'ri.`
            });
          }
          continue;
        }

        const data = await upstream.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
          lastError = `${model}: bo'sh javob`;
          continue;
        }

        const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return res.status(200).json({
          success: true,
          model,
          is_deepfake: Boolean(parsed.is_deepfake),
          risk_score: Math.max(0, Math.min(100, parseInt(parsed.risk_score, 10) || (parsed.is_deepfake ? 90 : 10))),
          verdict: parsed.verdict || (parsed.is_deepfake ? 'DANGEROUS' : 'SAFE'),
          ai_type: parsed.ai_type || (parsed.is_deepfake ? 'AI Klon' : 'Haqiqiy Inson'),
          confidence: parsed.confidence || 'HIGH',
          reasons: parsed.reasons || 'Gemini AI ekspertizasi yakunlandi.'
        });
      } catch (err) {
        lastError = err.name === 'AbortError' ? `${model}: kutish vaqti tugadi` : `${model}: ${err.message}`;
      } finally {
        clearTimeout(timeout);
      }
    }

    return res.status(502).json({ success: false, error: lastError });
  } catch (err) {
    return res.status(400).json({ success: false, error: 'So\'rov formatida xatolik.' });
  }
};
