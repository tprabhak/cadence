import sqlite3
import json
from pathlib import Path
from datetime import date
from typing import Optional

from models.learner import LearnerProfile, ProgressReport
from models.plan import Plan, Segment

DB_PATH = Path(__file__).parent.parent / "cadence.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS learners (
                id TEXT PRIMARY KEY,
                name TEXT,
                instrument TEXT,
                current_level TEXT,
                goal_song TEXT,
                goal_event TEXT,
                deadline_date TEXT,
                minutes_per_day INTEGER,
                available_days TEXT
            );

            CREATE TABLE IF NOT EXISTS plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                learner_id TEXT,
                version INTEGER,
                segments TEXT,
                readiness_estimate REAL,
                last_replan_reason TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS progress_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                learner_id TEXT,
                date TEXT,
                segment_id TEXT,
                did_practice INTEGER,
                minutes INTEGER,
                confidence INTEGER,
                stuck_on TEXT,
                quiz_score REAL,
                pace_status TEXT
            );

            CREATE TABLE IF NOT EXISTS api_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                learner_id TEXT,
                endpoint TEXT,
                model TEXT,
                input_tokens INTEGER,
                output_tokens INTEGER,
                cost_usd REAL,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS replan_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                learner_id TEXT,
                reason TEXT,
                old_segment_count INTEGER,
                new_segment_count INTEGER,
                plan_version INTEGER,
                seen INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            );
        """)
        # Migrate: add difficulty_rating column if it doesn't exist yet
        try:
            conn.execute("ALTER TABLE progress_logs ADD COLUMN difficulty_rating INTEGER")
        except Exception:
            pass  # column already exists


def save_learner(profile: LearnerProfile):
    with get_conn() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO learners VALUES (?,?,?,?,?,?,?,?,?)
        """, (
            profile.id, profile.name, profile.instrument, profile.current_level,
            profile.goal_song, profile.goal_event, str(profile.deadline_date),
            profile.minutes_per_day, json.dumps(profile.available_days)
        ))


def load_learner(learner_id: str) -> Optional[LearnerProfile]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM learners WHERE id=?", (learner_id,)).fetchone()
    if not row:
        return None
    return LearnerProfile(
        id=row["id"], name=row["name"], instrument=row["instrument"],
        current_level=row["current_level"], goal_song=row["goal_song"],
        goal_event=row["goal_event"], deadline_date=date.fromisoformat(row["deadline_date"]),
        minutes_per_day=row["minutes_per_day"],
        available_days=json.loads(row["available_days"])
    )


def save_plan(plan: Plan):
    segments_json = json.dumps([s.__dict__ for s in plan.segments])
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO plans (learner_id, version, segments, readiness_estimate, last_replan_reason)
            VALUES (?,?,?,?,?)
        """, (plan.learner_id, plan.version, segments_json,
              plan.readiness_estimate, plan.last_replan_reason))


def load_latest_plan(learner_id: str) -> Optional[Plan]:
    with get_conn() as conn:
        row = conn.execute("""
            SELECT * FROM plans WHERE learner_id=? ORDER BY id DESC LIMIT 1
        """, (learner_id,)).fetchone()
    if not row:
        return None
    segments = [Segment(**s) for s in json.loads(row["segments"])]
    return Plan(
        version=row["version"], learner_id=row["learner_id"],
        segments=segments, readiness_estimate=row["readiness_estimate"],
        last_replan_reason=row["last_replan_reason"]
    )


def save_progress(learner_id: str, report: ProgressReport):
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO progress_logs
            (learner_id, date, segment_id, did_practice, minutes, confidence, stuck_on, quiz_score, pace_status, difficulty_rating)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """, (
            learner_id, str(report.date), report.segment_id, int(report.did_practice),
            report.minutes, report.confidence, report.stuck_on,
            report.quiz_score, report.pace_status, report.difficulty_rating,
        ))


def load_progress(learner_id: str) -> list[ProgressReport]:
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT * FROM progress_logs WHERE learner_id=? ORDER BY date DESC LIMIT 14
        """, (learner_id,)).fetchall()
    return [ProgressReport(
        date=r["date"], segment_id=r["segment_id"], did_practice=bool(r["did_practice"]),
        minutes=r["minutes"], confidence=r["confidence"], stuck_on=r["stuck_on"],
        quiz_score=r["quiz_score"], pace_status=r["pace_status"]
    ) for r in rows]


# Token costs per million (USD)
_COSTS = {
    "claude-sonnet-4-6":        {"input": 3.00,  "output": 15.00},
    "claude-haiku-4-5-20251001": {"input": 0.80,  "output": 4.00},
}

def log_api_call(learner_id: str, endpoint: str, model: str, input_tokens: int, output_tokens: int):
    rates = _COSTS.get(model, {"input": 3.00, "output": 15.00})
    cost  = (input_tokens * rates["input"] + output_tokens * rates["output"]) / 1_000_000
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO api_usage (learner_id, endpoint, model, input_tokens, output_tokens, cost_usd)
            VALUES (?,?,?,?,?,?)
        """, (learner_id, endpoint, model, input_tokens, output_tokens, round(cost, 6)))


def get_api_metrics() -> dict:
    with get_conn() as conn:
        total = conn.execute("""
            SELECT COUNT(*) as calls, SUM(input_tokens) as inp, SUM(output_tokens) as out,
                   SUM(cost_usd) as cost FROM api_usage
        """).fetchone()
        by_endpoint = conn.execute("""
            SELECT endpoint, COUNT(*) as calls, SUM(cost_usd) as cost
            FROM api_usage GROUP BY endpoint ORDER BY cost DESC
        """).fetchall()
        by_model = conn.execute("""
            SELECT model, COUNT(*) as calls, SUM(cost_usd) as cost
            FROM api_usage GROUP BY model
        """).fetchall()
        daily = conn.execute("""
            SELECT date(created_at) as day, COUNT(*) as calls, SUM(cost_usd) as cost
            FROM api_usage GROUP BY day ORDER BY day DESC LIMIT 14
        """).fetchall()
        quiz_avg = conn.execute("""
            SELECT AVG(quiz_score) as avg_score, COUNT(*) as sessions
            FROM progress_logs WHERE quiz_score IS NOT NULL
        """).fetchone()
    return {
        "total_calls": total["calls"] or 0,
        "total_input_tokens": total["inp"] or 0,
        "total_output_tokens": total["out"] or 0,
        "total_cost_usd": round(total["cost"] or 0, 4),
        "by_endpoint": [dict(r) for r in by_endpoint],
        "by_model": [dict(r) for r in by_model],
        "daily": [dict(r) for r in daily],
        "quiz_avg_score": round((quiz_avg["avg_score"] or 0) * 100, 1),
        "quiz_sessions": quiz_avg["sessions"] or 0,
    }


def log_replan_event(learner_id: str, reason: str, old_count: int, new_count: int, plan_version: int):
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO replan_events (learner_id, reason, old_segment_count, new_segment_count, plan_version)
            VALUES (?,?,?,?,?)
        """, (learner_id, reason, old_count, new_count, plan_version))


def get_latest_unseen_replan(learner_id: str) -> Optional[dict]:
    with get_conn() as conn:
        row = conn.execute("""
            SELECT * FROM replan_events WHERE learner_id=? AND seen=0
            ORDER BY id DESC LIMIT 1
        """, (learner_id,)).fetchone()
        if row:
            conn.execute("UPDATE replan_events SET seen=1 WHERE id=?", (row["id"],))
    return dict(row) if row else None


def get_replan_history(learner_id: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT * FROM replan_events WHERE learner_id=? ORDER BY id DESC LIMIT 10
        """, (learner_id,)).fetchall()
    return [dict(r) for r in rows]


def get_practice_history(learner_id: str, limit: int = 30) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT date, segment_id, did_practice, minutes, confidence, stuck_on, quiz_score, pace_status, difficulty_rating
            FROM progress_logs
            WHERE learner_id=?
            ORDER BY date DESC LIMIT ?
        """, (learner_id, limit)).fetchall()
    return [dict(r) for r in rows]


def get_weekly_activity(learner_id: str, days: int = 28) -> list[str]:
    """Returns ISO date strings where practice occurred in the last N days."""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT DISTINCT date(date) as d FROM progress_logs
            WHERE learner_id=? AND did_practice=1
            AND date(date) >= date('now', ?)
            ORDER BY d DESC
        """, (learner_id, f"-{days} days")).fetchall()
    return [r["d"] for r in rows]


def get_streak(learner_id: str) -> int:
    from datetime import timedelta
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT DISTINCT date(date) as d FROM progress_logs
            WHERE learner_id=? AND did_practice=1
            ORDER BY d DESC
        """, (learner_id,)).fetchall()
    if not rows:
        return 0
    practiced = {r["d"] for r in rows}
    streak = 0
    check = date.today()
    if str(check) not in practiced:
        check = check - timedelta(days=1)
    while str(check) in practiced:
        streak += 1
        check -= timedelta(days=1)
    return streak
