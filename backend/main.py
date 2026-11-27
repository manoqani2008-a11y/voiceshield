import os
import sys
import json
import base64
import random
from collections import deque

# Backend papkasini doimo sys.path ga qo'shish
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

try:
    from detector import AudioDeepfakeDetector
except ImportError:
    from backend.detector import AudioDeepfakeDetector

try:
    from gemini_service import get_configured_api_key, set_gemini_api_key, analyze_audio_with_gemini
except ImportError:
    from backend.gemini_service import get_configured_api_key, set_gemini_api_key, analyze_audio_with_gemini

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="VoiceShield AI API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


detector = AudioDeepfakeDetector()

active_otps = {}
incident_logs = deque(maxlen=500)


class VerifyRequest(BaseModel):
    phone_number: str


class ValidateCodeRequest(BaseModel):
    phone_number: str
    code: str


class IncidentReport(BaseModel):
    caller_number: str
    call_duration: str
    max_risk_score: int
    notes: str


class SetApiKeyRequest(BaseModel):
    api_key: str


@app.get("/api/gemini/status")
def gemini_api_status():
    key = get_configured_api_key()
    return {
        "has_key": bool(key),
        "masked_key": f"{key[:6]}...{key[-4:]}" if len(key) > 10 else ("Bor" if key else None)
    }


@app.post("/api/gemini/set-key")
def gemini_set_key(req: SetApiKeyRequest, request: Request):
    # Faqat lokal ulanish yoki maxsus ADMIN_SECRET bilan kalitni yangilashga ruxsat
    client_host = request.client.host if request.client else ""
    admin_secret = os.environ.get("VOICESHIELD_ADMIN_SECRET", "")
    provided_secret = request.headers.get("x-admin-secret", "")
    is_local = client_host in ("127.0.0.1", "::1", "localhost")
    if not is_local and (not admin_secret or provided_secret != admin_secret):
        raise HTTPException(status_code=403, detail="Ruxsat etilmagan: kalitni faqat lokal muhitda o'zgartirish mumkin.")

    ok = set_gemini_api_key(req.api_key)
    return {
        "success": ok,
        "message": "Gemini API kaliti muvaffaqiyatli saqlandi!" if ok else "Kalitni saqlashda xatolik."
    }


@app.post("/api/gemini/analyze")
async def gemini_analyze_audio(request: Request, file: UploadFile = File(None)):
    custom_key = (request.headers.get("x-gemini-api-key") or "").strip()

    if file is not None:
        file_bytes = await file.read()
        if len(file_bytes) > 5 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Fayl hajmi 5 MB dan oshmasligi kerak.")
        content_type = file.content_type or "audio/wav"
        return analyze_audio_with_gemini(file_bytes, mime_type=content_type, api_key=custom_key)

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Audio fayl yoki JSON yuborilmadi.")

    b64_audio = (body.get("audio_base64") or "").strip()
    if not b64_audio:
        raise HTTPException(status_code=400, detail="Audio ma'lumot bo'sh.")
    if len(b64_audio) > 4_500_000:
        raise HTTPException(status_code=413, detail="Audio hajmi juda katta.")

    mime_type = (body.get("mime_type") or "audio/webm").split(";")[0].strip()
    try:
        audio_bytes = base64.b64decode(b64_audio)
    except Exception:
        raise HTTPException(status_code=400, detail="Noto'g'ri Base64 audio.")

    return analyze_audio_with_gemini(audio_bytes, mime_type=mime_type, api_key=custom_key)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "VoiceShield AI Engine", "websocket": True, "version": "1.1.0"}


@app.post("/api/analyze-audio-file")
async def analyze_audio_file(file: UploadFile = File(...)):
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Fayl hajmi 10 MB dan katta.")
    return detector.analyze_audio_bytes(file_bytes, filename=file.filename or "audio.wav")


@app.post("/api/verify/send-code")
def send_verification_code(req: VerifyRequest):
    if len(active_otps) > 1000:
        active_otps.clear()
    code = str(random.randint(1000, 9999))
    active_otps[req.phone_number] = code
    print(f"[SMS Gateway] {req.phone_number} raqamiga tasdiq kodi yuborildi.")
    res = {
        "success": True,
        "message": f"Tasdiqlash kodi {req.phone_number} raqamiga muvaffaqiyatli jo'natildi."
    }
    if os.environ.get("VOICESHIELD_DEBUG_OTP") == "1":
        res["simulated_code"] = code
    return res


@app.post("/api/verify/validate-code")
def validate_verification_code(req: ValidateCodeRequest):
    saved_code = active_otps.get(req.phone_number)
    if saved_code and saved_code == req.code:
        active_otps.pop(req.phone_number, None)
        return {"valid": True, "message": "Kod to'g'ri. Shaxs tasdiqlandi."}
    return {"valid": False, "message": "Kod mos kelmadi! Firibgarlik ehtimoli yuqori."}


@app.post("/api/report-incident")
def report_fraud_incident(report: IncidentReport):
    incident_logs.append(report.dict())
    print(f"[Xavfsizlik Xizmati] Ogohlantirish! {report.caller_number} dan deepfake hujum qayd etildi. Xavf: {report.max_risk_score}%")
    return {"success": True, "incident_id": len(incident_logs)}


@app.websocket("/ws/audio")
async def websocket_audio_endpoint(websocket: WebSocket):
    await websocket.accept()
    detector.reset()
    print("[WebSocket] Yangi qo'ng'iroq audio oqimi ulandi.")

    try:
        while True:
            message = await websocket.receive()
            if "text" in message:
                data = json.loads(message["text"])
                if data.get("action") == "reset":
                    detector.reset()
                    continue
                rms = float(data.get("rms", 0.0))
                sfm = float(data.get("sfm", 0.2))
                pvr = float(data.get("pvr", 30.0))
                pitch = float(data.get("pitch", 120.0))
                pitch_std = float(data.get("pitch_std", 0.0))
                hf_ratio = float(data.get("hf_ratio", 0.0))
                sensitivity = float(data.get("sensitivity", 1.0))

                score, status, details = detector.analyze_acoustic_features(
                    rms=rms,
                    sfm=sfm,
                    pvr=pvr,
                    pitch=pitch,
                    pitch_std=pitch_std,
                    hf_ratio=hf_ratio,
                    sensitivity=sensitivity
                )

                await websocket.send_json({
                    "ai_probability": score,
                    "status": status,
                    "details": details
                })
            elif "bytes" in message:
                pcm_bytes = message["bytes"]
                score, status, details = detector.analyze_raw_pcm(pcm_bytes)
                await websocket.send_json({
                    "ai_probability": score,
                    "status": status,
                    "details": details
                })
    except WebSocketDisconnect:
        print("[WebSocket] Audio oqim ulanishi uzildi.")
    except Exception as e:
        print(f"[WebSocket Xato] {e}")


# Frontend fayllarni ham bitta portdan ochish
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if os.path.exists(os.path.join(frontend_dir, "index.html")):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
