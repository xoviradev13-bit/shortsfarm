import os
import time
import json
import random
import threading
from datetime import datetime, timedelta
from backend.database import log_event, get_connection
from backend.modules.yt_monitor import yt_monitor
from backend.modules.distributor import distributor
from backend.modules.tiktok_uploader import tiktok_uploader

def is_retryable_upload_error(error_msg: str) -> bool:
    """
    Phân loại lỗi upload TikTok:
    - Trả về True nếu là lỗi mạng, proxy, browser crash, kết nối GPM, timeout giao diện.
    - Trả về False nếu là lỗi tài khoản bị cấm, captcha/xác minh, hết hạn phiên đăng nhập, file lỗi.
    """
    if not error_msg:
        return True
    e = error_msg.lower()
    # 1. Các lỗi TUYỆT ĐỐI KHÔNG RETRY (cần can thiệp người dùng / nguy hiểm cho tài khoản)
    non_retryable_keywords = [
        "captcha", "xác minh", "verification", "puzzle", "slide to verify",
        "bị cấm", "bị khóa", "suspended", "banned", "restricted", "hạn chế",
        "vi phạm", "community guidelines", "tiêu chuẩn cộng đồng",
        "hết phiên", "chưa đăng nhập", "session expired", "logged out", "đăng nhập lại", "vui lòng đăng nhập",
        "không tìm thấy file", "file không tồn tại", "video không hợp lệ", "định dạng không hỗ trợ",
        "dung lượng vượt quá", "file is missing", "bản quyền", "copyright", "nội dung trùng lặp"
    ]
    for kw in non_retryable_keywords:
        if kw in e:
            return False
    # 2. Các lỗi TỰ ĐỘNG THỬ LẠI ĐƯỢC (lỗi tạm thời, mạng, proxy, GPM timeout, browser)
    retryable_keywords = [
        "proxy", "timeout", "timed out", "kết nối", "connection", "err_proxy", "err_connection",
        "econnreset", "econnrefused", "etimedout", "net::err", "network",
        "gpm", "cổng debug", "không thể khởi chạy", "remote_debugging_address", "browser closed", "target closed",
        "không tìm thấy nút", "nút đăng bị vô hiệu hóa", "chưa tải xong", "iframe", "dropzone",
        "upload timeout", "waiting for selector", "page crash", "navigation timeout", "detached",
        "navigation failed", "disconnected", "reset by peer", "refused"
    ]
    for kw in retryable_keywords:
        if kw in e:
            return True
    # Mặc định an toàn: nếu không có dấu hiệu vi phạm/captcha, cho phép retry
    return True


class BackgroundScheduler:
    """
    Điều phối các tác vụ chạy ngầm định kỳ:
    1. Quét RSS kênh YouTube (mỗi 15 phút) -> Tải video mới
    2. Kiểm tra hàng đợi đăng bài (mỗi 5 phút) -> Khởi chạy upload qua GPMLogin
    3. Watchdog chống treo task & Auto-Retry thông minh
    """
    def __init__(self):
        self.is_running = False
        self._thread = None
        self.rss_interval_minutes = 15
        self.upload_interval_seconds = 60
        self.auto_download = True
        self.auto_render = True
        self.save_by_channel_folder = False
        self.max_videos_per_scan = 5
        self.channel_delay_seconds = 2
        # Cấu hình Auto-Retry thông minh
        self.auto_retry_enabled = True
        self.max_retries = 2
        self.retry_delay_minutes = 15
        # Cấu hình Watchdog chống treo task
        self.watchdog_enabled = True
        self.stuck_timeout_minutes = 15
        # Giãn cách an toàn tối thiểu giữa các lần đăng trên cùng 1 tài khoản (phút)
        self.min_account_cooldown_minutes = 60
        
        # Cấu hình quét follower định kỳ & giờ cố định hàng ngày
        self.follower_scan_enabled = True
        self.follower_scan_mode = "daily_times"  # "daily_times" hoặc "interval"
        self.follower_scan_times = "08:00, 20:00"
        self.follower_scan_interval_hours = 6
        self._triggered_follower_scans = set()
        self.last_follower_scan = 0
        
        self.load_settings()
    def load_settings(self):
        """Đọc cấu hình scheduler từ SQLite settings table"""
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM settings")
            db_settings = dict(cursor.fetchall())
            conn.close()
            if "scheduler_interval_minutes" in db_settings:
                self.rss_interval_minutes = max(1, int(db_settings["scheduler_interval_minutes"]))
            if "upload_interval_seconds" in db_settings:
                self.upload_interval_seconds = max(10, int(db_settings["upload_interval_seconds"]))
            if "auto_download" in db_settings:
                self.auto_download = db_settings["auto_download"] == "1"
            if "auto_render" in db_settings:
                self.auto_render = db_settings["auto_render"] == "1"
            if "save_by_channel_folder" in db_settings:
                self.save_by_channel_folder = db_settings["save_by_channel_folder"] == "1"
            if "max_videos_per_scan" in db_settings:
                self.max_videos_per_scan = max(1, int(db_settings["max_videos_per_scan"]))
            if "channel_delay_seconds" in db_settings:
                self.channel_delay_seconds = max(0, int(db_settings["channel_delay_seconds"]))
            if "upload_auto_retry" in db_settings:
                self.auto_retry_enabled = db_settings["upload_auto_retry"] == "1"
            if "upload_max_retries" in db_settings:
                self.max_retries = max(1, int(db_settings["upload_max_retries"]))
            if "upload_retry_delay_minutes" in db_settings:
                self.retry_delay_minutes = max(1, int(db_settings["upload_retry_delay_minutes"]))
            if "watchdog_enabled" in db_settings:
                self.watchdog_enabled = db_settings["watchdog_enabled"] == "1"
            if "upload_stuck_timeout_minutes" in db_settings:
                self.stuck_timeout_minutes = max(5, int(db_settings["upload_stuck_timeout_minutes"]))
            if "min_account_cooldown_minutes" in db_settings:
                self.min_account_cooldown_minutes = max(15, int(db_settings["min_account_cooldown_minutes"]))
            elif "min_post_interval_minutes" in db_settings:
                self.min_account_cooldown_minutes = max(15, int(db_settings["min_post_interval_minutes"]))
            if "follower_scan_enabled" in db_settings:
                self.follower_scan_enabled = db_settings["follower_scan_enabled"] == "1"
            if "follower_scan_mode" in db_settings:
                self.follower_scan_mode = db_settings["follower_scan_mode"]
            if "follower_scan_times" in db_settings:
                self.follower_scan_times = db_settings["follower_scan_times"]
            if "follower_scan_interval_hours" in db_settings:
                self.follower_scan_interval_hours = max(1, int(db_settings["follower_scan_interval_hours"]))
        except Exception as e:
            log_event("WARNING", f"Lỗi đọc cấu hình scheduler từ DB: {e}")
    def update_config(self, interval_minutes=None, upload_interval_seconds=None, auto_download=None, auto_render=None,
                      max_videos_per_scan=None, channel_delay_seconds=None, save_by_channel_folder=None,
                      auto_retry_enabled=None, max_retries=None, retry_delay_minutes=None,
                      watchdog_enabled=None, stuck_timeout_minutes=None, min_account_cooldown_minutes=None):
        """Cập nhật cấu hình runtime ngay lập tức"""
        if interval_minutes is not None:
            self.rss_interval_minutes = max(1, int(interval_minutes))
        if upload_interval_seconds is not None:
            self.upload_interval_seconds = max(10, int(upload_interval_seconds))
        if auto_download is not None:
            self.auto_download = bool(auto_download)
        if auto_render is not None:
            self.auto_render = bool(auto_render)
        if save_by_channel_folder is not None:
            self.save_by_channel_folder = bool(save_by_channel_folder)
        if max_videos_per_scan is not None:
            self.max_videos_per_scan = max(1, int(max_videos_per_scan))
        if channel_delay_seconds is not None:
            self.channel_delay_seconds = max(0, int(channel_delay_seconds))
        if auto_retry_enabled is not None:
            self.auto_retry_enabled = bool(auto_retry_enabled)
        if max_retries is not None:
            self.max_retries = max(1, int(max_retries))
        if retry_delay_minutes is not None:
            self.retry_delay_minutes = max(1, int(retry_delay_minutes))
        if watchdog_enabled is not None:
            self.watchdog_enabled = bool(watchdog_enabled)
        if stuck_timeout_minutes is not None:
            self.stuck_timeout_minutes = max(5, int(stuck_timeout_minutes))
        if min_account_cooldown_minutes is not None:
            self.min_account_cooldown_minutes = max(15, int(min_account_cooldown_minutes))
    def update_follower_config(self, enabled=None, mode=None, times=None, interval_hours=None):
        """Cập nhật cấu hình quét follower runtime"""
        if enabled is not None:
            self.follower_scan_enabled = bool(enabled)
        if mode is not None:
            self.follower_scan_mode = str(mode)
        if times is not None:
            self.follower_scan_times = str(times)
        if interval_hours is not None:
            self.follower_scan_interval_hours = max(1, int(interval_hours))
    def _recover_stuck_tasks(self, is_startup: bool = False):
        """
        Watchdog chống treo (Stuck Recovery):
        - is_startup=True: Khởi động hệ thống, tự động reset tất cả các task dở dang ở 'processing' về 'queued'
        - is_startup=False: Quét runtime, tự động reset các task ở 'processing' quá stuck_timeout_minutes
        """
        try:
            conn = get_connection()
            cursor = conn.cursor()
            now_dt = datetime.now()
            now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")
            if is_startup:
                cursor.execute("""
                    SELECT ut.id, ut.video_id, ut.title, gp.gpm_id
                    FROM upload_tasks ut
                    LEFT JOIN gpm_profiles gp ON ut.gpm_profile_id = gp.id
                    WHERE ut.status = 'processing'
                """)
                stuck_tasks = cursor.fetchall()
                for t in stuck_tasks:
                    tid = t["id"]
                    cursor.execute("""
                        UPDATE upload_tasks
                        SET status = 'queued',
                            processing_started_at = NULL,
                            error_message = 'Tự động phục hồi sau khi khởi động lại ứng dụng/máy tính'
                        WHERE id = ?
                    """, (tid,))
                    conn.commit()
                    try:
                        from backend.modules.tiktok_tracker import set_profile_busy
                        if t["gpm_id"]:
                            set_profile_busy(t["gpm_id"], False)
                    except Exception:
                        pass
                    log_event("INFO", f"[WATCHDOG] 🚀 Khởi động hệ thống: Đã tự động phục hồi Task #{tid} (bị dở dang do tắt ứng dụng) về 'queued' để đăng lại.")
                conn.close()
                return
            # Runtime check
            if not self.watchdog_enabled:
                conn.close()
                return
            timeout_delta = timedelta(minutes=self.stuck_timeout_minutes)
            cursor.execute("""
                SELECT ut.id, ut.video_id, ut.title, gp.gpm_id, ut.processing_started_at,
                       COALESCE(ut.retry_count, 0) as retry_count
                FROM upload_tasks ut
                LEFT JOIN gpm_profiles gp ON ut.gpm_profile_id = gp.id
                WHERE ut.status = 'processing'
            """)
            running_tasks = cursor.fetchall()
            for t in running_tasks:
                tid = t["id"]
                p_start_str = t["processing_started_at"]
                is_stuck = False
                if p_start_str:
                    try:
                        p_start = datetime.strptime(p_start_str, "%Y-%m-%d %H:%M:%S")
                        if now_dt - p_start > timeout_delta:
                            is_stuck = True
                    except Exception:
                        is_stuck = True
                else:
                    # Gán thời gian nếu chưa có
                    cursor.execute("UPDATE upload_tasks SET processing_started_at = ? WHERE id = ?", (now_str, tid))
                    conn.commit()
                    continue
                if is_stuck:
                    gpm_id = t["gpm_id"] or ""
                    try:
                        from backend.modules.tiktok_tracker import set_profile_busy
                        if gpm_id:
                            set_profile_busy(gpm_id, False)
                    except Exception:
                        pass
                    cur_retries = t["retry_count"]
                    if self.auto_retry_enabled and cur_retries < self.max_retries:
                        next_retry = cur_retries + 1
                        retry_time = (now_dt + timedelta(minutes=self.retry_delay_minutes)).strftime("%Y-%m-%d %H:%M:%S")
                        cursor.execute("""
                            UPDATE upload_tasks
                            SET status = 'queued',
                                retry_count = ?,
                                retry_after = ?,
                                scheduled_time = ?,
                                processing_started_at = NULL,
                                error_message = ?
                            WHERE id = ?
                        """, (
                            next_retry,
                            retry_time,
                            retry_time,
                            f"[Watchdog] Bị treo quá {self.stuck_timeout_minutes} phút, tự động thử lại {next_retry}/{self.max_retries}",
                            tid
                        ))
                        conn.commit()
                        log_event("WARNING", f"[WATCHDOG] ⚠️ Tác vụ #{tid} (GPM: {gpm_id}) bị treo ở trạng thái 'processing' quá {self.stuck_timeout_minutes} phút! Tự động chuyển về 'queued' để thử lại lần {next_retry}/{self.max_retries} vào lúc {retry_time}.")
                    else:
                        fail_reason = f"Thất bại: Tác vụ bị treo quá {self.stuck_timeout_minutes} phút (đã thử lại {cur_retries}/{self.max_retries} lần)."
                        cursor.execute("""
                            UPDATE upload_tasks
                            SET status = 'failed',
                                processing_started_at = NULL,
                                error_message = ?
                            WHERE id = ?
                        """, (fail_reason, tid))
                        conn.commit()
                        log_event("WARNING", f"[WATCHDOG] ❌ Tác vụ #{tid} (GPM: {gpm_id}) bị treo quá {self.stuck_timeout_minutes} phút và đã hết số lần thử lại ({cur_retries}/{self.max_retries}). Đánh dấu thất bại hẳn.")
                        try:
                            from backend.modules.notifier import notifier
                            threading.Thread(
                                target=notifier.send_issue_alert,
                                kwargs={
                                    "title": f"Tác Vụ Upload #{tid} Bị Treo",
                                    "message": f"Tác vụ tải video lên profile GPMLogin '{gpm_id}' bị treo quá {self.stuck_timeout_minutes} phút và đã vượt quá {self.max_retries} lần thử lại.",
                                    "solution": "1️⃣ Mở Profile GPMLogin kiểm tra tab trình duyệt TikTok xem có bị đơ hoặc lỗi mạng không.\n2️⃣ Khởi động lại GPMLogin hoặc kiểm tra kết nối Proxy.",
                                    "severity": "HIGH",
                                    "details": f"Task #{tid} | Profile: {gpm_id}"
                                },
                                daemon=True
                            ).start()
                        except Exception:
                            pass
            conn.close()
        except Exception as ex:
            log_event("WARNING", f"[WATCHDOG] Lỗi khi xử lý phục hồi task treo: {ex}")
    def start(self):
        if self.is_running:
            return
        self.is_running = True
        # 0. Watchdog: Phục hồi ngay các task bị dở dang (processing) do tắt máy/khởi động lại
        try:
            self._recover_stuck_tasks(is_startup=True)
        except Exception as e:
            log_event("WARNING", f"[WATCHDOG] Lỗi kiểm tra task dở dang khi khởi động: {e}")
        # 1. Thread riêng cho hàng đợi Upload (chạy độc lập, không bị block bởi download/render video)
        self._upload_thread = threading.Thread(target=self._upload_loop, daemon=True, name="UploadWorker")
        self._upload_thread.start()
        # 2. Thread riêng cho quét RSS và tải/render video
        self._rss_thread = threading.Thread(target=self._rss_loop, daemon=True, name="RSSScanner")
        self._rss_thread.start()
        # 3. Thread riêng cho bảo trì định kỳ (dọn file, quét follower, báo cáo telegram)
        self._maintenance_thread = threading.Thread(target=self._maintenance_loop, daemon=True, name="MaintenanceWorker")
        self._maintenance_thread.start()
        log_event("INFO", f"Background Scheduler đã khởi động (Upload worker: {self.upload_interval_seconds}s, RSS worker: {self.rss_interval_minutes}p, Auto-Retry: {'BẬT' if self.auto_retry_enabled else 'TẮT'}, Watchdog: {'BẬT' if self.watchdog_enabled else 'TẮT'}).")
    def stop(self):
        self.is_running = False
    def _upload_loop(self):
        """Vòng lặp xử lý hàng đợi Upload độc lập - KHÔNG BAO GIỜ bị nghẽn bởi render video"""
        last_upload_check = 0
        last_watchdog_check = 0
        while self.is_running:
            # Kiểm tra trạng thái bản quyền: Nếu máy chưa kích hoạt key -> Không xử lý hàng đợi upload
            try:
                from backend.modules.license_manager import get_license_info
                if not get_license_info().get("is_active"):
                    time.sleep(10)
                    continue
            except Exception:
                pass

            now = time.time()
            # Watchdog kiểm tra các task bị treo > stuck_timeout_minutes (quét mỗi 30 giây)
            if self.watchdog_enabled and (now - last_watchdog_check >= 30):
                try:
                    self._recover_stuck_tasks(is_startup=False)
                except Exception as e:
                    log_event("WARNING", f"[WATCHDOG] Lỗi quét task treo định kỳ: {e}")
                last_watchdog_check = time.time()
            upload_delay_secs = max(5, self.upload_interval_seconds)
            if now - last_upload_check >= upload_delay_secs:
                try:
                    self._process_pending_uploads()
                except Exception as e:
                    log_event("WARNING", f"[UPLOAD WORKER] Lỗi xử lý hàng đợi upload: {str(e)}")
                last_upload_check = time.time()
            # Xử lý các nhiệm vụ tương tác 30 phút vàng (Pin comment & Auto-reply)
            if now - last_upload_check >= 10:
                try:
                    self._process_pending_engagements()
                except Exception as e:
                    log_event("WARNING", f"[ENGAGEMENT WORKER] Lỗi xử lý tương tác 30 phút vàng: {str(e)}")
            time.sleep(3)
    def _rss_loop(self):
        """Vòng lặp quét RSS, tải video và render AI chạy ngầm riêng biệt"""
        last_rss_check = 0
        while self.is_running:
            # Kiểm tra trạng thái bản quyền: Nếu máy chưa kích hoạt key -> Không quét hoặc tải video ngầm
            try:
                from backend.modules.license_manager import get_license_info
                if not get_license_info().get("is_active"):
                    time.sleep(15)
                    continue
            except Exception:
                pass

            now = time.time()
            rss_delay_secs = max(60, self.rss_interval_minutes * 60)
            if now - last_rss_check >= rss_delay_secs:
                if self.auto_download:
                    try:
                        total_new = yt_monitor.scan_all_monitored_channels(
                            max_per_channel=self.max_videos_per_scan,
                            delay=float(self.channel_delay_seconds)
                        )
                        if total_new > 0:
                            log_event("INFO", f"[RSS WORKER] Đã quét chu kỳ ({self.rss_interval_minutes}p): phát hiện và tải về {total_new} video mới qua RSS.")
                    except Exception as e:
                        log_event("WARNING", f"[RSS WORKER] Lỗi quét RSS: {str(e)}")
                last_rss_check = time.time()
            time.sleep(5)
    def _maintenance_loop(self):
        """Vòng lặp xử lý dọn dẹp file, quét follower và báo cáo telegram"""
        last_cleanup_check = 0
        while self.is_running:
            now = time.time()
            # 1. Tự động kiểm tra dọn dẹp file MP4 đã đăng quá hạn và file log cũ > 30 ngày (mỗi 1 giờ)
            if now - last_cleanup_check > 3600:
                try:
                    from backend.app import cleanup_uploaded_files
                    cleanup_uploaded_files()
                except Exception:
                    pass
                try:
                    from backend.logger import cleanup_old_daily_logs
                    cleanup_old_daily_logs(retention_days=30)
                except Exception:
                    pass
                last_cleanup_check = time.time()
            # 2. Tự động kiểm tra lịch quét chỉ số / Follower TikTok định kỳ
            try:
                self._check_and_trigger_follower_scan(now)
            except Exception:
                pass
            # 3. Tự động kiểm tra lịch gửi Báo cáo hoạt động ngày tới các kênh Telegram
            try:
                self._check_and_trigger_daily_reports(now)
            except Exception:
                pass
            time.sleep(10)
    def _check_and_trigger_daily_reports(self, now):
        """Kiểm tra và tự động gửi Báo cáo hoạt động ngày cho các nhóm Telegram theo daily_report_time"""
        now_hm = datetime.now().strftime("%H:%M")
        today_str = datetime.now().strftime("%Y-%m-%d")
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, name, chat_id, daily_report_time, last_daily_report 
                FROM telegram_channels 
                WHERE is_active = 1 AND notify_daily_report = 1
            ''')
            channels = cursor.fetchall()
            for ch in channels:
                ch_id = ch["id"]
                target_time = (ch["daily_report_time"] or "21:00").strip()
                last_report = ch["last_daily_report"] or ""
                if target_time == now_hm and last_report != today_str:
                    # Cập nhật ngay để không bị bắn lặp lại trong phút đó
                    cursor.execute("UPDATE telegram_channels SET last_daily_report = ? WHERE id = ?", (today_str, ch_id))
                    conn.commit()
                    ch_name = ch["name"]
                    chat_target = ch["chat_id"]
                    def _async_send_report(cid=chat_target, cname=ch_name):
                        try:
                            from backend.modules.notifier import notifier
                            log_event("INFO", f"[SCHEDULER] ⏰ Gửi báo cáo ngày tự động ({now_hm}) tới kênh Telegram '{cname}'")
                            notifier.send_daily_report(report_date=today_str, target_chat_id=cid)
                        except Exception as ex:
                            log_event("WARNING", f"[SCHEDULER] Lỗi gửi báo cáo ngày tới '{cname}': {ex}")
                    threading.Thread(target=_async_send_report, daemon=True).start()
            conn.close()
        except Exception:
            pass
    def _check_and_trigger_follower_scan(self, now):
        """Kểm tra thời gian và kích hoạt quét follower tự động theo cấu hình"""
        if not self.follower_scan_enabled:
            return
        should_trigger = False
        today_str = datetime.now().strftime("%Y-%m-%d")
        now_hm = datetime.now().strftime("%H:%M")
        if self.follower_scan_mode == "daily_times":
            # Ví dụ: "08:00, 20:00"
            raw_times = [t.strip() for t in self.follower_scan_times.split(",") if t.strip()]
            for t in raw_times:
                if t == now_hm:
                    trigger_key = f"{today_str}_{t}"
                    if trigger_key not in self._triggered_follower_scans:
                        self._triggered_follower_scans.add(trigger_key)
                        self._triggered_follower_scans = {k for k in self._triggered_follower_scans if k.startswith(today_str)}
                        should_trigger = True
                        break
        elif self.follower_scan_mode == "interval":
            interval_secs = max(1800, self.follower_scan_interval_hours * 3600)
            if self.last_follower_scan == 0:
                self.last_follower_scan = now
            elif now - self.last_follower_scan > interval_secs:
                should_trigger = True
        if should_trigger:
            self.last_follower_scan = now
            def _async_scan():
                try:
                    from backend.modules.tiktok_tracker import tiktok_tracker
                    log_event("INFO", f"[SCHEDULER] ⏰ Kích hoạt quét Follower tự động ({self.follower_scan_mode})...")
                    tiktok_tracker.scan_all_profiles()
                except Exception as e:
                    log_event("WARNING", f"[SCHEDULER] Lỗi quét follower tự động: {e}")
            t = threading.Thread(target=_async_scan, daemon=True)
            t.start()
    def _process_pending_uploads(self):
        if not self.is_running:
            return
        conn = get_connection()
        cursor = conn.cursor()
        now_dt = datetime.now()
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")
        # Lấy các task đang ở trạng thái queued và tới giờ đăng (thỏa mãn cả scheduled_time và retry_after)
        cursor.execute('''
        SELECT ut.id, ut.video_id, ut.title, ut.tags, 
               COALESCE(NULLIF(ut.video_path, ''), v.rendered_path) as rendered_path, 
               gp.gpm_id, ut.gpm_profile_id, COALESCE(ut.retry_count, 0) as retry_count,
               v.channel_id, COALESCE(ut.part_number, 1) as part_number,
               gp.tiktok_username, COALESCE(ut.variant_tag, '') as variant_tag
        FROM upload_tasks ut
        JOIN videos v ON ut.video_id = v.id
        JOIN gpm_profiles gp ON ut.gpm_profile_id = gp.id
        WHERE ut.status = 'queued' 
          AND (ut.scheduled_time IS NULL OR ut.scheduled_time <= ?)
          AND (ut.retry_after IS NULL OR ut.retry_after <= ?)
        ORDER BY ut.scheduled_time ASC, ut.id ASC
        LIMIT 10
        ''', (now_str, now_str))
        candidates = cursor.fetchall()
        task = None
        for cand_row in candidates:
            cand = dict(cand_row)
            cand_profile_id = cand["gpm_profile_id"]
            cand_video_id = cand["video_id"]
            cand_part_num = cand["part_number"] or 1
            # 1. Bảo vệ chỉ số 30 phút đầu (First 30 Minutes Rule / Peak Traffic Guard):
            # Tuyệt đối không đăng vào khung giờ chết ban đêm (00:00 - 06:45) khi lượng người dùng hoạt động thấp nhất.
            current_hour = now_dt.hour
            if 0 <= current_hour < 7:
                morning_slot = now_dt.replace(hour=7, minute=15, second=0) + timedelta(minutes=random.randint(0, 45))
                morning_str = morning_slot.strftime("%Y-%m-%d %H:%M:%S")
                cursor.execute("UPDATE upload_tasks SET scheduled_time = ? WHERE id = ?", (morning_str, cand["id"]))
                conn.commit()
                log_event("INFO", f"[UPLOAD WORKER] 🌙 Khung giờ chết ({current_hour:02d}:{now_dt.minute:02d}). Tự động hoãn Task #{cand['id']} tới khung giờ vàng buổi sáng ({morning_str}) để tối ưu tương tác 30 phút đầu.")
                continue
            # Khóa tuần tự Part (Series Sequencing Lock):
            # Nếu task này là Part 2, Part 3... thì BẮT BUỘC các Part trước của cùng video_id phải đã đăng thành công ('completed')
            if cand_part_num > 1:
                cursor.execute("""
                    SELECT COUNT(*) FROM upload_tasks
                    WHERE video_id = ? AND part_number < ? AND status != 'completed'
                """, (cand_video_id, cand_part_num))
                uncompleted_prev = cursor.fetchone()[0]
                if uncompleted_prev > 0:
                    # Part trước chưa upload xong -> Bỏ qua task này, nhường lượt cho Part trước hoặc video khác
                    continue
            # Ưu tiên lấy cấu hình giãn cách riêng của Chiến dịch (nếu có), nếu không có thì dùng Cấu hình toàn cục (Global)
            cooldown_mins = self.min_account_cooldown_minutes
            try:
                ch_id = cand["channel_id"]
                if ch_id:
                    cursor.execute("""
                        SELECT min_post_interval_minutes FROM campaigns
                        WHERE (channel_id = ? OR channel_ids LIKE ?) 
                          AND min_post_interval_minutes IS NOT NULL 
                          AND min_post_interval_minutes > 0
                        ORDER BY id DESC LIMIT 1
                    """, (ch_id, f"%{ch_id}%"))
                    c_row = cursor.fetchone()
                    if c_row and c_row["min_post_interval_minutes"]:
                        cooldown_mins = max(15, int(c_row["min_post_interval_minutes"]))
            except Exception:
                pass
            from backend.database import get_linked_profile_ids
            linked_ids = get_linked_profile_ids(cursor, cand_profile_id)
            ph_linked = ",".join("?" for _ in linked_ids)

            # A. Chống đăng trùng tuyệt đối (Duplicate Clip Guard across Browsers):
            # Nếu clip này (cùng video_id và part_number) đã từng đăng thành công qua bất kỳ profile nào cùng nick (GPM hoặc GenLogin) -> Bỏ qua
            cursor.execute(f"""
                SELECT ut.id, ut.uploaded_at, gp.name FROM upload_tasks ut
                JOIN gpm_profiles gp ON ut.gpm_profile_id = gp.id
                WHERE ut.video_id = ? 
                  AND (ut.part_number = ? OR (ut.part_number IS NULL AND ? = 1))
                  AND ut.status = 'completed'
                  AND gp.id IN ({ph_linked})
                  AND ut.id != ?
            """, (cand_video_id, cand_part_num, cand_part_num, *linked_ids, cand["id"]))
            already_done = cursor.fetchone()
            if already_done:
                cursor.execute("UPDATE upload_tasks SET status = 'skipped', error_message = ? WHERE id = ?",
                    (f"Bỏ qua: Clip đã được đăng thành công trước đó (Task #{already_done['id']} qua profile '{already_done['name']}')", cand["id"]))
                conn.commit()
                log_event("WARNING", f"[UPLOAD WORKER] 🛡️ Chống đăng trùng: Video #{cand_video_id} (Part {cand_part_num}) đã được đăng thành công qua '{already_done['name']}' lúc {already_done['uploaded_at']}. Tự động đánh dấu 'skipped' Task #{cand['id']} để bảo vệ kênh!")
                continue

            # B. Khóa đồng thời kênh (Channel Concurrency Lock):
            # Không cho phép 2 profile (1 GPM, 1 GenLogin) cùng mở và upload vào cùng 1 kênh cùng lúc
            cursor.execute(f"""
                SELECT ut.id, gp.name FROM upload_tasks ut
                JOIN gpm_profiles gp ON ut.gpm_profile_id = gp.id
                WHERE gp.id IN ({ph_linked}) AND ut.status = 'processing' AND ut.id != ?
            """, (*linked_ids, cand["id"]))
            in_progress = cursor.fetchone()
            if in_progress:
                log_event("INFO", f"[UPLOAD WORKER] ⏳ Kênh của Task #{cand['id']} đang có tiến trình upload khác đang chạy (Task #{in_progress['id']} qua '{in_progress['name']}'). Chờ phiên hoàn tất trước khi mở tiếp.")
                continue

            # C. Giãn cách tối thiểu liên trình duyệt (Cross-Browser Cooldown Guard):
            # Kiểm tra thời điểm đăng bài hoàn tất gần nhất của TẤT CẢ profile cùng nick này (GPMLogin + GenLogin)
            cursor.execute(f"""
                SELECT ut.uploaded_at, gp.name FROM upload_tasks ut
                JOIN gpm_profiles gp ON ut.gpm_profile_id = gp.id
                WHERE ut.gpm_profile_id IN ({ph_linked}) AND ut.status = 'completed' AND ut.uploaded_at IS NOT NULL
                ORDER BY ut.uploaded_at DESC LIMIT 1
            """, tuple(linked_ids))
            last_upload = cursor.fetchone()
            if last_upload and last_upload["uploaded_at"]:
                try:
                    last_uploaded_dt = datetime.strptime(last_upload["uploaded_at"], "%Y-%m-%d %H:%M:%S")
                    elapsed_minutes = (now_dt - last_uploaded_dt).total_seconds() / 60.0
                    if elapsed_minutes < cooldown_mins:
                        postpone_minutes = int(cooldown_mins - elapsed_minutes) + random.randint(1, 5)
                        new_time = (now_dt + timedelta(minutes=postpone_minutes)).strftime("%Y-%m-%d %H:%M:%S")
                        cursor.execute("UPDATE upload_tasks SET scheduled_time = ? WHERE id = ?", (new_time, cand["id"]))
                        conn.commit()
                        log_event("WARNING", f"[UPLOAD WORKER] 🛡️ Kênh của profile '{cand['gpm_id']}' vừa đăng clip qua '{last_upload['name']}' lúc {last_upload['uploaded_at']} (cách đây {int(elapsed_minutes)}p). Giãn cách an toàn tối thiểu {cooldown_mins}p: Tự động lùi Task #{cand['id']} tới {new_time}.")
                        continue
                except Exception:
                    pass
            # Profile này an toàn và đủ điều kiện để đăng
            task = cand
            break
        if task:
            if not self.is_running:
                conn.close()
                return
            task_id = task["id"]
            video_path = task["rendered_path"]
            gpm_id = task["gpm_id"]
            title = task["title"]
            tags = task["tags"]
            cur_retries = task["retry_count"]
            # Chốt chặn kiểm tra file video render thực tế trên đĩa (tránh mở GPM vô ích nếu file hỏng/rỗng)
            if not video_path or not os.path.exists(video_path) or os.path.getsize(video_path) < 1024:
                err_text = f"File video không tồn tại hoặc bị lỗi rỗng (<1KB): {video_path}"
                log_event("ERROR", f"[UPLOAD WORKER] Hủy Task #{task_id}: {err_text}")
                cursor.execute("UPDATE upload_tasks SET status = 'failed', error_message = ? WHERE id = ?", (err_text, task_id))
                conn.commit()
                conn.close()
                return
            # Kiểm tra an toàn: Nếu profile đang bận quét follower thì tạm hoãn để không gây xung đột browser
            from backend.modules.tiktok_tracker import is_profile_busy
            if is_profile_busy(gpm_id):
                conn.close()
                return
            # Tự động khởi chạy GPMLogin nếu ứng dụng đang tắt
            from backend.modules.gpm_client import gpm_client
            if not gpm_client.check_health().get("running"):
                log_event("INFO", f"[UPLOAD WORKER] Phát hiện GPMLogin chưa mở trước khi upload Task #{task_id}. Đang tự động bật GPMLogin...")
                gpm_client.ensure_gpm_running()
            cursor.execute("""
                UPDATE upload_tasks 
                SET status = 'processing', processing_started_at = ? 
                WHERE id = ?
            """, (now_str, task_id))
            conn.commit()
            conn.close()
            # Thực thi upload
            try:
                res = tiktok_uploader.upload_via_gpm(
                    gpm_profile_id=gpm_id,
                    video_path=video_path,
                    title=title,
                    tags=tags,
                    auto_post=True
                )
            except Exception as ex:
                res = {"success": False, "message": f"Ngoại lệ khi upload: {str(ex)}"}
            conn = get_connection()
            try:
                cursor = conn.cursor()
                if res.get("success"):
                    cursor.execute("""
                        UPDATE upload_tasks 
                        SET status = 'completed', 
                            uploaded_at = ?, 
                            processing_started_at = NULL, 
                            error_message = NULL 
                        WHERE id = ?
                    """, (now_str, task_id))
                    if task.get("video_id"):
                        cursor.execute("UPDATE videos SET status = 'uploaded' WHERE id = ?", (task["video_id"],))
                    conn.commit()
                    # Gap 4: Kích hoạt Auto-Pilot Golden 30-Minute Engagement Protocol
                    vtag = task.get("variant_tag", "")
                    vtag_str = f" ({vtag})" if vtag else ""
                    log_event(
                        "SUCCESS", 
                        f"🚀 [GOLDEN 30-MIN] Video #{task.get('video_id')}{vtag_str} đã đăng thành công lên @{gpm_id} (Task #{task_id}) lúc {now_str}! "
                        f"Checklist 30 phút đầu: 1️⃣ Ghim comment mồi thảo luận; 2️⃣ Trả lời 3-5 comment đầu; 3️⃣ Mồi tín hiệu chia sẻ."
                    )
                    try:
                        ch_id = task.get("channel_id")
                        cursor.execute("""
                            SELECT id, auto_engagement_enabled, auto_pin_comment, pin_comment_delay_mins,
                                   auto_reply_comments, reply_comments_delay_mins, ai_provider, ai_model
                            FROM campaigns
                            WHERE (channel_id = ? OR channel_ids LIKE ?) AND auto_engagement_enabled = 1
                            ORDER BY id DESC LIMIT 1
                        """, (ch_id, f"%{ch_id}%"))
                        camp_cfg = cursor.fetchone()
                        if camp_cfg and camp_cfg["auto_engagement_enabled"]:
                            camp_id = camp_cfg["id"]
                            p_url = res.get("post_url", "") or ""
                            # 1. Lên lịch ghim comment mồi (Follower Trap) với Human Timing & Anti-Spam Shield
                            if camp_cfg["auto_pin_comment"] != 0:
                                # Anti-Spam Shield: Chỉ ghim ở ~80% số video để phá vỡ pattern bot cứng nhắc
                                should_pin = (random.random() < 0.80)
                                if not should_pin:
                                    log_event("INFO", f"🛡️ [ANTI-SPAM SHIELD] Bỏ qua ghim comment cho Task #{task_id} để tạo hành vi ngẫu nhiên tự nhiên (Human-like variation).")
                                else:
                                    # Human Timing: Chờ từ 3 đến 8 phút sau khi đăng
                                    delay_p = random.randint(3, 8)
                                    pin_dt = now_dt + timedelta(minutes=delay_p, seconds=random.randint(0, 59))
                                    pin_str = pin_dt.strftime("%Y-%m-%d %H:%M:%S")

                                    # Xác định chính xác trạng thái Part (Part 1, Part giữa, Part cuối, hoặc Video đơn)
                                    curr_part = task.get("part_number") or 1
                                    vid_id = task.get("video_id")
                                    total_p = 1
                                    if vid_id:
                                        try:
                                            cursor.execute("SELECT COUNT(*) as cnt FROM upload_tasks WHERE video_id = ?", (vid_id,))
                                            cnt_r = cursor.fetchone()
                                            if cnt_r and cnt_r["cnt"] > 0:
                                                total_p = cnt_r["cnt"]
                                        except Exception:
                                            pass

                                    from backend.modules.engagement_bot import engagement_bot
                                    seed_dict = engagement_bot.generate_seed_debate_comment(
                                        title=title,
                                        hook_copy=task.get("hook_copy") or "",
                                        part_number=curr_part,
                                        total_parts=total_p,
                                        ai_provider=camp_cfg["ai_provider"] or "default",
                                        ai_model=camp_cfg["ai_model"] or "default"
                                    )
                                payload_json = json.dumps({
                                    "comment_text": seed_dict.get("comment", ""),
                                    "language": seed_dict.get("language", "vi"),
                                    "created_reason": "auto_pilot_campaign"
                                }, ensure_ascii=False)
                                # Guard: chỉ tạo nếu chưa có pin_comment task nào cho upload_task này
                                cursor.execute("""
                                    SELECT COUNT(*) as cnt FROM engagement_tasks
                                    WHERE upload_task_id = ? AND task_type = 'pin_comment'
                                """, (task_id,))
                                if cursor.fetchone()["cnt"] == 0:
                                    cursor.execute("""
                                        INSERT INTO engagement_tasks (
                                            upload_task_id, campaign_id, gpm_profile_id, post_url,
                                            task_type, status, scheduled_time, payload
                                        ) VALUES (?, ?, ?, ?, 'pin_comment', 'pending', ?, ?)
                                    """, (task_id, camp_id, task.get("gpm_profile_id"), p_url, pin_str, payload_json))
                                    conn.commit()
                                    log_event("SUCCESS", f"🔥 [GOLDEN 30-MIN] Đã lên lịch tự động Ghim comment mồi cho Task #{task_id} lúc {pin_str}: '{seed_dict.get('comment')}'")
                                else:
                                    log_event("INFO", f"🛡️ [DEDUP] pin_comment task cho upload #{task_id} đã tồn tại — bỏ qua tạo trùng.")
                            # 2. Lên lịch tự động trả lời comment khán giả sau 20 phút (hoặc cấu hình)
                            if camp_cfg["auto_reply_comments"] != 0:
                                delay_r = max(5, camp_cfg["reply_comments_delay_mins"] or 20)
                                rep_dt = now_dt + timedelta(minutes=delay_r, seconds=random.randint(0, 120))
                                rep_str = rep_dt.strftime("%Y-%m-%d %H:%M:%S")
                                # Guard: chỉ tạo nếu chưa có reply_comments task nào cho upload_task này
                                cursor.execute("""
                                    SELECT COUNT(*) as cnt FROM engagement_tasks
                                    WHERE upload_task_id = ? AND task_type = 'reply_comments'
                                """, (task_id,))
                                if cursor.fetchone()["cnt"] == 0:
                                    cursor.execute("""
                                        INSERT INTO engagement_tasks (
                                            upload_task_id, campaign_id, gpm_profile_id, post_url,
                                            task_type, status, scheduled_time
                                        ) VALUES (?, ?, ?, ?, 'reply_comments', 'pending', ?)
                                    """, (task_id, camp_id, task.get("gpm_profile_id"), p_url, rep_str))
                                    conn.commit()
                                    log_event("SUCCESS", f"💬 [GOLDEN 30-MIN] Đã lên lịch tự động Rep bình luận khán giả cho Task #{task_id} lúc {rep_str} (sau {delay_r} phút)")
                                else:
                                    log_event("INFO", f"🛡️ [DEDUP] reply_comments task cho upload #{task_id} đã tồn tại — bỏ qua tạo trùng.")
                    except Exception as ex_eng:
                        log_event("WARNING", f"Lỗi khởi tạo Golden Engagement Tasks: {ex_eng}")
                    # Gửi thông báo nhắc nhở checklist tới Telegram
                    try:
                        from backend.modules.notifier import notifier
                        threading.Thread(
                            target=notifier.send_first_30min_checklist,
                            kwargs={
                                "task_id": task_id,
                                "profile_name": gpm_id,
                                "username": task.get("tiktok_username") or gpm_id,
                                "title": title,
                                "post_time": now_str,
                                "variant_tag": vtag
                            },
                            daemon=True
                        ).start()
                    except Exception as ex_chk:
                        log_event("WARNING", f"Lỗi gửi Telegram checklist 30 phút: {ex_chk}")
                    try:
                        cursor.execute("SELECT value FROM settings WHERE key = 'cleanup_retention_mode'")
                        s_row = cursor.fetchone()
                        if s_row and s_row["value"] in ("0", "immediate"):
                            from backend.app import cleanup_uploaded_files
                            cleanup_uploaded_files(retention_mode="0")
                    except Exception:
                        pass
                else:
                    fail_msg = res.get("message", "Lỗi không xác định khi upload")
                    can_retry = (
                        self.auto_retry_enabled 
                        and cur_retries < self.max_retries 
                        and is_retryable_upload_error(fail_msg)
                    )
                    if can_retry:
                        next_retry = cur_retries + 1
                        retry_time = (now_dt + timedelta(minutes=self.retry_delay_minutes)).strftime("%Y-%m-%d %H:%M:%S")
                        cursor.execute("""
                            UPDATE upload_tasks 
                            SET status = 'queued', 
                                retry_count = ?, 
                                retry_after = ?, 
                                scheduled_time = ?, 
                                processing_started_at = NULL, 
                                error_message = ? 
                            WHERE id = ?
                        """, (
                            next_retry, 
                            retry_time, 
                            retry_time, 
                            f"[Tự động thử lại {next_retry}/{self.max_retries}] {fail_msg}", 
                            task_id
                        ))
                        conn.commit()
                        log_event("WARNING", f"Tác vụ đăng bài #{task_id} (GPM: {gpm_id}) gặp sự cố tạm thời: {fail_msg}. Hệ thống sẽ tự động thử lại lần {next_retry}/{self.max_retries} vào lúc {retry_time}.")
                    else:
                        cursor.execute("""
                            UPDATE upload_tasks 
                            SET status = 'failed', 
                                processing_started_at = NULL, 
                                error_message = ? 
                            WHERE id = ?
                        """, (fail_msg, task_id))
                        conn.commit()
                        log_event("WARNING", f"Tác vụ đăng bài #{task_id} (GPM: {gpm_id}) thất bại hẳn (hoặc không đủ điều kiện thử lại): {fail_msg}")
                        # Tự động gửi cảnh báo sự cố kèm cách xử lý tới các kênh Telegram có bật notify_issues
                        try:
                            from backend.modules.notifier import notifier
                            solution = notifier.get_solution_for_error(fail_msg, category="upload")
                            threading.Thread(
                                target=notifier.send_issue_alert,
                                kwargs={
                                    "title": f"Lỗi Đăng Video TikTok #{task_id}",
                                    "message": f"Tác vụ tải video lên profile GPMLogin '{gpm_id}' không thành công.\nNguyên nhân: {fail_msg}",
                                    "solution": solution,
                                    "severity": "HIGH",
                                    "details": f"Tiêu đề: {title} | Profile GPM: {gpm_id} | Đã thử: {cur_retries}/{self.max_retries}"
                                },
                                daemon=True
                            ).start()
                        except Exception as n_err:
                            log_event("WARNING", f"Lỗi gửi cảnh báo sự cố upload qua Telegram: {n_err}")
            finally:
                conn.close()
        else:
            conn.close()
    def _process_pending_engagements(self):
        """Worker quét và thực thi các nhiệm vụ Golden 30-Minute Engagement tới hạn"""
        if not self.is_running:
            return
        conn = get_connection()
        cursor = conn.cursor()
        now_dt = datetime.now()
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute('''
            SELECT et.id, et.task_type, et.gpm_profile_id, gp.gpm_id
            FROM engagement_tasks et
            JOIN gpm_profiles gp ON et.gpm_profile_id = gp.id
            WHERE et.status = 'pending'
              AND (et.scheduled_time IS NULL OR et.scheduled_time <= ?)
            ORDER BY et.scheduled_time ASC, et.id ASC
            LIMIT 5
        ''', (now_str,))
        due_tasks = cursor.fetchall()
        conn.close()
        if not due_tasks:
            return
        from backend.modules.engagement_bot import engagement_bot
        from backend.modules.tiktok_tracker import is_profile_busy
        for dt in due_tasks:
            t_id = dt["id"]
            t_type = dt["task_type"]
            g_id = dt["gpm_id"]
            if is_profile_busy(g_id):
                continue
            if t_type == "pin_comment":
                threading.Thread(
                    target=engagement_bot.execute_pin_comment_task,
                    args=(t_id,),
                    daemon=True
                ).start()
                break
            elif t_type == "reply_comments":
                threading.Thread(
                    target=engagement_bot.execute_reply_comments_task,
                    args=(t_id,),
                    daemon=True
                ).start()
                break
scheduler = BackgroundScheduler()
