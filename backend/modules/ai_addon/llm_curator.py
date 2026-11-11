import os
import json
import re
import time
import requests
from typing import Dict, Any, List, Optional, Tuple
from backend.config import (
    DEEPSEEK_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, AI_PROVIDER,
    DEEPSEEK_MODEL, GEMINI_MODEL, OPENAI_MODEL
)
from backend.database import log_event, record_ai_usage
from backend.logger import get_logger

logger = get_logger("ai_curator")

# ---------------------------------------------------------------------------
# Gemini route cache — probed once per process lifetime
# None = not tested yet | "direct" = Google reachable | "proxy" = use Worker
# ---------------------------------------------------------------------------
_GEMINI_FALLBACK_WORKER = "https://gemini-proxy.thenguyenfiner.workers.dev"
_GEMINI_DIRECT_HOST     = "https://generativelanguage.googleapis.com"
_gemini_route_cache: Optional[str] = None  # type: ignore[assignment]

def _probe_gemini_direct(timeout: float = 4.0) -> bool:
    """HEAD request to Google API host.  Returns True if reachable."""
    try:
        requests.head(_GEMINI_DIRECT_HOST, timeout=timeout)
        return True
    except Exception:
        return False

def _resolve_gemini_base_url(user_url: str) -> str:
    """
    Resolution order:
      1. User has set their own URL → use it unconditionally.
      2. First call this session → probe Google direct (4 s timeout).
         - Reachable  → cache "direct", return Google URL.
         - Unreachable → cache "proxy",  return Worker URL.
      3. Subsequent calls → return cached choice instantly.
    """
    global _gemini_route_cache

    # 1. User-configured URL always wins
    if user_url:
        return user_url.rstrip("/")

    # 2 & 3. Auto-detect / cached
    if _gemini_route_cache is None:
        reachable = _probe_gemini_direct()
        _gemini_route_cache = "direct" if reachable else "proxy"
        logger.info(f"Gemini route probe → {_gemini_route_cache} "
                    f"({'Google direct' if reachable else 'Cloudflare Worker fallback'})")

    if _gemini_route_cache == "direct":
        return _GEMINI_DIRECT_HOST
    return _GEMINI_FALLBACK_WORKER

def classify_ai_call_error(status_code: int, err_text: str, provider: str) -> str:
    err_lower = (err_text or "").lower()
    if status_code == 429 or "rate limit" in err_lower or "quota" in err_lower or "resourceexhausted" in err_lower:
        return f"CẢNH BÁO AI: Hết hạn mức hoặc Quota {provider} (HTTP 429). Hãy kiểm tra số dư credit hoặc đổi model/provider trong Cài Đặt."
    elif status_code in (401, 403) or "invalid api key" in err_lower or "api_key_invalid" in err_lower:
        return f"CẢNH BÁO AI: API Key {provider} không hợp lệ hoặc đã bị thu hồi (HTTP {status_code}). Vui lòng cập nhật API Key mới."
    elif status_code == 503 or "service unavailable" in err_lower:
        return f"CẢNH BÁO AI: Máy chủ {provider} đang quá tải tạm thời (HTTP 503)."
    else:
        return f"Lỗi gọi {provider} ({status_code}): {err_text[:120]}"

def estimate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Ước tính chi phí theo bảng giá tiêu chuẩn mỗi 1,000,000 tokens ($ USD)"""
    rates = {
        # DeepSeek
        "deepseek-chat": (0.14, 0.28),
        "deepseek-reasoner": (0.55, 2.19),
        # Google Gemini
        "gemini-2.5-flash": (0.075, 0.30),
        "gemini-1.5-flash": (0.075, 0.30),
        "gemini-1.5-pro": (3.50, 10.50),
        # OpenAI
        "gpt-4o-mini": (0.15, 0.60),
        "gpt-4o": (2.50, 10.00),
    }
    in_rate, out_rate = rates.get(model.lower(), (0.15, 0.60))
    cost = (prompt_tokens * in_rate + completion_tokens * out_rate) / 1_000_000.0
    return round(cost, 6)

SPONSOR_KEYWORDS = [
    "sponsored by", "sponsor", "sponsoring", "use code", "discount code", "link in the description",
    "link in description", "brought to you by", "draftkings", "draft kings", "nordvpn", "betterhelp",
    "manscaped", "prizepicks", "factor meals", "athletic greens", "ag1", "expressvpn",
    "gambling problem", "bonus bets", "promo code", "download the app", "sign up today",
    "get 20% off", "get 15% off", "get 10% off", "check out the link", "click to claim", "deposit match",
    "21 and over void", "redeemable terms", "free-to-play sports contest", "today's sponsor",
    "check out the description", "head to", "patreon.com", "merch link"
]

INTRO_TRANSITION_KEYWORDS = [
    "hey guys", "welcome back", "what's up everybody", "in today's video",
    "before we get started", "let me know in the comments", "hit that subscribe",
    "okay so now let's move on", "next up", "let's dive in", "as i mentioned earlier",
    "going back to that point", "leave a like", "don't forget to subscribe",
    "welcome to the podcast", "welcome to the show"
]

class LLMCurator:
    """
    Enterprise-grade multi-provider Cloud LLM Gateway with Usage & Cost Tracking:
    - Primary: DeepSeek (deepseek-chat / deepseek-reasoner)
    - Secondary: Google Gemini (gemini-2.5-flash / 1.5-flash / 1.5-pro)
    - Fallback: OpenAI (gpt-4o-mini / gpt-4o)
    - Resilient Local Fallback: Rule-based copy generator
    - Complete Usage & Cost Tracking into ai_usage_logs table
    """

    def __init__(self):
        self.timeout = 35

    def _get_active_config(self) -> Dict[str, Any]:
        import backend.config as cfg
        return {
            "deepseek_key": cfg.DEEPSEEK_API_KEY or os.getenv("DEEPSEEK_API_KEY", ""),
            "gemini_key": cfg.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", ""),
            "gemini_base_url": (getattr(cfg, "GEMINI_BASE_URL", "") or os.getenv("GEMINI_BASE_URL", "") or "").rstrip("/"),
            "openai_key": cfg.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY", ""),
            "provider": cfg.AI_PROVIDER or os.getenv("AI_PROVIDER", "deepseek").lower(),
            "deepseek_model": cfg.DEEPSEEK_MODEL or os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
            "gemini_model": cfg.GEMINI_MODEL or os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            "openai_model": cfg.OPENAI_MODEL or os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        }

    def _call_deepseek(
        self,
        api_key: str,
        model: str,
        system_prompt: str,
        user_prompt: str,
        task: str,
        video_id: str
    ) -> Optional[str]:
        url = "https://api.deepseek.com/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 1500
        }
        if "json" in (system_prompt + " " + user_prompt).lower():
            payload["response_format"] = {"type": "json_object"}

        t0 = time.time()
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=self.timeout)
            dur_ms = int((time.time() - t0) * 1000)

            if resp.status_code == 200:
                data = resp.json()
                usage = data.get("usage", {})
                p_tokens = usage.get("prompt_tokens", 0)
                c_tokens = usage.get("completion_tokens", 0)
                cost = estimate_cost(model, p_tokens, c_tokens)

                record_ai_usage(
                    provider="DeepSeek",
                    model=model,
                    task=task,
                    video_id=video_id,
                    prompt_tokens=p_tokens,
                    completion_tokens=c_tokens,
                    estimated_cost=cost,
                    duration_ms=dur_ms,
                    status="success"
                )
                return data["choices"][0]["message"]["content"]
            else:
                err_msg = resp.text[:200]
                record_ai_usage(
                    provider="DeepSeek",
                    model=model,
                    task=task,
                    video_id=video_id,
                    duration_ms=dur_ms,
                    status="error",
                    error_message=f"HTTP {resp.status_code}: {err_msg}"
                )
                log_event("WARNING", f"DeepSeek API error {resp.status_code}: {err_msg}")
        except Exception as e:
            dur_ms = int((time.time() - t0) * 1000)
            record_ai_usage(
                provider="DeepSeek",
                model=model,
                task=task,
                video_id=video_id,
                duration_ms=dur_ms,
                status="error",
                error_message=str(e)
            )
            log_event("WARNING", f"DeepSeek ngoại lệ: {e}")

        return None

    def _call_gemini(
        self,
        api_key: str,
        model: str,
        system_prompt: str,
        user_prompt: str,
        task: str,
        video_id: str
    ) -> Optional[str]:
        cfg = self._get_active_config()
        base_url = _resolve_gemini_base_url(cfg.get("gemini_base_url", ""))

        models_to_try = [model]
        for candidate in ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-3.8-flash"]:
            if candidate not in models_to_try:
                models_to_try.append(candidate)

        for m in models_to_try:
            url = f"{base_url}/v1beta/models/{m}:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": f"SYSTEM INSTRUCTION: {system_prompt}\n\nUSER REQUEST: {user_prompt}"}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 1500,
                    "responseMimeType": "application/json"
                }
            }

            t0 = time.time()
            try:
                resp = requests.post(url, headers=headers, json=payload, timeout=self.timeout)
                dur_ms = int((time.time() - t0) * 1000)

                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        usage = data.get("usageMetadata", {})
                        p_tokens = usage.get("promptTokenCount", 0)
                        c_tokens = usage.get("candidatesTokenCount", 0)
                        cost = estimate_cost(m, p_tokens, c_tokens)

                        record_ai_usage(
                            provider="Gemini",
                            model=m,
                            task=task,
                            video_id=video_id,
                            prompt_tokens=p_tokens,
                            completion_tokens=c_tokens,
                            estimated_cost=cost,
                            duration_ms=dur_ms,
                            status="success"
                        )

                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            return parts[0].get("text", "")
                else:
                    err_msg = resp.text[:200]
                    record_ai_usage(
                        provider="Gemini",
                        model=m,
                        task=task,
                        video_id=video_id,
                        duration_ms=dur_ms,
                        status="error",
                        error_message=f"HTTP {resp.status_code}: {err_msg}"
                    )
            except Exception as e:
                dur_ms = int((time.time() - t0) * 1000)
                record_ai_usage(
                    provider="Gemini",
                    model=m,
                    task=task,
                    video_id=video_id,
                    duration_ms=dur_ms,
                    status="error",
                    error_message=str(e)
                )
                continue

        return None

    def _call_openai(
        self,
        api_key: str,
        model: str,
        system_prompt: str,
        user_prompt: str,
        task: str,
        video_id: str
    ) -> Optional[str]:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 1500
        }
        if "json" in (system_prompt + " " + user_prompt).lower():
            payload["response_format"] = {"type": "json_object"}

        t0 = time.time()
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=self.timeout)
            dur_ms = int((time.time() - t0) * 1000)

            if resp.status_code == 200:
                data = resp.json()
                usage = data.get("usage", {})
                p_tokens = usage.get("prompt_tokens", 0)
                c_tokens = usage.get("completion_tokens", 0)
                cost = estimate_cost(model, p_tokens, c_tokens)

                record_ai_usage(
                    provider="OpenAI",
                    model=model,
                    task=task,
                    video_id=video_id,
                    prompt_tokens=p_tokens,
                    completion_tokens=c_tokens,
                    estimated_cost=cost,
                    duration_ms=dur_ms,
                    status="success"
                )
                return data["choices"][0]["message"]["content"]
            else:
                err_msg = resp.text[:200]
                record_ai_usage(
                    provider="OpenAI",
                    model=model,
                    task=task,
                    video_id=video_id,
                    duration_ms=dur_ms,
                    status="error",
                    error_message=f"HTTP {resp.status_code}: {err_msg}"
                )
        except Exception as e:
            dur_ms = int((time.time() - t0) * 1000)
            record_ai_usage(
                provider="OpenAI",
                model=model,
                task=task,
                video_id=video_id,
                duration_ms=dur_ms,
                status="error",
                error_message=str(e)
            )

        return None

    def query_llm(
        self,
        system_prompt: str,
        user_prompt: str,
        task: str = "general_ai",
        video_id: str = "",
        custom_provider: Optional[str] = None,
        custom_model: Optional[str] = None
    ) -> Optional[str]:
        cfg = self._get_active_config()
        primary = (custom_provider or cfg.get("provider", "openai")).lower()

        # Thứ tự gọi provider
        providers_order = [primary]
        for p in ["openai", "gemini", "deepseek"]:
            if p not in providers_order:
                providers_order.append(p)

        for provider in providers_order:
            key = cfg.get(f"{provider}_key")
            if not key:
                continue

            model = custom_model if custom_model and provider == primary else cfg.get(f"{provider}_model")

            try:
                if provider == "deepseek":
                    res = self._call_deepseek(key, model or "deepseek-chat", system_prompt, user_prompt, task, video_id)
                elif provider == "gemini":
                    res = self._call_gemini(key, model or "gemini-2.5-flash", system_prompt, user_prompt, task, video_id)
                elif provider == "openai":
                    res = self._call_openai(key, model or "gpt-4o-mini", system_prompt, user_prompt, task, video_id)
                else:
                    res = None

                if res:
                    return res
            except Exception as e:
                log_event("WARNING", f"Thử gọi LLM {provider} ({model}) thất bại: {e}")
                continue

        return None

    def curate_viral_segment(
        self,
        transcript_segments: List[Dict[str, Any]],
        total_duration: float,
        target_duration: int = 65,
        video_title: str = "",
        video_id: str = "",
        custom_provider: Optional[str] = None,
        custom_model: Optional[str] = None,
        hook_angle: Optional[str] = "auto"
    ) -> Dict[str, Any]:
        """
        Phân tích transcript toàn bộ video để tìm phân đoạn kịch tính/hài hước nhất
        (Virality Score cao nhất) kéo dài 61s - 85s (chuẩn TikTok Creator Rewards > 1 phút).
        Tự động nhận diện ngôn ngữ (Tiếng Anh / Tiếng Việt) để sinh Hook, Title, Hashtag chuẩn ngách.
        """
        condensed_transcript = []
        forbidden_ranges = []

        for s in transcript_segments:
            st = s.get("start", 0)
            en = s.get("end", 0)
            txt = s.get("text", "").strip()
            if not txt:
                continue

            low_txt = txt.lower()
            is_sponsor = any(k in low_txt for k in SPONSOR_KEYWORDS)
            is_intro = any(k in low_txt for k in INTRO_TRANSITION_KEYWORDS)

            if is_sponsor:
                condensed_transcript.append(f"[{st:.1f}s - {en:.1f}s] [SPONSOR AD - STRICTLY FORBIDDEN] {txt}")
                forbidden_ranges.append((st, en, "SPONSOR"))
            elif is_intro:
                condensed_transcript.append(f"[{st:.1f}s - {en:.1f}s] [BORING INTRO/TRANSITION - FORBIDDEN] {txt}")
                forbidden_ranges.append((st, en, "INTRO"))
            else:
                condensed_transcript.append(f"[{st:.1f}s - {en:.1f}s] {txt}")

        # Cho phép LLM duyệt qua toàn bộ transcript (tối đa 1200 câu ~ 20-30 phút video)
        transcript_text = "\n".join(condensed_transcript[:1200])

        # Phát hiện ngôn ngữ chủ đạo từ tiêu đề và transcript
        sample_text = (video_title + " " + " ".join(condensed_transcript[:20])).lower()
        is_vietnamese = any(c in sample_text for c in "àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ")
        lang_instruction = "VIETNAMESE (Tiếng Việt)" if is_vietnamese else "ENGLISH (Tiếng Anh - match the source video language)"

        # Định hướng trọng tâm phân đoạn dựa trên hook_angle đã chọn (Winning Variant Focus)
        angle_instruction = ""
        if hook_angle == "controversy":
            angle_instruction = (
                "\n\n*** SPECIAL TARGETING: CONTROVERSY & HEATED DEBATE ANGLE ***\n"
                "The user explicitly requires the CONTROVERSY / EXPOSURE segment.\n"
                "You MUST scan the transcript and select the specific 61-85s segment with the most intense argument, disagreement, "
                "callout, exposure of hypocrisy, or heated clash of opinions between the speakers.\n"
                "The opening 0-3s must drop the viewer straight into the heat of the argument!\n"
            )
        elif hook_angle == "curiosity":
            angle_instruction = (
                "\n\n*** SPECIAL TARGETING: CURIOSITY & SECRET REVELATION ANGLE ***\n"
                "The user explicitly requires the CURIOSITY / SECRET REVELATION segment.\n"
                "You MUST scan the transcript and select the specific 61-85s segment containing the most mysterious, lesser-known truth, "
                "bizarre discovery, or shocking explanation that creates an overwhelming curiosity gap.\n"
                "The opening 0-3s must pose a shocking premise that forces viewers to watch till the end to find the answer!\n"
            )
        elif hook_angle == "climax":
            angle_instruction = (
                "\n\n*** SPECIAL TARGETING: CLIMAX & DRAMATIC PLOT TWIST ANGLE ***\n"
                "The user explicitly requires the CLIMAX / PAYOFF segment.\n"
                "You MUST scan the transcript and select the specific 61-85s segment that builds up to the biggest emotional peak, "
                "shocking punchline, or jaw-dropping revelation of the episode!\n"
            )

        system_prompt = (
            "You are an elite viral video editor, TikTok SEO strategist, and retention engineer for top clipping channels.\n"
            f"TARGET LANGUAGE: {lang_instruction}. All output text (hook_3s, viral_title, description, hashtags) MUST match this target language.\n\n"
            "Your task is to analyze the entire timestamped transcript and select the SINGLE MOST VIRAL segment of length 61 to 85 seconds "
            "(strictly required for TikTok Creator Rewards Beta > 60s).\n\n"
            "CRITICAL CONTENT BLACKLIST (STRICTLY FORBIDDEN FROM SELECTION):\n"
            "You are FORBIDDEN from choosing any segment containing:\n"
            "1. GREETINGS & INTROS: 'Hey guys', 'Welcome back', 'What's up everybody', 'In today's video', 'Before we get started'.\n"
            "2. SEGMENT TRANSITIONS: 'Okay so now let's move on to', 'Next up', 'Let's dive in', 'As I mentioned earlier', 'Going back to that point'.\n"
            "3. SPONSOR ADS & PROMOTIONS: 'This video is sponsored by', 'Use code', 'discount code', 'link in the description', 'download the app', 'gambling problem', brand mentions (DraftKings, NordVPN, BetterHelp, Manscaped, etc.). Any lines tagged [SPONSOR AD - STRICTLY FORBIDDEN] MUST BE AVOIDED.\n"
            "4. FILLER-HEAVY & RAMBLING: Drop sections heavy with 'um', 'uh', 'you know', long awkward pauses, or repeated stutters.\n"
            "The selected clip MUST be 100% pure core dialogue, insight, debate, or dramatic conversation between the speakers!\n\n"
            "VIRALITY & TIKTOK SEO RULES:\n"
            "1. THE HOOK (First 0-3s): Must start immediately on an explosive, shocking, or hilarious reaction/statement. Cut out all boring intros or dead silence.\n"
            "2. HOOK_3S PSYCHOLOGY: Must be 3-6 bold words in UPPERCASE teasing the biggest conflict, suspense, or emotional payoff (e.g. 'NOBODY SAW THIS COMING', 'HE EXPOSED THE TRUTH', 'THE LAST 10 SECONDS...'). Never use vague words.\n"
            "3. TIKTOK SEARCH SEO (DESCRIPTION & TITLE):\n"
            "   - TikTok indexes the first line of the caption for search queries. Begin the description with a natural, high-intent SEARCH KEYWORD PHRASE (e.g., 'Khabib training routine and discipline explained' or 'iShowSpeed funniest stream moments').\n"
            "   - Follow immediately with a PROVOCATIVE QUESTION or DEBATE TRIGGER that compels viewers to comment (comments are the #1 algorithm distribution signal).\n"
            "4. CLIMAX & NATURAL END: Must capture the peak emotional moment and end naturally at the end of a thought or punchline. NEVER cut mid-sentence!\n"
            "5. ZERO SPAM HASHTAGS: Provide 4-6 hyper-targeted niche tags (e.g., #khabib #ufc #mmafitness #danawhite). STRICTLY BANNED: #fyp #viral #foryou #foryoupage #xuhuong. These dead tags dilute account classification!\n"
            "6. Return strictly valid JSON with no markdown formatting outside JSON."
        )

        user_prompt = (
            f"Video Title: {video_title}\n"
            f"Total Duration: {total_duration:.1f}s\n"
            f"Target Duration: {target_duration}s - 85s (must be >= 61.0s and <= 85.0s)\n\n"
            f"{angle_instruction}\n"
            f"Transcript:\n{transcript_text}\n\n"
            "Output JSON with this exact schema:\n"
            "{\n"
            '  "start_time": <float: start timestamp in seconds>,\n'
            '  "end_time": <float: end timestamp in seconds, strictly end_time - start_time >= 61.0>,\n'
            '  "hook_3s": "<3-6 punchy words in UPPERCASE without emojis, e.g. NOBODY SAW THIS COMING or HE SAID WHAT EVERYONE THOUGHT>",\n'
            '  "hook_curiosity": "<Variant A Curiosity hook: 3-6 words in UPPERCASE, e.g. NOBODY NOTICED THIS DETAIL>",\n'
            '  "hook_controversy": "<Variant B Debate hook: 3-6 words in UPPERCASE, e.g. HE EXPOSED THE ENTIRE TRUTH>",\n'
            '  "hook_climax": "<Variant C Climax hook: 3-6 words in UPPERCASE, e.g. THE LAST 10 SECONDS ARE CRAZY>",\n'
            '  "viral_title": "<High-CTR title with 1-2 emojis, containing primary topic keywords for TikTok SEO>",\n'
            '  "description": "<Line 1: High-intent TikTok Search phrase. Line 2: Provocative question to force comments. Total ~15-25 words>",\n'
            '  "hashtags": "<4-6 hyper-targeted niche hashtags. NO #fyp or #viral>",\n'
            '  "virality_score": <int 1-100>,\n'
            '  "explanation": "<Why this moment will blow up on TikTok>"\n'
            "}"
        )

        raw_json = self.query_llm(
            system_prompt,
            user_prompt,
            task="curate_viral_segment",
            video_id=video_id,
            custom_provider=custom_provider,
            custom_model=custom_model
        )
        if raw_json:
            try:
                cleaned = re.sub(r"^```json\s*", "", raw_json.strip())
                cleaned = re.sub(r"\s*```$", "", cleaned)
                data = json.loads(cleaned)
                start = float(data.get("start_time", 0))
                end = float(data.get("end_time", start + target_duration))

                # Đảm bảo độ dài tối thiểu 61s cho TikTok Beta
                if end - start < 61:
                    end = min(total_duration, start + max(61.0, float(target_duration)))

                # Chốt chặn kiểm tra chồng lấn quảng cáo tài trợ (Sponsor Overlap Guard)
                for f_st, f_en, reason in forbidden_ranges:
                    if reason == "SPONSOR":
                        if max(start, f_st) < min(end, f_en):
                            log_event("WARNING", f"[LLM CURATOR] Đoạn chọn [{start:.1f}s - {end:.1f}s] dính quảng cáo tài trợ [{f_st:.1f}s - {f_en:.1f}s]. Đang tự động dời sang nội dung đàm thoại sạch...")
                            if (total_duration - f_en) >= 61.0:
                                start = round(f_en + 1.5, 1)
                                end = min(total_duration, start + float(target_duration))
                            elif f_st >= 61.0:
                                end = round(f_st - 1.5, 1)
                                start = max(0.0, end - float(target_duration))
                            break

                hook = data.get("hook_3s", "").strip()
                title = data.get("viral_title", video_title).strip()
                desc = data.get("description", "").strip()
                tags = data.get("hashtags", "").strip()

                # Lọc bỏ các hashtag rác/dead tags (#fyp, #viral) làm loãng thuật toán
                if tags:
                    banned_tags = {"#fyp", "#viral", "#foryou", "#foryoupage", "#trending", "#xuhuong", "#xuhuongtiktok"}
                    tokens = [t.strip() for t in tags.split() if t.strip()]
                    cleaned_tokens = [t for t in tokens if t.lower() not in banned_tags]
                    if cleaned_tokens:
                        tags = " ".join(cleaned_tokens)

                if not tags:
                    tags = "#highlights #clips #story #podcast #gaming" if not is_vietnamese else "#tintuc #giaitri #shorts #cliphot #videohay"

                hook_curiosity = data.get("hook_curiosity") or hook or "NOBODY NOTICED THIS"
                hook_controversy = data.get("hook_controversy") or hook or "HE EXPOSED THE TRUTH"
                hook_climax = data.get("hook_climax") or hook or "WAIT TILL THE END"

                return {
                    "start_time": max(0.0, start),
                    "end_time": min(total_duration, end),
                    "duration": round(end - start, 1),
                    "hook_3s": hook,
                    "hook_curiosity": hook_curiosity.strip(),
                    "hook_controversy": hook_controversy.strip(),
                    "hook_climax": hook_climax.strip(),
                    "viral_title": title,
                    "description": desc,
                    "hashtags": tags,
                    "virality_score": data.get("virality_score", 90),
                    "source": "cloud_llm"
                }
            except Exception as e:
                log_event("WARNING", f"Lỗi parse JSON từ LLM: {e}")

        # Heuristic fallback an toàn
        return self.fallback_heuristic_segment(total_duration, target_duration, video_title, video_id=video_id, is_vietnamese=is_vietnamese)

    def curate_distinct_viral_moments(
        self,
        transcript_segments: List[Dict[str, Any]],
        total_duration: float,
        target_duration: int = 65,
        video_title: str = "",
        video_id: str = "",
        count: int = 3,
        custom_provider: Optional[str] = None,
        custom_model: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Chọn tối đa `count` phân đoạn viral HOÀN TOÀN KHÁC NHAU (Non-overlapping) từ video nguồn.
        Mỗi phân đoạn có nội dung trò chuyện, góc nhìn, tiêu đề và hook riêng biệt.
        Dùng cho Gap 1 (Deep Variant Differentiation) nhằm xóa bỏ hoàn toàn rủi ro Semantic Clustering của TikTok.
        """
        if not transcript_segments or total_duration <= 180:
            m1 = self.curate_viral_segment(
                transcript_segments, total_duration, target_duration, video_title, video_id, custom_provider, custom_model
            )
            return [m1]

        # Trích xuất phân đoạn 1
        m1 = self.curate_viral_segment(
            transcript_segments, total_duration, target_duration, video_title, video_id, custom_provider, custom_model
        )
        moments = [m1]
        used_ranges = [(m1["start_time"], m1["end_time"])]

        # Tìm phân đoạn thứ 2 và 3 từ các phần còn lại của transcript
        for _ in range(count - 1):
            remaining_segments = [
                s for s in transcript_segments
                if not any(max(s.get("start", 0), u_st - 30) < min(s.get("end", 0), u_en + 30) for u_st, u_en in used_ranges)
            ]
            if len(remaining_segments) < 15:
                break
            try:
                next_m = self.curate_viral_segment(
                    remaining_segments, total_duration, target_duration, video_title, video_id, custom_provider, custom_model
                )
                if not any(max(next_m["start_time"], u_st) < min(next_m["end_time"], u_en) for u_st, u_en in used_ranges):
                    moments.append(next_m)
                    used_ranges.append((next_m["start_time"], next_m["end_time"]))
            except Exception:
                break

        return moments

    def generate_hook_and_copy(self, raw_title: str, video_id: str = "") -> Dict[str, str]:
        """
        Sinh Hook 3s, Tiêu đề viral, Caption và Hashtag từ tiêu đề gốc chuẩn ngôn ngữ và nội dung
        """
        clean_title = raw_title.replace("#", "").strip()
        is_vietnamese = any(c in clean_title.lower() for c in "àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ")
        lang = "VIETNAMESE" if is_vietnamese else "ENGLISH"

        system_prompt = (
            f"You are a master TikTok copywriter and SEO strategist. Language MUST be {lang}.\n"
            "Create high-CTR, TikTok Search SEO-optimized metadata for this video.\n"
            "Requirements:\n"
            "- hook_3s: 3-6 bold words in UPPERCASE teasing conflict, curiosity gap or surprise (e.g. 'NOBODY NOTICED THIS', 'WAIT TILL THE END').\n"
            "- viral_title: High-CTR searchable title with 1-2 emojis, containing key terms viewers search for on TikTok.\n"
            "- description: Line 1 = Natural search phrase users type on TikTok. Line 2 = Provocative question driving comments.\n"
            "- hashtags: 4-6 hyper-targeted niche hashtags. STRICTLY BANNED: #fyp, #viral, #foryou, #xuhuong.\n"
            "Output JSON with keys: hook_3s, viral_title, description, hashtags."
        )

        user_prompt = f"Video title: {clean_title}"

        raw_json = self.query_llm(system_prompt, user_prompt, task="generate_hook_copy", video_id=video_id)
        if raw_json:
            try:
                cleaned = re.sub(r"^```json\s*", "", raw_json.strip())
                cleaned = re.sub(r"\s*```$", "", cleaned)
                data = json.loads(cleaned)
                tags = data.get("hashtags", "").strip()
                if tags:
                    banned_tags = {"#fyp", "#viral", "#foryou", "#foryoupage", "#trending", "#xuhuong", "#xuhuongtiktok"}
                    tokens = [t.strip() for t in tags.split() if t.strip()]
                    cleaned_tokens = [t for t in tokens if t.lower() not in banned_tags]
                    if cleaned_tokens:
                        tags = " ".join(cleaned_tokens)
                hook = data.get("hook_3s", clean_title[:40].upper())
                return {
                    "hook": hook,
                    "hook_curiosity": data.get("hook_curiosity") or hook or "NOBODY NOTICED THIS",
                    "hook_controversy": data.get("hook_controversy") or hook or "HE EXPOSED THE TRUTH",
                    "hook_climax": data.get("hook_climax") or hook or "WAIT TILL THE END",
                    "viral_title": data.get("viral_title", f"{clean_title} 😱"),
                    "description": data.get("description", f"Search insights on {clean_title[:40]}. What do you think?"),
                    "tags": tags or "#highlights #clips #story #podcast"
                }
            except Exception:
                pass

        # Heuristic fallback chuẩn ngôn ngữ và SEO
        if is_vietnamese:
            return {
                "hook": f"CHI TIẾT BẤT NGỜ: {clean_title[:30]}".upper(),
                "viral_title": f"{clean_title} 😱 Xem ngay!",
                "description": f"Phân tích chi tiết về {clean_title[:45]}. Bạn nghĩ sao về điều này?",
                "tags": "#tintuc #giaitri #shorts #cliphot #videohay"
            }
        else:
            return {
                "hook": f"WAIT TILL THE END: {clean_title[:30]}".upper(),
                "viral_title": f"{clean_title} 😭",
                "description": f"Full context behind {clean_title[:45]}. What would you do in this situation?",
                "tags": "#highlights #clips #story #podcast #gaming"
            }

    def fallback_heuristic_segment(
        self,
        total_duration: float,
        target_duration: int,
        video_title: str,
        video_id: str = "",
        is_vietnamese: bool = False
    ) -> Dict[str, Any]:
        """Dự phòng thuật toán khi chưa có LLM phản hồi"""
        start = 0.0
        if total_duration > 150:
            start = 15.0

        dur = min(float(target_duration), total_duration - start)
        dur = max(61.0, dur) if total_duration >= 61 else total_duration
        end = min(total_duration, start + dur)

        copy_data = self.generate_hook_and_copy(video_title, video_id=video_id)
        return {
            "start_time": start,
            "end_time": end,
            "duration": end - start,
            "hook_3s": copy_data["hook"],
            "hook_curiosity": copy_data.get("hook_curiosity", copy_data["hook"]),
            "hook_controversy": copy_data.get("hook_controversy", copy_data["hook"]),
            "hook_climax": copy_data.get("hook_climax", copy_data["hook"]),
            "viral_title": copy_data["viral_title"],
            "description": copy_data["description"],
            "hashtags": copy_data["tags"],
            "virality_score": 75,
            "source": "heuristic_fallback"
        }

llm_curator = LLMCurator()
