# NewTron — Dynamic Digital Twin of the Operator (DDTO)

Hackathon project for **CITECH** (Cognitive Innovative Technology, Ontario Tech University): a system that models **nuclear plant operators** in real time, predicts cognitive load up to **15 minutes ahead**, and surfaces **Claude**-generated assessments—while a **simulated plant** runs in the background and feeds risk into operator load.

**Team:** Summit Kabir, Urooj Fatima Khan, and Daniel Brown.

For deeper architecture, operators, and signal definitions, see **[CONTEXT.md](./CONTEXT.md)**.


Open: http://localhost:5173

### Demo Credentials
| Operator | Username | Password |
|---|---|---|
| Alex Chen — Senior Reactor Operator | alex.chen | citech2026 |
| Blair Santos — Reactor Operator | blair.santos | citech2026 |
| Casey Morgan — Senior Reactor Operator | casey.morgan | citech2026 |

---

## What you get

- **Login** → **DDTO dashboard** for the signed-in operator (personal baselines, not population averages).
- **15-minute cognitive forecast** chart, **biometric tiles** with live sparkline trends, **CCSI** panel, **Claude assessment**, pause/resume, and per-operator demo scenarios.
- **Simulation console** (`/console`): plant scenarios, manual variable overrides, simulation reset.
- **Unified WebSocket** stream (~1 Hz): plant state, DDTO snapshots for all operators, CCSI, pause flag, and more.

There is **no separate “Plant Twin” UI page** in this build; plant behavior is driven by the backend and reflected in risk and payloads.

---

## Tech stack

| Layer | Stack |
|--------|--------|
| Backend | Python, FastAPI, WebSockets |
| Frontend | React, TypeScript, Vite |
| AI | Anthropic Claude (`claude-sonnet-4-6`) — API key in `backend/.env` |

---

## Prerequisites

- Python 3.10+ recommended  
- Node.js 18+ and npm  
- `ANTHROPIC_API_KEY` in `backend/.env` (for Claude explanations on the dashboard)

---

## Run locally

### Backend (port 8000)

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- REST docs: http://localhost:8000/docs  
- WebSocket: `ws://localhost:8000/ws`

### Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies API calls to the backend.

---

## UI routes

| Route | Purpose |
|--------|--------|
| `/` | **DDTO** — main demo (after operator login) |
| `/console` | **Sim Console** — scenarios, overrides, reset |

---

## WebSocket payload (summary)

Each tick sends a JSON object including:

- `plant_state` — reactor cooling subsystem variables  
- `risk_level` — `low` \| `medium` \| `high`  
- `causal_explanation`, `operator_state`, `authority_mode`, `recommendation`  
- **`ddto`** — `Record<operator_id, OperatorSnapshot>` (signals, prediction, forecast, `claude_explanation`, profile, etc.)  
- **`ccsi`** — crew cognitive stress index and contributions  
- **`simulation_paused`** — boolean  

Authoritative TypeScript types: [`frontend/src/services/websocket.ts`](frontend/src/services/websocket.ts) (`LivePayload` and nested interfaces).

---

## Project layout (high level)

```
newtwon/
  CONTEXT.md              ← Full agent/judge context; read for details
  backend/
    app/
      main.py             ← FastAPI entry
      websocket.py        ← Live broadcast loop
      ddto/               ← Profiles, signals, predictor, Claude explainer
      simulation/         ← Plant state, engine, scenarios
      causal/, operator/, teaming/
      api/routes/         ← REST: simulate, ddto, operator, etc.
    data/STEW/            ← Optional real EEG CSVs (see STEW README)
    .env                  ← ANTHROPIC_API_KEY (do not commit)
    requirements.txt
  frontend/
    src/
      App.tsx             ← Router: DDTO + Sim Console, WS connect
      pages/
        DDTODashboard.tsx
        SimulationConsole.tsx
        LoginScreen.tsx
      components/         ← CCSIPanel, MetricSparkline, etc.
      hooks/
      services/           ← websocket.ts, api.ts
```

---

## Simulation console

- **Scenarios:** e.g. pump degradation, flow restriction (start/stop via UI or REST).  
- **Manual overrides:** set plant variables directly.  
- **Reset:** full simulation reset.

DDTO-specific demo scenarios (fatigue, workload spike, etc.) are controlled from the **DDTO dashboard** header.

---

## Optional: real STEW EEG data

Place STEW dataset files under **`backend/data/STEW/`** as described in [`backend/data/STEW/README.md`](backend/data/STEW/README.md). When present, the backend can blend real band powers into the signal path; the UI data-source indicator reflects synthetic vs real.

---

## Extending the project

- DDTO logic and Claude text: `backend/app/ddto/`  
- Plant tick and scenarios: `backend/app/simulation/`  
- Main UI: `frontend/src/pages/DDTODashboard.tsx`  
- Biometric history / sparklines: `frontend/src/hooks/useBiometricHistory.ts`, `frontend/src/components/MetricSparkline.tsx`

---

## License / competition

Built for CITECH demonstration. Adjust licensing as needed for your submission.
