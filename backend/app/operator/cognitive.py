"""
Cognitive state inference module.

Uses simple rule-based heuristics — no ML.
Infers one of: normal, tunneling, overwhelmed, automation_bias
"""

from typing import Dict
from app.operator.tracker import OperatorTracker


def infer_cognitive_state(tracker: OperatorTracker, risk_level: str) -> str:
    """
    Rule-based cognitive state inference.

    States:
    - normal:          Operator is engaged and responsive
    - tunneling:       Operator is fixated on one panel, ignoring others
    - overwhelmed:     Too many alerts, low acknowledgment rate
    - automation_bias: Operator always accepts recommendations without manual action
    """
    recent_events = tracker.recent(seconds=120)

    ack_count = tracker.count_recent("acknowledge_alert", seconds=120)
    accept_count = tracker.count_recent("accept_recommendation", seconds=120)
    reject_count = tracker.count_recent("reject_recommendation", seconds=120)
    focus_count = tracker.count_recent("panel_focus", seconds=120)
    override_count = tracker.count_recent("manual_override", seconds=120)
    total_events = len(recent_events)

    # Automation bias: operator only accepts, never manually acts or rejects
    if accept_count >= 3 and reject_count == 0 and override_count == 0:
        return "automation_bias"

    # Overwhelmed: high-risk situation but very few acknowledgments
    if risk_level == "high" and ack_count == 0 and total_events < 2:
        return "overwhelmed"

    # Tunneling: lots of focus on one area, few acknowledgments
    if focus_count >= 5 and ack_count == 0:
        return "tunneling"

    return "normal"


def get_operator_summary(tracker: OperatorTracker, risk_level: str) -> Dict:
    """Full operator state payload for the WebSocket message."""
    cognitive_state = infer_cognitive_state(tracker, risk_level)
    recent = tracker.recent(seconds=60)

    # Summarize recent events without flooding the payload
    recent_summary = [
        {"type": e["event_type"], "detail": e["detail"]}
        for e in recent[-5:]  # Last 5 events
    ]

    return {
        "cognitive_state": cognitive_state,
        "recent_events": recent_summary,
        "total_recent_interactions": len(recent),
    }
