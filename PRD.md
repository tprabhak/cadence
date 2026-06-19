# PRD — Goal-Driven Practice Coach Agent (working name: "Cadence")

> **What this is:** An AI *agent* (not a generator) that takes a learner's specific goal + deadline and acts as an ongoing coach — building a personalized path, fetching real resources, tracking progress over time, and re-planning as the learner falls behind or races ahead. First vertical: learning a **musical instrument** (saxophone, v1), aimed at adult learners with a specific song and a deadline.

> **Read this first (so no bet is missed):** The single biggest failure mode is building a *generator* (goal in → plan out → done) and calling it an agent. Do NOT do that. The whole point is the **loop**: the system takes actions, observes outcomes, holds memory across sessions, and decides its next move. If a feature doesn't serve tool-use, memory, or the feedback/re-plan loop, it is out of scope for v1.

> **Locked decisions:** Instrument = **saxophone**. Interface = **CLI or simple chat** (lowest effort that still demos the loop). Resource fetching = **general web search tool** (not the YouTube API) for v1 simplicity.

---

## 1. Why this exists (context)

Adults who want to learn an instrument for a specific reason are drowning in free resources (YouTube, tabs) but have no path, no accountability, and no way to know if they'll be ready in time. Existing apps (Yousician, Simply Piano, Skoove, Flowkey) are excellent at gamified, mic-based real-time feedback but route everyone through a **fixed content tree**. None can build a bespoke path to an *arbitrary specific goal* ("play this exact song at my wedding in 9 weeks at my current level"). That gap — goal-driven, hyper-personalized pathing + coaching + accountability over time, sitting on top of free resources — is the wedge.

Built as (a) a portfolio-grade end-to-end AI agent and (b) a possible product. Favor demonstrating real agency and product judgment over feature breadth.

## 2. Key terms

- **Segment** — one chunk of the learning path; the unit the agent plans, generates content for, and tracks. E.g. *learn the 4 chords → clean chord changes → verse → chorus → transition → full song slow → full song at tempo.* Each segment has: content, one resource link, a target date, and a status. Re-planning = reshuffling/cutting segments. Readiness = (segments at confidence ≥4) ÷ (total segments).

## 3. Target user

**Primary persona — deadline-driven adult goal-learner ("Maya").** Age 25–45, working adult, time-poor not money-poor (~15–30 min/day, irregular). Outcome-oriented: wants to play one specific song for one specific moment (wedding, proposal, milestone birthday, memorial, open mic). Deadline is real and emotional. Self-directed via free resources; may have churned out of a fixed-curriculum app.

**Archetype:** *Maya, 32, wants to play "Can't Help Falling in Love" on saxophone for her wedding in 9 weeks; has a saxophone, 20 min weeknights, no plan, 40 tabs open.*

Not for: kids (parent-buyer, different product) or exam students (have teachers).

## 4. Painpoints (v1 must address the bolded)

1. **Doesn't know where to start** · 2. Generic lessons feel irrelevant · 3. **Too many tutorial options** · 4. **Wastes time choosing what to practice** · 5. Unsure what level/version fits · 6. **Gets stuck with no help** · 7. **Doesn't know if improving** · 8. **Has a deadline / pressure** · 9. **Limited daily time** · 10. **No personalized plan** · 11. No real-time feedback (OUT for v1) · 12. **No accountability** · 13. **Can't turn free resources into a path** · 14. Low performance confidence · 15. **Doesn't know what "good enough" looks like by the deadline**

## 5. What makes this an AGENT (non-negotiable)

Generator: prompt → text → stop. Agent: **goal → take actions → observe → decide next move → loop**, with memory and autonomy. Same LLM; the difference is the wrapper: **tools + memory + a loop**. MUST implement:

- **Tool use** — fetch real resources via search; never hallucinate links.
- **Memory/state** — persist learner profile + progress; no cold starts.
- **Feedback loop + re-planning** — ingest progress, reassess pace vs deadline, regenerate affected segments as a *decision*.
- **(Stretch) Proactive autonomy** — simulated time-based check-ins (not real cron in v1).

## 6. MVP feature list (this is M1 + M2 — the realistic weekend build)

Each feature tagged with the agent property it delivers. If cutting scope, cut everything before **4, 7, 8** — those three are what make it an agent.

1. **Goal onboarding** — capture song, instrument, current level, deadline, minutes/day, days/week. *(input → state)*
2. **Personalized path generation** — agent builds a deadline-aware, level-appropriate plan broken into **segments** with target dates. *(planning)*
3. **Self-generated coaching content** — agent produces the daily practice task, micro-drills, step-by-step song breakdown, and theory/ear-training exercises itself. Generated **per-segment, just-in-time, then stored** (see §8). *(owned content)*
4. **Vetted resource search** — for steps where a video helps, calls the search tool, gets *live* links, and picks the single best one for the user's level. No hallucinated links; the agent does the choosing (solves painpoint 3). *(tool use)*
5. **Persistent memory** — saves learner profile + progress log; remembers across sessions. *(memory)*
6. **Progress capture** — daily self-report: practiced? minutes, confidence per section (1–5), what they're stuck on. *(observation input)*
7. **Quiz-based assessment** — agent generates and grades short quizzes on the checkable parts (theory, rhythm, fretboard, intervals) for a signal beyond self-report. *(observation)* — **Honesty note:** if the same model generates and grades, this is a useful but slightly circular signal, not ground truth. Treat as directional.
8. **Re-plan decision (the agentic heart)** — compares progress vs deadline pace and decides: on track → continue; behind → compress scope (chorus-only); ahead → add bridge/difficulty; stuck → fetch targeted help + insert remediation drills. *(loop)*
9. **Pace & readiness status** — a grounded "on pace / behind" signal + readiness estimate (segments at confidence ≥4 ÷ total) + plain answer to "what does good-enough-by-the-deadline look like." *(painpoints 7, 8, 15)*

**Explicitly OUT of MVP:** real-time mic/audio feedback; real scheduled notifications (simulate time instead); native app / polished UI; multi-instrument; payments; social.

## 7. The agent loop

Onboard → Plan (segment skeleton; + self-critique pass in M3) → for the current segment: generate content (just-in-time) + search one vetted resource → Coach (deliver task, capture self-report) → Assess (quiz the checkable parts) → **Pace check (code, $0): planned vs actual progress, days left vs work left** → if off-pace/stuck/cadence-hit → **Re-plan (LLM): rebuild affected segments** → update readiness status → repeat until deadline → final readiness check.

## 8. Cost architecture (build this in from the start — keeps it cheap)

Cost = number of LLM calls × tokens per call × model price. Storage is ~free; LLM calls are the cost. Levers, all baked into v1:

- **Just-in-time generation, then store.** Onboarding generates only the segment *skeleton* (1 call). Detailed segment content is generated when the learner reaches it (or ~2 days ahead) and saved. Daily delivery just *reads* stored content — no LLM call to show today's task. Avoids paying for later content that re-planning would throw away.
- **Detect with code, regenerate with the LLM.** "Are they off-pace?" is arithmetic — do it in plain code (free), runnable daily. Only fire the expensive re-plan LLM call *when the math says they're off track* (or stuck, or weekly cadence).
- **Reuse a content bank.** Common drills and quiz templates are stored and reused; the LLM only *personalizes* to the song/level when needed.
- **Compact memory summary, not full history.** Feed each LLM call a tight learner-state summary (level, segments mastered, pace, last few reports) — never the whole transcript. This controls input tokens.
- **Tiered models.** Cheap/fast model (e.g. Haiku) for quizzes, grading, nudges; stronger model (Sonnet/Opus) only for planning and re-planning.

Reality check: for a weekend build with you + a handful of test learners, total cost is **single-digit dollars**. These levers matter at scale; architecting them now is free insurance.

## 9. Memory / state model (minimum)

```
LearnerProfile: id, name, instrument, current_level, goal_song, goal_event,
  deadline_date, minutes_per_day, available_days
ProgressLog (append per session): date, segment_id, self_report (did_practice,
  minutes, confidence 1-5, stuck_on), quiz_results (topic, score), pace_status
Plan (versioned on re-plan): segments[] (id, skill/section, target_date,
  resource_link, content_ref, status, confidence), readiness_estimate %,
  last_replan_reason
StateSummary (compact, fed to LLM calls): level, segments_mastered, current_pace,
  recent_reports
```

Storage for v1: **SQLite or a JSON file.** Zero infra, zero cost. (Hosted/multi-user later: Supabase free tier.)

## 10. Key constraint — do NOT fake this

v1 cannot assess live musical performance (no mic pitch/rhythm detection — that's the incumbents' moat and out of scope). The loop runs on (1) self-report and (2) quizzable objective signals. Lean on (2) for at least one real-ish signal. Treat "no real-time audio feedback" as a deliberate, documented scoping decision — not a hidden gap. Optional stretch: user uploads a short clip → multimodal model / pitch-detection API for rough feedback.

## 11. Success metrics & eval (start in M1, don't save for last)

**Eval harness — the résumé centerpiece. Begin with 3–4 scenarios in M1; grow to 12–15.**

- Synthetic learner scenarios (varied level/song/deadline/time). Score each generated plan on a rubric: (a) progression pedagogically sound, (b) fits stated time/day, (c) reaches goal by deadline, (d) no fabricated/dead links, (e) self-critique caught/fixed issues.
- Report **pass rate**, improve prompts/loop, report **before→after lift** (e.g. 60% → 87%). This number is the interview bullet.
- Also track: % resource links live & relevant; re-plan correctness across scripted progress trajectories (does it compress when behind, extend when ahead?).

**Product signals (if shown to real users):** activation (onboarded + plan), engagement (practice-log streak), outcome (self-reported readiness at deadline).

## 12. Portfolio deliverables (the actual point — don't skip these)

The résumé value lives here as much as in the code:

- **2-min demo (Loom)** showing the loop: onboard → plan → progress → re-plan decision.
- **Eval results** with the before/after pass-rate lift.
- **Short writeup**: the competitive analysis (why the goal-driven wedge vs. fixed-curriculum incumbents), the deliberate scoping (no audio assessment), and the **churn/business-model reasoning** (§13). In an interview this writeup is worth more than the code.

## 13. Business model & churn (documented risk)

Goal-driven learning is **episodic** → success churn; learning apps have a high churn floor. **A monthly subscription is the wrong model.** Options: one-time "project" pricing; gifting + virality (emotional, shareable moments); or **B2B2C** (sell to instrument retailers/teachers who lose money on beginner abandonment). Serial-goal "what's next?" is real but low-rate — don't bank on it. For the portfolio goal, churn need not be *solved* — but it must be *analyzed* clearly. This analysis is the deliverable.

## 14. Build approach (for Claude Code)

TypeScript or Python; Anthropic API for reasoning/generation/grading (tiered models per §8). Structure as an explicit loop/state machine (§7, §9), NOT one prompt — each node = a discrete LLM or tool call. Tools as typed functions: `searchResources(query)`, `saveState()/loadState()`, `gradeQuiz(answers)`, `checkPace()` (pure code), `generateSegmentContent(segment)`. Persistence: SQLite/JSON. Self-critique (M3): a review step scoring the draft plan against §11 rubric and revising before delivery. Ship the eval harness as a runnable script that prints the pass rate.

### Milestones (realistic weekend = M1 + M2; M3 + M4 are stretch)

1. **M1 — Core loop + memory.** Onboarding → plan skeleton → SQLite/JSON persistence → daily coach (reads stored content). *Plus: 3–4 eval scenarios scored by eye.* Done when: onboard, get a plan, reopen later, it remembers you.
2. **M2 — Make it agentic.** Add search tool (real links), quiz generate+grade, code-based pace check, and the LLM re-plan decision. Done when: it takes an action, observes a result, and changes the plan because of it.
3. **M3 (stretch) — Autonomy + polish.** Simulated time-based check-ins ("fast-forward 3 days"), self-critique pass, grounded readiness status.
4. **M4 (stretch) — Full eval harness.** 12–15 scenarios, rubric scoring, before/after pass-rate, link-validity + re-plan-correctness checks.

## 15. Open decisions (mostly resolved)

- Resolved: saxophone; CLI/chat; web search; SQLite/JSON; just-in-time per-segment generation; trigger-based re-plan; tiered models.
- Remaining: how much (if any) to invest in the optional audio-clip stretch.

---

**North-star: every line serves the agent loop — take action, observe, remember, decide, repeat, toward the deadline. Detect with code, generate with the LLM, store and reuse. If it's just "generate a plan," the bet is missed.**
