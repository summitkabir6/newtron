import React from 'react'

const VB_W = 120
const VB_H = 40
const PAD = 3

/** Cubic Bézier through points (Catmull–Rom style control points). */
function smoothBezierPath(P: { x: number; y: number }[]): string {
  if (P.length < 2) return ''
  if (P.length === 2) {
    return `M ${P[0].x} ${P[0].y} L ${P[1].x} ${P[1].y}`
  }
  let d = `M ${P[0].x} ${P[0].y}`
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i > 0 ? i - 1 : i]
    const p1 = P[i]
    const p2 = P[i + 1]
    const p3 = P[i + 2 < P.length ? i + 2 : i + 1]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }
  return d
}

interface MetricSparklineProps {
  values: number[]
  stroke?: string
}

/**
 * Stroke-only trend line; no axes, labels, or scales. Stretches to parent size.
 */
export const MetricSparkline: React.FC<MetricSparklineProps> = ({
  values,
  stroke = '#94a3b8',
}) => {
  if (values.length === 0) {
    return (
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
        aria-hidden
      />
    )
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 1e-9)
  const innerH = VB_H - 2 * PAD

  if (values.length === 1) {
    const y = PAD + innerH / 2
    return (
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
        aria-hidden
      >
        <line
          x1={0}
          y1={y}
          x2={VB_W}
          y2={y}
          stroke={stroke}
          strokeWidth={1.25}
          strokeLinecap="round"
        />
      </svg>
    )
  }

  const xyPoints = values.map((v, i) => ({
    x: (i / (values.length - 1)) * VB_W,
    y: PAD + (1 - (v - min) / range) * innerH,
  }))

  const d = smoothBezierPath(xyPoints)

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.15}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
