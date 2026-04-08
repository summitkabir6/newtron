import React from 'react'
import type { PlantState, RiskLevel } from '../services/websocket'
import { api } from '../services/api'

interface Alert {
  id: string
  label: string
  value: string
  severity: 'warn' | 'crit'
}

function buildAlerts(state: PlantState): Alert[] {
  const alerts: Alert[] = []

  if (state.pump_a_vibration > 2.0)
    alerts.push({ id: 'vib', label: 'Pump A Vibration High', value: `${state.pump_a_vibration.toFixed(2)} mm/s`, severity: state.pump_a_vibration > 4 ? 'crit' : 'warn' })

  if (state.pump_a_health < 70)
    alerts.push({ id: 'health', label: 'Pump A Health Degraded', value: `${state.pump_a_health.toFixed(0)}%`, severity: state.pump_a_health < 40 ? 'crit' : 'warn' })

  if (state.coolant_flow_rate < 600)
    alerts.push({ id: 'flow', label: 'Coolant Flow Low', value: `${state.coolant_flow_rate.toFixed(0)} L/min`, severity: state.coolant_flow_rate < 400 ? 'crit' : 'warn' })

  if (state.outlet_temperature > 95)
    alerts.push({ id: 'outlet', label: 'Outlet Temp Elevated', value: `${state.outlet_temperature.toFixed(1)}°C`, severity: state.outlet_temperature > 120 ? 'crit' : 'warn' })

  if (state.loop_pressure > 4.5)
    alerts.push({ id: 'pressure', label: 'Loop Pressure High', value: `${state.loop_pressure.toFixed(2)} bar`, severity: state.loop_pressure > 6 ? 'crit' : 'warn' })

  if (state.heat_exchanger_efficiency < 75)
    alerts.push({ id: 'hx', label: 'HX Efficiency Low', value: `${state.heat_exchanger_efficiency.toFixed(0)}%`, severity: 'warn' })

  return alerts
}

interface Props {
  state: PlantState
  riskLevel: RiskLevel
}

export const AlertPanel: React.FC<Props> = ({ state, riskLevel }) => {
  const alerts = buildAlerts(state)

  const acknowledge = async (id: string) => {
    await api.recordEvent('acknowledge_alert', id).catch(console.error)
  }

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-header">
        <span>⚑</span> Alerts
        {alerts.length > 0 && (
          <span style={{ marginLeft: 6, background: 'var(--red)', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 6px', fontFamily: 'var(--font-mono)' }}>
            {alerts.length}
          </span>
        )}
        <span style={{ marginLeft: 'auto' }} className={`risk-badge risk-${riskLevel}`}>
          {riskLevel}
        </span>
      </div>
      <div className="panel-body">
        {alerts.length === 0 ? (
          <div style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            ✓ No active alerts
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alerts.map(a => (
              <div key={a.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                background: a.severity === 'crit' ? 'rgba(255,61,85,0.08)' : 'rgba(240,192,64,0.06)',
                border: `1px solid ${a.severity === 'crit' ? 'rgba(255,61,85,0.3)' : 'rgba(240,192,64,0.25)'}`,
                borderRadius: 3,
              }}>
                <span style={{ color: a.severity === 'crit' ? 'var(--red)' : 'var(--yellow)', fontSize: 12 }}>
                  {a.severity === 'crit' ? '●' : '◐'}
                </span>
                <span style={{ flex: 1, fontSize: 12 }}>{a.label}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: a.severity === 'crit' ? 'var(--red)' : 'var(--yellow)',
                  minWidth: 80,
                  textAlign: 'right',
                }}>{a.value}</span>
                <button
                  onClick={() => acknowledge(a.id)}
                  style={{ padding: '2px 8px', fontSize: 10 }}
                >
                  ACK
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
