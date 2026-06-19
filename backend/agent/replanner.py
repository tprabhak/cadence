import json
import anthropic
from datetime import date

from models.learner import LearnerProfile
from models.plan import Plan, Segment
from db.storage import log_api_call, log_replan_event

client = anthropic.Anthropic()


def should_replan(pace: dict, recent_confidence: list[int]) -> tuple[bool, str]:
    """Pure code check — decides if an LLM replan is needed."""
    if pace["pace_status"] == "behind":
        return True, "behind_pace"
    # Need at least 2 real data points before triggering confidence-based replan
    if len(recent_confidence) >= 2:
        avg_confidence = sum(recent_confidence) / len(recent_confidence)
        if avg_confidence < 2.5:
            return True, "low_confidence"
    # Only replan ahead after 3+ sessions — avoids false trigger on day one
    if pace["pace_status"] == "ahead" and len(recent_confidence) >= 3:
        return True, "ahead_of_pace"
    return False, ""


def replan(profile: LearnerProfile, plan: Plan, pace: dict, reason: str) -> Plan:
    """LLM replan — only fires when the code says it's needed."""
    segments_summary = [
        {"id": s.id, "skill": s.skill, "status": s.status, "confidence": s.confidence,
         "target_date": s.target_date}
        for s in plan.segments
    ]

    prompt = f"""You are Cadence, a tenor saxophone practice coach.

Learner: {profile.name}, level: {profile.current_level}
Goal: play "{profile.goal_song}" for {profile.goal_event} by {profile.deadline_date}
Days left: {pace['days_left']}
Situation: {reason.replace('_', ' ')}

Current plan:
{json.dumps(segments_summary, indent=2)}

Replan: adjust segment order, dates, or scope to keep the learner on track for their deadline.
- If behind: compress by cutting lower-priority segments or merging sections
- If ahead: add challenge (harder version, add bridge, full tempo)
- If low confidence: insert remediation drills before moving on

Return ONLY a JSON array of segments using the same format (keep completed segments as-is):
[{{"id": "...", "skill": "...", "target_date": "YYYY-MM-DD", "status": "...", "confidence": 0, "resource_link": null, "content": null}}]"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}]
    )

    log_api_call(profile.id, "replan", "claude-sonnet-4-6",
                 response.usage.input_tokens, response.usage.output_tokens)

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    segments_data = json.loads(raw.strip())

    new_segments = []
    for s_data in segments_data:
        existing = next((s for s in plan.segments if s.id == s_data["id"]), None)
        if existing and existing.status == "complete":
            new_segments.append(existing)
        else:
            new_segments.append(Segment(**s_data))

    readiness = sum(1 for s in new_segments if s.confidence >= 4) / len(new_segments)
    new_version = plan.version + 1

    log_replan_event(profile.id, reason, len(plan.segments), len(new_segments), new_version)

    return Plan(
        version=new_version,
        learner_id=profile.id,
        segments=new_segments,
        readiness_estimate=round(readiness, 2),
        last_replan_reason=reason
    )
