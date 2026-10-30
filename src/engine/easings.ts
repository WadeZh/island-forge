export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export function easeOutCubic(t: number): number {
  const u = 1 - clamp01(t)
  return 1 - u * u * u
}

export function easeOutQuad(t: number): number {
  const u = 1 - clamp01(t)
  return 1 - u * u
}

export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * clamp01(t)) - 1) / 2
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  const u = clamp01(t) - 1
  return 1 + c3 * u * u * u + c1 * u * u
}

/** 指数趋近（帧率无关的平滑过渡） */
export function expApproach(current: number, target: number, dt: number, speed: number): number {
  return target + (current - target) * Math.exp(-speed * dt)
}

/** 阶段窗口：全局时钟 → 0..1 局部进度 */
export function stageProgress(clock: number, start: number, end: number): number {
  return clamp01((clock - start) / Math.max(0.0001, end - start))
}
