"""
Claude-Powered Explanation Engine.

This is the LLM layer of the DDTO. Instead of red warning lights,
the operator receives plain English guidance tailored to their specific
cognitive state, personal baseline, and current plant conditions.

Uses the Anthropic API (claude-sonnet-4-6).
Falls back to rule-based explanations if API is unavailable.

Rate limiting: Claude is only called when state changes or every 15 seconds
to avoid unnecessary API costs during a live demo.
"""

import os
import json
import httpx
from typing import Dict, Optional

# Load API key from environment
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = "claude-sonnet-4-6"
API_URL = "https://api.anthropic.com/v1/messages"


def _build_prompt(snapshot: Dict, plant_state: Dict, plant_risk: str) -> str:
    """Build the prompt sent to Claude for operator guidance."""
    op = snapshot
    pred = op.get("prediction", {})
    signals = op.get("signals", {})
    eeg = signals.get("eeg", {})
    eye = signals.get("eye", {})
    perf = signals.get("performance", {})
    forecast = pred.get("forecast", [])

    forecast_text = " | ".join(
        f"+{f['minutes_ahead']}min: {f['predicted_state'].replace('_', ' ')} ({f['load_score']:.2f})"
        for f in forecast
    )

    return f"""You are the cognitive safety AI for a nuclear power plant control room.
You are monitoring operator {op['name']} ({op['experience_years']} years experience, {op['hours_into_shift']:.1f} hours into shift).

CURRENT COGNITIVE STATE: {pred.get('current_state', 'unknown').replace('_', ' ').upper()}
Load Score: {pred.get('current_load_score', 0):.2f} / 1.0 (deviation from personal baseline)
Trend: {pred.get('trend', 'stable')}
Confidence: {pred.get('confidence', 0):.0%}

BIOMETRIC SIGNALS:
- EEG Theta (workload): {eeg.get('theta', 0):.3f} | Alpha (alertness): {eeg.get('alpha', 0):.3f} | Beta (concentration): {eeg.get('beta', 0):.3f}
- Theta/Alpha ratio: {eeg.get('theta_alpha_ratio', 0):.3f} (elevated = high workload)
- Blink rate: {eye.get('blink_rate', 0):.1f}/min | PERCLOS: {eye.get('perclos', 0):.2%} | Pupil dilation: {eye.get('pupil_dilation', 0):.3f}
- Response latency: {perf.get('response_latency_ms', 0):.0f}ms | Error probability: {perf.get('estimated_error_probability', 0):.1%}

15-MINUTE FORECAST: {forecast_text}
Peak risk: {pred.get('peak_risk_window', 'none')}

PLANT CONDITIONS:
- Risk level: {plant_risk.upper()}
- Active scenarios: {', '.join(snapshot.get('active_scenarios_context', [])) or 'none'}

Operator profile notes:
- Fatigue rate: {'high — fatigues faster than average' if op.get('profile', {}).get('fatigue_rate', 1) > 1.2 else 'normal' if op.get('profile', {}).get('fatigue_rate', 1) < 0.8 else 'low — resilient performer'}
- Automation bias tendency: {'high — tends to over-rely on system recommendations' if op.get('profile', {}).get('automation_bias_tendency', 0) > 0.6 else 'normal'}

Respond in exactly 2 sentences. Maximum 40 words total. Be direct and specific.
Write a cognitive status assessment for the control room supervisor.
Use plain English. No bullet points. Do not use the word "I".
Do not be overly alarming unless the situation warrants it. Focus on what matters most right now."""


def _fallback_explanation(snapshot: Dict) -> str:
    """Rule-based fallback if Claude API is unavailable."""
    pred = snapshot.get("prediction", {})
    state = pred.get("current_state", "normal")
    trend = pred.get("trend", "stable")
    name = snapshot.get("name", "Operator")
    hours = snapshot.get("hours_into_shift", 0)
    forecast = pred.get("forecast", [])

    peak_future = max(forecast, key=lambda x: x["load_score"]) if forecast else None

    if state == "normal" and trend == "stable":
        return f"{name} is performing within normal cognitive parameters after {hours:.1f} hours on shift. No intervention required."

    if state == "elevated_load":
        base = f"{name} shows elevated cognitive load — workload markers above personal baseline."
        if trend == "degrading":
            base += " Trend is worsening. Monitor closely."
        return base

    if state == "high_load":
        msg = f"{name} is under significant cognitive load after {hours:.1f} hours. Error probability is elevated above baseline."
        if peak_future and peak_future["load_score"] > 0.6:
            msg += f" Forecast suggests peak stress at +{peak_future['minutes_ahead']} minutes — consider crew support."
        return msg

    if state == "fatigued":
        return f"{name} is showing clear fatigue markers at hour {hours:.1f}. PERCLOS and response latency both elevated. Recommend task reallocation or rest break."

    if state == "critical":
        return f"CRITICAL: {name} cognitive state has reached dangerous levels. Immediate supervisor intervention required. Do not assign high-stakes tasks."

    return f"{name} cognitive state: {state.replace('_', ' ')}. Trend: {trend}."


async def get_explanation(
    snapshot: Dict,
    plant_state: Dict,
    plant_risk: str,
) -> str:
    """
    Get a Claude-generated cognitive assessment for this operator.
    Returns fallback text if API call fails or state is normal.
    """
    # Skip the API call entirely when the operator is in a normal state
    current_state = snapshot.get("prediction", {}).get("current_state", "normal")
    if current_state == "normal":
        return _fallback_explanation(snapshot)

    if not ANTHROPIC_API_KEY:
        return _fallback_explanation(snapshot)

    prompt = _build_prompt(snapshot, plant_state, plant_risk)

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(
                API_URL,
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": CLAUDE_MODEL,
                    "max_tokens": 180,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )

            if response.status_code == 200:
                data = response.json()
                text = data["content"][0]["text"].strip()
                return text
            else:
                print(f"[Claude] API error {response.status_code}: {response.text[:200]}")
                return _fallback_explanation(snapshot)

    except Exception as e:
        print(f"[Claude] Request failed: {e}")
        return _fallback_explanation(snapshot)


def get_explanation_sync(snapshot: Dict, plant_state: Dict, plant_risk: str) -> str:
    """Synchronous wrapper for use in non-async contexts."""
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # In async context — return fallback, async version handles the real call
            return _fallback_explanation(snapshot)
        return loop.run_until_complete(get_explanation(snapshot, plant_state, plant_risk))
    except Exception:
        return _fallback_explanation(snapshot)
