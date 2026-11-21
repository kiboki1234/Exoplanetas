import { useEffect, useRef, useState } from 'react'
import type { Data, Layout, Legend, PlotlyHTMLElement, PlotRelayoutEvent, PlotSelectionEvent } from 'plotly.js'

const plotly = () => import('plotly.js-gl2d-dist-min').then(module => module.default)

export type Limits = [number, number]

type PlotProps = {
  data: Data[]
  label: string
  x: string
  y: string
  revision?: string
  range?: Limits
  layout?: Partial<Layout>
  onRange?: (range?: Limits) => void
  onSelection?: (range?: Limits) => void
  onPoint?: (index: number) => void
}

const legend: Partial<Legend> = { orientation: 'h', x: 0, y: 1.12 }
const axis = { gridcolor: '#24324c', zerolinecolor: '#344762', color: '#a8b7d2', automargin: true }
const config = {
  displaylogo: false,
  showTips: false,
  scrollZoom: true,
  modeBarButtonsToRemove: ['toImage', 'lasso2d', 'autoScale2d'] as const,
  locale: 'es',
  locales: {
    es: { dictionary: {
      'Download plot as a png': 'Descargar gráfico', Zoom: 'Zoom', Pan: 'Desplazar', 'Box Select': 'Seleccionar intervalo',
      'Reset axes': 'Restablecer ejes', 'Zoom in': 'Acercar', 'Zoom out': 'Alejar',
    } },
  },
}

export function Plot({ data, label, x, y, revision = 'fixed', range, layout, onRange, onSelection, onPoint }: PlotProps) {
  const host = useRef<HTMLDivElement>(null)
  const ready = useRef(false)
  const [error, setError] = useState(false)
  const callbacks = useRef({ onRange, onSelection, onPoint })

  useEffect(() => { callbacks.current = { onRange, onSelection, onPoint } }, [onRange, onSelection, onPoint])

  useEffect(() => {
    const node = host.current
    if (!node) return
    let active = true
    const observer = new ResizeObserver(entries => {
      if (entries[0].contentRect.width > 0 && ready.current) {
        void plotly().then(library => { if (active && node.clientWidth > 0) void library.Plots.resize(node) })
      }
    })
    observer.observe(node)
    return () => {
      active = false
      observer.disconnect()
      if (ready.current) void plotly().then(library => library.purge(node))
      ready.current = false
    }
  }, [])

  useEffect(() => {
    const node = host.current
    if (!node) return
    let active = true
    void plotly().then(async library => {
      if (!active) return
      const graph = await library.react(node, data, {
        font: { family: 'Space Grotesk Variable, system-ui, sans-serif', size: 14, color: '#c4d1e8' },
        margin: { l: 66, r: 24, t: 37, b: 50 }, legend, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
        hovermode: 'closest', dragmode: 'zoom', uirevision: revision,
        ...layout,
        xaxis: { ...axis, title: { text: x }, ...layout?.xaxis, ...(range ? { range, autorange: false } : {}) },
        yaxis: { ...axis, title: { text: y }, ...layout?.yaxis },
      }, { ...config, modeBarButtonsToRemove: [...config.modeBarButtonsToRemove] }) as PlotlyHTMLElement
      if (!graph || !node.isConnected || ready.current) return
      ready.current = true
      graph.on('plotly_relayout', (event: PlotRelayoutEvent) => {
        const changes = event as Record<string, unknown>
        if (changes['xaxis.autorange']) callbacks.current.onRange?.()
        if (typeof changes['xaxis.range[0]'] === 'number' && typeof changes['xaxis.range[1]'] === 'number') {
          callbacks.current.onRange?.([changes['xaxis.range[0]'], changes['xaxis.range[1]']])
        }
      })
      graph.on('plotly_selected', (event: PlotSelectionEvent | undefined) => {
        callbacks.current.onSelection?.(event?.range?.x as Limits | undefined)
      })
      graph.on('plotly_click', event => {
        const point = event.points[0]
        if (point?.curveNumber === 1) callbacks.current.onPoint?.(point.pointNumber)
      })
    }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [data, x, y, revision, range, layout])

  return <div className="plot-wrap">
    <div className="plot" ref={host} aria-label={label} role="img" />
    {error ? <p className="error" role="alert">No se pudo dibujar el gráfico científico.</p> : null}
  </div>
}
