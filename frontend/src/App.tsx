import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { reactorWS, type RiskLevel } from './services/websocket'
import { type OperatorAuth } from './services/api'
import { DDTODashboard } from './pages/DDTODashboard'
import { SimulationConsole } from './pages/SimulationConsole'
import { LoginScreen } from './pages/LoginScreen'

export default function App() {
  const [connected, setConnected] = useState(false)
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('low')
  const [loggedInOperator, setLoggedInOperator] = useState<OperatorAuth | null>(null)

  useEffect(() => {
    reactorWS.connect()
    const unsubStatus = reactorWS.onStatus(setConnected)
    const unsubMsg = reactorWS.onMessage(p => setRiskLevel(p.risk_level))
    return () => { unsubStatus(); unsubMsg(); reactorWS.disconnect() }
  }, [])

  if (!loggedInOperator) {
    return <LoginScreen onLogin={setLoggedInOperator} />
  }

  const riskPillStyle: Record<RiskLevel, React.CSSProperties> = {
    low:    { background: '#14532d', color: '#4ade80', border: '1px solid #166534' },
    medium: { background: '#78350f', color: '#fde68a', border: '1px solid #92400e' },
    high:   { background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b' },
  }

  return (
    <BrowserRouter>
      <div className="page">
        <nav>
          <div className="brand">
            <span className="brand-name">⬡ NewTron</span>
            <div className="brand-divider" />
            <span className="brand-sub">DDTO</span>
          </div>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            DDTO
          </NavLink>
          <NavLink to="/console" className={({ isActive }) => isActive ? 'active' : ''}>
            Sim Console
          </NavLink>

          {/* Right side pills */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              ...riskPillStyle[riskLevel],
              fontSize: 10,
              fontFamily: 'var(--font-head)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              padding: '3px 10px',
              borderRadius: 4,
              textTransform: 'uppercase' as const,
            }}>
              Plant Risk: {riskLevel}
            </div>
            <div className={`ws-badge ${connected ? 'connected' : 'disconnected'}`}>
              {connected ? '● Live' : '○ Offline'}
            </div>

            {/* Signed-in badge */}
            <span style={{ fontSize: 11, color: '#7a7a7a', fontFamily: 'var(--font-head)' }}>
              {loggedInOperator.name}
            </span>
            <span style={{ color: '#707070', fontSize: 11 }}>·</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#7a7a7a' }}>
              {loggedInOperator.badge_id}
            </span>
            <button
              onClick={() => setLoggedInOperator(null)}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px 0',
                cursor: 'pointer',
                color: '#ef4444',
                fontSize: 11,
                fontFamily: 'var(--font-head)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Sign out
            </button>
          </div>
        </nav>

        <div className="page-body" style={{ padding: 0 }}>
          <Routes>
            <Route path="/"        element={<DDTODashboard loggedInOperator={loggedInOperator} />} />
            <Route path="/console" element={<SimulationConsole />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
