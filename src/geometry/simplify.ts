import type { Poly, Pt } from '../types'
import { pointSegmentDist } from './poly'

/** 去除过近的重复点 */
export function dedupePoints(points: Poly, minDist: number): Poly {
  const out: Pt[] = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= minDist) out.push({ x: p.x, y: p.y })
  }
  return out
}

/** Ramer–Douglas–Peucker 简化（开路径） */
export function rdp(points: Poly, eps: number): Poly {
  const n = points.length
  if (n < 3) return points.map((p) => ({ ...p }))
  const keep = new Uint8Array(n)
  keep[0] = 1
  keep[n - 1] = 1
  const stack: Array<[number, number]> = [[0, n - 1]]
  while (stack.length) {
    const [s, e] = stack.pop() as [number, number]
    if (e - s < 2) continue
    const a = points[s]
    const b = points[e]
    let maxD = -1
    let idx = -1
    for (let i = s + 1; i < e; i++) {
      const d = pointSegmentDist(points[i], a, b)
      if (d > maxD) {
        maxD = d
        idx = i
      }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = 1
      stack.push([s, idx], [idx, e])
    }
  }
  const out: Poly = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push({ x: points[i].x, y: points[i].y })
  return out
}
