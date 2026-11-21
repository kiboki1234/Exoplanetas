import { Activity, Antenna, ArrowLeft, Factory, Radar, Server, Waves } from 'lucide-react'

const applications = [
  { title: 'Monitoreo IoT', icon: Waves, text: 'Distinguir cambios físicos de errores de un sensor.' },
  { title: 'Telemetría de satélites', icon: Antenna, text: 'Reconocer señales recurrentes y períodos sin comunicación.' },
  { title: 'Detección de anomalías', icon: Radar, text: 'Examinar un evento raro frente a la señal de referencia.' },
  { title: 'Series industriales', icon: Factory, text: 'Separar un ciclo de operación de una deriva gradual.' },
  { title: 'Infraestructura informática', icon: Server, text: 'Validar picos y caídas contra métricas independientes.' },
]

export function SummaryScene({ backToStart }: { backToStart: () => void }) {
  return <section className="summary">
    <div className="takeaways">{applications.map(item => <article className="panel takeaway" key={item.title}>
      <item.icon size={25} /><h2>{item.title}</h2><p>{item.text}</p>
    </article>)}</div>
    <div className="final-feature panel">
      <Activity size={38} />
      <div><h2>La ciencia empieza con una pregunta.</h2><p>Python nos ayuda a buscar la evidencia.</p></div>
      <button className="button" onClick={backToStart}><ArrowLeft size={17} /> Volver a la simulación</button>
    </div>
  </section>
}
