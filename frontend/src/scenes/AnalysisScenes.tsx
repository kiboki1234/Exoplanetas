import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Activity, AudioLines, FlaskConical, Orbit, RotateCcw, ScanLine, SearchIcon } from 'lucide-react'
import type { Data } from 'plotly.js'
import { Plot } from '../charts/Plot'
import { foldedCurve, processedCurve } from '../charts/curves'
import { ErrorMessage, Loading, Metrics, Panel, Range } from '../components/ui'
import { useAnalysis } from '../hooks/useAnalysis'
import { analysisPath, number, publishedEpoch, publishedPeriod, type Folded, type Preparation, type Processed, type Search } from '../services/api'

export type FoldSelection = { period: number; epoch: number; source: 'manual' | 'published' | 'bls' }
export const initialFold: FoldSelection = { period: 5, epoch: publishedEpoch, source: 'manual' }

const foldLayout = {
  xaxis: { zeroline: true, zerolinecolor: '#ffc87f', range: [-0.085, 0.085] },
}
const fullFoldLayout = { xaxis: { zeroline: true, zerolinecolor: '#ffc87f', range: [-0.5, 0.5] } }

export function FoldScene({ options, selection, select, active, explore, datasetId, defaultFold }: {
  options: Preparation; selection: FoldSelection; select: (next: FoldSelection) => void;
  active: boolean; explore: () => void; datasetId?: string; defaultFold: FoldSelection
}) {
  const [full, setFull] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  const payload = { period: selection.period, epoch: selection.epoch, preparation: options }
  const { data, error, loading } = useAnalysis<Folded>(analysisPath('fold', datasetId), payload, active)
  const timeline = useAnalysis<Processed>(analysisPath('preprocess', datasetId), options, active)
  const phaseData = useMemo(() => data ? foldedCurve(data) : [], [data])
  const timeData = useMemo(() => timeline.data ? processedCurve(timeline.data) : [], [timeline.data])
  const change = (value: number) => select({ period: value, epoch: selection.epoch, source: 'manual' })
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    select({ period: Number(fields.get('period')), epoch: Number(fields.get('epoch') ?? selection.epoch), source: 'manual' })
  }
  const source = { manual: 'Período de prueba', published: 'Período publicado', bls: 'Candidato BLS' }[selection.source]
  const epochSource = selection.source === 'bls' ? 'ajuste BLS' : !datasetId && selection.epoch === publishedEpoch
    ? 'Huang et al. (2018)' : selection.epoch === defaultFold.epoch ? 'primera medición válida' : 'referencia elegida'
  return <div className="analysis-grid">
    <div className="compare-plots folding-plots">
      <Panel title="Serie temporal preparada" icon={<AudioLines size={17} />} className="small-chart">
        {timeline.data ? <Plot data={timeData} x="Tiempo (BTJD)" y={timeline.data.unit} label="Serie temporal preparada para plegar" />
          : timeline.error ? <ErrorMessage error={timeline.error} /> : <Loading />}
      </Panel>
      <Panel title="Curva plegada" icon={<Orbit size={18} />} className="small-chart"
        action={<button className="button compact" onClick={() => setFull(!full)}>{full ? 'Acercar a fase cero' : 'Ver órbita completa'}</button>}>
        <ErrorMessage error={error} />
        {data ? <Plot data={phaseData} x="Fase orbital (ciclos)" y="Variación (ppm)" label="Curva plegada por fase"
          layout={full ? fullFoldLayout : foldLayout} revision={String(full)} /> : loading ? <Loading /> : null}
      </Panel>
    </div>
    <Panel title="Hipótesis orbital" icon={<ScanLine size={18} />} className="analysis-controls">
      <div className="control-body">
        <div className="mode-label">{source}{loading ? ' · calculando' : ''}</div>
        <Range label="Período de prueba" id="fold-slider" value={selection.period} minimum={0.5} maximum={15} step={0.001}
          display={number(selection.period, 4) + ' d'} onChange={change} />
        <form className="period-input" ref={form} key={selection.period + ':' + selection.epoch} onSubmit={onSubmit}>
          {datasetId ? <label className="field-label fold-epoch" htmlFor="fold-epoch">Época de fase cero (BTJD)
            <input id="fold-epoch" name="epoch" type="number" step="any" required defaultValue={selection.epoch} />
          </label> : null}
          <label className="field-label" htmlFor="fold-period">Período exacto (d)
            <input id="fold-period" name="period" type="number" min=".5" max="15" step="any" required defaultValue={selection.period} />
          </label>
          <button className="button" type="submit">Aplicar</button>
        </form>
        <div className="button-row">
          {datasetId ? null : <button className="button primary" onClick={() => select({ period: publishedPeriod, epoch: publishedEpoch, source: 'published' })}>Mostrar período publicado</button>}
          <button className="button compact" onClick={() => { form.current?.reset(); select(defaultFold) }}><RotateCcw size={15} />Restaurar</button>
        </div>
        <p className="note-box">Época de fase cero <strong>{number(selection.epoch, 5)} BTJD</strong> · {epochSource}. La fase centra todas las órbitas respecto a esa época.</p>
        <button className="button" onClick={explore}><SearchIcon size={17} />Búsqueda automática</button>
      </div>
    </Panel>
  </div>
}

const searchLayout = { dragmode: 'zoom' as const }

export function BlsScene({ result, busy, error, onSearch, onSelect }: {
  result?: Search; busy: boolean; error?: string; onSearch: (minimum: number, maximum: number, recalculate: boolean) => void
  onSelect: (selection: FoldSelection, preparation: Preparation) => void
}) {
  const [minimum, setMinimum] = useState('1')
  const [maximum, setMaximum] = useState('12')
  const data = useMemo<Data[]>(() => result ? [{
    type: 'scatter', mode: 'lines', name: 'BLS', x: result.periods, y: result.power,
    line: { color: '#63e6ef', width: 2 }, hovertemplate: '%{x:.5f} d<br>Potencia %{y:.2f}<extra></extra>',
  }, {
    type: 'scatter', mode: 'markers', name: 'Candidatos', x: result.candidates.map(candidate => candidate.period),
    y: result.candidates.map(candidate => candidate.power), marker: { size: 10, color: '#ffc87f', symbol: 'diamond' },
    hovertemplate: 'Plegar %{x:.5f} d<extra></extra>',
  }] : [], [result])
  const pick = (index: number) => {
    const candidate = result?.candidates[index]
    if (candidate && result) onSelect({ period: candidate.period, epoch: candidate.epoch_btjd, source: 'bls' }, result.provenance.parameters.preparation)
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const clicked = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    onSearch(Number(minimum), Number(maximum), clicked?.value === 'recalculate')
  }
  return <div className="analysis-grid">
    <Panel title="Periodograma · Box Least Squares" icon={<Activity size={18} />} className="large-chart"
      action={result ? <span className="panel-tag">{result.cached ? 'Caché reproducible' : 'Calculado localmente'}</span> : null}>
      {result ? <Plot data={data} x="Período de prueba (días)" y="Potencia BLS (log-verosimilitud)" label="Periodograma BLS"
        layout={searchLayout} revision={result.provenance.parameters.minimum + ':' + result.provenance.parameters.maximum} onPoint={pick} />
        : <div className="empty-state"><ScanLine size={40} /><h2>{busy ? 'Astropy está probando períodos' : 'Explora un rango de períodos'}</h2>
          <p>El ajuste pondera cada cadencia con su incertidumbre y busca caídas con forma de caja.</p></div>}
      {result ? <div className="chart-footer">{number(result.points)} mediciones · {number(result.periods.length)} períodos evaluados</div> : null}
    </Panel>
    <Panel title="Búsqueda exploratoria" icon={<FlaskConical size={18} />} className="analysis-controls">
      <div className="control-body">
        <form className="bls-form" onSubmit={submit}>
          <label className="field-label" htmlFor="bls-min">Mínimo (d)<input id="bls-min" type="number" min=".5" max="13" step="any" required value={minimum} onChange={e => setMinimum(e.target.value)} /></label>
          <label className="field-label" htmlFor="bls-max">Máximo (d)<input id="bls-max" type="number" min=".6" max="15" step="any" required value={maximum} onChange={e => setMaximum(e.target.value)} /></label>
          <div className="button-row">
            <button className="button primary compact" disabled={busy} type="submit"><SearchIcon size={16} />Buscar candidatos</button>
            <button className="button compact" disabled={busy} value="recalculate" type="submit"><RotateCcw size={15} />Recalcular</button>
          </div>
        </form>
        {busy ? <Loading>Ejecutando BLS…</Loading> : null}
        <ErrorMessage error={error} />
        <p className="fine-print">Cajas de 1,8 a 4,8 h. La búsqueda usa el intervalo seleccionado y la preparación actual.</p>
        {result ? <div className="candidate-list">
          {result.candidates.map((candidate, i) => <button className="candidate" key={candidate.period} onClick={() => pick(i)}>
            <span><strong>{number(candidate.period, 4)} d</strong><small>{i === 0 ? 'Pico de mayor potencia' : candidate.alias ? 'Posible armónico ' + candidate.alias : 'Pico alternativo'}{candidate.window_edge ? ' · borde del rango' : ''}</small></span>
            <span>{number(candidate.depth_ppm, 0)} ppm · {number(candidate.duration_hours, 1)} h<small>Época {number(candidate.epoch_btjd, 4)} BTJD</small></span>
          </button>)}
        </div> : null}
        <p className="note-box">Armónicos, muestreo, huecos y tendencias residuales pueden producir picos parecidos. Un máximo BLS propone una hipótesis.</p>
      </div>
    </Panel>
  </div>
}

export function ResultScene({ result, onSearch, imported }: { result?: Search; onSearch: () => void; imported: boolean }) {
  const best = result?.candidates[0]
  const difference = best ? Math.abs(best.period - publishedPeriod) : undefined
  return <div className="revelation">
    <div className={imported ? undefined : 'two-columns'}>
      <Panel title="Medido en nuestro procesamiento" icon={<Activity size={19} />} className="result-panel">
        {best ? <div className="result-content">
          <div className="result-value">{number(best.period, 4)} <small>días</small></div>
          <Metrics items={[
            { label: 'Profundidad BLS', value: number(best.depth_ppm, 0) + ' ppm', detail: 'σ formal ≈ ' + number(best.depth_error_ppm, 1) + ' ppm' },
            { label: 'Duración', value: number(best.duration_hours, 1) + ' h' },
            { label: 'Época BTJD', value: number(best.epoch_btjd, 4) },
          ]} />
          {imported ? <p>Máximo del ajuste BLS para la curva cargada. Revisa el plegado y cada caída en la serie temporal antes de interpretar la señal.</p>
            : <p>{difference !== undefined && difference <= 0.1
            ? 'El máximo está cerca de la referencia. Diferencia en la malla: ' + (difference < 0.0001 ? '< 0,0001' : number(difference, 4)) + ' días.'
            : 'El máximo difiere de la referencia. Revisa el rango, los armónicos y el filtrado.'}</p>}
        </div> : <div className="empty-state mini"><p>{imported ? 'Ejecuta BLS para evaluar períodos en la curva cargada.' : 'Ejecuta BLS para comparar el máximo calculado con las cifras publicadas.'}</p><button className="button primary" onClick={onSearch}>Ir a búsqueda BLS</button></div>}
      </Panel>
      {imported ? null : <Panel title="Publicado por investigadores" icon={<Orbit size={19} />} className="result-panel published">
        <div className="result-content">
          <div className="result-value">{number(publishedPeriod, 4)} <small>días</small></div>
          <Metrics items={[{ label: 'Profundidad aproximada', value: '300 ppm', detail: 'Huang et al. (2018)' },
            { label: 'Radio planetario', value: '2,06 ± 0,03 R⊕', detail: 'Gandolfi et al. (2018)' }]} />
          <div className="references"><a href="https://doi.org/10.3847/2041-8213/aaef91" target="_blank" rel="noreferrer">Huang et al. · período y profundidad</a>
            <a href="https://doi.org/10.1051/0004-6361/201834289" target="_blank" rel="noreferrer">Gandolfi et al. · radio y confirmación</a></div>
        </div>
      </Panel>}
    </div>
    {imported ? <p className="scene-note">Una caída periódica puede deberse a un tránsito, una binaria eclipsante o un artefacto instrumental. Contrasta el resultado con otros datos y catálogos.</p>
      : <><div className="closing-line"><strong>No descubrimos este planeta hoy.</strong> Hemos reproducido parte de la evidencia con herramientas abiertas.</div>
        <p className="scene-note">Una caída también puede deberse a una binaria eclipsante o a un artefacto instrumental. Los estudios de 2018 combinaron tránsito y velocidades radiales.</p></>}
  </div>
}
