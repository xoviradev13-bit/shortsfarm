import os
import re
import json
import requests
from pathlib import Path
from typing import Dict, Any, Optional
from backend.config import DOWNLOADS_DIR
from backend.database import log_event
from backend.logger import get_logger

logger = get_logger("multi_downloader")

DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

class MultiPlatformDownloader:
    """
    Trình tải video đa nền tảng không watermark:
    - YouTube, Facebook, Instagram, Bilibili, Weibo (qua yt-dlp)
    - Douyin (TikTok TQ - bóc tách clean CDN không logo)
    - Xiaohongshu (Tiểu Hồng Thư - RED)
    """

    @staticmethod
    def detect_platform(url: str) -> str:
        u = url.lower()
        if "douyin.com" in u or "iesdouyin.com" in u:
            return "douyin"
        elif "xiaohongshu.com" in u or "xhslink.com" in u:
            return "xiaohongshu"
        elif "youtube.com" in u or "youtu.be" in u:
            return "youtube"
        elif "facebook.com" in u or "fb.watch" in u or "fb.com" in u:
            return "facebook"
        elif "instagram.com" in u:
            return "instagram"
        elif "weibo.com" in u or "weibo.cn" in u:
            return "weibo"
        elif "bilibili.com" in u or "b23.tv" in u:
            return "bilibili"
        elif "tiktok.com" in u:
            return "tiktok"
        return "generic"

    def download(self, url: str, output_dir: Optional[Path] = None) -> Dict[str, Any]:
        target_dir = Path(output_dir) if output_dir else DOWNLOADS_DIR
        target_dir.mkdir(parents=True, exist_ok=True)

        platform = self.detect_platform(url)
        log_event("INFO", f"Nhận diện nền tảng [{platform.upper()}] cho liên kết: {url}")

        if platform == "douyin":
            res = self._download_douyin(url, target_dir)
            if res.get("success"):
                return res
            # Fallback sang yt-dlp nếu scraper riêng gặp thay đổi API
            log_event("WARNING", "Douyin parser fallback sang yt-dlp...")

        elif platform == "xiaohongshu":
            res = self._download_xiaohongshu(url, target_dir)
            if res.get("success"):
                return res
            log_event("WARNING", "Xiaohongshu parser fallback sang yt-dlp...")

        # Mặc định dùng yt-dlp cho YouTube, Facebook, Instagram, Weibo, Bilibili
        return self._download_ytdlp(url, target_dir, platform)

    def _download_douyin(self, share_url: str, target_dir: Path) -> Dict[str, Any]:
        """Tải video Douyin gốc không logo/watermark"""
        headers = {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
            "Referer": "https://www.douyin.com/",
        }

        try:
            # 1. Trích xuất URL từ văn bản share (nếu người dùng copy cả text)
            url_match = re.search(r"https?://(?:[a-zA-Z0-9_-]+\.)?douyin\.com/[a-zA-Z0-9_/-]+", share_url)
            clean_url = url_match.group(0) if url_match else share_url

            # 2. Theo dõi redirect để lấy item_id / video_id
            session = requests.Session()
            r = session.get(clean_url, headers=headers, allow_redirects=True, timeout=12)
            final_url = r.url

            video_id_match = re.search(r"(?:video|note|share/video)/(\d+)", final_url)
            if not video_id_match:
                # Thử tìm tham số modal_id
                video_id_match = re.search(r"modal_id=(\d+)", final_url)

            if not video_id_match:
                return {"success": False, "message": "Không tìm thấy ID video Douyin"}

            video_id = video_id_match.group(1)

            # 3. Gọi API chi tiết của Douyin để lấy direct CDN URL không watermark
            api_url = f"https://www.iesdouyin.com/aweme/v1/web/aweme/detail/?aweme_id={video_id}"
            api_res = session.get(api_url, headers=headers, timeout=12).json()

            aweme_detail = api_res.get("aweme_detail", {})
            title = aweme_detail.get("desc", f"douyin_{video_id}")
            # Làm sạch tên file
            safe_title = re.sub(r'[\\/*?:"<>|]', "", title)[:60].strip() or f"douyin_{video_id}"

            video_obj = aweme_detail.get("video", {})
            play_addr = video_obj.get("play_addr", {})
            url_list = play_addr.get("url_list", [])

            if not url_list:
                return {"success": False, "message": "Không trích xuất được link tải CDN Douyin"}

            # Thay thế playwm (play with watermark) thành play (không watermark)
            cdn_url = url_list[0].replace("playwm", "play")

            output_file = target_dir / f"{safe_title}_{video_id}.mp4"

            # Tải file binary
            with session.get(cdn_url, headers=headers, stream=True, timeout=30) as stream:
                stream.raise_for_status()
                with open(output_file, "wb") as f:
                    for chunk in stream.iter_content(chunk_size=65536):
                        f.write(chunk)

            log_event("SUCCESS", f"Tải Douyin thành công không watermark: {output_file.name}")
            return {
                "success": True,
                "file_path": str(output_file),
                "title": title,
                "platform": "douyin",
                "video_id": video_id,
            }
        except Exception as e:
            logger.error(f"Lỗi tải Douyin: {e}")
            return {"success": False, "message": f"Douyin Error: {str(e)}"}

    def _download_xiaohongshu(self, share_url: str, target_dir: Path) -> Dict[str, Any]:
        """Tải video Xiaohongshu (RED) gốc không watermark"""
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.xiaohongshu.com/",
        }

        try:
            url_match = re.search(r"https?://(?:[a-zA-Z0-9.-]+\.)?xiaohongshu\.com/[a-zA-Z0-9_/-]+|https?://xhslink\.com/[a-zA-Z0-9_/-]+", share_url)
            clean_url = url_match.group(0) if url_match else share_url

            session = requests.Session()
            r = session.get(clean_url, headers=headers, allow_redirects=True, timeout=12)
            html = r.text

            # Trích xuất video URL từ initialState JSON trong thẻ script
            match = re.search(r"window\.__INITIAL_STATE__\s*=\s*(\{.*?\});</script>", html)
            video_url = None
            title = "xiaohongshu_video"

            if match:
                data = json.loads(match.group(1))
                note_data = data.get("note", {}).get("noteDetailMap", {})
                for k, v in note_data.items():
                    note = v.get("note", {})
                    title = note.get("title") or note.get("desc") or title
                    video = note.get("video", {})
                    media = video.get("media", {})
                    stream_types = media.get("stream", {})
                    # Tìm stream h264 / h265 có bitrate cao nhất
                    for st in ["h264", "h265"]:
                        streams = stream_types.get(st, [])
                        if streams and isinstance(streams, list):
                            video_url = streams[0].get("masterUrl")
                            if video_url:
                                break

            # Regex tìm trực tiếp link CDN nếu không parse được JSON
            if not video_url:
                regex_cdn = re.search(r'(https://[a-zA-Z0-9.-]+\.xhscdn\.com/[a-zA-Z0-9_/-]+\.mp4)', html)
                if regex_cdn:
                    video_url = regex_cdn.group(1)

            if not video_url:
                return {"success": False, "message": "Không tìm thấy link video Xiaohongshu"}

            safe_title = re.sub(r'[\\/*?:"<>|]', "", title)[:60].strip() or "xhs_video"
            output_file = target_dir / f"{safe_title}.mp4"

            with session.get(video_url, headers=headers, stream=True, timeout=30) as stream:
                stream.raise_for_status()
                with open(output_file, "wb") as f:
                    for chunk in stream.iter_content(chunk_size=65536):
                        f.write(chunk)

            log_event("SUCCESS", f"Tải Xiaohongshu thành công: {output_file.name}")
            return {
                "success": True,
                "file_path": str(output_file),
                "title": title,
                "platform": "xiaohongshu"
            }
        except Exception as e:
            logger.error(f"Lỗi tải Xiaohongshu: {e}")
            return {"success": False, "message": f"Xiaohongshu Error: {str(e)}"}

    def _download_ytdlp(self, url: str, target_dir: Path, platform: str) -> Dict[str, Any]:
        """Tải bằng yt-dlp cho YouTube, Facebook, Instagram, Bilibili, Weibo, TikTok"""
        try:
            import yt_dlp
        except ImportError:
            return {"success": False, "message": "Chưa cài yt-dlp. Chạy lệnh: pip install yt-dlp"}

        out_template = str(target_dir / "%(title).60s_%(id)s.%(ext)s")

        # Tự động phát hiện FFmpeg binary trong hệ thống hoặc qua get_ffmpeg_binary
        ffmpeg_bin = None
        try:
            from backend.modules.video_core.hardware_accel import get_ffmpeg_binary
            ffmpeg_bin = get_ffmpeg_binary()
        except Exception:
            pass

        ydl_opts = {
            "outtmpl": out_template,
            "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best",
            "merge_output_format": "mp4",
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "socket_timeout": 30,
            "retries": 3,
            "fragment_retries": 3,
            "http_headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            }
        }

        if ffmpeg_bin and os.path.exists(str(ffmpeg_bin)):
            ydl_opts["ffmpeg_location"] = str(ffmpeg_bin)

        cookies_file = Path("cookies.txt")
        if cookies_file.exists():
            ydl_opts["cookiefile"] = str(cookies_file.absolute())

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                # Nếu file sau merge là mp4
                base, _ = os.path.splitext(filename)
                final_mp4 = f"{base}.mp4" if os.path.exists(f"{base}.mp4") else filename

                log_event("SUCCESS", f"Tải {platform.upper()} thành công: {os.path.basename(final_mp4)}")
                return {
                    "success": True,
                    "file_path": str(final_mp4),
                    "title": info.get("title", ""),
                    "platform": platform,
                    "duration": info.get("duration", 0),
                    "video_id": info.get("id"),
                }
        except Exception as e:
            logger.error(f"Lỗi yt-dlp: {e}")
            return {"success": False, "message": f"yt-dlp Error: {str(e)}"}

# Singleton toàn cục
multi_downloader = MultiPlatformDownloader()

