import { useMemo, useState } from 'react'
import { Activity, ArrowRight, Braces, ScanLine } from 'lucide-react'
import type { Data } from 'plotly.js'
import { Plot } from '../charts/Plot'
import { ErrorMessage, Loading } from '../components/ui'
import { useAnalysis } from '../hooks/useAnalysis'
import { number, preparationDefaults, type Preparation } from '../services/api'
import { apertures, type AnalysisMethod, type Aperture, type Findings, type Prepared, type SearchResult, type Target } from './model'

const methods: AnalysisMethod[] = ['bls', 'tls']
const layout = { margin: { l: 65, r: 15, t: 20, b: 48 }, showlegend: false }
const basePreparation: Preparation = { ...preparationDefaults, detrend: false }

function useInvestigation<T>(target: Target, days: number, aperture: Aperture, preparation: Preparation, method: string, enabled: boolean, attempt: number) {
  const result = useAnalysis<T>('game/analyze', { target: target.id, days, aperture, preparation, method }, enabled, attempt)
  return { ...result, data: enabled && !result.loading && !result.error ? result.data : undefined }
}

function CurvePanel({ prepared, target, showing, onShowing }: {
  prepared?: Prepared; target: Target; showing: 'raw' | 'clean'; onShowing: (type: 'raw' | 'clean') => void
}) {
  const series = prepared?.[showing]
  const traces = useMemo<Data[]>(() => series ? [{
    type: 'scatter', mode: 'lines+markers', x: series.time, y: series.values,
    line: { color: showing === 'raw' ? '#bca6fc' : '#79e4ed', width: 1.15 },
    marker: { size: 3 }, name: 'Fotometría',
  }] : [], [series, showing])
  return <>
    <div className="tess-inline" role="group" aria-label="Vista de la curva de luz">
      <button type="button" className="button compact" aria-pressed={showing === 'raw'} onClick={() => onShowing('raw')}>Original</button>
      <button type="button" className="button compact" aria-pressed={showing === 'clean'} onClick={() => onShowing('clean')}>Procesada</button>
    </div>
    {prepared ? <><div className="tess-plot">
      <Plot data={traces} label="Curva de luz de la misión" x={target.real ? 'Tiempo (BTJD)' : 'Día simulado'}
        y={showing === 'raw' ? 'Cambio (ppm)' : prepared.unit === 'relativo' ? 'Flujo relativo'
          : target.real ? 'Flujo (e⁻/s)' : 'Flujo (cuentas)'}
        revision={showing} layout={layout} />
    </div><p>{number(prepared.points)} de {number(prepared.original_points)} mediciones en el análisis.
      {target.real ? ' BTJD es la escala de tiempo de TESS. El gráfico muestra una muestra de la serie.' : null}</p></> : null}
  </>
}

function SearchPlots({ result, phase }: { result: SearchResult; phase: boolean }) {
  const data = useMemo<Data[]>(() => [{
    type: 'scatter', mode: 'lines', name: result.method.toUpperCase(),
    x: phase ? result.folded.map(bin => bin[0]) : result.periods,
    y: phase ? result.folded.map(bin => bin[1]) : result.power,
    line: { color: phase ? '#ffc87f' : '#82dce6', width: 2 },
  }], [phase, result])
  return <div className="tess-plot"><Plot data={data} label={phase ? 'Curva plegada de la misión' : 'Periodograma de la misión'}
    revision={result.method + String(phase)} x={phase ? 'Fracción de una vuelta' : 'Período de prueba (días)'}
    y={phase ? 'Cambio (ppm)' : 'Puntuación del ajuste'} layout={layout} /></div>
}

export function ResearchLab({ target, days, aperture, allowTls, conference, onReport }: {
  target: Target; days: number; aperture: Aperture; allowTls: boolean; conference: boolean; onReport: (data: Findings) => void
}) {
  const [preparation, setPreparation] = useState(basePreparation)
  const [run, setRun] = useState({ bls: 0, tls: 0, prepare: 0 })
  const [method, setMethod] = useState<AnalysisMethod>('bls')
  const [showing, setShowing] = useState<'raw' | 'clean'>('raw')
  const [phase, setPhase] = useState(false)
  const prepared = useInvestigation<Prepared>(target, days, aperture, preparation, 'prepare', true, run.prepare)
  const bls = useInvestigation<SearchResult>(target, days, aperture, preparation, 'bls', run.bls > 0, run.bls)
  const tls = useInvestigation<SearchResult>(target, days, aperture, preparation, 'tls', run.tls > 0, run.tls)
  const reports = { bls, tls }
  const current = reports[method]
  const fit = current.data?.fit
  const canReport = prepared.data && (bls.data || tls.data)
  const changePreparation = (next: Preparation) => {
    setPreparation(next)
    setRun({ bls: 0, tls: 0, prepare: 0 })
    setShowing('clean')
  }
  const search = (next: AnalysisMethod) => {
    setMethod(next)
    if (!reports[next].data && !reports[next].loading) {
      setRun(previous => ({ ...previous, [next]: previous[next] + 1 }))
    }
  }

  return <div className="tess-workbench">
    <section className="tess-card tess-panel" aria-labelledby="tess-photometry">
      <div className="tess-panel-head"><Activity size={20} /><div>
        <h2 id="tess-photometry">Curva de luz</h2>
        <p>{target.real ? 'Sector 1 · brillo calibrado de TESS (PDCSAP)' :
          target.name + ' · ' + days + ' días simulados · apertura ' + apertures[aperture].toLowerCase()}</p>
      </div></div>
      <div className="tess-checks" role="group" aria-label="Preparar mediciones">
        <label><input type="checkbox" checked={preparation.quality !== 'none'} onChange={event =>
          changePreparation({ ...preparation, quality: event.target.checked ? 'default' : 'none' })} /> Filtrar calidad</label>
        <label><input type="checkbox" checked={preparation.normalize} onChange={event =>
          changePreparation({ ...preparation, normalize: event.target.checked })} /> Normalizar brillo</label>
        <label><input type="checkbox" checked={preparation.detrend} onChange={event =>
          changePreparation({ ...preparation, detrend: event.target.checked })} /> Corregir tendencia lenta</label>
      </div>
      <CurvePanel prepared={prepared.data} target={target} showing={showing} onShowing={setShowing} />
      {prepared.loading ? <Loading>Preparando la curva en Python…</Loading> : null}
      <ErrorMessage error={prepared.error} />
      {prepared.error ? <button type="button" className="button" onClick={() =>
        setRun(previous => ({ ...previous, prepare: previous.prepare + 1 }))}>Reintentar preparación</button> : null}
      {prepared.data && !conference ? <details className="tess-details"><summary><Braces size={16} /> Ver cómo lo hizo Python</summary>
        <pre>{prepared.data.code}</pre>
      </details> : null}
    </section>
    <section className="tess-card tess-panel" aria-labelledby="tess-periods">
      <div className="tess-panel-head"><ScanLine size={20} /><div><h2 id="tess-periods">Buscar señales</h2>
        <p>BLS busca caídas rectangulares. TLS ajusta una forma de tránsito.</p></div></div>
      <div className="tess-inline" role="group" aria-label="Algoritmos de búsqueda">
        {methods.map(name => <button key={name} type="button" className="button" aria-pressed={method === name && run[name] > 0}
          disabled={!prepared.data || (name === 'tls' && !allowTls)} onClick={() => search(name)}>
          {reports[name].data ? 'Ver ' : reports[name].error ? 'Reintentar ' : 'Ejecutar '}{name.toUpperCase()}</button>)}
      </div>
      {!allowTls ? <p>Completa tu primer informe para desbloquear TLS en la campaña.</p> : null}
      {current.loading ? <Loading>Probando períodos con {method.toUpperCase()} en Python…</Loading> : null}
      <ErrorMessage error={current.error} />
      {current.data ? <>
        <div className="tess-results">
          <div><span>Mejor período</span><strong>{fit ? number(fit.period, 3) + ' d' : 'Sin ajuste'}</strong></div>
          <div><span>Profundidad estimada</span><strong>{fit ? number(fit.depth) + ' ppm' : '—'}</strong></div>
          <div><span>Muestras usadas</span><strong>{number(current.data.count)}</strong></div>
        </div>
        {target.real && method === 'tls' ? <p>TLS agrupa las cadencias en intervalos de 10 minutos.</p> : null}
        {current.data.cached ? <p>Resultado precalculado con las observaciones del respaldo.</p> : null}
        <div className="tess-inline tess-actions" role="group" aria-label="Vista del resultado">
          <button type="button" className="button compact" aria-pressed={!phase || !fit} onClick={() => setPhase(false)}>Períodos probados</button>
          <button type="button" className="button compact" disabled={!fit} aria-pressed={phase && Boolean(fit)}
            onClick={() => setPhase(true)}>Superponer vueltas</button>
        </div>
        <SearchPlots result={current.data} phase={phase && Boolean(fit)} />
        {current.data.parity ? <p>Profundidad par / impar: {current.data.parity.map(value => number(value)).join(' / ')} ppm.</p> : null}
        {current.data.secondary_depth !== null ? <p>Profundidad a media vuelta: {number(current.data.secondary_depth)} ppm.</p> : null}
      </> : null}
      <p>Un pico indica el mejor ajuste de la búsqueda. Las falsas alarmas también pueden producir picos.</p>
      {!conference ? <details className="tess-details"><summary>¿Qué significan BLS y TLS?</summary>
        <p><strong>BLS</strong> significa <em>Box Least Squares</em>. Prueba caídas rectangulares que se repiten.</p>
        <p><strong>TLS</strong> significa <em>Transit Least Squares</em>. Ajusta una caída con entrada y salida graduales.</p>
      </details> : null}
      <button type="button" className="button tess-primary tess-actions" disabled={!canReport}
        onClick={() => prepared.data && onReport({ prepared: prepared.data, bls: bls.data, tls: tls.data, preparation, aperture })}>
        Preparar informe <ArrowRight size={17} />
      </button>
    </section>
  </div>
}
