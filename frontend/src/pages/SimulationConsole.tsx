import React, { useState } from 'react'
import { api } from '../services/api'

type OverrideVar =
  | 'pump_a_temperature' | 'pump_a_vibration' | 'pump_a_health'
  | 'coolant_flow_rate' | 'inlet_temperature' | 'outlet_temperature'
  | 'loop_pressure' | 'valve_position' | 'heat_exchanger_efficiency'

const OVERRIDE_VARS: { key: OverrideVar; label: string; min: number; max: number; step: number }[] = [
  { key: 'pump_a_temperature',      label: 'Pump A Temp (°C)',       min: 20,   max: 200,  step: 1 },
  { key: 'pump_a_vibration',        label: 'Pump A Vibration (mm/s)',min: 0,    max: 20,   step: 0.1 },
  { key: 'pump_a_health',           label: 'Pump A Health (%)',      min: 0,    max: 100,  step: 1 },
  { key: 'coolant_flow_rate',       label: 'Flow Rate (L/min)',      min: 0,    max: 1200, step: 10 },
  { key: 'inlet_temperature',       label: 'Inlet Temp (°C)',        min: 20,   max: 150,  step: 1 },
  { key: 'outlet_temperature',      label: 'Outlet Temp (°C)',       min: 20,   max: 200,  step: 1 },
  { key: 'loop_pressure',           label: 'Loop Pressure (bar)',    min: 0,    max: 10,   step: 0.1 },
  { key: 'valve_position',          label: 'Valve Position (%)',     min: 0,    max: 100,  step: 1 },
  { key: 'heat_exchanger_efficiency',label: 'HX Efficiency (%)',     min: 0,    max: 100,  step: 1 },
]

export const SimulationConsole: React.FC = () => {
  const [overrideValues, setOverrideValues] = useState<Partial<Record<OverrideVar, string>>>({})
  const [status, setStatus] = useState('')

  const flash = (msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(''), 3000)
  }

  const handleScenario = async (name: string, action: 'start' | 'stop') => {
    try {
      if (action === 'start') await api.startScenario(name)
      else await api.stopScenario(name)
      flash(`${action === 'start' ? 'Started' : 'Stopped'}: ${name}`)
    } catch (e: unknown) {
      flash(`Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const handleReset = async () => {
    await api.resetSimulation().catch(console.error)
    flash('Simulation reset')
  }

  const handleOverride = async (key: OverrideVar) => {
    const raw = overrideValues[key]
    if (raw === undefined || raw === '') return
    const value = parseFloat(raw)
    if (isNaN(value)) return
    try {
      await api.overrideVariable(key, value)
      flash(`Override applied: ${key} = ${value}`)
    } catch (e: unknown) {
      flash(`Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ fontFamily: 'var(--font-head)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 16 }}>
        ◈ Simulation Control Console — Admin / Demo Panel
      </div>

      {status && (
        <div style={{
          marginBottom: 16, padding: '8px 14px',
          background: 'rgba(58,184,255,0.08)', border: '1px solid rgba(58,184,255,0.3)',
          borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--blue)',
        }}>
          {status}
        </div>
      )}

      {/* ── Scenarios ─────────────────────────────────────────────────────── */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header"><span>⚡</span> Scenarios</div>
        <div className="panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

            <div style={scenarioCard}>
              <div style={scenarioTitle}>Pump Degradation</div>
              <div style={scenarioDesc}>Bearing wear → rising vibration, pump temp, health degradation</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="primary" onClick={() => handleScenario('pump_degradation', 'start')}>Start</button>
                <button onClick={() => handleScenario('pump_degradation', 'stop')}>Stop</button>
              </div>
            </div>

            <div style={scenarioCard}>
              <div style={scenarioTitle}>Flow Restriction</div>
              <div style={scenarioDesc}>Partial blockage → falling flow, rising back-pressure</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="primary" onClick={() => handleScenario('flow_restriction', 'start')}>Start</button>
                <button onClick={() => handleScenario('flow_restriction', 'stop')}>Stop</button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button className="danger" onClick={handleReset}>↺ Reset Simulation</button>
          </div>
        </div>
      </div>

      {/* ── Manual Overrides ──────────────────────────────────────────────── */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header"><span>⊞</span> Manual Variable Override</div>
        <div className="panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {OVERRIDE_VARS.map(({ key, label, min, max, step }) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label>{label}</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    placeholder={`${min}–${max}`}
                    value={overrideValues[key] ?? ''}
                    onChange={e => setOverrideValues(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button onClick={() => handleOverride(key)} style={{ padding: '6px 10px', flexShrink: 0 }}>Set</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const scenarioCard: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: 14,
}
const scenarioTitle: React.CSSProperties = {
  fontFamily: 'var(--font-head)',
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: '0.06em',
  marginBottom: 4,
  color: 'var(--text-primary)',
}
const scenarioDesc: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
}

// Note: DDTO scenario controls are on the DDTO Dashboard page (per-operator).
// This console handles plant-side simulation only.
