import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { normalizeLineEndingsPlugin } from './scripts/normalize-line-endings-plugin.js'
import { timelineRefactorPlugin } from './scripts/vite-timeline-refactor-plugin.js'
import { playbackMediaPlugin } from './scripts/vite-playback-media-plugin.js'
import { programPlaybackSyncPlugin } from './scripts/vite-program-playback-sync-plugin.js'
import { unlimitedTimelineImportPlugin } from './scripts/vite-unlimited-timeline-import-plugin.js'
import { durationUiSyncPlugin } from './scripts/vite-duration-ui-sync-plugin.js'
import { smoothTimelineDragPlugin } from './scripts/vite-smooth-timeline-drag-plugin.js'
import { premierePlayheadPlugin } from './scripts/vite-premiere-playhead-plugin.js'
import { trackDeletePlugin } from './scripts/vite-track-delete-plugin.js'
import { stockWorkspacePlugin } from './scripts/vite-stock-workspace-plugin.js'

// https://vite.dev/config/
export default defineConfig({
  // Electron loads dist/index.html through file://, so production assets must be
  // referenced relatively instead of from /assets at the filesystem root.
  base: './',
  // Transform order matters. Stock workspace replaces the legacy placeholder
  // before React compilation. Duration sync must patch the original Monitor
  // signature before playback sync injects media helpers around that component.
  // The playhead transform must also run before smooth drag so it cannot erase
  // the final pointer-drag handler from generated App code. Track deletion runs
  // after timeline transforms so it patches the final dynamic Timeline signature.
  plugins: [normalizeLineEndingsPlugin(), stockWorkspacePlugin(), timelineRefactorPlugin(), playbackMediaPlugin(), unlimitedTimelineImportPlugin(), durationUiSyncPlugin(), programPlaybackSyncPlugin(), premierePlayheadPlugin(), smoothTimelineDragPlugin(), trackDeletePlugin(), react()],
})
