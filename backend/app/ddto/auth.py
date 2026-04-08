"""
DDTO Operator Authentication.

Simple credential store for demo login. Each operator has a username,
password, and profile metadata returned on successful authentication.
"""

OPERATOR_CREDENTIALS = {
    "alex.chen": {
        "operator_id": "op_a",
        "name": "Alex Chen",
        "password": "citech2026",
        "role": "Senior Reactor Operator",
        "badge_id": "NOP-441",
    },
    "blair.santos": {
        "operator_id": "op_b",
        "name": "Blair Santos",
        "password": "citech2026",
        "role": "Reactor Operator",
        "badge_id": "NOP-227",
    },
    "casey.morgan": {
        "operator_id": "op_c",
        "name": "Casey Morgan",
        "password": "citech2026",
        "role": "Senior Reactor Operator",
        "badge_id": "NOP-318",
    },
}


def authenticate(username: str, password: str):
    """
    Validate credentials. Returns operator auth dict on success, None on failure.
    """
    creds = OPERATOR_CREDENTIALS.get(username.strip().lower())
    if not creds or creds["password"] != password:
        return None
    return {
        "operator_id": creds["operator_id"],
        "name": creds["name"],
        "username": username,
        "role": creds["role"],
        "badge_id": creds["badge_id"],
    }
