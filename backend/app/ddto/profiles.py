"""
Operator Profile Store.

Each operator has a personal cognitive baseline — their "normal" state.
All DDTO predictions are measured as deviation from this individual baseline,
not against a generic population threshold.

This is what makes it a Digital Twin, not just a monitor.
"""

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional
import time


@dataclass
class CognitiveBaseline:
    """Personal cognitive baseline for one operator."""
    # EEG band power baselines (microvolts squared, normalized)
    theta_baseline: float     # 4-8 Hz — workload / memory load
    alpha_baseline: float     # 8-13 Hz — relaxed alertness (drops under load)
    beta_baseline: float      # 13-30 Hz — active concentration

    # Derived ratios
    theta_alpha_ratio: float  # Key workload index
    beta_alpha_ratio: float   # Arousal index

    # Eye metric baselines
    blink_rate_baseline: float      # blinks/min (normal ~15-20)
    perclos_baseline: float         # % eye closure (normal <0.15)
    pupil_dilation_baseline: float  # normalized 0-1

    # Performance baselines
    response_latency_baseline: float  # ms
    error_rate_baseline: float        # errors per hour


@dataclass
class OperatorProfile:
    """Full operator profile including baseline and historical state."""
    operator_id: str
    name: str
    experience_years: int
    shift_start_time: float = field(default_factory=time.time)

    # Personal baseline (calibrated from historical data)
    baseline: Optional[CognitiveBaseline] = None

    # Fatigue accumulation rate — how quickly this operator degrades
    # 1.0 = average, >1.0 = fatigues faster, <1.0 = more resilient
    fatigue_rate: float = 1.0

    # Automation bias tendency (0-1)
    automation_bias_tendency: float = 0.3

    # Historical cognitive state snapshots (rolling window)
    history: List[Dict] = field(default_factory=list)

    def hours_into_shift(self) -> float:
        return (time.time() - self.shift_start_time) / 3600.0

    def add_history(self, snapshot: Dict):
        self.history.append(snapshot)
        if len(self.history) > 300:  # Keep last 5 minutes at 1s intervals
            self.history.pop(0)

    def to_dict(self) -> Dict:
        d = asdict(self)
        d['hours_into_shift'] = self.hours_into_shift()
        return d


# ── Three operator profiles ────────────────────────────────────────────────

def create_operator_profiles() -> Dict[str, OperatorProfile]:
    """
    Three distinct operators with different cognitive signatures.

    Operator A — Alex Chen: Stable, experienced. Consistent performer.
    Operator B — Blair Santos: Fatigues progressively. Strong start, degrades by hour 4.
    Operator C — Casey Morgan: High performer but strong automation bias tendency.
    """

    profiles = {
        "op_a": OperatorProfile(
            operator_id="op_a",
            name="Alex Chen",
            experience_years=12,
            fatigue_rate=0.6,           # Resilient — fatigues slowly
            automation_bias_tendency=0.2,
            baseline=CognitiveBaseline(
                theta_baseline=0.38,
                alpha_baseline=0.45,
                beta_baseline=0.31,
                theta_alpha_ratio=0.84,
                beta_alpha_ratio=0.69,
                blink_rate_baseline=17.0,
                perclos_baseline=0.08,
                pupil_dilation_baseline=0.42,
                response_latency_baseline=420.0,
                error_rate_baseline=0.4,
            ),
        ),

        "op_b": OperatorProfile(
            operator_id="op_b",
            name="Blair Santos",
            experience_years=4,
            fatigue_rate=1.8,           # Fatigues quickly
            automation_bias_tendency=0.35,
            baseline=CognitiveBaseline(
                theta_baseline=0.42,
                alpha_baseline=0.40,
                beta_baseline=0.28,
                theta_alpha_ratio=1.05,
                beta_alpha_ratio=0.70,
                blink_rate_baseline=19.0,
                perclos_baseline=0.12,
                pupil_dilation_baseline=0.38,
                response_latency_baseline=510.0,
                error_rate_baseline=0.9,
            ),
        ),

        "op_c": OperatorProfile(
            operator_id="op_c",
            name="Casey Morgan",
            experience_years=8,
            fatigue_rate=0.8,           # Moderately resilient
            automation_bias_tendency=0.75,  # Strong automation bias
            baseline=CognitiveBaseline(
                theta_baseline=0.35,
                alpha_baseline=0.48,
                beta_baseline=0.34,
                theta_alpha_ratio=0.73,
                beta_alpha_ratio=0.71,
                blink_rate_baseline=15.0,
                perclos_baseline=0.07,
                pupil_dilation_baseline=0.45,
                response_latency_baseline=390.0,
                error_rate_baseline=0.3,
            ),
        ),
    }

    return profiles


# Singleton profile store
_profiles: Optional[Dict[str, OperatorProfile]] = None


def get_profiles() -> Dict[str, OperatorProfile]:
    global _profiles
    if _profiles is None:
        _profiles = create_operator_profiles()
    return _profiles


def get_profile(operator_id: str) -> Optional[OperatorProfile]:
    return get_profiles().get(operator_id)


def reset_profiles():
    """Reset all profiles and shift timers."""
    global _profiles
    _profiles = create_operator_profiles()
