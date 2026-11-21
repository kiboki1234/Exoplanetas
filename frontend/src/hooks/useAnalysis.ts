import { useEffect, useState } from 'react'
import { request } from '../services/api'

export function useAnalysis<T>(path: string, payload?: object, enabled = true, attempt = 0) {
  const body = JSON.stringify(payload)
  const [result, setResult] = useState<{ path: string; body?: string; attempt: number; data?: T; error?: string }>()
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      request<T>(path, body ? JSON.parse(body) as object : undefined, controller.signal)
        .then(data => { if (!controller.signal.aborted) setResult({ path, body, attempt, data }) })
        .catch((error: Error) => {
          if (!controller.signal.aborted) setResult({ path, body, attempt, error: error.message })
        })
    }, 140)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [attempt, body, enabled, path])
  const current = result?.path === path && result.body === body && result.attempt === attempt
  return { data: result?.data, error: current ? result.error : undefined, loading: enabled && !current }
}
