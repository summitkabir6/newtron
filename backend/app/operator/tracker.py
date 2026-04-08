"""
Operator interaction tracker.

Records operator events in memory for use by the cognitive state inference module.
"""

import time
from typing import List, Dict
from collections import deque

# Keep a rolling window of the last N events
MAX_EVENTS = 50

VALID_EVENT_TYPES = {
    "panel_focus",
    "acknowledge_alert",
    "accept_recommendation",
    "reject_recommendation",
    "manual_override",
}


class OperatorTracker:
    def __init__(self):
        self._events: deque = deque(maxlen=MAX_EVENTS)

    def record(self, event_type: str, detail: str = "") -> bool:
        """Record an operator interaction event. Returns False if event type is unknown."""
        if event_type not in VALID_EVENT_TYPES:
            return False
        self._events.append({
            "event_type": event_type,
            "detail": detail,
            "timestamp": time.time(),
        })
        return True

    def recent(self, seconds: float = 60.0) -> List[Dict]:
        """Return events from the last N seconds."""
        cutoff = time.time() - seconds
        return [e for e in self._events if e["timestamp"] >= cutoff]

    def all_events(self) -> List[Dict]:
        return list(self._events)

    def count_recent(self, event_type: str, seconds: float = 60.0) -> int:
        return sum(
            1 for e in self.recent(seconds)
            if e["event_type"] == event_type
        )

    def reset(self):
        self._events.clear()


# Singleton
tracker = OperatorTracker()
