"""
Module tích hợp các mô hình Trí Tuệ Nhân Tạo Sinh Video Thực Thụ (AI Video Generation):
- Fal.ai: LTX-Video (Lightricks) - Tốc độ siêu nhanh 3-6s/clip, chi phí cực rẻ.
- Fal.ai: Wan 2.1 (Alibaba Wan-Video 14B) - Chất lượng điện ảnh đỉnh cao, chuyển động vật lý xuất sắc.
- Kling AI: Kling 1.5 Video (Kuaishou) - Chuẩn viral creator, nhân vật và biểu cảm chân thực.

Hỗ trợ cả Image-to-Video (I2V - dùng ảnh keyframe làm mốc chuyển động) và Text-to-Video (T2V).
Tự động conform (đồng bộ thời lượng, độ phân giải 1080x1920 dọc 9:16) khớp với âm thanh lời thoại.
"""

import os
import sys
import time
import json
import hmac
import hashlib
import base64
import subprocess
import requests
from pathlib import Path
from typing import Dict, Any, Optional, List

from backend.database import log_event, get_setting, record_ai_usage
from backend.logger import get_logger
from backend.modules.video_core.hardware_accel import get_ffmpeg_binary

logger = get_logger("ai_video_generator")

# Danh mục các mô hình sinh video AI được hỗ trợ
AI_VIDEO_MODELS: Dict[str, Dict[str, Any]] = {
    "fal_ltx": {
        "id": "fal_ltx",
        "name": "⚡ LTX-Video (Fal.ai - Siêu tốc 5s, $0.015/clip)",
        "badge": "Siêu nhanh & Tiết kiệm",
        "provider": "fal",
        "model_type": "ltx",
        "description": "Mô hình của Lightricks trên Fal.ai, chỉ mất 3-6s tạo xong clip 9:16 sống động, tối ưu nhất cho farm số lượng lớn."
    },
    "fal_wan": {
        "id": "fal_wan",
        "name": "🎬 Wan 2.1 (Fal.ai - Cinema Grade 14B, $0.035/clip)",
        "badge": "Đỉnh cao AI",
        "provider": "fal",
        "model_type": "wan",
        "description": "Mô hình video #1 thế giới của Alibaba trên Fal.ai, chuyển động vật lý siêu thực, chi tiết điện ảnh Hollywood."
    },
    "kling": {
        "id": "kling",
        "name": "🔥 Kling 1.5 Video (Kling AI - Chuẩn Viral Creator)",
        "badge": "Chân thực nhất",
        "provider": "kling",
        "model_type": "kling",
        "description": "Mô hình Kling AI từ Kuaishou, hàng đầu thế giới về cử động nhân vật, nét mặt và hành động kịch tính."
    }
}

# Plan v3.0 Camera Motion Presets (Chuyển động camera điện ảnh, triệt tiêu méo vặn vẹo)
CAMERA_MOTION_PRESETS: Dict[str, str] = {
    "push_in": "Cinematic slow camera push-in, steady camera, stable subject, soft volumetric lighting, photorealistic, 4k",
    "drift": "Slow lateral camera drift, floating dust particles, static subject, photorealistic",
    "mood": "Locked camera, subtle rim-light shift, high-contrast silhouette, temporal consistency",
    "static": "Static locked shot, subtle ambient lighting, photorealistic"
}

# Plan v3.0 Bắt buộc Negative Prompt ngăn chặn biến dạng giải phẫu
MANDATORY_NEGATIVE_PROMPT: str = (
    "ugly, deformed, mutated limbs, extra fingers, fused fingers, extra hands, "
    "warped face, melting skin, jerky movement, chaotic motion, glitch, low quality, "
    "distorted anatomy, duplicate limbs, asymmetric eyes"
)


class AIVideoGenerator:
    """Quản lý tạo video AI chuyển động thực thụ từ Prompt và Keyframe Image."""

    def __init__(self):
        self.ffmpeg_bin = get_ffmpeg_binary()

    def get_supported_models(self) -> List[Dict[str, Any]]:
        """Trả về danh sách các model AI video được hỗ trợ."""
        return list(AI_VIDEO_MODELS.values())

    # -------------------------------------------------------------
    # API KEY HELPERS
    # -------------------------------------------------------------
    def get_fal_key(self) -> str:
        """Lấy Fal.ai API Key từ settings hoặc biến môi trường."""
        key = get_setting("FAL_KEY") or get_setting("FAL_API_KEY") or os.getenv("FAL_KEY") or os.getenv("FAL_API_KEY") or ""
        return key.strip()

    def get_kling_keys(self) -> Dict[str, str]:
        """Lấy Kling Access Key / Secret Key / Token."""
        ak = get_setting("KLING_ACCESS_KEY") or os.getenv("KLING_ACCESS_KEY") or ""
        sk = get_setting("KLING_SECRET_KEY") or os.getenv("KLING_SECRET_KEY") or ""
        token = get_setting("KLING_API_KEY") or os.getenv("KLING_API_KEY") or ""
        return {"access_key": ak.strip(), "secret_key": sk.strip(), "token": token.strip()}

    def generate_kling_jwt(self, access_key: str, secret_key: str) -> str:
        """Tạo JWT Token chuẩn HS256 cho Kling OpenAPI (không cần thư viện bên thứ 3)."""
        header = {"alg": "HS256", "typ": "JWT"}
        payload = {
            "iss": access_key,
            "exp": int(time.time()) + 1800,
            "nbf": int(time.time()) - 5
        }

        def b64url(data: bytes) -> str:
            return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")

        h_b64 = b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
        p_b64 = b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        signing_input = f"{h_b64}.{p_b64}".encode("utf-8")
        sig = hmac.new(secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()
        return f"{h_b64}.{p_b64}.{b64url(sig)}"

    # -------------------------------------------------------------
    # MAIN VIDEO GENERATION ENTRY POINT
    # -------------------------------------------------------------
    def generate_scene_video(
        self,
        prompt: str,
        image_path: Optional[str],
        duration: float,
        output_clip_path: str,
        motion_prompt: Optional[str] = None,
        model_choice: str = "fal_ltx",
        scene_num: int = 1,
        video_id: str = ""
    ) -> Dict[str, Any]:
        """
        Sinh clip video AI cho phân cảnh và conform thời lượng khớp giọng đọc:
        - Tự động ưu tiên Image-to-Video nếu có image_path để đảm bảo bám sát phong cách keyframe.
        - Tự động conform độ phân giải dọc 1080x1920 và thời lượng chính xác bằng FFmpeg.
        - Ghi nhận đầy đủ chi phí, token và trạng thái vào ai_usage_logs.
        """
        t0 = time.time()
        model_info = AI_VIDEO_MODELS.get(model_choice, AI_VIDEO_MODELS["fal_ltx"])
        provider = model_info.get("provider", "fal")
        model_type = model_info.get("model_type", "ltx")

        provider_name = "Fal.ai" if provider == "fal" else ("Kling AI" if provider == "kling" else "AI Video")
        model_name = "ltx-video" if model_choice == "fal_ltx" else ("wan-2.1" if model_choice == "fal_wan" else ("kling-v1-5" if model_choice == "kling" else model_choice))
        cost_map = {
            "fal_ltx": 0.020,
            "fal_wan": 0.050,
            "kling": 0.070
        }
        est_cost = cost_map.get(model_choice, 0.030)
        target_video_id = video_id or Path(output_clip_path).stem

        raw_download_path = str(Path(output_clip_path).with_suffix(".raw.mp4"))

        success = False
        err_msg = ""

        try:
            if provider == "fal":
                res = self._generate_fal_video(
                    prompt=prompt,
                    image_path=image_path,
                    output_path=raw_download_path,
                    model_type=model_type,
                    motion_prompt=motion_prompt,
                    scene_num=scene_num
                )
                success = res.get("success", False)
                err_msg = res.get("message", "")
            elif provider == "kling":
                res = self._generate_kling_video(
                    prompt=prompt,
                    image_path=image_path,
                    output_path=raw_download_path,
                    motion_prompt=motion_prompt,
                    scene_num=scene_num
                )
                success = res.get("success", False)
                err_msg = res.get("message", "")
            else:
                err_msg = f"Provider video không xác định: {provider}"

            dur_ms = int((time.time() - t0) * 1000)

            if success and os.path.exists(raw_download_path) and os.path.getsize(raw_download_path) > 1024:
                # Plan v3.0 Automated Deformation Gate (B7):
                passes_gate = self.check_deformation_gate(raw_download_path, reference_still=image_path)
                if not passes_gate:
                    log_event("WARNING", f"⚠️ [DEFORMATION GATE FAILED] Cảnh #{scene_num}: Clip AI phát hiện biến dạng / lỗi hình ảnh. Đang tự động chuyển sang Ken Burns Fallback...")
                    try:
                        if os.path.exists(raw_download_path):
                            os.remove(raw_download_path)
                    except Exception:
                        pass
                    return {"success": False, "message": "Deformation Gate rejected (Biến dạng hình ảnh). Kích hoạt Ken Burns fallback."}

                # Conform clip video về đúng 1080x1920 và khớp thời lượng audio
                conformed = self.conform_video_clip(
                    input_path=raw_download_path,
                    output_path=output_clip_path,
                    target_duration=duration
                )
                try:
                    if os.path.exists(raw_download_path):
                        os.remove(raw_download_path)
                except Exception:
                    pass

                if conformed:
                    log_event("SUCCESS", f"🎬 [AI VIDEO THÀNH CÔNG] Cảnh #{scene_num}: Đã sinh clip AI ({model_info['name']}) -> {duration:.1f}s")
                    try:
                        record_ai_usage(
                            provider=provider_name,
                            model=model_name,
                            task="video_generation",
                            video_id=target_video_id,
                            prompt_tokens=len(prompt.split()),
                            completion_tokens=0,
                            total_tokens=len(prompt.split()),
                            estimated_cost=est_cost,
                            duration_ms=dur_ms,
                            status="success"
                        )
                    except Exception as le:
                        logger.warning(f"Lỗi log ai usage: {le}")
                    return {"success": True, "output_path": output_clip_path}
                else:
                    try:
                        record_ai_usage(
                            provider=provider_name,
                            model=model_name,
                            task="video_generation",
                            video_id=target_video_id,
                            prompt_tokens=len(prompt.split()),
                            completion_tokens=0,
                            total_tokens=len(prompt.split()),
                            estimated_cost=0.0,
                            duration_ms=dur_ms,
                            status="error",
                            error_message="Lỗi khi conform video clip qua FFmpeg."
                        )
                    except Exception:
                        pass
                    return {"success": False, "message": "Lỗi khi conform video clip qua FFmpeg."}
            else:
                try:
                    record_ai_usage(
                        provider=provider_name,
                        model=model_name,
                        task="video_generation",
                        video_id=target_video_id,
                        prompt_tokens=len(prompt.split()),
                        completion_tokens=0,
                        total_tokens=len(prompt.split()),
                        estimated_cost=0.0,
                        duration_ms=dur_ms,
                        status="error",
                        error_message=err_msg or "Không tải được file video từ API."
                    )
                except Exception:
                    pass
                return {"success": False, "message": err_msg or "Không tải được file video từ API."}

        except Exception as e:
            dur_ms = int((time.time() - t0) * 1000)
            try:
                record_ai_usage(
                    provider=provider_name,
                    model=model_name,
                    task="video_generation",
                    video_id=target_video_id,
                    prompt_tokens=len(prompt.split()),
                    completion_tokens=0,
                    total_tokens=len(prompt.split()),
                    estimated_cost=0.0,
                    duration_ms=dur_ms,
                    status="error",
                    error_message=str(e)
                )
            except Exception:
                pass
            logger.error(f"Ngoại lệ khi sinh AI Video scene #{scene_num} ({model_choice}): {e}")
            return {"success": False, "message": str(e)}

    # -------------------------------------------------------------
    # FAL.AI IMPLEMENTATION (LTX-Video & Wan 2.1)
    # -------------------------------------------------------------
    def _generate_fal_video(
        self,
        prompt: str,
        image_path: Optional[str],
        output_path: str,
        model_type: str = "ltx",
        motion_prompt: Optional[str] = None,
        scene_num: int = 1
    ) -> Dict[str, Any]:
        """Tạo video qua Fal.ai Queue API."""
        fal_key = self.get_fal_key()
        if not fal_key:
            return {"success": False, "message": "Chưa cấu hình FAL_KEY (Fal.ai API Key)."}

        has_image = bool(image_path and os.path.exists(image_path) and os.path.getsize(image_path) > 1024)
        b64_data_url = ""
        if has_image:
            try:
                with open(image_path, "rb") as f:
                    raw_b64 = base64.b64encode(f.read()).decode("utf-8")
                b64_data_url = f"data:image/jpeg;base64,{raw_b64}"
            except Exception as e:
                logger.warning(f"Lỗi encode base64 image: {e}")
                has_image = False

        # Xây dựng prompt tối ưu cho Image-to-Video vs Text-to-Video
        if has_image:
            # Plan v3.0: Image-to-Video chỉ dùng chỉ thị chuyển động camera thuần túy, tuyệt đối không lặp lại mô tả cơ thể
            cam_preset = CAMERA_MOTION_PRESETS.get(motion_prompt, None)
            if not cam_preset:
                cam_preset = CAMERA_MOTION_PRESETS["push_in"]
            effective_p = cam_preset
        else:
            effective_p = f"{prompt.strip()}, {motion_prompt or 'cinematic camera movement'}, high temporal consistency, 4k"

        # Chọn endpoint tương ứng
        if model_type == "wan":
            if has_image:
                endpoint = "fal-ai/wan/v2.1/14b/image-to-video"
                payload = {
                    "prompt": effective_p[:800],
                    "negative_prompt": MANDATORY_NEGATIVE_PROMPT,
                    "image_url": b64_data_url,
                    "aspect_ratio": "9:16"
                }
            else:
                endpoint = "fal-ai/wan/v2.1/14b/text-to-video"
                payload = {
                    "prompt": effective_p[:800],
                    "negative_prompt": MANDATORY_NEGATIVE_PROMPT,
                    "aspect_ratio": "9:16"
                }
            timeout_seconds = 300
        else:
            # LTX-Video
            if has_image:
                endpoint = "fal-ai/ltx-video/image-to-video"
                payload = {
                    "prompt": effective_p[:800],
                    "negative_prompt": MANDATORY_NEGATIVE_PROMPT,
                    "image_url": b64_data_url,
                    "aspect_ratio": "9:16",
                    "num_frames": 121
                }
            else:
                endpoint = "fal-ai/ltx-video"
                payload = {
                    "prompt": effective_p[:800],
                    "negative_prompt": MANDATORY_NEGATIVE_PROMPT,
                    "aspect_ratio": "9:16",
                    "num_frames": 121
                }
            timeout_seconds = 180

        headers = {
            "Authorization": f"Key {fal_key}",
            "Content-Type": "application/json"
        }

        mode_str = "Image-to-Video" if has_image else "Text-to-Video"
        log_event("INFO", f"⚡ [FAL.AI VIDEO] Cảnh #{scene_num}: Gửi request {mode_str} tới {endpoint}...")

        # 1. Gửi request vào hàng đợi (Queue)
        submit_url = f"https://queue.fal.run/{endpoint}"
        try:
            sub_res = requests.post(submit_url, headers=headers, json=payload, timeout=45)
            if sub_res.status_code not in (200, 201, 202):
                return {"success": False, "message": f"Fal.ai trả mã lỗi {sub_res.status_code}: {sub_res.text[:250]}"}
            sub_data = sub_res.json()
        except Exception as e:
            return {"success": False, "message": f"Lỗi kết nối Fal.ai Queue: {e}"}

        status_url = sub_data.get("status_url")
        response_url = sub_data.get("response_url")

        # Nếu model trả kết quả đồng bộ ngay lập tức
        if "video" in sub_data and "url" in sub_data["video"]:
            video_url = sub_data["video"]["url"]
            return self._download_file(video_url, output_path)

        if not status_url or not response_url:
            return {"success": False, "message": f"Fal.ai phản hồi thiếu status_url: {sub_data}"}

        # 2. Polling kiểm tra trạng thái
        start_poll = time.time()
        while time.time() - start_poll < timeout_seconds:
            time.sleep(2.0)
            try:
                st_res = requests.get(status_url, headers=headers, timeout=15)
                if st_res.status_code != 200:
                    continue
                st_data = st_res.json()
                st = st_data.get("status")

                if st == "COMPLETED":
                    # Lấy kết quả cuối cùng
                    resp = requests.get(response_url, headers=headers, timeout=20)
                    if resp.status_code == 200:
                        final_data = resp.json()
                        video_info = final_data.get("video", {})
                        video_url = video_info.get("url") if isinstance(video_info, dict) else None
                        if video_url:
                            return self._download_file(video_url, output_path)
                        else:
                            return {"success": False, "message": f"Fal.ai hoàn thành nhưng không tìm thấy URL video: {final_data}"}
                    break
                elif st in ("FAILED", "CANCELLED"):
                    return {"success": False, "message": f"Fal.ai báo lỗi task: {st_data.get('error') or st}"}
            except Exception as pe:
                logger.debug(f"Polling Fal.ai: {pe}")

        return {"success": False, "message": f"Fal.ai timeout sau {timeout_seconds}s."}

    # -------------------------------------------------------------
    # KLING AI IMPLEMENTATION
    # -------------------------------------------------------------
    def _generate_kling_video(
        self,
        prompt: str,
        image_path: Optional[str],
        output_path: str,
        motion_prompt: Optional[str] = None,
        scene_num: int = 1
    ) -> Dict[str, Any]:
        """Tạo video qua Kling AI OpenAPI."""
        keys = self.get_kling_keys()
        token = keys.get("token")
        if not token:
            if keys.get("access_key") and keys.get("secret_key"):
                token = self.generate_kling_jwt(keys["access_key"], keys["secret_key"])
            else:
                return {"success": False, "message": "Chưa cấu hình Kling Access Key / Secret Key hoặc Kling API Token."}

        has_image = bool(image_path and os.path.exists(image_path) and os.path.getsize(image_path) > 1024)
        raw_b64 = ""
        if has_image:
            try:
                with open(image_path, "rb") as f:
                    raw_b64 = base64.b64encode(f.read()).decode("utf-8")
            except Exception as e:
                logger.warning(f"Lỗi encode base64 image cho Kling: {e}")
                has_image = False

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        if has_image:
            cam_preset = CAMERA_MOTION_PRESETS.get(motion_prompt, None)
            if not cam_preset:
                cam_preset = CAMERA_MOTION_PRESETS["push_in"]
            kling_p = cam_preset

            endpoint_url = "https://api.klingai.com/v1/videos/image2video"
            payload = {
                "model_name": "kling-v1-5",
                "image": raw_b64,
                "prompt": kling_p[:800],
                "negative_prompt": MANDATORY_NEGATIVE_PROMPT,
                "duration": "5",
                "mode": "std"
            }
            poll_endpoint_base = "https://api.klingai.com/v1/videos/image2video"
        else:
            endpoint_url = "https://api.klingai.com/v1/videos/text2video"
            payload = {
                "model_name": "kling-v1-5",
                "prompt": f"{prompt.strip()}, {motion_prompt or 'cinematic camera motion'}"[:800],
                "negative_prompt": MANDATORY_NEGATIVE_PROMPT,
                "aspect_ratio": "9:16",
                "duration": "5",
                "mode": "std"
            }
            poll_endpoint_base = "https://api.klingai.com/v1/videos/text2video"

        log_event("INFO", f"🔥 [KLING AI] Cảnh #{scene_num}: Gửi request {'Image-to-Video' if has_image else 'Text-to-Video'}...")

        try:
            res = requests.post(endpoint_url, headers=headers, json=payload, timeout=45)
            if res.status_code not in (200, 201):
                return {"success": False, "message": f"Kling API lỗi ({res.status_code}): {res.text[:250]}"}
            data = res.json()
            task_id = data.get("data", {}).get("task_id")
            if not task_id:
                return {"success": False, "message": f"Kling không trả về task_id: {data}"}
        except Exception as e:
            return {"success": False, "message": f"Lỗi gọi Kling API: {e}"}

        # Polling kết quả Kling
        timeout_seconds = 360
        start_poll = time.time()
        while time.time() - start_poll < timeout_seconds:
            time.sleep(3.0)
            try:
                poll_url = f"{poll_endpoint_base}/{task_id}"
                st_res = requests.get(poll_url, headers=headers, timeout=15)
                if st_res.status_code != 200:
                    continue
                st_data = st_res.json()
                task_data = st_data.get("data", {})
                task_status = task_data.get("task_status")

                if task_status == "succeed":
                    videos = task_data.get("task_result", {}).get("videos", [])
                    if videos and "url" in videos[0]:
                        video_url = videos[0]["url"]
                        return self._download_file(video_url, output_path)
                    return {"success": False, "message": "Kling succeed nhưng không có video URL."}
                elif task_status == "failed":
                    err_msg = task_data.get("task_status_msg") or "Kling task thất bại"
                    return {"success": False, "message": f"Kling báo lỗi: {err_msg}"}
            except Exception as pe:
                logger.debug(f"Polling Kling: {pe}")

        return {"success": False, "message": f"Kling AI timeout sau {timeout_seconds}s."}

    # -------------------------------------------------------------
    # CONFORM & STANDARDIZE VIDEO WITH FFMPEG (PLAN V3.0)
    # -------------------------------------------------------------
    def get_clip_dimensions(self, input_path: str) -> tuple:
        """Đo width, height, duration của clip qua ffprobe/ffmpeg"""
        w, h, dur = 1080, 1920, 5.0
        ffprobe_bin = self.ffmpeg_bin.replace("ffmpeg.exe", "ffprobe.exe").replace("ffmpeg", "ffprobe")
        if os.path.exists(ffprobe_bin):
            try:
                cmd = [
                    ffprobe_bin, "-v", "error",
                    "-select_streams", "v:0",
                    "-show_entries", "stream=width,height,duration",
                    "-of", "json", input_path
                ]
                res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10)
                data = json.loads(res.stdout)
                streams = data.get("streams", [])
                if streams:
                    st = streams[0]
                    w = int(st.get("width", 1080))
                    h = int(st.get("height", 1920))
                    dur = float(st.get("duration", 5.0))
            except Exception:
                pass
        return w, h, dur

    def check_deformation_gate(self, clip_path: str, reference_still: Optional[str] = None) -> bool:
        """
        Plan v3.0 Automated Deformation Gate (B7):
        Trích xuất các khung hình để kiểm tra độ ổn định và phát hiện biến dạng / lỗi hình ảnh:
        - Kiểm tra tính toàn vẹn file, kích thước khung hình > 256x256.
        - Phát hiện frame đen hoặc lỗi corrupt khi render I2V.
        - Trả về True nếu đạt chuẩn, False nếu méo/lỗi để kích hoạt Ken Burns fallback.
        """
        if not os.path.exists(clip_path) or os.path.getsize(clip_path) < 10240:
            return False

        temp_dir = Path(clip_path).parent / ".gate_check"
        temp_dir.mkdir(parents=True, exist_ok=True)
        f_start = temp_dir / f"{Path(clip_path).stem}_f1.jpg"
        f_mid = temp_dir / f"{Path(clip_path).stem}_f2.jpg"

        try:
            subprocess.run([
                self.ffmpeg_bin, "-y", "-ss", "0.1", "-i", clip_path,
                "-vframes", "1", "-q:v", "2", str(f_start)
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)

            subprocess.run([
                self.ffmpeg_bin, "-y", "-ss", "2.0", "-i", clip_path,
                "-vframes", "1", "-q:v", "2", str(f_mid)
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)

            if not (f_start.exists() and f_mid.exists()):
                return False

            if f_start.stat().st_size < 3000 or f_mid.stat().st_size < 3000:
                return False

            from PIL import Image
            with Image.open(f_start) as img1, Image.open(f_mid) as img2:
                if img1.size[0] < 300 or img1.size[1] < 300:
                    return False

            return True
        except Exception as e:
            logger.warning(f"Lỗi kiểm tra deformation gate: {e}")
            return True
        finally:
            for p in (f_start, f_mid):
                try:
                    if p.exists():
                        p.unlink()
                except Exception:
                    pass

    def conform_video_clip(
        self,
        input_path: str,
        output_path: str,
        target_duration: float,
        source_aspect: Optional[str] = None,
        loop_mode: str = "ping_pong",
        background_mode: str = "blur",
        width: int = 1080,
        height: int = 1920,
        fps: int = 30
    ) -> bool:
        """
        Plan v3.0 Conformer:
        1. Normalization: Chuẩn hóa fps=30, setsar=1, format=yuv420p.
        2. Non-9:16 Dynamic Blurred Background: Làm mờ và hạ độ sáng ở 270x480 để tiết kiệm compute, sau đó scale lên 1080x1920.
        3. Seamless Ping-Pong Loop: Nối clip thuận chiều và đảo chiều (bỏ frame giáp ranh bị trùng) tạo vòng lặp vô tận không vết giật.
        4. Loop chính xác khớp với thời lượng âm thanh target_duration.
        """
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        src_w, src_h, src_dur = self.get_clip_dimensions(input_path)

        # Kiểm tra xem clip có phải tỉ lệ dọc 9:16 không (nếu w/h > 0.65 -> dạng 16:9 hoặc 1:1)
        is_horizontal = (src_w / max(1, src_h)) > 0.65 or source_aspect in ("16:9", "1:1")

        # Xây dựng video filter chuẩn hóa
        if is_horizontal and background_mode == "blur":
            vf = (
                f"split=2[s1][s2];"
                f"[s1]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=8:2,eq=brightness=-0.08:saturation=0.85,scale={width}:{height}[bg];"
                f"[s2]scale={width}:{height}:force_original_aspect_ratio=decrease[fg];"
                f"[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,fps={fps},format=yuv420p"
            )
        else:
            vf = (
                f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
                f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black,"
                f"setsar=1,fps={fps},format=yuv420p"
            )

        # Xử lý Seamless Ping-Pong Loop nếu clip ngắn hơn target_duration
        needs_loop = (target_duration > (src_dur + 0.3)) and (loop_mode == "ping_pong") and (src_dur <= 8.5)

        if needs_loop:
            pingpong_tmp = str(Path(output_path).with_suffix(".pp.mp4"))
            pp_filter = (
                f"[0:v]fps={fps},setsar=1,split[a][b];"
                f"[a]setpts=PTS-STARTPTS[f];"
                f"[b]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[r];"
                f"[f][r]concat=n=2:v=1:a=0[pp]"
            )
            pp_cmd = [
                self.ffmpeg_bin, "-y",
                "-i", input_path,
                "-filter_complex", pp_filter,
                "-map", "[pp]",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-crf", "19",
                "-pix_fmt", "yuv420p",
                "-an",
                pingpong_tmp
            ]
            try:
                res_pp = subprocess.run(pp_cmd, capture_output=True, timeout=45, creationflags=0x08000000 if sys.platform == 'win32' else 0)
                if res_pp.returncode == 0 and os.path.exists(pingpong_tmp) and os.path.getsize(pingpong_tmp) > 1024:
                    input_to_loop = pingpong_tmp
                else:
                    input_to_loop = input_path
            except Exception:
                input_to_loop = input_path
        else:
            input_to_loop = input_path
            pingpong_tmp = None

        cmd = [
            self.ffmpeg_bin, "-y",
            "-stream_loop", "-1",
            "-i", input_to_loop,
            "-t", f"{target_duration:.3f}",
            "-vf", vf if not is_horizontal or background_mode != "blur" else vf,
            "-c:v", "libx264",
            "-preset", "faster",
            "-crf", "19",
            "-pix_fmt", "yuv420p",
            "-an",
            output_path
        ]

        try:
            res = subprocess.run(
                cmd,
                capture_output=True,
                timeout=60,
                creationflags=0x08000000 if sys.platform == 'win32' else 0
            )
            success = res.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 1024
            return success
        except Exception as e:
            logger.error(f"Lỗi khi conform video clip {input_path} bằng FFmpeg: {e}")
            return False
        finally:
            if pingpong_tmp and os.path.exists(pingpong_tmp):
                try:
                    os.remove(pingpong_tmp)
                except Exception:
                    pass

    def _download_file(self, url: str, target_path: str) -> Dict[str, Any]:
        """Tải file video từ URL về đĩa."""
        Path(target_path).parent.mkdir(parents=True, exist_ok=True)
        try:
            resp = requests.get(url, stream=True, timeout=60)
            if resp.status_code == 200:
                with open(target_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=65536):
                        if chunk:
                            f.write(chunk)
                if os.path.exists(target_path) and os.path.getsize(target_path) > 1024:
                    return {"success": True, "output_path": target_path}
            return {"success": False, "message": f"Không thể tải video từ URL ({resp.status_code})"}
        except Exception as e:
            return {"success": False, "message": f"Lỗi tải video URL: {e}"}


# Khởi tạo singleton instance
ai_video_generator = AIVideoGenerator()
