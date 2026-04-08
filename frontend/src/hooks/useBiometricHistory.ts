import { useEffect, useRef, useState } from 'react'
import type { OperatorSnapshot } from '../services/websocket'

export type BiometricMetricKey = 'theta' | 'alpha' | 'beta' | 'perclos' | 'blink' | 'error'

const MAX_LEN = 60

export type BiometricHistories = Record<BiometricMetricKey, number[]>

const emptyHistories = (): BiometricHistories => ({
  theta: [],
  alpha: [],
  beta: [],
  perclos: [],
  blink: [],
  error: [],
})

const seedFromSignals = (signals: OperatorSnapshot['signals']): BiometricHistories => ({
  theta:   [signals.eeg.theta],
  alpha:   [signals.eeg.alpha],
  beta:    [signals.eeg.beta],
  perclos: [signals.eye.perclos],
  blink:   [signals.eye.blink_rate],
  error:   [signals.performance.estimated_error_probability],
})

/**
 * Ring buffers of raw signal samples (~1 per WebSocket tick) for sparklines.
 * Resets when the selected operator changes.
 */
export function useBiometricHistory(
  operatorId: string,
  signals: OperatorSnapshot['signals'] | undefined,
): BiometricHistories {
  const [hist, setHist] = useState<BiometricHistories>(emptyHistories)
  const opRef = useRef(operatorId)

  useEffect(() => {
    if (!signals) return

    const switched = opRef.current !== operatorId
    if (switched) opRef.current = operatorId

    setHist(prev => {
      if (switched) return seedFromSignals(signals)
      return {
        theta:   [...prev.theta,   signals.eeg.theta].slice(-MAX_LEN),
        alpha:   [...prev.alpha,   signals.eeg.alpha].slice(-MAX_LEN),
        beta:    [...prev.beta,    signals.eeg.beta].slice(-MAX_LEN),
        perclos: [...prev.perclos, signals.eye.perclos].slice(-MAX_LEN),
        blink:   [...prev.blink,   signals.eye.blink_rate].slice(-MAX_LEN),
        error:   [...prev.error,   signals.performance.estimated_error_probability].slice(-MAX_LEN),
      }
    })
  }, [operatorId, signals])

  return hist
}
