from datetime import date

from models.learner import LearnerProfile, ProgressReport
from models.plan import Plan, Segment
from agent.coach import get_daily_task, generate_segment_content
from agent.assessor import generate_quiz, grade_quiz
from agent.replanner import should_replan, replan
from tools.pace import check_pace
from tools.search import search_resources
from db.storage import save_plan, save_progress, load_progress, get_practice_history


async def run_session(profile: LearnerProfile, plan: Plan) -> dict:
    """
    One full agent loop iteration:
    coach → observe → assess → pace check → replan if needed → return state
    """
    current_segment = next(
        (s for s in plan.segments if s.status in ("not_started", "in_progress")),
        None
    )

    if not current_segment:
        return {"status": "complete", "message": "All segments complete! You're ready."}

    current_segment.status = "in_progress"

    # Load recent history for AI memory context
    recent_sessions = get_practice_history(profile.id, limit=3)

    # Always regenerate coaching with fresh memory — stored content gets stale
    coaching = get_daily_task(profile, current_segment, recent_sessions)
    current_segment.content = coaching

    # Fetch a real resource if not already stored
    if not current_segment.resource_link:
        query = f"tenor saxophone tutorial {current_segment.skill} {profile.goal_song} {profile.current_level}"
        results = await search_resources(query)
        if results and results[0]["url"]:
            current_segment.resource_link = results[0]["url"]

    # Pace check (free — pure code)
    pace = check_pace(plan, profile.deadline_date)

    # Recent confidence scores for replan trigger
    recent_logs = load_progress(profile.id)
    recent_confidence = [r.confidence for r in recent_logs[:5] if r.confidence > 0]

    # Decide if replan is needed
    needs_replan, reason = should_replan(pace, recent_confidence)
    replanned = False
    if needs_replan:
        plan = replan(profile, plan, pace, reason)
        save_plan(plan)
        replanned = True

    return {
        "status": "active",
        "current_segment": current_segment.__dict__,
        "coaching": coaching,
        "pace": pace,
        "replanned": replanned,
        "replan_reason": reason if replanned else None,
        "plan_version": plan.version,
    }


async def log_progress(
    profile: LearnerProfile,
    plan: Plan,
    segment_id: str,
    did_practice: bool,
    minutes: int,
    confidence: int,
    stuck_on: str | None,
    quiz_answers: list[str] | None,
    difficulty_rating: int | None = None,
) -> dict:
    """Record a practice session and return updated pace."""
    segment = next((s for s in plan.segments if s.id == segment_id), None)

    quiz_score = None
    if quiz_answers and segment:
        questions = generate_quiz(profile, segment.skill)
        quiz_score = grade_quiz(questions, quiz_answers)

    if confidence >= 4 and segment:
        segment.status = "complete"
        segment.confidence = confidence

    pace = check_pace(plan, profile.deadline_date)

    report = ProgressReport(
        date=str(date.today()),
        segment_id=segment_id,
        did_practice=did_practice,
        minutes=minutes,
        confidence=confidence,
        stuck_on=stuck_on,
        quiz_score=quiz_score,
        pace_status=pace["pace_status"],
        difficulty_rating=difficulty_rating,
    )
    save_progress(profile.id, report)

    return {"pace": pace, "quiz_score": quiz_score}
