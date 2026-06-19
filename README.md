# Cadence — AI Saxophone Practice Coach

> An AI **agent** (not a wrapper) that builds a personalized learning path toward a specific goal song by a specific deadline, adapts the plan based on real practice data, and coaches the learner through every session.

**Stack:** FastAPI · React · TypeScript · Anthropic API (Claude Sonnet 4.6 + Haiku 4.5) · SQLite  
**Eval:** 100% pass rate across 5 profiles, 3 quality dimensions  
**Cost:** ~$0.01 per learner onboarding + first lesson

---

## The Problem

Generic music learning apps (Yousician, Simply Piano) give you a curriculum. They don't know you want to play *Girl from Ipanema* at a wedding in 90 days, and they don't adjust when you fall behind.

Cadence is goal-first: you give it a song, an occasion, and a deadline. It builds a realistic path, coaches you through each segment, and replans when you go off track.

---

## What Makes It an Agent

Most "AI music apps" are wrappers: user input → LLM → output. Cadence is not that.

It has three things that make it an agent:

**1. Tools**
The agent calls functions to do things: generate and store coaching content, fetch real learning resources via web search, check pace against the deadline (pure code, no LLM), log progress to a database. It decides when and how to call each tool.

**2. Persistent memory**
State lives in SQLite. The agent knows what the learner practiced last week, their confidence scores, their quiz results, and how many days remain until the deadline. A new session picks up exactly where the last one left off.

**3. Feedback + replan loop**
After every session, the agent checks pace using pure code (fast, free):
- If behind → compress the plan, cut lower-priority segments
- If ahead → extend with harder material
- If confidence is consistently low → insert a remediation step before moving on

This loop is what separates a plan generator from an agent. The plan is not static.

---

## Architecture

```
Frontend (React + TypeScript)
  Onboarding → Plan Overview → Learning Map → Lesson (coaching + quiz)
  Admin dashboard: cost, quality, replan history

Backend (FastAPI + Python)
  /onboard     → build_plan() → Sonnet 4.6 → SQLite
  /session     → coaching (Haiku 4.5) + search_resources() + pace check + replan if needed
  /progress    → log session, mark segment complete, trigger replan if off pace
  /quiz        → generate_quiz() → Haiku 4.5
  /admin/metrics → real token counts + cost from API response
```

**Cost discipline decisions (made before writing code):**
- Generate coaching content once per segment, store it — never regenerate on repeat visits
- Pace check is pure Python (no LLM call)
- Replan only fires when the code says it's needed — not on every session
- Haiku for quizzes + coaching (~5× cheaper than Sonnet), Sonnet only for planning

---

## Eval Results

Before shipping, every prompt was validated against 5 test learner profiles spanning beginner to intermediate, 30-day to 120-day deadlines, and different goal songs.

```
Profile                                  Plan    Coaching    Quiz
─────────────────────────────────────────────────────────────────
Alice  beginner · Girl from Ipanema 90d   ✓       ✓           ✓
Ben    intermediate · Take Five 45d        ✓       ✓           ✓
Clara  beginner · Fly Me to the Moon 30d  ✓       ✓           ✓
Dan    adv. beginner · Autumn Leaves 120d ✓       ✓           ✓
Eva    intermediate · Misty 60d            ✓       ✓           ✓
─────────────────────────────────────────────────────────────────
Overall: 100% (15/15 checks)
```

**Scoring rubric:**
- Plan: 4–10 segments, all target dates within deadline, skills distinct and non-empty
- Coaching: under 150 words, all three required sections present (**What / Drill / Done when**), numbered steps
- Quiz: exactly 3 questions, valid A/B/C/D options and answers

Run it yourself: `cd backend && python -m eval.run_eval`

---

## Cost Analysis

All API calls are instrumented — token counts come directly from the Anthropic response `usage` field, not estimated.

| Endpoint       | Model      | Typical cost/call |
|----------------|------------|-------------------|
| build_plan     | Sonnet 4.6 | ~$0.008           |
| replan         | Sonnet 4.6 | ~$0.012           |
| coaching       | Haiku 4.5  | ~$0.0003          |
| quiz_generate  | Haiku 4.5  | ~$0.0002          |

Estimated cost per learner onboarding + first lesson: **~$0.01**

Replan is the most expensive single call (~$0.012) — but it only fires when the code determines it's needed, and it replaces multiple future coaching calls that would otherwise miss the mark.

View live cost data at `/admin` in the app.

---

## What the Agent Gets Right

- Plans are goal-aware: segment skills reference the specific song and build toward it
- Coaching is genuinely short (avg 70–75 words in eval) and structured
- Tight deadlines produce compressed plans (Clara: 9 segments for 30 days vs 10 for 120 days)
- Replan triggers are rule-based (not LLM-decided) — deterministic and cheap

## What It Doesn't Do Yet

- **Real-time audio feedback** — no pitch detection. The agent coaches, but can't hear you play. This would require a separate audio processing layer (out of scope for v1).
- **The search tool needs a key** — `BRAVE_API_KEY` in `.env` activates real resource links. Get a free key at [brave.com/search/api](https://brave.com/search/api/). Without it, the agent works but skips the resource-fetching step.
- **Real user data** — the eval covers synthetic profiles. Real usage data will stress-test edge cases (learners who skip weeks, confidence scores that never improve, songs outside the training distribution).

---

## Setup

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Add ANTHROPIC_API_KEY to .env (optionally BRAVE_API_KEY for search)
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm start
```

**Run the eval harness:**
```bash
cd backend
source .venv/bin/activate
python -m eval.run_eval
```

---

## Stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | React, TypeScript |
| Backend   | FastAPI, Python |
| LLM       | Anthropic API (Sonnet 4.6 for planning, Haiku 4.5 for coaching/quiz) |
| Database  | SQLite |
| Search    | Brave Search API (optional) |
| Eval      | Custom Python harness |
