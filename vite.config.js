import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { normalizeLineEndingsPlugin } from './scripts/normalize-line-endings-plugin.js'
import { timelineRefactorPlugin } from './scripts/vite-timeline-refactor-plugin.js'
import { playbackMediaPlugin } from './scripts/vite-playback-media-plugin.js'
import { programPlaybackSyncPlugin } from './scripts/vite-program-playback-sync-plugin.js'
import { unlimitedTimelineImportPlugin } from './scripts/vite-unlimited-timeline-import-plugin.js'
import { smoothTimelineDragPlugin } from './scripts/vite-smooth-timeline-drag-plugin.js'
import { premierePlayheadPlugin } from './scripts/vite-premiere-playhead-plugin.js'

// https://vite.dev/config/
export default defineConfig({
  // Order matters: the playhead transform rewrites the scrub block up to the
  // legacy onDragStart handler. Run it before the smooth-drag transform so it
  // cannot accidentally erase startClipPointerDrag from the generated App code.
  plugins: [normalizeLineEndingsPlugin(), timelineRefactorPlugin(), playbackMediaPlugin(), programPlaybackSyncPlugin(), unlimitedTimelineImportPlugin(), premierePlayheadPlugin(), smoothTimelineDragPlugin(), react()],
})
