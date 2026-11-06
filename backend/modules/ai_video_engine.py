import os
import sys
import re
import json
import unicodedata
import subprocess
import shutil
import random
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from backend.config import (
    RENDERED_DIR, MUSIC_DIR, ENABLE_DYNAMIC_SUBTITLES, ENABLE_ANTI_DETECT, WHISPER_MODEL_SIZE,
    SUBTITLE_STYLE, SUBTITLE_POSITION, SUBTITLE_FONT_SIZE
)
from backend.database import get_connection, log_event
from backend.logger import get_logger

logger = get_logger("ai_video_engine")

# Import các phân hệ video core và AI add-on
from backend.modules.video_core.hardware_accel import get_ffmpeg_binary, get_optimal_video_encoder_flags, is_nvenc_available
from backend.modules.video_core.anti_detect import anti_detect_engine
from backend.modules.video_core.silence_detector import silence_detector
from backend.modules.video_core.quality_checker import quality_checker
from backend.modules.ai_addon.llm_curator import llm_curator
from backend.modules.ai_addon.whisper_transcriber import whisper_transcriber
from backend.modules.ai_addon.ass_subtitle import ass_subtitle_generator
from backend.modules.ai_addon.ai_story_engine import ai_story_engine
from backend.modules.audio_manager import audio_manager

def sanitize_filename(text: Optional[str], max_length: int = 30) -> str:
    """Loại bỏ emoji, ký tự cấm của Windows và ký tự gây lỗi FFmpeg/URL, giữ ký tự an toàn và rút gọn độ dài"""
    if not text:
        return ""
    text = unicodedata.normalize('NFKD', str(text))
    # Loại bỏ emoji và ký tự Unicode đặc biệt ngoài dải thông thường
    text = re.sub(r'[\U00010000-\U0010ffff]', '', text)
    # Thay thế các ký tự không hợp lệ trong Windows file system và FFmpeg: \ / : * ? " < > | # % & ' ` $ ! @
    cleaned = re.sub(r'[\\/*?:"<>|#%&\'`$!@^;=~,]', '', text)
    # Thay thế khoảng trắng hoặc ký tự phân cách bằng gạch dưới
    cleaned = re.sub(r'[\s\t\n\r]+', '_', cleaned.strip())
    # Bỏ các dấu gạch dưới liên tiếp
    cleaned = re.sub(r'_+', '_', cleaned)
    cleaned = cleaned.strip(' ._-')
    return cleaned[:max_length].rstrip(' ._-')

class AIVideoEngine:
    """
    Enterprise SaaS AI Video Engine for ShortsStack:
    - Multi-provider Cloud LLM: DeepSeek, Gemini, OpenAI
    - Local Speech-to-Text: faster-whisper (CTranslate2)
    - Dynamic Subtitles: ASS Karaoke word-level popups
    - Anti-Reup Evasion: Color jitter, micro-noise, sub-perceptual speed, audio pitching, metadata wiping
    - Hardware Acceleration: Dynamic NVENC / libx264
    - Smart Cuts: Silence detection snapping
    """

    def __init__(self, output_dir: Path = RENDERED_DIR):
        self.output_dir = output_dir
        self.ffmpeg_bin = get_ffmpeg_binary()

    def _get_exact_media_duration(self, file_path: str) -> float:
        """Đo thời lượng chính xác của file video/audio bằng ffprobe hoặc ffmpeg"""
        if not file_path or not os.path.exists(file_path):
            return 0.0
        try:
            ffmpeg_bin = get_ffmpeg_binary()
            # 1. Thử ffprobe nếu có
            ffprobe_bin = ffmpeg_bin.replace("ffmpeg.exe", "ffprobe.exe").replace("ffmpeg", "ffprobe")
            if os.path.exists(ffprobe_bin):
                cmd = [
                    ffprobe_bin,
                    "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "json",
                    file_path
                ]
                res = subprocess.run(cmd, capture_output=True, timeout=15, creationflags=0x08000000 if sys.platform == 'win32' else 0)
                if res.returncode == 0:
                    info = json.loads(res.stdout.decode("utf-8", errors="replace"))
                    dur = float(info.get("format", {}).get("duration", 0.0))
                    if dur > 0:
                        return dur

            # 2. Dự phòng bằng chính binary ffmpeg (chạy được 100% với imageio_ffmpeg)
            cmd = [ffmpeg_bin, "-i", file_path]
            res = subprocess.run(cmd, capture_output=True, timeout=15, creationflags=0x08000000 if sys.platform == 'win32' else 0)
            stderr = res.stderr.decode("utf-8", errors="replace")
            m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", stderr)
            if m:
                h, m_, s = m.groups()
                return round(int(h) * 3600 + int(m_) * 60 + float(s), 2)
        except Exception:
            pass
        return 0.0

    def generate_ai_hook_and_copy(self, raw_title: str) -> Dict[str, str]:
        """Gọi LLM (DeepSeek / Gemini / OpenAI) sinh Hook 3s, Tiêu đề giật tít, Caption và Hashtags"""
        return llm_curator.generate_hook_and_copy(raw_title)

    def generate_dynamic_endcard_text(
        self,
        part_number: int = 1,
        total_parts: int = 1,
        video_title: str = "",
        hook_text: str = "",
        ai_provider: Optional[str] = None,
        ai_model: Optional[str] = None,
        language: str = "en"
    ) -> str:
        """
        Sinh thông điệp End-Card động (Follower Trap) 2.2s - 3.0s cuối video:
        - Nếu total_parts == 1: Tuyệt đối KHÔNG nhắc Part 2, chỉ dùng Value CTA ngách.
        - Nếu part_number == 1 and total_parts > 1: Dynamic Cliffhanger gợi mở Part 2.
        - Nếu 1 < part_number < total_parts: Hướng dẫn xem tập tiếp theo.
        - Nếu part_number == total_parts and total_parts > 1: Cảm ơn trọn bộ + Follow đón series mới.
        - Xáo trộn câu từ chống triệt để thuật toán OCR template churn của TikTok.
        """
        is_single = (total_parts <= 1)
        is_part1 = (part_number == 1 and total_parts > 1)
        is_mid = (1 < part_number < total_parts and total_parts > 1)
        is_end = (part_number == total_parts and total_parts > 1)

        lang_code = (language or "en").lower().strip()
        is_vn = (lang_code == "vi")
        target_lang_name = "Vietnamese" if is_vn else ("Japanese" if lang_code == "ja" else ("Korean" if lang_code == "ko" else ("German" if lang_code == "de" else ("Spanish" if lang_code == "es" else ("French" if lang_code == "fr" else "English")))))

        # 1. Thử sinh qua LLM theo ngôn ngữ video và ngữ cảnh câu chuyện
        try:
            from backend.modules.ai_addon.llm_curator import llm_curator
            if is_single:
                role_desc = f"Single standalone video (1 part only). NEVER mention Part 2 or episode. Short CTA (< 8 words) in {target_lang_name} encouraging follow for more secrets."
            elif is_part1:
                role_desc = f"Part 1 of series. Short cliffhanger CTA (< 8 words) in {target_lang_name} hooking viewer to watch Part 2 on the channel."
            elif is_mid:
                role_desc = f"Part {part_number}/{total_parts}. Short CTA (< 8 words) in {target_lang_name} telling viewer to watch Part {part_number+1} on channel."
            else:
                role_desc = f"Final Part ({total_parts}/{total_parts}). Short CTA (< 8 words) in {target_lang_name} thanking viewer and telling them to follow for tomorrow's new case."

            sys_p = (
                f"You are a viral TikTok editor. Output strictly a 5-7 word punchy viewer-facing call to action in {target_lang_name}.\n"
                "CRITICAL INSTRUCTIONS:\n"
                "1. Output ONLY the viewer-facing sentence itself (e.g. 'Follow for more universe secrets' or 'Watch Part 2 for the truth').\n"
                "2. DO NOT include any labels, prefixes, category names, or tags such as 'banner_cta', 'banner:', 'cta:', 'text:'.\n"
                "3. NEVER use quotes, brackets, or preamble. Return ONLY the sentence to display on screen."
            )
            usr_p = f"Video: '{video_title}'. Context: {role_desc}. Output ONLY the call to action sentence:"

            raw = llm_curator.query_llm(
                system_prompt=sys_p,
                user_prompt=usr_p,
                task="dynamic_endcard",
                custom_provider=None if ai_provider == "default" else ai_provider,
                custom_model=None if ai_model == "default" else ai_model
            )
            if raw and len(raw.strip()) > 4:
                clean_txt = raw.strip().replace('"', '').replace("'", "").replace("\n", " ").strip()
                # Triệt tiêu mọi tiền tố nhãn do LLM tự ý sinh ra (banner_cta, cta, banner, text...)
                p_pattern = r'^(banner[_\s\-]*cta|cta[_\s\-]*banner|call[_\s\-]*to[_\s\-]*action|end[_\s\-]*card|banner|cta|text|caption)\s*[:\-–—_=\s]\s*'
                for _ in range(3):
                    clean_txt = re.sub(p_pattern, '', clean_txt, flags=re.IGNORECASE).strip()
                if len(clean_txt) <= 50:
                    return f"👉 {clean_txt}"
        except Exception:
            pass

        # 2. Rule-based Spintax đa dạng chống trùng lặp OCR theo từng ngôn ngữ
        import random
        if is_vn:
            if is_single:
                options = [
                    "👉 Follow kênh để biết thêm nhiều bí mật chưa kể!",
                    "👉 Thả tim & Follow để cùng giải mã bí ẩn tiếp theo!",
                    "👉 Nhấn Follow để không bỏ lỡ những sự thật khó tin!",
                    "👉 Bấm Follow kênh để xem thêm nhiều câu chuyện chấn động!"
                ]
            elif is_part1:
                options = [
                    "👉 Đón xem cái kết bất ngờ ở PART 2!",
                    "👉 Lời giải chấn động hé lộ trong PART 2!",
                    "👉 Cú twist kinh hoàng nằm ở PART 2!",
                    "👉 Theo dõi kênh để xem ngay PART 2!"
                ]
            elif is_mid:
                options = [
                    f"👉 Theo dõi kênh xem ngay TẬP {part_number + 1}!",
                    f"👉 Diễn biến gay cấn tiếp theo ở PART {part_number + 1}!",
                    f"👉 Bấm Follow để không bỏ lỡ PART {part_number + 1}!"
                ]
            else:
                options = [
                    "👉 Cảm ơn bạn đã xem! Follow đón xem đại án ngày mai!",
                    "👉 Theo dõi kênh để đón xem kỳ án mới vào 19h hàng ngày!",
                    "👉 Bạn thấy sao về kết cục này? Follow đón xem series mới!"
                ]
        else:
            # English & Global Fallback
            if is_single:
                options = [
                    "👉 Follow for more insane untold stories!",
                    "👉 Tap Follow so you never miss the truth!",
                    "👉 Follow to discover what happens next!",
                    "👉 Hit Follow for more mind-blowing moments!"
                ]
            elif is_part1:
                options = [
                    "👉 Watch the shocking climax in PART 2!",
                    "👉 The real twist is revealed in PART 2!",
                    "👉 Check channel right now for PART 2!",
                    "👉 Follow to see the insane ending in PART 2!"
                ]
            elif is_mid:
                options = [
                    f"👉 Follow channel to watch PART {part_number + 1}!",
                    f"👉 The story continues in PART {part_number + 1}!",
                    f"👉 Follow so you do not miss PART {part_number + 1}!"
                ]
            else:
                options = [
                    "👉 Thanks for watching! Follow for tomorrow's series!",
                    "👉 Follow to catch our new story tomorrow!",
                    "👉 What do you think? Follow for more crazy stories!"
                ]
        return random.choice(options)

    def process_transformative_video(
        self,
        input_file: str,
        video_id: str,
        part_number: int = 1,
        start_time: float = 0.0,
        duration: float = 65.0,  # Chuẩn > 60s cho TikTok Creator Rewards
        flip_horizontal: bool = True,
        speed_factor: float = 1.025,
        channel_name: Optional[str] = None,
        video_title: Optional[str] = None,
        output_dir: Optional[str] = None,
        enable_subtitles: Optional[bool] = None,
        transcript_segments: Optional[List[Dict[str, Any]]] = None,
        hook_text: Optional[str] = None,
        add_part_label: bool = True,
        subtitle_style: Optional[str] = None,
        subtitle_position: Optional[str] = None,
        bgm_folder: Optional[str] = None,
        bgm_volume: Optional[float] = None,
        variant_tag: str = "",
        specific_bgm_path: Optional[str] = None,
        generate_variants: bool = False,
        hook_angle: Optional[str] = "auto",
        enable_narration: bool = False,
        narration_language: str = "original",
        voice_gender: str = "male",
        narration_style: str = "giat_gan",
        custom_provider: Optional[str] = None,
        custom_model: Optional[str] = None,
        total_parts: int = 1,
        enable_endcard: bool = True,
        enable_ken_burns: bool = True,
        **kwargs
    ) -> Optional[str]:
        """
        Xử lý video hoàn chỉnh chuẩn Enterprise SaaS:
        1. Format dọc 9:16 với nền mờ phóng to (Blurred backdrop)
        2. Tự động burn phụ đề động Karaoke nếu bật
        3. Áp dụng toàn bộ bộ lọc Anti-Detection (Color grading, Noise pHash, Audio pitch/resample)
        4. Tối ưu phần cứng với GPU NVENC hoặc CPU libx264
        5. Tích hợp nhạc nền BGM chủ đề theo kênh (Shuffle + Volume ducking + Fade-out 2s)
        6. Xóa sạch metadata gốc (-map_metadata -1)
        7. Kiểm tra chất lượng (Quality Check) trước khi xuất
        """
        if not os.path.exists(input_file):
            log_event("ERROR", f"Không tìm thấy file video đầu vào: {input_file}")
            return None

        # Tra cứu thông tin kênh, tiêu đề và cấu hình BGM từ database nếu thiếu
        if not channel_name or not video_title or not output_dir or bgm_folder is None:
            try:
                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT v.title, c.display_name, c.title as ch_title, c.render_dir as ch_render_dir,
                           c.bgm_folder, c.bgm_volume
                    FROM videos v
                    LEFT JOIN channels c ON v.channel_id = c.channel_id
                    WHERE v.yt_video_id = ?
                ''', (video_id,))
                row = cursor.fetchone()
                conn.close()
                if row:
                    if not video_title:
                        video_title = row["title"] or ""
                    if not channel_name:
                        channel_name = row["display_name"] or row["ch_title"] or ""
                    if not output_dir and row["ch_render_dir"] and os.path.exists(row["ch_render_dir"]):
                        output_dir = row["ch_render_dir"]
                    if bgm_folder is None and "bgm_folder" in row.keys():
                        bgm_folder = row["bgm_folder"] or ""
                    if bgm_volume is None and "bgm_volume" in row.keys() and row["bgm_volume"]:
                        bgm_volume = float(row["bgm_volume"])
            except Exception:
                pass

        safe_channel = sanitize_filename(channel_name, max_length=25)
        safe_title = sanitize_filename(video_title, max_length=35)

        base_target_dir = Path(output_dir) if output_dir else self.output_dir
        if channel_name and channel_name.strip() and channel_name.strip() not in ("Dán trực tiếp", "Direct Links"):
            clean_ch = re.sub(r'[\\/*?:"<>|]', '', channel_name).strip()
            if base_target_dir.name.lower() == clean_ch.lower():
                target_dir = base_target_dir
            else:
                target_dir = base_target_dir / (clean_ch or "Direct Links")
        else:
            target_dir = base_target_dir / "Direct Links"
        target_dir.mkdir(parents=True, exist_ok=True)

        parts = []
        if safe_channel:
            parts.append(f"[{safe_channel}]")
        if safe_title:
            parts.append(safe_title)
        parts.append(video_id)
        if variant_tag and variant_tag.strip():
            parts.append(variant_tag.strip())
        elif add_part_label or part_number > 1:
            parts.append(f"Part{part_number}")

        clean_filename = "_".join(parts) + ".mp4"
        output_file = str(target_dir / clean_filename)
        log_event("INFO", f"Bắt đầu render video AI Reup {video_id} (Part {part_number}, duration {duration:.1f}s) -> {clean_filename}")

        # Chọn bài hát BGM thông minh (Mood / Cảm xúc + Dò điểm Beat Drop)
        selected_bgm = None
        bgm_start_offset = 0.0
        used_bgm_cat = ""
        target_bgm_vol = bgm_volume if bgm_volume is not None else 0.15

        if specific_bgm_path and os.path.exists(specific_bgm_path):
            selected_bgm = specific_bgm_path
            bgm_start_offset = audio_manager.find_beat_drop_offset(selected_bgm)
            used_bgm_cat = "distinct_variant"
            log_event(
                "INFO",
                f"🎵 Áp dụng BGM biến thể độc quyền: {Path(selected_bgm).name} "
                f"(Beat Drop: {bgm_start_offset:.1f}s, Sidechain Auto-Ducking: BẬT, Vol: {int(target_bgm_vol*100)}%) "
                f"cho {clean_filename}"
            )
        elif bgm_folder and bgm_folder.strip():
            folder_choice = bgm_folder.strip().lower()
            if folder_choice not in ("none", "off", "disable", "disabled", "no_bgm", "inherit"):
                transcript_sample = ""
                if transcript_segments:
                    # Lọc transcript theo đúng đoạn clip đã cắt (start_time → start_time + duration)
                    # để AI phân tích mood chính xác từ nội dung thực sự được render
                    clip_end = start_time + duration
                    clip_segs = [s for s in transcript_segments if s.get("end", 0) > start_time and s.get("start", 0) < clip_end]
                    if clip_segs:
                        transcript_sample = " ".join(s.get("text", "") for s in clip_segs[:8])
                    else:
                        transcript_sample = " ".join(s.get("text", "") for s in transcript_segments[:8])
                elif video_title:
                    transcript_sample = video_title

                selected_bgm, bgm_start_offset, used_bgm_cat = audio_manager.get_smart_bgm(
                    folder_or_mood=bgm_folder.strip(),
                    transcript_text=transcript_sample
                )
                if selected_bgm:
                    log_event(
                        "INFO",
                        f"🎵 Áp dụng BGM thông minh [{used_bgm_cat}]: {Path(selected_bgm).name} "
                        f"(Beat Drop: {bgm_start_offset:.1f}s, Sidechain Auto-Ducking: BẬT, Vol: {int(target_bgm_vol*100)}%) "
                        f"cho {clean_filename}"
                    )
                else:
                    logger.warning(f"Thư mục nhạc nền [{bgm_folder}] chưa có bài hát nào, sẽ render âm thanh gốc.")

        # 🎙️ Xử lý Lồng Tiếng AI (AI Voiceover Re-narration) & Đồng bộ Phụ Đề
        temp_voice_file = None
        has_narration = False
        narration_segments = None

        if enable_narration:
            try:
                from backend.modules.ai_addon.ai_narrator import ai_narrator
                if transcript_segments is None:
                    try:
                        transcript_segments = whisper_transcriber.transcribe(input_file, model_size=WHISPER_MODEL_SIZE)
                    except Exception as e:
                        log_event("WARNING", f"Không thể tự động transcribe cho lồng tiếng: {e}")

                clip_transcript = []
                if transcript_segments:
                    for seg in transcript_segments:
                        s_start = seg.get("start", 0.0)
                        s_end = seg.get("end", 0.0)
                        if s_end > start_time and s_start < (start_time + duration):
                            clip_transcript.append(seg)
                if not clip_transcript and transcript_segments:
                    clip_transcript = transcript_segments

                if clip_transcript:
                    temp_voice_file = str(target_dir / f"{video_id}_part{part_number}_narration.mp3")
                    narr_res = ai_narrator.generate_narration_audio(
                        transcript_segments=clip_transcript,
                        output_audio_path=temp_voice_file,
                        target_language=narration_language,
                        gender=voice_gender,
                        style=narration_style,
                        target_duration=duration,
                        ai_provider=custom_provider or "default",
                        ai_model=custom_model or "default"
                    )
                    if narr_res.get("success") and os.path.exists(temp_voice_file):
                        has_narration = True
                        narration_segments = narr_res.get("transcript_segments", [])
                        if not hook_text and narr_res.get("hook"):
                            hook_text = narr_res.get("hook")
                        log_event(
                            "INFO",
                            f"🎙️ [LỒNG TIẾNG AI THÀNH CÔNG] Video {video_id} Part {part_number}: "
                            f"Ngôn ngữ=[{narration_language}], Giọng=[{voice_gender}], Style=[{narration_style}], "
                            f"Đã cập nhật phụ đề đồng bộ ({len(narration_segments)} câu)."
                        )
            except Exception as narr_err:
                logger.error(f"Lỗi khi xử lý lồng tiếng AI cho video {video_id}: {narr_err}")
                log_event("WARNING", f"Lỗi lồng tiếng AI, sẽ giữ âm thanh gốc: {narr_err}")

        # Chuẩn bị phụ đề Karaoke .ass nếu bật
        sub_ass_path = None
        should_sub = enable_subtitles if enable_subtitles is not None else ENABLE_DYNAMIC_SUBTITLES
        if should_sub:
            # Ưu tiên sử dụng phụ đề mới khớp 100% giọng đọc AI nếu bật lồng tiếng
            if has_narration and narration_segments:
                temp_ass = str(target_dir / f"{video_id}_part{part_number}_temp.ass")
                sub_ass_path = ass_subtitle_generator.generate_karaoke_ass(
                    transcript_segments=narration_segments,
                    output_ass_path=temp_ass,
                    start_offset=0.0,  # File giọng đọc AI bắt đầu từ 0.0 của clip đã cắt
                    max_duration=duration,
                    style_name=subtitle_style or SUBTITLE_STYLE,
                    position=subtitle_position or SUBTITLE_POSITION,
                    font_size=SUBTITLE_FONT_SIZE
                )
            else:
                if transcript_segments is None:
                    try:
                        transcript_segments = whisper_transcriber.transcribe(input_file, model_size=WHISPER_MODEL_SIZE)
                    except Exception as e:
                        log_event("WARNING", f"Không thể tự động transcribe: {e}")

                if transcript_segments:
                    temp_ass = str(target_dir / f"{video_id}_part{part_number}_temp.ass")
                    sub_ass_path = ass_subtitle_generator.generate_karaoke_ass(
                        transcript_segments=transcript_segments,
                        output_ass_path=temp_ass,
                        start_offset=start_time,
                        max_duration=duration,
                        style_name=subtitle_style or SUBTITLE_STYLE,
                        position=subtitle_position or SUBTITLE_POSITION,
                        font_size=SUBTITLE_FONT_SIZE
                    )

        # Tạo câu End-Card động (Follower Trap) 2.2s - 3.0s cuối nếu bật (khớp chuẩn ngôn ngữ video)
        ec_text = None
        effective_lang = narration_language if (has_narration and narration_language not in ("original", "auto", "")) else "en"
        if enable_endcard:
            ec_text = self.generate_dynamic_endcard_text(
                part_number=part_number,
                total_parts=total_parts,
                video_title=video_title or "",
                hook_text=hook_text or "",
                ai_provider=custom_provider,
                ai_model=custom_model,
                language=effective_lang
            )

        # Xây dựng Filter Complex chống kiểm duyệt
        # Lưu ý: Khi có giọng đọc AI (has_narration=True), giữ speed_factor=1.0 để phụ đề Karaoke khớp 100% với khẩu hình/âm thanh
        eff_speed_factor = 1.0 if has_narration else speed_factor
        filter_complex, out_map, audio_filter = anti_detect_engine.build_filter_complex(
            part_number=part_number,
            hook_text=hook_text,
            flip_horizontal=flip_horizontal,
            speed_factor=eff_speed_factor,
            subtitle_ass_path=sub_ass_path,
            enable_anti_detect=ENABLE_ANTI_DETECT,
            add_part_label=add_part_label,
            enable_ken_burns=enable_ken_burns,
            endcard_text=ec_text,
            video_duration=duration
        )

        # Cờ encoder tối ưu (NVENC hoặc CPU libx264)
        encoder_flags = get_optimal_video_encoder_flags()

        has_bgm = bool(selected_bgm and os.path.exists(selected_bgm))
        fade_start = max(0.0, float(duration) - 2.0)

        bgm_boost_vol = min(1.0, target_bgm_vol * 1.6)

        if has_narration:
            # SỬ DỤNG GIỌNG ĐỌC AI MỚI TOANH (ZERO-UNORIGINAL CONTENT)
            # Giọng AI nguyên bản chất lượng cao, KHÔNG áp dụng pitch-shifting hay atempo để giọng đọc giữ trọn độ nét tự nhiên
            if has_bgm:
                # Video(0), AI Voice(1), BGM(2) -> apad trên voice để khi hết thoại, BGM vẫn tiếp tục phát mượt mà đến hết video
                full_filter_complex = (
                    f"{filter_complex};"
                    f"[1:a]apad=whole_dur={duration},asplit=2[a_voice_main][a_voice_side];"
                    f"[2:a]volume={bgm_boost_vol:.2f},afade=t=out:st={fade_start:.1f}:d=2[a_bgm_raw];"
                    f"[a_bgm_raw][a_voice_side]sidechaincompress=threshold=0.08:ratio=3.5:attack=50:release=350[a_bgm_ducked];"
                    f"[a_voice_main][a_bgm_ducked]amix=inputs=2:duration=first:dropout_transition=2[a_out]"
                )
                cmd = [
                    self.ffmpeg_bin,
                    "-y",
                    "-ss", str(start_time),
                    "-t", str(duration),
                    "-i", input_file,
                    "-i", temp_voice_file,
                    "-ss", str(bgm_start_offset),
                    "-stream_loop", "-1",
                    "-i", selected_bgm,
                    "-filter_complex", full_filter_complex,
                    "-map", f"[{out_map}]",
                    "-map", "[a_out]"
                ]
            else:
                # Video(0), AI Voice(1) -> apad để giữ audio đầy đủ
                full_filter_complex = (
                    f"{filter_complex};"
                    f"[1:a]apad=whole_dur={duration}[a_voice]"
                )
                cmd = [
                    self.ffmpeg_bin,
                    "-y",
                    "-ss", str(start_time),
                    "-t", str(duration),
                    "-i", input_file,
                    "-i", temp_voice_file,
                    "-filter_complex", full_filter_complex,
                    "-map", f"[{out_map}]",
                    "-map", "[a_voice]"
                ]
        else:
            # GIỮ NGUYÊN ÂM THANH GỐC CỦA VIDEO
            if has_bgm:
                full_filter_complex = (
                    f"{filter_complex};"
                    f"[0:a]{audio_filter},asplit=2[a_voice_main][a_voice_side];"
                    f"[1:a]volume={bgm_boost_vol:.2f},afade=t=out:st={fade_start:.1f}:d=2[a_bgm_raw];"
                    f"[a_bgm_raw][a_voice_side]sidechaincompress=threshold=0.08:ratio=3.5:attack=50:release=350[a_bgm_ducked];"
                    f"[a_voice_main][a_bgm_ducked]amix=inputs=2:duration=first:dropout_transition=2[a_out]"
                )
                cmd = [
                    self.ffmpeg_bin,
                    "-y",
                    "-ss", str(start_time),
                    "-t", str(duration),
                    "-i", input_file,
                    "-ss", str(bgm_start_offset),
                    "-stream_loop", "-1",
                    "-i", selected_bgm,
                    "-filter_complex", full_filter_complex,
                    "-map", f"[{out_map}]",
                    "-map", "[a_out]"
                ]
            else:
                full_filter_complex = filter_complex
                cmd = [
                    self.ffmpeg_bin,
                    "-y",
                    "-ss", str(start_time),
                    "-t", str(duration),
                    "-i", input_file,
                    "-filter_complex", filter_complex,
                    "-map", f"[{out_map}]",
                    "-map", "0:a",
                    "-af", audio_filter
                ]

        cmd.extend(encoder_flags)
        cmd.extend([
            "-c:a", "aac",
            "-b:a", "128k",
            "-ar", "44100",
            "-threads", "2",             # Giới hạn threads để tiết kiệm RAM trên máy 8GB (tránh x264 malloc failed)
            "-t", str(duration),
            "-map_metadata", "-1",       # Xóa toàn bộ metadata gốc chống đối soát bản quyền
            "-movflags", "+faststart",   # Web-optimized MP4
            output_file
        ])

        try:
            # Giải phóng bộ nhớ Python trước khi chạy FFmpeg (tránh OOM trên máy 8GB RAM)
            import gc
            gc.collect()
            logger.debug(f"Thực thi lệnh FFmpeg render: {' '.join(cmd[:12])}...")
            cflags = 0x08000000 if sys.platform == "win32" else 0  # CREATE_NO_WINDOW
            process = subprocess.run(cmd, capture_output=True, timeout=900, creationflags=cflags)
            stderr_text = process.stderr.decode("utf-8", errors="replace") if process.stderr else ""
            stdout_text = process.stdout.decode("utf-8", errors="replace") if process.stdout else ""

            # Nếu chạy bằng NVENC mà bị crash/lỗi encoder -> Fallback tự động sang CPU libx264
            if process.returncode != 0 and "nvenc" in " ".join(encoder_flags).lower():
                logger.warning("NVENC GPU Render thất bại. Đang tự động chuyển sang CPU libx264 fallback...")
                cpu_flags = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p"]
                if has_bgm:
                    fallback_cmd = [
                        self.ffmpeg_bin, "-y",
                        "-ss", str(start_time),
                        "-t", str(duration),
                        "-i", input_file,
                        "-ss", str(bgm_start_offset),
                        "-stream_loop", "-1",
                        "-i", selected_bgm,
                        "-filter_complex", full_filter_complex,
                        "-map", f"[{out_map}]",
                        "-map", "[a_out]"
                    ]
                else:
                    fallback_cmd = [
                        self.ffmpeg_bin, "-y",
                        "-ss", str(start_time),
                        "-t", str(duration),
                        "-i", input_file,
                        "-filter_complex", filter_complex,
                        "-map", f"[{out_map}]",
                        "-map", "0:a",
                        "-af", audio_filter
                    ]
                fallback_cmd.extend(cpu_flags)
                fallback_cmd.extend([
                    "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
                    "-t", str(duration),
                    "-map_metadata", "-1", "-movflags", "+faststart",
                    output_file
                ])
                process = subprocess.run(fallback_cmd, capture_output=True, timeout=900, creationflags=cflags)
                stderr_text = process.stderr.decode("utf-8", errors="replace") if process.stderr else ""

            if process.returncode == 0 and os.path.exists(output_file):
                # Kiểm tra chất lượng (Quality Check)
                is_valid, qc_msg = quality_checker.check_clip_quality(output_file, min_duration=min(60, int(duration - 2)))
                if not is_valid:
                    log_event("WARNING", f"Cảnh báo QC cho {clean_filename}: {qc_msg}")

                log_event("INFO", f"Render thành công video AI: {output_file} ({qc_msg})")

                # Cập nhật đường dẫn rendered vào DB
                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE videos SET rendered_path = ?, status = 'rendered', error_message = NULL WHERE yt_video_id = ?",
                    (output_file, video_id)
                )
                conn.commit()
                conn.close()

                return output_file
            else:
                err_lower = stderr_text.lower()
                classified_msg = "Lỗi không xác định khi render FFmpeg"
                if "cannot allocate memory" in err_lower or "out of memory" in err_lower:
                    classified_msg = "Không đủ bộ nhớ RAM để render video (Out of Memory)"
                elif "no space left on device" in err_lower:
                    classified_msg = "Hết dung lượng ổ đĩa khi lưu video render"
                elif "invalid data found" in err_lower:
                    classified_msg = "File video đầu vào bị lỗi hoặc không thể đọc"
                elif "subtitles" in err_lower or ".ass" in err_lower:
                    classified_msg = "Lỗi biên dịch phụ đề ASS Karaoke trong filter FFmpeg"
                elif stderr_text:
                    classified_msg = f"Lỗi FFmpeg (Exit code {process.returncode}): {stderr_text[-300:].strip()}"

                logger.error(f"Lỗi render video {video_id}: {classified_msg}\nFFmpeg Stderr:\n{stderr_text[-1200:]}")
                log_event("ERROR", f"Lỗi render video {video_id}: {classified_msg}", details=stderr_text[-600:])

                try:
                    conn = get_connection()
                    cursor = conn.cursor()
                    cursor.execute(
                        "UPDATE videos SET status = 'error', error_message = ? WHERE yt_video_id = ?",
                        (classified_msg, video_id)
                    )
                    conn.commit()
                    conn.close()
                except Exception:
                    pass

        except Exception as e:
            logger.exception(f"Ngoại lệ khi render video {video_id}: {e}")
            log_event("ERROR", f"Ngoại lệ khi render video {video_id}: {str(e)}")
            try:
                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE videos SET status = 'error', error_message = ? WHERE yt_video_id = ?",
                    (f"Lỗi hệ thống render: {str(e)}", video_id)
                )
                conn.commit()
                conn.close()
            except Exception:
                pass
        finally:
            # Dọn dẹp file .ass tạm thời
            if sub_ass_path and os.path.exists(sub_ass_path):
                try:
                    os.remove(sub_ass_path)
                except Exception:
                    pass
            # Dọn dẹp file audio lồng tiếng tạm thời
            if temp_voice_file and os.path.exists(temp_voice_file):
                try:
                    os.remove(temp_voice_file)
                except Exception:
                    pass

        return None

    def auto_slice_and_render_parts(
        self,
        input_file: str,
        video_id: str,
        total_duration: int,
        part_duration: int = 65,
        channel_name: Optional[str] = None,
        video_title: Optional[str] = None,
        output_dir: Optional[str] = None,
        max_clips: int = 5,
        add_part_label: bool = True,
        enable_subtitles: Optional[bool] = None,
        flip_horizontal: bool = True,
        speed_factor: float = 1.025,
        subtitle_style: Optional[str] = None,
        subtitle_position: Optional[str] = None,
        bgm_folder: Optional[str] = None,
        bgm_volume: Optional[float] = None,
        disable_subtitle_for_shorts: bool = False,
        disable_narration_for_shorts: bool = False,
        keep_original_script_for_shorts: bool = False,
        enable_narration: bool = False,
        narration_language: str = "original",
        voice_gender: str = "male",
        narration_style: str = "giat_gan",
        custom_provider: Optional[str] = None,
        custom_model: Optional[str] = None,
        enable_endcard: bool = True,
        enable_ken_burns: bool = True
    ) -> List[str]:
        """
        Tự động cắt video dài thành nhiều Part bằng cách dùng Silence Detector để ngắt tại khoảng lặng câu
        """
        rendered_files = []

        # Đo thời lượng thực tế chính xác và kiểm tra có phải là Shorts/Short-form không (<= 180s)
        actual_dur = self._get_exact_media_duration(input_file)
        if actual_dur > 0:
            total_duration = actual_dur
        is_short_form = (total_duration <= 180.0)

        # Video ngắn / Shorts: Tự động giữ nguyên chiều gốc (không lật ngang) để tránh ngược chữ/tiêu đề
        effective_flip = False if is_short_form else flip_horizontal
        effective_speed = 1.0 if is_short_form else speed_factor
        if is_short_form and flip_horizontal:
            log_event("INFO", f"Video {video_id} là Short-form ({total_duration:.1f}s <= 180s) -> Tự động giữ nguyên chiều gốc (tắt lật hình) để bảo vệ tiêu đề/chữ trong video.")
        if is_short_form and abs(speed_factor - 1.0) > 0.001:
            log_event("INFO", f"Video {video_id} là Short-form ({total_duration:.1f}s <= 180s) -> Tự động giữ nguyên tốc độ gốc 1.0x để đảm bảo âm thanh và phụ đề khớp 100%.")

        effective_enable_subtitles = enable_subtitles
        if is_short_form and disable_subtitle_for_shorts:
            effective_enable_subtitles = False

        effective_enable_narration = enable_narration
        effective_narration_style = narration_style
        if is_short_form:
            if disable_narration_for_shorts and enable_narration:
                effective_enable_narration = False
                log_event("INFO", f"Video {video_id} là Short-form ({total_duration:.1f}s <= 180s) -> Đã bật 'Giữ âm thanh gốc cho Shorts' -> Giữ nguyên âm thanh & phụ đề gốc (Bỏ qua giọng đọc AI).")
            elif keep_original_script_for_shorts and enable_narration:
                effective_narration_style = "goc_nguyen_van"
                log_event("INFO", f"Video {video_id} là Short-form ({total_duration:.1f}s <= 180s) và đã bật 'Giữ nguyên văn kịch bản gốc' -> Ép buộc style 'goc_nguyen_van' để khớp phụ đề Shorts.")

        if is_short_form or total_duration <= part_duration + 10 or max_clips <= 1:
            # Video ngắn / Shorts hoặc chỉ yêu cầu 1 clip -> Xử lý 1 part duy nhất
            # Đối với Shorts: không đóng dấu chữ PART và giữ trọn vẹn độ dài video
            effective_part_label = False if is_short_form else add_part_label
            eff_dur = total_duration if is_short_form else float(max(61, total_duration if total_duration <= part_duration + 10 else part_duration))
            f = self.process_transformative_video(
                input_file=input_file,
                video_id=video_id,
                part_number=1,
                start_time=0.0,
                duration=eff_dur,
                channel_name=channel_name,
                video_title=video_title,
                output_dir=output_dir,
                enable_subtitles=effective_enable_subtitles,
                flip_horizontal=effective_flip,
                speed_factor=speed_factor,
                add_part_label=effective_part_label,
                subtitle_style=subtitle_style,
                subtitle_position=subtitle_position,
                bgm_folder=bgm_folder,
                bgm_volume=bgm_volume,
                enable_narration=effective_enable_narration,
                narration_language=narration_language,
                voice_gender=voice_gender,
                narration_style=effective_narration_style,
                custom_provider=custom_provider,
                custom_model=custom_model,
                total_parts=1,
                enable_endcard=enable_endcard,
                enable_ken_burns=enable_ken_burns
            )
            if f:
                rendered_files.append(f)
        else:
            # Video dài (Long-form > 3 phút) -> Dò khoảng lặng và cắt theo từng Part (tối đa max_clips)
            # Safe boundary: Loại bỏ 15s cuối của video gốc để tránh lọt YouTube End Screens / Subscribe overlay cards
            safe_max_end = max(61.0, total_duration - 15.0) if total_duration > 180 else total_duration
            current_start = 0.0
            part_idx = 1
            max_parts = max_clips if max_clips < 100 else 99

            while current_start < (safe_max_end - 45) and part_idx <= max_parts:
                # Tìm điểm cắt thông minh bằng silence detector
                cut_point = silence_detector.get_optimal_cut_point(
                    video_path=input_file,
                    start_time=current_start,
                    target_duration=float(part_duration),
                    min_duration=60.5,
                    max_duration=min(float(part_duration + 20), max(61.0, safe_max_end - current_start))
                )

                chunk_dur = cut_point - current_start
                if chunk_dur < 60:
                    chunk_dur = float(part_duration)

                if (current_start + chunk_dur) > safe_max_end:
                    chunk_dur = safe_max_end - current_start
                    if chunk_dur < 60.0:
                        break

                f = self.process_transformative_video(
                    input_file=input_file,
                    video_id=video_id,
                    part_number=part_idx,
                    start_time=current_start,
                    duration=chunk_dur,
                    channel_name=channel_name,
                    video_title=video_title,
                    output_dir=output_dir,
                    enable_subtitles=enable_subtitles,
                    flip_horizontal=effective_flip,
                    speed_factor=speed_factor,
                    add_part_label=add_part_label,
                    subtitle_style=subtitle_style,
                    subtitle_position=subtitle_position,
                    bgm_folder=bgm_folder,
                    bgm_volume=bgm_volume,
                    enable_narration=enable_narration,
                    narration_language=narration_language,
                    voice_gender=voice_gender,
                    narration_style=narration_style,
                    custom_provider=custom_provider,
                    custom_model=custom_model,
                    total_parts=max_parts,
                    enable_endcard=enable_endcard,
                    enable_ken_burns=enable_ken_burns
                )
                if f:
                    rendered_files.append(f)

                current_start = cut_point
                part_idx += 1

        return rendered_files

    def generate_viral_variants(
        self,
        input_file: str,
        video_id: str,
        channel_name: str,
        video_title: str,
        output_dir: str,
        start_time: float,
        duration: float,
        hooks_dict: Dict[str, str],
        transcript_segments: Optional[List[Dict[str, Any]]] = None,
        enable_subtitles: bool = True,
        flip_horizontal: bool = True,
        bgm_folder: Optional[str] = None,
        bgm_volume: Optional[float] = None,
        distinct_moments: Optional[List[Dict[str, Any]]] = None
    ) -> List[str]:
        """
        Tạo 3 biến thể nội dung độc lập sâu (Deep Variant Differentiation - Gap 1):
        - Nếu có distinct_moments (các phân đoạn không trùng lặp từ video nguồn):
          * Variant A: Phân đoạn 1 (vd: Tranh luận Geofencing) + BGM Track 1
          * Variant B: Phân đoạn 2 (vd: Bóc mẽ Cambridge Analytica) + BGM Track 2 (Scene & Audio hoàn toàn khác!)
          * Variant C: Phân đoạn 3 (vd: Google Search Manipulation) + BGM Track 3
          -> Triệt tiêu 100% rủi ro Semantic Clustering / Speech Fingerprinting của TikTok!
        - Nếu video ngắn hoặc chỉ có 1 phân đoạn:
          * Biến thể bằng góc Hook tâm lý, First Frame Offset (+1.0s), Tốc độ và xoay vòng BGM.
        """
        variants = []
        transcript_sample = ""
        if transcript_segments:
            transcript_sample = " ".join(s.get("text", "") for s in transcript_segments[:15])
        elif video_title:
            transcript_sample = video_title

        if not bgm_folder or bgm_folder.strip().lower() in ("none", "off", "disable", "disabled", "no_bgm"):
            distinct_bgms = []
        else:
            distinct_bgms = audio_manager.get_distinct_bgm_tracks(
                folder_or_mood=bgm_folder,
                count=3,
                transcript_text=transcript_sample
            )

        # Trường hợp 1: Có nhiều phân đoạn độc lập từ LLM (Deep Multi-Scene Differentiation)
        if distinct_moments and len(distinct_moments) >= 2:
            tags = ["VarA", "VarB", "VarC"]
            speeds = [1.025, 1.03, 1.035]
            for idx, m in enumerate(distinct_moments[:3]):
                m_st = m.get("start_time", start_time)
                m_dur = m.get("duration", duration)
                m_hook = m.get("hook_3s") or hooks_dict.get("hook_3s") or "WAIT TILL THE END"
                m_title = m.get("viral_title") or video_title
                tag = tags[idx]
                spd = speeds[idx]
                bgm_path = distinct_bgms[idx][0] if idx < len(distinct_bgms) else None

                var_path = self.process_transformative_video(
                    input_file=input_file,
                    video_id=video_id,
                    part_number=1,
                    start_time=m_st,
                    duration=m_dur,
                    channel_name=channel_name,
                    video_title=m_title,
                    output_dir=output_dir,
                    enable_subtitles=enable_subtitles,
                    transcript_segments=transcript_segments,
                    hook_text=m_hook,
                    flip_horizontal=flip_horizontal,
                    speed_factor=spd,
                    bgm_folder=bgm_folder,
                    bgm_volume=bgm_volume,
                    variant_tag=tag,
                    specific_bgm_path=bgm_path,
                    add_part_label=False
                )
                if var_path:
                    variants.append(var_path)

            if variants:
                return variants

        # Trường hợp 2: Single scene fallback (Đa dạng hóa bằng góc tâm lý & Offset khung hình)
        bgm_a = distinct_bgms[0][0] if len(distinct_bgms) > 0 else None
        bgm_b = distinct_bgms[1][0] if len(distinct_bgms) > 1 else None
        bgm_c = distinct_bgms[2][0] if len(distinct_bgms) > 2 else None

        # Variant A (Curiosity Angle)
        hook_a = hooks_dict.get("curiosity") or hooks_dict.get("hook_3s") or "NOBODY NOTICED THIS"
        var_a = self.process_transformative_video(
            input_file=input_file,
            video_id=video_id,
            part_number=1,
            start_time=start_time,
            duration=duration,
            channel_name=channel_name,
            video_title=video_title,
            output_dir=output_dir,
            enable_subtitles=enable_subtitles,
            transcript_segments=transcript_segments,
            hook_text=hook_a,
            flip_horizontal=flip_horizontal,
            speed_factor=1.025,
            bgm_folder=bgm_folder,
            bgm_volume=bgm_volume,
            variant_tag="VarA",
            specific_bgm_path=bgm_a,
            add_part_label=False
        )
        if var_a:
            variants.append(var_a)

        # Variant B (Controversy/Debate Angle + First Frame Offset +1.0s)
        hook_b = hooks_dict.get("controversy") or "HE EXPOSED THE TRUTH"
        offset_start = start_time + 1.0
        offset_dur = max(60.5, duration - 1.0)
        var_b = self.process_transformative_video(
            input_file=input_file,
            video_id=video_id,
            part_number=1,
            start_time=offset_start,
            duration=offset_dur,
            channel_name=channel_name,
            video_title=video_title,
            output_dir=output_dir,
            enable_subtitles=enable_subtitles,
            transcript_segments=transcript_segments,
            hook_text=hook_b,
            flip_horizontal=flip_horizontal,
            speed_factor=1.03,
            bgm_folder=bgm_folder,
            bgm_volume=bgm_volume,
            variant_tag="VarB",
            specific_bgm_path=bgm_b,
            add_part_label=False
        )
        if var_b:
            variants.append(var_b)

        # Variant C (Climax/Suspense Angle + High Energy 1.035x)
        hook_c = hooks_dict.get("climax") or "WAIT TILL THE END"
        var_c = self.process_transformative_video(
            input_file=input_file,
            video_id=video_id,
            part_number=1,
            start_time=start_time,
            duration=duration,
            channel_name=channel_name,
            video_title=video_title,
            output_dir=output_dir,
            enable_subtitles=enable_subtitles,
            transcript_segments=transcript_segments,
            hook_text=hook_c,
            flip_horizontal=flip_horizontal,
            speed_factor=1.035,
            bgm_folder=bgm_folder,
            bgm_volume=bgm_volume,
            variant_tag="VarC",
            specific_bgm_path=bgm_c,
            add_part_label=False
        )
        if var_c:
            variants.append(var_c)

        return variants

    def process_smart_ai_video(
        self,
        input_file: str,
        video_id: str,
        video_title: str = "",
        channel_name: str = "",
        output_dir: Optional[str] = None,
        custom_provider: Optional[str] = None,
        custom_model: Optional[str] = None,
        enable_subtitles: Optional[bool] = None,
        target_duration: int = 65,
        flip_horizontal: bool = True,
        speed_factor: float = 1.03,
        add_part_label: bool = True,
        generate_hook: bool = True,
        clips_count: int = 1,
        subtitle_style: Optional[str] = None,
        subtitle_position: Optional[str] = None,
        bgm_folder: Optional[str] = None,
        bgm_volume: Optional[float] = None,
        disable_subtitle_for_shorts: bool = False,
        disable_narration_for_shorts: bool = False,
        keep_original_script_for_shorts: bool = False,
        generate_variants: bool = False,
        hook_angle: Optional[str] = "auto",
        enable_narration: bool = False,
        narration_language: str = "original",
        voice_gender: str = "male",
        narration_style: str = "giat_gan",
        enable_endcard: bool = True,
        enable_ken_burns: bool = True,
        use_ai_images: bool = False,
        image_style: str = "cinematic",
        visual_source: str = "ai",
        ai_image_model: str = "flux",
        ai_video_model: str = "fal_ltx",
        stock_provider: str = "all"
    ) -> Dict[str, Any]:
        """
        Quy trình xử lý AI trọn gói (End-to-End Enterprise SaaS Workflow):
        1. Nhận diện giọng nói bằng faster-whisper (Local)
        2. Gửi transcript lên LLM (DeepSeek / Gemini / OpenAI) để chọn đoạn viral 60-90s và viết Hook
        3. Tự động sinh phụ đề động Karaoke dạng .ass
        4. Render video với toàn bộ bộ lọc chống quét bản quyền
        5. Cập nhật cơ sở dữ liệu và trả về kết quả hoàn chỉnh
        """
        log_event("INFO", f"Bắt đầu chuỗi Smart AI Render cho video {video_id}: {video_title} (Model: {custom_model or 'Default'}, clips_count: {clips_count})")
        hook_3s = ""
        viral_title = video_title
        description = ""
        hashtags = ""
        primary_hook = video_title

        # Bước 1: Transcribe âm thanh local
        transcript_segments = whisper_transcriber.transcribe(input_file, model_size=WHISPER_MODEL_SIZE)

        # 🎬 NẾU BẬT CHẾ ĐỘ AI STORY: TẠO VIDEO MỚI 100% BẰNG ẢNH AI & LỒNG TIẾNG AI
        if use_ai_images:
            log_event("INFO", f"🎬 [AI STORY MODE BẬT] Video {video_id}: Đang tạo video hoàn toàn mới 100% bằng Ảnh AI ({image_style}) và Lồng tiếng AI...")
            raw_text = " ".join([s.get("text", "") for s in (transcript_segments or [])]) or video_title
            mp_res = ai_story_engine.process_ai_story_video(
                raw_transcript=raw_text,
                video_id=video_id,
                video_title=video_title,
                channel_name=channel_name,
                output_dir=output_dir,
                target_duration=float(target_duration),
                target_language=narration_language,
                script_style=narration_style,
                image_style=image_style or "cinematic",
                visual_source=visual_source or "ai",
                ai_image_model=ai_image_model or "flux",
                ai_video_model=ai_video_model or "fal_ltx",
                stock_provider=stock_provider or "all",
                voice_gender=voice_gender,
                enable_subtitles=bool(enable_subtitles if enable_subtitles is not None else True),
                subtitle_style=subtitle_style or "karaoke_yellow",
                subtitle_position=subtitle_position or "center",
                bgm_folder=bgm_folder,
                bgm_volume=bgm_volume if bgm_volume is not None else 0.15,
                ai_provider=custom_provider,
                ai_model=custom_model
            )
            if mp_res.get("status") == "success":
                try:
                    conn = get_connection()
                    cursor = conn.cursor()
                    cursor.execute('''
                        UPDATE videos
                        SET rendered_path = ?, ai_hook = ?, status = 'rendered'
                        WHERE yt_video_id = ?
                    ''', (mp_res.get("rendered_file"), mp_res.get("ai_copy", {}).get("hook", ""), video_id))
                    conn.commit()
                    conn.close()
                except Exception as db_err:
                    logger.error(f"Lỗi update DB khi render AI Story: {db_err}")
                return mp_res
            else:
                log_event("WARNING", f"Lỗi render AI Story ({mp_res.get('message')}), tiếp tục render video biến đổi thông thường.")

        # Lấy tổng thời lượng video chính xác bằng ffprobe
        actual_dur = self._get_exact_media_duration(input_file)
        if actual_dur > 0:
            total_duration = actual_dur
        elif transcript_segments and transcript_segments[-1].get("end", 0.0) > 0:
            total_duration = transcript_segments[-1].get("end", 0.0)
        else:
            total_duration = 60.0

        # Kiểm tra Short-form (YouTube Shorts <= 3 phút) vs Long-form
        is_short_form = (total_duration <= 180.0)

        # Video ngắn / Shorts: Tự động giữ nguyên chiều gốc (không lật ngang) và tốc độ 1.0x để bảo vệ phụ đề và tránh lệch tiếng
        effective_flip = False if is_short_form else flip_horizontal
        effective_speed = 1.0 if is_short_form else speed_factor
        if is_short_form and flip_horizontal:
            log_event("INFO", f"Video {video_id} là Short-form ({total_duration:.1f}s <= 180s) -> Tự động giữ nguyên chiều gốc (tắt lật hình) để bảo vệ tiêu đề/chữ trong video.")
        if is_short_form and abs(speed_factor - 1.0) > 0.001:
            log_event("INFO", f"Video {video_id} là Short-form ({total_duration:.1f}s <= 180s) -> Tự động giữ nguyên tốc độ gốc 1.0x để đảm bảo âm thanh và phụ đề khớp 100%.")

        if is_short_form:
            # SHORT-FORM / YouTube Shorts (<= 180s):
            # Xuất 1 clip trọn vẹn duy nhất từ 0.0 đến hết, KHÔNG gắn nhãn PART X
            start_time = 0.0
            duration = total_duration
            effective_clips_count = 1
            effective_add_part_label = False
            curation = llm_curator.generate_hook_and_copy(video_title, video_id=video_id)
            viral_title = curation.get("viral_title") or video_title
            primary_hook = curation.get("hook") or viral_title
            hook_3s = primary_hook if generate_hook else ""
            description = curation.get("description", "")
            hashtags = curation.get("tags", "")
            log_event("INFO", f"Video {video_id} là Short-form ({total_duration:.1f}s <= 180s) -> Xuất 1 clip trọn vẹn, không chèn chữ Part.")
        else:
            # LONG-FORM (> 3 phút):
            # Cho phép cắt nhiều Part, dùng LLM chọn phân đoạn kịch tính nhất
            effective_clips_count = clips_count
            if is_short_form or generate_variants or effective_clips_count <= 1:
                effective_add_part_label = False
            else:
                effective_add_part_label = add_part_label
            curation = llm_curator.curate_viral_segment(
                transcript_segments=transcript_segments,
                total_duration=total_duration,
                target_duration=target_duration,
                video_title=video_title,
                video_id=video_id,
                custom_provider=custom_provider,
                custom_model=custom_model,
                hook_angle=hook_angle
            )
            start_time = curation["start_time"]
            duration = curation["duration"]
            hook_3s = curation["hook_3s"] if generate_hook else ""
            viral_title = curation["viral_title"]
            description = curation["description"]
            hashtags = curation["hashtags"]
            primary_hook = hook_3s.strip() if (hook_3s and hook_3s.strip()) else viral_title.strip()
            # Áp dụng góc Hook tâm lý ưu tiên (Preferred Hook Angle / Winning Variant Focus)
            if hook_angle == "curiosity" and curation.get("hook_curiosity"):
                primary_hook = curation["hook_curiosity"].strip()
                log_event("INFO", f"Áp dụng góc Hook Tò Mò (Curiosity Angle - VarA): {primary_hook}")
            elif hook_angle == "controversy" and curation.get("hook_controversy"):
                primary_hook = curation["hook_controversy"].strip()
                log_event("INFO", f"Áp dụng góc Hook Tranh Luận (Controversy Angle - VarB): {primary_hook}")
            elif hook_angle == "climax" and curation.get("hook_climax"):
                primary_hook = curation["hook_climax"].strip()
                log_event("INFO", f"Áp dụng góc Hook Cao Trào (Climax Angle - VarC): {primary_hook}")

        effective_enable_narration = enable_narration
        effective_narration_style = narration_style
        if is_short_form:
            if disable_narration_for_shorts and enable_narration:
                effective_enable_narration = False
                log_event("INFO", f"Video {video_id} là Short-form ({total_duration:.1f}s <= 180s) -> Đã bật 'Giữ âm thanh gốc cho Shorts' -> Giữ nguyên âm thanh & phụ đề gốc (Bỏ qua giọng đọc AI).")
            elif keep_original_script_for_shorts and enable_narration:
                effective_narration_style = "goc_nguyen_van"
                log_event("INFO", f"Video {video_id} là Short-form ({total_duration:.1f}s <= 180s) và đã bật 'Giữ nguyên văn kịch bản gốc' -> Ép buộc style 'goc_nguyen_van' để khớp phụ đề Shorts.")

        # Bước 3 & 4: Render video Part 1 với phụ đề Karaoke và Anti-detection
        sub_enabled = enable_subtitles if enable_subtitles is not None else ENABLE_DYNAMIC_SUBTITLES
        if is_short_form and disable_subtitle_for_shorts:
            sub_enabled = False
        part1_hook = primary_hook if generate_hook else None

        if generate_variants and not is_short_form:
            log_event("INFO", f"Đang phân tích và xuất 3 biến thể nội dung độc lập sâu (Variants A/B/C - Gap 1) cho video {video_id}...")
            distinct_moments = []
            try:
                distinct_moments = llm_curator.curate_distinct_viral_moments(
                    transcript_segments=transcript_segments,
                    total_duration=total_duration,
                    target_duration=target_duration,
                    video_title=video_title,
                    video_id=video_id,
                    count=3,
                    custom_provider=custom_provider,
                    custom_model=custom_model
                )
                log_event("INFO", f"Đã trích xuất {len(distinct_moments)} phân đoạn trò chuyện độc lập không trùng lặp cho các biến thể A/B/C.")
            except Exception as ex_m:
                log_event("WARNING", f"Không thể lấy distinct_moments từ LLM ({ex_m}), chuyển sang đa dạng hóa góc tâm lý.")

            hooks_dict = {
                "curiosity": curation.get("hook_curiosity") or primary_hook,
                "controversy": curation.get("hook_controversy") or primary_hook,
                "climax": curation.get("hook_climax") or primary_hook,
                "hook_3s": primary_hook
            }
            rendered_files = self.generate_viral_variants(
                input_file=input_file,
                video_id=video_id,
                channel_name=channel_name,
                video_title=viral_title,
                output_dir=output_dir,
                start_time=start_time,
                duration=duration,
                hooks_dict=hooks_dict,
                transcript_segments=transcript_segments,
                enable_subtitles=sub_enabled,
                flip_horizontal=effective_flip,
                bgm_folder=bgm_folder,
                bgm_volume=bgm_volume,
                distinct_moments=distinct_moments
            )
            rendered_file = rendered_files[0] if rendered_files else None
        else:
            rendered_file = self.process_transformative_video(
                input_file=input_file,
                video_id=video_id,
                part_number=1,
                start_time=start_time,
                duration=duration,
                channel_name=channel_name,
                video_title=viral_title,
                output_dir=output_dir,
                enable_subtitles=sub_enabled,
                transcript_segments=transcript_segments,
                hook_text=part1_hook,
                flip_horizontal=effective_flip,
                speed_factor=effective_speed,
                add_part_label=effective_add_part_label,
                subtitle_style=subtitle_style,
                subtitle_position=subtitle_position,
                bgm_folder=bgm_folder,
                bgm_volume=bgm_volume,
                enable_narration=effective_enable_narration,
                narration_language=narration_language,
                voice_gender=voice_gender,
                narration_style=effective_narration_style,
                custom_provider=custom_provider,
                custom_model=custom_model,
                total_parts=1 if is_short_form else effective_clips_count,
                enable_endcard=enable_endcard,
                enable_ken_burns=enable_ken_burns
            )
            rendered_files = [rendered_file] if rendered_file else []

        # Nếu yêu cầu cắt nhiều clip từ video này (CHỈ KHI LÀ LONG-FORM VÀ clips_count > 1)
        if not is_short_form and not generate_variants and effective_clips_count > 1 and total_duration > (duration + 20):
            # Safe boundary: Loại bỏ 15s cuối của video gốc để tránh lọt YouTube End Screens / Subscribe overlay cards
            safe_max_end = max(61.0, total_duration - 15.0)
            curr_start = start_time + duration
            part_num = 2
            while part_num <= clips_count and curr_start < (safe_max_end - 20):
                try:
                    from backend.scheduler import scheduler
                    if not scheduler.is_running:
                        log_event("INFO", f"[SMART RENDER] Đã dừng render Part {part_num} do Scheduler đã tạm dừng.")
                        break
                except Exception:
                    pass
                # 1. Tìm điểm cắt thông minh bằng silence detector (khoảng lặng kết thúc câu nói)
                cut_point = silence_detector.get_optimal_cut_point(
                    video_path=input_file,
                    start_time=curr_start,
                    target_duration=float(target_duration),
                    min_duration=60.5,
                    max_duration=min(float(target_duration + 20), max(61.0, safe_max_end - curr_start))
                )

                # 2. Nếu có transcript từ Whisper, snap chuẩn xác vào thời điểm kết thúc câu nói (tránh cắt giữa câu)
                if transcript_segments:
                    valid_sentence_ends = [
                        seg["end"] for seg in transcript_segments
                        if (curr_start + 60.5) <= seg.get("end", 0) <= min(safe_max_end, curr_start + target_duration + 25)
                    ]
                    if valid_sentence_ends:
                        # Chọn mốc kết thúc câu tự nhiên gần với target_duration nhất
                        cut_point = min(valid_sentence_ends, key=lambda e: abs(e - (curr_start + target_duration)))

                part_dur = max(60.5, cut_point - curr_start)
                if (curr_start + part_dur) > safe_max_end:
                    part_dur = safe_max_end - curr_start
                    if part_dur < 60.0:
                        break

                if generate_hook:
                    if add_part_label:
                        # Badge PART X đã hiển thị ở Y=140 nên banner chỉ cần nội dung hook nguyên vẹn, không lặp lại "Part X - "
                        part_hook = primary_hook
                    else:
                        part_hook = f"Part {part_num} - {primary_hook}"
                else:
                    part_hook = None

                next_p = self.process_transformative_video(
                    input_file=input_file,
                    video_id=video_id,
                    part_number=part_num,
                    start_time=curr_start,
                    duration=part_dur,
                    channel_name=channel_name,
                    video_title=f"{viral_title} Part {part_num}",
                    output_dir=output_dir,
                    enable_subtitles=sub_enabled,
                    transcript_segments=transcript_segments,
                    hook_text=part_hook,
                    flip_horizontal=effective_flip,
                    speed_factor=speed_factor,
                    add_part_label=add_part_label,
                    subtitle_style=subtitle_style,
                    subtitle_position=subtitle_position,
                    bgm_folder=bgm_folder,
                    bgm_volume=bgm_volume,
                    enable_narration=enable_narration,
                    narration_language=narration_language,
                    voice_gender=voice_gender,
                    narration_style=narration_style,
                    custom_provider=custom_provider,
                    custom_model=custom_model,
                    total_parts=effective_clips_count,
                    enable_endcard=enable_endcard,
                    enable_ken_burns=enable_ken_burns
                )
                if next_p:
                    rendered_files.append(next_p)
                curr_start = cut_point
                part_num += 1

        # Cập nhật thông tin AI Copy vào Database
        if rendered_file:
            try:
                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE videos
                    SET ai_hook = ?, ai_title = ?, ai_tags = ?, status = 'rendered', rendered_path = ?
                    WHERE yt_video_id = ?
                """, (hook_3s, viral_title, f"{hashtags}\n\n{description}", rendered_file, video_id))
                conn.commit()
                conn.close()
            except Exception as e:
                log_event("WARNING", f"Lỗi cập nhật AI copy vào DB: {e}")

        return {
            "status": "success" if rendered_file else "failed",
            "rendered_file": rendered_file,
            "rendered_files": rendered_files,
            "curation": curation,
            "ai_hook": hook_3s,
            "ai_title": viral_title,
            "ai_description": description,
            "ai_hashtags": hashtags
        }

ai_video_engine = AIVideoEngine()
