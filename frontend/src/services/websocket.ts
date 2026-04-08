// WebSocket service — manages a single persistent connection to the backend.

const WS_URL = 'ws://localhost:8000/ws'

export type RiskLevel = 'low' | 'medium' | 'high'
export type AuthorityMode = 'QUIET' | 'ADVISORY' | 'ASSERTIVE'
export type CognitiveState = 'normal' | 'tunneling' | 'overwhelmed' | 'automation_bias'
export type DDTOState = 'normal' | 'elevated_load' | 'high_load' | 'fatigued' | 'critical'
export type TrendLabel = 'stable' | 'degrading' | 'recovering'

export interface PlantState {
  pump_a_temperature: number
  pump_a_vibration: number
  pump_a_health: number
  coolant_flow_rate: number
  inlet_temperature: number
  outlet_temperature: number
  loop_pressure: number
  valve_position: number
  heat_exchanger_efficiency: number
}

export interface EEGSignal {
  theta: number
  alpha: number
  beta: number
  theta_alpha_ratio: number
  beta_alpha_ratio: number
  engagement_index: number
}

export interface EyeSignal {
  blink_rate: number
  perclos: number
  pupil_dilation: number
}

export interface PerformanceSignal {
  response_latency_ms: number
  estimated_error_probability: number
}

export interface ForecastPoint {
  minutes_ahead: number
  predicted_state: DDTOState
  load_score: number
  color: string
}

export interface DDTOPrediction {
  current_state: DDTOState
  current_load_score: number
  trend: TrendLabel
  trend_rate: number
  forecast: ForecastPoint[]
  peak_risk_window: string
  confidence: number
  history_length: number
  state_color: string
}

export interface OperatorSnapshot {
  operator_id: string
  name: string
  experience_years: number
  hours_into_shift: number
  signals: {
    eeg: EEGSignal
    eye: EyeSignal
    performance: PerformanceSignal
  }
  prediction: DDTOPrediction
  state_changed: boolean
  profile: {
    fatigue_rate: number
    automation_bias_tendency: number
  }
  scenario_override: string | null
  claude_explanation: string
}

export interface CausalExplanation {
  root_cause: string
  chain: string[]
  anomalies: string[]
}

export interface OperatorState {
  cognitive_state: CognitiveState
  recent_events: { type: string; detail: string }[]
  total_recent_interactions: number
}


export interface CCSIContribution {
  operator_id: string
  name: string
  state: DDTOState
  load_score: number
  color: string
}

export interface CCSIForecastPoint {
  minutes_ahead: number
  score: number
  level: string
  color: string
}

export interface CCSI {
  score: number
  level: string
  color: string
  description: string
  compound_penalty_active: boolean
  compound_penalty_value: number
  relief_recommended: boolean
  risk_driver: string
  forecast: CCSIForecastPoint[]
  individual_contributions: CCSIContribution[]
  timestamp: number
}

export interface LivePayload {
  plant_state: PlantState
  active_scenarios: string[]
  risk_level: RiskLevel
  causal_explanation: CausalExplanation
  operator_state: OperatorState
  authority_mode: AuthorityMode
  recommendation: string
  ddto: Record<string, OperatorSnapshot>
  ccsi: CCSI
  simulation_paused: boolean
}

type MessageHandler = (payload: LivePayload) => void
type StatusHandler = (connected: boolean) => void

class ReactorWebSocket {
  private ws: WebSocket | null = null
  private handlers: MessageHandler[] = []
  private statusHandlers: StatusHandler[] = []
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return
    this.ws = new WebSocket(WS_URL)
    this.ws.onopen = () => { this.statusHandlers.forEach(h => h(true)) }
    this.ws.onmessage = (event) => {
      try {
        const payload: LivePayload = JSON.parse(event.data)
        this.handlers.forEach(h => h(payload))
      } catch (e) { console.error('[WS] Parse error', e) }
    }
    this.ws.onclose = () => {
      this.statusHandlers.forEach(h => h(false))
      this.reconnectTimer = setTimeout(() => this.connect(), 3000)
    }
    this.ws.onerror = () => this.ws?.close()
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler)
    return () => { this.handlers = this.handlers.filter(h => h !== handler) }
  }

  onStatus(handler: StatusHandler) {
    this.statusHandlers.push(handler)
    return () => { this.statusHandlers = this.statusHandlers.filter(h => h !== handler) }
  }
}

export const reactorWS = new ReactorWebSocket()
