// REST API service for simulation control and operator events.

const BASE = '' // Vite proxy handles routing to localhost:8000

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OperatorAuth {
  operator_id: string
  name: string
  username: string
  role: string
  badge_id: string
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Simulation ──────────────────────────────────────────────────────────────

export const api = {
  startScenario: (name: string) =>
    post(`/simulate/scenario/start/${name}`),

  stopScenario: (name: string) =>
    post(`/simulate/scenario/stop/${name}`),

  resetSimulation: () =>
    post('/simulate/reset'),

  overrideVariable: (variable: string, value: number) =>
    post('/simulate/override', { variable, value }),

  getScenarios: () =>
    get<{ name: string; description: string; active: boolean; ticks_active: number }[]>(
      '/simulate/scenarios'
    ),

  // ── Operator ──────────────────────────────────────────────────────────────

  recordEvent: (event_type: string, detail = '') =>
    post('/operator/event', { event_type, detail }),
}

// ── DDTO ─────────────────────────────────────────────────────────────────────

export const ddtoApi = {
  listOperators: () =>
    get<{ operator_id: string; name: string; current_state: string }[]>('/ddto/operators'),

  getExplanation: (operatorId: string) =>
    get<{ operator_id: string; explanation: string; state: string }>(
      `/ddto/explain/${operatorId}`
    ),

  setScenario: (operatorId: string | null, scenario: string | null) =>
    post('/ddto/scenario', { operator_id: operatorId, scenario }),

  reset: () => post('/ddto/reset'),
}

export const simControlApi = {
  pause:  () => post<{ status: string }>('/simulate/pause'),
  resume: () => post<{ status: string }>('/simulate/resume'),
  status: () => get<{ paused: boolean }>('/simulate/status'),
}

export const dataSourceApi = {
  getInfo: () =>
    get<{
      source: string
      label: string
      detail: string
      citation: string
      color: string
    }>('/ddto/data-source'),
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (username: string, password: string) =>
    post<OperatorAuth>('/ddto/login', { username, password }),
}
