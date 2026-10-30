import type { IslandEntity } from '../types'
import type { EnvSnapshot } from './ocean'
import { C } from './colors'
import { drawFlower } from './terrain'

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function shadow(ctx: CanvasRenderingContext2D, e: IslandEntity, rx: number, ry: number, dx = 3, dy = 4): void {
  ctx.fillStyle = 'rgba(20,40,30,0.2)'
  ctx.beginPath()
  ctx.ellipse(dx * e.size, dy * e.size, rx * e.size, ry * e.size, 0, 0, Math.PI * 2)
  ctx.fill()
}

const OUTFITS = ['#E86A5E', '#5FA8D8', '#F2C14E', '#8FBF7F', '#C98BD9']

function drawVillager(ctx: CanvasRenderingContext2D, e: IslandEntity, t: number, s: number): void {
  const walking = e.idleT === undefined || e.idleT <= 0
  const bob = walking ? Math.abs(Math.sin(t * 7 + e.phase)) * 1.6 : Math.sin(t * 1.6 + e.phase) * 0.5
  ctx.save()
  ctx.globalAlpha = e.alpha ?? 1
  ctx.scale(s, s)
  ctx.translate(0, -bob)
  // 影子（不随起伏）
  ctx.fillStyle = 'rgba(20,40,30,0.22)'
  ctx.beginPath()
  ctx.ellipse(0, bob + 1, 5.5, 2.2, 0, 0, Math.PI * 2)
  ctx.fill()
  // 身体
  ctx.fillStyle = OUTFITS[e.outfit ?? 0]
  rrect(ctx, -3.4, -8.5, 6.8, 9, 3)
  ctx.fill()
  // 头
  ctx.fillStyle = '#F2C9A0'
  ctx.beginPath()
  ctx.arc(0, -11.5, 3.4, 0, Math.PI * 2)
  ctx.fill()
  // 点睛
  ctx.fillStyle = '#33231C'
  ctx.beginPath()
  ctx.arc(-1.1, -12, 0.55, 0, Math.PI * 2)
  ctx.arc(1.4, -12, 0.55, 0, Math.PI * 2)
  ctx.fill()
  if (e.role === 'fisher') {
    // 斗笠
    ctx.fillStyle = '#C9A86B'
    ctx.beginPath()
    ctx.moveTo(-5, -13.4)
    ctx.lineTo(0, -18)
    ctx.lineTo(5, -13.4)
    ctx.closePath()
    ctx.fill()
    // 鱼竿与线（朝码头外）
    ctx.strokeStyle = '#6E4A2E'
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.moveTo(2, -6)
    ctx.quadraticCurveTo(10, -14, 15, -9)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(235,245,250,0.65)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(15, -9)
    ctx.lineTo(15.5, 2 + Math.sin(t * 2 + e.phase) * 0.8)
    ctx.stroke()
    // 浮标
    ctx.fillStyle = '#E86A5E'
    ctx.beginPath()
    ctx.arc(15.5, 2.6 + Math.sin(t * 2 + e.phase) * 0.8, 1.1, 0, Math.PI * 2)
    ctx.fill()
  } else if (e.variant === 1) {
    // 小草帽
    ctx.fillStyle = '#E7D8A8'
    ctx.beginPath()
    ctx.ellipse(0, -13.6, 5, 1.6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, -14.2, 2.6, Math.PI, 0)
    ctx.fill()
  }
  ctx.restore()
  ctx.globalAlpha = 1
}

/** 玩家手种的花（世界空间，带出生弹跳） */
export function drawPlantedFlower(ctx: CanvasRenderingContext2D, f: { x: number; y: number; color: string }, scale: number): void {
  ctx.save()
  ctx.translate(f.x, f.y)
  ctx.scale(scale, scale)
  drawFlower(ctx, 0, 0, f.color, 1.15)
  ctx.restore()
}

/** 漂流瓶（玻璃瓶 + 软木塞 + 卷起的信） */
function drawBottle(ctx: CanvasRenderingContext2D, e: IslandEntity, t: number, s: number): void {
  const bob = Math.sin(t * 1.8 + e.phase) * 1.6
  ctx.save()
  ctx.translate(e.x, e.y)
  ctx.rotate(Math.sin(t * 1.2 + e.phase) * 0.3 + 0.3)
  ctx.translate(0, bob)
  ctx.scale(s, s)
  // 水影
  ctx.fillStyle = 'rgba(10,40,55,0.22)'
  ctx.beginPath()
  ctx.ellipse(0, 4, 8, 2.4, 0, 0, Math.PI * 2)
  ctx.fill()
  // 瓶身
  ctx.fillStyle = 'rgba(170,220,205,0.88)'
  rrect(ctx, -4, -7.5, 8, 13, 3.4)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(-2.2, -5)
  ctx.lineTo(-2.2, 3)
  ctx.stroke()
  // 信纸
  ctx.fillStyle = '#F2E4BC'
  rrect(ctx, -2.4, -3.5, 4.8, 7.5, 1)
  ctx.fill()
  // 瓶口与木塞
  ctx.fillStyle = 'rgba(140,190,175,0.9)'
  rrect(ctx, -2.6, -10, 5.2, 3.2, 1.2)
  ctx.fill()
  ctx.fillStyle = '#B98A5A'
  rrect(ctx, -2, -12.2, 4, 2.8, 1.2)
  ctx.fill()
  ctx.restore()
}

/** 主绘制通道：实体的身体（受昼夜压暗影响） */
export function drawEntity(
  ctx: CanvasRenderingContext2D,
  e: IslandEntity,
  t: number,
  env: EnvSnapshot,
  bornScale: number
): void {
  const s = e.size * bornScale * (1 + e.pop * 0.16) * (1 + e.hoverT * 0.05)
  if (s <= 0.001) return
  ctx.save()
  ctx.translate(e.x, e.y)
  switch (e.kind) {
    case 'tree':
      drawTree(ctx, e, t, s)
      break
    case 'house':
      drawHouse(ctx, e, t, s, env)
      break
    case 'windmill':
      drawWindmill(ctx, e, t, s)
      break
    case 'lighthouse':
      drawLighthouse(ctx, e, t, s, env)
      break
    case 'rock':
      drawRock(ctx, e, t, s)
      break
    case 'boat':
      drawBoat(ctx, e, t, s, env)
      break
    case 'dock':
      drawDock(ctx, e, t, s)
      break
    case 'villager':
      drawVillager(ctx, e, t, s)
      break
    case 'bottle':
      drawBottle(ctx, e, t, s)
      break
  }
  ctx.restore()
}

function drawTree(ctx: CanvasRenderingContext2D, e: IslandEntity, t: number, s: number): void {
  shadow(ctx, e, e.r * 0.85, e.r * 0.36)
  const sway = Math.sin(t * 1.4 + e.phase) * 0.05 + e.pop * Math.sin(t * 18) * 0.06
  ctx.rotate(sway)
  ctx.fillStyle = C.trunk
  rrect(ctx, -2.4 * s, -8 * s, 4.8 * s, 10 * s, 2 * s)
  ctx.fill()
  if (e.variant === 2) {
    // 松树
    ctx.fillStyle = C.forestDark
    tri(ctx, 13 * s, -3 * s, -26 * s)
    ctx.fillStyle = C.forest
    tri(ctx, 10 * s, -14 * s, -34 * s)
    ctx.fillStyle = C.forestMid
    tri(ctx, 7 * s, -24 * s, -41 * s)
    ctx.fillStyle = 'rgba(200,235,205,0.5)'
    ctx.beginPath()
    ctx.moveTo(-2 * s, -30 * s)
    ctx.lineTo(-4.5 * s, -36 * s)
    ctx.lineTo(-1 * s, -36 * s)
    ctx.closePath()
    ctx.fill()
  } else {
    ctx.fillStyle = C.forest
    ctx.beginPath()
    ctx.arc(0, -17 * s, 11.5 * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = C.forestDark
    ctx.beginPath()
    ctx.arc(7 * s, -13 * s, 8.5 * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = C.forestMid
    ctx.beginPath()
    ctx.arc(-7 * s, -13 * s, 8 * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(160,220,170,0.75)'
    ctx.beginPath()
    ctx.arc(-3.5 * s, -21 * s, 4.6 * s, 0, Math.PI * 2)
    ctx.fill()
    if (e.variant === 1) {
      ctx.fillStyle = '#E86A5E'
      for (const [fx, fy] of [
        [5, -19],
        [-8, -15],
        [1, -10]
      ]) {
        ctx.beginPath()
        ctx.arc(fx * s, fy * s, 1.5 * s, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

function tri(ctx: CanvasRenderingContext2D, halfW: number, y0: number, y1: number): void {
  ctx.beginPath()
  ctx.moveTo(-halfW, y0)
  ctx.quadraticCurveTo(0, y0 - halfW * 0.25, halfW, y0)
  ctx.lineTo(0, y1)
  ctx.closePath()
  ctx.fill()
}

function drawHouse(ctx: CanvasRenderingContext2D, e: IslandEntity, t: number, s: number, env: EnvSnapshot): void {
  shadow(ctx, e, 20, 8.5, 4, 5)
  ctx.save()
  ctx.scale(s, s)
  // 墙体
  ctx.fillStyle = C.wood
  rrect(ctx, -14, -14, 28, 14, 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(60,35,20,0.18)'
  ctx.fillRect(-14, -3, 28, 3)
  // 门
  ctx.fillStyle = C.woodDark
  rrect(ctx, -4.5, -7, 9, 7, 3)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,220,150,0.5)'
  ctx.beginPath()
  ctx.arc(2.6, -3.5, 0.7, 0, Math.PI * 2)
  ctx.fill()
  // 屋顶
  ctx.fillStyle = e.variant === 1 ? '#8F6B4A' : C.roof
  ctx.beginPath()
  ctx.moveTo(-17, -13)
  ctx.quadraticCurveTo(0, -15.5, 17, -13)
  ctx.lineTo(0, -27)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = e.variant === 1 ? 'rgba(255,235,200,0.4)' : C.roofLight
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(-10, -19)
  ctx.lineTo(0, -25.4)
  ctx.lineTo(10, -19)
  ctx.stroke()
  // 烟囱
  ctx.fillStyle = C.stoneDark
  ctx.fillRect(7.5, -24.5, 4.5, 6.5)
  ctx.fillRect(6.8, -25.3, 5.9, 1.8)
  // 窗户（黄昏起即亮）
  const lit = e.lightsOn || env.nightT > 0.5 || (env.duskT ?? 0) > 0.55
  for (const wx of [-10.5, 5.5]) {
    ctx.fillStyle = lit ? C.windowLit : '#57808F'
    rrect(ctx, wx, -11, 5, 5, 1)
    ctx.fill()
    ctx.strokeStyle = 'rgba(90,55,30,0.8)'
    ctx.lineWidth = 0.8
    rrect(ctx, wx, -11, 5, 5, 1)
    ctx.stroke()
  }
  ctx.restore()
  void t
}

function drawWindmill(ctx: CanvasRenderingContext2D, e: IslandEntity, t: number, s: number): void {
  shadow(ctx, e, 15, 7, 4, 5)
  ctx.save()
  ctx.scale(s, s)
  // 塔身
  ctx.fillStyle = C.stone
  ctx.beginPath()
  ctx.moveTo(-9, 0)
  ctx.lineTo(-5.5, -30)
  ctx.lineTo(5.5, -30)
  ctx.lineTo(9, 0)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(120,100,70,0.35)'
  ctx.lineWidth = 1
  ctx.stroke()
  // 门
  ctx.fillStyle = C.woodDark
  rrect(ctx, -3, -7, 6, 7, 2.5)
  ctx.fill()
  // 顶帽
  ctx.fillStyle = C.woodDark
  ctx.beginPath()
  ctx.arc(0, -30, 6.2, Math.PI, 0)
  ctx.closePath()
  ctx.fill()
  // 叶片（角度由场景按角速度累积，避免变速时跳变）
  const angle = e.phase
  ctx.translate(0, -30)
  for (let k = 0; k < 4; k++) {
    ctx.save()
    ctx.rotate(angle + (k * Math.PI) / 2)
    ctx.fillStyle = '#F5EEDC'
    rrect(ctx, 2.5, -2.1, 23, 4.2, 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(120,100,70,0.4)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(6, 0)
    ctx.lineTo(22, 0)
    ctx.stroke()
    ctx.restore()
  }
  ctx.fillStyle = C.wood
  ctx.beginPath()
  ctx.arc(0, 0, 2.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawLighthouse(ctx: CanvasRenderingContext2D, e: IslandEntity, t: number, s: number, env: EnvSnapshot): void {
  shadow(ctx, e, 13, 6.5, 4, 5)
  ctx.save()
  ctx.scale(s, s)
  ctx.fillStyle = '#F4F1E8'
  ctx.beginPath()
  ctx.moveTo(-8, 0)
  ctx.lineTo(-5.5, -30)
  ctx.lineTo(5.5, -30)
  ctx.lineTo(8, 0)
  ctx.closePath()
  ctx.fill()
  // 红条纹
  ctx.save()
  ctx.clip()
  ctx.fillStyle = '#D95B4E'
  ctx.fillRect(-8, -21, 16, 5)
  ctx.fillRect(-8, -10.5, 16, 5)
  ctx.restore()
  // 灯室
  ctx.fillStyle = C.stoneDark
  ctx.fillRect(-6.5, -35, 13, 4.5)
  ctx.fillStyle = env.nightT > 0.5 || e.lightsOn ? C.windowLit : '#AECBD4'
  rrect(ctx, -4, -43, 8, 8, 1.5)
  ctx.fill()
  ctx.fillStyle = '#D95B4E'
  ctx.beginPath()
  ctx.arc(0, -43, 4.8, Math.PI, 0)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  void t
}

function drawRock(ctx: CanvasRenderingContext2D, e: IslandEntity, t: number, s: number): void {
  ctx.save()
  ctx.rotate(e.wobble > 0 ? Math.sin(t * 22) * 0.09 * e.wobble : 0)
  shadow(ctx, e, e.r * 0.9, e.r * 0.4, 2, 3)
  ctx.scale(s, s)
  ctx.fillStyle = C.rock
  ctx.beginPath()
  ctx.ellipse(0, -3, 8.5, 6.2, 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = C.rockDark
  ctx.beginPath()
  ctx.ellipse(e.variant === 1 ? -6 : 6, -1.5, 4.5, 3.4, 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = C.rockLight
  ctx.beginPath()
  ctx.ellipse(-2.2, -5.6, 3.6, 2, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawDock(ctx: CanvasRenderingContext2D, e: IslandEntity, t: number, s: number): void {
  const bob = Math.sin(t * 1.3 + e.phase) * 0.8
  ctx.save()
  ctx.translate(e.x, e.y)
  ctx.rotate(e.phase)
  ctx.translate(0, bob)
  ctx.scale(s, s)
  // 桩柱
  ctx.fillStyle = '#6E4A2E'
  for (const px of [-15, 0, 15]) {
    ctx.beginPath()
    ctx.arc(px, -5.5, 2.1, 0, Math.PI * 2)
    ctx.arc(px, 5.5, 2.1, 0, Math.PI * 2)
    ctx.fill()
  }
  // 板面
  ctx.fillStyle = C.wood
  rrect(ctx, -19, -5.5, 38, 11, 3)
  ctx.fill()
  ctx.strokeStyle = 'rgba(90,55,30,0.45)'
  ctx.lineWidth = 0.8
  for (let px = -14; px <= 14; px += 6.5) {
    ctx.beginPath()
    ctx.moveTo(px, -4.6)
    ctx.lineTo(px, 4.6)
    ctx.stroke()
  }
  ctx.restore()
}

function drawBoat(ctx: CanvasRenderingContext2D, e: IslandEntity, t: number, s: number, env: EnvSnapshot): void {
  const bob = Math.sin(t * 1.6 + e.phase) * 1.8 + e.bobBoost * Math.sin(t * 9) * 3.2
  const tilt = Math.sin(t * 1.1 + e.phase) * 0.06 + e.bobBoost * Math.sin(t * 7) * 0.09
  ctx.save()
  ctx.rotate(tilt)
  ctx.translate(0, bob)
  ctx.scale(s, s)
  // 船影
  ctx.fillStyle = 'rgba(10,40,55,0.25)'
  ctx.beginPath()
  ctx.ellipse(0, 4.5, 13, 3.4, 0, 0, Math.PI * 2)
  ctx.fill()
  // 船身
  ctx.fillStyle = C.wood
  ctx.beginPath()
  ctx.moveTo(-13, -2)
  ctx.quadraticCurveTo(0, 1.5, 13, -2)
  ctx.quadraticCurveTo(9, 5, 0, 5.5)
  ctx.quadraticCurveTo(-9, 5, -13, -2)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = C.woodDark
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(-11.5, -0.5)
  ctx.quadraticCurveTo(0, 2.6, 11.5, -0.5)
  ctx.stroke()
  // 桅杆与帆
  ctx.strokeStyle = C.woodDark
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(0, -1.5)
  ctx.lineTo(0, -17)
  ctx.stroke()
  ctx.fillStyle = '#FFF6E4'
  ctx.beginPath()
  ctx.moveTo(1, -16.5)
  ctx.quadraticCurveTo(11, -10, 9.5, -3)
  ctx.lineTo(1, -3)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(150,130,100,0.4)'
  ctx.lineWidth = 0.7
  ctx.stroke()
  ctx.fillStyle = '#E86A5E'
  ctx.beginPath()
  ctx.moveTo(0, -17)
  ctx.lineTo(-4.5, -15)
  ctx.lineTo(0, -13)
  ctx.closePath()
  ctx.fill()
  // 夜间小灯
  if (env.nightT > 0.5) {
    ctx.fillStyle = C.windowLit
    ctx.beginPath()
    ctx.arc(-3, 1, 1.1, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** 灯光通道：在夜幕压暗之后绘制，保证发光不被变暗 */
export function drawEntityGlow(
  ctx: CanvasRenderingContext2D,
  e: IslandEntity,
  t: number,
  env: EnvSnapshot
): void {
  const night = env.nightT
  if (night < 0.02 && !e.lightsOn) return
  ctx.save()
  ctx.translate(e.x, e.y)
  if (e.kind === 'house') {
    const lit = e.lightsOn || night > 0.5 || (env.duskT ?? 0) > 0.55
    if (lit) {
      const s = e.size
      const flicker = 0.9 + 0.1 * Math.sin(t * 6.3 + e.phase)
      for (const wx of [-8, 8]) {
        const g = ctx.createRadialGradient(wx * s, -8.5 * s, 0, wx * s, -8.5 * s, 26 * s)
        g.addColorStop(0, `rgba(255,205,110,${0.5 * flicker * Math.max(night, e.lightsOn ? 0.5 : 0)})`)
        g.addColorStop(1, 'rgba(255,205,110,0)')
        ctx.fillStyle = g
        ctx.fillRect(wx * s - 26 * s, -8.5 * s - 26 * s, 52 * s, 52 * s)
      }
    }
  } else if (e.kind === 'lighthouse') {
    const on = night > 0.5 || (env.duskT ?? 0) > 0.55 || e.lightsOn
    if (on) {
      const s = e.size
      const a = e.phase
      ctx.translate(0, -39 * s)
      for (const dir of [0, Math.PI]) {
        ctx.save()
        ctx.rotate(a + dir)
        const L = 150 * s
        const g = ctx.createLinearGradient(0, 0, L, 0)
        g.addColorStop(0, `rgba(255,235,160,${0.3 * Math.max(night, e.lightsOn ? 0.4 : 0)})`)
        g.addColorStop(1, 'rgba(255,235,160,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(L, -L * 0.16)
        ctx.lineTo(L, L * 0.16)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }
      const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, 30 * s)
      g2.addColorStop(0, `rgba(255,240,180,${0.75 * Math.max(night, 0.5)})`)
      g2.addColorStop(1, 'rgba(255,240,180,0)')
      ctx.fillStyle = g2
      ctx.fillRect(-30 * s, -30 * s, 60 * s, 60 * s)
    }
  }
  ctx.restore()
}

/** 命中半径（含手指容差） */
export function hitRadiusOf(e: IslandEntity, touch: boolean): number {
  return e.r * 1.15 + (touch ? 10 : 4)
}
