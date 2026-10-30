export interface Pt {
  x: number
  y: number
}

export type Poly = Pt[]

export interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type EntityKind =
  | 'tree'
  | 'house'
  | 'windmill'
  | 'rock'
  | 'lighthouse'
  | 'boat'
  | 'dock'
  | 'villager'
  | 'bottle'

export interface IslandEntity {
  id: number
  kind: EntityKind
  x: number
  y: number
  /** 命中/碰撞半径（世界像素） */
  r: number
  /** 绘制缩放（含岛屿整体尺寸缩放） */
  size: number
  /** 外观变体（0/1/2…），由种子决定 */
  variant: number
  /** 动画相位 */
  phase: number
  /** 出生动画起始时间（生成时间轴秒） */
  bornAt: number
  bornDur: number
  /** 点击弹跳 1→0 */
  pop: number
  /** 悬停 0→1 */
  hoverT: number
  /** 风车转速加成 1→0 */
  spinBoost: number
  /** 小屋亮灯 */
  lightsOn: boolean
  /** 烟囱冒烟剩余秒数 */
  smokeT: number
  /** 小船轨道参数 */
  orbitR?: number
  orbitAngle?: number
  orbitSpeed?: number
  bobBoost: number
  /** 岩石被点后的摇晃 */
  wobble: number
  /** 岛民角色 */
  role?: 'walker' | 'fisher'
  /** 衣服颜色索引 */
  outfit?: number
  /** 岛民运动状态（场景内运行时） */
  targetX?: number
  targetY?: number
  idleT?: number
  alpha?: number
}

export interface FlowerSpec {
  x: number
  y: number
  color: string
  size: number
  heart: boolean
  star?: boolean
  /** 玩家手种的花：记录种植时刻用于出生动画 */
  plantedAt?: number
}

export interface IslandCounts {
  trees: number
  houses: number
  windmills: number
  rocks: number
  flowers: number
  boats: number
  lighthouses: number
  docks: number
}

export interface IslandData {
  /** 平滑后的闭合轮廓（已居中到 1200×800 画布中心） */
  outline: Poly
  /** 用户绘制位置 → 居中位置的偏移，生成动画期间会归零 */
  drawOffset: Pt
  area: number
  centroid: Pt
  bbox: BBox
  /** 沙滩宽度 */
  beachW: number
  /** 全局物件尺寸缩放 */
  sizeScale: number
  coastSeed: number
  decorSeed: number
  name: string
  tagline: string
  featureLine: string
  isHeart: boolean
  isStar: boolean
  /** 面积恰好在 1024 纪念窗口内 */
  memorial?: boolean
  grade: string
  /** 岛屿之歌（16 音频率） */
  melody: number[]
  entities: IslandEntity[]
  flowers: FlowerSpec[]
  counts: IslandCounts
  /** 海岸线等距采样点（泡沫/贝壳用） */
  coastPts: Pt[]
  createdAt: number
}

export type TimeOfDay = 'day' | 'dusk' | 'night'
export type Weather = 'clear' | 'rain' | 'snow'
