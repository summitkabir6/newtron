"""
REST API routes for simulation control.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.simulation.engine import engine
from app.ddto.predictor import ddto_engine

router = APIRouter(prefix="/simulate", tags=["simulation"])


class ManualOverrideRequest(BaseModel):
    variable: str
    value: float


@router.post("/scenario/start/{name}")
def start_scenario(name: str):
    success = engine.scenario_manager.start(name)
    if not success:
        raise HTTPException(status_code=404, detail=f"Scenario '{name}' not found")
    return {"status": "started", "scenario": name}


@router.post("/scenario/stop/{name}")
def stop_scenario(name: str):
    success = engine.scenario_manager.stop(name)
    if not success:
        raise HTTPException(status_code=404, detail=f"Scenario '{name}' not found")
    return {"status": "stopped", "scenario": name}


@router.get("/scenarios")
def list_scenarios():
    return engine.scenario_manager.list_all()


@router.post("/reset")
def reset_simulation():
    engine.reset()
    return {"status": "reset"}


@router.post("/override")
def manual_override(req: ManualOverrideRequest):
    success = engine.manual_override(req.variable, req.value)
    if not success:
        raise HTTPException(status_code=400, detail=f"Unknown variable '{req.variable}'")
    return {"status": "updated", "variable": req.variable, "value": req.value}


@router.get("/state")
def get_state():
    return engine.state.to_dict()


@router.post("/pause")
def pause_simulation():
    engine.pause()
    ddto_engine.pause()
    return {"status": "paused"}


@router.post("/resume")
def resume_simulation():
    engine.resume()
    ddto_engine.resume()
    return {"status": "running"}


@router.get("/status")
def simulation_status():
    return {"paused": engine.paused}
