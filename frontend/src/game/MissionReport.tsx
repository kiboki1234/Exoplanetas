import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Download, FileText } from 'lucide-react'
import { ErrorMessage, Loading } from '../components/ui'
import { number, request } from '../services/api'
import { apertures, conclusions, downloadReport, type Conclusion, type Evidence, type Findings, type Grade,
  type ReportRecord, type SearchResult, type Target } from './model'

function methodSummary(result?: SearchResult) {
  if (!result) return 'Pendiente'
  if (!result.fit) return 'Sin ajuste'
  return number(result.fit.period, 3) + ' días · ' + number(result.fit.depth) + ' ppm de profundidad'
}

function facts(findings: Findings): { key: Evidence; title: string; value: string }[] {
  const { prepared, bls, tls } = findings
  const search = bls?.fit ? bls : tls
  const evidence: ReturnType<typeof facts> = []
  if (search?.fit) evidence.push({ key: 'period', title: 'Caídas que se repiten',
    value: 'BLS: ' + methodSummary(bls) + '. TLS: ' + methodSummary(tls) + '.' })
  if (search?.parity || search?.secondary_depth != null) {
    const depth = search.parity?.map(value => number(value)).join(' / ')
    evidence.push({ key: 'parity', title: 'Profundidades de los eclipses',
      value: (depth ? 'Par e impar: ' + depth + ' ppm. ' : '') +
        (search.secondary_depth != null ? 'A media vuelta: ' + number(search.secondary_depth) + ' ppm.' : '') })
  }
  if (prepared.centroid !== null) evidence.push({ key: 'centroid', title: 'Posición de la luz en el detector',
    value: 'Desplazamiento máximo de ' + number(prepared.centroid, 3) + ' píxeles.' })
  if (prepared.slow_span !== null) evidence.push({ key: 'slow', title: 'Cambios de brillo entre días',
    value: 'Diferencia entre los percentiles 10 y 90 de las medianas diarias: ' + number(prepared.slow_span) + ' ppm.' })
  evidence.push({ key: 'flags', title: 'Mediciones marcadas por el sensor',
    value: number(prepared.flags) + ' marcadas.' + (prepared.flag_excursion !== null
      ? ' Máxima desviación marcada: ' + number(prepared.flag_excursion) + ' ppm.' : '') })
  return evidence
}

export function MissionReport({ target, days, findings, conference, onSave, onBack, onNext, nextLabel }: {
  target: Target; days: number; findings: Findings; conference: boolean; onSave: (report: ReportRecord) => void
  onBack: () => void; onNext: () => void; nextLabel: string
}) {
  const [conclusion, setConclusion] = useState<Conclusion | ''>('')
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [notes, setNotes] = useState('')
  const [record, setRecord] = useState<ReportRecord>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const pending = useRef<AbortController>(null)
  const feedback = useRef<HTMLHeadingElement>(null)
  const measurements = facts(findings)
  useEffect(() => () => pending.current?.abort(), [])
  useEffect(() => { if (record) feedback.current?.focus() }, [record])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!conclusion || evidence.length === 0 || pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setError(undefined)
    try {
      const grade = await request<Grade>('game/report', {
        target: target.id, conclusion, evidence,
        measured_periods: [findings.bls?.fit?.period, findings.tls?.fit?.period].filter(period => period !== undefined),
        compared_algorithms: Boolean(findings.bls && findings.tls),
      }, controller.signal)
      if (controller.signal.aborted) return
      const source = target.real ? 'NASA TESS / MAST · Pi Mensae, TIC 261136679, sector 1, fotometría PDCSAP.'
        : 'Detector simulado · ' + days + ' días · sector de entrenamiento ' + target.sector +
          ' · apertura ' + apertures[findings.aperture].toLowerCase() + '.'
      const text = [
        'TESS: Cazadores de mundos ocultos', 'Informe · ' + target.name, '', 'Fuente: ' + source,
        'Conclusión del equipo: ' + conclusions[conclusion], '',
        'Mediciones utilizadas: ' + findings.prepared.points + ' de ' + findings.prepared.original_points,
        'Preparación: ' + findings.prepared.steps.filter(step => step.enabled).map(step => step.operation).join(', '),
        'BLS: ' + methodSummary(findings.bls), 'TLS: ' + methodSummary(findings.tls), '',
        'Evidencias seleccionadas',
        ...measurements.filter(measurement => evidence.includes(measurement.key))
          .map(measurement => '- ' + measurement.title + '. ' + measurement.value),
        ...(notes.trim() ? ['', 'Siguiente comprobación propuesta', notes.trim()] : []),
        '', 'Evaluación: ' + grade.score + '/5. ' + (grade.correct ? 'Conclusión correcta.' : 'Conclusión por revisar.'),
        grade.explanation, '',
      ].join('\n')
      const report = { id: target.id, name: target.name, real: target.real, grade, text }
      setRecord(report)
      onSave(report)
    } catch (problem) {
      if (!controller.signal.aborted) setError((problem as Error).message)
    } finally {
      if (!controller.signal.aborted) setBusy(false)
      pending.current = null
    }
  }

  if (record) return <section className="tess-card tess-panel tess-report-result">
    <div className="tess-panel-head"><FileText size={23} /><div>
      <h2 tabIndex={-1} ref={feedback}>{record.grade.correct ? 'Conclusión correcta' : 'Revisa tu conclusión'}</h2>
      <p>{target.name} · informe de evidencias</p>
    </div><strong className="tess-tag">{record.grade.score} / 5 puntos</strong></div>
    <p>{record.grade.explanation}</p>
    {!record.grade.supported ? <p>Revisa qué medición distingue esta señal de las explicaciones alternativas.</p> : null}
    <details className="tess-details"><summary>Leer informe completo</summary><pre>{record.text}</pre></details>
    <div className="tess-inline tess-actions">
      <button type="button" className="button" onClick={() => downloadReport(record)}><Download size={17} /> Descargar informe</button>
      <button type="button" className="button quiet" onClick={onBack}><ArrowLeft size={17} /> Volver a comparar</button>
      <button type="button" className="button tess-primary" onClick={onNext}>{nextLabel} <ArrowRight size={17} /></button>
    </div>
  </section>

  return <form className="tess-card tess-panel tess-report" onSubmit={event => void submit(event)}>
    <div className="tess-panel-head"><FileText size={22} /><div><h2>Informe de misión</h2><p>{target.name}</p></div></div>
    <p>{conference ? 'Pide al público que vote por una explicación y justifique su voto con una medición.' :
      'Elige la explicación más probable y hasta dos mediciones que la sostengan.'}</p>
    <div className="tess-report-grid">
      <fieldset disabled={busy}>
        <legend>¿Qué explica la señal?</legend>
        {(Object.keys(conclusions) as Conclusion[]).filter(key => target.real || key !== 'known').map(key =>
          <label key={key}><input type="radio" name="tess-conclusion" checked={conclusion === key}
            onChange={() => setConclusion(key)} /> {conclusions[key]}</label>)}
      </fieldset>
      <fieldset disabled={busy}>
        <legend>¿Qué mediste?</legend>
        {measurements.map(({ key, title, value }) => <label key={key}>
          <input type="checkbox" checked={evidence.includes(key)} disabled={!evidence.includes(key) && evidence.length >= 2}
            onChange={event => setEvidence(current => event.target.checked ? [...current, key] : current.filter(item => item !== key))} />
          <span>{title}<small>{value}</small></span>
        </label>)}
      </fieldset>
    </div>
    <label className="tess-report-note">¿Qué comprobarías después? <span>(opcional)</span>
      <textarea value={notes} disabled={busy} maxLength={500} rows={2} onChange={event => setNotes(event.target.value)} />
    </label>
    {busy ? <Loading>Evaluando las evidencias…</Loading> : null}
    <ErrorMessage error={error} />
    <div className="tess-inline tess-actions">
      <button type="submit" className="button tess-primary" disabled={busy || !conclusion || !evidence.length}>Evaluar y guardar informe</button>
      <button type="button" className="button quiet" onClick={onBack}><ArrowLeft size={17} /> Volver al análisis</button>
    </div>
  </form>
}
