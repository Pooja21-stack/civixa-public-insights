from fastapi import APIRouter

router = APIRouter()

THEMES = [
    {"key": "roads", "name": "Roads & Transport"},
    {"key": "schools", "name": "Schools & Education"},
    {"key": "water", "name": "Water & Sanitation"},
    {"key": "health", "name": "Healthcare"},
    {"key": "electricity", "name": "Electricity"},
    {"key": "other", "name": "Other"},
]


@router.get("")
def list_themes():
    return THEMES
