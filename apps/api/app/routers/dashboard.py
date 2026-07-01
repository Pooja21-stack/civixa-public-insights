"""
Dashboard stats router — aggregates data for the MP dashboard overview panel.

GET /api/v1/dashboard/stats
  Returns total submissions, themes breakdown, urgency distribution, top ward counts.
  Works without PostGIS — uses pure SQL aggregations on the submissions table.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_deps import require_role
from app.core.database import get_db
from app.models.submission import Submission
from app.models.project import Project
from app.models.user import User

router = APIRouter()


@router.get("/stats")
async def get_dashboard_stats(
    db:    AsyncSession = Depends(get_db),
    _user: User         = Depends(require_role("staff", "mp", "admin")),
):
    """
    Aggregated stats for the MP dashboard.

    Returns:
      total_submissions     — all-time count
      processed_submissions — submissions with at least 1 theme extracted
      theme_breakdown       — list of {theme, count, pct}
      urgency_distribution  — {low, medium, high, critical} counts
      top_priority_projects — top 5 projects by priority_rank
      active_wards          — count of wards with ≥1 submission
    """
    # ── Total & processed ────────────────────────────────────────────────────
    total_result = await db.execute(select(func.count()).select_from(Submission))
    total = total_result.scalar_one() or 0

    processed_result = await db.execute(
        select(func.count()).select_from(Submission).where(
            Submission.themes.isnot(None),
        )
    )
    processed = processed_result.scalar_one() or 0

    # ── Urgency distribution ─────────────────────────────────────────────────
    urgency_result = await db.execute(
        select(Submission.urgency_level, func.count().label("cnt"))
        .group_by(Submission.urgency_level)
    )
    urgency_rows = urgency_result.fetchall()
    urgency_dist = {row.urgency_level: row.cnt for row in urgency_rows}

    # ── Top priority projects ────────────────────────────────────────────────
    proj_result = await db.execute(
        select(Project).order_by(Project.priority_rank.asc()).limit(5)
    )
    projects = proj_result.scalars().all()
    top_projects = [
        {
            "id":             p.id,
            "title":          p.title,
            "theme":          p.theme,
            "priority_rank":  p.priority_rank,
            "priority_score": round(p.priority_score or 0, 3),
            "submission_count": p.submission_count,
            "ward_id":        p.ward_id,
        }
        for p in projects
    ]

    # ── Active wards ─────────────────────────────────────────────────────────
    wards_result = await db.execute(
        select(func.count(func.distinct(Submission.ward_id))).where(
            Submission.ward_id.isnot(None)
        )
    )
    active_wards = wards_result.scalar_one() or 0

    # ── Theme breakdown — works with both PostgreSQL (jsonb) and SQLite ────────
    theme_breakdown = []
    try:
        # Try PostgreSQL jsonb first
        theme_agg = await db.execute(
            text("""
                SELECT jsonb_array_elements_text(themes::jsonb) AS theme,
                       COUNT(*) AS cnt
                FROM submissions
                WHERE themes IS NOT NULL AND themes != '[]'::jsonb
                GROUP BY theme
                ORDER BY cnt DESC
                LIMIT 20
            """)
        )
        rows = theme_agg.fetchall()
        if total > 0:
            theme_breakdown = [
                {"theme": r.theme, "count": r.cnt, "pct": round(r.cnt / total * 100, 1)}
                for r in rows
            ]
    except Exception:
        # SQLite fallback — load themes in Python and aggregate
        try:
            from app.models.submission import Submission as Sub
            from collections import Counter
            subs_result = await db.execute(select(Sub))
            all_subs = subs_result.scalars().all()
            counter: Counter = Counter()
            for s in all_subs:
                for theme in (s.themes or []):
                    counter[theme] += 1
            total_themed = sum(counter.values()) or 1
            theme_breakdown = [
                {"theme": t, "count": c, "pct": round(c / total_themed * 100, 1)}
                for t, c in counter.most_common(20)
            ]
        except Exception:
            pass

    return {
        "total_submissions":     total,
        "processed_submissions": processed,
        "theme_breakdown":       theme_breakdown,
        "urgency_distribution":  {
            "low":      urgency_dist.get("low", 0),
            "medium":   urgency_dist.get("medium", 0),
            "high":     urgency_dist.get("high", 0),
            "critical": urgency_dist.get("critical", 0),
        },
        "top_priority_projects": top_projects,
        "active_wards":          active_wards,
    }
