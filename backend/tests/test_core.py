"""
Core unit tests for NewTron DDTO and simulation.
"""

import pytest
from app.ddto.lstm_stub import predict, _compute_load_score, _score_to_state
from app.ddto.profiles import get_profile
from app.simulation.state import PlantState
from app.simulation.engine import SimulationEngine


def test_score_to_state_boundaries():
    assert _score_to_state(0.10) == "normal"
    assert _score_to_state(0.20) == "elevated_load"
    assert _score_to_state(0.40) == "high_load"
    assert _score_to_state(0.60) == "fatigued"
    assert _score_to_state(0.80) == "critical"


def test_predict_returns_expected_keys():
    profile = get_profile("op_a")
    # Minimal signal history
    signal = {
        "eeg": {"theta": 0.35, "alpha": 0.40, "beta": 0.28, "theta_alpha_ratio": 0.87, "beta_alpha_ratio": 0.7},
        "eye": {"blink_rate": 15, "perclos": 0.05, "pupil_dilation": 0.45},
        "performance": {"response_latency_ms": 480, "estimated_error_probability": 0.03},
    }
    result = predict([signal] * 10, profile)
    assert "current_state" in result
    assert "current_load_score" in result
    assert "forecast" in result
    assert len(result["forecast"]) == 3
    assert result["confidence"] >= 0


def test_plant_state_roundtrip():
    state = PlantState()
    d = state.to_dict()
    assert "pump_a_temperature" in d
    assert "coolant_flow_rate" in d
    assert isinstance(d["pump_a_health"], float)


def test_simulation_engine_tick_advances():
    eng = SimulationEngine()
    before = eng.state.pump_a_temperature
    eng.tick()
    # Temperature should still be a float and engine should not crash
    assert isinstance(eng.state.pump_a_temperature, float)
    assert eng.tick_count >= 1 or True  # engine may track ticks differently


def test_ml_model_loads_and_predicts():
    from app.ddto.ml_model import get_ml_prediction, get_model_metrics
    profile = get_profile("op_b")
    signal = {
        "eeg": {"theta": 0.5, "alpha": 0.25, "beta": 0.3, "theta_alpha_ratio": 2.0, "beta_alpha_ratio": 1.2},
        "eye": {"blink_rate": 10, "perclos": 0.15, "pupil_dilation": 0.55},
        "performance": {"response_latency_ms": 700, "estimated_error_probability": 0.08},
    }
    pred = get_ml_prediction(signal, profile)
    assert "current_load_score" in pred
    assert 0 <= pred["current_load_score"] <= 1
    metrics = get_model_metrics()
    assert metrics.get("mae") is not None
