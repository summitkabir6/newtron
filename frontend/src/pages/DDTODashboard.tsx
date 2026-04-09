import React, { useEffect, useState, useRef } from 'react'
import { reactorWS, type LivePayload } from '../services/websocket'
import { ddtoApi, simControlApi } from '../services/api'
import type { OperatorAuth } from '../services/api'
import { CCSIPanel } from '../components/CCSIPanel'
import { MetricSparkline } from '../components/MetricSparkline'
import { useSmoothedDDTO } from '../hooks/useSmoothedDDTO'
import { useBiometricHistory, type BiometricMetricKey } from '../hooks/useBiometricHistory'

// ── State colour maps ─────────────────────────────────────────────────────────

const STATE_DOT: Record<string, string> = {
  normal:        '#22c55e',
  elevated_load: '#f59e0b',
  high_load:     '#f97316',
  fatigued:      '#ef4444',
  critical:      '#dc2626',
}

const STATE_BG: Record<string, string> = {
  normal:        '#14532d',
  elevated_load: '#7f1d1d',
  high_load:     '#7f1d1d',
  fatigued:      '#7f1d1d',
  critical:      '#450a0a',
}

const STATE_BORDER: Record<string, string> = {
  normal:        '#166534',
  elevated_load: '#991b1b',
  high_load:     '#991b1b',
  fatigued:      '#991b1b',
  critical:      '#7f1d1d',
}

const STATE_LABEL: Record<string, string> = {
  normal:        '#4ade80',
  elevated_load: '#fca5a5',
  high_load:     '#fca5a5',
  fatigued:      '#fca5a5',
  critical:      '#fca5a5',
}

const STATE_TEXT: Record<string, string> = {
  normal:        'Normal',
  elevated_load: 'Elevated Load',
  high_load:     'High Load',
  fatigued:      'Fatigued',
  critical:      'Critical',
}

function sc(state: string)      { return STATE_DOT[state]    ?? '#787878' }
function sbg(state: string)     { return STATE_BG[state]     ?? '#bebebe' }
function sborder(state: string) { return STATE_BORDER[state] ?? '#b4b4b4' }
function slabel(state: string)  { return STATE_LABEL[state]  ?? '#475569' }
function stext(state: string)   { return STATE_TEXT[state]   ?? state.replace(/_/g, ' ') }

// ── Forecast-specific colour map (per spec) ───────────────────────────────────

const FORECAST_COLORS: Record<string, string> = {
  normal:        '#22c55e',
  elevated_load: '#EF9F27',
  high_load:     '#E24B4A',
  fatigued:      '#dc2626',
  critical:      '#7c3aed',
}
const fsc = (state: string) => FORECAST_COLORS[state] ?? '#787878'

// ── Biometric “about” copy (shown when Details is selected) ─────────────────

const PARAM_DETAILS: Record<string, { headline: string; body: string }> = {
  theta: {
    headline: 'Theta band (EEG · workload proxy)',
    body: 'Theta power in the 4–8 Hz band rises when working memory and sustained attention demands increase. In this twin, theta is compared to this operator’s personal baseline—not a population average—so a “normal” reading means close to their typical shift profile. Sustained elevation often precedes perceived overload and slower responses. Values are shown as normalised band power suitable for trend comparison across the session.',
  },
  alpha: {
    headline: 'Alpha band (EEG · alertness / relaxation)',
    body: 'Alpha (8–13 Hz) is associated with relaxed wakefulness. Under rising task load or stress, alpha typically suppresses relative to baseline. A drop here does not diagnose a medical condition; it flags a departure from this operator’s usual EEG pattern that may warrant workload relief or a short break. The DDTO uses alpha together with theta and beta to estimate cognitive state.',
  },
  beta: {
    headline: 'Beta band (EEG · active concentration)',
    body: 'Beta (13–30 Hz) tends to increase with active engagement and focused processing. During fatigue or disengagement, beta can fall while theta rises. Monitoring beta against this operator’s baseline helps distinguish “still engaged but tired” from “checked out” patterns. All EEG features may be blended with real STEW-derived samples when available, or fully synthetic for demo continuity.',
  },
  perclos: {
    headline: 'PERCLOS (eye closure over time)',
    body: 'PERCLOS is the proportion of time the eyes are classified as closed over a window—here expressed as a percentage for readability. It is a common ocular fatigue indicator in human-factors research; sustained elevation can align with drowsiness or heavy eyelids. Thresholds in the status badge are conservative heuristics for the simulation, not clinical cut-offs. Interpret alongside blink rate and performance latency.',
  },
  blink: {
    headline: 'Blink rate',
    body: 'Natural blink rate varies by person and environment. Very low rates can accompany visual fixation or “tunneling” on a single display; abrupt changes often track stress or dryness. The twin compares the current rate to this operator’s baseline to highlight unusual trends rather than absolute norms. Units are blinks per minute.',
  },
  error: {
    headline: 'Estimated error probability',
    body: 'This is a modelled likelihood of a procedural slip or mistake under the current cognitive load, fatigue markers, and plant risk context—normalised against the operator’s historical error tendency. It is not a prediction of a specific incident; it is a risk index for supervisors to prioritise checks, cross-verification, or crew relief. The value updates with each simulation tick as signals and plant state evolve.',
  },
}

// ── Parameter tile status ─────────────────────────────────────────────────────

function paramStatus(key: string, val: number): { label: string; color: string } {
  switch (key) {
    case 'theta':
      if (val > 0.6)  return { label: 'HIGH',     color: '#ef4444' }
      if (val > 0.45) return { label: 'ELEVATED',  color: '#f59e0b' }
      return { label: 'NORMAL', color: '#22c55e' }
    case 'alpha':
      if (val < 0.15) return { label: 'LOW',       color: '#ef4444' }
      if (val < 0.25) return { label: 'REDUCED',   color: '#f59e0b' }
      return { label: 'NORMAL', color: '#22c55e' }
    case 'beta':
      if (val < 0.2)  return { label: 'LOW',       color: '#ef4444' }
      if (val < 0.3)  return { label: 'REDUCED',   color: '#f59e0b' }
      return { label: 'NORMAL', color: '#22c55e' }
    case 'perclos':
      if (val > 0.35) return { label: 'CRITICAL',  color: '#dc2626' }
      if (val > 0.2)  return { label: 'ELEVATED',  color: '#f59e0b' }
      return { label: 'NORMAL', color: '#22c55e' }
    case 'blink':
      if (val < 8)    return { label: 'LOW',       color: '#ef4444' }
      if (val < 12)   return { label: 'REDUCED',   color: '#f59e0b' }
      return { label: 'NORMAL', color: '#22c55e' }
    case 'error':
      if (val > 0.2)  return { label: 'HIGH',      color: '#dc2626' }
      if (val > 0.1)  return { label: 'ELEVATED',  color: '#f59e0b' }
      return { label: 'LOW',    color: '#22c55e' }
    default:
      return { label: 'OK', color: '#22c55e' }
  }
}

function metricThresholds(key: string): { low?: number; high?: number } {
  switch (key) {
    case 'theta':   return { high: 0.45 }
    case 'alpha':   return { low: 0.25 }
    case 'beta':    return { low: 0.3 }
    case 'perclos': return { high: 0.2 }
    case 'blink':   return { low: 12 }
    case 'error':   return { high: 0.1 }
    default:        return {}
  }
}

function metricActionHint(key: string): string {
  switch (key) {
    case 'theta':
      return 'Sustained high theta suggests rising workload; consider redistributing complex tasks.'
    case 'alpha':
      return 'If alpha remains reduced for several minutes, prompt a short recovery break and workload check.'
    case 'beta':
      return 'A persistent beta drop can indicate disengagement or fatigue; verify task attention and pacing.'
    case 'perclos':
      return 'Elevated PERCLOS indicates ocular fatigue risk; prioritize alertness checks and relief rotation.'
    case 'blink':
      return 'Reduced blink rate may reflect visual tunneling; cue gaze reset and display scan behaviors.'
    case 'error':
      return 'When error probability stays elevated, increase cross-verification and supervision frequency.'
    default:
      return 'Monitor this metric trend alongside task demand to guide intervention timing.'
  }
}

// ── SVG strip-chart path (linear segments) ────────────────────────────────────

function linearPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y.toFixed(2)}`
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x} ${pts[i].y.toFixed(2)}`
  }
  return d
}

/** Cubic Bézier through points (Catmull–Rom style); 2 points → straight line. */
function smoothBezierPath(P: { x: number; y: number }[]): string {
  if (P.length < 2) return ''
  if (P.length === 2) {
    return `M ${P[0].x} ${P[0].y.toFixed(2)} L ${P[1].x} ${P[1].y.toFixed(2)}`
  }
  let d = `M ${P[0].x} ${P[0].y.toFixed(2)}`
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i > 0 ? i - 1 : i]
    const p1 = P[i]
    const p2 = P[i + 1]
    const p3 = P[i + 2 < P.length ? i + 2 : i + 1]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x} ${p2.y.toFixed(2)}`
  }
  return d
}

function closeSmoothPathToBottom(
  lineD: string,
  firstX: number,
  lastX: number,
  bottomY: number,
): string {
  return `${lineD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`
}

function areaUnderSegment(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  bottomY: number,
): string {
  return `M ${p0.x} ${p0.y.toFixed(2)} L ${p1.x} ${p1.y.toFixed(2)} L ${p1.x} ${bottomY} L ${p0.x} ${bottomY} Z`
}

const RGB_BLUE: [number, number, number] = [37, 99, 235]
const RGB_GREEN: [number, number, number] = [34, 197, 94]
const RGB_RED: [number, number, number] = [220, 38, 38]

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): string {
  const u = Math.max(0, Math.min(1, t))
  const r = Math.round(a[0] + (b[0] - a[0]) * u)
  const g = Math.round(a[1] + (b[1] - a[1]) * u)
  const bl = Math.round(a[2] + (b[2] - a[2]) * u)
  return `rgb(${r},${g},${bl})`
}

/** Future side of chart: blue → green (10–40%) → red (>40%), smooth ramps. */
function futureColorForLoad(load: number): string {
  const L = Math.max(0, Math.min(1, load))
  if (L < 0.1) return mixRgb(RGB_BLUE, RGB_GREEN, L / 0.1)
  if (L <= 0.4) return mixRgb(RGB_GREEN, RGB_GREEN, 0)
  return mixRgb(RGB_GREEN, RGB_RED, Math.min(1, (L - 0.4) / 0.6))
}

const FORECAST_BLUE = 'rgb(37,99,235)'
const FORECAST_GREY_STROKE = '#888888'
const FORECAST_GREY_FILL = 'rgba(136, 136, 136, 0.18)'

// ── Demo scenarios ────────────────────────────────────────────────────────────

const DEMO_SCENARIOS = [
  { id: 'fatigue_onset',   label: 'Fatigue Onset',  color: '#f97316' },
  { id: 'workload_spike',  label: 'Workload Spike',  color: '#ef4444' },
  { id: 'automation_bias', label: 'Automation Bias', color: '#a855f7' },
]

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, delta, deltaColor }: {
  label: string; value: string; delta: string; deltaColor: string
}) {
  const tx = 'color 0.35s ease'
  return (
    <div style={{
      background: '#d2d2d2', border: '1px solid #b4b4b4', borderRadius: 6,
      borderBottom: '2px solid #22c55e',
      padding: '7px 10px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontSize: 10, color: '#787878', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#080808', fontFamily: 'var(--font-mono)', transition: tx }}>{value}</div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: deltaColor, fontFamily: 'var(--font-head)', transition: tx }}>{delta}</div>
    </div>
  )
}

// ── Trend config ──────────────────────────────────────────────────────────────

const TREND_CONFIG = {
  degrading: { symbol: '↑', label: 'Rising',     color: '#ef4444' },
  stable:    { symbol: '→', label: 'Stable',      color: '#787878' },
  improving: { symbol: '↓', label: 'Recovering',  color: '#22c55e' },
}

// ── SVG Y mapping — viewBox "0 0 480 92": data to y=72, x-axis labels below ──
// 0–100% load spans full plot height; Y labels sit left of CHART_LEFT with a small gap

const CHART_BOTTOM = 72
const CHART_RANGE  = 67
const CHART_RIGHT  = 450
const Y_AXIS_MAX_LOAD = 1
/** Grid / plot starts here (labels end to the left with padding). */
const CHART_LEFT = 64
const Y_LABEL_X = 50
const FORECAST_Y_TICKS_PCT = [0, 20, 40, 60, 80, 100] as const
const FORECAST_X_LABELS = ['-5 min', 'Now', '+5 min', '+10 min', '+15 min'] as const

const loadToY = (load: number) => {
  const clamped = Math.min(Math.max(load, 0), Y_AXIS_MAX_LOAD)
  return CHART_BOTTOM - clamped * CHART_RANGE
}

// ── Main component ────────────────────────────────────────────────────────────

interface DDTODashboardProps {
  loggedInOperator: OperatorAuth
}

export const DDTODashboard: React.FC<DDTODashboardProps> = ({ loggedInOperator }) => {
  type ExpandRect = { left: number; top: number; width: number; height: number }
  const [payload, setPayload] = useState<LivePayload | null>(null)

  const [activeScenario, setActiveScenario] = useState<string | null>(null)
  const [scenarioStatus, setScenarioStatus] = useState('')
  /** Active biometric metric in enlarged modal view */
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null)
  const [expandedFromRect, setExpandedFromRect] = useState<ExpandRect | null>(null)
  const [expandedAnimatingIn, setExpandedAnimatingIn] = useState(false)
  const [expandedAnimatingOut, setExpandedAnimatingOut] = useState(false)
  const tileRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const prevExplanationRef  = useRef<string>('')
  const [claudeTs, setClaudeTs]     = useState<number>(Date.now())
  const [secondsAgo, setSecondsAgo] = useState(0)

  const opId = loggedInOperator.operator_id

  useEffect(() => {
    return reactorWS.onMessage(p => { setPayload(p) })
  }, [])

  const wsOp = payload?.ddto?.[opId]
  const smooth = useSmoothedDDTO(opId, wsOp?.signals, wsOp?.prediction)
  const bioHist = useBiometricHistory(opId, wsOp?.signals)

  // Detect when Claude explanation refreshes
  useEffect(() => {
    const explanation = payload?.ddto?.[opId]?.claude_explanation
    if (explanation && explanation !== prevExplanationRef.current) {
      prevExplanationRef.current = explanation
      setClaudeTs(Date.now())
      setSecondsAgo(0)
    }
  }, [payload?.ddto?.[opId]?.claude_explanation, opId])

  // Tick "Updated Xs ago"
  useEffect(() => {
    const id = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - claudeTs) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [claudeTs])

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setPrefersReducedMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const handleScenario = async (scenarioId: string) => {
    if (activeScenario === scenarioId) {
      await ddtoApi.setScenario(opId, null).catch(console.error)
      setActiveScenario(null)
      setScenarioStatus('Scenario cleared')
    } else {
      await ddtoApi.setScenario(opId, scenarioId).catch(console.error)
      setActiveScenario(scenarioId)
      setScenarioStatus(`Active: ${scenarioId.replace(/_/g, ' ')}`)
    }
    setTimeout(() => setScenarioStatus(''), 3000)
  }

  const handleReset = async () => {
    await ddtoApi.reset().catch(console.error)
    setActiveScenario(null)
    setScenarioStatus('Twin reset')
    setTimeout(() => setScenarioStatus(''), 3000)
  }

  const handlePauseResume = async () => {
    const isPaused = payload?.simulation_paused ?? true
    if (isPaused) {
      await simControlApi.resume().catch(console.error)
    } else {
      await simControlApi.pause().catch(console.error)
    }
  }

  if (!payload || !payload.ddto) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: '#787878', fontFamily: 'var(--font-mono)', fontSize: 13,
        background: '#c6c6c6',
      }}>
        Connecting to DDTO engine…
      </div>
    )
  }

  // Live data — used for header, state pill, CCSI, Claude, right-column stats
  const selected = payload.ddto[opId]
  if (!selected) return null
  const pred    = selected.prediction
  const signals = selected.signals

  const baselineLatency = ({ op_a: 420, op_b: 510, op_c: 390 } as Record<string, number>)[opId] ?? 450
  const baselineError   = ({ op_a: 0.04, op_b: 0.09, op_c: 0.03 } as Record<string, number>)[opId] ?? 0.05

  const fatigueLabel = selected.profile.fatigue_rate > 1.2 ? 'High'
                     : selected.profile.fatigue_rate < 0.8 ? 'Low' : 'Normal'
  const biasLabel    = selected.profile.automation_bias_tendency > 0.6 ? 'High'
                     : selected.profile.automation_bias_tendency > 0.4 ? 'Moderate' : 'Low'

  const initials = selected.name
    .split(' ').map((n: string) => n[0]).join('').toUpperCase()

  // ── Forecast series: -5 min → now → +5/+10/+15 (smoothed loads) ────────────
  const lc = smooth?.forecastLoads ?? [
    pred.current_load_score,
    ...pred.forecast.map(f => f.load_score),
  ]
  const cur = lc[0] ?? pred.current_load_score
  const f5  = lc[1] ?? cur
  const f10 = lc[2] ?? f5
  const f15 = lc[3] ?? f10
  const pastLoad = Math.max(0, Math.min(1, cur - (f5 - cur)))

  const fx = (i: number) => CHART_LEFT + (i / 4) * (CHART_RIGHT - CHART_LEFT)
  const seriesLoads = [pastLoad, cur, f5, f10, f15]

  const forecastPoints = [
    { x: fx(0), load: seriesLoads[0] ?? 0, kind: 'past' as const },
    { x: fx(1), load: seriesLoads[1] ?? 0, kind: 'now' as const },
    ...([0, 1, 2] as const).map(i => ({
      x:    fx(i + 2),
      load: seriesLoads[i + 2] ?? 0,
      kind: 'future' as const,
    })),
  ]

  const svgPts = forecastPoints.map(p => ({ x: p.x, y: loadToY(p.load) }))
  const pastLinePath   = linearPath([svgPts[0], svgPts[1]])
  const futurePts      = [svgPts[1], svgPts[2], svgPts[3], svgPts[4]]
  const futureLinePath = smoothBezierPath(futurePts)
  const pastAreaPath   = areaUnderSegment(svgPts[0], svgPts[1], CHART_BOTTOM)
  const futureAreaPath =
    futureLinePath.length > 0
      ? closeSmoothPathToBottom(futureLinePath, svgPts[1].x, svgPts[4].x, CHART_BOTTOM)
      : ''

  const xNow = svgPts[1].x
  const xLast = svgPts[4].x
  const span = Math.max(1e-6, xLast - xNow)
  const futureGradStops = [
    { offset: '0%', color: FORECAST_BLUE },
    ...([2, 3, 4] as const).map(i => ({
      offset: `${((svgPts[i].x - xNow) / span) * 100}%`,
      color:  futureColorForLoad(seriesLoads[i]),
    })),
  ]

  let peakForecast: (typeof pred.forecast)[number] | null = null
  let peakLoadSmoothed = 0
  if (pred.forecast.length) {
    peakForecast = pred.forecast[0]
    peakLoadSmoothed = seriesLoads[2]
    for (let i = 0; i < pred.forecast.length; i++) {
      const l = seriesLoads[i + 2]
      if (l > peakLoadSmoothed) {
        peakLoadSmoothed = l
        peakForecast = pred.forecast[i]
      }
    }
  }

  const trendInfo = TREND_CONFIG[pred.trend as keyof typeof TREND_CONFIG] ?? TREND_CONFIG.stable

  const theta   = smooth?.theta   ?? signals.eeg.theta
  const alpha   = smooth?.alpha   ?? signals.eeg.alpha
  const beta    = smooth?.beta    ?? signals.eeg.beta
  const perclos = smooth?.perclos ?? signals.eye.perclos
  const blink   = smooth?.blink   ?? signals.eye.blink_rate
  const errS    = smooth?.error   ?? signals.performance.estimated_error_probability
  const curLoad = smooth?.currentLoad ?? pred.current_load_score

  const paramTiles = [
    { key: 'theta',   label: 'Theta · workload',    value: theta.toFixed(3),                         raw: theta },
    { key: 'alpha',   label: 'Alpha · alertness',   value: alpha.toFixed(3),                         raw: alpha },
    { key: 'beta',    label: 'Beta · focus',        value: beta.toFixed(3),                          raw: beta },
    { key: 'perclos', label: 'PERCLOS · fatigue',   value: `${(perclos * 100).toFixed(1)}%`,          raw: perclos },
    { key: 'blink',   label: 'Blink rate',          value: `${blink.toFixed(1)}/min`,                 raw: blink },
    { key: 'error',   label: 'Error probability',   value: `${(errS * 100).toFixed(1)}%`,              raw: errS },
  ]

  const latencyLive = smooth?.latencyMs ?? signals.performance.response_latency_ms
  const latencyDelta = latencyLive - baselineLatency
  const errorDelta   = errS - baselineError
  const dataSource   = (selected as unknown as Record<string, unknown>).data_source as string ?? 'synthetic'
  const currentState = pred.current_state
  const isNormal     = currentState === 'normal'

  const assessmentText = isNormal
    ? 'All cognitive parameters within your personal baseline. No action required.'
    : (selected.claude_explanation || 'Generating assessment…')

  const isPaused = payload?.simulation_paused ?? true

  const handleExpandMetric = (metricKey: string) => {
    const tileEl = tileRefs.current[metricKey]
    const r = tileEl?.getBoundingClientRect()
    if (r) {
      setExpandedFromRect({ left: r.left, top: r.top, width: r.width, height: r.height })
    } else {
      setExpandedFromRect(null)
    }
    setExpandedMetric(metricKey)
    if (prefersReducedMotion) {
      setExpandedAnimatingIn(true)
      setExpandedAnimatingOut(false)
      return
    }
    setExpandedAnimatingOut(false)
    setExpandedAnimatingIn(false)
    window.requestAnimationFrame(() => setExpandedAnimatingIn(true))
  }

  const handleCloseExpanded = () => {
    if (!expandedMetric) return
    if (prefersReducedMotion) {
      setExpandedMetric(null)
      setExpandedFromRect(null)
      setExpandedAnimatingIn(false)
      setExpandedAnimatingOut(false)
      return
    }
    setExpandedAnimatingOut(true)
    setExpandedAnimatingIn(false)
    window.setTimeout(() => {
      setExpandedMetric(null)
      setExpandedFromRect(null)
      setExpandedAnimatingOut(false)
    }, 320)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#c6c6c6', overflow: 'hidden' }}>
      <style>{`
        @keyframes ddto-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .ddto-paused-badge { animation: ddto-pulse 1.6s ease-in-out infinite; }
        .ddto-state-pill {
          transition: background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease;
        }
        .ddto-stat-pct {
          transition: color 0.35s ease;
        }
        .ddto-tile-accent {
          transition: border-bottom-color 0.35s ease;
        }
        .ddto-claude-border {
          transition: border-bottom-color 0.35s ease;
        }
        .ddto-bio-metric-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
          min-height: 18px;
        }
        .ddto-bio-sparkline-stack {
          position: relative;
          flex: 1 1 0;
          min-width: 72;
          height: 52px;
          min-height: 52px;
          border-radius: 4px;
          overflow: hidden;
          background: #bebebe;
        }
        .ddto-bio-sparkline-stack > .ddto-bio-sparkline-layer {
          position: absolute;
          inset: 0;
          opacity: 0.9;
        }
        .ddto-bio-expand-trigger {
          position: absolute;
          top: 2px;
          right: 2px;
          z-index: 4;
          border: none;
          margin: 0;
          padding: 5px;
          cursor: pointer;
          color: #555;
          background: rgba(180, 180, 180, 0.92);
          border-radius: 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 0;
          font-size: 12px;
          font-weight: 700;
          transition: color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ddto-bio-expand-trigger:hover {
          color: #080808;
          background: rgba(190,190,190,0.98);
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          transform: translateX(1px) scale(1.06);
        }
        .ddto-bio-expand-trigger:active {
          transform: translateX(0) scale(0.96);
        }
        .ddto-bio-expand-trigger:focus-visible {
          outline: 2px solid #22c55e;
          outline-offset: 1px;
        }
      `}</style>

      {/* ── STATUS BAR ─────────────────────────────────────────────────────── */}
      <div style={{
        background: '#1a1a1a', borderBottom: '1px solid #222',
        padding: '5px 16px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 24,
      }}>
        {[
          {
            label: 'Plant Risk',
            value: payload.risk_level.toUpperCase(),
            color: payload.risk_level === 'high' ? '#fca5a5' : payload.risk_level === 'medium' ? '#fde68a' : '#4ade80',
          },
          {
            label: 'Cognitive State',
            value: currentState.replace(/_/g, ' ').toUpperCase(),
            color: currentState === 'normal' ? '#4ade80' : '#fca5a5',
          },
          {
            label: 'Shift Time',
            value: `${selected.hours_into_shift.toFixed(1)}h`,
            color: '#e0e0e0',
          },
          {
            label: 'Confidence',
            value: `${Math.round(pred.confidence * 100)}%`,
            color: pred.confidence > 0.7 ? '#4ade80' : pred.confidence > 0.5 ? '#fde68a' : '#fca5a5',
          },
          {
            label: 'Signal',
            value: (selected as unknown as Record<string, unknown>).data_source === 'real' ? 'Real EEG' : 'Synthetic',
            color: (selected as unknown as Record<string, unknown>).data_source === 'real' ? '#4ade80' : '#9a9a9a',
          },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 9, color: '#7a7a7a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              {item.label}
            </span>
            <span style={{ fontSize: 11, color: item.color, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── COCKPIT HEADER — compact ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 16px',
        background: '#d2d2d2', borderBottom: '1px solid #b4b4b4',
        flexShrink: 0,
      }}>
        {/* Avatar */}
        <div style={{
          width: 40, height: 40, borderRadius: 6,
          background: '#b4b4b4', border: '1px solid #a0a0a0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#080808', fontFamily: 'var(--font-head)' }}>
            {initials}
          </span>
        </div>

        {/* Name block */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#080808', fontFamily: 'var(--font-head)', lineHeight: 1 }}>
              {selected.name}
            </span>
            <span className="ddto-state-pill" style={{
              fontSize: 10, fontWeight: 800,
              background: sbg(currentState), color: slabel(currentState),
              border: `1px solid ${sborder(currentState)}`,
              padding: '2px 10px', borderRadius: 4, letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              {stext(currentState)}
            </span>
            {selected.scenario_override && (
              <span style={{
                fontSize: 9, fontWeight: 700,
                background: '#78350f', color: '#fde68a', border: '1px solid #92400e',
                padding: '2px 8px', borderRadius: 4, letterSpacing: '0.04em',
              }}>
                ▶ {selected.scenario_override.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#2a2a2a' }}>{loggedInOperator.role}</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#787878' }}>{loggedInOperator.badge_id}</span>
            <span style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4ade80',
              background: '#14532d', padding: '1px 7px', borderRadius: 4, border: '1px solid #166534',
            }}>
              Shift: {selected.hours_into_shift.toFixed(1)}h
            </span>
            <span style={{ fontSize: 10, color: '#787878' }}>
              {selected.experience_years} yrs · Fatigue {fatigueLabel} · Bias {biasLabel}
            </span>
          </div>
        </div>

        {/* Demo controls */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>

          {/* ── Pause / Resume ── */}
          {isPaused && (
            <span className="ddto-paused-badge" style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#fde68a',
              background: '#78350f', border: '1px solid #92400e',
              padding: '2px 8px', borderRadius: 4,
            }}>
              ⏸ PAUSED
            </span>
          )}
          <button
            onClick={handlePauseResume}
            style={{
              padding: '3px 11px', fontSize: 9, fontFamily: 'var(--font-head)', fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
              border: `1px solid ${isPaused ? '#166534' : '#b4b4b4'}`,
              borderRadius: 4,
              background: isPaused ? '#14532d' : '#bebebe',
              color: isPaused ? '#4ade80' : '#2a2a2a',
              transition: 'all 0.15s',
            }}
          >
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>

          <div style={{ width: 1, height: 16, background: '#b4b4b4', margin: '0 2px' }} />

          <span style={{
            fontSize: 9, color: '#787878', textTransform: 'uppercase',
            letterSpacing: '0.12em', fontFamily: 'var(--font-head)', fontWeight: 700, marginRight: 3,
          }}>
            Demo
          </span>
          {DEMO_SCENARIOS.map(s => (
            <button key={s.id} onClick={() => handleScenario(s.id)} style={{
              padding: '3px 9px', fontSize: 9, fontFamily: 'var(--font-head)', fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              border: `1px solid ${activeScenario === s.id ? s.color : '#b4b4b4'}`,
              borderRadius: 4,
              background: activeScenario === s.id ? `${s.color}28` : '#bebebe',
              color: activeScenario === s.id ? s.color : '#2a2a2a',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {activeScenario === s.id ? '■ ' : '▶ '}{s.label}
            </button>
          ))}
          <button onClick={handleReset} style={{
            padding: '3px 9px', fontSize: 9, fontFamily: 'var(--font-head)', fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            border: '1px solid #7f1d1d', borderRadius: 4, background: '#7f1d1d', color: '#fca5a5', cursor: 'pointer',
          }}>
            ↺ Reset
          </button>
          {scenarioStatus && (
            <span style={{ fontSize: 9, color: '#22c55e', fontFamily: 'var(--font-mono)' }}>
              {scenarioStatus}
            </span>
          )}
        </div>
      </div>

      {/* ── 2-column body — fills remaining height, no scroll on outer ─────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 230px',
        flex: 1, overflow: 'hidden', minHeight: 0,
      }}>

        {/* ── CENTER COLUMN ───────────────────────────────────────────────── */}
        <div style={{
          padding: '8px 8px 8px 12px',
          display: 'flex', flexDirection: 'column', gap: 8,
          overflowY: 'auto', minHeight: 0,
        }}>

          {/* ── 15-min Cognitive Forecast ─────────────────────────────────── */}
          <div style={{
            background: '#d2d2d2', border: '1px solid #b4b4b4', borderRadius: 6,
            padding: '10px 10px 8px', flexShrink: 0,
          }}>
            <div style={{
              fontSize: 10, color: '#787878', textTransform: 'uppercase',
              letterSpacing: '0.14em', fontFamily: 'var(--font-head)', fontWeight: 700, marginBottom: 10,
            }}>
              15-min Cognitive Forecast
            </div>

            {/* Summary stats row — compact */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
              {/* Current load */}
              <div style={{ background: '#bebebe', borderRadius: 4, padding: '6px 10px', borderBottom: '3px solid #22c55e' }}>
                <div style={{ fontSize: 10, color: '#787878', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                  Current load
                </div>
                <div className="ddto-stat-pct" style={{ fontSize: 17, fontWeight: 700, color: fsc(currentState), fontFamily: 'var(--font-mono)', lineHeight: 1, marginBottom: 2 }}>
                  {Math.round(curLoad * 100)}%
                </div>
                <div style={{ fontSize: 10, color: '#2a2a2a', fontWeight: 600, textTransform: 'capitalize' }}>
                  {currentState.replace(/_/g, ' ')}
                </div>
              </div>
              {/* Peak forecast */}
              <div style={{ background: '#bebebe', borderRadius: 4, padding: '6px 10px', borderBottom: '3px solid #888' }}>
                <div style={{ fontSize: 10, color: '#787878', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                  Peak forecast
                </div>
                <div className="ddto-stat-pct" style={{ fontSize: 17, fontWeight: 700, color: fsc(peakForecast?.predicted_state ?? 'normal'), fontFamily: 'var(--font-mono)', lineHeight: 1, marginBottom: 2 }}>
                  {Math.round(peakLoadSmoothed * 100)}%
                </div>
                <div style={{ fontSize: 10, color: '#2a2a2a', fontWeight: 600, textTransform: 'capitalize' }}>
                  {(peakForecast?.predicted_state ?? 'normal').replace(/_/g, ' ')}
                </div>
              </div>
              {/* Trend */}
              <div style={{ background: '#bebebe', borderRadius: 4, padding: '6px 10px', borderBottom: '3px solid #888' }}>
                <div style={{ fontSize: 10, color: '#787878', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                  Trend
                </div>
                <div className="ddto-stat-pct" style={{ fontSize: 17, fontWeight: 700, color: trendInfo.color, fontFamily: 'var(--font-mono)', lineHeight: 1, marginBottom: 2 }}>
                  {trendInfo.symbol}
                </div>
                <div className="ddto-stat-pct" style={{ fontSize: 10, fontWeight: 700, color: trendInfo.color }}>{trendInfo.label}</div>
              </div>
            </div>

            {/* SVG line graph — viewBox 480×92 (72px data + 20px x-axis labels) */}
            <svg viewBox="0 0 480 92" width="100%" style={{ display: 'block', overflow: 'visible' }}>
              <defs>
                <linearGradient id="ddto-fg-future-stroke" gradientUnits="userSpaceOnUse" x1={xNow} y1={0} x2={xLast} y2={0}>
                  {futureGradStops.map((s, i) => (
                    <stop key={i} offset={s.offset} stopColor={s.color} />
                  ))}
                </linearGradient>
                <linearGradient id="ddto-fg-future-fill" gradientUnits="userSpaceOnUse" x1={xNow} y1={0} x2={xLast} y2={0}>
                  {futureGradStops.map((s, i) => (
                    <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={0.18} />
                  ))}
                </linearGradient>
              </defs>

              {FORECAST_Y_TICKS_PCT.map(pct => {
                const y = loadToY(pct / 100)
                return (
                  <g key={pct}>
                    <line
                      x1={CHART_LEFT} y1={y} x2={CHART_RIGHT} y2={y}
                      stroke="#b4b4b4" strokeWidth={pct === 0 ? 1 : 0.75}
                    />
                    <text
                      x={Y_LABEL_X} y={y + 2}
                      textAnchor="end" fill="#787878" fontSize={7}
                      fontFamily="ui-monospace, monospace" style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {pct}%
                    </text>
                  </g>
                )
              })}

              {pastAreaPath ? <path d={pastAreaPath} fill={FORECAST_GREY_FILL} stroke="none" /> : null}
              {futureAreaPath ? <path d={futureAreaPath} fill="url(#ddto-fg-future-fill)" stroke="none" /> : null}
              {pastLinePath ? (
                <path
                  d={pastLinePath} fill="none" stroke={FORECAST_GREY_STROKE}
                  strokeWidth={1.15} strokeLinecap="butt" strokeLinejoin="miter"
                />
              ) : null}
              {futureLinePath ? (
                <path
                  d={futureLinePath} fill="none" stroke="url(#ddto-fg-future-stroke)"
                  strokeWidth={1.15} strokeLinecap="round" strokeLinejoin="round"
                />
              ) : null}

              {forecastPoints.map((pt, i) => {
                const y = loadToY(pt.load)
                const strokeC = pt.kind === 'past'
                  ? FORECAST_GREY_STROKE
                  : pt.kind === 'now'
                    ? '#22c55e'
                    : futureColorForLoad(pt.load)
                const fillC = pt.kind === 'past' ? '#bebebe' : pt.kind === 'now' ? '#14532d' : '#d2d2d2'
                return (
                  <g key={i}>
                    <circle cx={pt.x} cy={y} r={pt.kind === 'now' ? 4 : 3} fill={fillC} stroke={strokeC} strokeWidth={pt.kind === 'now' ? 1.75 : 1.25} />
                    {pt.kind === 'now' && (
                      <text
                        x={pt.x} y={y - 7} textAnchor="middle"
                        fill="#4ade80" fontSize={7} fontWeight={700}
                        fontFamily="ui-monospace, monospace"
                      >
                        {Math.round(pt.load * 100)}%
                      </text>
                    )}
                  </g>
                )
              })}

              {forecastPoints.map((pt, i) => (
                <text
                  key={i}
                  x={pt.x}
                  y={87}
                  textAnchor="middle"
                  fill={pt.kind === 'now' ? '#080808' : '#2a2a2a'}
                  fontSize={7}
                  fontWeight={pt.kind === 'now' ? 700 : 600}
                  fontFamily="system-ui, sans-serif"
                >
                  {FORECAST_X_LABELS[i]}
                </text>
              ))}
            </svg>
          </div>

          {/* ── Biometric Parameters ─────────────────────────────────────── */}
          <div style={{
            background: '#d2d2d2', border: '1px solid #b4b4b4', borderRadius: 6,
            padding: '10px 10px 8px', flexShrink: 0,
          }}>
            <div style={{
              fontSize: 10, color: '#787878', textTransform: 'uppercase',
              letterSpacing: '0.14em', fontFamily: 'var(--font-head)', fontWeight: 700, marginBottom: 10,
            }}>
              Biometric Parameters
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {paramTiles.map(tile => {
                const st = paramStatus(tile.key, tile.raw)
                const bioBorder = st.color === '#22c55e' ? '#22c55e' : '#dc2626'
                const detail = PARAM_DETAILS[tile.key]
                const sparkKey = tile.key as BiometricMetricKey
                return (
                  <div key={tile.key} className="ddto-tile-accent" style={{
                    background: '#bebebe',
                    borderBottom: `3px solid ${bioBorder}`,
                    borderRadius: 4, padding: '8px 10px',
                    position: 'relative',
                  }} ref={(el) => { tileRefs.current[tile.key] = el }}>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: '0 1 auto', minWidth: 0 }}>
                        <div className="ddto-bio-metric-header">
                          <span style={{ fontSize: 11, color: '#2a2a2a', fontWeight: 700, lineHeight: 1.38, flex: 1, minWidth: 0 }}>
                            {tile.label}
                          </span>
                        </div>
                        <div style={{
                          fontSize: 21, fontWeight: 700, color: '#080808',
                          fontFamily: 'var(--font-mono)', marginBottom: 5, lineHeight: 1,
                          transition: 'color 0.35s ease',
                        }}>
                          {tile.value}
                        </div>
                        <div style={{
                          display: 'inline-block', fontSize: 10, fontWeight: 700,
                          color: bioBorder === '#22c55e' ? '#4ade80' : '#fca5a5',
                          background: bioBorder === '#22c55e' ? '#14532d' : '#7f1d1d',
                          padding: '2px 9px', borderRadius: 4, letterSpacing: '0.06em',
                          transition: 'color 0.35s ease, background-color 0.35s ease',
                        }}>
                          {st.label}
                        </div>
                      </div>
                      <div className="ddto-bio-sparkline-stack">
                        <div className="ddto-bio-sparkline-layer">
                          <MetricSparkline values={bioHist[sparkKey]} stroke={st.color} />
                        </div>
                        {detail && (
                          <>
                            <button
                              type="button"
                              className="ddto-bio-expand-trigger"
                              aria-label={`Expand ${tile.label} details`}
                              onClick={() => handleExpandMetric(tile.key)}
                            >
                              ⤢
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── CCSI Panel — live, fills remaining space ──────────────────── */}
          {payload.ccsi && (
            <CCSIPanel ccsi={payload.ccsi} />
          )}
        </div>

        {/* ── RIGHT COLUMN — live data ─────────────────────────────────────── */}
        <div style={{
          borderLeft: '1px solid #b4b4b4', background: '#c6c6c6',
          padding: '8px 10px 8px 8px',
          display: 'flex', flexDirection: 'column', gap: 8,
          overflowY: 'auto', minHeight: 0,
        }}>

          {/* Claude Assessment */}
          <div className="ddto-claude-border" style={{
            background: '#d2d2d2', border: '1px solid #b4b4b4',
            borderBottom: '3px solid #22c55e',
            borderRadius: 6, padding: '10px 12px',
          }}>
            <div style={{
              fontSize: 10, color: '#787878', textTransform: 'uppercase',
              letterSpacing: '0.14em', fontFamily: 'var(--font-head)', fontWeight: 700, marginBottom: 7,
            }}>
              Claude Assessment
            </div>
            <div style={{
              display: 'inline-block', background: '#14532d', color: '#4ade80',
              fontSize: 10, fontWeight: 800, borderRadius: 4, padding: '2px 8px',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', marginBottom: 8,
              textTransform: 'uppercase',
            }}>
              claude-sonnet-4-6
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#2a2a2a', lineHeight: 1.7, marginBottom: 8 }}>
              {assessmentText}
            </div>
            {!isNormal && (
              <div style={{ fontSize: 10, color: '#787878', fontFamily: 'var(--font-mono)' }}>
                Updated {secondsAgo}s ago
              </div>
            )}
          </div>

          {/* Performance deltas — live */}
          <StatCard
            label="Response latency"
            value={`${Math.round(latencyLive)}ms`}
            delta={latencyDelta > 0 ? `+${Math.round(latencyDelta)}ms` : `${Math.round(latencyDelta)}ms`}
            deltaColor={latencyDelta > 60 ? '#dc2626' : latencyDelta > 30 ? '#f59e0b' : '#22c55e'}
          />
          <StatCard
            label="Error probability"
            value={`${(errS * 100).toFixed(1)}%`}
            delta={errorDelta > 0 ? `+${(errorDelta * 100).toFixed(1)}%` : `${(errorDelta * 100).toFixed(1)}%`}
            deltaColor={errorDelta > 0.05 ? '#dc2626' : errorDelta > 0.02 ? '#f59e0b' : '#22c55e'}
          />
          <StatCard
            label="Plant risk"
            value={payload.risk_level.charAt(0).toUpperCase() + payload.risk_level.slice(1)}
            delta={payload.risk_level === 'high' ? 'CRITICAL' : payload.risk_level === 'medium' ? 'MODERATE' : 'NOMINAL'}
            deltaColor={payload.risk_level === 'high' ? '#dc2626' : payload.risk_level === 'medium' ? '#f59e0b' : '#22c55e'}
          />

          {/* Data source badge */}
          <div style={{
            background: '#d2d2d2', border: '1px solid #b4b4b4', borderRadius: 6,
            padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: dataSource === 'real' ? '#22c55e' : '#787878', flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: '#2a2a2a' }}>
              {dataSource === 'real' ? 'Real EEG data active' : 'Synthetic signals active'}
            </span>
          </div>
        </div>

      </div>

      {expandedMetric && (() => {
        const tile = paramTiles.find(t => t.key === expandedMetric)
        if (!tile) return null
        const detail = PARAM_DETAILS[tile.key]
        const st = paramStatus(tile.key, tile.raw)
        const sparkKey = tile.key as BiometricMetricKey
        const viewportW = window.innerWidth
        const viewportH = window.innerHeight
        const targetWidth = Math.min(860, Math.max(320, viewportW - 32))
        const targetHeight = Math.min(560, Math.max(360, viewportH - 32))
        const targetRect = {
          left: (viewportW - targetWidth) / 2,
          top: (viewportH - targetHeight) / 2,
          width: targetWidth,
          height: targetHeight,
        }
        const fromRect = expandedFromRect ?? targetRect
        const cardRect = expandedAnimatingOut
          ? fromRect
          : (expandedAnimatingIn ? targetRect : fromRect)
        const contentVisible = expandedAnimatingIn && !expandedAnimatingOut
        const history = bioHist[sparkKey] ?? []
        const minV = history.length ? Math.min(...history) : tile.raw
        const maxV = history.length ? Math.max(...history) : tile.raw
        const avgV = history.length ? history.reduce((s, v) => s + v, 0) / history.length : tile.raw
        const variance = history.length
          ? history.reduce((s, v) => s + (v - avgV) ** 2, 0) / history.length
          : 0
        const stdV = Math.sqrt(variance)
        const firstV = history.length ? history[0] : tile.raw
        const lastV = history.length ? history[history.length - 1] : tile.raw
        const deltaV = lastV - firstV
        const trendBand = Math.max((maxV - minV) * 0.08, 1e-4)
        const trendLabel = deltaV > trendBand ? 'Rising' : deltaV < -trendBand ? 'Falling' : 'Stable'
        const chartMin = Math.min(minV, avgV - stdV)
        const chartMax = Math.max(maxV, avgV + stdV)
        const chartRange = Math.max(chartMax - chartMin, 1e-9)
        const chartW = 480
        const chartH = 170
        const chartPad = 14
        const innerW = chartW - chartPad * 2
        const innerH = chartH - chartPad * 2
        const yFromValue = (v: number) =>
          chartPad + (1 - (v - chartMin) / chartRange) * innerH
        const pts = history.length > 1
          ? history.map((v, i) => ({
            x: chartPad + (i / (history.length - 1)) * innerW,
            y: yFromValue(v),
          }))
          : [
            { x: chartPad, y: yFromValue(lastV) },
            { x: chartW - chartPad, y: yFromValue(lastV) },
          ]
        const pathD = smoothBezierPath(pts)
        const baselineLow = avgV - stdV
        const baselineHigh = avgV + stdV
        const baselineY1 = yFromValue(Math.min(baselineLow, baselineHigh))
        const baselineY2 = yFromValue(Math.max(baselineLow, baselineHigh))
        const thresholds = metricThresholds(tile.key)
        const thresholdYHigh = thresholds.high !== undefined ? yFromValue(thresholds.high) : null
        const thresholdYLow = thresholds.low !== undefined ? yFromValue(thresholds.low) : null

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${tile.label} detailed view`}
            style={{
              position: 'fixed',
              inset: 0,
              background: contentVisible ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)',
              zIndex: 9999,
              transition: prefersReducedMotion ? 'none' : 'background 320ms ease',
            }}
            onClick={handleCloseExpanded}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: cardRect.left,
                top: cardRect.top,
                width: cardRect.width,
                height: expandedAnimatingIn || expandedAnimatingOut ? cardRect.height : 'auto',
                maxHeight: expandedAnimatingIn || expandedAnimatingOut ? cardRect.height : Math.min(viewportH - 32, 720),
                overflowY: 'auto',
                background: '#d2d2d2',
                border: '1px solid #b4b4b4',
                borderRadius: expandedAnimatingIn ? 8 : 4,
                padding: 14,
                boxSizing: 'border-box',
                transition: prefersReducedMotion ? 'none' : 'left 320ms cubic-bezier(0.22, 1, 0.36, 1), top 320ms cubic-bezier(0.22, 1, 0.36, 1), width 320ms cubic-bezier(0.22, 1, 0.36, 1), height 320ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 320ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
                opacity: contentVisible ? 1 : 0,
                transition: prefersReducedMotion ? 'none' : 'opacity 180ms ease 120ms',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#080808' }}>{tile.label}</div>
                <button
                  type="button"
                  onClick={handleCloseExpanded}
                  style={{
                    cursor: 'pointer',
                    border: '1px solid #b4b4b4',
                    borderRadius: 4,
                    padding: '4px 10px',
                    background: '#bebebe',
                    color: '#2a2a2a',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  Close
                </button>
              </div>

              <div style={{
                background: '#bebebe',
                borderRadius: 6,
                padding: 10,
                marginBottom: 12,
                opacity: contentVisible ? 1 : 0,
                transition: prefersReducedMotion ? 'none' : 'opacity 180ms ease 140ms',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 28, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#080808' }}>{tile.value}</div>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: st.color,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {st.label}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#2a2a2a', fontWeight: 600 }}>
                    vs session baseline: {(deltaV >= 0 ? '+' : '') + deltaV.toFixed(3)}
                  </div>
                </div>
                <div style={{ height: 190, background: '#b8b8b8', borderRadius: 6, padding: 8 }}>
                  <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height="100%" style={{ display: 'block' }} aria-hidden>
                    <rect
                      x={chartPad}
                      y={Math.min(baselineY1, baselineY2)}
                      width={innerW}
                      height={Math.max(1, Math.abs(baselineY2 - baselineY1))}
                      fill="rgba(34, 197, 94, 0.14)"
                    />
                    {thresholdYHigh !== null && (
                      <line
                        x1={chartPad}
                        x2={chartW - chartPad}
                        y1={thresholdYHigh}
                        y2={thresholdYHigh}
                        stroke="#dc2626"
                        strokeDasharray="5 5"
                        strokeWidth={1}
                      />
                    )}
                    {thresholdYLow !== null && (
                      <line
                        x1={chartPad}
                        x2={chartW - chartPad}
                        y1={thresholdYLow}
                        y2={thresholdYLow}
                        stroke="#dc2626"
                        strokeDasharray="5 5"
                        strokeWidth={1}
                      />
                    )}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={st.color}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx={pts[pts.length - 1]?.x ?? chartW - chartPad}
                      cy={pts[pts.length - 1]?.y ?? yFromValue(lastV)}
                      r={4}
                      fill="#d2d2d2"
                      stroke={st.color}
                      strokeWidth={2}
                    />
                  </svg>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 8,
                marginBottom: 12,
                opacity: contentVisible ? 1 : 0,
                transition: prefersReducedMotion ? 'none' : 'opacity 180ms ease 150ms',
              }}>
                {[
                  { label: 'Min (5m)', value: minV.toFixed(3) },
                  { label: 'Max (5m)', value: maxV.toFixed(3) },
                  { label: 'Avg (5m)', value: avgV.toFixed(3) },
                  { label: 'Trend', value: trendLabel },
                ].map(stat => (
                  <div key={stat.label} style={{
                    background: '#bebebe',
                    border: '1px solid #b4b4b4',
                    borderRadius: 6,
                    padding: '8px 10px',
                  }}>
                    <div style={{
                      fontSize: 10,
                      color: '#787878',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontWeight: 700,
                      marginBottom: 4,
                    }}>
                      {stat.label}
                    </div>
                    <div style={{ fontSize: 14, color: '#080808', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>

              {detail && (
                <div style={{
                  opacity: contentVisible ? 1 : 0,
                  transition: prefersReducedMotion ? 'none' : 'opacity 180ms ease 160ms',
                }}>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#080808',
                    fontFamily: 'var(--font-head)',
                    letterSpacing: '0.03em',
                    marginBottom: 6,
                  }}>
                    {detail.headline}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.7, color: '#2a2a2a', fontFamily: 'var(--font-ui)' }}>
                    {detail.body}
                  </div>
                  <div style={{
                    marginTop: 8,
                    padding: '8px 10px',
                    background: '#c4c4c4',
                    borderLeft: `3px solid ${st.color}`,
                    borderRadius: 4,
                    fontSize: 11,
                    lineHeight: 1.6,
                    color: '#1f2937',
                    fontWeight: 600,
                  }}>
                    Operational hint: {metricActionHint(tile.key)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
