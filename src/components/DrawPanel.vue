<script setup lang="ts">
import gsap from 'gsap'
import { computed, onMounted, ref } from 'vue'
import { backHome, clearDrawing, generateFromPreview, tryExampleIsland } from '../game'
import { store } from '../state'

const rootRef = ref<HTMLElement | null>(null)
onMounted(() => {
  if (rootRef.value) gsap.from(rootRef.value, { y: 70, opacity: 0, duration: 0.5, ease: 'power3.out' })
})

const hint = computed(() => {
  if (store.mode === 'preview') return '轮廓不错！点击「生成小岛」，看它从海里长出来'
  return '按住鼠标或手指，画出你梦想中的小岛'
})
</script>

<template>
  <div ref="rootRef" class="draw-panel glass" data-testid="draw-panel">
    <div class="draw-msg">
      <p v-if="store.mode === 'preview'" class="draw-hint ok">✓ {{ hint }}</p>
      <p v-else class="draw-hint">{{ hint }}</p>
      <p class="draw-sub">
        {{ store.mode === 'preview' ? '也可以清除重画，或换一个示例轮廓' : '松手后自动闭合 · 试试画个爱心？' }}
      </p>
    </div>
    <div class="draw-actions">
      <button class="btn btn-ghost" data-testid="btn-home" title="返回首页" @click="backHome">首页</button>
      <button class="btn btn-ghost" data-testid="btn-clear" @click="clearDrawing">清除</button>
      <button class="btn" data-testid="btn-try-example" @click="tryExampleIsland">试试示例岛</button>
      <button
        class="btn btn-primary"
        data-testid="btn-generate"
        :disabled="store.mode !== 'preview' || store.busy"
        @click="generateFromPreview"
      >
        生成小岛
      </button>
    </div>
  </div>
</template>

<style scoped>
.draw-panel {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: max(18px, env(safe-area-inset-bottom));
  width: min(94vw, 720px);
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 16px;
  justify-content: space-between;
  flex-wrap: wrap;
  z-index: 20;
}
.draw-hint {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.03em;
}
.draw-hint.ok {
  color: #d8f7c8;
}
.draw-sub {
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-dim);
}
.draw-actions {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
}
@media (max-width: 560px) {
  .draw-panel {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }
  .draw-actions {
    justify-content: center;
  }
}
</style>
