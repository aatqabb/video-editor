import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { normalizeLineEndingsPlugin } from './scripts/normalize-line-endings-plugin.js'
import { timelineRefactorPlugin } from './scripts/vite-timeline-refactor-plugin.js'
import { smoothTimelineDragPlugin } from './scripts/vite-smooth-timeline-drag-plugin.js'
import { premierePlayheadPlugin } from './scripts/vite-premiere-playhead-plugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [normalizeLineEndingsPlugin(), timelineRefactorPlugin(), smoothTimelineDragPlugin(), premierePlayheadPlugin(), react()],
})