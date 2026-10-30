import type { Poly } from '../types'
import { dist, polygonArea, polygonBBox } from './poly'
import { dedupePoints, rdp } from './simplify'
import { chaikinClosed } from './smooth'
import { reduceToSimplePolygon } from './validate'

export interface OutlineResult {
  ok: boolean
  reason?: string
  poly?: Poly
}

/** 逻辑画布 1200×800 下允许的最小岛屿面积 */
export const MIN_AREA = 4000

/**
 * 手绘轨迹 → 合法闭合多边形。
 * 去重 → RDP 简化 → 闭环自交拆解 → Chaikin 平滑 → 面积/宽度校验。
 */
export function validateOutline(rawPoints: Poly): OutlineResult {
  let pts = dedupePoints(rawPoints, 3)
  if (pts.length < 6) {
    return { ok: false, reason: '画得太短啦，画一条更长一点的线' }
  }
  pts = rdp(pts, 2.5)
  if (pts.length < 3) {
    return { ok: false, reason: '画的线太短了，画一个更大的轮廓吧' }
  }
  // 首尾几乎重合时去掉重复点，闭环交给下游按环处理
  while (pts.length > 1 && dist(pts[0], pts[pts.length - 1]) < 3) pts.pop()
  if (pts.length < 3) {
    return { ok: false, reason: '画的线太短了，画一个更大的轮廓吧' }
  }

  const reduced = reduceToSimplePolygon(pts)
  if (!reduced || reduced.length < 3) {
    return { ok: false, reason: '线条绕得太乱啦，重新画一个简单点的轮廓试试' }
  }

  const passes = reduced.length < 50 ? 2 : 1
  const poly = chaikinClosed(reduced, passes)

  const area = polygonArea(poly)
  if (area < MIN_AREA) {
    return { ok: false, reason: '岛太小啦，画大一点才有地方盖房子' }
  }
  const bb = polygonBBox(poly)
  const minDim = Math.min(bb.maxX - bb.minX, bb.maxY - bb.minY)
  if (minDim < 60) {
    return { ok: false, reason: '这条岛太窄了，试着画得开阔一些' }
  }
  return { ok: true, poly }
}
