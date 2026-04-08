"""
WebSocket — streams combined plant + DDTO payload every second.

A single background loop advances the plant simulation, runs DDTO tick_all
(LSTM stub + signals for all operators), builds one payload, and broadcasts it
to every connected client. This keeps plant state, predictions, and pushes
aligned on the same 1 Hz cadence.
"""

import asyncio
import json
from typing import List, Optional

from fastapi import WebSocket, WebSocketDisconnect

from app.simulation.engine import engine, TICK_INTERVAL
from app.causal.reasoning import explain
from app.operator.tracker import tracker
from app.operator.cognitive import get_operator_summary
from app.teaming.authority import determine_authority_mode
from app.teaming.recommendations import generate_recommendation
from app.ddto.predictor import ddto_engine
from app.ddto.explainer import get_explanation

_explanation_cache: dict = {}
_last_payload_json: Optional[str] = None
_first_broadcast_done = asyncio.Event()


def build_payload() -> dict:
    state = engine.state
    active_scenarios = engine.scenario_manager.active_names()
    causal = explain(state)
    risk_level = causal["risk_level"]
    operator_summary = get_operator_summary(tracker, risk_level)
    cognitive_state = operator_summary["cognitive_state"]
    authority_mode = determine_authority_mode(risk_level, cognitive_state)
    recommendation = generate_recommendation(state, causal, authority_mode, cognitive_state)

    ddto_snapshots = ddto_engine.tick_all(plant_risk=risk_level, active_scenarios=active_scenarios)
    for op_id, snapshot in ddto_snapshots.items():
        snapshot["claude_explanation"] = _explanation_cache.get(op_id, "Initialising cognitive assessment…")

    return {
        "plant_state": state.to_dict(),
        "active_scenarios": active_scenarios,
        "risk_level": risk_level,
        "causal_explanation": {
            "root_cause": causal["root_cause"],
            "chain": causal["chain"],
            "anomalies": causal["anomalies"],
        },
        "operator_state": operator_summary,
        "authority_mode": authority_mode,
        "recommendation": recommendation,
        "ddto": ddto_snapshots,
        "simulation_paused": engine.paused,
    }


async def _refresh_explanations(risk_level: str):
    for op_id, twin in ddto_engine.twins.items():
        if twin.last_prediction and twin.state_changed:
            snapshot = twin._build_snapshot(twin.last_prediction, twin.latest_signal, True)
            try:
                explanation = await get_explanation(snapshot, engine.state.to_dict(), risk_level)
                _explanation_cache[op_id] = explanation
                twin.mark_explanation_sent()
            except Exception as e:
                print(f"[Explainer] {op_id}: {e}")


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def add(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.append(websocket)

    async def remove(self, websocket: WebSocket) -> None:
        async with self._lock:
            if websocket in self._connections:
                self._connections.remove(websocket)

    async def broadcast_text(self, text: str) -> None:
        async with self._lock:
            recipients = list(self._connections)
        stale: List[WebSocket] = []
        for ws in recipients:
            try:
                await ws.send_text(text)
            except Exception:
                stale.append(ws)
        for ws in stale:
            await self.remove(ws)


connection_manager = ConnectionManager()


async def run_unified_simulation_loop() -> None:
    """Advance plant + DDTO once per TICK_INTERVAL; broadcast to all WebSocket clients."""
    global _last_payload_json, _first_broadcast_done
    engine.running = True
    tick = 0
    try:
        while engine.running:
            engine.tick()
            payload = build_payload()
            _last_payload_json = json.dumps(payload)
            _first_broadcast_done.set()
            await connection_manager.broadcast_text(_last_payload_json)
            if tick % 60 == 0:
                asyncio.create_task(_refresh_explanations(payload.get("risk_level", "low")))
            tick += 1
            await asyncio.sleep(TICK_INTERVAL)
    finally:
        _last_payload_json = None
        _first_broadcast_done = asyncio.Event()


async def websocket_handler(websocket: WebSocket) -> None:
    await websocket.accept()
    await connection_manager.add(websocket)
    try:
        if _last_payload_json is None:
            try:
                await asyncio.wait_for(_first_broadcast_done.wait(), timeout=10.0)
            except asyncio.TimeoutError:
                pass
        initial = _last_payload_json or json.dumps(build_payload())
        await websocket.send_text(initial)
        while True:
            await websocket.receive()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WebSocket] Error: {e}")
        try:
            await websocket.close()
        except Exception:
            pass
    finally:
        await connection_manager.remove(websocket)
