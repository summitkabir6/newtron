import React from 'react'
import type { CausalExplanation, AuthorityMode } from '../services/websocket'
import { api } from '../services/api'

interface Props {
  recommendation: string
  causal: CausalExplanation
  authorityMode: AuthorityMode
}

const modeColor: Record<AuthorityMode, string> = {
  QUIET:     'var(--text-secondary)',
  ADVISORY:  'var(--blue)',
  ASSERTIVE: 'var(--orange)',
}

export const RecommendationPanel: React.FC<Props> = ({ recommendation, causal, authorityMode }) => {
  const color = modeColor[authorityMode]

  const accept = () => api.recordEvent('accept_recommendation', recommendation).catch(console.error)
  const reject = () => api.recordEvent('reject_recommendation', recommendation).catch(console.error)

  return (
    <div className="panel" style={{ marginBottom: 16, borderColor: authorityMode === 'ASSERTIVE' ? 'rgba(255,124,53,0.4)' : undefined }}>
      <div className="panel-header">
        <span>⟐</span> AI Recommendation
        <span style={{ marginLeft: 'auto' }} className={`authority-badge auth-${authorityMode}`}>
          {authorityMode}
        </span>
      </div>
      <div className="panel-body">

        {/* Recommendation text */}
        <div style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 13,
          color,
          marginBottom: 12,
          lineHeight: 1.6,
          padding: '8px 10px',
          background: 'var(--bg-surface)',
          borderRadius: 3,
          borderLeft: `3px solid ${color}`,
        }}>
          {recommendation || 'Awaiting system data…'}
        </div>

        {/* Causal chain */}
        {causal.chain.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-head)', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase' }}>
              Causal Chain
            </div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              {causal.chain.map((node, i) => (
                <React.Fragment key={node}>
                  <span style={{
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    padding: '2px 7px',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    color: i === 0 ? 'var(--orange)' : 'var(--text-primary)',
                  }}>
                    {node}
                  </span>
                  {i < causal.chain.length - 1 && (
                    <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Root cause */}
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-head)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Root Cause: </span>
          <span style={{ fontFamily: 'var(--font-mono)', color: causal.root_cause === 'No anomalies detected' ? 'var(--green)' : 'var(--orange)' }}>
            {causal.root_cause}
          </span>
        </div>

        {/* Accept / Reject */}
        {authorityMode !== 'QUIET' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary" onClick={accept}>Accept</button>
            <button className="danger" onClick={reject}>Reject</button>
          </div>
        )}
      </div>
    </div>
  )
}
