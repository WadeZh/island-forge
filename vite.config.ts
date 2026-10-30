/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts']
  }
})
