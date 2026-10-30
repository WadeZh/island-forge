import { reactive } from 'vue'
import type { IslandEntity, TimeOfDay, Weather } from './types'

export type Mode = 'idle' | 'drawing' | 'preview' | 'generating' | 'exploring' | 'exporting'

export interface TooltipState {
  text: string
  x: number
  y: number
}

export const store = reactive({
  mode: 'idle' as Mode,
  islandName: '',
  tagline: '',
  featureLine: '',
  isHeart: false,
  counts: { trees: 0, houses: 0, windmills: 0, boats: 0 },
  timeOfDay: 'day' as TimeOfDay,
  weather: 'clear' as Weather,
  nameCard: false,
  nameCardData: { name: '', tagline: '', isHeart: false, isStar: false, memorial: false, grade: 'B' },
  toast: '',
  tooltip: null as TooltipState | null,
  exportOpen: false,
  posterUrl: '',
  busy: false,
  hasSaved: false,
  achievementsOpen: false,
  audioMuted: false,
  isStar: false,
  grade: 'B',
  visiting: false,
  visitFrom: '',
  timeFlow: false,
  visitModalOpen: false,
  memorial: false
})

let toastTimer: ReturnType<typeof setTimeout> | null = null
export function toast(msg: string, stay = 2200): void {
  store.toast = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    store.toast = ''
  }, stay)
}

export const ENTITY_LABELS: Record<IslandEntity['kind'], string> = {
  tree: '小树 · 点一点，落几片叶子',
  house: '小木屋 · 点一点亮灯冒烟',
  windmill: '风车 · 点一点转快些',
  boat: '小船 · 点一下打个招呼',
  lighthouse: '灯塔 · 点亮它的光',
  rock: '礁石 · 敲一敲听听回声',
  dock: '小码头 · 船就停在这边',
  villager: '岛民 · 点一点打个招呼',
  bottle: '漂流瓶 · 点一下看看信'
}
