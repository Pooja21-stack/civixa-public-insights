"""PDF ingestion for local development plans — full implementation in RAG step."""
import fitz  # PyMuPDF


def extract_text_from_pdf(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    return "\n".join(page.get_text() for page in doc)
