from __future__ import annotations
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class DocumentUploadResponse(BaseModel):
    id: str
    filename: str
    title: str
    doc_type: str
    file_size_kb: int
    status: str


class DocumentListItem(BaseModel):
    id: str
    filename: str
    size_kb: int


class DocumentQueryRequest(BaseModel):
    question: str
    top_k: int = 5


class DocumentQueryResponse(BaseModel):
    question: str
    answer: str
    sources: list
