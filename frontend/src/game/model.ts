import type { Preparation } from '../services/api'

export type Target = {
  id: string; name: string; sector: string; longitude: number; latitude: number; color: string; real: boolean
}
export type Sensor = {
  time: number[]; counts: number[][]; flux: number[]; flags: number[]; offset: number[]; side: number; aperture: boolean[]
  background: number[]; background_mask: boolean[]; error: number[]
  cadence_minutes: number; pixel_arcsec: number; missing: number
}
export type Aperture = 'narrow' | 'standard' | 'wide'
export const apertures: Record<Aperture, string> = { narrow: 'Estrecha', standard: 'Estándar', wide: 'Amplia' }
export type AnalysisMethod = 'bls' | 'tls'
export type SearchResult = {
  method: AnalysisMethod; periods: number[]; power: (number | null)[]; count: number; limits: [number, number]
  fit: { period: number; epoch: number; duration: number; depth: number } | null
  folded: [number, number, number][]; parity: [number, number] | null; secondary_depth: number | null
  cached: boolean
}
export type Prepared = {
  raw: { time: number[]; values: number[] }; clean: { time: number[]; values: number[] }
  points: number; original_points: number; flags: number; flag_excursion: number | null
  centroid: number | null; slow_span: number | null; unit: string; code: string
  steps: { operation: string; enabled: boolean; preserved: number; removed: number }[]
}
export type Grade = { score: number; correct: boolean; supported: boolean; explanation: string }
export type Conclusion = 'candidate' | 'binary' | 'moving' | 'variable' | 'instrument' | 'known'
export type Evidence = 'period' | 'parity' | 'centroid' | 'slow' | 'flags'
export type GameMode = 'training' | 'conference' | 'science'
export type Findings = {
  prepared: Prepared; bls?: SearchResult; tls?: SearchResult; preparation: Preparation; aperture: Aperture
}
export type ReportRecord = {
  id: string; name: string; real: boolean; grade: Grade; text: string
}

export const conclusions: Record<Conclusion, string> = {
  candidate: 'Señal candidata a planeta',
  binary: 'Binaria eclipsante',
  moving: 'Contaminación por un cuerpo menor',
  variable: 'Variabilidad estelar',
  instrument: 'Ruido o artefacto instrumental',
  known: 'Señal de un planeta conocido',
}

export const hints: Record<string, string> = {
  vela: 'Busca caídas breves que se repitan. Compara el período con la forma de la señal al superponer las vueltas.',
  'vela-sur': 'Si dos caídas consecutivas tienen profundidades distintas, prueba pensar en dos estrellas que se ocultan por turnos.',
  centauro: 'Arrastra el control de imagen en la secuencia. ¿El pico de luz se queda en el centro del detector?',
  'centauro-norte': 'Compara la curva original y la corregida. Busca cambios suaves y anchos que duren parte de varios días.',
  fenix: 'Compara la curva antes y después de usar el filtro de calidad. Revisa cuántas mediciones quedaron marcadas.',
  'pi-mensae': 'Contrasta el período obtenido con el publicado. La coincidencia permite reproducir un análisis de un planeta conocido.',
}

const journalKey = 'cosmos-tess-journal-v1'

export function readJournal(): ReportRecord[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(journalKey) ?? '[]')
    return Array.isArray(value) ? value.filter(item =>
      typeof item?.id === 'string' && typeof item?.name === 'string' && typeof item?.text === 'string' &&
      typeof item?.real === 'boolean' && Number.isInteger(item?.grade?.score)).slice(0, 6) : []
  } catch {
    return []
  }
}

export function saveJournal(reports: ReportRecord[]) {
  try {
    localStorage.setItem(journalKey, JSON.stringify(reports))
    return true
  } catch {
    return false
  }
}

export function downloadReport(report: ReportRecord) {
  const url = URL.createObjectURL(new Blob([report.text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'informe-tess-' + report.id + '.txt'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
