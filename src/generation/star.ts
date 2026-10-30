import type { Poly, Pt } from '../types'
import { polygonArea, polygonBBox } from '../geometry/poly'

/** 圆角五角星轮廓（供 IoU 对比与示例用）：10 顶点、内半径比 0.58 */
export function starShape(edgeSamples = 8, innerRatio = 0.45): Poly {
  const pts: Poly = []
  const verts: Pt[] = []
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5
    const r = k % 2 === 0 ? 1 : innerRatio
    verts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r })
  }
  for (let k = 0; k < 10; k++) {
    const a = verts[k]
    const b = verts[(k + 1) % 10]
    for (let j = 0; j < edgeSamples; j++) {
      const t = j / edgeSamples
      pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  return pts
}

function normalizeToUnit(poly: Poly): Poly {
  const bb = polygonBBox(poly)
  const w = bb.maxX - bb.minX
  const h = bb.maxY - bb.minY
  const k = 1 / Math.max(w, h, 1e-6)
  const cx = (bb.minX + bb.maxX) / 2
  const cy = (bb.minY + bb.maxY) / 2
  return poly.map((p) => ({ x: (p.x - cx) * k, y: (p.y - cy) * k }))
}

const CANONICAL_STAR = normalizeToUnit(starShape())

const GRID = 72
const HALF = 0.62

function pointInPoly(p: Pt, poly: Poly): boolean {
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

function rasterize(poly: Poly): Uint8Array {
  const mask = new Uint8Array(GRID * GRID)
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const p: Pt = {
        x: -HALF + ((gx + 0.5) / GRID) * HALF * 2,
        y: -HALF + ((gy + 0.5) / GRID) * HALF * 2
      }
      if (pointInPoly(p, poly)) mask[gy * GRID + gx] = 1
    }
  }
  return mask
}

export function aspectRatioStar(poly: Poly): number {
  const bb = polygonBBox(poly)
  const w = bb.maxX - bb.minX
  const h = bb.maxY - bb.minY
  return Math.min(w, h) / Math.max(w, h)
}

/** 用户轮廓与标准五角星的 IoU 相似度（0~1） */
export function starScore(poly: Poly): number {
  if (polygonArea(poly) < 1000) return 0
  const user = rasterize(normalizeToUnit(poly))
  const canon = rasterize(CANONICAL_STAR)
  let inter = 0
  let union = 0
  for (let i = 0; i < user.length; i++) {
    if (user[i] && canon[i]) inter++
    if (user[i] || canon[i]) union++
  }
  return union === 0 ? 0 : inter / union
}

export const STAR_THRESHOLD = 0.62

/** 星形彩蛋判定：IoU 达标且接近方形比例 */
export function isStarShape(poly: Poly): boolean {
  const ar = aspectRatioStar(poly)
  return starScore(poly) >= STAR_THRESHOLD && ar >= 0.78 && ar <= 1.28
}
