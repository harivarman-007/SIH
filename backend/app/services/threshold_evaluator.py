import re
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ComplianceThreshold, Observation, ObservationCategory


async def evaluate_observation_compliance(db: AsyncSession, obs: Observation) -> None:
    """
    Evaluates an observation against statutory ComplianceThreshold records (Item 2).
    For environment and production observations with numeric readings:
    - Auto-compares against matching threshold.
    - Sets obs.compliance_status to 'compliant' or 'violation'.
    - Populates obs.threshold_breach_detail with statutory reference and values.
    """
    cat_str = obs.category.value if hasattr(obs.category, "value") else str(obs.category)
    if cat_str not in ("environment", "production", "safety"):
        return

    # 1. Fetch thresholds for this category and mine_site (falling back to global site_id=None)
    stmt = select(ComplianceThreshold).where(
        (ComplianceThreshold.category == cat_str)
        & ((ComplianceThreshold.mine_site_id == obs.mine_site_id) | (ComplianceThreshold.mine_site_id.is_(None)))
    ).order_by(ComplianceThreshold.mine_site_id.desc().nullslast())

    res = await db.execute(stmt)
    thresholds = res.scalars().all()
    if not thresholds:
        return

    # Map by lowercase metric_name
    thresh_by_metric = {t.metric_name.lower(): t for t in thresholds}

    # 2. Extract numeric reading and candidate metric name
    reading_val: Optional[float] = obs.gas_reading_value
    reading_unit: Optional[str] = (obs.gas_reading_unit or "").strip()
    matched_threshold: Optional[ComplianceThreshold] = None

    # Check if unit or description mentions specific threshold metric
    desc_lower = (obs.description or "").lower()
    unit_lower = reading_unit.lower()

    for metric_name, thresh in thresh_by_metric.items():
        if metric_name in desc_lower or metric_name in unit_lower:
            matched_threshold = thresh
            break
        # Common aliases
        if metric_name == "noise_db" and ("noise" in desc_lower or "db" in unit_lower or "sound" in desc_lower):
            matched_threshold = thresh
            break
        if metric_name == "blast_seismic_limit" and ("blast" in desc_lower or "seismic" in desc_lower or "mm/s" in unit_lower):
            matched_threshold = thresh
            break
        if metric_name == "extraction_rate" and ("extraction" in desc_lower or "production" in desc_lower or "tpd" in unit_lower):
            matched_threshold = thresh
            break

    # If reading_val is not explicitly set, try extracting a number from description if matched_threshold found
    if reading_val is None and matched_threshold:
        # Match patterns like "120 ug/m3", "92 dB", "15 mm/s", "5200 TPD", "PM10: 110"
        pattern = rf"{matched_threshold.metric_name}[\s:=]*([0-9]+(?:\.[0-9]+)?)"
        match = re.search(pattern, desc_lower)
        if not match:
            # Fallback: look for number followed by unit
            unit_esc = re.escape(matched_threshold.unit.lower())
            match = re.search(rf"([0-9]+(?:\.[0-9]+)?)\s*{unit_esc}", desc_lower)
        if match:
            try:
                reading_val = float(match.group(1))
            except ValueError:
                pass

    # If still no matched_threshold but reading_val is present, pick first matching category threshold
    if not matched_threshold and reading_val is not None:
        matched_threshold = thresholds[0]

    # 3. Evaluate compliance against matched threshold
    if matched_threshold and reading_val is not None:
        unit = matched_threshold.unit or reading_unit or ""
        ref_text = f" ({matched_threshold.statutory_ref})" if matched_threshold.statutory_ref else ""

        if reading_val > matched_threshold.max_value:
            obs.compliance_status = "violation"
            obs.threshold_breach_detail = (
                f"{matched_threshold.metric_name} reading of {reading_val:.1f} {unit} "
                f"exceeds statutory cap of {matched_threshold.max_value:.1f} {unit}{ref_text}"
            )
        else:
            obs.compliance_status = "compliant"
            obs.threshold_breach_detail = (
                f"{matched_threshold.metric_name} reading of {reading_val:.1f} {unit} "
                f"within statutory threshold (max {matched_threshold.max_value:.1f} {unit}){ref_text}"
            )
    elif cat_str in ("environment", "production") and obs.compliance_status is None:
        # Default compliant if no numeric breach detected
        obs.compliance_status = "compliant"
