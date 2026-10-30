import type { IslandCounts } from '../types'

export type IslandGrade = 'S' | 'A' | 'B' | 'C'
export type ShapeSpecial = 'none' | 'heart' | 'star'

export interface GradeResult {
  score: number
  grade: IslandGrade
}

/**
 * 岛屿评级：种类丰富度 30 + 面积 30 + 树木 15 + 花草 10 + 形状 15。
 * 星形形状加成略高于心形（更难画准）。
 */
export function computeGrade(area: number, counts: IslandCounts, special: ShapeSpecial): GradeResult {
  const kinds =
    (counts.houses >= 1 ? 1 : 0) +
    (counts.windmills >= 1 ? 1 : 0) +
    (counts.lighthouses >= 1 ? 1 : 0) +
    (counts.boats >= 1 ? 1 : 0) +
    (counts.docks >= 1 ? 1 : 0) +
    (counts.rocks >= 3 ? 1 : 0)
  const kindsScore = (kinds / 6) * 30
  const sizeScore = Math.min(1, area / 150000) * 30
  const treeScore = Math.min(1, counts.trees / 25) * 15
  const flowerScore = Math.min(1, counts.flowers / 30) * 10
  const shapeScore = special === 'star' ? 18 : special === 'heart' ? 15 : 6
  const score = Math.round((kindsScore + sizeScore + treeScore + flowerScore + shapeScore) * 10) / 10
  const grade: IslandGrade = score >= 88 ? 'S' : score >= 72 ? 'A' : score >= 55 ? 'B' : 'C'
  return { score, grade }
}

export const GRADE_COLORS: Record<IslandGrade, string> = {
  S: '#F7BF75',
  A: '#D9E4EC',
  B: '#D0A47F',
  C: '#9AA7AE'
}
