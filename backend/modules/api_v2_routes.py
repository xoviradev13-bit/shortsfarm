import os
import socket
import platform
from pathlib import Path
from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from backend.modules.browser_adapters import browser_manager
from backend.modules.multi_downloader import multi_downloader
from backend.modules.multi_uploader import multi_uploader
from backend.modules.local_ingestion import local_ingestor, is_rss_scan_enabled, set_rss_scan_enabled
from backend.modules.license_client import LicenseClient, get_machine_hwid

router = APIRouter(prefix="/api/v2", tags=["v2_features"])

# --- 1. Đa Trình Duyệt Antidetect ---
class SelectBrowserRequest(BaseModel):
    browser: str # 'auto', 'gpm', 'adspower', 'dolphin', 'genlogin'

@router.get("/browsers/active")
def get_active_browser():
    """Lấy trình duyệt đang được người dùng lựa chọn"""
    active = browser_manager.get_active_browser()
    options = [
        {"id": "auto", "name": "Tự động phát hiện (Auto-detect)", "desc": "Tự kết nối trình duyệt nào đang mở"},
        {"id": "gpm", "name": "GPMLogin", "desc": "Port 9495 / 19995"},
        {"id": "adspower", "name": "AdsPower Browser", "desc": "Port 50325 (SunBrowser)"},
        {"id": "dolphin", "name": "Dolphin Anty", "desc": "Port 3001 (Automation Mode)"},
        {"id": "genlogin", "name": "GenLogin", "desc": "Port 55550"},
    ]
    return {
        "active_browser": active,
        "options": options,
        "browsers_status": browser_manager.scan_all_browsers()
    }

@router.post("/browsers/select")
def set_active_browser(req: SelectBrowserRequest):
    """Người dùng chủ động chọn trình duyệt Antidetect để sử dụng"""
    success = browser_manager.set_active_browser(req.browser)
    if not success:
        raise HTTPException(status_code=400, detail=f"Trình duyệt không hợp lệ: {req.browser}")
    return {
        "success": True,
        "active_browser": req.browser.lower(),
        "message": f"Đã chuyển sang sử dụng {req.browser.upper()}!"
    }

@router.get("/browsers/status")
def get_browsers_status():
    """Kiểm tra trạng thái của GPM, AdsPower, Dolphin Anty, GenLogin"""
    return {
        "active_browser": browser_manager.get_active_browser(),
        "browsers": browser_manager.scan_all_browsers()
    }

@router.get("/browsers/profiles")
def get_all_profiles(browser: Optional[str] = None):
    """
    Lấy danh sách profile theo trình duyệt được chọn:
    Nếu không truyền param 'browser', sẽ lấy theo lựa chọn đã lưu của người dùng.
    """
    if browser:
        adapter = browser_manager.get_adapter(browser)
        profiles = adapter.list_profiles() if adapter else []
        for p in profiles:
            p["browser_type"] = browser
        return {"profiles": profiles, "selected_browser": browser}

    return {
        "profiles": browser_manager.get_selected_profiles(),
        "selected_browser": browser_manager.get_active_browser()
    }

# --- 2. Quản Lý Nạp Thư Mục Cục Bộ & Tắt Quét RSS ---
@router.get("/pipeline/rss_status")
def get_rss_status():
    """Kiểm tra quét RSS tự động đang bật hay tắt"""
    return {
        "rss_scan_enabled": is_rss_scan_enabled()
    }

class ToggleRSSRequest(BaseModel):
    enabled: bool

@router.post("/pipeline/toggle_rss")
def toggle_rss_mode(req: ToggleRSSRequest):
    """Bật / Tắt chế độ quét RSS YouTube tự động"""
    success = set_rss_scan_enabled(req.enabled)
    return {
        "success": success,
        "rss_scan_enabled": req.enabled,
        "message": f"Chế độ quét RSS đã {'bật' if req.enabled else 'tắt'}"
    }

class ScanFolderRequest(BaseModel):
    folder_path: str

@router.post("/pipeline/scan_folder")
def scan_local_folder(req: ScanFolderRequest):
    """Quét thư mục máy tính để tìm các file video có sẵn"""
    files = local_ingestor.scan_folder(req.folder_path)
    return {
        "count": len(files),
        "files": files
    }

class IngestVideosRequest(BaseModel):
    file_paths: List[str]
    channel_id: Optional[str] = "LOCAL_IMPORT"
    auto_render: Optional[bool] = True

@router.post("/pipeline/ingest_videos")
def ingest_videos(req: IngestVideosRequest):
    """Nạp danh sách video vào hệ thống để render AI và xếp hàng đăng"""
    result = local_ingestor.ingest_local_videos(
        file_paths=req.file_paths,
        channel_id=req.channel_id,
        auto_render=req.auto_render
    )
    return result

# --- 3. Tải Video Đa Nền Tảng ---
class DownloadRequest(BaseModel):
    url: str

@router.post("/downloader/download")
def download_multi_platform(req: DownloadRequest):
    """
    Tải video sạch không watermark từ:
    Douyin, Xiaohongshu, YouTube, Facebook, Instagram, Weibo, Bilibili
    Lưu tự động vào thư mục con Direct Links và đồng bộ thư viện
    """
    from backend.config import DOWNLOADS_DIR
    direct_dir = DOWNLOADS_DIR / "Direct Links"
    direct_dir.mkdir(parents=True, exist_ok=True)
    result = multi_downloader.download(req.url, output_dir=direct_dir)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Lỗi tải video"))
    try:
        from backend.app import sync_local_videos_with_db
        sync_local_videos_with_db()
    except Exception:
        pass
    return result

# --- 4. Đăng Video Đa Nền Tảng ---
class PublishRequest(BaseModel):
    platform: str # 'tiktok' | 'youtube' | 'facebook'
    profile_id: str
    video_path: str
    title: str
    tags: Optional[str] = "#viral #fyp"
    browser_type: Optional[str] = "auto"
    auto_post: Optional[bool] = True

@router.post("/uploader/publish")
def publish_video(req: PublishRequest):
    """Đăng video lên TikTok, YouTube Shorts, hoặc Facebook Reels"""
    result = multi_uploader.upload(
        platform=req.platform,
        profile_id=req.profile_id,
        video_path=req.video_path,
        title=req.title,
        tags=req.tags,
        browser_type=req.browser_type,
        auto_post=req.auto_post
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Lỗi đăng video"))
    return result

# --- 5. Bản Quyền & HWID ---
@router.get("/license/info")
def get_license_info():
    """Lấy thông tin HWID và trạng thái bản quyền hiện tại"""
    client = LicenseClient()
    local = client.load_local_license()
    hwid = get_machine_hwid()
    return {
        "hwid": hwid,
        "is_activated": bool(local and local.get("license_key")),
        "license_data": local
    }

class ActivateLicenseRequest(BaseModel):
    license_key: str

@router.post("/license/activate")
def activate_license(req: ActivateLicenseRequest):
    """Kích hoạt bản quyền trực tiếp từ giao diện Desktop"""
    client = LicenseClient()
    res = client.activate(req.license_key)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("message", "Kích hoạt thất bại"))
    return res



# --- 6. Quản Lý Giọng Đọc ElevenLabs AI & Chiến Dịch ---
from backend.modules.elevenlabs_client import elevenlabs_client
from backend.database import get_connection

@router.get("/voice/elevenlabs/voices")
def get_elevenlabs_voices():
    """Lấy danh sách tất cả các giọng đọc ElevenLabs (mặc định + cloned)"""
    return {
        "voices": elevenlabs_client.list_voices(),
        "has_api_key": bool(elevenlabs_client.get_api_key())
    }

@router.get("/voice/elevenlabs/subscription")
def get_elevenlabs_subscription():
    """Lấy thông tin hạn mức ký tự và gói cước ElevenLabs"""
    return elevenlabs_client.get_subscription_info()

@router.get("/voice/elevenlabs/key")
def get_elevenlabs_key_status():
    """Kiểm tra trạng thái cấu hình ElevenLabs API Key"""
    key = elevenlabs_client.get_api_key()
    masked = f"{key[:6]}...{key[-4:]}" if len(key) > 10 else ("Đã cấu hình" if key else "")
    return {
        "configured": bool(key),
        "masked_key": masked
    }

class SaveElevenKeyRequest(BaseModel):
    api_key: str

@router.post("/voice/elevenlabs/key")
def save_elevenlabs_key(req: SaveElevenKeyRequest):
    """Lưu ElevenLabs API Key vào hệ thống"""
    success = elevenlabs_client.set_api_key(req.api_key)
    if not success:
        raise HTTPException(status_code=400, detail="Không thể lưu API key")
    return {"success": True, "message": "Đã lưu ElevenLabs API Key thành công!"}

class SynthesizePreviewRequest(BaseModel):
    text: str
    voice_id: str = "pNInz6obpgDQGcFmaJgB"
    model_id: Optional[str] = "eleven_multilingual_v2"
    stability: Optional[float] = 0.5
    similarity_boost: Optional[float] = 0.75
    style: Optional[float] = 0.0

@router.post("/voice/elevenlabs/synthesize")
def synthesize_elevenlabs_preview(req: SynthesizePreviewRequest):
    """Tạo mẫu giọng đọc ElevenLabs thử nghiệm"""
    res = elevenlabs_client.synthesize(
        text=req.text,
        voice_id=req.voice_id,
        model_id=req.model_id,
        stability=req.stability,
        similarity_boost=req.similarity_boost,
        style=req.style
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res

class ChannelVoiceSettingsRequest(BaseModel):
    channel_id: str
    tts_engine: str = "elevenlabs" # 'edge-tts' | 'elevenlabs'
    elevenlabs_voice_id: Optional[str] = "pNInz6obpgDQGcFmaJgB"
    elevenlabs_model: Optional[str] = "eleven_multilingual_v2"

@router.post("/channels/voice_settings")
def update_channel_voice_settings(req: ChannelVoiceSettingsRequest):
    """Gán cấu hình giọng đọc ElevenLabs cho một Kênh / Chiến Dịch cụ thể"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE channels 
            SET tts_engine = ?, elevenlabs_voice_id = ?, elevenlabs_model = ?
            WHERE channel_id = ?
        """, (req.tts_engine, req.elevenlabs_voice_id, req.elevenlabs_model, req.channel_id))
        conn.commit()
        conn.close()
        return {"success": True, "message": f"Đã cập nhật giọng đọc {req.tts_engine.upper()} cho kênh {req.channel_id}!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi cập nhật cài đặt kênh: {str(e)}")

# --- 7. Quản Lý Thư Viện Video (Video Management) ---
@router.get("/videos/library")
def get_videos_library(limit: int = 150):
    """Lấy danh sách tất cả các video đã tải hoặc nạp từ ổ cứng (Bao gồm RSS YouTube & Direct Links)"""
    try:
        # Tự động đồng bộ hóa các video trên đĩa (RSS, Direct Links, Local) trước khi trả về
        try:
            from backend.app import sync_local_videos_with_db
            sync_local_videos_with_db()
        except Exception:
            pass

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT v.id, v.channel_id, v.yt_video_id, v.title, v.original_url, v.duration, 
                   v.download_path, v.rendered_path, v.status, v.created_at,
                   c.title AS channel_title, c.display_name AS channel_display_name
            FROM videos v
            LEFT JOIN channels c ON v.channel_id = c.channel_id
            ORDER BY v.id DESC LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        conn.close()

        videos = []
        for r in rows:
            v_dict = dict(r)
            p = v_dict.get("download_path")
            v_dict["file_exists"] = bool(p and os.path.exists(p))
            if v_dict["file_exists"]:
                try:
                    v_dict["size_mb"] = round(os.path.getsize(p) / (1024 * 1024), 2)
                except Exception:
                    v_dict["size_mb"] = 0
            else:
                v_dict["size_mb"] = 0

            # Xác định tên nguồn / kênh (RSS YouTube, Direct Links hoặc Cục bộ)
            ch_title = v_dict.get("channel_display_name") or v_dict.get("channel_title")
            raw_ch = v_dict.get("channel_id")
            if ch_title:
                source_name = ch_title
                source_type = "youtube"
            elif raw_ch and raw_ch not in ("LOCAL", "None", ""):
                source_name = raw_ch
                source_type = "direct" if "direct" in raw_ch.lower() else "channel"
            elif p and "Direct Links" in p:
                source_name = "Direct Links"
                source_type = "direct"
            elif p:
                parent_dir = Path(p).parent.name
                source_name = parent_dir if parent_dir else "Direct Links"
                source_type = "direct" if "direct" in source_name.lower() else "local"
            else:
                source_name = "Direct Links"
                source_type = "direct"

            v_dict["source_name"] = source_name
            v_dict["source_type"] = source_type
            v_dict["channel_id"] = source_name
            videos.append(v_dict)

        return {"videos": videos, "total": len(videos)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/videos/{video_id}")
def delete_video(video_id: int):
    """Xóa video khỏi hệ thống và dọn dẹp file vật lý nếu có"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT download_path, rendered_path FROM videos WHERE id = ?", (video_id,))
        row = cursor.fetchone()
        if row:
            p_dl = row["download_path"]
            if p_dl and os.path.exists(p_dl):
                try:
                    os.remove(p_dl)
                except Exception:
                    pass
            p_ren = row["rendered_path"]
            if p_ren and os.path.exists(p_ren):
                try:
                    os.remove(p_ren)
                except Exception:
                    pass
        cursor.execute("DELETE FROM videos WHERE id = ?", (video_id,))
        cursor.execute("DELETE FROM upload_tasks WHERE video_id = ?", (video_id,))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Đã xóa video khỏi danh sách"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/system/info")
def get_system_info():
    """Lấy thông tin máy trạm (Computer Name, OS, Trình duyệt đang hoạt động)"""
    hostname = socket.gethostname()
    os_name = f"{platform.system()} {platform.release()}"
    active_b = browser_manager.get_active_browser()
    adapter = browser_manager.get_adapter(active_b)
    is_online = False
    if adapter:
        try:
            is_online = bool(adapter.check_health().get("running", False))
        except Exception:
            is_online = False
    
    return {
        "status": "success",
        "computer_name": hostname,
        "os": os_name,
        "active_browser": active_b,
        "browser_online": is_online
    }

@router.post("/campaigns/{campaign_id}/scan_and_ingest_local")
def campaign_scan_and_ingest_local(campaign_id: int):
    """Quét thư mục video cục bộ của chiến dịch và nạp vào hàng đợi render AI"""
    from backend.database import get_connection, log_campaign_event
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, local_folder_path, source_mode FROM campaigns WHERE id = ?", (campaign_id,))
    camp = cursor.fetchone()
    conn.close()
    
    if not camp:
        raise HTTPException(status_code=404, detail="Không tìm thấy chiến dịch")
        
    folder = camp["local_folder_path"]
    if not folder or not os.path.isdir(folder):
        raise HTTPException(status_code=400, detail=f"Thư mục '{folder}' không tồn tại trên máy tính")
        
    # Quét video trong thư mục
    scan_res = local_ingestor.scan_folder(folder)
    files = [f["path"] for f in scan_res.get("files", [])]
    if not files:
        return {"status": "warning", "message": f"Không tìm thấy file video nào trong thư mục {folder}", "added": 0}
        
    ingest_res = local_ingestor.ingest_local_videos(files, channel_id=f"CAMP_{campaign_id}")
    log_campaign_event(campaign_id, "INFO", "ingest", f"Đã nạp {ingest_res.get('added_count', 0)} video từ thư mục {folder} vào quy trình render")
    
    return {
        "status": "success",
        "message": f"Đã nạp thành công {ingest_res.get('added_count', 0)} video từ '{folder}' vào hàng đợi Render AI!",
        "added_count": ingest_res.get("added_count", 0),
        "total_files": len(files)
    }
