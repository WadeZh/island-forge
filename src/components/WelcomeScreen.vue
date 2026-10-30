<script setup lang="ts">
import gsap from 'gsap'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { buildWelcomeScene, scene as mainScene, showExample, startDrawing, resumeSaved } from '../game'
import { store } from '../state'
import { Scene } from '../engine/scene'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)
let raf = 0
let last = 0
let running = true
const demo = new Scene()
let tl: gsap.core.Timeline | null = null

function loop(now: number): void {
  if (!running) return
  const dt = last ? now - last : 16
  last = now
  demo.frame(dt)
  raf = requestAnimationFrame(loop)
}

function onVis(): void {
  if (document.hidden) {
    running = false
    cancelAnimationFrame(raf)
  } else if (!running) {
    running = true
    last = 0
    raf = requestAnimationFrame(loop)
  }
}

onMounted(() => {
  store.hasSaved = store.hasSaved || !!localStorage.getItem('island-forge-save-v1')
  const canvas = canvasRef.value
  if (canvas) {
    demo.attach(canvas)
    buildWelcomeScene(demo)
    demo.ambientMul = 0.52
    demo.ambientAnchorY = 0.68
    demo.applyAmbientView()
  }
  document.addEventListener('visibilitychange', onVis)
  raf = requestAnimationFrame(loop)
  tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
  tl.from('.hero-title .ch', { y: 46, opacity: 0, duration: 0.85, stagger: 0.07 })
    .from('.hero-sub', { y: 22, opacity: 0, duration: 0.7 }, '-=0.35')
    .fromTo(
      '.hero-actions .btn',
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, stagger: 0.1, clearProps: 'all' },
      '-=0.3'
    )
    .from('.hero-hint', { opacity: 0, duration: 0.6 }, '-=0.2')
  if (rootRef.value) gsap.from(rootRef.value, { opacity: 0, duration: 0.5 })
})

onBeforeUnmount(() => {
  running = false
  cancelAnimationFrame(raf)
  tl?.kill()
  document.removeEventListener('visibilitychange', onVis)
  demo.detach()
})

function onStart(): void {
  // 先把主舞台切到绘制模式，再卸载欢迎页
  mainScene.resetForDrawing()
  startDrawing()
}
</script>

<template>
  <div ref="rootRef" class="welcome">
    <canvas ref="canvasRef" class="welcome-canvas" aria-hidden="true"></canvas>
    <div class="welcome-shade" aria-hidden="true"></div>
    <div class="hero">
      <p class="hero-kicker">WORKBUDDY 2026 · 1024 造物挑战</p>
      <h1 class="hero-title" aria-label="一笔造岛">
        <span class="ch">一</span><span class="ch">笔</span><span class="ch">造</span><span class="ch">岛</span>
      </h1>
      <p class="hero-sub">画一条线，创造一个有生命的世界。</p>
      <div class="hero-actions">
        <button class="btn btn-primary btn-lg" data-testid="btn-start" @click="onStart">开始造岛</button>
        <button class="btn btn-ghost btn-lg" data-testid="btn-example" @click="showExample">看看示例</button>
        <button v-if="store.hasSaved" class="btn btn-ghost btn-lg" data-testid="btn-resume" @click="resumeSaved">
          回到我的小岛
        </button>
        <button class="btn btn-ghost btn-lg visit-entry" data-testid="btn-visit-entry" @click="store.visitModalOpen = true">
          用岛屿代码拜访
        </button>
      </div>
      <p class="hero-hint">拿起鼠标或手指，画出你梦想中的小岛 —— 它会真正长出来。</p>
    </div>
    <footer class="hero-foot">ISLAND FORGE · 画布上的微缩世界</footer>
  </div>
</template>

<style scoped>
.welcome {
  position: fixed;
  inset: 0;
  overflow: hidden;
}
.welcome-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.welcome-shade {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 90% 60% at 50% 38%, rgba(10, 34, 48, 0.34), rgba(10, 34, 48, 0) 65%),
    linear-gradient(180deg, rgba(8, 30, 44, 0.28), rgba(8, 30, 44, 0) 40%, rgba(8, 30, 44, 0.34));
  pointer-events: none;
}
.hero {
  position: absolute;
  left: 50%;
  top: 42%;
  transform: translate(-50%, -50%);
  text-align: center;
  width: min(92vw, 640px);
}
.hero-kicker {
  font-size: 12px;
  letter-spacing: 0.34em;
  color: rgba(238, 248, 252, 0.72);
  margin-bottom: 18px;
}
.hero-title {
  font-size: clamp(56px, 12vw, 108px);
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1.08;
  text-shadow:
    0 4px 0 rgba(9, 44, 60, 0.35),
    0 14px 44px rgba(6, 32, 46, 0.55);
}
.hero-title .ch {
  display: inline-block;
  background: linear-gradient(180deg, #fff6e2 15%, #ffd79a 55%, var(--gold));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hero-sub {
  margin-top: 16px;
  font-size: clamp(16px, 2.6vw, 21px);
  letter-spacing: 0.18em;
  color: var(--text-dim);
}
.hero-actions {
  margin-top: 34px;
  display: flex;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
}
.btn-lg {
  padding: 14px 34px;
  font-size: 17px;
}
.hero-hint {
  margin-top: 26px;
  font-size: 13px;
  color: rgba(238, 248, 252, 0.6);
  letter-spacing: 0.08em;
}
.visit-entry {
  font-size: 14px;
  padding: 11px 22px;
  opacity: 0.9;
}
.hero-foot {
  position: absolute;
  bottom: max(16px, env(safe-area-inset-bottom));
  left: 0;
  right: 0;
  text-align: center;
  font-size: 11px;
  letter-spacing: 0.3em;
  color: rgba(238, 248, 252, 0.45);
}
</style>
