import { describe, expect, it } from 'vitest'
import type { IslandEntity, Poly } from '../types'
import { distanceToPolygonEdge, pointInPolygon, polygonArea, polygonCentroid } from '../geometry/poly'
import { generateLayout, MARGINS } from '../generation/layout'
import { mulberry32, hashPoints, R } from '../generation/rng'
import { genIslandName, genFeatureLine } from '../generation/names'
import { aspectRatio, heartScore, isHeartShape, HEART_THRESHOLD } from '../generation/heart'
import { presetOutline } from '../generation/presets'
import { circlePts, ellipsePts, heartPts } from './helpers'

function makeOutline(poly: Poly) {
  return { outline: poly, area: polygonArea(poly), centroid: polygonCentroid(poly) }
}

describe('随机种子', () => {
  it('mulberry32 可复现', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 20; i++) expect(a()).toBe(b())
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })

  it('相同点集得到相同指纹，顺序不同指纹不同', () => {
    const p1 = [
      { x: 1.23, y: 4.56 },
      { x: 7.89, y: 0.12 }
    ]
    const p2 = [
      { x: 1.231, y: 4.561 },
      { x: 7.891, y: 0.121 }
    ]
    expect(hashPoints(p1)).toBe(hashPoints(p2))
    expect(hashPoints(p1)).not.toBe(hashPoints([p1[1], p1[0]]))
  })

  it('R 工具类行为正确', () => {
    const r = new R(7)
    for (let i = 0; i < 50; i++) {
      const v = r.range(10, 20)
      expect(v).toBeGreaterThanOrEqual(10)
      expect(v).toBeLessThan(20)
    }
  })
})

describe('布局生成', () => {
  const shapes: Array<[string, Poly]> = [
    ['圆形', circlePts(600, 400, 170, 64)],
    ['椭圆狭长', ellipsePts(600, 400, 280, 95, 64)],
    ['心形', heartPts(600, 400, 11)],
    ['不规则', presetOutline('blob', 123, 600, 400)]
  ]

  shapes.forEach(([label, outline]) => {
    it(`${label}：物件全部在岛内、满足边缘距离且互不重叠`, () => {
      const { outline: ol, area, centroid } = makeOutline(outline)
      const res = generateLayout({ outline: ol, area, centroid, decorSeed: 42, heart: false })
      expect(res.counts.trees).toBeGreaterThanOrEqual(3)
      expect(res.counts.houses).toBeGreaterThanOrEqual(1)
      expect(res.counts.houses).toBeLessThanOrEqual(3)
      expect(res.counts.trees).toBeLessThanOrEqual(30)
      expect(res.counts.rocks).toBeGreaterThanOrEqual(3)

      for (const e of res.entities) {
        const p = { x: e.x, y: e.y }
        if (e.kind === 'boat') {
          expect(pointInPolygon(p, ol)).toBe(false)
          const d = distanceToPolygonEdge(p, ol)
          expect(d).toBeGreaterThanOrEqual(MARGINS.boat - 0.01)
        } else if (e.kind === 'dock') {
          // 码头锚在海岸线外侧一点
          expect(distanceToPolygonEdge(p, ol)).toBeGreaterThanOrEqual(2)
        } else if (e.kind === 'villager') {
          // 散步居民在岛内；钓鱼翁站在码头外海侧
          if (e.role === 'walker') expect(pointInPolygon(p, ol)).toBe(true)
        } else {
          expect(pointInPolygon(p, ol)).toBe(true)
          const d = distanceToPolygonEdge(p, ol)
          const margin =
            e.kind === 'house' || e.kind === 'windmill' || e.kind === 'lighthouse'
              ? MARGINS[e.kind] * res.sizeScale + e.r * 0.4
              : Math.max(MARGINS[e.kind as 'tree' | 'rock'], e.r * 0.45)
          expect(d).toBeGreaterThanOrEqual(margin - 0.01)
        }
      }

      // 碰撞：静态物件之间保持间距（船/码头在海上，岛民是移动物，均不参与）
      const dynamic = res.entities.filter(
        (e) => e.kind !== 'boat' && e.kind !== 'dock' && e.kind !== 'villager'
      )
      for (let i = 0; i < dynamic.length; i++) {
        for (let j = i + 1; j < dynamic.length; j++) {
          const a = dynamic[i]
          const b = dynamic[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          expect(d).toBeGreaterThanOrEqual((a.r + b.r) * 0.77 - 0.01)
        }
      }

      // 花草也必须在岛上且离岸边有距离
      for (const f of res.flowers) {
        expect(pointInPolygon(f, ol)).toBe(true)
        expect(distanceToPolygonEdge(f, ol)).toBeGreaterThanOrEqual(MARGINS.flower)
      }
    })

    it(`${label}：相同种子完全复现，不同种子布局不同`, () => {
      const { outline: ol, area, centroid } = makeOutline(outline)
      const a = generateLayout({ outline: ol, area, centroid, decorSeed: 99, heart: false })
      const b = generateLayout({ outline: ol, area, centroid, decorSeed: 99, heart: false })
      expect(JSON.stringify(a.entities)).toBe(JSON.stringify(b.entities))
      expect(JSON.stringify(a.flowers)).toBe(JSON.stringify(b.flowers))

      let differs = false
      for (let seed = 100; seed < 130 && !differs; seed++) {
        const c = generateLayout({ outline: ol, area, centroid, decorSeed: seed, heart: false })
        if (JSON.stringify(c.entities) !== JSON.stringify(a.entities)) differs = true
      }
      expect(differs).toBe(true)
    })
  })

  it('生成循环有终止条件：细长小岛也能立即完成', () => {
    const ol = ellipsePts(600, 400, 220, 46, 60)
    const { area, centroid } = makeOutline(ol)
    const start = Date.now()
    const res = generateLayout({ outline: ol, area, centroid, decorSeed: 1, heart: false })
    expect(Date.now() - start).toBeLessThan(2000)
    expect(res.counts.houses).toBeLessThanOrEqual(1)
  })

  it('心形岛屿触发彩蛋花草', () => {
    const heart = heartPts(600, 400, 11)
    const { outline, area, centroid } = makeOutline(heart)
    const res = generateLayout({ outline, area, centroid, decorSeed: 5, heart: true })
    const heartFlowers = res.flowers.filter((f) => f.heart)
    expect(heartFlowers.length).toBeGreaterThan(6)
    expect(isHeartShape(heart)).toBe(true)
  })
})

describe('命名与彩蛋', () => {
  it('同一 rng 流生成的名字可复现', () => {
    const a = genIslandName(new R(123), false)
    const b = genIslandName(new R(123), false)
    expect(a.name).toBe(b.name)
    expect(a.tagline).toBe(b.tagline)
    expect(a.name.length).toBeGreaterThan(1)
  })

  it('心形岛使用专属命名', () => {
    const r = genIslandName(new R(1), true)
    expect(r.tagline).toContain('心')
  })

  it('介绍文案包含数量', () => {
    const line = genFeatureLine({ trees: 12, houses: 2, windmills: 1, rocks: 5, flowers: 20, boats: 1, lighthouses: 0, docks: 1 })
    expect(line).toContain('12 棵树')
    expect(line).toContain('2 座小木屋')
    expect(line).toContain('风车')
    expect(line).toContain('码头')
  })
})

describe('心形识别', () => {
  it('参数心形得分高并通过判定', () => {
    const heart = heartPts(600, 400, 10)
    const score = heartScore(heart)
    expect(score).toBeGreaterThanOrEqual(HEART_THRESHOLD)
    expect(isHeartShape(heart)).toBe(true)
  })

  it('圆形与宽椭圆不是心形', () => {
    const circ = circlePts(600, 400, 150, 72)
    expect(heartScore(circ)).toBeLessThan(HEART_THRESHOLD)
    expect(isHeartShape(circ)).toBe(false)
    const wide = ellipsePts(600, 400, 260, 100, 72)
    expect(isHeartShape(wide)).toBe(false)
  })

  it('轻微抖动的心形仍可识别', () => {
    const base = heartPts(600, 400, 10).slice(0, -1)
    const rng = mulberry32(3)
    const pts: Poly = base.map((p) => ({ x: 600 + p.x + (rng() - 0.5) * 8, y: 400 + p.y + (rng() - 0.5) * 8 }))
    expect(heartScore(pts)).toBeGreaterThanOrEqual(HEART_THRESHOLD)
  })

  it('心形宽高比接近 1', () => {
    expect(aspectRatio(heartPts(600, 400, 10))).toBeGreaterThan(0.6)
  })
})

describe('实体属性完整性', () => {
  it('每个实体都有唯一的 id 与必要的运行时字段', () => {
    const ol = circlePts(600, 400, 170, 64)
    const res = generateLayout({ outline: ol, area: polygonArea(ol), centroid: polygonCentroid(ol), decorSeed: 8, heart: false })
    const ids = new Set(res.entities.map((e) => e.id))
    expect(ids.size).toBe(res.entities.length)
    for (const e of res.entities as IslandEntity[]) {
      expect(e.r).toBeGreaterThanOrEqual(0)
      expect(e.size).toBeGreaterThan(0)
      expect(Number.isFinite(e.phase)).toBe(true)
      expect(e.pop).toBe(0)
    }
  })
})
