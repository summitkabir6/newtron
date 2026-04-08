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
      background: '#f8f9fb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body, system-ui, sans-serif)',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        padding: '40px 36px',
        width: 360,
        maxWidth: '90vw',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#1e293b',
            fontFamily: 'var(--font-head, system-ui, sans-serif)',
            letterSpacing: '-0.02em',
            marginBottom: 6,
          }}>
            ⬡ NewTron
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', letterSpacing: '0.04em' }}>
            Dynamic Digital Twin of the Operator
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block', fontSize: 12, fontWeight: 500,
              color: '#475569', marginBottom: 5,
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
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                outline: 'none',
                background: '#f8fafc',
                color: '#1e293b',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = '#3b82f6')}
              onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block', fontSize: 12, fontWeight: 500,
              color: '#475569', marginBottom: 5,
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
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                outline: 'none',
                background: '#f8fafc',
                color: '#1e293b',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = '#3b82f6')}
              onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: 14,
              padding: '8px 12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              fontSize: 12,
              color: '#dc2626',
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
              fontSize: 13,
              fontWeight: 600,
              background: loading ? '#93c5fd' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
              letterSpacing: '0.02em',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Demo credentials hint */}
        <div style={{
          marginTop: 24,
          padding: '12px 14px',
          background: '#f8fafc',
          border: '1px solid #f1f5f9',
          borderRadius: 10,
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#cbd5e1',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
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
                color: '#3b82f6',
                fontFamily: 'var(--font-mono, monospace)',
                textDecoration: 'underline',
                textDecorationStyle: 'dotted',
              }}>
                {c.user}
              </span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{c.role}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, fontSize: 10, color: '#cbd5e1' }}>
            Password: <span style={{ fontFamily: 'var(--font-mono, monospace)', color: '#94a3b8' }}>citech2026</span>
          </div>
        </div>
      </div>
    </div>
  )
}
