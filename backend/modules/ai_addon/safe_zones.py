"""
Safe Zones & Layout Constants for TikTok, YouTube Shorts, and Facebook Reels.
Plan v3.0 Specification.
"""

from typing import List, Dict, Any, Literal, Optional

# Platform UI Exclusion Regions on 1080x1920 (PlayResX=1080, PlayResY=1920)
PLATFORM_SAFE_ZONES = {
    "tiktok": {
        "top_ui_height": 200,          # 0 - 200px (Following/For You, Search)
        "right_icon_margin": 120,       # 120px from right edge
        "bottom_ui_start_y": 1480,      # 1480 - 1920px (Username, caption, sound disc)
    },
    "youtube_shorts": {
        "top_ui_height": 180,          # 0 - 180px (Search, camera, menu)
        "right_icon_margin": 140,       # 120 - 140px from right edge
        "bottom_ui_start_y": 1420,      # 1420 - 1920px (Subscribe pill, 2-line title, sound)
    },
    "facebook_reels": {
        "top_ui_height": 160,          # 0 - 160px (Header, search)
        "right_icon_margin": 130,       # 110 - 130px from right edge
        "bottom_ui_start_y": 1450,      # 1450 - 1920px (Page avatar, follow button, caption)
    }
}

# Subtitle Margins (PlayResX=1080, PlayResY=1920, Alignment=2 Bottom-Center)
# With Alignment=2, MarginV is distance from bottom of frame to bottom of text box.
# Text bottom Y sits at (1920 - MarginV).
MARGIN_V: Dict[str, int] = {
    "mid_lower": 680,      # Text bottom at Y=1240. 180px clearance from nearest bottom UI (YouTube: 1420)
    "lower_third": 550,    # Text bottom at Y=1370. 50px clearance from nearest bottom UI (YouTube: 1420)
    "center": 680,         # Alias for backward compatibility
    "bottom": 550,         # Alias for backward compatibility
}

MARGIN_L = 160             # Symmetrical 160px left margin
MARGIN_R = 160             # Symmetrical 160px right margin (text box ends at X=920, 20px clear of icon cluster at X=940)

# Hook Card / Title Card Bounds (Y 240 - 420 = 180px height)
HOOK_CARD_TOP_Y = 240
HOOK_CARD_BOTTOM_Y = 420
HOOK_CARD_HEIGHT = 180

# Color Constants in BGR for ASS (e.g. Amber #F59E0B -> &H000B9EF5)
COLOR_AMBER_BGR = "&H000B9EF5"
COLOR_WHITE_BGR = "&H00FFFFFF"
COLOR_BLACK_BGR = "&H00000000"
COLOR_CYAN_BGR = "&H00FEF200"
COLOR_PINK_BGR = "&H00552CFE"
COLOR_GREEN_BGR = "&H0000FF00"


def default_subtitle_position(campaign_platforms: List[str]) -> str:
    """
    Selects the optimal safe subtitle position based on targeted platforms.
    - 2+ platforms: only the mid-lower zone (MarginV 680) is 100% safe across TikTok, Shorts & Reels.
    - 1 platform: lower-third (MarginV 550) provides closer-to-bottom aesthetic while maintaining clearance.
    """
    if not campaign_platforms:
        return "mid_lower"
    return "mid_lower" if len(campaign_platforms) >= 2 else "lower_third"


def get_subtitle_margin_v(position_name: str, campaign_platforms: Optional[List[str]] = None) -> int:
    """Returns the effective vertical margin for ASS subtitles."""
    pos = (position_name or "").lower().strip()
    if pos in ("auto", "inherit", ""):
        pos = default_subtitle_position(campaign_platforms or [])
    return MARGIN_V.get(pos, 680)

