import { useEffect, useRef, useState } from 'react'
import { BookOpen, Download, FlaskConical, LockKeyhole, Radio, Satellite, Telescope } from 'lucide-react'
import { ErrorMessage, Loading } from '../components/ui'
import { useAnalysis } from '../hooks/useAnalysis'
import { MissionReport } from './MissionReport'
import { ResearchLab } from './ResearchLab'
import { SensorPanel } from './SensorPanel'
import { SkyView } from './SkyView'
import { downloadReport, hints, readJournal, saveJournal, type Aperture, type Findings, type GameMode, type ReportRecord,
  type Sensor, type Target } from './model'
import './tess.css'

const modes: { id: GameMode; name: string }[] = [
  { id: 'training', name: 'Educativo' }, { id: 'science', name: 'Científico' }, { id: 'conference', name: 'Conferencia' },
]
const conferenceOrder = ['vela', 'vela-sur', 'pi-mensae']
const stages = ['Observar', 'Analizar', 'Informar'] as const
type Stage = 0 | 1 | 2

function Journal({ records }: { records: ReportRecord[] }) {
  const sorted = [...records].sort((a, b) => Number(a.real) - Number(b.real))
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  return <section className="tess-card tess-panel tess-journal" aria-labelledby="tess-journal-heading">
    <div className="tess-panel-head"><BookOpen size={21} /><div><h2 id="tess-journal-heading" ref={heading} tabIndex={-1}>Registro de misiones</h2>
      <p>{records.filter(item => !item.real && item.grade.correct && item.grade.supported).length} de 5 casos simulados resueltos</p></div></div>
    {sorted.length ? <ul>{sorted.map(item => <li key={item.id}>
      <div><strong>{item.name}</strong><small>{item.real ? 'Observaciones TESS' : 'Misión simulada'} · {item.grade.score}/5</small></div>
      <button type="button" className="button compact" aria-label={'Descargar informe de ' + item.name}
        onClick={() => downloadReport(item)}><Download size={16} /> Informe</button>
    </li>)}</ul> : <p>Tus informes aparecerán aquí cuando termines una investigación.</p>}
    <blockquote>«No necesitas viajar hasta otro sistema estelar para empezar a explorarlo. A veces basta con una señal, una pregunta y unas líneas de Python».</blockquote>
  </section>
}

function MissionControl({ target, route, unlocked, records, stage, select, mode }: {
  target: Target; route: Target[]; unlocked: Set<string>; records: ReportRecord[]; stage: Stage;
  select: (target: Target) => void; mode: GameMode
}) {
  const sectors = Array.from(new Set(route.map(item => item.sector)))
  const stars = route.filter(item => item.sector === target.sector)
  return <aside className="tess-card tess-panel tess-mission" aria-label="Control de misión">
    <div className="tess-panel-head"><Satellite size={21} /><div>
      <h2>Control de misión</h2><p>{target.name}</p>
    </div></div>
    <ol className="tess-steps" aria-label="Progreso de la misión">
      {stages.map((label, index) => <li key={label} aria-current={stage === index ? 'step' : undefined}
        className={index < stage ? 'done' : undefined}><span>{index + 1}</span>{label}</li>)}
    </ol>
    {mode === 'conference' ? <p>12 min · 3 para capturar, 4 para comparar casos y 5 para votar y analizar Pi Mensae.</p> : null}
    {sectors.length > 1 ? <div className="tess-sector">
      <label htmlFor="tess-sector">Sector</label>
      <select id="tess-sector" value={target.sector}
        onChange={event => {
          const next = route.find(item => item.sector === event.target.value && unlocked.has(item.id))
          if (next) select(next)
        }}>
        {sectors.map(sector => <option key={sector} disabled={!route.some(item => item.sector === sector && unlocked.has(item.id))}>
          {sector}</option>)}
      </select>
    </div> : null}
    <div className="tess-targets" role="group" aria-label="Estrellas del sector">
      {stars.map(item => {
        const saved = records.find(record => record.id === item.id)
        return <button key={item.id} type="button" className="button" disabled={!unlocked.has(item.id)}
          aria-pressed={target.id === item.id} onClick={() => select(item)}>
          <span className="tess-target-star" style={{ background: item.color }} /><span>{item.name}</span>
          {!unlocked.has(item.id) ? <LockKeyhole size={14} aria-label="Bloqueada" /> : saved ? <small>{saved.grade.score}/5</small> : null}
        </button>
      })}
    </div>
    {!target.real ? <p>Arrastra el cielo o usa las flechas. Centra la estrella antes de capturar su luz.</p> : null}
    {mode === 'training' && stage > 0 ? <details className="tess-details"><summary>Pista de la misión</summary>
      <p>{hints[target.id]}</p></details> : null}
  </aside>
}

const solved = (report: ReportRecord) => report.grade.correct && report.grade.supported

function Flight({ catalog }: { catalog: Target[] }) {
  const [mode, setMode] = useState<GameMode>('training')
  const [records, setRecords] = useState(readJournal)
  const [targetId, setTargetId] = useState(() => (catalog.find(item => !item.real &&
    !records.some(report => report.id === item.id && solved(report))) ?? catalog[0]).id)
  const [stage, setStage] = useState<Stage>(0)
  const [days, setDays] = useState(-1)
  const [aperture, setAperture] = useState<Aperture>('standard')
  const [locked, setLocked] = useState(false)
  const [captureAttempt, setCaptureAttempt] = useState(0)
  const [findings, setFindings] = useState<Findings>()
  const [storageError, setStorageError] = useState(false)
  const [journalOpen, setJournalOpen] = useState(false)
  const operation = useRef<HTMLHeadingElement>(null)
  const changeFocus = useRef(false)
  const target = catalog.find(item => item.id === targetId) ?? catalog[0]
  const campaign = catalog.filter(item => !item.real)
  const solvedIds = new Set(records.filter(solved).map(item => item.id))
  const firstPending = campaign.findIndex(item => !solvedIds.has(item.id))
  const route = mode === 'science' ? catalog.filter(item => item.real)
    : mode === 'conference' ? conferenceOrder.flatMap(id => catalog.filter(item => item.id === id)) : campaign
  const unlocked = new Set(route.filter((_, index) => mode !== 'training' || firstPending < 0 || index <= firstPending)
    .map(item => item.id))
  const score = records.filter(item => !item.real).reduce((sum, item) => sum + item.grade.score, 0)
  const nextId = mode === 'training' ? campaign[firstPending]?.id : route[route.findIndex(item => item.id === target.id) + 1]?.id
  const next = route.find(item => item.id === nextId && item.id !== target.id)
  const sensor = useAnalysis<Sensor>('game/sensor/' + target.id + '/' + days + '?aperture=' + aperture,
    undefined, !target.real && days >= 0, captureAttempt)
  const currentSensor = !sensor.loading && !sensor.error && days >= 0 ? sensor.data : undefined
  const allowTls = mode !== 'training' || records.some(item => !item.real && solved(item))

  useEffect(() => {
    if (changeFocus.current) {
      operation.current?.focus()
      changeFocus.current = false
    }
  }, [stage, targetId, mode])

  const focusStage = (value: Stage) => {
    changeFocus.current = value !== stage
    setStage(value)
  }
  const resetTarget = (nextTarget: Target) => {
    changeFocus.current = true
    setStage(0)
    setTargetId(nextTarget.id)
    setDays(-1)
    setAperture('standard')
    setLocked(false)
    setCaptureAttempt(0)
    setFindings(undefined)
    setJournalOpen(false)
  }
  const selectTarget = (nextTarget: Target) => {
    if (nextTarget.id !== target.id && unlocked.has(nextTarget.id)) resetTarget(nextTarget)
  }
  const selectMode = (next: GameMode) => {
    if (next === mode) return
    const initial = next === 'science' ? catalog.find(item => item.real)
      : next === 'training' ? campaign[firstPending] ?? campaign[0] : campaign[0]
    if (!initial) return
    resetTarget(initial)
    setMode(next)
  }
  const save = (report: ReportRecord) => {
    const previous = records.find(item => item.id === report.id)
    // Keep a resolved report when the player replays it with a less supported answer.
    if (previous && (previous.grade.score > report.grade.score || (solved(previous) && !solved(report)))) return
    const updated = [...records.filter(item => item.id !== report.id), report]
    setRecords(updated)
    setStorageError(!saveJournal(updated))
  }

  return <>
    <div className="tess-modebar">
      <div className="tess-inline" role="group" aria-label="Modo de juego">
        {modes.map(item => <button key={item.id} type="button" className="button"
          aria-pressed={mode === item.id} onClick={() => selectMode(item.id)}>{item.name}</button>)}
      </div>
      <div className="tess-inline">
        <span className="tess-score">{score} puntos</span>
        <button type="button" className="button" aria-expanded={journalOpen} onClick={() => setJournalOpen(!journalOpen)}>
          <BookOpen size={17} /> Registro
        </button>
      </div>
    </div>
    {storageError ? <p role="status" className="tess-warning">El navegador no puede guardar el registro entre visitas. Puedes descargar los informes.</p> : null}
    {journalOpen ? <Journal records={records} /> : null}
    <div className="tess-ops">
      <div className="tess-inline">
        <span className={'tess-data-label' + (target.real ? ' authentic-data' : '')}><Radio size={15} />
          {target.real ? 'NASA TESS · datos archivados' : 'Simulación de entrenamiento'}
        </span>
        <h2 ref={operation} tabIndex={-1}>{stage === 0 ? 'Observación' : stage === 1 ? 'Análisis' : 'Conclusión'}</h2>
      </div>
      {stage > 0 ? <button type="button" className="button quiet compact" onClick={() => focusStage(0)}>Volver a observar</button> : null}
    </div>
    {stage === 0 ? <>
      <div className="tess-flight">
        {target.real ? <section className="tess-card tess-panel tess-archive">
          <Telescope size={36} aria-hidden="true" />
          <h2>Pi Mensae · sector 1</h2>
          <p>Reproduce el análisis de Pi Mensae c con la curva de luz archivada de NASA TESS. Usa el respaldo local de MAST para comparar BLS y TLS.</p>
          <p>Este producto contiene fotometría de la estrella. La vista de píxeles está en las misiones simuladas.</p>
          <button type="button" className="button tess-primary" onClick={() => focusStage(1)}>
            <FlaskConical size={18} /> Abrir observaciones reales
          </button>
          <a href="https://stdatu.stsci.edu/missions-and-data/tess" target="_blank" rel="noreferrer">Archivo público de la misión TESS</a>
        </section> : <SkyView target={target} targets={catalog} unlocked={unlocked} key={target.id} onSelect={selectTarget} onLock={setLocked} />}
        <div className="tess-console">
          {!target.real ? <SensorPanel key={target.id} target={target} locked={locked} days={days} sensor={currentSensor}
            loading={sensor.loading} error={sensor.error} onDays={setDays} retry={() => setCaptureAttempt(value => value + 1)}
            research={() => focusStage(1)} aperture={aperture} changeAperture={setAperture} /> : null}
          <MissionControl target={target} route={route} unlocked={unlocked} records={records} select={selectTarget} stage={stage} mode={mode} />
        </div>
      </div>
    </> : <>
      <div className="tess-lab-layout">
        <div>
          <div hidden={stage !== 1}><ResearchLab target={target} days={target.real ? 24 : days} allowTls={allowTls} aperture={aperture}
            conference={mode === 'conference'} onReport={data => { setFindings(data); focusStage(2) }} /></div>
          {stage === 2 && findings ? <MissionReport target={target} days={days} findings={findings} conference={mode === 'conference'}
            onSave={save} onBack={() => focusStage(1)} nextLabel={next ? 'Siguiente misión' : 'Ver registro'}
            onNext={() => {
              if (next) resetTarget(next)
              else setJournalOpen(true)
            }} /> : null}
        </div>
        <MissionControl target={target} route={route} unlocked={unlocked} records={records} select={selectTarget} stage={stage} mode={mode} />
      </div>
    </>}
  </>
}

export function TessGame() {
  const title = useRef<HTMLHeadingElement>(null)
  const [attempt, setAttempt] = useState(0)
  const catalog = useAnalysis<Target[]>('game/catalog', undefined, true, attempt)
  useEffect(() => { title.current?.focus() }, [])

  return <main className="tess-game" aria-labelledby="tess-title">
    <div className="tess-shell">
      <header className="tess-hero">
        <p className="tess-mission-name"><Satellite size={17} /> TESS</p>
        <h1 id="tess-title" ref={title} tabIndex={-1}>Cazadores de mundos ocultos</h1>
        <p>Dirige las cámaras, mide el brillo de las estrellas y defiende tu conclusión con datos.</p>
      </header>
      {catalog.loading ? <Loading>Abriendo el catálogo de misiones…</Loading> : null}
      <ErrorMessage error={catalog.error} />
      {catalog.error ? <button type="button" className="button" onClick={() => setAttempt(value => value + 1)}>Reintentar catálogo</button>
        : catalog.data?.length ? <Flight catalog={catalog.data} /> : null}
    </div>
  </main>
}
