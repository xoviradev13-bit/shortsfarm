"""
Backward-compatibility shim module forwarding to ai_story_engine.
Preserves existing legacy references while keeping the core logic in ai_story_engine.py.
"""
from backend.modules.ai_addon.ai_story_engine import (
    AIStoryEngine,
    ai_story_engine,
    IMAGE_STYLES,
)

MoneyPrinterEngine = AIStoryEngine
money_printer_engine = ai_story_engine

__all__ = [
    "AIStoryEngine",
    "ai_story_engine",
    "MoneyPrinterEngine",
    "money_printer_engine",
    "IMAGE_STYLES",
]
