import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { timelineRefactorPlugin } from './scripts/vite-timeline-refactor-plugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [timelineRefactorPlugin(), react()],
})
