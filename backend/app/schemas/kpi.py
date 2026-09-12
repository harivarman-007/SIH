from typing import Dict, List, Optional
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


class OpenViolationsDrilldown(BaseModel):
    total: int
    high_risk: int
    safety: int
    environment: int
    labour: int


class ContractorRiskDrilldown(BaseModel):
    active_contractors: int
    assigned_violations: int
    high_risk_contractor_tasks: int
    avg_compliance_pct: float


class MineLeaderboardItem(BaseModel):
    mine_id: str
    mine_name: str
    location: str
    risk_score: float
    risk_level: str  # low | medium | high
    open_violations: int
    high_risk_count: int
    total_observations: int
    compliance_rate_pct: float
    active_contractors: int
    trend_sparkline: List[float]


class CrossMineSummaryResponse(BaseModel):
    aggregate_risk_score: float
    aggregate_risk_level: str
    total_mines: int
    total_observations: int
    open_violations: OpenViolationsDrilldown
    contractor_risk: ContractorRiskDrilldown
    mines_leaderboard: List[MineLeaderboardItem]
