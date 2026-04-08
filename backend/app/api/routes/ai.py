"""
AI prompt interpretation endpoint stub.

This does NOT call a real LLM. It returns a structured mock response
based on simple keyword matching — a placeholder for future integration.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/ai", tags=["ai"])


class PromptRequest(BaseModel):
    prompt: str


class PromptInterpretation(BaseModel):
    target_variables: List[str]
    direction: str          # "rising" | "falling" | "fluctuating"
    severity: str           # "low" | "medium" | "high"
    suggested_scenario: Optional[str]
    raw_prompt: str
    note: str


KEYWORD_VARIABLE_MAP = {
    "pump": ["pump_a_temperature", "pump_a_vibration", "pump_a_health"],
    "vibration": ["pump_a_vibration"],
    "temperature": ["pump_a_temperature", "outlet_temperature", "inlet_temperature"],
    "pressure": ["loop_pressure"],
    "flow": ["coolant_flow_rate"],
    "valve": ["valve_position"],
    "heat exchanger": ["heat_exchanger_efficiency"],
}

SCENARIO_KEYWORDS = {
    "pump_degradation": ["vibration", "bearing", "pump wear", "pump degradation"],
    "flow_restriction": ["flow", "restriction", "blockage", "clog"],
}


def _extract_variables(prompt: str) -> List[str]:
    lower = prompt.lower()
    variables = []
    for keyword, vars in KEYWORD_VARIABLE_MAP.items():
        if keyword in lower:
            for v in vars:
                if v not in variables:
                    variables.append(v)
    return variables or ["pump_a_temperature"]  # Default fallback


def _extract_direction(prompt: str) -> str:
    lower = prompt.lower()
    if any(w in lower for w in ["rise", "rises", "rising", "increase", "build", "climb"]):
        return "rising"
    if any(w in lower for w in ["fall", "falls", "drop", "decrease", "reduce"]):
        return "falling"
    return "fluctuating"


def _extract_severity(prompt: str) -> str:
    lower = prompt.lower()
    if any(w in lower for w in ["critical", "severe", "rapid", "sudden", "emergency"]):
        return "high"
    if any(w in lower for w in ["gradual", "slowly", "moderate", "mild"]):
        return "low"
    return "medium"


def _suggest_scenario(prompt: str) -> Optional[str]:
    lower = prompt.lower()
    for scenario, keywords in SCENARIO_KEYWORDS.items():
        if any(k in lower for k in keywords):
            return scenario
    return None


@router.post("/interpret", response_model=PromptInterpretation)
def interpret_prompt(req: PromptRequest):
    """
    Stub endpoint: interprets a free-text scenario description
    and returns a structured representation.

    Replace the body of this function with a real LLM call when ready.
    """
    return PromptInterpretation(
        target_variables=_extract_variables(req.prompt),
        direction=_extract_direction(req.prompt),
        severity=_extract_severity(req.prompt),
        suggested_scenario=_suggest_scenario(req.prompt),
        raw_prompt=req.prompt,
        note="This is a stub response. Replace with real LLM integration in app/api/routes/ai.py",
    )
