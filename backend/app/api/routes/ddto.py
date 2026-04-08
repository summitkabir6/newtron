"""
DDTO REST API routes.

Endpoints for operator twin management, scenario control,
and on-demand explanation requests.
"""

import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.ddto.predictor import ddto_engine
from app.ddto.explainer import get_explanation
from app.simulation.engine import engine as sim_engine

router = APIRouter(prefix="/ddto", tags=["ddto"])


class ScenarioRequest(BaseModel):
    operator_id: Optional[str] = None  # None = apply to all
    scenario: Optional[str] = None     # None = clear scenario


@router.get("/operators")
def list_operators():
    """List all operators and their current cognitive states."""
    return ddto_engine.list_operators()


@router.get("/operator/{operator_id}")
def get_operator_snapshot(operator_id: str):
    """Get the latest twin snapshot for one operator."""
    twin = ddto_engine.get_twin(operator_id)
    if not twin:
        raise HTTPException(status_code=404, detail=f"Operator '{operator_id}' not found")
    return twin.tick(
        plant_risk=_current_risk(),
        active_scenarios=sim_engine.scenario_manager.active_names(),
    )


@router.post("/scenario")
def set_scenario(req: ScenarioRequest):
    """
    Set a demo scenario override for one or all operators.
    scenario values: 'fatigue_onset' | 'workload_spike' | 'automation_bias' | null
    """
    valid = {None, "fatigue_onset", "workload_spike", "automation_bias"}
    if req.scenario not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid scenario. Valid: {valid}")

    if req.operator_id:
        ddto_engine.set_scenario(req.operator_id, req.scenario)
        return {"status": "set", "operator_id": req.operator_id, "scenario": req.scenario}
    else:
        ddto_engine.set_scenario_all(req.scenario)
        return {"status": "set_all", "scenario": req.scenario}


@router.post("/reset")
def reset_ddto():
    """Reset all operator twins and shift timers."""
    ddto_engine.reset()
    return {"status": "reset"}


@router.get("/explain/{operator_id}")
async def explain_operator(operator_id: str):
    """
    Request a fresh Claude explanation for one operator.
    This is called on-demand from the frontend.
    """
    twin = ddto_engine.get_twin(operator_id)
    if not twin:
        raise HTTPException(status_code=404, detail=f"Operator '{operator_id}' not found")

    snapshot = twin.tick(
        plant_risk=_current_risk(),
        active_scenarios=sim_engine.scenario_manager.active_names(),
    )

    explanation = await get_explanation(
        snapshot,
        sim_engine.state.to_dict(),
        _current_risk(),
    )

    twin.mark_explanation_sent()

    return {
        "operator_id": operator_id,
        "explanation": explanation,
        "state": snapshot["prediction"]["current_state"],
    }


def _current_risk() -> str:
    """Get current plant risk from the simulation engine."""
    from app.causal.reasoning import explain
    return explain(sim_engine.state).get("risk_level", "low")


@router.get("/data-source")
def get_data_source():
    """
    Report whether real STEW EEG data or synthetic signals are active.
    Frontend uses this to show the data source badge.
    """
    from app.ddto.dataset import get_data_source_info
    return get_data_source_info()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(req: LoginRequest):
    """Authenticate an operator by username and password."""
    from app.ddto.auth import authenticate
    result = authenticate(req.username, req.password)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return result


@router.get("/ccsi")
def get_ccsi():
    """
    Get the current Crew Cognitive State Index.
    Computed from all active operator twins.
    """
    from app.ddto.ccsi import compute_ccsi
    snapshots = ddto_engine.tick_all(
        plant_risk=_current_risk(),
        active_scenarios=sim_engine.scenario_manager.active_names(),
    )
    return compute_ccsi(snapshots, _current_risk())
