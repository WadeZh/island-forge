<script setup lang="ts">
import { store } from '../state'
</script>

<template>
  <transition name="overlay-fade">
    <div v-if="store.toast" class="toast glass" data-testid="toast">{{ store.toast }}</div>
  </transition>
  <transition name="overlay-fade">
    <div
      v-if="store.tooltip"
      class="tooltip glass"
      :style="{ left: store.tooltip.x + 14 + 'px', top: store.tooltip.y - 34 + 'px' }"
    >
      {{ store.tooltip.text }}
    </div>
  </transition>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  top: max(18px, env(safe-area-inset-top));
  transform: translateX(-50%);
  padding: 10px 20px;
  font-size: 14px;
  z-index: 60;
  background: rgba(12, 38, 54, 0.7);
}
@media (max-width: 720px) {
  .toast {
    top: auto;
    bottom: 108px;
    max-width: 88vw;
    text-align: center;
  }
}
.tooltip {
  position: fixed;
  padding: 7px 12px;
  font-size: 12px;
  z-index: 40;
  pointer-events: none;
  background: rgba(12, 38, 54, 0.72);
  white-space: nowrap;
}
</style>
