import json
import random
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from backend.database import get_connection, log_event, log_campaign_event

class ContentDistributor:
    """
    Phân phối nội dung theo tài khoản:
    - Gán kênh nguồn cho nhóm tài khoản
    - Chống đăng trùng: mỗi clip chỉ gán cho 1 tài khoản duy nhất
    - Giới hạn số video mỗi ngày (daily cap) & giờ đăng ngẫu nhiên
    - Hỗ trợ làm nóng tài khoản mới (warm-up pacing)
    """
    def __init__(self, default_daily_limit: int = 2):
        self.default_daily_limit = default_daily_limit

    def get_global_min_interval(self, cursor=None) -> int:
        """Lấy cấu hình giãn cách tối thiểu toàn cục từ bảng settings, mặc định 60 phút"""
        try:
            local_conn = None
            if not cursor:
                local_conn = get_connection()
                cur = local_conn.cursor()
            else:
                cur = cursor
            cur.execute("SELECT value FROM settings WHERE key IN ('min_account_cooldown_minutes', 'min_post_interval_minutes')")
            row = cur.fetchone()
            if local_conn:
                local_conn.close()
            if row and row[0]:
                return max(15, int(row[0]))
        except Exception:
            pass
        return 60

    def can_account_post_today(self, gpm_id: str, max_daily: Optional[int] = None) -> bool:
        """Kiểm tra tài khoản đã đạt giới hạn video trong ngày chưa"""
        limit = max_daily or self.default_daily_limit
        today_prefix = datetime.now().strftime("%Y-%m-%d")

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
        SELECT COUNT(*) FROM upload_tasks ut
        JOIN gpm_profiles gp ON ut.gpm_profile_id = gp.id
        WHERE gp.gpm_id = ? AND ut.status = 'completed' AND ut.uploaded_at LIKE ?
        ''', (gpm_id, f"{today_prefix}%"))
        count = cursor.fetchone()[0]
        conn.close()

        return count < limit

    def is_clip_already_assigned(self, video_id: int, part_number: int = 1, cursor=None) -> bool:
        """Kiểm tra clip này (theo part) đã từng được gán hoặc đăng bởi tài khoản nào chưa"""
        local_conn = None
        if not cursor:
            local_conn = get_connection()
            cur = local_conn.cursor()
        else:
            cur = cursor

        cur.execute("""
            SELECT id FROM upload_tasks 
            WHERE video_id = ? AND (part_number = ? OR (part_number IS NULL AND ? = 1))
        """, (video_id, part_number, part_number))
        row = cur.fetchone()
        if local_conn:
            local_conn.close()
        return row is not None

    def format_account_persona_caption(
        self,
        title: str,
        tags: str,
        profile_id: int,
        description: str = ""
    ) -> Tuple[str, str]:
        """
        Đa dạng hóa phong cách đăng bài theo từng tài khoản (Account Persona Styling - Gap 2):
        Tránh triệt để việc 10-20 tài khoản cùng đăng 1 định dạng caption, cùng 1 bộ hashtag y hệt nhau
        khiến thuật toán TikTok phát hiện behavioral fingerprint của Farm.
        - Xoay vòng 4 kiểu định dạng tiêu đề (Persona framing)
        - Đảo ngẫu nhiên thứ tự hashtag theo seed tài khoản
        - Loại bỏ 100% dead tags (#fyp, #viral)
        """
        raw_title = (title or "").strip()
        persona_idx = profile_id % 4

        # 1. Đa dạng hóa phong cách tiêu đề
        if persona_idx == 0:
            persona_title = f"{raw_title} 🤯"
        elif persona_idx == 1:
            persona_title = f"{raw_title} — What do you think? 👇"
        elif persona_idx == 2:
            persona_title = f"Wait for it: {raw_title} 👀"
        else:
            persona_title = raw_title

        # 2. Xử lý mô tả và hashtag riêng biệt:
        # BẢO TỒN NGUYÊN VẸN cấu trúc ngữ pháp câu của phần mô tả (TUYỆT ĐỐI KHÔNG SHUFFLE từ ngữ thường).
        # Chỉ tách riêng các từ bắt đầu bằng '#' để lọc bỏ dead tags và đảo vị trí hashtag.
        banned = {"#fyp", "#viral", "#foryou", "#xuhuong", "#xuhuongtiktok", "#trending"}
        
        words = (tags or "").split()
        desc_words = []
        hashtags = []
        for w in words:
            w_strip = w.strip()
            if not w_strip:
                continue
            if w_strip.startswith("#"):
                if w_strip.lower() not in banned and w_strip not in hashtags:
                    hashtags.append(w_strip)
            else:
                desc_words.append(w_strip)
        
        # Chỉ đảo ngẫu nhiên thứ tự hashtag
        if hashtags:
            rng = random.Random(profile_id * 31 + len(raw_title))
            rng.shuffle(hashtags)
        
        desc_part = " ".join(desc_words).strip()
        tags_part = " ".join(hashtags).strip()
        
        if desc_part and tags_part:
            persona_tags = f"{desc_part}\n\n{tags_part}"
        elif tags_part:
            persona_tags = tags_part
        else:
            persona_tags = desc_part

        return persona_title, persona_tags

    def generate_random_schedule_time(self, start_hour: int = 9, end_hour: int = 22) -> str:
        """Tạo thời gian đăng ngẫu nhiên trong khung giờ quy định"""
        now = datetime.now()
        target_hour = random.randint(start_hour, end_hour)
        target_minute = random.randint(0, 59)
        scheduled = now.replace(hour=target_hour, minute=target_minute, second=0)

        # Nếu giờ đã qua trong ngày -> Lên lịch cho ngày mai
        if scheduled <= now:
            scheduled += timedelta(days=1)

        return scheduled.strftime("%Y-%m-%d %H:%M:%S")

    def schedule_campaign_upload(
        self,
        video_id: int,
        campaign: Dict[str, Any],
        title: str,
        tags: str,
        video_path: Optional[str] = None,
        part_number: int = 1,
        force_profile_id: Optional[int] = None,
        variant_tag: str = "",
        hook_copy: str = ""
    ) -> Optional[Dict[str, Any]]:
        """
        Gán video đã render vào hàng đợi upload của chiến dịch:
        1. Chống trùng lặp theo Part (tránh gán 1 part nhiều lần)
        2. Chọn profile GPM thích hợp (hoặc giữ cùng profile cho chuỗi Part 1, 2, 3...)
        3. Tính toán khung giờ đăng tiếp theo dựa trên post_schedule & random_delay_minutes
        4. Tạo task trong upload_tasks và ghi log chiến dịch
        """
        conn = get_connection()
        cursor = conn.cursor()

        if campaign.get("auto_upload") == 0:
            conn.close()
            log_campaign_event(campaign.get("id", 0), "INFO", "distribute", f"Chiến dịch #{campaign.get('id', 0)} tắt 'Tự động tải lên TikTok' -> Bỏ qua lập lịch đăng cho video #{video_id} (Part {part_number}).")
            return None

        if self.is_clip_already_assigned(video_id, part_number=part_number, cursor=cursor):
            conn.close()
            return None

        # 1. Lấy danh sách GPM profiles của chiến dịch
        gpm_ids = []
        try:
            raw_gpm = campaign.get("gpm_profile_ids")
            if isinstance(raw_gpm, list):
                gpm_ids = raw_gpm
            elif isinstance(raw_gpm, str) and raw_gpm.strip():
                gpm_ids = json.loads(raw_gpm)
        except Exception:
            pass
        if not gpm_ids and campaign.get("gpm_profile_id"):
            gpm_ids = [campaign["gpm_profile_id"]]

        # Clean integer IDs
        clean_gpm_ids = []
        for gid in (gpm_ids or []):
            try:
                clean_gpm_ids.append(int(gid))
            except (ValueError, TypeError):
                pass

        if not clean_gpm_ids:
            conn.close()
            log_campaign_event(campaign.get("id", 0), "WARNING", "distribute", f"Chiến dịch không có profile GPMLogin nào để phân phối video #{video_id} (Part {part_number}).")
            return None

        # Chunked fetch of profiles to safely support hundreds/thousands of accounts without exceeding SQLite variable limits
        profiles = []
        for i in range(0, len(clean_gpm_ids), 400):
            chunk = clean_gpm_ids[i:i + 400]
            placeholders = ",".join("?" for _ in chunk)
            cursor.execute(f"SELECT * FROM gpm_profiles WHERE id IN ({placeholders})", tuple(chunk))
            profiles.extend([dict(r) for r in cursor.fetchall()])

        if not profiles:
            conn.close()
            return None

        # Sắp xếp hoặc chọn profile
        mode = campaign.get("distribution_mode", "round_robin")
        daily_limit = campaign.get("daily_limit", self.default_daily_limit)

        chosen_profile = None
        # Nếu chỉ định ép profile (ví dụ Part 2, Part 3 cùng nick với Part 1)
        if force_profile_id:
            for p in profiles:
                if p["id"] == force_profile_id:
                    chosen_profile = p
                    break

        if not chosen_profile:
            today_prefix = datetime.now().strftime("%Y-%m-%d")
            all_p_ids = [p["id"] for p in profiles]
            counts_map = {p["id"]: 0 for p in profiles}
            completed_map = {p["id"]: 0 for p in profiles}

            # Batch query for high-performance distribution across hundreds of accounts
            for i in range(0, len(all_p_ids), 400):
                chunk = all_p_ids[i:i + 400]
                ph = ",".join("?" for _ in chunk)
                # Count total scheduled/uploaded today
                cursor.execute(f"""
                    SELECT gpm_profile_id, COUNT(*) as cnt FROM upload_tasks
                    WHERE gpm_profile_id IN ({ph}) AND (uploaded_at LIKE ? OR scheduled_time LIKE ?)
                    GROUP BY gpm_profile_id
                """, (*chunk, f"{today_prefix}%", f"{today_prefix}%"))
                for r in cursor.fetchall():
                    counts_map[r[0]] = r[1]

                # Count completed today
                cursor.execute(f"""
                    SELECT gpm_profile_id, COUNT(*) as cnt FROM upload_tasks
                    WHERE gpm_profile_id IN ({ph}) AND status = 'completed' AND uploaded_at LIKE ?
                    GROUP BY gpm_profile_id
                """, (*chunk, f"{today_prefix}%"))
                for r in cursor.fetchall():
                    completed_map[r[0]] = r[1]

            if mode == "random":
                random.shuffle(profiles)
                for p in profiles:
                    if completed_map.get(p["id"], 0) < daily_limit:
                        chosen_profile = p
                        break
            else:
                # Round-Robin: sắp xếp theo profile có ít video hôm nay nhất
                scored = sorted([(counts_map.get(p["id"], 0), p) for p in profiles], key=lambda x: x[0])
                for cnt, p in scored:
                    if cnt < daily_limit and completed_map.get(p["id"], 0) < daily_limit:
                        chosen_profile = p
                        break

        if not chosen_profile:
            # Nếu tất cả đã chạm giới hạn hôm nay, gán cho profile ít việc nhất và lên lịch cho ngày mai
            chosen_profile = profiles[0]

        # Tính toán scheduled_time (tái sử dụng cursor tránh mở connection mới)
        # Tính toán giai đoạn tài khoản (Warm-up Ngày 1-3 vs Tăng tốc Ngày 4-14):
        from backend.modules.account_warmup import account_warmup
        growth_info = account_warmup.get_profile_growth_stage(chosen_profile["id"])
        is_warmup_mode = campaign.get("warmup_mode") == 1 or campaign.get("auto_pacing")

        if is_warmup_mode and growth_info["stage"] == "warmup":
            # Giai doan 1: Ngay 1 - 3 (Khoa chat khung gio vang de nuoi nick)
            schedule_str = "11:30, 19:30"
            daily_limit = min(campaign.get("daily_limit") or 2, 2)
            min_interval = 240
        elif is_warmup_mode and growth_info["stage"] == "acceleration":
            # Giai doan 2: Ngay 4 - 14 (Khung gio tang toc theo chum Part)
            schedule_str = "07:00, 11:45, 17:30, 20:30"
            daily_limit = min(campaign.get("daily_limit") or 4, 4)
            min_interval = 120
        else:
            # Giai doan 3: Sau ngay 14 (Tai khoan da on dinh truong thanh)
            # HOAC Chien dich khong bat warmup: Su dung 100% Cau Hinh "Khung Gio Dang Bai" tren UI!
            schedule_str = campaign.get("post_schedule") or "07:00, 11:45, 17:30, 20:30"
            daily_limit = campaign.get("daily_limit") or self.default_daily_limit
            camp_min = campaign.get("min_post_interval_minutes")
            min_interval = int(camp_min) if (camp_min and int(camp_min) > 0) else self.get_global_min_interval(cursor=cursor)

        # Đảm bảo tuần tự Part tuyệt đối: Part 2 phải xếp lịch SAU Part 1 ít nhất min_interval
        earliest_allowed = None
        if part_number > 1:
            cursor.execute("""
                SELECT scheduled_time FROM upload_tasks
                WHERE video_id = ? AND part_number = ?
                ORDER BY id DESC LIMIT 1
            """, (video_id, part_number - 1))
            prev_row = cursor.fetchone()
            if prev_row and prev_row[0]:
                try:
                    prev_dt = datetime.strptime(prev_row[0], "%Y-%m-%d %H:%M:%S")
                    earliest_allowed = prev_dt + timedelta(minutes=min_interval)
                except Exception:
                    pass

        scheduled_time = self._calculate_next_post_time(
            schedule_str, 
            campaign.get("random_delay_minutes", 10), 
            profile_id=chosen_profile["id"], 
            cursor=cursor,
            min_interval_minutes=min_interval,
            earliest_allowed_time=earliest_allowed
        )

        # Áp dụng Gap 2: Account Persona Styling & Hashtag Permutation
        persona_title, persona_tags = self.format_account_persona_caption(
            title=title,
            tags=tags,
            profile_id=chosen_profile["id"]
        )

        cursor.execute("""
            INSERT INTO upload_tasks (video_id, gpm_profile_id, title, tags, status, scheduled_time, video_path, part_number, variant_tag, hook_copy)
            VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?)
        """, (video_id, chosen_profile["id"], persona_title, persona_tags, scheduled_time, video_path or '', part_number, variant_tag or '', hook_copy or ''))
        task_id = cursor.lastrowid

        cid = campaign.get("id", 0)
        pname = chosen_profile.get("name") or chosen_profile.get("gpm_id")
        log_msg = f"Đã lên lịch đăng video #{video_id} (Part {part_number}) cho profile '{pname}' vào lúc {scheduled_time} (Task #{task_id}, giãn cách ≥ {min_interval}p)."
        cursor.execute(
            "INSERT INTO campaign_logs (campaign_id, level, action, message, details) VALUES (?, 'SUCCESS', 'distribute', ?, '')",
            (cid, log_msg)
        )
        cursor.execute(
            "INSERT INTO system_logs (level, message, details) VALUES ('SUCCESS', ?, '')",
            (f"[Chiến dịch #{cid}] {log_msg}",)
        )
        conn.commit()
        conn.close()

        # Ghi song song log file
        try:
            from backend.logger import get_logger
            get_logger("system").info(f"[Chiến dịch #{cid}] {log_msg}")
        except Exception:
            pass

        return {
            "task_id": task_id,
            "profile_id": chosen_profile["id"],
            "profile_name": pname,
            "scheduled_time": scheduled_time,
            "part_number": part_number
        }

    def _calculate_next_post_time(
        self, 
        schedule_str: str, 
        random_delay_minutes: int = 10, 
        profile_id: int = None, 
        cursor = None,
        min_interval_minutes: int = 60,
        earliest_allowed_time: Optional[datetime] = None
    ) -> str:
        """
        Tìm slot giờ đăng tiếp theo gần nhất từ danh sách post_schedule.
        Đảm bảo TUYỆT ĐỐI không bao giờ đăng quá gần nhau trên cùng 1 tài khoản (giãn cách tối thiểu min_interval_minutes, mặc định 60 phút).
        Đồng thời nếu có earliest_allowed_time (từ Part trước), slot bắt buộc phải >= earliest_allowed_time.
        Kiểm tra cả các video đang chờ duyệt/xử lý và các video đã đăng thành công trong 48 giờ qua.
        """
        slots = [s.strip() for s in schedule_str.split(",") if s.strip()]
        now = datetime.now()
        candidates = []
        if min_interval_minutes is None:
            min_interval_minutes = self.get_global_min_interval(cursor=cursor)
        min_interval_seconds = max(15, min_interval_minutes) * 60

        # Mốc thời gian hợp lệ tối thiểu (ít nhất 10 phút sau hiện tại, và sau Part trước nếu có)
        min_valid_threshold = now + timedelta(minutes=10)
        if earliest_allowed_time and earliest_allowed_time > min_valid_threshold:
            min_valid_threshold = earliest_allowed_time

        # Tạo candidate slots cho 7 ngày liên tiếp để luôn có đủ slot an toàn không bị chen lấn
        for day_offset in range(7):
            base_date = now + timedelta(days=day_offset)
            for s in slots:
                try:
                    parts = s.split(":")
                    sh, sm = int(parts[0]), int(parts[1])
                    t_slot = base_date.replace(hour=sh, minute=sm, second=0, microsecond=0)
                    # Thêm độ trễ jitter ngẫu nhiên
                    jitter = random.randint(-abs(random_delay_minutes), abs(random_delay_minutes))
                    t_slot_jittered = t_slot + timedelta(minutes=jitter)

                    # Phải sau mốc hợp lệ tối thiểu và không rơi vào khung giờ chết ban đêm (00:00 - 06:45)
                    if t_slot_jittered >= min_valid_threshold and not (0 <= t_slot_jittered.hour < 6):
                        candidates.append(t_slot_jittered)
                except Exception:
                    pass

        candidates.sort()

        # Kiểm tra lịch sử và lịch trình của profile để tránh trùng hoặc quá gần giờ đăng
        existing_times = []
        if profile_id:
            try:
                local_conn = None
                if not cursor:
                    local_conn = get_connection()
                    cur = local_conn.cursor()
                else:
                    cur = cursor

                # 1. Các task đang đợi hoặc đang đăng của profile này
                cur.execute("""
                    SELECT scheduled_time FROM upload_tasks
                    WHERE gpm_profile_id = ? AND status IN ('queued', 'processing')
                      AND scheduled_time IS NOT NULL
                """, (profile_id,))
                for row in cur.fetchall():
                    if row[0]:
                        try:
                            existing_times.append(datetime.strptime(row[0], "%Y-%m-%d %H:%M:%S"))
                        except Exception:
                            pass

                # 2. Các task đã đăng thành công trong 48 giờ qua (tránh đăng lại quá sát bài vừa đăng)
                two_days_ago = (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S")
                cur.execute("""
                    SELECT uploaded_at FROM upload_tasks
                    WHERE gpm_profile_id = ? AND status = 'completed'
                      AND uploaded_at >= ?
                """, (profile_id, two_days_ago))
                for row in cur.fetchall():
                    if row[0]:
                        try:
                            existing_times.append(datetime.strptime(row[0], "%Y-%m-%d %H:%M:%S"))
                        except Exception:
                            pass

                if local_conn:
                    local_conn.close()
            except Exception:
                pass

        # 3. Gap 2: Farm-Level Anti-Clustering Guard (Giãn cách toàn Farm)
        farm_scheduled_times = []
        min_farm_stagger_seconds = 12 * 60  # Giãn cách tối thiểu 12 phút giữa 2 tài khoản bất kỳ trong farm
        if profile_id:
            try:
                cur.execute("""
                    SELECT scheduled_time FROM upload_tasks
                    WHERE gpm_profile_id != ? AND status IN ('queued', 'processing')
                      AND scheduled_time >= ?
                """, (profile_id, now.strftime("%Y-%m-%d %H:%M:%S")))
                for row in cur.fetchall():
                    if row[0]:
                        try:
                            farm_scheduled_times.append(datetime.strptime(row[0], "%Y-%m-%d %H:%M:%S"))
                        except Exception:
                            pass
            except Exception:
                pass

        # Tìm slot đầu tiên thỏa mãn CẢ HAI điều kiện:
        # a) Cách xa bài của chính tài khoản này >= min_interval_seconds
        # b) Cách xa bài của các tài khoản khác trong Farm >= min_farm_stagger_seconds
        for cand in candidates:
            account_safe = not any(abs((cand - ext).total_seconds()) < min_interval_seconds for ext in existing_times)
            farm_safe = not any(abs((cand - fext).total_seconds()) < min_farm_stagger_seconds for fext in farm_scheduled_times)
            if account_safe and farm_safe:
                return cand.strftime("%Y-%m-%d %H:%M:%S")

        # Fallback: Nếu lịch dày đặc, chọn slot thỏa mãn giãn cách của chính tài khoản này
        for cand in candidates:
            if not any(abs((cand - ext).total_seconds()) < min_interval_seconds for ext in existing_times):
                return cand.strftime("%Y-%m-%d %H:%M:%S")

        # Fallback an toàn: Lấy mốc thời gian lớn nhất, cộng thêm min_interval_minutes
        ref_times = [now] + existing_times
        if earliest_allowed_time:
            ref_times.append(earliest_allowed_time)
        reference_time = max(ref_times)
        safe_fallback = reference_time + timedelta(minutes=min_interval_minutes)
        return safe_fallback.strftime("%Y-%m-%d %H:%M:%S")

distributor = ContentDistributor()
