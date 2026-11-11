import os
import subprocess
import shutil
from typing import Dict, Any, List, Optional
import sys

_PROBED_ENCODER: Optional[str] = None
_ENCODER_FLAGS_CACHE: Optional[List[str]] = None

def get_ffmpeg_binary() -> str:
    """Tìm đường dẫn thực thi của FFmpeg"""
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if exe and os.path.exists(exe):
            return exe
    except ImportError:
        pass

    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg

    return "ffmpeg"


def probe_hardware_encoder() -> str:
    """
    Plan v3.0 Hardware Encoder Probe.
    Tests real test encodes in order: NVENC -> QSV -> VAAPI -> fallback libx264.
    Caches the winning encoder for the lifetime of the process.
    """
    global _PROBED_ENCODER
    if _PROBED_ENCODER is not None:
        return _PROBED_ENCODER

    ffmpeg_bin = get_ffmpeg_binary()
    candidates = [
        ("h264_nvenc", ["-c:v", "h264_nvenc"]),
        ("h264_qsv", ["-c:v", "h264_qsv"]),
    ]
    if sys.platform != 'win32' and os.path.exists("/dev/dri/renderD128"):
        candidates.append(("h264_vaapi", ["-vaapi_device", "/dev/dri/renderD128", "-vf", "format=nv12,hwupload", "-c:v", "h264_vaapi"]))

    for enc_name, enc_probe_args in candidates:
        cmd = [
            ffmpeg_bin, "-y",
            "-f", "lavfi", "-i", "color=c=black:s=256x256:d=0.1",
            *enc_probe_args,
            "-f", "null", "-"
        ]
        try:
            res = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=5,
                creationflags=0x08000000 if sys.platform == 'win32' else 0
            )
            if res.returncode == 0:
                _PROBED_ENCODER = enc_name
                return _PROBED_ENCODER
        except Exception:
            continue

    _PROBED_ENCODER = "libx264"
    return _PROBED_ENCODER


def is_nvenc_available() -> bool:
    """Kiểm tra xem NVENC có khả dụng không"""
    return probe_hardware_encoder() == "h264_nvenc"


def get_optimal_video_encoder_flags() -> List[str]:
    """
    Trả về cờ mã hóa tối ưu theo chuẩn Plan v3.0:
    - h264_nvenc: -preset p4 -rc vbr -cq 19 -b:v 0 -spatial-aq 1 -temporal-aq 1 -rc-lookahead 20
    - h264_qsv: -global_quality 19 -look_ahead 1
    - h264_vaapi: -qp 19
    - libx264: -preset faster -crf 19 -threads 0
    All encoders include -pix_fmt yuv420p -movflags +faststart
    """
    global _ENCODER_FLAGS_CACHE
    if _ENCODER_FLAGS_CACHE is not None:
        return _ENCODER_FLAGS_CACHE

    enc = probe_hardware_encoder()
    if enc == "h264_nvenc":
        _ENCODER_FLAGS_CACHE = [
            "-c:v", "h264_nvenc",
            "-preset", "p4",
            "-rc", "vbr",
            "-cq", "19",
            "-b:v", "0",
            "-spatial-aq", "1",
            "-temporal-aq", "1",
            "-rc-lookahead", "20",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart"
        ]
    elif enc == "h264_qsv":
        _ENCODER_FLAGS_CACHE = [
            "-c:v", "h264_qsv",
            "-global_quality", "19",
            "-look_ahead", "1",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart"
        ]
    elif enc == "h264_vaapi":
        _ENCODER_FLAGS_CACHE = [
            "-c:v", "h264_vaapi",
            "-qp", "19",
            "-movflags", "+faststart"
        ]
    else:
        _ENCODER_FLAGS_CACHE = [
            "-c:v", "libx264",
            "-preset", "faster",
            "-crf", "19",
            "-threads", "0",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart"
        ]

    return _ENCODER_FLAGS_CACHE
