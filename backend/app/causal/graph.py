"""
Hardcoded causal graph for the reactor cooling subsystem.

Nodes represent plant variables.
Edges represent causal influence with direction and sign.
"""

from typing import List, Dict, Tuple

# Edge format: (cause, effect, sign)
# sign: "+" = increase in cause increases effect
#       "-" = increase in cause decreases effect
CAUSAL_EDGES: List[Tuple[str, str, str]] = [
    ("pump_a_vibration",       "pump_a_health",             "-"),
    ("pump_a_health",          "coolant_flow_rate",          "+"),
    ("coolant_flow_rate",      "outlet_temperature",         "-"),
    ("outlet_temperature",     "loop_pressure",              "+"),
    ("pump_a_health",          "pump_a_temperature",         "-"),
    ("coolant_flow_rate",      "heat_exchanger_efficiency",  "+"),
    ("valve_position",         "coolant_flow_rate",          "+"),
]

# Threshold-based anomaly definitions
# Each entry: variable, direction of concern, threshold value
ANOMALY_THRESHOLDS: Dict[str, Tuple[str, float]] = {
    "pump_a_vibration":       ("above", 2.0),
    "pump_a_health":          ("below", 70.0),
    "coolant_flow_rate":      ("below", 600.0),
    "outlet_temperature":     ("above", 95.0),
    "loop_pressure":          ("above", 4.5),
    "heat_exchanger_efficiency": ("below", 75.0),
}


def get_downstream(variable: str) -> List[str]:
    """Return all variables directly affected by this variable."""
    return [effect for cause, effect, _ in CAUSAL_EDGES if cause == variable]


def get_upstream(variable: str) -> List[str]:
    """Return all variables that directly cause this variable."""
    return [cause for cause, effect, _ in CAUSAL_EDGES if effect == variable]


def get_causal_chain(root: str, depth: int = 4) -> List[str]:
    """
    Traverse the causal graph downstream from root, up to `depth` hops.
    Returns an ordered list of variable names in the chain.
    """
    chain = [root]
    current = root
    for _ in range(depth):
        downstream = get_downstream(current)
        if not downstream:
            break
        current = downstream[0]
        if current in chain:
            break
        chain.append(current)
    return chain
