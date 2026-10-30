import type { BBox, Poly, Pt } from '../types'

export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y)

export function pointSegmentDist(p: Pt, a: Pt, b: Pt): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby))
}

/** 鞋带公式面积（非负） */
export function polygonArea(poly: Poly): number {
  let s = 0
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}

export function polygonPerimeter(poly: Poly): number {
  let s = 0
  const n = poly.length
  for (let i = 0; i < n; i++) s += dist(poly[i], poly[(i + 1) % n])
  return s
}

export function polygonCentroid(poly: Poly): Pt {
  let s = 0
  let cx = 0
  let cy = 0
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    const cross = a.x * b.y - b.x * a.y
    s += cross
    cx += (a.x + b.x) * cross
    cy += (a.y + b.y) * cross
  }
  if (Math.abs(s) < 1e-6) {
    const bb = polygonBBox(poly)
    return { x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2 }
  }
  return { x: cx / (3 * s), y: cy / (3 * s) }
}

export function polygonBBox(poly: Poly): BBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of poly) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

/** 射线法：点是否在多边形内 */
export function pointInPolygon(p: Pt, poly: Poly): boolean {
  let inside = false
  const n = poly.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

/** 点到多边形边缘的最小距离 */
export function distanceToPolygonEdge(p: Pt, poly: Poly): number {
  let min = Infinity
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const d = pointSegmentDist(p, poly[i], poly[(i + 1) % n])
    if (d < min) min = d
  }
  return min
}

export function translatePoly(poly: Poly, dx: number, dy: number): Poly {
  return poly.map((p) => ({ x: p.x + dx, y: p.y + dy }))
}

export function resampleClosed(poly: Poly, step: number): Poly {
  const out: Poly = []
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    const d = dist(a, b)
    const k = Math.max(1, Math.round(d / step))
    for (let j = 0; j < k; j++) {
      const t = j / k
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  return out
}
