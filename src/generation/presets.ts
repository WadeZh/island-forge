import type { Poly, Pt } from '../types'
import { polygonBBox } from '../geometry/poly'
import { R } from './rng'
import { starShape } from './star'

/** 参数化示例轮廓，供「试试示例岛」与首页演示使用 */

export type PresetKind = 'blob' | 'heart' | 'long' | 'crescent' | 'star'

function fitToCanvas(pts: Poly, cx: number, cy: number, maxSpan: number): Poly {
  const bb = polygonBBox(pts)
  const w = bb.maxX - bb.minX
  const h = bb.maxY - bb.minY
  const k = maxSpan / Math.max(w, h)
  return pts.map((p) => ({
    x: cx + (p.x - (bb.minX + w / 2)) * k,
    y: cy + (p.y - (bb.minY + h / 2)) * k
  }))
}

export function presetOutline(kind: PresetKind, seed: number, cx = 600, cy = 400): Poly {
  const rng = new R(seed)
  const pts: Poly = []
  const N = 72
  const jit = () => rng.range(-0.04, 0.04)
  if (kind === 'blob') {
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2
      const r = 1 + 0.16 * Math.sin(3 * t + 1.2) + 0.1 * Math.sin(7 * t) + jit()
      pts.push({ x: Math.cos(t) * r, y: Math.sin(t) * r * 0.92 })
    }
  } else if (kind === 'heart') {
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2
      const x = 16 * Math.pow(Math.sin(t), 3)
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
      pts.push({ x: x + jit() * 16, y: y + jit() * 16 })
    }
  } else if (kind === 'long') {
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2
      const r = 1 + 0.12 * Math.sin(4 * t + 0.5) + jit()
      pts.push({ x: Math.cos(t) * r * 2.1, y: Math.sin(t) * r * 0.62 })
    }
  } else if (kind === 'star') {
    const base = starShape(6, 0.56)
    for (const p of base) pts.push({ x: p.x + jit() * 6, y: p.y + jit() * 6 })
  } else {
    // 月牙：外弧 + 内弧
    for (let i = 0; i <= N / 2; i++) {
      const t = -0.4 + (i / (N / 2)) * (Math.PI * 1.5)
      pts.push({ x: Math.cos(t), y: Math.sin(t) })
    }
    for (let i = N / 2; i >= 0; i--) {
      const t = -0.4 + (i / (N / 2)) * (Math.PI * 1.5)
      const ox = 0.32
      const oy = -0.18
      pts.push({ x: Math.cos(t) * 0.82 + ox, y: Math.sin(t) * 0.82 + oy })
    }
  }
  return fitToCanvas(pts, cx, cy, kind === 'long' ? 620 : kind === 'star' ? 400 : 430)
}
