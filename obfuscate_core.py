"""
Script tự động obfuscate license_manager.py và các file quan trọng bằng PyArmor.
Hỗ trợ cả PyArmor Trial (giới hạn dung lượng từng file) và PyArmor Pro/Basic.
"""
import os
import sys
import shutil
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
DIST_OBF = ROOT_DIR / "dist_obf"

def obfuscate_critical_files():
    print("=" * 60)
    print(" [ShortsStack] TIẾN HÀNH MÃ HÓA BẢN QUYỀN VỚI PYARMOR")
    print("=" * 60)

    if DIST_OBF.exists():
        shutil.rmtree(DIST_OBF, ignore_errors=True)
    DIST_OBF.mkdir(parents=True, exist_ok=True)

    target_file = ROOT_DIR / "backend" / "modules" / "license_manager.py"
    if not target_file.exists():
        print(f"[!] Không tìm thấy file: {target_file}")
        return False

    cmd = [
        sys.executable, "-m", "pyarmor.cli", "gen",
        "-O", str(DIST_OBF),
        str(target_file)
    ]

    print(f"[*] Mã hóa: {target_file.name} -> {DIST_OBF}")
    res = subprocess.run(cmd, cwd=str(ROOT_DIR))

    if res.returncode == 0:
        print("\n[OK] Mã hóa thành công! Đã tạo bytecode mã hóa và runtime C-extension (.pyd).")
        return True
    else:
        print(f"\n[!] Thất bại với returncode: {res.returncode}")
        return False

if __name__ == "__main__":
    ok = obfuscate_critical_files()
    sys.exit(0 if ok else 1)
