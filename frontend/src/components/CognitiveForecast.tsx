import React from 'react'
import type { DDTOPrediction, DDTOState, TrendLabel } from '../services/websocket'

interface Props {
  prediction: DDTOPrediction
  operatorName: string
  hoursIntoShift: number
}

const STATE_LABELS: Record<DDTOState, string> = {
  normal:        'Normal',
  elevated_load: 'Elevated Load',
  high_load:     'High Load',
  fatigued:      'Fatigued',
  critical:      'Critical',
}

const TREND_ICONS: Record<TrendLabel, string> = {
  stable:     '→',
  degrading:  '↗',
  recovering: '↘',
}

const TREND_COLORS: Record<TrendLabel, string> = {
  stable:     'var(--text-secondary)',
  degrading:  'var(--orange)',
  recovering: 'var(--green)',
}

function LoadBar({ score, color }: { score: number; color: string }) {
  return (
    <div style={{ position: 'relative', height: 6, background: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: `${Math.min(score * 100, 100)}%`,
        background: color,
        borderRadius: 3,
        transition: 'width 0.6s ease',
        boxShadow: score > 0.5 ? `0 0 8px ${color}` : 'none',
      }} />
    </div>
  )
}

export const CognitiveForecast: React.FC<Props> = ({ prediction, operatorName, hoursIntoShift }) => {
  const { current_state, current_load_score, trend, forecast, peak_risk_window, confidence, state_color } = prediction

  const trendColor = TREND_COLORS[trend]
  const trendIcon = TREND_ICONS[trend]

  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <div className="panel-header">
        <span>◎</span> Cognitive Trajectory — 15 Min Forecast
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
          Confidence: <span style={{ color: confidence > 0.7 ? 'var(--green)' : 'var(--yellow)' }}>{(confidence * 100).toFixed(0)}%</span>
        </span>
      </div>
      <div className="panel-body">

        {/* Current state row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: state_color,
            boxShadow: `0 0 10px ${state_color}`,
            flexShrink: 0,
          }} />
          <div>
            <div style={{
              fontFamily: 'var(--font-head)',
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: state_color,
              textTransform: 'uppercase',
            }}>
              {STATE_LABELS[current_state]}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              Load score: {(current_load_score * 100).toFixed(1)}% above baseline
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: trendColor }}>
              {trendIcon}
            </div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-head)', letterSpacing: '0.08em', color: trendColor, textTransform: 'uppercase' }}>
              {trend}
            </div>
          </div>
        </div>

        {/* Current load bar */}
        <div style={{ marginBottom: 16 }}>
          <LoadBar score={current_load_score} color={state_color} />
        </div>

        {/* Forecast timeline */}
        <div style={{ marginBottom: 12 }}>
          <div style={sectionLabel}>Predicted Trajectory</div>

          {/* Visual timeline */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 10, height: 70 }}>
            {/* Now marker */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: '100%',
                height: `${Math.max(8, current_load_score * 60)}px`,
                background: state_color,
                borderRadius: '3px 3px 0 0',
                opacity: 0.9,
                transition: 'height 0.5s',
                boxShadow: current_load_score > 0.4 ? `0 0 10px ${state_color}55` : 'none',
              }} />
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginTop: 4 }}>NOW</div>
            </div>

            {forecast.map(f => (
              <div key={f.minutes_ahead} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: '100%',
                  height: `${Math.max(8, f.load_score * 60)}px`,
                  background: f.color,
                  borderRadius: '3px 3px 0 0',
                  opacity: 0.7,
                  transition: 'height 0.5s',
                  boxShadow: f.load_score > 0.4 ? `0 0 8px ${f.color}44` : 'none',
                }} />
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginTop: 4 }}>
                  +{f.minutes_ahead}m
                </div>
              </div>
            ))}
          </div>

          {/* Forecast cards */}
          <div style={{ display: 'flex', gap: 8 }}>
            {forecast.map(f => (
              <div key={f.minutes_ahead} style={{
                flex: 1,
                padding: '7px 10px',
                background: 'var(--bg-surface)',
                border: `1px solid ${f.color}44`,
                borderRadius: 3,
              }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-head)', color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
                  +{f.minutes_ahead} min
                </div>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-head)', fontWeight: 600, color: f.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {STATE_LABELS[f.predicted_state]}
                </div>
                <LoadBar score={f.load_score} color={f.color} />
              </div>
            ))}
          </div>
        </div>

        {/* Peak risk summary */}
        <div style={{
          padding: '6px 10px',
          background: 'var(--bg-surface)',
          borderRadius: 3,
          borderLeft: `3px solid ${peak_risk_window.includes('No elevated') ? 'var(--green)' : 'var(--orange)'}`,
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: peak_risk_window.includes('No elevated') ? 'var(--green)' : 'var(--orange)',
        }}>
          {peak_risk_window}
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
  marginBottom: 8,
}
