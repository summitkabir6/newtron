"""
Teaming authority module.

Determines the system's authority mode based on plant risk and operator cognitive state.

Modes:
- QUIET:     Low risk, operator appears normal. System observes silently.
- ADVISORY:  Moderate risk or operator shows early signs of degraded state.
             System offers recommendations but doesn't push hard.
- ASSERTIVE: High risk or operator is overwhelmed/tunneling.
             System surfaces recommendations prominently and may escalate.
"""


def determine_authority_mode(risk_level: str, cognitive_state: str) -> str:
    """
    Decision matrix for authority mode.
    """
    # High plant risk always escalates
    if risk_level == "high":
        return "ASSERTIVE"

    # Operator impairment escalates regardless of plant state
    if cognitive_state in ("overwhelmed", "tunneling"):
        return "ASSERTIVE"

    # Medium risk with normal or automation_bias operator
    if risk_level == "medium":
        if cognitive_state == "automation_bias":
            # Gently prompt the operator to exercise judgment
            return "ADVISORY"
        return "ADVISORY"

    # Low risk, normal operator
    return "QUIET"
