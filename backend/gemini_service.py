"""
VoiceShield - Google Gemini Multimodal Audio Forensics Integration
Haqiqiy audio oqimini Google Gemini API ga uzatib,
audioning sun'iy neyrotarmoq (TTS, Voice Clone, ElevenLabs, ChatGPT, RVC) yoki inson ovozi ekanligini
chuqur kriminalistik tahlil qiladi.
"""

import os
import json
import base64
import urllib.request
import urllib.error
from typing import Dict, Any

GEMINI_MODELS = [
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
]


def get_configured_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if key:
        return key

    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("GEMINI_API_KEY="):
                        val = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if val:
                            return val
        except Exception:
            pass
    return ""


def set_gemini_api_key(key: str) -> bool:
    key = (key or "").strip()
    if not key:
        return False
    os.environ["GEMINI_API_KEY"] = key
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    try:
        with open(env_path, "w", encoding="utf-8") as f:
            f.write(f"GEMINI_API_KEY={key}\n")
        return True
    except Exception:
        return False


def analyze_audio_with_gemini(audio_bytes: bytes, mime_type: str = "audio/wav", api_key: str = "") -> Dict[str, Any]:
    key = (api_key or "").strip() or get_configured_api_key()
    if not key:
        return {
            "success": False,
            "error": "Gemini API kaliti kiritilmagan. Iltimos, .env yoki sozlamalar orqali API kalitni kiriting.",
            "is_deepfake": False,
            "risk_score": 0,
        }

    clean_mime = (mime_type or "audio/wav").split(";")[0].strip()
    if not clean_mime.startswith("audio/"):
        clean_mime = "audio/wav"

    b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
    prompt = (
        "Siz xalqaro darajadagi audio-kriminalistika va sun'iy intellekt (deepfake) ovozlarini tahlil qiluvchi mutaxassissiz. "
        "Ushbu audio yozuvni eshiting va aniqlang: bu haqiqiy tirik inson ovozimi (nafas, entikish, glottal mikrotebranish) "
        "yoki sun'iy intellekt (ElevenLabs HiFi-GAN, ChatGPT Voice, Gemini Vocoder, RVC klon, XTTS) tomonidan yaratilgan ovozmi?\n"
        "Faqat quyidagi JSON formatida javob bering:\n"
        "{\n"
        '  "is_deepfake": true/false,\n'
        '  "risk_score": 0-100 oralig\'ida butun son,\n'
        '  "verdict": "DANGEROUS" yoki "SAFE",\n'
        '  "ai_type": "Haqiqiy Inson" / "ElevenLabs Klon" / "ChatGPT Voice" / "RVC Klon" / "Standart TTS",\n'
        '  "confidence": "HIGH" yoki "MEDIUM",\n'
        '  "reasons": "O\'zbek tilida 1-2 jumlada aniq sababi"\n'
        "}"
    )

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": clean_mime,
                            "data": b64_audio,
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 300,
            "responseMimeType": "application/json",
        },
    }

    last_err = "Gemini API serverlariga ulanib bo'lmadi."
    for model in GEMINI_MODELS:
        req_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        req = urllib.request.Request(
            req_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=12) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                raw_text = resp_data["candidates"][0]["content"]["parts"][0]["text"]
                clean_json = raw_text.replace("```json", "").replace("```", "").strip()
                parsed = json.loads(clean_json)
                is_df = bool(parsed.get("is_deepfake", False))
                return {
                    "success": True,
                    "model": model,
                    "is_deepfake": is_df,
                    "risk_score": int(parsed.get("risk_score", 90 if is_df else 10)),
                    "verdict": parsed.get("verdict", "DANGEROUS" if is_df else "SAFE"),
                    "ai_type": parsed.get("ai_type", "AI Klon" if is_df else "Haqiqiy Inson"),
                    "confidence": parsed.get("confidence", "HIGH"),
                    "reasons": parsed.get("reasons", "Gemini tahlili yakunlandi."),
                }
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8", errors="ignore")
            last_err = f"{model} ({e.code}): {err_msg[:120]}"
            if e.code in (400, 403):
                return {
                    "success": False,
                    "error": f"Gemini API xatosi ({e.code}): Kalit yoki audio formati noto'g'ri.",
                }
        except Exception as e:
            last_err = f"{model}: {str(e)}"

    return {"success": False, "error": f"Ulanishda xatolik: {last_err}"}
