<script setup lang="ts">
import gsap from 'gsap'
import { computed, onMounted, ref } from 'vue'
import { ACHIEVEMENTS, type AchievementDef } from '../achievements'
import { closeAchievements, achievements } from '../game'
import { store } from '../state'

const modalRef = ref<HTMLElement | null>(null)

const rows = computed(() =>
  ACHIEVEMENTS.map((d: AchievementDef) => {
    const unlocked = achievements.isUnlocked(d.id)
    let progress = ''
    if (d.id === 'archipelago') {
      const n = achievements.counter('islands')
      progress = n >= 5 ? '' : `${Math.min(n, 5)} / 5`
    } else if (d.id === 'redecorator') {
      const n = achievements.counter('redecor')
      progress = n >= 3 ? '' : `${Math.min(n, 3)} / 3`
    } else if (d.id === 'combo-5') {
      const n = achievements.counter('bestCombo')
      progress = n >= 5 ? '' : `最高 ${n} 连击`
    } else if (d.id === 'all-interactive') {
      const kinds = ['tree', 'house', 'windmill', 'boat', 'lighthouse', 'rock']
      const done = kinds.filter((k) => achievements.counter(`entity.${k}`) >= 1).length
      progress = done >= 6 ? '' : `${done} / 6`
    }
    return { ...d, unlocked, progress }
  })
)

const unlockedCount = computed(() => achievements.unlockedCount())

onMounted(() => {
  if (modalRef.value) {
    gsap.fromTo(
      modalRef.value,
      { scale: 0.92, y: 22, opacity: 0 },
      { scale: 1, y: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.3)', clearProps: 'all' }
    )
  }
})
</script>

<template>
  <div class="ach-mask" data-testid="achievements-mask" @click.self="closeAchievements">
    <div ref="modalRef" class="ach-modal glass" data-testid="achievements-modal">
      <div class="ach-head">
        <h3>成就墙 · {{ unlockedCount }} / {{ ACHIEVEMENTS.length }}</h3>
        <button class="btn btn-ghost btn-close" data-testid="btn-close-achievements" @click="closeAchievements">✕</button>
      </div>
      <div class="ach-grid">
        <div
          v-for="r in rows"
          :key="r.id"
          class="ach-card"
          :class="{ unlocked: r.unlocked }"
          :data-testid="`ach-${r.id}`"
        >
          <svg class="medal" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="14" :fill="r.unlocked ? '#F7BF75' : 'rgba(255,255,255,0.14)'" :stroke="r.unlocked ? '#C98B3D' : 'rgba(255,255,255,0.35)'" stroke-width="2.5" />
            <path d="M15 8 L13 1 M25 8 L27 1 M20 6 L20 0" :stroke="r.unlocked ? '#E0A458' : 'rgba(255,255,255,0.3)'" stroke-width="2" stroke-linecap="round" />
            <path d="M20 12.5 L22.3 17.2 L27.5 18 L23.7 21.6 L24.6 26.8 L20 24.3 L15.4 26.8 L16.3 21.6 L12.5 18 L17.7 17.2 Z" :fill="r.unlocked ? '#8A5A1E' : 'rgba(255,255,255,0.25)'" />
          </svg>
          <div class="ach-text">
            <p class="ach-name">{{ r.name }}</p>
            <p class="ach-desc">{{ r.desc }}</p>
            <p v-if="r.progress" class="ach-progress">{{ r.progress }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ach-mask {
  position: fixed;
  inset: 0;
  background: rgba(6, 24, 36, 0.62);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 55;
  padding: 18px;
}
.ach-modal {
  width: min(94vw, 640px);
  max-height: 88vh;
  overflow: auto;
  padding: 18px;
  background: rgba(14, 44, 60, 0.78);
}
.ach-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.ach-head h3 {
  font-size: 16px;
  letter-spacing: 0.12em;
}
.btn-close {
  padding: 7px 12px;
}
.ach-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 10px;
}
.ach-card {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  opacity: 0.62;
}
.ach-card.unlocked {
  opacity: 1;
  background: rgba(247, 191, 117, 0.14);
  border-color: rgba(247, 191, 117, 0.4);
}
.medal {
  width: 40px;
  height: 40px;
  flex: none;
}
.ach-name {
  font-size: 14px;
  font-weight: 700;
}
.ach-desc {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 2px;
}
.ach-progress {
  font-size: 11px;
  color: #ffd79a;
  margin-top: 3px;
}
</style>
