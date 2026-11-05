"""
gpm_profile_reader.py
---------------------
Đọc cookie và thông tin TikTok trực tiếp từ thư mục lưu trữ profile của ứng dụng GPMLogin
trên máy tính cục bộ (local disk) — HOÀN TOÀN KHÔNG CẦN MỞ BROWSER (ZeroRAM).

Hoạt động trên MỌI MÁY TÍNH có cài GPMLogin:
1. Tự động phát hiện đường dẫn lưu trữ profile của GPMLogin qua file `setting.dat`:
   - %APPDATA%\\GPMLoginGlobal\\setting.dat ("local_storage_path")
   - %APPDATA%\\GPMLogin\\setting.dat
   - Quét tất cả thư mục User trên máy Windows
   - Biến môi trường GPM_STORAGE_PATH (nếu muốn cấu hình thủ công)
   - Fallback về các thư mục mặc định của GPMLogin (Profiles)
2. Đọc file ExportCookies.json do GPMLogin tự động xuất trong mỗi profile:
   {storage_path}\\{profile_id}\\Default\\GPMSoft\\Exporter\\ExportCookies.json
3. Gọi TikTok API trực tiếp bằng requests HTTP (Passport API + Aweme Insight API):
   - Lấy username, screen_name, user_id
   - Lấy follower_count chính xác từ Aweme Insight API (/aweme/v2/data/insight/)
   - Lấy 7-day video views
   - Thời gian xử lý: ~0.3 - 0.8 giây/profile, 0MB RAM trình duyệt!
"""

import os
import json
import time
import re
import requests
from typing import Optional, Dict, Any, List
from concurrent.futures import ThreadPoolExecutor
from backend.database import log_event

# ─── GPMLOGIN STORAGE AUTO-DISCOVERY ─────────────────────────────────────────

def discover_gpm_storage_path() -> Optional[str]:
    """
    Tự động phát hiện đường dẫn thư mục chứa profile GPMLogin trên máy tính bất kỳ.
    Không hardcode đường dẫn người dùng.
    """
    # 1. Biến môi trường tuỳ chỉnh (nếu có cấu hình trong .env hoặc hệ thống)
    env_override = os.environ.get("GPM_STORAGE_PATH", "").strip()
    if env_override and os.path.isdir(env_override):
        return env_override

    # 2. Tìm trong setting.dat của GPMLogin / GPMLoginGlobal
    setting_candidates = []
    
    appdata = os.environ.get("APPDATA", "")
    localappdata = os.environ.get("LOCALAPPDATA", "")
    
    if appdata:
        setting_candidates.extend([
            os.path.join(appdata, "GPMLoginGlobal", "setting.dat"),
            os.path.join(appdata, "GPMLogin", "setting.dat"),
        ])
    if localappdata:
        setting_candidates.extend([
            os.path.join(localappdata, "GPMLoginGlobal", "setting.dat"),
            os.path.join(localappdata, "GPMLogin", "setting.dat"),
        ])

    # Quét thêm tất cả profile user trên Windows (hỗ trợ multi-user)
    if os.name == "nt":
        sys_drive = os.environ.get("SYSTEMDRIVE", "C:")
        users_dir = os.path.join(sys_drive, "\\Users")
        if os.path.isdir(users_dir):
            try:
                for u in os.listdir(users_dir):
                    u_roaming = os.path.join(users_dir, u, "AppData", "Roaming")
                    setting_candidates.append(os.path.join(u_roaming, "GPMLoginGlobal", "setting.dat"))
                    setting_candidates.append(os.path.join(u_roaming, "GPMLogin", "setting.dat"))
            except Exception:
                pass

    for s_path in setting_candidates:
        if os.path.isfile(s_path):
            try:
                with open(s_path, "r", encoding="utf-8") as f:
                    setting_json = json.load(f)
                storage_path = setting_json.get("local_storage_path", "").strip()
                if storage_path and os.path.isdir(storage_path):
                    return storage_path
            except Exception:
                continue

    # 3. Fallback: Các thư mục Profiles mặc định thường gặp của GPMLogin
    fallback_candidates = []
    if appdata:
        fallback_candidates.extend([
            os.path.join(appdata, "GPMLoginGlobal", "Profiles"),
            os.path.join(appdata, "GPMLoginGlobal", "Data", "Profiles"),
            os.path.join(appdata, "GPMLogin", "Profiles"),
        ])
    if localappdata:
        fallback_candidates.extend([
            os.path.join(localappdata, "GPMLoginGlobal", "Profiles"),
            os.path.join(localappdata, "GPMLogin", "Profiles"),
        ])

    for fb in fallback_candidates:
        if os.path.isdir(fb):
            return fb

    return None


# Cache đường dẫn để tránh scan nhiều lần
_CACHED_GPM_STORAGE: Optional[str] = None

def get_gpm_storage_path(force_refresh: bool = False) -> Optional[str]:
    """Lấy đường dẫn storage của GPMLogin (dùng cache, tự refresh khi cần)"""
    global _CACHED_GPM_STORAGE
    if _CACHED_GPM_STORAGE and not force_refresh and os.path.isdir(_CACHED_GPM_STORAGE):
        return _CACHED_GPM_STORAGE
    _CACHED_GPM_STORAGE = discover_gpm_storage_path()
    return _CACHED_GPM_STORAGE


def is_gpm_reader_available() -> bool:
    """Kiểm tra máy hiện tại có thể đọc profile GPMLogin từ ổ đĩa không"""
    path = get_gpm_storage_path()
    return bool(path and os.path.isdir(path))


# ─── COOKIE & PROFILE EXTRACTION ──────────────────────────────────────────────

AUTH_COOKIE_NAMES = {"sessionid", "sessionid_ss", "sid_tt"}

_CHROME_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.tiktok.com/tiktokstudio",
}


def find_profile_cookie_file(profile_id: str, storage_path_hint: Optional[str] = None) -> Optional[str]:
    """
    Tìm file cookies của profile GPMLogin trên ổ đĩa.
    Kiểm tra cả profile_id và storage_path_hint (nếu khác nhau).
    """
    base_storage = get_gpm_storage_path()
    if not base_storage or not os.path.isdir(base_storage):
        return None

    candidates = [profile_id]
    if storage_path_hint and storage_path_hint != profile_id:
        candidates.append(storage_path_hint)

    for pid in candidates:
        profile_dir = os.path.join(base_storage, pid)
        if not os.path.isdir(profile_dir):
            continue

        # 1. GPMSoft Exporter JSON (Ưu tiên số 1 - Plaintext đầy đủ do GPMLogin tự xuất)
        export_file = os.path.join(profile_dir, "Default", "GPMSoft", "Exporter", "ExportCookies.json")
        if os.path.isfile(export_file):
            return export_file

        # Fallback profile root exporter
        alt_export = os.path.join(profile_dir, "GPMSoft", "Exporter", "ExportCookies.json")
        if os.path.isfile(alt_export):
            return alt_export

    return None


def load_gpm_profile_cookies(profile_id: str, storage_path_hint: Optional[str] = None) -> Optional[List[Dict[str, Any]]]:
    """
    Đọc danh sách cookie từ profile GPMLogin.
    Trả về list cookie dạng [{name: ..., value: ..., domain: ...}]
    """
    cookie_file = find_profile_cookie_file(profile_id, storage_path_hint)
    if not cookie_file:
        return None

    try:
        with open(cookie_file, "r", encoding="utf-8") as f:
            cookie_data = json.load(f)

        if not isinstance(cookie_data, list):
            return None

        # Lọc các cookie thuộc tiktok
        tt_cookies = [
            c for c in cookie_data 
            if isinstance(c, dict) and "tiktok" in c.get("domain", "")
        ]

        # Kiểm tra có cookie xác thực phiên không
        has_auth = any(c.get("name") in AUTH_COOKIE_NAMES for c in tt_cookies)
        if not has_auth:
            log_event("DEBUG", f"[GPMProfileReader] Profile {profile_id} không có sessionid TikTok.")
            return None

        return tt_cookies

    except Exception as e:
        log_event("ERROR", f"[GPMProfileReader] Lỗi đọc cookie file cho {profile_id}: {e}")
        return None


def build_requests_session(cookies: List[Dict[str, Any]]) -> requests.Session:
    """Tạo requests.Session đã cấu hình đầy đủ cookies & headers để gọi TikTok API"""
    sess = requests.Session()
    for c in cookies:
        name = c.get("name")
        value = c.get("value")
        domain = c.get("domain", ".tiktok.com").lstrip(".")
        path = c.get("path", "/")
        if name and value:
            sess.cookies.set(name, value, domain=domain, path=path)

    sess.headers.update(_CHROME_HEADERS)
    for c in cookies:
        if c.get("name") == "tt-target-idc":
            idc = c.get("value", "")
            if idc:
                sess.headers["tt-target-idc"] = idc
            break

    return sess


def load_all_profile_cookies(profile_id: str, storage_path_hint: Optional[str] = None) -> Optional[List[Dict[str, Any]]]:
    """Đọc toàn bộ cookie của profile GPMLogin (bao gồm TikTok, YouTube, Facebook, Google)"""
    cookie_file = find_profile_cookie_file(profile_id, storage_path_hint)
    if not cookie_file:
        return None
    try:
        with open(cookie_file, "r", encoding="utf-8") as f:
            cookie_data = json.load(f)
        if isinstance(cookie_data, list):
            return cookie_data
    except Exception:
        pass
    return None


def fetch_account_info_from_gpm(profile_id: str, storage_path_hint: Optional[str] = None) -> Dict[str, Any]:
    """
    Tự động phát hiện và lấy thông tin tài khoản đa nền tảng (TikTok, YouTube, Facebook)
    trực tiếp từ file profile GPMLogin trên máy cục bộ — KHÔNG MỞ BROWSER (ZeroRAM).

    Trả về dict:
    {
        "found": bool,
        "is_logged_in": bool,
        "platform": "tiktok" | "youtube" | "facebook",
        "username": str | None,
        "nickname": str | None,
        "user_id": str | None,
        "tiktok_uid": str | None,
        "sec_uid": str | None,
        "channel_handle": str | None,
        "fb_page_id": str | None,
        "followers": int,
        "views_7d": int,
        "source": "gpm_profile" | "no_profile" | "no_session" | "api_error",
        "message": str,
    }
    """
    cookie_file = find_profile_cookie_file(profile_id, storage_path_hint)
    if not cookie_file:
        return {
            "found": False,
            "is_logged_in": False,
            "platform": "tiktok",
            "username": None,
            "nickname": None,
            "user_id": None,
            "followers": 0,
            "views_7d": 0,
            "source": "no_profile",
            "message": f"Không tìm thấy file cookies cho profile GPM {profile_id} trên ổ đĩa."
        }

    all_cookies = load_all_profile_cookies(profile_id, storage_path_hint) or []
    if not all_cookies:
        return {
            "found": False,
            "is_logged_in": False,
            "platform": "tiktok",
            "username": None,
            "nickname": None,
            "user_id": None,
            "followers": 0,
            "views_7d": 0,
            "source": "no_session",
            "message": f"Profile {profile_id} chưa có dữ liệu cookie."
        }

    # ─── 1. KIỂM TRA PHIÊN TIKTOK ─────────────────────────────────────────────
    tt_cookies = [
        c for c in all_cookies 
        if isinstance(c, dict) and "tiktok" in c.get("domain", "")
    ]
    has_tt_auth = any(c.get("name") in AUTH_COOKIE_NAMES for c in tt_cookies)

    if has_tt_auth:
        sess = build_requests_session(tt_cookies)
        username: Optional[str] = None
        nickname: Optional[str] = None
        user_id: Optional[str] = None
        sec_uid: Optional[str] = None
        followers: int = 0
        views_7d: int = 0
        is_logged_in: bool = False

        # Bước 1.1: TikTok Studio User API
        try:
            studio_qs = (
                "aid=1988&app_name=tiktok_creator_center"
                "&device_platform=web_pc&channel=tiktok_web"
                "&os=win&browser_name=Mozilla&browser_platform=Win32"
            )
            r_st = sess.get(f"https://www.tiktok.com/tiktokstudio/api/web/user?{studio_qs}", timeout=8)
            if r_st.status_code == 200:
                ub = (r_st.json().get("userBaseInfo") or {}).get("UserProfile", {}).get("UserBase", {})
                raw_uid = ub.get("Id") or ub.get("Uid") or ub.get("uid") or ub.get("user_id") if ub else None
                if ub and raw_uid:
                    is_logged_in = True
                    user_id = str(raw_uid).strip()
                    raw_sec = ub.get("SecUid") or ub.get("sec_uid") or ub.get("secUid")
                    if raw_sec:
                        sec_uid = str(raw_sec).strip()
                    if ub.get("UniqId"):
                        username = str(ub["UniqId"]).lstrip("@").strip()
                    if ub.get("NickName"):
                        nickname = str(ub["NickName"]).strip()
                    fc = ub.get("FanCount") or ub.get("FanCnt")
                    if fc is not None:
                        try:
                            followers = int(fc)
                        except Exception:
                            pass
        except Exception:
            pass

        # Bước 1.2: TikTok Passport Session API
        try:
            r_pass = sess.get("https://www.tiktok.com/passport/web/account/info/?app_id=1233", timeout=8)
            if r_pass.status_code == 200:
                pdata = r_pass.json().get("data", {})
                if pdata.get("user_id"):
                    is_logged_in = True
                    if not user_id:
                        user_id = str(pdata["user_id"]).strip()
                    if not sec_uid and pdata.get("sec_user_id"):
                        sec_uid = str(pdata["sec_user_id"]).strip()
                    if not username:
                        p_u = pdata.get("username") or pdata.get("screen_name")
                        if p_u:
                            username = str(p_u).lstrip("@").strip()
                    if not nickname:
                        p_n = pdata.get("screen_name") or username
                        if p_n:
                            nickname = str(p_n).strip()
        except Exception:
            pass

        # Bước 1.3: Aweme Insight API
        try:
            tz_offset = -25200  # GMT+7
            type_req = json.dumps([
                {"insigh_type": "vv_history", "days": 7, "end_days": 1},
                {"insigh_type": "follower_num_history", "days": 7, "end_days": 1},
            ])
            r_aweme = sess.get(
                f"https://www.tiktok.com/aweme/v2/data/insight/?tz_offset={tz_offset}&type_requests={type_req}",
                timeout=8
            )
            if r_aweme.status_code == 200:
                adata = r_aweme.json()
                fn_hist = adata.get("follower_num_history") or []
                if fn_hist:
                    for item in reversed(fn_hist):
                        if item.get("value") is not None:
                            followers = int(item["value"])
                            break
                vv_hist = adata.get("vv_history") or []
                if vv_hist:
                    views_7d = sum(item.get("value", 0) for item in vv_hist if item.get("value"))
        except Exception:
            pass

        # Bước 1.4: Fallback trang cá nhân
        if is_logged_in and username and followers == 0:
            try:
                u_clean = username.lstrip("@").strip()
                r_page = sess.get(f"https://www.tiktok.com/@{u_clean}", timeout=8)
                if r_page.status_code == 200:
                    fm = re.search(r'"followerCount":\s*(\d+)', r_page.text) or re.search(r'"fanCount":\s*(\d+)', r_page.text)
                    if fm:
                        followers = int(fm.group(1))
            except Exception:
                pass

        if is_logged_in and username:
            log_event("INFO", f"✅ [GPMZeroRAM] {profile_id}: TikTok @{username} ({nickname}) - {followers:,} followers")
            return {
                "found": True,
                "is_logged_in": True,
                "platform": "tiktok",
                "username": username.lstrip("@").strip(),
                "nickname": nickname,
                "user_id": user_id,
                "tiktok_uid": user_id,
                "sec_uid": sec_uid,
                "channel_handle": "",
                "fb_page_id": "",
                "followers": followers,
                "views_7d": views_7d,
                "source": "gpm_profile",
                "message": f"OK: @{username} ({followers:,} followers)"
            }

    # ─── 2. KIỂM TRA PHIÊN YOUTUBE / GOOGLE ──────────────────────────────────
    yt_cookies = [
        c for c in all_cookies 
        if isinstance(c, dict) and ("youtube" in c.get("domain", "") or "google" in c.get("domain", ""))
    ]
    has_yt_auth = any(c.get("name") in ["SAPISID", "SSID", "LOGIN_INFO"] for c in yt_cookies)

    if has_yt_auth:
        sess_yt = requests.Session()
        sess_yt.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        })
        for c in yt_cookies:
            sess_yt.cookies.set(c.get('name'), c.get('value'), domain=c.get('domain', '.youtube.com'))

        yt_channel_id = None
        yt_title = None
        try:
            r_st = sess_yt.get("https://studio.youtube.com", timeout=8)
            if r_st.status_code == 200:
                m_cid = re.search(r'"channelId":"([^"]+)"', r_st.text)
                if m_cid:
                    yt_channel_id = m_cid.group(1)
        except Exception:
            pass

        if yt_channel_id:
            try:
                r_ch = requests.get(f"https://www.youtube.com/channel/{yt_channel_id}", headers=sess_yt.headers, timeout=8)
                if r_ch.status_code == 200:
                    t_m = re.search(r'<meta property="og:title" content="([^"]+)">', r_ch.text)
                    if t_m:
                        yt_title = t_m.group(1)
            except Exception:
                pass

        display_name = yt_title or yt_channel_id or "YouTube_Channel"
        handle_name = f"@{display_name}" if not display_name.startswith("@") else display_name
        log_event("INFO", f"✅ [GPMZeroRAM] {profile_id}: YouTube Channel {display_name} (ID: {yt_channel_id or 'N/A'})")
        return {
            "found": True,
            "is_logged_in": True,
            "platform": "youtube",
            "username": display_name,
            "nickname": display_name,
            "channel_handle": handle_name,
            "user_id": yt_channel_id or "",
            "tiktok_uid": "",
            "sec_uid": "",
            "fb_page_id": "",
            "followers": 0,
            "views_7d": 0,
            "source": "gpm_profile",
            "message": f"OK: YouTube {display_name}"
        }

    # ─── 3. KIỂM TRA PHIÊN FACEBOOK ──────────────────────────────────────────
    fb_cookies = [
        c for c in all_cookies 
        if isinstance(c, dict) and "facebook" in c.get("domain", "")
    ]
    c_user = next((c.get("value") for c in fb_cookies if c.get("name") == "c_user"), None)
    has_fb_auth = bool(c_user and any(c.get("name") == "xs" for c in fb_cookies))

    if has_fb_auth:
        log_event("INFO", f"✅ [GPMZeroRAM] {profile_id}: Facebook Profile UID {c_user}")
        return {
            "found": True,
            "is_logged_in": True,
            "platform": "facebook",
            "username": c_user,
            "nickname": f"Facebook User ({c_user})",
            "channel_handle": "",
            "fb_page_id": c_user,
            "user_id": c_user,
            "tiktok_uid": "",
            "sec_uid": "",
            "followers": 0,
            "views_7d": 0,
            "source": "gpm_profile",
            "message": f"OK: Facebook UID {c_user}"
        }

    # ─── 4. KHÔNG TÌM THẤY PHIÊN NÀO HỢP LỆ ────────────────────────────────
    return {
        "found": False,
        "is_logged_in": False,
        "platform": "tiktok",
        "username": None,
        "nickname": None,
        "user_id": None,
        "tiktok_uid": None,
        "sec_uid": None,
        "channel_handle": None,
        "fb_page_id": None,
        "followers": 0,
        "views_7d": 0,
        "source": "no_session",
        "message": f"Profile {profile_id} chưa đăng nhập tài khoản (TikTok, YouTube hoặc Facebook)."
    }



def enumerate_youtube_channels(profile_id: str) -> list:
    """
    Liệt kê TẤT CẢ kênh YouTube mà tài khoản Google trong profile GPM đang quản lý.
    Trả về danh sách dict: [{channel_id, channel_name, channel_url, is_default}, ...]
    """
    storage_path = get_gpm_storage_path()
    if not storage_path:
        return []

    export_file = os.path.join(storage_path, profile_id, "Default", "GPMSoft", "Exporter", "ExportCookies.json")
    if not os.path.isfile(export_file):
        return []

    try:
        with open(export_file, "r", encoding="utf-8") as f:
            all_cookies = json.load(f)
    except Exception:
        return []

    yt_cookies = [
        c for c in all_cookies
        if isinstance(c, dict) and ("youtube" in c.get("domain", "") or "google" in c.get("domain", ""))
    ]
    has_yt_auth = any(c.get("name") in ["SAPISID", "SSID", "LOGIN_INFO"] for c in yt_cookies)
    if not has_yt_auth:
        return []

    sess = requests.Session()
    sess.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    })
    for c in yt_cookies:
        sess.cookies.set(c.get('name'), c.get('value'), domain=c.get('domain', '.youtube.com'))

    channels = []
    seen_ids = set()

    try:
        # Bước 1: Lấy HTML YouTube Studio — tìm TẤT CẢ channelId
        r = sess.get("https://studio.youtube.com", timeout=10)
        if r.status_code == 200:
            # Tìm tất cả channelId duy nhất (bắt đầu bằng UC)
            all_ids = re.findall(r'"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]+)"', r.text)
            unique_ids = []
            for cid in all_ids:
                if cid not in seen_ids:
                    seen_ids.add(cid)
                    unique_ids.append(cid)

            # Bước 2: Lấy tên kênh cho từng channelId
            for idx, cid in enumerate(unique_ids):
                ch_name = cid  # fallback
                try:
                    r_ch = requests.get(
                        f"https://www.youtube.com/channel/{cid}",
                        headers=sess.headers, timeout=8
                    )
                    if r_ch.status_code == 200:
                        m = re.search(r'<meta property="og:title" content="([^"]+)">', r_ch.text)
                        if m:
                            ch_name = m.group(1)
                except Exception:
                    pass

                handle = f"@{ch_name}" if not ch_name.startswith("@") else ch_name
                channels.append({
                    "channel_id": cid,
                    "channel_name": ch_name,
                    "channel_url": handle,
                    "is_default": 1 if idx == 0 else 0
                })
    except Exception as e:
        log_event("WARNING", f"[GPMProfileReader] Lỗi liệt kê kênh YouTube cho {profile_id}: {e}")

    return channels


def enumerate_facebook_pages(profile_id: str) -> list:
    """
    Liệt kê tài khoản cá nhân + TẤT CẢ trang Facebook mà tài khoản trong profile GPM đang quản lý.
    Trả về danh sách dict: [{channel_id, channel_name, channel_url, is_default}, ...]
    """
    storage_path = get_gpm_storage_path()
    if not storage_path:
        return []

    export_file = os.path.join(storage_path, profile_id, "Default", "GPMSoft", "Exporter", "ExportCookies.json")
    if not os.path.isfile(export_file):
        return []

    try:
        with open(export_file, "r", encoding="utf-8") as f:
            all_cookies = json.load(f)
    except Exception:
        return []

    fb_cookies = [
        c for c in all_cookies
        if isinstance(c, dict) and "facebook" in c.get("domain", "")
    ]
    c_user = next((c.get("value") for c in fb_cookies if c.get("name") == "c_user"), None)
    has_fb_auth = bool(c_user and any(c.get("name") == "xs" for c in fb_cookies))
    if not has_fb_auth:
        return []

    channels = []

    # 1. Tài khoản cá nhân (luôn là default)
    personal_name = f"Facebook User ({c_user})"

    # Thử lấy tên thật từ Facebook
    sess = requests.Session()
    sess.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    })
    for c in fb_cookies:
        sess.cookies.set(c.get('name'), c.get('value'), domain=c.get('domain', '.facebook.com'))

    try:
        r = sess.get(f"https://www.facebook.com/profile.php?id={c_user}", timeout=8, allow_redirects=True)
        if r.status_code == 200:
            m = re.search(r'<meta property="og:title" content="([^"]+)"', r.text)
            if m:
                personal_name = m.group(1)
    except Exception:
        pass

    channels.append({
        "channel_id": c_user,
        "channel_name": personal_name,
        "channel_url": f"/profile/{c_user}",
        "is_default": 1
    })

    # 2. Thử lấy danh sách Facebook Pages đang quản lý
    try:
        r_pages = sess.get("https://www.facebook.com/pages/?category=your_pages", timeout=10)
        if r_pages.status_code == 200:
            # Tìm page IDs và tên từ HTML (pattern: pageID + pageName trong JSON payload)
            page_matches = re.findall(
                r'"pageID"\s*:\s*"(\d+)"[^}]*"name"\s*:\s*"([^"]+)"',
                r_pages.text
            )
            if not page_matches:
                # Fallback pattern: tìm trong các link /page/
                page_matches_alt = re.findall(
                    r'href="/([^"]+)"[^>]*>\s*<[^>]*>\s*<[^>]*>([^<]+)',
                    r_pages.text
                )

            for page_id, page_name in page_matches:
                if page_id != c_user:
                    channels.append({
                        "channel_id": page_id,
                        "channel_name": page_name,
                        "channel_url": f"/{page_name.replace(' ', '-')}",
                        "is_default": 0
                    })
    except Exception as e:
        log_event("WARNING", f"[GPMProfileReader] Lỗi liệt kê trang Facebook cho {profile_id}: {e}")

    return channels


def sync_profile_channels(profile_id: str) -> dict:
    """
    Đồng bộ tất cả kênh/trang của một profile vào bảng profile_channels.
    Trả về: {"youtube": [...], "facebook": [...], "total": int}
    """
    from backend.database import get_connection

    yt_channels = enumerate_youtube_channels(profile_id)
    fb_pages = enumerate_facebook_pages(profile_id)

    conn = get_connection()
    cursor = conn.cursor()

    synced = 0
    for ch in yt_channels:
        cursor.execute("""
            INSERT INTO profile_channels (gpm_id, platform, channel_id, channel_name, channel_url, is_default)
            VALUES (?, 'youtube', ?, ?, ?, ?)
            ON CONFLICT(gpm_id, platform, channel_id) DO UPDATE SET
                channel_name = excluded.channel_name,
                channel_url = excluded.channel_url,
                is_default = excluded.is_default
        """, (profile_id, ch["channel_id"], ch["channel_name"], ch["channel_url"], ch["is_default"]))
        synced += 1

    for pg in fb_pages:
        cursor.execute("""
            INSERT INTO profile_channels (gpm_id, platform, channel_id, channel_name, channel_url, is_default)
            VALUES (?, 'facebook', ?, ?, ?, ?)
            ON CONFLICT(gpm_id, platform, channel_id) DO UPDATE SET
                channel_name = excluded.channel_name,
                channel_url = excluded.channel_url,
                is_default = excluded.is_default
        """, (profile_id, pg["channel_id"], pg["channel_name"], pg["channel_url"], pg["is_default"]))
        synced += 1

    conn.commit()
    conn.close()

    log_event("INFO", f"[ProfileChannels] Đồng bộ {len(yt_channels)} kênh YouTube + {len(fb_pages)} trang Facebook cho profile {profile_id}")
    return {"youtube": yt_channels, "facebook": fb_pages, "total": synced}


def list_gpm_profiles_status() -> Dict[str, Any]:
    """
    Kiểm tra trạng thái cookie của các profile GPMLogin ĐANG HOẠT ĐỘNG trong GPMLogin App.
    Chỉ áp dụng cho các profile có mặt trong GPMLogin App (lấy qua gpm_client.get_profiles),
    bỏ qua các thư mục rác, backup hoặc profile đã bị xoá trên ổ đĩa.
    """
    from backend.modules.gpm_client import gpm_client

    storage_path = get_gpm_storage_path()
    if not storage_path or not os.path.isdir(storage_path):
        return {
            "available": False,
            "storage_path": None,
            "total_profiles": 0,
            "logged_in_count": 0,
            "profiles": []
        }

    # 1. Lấy danh sách profile ĐANG ACTIVE trong GPMLogin App
    active_gpm_profiles = gpm_client.get_profiles()
    
    profiles_status = []
    logged_in_count = 0

    if active_gpm_profiles:
        # Chỉ quét các profile đang tồn tại trong GPMLogin App
        for p in active_gpm_profiles:
            pid = p["id"]
            p_name = p.get("name", pid)
            export_file = os.path.join(storage_path, pid, "Default", "GPMSoft", "Exporter", "ExportCookies.json")
            has_file = os.path.isfile(export_file)
            has_session = False
            mtime = None

            if has_file:
                try:
                    mtime = os.path.getmtime(export_file)
                    with open(export_file, "r", encoding="utf-8") as f:
                        cookies = json.load(f)
                    has_session = any(
                        isinstance(c, dict) and c.get("name") == "sessionid" and "tiktok" in c.get("domain", "")
                        for c in cookies
                    ) or any(
                        isinstance(c, dict) and c.get("name") in ["SAPISID", "SSID", "LOGIN_INFO"] and ("youtube" in c.get("domain", "") or "google" in c.get("domain", ""))
                        for c in cookies
                    ) or any(
                        isinstance(c, dict) and c.get("name") in ["c_user", "xs"] and "facebook" in c.get("domain", "")
                        for c in cookies
                    )
                except Exception:
                    pass

            if has_session:
                logged_in_count += 1

            profiles_status.append({
                "profile_id": pid,
                "name": p_name,
                "has_cookie_file": has_file,
                "has_sessionid": has_session,
                "is_active_in_gpm": True,
                "last_updated": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(mtime)) if mtime else None
            })

        return {
            "available": True,
            "storage_path": storage_path,
            "total_profiles": len(active_gpm_profiles),
            "logged_in_count": logged_in_count,
            "profiles": profiles_status
        }

    # 2. Fallback: Nếu GPMLogin App tắt API, quét thư mục storage trên ổ đĩa
    try:
        entries = [
            d for d in os.listdir(storage_path)
            if os.path.isdir(os.path.join(storage_path, d)) and not d.startswith(".") and d != "_backup"
        ]
    except Exception as e:
        log_event("ERROR", f"[GPMProfileReader] Lỗi đọc thư mục {storage_path}: {e}")
        return {
            "available": False,
            "storage_path": storage_path,
            "total_profiles": 0,
            "logged_in_count": 0,
            "profiles": []
        }

    for pid in entries:
        export_file = os.path.join(storage_path, pid, "Default", "GPMSoft", "Exporter", "ExportCookies.json")
        has_file = os.path.isfile(export_file)
        has_session = False
        mtime = None

        if has_file:
            try:
                mtime = os.path.getmtime(export_file)
                with open(export_file, "r", encoding="utf-8") as f:
                    cookies = json.load(f)
                has_session = any(
                    isinstance(c, dict) and c.get("name") == "sessionid" and "tiktok" in c.get("domain", "")
                    for c in cookies
                )
            except Exception:
                pass

        if has_session:
            logged_in_count += 1

        profiles_status.append({
            "profile_id": pid,
            "name": pid,
            "has_cookie_file": has_file,
            "has_sessionid": has_session,
            "is_active_in_gpm": False,
            "last_updated": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(mtime)) if mtime else None
        })

    return {
        "available": True,
        "storage_path": storage_path,
        "total_profiles": len(entries),
        "logged_in_count": logged_in_count,
        "profiles": profiles_status
    }
