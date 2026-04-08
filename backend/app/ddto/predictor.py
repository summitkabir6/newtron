"""
DDTO Predictor — Core Orchestration Engine.

This is the heart of the Dynamic Digital Twin of the Operator.
It maintains live state for all operators simultaneously, runs the
prediction pipeline every tick, and produces the full DDTO payload.

One DDTOPredictor instance per operator runs continuously:
  1. Receives new signal sample
  2. Adds to rolling history window
  3. Updates personal baseline (slow drift — the twin "learns" the operator)
  4. Runs LSTM-stub prediction
  5. Detects state transitions (for triggering Claude explanations)
  6. Returns full operator twin snapshot
"""

import time
from typing import Dict, List, Optional
from collections import deque

from app.ddto.profiles import get_profiles, get_profile, OperatorProfile
from app.ddto.dataset import get_signal, get_data_source_info
from app.ddto.lstm_stub import predict


# Rolling history: 5 minutes at 1 sample/second = 300 samples
HISTORY_WINDOW = 300

# How often to request a new Claude explanation (seconds)
# Don't call Claude every tick — expensive and unnecessary
EXPLANATION_INTERVAL = 60.0


class OperatorTwin:
    """
    Live digital twin for one operator.
    Maintains signal history, runs predictions, tracks state transitions.
    """

    def __init__(self, profile: OperatorProfile):
        self.profile = profile
        self.signal_history: deque = deque(maxlen=HISTORY_WINDOW)
        self.last_prediction: Dict = {}
        self.last_state: str = "normal"
        self.state_changed: bool = False
        self.last_explanation_time: float = 0.0
        self.scenario_override: Optional[str] = None

        # Smoothed signal for display (last sample)
        self.latest_signal: Dict = {}

    def tick(self, plant_risk: str = "low", active_scenarios: List[str] = None) -> Dict:
        """
        Advance the twin by one tick.
        Generates a new signal, runs prediction, returns full snapshot.
        """
        if active_scenarios is None:
            active_scenarios = []

        # Generate biometric signal
        signal = get_signal(
            self.profile,
            plant_risk=plant_risk,
            active_scenarios=active_scenarios,
            scenario_override=self.scenario_override,
        )
        self.latest_signal = signal
        self.signal_history.append(signal)

        # Run prediction on history
        prediction = predict(list(self.signal_history), self.profile)

        # Detect state transition
        new_state = prediction["current_state"]
        self.state_changed = (new_state != self.last_state)
        self.last_state = new_state
        self.last_prediction = prediction

        # Decide if Claude explanation should be refreshed
        needs_explanation = (
            self.state_changed or
            (time.time() - self.last_explanation_time) > EXPLANATION_INTERVAL
        )

        return self._build_snapshot(prediction, signal, needs_explanation)

    def _build_snapshot(self, prediction: Dict, signal: Dict, needs_explanation: bool) -> Dict:
        """Build the full twin snapshot for the WebSocket payload."""
        return {
            "operator_id": self.profile.operator_id,
            "name": self.profile.name,
            "experience_years": self.profile.experience_years,
            "hours_into_shift": round(self.profile.hours_into_shift(), 2),

            # Live biometric signals
            "signals": {
                "eeg": signal.get("eeg", {}),
                "eye": signal.get("eye", {}),
                "performance": signal.get("performance", {}),
            },

            # Prediction engine output
            "prediction": prediction,

            # State transition flag (used by explainer)
            "state_changed": self.state_changed,
            "needs_explanation": needs_explanation,

            # Profile summary
            "profile": {
                "fatigue_rate": self.profile.fatigue_rate,
                "automation_bias_tendency": self.profile.automation_bias_tendency,
            },

            # Active demo scenario
            "scenario_override": self.scenario_override,

            # Data source: 'stew_real' or 'synthetic'
            "data_source": signal.get("_data_source", "synthetic"),
        }

    def set_scenario(self, scenario: Optional[str]):
        self.scenario_override = scenario

    def mark_explanation_sent(self):
        self.last_explanation_time = time.time()


class DDTOEngine:
    """
    Manages all operator twins simultaneously.
    Called once per tick from the unified WebSocket simulation loop (after plant tick).
    """

    def __init__(self):
        self.twins: Dict[str, OperatorTwin] = {}
        self.paused: bool = True          # Starts paused — operator must click Resume
        self._last_snapshots: Dict[str, Dict] = {}
        self._init_twins()

    def pause(self):
        self.paused = True

    def resume(self):
        self.paused = False

    def _init_twins(self):
        profiles = get_profiles()
        for op_id, profile in profiles.items():
            self.twins[op_id] = OperatorTwin(profile)

    def tick_all(self, plant_risk: str = "low", active_scenarios: List[str] = None) -> Dict[str, Dict]:
        """Tick all operator twins and return snapshots keyed by operator_id.
        When paused, returns the last known snapshots (frozen display).
        On the very first call with no cached data, always runs one tick to
        populate an initial display state regardless of pause flag.
        """
        if self.paused and self._last_snapshots:
            return self._last_snapshots
        if active_scenarios is None:
            active_scenarios = []
        snapshots = {
            op_id: twin.tick(plant_risk, active_scenarios)
            for op_id, twin in self.twins.items()
        }
        self._last_snapshots = snapshots
        return snapshots

    def tick_one(self, operator_id: str, plant_risk: str = "low", active_scenarios: List[str] = None) -> Optional[Dict]:
        if self.paused:
            return self._last_snapshots.get(operator_id)
        twin = self.twins.get(operator_id)
        if not twin:
            return None
        snapshot = twin.tick(plant_risk, active_scenarios or [])
        self._last_snapshots[operator_id] = snapshot
        return snapshot

    def set_scenario(self, operator_id: str, scenario: Optional[str]):
        twin = self.twins.get(operator_id)
        if twin:
            twin.set_scenario(scenario)

    def set_scenario_all(self, scenario: Optional[str]):
        for twin in self.twins.values():
            twin.set_scenario(scenario)

    def get_twin(self, operator_id: str) -> Optional[OperatorTwin]:
        return self.twins.get(operator_id)

    def reset(self):
        from app.ddto.profiles import reset_profiles
        reset_profiles()
        self._init_twins()

    def list_operators(self) -> List[Dict]:
        return [
            {
                "operator_id": op_id,
                "name": twin.profile.name,
                "experience_years": twin.profile.experience_years,
                "current_state": twin.last_state,
            }
            for op_id, twin in self.twins.items()
        ]


# Singleton
ddto_engine = DDTOEngine()
