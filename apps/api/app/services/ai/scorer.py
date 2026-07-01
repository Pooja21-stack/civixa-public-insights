"""
Priority scoring engine.

Computes a single 0–1 priority score for each (theme, ward) combination
using a weighted formula:

    priority = demand×0.40 + gap×0.35 + feasibility×0.15 + urgency×0.10

Components
----------
demand_score
    Normalised submission count for this theme in this ward vs the maximum
    across all (theme, ward) pairs.  High citizen demand → high score.

gap_score
    Infrastructure gap relative to demographic need.  Currently uses the
    ward's nearest_school_km and nearest_hospital_km fields from the DB.
    A gap >5 km → score ~1.0; a gap <1 km → score ~0.1.
    Feasibility of extending this to other themes is via the ward's
    demographics JSON field.

feasibility_score
    Proxy for how actionable the project is:
    - Is it mentioned in a local development plan document? (+0.4)
    - Is a ward boundary defined?                          (+0.3)
    - Base score                                           (0.3)
    Capped at 1.0.

urgency_score
    Average urgency_score of all submissions for this (theme, ward) pair.
"""
from __future__ import annotations
import logging
import math
from typing import List

logger = logging.getLogger(__name__)


# ─── Core formula ─────────────────────────────────────────────────────────────

def compute_priority_score(
    demand_score: float,
    gap_score: float,
    feasibility_score: float,
    urgency_score: float,
) -> float:
    """
    Weighted priority formula.  All inputs must be normalised 0–1.
    Returns a float in [0, 1] rounded to 4 decimal places.
    """
    score = (
        demand_score      * 0.40
        + gap_score       * 0.35
        + feasibility_score * 0.15
        + urgency_score   * 0.10
    )
    return round(max(0.0, min(1.0, score)), 4)


# ─── Demand score ─────────────────────────────────────────────────────────────

def compute_demand_score(submission_count: int, max_count: int) -> float:
    """Normalise submission count against the observed maximum."""
    if max_count <= 0:
        return 0.0
    return round(min(1.0, submission_count / max_count), 4)


# ─── Gap score ────────────────────────────────────────────────────────────────

def compute_gap_score(theme: str, ward_data: dict) -> float:
    """
    Compute an infrastructure gap score for the given theme and ward.

    ward_data keys used:
        nearest_school_km     float
        nearest_hospital_km   float
        school_age_population int
        population            int
    """
    try:
        if theme == "schools":
            km = float(ward_data.get("nearest_school_km", 0))
            # 0 km → 0.0 score; 8+ km → 1.0 score (sigmoid-like)
            return round(_km_to_gap_score(km, midpoint=4.0), 4)

        elif theme == "health":
            km = float(ward_data.get("nearest_hospital_km", 0))
            return round(_km_to_gap_score(km, midpoint=10.0), 4)

        elif theme == "roads":
            # Proxy: assume roads matter more in wards with high population but
            # poor school/hospital proximity (both far = road connectivity is bad)
            school_km   = float(ward_data.get("nearest_school_km",   0))
            hospital_km = float(ward_data.get("nearest_hospital_km", 0))
            avg_km = (school_km + hospital_km) / 2.0
            return round(_km_to_gap_score(avg_km, midpoint=5.0), 4)

        elif theme == "water":
            # No direct metric — use population density as proxy for demand pressure
            pop = int(ward_data.get("population", 10000))
            # Higher population → potentially higher strain on water infrastructure
            return round(min(1.0, pop / 35000.0), 4)

        elif theme == "electricity":
            pop = int(ward_data.get("population", 10000))
            return round(min(1.0, pop / 30000.0), 4)

        else:
            return 0.5  # neutral gap score for "other" theme

    except Exception as e:
        logger.warning("Gap score computation failed for theme=%s: %s", theme, e)
        return 0.5


def _km_to_gap_score(km: float, midpoint: float) -> float:
    """Sigmoid that maps distance to a 0–1 gap score.
    At 0 km → ~0.1, at midpoint km → 0.5, at 2×midpoint km → ~0.9"""
    if km <= 0:
        return 0.1
    # logistic: 1 / (1 + exp(-k*(x - midpoint)))  with k chosen so slope is reasonable
    k = 0.8 / midpoint
    return 1.0 / (1.0 + math.exp(-k * (km - midpoint)))


# ─── Feasibility score ────────────────────────────────────────────────────────

def compute_feasibility_score(
    in_dev_plan: bool = False,
    ward_has_boundary: bool = True,
) -> float:
    """
    Simple feasibility proxy.
    - base score:          0.30
    - in dev plan:        +0.40
    - ward has boundary:  +0.30
    """
    score = 0.30
    if in_dev_plan:
        score += 0.40
    if ward_has_boundary:
        score += 0.30
    return round(min(1.0, score), 4)


# ─── Rank projects ────────────────────────────────────────────────────────────

def rank_projects(projects: List[dict]) -> List[dict]:
    """
    Given a list of project dicts each containing demand_score, gap_score,
    feasibility_score, urgency_score — compute priority_score and assign ranks.

    Returns the same list sorted by priority_score descending with rank added.
    """
    for p in projects:
        p["priority_score"] = compute_priority_score(
            p.get("demand_score",      0.0),
            p.get("gap_score",         0.0),
            p.get("feasibility_score", 0.5),
            p.get("urgency_score",     0.5),
        )

    projects.sort(key=lambda p: p["priority_score"], reverse=True)

    for rank, p in enumerate(projects, start=1):
        p["priority_rank"] = rank

    return projects
