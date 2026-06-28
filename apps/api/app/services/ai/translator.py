"""Language detection and translation service."""
from deep_translator import GoogleTranslator
import langdetect


def detect_language(text: str) -> str:
    try:
        return langdetect.detect(text)
    except Exception:
        return "en"


def translate_to_english(text: str, src_lang: str = "auto") -> str:
    if src_lang == "en":
        return text
    try:
        return GoogleTranslator(source=src_lang, target="en").translate(text)
    except Exception:
        return text
