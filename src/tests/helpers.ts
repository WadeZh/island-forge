import type { Poly } from '../types'

export function circlePts(cx: number, cy: number, r: number, n = 60, jitter = 0): Poly {
  const pts: Poly = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const rr = r * (1 + Math.sin(i * 12.9898) * jitter)
    pts.push({ x: cx + Math.cos(t) * rr, y: cy + Math.sin(t) * rr })
  }
  pts.push({ ...pts[0] })
  return pts
}

export function ellipsePts(cx: number, cy: number, rx: number, ry: number, n = 60): Poly {
  const pts: Poly = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    pts.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry })
  }
  pts.push({ ...pts[0] })
  return pts
}

export function heartPts(cx: number, cy: number, k = 10): Poly {
  // 延迟导入会造成循环，这里直接内联参数方程
  const pts: Poly = []
  for (let i = 0; i < 80; i++) {
    const t = (i / 80) * Math.PI * 2
    const x = 16 * Math.pow(Math.sin(t), 3)
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
    pts.push({ x: cx + x * k, y: cy + y * k })
  }
  pts.push({ ...pts[0] })
  return pts
}
