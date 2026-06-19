from dataclasses import dataclass, field
from datetime import date
from typing import Optional


@dataclass
class LearnerProfile:
    id: str
    name: str
    instrument: str
    current_level: str          # beginner / intermediate / advanced
    goal_song: str
    goal_event: str
    deadline_date: date
    minutes_per_day: int
    available_days: list[str]   # ["monday", "tuesday", ...]


@dataclass
class ProgressReport:
    date: str
    segment_id: str
    did_practice: bool
    minutes: int
    confidence: int             # 1-5 (computed from quiz + audio + difficulty)
    stuck_on: Optional[str]
    quiz_score: Optional[float]
    pace_status: str            # on_track / behind / ahead
    difficulty_rating: Optional[int] = None  # 1-10 self-reported session difficulty
