export type Metadata = {
  object: string
  tic: number
  sector: number
  start_btjd: number
  cadence_seconds: number
  source_url?: string
  product: string
  date_obs: string
  date_end: string
  rows: number
  flux_column: string
  flux_unit: string
  csv_sha256?: string
  origin: 'disco_local' | 'archivo_importado'
  refresh?: 'mast' | 'offline' | 'fallback'
  refresh_detail?: string
}

const apiRoot = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '') + '/api/'

export type LoadedObservations = { dataset_id?: string; metadata: Metadata; curve: Observations }

export type Observations = {
  kind: 'observaciones'
  time: (number | null)[]
  flux: (number | null)[]
  error: (number | null)[]
  quality: number[]
  cadence: number[]
  reference: number
  invalid: number
}

export type Preparation = {
  quality: 'none' | 'default' | 'strict'
  normalize: boolean
  detrend: boolean
  clip: boolean
}

export const preparationDefaults: Preparation = { quality: 'default', normalize: true, detrend: true, clip: false }
export const publishedPeriod = 6.2679
export const publishedEpoch = 1325.504

export type Processed = {
  kind: 'observaciones_transformadas'
  time: number[]
  flux: (number | null)[]
  error: (number | null)[]
  cadence: number[]
  unit: string
  reference: number
  baseline: number
  steps: {
    operation: string
    enabled: boolean
    preserved: number
    removed: number
    parameters: string
    purpose: string
    risk: string
  }[]
  code: string
}

export type Folded = {
  phase: number[]
  ppm: number[]
  error_ppm: number[]
  bins: [number, number, number][]
  period: number
  epoch_btjd: number
}

export type Candidate = {
  period: number
  epoch_btjd: number
  duration_hours: number
  depth_ppm: number
  depth_error_ppm: number
  power: number
  alias: string | null
  window_edge: boolean
}

export type Search = {
  periods: number[]
  power: number[]
  points: number
  candidates: Candidate[]
  cached: boolean
  provenance: { durations_days: number[]; parameters: { minimum: number; maximum: number; preparation: Preparation } }
}

export type Simulation = {
  kind: 'simulacion'
  time: number[]
  flux_percent: number[]
  depth_percent: number
  period: number
  radius: number
  noise_ppm: number
}

export async function request<T>(path: string, payload?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiRoot + path, {
    ...(payload ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}),
    signal,
  })
  return parseResponse<T>(response)
}

export async function uploadObservations(file: File, signal: AbortSignal): Promise<LoadedObservations> {
  const query = new URLSearchParams({ filename: file.name })
  const response = await fetch(apiRoot + 'dataset/import?' + query, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file, signal,
  })
  return parseResponse<LoadedObservations>(response)
}

export function analysisPath(action: 'preprocess' | 'fold' | 'bls', datasetId?: string) {
  return 'analysis/' + action + (datasetId ? '?' + new URLSearchParams({ dataset_id: datasetId }) : '')
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const problem = await response.json().catch(() => null)
    throw new Error(typeof problem?.detail === 'string' ? problem.detail : 'La API local devolvió un error.')
  }
  return response.json() as Promise<T>
}

export const number = (value: number, digits = 0) =>
  value.toLocaleString('es-EC', { minimumFractionDigits: digits, maximumFractionDigits: digits })
