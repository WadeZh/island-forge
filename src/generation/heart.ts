import type { Poly, Pt } from '../types'
import { polygonArea, polygonBBox } from '../geometry/poly'

/** 经典心形参数曲线（屏幕坐标系，y 向下） */
export function heartShape(samples = 72): Poly {
  const pts: Poly = []
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * Math.PI * 2
    const x = 16 * Math.pow(Math.sin(t), 3)
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
    pts.push({ x, y })
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

const CANONICAL_HEART = normalizeToUnit(heartShape())

const GRID = 72
const HALF = 0.62

function rasterize(poly: Poly): Uint8Array {
  const mask = new Uint8Array(GRID * GRID)
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const p: Pt = {
        x: -HALF + ((gx + 0.5) / GRID) * HALF * 2,
        y: -HALF + ((gy + 0.5) / GRID) * HALF * 2
      }
      if (pointInMask(p, poly)) mask[gy * GRID + gx] = 1
    }
  }
  return mask
}

function pointInMask(p: Pt, poly: Poly): boolean {
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

/** 归一化后的宽高比（接近 1 才可能是心形） */
export function aspectRatio(poly: Poly): number {
  const bb = polygonBBox(poly)
  const w = bb.maxX - bb.minX
  const h = bb.maxY - bb.minY
  return Math.min(w, h) / Math.max(w, h)
}

/** 用户轮廓与标准心形的 IoU 相似度（0~1） */
export function heartScore(poly: Poly): number {
  if (polygonArea(poly) < 1000) return 0
  const user = rasterize(normalizeToUnit(poly))
  const canon = rasterize(CANONICAL_HEART)
  let inter = 0
  let union = 0
  for (let i = 0; i < user.length; i++) {
    if (user[i] && canon[i]) inter++
    if (user[i] || canon[i]) union++
  }
  return union === 0 ? 0 : inter / union
}

export const HEART_THRESHOLD = 0.72

/** 心形彩蛋判定：IoU 达标且形状接近方形比例 */
export function isHeartShape(poly: Poly): boolean {
  return heartScore(poly) >= HEART_THRESHOLD && aspectRatio(poly) >= 0.6 && aspectRatio(poly) <= 1.45
}
