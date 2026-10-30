<script setup lang="ts">
import gsap from 'gsap'
import { onMounted, ref, watch } from 'vue'
import { store } from '../state'

const rootRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (rootRef.value) {
    gsap.from(rootRef.value, { scale: 0.86, opacity: 0, duration: 0.65, ease: 'back.out(1.6)' })
    gsap.from('.card-line', { y: 14, opacity: 0, duration: 0.5, stagger: 0.12, delay: 0.15, ease: 'power2.out' })
  }
  setTimeout(() => {
    store.nameCard = false
  }, 4200)
})

watch(
  () => store.nameCard,
  (v) => {
    if (!v && rootRef.value) {
      gsap.to(rootRef.value, { opacity: 0, y: -16, duration: 0.4, ease: 'power2.in' })
    }
  }
)
</script>

<template>
  <div class="gen-card-wrap">
    <div ref="rootRef" class="gen-card glass" data-testid="name-card">
      <p class="card-line card-kicker">
        {{
          store.nameCardData.memorial
            ? '1024 造物纪念 · 面积刚刚好的岛'
            : store.nameCardData.isStar
              ? '有人把星星按进了海里'
              : store.nameCardData.isHeart
                ? '有人把海画成了心形'
                : '你的小岛诞生了'
        }}
      </p>
      <div class="card-line card-name-row">
        <h2 class="card-name">{{ store.nameCardData.name }}</h2>
        <span class="grade-badge" :class="`grade-${store.nameCardData.grade}`" data-testid="grade-badge">{{
          store.nameCardData.grade
        }}</span>
      </div>
      <p class="card-line card-tag">{{ store.nameCardData.tagline }}</p>
    </div>
  </div>
</template>

<style scoped>
.gen-card-wrap {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 13vh;
  pointer-events: none;
  z-index: 30;
}
.gen-card {
  text-align: center;
  padding: 26px 44px;
  background: rgba(12, 38, 54, 0.55);
}
.card-kicker {
  font-size: 12px;
  letter-spacing: 0.3em;
  color: rgba(238, 248, 252, 0.75);
}
.card-name-row {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.card-name {
  font-size: clamp(34px, 6vw, 52px);
  font-weight: 800;
  letter-spacing: 0.12em;
  background: linear-gradient(180deg, #fff6e2, var(--gold));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.grade-badge {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 17px;
  border: 2px solid currentColor;
  background: rgba(10, 34, 48, 0.55);
}
.grade-S {
  color: #f7bf75;
}
.grade-A {
  color: #d9e4ec;
}
.grade-B {
  color: #d0a47f;
}
.grade-C {
  color: #9aa7ae;
}
.card-tag {
  margin-top: 10px;
  font-size: 15px;
  color: var(--text-dim);
  letter-spacing: 0.06em;
}
</style>
