import React from 'react'
import type { CCSI } from '../services/websocket'

interface Props {
  ccsi: CCSI
}

export const CCSIPanel: React.FC<Props> = ({ ccsi }) => {
  const scoreInt = Math.round(ccsi.score)
  const isCompound = ccsi.compound_penalty_active
  const isRelief = ccsi.relief_recommended

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${ccsi.color}44`,
      borderRadius: 10,
      overflow: 'hidden',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid #f1f5f9',
        background: '#fafbfc',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em' }}>
            CCSI
          </span>
          <span style={{ fontSize: 10, color: '#cbd5e1' }}>·</span>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>Crew Cognitive State Index</span>
        </div>
        {isRelief && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            background: '#fef2f2', color: '#dc2626',
            border: '1px solid #fecaca',
            padding: '2px 8px', borderRadius: 20,
          }}>
            Relief Recommended
          </span>
        )}
        {isCompound && !isRelief && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            background: '#fff7ed', color: '#c2410c',
            border: '1px solid #fed7aa',
            padding: '2px 8px', borderRadius: 20,
          }}>
            Compound Risk Active
          </span>
        )}
      </div>

      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'center', marginBottom: 12 }}>

          {/* Score circle */}
          <div style={{ position: 'relative', width: 72, height: 72 }}>
            <svg width="72" height="72" viewBox="0 0 72 72">
              {/* Track */}
              <circle cx="36" cy="36" r="28" fill="none" stroke="#f1f5f9" strokeWidth="6" />
              {/* Fill */}
              <circle
                cx="36" cy="36" r="28"
                fill="none"
                stroke={ccsi.color}
                strokeWidth="6"
                strokeDasharray={`${(scoreInt / 100) * 175.9} 175.9`}
                strokeLinecap="round"
                transform="rotate(-90 36 36)"
                style={{ transition: 'stroke-dasharray 0.8s ease' }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: ccsi.color, lineHeight: 1 }}>
                {scoreInt}
              </span>
              <span style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>/ 100</span>
            </div>
          </div>

          {/* Level + details */}
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: ccsi.color, marginBottom: 2 }}>
              {ccsi.level}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, lineHeight: 1.5 }}>
              {ccsi.description}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
              <span style={{ color: '#cbd5e1' }}>Driver: </span>
              {ccsi.risk_driver}
            </div>
          </div>
        </div>

        {/* Compound penalty callout */}
        {isCompound && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 10px',
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: 7,
            marginBottom: 10,
            fontSize: 11, color: '#92400e',
          }}>
            <span style={{ fontSize: 14 }}>⚠</span>
            <span>
              Compound crew penalty applied: <strong>−{ccsi.compound_penalty_value} pts</strong> — multiple operators degraded simultaneously
            </span>
          </div>
        )}

        {/* Individual contributions */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>
            Individual contributions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ccsi.individual_contributions.map(op => (
              <div key={op.operator_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: op.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#334155', width: 100, flexShrink: 0 }}>{op.name}</span>
                <div style={{ flex: 1, height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: op.color,
                    width: `${op.load_score * 100}%`,
                    transition: 'width 0.5s',
                  }} />
                </div>
                <span style={{ fontSize: 10, color: op.color, fontWeight: 600, minWidth: 60, textAlign: 'right', textTransform: 'uppercase' }}>
                  {op.state.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CCSI Forecast */}
        {ccsi.forecast.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>
              Crew forecast
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {ccsi.forecast.map(f => (
                <div key={f.minutes_ahead} style={{
                  flex: 1, textAlign: 'center',
                  padding: '6px 4px',
                  background: '#f8fafc',
                  borderRadius: 7,
                  border: `1px solid ${f.color}33`,
                }}>
                  <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 3 }}>+{f.minutes_ahead}m</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: f.color }}>{Math.round(f.score)}</div>
                  <div style={{ fontSize: 9, color: f.color, fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>
                    {f.level}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
