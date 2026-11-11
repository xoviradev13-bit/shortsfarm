import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from PIL import Image, ImageDraw, ImageFont

from backend.modules.ai_addon.safe_zones import (
    MARGIN_V,
    MARGIN_L,
    MARGIN_R,
    HOOK_CARD_TOP_Y,
    HOOK_CARD_BOTTOM_Y,
    HOOK_CARD_HEIGHT,
    COLOR_AMBER_BGR,
    COLOR_WHITE_BGR,
    COLOR_BLACK_BGR,
    COLOR_CYAN_BGR,
    COLOR_PINK_BGR,
    COLOR_GREEN_BGR,
    get_subtitle_margin_v,
    default_subtitle_position
)

def format_ass_time(seconds: float) -> str:
    """Đổi giây (float) sang định dạng thời gian ASS: H:MM:SS.cc"""
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centis = int(round((seconds - int(seconds)) * 100))
    if centis >= 100:
        centis = 99
    return f"{hrs}:{mins:02d}:{secs:02d}.{centis:02d}"


class ASSSubtitleGenerator:
    """
    Tạo file phụ đề ASS chuẩn Plan v3.0 (Universal Safe Zone & Two-Layer Neon Glow):
    - Đặt ở Vùng An Toàn Phổ Quát (Universal Safe Zone): Né 100% UI TikTok, YouTube Shorts & Facebook Reels.
    - Hai Layer chuyên nghiệp: Layer 0 là quầng sáng Glow mờ ảo, Layer 1 là chữ sắc nét.
    - Chữ in hoa (UPPERCASE), font đậm, viền tương phản.
    - Hỗ trợ tạo Hook Card (Title Card) trong 3 giây đầu tiên ở dải Y 240-420.
    """

    def generate_karaoke_ass(
        self,
        transcript_segments: List[Dict[str, Any]],
        output_ass_path: str,
        start_offset: float = 0.0,
        max_duration: Optional[float] = None,
        style_name: Optional[str] = None,
        position: Optional[str] = None,
        font_name: str = "Arial Black",
        font_size: Optional[int] = None,
        primary_color: Optional[str] = None,
        highlight_color: Optional[str] = None,
        outline_color: str = "&H00000000&",
        margin_v: Optional[int] = None,
        campaign_platforms: Optional[List[str]] = None,
        hook_title: Optional[str] = None,
        hook_duration: float = 3.5
    ) -> Optional[str]:
        """
        Sinh file .ass hai tầng (Layer 0: Glow outline, Layer 1: Crisp text/karaoke)
        chuẩn Universal Safe Zone cho cả TikTok, YouTube Shorts và Facebook Reels.
        """
        s_name = (style_name or "karaoke_yellow").lower()

        # Map style preset to BGR colors
        glow_color = COLOR_AMBER_BGR  # &H000B9EF5 (Amber #F59E0B)
        if not primary_color or not highlight_color:
            if s_name == "classic_white":
                primary_color = COLOR_WHITE_BGR
                highlight_color = "&H00E2E8F0&"
                glow_color = "&H00CCCCCC&"
            elif s_name == "tiktok_gradient":
                primary_color = COLOR_CYAN_BGR   # Cyan
                highlight_color = COLOR_PINK_BGR  # TikTok Pink
                glow_color = COLOR_PINK_BGR
            elif s_name == "green_neon":
                primary_color = COLOR_WHITE_BGR
                highlight_color = COLOR_GREEN_BGR  # Bright Neon Green
                glow_color = COLOR_GREEN_BGR
            else:  # karaoke_yellow / neon amber default
                primary_color = COLOR_WHITE_BGR
                highlight_color = COLOR_AMBER_BGR  # Amber #F59E0B -> &H000B9EF5
                glow_color = COLOR_AMBER_BGR

        # Map position preset to Safe Zone MarginV
        if margin_v is None:
            margin_v = get_subtitle_margin_v(position or "center", campaign_platforms)

        f_size = font_size or 64
        margin_l = MARGIN_L  # 160px
        margin_r = MARGIN_R  # 160px

        # Header chuẩn ASS cho tỉ lệ 1080x1920 (Plan v3.0 Two-Layer NeonSub)
        header = f"""[Script Info]
Title: TikTok Viral Universal Safe Zone Subtitles v3.0
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: NeonSub,{font_name},{f_size},{primary_color},{highlight_color},{outline_color},&H00000000&,1,0,0,0,100,100,0,0,1,3,0,2,{margin_l},{margin_r},{margin_v},1
Style: TikTokKaraoke,{font_name},{f_size},{primary_color},{highlight_color},{outline_color},&H00000000&,1,0,0,0,100,100,0,0,1,3,0,2,{margin_l},{margin_r},{margin_v},1
Style: HookCardStyle,{font_name},52,{primary_color},{highlight_color},{outline_color},&H00000000&,1,0,0,0,100,100,0,0,1,4,0,8,120,120,{1920 - HOOK_CARD_BOTTOM_Y},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

        events = []

        # Hook Title Card (nếu có, xuất hiện ở 3-4 giây đầu ở dải Y 240-420, Alignment 8 = Top Center)
        if hook_title and hook_title.strip():
            h_clean = hook_title.strip().upper()
            h_start_str = format_ass_time(0.0)
            h_end_str = format_ass_time(hook_duration)
            # Layer 0 Glow cho Hook Card
            events.append(f"Dialogue: 0,{h_start_str},{h_end_str},HookCardStyle,,0,0,0,,{{\\bord8\\blur8\\3c{glow_color}&\\1a&HFF&\\3a&H40&}}{h_clean}")
            # Layer 1 Crisp Text cho Hook Card
            events.append(f"Dialogue: 1,{h_start_str},{h_end_str},HookCardStyle,,0,0,0,,{{\\bord4\\3c{COLOR_BLACK_BGR}&}}{h_clean}")

        # Duyệt qua các segments phụ đề
        for seg in transcript_segments:
            seg_start = seg.get("start", 0.0)
            seg_end = seg.get("end", 0.0)

            # Nếu nằm hoàn toàn ngoài khoảng render của video đã cắt
            if seg_end <= start_offset:
                continue
            if max_duration is not None and seg_start >= (start_offset + max_duration):
                continue

            words = seg.get("words", [])
            if not words:
                # Nếu không có word timestamps, fallback hiển thị cả câu
                rel_start = max(0.0, seg_start - start_offset)
                rel_end = seg_end - start_offset
                if max_duration and rel_end > max_duration:
                    rel_end = max_duration
                if rel_end > rel_start:
                    t_start = format_ass_time(rel_start)
                    t_end = format_ass_time(rel_end)
                    clean_txt = seg.get("text", "").strip().upper()
                    # Layer 0: Glow outline
                    events.append(f"Dialogue: 0,{t_start},{t_end},NeonSub,,0,0,0,,{{\\bord8\\blur6\\3c{glow_color}&\\1a&HFF&\\3a&H50&}}{clean_txt}")
                    # Layer 1: Crisp text
                    events.append(f"Dialogue: 1,{t_start},{t_end},NeonSub,,0,0,0,,{clean_txt}")
                continue

            # Gom nhóm từ 3-4 từ mỗi dòng để đọc dễ và không bị tràn màn hình dọc
            chunk_size = 4
            for i in range(0, len(words), chunk_size):
                chunk = words[i:i + chunk_size]
                if not chunk:
                    continue

                c_start = chunk[0]["start"] - start_offset
                c_end = chunk[-1]["end"] - start_offset

                if c_end <= 0:
                    continue
                if max_duration and c_start >= max_duration:
                    continue

                c_start = max(0.0, c_start)
                if max_duration and c_end > max_duration:
                    c_end = max_duration

                if c_end <= c_start:
                    continue

                # Tạo mã karaoke {\k<centiseconds>} cho từng từ
                karaoke_text_parts = []
                raw_words = []
                for w in chunk:
                    w_dur = max(0.1, w["end"] - w["start"])
                    cs = int(round(w_dur * 100))
                    clean_w = w["word"].strip().upper()
                    karaoke_text_parts.append(f"{{\\k{cs}}}{clean_w}")
                    raw_words.append(clean_w)

                dialogue_text = " ".join(karaoke_text_parts)
                raw_text = " ".join(raw_words)
                t_start = format_ass_time(c_start)
                t_end = format_ass_time(c_end)

                # Layer 0: Soft Blurred Neon Glow
                events.append(f"Dialogue: 0,{t_start},{t_end},NeonSub,,0,0,0,,{{\\bord8\\blur6\\3c{glow_color}&\\1a&HFF&\\3a&H50&}}{raw_text}")
                # Layer 1: Crisp Karaoke Foreground
                events.append(f"Dialogue: 1,{t_start},{t_end},NeonSub,,0,0,0,,{dialogue_text}")

        # Ghi file .ass
        try:
            Path(output_ass_path).parent.mkdir(parents=True, exist_ok=True)
            with open(output_ass_path, "w", encoding="utf-8") as f:
                f.write(header)
                f.write("\n".join(events))
                f.write("\n")
            return output_ass_path
        except Exception as e:
            return None

    def generate_hook_pill_png(
        self,
        output_path: str,
        width: int = 960,
        height: int = 150,
        radius: int = 24,
        bg_color: tuple = (0, 0, 0, 140)
    ) -> bool:
        """
        Tạo ảnh nền Pill mờ bán trong suốt (55% opacity #000000, bo góc 24px)
        để lót dưới tiêu đề Hook Card ở dải Y 240-420.
        """
        try:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            draw.rounded_rectangle([(0, 0), (width, height)], radius=radius, fill=bg_color)
            img.save(output_path, "PNG")
            return True
        except Exception:
            return False


ass_subtitle_generator = ASSSubtitleGenerator()
