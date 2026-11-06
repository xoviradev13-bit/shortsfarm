import os
import json
import time
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional
from backend.database import get_connection, log_event, log_campaign_event
from backend.modules.yt_downloader import yt_downloader

import urllib.parse
import yt_dlp

class YouTubeRSSMonitor:
    """
    Giám sát kênh YouTube lấy video mới nhất với kiến trúc phòng thủ 3 tầng:
    - Tầng 1: RSS Feed chính thức (nhanh, 0 quota)
    - Tầng 2: Fallback YouTube Data API v3 Uploads Playlist (chỉ 1 quota unit, tự động đổi key)
    - Tầng 3: Fallback yt-dlp flat-playlist (hoạt động độc lập, không cần API key)
    """
    def check_channel_rss(self, channel_id: str, limit: int = 10) -> List[Dict[str, str]]:
        try:
            from backend.modules.local_ingestion import is_rss_scan_enabled
            if not is_rss_scan_enabled():
                return []
        except Exception:
            pass
        new_videos: List[Dict[str, str]] = []

        # =====================================================================
        # TẦNG 1: RSS Feed chính thức (0 quota)
        # =====================================================================
        rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
        try:
            req = urllib.request.Request(
                rss_url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            )
            with urllib.request.urlopen(req, timeout=8) as response:
                xml_data = response.read()

            root = ET.fromstring(xml_data)
            ns = {
                "atom": "http://www.w3.org/2005/Atom",
                "yt": "http://www.youtube.com/xml/schemas/2015",
                "media": "http://search.yahoo.com/mrss/"
            }

            for entry in root.findall("atom:entry", ns):
                video_id_el = entry.find("yt:videoId", ns)
                title_el = entry.find("atom:title", ns)
                published_el = entry.find("atom:published", ns)

                if video_id_el is not None and title_el is not None:
                    vid = video_id_el.text
                    title = title_el.text
                    pub = published_el.text if published_el is not None else ""
                    new_videos.append({
                        "video_id": vid,
                        "title": title,
                        "url": f"https://www.youtube.com/watch?v={vid}",
                        "published_at": pub
                    })
            if new_videos:
                return new_videos[:limit]
        except urllib.error.HTTPError as e:
            # Lưu ý quan trọng: YouTube thường trả về 404 cho Google bot/IP rate limit
            # TUYỆT ĐỐI KHÔNG tắt is_active của kênh vì đây là lỗi tạm thời của RSS YouTube
            log_event("WARNING", f"RSS kênh {channel_id} bị chặn/lỗi (HTTP {e.code}). Tự động kích hoạt Fallback...")
        except Exception as e:
            log_event("WARNING", f"Lỗi đọc RSS kênh {channel_id}: {str(e)}. Tự động kích hoạt Fallback...")

        # =====================================================================
        # TẦNG 2: Fallback YouTube Data API v3 (Uploads Playlist: chỉ tốn 1 Quota unit)
        # =====================================================================
        try:
            from backend.modules.yt_scanner import yt_scanner
            api_key = yt_scanner.key_pool.get_active_key()
            if api_key and channel_id.startswith("UC"):
                # Playlist Uploads của bất kỳ kênh nào luôn là UU + [phần còn lại của Channel ID]
                uploads_playlist_id = "UU" + channel_id[2:]
                params = {
                    "part": "snippet",
                    "playlistId": uploads_playlist_id,
                    "maxResults": min(limit, 10),
                    "key": api_key
                }
                api_url = f"https://www.googleapis.com/youtube/v3/playlistItems?{urllib.parse.urlencode(params)}"
                req = urllib.request.Request(api_url, headers={"User-Agent": "ShortsStack/1.0"})
                with urllib.request.urlopen(req, timeout=8) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    for it in data.get("items", []):
                        snippet = it.get("snippet", {})
                        res_id = snippet.get("resourceId", {}).get("videoId")
                        if res_id:
                            new_videos.append({
                                "video_id": res_id,
                                "title": snippet.get("title", ""),
                                "url": f"https://www.youtube.com/watch?v={res_id}",
                                "published_at": snippet.get("publishedAt", "")
                            })
                    if new_videos:
                        log_event("INFO", f"✅ [Fallback API v3] Lấy thành công {len(new_videos)} video từ kênh {channel_id}")
                        return new_videos
        except urllib.error.HTTPError as he:
            if he.code in (403, 429):
                try:
                    from backend.modules.yt_scanner import yt_scanner
                    yt_scanner.key_pool.mark_key_exhausted(api_key, f"HTTP {he.code}")
                except Exception:
                    pass
            log_event("WARNING", f"Fallback YouTube API v3 cho kênh {channel_id} lỗi (HTTP {he.code}), chuyển sang yt-dlp...")
        except Exception as api_err:
            log_event("WARNING", f"Fallback YouTube API v3 cho kênh {channel_id} lỗi: {api_err}, chuyển sang yt-dlp...")

        # =====================================================================
        # TẦNG 3: Fallback yt-dlp flat-playlist (hoàn toàn miễn phí, độc lập)
        # =====================================================================
        try:
            ydl_opts = {
                'quiet': True,
                'extract_flat': True,
                'playlist_items': f'1:{min(limit, 10)}',
                'skip_download': True,
                'no_warnings': True
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                channel_url = f"https://www.youtube.com/channel/{channel_id}/videos"
                info = ydl.extract_info(channel_url, download=False)
                for entry in (info.get('entries') or []):
                    vid = entry.get('id')
                    if vid:
                        new_videos.append({
                            "video_id": vid,
                            "title": entry.get('title', ''),
                            "url": f"https://www.youtube.com/watch?v={vid}",
                            "published_at": ""
                        })
                if new_videos:
                    log_event("INFO", f"✅ [Fallback yt-dlp] Lấy thành công {len(new_videos)} video từ kênh {channel_id}")
                    return new_videos
        except Exception as ytdlp_err:
            log_event("WARNING", f"Fallback yt-dlp cho kênh {channel_id} thất bại: {ytdlp_err}")

        return new_videos

    def handle_video_post_download(
        self,
        file_path: str,
        video_id: str,
        channel_id: str,
        channel_name: str,
        video_title: str,
        duration: float,
        channel_obj: dict,
        force_campaign_id: Optional[int] = None
    ):
        """
        Xử lý video sau khi tải về:
        1. Kiểm tra kênh này có thuộc Chiến Dịch (Campaign) nào đang hoạt động không.
        2. Nếu thuộc Campaign:
           - Áp dụng TOÀN BỘ công thức biên tập (Recipe) của Campaign:
             * video_duration (thời lượng mong muốn)
             * speed_factor (1.03x)
             * flip_horizontal (Lật video)
             * subtitle_enabled (Phụ đề Karaoke)
             * ai_provider & ai_model (Gemini / DeepSeek / OpenAI)
             * render_dir
           - Chạy quy trình Smart AI: Transcribe -> Chọn đoạn Viral -> Viết Hook/Title -> Render Anti-detect
           - Tự động phân phối và lên lịch đăng bài cho dàn nick GPM qua ContentDistributor
        3. Nếu không thuộc Campaign nhưng kênh bật auto_render:
           - Render theo thiết lập mặc định của kênh
        """
        if not force_campaign_id:
            try:
                from backend.scheduler import scheduler
                if not scheduler.is_running:
                    log_event("INFO", f"[RSS WORKER] Đã hủy bước render video '{video_title}' do Background Scheduler đã tạm dừng.")
                    return
                if not getattr(scheduler, "auto_render", True):
                    log_event("INFO", f"[RSS WORKER] Bỏ qua bước auto-render video '{video_title}' do Tự Động Render Toàn Cục đang TẮT (auto_render=OFF).")
                    return
            except Exception:
                pass

        # Chốt chặn kiểm tra file MP4 đầu vào phải tồn tại và không bị rỗng/hỏng
        if not file_path or not os.path.exists(file_path) or os.path.getsize(file_path) < 1024:
            log_event("WARNING", f"Bỏ qua render video {video_id} vì file MP4 đầu vào không tồn tại hoặc bị lỗi (<1KB): '{file_path}'")
            return

        # Kiểm tra cài đặt auto_render của kênh (Cài đặt kênh có mức ưu tiên cao nhất)
        if channel_obj and channel_obj.get("auto_render") == 0:
            log_event("INFO", f"Kênh '{channel_name}' đã TẮT Tự Động Render (auto_render=0), bỏ qua bước render cho video {video_id}.")
            return

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM videos WHERE yt_video_id = ?", (video_id,))
        v_row = cursor.fetchone()
        video_db_id = v_row["id"] if v_row else None

        if force_campaign_id:
            cursor.execute("SELECT * FROM campaigns WHERE id = ?", (force_campaign_id,))
        else:
            cursor.execute("SELECT * FROM campaigns WHERE is_active = 1")
        campaign_candidates = [dict(r) for r in cursor.fetchall()]
        conn.close()

        matched_campaigns = []
        for camp in campaign_candidates:
            ch_ids = []
            try:
                ch_ids = json.loads(camp.get("channel_ids") or "[]")
            except Exception:
                pass
            if not ch_ids and camp.get("channel_id"):
                ch_ids = [camp["channel_id"]]
            if channel_id in ch_ids or force_campaign_id == camp.get("id"):
                matched_campaigns.append(camp)

        if matched_campaigns:
            from backend.modules.ai_video_engine import ai_video_engine
            from backend.modules.distributor import distributor

            for camp in matched_campaigns:
                cid = camp["id"]
                # Kiểm tra ngay nếu Scheduler hoặc Chiến dịch đã bị người dùng tạm dừng
                try:
                    from backend.scheduler import scheduler
                    if not scheduler.is_running:
                        log_event("INFO", f"[RSS WORKER] Bỏ qua biên tập AI video {video_id} do Scheduler đã tạm dừng.")
                        break
                    conn_chk = get_connection()
                    cursor_chk = conn_chk.cursor()
                    cursor_chk.execute("SELECT is_active FROM campaigns WHERE id = ?", (cid,))
                    c_row = cursor_chk.fetchone()
                    conn_chk.close()
                    if not c_row or c_row["is_active"] != 1:
                        log_campaign_event(cid, "INFO", "pipeline", f"Bỏ qua render video {video_id} do chiến dịch '{camp.get('name')}' đã tạm dừng.")
                        continue
                except Exception:
                    pass

                log_campaign_event(cid, "INFO", "pipeline", f"Áp dụng công thức biên tập chiến dịch '{camp['name']}' cho video {video_id} ({video_title})")
                
                # Lấy toàn bộ cài đặt render hiệu lực: Kênh > Chiến dịch > Toàn cục
                sub_settings = self.get_effective_subtitle_settings(channel_obj, camp)
                render_settings = self.get_effective_render_settings(channel_obj, camp)
                narr_settings = self.get_effective_narration_settings(channel_obj, camp)
                hook_settings = self.get_effective_hook_settings(channel_obj, camp)

                try:
                    res = ai_video_engine.process_smart_ai_video(
                        input_file=file_path,
                        video_id=video_id,
                        video_title=video_title,
                        channel_name=channel_name,
                        output_dir=render_settings["render_dir"],
                        custom_provider=camp.get("ai_provider"),
                        custom_model=camp.get("ai_model"),
                        enable_subtitles=sub_settings["enable_subtitles"],
                        target_duration=int(camp.get("video_duration") or 65),
                        flip_horizontal=bool(camp.get("flip_horizontal", 1)),
                        speed_factor=float(camp.get("speed_factor") or 1.03),
                        add_part_label=bool(camp.get("add_part_label", 1)),
                        generate_hook=True,
                        clips_count=int(camp.get("clips_per_video") or 1),
                        subtitle_style=sub_settings["subtitle_style"],
                        subtitle_position=sub_settings["subtitle_position"],
                        bgm_folder=render_settings["bgm_folder"],
                        bgm_volume=render_settings["bgm_volume"],
                        disable_subtitle_for_shorts=sub_settings["disable_subtitle_for_shorts"],
                        generate_variants=hook_settings["generate_variants"],
                        hook_angle=hook_settings["hook_angle"],
                        enable_narration=narr_settings["narration_enabled"],
                        narration_language=narr_settings["narration_language"],
                        voice_gender=narr_settings["voice_gender"],
                        narration_style=narr_settings["narration_style"],
                        disable_narration_for_shorts=narr_settings.get("disable_narration_for_shorts", True),
                        keep_original_script_for_shorts=narr_settings.get("keep_original_script_for_shorts", True),
                        enable_endcard=render_settings.get("endcard_enabled", True),
                        enable_ken_burns=render_settings.get("ken_burns_enabled", True),
                        use_ai_images=narr_settings.get("use_ai_images", False),
                        image_style=narr_settings.get("image_style", "cinematic"),
                        visual_source=narr_settings.get("visual_source", "ai"),
                        ai_image_model=narr_settings.get("ai_image_model", "flux"),
                        ai_video_model=narr_settings.get("ai_video_model", "fal_ltx"),
                        stock_provider=narr_settings.get("stock_provider", "all")
                    )
                    if res.get("status") == "success" and video_db_id:
                        raw_rendered_files = res.get("rendered_files") or ([res.get("rendered_file")] if res.get("rendered_file") else [])
                        # Chốt chặn kiểm tra file render thực tế tồn tại và dung lượng > 1KB
                        rendered_files = [f for f in raw_rendered_files if f and os.path.exists(f) and os.path.getsize(f) > 1024]
                        if not rendered_files:
                            log_campaign_event(cid, "ERROR", "render", f"Hủy lên lịch upload: Toàn bộ file render bị lỗi hoặc rỗng (<1KB) cho video {video_id}.")
                            continue

                        log_campaign_event(cid, "SUCCESS", "render", f"Render Smart AI thành công video {video_id} ({len(rendered_files)} clip) -> {rendered_files[0] if rendered_files else ''}")
                        
                        if camp.get("auto_upload") == 0:
                            log_campaign_event(cid, "INFO", "distribute", f"Video {video_id} ({len(rendered_files)} clip) đã render hoàn tất và lưu tại {rendered_files[0]}. Bỏ qua tải lên TikTok do chiến dịch chọn 'Chỉ render'.")
                            continue

                        is_variant_mode = bool(hook_settings.get("generate_variants"))
                        assigned_profile_id = None
                        used_profile_ids = []

                        for idx, r_file in enumerate(rendered_files, 1):
                            part_title = res.get("ai_title") or video_title
                            is_var_file = any(v in r_file for v in ("_VarA", "_VarB", "_VarC"))
                            var_tag = "VarA" if "_VarA" in r_file else ("VarB" if "_VarB" in r_file else ("VarC" if "_VarC" in r_file else ""))

                            if is_var_file or is_variant_mode:
                                # BIẾN THỂ A/B/C: Rải đều sang 3 TÀI KHOẢN TIKTOK KHÁC NHAU (Round-Robin/Random)
                                force_p_id = None
                                current_part = 1
                            else:
                                # CHUỖI CẮT PART (Part 1, Part 2, Part 3...): Khóa cùng 1 tài khoản để giữ mạch câu chuyện
                                if len(rendered_files) > 1 and f"Part {idx}" not in part_title:
                                    part_title = f"{part_title} - Part {idx}"
                                force_p_id = assigned_profile_id
                                current_part = idx

                            sched_res = distributor.schedule_campaign_upload(
                                video_id=video_db_id,
                                campaign=camp,
                                title=part_title,
                                tags=f"{res.get('ai_hashtags', '')}\n\n{res.get('ai_description', '')}",
                                video_path=r_file,
                                part_number=current_part,
                                force_profile_id=force_p_id,
                                variant_tag=var_tag
                            )
                            if not is_var_file and not is_variant_mode and sched_res and not assigned_profile_id:
                                assigned_profile_id = sched_res.get("profile_id")
                            if sched_res and sched_res.get("profile_id"):
                                used_profile_ids.append(sched_res.get("profile_id"))
                except Exception as e:
                    log_campaign_event(cid, "ERROR", "render", f"Lỗi render AI theo chiến dịch: {str(e)}")
        else:
            if channel_obj.get("auto_render", 1):
                try:
                    from backend.modules.ai_video_engine import ai_video_engine
                    sub_settings = self.get_effective_subtitle_settings(channel_obj, None)
                    render_settings = self.get_effective_render_settings(channel_obj, None)
                    narr_settings = self.get_effective_narration_settings(channel_obj, None)
                    ai_video_engine.auto_slice_and_render_parts(
                        input_file=file_path,
                        video_id=video_id,
                        total_duration=int(duration or 65),
                        channel_name=channel_name,
                        video_title=video_title,
                        output_dir=render_settings["render_dir"],
                        enable_subtitles=sub_settings["enable_subtitles"],
                        subtitle_style=sub_settings["subtitle_style"],
                        subtitle_position=sub_settings["subtitle_position"],
                        bgm_folder=render_settings["bgm_folder"],
                        bgm_volume=render_settings["bgm_volume"],
                        disable_subtitle_for_shorts=sub_settings["disable_subtitle_for_shorts"],
                        enable_narration=narr_settings["narration_enabled"],
                        narration_language=narr_settings["narration_language"],
                        voice_gender=narr_settings["voice_gender"],
                        narration_style=narr_settings["narration_style"],
                        disable_narration_for_shorts=narr_settings.get("disable_narration_for_shorts", True),
                        keep_original_script_for_shorts=narr_settings.get("keep_original_script_for_shorts", True),
                        enable_endcard=render_settings.get("endcard_enabled", True),
                        enable_ken_burns=render_settings.get("ken_burns_enabled", True)
                    )
                except Exception as re_err:
                    log_event("WARNING", f"Lỗi auto-render video {video_id}: {str(re_err)}")

    def get_effective_narration_settings(self, channel_obj: Optional[dict], camp: Optional[dict] = None) -> dict:
        """
        Xác định cấu hình Lồng Tiếng AI (AI Voiceover & Synchronized Subtitles)
        với thứ tự ưu tiên tuyệt đối: Kênh nguồn (Channel) > Chiến dịch (Campaign).
        """
        # 1. Cài đặt từ Chiến dịch (Campaign)
        camp_enabled = bool(camp.get("narration_enabled", 0)) if camp else False
        camp_lang = (camp.get("narration_language") or "original") if camp else "original"
        camp_gender = (camp.get("voice_gender") or "male") if camp else "male"
        camp_style = (camp.get("narration_style") or "giat_gan") if camp else "giat_gan"

        # 2. Cài đặt từ Kênh nguồn (Channel)
        ch_enabled_val = channel_obj.get("narration_enabled") if channel_obj else None
        ch_lang = channel_obj.get("narration_language") if channel_obj else None
        ch_gender = channel_obj.get("voice_gender") if channel_obj else None
        ch_style = channel_obj.get("narration_style") if channel_obj else None

        # --- Phân giải ưu tiên Channel > Campaign ---
        # A. Trạng thái Bật/Tắt:
        if ch_enabled_val == 1:
            eff_enabled = True
        elif ch_enabled_val == -1:
            eff_enabled = False
        else:
            eff_enabled = camp_enabled

        # B. Ngôn ngữ:
        if ch_lang and ch_lang not in ("inherit", "", None):
            eff_lang = ch_lang
        else:
            eff_lang = camp_lang

        # C. Giới tính giọng đọc:
        if ch_gender and ch_gender not in ("inherit", "", None):
            eff_gender = ch_gender
        else:
            eff_gender = camp_gender

        # D. Phong cách kịch bản:
        if ch_style and ch_style not in ("inherit", "", None):
            eff_style = ch_style
        else:
            eff_style = camp_style

        # E. Tắt lồng tiếng cho Shorts (Channel > Campaign > Mặc định True):
        ch_disable_shorts = channel_obj.get("disable_narration_for_shorts") if channel_obj else None
        camp_disable_shorts = camp.get("disable_narration_for_shorts") if camp else None
        if ch_disable_shorts is not None:
            eff_disable_shorts = bool(ch_disable_shorts)
        elif camp_disable_shorts is not None:
            eff_disable_shorts = bool(camp_disable_shorts)
        else:
            eff_disable_shorts = True

        # F. Giữ nguyên văn kịch bản gốc cho Shorts (Channel > Campaign > Mặc định True):
        ch_keep_script = channel_obj.get("keep_original_script_for_shorts") if channel_obj else None
        camp_keep_script = camp.get("keep_original_script_for_shorts") if camp else None
        if ch_keep_script is not None:
            eff_keep_script = bool(ch_keep_script)
        elif camp_keep_script is not None:
            eff_keep_script = bool(camp_keep_script)
        else:
            eff_keep_script = True

        # G. AI Story AI Images (Ưu tiên Channel > Campaign > Mặc định False):
        ch_ai_images = channel_obj.get("use_ai_images") if channel_obj else None
        camp_ai_images = camp.get("use_ai_images") if camp else None
        if ch_ai_images is not None and ch_ai_images != -1:
            eff_use_ai_images = bool(ch_ai_images)
        elif camp_ai_images is not None:
            eff_use_ai_images = bool(camp_ai_images)
        else:
            eff_use_ai_images = False

        # H. Image Style, Visual Source, AI Image Model & Stock Provider (Channel > Campaign > Mặc định):
        eff_img_style = (channel_obj.get("image_style") if channel_obj and channel_obj.get("image_style") else None) or (camp.get("image_style") if camp and camp.get("image_style") else None) or "cinematic"
        eff_v_source = (channel_obj.get("visual_source") if channel_obj and channel_obj.get("visual_source") else None) or (camp.get("visual_source") if camp and camp.get("visual_source") else None) or "ai"
        eff_ai_model = (channel_obj.get("ai_image_model") if channel_obj and channel_obj.get("ai_image_model") else None) or (camp.get("ai_image_model") if camp and camp.get("ai_image_model") else None) or "flux"
        eff_v_model = (channel_obj.get("ai_video_model") if channel_obj and channel_obj.get("ai_video_model") else None) or (camp.get("ai_video_model") if camp and camp.get("ai_video_model") else None) or "fal_ltx"
        eff_stock_p = (channel_obj.get("stock_provider") if channel_obj and channel_obj.get("stock_provider") else None) or (camp.get("stock_provider") if camp and camp.get("stock_provider") else None) or "all"

        return {
            "narration_enabled": eff_enabled,
            "narration_language": eff_lang,
            "voice_gender": eff_gender,
            "narration_style": eff_style,
            "disable_narration_for_shorts": eff_disable_shorts,
            "keep_original_script_for_shorts": eff_keep_script,
            "use_ai_images": eff_use_ai_images,
            "image_style": eff_img_style,
            "visual_source": eff_v_source,
            "ai_image_model": eff_ai_model,
            "ai_video_model": eff_v_model,
            "stock_provider": eff_stock_p
        }

    def get_effective_hook_settings(self, channel_obj: Optional[dict], camp: Optional[dict] = None) -> dict:
        """
        Xác định chiến lược Hook tâm lý & Chế độ xuất biến thể (Hook Strategy & Variants)
        theo thứ tự ưu tiên tuyệt đối: Kênh (Channel) > Chiến dịch (Campaign) > Mặc định toàn cục.
        """
        # 1. Cài đặt từ Chiến dịch (Campaign)
        camp_gen_variants = bool(camp.get("generate_variants", 0)) if camp else False
        camp_hook_angle = (camp.get("hook_angle") or "auto") if camp else "auto"

        # 2. Cài đặt từ Kênh (Channel)
        ch_variants_val = channel_obj.get("generate_variants") if channel_obj else None
        ch_hook_val = channel_obj.get("hook_angle") if channel_obj else None

        # Quyết định generate_variants (Biến thể)
        # -1 / None / 'inherit': Kế thừa từ chiến dịch; 0: Ép 1 clip tốt nhất; 1: Ép 3 biến thể A/B/C
        if ch_variants_val is not None and ch_variants_val != -1 and str(ch_variants_val).lower() not in ("inherit", "none", ""):
            effective_generate_variants = bool(int(ch_variants_val))
        else:
            effective_generate_variants = camp_gen_variants

        # Quyết định hook_angle (Góc Hook tâm lý)
        # "inherit" / None / "": Kế thừa từ chiến dịch
        if ch_hook_val and str(ch_hook_val).strip() != "" and str(ch_hook_val).lower() != "inherit":
            effective_hook_angle = str(ch_hook_val).strip()
        else:
            effective_hook_angle = camp_hook_angle

        return {
            "generate_variants": effective_generate_variants,
            "hook_angle": effective_hook_angle
        }

    def get_effective_download_dir(self, channel_obj: Optional[dict], force_campaign_id: Optional[int] = None) -> Optional[str]:
        """
        Xác định thư mục download hiệu lực theo thứ tự ưu tiên:
        Kênh (Channel) > Chiến dịch (Campaign) > Mặc định toàn cục (None -> DOWNLOADS_DIR).
        """
        ch_download_dir = (channel_obj.get("download_dir") or "").strip() if channel_obj else ""
        if ch_download_dir:
            return ch_download_dir

        ch_id = channel_obj.get("channel_id") if channel_obj else None
        if force_campaign_id or ch_id:
            try:
                conn = get_connection()
                cursor = conn.cursor()
                if force_campaign_id:
                    cursor.execute("SELECT download_dir FROM campaigns WHERE id = ?", (force_campaign_id,))
                else:
                    cursor.execute("SELECT download_dir FROM campaigns WHERE is_active = 1 AND (channel_ids LIKE ? OR channel_id = ?)",
                                   (f'%"{ch_id}"%', ch_id))
                row = cursor.fetchone()
                conn.close()
                if row and row["download_dir"] and row["download_dir"].strip():
                    return row["download_dir"].strip()
            except Exception:
                pass

        return None

    def get_effective_render_settings(self, channel_obj: Optional[dict], camp: Optional[dict] = None) -> dict:
        """
        Lấy cài đặt render hiệu lực theo thứ tự ưu tiên chặt chẽ:
        Kênh (Channel) > Chiến dịch (Campaign) > Toàn cục (Global).
        
        Bao gồm: render_dir, bgm_folder, bgm_volume
        """
        import os
        from backend.config import RENDERED_DIR

        # === Global defaults ===
        global_render_dir = str(RENDERED_DIR)
        global_bgm_folder = ""
        global_bgm_volume = 0.15

        # === Campaign level ===
        camp_render_dir = (camp.get("render_dir") or "").strip() if camp else ""
        camp_bgm_folder = (camp.get("bgm_folder") or "").strip() if camp else ""
        camp_bgm_volume = camp.get("bgm_volume") if camp else None

        # === Channel level (highest priority) ===
        ch_render_dir = (channel_obj.get("render_dir") or "").strip() if channel_obj else ""
        ch_bgm_folder = (channel_obj.get("bgm_folder") or "").strip() if channel_obj else ""
        ch_bgm_volume = channel_obj.get("bgm_volume") if channel_obj else None

        # === Apply Ch > Camp > Global ===

        # 1) render_dir: Channel > Campaign > Global
        if ch_render_dir:
            eff_render_dir = ch_render_dir
        elif camp_render_dir:
            eff_render_dir = camp_render_dir
        else:
            eff_render_dir = global_render_dir

        # 2) bgm_folder: Channel > Campaign > Global
        # Special "inherit" values mean "use parent level" (Campaign)
        if ch_bgm_folder and ch_bgm_folder not in ("inherit", ""):
            if ch_bgm_folder.lower() in ("none", "off", "disable", "disabled", "no_bgm"):
                eff_bgm_folder = None
                eff_bgm_volume = 0.0
            else:
                eff_bgm_folder = ch_bgm_folder
                eff_bgm_volume = float(ch_bgm_volume) if ch_bgm_volume is not None else global_bgm_volume
        elif camp_bgm_folder and camp_bgm_folder not in ("inherit", ""):
            if camp_bgm_folder.lower() in ("none", "off", "disable", "disabled", "no_bgm"):
                eff_bgm_folder = None
                eff_bgm_volume = 0.0
            else:
                eff_bgm_folder = camp_bgm_folder
                eff_bgm_volume = float(camp_bgm_volume) if camp_bgm_volume is not None else global_bgm_volume
        else:
            eff_bgm_folder = global_bgm_folder or None
            eff_bgm_volume = global_bgm_volume

        # 3) ken_burns_enabled: Channel > Campaign > Default 1
        ch_kb = channel_obj.get("ken_burns_enabled") if channel_obj else None
        camp_kb = camp.get("ken_burns_enabled") if camp else None
        if ch_kb is not None:
            eff_kb = bool(ch_kb != 0)
        elif camp_kb is not None:
            eff_kb = bool(camp_kb != 0)
        else:
            eff_kb = True

        # 4) endcard_enabled: Channel > Campaign > Default 1
        ch_ec = channel_obj.get("endcard_enabled") if channel_obj else None
        camp_ec = camp.get("endcard_enabled") if camp else None
        if ch_ec is not None:
            eff_ec = bool(ch_ec != 0)
        elif camp_ec is not None:
            eff_ec = bool(camp_ec != 0)
        else:
            eff_ec = True

        return {
            "render_dir": eff_render_dir or None,
            "bgm_folder": eff_bgm_folder or None,
            "bgm_volume": eff_bgm_volume,
            "ken_burns_enabled": eff_kb,
            "endcard_enabled": eff_ec
        }



    def get_effective_subtitle_settings(self, channel_obj: Optional[dict], camp: Optional[dict] = None) -> dict:
        """
        Xác định cấu hình phụ đề với thứ tự ưu tiên chặt chẽ:
        Kênh (Channel) > Chiến dịch (Campaign) > Toàn cục (Global).
        """
        import os
        from backend.database import get_connection

        # 1. Toàn cục (Global)
        global_enable_subs = os.getenv("ENABLE_DYNAMIC_SUBTITLES", "true").lower() in ("true", "1", "yes")
        global_sub_style = os.getenv("SUBTITLE_STYLE", "karaoke_yellow")
        global_sub_pos = os.getenv("SUBTITLE_POSITION", "center")
        global_disable_shorts = False

        # Thử đọc settings từ DB nếu có
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM settings WHERE key IN ('ENABLE_DYNAMIC_SUBTITLES', 'SUBTITLE_STYLE', 'SUBTITLE_POSITION')")
            s_dict = dict(cursor.fetchall())
            conn.close()
            if "ENABLE_DYNAMIC_SUBTITLES" in s_dict:
                global_enable_subs = s_dict["ENABLE_DYNAMIC_SUBTITLES"].lower() in ("true", "1", "yes")
            if "SUBTITLE_STYLE" in s_dict and s_dict["SUBTITLE_STYLE"]:
                global_sub_style = s_dict["SUBTITLE_STYLE"]
            if "SUBTITLE_POSITION" in s_dict and s_dict["SUBTITLE_POSITION"]:
                global_sub_pos = s_dict["SUBTITLE_POSITION"]
        except Exception:
            pass

        # 2. Chiến dịch (Campaign)
        camp_enable_subs = camp.get("subtitle_enabled") if camp else None
        camp_sub_style = camp.get("subtitle_style") if camp else None
        camp_sub_pos = camp.get("subtitle_position") if camp else None
        camp_disable_shorts = bool(camp.get("disable_subtitle_for_shorts", 0)) if camp else False

        # 3. Kênh nguồn (Channel)
        ch_enable_subs = channel_obj.get("subtitle_enabled") if channel_obj else None
        ch_sub_style = channel_obj.get("subtitle_style") if channel_obj else None
        ch_sub_pos = channel_obj.get("subtitle_position") if channel_obj else None
        ch_disable_shorts = bool(channel_obj.get("disable_subtitle_for_shorts", 0)) if channel_obj else False

        # --- Áp dụng thứ tự ưu tiên: Channel > Campaign > Global ---

        # 1) enable_subtitles
        if ch_enable_subs == -1:
            eff_enable = False
        elif camp_enable_subs is not None:
            eff_enable = bool(camp_enable_subs)
        elif ch_enable_subs is not None:
            eff_enable = bool(ch_enable_subs)
        else:
            eff_enable = global_enable_subs

        # 2) disable_subtitle_for_shorts
        if channel_obj and channel_obj.get("disable_subtitle_for_shorts") is not None and channel_obj.get("disable_subtitle_for_shorts") != 0:
            eff_disable_shorts = True
        elif camp and camp.get("disable_subtitle_for_shorts"):
            eff_disable_shorts = True
        else:
            eff_disable_shorts = global_disable_shorts

        # 3) subtitle_style
        clean_ch_style = ch_sub_style if (ch_sub_style and ch_sub_style not in ("inherit", "")) else None
        clean_camp_style = camp_sub_style if (camp_sub_style and camp_sub_style not in ("inherit_channel", "inherit", "")) else None

        if camp_sub_style == "inherit_channel":
            eff_style = clean_ch_style or global_sub_style
        elif clean_ch_style:
            eff_style = clean_ch_style
        elif clean_camp_style:
            eff_style = clean_camp_style
        else:
            eff_style = global_sub_style

        # 4) subtitle_position
        clean_ch_pos = ch_sub_pos if (ch_sub_pos and ch_sub_pos not in ("inherit", "")) else None
        clean_camp_pos = camp_sub_pos if (camp_sub_pos and camp_sub_pos not in ("inherit_channel", "inherit", "")) else None

        if camp_sub_pos == "inherit_channel":
            eff_pos = clean_ch_pos or global_sub_pos
        elif clean_ch_pos:
            eff_pos = clean_ch_pos
        elif clean_camp_pos:
            eff_pos = clean_camp_pos
        else:
            eff_pos = global_sub_pos

        return {
            "enable_subtitles": eff_enable,
            "subtitle_style": eff_style,
            "subtitle_position": eff_pos,
            "disable_subtitle_for_shorts": eff_disable_shorts
        }

    def get_effective_duration_limits(self, channel_id: str, force_campaign_id: Optional[int] = None) -> tuple:
        """
        Lấy ngưỡng thời lượng và định dạng video (min_seconds, max_seconds, include_shorts, include_longform).
        Ưu tiên chặt chẽ: Kênh (Channel) > Chiến dịch (Campaign) > Toàn cục (Global).
        """
        conn = get_connection()
        cursor = conn.cursor()

        # 1. Đọc cài đặt toàn cục (Global)
        cursor.execute("SELECT key, value FROM settings WHERE key IN ('download_min_duration', 'download_max_duration', 'download_include_shorts', 'download_include_longform')")
        db_s = dict(cursor.fetchall())
        global_min = int(db_s.get("download_min_duration", 300))
        global_max = int(db_s.get("download_max_duration", 3600))
        global_shorts = db_s.get("download_include_shorts", "1") == "1"
        global_longform = db_s.get("download_include_longform", "1") == "1"

        # 2. Tìm chiến dịch liên kết (Campaign)
        camp_row = None
        if force_campaign_id:
            cursor.execute("SELECT min_video_duration, max_video_duration, include_shorts, include_longform FROM campaigns WHERE id = ?", (force_campaign_id,))
            camp_row = cursor.fetchone()
        else:
            cursor.execute("SELECT id, channel_id, channel_ids, min_video_duration, max_video_duration, include_shorts, include_longform FROM campaigns WHERE is_active = 1")
            for r in cursor.fetchall():
                c_dict = dict(r)
                c_ch_ids = []
                try:
                    c_ch_ids = json.loads(c_dict.get("channel_ids") or "[]")
                except Exception:
                    pass
                if not c_ch_ids and c_dict.get("channel_id"):
                    c_ch_ids = [c_dict["channel_id"]]
                if channel_id in c_ch_ids:
                    camp_row = r
                    break

        # 3. Đọc cài đặt riêng của kênh (Channel)
        cursor.execute("SELECT min_video_duration, max_video_duration, include_shorts, include_longform FROM channels WHERE channel_id = ?", (channel_id,))
        channel_row = cursor.fetchone()

        conn.close()

        eff_min = global_min
        eff_max = global_max
        eff_shorts = global_shorts
        eff_longform = global_longform

        # Ưu tiên 2: Chiến dịch ghi đè toàn cục
        if camp_row:
            cr = dict(camp_row)
            if cr.get("min_video_duration") is not None:
                eff_min = int(cr["min_video_duration"])
            if cr.get("max_video_duration") is not None:
                eff_max = int(cr["max_video_duration"])
            if cr.get("include_shorts") is not None:
                eff_shorts = bool(cr["include_shorts"])
            if cr.get("include_longform") is not None:
                eff_longform = bool(cr["include_longform"])

        # Ưu tiên 1: Cài đặt kênh (cao nhất) ghi đè chiến dịch và toàn cục
        if channel_row:
            chr_d = dict(channel_row)
            if chr_d.get("min_video_duration") is not None:
                eff_min = int(chr_d["min_video_duration"])
            if chr_d.get("max_video_duration") is not None:
                eff_max = int(chr_d["max_video_duration"])
            if chr_d.get("include_shorts") is not None:
                eff_shorts = bool(chr_d["include_shorts"])
            if chr_d.get("include_longform") is not None:
                eff_longform = bool(chr_d["include_longform"])

        return eff_min, eff_max, eff_shorts, eff_longform

    def get_default_scan_cap(self) -> int:
        """Lấy giới hạn số video tải mỗi kênh của chu kỳ tự động (scan_all_monitored_channels cap)"""
        try:
            from backend.scheduler import scheduler
            if hasattr(scheduler, "max_videos_per_scan") and scheduler.max_videos_per_scan:
                return int(scheduler.max_videos_per_scan)
        except Exception:
            pass
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM settings WHERE key = 'max_videos_per_scan'")
            row = cursor.fetchone()
            conn.close()
            if row and row["value"]:
                return max(1, int(row["value"]))
        except Exception:
            pass
        return 5

    def is_video_already_downloaded(self, yt_video_id: str) -> bool:
        """Kiểm tra video đã từng được tải về hay chưa (kiểm tra cả download_history vĩnh viễn và videos)"""
        if not yt_video_id:
            return False
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT 1 FROM download_history WHERE yt_video_id = ?
                UNION
                SELECT 1 FROM videos WHERE yt_video_id = ?
                LIMIT 1
            """, (yt_video_id, yt_video_id))
            row = cursor.fetchone()
            conn.close()
            return row is not None
        except Exception:
            return False

    def scan_single_channel(self, channel_id: str, force_campaign_id: Optional[int] = None, max_videos: Optional[int] = None) -> Dict[str, Any]:
        """Quét ngay lập tức 1 kênh cụ thể và tải video mới nếu có"""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM channels WHERE channel_id = ?", (channel_id,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return {"status": "error", "message": "Không tìm thấy kênh trong danh sách theo dõi", "new_videos": 0}

        ch = dict(row)
        proxy = ch.get("custom_proxy") or None
        target_dir = self.get_effective_download_dir(ch, force_campaign_id)

        videos = self.check_channel_rss(channel_id)
        new_downloads = 0
        new_items = []

        ch_name = ch.get('display_name') or ch.get('title') or ""
        min_dur, max_dur, inc_shorts, inc_longform = self.get_effective_duration_limits(channel_id, force_campaign_id)

        # Xác định giới hạn số video tối đa tải về:
        # 1. Ưu tiên tham số max_videos được truyền trực tiếp
        # 2. Khi chạy từ Chiến Dịch (force_campaign_id): dùng giới hạn scan_all_monitored_channels cap (mặc định 5)
        # 3. Quét thủ công (Manual scan): dùng max_manual_videos của kênh nếu đã lưu, nếu chưa thì mặc định bằng scan_all_monitored_channels cap
        effective_cap = None
        if max_videos is not None and int(max_videos) > 0:
            effective_cap = int(max_videos)
        elif force_campaign_id is not None:
            effective_cap = self.get_default_scan_cap()
        else:
            ch_manual_cap = ch.get("max_manual_videos")
            if ch_manual_cap is not None and str(ch_manual_cap).isdigit() and int(ch_manual_cap) > 0:
                effective_cap = int(ch_manual_cap)
            else:
                effective_cap = self.get_default_scan_cap()

        for v in videos:
            if effective_cap is not None and effective_cap > 0 and new_downloads >= effective_cap:
                log_event("INFO", f"Kênh '{ch_name}': Đã đạt giới hạn tối đa {effective_cap} video cho lần quét này.")
                break

            vid = v["video_id"]
            if not self.is_video_already_downloaded(vid):
                log_event("INFO", f"Phát hiện video mới từ kênh '{ch_name}': {v['title']}")
                res = yt_downloader.download_video(
                    v["url"],
                    proxy=proxy,
                    target_dir=target_dir,
                    channel_name=ch_name,
                    min_duration=min_dur,
                    max_duration=max_dur,
                    include_shorts=inc_shorts,
                    include_longform=inc_longform
                )
                if res:
                    new_downloads += 1
                    new_items.append({"title": v["title"], "video_id": vid})

                    self.handle_video_post_download(
                        file_path=str(res.get("file_path") or ""),
                        video_id=vid,
                        channel_id=channel_id,
                        channel_name=ch_name,
                        video_title=v["title"],
                        duration=res.get("duration", 65),
                        channel_obj=ch,
                        force_campaign_id=force_campaign_id
                    )

        return {
            "status": "success",
            "channel_id": channel_id,
            "title": ch_name,
            "total_rss": len(videos),
            "new_videos": new_downloads,
            "max_limit": effective_cap,
            "items": new_items
        }

    def scan_all_monitored_channels(self, max_per_channel: int = 5, delay: float = 2.0) -> int:
        """Quét toàn bộ danh sách kênh theo dõi đang hoạt động (is_active = 1 và auto_download = 1)"""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM channels WHERE is_active = 1 AND auto_download = 1")
        channels = [dict(r) for r in cursor.fetchall()]
        conn.close()

        total_new_downloaded = 0
        for idx, ch in enumerate(channels):
            # Kiểm tra nếu Scheduler đã bị người dùng tạm dừng thì dừng ngay lập tức
            try:
                from backend.scheduler import scheduler
                if not scheduler.is_running:
                    log_event("INFO", "[RSS WORKER] Đã dừng quét các kênh tiếp theo vì Background Scheduler đã tạm dừng.")
                    break
            except Exception:
                pass

            if idx > 0 and delay > 0:
                time.sleep(delay)

            ch_id = ch["channel_id"]
            ch_name = ch.get("display_name") or ch.get("title") or ""
            proxy = ch.get("custom_proxy") or None
            target_dir = self.get_effective_download_dir(ch)

            videos = self.check_channel_rss(ch_id)
            channel_downloaded = 0
            min_dur, max_dur, inc_shorts, inc_longform = self.get_effective_duration_limits(ch_id)

            for v in videos:
                # Kiểm tra nếu Scheduler đã bị người dùng tạm dừng giữa chừng
                try:
                    from backend.scheduler import scheduler
                    if not scheduler.is_running:
                        log_event("INFO", f"[RSS WORKER] Đã dừng tải/render kênh '{ch_name}' vì Background Scheduler đã tạm dừng.")
                        return total_new_downloaded
                except Exception:
                    pass

                if max_per_channel > 0 and channel_downloaded >= max_per_channel:
                    break
                vid = v["video_id"]
                if not self.is_video_already_downloaded(vid):
                    log_event("INFO", f"Phát hiện video mới từ kênh '{ch_name}': {v['title']}")
                    res = yt_downloader.download_video(
                        v["url"],
                        proxy=proxy,
                        target_dir=target_dir,
                        channel_name=ch_name,
                        min_duration=min_dur,
                        max_duration=max_dur,
                        include_shorts=inc_shorts,
                        include_longform=inc_longform
                    )
                    if res:
                        total_new_downloaded += 1
                        channel_downloaded += 1

                        self.handle_video_post_download(
                            file_path=str(res.get("file_path") or ""),
                            video_id=vid,
                            channel_id=ch_id,
                            channel_name=ch_name,
                            video_title=v["title"],
                            duration=res.get("duration", 65),
                            channel_obj=ch
                        )

        return total_new_downloaded

yt_monitor = YouTubeRSSMonitor()
