import os
import re
import json
import time
import random
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from backend.database import get_connection, log_event
from backend.logger import get_logger
from backend.modules.gpm_client import gpm_client
from backend.modules.tiktok_tracker import is_profile_busy, set_profile_busy
from backend.modules.ai_addon.llm_curator import llm_curator

logger = get_logger("engagement_bot")


def is_vietnamese_text(text: str) -> bool:
    """Kiểm tra nhanh chuỗi có chứa ký tự dấu tiếng Việt hay không"""
    vn_chars = set("àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ")
    return any(c in vn_chars for c in (text or ""))


class EngagementBot:
    """
    Auto-Pilot Golden 30-Minute Engagement Protocol (Gap 4 Engine):
    - Multi-account safe: GPM isolated profiles, dedicated proxies, sequential execution lock.
    - Human-like typing with randomized jitter (50 - 110ms/char).
    - AI-powered multilingual seed debate questions & viewer comment replies.
    - Automatic fallback and resilient error handling.
    """

    def generate_seed_debate_comment(
        self,
        title: str,
        hook_copy: str = "",
        part_number: int = 1,
        total_parts: int = 1,
        ai_provider: str = "default",
        ai_model: str = "default"
    ) -> Dict[str, str]:
        """
        Tạo bình luận ghim (Pinned Comment) tối ưu thành 'Follower Trap' chuẩn thuật toán TikTok:
        - Phân loại chính xác theo trạng thái Part (Part 1, Part giữa, Part cuối, hoặc Video đơn).
        - Tuyệt đối KHÔNG nhắc Part 2 nếu total_parts == 1.
        - Kết cấu 2 vế (Tranh luận chia phe + CTA Follow theo ngữ cảnh câu chuyện).
        - Sử dụng Spintax đa dạng chống thuật toán Comment Duplicate Filter của TikTok.
        """
        is_vn = is_vietnamese_text(title) or is_vietnamese_text(hook_copy)
        lang_code = "vi" if is_vn else "en"

        is_single = (total_parts <= 1)
        is_part1 = (part_number == 1 and total_parts > 1)
        is_mid = (1 < part_number < total_parts and total_parts > 1)
        is_end = (part_number == total_parts and total_parts > 1)

        # Xây dựng Prompt LLM theo từng phân loại
        if is_vn:
            system_prompt = "Bạn là chuyên gia tăng trưởng TikTok triệu view. Hãy xuất kết quả bằng định dạng JSON."
            if is_single:
                part_instruction = (
                    "ĐÂY LÀ VIDEO ĐƠN LẺ (1 TẬP TRỌN VẸN). TUYỆT ĐỐI KHÔNG NHẮC ĐẾN TẬP 2 HOẶC PART 2. "
                    "Kết cấu 2 vế: Vế 1 hỏi tranh cãi chia phe về nội dung video, vế 2 kêu gọi follow kênh để biết thêm nhiều góc khuất chưa kể."
                )
            elif is_part1:
                part_instruction = (
                    "ĐÂY LÀ PART 1 CỦA CHÙM SERIES. "
                    "Kết cấu 2 vế: Vế 1 đặt câu hỏi tranh cãi cao trào nghi vấn, vế 2 thông báo PART 2 đã/sắp lên kênh + kêu gọi follow đón xem."
                )
            elif is_mid:
                part_instruction = (
                    f"ĐÂY LÀ PART {part_number}/{total_parts} (TẬP GIỮA). "
                    f"Kết cấu 2 vế: Vế 1 hỏi diễn biến gay cấn, vế 2 thông báo PART {part_number+1} đã có trên kênh + bấm follow xem ngay."
                )
            else:
                part_instruction = (
                    f"ĐÂY LÀ TẬP CUỐI (PART {total_parts}/{total_parts}). "
                    "Kết cấu 2 vế: Vế 1 hỏi đánh giá về cái kết, vế 2 cảm ơn đã xem trọn bộ + follow kênh để đón xem đại án/chủ đề mới ngày mai."
                )

            user_prompt = f"""Tạo 1 bình luận ghim (Pinned Comment) kích thích tương tác và kéo follow (Follower Trap) cho video TikTok.
Tiêu đề video: "{title}"
{f'Câu hook mở đầu: "{hook_copy}"' if hook_copy else ''}

QUY TẮC BẮT BUỘC:
1. LOẠI VIDEO: {part_instruction}
2. NGÔN NGỮ: Tiếng Việt 100% tự nhiên, đời thường, cuốn hút, kích thích tò mò.
3. ĐỘ DÀI: Ngắn gọn (< 26 từ). Tối đa 2 emoji (ưu tiên 👇, 🤔, ❤️).
4. XUẤT KẾT QUẢ ĐÚNG ĐỊNH DẠNG JSON: {{"language": "vi", "comment": "nội dung bình luận của bạn"}}"""
        else:
            system_prompt = "You are a viral TikTok growth strategist. Output your response in valid JSON format."
            if is_single:
                part_instruction = "STANDALONE SINGLE VIDEO. DO NOT MENTION PART 2. Clause 1: polarizing debate question. Clause 2: follow for more untold secrets."
            elif is_part1:
                part_instruction = "PART 1 OF SERIES. Clause 1: cliffhanger debate question. Clause 2: Part 2 is up on channel, follow to watch the ending."
            elif is_mid:
                part_instruction = f"PART {part_number}/{total_parts}. Clause 1: reaction question. Clause 2: Part {part_number+1} is up, follow to watch now."
            else:
                part_instruction = f"FINAL PART ({total_parts}/{total_parts}). Clause 1: verdict on the ending. Clause 2: thank you + follow for tomorrow's new documentary series."

            user_prompt = f"""Create a high-converting 2-clause pinned comment (Follower Trap) for a TikTok video.
Video Title: "{title}"
{f'Hook Copy: "{hook_copy}"' if hook_copy else ''}

RULES:
1. CONTEXT: {part_instruction}
2. TONE: Natural casual American TikTok creator voice.
3. LENGTH: Under 25 words. Maximum 2 emojis.
4. RETURN VALID JSON: {{"language": "en", "comment": "your comment here"}}"""

        provider_arg = None if ai_provider == "default" else ai_provider
        model_arg = None if ai_model == "default" else ai_model

        try:
            raw_res = llm_curator.query_llm(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                task="seed_debate_comment",
                custom_provider=provider_arg or "openai",
                custom_model=model_arg
            )
            if raw_res:
                clean_json = re.sub(r"^```json\s*|\s*```$", "", raw_res.strip(), flags=re.MULTILINE)
                parsed = json.loads(clean_json)
                cmt = parsed.get("comment", "").strip()
                if cmt:
                    return {"language": lang_code, "comment": cmt}
        except Exception as e:
            logger.warning(f"Lỗi gọi LLM tạo seed comment: {e}")

        # Rule-based Spintax Fallback chống trùng lặp Comment Spam
        if is_vn:
            if is_single:
                fallbacks = [
                    "Bạn nghĩ nhân vật này xử lý như vậy là đúng hay sai? 🤔 Follow kênh để cùng thảo luận nhiều vụ việc chấn động tiếp theo nhé! 👇",
                    "Có ai thấy nổi da gà ở tình tiết này không? 😱 Nhớ follow kênh để đón xem những câu chuyện kỳ bí tiếp theo nhé! 👇",
                    "Nếu rơi vào tình huống này, bạn sẽ chọn cách giải quyết nào? Follow kênh để biết thêm nhiều góc khuất chưa kể nhé! 👇",
                    "Thực sự không ngờ kết cục lại như vậy! 😳 Bạn đánh giá thế nào? Follow kênh để đón xem câu chuyện ngày mai nhé! 👇"
                ]
            elif is_part1:
                fallbacks = [
                    "Bạn nghĩ đây là âm mưu được tính trước hay chỉ là sự cố? 🤔 Part 2 đã lên kênh rồi bác nhé, follow để theo dõi diễn biến đại án tiếp theo nha! 👇",
                    "Liệu có uẩn khúc gì đằng sau lời khai này không? Part 2 đã đăng trên kênh, nhớ follow để xem cái kết bất ngờ nhé! 👇",
                    "Cảnh sát đã tìm thấy bằng chứng gì tiếp theo? Cú twist chấn động nằm ở Part 2, follow kênh để xem trọn bộ nhé! 👇",
                    "Bác nào nhận ra manh mối đáng ngờ ở giây thứ 15 không? Part 2 đã lên sóng, follow kênh để không bỏ lỡ nhé! 👇"
                ]
            elif is_mid:
                fallbacks = [
                    f"Diễn biến ngày càng nghẹt thở! Theo bạn ai mới là chủ mưu? 👇 Bấm follow kênh để đón xem ngay PART {part_number + 1} nhé!",
                    f"Cú quay xe này quá bất ngờ! Bác nào hóng tập tiếp theo thì follow kênh xem ngay PART {part_number + 1} nhé! 👇",
                    f"Tình tiết này khiến bạn bất ngờ nhất phải không? PART {part_number + 1} đã có trên kênh, follow để theo dõi đến cùng nhé! 👇"
                ]
            else:
                fallbacks = [
                    "Bạn đánh giá thế nào về cái kết đại án này? Cảm ơn các bác đã theo dõi trọn bộ, nhớ follow kênh để đón xem kỳ án mới vào ngày mai nhé! 👇",
                    "Bản án này đã thực sự công bằng chưa? Cảm ơn mọi người đã đồng hành, follow kênh để đón xem vụ án tiếp theo nhé! 👇",
                    "Một kết cục quá nhiều bài học đắt giá! Nhớ follow kênh để cùng theo dõi câu chuyện chấn động vào 19h ngày mai nhé! 👇"
                ]
        else:
            if is_single:
                fallbacks = [
                    "Was this the right decision or a huge mistake? Drop your thoughts and follow for more untold stories! 👇",
                    "Did anyone else get chills at this part? 😱 Hit follow so you don't miss our next deep dive! 👇",
                    "How would you react in this exact situation? Follow our page for more shocking revelations! 👇"
                ]
            elif is_part1:
                fallbacks = [
                    "Did he act in self-defense or was it planned? Part 2 is already posted on our channel, follow to see the shocking truth! 👇",
                    "Can you spot the hidden clue in the first 10 seconds? Part 2 is up now, follow to watch the conclusion! 👇",
                    "What would you do if you were in their shoes? The twist in Part 2 is insane, follow our channel to watch! 👇"
                ]
            elif is_mid:
                fallbacks = [
                    f"The tension is unbelievable! Part {part_number + 1} is already live, hit follow to watch what happens next! 👇",
                    f"Who do you think is really guilty? Check Part {part_number + 1} on our profile and follow for the final answer! 👇"
                ]
            else:
                fallbacks = [
                    "What's your final verdict on this case? Thanks for watching the full series, follow for tomorrow's new case! 👇",
                    "Did justice get served here? Thanks for watching all parts, follow our page for the next series! 👇"
                ]

        return {"language": lang_code, "comment": random.choice(fallbacks)}

    def generate_comment_replies(
        self,
        video_title: str,
        comments_list: List[Dict[str, str]],
        ai_provider: str = "default",
        ai_model: str = "default"
    ) -> List[Dict[str, str]]:
        """Tạo câu trả lời tự nhiên theo từng ngôn ngữ của người xem"""
        replies = []
        provider_arg = None if ai_provider == "default" else ai_provider
        model_arg = None if ai_model == "default" else ai_model

        for item in comments_list:
            author = item.get("author", "viewer")
            comment_text = item.get("text", "")
            if not comment_text.strip():
                continue

            system_prompt = "You are a friendly, witty TikTok creator. Output your response in valid JSON format."
            user_prompt = f"""You posted a TikTok video titled: "{video_title}".
A viewer named @{author} commented: "{comment_text}"

Write a quick, authentic creator reply.
CRITICAL RULES:
1. DETECT AND MATCH THE EXACT LANGUAGE of the viewer's comment ({comment_text}).
2. Tone: Friendly, humble, humorous, or appreciative.
3. Under 15 words. No hashtags. Maximum 1 emoji.
4. RETURN VALID JSON: {{"reply": "your reply text"}}"""

            # Bắt từ khóa Part 2 để tự động trả lời kèm CTA kéo Follower
            part2_keywords = [
                "part 2", "part2", "p2", "tập 2", "tap 2", "tập sau", "tap sau",
                "khi nào có part 2", "part 2 đâu", "part 2 dau", "hóng part 2",
                "where is part 2", "where's part 2", "next part", "part two"
            ]
            lower_cmt = comment_text.lower()
            reply_text = ""
            if any(kw in lower_cmt for kw in part2_keywords):
                if is_vietnamese_text(comment_text):
                    reply_text = random.choice([
                        "Part 2 đã lên kênh rồi bác nhé, nhớ follow kênh để đón xem trọn bộ nha! 👇",
                        "Dạ Part 2 đã có trên kênh rồi nha bạn ơi, bấm follow trang cá nhân của mình để xem ngay nhé! ❤️",
                        "Part 2 đã lên sóng rồi nè! Bác bấm follow kênh để theo dõi đại án tiếp theo luôn nha! 🔥"
                    ])
                else:
                    reply_text = random.choice([
                        "Part 2 is already posted on our channel! Make sure to follow to watch the full story! 👇",
                        "It's already up on the channel! Check our profile to watch Part 2 right now! 🔥",
                        "Part 2 is live! Hit that follow button so you don't miss the next series! 🙌"
                    ])

            if not reply_text:
                try:
                    raw_res = llm_curator.query_llm(
                        system_prompt=system_prompt,
                        user_prompt=user_prompt,
                        task="reply_viewer_comment",
                        custom_provider=provider_arg or "openai",
                        custom_model=model_arg
                    )
                    if raw_res:
                        clean_json = re.sub(r"^```json\s*|\s*```$", "", raw_res.strip(), flags=re.MULTILINE)
                        parsed = json.loads(clean_json)
                        reply_text = parsed.get("reply", "").strip()
                except Exception as e:
                    logger.warning(f"Lỗi tạo AI reply cho @{author}: {e}")

            if not reply_text:
                if is_vietnamese_text(comment_text):
                    reply_text = random.choice([
                        "Chuẩn luôn bạn ơi! Cảm ơn bạn đã xem nha ❤️",
                        "Haha đúng rồi đó, cảm ơn góc nhìn của bạn nhé! 😂",
                        "Chuẩn không cần chỉnh luôn nè! 🔥"
                    ])
                else:
                    reply_text = random.choice([
                        "Facts! Thanks for watching and sharing your thoughts! 🙌",
                        "Haha totally agree with you on this one! 😂",
                        "Appreciate the support! Stay tuned for more 🔥"
                    ])

            replies.append({
                "author": author,
                "text": comment_text,
                "reply": reply_text
            })

        return replies

    def resolve_latest_post_url(self, page, username: str) -> str:
        """Lấy URL video mới nhất trên profile TikTok nếu chưa có post_url"""
        clean_user = username.lstrip("@").strip()

        # Cách 1: Thử tìm trong TikTok Studio Content Management (nơi tài khoản đã đăng nhập sẵn)
        try:
            page.goto("https://www.tiktok.com/tiktokstudio/content", timeout=25000, wait_until="domcontentloaded")
            time.sleep(3)
            # Tìm link video đầu tiên trong bảng quản lý nội dung
            studio_link = page.locator('a[href*="/video/"], a[href*="tiktok.com/@"]').first
            if studio_link.is_visible(timeout=4000):
                href = studio_link.get_attribute("href") or ""
                if "/video/" in href:
                    if href.startswith("/"):
                        href = f"https://www.tiktok.com{href}"
                    logger.info(f"Đã lấy post_url từ TikTok Studio Content: {href}")
                    return href
        except Exception:
            pass

        # Cách 2: Tìm trên trang profile cá nhân
        if not clean_user:
            return ""

        profile_url = f"https://www.tiktok.com/@{clean_user}"
        try:
            page.goto(profile_url, timeout=30000, wait_until="domcontentloaded")
            time.sleep(4)

            # Đóng modal/popup che chắn
            for sel in ['button[aria-label="Close"]', '[data-e2e="modal-close-inner-button"]', 'button:has-text("Không phải bây giờ")', 'button:has-text("Not now")']:
                try:
                    b = page.locator(sel).first
                    if b.is_visible(timeout=800):
                        b.click()
                except Exception:
                    pass

            # Thử nhiều bộ chọn cho video đầu tiên trên profile
            selectors = [
                'a[href*="/video/"]',
                '[data-e2e="user-post-item"] a',
                'div[data-e2e="user-post-item"] a',
                'div[class*="DivItemContainer"] a',
                'div[data-e2e="user-post-item"]'
            ]
            for s in selectors:
                try:
                    first_video = page.locator(s).first
                    if first_video.is_visible(timeout=3000):
                        href = first_video.get_attribute("href") or ""
                        if href and "/video/" in href:
                            if href.startswith("/"):
                                href = f"https://www.tiktok.com{href}"
                            logger.info(f"Đã lấy post_url từ trang cá nhân @{clean_user}: {href}")
                            return href
                except Exception:
                    continue
        except Exception as e:
            logger.warning(f"Không thể resolve post_url cho @{clean_user}: {e}")
        return ""

    def execute_pin_comment_task(self, task_id: int) -> Dict[str, Any]:
        """Thực thi tác vụ đăng comment mồi và Ghim lên đầu video"""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT et.*, gp.gpm_id, gp.tiktok_username, gp.name as profile_name,
                   ut.title, ut.variant_tag, ut.hook_copy, ut.post_url as ut_post_url
            FROM engagement_tasks et
            JOIN gpm_profiles gp ON et.gpm_profile_id = gp.id
            LEFT JOIN upload_tasks ut ON et.upload_task_id = ut.id
            WHERE et.id = ?
        """, (task_id,))
        task = cursor.fetchone()
        if not task:
            conn.close()
            return {"success": False, "message": f"Không tìm thấy engagement task #{task_id}"}
        task = dict(task)

        gpm_id = task["gpm_id"]
        if is_profile_busy(gpm_id):
            conn.close()
            return {"success": False, "busy": True, "message": f"Profile {task['profile_name']} đang bận"}

        set_profile_busy(gpm_id, True)
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("UPDATE engagement_tasks SET status = 'processing' WHERE id = ?", (task_id,))
        conn.commit()
        conn.close()

        result = {"success": False, "message": ""}
        try:
            # 1. Chuẩn bị nội dung câu hỏi mồi
            payload_data = {}
            if task["payload"]:
                try:
                    payload_data = json.loads(task["payload"])
                except Exception:
                    pass

            comment_text = payload_data.get("comment_text")
            if not comment_text:
                seed = self.generate_seed_debate_comment(
                    title=task["title"] or "TikTok Video",
                    hook_copy=task["hook_copy"] or ""
                )
                comment_text = seed["comment"]
                payload_data["comment_text"] = comment_text
                payload_data["language"] = seed["language"]

            post_url = task["post_url"] or task["ut_post_url"] or ""

            # 2. Khởi động GPMLogin Profile
            gpm_client.ensure_gpm_running()
            remote_address = gpm_client.start_profile(gpm_id, low_ram_mode=False, mute_audio=True)
            if not remote_address:
                raise RuntimeError(f"Không thể khởi động GPM profile {gpm_id}")

            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                browser = p.chromium.connect_over_cdp(f"http://{remote_address}")
                ctx = browser.contexts[0] if browser.contexts else browser.new_context()
                page = ctx.new_page()

                # Nếu chưa có post_url, tự động tìm video mới nhất trên profile
                if not post_url:
                    post_url = self.resolve_latest_post_url(page, task["tiktok_username"] or "")
                    if post_url:
                        conn = get_connection()
                        conn.execute("UPDATE engagement_tasks SET post_url = ? WHERE id = ?", (post_url, task_id))
                        if task["upload_task_id"]:
                            conn.execute("UPDATE upload_tasks SET post_url = ? WHERE id = ?", (post_url, task["upload_task_id"]))
                        conn.commit()
                        conn.close()

                if not post_url:
                    raise RuntimeError("Không xác định được đường dẫn video để ghim comment")

                video_id = post_url.rstrip("/").split("/")[-1] if post_url else ""
                pinned_success = False
                
                # Ưu tiên mở trực tiếp trang Studio Comment của riêng video này
                if video_id and video_id.isdigit():
                    studio_video_url = f"https://www.tiktok.com/tiktokstudio/comment/{video_id}"
                    log_event("INFO", f"🔥 [STUDIO PIN] Đang mở trang bình luận Studio của video {video_id} để đăng comment mồi...")
                    page.goto(studio_video_url, timeout=35000, wait_until="domcontentloaded")
                    # Đợi 12 giây cho trang Studio load đầy đủ (bao gồm cả bảng bình luận và ô nhập)
                    time.sleep(12)

                    # Chốt chặn chống bình luận lặp lại (Anti-Duplicate / Idempotency Guard):
                    # Chỉ kiểm tra xem bình luận mồi này (seedText) đã tồn tại hay chưa, tránh nhầm với sidebar 'Học viện nhà sáng tạo'
                    already_commented = page.evaluate("""(seedText) => {
                        const allElements = Array.from(document.querySelectorAll('*'));
                        const commentCards = allElements.filter(el => 
                            el.innerText && 
                            (el.innerText.includes('Trả lời') || el.innerText.includes('Reply')) && 
                            (el.innerText.includes('Xóa') || el.innerText.includes('Delete')) &&
                            el.children.length <= 12 &&
                            el.innerText.length < 600
                        );
                        for (let card of commentCards) {
                            const t = card.innerText || '';
                            const matchesSeed = seedText && t.includes(seedText.trim().slice(0, 15));
                            if (matchesSeed) return true;
                        }
                        return false;
                    }""", comment_text)

                    if already_commented:
                        log_event("INFO", f"🛡️ [ANTI-DUPLICATE] Bình luận mồi này đã tồn tại trên video trong Studio. Bỏ qua việc gõ lại để chống spam!")
                    else:
                        # Đảm bảo ô seed comment ở đầu trang được kích hoạt:
                        # Nếu trang đang focus vào ô reply của viewer (placeholder = 'Trả lời bình luận'),
                        # ta cần click vào khu vực trống để deselect row đó, rồi click vào ô seed comment.
                        try:
                            # Nhấn Escape để đóng bất kỳ reply box nào đang mở
                            page.keyboard.press("Escape")
                            time.sleep(0.5)
                        except Exception:
                            pass

                        top_textarea = page.locator('textarea.css-18yze8z, textarea[maxlength="150"], textarea#comment-input, textarea').first
                        if top_textarea.is_visible(timeout=15000):
                            top_textarea.click()
                            time.sleep(0.3)
                            log_event("INFO", f"✍️ Đang gõ comment mồi vào Studio top box: '{comment_text}'")
                            for ch in comment_text:
                                page.keyboard.type(ch, delay=random.randint(35, 75))
                            time.sleep(1.0)

                            # Trên TikTok Studio, việc đăng comment mồi ở top box thực hiện bằng phím Enter
                            page.keyboard.press("Enter")
                            time.sleep(3.5)
                        else:
                            raise RuntimeError("Không tìm thấy ô nhập bình luận Studio trên trang video")

                else:
                    # Fallback qua video watch thông thường nếu không có video_id
                    log_event("INFO", f"🔥 [GOLDEN 30-MIN] Đang kết nối video qua TikTok Studio để đăng comment mồi...")
                    studio_content_url = "https://www.tiktok.com/tiktokstudio/content"
                    page.goto(studio_content_url, timeout=35000, wait_until="domcontentloaded")
                    time.sleep(4)
                    video_page = ctx.new_page()
                    video_page.goto(post_url, referer=studio_content_url, timeout=35000, wait_until="domcontentloaded")
                    time.sleep(4)

                    c_icon = video_page.locator('[data-e2e="comment-icon"]').first
                    if c_icon.is_visible(timeout=5000):
                        try:
                            c_icon.click()
                        except Exception:
                            c_icon.click(force=True)
                        time.sleep(3)

                    input_sel = 'div.notranslate.public-DraftEditor-content[contenteditable="true"], [data-e2e="comment-input"] div[contenteditable="true"]'
                    target_input = video_page.locator(input_sel).first
                    if target_input.is_visible(timeout=5000):
                        target_input.click(force=True)
                        for ch in comment_text:
                            video_page.keyboard.type(ch, delay=random.randint(40, 90))
                        time.sleep(1)
                        post_btn = video_page.locator('[data-e2e="comment-post"], button:has-text("Đăng"), button:has-text("Post")').first
                        if post_btn.is_visible(timeout=2000):
                            post_btn.click()
                        else:
                            video_page.keyboard.press("Enter")
                        time.sleep(3)
                    video_page.close()

                try:
                    page.close()
                except Exception:
                    pass

                payload_data["pinned"] = pinned_success
                payload_data["posted_at"] = now_str

                conn = get_connection()
                conn.execute("""
                    UPDATE engagement_tasks 
                    SET status = 'completed', 
                        executed_at = ?, 
                        payload = ?,
                        error_message = NULL
                    WHERE id = ?
                """, (now_str, json.dumps(payload_data, ensure_ascii=False), task_id))
                conn.commit()
                conn.close()

                result = {
                    "success": True,
                    "pinned": pinned_success,
                    "comment_text": comment_text,
                    "message": "Đã đăng comment mồi và hoàn tất quy trình ghim"
                }
                log_event("SUCCESS", f"✅ [GOLDEN 30-MIN] Hoàn thành tác vụ ghim comment Task #{task_id}: '{comment_text}'")

        except Exception as ex:
            err_msg = str(ex)
            logger.exception(f"Lỗi thực thi pin_comment task #{task_id}: {err_msg}")
            log_event("ERROR", f"❌ Lỗi ghim comment Task #{task_id}: {err_msg}")
            conn = get_connection()
            conn.execute("UPDATE engagement_tasks SET status = 'failed', error_message = ? WHERE id = ?", (err_msg, task_id))
            conn.commit()
            conn.close()
            result = {"success": False, "message": err_msg}

        finally:
            set_profile_busy(gpm_id, False)
            gpm_client.stop_profile(gpm_id)

        return result

    def execute_reply_comments_task(self, task_id: int) -> Dict[str, Any]:
        """Thực thi tác vụ quét bình luận khán giả ở phút 20 và AI tự động trả lời qua TikTok Studio"""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT et.*, gp.gpm_id, gp.tiktok_username, gp.tiktok_nickname, gp.name as profile_name,
                   ut.title, ut.variant_tag, ut.post_url as ut_post_url
            FROM engagement_tasks et
            JOIN gpm_profiles gp ON et.gpm_profile_id = gp.id
            LEFT JOIN upload_tasks ut ON et.upload_task_id = ut.id
            WHERE et.id = ?
        """, (task_id,))
        task = cursor.fetchone()
        if not task:
            conn.close()
            return {"success": False, "message": f"Không tìm thấy engagement task #{task_id}"}
        task = dict(task)

        gpm_id = task["gpm_id"]
        if is_profile_busy(gpm_id):
            conn.close()
            return {"success": False, "busy": True, "message": f"Profile {task['profile_name']} đang bận"}

        set_profile_busy(gpm_id, True)
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("UPDATE engagement_tasks SET status = 'processing' WHERE id = ?", (task_id,))
        conn.commit()
        conn.close()

        result = {"success": False, "message": ""}
        try:
            gpm_client.ensure_gpm_running()
            remote_address = gpm_client.start_profile(gpm_id, low_ram_mode=False, mute_audio=True)
            if not remote_address:
                raise RuntimeError(f"Không thể khởi động GPM profile {gpm_id}")

            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                browser = p.chromium.connect_over_cdp(f"http://{remote_address}")
                ctx = browser.contexts[0] if browser.contexts else browser.new_context()
                page = ctx.new_page()

                post_url = task.get("post_url") or task.get("ut_post_url") or ""
                video_id = post_url.rstrip("/").split("/")[-1] if post_url else ""
                if video_id and video_id.isdigit():
                    studio_comment_url = f"https://www.tiktok.com/tiktokstudio/comment/{video_id}"
                else:
                    studio_comment_url = "https://www.tiktok.com/tiktokstudio/comment"

                log_event("INFO", f"💬 [STUDIO AUTO-REPLY] Đang mở TikTok Studio Comment Hub ({studio_comment_url})...")
                page.goto(studio_comment_url, timeout=35000, wait_until="domcontentloaded")
                time.sleep(5)

                # Chờ cho đến khi bảng bình luận (các hàng tr hoặc nút Trả lời) xuất hiện
                for _ in range(20):
                    has_rows = page.evaluate("() => document.querySelectorAll('tr').length > 0 || document.querySelectorAll('button.css-147bpw9').length > 0")
                    if has_rows:
                        break
                    time.sleep(1)
                time.sleep(2)

                author_username = (task["tiktok_username"] or "").lower().lstrip("@")
                author_nickname = (task.get("tiktok_nickname") or "").lower().strip()

                raw_comments = page.evaluate("""() => {
                    const list = [];
                    const allButtons = Array.from(document.querySelectorAll('button, div, span')).filter(b => 
                        (b.innerText || '').trim() === 'Trả lời' || (b.innerText || '').trim() === 'Reply'
                    );

                    const distinctButtons = [];
                    for (let b of allButtons) {
                        if (b.tagName === 'BUTTON' || (b.tagName === 'DIV' && b.parentElement && b.parentElement.tagName !== 'BUTTON')) {
                            distinctButtons.push(b);
                        }
                    }

                    for (let i = 0; i < distinctButtons.length; i++) {
                        const b = distinctButtons[i];
                        let card = b.closest('tr') || b.closest('div[class*="css-x6de05"]') || b.closest('div[class*="css-1c68mv7"]') || (b.parentElement ? b.parentElement.parentElement.parentElement : b);
                        const fullCardText = card ? card.innerText : '';
                        const lines = fullCardText.split('\\n').map(s => s.trim()).filter(Boolean);

                        let author = '';
                        let commentText = '';
                        for (let j = 0; j < lines.length; j++) {
                            const l = lines[j];
                            if (l === 'Trả lời' || l === 'Reply' || l === 'Xóa' || l === 'Delete' || /^\\d+$/.test(l)) continue;
                            if (/^\\d+\\s*(giây|phút|giờ|ngày|tháng|năm|s|m|h|d|w)/.test(l)) continue;
                            if (!author) {
                                author = l.replace(/^@/, '');
                            } else if (!commentText) {
                                commentText = l;
                                break;
                            }
                        }

                        const isCreator = (fullCardText.includes('Tác giả') || fullCardText.includes('Creator') || fullCardText.includes('Nhà sáng tạo')) && !fullCardText.includes('Học viện');

                        list.push({
                            index: i,
                            author: author,
                            text: commentText,
                            is_creator: isCreator,
                            full_text: fullCardText
                        });
                    }
                    return list;
                }""")

                # 1. Thu thập lịch sử các bình luận đã trả lời trước đó để chống double-reply
                already_replied_authors = set()
                already_replied_texts = set()
                try:
                    c_hist = get_connection()
                    past_tasks = c_hist.execute("""
                        SELECT payload FROM engagement_tasks 
                        WHERE gpm_profile_id = ? AND task_type = 'reply_comments' AND status = 'completed'
                    """, (task["gpm_profile_id"],)).fetchall()
                    c_hist.close()
                    for pt in past_tasks:
                        if pt["payload"]:
                            p_data = json.loads(pt["payload"])
                            for r in p_data.get("replies", []):
                                if r.get("author"):
                                    already_replied_authors.add(r["author"].lower().lstrip("@"))
                                if r.get("text"):
                                    already_replied_texts.add(r["text"].strip().lower()[:30])
                except Exception as ex:
                    logger.warning(f"Không thể đọc lịch sử reply: {ex}")

                # 2. Chuẩn bị thông tin tiêu đề video để đối chiếu card trong Studio
                clean_target_title = (task.get("title") or "").strip().lower()
                title_snippet = clean_target_title[:25] if len(clean_target_title) >= 10 else clean_target_title

                log_event("INFO", f"💬 [STUDIO SCAN] Tìm thấy {len(raw_comments)} mục bình luận trong Studio. Đang lọc theo video '{task.get('title') or 'Tất cả'}'...")
                candidate_comments = []
                for item in raw_comments:
                    u = item["author"].lower().lstrip("@")
                    t = item["text"].strip()
                    if not t or item.get("is_creator"):
                        continue
                    # Lọc bỏ tác giả chính chủ
                    if u and (u == author_username or u == author_nickname or author_username in u or (author_nickname and author_nickname in u)):
                        continue
                    # Lọc đối chiếu video mục tiêu nếu tiêu đề được chỉ định (chỉ áp dụng khi ở trang tổng không có video_id)
                    is_single_video_page = bool(video_id and video_id.isdigit())
                    if not is_single_video_page and title_snippet and title_snippet not in item["full_text"].lower():
                        logger.info(f"Bỏ qua comment không thuộc video '{task['title']}': @{u}")
                        continue
                    # Lọc chống reply lặp lại cho cùng một bình luận / khán giả
                    if u in already_replied_authors or t[:30].lower() in already_replied_texts:
                        logger.info(f"Bỏ qua comment đã được trả lời trước đó: @{u}")
                        continue

                    candidate_comments.append(item)

                log_event("INFO", f"💬 [STUDIO SCAN] Số bình luận khán giả hợp lệ cần trả lời: {len(candidate_comments)}")

                if not candidate_comments:
                    log_event("INFO", f"ℹ️ [STUDIO AUTO-REPLY] Không có bình luận mới từ khán giả cần trả lời trên @{task['tiktok_username']}.")
                    conn = get_connection()
                    conn.execute("""
                        UPDATE engagement_tasks 
                        SET status = 'completed', 
                            executed_at = ?, 
                            payload = ?,
                            error_message = NULL
                        WHERE id = ?
                    """, (now_str, json.dumps({"replies": [], "note": "Chưa có bình luận khán giả mới trong Studio"}, ensure_ascii=False), task_id))
                    conn.commit()
                    conn.close()
                    result = {"success": True, "replies_count": 0, "message": "Không có bình luận cần trả lời"}
                    return result

                # Chọn số lượng phản hồi tự nhiên ngẫu nhiên từ 2 đến 4 bình luận (Anti-Pattern / Humanized Engagement)
                reply_limit = min(len(candidate_comments), random.randint(2, 4))
                target_candidates = candidate_comments[:reply_limit]
                log_event("INFO", f"💬 [STUDIO AUTO-REPLY] Chọn ngẫu nhiên {len(target_candidates)} bình luận mới nhất để tương tác thảo luận...")
                ai_replies = self.generate_comment_replies(
                    video_title=task["title"] or "TikTok Video",
                    comments_list=target_candidates
                )

                sent_replies = []
                for rep_item in ai_replies:
                    rep_text = rep_item.get("reply", "")
                    if not rep_text:
                        continue

                    rep_author = (rep_item.get("author") or "").lower().lstrip("@")
                    rep_comment_snippet = (rep_item.get("text") or "")[:20].lower()

                    # Tìm chính xác hàng (tr) của riêng bình luận này để tránh click nhầm hàng khác hoặc hàng ghim
                    target_row = page.locator(f'tr:has-text("{rep_author}")').first
                    if not target_row.is_visible(timeout=3000) and rep_comment_snippet:
                        target_row = page.locator(f'tr:has-text("{rep_comment_snippet}")').first

                    if target_row and target_row.is_visible(timeout=3000):
                        try:
                            target_row.scroll_into_view_if_needed()
                            time.sleep(0.5)

                            # Click nút 'Trả lời' thuộc chính hàng (row) này
                            reply_btn = target_row.locator('button.css-147bpw9, button:has-text("Trả lời"), button:has-text("Reply")').first
                            if reply_btn.is_visible(timeout=2000):
                                reply_btn.click()
                                time.sleep(1.5)

                            # Textarea reply xuất hiện NGAY TRONG hàng này
                            row_ta = target_row.locator('textarea').first
                            if row_ta.is_visible(timeout=3000):
                                row_ta.click()
                                time.sleep(0.3)

                                # Gõ câu trả lời vào textarea của row
                                for ch in rep_text:
                                    page.keyboard.type(ch, delay=random.randint(30, 65))
                                time.sleep(1.0)

                                # Gửi phản hồi bằng phím Enter
                                page.keyboard.press("Enter")
                                time.sleep(3.5)
                                sent_replies.append(rep_item)
                                log_event("SUCCESS", f"💬 [STUDIO REPLY] Đã trả lời trực tiếp bình luận của @{rep_item['author']}: '{rep_text}'")
                        except Exception as click_err:
                            logger.warning(f"Lỗi khi gửi reply cho @{rep_author}: {click_err}")

                    # Nghỉ ngơi giữa các lượt rep
                    time.sleep(random.uniform(2.5, 4.5))

                try:
                    page.close()
                except Exception:
                    pass

                conn = get_connection()
                conn.execute("""
                    UPDATE engagement_tasks 
                    SET status = 'completed', 
                        executed_at = ?, 
                        payload = ?,
                        error_message = NULL
                    WHERE id = ?
                """, (now_str, json.dumps({"replies": sent_replies}, ensure_ascii=False), task_id))
                conn.commit()
                conn.close()

                result = {
                    "success": True,
                    "replies_count": len(sent_replies),
                    "replies": sent_replies,
                    "message": f"Đã trả lời thành công {len(sent_replies)} bình luận qua TikTok Studio"
                }
                log_event("SUCCESS", f"✅ [STUDIO AUTO-REPLY] Hoàn thành trả lời bình luận Task #{task_id}: {len(sent_replies)} bình luận đã gửi.")

        except Exception as ex:
            err_msg = str(ex)
            logger.exception(f"Lỗi thực thi Studio reply_comments task #{task_id}: {err_msg}")
            log_event("ERROR", f"❌ Lỗi trả lời Studio Task #{task_id}: {err_msg}")
            conn = get_connection()
            conn.execute("UPDATE engagement_tasks SET status = 'failed', error_message = ? WHERE id = ?", (err_msg, task_id))
            conn.commit()
            conn.close()
            result = {"success": False, "message": err_msg}

        finally:
            set_profile_busy(gpm_id, False)
            gpm_client.stop_profile(gpm_id)

        return result


engagement_bot = EngagementBot()

