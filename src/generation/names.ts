import type { IslandCounts } from '../types'
import { R } from './rng'

const NAME_PREFIX = [
  '微风', '月光', '云杉', '橘柿', '贝壳', '薄荷', '星屑', '柠檬',
  '鲸歌', '苔语', '海盐', '麦芽', '萤火', '栗子', '雾松', '枕浪',
  '蒲公', '椰奶', '汽水', '渡鸦'
] as const

const NAME_SUFFIX = ['湾', '屿', '岛', '礁', '洲', '环礁', '沙洲', '半岛'] as const

const TAGLINES = [
  '风把种子吹到了这里，就再没离开。',
  '潮汐每天来访两次，从不迟到。',
  '这里的蜗牛过马路，需要一整个下午。',
  '岛上的猫相信：月亮是一块大饼干。',
  '每一朵云路过时，都会低头照照镜子。',
  '灯塔管理员的日记只有一句话：今天也很平静。',
  '海水把星星洗得亮亮的。',
  '据说在岛上打了个喷嚏，惊醒了一群海鸥。',
  '这里的日落比别处慢半拍。',
  '风车数过了，今天吹过 8421 阵风。',
  '小船每天绕岛一圈，顺便检查云的库存。',
  '草地上长满了没写完的夏天。',
  '岛上的时间是用树影来计量的。',
  '海带们一致认为：这里是海的头条。',
  '沙堡的国王宣布：今天适合什么都不做。',
  '夜里萤火虫值班，负责给月亮补光。'
] as const

const HEART_NAMES = ['心动湾', '怦然屿', '恋爱角', '心跳岛'] as const
const HEART_TAGLINE = '有人在海上画了一颗心。'

const STAR_NAMES = ['摘星屿', '流星湾', '星辰角', '银河洲'] as const
const STAR_TAGLINE = '有人把一颗星星按进了海里。'

export function genIslandName(
  rng: R,
  isHeart: boolean,
  isStar = false
): { name: string; tagline: string } {
  if (isStar) return { name: rng.pick(STAR_NAMES), tagline: STAR_TAGLINE }
  if (isHeart) return { name: rng.pick(HEART_NAMES), tagline: HEART_TAGLINE }
  return { name: rng.pick(NAME_PREFIX) + rng.pick(NAME_SUFFIX), tagline: rng.pick(TAGLINES) }
}

export function genFeatureLine(counts: IslandCounts): string {
  const parts: string[] = []
  parts.push(`${counts.houses} 座小木屋`)
  if (counts.windmills > 0) parts.push('一座吱呀转动的风车')
  if (counts.lighthouses > 0) parts.push('一座守夜的灯塔')
  if (counts.docks > 0) parts.push('一座伸向海面的小码头')
  parts.push(`${counts.trees} 棵树`)
  if (counts.boats > 0) parts.push('一艘午睡的小船')
  return `这座岛上有 ${parts.join('、')}。`
}
