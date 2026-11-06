import os
from typing import Dict, Any, Optional
from backend.modules.license_manager import (
    get_hwid as get_machine_hwid,
    get_license_info,
    activate_license as do_activate,
    verify_license as do_verify,
    check_app_update as do_check_update,
    deactivate_license as do_deactivate,
)

class LicenseClient:
    def __init__(self, portal_url: Optional[str] = None):
        self.hwid = get_machine_hwid()

    def load_local_license(self) -> Optional[Dict[str, Any]]:
        info = get_license_info()
        return info if info.get("license_key") else None

    def activate(self, license_key: str) -> Dict[str, Any]:
        return do_activate(license_key)

    def verify_on_startup(self) -> Dict[str, Any]:
        res = do_verify(force_remote=False)
        info = get_license_info()
        return {
            "valid": res.get("valid", False),
            "message": res.get("message", ""),
            "hwid": self.hwid,
            "plan": info.get("plan"),
            "expires_at": info.get("expires_at"),
            "customer_name": info.get("customer_email"),
        }

    def check_updates(self, current_version: str = "1.0.0") -> Dict[str, Any]:
        res = do_check_update()
        return {
            "has_update": res.get("update_available", False),
            "latest_version": res.get("latest_version"),
            "download_url": res.get("download_url"),
            "release_notes": res.get("release_notes"),
            "is_mandatory": res.get("is_mandatory", False),
        }
