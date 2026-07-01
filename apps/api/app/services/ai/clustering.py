"""
Submission clustering — groups semantically similar citizen submissions
using sentence-transformer embeddings + DBSCAN.

Why clustering matters
----------------------
Raw submission counts per (theme, ward) miss nuance.  Two submissions
saying "school roof is leaking" and "rainwater floods our classroom"
are the same underlying issue — clustering surfaces this so the MP
sees "12 submissions about school building damage" rather than scattered
individual complaints.

Pipeline
--------
1. Embed all submissions for a ward using sentence-transformers
   (paraphrase-multilingual-MiniLM-L12-v2 — supports Hindi, Tamil, etc.)
2. Run DBSCAN clustering on the embedding matrix
3. For each cluster: pick a representative submission and generate a label
4. Return clusters sorted by size (largest = highest citizen demand signal)

Fallback
--------
- If sentence-transformers is not installed → falls back to keyword-based
  grouping by theme tag (already computed by GPT-4o)
- Always returns a valid list — never crashes the pipeline
"""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


# ─── Embedding model (lazy-loaded) ────────────────────────────────────────────

_model = None  # cached SentenceTransformer instance


def _get_model():
    """Lazy-load the multilingual sentence-transformer model."""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            # paraphrase-multilingual-MiniLM-L12-v2:
            #   - Supports 50+ languages including all major Indian languages
            #   - 384-dim embeddings, ~120MB download, fast inference
            #   - Ideal for short citizen submission texts
            _model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
            logger.info("Loaded sentence-transformer model")
        except Exception as e:
            logger.warning("Could not load SentenceTransformer: %s — using keyword fallback", e)
            _model = None
    return _model


# ─── Core clustering function ─────────────────────────────────────────────────

def cluster_submissions(
    submissions: list[dict],
    eps: float = 0.35,
    min_samples: int = None,
) -> list[dict]:
    """
    Cluster a list of submission dicts by semantic similarity.

    Args:
        submissions:  List of dicts with at least {"id", "text_translated", "themes", "urgency_score"}
        eps:          DBSCAN epsilon — max cosine distance to be in same cluster (lower = tighter)
        min_samples:  Min submissions to form a cluster (default: settings.CLUSTER_MIN_SAMPLES)

    Returns:
        List of cluster dicts, sorted by size descending:
        [
          {
            "cluster_id":        0,
            "label":             "School access and distance",
            "theme":             "schools",
            "size":              12,
            "avg_urgency":       0.84,
            "representative":    "Children have to walk 7km to reach the nearest school...",
            "submission_ids":    ["sub-001", "sub-006", ...],
            "top_submissions":   [{"id": ..., "text": ..., "urgency_score": ...}, ...]
          },
          ...
        ]
        Noise submissions (cluster_id = -1) are returned as size-1 clusters
        if they have urgency_score >= 0.7.
    """
    min_samples = min_samples or settings.CLUSTER_MIN_SAMPLES

    if not submissions:
        return []

    texts = [s.get("text_translated") or s.get("text_raw", "") for s in submissions]

    model = _get_model()
    if model is None:
        return _keyword_cluster_fallback(submissions)

    try:
        import numpy as np
        from sklearn.cluster import DBSCAN
        from sklearn.preprocessing import normalize

        # 1. Embed
        embeddings = model.encode(
            texts,
            batch_size    = settings.EMBED_BATCH_SIZE,
            show_progress_bar = False,
            convert_to_numpy  = True,
        )

        # 2. L2-normalise → cosine distance = 1 − cosine_similarity
        embeddings = normalize(embeddings, norm="l2")

        # 3. DBSCAN on cosine distance
        clustering = DBSCAN(
            eps          = eps,
            min_samples  = min_samples,
            metric       = "cosine",
            algorithm    = "brute",
        ).fit(embeddings)

        labels: list[int] = clustering.labels_.tolist()

        # 4. Build cluster objects
        clusters = _build_clusters(submissions, labels, embeddings)
        logger.info(
            "Clustered %d submissions → %d clusters (eps=%.2f, min=%d)",
            len(submissions), len(clusters), eps, min_samples,
        )
        return clusters

    except ImportError as e:
        logger.warning("sklearn/numpy not available: %s — using keyword fallback", e)
        return _keyword_cluster_fallback(submissions)
    except Exception as e:
        logger.error("Clustering failed: %s — using keyword fallback", e)
        return _keyword_cluster_fallback(submissions)


# ─── Build cluster output ─────────────────────────────────────────────────────

def _build_clusters(
    submissions: list[dict],
    labels: list[int],
    embeddings,
) -> list[dict]:
    import numpy as np

    # Group submission indices by cluster label
    groups: dict[int, list[int]] = defaultdict(list)
    for idx, label in enumerate(labels):
        groups[label].append(idx)

    clusters = []
    for label, indices in groups.items():
        cluster_subs = [submissions[i] for i in indices]

        # Skip tiny noise clusters unless urgency is critical
        if label == -1:
            high_urgency = [s for s in cluster_subs if s.get("urgency_score", 0) >= 0.70]
            if not high_urgency:
                continue
            cluster_subs = high_urgency

        avg_urgency = sum(s.get("urgency_score", 0.5) for s in cluster_subs) / len(cluster_subs)

        # Representative = submission closest to cluster centroid
        sub_embeddings = embeddings[[submissions.index(s) for s in cluster_subs]]
        centroid       = sub_embeddings.mean(axis=0)
        dists          = np.linalg.norm(sub_embeddings - centroid, axis=1)
        rep_idx        = int(dists.argmin())
        representative = cluster_subs[rep_idx]

        # Dominant theme
        theme_counts: dict[str, int] = defaultdict(int)
        for s in cluster_subs:
            for t in s.get("themes", ["other"]):
                theme_counts[t] += 1
        dominant_theme = max(theme_counts, key=theme_counts.get) if theme_counts else "other"

        # Top 3 highest-urgency submissions for context
        top_subs = sorted(cluster_subs, key=lambda s: s.get("urgency_score", 0), reverse=True)[:3]

        clusters.append({
            "cluster_id":      label,
            "label":           _generate_cluster_label(dominant_theme, cluster_subs),
            "theme":           dominant_theme,
            "size":            len(cluster_subs),
            "avg_urgency":     round(avg_urgency, 4),
            "representative":  (representative.get("text_translated") or representative.get("text_raw", ""))[:300],
            "submission_ids":  [s["id"] for s in cluster_subs],
            "top_submissions": [
                {
                    "id":            s["id"],
                    "text":          (s.get("text_translated") or s.get("text_raw", ""))[:200],
                    "urgency_score": s.get("urgency_score", 0.5),
                }
                for s in top_subs
            ],
        })

    # Sort by size descending
    clusters.sort(key=lambda c: (c["size"], c["avg_urgency"]), reverse=True)
    return clusters


# ─── Cluster label generation ─────────────────────────────────────────────────

_THEME_LABELS = {
    "schools":     "school infrastructure and education access",
    "roads":       "road conditions and transport connectivity",
    "water":       "water supply and sanitation",
    "health":      "healthcare access and facilities",
    "electricity": "electricity supply and power outages",
    "other":       "general development needs",
}


def _generate_cluster_label(theme: str, submissions: list[dict]) -> str:
    """
    Generate a short human-readable label for a cluster.
    Uses keyword analysis on the submission texts.
    """
    base = _THEME_LABELS.get(theme, theme)

    # Count high-frequency words to refine the label
    all_text = " ".join(
        (s.get("text_translated") or s.get("text_raw", "")).lower()
        for s in submissions
    )
    words = all_text.split()

    # Common qualifiers that make labels more specific
    qualifiers = {
        "school":     ["distance", "far", "km", "walk", "building", "roof", "teacher"],
        "roads":      ["pothole", "broken", "repair", "flood", "bridge", "dangerous"],
        "water":      ["irregular", "supply", "pipeline", "shortage", "contaminated"],
        "health":     ["closed", "doctor", "medicine", "emergency", "pregnant"],
        "electricity":["cut", "outage", "hours", "transformer", "streetlight"],
    }

    found = []
    for kw in qualifiers.get(theme, []):
        if all_text.count(kw) >= 2:
            found.append(kw)

    if found:
        return f"{base.title()} ({', '.join(found[:2])})"
    return base.title()


# ─── Keyword-based fallback ───────────────────────────────────────────────────

def _keyword_cluster_fallback(submissions: list[dict]) -> list[dict]:
    """
    Group submissions by their primary theme tag when embeddings are unavailable.
    Each theme becomes one cluster.
    """
    groups: dict[str, list[dict]] = defaultdict(list)
    for s in submissions:
        theme = s.get("themes", ["other"])[0] if s.get("themes") else "other"
        groups[theme].append(s)

    clusters = []
    for idx, (theme, subs) in enumerate(groups.items()):
        avg_urgency = sum(s.get("urgency_score", 0.5) for s in subs) / len(subs)
        top_subs = sorted(subs, key=lambda s: s.get("urgency_score", 0), reverse=True)[:3]
        rep = top_subs[0]

        clusters.append({
            "cluster_id":      idx,
            "label":           _THEME_LABELS.get(theme, theme).title(),
            "theme":           theme,
            "size":            len(subs),
            "avg_urgency":     round(avg_urgency, 4),
            "representative":  (rep.get("text_translated") or rep.get("text_raw", ""))[:300],
            "submission_ids":  [s["id"] for s in subs],
            "top_submissions": [
                {"id": s["id"], "text": (s.get("text_translated") or s.get("text_raw", ""))[:200],
                 "urgency_score": s.get("urgency_score", 0.5)}
                for s in top_subs
            ],
        })

    clusters.sort(key=lambda c: (c["size"], c["avg_urgency"]), reverse=True)
    return clusters


# ─── Ward-level clustering convenience function ───────────────────────────────

def cluster_ward_submissions(
    ward_id: str,
    submissions: list[dict],
    eps: float = 0.35,
) -> dict:
    """
    Cluster all submissions for a single ward and return a summary.

    Returns:
        {
            "ward_id":        "ward-03",
            "total":          47,
            "clusters":       [...],   # sorted by size
            "top_theme":      "schools",
            "top_cluster_size": 12,
        }
    """
    clusters = cluster_submissions(submissions, eps=eps)

    top_theme = clusters[0]["theme"] if clusters else "other"
    top_size  = clusters[0]["size"]  if clusters else 0

    return {
        "ward_id":          ward_id,
        "total":            len(submissions),
        "clusters":         clusters,
        "top_theme":        top_theme,
        "top_cluster_size": top_size,
    }
