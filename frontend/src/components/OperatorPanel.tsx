import React from 'react'
import type { OperatorState, AuthorityMode, CognitiveState } from '../services/websocket'
import { api } from '../services/api'

interface Props {
  operatorState: OperatorState
  authorityMode: AuthorityMode
}

const cognitiveColors: Record<CognitiveState, string> = {
  normal:          'var(--green)',
  tunneling:       'var(--yellow)',
  overwhelmed:     'var(--red)',
  automation_bias: 'var(--purple)',
}

const cognitiveDescriptions: Record<CognitiveState, string> = {
  normal:          'Engaged and responsive',
  tunneling:       'Focus narrowed to single area',
  overwhelmed:     'High load, low acknowledgment',
  automation_bias: 'Accepting all recommendations without manual verification',
}

export const OperatorPanel: React.FC<Props> = ({ operatorState, authorityMode }) => {
  const { cognitive_state, recent_events, total_recent_interactions } = operatorState
  const cogColor = cognitiveColors[cognitive_state]

  const sendFocus = () => api.recordEvent('panel_focus', 'operator_panel').catch(console.error)

  return (
    <div className="panel" style={{ marginBottom: 16 }} onClick={sendFocus}>
      <div className="panel-header">
        <span>◉</span> Operator State
        <span style={{ marginLeft: 'auto' }} className={`authority-badge auth-${authorityMode}`}>
          {authorityMode}
        </span>
      </div>
      <div className="panel-body">

        {/* Cognitive state */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-head)', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>
            Cognitive State
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: 'var(--font-head)',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: cogColor,
            }}>
              {cognitive_state.replace('_', ' ')}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
            {cognitiveDescriptions[cognitive_state]}
          </div>
        </div>

        {/* Interaction metrics */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={statStyle}>
            <div style={statLabel}>Interactions (2min)</div>
            <div style={{ ...statValue, color: 'var(--blue)' }}>{total_recent_interactions}</div>
          </div>
          <div style={statStyle}>
            <div style={statLabel}>Recent Events</div>
            <div style={{ ...statValue, color: 'var(--text-primary)' }}>{recent_events.length}</div>
          </div>
        </div>

        {/* Recent event log */}
        {recent_events.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-head)', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase' }}>
              Recent Events
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {recent_events.slice().reverse().map((ev, i) => (
                <div key={i} style={{
                  display: 'flex',
                  gap: 8,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                }}>
                  <span style={{ color: 'var(--text-dim)' }}>›</span>
                  <span style={{ color: 'var(--blue)' }}>{ev.type}</span>
                  {ev.detail && <span>{ev.detail}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const statStyle: React.CSSProperties = {
  flex: 1,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 3,
  padding: '6px 10px',
}
const statLabel: React.CSSProperties = {
  fontSize: 10,
  fontFamily: 'var(--font-head)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  marginBottom: 2,
}
const statValue: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 18,
}
