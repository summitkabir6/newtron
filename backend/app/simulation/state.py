"""
Plant state model for the reactor cooling subsystem.
Holds current sensor values and metadata.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Optional


@dataclass
class PlantState:
    # Pump A
    pump_a_temperature: float = 72.0       # Celsius
    pump_a_vibration: float = 0.5          # mm/s RMS
    pump_a_health: float = 100.0           # Percent (0-100)

    # Flow & thermal
    coolant_flow_rate: float = 850.0       # L/min
    inlet_temperature: float = 45.0        # Celsius
    outlet_temperature: float = 68.0       # Celsius

    # Pressure & mechanical
    loop_pressure: float = 2.4             # Bar
    valve_position: float = 85.0           # Percent open

    # Heat exchanger
    heat_exchanger_efficiency: float = 94.0  # Percent

    def to_dict(self) -> dict:
        return asdict(self)

    def clamp(self):
        """Keep all values in physically plausible bounds."""
        self.pump_a_temperature = max(20.0, min(200.0, self.pump_a_temperature))
        self.pump_a_vibration = max(0.0, min(20.0, self.pump_a_vibration))
        self.pump_a_health = max(0.0, min(100.0, self.pump_a_health))
        self.coolant_flow_rate = max(0.0, min(1200.0, self.coolant_flow_rate))
        self.inlet_temperature = max(20.0, min(150.0, self.inlet_temperature))
        self.outlet_temperature = max(20.0, min(200.0, self.outlet_temperature))
        self.loop_pressure = max(0.0, min(10.0, self.loop_pressure))
        self.valve_position = max(0.0, min(100.0, self.valve_position))
        self.heat_exchanger_efficiency = max(0.0, min(100.0, self.heat_exchanger_efficiency))
