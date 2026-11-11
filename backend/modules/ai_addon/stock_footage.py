import os
import sys
import json
import random
import re
import urllib.parse
import subprocess
import collections
import glob
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

import requests
from PIL import Image

from backend.config import BASE_DIR
from backend.database import log_event
from backend.logger import get_logger
from backend.modules.video_core.hardware_accel import get_ffmpeg_binary, get_optimal_video_encoder_flags

logger = get_logger("stock_footage")


class StockFootageManager:
    """
    Quản lý tìm kiếm và tải tư liệu video / hình ảnh thật từ Pexels & Pixabay:
    - Tìm kiếm theo từ khóa tiếng Anh (stock query)
    - Tự động lọc định dạng dọc 9:16 (portrait) chuẩn TikTok/Shorts
    - Chuẩn hóa video sang độ phân giải 1080x1920 hoặc 1080x960 (Split Screen) với thời lượng khớp phân cảnh
    - Fallback thông minh: Ưu tiên Pexels -> Tự động chuyển Pixabay khi lỗi / hết quota / không có key
    - Cơ chế chống trùng lặp (Anti-Duplication): Tự động ghi nhớ và chọn các video khác nhau cho mỗi lần render
    """

    def __init__(self):
        self.output_dir = BASE_DIR / "data" / "cache" / "stock_footage"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.split_dir = BASE_DIR / "data" / "cache" / "split_footage"
        self.split_dir.mkdir(parents=True, exist_ok=True)
        self.ffmpeg_bin = get_ffmpeg_binary()
        # Bộ nhớ đệm chống trùng lặp video đã dùng gần đây
        self._used_pexels_ids = collections.deque(maxlen=60)
        self._used_pixabay_ids = collections.deque(maxlen=60)
        self._used_local_videos = collections.deque(maxlen=40)

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

    def search_pexels_video(self, query: str, pexels_key: str, per_page: int = 15, min_duration: float = 0.0) -> Optional[str]:
        """Tìm video dọc (portrait) trên Pexels và trả về URL tải file MP4 chất lượng tốt nhất, ưu tiên video >= min_duration"""
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
                    # 1. Ưu tiên video có thời lượng >= min_duration (tránh phải loop video)
                    if min_duration > 0:
                        long_enough = [v for v in videos if float(v.get("duration", 0)) >= min_duration]
                        if long_enough:
                            videos = long_enough
                        else:
                            # Nếu không có video nào đủ dài, ưu tiên các video có thời lượng dài nhất
                            videos = sorted(videos, key=lambda v: float(v.get("duration", 0)), reverse=True)

                    # 2. Chống trùng lặp: Ưu tiên chọn video chưa xuất hiện trong các lần render gần nhất
                    fresh_videos = [v for v in videos if str(v.get("id")) not in self._used_pexels_ids]
                    pool = fresh_videos if fresh_videos else videos
                    candidate = random.choice(pool[:min(5, len(pool))])
                    if candidate.get("id"):
                        self._used_pexels_ids.append(str(candidate.get("id")))

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

    def search_pixabay_video(self, query: str, pixabay_key: str, per_page: int = 20, min_duration: float = 0.0) -> Optional[str]:
        """Tìm video trên Pixabay với SafeSearch, ưu tiên video có thời lượng >= min_duration"""
        if not pixabay_key:
            return None
        import time as _time
        try:
            encoded_q = urllib.parse.quote(query[:120])
            url = f"https://pixabay.com/api/videos/?key={pixabay_key}&q={encoded_q}&per_page={per_page}&video_type=all&safesearch=true"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            # Thử lại tối đa 3 lần nếu Pixabay trả 429 (rate limit)
            res = None
            for _attempt in range(3):
                res = requests.get(url, headers=headers, timeout=15)
                if res.status_code == 429:
                    wait = 3 + _attempt * 3  # 3s, 6s, 9s
                    logger.info(f"⏳ [PIXABAY] Rate limit 429, chờ {wait}s rồi thử lại (lần {_attempt + 1}/3)...")
                    _time.sleep(wait)
                else:
                    break
            if res is None or res.status_code != 200:
                logger.warning(f"[PIXABAY] Không tìm được video cho '{query}' (HTTP {res.status_code if res else 'N/A'})")
                return None
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
                    best_pool = [item[1] for item in clean_hits[:min(10, len(clean_hits))]]
                else:
                    best_pool = hits[:min(10, len(hits))]

                # 1. Ưu tiên video có thời lượng >= min_duration
                if min_duration > 0:
                    long_enough = [h for h in best_pool if float(h.get("duration", 0)) >= min_duration]
                    if long_enough:
                        best_pool = long_enough
                    else:
                        # Nếu không có video nào đủ dài, ưu tiên video dài nhất
                        best_pool = sorted(best_pool, key=lambda h: float(h.get("duration", 0)), reverse=True)

                # 2. Chống trùng lặp: Ưu tiên chọn video Pixabay chưa dùng gần đây
                fresh_pool = [h for h in best_pool if str(h.get("id")) not in self._used_pixabay_ids]
                choice_pool = fresh_pool if fresh_pool else best_pool
                choice = random.choice(choice_pool)
                if choice.get("id"):
                    self._used_pixabay_ids.append(str(choice.get("id")))
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
        import time as _time
        try:
            encoded_q = urllib.parse.quote(query[:120])
            cat_param = f"&category={category}" if category else ""
            url = f"https://pixabay.com/api/?key={pixabay_key}&q={encoded_q}&image_type=photo&orientation=vertical&safesearch=true{cat_param}&per_page={per_page}"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            # Thử lại tối đa 3 lần nếu Pixabay trả 429 (rate limit)
            res = None
            for _attempt in range(3):
                res = requests.get(url, headers=headers, timeout=15)
                if res.status_code == 429:
                    wait = 3 + _attempt * 3
                    logger.info(f"⏳ [PIXABAY PHOTO] Rate limit 429, chờ {wait}s rồi thử lại (lần {_attempt + 1}/3)...")
                    _time.sleep(wait)
                else:
                    break
            if res is None or res.status_code != 200:
                return None
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
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
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

    def _get_media_duration(self, file_path: str) -> float:
        """Lấy độ dài chính xác của media bằng ffmpeg -i"""
        if not file_path or not os.path.exists(file_path):
            return 0.0
        try:
            cmd = [self.ffmpeg_bin, "-i", file_path]
            flags = 0x08000000 if sys.platform == "win32" else 0
            res = subprocess.run(cmd, capture_output=True, timeout=10, creationflags=flags)
            stderr = res.stderr.decode("utf-8", errors="replace")
            m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", stderr)
            if m:
                h, m_, s = m.groups()
                return round(int(h) * 3600 + int(m_) * 60 + float(s), 2)
        except Exception:
            pass
        return 0.0

    def process_stock_video_clip_with_offset(
        self,
        raw_video_path: str,
        output_clip_path: str,
        start_offset: float,
        duration: float,
        width: int = 1080,
        height: int = 960,
        fps: int = 30
    ) -> bool:
        """Conform video với offset thời gian ngẫu nhiên và kích thước tùy chọn (1080x960 cho Split Screen)"""
        try:
            encoder_flags = get_optimal_video_encoder_flags()
            vf = (
                f"scale={width}:{height}:force_original_aspect_ratio=increase,"
                f"crop={width}:{height},"
                f"fps={fps},setsar=1"
            )
            cmd = [
                self.ffmpeg_bin, "-y",
                "-ss", str(start_offset),
                "-stream_loop", "-1",
                "-i", raw_video_path,
                "-t", str(duration),
                "-vf", vf,
                "-an"
            ]
            cmd.extend(encoder_flags)
            cmd.extend(["-pix_fmt", "yuv420p", output_clip_path])
            res = subprocess.run(
                cmd, capture_output=True, timeout=90,
                creationflags=0x08000000 if sys.platform == "win32" else 0
            )
            return res.returncode == 0 and os.path.exists(output_clip_path) and os.path.getsize(output_clip_path) > 1024
        except Exception as e:
            logger.error(f"Lỗi xử lý clip stock video offset: {e}")
            return False

    def get_split_sub_video(
        self,
        source_type: str = "local",
        folder_path: str = "data/gameplay",
        keywords: str = "minecraft parkour, satisfying asmr, subway surfers",
        provider: str = "all",
        duration: float = 65.0,
        width: int = 1080,
        height: int = 960,
    ) -> Optional[str]:
        """
        Lấy video phụ cho tầng dưới của Split Screen (1080x960):
        - Nếu source_type == 'local': Quét thư mục folder_path (chọn video khác nhau + random start offset chống quét lặp).
        - Nếu folder trống hoặc source_type == 'stock': Tìm video Pexels -> Fallback Pixabay (chọn video khác nhau mỗi lần).
        - Trả về đường dẫn file video phụ đã conform chuẩn 1080x960 @ 30fps sẵn sàng cho vstack.
        """
        target_dur = float(duration) if duration and duration > 5 else 65.0
        out_filename = f"split_sub_{int(random.random() * 1000000)}_{int(target_dur)}s.mp4"
        out_path = str(self.split_dir / out_filename)

        # 1. Thư mục cục bộ (Local Gameplay / ASMR loop)
        if source_type == "local":
            cand_folder = Path(folder_path) if folder_path else (BASE_DIR / "data" / "gameplay")
            if not cand_folder.is_absolute():
                cand_folder = BASE_DIR / cand_folder
            cand_folder.mkdir(parents=True, exist_ok=True)

            video_exts = ("*.mp4", "*.mov", "*.mkv", "*.webm", "*.avi")
            found_files = []
            for ext in video_exts:
                found_files.extend(glob.glob(str(cand_folder / ext)))
                found_files.extend(glob.glob(str(cand_folder / ext.upper())))
            found_files = list(set(found_files))

            if found_files:
                # 1. Đo thời lượng từng video để ưu tiên video >= target_dur (tránh bị lặp lại video)
                file_durations = {f: self._get_media_duration(f) for f in found_files}
                long_enough = [f for f, d in file_durations.items() if d >= target_dur]
                eligible = long_enough if long_enough else sorted(found_files, key=lambda f: file_durations.get(f, 0.0), reverse=True)

                # 2. Anti-duplication: Ưu tiên file chưa dùng gần đây trong nhóm eligible
                fresh_files = [f for f in eligible if f not in self._used_local_videos]
                pool = fresh_files if fresh_files else eligible
                chosen_file = random.choice(pool[:min(5, len(pool))])
                self._used_local_videos.append(chosen_file)

                # Random start offset nếu video dài hơn target_dur để không bao giờ bị trùng đoạn cắt
                file_dur = file_durations.get(chosen_file, self._get_media_duration(chosen_file))
                start_offset = 0.0
                if file_dur > (target_dur + 2.0):
                    start_offset = round(random.uniform(0.0, file_dur - target_dur - 1.0), 1)

                log_event("INFO", f"🎬 [SPLIT SCREEN] Đã chọn video phụ local: {Path(chosen_file).name} (Độ dài: {file_dur:.1f}s >= {target_dur:.1f}s, Offset: {start_offset:.1f}s)")
                ok = self.process_stock_video_clip_with_offset(
                    raw_video_path=chosen_file,
                    output_clip_path=out_path,
                    start_offset=start_offset,
                    duration=target_dur,
                    width=width,
                    height=height
                )
                if ok:
                    return out_path
            else:
                log_event("WARNING", f"⚠️ Thư mục video phụ [{folder_path}] chưa có video nào! Tự động fallback sang tải Stock Video (Pexels / Pixabay)...")

        # 2. Tải tự động từ Stock (Pexels -> Pixabay Fallback, ưu tiên video >= target_dur)
        raw_keywords = [k.strip() for k in (keywords or "").split(",") if k.strip()]
        if not raw_keywords:
            raw_keywords = ["minecraft parkour", "satisfying asmr", "subway surfers gameplay", "relaxing footage"]
        chosen_kw = random.choice(raw_keywords)

        pexels_key, pixabay_key = self.get_api_keys()
        providers_to_try = []
        if provider == "pexels":
            providers_to_try = ["pexels"]
        elif provider == "pixabay":
            providers_to_try = ["pixabay"]
        else:
            # "all": Pexels trước, Pixabay sau
            if pexels_key:
                providers_to_try.append("pexels")
            if pixabay_key:
                providers_to_try.append("pixabay")

        video_url = None
        source_used = ""
        for p in providers_to_try:
            if p == "pexels" and pexels_key:
                video_url = self.search_pexels_video(chosen_kw, pexels_key, min_duration=target_dur)
                if video_url:
                    source_used = "Pexels"
                    break
            elif p == "pixabay" and pixabay_key:
                video_url = self.search_pixabay_video(chosen_kw, pixabay_key, min_duration=target_dur)
                if video_url:
                    source_used = "Pixabay"
                    break

        if video_url:
            raw_stock = str(self.split_dir / f"raw_stock_{int(random.random() * 10000)}.mp4")
            if self.download_file(video_url, raw_stock):
                ok = self.process_stock_video_clip(
                    raw_video_path=raw_stock,
                    output_clip_path=out_path,
                    duration=target_dur,
                    width=width,
                    height=height
                )
                try:
                    if os.path.exists(raw_stock):
                        os.remove(raw_stock)
                except Exception:
                    pass
                if ok:
                    log_event("INFO", f"🎬 [SPLIT SCREEN] Đã tải video phụ từ {source_used} ({chosen_kw}) -> {target_dur:.1f}s")
                    return out_path

        log_event("WARNING", "Không thể lấy video phụ cho Split Screen (local trống và stock không khả dụng).")
        return None


stock_footage_manager = StockFootageManager()

