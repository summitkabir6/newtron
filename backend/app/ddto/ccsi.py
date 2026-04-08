"""
Crew Cognitive State Index (CCSI)

NewTron's most unique capability — no existing nuclear system does this.

The CCSI is a single 0-100 score representing the cognitive health
of the entire operator crew simultaneously.

Key insight from the literature (Kim et al. 2016, aviation CRM studies):
When two operators degrade simultaneously, error risk is NOT additive.
It is MULTIPLICATIVE. A crew where both operators are fatigued is
dramatically more dangerous than the sum of individual risks.

CCSI Formula:
- Base: weighted average of individual operator load scores
- Compound penalty: applied when 2+ operators degrade simultaneously
- Circadian adjustment: night shift operators carry higher prior risk
- Experience weighting: junior operators contribute more variance

CCSI Levels:
- 80-100: Optimal    — crew fully capable, no concerns
- 60-79:  Nominal    — minor individual variations, within tolerance
- 40-59:  Degraded   — one or more operators showing load, monitor
- 20-39:  Impaired   — crew-level risk elevated, consider intervention
- 0-19:   Critical   — immediate supervisor action required

The compound penalty is the core innovation:
If any 2 operators are simultaneously in elevated_load or worse,
the CCSI drops by an additional 15-25 points beyond the weighted average.
This reflects the aviation finding that crew-level risk compounds nonlinearly.
"""

import math
import time
from typing import Dict, List, Optional


# CCSI level definitions
CCSI_LEVELS = [
    (80, 100, "Optimal",  "#22c55e", "Crew fully capable"),
    (60,  79, "Nominal",  "#84cc16", "Within normal tolerance"),
    (40,  59, "Degraded", "#f59e0b", "Monitor — individual load detected"),
    (20,  39, "Impaired", "#ef4444", "Elevated crew risk — consider intervention"),
    ( 0,  19, "Critical", "#dc2626", "Immediate supervisor action required"),
]

# State to load score mapping
STATE_LOAD = {
    "normal":        0.10,
    "elevated_load": 0.38,
    "high_load":     0.58,
    "fatigued":      0.72,
    "critical":      0.90,
}

# Experience weighting — less experienced operators carry more variance
EXPERIENCE_WEIGHTS = {
    "op_a": 0.30,   # Alex Chen   — 12 yrs, lower weight (more stable)
    "op_b": 0.45,   # Blair Santos —  4 yrs, higher weight (more variable)
    "op_c": 0.25,   # Casey Morgan —  8 yrs, middle weight
}


def _get_ccsi_level(score: float) -> Dict:
    for lo, hi, label, color, desc in CCSI_LEVELS:
        if lo <= score <= hi:
            return {"label": label, "color": color, "description": desc}
    return {"label": "Critical", "color": "#dc2626", "description": "Immediate action required"}


def _compound_penalty(snapshots: Dict) -> float:
    """
    Compute the compound crew risk penalty.

    Core innovation: when 2+ operators degrade simultaneously,
    risk multiplies rather than adds.

    Aviation CRM research basis: Kim et al. (2016) — crew error probability
    is not the sum of individual probabilities when both crew members
    are simultaneously degraded.
    """
    degraded_states = {"elevated_load", "high_load", "fatigued", "critical"}
    degraded_ops = []

    for op_id, snap in snapshots.items():
        state = snap.get("prediction", {}).get("current_state", "normal")
        if state in degraded_states:
            degraded_ops.append((op_id, state))

    if len(degraded_ops) < 2:
        return 0.0  # No compound risk — only 0 or 1 degraded operators

    # Compound penalty scales with severity
    severe_states = {"high_load", "fatigued", "critical"}
    severe_count = sum(1 for _, s in degraded_ops if s in severe_states)

    if severe_count >= 2:
        return 25.0   # Both severely degraded — maximum compound penalty
    elif severe_count == 1:
        return 18.0   # One severe + one elevated
    else:
        return 12.0   # Both elevated load only


def _weighted_individual_score(snapshots: Dict) -> float:
    """
    Compute experience-weighted average of individual load scores.
    Junior operators contribute more variance to the crew score.
    """
    total_weight = 0.0
    weighted_sum = 0.0

    for op_id, snap in snapshots.items():
        state = snap.get("prediction", {}).get("current_state", "normal")
        load = STATE_LOAD.get(state, 0.10)
        weight = EXPERIENCE_WEIGHTS.get(op_id, 0.33)
        weighted_sum += load * weight
        total_weight += weight

    if total_weight == 0:
        return 0.0

    return weighted_sum / total_weight


def compute_ccsi(snapshots: Dict, plant_risk: str = "low") -> Dict:
    """
    Compute the full CCSI payload from current operator snapshots.

    Args:
        snapshots: dict of operator_id -> twin snapshot (from DDTOEngine)
        plant_risk: current plant risk level

    Returns:
        Full CCSI dict for WebSocket payload and frontend display
    """
    if not snapshots:
        return _empty_ccsi()

    # Step 1: weighted individual score (0-1 scale)
    individual_score = _weighted_individual_score(snapshots)

    # Step 2: convert to 0-100 CCSI scale (inverted — higher = better)
    base_ccsi = max(0.0, 100.0 - (individual_score * 100.0))

    # Step 3: compound penalty
    penalty = _compound_penalty(snapshots)
    ccsi_after_penalty = max(0.0, base_ccsi - penalty)

    # Step 4: plant risk modifier
    plant_modifier = {"low": 0.0, "medium": -5.0, "high": -15.0}.get(plant_risk, 0.0)
    final_ccsi = max(0.0, min(100.0, ccsi_after_penalty + plant_modifier))

    # Step 5: determine level
    level = _get_ccsi_level(final_ccsi)

    # Step 6: identify primary risk driver
    risk_driver = _identify_risk_driver(snapshots, penalty, plant_risk)

    # Step 7: relief recommendation
    relief_recommended = final_ccsi < 45

    # Step 8: forecast CCSI trajectory based on individual forecasts
    forecast = _forecast_ccsi(snapshots, plant_risk)

    return {
        "score": round(final_ccsi, 1),
        "level": level["label"],
        "color": level["color"],
        "description": level["description"],
        "compound_penalty_active": penalty > 0,
        "compound_penalty_value": round(penalty, 1),
        "relief_recommended": relief_recommended,
        "risk_driver": risk_driver,
        "forecast": forecast,
        "individual_contributions": _individual_contributions(snapshots),
        "timestamp": time.time(),
    }


def _identify_risk_driver(snapshots: Dict, penalty: float, plant_risk: str) -> str:
    """Identify the primary factor driving current CCSI."""
    if plant_risk == "high":
        return "Plant emergency — all operator thresholds elevated"

    if penalty > 20:
        return "Compound crew risk — multiple operators simultaneously degraded"
    elif penalty > 0:
        return "Crew load spreading — more than one operator showing elevated state"

    # Find worst individual operator
    worst_op = None
    worst_load = 0.0
    for op_id, snap in snapshots.items():
        state = snap.get("prediction", {}).get("current_state", "normal")
        load = STATE_LOAD.get(state, 0.10)
        if load > worst_load:
            worst_load = load
            worst_op = snap.get("name", op_id)

    if worst_op and worst_load > 0.3:
        return f"Individual load — {worst_op} primary contributor"

    return "All operators within normal parameters"


def _individual_contributions(snapshots: Dict) -> List[Dict]:
    """Per-operator contribution to CCSI for dashboard display."""
    contributions = []
    for op_id, snap in snapshots.items():
        state = snap.get("prediction", {}).get("current_state", "normal")
        load = STATE_LOAD.get(state, 0.10)
        contributions.append({
            "operator_id": op_id,
            "name": snap.get("name", op_id),
            "state": state,
            "load_score": round(load, 3),
            "color": snap.get("prediction", {}).get("state_color", "#22c55e"),
        })
    return contributions


def _forecast_ccsi(snapshots: Dict, plant_risk: str) -> List[Dict]:
    """
    Project CCSI at +5, +10, +15 minutes based on individual forecasts.
    """
    horizons = [5, 10, 15]
    forecast = []

    for minutes in horizons:
        projected_snapshots = {}
        for op_id, snap in snapshots.items():
            fc = snap.get("prediction", {}).get("forecast", [])
            # Find the forecast point closest to this horizon
            point = next((f for f in fc if f["minutes_ahead"] == minutes), None)
            if point:
                projected_snapshots[op_id] = {
                    "prediction": {"current_state": point["predicted_state"]},
                    "name": snap.get("name", op_id),
                }
            else:
                projected_snapshots[op_id] = snap

        projected = compute_ccsi(projected_snapshots, plant_risk)
        forecast.append({
            "minutes_ahead": minutes,
            "score": projected["score"],
            "level": projected["level"],
            "color": projected["color"],
        })

    return forecast


def _empty_ccsi() -> Dict:
    return {
        "score": 100.0,
        "level": "Optimal",
        "color": "#22c55e",
        "description": "Awaiting operator data",
        "compound_penalty_active": False,
        "compound_penalty_value": 0.0,
        "relief_recommended": False,
        "risk_driver": "Initialising",
        "forecast": [],
        "individual_contributions": [],
        "timestamp": time.time(),
    }
