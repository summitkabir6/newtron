"""
Causal reasoning module.

Given the current plant state, identifies anomalies, infers likely root cause,
projects the causal chain, and assigns a risk level.
"""

from typing import Dict, List, Tuple
from app.simulation.state import PlantState
from app.causal.graph import ANOMALY_THRESHOLDS, get_causal_chain, get_upstream


def _check_anomalies(state: PlantState) -> List[str]:
    """Return list of variable names currently outside safe thresholds."""
    anomalies = []
    s = state.to_dict()
    for var, (direction, threshold) in ANOMALY_THRESHOLDS.items():
        value = s.get(var)
        if value is None:
            continue
        if direction == "above" and value > threshold:
            anomalies.append(var)
        elif direction == "below" and value < threshold:
            anomalies.append(var)
    return anomalies


def _find_root_cause(anomalies: List[str]) -> str:
    """
    Heuristic: the anomaly with the fewest upstream causes is most likely the root.
    Ties broken by order.
    """
    if not anomalies:
        return "none"
    scored = sorted(anomalies, key=lambda v: len(get_upstream(v)))
    return scored[0]


def _assess_risk(anomalies: List[str], state: PlantState) -> str:
    """Simple risk classification based on anomaly count and critical values."""
    s = state.to_dict()

    # Critical overrides
    if s["loop_pressure"] > 6.0 or s["outlet_temperature"] > 120.0:
        return "high"
    if s["pump_a_health"] < 40.0 or s["coolant_flow_rate"] < 400.0:
        return "high"

    count = len(anomalies)
    if count == 0:
        return "low"
    elif count <= 2:
        return "medium"
    else:
        return "high"


def explain(state: PlantState) -> Dict:
    """
    Produce a causal explanation dict:
    {
        "root_cause": str,
        "chain": [str, ...],
        "anomalies": [str, ...],
        "risk_level": "low" | "medium" | "high"
    }
    """
    anomalies = _check_anomalies(state)
    root = _find_root_cause(anomalies)
    chain = get_causal_chain(root, depth=4) if root != "none" else []
    risk = _assess_risk(anomalies, state)

    # Make the chain human-readable
    readable_chain = [v.replace("_", " ") for v in chain]

    return {
        "root_cause": root.replace("_", " ") if root != "none" else "No anomalies detected",
        "chain": readable_chain,
        "anomalies": [a.replace("_", " ") for a in anomalies],
        "risk_level": risk,
    }
