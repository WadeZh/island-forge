import type { Poly } from '../types'
import { pointInPolygon, polygonCentroid } from '../geometry/poly'

/**
 * 岛屿之歌：同一座岛永远唱同一首歌。
 * 从质心向 16 个均匀方向发射射线测轮廓半径，归一化后映射到
 * C 宫五声音阶（C D E G A）跨两个八度。
 */

export const MELODY_STEPS = 16
const SCALE_HZ = [262, 294, 330, 392, 440, 523, 587, 659] // C4 D4 E4 G4 A4 C5 D5 E5

/** 从质心沿方向 θ 到轮廓边界的距离（二分查找） */
function rayRadius(poly: Poly, cx: number, cy: number, dx: number, dy: number, maxR: number): number {
  let lo = 0
  let hi = maxR
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2
    if (pointInPolygon({ x: cx + dx * mid, y: cy + dy * mid }, poly)) lo = mid
    else hi = mid
  }
  return lo
}

/** 推导 16 音旋律（半径大 → 音高高） */
export function deriveMelody(outline: Poly): number[] {
  const c = polygonCentroid(outline)
  let maxR = 1e-6
  for (const p of outline) maxR = Math.max(maxR, Math.hypot(p.x - c.x, p.y - c.y))
  const radii: number[] = []
  for (let k = 0; k < MELODY_STEPS; k++) {
    const a = (k / MELODY_STEPS) * Math.PI * 2 - Math.PI / 2
    radii.push(rayRadius(outline, c.x, c.y, Math.cos(a), Math.sin(a), maxR * 1.5) / maxR)
  }
  const lo = Math.min(...radii)
  const hi = Math.max(...radii)
  const span = Math.max(1e-6, hi - lo)
  return radii.map((r) => {
    const t = (r - lo) / span
    return SCALE_HZ[Math.min(SCALE_HZ.length - 1, Math.floor(t * SCALE_HZ.length))]
  })
}

export function melodyHash(melody: number[]): number {
  let h = 0x811c9dc5
  for (const f of melody) h = (Math.imul(h ^ Math.round(f), 0x01000193) ^ (h >>> 7)) >>> 0
  return h >>> 0
}
