import type { Poly, Pt } from '../types'
import { dist } from './poly'

/** 闭合多边形 Chaikin 切角平滑 */
export function chaikinClosed(poly: Poly, iterations = 1): Poly {
  let cur: Poly = poly.map((p) => ({ ...p }))
  while (cur.length > 1 && dist(cur[0], cur[cur.length - 1]) < 1e-6) cur.pop()
  for (let it = 0; it < iterations; it++) {
    const out: Pt[] = []
    const n = cur.length
    for (let i = 0; i < n; i++) {
      const a = cur[i]
      const b = cur[(i + 1) % n]
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 })
      out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 })
    }
    cur = out
  }
  return cur
}
