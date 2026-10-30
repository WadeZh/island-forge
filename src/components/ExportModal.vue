<script setup lang="ts">
import gsap from 'gsap'
import { onMounted, ref } from 'vue'
import { backToDrawing, closeExport, getIslandCode, savePosterPng, shareAvailable, sharePoster } from '../game'
import { store, toast } from '../state'

const modalRef = ref<HTMLElement | null>(null)
const saving = ref(false)
const islandCode = getIslandCode()
onMounted(() => {
  if (modalRef.value) {
    gsap.from(modalRef.value, { scale: 0.9, y: 26, opacity: 0, duration: 0.45, ease: 'back.out(1.4)' })
  }
})

async function onSave(): Promise<void> {
  saving.value = true
  try {
    await savePosterPng()
  } finally {
    saving.value = false
  }
}

async function onShare(): Promise<void> {
  await sharePoster()
}

function onAgain(): void {
  closeExport()
  backToDrawing()
}

async function copyCode(): Promise<void> {
  try {
    await navigator.clipboard.writeText(islandCode)
    toast('岛屿代码已复制，发给朋友来拜访吧', 2600)
  } catch {
    // 剪贴板不可用时退化为选中文本
    const el = document.querySelector('[data-testid="island-code"]') as HTMLTextAreaElement | null
    if (el) {
      el.select()
      document.execCommand('copy')
      toast('岛屿代码已复制')
    }
  }
}
</script>

<template>
  <div class="export-mask" data-testid="export-mask" @click.self="closeExport">
    <div ref="modalRef" class="export-modal glass" data-testid="export-modal">
      <div class="export-head">
        <h3>我的小岛 · 分享海报</h3>
        <button class="btn btn-ghost btn-close" data-testid="btn-close-export" @click="closeExport">✕</button>
      </div>
      <img :src="store.posterUrl" alt="小岛海报预览" class="poster" />
      <div class="export-actions">
        <button class="btn btn-primary" data-testid="btn-download" :disabled="saving" @click="onSave">
          {{ saving ? '保存中…' : '保存 PNG' }}
        </button>
        <button v-if="shareAvailable()" class="btn" @click="onShare">系统分享</button>
        <button class="btn btn-ghost" @click="onAgain">再造一座</button>
      </div>
      <div class="code-block" data-testid="code-block">
        <p class="code-title">岛屿代码 · 朋友粘贴它就能登岛拜访</p>
        <textarea
          :value="islandCode"
          class="code-field"
          data-testid="island-code"
          readonly
          rows="2"
          spellcheck="false"
          @focus="($event.target as HTMLTextAreaElement).select()"
        ></textarea>
        <button class="btn btn-sq" data-testid="btn-copy-code" @click="copyCode">复制代码</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.export-mask {
  position: fixed;
  inset: 0;
  background: rgba(6, 24, 36, 0.62);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 18px;
}
.export-modal {
  width: min(94vw, 560px);
  max-height: 92vh;
  overflow: auto;
  padding: 18px;
  background: rgba(14, 44, 60, 0.72);
}
.export-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.export-head h3 {
  font-size: 16px;
  letter-spacing: 0.12em;
}
.btn-close {
  padding: 7px 12px;
}
.poster {
  width: 100%;
  border-radius: 12px;
  display: block;
  box-shadow: 0 8px 30px rgba(4, 18, 28, 0.5);
}
.export-actions {
  margin-top: 14px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}
.code-block {
  margin-top: 16px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(8, 32, 46, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.14);
}
.code-title {
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 8px;
  letter-spacing: 0.06em;
}
.code-field {
  width: 100%;
  resize: none;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(4, 20, 30, 0.6);
  color: #ffe9b8;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.5;
  padding: 8px 10px;
  outline: none;
}
.btn-sq {
  margin-top: 8px;
  width: 100%;
}
</style>
