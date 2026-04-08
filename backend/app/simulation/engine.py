"""
Simulation engine: updates plant state on each tick.
Uses a believable causal chain without real reactor physics.

Causal chain:
  pump_a_vibration -> pump_a_health -> coolant_flow_rate
  -> outlet_temperature -> loop_pressure
"""

from app.simulation.state import PlantState
from app.simulation.scenarios import ScenarioManager

# Tick interval in seconds
TICK_INTERVAL = 1.0

# Steady-state target values (the simulation drifts toward these when no scenario is active)
STEADY_STATE = {
    "pump_a_temperature": 72.0,
    "pump_a_vibration": 0.5,
    "pump_a_health": 100.0,
    "coolant_flow_rate": 850.0,
    "inlet_temperature": 45.0,
    "outlet_temperature": 68.0,
    "loop_pressure": 2.4,
    "valve_position": 85.0,
    "heat_exchanger_efficiency": 94.0,
}


class SimulationEngine:
    def __init__(self):
        self.state = PlantState()
        self.scenario_manager = ScenarioManager()
        self.running = False
        self.paused = True   # Starts paused — operator must click Resume
        self._tick_count = 0

    def pause(self):
        self.paused = True

    def resume(self):
        self.paused = False

    def reset(self):
        """Reset plant state and clear all active scenarios."""
        self.state = PlantState()
        self.scenario_manager.clear()
        self._tick_count = 0

    def manual_override(self, variable: str, value: float):
        """Directly set a plant variable by name."""
        if hasattr(self.state, variable):
            setattr(self.state, variable, value)
            self.state.clamp()
            return True
        return False

    def tick(self):
        """Advance simulation by one step."""
        if self.paused:
            return
        self._tick_count += 1
        s = self.state

        # Apply scenario deltas first
        self.scenario_manager.apply(s)

        # --- Causal chain propagation ---

        # High vibration degrades pump health
        if s.pump_a_vibration > 1.0:
            degradation = (s.pump_a_vibration - 1.0) * 0.05
            s.pump_a_health -= degradation

        # Low pump health reduces coolant flow
        health_factor = s.pump_a_health / 100.0
        target_flow = STEADY_STATE["coolant_flow_rate"] * health_factor
        s.coolant_flow_rate += (target_flow - s.coolant_flow_rate) * 0.05

        # Reduced flow raises outlet temperature
        flow_ratio = max(0.1, s.coolant_flow_rate / STEADY_STATE["coolant_flow_rate"])
        target_outlet = STEADY_STATE["outlet_temperature"] + (1.0 - flow_ratio) * 45.0
        s.outlet_temperature += (target_outlet - s.outlet_temperature) * 0.08

        # High outlet temperature raises loop pressure
        temp_excess = max(0.0, s.outlet_temperature - STEADY_STATE["outlet_temperature"])
        target_pressure = STEADY_STATE["loop_pressure"] + temp_excess * 0.04
        s.loop_pressure += (target_pressure - s.loop_pressure) * 0.06

        # Pump temperature correlates with pump health degradation
        target_pump_temp = 72.0 + (100.0 - s.pump_a_health) * 0.8
        s.pump_a_temperature += (target_pump_temp - s.pump_a_temperature) * 0.07

        # Heat exchanger efficiency drops slightly when flow is low
        target_hx = 94.0 * flow_ratio
        s.heat_exchanger_efficiency += (target_hx - s.heat_exchanger_efficiency) * 0.04

        # Gentle mean-reversion on variables not driven by scenarios
        for var in ["inlet_temperature", "valve_position"]:
            current = getattr(s, var)
            target = STEADY_STATE[var]
            setattr(s, var, current + (target - current) * 0.02)

        s.clamp()

    def stop(self):
        self.running = False


# Singleton instance shared across the app
engine = SimulationEngine()
