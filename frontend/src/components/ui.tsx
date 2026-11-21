import type { ReactNode } from 'react'
import { Activity, CircleAlert, Database, Radio } from 'lucide-react'

export function Panel({ title, icon, action, className = '', children }: {
  title: string; icon?: ReactNode; action?: ReactNode; className?: string; children: ReactNode
}) {
  return <section className={'panel ' + className}>
    <header className="panel-heading"><span>{icon}{title}</span>{action}</header>
    {children}
  </section>
}

export function Status({ kind }: { kind: 'simulacion' | 'observaciones' | 'transformadas' }) {
  if (kind === 'simulacion') return <span className="badge synthetic"><Activity size={14} />Simulación <b>·</b> datos sintéticos</span>
  return <span className="badge authentic"><Database size={14} />{kind === 'observaciones' ? 'Observaciones TESS' : 'Observaciones TESS · procesadas'}</span>
}

export function ErrorMessage({ error }: { error?: string }) {
  return error ? <div className="error" role="alert"><CircleAlert size={17} />{error}</div> : null
}

export function Loading({ children = 'Calculando en Python…' }: { children?: ReactNode }) {
  return <div className="loading" role="status"><Radio size={18} />{children}</div>
}

export function Range({ label, id, value, minimum, maximum, step, display, onChange }: {
  label: string; id: string; value: number; minimum: number; maximum: number; step: number
  display: string; onChange: (next: number) => void
}) {
  return <div className="range-control">
    <label htmlFor={id}>{label}<output htmlFor={id}>{display}</output></label>
    <input id={id} type="range" min={minimum} max={maximum} step={step} value={value}
      onChange={event => onChange(event.target.valueAsNumber)} />
  </div>
}

export function Metrics({ items }: { items: { label: string; value: string; detail?: string }[] }) {
  return <dl className="metrics">{items.map(item => <div key={item.label}>
    <dt>{item.label}</dt><dd>{item.value}</dd>{item.detail ? <small>{item.detail}</small> : null}
  </div>)}</dl>
}
