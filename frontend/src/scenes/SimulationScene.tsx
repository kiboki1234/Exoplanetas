import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, CircleDot, Orbit, Pause, Play, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { ErrorMessage, Loading, Panel, Range } from '../components/ui'
import { useAnalysis } from '../hooks/useAnalysis'
import { number, type Simulation } from '../services/api'

const stars = Array.from({ length: 84 }, (_, i) => ({
  x: ((i * 197 + i * i * 13) % 557) + 1, y: ((i * 311 + i * i * 29) % 307) + 1,
  r: i % 9 === 0 ? 1.25 : 0.55, opacity: 0.16 + (i % 7) / 16,
}))

function OrbitDiagram({ radius, phase }: { radius: number; phase: number }) {
  const angle = phase * 2 * Math.PI
  const x = 280 + 222.6 * Math.sin(angle)
  const y = 156 + 30 * (Math.cos(angle) - 1)
  const inFront = Math.cos(angle) > 0
  const planet = <g transform={'translate(' + x + ' ' + y + ')'}>
    <circle r={radius * 84 + 9} fill="none" stroke="#80dce8" strokeOpacity=".45" />
    <circle r={radius * 84} fill="url(#planet-tone)" stroke="#8ed5e6" strokeWidth=".7" />
  </g>
  return <svg className="orbit-art" viewBox="0 0 560 310" role="img" aria-label="Esquema animado de un planeta que cruza frente a una estrella">
    <defs>
      <radialGradient id="sky-glow"><stop stopColor="#342547" /><stop offset="1" stopColor="#0a1225" stopOpacity="0" /></radialGradient>
      <radialGradient id="corona"><stop offset=".46" stopColor="#fbb055" stopOpacity=".32" /><stop offset=".68" stopColor="#ff9d45" stopOpacity=".14" /><stop offset="1" stopColor="#ff9d45" stopOpacity="0" /></radialGradient>
      <radialGradient id="surface" cx=".35" cy=".30" r=".75">
        <stop stopColor="#fff1bc" /><stop offset=".32" stopColor="#ffd37f" /><stop offset=".68" stopColor="#f7a44e" />
        <stop offset=".88" stopColor="#e6752f" /><stop offset="1" stopColor="#ffac50" />
      </radialGradient>
      <radialGradient id="planet-tone" cx=".25" cy=".23" r=".8"><stop stopColor="#37627e" /><stop offset=".48" stopColor="#192b49" /><stop offset="1" stopColor="#080f20" /></radialGradient>
      <clipPath id="star-disc"><circle cx="280" cy="156" r="84" /></clipPath>
      <filter id="granulation">
        <feTurbulence type="fractalNoise" baseFrequency=".058 .083" numOctaves="3" seed="8" />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer><feFuncA type="linear" slope=".52" /></feComponentTransfer>
      </filter>
    </defs>
    <rect width="560" height="310" fill="url(#sky-glow)" />
    {stars.map((star, index) => <circle key={index} cx={star.x} cy={star.y} r={star.r} fill="#bdd8f4" opacity={star.opacity} />)}
    <g strokeWidth="1" fill="none" stroke="#56718f">
      <circle cx="280" cy="156" r="111" opacity=".32" />
      <circle cx="280" cy="156" r="135" opacity=".22" strokeDasharray="2 6" />
      <path d="M47 126H513M280 17V288" strokeDasharray="2 7" opacity=".36" />
      <path d="M57.4 126a222.6 30 0 0 1 445.2 0" stroke="#6e8dad" strokeDasharray="4 5" opacity=".73" />
    </g>
    {inFront ? null : planet}
    <circle cx="280" cy="156" r="145" fill="url(#corona)" />
    <circle cx="280" cy="156" r="84" fill="url(#surface)" stroke="#ffd583" strokeWidth="1.3" />
    <rect x="196" y="72" width="168" height="168" filter="url(#granulation)" clipPath="url(#star-disc)" style={{ mixBlendMode: 'soft-light' }} />
    <path d="M57.4 126a222.6 30 0 0 0 445.2 0" fill="none" stroke="#a0c8db" strokeDasharray="4 6" opacity=".68" />
    {inFront ? planet : null}
    <g fill="#8ea6be" fontSize="11" letterSpacing="1.7">
      <text x="25" y="31">VISTA ESQUEMÁTICA</text>
      <text x="25" y="288">PLANO ORBITAL</text>
    </g>
    <path d="M520 265v18h18M520 274h11" fill="none" stroke="#5d7491" />
  </svg>
}

function LiveCurve({ simulation, phase }: { simulation: Simulation; phase: number }) {
  const index = Math.min(simulation.time.length - 1, Math.max(0, Math.round((phase + 0.5) * (simulation.time.length - 1))))
  const coordinates = useMemo(() => {
    const s = simulation
    const low = Math.min(...s.flux_percent) - Math.max(0.07, s.depth_percent * 0.14)
    const high = Math.max(...s.flux_percent) + Math.max(0.07, s.depth_percent * 0.14)
    const valueY = (value: number) => 222 - 180 * (value - low) / (high - low)
    const positions = s.flux_percent.map((flux, i) => [72 + i * 377 / (s.flux_percent.length - 1), valueY(flux)])
    const ticks = Array.from({ length: 5 }, (_, i) => low + (high - low) * i / 4)
    return { positions, ticks, valueY, path: positions.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2)).join(' ') }
  }, [simulation])
  const [cursorX, cursorY] = coordinates.positions[index]
  return <svg viewBox="0 0 486 280" className="live-curve" role="img" aria-label="Curva de luz sintética sincronizada con la animación orbital">
    <defs><linearGradient id="curve-fill" x2="0" y2="1"><stop stopColor="#58e9ed" stopOpacity=".21"/><stop offset="1" stopColor="#58e9ed" stopOpacity="0"/></linearGradient></defs>
    <rect x="214" y="42" width="93" height="180" fill="#79d8ef" opacity=".055" />
    {coordinates.ticks.map(tick => <g key={tick}>
      <line x1="72" x2="449" y1={coordinates.valueY(tick)} y2={coordinates.valueY(tick)} stroke="#263750" />
      <text x="62" y={coordinates.valueY(tick) + 4} textAnchor="end">{number(tick, 2)}</text>
    </g>)}
    {[0, 1, 2, 3, 4].map(i => <g key={i}>
      <line x1={72 + i * 94.25} x2={72 + i * 94.25} y1="42" y2="222" stroke="#263750" />
      <text x={72 + i * 94.25} y="245" textAnchor="middle">{number((i / 4 - 0.5) * simulation.period, 1)}</text>
    </g>)}
    <text x="70" y="25">Flujo relativo (%)</text>
    <text x="260" y="268" textAnchor="middle">Tiempo respecto al tránsito (días)</text>
    <path d={coordinates.path + ' L449 222 L72 222 Z'} fill="url(#curve-fill)" />
    <path d={coordinates.path} fill="none" stroke="#67e9f0" strokeWidth="2.2" strokeLinejoin="round" />
    <path d={'M' + cursorX + ' 42V222'} stroke="#f8c985" strokeDasharray="4 5" />
    <circle cx={cursorX} cy={cursorY} r="5" fill="#ffd38d" stroke="#0c172b" strokeWidth="1.7" />
  </svg>
}

export function SimulationScene({ paused, reduced }: { paused: boolean; reduced: boolean }) {
  const [radius, setRadius] = useState(0.12)
  const [period, setPeriod] = useState(6)
  const [noise, setNoise] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [phase, setPhase] = useState(0.2)
  const clock = useRef(0.2)
  const { data, error } = useAnalysis<Simulation>('simulator/generate', { radius, period, noise })
  useEffect(() => {
    if (!playing || paused || reduced) return
    let token = 0
    let last = 0
    const step = (timestamp: number) => {
      if (last) {
        clock.current = ((clock.current + 0.5 + Math.min(timestamp - last, 55) / (period * 1250)) % 1) - 0.5
        setPhase(clock.current)
      }
      last = timestamp
      token = requestAnimationFrame(step)
    }
    token = requestAnimationFrame(step)
    return () => cancelAnimationFrame(token)
  }, [period, playing, paused, reduced])
  const place = (next: number) => { clock.current = next; setPhase(next) }
  return <div className="simulation-content">
    <div className="science-grid">
      <Panel title="Geometría del tránsito" icon={<Orbit size={18} />} className="orbit-panel" action={<span className="panel-tag">Modelo didáctico</span>}>
        <OrbitDiagram radius={radius} phase={phase} />
        <div className="orbit-controls">
          <button className="button primary compact" disabled={reduced || paused} onClick={() => setPlaying(!playing)}>
            {playing && !reduced && !paused ? <Pause size={16} /> : <Play size={16} />}
            {playing && !reduced && !paused ? 'Pausar' : 'Reproducir'}
          </button>
          <button className="button compact" onClick={() => place(0.2)}><RotateCcw size={15} /> Reiniciar órbita</button>
          <button className="button quiet compact" onClick={() => { setPlaying(false); place(0) }}><CircleDot size={15} /> Ver tránsito</button>
        </div>
      </Panel>
      <Panel title="Curva de luz simulada" icon={<Activity size={18} />} className="signal-panel"
        action={<span className="signal-key">Flujo</span>}>
        {data ? <LiveCurve simulation={data} phase={phase} /> : error ? <ErrorMessage error={error} /> : <Loading>Cargando simulación…</Loading>}
        <div className="depth-readout"><span><i /> Profundidad aproximada</span><strong>{number(radius ** 2 * 100, 2)} %</strong></div>
      </Panel>
    </div>
    <Panel title="Parámetros orbitales" icon={<SlidersHorizontal size={17} />} className="parameters-panel"
      action={<span className="formula">ΔF / F ≈ (R<sub>p</sub> / R<sub>★</sub>)²</span>}>
      <div className="range-grid">
        <Range label="Radio relativo" id="planet-radius" value={radius} minimum={0.02} maximum={0.22} step={0.01} display={number(radius, 2) + ' R★'} onChange={setRadius} />
        <Range label="Período orbital" id="orbit-period" value={period} minimum={2} maximum={12} step={0.1} display={number(period, 1) + ' días'} onChange={setPeriod} />
        <Range label="Ruido instrumental" id="orbit-noise" value={noise} minimum={0} maximum={2500} step={50} display={number(noise) + ' ppm'} onChange={setNoise} />
      </div>
    </Panel>
    <p className="scene-note">En este modelo, la estrella tiene brillo uniforme. En un tránsito real influyen el oscurecimiento del limbo y la geometría orbital.</p>
  </div>
}
