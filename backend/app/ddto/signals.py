"""
Biometric Signal Simulator.

Generates realistic EEG band power and eye tracking signals for each operator.
Signals are grounded in real published ranges from the literature cited in the
NewTron PDF (Choi et al. 2018, Pakarinen et al. 2018, Dai et al. 2023).

Signal behaviour:
- Follows the operator's personal baseline with realistic noise
- Drifts based on hours into shift (fatigue accumulation)
- Responds to active plant scenarios (elevated plant risk = elevated cognitive load)
- Each operator profile has distinct drift characteristics

In a real deployment, this module is replaced by the CognShield hardware stream.
The interface (output dict shape) stays identical.
"""

import math
import random
import time
from typing import Dict, Optional
from app.ddto.profiles import OperatorProfile


def _noise(scale: float = 0.01) -> float:
    """Gaussian noise."""
    return random.gauss(0, scale)


def _fatigue_factor(profile: OperatorProfile) -> float:
    """
    Returns a 0–1 fatigue multiplier based on hours into shift.
    At hour 0: 0.0 (no fatigue)
    At hour 8: approaches 1.0 for high fatigue_rate operators
    """
    hours = min(profile.hours_into_shift(), 12.0)
    # Sigmoid-shaped fatigue curve — accelerates after hour 4
    raw = 1.0 / (1.0 + math.exp(-0.8 * (hours - 4.5)))
    return raw * profile.fatigue_rate


def _plant_load_factor(plant_risk: str) -> float:
    """Plant risk level adds cognitive load."""
    return {"low": 0.0, "medium": 0.15, "high": 0.35}.get(plant_risk, 0.0)


def _scenario_load(active_scenarios: list) -> float:
    """Active scenarios add additional cognitive demand."""
    return min(0.3, len(active_scenarios) * 0.15)


def generate_signal(
    profile: OperatorProfile,
    plant_risk: str = "low",
    active_scenarios: Optional[list] = None,
    scenario_override: Optional[str] = None,
) -> Dict:
    """
    Generate one signal sample for the given operator.

    Returns a dict matching the CognShield hardware output format.

    EEG values are normalized band powers (0–1 scale).
    Eye metrics are in natural units per the literature.
    """
    if active_scenarios is None:
        active_scenarios = []

    b = profile.baseline
    fatigue = _fatigue_factor(profile)
    plant_load = _plant_load_factor(plant_risk)
    scenario_load = _scenario_load(active_scenarios)
    total_load = fatigue + plant_load + scenario_load

    # ── Demo scenario overrides ─────────────────────────────────────────────
    # These allow the Simulation Console to trigger dramatic visible changes
    if scenario_override == "fatigue_onset":
        fatigue = min(1.0, fatigue + 0.5)
        total_load = min(1.2, total_load + 0.5)
    elif scenario_override == "workload_spike":
        total_load = min(1.2, total_load + 0.6)
        plant_load = min(0.6, plant_load + 0.4)
    elif scenario_override == "automation_bias":
        # Suppress active engagement — alpha stays high (passive), beta drops
        total_load = max(0.0, total_load - 0.2)

    # ── EEG Band Powers ─────────────────────────────────────────────────────
    # Theta (4-8 Hz): rises with workload and fatigue
    theta = b.theta_baseline + (total_load * 0.25) + _noise(0.015)

    # Alpha (8-13 Hz): drops under cognitive load (inverse relationship)
    alpha = b.alpha_baseline - (total_load * 0.18) + _noise(0.012)

    # Beta (13-30 Hz): rises with active concentration, drops with fatigue
    beta_boost = max(0.0, plant_load * 0.15 - fatigue * 0.12)
    beta = b.beta_baseline + beta_boost + _noise(0.01)

    # Clamp to plausible range
    theta = max(0.1, min(0.95, theta))
    alpha = max(0.05, min(0.90, alpha))
    beta = max(0.05, min(0.85, beta))

    # Derived ratios — key cognitive load indices from literature
    theta_alpha_ratio = theta / max(alpha, 0.01)
    beta_alpha_ratio = beta / max(alpha, 0.01)
    engagement_index = beta / max(theta + alpha, 0.01)  # Pope et al. index

    # ── Eye Tracking ────────────────────────────────────────────────────────
    # Blink rate: decreases under high cognitive load (cognitive tunnel)
    blink_rate = b.blink_rate_baseline - (total_load * 8.0) + _noise(1.5)
    blink_rate = max(2.0, min(35.0, blink_rate))

    # PERCLOS: rises with fatigue (% of time eyes >80% closed)
    perclos = b.perclos_baseline + (fatigue * 0.35) + _noise(0.02)
    perclos = max(0.0, min(1.0, perclos))

    # Pupil dilation: rises with cognitive effort and arousal
    pupil = b.pupil_dilation_baseline + (total_load * 0.18) + _noise(0.02)
    pupil = max(0.1, min(0.95, pupil))

    # ── Performance Proxy Metrics ────────────────────────────────────────────
    # Response latency increases with fatigue and overload
    latency = b.response_latency_baseline + (total_load * 280.0) + _noise(25.0)
    latency = max(200.0, min(2000.0, latency))

    # Estimated error probability: baseline + fatigue + load effects
    error_prob = b.error_rate_baseline / 10.0  # Convert to probability
    error_prob += fatigue * 0.15 + plant_load * 0.08
    error_prob = max(0.01, min(0.95, error_prob))

    return {
        "timestamp": time.time(),
        "operator_id": profile.operator_id,

        # EEG bands
        "eeg": {
            "theta": round(theta, 4),
            "alpha": round(alpha, 4),
            "beta": round(beta, 4),
            "theta_alpha_ratio": round(theta_alpha_ratio, 4),
            "beta_alpha_ratio": round(beta_alpha_ratio, 4),
            "engagement_index": round(engagement_index, 4),
        },

        # Eye tracking
        "eye": {
            "blink_rate": round(blink_rate, 2),
            "perclos": round(perclos, 4),
            "pupil_dilation": round(pupil, 4),
        },

        # Performance proxies
        "performance": {
            "response_latency_ms": round(latency, 1),
            "estimated_error_probability": round(error_prob, 4),
        },

        # Context injected into signal
        "_context": {
            "fatigue_factor": round(fatigue, 4),
            "plant_load_factor": round(plant_load, 4),
            "total_load": round(min(total_load, 1.2), 4),
            "hours_into_shift": round(profile.hours_into_shift(), 2),
        },
    }
