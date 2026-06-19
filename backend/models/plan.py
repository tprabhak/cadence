from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Segment:
    id: str
    skill: str                  # e.g. "learn fingering for verse melody"
    target_date: str
    status: str                 # not_started / in_progress / complete
    confidence: int             # 0-5; 0 = not assessed yet
    resource_link: Optional[str]
    content: Optional[str]      # generated coaching content, stored after first generation
    quiz: Optional[list] = None # cached quiz questions, generated once per segment


@dataclass
class Plan:
    version: int
    learner_id: str
    segments: list[Segment]
    readiness_estimate: float   # 0.0 - 1.0
    last_replan_reason: Optional[str]
