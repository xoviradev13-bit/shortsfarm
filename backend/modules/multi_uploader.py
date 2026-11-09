import os
import time
from typing import Dict, Any, Optional
from backend.modules.browser_adapters import browser_manager
from backend.modules.tiktok_uploader import TikTokUploader
from backend.database import log_event
from backend.logger import get_logger

logger = get_logger("multi_uploader")

def connect_cdp_with_retry(p, cdp_target: str, max_retries: int = 5):
    last_err: Optional[Exception] = None
    for attempt in range(1, max_retries + 1):
        try:
            return p.chromium.connect_over_cdp(cdp_target)
        except Exception as e:
            last_err = e
            time.sleep(1.5)
    if last_err is not None:
        raise last_err
    raise RuntimeError(f"Không thể kết nối CDP tới {cdp_target}")

class MultiPlatformUploader:
    """
    Trình tự động đăng video đa nền tảng (TikTok, YouTube Shorts, Facebook Reels)
    Điều khiển qua các trình duyệt Antidetect (GPM, AdsPower, Dolphin, GenLogin)
    """
    def __init__(self):
        self.tiktok = TikTokUploader()

    def upload(
        self,
        platform: str,
        profile_id: str,
        video_path: str,
        title: str,
        tags: str = "#viral #fyp #trending",
        browser_type: str = "auto",
        auto_post: bool = True,
        close_browser_on_finish: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Hàm đăng tổng quát tự động điều hướng theo nền tảng:
        platform: 'tiktok' | 'youtube' | 'facebook'
        Tự động quản lý khóa Profile Busy Lock để tránh tranh chấp browser đa luồng.
        """
        from backend.modules.tiktok_tracker import set_profile_busy
        set_profile_busy(profile_id, True)
        try:
            p = platform.lower()
            if p == "tiktok":
                return self.tiktok.upload_via_gpm(
                    gpm_profile_id=profile_id,
                    video_path=video_path,
                    title=title,
                    tags=tags,
                    auto_post=auto_post,
                    close_browser_on_finish=close_browser_on_finish,
                    browser_type=browser_type,
                    enable_warmup=kwargs.get("enable_warmup", True),
                    warmup_minutes=kwargs.get("warmup_minutes", None)
                )
            elif p in ["youtube", "yt", "shorts"]:
                return self.upload_to_youtube(
                    profile_id=profile_id,
                    video_path=video_path,
                    title=title,
                    tags=tags,
                    browser_type=browser_type,
                    auto_post=auto_post,
                    close_browser_on_finish=close_browser_on_finish,
                    channel_id=kwargs.get("channel_id", "")
                )
            elif p in ["facebook", "fb", "reels"]:
                return self.upload_to_facebook(
                    profile_id=profile_id,
                    video_path=video_path,
                    title=title,
                    tags=tags,
                    browser_type=browser_type,
                    auto_post=auto_post,
                    close_browser_on_finish=close_browser_on_finish,
                    page_id=kwargs.get("page_id", "")
                )
            else:
                return {"success": False, "message": f"Nền tảng chưa được hỗ trợ: {platform}"}
        finally:
            set_profile_busy(profile_id, False)

    def upload_to_youtube(
        self,
        profile_id: str,
        video_path: str,
        title: str,
        tags: str = "#Shorts #Viral",
        browser_type: str = "auto",
        auto_post: bool = True,
        close_browser_on_finish: bool = False,
        channel_id: str = ""
    ) -> Dict[str, Any]:
        """Tự động đăng video / Shorts lên YouTube Studio qua Antidetect Browser.
        Nếu channel_id được chỉ định, sẽ chuyển sang kênh đó trước khi upload."""
        if not os.path.exists(video_path):
            return {"success": False, "message": f"Không tìm thấy video: {video_path}"}

        # Tự động nhận diện browser_type từ gpm_profiles nếu là auto
        if browser_type in ("auto", "", None):
            try:
                from backend.database import get_connection
                conn_b = get_connection()
                cur_b = conn_b.cursor()
                cur_b.execute("SELECT browser_type FROM gpm_profiles WHERE gpm_id = ? LIMIT 1", (profile_id,))
                row_b = cur_b.fetchone()
                if row_b and row_b["browser_type"]:
                    browser_type = row_b["browser_type"].lower()
                conn_b.close()
            except Exception:
                pass

        # Tự động nhận diện browser_type từ gpm_profiles nếu là auto
        if browser_type in ("auto", "", None):
            try:
                from backend.database import get_connection
                conn_b = get_connection()
                cur_b = conn_b.cursor()
                cur_b.execute("SELECT browser_type FROM gpm_profiles WHERE gpm_id = ? LIMIT 1", (profile_id,))
                row_b = cur_b.fetchone()
                if row_b and row_b["browser_type"]:
                    browser_type = row_b["browser_type"].lower()
                conn_b.close()
            except Exception:
                pass

        if not channel_id:
            try:
                from backend.database import get_connection
                conn_ch = get_connection()
                cur_ch = conn_ch.cursor()
                cur_ch.execute("SELECT channel_id FROM profile_channels WHERE gpm_id = ? AND platform = 'youtube' AND is_default = 1 LIMIT 1", (profile_id,))
                row_ch = cur_ch.fetchone()
                if row_ch and row_ch[0]:
                    channel_id = row_ch[0]
                conn_ch.close()
            except Exception:
                pass

        adapter = browser_manager.get_adapter(browser_type)
        if not adapter:
            return {"success": False, "message": f"Không tìm thấy trình duyệt: {browser_type}"}

        log_event("INFO", f"Mở profile {profile_id} để đăng YouTube Studio...")
        remote_address = adapter.start_profile(profile_id)
        if not remote_address:
            return {"success": False, "message": f"Không thể lấy cổng kết nối cho profile {profile_id}"}

        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            return {"success": False, "message": "Playwright chưa được cài đặt"}

        try:
            with sync_playwright() as p:
                cdp_target = remote_address if remote_address.startswith("ws://") or remote_address.startswith("http://") else f"http://{remote_address}"
                browser = connect_cdp_with_retry(p, cdp_target)
                context = browser.contexts[0] if browser.contexts else browser.new_context()
                page = context.new_page()

                log_event("INFO", "Điều hướng đến YouTube Studio Upload...")
                page.goto("https://studio.youtube.com", timeout=60000, wait_until="domcontentloaded")
                time.sleep(3)

                # Kiểm tra đăng nhập
                if "accounts.google.com" in page.url:
                    return {"success": False, "message": "Profile chưa đăng nhập tài khoản Google/YouTube!"}

                # Chuyển kênh YouTube nếu channel_id được chỉ định
                if channel_id:
                    try:
                        current_url = page.url
                        # Kiểm tra nếu đang ở kênh khác → chuyển sang kênh đúng
                        if channel_id not in current_url:
                            switch_url = f"https://studio.youtube.com/channel/{channel_id}"
                            page.goto(switch_url, timeout=30000, wait_until="domcontentloaded")
                            time.sleep(3)
                            log_event("INFO", f"Đã chuyển sang kênh YouTube: {channel_id}")
                    except Exception as switch_err:
                        log_event("WARNING", f"Không thể chuyển kênh YouTube {channel_id}: {switch_err}")

                # Bấm nút Tạo / Create hoặc Upload
                create_btn = page.locator("#create-icon, button:has-text('Tạo'), button:has-text('Create')").first
                if create_btn.is_visible(timeout=5000):
                    create_btn.click()
                    time.sleep(1)
                    upload_option = page.locator("#text-item-0, tp-yt-paper-item:has-text('Tải video lên'), tp-yt-paper-item:has-text('Upload videos')").first
                    if upload_option.is_visible(timeout=3000):
                        upload_option.click()

                # Upload file
                file_input = page.locator('input[type="file"]').first
                file_input.wait_for(state="attached", timeout=15000)
                file_input.set_input_files(video_path)
                log_event("INFO", f"Đã đẩy file video vào YouTube: {os.path.basename(video_path)}")

                # Điền tiêu đề & hashtags (đảm bảo có #Shorts cho video dọc)
                full_title = f"{title[:80]} {tags}" if "#shorts" not in title.lower() else title
                time.sleep(4)

                title_box = page.locator("#textbox[aria-label*='tiêu đề'], #textbox[aria-label*='title'], #title-textarea #textbox").first
                if title_box.is_visible(timeout=10000):
                    title_box.click()
                    page.keyboard.press("Control+A")
                    page.keyboard.press("Backspace")
                    title_box.fill(full_title)

                # Chọn "Không, đây không phải nội dung cho trẻ em"
                not_for_kids = page.locator('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]').first
                if not_for_kids.is_visible(timeout=5000):
                    not_for_kids.click()

                # Bấm Tiếp (Next) qua các bước
                for _ in range(3):
                    next_btn = page.locator('#next-button').first
                    if next_btn.is_visible(timeout=4000):
                        next_btn.click()
                        time.sleep(2)

                # Chọn chế độ Công Khai (Public)
                public_radio = page.locator('tp-yt-paper-radio-button[name="PUBLIC"]').first
                if public_radio.is_visible(timeout=5000):
                    public_radio.click()

                if auto_post:
                    done_btn = page.locator('#done-button').first
                    if done_btn.is_visible(timeout=5000):
                        done_btn.click()
                        log_event("SUCCESS", "Đã bấm XUẤT BẢN trên YouTube Studio!")
                        time.sleep(5)

                if close_browser_on_finish:
                    adapter.stop_profile(profile_id)

                return {"success": True, "message": "Đăng video lên YouTube thành công!"}

        except Exception as e:
            logger.error(f"Lỗi đăng YouTube: {e}")
            return {"success": False, "message": f"YouTube Upload Error: {str(e)}"}
        finally:
            if close_browser_on_finish and 'adapter' in locals() and adapter:
                try:
                    adapter.stop_profile(profile_id)
                except Exception:
                    pass

    def upload_to_facebook(
        self,
        profile_id: str,
        video_path: str,
        title: str,
        tags: str = "#reels #viral",
        browser_type: str = "auto",
        auto_post: bool = True,
        close_browser_on_finish: bool = False,
        page_id: str = ""
    ) -> Dict[str, Any]:
        """Tự động đăng Reels lên Facebook qua Antidetect Browser.
        Nếu page_id được chỉ định, sẽ chuyển sang trang đó trước khi đăng."""
        if not os.path.exists(video_path):
            return {"success": False, "message": f"Không tìm thấy video: {video_path}"}

        # Tự động nhận diện browser_type từ gpm_profiles nếu là auto
        if browser_type in ("auto", "", None):
            try:
                from backend.database import get_connection
                conn_b = get_connection()
                cur_b = conn_b.cursor()
                cur_b.execute("SELECT browser_type FROM gpm_profiles WHERE gpm_id = ? LIMIT 1", (profile_id,))
                row_b = cur_b.fetchone()
                if row_b and row_b["browser_type"]:
                    browser_type = row_b["browser_type"].lower()
                conn_b.close()
            except Exception:
                pass

        if not page_id:
            try:
                from backend.database import get_connection
                conn_ch = get_connection()
                cur_ch = conn_ch.cursor()
                cur_ch.execute("SELECT channel_id FROM profile_channels WHERE gpm_id = ? AND platform = 'facebook' AND is_default = 1 LIMIT 1", (profile_id,))
                row_ch = cur_ch.fetchone()
                if row_ch and row_ch[0]:
                    page_id = row_ch[0]
                conn_ch.close()
            except Exception:
                pass

        adapter = browser_manager.get_adapter(browser_type)
        if not adapter:
            return {"success": False, "message": f"Không tìm thấy trình duyệt: {browser_type}"}

        log_event("INFO", f"Mở profile {profile_id} để đăng Facebook Reels...")
        remote_address = adapter.start_profile(profile_id)
        if not remote_address:
            return {"success": False, "message": f"Không thể lấy cổng kết nối cho profile {profile_id}"}

        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            return {"success": False, "message": "Playwright chưa được cài đặt"}

        try:
            with sync_playwright() as p:
                cdp_target = remote_address if remote_address.startswith("ws://") or remote_address.startswith("http://") else f"http://{remote_address}"
                browser = connect_cdp_with_retry(p, cdp_target)
                context = browser.contexts[0] if browser.contexts else browser.new_context()
                page = context.new_page()

                log_event("INFO", "Điều hướng đến Facebook Reels Composer...")
                page.goto("https://www.facebook.com/reels/create", timeout=60000, wait_until="domcontentloaded")
                time.sleep(4)

                if "login" in page.url.lower():
                    return {"success": False, "message": "Profile chưa đăng nhập Facebook!"}

                # Upload file
                file_input = page.locator('input[type="file"]').first
                file_input.wait_for(state="attached", timeout=15000)
                file_input.set_input_files(video_path)
                log_event("INFO", "Đã đưa file video vào Facebook Reels composer...")
                time.sleep(4)

                # Nhập mô tả
                desc_input = page.locator('div[role="textbox"][contenteditable="true"]').first
                if desc_input.is_visible(timeout=5000):
                    desc_input.click()
                    desc_input.fill(f"{title} {tags}")

                # Bấm nút Tiếp (Next) qua các bước biên tập
                for _ in range(2):
                    next_btn = page.locator('div[aria-label="Tiếp"], div[aria-label="Next"], div[role="button"]:has-text("Tiếp"), div[role="button"]:has-text("Next")').first
                    if next_btn.is_visible(timeout=5000):
                        try:
                            next_btn.click(timeout=3000)
                        except Exception:
                            next_btn.click(force=True)
                        time.sleep(2)

                # Bấm nút Đăng (Publish)
                if auto_post:
                    publish_btn = page.locator('div[aria-label="Đăng"], div[aria-label="Publish"], div[role="button"]:has-text("Đăng"), div[role="button"]:has-text("Publish")').first
                    if publish_btn.is_visible(timeout=8000):
                        try:
                            publish_btn.click(timeout=4000)
                        except Exception:
                            publish_btn.click(force=True)
                        log_event("SUCCESS", "Đã bấm ĐĂNG trên Facebook Reels!")
                        time.sleep(5)

                if close_browser_on_finish:
                    adapter.stop_profile(profile_id)

                return {"success": True, "message": "Đăng video lên Facebook Reels thành công!"}

        except Exception as e:
            logger.error(f"Lỗi đăng Facebook: {e}")
            return {"success": False, "message": f"Facebook Upload Error: {str(e)}"}
        finally:
            if close_browser_on_finish and 'adapter' in locals() and adapter:
                try:
                    adapter.stop_profile(profile_id)
                except Exception:
                    pass

# Singleton toàn cục
multi_uploader = MultiPlatformUploader()

