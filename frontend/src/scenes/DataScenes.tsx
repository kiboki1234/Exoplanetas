import { useMemo, useRef, useState } from 'react'
import { Activity, ArrowDownToLine, Code2, Database, ExternalLink, Filter, Radio, RotateCcw, Satellite, Telescope, Upload } from 'lucide-react'
import { Plot, type Limits } from '../charts/Plot'
import { fluxLabel, lightCurve, processedCurve, type FluxMode } from '../charts/curves'
import { ErrorMessage, Loading, Panel } from '../components/ui'
import { useAnalysis } from '../hooks/useAnalysis'
import { analysisPath, number, preparationDefaults, type Metadata, type Observations, type Preparation, type Processed } from '../services/api'

export function SourceScene({ metadata, loading, error, onLoad, onRefresh, onUpload, onCurve, mode }: {
  metadata?: Metadata; loading: boolean; error?: string; mode: string;
  onLoad: () => void; onRefresh: () => void; onUpload: (file: File) => void; onCurve: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const imported = metadata?.origin === 'archivo_importado'
  const tic = 'TIC ' + (metadata?.tic ?? 261136679)
  const target = metadata?.object ?? 'Pi Mensae'
  const dates = metadata?.date_obs && metadata.date_end
    ? metadata.date_obs.slice(0, 10) + ' a ' + metadata.date_end.slice(0, 10)
    : metadata ? 'Sin fechas UTC en la cabecera' : 'Pendiente de leer el respaldo'
  return <div className="two-columns source-scene">
    <section className="source-feature panel">
      <div className="source-visual" aria-hidden="true">
        <span className="radar ring-one" /><span className="radar ring-two" /><span className="radar ring-three" />
        <Telescope size={100} strokeWidth={0.85} />
      </div>
      <div className="feature-copy">
        <div className="eyebrow"><Satellite size={15} /> NASA TRANSITING EXOPLANET SURVEY SATELLITE</div>
        <h2>Una estrella. Miles de mediciones.</h2>
        <p>TESS mide repetidamente el brillo de estrellas cercanas. MAST conserva esas mediciones para que podamos volver a analizarlas.</p>
        <div className="button-row">
          <button className="button primary" onClick={onLoad} disabled={loading}><ArrowDownToLine size={19} />
            {imported ? 'Volver a Pi Mensae' : metadata ? 'Observaciones cargadas' : 'Cargar observaciones reales'}
          </button>
          <button className="button" onClick={() => fileInput.current?.click()} disabled={loading}><Upload size={17} /> Cargar archivo FITS</button>
          <input ref={fileInput} hidden type="file" aria-label="Archivo FITS de TESS" accept=".fits,.fit,.fits.gz,.fit.gz"
            onChange={event => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (file) onUpload(file)
            }} />
        </div>
        <p className="source-upload-help">Para otra estrella, elige una curva de luz TESS <code>_lc.fits</code> o <code>_lc.fits.gz</code>.</p>
        {loading ? <Loading>Leyendo observaciones…</Loading> : null}
        <ErrorMessage error={error} />
      </div>
    </section>
    <Panel title="Ficha de observación" icon={<Database size={18} />} className="source-details">
      <dl className="metadata">
        <div><dt>Telescopio / origen</dt><dd>{imported ? 'TESS · archivo local' : 'TESS · NASA / MAST'}</dd></div>
        <div><dt>Objeto / identificador</dt><dd>{target === tic ? tic : target + ' · ' + tic}</dd></div>
        <div><dt>Sector / cadencia</dt><dd>{metadata?.sector ?? 1} · {number(metadata?.cadence_seconds ?? 120, metadata && !Number.isInteger(metadata.cadence_seconds) ? 2 : 0)} segundos</dd></div>
        <div><dt>Producto / columna</dt><dd>{imported ? 'Curva FITS' : 'SPOC'} · {metadata?.flux_column ?? 'PDCSAP_FLUX'}</dd></div>
        <div><dt>Intervalo en metadatos FITS</dt><dd>{dates}</dd></div>
        {imported ? <div><dt>Archivo</dt><dd className="filename">{metadata.product}</dd></div> : null}
        <div><dt>Estado</dt><dd className="cyan-text"><Radio size={16} /> {mode}</dd></div>
      </dl>
      <p className="fine-print">PDCSAP conserva la fotometría calibrada y corrige tendencias instrumentales mediante el procesamiento SPOC.</p>
      {metadata?.refresh_detail ? <p className="fine-print" role="status">{metadata.refresh_detail}</p> : null}
      <div className="button-row">
        {metadata?.source_url ? <a className="button compact" href={metadata.source_url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> FITS en MAST</a> : null}
        {imported ? <button className="button primary compact" onClick={onCurve}>Ver curva de luz</button>
          : <button className="button quiet compact" onClick={onRefresh} disabled={loading}>Comprobar origen</button>}
      </div>
    </Panel>
  </div>
}

export function RawScene({ raw, metadata }: { raw: Observations; metadata: Metadata }) {
  const [mode, setMode] = useState<FluxMode>('original')
  const [selection, setSelection] = useState<Limits>()
  const [revision, setRevision] = useState(0)
  const data = useMemo(() => lightCurve(raw, mode), [raw, mode])
  const points = useMemo(() => selection ? raw.time.filter(t => t !== null && t >= selection[0] && t <= selection[1]).length : 0, [raw, selection])
  return <div className="chart-scene">
    <Panel title={'Serie temporal del sector ' + metadata.sector} icon={<Activity size={18} />} className="large-chart"
      action={<div className="button-row"><label className="sr-only" htmlFor="flux-mode">Unidad de flujo</label>
        <select id="flux-mode" value={mode} onChange={event => setMode(event.target.value as FluxMode)}>
          <option value="original">Flujo original</option><option value="normalized">Flujo normalizado</option><option value="ppm">Variación en ppm</option>
        </select>
        <button className="button compact" onClick={() => { setRevision(revision + 1); setSelection(undefined) }}><RotateCcw size={15} />Restablecer vista</button>
      </div>}>
      <Plot data={data} x="Tiempo (BTJD)" y={fluxLabel[mode]} revision={mode + revision} label={'Curva de luz real de ' + metadata.object} onSelection={setSelection} />
      <div className="chart-footer"><span>{number(raw.time.length)} cadencias · {number(raw.invalid)} con tiempo, flujo o error inválidos</span>
        <span>{selection ? number(selection[0], 3) + '–' + number(selection[1], 3) + ' BTJD · ' + number(points) + ' cadencias en el intervalo' : 'Usa Seleccionar intervalo en la barra del gráfico.'}</span></div>
    </Panel>
    <p className="scene-note">BTJD = BJD<sub>TDB</sub> − 2 457 000. El flujo normalizado divide por la mediana global. Las ppm miden la diferencia relativa, multiplicada por un millón. Los huecos conservan su duración real.</p>
  </div>
}

export function CleanScene({ raw, options, setOptions, active, datasetId }: {
  raw: Observations; options: Preparation; setOptions: (value: Preparation) => void; active: boolean; datasetId?: string
}) {
  const [range, setRange] = useState<Limits>()
  const [revision, setRevision] = useState(0)
  const [original, setOriginal] = useState(false)
  const { data, error, loading } = useAnalysis<Processed>(analysisPath('preprocess', datasetId), options, active)
  const initial = useMemo(() => lightCurve(raw, 'original'), [raw])
  const processed = useMemo(() => data ? processedCurve(data) : [], [data])
  const synchronize = (next?: Limits) => {
    if (!next) {
      setRange(undefined)
      setRevision(previous => previous + 1)
      return
    }
    setRange(current => current?.[0] === next[0] && current?.[1] === next[1] ? current : next)
  }
  const set = (next: Preparation) => { setOriginal(false); setOptions(next) }
  const restore = () => {
    setOptions({ quality: 'none', normalize: false, detrend: false, clip: false })
    setOriginal(true)
    setRange(undefined)
    setRevision(revision + 1)
  }
  return <div className="analysis-grid">
    <div className="compare-plots">
      <Panel title="Antes · PDCSAP original" icon={<Activity size={17} />} className="small-chart">
        <Plot data={initial} label="Flujo antes de limpiar" x="Tiempo (BTJD)" y="e⁻/s" range={range} revision={'antes' + revision} onRange={synchronize} />
      </Panel>
      <Panel title={original ? 'Después · vista original restaurada' : 'Después · curva procesada'} icon={<Activity size={17} />} className="small-chart"
        action={loading && !original ? <span className="panel-tag" role="status">Actualizando…</span> : null}>
        <ErrorMessage error={error} />
        <Plot data={original ? initial : processed} label="Flujo después de limpiar" x="Tiempo (BTJD)"
          y={original ? 'e⁻/s' : data?.unit ?? 'Flujo'} range={range} revision={'después' + revision + original + data?.unit} onRange={synchronize} />
      </Panel>
    </div>
    <Panel title="Preparación de datos" icon={<Filter size={17} />} className="analysis-controls">
      <div className="control-body">
        <label className="inline-toggle"><input type="checkbox" checked={!original}
          onChange={event => event.target.checked ? setOriginal(false) : restore()} /> Eliminar NaN, infinitos y σ no válida</label>
        <label className="field-label" htmlFor="quality-mask">Máscara de calidad
          <select id="quality-mask" value={options.quality} onChange={event => set({ ...options, quality: event.target.value as Preparation['quality'] })}>
            <option value="none">Sin máscara</option><option value="default">Lightkurve predeterminada</option><option value="strict">Lightkurve estricta</option>
          </select>
        </label>
        <label className="inline-toggle"><input type="checkbox" checked={options.normalize} onChange={event => set({ ...options, normalize: event.target.checked })} /> Normalizar por la mediana</label>
        <label className="inline-toggle"><input type="checkbox" checked={options.detrend} onChange={event => set({ ...options, detrend: event.target.checked })} /> Corregir tendencia lenta</label>
        <label className="inline-toggle"><input type="checkbox" checked={options.clip} onChange={event => set({ ...options, clip: event.target.checked })} /> Tratar atípicos positivos</label>
        <div className="button-row"><button className="button compact" onClick={restore}><RotateCcw size={15} /> Restablecer original</button>
          <button className="button quiet compact" onClick={() => set(preparationDefaults)}>Usar valores iniciales</button></div>
        {original ? <p className="fine-print">La vista original conserva las marcas de filas inválidas. Plegado y BLS requieren mediciones finitas con incertidumbre positiva.</p> : null}
        <div className="step-list">
          {data?.steps.map(step => <details key={step.operation}>
            <summary>{step.operation}<span>{original || !step.enabled ? 'Vista sin aplicar' : number(step.preserved) + ' · −' + number(step.removed)}</span></summary>
            <p>{step.purpose} {step.risk}</p><p>{step.parameters}</p>
          </details>)}
          {data && !original ? <details><summary><Code2 size={16} /> Python equivalente</summary><pre>{data.code}</pre></details> : null}
        </div>
        <p className="fine-print">Inspecciona la ventana de filtrado. Una limpieza agresiva puede borrar el tránsito.</p>
      </div>
    </Panel>
  </div>
}

export function NoData({ load, goToSource, loading, error }: { load: () => void; goToSource: () => void; loading: boolean; error?: string }) {
  return <section className="panel empty-state">
    <Database size={36} />
    <h2>Abre una curva de luz de TESS</h2>
    <p>Usa la demostración de Pi Mensae o elige un FITS de otra estrella en Observaciones TESS.</p>
    <div className="button-row">
      <button className="button primary" disabled={loading} onClick={load}>Cargar observaciones reales</button>
      <button className="button" onClick={goToSource}>Ir a Observaciones TESS</button>
    </div>
    {loading ? <Loading>Leyendo observaciones…</Loading> : null}
    <ErrorMessage error={error} />
  </section>
}

