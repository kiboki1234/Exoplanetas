import { useState, type CSSProperties } from 'react'
import { Aperture as ApertureIcon, CalendarPlus, ChevronsRight } from 'lucide-react'
import { ErrorMessage, Loading, Range } from '../components/ui'
import { number } from '../services/api'
import { apertures, type Aperture, type Sensor, type Target } from './model'

function Pixels({ sensor, frame, setFrame }: { sensor: Sensor; frame: number; setFrame: (value: number) => void }) {
  const [pixel, setPixel] = useState(Math.floor(sensor.side**2 / 2))
  const index = Math.min(frame, sensor.time.length - 1)
  const counts = sensor.counts[index]
  const row = Math.floor(pixel / sensor.side) + 1
  const column = pixel % sensor.side + 1
  return <div className="tess-sensor">
    <div className="tess-pixels" role="group" aria-label="Píxeles del detector simulado"
      style={{ '--detector-side': sensor.side } as CSSProperties}>
      {counts.map((count, cell) => {
        const light = Math.min(1, Math.sqrt(Math.max(0, count - sensor.background[index]) / 450_000))
        const region = sensor.aperture[cell] ? 'in-aperture' : sensor.background_mask[cell] ? 'in-background' : undefined
        return <button key={cell} type="button" aria-pressed={cell === pixel}
          aria-label={'Píxel ' + (Math.floor(cell / sensor.side) + 1) + ', ' + (cell % sensor.side + 1) + ': ' + count + ' electrones'}
          title={number(count) + ' electrones'} className={region}
          style={{ background: 'rgb(' + [9 + 225 * light, 19 + 200 * light, 35 + 146 * light].map(Math.round).join(' ') + ')' }}
          onClick={() => setPixel(cell)} />
      })}
    </div>
    <div className="tess-sensor-readout">
      {sensor.time.length > 1 ? <Range id="tess-frame" label="Imagen del detector" value={index} minimum={0}
        maximum={sensor.time.length - 1} step={1} display={'Día ' + number(sensor.time[index], 2)} onChange={setFrame} /> : null}
      <dl>
        <div><dt>Flujo neto y su incertidumbre</dt><dd>{number(sensor.flux[index])} ± {number(sensor.error[index])} e⁻</dd></div>
        <div><dt>Píxel {row}, {column}</dt><dd>{number(counts[pixel])} e⁻</dd></div>
        <div><dt>Fondo por píxel</dt><dd>{number(sensor.background[index])} e⁻</dd></div>
        <div><dt>Desplazamiento de luz</dt><dd>{number(sensor.offset[index], 3)} px</dd></div>
      </dl>
      {sensor.flags[index] ? <p className="tess-warning">Medición marcada por un cambio de apuntado.</p> : null}
      <p>Azul: píxeles que se suman. Punteado: píxeles para estimar el fondo que se resta.</p>
      <p>Cadencia simulada: {sensor.cadence_minutes} min · ~{sensor.pixel_arcsec} segundos de arco por píxel.
        {sensor.missing ? ' Se omitieron ' + sensor.missing + ' cadencias durante la descarga simulada.' : null}</p>
    </div>
  </div>
}

export function SensorPanel({ target, locked, days, sensor, loading, error, onDays, retry, research, aperture, changeAperture }: {
  target: Target; locked: boolean; days: number; sensor?: Sensor; loading: boolean; error?: string;
  onDays: (days: number) => void; retry: () => void; research: () => void;
  aperture: Aperture; changeAperture: (aperture: Aperture) => void
}) {
  const [frame, setFrame] = useState(0)
  return <section className="tess-card tess-panel" aria-labelledby="tess-detector">
    <div className="tess-panel-head"><ApertureIcon size={21} /><div>
      <h2 id="tess-detector">Detector fotométrico</h2>
      <p>{target.name} · secuencia simulada</p>
    </div>{days >= 0 ? <strong className="tess-tag">{days} de 24 días</strong> : null}</div>
    {days < 0 ? <p>Centra la estrella en la cámara para capturar una imagen. Cada píxel registra cantidad de luz.</p> : null}
    <div className="tess-inline tess-actions">
      {error ? <button type="button" className="button" onClick={retry}>Reintentar captura</button> : null}
      {days < 0 ? <button type="button" className="button tess-primary" disabled={!locked} onClick={() => onDays(0)}>
        <ApertureIcon size={17} /> Capturar imagen
      </button> : <>
        <button type="button" className="button" disabled={loading || !locked || days >= 24}
          onClick={() => onDays(Math.min(24, days + 4))}><CalendarPlus size={17} /> Avanzar 4 días</button>
        <button type="button" className="button" disabled={loading || !locked || days >= 24}
          onClick={() => onDays(Math.min(24, days + 12))}><ChevronsRight size={17} /> Acelerar 12 días</button>
        <button type="button" className="button tess-primary" disabled={!sensor || days < 8 || loading}
          onClick={research}>Analizar curva de luz</button>
      </>}
    </div>
    {days >= 0 ? <div className="tess-sector"><label htmlFor="tess-aperture">Apertura fotométrica</label>
      <select id="tess-aperture" value={aperture} onChange={event => changeAperture(event.target.value as Aperture)}>
        {(Object.keys(apertures) as Aperture[]).map(key => <option key={key} value={key}>{apertures[key]}</option>)}
      </select>
    </div> : null}
    {sensor ? <Pixels sensor={sensor} frame={frame} setFrame={setFrame} /> : null}
    {loading ? <Loading>Registrando observaciones…</Loading> : null}
    <ErrorMessage error={error} />
    {days >= 0 && days < 8 ? <p>Reúne al menos 8 días para comparar varias mediciones.</p> : null}
    {days >= 0 && !locked ? <p className="tess-warning">Vuelve a centrar la estrella para continuar la secuencia.</p> : null}
  </section>
}
