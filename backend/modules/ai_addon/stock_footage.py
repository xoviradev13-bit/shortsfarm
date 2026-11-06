import os
import sys
import json
import random
import urllib.parse
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

import requests
from PIL import Image

from backend.database import log_event
from backend.logger import get_logger
from backend.modules.video_core.hardware_accel import get_ffmpeg_binary, get_optimal_video_encoder_flags

logger = get_logger("stock_footage")


class StockFootageManager:
    """
    Quản lý tìm kiếm và tải tư liệu video / hình ảnh thật từ Pexels & Pixabay:
    - Tìm kiếm theo từ khóa tiếng Anh (stock query)
    - Tự động lọc định dạng dọc 9:16 (portrait) chuẩn TikTok/Shorts
    - Chuẩn hóa video sang độ phân giải 1080x1920 với thời lượng khớp phân cảnh
    - Fallback thông minh giữa Pexels và Pixabay
    """

    def __init__(self):
        self.ffmpeg_bin = get_ffmpeg_binary()

    def get_api_keys(self) -> Tuple[str, str]:
        """Lấy PEXELS_API_KEY và PIXABAY_API_KEY từ database settings hoặc biến môi trường"""
        from backend.database import get_connection
        pexels_key = os.getenv("PEXELS_API_KEY", "").strip()
        pixabay_key = os.getenv("PIXABAY_API_KEY", "").strip()
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM settings WHERE key IN ('PEXELS_API_KEY', 'PIXABAY_API_KEY')")
            rows = cursor.fetchall()
            conn.close()
            for r in rows:
                k = r["key"]
                v = (r["value"] or "").strip()
                if k == "PEXELS_API_KEY" and v:
                    pexels_key = v
                elif k == "PIXABAY_API_KEY" and v:
                    pixabay_key = v
        except Exception as e:
            logger.warning(f"Không thể đọc key stock từ DB: {e}")
        return pexels_key, pixabay_key

    def search_pexels_video(self, query: str, pexels_key: str, per_page: int = 10) -> Optional[str]:
        """Tìm video dọc (portrait) trên Pexels và trả về URL tải file MP4 chất lượng tốt nhất"""
        if not pexels_key:
            return None
        try:
            encoded_q = urllib.parse.quote(query)
            url = f"https://api.pexels.com/videos/search?query={encoded_q}&orientation=portrait&per_page={per_page}"
            headers = {
                "Authorization": pexels_key,
                "User-Agent": "ShortsStack/2.0 StockFetcher"
            }
            res = requests.get(url, headers=headers, timeout=15)
            if res.status_code == 200:
                data = res.json()
                videos = data.get("videos", [])
                if not videos:
                    # Thử tìm không giới hạn orientation rồi crop sau
                    url_broad = f"https://api.pexels.com/videos/search?query={encoded_q}&per_page={per_page}"
                    res_b = requests.get(url_broad, headers=headers, timeout=15)
                    if res_b.status_code == 200:
                        videos = res_b.json().get("videos", [])
                if videos:
                    # Chọn ngẫu nhiên trong top 3 video phù hợp nhất
                    candidate = random.choice(videos[:min(3, len(videos))])
                    files = candidate.get("video_files", [])
                    # Ưu tiên độ phân giải HD (width 1080 hoặc 720)
                    files_sorted = sorted(files, key=lambda f: (f.get("width", 0) * f.get("height", 0)), reverse=True)
                    for f in files_sorted:
                        link = f.get("link")
                        if link and "mp4" in link.lower():
                            return link
        except Exception as e:
            logger.warning(f"Lỗi tìm video Pexels ({query}): {e}")
        return None

    def search_pexels_photo(self, query: str, pexels_key: str, per_page: int = 10) -> Optional[str]:
        """Tìm ảnh chân thực dọc trên Pexels"""
        if not pexels_key:
            return None
        try:
            encoded_q = urllib.parse.quote(query)
            url = f"https://api.pexels.com/v1/search?query={encoded_q}&orientation=portrait&per_page={per_page}"
            headers = {
                "Authorization": pexels_key,
                "User-Agent": "ShortsStack/2.0 StockFetcher"
            }
            res = requests.get(url, headers=headers, timeout=15)
            if res.status_code == 200:
                photos = res.json().get("photos", [])
                if photos:
                    choice = random.choice(photos[:min(3, len(photos))])
                    src = choice.get("src", {})
                    return src.get("large2x") or src.get("portrait") or src.get("large")
        except Exception as e:
            logger.warning(f"Lỗi tìm ảnh Pexels ({query}): {e}")
        return None

    # Chỉ lọc tuyệt đối nội dung người lớn / vi phạm chính sách cộng đồng TikTok
    # Tuyệt đối KHÔNG chặn các chủ đề sáng tạo như tình yêu (love, couple), kinh dị/quái vật (monster, horror), kỳ ảo (fantasy)...
    STRICT_POLICY_BLACKLIST = {
        "porn", "erotic", "nude", "nudity", "sexual", "vulgar", "lingerie", "bikini",
        "strip", "escort", "stripper", "hardcore", "drug"
    }

    def search_pixabay_video(self, query: str, pixabay_key: str, per_page: int = 20) -> Optional[str]:
        """Tìm video trên Pixabay với SafeSearch và bộ lọc liên quan theo chủ đề (Intent-Aware)"""
        if not pixabay_key:
            return None
        try:
            encoded_q = urllib.parse.quote(query[:120])
            url = f"https://pixabay.com/api/videos/?key={pixabay_key}&q={encoded_q}&per_page={per_page}&video_type=all&safesearch=true"
            res = requests.get(url, timeout=15)
            if res.status_code == 200:
                hits = res.json().get("hits", [])
                if hits:
                    q_words = set(query.lower().split())
                    clean_hits = []
                    for h in hits:
                        tags = {t.strip().lower() for t in h.get("tags", "").split(",") if t.strip()}
                        # Chỉ loại bỏ nội dung 18+ vi phạm chính sách TikTok
                        if any(b in tags for b in self.STRICT_POLICY_BLACKLIST):
                            continue
                        overlap = len(tags.intersection(q_words))
                        clean_hits.append((overlap, h))
                    
                    if clean_hits:
                        clean_hits.sort(key=lambda x: x[0], reverse=True)
                        best_pool = [item[1] for item in clean_hits[:min(4, len(clean_hits))]]
                        choice = random.choice(best_pool)
                    else:
                        choice = random.choice(hits[:min(4, len(hits))])
                    videos = choice.get("videos", {})
                    v_item = videos.get("medium") or videos.get("large") or videos.get("small")
                    if v_item and v_item.get("url"):
                        return v_item.get("url")
        except Exception as e:
            logger.warning(f"Lỗi tìm video Pixabay ({query}): {e}")
        return None

    def search_pixabay_photo(
        self,
        query: str,
        pixabay_key: str,
        per_page: int = 25,
        category: Optional[str] = None
    ) -> Optional[str]:
        """Tìm ảnh trên Pixabay với SafeSearch, ưu tiên xếp hạng theo độ khớp tag chủ đề (Semantic Overlap Ranking)"""
        if not pixabay_key:
            return None
        try:
            encoded_q = urllib.parse.quote(query[:120])
            cat_param = f"&category={category}" if category else ""
            url = f"https://pixabay.com/api/?key={pixabay_key}&q={encoded_q}&image_type=photo&orientation=vertical&safesearch=true{cat_param}&per_page={per_page}"
            res = requests.get(url, timeout=15)
            if res.status_code == 200:
                hits = res.json().get("hits", [])
                if hits:
                    q_words = set(query.lower().split())
                    clean_hits = []
                    for h in hits:
                        tags = {t.strip().lower() for t in h.get("tags", "").split(",") if t.strip()}
                        # Chỉ loại bỏ nội dung 18+ vi phạm chính sách cộng đồng
                        if any(b in tags for b in self.STRICT_POLICY_BLACKLIST):
                            continue
                        # Chấm điểm độ liên quan: Video về tình yêu -> tag couple/love điểm cao; Video quái vật -> tag monster điểm cao
                        overlap = len(tags.intersection(q_words))
                        clean_hits.append((overlap, h))
                    
                    if clean_hits:
                        clean_hits.sort(key=lambda x: x[0], reverse=True)
                        best_pool = [item[1] for item in clean_hits[:min(5, len(clean_hits))]]
                        choice = random.choice(best_pool)
                    else:
                        choice = hits[0]
                    return choice.get("largeImageURL") or choice.get("webformatURL")
        except Exception as e:
            logger.warning(f"Lỗi tìm ảnh Pixabay ({query}): {e}")
        return None

    def download_file(self, url: str, output_path: str, timeout: int = 30) -> bool:
        """Tải file media từ URL về disk"""
        try:
            headers = {"User-Agent": "ShortsStack/2.0"}
            r = requests.get(url, headers=headers, stream=True, timeout=timeout)
            if r.status_code == 200:
                with open(output_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=65536):
                        if chunk:
                            f.write(chunk)
                return os.path.exists(output_path) and os.path.getsize(output_path) > 1024
        except Exception as e:
            logger.warning(f"Lỗi tải file {url}: {e}")
        return False

    def process_stock_video_clip(
        self,
        raw_video_path: str,
        output_clip_path: str,
        duration: float,
        width: int = 1080,
        height: int = 1920,
        fps: int = 30
    ) -> bool:
        """
        Dùng FFmpeg chuyển đổi video tải từ Stock sang chuẩn 9:16 (1080x1920),
        cắt xén hoặc lặp (stream_loop) khớp chuẩn xác thời lượng phân cảnh.
        """
        try:
            encoder_flags = get_optimal_video_encoder_flags()
            # Filter: scale và crop giữa khung hình 9:16, chỉnh framerate và bỏ tiếng gốc
            vf = (
                f"scale={width}:{height}:force_original_aspect_ratio=increase,"
                f"crop={width}:{height},"
                f"fps={fps},setsar=1"
            )
            cmd = [
                self.ffmpeg_bin, "-y",
                "-stream_loop", "-1",  # Lặp video nếu thời lượng stock ngắn hơn scene
                "-i", raw_video_path,
                "-t", str(duration),
                "-vf", vf,
                "-an"  # Bỏ âm thanh của stock video để khớp với AI narration
            ]
            cmd.extend(encoder_flags)
            cmd.extend([
                "-pix_fmt", "yuv420p",
                output_clip_path
            ])

            res = subprocess.run(
                cmd, capture_output=True, timeout=90,
                creationflags=0x08000000 if sys.platform == "win32" else 0
            )
            return res.returncode == 0 and os.path.exists(output_clip_path) and os.path.getsize(output_clip_path) > 1024
        except Exception as e:
            logger.error(f"Lỗi xử lý clip stock video: {e}")
            return False

    def fetch_stock_scene(
        self,
        query: str,
        duration: float,
        temp_dir: Path,
        scene_idx: int,
        provider: str = "all",
        prefer_video: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        Tìm kiếm và chuẩn bị cảnh quay thật từ Pexels/Pixabay:
        - Trả về {"type": "video_clip", "path": clip_path} nếu tìm thấy và cắt video thành công
        - Trả về {"type": "photo_image", "path": img_path} nếu tìm thấy ảnh chụp thật
        - Trả về None nếu không có key hoặc không tìm thấy kết quả
        """
        pexels_key, pixabay_key = self.get_api_keys()

        if not pexels_key and not pixabay_key:
            logger.info("ℹ️ Chưa có Pexels API Key hoặc Pixabay API Key trong Cài đặt (Settings).")
            return None

        # Clean search query: loại bỏ ký tự lạ, giữ 3-5 từ cốt lõi
        clean_q = " ".join(query.replace(",", " ").replace(".", " ").split()[:6])
        if not clean_q:
            clean_q = "cinematic nature mystery"

        video_url = None
        photo_url = None
        source_used = ""

        # Ưu tiên theo provider
        providers_to_try = []
        if provider == "pexels":
            providers_to_try = ["pexels"]
        elif provider == "pixabay":
            providers_to_try = ["pixabay"]
        else:
            # "all": ưu tiên Pexels nếu có key, sau đó Pixabay
            if pexels_key:
                providers_to_try.append("pexels")
            if pixabay_key:
                providers_to_try.append("pixabay")

        # 1. Tìm video trước nếu prefer_video = True
        if prefer_video:
            for p in providers_to_try:
                if p == "pexels" and pexels_key:
                    video_url = self.search_pexels_video(clean_q, pexels_key)
                    if video_url:
                        source_used = "Pexels Video"
                        break
                elif p == "pixabay" and pixabay_key:
                    video_url = self.search_pixabay_video(clean_q, pixabay_key)
                    if video_url:
                        source_used = "Pixabay Video"
                        break

        # Nếu có video URL, tải về và crop chuẩn 9:16
        if video_url:
            raw_vid = str(temp_dir / f"stock_raw_{scene_idx:03d}.mp4")
            clip_out = str(temp_dir / f"stock_clip_{scene_idx:03d}.mp4")
            if self.download_file(video_url, raw_vid):
                ok = self.process_stock_video_clip(raw_vid, clip_out, duration)
                if ok:
                    log_event("INFO", f"🎥 [STOCK REAL FOOTAGE] Cảnh #{scene_idx+1}: Đã tải video thật từ {source_used} ({clean_q}) -> {duration:.1f}s")
                    return {"type": "video_clip", "path": clip_out, "source": source_used}

        # 2. Nếu không tìm được video hoặc prefer ảnh, tìm ảnh chụp thật (Stock Photo)
        for p in providers_to_try:
            if p == "pexels" and pexels_key:
                photo_url = self.search_pexels_photo(clean_q, pexels_key)
                if photo_url:
                    source_used = "Pexels Photo"
                    break
            elif p == "pixabay" and pixabay_key:
                photo_url = self.search_pixabay_photo(clean_q, pixabay_key)
                if photo_url:
                    source_used = "Pixabay Photo"
                    break

        if photo_url:
            img_out = str(temp_dir / f"stock_photo_{scene_idx:03d}.jpg")
            if self.download_file(photo_url, img_out):
                log_event("INFO", f"📸 [STOCK REAL PHOTO] Cảnh #{scene_idx+1}: Đã tải ảnh chụp thật từ {source_used} ({clean_q})")
                return {"type": "photo_image", "path": img_out, "source": source_used}

        return None


stock_footage_manager = StockFootageManager()

