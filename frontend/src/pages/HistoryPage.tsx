import React, { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'

interface HistPoint {
  timestamp: string
  operator_id: string
  name: string
  current_load_score: number
  current_state: string
  trend: string
  confidence: number
}

export function HistoryPage() {
  const [data, setData] = useState<HistPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/ddto/history?limit=120')
      .then(r => r.json())
      .then((rows: HistPoint[]) => {
        // reverse so oldest is first for charts
        setData(rows.slice().reverse())
        setLoading(false)
      })
      .catch(e => {
        setError(String(e))
        setLoading(false)
      })
  }, [])

  if (loading) return <div style={{ padding: 32, color: '#9ca3af' }}>Loading history…</div>
  if (error) return <div style={{ padding: 32, color: '#f87171' }}>Error: {error}</div>
  if (!data.length) return <div style={{ padding: 32, color: '#9ca3af' }}>No history yet. Let the simulation run for a minute.</div>

  const chartData = data.map(d => ({
    time: d.timestamp?.slice(11, 19) || '',
    load: d.current_load_score,
    state: d.current_state,
    op: d.name?.split(' ')[0] || d.operator_id,
  }))

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 28, marginBottom: 8 }}>
        Historical Cognitive Load
      </h1>
      <p style={{ color: '#9ca3af', marginBottom: 24 }}>
        Recent operator snapshots stored in SQLite. Data is captured every ~5 seconds while the simulation runs.
      </p>

      <div style={{ background: '#0d1318', border: '1px solid #1e293b', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h3 style={{ marginTop: 0, fontFamily: 'var(--font-head)' }}>Load Score Over Time</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
            <YAxis domain={[0, 1]} stroke="#64748b" fontSize={11} />
            <Tooltip contentStyle={{ background: '#111a22', border: '1px solid #334155' }} />
            <Legend />
            <Line type="monotone" dataKey="load" stroke="#3ab8ff" strokeWidth={2} dot={false} name="Load Score" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: '#0d1318', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
        <h3 style={{ marginTop: 0, fontFamily: 'var(--font-head)' }}>Recent State Distribution</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData.slice(-40)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
            <YAxis stroke="#64748b" fontSize={11} />
            <Tooltip contentStyle={{ background: '#111a22', border: '1px solid #334155' }} />
            <Bar dataKey="load" fill="#a07cff" name="Load" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: 24, fontSize: 13, color: '#64748b' }}>
        Total points loaded: {data.length}. Model metrics available at <code>/ddto/ml-metrics</code>.
      </div>
    </div>
  )
}
