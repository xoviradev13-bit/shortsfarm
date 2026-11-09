import os
import time
import random
import threading
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

from backend.database import get_connection, log_event
from backend.logger import get_logger
from backend.modules.gpm_client import gpm_client

logger = get_logger("account_warmup")

class AccountWarmupManager:
    """
    Quản lý chế độ Làm Ấm Tài Khoản (Warm-up) & Tăng Tốc (Acceleration):
    - Giai đoạn 1: Ngày 1 - 3 (Warm-up)
      * Tần suất: 1 - 2 video/ngày (Khung giờ vàng: 11:30 & 19:30)
      * Tương tác lướt feed tự nhiên 10 - 15 phút trước khi đăng bài để tạo độ uy tín (trust score) cho IP proxy & Cookie
      * Giãn cách tối thiểu giữa 2 lần đăng: >= 240 phút (4 tiếng)
    - Giai đoạn 2: Ngày 4 - 14 (Tăng tốc / Acceleration)
      * Tần suất: 3 - 4 video/ngày (Khung giờ vàng: 07:00, 11:45, 17:30, 20:30)
      * Đăng theo chùm Part (Part 1, 2, 3 cách nhau 2 - 3 tiếng)
      * Lướt feed làm ấm nhẹ 2 - 4 phút trước khi đăng
    """

    def get_profile_growth_stage(self, profile_id: int) -> Dict[str, Any]:
        """
        Xác định giai đoạn tăng trưởng của tài khoản dựa trên lịch sử hoạt động thực tế:
        - Số video đã đăng thành công (completed upload_tasks)
        - Tuổi tài khoản trong hệ thống (số ngày từ created_at hoặc lần đăng đầu)
        """
        conn = get_connection()
        cursor = conn.cursor()

        # 1. Đếm số video đã đăng thành công
        cursor.execute("""
            SELECT COUNT(*) FROM upload_tasks
            WHERE gpm_profile_id = ? AND status = 'completed'
        """, (profile_id,))
        completed_count = cursor.fetchone()[0]

        # 2. Lấy ngày tạo profile và lần upload đầu tiên
        cursor.execute("SELECT gpm_id, name, created_at FROM gpm_profiles WHERE id = ?", (profile_id,))
        p_row = cursor.fetchone()
        
        cursor.execute("""
            SELECT MIN(uploaded_at) FROM upload_tasks
            WHERE gpm_profile_id = ? AND status = 'completed' AND uploaded_at IS NOT NULL
        """, (profile_id,))
        first_up_row = cursor.fetchone()
        conn.close()

        first_post_time = first_up_row[0] if first_up_row and first_up_row[0] else None
        now = datetime.now()

        # Tính số ngày hoạt động
        if first_post_time:
            try:
                first_dt = datetime.strptime(first_post_time, "%Y-%m-%d %H:%M:%S")
                active_days = max(1, (now - first_dt).days + 1)
            except Exception:
                active_days = 1
        elif p_row and p_row["created_at"]:
            try:
                c_dt = datetime.strptime(p_row["created_at"][:19], "%Y-%m-%d %H:%M:%S")
                active_days = max(1, (now - c_dt).days + 1)
            except Exception:
                active_days = 1
        else:
            active_days = 1

        # Tiêu chuẩn phân định:
        # Nếu <= 4 video đã đăng HOẶC tuổi <= 3 ngày -> Giai đoạn WARM-UP (Ngày 1 - 3)
        # Nếu > 4 video và tuổi từ 4 - 14 ngày -> Giai đoạn ACCELERATION (Ngày 4 - 14)
        # Nếu > 14 ngày và đã đăng nhiều video -> Giai đoạn MATURE (Ổn định)
        if completed_count <= 4 or active_days <= 3:
            stage = "warmup"
            stage_name = "Ngày 1 - 3 (Warm-up làm ấm)"
            daily_limit = 2
            golden_schedule = "11:30, 19:30"
            warmup_minutes = 12.0  # Lướt feed 12 - 15 phút
            min_interval_mins = 240  # 4 tiếng
        elif active_days <= 14 or completed_count <= 40:
            stage = "acceleration"
            stage_name = "Ngày 4 - 14 (Tăng tốc)"
            daily_limit = 4
            golden_schedule = "07:00, 11:45, 17:30, 20:30"
            warmup_minutes = 3.0   # Lướt feed nhẹ 3 phút
            min_interval_mins = 120  # 2 - 3 tiếng giữa các Part
        else:
            stage = "mature"
            stage_name = "Tài khoản ổn định (>14 ngày)"
            daily_limit = 4
            golden_schedule = "07:00, 11:45, 17:30, 20:30"
            warmup_minutes = 2.0
            min_interval_mins = 90

        return {
            "profile_id": profile_id,
            "gpm_id": p_row["gpm_id"] if p_row else "",
            "profile_name": p_row["name"] if p_row else "",
            "completed_videos": completed_count,
            "active_days": active_days,
            "stage": stage,
            "stage_name": stage_name,
            "daily_limit": daily_limit,
            "golden_schedule": golden_schedule,
            "warmup_minutes": warmup_minutes,
            "min_interval_minutes": min_interval_mins
        }

    def run_feed_warmup(
        self,
        page,
        duration_minutes: float = 12.0,
        gpm_profile_id: str = "",
        stop_signal: Optional[threading.Event] = None
    ) -> Dict[str, Any]:
        """
        Thực hiện chu trình lướt Feed For You tự nhiên của TikTok:
        - Mở https://www.tiktok.com/foryou
        - Đóng các popup / modal nếu có
        - Xem từng video với thời lượng ngẫu nhiên (8s - 30s)
        - Cuộn mượt mô phỏng hành vi lăn chuột / phím mũi tên
        - Thỉnh thoảng thả tim (Like 15-20%) để kích hoạt cookie tracking
        - Dừng khi đạt thời lượng duration_minutes hoặc nhận stop_signal
        """
        start_time = time.time()
        max_duration_seconds = max(30.0, duration_minutes * 60.0)
        end_time = start_time + max_duration_seconds

        log_event(
            "INFO", 
            f"🔥 [WARM-UP FEED] Bắt đầu lướt feed TikTok làm ấm cho profile '{gpm_profile_id}' "
            f"trong {duration_minutes:.1f} phút (Mục tiêu: Tạo IP Trust & Nạp Cookie hành vi)..."
        )

        # 1. Điều hướng đến trang For You
        try:
            current_url = page.url.lower()
            if "tiktok.com" not in current_url or "upload" in current_url or "creator-center" in current_url:
                page.goto("https://www.tiktok.com/foryou", wait_until="domcontentloaded", timeout=45000)
                time.sleep(3)
        except Exception as e:
            logger.warning(f"Lỗi khi mở trang TikTok For You: {e}")
            try:
                page.goto("https://www.tiktok.com/", wait_until="domcontentloaded", timeout=45000)
                time.sleep(3)
            except Exception:
                pass

        # 2. Đóng các popup che màn hình (Login prompt, Cookies banner)
        self._dismiss_initial_overlays(page)

        videos_watched = 0
        likes_given = 0
        comments_peeked = 0

        # Vòng lặp lướt feed cho tới khi hết thời gian
        while time.time() < end_time:
            if stop_signal and stop_signal.is_set():
                log_event("INFO", f"[WARM-UP FEED] Nhận tín hiệu dừng sớm sau {videos_watched} video.")
                break

            # Quyết định thời gian xem video hiện tại:
            # 50%: xem ngắn (7 - 12s)
            # 40%: xem vừa đủ (14 - 24s)
            # 10%: xem kỹ / replay (28 - 45s)
            rand_roll = random.random()
            if rand_roll < 0.50:
                watch_time = random.uniform(7.0, 12.0)
            elif rand_roll < 0.90:
                watch_time = random.uniform(14.0, 24.0)
            else:
                watch_time = random.uniform(28.0, 45.0)

            # Giới hạn không vượt quá end_time
            time_remaining = end_time - time.time()
            if watch_time > time_remaining:
                watch_time = max(3.0, time_remaining)

            # Mô phỏng xem video: Thỉnh thoảng di chuyển chuột nhẹ nhàng
            elapsed = 0.0
            step = 3.0
            while elapsed < watch_time:
                time.sleep(min(step, watch_time - elapsed))
                elapsed += step
                # Rê chuột ngẫu nhiên nhẹ nhàng
                if random.random() < 0.35:
                    try:
                        x = random.randint(300, 750)
                        y = random.randint(200, 600)
                        page.mouse.move(x, y, steps=random.randint(5, 12))
                    except Exception:
                        pass

            videos_watched += 1

            # 3. Tương tác tự nhiên (Thả tim ngẫu nhiên ~18% cơ hội)
            if random.random() < 0.18:
                try:
                    like_btn = page.locator('[data-e2e="like-icon"], button[aria-label*="Like"], button[aria-label*="Thích"]').first
                    if like_btn.is_visible(timeout=800):
                        like_btn.click()
                        likes_given += 1
                        time.sleep(random.uniform(0.8, 1.5))
                except Exception:
                    pass

            # 4. Thỉnh thoảng mở xem bình luận (khoảng ~8% cơ hội)
            if random.random() < 0.08:
                try:
                    cmt_icon = page.locator('[data-e2e="comment-icon"]').first
                    if cmt_icon.is_visible(timeout=800):
                        cmt_icon.click()
                        comments_peeked += 1
                        time.sleep(random.uniform(3.0, 6.0))
                        # Cuộn nhẹ trong phần bình luận
                        page.keyboard.press("PageDown")
                        time.sleep(random.uniform(1.5, 3.0))
                        # Đóng bình luận
                        close_cmt = page.locator('[data-e2e="comment-close-icon"], button[aria-label="Close"]').first
                        if close_cmt.is_visible(timeout=800):
                            close_cmt.click()
                        else:
                            page.keyboard.press("Escape")
                        time.sleep(1.0)
                except Exception:
                    pass

            # Kiểm tra và đóng popup nếu xuất hiện giữa chừng
            self._dismiss_initial_overlays(page)

            # 5. Chuyển sang video tiếp theo:
            # Nhấn phím Mũi tên Xuống (ArrowDown) hoặc PageDown giống hệt người dùng xem TikTok trên máy tính
            scrolled = False
            try:
                page.keyboard.press("ArrowDown")
                time.sleep(random.uniform(0.5, 1.2))
                scrolled = True
            except Exception:
                pass

            if not scrolled or random.random() < 0.2:
                try:
                    # Fallback: Click nút chuyển video tiếp theo (mũi tên xuống trên web) hoặc cuộn chuột
                    next_btn = page.locator('[data-e2e="arrow-right"], button[aria-label*="Next"], button[aria-label*="tiếp"]').first
                    if next_btn.is_visible(timeout=500):
                        next_btn.click()
                    else:
                        page.mouse.wheel(0, random.randint(450, 750))
                except Exception:
                    try:
                        page.keyboard.press("PageDown")
                    except Exception:
                        pass

            # Đóng các popup có thể kích hoạt sau khi chuyển video
            self._dismiss_initial_overlays(page)

        total_elapsed_minutes = (time.time() - start_time) / 60.0
        log_event(
            "SUCCESS",
            f"✅ [WARM-UP HOÀN THÀNH] Profile '{gpm_profile_id}' đã lướt {videos_watched} video "
            f"({likes_given} likes, {comments_peeked} lượt xem cmt) trong {total_elapsed_minutes:.1f} phút. "
            f"Cookie & IP Trust đã sẵn sàng cho luồng đăng bài!"
        )

        return {
            "success": True,
            "videos_watched": videos_watched,
            "likes_given": likes_given,
            "comments_peeked": comments_peeked,
            "duration_minutes": round(total_elapsed_minutes, 2)
        }

    def _dismiss_initial_overlays(self, page):
        """Đóng các thông báo pop-up của TikTok (Passkey, Đăng nhập, Thông báo, Cookies)"""
        # 1. Popup "Tạo passkey để đăng nhập dễ dàng hơn" / "Create a passkey"
        try:
            passkey_btn = page.locator(
                'button:has-text("Để sau"), '
                'button:has-text("Maybe later"), '
                'button:has-text("Later"), '
                'button:has-text("Not now"), '
                'button:has-text("Không phải bây giờ")'
            ).first
            if passkey_btn.is_visible(timeout=500):
                log_event("INFO", "Phát hiện modal 'Tạo passkey' hoặc gợi ý trên TikTok -> Đang bấm 'Để sau'")
                passkey_btn.click(force=True)
                time.sleep(0.5)
        except Exception:
            pass

        # 1b. Tìm trong dialog/modal bất kỳ có passkey
        try:
            modal = page.locator('div[role="dialog"]:has-text("passkey"), div[role="dialog"]:has-text("Passkey"), div:has-text("Tạo passkey")').first
            if modal.is_visible(timeout=500):
                btn = modal.locator('button:has-text("Để sau"), button:has-text("Maybe later"), button:has-text("Later"), button:has-text("Not now")').first
                if btn.is_visible(timeout=500):
                    btn.click(force=True)
                    time.sleep(0.5)
        except Exception:
            pass

        # 2. Modal "Đăng nhập vào TikTok"
        try:
            close_login = page.locator('#login-modal-title + div, [data-e2e="modal-close-inner-button"], button[aria-label="Close"], button[aria-label="Đóng"]').first
            if close_login.is_visible(timeout=500):
                close_login.click(force=True)
                time.sleep(0.5)
        except Exception:
            pass

        # 3. Gỡ bỏ overlay tour guide / joyride
        try:
            page.evaluate("""
                () => {
                    const joyride = document.querySelector('#react-joyride-portal');
                    if (joyride) joyride.remove();
                    const overlays = document.querySelectorAll('.react-joyride__overlay');
                    overlays.forEach(el => el.remove());
                }
            """)
        except Exception:
            pass

        # 4. Phím Escape
        try:
            page.keyboard.press("Escape")
        except Exception:
            pass

account_warmup = AccountWarmupManager()

