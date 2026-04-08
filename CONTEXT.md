# NewTron — Full Project Context for Cursor Agent

> Read this file before making any changes to the project.
> Reference it in prompts with @CONTEXT.md

---

## What This Project Is

**NewTron** is a hackathon submission for the **CITECH competition** (Cognitive Innovative Technology) run out of Ontario Tech University.

The project is built by **Summit Kabir, Urooj Fatima Khan, and Daniel Brown**.

The core concept is the **Dynamic Digital Twin of the Operator (DDTO)** — an AI system that monitors nuclear power plant operators in real time, builds a personal cognitive model of each operator, and predicts their cognitive state up to 15 minutes into the future before errors occur.

This directly addresses the gap identified in Dr. Hossam Gabbar's 2026 IDCR paper: his system monitors the operator but cannot predict future cognitive states. NewTron does.

---

## Competition Context — What Judges Are Looking For

CITECH wants to see:
1. A system that monitors the **operator**, not just the plant
2. A **personalized** model per operator (not generic population thresholds)
3. **Predictive** capability — cognitive state forecast before degradation happens
4. A **Digital Dynamic Twin of the Operator** — their exact framing
5. Look-ahead analysis (LSTM on time-series sensor data)
6. Trustworthy AI, real data grounding, downstream applications
7. A believable, working demo — not just slides

---

## The Two-Part System

### Part 1 — Plant-Side Twin (background context)
A simulated reactor cooling subsystem. Runs in the background.
Plant risk level feeds into operator cognitive load.
This is NOT the main focus — it's supporting context for the DDTO.

### Part 2 — DDTO (the main product)
The Dynamic Digital Twin of the Operator.
Three real operators modelled simultaneously, each with a personal baseline.
Predicts cognitive trajectory 5, 10, 15 minutes ahead.
Claude (Anthropic API) generates plain English assessments for each operator.

---

## Tech Stack

**Backend:**
- Python, FastAPI, WebSockets
- Runs on port 8000
- Start: `python -m uvicorn app.main:app --reload --port 8000`

**Frontend:**
- React, TypeScript, Vite
- Runs on port 5173
- Start: `npm run dev`

**AI:**
- Anthropic API — claude-sonnet-4-6
- API key in `backend/.env`
- Powers the Claude Cognitive Assessment panel

---

## Folder Structure

```
newtwon/
  backend/
    app/
      main.py              ← FastAPI entry, lifespan, CORS, routers
      websocket.py         ← Streams full payload every second via WS
      ddto/
        profiles.py        ← 3 operator profiles with personal baselines
        signals.py         ← EEG + eye tracking signal simulator
        dataset.py         ← Unified data layer (real STEW or synthetic)
        stew_loader.py     ← Loads real STEW EEG dataset when available
        lstm_stub.py       ← Sequence-based cognitive predictor (EWMA + trend)
        predictor.py       ← Orchestrates all 3 twins every tick
        explainer.py       ← Claude API integration for plain English output
      simulation/
        state.py           ← PlantState dataclass (9 sensor variables)
        engine.py          ← Tick loop, causal chain propagation
        scenarios.py       ← pump_degradation, flow_restriction scenarios
      causal/
        graph.py           ← Hardcoded causal graph + anomaly thresholds
        reasoning.py       ← Root cause, chain, risk level inference
      operator/
        tracker.py         ← In-memory operator interaction event log
        cognitive.py       ← Rule-based cognitive state inference
      teaming/
        authority.py       ← QUIET / ADVISORY / ASSERTIVE mode logic
        recommendations.py ← Plant-side recommendation text generator
      api/routes/
        ddto.py            ← DDTO REST endpoints
        simulate.py        ← Plant simulation control
        operator.py        ← Operator event recording
        ai.py              ← AI prompt interpreter stub
    data/
      STEW/                ← Drop real STEW CSV files here
        README.md          ← Download instructions for STEW dataset
    .env                   ← ANTHROPIC_API_KEY (do not commit)
    requirements.txt

  frontend/
    src/
      App.tsx              ← Router, nav, WS init. DDTO is landing page.
      pages/
        DDTODashboard.tsx  ← Main demo surface — everything wired together
        ControlRoom.tsx    ← Plant twin dashboard
        SimulationConsole.tsx ← Admin/demo panel
      components/
        OperatorSelector.tsx   ← 3-card operator switcher with live load bars
        SignalTrace.tsx         ← Canvas EEG + eye tracking scrolling chart
        CognitiveForecast.tsx  ← 15-min prediction horizon bar chart
        ExplanationPanel.tsx   ← Claude assessment + latency/error deltas
        DataSourceBadge.tsx    ← Shows "Real EEG Data" or "Synthetic Signals"
        SubsystemPanel.tsx     ← Animated SVG reactor schematic
        SensorCard.tsx         ← Reusable sensor value card
        AlertPanel.tsx         ← Threshold-based plant alerts
        RecommendationPanel.tsx← Plant-side causal chain + recommendation
        OperatorPanel.tsx      ← Legacy operator state panel
      services/
        websocket.ts       ← Singleton WS client + all TypeScript types
        api.ts             ← All REST API calls

```

---

## The 3 Operators — Critical Detail

Each operator has a **personal cognitive baseline** — all predictions are deviations from THEIR normal, not a population average. This is what makes it a twin.

| ID | Name | Experience | Fatigue Rate | Automation Bias | Key Behaviour |
|---|---|---|---|---|---|
| op_a | Alex Chen | 12 years | 0.6 (Low — resilient) | Low (0.2) | Stable, consistent performer |
| op_b | Blair Santos | 4 years | 1.8 (High — fatigues fast) | Moderate (0.35) | Strong start, degrades by hour 4 |
| op_c | Casey Morgan | 8 years | 0.8 (Moderate) | High (0.75) | High performer but over-relies on AI |

---

## Biometric Signal Parameters

### EEG Band Powers (from CognShield headset / STEW dataset)
- **theta** (4-8 Hz) — rises with cognitive workload and fatigue
- **alpha** (8-13 Hz) — drops under cognitive load (inverse marker)
- **beta** (13-30 Hz) — rises with active concentration, drops with fatigue
- **theta_alpha_ratio** — key workload index (elevated = overloaded)
- **beta_alpha_ratio** — arousal index
- **engagement_index** — beta / (theta + alpha), Pope et al. model

### Eye Tracking (from CognShield IR cameras)
- **blink_rate** — blinks/min, drops under high cognitive load (tunnel vision)
- **perclos** — % eye closure, rises with fatigue (>0.2 = concerning)
- **pupil_dilation** — rises with cognitive effort

### Performance Proxies
- **response_latency_ms** — rises with fatigue and overload
- **estimated_error_probability** — derived from signal combination

---

## DDTO Cognitive States

| State | Load Score | Meaning |
|---|---|---|
| normal | < 0.15 | Within personal baseline |
| elevated_load | 0.15 – 0.35 | Above baseline, monitor |
| high_load | 0.35 – 0.55 | Significantly elevated, advisory |
| fatigued | 0.55 – 0.75 | Clear fatigue markers, intervention |
| critical | > 0.75 | Immediate supervisor action required |

---

## STEW Dataset Integration

**STEW** = Simultaneous Task EEG Workload dataset
- 48 human subjects, real EEG recordings under low/high cognitive load
- Lim et al. (2018), IEEE Trans. Neural Syst. Rehabil. Eng.
- Download: https://figshare.com/articles/dataset/STEW_Dataset_Raw_EEG_Data/6198183

**Current status:** System runs on synthetic signals by default.
When STEW CSV files are placed in `backend/data/STEW/`, the backend auto-detects them, processes them (FFT band powers), caches to JSON, and the DataSourceBadge flips from "Synthetic Signals" to "Real EEG Data".

The blend: real STEW data drives EEG bands, synthetic engine drives eye tracking + performance proxies.

---

## WebSocket Payload Shape

Every second, the backend sends:
```json
{
  "plant_state": { "pump_a_temperature": 72.0, "...": "..." },
  "active_scenarios": [],
  "risk_level": "low",
  "causal_explanation": { "root_cause": "...", "chain": [], "anomalies": [] },
  "operator_state": { "cognitive_state": "normal", "recent_events": [] },
  "authority_mode": "QUIET",
  "recommendation": "...",
  "ddto": {
    "op_a": {
      "operator_id": "op_a",
      "name": "Alex Chen",
      "hours_into_shift": 0.2,
      "signals": { "eeg": {}, "eye": {}, "performance": {} },
      "prediction": {
        "current_state": "normal",
        "current_load_score": 0.05,
        "trend": "stable",
        "forecast": [
          { "minutes_ahead": 5, "predicted_state": "normal", "load_score": 0.06 },
          { "minutes_ahead": 10, "predicted_state": "normal", "load_score": 0.07 },
          { "minutes_ahead": 15, "predicted_state": "normal", "load_score": 0.08 }
        ],
        "confidence": 0.95
      },
      "claude_explanation": "Alex Chen is performing within normal parameters...",
      "data_source": "synthetic"
    },
    "op_b": { "...": "..." },
    "op_c": { "...": "..." }
  }
}
```

---

## Design System

**Theme:** Industrial dark — nuclear control room aesthetic
**Fonts:** Share Tech Mono (values/data), Barlow Condensed (labels/headers), Barlow (body)
**Colors:**
- `--green: #00e5a0` — normal/safe
- `--yellow: #f0c040` — elevated/warning
- `--orange: #ff7c35` — high load/assertive
- `--red: #ff3d55` — critical
- `--blue: #3ab8ff` — info/live data
- `--purple: #a07cff` — AI/Claude elements
- `--bg-deep: #080c10` — page background
- `--bg-panel: #0d1318` — panel background
- `--bg-surface: #111a22` — input/card background
- `--bg-raised: #162130` — elevated elements
- `--border: #1e3044` — default borders
- `--border-bright: #2a4a6a` — highlighted borders

---

## Demo Scenarios (for presentation)

1. **Select Blair Santos** → watch him degrade faster over time (high fatigue rate)
2. **Trigger Fatigue Onset** on any operator → signals spike, forecast turns orange, Claude updates
3. **Trigger Workload Spike** → dramatic immediate load increase
4. **Go to Plant Twin** → start Pump Degradation → return to DDTO → plant risk elevates operator load
5. **Select Casey Morgan** → show automation bias profile → trigger Automation Bias scenario
6. **Reset All Twins** → clean demo reset

---

## Key Differentiators vs Gabbar 2026 (for judges)

| Gabbar IDCR | NewTron DDTO |
|---|---|
| Monitors current state | Predicts 15 min ahead |
| Rule-based inference | Sequence-based prediction (LSTM-stub) |
| Generic operator model | Personal baseline per operator |
| No explanation to operator | Claude plain English guidance |
| $18,000 lab equipment | $400 CognShield PPE concept |
| Research simulation only | Working software demo |

---

## What NOT to Change Without Discussion

- The WebSocket payload shape — frontend depends on exact field names
- Operator IDs (`op_a`, `op_b`, `op_c`) — hardcoded in multiple places
- The `.env` file — contains live Anthropic API key
- The `dataset.py` interface — STEW integration depends on it
- Port numbers (8000 backend, 5173 frontend)

---

## Current Status

- ✅ Backend running, all modules working
- ✅ Frontend live, DDTO dashboard rendering
- ✅ Claude API connected and generating assessments
- ✅ 3 operators live with distinct profiles
- ✅ 15-min forecast working
- ✅ Demo scenarios functional
- ⏳ STEW dataset — needs download and placement in `backend/data/STEW/`
- ✅ CCSI (Crew Cognitive State Index) — built
- ⏳ 4 separate cognitive scores (workload/fatigue/stress/SA) — planned
- ⏳ Procedure context input — planned
- ⏳ Post-shift debrief report — planned
- ⏳ UI/UX polish — ongoing

---

## CCSI — Crew Cognitive State Index

NewTron's most unique feature. No existing nuclear system does this.

**File:** `backend/app/ddto/ccsi.py`
**Frontend:** `frontend/src/components/CCSIPanel.tsx`
**Payload field:** `ccsi` in WebSocket payload

**Formula:**
1. Weighted average of individual operator load scores (junior operators weighted higher)
2. Compound penalty: −12 to −25 points when 2+ operators degrade simultaneously
3. Plant risk modifier: −5 (medium) or −15 (high)

**Compound penalty basis:** Kim et al. (2016) + aviation CRM studies —
crew error risk is MULTIPLICATIVE not additive when both operators degrade simultaneously.

**CCSI Levels:**
- 80-100: Optimal
- 60-79: Nominal
- 40-59: Degraded
- 20-39: Impaired
- 0-19: Critical

**Relief flag:** Fires when CCSI < 45 — recommend relief operator.

**Do NOT change operator IDs, experience weights, or the compound penalty logic
without understanding the literature basis.**
