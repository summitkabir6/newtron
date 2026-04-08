import React from 'react'

interface SensorCardProps {
  label: string
  value: number
  unit: string
  /** Optional: if value crosses this threshold in the given direction, card turns yellow/red */
  warnThreshold?: { direction: 'above' | 'below'; warn: number; crit: number }
  decimals?: number
}

function getStatus(
  value: number,
  threshold?: SensorCardProps['warnThreshold']
): 'normal' | 'warn' | 'crit' {
  if (!threshold) return 'normal'
  const { direction, warn, crit } = threshold
  if (direction === 'above') {
    if (value >= crit) return 'crit'
    if (value >= warn) return 'warn'
  } else {
    if (value <= crit) return 'crit'
    if (value <= warn) return 'warn'
  }
  return 'normal'
}

const statusColors: Record<string, string> = {
  normal: 'var(--green)',
  warn:   'var(--yellow)',
  crit:   'var(--red)',
}

export const SensorCard: React.FC<SensorCardProps> = ({
  label,
  value,
  unit,
  warnThreshold,
  decimals = 1,
}) => {
  const status = getStatus(value, warnThreshold)
  const color = statusColors[status]

  return (
    <div style={styles.card}>
      <div style={styles.label}>{label}</div>
      <div style={{ ...styles.value, color }}>
        {value.toFixed(decimals)}
        <span style={styles.unit}>{unit}</span>
      </div>
      <div style={{ ...styles.indicator, background: color, boxShadow: status !== 'normal' ? `0 0 8px ${color}` : 'none' }} />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  label: {
    fontFamily: 'var(--font-head)',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  },
  value: {
    fontFamily: 'var(--font-mono)',
    fontSize: 20,
    fontWeight: 400,
    lineHeight: 1,
  },
  unit: {
    fontSize: 11,
    marginLeft: 4,
    color: 'var(--text-secondary)',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 3,
    height: '100%',
    borderRadius: '0 4px 4px 0',
    transition: 'background 0.4s, box-shadow 0.4s',
  },
}
