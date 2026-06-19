import json
from datetime import date, timedelta
import anthropic

from models.learner import LearnerProfile
from models.plan import Plan, Segment
from db.storage import log_api_call

client = anthropic.Anthropic()

_DAY_MAP = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
            "Friday": 4, "Saturday": 5, "Sunday": 6}


def _fix_dates_to_available_days(segments: list[Segment], available_days: list[str], deadline: date) -> list[Segment]:
    """Redistribute segment target_dates so every date falls on an actual practice day."""
    practice_weekdays = {_DAY_MAP[d] for d in available_days if d in _DAY_MAP}
    not_started = [s for s in segments if s.status == "not_started"]
    if not not_started or not practice_weekdays:
        return segments

    # Collect every valid practice date between tomorrow and deadline
    valid_dates: list[date] = []
    cur = date.today() + timedelta(days=1)
    while cur <= deadline:
        if cur.weekday() in practice_weekdays:
            valid_dates.append(cur)
        cur += timedelta(days=1)

    if len(valid_dates) < len(not_started):
        # Deadline too tight — spread as evenly as possible anyway
        valid_dates = valid_dates or [deadline]

    # Spread segments evenly across valid dates
    n = len(not_started)
    for i, seg in enumerate(not_started):
        idx = min(int(i * len(valid_dates) / n), len(valid_dates) - 1)
        seg.target_date = str(valid_dates[idx])

    return segments


def build_plan(profile: LearnerProfile) -> Plan:
    """Generate a personalized learning path for the learner."""
    prompt = f"""You are Cadence, a tenor saxophone practice coach.

{profile.name} wants to play "{profile.goal_song}" on tenor saxophone for {profile.goal_event}.
- Current level: {profile.current_level}
- Deadline: {profile.deadline_date} ({(profile.deadline_date - date.today()).days} days from today)
- Practice: {profile.minutes_per_day} min/day on {', '.join(profile.available_days)}

Create a realistic, ordered skill-by-skill path to play "{profile.goal_song}" by the deadline.
Each segment must be a specific, focused skill chunk that directly builds toward THIS song.
Name each skill in terms of the song itself (e.g. "Learn the opening Bb-C-D-Eb phrase note by note").

Return ONLY a JSON array of segments, no explanation:
[
  {{
    "id": "seg_1",
    "skill": "description of skill tied to the song",
    "target_date": "YYYY-MM-DD",
    "status": "not_started",
    "confidence": 0,
    "resource_link": null,
    "content": null
  }}
]

Max 10 segments. Be realistic — fewer focused segments beat many vague ones."""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}]
    )
    log_api_call(profile.id, "build_plan", "claude-sonnet-4-6",
                 response.usage.input_tokens, response.usage.output_tokens)

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    segments_data = json.loads(raw.strip())

    segments = [Segment(**s) for s in segments_data]

    # Guarantee dates land on actual practice days
    segments = _fix_dates_to_available_days(segments, profile.available_days, profile.deadline_date)

    # Pre-generate content for first 2 segments — eliminates first-lesson load wait
    from agent.coach import generate_segment_content
    for seg in segments[:2]:
        if not seg.content:
            seg.content = generate_segment_content(profile, seg)

    return Plan(version=1, learner_id=profile.id, segments=segments,
                readiness_estimate=0.0, last_replan_reason=None)
