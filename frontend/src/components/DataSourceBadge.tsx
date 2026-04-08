import React, { useEffect, useState } from 'react'
import { dataSourceApi } from '../services/api'

interface DataSourceInfo {
  source: string
  label: string
  detail: string
  citation: string
  color: string
}

export const DataSourceBadge: React.FC = () => {
  const [info, setInfo] = useState<DataSourceInfo | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    dataSourceApi.getInfo()
      .then(setInfo)
      .catch(() => setInfo({
        source: 'synthetic',
        label: 'Synthetic Signals',
        detail: 'Grounded in published EEG ranges',
        citation: 'Choi et al. 2018, Pakarinen et al. 2018',
        color: '#3ab8ff',
      }))
  }, [])

  if (!info) return null

  const isReal = info.source === 'stew_real'

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        cursor: 'pointer',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 0,
      }}
    >
      {/* Badge pill */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 3,
        border: `1px solid ${info.color}55`,
        background: `${info.color}12`,
        transition: 'all 0.2s',
      }}>
        {/* Animated dot for real data */}
        <div style={{ position: 'relative', width: 7, height: 7 }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: info.color,
            boxShadow: `0 0 5px ${info.color}`,
          }} />
          {isReal && (
            <div style={{
              position: 'absolute',
              inset: -2,
              borderRadius: '50%',
              border: `1px solid ${info.color}`,
              animation: 'ping 2s ease-in-out infinite',
            }} />
          )}
        </div>
        <span style={{
          fontFamily: 'var(--font-head)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: info.color,
        }}>
          {info.label}
        </span>
        <span style={{ color: info.color, fontSize: 9, opacity: 0.7 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          marginTop: 4,
          padding: '8px 10px',
          background: 'var(--bg-panel)',
          border: `1px solid ${info.color}33`,
          borderRadius: 3,
          minWidth: 260,
          zIndex: 100,
          position: 'relative',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.5 }}>
            {info.detail}
          </div>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            {info.citation}
          </div>
          {isReal && (
            <div style={{
              marginTop: 6,
              fontSize: 10,
              fontFamily: 'var(--font-head)',
              letterSpacing: '0.06em',
              color: info.color,
              textTransform: 'uppercase',
            }}>
              ✓ Real human EEG recordings active
            </div>
          )}
          {!isReal && (
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              To activate real data: download STEW dataset from figshare
              and place in <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--blue)' }}>backend/data/STEW/</span>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes ping {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
