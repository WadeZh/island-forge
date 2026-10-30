import type { EntityKind } from '../types'

/**
 * 纯 Web Audio 合成音效：零素材、零版权。
 * AudioContext 延迟到首次用户手势创建（浏览器自动播放策略）；
 * 页面隐藏时挂起；静音状态持久化。
 */
export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private ambientGain: GainNode | null = null
  private rainGain: GainNode | null = null
  private windGain: GainNode | null = null
  private started = false
  muted = false

  constructor() {
    try {
      if (typeof localStorage !== 'undefined') {
        this.muted = localStorage.getItem('island-forge-audio-muted') === '1'
      }
    } catch {
      /* 忽略存储不可用 */
    }
  }

  /** 仅在用户手势内调用 */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AC) return
        this.ctx = new AC()
        this.master = this.ctx.createGain()
        this.master.gain.value = this.muted ? 0 : 0.9
        this.master.connect(this.ctx.destination)
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {})
      if (!this.started) {
        this.started = true
        this.startAmbient()
      }
    } catch {
      /* 音频不可用时静默降级 */
    }
  }

  setSuspended(suspended: boolean): void {
    try {
      if (!this.ctx) return
      if (suspended && this.ctx.state === 'running') void this.ctx.suspend().catch(() => {})
      else if (!suspended && this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume().catch(() => {})
    } catch {
      /* noop */
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    try {
      if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05)
      if (typeof localStorage !== 'undefined') localStorage.setItem('island-forge-audio-muted', this.muted ? '1' : '0')
    } catch {
      /* noop */
    }
    return this.muted
  }

  // ---------- 环境声 ----------

  private noiseBuffer(seconds: number, brown: boolean): AudioBuffer | null {
    const ctx = this.ctx
    if (!ctx) return null
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      if (brown) {
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.2
      } else {
        data[i] = white
      }
    }
    return buf
  }

  private startAmbient(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    try {
      // 海浪：棕噪声 + 缓慢调制的低通
      const waves = ctx.createBufferSource()
      waves.buffer = this.noiseBuffer(3, true)
      waves.loop = true
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 420
      lp.Q.value = 0.4
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.09
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 160
      lfo.connect(lfoGain).connect(lp.frequency)
      this.ambientGain = ctx.createGain()
      this.ambientGain.gain.value = 0.16
      waves.connect(lp).connect(this.ambientGain).connect(master)
      waves.start()
      lfo.start()
      // 雨：白噪声过带通，随 rainT 交叉渐变
      const rain = ctx.createBufferSource()
      rain.buffer = this.noiseBuffer(2, false)
      rain.loop = true
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 3200
      bp.Q.value = 0.4
      this.rainGain = ctx.createGain()
      this.rainGain.gain.value = 0
      rain.connect(bp).connect(this.rainGain).connect(master)
      rain.start()
      // 雪：更低沉的风声
      const wind = ctx.createBufferSource()
      wind.buffer = this.noiseBuffer(3, true)
      wind.loop = true
      const wlp = ctx.createBiquadFilter()
      wlp.type = 'lowpass'
      wlp.frequency.value = 240
      const wlfo = ctx.createOscillator()
      wlfo.frequency.value = 0.07
      const wlfoGain = ctx.createGain()
      wlfoGain.gain.value = 120
      wlfo.connect(wlfoGain).connect(wlp.frequency)
      this.windGain = ctx.createGain()
      this.windGain.gain.value = 0
      wind.connect(wlp).connect(this.windGain).connect(master)
      wind.start()
      wlfo.start()
    } catch {
      /* noop */
    }
  }

  /** 雨声层与风声层音量（game 层周期同步 rainT/snowT） */
  setWeatherMix(rainT: number, snowT = 0): void {
    try {
      if (this.rainGain && this.ctx) this.rainGain.gain.setTargetAtTime(0.12 * rainT, this.ctx.currentTime, 0.4)
      if (this.windGain && this.ctx) this.windGain.gain.setTargetAtTime(0.14 * snowT, this.ctx.currentTime, 0.6)
    } catch {
      /* noop */
    }
  }

  // ---------- 合成基元 ----------

  private blip(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, glideTo?: number): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    try {
      const t0 = ctx.currentTime + when
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.setValueAtTime(freq, t0)
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t0)
      g.gain.linearRampToValueAtTime(gain, t0 + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      osc.connect(g).connect(master)
      osc.start(t0)
      osc.stop(t0 + dur + 0.05)
    } catch {
      /* noop */
    }
  }

  private noiseBurst(dur: number, freq: number, gain: number, when = 0, sweepTo?: number): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    try {
      const t0 = ctx.currentTime + when
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuffer(Math.min(1, dur + 0.1), false)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(freq, t0)
      if (sweepTo) bp.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur)
      bp.Q.value = 1
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t0)
      g.gain.linearRampToValueAtTime(gain, t0 + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      src.connect(bp).connect(g).connect(master)
      src.start(t0)
      src.stop(t0 + dur + 0.05)
    } catch {
      /* noop */
    }
  }

  // ---------- 对外音效 ----------

  playEntity(kind: EntityKind): void {
    if (!this.ctx) return
    switch (kind) {
      case 'tree':
        this.noiseBurst(0.09, 950, 0.25)
        this.noiseBurst(0.07, 700, 0.18, 0.09)
        this.blip(190, 0.12, 'triangle', 0.12)
        break
      case 'house':
        this.blip(523, 0.14, 'sine', 0.16)
        this.blip(659, 0.14, 'sine', 0.16, 0.07)
        this.blip(784, 0.2, 'sine', 0.16, 0.14)
        break
      case 'windmill':
        this.noiseBurst(0.5, 380, 0.16, 0, 1300)
        break
      case 'boat':
        this.blip(300, 0.16, 'sine', 0.18, 0, 190)
        this.noiseBurst(0.2, 620, 0.1, 0.02)
        break
      case 'lighthouse':
        this.blip(130, 0.8, 'sine', 0.14, 0, 150)
        break
      case 'rock':
        this.noiseBurst(0.08, 240, 0.3)
        this.blip(110, 0.1, 'square', 0.08)
        break
      case 'dock':
        this.blip(240, 0.1, 'triangle', 0.12)
        break
    }
  }

  combo(n: number): void {
    this.blip(380 + Math.min(n, 8) * 70, 0.1, 'triangle', 0.14)
  }

  achievement(): void {
    this.blip(880, 0.4, 'sine', 0.14)
    this.blip(1320, 0.55, 'sine', 0.12, 0.12)
  }

  /** 生成动画 6 阶段：五声音阶上行 */
  genStage(i: number): void {
    const scale = [262, 294, 330, 392, 440, 523]
    this.blip(scale[Math.min(i, 5)], 0.34, 'sine', 0.15)
    this.blip(scale[Math.min(i, 5)] * 2, 0.2, 'sine', 0.05, 0.02)
  }

  birdChirp(): void {
    this.blip(2900, 0.06, 'sine', 0.06, 0, 2300)
    this.blip(2600, 0.05, 'sine', 0.05, 0.09, 2100)
  }

  waterDrop(): void {
    this.blip(430, 0.14, 'sine', 0.12, 0, 300)
  }

  uiTap(): void {
    this.blip(700, 0.05, 'sine', 0.07)
  }

  plantSeed(): void {
    this.blip(520, 0.1, 'sine', 0.12, 0, 760)
    this.noiseBurst(0.06, 800, 0.08, 0.05)
  }

  /** 岛屿之歌：八音盒音色（正弦 + 2.7 倍泛音 + 长衰减），按拍演奏完整旋律 */
  playMelody(notes: number[], noteInterval = 0.52): void {
    const ctx = this.ctx
    if (!ctx || !notes.length) return
    try {
      const t0 = ctx.currentTime + 0.05
      notes.forEach((freq, i) => {
        if (freq <= 0) return
        const when = t0 + i * noteInterval
        for (const [mul, gain, dur] of [
          [1, 0.12, 1.4],
          [2.7, 0.035, 0.8]
        ] as const) {
          const osc = ctx.createOscillator()
          osc.type = 'sine'
          osc.frequency.value = freq * mul
          const g = ctx.createGain()
          g.gain.setValueAtTime(0, when)
          g.gain.linearRampToValueAtTime(gain, when + 0.015)
          g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
          osc.connect(g).connect(this.master as GainNode)
          osc.start(when)
          osc.stop(when + dur + 0.05)
        }
      })
    } catch {
      /* noop */
    }
  }
}
