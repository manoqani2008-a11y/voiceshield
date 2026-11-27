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

        # Insoniy nafas, entikish, uf tortish yoki pichirlash (faqat mayin va pitch yo'q tovush)
        if pitch < 60 and rms < 0.025:
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

    def analyze_raw_pcm(self, pcm_bytes: bytes, sample_rate: int = 16000) -> Tuple[int, str, Dict[str, Any]]:
        """
        Mobil ilova (Flutter) yoki WebSocket'dan kelgan xom PCM-16 audio oqimini tahlil qiladi.
        """
        usable_len = len(pcm_bytes) - (len(pcm_bytes) % 2)
        if usable_len < 640:
            return int(round(self.last_score)), "SAFE", {
                "flatness": "0.00",
                "pitch": "-- Hz",
                "jitter": "Kutilmoqda",
                "volume": "-60 dB",
                "vocoder": "Ovoz kutilmoqda"
            }

        samples = np.frombuffer(pcm_bytes[:usable_len], dtype=np.int16).astype(np.float32) / 32768.0
        rms = float(np.sqrt(np.mean(samples * samples)))
        if rms < 0.009:
            return self.analyze_acoustic_features(rms=rms, sfm=0.1, pvr=30.0, pitch=0.0, sensitivity=1.0)

        win = np.hanning(len(samples))
        rfft = np.abs(np.fft.rfft(samples * win))
        freqs = np.fft.rfftfreq(len(samples), 1.0 / sample_rate)

        voice_idx = np.where((freqs >= 200) & (freqs <= 3500))[0]
        if len(voice_idx) > 0:
            v_fft = rfft[voice_idx] + 1e-6
            sfm = float(min(1.0, np.exp(np.mean(np.log(v_fft))) / np.mean(v_fft)))
            v_db = 20.0 * np.log10(v_fft)
            pvr = float(max(0.0, np.max(v_db) - np.percentile(v_db, 25)))
        else:
            sfm = 0.1
            pvr = 30.0

        pitch_idx = np.where((freqs >= 75) & (freqs <= 350))[0]
        pitch = float(freqs[pitch_idx[np.argmax(rfft[pitch_idx])]]) if len(pitch_idx) > 0 else 0.0

        high_idx = np.where(freqs >= 7000)[0]
        hf_ratio = float(np.sum(rfft[high_idx] ** 2) / (np.sum(rfft ** 2) + 1e-6)) if len(high_idx) > 0 else 0.02

        return self.analyze_acoustic_features(
            rms=rms,
            sfm=sfm,
            pvr=pvr,
            pitch=pitch,
            hf_ratio=hf_ratio,
            sensitivity=1.0
        )

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
                    audio_data = np.frombuffer(raw_frames, dtype=np.int16).astype(np.float32)
                elif sample_width == 1:
                    audio_data = np.frombuffer(raw_frames, dtype=np.uint8).astype(np.float32) - 128.0
                elif sample_width == 4:
                    audio_data = np.frombuffer(raw_frames, dtype=np.int32).astype(np.float32)
                else:
                    return {"success": False, "ai_probability": 0, "status": "SAFE", "verdict": "Format Xatosi", "verdict_desc": "Qo'llab-quvvatlanmaydigan bit chuqurligi.", "findings": []}

                if channels > 1:
                    audio_data = audio_data.reshape(-1, channels).mean(axis=1)

                max_val = float(np.max(np.abs(audio_data))) or 1.0
                audio_data = audio_data / max_val
        except Exception:
            # Siqilgan MP3/OGG fayllar WAV kabi raw int16 deb o'qilmasligi kerak — ffmpeg/pydub bilan tekshiramiz
            try:
                import subprocess
                proc = subprocess.run(
                    ["ffmpeg", "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", "16000", "pipe:1"],
                    input=file_bytes,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    timeout=10,
                    check=True,
                )
                audio_data = np.frombuffer(proc.stdout, dtype=np.int16).astype(np.float32) / 32768.0
                framerate = 16000
            except Exception:
                return {
                    "success": False,
                    "filename": filename,
                    "ai_probability": 0,
                    "status": "SAFE",
                    "verdict": "Audio dekodlash xatosi",
                    "verdict_desc": "Serverda faqat WAV formati (yoki ffmpeg o'rnatilgan MP3/OGG) dekodlanadi.",
                    "findings": ["Iltimos, brauzer orqali yuklang yoki .wav fayl tanlang."]
                }

        if len(audio_data) == 0:
            return {"success": False, "filename": filename, "ai_probability": 0, "status": "SAFE", "verdict": "Bo'sh audio", "verdict_desc": "Audio ma'lumot topilmadi.", "findings": []}

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

        if sfm >= 0.35:
            ai_probability += min(74, int(45 + (sfm - 0.35) * 120))
            reasons.append(f"Garmonikalarda sun'iy neyro-vocoder izi aniqlandi (SFM: {sfm:.2f})")
        elif sfm >= 0.12:
            ai_probability += min(32, int(15 + (sfm - 0.12) * 80))
            reasons.append(f"O'rtacha spektral tekislik artefakti kuzatildi (SFM: {sfm:.2f})")

        if framerate >= 24000 and high_freq_ratio < 0.03:
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
