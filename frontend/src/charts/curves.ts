import type { Data } from 'plotly.js'
import type { Folded, Observations, Processed } from '../services/api'

export type FluxMode = 'original' | 'normalized' | 'ppm'

export const fluxLabel = { original: 'Flujo (e⁻/s)', normalized: 'Flujo / mediana', ppm: 'Variación (ppm)' }
const cyan = '#5ae6ee'
const gold = '#ffc87f'
const gray = '#ac98e9'

export function lightCurve(raw: Observations, mode: FluxMode, markInvalid = true): Data[] {
  const factor = mode === 'original' ? 1 : (mode === 'ppm' ? 1e6 : 1) / raw.reference
  const baseline = mode === 'ppm' ? 1e6 : 0
  const flux = raw.flux.map(value => value === null ? null : value * factor - baseline)
  const errors = raw.error.map(value => value === null ? '—' : (value * factor).toPrecision(4))
  const traces: Data[] = [{
    type: 'scattergl', mode: 'markers', name: 'PDCSAP', x: raw.time, y: flux,
    marker: { color: cyan, opacity: 0.48, size: 4 },
    customdata: errors.map((error, index) => [error, raw.quality[index], raw.cadence[index]]) as never,
    hovertemplate: '%{x:.6f} BTJD<br>Flujo %{y:.7g}<br>σ %{customdata[0]}<br>Calidad %{customdata[1]}<br>Cadencia %{customdata[2]}<extra></extra>',
  }]
  if (!markInvalid) return traces
  const finite = flux.filter(value => value !== null)
  const floor = finite.reduce((minimum, value) => Math.min(minimum, value), Infinity)
  const invalidTimes: number[] = []
  const invalidCadences: number[] = []
  const flaggedTime: number[] = []
  const flaggedFlux: number[] = []
  const flaggedQuality: number[] = []
  for (let i = 0; i < raw.time.length; i++) {
    const t = raw.time[i]
    const y = flux[i]
    const error = raw.error[i]
    if (t === null) continue
    if (y === null || error === null || error <= 0) {
      invalidTimes.push(t)
      invalidCadences.push(raw.cadence[i])
    } else if (raw.quality[i] !== 0) {
      flaggedTime.push(t)
      flaggedFlux.push(y)
      flaggedQuality.push(raw.quality[i])
    }
  }
  traces.push({
    type: 'scattergl', mode: 'markers', name: 'Marcados por SPOC', x: flaggedTime, y: flaggedFlux,
    customdata: flaggedQuality, marker: { color: gold, opacity: 0.6, size: 5 },
    hovertemplate: '%{x:.6f} BTJD<br>Flujo %{y:.7g}<br>Máscara %{customdata}<extra></extra>',
  }, {
    type: 'scattergl', mode: 'markers', name: 'Inválidos (marca inferior)', x: invalidTimes,
    y: invalidTimes.map(() => floor), customdata: invalidCadences, marker: { color: gray, opacity: 0.7, size: 5 },
    hovertemplate: '%{x:.6f} BTJD<br>Cadencia %{customdata}<br>Flujo o error inválido<extra></extra>',
  })
  return traces
}

export function processedCurve(curve: Processed): Data[] {
  return [{
    type: 'scattergl', mode: 'markers', name: 'Procesado', x: curve.time, y: curve.flux,
    marker: { color: cyan, opacity: 0.48, size: 4 }, customdata: curve.error as never,
    hovertemplate: '%{x:.6f} BTJD<br>Flujo %{y:.7g}<br>σ %{customdata:.5g}<extra></extra>',
  }]
}

export function foldedCurve(curve: Folded): Data[] {
  return [{
    type: 'scattergl', mode: 'markers', name: 'Cadencias', x: curve.phase, y: curve.ppm, customdata: curve.error_ppm,
    marker: { color: cyan, opacity: 0.25, size: 4 },
    hovertemplate: 'Fase %{x:.5f}<br>%{y:.1f} ppm<br>σ %{customdata:.1f} ppm<extra></extra>',
  }, {
    type: 'scatter', mode: 'lines+markers', name: 'Mediana por fase', x: curve.bins.map(bin => bin[0]),
    y: curve.bins.map(bin => bin[1]), customdata: curve.bins.map(bin => bin[2]), marker: { size: 5, color: gold },
    line: { width: 2, color: gold }, hovertemplate: 'Fase %{x:.4f}<br>%{y:.1f} ppm<br>%{customdata} cadencias<extra></extra>',
  }]
}
