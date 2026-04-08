import React, { useEffect, useRef } from 'react'
import type { EEGSignal, EyeSignal } from '../services/websocket'

interface SignalHistory {
  theta: number[]
  alpha: number[]
  beta: number[]
  perclos: number[]
  blink_rate: number[]
}

interface Props {
  eeg: EEGSignal
  eye: EyeSignal
  history: SignalHistory
}

const COLORS = {
  theta: '#f0c040',   // yellow — workload
  alpha: '#00e5a0',   // green — alertness
  beta:  '#3ab8ff',   // blue — concentration
  perclos: '#ff7c35', // orange — fatigue
}

const LABELS = {
  theta: 'Theta (Workload)',
  alpha: 'Alpha (Alertness)',
  beta:  'Beta (Concentration)',
  perclos: 'PERCLOS (Fatigue)',
}

function drawTrace(
  canvas: HTMLCanvasElement,
  datasets: { key: string; values: number[]; color: string; min: number; max: number }[]
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)

  // Background grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 1
  for (let i = 1; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo(0, (height / 4) * i)
    ctx.lineTo(width, (height / 4) * i)
    ctx.stroke()
  }

  for (const ds of datasets) {
    if (ds.values.length < 2) continue
    const range = ds.max - ds.min || 1
    ctx.strokeStyle = ds.color
    ctx.lineWidth = 1.5
    ctx.shadowColor = ds.color
    ctx.shadowBlur = 4
    ctx.beginPath()
    ds.values.forEach((v, i) => {
      const x = (i / (ds.values.length - 1)) * width
      const normalized = (v - ds.min) / range
      const y = height - normalized * height * 0.85 - height * 0.075
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
    ctx.shadowBlur = 0
  }
}

export const SignalTrace: React.FC<Props> = ({ eeg, eye, history }) => {
  const eegRef = useRef<HTMLCanvasElement>(null)
  const eyeRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (eegRef.current) {
      drawTrace(eegRef.current, [
        { key: 'theta', values: history.theta, color: COLORS.theta, min: 0.1, max: 0.9 },
        { key: 'alpha', values: history.alpha, color: COLORS.alpha, min: 0.1, max: 0.9 },
        { key: 'beta',  values: history.beta,  color: COLORS.beta,  min: 0.05, max: 0.85 },
      ])
    }
    if (eyeRef.current) {
      drawTrace(eyeRef.current, [
        { key: 'perclos', values: history.perclos, color: COLORS.perclos, min: 0, max: 0.6 },
        { key: 'blink_rate', values: history.blink_rate.map(v => v / 35), color: '#a07cff', min: 0, max: 1 },
      ])
    }
  }, [history])

  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <div className="panel-header">
        <span>∿</span> Live Biometric Signals — CognShield Stream
      </div>
      <div className="panel-body" style={{ padding: '10px 14px' }}>

        {/* EEG section */}
        <div style={{ marginBottom: 10 }}>
          <div style={sectionLabel}>EEG Band Powers</div>
          <canvas
            ref={eegRef}
            width={800}
            height={80}
            style={{ width: '100%', height: 80, display: 'block', borderRadius: 3 }}
          />
          <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
            {(['theta', 'alpha', 'beta'] as const).map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 20, height: 2, background: COLORS[k], borderRadius: 1 }} />
                <span style={{ fontSize: 10, fontFamily: 'var(--font-head)', letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  {k}
                </span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: COLORS[k] }}>
                  {(eeg[k] ?? 0).toFixed(3)}
                </span>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
              <div style={ratioBox}>
                <span style={{ color: 'var(--text-secondary)' }}>θ/α</span>
                <span style={{ color: eeg.theta_alpha_ratio > 1.2 ? 'var(--orange)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {eeg.theta_alpha_ratio?.toFixed(3)}
                </span>
              </div>
              <div style={ratioBox}>
                <span style={{ color: 'var(--text-secondary)' }}>EI</span>
                <span style={{ color: 'var(--blue)', fontFamily: 'var(--font-mono)' }}>
                  {eeg.engagement_index?.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <hr />

        {/* Eye section */}
        <div>
          <div style={sectionLabel}>Eye Tracking — IR Sensors</div>
          <canvas
            ref={eyeRef}
            width={800}
            height={60}
            style={{ width: '100%', height: 60, display: 'block', borderRadius: 3 }}
          />
          <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
            <div style={eyeMetric}>
              <span style={{ color: 'var(--text-secondary)' }}>Blink Rate</span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                color: eye.blink_rate < 8 ? 'var(--orange)' : 'var(--text-primary)',
              }}>
                {eye.blink_rate?.toFixed(1)}<span style={{ color: 'var(--text-dim)', fontSize: 10 }}>/min</span>
              </span>
            </div>
            <div style={eyeMetric}>
              <span style={{ color: 'var(--text-secondary)' }}>PERCLOS</span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                color: eye.perclos > 0.2 ? 'var(--red)' : eye.perclos > 0.12 ? 'var(--yellow)' : 'var(--green)',
              }}>
                {((eye.perclos ?? 0) * 100).toFixed(1)}<span style={{ color: 'var(--text-dim)', fontSize: 10 }}>%</span>
              </span>
            </div>
            <div style={eyeMetric}>
              <span style={{ color: 'var(--text-secondary)' }}>Pupil Dilation</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple)' }}>
                {eye.pupil_dilation?.toFixed(3)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontFamily: 'var(--font-head)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  marginBottom: 6,
}

const ratioBox: React.CSSProperties = {
  display: 'flex',
  gap: 5,
  alignItems: 'center',
  fontSize: 11,
  fontFamily: 'var(--font-head)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const eyeMetric: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  fontSize: 11,
  fontFamily: 'var(--font-head)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}
