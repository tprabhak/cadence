from datetime import date
from models.plan import Plan


def check_pace(plan: Plan, deadline: date) -> dict:
    """Pure code — no LLM call. Detects if learner is off pace."""
    total = len(plan.segments)
    completed = sum(1 for s in plan.segments if s.status == "complete")
    high_confidence = sum(1 for s in plan.segments if s.confidence >= 4)

    days_left = (deadline - date.today()).days
    total_days = max(days_left, 1)
    segments_left = total - completed

    readiness = high_confidence / total if total > 0 else 0.0

    if days_left <= 0:
        pace_status = "deadline_reached"
    elif segments_left == 0:
        pace_status = "ahead"
    else:
        days_per_segment_needed = total_days / segments_left
        days_per_segment_planned = total_days / total if total > 0 else 1
        ratio = days_per_segment_needed / days_per_segment_planned

        if ratio < 0.8:
            pace_status = "ahead"
        elif ratio > 1.3:
            pace_status = "behind"
        else:
            pace_status = "on_track"

    return {
        "pace_status": pace_status,
        "days_left": days_left,
        "segments_completed": completed,
        "segments_total": total,
        "readiness_estimate": round(readiness, 2),
    }
