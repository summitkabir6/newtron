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
    low:    { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' },
    medium: { background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' },
    high:   { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' },
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
              fontSize: 11,
              fontFamily: 'var(--font-head)',
              fontWeight: 600,
              letterSpacing: '0.06em',
              padding: '3px 10px',
              borderRadius: 20,
              textTransform: 'uppercase' as const,
            }}>
              Plant Risk: {riskLevel}
            </div>
            <div className={`ws-badge ${connected ? 'connected' : 'disconnected'}`}>
              {connected ? '● Live' : '○ Offline'}
            </div>

            {/* Signed-in badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px',
              background: '#f0f7ff',
              border: '1px solid #bfdbfe',
              borderRadius: 20,
              fontSize: 11,
              color: '#1d4ed8',
              fontFamily: 'var(--font-head)',
              fontWeight: 500,
            }}>
              <span>{loggedInOperator.name}</span>
              <span style={{ color: '#93c5fd' }}>·</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{loggedInOperator.badge_id}</span>
              <span style={{ color: '#93c5fd' }}>·</span>
              <button
                onClick={() => setLoggedInOperator(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#3b82f6',
                  fontSize: 11,
                  fontFamily: 'var(--font-head)',
                  fontWeight: 600,
                }}
              >
                Sign out
              </button>
            </div>
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
