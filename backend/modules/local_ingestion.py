import os
import glob
import time
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional
from backend.database import get_connection, log_event
from backend.logger import get_logger

logger = get_logger("local_ingestion")

# Cấu hình lưu trữ trạng thái chế độ Pipeline
CONFIG_FILE = Path(__file__).resolve().parent.parent / "pipeline_settings.json"

SUPPORTED_VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".avi", ".webm", ".flv"}

def is_rss_scan_enabled() -> bool:
    """Kiểm tra xem chế độ tự động quét RSS YouTube có đang bật không"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)")
        cursor.execute("SELECT value FROM system_settings WHERE key = 'rss_scan_enabled'")
        row = cursor.fetchone()
        conn.close()
        if row:
            return row["value"] == "1"
    except Exception:
        pass
    return True # Mặc định bật nếu chưa cấu hình

def set_rss_scan_enabled(enabled: bool) -> bool:
    """Bật / Tắt chế độ tự động quét RSS YouTube"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)")
        cursor.execute(
            "INSERT INTO system_settings (key, value) VALUES ('rss_scan_enabled', ?) ON CONFLICT(key) DO UPDATE SET value = ?",
            ("1" if enabled else "0", "1" if enabled else "0")
        )
        conn.commit()
        conn.close()
        log_event("INFO", f"Chế độ quét RSS tự động đã được: {'BẬT' if enabled else 'TẮT'}")
        return True
    except Exception as e:
        logger.error(f"Lỗi lưu cấu hình RSS scan: {e}")
        return False

class LocalVideoIngestor:
    """
    Module hỗ trợ người dùng nạp kho video có sẵn từ ổ cứng:
    - Quét thư mục người dùng chọn
    - Bỏ qua bước tải RSS / YouTube
    - Nạp trực tiếp vào hàng đợi Render AI (ai_video_engine) và Đăng (upload_queue)
    """

    def scan_folder(self, folder_path: str) -> List[Dict[str, Any]]:
        """Quét toàn bộ video có trong thư mục"""
        p = Path(folder_path)
        if not p.exists() or not p.is_dir():
            return []

        videos = []
        for file in p.rglob("*"):
            if file.is_file() and file.suffix.lower() in SUPPORTED_VIDEO_EXTS:
                size_mb = round(file.stat().st_size / (1024 * 1024), 2)
                videos.append({
                    "file_path": str(file.resolve()),
                    "file_name": file.name,
                    "size_mb": size_mb,
                    "extension": file.suffix.lower(),
                    "modified_time": file.stat().st_mtime
                })
        return videos

    def ingest_local_videos(
        self,
        file_paths: List[str],
        channel_id: str = "LOCAL_IMPORT",
        auto_render: bool = True
    ) -> Dict[str, Any]:
        """
        Nạp danh sách video từ ổ cứng vào cơ sở dữ liệu
        Thiết lập status = 'downloaded' để chuyển thẳng sang bước Render AI
        """
        conn = get_connection()
        cursor = conn.cursor()
        added_count = 0
        skipped_count = 0

        for path_str in file_paths:
            path = Path(path_str)
            if not path.exists():
                skipped_count += 1
                continue

            # Tạo mã giả lập video_id duy nhất dựa trên tên file + dung lượng
            hash_input = f"{path.name}_{path.stat().st_size}"
            pseudo_id = "loc_" + hashlib.md5(hash_input.encode("utf-8")).hexdigest()[:12]
            title = path.stem.replace("_", " ").replace("-", " ")

            try:
                cursor.execute(
                    """
                    INSERT INTO videos (channel_id, yt_video_id, title, original_url, download_path, status)
                    VALUES (?, ?, ?, ?, ?, 'downloaded')
                    ON CONFLICT(yt_video_id) DO UPDATE SET 
                        download_path = excluded.download_path,
                        status = 'downloaded'
                    """,
                    (channel_id, pseudo_id, title, f"file://{path}", str(path.resolve()))
                )
                added_count += 1
            except Exception as e:
                logger.error(f"Lỗi nạp video {path.name}: {e}")
                skipped_count += 1

        conn.commit()
        conn.close()

        log_event("SUCCESS", f"Đã nạp thành công {added_count} video cục bộ vào hệ thống (Bỏ qua: {skipped_count})")
        return {
            "success": True,
            "added_count": added_count,
            "skipped_count": skipped_count,
            "message": f"Đã nạp {added_count} video vào hàng đợi xử lý AI!"
        }

local_ingestor = LocalVideoIngestor()

