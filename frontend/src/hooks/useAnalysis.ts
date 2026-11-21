import { useEffect, useState } from 'react'
import { request } from '../services/api'

export function useAnalysis<T>(path: string, payload: object, enabled = true) {
  const body = JSON.stringify(payload)
  const [result, setResult] = useState<{ body: string; data?: T; error?: string }>()
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      request<T>(path, JSON.parse(body) as object, controller.signal)
        .then(data => { if (!controller.signal.aborted) setResult({ body, data }) })
        .catch((error: Error) => {
          if (!controller.signal.aborted) setResult({ body, error: error.message })
        })
    }, 140)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [body, enabled, path])
  return { data: result?.data, error: result?.body === body ? result.error : undefined,
    loading: enabled && result?.body !== body }
}
