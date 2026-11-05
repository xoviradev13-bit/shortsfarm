import os
import sys
import time
import json
import zipfile
import subprocess
import requests
from pathlib import Path

CURRENT_VERSION = "2.1.0"
VERSION_API_URL = os.environ.get("LICENSE_SERVER_URL", "https://tiktokfarm.vercel.app").rstrip("/") + "/api/version"

def print_banner():
    print("=" * 60)
    print(f"      TIKTOKFARM AI STUDIO - LAUNCHER & AUTO-UPDATER")
    print(f"                 Phiên bản hiện tại: v{CURRENT_VERSION}")
    print("=" * 60)

def check_for_updates() -> dict:
    """Kiểm tra bản cập nhật từ máy chủ Vercel"""
    try:
        print("[1/3] Đang kiểm tra bản cập nhật mới từ máy chủ...", end="", flush=True)
        r = requests.get(VERSION_API_URL, timeout=4)
        if r.status_code == 200:
            data = r.json()
            latest = data.get("latest_version")
            if latest and latest != CURRENT_VERSION:
                print(" -> [PHÁT HIỆN BẢN MỚI!]")
                return data
        print(" -> [ĐÃ LÀ BẢN MỚI NHẤT]")
    except Exception as e:
        print(f" -> [Bỏ qua (Không có mạng hoặc máy chủ đang khởi động)]")
    return {}

def download_and_apply_update(update_info: dict) -> bool:
    """Tải và thực hiện cập nhật tự động"""
    url = update_info.get("download_url")
    latest_ver = update_info.get("latest_version")
    if not url:
        return False

    print(f"\n[2/3] Bắt đầu tải bản cập nhật v{latest_ver}...")
    print(f"      Nội dung: {update_info.get('release_notes', 'Nâng cấp tính năng mới')}")

    temp_dir = Path(os.environ.get("TEMP", "."))
    filename = url.split("?")[0].split("/")[-1] or f"update_{latest_ver}.exe"
    target_file = temp_dir / filename

    try:
        with requests.get(url, stream=True, timeout=60) as r:
            r.raise_for_status()
            total_size = int(r.headers.get("content-length", 0))
            downloaded = 0
            with open(target_file, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 64):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            percent = int(downloaded * 100 / total_size)
                            print(f"\r      Tiến trình tải: {percent}% ({downloaded // (1024*1024)}MB / {total_size // (1024*1024)}MB)", end="", flush=True)
        print("\n      Tải hoàn tất!")

        # Nếu là file cài đặt Setup .exe -> Chạy im lặng (Silent Install)
        if target_file.suffix.lower() == ".exe":
            print("[3/3] Đang tiến hành cài đặt bản vá tự động...")
            cmd = f'"{target_file}" /SILENT /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS'
            subprocess.Popen(cmd, shell=True)
            print("      Đang khởi động lại ứng dụng với phiên bản mới...")
            sys.exit(0)

        # Nếu là file .zip -> Giải nén ghi đè mã nguồn
        elif target_file.suffix.lower() == ".zip":
            print("[3/3] Đang giải nén ghi đè bản vá...")
            app_dir = Path(__file__).resolve().parent
            with zipfile.ZipFile(target_file, "r") as z:
                z.extractall(app_dir)
            print("      Bản vá đã được áp dụng thành công!")
            return True

    except Exception as e:
        print(f"\n[LỖI CẬP NHẬT]: {e}")
    return False

def verify_license() -> bool:
    """Xác thực bản quyền trước khi mở ứng dụng chính"""
    try:
        from backend.modules.license_client import LicenseClient
        client = LicenseClient()
        res = client.verify_on_startup()
        if res.get("valid"):
            print(f"[OK] Bản quyền hợp lệ: Khách hàng '{res.get('customer_name', 'User')}' ({res.get('plan', 'Pro')})")
            return True
        else:
            print("\n" + "!" * 60)
            print(" [THÔNG BÁO BẢN QUYỀN]:")
            print(f" {res.get('message', 'Chưa có bản quyền hợp lệ!')}")
            print(f" Mã máy tính (HWID) của bạn: {res.get('hwid')}")
            print("!" * 60)
            
            # Cho phép nhập key trực tiếp tại màn hình launcher
            key = input("\nNhập mã License Key của bạn để kích hoạt (hoặc nhấn Enter để thoát): ").strip()
            if key:
                act = client.activate(key)
                if act.get("success"):
                    print("[CHÚC MỪNG] Kích hoạt bản quyền thành công!")
                    time.sleep(1.5)
                    return True
                else:
                    print(f"[THẤT BẠI]: {act.get('message')}")
                    time.sleep(3)
                    return False
            return False
    except Exception as e:
        # Nếu đang ở môi trường dev chưa có config server
        return True

def launch_main_app():
    """Khởi động ứng dụng chính"""
    print("\n[OK] Đang khởi động hệ thống TikTokFarm Studio...")
    main_py = Path(__file__).resolve().parent / "main.py"
    
    if getattr(sys, "frozen", False):
        # Nếu đã build thành file .exe
        app_exe = Path(sys.executable).parent / "TikTokFarm.exe"
        if app_exe.exists():
            subprocess.Popen([str(app_exe)])
            sys.exit(0)

    # Chạy qua python
    os.system(f'"{sys.executable}" "{main_py}"')

if __name__ == "__main__":
    print_banner()
    update_data = check_for_updates()
    if update_data:
        download_and_apply_update(update_data)

    if verify_license():
        launch_main_app()

