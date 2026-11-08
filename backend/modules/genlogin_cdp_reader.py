"""
genlogin_cdp_reader.py
----------------------
Hỗ trợ đọc cookies và tài khoản TikTok/YouTube/Facebook cho GenLogin.
Do GenLogin mã hóa SQLite Cookies bằng DPAPI riêng gắn với TitanBrowser,
module này sử dụng phương thức:
1. Mở profile GenLogin thông qua API: PUT /backend/profiles/{profile_id}/start
2. Nhận debugging port hoặc wsEndpoint.
3. Kết nối CDP (Chrome DevTools Protocol) qua WebSocket tới trang (Page target) với header Origin bị loại bỏ (suppress_origin=True) để lấy toàn bộ Cookies (Network.getAllCookies).
4. Sử dụng cookies thu được gọi TikTok Creator/Passport API để nhận thông tin kênh (username, nickname, uid, followers, views...).
5. Tự động đóng lại profile (PUT /backend/profiles/{profile_id}/stop) sau khi lấy xong cookie (~1-3 giây/profile).
"""

import os
import re
import json
import time
import requests
import websocket
from typing import Dict, Any, Optional, List
from backend.database import log_event

GENLOGIN_BASE = "http://127.0.0.1:55550"

def get_genlogin_auth_token() -> Optional[str]:
    """Trích xuất JWT access_token của GenLogin từ LevelDB lưu trữ tại %APPDATA%\\GenLogin\\Local Storage\\leveldb"""
    local_storage_path = os.path.expandvars(r"%APPDATA%\GenLogin\Local Storage\leveldb")
    if not os.path.isdir(local_storage_path):
        return None
    try:
        for fname in os.listdir(local_storage_path):
            if fname.endswith(('.log', '.ldb')):
                fpath = os.path.join(local_storage_path, fname)
                try:
                    with open(fpath, 'rb') as f:
                        content = f.read()
                    matches = re.findall(rb'"access_token"\s*:\s*"([^"]{50,})"', content)
                    if matches:
                        return matches[-1].decode('utf-8', errors='replace')
                except Exception:
                    pass
    except Exception:
        pass
    return None

def fetch_cookies_via_cdp(profile_id: str) -> Optional[List[Dict[str, Any]]]:
    """Mở profile GenLogin, cào cookies qua CDP, sau đó đóng profile lại ngay lập tức."""
    from backend.modules.browser_adapters import GenLoginAdapter
    adapter = GenLoginAdapter()
    if not adapter._ping():
        adapter.ensure_running()

    token = get_genlogin_auth_token()
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    # 1. Kiểm tra xem profile có đang mở sẵn không
    port = None
    already_running = False
    try:
        r = requests.get(f"{GENLOGIN_BASE}/backend/profiles/running", headers=headers, timeout=5)
        if r.status_code == 200:
            running = r.json().get("data", [])
            for p in running:
                if str(p.get("id")) == str(profile_id):
                    already_running = True
                    port = p.get("port")
                    break
    except Exception as e:
        log_event("WARNING", f"[GenLogin CDP] Không thể kiểm tra running profiles: {e}")

    # 2. Nếu chưa chạy, gọi lệnh start profile
    if not port:
        try:
            log_event("INFO", f"[GenLogin CDP] Đang mở profile {profile_id} để trích xuất cookie...")
            r = requests.put(f"{GENLOGIN_BASE}/backend/profiles/{profile_id}/start", headers=headers, json={}, timeout=25)
            if r.status_code == 200:
                data = r.json().get("data", {})
                port = data.get("port")
            else:
                log_event("WARNING", f"[GenLogin CDP] Không thể start profile {profile_id}: HTTP {r.status_code} - {r.text[:100]}")
                return None
        except Exception as e:
            log_event("ERROR", f"[GenLogin CDP] Lỗi khi mở profile {profile_id}: {e}")
            return None

    if not port:
        return None

    # Đợi 1-2s để DevTools HTTP server ổn định
    time.sleep(1.5)

    cookies = []
    try:
        # Lấy danh sách page target
        r_json = requests.get(f"http://127.0.0.1:{port}/json", timeout=5)
        pages = r_json.json()
        page_ws = None
        for p in pages:
            if p.get("type") == "page" and p.get("webSocketDebuggerUrl"):
                page_ws = p.get("webSocketDebuggerUrl")
                break

        if page_ws:
            ws = websocket.create_connection(page_ws, timeout=8, suppress_origin=True)
            ws.send(json.dumps({"id": 1, "method": "Network.getAllCookies"}))
            res = json.loads(ws.recv())
            ws.close()
            cookies = res.get("result", {}).get("cookies", [])
    except Exception as e:
        log_event("ERROR", f"[GenLogin CDP] Lỗi CDP getAllCookies trên profile {profile_id}: {e}")
    finally:
        # 3. Đóng profile lại nếu ban đầu nó không chạy (để giải phóng RAM)
        if not already_running:
            try:
                requests.put(f"{GENLOGIN_BASE}/backend/profiles/{profile_id}/stop", headers=headers, json={}, timeout=10)
                log_event("INFO", f"[GenLogin CDP] Đã đóng profile {profile_id} sau khi lấy cookie.")
            except Exception:
                pass

    if cookies:
        try:
            from backend.config import DATA_DIR
            cache_dir = os.path.join(DATA_DIR, "genlogin_cookies")
            os.makedirs(cache_dir, exist_ok=True)
            with open(os.path.join(cache_dir, f"{profile_id}.json"), "w", encoding="utf-8") as f:
                json.dump(cookies, f, ensure_ascii=False)
        except Exception:
            pass

    return cookies

def fetch_account_info_from_genlogin(profile_id: str) -> Dict[str, Any]:
    """
    Trích xuất thông tin tài khoản cho profile GenLogin bằng CDP.
    Hỗ trợ cả TikTok, YouTube và Facebook.
    Tương thích với format trả về của gpm_profile_reader.fetch_account_info_from_gpm.
    """
    cookies = fetch_cookies_via_cdp(profile_id)
    if not cookies:
        return {
            "found": False,
            "is_logged_in": False,
            "platform": "tiktok",
            "username": None,
            "nickname": None,
            "user_id": None,
            "followers": 0,
            "views_7d": 0,
            "source": "no_cookies",
            "message": f"Không trích xuất được cookie từ profile GenLogin {profile_id}."
        }

    # Định dạng lại cookie list cho tương thích các hàm request
    formatted_cookies = []
    for c in cookies:
        formatted_cookies.append({
            "name": c.get("name"),
            "value": c.get("value"),
            "domain": c.get("domain", ""),
            "path": c.get("path", "/")
        })

    # ─── 1. KIỂM TRA TIKTOK ───────────────────────────────────────────────────
    tt_cookies = [c for c in formatted_cookies if "tiktok" in c.get("domain", "")]
    auth_cookies = {"sessionid", "sid_tt", "sessionid_ss", "sid_guard"}
    has_tt_auth = any(c.get("name") in auth_cookies for c in tt_cookies)

    if has_tt_auth:
        from backend.modules.gpm_profile_reader import build_requests_session
        sess = build_requests_session(tt_cookies)

        username: Optional[str] = None
        nickname: Optional[str] = None
        user_id: Optional[str] = None
        sec_uid: Optional[str] = None
        followers: int = 0
        views_7d: int = 0
        is_logged_in: bool = False

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

        if not username:
            try:
                r_pp = sess.get("https://www.tiktok.com/passport/web/account/info/", timeout=8)
                if r_pp.status_code == 200:
                    dt = (r_pp.json().get("data") or {})
                    if dt.get("username") or dt.get("user_id_str"):
                        is_logged_in = True
                        username = dt.get("username", "").strip() or username
                        nickname = dt.get("nickname", "").strip() or nickname
                        user_id = dt.get("user_id_str", "").strip() or user_id
            except Exception:
                pass

        if is_logged_in:
            return {
                "found": True,
                "is_logged_in": True,
                "platform": "tiktok",
                "username": username,
                "nickname": nickname,
                "user_id": user_id,
                "tiktok_uid": user_id,
                "sec_uid": sec_uid,
                "followers": followers,
                "views_7d": views_7d,
                "source": "genlogin_cdp",
                "message": f"Thành công (@{username})"
            }

    # ─── 2. KIỂM TRA FACEBOOK VÀ YOUTUBE ─────────────────────────────────────
    fb_cookies = [
        c for c in formatted_cookies
        if "facebook" in c.get("domain", "")
    ]
    c_user = next((c.get("value") for c in fb_cookies if c.get("name") == "c_user"), None)
    has_fb_auth = bool(c_user and any(c.get("name") == "xs" for c in fb_cookies))

    yt_cookies = [
        c for c in formatted_cookies
        if "youtube" in c.get("domain", "") or "google" in c.get("domain", "")
    ]
    has_yt_auth = any(c.get("name") in ["SAPISID", "SSID", "LOGIN_INFO"] for c in yt_cookies)

    yt_channel_id = None
    yt_title = None

    if has_yt_auth:
        sess_yt = requests.Session()
        sess_yt.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        })
        for c in yt_cookies:
            domain = c.get("domain", "")
            d = domain if domain.startswith(".") or "." in domain else f".{domain}"
            sess_yt.cookies.set(c.get("name"), c.get("value"), domain=d, path=c.get("path", "/"))

        try:
            r_st = sess_yt.get("https://studio.youtube.com", timeout=8)
            if r_st.status_code == 200:
                m_cid = re.search(r'"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"', r_st.text)
                if m_cid:
                    yt_channel_id = m_cid.group(1)
        except Exception:
            pass

        if yt_channel_id:
            try:
                r_ch = requests.get(f"https://www.youtube.com/channel/{yt_channel_id}", headers={"User-Agent": sess_yt.headers["User-Agent"]}, timeout=8)
                if r_ch.status_code == 200:
                    t_m = re.search(r'<meta property="og:title" content="([^"]+)">', r_ch.text)
                    if t_m:
                        yt_title = t_m.group(1)
            except Exception:
                pass

    # Nếu có channel YouTube xác thực -> Chọn YouTube
    if yt_channel_id:
        display_name = yt_title or yt_channel_id
        handle_name = f"@{display_name}" if not display_name.startswith("@") else display_name
        return {
            "found": True,
            "is_logged_in": True,
            "platform": "youtube",
            "username": display_name,
            "nickname": display_name,
            "channel_handle": handle_name,
            "user_id": yt_channel_id,
            "tiktok_uid": "",
            "sec_uid": "",
            "fb_page_id": "",
            "followers": 0,
            "views_7d": 0,
            "source": "genlogin_cdp",
            "message": f"OK: YouTube {display_name}"
        }

    # Nếu có phiên Facebook -> Chọn Facebook
    if has_fb_auth:
        i_user = next((c.get("value") for c in fb_cookies if c.get("name") == "i_user"), None)
        return {
            "found": True,
            "is_logged_in": True,
            "platform": "facebook",
            "username": c_user,
            "nickname": f"Facebook User ({c_user})",
            "channel_handle": "",
            "fb_page_id": i_user or c_user,
            "user_id": c_user,
            "tiktok_uid": "",
            "sec_uid": "",
            "followers": 0,
            "views_7d": 0,
            "source": "genlogin_cdp",
            "message": f"OK: Facebook UID {c_user}"
        }

    # Nếu có YouTube auth nhưng chưa trích xuất được channelId (và không có Facebook)
    if has_yt_auth:
        return {
            "found": True,
            "is_logged_in": True,
            "platform": "youtube",
            "username": "YouTube_Channel",
            "nickname": "YouTube_Channel",
            "channel_handle": "@YouTube_Channel",
            "user_id": "",
            "tiktok_uid": "",
            "sec_uid": "",
            "fb_page_id": "",
            "followers": 0,
            "views_7d": 0,
            "source": "genlogin_cdp",
            "message": "OK: YouTube Channel"
        }

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
        "message": f"Profile GenLogin {profile_id} chưa đăng nhập tài khoản (TikTok, YouTube hoặc Facebook)."
    }
