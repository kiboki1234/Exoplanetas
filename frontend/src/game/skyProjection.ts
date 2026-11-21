export type Vector = [number, number, number]
export type Pointing = { longitude: number; latitude: number }

const radians = Math.PI / 180

export function direction(longitude: number, latitude: number): Vector {
  const lon = longitude * radians
  const lat = latitude * radians
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]
}

export function pointAt(longitude: number, latitude: number): Pointing {
  return { longitude: (longitude % 360 + 360) % 360, latitude: Math.max(-89, Math.min(89, latitude)) }
}

const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

export function projector(point: Pointing, width: number, height: number, zoom: number) {
  const forward = direction(point.longitude, point.latitude)
  const right = direction(point.longitude + 90, 0)
  const up = direction(point.longitude + 180, 90 - point.latitude)
  const focalLength = Math.min(width, height) * zoom / (2 * Math.tan(12 * radians))
  return (vector: Vector) => {
    const depth = dot(forward, vector)
    if (depth <= 0.08) return undefined
    return { x: width / 2 + focalLength * dot(right, vector) / depth, y: height / 2 - focalLength * dot(up, vector) / depth }
  }
}

// Deterministic directions keep the same sky on every visit.
let seed = 149263
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 4294967296
}
export const skyStars = Array.from({ length: 4400 }, (_, index) => {
  const longitude = random() * 360
  const latitude = index < 2400 ? Math.asin(2 * random() - 1) / radians
    : 34 * Math.sin((longitude - 45) * radians) + (random() + random() + random() - 1.5) * 24
  const light = random()
  return { direction: direction(longitude, latitude), size: index < 2400 ? .42 + light ** 5 * 1.85 : .32 + light * .56,
    color: ['#d6edff', '#a0b5fa', '#f2cead', '#fff3e0'][Math.floor(random() * 4)],
    alpha: .14 + light ** 1.8 * .76 }
})
