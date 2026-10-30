import type { IslandData, Pt } from '../types'
import { C } from './colors'
import { distanceToPolygonEdge, pointInPolygon, polygonCentroid } from '../geometry/poly'
import { R } from '../generation/rng'

export interface TerrainLayer {
  canvas: HTMLCanvasElement
  /** 画布左上角对应的世界坐标 */
  ox: number
  oy: number
}

export interface TerrainResult {
  sand: TerrainLayer
  grass: TerrainLayer
  /** 草地生长动画的最大半径 */
  grassMaxR: number
  islandPath: Path2D
  centroid: Pt
}

function makeLayer(bb: { minX: number; minY: number; maxX: number; maxY: number }, pad = 80): { layer: TerrainLayer; ctx: CanvasRenderingContext2D } {
  const w = Math.ceil(bb.maxX - bb.minX + pad * 2)
  const h = Math.ceil(bb.maxY - bb.minY + pad * 2)
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(w, 2400)
  canvas.height = Math.min(h, 2400)
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.translate(pad - bb.minX, pad - bb.minY)
  return { layer: { canvas, ox: bb.minX - pad, oy: bb.minY - pad }, ctx }
}

function pathOf(poly: Array<{ x: number; y: number }>): Path2D {
  const p = new Path2D()
  p.moveTo(poly[0].x, poly[0].y)
  for (let i = 1; i < poly.length; i++) p.lineTo(poly[i].x, poly[i].y)
  p.closePath()
  return p
}

/**
 * 分层构建静态地形（离屏缓存，生成/重新装点时才重绘）：
 * 沙层 = 湿沙描边 + 沙面 + 质点 + 贝壳；草层 = 草地填充 + 呼吸感边缘 +
 * 多级 destination-out 内蚀形成沙滩环带 + 斑驳纹理 + 花草。
 */
export function buildTerrain(island: IslandData, decorSeed: number): TerrainResult {
  const { outline, area, beachW, bbox, coastPts } = island
  const rng = new R(decorSeed)
  const centroid = polygonCentroid(outline)
  const islandPath = pathOf(outline)

  // ---- 沙层 ----
  const sand = makeLayer(bbox)
  const s = sand.ctx
  s.lineJoin = 'round'
  s.lineCap = 'round'
  // 湿沙边（外扩的深色描边，一半落在岛外形成海岸过渡）
  s.strokeStyle = C.sandWet
  s.lineWidth = beachW * 1.15
  s.stroke(islandPath)
  s.fillStyle = C.sand
  s.fill(islandPath)
  // 内侧沙滩加深
  s.save()
  s.clip(islandPath)
  s.strokeStyle = 'rgba(206,168,112,0.4)'
  s.lineWidth = beachW * 0.9
  s.stroke(islandPath)
  s.restore()
  // 沙面细点
  const dotCount = Math.min(420, Math.round(area / 900))
  for (let i = 0; i < dotCount; i++) {
    const x = rng.range(bbox.minX, bbox.maxX)
    const y = rng.range(bbox.minY, bbox.maxY)
    if (!pointInPolygon({ x, y }, outline)) continue
    s.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(185,148,106,0.4)'
    s.beginPath()
    s.arc(x, y, rng.range(0.8, 1.7), 0, Math.PI * 2)
    s.fill()
  }
  // 贝壳小装饰
  const shellCount = Math.min(9, 3 + Math.round(area / 60000))
  for (let i = 0; i < shellCount; i++) {
    const cp = coastPts[rng.int(0, coastPts.length - 1)]
    const dx = centroid.x - cp.x
    const dy = centroid.y - cp.y
    const len = Math.hypot(dx, dy) || 1
    const x = cp.x + (dx / len) * beachW * 0.45
    const y = cp.y + (dy / len) * beachW * 0.45
    s.save()
    s.translate(x, y)
    s.rotate(rng.range(0, Math.PI * 2))
    s.fillStyle = i % 2 === 0 ? 'rgba(255,250,240,0.85)' : 'rgba(232,170,150,0.8)'
    s.beginPath()
    s.arc(0, 0, 2.1, Math.PI, 0)
    s.closePath()
    s.fill()
    s.strokeStyle = 'rgba(150,110,80,0.5)'
    s.lineWidth = 0.6
    s.beginPath()
    s.moveTo(0, 0)
    s.lineTo(-1.4, -2)
    s.moveTo(0, 0)
    s.lineTo(0, -2.2)
    s.moveTo(0, 0)
    s.lineTo(1.4, -2)
    s.stroke()
    s.restore()
  }

  // ---- 草层 ----
  const grass = makeLayer(bbox)
  const g = grass.ctx
  g.lineJoin = 'round'
  g.lineCap = 'round'
  g.fillStyle = C.grass
  g.fill(islandPath)
  // 边缘呼吸感：沿海岸向内的随机圆斑
  for (const cp of coastPts) {
    const dx = centroid.x - cp.x
    const dy = centroid.y - cp.y
    const len = Math.hypot(dx, dy) || 1
    const off = rng.range(-5, 9)
    const r = rng.range(6, 13)
    g.fillStyle = rng.chance(0.5) ? C.grass : C.grassDark
    g.beginPath()
    g.arc(cp.x + (dx / len) * off, cp.y + (dy / len) * off, r, 0, Math.PI * 2)
    g.fill()
  }
  // 多级内蚀：越靠边草地越淡，形成自然沙滩环带（避免不可靠的多边形内缩算法）
  g.globalCompositeOperation = 'destination-out'
  const passes: Array<[number, number]> = [
    [2 * beachW, 0.14],
    [2 * beachW - 7, 0.2],
    [2 * beachW - 14, 0.3],
    [2 * beachW - 21, 0.45],
    [2 * beachW - 28, 0.7],
    [2 * beachW - 34, 1]
  ]
  for (const [width, alpha] of passes) {
    if (width <= 2) continue
    g.globalAlpha = alpha
    g.lineWidth = width
    g.strokeStyle = '#000'
    g.stroke(islandPath)
  }
  g.globalAlpha = 1
  g.globalCompositeOperation = 'source-over'

  // 草地斑驳（低透明度，避免生硬色块感）
  const blobCount = Math.min(90, Math.round(area / 1600))
  const blobColors = ['rgba(111,175,120,0.26)', 'rgba(165,216,164,0.2)', 'rgba(78,145,99,0.22)']
  for (let i = 0; i < blobCount; i++) {
    const x = rng.range(bbox.minX, bbox.maxX)
    const y = rng.range(bbox.minY, bbox.maxY)
    const p = { x, y }
    if (!pointInPolygon(p, outline) || distanceToPolygonEdge(p, outline) < beachW) continue
    g.fillStyle = blobColors[i % 3]
    g.beginPath()
    g.ellipse(x, y, rng.range(7, 18), rng.range(5, 13), rng.range(0, Math.PI), 0, Math.PI * 2)
    g.fill()
  }
  // 小草茎
  const bladeCount = Math.min(140, Math.round(area / 2600))
  g.strokeStyle = 'rgba(78,143,91,0.55)'
  g.lineWidth = 1
  for (let i = 0; i < bladeCount; i++) {
    const x = rng.range(bbox.minX, bbox.maxX)
    const y = rng.range(bbox.minY, bbox.maxY)
    const p = { x, y }
    if (!pointInPolygon(p, outline) || distanceToPolygonEdge(p, outline) < beachW * 0.8) continue
    for (let k = 0; k < 3; k++) {
      const bx = x + rng.range(-2.5, 2.5)
      const by = y + rng.range(-2, 2)
      g.beginPath()
      g.moveTo(bx, by)
      g.lineTo(bx + rng.range(-1.5, 1.5), by - rng.range(3, 6))
      g.stroke()
    }
  }
  // 花草（心形粉花 / 星形金花）
  for (const f of island.flowers) {
    drawFlower(g, f.x, f.y, f.color, f.size * (f.heart ? 1.35 : f.star ? 1.2 : 1))
  }

  let grassMaxR = beachW + 20
  for (const p of outline) {
    grassMaxR = Math.max(grassMaxR, Math.hypot(p.x - centroid.x, p.y - centroid.y) + beachW + 12)
  }
  return { sand: sand.layer, grass: grass.layer, grassMaxR, islandPath, centroid }
}

export function drawFlower(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  size: number
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = 'rgba(78,143,91,0.9)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -3 * size)
  ctx.stroke()
  ctx.fillStyle = color
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2
    ctx.beginPath()
    ctx.arc(Math.cos(a) * 1.9 * size, -3 * size + Math.sin(a) * 1.9 * size, 1.35 * size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#FFF3D6'
  ctx.beginPath()
  ctx.arc(0, -3 * size, 0.9 * size, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
