from typing import Dict, Optional
from pydantic import BaseModel


class KPISummaryResponse(BaseModel):
    total_observations: int
    open_count: int
    in_progress_count: int
    closed_count: int
    escalated_count: int
    open_high_risk_count: int
    avg_time_to_closure_hours: Optional[float] = None
    sync_rate_pct: float
    by_category: Dict[str, int]
    by_risk: Dict[str, int]
