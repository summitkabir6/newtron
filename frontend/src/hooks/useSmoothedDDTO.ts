import { useEffect, useRef, useState } from 'react'
import type { DDTOPrediction } from '../services/websocket'

export interface OperatorSignals {
  eeg: { theta: number; alpha: number; beta: number }
  eye: { perclos: number; blink_rate: number }
  performance: { response_latency_ms: number; estimated_error_probability: number }
}

export interface SmoothedDDTO {
  theta: number
  alpha: number
  beta: number
  perclos: number
  blink: number
  error: number
  currentLoad: number
  forecastLoads: number[]
  latencyMs: number
}

function extract(signals: OperatorSignals, prediction: DDTOPrediction): SmoothedDDTO {
  return {
    theta: signals.eeg.theta,
    alpha: signals.eeg.alpha,
    beta: signals.eeg.beta,
    perclos: signals.eye.perclos,
    blink: signals.eye.blink_rate,
    error: signals.performance.estimated_error_probability,
    currentLoad: prediction.current_load_score,
    forecastLoads: [
      prediction.current_load_score,
      ...prediction.forecast.map(f => f.load_score),
    ],
    latencyMs: signals.performance.response_latency_ms,
  }
}

/**
 * Exponential smoothing toward latest WebSocket targets (~1 Hz) for fluid UI.
 * Resets when operator id changes.
 */
export function useSmoothedDDTO(
  operatorId: string,
  signals: OperatorSignals | undefined,
  prediction: DDTOPrediction | undefined,
  tauSec = 0.32,
): SmoothedDDTO | null {
  const targetsRef = useRef<SmoothedDDTO | null>(null)
  const displayRef = useRef<SmoothedDDTO | null>(null)
  const opRef = useRef(operatorId)
  const [out, setOut] = useState<SmoothedDDTO | null>(null)

  useEffect(() => {
    if (opRef.current !== operatorId) {
      opRef.current = operatorId
      targetsRef.current = null
      displayRef.current = null
      setOut(null)
    }
    if (!signals || !prediction) {
      targetsRef.current = null
      displayRef.current = null
      setOut(null)
      return
    }
    targetsRef.current = extract(signals, prediction)
    if (!displayRef.current) {
      displayRef.current = {
        ...targetsRef.current,
        forecastLoads: [...targetsRef.current.forecastLoads],
      }
      setOut({
        ...displayRef.current,
        forecastLoads: [...displayRef.current.forecastLoads],
      })
    }
  }, [operatorId, signals, prediction])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const step = () => {
      const targets = targetsRef.current
      const display = displayRef.current
      if (!targets || !display) {
        raf = requestAnimationFrame(step)
        return
      }
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 0.12)
      last = now
      const k = 1 - Math.exp(-dt / tauSec)

      const mark = (before: number, after: number) => Math.abs(after - before) > 1e-8

      let dirty = false
      let v = display.theta
      display.theta += (targets.theta - display.theta) * k
      if (mark(v, display.theta)) dirty = true

      v = display.alpha
      display.alpha += (targets.alpha - display.alpha) * k
      if (mark(v, display.alpha)) dirty = true

      v = display.beta
      display.beta += (targets.beta - display.beta) * k
      if (mark(v, display.beta)) dirty = true

      v = display.perclos
      display.perclos += (targets.perclos - display.perclos) * k
      if (mark(v, display.perclos)) dirty = true

      v = display.blink
      display.blink += (targets.blink - display.blink) * k
      if (mark(v, display.blink)) dirty = true

      v = display.error
      display.error += (targets.error - display.error) * k
      if (mark(v, display.error)) dirty = true

      v = display.currentLoad
      display.currentLoad += (targets.currentLoad - display.currentLoad) * k
      if (mark(v, display.currentLoad)) dirty = true

      v = display.latencyMs
      display.latencyMs += (targets.latencyMs - display.latencyMs) * k
      if (mark(v, display.latencyMs)) dirty = true

      const tl = targets.forecastLoads
      const dl = display.forecastLoads
      if (dl.length !== tl.length) {
        display.forecastLoads = [...tl]
        dirty = true
      } else {
        for (let i = 0; i < tl.length; i++) {
          const n = dl[i] + (tl[i] - dl[i]) * k
          if (Math.abs(n - dl[i]) > 1e-8) dirty = true
          dl[i] = n
        }
      }

      if (dirty) {
        setOut({
          ...display,
          forecastLoads: [...display.forecastLoads],
        })
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [tauSec])

  return out
}
