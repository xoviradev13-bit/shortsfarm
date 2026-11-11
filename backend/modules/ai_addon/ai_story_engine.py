import os
import sys
import re
import json
import time
import random
import urllib.parse
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

import requests
from PIL import Image, ImageDraw, ImageFont

from backend.config import RENDERED_DIR, MUSIC_DIR, WHISPER_MODEL_SIZE, SUBTITLE_STYLE, SUBTITLE_POSITION, SUBTITLE_FONT_SIZE
from backend.database import log_event, get_setting, record_ai_usage
from backend.logger import get_logger
from backend.modules.video_core.hardware_accel import get_ffmpeg_binary, get_optimal_video_encoder_flags
from backend.modules.video_core.anti_detect import escape_ffmpeg_path
from backend.modules.ai_addon.llm_curator import llm_curator
from backend.modules.ai_addon.ai_narrator import ai_narrator, detect_text_language, VOICE_CATALOG
from backend.modules.ai_addon.ass_subtitle import ass_subtitle_generator
from backend.modules.audio_manager import audio_manager
from backend.modules.ai_addon.stock_footage import stock_footage_manager
from backend.modules.ai_addon.ai_video_generator import ai_video_generator, AI_VIDEO_MODELS
from backend.modules.ai_addon.episodic_generator import generate_episodic_series

logger = get_logger("ai_story_engine")

# Bảng phong cách hình ảnh AI cho video
IMAGE_STYLES: Dict[str, Dict[str, str]] = {
    "cinematic": {
        "name": "🎬 Điện Ảnh Chân Thực (Cinematic 8K)",
        "prompt_suffix": "cinematic lighting, ultra-detailed, photorealistic, 8k resolution, dramatic atmosphere, depth of field, 35mm film photograph, masterpiece, vertical composition 9:16",
        "description": "Phong cách phim điện ảnh Hollywood, ánh sáng kịch tính, màu sắc ấn tượng, phù hợp chuyện giật gân/đại án"
    },
    "photorealistic": {
        "name": "📸 Ảnh Chụp Siêu Thực (Hyper-Realistic)",
        "prompt_suffix": "real photo, sharp focus, professional photography, natural lighting, documentary style, authentic details, vertical 9:16",
        "description": "Ảnh chụp máy ảnh chân thực, tự nhiên như phim tài liệu báo chí"
    },
    "anime": {
        "name": "🌸 Anime Nhật Bản (Makoto Shinkai Style)",
        "prompt_suffix": "anime aesthetic, Makoto Shinkai style, vibrant colors, detailed anime background, beautiful sky, emotional lighting, masterpiece, vertical 9:16",
        "description": "Phong cách anime rực rỡ, lung linh, giàu cảm xúc, bắt mắt khán giả trẻ"
    },
    "cyberpunk": {
        "name": "⚡ Tương Lai Cyberpunk (Neon Synthwave)",
        "prompt_suffix": "cyberpunk style, neon lights, futuristic city, volumetric glow, high tech, dark synthwave mood, raining streets, vertical 9:16",
        "description": "Ánh sáng neon tím xanh, thành phố tương lai, công nghệ cao, hiện đại"
    },
    "dark_fantasy": {
        "name": "🏰 Kỳ Ảo U Tối (Dark Fantasy & Mystery)",
        "prompt_suffix": "dark fantasy style, ominous mood, medieval Gothic mystery, dramatic chiaroscuro lighting, Elden Ring atmosphere, hyper-detailed, vertical 9:16",
        "description": "Không khí bí ẩn, thần thoại u ám, lâu đài cổ, phù hợp video bí ẩn/kinh dị"
    },
    "3d_render": {
        "name": "🎨 Hoạt Hình 3D (Pixar / Disney 3D)",
        "prompt_suffix": "3D Pixar animation style, digital 3D render, vibrant color palette, soft rim lighting, cute expressive character, 4k render, vertical 9:16",
        "description": "Phong cách hoạt hình 3D Pixar, thân thiện, màu sắc tươi sáng"
    },
    "comic": {
        "name": "💥 Truyện Tranh Hiện Đại (Graphic Novel Comic)",
        "prompt_suffix": "graphic novel comic art style, bold ink outlines, dynamic halftone shading, action comic illustration, dramatic shadows, vertical 9:16",
        "description": "Vẽ tay truyện tranh comic Mỹ, đường nét đậm sắc sảo, dồn dập"
    }
}

# Các Model AI tạo hình ảnh được hỗ trợ
AI_IMAGE_MODELS: Dict[str, Dict[str, str]] = {
    "flux": {
        "name": "⚡ FLUX.1 (Pollinations - Nhanh, Free, 9:16 sắc nét)",
        "badge": "Khuyên dùng",
        "description": "Mô hình sinh ảnh AI FLUX cực nhanh, sắc nét, hoàn toàn miễn phí, tối ưu tỷ lệ dọc 9:16."
    },
    "banana": {
        "name": "🍌 Nano Banana (Màu sắc rực rỡ, Đậm chất viral)",
        "badge": "Trending",
        "description": "Phong cách hình ảnh siêu tương phản, ánh sáng neon rực rỡ, thu hút thị giác 3s đầu trên TikTok."
    },
    "openai": {
        "name": "🎨 OpenAI DALL-E 3 (Độ phân giải 1024x1792, Dùng OpenAI Key)",
        "badge": "Cao cấp",
        "description": "Mô hình DALL-E 3 đỉnh cao từ OpenAI, mô tả chi tiết phức tạp chuẩn xác, dùng key OpenAI của bạn."
    },
    "imagen": {
        "name": "🌟 Google Imagen 3 (Điện ảnh sống động, Dùng Gemini Key)",
        "badge": "Google AI",
        "description": "Mô hình Imagen 3 từ Google, chân thực như máy ảnh điện ảnh, dùng key Gemini/Google của bạn."
    }
}

# Nguồn hình ảnh / footage cho video
VISUAL_SOURCES: Dict[str, Dict[str, str]] = {
    "ai_video": {
        "name": "🎥 Video AI Sinh Động (LTX / Wan 2.1 / Kling)",
        "description": "Tạo video chuyển động AI thực thụ (Text-to-Video và Image-to-Video) với nhân vật, biểu cảm và bối cảnh sống động 100%."
    },
    "ai": {
        "name": "🤖 100% Ảnh AI (Tạo mới hoàn toàn bằng AI)",
        "description": "Toàn bộ cảnh quay đều được sinh mới bằng mô hình AI (FLUX / DALL-E 3 / Imagen / Nano Banana) kết hợp chuyển động Ken Burns."
    },
    "stock": {
        "name": "🎥 100% Cảnh quay thật (Stock Pexels & Pixabay)",
        "description": "Tự động trích xuất từ khóa tìm kiếm và tải video/ảnh quay đời thực chất lượng cao từ Pexels & Pixabay."
    },
    "mixed": {
        "name": "✨ Mix Kết Hợp (50% Cảnh Thật + 50% Ảnh AI)",
        "description": "Đan xen nhịp nhàng giữa cảnh quay đời thực và đồ họa AI (Cảnh chẵn dùng Stock, cảnh lẻ dùng AI) giúp video cuốn hút tối đa."
    }
}

# Kho tư liệu Stock
STOCK_PROVIDERS: Dict[str, Dict[str, str]] = {
    "all": {
        "name": "🌐 Tự động (Pexels + Pixabay)",
        "description": "Tìm kiếm trên cả hai kho tư liệu, ưu tiên nguồn có video khớp ngữ cảnh nhất."
    },
    "pexels": {
        "name": "🎬 Pexels (Ưu tiên video 4K/HD dọc)",
        "description": "Kho video và ảnh bản quyền miễn phí chất lượng hàng đầu."
    },
    "pixabay": {
        "name": "📸 Pixabay (Kho tư liệu đa dạng)",
        "description": "Hàng triệu video và hình ảnh đời thực phong phú mọi chủ đề."
    }
}


class AIStoryEngine:
    """
    Hệ Thống Tự Động Sinh Video Mới Hoàn Toàn 100% Bằng Trí Tuệ Nhân Tạo & Cảnh Quay Thật (AI Visual Storytelling):
    1. Trích xuất transcript từ YouTube hoặc Audio gốc.
    2. LLM viết lại kịch bản (Paraphrase) 100% mới theo phong cách viral TikTok, chia thành các phân cảnh (Scenes).
    3. Tự động sinh Prompt hình ảnh tiếng Anh chi tiết + Từ khóa Stock tìm kiếm cho từng phân cảnh.
    4. Sinh ảnh AI chất lượng cao (FLUX / OpenAI DALL-E 3 / Google Imagen / Nano Banana) hoặc tải Video thật Pexels/Pixabay chuẩn khung dọc 9:16.
    5. Lồng tiếng AI (Edge-TTS) đa ngôn ngữ đồng bộ từng phân cảnh.
    6. Tạo chuyển động máy quay Ken Burns (Zoom in / Zoom out / Pan) cho từng bức ảnh hoặc video clip.
    7. Ghép phụ đề động Karaoke Neon (ASS) khớp từng từ theo giọng đọc.
    8. Mix nhạc nền BGM chủ đề (Auto-Ducking giảm âm lượng khi có lời thoại).
    9. Xuất video hoàn toàn mới, triệt tiêu 100% mã hash và bản quyền unoriginal của TikTok/YouTube.
    """

    def __init__(self, output_dir: Path = RENDERED_DIR):
        self.output_dir = output_dir
        self.ffmpeg_bin = get_ffmpeg_binary()

    def get_supported_image_styles(self) -> List[Dict[str, str]]:
        """Trả về danh sách phong cách hình ảnh AI được hỗ trợ"""
        styles = []
        for key, val in IMAGE_STYLES.items():
            styles.append({
                "id": key,
                "name": val["name"],
                "description": val["description"]
            })
        return styles

    def get_supported_video_models(self) -> List[Dict[str, Any]]:
        """Trả về danh sách các model AI Video được hỗ trợ"""
        return ai_video_generator.get_supported_models()

    def get_supported_ai_models(self) -> List[Dict[str, str]]:
        """Trả về danh sách các model AI tạo ảnh được hỗ trợ"""
        models = []
        for key, val in AI_IMAGE_MODELS.items():
            models.append({
                "id": key,
                "name": val["name"],
                "badge": val.get("badge", ""),
                "description": val.get("description", "")
            })
        return models

    def get_supported_visual_sources(self) -> List[Dict[str, str]]:
        """Trả về danh sách các nguồn cảnh quay (AI / Stock / Mixed)"""
        sources = []
        for key, val in VISUAL_SOURCES.items():
            sources.append({
                "id": key,
                "name": val["name"],
                "description": val.get("description", "")
            })
        return sources

    def get_supported_stock_providers(self) -> List[Dict[str, str]]:
        """Trả về danh sách kho stock tư liệu"""
        providers = []
        for key, val in STOCK_PROVIDERS.items():
            providers.append({
                "id": key,
                "name": val["name"],
                "description": val.get("description", "")
            })
        return providers

    def _get_exact_media_duration(self, file_path: str) -> float:
        """Đo thời lượng chính xác của file video/audio"""
        if not file_path or not os.path.exists(file_path):
            return 0.0
        try:
            cmd = [self.ffmpeg_bin, "-i", file_path]
            res = subprocess.run(
                cmd, capture_output=True, timeout=15,
                creationflags=0x08000000 if sys.platform == 'win32' else 0
            )
            stderr = res.stderr.decode("utf-8", errors="replace")
            m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", stderr)
            if m:
                h, m_, s = m.groups()
                return round(int(h) * 3600 + int(m_) * 60 + float(s), 2)
        except Exception:
            pass
        return 0.0

    def rewrite_to_scenes(
        self,
        raw_transcript: str,
        video_title: str = "",
        target_duration: float = 65.0,
        target_language: str = "vi",
        script_style: str = "giat_gan",
        image_style: str = "cinematic",
        ai_provider: Optional[str] = None,
        ai_model: Optional[str] = None,
        video_id: str = ""
    ) -> Dict[str, Any]:
        """
        Dùng LLM (DeepSeek / Gemini / OpenAI) phân tích và viết lại hoàn toàn transcript gốc
        thành kịch bản phân cảnh (scenes) mới 100%:
        - Mỗi scene có: Lời thoại (narration), Mô tả ảnh AI (image_prompt), Từ khóa tìm Stock (stock_query).
        - Tổng thời lượng chia đều hoặc canh theo nhịp cao trào.
        """
        # Xác định ngôn ngữ đầu ra
        if target_language == "original" or not target_language:
            effective_lang = detect_text_language(raw_transcript)
        else:
            effective_lang = target_language

        lang_name = "Tiếng Việt" if effective_lang == "vi" else "English"

        # Tính toán số lượng phân cảnh tối ưu: mỗi phân cảnh dài 4.5s - 6.5s
        target_dur = max(20.0, min(180.0, float(target_duration)))
        num_scenes = max(4, min(14, int(round(target_dur / 5.5))))

        style_cfg = IMAGE_STYLES.get(image_style, IMAGE_STYLES["cinematic"])
        visual_style_note = style_cfg["prompt_suffix"]

        tone_instruction = "cực kỳ giật gân, hồi hộp, kịch tính, nhịp điệu dồn dập (Fast-paced, suspenseful, dramatic)"
        if script_style == "hai_huoc":
            tone_instruction = "hài hước, châm biếm sâu cay, dí dỏm, tạo tiếng cười bất ngờ"
        elif script_style == "trang_trong":
            tone_instruction = "nghiêm túc, trang trọng, sâu sắc, như bản tin điều tra chuyên nghiệp"
        elif script_style == "bi_an":
            tone_instruction = "bí ẩn rùng rợn, khám phá bí mật chưa có lời giải, gây tò mò cực độ"

        system_prompt = (
            "You are a World-Class Cinematic AI Director and Viral Short-Form Video Producer. "
            "Your specialty is creating ultra-addictive, high-retention 9:16 TikTok storyboards "
            "with 100% VISUAL & CHARACTER CONSISTENCY across all sequential shots. "
            "You strictly output valid parseable JSON only, without any explanatory text or markdown outside JSON."
        )

        user_prompt = f"""You are creating a 100% BRAND NEW viral TikTok video inspired by the original transcript below.
You must divide the script into exactly {num_scenes} sequential scenes.

ORIGINAL TITLE: {video_title}
ORIGINAL TRANSCRIPT:
"{raw_transcript[:3000]}"

CRITICAL INSTRUCTIONS:
1. TARGET SPOKEN LANGUAGE: {lang_name} ({effective_lang}).
2. SCRIPT STYLE: {tone_instruction}
3. PARAPHRASE COMPLETELY: Do not copy sentences verbatim. Rewrite the story into a brand new thrilling narrative.
4. EXACT SCENE COUNT: Exactly {num_scenes} scenes.
5. FOR EACH SCENE:
   - "scene_number": 1, 2, ...
   - "narration": Spoken narration for this scene in {lang_name}. Keep it concise, natural, spoken voice only. (Approx 15-25 words per scene).
   - "image_prompt": A highly-detailed visual prompt IN ENGLISH describing what appears on screen. Focus on physical objects, lighting, mood, camera angle, and action. Style: {visual_style_note}. Absolutely NO text or words inside the image.
   - "stock_query": 2-4 English search keywords for finding real stock footage or real photography on Pexels/Pixabay (e.g. "dark ocean storm", "doctor surgery hospital", "ancient gold coins", "hacker dark room").
   - "camera_motion": Exactly one of ["push_in", "drift", "mood", "static"]. (Default "push_in").
   - "has_person": true if human, character, face, or hands appear; false for landscape, objects, nature, or vehicle scenes.
   - "face_prominence": approximate fraction of frame occupied by faces (0.0 to 1.0).
   - "is_action": true if high motion / fast-paced event; false if dialogue, emotional, or establishing.
6. OPEN WITH AN ADDICTIVE 3-SECOND HOOK in Scene 1.
7. FINAL SCENE: Include a punchy climax or cliffhanger call-to-action.
8. RETURN VALID JSON ONLY IN THIS FORMAT:
{{
  "viral_title": "Short catchy title with emojis",
  "hook": "First 3s hook sentence",
  "description": "Engaging TikTok description with SEO keywords",
  "hashtags": "#viral #fyp #storytime",
  "scenes": [
    {{
      "scene_number": 1,
      "narration": "Narration text in {lang_name}...",
      "image_prompt": "Detailed English image prompt...",
      "stock_query": "2-4 English keywords for real stock footage...",
      "camera_motion": "push_in",
      "has_person": false,
      "face_prominence": 0.0,
      "is_action": false
    }}
  ]
}}"""

        try:
            raw_res = llm_curator.query_llm(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                task="aistory_scenes",
                video_id=video_id,
                custom_provider=None if ai_provider == "default" else ai_provider,
                custom_model=None if ai_model == "default" else ai_model
            )
            if raw_res:
                clean_json = re.sub(r"^```json\s*|\s*```$", "", raw_res.strip(), flags=re.MULTILINE).strip()
                start_idx = clean_json.find('{')
                end_idx = clean_json.rfind('}')
                if start_idx != -1 and end_idx != -1:
                    clean_json = clean_json[start_idx:end_idx + 1]

                parsed = json.loads(clean_json)
                scenes = parsed.get("scenes", [])
                char_anchor = parsed.get("character_anchor") or ""
                env_anchor = parsed.get("environment_anchor") or ""

                if scenes and len(scenes) >= 3:
                    # Tự động đảm bảo 100% tính nhất quán (Character & Environment Consistency Anchor)
                    for sc in scenes:
                        ip = sc.get("image_prompt", "")
                        if char_anchor and char_anchor.lower()[:25] not in ip.lower():
                            sc["image_prompt"] = f"{char_anchor}, {env_anchor}, {ip}".strip(", ")
                        c_mot = sc.get("camera_motion", "push_in")
                        if c_mot not in ("push_in", "drift", "mood", "static"):
                            c_mot = "push_in"
                        sc["camera_motion"] = c_mot
                        sc["motion_prompt"] = c_mot

                    log_event("INFO", f"🎬 [AI STORY ENGINE] Đã sinh kịch bản {len(scenes)} cảnh chuẩn Storyboard Anchor (Nhân vật: '{char_anchor[:45]}...')")
                    return {
                        "success": True,
                        "character_anchor": char_anchor,
                        "environment_anchor": env_anchor,
                        "viral_title": parsed.get("viral_title") or video_title,
                        "hook": parsed.get("hook") or (scenes[0].get("narration") if scenes else ""),
                        "description": parsed.get("description", ""),
                        "hashtags": parsed.get("hashtags", "#viral #fyp"),
                        "scenes": scenes,
                        "language": effective_lang
                    }
        except Exception as e:
            logger.warning(f"Lỗi khi gọi LLM sinh kịch bản AI Story: {e}")

        # Fallback an toàn: Tự phân tách transcript thành các phân cảnh cơ bản nếu LLM gặp sự cố
        log_event("WARNING", f"Sử dụng fallback phân cảnh cơ bản cho video '{video_title}'")
        sentences = [s.strip() for s in re.split(r'[.!?\n]+', raw_transcript) if len(s.strip()) > 15]
        if not sentences:
            sentences = [video_title or "The untold story revealed."]

        chunk_size = max(1, len(sentences) // num_scenes)
        fallback_scenes = []
        for i in range(min(num_scenes, len(sentences))):
            s_text = " ".join(sentences[i * chunk_size:(i + 1) * chunk_size]) or sentences[i]
            fallback_scenes.append({
                "scene_number": i + 1,
                "narration": s_text,
                "image_prompt": f"Dramatic scene related to {video_title}, {visual_style_note}",
                "stock_query": f"{video_title} dramatic scene"
            })

        return {
            "success": True,
            "viral_title": video_title or "Untold Story",
            "hook": fallback_scenes[0]["narration"] if fallback_scenes else "",
            "description": video_title,
            "hashtags": "#viral #fyp",
            "scenes": fallback_scenes,
            "language": effective_lang
        }

    def _generate_fallback_image(self, prompt: str, scene_num: int, output_path: str):
        """Tạo ảnh gradient nghệ thuật chuẩn dọc 1080x1920 bằng PIL phòng ngừa mạng lỗi"""
        width, height = 1080, 1920
        colors = [
            ((35, 55, 95), (80, 40, 90)),
            ((25, 65, 85), (50, 85, 110)),
            ((45, 30, 75), (95, 45, 70)),
            ((40, 50, 75), (70, 85, 110))
        ]
        top_c, bot_c = random.choice(colors)
        base = Image.new("RGB", (width, height), top_c)
        draw = ImageDraw.Draw(base)

        for y in range(height):
            ratio = y / float(height)
            r = int(top_c[0] * (1 - ratio) + bot_c[0] * ratio)
            g = int(top_c[1] * (1 - ratio) + bot_c[1] * ratio)
            b = int(top_c[2] * (1 - ratio) + bot_c[2] * ratio)
            draw.line([(0, y), (width, y)], fill=(r, g, b))

        draw.rectangle([(60, 60), (width - 60, height - 60)], outline=(255, 255, 255, 30), width=2)
        base.save(output_path, quality=95)

    def generate_scene_image(
        self,
        prompt: str,
        scene_num: int,
        output_path: str,
        image_style: str = "cinematic",
        ai_model: str = "flux",
        stock_query: str = "",
        video_title: str = "",
        context_topic: str = "",
        video_id: str = ""
    ) -> bool:
        """
        Sinh ảnh AI chất lượng cao cho phân cảnh:
        - Hỗ trợ các model: FLUX (Pollinations), Nano Banana, OpenAI DALL-E 3, Google Imagen 3
        - Ghi nhận chi phí, token và trạng thái vào ai_usage_logs
        - Tự động fallback về FLUX và cuối cùng là PIL gradient nếu có sự cố
        """
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        style_info = IMAGE_STYLES.get(image_style, IMAGE_STYLES["cinematic"])
        model_choice = (ai_model or "flux").lower().strip()
        t0 = time.time()

        # 1. Nếu chọn OpenAI DALL-E 3
        if model_choice == "openai":
            openai_key = get_setting("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY", "")
            if openai_key:
                try:
                    full_prompt = f"{prompt.strip()}, {style_info['prompt_suffix']}"
                    url = "https://api.openai.com/v1/images/generations"
                    headers = {
                        "Authorization": f"Bearer {openai_key}",
                        "Content-Type": "application/json"
                    }
                    payload = {
                        "model": "dall-e-3",
                        "prompt": full_prompt[:950],
                        "size": "1024x1792",
                        "quality": "standard",
                        "n": 1
                    }
                    res = requests.post(url, headers=headers, json=payload, timeout=45)
                    dur_ms = int((time.time() - t0) * 1000)
                    if res.status_code == 200:
                        data = res.json()
                        img_url = data["data"][0]["url"]
                        dl_res = requests.get(img_url, timeout=30)
                        if dl_res.status_code == 200:
                            with open(output_path, "wb") as f:
                                f.write(dl_res.content)
                            log_event("INFO", f"🎨 [DALL-E 3] Cảnh #{scene_num}: Đã sinh ảnh 1024x1792 thành công.")
                            try:
                                record_ai_usage(
                                    provider="OpenAI",
                                    model="dall-e-3",
                                    task="image_generation",
                                    video_id=video_id,
                                    prompt_tokens=len(full_prompt.split()),
                                    completion_tokens=0,
                                    total_tokens=len(full_prompt.split()),
                                    estimated_cost=0.040,
                                    duration_ms=dur_ms,
                                    status="success"
                                )
                            except Exception:
                                pass
                            return True
                    else:
                        try:
                            record_ai_usage(
                                provider="OpenAI",
                                model="dall-e-3",
                                task="image_generation",
                                video_id=video_id,
                                duration_ms=dur_ms,
                                status="error",
                                error_message=f"HTTP {res.status_code}: {res.text[:200]}"
                            )
                        except Exception:
                            pass
                        logger.warning(f"OpenAI DALL-E lỗi ({res.status_code}): {res.text[:200]}. Tự động fallback FLUX.")
                except Exception as e:
                    dur_ms = int((time.time() - t0) * 1000)
                    try:
                        record_ai_usage(
                            provider="OpenAI",
                            model="dall-e-3",
                            task="image_generation",
                            video_id=video_id,
                            duration_ms=dur_ms,
                            status="error",
                            error_message=str(e)
                        )
                    except Exception:
                        pass
                    logger.warning(f"Lỗi gọi OpenAI DALL-E scene {scene_num}: {e}. Fallback sang FLUX.")

        # 2. Nếu chọn Google Imagen 3
        elif model_choice == "imagen":
            gemini_key = get_setting("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY", "")
            base_url = (get_setting("GEMINI_BASE_URL") or "https://generativelanguage.googleapis.com").rstrip("/")
            if gemini_key:
                try:
                    full_prompt = f"{prompt.strip()}, {style_info['prompt_suffix']}"
                    url = f"{base_url}/v1beta/models/imagen-3.0-generate-002:predict?key={gemini_key}"
                    payload = {
                        "instances": [{"prompt": full_prompt[:950]}],
                        "parameters": {
                            "sampleCount": 1,
                            "aspectRatio": "9:16",
                            "outputMimeType": "image/jpeg"
                        }
                    }
                    res = requests.post(url, json=payload, timeout=30)
                    dur_ms = int((time.time() - t0) * 1000)
                    if res.status_code == 200:
                        import base64
                        data = res.json()
                        predictions = data.get("predictions", [])
                        if predictions and "bytesBase64Encoded" in predictions[0]:
                            raw_bytes = base64.b64decode(predictions[0]["bytesBase64Encoded"])
                            with open(output_path, "wb") as f:
                                f.write(raw_bytes)
                            log_event("INFO", f"🌟 [IMAGEN 3] Cảnh #{scene_num}: Đã sinh ảnh Imagen 3 thành công.")
                            try:
                                record_ai_usage(
                                    provider="Google Imagen",
                                    model="imagen-3.0",
                                    task="image_generation",
                                    video_id=video_id,
                                    prompt_tokens=len(full_prompt.split()),
                                    completion_tokens=0,
                                    total_tokens=len(full_prompt.split()),
                                    estimated_cost=0.030,
                                    duration_ms=dur_ms,
                                    status="success"
                                )
                            except Exception:
                                pass
                            return True
                    else:
                        try:
                            record_ai_usage(
                                provider="Google Imagen",
                                model="imagen-3.0",
                                task="image_generation",
                                video_id=video_id,
                                duration_ms=dur_ms,
                                status="error",
                                error_message=f"HTTP {res.status_code}: {res.text[:200]}"
                            )
                        except Exception:
                            pass
                        logger.warning(f"Google Imagen 3 phản hồi ({res.status_code}): {res.text[:200]}. Fallback sang FLUX.")
                except Exception as e:
                    dur_ms = int((time.time() - t0) * 1000)
                    try:
                        record_ai_usage(
                            provider="Google Imagen",
                            model="imagen-3.0",
                            task="image_generation",
                            video_id=video_id,
                            duration_ms=dur_ms,
                            status="error",
                            error_message=str(e)
                        )
                    except Exception:
                        pass
                    logger.warning(f"Lỗi gọi Google Imagen 3: {e}. Fallback sang FLUX.")

        # 3. Nếu chọn Nano Banana style
        if model_choice in ("banana", "nanobanana"):
            full_prompt = f"nano banana style, hyper-vibrant cinematic 4k, extreme detail, neon rich contrast, masterpiece, 9:16 vertical, {prompt.strip()}, {style_info['prompt_suffix']}"
            p_name = "Nano Banana"
            m_name = "nano-banana"
        else:
            full_prompt = f"{prompt.strip()}, {style_info['prompt_suffix']}"
            p_name = "FLUX.1"
            m_name = "flux-1-schnell"

        # 3.5. Nếu có FAL_KEY -> Ưu tiên sinh ảnh FLUX.1 siêu tốc qua Fal.ai (100% sắc nét, 1s/ảnh, không rate limit)
        fal_key = get_setting("FAL_KEY") or get_setting("FAL_API_KEY") or os.getenv("FAL_KEY") or os.getenv("FAL_API_KEY") or ""
        if fal_key and ":" in fal_key:
            try:
                fal_headers = {
                    "Authorization": f"Key {fal_key.strip()}",
                    "Content-Type": "application/json"
                }
                fal_payload = {
                    "prompt": full_prompt[:1000],
                    "image_size": {"width": 1080, "height": 1920},
                    "num_inference_steps": 4,
                    "num_images": 1,
                    "enable_safety_checker": False
                }
                res_fal = requests.post("https://fal.run/fal-ai/flux/schnell", headers=fal_headers, json=fal_payload, timeout=35)
                if res_fal.status_code == 200:
                    data_fal = res_fal.json()
                    imgs = data_fal.get("images", [])
                    if imgs and imgs[0].get("url"):
                        dl = requests.get(imgs[0]["url"], timeout=30)
                        if dl.status_code == 200 and len(dl.content) > 5000:
                            with open(output_path, "wb") as f:
                                f.write(dl.content)
                            log_event("INFO", f"⚡ [FAL.AI FLUX] Cảnh #{scene_num}: Đã sinh ảnh FLUX chuẩn 1080x1920 thành công.")
                            return True
                else:
                    logger.warning(f"Fal.ai FLUX phản hồi ({res_fal.status_code}): {res_fal.text[:200]}")
            except Exception as e_fal:
                logger.warning(f"Lỗi gọi Fal.ai FLUX: {e_fal}")

        # 4. Sinh ảnh qua Pollinations.ai (URL miễn phí)
        try:
            encoded_prompt = urllib.parse.quote(full_prompt[:300])
            seed = random.randint(100, 999999)
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            poll_token = get_setting("POLLINATIONS_API_KEY", "") or os.getenv("POLLINATIONS_API_KEY", "")
            if poll_token:
                url = f"https://gen.pollinations.ai/image/{encoded_prompt}?model=flux&nologo=true&seed={seed}&width=1080&height=1920"
                headers["Authorization"] = f"Bearer {poll_token.strip()}"
            else:
                url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?nologo=true&seed={seed}"
            resp = requests.get(url, headers=headers, timeout=25)
            # Nếu Token trả phí hết usage / hết hạn -> Tự động chuyển về Free Tier không gắn Token
            if resp.status_code in (401, 402, 403) and poll_token:
                if "FREE_LIMIT" not in resp.text:
                    logger.warning(f"⚠️ [POLLINATIONS] Token hết usage hoặc không hợp lệ ({resp.status_code}). Tự động chuyển về chế độ Free Tier.")
                    headers.pop("Authorization", None)
                    resp = requests.get(url, headers=headers, timeout=25)

            # Tự động xử lý giới hạn tần suất miễn phí (Pollinations 1 ảnh / 45s)
            if resp.status_code == 402 and "FREE_LIMIT" in resp.text:
                m_retry = re.search(r"Retry after (\d+)s", resp.text)
                wait_sec = (int(m_retry.group(1)) + 2) if m_retry else 45
                wait_sec = min(50, max(5, wait_sec))
                logger.info(f"⏳ [POLLINATIONS FLUX] Đang đợi cooldown {wait_sec}s để sinh ảnh FLUX Cảnh #{scene_num}...")
                time.sleep(wait_sec)
                resp = requests.get(url, headers=headers, timeout=35)
            dur_ms = int((time.time() - t0) * 1000)
            if resp.status_code == 200 and len(resp.content) > 5000:
                with open(output_path, "wb") as f:
                    f.write(resp.content)
                with Image.open(output_path) as img:
                    img.verify()
                try:
                    record_ai_usage(
                        provider=p_name,
                        model=m_name,
                        task="image_generation",
                        video_id=video_id,
                        prompt_tokens=len(full_prompt.split()),
                        completion_tokens=0,
                        total_tokens=len(full_prompt.split()),
                        estimated_cost=0.0,
                        duration_ms=dur_ms,
                        status="success"
                    )
                except Exception:
                    pass
                return True
        except Exception as e:
            dur_ms = int((time.time() - t0) * 1000)
            try:
                record_ai_usage(
                    provider=p_name,
                    model=m_name,
                    task="image_generation",
                    video_id=video_id,
                    duration_ms=dur_ms,
                    status="error",
                    error_message=str(e)
                )
            except Exception:
                pass
            logger.warning(f"Pollinations request không khả dụng cho scene {scene_num}: {e}")

        # 5. Fallback thông minh: Tải ảnh nghệ thuật / đồ họa chuẩn CHỦ ĐỀ & NGỮ CẢNH từ Pixabay / Pexels
        try:
            stop_words = {
                "a", "an", "the", "in", "on", "at", "by", "for", "with", "about", "against",
                "between", "into", "through", "during", "before", "after", "above", "below",
                "to", "from", "up", "down", "of", "and", "or", "scene", "shot", "cinematic",
                "lighting", "ultra-detailed", "vertical", "9:16", "dont", "don't", "make",
                "this", "that", "how", "what", "why", "when", "test", "name", "shorts", "part"
            }
            # Rút trích từ khóa bối cảnh chủ đạo từ video_title (khóa chặt ngách nội dung của video: interview, dating, monster, cooking, tech...)
            title_text = video_title or context_topic or ""
            title_words = [w.strip('.,;:"\'[]()!?-').lower() for w in title_text.split() if w.strip('.,;:"\'[]()!?-').lower() not in stop_words and len(w.strip('.,;:"\'[]()!?-')) > 2]
            topic_anchor = " ".join(title_words[:3])

            # Rút trích từ khóa phân cảnh từ stock_query (LLM tạo chuẩn ngữ cảnh) hoặc prompt
            source_q = stock_query or prompt
            scene_words = [w.strip('.,;:"\'[]()!?-').lower() for w in source_q.split() if w.strip('.,;:"\'[]()!?-').lower() not in stop_words and len(w.strip('.,;:"\'[]()!?-')) > 2]

            # Ghép mỏ neo chủ đề + từ khóa phân cảnh (ưu tiên từ khóa tiếng Anh thuần để Pixabay/Pexels tìm chính xác 100%)
            is_ascii_anchor = all(ord(c) < 128 for c in topic_anchor)
            if is_ascii_anchor and topic_anchor and scene_words:
                search_term = f"{topic_anchor} {' '.join(scene_words[:2])}"
            elif scene_words:
                search_term = " ".join(scene_words[:3])
            elif is_ascii_anchor and topic_anchor:
                search_term = topic_anchor
            else:
                search_term = "cinematic vertical photography"

            pexels_key, pixabay_key = stock_footage_manager.get_api_keys()
            photo_url = None

            if pixabay_key:
                # Tìm ảnh với SafeSearch & Semantic Overlap Ranking theo đúng chủ đề
                photo_url = stock_footage_manager.search_pixabay_photo(search_term, pixabay_key)
                if not photo_url and topic_anchor and topic_anchor != search_term:
                    photo_url = stock_footage_manager.search_pixabay_photo(topic_anchor, pixabay_key)
                if not photo_url and scene_words:
                    photo_url = stock_footage_manager.search_pixabay_photo(" ".join(scene_words[:2]), pixabay_key)

            if not photo_url and pexels_key:
                photo_url = stock_footage_manager.search_pexels_photo(search_term, pexels_key)

            if photo_url and stock_footage_manager.download_file(photo_url, output_path):
                with Image.open(output_path) as img:
                    img.verify()
                log_event("INFO", f"📸 [PIXABAY VISUAL ART] Cảnh #{scene_num}: Đã tải ảnh minh họa chất lượng cao '{search_term}' khớp 100% chủ đề.")
                return True
        except Exception as p_err:
            logger.warning(f"Fallback Pixabay/Pexels cho scene {scene_num} gặp lỗi: {p_err}")

        # 6. Fallback an toàn: Gradient PIL
        try:
            self._generate_fallback_image(prompt, scene_num, output_path)
            return True
        except Exception as fe:
            logger.error(f"Lỗi tạo fallback image scene {scene_num}: {fe}")
            return False

    def create_scene_video_clip(
        self,
        image_path: str,
        duration: float,
        output_clip_path: str,
        motion_type: str = "zoom_in",
        width: int = 1080,
        height: int = 1920,
        fps: int = 30
    ) -> bool:
        """
        Tạo clip video dọc 1080x1920 từ 1 bức ảnh với hiệu ứng chuyển động máy quay Ken Burns mượt mà:
        - zoom_in: Camera từ từ phóng to vào trọng tâm bức ảnh
        - zoom_out: Camera từ từ thu nhỏ ra xa tạo chiều sâu
        - pan_up: Camera từ từ trượt dọc từ dưới lên
        - pan_down: Camera từ từ lia xuống
        """
        frames = max(30, int(fps * duration))

        if motion_type == "zoom_in":
            vf = (
                f"zoompan=z='min(zoom+0.0015,1.25)':d={frames}:"
                f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
                f"s={width}x{height}:fps={fps}"
            )
        elif motion_type == "zoom_out":
            vf = (
                f"zoompan=z='if(lte(zoom,1.0),1.25,max(1.001,zoom-0.0015))':d={frames}:"
                f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
                f"s={width}x{height}:fps={fps}"
            )
        elif motion_type == "pan_up":
            vf = (
                f"zoompan=z=1.15:d={frames}:"
                f"x='iw/2-(iw/zoom/2)':y='if(lte(on,1),ih*0.2,max(0,ih*0.2-on*0.8))':"
                f"s={width}x{height}:fps={fps}"
            )
        else:  # pan_down
            vf = (
                f"zoompan=z=1.15:d={frames}:"
                f"x='iw/2-(iw/zoom/2)':y='if(lte(on,1),0,min(ih*0.2,on*0.8))':"
                f"s={width}x{height}:fps={fps}"
            )

        encoder_flags = get_optimal_video_encoder_flags()
        cmd = [
            self.ffmpeg_bin, "-y",
            "-loop", "1",
            "-i", image_path,
            "-t", str(duration),
            "-vf", vf
        ]
        cmd.extend(encoder_flags)
        cmd.extend([
            "-crf", "22",
            "-pix_fmt", "yuv420p",
            output_clip_path
        ])
        try:
            res = subprocess.run(
                cmd, capture_output=True, timeout=90,
                creationflags=0x08000000 if sys.platform == 'win32' else 0
            )
            return res.returncode == 0 and os.path.exists(output_clip_path) and os.path.getsize(output_clip_path) > 1024
        except Exception as e:
            logger.error(f"Lỗi khi render Ken Burns clip cho {image_path}: {e}")
            return False

    def merge_scene_video_clips(
        self,
        clips: List[str],
        durations: List[float],
        output_path: str,
        temp_dir: Path,
        transition_duration: float = 0.25
    ) -> bool:
        """
        Ghép nối chuỗi phân cảnh video với hiệu ứng chuyển cảnh mềm mịn (Crossfade / Dissolve xfade):
        - Nếu có từ 2 clip trở lên: Sử dụng bộ lọc xfade 0.25s để tạo chuyển tiếp liền mạch điện ảnh giữa các clip 5s.
        - Tự động fallback về concat demuxer an toàn nếu FFmpeg xfade gặp lỗi.
        """
        if not clips:
            return False

        if len(clips) == 1:
            try:
                import shutil
                shutil.copy2(clips[0], output_path)
                return True
            except Exception:
                pass

        # Thử ghép bằng xfade crossfade nếu có từ 2 clip và đủ thông số thời lượng
        if len(clips) >= 2 and len(durations) >= len(clips):
            try:
                inputs = []
                for c in clips:
                    clean_c = os.path.abspath(c).replace("\\", "/")
                    inputs.extend(["-i", clean_c])

                T = min(0.3, max(0.15, transition_duration))
                filter_parts = []
                cum_dur = durations[0]
                last_v = "0:v"

                for i in range(1, len(clips)):
                    # Plan v3.0 Sync-safe xfade offset: exact cumulative duration of prior audio segments
                    offset = max(0.1, round(cum_dur, 3))
                    out_v = f"v{i}" if i < len(clips) - 1 else "outv"
                    filter_parts.append(f"[{last_v}][{i}:v]xfade=transition=fade:duration={T}:offset={offset}[{out_v}]")
                    cum_dur = cum_dur + durations[i]
                    last_v = out_v

                filter_complex_str = ";".join(filter_parts)
                encoder_flags = get_optimal_video_encoder_flags()

                cmd_xfade = [
                    self.ffmpeg_bin, "-y",
                    *inputs,
                    "-filter_complex", filter_complex_str,
                    "-map", "[outv]",
                    *encoder_flags,
                    "-an",
                    output_path
                ]
                res_xfade = subprocess.run(
                    cmd_xfade,
                    capture_output=True,
                    timeout=120,
                    creationflags=0x08000000 if sys.platform == 'win32' else 0
                )
                if res_xfade.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 1024:
                    log_event("INFO", f"🎬 [SMOOTH XFADE] Đã ghép thành công {len(clips)} clip với hiệu ứng chuyển cảnh mềm 0.25s.")
                    return True
            except Exception as e_xfade:
                logger.warning(f"Lỗi khi ghép video bằng xfade ({e_xfade}). Tự động fallback về concat chuẩn.")

        # Fallback an toàn: Concat Demuxer chuẩn
        concat_video_txt = str(temp_dir / "concat_videos.txt")
        with open(concat_video_txt, "w", encoding="utf-8") as f:
            for c_path in clips:
                clean_p = os.path.abspath(c_path).replace("\\", "/")
                f.write(f"file '{clean_p}'\n")

        cmd_concat_v = [
            self.ffmpeg_bin, "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_video_txt,
            "-c", "copy",
            output_path
        ]
        res_c = subprocess.run(
            cmd_concat_v,
            capture_output=True,
            timeout=60,
            creationflags=0x08000000 if sys.platform == 'win32' else 0
        )
        return res_c.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 1024

    def process_ai_story_video(
        self,
        raw_transcript: str,
        video_id: str,
        video_title: str = "",
        channel_name: str = "",
        output_dir: Optional[str] = None,
        target_duration: float = 65.0,
        target_language: str = "vi",
        script_style: str = "giat_gan",
        image_style: str = "cinematic",
        visual_source: str = "ai",
        ai_image_model: str = "flux",
        ai_video_model: str = "fal_ltx",
        stock_provider: str = "all",
        voice_gender: str = "male",
        voice_id: Optional[str] = None,
        tts_engine: str = "edge-tts",
        elevenlabs_voice_id: Optional[str] = None,
        elevenlabs_model: Optional[str] = "eleven_multilingual_v2",
        subtitle_style: str = "karaoke_yellow",
        subtitle_position: str = "center",
        bgm_folder: Optional[str] = None,
        bgm_volume: float = 0.15,
        ai_provider: Optional[str] = None,
        ai_model: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Quy trình sản xuất trọn gói Video AI Story 100% Ảnh AI / Stock Thật & Kịch Bản Mới:
        1. Phân tích kịch bản thành N phân cảnh qua LLM.
        2. Sinh giọng đọc Edge-TTS cho từng phân cảnh, lấy thời lượng chính xác.
        3. Tải / Sinh ảnh AI hoặc video thật Pexels/Pixabay chuẩn 9:16.
        4. Render video Ken Burns cho từng phân cảnh khớp 100% thời lượng giọng đọc.
        5. Ghép nối thành chuỗi video hoàn chỉnh.
        6. Tạo và burn phụ đề Karaoke động ASS.
        7. Mix nhạc nền BGM (Sidechain Auto-Ducking).
        8. Lưu vào thư mục Render và trả về kết quả.
        """
        from backend.modules.ai_video_engine import sanitize_filename

        safe_channel = sanitize_filename(channel_name, max_length=25)
        safe_title = sanitize_filename(video_title, max_length=35)

        base_target_dir = Path(output_dir) if output_dir else self.output_dir
        if channel_name and channel_name.strip() and channel_name.strip() not in ("Dán trực tiếp", "Direct Links"):
            clean_ch = re.sub(r'[\\/*?:"<>|]', '', channel_name).strip()
            target_dir = base_target_dir / (clean_ch or "Direct Links")
        else:
            target_dir = base_target_dir / "Direct Links"
        target_dir.mkdir(parents=True, exist_ok=True)

        temp_work_dir = target_dir / f"aistory_temp_{video_id}_{int(time.time())}"
        temp_work_dir.mkdir(parents=True, exist_ok=True)

        log_event(
            "INFO",
            f"🚀 [AI STORYTELLING] Bắt đầu tạo video mới cho '{video_title}' "
            f"(Thời lượng: {target_duration}s, Nguồn: {visual_source.upper()}, Model: {ai_image_model.upper()}, Stock: {stock_provider.upper()})"
        )

        # Bước 1: LLM Phân tích & Viết lại kịch bản phân cảnh
        custom_scenes = kwargs.get("custom_scenes")
        if custom_scenes:
            scenes = custom_scenes
            scene_data = {
                "scenes": scenes,
                "viral_title": kwargs.get("custom_title") or video_title,
                "hook": kwargs.get("custom_hook") or (scenes[0].get("narration") if scenes else ""),
                "description": kwargs.get("custom_description") or "",
                "hashtags": kwargs.get("custom_hashtags") or "#viral #fyp",
                "language": target_language or "vi"
            }
        else:
            scene_data = self.rewrite_to_scenes(
                raw_transcript=raw_transcript,
                video_title=video_title,
                target_duration=target_duration,
                target_language=target_language,
                script_style=script_style,
                image_style=image_style,
                ai_provider=ai_provider,
                ai_model=ai_model,
                video_id=video_id
            )
            scenes = scene_data.get("scenes", [])
        if not scenes:
            return {"status": "error", "message": "Không thể tạo phân cảnh kịch bản từ transcript."}

        effective_lang = scene_data.get("language", "vi")
        viral_title = scene_data.get("viral_title") or video_title
        hook_text = scene_data.get("hook", "")
        description = scene_data.get("description", "")
        hashtags = scene_data.get("hashtags", "#viral #fyp")

        # Bước 2: Sinh giọng đọc AI cho từng phân cảnh và đồng bộ mốc thời gian phụ đề
        scene_audio_files: List[str] = []
        scene_durations: List[float] = []
        all_transcript_segments: List[Dict[str, Any]] = []
        current_time_offset = 0.0

        # Phân giải ưu tiên giọng đọc ElevenLabs vs Edge-TTS
        effective_voice_id = voice_id or kwargs.get("elevenlabs_voice_id") or elevenlabs_voice_id
        if (tts_engine == "elevenlabs" or kwargs.get("tts_engine") == "elevenlabs") and (elevenlabs_voice_id or kwargs.get("elevenlabs_voice_id")):
            effective_voice_id = elevenlabs_voice_id or kwargs.get("elevenlabs_voice_id")
        effective_el_model = elevenlabs_model or kwargs.get("elevenlabs_model") or "eleven_multilingual_v2"

        for idx, scene in enumerate(scenes):
            narr_text = scene.get("narration", "").strip()
            if not narr_text:
                continue

            scene_audio_path = str(temp_work_dir / f"audio_scene_{idx + 1}.mp3")
            out_p = None
            segs = []

            for attempt in range(3):
                try:
                    out_p, segs, _ = ai_narrator.synthesize_voice(
                        text=narr_text,
                        output_path=scene_audio_path,
                        language=effective_lang,
                        gender=voice_gender,
                        voice=effective_voice_id,
                        elevenlabs_model=effective_el_model
                    )
                    if out_p and os.path.exists(scene_audio_path) and os.path.getsize(scene_audio_path) > 1024:
                        break
                except Exception:
                    pass
                time.sleep(1.2)

            if not os.path.exists(scene_audio_path) or os.path.getsize(scene_audio_path) <= 1024:
                est_dur = max(3.0, round(len(narr_text.split()) * 0.42, 2))
                cmd_sil = [
                    self.ffmpeg_bin, "-y",
                    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                    "-t", str(est_dur),
                    "-acodec", "libmp3lame", "-b:a", "128k",
                    scene_audio_path
                ]
                subprocess.run(cmd_sil, capture_output=True, timeout=10, creationflags=0x08000000 if sys.platform == 'win32' else 0)
                dur = est_dur
            else:
                dur = self._get_exact_media_duration(scene_audio_path)
                if dur <= 0.1:
                    dur = max(3.0, round(len(narr_text.split()) * 0.42, 2))

            scene_durations.append(dur)
            scene_audio_files.append(scene_audio_path)

            if segs:
                for s in segs:
                    s_start = s.get("start", 0.0) + current_time_offset
                    s_end = s.get("end", 0.0) + current_time_offset
                    w_list = []
                    for w in s.get("words", []):
                        w_list.append({
                            "word": w.get("word", ""),
                            "start": round(w.get("start", 0.0) + current_time_offset, 2),
                            "end": round(w.get("end", 0.0) + current_time_offset, 2)
                        })
                    all_transcript_segments.append({
                        "start": round(s_start, 2),
                        "end": round(s_end, 2),
                        "text": s.get("text", ""),
                        "words": w_list
                    })
            else:
                words = narr_text.split()
                w_dur = dur / max(1, len(words))
                w_list = []
                for w_idx, w in enumerate(words):
                    w_start = current_time_offset + (w_idx * w_dur)
                    w_end = w_start + w_dur
                    w_list.append({"word": w, "start": round(w_start, 2), "end": round(w_end, 2)})
                all_transcript_segments.append({
                    "start": round(current_time_offset, 2),
                    "end": round(current_time_offset + dur, 2),
                    "text": narr_text,
                    "words": w_list
                })

            current_time_offset += dur
            time.sleep(1.0)

        total_audio_duration = current_time_offset
        if not scene_audio_files:
            return {"status": "error", "message": "Không thể sinh giọng đọc AI cho các phân cảnh."}

        # Bước 3 & 4: Chuẩn bị hình ảnh / video clip theo Visual Source
        motions = ["zoom_in", "zoom_out", "pan_up", "pan_down"]
        scene_video_clips: List[str] = []

        log_event(
            "INFO",
            f"🎬 [AI STORYTELLING] Chuẩn bị {len(scenes)} cảnh (Nguồn: {visual_source.upper()}, Model AI: {ai_image_model.upper()}, Stock: {stock_provider.upper()})..."
        )

        transition_d = 0.25

        for idx, scene in enumerate(scenes):
            img_prompt = scene.get("image_prompt", "")
            stock_q = scene.get("stock_query") or img_prompt or video_title
            img_path = str(temp_work_dir / f"img_scene_{idx + 1}.jpg")
            clip_path = str(temp_work_dir / f"clip_scene_{idx + 1}.mp4")
            # Plan v3.0 Sync-safe xfade: Mọi clip trừ clip cuối dài thêm transition_d giây để bù thời gian chuyển cảnh
            base_dur = scene_durations[idx] if idx < len(scene_durations) else 5.0
            dur = base_dur + (transition_d if idx < len(scenes) - 1 else 0.0)
            motion = motions[idx % len(motions)]

            # Plan v3.0 Smart Scene Routing (O1 Zero Torsion + O6 Smart Mix)
            has_person = bool(scene.get("has_person", False))
            face_prominence = float(scene.get("face_prominence", 0.0))
            is_action = bool(scene.get("is_action", False))
            is_hook = (idx == 0)
            is_climax = (idx == len(scenes) - 1)

            if not has_person:
                lower_ip = img_prompt.lower()
                if any(k in lower_ip for k in ["man", "woman", "person", "girl", "boy", "face", "portrait", "hands", "soldier", "detective", "doctor", "crowd", "people"]):
                    has_person = True

            # Quy tắc định tuyến nguồn hình ảnh:
            if visual_source == "stock":
                route_choice = "stock"
            elif visual_source == "mixed":
                route_choice = "stock" if (idx % 2 == 0) else "ken_burns"
            elif has_person or face_prominence >= 0.15:
                # Có người/khuôn mặt -> Ưu tiên Ken Burns để tránh méo mặt
                route_choice = "ken_burns"
            elif is_action or is_hook or is_climax:
                route_choice = "ai_video" if visual_source == "ai_video" else "ken_burns"
            else:
                route_choice = "ai_video" if visual_source == "ai_video" else "ken_burns"

            log_event("INFO", f"🎬 [SCENE #{idx + 1}] Route: {route_choice.upper()} | Query: {stock_q[:60]}")

            clip_ready = False

            # Xử lý nếu định tuyến vào Stock Footage
            if route_choice == "stock":
                stock_res = stock_footage_manager.fetch_stock_scene(
                    query=stock_q,
                    duration=dur,
                    temp_dir=temp_work_dir,
                    scene_idx=idx + 1,
                    provider=stock_provider,
                    prefer_video=True
                )
                if stock_res:
                    if stock_res.get("type") == "video_clip":
                        # Conform clip stock (tự động blur nền nếu là video 16:9 ngang)
                        conformed_stock = str(temp_work_dir / f"stock_conf_{idx + 1}.mp4")
                        if ai_video_generator.conform_video_clip(stock_res["path"], conformed_stock, dur, background_mode="blur"):
                            scene_video_clips.append(conformed_stock)
                            clip_ready = True
                        else:
                            scene_video_clips.append(stock_res["path"])
                            clip_ready = True
                    elif stock_res.get("type") == "photo_image":
                        ok = self.create_scene_video_clip(
                            image_path=stock_res["path"],
                            duration=dur,
                            output_clip_path=clip_path,
                            motion_type=motion
                        )
                        if ok:
                            scene_video_clips.append(clip_path)
                            clip_ready = True

            # Xử lý nếu định tuyến vào AI Video hoặc Ken Burns
            if not clip_ready:
                # Sinh ảnh keyframe chuẩn phong cách cho phân cảnh
                self.generate_scene_image(
                    prompt=img_prompt,
                    scene_num=idx + 1,
                    output_path=img_path,
                    image_style=image_style,
                    ai_model=ai_image_model,
                    stock_query=stock_q,
                    video_title=video_title,
                    video_id=video_id
                )

                if route_choice == "ai_video":
                    v_res = ai_video_generator.generate_scene_video(
                        prompt=img_prompt,
                        image_path=img_path,
                        duration=dur,
                        output_clip_path=clip_path,
                        motion_prompt=scene.get("camera_motion", "push_in"),
                        model_choice=ai_video_model or "fal_ltx",
                        scene_num=idx + 1,
                        video_id=video_id
                    )
                    if v_res.get("success"):
                        scene_video_clips.append(clip_path)
                        clip_ready = True
                    else:
                        log_event("WARNING", f"Lỗi sinh video AI cảnh #{idx + 1} ({v_res.get('message')}). Fallback sang Ken Burns.")

                # Fallback Ken Burns (2D camera path, 100% không méo vặn vẹo)
                if not clip_ready:
                    ok = self.create_scene_video_clip(
                        image_path=img_path,
                        duration=dur,
                        output_clip_path=clip_path,
                        motion_type=motion
                    )
                    if ok:
                        scene_video_clips.append(clip_path)
                    else:
                        log_event("WARNING", f"Không thể tạo video clip cho scene {idx + 1}")

        if not scene_video_clips:
            return {"status": "error", "message": "Không thể tạo video clips từ tư liệu hình ảnh."}

        # Bước 5: Ghép nối chuỗi video và chuỗi âm thanh
        merged_video_path = str(temp_work_dir / "merged_video.mp4")
        self.merge_scene_video_clips(
            clips=scene_video_clips,
            durations=scene_durations[:len(scene_video_clips)],
            output_path=merged_video_path,
            temp_dir=temp_work_dir,
            transition_duration=0.25
        )

        concat_audio_txt = str(temp_work_dir / "concat_audios.txt")
        with open(concat_audio_txt, "w", encoding="utf-8") as f:
            for a_path in scene_audio_files:
                clean_p = os.path.abspath(a_path).replace("\\", "/")
                f.write(f"file '{clean_p}'\n")

        merged_audio_path = str(temp_work_dir / "merged_narration.mp3")
        cmd_concat_a = [
            self.ffmpeg_bin, "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_audio_txt,
            "-c:a", "libmp3lame",
            "-b:a", "192k",
            merged_audio_path
        ]
        subprocess.run(cmd_concat_a, capture_output=True, timeout=60, creationflags=0x08000000 if sys.platform == 'win32' else 0)

        # Bước 6: Chuẩn bị Phụ đề Karaoke động (.ass)
        enable_subtitles = kwargs.get('enable_subtitles', True) if 'enable_subtitles' in kwargs else kwargs.get('enable_subtitle', True)
        sub_ass_path = str(temp_work_dir / f"{video_id}_karaoke.ass")
        ass_ok = False
        if enable_subtitles:
            ass_ok = ass_subtitle_generator.generate_karaoke_ass(
                transcript_segments=all_transcript_segments,
                output_ass_path=sub_ass_path,
                start_offset=0.0,
                max_duration=total_audio_duration,
                style_name=subtitle_style or SUBTITLE_STYLE,
                position=subtitle_position or SUBTITLE_POSITION,
                font_size=SUBTITLE_FONT_SIZE,
                hook_title=viral_title or scene_data.get("hook")
            )
        else:
            logger.info(f"🚫 [AI STORY] Bỏ qua tạo phụ đề cho video {video_id} (Người dùng tắt Tự động nhận diện & tạo phụ đề AI).")

        # Bước 7: Chọn BGM thông minh nếu có
        selected_bgm = None
        bgm_start_offset = 0.0
        if bgm_folder and bgm_folder.strip().lower() not in ("none", "off", "disable", "disabled", "no_bgm"):
            transcript_sample = " ".join([s.get("narration", "") for s in scenes[:4]])
            selected_bgm, bgm_start_offset, _ = audio_manager.get_smart_bgm(
                folder_or_mood=bgm_folder.strip(),
                transcript_text=transcript_sample
            )

        # Đặt tên file xuất sắc nét
        parts = []
        if safe_channel:
            parts.append(f"[{safe_channel}]")
        parts.append(safe_title or "AI_Story_Video")
        parts.append(f"{video_id}_AIStory")
        part_num = kwargs.get("part_number")
        if part_num:
            parts.append(f"Part{part_num}")
        final_filename = "_".join(parts) + ".mp4"
        final_output_path = str(target_dir / final_filename)

        # Bước 8: Render Pass Cuối (Multiplex Video + Audio + BGM + Subtitle ASS)
        log_event("INFO", f"🎬 [AI STORYTELLING] Render hoàn thiện video AI 9:16 -> {final_filename}")

        filter_parts = []
        if ass_ok and os.path.exists(sub_ass_path):
            escaped_ass = escape_ffmpeg_path(sub_ass_path)
            filter_parts.append(f"[0:v]subtitles='{escaped_ass}'[v_out]")
            out_v_map = "[v_out]"
        else:
            out_v_map = "0:v"

        cmd_final = [
            self.ffmpeg_bin, "-y",
            "-i", merged_video_path,
            "-i", merged_audio_path
        ]

        fade_start = max(0.0, total_audio_duration - 2.0)
        if selected_bgm and os.path.exists(selected_bgm):
            cmd_final.extend(["-ss", str(bgm_start_offset), "-i", selected_bgm])
            bgm_vol = min(0.3, max(0.05, bgm_volume))
            duck_filter = (
                f"[2:a]volume={bgm_vol},afade=t=out:st={fade_start}:d=2.0[bgm_faded];"
                f"[1:a][bgm_faded]amix=inputs=2:duration=first:dropout_transition=2[a_mix]"
            )
            filter_parts.append(duck_filter)
            out_a_map = "[a_mix]"
        else:
            out_a_map = "1:a"

        if filter_parts:
            cmd_final.extend(["-filter_complex", ";".join(filter_parts)])

        encoder_flags = get_optimal_video_encoder_flags()
        cmd_final.extend([
            "-map", out_v_map,
            "-map", out_a_map
        ])
        cmd_final.extend(encoder_flags)
        cmd_final.extend([
            "-c:a", "aac",
            "-b:a", "192k",
            "-t", str(total_audio_duration),
            "-map_metadata", "-1",
            final_output_path
        ])

        res = subprocess.run(
            cmd_final, capture_output=True, timeout=180,
            creationflags=0x08000000 if sys.platform == 'win32' else 0
        )

        try:
            import shutil
            shutil.rmtree(temp_work_dir, ignore_errors=True)
        except Exception:
            pass

        if res.returncode == 0 and os.path.exists(final_output_path) and os.path.getsize(final_output_path) > 1024:
            log_event("INFO", f"🎉 [AI STORYTELLING HOÀN THÀNH] Đã tạo thành công video mới 100%: {final_filename} ({total_audio_duration:.1f}s, {len(scenes)} scenes)")
            return {
                "status": "success",
                "rendered_file": final_output_path,
                "rendered_files": [final_output_path],
                "parts_count": 1,
                "total_duration": total_audio_duration,
                "scenes_count": len(scenes),
                "ai_copy": {
                    "hook": hook_text,
                    "title": viral_title,
                    "description": description,
                    "tags": hashtags
                }
            }
        else:
            err_msg = res.stderr.decode("utf-8", errors="replace")[-400:]
            logger.error(f"Render AI Story thất bại: {err_msg}")
            return {"status": "error", "message": f"Lỗi render video AI Story: {err_msg}"}

    def process_episodic_story_series(
        self,
        raw_transcript: str,
        video_id: str,
        video_title: str,
        channel_name: str = "",
        target_language: str = "vi",
        ethnicity: str = "auto",
        visual_source: str = "ai",
        ai_image_model: str = "flux",
        enable_subtitles: bool = True,
        subtitle_style: str = "karaoke_yellow",
        bgm_folder: str = "cinematic",
        force_regenerate_script: bool = False,
        target_part: Optional[int] = None,
        num_parts: Optional[int] = None,
        target_duration: float = 65.0,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Quy trình sản xuất trọn bộ Series TikTok nhiều tập (Episodic Bible Arc):
        1. Gọi episodic_generator để phân tích thể loại, tạo Master Bible và kịch bản phân cảnh từng tập (Part 1, 2, 3...)
        2. Tự động render từng tập với các neo nhân vật đồng nhất và cliffhanger hoàn hảo.
        """
        log_event("INFO", f"🎬 [EPISODIC SERIES] Bắt đầu sản xuất series cho video '{video_title}' ({video_id}, {num_parts or 'auto'} parts)")

        series_data = generate_episodic_series(
            transcript=raw_transcript,
            title=video_title,
            num_parts=num_parts,
            language=target_language,
            ethnicity=ethnicity,
            image_model=ai_image_model,
            force=force_regenerate_script,
            target_duration=target_duration
        )

        if not series_data or not series_data.get("parts"):
            return {"status": "error", "message": "Không thể tạo kịch bản episodic series từ transcript."}

        bible = series_data.get("bible", {})
        parts = series_data.get("parts", [])
        rendered_outputs = []
        total_time = 0.0

        for p in parts:
            p_num = p.get("part_number", 1)
            if target_part is not None and p_num != target_part:
                continue

            p_title = p.get("part_title") or f"{bible.get('series_title', video_title)} - Part {p_num}"
            p_scenes = p.get("scenes", [])
            p_hook = p.get("hook", "")
            p_summary = p.get("summary", "")

            log_event("INFO", f"🚀 [EPISODIC RENDER] Render Part {p_num}/{len(parts)}: '{p_title}' ({len(p_scenes)} scenes)")

            p_res = self.process_ai_story_video(
                raw_transcript="",
                video_id=video_id,
                video_title=p_title,
                channel_name=channel_name,
                target_duration=target_duration,
                target_language=target_language,
                visual_source=visual_source,
                ai_image_model=ai_image_model,
                enable_subtitles=enable_subtitles,
                subtitle_style=subtitle_style,
                bgm_folder=bgm_folder,
                custom_scenes=p_scenes,
                custom_title=p_title,
                custom_hook=p_hook,
                custom_description=p_summary,
                part_number=p_num,
                **kwargs
            )

            if p_res.get("status") == "success" and p_res.get("rendered_file"):
                rendered_outputs.append(p_res["rendered_file"])
                total_time += p_res.get("total_duration", 0.0)
            else:
                log_event("WARNING", f"Render thất bại cho Part {p_num}: {p_res.get('message')}")

        return {
            "status": "success" if rendered_outputs else "error",
            "series_title": bible.get("series_title", video_title),
            "bible": bible,
            "parts_count": len(rendered_outputs),
            "rendered_files": rendered_outputs,
            "rendered_file": rendered_outputs[0] if rendered_outputs else None,
            "total_duration": total_time
        }

    # Aliases
    process_moneyprinter_video = process_ai_story_video


ai_story_engine = AIStoryEngine()

# Backward-compatibility aliases
money_printer_engine = ai_story_engine
MoneyPrinterEngine = AIStoryEngine
