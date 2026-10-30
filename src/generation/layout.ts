import type { EntityKind, FlowerSpec, IslandCounts, IslandEntity, Poly, Pt } from '../types'
import {
  distanceToPolygonEdge,
  pointInPolygon,
  polygonBBox,
  resampleClosed
} from '../geometry/poly'
import { R } from './rng'

export const MARGINS = {
  house: 40,
  windmill: 48,
  lighthouse: 30,
  tree: 12,
  rock: 10,
  flower: 7,
  boat: 42
} as const

const FLOWER_COLORS = ['#F7BF75', '#E86A5E', '#FFF6E8', '#FFD9E8', '#C9E4FF']
const HEART_FLOWER_COLORS = ['#F6A8C5', '#FF8FB8', '#FFD1DF']
const STAR_FLOWER_COLORS = ['#F7D774', '#FFE9A8', '#FFC94D']
const OUTFITS = ['#E86A5E', '#5FA8D8', '#F2C14E', '#8FBF7F', '#C98BD9']

export interface LayoutInput {
  outline: Poly
  area: number
  centroid: Pt
  /** 装饰种子（重新装点只改这个） */
  decorSeed: number
  heart: boolean
  star?: boolean
}

export interface LayoutResult {
  entities: IslandEntity[]
  flowers: FlowerSpec[]
  counts: IslandCounts
  sizeScale: number
  beachW: number
  coastPts: Pt[]
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

interface Placed {
  x: number
  y: number
  r: number
}

/**
 * 布置所有物件：包围盒随机候选点 → 点在岛内 → 边缘距离 → 圆形碰撞 → 确认放置。
 * 所有循环都有尝试上限，窄小岛屿自然少放甚至不放。
 */
export function generateLayout(input: LayoutInput): LayoutResult {
  const { outline, area, centroid } = input
  const star = input.star ?? false
  const rng = new R(input.decorSeed)
  const bb = polygonBBox(outline)
  const sizeScale = clamp(Math.sqrt(area / 95000), 0.72, 1.3)
  const beachW = clamp(Math.sqrt(area) * 0.055, 13, 30)
  const coastPts = resampleClosed(outline, 26)

  const treeCount = clamp(Math.round(area / 6500), 4, 30)
  const houseCount = area < 18000 ? 1 : clamp(Math.round(area / 68000), 1, 3)
  const windmillCount = area > 55000 && rng.chance(0.85) ? 1 : 0
  const lighthouseCount = area > 110000 && rng.chance(0.55) ? 1 : 0
  const rockCount = clamp(Math.round(area / 26000), 3, 10)
  let flowerCount = clamp(Math.round(area / 8000), 6, 42)
  if (input.heart) flowerCount += 14
  if (star) flowerCount += 10
  const boatCount = rng.chance(0.8) ? 1 : 0

  const placed: Placed[] = []
  const entities: IslandEntity[] = []
  let nextId = 1

  const fits = (x: number, y: number, r: number, overlap: number): boolean => {
    for (const o of placed) {
      const need = (r + o.r) * overlap
      if (Math.hypot(x - o.x, y - o.y) < need) return false
    }
    return true
  }

  const tryPlace = (
    kind: EntityKind,
    count: number,
    marginBase: number,
    rMin: number,
    rMax: number,
    overlap: number,
    inland: boolean
  ): number => {
    let done = 0
    const attempts = count * 40 + 30
    for (let a = 0; a < attempts && done < count; a++) {
      const x = rng.range(bb.minX + 4, bb.maxX - 4)
      const y = rng.range(bb.minY + 4, bb.maxY - 4)
      if (!pointInPolygon({ x, y }, outline)) continue
      const dEdge = distanceToPolygonEdge({ x, y }, outline)
      const r = rng.range(rMin, rMax) * sizeScale
      const margin = inland
        ? marginBase * sizeScale + r * 0.4
        : Math.max(marginBase, r * 0.45)
      if (dEdge < margin) continue
      if (!fits(x, y, r, overlap)) continue
      const e: IslandEntity = {
        id: nextId++,
        kind,
        x,
        y,
        r,
        size: sizeScale,
        variant: rng.int(0, 2),
        phase: rng.range(0, Math.PI * 2),
        bornAt: 0,
        bornDur: 0.5,
        pop: 0,
        hoverT: 0,
        spinBoost: 0,
        lightsOn: false,
        smokeT: 0,
        bobBoost: 0,
        wobble: 0
      }
      placed.push({ x, y, r })
      entities.push(e)
      done++
    }
    return done
  }

  // 房屋、风车优先安排在内陆
  const houses = tryPlace('house', houseCount, MARGINS.house, 26, 26, 0.95, true)
  const windmills = tryPlace('windmill', windmillCount, MARGINS.windmill, 30, 30, 0.95, true)
  const lighthouses = tryPlace('lighthouse', lighthouseCount, MARGINS.lighthouse, 24, 24, 0.95, true)
  // 树木可以贴着海岸
  const trees = tryPlace('tree', treeCount, MARGINS.tree, 15, 21, 0.78, false)
  const rocks = tryPlace('rock', rockCount, MARGINS.rock, 8, 15, 0.9, false)

  // 小船：漂在岛外的海面上；有船时顺带在最近的海岸点修一座小码头
  const entitiesWithBoat = entities.slice()
  let boats = 0
  let docks = 0
  if (boatCount > 0) {
    let maxCoast = 0
    for (const p of outline) maxCoast = Math.max(maxCoast, Math.hypot(p.x - centroid.x, p.y - centroid.y))
    for (let a = 0; a < 40 && boats < boatCount; a++) {
      const ang = rng.range(0, Math.PI * 2)
      const orbitR = maxCoast + rng.range(55, 130)
      const x = centroid.x + Math.cos(ang) * orbitR
      const y = centroid.y + Math.sin(ang) * orbitR
      if (x < 60 || x > 1140 || y < 60 || y > 740) continue
      if (pointInPolygon({ x, y }, outline)) continue
      const dEdge = distanceToPolygonEdge({ x, y }, outline)
      if (dEdge < MARGINS.boat || dEdge > 180) continue
      const e: IslandEntity = {
        id: nextId++,
        kind: 'boat',
        x,
        y,
        r: 22 * sizeScale,
        size: sizeScale,
        variant: rng.int(0, 2),
        phase: rng.range(0, Math.PI * 2),
        bornAt: 0,
        bornDur: 0.6,
        pop: 0,
        hoverT: 0,
        spinBoost: 0,
        lightsOn: false,
        smokeT: 0,
        bobBoost: 0,
        wobble: 0,
        orbitR,
        orbitAngle: ang,
        orbitSpeed: rng.range(0.02, 0.045) * (rng.chance(0.5) ? 1 : -1)
      }
      entitiesWithBoat.push(e)
      boats++

      // 码头：朝向小船一侧的海岸点
      let nearest = coastPts[0]
      let best = Infinity
      for (const cp of coastPts) {
        const d = Math.hypot(cp.x - x, cp.y - y)
        if (d < best) {
          best = d
          nearest = cp
        }
      }
      const nx = nearest.x - centroid.x
      const ny = nearest.y - centroid.y
      const nl = Math.hypot(nx, ny) || 1
      const dock: IslandEntity = {
        id: nextId++,
        kind: 'dock',
        x: nearest.x + (nx / nl) * 13 * sizeScale,
        y: nearest.y + (ny / nl) * 13 * sizeScale,
        r: 0,
        size: sizeScale,
        variant: 0,
        phase: Math.atan2(ny, nx),
        bornAt: 0,
        bornDur: 0.6,
        pop: 0,
        hoverT: 0,
        spinBoost: 0,
        lightsOn: false,
        smokeT: 0,
        bobBoost: 0,
        wobble: 0
      }
      entitiesWithBoat.push(dock)
      docks++
    }
  }

  // 花草：贴地装饰，只在草地上
  const flowers: FlowerSpec[] = []
  for (let a = 0, done = 0; a < flowerCount * 30 && done < flowerCount; a++) {
    const x = rng.range(bb.minX + 6, bb.maxX - 6)
    const y = rng.range(bb.minY + 6, bb.maxY - 6)
    if (!pointInPolygon({ x, y }, outline)) continue
    const dEdge = distanceToPolygonEdge({ x, y }, outline)
    if (dEdge < MARGINS.flower + beachW) continue
    let tooClose = false
    for (const f of flowers) {
      if (Math.hypot(f.x - x, f.y - y) < 11) {
        tooClose = true
        break
      }
    }
    if (tooClose) continue
    const heart = input.heart && rng.chance(0.7)
    const golden = star && rng.chance(0.6)
    flowers.push({
      x,
      y,
      color: heart ? rng.pick(HEART_FLOWER_COLORS) : golden ? rng.pick(STAR_FLOWER_COLORS) : rng.pick(FLOWER_COLORS),
      size: rng.range(0.8, 1.4),
      heart,
      star: golden
    })
    done++
  }

  // 岛民：每座小屋走出一名散步居民，有码头则配一名钓鱼翁
  const villagers: IslandEntity[] = []
  for (const h of entities) {
    if (h.kind !== 'house') continue
    for (let a = 0; a < 30; a++) {
      const ang = rng.range(0, Math.PI * 2)
      const d = rng.range(26, 46)
      const x = h.x + Math.cos(ang) * d
      const y = h.y + Math.sin(ang) * d
      if (!pointInPolygon({ x, y }, outline)) continue
      if (distanceToPolygonEdge({ x, y }, outline) < beachW + 14) continue
      villagers.push({
        id: nextId++,
        kind: 'villager',
        x,
        y,
        r: 10,
        size: sizeScale,
        variant: rng.int(0, 2),
        phase: rng.range(0, Math.PI * 2),
        bornAt: 0,
        bornDur: 0.5,
        pop: 0,
        hoverT: 0,
        spinBoost: 0,
        lightsOn: false,
        smokeT: 0,
        bobBoost: 0,
        wobble: 0,
        role: 'walker',
        outfit: rng.int(0, OUTFITS.length - 1),
        idleT: rng.range(0, 3),
        alpha: 1,
        targetX: x,
        targetY: y
      })
      break
    }
  }
  for (const d of entitiesWithBoat) {
    if (d.kind !== 'dock') continue
    villagers.push({
      id: nextId++,
      kind: 'villager',
      x: d.x + Math.cos(d.phase) * 12 * sizeScale,
      y: d.y + Math.sin(d.phase) * 12 * sizeScale,
      r: 10,
      size: sizeScale,
      variant: 0,
      phase: d.phase,
      bornAt: 0,
      bornDur: 0.5,
      pop: 0,
      hoverT: 0,
      spinBoost: 0,
      lightsOn: false,
      smokeT: 0,
      bobBoost: 0,
      wobble: 0,
      role: 'fisher',
      outfit: rng.int(0, OUTFITS.length - 1),
      idleT: 0,
      alpha: 1
    })
  }

  const counts: IslandCounts = {
    trees,
    houses,
    windmills,
    rocks,
    flowers: flowers.length,
    boats,
    lighthouses,
    docks
  }

  return { entities: [...entitiesWithBoat, ...villagers], flowers, counts, sizeScale, beachW, coastPts }
}
