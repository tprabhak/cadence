import re
import anthropic
from models.learner import LearnerProfile
from models.plan import Segment
from db.storage import log_api_call

client = anthropic.Anthropic()

_NOTE_RE = re.compile(r'\b(Bb|Eb|Ab|Db|Gb|[A-G][b#]?)\b')


def extract_expected_notes(content: str) -> list[str]:
    """Pull unique note names from coaching content — used for audio feedback comparison."""
    seen, result = set(), []
    for n in _NOTE_RE.findall(content):
        if n not in seen:
            seen.add(n)
            result.append(n)
    return result[:8]


def _format_memory(recent_sessions: list) -> str:
    """Format recent session history for injection into the coaching prompt."""
    if not recent_sessions:
        return ""
    lines = []
    for s in recent_sessions[:3]:
        parts = []
        if s.get("difficulty_rating"):
            parts.append(f"difficulty {s['difficulty_rating']}/10")
        if s.get("quiz_score") is not None:
            parts.append(f"quiz {round(s['quiz_score'] * 100)}%")
        if s.get("stuck_on"):
            parts.append(f"struggled with: \"{s['stuck_on']}\"")
        if parts:
            lines.append(f"- {s.get('date', 'recently')}: {', '.join(parts)}")
    if not lines:
        return ""
    return "\nRecent sessions:\n" + "\n".join(lines)


def generate_segment_content(profile: LearnerProfile, segment: Segment, recent_sessions: list | None = None) -> str:
    """Generate detailed coaching content for a segment. Called once, then stored."""
    days_left = (profile.deadline_date - __import__('datetime').date.today()).days
    memory_block = _format_memory(recent_sessions or [])
    memory_instruction = (
        "\nIMPORTANT: You have the learner's recent session history above. "
        "Reference it naturally — e.g. 'Last time you found X tough, so today we'll approach it differently.' "
        "Do NOT list the history back. Weave 1–2 observations into your coaching voice."
        if memory_block else ""
    )
    prompt = f"""You are Cadence, a tenor saxophone coach. Be specific and direct.

Learner: {profile.name} ({profile.current_level})
Goal: play "{profile.goal_song}" for {profile.goal_event} — {days_left} days away
Today's skill: "{segment.skill}"{memory_block}

Write a practice session that explicitly connects this skill to "{profile.goal_song}".{memory_instruction}
Use this EXACT format (max 140 words total):

**What:** One sentence — what this skill unlocks in "{profile.goal_song}".

**Drill:**
1. [specific action with note names] — [duration/reps]
2. [specific action with note names] — [duration/reps]
3. [specific action with note names] — [duration/reps]

**Done when:** One concrete, testable pass/fail criterion for this song."""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}]
    )
    log_api_call(profile.id, "coaching", "claude-haiku-4-5-20251001",
                 response.usage.input_tokens, response.usage.output_tokens)
    return response.content[0].text.strip()


def get_daily_task(profile: LearnerProfile, segment: Segment, recent_sessions: list | None = None) -> str:
    """Return coaching content. Regenerates with memory context each session; stores result."""
    return generate_segment_content(profile, segment, recent_sessions)
