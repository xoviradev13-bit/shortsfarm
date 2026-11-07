import os
import sys
import logging
from logging.handlers import RotatingFileHandler
import threading
from pathlib import Path
from typing import List, Dict, Any, Optional
import datetime
import re

from backend.config import BASE_DIR, DATA_DIR

LOGS_DIR = DATA_DIR / "logs"
LOG_FILE_PATH = LOGS_DIR / "app.log"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# Formatters
FILE_LOG_FORMAT = "%(asctime)s [%(levelname)-7s] [%(name)s:%(lineno)d] [%(threadName)s] - %(message)s"
CONSOLE_LOG_FORMAT = "%(asctime)s [%(levelname)-7s] %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

class DailyLogFileHandler(logging.Handler):
    """
    Handler ghi log vào file nhật ký theo từng ngày riêng biệt: app_YYYY-MM-DD.log.
    Tự động chuyển file khi bước sang ngày mới.
    Đảm bảo thread-safe khi ghi từ nhiều luồng nền (background tasks/threads).
    """
    def __init__(self, logs_dir: Path, prefix: str = "app_", encoding: str = "utf-8"):
        super().__init__()
        self.logs_dir = Path(logs_dir)
        self.prefix = prefix
        self.encoding = encoding
        self._current_date: Optional[str] = None
        self._file_handler: Optional[logging.FileHandler] = None
        self._lock = threading.Lock()

    def setFormatter(self, fmt: Optional[logging.Formatter]):
        super().setFormatter(fmt)
        with self._lock:
            if self._file_handler:
                self._file_handler.setFormatter(fmt)

    def _get_daily_handler(self, date_str: str) -> logging.FileHandler:
        if self._file_handler is None or self._current_date != date_str:
            if self._file_handler:
                try:
                    self._file_handler.flush()
                    self._file_handler.close()
                except Exception:
                    pass
            self._current_date = date_str
            daily_file = self.logs_dir / f"{self.prefix}{date_str}.log"
            self._file_handler = logging.FileHandler(
                filename=str(daily_file),
                mode="a",
                encoding=self.encoding,
                delay=False
            )
            if self.formatter:
                self._file_handler.setFormatter(self.formatter)
            try:
                cleanup_old_daily_logs(retention_days=30)
            except Exception:
                pass
        return self._file_handler

    def emit(self, record: logging.LogRecord):
        try:
            date_str = datetime.datetime.fromtimestamp(record.created).strftime("%Y-%m-%d")
            with self._lock:
                h = self._get_daily_handler(date_str)
                h.emit(record)
        except Exception:
            self.handleError(record)

    def flush(self):
        with self._lock:
            if self._file_handler:
                try:
                    self._file_handler.flush()
                except Exception:
                    pass

    def close(self):
        with self._lock:
            if self._file_handler:
                try:
                    self._file_handler.flush()
                    self._file_handler.close()
                except Exception:
                    pass
                self._file_handler = None
        super().close()

def split_existing_app_log(logs_dir: Path, app_log_path: Path):
    """
    Tách nội dung app.log cũ thành các file app_YYYY-MM-DD.log tương ứng với từng ngày.
    Giữ nguyên hoàn toàn file app.log gốc.
    """
    if not app_log_path.exists():
        return
    marker_file = logs_dir / ".daily_split_done"
    if marker_file.exists():
        return

    date_pattern = re.compile(r"^(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}:\d{2}")
    current_date = None
    date_buffers: Dict[str, List[str]] = {}

    try:
        with open(app_log_path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                m = date_pattern.match(line)
                if m:
                    current_date = m.group(1)
                if current_date:
                    if current_date not in date_buffers:
                        date_buffers[current_date] = []
                    date_buffers[current_date].append(line)

        for d_str, lines in date_buffers.items():
            target_path = logs_dir / f"app_{d_str}.log"
            if not target_path.exists():
                with open(target_path, "w", encoding="utf-8") as out_f:
                    out_f.writelines(lines)

        marker_file.touch()
    except Exception as e:
        print(f"[LOG SPLIT ERROR] Cannot split historical logs: {e}", file=sys.stderr)

def cleanup_old_daily_logs(retention_days: int = 30) -> int:
    """
    Tự động dọn dẹp các file log theo ngày (app_YYYY-MM-DD.log) cũ hơn retention_days (mặc định 30 ngày).
    Chỉ giữ lại nhật ký của tối đa 30 ngày gần nhất và tự động xóa các file > 30 ngày trước.
    """
    if not LOGS_DIR.exists():
        return 0

    pattern = re.compile(r"^app_(\d{4}-\d{2}-\d{2})\.log$")
    today = datetime.date.today()
    deleted_count = 0

    try:
        daily_files = []
        for f in LOGS_DIR.glob("app_*.log"):
            m = pattern.match(f.name)
            if m:
                d_str = m.group(1)
                try:
                    f_date = datetime.date.fromisoformat(d_str)
                    daily_files.append((f, f_date))
                except ValueError:
                    pass

        # Sắp xếp từ ngày mới nhất tới cũ nhất
        daily_files.sort(key=lambda x: x[1], reverse=True)

        for idx, (file_path, file_date) in enumerate(daily_files):
            age_days = (today - file_date).days
            # Xóa nếu ngày đã qua > retention_days hoặc nằm ngoài top 30 ngày gần nhất
            if age_days > retention_days or idx >= retention_days:
                try:
                    file_path.unlink(missing_ok=True)
                    deleted_count += 1
                except Exception as e:
                    print(f"[CLEANUP LOG ERROR] Cannot remove {file_path.name}: {e}", file=sys.stderr)

        if deleted_count > 0:
            _logger.info(f"[LOG RETENTION] Đã tự động dọn dẹp {deleted_count} file log cũ (> {retention_days} ngày).")
    except Exception as e:
        print(f"[CLEANUP LOG ERROR] {e}", file=sys.stderr)

    return deleted_count

# Configure root app logger
_logger = logging.getLogger("shortsstack")
_logger.setLevel(logging.DEBUG)

# Ensure handlers are set up
if not _logger.handlers:
    # 1. Rotating File Handler (10MB per file, keep 5 backups, UTF-8 encoded) cho app.log tổng
    try:
        file_handler = RotatingFileHandler(
            filename=str(LOG_FILE_PATH),
            mode="a",
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
            encoding="utf-8",
            delay=False
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(logging.Formatter(FILE_LOG_FORMAT, datefmt=DATE_FORMAT))
        _logger.addHandler(file_handler)
    except Exception as e:
        print(f"[LOGGER INIT ERROR] Cannot create file handler: {e}", file=sys.stderr)

    # 2. Daily Log File Handler (app_YYYY-MM-DD.log) cho từng ngày riêng biệt
    try:
        daily_handler = DailyLogFileHandler(
            logs_dir=LOGS_DIR,
            prefix="app_",
            encoding="utf-8"
        )
        daily_handler.setLevel(logging.DEBUG)
        daily_handler.setFormatter(logging.Formatter(FILE_LOG_FORMAT, datefmt=DATE_FORMAT))
        _logger.addHandler(daily_handler)
    except Exception as e:
        print(f"[LOGGER INIT ERROR] Cannot create daily handler: {e}", file=sys.stderr)

    # 3. Console Stream Handler
    try:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(logging.Formatter(CONSOLE_LOG_FORMAT, datefmt=DATE_FORMAT))
        _logger.addHandler(console_handler)
    except Exception as e:
        print(f"[LOGGER INIT ERROR] Cannot create console handler: {e}", file=sys.stderr)
else:
    # Đảm bảo daily_handler luôn được thêm nếu handlers đã khởi tạo từ trước
    if not any(isinstance(h, DailyLogFileHandler) for h in _logger.handlers):
        try:
            daily_handler = DailyLogFileHandler(logs_dir=LOGS_DIR, prefix="app_", encoding="utf-8")
            daily_handler.setLevel(logging.DEBUG)
            daily_handler.setFormatter(logging.Formatter(FILE_LOG_FORMAT, datefmt=DATE_FORMAT))
            _logger.addHandler(daily_handler)
        except Exception as e:
            print(f"[LOGGER INIT ERROR] Cannot add daily handler: {e}", file=sys.stderr)

# Tách log lịch sử một lần duy nhất nếu chưa tách
split_existing_app_log(LOGS_DIR, LOG_FILE_PATH)

# Tự động dọn dẹp các file log cũ > 30 ngày
cleanup_old_daily_logs(30)

def get_logger(name: Optional[str] = None) -> logging.Logger:
    """Trả về logger chuẩn cho module tương ứng"""
    if not name:
        return _logger
    return _logger.getChild(name)

# Shorthand logging helpers
def log_debug(msg: str, *args, **kwargs):
    _logger.debug(msg, *args, **kwargs)

def log_info(msg: str, *args, **kwargs):
    _logger.info(msg, *args, **kwargs)

def log_warning(msg: str, *args, **kwargs):
    _logger.warning(msg, *args, **kwargs)

def log_error(msg: str, *args, **kwargs):
    _logger.error(msg, *args, **kwargs)

def log_exception(msg: str, *args, **kwargs):
    """Ghi lại lỗi kèm toàn bộ stack trace vào file log"""
    _logger.exception(msg, *args, **kwargs)

# Hook uncaught exceptions to log file
def _handle_uncaught_exception(exc_type, exc_value, exc_traceback):
    if issubclass(exc_type, KeyboardInterrupt):
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
        return
    _logger.critical(
        f"UNCAUGHT EXCEPTION in Main Thread: {exc_type.__name__}: {exc_value}",
        exc_info=(exc_type, exc_value, exc_traceback)
    )

sys.excepthook = _handle_uncaught_exception

# Suppress noisy Windows asyncio ProactorEventLoop errors (ConnectionResetError [WinError 10054])
if sys.platform == "win32":
    logging.getLogger("asyncio").setLevel(logging.CRITICAL)

if hasattr(threading, "excepthook"):
    def _handle_thread_exception(args):
        if issubclass(args.exc_type, KeyboardInterrupt):
            return
        thread_name = args.thread.name if args.thread else "UnknownThread"
        _logger.critical(
            f"UNCAUGHT EXCEPTION in Thread [{thread_name}]: {args.exc_type.__name__}: {args.exc_value}",
            exc_info=(args.exc_type, args.exc_value, args.exc_traceback)
        )
    threading.excepthook = _handle_thread_exception

def get_daily_log_path(date_str: Optional[str] = None) -> Path:
    """Trả về đường dẫn file log của một ngày cụ thể (mặc định là hôm nay: app_YYYY-MM-DD.log)"""
    if not date_str or date_str.lower() == "today":
        date_str = datetime.date.today().strftime("%Y-%m-%d")
    return LOGS_DIR / f"app_{date_str}.log"

def resolve_log_file(target_file: Optional[str] = None, target_date: Optional[str] = None) -> Path:
    """
    Xác định an toàn đường dẫn file log từ tên file hoặc ngày tháng.
    Ngăn chặn Path Traversal và trả về file hợp lệ.
    """
    today_str = datetime.date.today().strftime("%Y-%m-%d")

    # 1. Nếu có chỉ định target_file
    if target_file:
        clean_name = os.path.basename(target_file).strip()
        if clean_name.lower() in ("all", "app.log", "total", "total.log"):
            return LOG_FILE_PATH
        if clean_name.lower() == "today":
            today_file = get_daily_log_path(today_str)
            return today_file if today_file.exists() else LOG_FILE_PATH
        candidate = LOGS_DIR / clean_name
        if candidate.name.startswith("app_") and candidate.name.endswith(".log"):
            return candidate
        if candidate == LOG_FILE_PATH:
            return LOG_FILE_PATH

    # 2. Nếu có chỉ định target_date
    if target_date:
        clean_date = target_date.strip().lower()
        if clean_date in ("all", "total"):
            return LOG_FILE_PATH
        if clean_date == "today":
            today_file = get_daily_log_path(today_str)
            return today_file if today_file.exists() else LOG_FILE_PATH
        if re.match(r"^\d{4}-\d{2}-\d{2}$", clean_date):
            return get_daily_log_path(clean_date)

    # 3. Mặc định: Trả về file hôm nay nếu tồn tại, nếu chưa có thì trả về app.log
    today_path = get_daily_log_path(today_str)
    if today_path.exists():
        return today_path
    return LOG_FILE_PATH

def list_available_log_files() -> List[Dict[str, Any]]:
    """
    Liệt kê tất cả các file log hiện có:
    - app_YYYY-MM-DD.log (từng ngày riêng biệt)
    - app.log (toàn bộ lịch sử)
    Được sắp xếp ngày mới nhất lên đầu, kèm thông tin dung lượng và nhãn hiển thị.
    """
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    daily_files = []
    pattern = re.compile(r"^app_(\d{4}-\d{2}-\d{2})\.log$")

    if LOGS_DIR.exists():
        for f in LOGS_DIR.glob("app_*.log"):
            m = pattern.match(f.name)
            if m:
                d_str = m.group(1)
                size = f.stat().st_size
                mtime = f.stat().st_mtime
                mtime_str = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
                size_formatted = f"{size / 1024:.1f} KB" if size < 1024 * 1024 else f"{size / (1024 * 1024):.2f} MB"
                is_today = (d_str == today_str)
                label = f"Hôm nay ({d_str})" if is_today else f"Ngày {d_str}"
                daily_files.append({
                    "name": f.name,
                    "date": d_str,
                    "label": label,
                    "size_bytes": size,
                    "size_formatted": size_formatted,
                    "modified_time": mtime_str,
                    "is_today": is_today,
                    "is_all": False
                })

    daily_files.sort(key=lambda x: x["date"], reverse=True)

    # Đảm bảo hôm nay có trong danh sách lựa chọn
    if not any(f["is_today"] for f in daily_files):
        today_file = get_daily_log_path(today_str)
        daily_files.insert(0, {
            "name": today_file.name,
            "date": today_str,
            "label": f"Hôm nay ({today_str})",
            "size_bytes": 0,
            "size_formatted": "0 KB",
            "modified_time": None,
            "is_today": True,
            "is_all": False
        })

    # File tổng hợp app.log
    all_log_info = {
        "name": "app.log",
        "date": "all",
        "label": "Toàn bộ lịch sử (app.log)",
        "size_bytes": 0,
        "size_formatted": "0 KB",
        "modified_time": None,
        "is_today": False,
        "is_all": True
    }
    if LOG_FILE_PATH.exists():
        size = LOG_FILE_PATH.stat().st_size
        mtime = LOG_FILE_PATH.stat().st_mtime
        mtime_str = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
        all_log_info["size_bytes"] = size
        all_log_info["size_formatted"] = f"{size / 1024:.1f} KB" if size < 1024 * 1024 else f"{size / (1024 * 1024):.2f} MB"
        all_log_info["modified_time"] = mtime_str

    result: List[Dict[str, Any]] = []
    result.extend(daily_files)
    result.append(all_log_info)
    return result

def get_log_file_info(target_file: Optional[str] = None, target_date: Optional[str] = None) -> Dict[str, Any]:
    """Lấy thông tin file log thực tế trên đĩa (tổng thể hoặc theo ngày)"""
    file_path = resolve_log_file(target_file=target_file, target_date=target_date)
    if not file_path.exists():
        return {
            "exists": False,
            "path": str(file_path),
            "filename": file_path.name,
            "size_bytes": 0,
            "size_formatted": "0 KB",
            "modified_time": None
        }

    size = file_path.stat().st_size
    mtime = file_path.stat().st_mtime
    mtime_str = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
    size_formatted = f"{size / 1024:.1f} KB" if size < 1024 * 1024 else f"{size / (1024 * 1024):.2f} MB"

    return {
        "exists": True,
        "path": str(file_path),
        "filename": file_path.name,
        "size_bytes": size,
        "size_formatted": size_formatted,
        "modified_time": mtime_str
    }

def get_recent_log_lines(
    limit: int = 400,
    level_filter: str = "ALL",
    search_query: str = "",
    target_file: Optional[str] = None,
    target_date: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Đọc các dòng log gần nhất từ file log (theo ngày hoặc app.log) để hiển thị lên UI với bộ lọc linh hoạt.
    """
    file_path = resolve_log_file(target_file=target_file, target_date=target_date)
    if not file_path.exists():
        return []

    lines: List[str] = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()
            lines = all_lines[-max(limit * 3, 1000):]
    except Exception as e:
        return [{"raw": f"[ERROR READING LOG FILE: {e}]", "level": "ERROR", "time": "", "message": str(e)}]

    parsed_records = []
    level_filter = level_filter.upper().strip()
    search_query = search_query.lower().strip()

    # Regex nhận dạng dòng log chuẩn: 2026-10-25 04:50:00 [INFO   ] [name:123] [thread] - message
    log_pattern = re.compile(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+\[([A-Z]+)\s*\]\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s+-\s+(.*)$")

    current_entry = None

    for line in lines:
        match = log_pattern.match(line)
        if match:
            if current_entry:
                parsed_records.append(current_entry)
            timestamp, lvl, source, thread_name, msg = match.groups()
            current_entry = {
                "time": timestamp,
                "level": lvl.strip(),
                "source": source.strip(),
                "thread": thread_name.strip(),
                "message": msg.strip(),
                "raw": line.strip()
            }
        else:
            # Continuation line (ví dụ Traceback line)
            if current_entry:
                current_entry["message"] += "\n" + line.rstrip()
                current_entry["raw"] += "\n" + line.rstrip()
            else:
                current_entry = {
                    "time": "",
                    "level": "INFO",
                    "source": "sys",
                    "thread": "main",
                    "message": line.strip(),
                    "raw": line.strip()
                }

    if current_entry:
        parsed_records.append(current_entry)

    # Áp dụng bộ lọc
    filtered = []
    for r in parsed_records:
        r_level = r["level"].upper()
        if level_filter != "ALL":
            if level_filter == "ERROR" and r_level not in ("ERROR", "CRITICAL"):
                continue
            elif level_filter == "WARNING" and r_level not in ("WARNING", "ERROR", "CRITICAL"):
                continue
            elif level_filter == "INFO" and r_level not in ("INFO", "WARNING", "ERROR", "CRITICAL"):
                continue
            elif level_filter == "DEBUG" and r_level != "DEBUG":
                continue

        if search_query:
            if (search_query not in r["message"].lower() and
                search_query not in r["source"].lower() and
                search_query not in r["raw"].lower()):
                continue

        filtered.append(r)

    return filtered[-limit:]

def clear_log_file(target_file: Optional[str] = None, target_date: Optional[str] = None) -> bool:
    """Xóa trắng nội dung file log được chọn (app.log hoặc file theo ngày)"""
    try:
        file_path = resolve_log_file(target_file=target_file, target_date=target_date)
        if file_path.exists():
            with open(file_path, "w", encoding="utf-8") as f:
                f.truncate(0)
        _logger.info(f"Đã làm sạch file nhật ký hệ thống: {file_path.name}")
        return True
    except Exception as e:
        print(f"[CLEAR LOG ERROR] {e}", file=sys.stderr)
        return False

# Initial boot record
_logger.info("=== HỆ THỐNG LOGGING ĐÃ KHỞI TẠO THÀNH CÔNG ===")
