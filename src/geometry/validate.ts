import type { Poly, Pt } from '../types'
import { dist, polygonArea } from './poly'

export interface SegmentHit {
  i: number
  j: number
  pt: Pt
}

/** 线段相交检测（返回交点），容差处理端点接触 */
export function segIntersect(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Pt | null {
  const d1x = a2.x - a1.x
  const d1y = a2.y - a1.y
  const d2x = b2.x - b1.x
  const d2y = b2.y - b1.y
  const den = d1x * d2y - d1y * d2x
  if (Math.abs(den) < 1e-9) return null
  const qx = b1.x - a1.x
  const qy = b1.y - a1.y
  const t = (qx * d2y - qy * d2x) / den
  const u = (qx * d1y - qy * d1x) / den
  const e = 1e-9
  if (t >= -e && t <= 1 + e && u >= -e && u <= 1 + e) {
    return { x: a1.x + t * d1x, y: a1.y + t * d1y }
  }
  return null
}

/** 统计闭合多边形自交次数（跳过共享顶点的相邻边） */
export function countSelfIntersections(poly: Poly): number {
  const n = poly.length
  if (n < 4) return 0
  let count = 0
  for (let i = 0; i < n; i++) {
    const a1 = poly[i]
    const a2 = poly[(i + 1) % n]
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      const b1 = poly[j]
      const b2 = poly[(j + 1) % n]
      if (segIntersect(a1, a2, b1, b2)) count++
    }
  }
  return count
}

function findFirstCrossingClosed(ring: Poly): SegmentHit | null {
  const n = ring.length
  if (n < 4) return null
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      const pt = segIntersect(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])
      if (pt) return { i, j, pt }
    }
  }
  return null
}

/**
 * 把可能自交的手绘闭合环拆解成简单多边形：
 * 每遇到一处交叉，取交叉点两侧中面积更大的一侧。
 * 迭代至多 8 轮，仍混乱则返回 null（调用方要求重画）。
 */
export function reduceToSimplePolygon(path: Poly): Poly | null {
  let ring: Poly = path.map((p) => ({ ...p }))
  while (ring.length > 1 && dist(ring[0], ring[ring.length - 1]) < 1e-6) ring.pop()
  for (let guard = 0; guard < 8; guard++) {
    if (ring.length < 3) return null
    const hit = findFirstCrossingClosed(ring)
    if (!hit) return ring
    const A: Poly = [hit.pt, ...ring.slice(hit.i + 1, hit.j + 1)]
    const B: Poly = [hit.pt, ...ring.slice(hit.j + 1), ...ring.slice(0, hit.i + 1)]
    if (A.length < 3 || B.length < 3) return null
    ring = polygonArea(A) >= polygonArea(B) ? A : B
  }
  return null
}
