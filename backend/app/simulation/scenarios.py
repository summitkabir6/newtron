"""
Scenario definitions for the reactor cooling subsystem.

Each scenario applies a gradual delta to plant state variables per tick.
Scenarios are designed to be realistic enough to demo the causal chain.
"""

from typing import Dict, List
from app.simulation.state import PlantState


class Scenario:
    def __init__(self, name: str, description: str, deltas: Dict[str, float]):
        self.name = name
        self.description = description
        # deltas: variable_name -> change per tick
        self.deltas = deltas
        self.active = False
        self.ticks_active = 0

    def apply(self, state: PlantState):
        if not self.active:
            return
        self.ticks_active += 1
        for var, delta in self.deltas.items():
            if hasattr(state, var):
                current = getattr(state, var)
                setattr(state, var, current + delta)


# --- Predefined scenarios ---

PUMP_DEGRADATION = Scenario(
    name="pump_degradation",
    description="Pump A bearing wear causing increasing vibration",
    deltas={
        "pump_a_vibration": +0.08,   # Vibration climbs steadily
        "pump_a_temperature": +0.3,   # Pump runs hotter
    },
)

FLOW_RESTRICTION = Scenario(
    name="flow_restriction",
    description="Partial blockage in coolant loop restricting flow",
    deltas={
        "coolant_flow_rate": -4.0,    # Flow slowly drops
        "loop_pressure": +0.02,       # Back-pressure builds upstream
        "valve_position": -0.1,       # Valve gradually closing effect
    },
)

ALL_SCENARIOS: Dict[str, Scenario] = {
    "pump_degradation": PUMP_DEGRADATION,
    "flow_restriction": FLOW_RESTRICTION,
}


class ScenarioManager:
    def __init__(self):
        # Create fresh scenario instances
        self._scenarios: Dict[str, Scenario] = {
            k: Scenario(v.name, v.description, dict(v.deltas))
            for k, v in ALL_SCENARIOS.items()
        }

    def start(self, name: str) -> bool:
        if name in self._scenarios:
            self._scenarios[name].active = True
            return True
        return False

    def stop(self, name: str) -> bool:
        if name in self._scenarios:
            self._scenarios[name].active = False
            return True
        return False

    def clear(self):
        """Deactivate all scenarios and reset tick counters."""
        for s in self._scenarios.values():
            s.active = False
            s.ticks_active = 0

    def apply(self, state: PlantState):
        for s in self._scenarios.values():
            s.apply(state)

    def active_names(self) -> List[str]:
        return [s.name for s in self._scenarios.values() if s.active]

    def list_all(self) -> List[dict]:
        return [
            {
                "name": s.name,
                "description": s.description,
                "active": s.active,
                "ticks_active": s.ticks_active,
            }
            for s in self._scenarios.values()
        ]
