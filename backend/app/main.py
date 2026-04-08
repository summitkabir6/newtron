"""
Main FastAPI application — Reactor Cooling AI + DDTO.
"""

import asyncio
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load .env before anything else so ANTHROPIC_API_KEY is available
load_dotenv()

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.simulation.engine import engine
from app.websocket import websocket_handler, run_unified_simulation_loop
from app.api.routes import simulate, operator, ai
from app.api.routes import ddto


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(run_unified_simulation_loop())
    yield
    engine.stop()
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="NewTron — DDTO + Reactor Cooling AI",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(simulate.router)
app.include_router(operator.router)
app.include_router(ai.router)
app.include_router(ddto.router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket_handler(websocket)


@app.get("/")
def root():
    return {
        "service": "NewTron — Dynamic Digital Twin of the Operator",
        "status": "running",
        "docs": "/docs",
        "websocket": "ws://localhost:8000/ws",
        "operators": "/ddto/operators",
    }
