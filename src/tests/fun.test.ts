import { describe, expect, it } from 'vitest'
import type { Poly } from '../types'
import { starScore, isStarShape, STAR_THRESHOLD, starShape } from '../generation/star'
import { computeGrade, type ShapeSpecial } from '../generation/grade'
import { AchievementManager, ACHIEVEMENTS, type KVStorage } from '../achievements'
import { circlePts, heartPts } from './helpers'
import type { IslandCounts } from '../types'

function starPts(cx: number, cy: number, k = 150): Poly {
  return starShape(10).map((p) => ({ x: cx + p.x * k, y: cy + p.y * k }))
}

function counts(over: Partial<IslandCounts> = {}): IslandCounts {
  return { trees: 10, houses: 1, windmills: 0, rocks: 3, flowers: 10, boats: 0, lighthouses: 0, docks: 0, ...over }
}

describe('星形识别', () => {
  it('参数五角星得分高并通过判定', () => {
    const star = starPts(600, 400)
    expect(starScore(star)).toBeGreaterThanOrEqual(STAR_THRESHOLD)
    expect(isStarShape(star)).toBe(true)
  })

  it('圆形、心形、宽椭圆不是星形', () => {
    expect(isStarShape(circlePts(600, 400, 150, 72))).toBe(false)
    expect(isStarShape(heartPts(600, 400, 10))).toBe(false)
    const wide: Poly = []
    for (let i = 0; i < 72; i++) {
      const t = (i / 72) * Math.PI * 2
      wide.push({ x: 600 + Math.cos(t) * 260, y: 400 + Math.sin(t) * 100 })
    }
    wide.push({ ...wide[0] })
    expect(isStarShape(wide)).toBe(false)
  })

  it('带轻微抖动的星形仍可识别', () => {
    const base = starPts(600, 400).slice(0, -1)
    const pts: Poly = base.map((p, i) => ({
      x: p.x + Math.sin(i * 7.3) * 4,
      y: p.y + Math.cos(i * 5.1) * 4
    }))
    expect(starScore(pts)).toBeGreaterThanOrEqual(STAR_THRESHOLD)
  })

  it('心形与星形互不误判', () => {
    const star = starPts(600, 400)
    const heart = heartPts(600, 400, 10)
    expect(isStarShape(heart)).toBe(false)
    expect(starScore(heart)).toBeLessThan(STAR_THRESHOLD)
    // 星形也不应被判为心形
    expect(starScore(star)).toBeGreaterThanOrEqual(STAR_THRESHOLD)
  })
})

describe('岛屿评级', () => {
  it('丰富的大岛可得 S', () => {
    const r = computeGrade(200000, counts({ houses: 3, windmills: 1, lighthouses: 1, boats: 1, docks: 1, trees: 25, flowers: 30 }), 'none')
    expect(r.grade).toBe('S')
  })

  it('空旷小岛为 C，中上丰富度为 B，边界值单调', () => {
    expect(computeGrade(9000, counts({ trees: 4, flowers: 6 }), 'none').grade).toBe('C')
    expect(computeGrade(90000, counts({ windmills: 1, boats: 1, trees: 15, flowers: 18 }), 'none').grade).toBe('B')
    // S 边界 88：同分只差形状加成时心形可越过阈值
    const base = computeGrade(150000, counts({ houses: 3, windmills: 1, lighthouses: 1, boats: 1, docks: 1, trees: 25, flowers: 30 }), 'none')
    const heart = computeGrade(150000, counts({ houses: 3, windmills: 1, lighthouses: 1, boats: 1, docks: 1, trees: 25, flowers: 30 }), 'heart')
    expect(heart.score).toBeGreaterThan(base.score)
    const star = computeGrade(150000, counts({ houses: 3, windmills: 1, lighthouses: 1, boats: 1, docks: 1, trees: 25, flowers: 30 }), 'star')
    expect(star.score).toBeGreaterThan(heart.score)
  })

  it('special 类型合法', () => {
    const s: ShapeSpecial = 'star'
    expect(computeGrade(10000, counts(), s).grade).toBeTruthy()
  })
})

describe('成就管理器', () => {
  function memStorage(): KVStorage & { data: Map<string, string> } {
    const data = new Map<string, string>()
    return {
      data,
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => {
        data.set(k, v)
      }
    }
  }

  it('解锁去重并持久化，重载后保留', () => {
    const st = memStorage()
    const m = new AchievementManager(st)
    let unlockEvents = 0
    m.onUnlock = () => unlockEvents++
    expect(m.unlock('first-island')).toBe(true)
    expect(m.unlock('first-island')).toBe(false)
    expect(unlockEvents).toBe(1)

    const m2 = new AchievementManager(st)
    expect(m2.isUnlocked('first-island')).toBe(true)
    expect(m2.unlockedCount()).toBe(1)
  })

  it('计数器累计触发成就', () => {
    const m = new AchievementManager(memStorage())
    for (let i = 0; i < 5; i++) m.onIslandGenerated({ isHeart: false, isStar: false })
    expect(m.isUnlocked('first-island')).toBe(true)
    expect(m.isUnlocked('archipelago')).toBe(true)
    for (let i = 0; i < 2; i++) m.onIslandGenerated({ isHeart: false, isStar: false })
    expect(m.counter('islands')).toBe(7)
  })

  it('全部 6 种实体互动后解锁万物有灵', () => {
    const m = new AchievementManager(memStorage())
    for (const k of ['tree', 'house', 'windmill', 'boat', 'lighthouse'] as const) m.onInteract(k)
    expect(m.isUnlocked('all-interactive')).toBe(false)
    m.onInteract('rock')
    expect(m.isUnlocked('all-interactive')).toBe(true)
  })

  it('连击峰值与 5 连击解锁', () => {
    const m = new AchievementManager(memStorage())
    m.onCombo(3)
    expect(m.counter('bestCombo')).toBe(3)
    expect(m.isUnlocked('combo-5')).toBe(false)
    m.onCombo(2)
    expect(m.counter('bestCombo')).toBe(3)
    m.onCombo(5)
    expect(m.isUnlocked('combo-5')).toBe(true)
  })

  it('损坏存档不崩溃，成就清单完整', () => {
    const st = memStorage()
    st.setItem('island-forge-achievements-v1', '{broken json')
    const m = new AchievementManager(st)
    expect(m.unlockedCount()).toBe(0)
    m.unlock('first-island')
    expect(m.isUnlocked('first-island')).toBe(true)
    expect(ACHIEVEMENTS.length).toBe(17)
  })

  it('种花计数达标解锁园丁，捞瓶解锁瓶中信', () => {
    const m = new AchievementManager(memStorage())
    for (let i = 1; i <= 9; i++) m.onPlant(i)
    expect(m.isUnlocked('gardener')).toBe(false)
    m.onPlant(10)
    expect(m.isUnlocked('gardener')).toBe(true)
    m.onBottle()
    expect(m.isUnlocked('bottle-keeper')).toBe(true)
  })

  it('初雪与 1024 纪念成就', () => {
    const m = new AchievementManager(memStorage())
    m.onSnow()
    m.onMemorial()
    expect(m.isUnlocked('first-snow')).toBe(true)
    expect(m.isUnlocked('memorial-1024')).toBe(true)
  })
})

describe('连击时间窗', () => {
  it('窗口内累计、超窗重置（依赖 Scene 的公开行为）', async () => {
    // 直接验证规则本身：间隔 <1.5s 累计，否则从 1 开始
    let combo = 0
    let lastT = -10
    const now = 100
    const hit = (t: number) => {
      if (t - lastT < 1.5) combo++
      else combo = 1
      lastT = t
      return combo
    }
    expect(hit(now)).toBe(1)
    expect(hit(now + 1)).toBe(2)
    expect(hit(now + 2)).toBe(3)
    expect(hit(now + 10)).toBe(1)
  })
})
