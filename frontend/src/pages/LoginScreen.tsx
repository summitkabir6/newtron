import React, { useState } from 'react'
import { authApi, type OperatorAuth } from '../services/api'

interface LoginScreenProps {
  onLogin: (operator: OperatorAuth) => void
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await authApi.login(username, password)
      onLogin(result as OperatorAuth)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#c6c6c6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-ui, system-ui, sans-serif)',
    }}>
      <div style={{
        background: '#d2d2d2',
        borderRadius: 8,
        border: '1px solid #b4b4b4',
        padding: '36px 32px',
        width: 360,
        maxWidth: '90vw',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            fontSize: 26,
            fontWeight: 800,
            color: '#080808',
            fontFamily: 'var(--font-head, system-ui, sans-serif)',
            letterSpacing: '-0.02em',
            marginBottom: 6,
          }}>
            ⬡ NewTron
          </div>
          <div style={{ fontSize: 11, color: '#787878', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
            Dynamic Digital Twin of the Operator
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block', fontSize: 10, fontWeight: 700,
              color: '#787878', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. alex.chen"
              autoComplete="username"
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '9px 12px',
                fontSize: 13,
                border: '1px solid #b4b4b4',
                borderRadius: 6,
                outline: 'none',
                background: '#bebebe',
                color: '#080808',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = '#22c55e')}
              onBlur={e => (e.target.style.borderColor = '#b4b4b4')}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block', fontSize: 10, fontWeight: 700,
              color: '#787878', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '9px 12px',
                fontSize: 13,
                border: '1px solid #b4b4b4',
                borderRadius: 6,
                outline: 'none',
                background: '#bebebe',
                color: '#080808',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = '#22c55e')}
              onBlur={e => (e.target.style.borderColor = '#b4b4b4')}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: 14,
              padding: '8px 12px',
              background: '#7f1d1d',
              border: '1px solid #991b1b',
              borderRadius: 6,
              fontSize: 12,
              color: '#fca5a5',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: 12,
              fontWeight: 800,
              background: loading ? '#166534' : '#14532d',
              color: '#4ade80',
              border: '1px solid #166534',
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Demo credentials hint */}
        <div style={{
          marginTop: 24,
          padding: '12px 14px',
          background: '#bebebe',
          border: '1px solid #b4b4b4',
          borderRadius: 6,
        }}>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            color: '#787878',
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            marginBottom: 8,
          }}>
            Demo credentials
          </div>
          {[
            { user: 'alex.chen', role: 'Senior Reactor Operator' },
            { user: 'blair.santos', role: 'Reactor Operator' },
            { user: 'casey.morgan', role: 'Senior Reactor Operator' },
          ].map(c => (
            <div
              key={c.user}
              onClick={() => setUsername(c.user)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '3px 0',
                cursor: 'pointer',
              }}
            >
              <span style={{
                fontSize: 11,
                color: '#22c55e',
                fontFamily: 'var(--font-mono, monospace)',
                textDecoration: 'underline',
                textDecorationStyle: 'dotted',
                fontWeight: 600,
              }}>
                {c.user}
              </span>
              <span style={{ fontSize: 10, color: '#787878' }}>{c.role}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, fontSize: 10, color: '#787878' }}>
            Password: <span style={{ fontFamily: 'var(--font-mono, monospace)', color: '#2a2a2a', fontWeight: 600 }}>citech2026</span>
          </div>
        </div>
      </div>
    </div>
  )
}
