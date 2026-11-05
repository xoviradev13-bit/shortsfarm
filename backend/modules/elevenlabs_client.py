import os
import json
import time
import requests
from pathlib import Path
from typing import Dict, Any, List, Optional
from backend.database import get_connection, log_event
from backend.logger import get_logger

logger = get_logger("elevenlabs_client")

# Danh sách giọng mặc định thông dụng của ElevenLabs
PRESET_VOICES = [
    {
        "voice_id": "pNInz6obpgDQGcFmaJgB",
        "name": "Adam",
        "category": "premade",
        "labels": {"accent": "american", "gender": "male", "age": "middle aged", "use_case": "narration"},
        "description": "Giọng nam trầm ấm, phong cách điện ảnh, kể chuyện viral TikTok/Shorts",
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/audio.mp3"
    },
    {
        "voice_id": "21m00Tcm4TlvDq8ikWAM",
        "name": "Rachel",
        "category": "premade",
        "labels": {"accent": "american", "gender": "female", "age": "young", "use_case": "calm narration"},
        "description": "Giọng nữ truyền cảm, dịu dàng, tâm sự, phong cách sống",
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/audio.mp3"
    },
    {
        "voice_id": "ErXwobaYiN019PkySvjV",
        "name": "Antoni",
        "category": "premade",
        "labels": {"accent": "american", "gender": "male", "age": "young", "use_case": "storytelling"},
        "description": "Giọng nam năng động, tự nhiên, review phim, vlog đời thường",
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/ErXwobaYiN019PkySvjV/audio.mp3"
    },
    {
        "voice_id": "EXAVITQu4vr4xnSDxMaL",
        "name": "Bella",
        "category": "premade",
        "labels": {"accent": "american", "gender": "female", "age": "young", "use_case": "tiktok trendy"},
        "description": "Giọng nữ trẻ trung, lôi cuốn, trendy TikTok",
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/audio.mp3"
    },
    {
        "voice_id": "TxGEqnHWrfWFTfGW9XjX",
        "name": "Josh",
        "category": "premade",
        "labels": {"accent": "american", "gender": "male", "age": "young", "use_case": "news/tech"},
        "description": "Giọng nam trẻ, hào hứng, tin tức công nghệ và giải trí",
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/TxGEqnHWrfWFTfGW9XjX/audio.mp3"
    },
    {
        "voice_id": "VR6AewLTigWG4xSOukaG",
        "name": "Arnold",
        "category": "premade",
        "labels": {"accent": "american", "gender": "male", "age": "middle aged", "use_case": "documentary"},
        "description": "Giọng nam đĩnh đạc, trầm hùng, phóng sự gián điệp, đại án",
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/VR6AewLTigWG4xSOukaG/audio.mp3"
    }
]

class ElevenLabsClient:
    def __init__(self):
        self.base_url = "https://api.elevenlabs.io/v1"

    def get_api_key(self) -> str:
        """Lấy ElevenLabs API Key từ Database hoặc biến môi trường"""
        key = os.environ.get("ELEVENLABS_API_KEY", "")
        if not key:
            try:
                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute("CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)")
                cursor.execute("SELECT value FROM system_settings WHERE key = 'elevenlabs_api_key'")
                row = cursor.fetchone()
                conn.close()
                if row and row["value"]:
                    key = row["value"]
            except Exception:
                pass
        return key.strip()

    def set_api_key(self, api_key: str) -> bool:
        """Lưu ElevenLabs API Key vào cơ sở dữ liệu"""
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)")
            cursor.execute(
                "INSERT INTO system_settings (key, value) VALUES ('elevenlabs_api_key', ?) ON CONFLICT(key) DO UPDATE SET value = ?",
                (api_key.strip(), api_key.strip())
            )
            conn.commit()
            conn.close()
            os.environ["ELEVENLABS_API_KEY"] = api_key.strip()
            log_event("SUCCESS", "Đã cập nhật ElevenLabs API Key thành công!")
            return True
        except Exception as e:
            logger.error(f"Lỗi lưu ElevenLabs key: {e}")
            return False

    def get_subscription_info(self) -> Dict[str, Any]:
        """Lấy thông tin gói cước và hạn mức ký tự còn lại từ ElevenLabs"""
        api_key = self.get_api_key()
        if not api_key:
            return {"configured": False, "message": "Chưa nhập API Key"}

        try:
            url = f"{self.base_url}/user/subscription"
            headers = {"xi-api-key": api_key}
            res = requests.get(url, headers=headers, timeout=8)
            if res.status_code == 200:
                data = res.json()
                char_count = data.get("character_count", 0)
                char_limit = data.get("character_limit", 10000)
                remaining = max(0, char_limit - char_count)
                tier = data.get("tier", "free")
                status = data.get("status", "active")
                return {
                    "configured": True,
                    "tier": tier.title(),
                    "status": status,
                    "character_count": char_count,
                    "character_limit": char_limit,
                    "characters_remaining": remaining,
                    "percent_used": round((char_count / max(1, char_limit)) * 100, 1)
                }
        except Exception as e:
            logger.warning(f"Lỗi lấy thông tin subscription ElevenLabs: {e}")

        return {"configured": True, "tier": "Active Key", "characters_remaining": "N/A"}

    def list_voices(self) -> List[Dict[str, Any]]:
        """Lấy danh sách tất cả các giọng đọc (kèm các giọng cloned riêng của tài khoản)"""
        api_key = self.get_api_key()
        if not api_key:
            return PRESET_VOICES

        try:
            url = f"{self.base_url}/voices"
            headers = {"xi-api-key": api_key}
            res = requests.get(url, headers=headers, timeout=8)
            if res.status_code == 200:
                data = res.json()
                voices_raw = data.get("voices", [])
                results = []
                for v in voices_raw:
                    results.append({
                        "voice_id": v.get("voice_id"),
                        "name": v.get("name"),
                        "category": v.get("category", "custom"),
                        "labels": v.get("labels", {}),
                        "description": v.get("description") or f"Giọng đọc ElevenLabs {v.get('name')}",
                        "preview_url": v.get("preview_url")
                    })
                return results if results else PRESET_VOICES
        except Exception as e:
            logger.warning(f"Lỗi gọi ElevenLabs API: {e}. Dùng danh mục mặc định.")

        return PRESET_VOICES

    def synthesize(
        self,
        text: str,
        voice_id: str = "pNInz6obpgDQGcFmaJgB",
        output_path: Optional[str] = None,
        model_id: str = "eleven_multilingual_v2",
        **kwargs
    ) -> Dict[str, Any]:
        """Chuyển văn bản thành giọng đọc truyền cảm bằng ElevenLabs"""
        api_key = self.get_api_key()
        if not api_key:
            return {"success": False, "message": "Chưa nhập ElevenLabs API Key! Vui lòng cấu hình key trong phần Cài Đặt hoặc tab Quản Lý Video."}

        if not text.strip():
            return {"success": False, "message": "Văn bản đọc trống"}

        if not output_path:
            from backend.config import DATA_DIR
            out_dir = DATA_DIR / "voiceovers"
            out_dir.mkdir(parents=True, exist_ok=True)
            output_path = str(out_dir / f"eleven_{voice_id}_{int(time.time())}.mp3")

        url = f"{self.base_url}/text-to-speech/{voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": api_key
        }
        data = {
            "text": text,
            "model_id": model_id or "eleven_multilingual_v2",
            "voice_settings": {
                "stability": kwargs.get("stability", 0.5),
                "similarity_boost": kwargs.get("similarity_boost", 0.75),
                "style": kwargs.get("style", 0.0),
                "use_speaker_boost": kwargs.get("use_speaker_boost", True)
            }
        }

        try:
            log_event("INFO", f"Đang gửi request chuyển giọng đọc ElevenLabs (Model: {model_id}, Voice ID: {voice_id})...")
            res = requests.post(url, json=data, headers=headers, timeout=60)
            if res.status_code == 200:
                with open(output_path, "wb") as f:
                    f.write(res.content)
                log_event("SUCCESS", f"Sinh giọng đọc ElevenLabs thành công: {os.path.basename(output_path)}")
                return {
                    "success": True,
                    "file_path": output_path,
                    "voice_id": voice_id,
                    "message": "Sinh giọng đọc thành công!"
                }
            else:
                err_text = res.text
                logger.error(f"ElevenLabs HTTP {res.status_code}: {err_text}")
                return {"success": False, "message": f"ElevenLabs API Error: {err_text}"}
        except Exception as e:
            logger.error(f"Lỗi ElevenLabs: {e}")
            return {"success": False, "message": f"Lỗi kết nối ElevenLabs: {str(e)}"}

elevenlabs_client = ElevenLabsClient()

