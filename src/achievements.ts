import type { EntityKind } from './types'

export interface AchievementDef {
  id: string
  name: string
  desc: string
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-island', name: '初次造岛', desc: '让第一座小岛从海里长出来' },
  { id: 'archipelago', name: '群岛开拓者', desc: '累计创造 5 座小岛' },
  { id: 'heart-island', name: '心有灵犀', desc: '画出一座心形岛' },
  { id: 'star-island', name: '星光闪耀', desc: '画出一座五角星岛' },
  { id: 'memorial-1024', name: '1024 造物纪念', desc: '画出一座面积刚刚好的 1024 纪念岛' },
  { id: 'night-owl', name: '夜猫子', desc: '在小岛上迎来夜晚' },
  { id: 'rain-dancer', name: '雨中曲', desc: '为小岛下一场雨' },
  { id: 'first-snow', name: '初雪', desc: '在小岛上迎来第一场雪' },
  { id: 'rainbow', name: '雨过天晴', desc: '见到雨后的彩虹' },
  { id: 'all-interactive', name: '万物有灵', desc: '与全部 6 种伙伴各互动一次' },
  { id: 'combo-5', name: '手速惊人', desc: '达成 5 连击' },
  { id: 'redecorator', name: '装点大师', desc: '重新装点 3 次' },
  { id: 'gardener', name: '种花达人', desc: '亲手在小岛上种下 10 朵花' },
  { id: 'fisher', name: '垂钓者', desc: '惊起一条跃出海面的鱼' },
  { id: 'bottle-keeper', name: '瓶中信', desc: '捞起一只漂来的漂流瓶' },
  { id: 'dolphin', name: '海的访客', desc: '目睹海豚跃出海面' },
  { id: 'keepsake', name: '留住时光', desc: '保存一张小岛海报' }
]

export const ACH_MAP: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((d) => [d.id, d])
)

export interface AchievementSnapshot {
  unlocked: Record<string, number>
  counters: Record<string, number>
}

export interface KVStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const STORAGE_KEY = 'island-forge-achievements-v1'
const INTERACT_KINDS: EntityKind[] = ['tree', 'house', 'windmill', 'boat', 'lighthouse', 'rock']

function defaultStorage(): KVStorage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export class AchievementManager {
  snapshot: AchievementSnapshot = { unlocked: {}, counters: {} }
  onUnlock: ((def: AchievementDef) => void) | null = null
  private storage: KVStorage | null

  constructor(storage?: KVStorage | null) {
    this.storage = storage === undefined ? defaultStorage() : storage
    this.load()
  }

  private load(): void {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as AchievementSnapshot
      if (parsed && typeof parsed === 'object' && parsed.unlocked && parsed.counters) {
        this.snapshot = { unlocked: parsed.unlocked, counters: parsed.counters }
      }
    } catch {
      /* 损坏的存档忽略 */
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.snapshot))
    } catch {
      /* 存储不可用时静默 */
    }
  }

  isUnlocked(id: string): boolean {
    return Boolean(this.snapshot.unlocked[id])
  }

  unlockedCount(): number {
    return Object.keys(this.snapshot.unlocked).length
  }

  counter(key: string): number {
    return this.snapshot.counters[key] ?? 0
  }

  /** 返回 true 表示本次调用触发解锁 */
  unlock(id: string): boolean {
    if (!ACH_MAP[id] || this.isUnlocked(id)) return false
    this.snapshot.unlocked[id] = Date.now()
    this.save()
    this.onUnlock?.(ACH_MAP[id])
    return true
  }

  bump(key: string, delta = 1): number {
    const v = (this.snapshot.counters[key] ?? 0) + delta
    this.snapshot.counters[key] = v
    this.save()
    return v
  }

  setMax(key: string, value: number): void {
    if (value > (this.snapshot.counters[key] ?? 0)) {
      this.snapshot.counters[key] = value
      this.save()
    }
  }

  // ---------- 事件钩子 ----------

  onIslandGenerated(info: { isHeart: boolean; isStar: boolean }): void {
    this.unlock('first-island')
    if (this.bump('islands') >= 5) this.unlock('archipelago')
    if (info.isHeart) this.unlock('heart-island')
    if (info.isStar) this.unlock('star-island')
  }

  onInteract(kind: EntityKind): void {
    this.bump(`entity.${kind}`)
    if (INTERACT_KINDS.every((k) => this.counter(`entity.${k}`) >= 1)) this.unlock('all-interactive')
  }

  onCombo(count: number): void {
    this.setMax('bestCombo', count)
    if (count >= 5) this.unlock('combo-5')
  }

  onNight(): void {
    this.unlock('night-owl')
  }

  onRain(): void {
    this.unlock('rain-dancer')
  }

  onSnow(): void {
    this.unlock('first-snow')
  }

  onPlant(count: number): void {
    this.setMax('planted', count)
    if (count >= 10) this.unlock('gardener')
  }

  onBottle(): void {
    this.unlock('bottle-keeper')
  }

  onMemorial(): void {
    this.unlock('memorial-1024')
  }

  onRainbow(): void {
    this.unlock('rainbow')
  }

  onRedecor(): void {
    if (this.bump('redecor') >= 3) this.unlock('redecorator')
  }

  onFish(): void {
    this.unlock('fisher')
  }

  onDolphin(): void {
    this.unlock('dolphin')
  }

  onPoster(): void {
    this.unlock('keepsake')
  }
}
