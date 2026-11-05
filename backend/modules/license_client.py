import os
import json
import hashlib
import subprocess
import requests
from typing import Dict, Any, Optional

# URL của Web Portal triển khai trên Vercel
# Khi deploy lên Vercel, bạn chỉ cần thay bằng domain của mình (ví dụ: https://tiktokfarm.vercel.app)
DEFAULT_PORTAL_URL = "https://tiktokfarm.vercel.app"

LICENSE_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "data", "license.json")

def get_machine_hwid() -> str:
    """
    Tạo mã định danh phần cứng (Hardware ID - HWID) duy nhất của máy tính
    Dựa trên UUID bo mạch chủ + ID vi xử lý CPU
    """
    raw_id = ""
    try:
        # Lấy UUID bo mạch chủ Windows
        cmd = 'powershell -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"'
        out = subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.DEVNULL).strip()
        if out:
            raw_id += out
    except Exception:
        pass

    try:
        # Lấy CPU ID
        cmd = 'powershell -Command "(Get-CimInstance Win32_Processor).ProcessorId"'
        out = subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.DEVNULL).strip()
        if out:
            raw_id += f":{out}"
    except Exception:
        pass

    if not raw_id:
        # Fallback theo tên máy tính và user profile nếu không truy cập được WMI
        raw_id = f"{os.environ.get('COMPUTERNAME', 'PC')}:{os.environ.get('USERNAME', 'USER')}"

    return hashlib.sha256(raw_id.encode('utf-8')).hexdigest()[:32].upper()

class LicenseClient:
    def __init__(self, portal_url: str = DEFAULT_PORTAL_URL):
        self.portal_url = os.environ.get("LICENSE_SERVER_URL", portal_url).rstrip("/")
        self.hwid = get_machine_hwid()

    def load_local_license(self) -> Optional[Dict[str, Any]]:
        """Đọc key đã lưu trong máy"""
        if os.path.exists(LICENSE_FILE_PATH):
            try:
                with open(LICENSE_FILE_PATH, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return None
        return None

    def save_local_license(self, data: Dict[str, Any]):
        """Lưu key và trạng thái kích hoạt vào máy"""
        os.makedirs(os.path.dirname(LICENSE_FILE_PATH), exist_ok=True)
        with open(LICENSE_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def activate(self, license_key: str) -> Dict[str, Any]:
        """Kích hoạt bản quyền qua Vercel/Supabase Server"""
        url = f"{self.portal_url}/api/license/activate"
        payload = {
            "license_key": license_key.strip().toUpperCase() if hasattr(license_key, 'toUpperCase') else license_key.strip().upper(),
            "hwid": self.hwid,
            "device_name": os.environ.get("COMPUTERNAME", "Windows PC"),
            "app_version": "2.1.0"
        }

        try:
            res = requests.post(url, json=payload, timeout=10)
            data = res.json()
            if res.status_code == 200 and data.get("success"):
                save_data = {
                    "license_key": license_key.strip().upper(),
                    "hwid": self.hwid,
                    "plan": data.get("data", {}).get("plan"),
                    "customer_name": data.get("data", {}).get("customer_name"),
                    "expires_at": data.get("data", {}).get("expires_at"),
                }
                self.save_local_license(save_data)
                return {"success": True, "message": "Kích hoạt thành công!", "data": save_data}
            else:
                return {"success": False, "message": data.get("message", "Kích hoạt thất bại")}
        except Exception as e:
            return {"success": False, "message": f"Không thể kết nối máy chủ kích hoạt: {str(e)}"}

    def verify_on_startup(self) -> Dict[str, Any]:
        """Kiểm tra bản quyền khi ứng dụng khởi động"""
        local_data = self.load_local_license()
        if not local_data or not local_data.get("license_key"):
            return {
                "valid": False,
                "message": "Chưa kích hoạt bản quyền. Vui lòng nhập License Key!",
                "hwid": self.hwid
            }

        url = f"{self.portal_url}/api/license/verify"
        payload = {
            "license_key": local_data["license_key"],
            "hwid": self.hwid
        }

        try:
            res = requests.post(url, json=payload, timeout=7)
            data = res.json()
            if res.status_code == 200 and data.get("valid"):
                return {
                    "valid": True,
                    "plan": data.get("plan"),
                    "expires_at": data.get("expires_at"),
                    "customer_name": data.get("customer_name")
                }
            else:
                return {
                    "valid": False,
                    "message": data.get("message", "Bản quyền không hợp lệ hoặc đã hết hạn!"),
                    "hwid": self.hwid
                }
        except Exception:
            # Cho phép Grace Period (chế độ tạm chạy khi mạng chập chờn nếu đã từng kích hoạt)
            return {
                "valid": True,
                "offline_mode": True,
                "plan": local_data.get("plan", "pro"),
                "customer_name": local_data.get("customer_name")
            }

    def check_updates(self, current_version: str = "2.1.0") -> Dict[str, Any]:
        """Kiểm tra có bản cập nhật mới trên Vercel không"""
        url = f"{self.portal_url}/api/version"
        try:
            res = requests.get(url, timeout=5)
            if res.status_code == 200:
                data = res.json()
                latest = data.get("latest_version", current_version)
                has_update = latest != current_version
                return {
                    "has_update": has_update,
                    "latest_version": latest,
                    "download_url": data.get("download_url"),
                    "release_notes": data.get("release_notes"),
                    "is_mandatory": data.get("is_mandatory", False)
                }
        except Exception:
            pass
        return {"has_update": False}

