"""
VoiceShield - AI Audio Anti-Spoofing & Deepfake Detector Engine
Akustik ASVspoof, neyro-vocoder (HiFi-GAN, MelGAN) spektral tekisligi va
asosiy ton (pitch) mikrotebranishlari orqali sun'iy ovozlarni aniqlash.
"""

import io
import wave
import numpy as np
from typing import Dict, Any, Tuple

class AudioDeepfakeDetector:
    def __init__(self):
        self.sample_rate = 16000
        self.history = []
        self.pitch_history = []
        self.last_score = 4.0
        self.silence_frames = 0

    def reset(self):
        self.history = []
        self.pitch_history = []
        self.last_score = 4.0
        self.silence_frames = 0

    def analyze_acoustic_features(
        self,
        rms: float,
        sfm: float,
        pvr: float = 26.0,
        pitch: float = 120.0,
        pitch_std: float = 0.0,
        hf_ratio: float = 0.0,
        sensitivity: float = 1.35
    ) -> Tuple[int, str, Dict[str, Any]]:
        """
        Jonli audio oqimini (Gemini, ChatGPT, ElevenLabs, Klon) real-time baholaydi:
        - rms: signal kuchi (ovoz balandligi)
        - sfm: spektral tekislik (200Hz-3500Hz)
        - pvr: Formant kontrasti (Peak-to-Valley nisbati dB da)
        - pitch: asosiy ton chastotasi (Hz)
        - pitch_std: ton tebranish darajasi (micro-jitter)
        - hf_ratio: yuqori chastota ulushi
        """
        # Sukut (jimlik yoki so'zlar orasidagi tanaffus)
        if rms < 0.010:
            self.silence_frames += 1
            if self.silence_frames > 25: # ~2.5 soniya doimiy sukut bo'lsagina pasaytirish
                self.last_score = max(4.0, self.last_score * 0.94)

            score = int(round(self.last_score))
            status = "DANGEROUS" if score >= 65 else ("SUSPICIOUS" if score >= 35 else "SAFE")
            return score, status, {
                "flatness": f"{sfm:.2f}",
                "pitch": "-- Hz",
                "jitter": "Sukut (Jimlik)",
                "volume": f"{int(20 * np.log10(max(rms, 1e-4)))} dB",
                "vocoder": "Aniqlanmadi"
            }

        self.silence_frames = 0

        # Insoniy nafas, entikish, uf tortish yoki pichirlash (Unvoiced breath noise)
        if pitch < 60 or sfm > 0.65:
            return 8, "SAFE", {
                "flatness": f"{sfm:.2f}",
                "pitch": "-- Hz",
                "jitter": "Tabiiy nafas / entikish",
                "volume": f"{int(20 * np.log10(max(rms, 1e-4)))} dB",
                "vocoder": "Insoniy nafas dinamikasi"
            }

        ai_score = 10.0
        flags = []

        # 1. Spektral Tekislik (Vocoder Noise vs Insoniy Garmonikalar)
        # AI neyro-vocoderlari (HiFi-GAN, MelGAN) SFM odatda 0.38 - 0.50 oralig'ida bo'ladi
        # Inson ovozida esa SFM pastroq (0.12 - 0.28) bo'ladi
        if sfm >= 0.42:
            voc_pts = min(45.0, (sfm - 0.42) * 500.0 + 30.0)
            ai_score += voc_pts * sensitivity
            flags.append(f"Yuqori vocoder tekisligi: {sfm:.3f}")
        elif sfm >= 0.37:
            ai_score += ((sfm - 0.37) * 300.0 + 10.0) * sensitivity
            flags.append(f"Vocoder tekisligi: {sfm:.3f}")
        elif sfm < 0.28:
            ai_score = max(4.0, ai_score - 15.0)
            flags.append("Insoniy toza garmonikalar")

        # 2. Formant chuqurligi (PVR - Peak-to-Valley Ratio)
        # Inson ovozida unli tovushlar kuchli rezonansga ega (PVR > 48-65 dB)
        # Vocoder va sun'iy klonlarda esa garmonikalar oraliq shovqin bilan to'ladi (PVR < 38 dB)
        if pvr >= 50.0:
            ai_score = max(4.0, ai_score - 25.0)
            flags.append(f"Insoniy rezonans: {pvr:.1f} dB")
        elif pvr >= 38.0:
            ai_score = max(4.0, ai_score - 12.0)
        elif pvr < 32.0:
            ai_score += min(30.0, (32.0 - pvr) * 2.5 + 12.0) * sensitivity
            flags.append(f"Vocoder shovqini: {pvr:.1f} dB")

        # 3. Ton Barqarorligi va Monotonlik (Micro-jitter)
        if pitch > 50:
            self.pitch_history.append(pitch)
            if len(self.pitch_history) > 8:
                self.pitch_history.pop(0)

        calc_std = pitch_std
        if calc_std <= 0 and len(self.pitch_history) >= 3:
            calc_std = float(np.std(self.pitch_history))

        if len(self.pitch_history) >= 3 and pitch > 60:
            if calc_std < 6.0 and pvr < 45.0:
                p_pts = 45.0 * sensitivity
                ai_score += p_pts
                flags.append(f"Monoton sintetik ton: {calc_std:.1f} Hz")
            elif calc_std < 12.0 and pvr < 45.0:
                p_pts = 22.0 * sensitivity
                ai_score += p_pts
                flags.append(f"Past intonatsiya tebranishi: {calc_std:.1f} Hz")
            elif calc_std >= 16.0:
                ai_score = max(4.0, ai_score - 20.0)
                flags.append(f"Tabiiy inson intonatsiyasi: {calc_std:.1f} Hz")

        # 4. 8kHz Yuqori chastota kesilishi
        if hf_ratio < 0.02 and pitch > 60 and pvr < 40.0:
            ai_score += 12.0 * sensitivity
            flags.append("8kHz kesilishi")

        # Tezkor hujum va sekin tushish (Fast attack, slow release)
        target = min(98.0, max(4.0, ai_score))
        if target > self.last_score:
            self.last_score = 0.65 * target + 0.35 * self.last_score
        else:
            self.last_score = 0.15 * target + 0.85 * self.last_score

        smoothed_risk = int(round(self.last_score))
        smoothed_risk = max(4, min(98, smoothed_risk))

        if smoothed_risk >= 65:
            status = "DANGEROUS"
            jitter_label = "Sun'iy Vocoder (AI / Gemini)"
        elif smoothed_risk >= 35:
            status = "SUSPICIOUS"
            jitter_label = "Shubhali artefakt"
        else:
            status = "SAFE"
            jitter_label = "Insoniy (Tabiiy)"

        details = {
            "flatness": f"{sfm:.2f}",
            "pitch": f"{int(pitch)} Hz" if pitch > 40 else "-- Hz",
            "jitter": jitter_label,
            "volume": f"{int(20 * np.log10(max(rms, 1e-4)))} dB",
            "vocoder": "Sintetik neyro-izlar (Deepfake)" if smoothed_risk >= 65 else ("Shubhali tebranish" if smoothed_risk >= 35 else "Tabiiy akustika")
        }

        return smoothed_risk, status, details

    def analyze_audio_bytes(self, file_bytes: bytes, filename: str = "audio.wav") -> Dict[str, Any]:
        """
        Yuklangan audio faylni (.wav, .mp3, .ogg) to'liq spektral va garmonik tahlil qiladi.
        """
        try:
            with wave.open(io.BytesIO(file_bytes), 'rb') as wav_file:
                channels = wav_file.getnchannels()
                sample_width = wav_file.getsampwidth()
                framerate = wav_file.getframerate()
                n_frames = wav_file.getnframes()
                raw_frames = wav_file.readframes(n_frames)

                if sample_width == 2:
                    dtype = np.int16
                elif sample_width == 1:
                    dtype = np.uint8
                elif sample_width == 4:
                    dtype = np.int32
                else:
                    dtype = np.int16

                audio_data = np.frombuffer(raw_frames, dtype=dtype).astype(np.float32)
                if channels > 1:
                    audio_data = audio_data.reshape(-1, channels).mean(axis=1)

                max_val = np.max(np.abs(audio_data)) or 1.0
                audio_data = audio_data / max_val
        except Exception:
            audio_data = np.frombuffer(file_bytes[:len(file_bytes) - (len(file_bytes) % 2)], dtype=np.int16).astype(np.float32)
            if len(audio_data) == 0:
                return {"success": False, "error": "Audio fayl ma'lumotlarini o'qib bo'lmadi."}
            max_val = np.max(np.abs(audio_data)) or 1.0
            audio_data = audio_data / max_val
            framerate = 16000

        duration_sec = round(len(audio_data) / max(framerate, 8000), 2)

        # FFT Spektr
        sub_sample = audio_data[: min(len(audio_data), 32000)]
        rfft = np.abs(np.fft.rfft(sub_sample))
        freqs = np.fft.rfftfreq(len(sub_sample), 1.0 / framerate)

        voice_indices = np.where((freqs >= 200) & (freqs <= 3800))[0]
        if len(voice_indices) > 0:
            voice_fft = rfft[voice_indices] + 1e-5
            geom_mean = np.exp(np.mean(np.log(voice_fft)))
            arith_mean = np.mean(voice_fft)
            sfm = float(min(1.0, geom_mean / arith_mean))
        else:
            sfm = 0.05

        # 8000 Hz dan yuqori chastota energiyasi
        high_indices = np.where(freqs >= 8000)[0]
        if len(high_indices) > 0:
            high_energy = np.sum(rfft[high_indices]**2)
            total_energy = np.sum(rfft**2) + 1e-6
            high_freq_ratio = float(high_energy / total_energy)
        else:
            high_freq_ratio = 0.0

        # Dominant pitch
        pitch_search_indices = np.where((freqs >= 80) & (freqs <= 350))[0]
        if len(pitch_search_indices) > 0:
            peak_sub_idx = np.argmax(rfft[pitch_search_indices])
            pitch = float(freqs[pitch_search_indices[peak_sub_idx]])
        else:
            pitch = 140.0

        ai_probability = 8
        reasons = []

        if sfm >= 0.035:
            ai_probability += min(56, int(25 + (sfm - 0.035) * 1200))
            reasons.append(f"Garmonikalarda sun'iy neyro-vocoder izi aniqlandi (SFM: {sfm:.2f})")

        if high_freq_ratio < 0.03:
            ai_probability += 24
            reasons.append("16/22 kHz sintetik TTS modeliga xos yuqori chastota kesilishi mavjud")

        if pitch > 230 or (75 < pitch < 92):
            ai_probability += 16
            reasons.append(f"Tabiiy inson mikrotebranishlari yetishmaydi (Pitch: {int(pitch)} Hz)")

        ai_probability = min(96, max(4, ai_probability))

        if ai_probability >= 65:
            verdict = "DEEPFAKE / SUN'IY OVOZ"
            verdict_desc = "Ovoz sun'iy intellekt (ElevenLabs / TTS / Klon) tomonidan yaratilgan ehtimoli juda yuqori!"
            status = "DANGEROUS"
        elif ai_probability >= 35:
            verdict = "SHUBHALI AUDIO"
            verdict_desc = "Ovozda sintetik artefaktlar yoki kuchli kompyuter filtri bor."
            status = "SUSPICIOUS"
        else:
            verdict = "HAQIQIY INSON OVOZI"
            verdict_desc = "Ovoz parametrlarida sintetik neyro-tarmoq izlari topilmadi. Ovoz tabiiy."
            status = "SAFE"
            reasons = ["Akustik garmonikalar inson ovoz apparatiga to'liq mos keladi."]

        return {
            "success": True,
            "filename": filename,
            "duration": f"{duration_sec} soniya",
            "ai_probability": ai_probability,
            "status": status,
            "verdict": verdict,
            "verdict_desc": verdict_desc,
            "indicators": {
                "spectral_flatness": round(sfm, 3),
                "high_freq_ratio": round(high_freq_ratio, 3),
                "pitch": f"{int(pitch)} Hz",
            },
            "findings": reasons
        }
