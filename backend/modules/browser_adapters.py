
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
import time
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
    """Adapter cho GenLogin (Local API Port 55550 & Direct Titan Browser Engine)"""
    _launch_lock = threading.Lock()  # Class-level lock ngăn chặn launch đồng thời
    _active_processes: Dict[str, Any] = {}

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

    def _find_profile_storage(self, profile_id: str) -> Optional[str]:
        """Tìm đường dẫn thư mục lưu trữ profile trong ~/.genlogin/profiles"""
        base_dir = os.path.expanduser(r"~/.genlogin/profiles")
        if not os.path.isdir(base_dir):
            return None
        target_id = str(profile_id)
        for root, dirs, _ in os.walk(base_dir):
            for d in dirs:
                if d == target_id or d.endswith(f"_{target_id}"):
                    return os.path.join(root, d)
        return None

    def _find_titan_browser(self) -> Optional[str]:
        """Tìm đường dẫn thực thi của Titan Browser (Chromium core của GenLogin)"""
        base_dir = os.path.expanduser(r"~/.genlogin/browsers/titan")
        if not os.path.isdir(base_dir):
            return None
        for root, _, files in os.walk(base_dir):
            if "chrome.exe" in files:
                return os.path.join(root, "chrome.exe")
        return None

    def _get_free_port(self) -> int:
        """Lấy một cổng TCP tự do trên localhost"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('127.0.0.1', 0))
            return s.getsockname()[1]

    def ensure_running(self) -> bool:
        """Kiểm tra nếu GenLogin đang tắt thì tự động bật lên (thread-safe, chống launch trùng)"""
        import os, time, subprocess

        # Kiểm tra nhanh trước khi lấy lock
        if self._ping() or self._find_titan_browser():
            return True

        # Lock ngăn chặn nhiều thread cùng launch GenLogin
        if not self._launch_lock.acquire(blocking=False):
            with self._launch_lock:
                return self._ping() or bool(self._find_titan_browser())

        try:
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
                    for attempt in range(1, 10):
                        time.sleep(1)
                        if self._ping():
                            log_event("INFO", f"GenLogin đã khởi động thành công và API sẵn sàng sau {attempt}s!")
                            return True
                except Exception as e:
                    log_event("ERROR", f"Không thể tự động bật GenLogin: {e}")

            return bool(self._find_titan_browser())
        finally:
            self._launch_lock.release()

    def check_health(self) -> Dict[str, Any]:
        """Kiểm tra sức khỏe GenLogin"""
        running = self._ping()
        titan_avail = bool(self._find_titan_browser())
        is_ready = running or titan_avail
        count = len(self.list_profiles())
        msg = "GenLogin đang online (Cổng 55550)" if running else ("Titan Browser Engine sẵn sàng" if titan_avail else "GenLogin chưa bật")
        return {
            "browser": "genlogin",
            "name": "GenLogin",
            "running": is_ready,
            "profile_count": count,
            "message": msg
        }

    def list_profiles(self) -> List[Dict[str, Any]]:
        """Lấy danh sách profile từ GenLogin Local API hoặc quét từ lưu trữ nội bộ."""
        if self._ping():
            for base in [self.base_url, "http://127.0.0.1:55550", "http://localhost:55550"]:
                try:
                    offset = 0
                    limit = 50
                    all_profiles = []
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
                        pagination = res_json.get("data", {}).get("pagination", {})
                        total = pagination.get("total_items", 0)
                        if offset + limit >= total:
                            break
                        offset += limit

                    if all_profiles:
                        return all_profiles
                except Exception:
                    continue

        # Quét dự phòng từ cơ sở dữ liệu nội bộ
        try:
            from backend.database import get_connection
            conn = get_connection()
            cur = conn.cursor()
            cur.execute("SELECT gpm_id, name FROM gpm_profiles WHERE browser_type = 'genlogin'")
            db_rows = cur.fetchall()
            conn.close()
            if db_rows:
                return [
                    {
                        "id": str(r["gpm_id"]),
                        "name": r["name"] or str(r["gpm_id"]),
                        "raw_name": r["name"],
                        "group_name": "GenLogin",
                        "raw_proxy": "",
                        "browser_type": "genlogin",
                    }
                    for r in db_rows
                ]
        except Exception:
            pass

        return []

    def start_profile(self, profile_id: str) -> Optional[str]:
        """
        Khởi động profile GenLogin:
        1. Thử qua Local API cổng 55550 nếu đang mở.
        2. Nếu API không phản hồi hoặc lỗi, tự động khởi chạy trực tiếp Titan Browser Core
           với profile storage tương ứng, hỗ trợ CDP chuẩn 100%.
        """
        profile_id_str = str(profile_id)

        # 1. Thử qua Local API
        if self._ping():
            from backend.modules.genlogin_cdp_reader import get_genlogin_auth_token
            token = get_genlogin_auth_token()
            headers = {"Authorization": f"Bearer {token}"} if token else {}

            for base in [self.base_url, "http://127.0.0.1:55550", "http://localhost:55550"]:
                try:
                    url = f"{base}/backend/profiles/{profile_id_str}/start"
                    r = requests.put(url, headers=headers, json={}, timeout=20)
                    if r.status_code == 200:
                        data = r.json()
                        ws_endpoint = data.get("wsEndpoint") or data.get("data", {}).get("wsEndpoint")
                        if ws_endpoint:
                            log_event("INFO", f"GenLogin profile {profile_id_str} mở thành công qua API: {ws_endpoint}")
                            return ws_endpoint
                        port = data.get("port") or data.get("remote_debugging_port") or data.get("data", {}).get("port")
                        if port:
                            return f"127.0.0.1:{port}"
                except Exception as api_err:
                    logger.warning(f"Lỗi gọi start qua GenLogin API: {api_err}")

        # 2. Khởi chạy trực tiếp Titan Browser Core
        storage_path = self._find_profile_storage(profile_id_str)
        titan_exe = self._find_titan_browser()

        if not storage_path or not titan_exe:
            log_event("ERROR", f"Không tìm thấy thư mục lưu trữ profile GenLogin ({storage_path}) hoặc Titan Browser ({titan_exe})")
            return None

        # Đảm bảo tắt phiên cũ trước khi mở
        self.stop_profile(profile_id_str)
        time.sleep(1)

        import subprocess
        port = self._get_free_port()
        cmd = [
            titan_exe,
            f"--remote-debugging-port={port}",
            f"--user-data-dir={storage_path}",
            "--no-first-run",
            "--no-default-browser-check",
            "about:blank"
        ]

        try:
            log_event("INFO", f"Khởi chạy trực tiếp Titan Browser cho profile GenLogin {profile_id_str} tại cổng {port}...")
            proc = subprocess.Popen(cmd)
            self._active_processes[profile_id_str] = proc

            for attempt in range(1, 15):
                time.sleep(0.8)
                try:
                    r_v = requests.get(f"http://127.0.0.1:{port}/json/version", timeout=1.5)
                    if r_v.status_code == 200:
                        v_data = r_v.json()
                        ws_url = v_data.get("webSocketDebuggerUrl")
                        if ws_url:
                            log_event("INFO", f"Titan Browser profile {profile_id_str} sẵn sàng: {ws_url}")
                            return ws_url
                        return f"127.0.0.1:{port}"
                except Exception:
                    continue

            log_event("WARNING", f"Titan Browser khởi động cổng {port} nhưng chưa phản hồi sau 12s")
            return f"127.0.0.1:{port}"
        except Exception as e:
            log_event("ERROR", f"Lỗi khởi chạy Titan Browser cho GenLogin {profile_id_str}: {e}")
            return None

    def stop_profile(self, profile_id: str) -> bool:
        """Đóng profile GenLogin"""
        profile_id_str = str(profile_id)
        stopped = False

        # 1. Đóng tiến trình Titan trực tiếp nếu được quản lý
        proc = self._active_processes.pop(profile_id_str, None)
        if proc:
            try:
                proc.terminate()
                proc.wait(timeout=2)
                stopped = True
            except Exception:
                try:
                    proc.kill()
                    stopped = True
                except Exception:
                    pass

        # 2. Thử đóng qua GenLogin API nếu đang chạy
        if self._ping():
            try:
                from backend.modules.genlogin_cdp_reader import get_genlogin_auth_token
                token = get_genlogin_auth_token()
                headers = {"Authorization": f"Bearer {token}"} if token else {}
                url = f"{self.base_url}/backend/profiles/{profile_id_str}/stop"
                r = requests.put(url, headers=headers, json={}, timeout=5)
                if r.status_code == 200:
                    stopped = True
            except Exception:
                pass

        # 3. Dọn dẹp triệt để bất kỳ tiến trình Titan nào đang nắm giữ user-data-dir của profile
        try:
            storage_path = self._find_profile_storage(profile_id_str)
            if storage_path:
                norm_target = os.path.normpath(storage_path).lower()
                import subprocess, json
                cmd = 'Get-CimInstance Win32_Process -Filter "Name = \'chrome.exe\'" | Select-Object ProcessId, CommandLine | ConvertTo-Json'
                out = subprocess.check_output(['powershell', '-Command', cmd], timeout=5).decode('utf-8', errors='ignore')
                procs = json.loads(out)
                if isinstance(procs, dict): procs = [procs]
                for p in procs:
                    cmdline = (p.get('CommandLine') or '').lower()
                    if norm_target in cmdline or profile_id_str in cmdline:
                        subprocess.run(['taskkill', '/F', '/PID', str(p['ProcessId'])], capture_output=True)
                        stopped = True
        except Exception:
            pass

        return stopped


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

