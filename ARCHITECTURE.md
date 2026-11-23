# NewTron Architecture

## High-Level System Diagram

```mermaid
flowchart TB
    subgraph Frontend["React / TypeScript Frontend"]
        Login[Login Screen]
        Dash[DDTO Dashboard]
        Console[Simulation Console]
        Hist[History / Playback]
    end

    subgraph Backend["FastAPI Backend"]
        WS[WebSocket Broadcaster]
        API[REST API]
        Sim[Plant Simulation Engine]
        DDTO[DDTO Predictor]
        ML[RandomForest ML Model]
        Claude[Claude Explainer]
        Persist[(SQLite History)]
    end

    subgraph External
        Anthropic[Anthropic API]
        STEW[Optional STEW EEG Data]
    end

    Login --> Dash
    Dash --> WS
    Console --> API
    Hist --> API
    WS --> DDTO
    WS --> Sim
    DDTO --> ML
    DDTO --> Claude
    Claude --> Anthropic
    Sim --> Persist
    DDTO --> Persist
    API --> Persist
    DDTO --> STEW
```

## Prediction Pipeline

```mermaid
sequenceDiagram
    participant Sim as Plant Simulation
    participant DDTO as DDTO Engine
    participant Stub as EWMA Stub
    participant ML as RandomForest
    participant Persist as SQLite
    participant Claude as Claude API
    participant FE as Frontend

    Sim->>DDTO: plant_risk + scenarios
    DDTO->>DDTO: generate biometric signal
    DDTO->>Stub: sequence → load score + forecast
    DDTO->>ML: features → ML load score
    DDTO->>Persist: save snapshot (every 5s)
    DDTO->>Claude: on state change
    Claude-->>DDTO: plain-English assessment
    DDTO->>FE: WebSocket payload @ 1 Hz
```

## Data Model (simplified)

```mermaid
erDiagram
    PLANT_TICK ||--o{ OPERATOR_SNAPSHOT : contains
    PLANT_TICK {
        int id
        datetime timestamp
        string risk_level
        json plant_state
    }
    OPERATOR_SNAPSHOT {
        int id
        datetime timestamp
        string operator_id
        string current_state
        float load_score
        json signals
        json prediction
        string claude_explanation
    }
```

## Cognitive State Machine

```mermaid
stateDiagram-v2
    [*] --> Normal
    Normal --> ElevatedLoad : load > 0.15
    ElevatedLoad --> HighLoad : load > 0.35
    HighLoad --> Fatigued : load > 0.55
    Fatigued --> Critical : load > 0.75
    Critical --> Fatigued : recovery
    Fatigued --> HighLoad : recovery
    HighLoad --> ElevatedLoad : recovery
    ElevatedLoad --> Normal : recovery
```

## New Capabilities (Bulk-up)

| Feature | Implementation | Value |
|---------|----------------|-------|
| Persistence | SQLite + SQLAlchemy | History, playback, audit |
| ML Model | scikit-learn RandomForest | Real model path + metrics |
| History API | `/ddto/history`, `/ddto/plant-history` | Frontend charts & scrubber |
| Tests | pytest core suite | Quality signal |
| Docker | docker-compose.yml | One-command demo |
| Diagrams | Mermaid in this file | Recruiter-friendly docs |

## Run with Docker

```bash
# From repo root (set ANTHROPIC_API_KEY if desired)
docker-compose up --build
```

- Frontend: http://localhost:5173  
- Backend docs: http://localhost:8000/docs  
- History endpoints available immediately after a few ticks
