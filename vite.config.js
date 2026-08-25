import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { normalizeLineEndingsPlugin } from './scripts/normalize-line-endings-plugin.js'
import { timelineRefactorPlugin } from './scripts/vite-timeline-refactor-plugin.js'
import { overlapReplacementPlugin } from './scripts/vite-overlap-replacement-plugin.js'
import { playbackMediaPlugin } from './scripts/vite-playback-media-plugin.js'
import { programPlaybackSyncPlugin } from './scripts/vite-program-playback-sync-plugin.js'
import { unlimitedTimelineImportPlugin } from './scripts/vite-unlimited-timeline-import-plugin.js'
import { durationUiSyncPlugin } from './scripts/vite-duration-ui-sync-plugin.js'
import { smoothTimelineDragPlugin } from './scripts/vite-smooth-timeline-drag-plugin.js'
import { premierePlayheadPlugin } from './scripts/vite-premiere-playhead-plugin.js'
import { trackDeletePlugin } from './scripts/vite-track-delete-plugin.js'
import { trackVisibilityUiPlugin } from './scripts/vite-track-visibility-ui-plugin.js'
import { stockWorkspacePlugin } from './scripts/vite-stock-workspace-plugin.js'
import { programTransformOverlayPlugin } from './scripts/vite-program-transform-overlay-plugin.js'
import { timelineTransitionVisibilityPlugin } from './scripts/vite-timeline-transition-visibility-plugin.js'
import { allAudioWaveformsPlugin } from './scripts/vite-all-audio-waveforms-plugin.js'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [normalizeLineEndingsPlugin(), stockWorkspacePlugin(), timelineRefactorPlugin(), overlapReplacementPlugin(), playbackMediaPlugin(), unlimitedTimelineImportPlugin(), durationUiSyncPlugin(), programPlaybackSyncPlugin(), premierePlayheadPlugin(), smoothTimelineDragPlugin(), trackDeletePlugin(), trackVisibilityUiPlugin(), timelineTransitionVisibilityPlugin(), allAudioWaveformsPlugin(), programTransformOverlayPlugin(), react()],
})
