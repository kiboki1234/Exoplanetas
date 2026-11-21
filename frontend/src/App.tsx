import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  Activity, ArrowLeft, ArrowRight, AudioLines, Check, CircleHelp, Contrast, Filter, Keyboard,
  Maximize, Minimize, Orbit, Pause, Play, Radio, RotateCcw, Satellite, ScanLine, Sparkles,
} from 'lucide-react'
import { Status } from './components/ui'
import { BlsScene, FoldScene, initialFold, ResultScene, type FoldSelection } from './scenes/AnalysisScenes'
import { CleanScene, NoData, RawScene, SourceScene } from './scenes/DataScenes'
import { SimulationScene } from './scenes/SimulationScene'
import { SummaryScene } from './scenes/SummaryScene'
import { analysisPath, preparationDefaults, request, uploadObservations,
  type LoadedObservations, type Metadata, type Observations, type Preparation, type Search } from './services/api'

const steps = [
  { name: 'Simulación de tránsito', topic: 'MODELO DE TRÁNSITO', title: '¿Podemos encontrar un planeta invisible?',
    lead: 'Observa qué cambia cuando un planeta cruza frente a su estrella.', icon: Orbit },
  { name: 'Observaciones TESS', topic: 'PROCEDENCIA CIENTÍFICA', title: 'Conectamos con NASA TESS',
    lead: 'Abrimos las observaciones auténticas de Pi Mensae conservadas en MAST.', icon: Satellite },
  { name: 'Curva de luz original', topic: 'FOTOMETRÍA TESS', title: '¿Ven algún patrón en todos estos puntos?',
    lead: 'Cada punto mide el brillo de la estrella en una cadencia de dos minutos.', icon: Activity },
  { name: 'Preparación de datos', topic: 'PROCESAMIENTO EN PYTHON', title: 'Limpiamos y preparamos la señal',
    lead: 'Compara ambos gráficos y observa qué cambia con cada operación.', icon: Filter },
  { name: 'Plegado orbital', topic: 'ANÁLISIS DE FASE', title: 'Buscamos periodicidad',
    lead: 'Superpone órbitas y cambia el período para ver si se alinean las caídas de brillo.', icon: AudioLines },
  { name: 'Búsqueda BLS', topic: 'DETECCIÓN AUTOMÁTICA', title: 'De la curva a los candidatos',
    lead: 'Astropy compara miles de hipótesis sin usar el período publicado como entrada.', icon: ScanLine },
  { name: 'Pi Mensae c', topic: 'RESULTADO Y EVIDENCIA', title: 'El tránsito de Pi Mensae c',
    lead: 'Compara lo que medimos con los resultados de los estudios originales.', icon: Sparkles },
  { name: 'Conclusiones', topic: 'APLICACIONES EN INGENIERÍA', title: '¿Qué aprendimos?',
    lead: 'Una misma forma de investigar conecta la astronomía con otros sistemas de medición.', icon: CircleHelp },
]

const stepNumber = (index: number) => String(index + 1).padStart(2, '0')
const initialNavigation = { scene: 0, visited: [0] }

export function App() {
  const [navigation, setNavigation] = useState(initialNavigation)
  const [revision, setRevision] = useState(0)
  const [dataset, setDataset] = useState<LoadedObservations>()
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string>()
  const [ready, setReady] = useState<boolean>()
  const [options, setOptions] = useState<Preparation>(preparationDefaults)
  const [fold, setFold] = useState<FoldSelection>(initialFold)
  const [result, setResult] = useState<Search>()
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string>()
  const [presentation, setPresentation] = useState(false)
  const [paused, setPaused] = useState(false)
  const [contrast, setContrast] = useState(false)
  const [noAnimation, setNoAnimation] = useState(false)
  const userReducedMotion = useReducedMotion()
  const reduced = Boolean(userReducedMotion || noAnimation)
  const dataRequest = useRef<AbortController>(null)
  const searchRequest = useRef<AbortController>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const shouldFocus = useRef(false)
  const { scene, visited } = navigation
  const metadata = dataset?.metadata
  const raw = dataset?.curve
  const datasetId = dataset?.dataset_id
  const imported = Boolean(datasetId)
  const origin = datasetId ?? metadata?.csv_sha256 ?? 'demo'
  const defaultFold = metadata && imported ? { ...initialFold, epoch: metadata.start_btjd } : initialFold

  useEffect(() => {
    const controller = new AbortController()
    request<{ dataset_ready: boolean }>('health', undefined, controller.signal)
      .then(health => setReady(health.dataset_ready))
      .catch(() => { if (!controller.signal.aborted) setReady(false) })
    const exit = () => { if (!document.fullscreenElement) setPresentation(false) }
    document.addEventListener('fullscreenchange', exit)
    return () => { controller.abort(); document.removeEventListener('fullscreenchange', exit) }
  }, [])

  const go = useCallback((next: number) => {
    if (next < 0 || next >= steps.length) return
    shouldFocus.current = true
    setNavigation(current => current.scene === next ? current : {
      scene: next, visited: current.visited.includes(next) ? current.visited : [...current.visited, next],
    })
  }, [])
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target = event.target
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        (target instanceof HTMLElement && target.closest('input, select, textarea, [contenteditable], .plot'))) return
      const next = event.key === 'ArrowRight' ? scene + 1 : event.key === 'ArrowLeft' ? scene - 1 : undefined
      if (next !== undefined) { event.preventDefault(); go(next) }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [scene, go])
  useEffect(() => {
    if (shouldFocus.current) {
      heading.current?.focus({ preventScroll: true })
      shouldFocus.current = false
    }
  }, [scene])

  const loadObservations = async (retrieve: (signal: AbortSignal) => Promise<LoadedObservations>) => {
    dataRequest.current?.abort()
    const controller = new AbortController()
    dataRequest.current = controller
    setLoading(true)
    setLoadError(undefined)
    try {
      const next = await retrieve(controller.signal)
      if (controller.signal.aborted) return
      if ((next.dataset_id ?? next.metadata.csv_sha256) !== origin) {
        searchRequest.current?.abort()
        setResult(undefined)
        setSearching(false)
        setSearchError(undefined)
        setOptions(preparationDefaults)
        setFold(next.dataset_id ? { ...initialFold, epoch: next.metadata.start_btjd } : initialFold)
      }
      setDataset(next)
      if (!next.dataset_id) setReady(true)
    } catch (error) {
      if (!controller.signal.aborted) setLoadError((error as Error).message)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }
  const load = (refresh = false) => loadObservations(async signal => {
    const refreshSource = () => request<Metadata>('dataset/refresh', {}, signal)
    const info = refresh ? await refreshSource() : await request<Metadata>('dataset/metadata', undefined, signal)
      .catch(error => { if (signal.aborted) throw error; return refreshSource() })
    const curve = await request<Observations>('dataset/lightcurve', undefined, signal)
    return { metadata: info, curve }
  })
  const search = async (minimum: number, maximum: number, recalculate: boolean) => {
    searchRequest.current?.abort()
    const controller = new AbortController()
    searchRequest.current = controller
    setSearching(true)
    setSearchError(undefined)
    try {
      const next = await request<Search>(analysisPath('bls', datasetId), { minimum, maximum, preparation: options, recalculate }, controller.signal)
      if (!controller.signal.aborted) setResult(next)
    } catch (error) {
      if (!controller.signal.aborted) setSearchError((error as Error).message)
    } finally {
      if (!controller.signal.aborted) setSearching(false)
    }
  }
  const explore = () => {
    go(5)
    if (!searching) void search(1, 12, false)
  }
  const reset = () => {
    dataRequest.current?.abort()
    searchRequest.current?.abort()
    setNavigation(initialNavigation)
    setRevision(previous => previous + 1)
    setDataset(undefined)
    setLoading(false)
    setLoadError(undefined)
    setOptions(preparationDefaults)
    setFold(initialFold)
    setResult(undefined)
    setSearching(false)
    setSearchError(undefined)
    setPaused(false)
    heading.current?.focus()
  }
  const fullscreen = async () => {
    if (presentation) {
      setPresentation(false)
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined)
    } else {
      setPresentation(true)
      await document.documentElement.requestFullscreen?.().catch(() => undefined)
    }
  }

  const mode = imported ? 'Archivo importado · análisis local'
    : metadata?.refresh === 'fallback' ? 'Respaldo local · MAST no disponible'
    : metadata?.refresh === 'mast' ? 'MAST consultado · copia local guardada'
      : ready === true ? 'Modo offline · respaldo verificado' : ready === false ? 'Respaldo pendiente' : 'Verificando respaldo local'
  const CurrentIcon = steps[scene].icon
  const page = (index: number) => {
    if (index === 0) return <SimulationScene paused={paused || index !== scene} reduced={reduced} />
    if (index === 1) return <SourceScene metadata={metadata} loading={loading} error={loadError} mode={mode}
      onLoad={() => void load()} onRefresh={() => void load(true)} onCurve={() => go(2)}
      onUpload={file => void loadObservations(signal => uploadObservations(file, signal))} />
    if (index === 7) return <SummaryScene backToStart={() => go(0)} />
    if (!raw || !metadata) return <NoData load={() => void load()} goToSource={() => go(1)} loading={loading} error={loadError} />
    if (index === 2) return <RawScene raw={raw} metadata={metadata} />
    if (index === 3) return <CleanScene raw={raw} options={options} setOptions={setOptions} active={index === scene} datasetId={datasetId} />
    if (index === 4) return <FoldScene options={options} selection={fold} select={setFold} active={index === scene}
      explore={explore} datasetId={datasetId} defaultFold={defaultFold} />
    if (index === 5) return <BlsScene result={result} busy={searching} error={searchError} onSearch={search}
      onSelect={(selection, preparation) => { setFold(selection); setOptions(preparation); go(4) }} />
    return <ResultScene result={result} onSearch={explore} imported={imported} />
  }

  const sceneTitle = imported && scene === 6 ? 'Resultado de ' + metadata?.object : steps[scene].title
  const sceneLead = imported ? ({
    1: 'Carga una curva de luz de TESS o vuelve a abrir la observación de Pi Mensae.',
    2: 'Cada punto mide el brillo de la estrella en una cadencia de ' + metadata?.cadence_seconds + ' segundos.',
    6: 'Revisa el período, la profundidad y la duración estimados con tu archivo.',
  } as Record<number, string>)[scene] ?? steps[scene].lead : steps[scene].lead

  return <div className={'lab' + (presentation ? ' in-presentation' : '') + (contrast ? ' high-contrast' : '')}>
    <header className="app-header">
      <button className="brand" onClick={() => go(0)} aria-label="COSMOS LAB, ir al inicio">
        <span className="brand-icon"><Orbit size={28} strokeWidth={1.8} /></span>
        <span><strong>COSMOS <b>LAB</b></strong><small>Explorador de exoplanetas con Python</small></span>
      </button>
      <div className="header-actions flex items-center gap-2">
        <span className="offline-pill"><span className={ready ? 'ready' : ''} />{ready === false ? 'Respaldo pendiente' : 'Modo offline'}</span>
        <button className="button presentation-button" onClick={() => void fullscreen()}>
          {presentation ? <Minimize size={17} /> : <Maximize size={17} />}{presentation ? 'Salir de presentación' : 'Modo Presentación'}
        </button>
        <button className="button icon-button desktop-only" title="Reiniciar toda la demostración" aria-label="Reiniciar toda la demostración" onClick={reset}><RotateCcw size={18} /></button>
      </div>
    </header>
    <div className="workspace">
      <aside className="sidebar">
        <div className="side-title"><span>RECORRIDO</span><span>{stepNumber(scene)} / 08</span></div>
        <nav aria-label="Escenas de la demostración">
          {steps.map((step, index) => {
            const Icon = step.icon
            return <button key={step.name} className={'step' + (scene === index ? ' current' : '')}
              aria-current={scene === index ? 'step' : undefined} onClick={() => go(index)}>
              <span className="step-icon"><Icon size={17} /></span>
              <span className="step-text">{imported && index === 6 ? 'Resultado del FITS' : step.name}</span><span className="step-number">{stepNumber(index)}</span>
            </button>
          })}
        </nav>
        <div className="sidebar-foot"><div className="local-mark"><Radio size={17} /></div><div>
          <strong>Python en el cosmos</strong><small>Astronomía computacional</small>
        </div></div>
      </aside>
      <main className="main">
        <header className="scene-header">
          <div className="scene-meta"><div className="eyebrow"><CurrentIcon size={15} /> {steps[scene].topic}{imported && scene >= 2 && scene <= 6 ? ' · TIC ' + metadata?.tic : ''}</div>
            {scene < 7 ? <Status kind={scene === 0 ? 'simulacion' : scene < 3 ? 'observaciones' : 'transformadas'} />
              : <span className="badge authentic"><Check size={14} /> Cierre de la demostración</span>}
          </div>
          <h1 ref={heading} tabIndex={-1}>{sceneTitle}</h1>
          <p>{sceneLead}</p>
        </header>
        <div className="scene-stack" key={revision}>
          {visited.map(index => <motion.div className="scene" key={index >= 2 && index <= 6 ? index + ':' + origin : index} hidden={index !== scene}
            initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.18 }}>
            {page(index)}
          </motion.div>)}
        </div>
      </main>
    </div>
    <footer className="app-footer">
      <div className="footer-tools">
        <span className="keyboard-hint"><Keyboard size={17} /> <kbd>←</kbd><kbd>→</kbd> Cambiar escena</span>
        <button className="button icon-button quiet mobile-only" onClick={reset} title="Reiniciar toda la demostración" aria-label="Reiniciar toda la demostración"><RotateCcw size={17} /></button>
        <button className="button icon-button quiet" aria-label="Pausar movimiento" aria-pressed={paused} title={paused ? 'Reanudar movimiento' : 'Pausar movimiento'} onClick={() => setPaused(!paused)}>{paused ? <Play size={17} /> : <Pause size={17} />}</button>
        <button className="button icon-button quiet" aria-label="Desactivar animaciones" aria-pressed={noAnimation} title="Desactivar animaciones" onClick={() => setNoAnimation(!noAnimation)}><AudioLines size={17} /></button>
        <button className="button icon-button quiet" aria-label="Alto contraste" aria-pressed={contrast} title="Alto contraste" onClick={() => setContrast(!contrast)}><Contrast size={18} /></button>
      </div>
      <div className="progress" aria-label={'Escena ' + (scene + 1) + ' de 8'}>
        {steps.map((step, index) => {
          const name = imported && index === 6 ? 'Resultado del FITS' : step.name
          return <button key={step.name} className={index === scene ? 'active' : index < scene ? 'past' : ''}
            title={name} aria-label={'Ir a ' + name} aria-current={index === scene ? 'step' : undefined} onClick={() => go(index)} />
        })}
      </div>
      <div className="footer-nav">
        <button className="button quiet compact" disabled={scene === 0} onClick={() => go(scene - 1)}><ArrowLeft size={17} /><span>Anterior</span></button>
        <button className="button primary compact" onClick={() => go(scene === steps.length - 1 ? 0 : scene + 1)}>
          {scene === steps.length - 1 ? 'Volver al inicio' : 'Siguiente'}<ArrowRight size={17} /></button>
      </div>
    </footer>
  </div>
}
