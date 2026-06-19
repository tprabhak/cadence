import uuid
import os
import time
from datetime import date
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Depends, Security, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field, field_validator
from dotenv import load_dotenv

load_dotenv()

from db.storage import (
    init_db, save_learner, load_learner, save_plan, load_latest_plan, get_streak,
    get_api_metrics, get_latest_unseen_replan, get_replan_history,
    get_practice_history, get_weekly_activity,
)
from models.learner import LearnerProfile
from agent.planner import build_plan
from agent.loop import run_session, log_progress
from agent.assessor import generate_quiz, grade_quiz, get_or_generate_quiz
from agent.coach import extract_expected_notes

app = FastAPI(title="Cadence API")

# Spotify token cache — access tokens last 3600s
_spotify_cache: dict = {}

async def _get_spotify_token() -> str:
    client_id     = os.getenv("SPOTIFY_CLIENT_ID", "")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        return ""
    if _spotify_cache.get("expires_at", 0) > time.time() + 60:
        return _spotify_cache.get("token", "")
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://accounts.spotify.com/api/token",
            data={"grant_type": "client_credentials"},
            auth=(client_id, client_secret),
        )
    data = r.json()
    _spotify_cache["token"]      = data.get("access_token", "")
    _spotify_cache["expires_at"] = time.time() + data.get("expires_in", 3600)
    return _spotify_cache["token"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Admin endpoints require a secret token — set ADMIN_SECRET in .env
_admin_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)

async def require_admin(key: str = Security(_admin_key_header)):
    secret = os.getenv("ADMIN_SECRET", "")
    if not secret or key != secret:
        raise HTTPException(status_code=403, detail="Forbidden")


def _seed_demo_account():
    """Create a pre-seeded demo account on every startup — no LLM calls, hardcoded plan."""
    from datetime import timedelta
    from db.storage import get_conn
    from models.plan import Plan, Segment

    today = date.today()

    # Wipe and recreate demo data so it's always fresh
    with get_conn() as conn:
        conn.execute("DELETE FROM progress_logs WHERE learner_id='demo'")
        conn.execute("DELETE FROM plans WHERE learner_id='demo'")
        conn.execute("DELETE FROM learners WHERE id='demo'")

    profile = LearnerProfile(
        id="demo",
        name="Alex",
        instrument="tenor saxophone",
        current_level="beginner",
        goal_song="Fly Me to the Moon",
        goal_event="end of year recital",
        deadline_date=today + timedelta(days=56),
        minutes_per_day=20,
        available_days=["Monday", "Wednesday", "Friday"],
    )
    save_learner(profile)

    segments = [
        Segment(id="demo-seg-01", skill="Long tones — B, A, G (building tone and breath support)",
                target_date=str(today - timedelta(days=21)), status="complete", confidence=4,
                resource_link=None, content=None),
        Segment(id="demo-seg-02", skill="Opening phrase of Fly Me to the Moon — F A G notes",
                target_date=str(today - timedelta(days=14)), status="complete", confidence=4,
                resource_link=None, content=None),
        Segment(id="demo-seg-03", skill="Left hand register — E, D, C, Bb fingerings",
                target_date=str(today - timedelta(days=7)), status="complete", confidence=4,
                resource_link=None, content=None),
        Segment(id="demo-seg-04", skill="Verse melody — first 8 bars of Fly Me to the Moon",
                target_date=str(today + timedelta(days=7)), status="in_progress", confidence=0,
                resource_link=None, content=None),
        Segment(id="demo-seg-05", skill="E to F# transition — smooth fingering under tempo",
                target_date=str(today + timedelta(days=12)), status="not_started", confidence=0,
                resource_link=None, content=None),
        Segment(id="demo-seg-06", skill="Breath support — sustaining full phrases",
                target_date=str(today + timedelta(days=21)), status="not_started", confidence=0,
                resource_link=None, content=None),
        Segment(id="demo-seg-07", skill="Bridge section — C major scale pattern",
                target_date=str(today + timedelta(days=28)), status="not_started", confidence=0,
                resource_link=None, content=None),
        Segment(id="demo-seg-08", skill="Articulation and tonguing — clean note attacks",
                target_date=str(today + timedelta(days=35)), status="not_started", confidence=0,
                resource_link=None, content=None),
        Segment(id="demo-seg-09", skill="Full verse at half tempo — consistent intonation",
                target_date=str(today + timedelta(days=42)), status="not_started", confidence=0,
                resource_link=None, content=None),
        Segment(id="demo-seg-10", skill="Full song performance run-through",
                target_date=str(today + timedelta(days=49)), status="not_started", confidence=0,
                resource_link=None, content=None),
    ]

    plan = Plan(
        version=2,
        learner_id="demo",
        segments=segments,
        readiness_estimate=0.34,
        last_replan_reason="Added E to F# transition segment after difficulty ratings showed consistent struggle with that interval",
    )
    save_plan(plan)

    # Seed 7 days of realistic history
    entries = [
        (7, 3, 0.33, "behind",   8, "E to F# transition — fingers feel slow and the note cuts out", "demo-seg-01"),
        (6, 3, 0.67, "behind",   7, "timing on the bridge, keep rushing the dotted rhythm",         "demo-seg-02"),
        (5, 4, 0.67, "on_track", 6, "breath support runs out before the phrase ends",               "demo-seg-02"),
        (4, 4, 1.00, "on_track", 5, None,                                                           "demo-seg-03"),
        (3, 4, 0.67, "on_track", 6, "E fingering still inconsistent when playing up to tempo",      "demo-seg-03"),
        (2, 5, 1.00, "on_track", 4, None,                                                           "demo-seg-03"),
        (1, 5, 1.00, "on_track", 3, None,                                                           "demo-seg-04"),
    ]
    from datetime import timedelta as td
    from db.storage import get_conn
    with get_conn() as conn:
        for days_ago, conf, quiz, pace, diff, stuck, seg_id in entries:
            d = today - td(days=days_ago)
            conn.execute("""
                INSERT INTO progress_logs
                (learner_id, date, segment_id, did_practice, minutes, confidence, stuck_on, quiz_score, pace_status, difficulty_rating)
                VALUES (?,?,?,1,20,?,?,?,?,?)
            """, ("demo", str(d), seg_id, conf, stuck, quiz, pace, diff))


@app.on_event("startup")
def startup():
    init_db()
    _seed_demo_account()


# --- Request/Response schemas ---

VALID_LEVELS = {"complete_beginner", "advanced_beginner", "intermediate", "advanced", "beginner"}
VALID_DAYS   = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}

class OnboardRequest(BaseModel):
    name:            str = Field(min_length=1, max_length=100)
    current_level:   str = Field(min_length=1, max_length=50)
    goal_song:       str = Field(min_length=1, max_length=200)
    goal_event:      str = Field(min_length=1, max_length=200)
    deadline_date:   str = Field(min_length=10, max_length=10)
    minutes_per_day: int = Field(ge=5, le=480)
    available_days:  list[str] = Field(min_length=1, max_length=7)

    @field_validator("current_level")
    @classmethod
    def validate_level(cls, v: str) -> str:
        if v not in VALID_LEVELS:
            raise ValueError(f"current_level must be one of {VALID_LEVELS}")
        return v

    @field_validator("available_days")
    @classmethod
    def validate_days(cls, v: list[str]) -> list[str]:
        invalid = [d for d in v if d not in VALID_DAYS]
        if invalid:
            raise ValueError(f"Invalid days: {invalid}")
        return v

    @field_validator("deadline_date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        try:
            d = date.fromisoformat(v)
        except ValueError:
            raise ValueError("deadline_date must be YYYY-MM-DD")
        if d <= date.today():
            raise ValueError("deadline_date must be in the future")
        return v


class ProgressRequest(BaseModel):
    learner_id:       str = Field(min_length=1, max_length=50)
    segment_id:       str = Field(min_length=1, max_length=50)
    did_practice:     bool
    minutes:          int = Field(ge=0, le=480)
    confidence:       int = Field(ge=1, le=5)
    difficulty_rating: Optional[int] = Field(default=None, ge=1, le=10)
    stuck_on:         Optional[str] = Field(default=None, max_length=500)
    quiz_answers:     Optional[list[str]] = Field(default=None, max_length=10)


# --- Routes ---

@app.get("/demo-login")
async def demo_login():
    """Return the demo learner ID — used by the Try Demo button."""
    return {"learner_id": "demo"}


@app.post("/onboard")
async def onboard(req: OnboardRequest):
    learner_id = str(uuid.uuid4())[:8]
    profile = LearnerProfile(
        id=learner_id,
        name=req.name,
        instrument="tenor saxophone",
        current_level=req.current_level,
        goal_song=req.goal_song,
        goal_event=req.goal_event,
        deadline_date=date.fromisoformat(req.deadline_date),
        minutes_per_day=req.minutes_per_day,
        available_days=req.available_days,
    )
    save_learner(profile)

    plan = build_plan(profile)
    save_plan(plan)

    return {"learner_id": learner_id, "plan": plan.__dict__}


@app.get("/session/{learner_id}")
async def session(learner_id: str):
    profile = load_learner(learner_id)
    plan = load_latest_plan(learner_id)
    if not profile or not plan:
        raise HTTPException(status_code=404, detail="Learner not found")

    result = await run_session(profile, plan)
    save_plan(plan)
    result["goal_song"] = profile.goal_song
    return result


@app.post("/progress")
async def progress(req: ProgressRequest):
    profile = load_learner(req.learner_id)
    plan = load_latest_plan(req.learner_id)
    if not profile or not plan:
        raise HTTPException(status_code=404, detail="Learner not found")

    result = await log_progress(
        profile, plan, req.segment_id, req.did_practice,
        req.minutes, req.confidence, req.stuck_on, req.quiz_answers,
        req.difficulty_rating,
    )
    save_plan(plan)
    return result


@app.get("/status/{learner_id}")
async def status(learner_id: str):
    profile = load_learner(learner_id)
    plan = load_latest_plan(learner_id)
    if not profile or not plan:
        raise HTTPException(status_code=404, detail="Learner not found")

    from tools.pace import check_pace
    pace = check_pace(plan, profile.deadline_date)
    streak = get_streak(learner_id)
    unseen_replan = get_latest_unseen_replan(learner_id)
    week_activity = get_weekly_activity(learner_id, days=28)
    return {
        "learner": profile.__dict__,
        "pace": pace,
        "segments": [s.__dict__ for s in plan.segments],
        "plan_version": plan.version,
        "streak": streak,
        "hearts": 5,
        "unseen_replan": unseen_replan,
        "week_activity": week_activity,
    }


@app.get("/quiz/{learner_id}/{segment_id}")
async def get_quiz(learner_id: str, segment_id: str):
    profile = load_learner(learner_id)
    plan    = load_latest_plan(learner_id)
    if not profile or not plan:
        raise HTTPException(status_code=404, detail="Learner not found")
    segment = next((s for s in plan.segments if s.id == segment_id), None)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    # Use cached questions if available — generates once, reused on review
    questions = get_or_generate_quiz(profile, segment)
    save_plan(plan)  # persist cached quiz back to DB
    return questions


class GradeRequest(BaseModel):
    learner_id: str
    segment_id: str
    answers: list[str]

@app.post("/quiz/grade")
async def grade(req: GradeRequest):
    profile = load_learner(req.learner_id)
    plan = load_latest_plan(req.learner_id)
    if not profile or not plan:
        raise HTTPException(status_code=404, detail="Learner not found")
    segment = next((s for s in plan.segments if s.id == req.segment_id), None)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    questions = generate_quiz(profile, segment.skill)
    score = grade_quiz(questions, req.answers)
    return {"score": score}


class AudioFeedbackRequest(BaseModel):
    learner_id:      str = Field(min_length=1, max_length=50)
    segment_skill:   str = Field(min_length=1, max_length=300)
    detected_notes:  list[str] = Field(max_length=500)
    coaching_content: str = Field(min_length=1, max_length=2000)

@app.post("/audio-feedback")
async def audio_feedback(req: AudioFeedbackRequest):
    from collections import Counter
    import anthropic as _ant
    profile = load_learner(req.learner_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Learner not found")

    note_counts      = Counter(req.detected_notes)
    notes_str        = ", ".join(f"{n} ({c}×)" for n, c in note_counts.most_common(8)) if note_counts else "nothing detected"
    nothing_detected = not note_counts
    expected_notes   = extract_expected_notes(req.coaching_content)
    expected_str     = ", ".join(expected_notes) if expected_notes else "not specified"

    client = _ant.Anthropic()

    if nothing_detected:
        quality = "needs_work"
        instruction = (
            "IMPORTANT: The microphone picked up nothing. Do NOT invent hearing something. "
            "Acknowledge nothing was detected, give one likely cause (mic too far, didn't play loud enough, "
            "or browser mic permission), tell them exactly what to try. Friendly, under 50 words."
        )
    else:
        quality = None  # determined from AI response
        instruction = (
            f"Expected notes for this drill: {expected_str}\n"
            f"Notes actually detected: {notes_str}\n\n"
            "First line: write only GOOD or NEEDS_WORK.\n"
            "  GOOD = most expected notes were clearly detected.\n"
            "  NEEDS_WORK = key notes were missing or unclear.\n\n"
            "Then 2-3 sentences of honest feedback:\n"
            "- Name which expected notes were played correctly\n"
            "- Name specifically which were missing or wrong, and give one concrete fix\n"
            "- End with the single most important thing to focus on next\n"
            "Do not praise notes that weren't in the expected set."
        )

    prompt = f"""You are Cadence, a tenor saxophone coach giving feedback after hearing a student play.

Drill they just did:
{req.coaching_content}

{instruction}

Max 70 words. No bullet points — natural coaching voice."""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}]
    )
    from db.storage import log_api_call
    log_api_call(req.learner_id, "audio_feedback", "claude-haiku-4-5-20251001",
                 response.usage.input_tokens, response.usage.output_tokens)

    raw = response.content[0].text.strip()
    if quality is None:
        first_line = raw.split("\n")[0].strip().upper()
        if first_line == "GOOD":
            quality = "good"
            raw = raw[len("GOOD"):].strip().lstrip("\n").strip()
        else:
            quality = "needs_work"
            raw = raw[len("NEEDS_WORK"):].strip().lstrip("\n").strip() if raw.upper().startswith("NEEDS_WORK") else raw

    return {"feedback": raw, "quality": quality}


@app.get("/admin/metrics", dependencies=[Depends(require_admin)])
def admin_metrics():
    return get_api_metrics()


@app.get("/admin/replans/{learner_id}", dependencies=[Depends(require_admin)])
def admin_replans(learner_id: str):
    return get_replan_history(learner_id)


@app.get("/search-songs")
async def search_songs_endpoint(q: str = Query(default="", max_length=200)):
    token = await _get_spotify_token()
    if not token or not q.strip():
        return {"tracks": []}
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://api.spotify.com/v1/search",
            params={"q": q, "type": "track", "limit": 8, "market": "US"},
            headers={"Authorization": f"Bearer {token}"},
        )
    items = r.json().get("tracks", {}).get("items", [])
    tracks = [
        {
            "id": t["id"],
            "name": t["name"],
            "artist": t["artists"][0]["name"] if t["artists"] else "",
            "album_art": (
                t["album"]["images"][1]["url"] if len(t["album"]["images"]) > 1
                else t["album"]["images"][0]["url"] if t["album"]["images"]
                else None
            ),
        }
        for t in items if t.get("id")
    ]
    return {"tracks": tracks}


@app.get("/history/{learner_id}")
async def practice_history(learner_id: str):
    profile = load_learner(learner_id)
    plan    = load_latest_plan(learner_id)
    if not profile or not plan:
        raise HTTPException(status_code=404, detail="Learner not found")

    logs    = get_practice_history(learner_id)
    seg_map = {s.id: s.skill for s in plan.segments}
    for log in logs:
        log["skill"] = seg_map.get(log["segment_id"], "Practice session")

    completed = len([s for s in plan.segments if s.status == "complete"])
    from tools.pace import check_pace
    pace = check_pace(plan, profile.deadline_date)

    return {
        "logs": logs,
        "streak": get_streak(learner_id),
        "week_activity": get_weekly_activity(learner_id, days=28),
        "completed": completed,
        "total": len(plan.segments),
        "readiness": plan.readiness_estimate,
        "goal_song": profile.goal_song,
        "goal_event": profile.goal_event,
        "days_left": (profile.deadline_date - date.today()).days,
    }


@app.post("/admin/seed-demo-history/{learner_id}", dependencies=[Depends(require_admin)])
async def seed_demo_history(learner_id: str):
    """Insert realistic 7-day practice history for demo recording."""
    from datetime import timedelta
    from db.storage import get_conn
    profile = load_learner(learner_id)
    plan    = load_latest_plan(learner_id)
    if not profile or not plan:
        raise HTTPException(status_code=404, detail="Learner not found")

    # (days_ago, confidence, quiz_score, pace_status, difficulty_rating, stuck_on)
    entries = [
        (7, 3, 0.33, "behind",   8, "E to F# transition — fingers feel slow and the note cuts out"),
        (6, 3, 0.67, "behind",   7, "timing on the bridge section, keep rushing the rest"),
        (5, 4, 0.67, "on_track", 6, "breath support runs out before the phrase ends"),
        (4, 4, 1.00, "on_track", 5, None),
        (3, 4, 0.67, "on_track", 6, "E fingering still inconsistent under tempo"),
        (2, 5, 1.00, "on_track", 4, None),
        (1, 5, 1.00, "on_track", 3, None),
    ]
    with get_conn() as conn:
        for days_ago, conf, quiz, pace, diff, stuck in entries:
            d   = date.today() - timedelta(days=days_ago)
            idx = min(7 - days_ago, len(plan.segments) - 1)
            seg = plan.segments[idx]
            conn.execute("""
                INSERT OR IGNORE INTO progress_logs
                (learner_id, date, segment_id, did_practice, minutes, confidence, stuck_on, quiz_score, pace_status, difficulty_rating)
                VALUES (?,?,?,1,15,?,?,?,?,?)
            """, (learner_id, str(d), seg.id, conf, stuck, quiz, pace, diff))
    return {"seeded": True, "entries": len(entries)}


@app.get("/health")
def health():
    return {"status": "ok"}
