"""
Language detection and translation service.

Uses:
  - langdetect  → fast probabilistic language identification
  - deep-translator (GoogleTranslator) → free translation, no API key needed

Both calls are wrapped with fallbacks so the pipeline never crashes on
unexpected input (empty strings, unsupported languages, network errors).
"""
from __future__ import annotations
import logging

logger = logging.getLogger(__name__)

# Languages we consider "already English" — skip translation cost
_ENGLISH_VARIANTS = {"en", "en-us", "en-gb", "en-in"}

# Languages deep-translator's GoogleTranslator supports by ISO code
# (subset — full list at https://py-googletrans.readthedocs.io)
_SUPPORTED_LANGS = {
    "hi", "mr", "ta", "te", "kn", "gu", "bn", "pa", "ur", "ml", "or",
    "fr", "de", "es", "pt", "ar", "zh", "ja", "ko", "ru",
}


def detect_language(text: str) -> str:
    """
    Detects the ISO 639-1 language code of the given text.
    Returns "en" on any failure.
    """
    if not text or not text.strip():
        return "en"
    try:
        import langdetect
        lang = langdetect.detect(text.strip())
        return lang.lower()[:2]  # normalise to 2-char code
    except Exception as e:
        logger.debug("Language detection failed: %s", e)
        return "en"


def translate_to_english(text: str, src_lang: str = "auto") -> str:
    """
    Translates text to English using Google Translate (free tier via deep-translator).

    Args:
        text:     The text to translate
        src_lang: ISO 639-1 source language code, or "auto" for auto-detection

    Returns:
        English translation, or the original text if translation fails/unnecessary.
    """
    if not text or not text.strip():
        return text

    # Already English — skip API call
    if src_lang.lower() in _ENGLISH_VARIANTS:
        return text

    # Auto-detect if not specified
    if src_lang == "auto":
        src_lang = detect_language(text)
        if src_lang in _ENGLISH_VARIANTS:
            return text

    try:
        from deep_translator import GoogleTranslator
        translated = GoogleTranslator(source=src_lang, target="en").translate(text)
        return translated or text
    except Exception as e:
        logger.warning("Translation failed (src=%s): %s — returning original", src_lang, e)
        return text


def detect_and_translate(text: str) -> dict:
    """
    Convenience function: detect language then translate.

    Returns:
        {
            "lang_detected": "hi",
            "text_translated": "English version of the text"
        }
    """
    lang = detect_language(text)
    translated = translate_to_english(text, src_lang=lang)
    return {
        "lang_detected": lang,
        "text_translated": translated,
    }
