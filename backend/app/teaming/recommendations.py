"""
Recommendation generation module.

Produces a plain-language recommendation based on current plant state,
causal explanation, authority mode, and operator cognitive state.
"""

from app.simulation.state import PlantState


def generate_recommendation(
    plant_state: PlantState,
    causal: dict,
    authority_mode: str,
    cognitive_state: str,
) -> str:
    """
    Rule-based recommendation text.
    Returns an empty string if QUIET and no anomalies.
    """
    risk = causal.get("risk_level", "low")
    root_cause = causal.get("root_cause", "")
    chain = causal.get("chain", [])
    s = plant_state.to_dict()

    if authority_mode == "QUIET" and risk == "low":
        return "All systems nominal. No action required."

    parts = []

    # Root cause advice
    if "pump a vibration" in root_cause:
        parts.append("Pump A vibration is elevated — inspect bearing condition.")
    elif "coolant flow" in root_cause:
        parts.append("Coolant flow restriction detected — check valve position and loop for blockages.")
    elif "outlet temperature" in root_cause:
        parts.append("Outlet temperature rising — verify heat exchanger performance.")
    elif "loop pressure" in root_cause:
        parts.append("Loop pressure above normal — reduce thermal load or increase flow.")
    elif root_cause == "No anomalies detected":
        parts.append("No anomalies detected. Monitor system for developing trends.")

    # Specific variable warnings
    if s["pump_a_health"] < 60:
        parts.append(f"Pump A health at {s['pump_a_health']:.0f}% — consider reducing load.")
    if s["outlet_temperature"] > 90:
        parts.append(f"Outlet temperature {s['outlet_temperature']:.1f}°C — approaching limit.")
    if s["loop_pressure"] > 4.0:
        parts.append(f"Loop pressure {s['loop_pressure']:.2f} bar — monitor closely.")

    # Cognitive state adaptation
    if cognitive_state == "automation_bias":
        parts.append("Note: Please verify recommendation manually before accepting.")
    elif cognitive_state == "overwhelmed":
        parts.append("Priority: focus on pump and flow parameters first.")
    elif cognitive_state == "tunneling":
        parts.append("Reminder: check all subsystem panels, not only current focus area.")

    # Authority mode framing
    if authority_mode == "ASSERTIVE" and risk == "high":
        prefix = "⚠ ASSERTIVE: "
    elif authority_mode == "ADVISORY":
        prefix = "Advisory: "
    else:
        prefix = ""

    if not parts:
        return f"{prefix}System nominal. Continue monitoring."

    return prefix + " ".join(parts)
