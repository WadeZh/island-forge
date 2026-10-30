import type { IslandData, Poly, Pt } from '../types'
import { polygonBBox, polygonCentroid } from '../geometry/poly'
import { validateOutline } from '../geometry/outline'

/**
 * 岛屿代码：把轮廓压缩成一串可粘贴的短代码，朋友输入即可拜访。
 * 无服务器：代码本身就是全部数据。量化精度 10bit（±512，呼应 1024）。
 */

const VERSION = 1
const POINTS = 36
const QMAX = 512
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
export const MAX_NAME_LEN = 12
export const MAX_CODE_LEN = 220

export interface DecodedIsland {
  outline: Poly
  name: string
  grade: string
  createdAt: number
}

// ---------- 位流 ----------

class BitWriter {
  private bits: number[] = []
  write(value: number, count: number): void {
    for (let i = count - 1; i >= 0; i--) this.bits.push((value >> i) & 1)
  }
  toBytes(): Uint8Array {
    const bytes = new Uint8Array(Math.ceil(this.bits.length / 8))
    for (let i = 0; i < this.bits.length; i++) {
      if (this.bits[i]) bytes[i >> 3] |= 0x80 >> (i & 7)
    }
    return bytes
  }
}

class BitReader {
  pos = 0
  constructor(private bytes: Uint8Array, private count: number) {}
  read(count: number): number {
    let v = 0
    for (let i = 0; i < count; i++) {
      const idx = this.pos >> 3
      if (idx >= this.bytes.length) throw new Error('truncated')
      const bit = (this.bytes[idx] >> (7 - (this.pos & 7))) & 1
      v = (v << 1) | bit
      this.pos++
    }
    return v
  }
  get remaining(): number {
    return this.count - this.pos
  }
}

function zigzag(v: number): number {
  return v >= 0 ? v * 2 : -v * 2 - 1
}
function unzigzag(v: number): number {
  return v & 1 ? -(v + 1) / 2 : v / 2
}

function bytesToCode(bytes: Uint8Array): string {
  let out = ''
  let acc = 0
  let accBits = 0
  for (const b of bytes) {
    acc = (acc << 8) | b
    accBits += 8
    while (accBits >= 6) {
      accBits -= 6
      out += CODE_ALPHABET[(acc >> accBits) & 63]
    }
  }
  if (accBits > 0) out += CODE_ALPHABET[(acc << (6 - accBits)) & 63]
  return out
}

function codeToBytes(code: string): { bytes: Uint8Array; bitCount: number } {
  const bits: number[] = []
  for (const ch of code) {
    const v = CODE_ALPHABET.indexOf(ch)
    if (v < 0) throw new Error('bad char')
    for (let i = 5; i >= 0; i--) bits.push((v >> i) & 1)
  }
  const bytes = new Uint8Array(Math.ceil(bits.length / 8))
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) bytes[i >> 3] |= 0x80 >> (i & 7)
  }
  return { bytes, bitCount: bits.length }
}

function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

function dayNumber(ts: number): number {
  return Math.max(0, Math.min(16383, Math.floor(ts / 86400000) - 20638)) // 自 2026-01-01 起
}

function dateFromDayNumber(d: number): number {
  return (20638 + d) * 86400000
}

// ---------- 编码 ----------

const GRADE_TO_INDEX: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 }
const INDEX_TO_GRADE = ['S', 'A', 'B', 'C']

/** 轮廓均匀重采样并归一化量化为整数点，同时返回最大半径 */
function quantizeOutline(outline: Poly): { pts: Array<{ x: number; y: number }>; maxR: number } {
  const centroid = polygonCentroid(outline)
  let perimeter = 0
  const segs: number[] = []
  const n = outline.length
  for (let i = 0; i < n; i++) {
    const a = outline[i]
    const b = outline[(i + 1) % n]
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    segs.push(d)
    perimeter += d
  }
  const pts: Array<{ x: number; y: number }> = []
  let maxR = 1e-6
  for (let k = 0; k < POINTS; k++) {
    let target = (k / POINTS) * perimeter
    let i = 0
    while (i < n - 1 && target > segs[i]) {
      target -= segs[i]
      i++
    }
    const a = outline[i]
    const b = outline[(i + 1) % n]
    const t = segs[i] > 0 ? target / segs[i] : 0
    const x = a.x + (b.x - a.x) * t
    const y = a.y + (b.y - a.y) * t
    maxR = Math.max(maxR, Math.hypot(x - centroid.x, y - centroid.y))
    pts.push({ x: x - centroid.x, y: y - centroid.y })
  }
  return {
    pts: pts.map((p) => ({
      x: Math.round((p.x / maxR) * QMAX),
      y: Math.round((p.y / maxR) * QMAX)
    })),
    maxR
  }
}

export function encodeIslandCode(island: IslandData): string {
  const { pts: q, maxR } = quantizeOutline(island.outline)
  const w = new BitWriter()
  w.write(VERSION, 4)
  w.write(GRADE_TO_INDEX[island.grade] ?? 3, 2)
  w.write(dayNumber(island.createdAt), 14)
  w.write(Math.max(40, Math.min(1023, Math.round(maxR))), 10)
  const nameBytes = utf8Bytes(island.name.slice(0, MAX_NAME_LEN))
  w.write(nameBytes.length, 5)
  for (const b of nameBytes) w.write(b, 8)
  // 坐标：从 (0,0) 起全程 zigzag 差分（12bit，±2047，覆盖相邻采样点最大跳变）
  let lx = 0
  let ly = 0
  for (const p of q) {
    const dx = Math.max(-2047, Math.min(2047, p.x - lx))
    const dy = Math.max(-2047, Math.min(2047, p.y - ly))
    w.write(zigzag(dx), 12)
    w.write(zigzag(dy), 12)
    lx = p.x
    ly = p.y
  }
  return bytesToCode(w.toBytes())
}

// ---------- 解码 ----------

export function decodeIslandCode(codeRaw: string): DecodedIsland | null {
  const code = codeRaw.trim().replace(/\s+/g, '')
  if (!code || code.length > MAX_CODE_LEN) return null
  try {
    const { bytes, bitCount } = codeToBytes(code)
    const need = 4 + 2 + 14 + 10 + 5 + POINTS * 24
    const nameLen = (() => {
      const r = new BitReader(bytes, bitCount)
      r.read(4)
      r.read(2)
      r.read(14)
      r.read(10)
      return r.read(5)
    })()
    if (bitCount < need + nameLen * 8) return null
    const r = new BitReader(bytes, bitCount)
    if (r.read(4) !== VERSION) return null
    const grade = INDEX_TO_GRADE[r.read(2)]
    const createdAt = dateFromDayNumber(r.read(14))
    const maxR = Math.max(40, r.read(10))
    const nameLen2 = r.read(5)
    const nameBytes = new Uint8Array(nameLen2)
    for (let i = 0; i < nameLen2; i++) nameBytes[i] = r.read(8)
    const name = new TextDecoder().decode(nameBytes)

    const pts: Pt[] = []
    let px = 0
    let py = 0
    for (let i = 0; i < POINTS; i++) {
      px += unzigzag(r.read(12))
      py += unzigzag(r.read(12))
      pts.push({ x: px, y: py })
    }
    if (pts.some((p) => Math.abs(p.x) > QMAX || Math.abs(p.y) > QMAX)) return null
    // 按编码时记录的最大半径还原原始尺寸
    const SCALE = maxR / QMAX
    const poly: Poly = pts.map((p) => ({ x: p.x * SCALE, y: p.y * SCALE }))
    const bb = polygonBBox(poly)
    const valid = validateOutline(poly)
    if (!valid.ok || !valid.poly) return null
    // 居中
    const bb2 = polygonBBox(valid.poly)
    const cx = (bb2.minX + bb2.maxX) / 2
    const cy = (bb2.minY + bb2.maxY) / 2
    const outline = valid.poly.map((p) => ({ x: p.x + 600 - cx, y: p.y + 400 - cy }))
    void bb
    return { outline, name: name.slice(0, MAX_NAME_LEN), grade, createdAt }
  } catch {
    return null
  }
}
