"""
action_map.py
Deterministic corrective action mapping.
Maps (category, flag) → suggested action text.

For demo/MVP this is a rule table. In a real deployment it would be backed by
DGMS circulars / statutory action codes.
"""

from typing import Dict, Tuple


# ─────────────────────────────────────────────────────────────────────────────
# Action table: (category, flag) → action text
# ─────────────────────────────────────────────────────────────────────────────

ACTION_TABLE: Dict[Tuple[str, str], str] = {

    # ── SAFETY ────────────────────────────────────────────────────────────────
    ("safety", "high"): (
        "IMMEDIATE ACTION REQUIRED: Evacuate all personnel from the affected area. "
        "Suspend operations. Notify DGMS inspector and mine manager within 1 hour. "
        "Erect barricades and deploy rescue team. Do not resume until formal clearance issued."
    ),
    ("safety", "medium"): (
        "CORRECTIVE ACTION WITHIN 24 HRS: Assign a safety officer to inspect and "
        "document the hazard. Conduct toolbox talk with crew. Apply temporary control "
        "measures (support, barricade, dewatering as applicable). Log corrective steps "
        "in the mine safety register and report to shift manager."
    ),
    ("safety", "low"): (
        "MONITOR AND LOG: Record observation in the mine safety register. "
        "Re-inspect the area at next scheduled shift. No immediate operational change required. "
        "Flag for inclusion in monthly DGMS compliance report."
    ),

    # ── ENVIRONMENT ───────────────────────────────────────────────────────────
    ("environment", "high"): (
        "URGENT ENVIRONMENTAL RESPONSE: Stop the source of discharge/emission immediately. "
        "Notify the State Pollution Control Board and company EHS officer within 2 hours. "
        "Deploy containment measures (bund, silt fence, air curtain). "
        "Collect baseline samples before remediation. Document photographic evidence."
    ),
    ("environment", "medium"): (
        "CORRECTIVE ACTION WITHIN 48 HRS: Review and repair effluent treatment or dust "
        "suppression systems. Verify that discharge parameters are within MoEFCC-prescribed limits. "
        "Submit corrective action plan to Environmental Officer and update EMS register."
    ),
    ("environment", "low"): (
        "PREVENTIVE MONITORING: Include observation in next quarterly environmental audit. "
        "Verify that current controls (water spray, settling pond, dust screens) are operational. "
        "No regulatory reporting required at this threshold."
    ),

    # ── LABOUR ────────────────────────────────────────────────────────────────
    ("labour", "high"): (
        "STOP-WORK ORDER: Immediately halt work involving non-compliant crew or equipment. "
        "Verify all workers' competency certificates, medicals, and DGMS passes. "
        "Report contractor violation to mine HR and legal. Impose contractual penalty per MOU. "
        "Re-permit only after documented corrective training and management sign-off."
    ),
    ("labour", "medium"): (
        "CORRECTIVE TRAINING & COMPLIANCE CHECK WITHIN 24 HRS: Conduct on-site refresher "
        "training for PPE usage, permit-to-work, and rest rules. Update contractor register. "
        "Issue formal warning letter. Re-verify compliance within 7 days via follow-up inspection."
    ),
    ("labour", "low"): (
        "ADVISORY: Log labour observation in contractor compliance register. "
        "Include in next monthly safety committee meeting agenda. "
        "No immediate enforcement action required."
    ),

    # ── PRODUCTION ────────────────────────────────────────────────────────────
    ("production", "high"): (
        "HALT PRODUCTION SECTION: Cease extraction operations immediately along affected face or haul road. "
        "Inspect heavy earth-moving machinery (HEMM) for mechanical/structural stress. "
        "File statutory production hazard notice to Agent and Mines Manager under Coal Mines Regulations."
    ),
    ("production", "medium"): (
        "OPERATIONAL REVIEW WITHIN 12 HRS: Adjust extraction rate to statutory safety limits. "
        "Audit haul road gradients, dust suppression at hopper, and conveyor belt alignment. "
        "Log in shift handover register."
    ),
    ("production", "low"): (
        "LOG IN SHIFT PRODUCTION LOG: Monitor equipment cycle times and coal bench clearance. "
        "Review at end-of-shift operational debrief."
    ),
}

# Fallback
_DEFAULT_ACTION = (
    "Review observation with the shift mine manager. "
    "Follow applicable DGMS guideline for the reported category and severity. "
    "Ensure entry is logged in the statutory register within 24 hours."
)


def get_suggested_action(category: str, flag: str) -> str:
    """
    Returns the suggested corrective action for a given category and risk flag.

    Args:
        category:  'safety' | 'environment' | 'labour'
        flag:      'low' | 'medium' | 'high'

    Returns:
        Human-readable corrective action string.
    """
    key = (category.lower().strip(), flag.lower().strip())
    return ACTION_TABLE.get(key, _DEFAULT_ACTION)
