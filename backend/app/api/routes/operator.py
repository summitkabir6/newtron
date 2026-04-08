"""
REST API routes for recording operator interaction events.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.operator.tracker import tracker

router = APIRouter(prefix="/operator", tags=["operator"])


class OperatorEventRequest(BaseModel):
    event_type: str
    detail: Optional[str] = ""


@router.post("/event")
def record_event(req: OperatorEventRequest):
    success = tracker.record(req.event_type, req.detail or "")
    if not success:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown event type '{req.event_type}'. "
                   f"Valid types: panel_focus, acknowledge_alert, accept_recommendation, "
                   f"reject_recommendation, manual_override"
        )
    return {"status": "recorded", "event_type": req.event_type}


@router.get("/events")
def get_events():
    return {"events": tracker.all_events()}


@router.post("/reset")
def reset_tracker():
    tracker.reset()
    return {"status": "reset"}
