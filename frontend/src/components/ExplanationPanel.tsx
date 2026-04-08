import React, { useState } from 'react'
import type { DDTOState } from '../services/websocket'
import { ddtoApi } from '../services/api'

interface Props {
  operatorId: string
  operatorName: string
  explanation: string
  currentState: DDTOState
  stateColor: string
  performanceLatency: number
  errorProbability: number
  baselineLatency: number
  baselineError: number
}

export const ExplanationPanel: React.FC<Props> = ({
  operatorId,
  operatorName,
  explanation,
  currentState,
  stateColor,
  performanceLatency,
  errorProbability,
  baselineLatency,
  baselineError,
}) => {
  const [loading, setLoading] = useState(false)
  const [localExplanation, setLocalExplanation] = useState<string | null>(null)

  const displayed = localExplanation ?? explanation

  const refresh = async () => {
    setLoading(true)
    try {
      const result = await ddtoApi.getExplanation(operatorId)
      setLocalExplanation(result.explanation)
    } catch (e) {
      console.error('Explanation fetch failed', e)
    } finally {
      setLoading(false)
    }
  }

  const latencyDelta = performanceLatency - baselineLatency
  const errorDelta = (errorProbability - baselineError) * 100

  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <div className="panel-header">
        <span>◈</span> Claude — Cognitive Assessment
        <span style={{
          marginLeft: 8,
          fontSize: 10,
          fontFamily: 'var(--font-head)',
          letterSpacing: '0.06em',
          color: 'var(--purple)',
          background: 'rgba(160,124,255,0.1)',
          border: '1px solid rgba(160,124,255,0.3)',
          padding: '1px 7px',
          borderRadius: 3,
        }}>
          claude-sonnet-4-6
        </span>
        <button
          onClick={refresh}
          disabled={loading}
          style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 10 }}
        >
          {loading ? '…' : '↻ Refresh'}
        </button>
      </div>
      <div className="panel-body">

        {/* Explanation text */}
        <div style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 13,
          lineHeight: 1.7,
          color: 'var(--text-primary)',
          padding: '10px 12px',
          background: 'var(--bg-surface)',
          borderRadius: 3,
          borderLeft: `3px solid ${stateColor}`,
          marginBottom: 12,
          minHeight: 52,
          position: 'relative',
        }}>
          {loading ? (
            <span style={{ color: 'var(--text-secondary)' }}>Requesting assessment from Claude…</span>
          ) : displayed || (
            <span style={{ color: 'var(--text-secondary)' }}>Initialising cognitive assessment…</span>
          )}
        </div>

        {/* Performance deltas */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={deltaCard}>
            <div style={deltaLabel}>Response Latency</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-primary)' }}>
                {performanceLatency.toFixed(0)}
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>ms</span>
              </span>
              <span style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: latencyDelta > 100 ? 'var(--red)' : latencyDelta > 50 ? 'var(--yellow)' : 'var(--green)',
              }}>
                {latencyDelta > 0 ? '+' : ''}{latencyDelta.toFixed(0)}ms vs baseline
              </span>
            </div>
          </div>

          <div style={deltaCard}>
            <div style={deltaLabel}>Error Probability</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-primary)' }}>
                {(errorProbability * 100).toFixed(1)}
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>%</span>
              </span>
              <span style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: errorDelta > 10 ? 'var(--red)' : errorDelta > 5 ? 'var(--yellow)' : 'var(--green)',
              }}>
                {errorDelta > 0 ? '+' : ''}{errorDelta.toFixed(1)}% vs baseline
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

const deltaCard: React.CSSProperties = {
  flex: 1,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 3,
  padding: '8px 10px',
}

const deltaLabel: React.CSSProperties = {
  fontSize: 10,
  fontFamily: 'var(--font-head)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  marginBottom: 4,
}
