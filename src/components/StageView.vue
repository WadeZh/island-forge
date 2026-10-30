<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { audio, finishDrawing, scene } from '../game'
import { store } from '../state'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let raf = 0
let last = 0
let running = true

function loop(now: number): void {
  if (!running) return
  const dt = last ? now - last : 16
  last = now
  scene.frame(dt)
  audio.setWeatherMix(scene.rainT, scene.snowT)
  raf = requestAnimationFrame(loop)
}

function onVis(): void {
  if (document.hidden) {
    running = false
    cancelAnimationFrame(raf)
    audio.setSuspended(true)
  } else if (!running) {
    running = true
    last = 0
    audio.setSuspended(false)
    raf = requestAnimationFrame(loop)
  }
}

function onResize(): void {
  scene.resize()
}

function pointerPos(ev: PointerEvent): { x: number; y: number } {
  const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect()
  return { x: ev.clientX - rect.left, y: ev.clientY - rect.top }
}

function isTouch(ev: PointerEvent): boolean {
  return ev.pointerType === 'touch'
}

function onDown(ev: PointerEvent): void {
  audio.unlock()
  const p = pointerPos(ev)
  if (scene.mode === 'generating') {
    scene.skipGeneration()
    return
  }
  if (scene.mode === 'drawing') {
    if (scene.activePointerId !== -1) return
    scene.activePointerId = ev.pointerId
    scene.beginDraw()
    scene.addDrawPoint(scene.screenToWorld(p.x, p.y))
    ;(ev.target as HTMLCanvasElement).setPointerCapture(ev.pointerId)
  } else if (scene.mode === 'exploring') {
    const world = scene.screenToWorld(p.x, p.y)
    const hit = scene.hitTest(world, isTouch(ev))
    if (hit) scene.interact(hit)
    else if (!scene.tryPlantFlower(world)) scene.seaClick(world)
  }
}

function onMove(ev: PointerEvent): void {
  const p = pointerPos(ev)
  if (scene.drawing && ev.pointerId === scene.activePointerId) {
    scene.addDrawPoint(scene.screenToWorld(p.x, p.y))
  }
  scene.hover(scene.screenToWorld(p.x, p.y), p.x, p.y, isTouch(ev))
}

function onUp(ev: PointerEvent): void {
  if (scene.drawing && ev.pointerId === scene.activePointerId) {
    scene.activePointerId = -1
    scene.endDraw()
    finishDrawing()
  }
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  scene.attach(canvas)
  window.addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVis)
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  running = false
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', onResize)
  document.removeEventListener('visibilitychange', onVis)
  scene.detach()
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="stage-canvas"
    :style="{ cursor: store.tooltip ? 'pointer' : store.mode === 'drawing' ? 'crosshair' : 'default' }"
    aria-label="小岛画布"
  ></canvas>
</template>
