import gsap from 'gsap'
import type { FlowerSpec, IslandData, IslandEntity, Poly, Pt, TimeOfDay, Weather } from '../types'
import { distanceToPolygonEdge, pointInPolygon, polygonArea, polygonBBox, polygonCentroid, translatePoly } from '../geometry/poly'
import { generateLayout } from '../generation/layout'
import { genFeatureLine, genIslandName } from '../generation/names'
import { isHeartShape } from '../generation/heart'
import { isStarShape } from '../generation/star'
import { computeGrade, GRADE_COLORS, type IslandGrade } from '../generation/grade'
import { R, hashPoints } from '../generation/rng'
import { C } from './colors'
import { drawFoam, drawMoodTint, drawOcean, drawRainbow, drawSkyLight, drawVignette, type EnvSnapshot } from './ocean'
import { buildTerrain, type TerrainResult } from './terrain'
import { drawEntity, drawEntityGlow, drawPlantedFlower, hitRadiusOf } from './entities'
import { ParticleSystem, pickFireflyAnchors } from './effects'
import { clamp01, easeOutBack, easeOutCubic, expApproach, stageProgress } from './easings'
import { deriveMelody } from '../generation/melody'
import { encodeIslandCode } from '../generation/islandcode'
import { cyclePhase } from './timeflow'

export type SceneMode = 'idle' | 'drawing' | 'preview' | 'generating' | 'exploring'

export interface DrawState {
  phase: 'drawing' | 'preview' | 'invalid'
  message?: string
}

export interface GenerateOptions {
  /** 已居中的轮廓 */
  poly: Poly
  /** 居中位置相对绘制位置的偏移（centered - drawn） */
  drawOffset: Pt
  mode: 'full' | 'redecor' | 'instant'
  ambient?: boolean
  savedName?: string
  savedTagline?: string
  grade?: string
  createdAt?: number
  /** 拜访模式：不写存档、不计造岛数 */
  visit?: boolean
}

export interface NameInfo {
  name: string
  tagline: string
  isHeart: boolean
  isStar: boolean
  memorial: boolean
  grade: string
}

type GenMode = 'full' | 'redecor'

const GEN_TOTAL: Record<GenMode, number> = { full: 4.6, redecor: 1.4 }

export class Scene {
  canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  dpr = 1
  w = 0
  h = 0
  view = { scale: 1, ox: 0, oy: 0 }
  time = 0
  mode: SceneMode = 'idle'
  ambient = false
  quality = 1

  // 绘制状态
  drawPoints: Pt[] = []
  drawing = false
  activePointerId = -1
  private previewPoly: Poly | null = null
  private previewOffset: Pt = { x: 0, y: 0 }
  private previewPath: Path2D | null = null
  invalidFlash = false

  island: IslandData | null = null
  private terrain: TerrainResult | null = null

  timeOfDay: TimeOfDay = 'day'
  weather: Weather = 'clear'
  nightT = 0
  rainT = 0
  duskT = 0
  snowT = 0
  /** 时光流逝：自动昼夜循环 */
  timeFlow = false
  private flowClock = 0

  /** 生成动画跳过：点击画布直接完成（补发名牌与完成回调） */
  skipGeneration(): void {
    if (!this.gen.active || this.gen.mode !== 'full') return
    this.killTl()
    this.gen.active = false
    this.gen.finished = true
    this.gen.clock = this.gen.total
    if (this.island) {
      this.onNameReveal?.({
        name: this.island.name,
        tagline: this.island.tagline,
        isHeart: this.island.isHeart,
        isStar: this.island.isStar,
        memorial: this.island.memorial ?? false,
        grade: this.island.grade
      })
    }
    this.onGenDone?.()
  }

  /** 岛屿之歌的可视化部分：随节拍从岛心上方飘出音符 */
  startSongParticles(count: number): void {
    this.songBeat = 0
    this.songBeatTotal = Math.min(count, 16)
    this.songBeatT = 0
  }

  restartFlowClock(): void {
    this.flowClock = 0
  }

  gen = { active: false, clock: 0, total: GEN_TOTAL.full, mode: 'full' as GenMode, finished: false }
  private tl: gsap.core.Timeline | null = null
  private landedIds = new Set<number>()
  private sandSplashed = false

  ps = new ParticleSystem()
  hoverEntity: IslandEntity | null = null
  interactions = 0

  comboCount = 0
  private lastInteractT = -10
  rainbow = { active: false, t: 0 }
  private dolphinAcc = 10
  private meteorAcc = 0
  private bottleAcc = 18
  plantedFlowers: FlowerSpec[] = []
  bottles: IslandEntity[] = []
  onPlant: ((total: number) => void) | null = null
  onBottle: (() => void) | null = null
  songBeat = 0
  songBeatTotal = 0
  songBeatT = 0

  private rainAcc = 0
  private coastAcc = 0
  private fishAcc = 4
  private birdAcc = 6
  private ema = 16

  onDrawState: ((s: DrawState) => void) | null = null
  onNameReveal: ((info: NameInfo) => void) | null = null
  onGenDone: (() => void) | null = null
  onHover: ((e: IslandEntity | null, sx: number, sy: number) => void) | null = null
  onInteract: ((e: IslandEntity) => void) | null = null
  onCombo: ((count: number) => void) | null = null
  onDolphin: (() => void) | null = null
  onFish: (() => void) | null = null
  onMemorial: (() => void) | null = null
  onGenStage: ((stage: number) => void) | null = null
  onBirdChirp: (() => void) | null = null

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    this.resize()
  }

  detach(): void {
    this.killTl()
    this.canvas = null
    this.ctx = null
  }

  resize(): void {
    const canvas = this.canvas
    if (!canvas) return
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.w = canvas.clientWidth
    this.h = canvas.clientHeight
    canvas.width = Math.max(1, Math.round(this.w * this.dpr))
    canvas.height = Math.max(1, Math.round(this.h * this.dpr))
    if (this.ambient) this.applyAmbientView()
    else this.fitView()
    if (this.w * this.h < 480 * 780) this.quality = Math.min(this.quality, 0.7)
  }

  /** 首页演示：缩小并按比例摆放 */
  ambientMul = 0.62
  ambientAnchorY = 0.44

  applyAmbientView(): void {
    const base = Math.min(this.w / 1200, this.h / 800)
    const scale = base * this.ambientMul
    this.view = { scale, ox: this.w / 2 - 600 * scale, oy: this.h * this.ambientAnchorY - 400 * scale }
  }

  /** 主舞台：把 1200×800 逻辑区域 contain 进画布 */
  fitView(): void {
    const scale = Math.min(this.w / 1200, this.h / 800)
    this.view = { scale, ox: (this.w - 1200 * scale) / 2, oy: (this.h - 800 * scale) / 2 }
  }

  resetForDrawing(): void {
    this.killTl()
    this.island = null
    this.terrain = null
    this.previewPoly = null
    this.previewPath = null
    this.invalidFlash = false
    this.drawPoints = []
    this.drawing = false
    this.hoverEntity = null
    this.gen = { active: false, clock: 0, total: GEN_TOTAL.full, mode: 'full', finished: false }
    this.ps.reset()
    this.ambient = false
    this.comboCount = 0
    this.lastInteractT = -10
    this.rainbow = { active: false, t: 0 }
    this.bottles = []
    this.plantedFlowers = []
    this.mode = 'drawing'
    this.fitView()
  }

  // ---------- 绘制输入 ----------

  beginDraw(): void {
    if (this.mode !== 'drawing') return
    this.drawing = true
    this.drawPoints = []
    this.invalidFlash = false
    this.previewPoly = null
    this.previewPath = null
  }

  addDrawPoint(p: Pt): void {
    if (!this.drawing || this.drawPoints.length >= 1400) return
    const last = this.drawPoints[this.drawPoints.length - 1]
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 3.5) this.drawPoints.push(p)
  }

  endDraw(): void {
    this.drawing = false
  }

  setDrawResult(result: { ok: boolean; poly?: Poly; reason?: string }): void {
    this.invalidFlash = !result.ok
    if (result.ok && result.poly) {
      const bb = polygonBBox(result.poly)
      const cx = (bb.minX + bb.maxX) / 2
      const cy = (bb.minY + bb.maxY) / 2
      const centered = translatePoly(result.poly, 600 - cx, 400 - cy)
      this.previewPoly = centered
      this.previewOffset = { x: cx - 600, y: cy - 400 }
      const path = new Path2D()
      path.moveTo(centered[0].x, centered[0].y)
      for (let i = 1; i < centered.length; i++) path.lineTo(centered[i].x, centered[i].y)
      path.closePath()
      this.previewPath = path
      this.mode = 'preview'
    } else {
      this.previewPoly = null
      this.previewPath = null
      this.mode = 'drawing'
    }
    this.onDrawState?.(this.drawState)
  }

  get drawState(): DrawState {
    if (this.mode === 'preview') return { phase: 'preview' }
    if (this.invalidFlash) return { phase: 'invalid', message: this.lastInvalidReason }
    return { phase: 'drawing' }
  }

  /** 预览中的居中轮廓与偏移（生成用） */
  getPreview(): { poly: Poly; offset: Pt } | null {
    if (!this.previewPoly) return null
    return { poly: this.previewPoly, offset: this.previewOffset }
  }

  lastInvalidReason = ''

  notifyInvalid(reason: string): void {
    this.lastInvalidReason = reason
    this.invalidFlash = true
    this.onDrawState?.(this.drawState)
  }

  clearDrawing(): void {
    this.drawPoints = []
    this.previewPoly = null
    this.previewPath = null
    this.invalidFlash = false
    this.mode = 'drawing'
    this.onDrawState?.(this.drawState)
  }

  // ---------- 岛屿生成 ----------

  generateIsland(opts: GenerateOptions): IslandData {
    this.killTl()
    const area = polygonArea(opts.poly)
    const centroid = polygonCentroid(opts.poly)
    const bb = polygonBBox(opts.poly)
    const heart = !opts.ambient && isHeartShape(opts.poly)
    const star = !opts.ambient && !heart && isStarShape(opts.poly)
    const decorSeed = (Math.random() * 4294967296) >>> 0
    const coastSeed = hashPoints(opts.poly)
    const layout = generateLayout({ outline: opts.poly, area, centroid, decorSeed, heart, star })
    const nameRng = new R(coastSeed ^ (decorSeed >>> 1))
    const auto = genIslandName(nameRng, heart, star)
    const name = opts.savedName ?? auto.name
    const tagline = opts.savedTagline ?? auto.tagline

    // 出生时间轴
    const rng = new R(decorSeed ^ 0x9e37)
    const greens: IslandEntity[] = []
    const builds: IslandEntity[] = []
    const boats: IslandEntity[] = []
    for (const e of layout.entities) {
      ;(
        e.kind === 'boat' || e.kind === 'dock'
          ? boats
          : e.kind === 'tree' || e.kind === 'rock'
            ? greens
            : builds
      ).push(e)
    }
    const bornBase = opts.mode === 'full' ? { green: 2.3, build: 3.0, boat: 3.9 } : { green: 0.02, build: 0.38, boat: 0.78 }
    const stag = opts.mode === 'full' ? { green: 0.045, build: 0.14, boat: 0.1 } : { green: 0.03, build: 0.1, boat: 0.05 }
    for (const [group, base, st] of [
      [rng.shuffle(greens), bornBase.green, stag.green],
      [rng.shuffle(builds), bornBase.build, stag.build],
      [rng.shuffle(boats), bornBase.boat, stag.boat]
    ] as Array<[IslandEntity[], number, number]>) {
      group.forEach((e, i) => {
        e.bornAt = base + i * st
        e.bornDur = opts.mode === 'full' ? 0.5 : 0.4
      })
    }

    const { grade: computedGrade } = computeGrade(area, layout.counts, star ? 'star' : heart ? 'heart' : 'none')
    const grade = opts.grade ?? computedGrade
    const memorial = area >= 101600 && area <= 103200
    if (memorial) this.onMemorial?.()
    this.loadPlantedFlowers(coastSeed)
    this.bottles = []

    const island: IslandData = {
      outline: opts.poly,
      drawOffset: opts.mode === 'full' ? { ...opts.drawOffset } : { x: 0, y: 0 },
      area,
      centroid,
      bbox: bb,
      beachW: layout.beachW,
      sizeScale: layout.sizeScale,
      coastSeed,
      decorSeed,
      name,
      tagline,
      featureLine: genFeatureLine(layout.counts),
      isHeart: heart,
      isStar: star,
      memorial,
      grade,
      melody: deriveMelody(opts.poly),
      entities: layout.entities,
      flowers: layout.flowers,
      counts: layout.counts,
      coastPts: layout.coastPts,
      createdAt: opts.createdAt ?? Date.now()
    }
    this.island = island
    this.terrain = buildTerrain(island, decorSeed)
    this.ps.reset()
    this.ps.setFireflies(pickFireflyAnchors(opts.poly, bb, decorSeed))
    this.landedIds.clear()
    this.sandSplashed = false
    this.ambient = !!opts.ambient
    this.hoverEntity = null

    if (opts.mode === 'instant') {
      this.gen = { active: false, clock: 999, total: 1, mode: 'full', finished: true }
    } else {
      this.startGenTimeline(opts.mode === 'full' ? 'full' : 'redecor')
    }
    return island
  }

  redecorate(): void {
    if (!this.island) return
    const prev = this.island
    this.generateIsland({
      poly: prev.outline,
      drawOffset: { x: 0, y: 0 },
      mode: 'redecor',
      savedName: prev.name,
      savedTagline: prev.tagline
    })
  }

  private startGenTimeline(mode: GenMode): void {
    this.killTl()
    const total = GEN_TOTAL[mode]
    this.gen = { active: true, clock: 0, total, mode, finished: false }
    this.mode = 'generating'
    this.tl = gsap.timeline({
      onComplete: () => {
        this.gen.active = false
        this.gen.finished = true
        this.onGenDone?.()
      }
    })
    this.tl.to(this.gen, { clock: total, duration: total, ease: 'none' }, 0)
    if (mode === 'full') {
      // 六阶段各自的音阶与转场钩子
      const stageTimes = [0.05, 0.75, 1.75, 2.55, 3.35, 3.95]
      stageTimes.forEach((st, i) => {
        this.tl?.call(() => this.onGenStage?.(i), [], st)
      })
      this.tl.call(
        () => {
          if (this.island)
            this.onNameReveal?.({
              name: this.island.name,
              tagline: this.island.tagline,
              isHeart: this.island.isHeart,
              isStar: this.island.isStar,
              memorial: this.island.memorial ?? false,
              grade: this.island.grade
            })
        },
        [],
        total - 0.45
      )
    }
  }

  private killTl(): void {
    if (this.tl) {
      this.tl.kill()
      this.tl = null
    }
    if (this.gen.active) this.gen.active = false
  }

  // ---------- 交互 ----------

  screenToWorld(sx: number, sy: number): Pt {
    return { x: (sx - this.view.ox) / this.view.scale, y: (sy - this.view.oy) / this.view.scale }
  }

  hitTest(p: Pt, touch: boolean): IslandEntity | null {
    if (!this.island) return null
    const ents = this.island.entities
    for (let i = ents.length - 1; i >= 0; i--) {
      const e = ents[i]
      if (e.kind === 'dock') continue
      if (!this.gen.finished && e.bornAt + e.bornDur > this.gen.clock) continue
      const hr = hitRadiusOf(e, touch)
      if (Math.hypot(p.x - e.x, p.y - e.y) <= hr) return e
    }
    for (let i = this.bottles.length - 1; i >= 0; i--) {
      const b = this.bottles[i]
      if (Math.hypot(p.x - b.x, p.y - b.y) <= hitRadiusOf(b, touch)) return b
    }
    return null
  }

  interact(e: IslandEntity): void {
    this.interactions++
    e.pop = 1
    if (this.time - this.lastInteractT < 1.5) this.comboCount++
    else this.comboCount = 1
    this.lastInteractT = this.time
    if (this.comboCount >= 3) {
      this.ps.spawnComboText(e.x, e.y - e.r - 8, `×${this.comboCount} 连击！`)
      this.onCombo?.(this.comboCount)
    }
    this.onInteract?.(e)
    switch (e.kind) {
      case 'tree':
        this.ps.spawnLeaves(e.x, e.y - 16 * e.size, e.r)
        break
      case 'house':
        e.lightsOn = !e.lightsOn
        e.smokeT = 5
        break
      case 'windmill':
        e.spinBoost = 1
        break
      case 'boat':
        e.bobBoost = 1
        this.ps.spawnRipple(e.x, e.y + 4, 'click')
        break
      case 'lighthouse':
        e.lightsOn = !e.lightsOn
        e.spinBoost = 1
        break
      case 'rock':
        e.wobble = 1
        break
      case 'bottle': {
        this.ps.spawnSplash(e.x, e.y, 'rgba(255,255,255,0.9)', 8, 55)
        this.bottles = this.bottles.filter((b) => b.id !== e.id)
        this.onBottle?.()
        break
      }
    }
  }

  hover(p: Pt, sx: number, sy: number, touch: boolean): void {
    if (this.mode !== 'exploring') {
      if (this.hoverEntity) {
        this.hoverEntity = null
        this.onHover?.(null, sx, sy)
      }
      return
    }
    const hit = touch ? null : this.hitTest(p, touch)
    if (hit !== this.hoverEntity) {
      this.hoverEntity = hit
      this.onHover?.(hit, sx, sy)
    }
  }

  /** 探索页点在海面：涟漪，有概率惊出鱼或海豚 */
  seaClick(p: Pt): void {
    if (!this.island) return
    if (pointInPolygon(p, this.island.outline)) return
    this.ps.spawnRipple(p.x, p.y, 'click')
    if (this.nightT < 0.6) {
      const roll = Math.random()
      if (roll < 0.4) {
        this.ps.spawnFish(p.x, p.y)
        this.onFish?.()
      } else if (roll < 0.55) {
        this.ps.spawnDolphin(p.x, p.y)
        this.onDolphin?.()
      }
    }
  }

  /** 点在岛内草地上：亲手种一朵花（上限 30，按海岸指纹持久化） */
  tryPlantFlower(p: Pt): boolean {
    const isl = this.island
    if (!isl || this.ambient) return false
    if (!pointInPolygon(p, isl.outline)) return false
    if (distanceToPolygonEdge(p, isl.outline) < isl.beachW + 8) return false
    if (this.plantedFlowers.length >= 30) {
      this.onPlant?.(this.plantedFlowers.length)
      return true
    }
    const colors = ['#F6A8C5', '#FFD1DF', '#FFF6E8', '#F7BF75', '#E86A5E']
    const f: FlowerSpec = {
      x: p.x,
      y: p.y,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 1.15,
      heart: false,
      plantedAt: this.time
    }
    this.plantedFlowers.push(f)
    this.onPlant?.(this.plantedFlowers.length)
    this.ps.spawnSplash(p.x, p.y, 'rgba(255,240,220,0.85)', 4, 26)
    try {
      const key = 'island-forge-plants-v1'
      const raw = localStorage.getItem(key)
      const map = raw ? (JSON.parse(raw) as Record<string, FlowerSpec[]>) : {}
      map[String(isl.coastSeed)] = this.plantedFlowers
      localStorage.setItem(key, JSON.stringify(map))
    } catch {
      /* 存储不可用时不持久化 */
    }
    return true
  }

  loadPlantedFlowers(seed: number): void {
    this.plantedFlowers = []
    try {
      const raw = localStorage.getItem('island-forge-plants-v1')
      if (!raw) return
      const map = JSON.parse(raw) as Record<string, FlowerSpec[]>
      this.plantedFlowers = (map[String(seed)] ?? []).slice(0, 30)
    } catch {
      this.plantedFlowers = []
    }
  }

  private spawnBottle(): void {
    const fromLeft = Math.random() < 0.5
    const y = 120 + Math.random() * 560
    this.bottles.push({
      id: 900000 + Math.floor(Math.random() * 100000),
      kind: 'bottle',
      x: fromLeft ? -40 : 1240,
      y,
      r: 14,
      size: 1,
      variant: 0,
      phase: Math.random() * Math.PI * 2,
      bornAt: 0,
      bornDur: 0.4,
      pop: 0,
      hoverT: 0,
      spinBoost: 0,
      lightsOn: false,
      smokeT: 0,
      bobBoost: 0,
      wobble: (fromLeft ? 1 : -1) * (13 + Math.random() * 8),
      alpha: 1
    })
  }

  /** 雨转晴时启动彩虹 */
  startRainbow(): void {
    this.rainbow = { active: true, t: 0 }
  }

  private trySpawnDolphin(): boolean {
    const isl = this.island
    if (!isl) return false
    const cp = isl.coastPts[Math.floor(Math.random() * isl.coastPts.length)]
    const dx = cp.x - isl.centroid.x
    const dy = cp.y - isl.centroid.y
    const len = Math.hypot(dx, dy) || 1
    const x = cp.x + (dx / len) * (70 + Math.random() * 50)
    const y = cp.y + (dy / len) * (70 + Math.random() * 50)
    if (x < 80 || x > 1120 || y < 80 || y > 720) return false
    if (pointInPolygon({ x, y }, isl.outline)) return false
    this.ps.spawnDolphin(x, y)
    this.onDolphin?.()
    return true
  }

  // ---------- 每帧更新 ----------

  frame(dtMs: number): void {
    const dt = Math.min(dtMs, 50) / 1000
    this.time += dt
    this.ema = this.ema * 0.95 + Math.min(dtMs, 60) * 0.05
    if (this.ema > 30) this.quality = Math.max(0.4, this.quality - dt * 0.4)
    else if (this.ema < 22) this.quality = Math.min(1, this.quality + dt * 0.15)

    this.nightT = expApproach(this.nightT, this.timeOfDay === 'night' ? 1 : 0, dt, 2.4)
    this.rainT = expApproach(this.rainT, this.weather === 'rain' ? 1 : 0, dt, 2.6)
    this.duskT = expApproach(this.duskT, this.timeOfDay === 'dusk' ? 1 : 0, dt, 2)
    this.snowT = expApproach(this.snowT, this.weather === 'snow' ? 1 : 0, dt, 1.8)
    // 时光流逝：加速走完整昼夜循环
    if (this.timeFlow && !this.gen.active) {
      this.flowClock += dt * 14
      const phase = cyclePhase(this.flowClock)
      if (phase.mode !== this.timeOfDay) this.timeOfDay = phase.mode
    }

    const isl = this.island
    if (isl) {
      for (const e of isl.entities) {
        e.pop = Math.max(0, e.pop - dt * 2.2)
        e.spinBoost *= Math.exp(-dt / 1.7)
        e.bobBoost *= Math.exp(-dt / 0.9)
        e.wobble = Math.max(0, e.wobble - dt * 0.8)
        e.smokeT = Math.max(0, e.smokeT - dt)
        e.hoverT = expApproach(e.hoverT, e === this.hoverEntity ? 1 : 0, dt, 12)
        if (e.kind === 'windmill') e.phase += dt * (1.1 + e.spinBoost * 3.4)
        if (e.kind === 'lighthouse') e.phase += dt * 0.9 * (1 + e.spinBoost * 2.5)
        if (e.kind === 'boat') {
          e.orbitAngle = e.orbitAngle ?? 0
        }
        if (e.kind === 'house' && e.smokeT > 0 && Math.random() < dt * 5) {
          this.ps.spawnSmoke(e.x + 9.75 * e.size, e.y - 26 * e.size)
        }
        // 岛民行为：散步 / 钓鱼 / 入夜回家
        if (e.kind === 'villager') this.updateVillager(e, dt, isl)
      }
      // 漂流瓶：慢慢漂过海面
      this.bottleAcc += dt
      if (this.bottleAcc > 46 && this.mode === 'exploring' && this.bottles.length === 0) {
        this.bottleAcc = 0
        this.spawnBottle()
      }
      for (let i = this.bottles.length - 1; i >= 0; i--) {
        const b = this.bottles[i]
        b.x += b.wobble * dt
        if (b.x < -60 || b.x > 1260) this.bottles.splice(i, 1)
      }
      // 雨滴涟漪
      if (this.rainT > 0.05) {
        this.rainAcc += dt * 9 * this.rainT
        const x0 = -this.view.ox / this.view.scale
        const y0 = -this.view.oy / this.view.scale
        const x1 = (this.w - this.view.ox) / this.view.scale
        const y1 = (this.h - this.view.oy) / this.view.scale
        while (this.rainAcc >= 1) {
          this.rainAcc -= 1
          const p = { x: this.rain01() * (x1 - x0) + x0, y: this.rain01() * (y1 - y0) + y0 }
          if (!pointInPolygon(p, isl.outline)) this.ps.spawnRipple(p.x, p.y, 'rain')
        }
      }
      // 海岸偶尔泛起泡沫圈
      if (this.quality > 0.6 && (this.mode === 'exploring' || this.gen.clock > 4)) {
        this.coastAcc += dt
        if (this.coastAcc > 2.2) {
          this.coastAcc = 0
          const cp = isl.coastPts[Math.floor(Math.random() * isl.coastPts.length)]
          const dx = cp.x - isl.centroid.x
          const dy = cp.y - isl.centroid.y
          const len = Math.hypot(dx, dy) || 1
          this.ps.spawnRipple(cp.x + (dx / len) * 8, cp.y + (dy / len) * 8, 'coast')
        }
      }
      // 偶发的鱼跃与飞鸟（白天的海面生气）
      const dayA = 1 - this.nightT
      this.fishAcc += dt
      if (this.fishAcc > 7 && this.mode === 'exploring' && this.quality > 0.5) {
        this.fishAcc = 0
        if (dayA > 0.4 && Math.random() < 0.75) {
          const cp = isl.coastPts[Math.floor(Math.random() * isl.coastPts.length)]
          const dx = cp.x - isl.centroid.x
          const dy = cp.y - isl.centroid.y
          const len = Math.hypot(dx, dy) || 1
          const fx = cp.x + (dx / len) * (46 + Math.random() * 60)
          const fy = cp.y + (dy / len) * (46 + Math.random() * 60)
          if (!pointInPolygon({ x: fx, y: fy }, isl.outline)) {
            this.ps.spawnFish(fx, fy)
            this.onFish?.()
          }
        }
      }
      this.birdAcc += dt
      if (this.birdAcc > 12 && this.mode === 'exploring' && this.quality > 0.5 && dayA > 0.5 && this.rainT < 0.5) {
        this.birdAcc = 0
        this.ps.spawnBirdFlock({
          x0: -this.view.ox / this.view.scale,
          y0: -this.view.oy / this.view.scale,
          x1: (this.w - this.view.ox) / this.view.scale,
          y1: (this.h - this.view.oy) / this.view.scale
        })
        if (dayA > 0.5) this.onBirdChirp?.()
      }
      // 海豚大约每 18~30 秒拜访一次
      this.dolphinAcc += dt
      if (this.dolphinAcc > 18 && this.mode === 'exploring' && dayA > 0.35 && this.quality > 0.5) {
        if (Math.random() < 0.5) {
          if (this.trySpawnDolphin()) this.dolphinAcc = -6
          else this.dolphinAcc = 12
        } else this.dolphinAcc = 10
      }
      // 星形岛的夜间流星
      if (isl.isStar && this.mode === 'exploring' && this.nightT > 0.7 && this.quality > 0.5) {
        this.meteorAcc += dt
        if (this.meteorAcc > 3.6) {
          this.meteorAcc = 0
          this.ps.spawnMeteor({ w: this.w, h: this.h })
        }
      }
      // 彩虹计时（约 8 秒）
      if (this.rainbow.active) {
        this.rainbow.t += dt
        if (this.rainbow.t > 8) this.rainbow = { active: false, t: 0 }
      }
      // 岛屿之歌节拍 → 音符粒子
      if (this.songBeatTotal > 0 && this.songBeat < this.songBeatTotal) {
        this.songBeatT += dt
        if (this.songBeatT >= 0.52) {
          this.songBeatT -= 0.52
          this.ps.spawnNote(
            isl.centroid.x + Math.sin(this.songBeat * 2.1) * 60,
            isl.bbox.minY - 20 - Math.random() * 30
          )
          this.songBeat++
        }
      }
      const env = this.envSnapshot()
      this.ps.update(dt, {
        screenW: this.w,
        screenH: this.h,
        rainT: this.rainT,
        snowT: this.snowT,
        nightT: this.nightT,
        quality: this.quality,
        view: {
          x0: -this.view.ox / this.view.scale,
          y0: -this.view.oy / this.view.scale,
          x1: (this.w - this.view.ox) / this.view.scale,
          y1: (this.h - this.view.oy) / this.view.scale
        },
        isLand: (p) => pointInPolygon(p, isl.outline)
      })
      void env
    } else {
      this.ps.update(dt, {
        screenW: this.w,
        screenH: this.h,
        rainT: this.rainT,
        snowT: this.snowT,
        nightT: this.nightT,
        quality: this.quality,
        view: { x0: 0, y0: 0, x1: 1200, y1: 800 },
        isLand: () => false
      })
    }

    const ctx = this.ctx
    if (!ctx) return
    // 屏幕空间：海洋
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    drawOcean(ctx, this.w, this.h, this.time, this.quality, this.envSnapshot())

    // 世界空间：岛屿与实体
    const s = this.view.scale
    ctx.setTransform(this.dpr * s, 0, 0, this.dpr * s, this.dpr * this.view.ox, this.dpr * this.view.oy)
    this.renderWorld(ctx, dt)

    // 屏幕空间：压暗、天光、发光、彩虹、流星、雨、暗角
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    drawMoodTint(ctx, this.w, this.h, this.nightT, this.rainT, this.duskT, this.snowT)
    drawSkyLight(ctx, this.w, this.h, this.time, this.nightT, this.duskT)
    if (this.rainbow.active) {
      const rt = this.rainbow.t
      const a = rt < 1.2 ? rt / 1.2 : rt > 6 ? Math.max(0, (8 - rt) / 2) : 1
      drawRainbow(ctx, this.w, this.h, a)
    }
    if (this.island) {
      ctx.setTransform(this.dpr * s, 0, 0, this.dpr * s, this.dpr * this.view.ox, this.dpr * this.view.oy)
      for (const e of this.island.entities) drawEntityGlow(ctx, e, this.time, this.envSnapshot())
      this.ps.drawFireflies(ctx, this.time, this.nightT)
      this.ps.drawNotes(ctx)
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    }
    this.ps.drawMeteors(ctx)
    this.ps.drawSnow(ctx)
    this.ps.drawRain(ctx)
    drawVignette(ctx, this.w, this.h)
  }

  private rainSeed = 987654321
  private rain01(): number {
    // 帧内轻量伪随机，避免引入额外状态
    this.rainSeed = (this.rainSeed * 1664525 + 1013904223) >>> 0
    return this.rainSeed / 4294967296
  }

  private villagerRng = new R(20261029)

  /** 岛民：选路点→行走→发呆循环；入夜淡出，清晨回来 */
  private updateVillager(e: IslandEntity, dt: number, isl: IslandData): void {
    if (e.role === 'fisher') {
      // 钓鱼翁：偶发收竿水花
      if (Math.random() < dt * 0.06) {
        this.ps.spawnSplash(e.x + Math.cos(e.phase) * 15 * e.size, e.y + Math.sin(e.phase) * 15 * e.size, 'rgba(255,255,255,0.85)', 5, 40)
        this.ps.spawnRipple(e.x + Math.cos(e.phase) * 15 * e.size, e.y + Math.sin(e.phase) * 15 * e.size, 'click')
      }
      return
    }
    const wantOutside = this.nightT < 0.5 && this.duskT < 0.8
    e.alpha = expApproach(e.alpha ?? 1, wantOutside ? 1 : 0, dt, 1.4)
    if ((e.alpha ?? 1) < 0.04) return
    if ((e.idleT ?? 0) > 0) {
      e.idleT = (e.idleT ?? 0) - dt
      if ((e.idleT ?? 0) <= 0) {
        // 选一个新的草地路点
        const bb = isl.bbox
        for (let a = 0; a < 24; a++) {
          const x = this.villagerRng.range(bb.minX + 10, bb.maxX - 10)
          const y = this.villagerRng.range(bb.minY + 10, bb.maxY - 10)
          if (!pointInPolygon({ x, y }, isl.outline)) continue
          if (distanceToPolygonEdge({ x, y }, isl.outline) < isl.beachW + 14) continue
          e.targetX = x
          e.targetY = y
          break
        }
      }
      return
    }
    const tx = e.targetX ?? e.x
    const ty = e.targetY ?? e.y
    const dx = tx - e.x
    const dy = ty - e.y
    const d = Math.hypot(dx, dy)
    if (d < 3) {
      e.idleT = this.villagerRng.range(2, 5.5)
      return
    }
    const speed = 13 * e.size
    e.x += (dx / d) * speed * dt
    e.y += (dy / d) * speed * dt
  }

  envSnapshot(): EnvSnapshot {
    return { timeOfDay: this.timeOfDay, weather: this.weather, nightT: this.nightT, rainT: this.rainT, duskT: this.duskT }
  }

  /** 世界空间渲染（供主画布与海报复用） */
  /** 绘制页笔迹与预览轮廓（无岛屿时也要可见） */
  private drawSketch(ctx: CanvasRenderingContext2D): void {
    if (this.mode === 'drawing' && this.drawPoints.length > 1) {
      const invalid = this.invalidFlash
      const stroke = new Path2D()
      stroke.moveTo(this.drawPoints[0].x, this.drawPoints[0].y)
      for (let i = 1; i < this.drawPoints.length; i++) stroke.lineTo(this.drawPoints[i].x, this.drawPoints[i].y)
      ctx.save()
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.shadowColor = invalid ? 'rgba(255,120,100,0.9)' : C.sunset
      ctx.shadowBlur = 14
      ctx.strokeStyle = invalid ? 'rgba(255,150,130,0.95)' : 'rgba(255,233,184,0.95)'
      ctx.lineWidth = 5
      ctx.stroke(stroke)
      ctx.shadowBlur = 0
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 2
      ctx.stroke(stroke)
      const last = this.drawPoints[this.drawPoints.length - 1]
      const first = this.drawPoints[0]
      if (this.drawPoints.length > 2) {
        ctx.setLineDash([7, 9])
        ctx.lineDashOffset = -this.time * 22
        ctx.strokeStyle = 'rgba(255,240,200,0.42)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(last.x, last.y)
        ctx.lineTo(first.x, first.y)
        ctx.stroke()
        ctx.setLineDash([])
      }
      ctx.fillStyle = invalid ? 'rgba(255,150,130,0.95)' : 'rgba(255,255,255,0.95)'
      ctx.beginPath()
      ctx.arc(last.x, last.y, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    } else if (this.mode === 'preview' && this.previewPath) {
      ctx.save()
      ctx.translate(-this.previewOffset.x, -this.previewOffset.y)
      ctx.fillStyle = 'rgba(242,215,161,0.22)'
      ctx.fill(this.previewPath)
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.shadowColor = C.sunset
      ctx.shadowBlur = 16
      ctx.setLineDash([16, 10])
      ctx.lineDashOffset = -this.time * 36
      ctx.strokeStyle = 'rgba(255,220,150,0.95)'
      ctx.lineWidth = 4
      ctx.stroke(this.previewPath)
      ctx.setLineDash([])
      ctx.shadowBlur = 0
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 1.5
      ctx.stroke(this.previewPath)
      ctx.restore()
    }
  }

  renderWorld(ctx: CanvasRenderingContext2D, dt: number): void {
    const isl = this.island
    this.ps.drawWorldRipplesOnly(ctx)
    if (!isl || !this.terrain) {
      this.drawSketch(ctx)
      return
    }
    const env = this.envSnapshot()
    const full = this.gen.mode === 'full'
    const clock = this.gen.clock

    // 涟漪
    this.ps.drawWorldRipplesOnly(ctx)

    const riseP = full ? easeOutCubic(stageProgress(clock, 0.7, 1.7)) : 1
    const offK = full ? 1 - riseP : 0
    const riseY = (1 - riseP) * 70
    const riseScale = 0.94 + 0.06 * riseP
    const riseAlpha = full ? clamp01(stageProgress(clock, 0.75, 1.35)) : 1

    // 阶段一：轮廓发光 + 海水向心聚拢
    if (full && clock < 1.1) {
      const p1 = stageProgress(clock, 0, 0.9)
      const glowPoly = translatePoly(isl.outline, -isl.drawOffset.x, -isl.drawOffset.y)
      const path = new Path2D()
      path.moveTo(glowPoly[0].x, glowPoly[0].y)
      for (let i = 1; i < glowPoly.length; i++) path.lineTo(glowPoly[i].x, glowPoly[i].y)
      path.closePath()
      let perimeter = 0
      for (let i = 0; i < glowPoly.length; i++) {
        const a = glowPoly[i]
        const b = glowPoly[(i + 1) % glowPoly.length]
        perimeter += Math.hypot(b.x - a.x, b.y - a.y)
      }
      ctx.save()
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.strokeStyle = 'rgba(255,233,184,0.95)'
      ctx.lineWidth = 5
      ctx.shadowColor = C.sunset
      ctx.shadowBlur = 18
      ctx.setLineDash([perimeter * easeOutCubic(p1), 100000])
      ctx.stroke(path)
      ctx.restore()
      for (let k = 0; k < 3; k++) {
        const pk = stageProgress(clock, 0.06 * k, 0.95)
        const rr = (1 - easeOutCubic(pk)) * (300 - k * 60) + 20
        ctx.strokeStyle = `rgba(200,240,248,${0.45 * pk})`
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.ellipse(isl.centroid.x, isl.centroid.y, rr, rr * 0.62, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // 漂流瓶贴水，先于岛屿绘制（从岛后海面漂过）
    for (const b of this.bottles) {
      const bt = clamp01((clock - b.bornAt) / b.bornDur)
      drawEntity(ctx, b, this.time, env, Math.max(0.001, easeOutCubic(bt)))
    }

    // 沙层升起
    ctx.save()
    ctx.translate(isl.centroid.x, isl.centroid.y + riseY - isl.drawOffset.y * offK)
    ctx.scale(riseScale, riseScale)
    ctx.translate(-isl.centroid.x, -isl.centroid.y)
    ctx.globalAlpha = riseAlpha
    const tr = this.terrain
    ctx.drawImage(tr.sand.canvas, tr.sand.ox, tr.sand.oy)
    // 草地生长
    const grassP = full ? easeOutCubic(stageProgress(clock, 1.5, 2.5)) : 1
    if (grassP > 0.001) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(isl.centroid.x, isl.centroid.y, Math.max(1, tr.grassMaxR * grassP), 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(tr.grass.canvas, tr.grass.ox, tr.grass.oy)
      ctx.restore()
    }
    ctx.restore()
    ctx.globalAlpha = 1

    // 沙地落定水花
    if (full && !this.sandSplashed && clock > 1.7) {
      this.sandSplashed = true
      for (let i = 0; i < 8; i++) {
        const cp = isl.coastPts[Math.floor((i / 8) * isl.coastPts.length)]
        this.ps.spawnSplash(cp.x, cp.y, 'rgba(255,255,255,0.9)', 5, 60)
      }
    }

    // 海岸泡沫
    const foamA = full ? stageProgress(clock, 1.3, 2.1) : 1
    drawFoam(ctx, tr.islandPath, this.time, foamA, this.quality)

    const drawOne = (e: IslandEntity): void => {
      const bornT = this.gen.finished ? 1 : clamp01((clock - e.bornAt) / e.bornDur)
      if (bornT <= 0) return
      const isBuilding = e.kind === 'house' || e.kind === 'windmill' || e.kind === 'lighthouse'
      if (isBuilding && bornT > 0.75 && !this.landedIds.has(e.id)) {
        this.landedIds.add(e.id)
        if (full) this.ps.spawnSplash(e.x, e.y + 2, 'rgba(214,182,130,0.9)', 8, 40)
      }
      const scale = bornT < 1 ? easeOutBack(bornT) : 1
      drawEntity(ctx, e, this.time, env, Math.max(0.001, scale))
    }
    // 玩家种的花（贴在草地上，随出生动画弹出）
    for (const f of this.plantedFlowers) {
      const bt = f.plantedAt !== undefined ? clamp01((this.time - f.plantedAt) / 0.4) : 1
      if (bt <= 0) continue
      const sc = 0.4 + 0.6 * easeOutBack(bt)
      drawPlantedFlower(ctx, f, sc)
    }
    // 雪天：岛面覆雪薄层（树木也蒙霜）
    if (this.snowT > 0.01) {
      ctx.save()
      ctx.clip(tr.islandPath)
      ctx.fillStyle = `rgba(242,248,255,${0.34 * this.snowT})`
      ctx.fillRect(isl.bbox.minX - 12, isl.bbox.minY - 12, isl.bbox.maxX - isl.bbox.minX + 24, isl.bbox.maxY - isl.bbox.minY + 24)
      ctx.restore()
    }

    // 码头贴水，最先画；其余实体按 y 排序形成前后层次（岛后的小船先画）
    const movable = isl.entities.filter((e) => e.kind !== 'dock')
    for (const e of isl.entities) if (e.kind === 'dock') drawOne(e)
    const sorted = movable.slice().sort((a, b) => a.y - b.y)
    const behind: IslandEntity[] = []
    const front: IslandEntity[] = []
    for (const e of sorted) (e.y < isl.bbox.minY + 24 ? behind : front).push(e)
    for (const e of behind) drawOne(e)
    for (const e of front) drawOne(e)

    // 白天飘过岛面的云影（只落在陆地上）
    if (env.nightT < 0.85 && env.rainT < 0.85) {
      const bbW = isl.bbox.maxX - isl.bbox.minX
      const span = bbW + 620
      const left0 = isl.bbox.minX - 310
      ctx.save()
      ctx.clip(this.terrain.islandPath)
      for (let i = 0; i < 3; i++) {
        const raw = (this.time * (11 + i * 5) + i * 577) % span
        const cx = left0 + raw
        const edge = Math.min(raw, span - raw) / 220
        const cy = isl.centroid.y + Math.sin(this.time * 0.07 + i * 2.1) * span * 0.2
        ctx.fillStyle = `rgba(10,42,54,${0.06 * (1 - env.nightT) * Math.max(0, Math.min(1, edge))})`
        ctx.beginPath()
        ctx.ellipse(cx, cy, 150 - i * 24, 52 - i * 8, 0.2 * (i - 1), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    // 粒子与白天小生命
    this.ps.drawWorldParticles(ctx)
    this.ps.drawFish(ctx)
    this.ps.drawDolphins(ctx)
    this.ps.drawBirds(ctx, this.time)
    this.ps.drawButterflies(ctx, this.time, (1 - env.nightT) * (1 - env.rainT * 0.85))
    this.ps.drawComboTexts(ctx)
    void dt
  }

  /** 1600×1200 分享海报 */
  renderPoster(): HTMLCanvasElement | null {
    const isl = this.island
    if (!isl || !this.terrain) return null
    const c = document.createElement('canvas')
    c.width = 1600
    c.height = 1200
    const ctx = c.getContext('2d') as CanvasRenderingContext2D
    const bandH = 190
    const k = Math.min(1600 / 1200, (1200 - bandH) / 800)
    // 海洋先以画布原尺寸铺满场景区，世界层再按逻辑坐标缩放
    drawOcean(ctx, 1600, 1200 - bandH, this.time, 1, { timeOfDay: 'day', weather: 'clear', nightT: 0, rainT: 0, duskT: 0 })
    ctx.setTransform(k, 0, 0, k, (1600 - 1200 * k) / 2, 0)
    this.renderWorld(ctx, 0)
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    const y0 = 1200 - bandH
    ctx.fillStyle = C.nightSky
    ctx.fillRect(0, y0, 1600, 133)
    ctx.strokeStyle = 'rgba(247,191,117,0.55)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, y0 + 1)
    ctx.lineTo(1600, y0 + 1)
    ctx.stroke()

    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    ctx.fillStyle = C.sunset
    ctx.font = '700 48px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif'
    ctx.fillText(isl.name, 64, y0 + 58)
    if (isl.isHeart) {
      const w = ctx.measureText(isl.name).width
      ctx.save()
      ctx.translate(64 + w + 30, y0 + 42)
      ctx.scale(1.6, 1.6)
      ctx.fillStyle = '#F6A8C5'
      ctx.beginPath()
      ctx.moveTo(0, 8)
      ctx.bezierCurveTo(-10, -2, -6, -12, 0, -6)
      ctx.bezierCurveTo(6, -12, 10, -2, 0, 8)
      ctx.fill()
      ctx.restore()
    }
    ctx.fillStyle = 'rgba(226,238,248,0.92)'
    ctx.font = '400 24px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif'
    ctx.fillText(isl.tagline, 64, y0 + 100)
    // 岛屿独有介绍（基于真实生成内容）
    ctx.fillStyle = 'rgba(226,238,248,0.62)'
    ctx.font = '400 19px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif'
    ctx.fillText(isl.featureLine, 64, y0 + 138)
    // 岛屿代码：海报即分享入口
    ctx.fillStyle = 'rgba(226,238,248,0.42)'
    ctx.font = '400 10px ui-monospace, Consolas, monospace'
    ctx.fillText(`岛屿代码 ${encodeIslandCode(isl)}`, 64, y0 + 168)

    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    ctx.font = '600 24px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif'
    ctx.fillText('ISLAND FORGE · 一笔造岛', 1536, y0 + 58)
    const d = new Date(isl.createdAt)
    const dateText = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = '400 22px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif'
    ctx.fillText(dateText, 1536, y0 + 100)

    // 评级徽章（场景区右下角）
    const gradeColor = GRADE_COLORS[(isl.grade as IslandGrade) ?? 'C'] ?? GRADE_COLORS.C
    const gx = 1500
    const gy = y0 - 62
    ctx.save()
    ctx.shadowColor = 'rgba(8,30,44,0.45)'
    ctx.shadowBlur = 10
    ctx.fillStyle = 'rgba(14,38,54,0.82)'
    ctx.beginPath()
    ctx.arc(gx, gy, 30, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    ctx.strokeStyle = gradeColor
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(gx, gy, 30, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = gradeColor
    ctx.font = '700 32px "PingFang SC","Microsoft YaHei",sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(isl.grade, gx, gy + 11)
    ctx.textAlign = 'left'
    return c
  }
}
