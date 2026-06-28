from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.core.database import get_db
from app.schemas.submission import SubmissionCreate, SubmissionResponse, SubmissionListResponse

router = APIRouter()


@router.post("", response_model=SubmissionResponse, status_code=201)
async def create_submission(
    text_raw: str = Form(...),
    channel: str = Form("web"),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    ward_id: Optional[str] = Form(None),
    lang: Optional[str] = Form(None),
    media: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db)
):
    # Full implementation wired in AI pipeline step
    raise HTTPException(status_code=501, detail="Submission service not yet implemented")


@router.get("", response_model=SubmissionListResponse)
async def list_submissions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    theme: Optional[str] = Query(None),
    ward_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    raise HTTPException(status_code=501, detail="Not yet implemented")


@router.get("/hotspots")
async def get_hotspots(db: AsyncSession = Depends(get_db)):
    raise HTTPException(status_code=501, detail="Not yet implemented")
