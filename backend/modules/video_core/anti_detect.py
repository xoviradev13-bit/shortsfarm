import os
import random
import re
from typing import Dict, Any, List, Optional, Tuple

def escape_ffmpeg_path(path: str) -> str:
    r"""Format đường dẫn an toàn cho FFmpeg filter trên Windows (đổi \ thành / và escape dấu hai chấm)"""
    p = path.replace("\\", "/")
    p = p.replace(":", "\\:")
    return p

class AntiDetectEngine:
    """
    Bộ xử lý lách thuật toán kiểm duyệt Reup của TikTok/Facebook Reels theo chuẩn Enterprise SaaS:
    1. Visual Anti-Perceptual Hash & Geometric Distortion:
       - 9:16 canvas (1080x1920) với nền mờ phóng to (blurred background)
       - Dynamic Zoom Ramping (Ken Burns Effect: 1.0x -> 1.05x phá thuật toán SIFT/ORB)
       - Micro color grading (chỉnh nhẹ tương phản, độ bão hòa, sáng)
       - Micro noise injection (phá perceptual hash pHash/md5)
       - Sub-perceptual speed up (1.025x)
       - Horizontal flip (tùy chọn)
       - Part/Title banner ở top
       - High-Impact Hook 0-3.5s đầu
       - Dynamic Follow End-Card (Visual Randomization chống quét OCR) 2.2-3.0s cuối
       - Burn phụ đề động karaoke
    2. Audio Anti-Fingerprint:
       - Resample + Frequency shifting + Tempo micro-adjust
       - Thay đổi mã âm thanh gốc nhưng giọng nói vẫn tự nhiên
    3. Container Cleaning:
       - Xóa toàn bộ metadata gốc (-map_metadata -1)
    """

    def build_filter_complex(
        self,
        part_number: int = 1,
        hook_text: Optional[str] = None,
        flip_horizontal: bool = True,
        speed_factor: float = 1.025,
        subtitle_ass_path: Optional[str] = None,
        enable_anti_detect: bool = True,
        width: int = 1080,
        height: int = 1920,
        add_part_label: bool = True,
        crop_watermarks: bool = True,
        enable_ken_burns: bool = True,
        endcard_text: Optional[str] = None,
        video_duration: float = 65.0,
        aspect_ratio_mode: str = "9:16_blur",
        sub_video_input_idx: Optional[int] = None
    ) -> Tuple[str, str, str]:
        """
        Xây dựng chuỗi filter_complex, out_map, và audio_filter cho FFmpeg:
        - 9:16_blur: Background mờ phóng to + Foreground ở giữa (16:9 gốc không méo)
        - 9:16_crop: Cắt chính giữa khung hình 9:16
        - 9:16_split: Ghép 2 tầng (Tầng trên: Video chính 1080x960, Tầng dưới: Video phụ 1080x960)
        Trả về (filter_complex_str, out_map_name, audio_filter_str)
        """
        # Micro punch-in crop (4-5%) giúp loại bỏ watermark/logo kênh ở góc mép video
        fg_crop = "crop=trunc(in_w*0.95/2)*2:trunc(in_h*0.95/2)*2," if crop_watermarks else ""

        if aspect_ratio_mode == "9:16_split" and sub_video_input_idx is not None:
            # 🎬 Split Screen Ghép 2 Tầng:
            # Tầng trên: Video chính (0:v) scaled & crop 1080x960
            # Tầng dưới: Video phụ (sub_video_input_idx:v) scaled & crop 1080x960
            half_h = height // 2
            scale_filter = (
                f"[0:v]{fg_crop}scale={width}:{half_h}:force_original_aspect_ratio=increase,"
                f"crop={width}:{half_h},setsar=1[v_top];"
                f"[{sub_video_input_idx}:v]scale={width}:{half_h}:force_original_aspect_ratio=increase,"
                f"crop={width}:{half_h},setsar=1[v_bot];"
                f"[v_top][v_bot]vstack=inputs=2[base]"
            )
        elif aspect_ratio_mode == "9:16_crop":
            # Cắt dọc chính giữa 9:16 (1080x1920)
            scale_filter = (
                f"[0:v]{fg_crop}scale={width}:{height}:force_original_aspect_ratio=increase,"
                f"crop={width}:{height},setsar=1[base]"
            )
        else:
            # 9:16 Dọc Nền Mờ - Chuẩn TikTok (Mặc định)
            fg_stream_code = f"[0:v]{fg_crop}scale={width}:{height}:force_original_aspect_ratio=decrease[fg]"
            scale_filter = (
                f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,"
                f"crop={width}:{height},boxblur=25:5[bg];"
                f"{fg_stream_code};"
                f"[bg][fg]overlay=(W-w)/2:(H-h)/2[base]"
            )

        current_stream = "base"
        sub_filters = []

        # Chuẩn hóa tốc độ khung hình (framerate) thành 30 fps cố định ngay sau khi ghép canvas 9:16
        # CỰC KỲ QUAN TRỌNG:
        # Nếu video gốc có framerate 23.976 fps (chuẩn cinema/YouTube) hoặc 25 fps (PAL):
        # Bộ lọc zoompan (d=1, fps=30) bên dưới tiêu thụ 1 khung hình input cho mỗi khung hình output ở 30 fps.
        # Nếu không có fps=30 ở đây, 65s video 24fps (1559 frames) bị zoompan tiêu thụ hết chỉ trong 51.9s,
        # khiến 13.1 giây cuối cùng của video bị cạn khung hình và BỊ ĐÓNG BĂNG (FREEZE) trong khi âm thanh vẫn chạy!
        sub_filters.append(f"[{current_stream}]fps=30[v_fps]")
        current_stream = "v_fps"

        # Dynamic Zoom Ramping (Ken Burns Effect): Khung hình zoom cực nhẹ từ 1.0x -> 1.05x trên toàn bộ canvas 9:16
        # Phá vỡ triệt để các bộ trích xuất đặc trưng hình học (SIFT / ORB / Harris corners) của TikTok AI mà KHÔNG làm méo nhân vật
        if enable_ken_burns:
            sub_filters.append(
                f"[{current_stream}]zoompan=z='min(zoom+0.0003,1.05)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps=30[v_kb]"
            )
            current_stream = "v_kb"

        # 2. Lật ngang (Horizontal Flip)
        if flip_horizontal:
            sub_filters.append(f"[{current_stream}]hflip[v_flip]")
            current_stream = "v_flip"

        # 3. Lách thuật toán màu sắc và thêm hạt noise (Anti-Detection)
        if enable_anti_detect:
            # Color grading nhẹ + Noise vi mô (phá mã hash pHash)
            anti_color = f"[{current_stream}]eq=contrast=1.03:brightness=0.01:saturation=1.04,noise=alls=2:allf=u[v_anti]"
            sub_filters.append(anti_color)
            current_stream = "v_anti"

        # 4. Burn phụ đề động Karaoke nếu có file .ass (Áp dụng TRƯỚC setpts để đồng bộ thời gian tuyệt đối với âm thanh)
        if subtitle_ass_path and os.path.exists(subtitle_ass_path):
            safe_sub_path = escape_ffmpeg_path(subtitle_ass_path)
            sub_filters.append(f"[{current_stream}]subtitles='{safe_sub_path}'[v_sub]")
            current_stream = "v_sub"

        # 5. Tăng tốc độ vi mô (Speed Factor) - Áp dụng sau khi burn phụ đề để video và phụ đề đồng tốc
        if speed_factor and abs(speed_factor - 1.0) > 0.001:
            pts_factor = round(1.0 / speed_factor, 4)
            sub_filters.append(f"[{current_stream}]setpts={pts_factor}*PTS[v_speed]")
            current_stream = "v_speed"

        # 6. Badge PART X
        if add_part_label:
            part_label = f"PART {part_number}"
            draw_part = (
                f"[{current_stream}]drawtext=text='{part_label}':fontcolor=white:fontsize=36:"
                f"box=1:boxcolor=black@0.75:boxborderw=10:x=(w-text_w)/2:y=140[v_part]"
            )
            sub_filters.append(draw_part)
            current_stream = "v_part"

        # 7. High-Impact Timed Hook (Xuất hiện 0 - 3.5s đầu tiên để giữ chân người xem lướt không bật tiếng)
        if hook_text and hook_text.strip():
            clean_hook = re.sub(r'[^\w\s\-\?\!\,\.\:\(\)\/]', '', hook_text)
            clean_hook = clean_hook.replace("'", "").replace("%", "").replace("\\", "").replace(":", " - ").strip()

            # Cắt ngắn thông minh theo ranh giới từ (Smart Word-Boundary Truncation)
            max_chars = 52
            if len(clean_hook) > max_chars:
                words = clean_hook[:max_chars].split()
                if len(words) > 1:
                    clean_hook = " ".join(words[:-1]).rstrip(" ,.-:") + "..."
                else:
                    clean_hook = clean_hook[:max_chars].rstrip() + "..."

            # Dynamic Font Scaling theo độ dài tiêu đề
            h_len = len(clean_hook)
            if h_len <= 26:
                hook_fontsize = 48
                hook_y = 220
            elif h_len <= 38:
                hook_fontsize = 40
                hook_y = 224
            elif h_len <= 48:
                hook_fontsize = 34
                hook_y = 228
            else:
                hook_fontsize = 30
                hook_y = 230

            draw_hook = (
                f"[{current_stream}]drawtext=font='Arial':text='{clean_hook}':fontcolor=yellow:fontsize={hook_fontsize}:"
                f"box=1:boxcolor=black@0.85:boxborderw=16:x=(w-text_w)/2:y={hook_y}:enable='between(t,0,3.5)'[v_hook]"
            )
            sub_filters.append(draw_hook)
            current_stream = "v_hook"

        # 8. Dynamic Follow End-Card (Xuất hiện 2.2s - 3.0s cuối video)
        # Visual Randomization: Đổi màu chữ ngẫu nhiên, Jitter tọa độ Y (+-20px), thời lượng ngẫu nhiên
        # chống triệt để thuật toán OCR quét spam template của TikTok
        if endcard_text and endcard_text.strip():
            clean_ec = endcard_text.strip()
            # Xóa các icon chỉ tay nếu có ở đầu
            clean_ec = re.sub(r'^[👉👉\s\-–—]+', '', clean_ec).strip()
            # Triệt tiêu hoàn toàn tiền tố nhãn (banner_cta, cta, banner, text...)
            p_pattern = r'^(banner[_\s\-]*cta|cta[_\s\-]*banner|call[_\s\-]*to[_\s\-]*action|end[_\s\-]*card|banner|cta|text|caption)\s*[:\-–—_=\s]\s*'
            for _ in range(3):
                clean_ec = re.sub(p_pattern, '', clean_ec, flags=re.IGNORECASE).strip()
            clean_ec = re.sub(r'[^\w\s\-\?\!\,\.\:\(\)\/]', '', clean_ec).strip()
            for _ in range(3):
                clean_ec = re.sub(p_pattern, '', clean_ec, flags=re.IGNORECASE).strip()
            clean_ec = clean_ec.replace("'", "").replace("%", "").replace("\\", "").replace(":", " - ").strip()
            if len(clean_ec) > 50:
                words = clean_ec[:50].split()
                clean_ec = " ".join(words[:-1]) if len(words) > 1 else clean_ec[:50]

            # Random timing: Xuất hiện từ 2.2s đến 3.0s trước khi kết thúc
            v_dur = float(video_duration) if video_duration and video_duration > 5 else 65.0
            ec_dur = round(random.uniform(2.2, 3.0), 2)
            ec_start = max(0.0, v_dur - ec_dur)
            ec_enable = f"between(t,{ec_start:.2f},{v_dur:.2f})"

            # Random visual styling chống OCR template detection
            ec_colors = ["yellow", "white", "0x00F2FE", "0x00FF66"]
            ec_color = random.choice(ec_colors)
            ec_y = random.randint(1625, 1665)  # Jitter offset +- 20px
            ec_fontsize = 34 if len(clean_ec) > 36 else 38

            draw_endcard = (
                f"[{current_stream}]drawtext=font='Arial':text='{clean_ec}':fontcolor={ec_color}:fontsize={ec_fontsize}:"
                f"box=1:boxcolor=black@0.85:boxborderw=14:x=(w-text_w)/2:y={ec_y}:enable='{ec_enable}'[v_endcard]"
            )
            sub_filters.append(draw_endcard)
            current_stream = "v_endcard"

        # 9. Luôn chuẩn hóa pixel format yuv420p ở cuối chuỗi bộ lọc để libx264 tương thích 100%
        sub_filters.append(f"[{current_stream}]format=yuv420p[v_out]")
        current_stream = "v_out"

        # Tổng hợp toàn bộ filter complex
        filter_complex = scale_filter + ";" + ";".join(sub_filters)

        # 10. Xây dựng bộ lọc Audio chống quét bản quyền âm thanh (Đảm bảo đồng bộ 100% thời gian với Video)
        if abs(speed_factor - 1.0) <= 0.001:
            # Tốc độ chuẩn 1.0x (Shorts hoặc video không đổi tốc độ): Chuẩn hóa sample rate 44.1kHz, không can thiệp tempo để tránh lệch tiếng
            audio_filter = "aresample=44100"
        elif enable_anti_detect:
            # Shift tần số 1.5% rồi resample lại về 44.1kHz, đồng thời chỉnh tempo
            # QUAN TRỌNG: Phải resample về 44100 trước khi gọi asetrate để tránh lệch tốc độ trên các video 48kHz (YouTube mặc định)
            shifted_rate = int(44100 * 1.015)  # = 44761 Hz
            atempo_val = round(speed_factor / 1.015, 6)
            audio_filter = f"aresample=44100,asetrate={shifted_rate},aresample=44100,atempo={atempo_val}"
        else:
            audio_filter = f"aresample=44100,atempo={speed_factor}"

        return filter_complex, current_stream, audio_filter

anti_detect_engine = AntiDetectEngine()
