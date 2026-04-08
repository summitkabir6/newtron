import React from 'react'
import type { OperatorSnapshot, DDTOState } from '../services/websocket'

interface Props {
  operators: Record<string, OperatorSnapshot>
  selectedId: string
  onSelect: (id: string) => void
}

const stateColors: Record<DDTOState, string> = {
  normal:        'var(--green)',
  elevated_load: 'var(--yellow)',
  high_load:     'var(--orange)',
  fatigued:      'var(--orange)',
  critical:      'var(--red)',
}

const stateLabels: Record<DDTOState, string> = {
  normal:        'Normal',
  elevated_load: 'Elevated',
  high_load:     'High Load',
  fatigued:      'Fatigued',
  critical:      'Critical',
}

export const OperatorSelector: React.FC<Props> = ({ operators, selectedId, onSelect }) => {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
      {Object.values(operators).map(op => {
        const state = op.prediction?.current_state ?? 'normal'
        const color = stateColors[state]
        const isSelected = op.operator_id === selectedId

        return (
          <div
            key={op.operator_id}
            onClick={() => onSelect(op.operator_id)}
            style={{
              flex: 1,
              padding: '12px 14px',
              background: isSelected ? 'var(--bg-raised)' : 'var(--bg-panel)',
              border: `1px solid ${isSelected ? color : 'var(--border)'}`,
              borderRadius: 4,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: isSelected ? `0 0 12px ${color}22` : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: color,
                boxShadow: `0 0 6px ${color}`,
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: 'var(--font-head)',
                fontSize: 13,
                fontWeight: 600,
                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}>
                {op.name}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                fontFamily: 'var(--font-head)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color,
              }}>
                {stateLabels[state]}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-secondary)',
              }}>
                {op.hours_into_shift?.toFixed(1)}h
              </span>
            </div>
            {/* Load bar */}
            <div style={{ marginTop: 6, height: 3, background: 'var(--bg-surface)', borderRadius: 2 }}>
              <div style={{
                height: '100%',
                width: `${(op.prediction?.current_load_score ?? 0) * 100}%`,
                background: color,
                borderRadius: 2,
                transition: 'width 0.5s',
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
