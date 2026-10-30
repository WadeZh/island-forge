/** 可复现伪随机数：mulberry32 */
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 常用随机工具封装，保证同一整套流程共用一个种子流 */
export class R {
  rng: Rng
  constructor(seed: number) {
    this.rng = mulberry32(seed)
  }
  next(): number {
    return this.rng()
  }
  range(min: number, max: number): number {
    return min + this.rng() * (max - min)
  }
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }
  chance(p: number): boolean {
    return this.rng() < p
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.rng() * arr.length) % arr.length]
  }
  shuffle<T>(arr: T[]): T[] {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
}

/** 坐标量化指纹：同一路径 → 同一种子 */
export function hashPoints(points: Array<{ x: number; y: number }>): number {
  let h = 0x811c9dc5
  for (const p of points) {
    const x = Math.round(p.x * 2)
    const y = Math.round(p.y * 2)
    h ^= x & 0xffff
    h = Math.imul(h, 0x01000193)
    h ^= y & 0xffff
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
