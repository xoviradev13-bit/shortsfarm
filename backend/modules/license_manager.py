import os
import sys
import re
import platform
import uuid
import hashlib
import json
import urllib.request
import urllib.error
from datetime import datetime
from typing import Dict, Any, Optional, Tuple

from backend.config import APP_VERSION, LICENSE_PORTAL_URL, FALLBACK_PORTAL_URL
from backend.database import get_setting, set_setting

PLAN_NAMES: Dict[str, str] = {
    "pro_1pc": "Gói Cá Nhân (1 PC - Vĩnh Viễn)",
    "studio_3pc": "Gói Studio (3 PCs - Vĩnh Viễn)",
    "agency_5pc": "Gói Agency (5 PCs - Vĩnh Viễn)",
    "lifetime": "Gói Agency (5 PCs - Vĩnh Viễn)",
    "yearly": "Gói Studio (3 PCs - Vĩnh Viễn)",
    "monthly": "Gói Cá Nhân (1 PC - Vĩnh Viễn)",
    "trial": "Gói Dùng Thử Nghiệm",
}

def get_hwid() -> str:
    """
    Sinh mã định danh phần cứng (Hardware ID - HWID) bất biến của máy tính.
    Trên Windows: Ưu tiên đọc MachineGuid từ Windows Registry Cryptography.
    Dự phòng: Lấy UUID từ WMIC hoặc MAC Address băm SHA256.
    """
    if sys.platform == "win32":
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography") as key:
                guid, _ = winreg.QueryValueEx(key, "MachineGuid")
                if guid and len(guid.strip()) > 8:
                    return f"SS-{guid.strip().upper()}"
        except Exception:
            pass

    # Fallback chuẩn hóa nếu không đọc được Registry hoặc trên macOS/Linux
    node_str = f"{platform.node()}-{uuid.getnode()}"
    digest = hashlib.sha256(node_str.encode("utf-8")).hexdigest()[:24].upper()
    return f"SS-{digest[:8]}-{digest[8:16]}-{digest[16:24]}"

def get_device_name() -> str:
    """Lấy tên hiển thị của máy tính (ví dụ: DESKTOP-314C4N7)"""
    return os.environ.get("COMPUTERNAME") or platform.node() or "Windows-PC"

def _make_http_request(url: str, method: str = "GET", data: Optional[dict] = None, timeout: int = 8) -> Tuple[int, dict]:
    """Helper gửi HTTP request không phụ thuộc external libraries (dùng urllib chuẩn của Python)"""
    headers = {
        "User-Agent": f"ShortsStack-Desktop/{APP_VERSION} ({platform.system()}; {get_device_name()})",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    encoded_data = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            res_body = res.read().decode("utf-8")
            try:
                parsed = json.loads(res_body)
            except Exception:
                parsed = {"raw": res_body}
            return res.status, parsed
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(err_body)
        except Exception:
            parsed = {"error": err_body}
        return e.code, parsed
    except Exception as e:
        return 0, {"error": f"Không thể kết nối đến máy chủ xác thực: {str(e)}"}

def _get_portal_urls() -> list:
    urls = []
    if LICENSE_PORTAL_URL:
        urls.append(LICENSE_PORTAL_URL.rstrip("/"))
    if FALLBACK_PORTAL_URL and FALLBACK_PORTAL_URL not in urls:
        urls.append(FALLBACK_PORTAL_URL.rstrip("/"))
    return urls

def get_license_info() -> Dict[str, Any]:
    """Lấy toàn bộ thông tin bản quyền và trạng thái hiện tại trên máy"""
    hwid = get_hwid()
    device_name = get_device_name()
    key = get_setting("license_key", "").strip().upper()
    status = get_setting("license_status", "unlicensed")
    plan = get_setting("license_plan", "unlicensed")
    expires_at_str = get_setting("license_expires_at", "")
    max_devices_str = get_setting("license_max_devices", "1")
    email = get_setting("license_customer_email", "")
    last_verified = get_setting("license_last_verified", "")
    signature = get_setting("license_signature", "")

    try:
        max_devices = int(max_devices_str)
    except Exception:
        max_devices = 1

    is_expired = False
    if plan in ("pro_1pc", "studio_3pc", "agency_5pc", "lifetime", "yearly", "monthly") and (not expires_at_str or expires_at_str == "lifetime"):
        expires_display = "Vĩnh viễn (Trọn đời)"
    elif expires_at_str:
        try:
            exp_date = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
            now = datetime.now(exp_date.tzinfo) if exp_date.tzinfo else datetime.now()
            delta = exp_date - now
            remaining_days = delta.days
            if exp_date < now:
                is_expired = True
                status = "expired"
                expires_display = f"{exp_date.strftime('%d/%m/%Y')} (Đã hết hạn)"
            else:
                if remaining_days <= 0:
                    expires_display = f"{exp_date.strftime('%d/%m/%Y')} (Hết hạn hôm nay)"
                elif remaining_days == 1:
                    expires_display = f"{exp_date.strftime('%d/%m/%Y')} (Còn 1 ngày)"
                else:
                    expires_display = f"{exp_date.strftime('%d/%m/%Y')} (Còn {remaining_days} ngày)"
        except Exception:
            expires_display = expires_at_str
    elif plan == "trial":
        expires_display = "Dùng Thử 3 Ngày"
    else:
        expires_display = "Vĩnh viễn (Trọn đời)" if status == "active" else "—"

    # Chống giả mạo CSDL cục bộ (Tamper Resistance):
    # Nếu key có trong DB nhưng không có chữ ký số hợp lệ từ server
    is_tampered = bool(key) and status == "active" and not signature
    if is_tampered:
        status = "invalid"

    is_active = (bool(key) and status == "active" and not is_expired and not is_tampered)

    return {
        "hwid": hwid,
        "device_name": device_name,
        "app_version": APP_VERSION,
        "license_key": key,
        "is_active": is_active,
        "status": status if bool(key) else "unlicensed",
        "plan": plan,
        "plan_display": PLAN_NAMES.get(plan, "Gói Bản Quyền" if is_active else "Chưa Kích Hoạt"),
        "expires_at": expires_at_str,
        "expires_display": expires_display,
        "max_devices": max_devices,
        "customer_email": email,
        "last_verified": last_verified,
        "signature": signature,
        "is_tampered": is_tampered,
    }

def activate_license(license_key: str) -> Dict[str, Any]:
    """
    Kích hoạt License Key trực tiếp với Web Portal:
    - Gửi kèm HWID, tên thiết bị và phiên bản app
    - Nếu thành công, lưu bản quyền vào CSDL cục bộ
    """
    clean_key = license_key.strip().upper()
    if not clean_key:
        return {"success": False, "message": "Vui lòng nhập mã bản quyền (License Key)."}

    hwid = get_hwid()
    device_name = get_device_name()
    payload = {
        "license_key": clean_key,
        "hwid": hwid,
        "device_name": device_name,
        "app_version": APP_VERSION,
    }

    last_error = ""
    for portal in _get_portal_urls():
        url = f"{portal}/api/license/activate"
        status_code, resp = _make_http_request(url, method="POST", data=payload)

        if status_code == 200 and resp.get("success"):
            lic_data = resp.get("license", {})
            plan = lic_data.get("plan") or resp.get("plan") or "monthly"
            expires_at = lic_data.get("expiresAt") or lic_data.get("expires_at") or resp.get("expiresAt") or ""
            max_dev = str(lic_data.get("maxDevices") or resp.get("maxDevices") or 1)
            customer_email = lic_data.get("customerEmail") or resp.get("customerEmail") or ""

            # Lưu vào Database máy
            sig = lic_data.get("signature") or resp.get("signature") or ""
            set_setting("license_key", clean_key)
            set_setting("license_status", "active")
            set_setting("license_plan", plan)
            set_setting("license_expires_at", str(expires_at) if expires_at else "")
            set_setting("license_max_devices", max_dev)
            set_setting("license_customer_email", customer_email)
            set_setting("license_last_verified", datetime.now().isoformat())
            set_setting("license_signature", sig)

            return {
                "success": True,
                "message": resp.get("message") or "Kích hoạt bản quyền thành công!",
                "plan": plan,
                "plan_display": PLAN_NAMES.get(plan, plan),
                "expires_at": expires_at,
                "max_devices": int(max_dev),
                "hwid": hwid,
            }
        elif status_code in (400, 403, 404) and isinstance(resp, dict) and ("success" in resp or "message" in resp):
            # Lỗi phản hồi nghiệp vụ từ máy chủ bản quyền (ví dụ vượt quá số máy, key sai, hết hạn)
            msg = resp.get("message") or resp.get("error") or "Không thể kích hoạt mã bản quyền này."
            return {"success": False, "message": msg, "status_code": status_code}
        else:
            last_error = resp.get("error") or resp.get("message") or f"Mã phản hồi: {status_code}"

    return {
        "success": False,
        "message": f"Không thể kết nối đến máy chủ kích hoạt. Chi tiết: {last_error}",
    }

def verify_license(force_remote: bool = False) -> Dict[str, Any]:
    """
    Xác thực bản quyền:
    - Kiểm tra cache nội bộ nếu vừa kiểm tra gần đây
    - Gửi request tới /api/license/verify để đảm bảo key không bị khóa / thu hồi
    """
    info = get_license_info()
    if not info["license_key"]:
        return {"valid": False, "status": "unlicensed", "message": "Chưa kích hoạt bản quyền."}

    # Nếu không bắt buộc gọi remote và đã kiểm tra trong vòng 6 tiếng gần nhất
    if not force_remote and info["last_verified"]:
        try:
            last_dt = datetime.fromisoformat(info["last_verified"])
            if (datetime.now() - last_dt).total_seconds() < 21600 and info["is_active"]:
                return {"valid": True, "status": info["status"], "cached": True}
        except Exception:
            pass

    hwid = info["hwid"]
    payload = {
        "license_key": info["license_key"],
        "hwid": hwid,
    }

    for portal in _get_portal_urls():
        url = f"{portal}/api/license/verify"
        status_code, resp = _make_http_request(url, method="POST", data=payload)

        if status_code == 200 and resp.get("valid"):
            set_setting("license_status", "active")
            set_setting("license_last_verified", datetime.now().isoformat())
            exp = resp.get("expires_at") or resp.get("expiresAt") or ""
            if exp:
                set_setting("license_expires_at", str(exp))
            p = resp.get("plan")
            if p:
                set_setting("license_plan", str(p))
            max_d = resp.get("max_devices") or resp.get("maxDevices")
            if max_d:
                set_setting("license_max_devices", str(max_d))
            sig = resp.get("signature") or ""
            if sig:
                set_setting("license_signature", sig)
            return {"valid": True, "status": "active", "message": "Bản quyền hợp lệ."}
        elif status_code in (403, 404):
            # Đã bị khóa, hết hạn hoặc vượt quá số máy trên hệ thống
            msg = resp.get("message") or "Bản quyền không còn hợp lệ trên máy tính này."
            new_status = "suspended" if "khóa" in msg.lower() else "expired" if "hạn" in msg.lower() else "unbound"
            set_setting("license_status", new_status)
            return {"valid": False, "status": new_status, "message": msg}

    # Khi không có mạng: Cho phép grace period 7 ngày nếu trước đó đã active
    if info["is_active"] and info["last_verified"]:
        try:
            last_dt = datetime.fromisoformat(info["last_verified"])
            if (datetime.now() - last_dt).days <= 7:
                return {
                    "valid": True,
                    "status": "active",
                    "offline_grace": True,
                    "message": "Đang chạy chế độ offline tạm thời.",
                }
        except Exception:
            pass

    return {
        "valid": False,
        "status": info["status"],
        "message": "Không thể kết nối đến máy chủ để xác thực bản quyền.",
    }

def deactivate_license() -> Dict[str, Any]:
    """Hủy liên kết key khỏi máy tính này và đồng bộ máy chủ để có thể kích hoạt trên máy tính khác"""
    key = get_setting("license_key", "").strip().upper()
    hwid = get_hwid()

    # Gửi yêu cầu gỡ HWID này khỏi máy chủ Web Portal
    if key and hwid:
        payload = {"license_key": key, "hwid": hwid}
        for portal in _get_portal_urls():
            try:
                url = f"{portal}/api/license/deactivate"
                st, resp = _make_http_request(url, method="POST", data=payload, timeout=6)
                if st == 200 and resp.get("success"):
                    break
            except Exception:
                pass

    set_setting("license_key", "")
    set_setting("license_status", "unlicensed")
    set_setting("license_plan", "unlicensed")
    set_setting("license_expires_at", "")
    set_setting("license_customer_email", "")
    set_setting("license_last_verified", "")
    set_setting("license_signature", "")
    return {"success": True, "message": "Đã hủy kích hoạt bản quyền trên máy này. Key đã sẵn sàng để dùng trên máy khác."}

def _parse_semver(v: str) -> Tuple[int, ...]:
    nums = re.findall(r"\d+", str(v))
    return tuple(int(x) for x in nums) if nums else (0, 0, 0)

def check_app_update() -> Dict[str, Any]:
    """
    Kiểm tra bản cập nhật mới từ server (/api/version):
    So sánh latest_version với APP_VERSION hiện tại
    """
    for portal in _get_portal_urls():
        url = f"{portal}/api/version"
        status_code, resp = _make_http_request(url, method="GET")

        if status_code == 200:
            latest_version = resp.get("latest_version") or resp.get("version") or APP_VERSION
            download_url = resp.get("download_url") or ""
            release_notes = resp.get("release_notes") or ""
            file_size_mb = resp.get("file_size_mb") or 85
            is_mandatory = bool(resp.get("is_mandatory", False))

            current_tuple = _parse_semver(APP_VERSION)
            latest_tuple = _parse_semver(latest_version)
            update_available = latest_tuple > current_tuple

            return {
                "success": True,
                "current_version": APP_VERSION,
                "latest_version": latest_version,
                "update_available": update_available,
                "download_url": download_url,
                "release_notes": release_notes,
                "file_size_mb": file_size_mb,
                "is_mandatory": is_mandatory,
            }

    return {
        "success": False,
        "current_version": APP_VERSION,
        "latest_version": APP_VERSION,
        "update_available": False,
        "message": "Không thể kiểm tra bản cập nhật lúc này.",
    }
