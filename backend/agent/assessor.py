import json
import anthropic
from models.learner import LearnerProfile, ProgressReport
from db.storage import log_api_call

client = anthropic.Anthropic()


def generate_quiz(profile: LearnerProfile, topic: str) -> list[dict]:
    """Generate 3 quiz questions. Always generates fresh — use get_or_generate_quiz to cache."""
    prompt = f"""Generate 3 tenor saxophone quiz questions directly about this skill: {topic}
For a {profile.current_level} player learning "{profile.goal_song}".
Questions must be answerable from practicing this specific skill — not general theory.

Return ONLY JSON:
[
  {{
    "question": "...",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "answer": "A"
  }}
]"""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}]
    )
    log_api_call(profile.id, "quiz_generate", "claude-haiku-4-5-20251001",
                 response.usage.input_tokens, response.usage.output_tokens)
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def get_or_generate_quiz(profile: LearnerProfile, segment) -> list[dict]:
    """Return cached quiz if available, otherwise generate and cache on the segment."""
    if segment.quiz:
        return segment.quiz
    questions = generate_quiz(profile, segment.skill)
    segment.quiz = questions
    return questions


def grade_quiz(questions: list[dict], answers: list[str]) -> float:
    """Grade a quiz. Returns score 0.0-1.0."""
    if not questions:
        return 0.0
    correct = sum(
        1 for q, a in zip(questions, answers)
        if a.upper() == q["answer"].upper()
    )
    return correct / len(questions)
