#!/usr/bin/env python3
"""
Cadence Eval Harness
Run from /backend:  python -m eval.run_eval
Scores plan quality, coaching quality, and quiz quality across 5 test profiles.
"""
import sys
import json
import asyncio
from datetime import date, timedelta
from pathlib import Path

# Add backend root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load .env from repo root
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from models.learner import LearnerProfile
from models.plan import Plan
from agent.planner import build_plan
from agent.coach import generate_segment_content
from agent.assessor import generate_quiz

# ── Test profiles ──────────────────────────────────────────────────────────────

PROFILES = [
    LearnerProfile(
        id="eval_01", name="Alice", instrument="saxophone",
        current_level="complete_beginner",
        goal_song="Girl from Ipanema", goal_event="wedding",
        deadline_date=date.today() + timedelta(days=90),
        minutes_per_day=30, available_days=["Monday", "Wednesday", "Friday"],
    ),
    LearnerProfile(
        id="eval_02", name="Ben", instrument="saxophone",
        current_level="intermediate",
        goal_song="Take Five", goal_event="recital",
        deadline_date=date.today() + timedelta(days=45),
        minutes_per_day=45, available_days=["Tuesday", "Thursday", "Saturday", "Sunday"],
    ),
    LearnerProfile(
        id="eval_03", name="Clara", instrument="saxophone",
        current_level="complete_beginner",
        goal_song="Fly Me to the Moon", goal_event="birthday party",
        deadline_date=date.today() + timedelta(days=30),  # tight deadline
        minutes_per_day=20, available_days=["Saturday", "Sunday"],
    ),
    LearnerProfile(
        id="eval_04", name="Dan", instrument="saxophone",
        current_level="advanced_beginner",
        goal_song="Autumn Leaves", goal_event="jam session",
        deadline_date=date.today() + timedelta(days=120),
        minutes_per_day=60, available_days=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    ),
    LearnerProfile(
        id="eval_05", name="Eva", instrument="saxophone",
        current_level="intermediate",
        goal_song="Misty", goal_event="open mic night",
        deadline_date=date.today() + timedelta(days=60),
        minutes_per_day=30, available_days=["Monday", "Wednesday", "Friday", "Sunday"],
    ),
]

# ── Scoring rubrics ────────────────────────────────────────────────────────────

def score_plan(plan: Plan, profile: LearnerProfile) -> dict:
    segs = plan.segments
    n = len(segs)
    scores = {}

    # 1. Segment count is reasonable (4–10)
    scores["segment_count_ok"] = 4 <= n <= 10
    scores["segment_count"]    = n

    # 2. All dates are in the future and before deadline
    today    = date.today()
    deadline = profile.deadline_date
    dates_ok = True
    for s in segs:
        try:
            d = date.fromisoformat(s.target_date)
            if d < today or d > deadline:
                dates_ok = False
        except Exception:
            dates_ok = False
    scores["dates_within_deadline"] = dates_ok

    # 3. Skills are non-empty and distinct
    skills  = [s.skill for s in segs]
    scores["skills_non_empty"]  = all(len(sk) > 5 for sk in skills)
    scores["skills_distinct"]   = len(set(skills)) == n

    # 4. Status is not_started for all (fresh plan)
    scores["all_not_started"] = all(s.status == "not_started" for s in segs)

    # 5. Goal song mentioned in at least one segment skill
    song_lower = profile.goal_song.lower()
    scores["song_contextual"] = any(song_lower in s.skill.lower() for s in segs)

    passed = sum(1 for v in scores.values() if v is True)
    total  = sum(1 for v in scores.values() if isinstance(v, bool))
    scores["_score"] = f"{passed}/{total}"
    return scores


def score_coaching(content: str) -> dict:
    scores = {}

    # 1. Word count under 150
    word_count = len(content.split())
    scores["word_count"]    = word_count
    scores["concise"]       = word_count <= 150

    # 2. Required sections present
    scores["has_what"]      = "**What:**" in content or "**What**" in content
    scores["has_drill"]     = "**Drill:**" in content or "**Drill**" in content
    scores["has_done_when"] = "**Done when:**" in content or "**Done When:**" in content or "**Done when**" in content

    # 3. Has numbered steps (at least 2)
    import re
    numbered = re.findall(r"^\s*\d+\.", content, re.MULTILINE)
    scores["has_numbered_steps"] = len(numbered) >= 2
    scores["step_count"]         = len(numbered)

    # 4. Not empty
    scores["non_empty"] = len(content.strip()) > 20

    passed = sum(1 for v in scores.values() if v is True)
    total  = sum(1 for v in scores.values() if isinstance(v, bool))
    scores["_score"] = f"{passed}/{total}"
    return scores


def score_quiz(questions: list[dict]) -> dict:
    scores = {}

    # 1. Exactly 3 questions
    scores["question_count"]      = len(questions)
    scores["has_3_questions"]     = len(questions) == 3

    valid_answers, valid_options = True, True
    for q in questions:
        # 2. Each question has 4 options
        if len(q.get("options", [])) != 4:
            valid_options = False
        # 3. Answer is A, B, C, or D
        if q.get("answer", "").upper() not in {"A", "B", "C", "D"}:
            valid_answers = False
        # 4. Options start with A) B) C) D)
        for i, opt in enumerate(q.get("options", [])):
            expected_letter = "ABCD"[i]
            if not opt.startswith(f"{expected_letter})"):
                valid_options = False

    scores["valid_options"] = valid_options
    scores["valid_answers"] = valid_answers
    scores["has_question_text"] = all(len(q.get("question", "")) > 5 for q in questions)

    passed = sum(1 for v in scores.values() if v is True)
    total  = sum(1 for v in scores.values() if isinstance(v, bool))
    scores["_score"] = f"{passed}/{total}"
    return scores


# ── Runner ─────────────────────────────────────────────────────────────────────

def run_profile(profile: LearnerProfile) -> dict:
    result = {"profile": profile.name, "level": profile.current_level,
              "song": profile.goal_song, "days": (profile.deadline_date - date.today()).days}

    # Plan
    try:
        plan = build_plan(profile)
        result["plan"] = score_plan(plan, profile)
        result["plan_ok"] = True
    except Exception as e:
        result["plan_ok"] = False
        result["plan_error"] = str(e)
        return result

    # Coaching — use first segment
    try:
        first_seg = plan.segments[0]
        content   = generate_segment_content(profile, first_seg)
        result["coaching"] = score_coaching(content)
        result["coaching_ok"] = True
        result["coaching_preview"] = content[:120] + "…" if len(content) > 120 else content
    except Exception as e:
        result["coaching_ok"] = False
        result["coaching_error"] = str(e)

    # Quiz — use first segment skill
    try:
        questions = generate_quiz(profile, first_seg.skill)
        result["quiz"] = score_quiz(questions)
        result["quiz_ok"] = True
    except Exception as e:
        result["quiz_ok"] = False
        result["quiz_error"] = str(e)

    return result


def print_report(results: list[dict]):
    BOLD  = "\033[1m"
    GREEN = "\033[92m"
    RED   = "\033[91m"
    DIM   = "\033[90m"
    RESET = "\033[0m"

    def ok(v): return f"{GREEN}✓{RESET}" if v else f"{RED}✗{RESET}"

    print(f"\n{BOLD}{'─'*62}")
    print("  Cadence Eval Report")
    print(f"{'─'*62}{RESET}\n")

    plan_pass = coaching_pass = quiz_pass = 0
    total = len(results)

    for r in results:
        print(f"{BOLD}{r['profile']}{RESET}  {DIM}{r['level']} · \"{r['song']}\" · {r['days']}d{RESET}")

        if not r.get("plan_ok"):
            print(f"  {RED}PLAN ERROR: {r.get('plan_error')}{RESET}")
        else:
            p = r["plan"]
            plan_ok = p["segment_count_ok"] and p["dates_within_deadline"] and p["skills_non_empty"]
            if plan_ok: plan_pass += 1
            print(f"  Plan    {ok(plan_ok)}  {p['_score']}  {p['segment_count']} segments  dates_ok={ok(p['dates_within_deadline'])}")

        if not r.get("coaching_ok"):
            print(f"  {RED}COACHING ERROR: {r.get('coaching_error')}{RESET}")
        else:
            c = r["coaching"]
            coach_ok = c["concise"] and c["has_what"] and c["has_drill"] and c["has_done_when"]
            if coach_ok: coaching_pass += 1
            print(f"  Coach   {ok(coach_ok)}  {c['_score']}  {c['word_count']} words  steps={c['step_count']}")
            print(f"  {DIM}Preview: {r['coaching_preview']}{RESET}")

        if not r.get("quiz_ok"):
            print(f"  {RED}QUIZ ERROR: {r.get('quiz_error')}{RESET}")
        else:
            q = r["quiz"]
            quiz_ok = q["has_3_questions"] and q["valid_options"] and q["valid_answers"]
            if quiz_ok: quiz_pass += 1
            print(f"  Quiz    {ok(quiz_ok)}  {q['_score']}  {q['question_count']}q")
        print()

    print(f"{BOLD}{'─'*62}")
    print(f"  Summary  ({total} profiles tested)")
    print(f"{'─'*62}{RESET}")
    print(f"  Plan quality     {ok(plan_pass == total)}  {plan_pass}/{total} passed")
    print(f"  Coaching quality {ok(coaching_pass == total)}  {coaching_pass}/{total} passed")
    print(f"  Quiz quality     {ok(quiz_pass == total)}  {quiz_pass}/{total} passed")

    overall = plan_pass + coaching_pass + quiz_pass
    max_score = total * 3
    pct = round((overall / max_score) * 100)
    color = GREEN if pct >= 80 else RED
    print(f"\n  {BOLD}Overall: {color}{pct}%{RESET}{BOLD} ({overall}/{max_score} checks){RESET}\n")

    # Save JSON report
    out_path = Path(__file__).parent / "eval_results.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"  Full results saved to {out_path}\n")


if __name__ == "__main__":
    print("Running Cadence eval harness…  (makes real API calls, costs ~$0.05)")
    results = []
    for profile in PROFILES:
        print(f"  Testing {profile.name}…", end=" ", flush=True)
        r = run_profile(profile)
        results.append(r)
        print("done")
    print_report(results)
