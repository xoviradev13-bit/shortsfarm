
def get_browser_setting_url(key: str, default: str) -> str:
    """Lấy URL API của trình duyệt từ bảng settings hoặc biến môi trường"""
    try:
        from backend.database import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
        row = cursor.fetchone()
        conn.close()
        if row and row["value"]:
            return row["value"].strip().rstrip("/")
    except Exception:
        pass
    return os.environ.get(key, default).strip().rstrip("/")

import os
import socket
import requests
import threading
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from backend.database import log_event
from backend.logger import get_logger

logger = get_logger("browser_adapters")

class BaseBrowserAdapter(ABC):
    """Lớp cơ sở trừu tượng cho tất cả các trình duyệt Antidetect"""
    
    @abstractmethod
    def check_health(self) -> Dict[str, Any]:
        """Kiểm tra ứng dụng có đang chạy trên máy tính không"""
        pass

    @abstractmethod
    def list_profiles(self) -> List[Dict[str, Any]]:
        """Lấy danh sách tất cả các profiles"""
        pass

    @abstractmethod
    def start_profile(self, profile_id: str) -> Optional[str]:
        """
        Khởi động profile và trả về chuỗi kết nối CDP 
        (dạng '127.0.0.1:port' hoặc 'ws://...') cho Playwright kết nối
        """
        pass

    @abstractmethod
    def stop_profile(self, profile_id: str) -> bool:
        """Đóng profile"""
        pass


class GPMAdapter(BaseBrowserAdapter):
    """Adapter cho GPMLogin"""
    def __init__(self):
        from backend.modules.gpm_client import gpm_client
        self.client = gpm_client

    def check_health(self) -> Dict[str, Any]:
        h = self.client.check_health()
        return {
            "browser": "gpm",
            "name": "GPMLogin",
            "running": h.get("running", False),
            "profile_count": h.get("profile_count", 0),
            "message": h.get("message", "")
        }

    def list_profiles(self) -> List[Dict[str, Any]]:
        return self.client.get_profiles()

    def start_profile(self, profile_id: str) -> Optional[str]:
        return self.client.start_profile(profile_id)

    def stop_profile(self, profile_id: str) -> bool:
        return self.client.stop_profile(profile_id)


class AdsPowerAdapter(BaseBrowserAdapter):
    """Adapter cho AdsPower Browser (API Port 50325 mặc định)"""
    def __init__(self, base_url: Optional[str] = None):
        self._custom_base = base_url
        self._detected_url = None

    @property
    def base_url(self) -> str:
        if self._custom_base:
            return self._custom_base.rstrip("/")
        if self._detected_url:
            return self._detected_url
        return get_browser_setting_url("ADSPOWER_API_BASE_URL", "http://127.0.0.1:50325")

    def _ping(self) -> bool:
        # Thử cả 127.0.0.1 và local.adspower.net trên cổng 50325
        candidates = [
            self.base_url,
            "http://127.0.0.1:50325",
            "http://local.adspower.net:50325"
        ]
        # Loại bỏ trùng lặp giữ thứ tự
        seen = set()
        unique_urls = []
        for u in candidates:
            if u not in seen:
                seen.add(u)
                unique_urls.append(u)

        for u in unique_urls:
            try:
                r = requests.get(f"{u}/status", timeout=1.2)
                if r.status_code == 200:
                    self._detected_url = u
                    return True
            except Exception:
                continue
        return False

    def check_health(self) -> Dict[str, Any]:
        running = self._ping()
        profiles = self.list_profiles() if running else []
        return {
            "browser": "adspower",
            "name": "AdsPower",
            "running": running,
            "profile_count": len(profiles),
            "message": "AdsPower đang online" if running else "AdsPower chưa bật (Cổng 50325)"
        }

    def list_profiles(self) -> List[Dict[str, Any]]:
        try:
            url = f"{self.base_url}/api/v1/user/list?page=1&page_size=100"
            r = requests.get(url, timeout=3)
            data = r.json()
            if data.get("code") == 0:
                raw_list = data.get("data", {}).get("list", [])
                return [
                    {
                        "id": p.get("user_id"),
                        "name": p.get("name") or p.get("user_id"),
                        "raw_name": p.get("name"),
                        "group_name": p.get("group_name", "Default"),
                    }
                    for p in raw_list
                ]
        except Exception as e:
            logger.error(f"Lỗi lấy danh sách profile AdsPower: {e}")
        return []

    def start_profile(self, profile_id: str) -> Optional[str]:
        try:
            url = f"{self.base_url}/api/v1/browser/start?user_id={profile_id}"
            r = requests.get(url, timeout=20)
            data = r.json()
            if data.get("code") == 0:
                # AdsPower trả về WebSocket URL cho puppeteer/playwright
                ws_url = data.get("data", {}).get("ws", {}).get("puppeteer")
                if ws_url:
                    log_event("INFO", f"AdsPower profile {profile_id} mở thành công: {ws_url}")
                    return ws_url
                # Hoặc debug port
                debug_port = data.get("data", {}).get("debug_port")
                if debug_port:
                    return f"127.0.0.1:{debug_port}"
            log_event("ERROR", f"AdsPower lỗi start: {data.get('msg')}")
        except Exception as e:
            log_event("ERROR", f"Không thể kết nối API AdsPower: {e}")
        return None

    def stop_profile(self, profile_id: str) -> bool:
        try:
            url = f"{self.base_url}/api/v1/browser/stop?user_id={profile_id}"
            r = requests.get(url, timeout=10)
            return r.json().get("code") == 0
        except Exception:
            return False


class DolphinAntyAdapter(BaseBrowserAdapter):
    """Adapter cho Dolphin Anty (Local API Port 3001)"""
    def __init__(self, base_url: Optional[str] = None):
        self._custom_base = base_url

    @property
    def base_url(self) -> str:
        if self._custom_base:
            return self._custom_base.rstrip("/")
        return get_browser_setting_url("DOLPHIN_API_BASE_URL", "http://localhost:3001/v1.0")

    def _ping(self) -> bool:
        try:
            import urllib.parse
            parsed = urllib.parse.urlparse(self.base_url)
            host = parsed.hostname or "127.0.0.1"
            port = parsed.port or 3001
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.15)
                return s.connect_ex((host, port)) == 0
        except Exception:
            return False

    def check_health(self) -> Dict[str, Any]:
        running = self._ping()
        profiles = self.list_profiles() if running else []
        return {
            "browser": "dolphin",
            "name": "Dolphin Anty",
            "running": running,
            "profile_count": len(profiles),
            "message": "Dolphin Anty đang online" if running else "Dolphin Anty chưa bật (Cổng 3001)"
        }

    def list_profiles(self) -> List[Dict[str, Any]]:
        try:
            url = f"{self.base_url}/browser_profiles"
            r = requests.get(url, timeout=3)
            if r.status_code == 200:
                data = r.json().get("data", [])
                return [
                    {
                        "id": str(p.get("id")),
                        "name": p.get("name") or str(p.get("id")),
                        "raw_name": p.get("name"),
                        "group_name": "Dolphin",
                    }
                    for p in data
                ]
        except Exception as e:
            logger.error(f"Lỗi lấy danh sách Dolphin profiles: {e}")
        return []

    def start_profile(self, profile_id: str) -> Optional[str]:
        try:
            # Dolphin Anty yêu cầu cờ automation=1 để bật cổng CDP
            url = f"{self.base_url}/browser_profiles/{profile_id}/start?automation=1"
            r = requests.get(url, timeout=20)
            data = r.json()
            if data.get("success"):
                port = data.get("automation", {}).get("port")
                if port:
                    return f"127.0.0.1:{port}"
                ws = data.get("automation", {}).get("wsEndpoint")
                if ws:
                    return ws
            log_event("ERROR", f"Dolphin Anty không mở được profile: {data}")
        except Exception as e:
            log_event("ERROR", f"Lỗi gọi API Dolphin Anty: {e}")
        return None

    def stop_profile(self, profile_id: str) -> bool:
        try:
            url = f"{self.base_url}/browser_profiles/{profile_id}/stop"
            r = requests.get(url, timeout=10)
            return r.json().get("success", False)
        except Exception:
            return False


class GenLoginAdapter(BaseBrowserAdapter):
    """Adapter cho GenLogin (Local API Port 55550)"""
    _launch_lock = threading.Lock()  # Class-level lock ngăn chặn launch đồng thời

    def __init__(self, base_url: Optional[str] = None):
        self._custom_base = base_url
        self._detected_url = None

    @property
    def base_url(self) -> str:
        if self._custom_base:
            return self._custom_base.rstrip("/")
        if self._detected_url:
            return self._detected_url
        return get_browser_setting_url("GENLOGIN_API_BASE_URL", "http://127.0.0.1:55550")

    def _ping(self) -> bool:
        for host in ["127.0.0.1", "localhost"]:
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.settimeout(0.5)
                    if s.connect_ex((host, 55550)) == 0:
                        self._detected_url = f"http://{host}:55550"
                        return True
            except Exception:
                continue
        return False

    def ensure_running(self) -> bool:
        """Kiểm tra nếu GenLogin đang tắt thì tự động bật lên (thread-safe, chống launch trùng)"""
        import os, time, subprocess

        # Kiểm tra nhanh trước khi lấy lock
        if self._ping():
            return True

        # Lock ngăn chặn nhiều thread cùng launch GenLogin
        if not self._launch_lock.acquire(blocking=False):
            # Thread khác đang launch rồi → chờ kết quả
            with self._launch_lock:
                return self._ping()

        try:
            # Re-check sau khi lấy lock (thread khác có thể đã launch xong)
            if self._ping():
                return True

            candidates = [
                os.path.expandvars(r"%LOCALAPPDATA%\Programs\GenLogin\GenLogin.exe"),
                os.path.expandvars(r"%PROGRAMFILES%\GenLogin\GenLogin.exe"),
                os.path.join(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"), r"GenLogin\GenLogin.exe"),
                os.path.expandvars(r"%APPDATA%\GenLogin\GenLogin.exe"),
            ]
            exe_path = None
            for p in candidates:
                if os.path.exists(p):
                    exe_path = p
                    break

            # Fallback quét shortcut Start Menu nếu GenLogin cài đặt ở ổ đĩa tùy biến (D:, E:...)
            if not exe_path:
                import glob
                for d in [
                    os.path.expandvars(r"%APPDATA%\Microsoft\Windows\Start Menu\Programs"),
                    os.path.expandvars(r"%PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs"),
                ]:
                    if os.path.exists(d):
                        matches = glob.glob(os.path.join(d, "**", "*GenLogin*.lnk"), recursive=True)
                        if matches and os.path.exists(matches[0]):
                            exe_path = matches[0]
                            break

            if exe_path:
                log_event("INFO", f"Phát hiện GenLogin đang tắt. Đang tự động khởi chạy ứng dụng: {exe_path}")
                try:
                    if exe_path.lower().endswith('.lnk'):
                        os.startfile(exe_path)
                    else:
                        subprocess.Popen([exe_path], shell=False)
                    for attempt in range(1, 31):
                        time.sleep(1)
                        if self._ping():
                            log_event("INFO", f"GenLogin đã khởi động thành công và API sẵn sàng sau {attempt}s!")
                            return True
                    log_event("WARNING", "Đã khởi chạy GenLogin nhưng API cổng 55550 chưa sẵn sàng sau 30s. Vui lòng kiểm tra cửa sổ GenLogin.")
                except Exception as e:
                    log_event("ERROR", f"Không thể tự động bật GenLogin: {e}")

            return False
        finally:
            self._launch_lock.release()

    def check_health(self) -> Dict[str, Any]:
        """Kiểm tra sức khỏe GenLogin - KHÔNG tự động khởi chạy app"""
        running = self._ping()
        count = 0
        if running:
            try:
                r = requests.get(f"{self.base_url}/backend/profiles", timeout=3)
                if r.status_code == 200:
                    count = len(r.json().get("data", {}).get("items", []))
            except Exception:
                pass
        return {
            "browser": "genlogin",
            "name": "GenLogin",
            "running": running,
            "profile_count": count,
            "message": "GenLogin đang online (Cổng 55550)" if running else "GenLogin chưa bật (Cổng 55550)"
        }

    def list_profiles(self) -> List[Dict[str, Any]]:
        """Lấy danh sách profile từ GenLogin Local API.
        Endpoint đúng: GET /backend/profiles
        Response: {"success": true, "data": {"items": [...], "pagination": {...}}}
        Mỗi item: {"id": 26883945, "profile_data": {"name": "...", ...}}
        """
        if not self._ping():
            self.ensure_running()

        all_profiles = []
        for base in [self.base_url, "http://127.0.0.1:55550", "http://localhost:55550"]:
            try:
                # Phân trang: lấy tất cả profile
                offset = 0
                limit = 50
                while True:
                    url = f"{base}/backend/profiles?offset={offset}&limit={limit}"
                    r = requests.get(url, timeout=5)
                    if r.status_code != 200:
                        break
                    res_json = r.json()
                    if not res_json.get("success"):
                        break
                    items = res_json.get("data", {}).get("items", [])
                    if not items:
                        break
                    for p in items:
                        if p.get("id") is not None:
                            profile_data = p.get("profile_data", {})
                            all_profiles.append({
                                "id": str(p["id"]),
                                "name": profile_data.get("name") or str(p["id"]),
                                "raw_name": profile_data.get("name"),
                                "group_name": "GenLogin",
                                "raw_proxy": "",
                                "browser_type": "genlogin",
                            })
                    # Kiểm tra pagination
                    pagination = res_json.get("data", {}).get("pagination", {})
                    total = pagination.get("total_items", 0)
                    if offset + limit >= total:
                        break
                    offset += limit

                if all_profiles:
                    return all_profiles
            except Exception:
                continue
        return []

    def start_profile(self, profile_id: str) -> Optional[str]:
        for base in [self.base_url, "http://127.0.0.1:55550", "http://localhost:55550"]:
            for pattern in [f"{base}/backend/profiles/{profile_id}/start", f"{base}/profiles/{profile_id}/start"]:
                try:
                    r = requests.get(pattern, timeout=20)
                    if r.status_code == 200:
                        data = r.json()
                        ws_endpoint = data.get("wsEndpoint") or data.get("data", {}).get("wsEndpoint")
                        if ws_endpoint:
                            log_event("INFO", f"GenLogin profile {profile_id} mở thành công: {ws_endpoint}")
                            return ws_endpoint
                        port = data.get("remote_debugging_port") or data.get("port") or data.get("data", {}).get("port")
                        if port:
                            return f"127.0.0.1:{port}"
                except Exception:
                    continue
        log_event("ERROR", f"Không thể khởi động profile GenLogin {profile_id}")
        return None

    def stop_profile(self, profile_id: str) -> bool:
        try:
            for pattern in [f"{self.base_url}/backend/profiles/{profile_id}/stop", f"{self.base_url}/profiles/{profile_id}/stop"]:
                r = requests.get(pattern, timeout=10)
                if r.status_code == 200:
                    return True
            return False
        except Exception:
            return False


class UnifiedBrowserManager:
    """
    Bộ quản lý tập trung toàn bộ các trình duyệt Antidetect
    Cho phép người dùng chủ động chọn trình duyệt mong muốn (GPM, AdsPower, Dolphin, GenLogin)
    hoặc để chế độ Auto tự nhận diện.
    """
    def __init__(self):
        self.adapters: Dict[str, BaseBrowserAdapter] = {
            "gpm": GPMAdapter(),
            "adspower": AdsPowerAdapter(),
            "dolphin": DolphinAntyAdapter(),
            "genlogin": GenLoginAdapter(),
        }

    def get_active_browser(self) -> str:
        """Lấy lựa chọn trình duyệt hiện tại: 'auto', 'gpm', 'adspower', 'dolphin', 'genlogin'"""
        try:
            from backend.database import get_connection
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)")
            cursor.execute("SELECT value FROM system_settings WHERE key = 'active_browser_type'")
            row = cursor.fetchone()
            conn.close()
            if row and row["value"]:
                val = row["value"].lower().strip()
                return "gpm" if val == "auto" else val
        except Exception:
            pass
        return "gpm"

    @property
    def active_browser(self) -> str:
        """Property alias for get_active_browser()"""
        return self.get_active_browser()

    def get_active_adapter(self) -> Optional[BaseBrowserAdapter]:
        """Alias to get the currently active adapter"""
        return self.get_adapter()

    def set_active_browser(self, browser_type: str) -> bool:
        """Người dùng chọn trình duyệt cụ thể để sử dụng"""
        val = browser_type.lower().strip()
        if val not in ["auto", "gpm", "adspower", "dolphin", "genlogin"]:
            return False
        try:
            from backend.database import get_connection
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)")
            cursor.execute(
                "INSERT INTO system_settings (key, value) VALUES ('active_browser_type', ?) ON CONFLICT(key) DO UPDATE SET value = ?",
                (val, val)
            )
            conn.commit()
            conn.close()
            log_event("INFO", f"Đã chuyển sang sử dụng trình duyệt: {val.upper()}")
            return True
        except Exception as e:
            logger.error(f"Lỗi lưu lựa chọn trình duyệt: {e}")
            return False

    def get_adapter(self, browser_type: str = "gpm") -> Optional[BaseBrowserAdapter]:
        """Lấy adapter phù hợp theo chỉ định hoặc theo lựa chọn đã lưu"""
        if browser_type == "auto" or not browser_type:
            browser_type = self.get_active_browser()
        if browser_type in self.adapters:
            return self.adapters[browser_type]
        return self.adapters.get("gpm")

        if browser_type in self.adapters:
            return self.adapters[browser_type]

        return self.adapters.get("gpm")

    def scan_all_browsers(self) -> List[Dict[str, Any]]:
        """Quét và trả về trạng thái của cả 4 trình duyệt Antidetect kèm trạng thái đang được chọn"""
        active_type = self.get_active_browser()
        results = []
        for name, adapter in self.adapters.items():
            try:
                status = adapter.check_health()
                status["is_selected"] = (active_type == name)
                results.append(status)
            except Exception as e:
                results.append({
                    "browser": name,
                    "running": False,
                    "profile_count": 0,
                    "is_selected": (active_type == name),
                    "message": str(e)
                })
        return results

    def get_selected_profiles(self) -> List[Dict[str, Any]]:
        """Lấy danh sách profiles theo đúng trình duyệt người dùng đã chọn"""
        active_type = self.get_active_browser()
        if active_type == "auto":
            return self.get_all_profiles()

        adapter = self.adapters.get(active_type)
        if adapter:
            try:
                profiles = adapter.list_profiles()
                for p in profiles:
                    p["browser_type"] = active_type
                return profiles
            except Exception as e:
                logger.error(f"Lỗi lấy profile cho {active_type}: {e}")
        return []

    def get_all_profiles(self) -> List[Dict[str, Any]]:
        """Lấy gộp danh sách tất cả profile từ mọi trình duyệt đang bật"""
        all_profiles = []
        for name, adapter in self.adapters.items():
            try:
                status = adapter.check_health()
                if status.get("running"):
                    for p in adapter.list_profiles():
                        p["browser_type"] = name
                        all_profiles.append(p)
            except Exception:
                pass
        return all_profiles

    def start_profile(self, profile_id: str, browser_type: Optional[str] = None) -> Optional[str]:
        target_type = browser_type or self.get_active_browser()
        adapter = self.get_adapter(target_type)
        return adapter.start_profile(profile_id) if adapter else None

    def stop_profile(self, profile_id: str, browser_type: Optional[str] = None) -> bool:
        target_type = browser_type or self.get_active_browser()
        adapter = self.get_adapter(target_type)
        return adapter.stop_profile(profile_id) if adapter else False

browser_manager = UnifiedBrowserManager()

