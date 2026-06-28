"""Priority scoring engine — full implementation in scoring step."""
from typing import List


def compute_priority_score(
    demand_score: float,
    gap_score: float,
    feasibility_score: float,
    urgency_score: float
) -> float:
    """
    Weighted formula:
      demand × 0.40 + gap × 0.35 + feasibility × 0.15 + urgency × 0.10
    All inputs normalised 0–1.
    """
    return round(
        demand_score * 0.40
        + gap_score * 0.35
        + feasibility_score * 0.15
        + urgency_score * 0.10,
        4
    )
