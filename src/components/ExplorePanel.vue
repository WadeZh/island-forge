<script setup lang="ts">
import gsap from 'gsap'
import { onMounted, ref } from 'vue'
import {
  achievements,
  backToDrawing,
  backToMyIsland,
  cycleTimeOfDay,
  openAchievements,
  openExport,
  redecorate,
  replayIslandSong,
  setTimeOfDay,
  setWeather,
  toggleAudioMute,
  toggleTimeFlow
} from '../game'
import { store } from '../state'
import type { Weather } from '../types'

const rootRef = ref<HTMLElement | null>(null)
onMounted(() => {
  if (rootRef.value) gsap.from(rootRef.value, { y: 24, opacity: 0, duration: 0.5, ease: 'power3.out', delay: 0.2 })
})

function toggleWeather(): void {
  // 晴天 → 雨天 → 雪天 → 晴天
  const order: Weather[] = ['clear', 'rain', 'snow']
  const next = order[(order.indexOf(store.weather) + 1) % order.length]
  setWeather(next)
}
function unlockedCount(): number {
  return achievements.unlockedCount()
}
const TIME_LABEL: Record<string, string> = { day: '白天', dusk: '黄昏', night: '夜晚' }
const WEATHER_LABEL: Record<Weather, string> = { clear: '晴天', rain: '雨天', snow: '雪天' }
</script>

<template>
  <div>
    <div v-if="store.visiting" class="visit-banner glass" data-testid="visit-banner">
      <span> {{ store.islandName }} · 岛屿代码来自 {{ store.visitFrom }} </span>
      <button class="btn btn-ghost btn-mini" data-testid="btn-back-my-island" @click="backToMyIsland">回到我的岛</button>
    </div>
    <div class="top-bar">
      <div class="chip island-chip" data-testid="island-chip">
        <span class="island-name">{{ store.islandName }}</span>
        <span class="island-tag">{{ store.tagline }}</span>
      </div>
      <div class="top-actions">
        <button class="btn btn-ghost btn-sq" data-testid="btn-song" title="岛屿之歌" @click="replayIslandSong">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M9 18.5V6.2l9-2.2v12.5" />
            <circle cx="6.8" cy="18.6" r="2.4" fill="currentColor" stroke="none" />
            <circle cx="15.8" cy="16.4" r="2.4" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <button
          class="btn btn-ghost btn-sq"
          data-testid="btn-timeflow"
          :class="{ active: store.timeFlow }"
          :title="store.timeFlow ? '停止时光流逝' : '让时光自动流逝'"
          :aria-pressed="store.timeFlow"
          @click="toggleTimeFlow"
        >
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="8.4" />
            <path d="M12 7.4V12l3.2 2.4" />
          </svg>
        </button>
        <button class="btn btn-ghost btn-sq" data-testid="btn-achievements" title="成就墙" @click="openAchievements">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M7 4h10v5a5 5 0 0 1-10 0Z" />
            <path d="M7 5.5H4.5a3 3 0 0 0 3 4.4M17 5.5h2.5a3 3 0 0 1-3 4.4" />
            <path d="M12 14v3M8.5 20.5h7M10 17h4l.7 3.5H9.3Z" />
          </svg>
          <span v-if="unlockedCount() > 0" class="ach-badge">{{ unlockedCount() }}</span>
        </button>
        <button
          class="btn btn-ghost btn-sq"
          data-testid="btn-audio"
          :class="{ active: store.audioMuted }"
          :title="store.audioMuted ? '开启声音' : '静音'"
          @click="toggleAudioMute"
        >
          <svg v-if="!store.audioMuted" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5Z" fill="currentColor" stroke="none" />
            <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.8a7.6 7.6 0 0 1 0 10.4" />
          </svg>
          <svg v-else class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5Z" fill="currentColor" stroke="none" />
            <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
          </svg>
        </button>
        <button class="btn btn-ghost" data-testid="btn-redraw" @click="backToDrawing">重新造岛</button>
      </div>
    </div>

    <div ref="rootRef" class="controls glass">
      <button
        class="btn btn-icon"
        data-testid="btn-time"
        :class="{ active: store.timeOfDay !== 'day' }"
        :aria-pressed="store.timeOfDay !== 'day'"
        :title="`当前${TIME_LABEL[store.timeOfDay]}，点击切换`"
        @click="cycleTimeOfDay"
      >
        <svg v-if="store.timeOfDay === 'day'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="4.4" fill="currentColor" stroke="none" />
          <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9" />
        </svg>
        <svg v-else-if="store.timeOfDay === 'dusk'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M6.5 15.5a5.5 5.5 0 0 1 11 0" fill="currentColor" stroke="none" />
          <path d="M2.5 15.5h19M5 19h14M12 4.5v2.4M5.2 7.4l1.7 1.7M18.8 7.4l-1.7 1.7" />
        </svg>
        <svg v-else class="icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.6 14.2A8.6 8.6 0 0 1 9.8 3.4a8.6 8.6 0 1 0 10.8 10.8Z" />
        </svg>
        <span class="ctl-label">{{ TIME_LABEL[store.timeOfDay] }}</span>
      </button>

      <button
        class="btn btn-icon"
        data-testid="btn-weather"
        :class="{ active: store.weather !== 'clear' }"
        :aria-pressed="store.weather !== 'clear'"
        :title="`当前${WEATHER_LABEL[store.weather]}，点击切换`"
        @click="toggleWeather"
      >
        <svg v-if="store.weather === 'clear'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="9" cy="9" r="3.6" fill="currentColor" stroke="none" />
          <path d="M9 2.8v1.6M2.8 9h1.6M4.6 4.6l1.2 1.2M15 9a5.6 5.6 0 1 1-11 .4" />
          <path d="M13 15.5c.8-1.4 2.6-1.4 3.4 0M17.5 15.5c.8-1.4 2.6-1.4 3.4 0" />
        </svg>
        <svg v-else-if="store.weather === 'rain'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M7 15a4.6 4.6 0 1 1 .8-9.1A5.4 5.4 0 0 1 18 8.6 3.4 3.4 0 0 1 17.4 15Z" fill="currentColor" stroke="none" opacity=".9" />
          <path d="M8.5 17.5c.7-1.2 2.3-1.2 3 0M14 17.5c.7-1.2 2.3-1.2 3 0M11 21c.7-1.2 2.3-1.2 3 0" />
        </svg>
        <svg v-else class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M7 14a4.6 4.6 0 1 1 .8-9.1A5.4 5.4 0 0 1 18 7.6 3.4 3.4 0 0 1 17.4 14Z" fill="currentColor" stroke="none" opacity=".9" />
          <circle cx="8" cy="18" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="13.5" cy="20" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="17.5" cy="17.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
        <span class="ctl-label">{{ WEATHER_LABEL[store.weather] }}</span>
      </button>

      <button class="btn btn-icon" data-testid="btn-redecorate" :disabled="store.busy" @click="redecorate">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M20 12a8 8 0 1 1-2.34-5.66" />
          <path d="M20 3.6v4.2h-4.2" />
        </svg>
        <span class="ctl-label">重新装点</span>
      </button>

      <button class="btn btn-primary" data-testid="btn-save" @click="openExport">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M12 15.5V4M8 8l4-4 4 4" />
          <path d="M4.5 15.5v3A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-3" />
        </svg>
        <span class="ctl-label">保存小岛</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.top-bar {
  position: fixed;
  top: max(14px, env(safe-area-inset-top));
  left: 16px;
  right: 16px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  z-index: 20;
  pointer-events: none;
}
.top-bar > * {
  pointer-events: auto;
}
.visit-banner {
  position: fixed;
  top: max(14px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 25;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  font-size: 13px;
  color: #ffe9b8;
}
.btn-mini {
  padding: 6px 12px;
  font-size: 12px;
}
.top-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.btn-sq {
  position: relative;
  padding: 11px;
  border-radius: 14px;
}
.ach-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: linear-gradient(135deg, #ffd79a, #f2a65e);
  color: #5d3a12;
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(8, 40, 56, 0.4);
}
.island-chip {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  max-width: 70vw;
}
.island-name {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #fff3d9;
}
.island-tag {
  font-size: 12px;
  color: var(--text-dim);
  letter-spacing: 0.04em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 64vw;
}
.controls {
  position: fixed;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  z-index: 20;
}
.ctl-label {
  display: none;
}
.btn-icon {
  width: 46px;
  height: 46px;
  padding: 0;
  justify-content: center;
}

@media (min-width: 721px) {
  .controls .btn-icon {
    width: auto;
    padding: 11px 18px;
    border-radius: 999px;
  }
  .ctl-label {
    display: inline;
  }
}

@media (max-width: 720px) {
  .top-bar {
    flex-direction: column-reverse;
    align-items: stretch;
    gap: 8px;
  }
  .top-actions {
    justify-content: flex-end;
    flex-wrap: wrap;
  }
  .island-chip {
    max-width: 100%;
  }
  .controls {
    left: 12px;
    right: 12px;
    top: auto;
    bottom: max(12px, env(safe-area-inset-bottom));
    transform: none;
    flex-direction: row;
    justify-content: space-between;
    padding: 10px;
  }
  .controls .btn {
    flex: 1;
    flex-direction: column;
    gap: 3px;
    font-size: 11px;
  }
  .ctl-label {
    display: inline;
  }
  .top-bar .btn {
    padding: 9px 14px;
    font-size: 13px;
  }
  .top-bar .btn-sq {
    padding: 9px;
  }
  .island-chip {
    max-width: 46vw;
  }
  .visit-banner {
    top: 78px;
    width: calc(100vw - 24px);
    justify-content: space-between;
  }
}
</style>
