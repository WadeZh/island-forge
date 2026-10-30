import type { Poly } from '../types'

const KEY = 'island-forge-save-v1'

export interface SavedIsland {
  outline: Poly
  name: string
  tagline: string
  isHeart: boolean
  createdAt: number
}

export function saveIsland(data: SavedIsland): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // 存储不可用时静默降级
  }
}

export function loadIsland(): SavedIsland | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as SavedIsland
    if (!Array.isArray(data.outline) || data.outline.length < 6) return null
    return data
  } catch {
    return null
  }
}

export function hasSavedIsland(): boolean {
  return loadIsland() !== null
}
