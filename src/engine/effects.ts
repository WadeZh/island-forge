import type { Pt } from '../types'
import { pointInPolygon } from '../geometry/poly'
import { R } from '../generation/rng'

export interface Ripple {
  x: number
  y: number
  age: number
  dur: number
  maxR: number
  kind: 'rain' | 'click' | 'coast'
}

export interface SmokeP {
  x: number
  y: number
  age: number
  life: number
  r: number
  drift: number
}

export interface LeafP {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  age: number
  life: number
  color: string
}

export interface SplashP {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  color: string
  r: number
}

export interface Firefly {
  ax: number
  ay: number
  phase: number
  speed: number
  amp: number
}

interface RainDrop {
  x: number
  y: number
  spd: number
  len: number
}

interface FishP {
  x: number
  y: number
  age: number
  dur: number
  dir: number
  splashed: boolean
}

interface BirdP {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  phase: number
}

export interface DolphinP {
  x: number
  y: number
  age: number
  dur: number
  dir: number
  entered: boolean
  exited: boolean
}

export interface ComboTextP {
  x: number
  y: number
  text: string
  age: number
  life: number
}

export interface MeteorP {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
}

interface SnowFlake {
  x: number
  y: number
  spd: number
  sway: number
  phase: number
  size: number
}

export interface NoteP {
  x: number
  y: number
  age: number
  life: number
  drift: number
}

const BUTTERFLY_COLORS = ['#FFF6E4', '#F7BF75', '#F6A8C5', '#FFE9F2']

const LEAF_COLORS = ['#5FA973', '#86C98A', '#C9DE8B', '#4C9A68']

/** 所有粒子统一管理；世界坐标系粒子与屏幕坐标系雨滴分开更新 */
export class ParticleSystem {
  ripples: Ripple[] = []
  smoke: SmokeP[] = []
  leaves: LeafP[] = []
  splashes: SplashP[] = []
  fireflies: Firefly[] = []
  butterflies: Firefly[] = []
  fish: FishP[] = []
  birds: BirdP[] = []
  dolphins: DolphinP[] = []
  comboTexts: ComboTextP[] = []
  meteors: MeteorP[] = []
  notes: NoteP[] = []
  snow: SnowFlake[] = []
  private rain: RainDrop[] = []
  private rng = new R(20261024)
  private w = 0
  private h = 0

  reset(): void {
    this.ripples.length = 0
    this.smoke.length = 0
    this.leaves.length = 0
    this.splashes.length = 0
    this.rain.length = 0
    this.fish.length = 0
    this.birds.length = 0
    this.dolphins.length = 0
    this.comboTexts.length = 0
    this.meteors.length = 0
    this.notes.length = 0
    this.snow.length = 0
  }

  setFireflies(anchors: Pt[]): void {
    const make = (a: Pt, i: number): Firefly => ({
      ax: a.x,
      ay: a.y,
      phase: (i * 2.399) % (Math.PI * 2),
      speed: 0.5 + ((i * 37) % 10) / 12,
      amp: 12 + ((i * 53) % 18)
    })
    this.fireflies = anchors.map(make)
    this.butterflies = anchors.slice(0, 5).map(make)
  }

  spawnFish(x: number, y: number): void {
    if (this.fish.length > 6) return
    this.fish.push({
      x,
      y,
      age: 0,
      dur: 0.7 + this.rng.range(0, 0.2),
      dir: this.rng.chance(0.5) ? 1 : -1,
      splashed: false
    })
    this.spawnRipple(x, y, 'click')
  }

  spawnDolphin(x: number, y: number): void {
    if (this.dolphins.length > 2) return
    this.dolphins.push({
      x,
      y,
      age: 0,
      dur: 1.35 + this.rng.range(0, 0.25),
      dir: this.rng.chance(0.5) ? 1 : -1,
      entered: false,
      exited: false
    })
  }

  spawnNote(x: number, y: number): void {
    if (this.notes.length > 16) return
    this.notes.push({
      x,
      y,
      age: 0,
      life: 2 + this.rng.range(0, 0.6),
      drift: this.rng.range(-9, 9)
    })
  }

  spawnComboText(x: number, y: number, text: string): void {
    this.comboTexts.push({ x, y: y - 30, text, age: 0, life: 1.15 })
  }

  spawnMeteor(view: { w: number; h: number }): void {
    const fromLeft = this.rng.chance(0.6)
    const y0 = this.rng.range(view.h * 0.04, view.h * 0.34)
    const speed = this.rng.range(420, 620)
    const ang = fromLeft ? this.rng.range(0.32, 0.52) : Math.PI - this.rng.range(0.32, 0.52)
    this.meteors.push({
      x: fromLeft ? -30 : view.w + 30,
      y: y0,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      age: 0,
      life: this.rng.range(0.9, 1.3)
    })
  }

  spawnBirdFlock(view: { x0: number; y0: number; x1: number; y1: number }): void {
    const fromLeft = this.rng.chance(0.5)
    const baseY = view.y0 + (view.y1 - view.y0) * this.rng.range(0.12, 0.4)
    const vx = (fromLeft ? 1 : -1) * this.rng.range(55, 85)
    const n = 2 + this.rng.int(0, 2)
    for (let i = 0; i < n; i++) {
      this.birds.push({
        x: fromLeft ? view.x0 - 40 - i * 26 : view.x1 + 40 + i * 26,
        y: baseY + this.rng.range(-24, 24),
        vx,
        vy: this.rng.range(-7, 7),
        size: this.rng.range(0.8, 1.35),
        phase: this.rng.range(0, Math.PI * 2)
      })
    }
  }

  spawnRipple(x: number, y: number, kind: Ripple['kind']): void {
    if (this.ripples.length > 60) this.ripples.shift()
    this.ripples.push({
      x,
      y,
      age: 0,
      dur: kind === 'click' ? 0.9 : kind === 'coast' ? 1.6 : 0.7,
      maxR: kind === 'click' ? 26 : kind === 'coast' ? 42 : 13,
      kind
    })
  }

  spawnSmoke(x: number, y: number): void {
    if (this.smoke.length > 40) return
    this.smoke.push({
      x,
      y,
      age: 0,
      life: 2.2 + this.rng.range(0, 0.8),
      r: 2 + this.rng.range(0, 1.4),
      drift: this.rng.range(-3, 3)
    })
  }

  spawnLeaves(x: number, y: number, spread: number): void {
    const n = 5 + this.rng.int(0, 2)
    for (let i = 0; i < n; i++) {
      if (this.leaves.length > 60) break
      this.leaves.push({
        x: x + this.rng.range(-spread, spread),
        y: y + this.rng.range(-spread * 0.5, spread * 0.5),
        vx: this.rng.range(-14, 14),
        vy: this.rng.range(-8, 6),
        rot: this.rng.range(0, Math.PI * 2),
        vr: this.rng.range(-4, 4),
        age: 0,
        life: 1.6 + this.rng.range(0, 0.9),
        color: this.rng.pick(LEAF_COLORS)
      })
    }
  }

  spawnSplash(x: number, y: number, color: string, count = 7, power = 46): void {
    for (let i = 0; i < count; i++) {
      if (this.splashes.length > 70) break
      const a = this.rng.range(0, Math.PI * 2)
      const v = this.rng.range(0.35, 1) * power
      this.splashes.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v * 0.55 - 22,
        age: 0,
        life: 0.5 + this.rng.range(0, 0.3),
        color,
        r: 1.4 + this.rng.range(0, 1.6)
      })
    }
  }

  update(
    dt: number,
    opts: {
      screenW: number
      screenH: number
      rainT: number
      snowT: number
      nightT: number
      quality: number
      view: { x0: number; y0: number; x1: number; y1: number }
      isLand: (p: Pt) => boolean
    }
  ): void {
    // 涟漪
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i]
      r.age += dt
      if (r.age >= r.dur) this.ripples.splice(i, 1)
    }
    // 烟
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const p = this.smoke[i]
      p.age += dt
      p.y -= (13 + p.r) * dt
      p.x += (Math.sin(p.age * 3 + p.r * 5) * 4 + p.drift) * dt
      if (p.age >= p.life) this.smoke.splice(i, 1)
    }
    // 落叶
    for (let i = this.leaves.length - 1; i >= 0; i--) {
      const l = this.leaves[i]
      l.age += dt
      l.vy = Math.min(l.vy + 34 * dt, 52)
      l.vx += Math.sin(l.age * 5 + l.rot) * 22 * dt
      l.x += l.vx * dt
      l.y += l.vy * dt
      l.rot += l.vr * dt
      if (l.age >= l.life) this.leaves.splice(i, 1)
    }
    // 尘屑
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i]
      s.age += dt
      s.vy += 150 * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      if (s.age >= s.life) this.splashes.splice(i, 1)
    }
    // 跳起的鱼
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i]
      f.age += dt
      if (!f.splashed && f.age >= f.dur * 0.92) {
        f.splashed = true
        this.spawnRipple(f.x + f.dir * 20, f.y, 'click')
      }
      if (f.age >= f.dur) this.fish.splice(i, 1)
    }
    // 海豚
    for (let i = this.dolphins.length - 1; i >= 0; i--) {
      const d = this.dolphins[i]
      d.age += dt
      if (!d.entered && d.age > 0.04) {
        d.entered = true
        this.spawnSplash(d.x, d.y, 'rgba(255,255,255,0.9)', 10, 70)
      }
      if (!d.exited && d.age >= d.dur * 0.93) {
        d.exited = true
        this.spawnSplash(d.x + d.dir * 46, d.y, 'rgba(255,255,255,0.9)', 12, 80)
        this.spawnRipple(d.x + d.dir * 46, d.y, 'coast')
      }
      if (d.age >= d.dur) this.dolphins.splice(i, 1)
    }
    // 连击浮字
    for (let i = this.comboTexts.length - 1; i >= 0; i--) {
      const c = this.comboTexts[i]
      c.age += dt
      c.y -= 42 * dt
      if (c.age >= c.life) this.comboTexts.splice(i, 1)
    }
    // 音符
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i]
      n.age += dt
      n.y -= 26 * dt
      n.x += Math.sin(n.age * 3.2) * n.drift * dt
      if (n.age >= n.life) this.notes.splice(i, 1)
    }
    // 流星
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i]
      m.age += dt
      m.x += m.vx * dt
      m.y += m.vy * dt
      if (m.age >= m.life) this.meteors.splice(i, 1)
    }
    // 飞鸟
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i]
      b.x += b.vx * dt
      b.y += b.vy * dt
      const margin = 120
      if (b.x < opts.view.x0 - margin || b.x > opts.view.x1 + margin) this.birds.splice(i, 1)
    }
    // 雨（屏幕坐标系）
    this.w = opts.screenW
    this.h = opts.screenH
    const target = Math.round((opts.quality > 0.5 ? 110 : 55) * opts.rainT)
    while (this.rain.length < target) {
      this.rain.push({
        x: this.rng.range(-40, this.w + 40),
        y: this.rng.range(-this.h, 0),
        spd: this.rng.range(760, 1240),
        len: this.rng.range(13, 24)
      })
    }
    if (this.rain.length > target) this.rain.length = target
    for (const d of this.rain) {
      d.y += d.spd * dt
      d.x -= d.spd * 0.18 * dt
      if (d.y > this.h + 10) {
        d.y = this.rng.range(-60, -10)
        d.x = this.rng.range(-20, this.w + 60)
      }
    }
    // 雪（屏幕坐标系，缓落 + 横摆）
    const snowTarget = Math.round((opts.quality > 0.5 ? 90 : 45) * opts.snowT)
    while (this.snow.length < snowTarget) {
      this.snow.push({
        x: this.rng.range(-20, this.w + 20),
        y: this.rng.range(-this.h, 0),
        spd: this.rng.range(46, 96),
        sway: this.rng.range(8, 22),
        phase: this.rng.range(0, Math.PI * 2),
        size: this.rng.range(1.3, 3)
      })
    }
    if (this.snow.length > snowTarget) this.snow.length = snowTarget
    for (const f of this.snow) {
      f.y += f.spd * dt
      f.x += Math.sin(f.y * 0.02 + f.phase) * f.sway * dt
      if (f.y > this.h + 8) {
        f.y = this.rng.range(-40, -5)
        f.x = this.rng.range(-20, this.w + 20)
      }
    }
  }

  /** 世界坐标系粒子绘制（涟漪） */
  drawWorldRipplesOnly(ctx: CanvasRenderingContext2D): void {
    for (const r of this.ripples) {
      const p = r.age / r.dur
      const rr = 4 + p * r.maxR
      ctx.strokeStyle =
        r.kind === 'rain'
          ? `rgba(220,240,248,${0.4 * (1 - p)})`
          : `rgba(255,255,255,${(r.kind === 'coast' ? 0.5 : 0.65) * (1 - p)})`
      ctx.lineWidth = r.kind === 'coast' ? 2 : 1.4
      ctx.beginPath()
      ctx.ellipse(r.x, r.y, rr, rr * 0.44, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  /** 世界坐标系粒子绘制（烟、落叶、尘屑） */
  drawWorldParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.smoke) {
      const k = p.age / p.life
      ctx.fillStyle = `rgba(235,238,240,${0.34 * (1 - k)})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r + k * 5.5, 0, Math.PI * 2)
      ctx.fill()
    }
    for (const l of this.leaves) {
      const k = l.age / l.life
      ctx.save()
      ctx.translate(l.x, l.y)
      ctx.rotate(l.rot)
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1
      ctx.fillStyle = l.color
      ctx.beginPath()
      ctx.ellipse(0, 0, 2.6, 1.3, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.globalAlpha = 1
    for (const s of this.splashes) {
      const k = 1 - s.age / s.life
      ctx.fillStyle = s.color
      ctx.globalAlpha = k
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r * (0.6 + k * 0.4), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  /** 跳起的鱼（入水前的小弧线） */
  drawFish(ctx: CanvasRenderingContext2D): void {
    for (const f of this.fish) {
      const p = f.age / f.dur
      const fx = f.x + f.dir * (p - 0.5) * 40
      const fy = f.y - Math.sin(p * Math.PI) * 16
      const tilt = f.dir * (0.5 - p) * 1.4
      ctx.save()
      ctx.translate(fx, fy)
      ctx.rotate(tilt)
      ctx.fillStyle = '#3E7A8C'
      ctx.beginPath()
      ctx.ellipse(0, 0, 6, 2.4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(-5.5, 0)
      ctx.lineTo(-9, -2.6)
      ctx.lineTo(-9, 2.6)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
  }

  /** 白天的蝴蝶（在花草锚点附近飞舞） */
  drawButterflies(ctx: CanvasRenderingContext2D, t: number, dayA: number): void {
    if (dayA < 0.03) return
    for (const b of this.butterflies) {
      const x = b.ax + Math.cos(t * b.speed * 1.4 + b.phase) * b.amp * 1.3
      const y = b.ay - 6 + Math.sin(t * b.speed * 1.9 + b.phase * 2.3) * b.amp * 0.8
      const flap = Math.abs(Math.sin(t * 14 + b.phase)) * 0.85 + 0.15
      ctx.save()
      ctx.translate(x, y)
      ctx.globalAlpha = dayA * 0.9
      ctx.fillStyle = BUTTERFLY_COLORS[Math.floor(b.phase * 3) % BUTTERFLY_COLORS.length]
      ctx.beginPath()
      ctx.ellipse(-1.8, 0, 2.1 * flap, 1.5, -0.5, 0, Math.PI * 2)
      ctx.ellipse(1.8, 0, 2.1 * flap, 1.5, 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(70,50,40,0.8)'
      ctx.fillRect(-0.5, -1.6, 1, 3.2)
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }

  /** 掠过海面的飞鸟 */
  drawBirds(ctx: CanvasRenderingContext2D, t: number): void {
    if (this.birds.length === 0) return
    ctx.save()
    ctx.strokeStyle = 'rgba(24,58,76,0.55)'
    ctx.lineWidth = 1.6
    ctx.lineCap = 'round'
    for (const b of this.birds) {
      const flap = Math.sin(t * 9 + b.phase) * 2.6 * b.size
      ctx.beginPath()
      ctx.moveTo(b.x - 5 * b.size, b.y)
      ctx.quadraticCurveTo(b.x - 2.4 * b.size, b.y - 2.6 * b.size - flap, b.x, b.y)
      ctx.quadraticCurveTo(b.x + 2.4 * b.size, b.y - 2.6 * b.size - flap, b.x + 5 * b.size, b.y)
      ctx.stroke()
    }
    ctx.restore()
  }

  /** 跃出海面的海豚（大弧线 + 翻身） */
  drawDolphins(ctx: CanvasRenderingContext2D): void {
    for (const d of this.dolphins) {
      const p = d.age / d.dur
      const x = d.x + d.dir * (p - 0.5) * 92
      const y = d.y - Math.sin(p * Math.PI) * 72
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(d.dir * (p - 0.5) * Math.PI * 1.15)
      // 身体
      ctx.fillStyle = '#5E8EA0'
      ctx.beginPath()
      ctx.moveTo(-24, 2)
      ctx.quadraticCurveTo(0, -10, 24, -3)
      ctx.quadraticCurveTo(8, 7, -24, 2)
      ctx.closePath()
      ctx.fill()
      // 腹部
      ctx.fillStyle = '#C7DEE6'
      ctx.beginPath()
      ctx.moveTo(-20, 3)
      ctx.quadraticCurveTo(0, 7, 20, -1)
      ctx.quadraticCurveTo(0, 8, -20, 3)
      ctx.closePath()
      ctx.fill()
      // 背鳍
      ctx.fillStyle = '#4E7888'
      ctx.beginPath()
      ctx.moveTo(-4, -6)
      ctx.quadraticCurveTo(2, -16, 8, -7)
      ctx.closePath()
      ctx.fill()
      // 尾鳍
      ctx.beginPath()
      ctx.moveTo(-24, 2)
      ctx.lineTo(-32, -6)
      ctx.lineTo(-29, 3)
      ctx.lineTo(-33, 9)
      ctx.closePath()
      ctx.fill()
      // 眼睛
      ctx.fillStyle = '#16323E'
      ctx.beginPath()
      ctx.arc(17, -3, 1.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  /** 连击浮字 */
  drawComboTexts(ctx: CanvasRenderingContext2D): void {
    for (const c of this.comboTexts) {
      const k = c.age / c.life
      ctx.save()
      ctx.globalAlpha = k < 0.75 ? 1 : (1 - k) / 0.25
      ctx.translate(c.x, c.y)
      ctx.scale(1 + 0.15 * Math.min(1, k * 4), 1 + 0.15 * Math.min(1, k * 4))
      ctx.font = '700 26px "PingFang SC","Microsoft YaHei",sans-serif'
      ctx.textAlign = 'center'
      ctx.lineWidth = 4
      ctx.strokeStyle = 'rgba(20,45,60,0.75)'
      ctx.strokeText(c.text, 0, 0)
      ctx.fillStyle = '#FFE9B8'
      ctx.fillText(c.text, 0, 0)
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }

  /** 夜空流星（屏幕空间，发光通道） */
  drawMeteors(ctx: CanvasRenderingContext2D): void {
    if (this.meteors.length === 0) return
    ctx.save()
    ctx.lineCap = 'round'
    for (const m of this.meteors) {
      const k = 1 - m.age / m.life
      const tail = 0.09
      const tx = m.x - m.vx * tail
      const ty = m.y - m.vy * tail
      const g = ctx.createLinearGradient(m.x, m.y, tx, ty)
      g.addColorStop(0, `rgba(255,250,230,${0.9 * k})`)
      g.addColorStop(1, 'rgba(255,250,230,0)')
      ctx.strokeStyle = g
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.moveTo(m.x, m.y)
      ctx.lineTo(tx, ty)
      ctx.stroke()
      ctx.fillStyle = `rgba(255,255,245,${k})`
      ctx.beginPath()
      ctx.arc(m.x, m.y, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  /** 岛屿之歌的音符（发光通道） */
  drawNotes(ctx: CanvasRenderingContext2D): void {
    if (this.notes.length === 0) return
    ctx.save()
    ctx.textAlign = 'center'
    for (const n of this.notes) {
      const k = n.age / n.life
      const a = k < 0.2 ? k / 0.2 : (1 - k) / 0.8
      ctx.globalAlpha = a * 0.9
      ctx.fillStyle = '#FFE9B8'
      ctx.font = `${15 + Math.sin(n.age * 4) * 1.5}px "PingFang SC",sans-serif`
      ctx.fillText(k < 0.5 ? '♪' : '♫', n.x, n.y)
    }
    ctx.restore()
    ctx.globalAlpha = 1
  }

  /** 萤火虫（夜）——发光通道 */
  drawFireflies(ctx: CanvasRenderingContext2D, t: number, nightT: number): void {
    if (nightT < 0.05) return
    for (const f of this.fireflies) {
      const x = f.ax + Math.cos(t * f.speed + f.phase) * f.amp
      const y = f.ay + Math.sin(t * f.speed * 1.31 + f.phase * 2) * f.amp * 0.6
      const pulse = 0.35 + 0.65 * Math.pow(Math.sin(t * 2.1 + f.phase * 3) * 0.5 + 0.5, 2)
      const a = pulse * nightT
      const g = ctx.createRadialGradient(x, y, 0, x, y, 7)
      g.addColorStop(0, `rgba(255,239,175,${0.75 * a})`)
      g.addColorStop(1, 'rgba(255,239,175,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - 7, y - 7, 14, 14)
      ctx.fillStyle = `rgba(255,250,220,${a})`
      ctx.beginPath()
      ctx.arc(x, y, 1.3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /** 雪幕（屏幕坐标系） */
  drawSnow(ctx: CanvasRenderingContext2D): void {
    if (this.snow.length === 0) return
    ctx.save()
    ctx.fillStyle = 'rgba(250,252,255,0.9)'
    for (const f of this.snow) {
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  /** 雨幕（屏幕坐标系） */
  drawRain(ctx: CanvasRenderingContext2D): void {
    if (this.rain.length === 0) return
    ctx.save()
    ctx.strokeStyle = 'rgba(205,228,240,0.34)'
    ctx.lineWidth = 1.1
    ctx.beginPath()
    for (const d of this.rain) {
      ctx.moveTo(d.x, d.y)
      ctx.lineTo(d.x + d.len * 0.18, d.y - d.len)
    }
    ctx.stroke()
    ctx.restore()
  }
}

/** 为萤火虫挑选岛内的栖息点 */
export function pickFireflyAnchors(
  outline: Array<{ x: number; y: number }>,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  seed: number,
  count = 14
): Pt[] {
  const rng = new R(seed ^ 0x5eed)
  const out: Pt[] = []
  for (let i = 0; i < count * 30 && out.length < count; i++) {
    const p = { x: rng.range(bbox.minX, bbox.maxX), y: rng.range(bbox.minY, bbox.maxY) }
    if (pointInPolygon(p, outline)) out.push(p)
  }
  return out
}
