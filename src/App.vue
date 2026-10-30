<script setup lang="ts">
import { onMounted } from 'vue'
import AchievementsModal from './components/AchievementsModal.vue'
import DrawPanel from './components/DrawPanel.vue'
import ExplorePanel from './components/ExplorePanel.vue'
import ExportModal from './components/ExportModal.vue'
import GenCard from './components/GenCard.vue'
import StageView from './components/StageView.vue'
import Toast from './components/Toast.vue'
import VisitModal from './components/VisitModal.vue'
import WelcomeScreen from './components/WelcomeScreen.vue'
import { exposeTestHooks } from './game'
import { store } from './state'

onMounted(() => {
  exposeTestHooks()
})
</script>

<template>
  <WelcomeScreen v-if="store.mode === 'idle'" />
  <template v-else>
    <StageView />
    <DrawPanel v-if="store.mode === 'drawing' || store.mode === 'preview'" />
    <GenCard v-if="store.nameCard" />
    <ExplorePanel v-if="store.mode === 'exploring'" />
    <ExportModal v-if="store.exportOpen" />
    <AchievementsModal v-if="store.achievementsOpen" />
    <Toast />
  </template>
  <VisitModal v-if="store.visitModalOpen" />
</template>
