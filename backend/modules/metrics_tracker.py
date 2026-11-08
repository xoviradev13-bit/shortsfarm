from datetime import datetime
from typing import Dict, Any, List, Optional
from backend.database import get_connection, log_event
from backend.modules.notifier import notifier

class MetricsTracker:
    def update_profile_stats(
        self,
        gpm_id: str,
        followers: int,
        total_views: int,
        username: str = "",
        nickname: str = "",
        tiktok_uid: str = "",
        sec_uid: str = "",
        platform: str = "tiktok",
        min_followers_threshold: Optional[int] = None,
        min_views_threshold: int = 100000,
        require_views: bool = False
    ) -> Dict[str, Any]:
        """
        Cập nhật số follower, view, username, nickname, tiktok_uid & sec_uid cho profile. 
        Nếu phát hiện cùng tiktok_uid đăng nhập trên profile khác -> Tự động chuyển giao (migrate)
        và cập nhật chính xác tài khoản.
        """
        conn = get_connection()
        cursor = conn.cursor()

        # Nạp ngưỡng follower/sub theo cấu hình nếu không truyền vào cụ thể
        plat = (platform or "tiktok").lower()
        if min_followers_threshold is None:
            try:
                from backend.database import get_follower_thresholds
                thresholds = get_follower_thresholds()
                min_followers_threshold = thresholds.get(plat, thresholds.get("tiktok", 10000))
            except Exception:
                min_followers_threshold = 10000
        
        # Kiểm tra trạng thái cũ
        cursor.execute("SELECT name, followers_count, eligible_10k, COALESCE(notify_status, 'tracking') AS notify_status FROM gpm_profiles WHERE gpm_id = ?", (gpm_id,))
        row = cursor.fetchone()
        
        old_eligible = row["eligible_10k"] if row else 0
        profile_name = row["name"] if row else gpm_id
        current_notify_status = (row["notify_status"] if row and row["notify_status"] else "tracking").lower()
        
        # Làm sạch username, nickname, tiktok_uid & sec_uid
        clean_user = (username or "").strip().lstrip("@")
        clean_nick = (nickname or "").strip()
        clean_uid = (tiktok_uid or "").strip()
        clean_sec = (sec_uid or "").strip()

        # NẾU CÓ TIKTOK_UID HOẶC SEC_UID: Kiểm tra xem tài khoản này trước đó có gắn với profile GPM nào khác không
        other_profiles = []
        if clean_uid:
            cursor.execute("SELECT gpm_id, name FROM gpm_profiles WHERE tiktok_uid = ? AND gpm_id != ?", (clean_uid, gpm_id))
            other_profiles = cursor.fetchall()
        elif clean_sec:
            cursor.execute("SELECT gpm_id, name FROM gpm_profiles WHERE sec_uid = ? AND gpm_id != ?", (clean_sec, gpm_id))
            other_profiles = cursor.fetchall()

        for other in other_profiles:
            cursor.execute("""
                UPDATE gpm_profiles 
                SET tiktok_username = '', tiktok_nickname = '', tiktok_uid = '', sec_uid = '',
                    status = 'unlogged', status_reason = 'Tài khoản TikTok đã chuyển sang profile ' || ?
                WHERE gpm_id = ?
            """, (profile_name, other["gpm_id"]))
            log_event("INFO", f"🔄 [MIGRATE ACCOUNT] TikTok {clean_uid or clean_sec} (@{clean_user}) đã chuyển từ profile '{other['name']}' sang '{profile_name}'")

        # Kiểm tra điều kiện Creator Rewards (Follower + Views)
        meets_followers = followers >= min_followers_threshold
        meets_views = (total_views >= min_views_threshold) if require_views else True
        new_eligible = 1 if (meets_followers and meets_views) else 0
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Xác định trạng thái thông báo Telegram
        new_notify_status = current_notify_status
        should_send_alert = False

        if new_eligible == 1 and current_notify_status == 'tracking':
            should_send_alert = True
            new_notify_status = 'sent'

        cursor.execute('''
        UPDATE gpm_profiles SET
            followers_count = ?,
            total_views = ?,
            tiktok_username = COALESCE(NULLIF(?, ''), tiktok_username),
            tiktok_nickname = COALESCE(NULLIF(?, ''), tiktok_nickname),
            tiktok_uid = COALESCE(NULLIF(?, ''), tiktok_uid),
            sec_uid = COALESCE(NULLIF(?, ''), sec_uid),
            eligible_10k = ?,
            notify_status = ?,
            last_checked = ?
        WHERE gpm_id = ?
        ''', (followers, total_views, clean_user, clean_nick, clean_uid, clean_sec, new_eligible, new_notify_status, now_str, gpm_id))
        conn.commit()
        conn.close()

        # Bắn thông báo Telegram khi đạt điều kiện theo dõi
        if should_send_alert:
            log_event("INFO", f"🎉 Tài khoản [{plat.upper()}] {profile_name} đã cán mốc {followers:,} (ngưỡng {min_followers_threshold:,})! Gửi cảnh báo Telegram...")
            notifier.send_threshold_alert(
                profile_name=profile_name,
                username=clean_user,
                followers=followers,
                platform=plat,
                threshold=min_followers_threshold,
                views=total_views
            )

        return {
            "gpm_id": gpm_id,
            "followers": followers,
            "username": clean_user,
            "nickname": clean_nick,
            "tiktok_uid": clean_uid,
            "sec_uid": clean_sec,
            "eligible_10k": bool(new_eligible),
            "notify_status": new_notify_status
        }

    def update_notify_status(self, gpm_id: str, status: str) -> bool:
        """Cập nhật trạng thái theo dõi thông báo 10K cho profile ('tracking', 'sent', 'muted')"""
        status_clean = (status or "").strip().lower()
        if status_clean not in ("tracking", "sent", "muted"):
            return False
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE gpm_profiles SET notify_status = ? WHERE gpm_id = ?", (status_clean, gpm_id))
        conn.commit()
        conn.close()
        return True

    def get_all_eligible_profiles(self) -> List[Dict[str, Any]]:
        """Lấy danh sách các nick đã đủ 10k Follower"""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM gpm_profiles WHERE eligible_10k = 1 ORDER BY followers_count DESC")
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def record_video_metrics(
        self,
        task_id: int,
        views_count: int,
        views_3s_count: int = 0,
        completion_rate: float = 0.0,
        post_url: str = ""
    ) -> bool:
        """
        Ghi nhận chỉ số tương tác thực tế của video (Measurement Layer - Gap 3 & Gap 5):
        - views_count: Tổng lượt xem
        - views_3s_count: Số lượt xem vượt qua 3s đầu (3-Second View Rate)
        - completion_rate: Tỷ lệ xem hết video (0.0 - 100.0%)
        - post_url: Link bài đăng trên TikTok
        """
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE upload_tasks 
                SET views_count = ?,
                    views_3s_count = ?,
                    completion_rate = ?,
                    post_url = COALESCE(NULLIF(?, ''), post_url)
                WHERE id = ?
            """, (views_count, views_3s_count, completion_rate, post_url, task_id))
            conn.commit()
            conn.close()
            log_event("INFO", f"[METRICS] Đã cập nhật chỉ số Task #{task_id}: {views_count:,} views, {views_3s_count:,} views 3s, {completion_rate:.1f}% completion.")
            return True
        except Exception as e:
            log_event("WARNING", f"Lỗi cập nhật chỉ số video Task #{task_id}: {e}")
            return False

    def get_variant_ab_test_report(self) -> Dict[str, Any]:
        """
        Báo cáo phân tích A/B/C Testing biến thể (Measurement Feedback Loop - Gap 3 & Gap 5):
        So sánh hiệu quả giữa các biến thể VarA (Curiosity), VarB (Controversy), VarC (Climax):
        - Tỷ lệ giữ chân 3s đầu (3s Hook Retention)
        - Tỷ lệ xem hết (Completion Rate)
        - Lượt xem trung bình
        - Top các câu Hook chiến thắng (Winning Hooks)
        """
        conn = get_connection()
        cursor = conn.cursor()

        # Thống kê tổng hợp theo từng biến thể
        cursor.execute("""
            SELECT 
                COALESCE(NULLIF(variant_tag, ''), 'Standard') AS variant,
                COUNT(*) AS total_posts,
                SUM(views_count) AS total_views,
                AVG(views_count) AS avg_views,
                SUM(views_3s_count) AS total_3s_views,
                AVG(completion_rate) AS avg_completion_rate
            FROM upload_tasks
            WHERE status = 'completed'
            GROUP BY variant
        """)
        summary_rows = cursor.fetchall()

        variant_stats = {}
        for r in summary_rows:
            v_name = r["variant"]
            t_views = r["total_views"] or 0
            t_3s = r["total_3s_views"] or 0
            retention_3s = round((t_3s / t_views * 100.0), 1) if t_views > 0 else 0.0

            variant_stats[v_name] = {
                "variant": v_name,
                "total_posts": r["total_posts"],
                "total_views": t_views,
                "avg_views": round(r["avg_views"] or 0, 1),
                "total_3s_views": t_3s,
                "retention_rate_3s": retention_3s,
                "avg_completion_rate": round(r["avg_completion_rate"] or 0.0, 1)
            }

        # Lấy Top 5 câu Hook có view cao nhất
        cursor.execute("""
            SELECT hook_copy, variant_tag, title, views_count, views_3s_count, completion_rate
            FROM upload_tasks
            WHERE status = 'completed' AND hook_copy IS NOT NULL AND hook_copy != ''
            ORDER BY views_count DESC, views_3s_count DESC
            LIMIT 5
        """)
        top_hooks = [dict(row) for row in cursor.fetchall()]

        conn.close()

        # Xác định biến thể dẫn đầu
        best_variant = None
        if variant_stats:
            best_variant = max(
                variant_stats.values(), 
                key=lambda x: (x.get("retention_rate_3s", 0) + x.get("avg_completion_rate", 0) + (x.get("avg_views", 0) / 100.0))
            ).get("variant")

        return {
            "variants": variant_stats,
            "top_performing_hooks": top_hooks,
            "winning_variant": best_variant,
            "recommendation": (
                f"Biến thể '{best_variant}' đang có tỷ lệ giữ chân và tương tác cao nhất. Khuyến nghị tăng tỷ trọng phân phối cho biến thể này."
                if best_variant else "Chưa đủ dữ liệu thống kê video để đưa ra kết luận A/B Testing."
            )
        }

metrics_tracker = MetricsTracker()
