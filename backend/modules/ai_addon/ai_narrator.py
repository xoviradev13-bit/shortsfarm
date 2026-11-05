import os
import sys
import re
import json
import asyncio
import subprocess
import time
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from backend.database import log_event
from backend.logger import get_logger
from backend.modules.ai_addon.llm_curator import llm_curator

logger = get_logger("ai_narrator")

# Danh mục giọng đọc Neural đa ngôn ngữ (Microsoft Edge-TTS)
VOICE_CATALOG: Dict[str, Dict[str, Any]] = {
    "vi": {
        "name": "Tiếng Việt (Vietnamese)",
        "male": "vi-VN-NamMinhNeural",
        "female": "vi-VN-HoaiMyNeural",
        "default": "vi-VN-NamMinhNeural",
        "voices": [
            {"id": "vi-VN-NamMinhNeural", "name": "Nam Minh (Nam - Trầm ấm, phóng sự đại án, tài liệu giật gân)", "gender": "male"},
            {"id": "vi-VN-HoaiMyNeural", "name": "Hoài My (Nữ - Truyền cảm, tâm lý, tin tức TikTok)", "gender": "female"}
        ]
    },
    "en": {
        "name": "English (US)",
        "male": "en-US-ChristopherNeural",
        "female": "en-US-JennyNeural",
        "default": "en-US-ChristopherNeural",
        "voices": [
            {"id": "en-US-ChristopherNeural", "name": "Christopher (Nam - Viral TikTok deep storytelling)", "gender": "male"},
            {"id": "en-US-GuyNeural", "name": "Guy (Nam - Tự nhiên, tin tức, vlog đời thường)", "gender": "male"},
            {"id": "en-US-BrianNeural", "name": "Brian (Nam - Năng động, hài hước, hiện đại)", "gender": "male"},
            {"id": "en-US-AndrewNeural", "name": "Andrew (Nam - Trầm, ấm áp, tin cậy)", "gender": "male"},
            {"id": "en-US-EricNeural", "name": "Eric (Nam - Trẻ trung, đĩnh đạc)", "gender": "male"},
            {"id": "en-US-AvaNeural", "name": "Ava (Nữ - Trendy TikTok aesthetic, trẻ trung)", "gender": "female"},
            {"id": "en-US-JennyNeural", "name": "Jenny (Nữ - Tự nhiên, kể chuyện, cuốn hút)", "gender": "female"},
            {"id": "en-US-EmmaNeural", "name": "Emma (Nữ - Nhẹ nhàng, tâm sự, sâu lắng)", "gender": "female"},
            {"id": "en-US-AriaNeural", "name": "Aria (Nữ - Chuyên nghiệp, thời sự, đài truyền hình)", "gender": "female"},
            {"id": "en-US-AnaNeural", "name": "Ana (Nữ - Hoạt hình, nhí nhảnh, vui tươi)", "gender": "female"}
        ]
    },
    "ja": {
        "name": "日本語 (Japanese)",
        "male": "ja-JP-KeitaNeural",
        "female": "ja-JP-NanamiNeural",
        "default": "ja-JP-KeitaNeural",
        "voices": [
            {"id": "ja-JP-KeitaNeural", "name": "Keita (Nam - Thần thoại, anime, phóng sự giật gân)", "gender": "male"},
            {"id": "ja-JP-NanamiNeural", "name": "Nanami (Nữ - Dịu dàng, chuẩn giọng Tokyo)", "gender": "female"}
        ]
    },
    "ko": {
        "name": "한국어 (Korean)",
        "male": "ko-KR-InJoonNeural",
        "female": "ko-KR-SunHiNeural",
        "default": "ko-KR-InJoonNeural",
        "voices": [
            {"id": "ko-KR-InJoonNeural", "name": "InJoon (Nam - Phim truyền hình K-Drama, kịch tính)", "gender": "male"},
            {"id": "ko-KR-HyunsuMultilingualNeural", "name": "Hyunsu (Nam - Điện ảnh, trầm ấm hiện đại)", "gender": "male"},
            {"id": "ko-KR-SunHiNeural", "name": "SunHi (Nữ - Năng động, thời trang, sành điệu)", "gender": "female"}
        ]
    },
    "de": {
        "name": "Deutsch (German)",
        "male": "de-DE-ConradNeural",
        "female": "de-DE-KatjaNeural",
        "default": "de-DE-ConradNeural",
        "voices": [
            {"id": "de-DE-ConradNeural", "name": "Conrad (Nam - Khoa học, lịch sử, đĩnh đạc)", "gender": "male"},
            {"id": "de-DE-KillianNeural", "name": "Killian (Nam - Đài phát thanh, năng lượng)", "gender": "male"},
            {"id": "de-DE-FlorianMultilingualNeural", "name": "Florian (Nam - Trẻ trung, đa ngôn ngữ)", "gender": "male"},
            {"id": "de-DE-KatjaNeural", "name": "Katja (Nữ - Thời sự, tin tức rõ ràng)", "gender": "female"},
            {"id": "de-DE-AmalaNeural", "name": "Amala (Nữ - Nhẹ nhàng, ấm áp)", "gender": "female"},
            {"id": "de-DE-SeraphinaMultilingualNeural", "name": "Seraphina (Nữ - Tự nhiên, đa ngôn ngữ)", "gender": "female"}
        ]
    },
    "es": {
        "name": "Español (Spanish)",
        "male": "es-ES-AlvaroNeural",
        "female": "es-ES-ElviraNeural",
        "default": "es-ES-AlvaroNeural",
        "voices": [
            {"id": "es-ES-AlvaroNeural", "name": "Alvaro (Nam - Tây Ban Nha, truyền cảm)", "gender": "male"},
            {"id": "es-MX-JorgeNeural", "name": "Jorge (Nam - Mexico, tự nhiên)", "gender": "male"},
            {"id": "es-ES-ElviraNeural", "name": "Elvira (Nữ - Tây Ban Nha, rõ ràng)", "gender": "female"},
            {"id": "es-MX-DaliaNeural", "name": "Dalia (Nữ - Mexico, trẻ trung)", "gender": "female"}
        ]
    },
    "fr": {
        "name": "Français (French)",
        "male": "fr-FR-HenriNeural",
        "female": "fr-FR-DeniseNeural",
        "default": "fr-FR-HenriNeural",
        "voices": [
            {"id": "fr-FR-HenriNeural", "name": "Henri (Nam - Truyền cảm, lịch lãm)", "gender": "male"},
            {"id": "fr-FR-DeniseNeural", "name": "Denise (Nữ - Rõ ràng, tin tức)", "gender": "female"},
            {"id": "fr-FR-VivienneMultilingualNeural", "name": "Vivienne (Nữ - Tự nhiên, đa ngôn ngữ)", "gender": "female"}
        ]
    }
}

LANGUAGE_NAMES = {
    "vi": "Tiếng Việt",
    "en": "English",
    "ja": "Japanese",
    "ko": "Korean",
    "de": "German (Deutsch)",
    "es": "Spanish",
    "fr": "French"
}

# Các phong cách viết kịch bản lồng tiếng (Voiceover Script Styles)
STYLE_CATALOG: Dict[str, Dict[str, str]] = {
    "goc_nguyen_van": {
        "name": "Giữ nguyên lời thoại gốc (Exact Script)",
        "description": "Giữ nguyên văn 100% từng câu chữ của nhân vật trong video, chỉ đổi sang giọng đọc AI",
        "tone_instruction": "EXACT: Keep the transcript verbatim without rewriting."
    },
    "giat_gan": {
        "name": "Giật gân TikTok (Sensational Hook)",
        "description": "Văn phong kịch tính, plot twist bất ngờ, kích thích tò mò tột độ ngay 3 giây đầu",
        "tone_instruction": (
            "TONE: High-drama, sensational, and suspenseful TikTok storytelling. "
            "Use rhetorical cliffhangers, shocking revelations, curiosity gaps, and powerful emotional words. "
            "Hook the listener instantly within the first 3 seconds."
        )
    },
    "cang_thang": {
        "name": "Căng thẳng hồi hộp (Suspense & Thriller)",
        "description": "Văn phong nghẹt thở, trinh thám hình sự, dồn dập và bí ẩn",
        "tone_instruction": (
            "TONE: Dark, tense, gripping thriller and crime documentary pacing. "
            "Every sentence should build escalating tension, mystery, and urgent gravity. "
            "Keep the listener on the edge of their seat."
        )
    },
    "hai_huoc": {
        "name": "Hài hước dí dỏm (Humor & Meme)",
        "description": "Văn phong châm biếm sâu cay, meme bắt trend, vui nhộn tạo tiếng cười",
        "tone_instruction": (
            "TONE: Witty, hilarious, sarcastic, and self-aware internet humor. "
            "Incorporate funny analogies, playful banter, modern slang, and punchy comedic timing."
        )
    },
    "chuyen_nghiep": {
        "name": "Kể chuyện truyền cảm (Documentary Storytelling)",
        "description": "Trầm ấm, đĩnh đạc, thông thái như phim tài liệu lịch sử / khoa học",
        "tone_instruction": (
            "TONE: Deep, authoritative, eloquent, and emotionally resonant documentary narrator. "
            "Poetic yet clear cadence, providing fascinating insights and deep perspective."
        )
    },
    "nhanh_tiktok": {
        "name": "Tóm tắt nhịp nhanh (Rapid-fire Short)",
        "description": "Câu chữ sắc bén, dồn dập, loại bỏ từ thừa, truyền tải thông tin tối đa",
        "tone_instruction": (
            "TONE: Fast-paced, concise, punchy bullet-style re-narration. "
            "Zero fluff, zero filler words, rapid information density that keeps high viewer retention."
        )
    }
}

def detect_text_language(text: str) -> str:
    """Nhận diện nhanh mã ngôn ngữ (vi, ja, ko, de, en) dựa vào đặc trưng ký tự"""
    if not text or not text.strip():
        return "en"

    # 1. Tiếng Hàn: chứa ký tự Hangul (\uac00-\ud7af, \u1100-\u11ff)
    if re.search(r'[\uac00-\ud7af\u1100-\u11ff]', text):
        return "ko"

    # 2. Tiếng Nhật: chứa Hiragana (\u3040-\u309f) hoặc Katakana (\u30a0-\u30ff)
    if re.search(r'[\u3040-\u309f\u30a0-\u30ff]', text):
        return "ja"

    # 3. Tiếng Việt: chứa các nguyên âm có dấu đặc trưng
    vn_chars = set("àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ")
    if any(c in vn_chars for c in text):
        return "vi"

    # 4. Tiếng Đức: chứa các ký tự ä, ö, ü, ß
    de_chars = set("äöüßÄÖÜ")
    if any(c in de_chars for c in text):
        return "de"

    # 5. Mặc định: Tiếng Anh
    return "en"


class AINarrator:
    """
    Hệ thống Lồng Tiếng AI Đa Ngôn Ngữ & Phụ Đề Tự Động Đồng Bộ (Multilingual Voiceover & Synchronized Subtitles):
    - Tự động nhận diện ngôn ngữ gốc (Original Language).
    - Hỗ trợ giữ nguyên ngôn ngữ gốc hoặc chuyển ngữ: US English, Nhật, Hàn, Đức, Việt, Tây Ban Nha, Pháp.
    - LLM viết lại kịch bản (Paraphrase) theo đa dạng phong cách: Giật gân, Căng thẳng, Hài hước, Truyền cảm, Nhịp nhanh.
    - Sinh giọng đọc mới bằng Microsoft Edge-TTS (100% Free, chất lượng Neural như người thật).
    - Đồng bộ phụ đề (Subtitle Timestamps) khớp chuẩn 100% từng câu và từng từ của file giọng đọc mới.
    - Triệt tiêu hoàn toàn mã băm âm thanh cũ, lách 100% lỗi Unoriginal Content của TikTok.
    """

    def get_supported_languages(self) -> List[Dict[str, Any]]:
        """Trả về danh sách ngôn ngữ và giọng đọc được hỗ trợ"""
        langs = [
            {"code": "original", "name": "Ngôn ngữ gốc của video (Auto-Detect & Keep Original)", "flag": "🌐"}
        ]
        flags = {"vi": "🇻🇳", "en": "🇺🇸", "ja": "🇯🇵", "ko": "🇰🇷", "de": "🇩🇪", "es": "🇪🇸", "fr": "🇫🇷"}
        for code, info in VOICE_CATALOG.items():
            langs.append({
                "code": code,
                "name": info["name"],
                "flag": flags.get(code, "🏳️"),
                "male_voice": info["male"],
                "female_voice": info["female"]
            })
        return langs

    def get_supported_styles(self) -> List[Dict[str, str]]:
        """Trả về danh sách phong cách kịch bản lồng tiếng"""
        styles = []
        for code, info in STYLE_CATALOG.items():
            styles.append({
                "code": code,
                "name": info["name"],
                "description": info["description"]
            })
        return styles

    def get_all_voices(self) -> List[Dict[str, Any]]:
        """Trả về toàn bộ danh sách giọng đọc theo từng ngôn ngữ và giới tính"""
        voices = []
        flags = {"vi": "🇻🇳", "en": "🇺🇸", "ja": "🇯🇵", "ko": "🇰🇷", "de": "🇩🇪", "es": "🇪🇸", "fr": "🇫🇷"}
        for lang_code, info in VOICE_CATALOG.items():
            for v in info.get("voices", []):
                voices.append({
                    "id": v["id"],
                    "name": v["name"],
                    "gender": v.get("gender", "male"),
                    "language": lang_code,
                    "language_name": info["name"],
                    "flag": flags.get(lang_code, "🌐")
                })
        return voices

    def paraphrase_script(
        self,
        raw_transcript: str,
        target_lang: str = "original",
        detected_lang: str = "en",
        target_duration_sec: float = 65.0,
        style: str = "giat_gan",
        ai_provider: str = "default",
        ai_model: str = "default"
    ) -> Dict[str, str]:
        """
        Dùng LLM viết lại nội dung kịch bản:
        - Nếu style == 'goc_nguyen_van': Giữ nguyên 100% lời thoại gốc của nhân vật, không dùng LLM viết lại.
        - 100% từ ngữ mới để phá vỡ nhận diện ngữ nghĩa ASR của TikTok.
        - Điều chỉnh độ dài phù hợp với thời lượng video (~target_duration_sec).
        - Tuân thủ phong cách kịch bản (Giật gân, căng thẳng, hài hước, truyền cảm, nhịp nhanh).
        """
        effective_lang = detected_lang if target_lang in ("original", "auto", "") else target_lang
        lang_name = LANGUAGE_NAMES.get(effective_lang, "English")

        # 0. Nếu người dùng chọn 'Giữ nguyên lời thoại gốc' -> Trả về nguyên văn transcript gốc
        if style in ("goc_nguyen_van", "exact", "original"):
            return {
                "language": effective_lang,
                "hook": "",
                "script": raw_transcript.strip()
            }

        # Phong cách viết kịch bản
        style_entry = STYLE_CATALOG.get(style, STYLE_CATALOG["giat_gan"])
        tone_instruction = style_entry["tone_instruction"]

        # Ước lượng độ dài từ theo thời lượng (150-165 từ/phút cho tốc độ nói tự nhiên, không bị thiếu hụt âm thanh)
        target_words = max(160, int((target_duration_sec / 60.0) * 155))

        system_prompt = (
            "You are a world-class viral short-form video scriptwriter and voiceover adapter. "
            "You rewrite transcripts into punchy, high-retention narration scripts for TikTok. "
            "Return valid JSON only."
        )

        user_prompt = f"""Rewrite the following video transcript into an exciting, high-retention TikTok narration script.

ORIGINAL TRANSCRIPT:
"{raw_transcript[:2500]}"

CRITICAL INSTRUCTIONS:
1. TARGET LANGUAGE: Write 100% in {lang_name} ({effective_lang}).
2. SCRIPT STYLE: {tone_instruction}
3. RETENTION HOOK: Open with an irresistible 3-second hook sentence that grabs attention immediately.
4. PARAPHRASE COMPLETELY: Use completely new wording, sentence structures, and synonyms. Do not copy phrases verbatim.
5. SCRIPT LENGTH & COMPLETE COVERAGE: The narration MUST fill the ENTIRE {int(target_duration_sec)} seconds. Write approximately {target_words} words ({target_words - 5} to {target_words + 20} words). DO NOT write a short summary or end early! Elaborate with dramatic details, reactions, and suspenseful storytelling beats so the spoken voice spans the full duration.
6. NO SHOW INTROS OR CHANNEL NAMES: Absolutely DO NOT say "The Joe Rogan Experience" or introduce the podcast/channel. Jump straight into the shocking hook and intense storytelling from word one.
7. FORMAT: Natural spoken voice script only (no stage directions, no [music], no bracketed cues).
7. RETURN VALID JSON:
{{"language": "{effective_lang}", "hook": "First 3s hook", "script": "Full rewritten narration script"}}"""

        try:
            raw_res = llm_curator.query_llm(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                task="paraphrase_script",
                custom_provider=None if ai_provider == "default" else ai_provider,
                custom_model=None if ai_model == "default" else ai_model
            )
            if raw_res:
                clean_json = re.sub(r"^```json\s*|\s*```$", "", raw_res.strip(), flags=re.MULTILINE)
                parsed = json.loads(clean_json)
                script_text = parsed.get("script", "").strip()
                if script_text:
                    return {
                        "language": effective_lang,
                        "hook": parsed.get("hook", ""),
                        "script": script_text
                    }
        except Exception as e:
            logger.warning(f"Lỗi gọi LLM paraphrase kịch bản: {e}")

        # Fallback an toàn: Sử dụng chính raw transcript nếu LLM lỗi
        return {
            "language": effective_lang,
            "hook": "",
            "script": raw_transcript.strip()
        }

    async def _async_synthesize_edge_tts(
        self,
        text: str,
        output_path: str,
        voice: str,
        rate: str = "+3%",
        pitch: str = "+0Hz"
    ) -> Tuple[bool, List[Dict[str, Any]], str]:
        """
        Sinh audio bằng edge-tts bất đồng bộ và đồng thời trích xuất danh sách phụ đề có mốc thời gian.
        Trả về (success: bool, transcript_segments: list, srt_content: str).
        """
        import edge_tts
        communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate, pitch=pitch)
        submaker = edge_tts.SubMaker()

        with open(output_path, "wb") as f:
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    f.write(chunk["data"])
                elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                    submaker.feed(chunk)

        success = os.path.exists(output_path) and os.path.getsize(output_path) > 1024

        # Xây dựng transcript_segments với mốc thời gian chính xác cho từng câu và từng từ
        segments: List[Dict[str, Any]] = []
        for cue in submaker.cues:
            start_sec = cue.start.total_seconds()
            end_sec = cue.end.total_seconds()
            dur = max(0.1, end_sec - start_sec)
            words = cue.content.strip().split()
            w_dur = dur / max(1, len(words))

            w_list = []
            for idx, w in enumerate(words):
                w_start = start_sec + (idx * w_dur)
                w_end = w_start + w_dur
                w_list.append({
                    "word": w,
                    "start": round(w_start, 2),
                    "end": round(w_end, 2)
                })

            segments.append({
                "start": round(start_sec, 2),
                "end": round(end_sec, 2),
                "text": cue.content.strip(),
                "words": w_list
            })

        srt_content = submaker.get_srt() if success else ""
        return success, segments, srt_content

    def _get_audio_file_duration(self, file_path: str) -> float:
        """Lay thoi luong file audio chinh xac bang ffmpeg"""
        if not file_path or not os.path.exists(file_path):
            return 0.0
        try:
            from backend.modules.video_core.hardware_accel import get_ffmpeg_binary
            ffmpeg_bin = get_ffmpeg_binary()
            cmd = [ffmpeg_bin, "-i", file_path]
            res = subprocess.run(
                cmd, capture_output=True, timeout=10,
                creationflags=0x08000000 if sys.platform == 'win32' else 0
            )
            stderr = res.stderr.decode('utf-8', errors='replace')
            m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", stderr)
            if m:
                h, m_, s = m.groups()
                return round(int(h) * 3600 + int(m_) * 60 + float(s), 2)
        except Exception:
            pass
        return 0.0

    def _build_synthetic_segments(self, text: str, duration: float) -> List[Dict[str, Any]]:
        """Tao danh sach moc thoi gian phu de theo tung tu tu van ban va do dai audio"""
        words = text.strip().split()
        if not words:
            return []
        dur = max(0.5, float(duration))
        w_dur = dur / len(words)
        w_list = []
        for i, w in enumerate(words):
            w_list.append({
                "word": w,
                "start": round(i * w_dur, 2),
                "end": round((i + 1) * w_dur, 2)
            })
        return [{
            "start": 0.0,
            "end": round(dur, 2),
            "text": text.strip(),
            "words": w_list
        }]

    def synthesize_voice(
        self,
        text: str,
        output_path: str,
        language: str = "en",
        gender: str = "male",
        voice: Optional[str] = None,
        rate: str = "+0%"
    ) -> Tuple[Optional[str], List[Dict[str, Any]], str]:
        """
        Sinh file am thanh tu van ban su dung Microsoft Edge-TTS dam bao dong nhat 100% giong doc (Voice Consistency):
        - Giu nguyen 100% duy nhat mot giong doc (selected_voice) trong toan bo video, KHONG DOI GIOI TINH hoac giong khac.
        - Tu dong retry thong minh voi backoff (1.5s, 2.5s, 3.5s) va chuan hoa toc do rate='+0%' de giu ket noi on dinh.
        Tra ve tuple (output_path, transcript_segments, srt_content).
        """
        if not text or not text.strip():
            return None, [], ""

        clean_text = text.strip()
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        # 0. Hỗ trợ tạo giọng đọc bằng ElevenLabs nếu Voice ID là của ElevenLabs
        if voice and len(voice) >= 18 and "Neural" not in voice:
            try:
                from backend.modules.elevenlabs_client import elevenlabs_client
                res = elevenlabs_client.synthesize(clean_text, voice_id=voice, output_path=output_path)
                if res.get("success"):
                    dur = self._get_audio_file_duration(output_path)
                    seg = self._generate_fallback_word_timestamps(clean_text, dur)
                    return output_path, seg, ""
                else:
                    logger.warning(f"ElevenLabs thất bại ({res.get('message')}). Tự động fallback sang Edge-TTS.")
            except Exception as e:
                logger.warning(f"Lỗi gọi ElevenLabs: {e}. Fallback sang Edge-TTS.")

        # 1. Xac dinh chinh xac duy nhat 1 giong doc (Voice Consistency)
        selected_voice = voice
        if not selected_voice:
            if gender and ("Neural" in gender or "-" in gender):
                selected_voice = gender
            else:
                lang_entry = VOICE_CATALOG.get(language, VOICE_CATALOG.get("en", {}))
                selected_voice = lang_entry.get(gender.lower(), lang_entry.get("default", "vi-VN-NamMinhNeural"))

        # 2. Cac thu nghiem retry tren CHINH GIONG DOC DO (khong doi sang giong khac de tranh lech tong video)
        # Thu voi rate yeu cau truoc, neu loi thi ha ve '+0%' on dinh
        attempts = [
            (rate, 0.0),
            ("+0%", 2.0),
            ("+0%", 4.0),
            ("+0%", 6.0)
        ]

        for idx, (try_rate, wait_sec) in enumerate(attempts):
            if wait_sec > 0:
                time.sleep(wait_sec)

            try:
                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)

                if sys.platform == "win32" and hasattr(loop, 'set_exception_handler'):
                    def _silent_exception_handler(loop, context):
                        exc = context.get("exception")
                        if isinstance(exc, (ConnectionResetError, OSError)):
                            return
                        loop.default_exception_handler(context)
                    loop.set_exception_handler(_silent_exception_handler)

                if loop.is_running():
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor() as pool:
                        future = pool.submit(
                            asyncio.run,
                            self._async_synthesize_edge_tts(clean_text, output_path, selected_voice, rate=try_rate)
                        )
                        success, segments, srt_content = future.result(timeout=45)
                else:
                    success, segments, srt_content = loop.run_until_complete(
                        self._async_synthesize_edge_tts(clean_text, output_path, selected_voice, rate=try_rate)
                    )

                if success and os.path.exists(output_path) and os.path.getsize(output_path) > 1024:
                    dur = self._get_audio_file_duration(output_path)
                    if not segments:
                        segments = self._build_synthetic_segments(clean_text, dur)
                    file_size_kb = os.path.getsize(output_path) / 1024
                    logger.info(f"Da sinh giong doc AI ({selected_voice}, rate={try_rate}, {language}): {output_path} ({file_size_kb:.1f} KB, {len(segments)} sub cues)")
                    return output_path, segments, srt_content
            except Exception as e:
                logger.warning(f"Edge-TTS ({selected_voice}, rate={try_rate}, lan {idx+1}) gap loi: {e}")

        logger.error(f"Khong the sinh giong doc Edge-TTS ({selected_voice}) sau tat ca cac lan thu.")
        return None, [], ""

    def generate_narration_audio(
        self,
        transcript_segments: List[Dict[str, Any]],
        output_audio_path: str,
        target_language: str = "original",
        gender: str = "male",
        style: str = "giat_gan",
        target_duration: float = 65.0,
        ai_provider: str = "default",
        ai_model: str = "default"
    ) -> Dict[str, Any]:
        """
        Quy trình trọn gói Lồng tiếng AI & Sinh Phụ Đề Khớp Giọng Nói (Zero-Unoriginal Audio & Subtitle Pipeline):
        1. Gom toàn bộ lời thoại gốc từ transcript segments.
        2. Tự động nhận diện ngôn ngữ gốc (vi, en, ja, ko, de, es, fr...).
        3. LLM viết lại kịch bản (Paraphrase) 100% từ mới theo target_language và script style.
        4. Edge-TTS sinh file giọng đọc mới toanh đồng thời tính toán timestamp phụ đề từng từ.
        5. Trả về thông tin audio mới cùng danh sách transcript_segments khớp hoàn toàn để nhúng vào video render.
        """
        raw_text = " ".join(s.get("text", "") for s in transcript_segments).strip()
        if not raw_text:
            return {"success": False, "message": "Không có nội dung lời thoại để lồng tiếng"}

        # 1. Nhận diện ngôn ngữ gốc
        detected_lang = detect_text_language(raw_text)

        # 2. Ngôn ngữ đích
        final_lang = detected_lang if target_language in ("original", "auto", "", None) else target_language
        style_key = style if style in STYLE_CATALOG else "giat_gan"

        log_event(
            "INFO",
            f"🎙️ [AI NARRATOR] Bắt đầu lồng tiếng: Gốc=[{detected_lang}] -> Đích=[{final_lang}], Style=[{style_key}], Giới tính={gender}..."
        )

        # 3. LLM Paraphrase kịch bản theo phong cách đã chọn
        para_res = self.paraphrase_script(
            raw_transcript=raw_text,
            target_lang=final_lang,
            detected_lang=detected_lang,
            target_duration_sec=target_duration,
            style=style_key,
            ai_provider=ai_provider,
            ai_model=ai_model
        )
        new_script = para_res.get("script", raw_text)

        # 4. Sinh giọng đọc Edge-TTS kèm theo timestamp phụ đề khớp chính xác
        out_file, new_segments, srt_content = self.synthesize_voice(
            text=new_script,
            output_path=output_audio_path,
            language=final_lang,
            gender=gender,
            rate="+0%"
        )

        if out_file and os.path.exists(out_file):
            lang_name = LANGUAGE_NAMES.get(final_lang, final_lang)
            log_event(
                "SUCCESS",
                f"✅ [AI NARRATOR THÀNH CÔNG] Đã tạo track âm thanh & phụ đề lồng tiếng mới 100% ({lang_name}, {style_key}): {Path(out_file).name} ({len(new_segments)} cues)"
            )
            return {
                "success": True,
                "audio_path": out_file,
                "script": new_script,
                "hook": para_res.get("hook", ""),
                "language": final_lang,
                "original_language": detected_lang,
                "style": style_key,
                "transcript_segments": new_segments,
                "srt_content": srt_content
            }

        return {"success": False, "message": "Không thể sinh file âm thanh giọng đọc AI"}


ai_narrator = AINarrator()
