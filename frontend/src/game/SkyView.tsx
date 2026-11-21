import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crosshair, Minus, Plus } from 'lucide-react'
import { number } from '../services/api'
import type { Target } from './model'
import { direction, pointAt, projector, skyStars } from './skyProjection'

const cameraOffsets = [-36, -12, 12, 36]

export function SkyView({ target, targets, unlocked, onSelect, onLock }: {
  target: Target; targets: Target[]; unlocked: Set<string>; onSelect: (target: Target) => void; onLock: (ready: boolean) => void
}) {
  const view = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number; distance: number }>(undefined)
  const [point, setPoint] = useState(() => pointAt(target.longitude - 8, target.latitude + 4 + cameraOffsets[1]))
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [camera, setCamera] = useState(1)
  const [zoom, setZoom] = useState(1)
  const aim = pointAt(point.longitude, point.latitude - cameraOffsets[camera])
  const project = useMemo(() => projector(aim, size.width, size.height, zoom),
    [aim.longitude, aim.latitude, size, zoom])
  const positions = useMemo(() => targets.flatMap(star => {
    const position = project(direction(star.longitude, star.latitude))
    return position ? [{ star, ...position }] : []
  }), [project, targets])
  const tracking = positions.find(position => position.star.id === target.id)
  const locked = Boolean(size.width > 1 && tracking &&
    Math.hypot(tracking.x - size.width / 2, tracking.y - size.height / 2) <= 15)

  useEffect(() => { onLock(locked) }, [locked, onLock])
  useEffect(() => {
    const node = view.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const node = view.current
    const context = node?.getContext('2d')
    if (!node || !context) return
    const { width, height } = size
    if (width < 2 || height < 2) return
    const scale = Math.min(window.devicePixelRatio, 2)
    node.width = Math.round(width * scale)
    node.height = Math.round(height * scale)
    context.scale(scale, scale)
    context.clearRect(0, 0, width, height)
    for (const star of skyStars) {
      const position = project(star.direction)
      if (!position || position.x < 0 || position.y < 0 || position.x > width || position.y > height) continue
      context.globalAlpha = star.alpha
      context.fillStyle = star.color
      context.fillRect(position.x, position.y, star.size, star.size)
    }
    context.globalAlpha = 1
    for (const { star, x, y } of positions) {
      if (x < 8 || x > width - 8 || y < 12 || y > height - 12) continue
      const radius = star.id === target.id ? 29 : 16
      const glow = context.createRadialGradient(x, y, 0, x, y, radius)
      glow.addColorStop(0, star.color)
      glow.addColorStop(.12, star.color + '85')
      glow.addColorStop(1, star.color + '00')
      context.fillStyle = glow
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
      context.fillStyle = '#fff'
      context.fillRect(x - 1.5, y - 1.5, 3, 3)
      context.font = '600 12px system-ui'
      context.fillStyle = star.id === target.id ? '#f7d092' : '#b8c9e4'
      const labelWidth = context.measureText(star.name).width
      context.fillText(star.name, x + 12 + labelWidth > width ? x - labelWidth - 12 : x + 12, y - 11)
    }
  }, [positions, project, size, target.id])

  const move = (horizontal: number, vertical: number) => setPoint(current =>
    pointAt(current.longitude + horizontal, current.latitude + vertical))
  const changeZoom = (delta: number) => setZoom(current => Math.min(3, Math.max(1, current + delta)))
  const focusTarget = () => setPoint(pointAt(target.longitude, target.latitude + cameraOffsets[camera]))

  return <section className="tess-card tess-sky-card" aria-label="Cámara de navegación espacial">
    <div className="tess-sky">
      <canvas ref={view} tabIndex={0} aria-label="Visor 3D del cielo. Usa las flechas para cambiar el apuntado."
        onKeyDown={event => {
          const motions: Record<string, [number, number]> = {
            ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, 4], ArrowDown: [0, -4],
          }
          const motion = motions[event.key]
          if (motion) { event.preventDefault(); move(motion[0] / zoom, motion[1] / zoom) }
          if (event.key === '+' || event.key === '-') { event.preventDefault(); changeZoom(event.key === '+' ? .5 : -.5) }
        }}
        onPointerDown={event => {
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { x: event.clientX, y: event.clientY, distance: 0 }
        }}
        onPointerMove={event => {
          if (!drag.current) return
          const dx = event.clientX - drag.current.x
          const dy = event.clientY - drag.current.y
          drag.current = { x: event.clientX, y: event.clientY, distance: drag.current.distance + Math.abs(dx) + Math.abs(dy) }
          move(-dx * .15 / zoom, dy * .15 / zoom)
        }}
        onPointerCancel={() => { drag.current = undefined }}
        onPointerUp={event => {
          const click = drag.current && drag.current.distance < 6
          drag.current = undefined
          if (!click) return
          const bounds = event.currentTarget.getBoundingClientRect()
          const hit = positions.find(({ star, x, y }) => unlocked.has(star.id) &&
            Math.hypot(x - event.clientX + bounds.left, y - event.clientY + bounds.top) < 23)
          if (hit) onSelect(hit.star)
        }} />
      <div className="tess-sky-heading">
        <strong>{target.sector}</strong>
        <span>Cámara {camera + 1} · {number(zoom, 1)}×</span>
      </div>
      <div className="tess-fov" aria-hidden="true" style={{ width: Math.min(size.width, size.height) }} />
      <div className={'tess-reticle' + (locked ? ' locked' : '')} aria-hidden="true"><Crosshair size={48} strokeWidth={1} /></div>
      <div className="tess-sky-caption">
        <span aria-live="polite">{locked ? 'Objetivo centrado' : 'Apuntado libre'}</span>
        <span>AR {number(aim.longitude, 1)}° · Dec {number(aim.latitude, 1)}° · {number(2 * Math.atan(Math.tan(Math.PI / 15) / zoom) * 180 / Math.PI, 1)}°</span>
      </div>
    </div>
    <div className="tess-toolbar">
      <div className="tess-inline" role="group" aria-label="Cámaras">
        {cameraOffsets.map((_, index) => <button key={index} className="button compact" type="button"
          aria-pressed={camera === index} aria-label={'Cámara ' + (index + 1)} onClick={() => setCamera(index)}>C{index + 1}</button>)}
      </div>
      <div className="tess-inline" role="group" aria-label="Apuntado y zoom">
        {([
          [ArrowLeft, 'Girar a la izquierda', -6, 0], [ArrowUp, 'Girar hacia arriba', 0, 6],
          [ArrowDown, 'Girar hacia abajo', 0, -6], [ArrowRight, 'Girar a la derecha', 6, 0],
        ] as const).map(([Icon, label, x, y]) => <button key={label} className="button icon-button compact"
          type="button" aria-label={label} title={label} onClick={() => move(x / zoom, y / zoom)}><Icon size={15} /></button>)}
        <button className="button icon-button compact" type="button" aria-label="Alejar" disabled={zoom <= 1} onClick={() => changeZoom(-.5)}><Minus size={16} /></button>
        <button className="button icon-button compact" type="button" aria-label="Acercar" disabled={zoom >= 3} onClick={() => changeZoom(.5)}><Plus size={16} /></button>
      </div>
      <button type="button" className="button tess-primary compact" onClick={focusTarget}><Crosshair size={16} /> Centrar {target.name}</button>
    </div>
  </section>
}
