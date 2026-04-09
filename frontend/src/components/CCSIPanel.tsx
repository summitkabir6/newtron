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
      background: '#d2d2d2',
      border: `1px solid #b4b4b4`,
      borderRadius: 6,
      overflow: 'hidden',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid #b4b4b4',
        background: '#d2d2d2',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#787878', textTransform: 'uppercase', letterSpacing: '.14em' }}>
            CCSI
          </span>
          <span style={{ fontSize: 10, color: '#888' }}>·</span>
          <span style={{ fontSize: 10, color: '#787878' }}>Crew Cognitive State Index</span>
        </div>
        {isRelief && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: '#7f1d1d', color: '#fca5a5',
            border: '1px solid #991b1b',
            padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Relief Recommended
          </span>
        )}
        {isCompound && !isRelief && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: '#78350f', color: '#fde68a',
            border: '1px solid #92400e',
            padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em',
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
              <circle cx="36" cy="36" r="28" fill="none" stroke="#b4b4b4" strokeWidth="6" />
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
              <span style={{ fontSize: 9, color: '#787878', marginTop: 1 }}>/ 100</span>
            </div>
          </div>

          {/* Level + details */}
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: ccsi.color, marginBottom: 2 }}>
              {ccsi.level}
            </div>
            <div style={{ fontSize: 11, color: '#2a2a2a', marginBottom: 8, lineHeight: 1.5 }}>
              {ccsi.description}
            </div>
            <div style={{ fontSize: 11, color: '#787878', lineHeight: 1.5 }}>
              <span style={{ color: '#888' }}>Driver: </span>
              {ccsi.risk_driver}
            </div>
          </div>
        </div>

        {/* Compound penalty callout */}
        {isCompound && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 10px',
            background: '#78350f',
            border: '1px solid #92400e',
            borderRadius: 4,
            marginBottom: 10,
            fontSize: 11, color: '#fde68a',
          }}>
            <span style={{ fontSize: 14 }}>⚠</span>
            <span>
              Compound crew penalty applied: <strong>−{ccsi.compound_penalty_value} pts</strong> — multiple operators degraded simultaneously
            </span>
          </div>
        )}

        {/* Individual contributions */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: '#787878', textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 6, fontWeight: 700 }}>
            Individual contributions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ccsi.individual_contributions.map(op => (
              <div key={op.operator_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: op.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#080808', width: 100, flexShrink: 0 }}>{op.name}</span>
                <div style={{ flex: 1, height: 4, background: '#b4b4b4', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: op.color,
                    width: `${op.load_score * 100}%`,
                    transition: 'width 0.5s',
                  }} />
                </div>
                <span style={{ fontSize: 10, color: op.color, fontWeight: 700, minWidth: 60, textAlign: 'right', textTransform: 'uppercase' }}>
                  {op.state.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CCSI Forecast */}
        {ccsi.forecast.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#787878', textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 6, fontWeight: 700 }}>
              Crew forecast
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {ccsi.forecast.map(f => (
                <div key={f.minutes_ahead} style={{
                  flex: 1, textAlign: 'center',
                  padding: '6px 4px',
                  background: '#bebebe',
                  borderRadius: 4,
                  borderBottom: `3px solid ${f.color}`,
                }}>
                  <div style={{ fontSize: 9, color: '#787878', marginBottom: 3, fontWeight: 700 }}>+{f.minutes_ahead}m</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: f.color }}>{Math.round(f.score)}</div>
                  <div style={{ fontSize: 9, color: f.color, fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>
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
