import { polygonArea } from './geometry/poly'
import { validateOutline } from './geometry/outline'
import { presetOutline, type PresetKind } from './generation/presets'
import { decodeIslandCode, encodeIslandCode } from './generation/islandcode'
import { BOTTLE_NOTES } from './generation/bottlenotes'
import { Scene } from './engine/scene'
import { AudioEngine } from './engine/audio'
import { AchievementManager } from './achievements'
import { nextTimeOfDay } from './engine/timeflow'
import { ENTITY_LABELS, store, toast } from './state'
import { hasSavedIsland, loadIsland, saveIsland } from './utils/storage'
import { canShareFiles, downloadCanvas, pad2, shareCanvas } from './utils/export'
import type { IslandEntity, TimeOfDay, Weather } from './types'
import { mulberry32 } from './generation/rng'

export const scene = new Scene()
export const audio = new AudioEngine()
export const achievements = new AchievementManager()

let exampleIdx = 0
const EXAMPLE_ORDER: PresetKind[] = ['blob', 'long', 'heart', 'star', 'crescent']
let posterCanvas: HTMLCanvasElement | null = null

function wireScene(): void {
  scene.onDrawState = (s) => {
    if (s.phase === 'preview') {
      store.mode = 'preview'
    } else if (store.mode === 'preview' && s.phase === 'drawing') {
      store.mode = 'drawing'
    }
  }
  scene.onNameReveal = (info) => {
    store.nameCardData = { ...info }
    store.nameCard = true
  }
  scene.onGenDone = () => {
    if (scene.ambient) return
    store.mode = 'exploring'
    scene.mode = 'exploring'
    playIslandSong()
    // 首次进入探索页时给一次交互引导
    try {
      if (!localStorage.getItem('island-forge-hint-v1')) {
        localStorage.setItem('island-forge-hint-v1', '1')
        toast('点点小屋、风车、小人和礁石，它们都有反应', 4200)
      }
    } catch {
      /* 存储不可用时跳过引导 */
    }
  }
  scene.onHover = (e, sx, sy) => {
    store.tooltip = e ? { text: ENTITY_LABELS[e.kind], x: sx, y: sy } : null
  }
  scene.onInteract = (e) => {
    achievements.onInteract(e.kind)
    audio.playEntity(e.kind)
  }
  scene.onCombo = (n) => {
    achievements.onCombo(n)
    audio.combo(n)
  }
  scene.onDolphin = () => {
    achievements.onDolphin()
    audio.waterDrop()
  }
  scene.onFish = () => {
    achievements.onFish()
    audio.waterDrop()
  }
  scene.onGenStage = (i) => audio.genStage(i)
  scene.onBirdChirp = () => audio.birdChirp()
  scene.onPlant = (total) => {
    achievements.onPlant(total)
    audio.plantSeed()
  }
  scene.onBottle = () => {
    achievements.onBottle()
    audio.waterDrop()
    const note = BOTTLE_NOTES[Math.floor(Math.random() * BOTTLE_NOTES.length)]
    toast(`瓶中信：「${note}」`, 5200)
  }
  scene.onMemorial = () => achievements.onMemorial()
  achievements.onUnlock = (def) => {
    toast(`🏆 解锁成就 · ${def.name}`)
    audio.achievement()
  }
}

wireScene()
store.audioMuted = audio.muted

// ---------- 页面流转 ----------

export function startDrawing(): void {
  store.mode = 'drawing'
  store.nameCard = false
  store.visiting = false
  store.visitFrom = ''
  scene.ambient = false
  scene.resetForDrawing()
}

export function backHome(): void {
  store.mode = 'idle'
  store.nameCard = false
  store.tooltip = null
  store.hasSaved = hasSavedIsland()
}

/** 首页「看看示例」：直接生成一座示例岛 */
export function showExample(): void {
  const poly = presetOutline('blob', 20261024)
  store.mode = 'generating'
  store.nameCard = false
  scene.ambient = false
  scene.resetForDrawing()
  scene.generateIsland({ poly, drawOffset: { x: 0, y: 0 }, mode: 'full' })
  syncIslandToStore()
  saveCurrentIsland()
}

export function tryExampleIsland(): void {
  const kind = EXAMPLE_ORDER[exampleIdx % EXAMPLE_ORDER.length]
  exampleIdx++
  scene.clearDrawing()
  const poly = presetOutline(kind, 1024 + exampleIdx * 17)
  const result = validateOutline(poly)
  if (!result.ok || !result.poly) return
  scene.setDrawResult({ ok: true, poly: result.poly })
}

// ---------- 绘制 ----------

export function finishDrawing(): void {
  if (scene.drawPoints.length === 0) return
  const result = validateOutline(scene.drawPoints)
  if (result.ok && result.poly) {
    scene.setDrawResult({ ok: true, poly: result.poly })
  } else {
    scene.notifyInvalid(result.reason ?? '这个轮廓不太行，再试试')
  }
}

export function clearDrawing(): void {
  scene.clearDrawing()
  store.mode = 'drawing'
}

export function generateFromPreview(): void {
  if (store.mode !== 'preview' || store.busy) return
  store.busy = true
  const preview = scene.getPreview()
  if (!preview) {
    store.busy = false
    return
  }
  scene.generateIsland({
    poly: preview.poly.map((p) => ({ ...p })),
    drawOffset: { ...preview.offset },
    mode: 'full'
  })
  syncIslandToStore()
  saveCurrentIsland()
  store.busy = false
}

// ---------- 探索 ----------

export function setTimeOfDay(v: TimeOfDay): void {
  scene.timeOfDay = v
  store.timeOfDay = v
  if (v === 'night') achievements.onNight()
}

export function cycleTimeOfDay(): void {
  // 手动接管：关闭时光流逝，否则相位表下一帧会覆盖用户选择
  if (scene.timeFlow) {
    scene.timeFlow = false
    store.timeFlow = false
  }
  setTimeOfDay(nextTimeOfDay(scene.timeOfDay))
}

export function toggleTimeFlow(): boolean {
  scene.timeFlow = !scene.timeFlow
  store.timeFlow = scene.timeFlow
  if (scene.timeFlow) scene.restartFlowClock()
  return scene.timeFlow
}

export function replayIslandSong(): void {
  if (scene.island) {
    playIslandSong()
    audio.uiTap()
  }
}

/** 岛屿之歌：音频与音符粒子同步 */
function playIslandSong(): void {
  if (!scene.island) return
  audio.playMelody(scene.island.melody)
  scene.startSongParticles(scene.island.melody.length)
}

export function setWeather(v: Weather): void {
  const wasWet = scene.weather === 'rain' || scene.weather === 'snow'
  scene.weather = v
  store.weather = v
  if (v === 'rain') {
    achievements.onRain()
  } else if (v === 'snow') {
    achievements.onSnow()
  } else if (wasWet && (scene.rainT > 0.5 || scene.snowT > 0.5)) {
    // 雨霁或雪霁： precipitation 结束后海面升起彩虹
    scene.startRainbow()
    achievements.onRainbow()
  }
}

export function toggleAudioMute(): boolean {
  const muted = audio.toggleMute()
  store.audioMuted = muted
  if (!muted) audio.unlock()
  return muted
}

export function openAchievements(): void {
  store.achievementsOpen = true
  audio.uiTap()
}

export function closeAchievements(): void {
  store.achievementsOpen = false
}

export function redecorate(): void {
  if (store.mode !== 'exploring' || store.busy) return
  store.busy = true
  scene.redecorate()
  syncIslandToStore()
  store.busy = false
  achievements.onRedecor()
  toast('重新装点完成，换了一副新面孔')
}

export function backToDrawing(): void {
  startDrawing()
}

export function interactAt(entity: IslandEntity): void {
  scene.interact(entity)
}

// ---------- 岛屿代码 · 拜访 ----------

export function getIslandCode(): string {
  if (!scene.island) return ''
  return encodeIslandCode(scene.island)
}

/** 输入朋友的岛屿代码，立即登岛拜访 */
export function visitByCode(codeRaw: string): boolean {
  const decoded = decodeIslandCode(codeRaw)
  if (!decoded) {
    toast('这段岛屿代码读不出来，检查一下有没有缺字', 3000)
    return false
  }
  store.visiting = true
  store.visitFrom = new Date(decoded.createdAt).toLocaleDateString('zh-CN')
  store.mode = 'generating'
  store.nameCard = false
  scene.ambient = false
  scene.timeFlow = false
  store.timeFlow = false
  scene.resetForDrawing()
  scene.generateIsland({
    poly: decoded.outline,
    drawOffset: { x: 0, y: 0 },
    mode: 'instant',
    savedName: decoded.name,
    grade: decoded.grade,
    createdAt: decoded.createdAt,
    visit: true
  })
  syncIslandToStore()
  store.mode = 'exploring'
  scene.mode = 'exploring'
  playIslandSong()
  toast(`欢迎来到 ${decoded.name}`)
  return true
}

export function backToMyIsland(): void {
  store.visiting = false
  store.visitFrom = ''
  const saved = loadIsland()
  if (!saved) {
    startDrawing()
    return
  }
  store.mode = 'generating'
  store.nameCard = false
  scene.ambient = false
  scene.resetForDrawing()
  scene.generateIsland({
    poly: saved.outline,
    drawOffset: { x: 0, y: 0 },
    mode: 'instant',
    savedName: saved.name,
    savedTagline: saved.tagline
  })
  syncIslandToStore()
  store.mode = 'exploring'
  scene.mode = 'exploring'
  toast('回到你自己的小岛')
}

export function isVisiting(): boolean {
  return store.visiting
}

// ---------- 保存与导出 ----------

function saveCurrentIsland(): void {
  const isl = scene.island
  if (!isl) return
  saveIsland({
    outline: isl.outline.map((p) => ({
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10
    })),
    name: isl.name,
    tagline: isl.tagline,
    isHeart: isl.isHeart,
    createdAt: isl.createdAt
  })
  store.hasSaved = true
}

export function resumeSaved(): void {
  const saved = loadIsland()
  if (!saved) return
  store.visiting = false
  store.visitFrom = ''
  store.mode = 'generating'
  store.nameCard = false
  scene.ambient = false
  scene.resetForDrawing()
  scene.generateIsland({
    poly: saved.outline,
    drawOffset: { x: 0, y: 0 },
    mode: 'instant',
    savedName: saved.name,
    savedTagline: saved.tagline
  })
  syncIslandToStore()
  store.mode = 'exploring'
  scene.mode = 'exploring'
}

function syncIslandToStore(): void {
  const isl = scene.island
  if (!isl) return
  store.islandName = isl.name
  store.tagline = isl.tagline
  store.featureLine = isl.featureLine
  store.isHeart = isl.isHeart
  store.isStar = isl.isStar
  store.grade = isl.grade
  store.memorial = isl.memorial ?? false
  store.counts = {
    trees: isl.counts.trees,
    houses: isl.counts.houses,
    windmills: isl.counts.windmills,
    boats: isl.counts.boats
  }
  // 拜访别人的岛不计入自己的造岛成就
  if (!store.visiting) {
    achievements.onIslandGenerated({ isHeart: isl.isHeart, isStar: isl.isStar })
    dailyIsland(isl.name)
  }
}

/** 每天第一次造岛授予「今日之岛」称号 */
function dailyIsland(name: string): void {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const key = 'island-forge-daily-v1'
    const raw = localStorage.getItem(key)
    if (raw === today) return
    localStorage.setItem(key, today)
    toast(`今日之岛 · ${name}`, 3200)
  } catch {
    /* 忽略存储不可用 */
  }
}

export function openExport(): void {
  if (!scene.island) return
  posterCanvas = scene.renderPoster()
  if (!posterCanvas) return
  store.posterUrl = posterCanvas.toDataURL('image/png')
  store.exportOpen = true
}

export function closeExport(): void {
  store.exportOpen = false
}

export async function savePosterPng(): Promise<boolean> {
  if (!posterCanvas || !scene.island) return false
  const d = new Date(scene.island.createdAt)
  const name = `ISLAND-FORGE-${scene.island.name}-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}.png`
  await downloadCanvas(posterCanvas, name)
  achievements.onPoster()
  toast('海报已保存到下载目录')
  return true
}

export async function sharePoster(): Promise<boolean> {
  if (!posterCanvas || !scene.island) return false
  return shareCanvas(posterCanvas, scene.island.name, `${scene.island.tagline} —— 来自「一笔造岛 ISLAND FORGE」`)
}

export function shareAvailable(): boolean {
  return canShareFiles()
}

// ---------- 首页演示场景 ----------

export function buildWelcomeScene(sc: Scene): void {
  const poly = presetOutline('blob', 777)
  sc.ambient = true
  sc.generateIsland({ poly, drawOffset: { x: 0, y: 0 }, mode: 'instant', ambient: true })
  sc.applyAmbientView()
  sc.timeOfDay = 'day'
  sc.weather = 'clear'
}

// ---------- 调试/测试钩子 ----------

export function exposeTestHooks(): void {
  ;(window as unknown as Record<string, unknown>).__ISLAND_FORGE__ = {
    store,
    scene,
    audio,
    achievements,
    api: {
      startDrawing,
      showExample,
      generateFromPreview,
      setTimeOfDay,
      setWeather,
      redecorate,
      openExport,
      backToDrawing,
      resumeSaved,
      getIslandCode,
      visitByCode,
      backToMyIsland,
      isVisiting,
      replayIslandSong,
      toggleTimeFlow
    },
    entityScreenPos(kind: IslandEntity['kind'], index = 0): { x: number; y: number } | null {
      const isl = scene.island
      if (!isl) return null
      const list = isl.entities.filter((e) => e.kind === kind)
      const e = list[index]
      if (!e) return null
      return {
        x: scene.view.ox + e.x * scene.view.scale,
        y: scene.view.oy + e.y * scene.view.scale
      }
    },
    stats: {
      get interactions() {
        return scene.interactions
      }
    },
    _area: (poly: Array<{ x: number; y: number }>) => polygonArea(poly),
    _rngSmoke: () => mulberry32(1)()
  }
}
