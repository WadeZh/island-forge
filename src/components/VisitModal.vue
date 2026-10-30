<script setup lang="ts">
import gsap from 'gsap'
import { onMounted, ref } from 'vue'
import { visitByCode } from '../game'
import { store } from '../state'

const modalRef = ref<HTMLElement | null>(null)
const code = ref('')
const error = ref('')

onMounted(() => {
  if (modalRef.value) {
    gsap.fromTo(
      modalRef.value,
      { scale: 0.92, y: 22, opacity: 0 },
      { scale: 1, y: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.3)', clearProps: 'all' }
    )
  }
})

function go(): void {
  if (!code.value.trim()) {
    error.value = '先粘贴一段岛屿代码吧'
    return
  }
  if (visitByCode(code.value)) {
    store.visitModalOpen = false
  } else {
    error.value = '这段代码读不出来，检查一下有没有缺字'
  }
}

function close(): void {
  store.visitModalOpen = false
}
</script>

<template>
  <div class="visit-mask" data-testid="visit-mask" @click.self="close">
    <div ref="modalRef" class="visit-modal glass" data-testid="visit-modal">
      <div class="visit-head">
        <h3>拜访好友的小岛</h3>
        <button class="btn btn-ghost btn-close" data-testid="btn-close-visit" @click="close">✕</button>
      </div>
      <p class="visit-desc">把朋友分享的岛屿代码粘贴到下面，立刻登岛做客 —— 无需登录，全程离线。</p>
      <textarea
        v-model="code"
        class="visit-input"
        data-testid="visit-input"
        rows="3"
        placeholder="粘贴岛屿代码，例如：Ab3xK9…"
        spellcheck="false"
      ></textarea>
      <p v-if="error" class="visit-error" data-testid="visit-error">{{ error }}</p>
      <div class="visit-actions">
        <button class="btn btn-primary" data-testid="btn-go-visit" @click="go">前往拜访</button>
        <button class="btn btn-ghost" @click="close">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.visit-mask {
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
.visit-modal {
  width: min(94vw, 480px);
  padding: 18px;
  background: rgba(14, 44, 60, 0.78);
}
.visit-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.visit-head h3 {
  font-size: 16px;
  letter-spacing: 0.12em;
}
.btn-close {
  padding: 7px 12px;
}
.visit-desc {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 12px;
  line-height: 1.6;
}
.visit-input {
  width: 100%;
  resize: none;
  border-radius: 12px;
  border: 1px solid var(--glass-border);
  background: rgba(8, 32, 46, 0.6);
  color: var(--text);
  font-family: ui-monospace, Consolas, monospace;
  font-size: 13px;
  padding: 10px 12px;
  outline: none;
}
.visit-input:focus {
  border-color: rgba(247, 191, 117, 0.6);
}
.visit-error {
  margin-top: 8px;
  font-size: 12px;
  color: #ffb3a3;
}
.visit-actions {
  margin-top: 14px;
  display: flex;
  gap: 10px;
}
</style>
