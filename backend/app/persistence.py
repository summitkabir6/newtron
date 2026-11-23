"""
SQLite persistence layer for NewTron historical data.

Stores plant states, DDTO snapshots, predictions, and explanations
so the system can support playback, reports, and trend analysis.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
import json

from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker, Session

DATABASE_URL = "sqlite:///./newtron_history.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class PlantTick(Base):
    __tablename__ = "plant_ticks"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    plant_state_json = Column(Text)  # JSON string of plant variables
    risk_level = Column(String)
    active_scenarios_json = Column(Text)
    causal_root_cause = Column(String)
    simulation_paused = Column(Boolean, default=False)


class OperatorSnapshot(Base):
    __tablename__ = "operator_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    operator_id = Column(String, index=True)
    name = Column(String)
    hours_into_shift = Column(Float)
    current_state = Column(String)
    current_load_score = Column(Float)
    trend = Column(String)
    confidence = Column(Float)
    data_source = Column(String)
    signals_json = Column(Text)          # EEG, eye, performance
    prediction_json = Column(Text)       # full prediction including forecast
    claude_explanation = Column(Text)
    scenario_override = Column(String)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def save_tick(
    plant_state: dict,
    risk_level: str,
    active_scenarios: list,
    causal_root_cause: str,
    simulation_paused: bool,
    ddto_snapshots: dict,
) -> None:
    """Persist one full simulation tick (plant + all operators)."""
    db = SessionLocal()
    try:
        plant_tick = PlantTick(
            plant_state_json=json.dumps(plant_state),
            risk_level=risk_level,
            active_scenarios_json=json.dumps(active_scenarios),
            causal_root_cause=causal_root_cause,
            simulation_paused=simulation_paused,
        )
        db.add(plant_tick)

        for op_id, snap in ddto_snapshots.items():
            pred = snap.get("prediction", {})
            db.add(OperatorSnapshot(
                operator_id=op_id,
                name=snap.get("name"),
                hours_into_shift=snap.get("hours_into_shift"),
                current_state=pred.get("current_state"),
                current_load_score=pred.get("current_load_score"),
                trend=pred.get("trend"),
                confidence=pred.get("confidence"),
                data_source=snap.get("data_source"),
                signals_json=json.dumps(snap.get("signals", {})),
                prediction_json=json.dumps(pred),
                claude_explanation=snap.get("claude_explanation", ""),
                scenario_override=snap.get("scenario_override"),
            ))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Persistence] save_tick error: {e}")
    finally:
        db.close()


def get_recent_history(
    operator_id: Optional[str] = None,
    limit: int = 300,
) -> List[Dict[str, Any]]:
    """Return recent operator snapshots (newest first)."""
    db = SessionLocal()
    try:
        q = db.query(OperatorSnapshot).order_by(OperatorSnapshot.timestamp.desc())
        if operator_id:
            q = q.filter(OperatorSnapshot.operator_id == operator_id)
        rows = q.limit(limit).all()
        result = []
        for r in rows:
            result.append({
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "operator_id": r.operator_id,
                "name": r.name,
                "hours_into_shift": r.hours_into_shift,
                "current_state": r.current_state,
                "current_load_score": r.current_load_score,
                "trend": r.trend,
                "confidence": r.confidence,
                "data_source": r.data_source,
                "signals": json.loads(r.signals_json) if r.signals_json else {},
                "prediction": json.loads(r.prediction_json) if r.prediction_json else {},
                "claude_explanation": r.claude_explanation,
                "scenario_override": r.scenario_override,
            })
        return result
    finally:
        db.close()


def get_plant_history(limit: int = 200) -> List[Dict[str, Any]]:
    db = SessionLocal()
    try:
        rows = db.query(PlantTick).order_by(PlantTick.timestamp.desc()).limit(limit).all()
        return [
            {
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "plant_state": json.loads(r.plant_state_json) if r.plant_state_json else {},
                "risk_level": r.risk_level,
                "active_scenarios": json.loads(r.active_scenarios_json) if r.active_scenarios_json else [],
                "causal_root_cause": r.causal_root_cause,
                "simulation_paused": r.simulation_paused,
            }
            for r in rows
        ]
    finally:
        db.close()
