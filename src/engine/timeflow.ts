import type { TimeOfDay } from '../types'

/** 时光流逝：白天→黄昏→夜晚→黄昏→白天的自动循环相位表 */
export const TIME_CYCLE: Array<{ mode: TimeOfDay; dur: number }> = [
  { mode: 'day', dur: 60 },
  { mode: 'dusk', dur: 20 },
  { mode: 'night', dur: 45 },
  { mode: 'dusk', dur: 20 }
]

export const CYCLE_TOTAL = TIME_CYCLE.reduce((s, p) => s + p.dur, 0)

/** 周期时钟 → 当前时段与时段内进度（0..1） */
export function cyclePhase(clock: number): { mode: TimeOfDay; progress: number } {
  let t = clock % CYCLE_TOTAL
  if (t < 0) t += CYCLE_TOTAL
  for (const seg of TIME_CYCLE) {
    if (t < seg.dur) return { mode: seg.mode, progress: t / seg.dur }
    t -= seg.dur
  }
  return { mode: 'day', progress: 0 }
}

/** 时光流逝关闭时使用固定时长，打开后加速为完整昼夜循环 */
export function acceleratedClock(realDt: number, timeScale: number, prev: number): number {
  return prev + realDt * timeScale
}

/** 三态时间按钮的下一个状态 */
export function nextTimeOfDay(mode: TimeOfDay): TimeOfDay {
  if (mode === 'day') return 'dusk'
  if (mode === 'dusk') return 'night'
  return 'day'
}
