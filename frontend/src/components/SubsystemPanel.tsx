import React from 'react'
import type { PlantState } from '../services/websocket'

interface Props {
  state: PlantState
  riskLevel: string
}

function heatColor(value: number, min: number, max: number): string {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)))
  if (t < 0.5) return `hsl(${160 - t * 60}, 70%, 45%)`  // green → yellow
  return `hsl(${100 - (t - 0.5) * 200}, 80%, 50%)`       // yellow → red
}

function flowWidth(flow: number): number {
  return Math.max(1, Math.min(6, (flow / 850) * 5))
}

export const SubsystemPanel: React.FC<Props> = ({ state, riskLevel }) => {
  const pumpColor = state.pump_a_health > 70
    ? 'var(--green)'
    : state.pump_a_health > 40
    ? 'var(--yellow)'
    : 'var(--red)'

  const outletColor = heatColor(state.outlet_temperature, 60, 130)
  const pressureColor = state.loop_pressure > 4.5 ? 'var(--red)' : state.loop_pressure > 3.5 ? 'var(--yellow)' : 'var(--green)'
  const flowStroke = `rgba(58,184,255,${0.3 + (state.coolant_flow_rate / 850) * 0.6})`
  const flowW = flowWidth(state.coolant_flow_rate)

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-header">
        <span>◈</span> Subsystem Schematic
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          Loop Pressure:&nbsp;
          <span style={{ color: pressureColor }}>{state.loop_pressure.toFixed(2)} bar</span>
        </span>
      </div>
      <div className="panel-body">
        <svg
          viewBox="0 0 560 200"
          style={{ width: '100%', height: 'auto', display: 'block' }}
          fontFamily="var(--font-mono)"
        >
          {/* ── Flow loop path ─────────────────────────────────────────────── */}
          {/* Top pipe */}
          <path d="M 100 70 L 460 70" stroke={flowStroke} strokeWidth={flowW} fill="none" strokeDasharray="8 4">
            <animate attributeName="stroke-dashoffset" from="0" to="-24" dur={`${1.2 - (state.coolant_flow_rate / 850) * 0.7}s`} repeatCount="indefinite" />
          </path>
          {/* Right pipe */}
          <path d="M 460 70 L 460 150" stroke={flowStroke} strokeWidth={flowW} fill="none" />
          {/* Bottom pipe */}
          <path d="M 460 150 L 100 150" stroke={flowStroke} strokeWidth={flowW} fill="none" strokeDasharray="8 4">
            <animate attributeName="stroke-dashoffset" from="0" to="24" dur={`${1.2 - (state.coolant_flow_rate / 850) * 0.7}s`} repeatCount="indefinite" />
          </path>
          {/* Left pipe */}
          <path d="M 100 150 L 100 70" stroke={flowStroke} strokeWidth={flowW} fill="none" />

          {/* ── Pump A ─────────────────────────────────────────────────────── */}
          <circle cx="100" cy="110" r="28" fill="var(--bg-raised)" stroke={pumpColor} strokeWidth="1.5" />
          <text x="100" y="106" textAnchor="middle" fill={pumpColor} fontSize="9" fontFamily="var(--font-head)" fontWeight="600" letterSpacing="1">PUMP A</text>
          <text x="100" y="118" textAnchor="middle" fill={pumpColor} fontSize="10" fontFamily="var(--font-mono)">{state.pump_a_health.toFixed(0)}%</text>
          <text x="100" y="130" textAnchor="middle" fill="var(--text-dim)" fontSize="8">{state.pump_a_vibration.toFixed(2)} mm/s</text>
          {/* Pump glow if degraded */}
          {state.pump_a_health < 70 && (
            <circle cx="100" cy="110" r="30" fill="none" stroke={pumpColor} strokeWidth="1" opacity="0.4">
              <animate attributeName="r" values="29;33;29" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
            </circle>
          )}

          {/* ── Valve ──────────────────────────────────────────────────────── */}
          <g transform="translate(270, 150)">
            <rect x="-16" y="-10" width="32" height="20" rx="3" fill="var(--bg-raised)" stroke="var(--border-bright)" strokeWidth="1" />
            <text y="-14" textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontFamily="var(--font-head)" letterSpacing="1">VALVE</text>
            <text y="5" textAnchor="middle" fill="var(--blue)" fontSize="9" fontFamily="var(--font-mono)">{state.valve_position.toFixed(0)}%</text>
          </g>

          {/* ── Inlet (left-top) ───────────────────────────────────────────── */}
          <g transform="translate(185, 55)">
            <rect x="-38" y="-14" width="76" height="22" rx="3" fill="var(--bg-raised)" stroke="var(--border)" strokeWidth="1" />
            <text y="-18" textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontFamily="var(--font-head)" letterSpacing="1">INLET</text>
            <text y="2" textAnchor="middle" fill="var(--text-primary)" fontSize="10" fontFamily="var(--font-mono)">{state.inlet_temperature.toFixed(1)}°C</text>
          </g>

          {/* ── Outlet (right-top) ─────────────────────────────────────────── */}
          <g transform="translate(370, 55)">
            <rect x="-38" y="-14" width="76" height="22" rx="3" fill="var(--bg-raised)" stroke={outletColor} strokeWidth="1" />
            <text y="-18" textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontFamily="var(--font-head)" letterSpacing="1">OUTLET</text>
            <text y="2" textAnchor="middle" fill={outletColor} fontSize="10" fontFamily="var(--font-mono)">{state.outlet_temperature.toFixed(1)}°C</text>
          </g>

          {/* ── Heat Exchanger ─────────────────────────────────────────────── */}
          <g transform="translate(460, 110)">
            <rect x="-22" y="-30" width="44" height="60" rx="3"
              fill="var(--bg-raised)"
              stroke={state.heat_exchanger_efficiency < 75 ? 'var(--yellow)' : 'var(--border-bright)'}
              strokeWidth="1.5" />
            {/* Fins */}
            {[-16, -8, 0, 8, 16].map(y => (
              <line key={y} x1="-18" y1={y} x2="18" y2={y}
                stroke={state.heat_exchanger_efficiency < 75 ? 'var(--yellow)' : 'var(--blue)'}
                strokeWidth="1" opacity="0.6" />
            ))}
            <text y="-36" textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontFamily="var(--font-head)" letterSpacing="1">HX</text>
            <text y="44" textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontFamily="var(--font-mono)">{state.heat_exchanger_efficiency.toFixed(0)}%</text>
          </g>

          {/* ── Flow rate label ────────────────────────────────────────────── */}
          <text x="270" y="62" textAnchor="middle" fill="var(--blue)" fontSize="9" fontFamily="var(--font-mono)" opacity="0.8">
            ↑ {state.coolant_flow_rate.toFixed(0)} L/min
          </text>
        </svg>
      </div>
    </div>
  )
}
