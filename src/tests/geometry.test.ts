import { describe, expect, it } from 'vitest'
import type { Poly } from '../types'
import { polygonArea, polygonBBox, polygonCentroid, polygonPerimeter, pointInPolygon, distanceToPolygonEdge, resampleClosed } from '../geometry/poly'
import { dedupePoints, rdp } from '../geometry/simplify'
import { chaikinClosed } from '../geometry/smooth'
import { countSelfIntersections, reduceToSimplePolygon } from '../geometry/validate'
import { MIN_AREA, validateOutline } from '../geometry/outline'
import { circlePts, ellipsePts } from './helpers'

describe('多边形度量', () => {
  it('正方形面积正确', () => {
    const sq: Poly = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 }
    ]
    expect(polygonArea(sq)).toBeCloseTo(16, 6)
  })

  it('质心与周长', () => {
    const sq: Poly = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 }
    ]
    const c = polygonCentroid(sq)
    expect(c.x).toBeCloseTo(2, 5)
    expect(c.y).toBeCloseTo(2, 5)
    expect(polygonPerimeter(sq)).toBeCloseTo(16, 6)
  })

  it('点在多边形内判定', () => {
    const sq: Poly = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ]
    expect(pointInPolygon({ x: 5, y: 5 }, sq)).toBe(true)
    expect(pointInPolygon({ x: 15, y: 5 }, sq)).toBe(false)
    expect(pointInPolygon({ x: -1, y: -1 }, sq)).toBe(false)
    expect(pointInPolygon({ x: 5, y: 9.9 }, sq)).toBe(true)
  })

  it('点到边缘距离', () => {
    const sq: Poly = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ]
    expect(distanceToPolygonEdge({ x: 5, y: 5 }, sq)).toBeCloseTo(5, 6)
    expect(distanceToPolygonEdge({ x: 12, y: 5 }, sq)).toBeCloseTo(2, 6)
  })
})

describe('路径简化与平滑', () => {
  it('RDP 去掉共线点保留端点', () => {
    const line: Poly = []
    for (let i = 0; i <= 20; i++) line.push({ x: i * 5, y: i % 2 === 0 ? 0 : 0.01 })
    const out = rdp(line, 2)
    expect(out.length).toBe(2)
    expect(out[0].x).toBe(0)
    expect(out[out.length - 1].x).toBe(100)
  })

  it('RDP 保留明显拐角', () => {
    const pts: Poly = [
      { x: 0, y: 0 },
      { x: 50, y: 3 },
      { x: 100, y: 0 },
      { x: 100, y: 80 }
    ]
    const out = rdp(pts, 2)
    expect(out.length).toBeGreaterThanOrEqual(3)
  })

  it('去重过近点', () => {
    const pts: Poly = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 1, y: 0 },
      { x: 10, y: 0 }
    ]
    expect(dedupePoints(pts, 3).length).toBe(2)
  })

  it('Chaikin 平滑闭合路径：点数翻倍、面积缩小但不塌陷、质心不变', () => {
    const circ = circlePts(0, 0, 100, 40)
    const area0 = polygonArea(circ)
    const c0 = polygonCentroid(circ)
    const out = chaikinClosed(circ, 2)
    expect(out.length).toBe(40 * 4)
    const area1 = polygonArea(out)
    expect(area1).toBeGreaterThan(area0 * 0.7)
    expect(area1).toBeLessThan(area0)
    const c1 = polygonCentroid(out)
    expect(c1.x).toBeCloseTo(c0.x, 3)
    expect(c1.y).toBeCloseTo(c0.y, 3)
  })

  it('Chaikin 不会把狭长形变成圆岛', () => {
    const sliver = ellipsePts(0, 0, 300, 40, 48)
    const out = chaikinClosed(sliver, 2)
    const bb0 = polygonBBox(sliver)
    const bb1 = polygonBBox(out)
    const ratio0 = (bb0.maxX - bb0.minX) / (bb0.maxY - bb0.minY)
    const ratio1 = (bb1.maxX - bb1.minX) / (bb1.maxY - bb1.minY)
    expect(ratio1).toBeGreaterThan(ratio0 * 0.7)
    expect(ratio1).toBeGreaterThan(3)
  })
})

describe('自交处理', () => {
  it('简单多边形自交数为 0', () => {
    const sq: Poly = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ]
    expect(countSelfIntersections(sq)).toBe(0)
  })

  it('蝴蝶结形检测到自交', () => {
    const bow: Poly = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 10 }
    ]
    expect(countSelfIntersections(bow)).toBeGreaterThan(0)
  })

  it('8 字路径能拆解为不自交的较大环', () => {
    // 左右两个圆环组成的 8 字
    const left = circlePts(-40, 0, 30, 24).slice(0, -1)
    const right = circlePts(40, 0, 30, 24).slice(0, -1)
    const fig8: Poly = [...left, ...right]
    expect(countSelfIntersections(fig8)).toBeGreaterThan(0)
    const reduced = reduceToSimplePolygon(fig8)
    expect(reduced).not.toBeNull()
    expect(countSelfIntersections(reduced as Poly)).toBe(0)
    const area = polygonArea(reduced as Poly)
    const loopArea = Math.PI * 30 * 30
    expect(area).toBeGreaterThan(loopArea * 0.5)
    expect(area).toBeLessThan(loopArea * 2.2)
  })

  it('带小回头勾的路径能去掉小环', () => {
    const pts: Poly = [
      { x: 0, y: 0 },
      { x: 60, y: -20 },
      { x: 120, y: 0 },
      { x: 130, y: 30 },
      { x: 100, y: 22 },
      { x: 118, y: 40 },
      { x: 100, y: 70 },
      { x: 40, y: 60 }
    ]
    const reduced = reduceToSimplePolygon(pts)
    expect(reduced).not.toBeNull()
    expect(countSelfIntersections(reduced as Poly)).toBe(0)
  })
})

describe('轮廓校验', () => {
  it('正常圆形轮廓通过', () => {
    const r = validateOutline(circlePts(600, 400, 120, 70))
    expect(r.ok).toBe(true)
    expect(r.poly).toBeDefined()
  })

  it('面积过小被拒绝', () => {
    const r = validateOutline(circlePts(600, 400, 20, 30))
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('太小')
  })

  it('过窄的细长条被拒绝', () => {
    const pts: Poly = []
    for (let i = 0; i <= 30; i++) pts.push({ x: 100 + i * 20, y: 400 + Math.sin(i) * 2 })
    for (let i = 30; i >= 0; i--) pts.push({ x: 100 + i * 20, y: 414 + Math.sin(i) * 2 })
    const r = validateOutline(pts)
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('窄')
  })

  it('点数过少被拒绝', () => {
    const r = validateOutline([
      { x: 600, y: 400 },
      { x: 610, y: 402 },
      { x: 615, y: 405 }
    ])
    expect(r.ok).toBe(false)
  })

  it('椭圆、狭长岛、不规则形状都能通过', () => {
    expect(validateOutline(ellipsePts(600, 400, 200, 90, 60)).ok).toBe(true)
    const wobble: Poly = []
    for (let i = 0; i < 60; i++) {
      const t = (i / 60) * Math.PI * 2
      const r = 130 + 35 * Math.sin(3 * t) + 18 * Math.sin(7 * t)
      wobble.push({ x: 600 + Math.cos(t) * r, y: 400 + Math.sin(t) * r })
    }
    wobble.push({ ...wobble[0] })
    const res = validateOutline(wobble)
    expect(res.ok).toBe(true)
  })

  it('含重复点的轨迹仍可通过（去重生效）', () => {
    const circ = circlePts(600, 400, 110, 60)
    const noisy: Poly = []
    for (const p of circ) {
      noisy.push(p)
      noisy.push({ x: p.x + 0.3, y: p.y + 0.2 })
    }
    expect(validateOutline(noisy).ok).toBe(true)
  })

  it('自交的 8 字轨迹要么修复要么明确拒绝，不会崩溃', () => {
    const left = circlePts(500, 400, 90, 24).slice(0, -1)
    const right = circlePts(700, 400, 90, 24).slice(0, -1)
    const fig8: Poly = [...left, ...right]
    const r = validateOutline(fig8)
    if (r.ok) {
      expect(countSelfIntersections(r.poly as Poly)).toBe(0)
      expect(polygonArea(r.poly as Poly)).toBeGreaterThan(MIN_AREA)
    } else {
      expect(r.reason).toBeTruthy()
    }
  })

  it('最小面积常量符合预期', () => {
    expect(MIN_AREA).toBe(4000)
  })

  it('重采样海岸点数量合理', () => {
    const circ = circlePts(600, 400, 150, 60)
    const coast = resampleClosed(circ, 26)
    expect(coast.length).toBeGreaterThan(30)
    expect(coast.length).toBeLessThan(100)
  })
})
