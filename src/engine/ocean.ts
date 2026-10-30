import type { TimeOfDay, Weather } from '../types'
import { lerp } from './easings'

export interface EnvSnapshot {
  timeOfDay: TimeOfDay
  weather: Weather
  nightT: number
  rainT: number
  duskT: number
}

let gradCache: { w: number; h: number; grad: CanvasGradient } | null = null

/** 海洋底色 + 缓慢流动的波纹 + 碎光（屏幕坐标系） */
export function drawOcean(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  quality: number,
  env: EnvSnapshot
): void {
  if (!gradCache || gradCache.w !== w || gradCache.h !== h) {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#0E5C74')
    g.addColorStop(0.45, '#2E97AC')
    g.addColorStop(1, '#57C0D2')
    gradCache = { w, h, grad: g }
  }
  ctx.fillStyle = gradCache.grad
  ctx.fillRect(0, 0, w, h)

  // 中部柔和的光斑，让海面有纵深
  const rg = ctx.createRadialGradient(w * 0.5, h * 0.52, 0, w * 0.5, h * 0.52, Math.max(w, h) * 0.55)
  rg.addColorStop(0, 'rgba(180,235,240,0.10)')
  rg.addColorStop(1, 'rgba(180,235,240,0)')
  ctx.fillStyle = rg
  ctx.fillRect(0, 0, w, h)

  const rows = quality > 0.5 ? 7 : 4
  ctx.lineWidth = 1.4
  for (let k = 0; k < rows; k++) {
    const baseY = ((k + 0.5) / rows) * h + Math.sin(t * 0.4 + k * 1.7) * 6
    const speed = 12 + k * 5
    const amp = 3 + (k % 3)
    ctx.strokeStyle = `rgba(255,255,255,${0.05 + 0.02 * (k % 3)})`
    ctx.beginPath()
    for (let x = -24; x <= w + 24; x += 22) {
      const y =
        baseY + Math.sin((x + t * speed) * 0.012 + k * 2.4) * amp + Math.sin(x * 0.03 - t * 0.7 + k) * 1.5
      if (x === -24) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  const n = quality > 0.5 ? 26 : 12
  for (let i = 0; i < n; i++) {
    const gx = (Math.sin(i * 127.1) * 0.5 + 0.5) * w
    const gy = (Math.sin(i * 311.7) * 0.5 + 0.5) * h
    const tw = Math.sin(t * (0.6 + (i % 5) * 0.13) + i * 2.1)
    if (tw > 0.25) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 * tw})`
      ctx.fillRect(gx, gy, 9 + (i % 3) * 4, 1.5)
    }
  }
  void env
}

/** 海岸泡沫：两层流动的虚线描边 */
export function drawFoam(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  t: number,
  alpha: number,
  quality: number
): void {
  if (alpha <= 0.01) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.setLineDash([46, 92])
  ctx.lineDashOffset = -t * 26
  ctx.strokeStyle = 'rgba(255,255,255,0.32)'
  ctx.lineWidth = 9
  ctx.stroke(path)
  ctx.setLineDash([22, 128])
  ctx.lineDashOffset = t * 34
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 3
  if (quality > 0.5) {
    ctx.shadowColor = 'rgba(255,255,255,0.9)'
    ctx.shadowBlur = 6
  }
  ctx.stroke(path)
  ctx.restore()
}

/** 白天阳光光晕 / 黄昏夕阳 / 夜晚月亮与月光反射 */
export function drawSkyLight(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  nightT: number,
  duskT = 0
): void {
  if (nightT < 0.98) {
    // 白天太阳偏左上；黄昏移向中上并染成夕阳金
    const sx = w * lerp(0.18, 0.5, duskT)
    const sy = h * lerp(0.12, 0.3, duskT)
    const warm = duskT > 0.02
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(w, h) * 0.55)
    g.addColorStop(0, warm ? `rgba(255,178,102,${(0.3 * (1 - nightT) * (0.6 + 0.4 * duskT)).toFixed(3)})` : `rgba(255,236,180,${0.2 * (1 - nightT)})`)
    g.addColorStop(1, 'rgba(255,220,160,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  if (nightT < 0.02) return
  const mx = w * 0.8
  const my = h * 0.14
  const halo = ctx.createRadialGradient(mx, my, 0, mx, my, 90)
  halo.addColorStop(0, `rgba(230,240,255,${0.5 * nightT})`)
  halo.addColorStop(0.25, `rgba(210,228,255,${0.22 * nightT})`)
  halo.addColorStop(1, 'rgba(210,228,255,0)')
  ctx.fillStyle = halo
  ctx.fillRect(mx - 100, my - 100, 200, 200)
  ctx.fillStyle = `rgba(245,248,255,${0.92 * nightT})`
  ctx.beginPath()
  ctx.arc(mx, my, 20, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = `rgba(210,224,245,${0.5 * nightT})`
  ctx.beginPath()
  ctx.arc(mx - 6, my - 4, 4, 0, Math.PI * 2)
  ctx.arc(mx + 7, my + 5, 3, 0, Math.PI * 2)
  ctx.fill()
  // 月光在海面的碎金
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 9; i++) {
    const yy = my + 60 + i * (h - my) * 0.09
    const spread = 26 + i * 9
    const wob = Math.sin(t * 1.3 + i * 1.9) * spread * 0.35
    const len = 26 + ((i * 13) % 22)
    ctx.fillStyle = `rgba(214,228,255,${(0.14 - i * 0.012) * nightT})`
    ctx.fillRect(mx - len / 2 + wob, yy, len, 2.2)
  }
  ctx.restore()
}

/** 夜幕/雨幕/暮色/雪意压暗叠层 */
export function drawMoodTint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  nightT: number,
  rainT: number,
  duskT = 0,
  snowT = 0
): void {
  if (snowT > 0.01) {
    // 雪天：整体泛冷白
    ctx.fillStyle = `rgba(205,226,238,${0.16 * snowT})`
    ctx.fillRect(0, 0, w, h)
  }
  if (duskT > 0.01) {
    ctx.fillStyle = `rgba(247,150,80,${0.14 * duskT})`
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = `rgba(150,70,90,${0.1 * duskT})`
    ctx.fillRect(0, 0, w, h)
  }
  if (nightT > 0.01) {
    ctx.fillStyle = `rgba(16,26,58,${0.42 * nightT})`
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = `rgba(30,40,90,${0.18 * nightT})`
    ctx.fillRect(0, 0, w, h)
  }
  if (rainT > 0.01) {
    ctx.fillStyle = `rgba(38,60,78,${0.2 * rainT})`
    ctx.fillRect(0, 0, w, h)
  }
}

/** 雨后彩虹（屏幕空间）：七色拱弧 */
export function drawRainbow(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number): void {
  if (alpha <= 0.01) return
  const cx = w / 2
  const cy = h * 1.06
  const colors = ['#E85A5A', '#F0944C', '#F2D45C', '#7CC08F', '#5FA8D8', '#5F6FD8', '#9A6FD8']
  ctx.save()
  ctx.globalAlpha = alpha * 0.42
  ctx.lineCap = 'butt'
  const r0 = Math.min(w, h) * 0.72
  for (let i = 0; i < colors.length; i++) {
    ctx.strokeStyle = colors[i]
    ctx.lineWidth = 11
    ctx.beginPath()
    ctx.arc(cx, cy, r0 + i * 11, Math.PI * 1.08, Math.PI * 1.92)
    ctx.stroke()
  }
  ctx.restore()
}

let vignetteCache: { w: number; h: number; grad: CanvasGradient } | null = null
export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (!vignetteCache || vignetteCache.w !== w || vignetteCache.h !== h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78)
    g.addColorStop(0, 'rgba(10,30,44,0)')
    g.addColorStop(1, 'rgba(10,30,44,0.2)')
    vignetteCache = { w, h, grad: g }
  }
  ctx.fillStyle = vignetteCache.grad
  ctx.fillRect(0, 0, w, h)
}
